import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { TRANSLATIONS_MODULE } from "../../../../modules/translations"
import { ENTITY_TYPES, LOCALES } from "../../../../modules/translations/service"

const putSchema = z.object({
  entity_type: z.enum(ENTITY_TYPES),
  entity_id: z.string().min(1),
  locale: z.enum(LOCALES),
  title: z.string(),
  description: z.string().nullish(),
})

const getSchema = z.object({
  entity_type: z.enum(ENTITY_TYPES),
  entity_id: z.string().min(1),
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const parsed = getSchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ type: "invalid_data", message: parsed.error.message })
    return
  }
  const svc: any = req.scope.resolve(TRANSLATIONS_MODULE)
  res.json({ translations: await svc.listForEntity(parsed.data.entity_type, parsed.data.entity_id) })
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const parsed = putSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({ type: "invalid_data", message: parsed.error.message })
    return
  }
  const svc: any = req.scope.resolve(TRANSLATIONS_MODULE)
  const translation = await svc.upsertTranslation(parsed.data)
  res.json({ translation })
}
