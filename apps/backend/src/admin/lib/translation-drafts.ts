export type Locale = "ckb" | "tk" | "en"
export type Draft = { title: string; description: string }
export type Drafts = Record<Locale, Draft>

export const LOCALE_CODES: Locale[] = ["ckb", "tk", "en"]

export const emptyDrafts = (): Drafts => ({
  ckb: { title: "", description: "" },
  tk: { title: "", description: "" },
  en: { title: "", description: "" },
})

const norm = (d: Draft) => ({ title: d.title.trim(), description: d.description.trim() })

/** Locales whose draft differs from the loaded snapshot (whitespace-insensitive). */
export const changedLocales = (snapshot: Drafts, drafts: Drafts): Locale[] =>
  LOCALE_CODES.filter((l) => {
    const a = norm(snapshot[l])
    const b = norm(drafts[l])
    return a.title !== b.title || a.description !== b.description
  })

/** Locales that have a description but no title (saving would silently delete them). */
export const blankTitleWithDescription = (drafts: Drafts): Locale[] =>
  LOCALE_CODES.filter((l) => {
    const n = norm(drafts[l])
    return !n.title && !!n.description
  })

/**
 * Widget state. All merge decisions happen inside the pure reducer from the state it
 * receives, so there is no ref/updater timing to get wrong and double application
 * (StrictMode) is harmless.
 *
 * - `snapshot`: last successfully loaded server state for `productId`.
 * - `savedPending`: locales PUT successfully since that snapshot; the next successful
 *   load gives them the server value instead of keeping the draft.
 * - `reqId`: the only load whose response is accepted; older/other-product responses are ignored.
 */
export type Status = "loading" | "ready" | "error" | "saving"
export type State = {
  productId: string
  reqId: number
  status: Status
  snapshot: Drafts
  drafts: Drafts
  savedPending: Locale[]
  saveError: { saved: Locale[]; failed: Locale[] } | null
}

export type Action =
  | { type: "RESET"; productId: string }
  | { type: "LOAD_START"; productId: string; reqId: number }
  | { type: "LOAD_OK"; productId: string; reqId: number; server: Drafts }
  | { type: "LOAD_FAIL"; productId: string; reqId: number }
  | { type: "EDIT"; locale: Locale; field: keyof Draft; value: string }
  | { type: "SAVE_START"; productId: string }
  | { type: "SAVE_DONE"; productId: string; saved: Locale[]; failed: Locale[]; reqId: number }

export const initialState = (productId: string): State => ({
  productId,
  reqId: 0,
  status: "loading",
  snapshot: emptyDrafts(),
  drafts: emptyDrafts(),
  savedPending: [],
  saveError: null,
})

const isCurrentLoad = (s: State, a: { productId: string; reqId: number }) =>
  s.status === "loading" && a.productId === s.productId && a.reqId === s.reqId

export const translationsReducer = (s: State, a: Action): State => {
  switch (a.type) {
    case "RESET":
      return initialState(a.productId)

    case "LOAD_START":
      if (a.productId !== s.productId || s.status === "saving" || (s.status === "loading" && s.reqId === a.reqId)) return s
      return { ...s, status: "loading", reqId: a.reqId }

    case "LOAD_OK": {
      if (!isCurrentLoad(s, a)) return s
      // Unsaved edits survive: every locale differing from the previous snapshot, except
      // those already saved (they take the server value). Everything else takes the server value.
      const keep = changedLocales(s.snapshot, s.drafts).filter((l) => !s.savedPending.includes(l))
      const drafts = { ...a.server }
      for (const l of keep) drafts[l] = s.drafts[l]
      return { ...s, status: "ready", snapshot: a.server, drafts, savedPending: [] }
    }

    case "LOAD_FAIL":
      if (!isCurrentLoad(s, a)) return s
      return { ...s, status: "error" }

    case "EDIT":
      if (s.status !== "ready") return s
      return { ...s, drafts: { ...s.drafts, [a.locale]: { ...s.drafts[a.locale], [a.field]: a.value } } }

    case "SAVE_START":
      if (s.status !== "ready" || a.productId !== s.productId) return s
      return { ...s, status: "saving", saveError: null }

    case "SAVE_DONE": {
      if (s.status !== "saving" || a.productId !== s.productId) return s
      const savedPending = [...s.savedPending, ...a.saved.filter((l) => !s.savedPending.includes(l))]
      return {
        ...s,
        status: "loading",
        reqId: a.reqId,
        savedPending,
        saveError: a.failed.length ? { saved: a.saved, failed: a.failed } : null,
      }
    }
  }
}
