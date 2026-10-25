/** Content-owned bird recordings and conservative playback areas, not species range maps. */
import type { AudioPackSetLike } from '@bendyline/molen-client/audio';

export interface BirdsongLocation {
  latitude: number;
  longitude: number;
  /** The scene's sky time, not the device's current date. */
  utcMs: number;
  sunAltitudeDeg: number;
}

export interface BirdsongProfile {
  sound: string;
  /** WGS84 west, south, east, north; crossing the date line is allowed. */
  bounds: [number, number, number, number][];
  habitats: string[];
  /** January through December activity, 0..1. These are authored mixing priors. */
  months: number[];
  activity: { dawn: number; day: number; dusk: number; night: number };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
function level(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}
function profile(value: unknown): value is BirdsongProfile {
  const p = record(value);
  const a = record(p?.activity);
  return (
    p !== undefined &&
    typeof p.sound === 'string' &&
    /^[a-z][a-z0-9_.-]*$/.test(p.sound) &&
    Array.isArray(p.bounds) &&
    p.bounds.length > 0 &&
    p.bounds.every(
      (b: unknown) =>
        Array.isArray(b) &&
        b.length === 4 &&
        b.every((n: unknown) => typeof n === 'number' && Number.isFinite(n)) &&
        Math.abs(b[0]) <= 180 &&
        Math.abs(b[2]) <= 180 &&
        b[0] !== b[2] &&
        b[1] >= -90 &&
        b[3] <= 90 &&
        b[1] < b[3],
    ) &&
    Array.isArray(p.habitats) &&
    p.habitats.length > 0 &&
    p.habitats.every((h: unknown) => typeof h === 'string' && h.length > 0) &&
    Array.isArray(p.months) &&
    p.months.length === 12 &&
    p.months.every(level) &&
    a !== undefined &&
    ['dawn', 'day', 'dusk', 'night'].every((key) => level(a[key]))
  );
}

export async function loadBirdsongProfiles(
  packs: AudioPackSetLike,
  sounds: ReadonlySet<string>,
  warn: (message: string) => void,
): Promise<BirdsongProfile[]> {
  const profiles = new Map<string, BirdsongProfile>();
  for (const { pack, path } of packs.provided('birdsong')) {
    const ref = `pack:${pack.manifest.id}/${path}`;
    try {
      const doc = record(await packs.readJson(ref));
      if (
        doc?.format !== 'molen/earth-birdsong@1' ||
        !Array.isArray(doc.profiles) ||
        !doc.profiles.every(profile)
      )
        throw new Error('expected valid molen/earth-birdsong@1 profiles');
      for (const p of doc.profiles as BirdsongProfile[]) {
        if (!sounds.has(p.sound))
          throw new Error(`sound ${p.sound} is missing from the sound banks`);
      }
      for (const p of doc.profiles as BirdsongProfile[]) profiles.set(p.sound, p);
    } catch (error) {
      warn(`${ref}: ${String(error)}`);
    }
  }
  return [...profiles.values()];
}

const clamp = (n: number): number => Math.max(0, Math.min(1, n));

/** Local daylight and the local solar calendar; no timezone database or wall-clock dependency. */
export function birdsongLevel(
  p: BirdsongProfile,
  location: BirdsongLocation | undefined,
  habitat: string | undefined,
): number {
  if (!location || !habitat || !p.habitats.includes(habitat)) return 0;
  const { latitude, longitude, utcMs, sunAltitudeDeg } = location;
  if (
    ![latitude, longitude, utcMs, sunAltitudeDeg].every(Number.isFinite) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180 ||
    Math.abs(sunAltitudeDeg) > 90
  )
    return 0;
  if (
    !p.bounds.some(
      ([w, s, e, n]) =>
        latitude >= s &&
        latitude < n &&
        (w < e ? longitude >= w && longitude < e : longitude >= w || longitude < e),
    )
  )
    return 0;
  const date = new Date(utcMs + longitude * 240_000);
  if (!Number.isFinite(date.getTime())) return 0;
  const month = p.months[date.getUTCMonth()] ?? 0;
  const twilight = date.getUTCHours() < 12 ? p.activity.dawn : p.activity.dusk;
  // Civil twilight blends into a dawn/dusk peak; the daytime level takes over by 25°.
  const day = clamp((sunAltitudeDeg - 5) / 20);
  const awake = clamp((sunAltitudeDeg + 8) / 8);
  return (
    month * (p.activity.night * (1 - awake) + awake * (twilight * (1 - day) + p.activity.day * day))
  );
}
