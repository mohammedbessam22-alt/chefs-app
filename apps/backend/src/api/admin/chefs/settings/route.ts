import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { DELIVERY_SETTINGS_MODULE } from "../../../../modules/delivery-settings"
import { normalizeIraqiPhone } from "../../../../lib/phone"
import { AUTO_CANCEL_MAX, AUTO_CANCEL_MIN, CUTOFF_MAX, CUTOFF_MIN } from "../../../../lib/settings-bounds"

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

const schema = z.object({
  whatsapp_number: z
    .string()
    .transform((v, ctx) => {
      try {
        return normalizeIraqiPhone(v)
      } catch {
        ctx.addIssue({ code: "custom", message: "invalid_phone" })
        return z.NEVER
      }
    })
    .optional(),
  round_times: z.array(z.string().regex(HHMM)).optional(),
  cutoff_minutes: z.number().int().min(CUTOFF_MIN).max(CUTOFF_MAX).optional(),
  // 0 would cancel every new order on the next job run.
  auto_cancel_minutes: z.number().int().min(AUTO_CANCEL_MIN).max(AUTO_CANCEL_MAX).optional(),
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc: any = req.scope.resolve(DELIVERY_SETTINGS_MODULE)
  res.json(await svc.getSettings())
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = schema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({ type: "invalid_data", message: parsed.error.message })
    return
  }
  const data = parsed.data
  if (data.round_times) data.round_times = [...new Set(data.round_times)].sort()
  const svc: any = req.scope.resolve(DELIVERY_SETTINGS_MODULE)
  res.json(await svc.updateSettings(data))
}
