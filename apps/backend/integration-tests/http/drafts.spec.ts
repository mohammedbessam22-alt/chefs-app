import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { seedChefs } from "../../src/scripts/seed"
import { runAutoCancel } from "../../src/jobs/auto-cancel-orders"
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

const baghdadDay = (ms: number) => new Date(ms + 3 * 3600_000).toISOString().slice(0, 10)

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
      await api.post(
        "/admin/chefs/settings",
        { whatsapp_number: "07701234567", round_times: ["12:00", "16:00", "20:00"], cutoff_minutes: 30, auto_cancel_minutes: 120 },
        adminHeaders(token)
      )
    })

    const later = (mins: number) => new Date(Date.now() + mins * 60000)
    const ageOrder = async (id: string, days: number) => {
      const pg: any = container().resolve(ContainerRegistrationKeys.PG_CONNECTION)
      await pg.raw(`update "order" set created_at = now() - interval '${days} days' where id = ?`, [id])
    }
    const createDraft = async () => {
      const [region] = await container().resolve("region").listRegions({ name: "Iraq" })
      const loc = await getLocationId(container(), "Warehouse A")
      const v = await createStockedVariant(container(), { stock: 10, locationId: loc })
      const { data } = await api.post(
        "/admin/draft-orders",
        {
          region_id: region.id,
          email: "draft@guest.chefs-app.local",
          items: [{ variant_id: v, quantity: 1 }],
          shipping_address: { first_name: "Draft", phone: "07700000001", address_1: "Somewhere", city: "Kirkuk", country_code: "iq" },
        },
        adminHeaders(token)
      )
      return data.draft_order
    }
    const listIds = async (qs: string) =>
      (await api.get(`/admin/chefs/orders?limit=500&${qs}`, adminHeaders(token))).data.orders.map((o: any) => o.id)

    it("draft orders are not app orders: not listed, not auto-cancelled, 404 on the store route", async () => {
      const draft = await createDraft()
      await ageOrder(draft.id, 3)
      const createdDay = baghdadDay(Date.now() - 3 * 86_400_000)
      expect(await listIds(`date=${createdDay}`)).not.toContain(draft.id)
      expect(await listIds("")).not.toContain(draft.id)

      const cancelled = await runAutoCancel(container())
      expect(cancelled).not.toContain(draft.id)
      const after = await getAdminOrder(api, draft.id).catch(() => null)
      expect(after?.status ?? "draft").toBe("draft")

      const r = await api.get(`/store/chefs/orders/${draft.id}`, storeHeaders(key)).catch((e: any) => e.response)
      expect(r.status).toBe(404)
    })

    it("a converted old draft gets a fresh round and is not auto-cancelled at once", async () => {
      const draft = await createDraft()
      await ageOrder(draft.id, 3)
      const before = Date.now()
      const conv = await api.post(`/admin/draft-orders/${draft.id}/convert-to-order`, {}, adminHeaders(token)).catch((e: any) => e.response)
      expect(conv.status).toBe(200)
      await waitFor(async () => (await getAdminOrder(api, draft.id)).metadata?.confirmation === "awaiting")
      const order = await getAdminOrder(api, draft.id)
      expect(+new Date(order.metadata.placed_at)).toBeGreaterThanOrEqual(before - 1000)
      expect(+new Date(order.metadata.round_departs_at)).toBeGreaterThan(before)

      expect(await runAutoCancel(container())).not.toContain(draft.id)
      expect(await runAutoCancel(container(), later(60))).not.toContain(draft.id)
      expect(await runAutoCancel(container(), later(121))).toContain(draft.id)
    })

    it("the job ignores orders that are not open (completed)", async () => {
      const order = await placeOrder(api, container(), { key })
      await waitFor(async () => (await getAdminOrder(api, order.id)).metadata?.confirmation === "awaiting")
      const pg: any = container().resolve(ContainerRegistrationKeys.PG_CONNECTION)
      await pg.raw(`update "order" set status = 'completed' where id = ?`, [order.id])
      expect(await runAutoCancel(container(), later(121))).not.toContain(order.id)
      expect((await getAdminOrder(api, order.id)).metadata.confirmation).toBe("awaiting")
    })

    it("a regular order whose round departs tomorrow is listed and packed under tomorrow", async () => {
      const order = await placeOrder(api, container(), { key, deliveryType: "regular" })
      await waitFor(async () => (await getAdminOrder(api, order.id)).metadata?.confirmation === "awaiting")
      const today = baghdadDay(Date.now())
      const tomorrow = baghdadDay(Date.now() + 86_400_000)
      // Same as an order placed at 21:00 Baghdad joining tomorrow's 12:00 round.
      const departs = new Date(`${tomorrow}T12:00:00+03:00`).toISOString()
      const current = await getAdminOrder(api, order.id)
      await container()
        .resolve("order")
        .updateOrders(order.id, { metadata: { ...current.metadata, round_label: "12:00", round_departs_at: departs } })

      expect(await listIds(`date=${tomorrow}`)).toContain(order.id)
      expect(await listIds(`date=${today}`)).not.toContain(order.id)

      await api.post(`/admin/chefs/orders/${order.id}/confirm`, {}, adminHeaders(token))
      const packed = async (date: string) =>
        (await api.get(`/admin/chefs/packing?date=${date}`, adminHeaders(token))).data.locations.flatMap((l: any) =>
          l.orders.map((o: any) => o.display_id)
        )
      expect(await packed(tomorrow)).toContain(order.display_id)
      expect(await packed(today)).not.toContain(order.display_id)
    })
  },
})
