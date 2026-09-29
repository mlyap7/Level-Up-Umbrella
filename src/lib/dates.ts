// All "dates" in this app are calendar days in the user's local time zone,
// stored as YYYY-MM-DD strings. Never use toISOString() for these: it converts
// to UTC and can shift the day.

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  const ms = parseISODate(b).getTime() - parseISODate(a).getTime()
  return Math.round(ms / 86_400_000)
}

/** Monday of the week containing the given date. */
export function weekStart(iso: string): string {
  const d = parseISODate(iso)
  const dow = (d.getDay() + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - dow)
  return toISODate(d)
}

const dayFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const fullFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

export function formatDay(iso: string): string {
  return dayFmt.format(parseISODate(iso))
}

const shortFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

/** Compact date for tables, e.g. "Tue, Sep 29". */
export function formatShortDate(iso: string): string {
  return shortFmt.format(parseISODate(iso))
}

export function formatFullDate(iso: string): string {
  return fullFmt.format(parseISODate(iso))
}

export function formatWeekOf(iso: string): string {
  return `Week of ${formatDay(iso)}`
}

export function relativeDays(iso: string, today = todayISO()): string {
  const n = daysBetween(iso, today)
  if (n <= 0) return 'today'
  if (n === 1) return 'yesterday'
  return `${n} days ago`
}
