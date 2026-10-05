// Turns a phone number as typed by a member ("082 123 4567", "+27 82 123 4567",
// "0027821234567") into the digits-only international form WhatsApp's wa.me
// links need ("27821234567"). Local numbers starting with 0 are assumed to be
// South African. Returns null when it can't be a usable number.
const DEFAULT_COUNTRY_CODE = '27'

export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null
  const trimmed = phone.trim()
  let digits = trimmed.replace(/\D/g, '')
  if (!digits) return null
  if (trimmed.startsWith('+')) {
    // already international
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2)
  } else if (digits.startsWith('0')) {
    digits = DEFAULT_COUNTRY_CODE + digits.slice(1)
  }
  // E.164 numbers are at most 15 digits; anything under 9 can't be a full number.
  if (digits.length < 9 || digits.length > 15) return null
  return digits
}

export function whatsAppUrl(phone: string | null | undefined, message?: string): string | null {
  const number = toWhatsAppNumber(phone)
  if (!number) return null
  return `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ''}`
}
