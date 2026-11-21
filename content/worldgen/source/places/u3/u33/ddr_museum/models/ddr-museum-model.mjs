import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  at,
  cap,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  pairs,
  palette,
  panel,
  planarMid,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const { dimensions: d } = plan;
const grade = floorSampler(read('terrain-grid.json'));
const colors = palette({
  stone: 'd0c6ac',
  coping: 'd9d2bc',
  limestone: 'b6a98f',
  joint: 'b5aa96',
  roof: '929081',
  glass: '6b8591',
  darkGlass: '525e61',
  blueGlass: '58768f',
  frame: '6d6d61',
  dark: '535752',
  pavement: 'a8a296',
  fill: '858479',
  lettering: 'ece6d9',
  portal: 'a24536',
  band: '897d67',
  foil: 'aaa79c',
});
const surfaces = {
  stone: surface('wall', 'stone_limestone', 0.95),
  paving: surface('foundation', 'stone_ashlar', 0.96),
  window: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.44, metallic: 0.13 },
  metal: surface('trim', 'metal_painted', 0.78, 0.24),
  foil: surface('roof', 'membrane', 0.9),
  accent: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.89 },
};
const floor = d.museumY;
const streetY = d.hostStreetY;
const terraceOutline = [
  [-22.2, -0.74],
  [-15.2, -0.56],
  [-7.7, -0.34],
  [0, -0.15],
  [7.9, 0.03],
  [13.31, 0.25],
  [16.3, 1.13],
  [24.1, 2.12],
  [24.34, 4.32],
  [12, 4.67],
  [-1, 4.2],
  [-12.6, 3.86],
  [-22.39, 3.68],
];
const entranceClearance = [
  [-20.99, -0.88],
  [13.02, -0.17],
  [13.46, 1.77],
  [-21.1, 1.58],
];
function mass(out, key, outline, bottom, top, side, roof = side) {
  shell(out, outline, typeof bottom === 'function' ? bottom : () => bottom, top, {
    wall: key,
    color: side,
    roofColor: roof,
  });
}
function walls(outline) {
  const sign = areaSign(outline);
  return pairs(closed(outline)).map(([a, b]) => edge(a, b, sign));
}
const tint = [colors.glass, colors.blueGlass, colors.darkGlass];
function facade(out, level, outline, lo, levels) {
  const floorHeight = 3.39;
  const high = lo + levels * floorHeight;
  for (const w of walls(outline)) {
    panel(out, 'stone', w, 0, w.length, lo - 0.015, lo + 0.62, 0.065, colors.limestone);
    panel(out, 'stone', w, 0, w.length, high - 0.33, high + 0.18, 0.16, colors.coping);
    const count = Math.max(1, Math.round(w.length / (w.length < 7 ? 3.15 : 3.05)));
    const bay = w.length / count;
    for (let storey = 0; storey < levels; storey++) {
      const y0 = lo + storey * floorHeight;
      const y1 = y0 + 0.67,
        y2 = y0 + (storey === 0 ? 2.97 : 2.83);
      const offset = storey === 0 ? 0.128 : 0.042;
      if (level === 0) {
        const margin = Math.min(w.length * 0.14, 0.8);
        panel(out, 'window', w, margin, w.length - margin, y1, y2, offset, colors.glass);
        continue;
      }
      const slit = bay * (storey === 0 ? 0.79 : 0.64);
      for (let i = 0; i < count; i++) {
        const mid = (i + 0.5) * bay,
          left = mid - slit / 2,
          right = mid + slit / 2;
        panel(out, 'window', w, left, right, y1, y2, offset, tint[(i + 2 * storey) % tint.length]);
        if (level >= 2) {
          panel(
            out,
            'stone',
            w,
            left - 0.085,
            right + 0.085,
            y1 - 0.115,
            y1 + 0.025,
            offset + 0.042,
            colors.coping,
          );
          panel(out, 'metal', w, mid - 0.021, mid + 0.021, y1, y2, offset + 0.028, colors.frame);
          if (level === 3) {
            for (const x of [left, right])
              panel(out, 'stone', w, x - 0.063, x + 0.063, y1, y2, offset + 0.032, colors.joint);
            panel(
              out,
              'metal',
              w,
              left,
              right,
              y1 + 0.55,
              y1 + 0.597,
              offset + 0.033,
              colors.frame,
            );
          }
        }
      }
      if (level >= 2 && storey % 2 === 0)
        panel(out, 'stone', w, 0, w.length, y0 + 0.09, y0 + 0.23, 0.07, colors.joint);
    }
  }
}

