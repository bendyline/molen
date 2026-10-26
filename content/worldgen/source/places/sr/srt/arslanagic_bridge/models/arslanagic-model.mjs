/** Original asymmetric Arslanagic stone crossing from ordinary photos and the map plan. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import {
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const linear = (hex) =>
  hex.match(/\w\w/g).map((v) => {
    const n = parseInt(v, 16) / 255;
    return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  });
const stone = linear('d5cbb9'),
  edge = linear('e1d6c1'),
  pave = linear('b8ad97');
export const arslanagicControls = {
  half: 42.57,
  width: 4.162,
  water: 1.2,
  profile: [
    [-42.57, 3.0],
    [-25, 8.8],
    [-18, 10.5],
    [0, 11.25],
    [12.2, 10.2],
    [23.2, 10.7],
    [42.57, 7.0],
  ],
  holes: [
    { name: 'south-approach-1', cx: -37.5, r: 2.3, bottom: 2.0, spring: 2.0, rise: 1.3 },
    { name: 'south-approach-2', cx: -31.5, r: 2.3, bottom: 2.1, spring: 2.1, rise: 1.4 },
    { name: 'south-approach-3', cx: -26, r: 1.7, bottom: 2.2, spring: 2.2, rise: 1.2 },
    { name: 'south-low-water-arch', cx: -18, r: 5.5, bottom: 0, spring: 1.2, rise: 5.3 },
    { name: 'south-stacked-relief', cx: -18, r: 3.1, bottom: 7.5, spring: 7.5, rise: 1.7 },
    { name: 'large-south-arch', cx: 0, r: 10, bottom: 0, spring: 1.2, rise: 8.6 },
    { name: 'large-north-arch', cx: 23.2, r: 8.8, bottom: 0, spring: 1.2, rise: 8.0 },
    { name: 'north-approach-opening', cx: 37.6, r: 2.4, bottom: 2.0, spring: 2.0, rise: 2.5 },
  ],
};
const C = arslanagicControls;
export const arslanagicSurfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.95, metallic: 0 },
  raw: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.96, metallic: 0 },
  paving: { slot: 'wall', graph: 'stone_drywall', roughness: 0.96, metallic: 0 },
};
export function arslanagicRoad(x) {
  const p = C.profile;
  for (let i = 1; i < p.length; i++)
    if (x <= p[i][0]) {
      const a = p[i - 1],
        b = p[i],
        t = Math.max(0, Math.min(1, (x - a[0]) / (b[0] - a[0])));
      return a[1] + (b[1] - a[1]) * t;
    }
  return p.at(-1)[1];
}
export function arslanagicCrown(h, x) {
  const q = Math.min(h.r, Math.abs(x - h.cx)),
    d = h.r * 0.4;
  return (
    h.spring +
    (h.rise * Math.sqrt(Math.max(0, (h.r + d) ** 2 - (q + d) ** 2))) /
      Math.sqrt(h.r * h.r + 2 * h.r * d)
  );
}
function writer(out, far) {
  const emit = (slot, ref, p, hint, _uv, tint) => {
    p = p.map((v) => v.map(Math.fround));
    p = p.filter((v, i) => i === 0 || v.some((n, j) => n !== p[i - 1][j]));
    if (p.length > 2 && p[0].every((v, j) => v === p.at(-1)[j])) p.pop();
    for (let i = 1; i + 1 < p.length; i++) {
      let tri = [p[0], p[i], p[i + 1]],
        n = normalFor(...tri);
      if (!n.some((v) => v !== 0)) continue;
      if (hint && n.reduce((s, v, j) => s + v * hint[j], 0) < 0) {
        tri = [tri[0], tri[2], tri[1]];
        n = normalFor(...tri);
      }
      out.addTriangle(
        slot,
        ref,
        tri,
        n,
        tri.map((v) => [v[0], v[2]]),
        far ? tint.map((v) => v * 0.74) : tint,
      );
    }
  };
  return Object.fromEntries(['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [k, emit]));
}
function face(out, slot, p, n, tint = stone) {
  out.addQuad(slot, 'palette:#ffffff', p, n, [], tint);
}
function section(out, a, b, low, high) {
  const la = low(a),
    lb = low(b),
    ha = high(a),
    hb = high(b),
    z = C.width / 2;
  if (ha - la < -0.001 || hb - lb < -0.001) throw Error(`Invalid solid profile ${a} ${b}`);
  if (Math.max(ha - la, hb - lb) < 0.0001) return;
  face(
    out,
    'stone',
    [
      [a, la, z],
      [b, lb, z],
      [b, hb, z],
      [a, ha, z],
    ],
    [0, 0, 1],
  );
  face(
    out,
    'stone',
    [
      [b, lb, -z],
      [a, la, -z],
      [a, ha, -z],
      [b, hb, -z],
    ],
    [0, 0, -1],
  );
  face(
    out,
    'raw',
    [
      [a, ha, -z],
      [a, ha, z],
      [b, hb, z],
      [b, hb, -z],
    ],
    [0, 1, 0],
  );
  face(
    out,
    'raw',
    [
      [a, la, z],
      [a, la, -z],
      [b, lb, -z],
      [b, lb, z],
    ],
    [0, -1, 0],
  );
}
const configs = {
  skyline: { arc: 4, ring: 0, grid: 1, coping: 0 },
  district: { arc: 8, ring: 8, grid: 32, coping: 0 },
  street: { arc: 16, ring: 20, grid: 80, coping: 4 },
  closeup: { arc: 32, ring: 40, grid: 180, coping: 2 },
  master: { arc: 64, ring: 64, grid: 320, coping: 1.1 },
};
function core(out, cfg) {
  const breaks = new Set([
    ...C.profile.map((p) => p[0]),
    ...Array.from({ length: cfg.grid + 1 }, (_, i) => -C.half + (2 * C.half * i) / cfg.grid),
  ]);
  for (const h of C.holes)
    for (let i = 0; i <= cfg.arc; i++) breaks.add(h.cx - h.r * Math.cos((Math.PI * i) / cfg.arc));
  const xs = [...breaks].sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i];
    if (b - a < 1e-5) continue;
    const mid = (a + b) / 2,
      holes = C.holes.filter((h) => Math.abs(mid - h.cx) < h.r).sort((a, b) => a.bottom - b.bottom);
    let low = () => 0;
    for (const h of holes) {
      if (h.bottom > 0) section(out, a, b, low, () => h.bottom);
      low = (x) => arslanagicCrown(h, x);
    }
    section(out, a, b, low, (x) => arslanagicRoad(x) - 0.06);
  }
  for (const h of C.holes)
    if (h.spring > h.bottom)
      for (const sign of [-1, 1]) {
        const x = h.cx + sign * h.r,
          z = C.width / 2;
        face(
          out,
          'raw',
          [
            [x, h.bottom, -z],
            [x, h.bottom, z],
            [x, h.spring, z],
            [x, h.spring, -z],
          ],
          [-sign, 0, 0],
        );
      }
  for (const sign of [-1, 1]) {
    const x = sign * C.half,
      z = C.width / 2;
    face(
      out,
      'stone',
      [
        [x, 0, -z],
        [x, 0, z],
        [x, arslanagicRoad(x) - 0.06, z],
        [x, arslanagicRoad(x) - 0.06, -z],
      ],
      [sign, 0, 0],
    );
  }
}
function strip(out, slot, a, b, z0, z1, low, high, tint) {
  loft(
    out,
    slot,
    [a, b].map((x) => [
      [x, arslanagicRoad(x) + high, z0],
      [x, arslanagicRoad(x) + high, z1],
      [x, arslanagicRoad(x) + low, z1],
      [x, arslanagicRoad(x) + low, z0],
    ]),
    tint,
  );
}
function deck(out, cfg) {
  for (let i = 1; i < C.profile.length; i++) {
    const a = C.profile[i - 1][0],
      b = C.profile[i][0];
    strip(out, 'paving', a, b, -1.8, 1.8, -0.08, 0.015, pave);
    for (const sign of [-1, 1]) {
      const z0 = sign < 0 ? -C.width / 2 : C.width / 2 - 0.28,
        z1 = z0 + 0.28;
      strip(out, 'stone', a, b, z0, z1, -0.1, 0.82, stone);
      if (!cfg.coping) strip(out, 'raw', a, b, z0 - 0.025, z1 + 0.025, 0.8, 0.94, edge);
    }
  }
  if (cfg.coping)
    for (let a = -C.half; a < C.half; a += cfg.coping) {
      const b = Math.min(C.half, a + cfg.coping - 0.012);
      for (const sign of [-1, 1]) {
        const z0 = sign < 0 ? -C.width / 2 : C.width / 2 - 0.28;
        strip(out, 'raw', a, b, z0 - 0.025, z0 + 0.305, 0.8, 0.94, edge);
      }
    }
}
function voussoirs(out, cfg) {
  if (!cfg.ring) return;
  for (const h of C.holes) {
    const steps = Math.max(8, Math.round((cfg.ring * h.r) / 10)),
      t = 0.38;
    for (let i = 0; i < steps; i++) {
      const a = -h.r * Math.cos((Math.PI * (i + 0.015)) / steps),
        b = -h.r * Math.cos((Math.PI * (i + 0.985)) / steps),
        top = (x) => arslanagicCrown(h, h.cx + x),
        outer = (x) => {
          const d = h.r * 0.4,
            q = Math.abs(x),
            r = h.r + t;
          return (
            h.spring +
            ((h.rise + t) * Math.sqrt(Math.max(0, (r + d) ** 2 - (q + d) ** 2))) /
              Math.sqrt(r * r + 2 * r * d)
          );
        };
      for (const sign of [-1, 1]) {
        const z = sign * (C.width / 2 + 0.018),
          p = [
            [h.cx + a, top(a), z],
            [h.cx + b, top(b), z],
            [h.cx + b, outer(b), z],
            [h.cx + a, outer(a), z],
          ];
        face(out, 'raw', p, [0, 0, sign], edge);
      }
    }
  }
}
function pierStubs(out, far) {
  for (const [x, w] of [
    [-11.25, 2.5],
    [12.2, 4.4],
    [33.6, 3.2],
  ])
    for (const sign of [-1, 1]) {
      const z = (sign * C.width) / 2,
        a = sign > 0 ? z : z - 0.75,
        b = sign > 0 ? z + 0.75 : z;
      box(out, 'raw', [x - w / 2, 0, a], [x + w / 2, 3.9, b], stone);
      if (!far)
        loft(
          out,
          'raw',
          [
            [
              [x - w / 2, 3.9, a],
              [x + w / 2, 3.9, a],
              [x + w / 2, 3.9, b],
              [x - w / 2, 3.9, b],
            ],
            [
              [x - w / 2 + 0.15, 4.5, z - sign * 0.02],
              [x + w / 2 - 0.15, 4.5, z - sign * 0.02],
              [x + w / 2 - 0.15, 4.5, z - sign * 0.04],
              [x - w / 2 + 0.15, 4.5, z - sign * 0.04],
            ],
          ],
          stone,
        );
    }
}
export function buildArslanagicLevel(builder, level = 'master') {
  const cfg = configs[level];
  if (!cfg) throw Error(`Unknown Arslanagic level ${level}`);
  const out = writer(builder, level === 'skyline');
  core(out, cfg);
  deck(out, cfg);
  voussoirs(out, cfg);
  pierStubs(out, level === 'skyline');
}
export const buildArslanagicSkyline = (out) => buildArslanagicLevel(out, 'skyline');
export const buildArslanagicDistrict = (out) => buildArslanagicLevel(out, 'district');
export const buildArslanagicStreet = (out) => buildArslanagicLevel(out, 'street');
export const buildArslanagicCloseup = (out) => buildArslanagicLevel(out, 'closeup');

export const arslanagicStudy = {
  id: 'arslanagic_bridge',
  wikidataId: 'Q12044655',
  title: 'Arslanagić Bridge',
  mapFrameDocument: 'map-frame.json',
  brief:
    'The asymmetric pale-stone Trebišnjica crossing: two dominant pointed arches, a lower south water arch with a relief opening above it, three small south approach openings, a small north opening, raised stone parapets and a narrow double-crested cobbled walk.',
  nativeAxes:
    '+X north-northeast toward the higher bank; -X south-southwest toward the longer low approach; +Z east-southeast. +Y up. Lowest source pier referenceY0; draft water referenceY1.2m.',
  refs: [
    'https://commons.wikimedia.org/wiki/File:Puente_Arslanagi%C4%87,_Trebinje,_Bosnia_y_Herzegovina,_2014-04-14,_DD_28.jpg',
    'https://commons.wikimedia.org/wiki/File:Puente_Arslanagi%C4%87,_Trebinje,_Bosnia_y_Herzegovina,_2014-04-14,_DD_29.jpg',
    'https://commons.wikimedia.org/wiki/File:Puente_Arslanagi%C4%87,_Trebinje,_Bosnia_y_Herzegovina,_2014-04-14,_DD_30.jpg',
    'https://www.openstreetmap.org/way/550141423',
  ],
  sourceFacts: [
    'Retained catalog length80m; the current exact-QID OSM bridge outline measures85.14x4.162m including its mapped end extent. These extents remain distinct.',
    'Three inspected ordinary2014 Diego Delso photographs show the asymmetric arch rhythm and the stacked south opening. Conflicting prose arch counts are not used as geometry evidence.',
    'A consulted photo caption says6m height without a datum; no catalog height statement exists. Current opening rises and deck elevations are picture-based reconstruction assumptions, not a surveyed height claim.',
    'Standard cached Protomaps20261020/Mapzen yields native water271.078674m; preliminary centerline banks are272.735939m at-X and276.717807m at+X.',
  ],
  reconstruction: [
    'Original analytic wall volume with genuine open arches, through-vault soffits, selected voussoir geometry and shared limestone, raw limestone and irregular stone paving surfaces. No downloaded meshes or photographic textures.',
    'The working profile and opening dimensions are recorded in arslanagicControls. Three broad pier stubs interpret the visible buttress faces; their hidden/opposite-side construction is not surveyed.',
    'No guardhouse is added: the inspected current exterior photographs show an open stone crossing.',
  ],
  materialMethod:
    'Three existing shared stone graphs with metric UV repeats and per-component vertex tints. No glazing, model-specific bitmap textures or embedded images.',
  importReason:
    'Retain the authored arch crowns, coping and thin voussoir rims without whole-object quantization. Four separately authored browser levels control runtime cost.',
  limitations: [
    'Exact arch radii/rises, pier sections, parapet height, individual stones and pavement repairs are approximate ordinary-photo interpretations.',
    'The historical80m length and current85.14m mapped extent differ; original foundations and a6m caption height have unresolved scope/datum.',
    'Only ordinary photos and the standard PMTiles/Mapzen pipeline guide this pass. Native river stage and banks are approximate; final native fit and inspected current shared-material models remain pending.',
    'Opposite-face details, concealed foundations, temporary signs/furniture, bankside buildings and utilities outside the bridge are excluded.',
    'Physical ordinary-laptop and phone/tablet timing measurements remain pending.',
  ],
  camera: { position: [-23, 20, 65], lookAt: [0, 5, 0], fov: 55 },
  qaCameras: [
    { name: 'complete-asymmetric-elevation', position: [-8, 13, 78], lookAt: [0, 5, 0], fov: 52 },
    {
      name: 'stacked-water-and-relief-arches',
      position: [-28, 8, 24],
      lookAt: [-23, 6, 0],
      fov: 60,
    },
    { name: 'vault-and-pointed-crown', position: [-1, 4.8, 14], lookAt: [0, 8, 0], fov: 60 },
    { name: 'cobbled-walk-and-parapet', position: [-16, 12.4, 1], lookAt: [11, 10.4, 0], fov: 58 },
  ],
  geographic: (m) => ({
    anchor: m.anchor,
    heading: m.heading,
    elevationMode: 'sea-level',
    elevationMeters: 269.88,
    replaceFootprint: false,
  }),
  build: (out) => buildArslanagicLevel(out, 'master'),
};
