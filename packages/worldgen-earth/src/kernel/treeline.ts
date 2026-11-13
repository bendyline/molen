import { projectWgs84 } from './projection';

// Alpine tree line by latitude, in meters above sea level: where mountain forest gives out,
// from about 3,900 m in the tropics to a few hundred meters toward the poles. Southern tree
// lines outside the tropics stand much lower (about 1,300 m in New Zealand's Southern Alps
// against 2,300 m in the Alps at the same latitude). A coarse climatic prior, as the plant
// calendar is: no aspect, continentality or local species. The arctic tree line at sea level is
// the ecological atlas's tundra, not this.
const NORTH: readonly (readonly [latitude: number, height: number])[] = [
  [0, 3900],
  [25, 3900],
  [35, 3500],
  [45, 2400],
  [55, 1600],
  [65, 800],
  [75, 400],
];
const SOUTH: readonly (readonly [latitude: number, height: number])[] = [
  [0, 3900],
  [25, 3900],
  [35, 2300],
  [45, 1300],
  [55, 700],
  [65, 400],
  [75, 300],
];

/**
 * The height above which trees and brush do not grow, by world Z (+Z south), for scatter's
 * `treeline`. Stands thin out below it; see `TREELINE_FADE` in the worldgen kernel.
 */
export function alpineTreeline(metersPerUnit: number): (z: number) => number {
  const stops = (table: typeof NORTH): [z: number, height: number][] =>
    table.map(([latitude, height]) => [
      Math.abs(projectWgs84(0, latitude)[1]) * metersPerUnit,
      height,
    ]);
  const north = stops(NORTH);
  const south = stops(SOUTH);
  return (z) => {
    const table = z > 0 ? south : north;
    const distance = Math.abs(z);
    for (let i = 1; i < table.length; i++) {
      const [far, height] = table[i] as [number, number];
      if (distance > far) continue;
      const [near, lower] = table[i - 1] as [number, number];
      return lower + ((height - lower) * (distance - near)) / (far - near);
    }
    return (table.at(-1) as [number, number])[1];
  };
}
