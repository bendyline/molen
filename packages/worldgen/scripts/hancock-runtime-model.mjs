/** Hancock: tapered trussed tube, stone retail base and contemporary unequal broadcast masts. */
import { readFileSync } from 'node:fs';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import {
  face,
  lerp,
  localOutline,
  mappedCap,
  mappedSolid,
  panel,
  partPlan,
  shift,
} from './signature-tower-expansion-models.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const key = 'n0171_875_north_michigan_avenue',
  map = JSON.parse(readFileSync(structureSourcePath(key, 'map-frame.json'))),
  scope = JSON.parse(readFileSync(structureSourcePath(key, 'review-scope.json'))),
  part = (id) => map.elements.find((p) => p.id === id),
  bronze = [0.125, 0.11, 0.095],
  glazing = [0.145, 0.18, 0.18],
  roofY = 337.4136;
const settings = {
  skyline: { floorStep: 0, paneStep: 0, mastN: 6, lattice: 0, depth: false },
  district: { floorStep: 8, paneStep: 4, mastN: 8, lattice: 0, depth: true },
  street: { floorStep: 3, paneStep: 2, mastN: 12, lattice: 10, depth: true },
  closeup: { floorStep: 1, paneStep: 1, mastN: 16, lattice: 3.5, depth: true },
};
const bounds = (p) => [
  Math.min(...p.map((q) => q[0])),
  Math.max(...p.map((q) => q[0])),
  Math.min(...p.map((q) => q[1])),
  Math.max(...p.map((q) => q[1])),
];
const b = bounds(localOutline(map)),
  u = bounds(partPlan(map, part(232905283)));
