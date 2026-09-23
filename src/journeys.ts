export type JourneyLocation = {
  name: string;
  startDate: string;
  endDate: string | null;
  traveler: { id: string };
};

export type JourneyLeg<T extends JourneyLocation> = { from: T; to: T };
type Coordinates = { latitude: number; longitude: number };
export type GlobePoint = { lat: number; lng: number; alt: number };

export function overlayScale(baseAltitude: number, altitude: number) {
  return Math.min(2, Math.max(0.01, Math.round((altitude / baseAltitude) * 100) / 100));
}

export function globeRoutePoints(from: Coordinates, to: Coordinates): GlobePoint[] {
  // Sample a 64-segment great-circle arc, lifted up to 7.5% above the globe at its midpoint.
  const vector = ({ latitude, longitude }: Coordinates) => {
    const lat = (latitude * Math.PI) / 180;
    const lng = (longitude * Math.PI) / 180;
    return [Math.cos(lat) * Math.cos(lng), Math.sin(lat), -Math.cos(lat) * Math.sin(lng)];
  };
  const a = vector(from);
  const b = vector(to);
  const angle = Math.acos(
    Math.min(
      1,
      Math.max(
        -1,
        a.reduce((sum, value, index) => sum + value * b[index], 0),
      ),
    ),
  );
  return Array.from({ length: 65 }, (_, index) => {
    const t = index / 64;
    const scale = Math.sin(angle)
      ? [Math.sin((1 - t) * angle) / Math.sin(angle), Math.sin(t * angle) / Math.sin(angle)]
      : [1 - t, t];
    const [x, y, z] = a.map((value, axis) => value * scale[0] + b[axis] * scale[1]);
    return {
      lat: (Math.atan2(y, Math.hypot(x, z)) * 180) / Math.PI,
      lng: (Math.atan2(-z, x) * 180) / Math.PI,
      alt: 0.075 * Math.sin(Math.PI * t),
    };
  });
}

export function journeyLegs<T extends JourneyLocation>(locations: T[]): JourneyLeg<T>[] {
  const byTraveler = new Map<string, T[]>();
  locations.forEach((location) =>
    byTraveler.set(location.traveler.id, [
      ...(byTraveler.get(location.traveler.id) ?? []),
      location,
    ]),
  );
  return [...byTraveler.values()].flatMap((travelerLocations) => {
    const ordered = [...travelerLocations].sort(
      (a, b) =>
        a.startDate.localeCompare(b.startDate) ||
        (b.endDate ?? b.startDate).localeCompare(a.endDate ?? a.startDate),
    );
    // Nested stays are side trips: travel out from the containing stay, then return before continuing.
    const parent = new Map<T, T>();
    ordered.forEach((location) => {
      const containers = ordered.filter(
        (candidate) =>
          candidate !== location &&
          candidate.startDate <= location.startDate &&
          (candidate.endDate ?? candidate.startDate) >= (location.endDate ?? location.startDate),
      );
      if (containers.length)
        parent.set(
          location,
          containers.sort(
            (a, b) =>
              b.startDate.localeCompare(a.startDate) ||
              (a.endDate ?? a.startDate).localeCompare(b.endDate ?? b.startDate),
          )[0],
        );
    });
    const children = (location: T) =>
      ordered.filter((candidate) => parent.get(candidate) === location);
    const legs: JourneyLeg<T>[] = [];
    const visit = (location: T) =>
      children(location).forEach((sideTrip) => {
        legs.push({ from: location, to: sideTrip });
        visit(sideTrip);
        legs.push({ from: sideTrip, to: location });
      });
    const roots = ordered.filter((location) => !parent.has(location));
    roots.forEach((root, index) => {
      if (index) legs.push({ from: roots[index - 1], to: root });
      visit(root);
    });
    return legs;
  });
}
