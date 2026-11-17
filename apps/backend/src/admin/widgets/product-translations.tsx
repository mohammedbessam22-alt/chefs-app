import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Button, Container, Heading, Input, Label, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useReducer, useRef } from "react"
import {
  blankTitleWithDescription,
  changedLocales,
  emptyDrafts,
  initialState,
  translationsReducer,
  type Draft,
  type Locale,
} from "../lib/translation-drafts"

const LOCALES: { code: Locale; label: string; dir: "rtl" | "ltr" }[] = [
  { code: "ckb", label: "Kurdish (Sorani)", dir: "rtl" },
  { code: "tk", label: "Turkmen", dir: "ltr" },
  { code: "en", label: "English", dir: "ltr" },
]

const request = async (url: string, init?: RequestInit) => {
  const res = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

const ProductTranslations = ({ data }: { data: { id: string } }) => {
  const [state, dispatch] = useReducer(translationsReducer, data.id, initialState)
  // Token generator only; the reducer holds the accepted reqId and ignores any other response.
  const nextReqId = useRef(0)

  const fetchInto = useCallback(async (productId: string, reqId: number) => {
    try {
      const r: { translations: { locale: Locale; title: string; description: string | null }[] } = await request(
        `/admin/chefs/translations?entity_type=product&entity_id=${encodeURIComponent(productId)}`
      )
      const server = emptyDrafts()
      for (const t of r.translations) server[t.locale] = { title: t.title, description: t.description ?? "" }
      dispatch({ type: "LOAD_OK", productId, reqId, server })
    } catch {
      dispatch({ type: "LOAD_FAIL", productId, reqId })
    }
  }, [])

  const load = useCallback(
    (productId: string) => {
      const reqId = ++nextReqId.current
      dispatch({ type: "LOAD_START", productId, reqId })
      fetchInto(productId, reqId)
    },
    [fetchInto]
  )

  useEffect(() => {
    dispatch({ type: "RESET", productId: data.id })
    load(data.id)
  }, [data.id, load])

  const { status, snapshot, drafts, saveError, productId } = state
  const ready = status === "ready"
  const blank = blankTitleWithDescription(drafts)
  const changed = changedLocales(snapshot, drafts)
  const canSave = ready && productId === data.id && changed.length > 0 && blank.length === 0

  const set = (locale: Locale, field: keyof Draft, value: string) => dispatch({ type: "EDIT", locale, field, value })

  const save = async () => {
    if (!canSave) return
    const toSave = changed.map((code) => ({ code, draft: drafts[code] }))
    dispatch({ type: "SAVE_START", productId })
    const saved: Locale[] = []
    const failed: Locale[] = []
    for (const { code, draft } of toSave) {
      try {
        await request("/admin/chefs/translations", {
          method: "PUT",
          body: JSON.stringify({
            entity_type: "product",
            entity_id: productId,
            locale: code,
            title: draft.title,
            description: draft.description,
          }),
        })
        saved.push(code)
      } catch {
        failed.push(code)
      }
    }
    if (failed.length) {
      toast.error(`Could not save all translations. Saved: ${saved.join(", ") || "none"}. Failed: ${failed.join(", ")}`)
    } else {
      toast.success("Translations saved")
    }
    // Refetch; the reducer ignores both actions if the product changed meanwhile.
    const reqId = ++nextReqId.current
    dispatch({ type: "SAVE_DONE", productId, saved, failed, reqId })
    fetchInto(productId, reqId)
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Translations</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Arabic is the base language. Clear a title (and description) to remove that translation.
          </Text>
          {status === "error" && (
            <Text size="small" className="text-ui-fg-error">
              Could not load translations; editing and saving are disabled.{" "}
              <button type="button" className="underline" onClick={() => load(productId)}>
                Retry
              </button>
            </Text>
          )}
          {saveError && (
            <Text size="small" className="text-ui-fg-error">
              Saved: {saveError.saved.join(", ") || "none"}. Failed: {saveError.failed.join(", ")}. Save again to retry.
            </Text>
          )}
          {blank.length > 0 && (
            <Text size="small" className="text-ui-fg-error">
              A title is required when a description is set ({blank.join(", ")}).
            </Text>
          )}
        </div>
        <Button size="small" onClick={save} isLoading={status === "saving"} disabled={!canSave}>
          Save
        </Button>
      </div>
      {LOCALES.map(({ code, label, dir }) => (
        <div key={code} className="grid grid-cols-2 gap-4 px-6 py-4">
          <div className="flex flex-col gap-1">
            <Label size="small">{label} title</Label>
            <Input dir={dir} disabled={!ready} value={drafts[code].title} onChange={(e) => set(code, "title", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label size="small">{label} description</Label>
            <Input
              dir={dir}
              disabled={!ready}
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
