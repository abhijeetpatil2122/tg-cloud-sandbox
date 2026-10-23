/**
 * Scheme-less input ("t.me/channel", "example.com") gets https:// prepended
 * instead of being rejected; anything that already has a scheme
 * (https:, http:, tg:, mailto:…) is left alone. Used by both the inline
 * Link mark and the button editor so they can't disagree about what a
 * "valid enough" URL is.
 */
export function normalizeUrl(raw) {
  const trimmed = (raw || '').trim()
  if (!trimmed) return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}
