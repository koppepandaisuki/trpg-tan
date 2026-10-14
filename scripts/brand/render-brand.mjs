// ブランド画像(OGP / Stripe のプラン画像 / インストーラー)を「白・黒・紅」で描き出す。
// Next 同梱の @vercel/og(satori + resvg)を使う。使い方: node render-brand.mjs <repo> <outDir> <fontDir>
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const [repo, out, fontDir] = process.argv.slice(2);
const require = createRequire(path.join(repo, "package.json"));
const ogPath = path.join(path.dirname(require.resolve("next/package.json")), "dist/compiled/@vercel/og/index.node.js");
const { ImageResponse } = await import(ogPath);

const font = (f) => fs.readFileSync(path.join(fontDir, f));
const fonts = [
  { name: "Sans", data: font("kaku-w3.otf"), weight: 400, style: "normal" },
  { name: "Sans", data: font("kaku-w6.otf"), weight: 700, style: "normal" },
  { name: "Sans", data: font("kaku-w8.otf"), weight: 900, style: "normal" },
  { name: "Serif", data: font("mincho-2.otf"), weight: 700, style: "normal" },
];
const dataUri = (p) => "data:image/png;base64," + fs.readFileSync(path.join(repo, p)).toString("base64");
const LOGO_DARK = dataUri("public/brand/re-dice-dark.png"); // 1238x368
const LOGO_LIGHT = dataUri("public/brand/re-dice.png"); // 1240x373
const ICON_RED = dataUri("apps/desktop/src-tauri/icons/icon.red.png"); // 2048 角丸の紅

const RED = "#A51A1D";
const INK = "#0F0F0F";

// 小さな JSX 代わり(satori は {type, props} をそのまま受け取る)
const h = (type, style = {}, ...children) => ({
  type,
  props: { style: { display: "flex", ...style }, children: children.flat().filter((c) => c !== null && c !== false) },
});
const img = (src, style) => ({ type: "img", props: { src, style } });
const diamond = (size = 10, color = RED) => h("div", { width: size, height: size, background: color, transform: "rotate(45deg)" });
/** 紅のアイコン(素材の外周の淡い縁を 4% ずつ切り落とし、角丸で包む)。 */
const icon = (size, style = {}) =>
  h("div", { width: size, height: size, borderRadius: size * 0.22, overflow: "hidden", ...style },
    img(ICON_RED, { width: size * 1.08, height: size * 1.08, marginLeft: -size * 0.04, marginTop: -size * 0.04 }));
const dots = (alpha = 0.06, gap = 24) =>
  h("div", {
    position: "absolute", left: 0, top: 0, right: 0, bottom: 0,
    backgroundImage: `radial-gradient(circle, rgba(255,255,255,${alpha}) 1px, transparent 1.4px)`,
    backgroundSize: `${gap}px ${gap}px`,
  });

async function save(el, w, h_, file) {
  const res = new ImageResponse(el, { width: w, height: h_, fonts });
  fs.writeFileSync(path.join(out, file), Buffer.from(await res.arrayBuffer()));
  console.log("wrote", file);
}

/* ===== OGP 1200x630 ===== */
const pill = (text, filled = false) =>
  h("div", {
    padding: "10px 22px", borderRadius: 999, fontSize: 22, fontWeight: 700,
    color: filled ? "#fff" : "rgba(255,255,255,0.88)",
    background: filled ? RED : "rgba(255,255,255,0.06)",
    border: filled ? `1px solid ${RED}` : "1px solid rgba(255,255,255,0.22)",
  }, text);

const og = h("div", {
  width: 1200, height: 630, position: "relative", background: INK, fontFamily: "Sans", color: "#fff",
  backgroundImage: `radial-gradient(circle at 88% 18%, rgba(165,26,29,0.95) 0%, rgba(165,26,29,0.45) 22%, rgba(15,15,15,0) 55%)`,
},
  dots(0.07),
  // 右: アイコン(少し傾けて)
  h("div", { position: "absolute", right: 92, top: 178, transform: "rotate(-8deg)", borderRadius: 60, boxShadow: "0 40px 80px rgba(0,0,0,0.6)" },
    icon(272)),
  h("div", { position: "absolute", left: 80, bottom: 52, fontSize: 20, letterSpacing: 3, color: "rgba(255,255,255,0.45)" }, "re-dice.net"),
  // 左: ロゴ・見出し
  h("div", { position: "absolute", left: 80, top: 60, flexDirection: "column" },
    img(LOGO_DARK, { width: 280, height: 83 }),
    h("div", { marginTop: 48, alignItems: "center", fontSize: 18, letterSpacing: 6, color: "rgba(255,255,255,0.6)", fontWeight: 700 },
      diamond(10), h("div", { marginLeft: 14 }, "TRPG ONLINE SESSION")),
    h("div", { marginTop: 16, fontFamily: "Serif", fontSize: 64, fontWeight: 700, letterSpacing: 1 }, "卓を立てて、すぐ遊ぶ。"),
    h("div", { marginTop: 18, fontSize: 26, color: "rgba(255,255,255,0.72)", lineHeight: 1.5 }, "ブラウザで遊べる TRPG オンラインセッション。"),
    h("div", { fontSize: 26, color: "rgba(255,255,255,0.72)", lineHeight: 1.5 }, "参加者はログインもインストールも不要。"),
    h("div", { marginTop: 32, gap: 12 }, pill("無料で卓を立てる", true), pill("BCDice 280+ システム")),
  ),
);

