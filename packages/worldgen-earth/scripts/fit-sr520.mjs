/** Fit the authored +X floating section to centerline pairs decoded from the bundled
 * Protomaps 2026-09-25 z15 roads. Run from the repository root. This is a visual fit,
 * not a survey; the roads do not encode the pontoon/approach transition stations. */
import { readFile, writeFile } from 'node:fs/promises';
import { wgs84ToWorld, worldToWgs84 } from '@bendyline/molen-terrain/kernel';

const path = 'content/earth/structures/placements.json';
const doc = JSON.parse(await readFile(path, 'utf8'));
const pairs = [
  [-122.26701736450195, 47.64198615965722, 47.64211446842856],
  [-122.25603103637695, 47.64026209292493, 47.64040667093707],
  [-122.24470138549805, 47.63846929233432, 47.63864640642154],
];
const scale = Math.cos((47.64075 * Math.PI) / 180);
const points = pairs.map(([lon, a, b]) => wgs84ToWorld(scale, lon, (a + b) / 2));
const mean = [0, 1].map((i) => points.reduce((s, p) => s + p[i], 0) / points.length);
const slope =
  points.reduce((s, p) => s + (p[0] - mean[0]) * (p[1] - mean[1]), 0) /
  points.reduce((s, p) => s + (p[0] - mean[0]) ** 2, 0);
const heading = -Math.atan(slope);
const x = wgs84ToWorld(scale, -122.2587, 47.64075)[0];
// Authored carriageway center is 1.2 m south of the model origin (north-side trail).
const anchorWorld = [
  x - Math.sin(-heading) * 1.2,
  mean[1] + slope * (x - mean[0]) - Math.cos(heading) * 1.2,
];
const anchor = worldToWgs84(scale, ...anchorWorld);
const endpoints = [-1175, 1175].map((d) =>
  worldToWgs84(
    scale,
    anchorWorld[0] + Math.cos(heading) * d,
    anchorWorld[1] - Math.sin(heading) * d,
  ),
);
const pad = 0.0015; // include 100 m approach transitions in indexed queries
Object.assign(
  doc.entries.find((e) => e.id === 'seattle.sr-520-floating-bridge'),
  {
    anchor,
    heading,
    datum: 'sea-level',
    elevation: 5.76,
    bounds: [
      endpoints[0][0] - pad,
      endpoints[1][1] - pad,
      endpoints[1][0] + pad,
      endpoints[0][1] + pad,
    ],
    replaceRoads: { length: 2350, width: 50, deckHeight: 6.096 },
    status: 'preview',
    source:
      'https://wsdot.wa.gov/construction-planning/search-projects/sr-520-floating-bridge-and-landings-project',
    note: 'Current crossing: +X follows the fitted eastbound direction; north-side trail. 2350 m floating section aligned to the paired carriageways in bundled Protomaps 2026-09-25 z15 roads. Water datum 5.76 m matches the sample elevation plus water offset; deck 6.096 m above it. Extent streams clipped sections, replacing mapped bridge roads inside the span. Approach spans are inferred; end stations and terrain datum are visual approximations, not a survey.',
  },
);
await writeFile(path, `${JSON.stringify(doc, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      anchor,
      heading,
      degrees: (heading * 180) / Math.PI,
      endpoints,
      centerlineResidualMeters: points.map(
        (p) => (p[1] - mean[1] - slope * (p[0] - mean[0])) / Math.hypot(1, slope),
      ),
    },
    null,
    2,
  ),
);
