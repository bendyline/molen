import type { EarthObserver, SkyTime, Vec3 } from '@bendyline/molen-schema';

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const EARTH_KM = 6378.137;
const AU_KM = 149_597_870.7;
const sin = (degrees: number): number => Math.sin(degrees * RAD);
const cos = (degrees: number): number => Math.cos(degrees * RAD);
const atan2 = (y: number, x: number): number => Math.atan2(y, x) / RAD;
const wrap = (degrees: number): number => ((degrees % 360) + 360) % 360;

export interface CelestialPosition {
  /** Unit vector toward the body; Y-up, default +X east / -Z north. */
  direction: Vec3;
  /** Geometric topocentric altitude; no atmospheric refraction. */
  altitudeDeg: number;
  /** Clockwise from geographic north, before northOffsetDeg. */
  azimuthDeg: number;
  distanceKm: number;
  angularDiameterDeg: number;
}

export interface EarthSkyState {
  utcMs: number;
  julianDate: number;
  sun: CelestialPosition;
  moon: CelestialPosition & {
    illuminatedFraction: number;
    /** Synodic cycle: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter. */
    phase: number;
  };
  /** Columns transforming J2000 equatorial Cartesian coordinates into the local world. */
  starBasis: [Vec3, Vec3, Vec3];
}

/** Explicit, seekable simulation clock; no implicit Date.now or browser timezone. */
export function skyTimeMs(time: SkyTime, simulationSeconds = 0): number {
  const utcMs = time.epochMs + simulationSeconds * (time.scale ?? 1) * 1000;
  if (![time.epochMs, time.scale ?? 1, simulationSeconds, utcMs].every(Number.isFinite)) {
    throw new Error('Sky time must be finite');
  }
  if (utcMs < -2208988800000 || utcMs > 4133980799999) {
    throw new Error('Earth sky supports UTC dates from 1900 through 2100');
  }
  return utcMs;
}

/** Normalize without accepting zero or nonfinite vectors at the public rendering boundary. */
export function skyDirection(value: Vec3): Vec3 {
  const length = Math.hypot(...value);
  if (!Number.isFinite(length) || length === 0)
    throw new Error('Sky direction must be finite and nonzero');
  return [value[0] / length, value[1] / length, value[2] / length];
}

function orbit(
  anomaly: number,
  eccentricity: number,
  radius: number,
): { angle: number; radius: number } {
  const mean = wrap(anomaly) * RAD;
  let eccentric = mean + eccentricity * Math.sin(mean);
  for (let i = 0; i < 5; i++) {
    eccentric -=
      (eccentric - eccentricity * Math.sin(eccentric) - mean) /
      (1 - eccentricity * Math.cos(eccentric));
  }
  const x = Math.cos(eccentric) - eccentricity;
  const y = Math.sqrt(1 - eccentricity * eccentricity) * Math.sin(eccentric);
  return { angle: atan2(y, x), radius: radius * Math.hypot(x, y) };
}

function ecliptic(longitude: number, latitude: number, radius: number, obliquity: number): Vec3 {
  const x = radius * cos(longitude) * cos(latitude);
  const y = radius * sin(longitude) * cos(latitude);
  const z = radius * sin(latitude);
  return [x, y * cos(obliquity) - z * sin(obliquity), y * sin(obliquity) + z * cos(obliquity)];
}

function horizontal(vector: Vec3, latitude: number, sidereal: number, northOffset: number): Vec3 {
  const meridian = cos(sidereal) * vector[0] + sin(sidereal) * vector[1];
  const east = -sin(sidereal) * vector[0] + cos(sidereal) * vector[1];
  const north = -sin(latitude) * meridian + cos(latitude) * vector[2];
  const up = cos(latitude) * meridian + sin(latitude) * vector[2];
  return [
    east * cos(northOffset) + north * sin(northOffset),
    up,
    east * sin(northOffset) - north * cos(northOffset),
  ];
}

