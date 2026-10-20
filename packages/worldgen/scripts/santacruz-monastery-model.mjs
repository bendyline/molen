/** 'N0541': Santa Cruz stone west front, nave and actual open cloister court. */
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, openingShape, prepareOpening } from './authored-wall-openings.mjs';
import { box, loft, prism, rect } from './khmer-structure-geometry.mjs';

const inside = (q, ring) => {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > q[1] !== b[1] > q[1] &&
      q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
};
const simplified = (ring, protectedRing) => {
  let p = ring.map((v) => [...v]),
    changed = true;
  while (changed && p.length > 4) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[(i + 1) % p.length],
        q = p[i],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        distance = Math.abs((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])) / len;
      if (
        distance < 2.2 &&
        protectedRing.every((q) =>
          inside(
            q,
            p.filter((_, k) => k !== i),
          ),
        )
      ) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return p;
};
const avg = (ring) => [0, 1].map((k) => ring.reduce((s, p) => s + p[k], 0) / ring.length);
const expand = (ring, meters) => {
  const c = avg(ring);
  return ring.map((p) => p.map((v, k) => v + Math.sign(v - c[k]) * meters));
};
export function buildSantaCruzMonastery(face, detail, r, sampleTerrain) {
  const a = r.architecturalAngleRadians,
    c = Math.cos(a),
    s = Math.sin(a),
    grade = (x, z) => sampleTerrain(c * x - s * z, s * x + c * z),
    f = (role, ps, n) => {
      if (detail === 0 && n[1] < -0.5) return;
      face(
        role,
        ps.map(([x, y, z]) => [c * x - s * z, y, s * x + c * z]),
        [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
      );
    },
    floor = r.floorY,
    courtY = r.courtFloorY,
    front = r.frontX,
    mid = r.frontCenterZ;
  const buried = (p) =>
    Math.min(
      ...p.outline.flatMap((a, i) => {
        const b = p.outline[(i + 1) % p.outline.length],
          n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2);
        return Array.from({ length: n + 1 }, (_, k) =>
          grade(a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n),
        );
      }),
    ) - 0.65;
  function solid(p, role, lo, hi, holes = []) {
    const out = { addTriangle: (slot, _ref, ps, n) => f(slot, ps, n) },
      cut = openingBuilder(
        out,
        holes.map((h) => prepareOpening(h, 0, detail)),
      ),
      emit = (role, ps, n) => {
        for (let i = 1; i < ps.length - 1; i++) {
          const t = [ps[0], ps[i], ps[i + 1]];
          if (Math.hypot(...normalFor(...t)) > 0.5)
            cut.addTriangle(role, 'palette:#ffffff', t, n, [], []);
        }
      };
    prism(emit, role, p, lo, hi);
  }
  function surround(h, w, role = 'trim', offset = 0.06) {
    const inner = openingShape(h, detail),
      outer = openingShape(
        {
          ...h,
          width: h.width + w * 2,
          height: h.height + w * 2,
          bottom: h.bottom - w,
          spring: (h.spring ?? h.height) + w,
        },
        detail,
      ),
      p = prepareOpening(h, 0, detail);
    for (let i = 0; i < inner.length; i++) {
      const j = (i + 1) % inner.length;
      f(
        role,
        [
          p.point(...outer[i], offset),
          p.point(...outer[j], offset),
          p.point(...inner[j], offset),
          p.point(...inner[i], offset),
        ],
        [p.normal[0], 0, p.normal[1]],
      );
    }
  }
  function recessed(h, depth = 0.45, trim = 0.15, glass = true) {
    const p = prepareOpening(h, 0, detail);
    for (let i = 0; i < p.ring.length; i++) {
      const j = (i + 1) % p.ring.length;
      f(
        'trim',
        [
          p.point(...p.ring[i], 0.01),
          p.point(...p.ring[j], 0.01),
          p.point(...p.ring[j], -depth),
          p.point(...p.ring[i], -depth),
        ],
        [0, 1, 0],
      );
    }
    if (glass)
      f(
        'inset',
        p.ring.map((q) => p.point(...q, -depth)),
        [p.normal[0], 0, p.normal[1]],
      );
    if (detail > 0) surround(h, trim);
  }
  function cylinder(role, x, z, profile, n = detail === 0 ? 4 : 8) {
    loft(f, role, x, z, profile, false, (w) =>
      Array.from({ length: n }, (_, i) => [
        (Math.cos((i * Math.PI * 2) / n) * w) / 2,
        (Math.sin((i * Math.PI * 2) / n) * w) / 2,
      ]),
    );
  }
  function cross(x, z, y, size = 0.9) {
    box(f, 'trim', x, y, z, 0.15, size * 1.6, 0.15);
    box(f, 'trim', x, y + size * 0.9, z, 0.15, 0.14, size);
  }
  function roof(x0, x1, z0, z1, eave, ridge) {
    const z = (z0 + z1) / 2;
    f(
      'roof',
      [
        [x0, eave, z0],
        [x1, eave, z0],
        [x1, ridge, z],
        [x0, ridge, z],
      ],
      [0, 1, -0.5],
    );
    f(
      'roof',
      [
        [x0, ridge, z],
        [x1, ridge, z],
        [x1, eave, z1],
        [x0, eave, z1],
      ],
      [0, 1, 0.5],
    );
    f(
      'plaster',
      [
        [x0, eave, z0],
        [x0, ridge, z],
        [x0, eave, z1],
      ],
      [-1, 0, 0],
    );
    f(
      'plaster',
      [
        [x1, eave, z0],
        [x1, ridge, z],
        [x1, eave, z1],
      ],
      [1, 0, 0],
    );
    if (detail > 0) box(f, 'roof', (x0 + x1) / 2, ridge - 0.08, z, x1 - x0, 0.2, 0.3);
  }
  // Separate footings preserve native courtyard and plaza ground.
  prism(f, 'wall', r.church, buried(r.church), floor + 0.04);
  const monastery =
    detail === 0
      ? { outline: simplified(r.monastery.outline, expand(r.court, 4.6)), holes: r.monastery.holes }
      : r.monastery;
  prism(f, 'plaster', monastery, buried(r.monastery), courtY + 0.04);
  const entry = {
      center: [front + 1.3, mid],
      axis: [0, 1],
      depth: 7,
      shape: 'round',
      width: 4.2,
      bottom: floor + 0.1,
      height: 7.2,
      spring: 5.1,
    },
    upper = {
      center: [front + 1.1, mid],
      axis: [0, 1],
      depth: 5,
      shape: 'round',
      width: 3.4,
      bottom: floor + 14.2,
      height: 7.2,
      spring: 5.35,
    };
  const body = {
    outline: rect(3.8, 0.77, 35.7, 13.85).outline,
    holes: [rect(3.8, 0.77, 34.3, 12.45).outline],
  };
  const sideWindows = [];
  if (detail > 0)
    for (const sign of [-1, 1])
      for (const x of [-7.8, 1, 9.8, 18])
        sideWindows.push({
          center: [x, 0.77 + sign * 6.925],
          axis: sign === 1 ? [-1, 0] : [1, 0],
          depth: 2,
          shape: 'pointed',
          width: 1.3,
          bottom: floor + 12.2,
          height: 4.6,
          spring: 3.5,
        });
  solid(body, 'plaster', floor, floor + r.churchHeight, [entry, ...sideWindows]);
  for (const h of sideWindows) recessed(h, 0.45, 0.17);
  roof(-14.3, 21.9, -6.4, 7.95, floor + r.churchHeight, floor + r.churchRidge);
  solid(rect(front + 1.3, mid, 2.6, r.frontWidth), 'wall', floor, floor + r.frontHeight, [
    entry,
    upper,
  ]);
  // Visible masonry reveals and a dark shallow entrance; no complete ritual interior.
  const entryFace = { ...entry, center: [front - 0.015, mid] },
    upperFace = { ...upper, center: [front - 0.015, mid] };
  recessed(entryFace, 2.25, 0.35);
  recessed(upperFace, 0.8, 0.25);
  if (detail > 0) {
    for (const dz of [-1.65, 1.65])
      box(f, 'door', front + 1.4, floor + 0.15, mid + dz, 0.12, 5.0, 0.7);
    for (let z = -1.35; z <= 1.36; z += detail >= 2 ? 0.27 : 0.54)
      box(f, 'inset', front - 0.05, floor + 14.3, mid + z, 0.055, 5.5, 0.035);
    if (detail >= 2)
      for (let y = 14.6; y < 20; y += 0.52)
        box(f, 'inset', front - 0.05, floor + y, mid, 0.055, 0.035, 3.0);
    for (let i = 0; i < 3; i++)
      surround(
        { ...entryFace, width: 4.9 + i * 0.65, height: 8.1 + i * 0.65, spring: 5.7 + i * 0.35 },
        0.18,
        'trim',
        0.1 + i * 0.08,
      );
    for (let i = 0; i < (detail >= 2 ? 4 : 2); i++)
      surround(
        { ...upperFace, width: 3.75 + i * 0.42, height: 7.55 + i * 0.42, spring: 5.5 + i * 0.22 },
        0.14,
        'trim',
        0.1 + i * 0.065,
      );
  }
  // Faceted massive corners and the two distinctive crocketed stone pinnacles.
  for (const sign of [-1, 1]) {
    const z = mid + sign * 6.9;
    prism(
      f,
      'wall',
      {
        outline: [
          [-0.95, -2.35],
          [1.9, -2.35],
          [2.2, -1.7],
          [2.2, 1.7],
          [1.4, 2.35],
          [-0.95, 2.35],
          [-1.4, 1.65],
          [-1.4, -1.65],
        ].map(([x, v]) => [front + 1 + x, z + v]),
        holes: [],
      },
      floor,
      floor + 24.4,
    );
    if (detail > 0)
      for (const y of [6.6, 13.2, 19.5, 24.1])
        box(f, 'trim', front + 0.8, floor + y, z, 3.7, 0.18, 4.9);
    cylinder(
      'wall',
      front + 0.7,
      z,
      [
        [floor + 24.4, 4.7],
        [floor + 25, 4.4],
        [floor + 27.2, 2.4],
        [floor + 29, 0.2],
      ],
      detail === 0 ? 4 : 8,
    );
    cross(front + 0.7, z, floor + 29, 0.65);
    if (detail >= 2)
      for (let j = 0; j < 4; j++)
        for (const t of [-1, 1])
          box(
            f,
            'trim',
            front + 0.15,
            floor + 25 + j * 0.85,
            z + t * (1.9 - j * 0.45),
            0.48,
            0.22,
            0.52,
          );
  }
  box(f, 'wall', front + 1.1, floor + 24.2, mid, 2.4, 1.2, 6.8);
  if (detail === 0) box(f, 'trim', front + 0.15, floor + 25.4, mid, 0.25, 0.3, 7.0);
  else {
    box(f, 'trim', front - 0.06, floor + 26.6, mid, 0.4, 0.3, 7.4);
    for (let i = -3; i <= 3; i++)
      box(f, 'trim', front - 0.08, floor + 25.4, mid + i, 0.3, 1.2, 0.22);
    for (const z of [-3.4, 3.4]) {
      cylinder(
        'trim',
        front + 0.2,
        mid + z,
        [
          [floor + 25.2, 0.5],
          [floor + 27.6, 0.22],
        ],
        6,
      );
      cross(front + 0.2, mid + z, floor + 27.6, 0.35);
    }
  }
  cross(front + 0.4, mid, floor + 27.2, 1.15);
  if (detail >= 2) {
    // Raised pale carved screen follows the tall window and swept shoulders rather than a plain rectangular panel.
    const half = [
        [-5.3, 0.2],
        [-5.3, 12],
        [-5.75, 14.5],
        [-5.4, 17.2],
        [-4.8, 18.7],
        [-4.2, 16.7],
        [-3.2, 16.0],
        [-2.75, 19.5],
        [-2.5, 21.5],
        [-1.3, 22.8],
        [0, 23.6],
      ],
      profile = [
        ...half,
        ...half
          .slice(0, -1)
          .toReversed()
          .map(([z, y]) => [-z, y]),
      ],
      ix = earcut(profile.flat()),
      cut = openingBuilder(
        { addTriangle: (role, _ref, ps, n) => f(role, ps, n) },
        [entry, upper].map((h) => prepareOpening(h, 0, detail)),
      );
    for (let i = 0; i < ix.length; i += 3) {
      const ps = ix
        .slice(i, i + 3)
        .map((k) => [front - 0.24, floor + profile[k][1], mid + profile[k][0]]);
      cut.addTriangle('trim', 'palette:#ffffff', ps, [-1, 0, 0], [], []);
    }
    for (const sign of [-1, 1]) {
      for (let k = 0; k < 3; k++)
        cylinder(
          'trim',
          front - 0.48,
          mid + sign * (2.2 + k * 0.21),
          [
            [floor + 13.8, 0.18],
            [floor + 20.4, 0.18],
          ],
          6,
        );
      const z = mid + sign * 4.1,
        y = floor + 14.0;
      cylinder(
        'trim',
        front - 0.7,
        z,
        [
          [y, 0.6],
          [y + 0.3, 0.8],
          [y + 1.55, 0.45],
          [y + 1.8, 0.62],
        ],
        8,
      );
      cylinder(
        'trim',
        front - 0.7,
        z,
        [
          [y + 1.8, 0.3],
          [y + 2.1, 0.42],
          [y + 2.35, 0.22],
        ],
        8,
      );
      for (let k = 0; k < 5; k++)
        cylinder(
          'trim',
          front + 0.7,
          mid + sign * 6.9,
          [
            [floor + 25 + k * 0.7, 4.05 - k * 0.65],
            [floor + 25.18 + k * 0.7, 4.25 - k * 0.65],
          ],
          8,
        );
    }
  }
  // Original sculptural screen: moulded piers, canopies, figures and leafy scroll rhythms.
  if (detail > 0) {
    for (const sign of [-1, 1]) {
      const z = mid + sign * 4.4;
      cylinder(
        'trim',
        front - 0.35,
        z,
        [
          [floor + 0.1, 1.65],
          [floor + 1, 1.25],
          [floor + 6.7, 1.1],
          [floor + 7.2, 1.65],
          [floor + 16.8, 0.85],
          [floor + 18.5, 0.35],
        ],
        detail === 1 ? 4 : 8,
      );
      if (detail >= 2) {
        for (let y = 1.3; y < 6.5; y += 0.7)
          box(f, 'trim', front - 1.02, floor + y, z, 0.16, 0.13, 1.12);
        for (let j = 0; j < 4; j++)
          cylinder(
            'trim',
            front - 0.55,
            z,
            [
              [floor + 13.2 + j * 0.55, 0.9 - j * 0.15],
              [floor + 13.45 + j * 0.55, 0.75 - j * 0.15],
            ],
            6,
          );
      }
    }
    if (detail >= 2) {
      for (const z of [-3.25, -1.9, 0, 1.9, 3.25]) {
        const y = Math.abs(z) > 2 ? floor + 12.3 : floor + 10.3;
        cylinder(
          'trim',
          front - 0.42,
          mid + z,
          [
            [y, 0.52],
            [y + 0.25, 0.67],
            [y + 1.25, 0.4],
            [y + 1.5, 0.52],
          ],
          6,
        );
        cylinder(
          'trim',
          front - 0.43,
          mid + z,
          [
            [y + 1.5, 0.22],
            [y + 1.78, 0.35],
            [y + 2, 0.18],
          ],
          6,
        );
        const niche = {
          center: [front - 0.16, mid + z],
          axis: [0, 1],
          shape: 'round',
          width: 0.94,
          bottom: y - 0.15,
          height: 2.4,
          spring: 1.9,
          depth: 1,
        };
        surround(niche, 0.12, 'trim', 0.13);
        box(f, 'trim', front - 0.5, y - 0.2, mid + z, 0.7, 0.2, 0.9);
      }
      for (const sign of [-1, 1])
        for (let j = 0; j < 5; j++)
          cylinder(
            'trim',
            front - 0.6,
            mid + sign * (2.1 + j * 0.33),
            [
              [floor + 8.1 + j * 0.5, 0.36],
              [floor + 8.4 + j * 0.5, 0.64],
              [floor + 8.65 + j * 0.5, 0.3],
            ],
            6,
          );
    }
  }
  // Short local stairs; no broad raised plaza or square foundation.
  const threshold = floor + 0.1;
  for (let k = 0; k < (detail === 0 ? 2 : 4); k++) {
    const x = front - 0.45 - k * 0.5,
      top = threshold - k * 0.18,
      lo = Math.min(grade(x, mid) - 0.35, top - 0.2);
    box(f, 'trim', x, lo, mid, 0.52, top - lo, 5.3 + k * 0.12);
  }
  if (detail > 0)
    for (const sign of [-1, 1])
      for (const x of [-10, -2, 6, 14, 21]) {
        box(f, 'trim', x, floor, 0.77 + sign * 7.1, 0.55, 18.8, 0.55);
        box(f, 'trim', x, floor + 18.8, 0.77 + sign * 7.1, 0.8, 0.25, 0.8);
      }
  // Actual mapped open court: lower pointed arcade, upper glazed register and shallow tile roof.
  const court = r.court,
    outer = expand(court, 3.2),
    far = expand(court, 4.5),
    center = avg(court);
  const wing = { outline: monastery.outline, holes: [far] };
  prism(f, 'plaster', wing, courtY, courtY + r.wingHeight);
  // Polygon roof divided along an inner ridge; original mapped outline retained.
  const roofRing = far,
    roofInner = expand(court, 3.5);
  prism(
    f,
    'roof',
    { outline: monastery.outline, holes: [roofRing] },
    courtY + r.wingHeight,
    courtY + r.wingHeight + 0.15,
  );
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      ps = [roofRing[i], roofRing[j], roofInner[j], roofInner[i]];
    f(
      'roof',
      ps.map((p, k) => [p[0], courtY + (k < 2 ? r.wingHeight + 0.15 : r.wingRidge), p[1]]),
      [0, 1, 0],
    );
    f(
      'plaster',
      [
        [roofInner[i][0], courtY + 9.65, roofInner[i][1]],
        [roofInner[j][0], courtY + 9.65, roofInner[j][1]],
        [roofInner[j][0], courtY + r.wingRidge, roofInner[j][1]],
        [roofInner[i][0], courtY + r.wingRidge, roofInner[i][1]],
      ],
      [center[0] - roofInner[i][0], 0, center[1] - roofInner[i][1]],
    );
  }
  prism(f, 'trim', { outline: outer, holes: [court] }, courtY - 0.15, courtY + 0.09);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      A = court[i],
      B = court[j],
      dx = B[0] - A[0],
      dz = B[1] - A[1],
      length = Math.hypot(dx, dz),
      axis = [dx / length, dz / length],
      normal = [-axis[1], axis[0]],
      inward = [center[0] - (A[0] + B[0]) / 2, center[1] - (A[1] + B[1]) / 2],
      sgn = Math.sign(normal[0] * inward[0] + normal[1] * inward[1]),
      point = (u, n, y) => [
        A[0] + axis[0] * u + normal[0] * n * sgn,
        y,
        A[1] + axis[1] * u + normal[1] * n * sgn,
      ],
      edge = (role, u0, u1, n0, n1, y0, y1) => {
        if (detail === 0) {
          const A = point(u0, n1, y0),
            B = point(u1, n1, y0),
            C = point(u1, n1, y1),
            D = point(u0, n1, y1);
          f(role, [A, B, C, D], [normal[0] * sgn, 0, normal[1] * sgn]);
          f(role, [A, D, C, B], [-normal[0] * sgn, 0, -normal[1] * sgn]);
          return;
        }
        prism(
          f,
          role,
          {
            outline: [point(u0, n0, 0), point(u1, n0, 0), point(u1, n1, 0), point(u0, n1, 0)].map(
              (p) => [p[0], p[2]],
            ),
            holes: [],
          },
          y0,
          y1,
        );
      },
      bays = 5,
      step = length / bays;
    // The lower arcade stays open at every level. No opaque replacement wall across its bays.
    edge(
      'wall',
      0,
      length,
      -0.6,
      0,
      courtY + (detail === 0 ? 4.65 : 4.8),
      courtY + r.cloisterHeight,
    );
    edge('trim', 0, length, -3.2, 0, courtY + 5, courtY + 5.18);
    for (let k = 0; k <= bays; k++)
      edge('wall', k * step - 0.34, k * step + 0.34, -0.65, 0.07, courtY, courtY + 4.8);
    for (let k = 0; k < bays; k++) {
      const u = (k + 0.5) * step,
        h = {
          center: point(u, -0.3, 0).filter((_, k) => k !== 1),
          axis,
          depth: 1.6,
          shape: 'pointed',
          width: step - 0.85,
          bottom: courtY + 0.45,
          height: 4.35,
          spring: 3.2,
        };
      const n = [normal[0] * sgn, normal[1] * sgn];

      if (detail === 0) continue;
      // Wedge fill above the pointed void and layered arch mouldings.
      const L = point(u - h.width / 2, 0, courtY + 3.65),
        R = point(u + h.width / 2, 0, courtY + 3.65),
        T = point(u, 0, courtY + 4.8),
        U = point(u - h.width / 2, 0, courtY + 4.8),
        V = point(u + h.width / 2, 0, courtY + 4.8);
      f('wall', [L, T, U], [...n.slice(0, 1), 0, n[1]]);
      f('wall', [T, R, V], [n[0], 0, n[1]]);
      const hp = prepareOpening(h, 0, detail);
      surround(h, 0.16, 'trim', sgn * 0.33);
      if (detail >= 2) {
        const at = point(u, -0.12, 0);
        cylinder(
          'trim',
          at[0],
          at[2],
          [
            [courtY + 0.5, 0.4],
            [courtY + 0.7, 0.55],
            [courtY + 3.2, 0.25],
            [courtY + 3.4, 0.55],
          ],
          8,
        );
        for (const shift of [-h.width / 4, h.width / 4]) {
          const q = {
            ...h,
            center: [h.center[0] + axis[0] * shift, h.center[1] + axis[1] * shift],
            width: h.width / 2,
            bottom: courtY + 0.5,
            height: 3.7,
            spring: 2.8,
          };
          surround(q, 0.09, 'trim', sgn * 0.36);
        }
        for (let k = 0; k < hp.ring.length; k++) {
          const v = hp.ring[k],
            w = hp.ring[(k + 1) % hp.ring.length];
          if (k > 0)
            f(
              'trim',
              [
                hp.point(...v, -0.3),
                hp.point(...w, -0.3),
                hp.point(...w, 0.3),
                hp.point(...v, 0.3),
              ],
              [0, 1, 0],
            );
        }
      }
      const window = {
        ...h,
        width: step - 0.9,
        bottom: courtY + 6.15,
        height: 1.95,
        spring: 1.55,
        shape: 'round',
      };
      const wp = prepareOpening(window, 0, detail);
      f(
        'inset',
        wp.ring.map((p) => wp.point(...p, sgn * 0.325)),
        [n[0], 0, n[1]],
      );
      surround(window, 0.12, 'trim', sgn * 0.34);
      if (detail >= 2)
        for (const t of [-1, 0, 1]) {
          const p = point(u + (t * (step - 0.9)) / 4, 0.035, 0);
          cylinder(
            'trim',
            p[0],
            p[2],
            [
              [courtY + 6.2, 0.07],
              [courtY + 7.8, 0.07],
            ],
            4,
          );
        }
    }
    // Solid short passage ceiling and a two-slope tile eave behind the open facade.
    edge('trim', 0, length, -3.2, 0, courtY + 8.6, courtY + 8.78);
    f(
      'roof',
      [
        point(0, 0.2, courtY + 8.9),
        point(length, 0.2, courtY + 8.9),
        point(length, -6.4, courtY + 9.65),
        point(0, -6.4, courtY + 9.65),
      ],
      [0, 1, 0],
    );
    if (detail >= 2) {
      for (let k = 0; k <= bays; k++) {
        const p = point(k * step, 0.32, 0);
        cylinder(
          'trim',
          p[0],
          p[2],
          [
            [courtY + 0.1, 0.9],
            [courtY + 4.8, 0.64],
            [courtY + 5, 0.95],
            [courtY + 8.5, 0.46],
            [courtY + 8.8, 0.85],
            [courtY + 10, 0.12],
          ],
          6,
        );
        cross(p[0], p[2], courtY + 10, 0.22);
      }
      // Reused neutral ceramic graph tinted blue: original abstract lower-wall tile band.
      edge('tile', 0, length, -3.16, -3.1, courtY + 0.4, courtY + 1.9);
    }
  }
  // Original tiered court fountain; no copied figure or narrative sculpture.
  cylinder(
    'wall',
    center[0],
    center[1],
    [
      [courtY - 0.45, 4.2],
      [courtY + 0.1, 4.2],
      [courtY + 0.35, 3.8],
      [courtY + 0.55, 3.8],
      [courtY + 0.7, 3.35],
    ],
    detail === 0 ? 6 : 12,
  );
  cylinder(
    'wall',
    center[0],
    center[1],
    [
      [courtY + 0.7, 0.9],
      [courtY + 1.1, 1.15],
      [courtY + 2.6, 0.6],
      [courtY + 2.85, 2.8],
      [courtY + 3.1, 2.4],
      [courtY + 3.2, 0.65],
      [courtY + 4.2, 0.45],
      [courtY + 4.4, 1.6],
      [courtY + 4.65, 1.4],
      [courtY + 5.2, 0.3],
    ],
    detail === 0 ? 4 : 8,
  );
  if (detail >= 2) {
    for (let i = 0; i < r.monastery.outline.length; i++) {
      const A = r.monastery.outline[i],
        B = r.monastery.outline[(i + 1) % r.monastery.outline.length],
        len = Math.hypot(B[0] - A[0], B[1] - A[1]);
      if (len < 5) continue;
      const ax = [(B[0] - A[0]) / len, (B[1] - A[1]) / len],
        out = [ax[1], -ax[0]],
        count = Math.floor(len / 4.5);
      for (let k = 0; k < count; k++) {
        const t = (k + 0.5) / count,
          center = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t],
          h = {
            center,
            axis: ax.map((v) => -v),
            depth: 1,
            shape: 'rect',
            width: 1.05,
            bottom: courtY + 8.8,
            height: 1.7,
          };
        const p = prepareOpening(h, 0, detail);
        f(
          'inset',
          p.ring.map((q) => p.point(...q, -0.025)),
          [out[0], 0, out[1]],
        );
        surround(h, 0.13, 'trim', -0.06);
      }
    }
  }
}
