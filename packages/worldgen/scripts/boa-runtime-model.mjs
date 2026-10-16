/** One Bryant Park: signed crystal facets, offset spire, bamboo canopy and retained theatre. */
import { readFileSync } from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import {
  face,
  lerp,
  localOutline,
  mappedCap,
  mappedSolid,
  panel,
  partPlan,
  tri,
} from './signature-tower-expansion-models.mjs';
import { box, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const key = 'n0165_bank_of_america_tower',
  map = JSON.parse(readFileSync(structureSourcePath(key, 'map-frame.json'))),
  scope = JSON.parse(readFileSync(structureSourcePath(key, 'review-scope.json')));
const settings = {
  source: {
    dx: 1.52,
    dy: 4.4196,
    border: true,
    detail: true,
    rails: true,
    mast: 24,
    arch: 20,
    archFrames: true,
    urn: 16,
    medallion: 20,
  },
  closeup: {
    dx: 1.52,
    dy: 4.4196,
    border: true,
    detail: true,
    rails: true,
    mast: 24,
    arch: 20,
    archFrames: true,
    urn: 16,
    medallion: 20,
  },
  street: {
    dx: 3.04,
    dy: 4.4196,
    border: true,
    detail: false,
    rails: false,
    mast: 16,
    arch: 12,
    archFrames: true,
    urn: 12,
    medallion: 12,
  },
  district: {
    dx: 18.24,
    dy: 26.5176,
    border: false,
    detail: false,
    rails: false,
    mast: 8,
    arch: 6,
    archFrames: false,
    urn: 6,
    medallion: 6,
  },
  skyline: {
    dx: 0,
    dy: 0,
    border: false,
    detail: false,
    rails: false,
    mast: 6,
    arch: 4,
    archFrames: false,
    urn: 4,
    medallion: 4,
  },
};
function cleanPlan(plan, tolerance = 0.12) {
  const p = plan.map((q) => q.slice());
  let changed = true;
  while (changed && p.length > 3) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        d = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (
        d > 0 &&
        Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / d < tolerance &&
        (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) >= 0
      ) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return p;
}
function edges(plan) {
  return plan
    .map((a, i) => {
      const b = plan[(i + 1) % plan.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return { a, b, len, n: [-(b[1] - a[1]) / len, 0, (b[0] - a[0]) / len] };
    })
    .filter((e) => e.len > 0.03);
}
function facetedGlazing(out, polygon, { dx, dy, tint, trim, border }) {
  const normal = normalFor(polygon[0], polygon[1], polygon[2]),
    horizontal = Math.hypot(normal[0], normal[2]);
  if (horizontal < 0.0001) {
    const plan = polygon.map((p) => [p[0], p[2]]);
    mappedCap(out, 'metal', plan, polygon[0][1], [0.46, 0.5, 0.5]);
    return;
  }
  const u = [normal[2] / horizontal, 0, -normal[0] / horizontal],
    d = polygon[0].reduce((s, v, i) => s + v * normal[i], 0);
  const uv = polygon.map((p) => [p[0] * u[0] + p[2] * u[2], p[1]]);
  const world = ([a, b]) => {
    const t = (d - normal[1] * b) / (horizontal * horizontal);
    return [a * u[0] + t * normal[0], b, a * u[2] + t * normal[2]];
  };
  const clip = (poly, axis, bound, sign) => {
    const result = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i],
        b = poly[(i + 1) % poly.length],
        da = (a[axis] - bound) * sign,
        db = (b[axis] - bound) * sign;
      if (da >= -1e-8) result.push(a);
      if ((da > 1e-8 && db < -1e-8) || (da < -1e-8 && db > 1e-8))
        result.push(lerp(a, b, da / (da - db)));
    }
    return result.filter(
      (p, i, a) =>
        Math.hypot(p[0] - a[(i + 1) % a.length][0], p[1] - a[(i + 1) % a.length][1]) > 1e-5,
    );
  };
  const x0 = dx ? Math.floor(Math.min(...uv.map((p) => p[0])) / dx) : 0,
    x1 = dx ? Math.ceil(Math.max(...uv.map((p) => p[0])) / dx) : -1;
  const y0 = dy ? Math.floor(Math.min(...uv.map((p) => p[1])) / dy) : 0,
    y1 = dy ? Math.ceil(Math.max(...uv.map((p) => p[1])) / dy) : -1;
  const safeTri = (slot, p, color) => {
    const f = p.map((q) => q.map(Math.fround)),
      a = f[1].map((v, i) => v - f[0][i]),
      b = f[2].map((v, i) => v - f[0][i]);
    if (
      Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]) >
      1e-6
    )
      tri(out, slot, f, color);
  };
  // One glass facet and its frames as strips clipped to it, just proud of the glass, instead of
  // an inset pane and frame ring per cell. Strip widths match the old 0.957 / 0.978 cell insets.
  const fill = (poly, slot, color, lift = 0) => {
    if (poly.length < 3) return;
    const points = poly.map((v) => world(v).map((x, i) => x + normal[i] * lift));
    for (const ids of ShapeUtils.triangulateShape(
      poly.map((v) => new Vector2(...v)),
      [],
    )) {
      let t = ids.map((i) => points[i]);
      if (normalFor(...t).reduce((s, v, i) => s + v * normal[i], 0) < 0) t = t.toReversed();
      safeTri(slot, t, color);
    }
  };
  fill(uv, 'glass', tint);
  const wx = 0.045,
    wy = dy > 5 ? 0.5 : 0.19;
  for (let x = x0; x <= x1; x++)
    fill(clip(clip(uv, 0, x * dx - wx, 1), 0, x * dx + wx, -1), 'metal', trim, 0.02);
  for (let y = y0; y <= y1; y++)
    fill(clip(clip(uv, 1, y * dy - wy, 1), 1, y * dy + wy, -1), 'metal', trim, 0.02);
  // The facet's own edges carry the frame of the cells they cut.
  const winding = Math.sign(
    uv.reduce(
      (s, p, i) => s + p[0] * uv[(i + 1) % uv.length][1] - p[1] * uv[(i + 1) % uv.length][0],
      0,
    ),
  );
  for (let i = 0; border && i < uv.length; i++) {
    const a = uv[i],
      b = uv[(i + 1) % uv.length],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 1e-5) continue;
    const across = Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]) ? wy : wx;
    const inward = [
      (-(b[1] - a[1]) / length) * winding * across,
      ((b[0] - a[0]) / length) * winding * across,
    ];
    fill(
      [a, b, [b[0] + inward[0], b[1] + inward[1]], [a[0] + inward[0], a[1] + inward[1]]],
      'metal',
      trim,
      0.02,
    );
  }
}

