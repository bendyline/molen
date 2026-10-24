/** 'metekhi_church': mapped Metekhi stone body, three apses, arcaded drum and north porch. */

import { normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, openingShape, prepareOpening } from './authored-wall-openings.mjs';
import { box, prism, rect } from './khmer-structure-geometry.mjs';

const sign = (ring) =>
  Math.sign(
    ring.reduce((s, p, i) => {
      const q = ring[(i + 1) % ring.length];
      return s + p[0] * q[1] - q[0] * p[1];
    }, 0),
  );
const center = (ring) => [0, 1].map((k) => ring.reduce((s, p) => s + p[k], 0) / ring.length);
const inset = (ring, t) => {
  const c = center(ring);
  return ring.map((p) => p.map((v, k) => c[k] + (v - c[k]) * t));
};
function frame(ring, i) {
  const a = ring[i],
    b = ring[(i + 1) % ring.length],
    length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    axis = [(b[0] - a[0]) / length, (b[1] - a[1]) / length],
    sgn = sign(ring);
  return {
    center: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
    axis,
    normal: [axis[1] * sgn, -axis[0] * sgn],
    length,
  };
}
function hole(ring, i, p) {
  const f = frame(ring, i),
    offset = p.offset ?? 0;
  return {
    ...f,
    ...p,
    center: f.center.map((v, k) => v + f.axis[k] * offset),
    depth: 2.2,
    thickness: p.thickness ?? 0.9,
  };
}
function band(f, h, detail, w = 0.15, role = 'trim', offset = 0.025) {
  const inner = openingShape(h, detail),
    outer = openingShape(
      {
        ...h,
        width: h.width + 2 * w,
        height: h.height + 2 * w,
        bottom: h.bottom - w,
        spring: (h.spring ?? h.height) + w,
      },
      detail,
    ),
    p = prepareOpening(h, 0, detail),
    sgn = Math.sign(p.normal[0] * h.normal[0] + p.normal[1] * h.normal[1]);
  for (let i = 0; i < inner.length; i++) {
    const j = (i + 1) % inner.length;
    f(
      role,
      [
        p.point(...outer[i], offset * sgn),
        p.point(...outer[j], offset * sgn),
        p.point(...inner[j], offset * sgn),
        p.point(...inner[i], offset * sgn),
      ],
      [h.normal[0], 0, h.normal[1]],
    );
  }
}
export function buildMetekhiChurch(face, detail, r, sampleTerrain) {
  const a = r.architecturalAngleRadians,
    c = Math.cos(a),
    s = Math.sin(a),
    floor = r.floorY,
    grade = (x, z) => sampleTerrain(c * x - s * z, s * x + c * z) - floor,
    f = (role, ps, n) => {
      if (detail === 0 && n[1] < -0.5) return;
      face(
        role,
        ps.map(([x, y, z]) => [c * x - s * z, y + floor, s * x + c * z]),
        [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
      );
    };
  const parent = r.parent.polygons[0].outline,
    bottom =
      Math.min(
        ...parent.flatMap((a, i) => {
          const b = parent[(i + 1) % parent.length],
            n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2);
          return Array.from({ length: n + 1 }, (_, k) =>
            grade(a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n),
          );
        }),
      ) - 0.65;
  prism(f, 'wall', { outline: parent, holes: [] }, bottom, 0.06);
  function wall(ring, lo, hi, holes, role = 'wall', innerScale = 0.88) {
    const visible = holes.filter((h) => detail >= 2 || h.critical || (detail === 1 && h.district)),
      prepared = visible.map((h) => prepareOpening(h, 0, detail)),
      raw = { addTriangle: (slot, _ref, ps, n) => f(slot, ps, n) },
      cut = openingBuilder(raw, prepared),
      emit = (role, ps, n) => {
        for (let i = 1; i < ps.length - 1; i++) {
          const tri = [ps[0], ps[i], ps[i + 1]];
          if (Math.hypot(...normalFor(...tri)) < 0.5) continue;
          cut.addTriangle(role, 'palette:#ffffff', tri, n, [], []);
        }
      };
    prism(emit, role, { outline: ring, holes: [inset(ring, innerScale)] }, lo, hi);
    for (const h of holes) {
      const shown = detail >= 2 || h.critical || (detail === 1 && h.district),
        p = prepareOpening(h, 0, detail),
        sgn = Math.sign(p.normal[0] * h.normal[0] + p.normal[1] * h.normal[1]);
      if (shown) {
        for (let i = 0; i < p.ring.length; i++) {
          const j = (i + 1) % p.ring.length,
            [u, v] = p.ring[i],
            [w, y] = p.ring[j];
          f(
            role,
            [
              p.point(u, v, 0.015 * sgn),
              p.point(w, y, 0.015 * sgn),
              p.point(w, y, -h.thickness * sgn),
              p.point(u, v, -h.thickness * sgn),
            ],
            [-(y - v) * h.axis[0], w - u, -(y - v) * h.axis[1]],
          );
        }
      }
      if (h.pane && (shown || detail === 1 || h.sky)) {
        const offset = (shown ? -0.55 : 0.018) * sgn;
        f(
          h.pane,
          openingShape(h, detail).map((q) => p.point(...q, offset)),
          [h.normal[0], 0, h.normal[1]],
        );
      }
      if (detail >= 1 && h.frame !== false)
        band(f, h, detail, h.critical ? 0.22 : 0.13, h.critical ? 'trim' : 'brick', 0.035);
      if (detail >= 3 && h.critical) band(f, h, detail, 0.36, 'brick', 0.05);
    }
    return emit;
  }
  const body = r.body.polygons[0].outline;
  const bodyHoles = [
    ...[-2.8, 0.8].map((offset) =>
      hole(body, 0, {
        offset,
        bottom: 4.0,
        width: 0.65,
        height: 2.2,
        spring: 1.75,
        shape: 'round',
        pane: 'inset',
        sky: true,
        district: true,
      }),
    ),
    ...[-4.6, 3.2].map((offset) =>
      hole(body, 3, {
        offset,
        bottom: 1.2,
        width: 0.6,
        height: 1.4,
        spring: 1.1,
        shape: 'round',
        pane: 'inset',
      }),
    ),
    hole(body, 3, {
      bottom: 10.4,
      width: 0.46,
      height: 2.05,
      spring: 1.7,
      shape: 'round',
      pane: 'inset',
      sky: true,
    }),
    hole(body, 0, {
      bottom: 11.2,
      width: 0.42,
      height: 1.7,
      spring: 1.4,
      shape: 'round',
      pane: 'inset',
    }),
    hole(body, 2, {
      bottom: 11.7,
      width: 0.4,
      height: 1.5,
      spring: 1.2,
      shape: 'round',
      pane: 'inset',
    }),
    hole(body, 2, {
      offset: -5.2,
      bottom: 5.4,
      width: 0.43,
      height: 2.3,
      spring: 1.9,
      shape: 'round',
      pane: 'inset',
    }),
    hole(body, 2, {
      offset: 0.12,
      bottom: 0,
      width: 1.9,
      height: 3.4,
      spring: 2.45,
      shape: 'round',
      pane: 'door',
      critical: true,
    }),
  ];
  const bw = wall(body, 0, r.body.height, bodyHoles),
    bc = center(body),
    roofCenter = [bc[0], r.body.ridge, bc[1]];
  for (let i = 0; i < body.length; i++) {
    const j = (i + 1) % body.length,
      mid = [(body[i][0] + body[j][0]) / 2, r.body.ridge, (body[i][1] + body[j][1]) / 2],
      a = [body[i][0], r.body.height, body[i][1]],
      b = [body[j][0], r.body.height, body[j][1]],
      n = frame(body, i).normal;
    f('roof', [a, mid, roofCenter], [0, 1, 0]);
    f('roof', [mid, b, roofCenter], [0, 1, 0]);
    bw('wall', [a, b, mid], [n[0], 0, n[1]]);
    if (detail >= 1) {
      for (const side of [
        [a, mid],
        [mid, b],
      ]) {
        const p = side.map((q) => [q[0] + n[0] * 0.1, q[1] + 0.02, q[2] + n[1] * 0.1]);
        f(
          'brick',
          [p[0], p[1], [p[1][0], p[1][1] - 0.22, p[1][2]], [p[0][0], p[0][1] - 0.22, p[0][2]]],
          [n[0], 0, n[1]],
        );
      }
    }
  }
  for (const q of r.apses) {
    const ring = q.polygons[0].outline,
      edges = ring
        .map((_, i) => ({ ...frame(ring, i), i }))
        .sort((a, b) => b.center[1] - a.center[1]),
      middle = q.owner === 35185579262556,
      selected = middle ? edges.slice(0, 3) : edges.slice(0, 1),
      holes = [];
    for (const e of selected) {
      holes.push(
        hole(ring, e.i, {
          bottom: middle ? 4.2 : 4,
          width: middle ? 0.43 : 0.7,
          height: middle ? 1.8 : 2.4,
          spring: middle ? 1.8 : 1.95,
          shape: middle ? 'rect' : 'round',
          pane: 'inset',
          sky: true,
          thickness: 0.7,
          district: e.i === edges[0].i,
        }),
      );
      if (!middle)
        holes.push(
          hole(ring, e.i, {
            bottom: 1.2,
            width: 0.5,
            height: 1.1,
            shape: 'rect',
            pane: 'inset',
            thickness: 0.7,
          }),
        );
    }
    const emit = wall(ring, 0, q.height, holes, 'wall', 0.72),
      back = ring.toSorted((a, b) => a[1] - b[1]).slice(0, 2),
      apex = [
        (back[0][0] + back[1][0]) / 2,
        q.height + q.roofRise,
        Math.min(...back.map((p) => p[1])),
      ];
    const lip = inset(ring, 1.025);
    prism(
      emit,
      'brick',
      { outline: lip, holes: [inset(ring, 0.95)] },
      q.height - 0.28,
      q.height + 0.08,
    );
    for (let i = 0; i < ring.length; i++) {
      const j = (i + 1) % ring.length;
      f(
        'roof',
        [[lip[i][0], q.height + 0.08, lip[i][1]], [lip[j][0], q.height + 0.08, lip[j][1]], apex],
        [0, 1, 0],
      );
    }
    if (detail >= 2 && middle)
      for (const h of holes) {
        band(f, h, detail, 0.3, 'trim', 0.055);
        const p = prepareOpening(
            { ...h, bottom: h.bottom - 1.35, width: 0.8, height: 0.85 },
            0,
            detail,
          ),
          sgn = Math.sign(p.normal[0] * h.normal[0] + p.normal[1] * h.normal[1]),
          lozenge = [
            [-0.42, h.bottom - 1.1],
            [0, h.bottom - 0.65],
            [0.42, h.bottom - 1.1],
            [0, h.bottom - 1.6],
          ];
        f(
          'trim',
          lozenge.map((q) => p.point(...q, 0.06 * sgn)),
          [h.normal[0], 0, h.normal[1]],
        );
      }
  }
  const porch = r.porch.polygons[0].outline,
    ph = [
      hole(porch, 0, {
        bottom: 0,
        width: 2.4,
        height: 3.8,
        spring: 2.6,
        shape: 'round',
        critical: true,
        frame: false,
      }),
      ...[1, 3].map((i) =>
        hole(porch, i, {
          bottom: 0,
          width: 3.6,
          height: 4.3,
          spring: 2.8,
          shape: 'pointed',
          critical: true,
        }),
      ),
      ...[-1.6, 1.5].map((offset) =>
        hole(porch, 2, {
          offset,
          bottom: 1.8,
          width: 0.55,
          height: 1.5,
          spring: 1.15,
          shape: 'round',
          pane: 'inset',
        }),
      ),
    ],
    pw = wall(porch, 0, r.porch.height, ph, 'wall', 0.76),
    z = r.porch.center[1],
    x0 = Math.min(...porch.map((p) => p[0])),
    x1 = Math.max(...porch.map((p) => p[0])),
    z0 = Math.min(...porch.map((p) => p[1])),
    z1 = Math.max(...porch.map((p) => p[1]));
  f(
    'roof',
    [
      [x0, 5, z0],
      [x1, 5, z0],
      [x1, 7.4, z],
      [x0, 7.4, z],
    ],
    [0, 1, -1],
  );
  f(
    'roof',
    [
      [x0, 7.4, z],
      [x1, 7.4, z],
      [x1, 5, z1],
      [x0, 5, z1],
    ],
    [0, 1, 1],
  );
  pw(
    'brick',
    [
      [x1, 5, z0],
      [x1, 5, z1],
      [x1, 7.4, z],
    ],
    [1, 0, 0],
  );
  for (const side of [-1, 1])
    for (let i = 0; i < (detail === 0 ? 2 : 3); i++) {
      const v = side < 0 ? z0 - (i + 0.5) * 0.42 : z1 + (i + 0.5) * 0.42,
        top = 0.04 - i * 0.18,
        p = rect(r.porch.center[0], v, 3.1, 0.44);
      prism(f, 'trim', p, Math.min(bottom, grade(r.porch.center[0], v) - 0.5), top);
    }
  const d = r.drum,
    ring = d.polygons[0].outline,
    dc = center(ring),
    windows = ring.map((_, i) =>
      hole(ring, i, {
        bottom: 15.5,
        width: 0.42,
        height: 2.4,
        spring: 2.0,
        shape: 'round',
        pane: 'inset',
        sky: i % 3 === 0,
        district: i % 3 === 0,
        thickness: 0.72,
      }),
    );
  prism(f, 'brick', { outline: ring, holes: [] }, d.bottom, d.low);
  wall(ring, d.low, d.high, windows, 'brick', 0.8);
  if (detail >= 1)
    for (let i = 0; i < ring.length; i++) {
      const ff = frame(ring, i),
        h = hole(ring, i, {
          bottom: d.low + 0.35,
          width: Math.min(1.4, ff.length - 0.3),
          height: d.high - d.low - 0.5,
          spring: d.high - d.low - 1.3,
          shape: 'round',
        });
      band(f, h, detail, 0.16, 'trim', 0.045);
    }
  prism(
    f,
    'trim',
    { outline: inset(ring, 1.045), holes: [inset(ring, 0.96)] },
    d.high - 0.22,
    d.high + 0.1,
  );
  const lip = inset(ring, 1.09);
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length,
      peak = [dc[0], d.coneTop, dc[1]];
    f(
      'roof',
      [[lip[i][0], d.high + 0.1, lip[i][1]], [lip[j][0], d.high + 0.1, lip[j][1]], peak],
      [0, 1, 0],
    );
    if (detail >= 2) {
      const p = lip[i],
        q = lip[j],
        m = [p[0] + (q[0] - p[0]) * 0.02, p[1] + (q[1] - p[1]) * 0.02];
      f(
        'roof',
        [
          [p[0], d.high + 0.13, p[1]],
          [m[0], d.high + 0.13, m[1]],
          [dc[0] + 0.015, d.coneTop + 0.01, dc[1]],
          [dc[0], d.coneTop + 0.01, dc[1]],
        ],
        [0, 1, 0],
      );
    }
  }
  box(f, 'gold', dc[0], d.coneTop, dc[1], 0.09, d.crossTop - d.coneTop, 0.09);
  box(f, 'gold', dc[0], d.crossTop - 0.48, dc[1], 0.76, 0.08, 0.1);
  if (detail >= 2) box(f, 'gold', dc[0], d.crossTop - 0.77, dc[1], 0.42, 0.07, 0.1);
}
