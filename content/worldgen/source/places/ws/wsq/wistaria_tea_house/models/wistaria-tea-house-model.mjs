/** The restored Japanese timber wings and street-side addition at Taipei's Wistaria Tea House. */
import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const [...polys] = read('map-frame').geometry.polygons;
const yard = polys.pop();
const d = yard[1].map((v, i) => v - yard[0][i]),
  angle = Math.atan2(d[1], d[0]);
const c = Math.cos(angle),
  s = Math.sin(angle);
const at = (x, y, z) => [x * c - z * s, y, x * s + z * c];
const local = ([x, z]) => [x * c + z * s, -x * s + z * c];
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93, metallic: 0 },
  wood: { slot: 'wall', graph: 'wood_weatherboard', roughness: 0.92, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_glazed', roughness: 0.88, metallic: 0.02 },
  foot: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.1 },
  inset: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.6, metallic: 0.04 },
};
const tone = {
  ash: rgb('b7b4a6'),
  tile: rgb('5e6056'),
  edge: rgb('44483f'),
  aged: rgb('87816c'),
  planks: rgb('9e9177'),
  frame: rgb('665743'),
  pale: rgb('d2cbbc'),
  stone: rgb('a09c90'),
  glaze: rgb('6e7971'),
  gate: rgb('464e43'),
  pergola: rgb('77735d'),
  render: rgb('a39f94'),
};
const rings = polys.map((r) => r.map(local));
const bounds = (p) =>
  [0, 1].map((i) => [Math.min(...p.map((q) => q[i])), Math.max(...p.map((q) => q[i]))]);
