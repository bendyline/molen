/** Mapped Kykkos ranges, hillside belfry, domed basilica and two stone courts. */
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { buildKykkosCourtyard } from './kykkos-courtyard.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const map = read('map-frame.json');
const grade = read('terrain-grid.json');
const courts = read('courtyard-controls.json');
const section = plan.section;

const surfaces = {
  rubble: { slot: 'wall', graph: 'stone_drywall', roughness: 0.95, metallic: 0 },
  dress: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.91, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.86, metallic: 0 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.91, metallic: 0 },
  pave: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.95, metallic: 0 },
  recess: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.83, metallic: 0 },
};
const tone = Object.fromEntries(
  Object.entries({
    rubble: 'b0a394',
    retaining: '928978',
    cream: 'e4d0ae',
    paleStone: 'c8b89e',
    cut: 'b7a487',
    tiles: 'cb865d',
    tileShade: 'a75d42',
    dusk: '534e43',
    glass: '676959',
    bronze: '68634f',
    floor: 'aca798',
    timber: '786149',
  }).map(([key, value]) => [key, rgb(value)]),
);

const area = (ring) =>
  ring.reduce((sum, [x, z], i) => {
    const [xx, zz] = ring[(i + 1) % ring.length];
    return sum + x * zz - xx * z;
  }, 0);
const outward = (ring) => (area(ring) < 0 ? ring : [...ring].reverse());
const features = Object.fromEntries(
  map.features.map(({ role, points }) => [role, outward(points)]),
);
const envelope = features['main-monastery-envelope'];
const church = features['main-church'];
const campanile = features['western-bell-tower'];
const museum = features['museum-end-range'];
const courtRings = [courts.principal.points, courts.lower.points];
const ref = 'palette:#ffffff';
const museumPoints = new Set(museum.map((p) => p.join(',')));
const average = (ring) =>
  ring.reduce(([x, z], [u, v]) => [x + u / ring.length, z + v / ring.length], [0, 0]);
const lerp = (a, b, t) => a + (b - a) * t;
const midpoint = (a, b) => [lerp(a[0], b[0], 0.5), lerp(a[1], b[1], 0.5)];

function relativeGround(x, z) {
  const u = (x - grade.origin[0]) / grade.stepMeters;
  const v = (z - grade.origin[1]) / grade.stepMeters;
  const a = Math.floor(u),
    b = Math.floor(v);
  const rows = grade.heightsMeters;
  return (
    lerp(
      lerp(rows[b][a], rows[b][a + 1], u - a),
      lerp(rows[b + 1][a], rows[b + 1][a + 1], u - a),
      v - b,
    ) - grade.modelDatumElevationMeters
  );
}
function boundaryDistance([x, z], ring) {
  let distance = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const [a, b] = ring[i],
      [c, d] = ring[(i + 1) % ring.length];
    const dx = c - a,
      dz = d - b;
    const along = Math.max(0, Math.min(1, ((x - a) * dx + (z - b) * dz) / (dx * dx + dz * dz)));
    distance = Math.min(distance, Math.hypot(x - a - along * dx, z - b - along * dz));
  }
  return distance;
}

function wingEaves(p) {
  const west = Math.max(0, section.westernRiseStartsX - p[0]) * section.westernRisePerMeter;
  const lower = Math.max(0, 1 - boundaryDistance(p, courts.lower.points) / 11);
  const principal = Math.min(1, boundaryDistance(p, courts.principal.points) / 3);
  const rise = lower * lower * (3 - 2 * lower);
  return section.wingEaves + west + (courts.lower.eaves - section.wingEaves) * rise * principal;
}

function triangles(ring, holes) {
  const raw = new MeshBufferBuilder();
  const ok = raw.addCap(
    'roof',
    ref,
    ring,
    holes,
    () => 0,
    [0, 1, 0],
    (p) => p,
    tone.tiles,
  );
  if (!ok) throw Error('Kykkos roof and courtyard footprint could not be triangulated');
  const { positions, indices } = raw.finalize();
  return Array.from(indices, (i) => [positions[i * 3], positions[i * 3 + 2]]);
}

const wingBase = triangles(envelope, courtRings);
const churchBase = triangles(church, []);
const courtSlabs = courtRings.map((ring) => triangles(ring, []));

