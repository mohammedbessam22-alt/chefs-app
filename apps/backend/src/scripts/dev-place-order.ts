import { ExecArgs } from "@medusajs/framework/types"
import { devScriptRefusal } from "../lib/dev-script-guard"

/**
 * Dev helper: places N guest orders through the STORE API of the running dev server (HTTP).
 * Stock for a throwaway product is created via core workflows in this process (same dev DB).
 *
 *   CHEFS_DEV_SCRIPT=1 npx medusa exec ./src/scripts/dev-place-order.ts [count] [regular|express]
 *   BASE_URL (required), e.g. http://127.0.0.1:9200; DATABASE_URL must point at a *_dev / *_test database.
 */
export default async function devPlaceOrder({ container, args }: ExecArgs) {
  const count = Number(args?.[0] ?? 1)
  if (!Number.isInteger(count) || count < 1 || count > 50) throw new Error("count must be an integer between 1 and 50")
  const deliveryType = args?.[1] ?? "regular"
  if (deliveryType !== "regular" && deliveryType !== "express") throw new Error("delivery type must be regular or express")
  // No default port: the caller must say which dev server to drive (9000/9100 are production/staging).
  const base = process.env.BASE_URL
  if (!base) throw new Error("set BASE_URL to the dev server, e.g. http://127.0.0.1:9200")
  let dbName = ""
  try {
    dbName = new URL(process.env.DATABASE_URL ?? "").pathname.replace(/^\//, "")
  } catch {
    /* refused below */
  }
  const refusal = devScriptRefusal(process.env, dbName, base)
  if (refusal) throw new Error(`dev-place-order refused: ${refusal}`)

  const { createProductsWorkflow } = await import("@medusajs/medusa/core-flows")
  const [pk] = await container.resolve("api_key").listApiKeys({ title: "chefs-app" })
  if (!pk) throw new Error("publishable key 'chefs-app' not found - run the seed first")
  const [region] = await container.resolve("region").listRegions({ name: "Iraq" })
  const [warehouse] = await container.resolve("stock_location").listStockLocations({ name: "Warehouse A" })
  const [salesChannel] = await container.resolve("sales_channel").listSalesChannels({}, { take: 1 })
  const [profile] = await container.resolve("fulfillment").listShippingProfiles({ type: "default" })

  const title = `Dev product ${Date.now()}`
  const { result } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title,
          status: "published" as any,
          shipping_profile_id: profile.id,
          options: [{ title: "Size", values: ["One"] }],
          variants: [
            {
              title: "One",
              sku: `dev-${Date.now()}`,
              options: { Size: "One" },
              manage_inventory: true,
              prices: [{ currency_code: "iqd", amount: 5000 }],
            },
          ],
          sales_channels: [{ id: salesChannel.id }],
        },
      ],
    },
  })
  const variantId = result[0].variants![0].id
  const query: any = container.resolve("query")
  const {
    data: [variant],
  } = await query.graph({ entity: "variant", fields: ["id", "inventory_items.inventory_item_id"], filters: { id: variantId } })
  await container.resolve("inventory").createInventoryLevels([
    { inventory_item_id: variant.inventory_items[0].inventory_item_id, location_id: warehouse.id, stocked_quantity: 100 },
  ])

  const headers = { "content-type": "application/json", "x-publishable-api-key": pk.token }
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json)}`)
    return json
  }

  for (let n = 0; n < count; n++) {
    const { cart } = await call("POST", "/store/carts", { region_id: region.id })
    await call("POST", `/store/carts/${cart.id}/line-items`, { variant_id: variantId, quantity: 1 })
    await call("POST", `/store/carts/${cart.id}`, {
      email: "07700000000@guest.chefs-app.local",
      shipping_address: {
        first_name: "Dev Customer",
        phone: "07700000000",
        address_1: "Near Azadi Park",
        city: "Kirkuk",
        country_code: "iq",
        metadata: { lat: 35.4681, lng: 44.3922 },
      },
    })
    const { shipping_options } = await call("GET", `/store/shipping-options?cart_id=${cart.id}`)
    const option = shipping_options.find((o: any) => o.data?.delivery_type === deliveryType)
    if (!option) throw new Error(`no ${deliveryType} shipping option`)
    await call("POST", `/store/carts/${cart.id}/shipping-methods`, { option_id: option.id })
    const { payment_collection } = await call("POST", "/store/payment-collections", { cart_id: cart.id })
    await call("POST", `/store/payment-collections/${payment_collection.id}/payment-sessions`, { provider_id: "pp_system_default" })
    const done = await call("POST", `/store/carts/${cart.id}/complete`, {})
    if (done.type !== "order") throw new Error(`cart did not complete: ${JSON.stringify(done)}`)
    console.log(`placed order ${done.order.id} (#${done.order.display_id}, ${deliveryType})`)
  }
}
