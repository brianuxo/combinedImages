# Changelog

Todas las novedades de Combined.

## [No publicado] — 1.0.0 (en curso)

### Añadido

- **Atajo `F`**: abre Ajustes directamente en la sección *Contenido adulto* con el interruptor a la
  vista. La activación se guarda en el navegador, así que las fuentes adultas (Gelbooru y Rule34)
  siguen apareciendo en la barra de fuentes y en el inicio entre recargas.
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
