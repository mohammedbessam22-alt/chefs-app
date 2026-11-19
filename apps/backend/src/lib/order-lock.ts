/** Single lock key per order, shared by the staff action route and the auto-cancel job. */
export const orderLockKey = (orderId: string) => `chefs-order:${orderId}`
