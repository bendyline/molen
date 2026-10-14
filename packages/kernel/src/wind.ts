import { resolveWeather, type WeatherData } from '@bendyline/molen-schema';
import { dmath as m } from './dmath';
import { createRng } from './rng';

type Vec3 = [number, number, number];

/**
 * Deterministic wind around the weather's mean `atmosphere.windVelocity`: a power-law profile
 * with height above ground, turbulence advected with the mean wind (frozen turbulence with slow
 * eddy turnover), along-wind gusts, and slope flow that lifts air up a windward hillside and
 * drops it, rougher, in the lee. Everything is a pure function of the weather, the point and
 * the simulation time, so two aircraft crossing the same air feel the same bump and replays
 * and keyframes need no extra state. No simulation random numbers are consumed.
 */
export interface WindField {
  /**
   * Air velocity at `position` (world meters) and `time` (simulation seconds). `ground` is the
   * terrain height beneath the point (height above ground counts from 0 without it); `slope`
   * is the terrain gradient [dh/dx, dh/dz] there, from {@link terrainSlope}.
   */
  at(position: Vec3, time: number, ground?: number, slope?: [number, number]): Vec3;
  /** False when the field is the uniform mean wind (no shear, turbulence, gusts or terrain). */
  readonly structured: boolean;
  /** Whether slope flow is on, so a caller knows a terrain gradient is worth sampling. */
  readonly terrain: boolean;
}

interface Mode {
  k: Vec3;
  e: Vec3;
  phase: number;
  omega: number;
  amp: number;
}

