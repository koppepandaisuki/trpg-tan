-- INSERT が漏れていたため追加（2026-05-22 F-1 検証で発覚）
GRANT INSERT ON public.products TO authenticated;grant update on public.products to authenticated;
