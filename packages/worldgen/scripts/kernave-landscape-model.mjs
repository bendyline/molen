/** Kernavė: five surviving hillfort earthworks and the separate modern craft-yard reconstruction.
 * OSM fixes horizontal positions; the interpreted terrain is explicitly awaiting survey fit.
 */
import { readFileSync } from 'node:fs';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';

const map = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u9/u9c/n0251_kernave/map-parts.json',
      import.meta.url,
    ),
  ),
);
const grass = [0.23, 0.37, 0.11],
  timber = [0.63, 0.56, 0.43],
  roof = [0.58, 0.55, 0.47],
  trail = [0.72, 0.66, 0.52];
const fine = (o) => !['skyline', 'district', 'street'].includes(o.detail),
  near = (o) => !['skyline', 'district'].includes(o.detail),
  master = (o) => !o.detail;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  tint = (c, t) => c.map((v) => v * t);
const clamp = (t) => Math.max(0, Math.min(1, t)),
  smooth = (t) => {
    t = clamp(t);
    return t * t * (3 - 2 * t);
  };
const face = (o, s, p, c) => quad(o, s, p, normalFor(...p), c);
function triangle(o, s, p, c) {
  if (normalFor(...p)[1] < 0) p.reverse();
  o.addTriangle(
    s,
    'palette:#ffffff',
    p,
    normalFor(...p),
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    c,
  );
}
function frame(o, x, y, z, a) {
  const c = Math.cos(a),
    s = Math.sin(a),
    rot = ([x, y, z]) => [x * c - z * s, y, x * s + z * c];
  return {
    detail: o.detail,
    ...Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
        k,
        (slot, ref, p, n, uv, col) =>
          o[k](
            slot,
            ref,
            p.map((v) => {
              const q = rot(v);
              return [q[0] + x, q[1] + y, q[2] + z];
            }),
            rot(n),
            uv,
            col,
          ),
      ]),
    ),
  };
}
// Width/length and surviving bank heights follow Vengalis & Velius (2019).
// Rounded, asymmetric contours are authored interpretations, not a sampled LiDAR surface.
const hills = [
  { i: 0, w: 70, d: 30, a: -0.18, h: 18, run: 33, bank: 0 },
  { i: 1, w: 24, d: 60, a: -0.18, h: 22, run: 31, bank: 5 },
  { i: 2, w: 183, d: 102, a: 0.7, h: 30, run: 43, bank: 4 },
  { i: 3, w: 12, d: 26, a: -0.28, h: 27, run: 32, bank: 4 },
  { i: 4, w: 12, d: 10, a: 0.74, h: 31, run: 38, bank: 1 },
].map((h) => ({ ...h, center: map.components[h.i].center }));
function hillY(h, x, z) {
  const dx = x - h.center[0],
    dz = z - h.center[1],
    c = Math.cos(h.a),
    s = Math.sin(h.a),
    u = dx * c + dz * s,
    v = -dx * s + dz * c;
  // Unequal crown corners retain the surviving asymmetric platforms and spurs.
  const shapes = [
    [
      [-0.5, -0.3],
      [0.4, -0.5],
      [0.5, -0.28],
      [0.47, 0.34],
      [-0.4, 0.5],
      [-0.5, 0.2],
    ],
    [
      [-0.48, -0.4],
      [0.4, -0.5],
      [0.5, -0.3],
      [0.25, 0.4],
      [-0.18, 0.5],
      [-0.3, 0.25],
    ],
    [
      [-0.5, -0.1],
      [-0.4, -0.39],
      [-0.15, -0.5],
      [0.25, -0.42],
      [0.48, -0.16],
      [0.5, 0.15],
      [0.28, 0.36],
      [0.14, 0.55],
      [-0.15, 0.32],
      [-0.4, 0.27],
    ],
    [
      [-0.5, -0.4],
      [0.45, -0.5],
      [0.45, -0.1],
      [0.1, 0.5],
      [-0.35, 0.22],
    ],
    [
      [-0.5, -0.1],
      [-0.35, -0.4],
      [0.15, -0.5],
      [0.48, -0.2],
      [0.5, 0.1],
      [0.2, 0.45],
      [-0.2, 0.5],
      [-0.4, 0.23],
    ],
  ];
  const p = shapes[h.i].map(([x, z]) => [x * h.w, z * h.d]);
  let distance = Infinity,
    inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[j],
      b = p[i],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      t = clamp(((u - a[0]) * dx + (v - a[1]) * dz) / (dx * dx + dz * dz));
    distance = Math.min(distance, Math.hypot(u - a[0] - t * dx, v - a[1] - t * dz));
    if (a[1] > v !== b[1] > v && u < ((b[0] - a[0]) * (v - a[1])) / (b[1] - a[1]) + a[0])
      inside = !inside;
  }
  const d = inside ? -distance : distance;
  const irregular =
    1 + 0.1 * Math.sin(u * 0.11 + v * 0.045) + 0.055 * Math.cos(u * 0.069 - v * 0.093);
  let y = h.h * (1 - smooth(Math.max(0, d) / (h.run * irregular)));
  if (h.bank) {
    const bx = h.i === 3 ? h.w * 0.32 : 0,
      bz = -h.d * 0.36;
    const r = ((u - bx) / (h.w * 0.53)) ** 2 + ((v - bz) / Math.max(4, h.d * 0.16)) ** 2;
    y += h.bank * Math.exp(-r * 2.8);
  }
  if (h.i === 0) {
    // Surviving narrow terrace and a shallow cut on the northern edge.
    y -= 1.15 * Math.exp(-(((u + 8) / 5) ** 2) - ((v + 12) / 9) ** 2);
  }
  return Math.max(0, y);
}
const mainBounds = [-166, -247, 176, 136],
  fifthBounds = [345, 407, 465, 525],
  museumBounds = [-338, -239, -237, -118];
