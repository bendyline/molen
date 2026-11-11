/** The former Army Museum exterior at 7 Jana Kilińskiego, Białystok, in 2020. */
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  cleanRing,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  frame = read('map-frame');
const [outline] = frame.geometry.polygons;
const {
  foundationBottom,
  baseCornice,
  roofLow,
  roofHigh,
  parapet,
  entryX,
  streetBays,
  balconies,
  rearBalconies,
} = plan.section;
const ring = cleanRing(outline);
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96, metallic: 0 },
  base: { slot: 'trim', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.84, metallic: 0.1 },
  detail: { slot: 'window', localRef: 'palette:#fffdfe', roughness: 0.74, metallic: 0.08 },
};
const color = Object.fromEntries(
  Object.entries({
    plaster: 'cec7a4',
    base: '8f8173',
    roof: '655f5a',
    dark: '454542',
    glass: '5b6764',
    frame: 'e0ddd2',
    wood: '8e664f',
    rail: '6b6a62',
    flagRed: 'a74745',
    flagWhite: 'e6e1d4',
    letter: '343634',
    pale: 'd5cdaf',
  }).map(([k, v]) => [k, rgb(v)]),
);
const white = 'palette:#ffffff';
function face(out, slot, points, expected, tint) {
  let n = normalFor(...points);
  if (n.reduce((sum, v, i) => sum + v * expected[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, tint);
  else
    out.addTriangle(
      slot,
      white,
      points,
      n,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      tint,
    );
}
function edge(a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    dx = (b[0] - a[0]) / length,
    dz = (b[1] - a[1]) / length;
  return {
    length,
    n: [dz, 0, -dx],
    point: (u, y, p = 0) => [a[0] + u * dx + p * dz, y, a[1] + u * dz - p * dx],
  };
}
function panel(out, slot, e, l, r, b, t, p, tint) {
  face(
    out,
    slot,
    [e.point(l, b, p), e.point(r, b, p), e.point(r, t, p), e.point(l, t, p)],
    e.n,
    tint,
  );
}
const height = (z) => roofLow + ((roofHigh - roofLow) * (6.15 - z)) / 12.9;
function envelope(out, lod) {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      e = edge(a, b);
    panel(out, 'base', e, 0, e.length, foundationBottom, baseCornice, 0, color.base);
    face(
      out,
      'plaster',
      [
        e.point(0, baseCornice),
        e.point(e.length, baseCornice),
        e.point(e.length, height(b[1]) + parapet),
        e.point(0, height(a[1]) + parapet),
      ],
      e.n,
      color.plaster,
    );
    face(
      out,
      'base',
      [
        e.point(0, height(a[1]) + parapet - 0.12, 0.05),
        e.point(e.length, height(b[1]) + parapet - 0.12, 0.05),
        e.point(e.length, height(b[1]) + parapet + 0.045, 0.05),
        e.point(0, height(a[1]) + parapet + 0.045, 0.05),
      ],
      e.n,
      color.pale,
    );
    if (lod)
      panel(
        out,
        'detail',
        e,
        0,
        e.length,
        baseCornice - 0.08,
        baseCornice + 0.045,
        0.084,
        color.dark,
      );
    if (a[1] < -5.15 && b[1] < -5.15 && e.length > 2.38) {
      const count = Math.max(1, Math.round(e.length / (lod ? 2.58 : 4.25)));
      for (let j = 0; j < count; j++) {
        const u = ((j + 0.5) * e.length) / count;
        window(out, e, u, 1.43, 4.21, 5.97, lod);
        window(out, e, u, 1.43, 7.33, 9.08, lod);
        if (lod >= 2) window(out, e, u, 1.13, 0.56, 2.5, lod, color.wood);
      }
    }
  }
  const tmp = new MeshBufferBuilder();
  if (
    !tmp.addCap(
      'roof',
      white,
      ring,
      [],
      () => 0,
      [0, 1, 0],
      (p) => p,
      color.roof,
    )
  )
    throw Error('Could not cap the single-pitch museum roof');
  const { indices, positions } = tmp.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const p = Array.from(indices.slice(i, i + 3), (j) => {
      const x = positions[j * 3],
        z = positions[j * 3 + 2];
      return [x, height(z), z];
    });
    face(out, 'roof', p, [0, 1, 0], color.roof);
  }
  for (const [x, z] of [
    [-8.17, -3.6],
    [-4.01, -3.84],
    [0.45, -3.82],
    [6.25, -3.7],
    [9.02, -4.1],
  ]) {
    const y = height(z) - 0.04;
    box(out, 'base', x, y, z, 0.58, 0.71, 0.52, color.pale);
    if (lod) box(out, 'base', x, y + 0.65, z, 0.68, 0.14, 0.62, color.frame);
  }
}
function window(out, e, u, w, b, t, lod, tint = color.frame) {
  const r = w / 2;
  if (lod) panel(out, 'detail', e, u - r - 0.085, u + r + 0.085, b - 0.073, t + 0.083, 0.025, tint);
  panel(out, 'detail', e, u - r, u + r, b, t, 0.043, color.glass);
  if (lod >= 2) {
    panel(out, 'detail', e, u - 0.039, u + 0.039, b, t, 0.059, tint);
    panel(out, 'detail', e, u + r * 0.47, u + r * 0.54, b, t, 0.059, tint);
    panel(out, 'detail', e, u - r, u + r, t - 0.23, t - 0.18, 0.06, tint);
  }
  if (lod === 3)
    panel(out, 'detail', e, u - r - 0.16, u + r + 0.16, b - 0.09, b - 0.021, 0.12, color.frame);
}
function balcony(out, x, z, y, dir, lod) {
  const w = 1.93,
    d = 0.82,
    front = z + dir * d;
  box(out, 'base', x, y - 0.19, z + (dir * d) / 2, w, 0.22, d + 0.08, color.base);
  if (!lod) {
    box(out, 'detail', x, y + 0.05, front, w, 0.78, 0.038, color.rail);
    return;
  }
  for (const h of [0.19, 0.51, 0.83]) {
    box(out, 'detail', x, y + h, front, w, 0.039, 0.041, color.rail);
    if (lod >= 2)
      for (const side of [-1, 1])
        box(
          out,
          'detail',
          x + (side * w) / 2,
          y + h,
          z + (dir * d) / 2,
          0.038,
          0.039,
          d,
          color.rail,
        );
  }
  const n = lod >= 2 ? 8 : 4;
  for (let i = 0; i <= n; i++)
    box(out, 'detail', x - w / 2 + (w * i) / n, y + 0.02, front, 0.035, 0.81, 0.035, color.rail);
}
const letters = {
  M: [
    [0, 0, 0, 1],
    [0, 1, 0.5, 0.5],
    [0.5, 0.5, 1, 1],
    [1, 1, 1, 0],
  ],
  U: [
    [0, 1, 0, 0.17],
    [0, 0.17, 0.21, 0],
    [0.21, 0, 0.79, 0],
    [0.79, 0, 1, 0.17],
    [1, 0.17, 1, 1],
  ],
  Z: [
    [0, 1, 1, 1],
    [1, 1, 0, 0],
    [0, 0, 1, 0],
  ],
  E: [
    [0, 0, 0, 1],
    [0, 1, 1, 1],
    [0, 0.5, 0.82, 0.5],
    [0, 0, 1, 0],
  ],
  W: [
    [0, 1, 0.24, 0],
    [0.24, 0, 0.5, 0.7],
    [0.5, 0.7, 0.76, 0],
    [0.76, 0, 1, 1],
  ],
  O: [
    [0, 0.15, 0, 0.85],
    [0, 0.85, 0.18, 1],
    [0.18, 1, 0.82, 1],
    [0.82, 1, 1, 0.85],
    [1, 0.85, 1, 0.15],
    [1, 0.15, 0.82, 0],
    [0.82, 0, 0.18, 0],
    [0.18, 0, 0, 0.15],
  ],
  J: [
    [1, 1, 1, 0.16],
    [1, 0.16, 0.77, 0],
    [0.77, 0, 0.2, 0],
    [0.2, 0, 0, 0.22],
  ],
  S: [
    [1, 0.96, 0.19, 1],
    [0.19, 1, 0, 0.82],
    [0, 0.82, 0.17, 0.59],
    [0.17, 0.59, 0.85, 0.43],
    [0.85, 0.43, 1, 0.22],
    [1, 0.22, 0.82, 0],
    [0.82, 0, 0, 0.035],
  ],
  K: [
    [0, 0, 0, 1],
    [0, 0.5, 1, 1],
    [0, 0.5, 1, 0],
  ],
  A: [
    [0, 0, 0.5, 1],
    [0.5, 1, 1, 0],
    [0.21, 0.42, 0.79, 0.42],
  ],
};
function sign(out, e, u, y, w, h, d, tint) {
  const text = 'MUZEUM WOJSKA',
    advance = w / text.length,
    stroke = h * 0.075;
  for (const [i, ch] of [...text].reverse().entries())
    for (const [a, b, c, d0] of letters[ch] ?? []) {
      const x = u - w / 2 + (i + 0.86) * advance;
      beam(
        out,
        'detail',
        e.point(x - a * advance * 0.73, y + b * h, d),
        e.point(x - c * advance * 0.73, y + d0 * h, d),
        stroke,
        stroke,
        tint,
      );
    }
}
function facades(out, lod) {
  const front = edge(outline[2], outline[7]),
    z = 6.16,
    top = roofLow + parapet;
  const u = (x) => outline[2][0] - x;
  for (const x of streetBays) {
    window(out, front, u(x), 1.39, 4.21, 6.02, lod);
    window(out, front, u(x), 1.39, 7.32, 9.11, lod);
  }
  for (const x of [-10.4, -7.16, -3.84, -0.51, 5.58, 8.89, 11.02]) {
    const w = x > 10.5 ? 1.04 : 1.72;
    window(out, front, u(x), w, 0.53, 2.65, lod, color.wood);
  }
  window(out, front, u(entryX), 1.63, 0.11, 2.72, lod, color.wood);
  box(out, 'base', entryX, -0.22, z + 0.24, 2.08, 0.35, 0.56, color.base);
  for (const x of balconies) {
    for (const y of [4.06, 7.2]) balcony(out, x, z, y, 1, lod);
    for (const [offset, tint] of [
      [-0.19, color.flagWhite],
      [0.19, color.flagRed],
    ]) {
      const v = x + offset;
      face(
        out,
        'detail',
        [
          [v - 0.19, 4.56, z + 0.88],
          [v + 0.19, 4.54, z + 0.88],
          [v + 0.19, 8.96, z + 0.89],
          [v - 0.19, 8.96, z + 0.89],
        ],
        [0, 0, 1],
        tint,
      );
    }
  }
  for (const x of rearBalconies)
    for (const y of [4.09, 7.18]) balcony(out, x, x < -5.25 ? -6.05 : -6.71, y, -1, lod);
  if (lod)
    for (const x of [-8.48, -3.34, 2.1, 7.44]) {
      const at = u(x);
      panel(
        out,
        'detail',
        front,
        at - 0.102,
        at + 0.102,
        top - 0.62,
        top - 0.38,
        0.037,
        color.dark,
      );
    }
  const gable = edge(outline[7], outline[10]),
    mid = gable.length / 2;
  panel(out, 'detail', gable, 0.37, gable.length - 0.34, 6.62, 7.34, 0.071, color.dark);
  const n = [10, 10, 20, 32][lod],
    r = 0.91;
  for (let i = 0; i < n; i++) {
    const p = (j) =>
      gable.point(
        mid + r * Math.cos((j * 2 * Math.PI) / n),
        9.18 + r * Math.sin((j * 2 * Math.PI) / n),
        0.057,
      );
    face(out, 'detail', [gable.point(mid, 9.18, 0.057), p(i), p(i + 1)], gable.n, color.dark);
  }
  if (lod >= 2) {
    sign(out, gable, mid, 6.83, gable.length - 1.24, 0.36, 0.085, color.pale);
    sign(out, front, u(entryX), 2.89, 4.15, 0.23, 0.061, color.letter);
  }
}
function buildLevel(out, lod) {
  envelope(out, lod);
  facades(out, lod);
}
export const bialystokSkyline = (out) => buildLevel(out, 0);
export const bialystokDistrict = (out) => buildLevel(out, 1);
export const bialystokStreet = (out) => buildLevel(out, 2);
export const bialystokCloseup = (out) => buildLevel(out, 3);

