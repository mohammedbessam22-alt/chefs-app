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

    const place = async (items: any[]) => {
      const order = await placeOrder(api, container(), { key, items })
      await waitFor(async () => (await getAdminOrder(api, order.id)).metadata?.confirmation === "awaiting")
      return order
    }

    it("lists confirmed orders per warehouse; awaiting orders are absent", async () => {
      const a = await getLocationId(container(), "Warehouse A")
      const b = await getLocationId(container(), "Warehouse B")
      const va = await createStockedVariant(container(), { stock: 10, locationId: a, title: "Rice" })
      const vb = await createStockedVariant(container(), { stock: 10, locationId: b, title: "Oil" })
      const mixed = await place([
        { variant_id: va, quantity: 2 },
        { variant_id: vb, quantity: 1 },
      ])
      const pending = await place([{ variant_id: va, quantity: 1 }])
      const res = await api.post(`/admin/chefs/orders/${mixed.id}/confirm`, {}, adminHeaders(token))
      expect(res.status).toBe(200)

      const { data } = await api.get("/admin/chefs/packing", adminHeaders(token))
      const loc = (id: string) => data.locations.find((l: any) => l.id === id)
      expect(loc(a).name).toBe("Warehouse A")
      expect(loc(a).orders).toEqual([{ display_id: mixed.display_id, items: [{ title: expect.any(String), quantity: 2 }] }])
      expect(loc(b).orders).toEqual([{ display_id: mixed.display_id, items: [{ title: expect.any(String), quantity: 1 }] }])
      const all = data.locations.flatMap((l: any) => l.orders.map((o: any) => o.display_id))
      expect(all).not.toContain(pending.display_id)
    })

    it("uses the reservation location when the variant has levels at both warehouses", async () => {
      const a = await getLocationId(container(), "Warehouse A")
      const b = await getLocationId(container(), "Warehouse B")
      const v = await createStockedVariant(container(), { stock: 10, locationId: a, title: "Dual" })
      const inv: any = container().resolve("inventory")
      const query: any = container().resolve("query")
      const {
        data: [vr],
      } = await query.graph({ entity: "variant", fields: ["inventory_items.inventory_item_id"], filters: { id: v } })
      await inv.createInventoryLevels([
        { inventory_item_id: vr.inventory_items[0].inventory_item_id, location_id: b, stocked_quantity: 0 },
      ])
      const order = await place([{ variant_id: v, quantity: 1 }])
      const reserved = (await inv.listReservationItems({}, { take: null })).filter((r: any) => r.line_item_id)
      const mine = reserved.filter((r: any) => r.inventory_item_id === vr.inventory_items[0].inventory_item_id)
      expect(mine).toHaveLength(1)
      const reservedLoc = mine[0].location_id
      expect(reservedLoc).toBe(a)
      await api.post(`/admin/chefs/orders/${order.id}/confirm`, {}, adminHeaders(token))
      const { data } = await api.get("/admin/chefs/packing", adminHeaders(token))
      const holders = data.locations.filter((l: any) => l.orders.some((o: any) => o.display_id === order.display_id))
      expect(holders.map((l: any) => l.id)).toEqual([a])
    })

    it("rejects a malformed date", async () => {
      const r = await api.get("/admin/chefs/packing?date=nope", adminHeaders(token)).catch((e: any) => e.response)
      expect(r.status).toBe(400)
    })
  },
})
