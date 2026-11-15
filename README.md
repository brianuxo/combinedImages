# Combined

SPA para explorar y descargar imágenes y fondos de pantalla de varias fuentes desde un solo lugar. Sin cuentas y con una instancia propia opcional que guarda tus favoritos, claves y ajustes cifrados para compartirlos entre el PC y el móvil.

![stack](https://img.shields.io/badge/Vite-8-646cff) ![react](https://img.shields.io/badge/React-19-61dafb) ![ts](https://img.shields.io/badge/TypeScript-6-3178c6)

## Qué incluye

- **Inicio** con grid de fuentes seleccionables y barra superior deslizable con todas las APIs.
- **Galería** masonry con scroll infinito, búsqueda por tags o palabras, lightbox y descarga.
- **Panel lateral** con tres pestañas: Ajustes, Tema y Calidad.
- **Lista negra global** de tags y palabras clave (se envía a los booru como `-tag`).
- **Calidad** en tres niveles: máxima, general y óptimo. Afecta al tamaño máximo de las imágenes que se muestran, a las animaciones y al número de resultados. En **Óptimo** las miniaturas y la vista ampliada se muestran hasta **1920 px** en el lado mayor (ancho o alto); en **General** hasta **2984 px**; en **Máxima** sin límite. En Óptimo la galería se detiene a las 12 tarjetas y las siguientes se piden con **«Ver más»**. En pantallas de hasta 720 px se elige Óptimo de entrada. La **descarga siempre guarda el archivo original** de la fuente, sea cual sea la calidad, y el visor muestra «Resolución original = …». Las imágenes topadas se redimensionan en el propio servidor (`/resize` y `/media?w=`) cuando la app corre en tu instancia; sin servidor propio se usa wsrv.nl para las fuentes de imagen directa.
- **Sincronización entre dispositivos** (opcional): favoritos, claves API, lista negra y ajustes viajan cifrados a tu instancia y se comparten entre el PC y el móvil. La calidad de imagen se queda en cada equipo.
- **Tema** oscuro con tres variantes y seis colores de acento.
- **NSFW oculto por defecto**: el panel de Ajustes no menciona nada de contenido adulto hasta que pulsas la tecla **F** o haces un **doble toque sobre la versión** (la del pie de inicio o la de Ajustes; el primer toque avisa de que falta el segundo, y a los dos segundos se cancela). Eso hace aparecer la sección *Contenido adulto* con el interruptor a la vista. Al activarlo aparecen **Gelbooru** y **Rule34** en la barra de fuentes y en el inicio; la preferencia queda guardada en el navegador (y, con la sincronización activa, también en tus dispositivos), así que no hay que repetirla. Pulsando **F** (o con otro doble toque) la sección desaparece y el modo adulto se desactiva. También funciona manteniendo pulsado el logo 1,5 s.
- **Descarga directa** con fallback al original cuando el servidor no permite CORS.
- **Favoritos dentro de la app**: guarda imágenes con el corazón (o la tecla **S** en el visor) en una galería propia y descárgala entera en un **ZIP** con los originales a máxima calidad, con progreso y opción de cancelar. Si activas la sincronización, los favoritos aparecen también en tus otros dispositivos.
- **Autor clicable** en el visor: al pulsar el nombre se busca el resto de imágenes de ese autor en la misma fuente.
- **Sugerencias de tags** al escribir en el buscador y en la lista negra: con **`i`** propone `ia_generated`, con **`w`**, `wuthering_waves` o `widowmaker`. Se navegan con las flechas y se aplican con **Enter**; el ranking mezcla una lista curada con los tags que ya has visto en la sesión.
- **Instalable como app**: incluye manifiesto, iconos y service worker, así que se abre en su propia ventana desde el escritorio o la pantalla de inicio, incluso sin conexión.
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

Las claves se guardan en `localStorage` de cada navegador. Si activas la sincronización, además viajan **cifradas** a tu instancia: el servidor guarda un paquete que no puede abrir.

## Desarrollo

```bash
npm install
npm run dev
```

Vite incluye proxies en `vite.config.ts` para Konachan, Yande.re, Anime-Pictures, Gelbooru y Wallhaven, además de un middleware `/media` que sirve las imágenes de Gelbooru y Rule34 con el referer correcto y un middleware `/resize?url=…&w=N` que redimensiona cualquier imagen https a lo sumo N píxeles (con `sharp`, solo en el servidor). En desarrollo las once fuentes funcionan sin configuración extra.

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

Las APIs de Konachan, Yande.re, Anime-Pictures, Gelbooru y Wallhaven no envían `Access-Control-Allow-Origin`, por lo que un navegador no puede leer su JSON desde otro dominio. Además, los CDN de Gelbooru, Rule34 y Yande.re rechazan el hotlink cuando la petición no lleva su referer, así que sus imágenes también necesitan un proxy. En producción tienes dos opciones:

1. Servir la app detrás de un proxy inverso que reenvíe `/proxy/*` y `/media` a los hosts originales.
2. Desplegar el worker incluido en `worker/` y pegar su URL en **Ajustes → Red** con el formato:

   ```
   https://tu-worker.workers.dev/?url={url}
   ```

   El marcador `{url}` se sustituye por la URL codificada de la API o de la imagen.

Las rutas `/proxy/*` las define la tabla `src/lib/proxy.ts`, que es la misma que usa la app para reescribir las URLs y la que genera el proxy del servidor de Vite: así el cliente y el servidor no se desincronizan.

### Servidor propio con `vite preview`

Si prefieres no depender de un proxy externo, puedes servir el build con el mismo servidor de Vite, que ya trae los proxies y `/media`:

```bash
VITE_SERVER_PROXY=1 npm run build                   # el build usa `/proxy/*` y `/media`
ALLOWED_HOSTS=midominio.example npm run preview -- --host 127.0.0.1 --port 4199
```

- `VITE_SERVER_PROXY=1` hace que la app pida las imágenes y el JSON por las rutas del mismo origen. Sin esa variable (y fuera de `localhost`) usaría las URLs directas y depende de **Ajustes → Red**.
- `ALLOWED_HOSTS` es la lista (separada por comas) de dominios con los que se accede a la app; sin ella Vite responde `403` cuando el `Host` no es `localhost`.

`desplegar.sh` hace todo eso en una máquina remota por SSH: copia el código, recompila, reinicia el servicio y comprueba que responde.

## Sincronización entre dispositivos

La misma instancia que sirve la app guarda un **paquete cifrado** con los favoritos, las claves API y los ajustes compartidos. No es un servicio aparte: son dos rutas que añade `vite.config.ts` (`GET/PUT /api/sync`) en el mismo proceso de `vite preview`.

### Cómo se activa

1. Despliega normalmente. **No hay que copiar ningún token**: la conexión se hace solo con la frase.

2. En cada dispositivo: **Ajustes → Sincronización**, escribe la **frase de cifrado** (la misma en todos) y pulsa **Conectar**. La primera conexión guarda en la instancia el hash de la credencial derivada de esa frase (`data/auth`).

3. Al conectar, el dispositivo baja el paquete, lo descifra, mezcla y sube el resultado. Si la instancia está vacía, sube lo que tengas.

### Qué se comparte y qué no

- Se comparten los favoritos, las claves API, la lista negra, el tema, el acento, el proxy y la preferencia NSFW.
- **La calidad no se sincroniza**: depende del hardware de cada equipo. Cada dispositivo conserva la suya.
- Los favoritos se unen por `key` con la fecha más reciente. Al borrar se escriben **lápidas** (`deletedAt`, se conservan 30 días) para que otro dispositivo no vuelva a subir lo borrado.
- Si dos dispositivos escriben a la vez, el que llega tarde recibe `409`, mezcla y reenvía una vez.

### Seguridad y copias

- La frase **nunca viaja al servidor**. De ella se deriva una clave con PBKDF2-SHA256 (210 000 iteraciones, sal aleatoria por paquete) y el contenido se sella con AES-GCM. Sin la frase, el paquete de `data/sync.json` es opaco.
- De la misma frase se deriva la **credencial de conexión** (PBKDF2-SHA256, 100 000 iteraciones, sal fija) que viaja como `Bearer`. El servidor guarda solo su hash SHA-256 en `data/auth`, nunca la frase. La primera conexión reclama ese hash; para revocar el acceso, borra `data/auth` y vuelve a conectar.
- Compatibilidad: el token fijo de `data/token` (o `SYNC_TOKEN`) se sigue aceptando para dispositivos vinculados antes del cambio y para automatizar con `curl`, pero la interfaz ya no lo pide. `deploy/token.sh` lo muestra si lo necesitas.
- Cada navegador guarda la credencial derivada y la frase en `localStorage` (`combined.sync.v1`) para no pedirlas en cada arranque: trátalos como una credencial del dispositivo. **Olvidar dispositivo** los borra de ese navegador; los datos locales se quedan.
- Si pierdes la frase, el paquete no se puede descifrar: borra `data/auth` y `data/sync.json` en la instancia y vuelve a conectar con otra frase; después tendrás que reescribir las claves (los favoritos locales de cada dispositivo se conservan).
- `data/` está fuera de git y del tar de despliegue, así que sobrevive a las actualizaciones. Para una copia de seguridad basta con guardar `data/sync.json` y `data/auth`.
- El service worker no cachea `/api`, `/proxy/*` ni `/media`.

### Variables

| Variable | Para qué |
| --- | --- |
| `SYNC_TOKEN` | Fija el token fijo (solo compatibilidad/curl) sin usar `data/token`. |
| `SYNC_DATA_DIR` | Cambia la carpeta de datos (por defecto `data/`). |



### Worker de Cloudflare (opcional)

```bash
cd worker
npx wrangler deploy
```

Solo permite los hosts de las fuentes afectadas. Sirve tanto el JSON de búsqueda como las imágenes de Gelbooru, Rule34 y Yande.re, añadiendo el `Referer` que cada CDN exige.

## Instalar como app (PWA)

La app se instala como una aplicación más: ventana propia, icono en el escritorio o en la pantalla de inicio y arranque sin conexión. Necesita servirse por **HTTPS** (o `localhost`), así que el despliegue actual ya cumple el requisito.

1. Abre <https://galeriaprivadarx.tail9dde4c.ts.net:8445/> en Chrome o Edge.
2. Pulsa **Instalar la app**: el icono de descarga de la barra superior o el botón del inicio. El aviso solo aparece cuando el navegador lo ofrece (en Android también está en el menú).
3. En iPhone y iPad no hay botón: en Safari, **Compartir → Añadir a pantalla de inicio**.

Si el navegador no ofrece la instalación, la app sigue funcionando igual en la pestaña.

Qué se guarda en el dispositivo:

- `public/manifest.webmanifest` define nombre, iconos, colores, capturas y la ventana propia (`display: standalone`).
- `public/sw.js` cachea el armazón (HTML, JS, CSS, fuentes e iconos) para abrir sin red. El HTML va a red primero, de modo que una recarga con conexión trae siempre la última versión.
- El service worker **no toca `/proxy/*`, `/media` ni `/api`**: las búsquedas, las imágenes, las descargas y el paquete de sincronización nunca pasan por su caché. Los favoritos y las claves se guardan en `localStorage` (caché local) y, si activas la sincronización, también cifrados en tu instancia.
- Para desinstalarla o limpiar esa caché: Ajustes del navegador → aplicaciones/sitio → borrar datos del sitio.

Los iconos y las capturas del manifest se regeneran con Playwright (con el proyecto instalado, y el servidor de preview levantado para las capturas):

```bash
node scripts/generar-iconos.mjs
node scripts/capturas.mjs http://localhost:4173/
```

## Estructura

```
src/
  components/
    favorites/  galería de favoritos y exportación a ZIP
    gallery/    galería, tarjetas y lightbox
    home/       hero y grid de fuentes
    layout/     topbar, strip y drawer
    settings/   ajustes, tema, calidad, sincronización y aviso de NSFW
    ui/         iconos, toggles, chips, sugerencias y modal
  context/      settings, favoritos, sincronización y toasts
  data/         metadatos de las fuentes
  hooks/        scroll infinito, masonry, sugerencias e instalación
  lib/          adaptadores por API, lista negra, descarga, ZIP, proxy de medios, sync y PWA
  styles/       tokens y estilos
data/           credencial de acceso, token opcional y paquete cifrado (solo en la instancia)
deploy/         instalación, servicio y utilidades
e2e/            pruebas end-to-end con Playwright
public/         manifest, service worker, iconos y capturas
scripts/        generación de iconos y capturas con Playwright
worker/         proxy CORS opcional para Cloudflare
```

Cada adaptador normaliza su respuesta a un `ImageItem` común, de modo que añadir una fuente nueva son unas pocas líneas en `src/lib/providers/` y su entrada en `src/data/providers.ts`.

## Notas

- Los ajustes, las claves y los favoritos se guardan en `localStorage`; con la sincronización activa, además van cifrados a tu instancia. Sin ella, no salen del navegador.
- La app instalada abre sin conexión con el armazón guardado; buscar y descargar imágenes sigue necesitando red, porque el service worker no guarda respuestas de las fuentes.
- Los favoritos se guardan en `localStorage` (`combined.favorites.v1`, hasta 1000 imágenes) con los metadatos, no con el archivo. Al exportar el ZIP se descargan los originales, así que conviene hacerlo con las imágenes que quieras conservar: el ZIP se arma en memoria y, si supera los 400 MB, se entrega con lo que ya tenía y avisa.
- El autor se busca según la fuente: en Danbooru y Safebooru es un tag de artista; en Konachan y Yande.re el nombre corresponde a quien subió la imagen, así que se filtra con `user:nombre` (son los mismos datos que muestra la ficha).
- La descarga guarda siempre el archivo original. Si el CDN no manda cabeceras CORS y el navegador no deja leer el binario, se reintenta por el proxy del servidor (`/proxy/konachan/...`), que devuelve el mismo archivo intacto porque pasa por el mismo origen que la app. En un despliegue propio se usa el proxy configurado en Ajustes → Red. Solo si ninguna vía funciona se ofrece el enlace al original.
- Las imágenes pertenecen a sus autores. Respeta la licencia de cada fuente; el arte de los booru es fan-art con copyright.
- Gelbooru y Rule34 alojan contenido adulto: solo aparecen cuando desbloqueas y activas el contenido NSFW, y sus APIs piden una cuenta gratuita.
