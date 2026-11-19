export type Confirmation = "awaiting" | "confirmed" | "delivered" | "cancelled"
export type StaffAction = "confirm" | "deliver" | "cancel"

const NEXT: Record<StaffAction, Partial<Record<Confirmation, Confirmation>>> = {
  confirm: { awaiting: "confirmed" },
  deliver: { confirmed: "delivered" },
  cancel: { awaiting: "cancelled", confirmed: "cancelled" },
}

export function applyAction(current: Confirmation, action: StaffAction): Confirmation {
  const next = NEXT[action]?.[current]
  if (!next) throw new Error("invalid_transition")
  return next
}
