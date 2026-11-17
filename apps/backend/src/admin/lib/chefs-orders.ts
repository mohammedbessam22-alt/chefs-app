// Pure helpers for the Orders / Packing admin pages (unit-tested).
export type Confirmation = "awaiting" | "confirmed" | "delivered" | "cancelled"
export type StaffAction = "confirm" | "deliver" | "cancel"

export type OrderFilters = { confirmation: string; delivery_type: string; round_label: string; date: string }
export type PackingFilters = { round_label: string; date: string }

export type OrderRow = {
  id: string
  display_id: number
  created_at: string
  total: number
  confirmation: Confirmation
  delivery_type: string
  round_label: string | null
  customer_name: string | null
  phone: string | null
  landmark: string | null
  lat: number | null
  lng: number | null
  items: { title: string; quantity: number }[]
}

export type PackingLocation = { id: string; name: string; orders: { display_id: number; items: { title: string; quantity: number }[] }[] }

// Asia/Baghdad is fixed UTC+03:00 (same convention as the backend).
export const baghdadToday = (now: Date = new Date()): string => new Date(now.getTime() + 180 * 60_000).toISOString().slice(0, 10)

export function buildOrdersQuery(f: OrderFilters, offset: number, limit: number): string {
  const p = new URLSearchParams()
  if (f.confirmation) p.set("confirmation", f.confirmation)
  if (f.delivery_type) p.set("delivery_type", f.delivery_type)
  if (f.round_label) p.set("round_label", f.round_label)
  p.set("date", f.date)
  p.set("limit", String(limit))
  p.set("offset", String(offset))
  // Keep a stable order: date first for readability.
  const order = ["confirmation", "delivery_type", "round_label", "date", "limit", "offset"]
  return order.filter((k) => p.has(k)).map((k) => `${k}=${encodeURIComponent(p.get(k)!).replace(/%20/g, "+")}`).join("&")
}

export function buildPackingQuery(f: PackingFilters): string {
  const parts = [`date=${encodeURIComponent(f.date)}`]
  if (f.round_label) parts.push(`round_label=${encodeURIComponent(f.round_label)}`)
  return parts.join("&")
}

export function allowedActions(c: string): StaffAction[] {
  if (c === "awaiting") return ["confirm", "cancel"]
  if (c === "confirmed") return ["deliver", "cancel"]
  return []
}

/** True while more rows exist beyond those loaded up to and including this page. */
export const hasMore = (p: { count: number; offset: number; length: number }): boolean => p.offset + p.length < p.count

export function whatsappUrl(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "")
  return digits ? `https://wa.me/${digits}` : null
}

export function mapsUrl(lat: number | null | undefined, lng: number | null | undefined): string | null {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return null
  return `https://maps.google.com/?q=${lat},${lng}`
}

export function actionErrorMessage(status: number, body: any): string {
  if (status === 409 && body?.message === "invalid_transition") return "This order changed - refresh"
  if (status === 404) return "Order not found - refresh"
  return "Action failed - try again"
}
