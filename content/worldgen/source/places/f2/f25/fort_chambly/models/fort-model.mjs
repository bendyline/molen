/** The masonry perimeter and courtyard ranges of Fort Chambly. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const {
  ring,
  court,
  towers,
  roofBands,
  foundationBottom,
  courtFloor,
  outerEave,
  courtEave,
  towerWallTop,
} = plan;
export const surfaces = {
  wall: { slot: 'wall', graph: 'stone_drywall', roughness: 0.96, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'shingle_cedar', roughness: 0.95, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_painted_shingle', roughness: 0.92, metallic: 0 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.91, metallic: 0 },
};
const colors = {
  wall: rgb('a79c85'),
  trim: rgb('cec4ad'),
  roof: rgb('8e8b7b'),
  wood: rgb('a25648'),
  dark: rgb('484b45'),
};
const plinth = rgb('8e8775'),
  masonry = rgb('a09480'),
  darkRoof = rgb('7b786c'),
  glass = rgb('52595b');
const mix = (a, b, t) => a.map((n, i) => n + (b[i] - n) * t);
const atY = ([x, z], y) => [x, y, z];
const block = (out, slot, x0, y0, z0, x1, y1, z1, color = colors[slot]) =>
  box(out, slot, [x0, y0, z0], [x1, y1, z1], color);
function face(out, slot, points, expected, color = colors[slot]) {
  let n = normalFor(...points);
  if (n.reduce((sum, v, i) => sum + v * expected[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, color);
  else out.addConvexPolygon(slot, 'palette:#ffffff', points, n, ([x, y]) => [x, y], color);
}
function winding(loop) {
  return Math.sign(
    loop.reduce((sum, [x, z], i) => {
      const [u, v] = loop[(i + 1) % loop.length];
      return sum + x * v - z * u;
    }, 0),
  );
}
function edge(a, b, sign) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = [(sign * (b[1] - a[1])) / len, 0, (sign * (a[0] - b[0])) / len];
  return {
    len,
    n,
    p: (u, y, d = 0) => {
      const [x, z] = mix(a, b, u / len);
      return [x + d * n[0], y, z + d * n[2]];
    },
  };
}
function panel(out, slot, s, u0, y0, u1, y1, d = 0, color = colors[slot]) {
  const { p, n } = s;
  face(out, slot, [p(u0, y0, d), p(u1, y0, d), p(u1, y1, d), p(u0, y1, d)], n, color);
}
function lid(out) {
  const b = new MeshBufferBuilder(),
    outer = winding(ring) > 0 ? ring : [...ring].reverse(),
    hole = winding(court) < 0 ? court : [...court].reverse();
  if (
    !b.addCap(
      'wall',
      'palette:#ffffff',
      outer,
      [hole],
      () => courtEave,
      [0, 1, 0],
      (p) => p,
      colors.wall,
    )
  )
    throw Error('The mapped courtyard could not be cut out');
  const mesh = b.finalize();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const p = Array.from(mesh.indices.slice(i, i + 3), (v) =>
      Array.from(mesh.positions.slice(v * 3, v * 3 + 3)),
    );
    face(out, 'wall', p, [0, 1, 0]);
  }
}
function arched(out, s, u, y, w, h, lod, inner = colors.dark) {
  const steps = [4, 5, 7, 10][lod];
  for (const [slot, width, base, height, d, color] of [
    ['trim', w + 0.28, y - 0.06, h + 0.22, 0.04, colors.trim],
    ['dark', w, y, h, 0.061, inner],
  ]) {
    const r = width / 2,
      spring = base + height - r,
      points = [s.p(u - r, base, d), s.p(u + r, base, d)];
    for (let i = 0; i <= steps; i++) {
      const angle = (Math.PI * i) / steps;
      points.push(s.p(u + r * Math.cos(angle), spring + r * Math.sin(angle), d));
    }
    face(out, slot, points, s.n, color);
  }
}
function opening(out, s, yTop, sideWidth, lod) {
  const gateZ = 0.3,
    start = s.p(0, 0)[2],
    end = s.p(s.len, 0)[2];
  const u = (s.len * (gateZ - start)) / (end - start);
  const r = sideWidth / 2,
    spring = 2.62,
    steps = [6, 7, 9, 12][lod];
  panel(out, 'wall', s, 0, foundationBottom, u - r, yTop);
  panel(out, 'wall', s, u + r, foundationBottom, s.len, yTop);
  const curves = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (Math.PI * i) / steps;
    curves.push([u - r * Math.cos(angle), spring + r * Math.sin(angle)]);
  }
  for (let i = 0; i < steps; i++) {
    const [u0, y0] = curves[i],
      [u1, y1] = curves[i + 1];
    face(out, 'wall', [s.p(u0, y0), s.p(u1, y1), s.p(u1, yTop), s.p(u0, yTop)], s.n);
    if (lod) {
      const angle0 = (Math.PI * i) / steps,
        angle1 = (Math.PI * (i + 1)) / steps,
        outer = r + 0.21;
      face(
        out,
        'trim',
        [
          s.p(u0, y0, 0.07),
          s.p(u1, y1, 0.07),
          s.p(u - outer * Math.cos(angle1), spring + outer * Math.sin(angle1), 0.07),
          s.p(u - outer * Math.cos(angle0), spring + outer * Math.sin(angle0), 0.07),
        ],
        s.n,
      );
    }
  }
  if (lod)
    for (const side of [-1, 1])
      panel(
        out,
        'trim',
        s,
        u + r * side + (side === -1 ? -0.21 : 0),
        courtFloor,
        u + r * side + (side === 1 ? 0.21 : 0),
        spring,
        0.071,
      );
  return curves.map(([u1, y]) => s.p(u1, y)).sort((a, b) => a[2] - b[2]);
}
function tunnel(out, a, b) {
  for (let i = 0; i < a.length - 1; i++)
    face(out, 'wall', [a[i], a[i + 1], b[i + 1], b[i]], [0, -1, 0], masonry);
  for (const i of [0, a.length - 1]) {
    const p = a[i],
      q = b[i],
      n = [0, 0, i === 0 ? 1 : -1];
    face(
      out,
      'wall',
      [atY([p[0], p[2]], courtFloor), atY([q[0], q[2]], courtFloor), q, p],
      n,
      masonry,
    );
  }
  const floor = [a[0], a.at(-1), b.at(-1), b[0]].map(([x, _, z]) => [x, courtFloor, z]);
  face(out, 'wall', floor, [0, 1, 0], plinth);
}
function walls(out, lod) {
  const outer = ring.filter((_, i) => ![11, 12, 13, 19].includes(i)),
    inner = court.slice(0, 4);
  const outerSign = winding(outer),
    innerSign = -winding(inner);
  let outside, inside;
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i],
      b = outer[(i + 1) % outer.length],
      s = edge(a, b, outerSign);
    if (a === ring[10]) {
      outside = opening(out, s, outerEave, 2.88, lod);
      continue;
    }
    panel(out, 'wall', s, 0, foundationBottom, s.len, outerEave);
    if (lod) {
      panel(out, 'wall', s, 0, foundationBottom, s.len, 0.49, 0.04, plinth);
      panel(out, 'trim', s, 0, outerEave - 0.23, s.len, outerEave, 0.055);
      const n = Math.max(1, Math.round(s.len / 5.2));
      if (s.len > 3.0)
        for (let j = 0; j < n; j++) {
          const u = (s.len * (j + 0.5)) / n;
          if (lod > 1) arched(out, s, u, 2.22, 0.44, 1.42, lod, glass);
          arched(out, s, u, 5.49, 0.54, 1.76, lod);
        }
    }
  }
  for (let i = 0; i < inner.length; i++) {
    const a = inner[i],
      b = inner[(i + 1) % inner.length],
      s = edge(a, b, innerSign);
    if (i === 3) {
      inside = opening(out, s, courtEave, 2.65, lod);
      continue;
    }
    panel(
      out,
      'wall',
      s,
      0,
      foundationBottom,
      s.len,
      courtEave,
      0,
      i === 1 ? masonry : colors.wall,
    );
    if (lod) {
      const n = i === 2 ? 4 : 6;
      for (let j = 0; j < n; j++) {
        const u = (s.len * (j + 0.5)) / n;
        arched(
          out,
          s,
          u,
          courtFloor + 0.12,
          i === 2 ? 3.74 : 1.1,
          i === 2 ? 2.67 : 2.62,
          lod,
          i === 1 ? glass : colors.dark,
        );
      }
    }
  }
  tunnel(out, outside, inside);
  lid(out);
}
function hipTower(out, polygon, lod) {
  const center = [0, 1].map((i) => polygon.reduce((sum, p) => sum + p[i], 0) / polygon.length);
  const loop = winding(polygon) < 0 ? polygon : [...polygon].reverse();
  const contour = (y, t) => loop.map((p) => atY(mix(center, p, t), y));
  loft(out, 'wall', [contour(outerEave - 0.36, 1), contour(towerWallTop, 1)], masonry);
  loft(
    out,
    'trim',
    [contour(towerWallTop - 0.24, 1.024), contour(towerWallTop + 0.16, 1.025)],
    colors.trim,
    { cap: false },
  );
  loft(
    out,
    'roof',
    [
      contour(towerWallTop + 0.16, 1.046),
      contour(towerWallTop + 1.04, 0.58),
      contour(towerWallTop + 1.25, 0.24),
    ],
    darkRoof,
  );
  if (!lod) return;
  for (let i = 0; i < loop.length; i++) {
    const s = edge(loop[i], loop[(i + 1) % loop.length], -1);
    if (lod > 1) panel(out, 'trim', s, 0, 9.07, s.len, 9.3, 0.057);
    for (const t of [0.3, 0.7]) arched(out, s, s.len * t, 9.68, 0.62, 0.97, lod, glass);
  }
}
function dormer(out, a, b, outer, t, lod) {
  const origin = mix(a, b, t),
    back = mix(origin, outer, 0.21);
  const axis = [
    (b[0] - a[0]) / Math.hypot(b[0] - a[0], b[1] - a[1]),
    (b[1] - a[1]) / Math.hypot(b[0] - a[0], b[1] - a[1]),
  ];
  const n = [origin[0] - back[0], 0, origin[1] - back[1]];
  const point = (where, u, y) => [where[0] + u * axis[0], y, where[1] + u * axis[1]];
  const front = (u, y) => point(origin, u, y),
    rear = (u, y) => point(back, u, y);
  const floor = courtEave + 0.62,
    eave = floor + 1.65,
    peak = eave + 0.64,
    w = 0.65;
  face(out, 'wood', [front(-w, floor), front(w, floor), front(w, eave), front(-w, eave)], n);
  face(out, 'wood', [front(-w, eave), front(w, eave), front(0, peak)], n);
  for (const u of [-w, w]) {
    face(
      out,
      'roof',
      [front(u * 1.1, eave), rear(u * 1.1, eave), rear(0, peak), front(0, peak)],
      [0, 1, 0],
      darkRoof,
    );
    face(
      out,
      'wood',
      [front(u, floor), rear(u, floor), rear(u, eave), front(u, eave)],
      [Math.sign(u) * axis[0], 0, Math.sign(u) * axis[1]],
    );
  }
  if (lod > 1) {
    const window = (u, y) => [front(u, y)[0] + n[0] * 0.014, y, front(u, y)[2] + n[2] * 0.014];
    face(
      out,
      'dark',
      [
        window(-0.39, floor + 0.22),
        window(0.39, floor + 0.22),
        window(0.39, eave - 0.14),
        window(-0.39, eave - 0.14),
      ],
      n,
      glass,
    );
  }
}
function roof(out, band, lod) {
  const [a, b] = band.inner,
    [c, d] = band.outer;
  const r0 = mix(a, c, 0.64),
    r1 = mix(b, d, 0.64);
  face(
    out,
    'roof',
    [atY(a, courtEave), atY(b, courtEave), atY(r1, outerEave + 0.79), atY(r0, outerEave + 0.79)],
    [0, 1, 0],
  );
  face(
    out,
    'roof',
    [atY(r0, outerEave + 0.79), atY(r1, outerEave + 0.79), atY(d, outerEave), atY(c, outerEave)],
    [0, 1, 0],
    darkRoof,
  );
  for (const [i, e, k] of [
    [a, r0, c],
    [b, r1, d],
  ]) {
    face(
      out,
      'wall',
      [atY(i, courtEave), atY(e, outerEave + 0.79), atY(k, outerEave), atY(k, courtEave)],
      [i[0] - (a[0] + b[0]) / 2, 0, i[1] - (a[1] + b[1]) / 2],
    );
  }
  if (band.kind === 'dormers') {
    for (const t of [0.19, 0.54, 0.79]) {
      const [x, z] = mix(r0, r1, t);
      const top = outerEave + 2.04;
      block(out, 'wall', x - 0.44, outerEave + 0.21, z - 0.41, x + 0.44, top, z + 0.41, masonry);
      if (lod) block(out, 'trim', x - 0.5, top - 0.09, z - 0.47, x + 0.5, top + 0.08, z + 0.47);
    }
  }
  if (lod && band.kind === 'dormers') {
    for (let i = 0; i < 7; i++) {
      const t = (i + 0.66) / 7.36,
        frontA = mix(a, c, 0.13),
        frontB = mix(b, d, 0.13);
      dormer(out, frontA, frontB, mix(c, d, t), t, lod);
    }
  }
  if (band.kind === 'chapel') {
    const [x, z] = mix(r0, r1, 0.55),
      bottom = outerEave + 0.58,
      upper = bottom + 2.03;
    block(out, 'wood', x - 0.53, bottom, z - 0.54, x + 0.53, upper, z + 0.54, rgb('726f5e'));
    const square = (y, r) => [
      [x - r, y, z - r],
      [x - r, y, z + r],
      [x + r, y, z + r],
      [x + r, y, z - r],
    ];
    loft(out, 'roof', [square(upper - 0.12, 0.66), square(upper + 0.64, 0.08)], darkRoof);
  }
}
export function buildFort(out, _frame, lod = 3) {
  walls(out, lod);
  for (const band of roofBands) roof(out, band, lod);
  for (const tower of towers) hipTower(out, tower, lod);
}
export const fortSkyline = (out, frame) => buildFort(out, frame, 0);
export const fortDistrict = (out, frame) => buildFort(out, frame, 1);
export const fortStreet = (out, frame) => buildFort(out, frame, 2);
export const fortCloseup = (out, frame) => buildFort(out, frame, 3);

const camera = [76, 45, -61],
  lookAt = [0, 4, 0];
export const fortModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe: 'fort-model.mjs',
  surfaces,
  build: buildFort,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Low cedar-shingled roofs and four projecting stone bastions enclosing Fort Chambly’s open courtyard.',
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
  embeddedCanonicalGraphs: [
    'stone_drywall',
    'stone_limestone',
    'shingle_cedar',
    'wood_painted_shingle',
  ],
  qaCameras: [
    { name: 'river-curtain-and-bastions', position: [62, 12, 26], lookAt: [17, 6, 0] },
    { name: 'open-courtyard-and-dormer-ranges', position: [15, 52, -25], lookAt: [0, 3, 0] },
    { name: 'landward-entry-and-walls', position: [-61, 10, -18], lookAt: [-17, 5, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-fort-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/f2/f25/fort_chambly/models/fort-model.mjs',
    level: 'skyline',
    export: 'fortSkyline',
    errorMeters: 0.26,
    surfaces,
    authoredLevels: {
      district: { export: 'fortDistrict', errorMeters: 0.15, surfaces },
      street: { export: 'fortStreet', errorMeters: 0.064, surfaces },
      closeup: { export: 'fortCloseup', errorMeters: 0.023, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. The three published exterior photographs by Petersent were released into the public domain. OpenStreetMap contributors supply mapped geometry under ODbL.',
};
