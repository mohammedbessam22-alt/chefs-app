import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { seedChefs } from "../../src/scripts/seed"
import {
  adminHeaders,
  createStockedVariant,
  getAdminToken,
  getLocationId,
  getPublishableKey,
  placeOrder,
  setAdminToken,
  getAdminOrder,
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

    const place = async (opts: any = {}) => {
      const order = await placeOrder(api, container(), { key, ...opts })
      await waitFor(async () => (await getAdminOrder(api, order.id)).metadata?.confirmation === "awaiting")
      return order
    }
    const act = (id: string, action: string) =>
      api.post(`/admin/chefs/orders/${id}/${action}`, {}, adminHeaders(token))

    const available = async (variantId: string) => {
      const query: any = container().resolve("query")
      const {
        data: [v],
      } = await query.graph({
        entity: "variant",
        fields: ["inventory_items.inventory_item_id"],
        filters: { id: variantId },
      })
      const levels = await container()
        .resolve("inventory")
        .listInventoryLevels({ inventory_item_id: v.inventory_items[0].inventory_item_id })
      return levels.reduce((s: number, l: any) => s + Number(l.stocked_quantity) - Number(l.reserved_quantity), 0)
    }

    it("confirms an awaiting order", async () => {
      const order = await place()
      const res = await act(order.id, "confirm")
      expect(res.status).toBe(200)
      expect(res.data.order).toMatchObject({
        id: order.id,
        confirmation: "confirmed",
        phone: "07700000000",
        landmark: "Near Azadi Park",
        lat: 35.4681,
        lng: 44.3922,
      })
      expect(res.data.order.items).toHaveLength(1)
      expect((await getAdminOrder(api, order.id)).metadata.delivery_type).toBe("regular")
    })

    it("cancel restores stock; confirm afterwards is 409", async () => {
      const loc = await getLocationId(container(), "Warehouse A")
      const v = await createStockedVariant(container(), { stock: 10, locationId: loc })
      const order = await place({ items: [{ variant_id: v, quantity: 3 }] })
      expect(await available(v)).toBe(7)
      const res = await act(order.id, "cancel")
      expect(res.status).toBe(200)
      expect(res.data.order.confirmation).toBe("cancelled")
      expect(await available(v)).toBe(10)
      const again = await act(order.id, "confirm").catch((e: any) => e.response)
      expect(again.status).toBe(409)
      expect(again.data.message).toBe("invalid_transition")
    })

    it("lists filtered by delivery_type", async () => {
      const exp = await place({ deliveryType: "express" })
      const reg = await place({ deliveryType: "regular" })
      const { data } = await api.get("/admin/chefs/orders?delivery_type=express", adminHeaders(token))
      const ids = data.orders.map((o: any) => o.id)
      expect(ids).toContain(exp.id)
      expect(ids).not.toContain(reg.id)
      expect(data.orders.every((o: any) => o.delivery_type === "express")).toBe(true)
      const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10)
      const { data: d2 } = await api.get(`/admin/chefs/orders?date=${today}`, adminHeaders(token))
      expect(d2.orders.map((o: any) => o.id)).toContain(reg.id)
      const { data: d3 } = await api.get(`/admin/chefs/orders?date=2000-01-01`, adminHeaders(token))
      expect(d3.orders).toHaveLength(0)
    })

    it("treats a Medusa-canceled order with stale metadata as cancelled and repairs on cancel", async () => {
      const order = await place()
      const { cancelOrderWorkflow } = await import("@medusajs/medusa/core-flows")
      await cancelOrderWorkflow(container()).run({ input: { order_id: order.id } })
      expect((await getAdminOrder(api, order.id)).metadata.confirmation).toBe("awaiting")

      const conf = await act(order.id, "confirm").catch((e: any) => e.response)
      expect(conf.status).toBe(409)
      const dlv = await act(order.id, "deliver").catch((e: any) => e.response)
      expect(dlv.status).toBe(409)

      const { data } = await api.get("/admin/chefs/orders?confirmation=cancelled", adminHeaders(token))
      expect(data.orders.map((o: any) => o.id)).toContain(order.id)

      const fix = await act(order.id, "cancel")
      expect(fix.status).toBe(200)
      expect(fix.data.order.confirmation).toBe("cancelled")
      expect((await getAdminOrder(api, order.id)).metadata.confirmation).toBe("cancelled")
      // now genuinely cancelled: a second cancel is a 409
      const again = await act(order.id, "cancel").catch((e: any) => e.response)
      expect(again.status).toBe(409)
    })

    it("paginates with limit/offset/count and never truncates silently", async () => {
      for (let i = 0; i < 3; i++) await place({ deliveryType: "express" })
      const url = (qs: string) => api.get(`/admin/chefs/orders?delivery_type=express&${qs}`, adminHeaders(token))
      const all = (await url("limit=500")).data
      expect(all.count).toBeGreaterThanOrEqual(3)
      expect(all.orders).toHaveLength(all.count)
      const p1 = (await url("limit=2&offset=0")).data
      expect(p1).toMatchObject({ limit: 2, offset: 0, count: all.count })
      expect(p1.orders).toHaveLength(2)
      expect(p1.count).toBeGreaterThan(p1.orders.length)
      const p2 = (await url("limit=2&offset=2")).data
      expect(p2.orders[0].id).toBe(all.orders[2].id)
      expect(p1.orders.map((o: any) => o.id)).toEqual(all.orders.slice(0, 2).map((o: any) => o.id))
      const bad = await url("limit=abc").catch((e: any) => e.response)
      expect(bad.status).toBe(400)
    })
  },
})
