import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, Heading, Input, Prompt, Table, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useRef, useState } from "react"
import { chefsFetch } from "../../lib/chefs-api"
import {
  actionErrorMessage,
  allowedActions,
  baghdadToday,
  buildOrdersQuery,
  clampOffset,
  tryBegin,
  hasMore,
  mapsUrl,
  whatsappUrl,
  type OrderFilters,
  type OrderRow,
  type StaffAction,
} from "../../lib/chefs-orders"

const PAGE_SIZE = 100
const REFRESH_MS = 30_000

const LABELS: Record<StaffAction, string> = { confirm: "Confirm", deliver: "Delivered", cancel: "Cancel" }
const COLORS: Record<string, "orange" | "blue" | "green" | "red" | "grey"> = {
  awaiting: "orange",
  confirmed: "blue",
  delivered: "green",
  cancelled: "red",
}
const selectClass = "bg-ui-bg-field border-ui-border-base text-ui-fg-base txt-compact-small h-8 rounded-md border px-2"

const OrdersPage = () => {
  const [filters, setFilters] = useState<OrderFilters>(() => ({
    confirmation: "",
    delivery_type: "",
    round_label: "",
    date: baghdadToday(),
  }))
  const [offset, setOffset] = useState(0)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [rounds, setRounds] = useState<string[]>([])
  const [confirmCancel, setConfirmCancel] = useState<OrderRow | null>(null)
  // In-flight action ids: the ref is checked synchronously (blocks double clicks); state drives disabled buttons.
  const inFlight = useRef(new Set<string>())
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())

  // Latest query lives in a ref so the 30 s timer always loads the current filters without being re-created.
  const queryRef = useRef("")
  queryRef.current = buildOrdersQuery(filters, offset, PAGE_SIZE)
  const reqId = useRef(0)

  const load = useCallback(async () => {
    const id = ++reqId.current
    const query = queryRef.current
    const r = await chefsFetch(`/admin/chefs/orders?${query}`)
    // Ignore stale responses: a newer request started, or the filters changed while this was in flight.
    if (id !== reqId.current || query !== queryRef.current) return
    setLoading(false)
    if (!r.ok) {
      setLoadError(true)
      return
    }
    setLoadError(false)
    setOrders(r.body.orders)
    setCount(r.body.count)
    // Rows vanished (e.g. cancelled elsewhere) and this page is now past the end: go to the last page.
    setOffset((o) => clampOffset(o, r.body.count, PAGE_SIZE))
  }, [])

  // Reload on filter/page change.
  useEffect(() => {
    setLoading(true)
    load()
  }, [filters, offset, load])
  // Rows shown belong to the previous query while a reload for changed filters/page is in flight.
  const rowsStale = loading

  // Auto-refresh: only touches the list data, never filters, dialog or paging.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState !== "hidden") load()
    }, REFRESH_MS)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    chefsFetch("/admin/chefs/settings").then((r) => r.ok && setRounds(r.body.round_times ?? []))
  }, [])

  const setFilter = (k: keyof OrderFilters, v: string) => {
    setOffset(0)
    setFilters((f) => ({ ...f, [k]: v }))
  }

  const act = async (o: OrderRow, action: StaffAction) => {
    if (!tryBegin(inFlight.current, o.id)) return
    setBusy(new Set(inFlight.current))
    const r = await chefsFetch(`/admin/chefs/orders/${o.id}/${action}`, { method: "POST" })
    inFlight.current.delete(o.id)
    setBusy(new Set(inFlight.current))
    if (r.ok) toast.success(`Order #${o.display_id}: ${LABELS[action]} done`)
    else toast.error(actionErrorMessage(r.status, r.body))
    load()
  }

  const roundOptions = filters.round_label && !rounds.includes(filters.round_label) ? [...rounds, filters.round_label] : rounds

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-wrap items-end justify-between gap-3 px-6 py-4">
        <Heading>Orders (WhatsApp)</Heading>
        <div className="flex flex-wrap items-end gap-2">
          <select className={selectClass} aria-label="Status" value={filters.confirmation} onChange={(e) => setFilter("confirmation", e.target.value)}>
            <option value="">All statuses</option>
            <option value="awaiting">Awaiting</option>
            <option value="confirmed">Confirmed</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select className={selectClass} aria-label="Delivery type" value={filters.delivery_type} onChange={(e) => setFilter("delivery_type", e.target.value)}>
            <option value="">Regular + Express</option>
            <option value="regular">Regular</option>
            <option value="express">Express</option>
          </select>
          <select className={selectClass} aria-label="Round" value={filters.round_label} onChange={(e) => setFilter("round_label", e.target.value)}>
            <option value="">All rounds</option>
            {roundOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <Input
            type="date"
            size="small"
            aria-label="Date"
            value={filters.date}
            onChange={(e) => e.target.value && setFilter("date", e.target.value)}
          />
          <Button size="small" variant="secondary" onClick={() => load()}>
            Refresh
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="px-6 py-3">
          <Text size="small" className="text-ui-fg-error">
            Could not load orders (will retry automatically).
          </Text>
        </div>
      )}

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>#</Table.HeaderCell>
            <Table.HeaderCell>Time</Table.HeaderCell>
            <Table.HeaderCell>Customer</Table.HeaderCell>
            <Table.HeaderCell>Phone</Table.HeaderCell>
            <Table.HeaderCell>Round</Table.HeaderCell>
            <Table.HeaderCell>Items</Table.HeaderCell>
            <Table.HeaderCell>Total</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell>Actions</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {orders.map((o) => {
            const wa = whatsappUrl(o.phone)
            const map = mapsUrl(o.lat, o.lng)
            return (
              <Table.Row key={o.id}>
                <Table.Cell>{o.display_id}</Table.Cell>
                <Table.Cell>{new Date(o.created_at).toLocaleTimeString("en-GB", { timeZone: "Asia/Baghdad", hour: "2-digit", minute: "2-digit" })}</Table.Cell>
                <Table.Cell>
                  <span dir="auto">{o.customer_name ?? "-"}</span>
                  {o.landmark && (
                    <div dir="auto" className="text-ui-fg-subtle txt-small">
                      {o.landmark}
                    </div>
                  )}
                </Table.Cell>
                <Table.Cell>
                  <span dir="ltr">{o.phone ?? "-"}</span>
                  <div className="flex gap-2 txt-small">
                    {wa && (
                      <a className="text-ui-fg-interactive" href={wa} target="_blank" rel="noreferrer">
                        Open on WhatsApp
                      </a>
                    )}
                    {map && (
                      <a className="text-ui-fg-interactive" href={map} target="_blank" rel="noreferrer">
                        Map
                      </a>
                    )}
                  </div>
                </Table.Cell>
                <Table.Cell>{o.delivery_type === "express" ? <Badge color="purple">Express</Badge> : (o.round_label ?? "-")}</Table.Cell>
                <Table.Cell>
                  {o.items.map((i, idx) => (
                    <div key={idx} dir="auto">
                      {i.quantity} x {i.title}
                    </div>
                  ))}
                </Table.Cell>
                <Table.Cell>{o.total.toLocaleString("en-US")} IQD</Table.Cell>
                <Table.Cell>
                  <Badge color={COLORS[o.confirmation] ?? "grey"}>{o.confirmation}</Badge>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex gap-2">
                    {allowedActions(o.confirmation).map((a) => (
                      <Button
                        key={a}
                        size="small"
                        variant={a === "cancel" ? "danger" : "secondary"}
                        disabled={busy.has(o.id) || rowsStale}
                        onClick={() => (a === "cancel" ? setConfirmCancel(o) : act(o, a))}
                      >
                        {LABELS[a]}
                      </Button>
                    ))}
                  </div>
                </Table.Cell>
              </Table.Row>
            )
          })}
        </Table.Body>
      </Table>

      {!loading && orders.length === 0 && !loadError && (
        <div className="px-6 py-6">
          <Text className="text-ui-fg-subtle">No orders for these filters.</Text>
        </div>
      )}
      {loading && orders.length === 0 && (
        <div className="px-6 py-6">
          <Text className="text-ui-fg-subtle">Loading...</Text>
        </div>
      )}

      <div className="flex items-center justify-between px-6 py-3">
        <Text size="small" className="text-ui-fg-subtle">
          {count === 0 ? "0 orders" : `Showing ${offset + 1}-${offset + orders.length} of ${count}`}
        </Text>
        <div className="flex gap-2">
          <Button size="small" variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
            Previous
          </Button>
          <Button size="small" variant="secondary" disabled={!hasMore({ count, offset, length: orders.length })} onClick={() => setOffset(offset + PAGE_SIZE)}>
            Next
          </Button>
        </div>
      </div>

      <Prompt open={confirmCancel !== null} onOpenChange={(open) => !open && setConfirmCancel(null)}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Cancel order #{confirmCancel?.display_id}?</Prompt.Title>
            <Prompt.Description>The order will be cancelled and its stock released. This cannot be undone.</Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel>Keep order</Prompt.Cancel>
            <Prompt.Action
              onClick={() => {
                const o = confirmCancel
                setConfirmCancel(null)
                if (o) act(o, "cancel")
              }}
            >
              Cancel order
            </Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>
    </Container>
  )
}

export const config = defineRouteConfig({ label: "Orders (WhatsApp)" })
export default OrdersPage
