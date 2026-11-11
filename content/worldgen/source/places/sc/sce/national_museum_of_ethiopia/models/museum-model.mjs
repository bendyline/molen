/** The permanent exhibition building at the National Museum of Ethiopia. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  poly,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const { footprint, steps, foundationBottom, entryFloor, upperStart, roofTop } = plan;
export const surfaces = {
  wall: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.95, metallic: 0 },
  edge: { slot: 'trim', graph: 'concrete_plain', roughness: 0.93, metallic: 0 },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.95, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.89, metallic: 0.1 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
};
const colors = {
  wall: rgb('b6b3a5'),
  edge: rgb('c2bfb1'),
  roof: rgb('878982'),
  steel: rgb('a7aba1'),
  dark: rgb('626d68'),
};
const glass = rgb('75858a'),
  darkRecess = rgb('535d5e'),
  slate = rgb('8a8c82'),
  louver = rgb('745c4c');
const block = (out, k, x0, y0, z0, x1, y1, z1, color = colors[k]) =>
  box(out, k, [x0, y0, z0], [x1, y1, z1], color);
function face(out, k, p, expected, color = colors[k]) {
  let n = normalFor(...p);
  if (n.reduce((sum, v, i) => sum + v * expected[i], 0) < 0) {
    p = [...p].reverse();
    n = normalFor(...p);
  }
  if (p.length === 4) quad(out, k, p, n, color);
  else out.addConvexPolygon(k, 'palette:#ffffff', p, n, ([x, y]) => [x, y], color);
}
function shell(out, k, ring, y0, y1, color = colors[k]) {
  const b = new MeshBufferBuilder();
  poly(b, k, ring, y0, y1, color);
  const m = b.finalize();
  for (let i = 0; i < m.indices.length; i += 3) {
    const p = Array.from(m.indices.slice(i, i + 3), (j) =>
      Array.from(m.positions.slice(j * 3, j * 3 + 3)),
    );
    face(out, k, p, normalFor(...p), color);
  }
}
const border = footprint.filter((_, i) => i !== 2);
const [x0, x1] = [footprint[3][0], footprint[1][0]];
const z1 = footprint[1][1];
const frontX = footprint[2][0];
function edge(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    n = [dz / len, 0, -dx / len];
  return {
    len,
    n,
    p: (u, y, d = 0) => [a[0] + (dx * u) / len + n[0] * d, y, a[1] + (dz * u) / len + n[2] * d],
  };
}
function panel(out, k, s, u0, y0, u1, y1, d = 0, color = colors[k]) {
  face(out, k, [s.p(u0, y0, d), s.p(u1, y0, d), s.p(u1, y1, d), s.p(u0, y1, d)], s.n, color);
}
function fin(out, s, u, width, y0, y1, depth, color = colors.wall) {
  const p = (x, y, d) => s.p(u + x, y, d);
  const a = p(-width / 2, y0, 0),
    b = p(width / 2, y0, 0);
  const c = p(-width / 2, y0, depth),
    d = p(width / 2, y0, depth);
  const lift = ([x, _, z]) => [x, y1, z];
  face(out, 'wall', [c, d, lift(d), lift(c)], s.n, color);
  face(
    out,
    'wall',
    [a, c, lift(c), lift(a)],
    a.map((v, i) => v - b[i]),
    color,
  );
  face(
    out,
    'wall',
    [b, d, lift(d), lift(b)],
    b.map((v, i) => v - a[i]),
    color,
  );
  face(out, 'edge', [lift(a), lift(b), lift(d), lift(c)], [0, 1, 0]);
}
function buttress(out, s, u) {
  const p = (x, y, d) => s.p(u + x, y, d);
  const a = p(-0.28, 0.46, 0.21),
    b = p(0.28, 0.46, 0.21),
    c = p(-0.28, 0.46, 0.94),
    d = p(0.28, 0.46, 0.94);
  const e = p(-0.28, entryFloor, 0.26),
    f = p(0.28, entryFloor, 0.26);
  face(
    out,
    'wall',
    [a, c, e],
    a.map((v, i) => v - b[i]),
  );
  face(
    out,
    'wall',
    [b, d, f],
    b.map((v, i) => v - a[i]),
  );
  face(out, 'edge', [c, d, f, e], [0, 1, 0]);
}
function facade(out, lod) {
  const inset = border.map(([x, z]) => [x * 0.96, z * 0.96]);
  shell(out, 'wall', border, foundationBottom, entryFloor - 0.37);
  shell(out, 'dark', inset, entryFloor - 0.38, upperStart + 0.02, glass);
  shell(out, 'wall', border, upperStart, roofTop);
  shell(
    out,
    'edge',
    border.map(([x, z]) => [x * 1.016, z * 1.016]),
    roofTop - 0.18,
    roofTop + 0.09,
  );
  for (let i = 0; i < border.length; i++) {
    const s = edge(border[i], border[(i + 1) % border.length]),
      front = i === 1,
      back = i === 3;
    const bays = 7,
      spacing = s.len / bays;
    for (let j = 0; j <= bays; j++) {
      const u = Math.max(0.15, Math.min(s.len - 0.15, spacing * j));
      if (front && j > 2 && j < 5) continue;
      fin(out, s, u, 0.27, entryFloor - 0.01, upperStart + 0.08, 0.11);
      fin(out, s, u, 0.19, upperStart + 0.02, roofTop - 0.12, 0.16);
      if (lod && !front && !back) buttress(out, s, u);
    }
    if (!lod) continue;
    for (let j = 0; j < bays; j++) {
      const u = spacing * (j + 0.5);
      if (front && j === 3) continue;
      const lower = entryFloor + 0.19,
        upper = upperStart - 0.22;
      panel(
        out,
        'dark',
        s,
        u - spacing * 0.43,
        lower,
        u + spacing * 0.43,
        upper,
        0.023,
        back ? darkRecess : glass,
      );
      if (lod > 1) {
        const bars = lod === 3 ? 11 : 7;
        for (let k = 0; k < bars; k++) {
          const x = u + (k / (bars - 1) - 0.5) * spacing * 0.8;
          panel(out, 'steel', s, x - 0.019, lower, x + 0.019, upper, 0.044);
        }
        panel(out, 'edge', s, u - spacing * 0.43, lower, u + spacing * 0.43, lower + 0.05, 0.062);
      }
      if (!back)
        for (const y of [5.83, 9.31]) {
          panel(out, 'edge', s, u - 0.18, y - 0.1, u + 0.18, y + 2.82, 0.055);
          panel(out, 'dark', s, u - 0.105, y, u + 0.105, y + 2.66, 0.076, darkRecess);
          if (lod > 1) {
            for (let k = 1; k < (lod === 3 ? 10 : 6); k++) {
              const p = y + (2.66 * k) / (lod === 3 ? 10 : 6);
              panel(out, 'wall', s, u - 0.097, p, u + 0.097, p + 0.056, 0.092, louver);
            }
            fin(out, s, u, 0.38, y + 2.7, y + 2.79, 0.39, colors.edge);
          }
        }
    }
  }
}
function entry(out, lod) {
  const lowZ = steps[0][1],
    highZ = steps[1][1],
    at = (x) => frontX + x;
  const count = [4, 8, 11, 14][lod],
    low = 0.08;
  for (let i = 0; i < count; i++) {
    const a = lowZ - ((lowZ - highZ) * (i + 1)) / count,
      b = lowZ - ((lowZ - highZ) * i) / count;
    const height = low + ((entryFloor - low) * (i + 1)) / count;
    block(out, 'edge', at(-2.25), foundationBottom, a, at(2.25), height, b, slate);
  }
  for (const x of [-2.43, 2.43]) {
    const profile = [
      [highZ, entryFloor + 0.79],
      [lowZ, 0.69],
      [lowZ, foundationBottom],
      [highZ, foundationBottom],
    ];
    const ring = (dx) => profile.map(([z, y]) => [at(x + dx), y, z]);
    loft(out, 'wall', [ring(-0.21), ring(0.21)], colors.wall);
  }
  block(out, 'wall', at(-2.71), 4.76, z1 - 0.27, at(2.71), 5.31, z1 + 3.73);
  block(out, 'edge', at(-2.64), 4.98, z1 + 3.735, at(2.64), 5.235, z1 + 3.782, colors.edge);
  block(out, 'edge', at(-1.65), entryFloor, z1 - 0.18, at(1.65), 4.68, z1 + 0.046);
  block(
    out,
    'dark',
    at(-1.41),
    entryFloor + 0.02,
    z1 + 0.048,
    at(1.41),
    4.56,
    z1 + 0.078,
    darkRecess,
  );
  block(out, 'dark', at(-1.35), 5.45, z1 + 0.013, at(1.35), roofTop - 0.52, z1 + 0.043, slate);
  if (lod > 1)
    for (const dx of [-1.02, -0.68, -0.34, 0, 0.34, 0.68, 1.02])
      block(
        out,
        'steel',
        at(dx - 0.026),
        entryFloor + 0.07,
        z1 + 0.087,
        at(dx + 0.026),
        4.54,
        z1 + 0.106,
      );
}
function skylight(out, lod) {
  const rect = (y, x, z) => [
    [-x, y, -z],
    [-x, y, z],
    [x, y, z],
    [x, y, -z],
  ];
  loft(
    out,
    'roof',
    [rect(roofTop + 0.06, 10.75, 10.81), rect(roofTop + 0.16, 10.75, 10.81)],
    colors.roof,
  );
  loft(out, 'dark', [rect(roofTop + 0.21, 3.25, 3.91), rect(roofTop + 0.79, 2.81, 0.18)], glass);
  if (lod > 1) block(out, 'steel', -2.86, roofTop + 0.75, -0.08, 2.86, roofTop + 0.82, 0.08);
}
export function buildMuseum(out, _frame, lod = 3) {
  facade(out, lod);
  entry(out, lod);
  skylight(out, lod);
}
export const museumSkyline = (out, frame) => buildMuseum(out, frame, 0);
export const museumDistrict = (out, frame) => buildMuseum(out, frame, 1);
export const museumStreet = (out, frame) => buildMuseum(out, frame, 2);
export const museumCloseup = (out, frame) => buildMuseum(out, frame, 3);
const camera = [-44, 24, 56],
  lookAt = [0, 5, 2];
export const museumModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe: 'museum-model.mjs',
  surfaces,
  build: buildMuseum,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'National Museum of Ethiopia permanent gallery, with board-formed concrete fins, raised glazing and an east entry stair.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  portableGroundY: 0,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['concrete_boardformed', 'concrete_plain', 'membrane', 'metal_painted'],
  qaCameras: [
    { name: 'east-entry-and-raised-glazing', position: [-21, 8, 36], lookAt: [0, 6, 7] },
    { name: 'side-fins-and-foundation', position: [38, 16, 27], lookAt: [0, 5, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-addis-museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module:
      'content/worldgen/source/places/sc/sce/national_museum_of_ethiopia/models/museum-model.mjs',
    level: 'skyline',
    export: 'museumSkyline',
    errorMeters: 0.25,
    surfaces,
    authoredLevels: {
      district: { export: 'museumDistrict', errorMeters: 0.14, surfaces },
      street: { export: 'museumStreet', errorMeters: 0.061, surfaces },
      closeup: { export: 'museumCloseup', errorMeters: 0.023, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. The cleared exterior photograph by O.Mustafin is under CC0. OpenStreetMap contributors supply mapped geometry under ODbL.',
};
