import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Button, Container, Heading, Input, Label, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"
import {
  blankTitleWithDescription,
  changedLocales,
  type Draft,
  type Drafts,
  type Locale,
} from "../lib/translation-drafts"

const LOCALES: { code: Locale; label: string; dir: "rtl" | "ltr" }[] = [
  { code: "ckb", label: "Kurdish (Sorani)", dir: "rtl" },
  { code: "tk", label: "Turkmen", dir: "ltr" },
  { code: "en", label: "English", dir: "ltr" },
]

const empty = (): Drafts => ({
  ckb: { title: "", description: "" },
  tk: { title: "", description: "" },
  en: { title: "", description: "" },
})

const request = async (url: string, init?: RequestInit) => {
  const res = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

const ProductTranslations = ({ data }: { data: { id: string } }) => {
  const [drafts, setDrafts] = useState<Drafts>(empty())
  const [snapshot, setSnapshot] = useState<Drafts>(empty())
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoaded(false)
    setLoadError(false)
    try {
      const r: { translations: { locale: Locale; title: string; description: string | null }[] } = await request(
        `/admin/chefs/translations?entity_type=product&entity_id=${encodeURIComponent(data.id)}`
      )
      const next = empty()
      for (const t of r.translations) next[t.locale] = { title: t.title, description: t.description ?? "" }
      setSnapshot(next)
      setDrafts(next)
      setLoaded(true)
    } catch {
      setLoadError(true)
    }
  }, [data.id])

  useEffect(() => {
    load()
  }, [load])

  const set = (code: Locale, field: keyof Draft, value: string) =>
    setDrafts((d) => ({ ...d, [code]: { ...d[code], [field]: value } }))

  const blank = blankTitleWithDescription(drafts)
  const changed = changedLocales(snapshot, drafts)
  const canSave = loaded && !saving && changed.length > 0 && blank.length === 0

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    const saved: Locale[] = []
    try {
      for (const code of changed) {
        await request("/admin/chefs/translations", {
          method: "PUT",
          body: JSON.stringify({
            entity_type: "product",
            entity_id: data.id,
            locale: code,
            title: drafts[code].title,
            description: drafts[code].description,
          }),
        })
        saved.push(code)
      }
      toast.success("Translations saved")
    } catch {
      toast.error(
        `Could not save all translations. Saved: ${saved.length ? saved.join(", ") : "none"}. Failed: ${changed
          .filter((c) => !saved.includes(c))
          .join(", ")}`
      )
    } finally {
      setSaving(false)
      await load() // refresh the snapshot from the server
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Translations</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Arabic is the base language. Leave a title empty to remove that translation.
          </Text>
          {loadError && (
            <Text size="small" className="text-ui-fg-error">
              Could not load translations; saving is disabled.{" "}
              <button type="button" className="underline" onClick={load}>
                Retry
              </button>
            </Text>
          )}
          {blank.length > 0 && (
            <Text size="small" className="text-ui-fg-error">
              A title is required when a description is set ({blank.join(", ")}).
            </Text>
          )}
        </div>
        <Button size="small" onClick={save} isLoading={saving} disabled={!canSave}>
          Save
        </Button>
      </div>
      {LOCALES.map(({ code, label, dir }) => (
        <div key={code} className="grid grid-cols-2 gap-4 px-6 py-4">
          <div className="flex flex-col gap-1">
            <Label size="small">{label} title</Label>
            <Input dir={dir} disabled={!loaded} value={drafts[code].title} onChange={(e) => set(code, "title", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label size="small">{label} description</Label>
            <Input
              dir={dir}
              disabled={!loaded}
              value={drafts[code].description}
              onChange={(e) => set(code, "description", e.target.value)}
            />
          </div>
        </div>
      ))}
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: "product.details.after" })

export default ProductTranslations
