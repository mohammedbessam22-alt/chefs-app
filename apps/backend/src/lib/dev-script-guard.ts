/** Pure decision for src/scripts/dev-place-order.ts: returns a refusal reason, or null when allowed. */
export function devScriptRefusal(env: Record<string, string | undefined>, dbName: string, baseUrl: string): string | null {
  if (env.CHEFS_DEV_SCRIPT !== "1") return "set CHEFS_DEV_SCRIPT=1 to opt in"
  if (env.NODE_ENV === "production") return "NODE_ENV is production"
  if (!/(^|_)(dev|test)$/.test(dbName) && !/_dev(_|$)/.test(dbName)) return `database "${dbName}" is not a dev database`
  let port = ""
  try {
    const u = new URL(baseUrl)
    port = u.port || (u.protocol === "https:" ? "443" : "80")
  } catch {
    return "BASE_URL is not a valid URL"
  }
  if (port === "9000" || port === "9100") return `BASE_URL port ${port} is reserved for production/staging`
  return null
}
