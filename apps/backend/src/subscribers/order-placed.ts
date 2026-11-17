import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { DELIVERY_SETTINGS_MODULE } from "../modules/delivery-settings"
import { nextRound } from "../lib/rounds"
import { orderLockKey } from "../lib/order-lock"
import type { ChefsOrderMeta } from "../lib/order-meta"

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const orderService: any = container.resolve(Modules.ORDER)
  const fulfillment: any = container.resolve(Modules.FULFILLMENT)
  const settingsService: any = container.resolve(DELIVERY_SETTINGS_MODULE)
  const locking: any = container.resolve(Modules.LOCKING)

  // Same lock as the staff actions and the auto-cancel job: the read + stamp can't race them.
  await locking.execute(orderLockKey(data.id), async () => {
    const {
      data: [order],
    } = await query.graph({
      entity: "order",
      fields: ["id", "created_at", "is_draft_order", "metadata", "shipping_methods.shipping_option_id", "shipping_methods.data"],
      filters: { id: data.id },
    })
    if (!order || order.is_draft_order) return
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

    // A converted draft keeps the draft's old created_at: the order is placed when we handle the event.
    const placedAt = new Date(Math.max(new Date(order.created_at).getTime(), Date.now()))
    const meta: ChefsOrderMeta = { confirmation: "awaiting", delivery_type: deliveryType, placed_at: placedAt.toISOString() }
    if (deliveryType === "regular") {
      const settings = await settingsService.getSettings()
      const round = nextRound(placedAt, settings.round_times, settings.cutoff_minutes)
      if (round) {
        meta.round_label = round.label
        meta.round_departs_at = round.departs_at
      }
    }

    await orderService.updateOrders(order.id, { metadata: { ...(order.metadata ?? {}), ...meta } })
  })
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
