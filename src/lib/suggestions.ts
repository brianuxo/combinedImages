import type { ProviderId } from '../types'

/**
 * Sugerencias de tags para los buscadores y los filtros.
 *
 * Se combinan dos fuentes: una lista curada de tags y artistas populares (para
 * que la primera búsqueda ya proponga algo útil) y un "pool" con lo que el
 * usuario ha visto en la sesión, que gana peso a medida que se repite.
 *
 * El ranking premia, en este orden: empieza por lo escrito, alguna palabra
 * empieza por lo escrito, lo contiene. Después van los tags curados (en el
 * orden de la lista) y, entre lo aprendido en la sesión, lo más visto.
 */

const BOORU_SEEDS = [
  'ia_generated',
  'wuthering_waves',
  'widowmaker',
  'hatsune_miku',
  'original',
  '1girl',
  '1boy',
  'solo',
  'multiple_girls',
  'couple',
  'landscape',
  'scenic',
  'sky',
  'clouds',
  'night',
  'sunset',
  'city',
  'cyberpunk',
  'portrait',
  'upper_body',
  'full_body',
  'looking_at_viewer',
  'long_hair',
  'short_hair',
  'twintails',
  'blue_eyes',
  'red_eyes',
  'smile',
  'kimono',
  'swimsuit',
  'school_uniform',
  'armor',
  'sword',
  'wings',
  'flowers',
  'rain',
  'genshin_impact',
  'honkai_star_rail',
  'arknights',
  'blue_archive',
  'azur_lane',
  'fate_grand_order',
  'vocaloid',
  'touhou',
  'kantai_collection',
  'overwatch',
  'league_of_legends',
  'nier_automata',
  'evangelion',
  'wlop',
  'kantoku',
  'hiten',
  'anmi',
  'loundraw',
  'redjuice',
  'mika_pikazo',
  'guweiz',
  'sakimichan',
  'ciloranko',
  'yuumei',
  'ask_(askzy)',
]

const QUERY_SEEDS = [
  'wallpaper',
  'landscape',
  'mountain',
  'sunset',
  'sunrise',
  'ocean',
  'forest',
  'city',
  'night',
  'cyberpunk',
  'abstract',
  'minimal',
  'space',
  'aurora',
  'portrait',
  'anime',
  'illustration',
  'architecture',
  'flowers',
  'desert',
  'snow',
  'rain',
]

/** Fuentes que buscan texto libre en lugar de tags. */
const QUERY_PROVIDERS: ProviderId[] = ['wallhaven', 'openverse', 'wikimedia', 'pixabay']

/** Fuentes cuya búsqueda son tags con guiones bajos. */
const TAG_PROVIDERS: ProviderId[] = [
  'danbooru',
  'safebooru',
  'konachan',
  'yandere',
  'anime-pictures',
  'gelbooru',
  'rule34',
]

/**
 * En los Moebooru (Konachan, Yande.re) `author` es quien subió la imagen, no
 * el artista, y esos nombres se buscan con el filtro `user:`.
 */
const UPLOADER_PROVIDERS: ProviderId[] = ['konachan', 'yandere']

/** Tope de memoria: por encima de esto dejamos de aprender tags nuevos. */
const POOL_LIMIT = 20000

/** Cuántas veces se ha visto cada tag en esta sesión. */
const pool = new Map<string, number>()

export interface SuggestOptions {
  provider: ProviderId
  limit?: number
}

/** Guarda los tags que el usuario ya ha visto para proponerlos antes. */
export function rememberTags(tags: Iterable<string>): void {
  for (const tag of tags) {
    const clean = tag.trim().toLowerCase()
    if (!clean) continue
    const hits = pool.get(clean)
    if (hits === undefined && pool.size >= POOL_LIMIT) continue
    pool.set(clean, (hits ?? 0) + 1)
  }
}

export function rememberedTags(): string[] {
  return [...pool.keys()]
}

/** Solo para pruebas: olvida lo aprendido en la sesión. */
export function resetRememberedTags(): void {
  pool.clear()
}

export function seedsFor(provider: ProviderId): string[] {
  return QUERY_PROVIDERS.includes(provider) ? QUERY_SEEDS : BOORU_SEEDS
}

interface Candidate {
  tag: string
  /** Posición en la lista curada: menos es más popular. */
  rank: number
  hits: number
  /** Los curados van antes que lo aprendido en la sesión. */
  curated: boolean
}

