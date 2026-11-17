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

// `round_times` is a json column: Medusa types it as Record<string, unknown>
// but it is stored and used as string[]. The casts live at this boundary only.
type StoredRow = Omit<Settings, "round_times"> & { round_times?: unknown }

const fromStored = (row: unknown): Settings => {
  const r = row as StoredRow
  return {
    ...r,
    round_times: Array.isArray(r.round_times) ? (r.round_times as string[]) : [],
  } as Settings
}

class DeliverySettingsModuleService extends MedusaService({ DeliverySettings }) {
  async getSettings(): Promise<Settings> {
    const read = async () => {
      const [row] = await this.listDeliverySettings({ id: SINGLETON_ID }, { take: 1 })
      return row ? fromStored(row) : undefined
    }
    const existing = await read()
    if (existing) return existing
    const defaults = {
      id: SINGLETON_ID,
      whatsapp_number: "",
      round_times: [] as string[],
      cutoff_minutes: 30,
      auto_cancel_minutes: 120,
    }
    try {
      const created = await this.createDeliverySettings(
        defaults as unknown as Record<string, unknown>
      )
      return fromStored(created)
    } catch (e) {
      // a concurrent request inserted the singleton first: re-read it
      const row = await read()
      if (row) return row
      throw e
    }
  }

  async updateSettings(data: Partial<Omit<Settings, "id">>): Promise<Settings> {
    const current = await this.getSettings()
    const updated = await this.updateDeliverySettings(
      { id: current.id, ...data } as unknown as Record<string, unknown>
    )
    return fromStored(updated)
  }
}

export default DeliverySettingsModuleService
