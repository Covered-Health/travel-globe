import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import App from './App'

vi.mock('react-globe.gl', async () => {
  const React = await import('react')
  return { default: React.forwardRef(() => <canvas />) }
})

const lisbon = {
  id: 'location-1', name: 'Lisbon', latitude: 38.7, longitude: -9.1,
  timezone: 'Europe/Lisbon', startDate: '2026-09-03', endDate: null,
  story: 'Pastéis by the river', photos: [] as string[], embedPhotos: false,
  traveler: { id: 'user-1', email: 'traveler@example.com' },
}

afterEach(() => { cleanup(); vi.restoreAllMocks() })

function sessionAnd(response: object) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async input => Response.json(
    String(input).endsWith('/api/session') ? { email: 'traveler@example.com' } : response
  ))
}

function CurrentUrl() {
  const location = useLocation()
  return <output aria-label="Current URL">{location.pathname}{location.search}</output>
}

test('landing page is useful while session restoration is pending', () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}))
  render(<MemoryRouter><App /></MemoryRouter>)
  expect(screen.getByRole('heading', { name: 'Every journey has a place' })).toBeVisible()
  expect(screen.getByLabelText('Interactive world globe')).toBeVisible()
})

test('signed-out landing globe presents example journeys', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 401 }))
  render(<MemoryRouter><App /></MemoryRouter>)
  expect(await screen.findByText('A glimpse of the journeys ahead')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Continue' })).toBeVisible()
  expect(screen.getByText(/MapTiler key to show geographic labels|© MapTiler/)).toBeVisible()
})

test('atlas shows every traveler without exposing full field notes', async () => {
  sessionAnd([lisbon])
  render(<MemoryRouter><App /></MemoryRouter>)
  expect(await screen.findByRole('link', { name: 'Lisbon location' })).toBeVisible()
  expect(screen.getByRole('link', { name: 'traveler@example.com traveler' })).toBeVisible()
  expect(screen.queryByText('Pastéis by the river')).not.toBeInTheDocument()
})

test('globe and timeline choices persist in the URL', async () => {
  sessionAnd([lisbon])
  const user = userEvent.setup()
  render(<MemoryRouter><App /><CurrentUrl /></MemoryRouter>)
  await user.click(await screen.findByRole('button', { name: /Timeline/ }))
  expect(screen.getByLabelText('Current URL')).toHaveTextContent('/?view=timeline&scope=all')
})

test('add location has its own route with autocomplete and editor', async () => {
  sessionAnd([])
  const user = userEvent.setup()
  render(<MemoryRouter><App /><CurrentUrl /></MemoryRouter>)
  await user.click(await screen.findByRole('link', { name: 'Add location' }))
  expect(screen.getByLabelText('Current URL')).toHaveTextContent('/locations/new')
  expect(screen.getByRole('combobox', { name: /Location/ })).toBeVisible()
  expect(await screen.findByRole('radio', { name: 'Bold' }, { timeout: 5000 })).toBeVisible()
  expect(screen.getByRole('checkbox', { name: 'Embed photos in story' })).toBeEnabled()
})

test('location detail contains story and photo gallery', async () => {
  const location = { ...lisbon, photos: ['/uploads/one.jpg', '/uploads/two.jpg'], embedPhotos: true }
  sessionAnd(location)
  render(<MemoryRouter initialEntries={['/locations/location-1']}><App /></MemoryRouter>)
  expect(await screen.findByRole('heading', { name: 'Lisbon' })).toBeVisible()
  expect(screen.getByText('Pastéis by the river')).toBeVisible()
  expect(screen.getAllByRole('img', { name: /Lisbon gallery photo/ })).toHaveLength(2)
})

test('traveler detail links to each of their places', async () => {
  sessionAnd({ id: 'user-1', email: 'traveler@example.com', locations: [lisbon] })
  render(<MemoryRouter initialEntries={['/users/user-1']}><App /></MemoryRouter>)
  expect(await screen.findByRole('heading', { name: 'traveler@example.com' })).toBeVisible()
  expect(screen.getByRole('link', { name: 'Lisbon location' })).toHaveAttribute('href', '/locations/location-1')
})
