import type { Confirmation } from "./confirmation"

export type ChefsOrderMeta = {
  confirmation: Confirmation
  delivery_type: "regular" | "express"
  round_label?: string
  round_departs_at?: string
  /** ISO time the subscriber handled order.placed (>= created_at); auto-cancel ages from it. */
  placed_at?: string
}
