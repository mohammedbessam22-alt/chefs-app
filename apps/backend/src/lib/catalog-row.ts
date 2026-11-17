export type CatalogRow = {
  handle: string
  category_ar: string
  brand: string
  warehouse: "A" | "B"
  price_iqd: number
  stock: number
  image: string
  title_ar: string
  description_ar: string
  title_ckb: string
  title_tk: string
  title_en: string
}

export const CATALOG_COLUMNS = [
  "handle",
  "category_ar",
  "brand",
  "warehouse",
  "price_iqd",
  "stock",
  "image",
  "title_ar",
  "description_ar",
  "title_ckb",
  "title_tk",
  "title_en",
] as const

function parseWholeNumber(raw: string): number | null {
  const cleaned = raw.replace(/[,\s٬]/g, "")
  if (!/^\d+$/.test(cleaned)) return null
  const n = Number(cleaned)
  return Number.isSafeInteger(n) ? n : null
}

/** Validate one CSV row. `n` is the 1-based line number in the file (header = 1). */
export function parseCatalogRow(row: Record<string, string>, n: number): CatalogRow {
  const get = (k: string) => (row[k] ?? "").trim()
  const fail = (field: string): never => {
    throw new Error(`row ${n}: ${field}`)
  }

  const handle = get("handle")
  if (!handle || !/^[A-Za-z0-9_-]+$/.test(handle)) fail("handle")
  const title_ar = get("title_ar")
  if (!title_ar) fail("title_ar")

  const wh = get("warehouse").toUpperCase()
  if (wh !== "A" && wh !== "B") fail("warehouse")

  const price = parseWholeNumber(get("price_iqd"))
  if (price === null || price === 0) fail("price_iqd")
  const stock = parseWholeNumber(get("stock"))
  if (stock === null) fail("stock")

  return {
    handle,
    category_ar: get("category_ar"),
    brand: get("brand"),
    warehouse: wh as "A" | "B",
    price_iqd: price as number,
    stock: stock as number,
    image: get("image"),
    title_ar,
    description_ar: get("description_ar"),
    title_ckb: get("title_ckb"),
    title_tk: get("title_tk"),
    title_en: get("title_en"),
  }
}

/**
 * Product fields the import writes. Blank description_ar / category_ar / brand cells mean
 * "leave as is" on update (fields omitted) and "none" on create.
 */
export function catalogProductFields(
  row: CatalogRow,
  refs: { category_id?: string; collection_id?: string },
  mode: "create" | "update"
): { title: string; description?: string; category_ids?: string[]; collection_id?: string } {
  const out: { title: string; description?: string; category_ids?: string[]; collection_id?: string } = { title: row.title_ar }
  if (row.description_ar) out.description = row.description_ar
  if (row.category_ar && refs.category_id) out.category_ids = [refs.category_id]
  else if (mode === "create") out.category_ids = []
  if (row.brand && refs.collection_id) out.collection_id = refs.collection_id
  return out
}
