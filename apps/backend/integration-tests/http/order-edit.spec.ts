import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { seedChefs } from "../../src/scripts/seed"
import {
  adminHeaders,
  createStockedVariant,
  getAdminOrder,
  getAdminToken,
  getLocationId,
  getPublishableKey,
  placeOrder,
  setAdminToken,
  storeHeaders,
  waitFor,
} from "../helpers"

jest.setTimeout(180000)

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let key: string
    let token: string
    const container = () => getContainer()

    beforeAll(async () => {
      await seedChefs(container())
      key = await getPublishableKey(container())
      token = await getAdminToken(container(), api)
      setAdminToken(token)
    })

    it("removing an item with Medusa's order edit lowers the store and admin totals", async () => {
      const a = await getLocationId(container(), "Warehouse A")
      const v1 = await createStockedVariant(container(), { stock: 10, locationId: a })
      const v2 = await createStockedVariant(container(), { stock: 10, locationId: a })
      const order = await placeOrder(api, container(), {
        key,
        items: [
          { variant_id: v1, quantity: 1 },
          { variant_id: v2, quantity: 2 },
        ],
      })
      await waitFor(async () => (await getAdminOrder(api, order.id)).metadata?.confirmation === "awaiting")
      const storeTotal = async () => (await api.get(`/store/chefs/orders/${order.id}`, storeHeaders(key))).data.total
      const adminTotal = async () =>
        (await api.get(`/admin/chefs/orders?limit=500`, adminHeaders(token))).data.orders.find((o: any) => o.id === order.id).total
      const before = await storeTotal()
      expect(before).toBe(5000 * 3 + 2000)
      expect(await adminTotal()).toBe(before)

      const full = await getAdminOrder(api, order.id)
      const item = full.items.find((i: any) => i.variant_id === v2)
      const h = adminHeaders(token)
      const { data: edit } = await api.post("/admin/order-edits", { order_id: order.id }, h)
      await api.post(`/admin/order-edits/${order.id}/items/item/${item.id}`, { quantity: 0 }, h)
      await api.post(`/admin/order-edits/${order.id}/request`, {}, h)
      await api.post(`/admin/order-edits/${order.id}/confirm`, {}, h)
      expect(edit).toBeDefined()

      const after = await storeTotal()
      expect(after).toBe(5000 + 2000)
      expect(after).toBeLessThan(before)
      expect(await adminTotal()).toBe(after)
      expect((await api.get(`/store/chefs/orders/${order.id}`, storeHeaders(key))).data.confirmation).toBe("awaiting")

      // The edited order still confirms and delivers; only the remaining item's stock is consumed.
      expect((await api.post(`/admin/chefs/orders/${order.id}/confirm`, {}, h)).status).toBe(200)
      expect((await api.post(`/admin/chefs/orders/${order.id}/deliver`, {}, h)).status).toBe(200)
      const level = async (variantId: string) => {
        const query: any = container().resolve("query")
        const {
          data: [v],
        } = await query.graph({
          entity: "variant",
          fields: ["inventory_items.inventory_item_id"],
          filters: { id: variantId },
        })
        const [l] = await container()
          .resolve("inventory")
          .listInventoryLevels({ inventory_item_id: v.inventory_items[0].inventory_item_id, location_id: a })
        return { stocked: Number(l.stocked_quantity), reserved: Number(l.reserved_quantity) }
      }
      expect(await level(v1)).toEqual({ stocked: 9, reserved: 0 })
      expect(await level(v2)).toEqual({ stocked: 10, reserved: 0 })
    })
  },
})
