export type ProductStatus = "draft" | "published" | "suspended";

export const STATUS_LABEL: Record<ProductStatus, string> = {
  draft: "下書き",
  published: "公開中",
  suspended: "停止中",
};

export function statusLabel(status: ProductStatus): string {
  return STATUS_LABEL[status] ?? status;
}

/** Map status to a Badge variant. Keep the palette muted by design. */
export function statusBadgeVariant(
  status: ProductStatus,
): "muted" | "category" | "default" {
  switch (status) {
    case "published":
      return "category";
    case "suspended":
      return "default";
    case "draft":
    default:
      return "muted";
  }
}