function theatreFrontage(out, cx, c) {
  const w = 85.9 * 0.3048,
    z = -31.1,
    clay = [0.48, 0.23, 0.17],
    cream = [0.83, 0.78, 0.65],
    dark = [0.07, 0.09, 0.09];
  box(out, 'stone', [cx - w / 2, 0, z], [cx + w / 2, 0.4, z + 0.55], [0.38, 0.4, 0.38]);
  box(out, 'concrete', [cx - w / 2, 0.4, z], [cx + w / 2, 4.15, z + 0.55], cream);
  box(out, 'brick', [cx - w / 2, 4.15, z], [cx + w / 2, 13.1, z + 0.55], clay);
  const arch = (x, y, width, height, glazed) => {
    const r = width / 2,
      spring = y + height - r;
    box(
      out,
      glazed ? 'glass' : 'recess',
      [x - r, y, z - 0.05],
      [x + r, spring, z - 0.015],
      glazed ? [0.13, 0.17, 0.17] : [0.21, 0.12, 0.1],
    );
    for (let i = 0; i < c.arch; i++) {
      const a = (Math.PI * i) / c.arch,
        b = (Math.PI * (i + 1)) / c.arch;
      tri(
        out,
        glazed ? 'glass' : 'recess',
        [
          [x, spring, z - 0.06],
          [x + r * Math.cos(b), spring + r * Math.sin(b), z - 0.06],
          [x + r * Math.cos(a), spring + r * Math.sin(a), z - 0.06],
        ],
        [0.14, 0.17, 0.17],
      );
      if (c.archFrames)
        beam(
          out,
          'concrete',
          [x + (r + 0.11) * Math.cos(a), spring + (r + 0.11) * Math.sin(a), z - 0.13],
          [x + (r + 0.11) * Math.cos(b), spring + (r + 0.11) * Math.sin(b), z - 0.13],
          0.15,
          0.17,
          cream,
        );
    }
    box(
      out,
      'concrete',
      [x - r - 0.22, y - 0.14, z - 0.17],
      [x + r + 0.22, y + 0.04, z - 0.04],
      cream,
    );
    box(
      out,
      'concrete',
      [x - 0.14, y + height - 0.12, z - 0.25],
      [x + 0.14, y + height + 0.28, z - 0.03],
      cream,
    );
    if (glazed && c.detail) {
      for (const dx of c.detail ? [-0.5, 0, 0.5] : [])
        beam(
          out,
          'metal',
          [x + dx, y, z - 0.09],
          [x + dx, spring + 0.72, z - 0.09],
          0.04,
          0.055,
          dark,
        );
      for (let hy = y + 0.6; hy < spring + 0.1; hy += 0.55)
        beam(out, 'metal', [x - r, hy, z - 0.09], [x + r, hy, z - 0.09], 0.04, 0.055, dark);
    }
  };
  for (let i = -2; i <= 2; i++) {
    const x = cx + i * 3.45;
    box(out, 'recess', [x - 1.12, 0.42, z - 0.035], [x + 1.12, 3.55, z - 0.01], dark);
    for (const dx of c.detail ? [-1.04, 0, 1.04] : [])
      beam(
        out,
        'metal',
        [x + dx, 0.43, z - 0.08],
        [x + dx, 3.5, z - 0.08],
        0.07,
        0.07,
        [0.32, 0.33, 0.28],
      );
    box(out, 'concrete', [x - 1.35, 3.55, z - 0.22], [x + 1.35, 3.83, z - 0.02], cream);
    panel(
      out,
      [
        [x + 1, 4.75, z - 0.08],
        [x - 1, 4.75, z - 0.08],
        [x - 1, 7.06, z - 0.08],
        [x + 1, 7.06, z - 0.08],
      ],
      [0.13, 0.17, 0.17],
      0.07,
      dark,
    );
    for (const dx of c.detail ? [-0.5, 0, 0.5] : [])
      beam(out, 'metal', [x + dx, 4.75, z - 0.11], [x + dx, 7.06, z - 0.11], 0.04, 0.055, dark);
    for (const y of c.detail ? [5.33, 5.9, 6.48] : [])
      beam(out, 'metal', [x - 1, y, z - 0.11], [x + 1, y, z - 0.11], 0.04, 0.055, dark);
    arch(x, 8.05, 2.05, 3.25, Math.abs(i) < 2);
    for (const y of c.rails ? [4.43, 5.18] : [])
      beam(out, 'metal', [x - 1.45, y, z - 0.45], [x + 1.45, y, z - 0.45], 0.05, 0.055, dark);
    for (let dx = -1.4; c.rails && dx <= 1.41; dx += 0.46)
      beam(out, 'metal', [x + dx, 4.43, z - 0.45], [x + dx, 5.18, z - 0.45], 0.028, 0.033, dark);
  }
  for (const dx of [-8.625, -5.175, -1.725, 1.725, 5.175, 8.625]) {
    box(out, 'brick', [cx + dx - 0.21, 4.2, z - 0.17], [cx + dx + 0.21, 12.8, z - 0.02], clay);
    box(out, 'concrete', [cx + dx - 0.37, 4.05, z - 0.3], [cx + dx + 0.37, 4.45, z + 0.01], cream);
    box(
      out,
      'concrete',
      [cx + dx - 0.42, 12.65, z - 0.35],
      [cx + dx + 0.42, 13.15, z + 0.01],
      cream,
    );
    for (let x = -0.32; c.detail && x < 0.33; x += 0.32)
      tube(
        out,
        'concrete',
        [cx + dx + x, 12.6, z - 0.35],
        [cx + dx + x, 13.13, z - 0.35],
        0.046,
        cream,
        8,
      );
  }
  for (const sign of [-1, 1]) {
    const x = cx + sign * 10.85;
    arch(x, 0.48, 2.85, 3.2, false);
    arch(x, 5.25, 2.1, 3.7, false);
    loft(
      out,
      'concrete',
      [
        [5.32, 0.3],
        [5.55, 0.28],
        [5.65, 0.18],
        [6.25, 0.52],
        [6.58, 0.37],
        [6.73, 0.43],
        [6.85, 0.23],
        [7.15, 0.1],
      ].map(([y, r]) => radialRing(y, r, r, c.urn, [x, z - 0.31])),
      cream,
    );
    tube(out, 'concrete', [x, 10.95, z - 0.15], [x, 10.95, z - 0.28], 0.69, cream, c.medallion);
    for (const sx of [-1, 1])
      box(
        out,
        'metal',
        [x + sx * 1.75 - 0.13, 2.8, z - 0.35],
        [x + sx * 1.75 + 0.13, 3.45, z - 0.1],
        dark,
      );
    for (let i = 0; i < 2; i++)
      beam(
        out,
        'concrete',
        [x + (i === 0 ? -1.9 : 0), 14.35 + (i === 0 ? 0 : 1.13), z - 0.22],
        [x + (i === 0 ? 0 : 1.9), 14.35 + (i === 0 ? 1.13 : 0), z - 0.22],
        0.3,
        0.35,
        cream,
      );
  }
  for (const [y, h, projection] of [
    [13.12, 0.65, 0.22],
    [13.77, 0.16, 0.41],
    [13.93, 0.13, 0.48],
    [14.06, 0.22, 0.31],
  ])
    box(out, 'concrete', [cx - w / 2, y, z - projection], [cx + w / 2, y + h, z + 0.05], cream);
  for (let x = cx - w / 2 + 0.12; c.detail && x < cx + w / 2; x += 0.56)
    box(out, 'concrete', [x, 13.57, z - 0.32], [x + 0.14, 13.78, z - 0.12], cream);
  box(out, 'brick', [cx - w / 2, 14.28, z], [cx + w / 2, 14.95, z + 0.45], clay);
  box(out, 'concrete', [cx - w / 2, 14.95, z - 0.08], [cx + w / 2, 15.11, z + 0.5], cream);
  box(out, 'metal', [cx - 5.55, 3.38, z - 2.1], [cx + 5.55, 3.86, z - 0.15], [0.18, 0.21, 0.2]);
  for (const x of [cx - 5, cx + 5])
    tube(out, 'metal', [x, 3.72, z - 1.9], [x, 5.1, z - 0.08], 0.028, [0.33, 0.34, 0.3], 8);
}

