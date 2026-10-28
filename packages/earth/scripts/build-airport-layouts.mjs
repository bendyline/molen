// Rebuild the detailed Boeing Field overlay from the retained OSM extract, entirely offline.
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const source = 'content/earth/source/airports';
const doc = JSON.parse(await readFile(`${source}/kbfi.osm.json`, 'utf8'));
const boundaryDoc = JSON.parse(await readFile(`${source}/kbfi-boundary.json`, 'utf8'));
const nodes = new Map(
  boundaryDoc.elements.filter((e) => e.type === 'node').map((e) => [e.id, [e.lon, e.lat]]),
);
const relation = boundaryDoc.elements.find((e) => e.type === 'relation' && e.tags?.icao === 'KBFI');
const parts = relation.members
  .filter((m) => m.role === 'outer')
  .map((m) => [...boundaryDoc.elements.find((e) => e.type === 'way' && e.id === m.ref).nodes]);
const ring = parts.shift();
while (parts.length) {
  const i = parts.findIndex((p) => p[0] === ring.at(-1) || p.at(-1) === ring.at(-1));
  if (i < 0) throw new Error('Airport boundary is not connected');
  const p = parts.splice(i, 1)[0];
  if (p[0] !== ring.at(-1)) p.reverse();
  ring.push(...p.slice(1));
}
const outer = ring.map((id) => nodes.get(id));
const inside = ([x, y]) => {
  let yes = false;
  for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
    const a = outer[i],
      b = outer[j];
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0])
      yes = !yes;
  }
  return yes;
};
const tile = {
  format: 'molen/terrain-semantics@1',
  landcover: [{ id: 'osm:relation:537472', class: 'aerodrome', density: 0, polygons: [{ outer }] }],
  water: [],
  transportation: [],
  buildings: [],
  pois: [],
};
const retained = [];
for (const e of doc.elements) {
  const t = e.tags ?? {};
  if (!e.geometry) continue;
  const points = e.geometry.map((p) => [p.lon, p.lat]);
  const center = points.reduce(
    (a, p) => [a[0] + p[0] / points.length, a[1] + p[1] / points.length],
    [0, 0],
  );
  if (!inside(center)) continue;
  retained.push(e);
  const common = { id: e.id, ...(t.name ? { name: t.name } : {}) };
  if (['taxiway', 'taxilane', 'parking_position'].includes(t.aeroway)) {
    tile.transportation.push({
      ...common,
      class: 'aeroway',
      subclass: t.aeroway,
      ...(t.ref ? { ref: t.ref } : {}),
      width: Number.parseFloat(t.width) || 18,
      surface: t.surface ?? 'asphalt',
      lines: [points],
    });
  } else if (t.aeroway === 'apron') {
    tile.landcover.push({ id: e.id, class: 'apron', density: 0, polygons: [{ outer: points }] });
  } else if (t.building || ['hangar', 'terminal'].includes(t.aeroway)) {
    const kind =
      t.aeroway === 'hangar' || t.building === 'hangar'
        ? 'hangar'
        : t.aeroway === 'terminal'
          ? 'terminal'
          : t.building;
    tile.buildings.push({
      ...common,
      class: kind,
      height: Number.parseFloat(t.height) || (kind === 'hangar' ? 10 : kind === 'terminal' ? 9 : 7),
      polygons: [{ outer: points }],
      tags: { building: kind },
    });
  }
}
// A bounded source extract, retaining source ids/tags/geometry and original source timestamp.
await writeFile(`${source}/kbfi.osm.json`, `${JSON.stringify({ ...doc, elements: retained })}\n`);
await mkdir('content/earth/airports/layouts', { recursive: true });
const bounds = [
  Math.min(...outer.map((p) => p[0])),
  Math.min(...outer.map((p) => p[1])),
  Math.max(...outer.map((p) => p[0])),
  Math.max(...outer.map((p) => p[1])),
];
await writeFile(
  'content/earth/airports/layouts/kbfi.json',
  `${JSON.stringify({
    id: 'KBFI',
    profile: 'mixed',
    bounds,
    tile,
    activityZones: [
      { center: [-122.2972606687, 47.5272257078], radius: 23 },
      { center: [-122.3010953835, 47.533269145], radius: 23 },
    ],
  })}\n`,
);
console.log({
  buildings: tile.buildings.length,
  transportation: tile.transportation.length,
  aprons: tile.landcover.length - 1,
});
