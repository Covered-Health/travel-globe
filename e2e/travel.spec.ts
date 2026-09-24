import { expect, test } from '@playwright/test'

test('signed-in header keeps sign out accessible on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.route('**/api/session', route => route.fulfill({ json: { email: 'traveler@example.com', name: 'Tara Veler' } }))
  await page.route('**/api/atlas**', route => route.fulfill({ json: [] }))
  await page.goto('/')

  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  const signOut = await page.getByRole('button', { name: 'Sign out' }).boundingBox()
  expect(signOut!.x + signOut!.width).toBeLessThanOrEqual(320)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
})

test('landing globe uses the full canvas below the heading bar', async ({ page }) => {
  await page.route('**/api/session', route => route.fulfill({ status: 401, json: { detail: 'Not signed in' } }))
  await page.goto('/')

  const globe = await page.getByLabel('Interactive world globe').boundingBox()
  const viewport = page.viewportSize()!
  expect(globe?.width).toBeGreaterThan(viewport.width * .95)
  expect(globe?.height).toBeGreaterThan(viewport.height - 100)
})

test('traveler adds a location and returns to the routed atlas', async ({ page }) => {
  let location: object | undefined
  await page.route('**/api/session', route => route.fulfill({ json: { email: 'traveler@example.com', name: 'Tara Veler' } }))
  await page.route('https://geocoding-api.open-meteo.com/**', route => route.fulfill({ json: { results: [{
    id: 1, name: 'Lisbon', country: 'Portugal', latitude: 38.7, longitude: -9.1, timezone: 'Europe/Lisbon',
  }] } }))
  await page.route('**/api/atlas**', route => route.fulfill({ json: location ? [location] : [] }))
  await page.route('**/api/locations**', async route => {
    if (route.request().method() === 'POST') {
      location = { id: '1', name: 'Lisbon', latitude: 38.7, longitude: -9.1, timezone: 'Europe/Lisbon', startDate: '2020-09-03', endDate: '2020-09-05', story: 'Pastéis by the river', photos: [], embedPhotos: false, traveler: { id: 'user-1', name: 'Tara Veler' } }
      await route.fulfill({ status: 201, json: location })
    } else await route.fulfill({ json: location })
  })
  await page.goto('/')
  await page.getByRole('link', { name: 'Add location' }).click()
  await expect(page).toHaveURL(/\/locations\/new$/)
  await page.getByRole('combobox', { name: 'Location' }).fill('Lis')
  await page.getByRole('option', { name: 'Lisbon, Portugal' }).click()
  await page.getByLabel('From').fill('2020-09-03')
  await page.getByLabel('Until (optional)').fill('2020-09-05')
  await page.getByRole('textbox', { name: 'editable markdown' }).fill('Pastéis by the river')
  await page.getByRole('button', { name: 'Save to atlas' }).click()

  await expect(page).toHaveURL(/\/locations\/1$/)
  await expect(page.getByText('Pastéis by the river')).toBeVisible()
  await page.getByRole('link', { name: 'Back to atlas' }).click()
  await expect(page.locator('[aria-label="Interactive world globe"] canvas')).toBeVisible()
  await page.getByRole('button', { name: /Timeline/ }).click()
  await expect(page).toHaveURL(/view=timeline&scope=all/)
  await expect(page.getByRole('link', { name: 'Lisbon location' })).toBeVisible()
})
