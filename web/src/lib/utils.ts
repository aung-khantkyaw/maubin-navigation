import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const EARTH_RADIUS_METERS = 6_371_000;

const toRadians = (value: number) => (value * Math.PI) / 180;

export function haversineDistanceMeters(
  start: [number, number],
  end: [number, number]
): number {
  const [lon1, lat1] = start;
  const [lon2, lat2] = end;

  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_METERS * c;

  return Math.round(distance * 100) / 100;
}

export function computeSegmentLengths(
  coordinates: Array<[number, number]>
): number[] {
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return [];
  }

  const segments: number[] = [];
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const start = coordinates[index];
    const end = coordinates[index + 1];
    if (!start || !end) {
      continue;
    }
    segments.push(haversineDistanceMeters(start, end));
  }
  return segments;
}

export function formatDistanceMeters(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  if (value >= 1000) {
    const km = value / 1000;
    const precision = km >= 10 ? 1 : 2;
    return `${km.toFixed(precision)} km`;
  }

  const precision = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(precision)} m`;
}
