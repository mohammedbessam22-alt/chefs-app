import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { effectiveConfirmation } from "../../../../../lib/order-row"

const FIELDS = ["id", "status", "display_id", "created_at", "total", "metadata"]

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query: any = req.scope.resolve("query")
  const { data } = await query.graph({ entity: "order", fields: FIELDS, filters: { id: req.params.id } })
  const o = data?.[0]
  if (!o) {
    res.status(404).json({ type: "not_found", message: "Order not found" })
    return
  }
  const m = o.metadata ?? {}
  res.json({
    id: o.id,
    display_id: o.display_id,
    created_at: o.created_at,
    total: Number(o.total),
    confirmation: effectiveConfirmation(o),
    delivery_type: m.delivery_type ?? "regular",
    round_label: m.round_label ?? null,
  })
}
