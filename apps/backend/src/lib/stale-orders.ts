/** Ids of orders still awaiting confirmation that are older than `minutes`. */
export function selectStale(
  orders: { id: string; created_at: string; metadata?: { confirmation?: string } | null }[],
  now: Date,
  minutes: number
): string[] {
  const cutoff = +now - minutes * 60000
  return orders
    .filter((o) => (o.metadata?.confirmation ?? "awaiting") === "awaiting" && +new Date(o.created_at) < cutoff)
    .map((o) => o.id)
}
