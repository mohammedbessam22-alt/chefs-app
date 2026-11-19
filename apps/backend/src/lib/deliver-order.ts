import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createOrderFulfillmentWorkflow,
  markOrderFulfillmentAsDeliveredWorkflow,
} from "@medusajs/medusa/core-flows"

const DEFAULT_GROUP = "__default__"

/**
 * Groups the still-unfulfilled quantity of each line item by the stock location its
 * reservation sits at (items without a reservation fall back to the shipping option's location).
 */
export function groupItemsByLocation(
  items: { id: string; quantity: number; fulfilled_quantity: number }[],
  reservations: { line_item_id: string | null; location_id: string }[]
): Map<string, { id: string; quantity: number }[]> {
  const locOf = new Map<string, string>()
  for (const r of reservations) if (r.line_item_id && !locOf.has(r.line_item_id)) locOf.set(r.line_item_id, r.location_id)
  const out = new Map<string, { id: string; quantity: number }[]>()
  for (const i of items) {
    const remaining = i.quantity - i.fulfilled_quantity
    if (!(remaining > 0)) continue
    const key = locOf.get(i.id) ?? DEFAULT_GROUP
    if (!out.has(key)) out.set(key, [])
    out.get(key)!.push({ id: i.id, quantity: remaining })
  }
  return out
}

/**
 * Delivery path: consumes the checkout reservations through Medusa's own fulfillment workflows
 * (one fulfillment per warehouse), then marks every fulfillment delivered. Retry-safe: items already
 * fulfilled are skipped and fulfillments already delivered are not touched again.
 * Must be called inside the order lock.
 */
export async function deliverChefsOrder(container: any, orderId: string): Promise<void> {
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const inventory: any = container.resolve(Modules.INVENTORY)

  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: ["id", "items.id", "items.quantity", "items.detail.fulfilled_quantity"],
    filters: { id: orderId },
  })
  const items = (order?.items ?? []).map((i: any) => ({
    id: i.id,
    quantity: Number(i.quantity),
    fulfilled_quantity: Number(i.detail?.fulfilled_quantity ?? 0),
  }))
  const lineIds = items.map((i: any) => i.id)
  const reservations = lineIds.length
    ? await inventory.listReservationItems({ line_item_id: lineIds }, { take: null })
    : []

  for (const [loc, group] of groupItemsByLocation(items, reservations)) {
    await createOrderFulfillmentWorkflow(container).run({
      input: {
        order_id: orderId,
        items: group,
        ...(loc === DEFAULT_GROUP ? {} : { location_id: loc }),
      },
    })
  }

  const {
    data: [withFulfillments],
  } = await query.graph({
    entity: "order",
    fields: ["id", "fulfillments.id", "fulfillments.delivered_at", "fulfillments.canceled_at"],
    filters: { id: orderId },
  })
  for (const f of withFulfillments?.fulfillments ?? []) {
    if (f.delivered_at || f.canceled_at) continue
    await markOrderFulfillmentAsDeliveredWorkflow(container).run({ input: { orderId, fulfillmentId: f.id } })
  }
}
