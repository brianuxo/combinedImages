// La extensión `.ts` es explícita porque este archivo lo compilan el proyecto
// de la app y el de Node, y el segundo (`nodenext`) no admite importaciones
// sin extensión.
import type { ProviderId } from '../types.ts'

export function buildProxyUrl(template: string, target: string): string {
  if (template.includes('{url}')) {
    return template.replace('{url}', encodeURIComponent(target))
  }
  const separator = template.includes('?') ? '&' : '?'
  return `${template}${separator}url=${encodeURIComponent(target)}`
}

export interface ProxyRoute {
  /** Origen público al que apunta la ruta. */
  origin: string
  /** Ruta del proxy dentro del mismo origen donde se sirve la app. */
  path: string
}

/**
 * Rutas que reenvía el servidor de Vite, tanto en `dev` como en `preview`.
 *
 * Sirven para el JSON de las APIs que no mandan CORS, pero también para las
 * imágenes: al pasar por el mismo origen que la app, el navegador deja
 * leerlas y se pueden descargar sin salir de la aplicación.
 */
export const PROXY_ROUTES: Partial<Record<ProviderId, ProxyRoute[]>> = {
  konachan: [{ origin: 'https://konachan.com', path: '/proxy/konachan' }],
  yandere: [
    { origin: 'https://yande.re', path: '/proxy/yandere' },
    // Las imágenes no están en el host de la API.
    { origin: 'https://files.yande.re', path: '/proxy/yandere-files' },
    { origin: 'https://assets.yande.re', path: '/proxy/yandere-assets' },
  ],
  'anime-pictures': [
    { origin: 'https://api.anime-pictures.net', path: '/proxy/anime-pictures' },
  ],
  gelbooru: [{ origin: 'https://gelbooru.com', path: '/proxy/gelbooru' }],
  wallhaven: [{ origin: 'https://wallhaven.cc', path: '/proxy/wallhaven' }],
}

/** Origen de la API de una fuente. */
export function apiOrigin(provider: ProviderId): string | undefined {
  return PROXY_ROUTES[provider]?.[0]?.origin
}

/** Ruta del proxy que sirve el JSON de la API de una fuente. */
export function apiRoute(provider: ProviderId): ProxyRoute | undefined {
  return PROXY_ROUTES[provider]?.[0]
}

/**
 * URLs del mismo origen que sirven el mismo recurso.
 *
 * Se usan cuando el servidor de la imagen no manda cabeceras CORS y el
 * navegador no deja leer el binario (Konachan y Yande.re, por ejemplo). Como
 * las imágenes de esas fuentes están en el mismo host que su API, la ruta del
 * proxy devuelve el archivo original intacto.
 */
export function sameOriginUrls(provider: ProviderId, url: string): string[] {
  const routes = PROXY_ROUTES[provider] ?? []
  return routes
    .filter((route) => url.startsWith(route.origin))
    .map((route) => route.path + url.slice(route.origin.length))
}