const point = ([x, z], y) => [x, y, z];
const mix = (a, b, t) => a + (b - a) * t;
const join = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
function sheet(out, slot, points, normal, color) {
  for (const tri of [
    [points[0], points[1], points[2]],
    [points[0], points[2], points[3]],
  ]) {
    const n = normalFor(...tri);
    triangle(
      out,
      slot,
      n.reduce((sum, v, i) => sum + v * normal[i], 0) > 0 ? tri : tri.toReversed(),
      color,
    );
  }
}
function polygonTop(out, slot, ring, height, color) {
  const idx = earcut(ring.flat());
  for (let i = 0; i < idx.length; i += 3) {
    const p = idx.slice(i, i + 3).map((j) => point(ring[j], height));
    triangle(out, slot, normalFor(...p)[1] > 0 ? p : p.toReversed(), color);
  }
}
function facade(out, a, b, floor, eave, ord, wallMaterial, features, lod) {
  const direction = b.map((v, i) => v - a[i]),
    len = Math.hypot(...direction);
  const n = [(ord * direction[1]) / len, (-ord * direction[0]) / len],
    outward = [n[0], 0, n[1]];
  const p = (u, y, offset = 0) => [
    a[0] + direction[0] * u + n[0] * offset,
    y,
    a[1] + direction[1] * u + n[1] * offset,
  ];
  const plane = (slot, x0, x1, y0, y1, z, color) =>
    sheet(out, slot, [p(x0, y0, z), p(x1, y0, z), p(x1, y1, z), p(x0, y1, z)], outward, color);
  plane('foot', 0, 1, -2.2, floor, 0, tone.stone);
  plane(wallMaterial, 0, 1, floor, eave, 0, wallMaterial === 'plaster' ? tone.ash : tone.planks);
  if (lod && wallMaterial === 'wood') {
    for (let h = floor + 0.24; h < eave - 0.09; h += lod > 1 ? 0.27 : 0.49)
      plane('wood', 0, 1, h, h + 0.028, 0.024, tone.aged);
  }
  if (!features || len < 2.25) return;
  const nWindows = Math.max(1, Math.round(len / 3));
  const glassBase = eave > 5 ? eave - 2.71 : floor + 0.49,
    glassTop = eave > 5 ? eave - 0.86 : eave - 0.35;
  for (let i = 0; i < nWindows; i++) {
    const u = (i + 0.5) / nWindows,
      w = 0.37 / nWindows;
    plane(
      'wood',
      u - w,
      u + w,
      glassBase - 0.06,
      glassTop + 0.06,
      0.05,
      eave > 5 ? tone.pale : tone.frame,
    );
    plane(
      'inset',
      u - w + 0.045 / len,
      u + w - 0.045 / len,
      glassBase,
      glassTop,
      0.073,
      tone.glaze,
    );
    if (lod) {
      for (const t of [0.28, 0.52, 0.76]) {
        const v = mix(u - w, u + w, t),
          s = 0.044 / len;
        plane('wood', v - s, v + s, glassBase, glassTop, 0.082, eave > 5 ? tone.pale : tone.frame);
      }
      const h = mix(glassBase, glassTop, 0.76);
      plane('wood', u - w, u + w, h, h + 0.045, 0.092, eave > 5 ? tone.pale : tone.frame);
    }
  }
}
function roof(out, ring, eave, rise, axis, lod) {
  const B = bounds(ring),
    [a, b] = B[axis],
    [l, r] = B[1 - axis];
  const [v0, v1] = [a - 0.24, b + 0.25],
    center = (l + r) / 2;
  const vertex = (u, v, y) => (axis === 0 ? [u, y, v] : [v, y, u]);
  const sections = [
    [l - 0.44, eave],
    [mix(l, center, 0.52), eave + rise * 0.51],
    [center, eave + rise],
    [mix(center, r, 0.48), eave + rise * 0.51],
    [r + 0.42, eave],
  ];
  const xInset = 0.44;
  for (let i = 1; i < sections.length; i++) {
    const [z0, y0] = sections[i - 1],
      [z1, y1] = sections[i];
    const s0 = i === 1 || i === 3 ? 0 : xInset,
      s1 = i === 2 || i === 4 ? 0 : xInset;
    const a = vertex(v0 + s0, z0, y0),
      b = vertex(v1 - s0, z0, y0),
      c = vertex(v1 - s1, z1, y1),
      d = vertex(v0 + s1, z1, y1);
    sheet(out, 'tile', [a, b, c, d], [0, 1, 0], tone.tile);
    if (lod > 1) {
      const count = lod === 3 ? 11 : 6;
      for (let j = 1; j < count; j++) {
        const u = j / count,
          lift = ([x, y, z]) => [x, y + 0.025, z];
        beam(out, 'tile', lift(join(a, b, u)), lift(join(d, c, u)), 0.032, 0.028, tone.edge);
      }
    }
  }
  for (const [end, dir] of [
    [v0, -1],
    [v1, 1],
  ]) {
    const [a, b, c] = [
      vertex(end, l - 0.43, eave - 0.04),
      vertex(end, r + 0.41, eave - 0.04),
      vertex(end + dir * -xInset, center, eave + rise),
    ];
    const normal = axis === 0 ? [dir, 0, 0] : [0, 0, dir];
    const n = normalFor(a, b, c);
    triangle(
      out,
      'wood',
      n.reduce((sum, v, i) => sum + v * normal[i], 0) > 0 ? [a, b, c] : [a, c, b],
      tone.aged,
    );
  }
  beam(
    out,
    'tile',
    vertex(v0 + xInset - 0.15, center, eave + rise + 0.04),
    vertex(v1 - xInset + 0.15, center, eave + rise + 0.04),
    0.19,
    0.17,
    tone.edge,
  );
}
function wing(out, ring, index, lod) {
  const { eave, rise } = plan.section.units[index];
  const taller = index === 0,
    floor = 0.52;
  const order = Math.sign(
    ring.reduce((sum, p, i) => {
      const q = ring[(i + 1) % ring.length];
      return sum + p[0] * q[1] - q[0] * p[1];
    }, 0),
  );
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i],
      q = ring[(i + 1) % ring.length],
      dx = q[0] - p[0],
      dz = q[1] - p[1];
    const o = [order * dz, -order * dx];
    facade(
      out,
      p,
      q,
      floor,
      eave,
      order,
      taller && Math.abs(dx) > Math.abs(dz) ? 'plaster' : 'wood',
      o[1] > 0.8 || o[0] > 1.2,
      lod,
    );
  }
  polygonTop(out, 'wood', ring, eave - 0.05, tone.frame);
  roof(out, ring, eave, rise, index === 1 ? 1 : 0, lod);
}

