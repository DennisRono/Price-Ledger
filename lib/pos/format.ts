// Formatting + small math helpers. Everything money-related works in integer
// cents and only converts to a display string at the edge.

export function money(cents: number | null | undefined): string {
  const v = typeof cents === "number" && Number.isFinite(cents) ? cents : 0
  const sign = v < 0 ? "-" : ""
  const abs = Math.abs(v)
  return `${sign}$${(abs / 100).toFixed(2)}`
}

// Parse a free-form money string (e.g. "12.50", "1250" cents from keypad) into cents.
export function dollarsToCents(input: string | number): number {
  if (typeof input === "number") return Math.round(input * 100)
  const cleaned = input.replace(/[^0-9.]/g, "")
  if (!cleaned) return 0
  const value = Number.parseFloat(cleaned)
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100)
}

// Keypad mode: digits typed accumulate as cents (e.g. "1","2","5" -> 125 -> $1.25)
export function keypadToCents(digits: string): number {
  const cleaned = digits.replace(/[^0-9]/g, "")
  if (!cleaned) return 0
  const value = Number.parseInt(cleaned, 10)
  return Number.isFinite(value) ? value : 0
}

export function gallons(n: number | null | undefined): string {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0
  return v.toFixed(3)
}

export function dateTime(ts: number | null | undefined): string {
  if (!ts || !Number.isFinite(ts)) return "—"
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return "—"
  }
}

export function timeOnly(ts: number | null | undefined): string {
  if (!ts || !Number.isFinite(ts)) return "—"
  try {
    return new Date(ts).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return "—"
  }
}

export function dateOnly(ts: number | null | undefined): string {
  if (!ts || !Number.isFinite(ts)) return "—"
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return "—"
  }
}

let idCounter = 0
export function uid(prefix = "id"): string {
  idCounter += 1
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now().toString(36)}_${idCounter}_${rand}`
}

export function pct(value: number): string {
  return `${(value * 100).toFixed(value * 100 % 1 === 0 ? 0 : 2)}%`
}
