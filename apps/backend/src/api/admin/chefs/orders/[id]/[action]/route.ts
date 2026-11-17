import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { applyAction, type Confirmation, type StaffAction } from "../../../../../../lib/confirmation"
import { cancelChefsOrder } from "../../../../../../lib/cancel-order"
import { deliverChefsOrder } from "../../../../../../lib/deliver-order"
import { orderLockKey } from "../../../../../../lib/order-lock"
import { ORDER_ROW_FIELDS, effectiveConfirmation, toOrderRow } from "../../../../../../lib/order-row"

const ACTIONS: StaffAction[] = ["confirm", "deliver", "cancel"]

async function readOrder(container: any, id: string) {
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [order],
  } = await query.graph({ entity: "order", fields: ORDER_ROW_FIELDS, filters: { id } })
  return order
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id, action } = req.params as { id: string; action: StaffAction }
  if (!ACTIONS.includes(action)) {
    res.status(404).json({ type: "not_found", message: "unknown action" })
    return
  }
  const container = req.scope
  const locking: any = container.resolve(Modules.LOCKING)
  const orderService: any = container.resolve(Modules.ORDER)

  try {
    // Serialize actions per order; state is re-read inside the lock.
    await locking.execute(orderLockKey(id), async () => {
      const order = await readOrder(container, id)
      if (!order) throw Object.assign(new Error("not_found"), { notFound: true })
      const stale = order.status === "canceled" && order.metadata?.confirmation !== "cancelled"
      // Medusa-canceled order with stale metadata: cancel is a repair, others are 409
      const next: Confirmation =
        stale && action === "cancel" ? "cancelled" : applyAction(effectiveConfirmation(order), action)
      if (action === "cancel" && !stale) await cancelChefsOrder(container, id)
      // Consume the checkout reservations (stock leaves the warehouse) before recording the state.
      if (action === "deliver") await deliverChefsOrder(container, id)
      await orderService.updateOrders(id, { metadata: { ...(order.metadata ?? {}), confirmation: next } })
    })
  } catch (e: any) {
    if (e?.notFound) {
      res.status(404).json({ type: "not_found", message: "order not found" })
      return
    }
    if (e?.message === "invalid_transition") {
      res.status(409).json({ message: "invalid_transition" })
      return
    }
    if (e?.type === MedusaError.Types.NOT_ALLOWED) {
      // e.g. cancel of an order that already has a fulfillment
      res.status(409).json({ type: "not_allowed", message: e.message })
      return
    }
    throw e
  }
  res.json({ order: toOrderRow(await readOrder(container, id)) })
}
