/** Empty website is allowed; otherwise require http(s) URL. */
export function isValidWebsiteUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

export const WEBSITE_URL_ERROR =
  'Website URL is not valid. Use a complete URL starting with https:// or leave it empty.'
