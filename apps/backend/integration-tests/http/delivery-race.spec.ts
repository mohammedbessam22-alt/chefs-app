import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { DELIVERY_SETTINGS_MODULE } from "../../src/modules/delivery-settings"

jest.setTimeout(120000)

medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    it("creates exactly one settings row under concurrent first reads", async () => {
      const svc: any = getContainer().resolve(DELIVERY_SETTINGS_MODULE)
      const results = await Promise.all(Array.from({ length: 5 }, () => svc.getSettings()))
      expect(new Set(results.map((r: any) => r.id)).size).toBe(1)
      const rows = await svc.listDeliverySettings({})
      expect(rows).toHaveLength(1)
    })
  },
})
