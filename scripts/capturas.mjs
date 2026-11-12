/*
 * Captura las imágenes que el manifest muestra en el aviso de instalación.
 *
 *   npm run dev            (o `npm run preview` tras compilar)
 *   node scripts/capturas.mjs http://localhost:5173/
 */
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const url = process.argv[2] ?? 'http://localhost:4173/'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'public/screenshots')

const shots = [
  { file: 'app-wide.png', width: 1280, height: 800 },
  { file: 'app-narrow.png', width: 390, height: 844 },
]

await mkdir(outDir, { recursive: true })

const browser = await chromium.launch()

for (const shot of shots) {
  const page = await browser.newPage({
    viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: 1,
  })
  await page.goto(url, { waitUntil: 'networkidle' })
  // Las tarjetas entran con animación; se espera a que terminen.
  await page.waitForTimeout(1400)
  await page.screenshot({ path: resolve(outDir, shot.file) })
  await page.close()
  console.log(`✓ public/screenshots/${shot.file} (${shot.width}×${shot.height})`)
}

await browser.close()
