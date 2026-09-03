import { expect, test } from '@playwright/test'

test('traveler adds a location and views it on the timeline', async ({ page }) => {
  let locations: object[] = []
  await page.route('**/api/locations**', async route => {
    if (route.request().method() === 'POST') {
      locations = [{ id: '1', name: 'Lisbon', latitude: 38.7, longitude: -9.1,
        timezone: 'Europe/Lisbon', startDate: '2026-09-03', endDate: null,
        note: 'Pastéis by the river', photos: [] }]
      await route.fulfill({ status: 201, json: locations[0] })
    } else await route.fulfill({ json: locations })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Add location' }).click()
  await page.getByLabel('Location').fill('Lisbon')
  await page.getByLabel('Latitude').fill('38.7')
  await page.getByLabel('Longitude').fill('-9.1')
  await page.getByLabel('Timezone').fill('Europe/Lisbon')
  await page.getByLabel('From').fill('2026-09-03')
  await page.getByLabel('Story or note').fill('Pastéis by the river')
  await page.getByRole('button', { name: 'Save location' }).click()

  await expect(page.getByRole('button', { name: 'Lisbon location' })).toBeVisible()
  await page.getByRole('button', { name: /Timeline/ }).click()
  await expect(page.getByText('Pastéis by the river')).toBeVisible()
})
