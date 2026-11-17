/** The main Grand Egyptian Museum building in Giza. */
import fs from 'node:fs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const { outline, courtyards } = read('map-frame').geometry;
const d = plan.dimensions;
const palette = 'palette:#ffffff';
const c = Object.fromEntries(
  Object.entries({
    light: 'ded8c8',
    white: 'd9d4c8',
    warm: 'cec4b0',
    shadow: 'aba092',
    terrace: 'b6aa95',
    stone: 'c3b49c',
    base: 'b0a28e',
    dark: '706d65',
    recess: '80796c',
    glass: '78817a',
    glassLighter: '92968a',
    frame: 'b8b4a5',
    roof1: 'd3cbbb',
    roof2: 'e0dacf',
    roof3: 'cdc7b9',
    roof4: 'dad2c2',
    roof5: 'd8d3c7',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.95 },
  masonry: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.91 },
  roof: { slot: 'roof', localRef: palette, roughness: 0.92 },
  trim: { slot: 'trim', localRef: palette, roughness: 0.85 },
  opening: { slot: 'window', localRef: palette, roughness: 0.64 },
};
const at = ([x, z], y) => [x, y, z];
const mix = (a, b, t) => a + (b - a) * t;
const mix2 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t)];
const stripe = ([x, z]) => x - 0.34 * z;
const start = -178;
const width = 65;
const count = d.galleryBands;
const creases = Array.from({ length: 2 * count + 1 }, (_, i) => start + (i * width) / 2);
const tints = [c.roof1, c.roof2, c.roof3, c.roof4, c.roof5];
const roofY = ([x, z]) => {
  const index = (stripe([x, z]) - start) / width;
  const relative = index - Math.floor(index);
  const fold = 1 - Math.abs(2 * relative - 1);
  return Math.min(d.roofPeakY, 26.1 + 0.04 * z - 0.017 * x + fold * 4.4);
};
const normal = (a, b, p) => {
  const [x, y, z] = b.map((v, i) => v - a[i]);
  const [u, v, w] = p.map((value, i) => value - a[i]);
  return [y * w - z * v, z * u - x * w, x * v - y * u];
};
const upperNormal = (a, b, p) => {
  const n = normal(a, b, p);
  return n[1] < 0 ? n.map((value) => -value) : n;
};

function boundaryCuts(a, b) {
  const u = stripe(a),
    v = stripe(b);
  const internal = creases
    .map((edge) => (edge - u) / (v - u))
    .filter((t) => t > 0.0001 && t < 0.9999)
    .sort((a, b) => a - b);
  return [0, ...internal, 1].map((t) => mix2(a, b, t));
}

function clipped(points, edge, direction) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const v = direction * (stripe(a) - edge);
    const w = direction * (stripe(b) - edge);
    if (v >= 0) out.push(a);
    if ((v > 0.00001 && w < -0.00001) || (w > 0.00001 && v < -0.00001))
      out.push(mix2(a, b, v / (v - w)));
  }
  return out;
}

