import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import App from './App'

afterEach(() => vi.restoreAllMocks())

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
    note: 'Pastéis by the river', photos: [],
  }]
  vi.spyOn(globalThis, 'fetch').mockImplementation(async input => new Response(JSON.stringify(
    String(input).endsWith('/api/session') ? { email: 'traveler@example.com' } : locations
  ), { headers: { 'Content-Type': 'application/json' } }))

  render(<MemoryRouter><App /></MemoryRouter>)

  expect(await screen.findByRole('button', { name: /Lisbon/ })).toBeVisible()
  expect(screen.getByText('Pastéis by the river')).toBeVisible()
})
