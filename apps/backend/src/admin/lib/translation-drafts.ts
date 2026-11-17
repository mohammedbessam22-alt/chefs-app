export type Locale = "ckb" | "tk" | "en"
export type Draft = { title: string; description: string }
export type Drafts = Record<Locale, Draft>

export const LOCALE_CODES: Locale[] = ["ckb", "tk", "en"]

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

/** After a save: server state for saved/untouched locales, the user's draft for failed ones. */
export const mergeAfterSave = (server: Drafts, drafts: Drafts, failed: Locale[]): Drafts => {
  const out = { ...server }
  for (const l of failed) out[l] = drafts[l]
  return out
}
