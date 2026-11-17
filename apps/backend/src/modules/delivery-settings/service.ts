import { MedusaService } from "@medusajs/framework/utils"
import DeliverySettings from "./models/delivery-settings"

export type Settings = {
  id: string
  whatsapp_number: string
  round_times: string[]
  cutoff_minutes: number
  auto_cancel_minutes: number
}

class DeliverySettingsModuleService extends MedusaService({ DeliverySettings }) {
  async getSettings(): Promise<Settings> {
    const [existing] = await this.listDeliverySettings({}, { take: 1 })
    if (existing) return existing as unknown as Settings
    const created = await this.createDeliverySettings({
      whatsapp_number: "",
      round_times: [],
      cutoff_minutes: 30,
      auto_cancel_minutes: 120,
    })
    return created as unknown as Settings
  }

  async updateSettings(data: Partial<Omit<Settings, "id">>): Promise<Settings> {
    const current = await this.getSettings()
    const updated = await this.updateDeliverySettings({ id: current.id, ...data })
    return updated as unknown as Settings
  }
}

export default DeliverySettingsModuleService
