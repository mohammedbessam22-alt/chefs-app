import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ORDER_ROW_FIELDS, toOrderRow } from "../../../../lib/order-row"

// Business timezone Asia/Baghdad is fixed UTC+03:00 (same convention as lib/rounds.ts).
const BAGHDAD_OFFSET_MS = 180 * 60_000

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const q = req.query as Record<string, string | undefined>
  const filters: Record<string, any> = {}

  if (q.date !== undefined) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(q.date)
    const start = m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN
    if (!m || Number.isNaN(start) || new Date(start).toISOString().slice(0, 10) !== q.date) {
      res.status(400).json({ type: "invalid_data", message: "date must be YYYY-MM-DD" })
      return
    }
    const from = new Date(start - BAGHDAD_OFFSET_MS)
    const to = new Date(start + 86_400_000 - BAGHDAD_OFFSET_MS)
    filters.created_at = { $gte: from.toISOString(), $lt: to.toISOString() }
  }

  const query: any = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ORDER_ROW_FIELDS,
    filters,
    pagination: { order: { created_at: "DESC" } },
  })

  // Staff state lives in order.metadata, so these filters are applied in memory.
  const orders = data
    .map(toOrderRow)
    .filter(
      (o: any) =>
        (!q.confirmation || o.confirmation === q.confirmation) &&
        (!q.delivery_type || o.delivery_type === q.delivery_type) &&
        (!q.round_label || o.round_label === q.round_label)
    )
  res.json({ orders })
}