const MODE_COUNT = 12;
const LONGEST_EDDY = 1200;
const SHORTEST_EDDY = 20;
/** Height above ground where the profile stops strengthening (top of the surface layer). */
const SHEAR_TOP = 600;
/** Convective/mechanical boundary layer depth; turbulence fades above it. */
const BOUNDARY_LAYER = 1000;

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function normalize(v: Vec3): Vec3 {
  const length = m.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

function buildModes(seed: number): { modes: Mode[]; norm: Vec3; gusts: Mode[]; patch: Mode } {
  const rng = createRng(`molen.wind:${seed}`);
  const unit = (): Vec3 => {
    const y = rng.range(-1, 1);
    const angle = rng.range(0, m.TAU);
    const r = m.sqrt(1 - y * y);
    return [r * m.cos(angle), y, r * m.sin(angle)];
  };
  const modes: Mode[] = [];
  const variance: Vec3 = [0, 0, 0];
  for (let i = 0; i < MODE_COUNT; i++) {
    const wavelength = LONGEST_EDDY * m.pow(SHORTEST_EDDY / LONGEST_EDDY, i / (MODE_COUNT - 1));
    const direction = unit();
    // Divergence-free: each eddy moves air across its own wave vector.
    const e = normalize(cross(direction, unit()));
    // Kolmogorov -5/3 energy spectrum in log-spaced bands: amplitude ∝ wavelength^(1/3).
    const amp = m.cbrt(wavelength / LONGEST_EDDY);
    const k = m.TAU / wavelength;
    modes.push({
      k: [direction[0] * k, direction[1] * k, direction[2] * k],
      e,
      phase: rng.range(0, m.TAU),
      // Eddy turnover at ~1.5 m/s keeps the pattern alive in still air.
      omega: k * 1.5 * rng.range(0.3, 1),
      amp,
    });
    for (let c = 0; c < 3; c++) variance[c] = (variance[c] ?? 0) + (amp * (e[c] ?? 0)) ** 2 / 2;
  }
  // Exactly unit RMS per component over the field, whatever the seed drew.
  const norm: Vec3 = [
    1 / m.sqrt(m.max(1e-9, variance[0])),
    1 / m.sqrt(m.max(1e-9, variance[1])),
    1 / m.sqrt(m.max(1e-9, variance[2])),
  ];
  // Gust fronts: three bands roughly across the wind (±25°), weights summing to 1.
  const gusts = [60, 150, 400].map((wavelength, i) => {
    const turn = rng.range(-0.44, 0.44);
    const k = m.TAU / wavelength;
    return {
      k: [m.cos(turn) * k, 0, m.sin(turn) * k] as Vec3,
      e: [0, 0, 0] as Vec3,
      phase: rng.range(0, m.TAU),
      omega: k * rng.range(0.1, 0.3),
      amp: [0.5, 0.3, 0.2][i] ?? 0,
    };
  });
  // Patches of smoother and rougher air a few kilometers across.
  const patchTurn = rng.range(0, m.TAU);
  const patch = {
    k: [(m.cos(patchTurn) * m.TAU) / 2600, 0, (m.sin(patchTurn) * m.TAU) / 2600] as Vec3,
    e: [0, 0, 0] as Vec3,
    phase: rng.range(0, m.TAU),
    omega: 0.004,
    amp: 1,
  };
  return { modes, norm, gusts, patch };
}

const modeCache = new Map<number, ReturnType<typeof buildModes>>();
function modesFor(seed: number): ReturnType<typeof buildModes> {
  let built = modeCache.get(seed);
  if (!built) {
    built = buildModes(seed);
    if (modeCache.size > 32) modeCache.clear();
    modeCache.set(seed, built);
  }
  return built;
}

const fields = new WeakMap<object, WindField>();

/** The wind field for a weather value; cached per (immutable) weather object. */
export function windField(weather: WeatherData): WindField {
  const cached = fields.get(weather);
  if (cached) return cached;
  const resolved = resolveWeather(weather);
  const mean = resolved.atmosphere.windVelocity;
  const { referenceHeight, shear, turbulence, gusts, terrain } = resolved.wind;
  const { modes, norm, gusts: gustModes, patch } = modesFor(resolved.seed);
  const structured = shear > 0 || turbulence > 0 || gusts > 0 || terrain > 0;
  const field: WindField = {
    structured,
    terrain: terrain > 0,
    at(position, time, ground, slope) {
      if (!structured) return [mean[0], mean[1], mean[2]];
      const agl = m.max(0, position[1] - (ground ?? 0));
      const profile = shear > 0 ? m.pow(m.clamp(agl, 1, SHEAR_TOP) / referenceHeight, shear) : 1;
      const wx = mean[0] * profile;
      const wz = mean[2] * profile;
      const speed = m.hypot(wx, wz);
      // Frozen turbulence carried downwind.
      const x = position[0] - wx * time;
      const y = position[1];
      const z = position[2] - wz * time;
      let wy = mean[1];
      let rotor = 0;
      if (terrain > 0 && slope) {
        // Air follows the ground: up a windward slope, down a lee slope, fading with height.
        const sx = m.clamp(slope[0], -1.5, 1.5);
        const sz = m.clamp(slope[1], -1.5, 1.5);
        const upslope = wx * sx + wz * sz;
        const fade = m.exp(-agl / 250);
        wy += terrain * upslope * fade;
        if (upslope < 0) rotor = terrain * m.min(1, -upslope / 3) * m.exp(-agl / 300);
      }
      const out: Vec3 = [wx, wy, wz];
      if (turbulence > 0) {
        const aloft =
          agl <= BOUNDARY_LAYER
            ? 1
            : m.max(0.15, 1 / (1 + ((agl - BOUNDARY_LAYER) / BOUNDARY_LAYER) ** 2));
        const patchiness =
          0.55 + 0.45 * m.sin(patch.k[0] * x + patch.k[2] * z + patch.omega * time + patch.phase);
        const sigma = turbulence * (2 + 0.15 * speed) * aloft * patchiness * (1 + rotor);
        // The ground blocks vertical eddies and feeds horizontal ones.
        const sigmaW = sigma * m.clamp(agl / 60, 0.1, 1);
        const sigmaU = sigma * (1 + 0.4 * (1 - m.clamp(agl / 300, 0, 1)));
        const u: Vec3 = [0, 0, 0];
        for (const mode of modes) {
          const s =
            mode.amp *
            m.sin(mode.k[0] * x + mode.k[1] * y + mode.k[2] * z + mode.omega * time + mode.phase);
          u[0] += mode.e[0] * s;
          u[1] += mode.e[1] * s;
          u[2] += mode.e[2] * s;
        }
        out[0] += u[0] * norm[0] * sigmaU;
        out[1] += u[1] * norm[1] * sigmaW;
        out[2] += u[2] * norm[2] * sigmaU;
      }
      if (gusts > 0 && speed > 0.01) {
        // Rotate the gust wave vectors into the wind direction.
        const cx = wx / speed;
        const cz = wz / speed;
        let g = 0;
        for (const mode of gustModes) {
          const kx = mode.k[0] * cx - mode.k[2] * cz;
          const kz = mode.k[0] * cz + mode.k[2] * cx;
          g += mode.amp * m.sin(kx * x + kz * z + mode.omega * time + mode.phase);
        }
        out[0] += cx * gusts * speed * g;
        out[2] += cz * gusts * speed * g;
      }
      return out;
    },
  };
  fields.set(weather, field);
  return field;
}

/**
 * Terrain gradient [dh/dx, dh/dz] by central differences `spacing` meters apart, or undefined
 * when any sample is unavailable (streaming terrain).
 */
export function terrainSlope(
  groundHeight: (x: number, z: number) => number | undefined,
  x: number,
  z: number,
  spacing = 30,
): [number, number] | undefined {
  const east = groundHeight(x + spacing, z);
  const west = groundHeight(x - spacing, z);
  const south = groundHeight(x, z + spacing);
  const north = groundHeight(x, z - spacing);
  if (
    east === undefined ||
    west === undefined ||
    south === undefined ||
    north === undefined ||
    !Number.isFinite(east + west + south + north)
  )
    return undefined;
  return [(east - west) / (2 * spacing), (south - north) / (2 * spacing)];
}

/**
 * Wind velocity at a world point and simulation time. With `groundHeight`, shear, turbulence
 * and slope flow use the height above the ground beneath the point; without it, world Y.
 */
export function sampleWind(
  weather: WeatherData,
  position: Vec3,
  time = 0,
  groundHeight?: (x: number, z: number) => number | undefined,
): Vec3 {
  const field = windField(weather);
  if (!field.structured || !groundHeight) return field.at(position, time);
  const ground = groundHeight(position[0], position[2]);
  const slope = field.terrain ? terrainSlope(groundHeight, position[0], position[2]) : undefined;
  return field.at(position, time, ground, slope);
}
