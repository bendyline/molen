/** Xavier and Sadie Herbert's cottage in Redlynch, Queensland. */
import fs from 'node:fs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import {
  box as meshBox,
  profile,
  quad,
  tube,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const d = plan.dimensions;
const c = Object.fromEntries(
  Object.entries({
    paint: 'd0cdb7',
    board: 'bdc0a8',
    fascia: 'ded9c6',
    trim: 'ded9bc',
    frame: 'a1a994',
    glass: '687774',
    shade: '7a8271',
    door: '92a18b',
    iron: '9da49a',
    seam: '868d84',
    plinth: '999486',
    block: 'b9b5a9',
    timber: '9a8268',
    steps: 'a69c88',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const palette = 'palette:#ffffff';
const surfaces = {
  siding: { slot: 'wall', localRef: palette, roughness: 0.93 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.84, metallic: 0.14 },
  foundation: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94 },
  trim: { slot: 'trim', localRef: palette, roughness: 0.89 },
  opening: { slot: 'window', localRef: palette, roughness: 0.68 },
};
const box = (out, slot, x0, x1, y0, y1, z0, z1, tint) =>
  meshBox(out, slot, [x0, y0, z0], [x1, y1, z1], tint);
const panel = (out, slot, place, n, a, b, lo, hi, depth, tint) =>
  quad(
    out,
    slot,
    [place(a, lo, depth), place(b, lo, depth), place(b, hi, depth), place(a, hi, depth)],
    n,
    tint,
  );
const at = ([x, z], y) => [x, y, z];

const x0 = d.cottageEastX,
  x1 = d.cottageWestX;
const z0 = d.cottageRearZ,
  z1 = d.frontZ;
const y0 = d.floorY,
  y1 = d.eaveY;
const facade = (u, y, d) => [u, y, z1 + d];
const back = (u, y, d) => [u, y, z0 - d];

function stumps(out, level) {
  const fore = [z0 + 0.4, -3.1, 2.3, z1 - 0.43];
  const across = [x0 + 0.39, 1.55, x1 - 0.4];
  for (const [i, x] of across.entries()) {
    for (const [j, z] of fore.entries()) {
      if (level >= 2 && (i + j) % 5 === 0) {
        profile(
          out,
          [
            [d.foundationY, 0.16, 0.16],
            [y0 - 0.11, 0.17, 0.17, 'foundation', c.plinth],
          ],
          8,
          [x, z],
        );
      } else
        box(
          out,
          'trim',
          x - 0.095,
          x + 0.095,
          d.foundationY,
          y0 - 0.09,
          z - 0.095,
          z + 0.095,
          c.timber,
        );
    }
  }
  box(out, 'trim', x0 + 0.04, x1 - 0.04, y0 - 0.16, y0 + 0.06, z0 + 0.04, z1 - 0.04, c.timber);
}

function panels(out, loc, n, left, right, base, top, level) {
  if (level === 0) return;
  const rows = level === 1 ? 6 : level === 2 ? 11 : 15;
  for (let i = 1; i < rows; i++) {
    const y = base + ((top - base) * i) / rows;
    panel(out, 'trim', loc, n, left, right, y, y + 0.017, 0.013, c.board);
  }
}

function window(out, loc, normal, u, w, base, top, level, narrow) {
  const half = w / 2;
  panel(
    out,
    'trim',
    loc,
    normal,
    u - half - 0.095,
    u + half + 0.095,
    base - 0.1,
    top + 0.08,
    0.027,
    c.trim,
  );
  panel(out, 'opening', loc, normal, u - half, u + half, base, top, 0.038, c.glass);
  if (level >= 1) {
    for (const p of narrow ? [0] : [-0.25, 0.25]) {
      const i = u + p * w;
      panel(out, 'trim', loc, normal, i - 0.025, i + 0.025, base, top, 0.059, c.frame);
    }
    if (level >= 2)
      panel(
        out,
        'trim',
        loc,
        normal,
        u - half,
        u + half,
        (base + top) / 2,
        (base + top) / 2 + 0.032,
        0.055,
        c.frame,
      );
  }
}

function roof(out, level) {
  const a = [x0 - 0.36, z0 - 0.43],
    b = [x1 + 0.36, z0 - 0.43],
    c0 = [x1 + 0.36, z1 + 0.43],
    d0 = [x0 - 0.36, z1 + 0.43];
  const mid = (x0 + x1) / 2;
  const vol = (x1 - x0) / 2 + 0.35;
  const behind = [mid, z0 + vol - 0.4],
    ahead = [mid, z1 - vol + 0.4];
  const ridge = d.ridgeY;
  const base = y1 - 0.06;
  const slope = (ridge - base) / vol;
  quad(
    out,
    'roof',
    [at(a, base), at(d0, base), at(ahead, ridge), at(behind, ridge)],
    [-slope, 1, 0],
    c.iron,
  );
  quad(
    out,
    'roof',
    [at(b, base), at(c0, base), at(ahead, ridge), at(behind, ridge)],
    [slope, 1, 0],
    c.iron,
  );
  for (const [p, q, r, n] of [
    [a, b, behind, -1],
    [d0, c0, ahead, 1],
  ]) {
    out.addTriangle(
      'roof',
      palette,
      [at(p, base), at(q, base), at(r, ridge)],
      [0, 1, slope * n],
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      c.iron,
    );
  }
  box(out, 'trim', a[0], b[0], base - 0.12, base + 0.04, a[1] - 0.035, a[1] + 0.055, c.fascia);
  box(out, 'trim', d0[0], c0[0], base - 0.12, base + 0.04, d0[1] - 0.055, d0[1] + 0.035, c.fascia);
  box(out, 'trim', a[0] - 0.025, a[0] + 0.055, base - 0.13, base + 0.03, a[1], d0[1], c.fascia);
  box(out, 'trim', b[0] - 0.055, b[0] + 0.025, base - 0.13, base + 0.03, b[1], c0[1], c.fascia);
  if (level >= 1)
    box(
      out,
      'roof',
      mid - 0.078,
      mid + 0.078,
      ridge - 0.032,
      ridge + 0.045,
      behind[1],
      ahead[1],
      c.seam,
    );
  if (level >= 2) {
    for (const [from, to] of [
      [a, behind],
      [b, behind],
      [c0, ahead],
      [d0, ahead],
    ]) {
      tube(out, 'trim', at(from, base + 0.045), at(to, ridge + 0.041), 0.039, c.seam, 5);
    }
  }
}

function cottage(out, level) {
  stumps(out, level);
  box(out, 'siding', x0, x1, y0, y1, z0, z1, c.paint);
  roof(out, level);
  panels(out, facade, [0, 0, 1], x0, x1, y0, y1, level);
  panels(out, back, [0, 0, -1], x0, x1, y0, y1, level);
  for (const [x, side] of [
    [x0, -1],
    [x1, 1],
  ]) {
    const loc = (u, y, d) => [x + side * d, y, u];
    panels(out, loc, [side, 0, 0], z0, z1, y0, y1, level);
    for (const u of [-4.85, -0.39, 4.35]) {
      window(out, loc, [side, 0, 0], u, 1.46, 1.76, 2.83, level, true);
      if (side > 0) {
        const a = [x + 0.04, 2.99, u - 0.93],
          b = [x + 0.04, 2.99, u + 0.93];
        const p = [x + 0.54, 2.76, u + 0.93],
          q = [x + 0.54, 2.76, u - 0.93];
        quad(out, 'roof', [a, b, p, q], [0.415, 1, 0], c.iron);
        box(out, 'trim', x + 0.49, x + 0.56, 2.69, 2.78, u - 0.93, u + 0.93, c.fascia);
      }
    }
  }
  for (const u of [-0.81, 4.03]) {
    window(out, facade, [0, 0, 1], u, 1.64, 1.62, 2.87, level, false);
    window(out, back, [0, 0, -1], u, 1.36, 1.49, 2.63, level, false);
  }
  window(out, facade, [0, 0, 1], 1.72, 1.11, 0.72, 2.8, level, true);
  for (const u of [-1.93, 0.28, 3.02, 5.14]) {
    box(out, 'trim', u - 0.045, u + 0.045, y0, y1 - 0.12, z1 - 0.035, z1 + 0.09, c.fascia);
  }
  lattice(out, level);
  for (let i = 0; i < 3; i++) {
    box(
      out,
      'foundation',
      0.93,
      2.49,
      -0.27,
      0.23 * (i + 1),
      z1 - 0.08,
      z1 + 0.79 - i * 0.23,
      c.steps,
    );
  }
}

function lattice(out, level) {
  if (level === 0) return;
  for (const [left, right] of [
    [x0 + 0.16, 0.32],
    [3.08, x1 - 0.16],
  ]) {
    const lo = 0.98,
      hi = 1.52;
    box(out, 'trim', left, right, lo - 0.025, lo + 0.04, z1 + 0.079, z1 + 0.118, c.frame);
    box(out, 'trim', left, right, hi - 0.035, hi + 0.033, z1 + 0.079, z1 + 0.118, c.frame);
    if (level < 2) continue;
    const n = Math.round((right - left) / 0.21);
    for (let i = 0; i < n; i++) {
      const x = left + ((right - left) * (i + 0.15)) / n;
      const dest = Math.min(right, x + 0.34);
      tube(out, 'trim', [x, lo, z1 + 0.095], [dest, hi, z1 + 0.095], 0.012, c.frame, 4);
      if (level === 3)
        tube(out, 'trim', [dest, lo, z1 + 0.095], [x, hi, z1 + 0.095], 0.012, c.frame, 4);
    }
  }
}

function additions(out, level) {
  const east = d.carportEastX;
  const front = z1 - 0.08;
  const rear = -1.8;
  box(out, 'foundation', east, x0, d.foundationY, 0.17, rear, front, c.plinth);
  const roofLo = 2.68,
    roofHi = 3.29;
  quad(
    out,
    'roof',
    [
      [east - 0.14, roofLo, rear - 0.31],
      [east - 0.14, roofLo, front + 0.22],
      [x0 + 0.05, roofHi, front + 0.22],
      [x0 + 0.05, roofHi, rear - 0.31],
    ],
    [-0.19, 1, 0],
    c.iron,
  );
  for (const z of [rear, 3.2, front - 0.06]) {
    box(out, 'trim', east + 0.06, east + 0.2, 0.16, roofLo, z - 0.075, z + 0.075, c.fascia);
  }
  box(out, 'siding', east + 0.14, x0, 0.14, 2.58, front - 0.075, front + 0.02, c.paint);
  box(out, 'siding', east + 0.27, x0 - 0.12, 0.24, 2.38, front + 0.022, front + 0.046, c.door);
  if (level >= 1) {
    for (let i = 1; i <= 18; i++) {
      const y = 0.24 + (i * 2.06) / 19;
      box(out, 'trim', east + 0.27, x0 - 0.12, y, y + 0.028, front + 0.046, front + 0.055, c.frame);
    }
  }
  const tail = d.rearBlockEndZ;
  box(out, 'foundation', 1.03, x1 - 0.18, d.foundationY, 2.88, tail, z0 + 0.09, c.block);
  quad(
    out,
    'roof',
    [
      [0.89, 2.96, tail - 0.14],
      [x1 - 0.09, 2.96, tail - 0.14],
      [x1 - 0.09, 3.25, z0 + 0.13],
      [0.89, 3.25, z0 + 0.13],
    ],
    [0, 1, -0.09],
    c.iron,
  );
  const backBlock = (u, y, a) => [u, y, tail - a];
  window(out, backBlock, [0, 0, -1], 3.22, 0.79, 1.53, 2.25, level, true);
  if (level >= 2) {
    for (const y of [0.37, 0.67, 0.97, 1.27, 1.57, 1.87, 2.17, 2.47, 2.77]) {
      panel(out, 'trim', backBlock, [0, 0, -1], 1.05, x1 - 0.2, y, y + 0.016, 0.008, c.plinth);
    }
  }
}

function draw(out, level) {
  cottage(out, level);
  additions(out, level);
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);
const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [21, 10, 27];
const lookAt = [0.15, 2.05, -0.4];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe: `${slug}-model.mjs`,
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Small weatherboard-pattern cottage on low stumps, with a corrugated hipped roof, enclosed verandahs, front lattice and attached skillion carport.',
  camera,
  lookAt,
  sunDirection: [15, 18, 21],
  recipeDependencies: ['generate-motat-building.mjs'],
  embeddedCanonicalGraphs: ['metal_corrugated', 'concrete_plain'],
  mediumFiContext: {
    scale: 1,
    cameraYaw: 0.87,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'kamerunga-frontage-and-carport', position: [-13, 6.3, 21], lookAt: [0, 2.0, -0.2] },
    {
      name: 'verandah-lattice-and-window-hoods',
      position: [12, 3.6, 14],
      lookAt: [1.5, 2.28, 3.6],
    },
    {
      name: 'rear-block-extension-and-stumps',
      position: [16, 5.54, -17],
      lookAt: [0, 1.94, -3.56],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `${slug}-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.54,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.26, surfaces },
      street: { export: 'street', errorMeters: 0.1, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.03, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original modeled geometry from the Queensland State Heritage Register’s factual description, mapped building frontage and original terrain.',
};
