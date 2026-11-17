import { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import {
  createCollectionsWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  updateInventoryLevelsWorkflow,
  updateProductsWorkflow,
  uploadFilesWorkflow,
} from "@medusajs/medusa/core-flows"
import { parse } from "csv-parse/sync"
import { createHash } from "crypto"
import fs from "fs"
import path from "path"
import { CatalogRow, parseCatalogRow } from "../lib/catalog-row"
import { TRANSLATIONS_MODULE } from "../modules/translations"

const WAREHOUSE_NAMES = { A: "Warehouse A", B: "Warehouse B" } as const
const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
}

const shortHash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 10)

type Ctx = {
  container: MedusaContainer
  query: any
  productService: any
  translations: any
  logger: any
  salesChannelId: string
  shippingProfileId: string
  locationIds: Record<"A" | "B", string>
  categoryCache: Map<string, string>
  collectionCache: Map<string, string>
  imagesDir: string
}

async function ensureCategory(ctx: Ctx, name: string): Promise<string> {
  const cached = ctx.categoryCache.get(name)
  if (cached) return cached
  let [cat] = await ctx.productService.listProductCategories({ name })
  if (!cat) {
    const { result } = await createProductCategoriesWorkflow(ctx.container).run({
      input: {
        product_categories: [
          { name, handle: `cat-${shortHash(name)}`, is_active: true, is_internal: false },
        ],
      },
    })
    cat = result[0]
  }
  ctx.categoryCache.set(name, cat.id)
  return cat.id
}

async function ensureCollection(ctx: Ctx, title: string): Promise<string> {
  const cached = ctx.collectionCache.get(title)
  if (cached) return cached
  let [col] = await ctx.productService.listProductCollections({ title })
  if (!col) {
    const { result } = await createCollectionsWorkflow(ctx.container).run({
      input: { collections: [{ title, handle: `brand-${shortHash(title)}` }] },
    })
    col = result[0]
  }
  ctx.collectionCache.set(title, col.id)
  return col.id
}

async function uploadImage(ctx: Ctx, row: CatalogRow, rowNo: number): Promise<{ url: string }[]> {
  if (!row.image) return []
  const file = path.join(ctx.imagesDir, path.basename(row.image))
  if (!fs.existsSync(file)) {
    ctx.logger.warn(`row ${rowNo}: image "${row.image}" not found in ${ctx.imagesDir}, skipping image`)
    return []
  }
  const mimeType = MIME[path.extname(file).toLowerCase()]
  if (!mimeType) {
    ctx.logger.warn(`row ${rowNo}: image "${row.image}" has unsupported type, skipping image`)
    return []
  }
  const { result } = await uploadFilesWorkflow(ctx.container).run({
    input: {
      files: [
        {
          filename: path.basename(file),
          mimeType,
          content: fs.readFileSync(file).toString("binary"),
          access: "public",
        },
      ],
    },
  })
  return [{ url: result[0].url }]
}

async function syncStock(ctx: Ctx, inventoryItemId: string, row: CatalogRow) {
  const targetLoc = ctx.locationIds[row.warehouse]
  const { data } = await ctx.query.graph({
    entity: "inventory_level",
    fields: ["id", "location_id", "reserved_quantity"],
    filters: { inventory_item_id: inventoryItemId },
  })
  const target = data.find((l: any) => l.location_id === targetLoc)
  if (target) {
    await updateInventoryLevelsWorkflow(ctx.container).run({
      input: {
        updates: [
          {
            id: target.id,
            inventory_item_id: inventoryItemId,
            location_id: targetLoc,
            stocked_quantity: row.stock,
          },
        ],
      },
    })
  } else {
    await createInventoryLevelsWorkflow(ctx.container).run({
      input: {
        inventory_levels: [
          { inventory_item_id: inventoryItemId, location_id: targetLoc, stocked_quantity: row.stock },
        ],
      },
    })
  }
  // each product lives at exactly one location: drop levels elsewhere
  const stale = data.filter((l: any) => l.location_id !== targetLoc)
  if (stale.length) {
    const inventory: any = ctx.container.resolve(Modules.INVENTORY)
    const removable = stale.filter((l: any) => !Number(l.reserved_quantity))
    if (removable.length) await inventory.deleteInventoryLevels(removable.map((l: any) => l.id))
    if (removable.length < stale.length) {
      ctx.logger.warn(`${row.handle}: stock at another warehouse has reservations, left in place`)
    }
  }
}

async function syncTranslations(ctx: Ctx, productId: string, row: CatalogRow) {
  const cells: [("ckb" | "tk" | "en"), string][] = [
    ["ckb", row.title_ckb],
    ["tk", row.title_tk],
    ["en", row.title_en],
  ]
  for (const [locale, title] of cells) {
    if (!title) continue // never call upsert with blank: it deletes the translation
    const [existing] = await ctx.translations.listChefsTranslations(
      { entity_type: "product", entity_id: productId, locale },
      { take: 1 }
    )
    await ctx.translations.upsertTranslation({
      entity_type: "product",
      entity_id: productId,
      locale,
      title,
      description: existing?.description ?? null, // keep a description staff entered in admin
    })
  }
}

