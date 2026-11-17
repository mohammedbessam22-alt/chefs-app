import { normalizeRoundTimes, validateSettingsForm, serverErrorLines, formFromSettings } from "../chefs-settings"

const form = (o: any = {}) => ({
  whatsapp_number: "07700000000",
  round_times: ["14:00", "10:00"],
  cutoff_minutes: "30",
  auto_cancel_minutes: "60",
  ...o,
})

describe("normalizeRoundTimes", () => {
  it("trims, drops blanks, dedupes and sorts", () => {
    expect(normalizeRoundTimes([" 14:00", "10:00", "14:00", ""])).toEqual({ times: ["10:00", "14:00"], invalid: [] })
  })
  it("reports invalid entries", () => {
    expect(normalizeRoundTimes(["25:00", "9:30", "10:00"]).invalid).toEqual(["25:00", "9:30"])
  })
})

describe("validateSettingsForm", () => {
  it("returns a numeric normalised payload", () => {
    expect(validateSettingsForm(form())).toEqual({
      ok: true,
      payload: { whatsapp_number: "07700000000", round_times: ["10:00", "14:00"], cutoff_minutes: 30, auto_cancel_minutes: 60 },
    })
  })
  it("rejects bad numbers, empty phone and bad times", () => {
    const r: any = validateSettingsForm(form({ whatsapp_number: " ", cutoff_minutes: "-1", auto_cancel_minutes: "1.5", round_times: ["99:99"] }))
    expect(r.ok).toBe(false)
    expect(Object.keys(r.errors).sort()).toEqual(["auto_cancel_minutes", "cutoff_minutes", "round_times", "whatsapp_number"])
  })
  it("enforces auto-cancel 15..1440 and cut-off 0..720", () => {
    const errs = (o: any) => (validateSettingsForm(form(o)) as any).errors ?? {}
    expect(errs({ auto_cancel_minutes: "0" }).auto_cancel_minutes).toMatch(/15.*1440/)
    expect(errs({ auto_cancel_minutes: "1441" }).auto_cancel_minutes).toMatch(/15.*1440/)
    expect(errs({ cutoff_minutes: "721" }).cutoff_minutes).toMatch(/0.*720/)
    expect(validateSettingsForm(form({ auto_cancel_minutes: "15", cutoff_minutes: "0" })).ok).toBe(true)
    expect(validateSettingsForm(form({ auto_cancel_minutes: "1440", cutoff_minutes: "720" })).ok).toBe(true)
  })
  it("rejects empty numeric strings", () => {
    expect((validateSettingsForm(form({ cutoff_minutes: "" })) as any).errors.cutoff_minutes).toBeTruthy()
  })
})

describe("serverErrorLines", () => {
  it("extracts zod issues from a JSON message", () => {
    const msg = JSON.stringify([{ path: ["round_times", 0], message: "Invalid" }, { path: ["whatsapp_number"], message: "invalid_phone" }])
    expect(serverErrorLines({ message: msg })).toEqual(["round_times.0: Invalid", "WhatsApp number: not a valid Iraqi mobile number (e.g. 07701234567)"])
  })
  it("falls back to the raw message", () => {
    expect(serverErrorLines({ message: "boom" })).toEqual(["boom"])
    expect(serverErrorLines({})).toEqual(["Request failed"])
  })
})

describe("formFromSettings", () => {
  it("stringifies numbers and tolerates missing fields", () => {
    expect(formFromSettings({ whatsapp_number: "x", round_times: ["10:00"], cutoff_minutes: 30, auto_cancel_minutes: 0 })).toEqual({
      whatsapp_number: "x", round_times: ["10:00"], cutoff_minutes: "30", auto_cancel_minutes: "0",
    })
    expect(formFromSettings({}).round_times).toEqual([])
  })
})

describe("invalid_phone message", () => {
  it("is friendly", () => {
    expect(serverErrorLines({ message: JSON.stringify([{ path: ["whatsapp_number"], message: "invalid_phone" }]) })[0]).toMatch(/valid Iraqi mobile/)
  })
})
