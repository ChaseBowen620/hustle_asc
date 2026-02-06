/**
 * MST (America/Denver) date helpers. Backend stores naive MST strings (YYYY-MM-DDTHH:mm:ss).
 * No conversion: we display and compare these strings directly.
 */

const TIMEZONE = 'America/Denver'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Get today's date string in MST (YYYY-MM-DD) for comparison.
 */
export function getTodayMSTDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE })
}

/**
 * Is the event's date "today" in MST?
 * eventDateStr: naive MST from API, e.g. "2025-02-05T17:00:00"
 */
export function isEventTodayMST(eventDateStr) {
  if (!eventDateStr) return false
  const datePart = String(eventDateStr).slice(0, 10)
  return datePart === getTodayMSTDateString()
}

/**
 * Check if we are at least 1 hour after the event's listed time (MST).
 * eventDateStr: naive MST from API, e.g. "2025-02-05T17:00:00"
 * Uses fixed -07:00 for MST (may be 1 hr off during DST).
 */
export function isFlushDueForEvent(eventDateStr) {
  if (!eventDateStr) return false
  const withOffset = eventDateStr.includes('Z') || /[+-]\d{2}:\d{2}$/.test(eventDateStr)
    ? eventDateStr
    : eventDateStr.replace(/:\d{2}$/, ':00') + '-07:00'
  const eventTime = new Date(withOffset).getTime()
  const oneHourMs = 60 * 60 * 1000
  return Date.now() >= eventTime + oneHourMs
}

/**
 * Format a naive MST date string for display (no conversion).
 * dateStr: "YYYY-MM-DDTHH:mm:ss" from API
 */
export function formatMSTDateString(dateStr) {
  if (!dateStr) return ''
  const [datePart, timePart] = String(dateStr).split('T')
  const [y, mo, d] = (datePart || '').split('-').map(Number)
  const [h, min] = (timePart || '00:00:00').split(':').map(Number)
  if (Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(d)) return dateStr
  const month = MONTHS[mo - 1]
  const hour12 = (h % 12) || 12
  const ampm = h < 12 ? 'AM' : 'PM'
  const minStr = String(min).padStart(2, '0')
  return `${month} ${d}, ${y}, ${hour12}:${minStr} ${ampm}`
}