const recipe = 'bialystok-museum-model.mjs',
  camera = [-26, 13, 31],
  lookAt = [0, 5, 0];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'bialystokDistrict', 0.18],
    ['street', 'bialystokStreet', 0.064],
    ['closeup', 'bialystokCloseup', 0.024],
  ].map(([name, entry, errorMeters]) => [name, { export: entry, errorMeters, surfaces }]),
);
export const bialystokModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: bialystokCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The former Army Museum exterior at 7 Jana Kilińskiego in August 2020, with beige plaster, street windows, projecting balconies, square-facing lettering and monopitch roof.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  buildingCutout: {
    outline,
    minimumCoverage: 0.94,
    basis: 'The original mapped number 7 museum footprint, separate from the adjacent number 7/1.',
  },
  mediumFiContext: {
    scale: 0.85,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'concrete_plain', 'metal_painted'],
  qaCameras: [
    { name: 'kilinskiego-street-and-balconies', position: [-18, 8, 27], lookAt: [0, 4, 3] },
    { name: 'square-medallion-and-rear', position: [-26, 10, -21], lookAt: [-4, 5, 0] },
    { name: 'single-pitch-roof-and-mapped-plan', position: [14, 39, -26], lookAt: [0, 4, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-bialystok-museum-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'bialystokSkyline',
    errorMeters: 0.29,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. OpenStreetMap geographic controls, ODbL 1.0. Exact CC0 photographer-released photos by Rakoon.',
};
