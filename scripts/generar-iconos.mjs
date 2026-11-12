/*
 * Genera los iconos PNG de la app a partir del mismo dibujo que public/favicon.svg.
 *
 *   node scripts/generar-iconos.mjs
 *
 * Usa Playwright (ya está en devDependencies) para rasterizar el SVG con bordes
 * suaves y sin depender de herramientas de imagen del sistema.
 */
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'public/icons')

const defs = `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8b7bff" />
      <stop offset="1" stop-color="#22d3ee" />
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#7c6cff" stop-opacity="0.42" />
      <stop offset="0.55" stop-color="#22d3ee" stop-opacity="0.1" />
      <stop offset="1" stop-color="#22d3ee" stop-opacity="0" />
    </radialGradient>
  </defs>
`

const glyph = `
  <circle cx="32" cy="32" r="13" fill="none" stroke="url(#g)" stroke-width="4" />
  <circle cx="32" cy="32" r="4.5" fill="url(#g)" />
  <path d="M32 19v-6M32 51v-6M19 32h-6M51 32h-6" stroke="url(#g)" stroke-width="3.5" stroke-linecap="round" />
`

/** Icono normal: cuadrado redondeado con aire alrededor (fondo transparente). */
const anyArt = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  ${defs}
  <g transform="translate(32 32) scale(7)">
    <rect width="64" height="64" rx="18" fill="#0a0b10" />
    <rect x="6" y="6" width="52" height="52" rx="14" fill="url(#g)" opacity="0.16" />
    ${glyph}
  </g>
</svg>`

/** Icono maskable: fondo a sangre y dibujo dentro de la zona segura (80 %). */
const maskableArt = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  ${defs}
  <rect width="512" height="512" fill="#0a0b10" />
  <circle cx="256" cy="256" r="300" fill="url(#glow)" />
  <g transform="translate(256 256) scale(6.2) translate(-32 -32)">
    ${glyph}
  </g>
</svg>`

/** Favicon pequeño: el dibujo original, sin margen, para que se lea a 32 px. */
const faviconArt = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  ${defs}
  <rect width="64" height="64" rx="18" fill="#0a0b10" />
  <rect x="6" y="6" width="52" height="52" rx="14" fill="url(#g)" opacity="0.16" />
  ${glyph}
</svg>`

const targets = [
  { file: 'icon-192.png', size: 192, art: anyArt },
  { file: 'icon-512.png', size: 512, art: anyArt },
  { file: 'icon-maskable-512.png', size: 512, art: maskableArt },
  { file: 'apple-touch-icon.png', size: 180, art: maskableArt },
  { file: 'favicon-32.png', size: 32, art: faviconArt },
]

await mkdir(outDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 })

for (const { file, size, art } of targets) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<!doctype html><style>
      html, body { margin: 0; background: transparent; }
      svg { display: block; width: 100vw; height: 100vh; }
    </style>${art}`,
  )
  await page.screenshot({
    path: resolve(outDir, file),
    omitBackground: !file.includes('maskable') && !file.includes('apple'),
  })
  console.log(`✓ public/icons/${file} (${size}×${size})`)
}

await browser.close()