function roofRing(out, outer, hole, y) {
  const vertices = [...outer, ...hole];
  const triangles = earcut(vertices.flat(), [outer.length]);
  for (let i = 0; i < triangles.length; i += 3) {
    const points = triangles.slice(i, i + 3).map((id) => at(vertices[id], y));
    face(out, 'metal', points, up, colors.roof);
  }
}
function roof(out, level, wallY) {
  const outer = d.outline,
    inner = d.atriumOutline;
  roofRing(out, outer, inner, wallY);
  const center = planarMid(inner);
  const scaled = (f) => inner.map(([x, z]) => [mix(center[0], x, f), mix(center[1], z, f)]);
  const shoulder = scaled(0.7),
    ridge = scaled(0.42);
  const base = wallY + 0.09,
    eave = streetY + d.hostHeight - 2.9,
    top = streetY + d.hostHeight;
  const fascia = walls(inner);
  for (const [i, w] of fascia.entries()) {
    const j = (i + 1) % inner.length;
    const p = at(inner[i], base),
      q = at(inner[j], base),
      a = at(shoulder[i], eave),
      b = at(shoulder[j], eave),
      u = at(ridge[i], top),
      v = at(ridge[j], top);
    face(out, 'window', [p, q, b, a], up, colors.blueGlass);
    face(out, 'window', [a, b, v, u], up, colors.glass);
    if (level >= 2) {
      for (const [l, r] of [
        [p, a],
        [a, u],
      ])
        beam(out, 'metal', l, r, 0.092, 0.087, colors.frame);
      const runs = Math.max(1, Math.floor(w.length / 2.5));
      for (let i = 1; i < runs; i++) {
        const t = i / runs;
        const lerp = (a, b) => a.map((u, j) => mix(u, b[j], t));
        beam(out, 'metal', lerp(p, q), lerp(a, b), 0.068, 0.072, colors.frame);
        if (level === 3) beam(out, 'metal', lerp(a, b), lerp(u, v), 0.054, 0.059, colors.frame);
      }
    }
  }
  cap(out, 'foil', ridge, top, colors.foil);
  if (level > 0)
    for (const w of walls(outer))
      panel(out, 'stone', w, 0, w.length, wallY - 0.12, wallY + 0.54, 0.18, colors.coping);
}

function podium(out, level) {
  const hostY = streetY + d.hostFloors * 3.39;
  mass(
    out,
    'stone',
    d.outline,
    (p) => Math.min(streetY - 0.3, grade(p) - 0.32),
    hostY,
    colors.stone,
  );
  facade(out, level, d.outline, streetY, d.hostFloors);
  roof(out, level, hostY + 0.047);
}

const letters = {
  D: ['1110', '1001', '1001', '1001', '1110'],
  R: ['1110', '1001', '1110', '1010', '1001'],
  M: ['10001', '11011', '10101', '10001', '10001'],
  U: ['1001', '1001', '1001', '1001', '0110'],
  S: ['0111', '1000', '0110', '0001', '1110'],
  E: ['1111', '1000', '1110', '1000', '1111'],
  ' ': ['00', '00', '00', '00', '00'],
};
function museumLetters(out, w, x, y) {
  const pitch = 0.148;
  for (const glyph of 'DDR MUSEUM') {
    const rows = letters[glyph];
    for (const [i, row] of rows.entries()) {
      for (let j = 0; j < row.length; j++) {
        if (row[j] !== '1') continue;
        const right = x - j * pitch;
        panel(
          out,
          'accent',
          w,
          right - pitch * 0.96,
          right,
          y + (4 - i) * pitch,
          y + (5 - i) * pitch - 0.005,
          0.143,
          colors.lettering,
        );
      }
    }
    x -= (rows[0].length + 0.7) * pitch;
  }
}

function museumFront(out, level) {
  mass(out, 'stone', d.museumOutline, -0.68, streetY + 0.035, colors.limestone, colors.pavement);
  const front = [d.museumOutline[0], d.museumOutline[4]];
  const w = edge(...front, 1);
  const mid = w.length * (front[0][0] / (front[0][0] - front[1][0]));
  panel(out, 'stone', w, 0, w.length, streetY - 0.37, streetY + 0.12, 0.108, colors.coping);
  panel(out, 'accent', w, mid - 4.3, mid + 4.3, 2.42, streetY - 0.15, 0.132, colors.band);
  panel(out, 'metal', w, mid - 2.25, mid + 2.25, floor, 2.32, 0.12, colors.portal);
  panel(out, 'window', w, mid - 2.04, mid + 2.04, floor + 0.09, 2.21, 0.151, colors.darkGlass);
  if (level >= 2) museumLetters(out, w, mid + 3.55, 2.55);
  for (const [a, b] of [
    [3, mid - 3.35],
    [mid + 3.32, w.length - 2.1],
  ]) {
    panel(out, 'window', w, a, b, floor + 0.48, 2.29, 0.051, colors.glass);
    if (level > 0) {
      const n = Math.max(1, Math.round((b - a) / 1.35));
      for (let i = 0; i <= n; i++) {
        const u = mix(a, b, i / n);
        panel(out, 'metal', w, u - 0.025, u + 0.025, floor + 0.43, 2.31, 0.073, colors.frame);
      }
    }
  }
  if (level > 1)
    for (const u of [-2.02, -1.04, 0, 1.04, 2.02])
      panel(
        out,
        'metal',
        w,
        mid + u - 0.032,
        mid + u + 0.032,
        floor + 0.08,
        2.23,
        0.179,
        colors.frame,
      );
}