function inBounds([x, z], b, margin = 0) {
  return x >= b[0] + margin && z >= b[1] + margin && x <= b[2] - margin && z <= b[3] - margin;
}
function boundaryFade(x, z, b) {
  return smooth(Math.min(x - b[0], b[2] - x, z - b[1], b[3] - z) / 13);
}
function height(x, z) {
  if (inBounds([x, z], museumBounds)) return 30 * boundaryFade(x, z, museumBounds);
  const b = inBounds([x, z], mainBounds)
    ? mainBounds
    : inBounds([x, z], fifthBounds)
      ? fifthBounds
      : null;
  if (!b) return 0;
  const subset = b === mainBounds ? hills.slice(0, 4) : hills.slice(4);
  // The north edge rises toward the town terrace; individual hill crowns remain distinct.
  const bench = b === mainBounds ? 18 * smooth((-z - 110) / 110) : 0;
  return Math.max(bench, ...subset.map((h) => hillY(h, x, z))) * boundaryFade(x, z, b);
}
function knots(lo, hi, n, special = []) {
  const k = Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n);
  for (const p of special) {
    if (p <= lo || p >= hi) continue;
    let j = 1;
    for (let i = 2; i < n; i++) if (Math.abs(k[i] - p) < Math.abs(k[j] - p)) j = i;
    k[j] = p;
  }
  return [...new Set(k)].sort((a, b) => a - b);
}
function terrain(o, b, nx, nz, special = []) {
  let xs = knots(
      b[0],
      b[2],
      nx,
      special.map((p) => p[0]),
    ),
    zs = knots(
      b[1],
      b[3],
      nz,
      special.map((p) => p[1]),
    );
  if (b === museumBounds) {
    xs = [...new Set([...xs, b[0] + 13, b[2] - 13])].sort((a, b) => a - b);
    zs = [...new Set([...zs, b[1] + 13, b[3] - 13])].sort((a, b) => a - b);
  }
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < zs.length - 1; j++) {
      const p = [
        [xs[i], zs[j]],
        [xs[i + 1], zs[j]],
        [xs[i + 1], zs[j + 1]],
        [xs[i], zs[j + 1]],
      ].map(([x, z]) => [x, height(x, z), z]);
      const c = tint(grass, 0.99 + 0.035 * Math.sin((xs[i] + zs[j]) * 0.036));
      triangle(o, 'foliage', [p[0], p[2], p[1]], c);
      triangle(o, 'foliage', [p[0], p[3], p[2]], c);
    }
}
function paths(o) {
  if (o.detail === 'skyline') return;
  for (const f of map.features.filter((f) => f.tags.highway)) {
    const steps = f.tags.highway === 'steps',
      wood = f.tags.surface === 'wood';
    for (let i = 0; i < f.points.length - 1; i++) {
      const a = f.points[i],
        b = f.points[i + 1],
        l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (l < 0.05) continue;
      const step = steps ? (master(o) ? 0.55 : fine(o) ? 0.7 : near(o) ? 1.6 : 5) : near(o) ? 2 : 8,
        n = Math.ceil(l / step),
        w = steps ? 1.45 : 1.8,
        dx = (-(b[1] - a[1]) * w) / (2 * l),
        dz = ((b[0] - a[0]) * w) / (2 * l);
      for (let j = 0; j < n; j++) {
        const p = mix(a, b, j / n),
          q = mix(a, b, (j + 1) / n),
          m = mix(p, q, 0.5);
        if (![mainBounds, museumBounds].some((b) => inBounds(m, b, 8))) continue;
        const corners = [
          [p[0] + dx, p[1] + dz],
          [q[0] + dx, q[1] + dz],
          [q[0] - dx, q[1] - dz],
          [p[0] - dx, p[1] - dz],
        ];
        // Each corner is draped independently to prevent trails cutting through slopes.
        const pp = corners.map(([x, z]) => [x, height(x, z) + 0.14, z]);
        if (steps && near(o)) {
          const y = Math.max(...pp.map((p) => p[1])) + 0.06,
            c = frame(o, m[0], y, m[1], Math.atan2(b[1] - a[1], b[0] - a[0]));
          box(
            c,
            wood ? 'wood' : 'aggregate',
            [-l / n / 2, -0.12, -w / 2],
            [l / n / 2, 0, w / 2],
            wood ? timber : trail,
          );
        } else {
          triangle(o, wood ? 'wood' : 'aggregate', [pp[0], pp[2], pp[1]], wood ? timber : trail);
          triangle(o, wood ? 'wood' : 'aggregate', [pp[0], pp[3], pp[2]], wood ? timber : trail);
        }
      }
    }
  }
}
function buildingFrame(f) {
  const p = f.points.slice(0, -1);
  let edge = 0;
  for (let i = 1; i < p.length; i++)
    if (
      Math.hypot(...p[(i + 1) % p.length].map((v, j) => v - p[i][j])) >
      Math.hypot(...p[(edge + 1) % p.length].map((v, j) => v - p[edge][j]))
    )
      edge = i;
  const a = Math.atan2(
      p[(edge + 1) % p.length][1] - p[edge][1],
      p[(edge + 1) % p.length][0] - p[edge][0],
    ),
    c = Math.cos(a),
    s = Math.sin(a),
    r = p.map(([x, z]) => [x * c + z * s, -x * s + z * c]),
    lo = [0, 1].map((i) => Math.min(...r.map((p) => p[i]))),
    hi = [0, 1].map((i) => Math.max(...r.map((p) => p[i]))),
    m = mix(lo, hi, 0.5);
  return { x: m[0] * c - m[1] * s, z: m[0] * s + m[1] * c, a, w: hi[0] - lo[0], d: hi[1] - lo[1] };
}
function timberBuilding(o, f) {
  const b = buildingFrame(f),
    y = 30.05,
    w = b.w,
    d = b.d,
    h = w > 7 ? 2.6 : 2.2,
    r = d * 0.47,
    p = frame(o, b.x, y, b.z, b.a);
  if (near(o)) {
    box(p, 'wood', [-w / 2, 0, -d / 2], [w / 2, h, d / 2], tint(timber, 0.83));
    const step = fine(o) ? 0.23 : 0.55;
    for (let z = -d / 2; z <= d / 2; z += d)
      for (let yy = 0.14; yy < h; yy += step) {
        const a = [-w / 2 - 0.18, yy, z],
          bb = [w / 2 + 0.18, yy, z];
        beam(
          p,
          'wood',
          a,
          bb,
          step * 0.91,
          step * 0.8,
          tint(timber, 0.88 + 0.03 * (Math.round(yy * 20) % 5)),
        );
      }
    for (let x = -w / 2; x <= w / 2; x += w)
      for (let yy = 0.25; yy < h; yy += step)
        beam(
          p,
          'wood',
          [x, yy, -d / 2 - 0.18],
          [x, yy, d / 2 + 0.18],
          step * 0.9,
          step * 0.85,
          timber,
        );
  } else box(p, 'wood', [-w / 2, 0, -d / 2], [w / 2, h, d / 2], timber);
  for (const x of [-w / 2, w / 2]) {
    const q = [
      [x, h, -d / 2],
      [x, h, d / 2],
      [x, h + r, 0],
    ];
    let n = normalFor(...q);
    if (n[0] * x < 0) {
      q.reverse();
      n = normalFor(...q);
    }
    p.addTriangle(
      'wood',
      'palette:#ffffff',
      q,
      n,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      timber,
    );
  }
  for (const s of [-1, 1]) {
    const a = [-w / 2 - 0.32, h - 0.08, s * (d / 2 + 0.32)],
      b = [w / 2 + 0.32, h - 0.08, s * (d / 2 + 0.32)],
      c = [w / 2 + 0.32, h + r, 0],
      dd = [-w / 2 - 0.32, h + r, 0];
    const q = [a, b, c, dd];
    if (normalFor(...q)[1] < 0) q.reverse();
    face(p, 'wood', q, roof);
    if (near(o)) {
      const n = Math.ceil((w + 0.64) / (master(o) ? 0.19 : fine(o) ? 0.28 : 0.85));
      for (let j = 0; j < n; j++) {
        const t = (j + 0.5) / n,
          aa = mix(a, b, t),
          bb = mix(dd, c, t);
        aa[1] += 0.035;
        bb[1] += 0.035;
        beam(p, 'wood', aa, bb, 0.045, 0.06, tint(roof, 0.8 + 0.04 * (j % 5)));
      }
    }
  }
  if (near(o)) {
    // Door and small shutter locations are photographic interpretations, not measured openings.
    box(p, 'recess', [-0.53, 0, -d / 2 - 0.21], [0.53, 1.75, -d / 2 - 0.17], [0.22, 0.19, 0.13]);
    box(p, 'wood', [-0.48, 0.02, -d / 2 - 0.24], [0.48, 1.7, -d / 2 - 0.2], tint(timber, 0.62));
    if (w > 5)
      box(
        p,
        'wood',
        [w * 0.28 - 0.3, 1.1, -d / 2 - 0.24],
        [w * 0.28 + 0.3, 1.7, -d / 2 - 0.19],
        tint(timber, 0.57),
      );
    if (fine(o)) {
      for (let x = -0.4; x <= 0.4; x += 0.16)
        box(
          p,
          'wood',
          [x, 0.06, -d / 2 - 0.25],
          [x + 0.13, 1.67, -d / 2 - 0.22],
          tint(timber, 0.67),
        );
      for (const yy of [0.42, 1.35])
        beam(p, 'wood', [-0.42, yy, -d / 2 - 0.27], [0.42, yy, -d / 2 - 0.27], 0.08, 0.09, timber);
    }
  }
}
function fences(o) {
  for (const f of map.features.filter((f) => f.tags.barrier === 'fence'))
    for (let i = 0; i < f.points.length - 1; i++) {
      const a = f.points[i],
        b = f.points[i + 1],
        l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (l < 0.01) continue;
      const p = frame(o, a[0], 30.05, a[1], Math.atan2(b[1] - a[1], b[0] - a[0]));
      if (!fine(o)) {
        const q = [
          [0, 0, 0],
          [l, 0, 0],
          [l, 1.8, 0],
          [0, 1.8, 0],
        ];
        face(p, 'wood', q, tint(timber, 0.8));
        face(p, 'wood', q.toReversed(), tint(timber, 0.8));
      } else {
        const n = Math.ceil(l / (master(o) ? 0.22 : 0.48));
        for (let j = 0; j < n; j++) {
          const x = ((j + 0.5) * l) / n,
            h = 1.8 + 0.1 * Math.sin(j * 1.7 + i);
          box(
            p,
            'wood',
            [x - (l / n) * 0.45, 0, -0.06],
            [x + (l / n) * 0.45, h, 0.06],
            tint(timber, 0.78 + 0.035 * (j % 7)),
          );
        }
        for (const y of [0.55, 1.4]) beam(p, 'wood', [0, y, 0.11], [l, y, 0.11], 0.12, 0.1, timber);
      }
    }
}
export function buildKernaveRuntime(out, detail) {
  const o = { ...out, detail },
    tiers = {
      skyline: [19, 13, 6, 5, 2, 2],
      district: [35, 25, 12, 10, 4, 4],
      street: [65, 47, 22, 19, 9, 9],
      closeup: [110, 79, 38, 32, 16, 16],
    },
    n = tiers[detail] ?? [240, 174, 82, 70, 36, 36];
  terrain(
    o,
    mainBounds,
    n[0],
    n[1],
    hills.slice(0, 4).map((h) => h.center),
  );
  terrain(o, fifthBounds, n[2], n[3], [hills[4].center]);
  terrain(o, museumBounds, n[4], n[5]);
  paths(o);
  for (const [i, f] of map.features.filter((f) => f.tags.building).entries())
    timberBuilding(o, f, i);
  fences(o);
}
export function buildKernaveSkyline(out) {
  buildKernaveRuntime(out, 'skyline');
}
export const kernaveStudy = {
  id: 'N0251',
  key: 'kernave',
  title: 'Kernavė',
  category: 'castle',
  wikidataId: 'Q215315',
  mapFrame: 'map-frame.json',
  build: (out) => buildKernaveRuntime(out),
  smoothSlots: ['wall'],
  brief:
    'Five individually positioned surviving hillfort earthworks, mapped pedestrian paths and timber stairs, plus the separate modern three-yard museum reconstruction with twelve mapped wooden buildings and board fencing.',
  sourceFacts: {
    hillforts: 5,
    modernReconstructedYards: 3,
    mappedReconstructionBuildings: 12,
    surveyedTerrain: false,
    identity:
      'Q215315 is the town; map-parts.json identifies five independent hillfort nodes and the modern open-air exhibit.',
  },
  reconstruction: {
    basis:
      'Vengalis and Velius (2019) hilltop dimensions and surviving bank descriptions; OSM component positions, paths, stair lines and building/fence geometry; official museum aerial views.',
    datum:
      'Relative landscape model. Hill slope heights are not absolute elevations. Museum terrace at 30 m is an interpretation awaiting terrain survey.',
    state: 'Current archaeological landscape, not an imagined intact medieval castle.',
  },
  scaleBasis:
    'Meters from geographic map positions and published hill dimensions. East/south axes. Relative elevations, slope contours and wood-building heights remain interpretations.',
  refs: [
    'https://whc.unesco.org/en/list/1137/',
    'https://whc.unesco.org/document/151842',
    'https://doi.org/10.15388/ArchLit.2019.20.4',
    'https://www.kernave.lt/ekspozicija-po-atviru-dangumi/',
    'https://www.openstreetmap.org/node/1690273888',
  ],
  sourceDocuments: ['map-frame.json', 'map-parts.json', 'reference-metadata.json'],
  dataAttribution:
    'Map geometry © OpenStreetMap contributors, ODbL-1.0. Dimensions summarized from Vengalis & Velius 2019, CC-BY-4.0. Reference photos and LiDAR figure viewed for research only, no image or raster redistribution.',
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X east',
    front: '+Z south',
    origin: '[24.8517,54.8824], interpreted relative landscape datum',
  },
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    reviewStatus:
      'Composite archaeological site; surveyed elevations, terrain blending and local fit pending',
    notes:
      'Do not flatten or replace map buildings. Five hillforts and a separate modern museum reconstruction occupy distinct positions. Source landscape patches are not a surveyed terrain replacement.',
  }),
  geographicNote:
    'Draft only until a terrain survey and multi-part site review establish correct elevations and blending.',
  limitations: [
    'Maximum fidelity pending: earthwork contours are interpreted from documented top dimensions and aerial views; no elevation raster or surveyed mesh is bundled. Terrace datum, erosion scars and inter-hill gullies require measured terrain.',
    'Q215315 names the town. This source depicts five surviving hillforts and the separate modern open-air reconstruction; it must not be matched as a single castle footprint.',
    'The three museum yards retain twelve mapped building envelopes and mapped wooden fences. Wall heights, doors, roof pitches, individual boards and log details are approximate. A minor annex is represented within its main roof envelope.',
    'Published current banks are included. Ancient palisades, towers and buried settlement remains are not reconstructed above ground. Old church remains, chapels, modern museum, wider reserve vegetation and river terrain still need separate site coverage.',
    'Grass uses vertex color; timber and gravel use existing reusable procedural surface graphs. No model-specific bitmap textures. Landscape patch edges remain visible in standalone review and need host-terrain blending before activation.',
    'Mapped stairs retain their horizontal routes; step rises/counts derive from the interpreted terrain and are not a certified reconstruction of visitor access.',
  ],
  camera: { position: [-330, 310, 375], lookAt: [-5, 12, -45], fov: 44 },
  qaCameras: [
    { name: 'five-hillforts-and-museum-plan', position: [70, 1230, 145], lookAt: [70, 0, 145.1] },
    { name: 'central-four-earthworks', position: [265, 240, 275], lookAt: [0, 15, -62] },
    { name: 'aukuro-platform-and-stairs', position: [-115, 62, 135], lookAt: [-32, 14, 32] },
    { name: 'mindaugo-bank-and-ascent', position: [132, 72, -12], lookAt: [45, 16, -91] },
    { name: 'pilies-large-plateau', position: [-185, 148, -270], lookAt: [-37, 18, -105] },
    { name: 'lizdeikos-earth-bank', position: [145, 78, 150], lookAt: [65, 17, 41] },
    { name: 'kriveikiskio-fifth-hillfort', position: [485, 76, 570], lookAt: [405, 18, 465] },
    { name: 'modern-three-craft-yards', position: [-385, 100, -91], lookAt: [-285, 31, -177] },
    { name: 'timber-walls-and-board-roofs', position: [-304, 37, -193], lookAt: [-287, 32, -200] },
  ],
};
