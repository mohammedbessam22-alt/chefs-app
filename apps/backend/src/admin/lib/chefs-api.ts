// Thin fetch wrapper for the admin chefs routes. Resolves with status + parsed body; never throws.
// A network failure resolves as { ok: false, status: 0 }.
export type ApiResult<T = any> = { ok: boolean; status: number; body: T }

export async function chefsFetch<T = any>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init })
    let body: any = {}
    try {
      body = await res.json()
    } catch {
      /* empty or non-JSON body */
    }
    return { ok: res.ok, status: res.status, body }
  } catch {
    return { ok: false, status: 0, body: {} as T }
  }
}
