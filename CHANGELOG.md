# Changelog

Todas las novedades de Combined.

## Sin publicar

### Añadido

- **Tope de resolución al mostrar imágenes**, pensado para que la galería vaya
  fluida en móviles menos potentes. En calidad **Óptimo** las miniaturas y la
  vista ampliada se muestran hasta **1920 px** en el lado mayor (ancho o alto);
  en **General** hasta **2984 px**; en **Máxima** no hay límite. La imagen se
  escala en proporción, nunca se deforma ni se amplía.
- El visor (lightbox) muestra **«Mostrando: X × Y»** cuando la imagen se está
  viendo reducida y **«Resolución original = W × H»** siempre, y el botón de
  descarga dice **«Descargar original»**. En las tarjetas, el tamaño del chip
  indica la resolución original (tooltip: «la descarga guarda este archivo»).
- **La descarga no cambia**: siempre baja el archivo original de la fuente,
  sea cual sea la calidad seleccionada.
- Redimensionado del lado del servidor propio: `/resize?url=…&w=N` (cualquier
  host https, con `sharp`) y `/media?url=…&w=N` (Gelbooru/Rule34, con el referer
  correcto). Sin servidor propio, las fuentes de imagen directa usan
  **wsrv.nl** como resizer externo.
- Wikimedia pide la vista ampliada directamente con el ancho del tope
  (`Special:FilePath?width=…`).
- Pruebas unitarias de `cappedSize`/`capDisplayUrl` y de la cadena de
  candidatos con tope (`resize.test.ts`, `media.test.ts`).

## 1.0.0 — 2026-10-20

### Añadido

- **Atajo `F`**: alterna los controles de *Contenido adulto* en Ajustes. La primera pulsación los
  hace aparecer (y abre el panel en esa sección); la siguiente los vuelve a ocultar y desactiva el
  modo adulto. La activación se guarda en el navegador, así que las fuentes adultas (Gelbooru y
  Rule34) siguen apareciendo en la barra de fuentes y en el inicio entre recargas.
- **Gelbooru** y **Rule34** como fuentes adultas: solo aparecen cuando el contenido NSFW está
  activo y necesitan API key + User ID gratuitos.
- **Wallhaven** (wallpapers; la clave es opcional para SFW y obligatoria para NSFW) y **Pixabay**
  (fotografía e ilustración, con clave obligatoria).
- Botón **«Probar»** en Ajustes → Claves API que valida la credencial contra la API real.
- **Aviso de contenido adulto** al desbloquear el modo NSFW, con foco atrapado y cierre con Escape.
- **Proxy de medios** (`/media` en Vite y en el Worker) para las imágenes de Gelbooru y Rule34,
  que bloquean el hotlink por referer.
- Pruebas unitarias (Vitest) de los adaptadores, la lista negra y los nombres de archivo, y
  pruebas end-to-end (Playwright) del flujo NSFW y de los ajustes.

### Corregido

- **El contenido adulto ya no se anuncia por defecto.** La sección *Contenido adulto*, la palabra
  «NSFW» en Ajustes y las referencias a Gelbooru y Rule34 solo existen después de desbloquearlo con
  `F`; antes de eso el panel no menciona nada de ello. Al ocultarlo de nuevo, el modo adulto se
  desactiva y las fuentes adultas desaparecen de la barra y del inicio.
- Descarga de imágenes de **Wallhaven**: su CDN devuelve 403 si la petición lleva referer, así que
  las tarjetas, el lightbox y las descargas se envían ya sin referer.
- La galería se reinicia limpiamente al cambiar de búsqueda o de ajustes, sin dejar resultados
  antiguos ni provocar renders en cascada.

### Interno

- Lint a cero avisos y hooks de contexto separados de sus providers (fast refresh correcto).
- El estado del scroll infinito pasa a un reducer con acciones explícitas.

## 0.1.0 — Alpha (2026-10-20)

- Primera versión pública: 7 fuentes (Danbooru, Safebooru, Konachan, Yande.re, Anime-Pictures,
  Openverse y Wikimedia Commons), galería masonry con scroll infinito, lightbox, descarga directa,
  panel lateral con Ajustes/Tema/Calidad, lista negra global y worker de CORS opcional.
