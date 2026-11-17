export const storeHeaders = (key: string) => ({
  headers: { "x-publishable-api-key": key },
})

export const adminHeaders = (token: string) => ({
  headers: { authorization: `Bearer ${token}` },
})

export async function createCart(api: any, key: string, regionId: string) {
  const { data } = await api.post(
    "/store/carts",
    {
      region_id: regionId,
      shipping_address: {
        first_name: "Test",
        last_name: "Customer",
        address_1: "Street 1",
        city: "Kirkuk",
        country_code: "iq",
        phone: "07700000000",
      },
    },
    storeHeaders(key)
  )
  return data.cart
}

export async function getAdminToken(container: any, api: any): Promise<string> {
  const email = "admin@test.local"
  const password = "supersecret"
  const userModule = container.resolve("user")
  const authModule = container.resolve("auth")
  const user = await userModule.createUsers({ email })
  const { authIdentity } = await authModule.register("emailpass", {
    body: { email, password },
  } as any)
  await authModule.updateAuthIdentities({
    id: authIdentity!.id,
    app_metadata: { user_id: user.id },
  })
  const { data } = await api.post("/auth/user/emailpass", { email, password })
  return data.token
}

export async function waitFor(
  fn: () => Promise<boolean>,
  timeoutMs = 15000,
  intervalMs = 200
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error("waitFor timed out")
}

export async function getAdminOrder(api: any, id: string, token?: string) {
  const { data } = await api.get(`/admin/orders/${id}`, adminHeaders(token ?? currentToken))
  return data.order
}

export async function countOrders(api: any, token?: string): Promise<number> {
  const { data } = await api.get(`/admin/orders?limit=1`, adminHeaders(token ?? currentToken))
  return data.count
}

let currentToken = ""
export function setAdminToken(token: string) {
  currentToken = token
}

type Container = any

export async function getPublishableKey(container: Container): Promise<string> {
  const [pk] = await container.resolve("api_key").listApiKeys({ title: "chefs-app" })
  return pk.token
}

/**
 * Creates a product with one variant (price 5000 IQD) in the default sales channel,
 * with `stock` units at the given stock location. Returns the variant id.
 */
export async function createStockedVariant(
  container: Container,
  opts: { stock: number; locationId: string; title?: string }
): Promise<string> {
  const { createProductsWorkflow } = await import("@medusajs/medusa/core-flows")
  const query = container.resolve("query")
  const [salesChannel] = (await container.resolve("sales_channel").listSalesChannels({}, { take: 1 }))
  const [profile] = await container.resolve("fulfillment").listShippingProfiles({ type: "default" })
  const title = opts.title ?? `Product ${Math.random().toString(36).slice(2, 8)}`
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
              sku: `sku-${title.replace(/\s/g, "-")}`,
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
  const variantId = result[0].variants[0].id
  const {
    data: [variant],
  } = await query.graph({
    entity: "variant",
    fields: ["id", "inventory_items.inventory_item_id"],
    filters: { id: variantId },
  })
  await container.resolve("inventory").createInventoryLevels([
    {
      inventory_item_id: variant.inventory_items[0].inventory_item_id,
      location_id: opts.locationId,
      stocked_quantity: opts.stock,
    },
  ])
  return variantId
}

export async function getLocationId(container: Container, name: string): Promise<string> {
  const [loc] = await container.resolve("stock_location").listStockLocations({ name })
  return loc.id
}

/**
 * Checkout contract (see checkout.spec.ts): builds a cart with items, guest email,
 * shipping address, the chosen shipping method and a pp_system_default payment session.
 * Items default to one unit of a variant with 100 units at Warehouse A.
 */
export async function cartWith(
  api: any,
  container: Container,
  opts: {
    key: string
    deliveryType?: "regular" | "express"
    items?: { variant_id: string; quantity: number }[]
    variantStock?: number
    quantity?: number
    location?: string
  }
) {
  const headers = storeHeaders(opts.key)
  const [region] = await container.resolve("region").listRegions({ name: "Iraq" })
  let items = opts.items
  if (!items) {
    const locationId = await getLocationId(container, opts.location ?? "Warehouse A")
    const variantId = await createStockedVariant(container, {
      stock: opts.variantStock ?? 100,
      locationId,
    })
    items = [{ variant_id: variantId, quantity: opts.quantity ?? 1 }]
  }
  const cart = await createCart(api, opts.key, region.id)
  for (const item of items) {
    await api.post(`/store/carts/${cart.id}/line-items`, item, headers)
  }
  await api.post(
    `/store/carts/${cart.id}`,
    {
      email: "07700000000@guest.chefs-app.local",
      shipping_address: {
        first_name: "Test",
        phone: "07700000000",
        address_1: "Near Azadi Park",
        city: "Kirkuk",
        country_code: "iq",
        metadata: { lat: 35.4681, lng: 44.3922 },
      },
    },
    headers
  )
  const { data: opts_ } = await api.get(`/store/shipping-options?cart_id=${cart.id}`, headers)
  const wanted = opts.deliveryType ?? "regular"
  const option = opts_.shipping_options.find((o: any) => o.data?.delivery_type === wanted)
  if (!option) throw new Error(`no ${wanted} shipping option for cart`)
  await api.post(`/store/carts/${cart.id}/shipping-methods`, { option_id: option.id }, headers)
  const { data: pc } = await api.post(`/store/payment-collections`, { cart_id: cart.id }, headers)
  await api.post(
    `/store/payment-collections/${pc.payment_collection.id}/payment-sessions`,
    { provider_id: "pp_system_default" },
    headers
  )
  return cart
}

export async function completeCart(api: any, key: string, cartId: string) {
  const { data } = await api.post(`/store/carts/${cartId}/complete`, {}, storeHeaders(key))
  if (data.type !== "order") {
    throw Object.assign(new Error("cart did not complete"), { response: { status: 400, data } })
  }
  return data.order
}

export async function placeOrder(
  api: any,
  container: Container,
  opts: Omit<Parameters<typeof cartWith>[2], "key"> & { key: string }
) {
  const cart = await cartWith(api, container, opts)
  return completeCart(api, opts.key, cart.id)
}
