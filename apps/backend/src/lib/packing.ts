type PackOrder = { display_id: number; items: { variant_id: string; title: string; quantity: number }[] }
export type PackedOrder = { display_id: number; items: { title: string; quantity: number }[] }

export const UNASSIGNED = "unassigned"

/** Splits orders into per-location packing lists; items with an unmapped variant go under "unassigned". */
export function groupByLocation(
  orders: PackOrder[],
  variantLocation: Record<string, string>
): Record<string, PackedOrder[]> {
  const out: Record<string, PackedOrder[]> = {}
  for (const o of orders) {
    const byLoc: Record<string, PackedOrder["items"]> = {}
    for (const i of o.items) {
      const loc = variantLocation[i.variant_id] ?? UNASSIGNED
      ;(byLoc[loc] ??= []).push({ title: i.title, quantity: i.quantity })
    }
    for (const [loc, items] of Object.entries(byLoc)) {
      ;(out[loc] ??= []).push({ display_id: o.display_id, items })
    }
  }
  return out
}
