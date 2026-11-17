import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Button, Container, Heading, Input, Label, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"

type Locale = "ckb" | "tk" | "en"
type Draft = { title: string; description: string }
type Drafts = Record<Locale, Draft>

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
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    request(`/admin/chefs/translations?entity_type=product&entity_id=${encodeURIComponent(data.id)}`)
      .then((r: { translations: { locale: Locale; title: string; description: string | null }[] }) => {
        if (cancelled) return
        const next = empty()
        for (const t of r.translations) next[t.locale] = { title: t.title, description: t.description ?? "" }
        setDrafts(next)
      })
      .catch(() => toast.error("Could not load translations"))
    return () => {
      cancelled = true
    }
  }, [data.id])

  const set = (code: Locale, field: keyof Draft, value: string) =>
    setDrafts((d) => ({ ...d, [code]: { ...d[code], [field]: value } }))

  const save = async () => {
    setSaving(true)
    try {
      for (const { code } of LOCALES) {
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
      }
      toast.success("Translations saved")
    } catch {
      toast.error("Could not save translations")
    } finally {
      setSaving(false)
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
        </div>
        <Button size="small" onClick={save} isLoading={saving}>
          Save
        </Button>
      </div>
      {LOCALES.map(({ code, label, dir }) => (
        <div key={code} className="grid grid-cols-2 gap-4 px-6 py-4">
          <div className="flex flex-col gap-1">
            <Label size="small">{label} title</Label>
            <Input dir={dir} value={drafts[code].title} onChange={(e) => set(code, "title", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label size="small">{label} description</Label>
            <Input
              dir={dir}
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