function roof(out, level) {
  let n = outline.length;
  const holes = courtyards.map((ring) => {
    const i = n;
    n += ring.length;
    return i;
  });
  const points = [...outline, ...courtyards.flat()];
  const triangles = earcut(points.flat(), holes);
  for (let i = 0; i < triangles.length; i += 3) {
    const triangle = triangles.slice(i, i + 3).map((j) => points[j]);
    for (let strip = 0; strip < creases.length - 1; strip++) {
      const poly = clipped(clipped(triangle, creases[strip], 1), creases[strip + 1], -1);
      if (poly.length < 3) continue;
      for (let k = 1; k < poly.length - 1; k++) {
        const xy = [poly[0], poly[k], poly[k + 1]];
        const [a, b, p] = xy.map((point) => at(point, roofY(point)));
        const direction = upperNormal(a, b, p);
        if (direction[1] < 0.0001) continue;
        const tint = tints[Math.floor(strip / 2)];
        out.addTriangle('roof', palette, [a, b, p], direction, xy, tint);
      }
    }
  }
  if (level < 2) return;
  const panelSpacing = level === 2 ? 17.5 : 10.7;
  for (let i = 0; i < triangles.length; i += 3) {
    const tri = triangles.slice(i, i + 3).map((index) => points[index]);
    const min = Math.min(...tri.map(stripe)),
      max = Math.max(...tri.map(stripe));
    for (
      let cross = Math.ceil(min / panelSpacing) * panelSpacing;
      cross < max;
      cross += panelSpacing
    ) {
      const sliced = clipped(clipped(tri, cross, 1), cross + 0.095, -1);
      for (let k = 1; k < sliced.length - 1; k++) {
        const uv = [sliced[0], sliced[k], sliced[k + 1]];
        const [a, b, p] = uv.map((point) => at(point, roofY(point) + 0.055));
        const direction = upperNormal(a, b, p);
        if (direction[1] < 0.0001) continue;
        out.addTriangle('trim', palette, [a, b, p], direction, uv, c.warm);
      }
    }
  }
}

function faces(ring, inner = false) {
  const area = ring.reduce((sum, [x, z], i) => {
    const [nx, nz] = ring[(i + 1) % ring.length];
    return sum + x * nz - nx * z;
  }, 0);
  const orientation = Math.sign(area) * (inner ? -1 : 1);
  return ring.map((a, i) => {
    const b = ring[(i + 1) % ring.length];
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    return { len, a, b, normal: [(orientation * dz) / len, 0, (-orientation * dx) / len] };
  });
}

function wallQuad(out, slot, a, b, lowA, lowB, topA, topB, n, tint) {
  quad(out, slot, [at(a, lowA), at(b, lowB), at(b, topB), at(a, topA)], n, tint);
}
const offset = ([x, z], [dx, , dz], distance) => [x + dx * distance, z + dz * distance];

function screen(out, face, a, b, base, headA, headB, level) {
  const n = face.normal;
  const depth = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const span = Math.max(1, Math.round(depth / (level >= 3 ? 4.6 : level >= 2 ? 7.8 : 14.5)));
  const rows = level >= 3 ? 6 : level >= 2 ? 4 : 2;
  wallQuad(out, 'opening', a, b, base, base, headA, headB, n, c.glass);
  for (let i = 0; i < span; i++) {
    const from = i / span,
      to = (i + 1) / span;
    const x = offset(mix2(a, b, from), n, 0.055);
    const z = offset(mix2(a, b, to), n, 0.055);
    const h0 = mix(headA, headB, from);
    const h1 = mix(headA, headB, to);
    for (let row = 0; row < rows; row++) {
      const low0 = mix(base, h0, row / rows),
        low1 = mix(base, h1, row / rows);
      const high0 = mix(base, h0, (row + 1) / rows),
        high1 = mix(base, h1, (row + 1) / rows);
      const tri =
        (i + row) % 2 === 0
          ? [at(x, low0), at(z, low1), at(x, high0)]
          : [at(z, low1), at(z, high1), at(x, high0)];
      out.addTriangle(
        'trim',
        palette,
        tri,
        n,
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        (i + row) % 4 === 0 ? c.glassLighter : c.warm,
      );
      if (level >= 2) {
        const width = Math.min(0.031, 0.22 / depth);
        const jamb = offset(mix2(a, b, Math.min(1, from + width)), n, 0.082);
        wallQuad(out, 'trim', x, jamb, low0, low0, high0, high0, n, c.frame);
      }
    }
  }
}

