import { model } from "@medusajs/framework/utils"

// Arabic (base language) lives on the entity itself; this stores ckb / tk / en.
const Translation = model
  .define("chefs_translation", {
    id: model.id({ prefix: "ctr" }).primaryKey(),
    entity_type: model.enum(["product", "category", "collection"]),
    entity_id: model.text(),
    locale: model.enum(["ckb", "tk", "en"]),
    title: model.text(),
    description: model.text().nullable(),
  })
  .indexes([
    {
      on: ["entity_type", "entity_id", "locale"],
      unique: true,
    },
  ])

export default Translation
