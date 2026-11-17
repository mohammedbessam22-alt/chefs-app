import { blankTitleWithDescription, changedLocales, mergeAfterSave, type Drafts } from "../translation-drafts"

const d = (o: Partial<Drafts> = {}): Drafts => ({
  ckb: { title: "", description: "" },
  tk: { title: "", description: "" },
  en: { title: "", description: "" },
  ...o,
})

describe("changedLocales", () => {
  it("is empty when nothing differs", () => {
    expect(changedLocales(d(), d())).toEqual([])
  })
  it("returns only locales whose title or description differ", () => {
    const snap = d({ en: { title: "A", description: "" } })
    const now = d({ en: { title: "A", description: "x" }, tk: { title: "T", description: "" } })
    expect(changedLocales(snap, now)).toEqual(["tk", "en"])
  })
  it("ignores surrounding whitespace-only differences", () => {
    expect(changedLocales(d({ en: { title: "A", description: "" } }), d({ en: { title: " A ", description: "" } }))).toEqual([])
  })
})

describe("blankTitleWithDescription", () => {
  it("lists locales with a description but blank title", () => {
    expect(
      blankTitleWithDescription(d({ ckb: { title: " ", description: "x" }, en: { title: "E", description: "y" } }))
    ).toEqual(["ckb"])
  })
  it("is empty when both blank", () => {
    expect(blankTitleWithDescription(d())).toEqual([])
  })
})

describe("mergeAfterSave", () => {
  const server = d({ ckb: { title: "K", description: "" }, tk: { title: "old", description: "" } })
  const drafts = d({ ckb: { title: "K", description: "" }, tk: { title: "new tk", description: "d" }, en: { title: "E", description: "" } })

  it("keeps the draft for failed locales and takes server value for the rest", () => {
    // en saved (server now has it), tk failed
    const srv = d({ ...server, en: { title: "E", description: "" } })
    const merged = mergeAfterSave(srv, drafts, ["tk"])
    expect(merged.tk).toEqual({ title: "new tk", description: "d" })
    expect(merged.en).toEqual({ title: "E", description: "" })
    expect(merged.ckb).toEqual(srv.ckb)
  })
  it("leaves exactly the failed locales as changed against the new snapshot", () => {
    const srv = d({ ...server, en: { title: "E", description: "" } })
    expect(changedLocales(srv, mergeAfterSave(srv, drafts, ["tk"]))).toEqual(["tk"])
  })
  it("equals the server state when nothing failed", () => {
    expect(mergeAfterSave(server, drafts, [])).toEqual(server)
  })
})