// IAU 1976 precession from J2000 to the date; ample for naked-eye stars in 1900–2100.
function precess(vector: Vec3, centuries: number): Vec3 {
  const t = centuries;
  const zeta = (2306.2181 * t + 0.30188 * t * t + 0.017998 * t ** 3) / 3600;
  const z = (2306.2181 * t + 1.09468 * t * t + 0.018203 * t ** 3) / 3600;
  const theta = (2004.3109 * t - 0.42665 * t * t - 0.041833 * t ** 3) / 3600;
  const x = vector[0] * cos(zeta) - vector[1] * sin(zeta);
  const y = vector[0] * sin(zeta) + vector[1] * cos(zeta);
  const b = x * cos(theta) - vector[2] * sin(theta);
  return [
    b * cos(z) - y * sin(z),
    b * sin(z) + y * cos(z),
    x * sin(theta) + vector[2] * cos(theta),
  ];
}

/**
 * Compact Earth ephemeris: Keplerian Sun + Moon with the major lunar perturbations,
 * ellipsoidal observer parallax, sidereal rotation and stellar precession.
 * Formula reference: https://www.stjarnhimlen.se/comp/ppcomp.html (Paul Schlyter).
 * Intended for visual skies, not navigation: no refraction, nutation, eclipses, or light time.
 */
