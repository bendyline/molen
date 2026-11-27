/**
 * The soundscape catalog (`molen/earth-soundscape@1`, a sound pack's `soundscape` role): every
 * ambience bed with where it may play, in which months, at what hours, above what temperature, in
 * which habitats and settlements, and the evidence for that. It replaces the broad region tags
 * (`earth:region:*`), which played Ontario cicadas in Seattle and Bengaluru horns in Tokyo.
 *
 * Bounds are conservative playback areas, not surveyed ranges: a mixed chorus stays near where it
 * was recorded, a single species may cover its documented range. A place no entry covers is quiet
 * in that category rather than borrowing another continent's recording.
 */

import type { AudioPackSetLike } from '@bendyline/molen-client/audio';
import { hash32 } from '@bendyline/molen-client/audio';
import { warmth } from './climate';

export type SoundscapeSetting = 'urban' | 'rural';

export interface SoundscapeEntry {
  sound: string;
  /** One bed plays per category: birds, night, insects, frogs, wind, gust, rain, coast, ... */
  category: string;
  /** WGS84 [west, south, east, north] boxes; west > east crosses the date line. */
  bounds: [number, number, number, number][];
  /** January..December activity 0..1 on the local calendar; absent means all year. */
  months?: number[];
  /** Activity 0..1 by light: before sunrise, day, after sunset, night. Absent means always. */
  activity?: { dawn: number; day: number; dusk: number; night: number };
  /** [silent below, full from] in °C. */
  temperatureC?: [number, number];
  /** Wildlife habitat kinds (forest, grass, scrub, farmland, wetland...) it belongs to. */
  habitats?: string[];
  /** Urban: within a block of streets. Rural: away from them. Absent means either. */
  settings?: SoundscapeSetting[];
  /** Level multiplier for the bed, 0..2. */
  gain?: number;
  /** Where the facts behind the bounds, months and hours came from. */
  evidence?: string[];
  /** What the bounds stand for, in a sentence. */
  coverage?: string;
}

export interface SoundscapeContext {
  latitude: number;
  longitude: number;
  utcMs?: number;
  sunAltitudeDeg?: number;
  /** Local solar hour, used when the sun's altitude is unknown. */
  solarHour?: number;
  temperatureC?: number;
  habitat?: string;
  urban: boolean;
}

const unit = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
const box = (b: unknown): b is [number, number, number, number] =>
  Array.isArray(b) &&
  b.length === 4 &&
  b.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
  Math.abs(b[0]) <= 180 &&
  Math.abs(b[2]) <= 180 &&
  b[0] !== b[2] &&
  b[1] >= -90 &&
  b[3] <= 90 &&
  b[1] < b[3];

/** Why an entry is invalid, or undefined when it is valid. */
export function soundscapeEntryIssue(value: unknown): string | undefined {
  const e = value as Partial<SoundscapeEntry> | null;
  if (e === null || typeof e !== 'object') return 'not an object';
  if (typeof e.sound !== 'string' || !/^[a-z0-9][a-z0-9_.-]*$/.test(e.sound)) return 'bad sound id';
  if (typeof e.category !== 'string' || !/^[a-z][a-z-]*$/.test(e.category)) return 'bad category';
  if (!Array.isArray(e.bounds) || e.bounds.length === 0 || !e.bounds.every(box))
    return 'bounds must be [west, south, east, north] boxes';
  if (
    e.months !== undefined &&
    (!Array.isArray(e.months) || e.months.length !== 12 || !e.months.every(unit))
  )
    return 'months must be twelve levels 0..1';
  if (
    e.activity !== undefined &&
    !['dawn', 'day', 'dusk', 'night'].every((k) => unit((e.activity as Record<string, unknown>)[k]))
  )
    return 'activity needs dawn, day, dusk and night levels 0..1';
  if (
    e.temperatureC !== undefined &&
    (!Array.isArray(e.temperatureC) ||
      e.temperatureC.length !== 2 ||
      !e.temperatureC.every((n) => typeof n === 'number' && Number.isFinite(n)))
  )
    return 'temperatureC is [silent below, full from]';
  if (
    e.habitats !== undefined &&
    (!Array.isArray(e.habitats) || !e.habitats.every((h) => typeof h === 'string'))
  )
    return 'habitats must be strings';
  if (
    e.settings !== undefined &&
    (!Array.isArray(e.settings) || !e.settings.every((s) => s === 'urban' || s === 'rural'))
  )
    return 'settings are urban and/or rural';
  if (e.gain !== undefined && (typeof e.gain !== 'number' || e.gain < 0 || e.gain > 2))
    return 'gain is 0..2';
  return undefined;
}

