// Input sanitization for all IPC payloads.
// All handlers call these before touching the DB or filesystem.

const SAFE_PROTOCOLS = ['https:', 'http:', 'ftp:', 'ssh:', 'file:']

// Strip control characters and trim whitespace
export function sanitizeString(value: unknown, maxLength = 1000): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/[\x00-\x1F\x7F]/g, '') // strip control chars
    .trim()
    .slice(0, maxLength)
}

// Validates a URL string — must have a safe protocol
export function sanitizeUrl(value: unknown): string {
  const str = sanitizeString(value, 2048)
  try {
    const url = new URL(str)
    if (!SAFE_PROTOCOLS.includes(url.protocol)) return ''
    return str
  } catch {
    return '' // malformed URL
  }
}

// Validates a filesystem path — rejects obvious traversal attempts
export function sanitizePath(value: unknown): string {
  const str = sanitizeString(value, 2048)
  if (str.includes('\0')) return ''              // null byte injection
  if (/\.\.[/\\]/.test(str)) return ''          // path traversal
  return str
}

// Validates a UUID v4 string
export function sanitizeId(value: unknown): string {
  const str = sanitizeString(value, 36)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str)) {
    return ''
  }
  return str
}

// Validates a hex color string
export function sanitizeColor(value: unknown): string {
  const str = sanitizeString(value, 9)
  if (!/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(str)) return '#6366f1' // fallback to default
  return str
}

// Validates item type enum
export function sanitizeItemType(value: unknown): string {
  const allowed = ['url', 'software', 'folder', 'command', 'action']
  const str = sanitizeString(value, 10)
  return allowed.includes(str) ? str : ''
}

// Validates action_id — allows any non-empty string (predefined keys + 'custom')
export function sanitizeActionId(value: unknown): string {
  return sanitizeString(value, 50)
}

// Validates icon source enum
export function sanitizeIconSource(value: unknown): string {
  const allowed = ['auto', 'favicon', 'custom', 'url-icon', 'b64-icon', 'emoji', 'library']
  const str = sanitizeString(value, 10)
  return allowed.includes(str) ? str : 'auto'
}
