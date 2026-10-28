// Import the public-domain OurAirports records already cached by Qualla. No runtime dependency.
// node packages/earth/scripts/import-airports.mjs ../qualla-internal/_c/airports
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = resolve(process.argv[2] ?? '../qualla-internal/_c/airports');
const out = resolve('content/earth/airports');
const cells = new Map();
const round = (n) => Math.round(n * 1e6) / 1e6;
const xy = ([lon, lat]) => [
  Math.max(0, Math.min(15, Math.floor(((lon + 180) / 360) * 16))),
  Math.max(
    0,
    Math.min(15, Math.floor((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) * 8)),
  ),
];
const point = (p) =>
  p &&
  Number.isFinite(p.lng) &&
  Number.isFinite(p.lat) &&
  Math.abs(p.lng) <= 180 &&
  Math.abs(p.lat) < 85
    ? [round(p.lng), round(p.lat)]
    : undefined;
const digest = createHash('sha256');
let airports = 0,
  runways = 0;
for (const file of (await readdir(source, { recursive: true }))
  .filter((f) => f.endsWith('.json'))
  .sort()) {
  const bytes = await readFile(resolve(source, file));
  const record = JSON.parse(bytes);
  if (!['small_airport', 'medium_airport', 'large_airport'].includes(record.type)) continue;
  const strips = record.runways.flatMap((r) => {
    const a = point(r.leCoordinates),
      b = point(r.heCoordinates);
    if (
      r.closed ||
      !a ||
      !b ||
      /water/i.test(r.surface) ||
      !(r.lengthFt > 250) ||
      !(r.widthFt > 0) ||
      r.widthFt > 1000
    )
      return [];
    if (
      Math.abs(a[0] - b[0]) > 1 ||
      Math.abs(a[1] - b[1]) > 0.2 ||
      JSON.stringify(a) === JSON.stringify(b)
    )
      return [];
    return [
      {
        id: r.id,
        ends: [a, b],
        width: round(r.widthFt * 0.3048),
        surface: r.surface,
        lighted: r.lighted,
      },
    ];
  });
  if (!strips.length) continue;
  digest.update(bytes);
  const airport = {
    id: record.icao,
    name: record.name,
    type: record.type,
    ...(record.scheduledService === undefined
      ? {}
      : {
          scheduledService: record.scheduledService === true || record.scheduledService === 'yes',
        }),
    runways: strips,
  };
  const occupied = new Set();
  for (const r of strips) {
    // Register both sides of a cell boundary, including a pavement-width margin.
    const a = xy([
      Math.min(...r.ends.map((p) => p[0])) - 0.002,
      Math.max(...r.ends.map((p) => p[1])) + 0.002,
    ]);
    const b = xy([
      Math.max(...r.ends.map((p) => p[0])) + 0.002,
      Math.min(...r.ends.map((p) => p[1])) - 0.002,
    ]);
    for (let x = a[0]; x <= b[0]; x++) for (let y = a[1]; y <= b[1]; y++) occupied.add(`${x}-${y}`);
  }
  for (const key of occupied) {
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(airport);
  }
  airports++;
  runways += strips.length;
}
await mkdir(`${out}/cells`, { recursive: true });
const paths = {};
for (const [key, entries] of [...cells].sort(([a], [b]) => a.localeCompare(b, 'en'))) {
  paths[key] = `airports/cells/${key}.json`;
  await writeFile(resolve('content/earth', paths[key]), `${JSON.stringify(entries)}\n`);
}
await writeFile(
  `${out}/index.json`,
  `${JSON.stringify(
    {
      format: 'molen/airports@1',
      level: 4,
      cells: paths,
      layouts: ['airports/layouts/kbfi.json'],
      attribution: [
        {
          text: 'OurAirports; runway endpoints and dimensions',
          license: 'Public domain',
          sourceUrl: 'https://ourairports.com/data/',
        },
        {
          text: 'OpenStreetMap airport layouts',
          license: 'ODbL-1.0',
          sourceUrl: 'https://www.openstreetmap.org/copyright',
        },
      ],
    },
    null,
    2,
  )}\n`,
);
await writeFile(
  `${out}/provenance.json`,
  `${JSON.stringify({ source: 'https://ourairports.com/data/', license: 'Public domain', importedFrom: 'Qualla OurAirports JSON cache', inputSha256: digest.digest('hex'), airports, runways, omissions: 'Closed/water runways and records without valid endpoints or dimensions. No headings or airport centres are used to invent endpoints.' }, null, 2)}\n`,
);
console.log({ airports, runways, cells: cells.size });