export const hancockRing = (y) => {
  const p = lerp(b, u, y / roofY);
  return [
    [p[0], y, p[2]],
    [p[0], y, p[3]],
    [p[1], y, p[3]],
    [p[1], y, p[2]],
  ];
};
const stations = [
  [0, 0.24],
  [6, 23],
  [12, 46],
  [44, 164],
  [92, 304.8],
  [94, 313.8],
  [96, 321.3],
  [100, roofY],
];
const floorHeight = (f) => {
  for (let i = 1; i < stations.length; i++)
    if (f <= stations[i][0])
      return (
        stations[i - 1][1] +
        ((stations[i][1] - stations[i - 1][1]) * (f - stations[i - 1][0])) /
          (stations[i][0] - stations[i - 1][0])
      );
  return roofY;
};
function flatMember(out, p, q, n, width, color) {
  const d = q.map((v, i) => v - p[i]),
    len = Math.hypot(...d),
    v = [n[1] * d[2] - n[2] * d[1], n[2] * d[0] - n[0] * d[2], n[0] * d[1] - n[1] * d[0]].map(
      (v) => v / len,
    );
  face(
    out,
    'metal',
    [
      shift(p, v, -width / 2),
      shift(q, v, -width / 2),
      shift(q, v, width / 2),
      shift(p, v, width / 2),
    ],
    color,
  );
}
function build(out, level) {
  const c = settings[level];
  mappedSolid(out, 'foundation', localOutline(map), 0, 0.24, [0.2, 0.19, 0.17]);
  for (let side = 0; side < 4; side++) {
    const next = (side + 1) % 4,
      r0 = hancockRing(0.24),
      r1 = hancockRing(roofY),
      n = normalFor(r0[side], r0[next], r1[next]),
      columns = side % 2 === 0 ? 6 : 8,
      panes = columns * 4,
      at = (t, y, off = 0) => shift(lerp(hancockRing(y)[side], hancockRing(y)[next], t), n, off),
      member = (p, q, width, depth, color = bronze) =>
        c.depth
          ? beam(out, 'metal', p, q, width, depth, color)
          : flatMember(out, p, q, n, width, color);
    face(
      out,
      'glass',
      [at(0, 0.24), at(1, 0.24), at(1, roofY), at(0, roofY)],
      c.floorStep
        ? glazing
        : glazing.map(
            (v, i) => 0.75 * v + 0.25 * bronze[i] * scope.sourceFacts.surfaceMeans.metal_painted[i],
          ),
    );
    if (c.floorStep) {
      for (let f = 0; f < 100; f += c.floorStep) {
        const lo = floorHeight(f),
          hi = floorHeight(Math.min(100, f + c.floorStep)),
          spandrel = Math.min(0.9, (floorHeight(f + 1) - lo) * 0.27) * c.floorStep;
        face(
          out,
          'metal',
          [
            at(0, lo, 0.025),
            at(1, lo, 0.025),
            at(1, Math.min(hi, lo + spandrel), 0.025),
            at(0, Math.min(hi, lo + spandrel), 0.025),
          ],
          bronze,
        );
        if ([44, 45, 92, 93, 98, 99].includes(f))
          face(
            out,
            'glass',
            [
              at(0, lo + spandrel, 0.015),
              at(1, lo + spandrel, 0.015),
              at(1, hi, 0.015),
              at(0, hi, 0.015),
            ],
            [0.075, 0.084, 0.083],
          );
      }
      const half = (0.055 * c.paneStep) / (b[side % 2 === 0 ? 3 : 1] - b[side % 2 === 0 ? 2 : 0]);
      for (let j = c.paneStep; j < panes; j += c.paneStep) {
        const a = j / panes - half,
          z = j / panes + half;
        face(
          out,
          'metal',
          [at(a, 0.24, 0.03), at(z, 0.24, 0.03), at(z, roofY, 0.03), at(a, roofY, 0.03)],
          bronze,
        );
      }
    }
    for (let j = 0; j <= columns; j++)
      member(
        at(j / columns, 4.15, 0.19),
        at(j / columns, roofY, 0.19),
        j === 0 || j === columns ? 1.18 : 0.62,
        0.42,
      );
    // The former bottom-center V was unsupported by the built north-facade photographs.
    // Four full crossing tiers rise from lower corners; the crown closes at the center.
    // Tier heights remain a photo reconstruction, not an engineering survey.
    const joints = [4.15, 92, 176, 242, 304, roofY - 0.3];
    const brace = (a, z) => {
      const p = at(a[0], a[1], 0.53),
        q = at(z[0], z[1], 0.53);
      member(p, q, 1.05, 0.54);
      if (level === 'closeup' || level === 'street')
        for (const offset of [-0.4, 0.4]) {
          const d = q.map((v, k) => v - p[k]),
            l = Math.hypot(...d),
            v = [
              n[1] * d[2] - n[2] * d[1],
              n[2] * d[0] - n[0] * d[2],
              n[0] * d[1] - n[1] * d[0],
            ].map((v) => v / l);
          beam(
            out,
            'metal',
            shift(shift(p, v, offset), n, 0.3),
            shift(shift(q, v, offset), n, 0.3),
            0.12,
            0.08,
            [0.18, 0.16, 0.135],
          );
        }
    };
    for (let i = 0; i < joints.length - 2; i++) {
      brace([0, joints[i]], [1, joints[i + 1]]);
      brace([1, joints[i]], [0, joints[i + 1]]);
    }
    brace([0, 304], [0.5, roofY - 0.3]);
    brace([1, 304], [0.5, roofY - 0.3]);
    for (const y of joints.slice(1, -1)) member(at(0, y, 0.29), at(1, y, 0.29), 0.72, 1.5);
    // Story-high pale travertine retail surround, with actual open glazed bays.
    face(
      out,
      'travertine',
      [at(0, 3.45, 0.15), at(1, 3.45, 0.15), at(1, 4.15, 0.15), at(0, 4.15, 0.15)],
      [0.75, 0.7, 0.6],
    );
    for (let j = 0; j <= columns; j++) {
      const a = Math.max(0, j / columns - 0.012),
        z = Math.min(1, j / columns + 0.012);
      face(
        out,
        'travertine',
        [at(a, 0.24, 0.15), at(z, 0.24, 0.15), at(z, 3.45, 0.15), at(a, 3.45, 0.15)],
        [0.75, 0.7, 0.6],
      );
    }
  }
  mappedCap(
    out,
    'metal',
    hancockRing(roofY).map((p) => [p[0], p[2]]),
    roofY,
    [0.26, 0.27, 0.25],
  );
  const house = partPlan(map, part(1282265474));
  mappedSolid(out, 'metal', house, roofY, 343.7, [0.065, 0.082, 0.08]);
  // Current SOM photographs show white bases and unpainted open upper arrays, not red-white poles.
  for (const [id, tip] of [
    [279951771, 456.9],
    [279951772, 435],
  ]) {
    const p = partPlan(map, part(id)),
      center = p.reduce(
        (a, point) => [a[0] + point[0] / p.length, a[1] + point[1] / p.length],
        [0, 0],
      ),
      ring = (y, r, n = c.mastN) => radialRing(y, r, r, n, center),
      radius = (y) => 1.1 - ((y - 370) / (tip - 370)) * 0.9;
    loft(
      out,
      'metal',
      [
        [337.4, 1.65],
        [360, 1.65],
        [370, 1.1],
      ].map(([y, r]) => ring(y, r)),
      [0.8, 0.81, 0.77],
    );
    if (!c.lattice) loft(out, 'metal', [ring(370, 1.1), ring(tip, 0.2)], [0.44, 0.47, 0.45]);
    else {
      const r = (y) => ring(y, radius(y), 3);
      for (let i = 0; i < 3; i++)
        beam(out, 'metal', r(370)[i], r(tip)[i], 0.16, 0.16, [0.48, 0.5, 0.48]);
      for (let y = 370; y < tip; y += c.lattice) {
        const hi = Math.min(tip, y + c.lattice),
          a = r(y),
          b = r(hi);
        for (let i = 0; i < 3; i++) {
          beam(out, 'metal', a[i], a[(i + 1) % 3], 0.06, 0.06, [0.43, 0.46, 0.44]);
          beam(out, 'metal', a[i], b[(i + 1) % 3], 0.045, 0.045, [0.43, 0.46, 0.44]);
        }
      }
    }
    if (level === 'street' || level === 'closeup')
      for (const y of [354, 363, 371]) {
        const a = ring(y, 2.4, level === 'closeup' ? 12 : 6);
        for (let i = 0; i < a.length; i++) {
          beam(out, 'metal', a[i], a[(i + 1) % a.length], 0.075, 0.075, [0.55, 0.58, 0.54]);
          if (level === 'closeup')
            beam(out, 'metal', a[i], shift(a[i], [0, 1, 0], 1.1), 0.045, 0.045, [0.55, 0.58, 0.54]);
        }
      }
  }
  if (level === 'street' || level === 'closeup') {
    for (let i = 0; i < house.length; i++) {
      const a = [house[i][0], 344.5, house[i][1]],
        q = house[(i + 1) % house.length],
        b = [q[0], 344.5, q[1]];
      beam(out, 'metal', a, b, 0.08, 0.08, bronze);
    }
  }
  const south = hancockRing(313.8)[1][2];
  if (level === 'street' || level === 'closeup') {
    box(
      out,
      'glass',
      [-5.4, 313.8, south - 0.05],
      [5.4, 317.15, south + 0.15],
      [0.045, 0.05, 0.045],
    );
    for (let i = 0; i < 8; i++)
      panel(
        out,
        [
          [-5.2 + i * 1.3, 313.95, south + 0.18],
          [-3.96 + i * 1.3, 313.95, south + 0.18],
          [-3.96 + i * 1.3, 316.98, south + 0.18],
          [-5.2 + i * 1.3, 316.98, south + 0.18],
        ],
        [0.23, 0.3, 0.29],
        0.08,
        bronze,
      );
  }
}
function skylineOutput(out) {
  const prepare = (slot, color) => {
    const graph = scope.surfaceOverrides[slot]?.graph,
      mean = scope.sourceFacts.surfaceMeans[graph] ?? [1, 1, 1];
    return color.map((v, i) => v * mean[i]);
  };
  return {
    addTriangle(slot, _ref, p, n, uv, color) {
      out.addTriangle('glass', 'palette:#ffffff', p, n, uv, prepare(slot, color));
    },
    addQuad(slot, _ref, p, n, uv, color) {
      out.addQuad('glass', 'palette:#ffffff', p, n, uv, prepare(slot, color));
    },
    addConvexPolygon(slot, _ref, p, n, uv, color) {
      out.addConvexPolygon('glass', 'palette:#ffffff', p, n, uv, prepare(slot, color));
    },
  };
}
export const buildHancockReviewedMaster = (out) => build(out, 'closeup');
export const buildHancockCloseup = (out) => build(out, 'closeup');
export const buildHancockStreet = (out) => build(out, 'street');
export const buildHancockDistrict = (out) => build(out, 'district');
export const buildHancockSkyline = (out) => build(skylineOutput(out), 'skyline');
