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
    const act = (id: string, action: string) =>
      api.post(`/admin/chefs/orders/${id}/${action}`, {}, adminHeaders(token)).catch((e: any) => e.response)

    /** Level of the variant's inventory item at one location. */
    const level = async (variantId: string, locationId: string) => {
      const query: any = container().resolve("query")
      const {
        data: [v],
      } = await query.graph({ entity: "variant", fields: ["inventory_items.inventory_item_id"], filters: { id: variantId } })
      const [l] = await container()
        .resolve("inventory")
        .listInventoryLevels({ inventory_item_id: v.inventory_items[0].inventory_item_id, location_id: locationId })
      const stocked = Number(l.stocked_quantity)
      const reserved = Number(l.reserved_quantity)
      return { stocked, reserved, available: stocked - reserved }
    }

    it("deliver consumes the reservation: stocked down, reserved 0, available unchanged", async () => {
      const a = await getLocationId(container(), "Warehouse A")
      const v = await createStockedVariant(container(), { stock: 10, locationId: a })
      const order = await place([{ variant_id: v, quantity: 3 }])
      expect(await level(v, a)).toEqual({ stocked: 10, reserved: 3, available: 7 })
      expect((await act(order.id, "confirm")).status).toBe(200)

      const res = await act(order.id, "deliver")
      expect(res.status).toBe(200)
      expect(res.data.order.confirmation).toBe("delivered")
      expect(await level(v, a)).toEqual({ stocked: 7, reserved: 0, available: 7 })
      const reservations = await container().resolve("inventory").listReservationItems({ line_item_id: (await getAdminOrder(api, order.id)).items.map((i: any) => i.id) })
      expect(reservations).toHaveLength(0)
      expect((await getAdminOrder(api, order.id)).fulfillment_status).toBe("delivered")

      // delivered orders leave the packing list
      const { data } = await api.get("/admin/chefs/packing", adminHeaders(token))
      const all = data.locations.flatMap((l: any) => l.orders.map((o: any) => o.display_id))
      expect(all).not.toContain(order.display_id)

      // deliver twice -> 409; cancel after delivery -> 409; stock untouched
      expect((await act(order.id, "deliver")).status).toBe(409)
      const cancel = await act(order.id, "cancel")
      expect(cancel.status).toBe(409)
      expect(await level(v, a)).toEqual({ stocked: 7, reserved: 0, available: 7 })
    })

    it("delivers a mixed basket from Warehouse A and Warehouse B", async () => {
      const a = await getLocationId(container(), "Warehouse A")
      const b = await getLocationId(container(), "Warehouse B")
      const va = await createStockedVariant(container(), { stock: 10, locationId: a })
      const vb = await createStockedVariant(container(), { stock: 5, locationId: b })
      const order = await place([
        { variant_id: va, quantity: 2 },
        { variant_id: vb, quantity: 1 },
      ])
      expect((await act(order.id, "confirm")).status).toBe(200)
      const res = await act(order.id, "deliver")
      expect(res.status).toBe(200)
      expect(await level(va, a)).toEqual({ stocked: 8, reserved: 0, available: 8 })
      expect(await level(vb, b)).toEqual({ stocked: 4, reserved: 0, available: 4 })
      const full = await getAdminOrder(api, order.id)
      expect(full.fulfillment_status).toBe("delivered")
    })

    it("deliver on a cancelled order is 409 and stock is restored, not consumed", async () => {
      const a = await getLocationId(container(), "Warehouse A")
      const v = await createStockedVariant(container(), { stock: 10, locationId: a })
      const order = await place([{ variant_id: v, quantity: 2 }])
      expect((await act(order.id, "confirm")).status).toBe(200)
      expect((await act(order.id, "cancel")).status).toBe(200)
      expect((await act(order.id, "deliver")).status).toBe(409)
      expect(await level(v, a)).toEqual({ stocked: 10, reserved: 0, available: 10 })
    })

    it("cancel blocked by an existing fulfillment is a 409 with a message, not a 500", async () => {
      const a = await getLocationId(container(), "Warehouse A")
      const v = await createStockedVariant(container(), { stock: 10, locationId: a })
      const order = await place([{ variant_id: v, quantity: 1 }])
      expect((await act(order.id, "confirm")).status).toBe(200)
      const full = await getAdminOrder(api, order.id)
      const { createOrderFulfillmentWorkflow } = await import("@medusajs/medusa/core-flows")
      await createOrderFulfillmentWorkflow(container()).run({
        input: { order_id: order.id, items: full.items.map((i: any) => ({ id: i.id, quantity: i.quantity })) },
      })
      const res = await act(order.id, "cancel")
      expect(res.status).toBe(409)
      expect(typeof res.data.message).toBe("string")
      expect(res.data.message).not.toBe("invalid_transition")
      expect((await getAdminOrder(api, order.id)).metadata.confirmation).toBe("confirmed")
    })
  },
})
