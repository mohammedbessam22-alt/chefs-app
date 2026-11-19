import type { Confirmation } from "./confirmation"

export const ORDER_ROW_FIELDS = [
  "id",
  "status",
  "display_id",
  "created_at",
  "total",
  "metadata",
  "shipping_address.first_name",
  "shipping_address.phone",
  "shipping_address.address_1",
  "shipping_address.metadata",
  "items.title",
  "items.quantity",
]

/** Medusa-canceled orders are cancelled even if metadata is stale (e.g. a failed metadata write). */
export function effectiveConfirmation(o: any): Confirmation {
  if (o?.status === "canceled") return "cancelled"
  return (o?.metadata?.confirmation ?? "awaiting") as Confirmation
}

export function toOrderRow(o: any) {
  const m = o.metadata ?? {}
  const a = o.shipping_address ?? {}
  const num = (v: any) => (v === undefined || v === null || v === "" ? null : Number(v))
  return {
    id: o.id,
    display_id: o.display_id,
    created_at: o.created_at,
    total: Number(o.total),
    confirmation: effectiveConfirmation(o),
    delivery_type: m.delivery_type ?? "regular",
    round_label: m.round_label ?? null,
    customer_name: a.first_name ?? null,
    phone: a.phone ?? null,
    landmark: a.address_1 ?? null,
    lat: num(a.metadata?.lat),
    lng: num(a.metadata?.lng),
    items: (o.items ?? []).map((i: any) => ({ title: i.title, quantity: Number(i.quantity) })),
  }
}
