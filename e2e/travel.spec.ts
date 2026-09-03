import { expect, test } from '@playwright/test'

test('traveler adds a location and returns to the routed atlas', async ({ page }) => {
  let location: object | undefined
  await page.route('**/api/session', route => route.fulfill({ json: { email: 'traveler@example.com' } }))
  await page.route('https://geocoding-api.open-meteo.com/**', route => route.fulfill({ json: { results: [{
    id: 1, name: 'Lisbon', country: 'Portugal', latitude: 38.7, longitude: -9.1, timezone: 'Europe/Lisbon',
  }] } }))
  await page.route('**/api/atlas**', route => route.fulfill({ json: location ? [location] : [] }))
  await page.route('**/api/locations**', async route => {
    if (route.request().method() === 'POST') {
      location = { id: '1', name: 'Lisbon', latitude: 38.7, longitude: -9.1, timezone: 'Europe/Lisbon', startDate: '2020-09-03', endDate: '2020-09-05', story: 'Pastéis by the river', photos: [], embedPhotos: false, traveler: { id: 'user-1', email: 'traveler@example.com' } }
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
