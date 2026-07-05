# Stripe 運用ランブック(チャージバック・不正対策)

Re-dice の決済(Stripe)を本番運営するうえでの設定と対応手順。コードで完結しない
「ダッシュボードでやること」を中心にまとめる。関連コード: `lib/stripe/webhook.ts`、
`app/api/stripe/webhook/route.ts`。

## 前提: 何が現金化リスクか

| 経路 | 現金化 | チャージバック被害 |
|---|---|---|
| ゴールドパック購入(Stripe → gold 付与) | **不可**(閉じた経済) | 限定的。ゴールドは払い出せないので、被害はカード決済手数料+付与済みゴールドの範囲 |
| 作品購入(JPY・Stripe Connect でクリエイターへ出金) | **可**(クリエイター報酬) | **実リスク**。盗難カードで購入 → クリエイター出金 → チャージバックで運営が負担 |
| 月額プラン(play/pro サブスク) | 不可 | 限定的 |

→ 対策の主眼は **作品購入(Connect 出金)** の不正。

## 1. Radar(不正検知)を有効化

Stripe ダッシュボード → **Radar**。標準の機械学習ルールは自動で効くが、以下を追加推奨:

- **`Block if risk_level = highest`**(既定で有効なことが多い。確認する)
- **`Review if risk_level = elevated`** — 手動レビューキューに回す
- **3Dセキュア強制**: `Request 3D Secure if risk_level = elevated`(EU/対応カードで本人認証を要求)
- CVC/郵便番号チェック失敗のブロック(`Block if :cvc_check: = fail`)

Radar for Fraud Teams(有料)まで入れるかは取引量を見て判断。α〜小規模なら標準ルール＋上記で十分。

## 2. Connect 出金(payout)の保留

新規クリエイターの盗難カード換金を防ぐため、**出金までにラグを設ける**。

Stripe ダッシュボード → **Connect → Settings → Payouts**(またはアカウント作成時の
`payout_schedule` 設定):

- **payout schedule を `delay_days` 付き**にする(例: 7〜14 日)。購入直後に即出金させない。
- 高リスク兆候のあるクリエイターは手動で `payouts` を一時停止できる。

コード側の補足: クリエイターの `charges_enabled` は `account.updated` webhook で
`profiles.stripe_charges_enabled` に同期済み(出品ガードに使用)。出金スケジュールは
Stripe 側の設定なのでコード変更は不要。

## 3. チャージバック(dispute)への対応

チャージバックが起きると Stripe から `charge.dispute.created` が飛び、**運営 Discord に
自動アラート**が届く(`handleDisputeCreated`、送信先は `DISCORD_ALERT_WEBHOOK_URL` /
無ければ `DISCORD_FEEDBACK_WEBHOOK_URL`)。アラートを見たら:

1. Stripe ダッシュボード → **Payments → Disputes** で該当 dispute を開く。
2. `reason`(fraudulent / product_not_received など)を確認。
3. **争う(証拠提出)か受諾かを判断**:
   - 作品購入で正当な取引の証拠(ダウンロードログ・購入者の利用実績)があれば証拠提出。
   - 明らかな不正・立証困難なら受諾(争っても手数料が二重にかかる場合がある)。
4. 証拠は dispute の期限(`evidence_details.due_by`)までに提出。
5. 決着すると `charge.dispute.closed` が飛び、結果(won/lost)が Discord に届く。

> 現状、dispute で購入状態(`purchases`)の自動失効はしていない。必要なら
> 「dispute lost 時に該当購入を無効化」する処理を後日追加する(スキーマに
> `disputed` 状態を足す設計判断が要る)。まずは手動対応 + アラートで運用する。

## 4. 返金(refund)の既存挙動

- `charge.refunded`(**全額返金のみ**)で `purchases.status = 'refunded'` に更新
  (`handleChargeRefunded`)。部分返金は対象外(必要なら admin で作品停止)。
- ゴールドパックの返金: ゴールドは現金化不可なので、返金してもゴールドは回収されない
  (閉じた経済の性質上、被害は限定的)。

## 5. 必要な環境変数

| 変数 | 用途 |
|---|---|
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | 決済・webhook 署名検証 |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Connect イベント用の別署名(任意・2 エンドポイント運用時) |
| `DISCORD_ALERT_WEBHOOK_URL` | チャージバック/異常検知アラートの送信先(無ければ feedback webhook に相乗り) |

## 6. webhook に登録するイベント

Stripe ダッシュボード → **Developers → Webhooks** のエンドポイントに、既存に加えて
以下が届くようにする(`charge.dispute.*` を購読):

- `checkout.session.completed` / `checkout.session.async_payment_succeeded`
- `charge.refunded`
- `charge.dispute.created` / `charge.dispute.closed` ← **今回追加**
- `account.updated`
- `customer.subscription.created` / `updated` / `deleted`
