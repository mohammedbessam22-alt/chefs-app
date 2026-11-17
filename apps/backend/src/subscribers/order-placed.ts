import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { DELIVERY_SETTINGS_MODULE } from "../modules/delivery-settings"
import { nextRound } from "../lib/rounds"
import type { ChefsOrderMeta } from "../lib/order-meta"

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const orderService: any = container.resolve(Modules.ORDER)
  const fulfillment: any = container.resolve(Modules.FULFILLMENT)
  const settingsService: any = container.resolve(DELIVERY_SETTINGS_MODULE)

  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: ["id", "created_at", "metadata", "shipping_methods.shipping_option_id", "shipping_methods.data"],
    filters: { id: data.id },
  })
  if (!order) return
  // Replay-safe: never overwrite a state already stamped (e.g. confirmed/delivered by an admin)
  if (order.metadata?.confirmation) return

  let deliveryType: "regular" | "express" = "regular"
  const method = order.shipping_methods?.[0]
  if (method?.shipping_option_id) {
    try {
      const option = await fulfillment.retrieveShippingOption(method.shipping_option_id)
      if (option?.data?.delivery_type === "express") deliveryType = "express"
    } catch {
      // option deleted since checkout: fall back to regular
    }
  }

  const meta: ChefsOrderMeta = { confirmation: "awaiting", delivery_type: deliveryType }
  if (deliveryType === "regular") {
    const settings = await settingsService.getSettings()
    const round = nextRound(new Date(order.created_at), settings.round_times, settings.cutoff_minutes)
    if (round) {
      meta.round_label = round.label
      meta.round_departs_at = round.departs_at
    }
  }

  await orderService.updateOrders(order.id, { metadata: { ...(order.metadata ?? {}), ...meta } })
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
