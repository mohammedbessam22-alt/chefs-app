import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { baghdadDayFilter } from "../../../../lib/baghdad-day"
import { ORDER_ROW_FIELDS, toOrderRow } from "../../../../lib/order-row"

function intParam(v: string | undefined, def: number, min: number, max: number): number | null {
  if (v === undefined) return def
  if (!/^\d+$/.test(v)) return null
  return Math.min(Math.max(Number(v), min), max)
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const q = req.query as Record<string, string | undefined>
  const limit = intParam(q.limit, 100, 1, 500)
  const offset = intParam(q.offset, 0, 0, Number.MAX_SAFE_INTEGER)
  if (limit === null || offset === null) {
    res.status(400).json({ type: "invalid_data", message: "limit and offset must be non-negative integers" })
    return
  }

  // Without a date, default to today (Baghdad) so the in-memory filters never scan all orders.
  const filters = baghdadDayFilter(q.date)
  if (!filters) {
    res.status(400).json({ type: "invalid_data", message: "date must be YYYY-MM-DD" })
    return
  }

  const query: any = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  // take: null = no implicit default limit; the set is bounded by one calendar day.
  const { data } = await query.graph({
    entity: "order",
    fields: ORDER_ROW_FIELDS,
    filters,
    pagination: { order: { created_at: "DESC" }, take: null },
  })

  // Staff state lives in order.metadata, so these filters are applied in memory, before pagination.
  const matching = data
    .map(toOrderRow)
    .filter(
      (o: any) =>
        (!q.confirmation || o.confirmation === q.confirmation) &&
        (!q.delivery_type || o.delivery_type === q.delivery_type) &&
        (!q.round_label || o.round_label === q.round_label)
    )
  res.json({ orders: matching.slice(offset, offset + limit), count: matching.length, limit, offset })
}
