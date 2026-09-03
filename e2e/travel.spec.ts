import { expect, test } from '@playwright/test'

test('traveler adds a location and views it on the timeline', async ({ page }) => {
  let locations: object[] = []
  await page.route('**/api/session', route => route.fulfill({ json: { email: 'traveler@example.com' } }))
  await page.route('https://geocoding-api.open-meteo.com/**', route => route.fulfill({ json: { results: [{
    id: 1, name: 'Lisbon', country: 'Portugal', latitude: 38.7, longitude: -9.1, timezone: 'Europe/Lisbon',
  }] } }))
  await page.route('**/api/locations**', async route => {
    if (route.request().method() === 'POST') {
      locations = [{ id: '1', name: 'Lisbon', latitude: 38.7, longitude: -9.1,
        timezone: 'Europe/Lisbon', startDate: '2020-09-03', endDate: '2020-09-05',
        story: 'Pastéis by the river', photos: [], embedPhotos: false }]
      await route.fulfill({ status: 201, json: locations[0] })
    } else await route.fulfill({ json: route.request().url().includes('scope=all') ? locations : [] })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Add location' }).click()
  await page.getByRole('combobox', { name: 'Location' }).fill('Lis')
  await page.getByRole('option', { name: 'Lisbon, Portugal' }).click()
  await page.getByLabel('From').fill('2020-09-03')
  await page.getByLabel('Until (optional)').fill('2020-09-05')
  await page.getByRole('textbox', { name: 'editable markdown' }).fill('Pastéis by the river')
  await page.getByRole('button', { name: 'Save location' }).click()

  await expect(page.getByRole('button', { name: 'Lisbon location' })).toBeVisible()
  await page.getByRole('button', { name: /Timeline/ }).click()
  await expect(page.getByText('Pastéis by the river')).toBeVisible()
})
