export type PlaceName = { name: string; admin1?: string; country?: string; country_code?: string }

const stateCountries = new Set(['AR', 'AU', 'BR', 'CA', 'CN', 'IN', 'ID', 'JP', 'MX', 'NG', 'PK', 'RU', 'US', 'ZA'])

export function placeName(place: PlaceName) {
  const region = stateCountries.has(place.country_code ?? '') ? place.admin1 : place.country
  return [place.name, region && region !== place.name && region].filter(Boolean).join(', ')
}
