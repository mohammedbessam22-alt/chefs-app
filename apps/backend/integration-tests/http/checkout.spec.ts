/**
 * Checkout contract the storefront app follows:
 *  1. create a cart in region Iraq
 *  2. add line items
 *  3. POST /store/carts/:id with
 *       email: "<phone>@guest.chefs-app.local"
 *       shipping_address: { first_name, phone, address_1: <landmark>, city: "Kirkuk",
 *                           country_code: "iq", metadata: { lat, lng } }
 *  4. add the shipping method (option whose data.delivery_type is "regular" | "express")
 *  5. create a payment collection + payment session with provider pp_system_default
 *  6. POST /store/carts/:id/complete
 * On order.placed the backend stamps order.metadata with
 *   { confirmation: "awaiting", delivery_type, round_label?, round_departs_at? }
 * (round fields only for regular delivery).
 */
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { seedChefs } from "../../src/scripts/seed"
import { DELIVERY_SETTINGS_MODULE } from "../../src/modules/delivery-settings"
import {
  cartWith,
  completeCart,
  countOrders,
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
    const container = () => getContainer()

    beforeAll(async () => {
      await seedChefs(container())
      key = await getPublishableKey(container())
      setAdminToken(await getAdminToken(container(), api))
      const settings: any = container().resolve(DELIVERY_SETTINGS_MODULE)
      await settings.updateSettings({ round_times: ["12:00", "20:00"] })
    })

    it("stamps a regular order as awaiting with a round", async () => {
      const order = await placeOrder(api, container(), { key, deliveryType: "regular" })
      await waitFor(async () => (await getAdminOrder(api, order.id)).metadata?.confirmation === "awaiting")
      const o = await getAdminOrder(api, order.id)
      expect(o.metadata).toMatchObject({
        confirmation: "awaiting",
        delivery_type: "regular",
        round_label: expect.stringMatching(/^\d\d:\d\d$/),
        round_departs_at: expect.any(String),
      })
    })

    it("stamps express without a round", async () => {
      const order = await placeOrder(api, container(), { key, deliveryType: "express" })
      await waitFor(async () => (await getAdminOrder(api, order.id)).metadata?.confirmation === "awaiting")
      const o = await getAdminOrder(api, order.id)
      expect(o.metadata.delivery_type).toBe("express")
      expect(o.metadata.round_label).toBeUndefined()
      expect(o.metadata.round_departs_at).toBeUndefined()
    })

    it("completes a mixed basket from both warehouses into one order with reservations at both", async () => {
      const locA = await getLocationId(container(), "Warehouse A")
      const locB = await getLocationId(container(), "Warehouse B")
      const vA = await createStockedVariant(container(), { stock: 10, locationId: locA })
      const vB = await createStockedVariant(container(), { stock: 10, locationId: locB })
      const before = await countOrders(api)
      const order = await placeOrder(api, container(), {
        key,
        items: [
          { variant_id: vA, quantity: 1 },
          { variant_id: vB, quantity: 2 },
        ],
      })
      expect(await countOrders(api)).toBe(before + 1)
      const query: any = container().resolve("query")
      const {
        data: [full],
      } = await query.graph({ entity: "order", fields: ["id", "items.id"], filters: { id: order.id } })
      expect(full.items).toHaveLength(2)
      const { data: reservations } = await query.graph({
        entity: "reservation_item",
        fields: ["id", "location_id", "quantity"],
        filters: { line_item_id: full.items.map((i: any) => i.id) },
      })
      expect(new Set(reservations.map((r: any) => r.location_id))).toEqual(new Set([locA, locB]))
    })

    it("refuses to complete a cart asking for more than stock", async () => {
      const before = await countOrders(api)
      const cart = await cartWith(api, container(), { key, variantStock: 2, quantity: 3 }).catch(
        (e: any) => ({ failed: e })
      )
      // Medusa may reject at add-to-cart or at completion; either way no order is created.
      if (!(cart as any).failed) {
        await expect(completeCart(api, key, (cart as any).id)).rejects.toMatchObject({
          response: { status: expect.any(Number) },
        })
      }
      expect(await countOrders(api)).toBe(before)
    })
  },
})