function skylineTheatre(out) {
  const cx = -35,
    z = -31.1,
    w = 26.18232,
    clay = [0.48, 0.23, 0.17],
    cream = [0.83, 0.78, 0.65],
    dark = [0.13, 0.17, 0.17];
  box(out, 'stone', [cx - w / 2, 0, z], [cx + w / 2, 0.4, z + 0.55], [0.38, 0.4, 0.38]);
  box(out, 'concrete', [cx - w / 2, 0.4, z], [cx + w / 2, 4.15, z + 0.55], cream);
  box(out, 'brick', [cx - w / 2, 4.15, z], [cx + w / 2, 15, z + 0.55], clay);
  box(out, 'concrete', [cx - w / 2, 13.12, z - 0.48], [cx + w / 2, 14.28, z + 0.55], cream);
  for (let i = -2; i <= 2; i++) {
    const x = cx + i * 3.45;
    for (const [lo, hi, r] of [
      [0.42, 3.55, 1.12],
      [4.75, 7.06, 1],
    ])
      face(
        out,
        'glass',
        [
          [x + r, lo, z - 0.06],
          [x - r, lo, z - 0.06],
          [x - r, hi, z - 0.06],
          [x + r, hi, z - 0.06],
        ],
        dark,
      );
    const r = 1.025,
      spring = 10.275,
      color = Math.abs(i) < 2 ? dark : [0.21, 0.12, 0.1];
    face(
      out,
      Math.abs(i) < 2 ? 'glass' : 'recess',
      [
        [x + r, 8.05, z - 0.06],
        [x - r, 8.05, z - 0.06],
        [x - r, spring, z - 0.06],
        [x + r, spring, z - 0.06],
      ],
      color,
    );
    for (let j = 0; j < 4; j++) {
      const a = (j * Math.PI) / 4,
        b = ((j + 1) * Math.PI) / 4;
      tri(
        out,
        Math.abs(i) < 2 ? 'glass' : 'recess',
        [
          [x, spring, z - 0.06],
          [x + r * Math.cos(b), spring + r * Math.sin(b), z - 0.06],
          [x + r * Math.cos(a), spring + r * Math.sin(a), z - 0.06],
        ],
        color,
      );
    }
  }
  for (const s of [-1, 1]) {
    const x = cx + s * 10.85;
    face(
      out,
      'recess',
      [
        [x + 1.05, 5.25, z - 0.06],
        [x - 1.05, 5.25, z - 0.06],
        [x - 1.05, 8.95, z - 0.06],
        [x + 1.05, 8.95, z - 0.06],
      ],
      [0.21, 0.12, 0.1],
    );
    loft(
      out,
      'concrete',
      [
        [5.32, 0.3],
        [5.65, 0.18],
        [6.25, 0.52],
        [6.85, 0.23],
        [7.15, 0.1],
      ].map(([y, r]) => radialRing(y, r, r, 4, [x, z - 0.31])),
      cream,
    );
    for (const dx of [-1, 1])
      beam(
        out,
        'concrete',
        [x + dx * 1.9, 14.35, z - 0.22],
        [x, 15.48, z - 0.22],
        0.3,
        0.35,
        cream,
      );
  }
  box(out, 'metal', [cx - 5.55, 3.38, z - 2.1], [cx + 5.55, 3.86, z - 0.15], [0.18, 0.21, 0.2]);
}
function build(out, level) {
  const m = map,
    c = settings[level],
    tint = [0.51, 0.62, 0.65],
    trim = [0.7, 0.75, 0.75],
    features = map.elements;
  mappedSolid(out, 'foundation', localOutline(m), 0, 0.2, [0.35, 0.38, 0.38]);
  for (const p of features.filter(
    (p) => p.tags['building:part'] === 'yes' && p.tags.height && p.id !== 260153997,
  )) {
    const plan = cleanPlan(partPlan(m, p), 0.015),
      height = +p.tags.height,
      rise = +(p.tags['roof:height'] ?? 0),
      theta = (+(p.tags['roof:direction'] ?? 0) * Math.PI) / 180;
    const e = Math.sin(theta),
      s = -Math.cos(theta),
      dir = [
        e * Math.cos(m.heading) - s * Math.sin(m.heading),
        e * Math.sin(m.heading) + s * Math.cos(m.heading),
      ];
    const projections = plan.map((q) => q[0] * dir[0] + q[1] * dir[1]),
      lo = Math.min(...projections),
      span = Math.max(...projections) - lo;
    const roof = (q) => height - (rise ? (rise * (q[0] * dir[0] + q[1] * dir[1] - lo)) / span : 0);
    for (const { a, b } of edges(plan)) {
      facetedGlazing(
        out,
        [
          [a[0], 0.2, a[1]],
          [b[0], 0.2, b[1]],
          [b[0], roof(b), b[1]],
          [a[0], roof(a), a[1]],
        ],
        { tint, trim, dx: c.dx, dy: c.dy, border: c.border },
      );
      if (c.border)
        beam(out, 'metal', [a[0], roof(a), a[1]], [b[0], roof(b), b[1]], 0.12, 0.14, trim);
    }
    if (rise) {
      const polygon = plan.map((q) => [q[0], roof(q), q[1]]).toReversed();
      facetedGlazing(out, polygon, {
        tint: tint.map((v) => v + 0.04),
        trim,
        dx: c.dx,
        dy: c.dy,
        border: c.border,
      });
    } else mappedCap(out, 'metal', plan, height, [0.45, 0.5, 0.48]);
  }
  // Published welded-pipe mast diameters: 5 ft 10 in at the base to 2 ft 2 in at the tip.
  const mastPlan = partPlan(
      m,
      features.find((p) => p.id === 260153997),
    ),
    center = [0, 0];
  for (const q of mastPlan) {
    center[0] += q[0] / mastPlan.length;
    center[1] += q[1] / mastPlan.length;
  }
  loft(
    out,
    'metal',
    [
      [246, 0.889],
      [279, 0.889],
      [311, 0.67],
      [342, 0.46],
      [365.8, 0.3302],
    ].map(([y, r]) => radialRing(y, r, r, c.mast, center)),
    [0.8, 0.81, 0.78],
  );
  for (let y = 280; c.detail && y < 364; y += 8.5)
    loft(
      out,
      'metal',
      [
        radialRing(y, 1.01 - (y - 280) * 0.006, 1.01 - (y - 280) * 0.006, c.mast, center),
        radialRing(y + 0.16, 1.01 - (y - 280) * 0.006, 1.01 - (y - 280) * 0.006, 24, center),
      ],
      trim,
    );
  for (const x of [center[0] - 1.4, center[0] + 1.4])
    beam(out, 'metal', [x, 241, center[1] - 1.3], [center[0], 278, center[1]], 0.19, 0.22, trim);
  // Mechanical plant sits inside the two mapped roof wells below the surrounding crystal screen.
  for (const [x, z, y] of [
    [15, 3, 240],
    [31, 5, 240],
    [15, -13, 236],
    [35, -12, 236],
  ]) {
    box(out, 'metal', [x - 3, y, z - 2], [x + 3, y + 3, z + 2], [0.44, 0.48, 0.48]);
    for (let h = y + 0.3; c.detail && h < y + 2.9; h += 0.6)
      beam(
        out,
        'metal',
        [x - 2.9, h, z + 2.01],
        [x + 2.9, h, z + 2.01],
        0.085,
        0.08,
        [0.27, 0.31, 0.31],
      );
  }
  // Low sedum beds, not unsupported trees, on the mapped30m planted roof.
  for (const [x0, x1, z0, z1] of [
    [-56, -43, 12, 23],
    [-41, -28, 12, 23],
    [-26, -14, 12, 21],
    [-55, -39, -19, -9],
  ]) {
    box(out, 'metal', [x0, 30, z0], [x1, 30.22, z1], [0.72, 0.75, 0.72]);
    box(
      out,
      'recess',
      [x0 + 0.12, 30.22, z0 + 0.12],
      [x1 - 0.12, 30.36, z1 - 0.12],
      [0.29, 0.47, 0.12],
    );
  }
  // Photograph-supported bamboo-clad cantilever with three true roof openings.
  // Dimensions are reconstructed; no claimed current door/hardware survey.
  const outer = [
      [65.2, -10],
      [65.2, 11],
      [68.5, 11],
      [68.5, -10],
    ],
    holes = [-7, 0, 7].map((z) => [
      [65.95, z - 0.65],
      [67.75, z - 0.65],
      [67.75, z + 0.65],
      [65.95, z + 0.65],
    ]);
  mappedCap(out, 'wood', outer, 8.8, [0.63, 0.4, 0.18], holes, true);
  mappedCap(out, 'wood', outer, 9.08, [0.63, 0.4, 0.18], holes);
  for (const p of [outer, ...holes])
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length];
      if (c.border) beam(out, 'metal', [a[0], 8.94, a[1]], [b[0], 8.94, b[1]], 0.12, 0.28, trim);
      else
        face(
          out,
          'metal',
          [
            [a[0], 8.8, a[1]],
            [b[0], 8.8, b[1]],
            [b[0], 9.08, b[1]],
            [a[0], 9.08, a[1]],
          ],
          trim,
        );
    }
  if (level === 'skyline') skylineTheatre(out);
  else theatreFrontage(out, -35, c);
}

export function buildBoaReviewedMaster(out) {
  build(out, 'source');
}
export function buildBoaCloseup(out) {
  build(out, 'closeup');
}
export function buildBoaStreet(out) {
  build(out, 'street');
}
export function buildBoaDistrict(out) {
  build(out, 'district');
}
export function buildBoaSkyline(out) {
  const wrapped = {};
  for (const method of ['addTriangle', 'addQuad', 'addConvexPolygon'])
    wrapped[method] = (component, _ref, p, n, uv, color) => {
      const graph = {
          foundation: 'concrete_plain',
          stone: 'stone_granite',
          concrete: 'concrete_plain',
          brick: 'brick_flemish',
          wood: 'wood_plain',
          metal: 'metal_painted',
        }[component],
        mean = scope.sourceFacts.surfaceMeans[graph];
      out[method](
        'glass',
        'palette:#ffffff',
        p,
        n,
        uv,
        mean ? color.map((v, i) => v * mean[i]) : color,
      );
    };
  build(wrapped, 'skyline');
}
