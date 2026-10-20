import type { ProviderId, SearchArgs, SearchResponse } from '../../types'
import { searchAnimePictures } from './animePictures'
import { searchDanbooru } from './danbooru'
import { searchGelbooru } from './gelbooru'
import { searchMoebooru } from './moebooru'
import { searchOpenverse } from './openverse'
import { searchPixabay } from './pixabay'
import { searchRule34 } from './rule34'
import { searchWallhaven } from './wallhaven'
import { searchWikimedia } from './wikimedia'

export async function searchProvider(
  provider: ProviderId,
  args: SearchArgs,
): Promise<SearchResponse> {
  switch (provider) {
    case 'danbooru':
    case 'safebooru':
      return searchDanbooru(provider, args)
    case 'konachan':
    case 'yandere':
      return searchMoebooru(provider, args)
    case 'anime-pictures':
      return searchAnimePictures(args)
    case 'gelbooru':
      return searchGelbooru(args)
    case 'rule34':
      return searchRule34(args)
    case 'wallhaven':
      return searchWallhaven(args)
    case 'openverse':
      return searchOpenverse(args)
    case 'wikimedia':
      return searchWikimedia(args)
    case 'pixabay':
      return searchPixabay(args)
  }
}