export async function loadSoundscapeCatalog(
  packs: AudioPackSetLike,
  sounds: ReadonlySet<string>,
  warn: (message: string) => void,
): Promise<SoundscapeEntry[] | undefined> {
  const provided = packs.provided('soundscape');
  if (provided.length === 0) return undefined;
  const entries = new Map<string, SoundscapeEntry>();
  for (const { pack, path } of provided) {
    const ref = `pack:${pack.manifest.id}/${path}`;
    try {
      const doc = (await packs.readJson(ref)) as { format?: unknown; entries?: unknown };
      if (doc?.format !== 'molen/earth-soundscape@1' || !Array.isArray(doc.entries))
        throw new Error('expected a molen/earth-soundscape@1 document with entries');
      for (const [i, entry] of doc.entries.entries()) {
        const issue = soundscapeEntryIssue(entry);
        if (issue) throw new Error(`entries[${i}]: ${issue}`);
        const e = entry as SoundscapeEntry;
        // A missing recording is skipped, not fatal: an older bank may lack new beds.
        if (!sounds.has(e.sound)) warn(`${ref}: ${e.sound} is not in the sound banks; skipped`);
        else entries.set(e.sound, e);
      }
    } catch (error) {
      warn(`${ref}: ${String(error)}`);
    }
  }
  return [...entries.values()].sort((a, b) => (a.sound < b.sound ? -1 : a.sound > b.sound ? 1 : 0));
}

function contains(
  [w, s, e, n]: [number, number, number, number],
  lat: number,
  lon: number,
): boolean {
  return lat >= s && lat < n && (w < e ? lon >= w && lon < e : lon >= w || lon < e);
}

function area([w, s, e, n]: [number, number, number, number]): number {
  return ((w < e ? e - w : 360 - w + e) * (n - s)) / 1;
}

const clamp = (n: number): number => Math.max(0, Math.min(1, n));

/** 0..1: how strongly an entry belongs to this place, season, hour and weather. */
export function soundscapeLevel(e: SoundscapeEntry, c: SoundscapeContext): number {
  if (!e.bounds.some((b) => contains(b, c.latitude, c.longitude))) return 0;
  if (e.settings && !e.settings.includes(c.urban ? 'urban' : 'rural')) return 0;
  // Unknown habitat (a built-up area, unloaded tiles) does not rule a bed out; other gates do.
  if (e.habitats && c.habitat !== undefined && !e.habitats.includes(c.habitat)) return 0;
  let level = e.gain ?? 1;
  if (e.months) {
    if (c.utcMs !== undefined && Number.isFinite(c.utcMs)) {
      const local = new Date(c.utcMs + c.longitude * 240_000);
      level *= e.months[local.getUTCMonth()] ?? 0;
    } else level *= e.months.reduce((a, b) => a + b, 0) / 12;
  }
  if (e.activity) {
    const a = e.activity;
    if (c.sunAltitudeDeg !== undefined && Number.isFinite(c.sunAltitudeDeg)) {
      // As for birdsong: civil twilight blends into the dawn/dusk level, day takes over by 25°.
      const morning =
        c.utcMs !== undefined ? new Date(c.utcMs + c.longitude * 240_000).getUTCHours() < 12 : true;
      const twilight = morning ? a.dawn : a.dusk;
      const day = clamp((c.sunAltitudeDeg - 5) / 20);
      const awake = clamp((c.sunAltitudeDeg + 8) / 8);
      level *= a.night * (1 - awake) + awake * (twilight * (1 - day) + a.day * day);
    } else if (c.solarHour !== undefined) {
      const h = c.solarHour;
      level *= h < 4.5 || h >= 21 ? a.night : h < 8 ? a.dawn : h < 17.5 ? a.day : a.dusk;
    }
  }
  if (e.temperatureC && c.temperatureC !== undefined)
    level *= warmth(c.temperatureC, e.temperatureC[0], e.temperatureC[1]);
  return Math.max(0, level);
}

/**
 * One bed per category: of the entries that belong here now, the most specific tier (one with a
 * habitat before one without, then the smallest area within four times the smallest) rotates
 * every 83–119 s, keyed by the 1° cell so a place keeps its own order.
 */
export function selectSoundscape(
  entries: readonly SoundscapeEntry[],
  c: SoundscapeContext,
  seconds: number,
): { chosen: Record<string, string>; levels: Record<string, number> } {
  const chosen: Record<string, string> = {};
  const levels: Record<string, number> = {};
  const byCategory = new Map<string, { e: SoundscapeEntry; level: number; size: number }[]>();
  for (const e of entries) {
    const level = soundscapeLevel(e, c);
    if (level < 0.02) continue;
    const size = Math.min(
      ...e.bounds.filter((b) => contains(b, c.latitude, c.longitude)).map(area),
    );
    const list = byCategory.get(e.category) ?? [];
    list.push({ e, level, size });
    byCategory.set(e.category, list);
  }
  const cell = `${Math.floor(c.latitude)}:${Math.floor(c.longitude)}`;
  for (const [category, list] of byCategory) {
    const habitatTier = list.some((x) => x.e.habitats) ? list.filter((x) => x.e.habitats) : list;
    const smallest = Math.min(...habitatTier.map((x) => x.size));
    const tier = habitatTier
      .filter((x) => x.size <= smallest * 4)
      .sort((a, b) => (a.e.sound < b.e.sound ? -1 : 1));
    const pick =
      tier[
        (Math.floor(Math.max(0, seconds) / (83 + (hash32(category) % 37))) +
          hash32(cell, category)) %
          tier.length
      ];
    if (!pick) continue;
    chosen[category] = pick.e.sound;
    levels[category] = Math.min(1, pick.level);
  }
  return { chosen, levels };
}
