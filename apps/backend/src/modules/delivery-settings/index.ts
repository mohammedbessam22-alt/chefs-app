import { Module } from "@medusajs/framework/utils"
import DeliverySettingsModuleService from "./service"

export const DELIVERY_SETTINGS_MODULE = "deliverySettings"

export default Module(DELIVERY_SETTINGS_MODULE, {
  service: DeliverySettingsModuleService,
})