function envelope(out, level) {
  for (const [i, face] of faces(outline).entries()) {
    const { normal: n } = face;
    const cuts = boundaryCuts(face.a, face.b);
    const entry = i >= 44 && i <= 51;
    const glazed = i >= 39 && i <= 55;
    for (let j = 0; j < cuts.length - 1; j++) {
      const a = cuts[j],
        b = cuts[j + 1];
      const highA = roofY(a),
        highB = roofY(b);
      if (entry) {
        const fascia = d.entranceClearanceY;
        const deep = level === 0 ? 13.5 : 16.0;
        const backA = [a[0] - deep, a[1] + 4.5],
          backB = [b[0] - deep, b[1] + 4.5];
        const stepY = d.entryY;
        wallQuad(out, 'concrete', a, b, d.foundationY, d.foundationY, stepY, stepY, n, c.base);
        wallQuad(out, 'concrete', a, b, fascia, fascia, highA, highB, n, c.light);
        const lower = [at(a, fascia), at(b, fascia), at(backB, fascia), at(backA, fascia)];
        quad(out, 'concrete', lower, [0, -1, 0], c.white);
        quad(
          out,
          'masonry',
          [at(a, stepY), at(b, stepY), at(backB, stepY), at(backA, stepY)],
          [0, 1, 0],
          c.terrace,
        );
        const portals = [45, 75];
        const cuts = portals
          .map((z) => (z - backA[1]) / (backB[1] - backA[1]))
          .filter((t) => t > 0.0001 && t < 0.9999)
          .sort((a, b) => a - b);
        const points = [0, ...cuts, 1].map((t) => mix2(backA, backB, t));
        for (let k = 0; k < points.length - 1; k++) {
          const p = points[k];
          const q = points[k + 1];
          const center = (p[1] + q[1]) / 2;
          if (center > portals[0] && center < portals[1]) {
            wallQuad(out, 'concrete', p, q, 12.5, 12.5, fascia, fascia, n, c.warm);
          } else if (level === 0) {
            wallQuad(out, 'opening', p, q, stepY + 1, stepY + 1, fascia, fascia, n, c.dark);
          } else {
            screen(out, face, p, q, stepY + 1, fascia, fascia, level);
          }
        }
      } else if (glazed) {
        const split = Math.min(highA, highB) - 2.0;
        wallQuad(
          out,
          'masonry',
          a,
          b,
          d.foundationY,
          d.foundationY,
          split - 10.1,
          split - 10.1,
          n,
          c.stone,
        );
        if (level === 0)
          wallQuad(out, 'opening', a, b, split - 10.1, split - 10.1, split, split, n, c.glass);
        else screen(out, face, a, b, split - 10.1, split, split, level);
        wallQuad(out, 'concrete', a, b, split, split, highA, highB, n, c.light);
      } else {
        const tint = i % 9 === 0 ? c.warm : c.stone;
        wallQuad(out, 'masonry', a, b, d.foundationY, d.foundationY, highA, highB, n, tint);
        if (level >= 1) {
          const low = roofY(mix2(a, b, 0.5)) - 6.8;
          const first = offset(a, n, 0.04),
            last = offset(b, n, 0.04);
          wallQuad(out, 'trim', first, last, low, low, low + 0.21, low + 0.21, n, c.terrace);
        }
      }
    }
  }
  for (const ring of courtyards) {
    const courtyardFloor = 9.55;
    for (const face of faces(ring, true)) {
      const cuts = boundaryCuts(face.a, face.b);
      for (let i = 0; i < cuts.length - 1; i++) {
        const a = cuts[i],
          b = cuts[i + 1];
        wallQuad(
          out,
          'concrete',
          a,
          b,
          courtyardFloor,
          courtyardFloor,
          roofY(a),
          roofY(b),
          face.normal,
          c.shadow,
        );
        if (level >= 2) {
          const lo = courtyardFloor + 4.8;
          const p = offset(mix2(a, b, 0.13), face.normal, 0.064),
            q = offset(mix2(a, b, 0.87), face.normal, 0.064);
          wallQuad(out, 'opening', p, q, lo, lo, lo + 3.2, lo + 3.2, face.normal, c.glass);
        }
      }
    }
    quad(
      out,
      'masonry',
      ring.map((p) => at(p, courtyardFloor)),
      [0, 1, 0],
      c.base,
    );
  }
}

