type PackOrder = { display_id: number; items: { id?: string; variant_id: string; title: string; quantity: number }[] }
export type PackedOrder = { display_id: number; items: { title: string; quantity: number }[] }

export const UNASSIGNED = "unassigned"

/**
 * Location for one line item: the reservation location if all reservations agree, else
 * (no reservation) the single distinct level location; zero or several distinct -> undefined (unassigned).
 */
export function resolveItemLocation(reservationLocs: string[], levelLocs: string[]): string | undefined {
  const res = [...new Set(reservationLocs)]
  if (res.length) return res.length === 1 ? res[0] : undefined
  const lev = [...new Set(levelLocs)]
  return lev.length === 1 ? lev[0] : undefined
}

/** Splits orders into per-location packing lists (itemLocation keyed by line item id, falling back to variant id); items with an unmapped variant go under "unassigned". */
export function groupByLocation(
  orders: PackOrder[],
  itemLocation: Record<string, string>
): Record<string, PackedOrder[]> {
  const out: Record<string, PackedOrder[]> = {}
  for (const o of orders) {
    const byLoc: Record<string, PackedOrder["items"]> = {}
    for (const i of o.items) {
      if (!(i.quantity > 0)) continue
      // keyed by line item id when present, else by variant id
      const loc = itemLocation[i.id ?? i.variant_id] ?? UNASSIGNED
      ;(byLoc[loc] ??= []).push({ title: i.title, quantity: i.quantity })
    }
    for (const [loc, items] of Object.entries(byLoc)) {
      ;(out[loc] ??= []).push({ display_id: o.display_id, items })
    }
  }
  return out
}
