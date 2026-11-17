import { blankTitleWithDescription, changedLocales, type Drafts } from "../translation-drafts"

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
