/** Original Davtashen exterior from ordinary pictures and the attributed map plan. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const linear = (hex) =>
  hex.match(/\w\w/g).map((v) => {
    const s = Number.parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const color = {
  concrete: linear('d2cec5'),
  paving: linear('b8b4a9'),
  steel: linear('d4ab58'),
  white: linear('e7e3d7'),
  dark: linear('45494b'),
  asphalt: linear('56595b'),
  marking: linear('eee9d4'),
};
export const davtashenControls = {
  half: 248.5165,
  width: 31.985,
  roadY: 92,
  // Standard native bank fit, not a surveyed longitudinal bridge profile.
  grade: 21.7 / 497.033,
  mainEnds: [-175.9, 175.9],
  // Five main spans, interpreted from the four paired supports visible in photographs.
  // End lengths and absolute foundation levels are approximate, not as-built measurements.
  piers: [
    { x: -128.1, bottom: 48 },
    { x: -48.1, bottom: 6 },
    { x: 31.9, bottom: 0 },
    { x: 111.9, bottom: 49 },
  ],
};
const C = davtashenControls;
export const davtashenSurfaces = {
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.92, metallic: 0 },
  road: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.7, metallic: 0.3 },
  marking: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0 },
};
const detail = {
  skyline: { posts: 0, lamps: 0, stiffeners: 0, cross: 0, curb: false },
  district: { posts: 48, lamps: 80, stiffeners: 32, cross: 80, curb: false },
  street: { posts: 8, lamps: 40, stiffeners: 12, cross: 24, curb: true },
  closeup: { posts: 2.5, lamps: 32, stiffeners: 4, cross: 12, curb: true },
  master: { posts: 1.6, lamps: 32, stiffeners: 2, cross: 8, curb: true },
};
// Split each face after Float32 conversion, keeping normals aligned with the exported triangles.
function writer(out, far, graded = true) {
  const emit = (slot, ref, points, hint, _uv, tint) => {
    // Keep foundations level; the pier heads, deck and furniture follow the bank-fit grade.
    const p = points.map(([x, y, z]) =>
      [x, y + (graded ? C.grade * x * Math.max(0, Math.min(1, (y - 70) / 15)) : 0), z].map(
        Math.fround,
      ),
    );
    for (let i = 1; i + 1 < p.length; i++) {
      let tri = [p[0], p[i], p[i + 1]],
        n = normalFor(...tri);
      if (hint && n.reduce((sum, v, j) => sum + v * hint[j], 0) < 0) {
        tri = [tri[0], tri[2], tri[1]];
        n = normalFor(...tri);
      }
      const mean = ['concrete', 'road'].includes(slot)
        ? [0.710816, 0.710816, 0.681928]
        : [0.83, 0.83, 0.83];
      out.addTriangle(
        slot,
        ref,
        tri,
        n,
        tri.map((v) => [v[0], v[2]]),
        far ? tint.map((v, j) => v * mean[j]) : tint,
      );
    }
  };
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [name, emit]),
  );
}
function strip(out, slot, x0, x1, y0, y1, z0, z1, tint) {
  box(out, slot, [x0, y0, z0], [x1, y1, z1], tint);
}
function pierRing(x, y, z, dx, dz, bevel) {
  return [
    [-dx + bevel, -dz],
    [dx - bevel, -dz],
    [dx, -dz + bevel],
    [dx, dz - bevel],
    [dx - bevel, dz],
    [-dx + bevel, dz],
    [-dx, dz - bevel],
    [-dx, -dz + bevel],
  ]
    .toReversed()
    .map(([a, b]) => [x + a, y, z + b]);
}
function piers(out, fine) {
  for (const p of C.piers)
    for (const z of [-7.65, 7.65]) {
      strip(
        out,
        'concrete',
        p.x - 4.8,
        p.x + 4.8,
        p.bottom,
        p.bottom + 1.6,
        z - 4,
        z + 4,
        color.concrete,
      );
      loft(
        out,
        'concrete',
        [
          pierRing(p.x, p.bottom + 1.6, z, 2.2, 3, fine ? 0.28 : 0.08),
          pierRing(p.x, 85.3, z, 1.95, 2.8, fine ? 0.28 : 0.08),
          pierRing(p.x, 87.8, z, 3.1, 5.8, fine ? 0.28 : 0.08),
        ],
        color.concrete,
      );
      strip(out, 'concrete', p.x - 3.2, p.x + 3.2, 87.8, 88.3, z - 5.9, z + 5.9, color.concrete);
      if (fine)
        for (const dz of [-3.5, 3.5])
          strip(
            out,
            'iron',
            p.x - 0.65,
            p.x + 0.65,
            88.3,
            88.72,
            z + dz - 0.6,
            z + dz + 0.6,
            color.dark,
          );
    }
}
function decks(out, cfg) {
  strip(out, 'concrete', -C.half, C.half, 91.2, 91.86, -C.width / 2, C.width / 2, color.concrete);
  strip(out, 'road', -C.half, C.half, 91.86, C.roadY, -12.65, 12.65, color.asphalt);
  for (const sign of [-1, 1]) {
    const a = sign < 0 ? -15.95 : 12.65,
      b = sign < 0 ? -12.65 : 15.95;
    strip(out, 'concrete', -C.half, C.half, 91.86, 92.2, a, b, color.paving);
    // Paired road safety beams and an open outer pedestrian balustrade.
    for (const [z, y] of [
      [sign * 12.8, 92.85],
      [sign * 15.76, 93.25],
    ])
      strip(out, 'iron', -C.half, C.half, y - 0.09, y + 0.09, z - 0.07, z + 0.07, color.white);
    if (cfg.posts)
      for (let x = -C.half + 0.8; x < C.half; x += cfg.posts) {
        for (const z of [sign * 12.8, sign * 15.76])
          strip(
            out,
            'iron',
            x - 0.06,
            x + 0.06,
            92.2,
            z * sign > 14 ? 93.25 : 92.85,
            z - 0.07,
            z + 0.07,
            color.white,
          );
      }
    if (cfg.curb)
      for (let x = -C.half; x < C.half; x += 4)
        strip(
          out,
          'marking',
          x,
          Math.min(C.half, x + 2),
          92.01,
          92.19,
          sign * 12.65 - 0.018,
          sign * 12.65 + 0.018,
          color.white,
        );
  }
  // Four continuous plate/box girders, with shallow concrete approach viaducts.
  for (const z of [-10.5, -3.5, 3.5, 10.5]) {
    // The top flange enters the slab: coincident slab/flange faces flicker in the browser.
    strip(out, 'iron', ...C.mainEnds, 88.7, 91.24, z - 0.68, z + 0.68, color.steel);
    if (cfg.stiffeners)
      for (let x = C.mainEnds[0] + 1; x < C.mainEnds[1]; x += cfg.stiffeners)
        for (const side of [-1, 1])
          strip(
            out,
            'iron',
            x - 0.08,
            x + 0.08,
            88.72,
            91.18,
            z + side * 0.68 - 0.065,
            z + side * 0.68 + 0.065,
            color.steel,
          );
    for (const [a, b] of [
      [-C.half, C.mainEnds[0]],
      [C.mainEnds[1], C.half],
    ])
      strip(out, 'concrete', a, b, 89.1, 91.24, z - 0.5, z + 0.5, color.concrete);
  }
  if (cfg.cross)
    for (let x = C.mainEnds[0] + 4; x < C.mainEnds[1]; x += cfg.cross)
      strip(out, 'iron', x - 0.18, x + 0.18, 89.4, 90.2, -13, 13, color.steel);
  for (const [x, low] of [
    [-C.half + 1, 80],
    [C.half - 1, 86],
  ])
    strip(out, 'concrete', x - 0.8, x + 0.8, low, 91.2, -15.9, 15.9, color.concrete);
  for (const [x, low] of [
    [-215, 75],
    [215, 83],
  ])
    for (const z of [-7.65, 7.65]) {
      strip(out, 'concrete', x - 1.2, x + 1.2, low, 89.1, z - 4.9, z + 4.9, color.concrete);
    }
}
function roadDetails(out, cfg, level) {
  if (!cfg.lamps) return;
  for (const z of [-8.4, -4.2, 4.2, 8.4])
    for (let x = -C.half; x < C.half; x += level === 'district' ? 32 : 12)
      strip(
        out,
        'marking',
        x,
        Math.min(C.half, x + (level === 'district' ? 8 : 4)),
        92.005,
        92.015,
        z - 0.065,
        z + 0.065,
        color.marking,
      );
  for (const z of [-0.12, 0.12])
    strip(out, 'marking', -C.half, C.half, 92.005, 92.015, z - 0.055, z + 0.055, color.marking);
  for (let x = -C.half + 15; x < C.half - 5; x += cfg.lamps)
    for (const sign of [-1, 1]) {
      const z = sign * 14.2;
      beam(out, 'iron', [x, 92.2, z], [x, 101.3, z], 0.2, 0.2, color.white);
      beam(out, 'iron', [x, 101.3, z], [x, 102.1, z - sign * 3.4], 0.15, 0.15, color.white);
      strip(
        out,
        'iron',
        x - 0.24,
        x + 0.24,
        101.85,
        102.1,
        z - sign * 3.4 - 0.65,
        z - sign * 3.4 + 0.65,
        color.white,
      );
      if (level === 'master' || level === 'closeup') {
        strip(out, 'iron', x - 0.35, x + 0.35, 92.2, 92.55, z - 0.35, z + 0.35, color.white);
        beam(out, 'iron', [x, 98.1, z], [x, 98.3, sign * 5.2], 0.075, 0.075, color.white);
      }
    }
  if (level === 'master' || level === 'closeup') {
    // Trolley contact wires: a contemporary route/operational state is not claimed.
    for (const z of [-6.5, -5.3, 5.3, 6.5])
      beam(out, 'iron', [-C.half, 98.0, z], [C.half, 98.0, z], 0.045, 0.045, color.dark);
    for (const x of [-175.9, ...C.piers.map((p) => p.x), 175.9])
      strip(out, 'iron', x - 0.11, x + 0.11, 92.016, 92.025, -12.65, 12.65, color.dark);
  }
}

// Local native approach support; the actual497m bridge remains C.half*2.
const approachWalls = {
  floor: 100.3,
  sides: [
    {
      z: -17.4,
      stations: [
        [232, 100.45],
        [248, 100.978],
        [264, 104.333],
        [280, 106.474],
      ],
    },
    {
      z: 17.4,
      stations: [
        [232, 100.45],
        [248, 102.557],
        [264, 105.681],
        [280, 107.445],
      ],
    },
  ],
  end: [
    [-17.4, 106.474],
    [-6, 106.645],
    [6, 106.913],
    [17.4, 107.445],
  ],
};
function nativeApproach(out, far) {
  const f = approachWalls.floor;
  for (const side of approachWalls.sides) {
    const stations = far ? [side.stations[0], side.stations.at(-1)] : side.stations;
    loft(
      out,
      'concrete',
      stations.map(([x, top]) => [
        [x, f, side.z - 0.16],
        [x, top, side.z - 0.16],
        [x, top, side.z + 0.16],
        [x, f, side.z + 0.16],
      ]),
      color.concrete,
    );
  }
  const end = far ? [approachWalls.end[0], approachWalls.end.at(-1)] : approachWalls.end;
  loft(
    out,
    'concrete',
    end.map(([z, top]) => [
      [279.84, f, z],
      [280.16, f, z],
      [280.16, top - 0.03, z],
      [279.84, top - 0.03, z],
    ]),
    color.concrete,
  );
}
export function buildDavtashenLevel(builder, level = 'master') {
  const cfg = detail[level];
  if (!cfg) throw new Error(`Unknown Davtashen level: ${level}`);
  const out = writer(builder, level === 'skyline');
  piers(out, !['skyline', 'district'].includes(level));
  decks(out, cfg);
  roadDetails(out, cfg, level);
  nativeApproach(writer(builder, level === 'skyline', false), level === 'skyline');
}
export const buildDavtashenSkyline = (out) => buildDavtashenLevel(out, 'skyline');
export const buildDavtashenDistrict = (out) => buildDavtashenLevel(out, 'district');
export const buildDavtashenStreet = (out) => buildDavtashenLevel(out, 'street');
export const buildDavtashenCloseup = (out) => buildDavtashenLevel(out, 'closeup');
export const davtashenStudy = {
  id: 'davtashen_bridge',
  wikidataId: 'Q3396957',
  title: 'Davtashen Bridge',
  mapFrameDocument: 'map-frame.json',
  brief:
    'The complete mapped Yerevan gorge crossing: yellow steel box girders, four paired tall concrete pier stations, shallow approach viaducts, a broad six-lane road, two sidewalks, open white rails and inward-reaching lamps.',
  nativeAxes:
    '+X southeast to Arabkir; -X northwest to Davtashen. +Z southwest. +Y up. Source ground reference is the lowest exposed foundation; exact foundations are inferred.',
  refs: [
    'https://commons.wikimedia.org/wiki/File:Davtasjenbron_20250923.jpg',
    'https://commons.wikimedia.org/wiki/File:Davtashen_bridge_03.jpg',
    'https://commons.wikimedia.org/wiki/File:Davtashen_Bridge_E5027.jpg',
    'https://www.openstreetmap.org/way/1134619158',
  ],
  sourceFacts: [
    'Retained catalog facts: 496 m length, 32 m width and nominal 92 m height; absolute height datum is unresolved.',
    'Exact-QID OSM bridge footprint measures approximately 497.033 × 31.985 m.',
    'Ordinary 2025/older photographs show four paired tall concrete supports, yellow girders, white road furniture and shorter concrete approach spans.',
  ],
  reconstruction: [
    'Original source-local analytic geometry; no downloaded meshes or photo textures.',
    'Five main spans interpreted as 47.8 + 80 + 80 + 80 + 64 m, with remaining approach length split equally. Pier feet, member sections and end schedule remain approximate.',
    'Master retains dense girder stiffeners and rail posts; four separate browser levels reduce repeats while retaining the complete bridge.',
  ],
  limitations: [
    'Foundation elevations, structural sections and precise span/end allocation are approximate photo interpretations. A 4.37% longitudinal visualization grade follows the standard native bank endpoints; it is not an as-built surveyed road profile.',
    'Nominal 92 m height has an unresolved datum; native terrain is coarse in the gorge. Native placement is not approved until current viewer renders are inspected.',
    'Hidden structure, temporary signs/banners, vehicles, exact present traffic and trolley operation, adjoining retaining walls and utility lines crossing the gorge are excluded.',
    'Physical laptop and phone/tablet timing measurements remain pending.',
  ],
  camera: { position: [250, 165, 560], lookAt: [0, 48, 0], fov: 46 },
  qaCameras: [
    { name: 'gorge-paired-piers', position: [0, 75, 440], lookAt: [0, 48, 0], fov: 50 },
    {
      name: 'steel-girders-and-bearing',
      position: [-96, 73, 31],
      lookAt: [-128.1, 88, 3],
      fov: 55,
    },
    { name: 'six-lanes-and-lamps', position: [210, 105, 10], lookAt: [70, 94, 0], fov: 55 },
    { name: 'paired-column-opening', position: [31.9, 43, 48], lookAt: [31.9, 43, 0], fov: 55 },
  ],
  geographic: (mapped) => ({
    anchor: mapped.anchor,
    heading: mapped.heading,
    elevationMode: 'sea-level',
    elevationMeters: 1018,
    replaceFootprint: false,
  }),
  build: (out) => buildDavtashenLevel(out, 'master'),
};
