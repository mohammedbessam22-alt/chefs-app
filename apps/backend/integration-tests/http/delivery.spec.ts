import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { seedChefs } from "../../src/scripts/seed"
import { adminHeaders, getAdminToken, storeHeaders } from "../helpers"

jest.setTimeout(120000)

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let key: string
    let token: string
    beforeAll(async () => {
      const container = getContainer()
      await seedChefs(container)
      const apiKeys: any = container.resolve(Modules.API_KEY)
      const [pk] = await apiKeys.listApiKeys({ title: "chefs-app" })
      key = pk.token
      token = await getAdminToken(container, api)
    })

    it("returns defaults before anything is configured", async () => {
      const { data } = await api.get("/admin/chefs/settings", adminHeaders(token))
      expect(data).toEqual(
        expect.objectContaining({
          whatsapp_number: "",
          round_times: [],
          cutoff_minutes: 30,
          auto_cancel_minutes: 120,
        })
      )
      const pub = await api.get("/store/chefs/delivery", storeHeaders(key))
      expect(pub.data).toEqual({ whatsapp_number: "", next_round: null })
    })

    it("normalizes phone, sorts rounds, and exposes them to the store", async () => {
      const { data } = await api.post(
        "/admin/chefs/settings",
        { whatsapp_number: "0770 123 4567", round_times: ["20:00", "12:00"] },
        adminHeaders(token)
      )
      expect(data.whatsapp_number).toBe("9647701234567")
      expect(data.round_times).toEqual(["12:00", "20:00"])

      const pub = await api.get("/store/chefs/delivery", storeHeaders(key))
      expect(pub.data.whatsapp_number).toBe("9647701234567")
      expect(pub.data.next_round).toEqual({
        label: expect.stringMatching(/^(12|20):00$/),
        departs_at: expect.any(String),
      })
    })

    it("rejects invalid round times and phones with 400", async () => {
      const bad = await api
        .post("/admin/chefs/settings", { round_times: ["25:00"] }, adminHeaders(token))
        .catch((e: any) => e.response)
      expect(bad.status).toBe(400)
      const badPhone = await api
        .post("/admin/chefs/settings", { whatsapp_number: "123" }, adminHeaders(token))
        .catch((e: any) => e.response)
      expect(badPhone.status).toBe(400)
    })
  },
})
