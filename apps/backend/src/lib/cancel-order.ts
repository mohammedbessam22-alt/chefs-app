import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { cancelOrderWorkflow } from "@medusajs/medusa/core-flows"

/** Cancel path: releases reservations through Medusa's workflow. Tolerates an order Medusa already canceled. */
export async function cancelChefsOrder(container: any, orderId: string): Promise<void> {
  try {
    await cancelOrderWorkflow(container).run({ input: { order_id: orderId } })
  } catch (e: any) {
    const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
    const {
      data: [current],
    } = await query.graph({ entity: "order", fields: ["id", "status"], filters: { id: orderId } })
    if (current?.status !== "canceled") throw e
  }
}
