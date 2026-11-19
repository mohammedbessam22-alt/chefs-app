export function normalizeIraqiPhone(input: string): string {
  let digits = String(input ?? "").replace(/[\s\-().]/g, "")
  if (digits.startsWith("+")) digits = digits.slice(1)
  if (digits.startsWith("00964")) digits = digits.slice(2)
  if (digits.startsWith("0")) digits = "964" + digits.slice(1)
  if (!/^9647\d{9}$/.test(digits)) throw new Error("invalid_phone")
  return digits
}
