import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import App from './App'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

test('landing page is useful while session restoration is pending', () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}))

  render(<MemoryRouter><App /></MemoryRouter>)

  expect(screen.getByRole('heading', { name: 'Every journey has a place' })).toBeVisible()
})

test('signed-out travelers see an inviting landing page', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 401 }))

  render(<MemoryRouter><App /></MemoryRouter>)

  expect(await screen.findByRole('heading', { name: 'Every journey has a place' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Continue' })).toBeVisible()
})

test('shows fetched travel locations on the globe', async () => {
  const locations = [{
    id: 'location-1', name: 'Lisbon', latitude: 38.7, longitude: -9.1,
    timezone: 'Europe/Lisbon', startDate: '2026-09-03', endDate: null,
    story: 'Pastéis by the river', photos: [], embedPhotos: false,
  }]
  vi.spyOn(globalThis, 'fetch').mockImplementation(async input => new Response(JSON.stringify(
    String(input).endsWith('/api/session') ? { email: 'traveler@example.com' } : locations
  ), { headers: { 'Content-Type': 'application/json' } }))

  render(<MemoryRouter><App /></MemoryRouter>)

  expect(await screen.findByRole('button', { name: /Lisbon/ })).toBeVisible()
  expect(screen.getByText('Pastéis by the river')).toBeVisible()
})

test('location search suggests places with timezone metadata', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    const url = String(input)
    if (url.endsWith('/api/session')) return Response.json({ email: 'traveler@example.com' })
    if (url.includes('geocoding-api')) return Response.json({ results: [{
      id: 2267057, name: 'Lisbon', admin1: 'Lisbon', country: 'Portugal',
      latitude: 38.7167, longitude: -9.1333, timezone: 'Europe/Lisbon',
    }] })
    return Response.json([])
  })
  const user = userEvent.setup()
  render(<MemoryRouter><App /></MemoryRouter>)
  await user.click(await screen.findByRole('button', { name: 'Add location' }))

  await user.type(screen.getByRole('combobox', { name: /Location/ }), 'Lis')

  expect(await screen.findByRole('option', { name: 'Lisbon, Portugal' })).toBeVisible()
  expect(screen.queryByLabelText('Latitude')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Timezone')).not.toBeInTheDocument()
})

test('stories are written visually as markdown with an inline photo choice', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async input => Response.json(
    String(input).endsWith('/api/session') ? { email: 'traveler@example.com' } : []
  ))
  const user = userEvent.setup()
  render(<MemoryRouter><App /></MemoryRouter>)

  await user.click(await screen.findByRole('button', { name: 'Add location' }))

  expect(await screen.findByRole('radio', { name: 'Bold' })).toBeVisible()
  expect(screen.getByRole('checkbox', { name: 'Embed photos in story' })).toBeEnabled()
})

test('one or two story photos appear inline and in the bottom gallery', async () => {
  const photos = ['/uploads/one.jpg', '/uploads/two.jpg']
  const location = { id: '1', name: 'Lisbon', latitude: 38.7, longitude: -9.1,
    timezone: 'Europe/Lisbon', startDate: '2026-09-03', endDate: null,
    story: 'A bright day', photos, embedPhotos: true }
  vi.spyOn(globalThis, 'fetch').mockImplementation(async input => Response.json(
    String(input).endsWith('/api/session') ? { email: 'traveler@example.com' } : [location]
  ))
  render(<MemoryRouter><App /></MemoryRouter>)

  await screen.findByRole('button', { name: 'Lisbon location' })

  expect(screen.getAllByRole('img', { name: /Lisbon inline photo/ })).toHaveLength(2)
  expect(screen.getAllByRole('img', { name: /Lisbon gallery photo/ })).toHaveLength(2)
})

test('three or more embedded photos form a preview that opens the full gallery', async () => {
  const photos = [1, 2, 3, 4].map(number => `/uploads/${number}.jpg`)
  const location = { id: '1', name: 'Lisbon', latitude: 38.7, longitude: -9.1,
    timezone: 'Europe/Lisbon', startDate: '2026-09-03', endDate: null,
    story: 'A bright day', photos, embedPhotos: true }
  vi.spyOn(globalThis, 'fetch').mockImplementation(async input => Response.json(
    String(input).endsWith('/api/session') ? { email: 'traveler@example.com' } : [location]
  ))
  const user = userEvent.setup()
  render(<MemoryRouter><App /></MemoryRouter>)
  await screen.findByRole('button', { name: 'Lisbon location' })

  expect(screen.getAllByRole('img', { name: /Lisbon inline photo/ })).toHaveLength(3)
  await user.click(screen.getByRole('button', { name: 'Open Lisbon photo gallery' }))

  expect(screen.getByRole('dialog', { name: 'Lisbon photo gallery' })).toBeVisible()
  expect(screen.getAllByRole('img', { name: /Lisbon full photo/ })).toHaveLength(4)
})
