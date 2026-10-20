/** Taipei Story House: red brick, branching Tudor timber and its own semicircular entrance. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  brick = rgb('a34f39'),
  yellow = rgb('ead89b'),
  timber = rgb('774640'),
  roof = rgb('819c91'),
  edge = rgb('556761'),
  stone = rgb('e5e6de'),
  windowWood = rgb('344b47'),
  glass = rgb('596c70'),
  foundation = rgb('9caaa4');
function facing(o, a, x = 0, z = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    q = (p) => {
      const r = v(p);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, p, n, u, c) => o.addTriangle(s, r, p.map(q), v(n), u, c),
    addQuad: (s, r, p, n, u, c) => o.addQuad(s, r, p.map(q), v(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) => {
      const pp = p.map(q),
        uv = p.map(u);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => uv[pp.indexOf(p)], c);
    },
  };
}
function panel(o, s, x, y, z, w, h, c) {
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
function polygon(o, s, ring, y0, y1, c) {
  const r = ring.map((p) => p.slice());
  if (
    r.reduce(
      (n, p, i) => n + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1],
      0,
    ) < 0
  )
    r.reverse();
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    quad(
      o,
      s,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [b[1] - a[1], 0, a[0] - b[0]],
      c,
    );
  }
  const ids = earcut(r.flat());
  for (const [y, n] of [
    [y0, [0, -1, 0]],
    [y1, [0, 1, 0]],
  ])
    for (let i = 0; i < ids.length; i += 3) {
      const p = ids.slice(i, i + 3).map((j) => [r[j][0], y, r[j][1]]);
      o.addTriangle(
        s,
        ref,
        p,
        n,
        p.map((p) => [p[0], p[2]]),
        c,
      );
    }
}
function round(o, s, x, z, y0, y1, r0, r1, c, n = 8) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2,
      b = ((i + 1) / n) * Math.PI * 2;
    quad(
      o,
      s,
      [
        [x + r0 * Math.cos(a), y0, z + r0 * Math.sin(a)],
        [x + r0 * Math.cos(b), y0, z + r0 * Math.sin(b)],
        [x + r1 * Math.cos(b), y1, z + r1 * Math.sin(b)],
        [x + r1 * Math.cos(a), y1, z + r1 * Math.sin(a)],
      ],
      [Math.cos((a + b) / 2), (r0 - r1) / (y1 - y0), Math.sin((a + b) / 2)],
      c,
    );
  }
}
function stroke(o, points, w, c = timber, s = 'wood') {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i],
      b = points[i + 1],
      l = Math.hypot(b[0] - a[0], b[1] - a[1]),
      dx = (-(b[1] - a[1]) * w) / l / 2,
      dy = ((b[0] - a[0]) * w) / l / 2;
    quad(
      o,
      s,
      [
        [a[0] + dx, a[1] + dy, a[2]],
        [b[0] + dx, b[1] + dy, b[2]],
        [b[0] - dx, b[1] - dy, b[2]],
        [a[0] - dx, a[1] - dy, a[2]],
      ],
      [0, 0, 1],
      c,
    );
  }
}
function curve(o, points, w, d) {
  const n = d === 0 ? 2 : d === 1 ? 3 : d === 2 ? 6 : 10,
    p = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      u = 1 - t;
    p.push(
      [0, 1, 2].map(
        (k) =>
          Math.pow(u, 3) * points[0][k] +
          3 * u * u * t * points[1][k] +
          3 * u * t * t * points[2][k] +
          Math.pow(t, 3) * points[3][k],
      ),
    );
  }
  stroke(o, p, w);
}
function board(o, x, y, w, h, d, c = timber) {
  if (d === 0) panel(o, 'wood', x, y, 0.04, w, h, c);
  else B(o, 'wood', x, y, 0.045, w, h, 0.1, c);
}
function window(o, x, y, w, h, d, door = false) {
  panel(o, 'wood', x, y, 0.02, w + 0.16, h + 0.12, windowWood);
  panel(o, 'glass', x, y + 0.12, 0.042, w - 0.17, h - 0.2, glass);
  if (d === 0) return;
  const n = d === 1 ? 2 : door ? 2 : 3,
    rows = d === 1 ? 3 : d === 2 ? 5 : 7;
  for (let i = 0; i <= n; i++) {
    const xx = x - w / 2 + 0.08 + ((w - 0.16) * i) / n;
    panel(o, 'wood', xx, y + 0.1, 0.054, i === 0 || i === n ? 0.075 : 0.045, h - 0.16, windowWood);
  }
  for (let j = 0; j <= rows; j++)
    panel(o, 'wood', x, y + 0.1 + ((h - 0.16) * j) / rows, 0.055, w - 0.16, 0.045, windowWood);
  B(o, 'stone', x, y - 0.13, 0.04, w + 0.35, 0.16, 0.32, stone);
  if (d > 1) {
    B(o, 'wood', x, y + h + 0.04, 0.02, w + 0.4, 0.12, 0.23, windowWood);
    for (const sign of [-1, 1])
      B(o, 'wood', x + sign * (w / 2 + 0.08), y, 0.03, 0.11, h, 0.16, windowWood);
    if (!door)
      for (const sign of [-1, 1])
        panel(
          o,
          'glass',
          x + sign * w * 0.25,
          y + h * 0.82,
          0.061,
          w * 0.36,
          h * 0.1,
          rgb('b0b0a0'),
        );
  }
}
function brickWindow(o, x, y, w, h, d) {
  window(o, x, y, w, h, d);
  if (d === 0) return;
  for (const dx of [-0.47, 0, 0.47]) {
    const xx = x + dx * w;
    const p = [
      [xx - w * 0.105, y + h + 0.13, 0.12],
      [xx + w * 0.105, y + h + 0.13, 0.12],
      [xx + w * 0.14, y + h + 0.52, 0.12],
      [xx - w * 0.14, y + h + 0.52, 0.12],
    ];
    quad(o, 'stone', p, [0, 0, 1], stone);
  }
  if (d > 1) B(o, 'wood', x, y + h + 0.09, 0.04, w + 0.38, 0.08, 0.22, timber);
}
const ionicControls = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/ws/wsq/taipei_story_house/ionic-entrance-construction-controls.json',
      import.meta.url,
    ),
  ),
);
/** Physical closed stocks and metric UVs for the source-supported entrance craft. */
function ionicCraft(o) {
  const tri = (slot, p, col, desired) => {
    let n = normalFor(...p);
    if (desired && n.reduce((a, v, i) => a + v * desired[i], 0) < 0) {
      p.reverse();
      n = normalFor(...p);
    }
    const axis = n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs)));
    o.addTriangle(
      slot,
      ref,
      p,
      n,
      p.map((v) => (axis === 0 ? [v[2], v[1]] : axis === 1 ? [v[0], v[2]] : [v[0], v[1]])),
      col,
    );
  };
  const Q = (slot, p, col) => {
    const n = normalFor(...p),
      a = n.map(Math.abs),
      axis = a.indexOf(Math.max(...a));
    o.addQuad(
      slot,
      ref,
      p,
      n,
      p.map((v) => (axis === 0 ? [v[2], v[1]] : axis === 1 ? [v[0], v[2]] : [v[0], v[1]])),
      col,
    );
  };
  const flat = (slot, rings, axis, position, sign, col) => {
    const points = rings.flat(),
      holes = [];
    let cursor = rings[0].length;
    for (const r of rings.slice(1)) {
      holes.push(cursor);
      cursor += r.length;
    }
    const ids = earcut(points.flat());
    const indices = holes.length ? earcut(points.flat(), holes) : ids;
    for (let i = 0; i < indices.length; i += 3) {
      const p = indices
        .slice(i, i + 3)
        .map((j) =>
          axis === 'y'
            ? [points[j][0], position, points[j][1]]
            : [points[j][0], points[j][1], position],
        );
      tri(slot, p, col, axis === 'y' ? [0, sign, 0] : [0, 0, sign]);
    }
  };
  const solidZ = (slot, rings, back, front, col) => {
    flat(slot, rings, 'z', back, -1, col);
    flat(slot, rings, 'z', front, 1, col);
    for (const [j, r] of rings.entries())
      for (let i = 0; i < r.length; i++) {
        const a = r[i],
          b = r[(i + 1) % r.length],
          p = [
            [...a, back],
            [...b, back],
            [...b, front],
            [...a, front],
          ];
        if (j) p.reverse();
        Q(slot, p, col);
      }
  };
  const solidY = (slot, rings, bottom, top, col) => {
    flat(slot, rings, 'y', bottom, -1, col);
    flat(slot, rings, 'y', top, 1, col);
    for (const [j, r] of rings.entries())
      for (let i = 0; i < r.length; i++) {
        const a = r[i],
          b = r[(i + 1) % r.length],
          p = [
            [a[0], bottom, a[1]],
            [a[0], top, a[1]],
            [b[0], top, b[1]],
            [b[0], bottom, b[1]],
          ];
        if (j) p.reverse();
        Q(slot, p, col);
      }
  };
  const box = (slot, x0, y0, z0, x1, y1, z1, col) =>
    solidZ(
      slot,
      [
        [
          [x0, y0],
          [x1, y0],
          [x1, y1],
          [x0, y1],
        ],
      ],
      z0,
      z1,
      col,
    );
  const lathe = (slot, x, z, profile, n, col) => {
    const rings = profile.map(([y, r]) =>
      Array.from({ length: n }, (_, i) => {
        const a = (-i * 2 * Math.PI) / n;
        return [x + r * Math.cos(a), y, z + r * Math.sin(a)];
      }),
    );
    for (let j = 1; j < rings.length; j++)
      for (let i = 0; i < n; i++)
        Q(
          slot,
          [rings[j - 1][i], rings[j - 1][(i + 1) % n], rings[j][(i + 1) % n], rings[j][i]],
          col,
        );
    for (const [ring, sign] of [
      [rings[0], -1],
      [rings.at(-1), 1],
    ])
      flat(slot, [ring.map((p) => [p[0], p[2]])], 'y', ring[0][1], sign, col);
  };
  return { tri, Q, flat, solidZ, solidY, box, lathe };
}
function physicalIonicVolute(o) {
  const v = ionicControls.volutes,
    { Q, flat, tri } = ionicCraft(o),
    circle = (r) =>
      Array.from({ length: v.discSegments }, (_, i) => {
        const a = (i * 2 * Math.PI) / v.discSegments;
        return [r * Math.cos(a), v.centerY + r * Math.sin(a)];
      }),
    disc = [
      [v.back, v.radius - 0.015],
      [v.shoulder, v.radius],
      [v.front, v.radius - 0.01],
    ];
  flat('ionicVolute', [circle(disc[0][1])], 'z', disc[0][0], -1, stone);
  for (let j = 1; j < disc.length; j++)
    for (let i = 0; i < v.discSegments; i++) {
      const a = circle(disc[j - 1][1])[i],
        b = circle(disc[j - 1][1])[(i + 1) % v.discSegments],
        c = circle(disc[j][1])[(i + 1) % v.discSegments],
        d = circle(disc[j][1])[i];
      Q(
        'ionicVolute',
        [
          [...a, disc[j - 1][0]],
          [...b, disc[j - 1][0]],
          [...c, disc[j][0]],
          [...d, disc[j][0]],
        ],
        stone,
      );
    }
  const eye = circle(v.eyeRadius);
  flat('ionicVolute', [circle(v.radius - 0.01), eye], 'z', v.front, 1, stone);
  flat('ionicVolute', [eye], 'z', v.front - v.eyeDepth, 1, stone);
  for (let i = 0; i < eye.length; i++) {
    const a = eye[i],
      b = eye[(i + 1) % eye.length];
    Q(
      'ionicVolute',
      [
        [...a, v.front],
        [...b, v.front],
        [...b, v.front - v.eyeDepth],
        [...a, v.front - v.eyeDepth],
      ],
      stone,
    );
  }
  const point = (t) => {
    const theta = Math.PI / 2 - t * 2 * Math.PI * v.spiralTurns,
      r = v.spiralOuterRadius + (v.spiralInnerRadius - v.spiralOuterRadius) * t,
      dr = v.spiralInnerRadius - v.spiralOuterRadius,
      dt = -2 * Math.PI * v.spiralTurns,
      du = dr * Math.cos(theta) - r * Math.sin(theta) * dt,
      dy = dr * Math.sin(theta) + r * Math.cos(theta) * dt,
      l = Math.hypot(du, dy);
    return {
      center: [r * Math.cos(theta), v.centerY + r * Math.sin(theta), v.spiralPlane],
      tangent: [du / l, dy / l, 0],
      across: [-dy / l, du / l, 0],
    };
  };
  const rings = Array.from({ length: v.spiralSegments + 1 }, (_, i) => {
    const p = point(i / v.spiralSegments);
    return Array.from({ length: v.spiralSides }, (_, j) => {
      const a = (j * 2 * Math.PI) / v.spiralSides;
      return p.center.map(
        (x, k) =>
          x +
          ((p.across[k] * v.spiralWidth) / 2) * Math.cos(a) +
          (k === 2 ? (v.spiralDepth / 2) * Math.sin(a) : 0),
      );
    });
  });
  for (let i = 1; i < rings.length; i++)
    for (let j = 0; j < v.spiralSides; j++) {
      const next = (j + 1) % v.spiralSides,
        p = [rings[i - 1][j], rings[i - 1][next], rings[i][next], rings[i][j]],
        center = point((i - 0.5) / v.spiralSegments).center,
        centroid = [0, 1, 2].map((k) => p.reduce((s, p) => s + p[k], 0) / 4),
        n = normalFor(...p);
      if (n.reduce((s, x, k) => s + x * (centroid[k] - center[k]), 0) < 0) p.reverse();
      Q('ionicSpiral', p, stone);
    }
  for (const [index, sign] of [
    [0, -1],
    [v.spiralSegments, 1],
  ]) {
    const p = point(index / v.spiralSegments),
      ring = rings[index];
    for (let j = 0; j < ring.length; j++)
      tri(
        'ionicSpiral',
        [p.center, ring[j], ring[(j + 1) % ring.length]],
        stone,
        p.tangent.map((v) => v * sign),
      );
  }
}
function turnedIonicColumn(o, x, z) {
  const c = ionicControls,
    k = c.columns,
    { lathe, box, Q } = ionicCraft(o),
    a = Math.atan2(x - c.porch.center[0], z - c.porch.center[1]);
  box(
    'ionicColumn',
    x - k.plinthWidth / 2,
    k.bottom,
    z - k.plinthWidth / 2,
    x + k.plinthWidth / 2,
    k.bottom + k.plinthHeight,
    z + k.plinthWidth / 2,
    stone,
  );
  lathe(
    'ionicColumn',
    x,
    z,
    k.profile.map(([y, r]) => [k.bottom + y, r]),
    k.segments,
    stone,
  );
  box('ionicCapital', x - 0.36, 3.78, z - 0.36, x + 0.36, k.abacusBottom, z + 0.36, stone);
  box(
    'ionicCapital',
    x - k.abacusWidth / 2,
    k.abacusBottom,
    z - k.abacusWidth / 2,
    x + k.abacusWidth / 2,
    k.top,
    z + k.abacusWidth / 2,
    stone,
  );
  for (let i = 0; i < c.echinus.ribs; i++) {
    const angle = a + (i * 2 * Math.PI) / c.echinus.ribs,
      co = Math.cos(angle),
      si = Math.sin(angle),
      r = 0.29,
      w = c.echinus.width / 2,
      d = c.echinus.depth / 2,
      y0 = c.echinus.bottom,
      y1 = c.echinus.top,
      lower = [
        [-w, -d],
        [w, -d],
        [w, d],
        [-w, d],
      ].map(([t, dr]) => [x + co * (r + dr) - si * t, y0, z + si * (r + dr) + co * t]),
      upper = [
        [-w, -d],
        [w, -d],
        [w, d],
        [-w, d],
      ].map(([t, dr]) => [
        x + co * (r + 0.014 + dr) - si * t,
        y1,
        z + si * (r + 0.014 + dr) + co * t,
      ]);
    for (let j = 0; j < 4; j++)
      Q('ionicCapital', [lower[j], lower[(j + 1) % 4], upper[(j + 1) % 4], upper[j]], stone);
    Q('ionicCapital', [...lower].reverse(), stone);
    Q('ionicCapital', upper, stone);
  }
  for (let i = 0; i < c.volutes.countPerColumn; i++) {
    const angle = a + c.volutes.angleOffset + (i * 2 * Math.PI) / c.volutes.countPerColumn,
      nx = Math.sin(angle),
      nz = Math.cos(angle);
    physicalIonicVolute(
      facing(o, angle, x + nx * c.volutes.centerRadius, z + nz * c.volutes.centerRadius),
    );
  }
}
function profiledEntrancePorch(o) {
  const c = ionicControls,
    k = c.porch,
    { Q, flat, solidY } = ionicCraft(o),
    ring = (r) => dRing(...k.center, r, k.segments),
    profiles = k.profile.map(([y, r]) => ring(r).map((p) => [p[0], y, p[1]]));
  for (let j = 1; j < profiles.length; j++)
    for (let i = 0; i < profiles[j].length; i++) {
      const next = (i + 1) % profiles[j].length;
      Q(
        'porchProfile',
        [profiles[j - 1][i], profiles[j][i], profiles[j][next], profiles[j - 1][next]],
        stone,
      );
    }
  flat('porchProfile', [ring(k.profile[0][1])], 'y', k.profile[0][0], -1, stone);
  flat('porchProfile', [ring(k.profile.at(-1)[1])], 'y', k.profile.at(-1)[0], 1, stone);
  const s = c.ceiling,
    ellipse = (rx, rz) =>
      Array.from({ length: s.segments }, (_, j) => {
        const a = (j * 2 * Math.PI) / s.segments;
        return [s.center[0] + rx * Math.cos(a), s.center[1] + rz * Math.sin(a)];
      });
  for (const [rx, rz, w, bottom, top] of s.rings)
    solidY(
      'ceilingMoulding',
      [ellipse(rx + w / 2, rz + w / 2), ellipse(rx - w / 2, rz - w / 2)],
      bottom,
      top,
      stone,
    );
  const stepped = [
      [-0.5, -0.22],
      [-0.4, -0.22],
      [-0.4, -0.34],
      [-0.22, -0.34],
      [-0.22, -0.44],
      [-0.1, -0.44],
      [-0.1, -0.5],
      [0.1, -0.5],
      [0.1, -0.44],
      [0.22, -0.44],
      [0.22, -0.34],
      [0.4, -0.34],
      [0.4, -0.22],
      [0.5, -0.22],
      [0.5, 0.22],
      [0.4, 0.22],
      [0.4, 0.34],
      [0.22, 0.34],
      [0.22, 0.44],
      [0.1, 0.44],
      [0.1, 0.5],
      [-0.1, 0.5],
      [-0.1, 0.44],
      [-0.22, 0.44],
      [-0.22, 0.34],
      [-0.4, 0.34],
      [-0.4, 0.22],
      [-0.5, 0.22],
    ],
    ornament = (scale) =>
      stepped.map(([x, z]) => [
        s.center[0] + x * s.medallionSize[0] * scale,
        s.center[1] + z * s.medallionSize[1] * scale,
      ]);
  solidY(
    'ceilingMoulding',
    [ornament(1), ornament(0.88)],
    s.medallionBottom,
    s.medallionTop,
    stone,
  );
  const square = (r) =>
    [
      [-r, -r],
      [r, -r],
      [r, r],
      [-r, r],
    ].map(([x, z]) => [s.center[0] + x, s.center[1] + z]);
  solidY(
    'ceilingMoulding',
    [square(0.14), square(0.105)],
    s.medallionBottom - 0.006,
    s.medallionTop,
    stone,
  );
}

