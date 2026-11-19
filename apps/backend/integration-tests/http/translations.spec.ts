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

    const put = (body: any) => api.put("/admin/chefs/translations", body, adminHeaders(token))
    const get = (locale: string) =>
      api.get(`/store/chefs/translations?locale=${locale}`, storeHeaders(key))

    it("stores a Kurdish title and serves it for ckb only", async () => {
      await put({ entity_type: "product", entity_id: "prod_P", locale: "ckb", title: "کالا", description: "وەسف" })
      const ckb = await get("ckb")
      expect(ckb.data.translations.product.prod_P).toEqual({ title: "کالا", description: "وەسف" })
      expect(ckb.data.translations.category).toEqual({})
      expect(ckb.data.translations.collection).toEqual({})
      const tk = await get("tk")
      expect(tk.data.translations.product.prod_P).toBeUndefined()
    })

    it("updates in place and supports category and collection", async () => {
      await put({ entity_type: "product", entity_id: "prod_P", locale: "ckb", title: "نوێ" })
      await put({ entity_type: "collection", entity_id: "pcol_1", locale: "ckb", title: "براند" })
      const ckb = await get("ckb")
      expect(ckb.data.translations.product.prod_P.title).toBe("نوێ")
      expect(ckb.data.translations.collection.pcol_1.title).toBe("براند")
    })

    it("returns empty maps for ar", async () => {
      const { data } = await get("ar")
      expect(data).toEqual({ translations: { product: {}, category: {}, collection: {} } })
    })

    it("rejects unsupported locales with 400", async () => {
      const bad = await get("fr").catch((e: any) => e.response)
      expect(bad.status).toBe(400)
      const badPut = await put({ entity_type: "product", entity_id: "x", locale: "ar", title: "t" }).catch(
        (e: any) => e.response
      )
      expect(badPut.status).toBe(400)
    })

    it("deletes the row when title is empty", async () => {
      await put({ entity_type: "product", entity_id: "prod_P", locale: "ckb", title: "" })
      const ckb = await get("ckb")
      expect(ckb.data.translations.product.prod_P).toBeUndefined()
    })

    it("admin GET lists translations of one entity", async () => {
      await put({ entity_type: "product", entity_id: "prod_Q", locale: "en", title: "Q" })
      const { data } = await api.get(
        "/admin/chefs/translations?entity_type=product&entity_id=prod_Q",
        adminHeaders(token)
      )
      expect(data.translations).toEqual([
        expect.objectContaining({ locale: "en", title: "Q" }),
      ])
    })
  },
})
