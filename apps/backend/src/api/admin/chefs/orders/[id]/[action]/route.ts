import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { cancelOrderWorkflow } from "@medusajs/medusa/core-flows"
import { applyAction, type Confirmation, type StaffAction } from "../../../../../../lib/confirmation"
import { ORDER_ROW_FIELDS, toOrderRow } from "../../../../../../lib/order-row"

const ACTIONS: StaffAction[] = ["confirm", "deliver", "cancel"]

class ConflictError extends Error {}

async function readOrder(container: any, id: string) {
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [order],
  } = await query.graph({ entity: "order", fields: ORDER_ROW_FIELDS, filters: { id } })
  return order
}

/** Cancel path: releases reservations through Medusa's workflow. Easy to extract (Task 6). */
async function cancelChefsOrder(container: any, orderId: string) {
  try {
    await cancelOrderWorkflow(container).run({ input: { order_id: orderId } })
  } catch (e: any) {
    // Medusa already canceled it (e.g. the auto-cancel job won the race)
    const current = await readOrder(container, orderId)
    if (current?.status === "canceled" || current?.metadata?.confirmation === "cancelled") {
      throw new ConflictError("invalid_transition")
    }
    throw e
  }
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
    await locking.execute(`chefs-order:${id}`, async () => {
      const order = await readOrder(container, id)
      if (!order) throw Object.assign(new Error("not_found"), { notFound: true })
      const current = (order.metadata?.confirmation ?? "awaiting") as Confirmation
      const next = applyAction(current, action)
      if (action === "cancel") await cancelChefsOrder(container, id)
      await orderService.updateOrders(id, { metadata: { ...(order.metadata ?? {}), confirmation: next } })
    })
  } catch (e: any) {
    if (e?.notFound) {
      res.status(404).json({ type: "not_found", message: "order not found" })
      return
    }
    if (e instanceof ConflictError || e?.message === "invalid_transition") {
      res.status(409).json({ message: "invalid_transition" })
      return
    }
    throw e
  }
  res.json({ order: toOrderRow(await readOrder(container, id)) })
}
