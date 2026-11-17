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
  if (price === null) fail("price_iqd")
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