function roof(out, base, rings, height, pitch, maxRise, depth, tint) {
  const cache = new Map();
  const point = (p) => {
    const key = p.join(',');
    if (!cache.has(key)) {
      const distance = Math.min(...rings.map((ring) => boundaryDistance(p, ring)));
      cache.set(key, [p[0], height(p) + Math.min(maxRise, distance * pitch), p[1]]);
    }
    return cache.get(key);
  };
  const fill = (a, b, c, level) => {
    if (level === 0) {
      triangle(out, 'tile', [point(a), point(b), point(c)], tint);
      return;
    }
    const ab = midpoint(a, b),
      bc = midpoint(b, c),
      ca = midpoint(c, a);
    fill(a, ab, ca, level - 1);
    fill(ab, b, bc, level - 1);
    fill(ca, bc, c, level - 1);
    fill(ab, bc, ca, level - 1);
  };
  for (let i = 0; i < base.length; i += 3) {
    const [a, b, c] = base.slice(i, i + 3);
    if (Math.abs(area([a, b, c])) > 1e-5) fill(a, b, c, depth);
  }
}

function rectangle(out, slot, a, b, y0, y1, z, color) {
  face(
    out,
    slot,
    [
      [a, y0, z],
      [b, y0, z],
      [b, y1, z],
      [a, y1, z],
    ],
    color,
  );
}

function glazedOpening(out, x, y, width, height, lod) {
  const a = x - width / 2,
    b = x + width / 2;
  rectangle(out, 'dress', a - 0.11, b + 0.11, y - 0.13, y + height + 0.11, 0.035, tone.cut);
  rectangle(out, 'recess', a, b, y, y + height, 0.047, tone.dusk);
  if (lod > 1) {
    rectangle(out, 'recess', a + 0.07, b - 0.07, y + 0.08, y + height - 0.08, 0.049, tone.glass);
    rectangle(out, 'timber', x - 0.038, x + 0.038, y + 0.06, y + height - 0.06, 0.062, tone.timber);
  }
}

function shell(out, ring, top, lod, { basilica = false } = {}) {
  const strip = (edge, a, b) => {
    if (!basilica && museumPoints.has(a.join(',')) && museumPoints.has(b.join(','))) return;
    const [x, z] = a,
      [xx, zz] = b;
    const length = Math.hypot(xx - x, zz - z);
    const facade = transform(out, -Math.atan2(zz - z, xx - x), [x, 0, z]);
    const segments = Math.max(1, Math.ceil(length / [24, 12, 6.5, 6.5][lod]));
    const at = (f) => [lerp(x, xx, f), lerp(z, zz, f)];
    for (let j = 0; j < segments; j++) {
      const u = j / segments,
        v = (j + 1) / segments,
        p = at(u),
        q = at(v);
      const yp = top(p),
        yq = top(q);
      const base = ([gx, gz], y) => Math.min(y - 5.4, relativeGround(gx, gz) - 0.95);
      const floor0 = base(p, yp),
        floor1 = base(q, yq);
      const ledge0 = Math.min(yp - 3.45, floor0 + 2.8),
        ledge1 = Math.min(yq - 3.45, floor1 + 2.8);
      const x0 = u * length,
        x1 = v * length;
      if (lod === 0) {
        face(
          facade,
          'rubble',
          [
            [x0, floor0, 0],
            [x1, floor1, 0],
            [x1, yq, 0],
            [x0, yp, 0],
          ],
          tone.rubble,
        );
        continue;
      }
      face(
        facade,
        'rubble',
        [
          [x0, floor0, 0],
          [x1, floor1, 0],
          [x1, ledge1, 0],
          [x0, ledge0, 0],
        ],
        tone.retaining,
      );
      face(
        facade,
        basilica ? 'dress' : 'rubble',
        [
          [x0, ledge0, 0],
          [x1, ledge1, 0],
          [x1, yq, 0],
          [x0, yp, 0],
        ],
        basilica ? tone.paleStone : tone.rubble,
      );
      if (lod > 0)
        face(
          facade,
          'timber',
          [
            [x0, yp - 0.23, 0.045],
            [x1, yq - 0.23, 0.045],
            [x1, yq + 0.04, 0.045],
            [x0, yp + 0.04, 0.045],
          ],
          tone.timber,
        );
    }
    if (lod === 0 || length < 3.4) return;
    const count = Math.max(1, Math.round(length / (basilica ? 4.9 : 4.25)));
    for (let j = 0; j < count; j++) {
      const s = (j + 0.5) / count;
      const level = top(at(s));
      glazedOpening(
        facade,
        s * length,
        level - 2.9,
        basilica ? 0.75 : 0.98,
        basilica ? 1.77 : 1.34,
        lod,
      );
      if (!basilica && lod > 1 && j % 2 === 0 && level - relativeGround(...at(s)) > 5.3)
        glazedOpening(facade, s * length, level - 5.15, 0.85, 1.17, lod);
    }
    if (!basilica && lod > 1 && length > 13 && edge % 3 === 0) {
      for (const t of [0.12, 0.88]) {
        const h = relativeGround(...at(t));
        const w = t * length;
        if (h + 2.8 < top(at(t))) {
          box(facade, 'rubble', [w - 0.51, h - 0.5, 0], [w + 0.51, h + 2.4, 0.54], tone.retaining);
        }
      }
    }
  };
  ring.forEach((a, i) => {
    strip(i, a, ring[(i + 1) % ring.length]);
  });
}