function candidates(provider: ProviderId): Candidate[] {
  const seeds = seedsFor(provider)
  const list: Candidate[] = seeds.map((tag, index) => ({
    tag,
    rank: index,
    hits: 0,
    curated: true,
  }))
  const index = new Map(list.map((entry) => [entry.tag, entry]))

  for (const [tag, hits] of pool) {
    const known = index.get(tag)
    if (known) {
      known.hits = hits
      continue
    }
    list.push({ tag, rank: seeds.length, hits, curated: false })
  }

  return list
}

/** Texto comparable: sin mayúsculas y con `_` como espacio. */
export function normalizeTag(text: string): string {
  return text.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
}

/** El texto que se muestra en la interfaz (más legible que el tag). */
export function displayTag(tag: string): string {
  return tag.replace(/_/g, ' ')
}

/**
 * Puntúa un tag contra lo escrito. `null` significa que no encaja.
 *
 * - 0: el tag empieza por lo escrito (`ia` → `ia_generated`)
 * - 1: alguna palabra del tag empieza por lo escrito (`waves` → `wuthering_waves`)
 * - 2: lo contiene en cualquier posición
 */
export function tagScore(tag: string, fragment: string): number | null {
  const needle = normalizeTag(fragment)
  if (!needle) return null

  const haystack = normalizeTag(tag)
  if (haystack === needle) return null
  if (haystack.startsWith(needle)) return 0
  if (haystack.split(' ').some((word) => word.startsWith(needle))) return 1
  if (haystack.includes(needle)) return 2
  return null
}

/** Último término que está escribiendo el usuario (`landscape w` → `w`). */
export function lastToken(input: string): string {
  const parts = input.split(/\s+/)
  return parts[parts.length - 1] ?? ''
}

/** Sustituye el último término por la sugerencia elegida. */
export function completeTag(input: string, suggestion: string): string {
  const trimmed = input.trimEnd()
  if (!trimmed) return suggestion

  // Si venía de escribir un espacio, la sugerencia es un término nuevo.
  if (trimmed.length < input.length) return `${trimmed} ${suggestion}`

  const parts = trimmed.split(/\s+/)
  parts[parts.length - 1] = suggestion
  return parts.join(' ')
}

export function suggestTags(input: string, options: SuggestOptions): string[] {
  const fragment = lastToken(input)
  if (!fragment) return []

  const limit = options.limit ?? 8
  const scored: { candidate: Candidate; score: number }[] = []

  for (const candidate of candidates(options.provider)) {
    const score = tagScore(candidate.tag, fragment)
    if (score === null) continue
    scored.push({ candidate, score })
  }

  scored.sort(
    (a, b) =>
      a.score - b.score ||
      Number(b.candidate.curated) - Number(a.candidate.curated) ||
      b.candidate.hits - a.candidate.hits ||
      a.candidate.rank - b.candidate.rank ||
      a.candidate.tag.length - b.candidate.tag.length ||
      a.candidate.tag.localeCompare(b.candidate.tag),
  )

  const seen = new Set<string>()
  const result: string[] = []
  for (const entry of scored) {
    if (seen.has(entry.candidate.tag)) continue
    seen.add(entry.candidate.tag)
    result.push(entry.candidate.tag)
    if (result.length >= limit) break
  }

  return result
}

export interface Highlight {
  before: string
  match: string
  after: string
}

/**
 * Trocea un tag para resaltar la parte que coincide con lo escrito. Se opera
 * sobre el texto visible (con espacios), pero `_` y el espacio ocupan un
 * carácter cada uno, así que los índices sirven sobre el tag original.
 */
export function highlightTag(tag: string, fragment: string): Highlight | null {
  const needle = normalizeTag(fragment)
  if (!needle) return null

  const visible = displayTag(tag)
  const index = visible.toLowerCase().indexOf(needle)
  if (index < 0) return null

  return {
    before: visible.slice(0, index),
    match: visible.slice(index, index + needle.length),
    after: visible.slice(index + needle.length),
  }
}

/**
 * Convierte el nombre de un autor en la búsqueda que entiende cada fuente.
 *
 * - Danbooru y Safebooru: el autor es un tag de artista (`wlop`,
 *   `ask_(askzy)`), así que los espacios vuelven a ser guiones bajos.
 * - Konachan y Yande.re: el autor es quien subió la imagen; se filtra con
 *   `user:nombre`.
 * - Fuentes de texto libre: se busca el nombre tal cual.
 */
export function authorQuery(author: string, provider: ProviderId): string {
  const clean = author.trim().replace(/\s+/g, ' ')
  if (!clean) return ''
  if (UPLOADER_PROVIDERS.includes(provider)) return `user:${clean.replace(/ /g, '_')}`
  return TAG_PROVIDERS.includes(provider) ? clean.replace(/ /g, '_') : clean
}
