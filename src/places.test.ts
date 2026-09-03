import { expect, test } from 'vitest'
import { placeName } from './places'

test('places in countries with large state systems include the state', () => {
  expect(placeName({ name: 'Bellevue', admin1: 'Washington', country: 'United States', country_code: 'US' })).toBe('Bellevue, Washington')
})

test('other places include the country instead of the administrative region', () => {
  expect(placeName({ name: 'Lisbon', admin1: 'Lisbon', country: 'Portugal', country_code: 'PT' })).toBe('Lisbon, Portugal')
})