function entrance(out, lod) {
  const wall = (x0, x1, z, h) =>
    box(out, 'foot', [x0, -1.37, z - 0.12], [x1, h, z + 0.12], tone.render);
  wall(-24.4, 12.9, 8.65, 1.93);
  wall(16.67, 23.25, 8.65, 1.56);
  for (const x of [12.95, 16.63]) {
    box(out, 'foot', [x - 0.17, -0.77, 8.35], [x + 0.17, 2.21, 8.84], tone.stone);
    box(out, 'foot', [x - 0.2, 2.19, 8.32], [x + 0.2, 2.32, 8.87], tone.pale);
  }
  for (const x of [13.0, 14.78, 16.58])
    beam(out, 'trim', [x, -0.52, 8.65], [x, 1.92, 8.65], 0.095, 0.11, tone.gate);
  for (const y of [0.19, 1.87])
    beam(out, 'trim', [13.04, y, 8.65], [16.55, y, 8.65], 0.083, 0.081, tone.gate);
  const bars = lod === 0 ? 4 : lod === 1 ? 6 : 10;
  for (let i = 1; i < bars; i++) {
    const x = 13.06 + (3.48 * i) / bars;
    beam(out, 'trim', [x, -0.38, 8.65], [x, 1.84, 8.65], 0.039, 0.042, tone.gate);
  }
  for (const x of [7.6, 10.45, 13.2]) {
    const q = [x, 2.58, 6.8];
    beam(out, 'wood', [x, -0.91, 6.8], q, 0.13, 0.14, tone.pergola);
    beam(out, 'wood', q, [x, 2.69, 2.7], 0.14, 0.19, tone.pergola);
  }
  if (lod) {
    for (const z of [3.25, 4.26, 5.4, 6.42])
      beam(out, 'wood', [7.24, 2.63, z], [13.72, 2.6, z], 0.13, 0.15, tone.pergola);
  }
}
function build(out, lod) {
  const aligned = transform(out, -angle);
  for (let i = 0; i < rings.length; i++) wing(aligned, rings[i], i, lod);
  entrance(aligned, lod);
}
export const houseSkyline = (out) => build(out, 0);
export const houseDistrict = (out) => build(out, 1);
export const houseStreet = (out) => build(out, 2);
export const houseCloseup = (out) => build(out, 3);
const camera = at(45, 25, 49),
  lookAt = at(0, 3, 0),
  recipe = 'wistaria-tea-house-model.mjs';
export const houseModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: [
    'heritage-tower-detail-mesh.mjs',
    'polygon-triangulation.mjs',
    'structure-mesh.mjs',
  ],
  surfaces,
  category: 'landmark',
  build: houseCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Wistaria Tea House’s dark-tiled timber wings, two-storey street wing, glazed display bay and low courtyard wall in Taipei.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: at(30, 53, 43),
  portableGroundY: -0.31,
  mediumFiContext: {
    scale: 0.92,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: polys[0],
    minimumCoverage: 0.86,
    basis: 'Mapped two-storey street range at the named Wistaria Tea House.',
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'wood_weatherboard',
    'tile_glazed',
    'concrete_plain',
    'metal_painted',
  ],
  qaCameras: [
    { name: 'street-corner-and-courtyard-gate', position: at(35, 8, 27), lookAt: at(12, 3.9, 0) },
    { name: 'low-timber-wings-and-tiled-roofs', position: at(-36, 19, 22), lookAt: at(-6, 3, 0) },
    {
      name: 'west-courtyard-and-two-storey-addition',
      position: at(-3, 17, -29),
      lookAt: at(5, 3, 0),
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `wistaria-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.51,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'houseDistrict', 0.24],
        ['street', 'houseStreet', 0.085],
        ['closeup', 'houseCloseup', 0.043],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. OpenStreetMap data is ODbL. The exact 2014 Qualla street photograph is CC0 own work by 玄史生.',
};
