# Combined

SPA para explorar y descargar imágenes y fondos de pantalla de varias fuentes desde un solo lugar. Sin backend, sin cuentas y con los ajustes guardados en el navegador.

![stack](https://img.shields.io/badge/Vite-8-646cff) ![react](https://img.shields.io/badge/React-19-61dafb) ![ts](https://img.shields.io/badge/TypeScript-6-3178c6)

## Qué incluye

- **Inicio** con grid de fuentes seleccionables y barra superior deslizable con todas las APIs.
- **Galería** masonry con scroll infinito, búsqueda por tags o palabras, lightbox y descarga.
- **Panel lateral** con tres pestañas: Ajustes, Tema y Calidad.
- **Lista negra global** de tags y palabras clave (se envía a los booru como `-tag`).
- **Calidad** en tres niveles: máxima, general y óptimo (afecta vistas previas, animaciones y resultados por página).
- **Tema** oscuro con tres variantes y seis colores de acento.
- **NSFW oculto**: se desbloquea manteniendo pulsado el logo 1,5 s o pulsando cinco veces la versión en Ajustes. Al desbloquearlo se muestra un aviso; las fuentes solo adultas (Gelbooru y Rule34) no aparecen hasta activar el interruptor NSFW.
- **Descarga directa** con fallback al original cuando el servidor no permite CORS.
- **Claves API por fuente** en Ajustes → Claves API, con el ID de usuario cuando la API lo exige y un botón **«Probar»** que valida la credencial contra la API real.

## Fuentes registradas

| Fuente | Tipo | Key | CORS directo | Notas |
| --- | --- | --- | --- | --- |
| Danbooru | Booru anime | No | Sí | |
| Safebooru | Booru SFW | No | Sí | |
| Konachan | Wallpapers anime | No | No (proxy) | |
| Yande.re | Arte/scans anime | No | No (proxy) | |
| Anime-Pictures | Anime 4K | No | No (proxy) | beta |
| Gelbooru | Booru adulto | Key + User ID | No (proxy) | Solo con NSFW activo |
| Rule34 | Booru adulto | Key + User ID | JSON sí, imágenes por proxy | Solo con NSFW activo |
| Wallhaven | Wallpapers | Opcional (NSFW) | No (proxy) | 24 resultados por página |
| Openverse | Licencia libre | Opcional | Sí | |
| Wikimedia Commons | Dominio público / CC | No | Sí | |
| Pixabay | Fotografía / ilustración | Obligatoria | Sí | Solo contenido seguro |

### Dónde conseguir las claves

- **Pixabay**: <https://pixabay.com/api/docs/>
- **Wallhaven**: <https://wallhaven.cc/settings/account> (opcional; obligatoria para NSFW).
- **Openverse**: <https://api.openverse.org/v1/> (opcional, sube el límite).
- **Gelbooru**: <https://gelbooru.com/index.php?page=account&s=options> (API key y User ID).
- **Rule34**: <https://rule34.xxx/index.php?page=account&s=options> (API key y User ID).

Las claves se guardan en `localStorage`, en texto plano y solo en tu navegador.

## Desarrollo

```bash
npm install
npm run dev
```

Vite incluye proxies en `vite.config.ts` para Konachan, Yande.re, Anime-Pictures, Gelbooru y Wallhaven, además de un middleware `/media` que sirve las imágenes de Gelbooru y Rule34 con el referer correcto. En desarrollo las once fuentes funcionan sin configuración extra.

```bash
npm run build     # tsc + vite build
npm run preview   # sirve dist/ (también con los proxies de Vite)
```

## Pruebas

```bash
npm test          # unitarios con Vitest (adaptadores, lista negra, nombres de archivo)
npm run test:e2e  # end-to-end con Playwright (flujo NSFW, ajustes, validación de claves)
npm run lint      # oxlint
```

Los unitarios cubren los normalizadores de cada API (paginación, `rating`, URLs de imagen y
tratamiento de errores) sin tocar la red. Los E2E levantan el servidor de desarrollo y usan
Firefox. La primera vez necesitas los navegadores:

```bash
npx playwright install firefox
```

## Producción y CORS

Las APIs de Konachan, Yande.re, Anime-Pictures, Gelbooru y Wallhaven no envían `Access-Control-Allow-Origin`, por lo que un navegador no puede leer su JSON desde otro dominio. Además, los CDN de Gelbooru y Rule34 rechazan el hotlink cuando la petición lleva referer, así que sus imágenes también necesitan un proxy. En producción tienes dos opciones:

1. Servir la app detrás de un proxy inverso que reenvíe `/proxy/*` y `/media` a los hosts originales.
2. Desplegar el worker incluido en `worker/` y pegar su URL en **Ajustes → Red** con el formato:

   ```
   https://tu-worker.workers.dev/?url={url}
   ```

   El marcador `{url}` se sustituye por la URL codificada de la API o de la imagen.

### Worker de Cloudflare (opcional)

```bash
cd worker
npx wrangler deploy
```

Solo permite los hosts de las fuentes afectadas. Sirve tanto el JSON de búsqueda como las imágenes de Gelbooru y Rule34, añadiendo el `Referer` que cada CDN exige.

## Estructura

```
src/
  components/
    gallery/    galería, tarjetas y lightbox
    home/       hero y grid de fuentes
    layout/     topbar, strip y drawer
    settings/   ajustes, tema, calidad y aviso de NSFW
    ui/         iconos, toggles, chips y modal
  context/      settings y toasts (localStorage)
  data/         metadatos de las fuentes
  hooks/        scroll infinito
  lib/          adaptadores por API, lista negra, descarga, proxy de medios
  styles/       tokens y estilos
e2e/            pruebas end-to-end con Playwright
worker/         proxy CORS opcional para Cloudflare
```

Cada adaptador normaliza su respuesta a un `ImageItem` común, de modo que añadir una fuente nueva son unas pocas líneas en `src/lib/providers/` y su entrada en `src/data/providers.ts`.

## Notas

- Las claves y ajustes se guardan en `localStorage`; no se envían a ningún servidor propio.
- La descarga intenta leer el archivo con `fetch`. Si el CDN no permite CORS, se ofrece un enlace directo al original.
- Las imágenes pertenecen a sus autores. Respeta la licencia de cada fuente; el arte de los booru es fan-art con copyright.
- Gelbooru y Rule34 alojan contenido adulto: solo aparecen cuando desbloqueas y activas el contenido NSFW, y sus APIs piden una cuenta gratuita.
