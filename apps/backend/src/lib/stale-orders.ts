type StaleCandidate = { id: string; created_at: string | Date; metadata?: { confirmation?: string; placed_at?: string } | null }

/** When the order entered the app's flow: metadata.placed_at (stamped by the subscriber) if valid, else created_at. */
export function placedAtMs(o: StaleCandidate): number {
  const placed = o.metadata?.placed_at ? new Date(o.metadata.placed_at).getTime() : NaN
  return Number.isNaN(placed) ? new Date(o.created_at).getTime() : placed
}

/** Ids of orders still awaiting confirmation that were placed more than `minutes` ago. */
export function selectStale(orders: StaleCandidate[], now: Date, minutes: number): string[] {
  const cutoff = +now - minutes * 60000
  return orders
    .filter((o) => (o.metadata?.confirmation ?? "awaiting") === "awaiting" && placedAtMs(o) < cutoff)
    .map((o) => o.id)
}