export function evaluateEarthSky(utcMs: number, observer: EarthObserver): EarthSkyState {
  skyTimeMs({ epochMs: utcMs });
  const { latitude, longitude } = observer;
  const elevation = observer.elevation ?? 0;
  const offset = observer.northOffsetDeg ?? 0;
  if (
    ![latitude, longitude, elevation, offset].every(Number.isFinite) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180 ||
    elevation < -500 ||
    elevation > 100000
  ) {
    throw new Error('Invalid Earth sky observer');
  }
  const julianDate = utcMs / DAY_MS + 2440587.5;
  const d = julianDate - 2451543.5;
  const t = (julianDate - 2451545) / 36525;
  const sidereal = wrap(
    280.46061837 +
      360.98564736629 * (julianDate - 2451545) +
      0.000387933 * t * t -
      t ** 3 / 38710000 +
      longitude,
  );
  const obliquity = 23.4393 - 3.563e-7 * d;
  const solarMean = wrap(356.047 + 0.9856002585 * d);
  const solarPerihelion = 282.9404 + 4.70935e-5 * d;
  const solarOrbit = orbit(solarMean, 0.016709 - 1.151e-9 * d, 1);
  const solarLongitude = solarOrbit.angle + solarPerihelion;
  const sunVector = ecliptic(solarLongitude, 0, solarOrbit.radius * AU_KM, obliquity);

  const node = wrap(125.1228 - 0.0529538083 * d);
  const perihelion = wrap(318.0634 + 0.1643573223 * d);
  const lunarMean = wrap(115.3654 + 13.0649929509 * d);
  const lunarOrbit = orbit(lunarMean, 0.0549, 60.2666);
  const argument = lunarOrbit.angle + perihelion;
  const x = cos(node) * cos(argument) - sin(node) * sin(argument) * cos(5.1454);
  const y = sin(node) * cos(argument) + cos(node) * sin(argument) * cos(5.1454);
  const z = sin(argument) * sin(5.1454);
  const elongation = lunarMean + perihelion + node - solarMean - solarPerihelion;
  const f = lunarMean + perihelion;
  const m = lunarMean;
  const s = solarMean;
  const e = elongation;
  const lunarLongitude =
    atan2(y, x) -
    1.274 * sin(m - 2 * e) +
    0.658 * sin(2 * e) -
    0.186 * sin(s) -
    0.059 * sin(2 * m - 2 * e) -
    0.057 * sin(m - 2 * e + s) +
    0.053 * sin(m + 2 * e) +
    0.046 * sin(2 * e - s) +
    0.041 * sin(m - s) -
    0.035 * sin(e) -
    0.031 * sin(m + s) -
    0.015 * sin(2 * f - 2 * e) +
    0.011 * sin(m - 4 * e);
  const lunarLatitude =
    atan2(z, Math.hypot(x, y)) -
    0.173 * sin(f - 2 * e) -
    0.055 * sin(m - f - 2 * e) -
    0.046 * sin(m + f - 2 * e) +
    0.033 * sin(f + 2 * e) +
    0.017 * sin(2 * m + f);
  const lunarDistance = (lunarOrbit.radius - 0.58 * cos(m - 2 * e) - 0.46 * cos(2 * e)) * EARTH_KM;
  const moonVector = ecliptic(lunarLongitude, lunarLatitude, lunarDistance, obliquity);

  // WGS84 observer in Earth-centered equatorial coordinates, rotated by local sidereal time.
  const n = EARTH_KM / Math.sqrt(1 - 0.00669437999014 * sin(latitude) ** 2);
  const rho = (n + elevation / 1000) * cos(latitude);
  const observerVector: Vec3 = [
    rho * cos(sidereal),
    rho * sin(sidereal),
    (n * (1 - 0.00669437999014) + elevation / 1000) * sin(latitude),
  ];
  const position = (vector: Vec3, radius: number): CelestialPosition => {
    const local = horizontal(
      [vector[0] - observerVector[0], vector[1] - observerVector[1], vector[2] - observerVector[2]],
      latitude,
      sidereal,
      0,
    );
    const distanceKm = Math.hypot(...local);
    return {
      direction: skyDirection(
        horizontal(
          [
            vector[0] - observerVector[0],
            vector[1] - observerVector[1],
            vector[2] - observerVector[2],
          ],
          latitude,
          sidereal,
          offset,
        ),
      ),
      altitudeDeg: atan2(local[1], Math.hypot(local[0], local[2])),
      azimuthDeg: wrap(atan2(local[0], -local[2])),
      distanceKm,
      angularDiameterDeg: (2 * Math.asin(radius / distanceKm)) / RAD,
    };
  };
  const moonToSun = skyDirection([
    sunVector[0] - moonVector[0],
    sunVector[1] - moonVector[1],
    sunVector[2] - moonVector[2],
  ]);
  const moonToObserver = skyDirection([
    observerVector[0] - moonVector[0],
    observerVector[1] - moonVector[1],
    observerVector[2] - moonVector[2],
  ]);
  const illuminatedFraction =
    (1 + moonToSun.reduce((sum, value, i) => sum + value * (moonToObserver[i] ?? 0), 0)) / 2;
  const basis = (v: Vec3): Vec3 => horizontal(precess(v, t), latitude, sidereal, offset);
  return {
    utcMs,
    julianDate,
    sun: position(sunVector, 695700),
    moon: {
      ...position(moonVector, 1737.4),
      illuminatedFraction,
      phase: wrap(lunarLongitude - solarLongitude) / 360,
    },
    starBasis: [basis([1, 0, 0]), basis([0, 1, 0]), basis([0, 0, 1])],
  };
}

/** Map a catalog J2000 position (degrees) through a sampled Earth's star basis. */
export function starDirection(
  rightAscensionDeg: number,
  declinationDeg: number,
  state: EarthSkyState,
): Vec3 {
  if (
    !Number.isFinite(rightAscensionDeg) ||
    !Number.isFinite(declinationDeg) ||
    Math.abs(declinationDeg) > 90
  )
    throw new Error('Invalid stellar coordinates');
  const equatorial = [
    cos(rightAscensionDeg) * cos(declinationDeg),
    sin(rightAscensionDeg) * cos(declinationDeg),
    sin(declinationDeg),
  ];
  return [0, 1, 2].map((axis) =>
    state.starBasis.reduce((sum, basis, i) => sum + (basis[axis] ?? 0) * (equatorial[i] ?? 0), 0),
  ) as Vec3;
}
