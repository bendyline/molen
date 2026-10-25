/** Historic Hotel del Coronado exterior with original government survey controls.
 * The mapped courtyard remains open; the later north pavilion is outside this asset.
 */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { B, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const base = new URL(
  '../../../content/worldgen/source/places/9m/9mu/hotel_del_coronado/',
  import.meta.url,
);
const ballroomControls = JSON.parse(
    fs.readFileSync(new URL('ballroom-survey-controls.json', base)),
  ),
  ballroomY = (name) =>
    ballroomControls.referenceFloorModelY +
    ballroomControls.relativeFeet[name] * ballroomControls.feetToMeters;
const kitchenControls = JSON.parse(fs.readFileSync(new URL('kitchen-plan-controls.json', base)));
const white = rgb('e9e7dc'),
  trim = rgb('f1eee3'),
  roof = rgb('9c4435'),
  glass = rgb('53686b'),
  baseColor = rgb('b6aca0');
const ref = 'palette:#ffffff';
function facing(o, a, x = 0, z = 0) {
  const co = Math.cos(a),
    si = Math.sin(a),
    v = (p) => [co * p[0] + si * p[2], p[1], -si * p[0] + co * p[2]],
    q = (p) => {
      const r = v(p);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, p, n, uv, c) => o.addTriangle(s, r, p.map(q), v(n), uv, c),
    addQuad: (s, r, p, n, uv, c) => o.addQuad(s, r, p.map(q), v(n), uv, c),
    addConvexPolygon: (s, r, p, n, uv, c) => {
      const pp = p.map(q),
        u = p.map(uv);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => u[pp.indexOf(p)], c);
    },
  };
}
function face(o, s, x, y, z, w, h, c) {
  quad(
    o,
    s,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, 1],
    c,
  );
}
function prism(o, loops, low, high, color = white, slot = 'wall') {
  const rings = loops.map((r, i) => {
    r = r.slice();
    if (r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1]) r.pop();
    const a = r.reduce(
      (s, p, j) => s + p[0] * r[(j + 1) % r.length][1] - r[(j + 1) % r.length][0] * p[1],
      0,
    );
    if (a > 0 !== (i === 0)) r.reverse();
    return r;
  });
  const pts = rings.flat(),
    holes = [];
  let count = 0;
  for (let i = 0; i < rings.length; i++) {
    if (i) holes.push(count);
    count += rings[i].length;
  }
  const indices = earcut(pts.flat(), holes);
  for (const [y, n] of [
    [low, [0, -1, 0]],
    [high, [0, 1, 0]],
  ])
    for (let i = 0; i < indices.length; i += 3) {
      const p = indices.slice(i, i + 3).map((j) => [pts[j][0], y, pts[j][1]]);
      o.addTriangle(
        slot,
        ref,
        p,
        n,
        p.map((p) => [p[0], p[2]]),
        color,
      );
    }
  for (const r of rings)
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      quad(
        o,
        slot,
        [
          [a[0], low, a[1]],
          [b[0], low, b[1]],
          [b[0], high, b[1]],
          [a[0], high, a[1]],
        ],
        [b[1] - a[1], 0, a[0] - b[0]],
        color,
      );
    }
}
function gable(o, x, z, w, d, y, rise) {
  B(o, 'trim', x, y - 0.15, z, w, 0.2, d, trim);
  for (const sign of [-1, 1]) {
    const p = [
      [x - w / 2, y, z + (sign * d) / 2],
      [x + w / 2, y, z + (sign * d) / 2],
      [x + w / 2, y + rise, z],
      [x - w / 2, y + rise, z],
    ];
    quad(o, 'roof', p, normalFor(...(sign > 0 ? p : [...p].reverse())), roof);
  }
  for (const sign of [-1, 1]) {
    const p = [
      [x + (sign * w) / 2, y, z - d / 2],
      [x + (sign * w) / 2, y, z + d / 2],
      [x + (sign * w) / 2, y + rise, z],
    ];
    o.addTriangle(
      'wall',
      ref,
      p,
      [sign, 0, 0],
      p.map((p) => [p[2], p[1]]),
      white,
    );
  }
}
function window(o, x, y, z, w, h, d) {
  face(o, 'glass', x, y, z, w, h, glass);
  if (d < 3) return;
  for (const xx of [-w / 2 - 0.06, w / 2 + 0.06])
    face(o, 'trim', x + xx, y - 0.08, z + 0.025, 0.12, h + 0.16, trim);
  for (const yy of [y - 0.08, y + h]) face(o, 'trim', x, yy, z + 0.03, w + 0.24, 0.12, trim);
  if (d > 1) {
    face(o, 'trim', x, y + h * 0.48, z + 0.05, w, 0.055, trim);
    if (w > 1.6) face(o, 'trim', x, y, z + 0.06, 0.06, h, trim);
  }
}
function railing(o, w, y, z, d) {
  B(o, 'trim', 0, y, z, w, 0.1, 0.13, trim);
  B(o, 'trim', 0, y + 0.96, z, w, 0.12, 0.17, trim);
  if (d < 2) return;
  const step = d > 2 ? 0.4 : d > 1 ? 0.8 : 2.8;
  for (let x = -w / 2; x <= w / 2 + 0.01; x += step) {
    if (d > 2) B(o, 'trim', x, y, z, 0.065, 0.98, 0.07, trim);
    else {
      face(o, 'trim', x, y, z + 0.035, 0.065, 0.98, trim);
      face(facing(o, Math.PI), 'trim', -x, y, -z + 0.035, 0.065, 0.98, trim);
    }
  }
}
function veranda(o, w, floors, d, { depth = 3, pitch = 3.5, level = 1.2 } = {}) {
  const bays = Math.round(w / pitch),
    p = w / bays;
  if (!d) {
    for (let i = 0; i < floors; i++)
      face(o, 'glass', 0, level + i * 3.6 + 0.45, -depth + 0.1, w - 0.8, 2.1, glass);
    return;
  }
  for (let i = 0; i < floors; i++) {
    const y = level + i * 3.6;
    B(o, 'trim', 0, y, 0, w, 0.18, depth * 2, trim);
    for (let j = 0; j < bays; j++)
      window(o, -w / 2 + (j + 0.5) * p, y + 0.4, -depth + 0.05, p * 0.67, 2.35, d);
    if (i > 0) railing(o, w, y + 0.2, depth, d);
    for (let j = 0; j <= bays; j += d === 1 ? 2 : 1) {
      const x = -w / 2 + j * p;
      if (d === 1) face(o, 'trim', x, y, depth, 0.15, 3.55, trim);
      else B(o, 'trim', x, y, depth, 0.15, 3.55, 0.15, trim);
      if (d > 2) {
        B(o, 'trim', x, y + 0.2, depth, 0.24, 0.16, 0.24, trim);
        B(o, 'trim', x, y + 3.25, depth, 0.3, 0.16, 0.3, trim);
      }
    }
  }
  B(o, 'trim', 0, level + floors * 3.6, 0, w, 0.2, depth * 2 + 0.4, trim);
}
function dormer(o, x, y, z, w, d, rise = 1.5) {
  B(o, 'wall', x, y, z, w, 1.5, d, white);
  const rr = facing(o, Math.PI / 2, x, z);
  gable(rr, 0, 0, d + 0.3, w + 0.3, y + 1.5, rise);
  window(o, x, y + 0.25, z + d / 2 + 0.05, w * 0.65, 0.95, 2);
  for (const side of [-1, 1])
    beam(
      o,
      'trim',
      [x + side * (w / 2 + 0.12), y + 1.5, z + d / 2 + 0.15],
      [x, y + 1.5 + rise, z + d / 2 + 0.15],
      0.12,
      0.16,
      trim,
    );
}
function band(o, x, z, r, y, h, n, slot = 'trim', col = trim) {
  loft(
    o,
    slot,
    [radialRing(y, r, r, n, [x, z], Math.PI / n), radialRing(y + h, r, r, n, [x, z], Math.PI / n)],
    col,
  );
}
function cone(o, x, z, r0, r1, y0, y1, n = 12) {
  loft(
    o,
    'roof',
    [
      radialRing(y0, r0, r0, n, [x, z], Math.PI / n),
      radialRing(y1, r1, r1, n, [x, z], Math.PI / n),
    ],
    roof,
  );
}
function polygonWindows(o, x, z, r, y, h, n, d, count = 1) {
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      ro = facing(o, a, x + Math.sin(a) * r, z + Math.cos(a) * r),
      w = 2 * r * Math.tan(Math.PI / n);
    for (let j = 0; j < count; j++)
      window(ro, ((j - (count - 1) / 2) * w) / count, y, 0.03, (w / count) * 0.72, h, d);
  }
}
function turret(o, x, z, y, d) {
  band(o, x, z, 4.3, y, 4.0, 8, 'wall', white);
  if (d) polygonWindows(o, x, z, 3.98, y + 0.35, 2.9, 8, d, 2);
  band(o, x, z, 4.6, y + 3.85, 0.3, 8);
  cone(o, x, z, 4.7, 0.1, y + 4.15, y + 12, 8);
  B(o, 'trim', x, y + 11.9, z, 0.11, 3.2, 0.11, trim);
}
function rotunda(o, d) {
  const x = 63,
    z = 39,
    n = 12,
    floor = ballroomY('ballroomFloor'),
    balcony = ballroomY('balcony'),
    eave = ballroomY('mainRoofEave'),
    towerFloor = ballroomY('belvedereFloor'),
    towerEave = towerFloor + 12 * ballroomControls.feetToMeters,
    roofTip = ballroomY('roofTip'),
    flagpoleTip = ballroomY('flagpoleTip');
  // Sheet 7 distinguishes the lower glazed storey from the ballroom facade.
  // Retain the existing native horizontal envelope and buried attachment plane;
  // the reconstructed section is not a current ground or horizontal survey.
  band(o, x, z, 22.4, -1.3, floor + 1.3, n, 'wall', white);
  band(o, x, z, 22.4, floor, 7.5 - floor, n, 'wall', white);
  cone(o, x, z, 23, 17.1, 7.5, balcony, n);
  band(o, x, z, 17.1, balcony, eave - balcony, n, 'wall', white);
  cone(o, x, z, 18, 4.25, eave, towerFloor - 0.45, n);
  band(o, x, z, 5, towerFloor - 0.45, 0.45, n);
  band(o, x, z, 4.15, towerFloor, towerEave - towerFloor, n, 'wall', white);
  cone(o, x, z, 4.7, 0.08, towerEave, roofTip, n);
  B(o, 'trim', x, roofTip - 0.1, z, 0.14, flagpoleTip - roofTip + 0.1, 0.14, trim);
  if (d) {
    band(o, x, z, 22.52, floor - 0.1, 0.2, n);
    polygonWindows(o, x, z, 21.64, 0.65, 2.65, n, d, 2);
    polygonWindows(o, x, z, 21.64, 4.4, 2.4, n, d, 2);
    polygonWindows(o, x, z, 16.51, balcony + 0.2, eave - balcony - 0.4, n, d, 3);
    polygonWindows(o, x, z, 4.01, towerFloor + 0.4, 2.7, n, d, 1);
  }
  if (d > 1) {
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n,
        ro = facing(o, a, x, z);
      for (const [y, r, w] of [
        [18.4, 12.45, 2.6],
        [24.3, 7.55, 1.9],
      ])
        dormer(ro, 0, y, r, w, 2.2, 1.15);
      const rr = facing(o, a, x + Math.sin(a) * 4.82, z + Math.cos(a) * 4.82);
      railing(rr, 2.6, towerFloor + 0.05, 0, d);
      beam(ro, 'trim', [0, towerFloor - 1.5, 4.1], [0, towerFloor - 0.35, 5.05], 0.18, 0.2, trim);
    }
  }
}
function kitchen(o, d) {
  const ring = kitchenControls.outline,
    eave = kitchenControls.eaveMeters,
    tip = kitchenControls.roofTipMeters,
    center = [
      ring.reduce((sum, p) => sum + p[0], 0) / ring.length,
      ring.reduce((sum, p) => sum + p[1], 0) / ring.length,
    ];
  // The old long dining bar left this distinct mapped kitchen as bare plinth.
  // Keep the original ground and join the new walls to the existing foundation.
  prism(o, [ring], d ? 1.15 : -1.4, eave, white);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      p = [
        [a[0], eave, a[1]],
        [b[0], eave, b[1]],
        [center[0], tip, center[1]],
      ];
    if (normalFor(...p)[1] < 0) p.reverse();
    o.addTriangle(
      'roof',
      ref,
      p,
      normalFor(...p),
      p.map((v) => [v[0], v[2]]),
      roof,
    );
    if (!d || (d === 1 && i > 1)) continue;
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      width = Math.hypot(dx, dz),
      nx = dz / width,
      nz = -dx / width,
      facade = facing(o, Math.atan2(nx, nz), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    if (d === 1) face(facade, 'glass', 0, 4.1, 0.035, width * 0.52, 2.5, glass);
    else for (const x of [-width / 3, 0, width / 3]) window(facade, x, 4.1, 0.035, 2.2, 3.0, d);
  }
}
function build(o, d) {
  const frame = JSON.parse(fs.readFileSync(new URL('map-frame.json', base)));
  if (d) prism(o, frame.geometry.rings, -1.4, 1.15, baseColor, 'foundation');
  else
    for (const [x, z, w, depth] of [
      [-7, 35, 90, 30],
      [-41, 2, 20, 78],
      [0, -29, 64, 22],
      [51, 4, 40, 42],
    ])
      B(o, 'foundation', x, -1.4, z, w, 2.55, depth, baseColor);
  // Three guest wings enclose the open courtyard; the ocean wing is one storey lower.
  B(o, 'wall', -7, 1.1, 35, 90, 14.5, 20, white);
  gable(o, -7, 35, 92, 26, 15.6, 2.0);
  B(o, 'wall', -41, 1.1, 2, 18, 18.0, 78, white);
  const side = facing(o, Math.PI / 2, -41, 2);
  gable(side, 0, 0, 80, 21, 19.1, 3.5);
  B(o, 'wall', 0, 1.1, -29, 64, 18.0, 18, white);
  gable(o, 0, -29, 66, 22, 19.1, 3.6);
  // Main lobby joins the ballroom to the dining wing, with its independent steep roof.
  B(o, 'wall', 51, 1.1, 4, 38, 14.5, 42, white);
  const lobby = facing(o, Math.PI / 2, 51, 4);
  gable(lobby, 0, 0, 43, 39, 15.6, 8.0);
  const dining = facing(o, -Math.PI / 4, 45, -39);
  B(dining, 'wall', 0, 1.1, 0, 24, 10.0, 47, white);
  const dr = facing(dining, Math.PI / 2);
  gable(dr, 0, 0, 49, 25, 11.1, 6.2);
  kitchen(o, d);
  // Rounded dining projection remains lower than the guest-room roofline.
  band(o, 66, -43, 10.5, 1.1, 9.5, 12, 'wall', white);
  cone(o, 66, -43, 11, 0.1, 10.6, 15.7, 12);
  rotunda(o, d);
  turret(o, -41, -33, 18.7, d);
  turret(o, -5, -34, 20.4, d);
  turret(o, 65, 7, 15.5, d);
  veranda(facing(o, 0, -7, 47), 90, 4, d, { depth: 2, pitch: 3.45 });
  veranda(facing(o, Math.PI, -1, 23), 60, 4, d, { depth: 2, pitch: 3.6 });
  veranda(facing(o, 0, 0, -18.5), 59, 5, d, { depth: 1.5, pitch: 3.7 });
  veranda(facing(o, Math.PI / 2, -30.8, 1), 39, 5, d, { depth: 1.2, pitch: 3.5 });
  veranda(facing(o, -Math.PI / 2, 30.45, 2), 38, 4, d, { depth: 1.5, pitch: 3.5 });
  if (d) {
    // Window rhythms are conservative interpretations of the historic plans.
    for (const [fo, w, floors] of [
      [facing(o, -Math.PI / 2, -50.05, 1), 75, 5],
      [facing(o, Math.PI, 0, -38.05), 61, 5],
      [facing(o, Math.PI / 2, 70.05, 6), 30, 4],
    ])
      for (let i = 0; i < floors; i++)
        for (let j = 0; j < Math.floor(w / 3.6); j++)
          window(fo, -w / 2 + 2 + j * 3.6, 1.8 + i * 3.6, 0.06, 1.55, 2.35, d);
    for (const sign of [-1, 1]) {
      const fo = facing(o, sign > 0 ? 0 : Math.PI, 45 + sign * 8, -39 + sign * 8);
      for (let j = 0; j < 8; j++) window(fo, -17 + j * 4.8, 3, 0.08, 2.5, 4, d);
    }
    polygonWindows(o, 66, -43, 10.15, 3.0, 5.5, 12, d, 1);
    for (const x of [-44, 30]) {
      dormer(o, x, 16.6, 39, 10, 12, 4.7);
      const fo = facing(o, 0, x, 46);
      railing(fo, 10, 16.7, 0, d);
    }
    if (d > 1) {
      for (const x of [-24, -12, 10, 22]) {
        dormer(o, x, 20, -24, 3.7, 4, 2);
        dormer(facing(o, Math.PI), -x, 20, 34, 3.7, 4, 2);
      }
      for (const z of [-17, 2, 18]) dormer(facing(o, -Math.PI / 2), z, 20, 42, 4, 4, 2.1);
    }
    // Broad red awning over the lowest ocean veranda, with a narrow valance.
    const aw = [
      [-52, 5.0, 49.4],
      [38, 5.0, 49.4],
      [38, 4.45, 52.0],
      [-52, 4.45, 52.0],
    ];
    quad(o, 'roof', aw, [0, 1, 1], roof);
    B(o, 'roof', -7, 4.22, 52, 90, 0.23, 0.1, roof);
    if (d > 1)
      for (const x of [-44, 0, 32])
        for (let i = 0; i < 6; i++)
          B(o, 'foundation', x, 0.15 + i * 0.17, 53.8 - i * 0.3, 4, 0.2, 0.55, baseColor);
    if (d > 2)
      for (const x of [-27, -10, 7, 24]) {
        B(o, 'roof', x, 20.8, -29, 1.0, 1.2, 0.9, roof);
        B(o, 'trim', x, 21.9, -29, 1.2, 0.18, 1.1, trim);
      }
  }
}
export function coronado(o) {
  build(o, 3);
}
export function coronadoSkyline(o) {
  build(o, 0);
}
export function coronadoDistrict(o) {
  build(o, 1);
}
export function coronadoStreet(o) {
  build(o, 2);
}
const surfaces = {
  wall: { slot: 'wall', graph: 'wood_painted_lap', roughness: 0.85, metallic: 0 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.8, metallic: 0 },
  foundation: landmarkSurfaces.concrete,
  roof: landmarkSurfaces.roof,
  glass: { ...landmarkSurfaces.glass, localRef: ref },
};
export const coronadoModel = {
  id: 'hotel_del_coronado',
  recipe: 'structure-hotel-del-coronado.mjs',
  key: 'hotel_del_coronado',
  cell: '9m/9mu',
  title: 'Hotel del Coronado',
  brief:
    'Historic white wooden courtyard hotel with stepped red roof wings, ocean-front verandas, dormers, three smaller turrets and the twelve-sided main ballroom roof and belvedere.',
  camera: [160, 110, 200],
  lookAt: [16, 14, 0],
  qaCameras: [
    { name: 'front', position: [5, 28, 235], lookAt: [15, 18, 20] },
    { name: 'back', position: [-85, 65, -185], lookAt: [12, 16, -10] },
    { name: 'ballroom-detail', position: [110, 15, 100], lookAt: [63, 12, 39] },
    { name: 'belvedere-detail', position: [87, 38, 72], lookAt: [63, 32, 39] },
    { name: 'lower-storey-detail', position: [90, 4, 73], lookAt: [63, 3.3, 39] },
    { name: 'courtyard-detail', position: [2, 29, 0], lookAt: [2, 9, -16] },
    { name: 'kitchen-detail', position: [31, 24, -108], lookAt: [40, 9, -57] },
  ],
  build: coronado,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  mediumFiContext: { scale: 2.8 },
  groundContactBasis:
    'Preserved independent terrain sampled outside the ocean wing at [0,55]; foundations extend to -1.4 m. Architectural floors and steps are photo-derived estimates above the common datum; no terrain flattening.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-hotel-del-coronado.mjs',
    level: 'skyline',
    export: 'coronadoSkyline',
    // Conservative allowance for the simplified foundation and small roof details.
    // The kitchen volume now preserves the former missing northern projection.
    errorMeters: 10.5,
    surfaces,
    authoredLevels: {
      district: { export: 'coronadoDistrict', errorMeters: 0.35, surfaces },
      street: { export: 'coronadoStreet', errorMeters: 0.14, surfaces },
    },
  },
  limitations: [
    'Mapped historic hotel and open courtyard retained. Current comparison starts with a cleared public-domain Lambert panorama and original government HABS1971drawings4/6/7; earlier CC photos and resort-map artwork are excluded. Historic exterior is modeled at medium-fi; later restoration details are outside the dated evidence.',
    'White painted wood, red shingle roofs, verandas, dormers and twelve-sided ballroom tower are retained. Exact floor heights, roof intersections, hidden facade rhythm, ornament and stair joins are interpretations.',
    'The later connected north service pavilion, separate modern resort neighborhoods, pool complex, utility buildings, landscaping and interiors are excluded.',
    'This dated-reference exterior does not claim every 2021–2025 porch/courtyard restoration detail. Flagpoles are modeled without animated flags.',
    'Independent ground is preserved. Other host terrain sources may differ. Reference images are not embedded or redistributed.',
    'HABS1971sheet7 reconstructs the historical ballroom from original drawings, early photographs and field measurements. Relative lower floor, balcony, eave, belvedere floor, roof and flagpole levels now follow its labels. The existing interpreted ballroom floor+3.9m and native horizontal envelope remain unchanged; no current floor-to-ground or section-width survey claim.',
    'Lower ballroom glazed storey replaces the former tall solid gray foundation. Original survey controls put roof tip38.9774m and flagpole tip47.0038m in this retained model frame. Belvedere wall height, apron/dormer positions, exact current window divisions and restored finishes remain interpretations.',
    'The northern kitchen now has a separate wall volume, hipped roof and interpreted service glazing at all detail levels. Its exposed corners retain the native vector boundary. Fixed-scale HABS plan registration gives 2.54m control RMS and 6.49/7.18m approximate ballroom/kitchen check differences; no survey accuracy is claimed. The closer levels retain the native foundation perimeter. The conservative skyline allowance remains 10.5m; no global mesh-distance certificate is claimed.',
  ],
};
