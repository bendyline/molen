/** Native full bridge plan; photograph-guided open cantilever/tied-arch steelwork. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import { beam, cross, loft, normalFor, normalize } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box, quad } from './structure-mesh.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/d1/d1x/bridge_of_the_americas/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const colors = {
  steel: rgb('b6c1bd'),
  cable: rgb('9caea7'),
  concrete: rgb('b6b6a6'),
  road: rgb('747c76'),
  mark: rgb('d2d0b7'),
};
const surfaces = {
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.83, metallic: 0.3 },
  cable: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.35 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  road: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
  mark: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.94, metallic: 0 },
};
const minX = Math.min(...plan.outline.map((p) => p[0])),
  maxX = Math.max(...plan.outline.map((p) => p[0]));
function section(x) {
  const zs = [];
  for (let i = 0; i < plan.outline.length; i++) {
    const a = plan.outline[i],
      b = plan.outline[(i + 1) % plan.outline.length];
    if (Math.abs(b[0] - a[0]) < 1e-8) continue;
    const t = (x - a[0]) / (b[0] - a[0]);
    if (t >= -1e-7 && t <= 1 + 1e-7) zs.push(a[1] + (b[1] - a[1]) * t);
  }
  if (zs.length < 2) {
    const p = plan.outline.reduce((a, b) => (Math.abs(a[0] - x) < Math.abs(b[0] - x) ? a : b));
    return [p[1] - 0.01, p[1] + 0.01];
  }
  const lo = Math.min(...zs),
    hi = Math.max(...zs);
  // Native abutment corners converge to a point; a one-centimetre end face avoids zero-area GLB caps.
  return hi - lo < 0.02 ? [(lo + hi) / 2 - 0.01, (lo + hi) / 2 + 0.01] : [lo, hi];
}
const center = (x) => {
  const z = section(x);
  return (z[0] + z[1]) / 2;
};
const endRatio = (x) =>
  Math.min(1, Math.max(0, (Math.abs(x) - 180) / ((x < 0 ? -minX : maxX) - 180)));
const deckY = (x) => -30 * endRatio(x) * endRatio(x);
const p = (x, y, z) => [x, y, center(x) + z];
const mainTop = (x) => 54 - 54 * (x / 172) * (x / 172),
  mainBottom = (x) => 34 - 64 * (x / 172) * (x / 172);
function Q(o, s, ps, n, color = colors[s]) {
  if (normalFor(...ps).reduce((v, a, i) => v + a * n[i], 0) < 0) ps = [...ps].reverse();
  quad(o, s, ps, n, color);
}
const B = (o, s, a, b) => box(o, s, a, b, colors[s]);
let activeDetail = 3;
function member(o, a, b, w = 0.7, depth = w, s = 'steel') {
  if (activeDetail > 1) return beam(o, s, a, b, w, depth, colors[s]);
  // Distant members keep volume with uncapped three/four-sided sections; joins hide the ends.
  const axis = normalize(b.map((v, i) => v - a[i]));
  const across = normalize(cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]));
  const other = cross(axis, across),
    n = activeDetail === 0 ? 3 : 4;
  const ring = (center) =>
    Array.from({ length: n }, (_, j) => {
      const angle = (j / n) * Math.PI * 2;
      return center.map(
        (v, i) =>
          v + (across[i] * Math.cos(angle) * w) / 2 + (other[i] * Math.sin(angle) * depth) / 2,
      );
    });
  loft(o, s, [ring(a), ring(b)], colors[s], { cap: false });
}
function deck(o, d) {
  const n = [8, 20, 48, 84][d],
    xs = [
      ...new Set([
        ...plan.outline.map((p) => p[0]),
        ...Array.from({ length: n + 1 }, (_, i) => minX + ((maxX - minX) * i) / n),
      ]),
    ]
      .sort((a, b) => a - b)
      .filter((x, i, all) => i === 0 || Math.fround(x) !== Math.fround(all[i - 1])),
    rings = [];
  for (const x of xs) {
    const [a, b] = section(x),
      y = deckY(x);
    rings.push([
      [x, y, a],
      [x, y, b],
      [x, y - 2.7, b],
      [x, y - 2.7, a],
    ]);
  }
  loft(o, 'concrete', rings, colors.concrete);
  for (let i = 1; i < xs.length; i++) {
    const x0 = xs[i - 1],
      x1 = xs[i],
      a = section(x0),
      b = section(x1),
      y0 = deckY(x0) + 0.025,
      y1 = deckY(x1) + 0.025;
    if (a[1] - a[0] > 2 && b[1] - b[0] > 2)
      Q(
        o,
        'road',
        [
          [x0, y0, a[0] + 0.9],
          [x1, y1, b[0] + 0.9],
          [x1, y1, b[1] - 0.9],
          [x0, y0, a[1] - 0.9],
        ],
        [0, 1, 0],
      );
    for (const side of [0, 1]) {
      const z0 = a[side] + (side ? -0.24 : 0.24),
        z1 = b[side] + (side ? -0.24 : 0.24);
      member(o, [x0, y0 + 1.1, z0], [x1, y1 + 1.1, z1], d === 0 ? 0.35 : 0.18, 0.24);
      if (d > 0) member(o, [x0, y0 + 0.43, z0], [x1, y1 + 0.43, z1], 0.14, 0.17);
    }
  }
  if (d > 1) {
    const step = d === 2 ? 12 : 6;
    for (let x = minX + 3; x < maxX - 3; x += step) {
      const [a, b] = section(x),
        y = deckY(x);
      for (const z of [a + 0.25, b - 0.25]) member(o, [x, y, z], [x, y + 1.1, z], 0.13, 0.15);
    }
    for (let x = minX + 4; x < maxX - 5; x += 14) {
      const ends = [x, Math.min(x + 4, maxX - 2)],
        zs = section(x),
        width = zs[1] - zs[0] - 2;
      for (const z of [-width / 4, 0, width / 4])
        Q(
          o,
          'mark',
          [
            p(ends[0], deckY(ends[0]) + 0.05, z - 0.065),
            p(ends[1], deckY(ends[1]) + 0.05, z - 0.065),
            p(ends[1], deckY(ends[1]) + 0.05, z + 0.065),
            p(ends[0], deckY(ends[0]) + 0.05, z + 0.065),
          ],
          [0, 1, 0],
        );
    }
  }
  if (d === 3)
    for (let x = minX + 40; x < maxX - 35; x += 80) {
      const [a, b] = section(x),
        y = deckY(x);
      for (const z of [a + 0.45, b - 0.45]) {
        member(o, [x, y, z], [x, y + 7, z], 0.12, 0.12);
        member(o, [x, y + 7, z], [x + 2, y + 7.4, z], 0.13, 0.13);
        B(o, 'steel', [x + 1.8, y + 7.31, z - 0.3], [x + 2.6, y + 7.52, z + 0.3]);
      }
    }
}
function mainTruss(o, d) {
  const n = [6, 16, 32, 48][d],
    xs = Array.from({ length: n + 1 }, (_, i) => -172 + (344 * i) / n),
    w = [1.8, 1.15, 0.9, 0.85][d];
  for (const side of [-1, 1]) {
    const z = side * 5.75;
    for (let i = 1; i < xs.length; i++) {
      const a = xs[i - 1],
        b = xs[i];
      member(o, p(a, mainTop(a), z), p(b, mainTop(b), z), w, w * 1.25);
      member(o, p(a, mainBottom(a), z), p(b, mainBottom(b), z), w, w * 1.2);
      member(o, p(a, mainBottom(a), z), p(b, mainTop(b), z), w * 0.52, w * 0.7);
      if (d > 1) member(o, p(a, mainTop(a), z), p(b, mainBottom(b), z), 0.36, 0.48);
    }
    for (const x of xs) member(o, p(x, mainBottom(x), z), p(x, mainTop(x), z), w * 0.55, w * 0.72);
    // Forty-six suspenders: twenty-three on each side of the central tied-arch region.
    if (d > 0)
      for (let i = 0; i < 23; i++) {
        const x = -123.5 + (i * 247) / 22,
          top = mainBottom(x);
        if (top > 0.5)
          member(
            o,
            p(x, 0.1, z),
            p(x, top, z),
            d === 1 ? 0.25 : 0.12,
            d === 1 ? 0.25 : 0.12,
            'cable',
          );
      }
  }
  if (d > 0)
    for (let i = 0; i < xs.length; i += d === 1 ? 4 : 2) {
      const x = xs[i],
        y = mainTop(x);
      member(o, p(x, y, -5.75), p(x, y, 5.75), 0.45, 0.6);
      if (d > 1 && i + 2 < xs.length) {
        const b = xs[i + 2];
        member(o, p(x, y, -5.75), p(b, mainTop(b), 5.75), 0.28, 0.35);
        member(o, p(x, y, 5.75), p(b, mainTop(b), -5.75), 0.28, 0.35);
      }
    }
}
function sideTrusses(o, d) {
  const n = [1, 4, 7, 10][d];
  for (const sign of [-1, 1])
    for (const side of [-1, 1]) {
      const z = side * 5.75,
        points = Array.from({ length: n + 1 }, (_, i) => {
          const t = i / n,
            x = sign * (172 + 153 * t);
          return { x, bottom: -30 + 25 * t, top: deckY(x) - 0.4 };
        });
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1],
          b = points[i];
        member(o, p(a.x, a.bottom, z), p(b.x, b.bottom, z), d === 0 ? 1.8 : 0.9, 1.05);
        member(o, p(a.x, a.top, z), p(b.x, b.top, z), d === 0 ? 1.4 : 0.8, 0.9);
        if (d > 0) member(o, p(a.x, a.bottom, z), p(b.x, b.top, z), 0.48, 0.6);
      }
      if (d > 0)
        for (const a of points) member(o, p(a.x, a.bottom, z), p(a.x, a.top, z), 0.55, 0.7);
    }
}
function pier(o, x, bottom, top, d, main = false) {
  const z = center(x),
    width = main ? 5.5 : 3.9,
    thick = main ? 3.4 : 1.8;
  if (d === 0 && !main) {
    B(o, 'concrete', [x - thick / 2, bottom, z - 4.3], [x + thick / 2, top, z + 4.3]);
    return;
  }
  for (const s of [-1, 1]) {
    const a = [x - thick / 2, bottom, z + s * width - 1.25],
      b = [x + thick / 2, top, z + s * width + 1.25];
    B(o, 'concrete', a, b);
  }
  B(
    o,
    'concrete',
    [x - thick / 2, top - 2.4, z - width - 1.4],
    [x + thick / 2, top, z + width + 1.4],
  );
  if (main) {
    B(o, 'concrete', [x - 5, bottom - 2, z - 9], [x + 5, bottom + 0.4, z + 9]);
    if (d > 0)
      B(
        o,
        'concrete',
        [x - 2.2, top - 15, z - width - 1.2],
        [x + 2.2, top - 12.5, z + width + 1.2],
      );
  }
}
function supports(o, d) {
  for (const s of [-1, 1]) {
    pier(o, s * 172, -65, -30, d, true);
    pier(o, s * 325, -61, deckY(s * 325) - 2.7, d);
  }
  // Eleven bounded approach spans are distributed between the cantilever supports and native abutments.
  for (const [a, b, n] of [
    [minX, -325, 4],
    [325, maxX, 7],
  ])
    for (let i = 1; i < n; i++) {
      const x = a + ((b - a) * i) / n,
        t = endRatio(x),
        top = deckY(x) - 2.7,
        bottom = top - (52 * (1 - t) + 6);
      pier(o, x, bottom, top, d);
    }
  for (const x of [minX + 2, maxX - 2]) {
    const z = center(x),
      y = deckY(x);
    B(o, 'concrete', [x - 2, y - 7, z - 8], [x + 2, y - 2.5, z + 8]);
  }
}
function build(o, _f, d = 3) {
  activeDetail = d;
  deck(o, d);
  mainTruss(o, d);
  sideTrusses(o, d);
  supports(o, d);
}
export const americasSkyline = (o, f) => build(o, f, 0);
export const americasDistrict = (o, f) => build(o, f, 1);
export const americasStreet = (o, f) => build(o, f, 2);
export const bridgeOfTheAmericasModel = {
  id: 'bridge_of_the_americas',
  key: 'bridge_of_the_americas',
  recipe: 'structure-bridge-of-the-americas.mjs',
  cell: 'd1/d1x',
  title: 'Bridge of the Americas',
  category: 'bridge',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete native bridge deck/abutments on their original asymmetric1677.7mplan, pale paired curved cantilever/tied-arch trusses over the actual PanamaCanalcrossing,344mmainspan with46slender hangers, physical vertical/diagonal/top cross-bracing, open H-shaped concrete main piers, side arms and graded approach spans. Fourlane roadway, continuous/open rails and restrained lights. Canal/ships/new fourthbridge and landscape excluded.',
  camera: [640, 310, 1080],
  lookAt: [80, -4, 0],
  portableGroundY: -67,
  mediumFiContext: { scale: 18, groundY: -67 },
  qaCameras: [
    { name: 'paired-curved-chords-and-hangers', position: [90, 63, 285], lookAt: [0, 15, 0] },
    {
      name: 'open-main-pier-and-cantilever-arm',
      position: [-255, -7, 160],
      lookAt: [-172, -17, 0],
    },
    { name: 'deck-rails-and-overhead-bracing', position: [45, 12, 32], lookAt: [0, 28, 0] },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Fixed original bridge/channel crossing defines approximate water-relative attachment before elevation sampling.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-bridge-of-the-americas.mjs',
    level: 'skyline',
    export: 'americasSkyline',
    errorMeters: 3,
    surfaces,
    authoredLevels: {
      district: { export: 'americasDistrict', errorMeters: 0.8, surfaces },
      street: { export: 'americasStreet', errorMeters: 0.2, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Complete original mapped abutment plan is retained, about1677.7mprojected length. Published1654/1669mfigures use differing end scopes; the native envelope is not rescaled. Its suspension tag is not adopted as engineering design. The separately mapped186mnewbridgepiers belong to another crossing and are excluded.',
    'Main344mspan and46hangers have primary rehabilitation-engineer text support. Photographs control the open curved lattice/cantilever silhouette, Hpiers and roadway. Main pier placement at±172mabout the original channel crossing,54mupper/34mlower crown above deck, steel sections, side arms±325m, approach support spacing and camber/grade remain medium-fi estimates, not a survey or complete structural analysis.',
    'Exact already-cleared/published QuallaPD-selfoverview and two official USNavystaff1984/2011originals used. Their explicit primary Navy/DoDrelease categories and exact native hashes are preserved. No new image was downloaded. Pale steel/concrete/road colors, small fittings, rail and lights are authored approximations; no photographic texture, ships, people, gun, fireworks or landscape adopted.',
    'Fixed original native bridge/PanamaCanalcenterline crossing establishes approximate waterY-64 and deckY0 before terrain acquisition.2.7mslab plus61.3mhigh-waterclearance are controls; tides, pier bases, seabed, road gradient and host-terrain approach contact remain unverified. No water/mountain/port platform or terrain flattening is part of the model.',
    'Curved chord sampling, cross-bracing and suspenders simplify with distance. Skyline keeps both open arch profiles/side arms and concrete support rhythm, with merged approach piers. Fine rail posts, fourlane markings and sparse lamps appear only near. Hidden gussets, rivets, access ladders and actual maintenance gear are omitted.',
  ],
};
