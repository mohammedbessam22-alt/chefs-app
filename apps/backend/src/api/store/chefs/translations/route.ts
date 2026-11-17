import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { TRANSLATIONS_MODULE } from "../../../../modules/translations"
import { LOCALES, type Locale } from "../../../../modules/translations/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  // Medusa's locale middleware consumes `?locale=` (moves it to req.locale and removes it from req.query).
  const raw = (req as unknown as { locale?: string }).locale ?? (req.query as Record<string, string | undefined>).locale
  const locale = raw?.toLowerCase()
  if (locale === "ar") {
    // Arabic is the base language stored on the entities themselves.
    res.json({ translations: { product: {}, category: {}, collection: {} } })
    return
  }
  if (!locale || !(LOCALES as readonly string[]).includes(locale)) {
    res.status(400).json({ type: "invalid_data", message: "locale must be one of ar, ckb, tk, en" })
    return
  }
  const svc: any = req.scope.resolve(TRANSLATIONS_MODULE)
  res.json({ translations: await svc.mapForLocale(locale as Locale) })
}