function portal(out, half, start, spring, clearance, top, depth, lod) {
  if (lod === 0) {
    for (const sign of [-1, 1]) {
      const x = sign * (half + 0.23);
      box(out, 'dress', [x - 0.23, start, -depth / 2], [x + 0.23, top, depth / 2], tone.paleStone);
    }
    box(
      out,
      'dress',
      [-half, spring + clearance * 0.53, -depth / 2],
      [half, top, depth / 2],
      tone.cream,
    );
    return;
  }
  const sides = [4, 6, 12, 16][lod];
  const outer = half + 0.15;
  for (let side = 0; side < 2; side++) {
    const z = side ? -depth / 2 : depth / 2;
    const draw = (slot, list, color) => face(out, slot, side ? [...list].reverse() : list, color);
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI,
        b = ((i + 1) / sides) * Math.PI;
      const p = [Math.cos(a) * half, spring + Math.sin(a) * clearance, z];
      const q = [Math.cos(b) * half, spring + Math.sin(b) * clearance, z];
      const pp = [Math.cos(a) * outer, spring + Math.sin(a) * (clearance + 0.16), z];
      const qq = [Math.cos(b) * outer, spring + Math.sin(b) * (clearance + 0.16), z];
      draw('dress', [q, p, pp, qq], tone.cream);
      draw('rubble', [qq, pp, [pp[0], top, z], [qq[0], top, z]], tone.rubble);
      if (!side && lod > 1)
        face(out, 'dress', [p, q, [q[0], q[1], -z], [p[0], p[1], -z]], tone.cut);
    }
  }
  for (const sign of [-1, 1]) {
    const x = sign * (half + 0.23);
    box(out, 'dress', [x - 0.23, start, -depth / 2], [x + 0.23, top, depth / 2], tone.paleStone);
  }
}

function cross(out, x, y, z, h, pale) {
  if (h < 0.2) return;
  const slot = pale ? 'dress' : 'recess',
    tint = pale ? tone.cream : tone.dusk;
  const w = h * 0.11;
  box(out, slot, [x - w / 2, y, z - w / 2], [x + w / 2, y + h, z + w / 2], tint);
  box(
    out,
    slot,
    [x - h * 0.29, y + h * 0.69, z - w / 2],
    [x + h * 0.29, y + h * 0.69 + w, z + w / 2],
    tint,
  );
}

function cap(out, x, z, y, rx, rz, rise) {
  const ring = (h, u, v) =>
    [
      [-1, -1],
      [-1, 1],
      [1, 1],
      [1, -1],
    ].map(([a, b]) => [x + a * u, h, z + b * v]);
  loft(out, 'tile', [ring(y, rx, rz), ring(y + rise, rx * 0.2, rz * 0.48)], tone.tiles);
}

function suspendedBell(out, x, y, z, r, lod) {
  const sides = lod > 2 ? 12 : 8;
  loft(
    out,
    'recess',
    [
      radialRing(y, r, r, sides, [x, z]),
      radialRing(y + r * 0.33, r * 0.8, r * 0.8, sides, [x, z]),
      radialRing(y + r * 1.32, r * 0.47, r * 0.47, sides, [x, z]),
    ],
    tone.bronze,
  );
}