async function importRow(ctx: Ctx, row: CatalogRow, rowNo: number): Promise<"created" | "updated"> {
  const category_ids = row.category_ar ? [await ensureCategory(ctx, row.category_ar)] : []
  const collection_id = row.brand ? await ensureCollection(ctx, row.brand) : null
  const description = row.description_ar || null

  const { data } = await ctx.query.graph({
    entity: "product",
    fields: ["id", "images.id", "variants.id", "variants.inventory_items.inventory_item_id"],
    filters: { handle: row.handle },
  })
  const existing = data[0]
  let productId: string
  let inventoryItemId: string | undefined
  let outcome: "created" | "updated"

  if (existing) {
    outcome = "updated"
    productId = existing.id
    const variant = existing.variants?.[0]
    if (!variant) throw new Error(`row ${rowNo}: handle (existing product has no variant)`)
    inventoryItemId = variant.inventory_items?.[0]?.inventory_item_id
    const images = (existing.images ?? []).length ? [] : await uploadImage(ctx, row, rowNo)
    await updateProductsWorkflow(ctx.container).run({
      input: {
        products: [
          {
            id: productId,
            title: row.title_ar,
            description,
            collection_id,
            category_ids,
            ...(images.length ? { images } : {}),
            variants: [
              {
                id: variant.id,
                prices: [{ currency_code: "iqd", amount: row.price_iqd }],
              },
            ],
          },
        ],
      },
    })
  } else {
    outcome = "created"
    const images = await uploadImage(ctx, row, rowNo)
    const { result } = await createProductsWorkflow(ctx.container).run({
      input: {
        products: [
          {
            title: row.title_ar,
            handle: row.handle,
            description: description ?? undefined,
            status: ProductStatus.PUBLISHED,
            shipping_profile_id: ctx.shippingProfileId,
            sales_channels: [{ id: ctx.salesChannelId }],
            category_ids,
            ...(collection_id ? { collection_id } : {}),
            ...(images.length ? { images } : {}),
            options: [{ title: "Default", values: ["Default"] }],
            variants: [
              {
                title: "Default",
                sku: row.handle,
                manage_inventory: true,
                options: { Default: "Default" },
                prices: [{ currency_code: "iqd", amount: row.price_iqd }],
              },
            ],
          },
        ],
      },
    })
    productId = result[0].id
    const { data: fresh } = await ctx.query.graph({
      entity: "product",
      fields: ["variants.inventory_items.inventory_item_id"],
      filters: { id: productId },
    })
    inventoryItemId = fresh[0]?.variants?.[0]?.inventory_items?.[0]?.inventory_item_id
  }

  if (!inventoryItemId) throw new Error(`row ${rowNo}: stock (no inventory item for variant)`)
  await syncStock(ctx, inventoryItemId, row)
  await syncTranslations(ctx, productId, row)
  return outcome
}

// `medusa exec <file> -- a b` leaves `args` empty (yargs stops at `--`), so fall back to argv.
function resolveArgs(args?: string[]): string[] {
  if (args?.length) return args
  const argv = process.argv
  const idx = argv.findIndex((a) => a.endsWith("import-catalog.ts"))
  return idx === -1 ? [] : argv.slice(idx + 1).filter((a) => a !== "--")
}

export default async function importCatalog({ container, args }: ExecArgs) {
  const logger: any = container.resolve(ContainerRegistrationKeys.LOGGER)
  const [csvPath, imagesDir = "."] = resolveArgs(args)
  if (!csvPath) {
    logger.error("Usage: medusa exec ./src/scripts/import-catalog.ts -- <csv> <images-dir>")
    process.exitCode = 1
    return
  }

  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const scService: any = container.resolve(Modules.SALES_CHANNEL)
  const slService: any = container.resolve(Modules.STOCK_LOCATION)
  const fulfillment: any = container.resolve(Modules.FULFILLMENT)

  let [salesChannel] = await scService.listSalesChannels({ name: "Default Sales Channel" })
  if (!salesChannel) [salesChannel] = await scService.listSalesChannels({}, { take: 1 })
  const [profile] = await fulfillment.listShippingProfiles({ type: "default" })
  const [locA] = await slService.listStockLocations({ name: WAREHOUSE_NAMES.A })
  const [locB] = await slService.listStockLocations({ name: WAREHOUSE_NAMES.B })
  if (!salesChannel || !profile || !locA || !locB) {
    logger.error("Missing sales channel / shipping profile / warehouses: run the seed first")
    process.exitCode = 1
    return
  }

  const records: Record<string, string>[] = parse(fs.readFileSync(csvPath, "utf8"), {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  })

  const ctx: Ctx = {
    container,
    query,
    productService: container.resolve(Modules.PRODUCT),
    translations: container.resolve(TRANSLATIONS_MODULE),
    logger,
    salesChannelId: salesChannel.id,
    shippingProfileId: profile.id,
    locationIds: { A: locA.id, B: locB.id },
    categoryCache: new Map(),
    collectionCache: new Map(),
    imagesDir,
  }

  let created = 0
  let updated = 0
  const failures: string[] = []
  const seen = new Set<string>()

  for (let i = 0; i < records.length; i++) {
    const rowNo = i + 2 // header is line 1
    try {
      const row = parseCatalogRow(records[i], rowNo)
      if (seen.has(row.handle)) throw new Error(`row ${rowNo}: handle (duplicate in file)`)
      seen.add(row.handle)
      const outcome = await importRow(ctx, row, rowNo)
      if (outcome === "created") created++
      else updated++
    } catch (e: any) {
      const msg = String(e?.message ?? e)
      const m = /^row \d+: \S+/.exec(msg)
      failures.push(msg)
      logger.error(m ? msg : `row ${rowNo}: ${msg}`)
    }
  }

  console.log(`Import summary: created ${created}, updated ${updated}, failed ${failures.length}`)
  if (failures.length) process.exitCode = 1
}
