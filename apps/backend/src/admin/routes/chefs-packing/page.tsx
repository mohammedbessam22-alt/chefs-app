import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, Heading, Input, Text } from "@medusajs/ui"
import { useCallback, useEffect, useRef, useState } from "react"
import { chefsFetch } from "../../lib/chefs-api"
import { baghdadToday, buildPackingQuery, dateForRefresh, isExplicitDate, type PackingFilters, type PackingLocation } from "../../lib/chefs-orders"

const selectClass = "bg-ui-bg-field border-ui-border-base text-ui-fg-base txt-compact-small h-8 rounded-md border px-2"

const PackingPage = () => {
  const [filters, setFilters] = useState<PackingFilters>(() => ({ round_label: "", date: baghdadToday() }))
  const [locations, setLocations] = useState<PackingLocation[]>([])
  const [rounds, setRounds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const reqId = useRef(0)
  const queryRef = useRef("")
  queryRef.current = buildPackingQuery(filters)

  const load = useCallback(async () => {
    const id = ++reqId.current
    const query = queryRef.current
    const r = await chefsFetch(`/admin/chefs/packing?${query}`)
    if (id !== reqId.current || query !== queryRef.current) return
    setLoading(false)
    if (!r.ok) return setError(true)
    setError(false)
    setLocations(r.body.locations)
  }, [])

  useEffect(() => {
    setLoading(true)
    load()
  }, [filters, load])

  // "Today" follows the clock until the user picks another date (a tab open past midnight moves on).
  const datePicked = useRef(false)
  const dateRef = useRef(filters.date)
  dateRef.current = filters.date
  const refresh = useCallback(() => {
    const next = dateForRefresh(dateRef.current, datePicked.current)
    if (next === dateRef.current) return load()
    setFilters((f) => ({ ...f, date: next }))
  }, [load])

  useEffect(() => {
    chefsFetch("/admin/chefs/settings").then((r) => r.ok && setRounds(r.body.round_times ?? []))
  }, [])

  const roundOptions = filters.round_label && !rounds.includes(filters.round_label) ? [...rounds, filters.round_label] : rounds

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-wrap items-end justify-between gap-3 px-6 py-4 print:hidden">
        <div>
          <Heading>Packing</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Confirmed orders for the delivery day, one column per warehouse.
          </Text>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <select className={selectClass} aria-label="Round" value={filters.round_label} onChange={(e) => setFilters((f) => ({ ...f, round_label: e.target.value }))}>
            <option value="">All rounds</option>
            {roundOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <Input type="date" size="small" aria-label="Delivery day" title="Delivery day" value={filters.date} onChange={(e) => {
              const value = e.target.value
              if (!value) return
              datePicked.current = isExplicitDate(value)
              setFilters((f) => ({ ...f, date: value }))
            }}
          />
          <Button size="small" variant="secondary" onClick={() => refresh()}>
            Refresh
          </Button>
          <Button size="small" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>

      {error && (
        <div className="px-6 py-3">
          <Text size="small" className="text-ui-fg-error">
            Could not load the packing list.
          </Text>
        </div>
      )}
      {!loading && !error && locations.length === 0 && (
        <div className="px-6 py-6">
          <Text className="text-ui-fg-subtle">No confirmed orders for these filters.</Text>
        </div>
      )}

      <style>{`@media print { header, nav, aside, [data-print-hide] { display: none !important; } main { padding: 0 !important; } }`}</style>
      <div className="flex flex-wrap items-start gap-4 px-6 py-4">
        {locations.map((loc) => {
          const unassigned = loc.id === "unassigned"
          return (
            <section
              key={loc.id}
              className={`min-w-64 flex-1 rounded-lg border p-4 ${unassigned ? "border-ui-border-error bg-ui-bg-subtle-hover" : "border-ui-border-base"}`}
              style={{ breakInside: "avoid" }}
            >
              <div className="mb-3 flex items-center gap-2">
                <Heading level="h2" dir="auto">
                  {loc.name}
                </Heading>
                {unassigned && <Badge color="red">Needs attention</Badge>}
              </div>
              {unassigned && (
                <Text size="small" className="text-ui-fg-error mb-2">
                  No warehouse could be determined for these items.
                </Text>
              )}
              <div className="flex flex-col gap-3">
                {loc.orders.map((o) => (
                  <div key={o.display_id}>
                    <Text weight="plus">Order #{o.display_id}</Text>
                    <ul>
                      {o.items.map((i, idx) => (
                        <li key={idx} dir="auto" className="txt-compact-small">
                          {i.quantity} x {i.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({ label: "Packing" })
export default PackingPage
