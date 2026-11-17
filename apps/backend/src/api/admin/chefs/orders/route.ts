import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ORDER_ROW_FIELDS, toOrderRow } from "../../../../lib/order-row"

// Business timezone Asia/Baghdad is fixed UTC+03:00 (same convention as lib/rounds.ts).
const BAGHDAD_OFFSET_MS = 180 * 60_000

const baghdadDay = (ms: number) => new Date(ms + BAGHDAD_OFFSET_MS).toISOString().slice(0, 10)

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
  const date = q.date ?? baghdadDay(Date.now())
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const start = m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN
  if (!m || Number.isNaN(start) || new Date(start).toISOString().slice(0, 10) !== date) {
    res.status(400).json({ type: "invalid_data", message: "date must be YYYY-MM-DD" })
    return
  }
  const filters = {
    created_at: {
      $gte: new Date(start - BAGHDAD_OFFSET_MS).toISOString(),
      $lt: new Date(start + 86_400_000 - BAGHDAD_OFFSET_MS).toISOString(),
    },
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
