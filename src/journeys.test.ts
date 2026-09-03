import { expect, test } from 'vitest'
import { journeyLegs } from './journeys'

test('a contained trip returns to its parent before the next destination', () => {
  const traveler = { id: 'one' }
  const locations = [
    { name: 'Rome', startDate: '2026-05-01', endDate: '2026-05-10', traveler },
    { name: 'Florence', startDate: '2026-05-03', endDate: '2026-05-04', traveler },
    { name: 'Paris', startDate: '2026-05-12', endDate: '2026-05-15', traveler },
  ]

  const legs = journeyLegs(locations)

  expect(legs.map(leg => `${leg.from.name} → ${leg.to.name}`)).toEqual([
    'Rome → Florence', 'Florence → Rome', 'Rome → Paris',
  ])
})

test('journeys never connect different travelers', () => {
  const locations = [
    { name: 'Rome', startDate: '2026-05-01', endDate: null, traveler: { id: 'one' } },
    { name: 'Paris', startDate: '2026-05-02', endDate: null, traveler: { id: 'two' } },
  ]

  expect(journeyLegs(locations)).toEqual([])
})
