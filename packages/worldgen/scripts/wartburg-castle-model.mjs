/** Wartburg: mapped individual halls, two open courts and reconstructed exterior detail. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const map = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u1/u1p/n0241_wartburg/map-parts.json',
      import.meta.url,
    ),
  ),
);
const stone = [0.59, 0.4, 0.31],
  trim = [0.78, 0.65, 0.44],
  white = [0.88, 0.87, 0.8],
  wood = [0.16, 0.12, 0.085],
  glass = [0.12, 0.17, 0.18];
const slate = [0.26, 0.29, 0.3],
  tile = [0.6, 0.24, 0.12],
  copper = [0.24, 0.55, 0.43];
const master = (o) => !o.detail,
  fine = (o) => !['skyline', 'district', 'street'].includes(o.detail),
  near = (o) => o.detail !== 'skyline' && o.detail !== 'district';
const face = (o, s, p, c) => quad(o, s, p, normalFor(...p), c);
const tri = (o, s, p, c) =>
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
function frame(o, x = 0, y = 0, z = 0, a = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    rot = ([x, y, z]) => [x * c + z * s, y, -x * s + z * c];
  return {
    detail: o.detail,
    ...Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
        k,
        (slot, ref, p, n, uv, color) =>
          o[k](
            slot,
            ref,
            p.map((v) => {
              const q = rot(v);
              return [q[0] + x, q[1] + y, q[2] + z];
            }),
            rot(n),
            uv,
            color,
          ),
      ]),
    ),
  };
}
const edgeFrame = (o, a, b) => frame(o, a[0], 0, a[1], Math.atan2(a[1] - b[1], b[0] - a[0]));
const area = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
function ring(id) {
  const f = map.features.find((f) => f.id === `way/${id}`);
  if (!f) throw new Error(`Missing Wartburg map part ${id}`);
  const p = f.points.map((p) => [...p]);
  if (p[0].join() === p.at(-1).join()) p.pop();
  let more = true;
  while (more && p.length > 4) {
    more = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        l = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (l && Math.abs((c[0] - a[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (c[1] - a[1])) / l < 0.12) {
        p.splice(i, 1);
        more = true;
        break;
      }
    }
  }
  return area(p) < 0 ? p.reverse() : p;
}
function cap(o, p, y, slot, color) {
  const ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3) {
    const q = ix.slice(i, i + 3).map((k) => [p[k][0], y, p[k][1]]);
    if (normalFor(...q)[1] < 0) q.reverse();
    tri(o, slot, q, color);
  }
}
function prism(o, p, y0, y1, slot = 'sandstone', color = stone) {
  cap(o, p, y1, slot, color);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    face(
      o,
      slot,
      [
        [a[0], y1, a[1]],
        [b[0], y1, b[1]],
        [b[0], y0, b[1]],
        [a[0], y0, a[1]],
      ],
      color,
    );
  }
}
function edges(o, p, fn) {
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > 0.35) fn(edgeFrame(o, b, a), len, i);
  }
}
function rect(o, x, y, w, h, color = glass, slot = 'glass', z = 0.045) {
  face(
    o,
    slot,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    color,
  );
}
function line(o, a, b, width = 0.12, slot = 'carved', color = trim) {
  if (master(o)) beam(o, slot, a, b, width, width, color);
  else {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.001) return;
    const dx = ((b[1] - a[1]) * width) / (2 * len),
      dy = ((a[0] - b[0]) * width) / (2 * len);
    const p = [
      [a[0] - dx, a[1] - dy, a[2]],
      [b[0] - dx, b[1] - dy, b[2]],
      [b[0] + dx, b[1] + dy, b[2]],
      [a[0] + dx, a[1] + dy, a[2]],
    ];
    if (normalFor(...p)[2] < 0) p.reverse();
    face(o, slot, p, color);
  }
}
function band(o, p, y, width = 0.22, slot = 'carved', color = trim) {
  edges(o, p, (f, len) => {
    if (master(o)) box(f, slot, [0, y - width / 2, -0.05], [len, y + width / 2, 0.2], color);
    else rect(f, len / 2, y - width / 2, len, width, color, slot, 0.065);
  });
}
function arch(o, x, y, w, h, { color = glass, slot = 'glass', ornament = true } = {}) {
  const r = w / 2,
    spring = y + h - r,
    n = master(o) ? 12 : fine(o) ? 6 : 3;
  const p = [
    [x - r, y],
    [x + r, y],
    [x + r, spring],
  ];
  for (let i = 1; i <= n; i++) {
    const a = (i * Math.PI) / n;
    p.push([x + r * Math.cos(a), spring + r * Math.sin(a)]);
  }
  o.addConvexPolygon(
    slot,
    'palette:#ffffff',
    p.map(([x, y]) => [x, y, 0.055]),
    [0, 0, 1],
    (p) => [p[0], p[1]],
    color,
  );
  if (!ornament || !near(o)) return;
  for (let i = 1; i < p.length; i++) line(o, [...p[i - 1], 0.1], [...p[i], 0.1], 0.13);
  line(o, [x - r, y, 0.1], [x - r, spring, 0.1]);
  if (master(o))
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI) / n,
        b = ((i + 1) * Math.PI) / n;
      face(
        o,
        'carved',
        [
          [x + (r + 0.18) * Math.cos(a), spring + (r + 0.18) * Math.sin(a), 0.12],
          [x + (r + 0.18) * Math.cos(b), spring + (r + 0.18) * Math.sin(b), 0.12],
          [x + r * Math.cos(b), spring + r * Math.sin(b), 0.12],
          [x + r * Math.cos(a), spring + r * Math.sin(a), 0.12],
        ],
        trim.map((v) => v * (0.92 + 0.02 * (i % 4))),
      );
    }
}
function window(o, x, y, w, h) {
  rect(o, x, y, w, h);
  if (!near(o)) return;
  for (const [a, b] of [
    [
      [x - w / 2, y],
      [x - w / 2, y + h],
    ],
    [
      [x + w / 2, y],
      [x + w / 2, y + h],
    ],
    [
      [x - w / 2, y],
      [x + w / 2, y],
    ],
    [
      [x - w / 2, y + h],
      [x + w / 2, y + h],
    ],
    [
      [x, y],
      [x, y + h],
    ],
  ])
    line(o, [...a, 0.12], [...b, 0.12], 0.1, 'wood', wood);
  if (fine(o))
    for (let yy = y + h / 3; yy < y + h - 0.1; yy += h / 3)
      line(o, [x - w / 2, yy, 0.13], [x + w / 2, yy, 0.13], 0.045, 'metal', [0.36, 0.34, 0.29]);
}
function fit(p) {
  let best;
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!len) continue;
    const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
      v = [-u[1], u[0]],
      q = p.map((p) => [p[0] * u[0] + p[1] * u[1], p[0] * v[0] + p[1] * v[1]]),
      lo = [0, 1].map((j) => Math.min(...q.map((p) => p[j]))),
      hi = [0, 1].map((j) => Math.max(...q.map((p) => p[j]))),
      score = (hi[0] - lo[0]) * (hi[1] - lo[1]);
    if (!best || score < best.score) best = { u, v, lo, hi, score };
  }
  return best;
}
function clip(p, axis, mid, sign) {
  const out = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      da = sign * (a[axis] - mid),
      db = sign * (b[axis] - mid);
    if (da >= 0) out.push(a);
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db);
      out.push(a.map((v, j) => v + (b[j] - v) * t));
    }
  }
  return out;
}
/** Gable slopes are clipped to the occupied polygon, including the bent gallery. */
function roof(
  o,
  p,
  y,
  rise,
  { slot = 'tile', color = tile, across = false, wallSlot = 'plaster', wallColor = white } = {},
) {
  const f = fit(p),
    q = p.map((p) => [p[0] * f.u[0] + p[1] * f.u[1], p[0] * f.v[0] + p[1] * f.v[1]]),
    long = f.hi[0] - f.lo[0] > f.hi[1] - f.lo[1] ? 0 : 1,
    axis = across ? long : 1 - long,
    mid = (f.lo[axis] + f.hi[axis]) / 2,
    half = (f.hi[axis] - f.lo[axis]) / 2;
  const height = (p) => y + rise * (1 - Math.abs(p[axis] - mid) / half),
    world = (p, y) => [p[0] * f.u[0] + p[1] * f.v[0], y, p[0] * f.u[1] + p[1] * f.v[1]];
  const ix = earcut(q.flat());
  for (let i = 0; i < ix.length; i += 3)
    for (const sign of [-1, 1]) {
      const ps = clip(
        ix.slice(i, i + 3).map((k) => q[k]),
        axis,
        mid,
        sign,
      );
      for (let j = 1; j < ps.length - 1; j++) {
        const a = [ps[0], ps[j], ps[j + 1]].map((p) => world(p, height(p)));
        if (Math.hypot(...normalFor(...a)) < 0.1) continue;
        if (normalFor(...a)[1] < 0) a.reverse();
        tri(o, slot, a, color);
      }
    }
  // Fill the raking end wall rather than leave a roof floating above an empty triangle.
  for (let i = 0; i < q.length; i++) {
    const a = q[i],
      b = q[(i + 1) % q.length],
      ps = [a];
    if ((a[axis] - mid) * (b[axis] - mid) < 0) {
      const t = (mid - a[axis]) / (b[axis] - a[axis]);
      ps.push(a.map((v, j) => v + (b[j] - v) * t));
    }
    ps.push(b);
    for (let j = 1; j < ps.length; j++) {
      const a = ps[j - 1],
        b = ps[j],
        ha = height(a),
        hb = height(b);
      if (Math.max(ha, hb) < y + 0.001) continue;
      const v = [world(a, ha), world(b, hb), world(b, y), world(a, y)].filter(
        (p, i, a) => i === 0 || Math.hypot(...p.map((v, j) => v - a[i - 1][j])) > 0.001,
      );
      if (v.length >= 3) {
        if (v.length === 4 && Math.hypot(...v[0].map((n, j) => n - v[3][j])) < 0.001) v.pop();
        if (v.length === 3) tri(o, wallSlot, v, wallColor);
        else face(o, wallSlot, v, wallColor);
      }
    }
  }
  // Raised seams on copper; courses on slate/tile. Geometry belongs only in the master.
  if (master(o)) {
    const along = 1 - axis;
    for (let pos = f.lo[along] + 0.6; pos < f.hi[along]; pos += slot === 'copper' ? 0.65 : 0.5) {
      const cuts = [];
      for (let i = 0; i < q.length; i++) {
        const a = q[i],
          b = q[(i + 1) % q.length];
        if ((a[along] <= pos && b[along] > pos) || (b[along] <= pos && a[along] > pos)) {
          const t = (pos - a[along]) / (b[along] - a[along]);
          cuts.push(a.map((v, j) => v + (b[j] - v) * t));
        }
      }
      cuts.sort((a, b) => a[axis] - b[axis]);
      for (let k = 0; k + 1 < cuts.length; k += 2) {
        const a = cuts[k],
          b = cuts[k + 1],
          ps = [a];
        if (a[axis] < mid && b[axis] > mid) {
          const p = [...a];
          p[axis] = mid;
          ps.push(p);
        }
        ps.push(b);
        for (let j = 1; j < ps.length; j++)
          beam(
            o,
            slot,
            world(ps[j - 1], height(ps[j - 1]) + 0.035),
            world(ps[j], height(ps[j]) + 0.035),
            0.035,
            0.045,
            color.map((v) => v * 0.86),
          );
      }
    }
  }
}
function halfTimber(o, p, y0, y1, { step = 2.5, windows = true } = {}) {
  if (!near(o)) return;
  edges(o, p, (f, len) => {
    if (len < 1.1) return;
    const n = Math.max(1, Math.round(len / step)),
      w = len / n;
    for (const y of [y0, y0 + (y1 - y0) * 0.5, y1])
      line(f, [0, y, 0.11], [len, y, 0.11], 0.18, 'wood', wood);
    for (let i = 0; i <= n; i++) line(f, [i * w, y0, 0.12], [i * w, y1, 0.12], 0.17, 'wood', wood);
    for (let i = 0; i < n; i++) {
      if (windows && w > 1.3)
        window(f, (i + 0.5) * w, y0 + (y1 - y0) * 0.56, Math.min(1.1, w * 0.55), (y1 - y0) * 0.32);
      if (fine(o)) {
        const y = y0 + (y1 - y0) * 0.15;
        line(f, [i * w, y0, 0.13], [(i + 0.5) * w, y, 0.13], 0.1, 'wood', wood);
        line(f, [(i + 0.5) * w, y, 0.13], [(i + 1) * w, y0, 0.13], 0.1, 'wood', wood);
      }
    }
  });
}
function masonry(o, p, height) {
  if (!master(o)) return;
  edges(o, p, (f, len) => {
    if (len < 0.5) return;
    for (let y = 0.4; y < height; y += 0.5)
      for (let x = (Math.round(y * 2) % 2) * 0.65; x < len; x += 1.3) {
        const w = Math.min(1.26, len - x - 0.02);
        if (w > 0.05)
          rect(
            f,
            x + w / 2,
            y,
            w,
            0.465,
            stone.map((v) => v * (0.88 + 0.04 * (Math.round(x * 7 + y * 3) % 5))),
            'sandstone',
            0.005,
          );
      }
  });
}
function crenels(o, p, y, slot = 'sandstone', color = stone) {
  edges(o, p, (f, len) => {
    box(f, slot, [0, y - 0.5, -0.3], [len, y + 0.15, 0.2], color);
    const n = Math.max(2, Math.round(len / 1.8));
    for (let i = 0; i < n; i++)
      box(f, slot, [(i * len) / n, y, -0.3], [(i * len) / n + (len / n) * 0.52, y + 1, 0.2], color);
  });
}
function quoin(o, p, y, h) {
  if (!fine(o)) return;
  edges(o, p, (f, len) => {
    for (let yy = y; yy < h; yy += 0.6) {
      const w = Math.round(yy / 0.6) % 2 ? 0.5 : 0.8;
      rect(f, w / 2, yy, w, 0.53, trim, 'carved', 0.03);
      rect(f, len - w / 2, yy, w, 0.53, trim, 'carved', 0.03);
    }
  });
}
function keep(o) {
  const p = ring(217972837);
  prism(o, p, 0, 28.5);
  if (o.detail === 'skyline') {
    const cx = 14.15,
      cz = 4.55;
    box(o, 'copper', [cx - 1.2, 28.5, cz - 1.2], [cx + 1.2, 30, cz + 1.2], copper);
    box(o, 'gold', [cx - 0.12, 30, cz - 0.12], [cx + 0.12, 34, cz + 0.12], [0.85, 0.7, 0.21]);
    box(o, 'gold', [cx - 1, 32.45, cz - 0.12], [cx + 1, 32.7, cz + 0.12], [0.85, 0.7, 0.21]);
    return;
  }
  masonry(o, p, 27.4);
  for (const y of [1.1, 13.6, 27.4]) band(o, p, y, 0.27);
  crenels(o, p, 28.2);
  quoin(o, p, 0, 27.4);
  edges(o, p, (f, len) => {
    if (len < 4) return;
    for (const y of [4, 10, 18.4]) arch(f, len * 0.5, y, 0.75, 1.45);
    for (const x of [len * 0.43, len * 0.57]) arch(f, x, 24.2, 0.82, 1.6);
    if (fine(o)) {
      rect(f, len * 0.5, 23.8, 2.25, 0.16, trim, 'carved');
      rect(f, len * 0.5, 26.1, 2.25, 0.16, trim, 'carved');
    }
  });
  loft(
    o,
    'copper',
    [
      radialRing(28.5, 1.65, 1.65, 4, [14.15, 4.55], Math.PI / 4),
      radialRing(30.2, 0.3, 0.3, 4, [14.15, 4.55], Math.PI / 4),
    ],
    copper,
  );
  box(o, 'gold', [14.02, 30.2, 4.43], [14.28, 34, 4.69], [0.85, 0.7, 0.21]);
  box(o, 'gold', [13.1, 32.7, 4.43], [15.2, 32.96, 4.69], [0.85, 0.7, 0.21]);
  if (near(o)) {
    const f = frame(o, 9.2, 0, 1.2, 0.22);
    for (let i = 0; i < 15; i++)
      box(f, 'sandstone', [-3 + i * 0.2, i * 0.19, 0], [-2.6 + i * 0.2, (i + 1) * 0.19, 1.3], trim);
  }
}
function palas(o) {
  const p = ring(217972867);
  prism(o, p, 0, 15.5);
  roof(o, p, 15.5, 7.2, { slot: 'copper', color: copper, wallSlot: 'sandstone', wallColor: stone });
  if (o.detail === 'skyline' || o.detail === 'district') return;
  masonry(o, p, 15.5);
  for (const y of [1, 5.3, 10.3, 15.3]) band(o, p, y, 0.22);
  edges(o, p, (f, len) => {
    if (len < 9) return;
    const bays = len > 25 ? 7 : 2,
      pitch = len / bays;
    for (let j = 0; j < bays; j++) {
      const cx = (j + 0.5) * pitch;
      if (len > 25) {
        for (const y of [6.1, 11.15]) {
          const lights = j < 3 ? 4 : 3,
            w = Math.min(0.72, (pitch - 1) / lights);
          for (let k = 0; k < lights; k++) {
            const x = cx + (k - (lights - 1) / 2) * (w + 0.12);
            arch(f, x, y, w, 2.05);
            if (fine(o)) {
              tube(
                f,
                'carved',
                [x - w / 2 - 0.06, y, 0.16],
                [x - w / 2 - 0.06, y + 1.66, 0.16],
                0.075,
                0.075,
                master(o) ? 10 : 6,
                trim,
              );
              box(
                f,
                'carved',
                [x - w / 2 - 0.17, y + 1.53, 0.035],
                [x - w / 2 + 0.06, y + 1.7, 0.25],
                trim,
              );
            }
            if (master(o))
              for (let yy = y + 0.15; yy < y + 1.7; yy += 0.26) {
                line(
                  f,
                  [x - w / 2 + 0.08, yy, 0.076],
                  [x + w / 2 - 0.08, yy + 0.15, 0.076],
                  0.013,
                  'metal',
                  [0.4, 0.42, 0.41],
                );
              }
          }
        }
        for (const dx of [-0.6, 0.6]) arch(f, cx + dx, 1, 1.05, 2.55);
        if (fine(o))
          arch(f, cx, 1.05, 2.55, 3.42, {
            color: stone.map((v) => v * 0.9),
            slot: 'sandstone',
            ornament: true,
          });
        // Repaint actual paired openings in front of the encompassing blind arch.
        if (fine(o))
          for (const dx of [-0.6, 0.6]) arch(frame(f, 0, 0, 0.08), cx + dx, 1, 1.05, 2.55);
      } else for (const y of [4.1, 10.5, 16.2]) arch(f, cx, y, 1.4, 2.2);
    }
    if (fine(o))
      for (const y of [5.05, 10.05, 15.05])
        for (let x = 0.38; x < len - 0.2; x += 0.64)
          arch(f, x, y - 0.45, 0.48, 0.47, {
            slot: 'sandstone',
            color: stone.map((v) => v * 0.62),
            ornament: master(o),
          });
  });
  if (master(o)) {
    for (const x of [-29, 6]) {
      box(
        o,
        'carved',
        [x - 0.65, 22.5, 15.4],
        [x + 0.65, 22.9, 16.7],
        trim,
      ); /* Sculptural bases only; the historic lions are explicitly pending. */
    }
  }
}
function timberHalls(o) {
  const buildings = [
    [217973920, 8.2, 6.2, 'slate'],
    [217972836, 13.5, 5, 'slate'],
    [218083100, 8.3, 4.9, 'tile'],
    [218083099, 9.7, 6, 'tile'],
    [940760146, 3.4, 2, 'tile'],
    [940760147, 3.4, 1.8, 'tile'],
  ];
  for (const [id, h, r, s] of buildings) {
    if (o.detail === 'skyline' && (id === 940760146 || id === 940760147)) continue;
    const p = ring(id);
    prism(o, p, 0, h, id === 217972836 ? 'sandstone' : 'plaster', id === 217972836 ? stone : white);
    roof(o, p, h, r, {
      slot: s,
      color: s === 'slate' ? slate : tile,
      wallSlot: id === 217972836 ? 'sandstone' : 'plaster',
      wallColor: id === 217972836 ? stone : white,
    });
    if (o.detail === 'skyline') continue;
    if (id === 217972836) {
      masonry(o, p, h);
      edges(o, p, (f, len) => {
        if (len > 5)
          for (let x = 2; x < len - 1; x += 2.5) {
            window(f, x, 3.5, 1, 1.5);
            window(f, x, 8.5, 1.1, 2.1);
          }
      });
      band(o, p, 7, 0.2);
    } else
      halfTimber(o, p, id === 217973920 ? 2.2 : 3.1, h, { step: id === 217973920 ? 2.2 : 2.8 });
    if (near(o)) {
      band(o, p, h, 0.2, 'wood', wood);
      if (id === 217973920) {
        const f = frame(o, -12, 0, -10, Math.PI / 2);
        arch(f, 0, 0, 2.1, 3.6, { slot: 'wood', color: wood });
      }
      if (fine(o) && id !== 940760146 && id !== 940760147) {
        const b = fit(p),
          uv = [0, 1].map((i) => (b.lo[i] + b.hi[i]) / 2);
        const p0 = [uv[0] * b.u[0] + uv[1] * b.v[0], uv[0] * b.u[1] + uv[1] * b.v[1]];
        box(
          o,
          'sandstone',
          [p0[0] - 0.4, h + r - 0.8, p0[1] - 0.4],
          [p0[0] + 0.4, h + r + 0.8, p0[1] + 0.4],
          stone,
        );
      }
    }
  }
  // Oriented projecting stone oriel on the Vogtei's south gable.
  if (near(o)) {
    const f = frame(o, 56.4, 0, -13.6, -Math.PI / 2);
    loft(
      f,
      'wood',
      [
        radialRing(3.7, 0.15, 0.15, 6, [0, 0.65], Math.PI / 6),
        radialRing(5, 1.1, 1, 6, [0, 0.65], Math.PI / 6),
        radialRing(8.4, 1.1, 1, 6, [0, 0.65], Math.PI / 6),
      ],
      wood,
    );
    loft(
      f,
      'copper',
      [
        radialRing(8.4, 1.3, 1.2, 6, [0, 0.65], Math.PI / 6),
        radialRing(10, 0.08, 0.08, 6, [0, 0.65], Math.PI / 6),
      ],
      copper,
    );
    for (const a of [-Math.PI / 3, 0, Math.PI / 3]) {
      const side = frame(f, Math.sin(a) * 0.97, 0, 0.65 + Math.cos(a) * 0.87, a);
      arch(side, 0, 5.45, 0.73, 2.35, { color: glass });
      if (fine(o))
        for (const y of [5.8, 6.4, 7])
          line(side, [-0.3, y, 0.14], [0.3, y, 0.14], 0.04, 'wood', wood);
    }
  }
}
function galleries(o) {
  for (const id of [217973918, 217973921]) {
    const p = ring(id);
    prism(o, p, 0, 5.7, 'plaster', white);
    roof(o, p, 5.7, 1.7);
    if (o.detail === 'skyline') continue;
    halfTimber(o, p, 3.6, 5.7, { step: 2.1, windows: false });
    edges(o, p, (f, len) => {
      if (len < 4) return;
      for (let x = 1.1; x < len - 0.5; x += 2.1) {
        rect(f, x, 4.0, 0.72, 1.25, wood, 'wood');
        if (fine(o))
          for (const dx of [-0.22, 0, 0.22])
            line(f, [x + dx, 4, 0.15], [x + dx, 5.25, 0.15], 0.065, 'wood', wood);
      }
    });
  }
}
/** A true arched passage, with intrados and soffit: neither gate is a solid box. */
function gate(o, x, z, angle, width, depth, height, rise, slot = 'sandstone', color = stone) {
  const f = frame(o, x, 0, z, angle),
    opening = 2.5,
    r = opening / 2,
    spring = 2.6;
  box(f, slot, [-width / 2, 0, -depth / 2], [-r, height, depth / 2], color);
  box(f, slot, [r, 0, -depth / 2], [width / 2, height, depth / 2], color);
  box(f, slot, [-r, spring + r, -depth / 2], [r, height, depth / 2], color);
  const n = o.detail === 'skyline' ? 4 : master(o) ? 20 : 8;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n,
      ax = r * Math.cos(a),
      ay = spring + r * Math.sin(a),
      bx = r * Math.cos(b),
      by = spring + r * Math.sin(b);
    for (const side of [-1, 1]) {
      const q = [
        [ax, ay, (side * depth) / 2],
        [bx, by, (side * depth) / 2],
        [bx, spring + r, (side * depth) / 2],
        [ax, spring + r, (side * depth) / 2],
      ];
      if (side > 0) q.reverse();
      if (Math.abs(ax - bx) > 0.001 && Math.min(ay, by) < spring + r - 0.001) {
        if (Math.hypot(...q[1].map((v, j) => v - q[2][j])) > 0.001)
          tri(f, slot, [q[0], q[1], q[2]], color);
        if (Math.hypot(...q[0].map((v, j) => v - q[3][j])) > 0.001)
          tri(f, slot, [q[0], q[2], q[3]], color);
      }
    }
    face(
      f,
      slot,
      [
        [ax, ay, -depth / 2],
        [ax, ay, depth / 2],
        [bx, by, depth / 2],
        [bx, by, -depth / 2],
      ],
      trim,
    );
  }
  const p = [
    [-width / 2, -depth / 2],
    [width / 2, -depth / 2],
    [width / 2, depth / 2],
    [-width / 2, depth / 2],
  ];
  roof(f, p, height, rise, {
    slot: slot === 'plaster' ? 'tile' : 'slate',
    color: slot === 'plaster' ? tile : slate,
  });
  if (near(o))
    for (const side of [-1, 1]) {
      const g = frame(f, 0, 0, (side * depth) / 2, side > 0 ? 0 : Math.PI);
      if (height > 6) {
        for (const x of [-width * 0.28, 0, width * 0.28]) window(g, x, height - 2.8, 1, 1.6);
        if (slot === 'plaster')
          halfTimber(
            g,
            [
              [-width / 2, -0.05],
              [width / 2, -0.05],
              [width / 2, 0],
              [-width / 2, 0],
            ],
            4.2,
            height,
            { step: 2.5, windows: false },
          );
      }
    }
}
function innerCourt(o) {
  const p = ring(636506075);
  prism(o, p, 0, 16.3);
  roof(o, p, 16.3, 5.1, { slot: 'slate', color: slate, wallSlot: 'sandstone', wallColor: stone });
  if (near(o)) {
    masonry(o, p, 16);
    band(o, p, 8, 0.25);
    band(o, p, 15.8, 0.3);
    edges(o, p, (f, len) => {
      if (len < 4) return;
      for (let x = 1.5; x < len - 0.7; x += 2.9) {
        for (const y of [3, 9.5]) arch(f, x, y, 1.3, 2.1);
      }
    });
  }
  const stair = ring(217973919);
  prism(o, stair, 0, 12.7);
  roof(o, stair, 12.7, 3.3, {
    slot: 'slate',
    color: slate,
    across: true,
    wallSlot: 'sandstone',
    wallColor: stone,
  });
  if (near(o))
    edges(o, stair, (f, len) => {
      for (let x = 1.5; x < len - 1; x += 2.5) for (const y of [4, 8]) arch(f, x, y, 1.1, 1.9);
    });
  gate(o, 22.25, -4.0, -Math.PI / 2, 7.2, 11.9, 7.3, 2.3);
  gate(o, 85.3, -0.05, -Math.PI / 2, 7.3, 11.6, 10.5, 4.2, 'plaster', white);
  // South tower with external covered stair, distinct from the tall sandstone keep.
  const t = ring(42440072);
  prism(o, t, 0, 19.7, 'plaster', white);
  if (o.detail !== 'skyline') {
    crenels(o, t, 19.5, 'plaster', white);
    band(o, t, 19.3, 0.22);
    quoin(o, t, 0, 19.3);
    edges(o, t, (f, len) => {
      for (const y of [6, 13, 17]) rect(f, len / 2, y, 0.52, 0.95);
    });
  }
  if (near(o)) {
    const f = frame(o, -35.9, 0, 3.6, Math.PI - 0.24);
    const len = 10,
      base = 0.3,
      top = 11.7;
    for (let i = 0; i < 40; i++)
      box(
        f,
        'wood',
        [(i * len) / 40, base + (i * (top - base)) / 40, -1.4],
        [((i + 1) * len) / 40, base + ((i + 1) * (top - base)) / 40, 0],
        wood,
      );
    for (const z of [-1.4, 0]) {
      beam(f, 'wood', [0, base + 1, z], [len, top + 1, z], 0.13, 0.13, wood);
      beam(f, 'wood', [0, base + 3, z], [len, top + 3, z], 0.15, 0.15, wood);
      for (let i = 0; i <= 10; i++)
        box(
          f,
          'wood',
          [i - 0.06, base + (i * (top - base)) / len, z - 0.05],
          [i + 0.06, base + (i * (top - base)) / len + 3, z + 0.05],
          wood,
        );
    }
    face(
      f,
      'tile',
      [
        [0, base + 3.5, -0.7],
        [len, top + 3.5, -0.7],
        [len, top + 3.2, -1.8],
        [0, base + 3.2, -1.8],
      ],
      tile,
    );
    face(
      f,
      'tile',
      [
        [0, base + 3.2, 0.4],
        [len, top + 3.2, 0.4],
        [len, top + 3.5, -0.7],
        [0, base + 3.5, -0.7],
      ],
      tile,
    );
  }
  // Ritterbad: smaller southern projection, separately mapped below the Palas gable.
  const bath = ring(217973923);
  prism(o, bath, 0, 4.8);
  roof(o, bath, 4.8, 2.4, { slot: 'slate', color: slate });
  if (near(o))
    edges(o, bath, (f, len) => {
      if (len > 2) for (let x = 1; x < len - 0.6; x += 1.5) arch(f, x, 1.5, 0.9, 1.8);
    });
}
function walls(o) {
  const f = map.features.find((f) => f.id === 'way/217973922'),
    p = f.points;
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1],
      b = p[i],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.2) continue;
    const out = edgeFrame(o, a, b);
    box(out, 'sandstone', [0, 0, -0.3], [len, 2.2, 0.3], stone);
    if (near(o))
      for (let x = 0.3; x < len; x += 1.6)
        box(out, 'sandstone', [x, 2.2, -0.3], [Math.min(len, x + 0.7), 2.9, 0.3], stone);
  }
  // Low cistern enclosure follows the mapped circular wall; no fictitious large tower.
  if (o.detail === 'skyline') return;
  const well = ring(940756325);
  edges(o, well, (f, len) => box(f, 'sandstone', [0, 0, -0.15], [len, 0.65, 0.15], stone));
  if (fine(o)) {
    tube(o, 'sandstone', [-28.4, 0.1, 3.5], [-28.4, 1.05, 3.5], 0.85, 0.85, 24, trim);
    for (const x of [-29.5, -27.3])
      box(o, 'metal', [x - 0.04, 1, 3.46], [x + 0.04, 2.4, 3.54], wood);
    beam(o, 'metal', [-29.5, 2.4, 3.5], [-27.3, 2.4, 3.5], 0.08, 0.08, wood);
  }
}
export function buildWartburgRuntime(out, detail) {
  const o = { ...out, detail };
  palas(o);
  keep(o);
  timberHalls(o);
  galleries(o);
  innerCourt(o);
  walls(o);
}
export function buildWartburgSkyline(out) {
  buildWartburgRuntime(out, 'skyline');
}
export const wartburgStudy = {
  id: 'N0241',
  key: 'wartburg',
  title: 'Wartburg',
  category: 'castle',
  wikidataId: 'Q151545',
  mapFrame: 'map-frame.json',
  build: (out) => buildWartburgRuntime(out),
  brief:
    'The long two-court Wartburg complex: Romanesque Palas with green copper roof and grouped round-arched windows; sandstone Bergfried and gilded cross; white South Tower; half-timbered Gadem, Vogtei and Ritterhaus; bent covered galleries, open gate passages, Neue Kemenate and Ritterbad.',
  sourceFacts: {
    mapIdentity: 'OSM node/2272817622, exact Q151545',
    componentFootprints: 21,
    crossHeightMeters: 3.8,
    bergfriedHeightConflict:
      'OSM tags give 40–46 m; owner describes nearly 34 m. Reconstruction uses a 34 m top including cross pending measured datum.',
    surveyedVerticalDimensions: false,
  },
  reconstruction: {
    basis:
      'Individual OSM building polygons, official illustrated plan and inspected exterior photographs.',
    verticalDatum:
      'Provisional common ground; courtyard levels and hill require site verification.',
    bergfriedTopMeters: 34,
    southTowerTopMeters: 20.5,
    palasEavesMeters: 15.5,
    palasRoofRidgeMeters: 22.7,
  },
  scaleBasis:
    'Meter-scale OSM footprint coordinates; signed +X from South Tower toward gatehouse. Published 3.8 m cross height constrains keep crown; most vertical dimensions are reconstructed.',
  refs: [
    'https://www.openstreetmap.org/node/2272817622',
    'https://www.wartburg.de/lageplan',
    'https://www.wartburg.de/gebaeude/bergfried',
    'https://www.wartburg.de/objekt-des-monats-archiv/das-kreuz-auf-dem-bergfried',
    'https://commons.wikimedia.org/wiki/File:Wartburg-Courtyard.01.JPG',
    'https://commons.wikimedia.org/wiki/File:Eisenach_Wartburg_18.JPG',
    'https://commons.wikimedia.org/wiki/File:Eisenach_Wartburg_17.jpg',
    'https://commons.wikimedia.org/wiki/File:Wartburg_Vogtei.jpg',
  ],
  sourceDocuments: ['map-frame.json', 'map-parts.json', 'reference-metadata.json'],
  dataAttribution:
    'Map geometry © OpenStreetMap contributors, ODbL-1.0. Photographs and official plan linked as references only; no copied photographic textures or third-party mesh.',
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X from Suedturm toward Torhaus (north)',
    front: '+Z toward eastern Palas exterior',
    origin: 'Exact OSM Q151545 point, provisional terrain-contact datum',
  },
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    reviewStatus: 'Component horizontal map frame; terrain datum and geographic fit pending',
    notes:
      'Exact point identity and named component footprints. Envelope includes two open courts and must not replace map buildings as one solid polygon. Site levels and outer covered stair require review.',
  }),
  geographicNote:
    'Draft geographic registration from a signed source-local frame. Terrain fit remains pending; no automatic footprint replacement.',
  limitations: [
    'Maximum fidelity remains pending: exterior reconstruction is not surveyed as-built geometry. Heights, stair elevations, roof junctions, window spacing and weathering require more source comparison.',
    'Palas heraldic lions and carved capitals, precise Gothic oriel tracery and roof dormers are incomplete. No sculpture is claimed as a faithful individual reproduction.',
    'The keep height is deliberately provisional because OSM height tags disagree with the owner description. Cross is 3.8 m; ground and parapet datums need measurement.',
    'Vogtei roof is represented as a gable instead of its exact half-hip profile. Gadem roof intersections and covered South Tower stair attachment need further review.',
    'No interiors, landscape hill, trees, temporary works or photographic textures. Open courtyard voids are preserved.',
    'Shared sandstone, raw limestone, plaster, timber, slate, tile, copper, painted metal and gold-colored stainless graphs; local PBR glazing.',
  ],
  camera: { position: [-92, 75, 100], lookAt: [15, 8, 0], fov: 42 },
  qaCameras: [
    { name: 'palas-court-arcades', position: [-2, 13, -4], lookAt: [-12, 8, 12] },
    { name: 'palas-east-roof', position: [-44, 35, 82], lookAt: [-10, 11, 17] },
    { name: 'bergfried-and-cross', position: [-17, 29, -37], lookAt: [14, 20, 4] },
    { name: 'south-tower-and-gadem', position: [-59, 34, -40], lookAt: [-38, 9, -7] },
    { name: 'vogtei-oriel', position: [29, 18, 8], lookAt: [62, 7, -13] },
    { name: 'northern-gatehouse', position: [130, 25, 17], lookAt: [82, 7, -6] },
    { name: 'northern-court-galleries', position: [58, 20, 1], lookAt: [35, 6, -5] },
    { name: 'western-halls', position: [-15, 39, -104], lookAt: [16, 8, -10] },
    { name: 'two-open-courts-plan', position: [15, 145, 25], lookAt: [15, 0, 0] },
  ],
};
