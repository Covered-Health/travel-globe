import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import App from './App'

afterEach(() => vi.restoreAllMocks())

test('shows fetched travel locations on the globe', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([{
    id: 'location-1', name: 'Lisbon', latitude: 38.7, longitude: -9.1,
    timezone: 'Europe/Lisbon', startDate: '2026-09-03', endDate: null,
    note: 'Pastéis by the river', photos: [],
  }]), { headers: { 'Content-Type': 'application/json' } }))

  render(<MemoryRouter><App /></MemoryRouter>)

  expect(await screen.findByRole('button', { name: /Lisbon/ })).toBeVisible()
  expect(screen.getByText('Pastéis by the river')).toBeVisible()
})
