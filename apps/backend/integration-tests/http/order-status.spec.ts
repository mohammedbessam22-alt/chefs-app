import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { seedChefs } from "../../src/scripts/seed"
import {
  storeHeaders,
  getAdminOrder,
  getAdminToken,
  getPublishableKey,
  placeOrder,
  setAdminToken,
  waitFor,
} from "../helpers"

jest.setTimeout(180000)

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let key: string
    const container = () => getContainer()

    beforeAll(async () => {
      await seedChefs(container())
      key = await getPublishableKey(container())
      setAdminToken(await getAdminToken(container(), api))
    })

    it("returns the public status of a placed order and nothing personal", async () => {
      const order = await placeOrder(api, container(), { key, deliveryType: "regular" })
      await waitFor(async () => (await getAdminOrder(api, order.id)).metadata?.confirmation === "awaiting")
      const res = await api.get(`/store/chefs/orders/${order.id}`, storeHeaders(key))
      expect(res.status).toBe(200)
      expect(Object.keys(res.data).sort()).toEqual(
        ["confirmation", "created_at", "delivery_type", "display_id", "id", "round_label", "total"].sort()
      )
      expect(res.data).toMatchObject({ id: order.id, display_id: order.display_id, confirmation: "awaiting", delivery_type: "regular" })
    })

    it("404s for an unknown id", async () => {
      const res = await api.get(`/store/chefs/orders/order_nope`, storeHeaders(key)).catch((e: any) => e.response)
      expect(res.status).toBe(404)
    })

    it("rejects requests without the publishable key", async () => {
      const res = await api.get(`/store/chefs/orders/order_nope`).catch((e: any) => e.response)
      expect(res.status).toBe(400)
    })
  },
})
