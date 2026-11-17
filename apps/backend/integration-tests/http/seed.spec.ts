import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { seedChefs } from "../../src/scripts/seed"
import { createCart, storeHeaders } from "../helpers"

jest.setTimeout(120000)

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let key: string
    beforeAll(async () => {
      const container = getContainer()
      await seedChefs(container)
      await seedChefs(container) // idempotent
      const apiKeys: any = container.resolve(Modules.API_KEY)
      const [pk] = await apiKeys.listApiKeys({ title: "chefs-app" })
      key = pk.token
    })

    it("exposes the Iraq region in IQD", async () => {
      const { data } = await api.get("/store/regions", storeHeaders(key))
      expect(data.regions).toEqual([
        expect.objectContaining({ name: "Iraq", currency_code: "iqd" }),
      ])
    })

    it("offers Regular 2000 and Express 5000 for a Kirkuk cart", async () => {
      const region = (await api.get("/store/regions", storeHeaders(key))).data.regions[0]
      const cart = await createCart(api, key, region.id)
      const { data } = await api.get(
        `/store/shipping-options?cart_id=${cart.id}`,
        storeHeaders(key)
      )
      const byName = Object.fromEntries(
        data.shipping_options.map((o: any) => [o.name, o.amount])
      )
      expect(byName).toEqual({ Regular: 2000, Express: 5000 })
      const types = Object.fromEntries(
        data.shipping_options.map((o: any) => [o.name, o.data?.delivery_type])
      )
      expect(types).toEqual({ Regular: "regular", Express: "express" })
    })

    it("creates two warehouses and no duplicates after re-seeding", async () => {
      const sl: any = getContainer().resolve(Modules.STOCK_LOCATION)
      const locs = await sl.listStockLocations({})
      expect(locs.map((l: any) => l.name).sort()).toEqual(["Warehouse A", "Warehouse B"])
    })
  },
})
