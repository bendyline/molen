/** Browser derivatives of the authored Pont del Diable geometry; detailed master is separate. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { beam, cross, loft, normalFor } from './authored-structure-mesh.mjs';
import { hashEvidenceText } from './evidence-text-hash.mjs';
import { box, quad } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const frame = JSON.parse(
  readFileSync(structureSourcePath('n0031_pont_del_diable', 'map-frame.json')),
);
const elevation = JSON.parse(
  readFileSync(structureSourcePath('n0031_pont_del_diable', 'terrain-profile.json')),
);
const start = frame.geometry.centerlines[0][0][0],
  end = frame.geometry.centerlines[0].at(-1)[0];
const length = end - start;
const apex = (frame.summitPassage[0][0] + frame.summitPassage[1][0]) / 2;
const halfPassage = (frame.summitPassage[1][0] - frame.summitPassage[0][0]) / 2;
const red = [0.47, 0.31, 0.235],
  pale = [0.62, 0.56, 0.44],
  mortar = [0.41, 0.285, 0.22];
const metal = [0.1, 0.105, 0.09];
const rand = (s) => {
  const v = Math.sin(s * 71.23 + 17.43) * 21497.3;
  return v - Math.floor(v);
};
const tint = (s) => (rand(s) < 0.77 ? red : pale).map((v) => v + (rand(s * 11) - 0.5) * 0.085);
const mix = (a, b, t) => a + (b - a) * t;
function profile(points, x) {
  for (let i = 1; i < points.length; i++)
    if (x <= points[i][0]) {
      const a = points[i - 1],
        b = points[i];
      return mix(a[1], b[1], Math.max(0, (x - a[0]) / (b[0] - a[0])));
    }
  return points.at(-1)[1];
}
// Bank and stair heights derive from ICGC25cm LiDAR. The roof-occluded summit is interpolated.
const deckProfile = elevation.deckStations.map(([station, height]) => [
  start + station,
  height - elevation.originElevationMeters,
]);
const deck = (x) => profile(deckProfile, x);
const width = (x) =>
  profile(
    [
      [start, 6],
      [start + 34, 6],
      [start + 42, 4.7],
      [apex - 18.2, 3.9],
      [apex + 18.2, 3.9],
      [apex + 27.7, 5.6],
      [end - 8, 5.6],
      [end, 9],
    ],
    x,
  );
const base = (x) =>
  profile(
    [
      [start, 7.5],
      [start + 16, 4.8],
      [start + 35, 1],
      [start + 44, -1.2],
      [apex + 18.2, -1.2],
      [apex + 28, 2],
      [end, 11.9],
    ],
    x,
  );
const arches = [
  { x: apex - 32.4, rx: 8.2, h: 9.5, sy: 3, bottom: -1.2, ring: 0.82, pointed: true },
  { x: apex, rx: 18.2, h: 22.5, sy: 0, bottom: -1.2, ring: 0.86, pointed: true },
  { x: apex + 24.95, rx: 2.75, h: 2.75, sy: 10, bottom: 5.5, ring: 0.55 },
  { x: apex - 41.65, rx: 0.6, h: 0.6, sy: 7.3, bottom: 5.55, ring: 0.2 },
];
function archHeight(a, x, extra = 0) {
  const dx = Math.abs(x - a.x),
    r = a.rx + extra,
    h = a.h + extra;
  if (dx > r) return a.sy;
  if (!a.pointed) return a.sy + h * Math.sqrt(Math.max(0, 1 - (dx / r) ** 2));
  const radius = (r * r + h * h) / (2 * r);
  return a.sy + Math.sqrt(Math.max(0, radius * radius - (dx + radius - r) ** 2));
}
const archAt = (x, extra = false) =>
  arches.find((a) => Math.abs(x - a.x) < a.rx + (extra ? a.ring : 0) - 1e-7);
function clip(poly, signed) {
  const next = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      da = signed(a),
      db = signed(b);
    if (da >= 0) next.push(a);
    if (da < 0 !== db < 0) next.push(a.map((v, k) => v + ((b[k] - v) * da) / (da - db)));
  }
  return next;
}
// Convex stone prism, optionally with a chipped, raised face. gate maps the face across the road.

const MEANS = {
  sandstone: [0.6849383831581978, 0.6023767969729558, 0.46768227309766186],
  rawlimestone: [0.753900431769648, 0.7102426360381505, 0.6162437456625109],
  iron: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
  copper: [0.6357568684279634, 0.680368873795494, 0.6174688939562135],
};
function writer(out, far) {
  const tri = (s, p, c) => {
    p = p.map((v) => v.map(Math.fround));
    const a = p[1].map((v, i) => v - p[0][i]),
      b = p[2].map((v, i) => v - p[0][i]);
    if (Math.hypot(...cross(a, b)) < 1e-10) return;
    out.addTriangle(
      s,
      'palette:#ffffff',
      p,
      normalFor(...p),
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      far ? c.map((v, i) => v * (MEANS[s]?.[i] ?? 1)) : c,
    );
  };
  return {
    addTriangle(s, r, p, n, u, c) {
      tri(s, p, c);
    },
    addQuad(s, r, p, n, u, c) {
      tri(s, p.slice(0, 3), c);
      tri(s, [p[0], p[2], p[3]], c);
    },
    addConvexPolygon(s, r, p, n, u, c) {
      for (let i = 1; i < p.length - 1; i++) tri(s, [p[0], p[i], p[i + 1]], c);
    },
  };
}

function build(target, tier) {
  let coreStrip = false;
  function prism(out, poly, d0, d1, color = red, slot = 'sandstone', gate = false, bevel = 0) {
    const p = poly
      .map((q) => q.map(Math.fround))
      .filter(
        (q, i, all) =>
          Math.hypot(
            q[0] - all[(i + all.length - 1) % all.length][0],
            q[1] - all[(i + all.length - 1) % all.length][1],
          ) > 1e-5,
      );
    for (let i = p.length - 1; i >= 0 && p.length >= 3; i--) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length];
      if (Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) < 1e-7)
        p.splice(i, 1);
    }
    if (p.length < 3) return;
    const area = p.reduce(
      (sum, a, i) => sum + a[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * a[1],
      0,
    );
    if (Math.abs(area) < 1e-7) return;
    if (area < 0) p.reverse();
    const point = ([u, y], d) => (gate ? [d, y, -u] : [u, y, d]);
    const a = p.map((q) => point(q, typeof d0 === 'function' ? d0(q[0]) : d0));
    const b = p.map((q) => point(q, typeof d1 === 'function' ? d1(q[0]) : d1));
    for (const face of [a.toReversed(), b]) {
      const normal = normalFor(...face);
      if (!bevel)
        out.addConvexPolygon(slot, 'palette:#ffffff', face, normal, (q) => [q[0], q[1]], color);
      else {
        const center = face[0].map((_, k) => face.reduce((sum, q) => sum + q[k], 0) / face.length);
        const inner = face.map((q) =>
          q.map((v, k) => center[k] + (v - center[k]) * 0.89 + normal[k] * bevel),
        );
        out.addConvexPolygon(slot, 'palette:#ffffff', inner, normal, (q) => [q[0], q[1]], color);
        for (let i = 0; i < face.length; i++) {
          const j = (i + 1) % face.length,
            q = [face[i], face[j], inner[j], inner[i]];
          quad(
            out,
            slot,
            q,
            normalFor(...q),
            color.map((v) => v * 0.96),
          );
        }
      }
    }
    for (let i = 0; i < a.length; i++) {
      if (coreStrip && a.length === 4 && (i === 1 || i === 3)) continue;
      const j = (i + 1) % a.length,
        q = [a[i], a[j], b[j], b[i]];
      quad(out, slot, q, normalFor(...q), color);
    }
  }
  function ring(
    out,
    a,
    depth0,
    depth1,
    extra0,
    extra1,
    slot = 'sandstone',
    gate = false,
    count = [4, 8, 16, 40][tier],
  ) {
    for (let i = 0; i < count; i++) {
      const points = (t, extra) => {
        const x = a.x - (a.rx + extra) * Math.cos(Math.PI * t);
        return [x, archHeight(a, x, extra)];
      };
      const t0 = (i + 0.008) / count,
        t1 = (i + 0.992) / count;
      prism(
        out,
        [points(t0, extra0), points(t1, extra0), points(t1, extra1), points(t0, extra1)],
        depth0,
        depth1,
        slot === 'rawlimestone'
          ? pale.map((v) => v + (rand(i * 3) - 0.5) * 0.075)
          : tint(i * 31 + a.x),
        slot,
        gate,
      );
    }
  }
  function bridgeCore(out) {
    coreStrip = true;
    const cuts = [
      start,
      end,
      ...deckProfile
        .filter((p, i) => tier > 0 || i % 4 === 0 || i === deckProfile.length - 1)
        .map((p) => p[0]),
      ...arches.flatMap((a) => [a.x - a.rx, a.x, a.x + a.rx]),
      ...[start + 34, start + 42, apex - 18.2, apex + 18.2, apex + 27.7, end - 8],
      ...(tier === 0
        ? arches.flatMap((a) =>
            Array.from({ length: 7 }, (_, i) => a.x - a.rx + (2 * a.rx * i) / 6),
          )
        : []),
    ];
    for (let x = start; tier > 0 && x < end; x += [13, 5, 1, 0.4][tier]) cuts.push(x);
    const xs = [...new Set(cuts)].filter((x) => x >= start && x <= end).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) {
      const l = xs[i - 1],
        r = xs[i];
      if (r - l < 1e-5) continue;
      const a = archAt((l + r) / 2),
        lower0 = a ? Math.max(base(l), archHeight(a, l)) : base(l),
        lower1 = a ? Math.max(base(r), archHeight(a, r)) : base(r);
      prism(
        out,
        [
          [l, lower0],
          [r, lower1],
          [r, deck(r) - 0.11],
          [l, deck(l) - 0.11],
        ],
        (x) => -width(x) / 2 + 0.04,
        (x) => width(x) / 2 - 0.04,
        mortar,
      );
      if (a && a.bottom > Math.min(base(l), base(r))) {
        const poly = clip(
          [
            [l, base(l)],
            [r, base(r)],
            [r, a.bottom],
            [l, a.bottom],
          ],
          (p) => a.bottom - p[1],
        );
        prism(
          out,
          poly,
          (x) => -width(x) / 2 + 0.04,
          (x) => width(x) / 2 - 0.04,
          mortar,
        );
      }
    }
    // Double voussoir rows and a thin relieving arc are geometry, with a continuous deep intrados.
    coreStrip = false;
    for (const x of [start, end]) {
      const a = base(x),
        b = deck(x) - 0.11,
        z = width(x) / 2 - 0.04,
        points = [
          [x, a, -z],
          [x, b, -z],
          [x, b, z],
          [x, a, z],
        ];
      if (x === end) points.reverse();
      quad(out, 'sandstone', points, normalFor(...points), mortar);
    }
    if (tier > 0)
      for (const a of arches) {
        ring(
          out,
          a,
          (x) => -width(x) / 2 + 0.065,
          (x) => width(x) / 2 - 0.065,
          0,
          a.ring,
          'sandstone',
          false,
          [4, 8, 12, 52][tier],
        );
        if (tier > 1)
          for (const side of [-1, 1]) {
            const d0 = (x) => side * (width(x) / 2 - 0.02),
              d1 = (x) => side * (width(x) / 2 + 0.045);
            const lo = side < 0 ? d1 : d0,
              hi = side < 0 ? d0 : d1;
            ring(out, a, lo, hi, 0, a.ring * 0.49, 'sandstone', false, [3, 6, 8, 40][tier]);
            ring(out, a, lo, hi, a.ring * 0.51, a.ring, 'sandstone', false, [3, 6, 8, 40][tier]);
            if (a.rx > 7)
              ring(
                out,
                a,
                lo,
                hi,
                a.ring + 0.035,
                a.ring + 0.18,
                'sandstone',
                false,
                [3, 6, 8, 40][tier],
              );
            if (a.sy > a.bottom)
              for (const sign of [-1, 1])
                for (let y = a.bottom; y < a.sy; y += [4, 2, 1, 0.74][tier]) {
                  const x = a.x + sign * (a.rx + a.ring / 2);
                  prism(
                    out,
                    [
                      [x - a.ring / 2, y + 0.008],
                      [x + a.ring / 2, y + 0.008],
                      [x + a.ring / 2, Math.min(a.sy, y + [4, 2, 1, 0.74][tier] - 0.01)],
                      [x - a.ring / 2, Math.min(a.sy, y + [4, 2, 1, 0.74][tier] - 0.01)],
                    ],
                    lo,
                    hi,
                    tint(y * 23 + x),
                  );
                }
          }
      }
  }
  function masonry(out) {
    for (let row = 0, y = -1.2; y < deck(apex); row++, y += 1.02) {
      for (let x = start - (row % 2) * 1.41; x < end; ) {
        const span = 2.16 + rand(x * 17 + row * 31) * 1.08,
          left = Math.max(start, x + 0.013),
          right = Math.min(end, x + span - 0.013);
        x += span;
        if (right - left < 0.012) continue;
        // Split around the arch limits, preserving small high-level holes and solid masonry below them.
        const cuts = [
          left,
          right,
          ...arches
            .flatMap((a) => [a.x - a.rx - a.ring - 0.18, a.x, a.x + a.rx + a.ring + 0.18])
            .filter((v) => v > left && v < right),
        ].sort((a, b) => a - b);
        for (let j = 1; j < cuts.length; j++) {
          const l = cuts[j - 1],
            r = cuts[j],
            mid = (l + r) / 2;
          if (r - l < 1e-5) continue;
          const a = arches.find((a) => Math.abs(mid - a.x) < a.rx + a.ring + (a.rx > 7 ? 0.18 : 0));
          let p = [
            [l, y + 0.013],
            [r, y + 0.013],
            [r, y + 1.006],
            [l, y + 0.326],
          ];
          p = clip(p, (q) => q[1] - base(q[0]));
          p = clip(p, (q) => deck(q[0]) - 0.12 - q[1]);
          if (p.length < 3) continue;
          const pieces = a
            ? [
                clip(p, (q) => q[1] - archHeight(a, q[0], a.ring + (a.rx > 7 ? 0.18 : 0))),
                clip(p, (q) => a.bottom - q[1]),
              ]
            : [p];
          for (const piece of pieces)
            if (piece.length >= 3)
              for (const side of [-1, 1]) {
                const depth = (x) => (side * width(x)) / 2;
                prism(
                  out,
                  piece,
                  (x) => depth(x) - 0.025,
                  (x) => depth(x) + 0.025,
                  tint(row * 67 + x * 19 + side),
                  'sandstone',
                  false,
                  0,
                );
              }
        }
      }
    }
  }
  function pier(out) {
    const x = apex - 21.2,
      w = 3,
      n = [4, 8, 16, 24][tier],
      plans = [
        [
          [x - w, -1.95],
          [x, -5],
          [x + w, -1.95],
        ],
        Array.from({ length: n + 1 }, (_, i) => {
          const a = (Math.PI * i) / n;
          return [x + w * Math.cos(a), 1.95 + 2.6 * Math.sin(a)];
        }),
      ];
    for (const plan of plans)
      loft(
        out,
        'sandstone',
        [
          [-1.2, 1],
          [7, 1],
          [9.8, 0.12],
        ].map(([y, t]) =>
          plan
            .toReversed()
            .map(([u, z]) => [
              x + (u - x) * t,
              y,
              Math.sign(z) * 1.95 + (z - Math.sign(z) * 1.95) * t,
            ]),
        ),
        red,
      );
  }
  function walkingSurface(out) {
    // Tread elevations follow the hump. Broad shallow stone steps preserve a continuous walkable top.
    for (let s = start, i = 0; s < end - 4.2; i++) {
      const t = Math.min(
        end - 4.2,
        s +
          (s < start + 15 || s > end - 10 || Math.abs(s - apex) < halfPassage
            ? [10, 8, 2.6, 0.65][tier]
            : [10, 8, 2.6, 0.84][tier]),
      );
      const y = Math.max(deck(s), deck(t)),
        w = Math.min(width(s), width(t));
      const n = tier < 3 ? 1 : Math.max(2, Math.round(w / 1.4));
      for (let j = 0; j < n; j++)
        box(
          out,
          'rawlimestone',
          [s + 0.006, Math.min(deck(s), deck(t)) - 0.13, -w / 2 + (j * w) / n + 0.008],
          [t - 0.006, y, -w / 2 + ((j + 1) * w) / n - 0.008],
          pale.map((v) => v * (0.74 + rand(i * 13 + j * 7) * 0.15)),
        );
      s = t;
    }
    for (const side of [-1, 1]) {
      for (let s = start, i = 0; s < end - 2.8; i++) {
        const t = Math.min(end - 2.8, s + [15, 15, 3.5, 1.4][tier]),
          z0 = (side * width(s)) / 2,
          z1 = (side * width(t)) / 2;
        const y0 = deck(s),
          y1 = deck(t);
        // Modern iron guards continue above low stone curbwork; taller east approach masonry follows photographs.
        const curb = s > apex + 23 ? 0.64 : 0.28;
        for (let row = 0; row < (curb > 0.5 ? 2 : 1); row++) {
          const h = curb / (curb > 0.5 ? 2 : 1);
          prism(
            out,
            [
              [s + 0.007, y0 + row * h],
              [t - 0.007, y1 + row * h],
              [t - 0.007, y1 + (row + 1) * h - 0.014],
              [s + 0.007, y0 + (row + 1) * h - 0.014],
            ],
            (x) => (side * width(x)) / 2 - 0.2,
            (x) => (side * width(x)) / 2 + 0.2,
            tint(i * 29 + side),
          );
        }
        if (Math.abs((s + t) / 2 - apex) > halfPassage + 0.2) {
          for (const h of [0.72, 1.08])
            beam(out, 'iron', [s, y0 + h, z0], [t, y1 + h, z1], 0.025, 0.028, metal);
          if (i % 2 === 0) {
            beam(out, 'iron', [s, y0 + curb, z0], [s, y0 + 1.08, z0], 0.035, 0.035, metal);
            box(
              out,
              'iron',
              [s - 0.055, y0 + curb, z0 - 0.055],
              [s + 0.055, y0 + curb + 0.018, z0 + 0.055],
              metal,
            );
          }
        }
        s = t;
      }
    }
  }
  function portal(
    out,
    center,
    opening,
    spring,
    bottom,
    outerHalf,
    top,
    depth,
    slot,
    rough = false,
  ) {
    const a = { x: 0, rx: opening, sy: spring, h: opening, bottom };
    const d0 = center - depth / 2,
      d1 = center + depth / 2;
    for (let u = -outerHalf; u < outerHalf; u += [1.1, 0.5, 0.2, 0.12][tier]) {
      const v = Math.min(outerHalf, u + [1.1, 0.5, 0.2, 0.12][tier]),
        mid = (u + v) / 2;
      const lo = Math.abs(mid) < opening ? archHeight(a, u) : bottom;
      const hi = Math.abs(mid) < opening ? archHeight(a, v) : bottom;
      prism(
        out,
        [
          [u, lo],
          [v, hi],
          [v, top(v)],
          [u, top(u)],
        ],
        d0,
        d1,
        mortar,
        slot,
        true,
      );
    }
    ring(out, a, d0 - 0.02, d1 + 0.02, 0, 0.51, slot, true, [4, 8, 16, 24][tier]);
    for (const sign of [-1, 1])
      for (let y = bottom; y < spring; y += [6, 3, 1.2, 0.78][tier]) {
        const u = sign * (opening + 0.255);
        prism(
          out,
          [
            [u - 0.25, y + 0.005],
            [u + [2.08, 1.04, 0.52, 0.26][tier] - 0.01, y + 0.005],
            [u + 0.25, Math.min(spring, y + [6, 3, 1.2, 0.78][tier] - 0.012)],
            [u - 0.25, Math.min(spring, y + 0.378)],
          ],
          d0 - 0.035,
          d1 + 0.035,
          slot === 'rawlimestone' ? pale : tint(u + y * 37),
          slot,
          true,
        );
      }
  }
  function summitShelter(out) {
    const y = deck(apex),
      halfWidth = 1.95,
      top = (u) => y + 5.5 - 0.64 * Math.abs(u);
    for (const x of [apex - halfPassage, apex + halfPassage])
      portal(out, x, 1.05, y + 2.55, y, halfWidth, top, 0.56, 'sandstone');
    // Side walls leave the longitudinal passage empty; the stone gable roof has an actual underside.
    for (const side of [-1, 1]) {
      box(
        out,
        'sandstone',
        [apex - halfPassage + 0.3, y, side * 1.69 - 0.25],
        [apex + halfPassage - 0.3, y + 4.2, side * 1.69 + 0.25],
        red,
      );
      for (let u = 0; u < 2.08; u += [2.08, 1.04, 0.52, 0.26][tier]) {
        const v = Math.min(2.08, u + 0.25),
          z0 = side * u,
          z1 = side * v;
        const poly = [
          [Math.min(z0, z1), top(Math.min(z0, z1)) + 0.005],
          [Math.max(z0, z1), top(Math.max(z0, z1)) + 0.005],
          [Math.max(z0, z1), top(Math.max(z0, z1)) + 0.14],
          [Math.min(z0, z1), top(Math.min(z0, z1)) + 0.14],
        ];
        prism(
          out,
          poly,
          apex - halfPassage - 0.18,
          apex + halfPassage + 0.18,
          tint(u * 31),
          'sandstone',
          true,
        );
      }
    }
  }
  function romanGateway(out) {
    const x = end + 1.1,
      y = deck(x),
      h = 10.8;
    // The mapped stair ends at the gateway threshold; its documented base extends beyond the route.
    if (tier > 1)
      for (let row = 0; row < 4; row++)
        for (const side of [-1, 1])
          if (tier > 1)
            for (let xx = x - 5.3; xx < x + 5.3; xx += [5.3, 2.65, 1.44, 0.72][tier]) {
              box(
                out,
                'sandstone',
                [xx + 0.007, deck(xx) - 1.4 + row * 0.35, side * 4.5 - 0.18],
                [
                  Math.min(x + 5.3, xx + [5.3, 2.65, 1.44, 0.72][tier] - 0.013),
                  deck(xx) - 1.065 + row * 0.35,
                  side * 4.5 + 0.18,
                ],
                tint(xx * 17 + row * 31),
              );
            }
    prism(
      out,
      [
        [x - 5.3, deck(x - 5.3) - 1.5],
        [x + 5.3, deck(x + 5.3) - 1.5],
        [x + 5.3, deck(x + 5.3) - 0.13],
        [x - 5.3, deck(x - 5.3) - 0.13],
      ],
      -4.34,
      4.34,
      mortar,
    );
    if (tier > 1)
      for (let xx = x - 5.3; xx < x + 5.3; xx += 0.72)
        for (let z = -4.5; z < 4.5; z += [4.5, 2.25, 1.5, 0.75][tier]) {
          box(
            out,
            'rawlimestone',
            [
              xx + 0.009,
              Math.min(
                deck(xx),
                deck(Math.min(x + 5.3, xx + [5.3, 2.65, 1.44, 0.72][tier] - 0.01)),
              ) - 0.13,
              z + 0.009,
            ],
            [
              Math.min(x + 5.3, xx + 0.71),
              Math.max(deck(xx), deck(Math.min(x + 5.3, xx + 0.71))),
              Math.min(4.5, z + [4.5, 2.25, 1.5, 0.75][tier] - 0.01),
            ],
            pale.map((v) => v * 0.78),
          );
        }
    // The ruined core survives; conjectural Corinthian capitals and a complete Roman entablature are excluded.
    const crown = (u) => y + h - 0.13 * Math.abs(u) + 0.045 * Math.sin(u * 4.7);
    portal(out, x, 2.2, y + 6.0, y, 4.2, crown, 2.15, 'rawlimestone', true);
    for (const side of [-1, 1]) {
      const z = side * 3.02;
      for (const [height, w, d] of tier < 2
        ? [[0, 1.7, 2.95]]
        : [
            [0.0, 1.7, 2.95],
            [0.25, 1.52, 2.7],
            [0.43, 1.62, 2.8],
            [0.59, 1.33, 2.46],
            [1.12, 1.25, 2.34],
          ]) {
        box(
          out,
          'sandstone',
          [x - d / 2, y + height, z - w / 2],
          [x + d / 2, y + height + 0.18, z + w / 2],
          tint(height * 39 + side),
        );
      }
      for (let row = 0; row < (tier > 1 ? 5 : 0); row++)
        for (const face of [-1, 1]) {
          const xx = x + face * 1.2;
          box(
            out,
            'sandstone',
            [xx - 0.13, y + 1.3 + row * 0.41, z - 0.56],
            [xx + 0.13, y + 1.7 + row * 0.41, z + 0.56],
            tint(row * 31 + side),
          );
        }
    }
    // 2026 restoration documents a copper sheet over the surviving crown, without reconstructing lost stone.
    for (let u = -4.2; u < 4.2; u += [2.1, 1.05, 0.42, 0.21][tier]) {
      const v = Math.min(4.2, u + [2.1, 1.05, 0.42, 0.21][tier]);
      prism(
        out,
        [
          [u, crown(u) + 0.012],
          [v, crown(v) + 0.012],
          [v, crown(v) + 0.031],
          [u, crown(u) + 0.031],
        ],
        x - 1.11,
        x + 1.11,
        [0.34, 0.17, 0.08],
        'copper',
        true,
      );
    }
  }
  function geometry(out) {
    // LiDAR roof edges put the actual crossing approximately1m north of the mapped path.
    const target = out;
    out = Object.fromEntries(
      ['addTriangle', 'addQuad', 'addConvexPolygon'].map((method) => [
        method,
        (slot, ref, points, ...rest) =>
          target[method](
            slot,
            ref,
            points.map(([x, y, z]) => [x, y, z - 1]),
            ...rest,
          ),
      ]),
    );
    bridgeCore(out);
    if (tier === 3) masonry(out);
    pier(out);
    if (tier > 0) walkingSurface(out);
    summitShelter(out);
    romanGateway(out);
    // The inventory records a blocked segmental arch on the north face of the east abutment.
    const blocked = { x: apex + 31.8, rx: 1.65, h: 1.05, sy: 5.2, bottom: 2.8 };
    if (tier > 0)
      ring(out, blocked, -2.9, -2.79, 0, 0.42, 'sandstone', false, [3, 6, 16, 24][tier]);
  }

  geometry(writer(target, tier === 0));
}
export const buildPontSkyline = (o) => build(o, 0),
  buildPontDistrict = (o) => build(o, 1),
  buildPontStreet = (o) => build(o, 2),
  buildPontCloseup = (o) => build(o, 3);