function quay(out, level) {
  mass(out, 'paving', terraceOutline, -2.14, floor - 0.018, colors.fill, colors.pavement);
  const pavements = walls(terraceOutline).filter((w) => w.normal[2] > 0.37 && w.length > 3);
  for (const w of pavements) {
    panel(out, 'paving', w, 0, w.length, floor - 0.24, floor + 0.09, 0.067, colors.coping);
    if (level === 0) continue;
    beam(out, 'metal', w.p(0, floor + 0.99), w.p(w.length, floor + 0.99), 0.05, 0.057, colors.dark);
    const n = Math.max(2, Math.round(w.length / 2.14));
    for (let i = 0; i <= n; i++) {
      const x = (w.length * i) / n;
      beam(out, 'metal', w.p(x, floor + 0.04), w.p(x, floor + 0.98), 0.039, 0.039, colors.dark);
    }
    if (level >= 2)
      beam(
        out,
        'metal',
        w.p(0, floor + 0.42),
        w.p(w.length, floor + 0.42),
        0.037,
        0.042,
        colors.dark,
      );
  }
  const opening = entranceClearance;
  cap(out, 'paving', opening, floor - 0.015, colors.pavement);
}

function bridgeStair(out, level) {
  const [a, b] = d.stair,
    w = edge(a, b);
  const [lo, hi] = d.stairLandingY;
  const width = 1.69,
    count = level === 0 ? 4 : level === 1 ? 8 : 16;
  const section = (u, v, z) => w.p(u, v, z);
  for (let i = 0; i < count; i++) {
    const left = (w.length * i) / count,
      right = (w.length * (i + 1)) / count,
      y = mix(lo, hi, (i + 1) / count);
    const r = [
      section(left, y, -width),
      section(right, y, -width),
      section(right, y, width),
      section(left, y, width),
    ].map(([x, , z]) => [x, z]);
    mass(
      out,
      'paving',
      r,
      (p) => Math.min(grade(p) - 0.14, y - 0.22),
      y,
      colors.fill,
      colors.pavement,
    );
  }
  if (level > 0)
    for (const z of [-width, width]) {
      beam(
        out,
        'metal',
        section(0, lo + 0.91, z),
        section(w.length, hi + 0.91, z),
        0.053,
        0.06,
        colors.dark,
      );
      for (let i = 0; i < 5; i++) {
        const u = (w.length * i) / 4,
          y = mix(lo, hi, i / 4);
        beam(out, 'metal', section(u, y, z), section(u, y + 0.89, z), 0.055, 0.055, colors.dark);
      }
    }
  const landing = [b, [b[0] + 6.04, b[1] - 0.6], [b[0] + 6.04, b[1] + 1.58], [b[0], b[1] + 1.72]];
  mass(out, 'paving', landing, floor - 0.63, hi, colors.fill, colors.pavement);
}

function build(out, level) {
  podium(out, level);
  museumFront(out, level);
  quay(out, level);
  bridgeStair(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'ddr-museum-model.mjs';
const camera = [105, 62, 109],
  lookAt = [-5, 14, -33];
const errors = { district: 0.66, street: 0.22, closeup: 0.069 };
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'civic-institutional',
  quality: 'medium-fi-exterior',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  reviewStatus: 'review-in-qa.json',
  build: closeup,
  surfaces,
  groundContactBasis:
    'Original Berlin ATKIS DGM1 sets the lower water-facing entrance, the adjacent quay and the higher Karl-Liebknecht approach.',
  brief:
    'Berlin’s DDR Museum at Vera-Brittain-Ufer, with the stair from Karl-Liebknecht Bridge and the stone-and-glass DomAquarée hotel wing above.',
  camera,
  lookAt,
  sunDirection: [67, 111, 80],
  mediumFiContext: {
    scale: 1,
    groundY: -0.3,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.92,
    basis: 'Named native upper host building perimeter, with the museum at its riverfront level.',
  },
  groundCutout: {
    outline: entranceClearance,
    minHeight: floor - 0.075,
    basis:
      'The narrow public approach in front of the below-street museum must remain open beside the terrace.',
  },
  embeddedCanonicalGraphs: ['stone_limestone', 'stone_ashlar', 'metal_painted', 'membrane'],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    {
      name: 'dom-aquaree-museum-and-spree-approach',
      position: [69, 38, 83],
      lookAt: [-4, 11, -21],
    },
    { name: 'museum-entry-at-promenade-level', position: [7, 5.4, 18], lookAt: [-2, 2.91, -0.25] },
    { name: 'stair-from-karl-liebknecht-bridge', position: [44, 14, 17], lookAt: [16, 1.85, 0.25] },
    { name: 'inclined-glazed-atrium', position: [62, 64, -89], lookAt: [-9, 22, -43] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'ddr-museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.19,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(errors).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
};
