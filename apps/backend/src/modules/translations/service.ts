import { MedusaService } from "@medusajs/framework/utils"
import Translation from "./models/translation"

export const ENTITY_TYPES = ["product", "category", "collection"] as const
export const LOCALES = ["ckb", "tk", "en"] as const
export type EntityType = (typeof ENTITY_TYPES)[number]
export type Locale = (typeof LOCALES)[number]

export type TranslationRow = {
  id: string
  entity_type: EntityType
  entity_id: string
  locale: Locale
  title: string
  description: string | null
}

export type TranslationMap = Record<EntityType, Record<string, { title: string; description: string | null }>>

// MedusaService generates loosely typed CRUD methods; the casts live at this boundary only.
const asRows = (rows: unknown) => rows as TranslationRow[]

class TranslationsModuleService extends MedusaService({ ChefsTranslation: Translation }) {
  /** Create/update the translation; an empty (blank) title deletes it. */
  async upsertTranslation(input: {
    entity_type: EntityType
    entity_id: string
    locale: Locale
    title: string
    description?: string | null
  }): Promise<TranslationRow | null> {
    const { entity_type, entity_id, locale } = input
    const title = input.title.trim()
    const [existing] = asRows(
      await this.listChefsTranslations({ entity_type, entity_id, locale }, { take: 1 })
    )
    if (!title) {
      if (existing) await this.deleteChefsTranslations(existing.id)
      return null
    }
    const description = input.description?.trim() || null
    if (existing) {
      return (await this.updateChefsTranslations({
        id: existing.id,
        title,
        description,
      } as unknown as Record<string, unknown>)) as unknown as TranslationRow
    }
    try {
      return (await this.createChefsTranslations({
        entity_type,
        entity_id,
        locale,
        title,
        description,
      } as unknown as Record<string, unknown>)) as unknown as TranslationRow
    } catch (e) {
      // concurrent insert won the unique index: update that row instead
      const [row] = asRows(await this.listChefsTranslations({ entity_type, entity_id, locale }, { take: 1 }))
      if (!row) throw e
      return (await this.updateChefsTranslations({
        id: row.id,
        title,
        description,
      } as unknown as Record<string, unknown>)) as unknown as TranslationRow
    }
  }

  async listForEntity(entity_type: EntityType, entity_id: string): Promise<TranslationRow[]> {
    return asRows(await this.listChefsTranslations({ entity_type, entity_id }, { take: null }))
  }

  /** All translations of one locale, grouped for the storefront. */
  async mapForLocale(locale: Locale): Promise<TranslationMap> {
    const out: TranslationMap = { product: {}, category: {}, collection: {} }
    const rows = asRows(await this.listChefsTranslations({ locale }, { take: null }))
    for (const r of rows) {
      out[r.entity_type][r.entity_id] = { title: r.title, description: r.description }
    }
    return out
  }
}

export default TranslationsModuleService
