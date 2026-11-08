const DATE_LOCALE = 'en-GB'

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (value === null || value === undefined || value === '') return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

/** Format a date using Latin (English) digits, e.g. 04/11/2026. */
export function formatDate(
  value: unknown,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const date = toDate(value)
  if (!date) return value === null || value === undefined || value === '' ? '-' : String(value)
  return date.toLocaleDateString(DATE_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    numberingSystem: 'latn',
    ...options,
  })
}

/** Format a time using Latin (English) digits and a 24-hour clock, e.g. 14:05. */
export function formatTime(
  value: unknown,
  options: Intl.DateTimeFormatOptions = {}
): string {
  if (typeof value === 'string' && /^\d{2}:\d{2}/.test(value)) return value.slice(0, 5)
  const date = toDate(value)
  if (!date) return value === null || value === undefined || value === '' ? '-' : String(value)
  return date.toLocaleTimeString(DATE_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    numberingSystem: 'latn',
    ...options,
  })
}

/** Format a date and time using Latin (English) digits, e.g. 04/11/2026, 14:05. */
export function formatDateTime(value: unknown): string {
  const date = toDate(value)
  if (!date) return value === null || value === undefined || value === '' ? '-' : String(value)
  return `${formatDate(date)}, ${formatTime(date)}`
}

/**
 * Format a number without thousands separators and without forced decimals.
 * 18000 => "18000", 18000.5 => "18000.5", 18000.556 => "18000.56"
 */
export function formatNumber(
  value: number | string | null | undefined,
  options: Intl.NumberFormatOptions = {}
): string {
  const amount = Number(value ?? 0)
  const safe = Number.isFinite(amount) ? amount : 0
  return new Intl.NumberFormat('en-US', {
    useGrouping: false,
    numberingSystem: 'latn',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options,
  }).format(safe)
}
