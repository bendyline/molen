// Tests and scripts: hear a place, season and hour with the real molen.sounds documents, headless.
// The recording backend logs every voice command, so beds and scheduled events can be counted.
import { readFileSync } from 'node:fs';
import type { RecordingBackend, VoiceCommand } from '@bendyline/molen-client/audio';
import type { WeatherData } from '@bendyline/molen-schema';
import { createEarthAudio, type EarthAudioFrame } from '../src/client/audio';
import type { EarthAudioTerrainSample } from '../src/client/audio-terrain';

const content = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../../content/sounds/${name}`, import.meta.url), 'utf8'));

/** The roles, read from the pack source itself so a renamed or invalid role fails here too. */
const ROLES: Record<string, string> = (() => {
  const { provides } = content('molen-pack.source.json') as {
    provides: Record<string, string | string[]>;
  };
  return Object.fromEntries(
    Object.entries(provides).map(([role, paths]) => [role, [paths].flat()[0] as string]),
  );
})();

/** A pack set over the repository's content/sounds, as the sound pack would provide it. */
export function soundPacks(roles: readonly string[] = Object.keys(ROLES)) {
  return {
    provided: (role: string) =>
      roles.includes(role) && ROLES[role]
        ? [{ pack: { manifest: { id: 'molen.sounds' } }, path: ROLES[role] as string }]
        : [],
    readJson: async <T>(ref: string) => content(ref.slice(ref.lastIndexOf('/') + 1)) as T,
    assetProvider: () => ({ load: async () => new ArrayBuffer(0), loadText: async () => '' }),
  };
}

export interface Place {
  latitude: number;
  longitude: number;
}

export interface Listening {
  /** 0 = January. */
  month: number;
  /** Local solar hour. */
  hour: number;
  seconds?: number;
  weather?: WeatherData;
  mode?: string;
  inVehicle?: boolean;
  terrain?: Partial<EarthAudioTerrainSample>;
  habitat?: string;
  heightAboveGround?: number;
}

/** The sun's altitude, degrees: declination by month and the hour angle. */
function sunAltitude(latitude: number, month: number, hour: number): number {
  const day = month * 30.4 + 15;
  const declination = 23.44 * Math.sin((2 * Math.PI * (284 + day)) / 365);
  const r = Math.PI / 180;
  const h = (hour - 12) * 15;
  return (
    Math.asin(
      Math.sin(latitude * r) * Math.sin(declination * r) +
        Math.cos(latitude * r) * Math.cos(declination * r) * Math.cos(h * r),
    ) / r
  );
}

export interface Heard {
  /** Loops playing at the end, with their level before master volume. */
  loops: { sound: string; gain: number }[];
  /** Every one-shot started, by sound. */
  shots: Record<string, number>;
  isolationDb: number;
}

/** Listen at a place for a while (60 s by default) and report what played. */
export async function listen(place: Place, at: Listening): Promise<Heard> {
  const sky = { frame: { daylight: 1 } };
  const renderer = {
    camera: { matrixWorld: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 2, 0, 1] } },
    getWorldOrigin: () => [0, 0, 0],
    sky,
  };
  const audio = await createEarthAudio(soundPacks(), renderer, {
    music: false,
    onWarning: () => {},
  });
  if (!audio) throw new Error('no sound bank');
  const altitude = sunAltitude(place.latitude, at.month, at.hour);
  sky.frame.daylight = Math.max(0, Math.min(1, (altitude + 6) / 18));
  // The UTC instant whose local solar time at this longitude is `hour` on the 15th.
  const utcMs = Date.UTC(2026, at.month, 15, 0) + (at.hour - place.longitude / 15) * 3_600_000;
  const height = at.heightAboveGround ?? 1.7;
  const frame: Omit<EarthAudioFrame, 'nowMs'> = {
    mode: at.mode ?? 'walk',
    position: [0, height, 0],
    heightAboveGround: height,
    location: { ...place, utcMs, sunAltitudeDeg: altitude },
    solarHour: at.hour,
    ...(at.weather ? { weather: at.weather } : {}),
    ...(at.inVehicle !== undefined ? { inVehicle: at.inVehicle } : {}),
    terrain: {
      streetDistance: Infinity,
      coastDistance: Infinity,
      riverDistance: Infinity,
      ...at.terrain,
    },
    regionalAmbience: { birds: 1, insects: 1, habitat: at.habitat ?? 'grass' },
  };
  const end = (at.seconds ?? 60) * 1000;
  for (let nowMs = 0; nowMs <= end; nowMs += 250) audio.update({ ...frame, nowMs });
  const log = (audio.layer.backend as RecordingBackend).log as VoiceCommand[];
  const shots: Record<string, number> = {};
  for (const cmd of log)
    if (cmd.op === 'start' && !cmd.loop) shots[cmd.sound] = (shots[cmd.sound] ?? 0) + 1;
  const heard: Heard = {
    loops: audio.layer.director
      .voices()
      .filter((v) => v.loop)
      .map((v) => ({ sound: v.sound, gain: Math.round(v.gain * 1000) / 1000 })),
    shots,
    isolationDb: audio.layer.director.currentEnclosure.isolationDb,
  };
  audio.dispose();
  return heard;
}

export const PLACES = {
  seattle: { latitude: 47.61, longitude: -122.33 },
  chicago: { latitude: 41.88, longitude: -87.63 },
  tokyo: { latitude: 35.68, longitude: 139.76 },
  kyoto: { latitude: 35.01, longitude: 135.77 },
  bengaluru: { latitude: 12.97, longitude: 77.59 },
  delhi: { latitude: 28.61, longitude: 77.21 },
  london: { latitude: 51.51, longitude: -0.13 },
  paris: { latitude: 48.86, longitude: 2.35 },
  montpellier: { latitude: 43.61, longitude: 3.88 },
  sydney: { latitude: -33.87, longitude: 151.21 },
  honolulu: { latitude: 21.31, longitude: -157.86 },
  telAviv: { latitude: 32.08, longitude: 34.78 },
  miami: { latitude: 25.76, longitude: -80.19 },
  hanoi: { latitude: 21.03, longitude: 105.85 },
  cairo: { latitude: 30.04, longitude: 31.24 },
  saoPaulo: { latitude: -23.55, longitude: -46.63 },
} satisfies Record<string, Place>;
