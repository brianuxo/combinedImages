import { expect, test, type Page } from '@playwright/test'

const STORAGE_KEY = 'combined.settings.v1'

async function setNsfw(page: Page, enabled: boolean) {
  await page.evaluate(
    ([key, value]) => {
      const raw = localStorage.getItem(key as string)
      const settings = raw ? JSON.parse(raw) : {}
      settings.nsfw = { unlocked: true, enabled: value as boolean }
      localStorage.setItem(key as string, JSON.stringify(settings))
    },
    [STORAGE_KEY, enabled] as const,
  )
  await page.reload({ waitUntil: 'networkidle' })
}

test.describe('flujo NSFW', () => {
  test('oculta las fuentes adultas hasta activarlas', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.provider-card')).toHaveCount(9)
    await expect(page.getByRole('tab', { name: /Gelbooru/ })).toHaveCount(0)
    await expect(page.getByRole('tab', { name: /Rule34/ })).toHaveCount(0)

    await setNsfw(page, true)
    await expect(page.locator('.provider-card')).toHaveCount(11)
    await expect(page.getByRole('tab', { name: /Gelbooru/ })).toHaveCount(1)
    await expect(page.getByRole('tab', { name: /Rule34/ })).toHaveCount(1)
  })

  test('la tecla F muestra y vuelve a ocultar el interruptor de contenido adulto', async ({
    page,
  }) => {
    await page.goto('/')
    await page.evaluate((key) => localStorage.removeItem(key as string), STORAGE_KEY)
    await page.reload({ waitUntil: 'networkidle' })

    // Por defecto no hay sección de contenido adulto ni la palabra NSFW.
    await page.getByRole('button', { name: 'Abrir ajustes' }).click()
    await expect(page.locator('#nsfw-section')).toHaveCount(0)
    await expect(page.getByText('NSFW', { exact: true })).toHaveCount(0)
    await page.keyboard.press('Escape')

    // La tecla F la hace aparecer de la nada.
    await page.keyboard.press('f')
    await expect(page.getByRole('switch', { name: 'Incluir contenido NSFW' })).toBeVisible()
    await expect(page.locator('#nsfw-section')).toContainText('desbloqueado')

    // Activamos el modo adulto y comprobamos que aparecen las fuentes.
    await page.getByRole('switch', { name: 'Incluir contenido NSFW' }).click()
    const modal = page.getByRole('dialog', { name: 'Contenido adulto desbloqueado' })
    await expect(modal).toBeVisible()
    await modal.getByRole('button', { name: 'Entendido' }).click()
    await expect(page.locator('.provider-card')).toHaveCount(11)

    // La tecla F otra vez oculta la sección y desactiva el modo adulto.
    await page.keyboard.press('f')
    await expect(page.locator('#nsfw-section')).toHaveCount(0)
    await expect(page.getByRole('switch', { name: 'Incluir contenido NSFW' })).toHaveCount(0)
    await expect(page.locator('.provider-card')).toHaveCount(9)
    await expect(page.getByRole('tab', { name: /Gelbooru/ })).toHaveCount(0)
  })

  test('activar el interruptor muestra el aviso y las fuentes adultas', async ({ page }) => {
    await page.goto('/')
    await page.evaluate((key) => localStorage.removeItem(key as string), STORAGE_KEY)
    await page.reload({ waitUntil: 'networkidle' })

    await page.keyboard.press('f')
    await page.getByRole('switch', { name: 'Incluir contenido NSFW' }).click()

    const modal = page.getByRole('dialog', { name: 'Contenido adulto desbloqueado' })
    await expect(modal).toBeVisible()
    await modal.getByRole('button', { name: 'Entendido' }).click()

    await page.keyboard.press('Escape')
    await expect(page.locator('.provider-card')).toHaveCount(11)
    await expect(page.getByRole('tab', { name: /Gelbooru/ })).toHaveCount(1)
    await expect(page.getByRole('tab', { name: /Rule34/ })).toHaveCount(1)
  })

  test('la activación queda guardada entre recargas', async ({ page }) => {
    await page.goto('/')
    await setNsfw(page, true)
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('.provider-card')).toHaveCount(11)
    await expect(page.getByRole('tab', { name: /Rule34/ })).toHaveCount(1)
  })

  test('las fuentes adultas piden credenciales', async ({ page }) => {
    await page.goto('/')
    await setNsfw(page, true)

    await page.getByRole('tab', { name: /Gelbooru/ }).click()
    await expect(page.getByRole('heading', { name: 'Falta la clave API' })).toBeVisible()
    await expect(page.getByText(/API key y el User ID/)).toBeVisible()

    await page.getByRole('tab', { name: /Rule34/ }).click()
    await expect(page.getByRole('heading', { name: 'Falta la clave API' })).toBeVisible()
  })
})

test.describe('ajustes', () => {
  test('valida una API key contra la fuente real', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Abrir ajustes' }).click()
    await page.getByRole('button', { name: 'Probar la clave de Pixabay' }).click()
    // Con la clave vacía el aviso debe aparecer sin tocar la red.
    await expect(page.locator('.toast')).toBeVisible()
    await expect(page.locator('.toast')).toContainText('Pixabay')
  })

  test('muestra los campos de clave solo con NSFW desbloqueado', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Abrir ajustes' }).click()
    await expect(page.locator('input[placeholder="API key de Pixabay"]')).toHaveCount(1)
    await expect(page.locator('input[placeholder="API key de Gelbooru"]')).toHaveCount(0)

    await setNsfw(page, true)
    await page.getByRole('button', { name: 'Abrir ajustes' }).click()
    await expect(page.locator('input[placeholder="API key de Gelbooru"]')).toHaveCount(1)
    await expect(page.locator('input[placeholder="User ID"]')).toHaveCount(2)
  })
})
