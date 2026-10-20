import type { SearchArgs } from '../../../types'

export function makeArgs(overrides: Partial<SearchArgs> = {}): SearchArgs {
  return {
    query: '',
    page: 1,
    perPage: 28,
    quality: 'general',
    nsfw: true,
    blacklist: { tags: [], keywords: [] },
    proxyUrl: '',
    signal: new AbortController().signal,
    ...overrides,
  }
}

/** URL efectiva de la última petición a `fetch`. */
export function lastRequestUrl(fetchMock: { mock: { calls: unknown[][] } }): URL {
  const calls = fetchMock.mock.calls
  const url = calls[calls.length - 1]?.[0] as string
  return new URL(url, 'http://localhost')
}
