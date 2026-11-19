import { model } from "@medusajs/framework/utils"

const DeliverySettings = model.define("delivery_settings", {
  id: model.id().primaryKey(),
  whatsapp_number: model.text().default(""),
  round_times: model.json().default([] as any),
  cutoff_minutes: model.number().default(30),
  auto_cancel_minutes: model.number().default(120),
})

export default DeliverySettings