/* ===== Stripe のプラン画像 1024x1024 ===== */
const plan = ({ code, kana, price, tag, bg, glow, plate }) =>
  h("div", {
    width: 1024, height: 1024, position: "relative", background: bg, fontFamily: "Sans", color: "#fff",
    backgroundImage: glow,
  },
    dots(0.08, 28),
    // 右下: アイコンの面(大きく、薄く傾けて)
    h("div", { position: "absolute", right: -70, bottom: -70, transform: "rotate(-12deg)", opacity: 0.16 },
      icon(560)),
    h("div", { position: "absolute", left: 96, top: 96, flexDirection: "column" },
      // 紅の面ではロゴのダイスが沈むので、白い札に載せる
      plate
        ? h("div", { alignSelf: "flex-start", background: "#fff", borderRadius: 24, padding: "18px 28px", boxShadow: "0 10px 30px rgba(0,0,0,0.25)" },
            img(LOGO_LIGHT, { width: 250, height: 75 }))
        : img(LOGO_DARK, { width: 300, height: 89 }),
      h("div", { marginTop: 120, alignItems: "center", fontSize: 26, letterSpacing: 8, fontWeight: 700, color: "rgba(255,255,255,0.75)" },
        diamond(14, "#fff"), h("div", { marginLeft: 18 }, "PLAN")),
      h("div", { marginTop: 64, fontSize: 210, fontWeight: 900, letterSpacing: 4, lineHeight: 1 }, code),
      h("div", { marginTop: 30, fontSize: 44, fontWeight: 700, color: "rgba(255,255,255,0.85)" }, kana),
      h("div", { marginTop: 56, alignItems: "flex-end" },
        h("div", { fontSize: 56, fontWeight: 700, lineHeight: 1, color: "rgba(255,255,255,0.75)", marginRight: 8, marginBottom: 6 }, "¥"),
        h("div", { fontSize: 120, fontWeight: 900, lineHeight: 1, letterSpacing: 2 }, price),
        h("div", { fontSize: 44, fontWeight: 700, lineHeight: 1, color: "rgba(255,255,255,0.75)", marginLeft: 12, marginBottom: 6 }, "/ 月")),
      h("div", { marginTop: 22, fontSize: 32, color: "rgba(255,255,255,0.75)" }, tag),
    ),
  );

/* ===== インストーラー(NSIS) ===== */
const sidebar = h("div", {
  width: 164, height: 314, position: "relative", background: INK, fontFamily: "Sans", color: "#fff",
  flexDirection: "column", alignItems: "center",
  backgroundImage: `radial-gradient(circle at 50% 0%, rgba(165,26,29,0.9) 0%, rgba(165,26,29,0.3) 35%, rgba(15,15,15,0) 70%)`,
},
  h("div", { marginTop: 112 }, img(LOGO_DARK, { width: 134, height: 40 })),
  h("div", { marginTop: 14, fontSize: 9.5, color: "rgba(255,255,255,0.65)", letterSpacing: 1 }, "TRPG オンラインセッション"),
  h("div", { marginTop: 16, width: 96, height: 1, background: "rgba(255,255,255,0.2)" }),
);
const header = h("div", { width: 150, height: 57, background: "#ffffff", alignItems: "center", justifyContent: "center" },
  img(LOGO_LIGHT, { width: 130, height: 39 }));

await save(og, 1200, 630, "opengraph-image.png");
await save(plan({
  code: "PLAY", kana: "プレイ", price: "500", tag: "もっと快適に遊ぶ人へ", plate: true,
  bg: RED, glow: "linear-gradient(135deg, #B8262A 0%, #A51A1D 45%, #6E0F12 100%)",
}), 1024, 1024, "stripe-plan-play.png");
await save(plan({
  code: "PRO", kana: "プロ", price: "980", tag: "作る人・上級者へ",
  bg: INK, glow: "radial-gradient(circle at 85% 12%, rgba(165,26,29,0.85) 0%, rgba(165,26,29,0.3) 28%, rgba(15,15,15,0) 60%)",
}), 1024, 1024, "stripe-plan-pro.png");
await save(sidebar, 164, 314, "installer-sidebar.png");
await save(header, 150, 57, "installer-header.png");
