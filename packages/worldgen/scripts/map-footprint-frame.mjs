/**
 * Read mapped building outlines from an explorer region's world.pmtiles (Protomaps `buildings`)
 * and ground heights from its elevation.pmtiles, for authoring a place master in its own frame.
 *
 *   # list what is mapped near a point
 *   node packages/worldgen/scripts/map-footprint-frame.mjs --center=-122.3081,47.6557 --list
 *   # write a bundle's footprint.json: outlines in the model frame, ground relative to the anchor
 *   node packages/worldgen/scripts/map-footprint-frame.mjs --center=-122.3081,47.6557 \
 *     --features=52776561088698,35185476291734 --anchor=-122.30823,47.65558 \
 *     --heading=edge:35185476291734+180 --out=<bundle>/footprint.json
 *
 * Model frame (StructurePlacement): +Y up, +X along `heading`, which is radians counterclockwise
 * from east seen from above; three.js rotation.y = heading maps model (x, z) to world
 * (east, south) = (x cos h + z sin h, -x sin h + z cos h). `--heading` takes degrees, or
 * `edge:<feature id>[+deg]` for that feature's longest outline edge.
 * Options: --region=seattle-bellevue-sammamish --radius=150 --zoom=15.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { biomeJson } from './format-json.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(resolve(root, 'packages/terrain/package.json'));
const load = async (name, from = require) => import(pathToFileURL(from.resolve(name)).href);
const { PMTiles } = await load('pmtiles');
const pbfModule = await load('pbf');
const Pbf = pbfModule.default ?? pbfModule.Pbf;
const resolveFrom = (pkg, name) =>
  createRequire(resolve(root, `packages/${pkg}/package.json`)).resolve(name);
const vectorTile = await import(
  pathToFileURL(
    (() => {
      for (const pkg of ['terrain', 'worldgen-earth', 'earth', 'tooling'])
        try {
          return resolveFrom(pkg, '@mapbox/vector-tile');
        } catch {}
      throw new Error('@mapbox/vector-tile is not installed in any workspace package');
    })(),
  ).href
);
const { PNG } = await import(
  pathToFileURL(
    (() => {
      for (const pkg of ['terrain', 'tooling', 'worldgen', 'entities'])
        try {
          return resolveFrom(pkg, 'pngjs');
        } catch {}
      throw new Error('pngjs is not installed in any workspace package');
    })(),
  ).href
);

const arg = (name) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? undefined;
const region = arg('region') ?? 'seattle-bellevue-sammamish';
const terrainDir = resolve(root, 'examples/world-explorer/public/terrain', region);
const center = (arg('center') ?? '').split(',').map(Number);
if (center.length !== 2 || center.some((v) => !Number.isFinite(v)))
  throw new Error('Pass --center=<lon>,<lat>');
const radius = Number(arg('radius') ?? 150);

class FileBytes {
  constructor(path) {
    this.path = path;
    this.bytes = readFileSync(path);
  }
  getKey() {
    return this.path;
  }
  async getBytes(offset, length) {
    const view = this.bytes.subarray(offset, offset + length);
    return { data: view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) };
  }
}
const world = new PMTiles(new FileBytes(resolve(terrainDir, 'world.pmtiles')));
const elevation = new PMTiles(new FileBytes(resolve(terrainDir, 'elevation.pmtiles')));
const terrainPackage = JSON.parse(readFileSync(resolve(terrainDir, 'terrain-package.json')));
const heightRange = terrainPackage.elevation.height;
const zoom = Math.min(Number(arg('zoom') ?? 15), (await world.getHeader()).maxZoom);
const demZoom = (await elevation.getHeader()).maxZoom;

const lonToX = (lon, z) => ((lon + 180) / 360) * Math.pow(2, z);
const latToY = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z);
};
const xToLon = (x, z) => (x / Math.pow(2, z)) * 360 - 180;
const yToLat = (y, z) => {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};
const metresPerLon = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);

const demTiles = new Map();
async function groundAt(lon, lat) {
  const fx = lonToX(lon, demZoom),
    fy = latToY(lat, demZoom);
  const tx = Math.floor(fx),
    ty = Math.floor(fy),
    key = `${tx},${ty}`;
  if (!demTiles.has(key)) {
    const tile = await elevation.getZxy(demZoom, tx, ty);
    demTiles.set(key, tile ? PNG.sync.read(Buffer.from(tile.data), { skipRescale: true }) : null);
  }
  const png = demTiles.get(key);
  if (!png) return null;
  const n = png.width,
    channels = png.data.length / (png.width * png.height);
  const px = (fx - tx) * (n - 1),
    py = (fy - ty) * (n - 1);
  const x0 = Math.min(n - 2, Math.floor(px)),
    y0 = Math.min(n - 2, Math.floor(py));
  const sx = px - x0,
    sy = py - y0;
  const at = (x, y) => png.data[(y * n + x) * channels] / 65535;
  const v =
    (1 - sx) * (1 - sy) * at(x0, y0) +
    sx * (1 - sy) * at(x0 + 1, y0) +
    (1 - sx) * sy * at(x0, y0 + 1) +
    sx * sy * at(x0 + 1, y0 + 1);
  return heightRange.min + v * (heightRange.max - heightRange.min);
}

// Local east/south metres around the center; converted to the model frame on output.
const [lon0, lat0] = center;
const toEastSouth = ([lon, lat]) => [(lon - lon0) * metresPerLon(lat0), -(lat - lat0) * 111320];
const toLonLat = ([e, s]) => [lon0 + e / metresPerLon(lat0), lat0 - s / 111320];

const tiles = new Set();
for (const de of [-radius, 0, radius])
  for (const ds of [-radius, 0, radius]) {
    const [lon, lat] = toLonLat([de, ds]);
    tiles.add(`${Math.floor(lonToX(lon, zoom))},${Math.floor(latToY(lat, zoom))}`);
  }
const pieces = [];
for (const key of [...tiles].sort()) {
  const [tx, ty] = key.split(',').map(Number);
  const tile = await world.getZxy(zoom, tx, ty);
  if (!tile) continue;
  const layer = new vectorTile.VectorTile(new Pbf(new Uint8Array(tile.data))).layers.buildings;
  if (!layer) continue;
  const west = xToLon(tx, zoom),
    east = xToLon(tx + 1, zoom),
    north = yToLat(ty, zoom),
    south = yToLat(ty + 1, zoom);
  for (let i = 0; i < layer.length; i++) {
    const feature = layer.feature(i);
    if (feature.type !== 3) continue;
    const lonLatRings = feature
      .loadGeometry()
      .map((ring) =>
        ring.map((p) => [
          xToLon(tx + p.x / layer.extent, zoom),
          yToLat(ty + p.y / layer.extent, zoom),
        ]),
      );
    const rings = lonLatRings.map((ring) => ring.map(toEastSouth));
    const outer = rings[0];
    const cx = outer.reduce((s, p) => s + p[0], 0) / outer.length,
      cz = outer.reduce((s, p) => s + p[1], 0) / outer.length;
    if (!rings.some((r) => r.some(([x, z]) => Math.hypot(x, z) < radius))) continue;
    let area = 0;
    for (let k = 0; k < outer.length; k++) {
      const a = outer[k],
        b = outer[(k + 1) % outer.length];
      area += a[0] * b[1] - b[0] * a[1];
    }
    const crossesTileEdge = lonLatRings.some((ring) =>
      ring.some(
        ([lon, lat]) =>
          lon < west - 1e-9 || lon > east + 1e-9 || lat > north + 1e-9 || lat < south - 1e-9,
      ),
    );
    pieces.push({
      id: String(feature.id),
      props: feature.properties,
      tile: `${zoom}/${tx}/${ty}`,
      crossesTileEdge,
      area: Math.abs(area / 2),
      centroid: [cx, cz],
      lonLatRings,
      rings,
    });
  }
}

function longestEdge(ring) {
  let best = 0,
    angle = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const dx = b[0] - a[0],
      dn = -(b[1] - a[1]),
      length = Math.hypot(dx, dn);
    if (length > best) {
      best = length;
      angle = Math.atan2(dn, dx);
    }
  }
  return { length: best, angle };
}
const round = (v, d = 2) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d);

if (process.argv.includes('--list')) {
  const rows = pieces
    .filter((p) => p.area > 20)
    .sort((a, b) => Math.hypot(...a.centroid) - Math.hypot(...b.centroid));
  for (const p of rows) {
    const edge = longestEdge(p.rings[0]);
    const xs = p.rings[0].map((q) => q[0]),
      zs = p.rings[0].map((q) => q[1]);
    console.log(
      `${p.id} ${p.props.kind}${p.props.kind_detail ? `/${p.props.kind_detail}` : ''}` +
        ` h=${p.props.height ?? '-'} min=${p.props.min_height ?? '-'}${p.props.name ? ` "${p.props.name}"` : ''}` +
        ` area=${Math.round(p.area)} centroid(E,S)=${p.centroid.map((v) => round(v, 1))}` +
        ` east[${round(Math.min(...xs), 0)},${round(Math.max(...xs), 0)}] south[${round(Math.min(...zs), 0)},${round(Math.max(...zs), 0)}]` +
        ` longest=${round(edge.length, 1)}m@${round((edge.angle * 180) / Math.PI, 1)}deg` +
        ` tile=${p.tile}${p.crossesTileEdge ? ' CLIPPED' : ''}`,
    );
  }
  process.exit(0);
}

const wanted = (arg('features') ?? '').split(',').filter(Boolean);
const out = arg('out');
if (!wanted.length || !out) throw new Error('Pass --features=<ids> and --out=<file>, or --list');
const anchorArg = arg('anchor');
const anchorLonLat = anchorArg ? anchorArg.split(',').map(Number) : center;
const anchorES = toEastSouth(anchorLonLat);
const headingArg = arg('heading') ?? '0';
let heading;
let headingBasis;
if (headingArg.startsWith('edge:')) {
  const [, spec] = headingArg.split(':');
  const [id, extra = '0'] = spec.split(/(?=[+-])/);
  const piece = pieces
    .filter((p) => p.id === id)
    .sort((a, b) => b.area - a.area)[0];
  if (!piece) throw new Error(`Feature ${id} is not mapped near the center`);
  heading = longestEdge(piece.rings[0]).angle + (Number(extra) * Math.PI) / 180;
  headingBasis = `longest mapped edge of feature ${id}${extra !== '0' ? ` ${extra} deg` : ''}`;
} else {
  heading = (Number(headingArg) * Math.PI) / 180;
  headingBasis = `${headingArg} deg counterclockwise from east`;
}
heading = Math.atan2(Math.sin(heading), Math.cos(heading));
const c = Math.cos(heading),
  s = Math.sin(heading);
const toModel = ([e, so]) => {
  const de = e - anchorES[0],
    ds = so - anchorES[1];
  return [round(c * de - s * ds), round(s * de + c * ds)];
};
const groundAtAnchor = round(await groundAt(...anchorLonLat));
const features = [];
let low = Infinity,
  high = -Infinity;
for (const id of wanted) {
  const matches = pieces.filter((p) => p.id === id);
  if (!matches.length) throw new Error(`Feature ${id} is not mapped within ${radius} m`);
  const props = matches[0].props;
  const out = [];
  for (const piece of matches) {
    const ground = [];
    for (const lonLat of piece.lonLatRings[0]) {
      const h = round((await groundAt(...lonLat)) - groundAtAnchor);
      ground.push(h);
      low = Math.min(low, h);
      high = Math.max(high, h);
    }
    out.push({
      tile: piece.tile,
      crossesTileEdge: piece.crossesTileEdge,
      outline: piece.rings[0].map(toModel),
      holes: piece.rings.slice(1).map((ring) => ring.map(toModel)),
      groundAtVertices: ground,
    });
  }
  features.push({
    id,
    kind: props.kind,
    ...(props.kind_detail ? { kindDetail: props.kind_detail } : {}),
    ...(props.name ? { name: props.name } : {}),
    ...(props.height !== undefined ? { height: props.height } : {}),
    ...(props.min_height !== undefined ? { minHeight: props.min_height } : {}),
    pieces: out,
  });
}
const document = {
  source: {
    map: `examples/world-explorer/public/terrain/${region}/world.pmtiles`,
    layer: 'buildings',
    zoom,
    ground: `examples/world-explorer/public/terrain/${region}/elevation.pmtiles`,
    groundZoom: demZoom,
    attribution: 'OpenStreetMap contributors (Protomaps); terrain per the region LICENSES.md',
    command: `node ${relative(root, fileURLToPath(import.meta.url)).replaceAll('\\', '/')} ${process.argv
      .slice(2)
      .filter((a) => !a.startsWith('--out='))
      .join(' ')}`,
  },
  frame:
    'Model metres: +Y up from the ground at the anchor; +X along heading (radians counterclockwise from east seen from above); placement rotation.y = heading.',
  anchor: anchorLonLat.map((v) => round(v, 7)),
  heading: round(heading, 6),
  headingBasis,
  groundAtAnchor,
  groundRelative: { min: round(low), max: round(high) },
  features,
};
writeFileSync(resolve(out), biomeJson(document, resolve(out)));
console.log(
  JSON.stringify({
    out,
    anchor: document.anchor,
    heading: document.heading,
    groundAtAnchor,
    groundRelative: document.groundRelative,
    features: features.map((f) => `${f.id}:${f.pieces.length}`),
  }),
);
