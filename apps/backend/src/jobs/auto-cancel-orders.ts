import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { cancelChefsOrder } from "../lib/cancel-order"
import { orderLockKey } from "../lib/order-lock"
import { ORDER_ROW_FIELDS, effectiveConfirmation } from "../lib/order-row"
import { selectStale } from "../lib/stale-orders"
import { DELIVERY_SETTINGS_MODULE } from "../modules/delivery-settings"

const CLOSED_STATUSES = ["canceled", "completed", "archived", "draft"]

async function readOrder(container: any, id: string) {
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [order],
  } = await query.graph({ entity: "order", fields: [...ORDER_ROW_FIELDS, "is_draft_order"], filters: { id } })
  return order
}

/** Cancels orders left unconfirmed past `auto_cancel_minutes`. Returns the ids actually cancelled. */
export async function runAutoCancel(container: any, now: Date = new Date()): Promise<string[]> {
  const logger: any = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const locking: any = container.resolve(Modules.LOCKING)
  const orderService: any = container.resolve(Modules.ORDER)
  const { auto_cancel_minutes: minutes } = await (container.resolve(DELIVERY_SETTINGS_MODULE) as any).getSettings()

  const cutoff = new Date(+now - minutes * 60000)
  // Only open, real (non-draft) orders. created_at <= placed_at, so the created_at bound never misses
  // a stale order; the exact age (placed_at, else created_at) is checked by selectStale.
  const { data: candidates } = await query.graph({
    entity: "order",
    fields: ["id", "status", "created_at", "metadata"],
    filters: { created_at: { $lt: cutoff }, is_draft_order: false, status: { $nin: CLOSED_STATUSES } },
    pagination: { take: null },
  })
  const ids = selectStale(candidates, now, minutes)

  const cancelled: string[] = []
  for (const id of ids) {
    try {
      await locking.execute(orderLockKey(id), async () => {
        // Re-read inside the lock: staff may have acted since the scan.
        const order = await readOrder(container, id)
        if (!order || order.is_draft_order || CLOSED_STATUSES.includes(order.status)) return
        if (effectiveConfirmation(order) !== "awaiting") return
        if (selectStale([order], now, minutes).length === 0) return
        await cancelChefsOrder(container, id)
        await orderService.updateOrders(id, { metadata: { ...(order.metadata ?? {}), confirmation: "cancelled" } })
        cancelled.push(id)
      })
    } catch (e: any) {
      logger.error(`chefs-auto-cancel: failed to cancel ${id}: ${e?.message ?? e}`)
    }
  }
  return cancelled
}

export default async function autoCancelOrders(container: any) {
  const cancelled = await runAutoCancel(container)
  if (cancelled.length) container.resolve(ContainerRegistrationKeys.LOGGER).info(`chefs-auto-cancel: cancelled ${cancelled.length} order(s)`)
}

export const config = { name: "chefs-auto-cancel", schedule: "*/10 * * * *" }
