import type { Confirmation } from "./confirmation"

export type ChefsOrderMeta = {
  confirmation: Confirmation
  delivery_type: "regular" | "express"
  round_label?: string
  round_departs_at?: string
}
