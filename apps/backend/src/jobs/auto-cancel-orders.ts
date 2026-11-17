import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { cancelChefsOrder } from "../lib/cancel-order"
import { orderLockKey } from "../lib/order-lock"
import { ORDER_ROW_FIELDS, effectiveConfirmation } from "../lib/order-row"
import { selectStale } from "../lib/stale-orders"
import { DELIVERY_SETTINGS_MODULE } from "../modules/delivery-settings"

async function readOrder(container: any, id: string) {
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [order],
  } = await query.graph({ entity: "order", fields: ORDER_ROW_FIELDS, filters: { id } })
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
  const { data: candidates } = await query.graph({
    entity: "order",
    fields: ["id", "status", "created_at", "metadata"],
    filters: { created_at: { $lt: cutoff } },
  })
  const ids = selectStale(
    candidates.filter((o: any) => o.status !== "canceled"),
    now,
    minutes
  )

  const cancelled: string[] = []
  for (const id of ids) {
    try {
      await locking.execute(orderLockKey(id), async () => {
        // Re-read inside the lock: staff may have acted since the scan.
        const order = await readOrder(container, id)
        if (!order || effectiveConfirmation(order) !== "awaiting") return
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
