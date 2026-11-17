// Pure helpers for the Delivery settings page (unit-tested).
export type SettingsForm = {
  whatsapp_number: string
  round_times: string[]
  cutoff_minutes: string
  auto_cancel_minutes: string
}
export type SettingsPayload = { whatsapp_number: string; round_times: string[]; cutoff_minutes: number; auto_cancel_minutes: number }

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

export function normalizeRoundTimes(input: string[]): { times: string[]; invalid: string[] } {
  const invalid: string[] = []
  const ok = new Set<string>()
  for (const raw of input) {
    const t = raw.trim()
    if (!t) continue
    if (HHMM.test(t)) ok.add(t)
    else invalid.push(t)
  }
  return { times: [...ok].sort(), invalid }
}

const nonNegInt = (s: string) => /^\d+$/.test(s.trim())

export function validateSettingsForm(
  f: SettingsForm
): { ok: true; payload: SettingsPayload } | { ok: false; errors: Partial<Record<keyof SettingsForm, string>> } {
  const errors: Partial<Record<keyof SettingsForm, string>> = {}
  if (!f.whatsapp_number.trim()) errors.whatsapp_number = "WhatsApp number is required"
  const { times, invalid } = normalizeRoundTimes(f.round_times)
  if (invalid.length) errors.round_times = `Invalid time (use HH:MM, 24h): ${invalid.join(", ")}`
  if (!nonNegInt(f.cutoff_minutes)) errors.cutoff_minutes = "Enter a whole number of minutes (0 or more)"
  if (!nonNegInt(f.auto_cancel_minutes)) errors.auto_cancel_minutes = "Enter a whole number of minutes (0 or more)"
  if (Object.keys(errors).length) return { ok: false, errors }
  return {
    ok: true,
    payload: {
      whatsapp_number: f.whatsapp_number.trim(),
      round_times: times,
      cutoff_minutes: Number(f.cutoff_minutes),
      auto_cancel_minutes: Number(f.auto_cancel_minutes),
    },
  }
}

/** Server 400s carry a zod issue array (JSON) in `message`; show each issue on its own line. */
export function serverErrorLines(body: any): string[] {
  const msg = body?.message
  if (typeof msg !== "string" || !msg) return ["Request failed"]
  try {
    const issues = JSON.parse(msg)
    if (Array.isArray(issues) && issues.length) {
      return issues.map((i: any) =>
        i.message === "invalid_phone"
          ? "WhatsApp number: not a valid Iraqi mobile number (e.g. 07701234567)"
          : `${(i.path ?? []).join(".")}${i.path?.length ? ": " : ""}${i.message}`
      )
    }
  } catch {
    /* not JSON */
  }
  return [msg]
}

export function formFromSettings(s: any): SettingsForm {
  return {
    whatsapp_number: s?.whatsapp_number ?? "",
    round_times: Array.isArray(s?.round_times) ? [...s.round_times] : [],
    cutoff_minutes: s?.cutoff_minutes === undefined || s?.cutoff_minutes === null ? "" : String(s.cutoff_minutes),
    auto_cancel_minutes: s?.auto_cancel_minutes === undefined || s?.auto_cancel_minutes === null ? "" : String(s.auto_cancel_minutes),
  }
}
