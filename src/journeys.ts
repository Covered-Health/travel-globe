export type JourneyLocation = {
  name: string
  startDate: string
  endDate: string | null
  traveler: { id: string }
}

export type JourneyLeg<T extends JourneyLocation> = { from: T; to: T }

export function journeyLegs<T extends JourneyLocation>(locations: T[]): JourneyLeg<T>[] {
  const byTraveler = new Map<string, T[]>()
  locations.forEach(location => byTraveler.set(location.traveler.id, [...(byTraveler.get(location.traveler.id) ?? []), location]))
  return [...byTraveler.values()].flatMap(travelerLocations => {
    const ordered = [...travelerLocations].sort((a, b) => a.startDate.localeCompare(b.startDate) || (b.endDate ?? b.startDate).localeCompare(a.endDate ?? a.startDate))
    const parent = new Map<T, T>()
    ordered.forEach(location => {
      const containers = ordered.filter(candidate => candidate !== location && candidate.startDate <= location.startDate && (candidate.endDate ?? candidate.startDate) >= (location.endDate ?? location.startDate))
      if (containers.length) parent.set(location, containers.sort((a, b) => b.startDate.localeCompare(a.startDate) || (a.endDate ?? a.startDate).localeCompare(b.endDate ?? b.startDate))[0])
    })
    const children = (location: T) => ordered.filter(candidate => parent.get(candidate) === location)
    const legs: JourneyLeg<T>[] = []
    const visit = (location: T) => children(location).forEach(sideTrip => { legs.push({ from: location, to: sideTrip }); visit(sideTrip); legs.push({ from: sideTrip, to: location }) })
    const roots = ordered.filter(location => !parent.has(location))
    roots.forEach((root, index) => { if (index) legs.push({ from: roots[index - 1], to: root }); visit(root) })
    return legs
  })
}
