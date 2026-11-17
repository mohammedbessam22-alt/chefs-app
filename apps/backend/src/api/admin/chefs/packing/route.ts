import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { baghdadDayFilter } from "../../../../lib/baghdad-day"
import { effectiveConfirmation } from "../../../../lib/order-row"
import { groupByLocation, resolveItemLocation, UNASSIGNED } from "../../../../lib/packing"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const q = req.query as Record<string, string | undefined>
  const filters = baghdadDayFilter(q.date)
  if (!filters) {
    res.status(400).json({ type: "invalid_data", message: "date must be YYYY-MM-DD" })
    return
  }
  const query: any = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  // Reads the order's current items (live order_item rows), so staff edits are reflected.
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "status", "display_id", "metadata", "items.id", "items.variant_id", "items.title", "items.quantity"],
    filters,
    pagination: { order: { created_at: "ASC" }, take: null },
  })
  const orders = data
    .filter(
      (o: any) =>
        effectiveConfirmation(o) === "confirmed" && (!q.round_label || (o.metadata?.round_label ?? null) === q.round_label)
    )
    .map((o: any) => ({
      display_id: o.display_id,
      items: (o.items ?? []).map((i: any) => ({ id: i.id, variant_id: i.variant_id, title: i.title, quantity: Number(i.quantity) })),
    }))

  const allItems = orders.flatMap((o: any) => o.items)
  const variantIds = [...new Set(allItems.map((i: any) => i.variant_id).filter(Boolean))]
  const levelLocs: Record<string, string[]> = {}
  if (variantIds.length) {
    const { data: variants } = await query.graph({
      entity: "variant",
      fields: ["id", "inventory_items.inventory.location_levels.location_id"],
      filters: { id: variantIds },
      pagination: { take: null },
    })
    for (const v of variants) {
      levelLocs[v.id] = (v.inventory_items ?? [])
        .flatMap((ii: any) => ii.inventory?.location_levels ?? [])
        .map((l: any) => l.location_id)
    }
  }
  // Reservations (one batched query) say where each line item's stock was actually allocated.
  const lineIds = allItems.map((i: any) => i.id).filter(Boolean)
  const reservedLocs: Record<string, string[]> = {}
  if (lineIds.length) {
    const reservations = await req.scope
      .resolve("inventory")
      .listReservationItems({ line_item_id: lineIds }, { take: null })
    for (const r of reservations) if (r.line_item_id) (reservedLocs[r.line_item_id] ??= []).push(r.location_id)
  }
  const variantLocation: Record<string, string> = {}
  for (const i of allItems as any[]) {
    const loc = resolveItemLocation(reservedLocs[i.id] ?? [], levelLocs[i.variant_id] ?? [])
    if (loc) variantLocation[i.id] = loc
  }

  const grouped = groupByLocation(orders, variantLocation)
  const ids = Object.keys(grouped).filter((id) => id !== UNASSIGNED)
  const names: Record<string, string> = {}
  if (ids.length) {
    const locs = await req.scope.resolve("stock_location").listStockLocations({ id: ids }, { take: null })
    for (const l of locs) names[l.id] = l.name
  }
  const locations = [
    ...ids.map((id) => ({ id, name: names[id] ?? id, orders: grouped[id] })).sort((a, b) => a.name.localeCompare(b.name)),
    ...(grouped[UNASSIGNED] ? [{ id: UNASSIGNED, name: "Unassigned", orders: grouped[UNASSIGNED] }] : []),
  ]
  res.json({ locations })
}
