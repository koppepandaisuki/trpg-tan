export type ProductStatus = "draft" | "pending" | "published" | "suspended";

export const STATUS_LABEL: Record<ProductStatus, string> = {
  draft: "下書き",
  pending: "審査中",
  published: "公開中",
  suspended: "停止中",
};

export function statusLabel(status: ProductStatus): string {
  return STATUS_LABEL[status] ?? status;
}

/** Map status to a Badge variant. Keep the palette muted by design. */
export function statusBadgeVariant(
  status: ProductStatus,
): "muted" | "category" | "default" | "warning" {
  switch (status) {
    case "published":
      return "category";
    case "pending":
      return "warning";
    case "suspended":
      return "default";
    case "draft":
    default:
      return "muted";
  }
}
