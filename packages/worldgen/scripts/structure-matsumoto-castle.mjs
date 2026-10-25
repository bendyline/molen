/** Matsumoto: five connected black/white historic structures and a genuinely open Moon veranda. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';

const ref = 'palette:#ffffff';
const defaultFrame = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/xn/xn6/matsumoto_castle/map-frame.json',
      import.meta.url,
    ),
  ),
);
const white = rgb('dedbd1'),
  stone = rgb('96917e'),
  mortar = rgb('77776a');
const tile = rgb('717877'),
  tileEdge = rgb('4f5654'),
  gray = tile;
const dark = rgb('29302e'),
  woodTrim = rgb('3d423e'),
  glass = rgb('2e3633'),
  rail = rgb('984b38'),
  timber = rgb('8d7251');
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const tint = (c, v) => c.map((x) => Math.min(1, x * v));
function triangle(o, s, p, c, n) {
  p = p.map((q) => q.map(Math.fround));
  let normal = normalFor(...p);
  if (Math.hypot(...normal) < 0.5) return;
  if (n && normal.reduce((v, x, i) => v + x * n[i], 0) < 0) {
    p = [p[0], p[2], p[1]];
    normal = normal.map((x) => -x);
  }
  o.addTriangle(
    s,
    ref,
    p,
    normal,
    p.map((q) => [q[0] + q[2], q[1]]),
    c,
  );
}
function quad(o, s, p, c, n) {
  triangle(o, s, [p[0], p[1], p[2]], c, n);
  triangle(o, s, [p[0], p[2], p[3]], c, n);
}
function polygon(o, s, points, c, n) {
  const k = Math.abs(n[1]) > 0.7 ? 1 : Math.abs(n[2]) > 0.7 ? 2 : 0;
  const axes = k === 1 ? [0, 2] : k === 2 ? [0, 1] : [2, 1];
  const ids = earcut(points.flatMap((p) => axes.map((i) => p[i])));
  for (let i = 0; i < ids.length; i += 3)
    triangle(
      o,
      s,
      ids.slice(i, i + 3).map((j) => points[j]),
      c,
      n,
    );
}
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
const bounds = (r) => ({
  min: [Math.min(...r.map((p) => p[0])), Math.min(...r.map((p) => p[1]))],
  max: [Math.max(...r.map((p) => p[0])), Math.max(...r.map((p) => p[1]))],
});
function cap(o, s, r, y, c) {
  polygon(
    o,
    s,
    r.map((p) => [p[0], y, p[1]]),
    c,
    [0, 1, 0],
  );
}
function expanded(r, amount) {
  const b = bounds(r),
    c = b.min.map((v, i) => (v + b.max[i]) / 2),
    size = b.max.map((v, i) => v - b.min[i]);
  return r.map((p) => p.map((v, i) => c[i] + (v - c[i]) * (1 + (2 * amount) / size[i])));
}
function faceAt(r, i, u) {
  return mix(r[i], r[(i + 1) % r.length], u);
}
function outward(r, i) {
  const a = r[i],
    b = r[(i + 1) % r.length],
    len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return [(b[1] - a[1]) / len, 0, (a[0] - b[0]) / len];
}
function roof(
  o,
  cx,
  cz,
  hx,
  hz,
  eave,
  rise,
  d,
  { colour = tile, topX = 0.3, topZ = 3, gabled = false } = {},
) {
  const rings = [],
    steps = d === 0 ? 1 : d === 1 ? 3 : d === 2 ? 5 : 10,
    sideSteps = d === 0 ? 1 : d === 1 ? 1 : d === 2 ? 2 : 6;
  const plan = (t) => {
    const x = hx + (topX - hx) * t,
      z = hz + (topZ - hz) * t;
    const corners = [
        [-x, -z],
        [x, -z],
        [x, z],
        [-x, z],
      ],
      points = [];
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < sideSteps; j++) {
        const u = j / sideSteps,
          p = mix(corners[i], corners[(i + 1) % 4], u),
          corner = Math.pow(Math.abs(u * 2 - 1), 4),
          curl = (1 - t) * (1 - t) * (0.12 + 0.43 * corner),
          y = eave + rise * Math.pow(t, 1.65) + curl;
        points.push([cx + p[0], y, cz + p[1]]);
      }
    return points;
  };
  for (let j = 0; j <= steps; j++) rings.push(plan(j / steps));
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < rings[j].length; i++) {
      const k = (i + 1) % rings[j].length;
      quad(
        o,
        'roof',
        [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
        colour,
        [0, 1, 0],
      );
    }
  polygon(o, 'roof', rings.at(-1), colour, [0, 1, 0]);
  const lip = rings[0];
  for (let i = 0; i < lip.length; i++) {
    const j = (i + 1) % lip.length,
      p = lip[i],
      q = lip[j];
    quad(o, 'plaster', [p, q, [q[0], q[1] - 0.2, q[2]], [p[0], p[1] - 0.2, p[2]]], white);
    if (d > 1)
      beam(
        o,
        'roof',
        p.map((v, k) => v + (k === 1 ? 0.035 : 0)),
        q.map((v, k) => v + (k === 1 ? 0.035 : 0)),
        0.14,
        0.16,
        colour === gray ? gray : tileEdge,
      );
  }
  // Closed shaded soffit extends from the outer lip to the inset supporting wall.
  const inset = Math.min(1.7, hx * 0.5, hz * 0.5),
    inner = [
      [-hx + inset, -hz + inset],
      [hx - inset, -hz + inset],
      [hx - inset, hz - inset],
      [-hx + inset, hz - inset],
    ];
  for (let i = 0; i < 4; i++) {
    const k = (i + 1) % 4,
      a = lip[i * sideSteps],
      b = lip[k * sideSteps];
    quad(
      o,
      'plaster',
      [
        [a[0], a[1] - 0.2, a[2]],
        [b[0], b[1] - 0.2, b[2]],
        [cx + inner[k][0], eave - 0.45, cz + inner[k][1]],
        [cx + inner[i][0], eave - 0.45, cz + inner[i][1]],
      ],
      white,
      [0, -1, 0],
    );
  }
  if (d > 1) {
    const spacing = d === 3 ? 1.0 : 6.0;
    for (let i = 0; i < 4; i++) {
      const a = lip[i * sideSteps],
        b = lip[((i + 1) % 4) * sideSteps],
        len = Math.hypot(b[0] - a[0], b[2] - a[2]),
        count = Math.floor(len / spacing),
        n = outward(
          [
            [-hx, -hz],
            [hx, -hz],
            [hx, hz],
            [-hx, hz],
          ],
          i,
        );
      for (let k = 1; k < count; k++) {
        const p = mix(a, b, k / count);
        beam(
          o,
          'plaster',
          [p[0] - n[0] * 1.55, eave - 0.32, p[2] - n[2] * 1.55],
          [p[0] - 0.12 * n[0], eave - 0.17, p[2] - 0.12 * n[2]],
          d === 3 ? 0.105 : 0.17,
          0.17,
          white,
        );
      }
    }
  }
  if (d === 3) {
    const edgePoint = (ring, side, u) => {
      const v = u * sideSteps,
        k = Math.min(sideSteps - 1, Math.floor(v));
      return mix(ring[side * sideSteps + k], ring[(side * sideSteps + k + 1) % ring.length], v - k);
    };
    for (let side = 0; side < 4; side++) {
      const a = lip[side * sideSteps],
        b = lip[((side + 1) % 4) * sideSteps],
        count = Math.floor(Math.hypot(b[0] - a[0], b[2] - a[2]) / 1.25);
      for (let k = 1; k < count; k++) {
        const u = k / count;
        let prev;
        for (let j = 0; j <= 6; j++) {
          const v = (j / 6) * steps,
            ri = Math.min(steps - 1, Math.floor(v)),
            p = mix(edgePoint(rings[ri], side, u), edgePoint(rings[ri + 1], side, u), v - ri);
          p[1] += 0.035;
          if (prev) {
            const dx = p[0] - prev[0],
              dz = p[2] - prev[2],
              len = Math.hypot(dx, dz);
            if (len > 0.01) {
              const nx = (-dz / len) * 0.035,
                nz = (dx / len) * 0.035;
              quad(
                o,
                'roof',
                [
                  [prev[0] - nx, prev[1], prev[2] - nz],
                  [p[0] - nx, p[1], p[2] - nz],
                  [p[0] + nx, p[1], p[2] + nz],
                  [prev[0] + nx, prev[1], prev[2] + nz],
                ],
                tint(colour, 0.94),
                [0, 1, 0],
              );
            }
          }
          prev = p;
        }
      }
    }
  }
  if (gabled && d > 0) {
    for (const sign of [-1, 1]) {
      const q = facing(o, sign < 0 ? Math.PI : 0, cx, cz + sign * (hz * 0.78));
      gable(q, 0, 0, hx * 0.91, eave + 0.35, rise - 0.35, d, {
        colour,
        whiteFace: false,
        depth: 2.0,
      });
    }
  }
}
function gable(
  o,
  cx,
  z,
  half,
  y,
  h,
  d,
  { curved = false, colour = tile, whiteFace = false, depth = 2.8 } = {},
) {
  const steps = d === 0 ? 2 : d === 1 ? 4 : d === 2 ? 8 : 18,
    profile = [];
  for (let j = 0; j <= steps; j++) {
    const x = -half + (2 * half * j) / steps,
      u = Math.min(1, Math.abs(x / half)),
      yy = curved
        ? h * Math.exp(-5 * u * u) + 0.23 * u * u
        : h * Math.pow(1 - u, 1.65) + 0.35 * u * u;
    profile.push([cx + x, y + yy, z]);
  }
  const poly = [[cx - half, y, z], ...profile, [cx + half, y, z]];
  polygon(o, whiteFace ? 'plaster' : 'wood', poly, whiteFace ? white : dark, [0, 0, 1]);
  for (let j = 1; j < profile.length; j++) {
    const a = profile[j - 1],
      b = profile[j];
    quad(
      o,
      'roof',
      [a, b, [b[0], y + 0.12, z - depth], [a[0], y + 0.12, z - depth]],
      colour,
      [0, 1, 0],
    );
    if (d > 0) {
      const strip = (slot, offset, width, c) => {
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
          dx = ((-(b[1] - a[1]) / len) * width) / 2,
          dy = (((b[0] - a[0]) / len) * width) / 2;
        quad(
          o,
          slot,
          [
            [a[0] - dx, a[1] - dy + offset, z + 0.1],
            [b[0] - dx, b[1] - dy + offset, z + 0.1],
            [b[0] + dx, b[1] + dy + offset, z + 0.1],
            [a[0] + dx, a[1] + dy + offset, z + 0.1],
          ],
          c,
          [0, 0, 1],
        );
      };
      strip('plaster', 0, 0.22, white);
      strip('roof', 0.15, 0.2, colour === gray ? gray : tileEdge);
    }
  }
  if (d > 1) {
    if (!whiteFace) {
      for (const x of [-0.19, 0, 0.19])
        B(o, 'plaster', cx + x, y + h * 0.58, z + 0.06, 0.07, Math.min(0.6, h * 0.2), 0.07, white);
      if (d === 3)
        for (const x of [-half * 0.42, half * 0.42])
          B(o, 'wood', cx + x, y + 0.25, z + 0.035, 0.08, h * 0.22, 0.07, tint(dark, 1.16));
    } else if (d === 3) {
      for (const x of [-0.28, 0.28])
        B(o, 'plaster', cx + x, y + h * 0.43, z + 0.08, 0.14, 0.5, 0.1, tint(white, 0.9));
      B(o, 'plaster', cx, y + h * 0.5, z + 0.12, 0.75, 0.12, 0.1, tint(white, 1.04));
    }
  }
}
function rectRing(cx, cz, hx, hz) {
  return [
    [cx - hx, cz - hz],
    [cx + hx, cz - hz],
    [cx + hx, cz + hz],
    [cx - hx, cz + hz],
  ];
}
function clipY(points, y, below) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length],
      fa = (below ? 1 : -1) * (y - a[1]),
      fb = (below ? 1 : -1) * (y - b[1]);
    if (fa >= -1e-8) out.push(a);
    if ((fa > 0 && fb < 0) || (fa < 0 && fb > 0)) {
      const u = fa / (fa - fb);
      out.push([a[0] + u * (b[0] - a[0]), y]);
    }
  }
  return out;
}
function holeShape(h, d) {
  const { x, y, w, height } = h;
  if (h.cusp && d > 1)
    return [
      [x - w / 2, y],
      [x + w / 2, y],
      [x + w / 2, y + height * 0.62],
      [x + w * 0.43, y + height * 0.8],
      [x + w * 0.2, y + height * 0.91],
      [x, y + height],
      [x - w * 0.2, y + height * 0.91],
      [x - w * 0.43, y + height * 0.8],
      [x - w / 2, y + height * 0.62],
    ];
  return [
    [x - w / 2, y],
    [x + w / 2, y],
    [x + w / 2, y + height],
    [x - w / 2, y + height],
  ];
}
function closure(o, map, n, poly, d, { door = false, depth = 0.28, bars = 3, frame = true } = {}) {
  const middle = poly.reduce(
      (a, p) => [a[0] + p[0] / poly.length, a[1] + p[1] / poly.length],
      [0, 0],
    ),
    back = (p) => {
      const v = map(p[0], middle[1]);
      return [v[0] - n[0] * depth, p[1], v[2] - n[2] * depth];
    },
    front = poly.map((p) => map(...p)),
    rear = poly.map(back);
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    quad(o, 'wood', [front[i], front[j], rear[j], rear[i]], door ? woodTrim : dark);
  }
  polygon(o, door ? 'wood' : 'glass', rear, door ? woodTrim : glass, n);
  const xs = poly.map((p) => p[0]),
    ys = poly.map((p) => p[1]),
    lo = Math.min(...ys),
    hi = Math.max(...ys),
    x0 = Math.min(...xs),
    x1 = Math.max(...xs);
  if (d > 1 && frame) {
    for (let i = 0; i < poly.length; i++) {
      const j = (i + 1) % poly.length,
        a = front[i].map((v, k) => v + n[k] * 0.035),
        b = front[j].map((v, k) => v + n[k] * 0.035);
      if (d === 3) beam(o, 'wood', a, b, 0.07, 0.07, door ? woodTrim : timber);
      else {
        const dy = poly[j][1] - poly[i][1],
          dx = poly[j][0] - poly[i][0],
          len = Math.hypot(dx, dy);
        if (len > 0.01) {
          const u = [(-dy / len) * 0.035, (dx / len) * 0.035],
            pp = [
              [-u[0], -u[1]],
              [u[0], u[1]],
            ];
          quad(
            o,
            'wood',
            [
              map(poly[i][0] + pp[0][0], poly[i][1] + pp[0][1]),
              map(poly[j][0] + pp[0][0], poly[j][1] + pp[0][1]),
              map(poly[j][0] + pp[1][0], poly[j][1] + pp[1][1]),
              map(poly[i][0] + pp[1][0], poly[i][1] + pp[1][1]),
            ],
            timber,
            n,
          );
        }
      }
    }
  }
  if (d > 1 && !door && bars)
    for (let j = 0; j < bars; j++) {
      const x = x0 + ((x1 - x0) * (j + 1)) / (bars + 1),
        a = map(x, lo + 0.08),
        b = map(x, hi - 0.12);
      beam(
        o,
        'wood',
        a.map((v, k) => v - n[k] * 0.12),
        b.map((v, k) => v - n[k] * 0.12),
        0.055,
        0.06,
        timber,
      );
    }
}
function facade(o, r, lo, hi, holes, d, { blackFraction = 0.58, skipFaces = [] } = {}) {
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = outward(r, i),
      map = (x, y) => [a[0] + ((b[0] - a[0]) * x) / len, y, a[1] + ((b[1] - a[1]) * x) / len],
      hs = holes.filter((h) => h.side === i),
      ps = [
        [0, lo],
        [len, lo],
        [len, hi],
        [0, hi],
      ],
      polys = hs.map((h) => holeShape(h, d)),
      flat = [...ps, ...polys.flat()],
      starts = [];
    let offset = 4;
    for (const p of polys) {
      starts.push(offset);
      offset += p.length;
    }
    const ids = earcut(flat.flat(), starts),
      split = lo + (hi - lo) * blackFraction;
    if (d === 0) {
      quad(
        o,
        'wood',
        [
          [0, lo],
          [len, lo],
          [len, split],
          [0, split],
        ].map((p) => map(...p)),
        dark,
        n,
      );
      quad(
        o,
        'plaster',
        [
          [0, split],
          [len, split],
          [len, hi],
          [0, hi],
        ].map((p) => map(...p)),
        white,
        n,
      );
    }
    if (d > 0)
      for (let j = 0; j < ids.length; j += 3) {
        const p = ids.slice(j, j + 3).map((k) => flat[k]);
        for (const [below, s, c] of [
          [true, 'wood', dark],
          [false, 'plaster', white],
        ]) {
          const q = clipY(p, split, below);
          if (q.length >= 3)
            polygon(
              o,
              s,
              q.map((p) => map(...p)),
              c,
              n,
            );
        }
      }
    for (const h of hs) closure(o, map, n, holeShape(h, d), d, h);
    if (d > 1 && !skipFaces.includes(i)) {
      const count = Math.floor(len / (d === 3 ? 1.0 : 2.5));
      for (let k = 1; k < count; k++) {
        const x = (len * k) / count;
        if (hs.some((h) => Math.abs(h.x - x) < h.w * 0.6)) continue;
        const p = map(x, lo + 0.08),
          q = facing(o, Math.atan2(n[0], n[2]), p[0] + n[0] * 0.035, p[2] + n[2] * 0.035);
        if (d === 3) {
          B(q, 'wood', 0, lo + 0.08, 0, 0.035, (hi - lo) * blackFraction - 0.16, 0.04, woodTrim);
          B(q, 'wood', 0, lo + 0.3, 0.015, 0.14, 0.06, 0.05, tint(woodTrim, 1.05));
        } else
          quad(
            q,
            'wood',
            [
              [-0.025, lo + 0.08, 0],
              [0.025, lo + 0.08, 0],
              [0.025, split - 0.08, 0],
              [-0.025, split - 0.08, 0],
            ],
            woodTrim,
            [0, 0, 1],
          );
      }
      if (d === 3) {
        // The board belt stops at real openings, including cusp heads near the plaster line.
        const y = split - 0.04,
          gaps = hs
            .filter((h) => y >= h.y - 0.04 && y <= h.y + h.height + 0.04)
            .map((h) => [Math.max(0, h.x - h.w / 2 - 0.04), Math.min(len, h.x + h.w / 2 + 0.04)])
            .sort((a, b) => a[0] - b[0]);
        let cursor = 0;
        for (const [start, end] of [...gaps, [len, len]]) {
          if (start > cursor + 0.01)
            beam(
              o,
              'wood',
              map(cursor, y).map((v, k) => v + n[k] * 0.045),
              map(start, y).map((v, k) => v + n[k] * 0.045),
              0.07,
              0.06,
              woodTrim,
            );
          cursor = Math.max(cursor, end);
        }
      }
    }
  }
  cap(o, 'wood', r, hi, dark);
}
function bodyHoles(
  r,
  lo,
  hi,
  d,
  {
    cuspSides = [],
    hiddenFaces = [],
    ports = true,
    splitLongFaces = false,
    windowY,
    windowHeight,
  } = {},
) {
  const holes = [];
  if (d === 0) return holes;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 3 || hiddenFaces.includes(i)) continue;
    const w = Math.min(cuspSides.includes(i) ? 1.2 : 1.6, len * 0.35),
      height = windowHeight ?? Math.min(1.3, (hi - lo) * 0.48);
    for (const u of splitLongFaces && len > 12 ? [0.25, 0.75] : [0.5])
      holes.push({
        side: i,
        x: len * u,
        w,
        y: windowY ?? lo + 0.4,
        height,
        cusp: cuspSides.includes(i),
        bars: 5,
      });
    if (ports && d > 1)
      for (const u of [0.18, 0.82])
        holes.push({
          side: i,
          x: len * u,
          w: 0.16,
          y: lo + 0.75,
          height: 0.34,
          bars: 0,
          frame: false,
        });
  }
  return holes;
}
function buildBody(o, r, lo, hi, d, options = {}) {
  facade(o, r, lo, hi, bodyHoles(r, lo, hi, d, options), d, options);
}
function foundation(o, r, top, d, { portal } = {}) {
  const levels =
      d === 0
        ? [
            [-5.0, 2.7],
            [top, 0],
          ]
        : [
            [-5.0, 2.7],
            [-1, 1.45],
            [1.5, 0.55],
            [top, 0],
          ],
    at = (y) => {
      for (let j = 1; j < levels.length; j++)
        if (y <= levels[j][0] + 1e-8) {
          const a = levels[j - 1],
            b = levels[j];
          return expanded(r, a[1] + ((b[1] - a[1]) * (y - a[0])) / (b[0] - a[0]));
        }
      return r;
    };
  const rows = d === 3 ? Math.ceil((top + 5.0) / 0.7) : d === 2 ? 5 : 2,
    ys = [
      ...new Set([
        ...levels.map((p) => p[0]),
        ...Array.from({ length: rows + 1 }, (_, j) => -5.0 + ((top + 5.0) * j) / rows),
        ...(portal ? [portal.y, portal.y + portal.height] : []),
      ]),
    ]
      .filter((y) => y >= -5.00001 && y <= top + 0.00001)
      .sort((a, b) => a - b);
  const stones = ['9a947e', '9e9785', '888b80', 'aaa28a', '82887f'].map(rgb);
  for (let i = 0; i < r.length; i++) {
    const n = outward(r, i),
      L = Math.hypot(...r[(i + 1) % r.length].map((v, k) => v - r[i][k])),
      map = (x, y) => {
        const p = faceAt(at(y), i, x / L);
        return [p[0], y, p[1]];
      },
      h = portal?.side === i ? portal : null;
    for (let j = 1; j < ys.length; j++) {
      const y0 = ys[j - 1],
        y1 = ys[j],
        cols = d === 3 ? Math.ceil(L / 1.2) : d === 2 ? Math.ceil(L / 4) : 1,
        us = [
          ...new Set([
            0,
            L,
            ...Array.from(
              { length: cols - 1 },
              (_, k) => (L * (k + 1 + (((j * 19 + k * 23) % 13) / 13 - 0.5) * 0.4)) / cols,
            ),
            ...(h ? [h.x - h.w / 2, h.x + h.w / 2] : []),
          ]),
        ].sort((a, b) => a - b);
      for (let k = 1; k < us.length; k++) {
        const x0 = us[k - 1],
          x1 = us[k],
          x = (x0 + x1) / 2,
          y = (y0 + y1) / 2;
        if (h && Math.abs(x - h.x) < h.w / 2 && y > h.y && y < h.y + h.height) continue;
        const pts = [map(x0, y0), map(x1, y0), map(x1, y1), map(x0, y1)];
        quad(o, 'stone', pts, d < 2 ? stone : mortar, n);
        if (d > 1) {
          const dx = (x1 - x0) * 0.035,
            dy = (y1 - y0) * 0.06,
            bevel = 0.12 + ((j * 13 + k * 7 + i * 3) % 17) / 100;
          const uv = [
              [x0 + dx, y0 + dy],
              [x1 - dx, y0 + dy * 1.5],
              [x1 - dx, y1 - (y1 - y0) * bevel],
              [x1 - (x1 - x0) * bevel, y1 - dy],
              [x0 + dx * 2, y1 - dy * 0.5],
            ],
            p = uv.map((v) => map(...v).map((q, k) => q + n[k] * 0.025));
          polygon(o, 'stone', p, stones[(j * 7 + k * 11 + i) % stones.length], n);
        }
      }
    }
    if (h) closure(o, map, n, holeShape(h, d), d, { door: true, depth: 1.4, bars: 0 });
  }
  cap(o, 'stone', r, top, stone);
}
function northernRoof(o, d) {
  roof(o, -3.25, -16, 6.0, 8.5, 9.6, 2.4, d, { colour: tile, topX: 0.15, topZ: 7.0 });
}
function ridgeCreature(o, cx, cz, base, h, d, orientation = 0) {
  const q = facing(o, orientation, cx, cz),
    shape =
      d === 0
        ? [
            [-0.55, 0],
            [-0.7, 0.3],
            [0, 0.48],
            [0.13, h],
            [0.52, h * 0.82],
            [0.44, 0.26],
          ]
        : [
            [-0.6, 0],
            [-0.8, 0.18],
            [-0.72, 0.33],
            [-0.28, 0.35],
            [0.02, 0.6 * h],
            [-0.06, 0.92 * h],
            [0.13, h],
            [0.43, 0.9 * h],
            [0.55, 0.73 * h],
            [0.37, 0.42 * h],
            [0.48, 0.24],
            [-0.05, 0.04],
          ];
  for (const z of [-0.12, 0.12])
    polygon(
      q,
      'roof',
      shape.map((p) => [p[0], base + p[1], z]),
      tile,
      [0, 0, z > 0 ? 1 : -1],
    );
  for (let i = 0; i < shape.length; i++) {
    const a = shape[i],
      b = shape[(i + 1) % shape.length];
    quad(
      q,
      'roof',
      [
        [a[0], base + a[1], -0.12],
        [b[0], base + b[1], -0.12],
        [b[0], base + b[1], 0.12],
        [a[0], base + a[1], 0.12],
      ],
      tile,
    );
  }
}
function projection(o, point, n, y, w, d) {
  const q = facing(o, Math.atan2(n[0], n[2]), ...point),
    z = 0.7;
  quad(
    q,
    'wood',
    [
      [-w / 2, y + 0.35, z],
      [w / 2, y + 0.35, z],
      [w / 2, y + 1.6, 0.04],
      [-w / 2, y + 1.6, 0.04],
    ],
    dark,
    [0, 0, 1],
  );
  for (const x of [-w / 2, w / 2])
    triangle(
      q,
      'wood',
      [
        [x, y + 0.35, 0.03],
        [x, y + 0.35, z],
        [x, y + 1.6, 0.04],
      ],
      woodTrim,
      [x < 0 ? -1 : 1, 0, 0],
    );
  quad(
    q,
    'wood',
    [
      [-w / 2, y + 1.6, 0.03],
      [w / 2, y + 1.6, 0.03],
      [w / 2, y + 1.6, -0.12],
      [-w / 2, y + 1.6, -0.12],
    ],
    woodTrim,
    [0, 1, 0],
  );
  if (d > 1)
    for (let x = -w / 2 + 0.3; x < w / 2; x += 0.45)
      beam(q, 'wood', [x, y + 0.42, z + 0.025], [x, y + 1.5, 0.14], 0.035, 0.035, woodTrim);
}
function entrance(o, d) {
  B(o, 'stone', 2.1, 0.3, -12, 2.8, 0.85, 2.4, stone);
  if (d === 0) B(o, 'stone', 4.4, 0.1, -12, 1.8, 0.6, 2.0, stone);
  for (let j = 0; j < (d === 0 ? 0 : 4); j++)
    B(o, 'stone', 3.725 + j * 0.45, 0.1, -12, 0.45, 0.9 - j * 0.15, 2.0, stone);
  const q = facing(o, Math.PI / 2, 2.0, -12);
  roof(q, 0, 0.05, 1.45, 1.1, 3.82, 0.75, d, {
    colour: tile,
    topX: 0.12,
    topZ: 0.75,
    gabled: true,
  });
  if (d > 1) for (const x of [-1.15, 1.15]) B(q, 'wood', x, 1.15, 0.1, 0.12, 2.6, 0.15, woodTrim);
}
function moonRoom(o, d) {
  const cx = 17.5,
    cz = 9.65,
    hx = 3.6,
    hz = 2.7,
    r = rectRing(cx, cz, hx, hz);
  facade(
    o,
    r,
    2.5,
    4.7,
    d === 0
      ? []
      : [0, 1, 2].map((side) => ({
          side,
          x: (side === 1 ? 5.4 : 7.2) / 2,
          w: 1.05,
          y: 3.9,
          height: 0.5,
          bars: 5,
          frame: false,
        })),
    d,
    { blackFraction: 0 },
  );
  B(o, 'wood', cx, 4.58, cz, 8.65, 0.12, 6.9, timber);
  B(o, 'wood', 13.84, 4.7, cz, 0.16, 3.6, 5.7, dark);
  for (const x of [13.9, 21.1])
    for (const z of [6.95, 12.35]) B(o, 'wood', x, 4.7, z, 0.16, 3.6, 0.16, woodTrim);
  if (d > 0)
    for (const z of [6.95, 12.35])
      for (const x of [16.3, 18.7]) B(o, 'wood', x, 4.7, z, 0.12, 3.6, 0.12, woodTrim);
  // Sliding mairado panels are partly parked; north/east/south each keep substantial true openings.
  if (d > 1) {
    for (const z of [6.95, 12.35])
      B(o, 'wood', 15.0, 4.82, z, 1.65, 3.35, 0.08, tint(timber, 0.65));
    B(o, 'wood', 21.1, 4.82, 11.55, 0.08, 3.35, 1.25, tint(timber, 0.65));
    if (d === 3)
      for (let y = 5.1; y < 7.8; y += 0.22) {
        for (const z of [6.9, 12.4]) B(o, 'wood', 15, y, z, 1.64, 0.035, 0.05, woodTrim);
        B(o, 'wood', 21.15, y, 11.55, 0.05, 0.035, 1.25, woodTrim);
      }
  }
  B(o, 'wood', cx, 8.18, cz, 7.4, 0.12, 5.6, timber);
  const rails = [
    [
      [13.2, 6.2],
      [21.8, 6.2],
    ],
    [
      [21.8, 6.2],
      [21.8, 13.1],
    ],
    [
      [21.8, 13.1],
      [13.2, 13.1],
    ],
  ];
  for (const [a, b] of rails) {
    for (const y of [5.0, 5.65]) {
      if (d === 0) {
        const p = [
          [a[0], y - 0.055, a[1]],
          [b[0], y - 0.055, b[1]],
          [b[0], y + 0.055, b[1]],
          [a[0], y + 0.055, a[1]],
        ];
        quad(o, 'metal', p, rail);
        quad(o, 'metal', [...p].reverse(), rail);
      } else beam(o, 'metal', [a[0], y, a[1]], [b[0], y, b[1]], 0.11, 0.13, rail);
    }
    if (d > 0) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        count = Math.ceil(len / (d === 3 ? 0.6 : 1.3));
      for (let k = 0; k <= count; k++) {
        const p = mix(a, b, k / count);
        B(o, 'metal', p[0], 4.7, p[1], 0.09, 1.02, 0.09, rail);
      }
    }
  }
  roof(o, cx, cz, 5.05, 4.1, 8.3, 2.8, d, { colour: tile, topX: 1.8, topZ: 0.2 });
}
export function matsumotoCastle(o, frame = defaultFrame, d = 3) {
  const n = frame.nativeComponents;
  foundation(o, n.main, 3.9, d);
  foundation(o, n.inui, 3.9, d);
  const east = n.watari[1],
    end = n.watari[2],
    L = Math.hypot(end[0] - east[0], end[1] - east[1]),
    u = (-12 - east[1]) / (end[1] - east[1]);
  foundation(o, n.watari, 3.9, d, { portal: { side: 1, x: L * u, w: 1.85, y: 1.15, height: 2.6 } });
  foundation(o, n.tatsumi, 3.9, d);
  foundation(o, n.tsukimi, 2.5, d);
  const main = [
    { r: n.main, lo: 3.9, hi: 7.1, hx: 11.1, hz: 10.0, rise: 1.1, tx: 9.3, tz: 8.1 },
    {
      r: rectRing(0, 0, 9.3, 8.1),
      lo: 8.2,
      hi: 11.7,
      hx: 10.6,
      hz: 9.4,
      rise: 3.1,
      tx: 5.8,
      tz: 5.2,
    },
    {
      r: rectRing(0, 0, 5.8, 5.2),
      lo: 14.8,
      hi: 18.2,
      hx: 7.1,
      hz: 6.5,
      rise: 2.0,
      tx: 4.1,
      tz: 3.7,
    },
    {
      r: rectRing(0, 0, 4.1, 3.7),
      lo: 20.2,
      hi: 22.8,
      hx: 5.4,
      hz: 5.0,
      rise: 0.9,
      tx: 3.6,
      tz: 3.2,
    },
    {
      r: rectRing(0, 0, 3.6, 3.2),
      lo: 23.7,
      hi: 26.1,
      hx: 4.8,
      hz: 4.4,
      rise: 2.3,
      tx: 0.13,
      tz: 3.2,
    },
  ];
  for (let j = 0; j < main.length; j++) {
    const t = main[j];
    buildBody(o, t.r, t.lo, t.hi, d, {
      hiddenFaces: j === 0 ? [2, 6] : j === 1 ? [0] : [],
      ports: true,
    });
    roof(o, 0, 0, t.hx, t.hz, t.hi, t.rise, d, {
      colour: tile,
      topX: t.tx,
      topZ: t.tz,
      gabled: j === 4,
    });
  }
  gable(o, 0, 9.22, 6.3, 12.1, 3.2, d, { colour: tile, whiteFace: false, depth: 3 });
  for (const sign of [-1, 1]) {
    gable(facing(o, (sign * Math.PI) / 2, sign * 6.9, 0), 0, 0, 5.4, 18.45, 3.2, d, {
      colour: tile,
      depth: 2.8,
    });
    gable(facing(o, sign > 0 ? 0 : Math.PI, 0, sign * 4.9), 0, 0, 3.3, 23.05, 1.2, d, {
      colour: tile,
      curved: true,
      depth: 2,
    });
  }
  ridgeCreature(o, 0, 3.1, 28.4, 1, d, Math.PI / 2);
  ridgeCreature(o, 0, -3.1, 28.4, 0.94, d, -Math.PI / 2);
  const nr = [n.inui[0], n.inui[1], n.watari[2], n.watari[3]];
  buildBody(o, nr, 3.9, 6.4, d, { splitLongFaces: true });
  buildBody(o, expanded(nr, -0.2), 7.2, 9.6, d, { splitLongFaces: true });
  roof(o, -3.25, -16.0, 6.0, 8.5, 6.4, 0.8, d, { colour: tile, topX: 4.9, topZ: 7.2 });
  northernRoof(o, d);
  const inui = rectRing(-3.25, -19.4, 2.7, 2.7);
  buildBody(o, inui, 10.4, 14.2, d, {
    cuspSides: [0, 3],
    ports: false,
    windowY: 12.15,
    windowHeight: 1.25,
    blackFraction: 0.62,
  });
  roof(facing(o, Math.PI / 2, -3.25, -19.4), 0, 0, 3.85, 4.0, 14.2, 1.8, d, {
    colour: tile,
    topX: 0.12,
    topZ: 2.7,
    gabled: true,
  });
  ridgeCreature(o, -5.8, -19.4, 16, 0.8, d, 0);
  ridgeCreature(o, -0.7, -19.4, 16, 0.75, d, Math.PI);
  const tr = rectRing(10.5, 7.5, 2.7, 3.6);
  buildBody(o, tr, 3.9, 7.2, d, { hiddenFaces: [1, 3], ports: false });
  roof(o, 10.5, 7.5, 4.0, 4.9, 7.2, 1, d, { colour: tile, topX: 2.7, topZ: 3.6 });
  buildBody(o, tr, 8.2, 12.2, d, { cuspSides: [0, 2], hiddenFaces: [1, 3], ports: false });
  roof(facing(o, Math.PI / 2, 10.5, 7.5), 0, 0, 4.9, 4.0, 12.2, 2.5, d, {
    colour: tile,
    topX: 0.12,
    topZ: 2.7,
    gabled: true,
  });
  if (d >= 0) {
    const projectors = [
      { p: [-9.75, 3.0], n: [-1, 0, 0] },
      { p: [-9.75, -3.3], n: [-1, 0, 0] },
      { p: [-4.0, 8.75], n: [0, 0, 1] },
      { p: [3.6, 8.85], n: [0, 0, 1] },
    ];
    for (const p of d === 0 ? projectors.filter((_, i) => i % 2 === 0) : projectors)
      projection(o, p.p, p.n, 3.9, 2.5, d);
    if (d > 1) for (const z of [-21.0, -12.0]) projection(o, [-8.3, z], [-1, 0, 0], 3.9, 2.0, d);
  }
  entrance(o, d);
  moonRoom(o, d);
}
export const matsumotoCastleSkyline = (o) => matsumotoCastle(o, undefined, 0);
export const matsumotoCastleDistrict = (o) => matsumotoCastle(o, undefined, 1);
export const matsumotoCastleStreet = (o) => matsumotoCastle(o, undefined, 2);
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.97, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.83, metallic: 0.03 },
  wood: { slot: 'door', graph: 'wood_weatherboard', roughness: 0.86, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.73, metallic: 0.04 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.4, metallic: 0.02 },
};
export const matsumotoCastleModel = {
  id: 'matsumoto_castle',
  key: 'matsumoto_castle',
  recipe: 'structure-matsumoto-castle.mjs',
  cell: 'xn/xn6',
  title: 'Matsumoto Castle',
  brief:
    'Five connected historic structures: black lower weatherboards and pale upper plaster, five main gray tiled roof tiers with broad white-edged triangular/curved gables and gray ridge creatures, three-tier northwest Inui with cusp-headed windows, two-story roofed Watari with recessed stone entrance, southeast Tatsumi wing and genuinely open three-sided red-railed Moon room. Irregular natural-stone bases, projected stone-drop shutters, grouped warrior windows and own entry steps. Detached gates, red moat bridge, town, vegetation and interiors excluded.',
  camera: [62, 39, 65],
  lookAt: [2, 13, -4],
  mediumFiContext: { scale: 1.5 },
  qaCameras: [
    { name: 'front', position: [65, 24, -3], lookAt: [2, 13, -4] },
    { name: 'main-west', position: [-39, 20, 18], lookAt: [0, 16, 0] },
    { name: 'back', position: [-36, 27, -42], lookAt: [-2, 12, -8] },
    { name: 'moon-room', position: [35, 10, 22], lookAt: [17.5, 6.4, 9.6] },
    { name: 'entrance', position: [19, 5, -8], lookAt: [2, 2.5, -12] },
    { name: 'roof-and-ridge', position: [25, 34, 26], lookAt: [0, 22, 0] },
    { name: 'inui-cusp', position: [-19, 17, -32], lookAt: [-3.25, 12.5, -19.4] },
    { name: 'overhead', position: [45, 76, 54], lookAt: [2, 4, -5] },
  ],
  build: matsumotoCastle,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Original GSI source field frozen before geometry:16641 samples on128m review grid,590.06m dry east Honmaru court[18,-6].8394 samples1A,57 samples5A,8190 coarser10m fallback where finer NoData, including moat. Own structural floor/threshold contact requires runtime review; source terrain is never fitted or flattened. Host terrain remains conditional.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-matsumoto-castle.mjs',
    level: 'skyline',
    export: 'matsumotoCastleSkyline',
    errorMeters: 1.5,
    surfaces,
    authoredLevels: {
      district: { export: 'matsumotoCastleDistrict', errorMeters: 0.6, surfaces },
      street: { export: 'matsumotoCastleStreet', errorMeters: 0.18, surfaces },
    },
  },
  limitations: [
    ...defaultFrame.limitations,
    'Approximate owner-guide29.4/16.8/12.0/14.7/11.1m heights interpreted as relative exterior silhouette controls from the dry court. Native whole17m height is not applied to every component. Precise vertical endpoints, floor levels, small gable/ornament geometry, panel counts, inferred toe and stair engineering are estimates. No reconstructed interiors, copied heraldry or photographic pixels.',
    'Six individually inspected local2013–2019 originals and30 contact thumbnails plus both actual operator2018 guide pages constrain exterior. Snow in accepted original is not roof colour. Current repair finishes, hidden interiors and unseen junction details are not surveyed. Gray tile shachi are original simplified forms; south male/north female main pair, with no Nagoya gold dimensions.',
    'Independent original GSI tiles and derived field held unchanged. Roughly half the review grid needs coarser fallback, frequently in/near moat. It is not a surveyed water surface or moat bed; encoding and output spacing are not survey accuracy. Compatible host field required; default coarse Earth terrain and precise ground classification are not certified. Footprint replacement disabled.',
  ],
};
