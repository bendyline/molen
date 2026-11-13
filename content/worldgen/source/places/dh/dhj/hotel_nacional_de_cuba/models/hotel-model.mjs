/** Hotel Nacional de Cuba, including the mapped wings and twin Havana towers. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  cleanRing,
  poly,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const {
  outline,
  entry,
  lowWing,
  pedestals,
  towers,
  turrets,
  foundationBottom,
  wallTop,
  entranceTop,
  lowWingTop,
} = plan;
export const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.95, metallic: 0 },
  deck: { slot: 'roof', graph: 'membrane', roughness: 0.95, metallic: 0 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.87, metallic: 0 },
};
const colors = {
  wall: rgb('e3d6b5'),
  trim: rgb('d0c19b'),
  roof: rgb('a67661'),
  deck: rgb('aa9d80'),
  dark: rgb('5a5b4c'),
};
const warm = rgb('d8c9a5'),
  cream = rgb('ebe1c6'),
  glass = rgb('5d625a'),
  darker = rgb('a99d7e');
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
function winding(loop) {
  return Math.sign(
    loop.reduce((sum, [x, z], i) => {
      const [u, v] = loop[(i + 1) % loop.length];
      return sum + x * v - z * u;
    }, 0),
  );
}
function edge(a, b, sign) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    n = [(sign * dz) / len, 0, (-sign * dx) / len];
  return {
    len,
    n,
    p: (u, y, d = 0) => [a[0] + (dx * u) / len + n[0] * d, y, a[1] + (dz * u) / len + n[2] * d],
  };
}
function panel(out, k, s, u0, y0, u1, y1, d = 0, color = colors[k]) {
  face(out, k, [s.p(u0, y0, d), s.p(u1, y0, d), s.p(u1, y1, d), s.p(u0, y1, d)], s.n, color);
}
const center = (ring) => [0, 1].map((i) => ring.reduce((sum, p) => sum + p[i], 0) / ring.length);
const resize = (ring, ratio) => {
  const [cx, cz] = center(ring);
  return ring.map(([x, z]) => [cx + (x - cx) * ratio, cz + (z - cz) * ratio]);
};
function window(out, s, u, y, w, h, lod) {
  if (lod > 1)
    panel(out, 'trim', s, u - w / 2 - 0.12, y - 0.12, u + w / 2 + 0.12, y + h + 0.1, 0.048, warm);
  panel(out, 'dark', s, u - w / 2, y, u + w / 2, y + h, 0.068, glass);
  if (lod === 3) {
    panel(out, 'trim', s, u - 0.028, y, u + 0.028, y + h, 0.084, darker);
    panel(
      out,
      'trim',
      s,
      u - w / 2,
      y + h * 0.62 - 0.027,
      u + w / 2,
      y + h * 0.62 + 0.027,
      0.085,
      darker,
    );
  }
}
function archPanel(out, s, u, y, w, h, lod) {
  const r = w / 2,
    spring = y + h - r,
    n = lod > 1 ? 9 : 6;
  for (const [k, radius, d, base, color] of [
    ['trim', r + 0.17, 0.055, y - 0.12, warm],
    ['dark', r, 0.078, y, colors.dark],
  ]) {
    const p = [s.p(u - radius, base, d), s.p(u + radius, base, d)];
    for (let i = 0; i <= n; i++) {
      const a = (Math.PI * i) / n;
      p.push(s.p(u + radius * Math.cos(a), spring + radius * Math.sin(a), d));
    }
    face(out, k, p, s.n, color);
  }
}
function mainRanges(out, lod) {
  if (lod) shell(out, 'trim', outline, foundationBottom, 2.28, warm);
  shell(out, 'wall', outline, lod ? 2.28 : foundationBottom, wallTop);
  if (!lod) return;
  shell(out, 'trim', resize(outline, 1.007), wallTop - 0.42, wallTop + 0.13);
  shell(out, 'deck', resize(outline, 0.994), wallTop + 0.125, wallTop + 0.19);
  const sign = winding(outline);
  for (let i = 0; i < outline.length; i++) {
    const s = edge(outline[i], outline[(i + 1) % outline.length], sign);
    if (s.len < 3.2) continue;
    panel(out, 'trim', s, 0, 2.86, s.len, 3.13, 0.05, warm);
    const n = Math.max(1, Math.round(s.len / 3.18)),
      spacing = s.len / n;
    for (let j = 0; j < n; j++) {
      const u = spacing * (j + 0.5);
      for (let f = 0; f < 7; f++) {
        const y = 5.33 + 3.25 * f;
        window(out, s, u, y, f === 6 ? 1.14 : 1.32, f === 6 ? 1.78 : 2.04, lod);
      }
      if (lod > 1 && spacing > 2.62 && j % 2 === 0) {
        panel(out, 'trim', s, u - 0.48, wallTop + 0.02, u + 0.48, wallTop + 0.44, 0.033, cream);
      }
    }
  }
}
function lowRanges(out, lod) {
  for (const [ring, top] of [
    [entry, entranceTop],
    [lowWing, lowWingTop],
  ]) {
    shell(out, 'wall', ring, foundationBottom, top, cream);
    if (!lod) continue;
    shell(out, 'trim', resize(ring, 1.013), top - 0.36, top + 0.1);
    shell(out, 'deck', resize(ring, 0.996), top + 0.09, top + 0.19);
    const sign = winding(ring);
    for (let i = 0; i < ring.length; i++) {
      const s = edge(ring[i], ring[(i + 1) % ring.length], sign);
      if (s.len < 3.6) continue;
      const bays = Math.max(1, Math.round(s.len / 4.1));
      for (let j = 0; j < bays; j++) {
        const u = (s.len * (j + 0.5)) / bays;
        archPanel(out, s, u, 1.05, ring === entry ? 2.35 : 1.88, 3.55, lod);
        if (ring === lowWing && lod > 1) window(out, s, u, 5.47, 1.27, 1.77, lod);
      }
    }
  }
  const front = entry[1][1],
    lo = Math.min(entry[1][0], entry[2][0]),
    hi = Math.max(entry[1][0], entry[2][0]);
  const stairCount = lod > 1 ? 5 : 3;
  for (let i = 0; i < stairCount; i++) {
    const a = front + 0.08 + (1.88 * i) / stairCount,
      b = front + 0.08 + (1.88 * (i + 1)) / stairCount;
    block(
      out,
      'trim',
      lo + 0.4,
      foundationBottom,
      a,
      hi - 0.4,
      1.09 - (0.82 * i) / stairCount,
      b,
      warm,
    );
  }
}
function towerArch(out, s, low, spring, top, halfWidth, lod) {
  const u = s.len / 2,
    steps = lod === 3 ? 11 : lod ? 7 : 4;
  const curve = Array.from({ length: steps + 1 }, (_, i) => {
    const t = (Math.PI * i) / steps;
    return [u - halfWidth * Math.cos(t), spring + halfWidth * Math.sin(t)];
  });
  panel(out, 'wall', s, 0, low, u - halfWidth, top, 0, cream);
  panel(out, 'wall', s, u + halfWidth, low, s.len, top, 0, cream);
  for (let i = 0; i < steps; i++) {
    const [a, b] = curve[i],
      [c, d] = curve[i + 1];
    face(out, 'wall', [s.p(a, b), s.p(c, d), s.p(c, top), s.p(a, top)], s.n, cream);
    if (lod) {
      const at = (j) =>
        s.p(
          u - (halfWidth + 0.17) * Math.cos((Math.PI * j) / steps),
          spring + (halfWidth + 0.17) * Math.sin((Math.PI * j) / steps),
          0.035,
        );
      face(out, 'trim', [s.p(a, b, 0.035), s.p(c, d, 0.035), at(i + 1), at(i)], s.n);
      const n = s.p(u, spring - 0.7).map((v, j) => v - (s.p(a, b)[j] + s.p(c, d)[j]) / 2);
      face(out, 'trim', [s.p(a, b), s.p(c, d), s.p(c, d, -0.23), s.p(a, b, -0.23)], n, warm);
    }
  }
}
function tower(out, ring, platform, lod) {
  const body = resize(cleanRing(ring), 0.994),
    sign = winding(body);
  const terrace = 32.7,
    openY = 34.2,
    spring = 37.21,
    top = 40.21;
  shell(out, 'wall', platform, wallTop - 0.06, terrace, cream);
  shell(out, 'trim', resize(platform, 1.032), terrace - 0.22, terrace + 0.18);
  shell(out, 'trim', body, terrace, openY, warm);
  for (let i = 0; i < body.length; i++) {
    const a = body[i],
      b = body[(i + 1) % body.length],
      s = edge(a, b, sign);
    if (s.len < 3.6) {
      panel(out, 'wall', s, 0, openY, s.len, top, 0, cream);
      continue;
    }
    towerArch(out, s, openY, spring, top, Math.min(1.62, s.len * 0.32), lod);
    if (lod) panel(out, 'trim', s, 0, openY - 0.04, s.len, openY + 0.14, 0.068, warm);
  }
  shell(out, 'trim', resize(body, 1.094), top - 0.23, top + 0.21);
  const loop = winding(body) < 0 ? body : [...body].reverse(),
    [cx, cz] = center(body);
  const profile = (y, scale) =>
    loop.map(([x, z]) => [cx + (x - cx) * scale, y, cz + (z - cz) * scale]);
  loft(out, 'roof', [profile(top + 0.18, 1.14), profile(top + 1.34, 0.17)], colors.roof);
  block(out, 'trim', cx - 0.067, top + 1.32, cz - 0.067, cx + 0.067, top + 1.88, cz + 0.067);
}
function turret(out, ring, lod) {
  const [x, z] = center(ring);
  const r = ring.reduce((sum, [u, v]) => sum + Math.hypot(u - x, v - z), 0) / ring.length;
  const n = lod > 1 ? 9 : 6,
    base = 31.63;
  const rings = (steps) => steps.map(([y, k]) => radialRing(y, r * k, r * k, n, [x, z]));
  loft(
    out,
    'wall',
    rings([
      [base, 1],
      [34.12, 1],
    ]),
    cream,
  );
  loft(
    out,
    'roof',
    rings([
      [34.11, 1.1],
      [34.53, 0.89],
      [35.2, 0.16],
    ]),
    colors.roof,
  );
  if (lod > 1) {
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const n = [Math.cos(a), 0, Math.sin(a)],
        p = (u, y) => [x + n[0] * (r + 0.018) - n[2] * u, y, z + n[2] * (r + 0.018) + n[0] * u];
      face(out, 'dark', [p(-0.21, 32.6), p(0.21, 32.6), p(0.21, 33.61), p(-0.21, 33.61)], n);
    }
  }
}
export function buildHotel(out, _frame, lod = 3) {
  mainRanges(out, lod);
  lowRanges(out, lod);
  for (const [i, ring] of towers.entries()) tower(out, ring, pedestals[i], lod);
  for (const ring of turrets) turret(out, ring, lod);
}
export const hotelSkyline = (out, frame) => buildHotel(out, frame, 0);
export const hotelDistrict = (out, frame) => buildHotel(out, frame, 1);
export const hotelStreet = (out, frame) => buildHotel(out, frame, 2);
export const hotelCloseup = (out, frame) => buildHotel(out, frame, 3);
const camera = [126, 61, 143],
  lookAt = [-1, 18, 0];
export const hotelModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe: 'hotel-model.mjs',
  surfaces,
  build: buildHotel,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Hotel Nacional de Cuba, with cream hotel wings, open tower crowns and red-roofed corner turrets.',
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
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_limestone', 'tile_ceramic', 'membrane'],
  qaCameras: [
    { name: 'landward-entrance-and-twin-towers', position: [17, 22, 119], lookAt: [2, 17, 2] },
    { name: 'seaward-wing-and-corner-turrets', position: [91, 49, -81], lookAt: [18, 23, -2] },
    { name: 'tower-crowns-and-courtyard', position: [76, 76, 86], lookAt: [1, 29, 1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-havana-hotel-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/dh/dhj/hotel_nacional_de_cuba/models/hotel-model.mjs',
    level: 'skyline',
    export: 'hotelSkyline',
    errorMeters: 0.31,
    surfaces,
    authoredLevels: {
      district: { export: 'hotelDistrict', errorMeters: 0.18, surfaces },
      street: { export: 'hotelStreet', errorMeters: 0.071, surfaces },
      closeup: { export: 'hotelCloseup', errorMeters: 0.026, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. Exterior photographs by Jongleur100 and Entropy1963 are public domain. OpenStreetMap contributors supply mapped geometry under ODbL.',
};
