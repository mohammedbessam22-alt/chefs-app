import { MedusaService } from "@medusajs/framework/utils"
import DeliverySettings from "./models/delivery-settings"

const SINGLETON_ID = "delivery_settings"

export type Settings = {
  id: string
  whatsapp_number: string
  round_times: string[]
  cutoff_minutes: number
  auto_cancel_minutes: number
}

class DeliverySettingsModuleService extends MedusaService({ DeliverySettings }) {
  async getSettings(): Promise<Settings> {
    const read = async () => {
      const [row] = await this.listDeliverySettings({ id: SINGLETON_ID }, { take: 1 })
      return row as unknown as Settings | undefined
    }
    const existing = await read()
    if (existing) return existing
    try {
      const created = await this.createDeliverySettings({
        id: SINGLETON_ID,
        whatsapp_number: "",
        round_times: [],
        cutoff_minutes: 30,
        auto_cancel_minutes: 120,
      })
      return created as unknown as Settings
    } catch (e) {
      // a concurrent request inserted the singleton first: re-read it
      const row = await read()
      if (row) return row
      throw e
    }
  }

  async updateSettings(data: Partial<Omit<Settings, "id">>): Promise<Settings> {
    const current = await this.getSettings()
    const updated = await this.updateDeliverySettings({ id: current.id, ...data })
    return updated as unknown as Settings
  }
}

export default DeliverySettingsModuleService
