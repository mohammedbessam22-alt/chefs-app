import { Module } from "@medusajs/framework/utils"
import TranslationsModuleService from "./service"

export const TRANSLATIONS_MODULE = "chefsTranslations"

export default Module(TRANSLATIONS_MODULE, {
  service: TranslationsModuleService,
})