function westernBellTower(out, lod) {
  const center = average(campanile);
  const native = map.features.find(({ role }) => role === 'western-bell-tower').points;
  const angle = -Math.atan2(native[1][1] - native[0][1], native[1][0] - native[0][0]);
  const tower = transform(out, angle, [center[0], courts.campanile.base, center[1]]);
  box(tower, 'rubble', [-5.82, -1.4, -3.44], [5.82, 5.83, 3.44], tone.rubble);
  box(tower, 'dress', [-5.91, 5.79, -3.5], [5.91, 6.08, 3.5], tone.cream);
  for (const x of [-3.5, 3.5]) {
    const opening = transform(tower, 0, [x, 0, 0]);
    portal(opening, 1.43, 6.08, 7.96, 1.17, 9.62, 2.25, lod);
    box(opening, 'rubble', [-1.95, 6.06, -3.25], [-1.43, 9.63, 3.25], tone.rubble);
    box(opening, 'rubble', [1.43, 6.06, -3.25], [1.95, 9.63, 3.25], tone.rubble);
    box(opening, 'dress', [-2.07, 9.62, -3.34], [2.07, 9.83, 3.34], tone.cream);
    cap(opening, 0, 0, 9.8, 2.22, 3.5, 0.94);
    if (lod > 0) {
      suspendedBell(opening, 0, 7.1, 0, 0.61, lod);
      cross(opening, 0, 10.74, 0, 1.38, false);
    }
  }
  portal(tower, 1.04, 6.08, 7.35, 1.14, 8.89, 1.58, lod);
  if (lod > 0) {
    cross(tower, 0, 8.87, 0, 2.23, false);
    glazedOpening(transform(tower, 0, [0, 0, 3.44]), 0, 2.62, 0.79, 1.48, lod);
  }
}

function dome(out, x, z, base, radius, lod, slopes) {
  const sides = [6, 8, 16, 16][lod];
  const rings = (entries) =>
    entries.map(([y, r]) => radialRing(base + y, radius * r, radius * r, sides, [x, z]));
  loft(
    out,
    'dress',
    rings([
      [0, 1.02],
      [0.29, 1.04],
      [0.44, 0.91],
      [slopes.drum, 0.91],
      [slopes.drum + 0.18, 1.025],
    ]),
    tone.paleStone,
  );
  const y = slopes.drum + 0.18;
  loft(
    out,
    'tile',
    rings([
      [y, 1.04],
      [y + radius * 0.27, 0.93],
      [y + radius * 0.57, 0.7],
      [y + radius * 0.76, 0.35],
      [y + radius * 0.82, 0.07],
    ]),
    tone.tiles,
  );
  if (lod > 0) {
    cross(out, x, base + y + radius * 0.82, z, slopes.cross, true);
    for (let i = 0; lod > 1 && i < 8; i++) {
      const a = (i / 8 + 0.0625) * Math.PI * 2;
      const r = radius * 0.91 * Math.cos(Math.PI / sides);
      const sash = transform(out, a, [x + r * Math.sin(a), 0, z + r * Math.cos(a)]);
      glazedOpening(sash, 0, base + slopes.drum * 0.25, radius * 0.19, slopes.drum * 0.52, lod);
    }
  }
}

function basilica(out, lod) {
  const eaves = () => section.churchEaves;
  shell(out, church, eaves, lod, { basilica: true });
  roof(
    out,
    churchBase,
    [church],
    eaves,
    0.58,
    section.churchRise,
    [1, 2, 2, 3][lod],
    tone.tileShade,
  );
  const [x, z] = section.domeCenter;
  dome(out, x, z, section.domeSpring - 1.9, section.domeRadius, lod, { drum: 2.63, cross: 1.36 });
  const [bx, bz] = section.churchBellCenter;
  const source = map.features.find(({ role }) => role === 'main-church').points;
  const angle = -Math.atan2(source[6][1] - source[5][1], source[6][0] - source[5][0]);
  const bell = transform(out, angle, [bx, 0, bz]);
  box(bell, 'dress', [-2.25, section.churchFloor - 0.3, -2.25], [2.25, 10.48, 2.25], tone.cream);
  portal(bell, 1.56, 10.47, 12.62, 1.45, 14.66, 3.75, lod);
  box(bell, 'dress', [-2.11, 14.63, -2.12], [2.11, 14.93, 2.12], tone.cream);
  if (lod > 0) suspendedBell(bell, 0, 11.57, 0, 0.64, lod);
  dome(bell, 0, 0, 14.89, 1.65, lod, { drum: 1.43, cross: 1.2 });
}

