/** Connected Exchange Square: original podium, three native towers and current tilted-glass Forum. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/we/wec/exchange_square_hong_kong/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  C = {
    stone: rgb('b29d8c'),
    glass: rgb('91acae'),
    roof: rgb('8c9189'),
    metal: rgb('677d7c'),
    base: rgb('aaa799'),
  },
  surfaces = {
    stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.86, metallic: 0 },
    glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.29, metallic: 0.13 },
    roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
    metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.55, metallic: 0.18 },
    base: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.96, metallic: 0 },
  };
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const c = cross(
    q[1].map((v, i) => v - q[0][i]),
    q[2].map((v, i) => v - q[0][i]),
  );
  if (Math.hypot(...c) < 1e-8) return;
  if (n && c.reduce((a, v, i) => a + v * n[i], 0) < 0) q = [q[0], q[2], q[1]];
  const nn = normalFor(...q);
  o.addTriangle(
    s,
    ref,
    q,
    nn,
    q.map((v) => (Math.abs(nn[1]) > 0.7 ? [v[0], v[2]] : [v[0] + v[2], v[1]])),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
const area = (r) =>
  r.reduce((a, v, i) => a + v[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * v[1], 0);
function cap(o, s, r, y, up = true) {
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [r[k][0], y, r[k][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function frame(r, i) {
  const a = r[i],
    b = r[(i + 1) % r.length],
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    sign = Math.sign(area(r)),
    n = [sign * u[1], 0, -sign * u[0]];
  return {
    len,
    n,
    P: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[2] * z],
  };
}
function rect(o, s, f, x0, y0, x1, y1, z = 0, col = C[s]) {
  if (x1 - x0 < 1e-4 || y1 - y0 < 1e-4) return;
  Q(o, s, [f.P(x0, y0, z), f.P(x1, y0, z), f.P(x1, y1, z), f.P(x0, y1, z)], f.n, col);
}
function B(o, s, x, y, z, w, h, l, col = C[s]) {
  box(o, s, [x - w / 2, y, z - l / 2], [x + w / 2, y + h, z + l / 2], col);
}
function prism(o, s, r, y0, y1) {
  cap(o, s, r, y0, false);
  cap(o, s, r, y1);
  for (let i = 0; i < r.length; i++) {
    const f = frame(r, i);
    rect(o, s, f, 0, y0, f.len, y1);
  }
}
// A real ledge between recessed glazing and the projecting stone spandrel, rather than a coplanar stripe.
function band(o, f, y0, y1, d, width = f.len, x = 0) {
  rect(o, 'stone', f, x, y0, x + width, y1, 0.035);
  if (d > 0)
    for (const [y, n] of [
      [y0, [0, -1, 0]],
      [y1, [0, 1, 0]],
    ])
      Q(
        o,
        'stone',
        [f.P(x, y, -0.18), f.P(x + width, y, -0.18), f.P(x + width, y, 0.035), f.P(x, y, 0.035)],
        n,
      );
}
function roof(o, r, top, d, third = false) {
  cap(o, 'roof', r, d === 0 ? top : top - 1.4);
  for (let i = 0; i < r.length; i++) {
    const f = frame(r, i);
    if (d === 0 && !third) continue;
    rect(o, 'stone', f, 0, top - (third ? 5.8 : 1.25), f.len, top);
    if (d > 0) {
      Q(
        o,
        'stone',
        [f.P(0, top), f.P(f.len, top), f.P(f.len, top, -0.5), f.P(0, top, -0.5)],
        [0, 1, 0],
      );
      Q(
        o,
        'stone',
        [
          f.P(0, top, -0.5),
          f.P(0, top - 1.4, -0.5),
          f.P(f.len, top - 1.4, -0.5),
          f.P(f.len, top, -0.5),
        ],
        f.n.map((v) => -v),
      );
    }
  }
  if (d > 0) {
    const c = r.reduce((a, v) => [a[0] + v[0] / r.length, a[1] + v[1] / r.length], [0, 0]);
    B(
      o,
      'metal',
      c[0],
      top - 1.38,
      c[1],
      third ? 9 : 6,
      third ? 1.3 : 0.85,
      third ? 5 : 4,
      third ? rgb('84a99d') : C.metal,
    );
    if (d > 1) {
      for (let k = 0; k < 3; k++) B(o, 'roof', c[0] - 4 + k * 3, top - 1.38, c[1] + 4, 2, 1, 1.7);
      if (d > 2)
        for (let k = 0; k < 8; k++) B(o, 'metal', c[0] - 4 + k, top - 0.03, c[1], 0.18, 0.08, 4);
    }
  }
}
function tower(o, r, top, d, third = false) {
  const floorCount = third ? p.parameters.thirdOfficeFloors : p.parameters.mainOfficeFloors,
    groups = third ? [0, 2, 10, floorCount][d] : [0, 2, 15, floorCount][d],
    bottom = 15,
    roofLine = top - (third ? 5.8 : d === 0 ? 0 : 1.25),
    pitch = (roofLine - bottom) / floorCount,
    col = third ? rgb('435251') : C.glass;
  for (let i = 0; i < r.length; i++) {
    const f = frame(r, i),
      curved = !third && f.len < 4.1;
    if (d < 3) rect(o, 'glass', f, 0, bottom, f.len, roofLine, -0.18, col);
    else
      for (let j = 0; j < floorCount; j++) {
        const yy = bottom + j * pitch,
          panes = Math.max(1, Math.ceil(f.len / (third ? 2.7 : 2.8)));
        for (let k = 0; k < panes; k++) {
          const x = (k * f.len) / panes,
            x1 = ((k + 1) * f.len) / panes,
            v = (((i * 19 + j * 7 + k * 3) % 17) - 8) * 0.008,
            pane = col.map((c, axis) => Math.max(0.06, c + v * (axis === 2 ? 1.1 : 1)));
          rect(o, 'glass', f, x, yy, x1, Math.min(yy + pitch, roofLine), -0.18, pane);
        }
      }
    for (let j = 0; j < groups; j++) {
      const yy = bottom + (j * (roofLine - bottom)) / groups;
      band(o, f, yy, yy + (d === 1 ? 1.5 : d === 2 ? 1.05 : 0.91), d);
    }
    if (curved) band(o, f, p.parameters.serviceBelt[0], p.parameters.serviceBelt[1], d);
    // Straight blade ends and re-entrant junctions carry the full-height granite piers visible in the principal-pair photo.
    if (!third && f.len > 4.2) {
      for (const x of [0, f.len - 0.75]) rect(o, 'stone', f, x, bottom, x + 0.75, top, 0.055);
    }
    if (d > 1) {
      const n = Math.max(1, Math.ceil(f.len / (d === 3 ? 1.65 : 4.5)));
      for (let k = 1; k < n; k++) {
        const x = (k * f.len) / n;
        rect(o, 'metal', f, x - 0.026, bottom, x + 0.026, roofLine, -0.15);
      }
    }
  }
  roof(o, r, top, d, third);
}
function podium(o, d) {
  const r = p.outline;
  // The deck is intrinsic to the mapped 2-storey podium; no surrounding city ground is introduced.
  prism(o, 'base', r, 7.4, 8.15);
  cap(o, 'roof', r, 15);
  for (let i = 0; i < r.length; i++) {
    const f = frame(r, i);
    rect(o, 'stone', f, 0, 13.95, f.len, 15);
    if (f.len < 5) {
      rect(o, 'base', f, 0, 0, f.len, 7.4);
      rect(o, 'stone', f, 0, 8.15, f.len, 13.95);
      continue;
    }
    // Back walls are inset, leaving physical open bus/colonnade bays below the deck.
    rect(o, 'glass', f, 0, 0.25, f.len, 7.35, -5, rgb('2f3e3c'));
    rect(o, 'glass', f, 0, 8.2, f.len, 13.9, -2.25, rgb('4d6666'));
    const count = Math.max(1, Math.round(f.len / [45, 25, 10, 8][d]));
    for (let k = 0; k <= count; k++) {
      if (k === count && i === r.length - 1) continue;
      const a = f.P(Math.min(f.len - 0.45, Math.max(0.45, (k * f.len) / count)), 0, -0.55);
      if (d === 0)
        rect(
          o,
          'base',
          f,
          Math.max(0, (k * f.len) / count - 0.55),
          0,
          Math.min(f.len, (k * f.len) / count + 0.55),
          7.4,
          -0.55,
        );
      else B(o, 'base', a[0], 0, a[2], 0.92, 7.4, 1.05);
      if (d > 1) {
        const b = f.P((k * f.len) / count, 8.15, -0.65);
        B(o, 'metal', b[0], 8.15, b[2], 0.13, 5.8, 0.13);
      }
    }
    if (d > 0) {
      for (const y of [8.2, 9.3, 13.85]) rect(o, 'metal', f, 0, y, f.len, y + 0.12, -0.45);
      if (d > 1)
        for (let x = 2; x < f.len; x += 2.2)
          rect(o, 'metal', f, x - 0.025, 8.3, x + 0.025, 13.85, -2.2);
    }
    Q(o, 'roof', [f.P(0, 15), f.P(f.len, 15), f.P(f.len, 15, -2), f.P(0, 15, -2)], [0, 1, 0]);
  }
  // Principal entrance occupies the actual gap between One and Two, with an open central glazed portal.
  if (d > 0) {
    B(o, 'stone', 12.3, 15, 41, 1.5, 14, 1.1);
    B(o, 'stone', 20.4, 15, 41, 1.5, 14, 1.1);
    B(o, 'stone', 16.35, 26.5, 41, 9.6, 2.5, 1.1);
    B(o, 'glass', 16.35, 15, 40.5, 6.5, 11.5, 0.2);
    B(o, 'metal', 16.35, 14.7, 44, 10.8, 0.25, 5.6);
    if (d > 1)
      for (let k = 0; k < 5; k++) B(o, 'metal', 12.8 + k * 1.75, 15, 40.7, 0.09, 11.5, 0.15);
  }
}
function forum(o, d) {
  const r = p.forum,
    center = r.reduce((a, v) => [a[0] + v[0] / r.length, a[1] + v[1] / r.length], [0, 0]);
  // The mapped 6-vertex perimeter is the maximum plan envelope. The architect's tilted cube is an original
  // bounded reconstruction inside it, not the round pre-2014 Forum or Sandcrawler's inverted terraces.
  const V = (i, y) => {
      const q = r[i % r.length],
        t = (y - 15) / 21.5,
        shrink = 0.87 + 0.13 * t;
      return [
        center[0] + (q[0] - center[0]) * shrink - 1.8 * (1 - t),
        y,
        center[1] + (q[1] - center[1]) * shrink - 2.1 * (1 - t),
      ];
    },
    levels = d === 0 ? 1 : d === 1 ? 2 : p.parameters.forumStoreys;
  for (let i = 0; i < r.length; i++) {
    const f = frame(r, i);
    for (let j = 0; j < levels; j++) {
      const a = 15 + (j * 21.5) / levels,
        b = 15 + ((j + 1) * 21.5) / levels,
        q = [V(i, a), V(i + 1, a), V(i + 1, b), V(i, b)],
        col = rgb(i % 2 ? '6d9091' : '87a6a8');
      Q(o, 'glass', q, f.n, col);
      if (d > 0) {
        beam(o, 'metal', q[0], q[1], 0.12, 0.12, C.metal);
        if (d > 1) {
          const panels = Math.max(1, Math.ceil(f.len / (d === 2 ? 13 : 6)));
          for (let k = 0; k < panels; k++) {
            const lerp = (a, b, t) => a.map((v, n) => v + (b[n] - v) * t),
              a0 = lerp(q[0], q[1], k / panels),
              a1 = lerp(q[0], q[1], (k + 1) / panels),
              b0 = lerp(q[3], q[2], k / panels),
              b1 = lerp(q[3], q[2], (k + 1) / panels);
            beam(o, 'metal', a0, b1, 0.09, 0.09, C.metal);
            beam(o, 'metal', a1, b0, 0.09, 0.09, C.metal);
          }
        }
      }
    }
  }
  const top = r.map((_, i) => V(i, 36.5));
  for (let i = 1; i < top.length - 1; i++) T(o, 'glass', [top[0], top[i], top[i + 1]], [0, 1, 0]);
  if (d > 0) {
    // Recessed low entrance beneath the leaning southwest face, an explicit estimate from architect text.
    const f = frame(r, 5);
    rect(o, 'glass', f, 2, 15, f.len - 2, 19.5, -3, rgb('344c4b'));
    for (const x of [2, f.len - 2])
      beam(o, 'metal', f.P(x, 15, -2), f.P(x, 20.3), 0.22, 0.22, C.metal);
  }
}
function build(o, _f, d = 3) {
  podium(o, d);
  tower(o, p.one, 188, d);
  tower(o, p.two, 188, d);
  tower(o, p.three, 144, d, true);
  forum(o, d);
}
export const exchangeSquareSkyline = (o, f) => build(o, f, 0),
  exchangeSquareDistrict = (o, f) => build(o, f, 1),
  exchangeSquareStreet = (o, f) => build(o, f, 2),
  exchangeSquareCloseup = (o, f) => build(o, f, 3);
export const exchangeSquareHongKongModel = {
  id: 'exchange_square_hong_kong',
  key: 'exchange_square_hong_kong',
  cell: 'we/wec',
  recipe: 'structure-exchange-square-hong-kong.mjs',
  title: 'Exchange Square, Hong Kong',
  category: 'civic',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [-300, 175, 330],
  lookAt: [-20, 88, 12],
  portableGroundY: -0.15,
  mediumFiContext: { scale: 3, groundY: -0.15 },
  qaCameras: [
    {
      name: 'whole-connected-three-towers-podium-and-current-forum',
      position: [-285, 150, 305],
      lookAt: [-20, 87, 12],
      reviewLod: 'skyline',
    },
    {
      name: 'one-two-rounded-granite-glass-bays-and-central-entry',
      position: [100, 52, 146],
      lookAt: [32, 38, 36],
    },
    {
      name: 'third-tower-open-roofwell-and-current-faceted-forum',
      position: [-190, 160, 125],
      lookAt: [-85, 96, 4],
    },
    {
      name: 'whole-native-rear-outline-service-belts-and-open-street-podium',
      position: [115, 48, -125],
      lookAt: [-20, 36, -5],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent512m field frozen before geometry at fixed outboard street approach; provider coastal pits and actual host urban grade/threshold contact unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-exchange-square-hong-kong.mjs',
    level: 'skyline',
    export: 'exchangeSquareSkyline',
    errorMeters: 3,
    surfaces,
    authoredLevels: {
      district: { export: 'exchangeSquareDistrict', errorMeters: 1.2, surfaces },
      street: { export: 'exchangeSquareStreet', errorMeters: 0.4, surfaces },
      closeup: { export: 'exchangeSquareCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Entire original22-vertex podium/43One/49Two/14Three/6currentForum retained as one connected complex. Native188/188/144m and52/52/32overall-level tags are not survey dimensions; 15m shared podium/50 and30office row allocation/116–129m curved service belts/central portal and roof gear are bounded photographic interpretation. No generic cylinders or neighboring towers.',
    'Two exact May2026 AP22088 creator-own CC0 originals show full principal pair and lower podium; Third auxiliary exact2006Odessa3 ownPD-self original shows whole Third facade/open roofwell, with native annotation plus current map/owner identity. Third current cosmetic finish/mechanical census and all fine hidden facade details bounded. Old2006roundForum/neighbors never adopted. No photo texture/generated bitmap/downloaded mesh.',
    'Current Forum reconstructed from native6-vertex footprint and primary Aedas tilted-cube/diamond-cut-glass/grand-entry text and quantity-surveyor five-storey description; no eligible current Forum photograph adopted.21.5m height above15m podium/tilt/diagrid/entry are original bounded estimates, not a measured facade. Sandcrawler courtyard/inverted terraces are a different project and excluded.',
    'Whole raised podium intrinsic deck/open street-level columns/recessed retail/upper terrace retained; exact bus-bay/column/window counts, floor and loading profiles, side thresholds and junctions estimated. Distant facade census coarsened while original complete skyline remains. No city street slab/neighbor buildings/planted gardens/art/people/vehicles/signletters/flags/interiors.',
    'Independent512m129x129 field/all16641values/two raw source tiles frozen before geometry and retained unchanged without fit/flatten/reacquisition. Coastal composite pits down to-458.8139m are implausible provider artifacts, not bathymetry or foundation controls.31.0923m provider-relative street datum and actual sea/street/building threshold compatibility unverified; ordinary native preview/replaceFootprint=false. Portable/shared/context stages separate from live host terrain.',
  ],
};
