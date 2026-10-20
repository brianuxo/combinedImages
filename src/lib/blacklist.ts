import type { ImageItem } from '../types'

export function cleanTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, '_')
}

export function toBooruExclusions(tags: string[]): string[] {
  return tags
    .map(cleanTag)
    .filter(Boolean)
    .map((tag) => `-${tag}`)
}

export function isBlacklisted(
  item: ImageItem,
  blacklist: { tags: string[]; keywords: string[] },
): boolean {
  const tags = item.tags.map((tag) => tag.toLowerCase())
  const haystack = [tags.join(' '), item.title ?? '', item.author ?? '']
    .join(' ')
    .toLowerCase()

  const tagHit = blacklist.tags.some((entry) => {
    const needle = cleanTag(entry)
    if (!needle) return false
    return tags.some((tag) => tag === needle || tag.startsWith(`${needle}:`))
  })
  if (tagHit) return true

  return blacklist.keywords.some((entry) => {
    const needle = entry.trim().toLowerCase()
    return needle.length > 0 && haystack.includes(needle)
  })
}
