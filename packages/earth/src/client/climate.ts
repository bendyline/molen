/**
 * A rough air temperature for a place and time, for deciding whether insects and frogs call. A
 * weather preset carries one fixed temperature wherever it is applied (a "clear" sky is 22 °C in
 * Seattle in January too), so sound reads the climate instead: a zonal mean by latitude, a
 * seasonal swing that is smaller on the windward west coasts the oceans warm, the hour of the day,
 * and the lapse rate with height. Errors of a few degrees are expected and harmless here: a
 * catalog entry fades in over a range of temperatures, not at a threshold.
 */

/** [latitude, °C]: zonal mean sea-level air temperature, both hemispheres alike. */
const MEAN: readonly (readonly [number, number])[] = [
  [0, 27],
  [10, 26.5],
  [20, 25],
  [30, 20],
  [40, 14],
  [50, 8],
  [60, 1],
  [70, -8],
  [80, -18],
  [90, -25],
];

/** [latitude, °C]: half the gap between the warmest and coldest months, inland. */
const SWING: readonly (readonly [number, number])[] = [
  [0, 1],
  [10, 2],
  [20, 5],
  [30, 8],
  [40, 11],
  [50, 13],
  [60, 15],
  [70, 17],
  [90, 18],
];

/** Places where an ocean upwind evens the seasons out and warms the mean (WGS84 boxes). */
const MARITIME: readonly { box: [number, number, number, number]; swing: number; warm: number }[] =
  [
    // Western Europe and the British Isles, under the North Atlantic Drift.
    { box: [-11, 42, 16, 72], swing: 0.55, warm: 4 },
    // The Pacific Northwest and British Columbia coast, west of the Cascades.
    { box: [-135, 40, -121.5, 60], swing: 0.55, warm: 2.5 },
    // California's coast: cool summers, mild winters.
    { box: [-125, 32, -117, 40], swing: 0.5, warm: 0 },
    // New Zealand and Tasmania.
    { box: [148, -48, 179, -34], swing: 0.6, warm: 0 },
    // Australia's east coast, under the East Australian Current.
    { box: [145, -39, 154, -10], swing: 0.55, warm: 0.5 },
    // Hawaii: trade winds over warm water, almost no seasons.
    { box: [-161, 18, -154, 23], swing: 0.4, warm: 2 },
    // Florida, the Gulf coast's south and the Caribbean.
    { box: [-90, 10, -59, 28], swing: 0.5, warm: 1.5 },
    // Southern Chile.
    { box: [-76, -56, -71, -36], swing: 0.6, warm: 0 },
  ];

function table(points: readonly (readonly [number, number])[], x: number): number {
  const first = points[0] as readonly [number, number];
  if (x <= first[0]) return first[1];
  for (let i = 1; i < points.length; i++) {
    const b = points[i] as readonly [number, number];
    if (x <= b[0]) {
      const a = points[i - 1] as readonly [number, number];
      return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
    }
  }
  return (points[points.length - 1] as readonly [number, number])[1];
}

function inBox(lat: number, lon: number, [w, s, e, n]: [number, number, number, number]): boolean {
  return lat >= s && lat < n && lon >= w && lon < e;
}

export interface ClimateQuery {
  latitude: number;
  longitude: number;
  /** The scene's sky time; without it the annual mean stands in for the season. */
  utcMs?: number;
  /** Local solar hour 0..24; without it the daily mean. */
  solarHour?: number;
  /** Ground height above sea level, m. */
  elevationM?: number;
}

/** Estimated air temperature in °C. */
export function climateTemperatureC(q: ClimateQuery): number {
  const lat = Math.max(-90, Math.min(90, q.latitude));
  const lon = ((((q.longitude + 180) % 360) + 360) % 360) - 180;
  const sea = MARITIME.find((m) => inBox(lat, lon, m.box));
  let t = table(MEAN, Math.abs(lat)) + (sea?.warm ?? 0);
  if (q.utcMs !== undefined && Number.isFinite(q.utcMs)) {
    const day = (q.utcMs + lon * 240_000) / 86_400_000;
    const yearDay = ((day % 365.2425) + 365.2425) % 365.2425;
    // The warmest day lags the solstice by about four weeks: 19 July north, 17 January south.
    const peak = lat >= 0 ? 200 : 17;
    const swing = table(SWING, Math.abs(lat)) * (sea?.swing ?? 1);
    t += swing * Math.cos((2 * Math.PI * (yearDay - peak)) / 365.2425);
  }
  if (q.solarHour !== undefined && Number.isFinite(q.solarHour)) {
    // Warmest at 15:00, coolest before dawn; a smaller swing by the sea and in the wet tropics.
    const diurnal = sea ? 3 : Math.abs(lat) < 15 ? 3.5 : 5;
    t += diurnal * Math.cos((2 * Math.PI * (q.solarHour - 15)) / 24);
  }
  return t - 0.0065 * Math.max(0, q.elevationM ?? 0);
}

/** 0 below `silentC`, 1 from `fullC`, linear between. */
export function warmth(temperatureC: number, silentC: number, fullC: number): number {
  if (fullC <= silentC) return temperatureC >= fullC ? 1 : 0;
  return Math.max(0, Math.min(1, (temperatureC - silentC) / (fullC - silentC)));
}