function column(o, x, z, d) {
  if (d === 3) {
    turnedIonicColumn(o, x, z);
    return;
  }
  const y = 0.66,
    h = 3.24;
  if (d === 0) {
    B(o, 'stone', x, y, z, 0.3, h, 0.3, stone);
    return;
  }
  B(o, 'stone', x, y, z, 0.65, 0.72, 0.65, stone);
  B(o, 'stone', x, y + 0.72, z, 0.76, 0.12, 0.76, stone);
  const n = d === 1 ? 6 : d === 2 ? 8 : 16;
  round(o, 'stone', x, z, y + 0.84, y + 1.04, 0.29, 0.23, stone, n);
  round(o, 'stone', x, z, y + 1.04, y + h - 0.3, 0.23, 0.2, stone, n);
  round(o, 'stone', x, z, y + h - 0.3, y + h - 0.12, 0.2, 0.33, stone, n);
  B(o, 'stone', x, y + h - 0.12, z, 0.7, 0.12, 0.65, stone);
  if (d > 1)
    for (const sign of [-1, 1]) {
      const q = facing(o, 0, x + sign * 0.26, z + 0.19),
        r = 0.105,
        points = [];
      for (let j = 0; j <= 12; j++) {
        const a = (j / 12) * Math.PI * 2;
        points.push([Math.cos(a) * r, y + h - 0.2 + Math.sin(a) * r, 0.02]);
      }
      stroke(q, points, 0.035, stone, 'stone');
    }
}
function dRing(cx, cz, r, n) {
  const out = [
    [cx - r, 5.25],
    [cx + r, 5.25],
    [cx + r, cz],
  ];
  for (let j = 1; j <= n; j++) {
    const a = (j / n) * Math.PI;
    out.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]);
  }
  return out;
}
function baluster(o, x, z, y, d) {
  if (d <= 1) {
    B(o, 'stone', x, y, z, 0.085, 0.65, 0.085, stone);
    return;
  }
  const n = d === 2 ? 6 : 10;
  for (const [a, b, ra, rb] of [
    [0, 0.12, 0.1, 0.13],
    [0.12, 0.35, 0.13, 0.055],
    [0.35, 0.55, 0.055, 0.08],
    [0.55, 0.66, 0.08, 0.1],
  ])
    round(o, 'stone', x, z, y + a, y + b, ra, rb, stone, n);
}
function curvedRail(o, cx, cz, r, y, d) {
  const n = d === 0 ? 8 : d === 1 ? 10 : 20;
  for (let j = 0; j < n; j++) {
    const a = (j / n) * Math.PI,
      b = ((j + 1) / n) * Math.PI,
      p = [cx + r * Math.cos(a), y, cz + r * Math.sin(a)],
      q = [cx + r * Math.cos(b), y, cz + r * Math.sin(b)];
    if (d > 0) {
      beam(o, 'stone', p, q, 0.16, 0.22, stone);
      beam(o, 'stone', [p[0], y + 0.82, p[2]], [q[0], y + 0.82, q[2]], 0.18, 0.25, stone);
    } else {
      const pi = [cx + (r - 0.13) * Math.cos(a), y, cz + (r - 0.13) * Math.sin(a)],
        qi = [cx + (r - 0.13) * Math.cos(b), y, cz + (r - 0.13) * Math.sin(b)];
      quad(
        o,
        'stone',
        [pi, [pi[0], y + 0.82, pi[2]], [qi[0], y + 0.82, qi[2]], qi],
        [-Math.cos((a + b) / 2), 0, -Math.sin((a + b) / 2)],
        stone,
      );
      quad(
        o,
        'stone',
        [
          [pi[0], y + 0.82, pi[2]],
          [p[0], y + 0.82, p[2]],
          [q[0], y + 0.82, q[2]],
          [qi[0], y + 0.82, qi[2]],
        ],
        [0, 1, 0],
        stone,
      );
    }
    if (d === 0)
      quad(
        o,
        'stone',
        [
          [p[0], y, p[2]],
          [q[0], y, q[2]],
          [q[0], y + 0.82, q[2]],
          [p[0], y + 0.82, p[2]],
        ],
        [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
        stone,
      );
    else {
      const m = (a + b) / 2;
      baluster(o, cx + r * Math.cos(m), cz + r * Math.sin(m), y + 0.08, d);
    }
  }
  for (const xx of [-r, r]) {
    B(o, 'stone', cx + xx, y, cz - 0.15, 0.3, 0.92, 0.55, stone);
    B(o, 'stone', cx + xx, y, (5.35 + cz) / 2, 0.25, 0.12, cz - 5.35, stone);
    B(o, 'stone', cx + xx, y + 0.82, (5.35 + cz) / 2, 0.25, 0.18, cz - 5.35, stone);
  }
}
function triangle(o, s, p, c) {
  if (s === 'roof' && normalFor(...p)[1] < 0) p = [p[0], p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((p) => [p[0], p[1]]),
    c,
  );
}
function roofQuad(o, p) {
  let n = normalFor(...p);
  if (n[1] < 0) n = n.map((v) => -v);
  quad(o, 'roof', p, n, roof);
}
function mainRoof(o, d) {
  const a = [-8.8, 7.72, -2.75],
    b = [6.95, 7.72, -2.75],
    c = [6.95, 7.72, 5.85],
    e = [-8.8, 7.72, 5.85],
    r = [-8.8, 11.7, 1.1],
    s = [2.65, 11.7, 1.1];
  roofQuad(o, [a, b, s, r]);
  roofQuad(o, [e, r, s, c]);
  triangle(o, 'roof', [b, c, s], roof);
  const wall = facing(o, -Math.PI / 2, -8.34, 0);
  triangle(
    wall,
    'wall',
    [
      [-2.29, 7.55, 0],
      [5.34, 7.55, 0],
      [1.1, 11.45, 0],
    ],
    yellow,
  );
  for (const p of [
    [a, b],
    [c, e],
    [a, e],
    [a, r],
    [r, e],
    [r, s],
  ])
    beam(o, 'wood', p[0], p[1], d === 0 ? 0.12 : 0.18, 0.18, edge);
  // Lower cross gable belongs to the south end of the main house.
  const x0 = -0.65,
    x1 = 6.95,
    z0 = -7.9,
    z1 = 6.95,
    xx = 3.15,
    y = 10.7;
  roofQuad(o, [
    [x0, 7.72, z0],
    [xx, y, z0],
    [xx, y, z1],
    [x0, 7.72, z1],
  ]);
  roofQuad(o, [
    [xx, y, z0],
    [x1, 7.72, z0],
    [x1, 7.72, z1],
    [xx, y, z1],
  ]);
  for (const zz of [z0, z1]) {
    const q = facing(o, zz > 0 ? 0 : Math.PI, xx, zz > 0 ? 6.43 : -7.48);
    triangle(
      q,
      'wall',
      [
        [-3.4, 7.55, 0],
        [3.4, 7.55, 0],
        [0, y - 0.12, 0],
      ],
      yellow,
    );
    beam(q, 'wood', [-3.65, 7.65, 0.03], [0, y + 0.03, 0.03], 0.15, 0.2, edge);
    beam(q, 'wood', [0, y + 0.03, 0.03], [3.65, 7.65, 0.03], 0.15, 0.2, edge);
    board(q, 0, 7.55, 0.13, 3.0, d);
    for (const sign of [-1, 1]) {
      curve(
        q,
        [
          [0, 7.66, 0.07],
          [sign * 0.5, 8.8, 0.07],
          [sign * 1.8, 8.1, 0.07],
          [sign * 2.05, 8.9, 0.07],
        ],
        0.14,
        d,
      );
      curve(
        q,
        [
          [0, 8.8, 0.07],
          [sign * 0.3, 9.65, 0.07],
          [sign * 0.8, 9.2, 0.07],
          [sign * 1.05, 9.45, 0.07],
        ],
        0.13,
        d,
      );
    }
  }
  beam(o, 'wood', [xx, y, z0], [xx, y, z1], 0.15, 0.18, edge);
  if (d > 1)
    for (const x of [-8.75, 3.15])
      beam(
        o,
        'wood',
        [x, x < 0 ? 11.6 : 10.6, x < 0 ? 1.1 : 6.75],
        [x, x < 0 ? 12.2 : 11.25, x < 0 ? 1.1 : 6.75],
        0.09,
        0.09,
        edge,
      );
}
function attic(o, d) {
  const x = -2.2,
    z = 4.75,
    w = 2.15,
    front = z + 1.05;
  B(o, 'wall', x, 7.0, z, w, 3.65, 2.1, yellow);
  const q = facing(o, 0, x, front + 0.01);
  for (const xx of [-w / 2, w / 2]) board(q, xx, 7.0, 0.14, 3.68, d);
  for (const yy of [7.05, 7.7, 10.1, 10.55]) board(q, 0, yy, w, 0.12, d);
  window(q, 0, 8.05, 1.4, 1.85, d);
  if (d > 1) {
    const colors = ['866a63', 'b6a778', '79928b', '798988'];
    for (let j = 0; j < 5; j++)
      for (let i = 0; i < 4; i++)
        panel(
          q,
          'glass',
          -0.5 + i * 0.33,
          8.23 + j * 0.31,
          0.058,
          0.28,
          0.25,
          rgb(colors[(i + j * 3) % colors.length]),
        );
    for (const sign of [-1, 1])
      curve(
        q,
        [
          [sign * 1.0, 7.85, 0.12],
          [sign * 0.55, 8.5, 0.12],
          [sign * 0.85, 9.1, 0.12],
          [sign * 0.83, 9.8, 0.12],
        ],
        0.12,
        d,
      );
  }
  const r = 1.43,
    yy = 10.75,
    top = 12.45;
  const corners = [
    [-r, -r],
    [r, -r],
    [r, r],
    [-r, r],
  ];
  for (let i = 0; i < 4; i++) {
    const a = corners[i],
      b = corners[(i + 1) % 4];
    triangle(
      o,
      'roof',
      [
        [x + a[0], yy, z + a[1]],
        [x + b[0], yy, z + b[1]],
        [x, top, z],
      ],
      roof,
    );
  }
  B(o, 'wood', x, 10.62, z, 3.0, 0.16, 2.9, edge);
  beam(o, 'wood', [x, 12.42, z], [x, 14.2, z], 0.09, 0.09, edge);
  if (d > 0)
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const v = facing(o, a, x + Math.sin(a) * 1.45, z + Math.cos(a) * 1.45);
      triangle(
        v,
        'wood',
        [
          [-0.52, 10.85, 0.02],
          [0.52, 10.85, 0.02],
          [0, 11.85, 0.02],
        ],
        windowWood,
      );
      beam(v, 'wood', [-0.6, 10.82, 0.1], [0, 11.95, 0.1], 0.1, 0.12, stone);
      beam(v, 'wood', [0, 11.95, 0.1], [0.6, 10.82, 0.1], 0.1, 0.12, stone);
      if (d > 1)
        for (let j = 0; j < 7; j++)
          panel(v, 'wood', 0, 10.95 + j * 0.11, 0.1, 0.8 - j * 0.1, 0.035, edge);
    }
}
function curvedRooflet(o, d) {
  const x = -4.3,
    z0 = -2.9,
    z1 = 0.2,
    n = d === 0 ? 4 : d === 1 ? 6 : d === 2 ? 10 : 16,
    r = 1.65,
    profile = [];
  // Close the rooflet's skirt down into the main roof; a curved cap alone would float.
  for (const [angle, xx, zz, width] of [
    [0, x, z1, r * 2],
    [Math.PI, x, z0, r * 2],
    [-Math.PI / 2, x - r, (z0 + z1) / 2, z1 - z0],
    [Math.PI / 2, x + r, (z0 + z1) / 2, z1 - z0],
  ])
    panel(facing(o, angle, xx, zz), 'wall', 0, 7.45, 0, width, 3.15, yellow);
  for (let j = 0; j <= n; j++) {
    const a = Math.PI - (j / n) * Math.PI;
    profile.push([r * Math.cos(a), 10.6 + 1.7 * Math.sin(a)]);
  }
  for (const [zz, a] of [
    [z1, 0],
    [z0, Math.PI],
  ]) {
    const q = facing(o, a, x, zz),
      p = profile.map(([xx, y]) => [xx, y, 0.01]);
    q.addConvexPolygon('wall', ref, p, [0, 0, 1], (p) => [p[0], p[1]], yellow);
    stroke(q, p, 0.13, edge, 'wood');
    if (d > 0) {
      panel(q, 'wood', 0, 10.7, 0.03, 1.4, 1.1, timber);
      panel(q, 'glass', 0, 10.83, 0.04, 1.1, 0.8, glass);
    }
  }
  for (let j = 0; j < n; j++) {
    const a = profile[j],
      b = profile[j + 1];
    roofQuad(o, [
      [x + a[0], a[1], z0],
      [x + b[0], b[1], z0],
      [x + b[0], b[1], z1],
      [x + a[0], a[1], z1],
    ]);
  }
}
function upperTimber(o, d) {
  const left = facing(o, 0, -6.4, 5.35),
    right = facing(o, 0, 3.15, 6.43);
  for (const [q, w] of [
    [left, 3.8],
    [right, 6.7],
  ]) {
    for (const y of [4.03, 4.4, 7.4]) board(q, 0, y, w, 0.14, d);
    for (const x of [-w / 2, 0, w / 2]) board(q, x, 4.0, 0.14, 3.5, d);
    for (const sign of [-1, 1])
      curve(
        q,
        [
          [sign * (w / 2 - 0.08), 4.2, 0.11],
          [sign * (w / 2 - 0.3), 5.0, 0.11],
          [sign * (w / 2 - (w < 4 ? 0.22 : 0.9)), 5.2, 0.11],
          [sign * (w / 2 - (w < 4 ? 0.22 : 0.9)), 6.55, 0.11],
        ],
        0.14,
        d,
      );
  }
  const side = facing(o, -Math.PI / 2, -8.35, 1.1);
  for (const y of [4.03, 4.4, 7.4]) board(side, 0, y, 7.6, 0.14, d);
  board(side, 0, 8.35, 5.8, 0.14, d);
  for (const x of [-3.4, -1.3, 1.3, 3.4]) {
    const roofY = 11.7 - (3.98 * Math.abs(x)) / (x < 0 ? 3.85 : 4.75);
    board(side, x, 4, 0.12, Math.min(5, roofY - 4.15), d);
  }
  board(side, 0, 7.4, 0.14, 3.6, d);
  board(side, 0, 9.6, 3.5, 0.14, d);
  for (const sign of [-1, 1])
    curve(
      side,
      [
        [sign * 3.2, 4.1, 0.1],
        [sign * 2.4, 4.8, 0.1],
        [sign * 2.5, 5.3, 0.1],
        [sign * 2.5, 6.0, 0.1],
      ],
      0.14,
      d,
    );
}
function rear(o, d) {
  for (const [a, x, z, w] of [
    [Math.PI, 2.3, -7.49, 7.8],
    [Math.PI, -4.0, -3.64, 4.0],
    [Math.PI / 2, 6.52, -0.1, 12.7],
  ]) {
    const q = facing(o, a, x, z);
    for (const y of [4.03, 4.4, 7.4]) board(q, 0, y, w, 0.13, d);
    for (const xx of [-w / 2, 0, w / 2]) board(q, xx, 4.0, 0.14, 3.5, d);
    for (const xx of [-w * 0.26, w * 0.26]) {
      brickWindow(q, xx, 1.0, 1.0, 2.35, d);
      window(q, xx, 4.65, 1.0, 2.35, d);
    }
  }
  // The high brick return and white rail are visible behind the northern end gable.
  B(o, 'brick', -7.45, -1.3, -2.9, 2.35, 8.6, 1.5, brick);
  B(o, 'stone', -7.45, 7.25, -2.9, 2.65, 0.25, 1.8, stone);
  if (d > 0) {
    for (const a of [-Math.PI / 2, Math.PI]) {
      const q = facing(o, a, -7.45 + Math.sin(a) * 1.25, -2.9 + Math.cos(a) * 0.84);
      B(q, 'stone', 0, 7.5, 0, a === Math.PI ? 2.5 : 1.75, 0.1, 0.25, stone);
      B(q, 'stone', 0, 8.25, 0, a === Math.PI ? 2.5 : 1.75, 0.12, 0.25, stone);
      for (const xx of [-0.65, 0, 0.65]) B(q, 'stone', xx, 7.6, 0, 0.1, 0.65, 0.1, stone);
    }
  }
}
export function taipeiStoryHouse(o, _frame, d = 3) {
  const ring = [
    [6.52, 6.35],
    [-0.26, 6.41],
    [-0.26, 5.3],
    [-8.33, 5.34],
    [-8.32, -2.29],
    [-6.01, -2.2],
    [-6.09, -3.4],
    [-2.47, -3.63],
    [-2.37, -5.94],
    [-1.49, -7.33],
    [6.5, -7.47],
  ];
  polygon(o, 'stone', ring, -1.3, 0.36, foundation);
  polygon(o, 'brick', ring, 0.36, 4.03, brick);
  polygon(o, 'wall', ring, 4.03, 7.6, yellow);
  upperTimber(o, d);
  mainRoof(o, d);
  attic(o, d);
  curvedRooflet(o, d);
  rear(o, d);
  const main = facing(o, 0, 0, 5.36);
  for (const x of [-7.15, -5.3]) {
    brickWindow(main, x, 1.03, 1.0, 2.4, d);
    window(main, x, 4.65, 1.0, 2.45, d);
  }
  window(main, -2.2, 0.75, 1.28, 2.8, d, true);
  window(main, -2.2, 4.5, 1.45, 2.65, d, true);
  const front = facing(o, 0, 0, 6.45);
  for (const x of [1.7, 4.6]) {
    brickWindow(front, x, 1.03, 1.15, 2.4, d);
    window(front, x, 4.65, 1.15, 2.45, d);
  }
  const side = facing(o, -Math.PI / 2, -8.35, 1.1);
  for (const x of [-1.5, 1.5]) {
    brickWindow(side, x, 1.03, 1.1, 2.4, d);
    window(side, x < 0 ? -0.72 : 0.72, 4.65, 1.05, 2.45, d);
  }
  window(side, 0, 8.6, 1.45, 1.8, d);
  const n = d === 0 ? 8 : d === 1 ? 10 : 20;
  for (let i = 0; i < 4; i++)
    polygon(
      o,
      'stone',
      dRing(-2.2, 5.8, 3.05 - i * 0.22, n),
      -0.15 + i * 0.2,
      0.05 + i * 0.2,
      stone,
    );
  if (d === 3) profiledEntrancePorch(o);
  else polygon(o, 'stone', dRing(-2.2, 5.8, 2.34, n), 3.9, 4.12, stone);
  curvedRail(o, -2.2, 5.8, 2.25, 4.16, d);
  for (const xx of [-1.85, -0.7, 0.7, 1.85])
    column(o, -2.2 + xx, 5.8 + Math.sqrt(2.15 ** 2 - xx ** 2), d);
  if (d > 1) {
    B(o, 'stone', -2.2, 7.15, 5.75, 2.5, 0.15, 1.2, stone);
    for (const x of [-3, -2.2, -1.4])
      beam(o, 'wood', [x, 7.0, 5.4], [x, 7.1, 6.2], 0.12, 0.15, edge);
  }
}
export function taipeiStoryHouseSkyline(o) {
  taipeiStoryHouse(o, undefined, 0);
}
export function taipeiStoryHouseDistrict(o) {
  taipeiStoryHouse(o, undefined, 1);
}
export function taipeiStoryHouseStreet(o) {
  taipeiStoryHouse(o, undefined, 2);
}
const surfaces = {
  ionicColumn: { slot: 'wall', graph: 'plaster_lime', roughness: 0.9, metallic: 0 },
  ionicCapital: { slot: 'wall', graph: 'plaster_lime', roughness: 0.9, metallic: 0 },
  ionicVolute: { slot: 'wall', graph: 'plaster_lime', roughness: 0.9, metallic: 0 },
  ionicSpiral: { slot: 'wall', graph: 'plaster_lime', roughness: 0.9, metallic: 0 },
  porchProfile: { slot: 'wall', graph: 'plaster_lime', roughness: 0.9, metallic: 0 },
  ceilingMoulding: { slot: 'wall', graph: 'plaster_lime', roughness: 0.9, metallic: 0 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.9, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.8, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_copper', roughness: 0.8, metallic: 0.35 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.87, metallic: 0 },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
};
export const taipeiStoryHouseModel = {
  id: 'taipei_story_house',
  key: 'taipei_story_house',
  recipe: 'structure-taipei-story-house.mjs',
  cell: 'ws/wsq',
  title: 'Taipei Story House',
  brief:
    'Small Tudor-style villa with red-brick lower floor, yellow upper plaster/red branching timber pattern, dark divided windows, steep copper main/cross gables, spired square attic with coloured glass and louvred rooflets, and semicircular Ionic balcony/round entrance steps, four closed turned columns with low moulded bases/diagonal scroll capitals, profiled porch edge and physical ceiling mouldings. Detached cafe and modern access enclosure excluded.',
  camera: [-25, 16, 29],
  lookAt: [-0.5, 5, 0],
  qaCameras: [
    { name: 'front', position: [0, 11, 34], lookAt: [-1, 5.5, 3] },
    { name: 'front-detail', position: [-12, 8, 22], lookAt: [-2.2, 5.8, 5.5] },
    { name: 'back', position: [24, 16, -26], lookAt: [0, 5, -1] },
    { name: 'ionic-capitals', position: [-0.1, 3.3, 9.7], lookAt: [-1.5, 3.68, 7.83] },
    { name: 'porch-soffit-and-bases', position: [-3.2, 1.18, 9.0], lookAt: [-2.2, 2.85, 6.6] },
    { name: 'turned-column-bases', position: [-3.8, 1.35, 10.2], lookAt: [-2.9, 1.03, 7.83] },
  ],
  mediumFiContext: { scale: 0.35 },
  build: taipeiStoryHouse,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Dry entrance path[-2.2,10.8] gives datum8.8924m in unchanged Terrarium. Mapped ground falls roughly0.1–0.9m below this reference; shallow semicircular steps meet the front while structural foundations continue below the rear fall. Source contact is a bounded preview with coarse urban elevation and unseen rear foundation limits; generic-footprint replacement disabled.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-taipei-story-house.mjs',
    level: 'skyline',
    export: 'taipeiStoryHouseSkyline',
    errorMeters: 0.45,
    surfaces,
    authoredLevels: {
      district: { export: 'taipeiStoryHouseDistrict', errorMeters: 0.35, surfaces },
      street: { export: 'taipeiStoryHouseStreet', errorMeters: 0.25, surfaces },
    },
  },
  limitations: [
    'Current entrance construction uses exact native photographer PD-self2017original after Qualla-first44paths; first same-creator revision695073380/sole native upload/exacttimestamp/bytes bound. Four turned columns/low moulded bases/diagonal Ionic scroll capitals and curved porch/ceiling craft built. Earlier attribution/private/aerial controls excluded. Full fixed Tudor house/steep roofs/turret/verandas/rear brick return retained pending broader fidelity evidence. Dimensions, profiles, scroll pitch, ceiling geometry and present condition are medium-fi estimates, not measured elevations.',
    'Only the historic villa and its own entrance balcony/steps and rear brick return are included. Detached cafe, park structures, modern glazed access enclosure, signage, interiors and trees excluded.',
    'Photo pixels are not redistributed. Close entrance has physical closed capitals/spiral relief/turned bases and layered curved porch underside with matte lime-plaster finish matching the native photograph; inherited limestone masonry joints were excluded from these painted stocks. Three original lower geometry streams/all outside attributes retained; conservative LODerror estimates.45/.35/.25m updated without measured geometric-error certification. Fine copper courses, balusters, timber and stained-glass frames remain original estimates pending broader evidence. Source ground remains independent and current geographic review is required; footprint replacement disabled.',
  ],
};
