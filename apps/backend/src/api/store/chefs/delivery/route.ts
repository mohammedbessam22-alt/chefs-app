import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DELIVERY_SETTINGS_MODULE } from "../../../../modules/delivery-settings"
import { nextRound } from "../../../../lib/rounds"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc: any = req.scope.resolve(DELIVERY_SETTINGS_MODULE)
  const s = await svc.getSettings()
  res.json({
    whatsapp_number: s.whatsapp_number,
    next_round: nextRound(new Date(), s.round_times ?? [], s.cutoff_minutes),
  })
}