function museumEnd(out, lod) {
  const [x, z] = average(museum);
  const ring = (y, factor) => museum.map(([u, v]) => [lerp(x, u, factor), y, lerp(z, v, factor)]);
  const roofBase = 22.25;
  const footing = Math.min(...museum.map(([x, z]) => relativeGround(x, z))) - 0.6;
  loft(out, 'rubble', [ring(footing, 1), ring(courts.museum.floor, 1)], tone.retaining);
  loft(out, 'rubble', [ring(courts.museum.floor, 1), ring(roofBase, 1)], tone.rubble);
  loft(out, 'dress', [ring(roofBase - 0.27, 1.016), ring(roofBase, 1.016)], tone.cream);
  loft(out, 'tile', [ring(roofBase, 1.04), ring(roofBase + 3.8, 0.07)], tone.tileShade);
  if (lod === 0) return;
  for (let i = 0; i < museum.length; i++) {
    const [a, b] = museum[i],
      [c, d] = museum[(i + 1) % museum.length];
    const wall = transform(out, -Math.atan2(d - b, c - a), [(a + c) / 2, 0, (b + d) / 2]);
    for (const height of [courts.museum.floor + 2.5, roofBase - 3.6])
      glazedOpening(wall, 0, height, 1.26, 1.72, lod);
  }
}

function courtyard(out, key, lod) {
  const { points, floor, eaves, well } = courts[key];
  const flat = courtSlabs[key === 'principal' ? 0 : 1];
  for (let i = 0; i < flat.length; i += 3) {
    const p = flat.slice(i, i + 3);
    if (Math.abs(area(p)) > 1e-5)
      triangle(
        out,
        'pave',
        p.map(([x, z]) => [x, floor, z]),
        tone.floor,
      );
  }
  buildKykkosCourtyard(out, points, floor, eaves, lod, { well });
}

function build(out, lod) {
  shell(out, envelope, wingEaves, lod);
  roof(
    out,
    wingBase,
    [envelope, ...courtRings],
    wingEaves,
    0.43,
    4.3,
    [1, 1, 2, 3][lod],
    tone.tiles,
  );
  courtyard(out, 'principal', lod);
  courtyard(out, 'lower', lod);
  basilica(out, lod);
  westernBellTower(out, lod);
  museumEnd(out, lod);
}

export const kykkosSkyline = (out) => build(out, 0);
export const kykkosDistrict = (out) => build(out, 1);
export const kykkosStreet = (out) => build(out, 2);
export const kykkosCloseup = (out) => build(out, 3);

const camera = [92, 66, 144];
const lookAt = [-12, 12, 19];
const recipe = 'kykkos-monastery-model.mjs';
export const kykkosModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: kykkosCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Kykkos Monastery in the Troodos mountains, with arcaded rubble-stone courts, clay-tile roofs, a domed basilica and the 1882 mountainside campanile.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [15, 28, 18],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'stone_drywall',
    'stone_limestone_raw',
    'tile_ceramic',
    'wood_plain',
    'stone_ashlar',
  ],
  qaCameras: [
    { name: 'main-courtyard-arcades', position: [36, 5.2, 33.4], lookAt: [12, 5.6, 35.3] },
    { name: 'well-and-stone-galleries', position: [-10.6, 7.1, 24.23], lookAt: [-1.05, 7.6, 15.6] },
    { name: 'basilica-and-campanile', position: [1, 22, -64], lookAt: [-32, 16, -4] },
    { name: '1882-belfry', position: [-37, 34, -11], lookAt: [-62, 28.4, -6.8] },
    { name: 'museum-end-and-hillside-wings', position: [-97, 28, 91], lookAt: [-53, 15, 43] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'monastery-hillside-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'kykkosSkyline',
    errorMeters: 0.68,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'kykkosDistrict', 0.29],
        ['street', 'kykkosStreet', 0.118],
        ['closeup', 'kykkosCloseup', 0.044],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under repository license. Three verified public-domain photographs by Olavfin informed the architecture. Native OpenStreetMap geometry under ODbL 1.0.',
};
