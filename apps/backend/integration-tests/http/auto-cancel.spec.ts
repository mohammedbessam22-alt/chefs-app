import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { seedChefs } from "../../src/scripts/seed"
import { runAutoCancel } from "../../src/jobs/auto-cancel-orders"
import {
  adminHeaders,
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
    let token: string
    const container = () => getContainer()

    beforeAll(async () => {
      await seedChefs(container())
      key = await getPublishableKey(container())
      token = await getAdminToken(container(), api)
      setAdminToken(token)
    })

    const place = async () => {
      const order = await placeOrder(api, container(), { key })
      await waitFor(async () => (await getAdminOrder(api, order.id)).metadata?.confirmation === "awaiting")
      return order
    }
    const later = (mins: number) => new Date(Date.now() + mins * 60000)

    it("cancels stale awaiting orders but not confirmed ones", async () => {
      const stale = await place()
      const confirmed = await place()
      await api.post(`/admin/chefs/orders/${confirmed.id}/confirm`, {}, adminHeaders(token))

      const cancelled = await runAutoCancel(container(), later(121))
      expect(cancelled).toContain(stale.id)
      expect(cancelled).not.toContain(confirmed.id)
      expect((await getAdminOrder(api, stale.id)).metadata.confirmation).toBe("cancelled")
      expect((await getAdminOrder(api, confirmed.id)).metadata.confirmation).toBe("confirmed")
    })

    it("leaves young awaiting orders alone", async () => {
      const young = await place()
      const cancelled = await runAutoCancel(container(), later(60))
      expect(cancelled).not.toContain(young.id)
      expect((await getAdminOrder(api, young.id)).metadata.confirmation).toBe("awaiting")
    })

    it("is idempotent and tolerates an order already canceled by Medusa", async () => {
      const o = await place()
      const first = await runAutoCancel(container(), later(121))
      expect(first).toContain(o.id)
      const second = await runAutoCancel(container(), later(121))
      expect(second).not.toContain(o.id)
    })
  },
})
