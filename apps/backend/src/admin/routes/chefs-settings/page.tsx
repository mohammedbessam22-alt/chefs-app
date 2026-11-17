import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Button, Container, Heading, Input, Label, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { chefsFetch } from "../../lib/chefs-api"
import { formFromSettings, serverErrorLines, validateSettingsForm, type SettingsForm } from "../../lib/chefs-settings"

// The form is loaded once and never refreshed in the background, so edits are never overwritten.
const SettingsPage = () => {
  const [form, setForm] = useState<SettingsForm | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof SettingsForm, string>>>({})
  const [serverErrors, setServerErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoadError(false)
    const r = await chefsFetch("/admin/chefs/settings")
    if (r.ok) setForm(formFromSettings(r.body))
    else setLoadError(true)
  }
  useEffect(() => {
    load()
  }, [])

  if (!form) {
    return (
      <Container>
        {loadError ? (
          <Text className="text-ui-fg-error">
            Could not load settings.{" "}
            <button type="button" className="underline" onClick={load}>
              Retry
            </button>
          </Text>
        ) : (
          <Text className="text-ui-fg-subtle">Loading...</Text>
        )}
      </Container>
    )
  }

  const set = <K extends keyof SettingsForm>(k: K, v: SettingsForm[K]) => setForm({ ...form, [k]: v })
  const setTime = (i: number, v: string) => set("round_times", form.round_times.map((t, idx) => (idx === i ? v : t)))

  const save = async () => {
    setServerErrors([])
    const v = validateSettingsForm(form)
    if (!v.ok) {
      setFieldErrors(v.errors)
      return
    }
    setFieldErrors({})
    setSaving(true)
    const r = await chefsFetch("/admin/chefs/settings", { method: "POST", body: JSON.stringify(v.payload) })
    setSaving(false)
    if (r.ok) {
      setForm(formFromSettings(r.body))
      toast.success("Delivery settings saved")
    } else if (r.status === 400) {
      setServerErrors(serverErrorLines(r.body))
    } else {
      setServerErrors(["Could not save settings - try again"])
    }
  }

  const err = (k: keyof SettingsForm) =>
    fieldErrors[k] ? (
      <Text size="small" className="text-ui-fg-error">
        {fieldErrors[k]}
      </Text>
    ) : null

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading>Delivery settings</Heading>
        <Button size="small" onClick={save} isLoading={saving}>
          Save
        </Button>
      </div>
      {serverErrors.length > 0 && (
        <div className="px-6 py-3" role="alert">
          {serverErrors.map((l, i) => (
            <Text key={i} size="small" className="text-ui-fg-error">
              {l}
            </Text>
          ))}
        </div>
      )}
      <div className="flex max-w-xl flex-col gap-1 px-6 py-4">
        <Label size="small">WhatsApp number</Label>
        <Input dir="ltr" value={form.whatsapp_number} onChange={(e) => set("whatsapp_number", e.target.value)} />
        {err("whatsapp_number")}
      </div>
      <div className="flex max-w-xl flex-col gap-2 px-6 py-4">
        <Label size="small">Round times (HH:MM, Baghdad time)</Label>
        {form.round_times.map((t, i) => (
          <div key={i} className="flex gap-2">
            <Input dir="ltr" placeholder="10:00" value={t} onChange={(e) => setTime(i, e.target.value)} />
            <Button size="small" variant="secondary" onClick={() => set("round_times", form.round_times.filter((_, idx) => idx !== i))}>
              Remove
            </Button>
          </div>
        ))}
        <div>
          <Button size="small" variant="secondary" onClick={() => set("round_times", [...form.round_times, ""])}>
            Add round
          </Button>
        </div>
        {err("round_times")}
      </div>
      <div className="flex max-w-xl flex-col gap-1 px-6 py-4">
        <Label size="small">Order cut-off (minutes before a round)</Label>
        <Input inputMode="numeric" value={form.cutoff_minutes} onChange={(e) => set("cutoff_minutes", e.target.value)} />
        {err("cutoff_minutes")}
      </div>
      <div className="flex max-w-xl flex-col gap-1 px-6 py-4">
        <Label size="small">Auto-cancel unconfirmed orders after (minutes)</Label>
        <Input inputMode="numeric" value={form.auto_cancel_minutes} onChange={(e) => set("auto_cancel_minutes", e.target.value)} />
        {err("auto_cancel_minutes")}
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({ label: "Delivery settings" })
export default SettingsPage