function stair(out, level) {
  const steps = [5, 14, 30, 54][level];
  const run = 90;
  const start = [60, 52];
  const half = 11.1;
  const yLow = d.entryY + 0.06;
  const rise = 16.9 - yLow;
  for (let i = 0; i < steps; i++) {
    const near = i / steps,
      far = (i + 1) / steps;
    const z0 = start[1] + near * 15,
      z1 = start[1] + far * 15;
    const x0 = start[0] - run * near,
      x1 = start[0] - run * far;
    const y = yLow + rise * near;
    const up = yLow + rise * far;
    const a = [x0, y, z0 - half],
      b = [x0, y, z0 + half],
      p = [x1, y, z1 + half],
      q = [x1, y, z1 - half];
    quad(out, 'masonry', [a, b, p, q], [0, 1, 0], i % 4 === 0 ? c.white : c.terrace);
    quad(out, 'masonry', [q, p, [p[0], up, p[2]], [q[0], up, q[2]]], [1, 0, 0], c.recess);
  }
}

function entrancePiers(out, level) {
  for (const [x, z] of [
    [53, 30],
    [70, 74],
  ]) {
    const foot = [
      [x - 2.4, z - 1.5],
      [x + 1.3, z - 1.5],
      [x + 1.3, z + 1.4],
      [x - 2.4, z + 1.4],
    ];
    const head = [
      [x - 9.5, z - 4.4],
      [x + 6.7, z - 4.4],
      [x + 6.7, z + 4.4],
      [x - 9.5, z + 4.4],
    ];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const a = at(foot[i], d.entryY),
        b = at(foot[j], d.entryY),
        p = at(head[j], 26.65),
        q = at(head[i], 26.65);
      const line = normal(a, b, q);
      quad(
        out,
        'concrete',
        [a, b, p, q],
        line.map((v) => -v),
        i % 2 === 0 ? c.white : c.warm,
      );
    }
    if (level >= 1) {
      const a = [x - 5.8, 0.66, z - 3.65],
        b = [x + 4.7, 0.66, z - 3.65],
        p = [x + 4.7, 0.66, z + 3.65],
        q = [x - 5.8, 0.66, z + 3.65];
      quad(out, 'masonry', [a, b, p, q], [0, 1, 0], c.stone);
    }
  }
}

function draw(out, level) {
  roof(out, level);
  envelope(out, level);
  stair(out, level);
  entrancePiers(out, level);
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [683, 290, 615];
const lookAt = [-30, 21, 0];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe: `${slug}-model.mjs`,
  surfaces,
  build: closeup,
  wikidataId: plan.wikidataId,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Grand Egyptian Museum main building set into the plateau, with a broad folded concrete roof and shaded triangular-glazed entrance.',
  camera,
  lookAt,
  sunDirection: [245, 220, 104],
  recipeDependencies: ['generate-motat-building.mjs', 'polygon-triangulation.mjs'],
  embeddedCanonicalGraphs: ['concrete_plain', 'stone_limestone_raw'],
  mediumFiContext: {
    scale: 1,
    cameraYaw: 0.83,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'folded-museum-and-plateau', position: [465, 264, 424], lookAt: [-32, 18, 4] },
    { name: 'cairo-side-glazed-entry', position: [223, 22, 57], lookAt: [50, 13, 38] },
    { name: 'gallery-roof-and-open-court', position: [-145, 273, -189], lookAt: [-56, 20, 26] },
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
    errorMeters: 4.8,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 2.2, surfaces },
      street: { export: 'street', errorMeters: 0.85, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.28, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original modeled geometry from native building and court rings, original topography, and written architect and contractor facts.',
};
