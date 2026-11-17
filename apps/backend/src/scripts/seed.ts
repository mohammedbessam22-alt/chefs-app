import { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows"


const WAREHOUSES = ["Warehouse A", "Warehouse B"]
const SHIPPING = [
  { name: "Regular", amount: 2000, type: "regular", label: "Regular", description: "Standard delivery" },
  { name: "Express", amount: 5000, type: "express", label: "Express", description: "Fast delivery" },
]

export async function seedChefs(container: MedusaContainer): Promise<void> {
  const link: any = container.resolve(ContainerRegistrationKeys.LINK)
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const scService: any = container.resolve(Modules.SALES_CHANNEL)
  const regionService: any = container.resolve(Modules.REGION)
  const slService: any = container.resolve(Modules.STOCK_LOCATION)
  const fulfillment: any = container.resolve(Modules.FULFILLMENT)
  const apiKeyService: any = container.resolve(Modules.API_KEY)
  const logger: any = container.resolve(ContainerRegistrationKeys.LOGGER)

  // Default sales channel
  let [salesChannel] = await scService.listSalesChannels({ name: "Default Sales Channel" })
  if (!salesChannel) {
    const [any] = await scService.listSalesChannels({}, { take: 1 })
    salesChannel = any
  }
  if (!salesChannel) {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: { salesChannelsData: [{ name: "Default Sales Channel" }] },
    })
    salesChannel = result[0]
  }

  // Region
  let [region] = await regionService.listRegions({ name: "Iraq" })
  if (!region) {
    const { result } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "Iraq",
            currency_code: "iqd",
            countries: ["iq"],
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    })
    region = result[0]
  }

  // Stock locations
  const locations: any[] = []
  for (const name of WAREHOUSES) {
    let [loc] = await slService.listStockLocations({ name })
    if (!loc) {
      const { result } = await createStockLocationsWorkflow(container).run({
        input: { locations: [{ name, address: { city: "Kirkuk", country_code: "iq", address_1: name } }] },
      })
      loc = result[0]
    }
    locations.push(loc)
  }
  for (const loc of locations) {
    const { data } = await query.graph({
      entity: "stock_location",
      fields: ["id", "sales_channels.id"],
      filters: { id: loc.id },
    })
    const linked = (data[0]?.sales_channels ?? []).some((s: any) => s.id === salesChannel.id)
    if (!linked) {
      await linkSalesChannelsToStockLocationWorkflow(container).run({
        input: { id: loc.id, add: [salesChannel.id] },
      })
    }
  }

  // Shipping profile
  let [profile] = await fulfillment.listShippingProfiles({ type: "default" })
  if (!profile) {
    const { result } = await createShippingProfilesWorkflow(container).run({
      input: { data: [{ name: "Default Shipping Profile", type: "default" }] },
    })
    profile = result[0]
  }

  // Fulfillment set + service zone (Warehouse A hosts the set)
  let [fset] = await fulfillment.listFulfillmentSets(
    { name: "Kirkuk delivery" },
    { relations: ["service_zones"] }
  )
  if (!fset) {
    fset = await fulfillment.createFulfillmentSets({
      name: "Kirkuk delivery",
      type: "delivery",
      service_zones: [
        { name: "Kirkuk", geo_zones: [{ country_code: "iq", type: "country" }] },
      ],
    })
    ;[fset] = await fulfillment.listFulfillmentSets(
      { id: fset.id },
      { relations: ["service_zones"] }
    )
  }
  // A fulfillment set can be linked to only one stock location
  {
    const { data } = await query.graph({
      entity: "stock_location",
      fields: ["id", "fulfillment_sets.id"],
      filters: { id: locations[0].id },
    })
    if (!(data[0]?.fulfillment_sets ?? []).some((f: any) => f.id === fset.id)) {
      await link.create({
        [Modules.STOCK_LOCATION]: { stock_location_id: locations[0].id },
        [Modules.FULFILLMENT]: { fulfillment_set_id: fset.id },
      })
    }
  }
  const zone = fset.service_zones[0]

  // Fulfillment provider link on locations
  for (const loc of locations) {
    try {
      await link.create({
        [Modules.STOCK_LOCATION]: { stock_location_id: loc.id },
        [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
      })
    } catch {
      // already linked
    }
  }

  // Shipping options
  for (const s of SHIPPING) {
    const existing = await fulfillment.listShippingOptions({ name: s.name })
    if (existing.length) continue
    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: s.name,
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: zone.id,
          shipping_profile_id: profile.id,
          type: { label: s.label, description: s.description, code: s.type },
          data: { delivery_type: s.type },
          prices: [
            { currency_code: "iqd", amount: s.amount },
            { region_id: region.id, amount: s.amount },
          ],
          rules: [
            { attribute: "enabled_in_store", value: "true", operator: "eq" },
            { attribute: "is_return", value: "false", operator: "eq" },
          ],
        },
      ],
    })
  }

  // Publishable key
  let [pk] = await apiKeyService.listApiKeys({ title: "chefs-app", type: "publishable" })
  if (!pk) {
    const { result } = await createApiKeysWorkflow(container).run({
      input: { api_keys: [{ title: "chefs-app", type: "publishable", created_by: "" }] },
    })
    pk = result[0]
  }
  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: { id: pk.id, add: [salesChannel.id] },
  })
  logger.info(`Publishable API key "chefs-app": ${pk.token}`)
  console.log(`PUBLISHABLE_KEY=${pk.token}`)
}

export default async function seed({ container }: ExecArgs) {
  await seedChefs(container)
}
