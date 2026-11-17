// Thin fetch wrapper for the admin chefs routes. Resolves with status + parsed body (never throws on HTTP errors).
export type ApiResult<T = any> = { ok: boolean; status: number; body: T }

export async function chefsFetch<T = any>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  const res = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init })
  let body: any = {}
  try {
    body = await res.json()
  } catch {
    /* empty or non-JSON body */
  }
  return { ok: res.ok, status: res.status, body }
}
