/** Chambord: native keep/court, eight body towers and individually researched roof skyline. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad as rawQuad } from './structure-mesh.mjs';

const root = new URL(
    '../../../content/worldgen/source/places/u0/u03/chateau_de_chambord/',
    import.meta.url,
  ),
  frame = JSON.parse(fs.readFileSync(new URL('map-frame.json', root))),
  terrain = JSON.parse(fs.readFileSync(new URL('terrain-grid.json', root))),
  ref = 'palette:#ffffff',
  cream = rgb('d9d2bf'),
  trim = rgb('e0d8c4'),
  darkStone = rgb('aaa599'),
  glass = rgb('53605f'),
  slate = rgb('59616a'),
  lead = rgb('718499'),
  iron = rgb('41494f'),
  oak = rgb('76614e'),
  gold = rgb('b49a55');
const area = (r) =>
  r.reduce((v, p, i) => v + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0) /
  2;
function quad(o, slot, ps, n, col) {
  if (normalFor(...ps).reduce((v, a, i) => v + a * n[i], 0) < 0) ps = [...ps].reverse();
  rawQuad(o, slot, ps, n, col);
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
    addCap: (s, r, p, h, y, n, u, c) => o.addCap(s, r, p, h, y, n, u, c),
    addConvexPolygon: (s, r, p, n, u, c) => {
      const pp = p.map(q),
        uv = p.map(u);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => uv[pp.indexOf(p)], c);
    },
  };
}
const rect = (x, y, w, h) => [
  [x - w / 2, y],
  [x + w / 2, y],
  [x + w / 2, y + h],
  [x - w / 2, y + h],
];
function flat(o, slot, ps, col, holes = [], n = [0, 0, 1]) {
  const all = [...ps, ...holes.flat()],
    starts = holes.map((_, i) => ps.length + holes.slice(0, i).reduce((n, r) => n + r.length, 0)),
    idx = earcut(
      all.flatMap((p) => [p[0], p[1]]),
      starts,
    );
  for (let i = 0; i < idx.length; i += 3) {
    const p = idx.slice(i, i + 3).map((j) => all[j]);
    if (normalFor(...p).reduce((v, a, j) => v + a * n[j], 0) < 0) p.reverse();
    o.addTriangle(
      slot,
      ref,
      p,
      n,
      p.map((p) => [p[0], p[1]]),
      col,
    );
  }
}
const surface = (o, s, p, z, c) =>
  flat(
    o,
    s,
    p.map((v) => [...v, z]),
    c,
  );
function poly(o, s, r, y0, y1, col) {
  const ids = earcut(r.flat());
  for (const [y, n] of [
    [y0, [0, -1, 0]],
    [y1, [0, 1, 0]],
  ])
    for (let i = 0; i < ids.length; i += 3) {
      const p = ids.slice(i, i + 3).map((j) => [r[j][0], y, r[j][1]]);
      if (normalFor(...p)[1] * n[1] < 0) p.reverse();
      o.addTriangle(
        s,
        ref,
        p,
        n,
        p.map((p) => [p[0], p[2]]),
        col,
      );
    }
  const area = r.reduce(
    (v, p, i) => v + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1],
    0,
  );
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      p = [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      n = [(b[1] - a[1]) * Math.sign(area), 0, (a[0] - b[0]) * Math.sign(area)],
      l = Math.hypot(...n);
    if (l < 1e-7) continue;
    quad(
      o,
      s,
      p,
      n.map((v) => v / l),
      col,
    );
  }
}
function panel(o, s, ps, z0, z1, c) {
  surface(o, s, ps, z1, c);
  flat(
    o,
    s,
    ps.map((v) => [...v, z0]),
    c,
    [],
    [0, 0, -1],
  );
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i],
      b = ps[(i + 1) % ps.length],
      p = [
        [...a, z0],
        [...b, z0],
        [...b, z1],
        [...a, z1],
      ];
    quad(o, s, p, normalFor(...p), c);
  }
}
function wall(o, ps, holes, z, depth, col = cream, slot = 'stone') {
  flat(
    o,
    slot,
    ps.map((v) => [...v, z]),
    col,
    holes.map((r) => r.map((v) => [...v, z])),
  );
  for (const r of holes)
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        p = [
          [...a, z],
          [...a, z - depth],
          [...b, z - depth],
          [...b, z],
        ];
      quad(o, slot, p, normalFor(...p), darkStone);
    }
}
function outline(o, slot, ps, z, width, col, closed = false) {
  for (let i = 1; i < ps.length + (closed ? 1 : 0); i++) {
    const a = ps[i - 1],
      b = ps[i % ps.length],
      l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l < 1e-6) continue;
    const u = [(-(b[1] - a[1]) * width) / l / 2, ((b[0] - a[0]) * width) / l / 2],
      p = [
        [a[0] - u[0], a[1] - u[1], z],
        [b[0] - u[0], b[1] - u[1], z],
        [b[0] + u[0], b[1] + u[1], z],
        [a[0] + u[0], a[1] + u[1], z],
      ];
    quad(o, slot, p, [0, 0, 1], col);
  }
}
function arch(x, bottom, w, spring, rise, segments = 12) {
  return [
    [x - w / 2, bottom],
    [x + w / 2, bottom],
    ...Array.from({ length: segments + 1 }, (_, i) => {
      const a = (i / segments) * Math.PI;
      return [x + (w / 2) * Math.cos(a), spring + rise * Math.sin(a)];
    }),
  ];
}
function circle(x, y, rx, ry, n = 20) {
  return Array.from({ length: n }, (_, i) => [
    x + rx * Math.cos((i * 2 * Math.PI) / n),
    y + ry * Math.sin((i * 2 * Math.PI) / n),
  ]);
}
function roof(o, x0, x1, z0, z1, eave, ridge, col = slate) {
  const m = (x0 + x1) / 2,
    hip = Math.min((x1 - x0) / 2, (z1 - z0) * 0.28),
    a = [m, ridge, z0 + hip],
    b = [m, ridge, z1 - hip];
  for (const p of [
    [[x0, eave, z0], [x1, eave, z0], a],
    [[x1, eave, z1], [x0, eave, z1], b],
  ]) {
    if (normalFor(...p)[1] < 0) p.reverse();
    o.addTriangle(
      'roof',
      ref,
      p,
      normalFor(...p),
      p.map((v) => [v[0], v[2]]),
      col,
    );
  }
  for (const p of [
    [[x0, eave, z1], [x0, eave, z0], a, b],
    [[x1, eave, z0], [x1, eave, z1], b, a],
  ]) {
    const n = normalFor(...p);
    quad(o, 'roof', p, n[1] < 0 ? n.map((v) => -v) : n, col);
  }
}
function cylinder(o, slot, x, z, y0, y1, r0, r1, col, n = 24) {
  loft(o, slot, [radialRing(y0, r0, r0, n, [x, z]), radialRing(y1, r1, r1, n, [x, z])], col);
}
function finial(o, d, x, y, z, h = 1.2) {
  if (d === 0) return;
  beam(o, 'lead', [x, y, z], [x, y + h, z], d === 1 ? 0.055 : 0.035, d === 1 ? 0.055 : 0.035, lead);
  if (d === 3)
    for (const t of [0.18, 0.38, 0.64])
      sphere(
        o,
        'lead',
        [x, y + h * t, z],
        [0.09 * (1 - t / 2), 0.1, 0.09 * (1 - t / 2)],
        lead,
        6,
        4,
      );
}
function balustrade(o, d, points, y, { height = 1.0, spacing = 0.65 } = {}) {
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1],
      b = points[k],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.03) continue;
    beam(o, 'trim', [a[0], y, a[1]], [b[0], y, b[1]], 0.17, 0.2, trim);
    beam(o, 'trim', [a[0], y + height, a[1]], [b[0], y + height, b[1]], 0.2, 0.24, trim);
    const n = Math.ceil(len / (d === 0 ? 3.0 : d === 1 ? 1.7 : spacing));
    for (let i = 0; i < n; i++) {
      const t = i / n,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      if (d === 3)
        loft(
          o,
          'trim',
          [
            radialRing(y, 0.1, 0.1, 4, [x, z]),
            radialRing(y + height * 0.3, 0.15, 0.15, 4, [x, z]),
            radialRing(y + height * 0.6, 0.065, 0.065, 4, [x, z]),
            radialRing(y + height, 0.1, 0.1, 4, [x, z]),
          ],
          trim,
        );
      else B(o, 'trim', x, y, z, 0.13, height, 0.13, trim);
    }
  }
}

function clean(r, tolerance) {
  r = r.filter(
    (p, i) => Math.hypot(p[0] - r[(i + 1) % r.length][0], p[1] - r[(i + 1) % r.length][1]) > 0.002,
  );
  const original = [...r],
    indices = new Map(original.map((p, i) => [p, i]));
  let changed = true;
  while (changed && r.length > 4) {
    changed = false;
    for (let i = 0; i < r.length; i++) {
      const a = r[(i + r.length - 1) % r.length],
        p = r[i],
        b = r[(i + 1) % r.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        l = Math.hypot(dx, dz),
        t = l ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (l * l) : -1,
        err = l ? Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / l : Infinity;
      let chainError = 0;
      for (
        let j = (indices.get(a) + 1) % original.length;
        j !== indices.get(b);
        j = (j + 1) % original.length
      ) {
        const q = original[j],
          u = l ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / (l * l))) : 0;
        chainError = Math.max(chainError, Math.hypot(q[0] - a[0] - u * dx, q[1] - a[1] - u * dz));
      }
      if (t >= 0 && t <= 1 && err < tolerance && chainError < tolerance) {
        r = r.filter((_, j) => j !== i);
        changed = true;
        break;
      }
    }
  }
  return r;
}
function faces(r, hole = false) {
  r = area(r) > 0 !== hole ? r : [...r].reverse();
  return r.map((a, i) => {
    const b = r[(i + 1) % r.length],
      dx = a[0] - b[0],
      dz = a[1] - b[1];
    return {
      a,
      b,
      w: Math.hypot(dx, dz),
      x: (a[0] + b[0]) / 2,
      z: (a[1] + b[1]) / 2,
      angle: Math.atan2(-dz, dx),
      normal: [-dz / Math.hypot(dx, dz), dx / Math.hypot(dx, dz)],
    };
  });
}
function cap(o, rings, y, col = lead, slot = 'roof', normalY = 1) {
  const p = rings.flat(),
    idx = earcut(
      p.flat(),
      rings.slice(1).map((_, i) => rings.slice(0, i + 1).reduce((s, r) => s + r.length, 0)),
    );
  for (let i = 0; i < idx.length; i += 3) {
    const q = idx.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]);
    if (normalFor(...q)[1] * normalY < 0) q.reverse();
    o.addTriangle(
      slot,
      ref,
      q,
      [0, normalY, 0],
      q.map((v) => [v[0], v[2]]),
      col,
    );
  }
}

function ledge(o, x, y, z, w, h, depth, col) {
  quad(
    o,
    'trim',
    [
      [x - w / 2, y, z + depth / 2],
      [x + w / 2, y, z + depth / 2],
      [x + w / 2, y + h, z + depth / 2],
      [x - w / 2, y + h, z + depth / 2],
    ],
    [0, 0, 1],
    col,
  );
  quad(
    o,
    'trim',
    [
      [x - w / 2, y + h, z - depth / 2],
      [x + w / 2, y + h, z - depth / 2],
      [x + w / 2, y + h, z + depth / 2],
      [x - w / 2, y + h, z + depth / 2],
    ],
    [0, 1, 0],
    col,
  );
}

function window(o, d, x, y, w, h, { arched = false, wood = false, applied = false, z = 0 } = {}) {
  const ps = arched ? arch(x, y, w, y + h - w / 2, w / 2, d === 3 ? 14 : 8) : rect(x, y, w, h),
    zz = z + (d >= 2 && !applied ? -0.22 : 0.035);
  surface(o, wood ? 'wood' : 'glass', ps, zz, wood ? oak : glass);
  if (d <= 1) return;
  outline(o, 'trim', ps, z + 0.05, 0.13, trim, true);
  if (!wood) {
    outline(
      o,
      'trim',
      [
        [x, y],
        [x, y + h - (arched ? w * 0.2 : 0)],
      ],
      z + 0.06,
      0.11,
      trim,
    );
    outline(
      o,
      'trim',
      [
        [x - w / 2, y + h * 0.62],
        [x + w / 2, y + h * 0.62],
      ],
      z + 0.065,
      0.1,
      trim,
    );
    if (d === 3) {
      for (const dx of [-w * 0.25, w * 0.25])
        outline(
          o,
          'inlay',
          [
            [x + dx, y],
            [x + dx, y + h - (arched ? w * 0.25 : 0)],
          ],
          zz + 0.055,
          0.028,
          iron,
        );
      for (let a = y + 0.55; a < y + h - 0.2; a += 0.65)
        outline(
          o,
          'inlay',
          [
            [x - w / 2, a],
            [x + w / 2, a],
          ],
          zz + 0.055,
          0.025,
          iron,
        );
    }
  }
}
const byId = (id) => frame.features.find((f) => f.id === `buildings/${id}`),
  entranceX = -1.48;
const bodies = [
  {
    name: 'keep',
    ring: frame.authoredComponents.keep,
    top: 21,
    rows: [
      [1.3, 4],
      [8.2, 4.5],
      [14.7, 4.9],
    ],
  },
  {
    name: 'royal-wing',
    ring: frame.authoredComponents.royalWing,
    top: 18,
    rows: [
      [1.2, 3.9],
      [7.6, 4.1],
      [13.4, 3.3],
    ],
  },
  {
    name: 'chapel-wing',
    ring: frame.authoredComponents.chapelWing,
    top: 18,
    rows: [
      [1.2, 3.9],
      [7.6, 4.1],
      [13.4, 3.3],
    ],
  },
  {
    name: 'royal-gallery',
    ring: frame.authoredComponents.royalGallery,
    top: 14,
    rows: [
      [0.6, 5.5],
      [8, 4.7],
    ],
    gallery: true,
  },
  {
    name: 'chapel-gallery',
    ring: frame.authoredComponents.chapelGallery,
    top: 14,
    rows: [
      [0.6, 5.5],
      [8, 4.7],
    ],
    gallery: true,
  },
  ...frame.authoredComponents.outerRoofTowers.map((f, i) => ({
    name: `outer-tower-${i}`,
    ring: f.ring,
    top: 18,
    rows: [
      [1.2, 4],
      [7.6, 4.1],
      [13.4, 3.3],
    ],
    round: true,
  })),
  {
    name: 'enclosure',
    ring: frame.authoredComponents.lowRanges,
    top: 7,
    rows: [[0.9, 5.0]],
    low: true,
  },
];
function windowLayout(body, f, d) {
  const out = [],
    outerNormal = [Math.sin(f.angle), Math.cos(f.angle)],
    front =
      body.low &&
      Math.abs(outerNormal[1]) > 0.95 &&
      f.z > 50 &&
      Math.abs(entranceX - f.x) < f.w / 2 - 2,
    curved =
      f.w < 7 &&
      (body.name === 'keep' || body.round || (body.low && f.z > 56 && Math.abs(f.x) > 55)),
    mainCount =
      body.name === 'keep' && f.w > 16
        ? 5
        : body.gallery
          ? Math.max(1, Math.round(f.w / 9))
          : Math.max(1, Math.floor(f.w / (body.low ? 6.5 : 8.5))),
    w0 = body.name === 'keep' ? 3.0 : body.low ? 1.8 : 2.35,
    count = curved ? 1 : mainCount;
  const galleryFront = body.gallery && f.w > 15 && Math.cos(f.angle) > 0.9,
    visibleSpan = galleryFront
      ? body.name === 'royal-gallery'
        ? [30.4, 50.9]
        : [-55.48, -30.94]
      : null,
    spanWidth = visibleSpan ? (visibleSpan[1] - visibleSpan[0]) / Math.cos(f.angle) : f.w,
    spanCenter = visibleSpan
      ? ((visibleSpan[0] + visibleSpan[1]) / 2 - f.x) / Math.cos(f.angle)
      : 0;
  for (let j = 0; j < count; j++) {
    const x =
        count === 1
          ? 0
          : body.gallery
            ? spanCenter + ((j - (count - 1) / 2) * spanWidth) / count
            : ((j - (count - 1) / 2) * (f.w - 5)) / (count - 1),
      worldX = f.x + Math.cos(f.angle) * x,
      major = !curved || Math.round(((f.angle + Math.PI) * 10) / Math.PI) % 2 === 0,
      w = Math.min(curved ? (major ? 1.65 : 0.65) : w0, f.w * 0.7);
    if (
      f.w < 1.1 ||
      (body.gallery && f.w < 6) ||
      (front && Math.abs(worldX - entranceX) < 3.5) ||
      d === 0
    )
      continue;
    for (const [y, h0] of body.rows) {
      if (body.name === 'keep' && f.z > 20 && Math.abs(f.x) < 3 && y < 2 && (j === 0 || j === 2)) {
        out.push({ x, y: 0.65, w: 2.5, h: 3.2, arched: true, wood: true, body: body.name });
        out.push({ x, y: 4.05, w, h: 2.25, arched: false, body: body.name });
        continue;
      }
      const h = curved && !major ? 1.35 : h0,
        yy = curved && !major ? y + h0 * 0.25 : y;
      const keepArc = body.name === 'keep' && f.z > 20 && Math.abs(f.x) < 3 && y > 7 && j < 2,
        galleryArc = body.gallery && Math.cos(f.angle) > 0.9 && y < 2,
        arched = keepArc || galleryArc || (body.name === 'keep' && !curved && y > 14);
      out.push({
        x,
        y: yy,
        w: keepArc ? 3.7 : galleryArc ? Math.min(6.7, spanWidth / count - 0.7) : w,
        h,
        arched,
        open: keepArc || galleryArc,
        depth: body.gallery ? 4 : 3.4,
        body: body.name,
      });
    }
  }
  return {
    windows: out,
    portal: front ? { x: (entranceX - f.x) / Math.cos(f.angle), y: 0.4, w: 3.7, h: 5.3 } : null,
  };
}
function body(o, d, b, street = false) {
  const ring = clean(b.ring, d === 0 ? 2.2 : d === 1 ? 0.65 : d === 2 ? 0.09 : 0.005);
  cap(o, [ring], b.top, b.low ? slate : lead, b.low ? 'roof' : 'lead');
  for (const f of faces(ring)) {
    if (f.w < 0.003) continue;
    const q = facing(o, f.angle, f.x, f.z),
      layout = windowLayout(b, f, d),
      fd =
        street &&
        !(
          (b.name === 'keep' && f.z > 20 && Math.abs(f.x) < 3) ||
          b.gallery ||
          (b.low && layout.portal)
        )
          ? 1
          : d,
      holes = [];
    for (const p of layout.windows) {
      const ps = p.arched
        ? arch(p.x, p.y, p.w, p.y + p.h - p.w / 2, p.w / 2, d === 3 ? 14 : 8)
        : rect(p.x, p.y, p.w, p.h);
      if (fd >= 2) holes.push(ps);
      if (p.open && fd >= 2) {
        // A real recessed gallery, with its own floor/back wall, not a painted arch.
        B(q, 'stone', p.x, p.y - 0.25, -p.depth / 2, p.w, 0.25, p.depth, cream);
        surface(q, 'stone', rect(p.x, p.y, p.w, p.h), -p.depth, cream);
        window(q, fd, p.x, p.y + 1.0, p.w * 0.27, p.h * 0.38, {
          z: -p.depth + 0.02,
          applied: true,
        });
      } else window(q, fd, p.x, p.y, p.w, p.h, { arched: p.arched, wood: p.wood, applied: fd < 2 });
      if (p.wood && d >= 2)
        for (let j = 0; j < 3; j++)
          B(q, 'stone', p.x, 0.15 + j / 6, 0.75 - j * 0.25, 3.3, 1 / 6, 1.7 - j * 0.5, cream);
    }
    if (layout.portal) {
      const p = layout.portal;
      holes.push(arch(p.x, p.y, p.w, p.y + p.h - p.w / 2, p.w / 2, d >= 2 ? 16 : 6));
      if (d > 0)
        outline(
          q,
          'trim',
          arch(p.x, p.y, p.w + 0.35, p.y + p.h - p.w / 2, p.w / 2 + 0.17, 16).slice(2),
          0.12,
          0.25,
          trim,
        );
    }
    wall(q, rect(0, -4, f.w, b.top + 4), holes, 0, 0.25);
    if (d >= 2) {
      const ys = b.low
        ? [0.45, 6.55, 6.9]
        : b.name === 'keep'
          ? [0.45, 6.9, 13.9, 20.5, 20.88]
          : [0.45, 6.5, 12.5, b.top - 0.5];
      for (const y of ys)
        if (street) surface(q, 'trim', rect(0, y, f.w, 0.15), 0.09, trim);
        else ledge(q, 0, y, 0.08, f.w, 0.15, 0.24, trim);
      if (f.w > 8)
        for (let j = 0; j <= Math.floor(f.w / 5.0); j++) {
          const x = -f.w / 2 + 0.3 + (j * (f.w - 0.6)) / Math.max(1, Math.floor(f.w / 5.0));
          if (layout.windows.some((p) => Math.abs(x - p.x) < p.w / 2 + 0.2)) continue;
          if (street) surface(q, 'trim', rect(x, 0.5, 0.2, b.top - 0.9), 0.08, trim);
          else B(q, 'trim', x, 0.5, 0.06, 0.2, b.top - 0.9, 0.15, trim);
        }
    }
  }
  if (d >= 2 && !street)
    balustrade(o, 2, [...ring, ring[0]], b.top + 0.05, { height: 0.95, spacing: 2.8 });
  else if (street)
    for (const f of faces(ring))
      beam(o, 'trim', [f.a[0], b.top + 1, f.a[1]], [f.b[0], b.top + 1, f.b[1]], 0.16, 0.18, trim);
}
function base(o, d) {
  if (d <= 1) return;
  const rings = frame.authoredComponents.whole.map((r) =>
    clean(r, d === 1 ? 0.65 : d === 2 ? 0.09 : 0.005),
  );
  cap(o, rings, 0.4, darkStone, 'stone');
  for (let ri = 0; ri < rings.length; ri++)
    for (const f of faces(rings[ri], ri > 0)) {
      if (f.w < 0.003) continue;
      const q = facing(o, f.angle, f.x, f.z);
      wall(q, rect(0, -4, f.w, 4.4), [], 0, 0.25, darkStone, 'stone');
    }
}
function pavilionRoofs(o, _d) {
  // Native trapezoids/triangles retain four separate hipped pavilions around the roof cross.
  for (const signX of [-1, 1])
    for (const signZ of [-1, 1]) {
      const parts = frame.authoredComponents.roofFaces.filter(
          (f) =>
            Math.sign(f.ring.reduce((s, p) => s + p[0], 0)) === signX &&
            Math.sign(f.ring.reduce((s, p) => s + p[1], 0)) === signZ,
        ),
        all = parts.flatMap((f) => f.ring),
        bounds = [0, 1].map((k) => [
          Math.min(...all.map((p) => p[k])),
          Math.max(...all.map((p) => p[k])),
        ]);
      for (const f of parts) {
        const ps = f.ring.map((p) => [
          p[0],
          bounds.some((b, k) => Math.min(Math.abs(p[k] - b[0]), Math.abs(p[k] - b[1])) < 0.3)
            ? 21.2
            : 38,
          p[1],
        ]);
        let n = normalFor(...ps);
        if (n[1] < 0) n = n.map((v) => -v);
        if (ps.length === 4) quad(o, 'roof', ps, n, slate);
        else {
          o.addTriangle(
            'roof',
            ref,
            normalFor(...ps)[1] > 0 ? ps : [...ps].reverse(),
            n,
            ps.map((p) => [p[0], p[2]]),
            slate,
          );
        }
      }
    }
  for (const b of bodies.filter((b) => b.name.includes('wing') || b.gallery)) {
    const xs = b.ring.map((p) => p[0]),
      zs = b.ring.map((p) => p[1]);
    if (b.gallery) {
      const q = facing(o, Math.PI / 2, 0, 0);
      roof(
        q,
        -Math.max(...zs) - 0.15,
        -Math.min(...zs) + 0.15,
        Math.min(...xs) - 0.15,
        Math.max(...xs) + 0.15,
        14,
        21.5,
      );
    } else
      roof(
        o,
        Math.min(...xs) - 0.15,
        Math.max(...xs) + 0.15,
        Math.min(...zs) - 0.15,
        Math.max(...zs) + 0.15,
        18,
        30,
      );
  }
}
const roofTowers = [
  ...frame.authoredComponents.keepRoofTowers.map((f) => ({ ...f, eave: 21, r: 8, metal: true })),
  ...frame.authoredComponents.outerRoofTowers.map((f) => ({ ...f, eave: 18, r: 10, metal: false })),
];
function dome(o, slot, x, z, y, r, h, col, n) {
  const rings = Array.from({ length: 5 }, (_, i) => {
    const t = ((i / 4) * Math.PI) / 2;
    return radialRing(
      y + h * Math.sin(t),
      Math.max(0.025, r * Math.cos(t)),
      Math.max(0.025, r * Math.cos(t)),
      n,
      [x, z],
    );
  });
  loft(o, slot, rings, col);
}
function lantern(o, d, x, z, { baseY = 35, metal = true, ornate = false } = {}) {
  const n = d === 0 ? 3 : d === 1 ? 4 : 8,
    col = metal ? lead : cream,
    slot = metal ? 'lead' : 'stone';
  if (d === 0) {
    for (let i = 0; i < 2; i++) {
      const a = (i / 2) * Math.PI * 2,
        cx = x + 1.5 * Math.cos(a),
        cz = z + 1.5 * Math.sin(a);
      loft(
        o,
        slot,
        [
          radialRing(baseY, 0.18, 0.18, 3, [cx, cz]),
          radialRing(baseY + 9, 0.18, 0.18, 3, [cx, cz]),
        ],
        col,
      );
    }
    loft(
      o,
      metal ? 'lead' : 'roof',
      [radialRing(baseY + 9, 1.9, 1.9, 4, [x, z]), radialRing(baseY + 10.5, 0.05, 0.05, 4, [x, z])],
      metal ? lead : slate,
    );
    return;
  }
  cylinder(o, slot, x, z, baseY, baseY + 0.6, 1.8, 1.8, col, d >= 2 ? 16 : 8);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2,
      cx = x + 1.55 * Math.cos(a),
      cz = z + 1.55 * Math.sin(a);
    cylinder(o, slot, cx, cz, baseY + 0.6, baseY + 8.4, 0.16, 0.16, col, d === 3 ? 8 : 4);
  }
  cylinder(o, slot, x, z, baseY + 8.3, baseY + 8.7, 1.8, 1.8, col, d >= 2 ? 16 : 8);
  if (ornate) {
    cylinder(o, slot, x, z, baseY + 4.3, baseY + 4.5, 1.65, 1.65, col, 8);
    for (let i = 0; i < 8; i++) {
      const a = ((i + 0.5) / 8) * Math.PI * 2,
        q = facing(o, a, x + 1.43 * Math.sin(a), z + 1.43 * Math.cos(a));
      outline(q, slot, arch(0, baseY + 4.5, 1.18, baseY + 7.8, 0.59, 8).slice(2), 0, 0.14, col);
    }
  }
  dome(
    o,
    metal ? 'lead' : 'roof',
    x,
    z,
    baseY + 8.7,
    1.9,
    1.8,
    metal ? lead : slate,
    d === 3 ? 24 : 12,
  );
  beam(o, 'inlay', [x, baseY + 10.5, z], [x, baseY + 12, z], 0.055, 0.055, gold);
  if (d >= 2) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2,
        cx = x + 1.75 * Math.cos(a),
        cz = z + 1.75 * Math.sin(a);
      finial(o, 1, cx, baseY + 9.1, cz, 0.8);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      beam(
        o,
        'lead',
        [x + 1.4 * Math.cos(a), baseY + 10.0, z + 1.4 * Math.sin(a)],
        [x + 0.2 * Math.cos(a), baseY + 11.2, z + 0.2 * Math.sin(a)],
        0.055,
        0.055,
        lead,
      );
    }
  }
}
function cones(o, d, ornate = false) {
  for (const t of roofTowers) {
    const [x, z] = t.center,
      n = d === 0 ? 4 : d === 1 ? 8 : d === 2 ? 16 : 24;
    loft(
      o,
      'roof',
      [
        radialRing(t.eave, t.r, t.r, n, [x, z]),
        radialRing(31, t.r * 0.39, t.r * 0.39, n, [x, z]),
        radialRing(35, 1.75, 1.75, n, [x, z]),
      ],
      slate,
    );
    lantern(o, d <= 1 ? 0 : d, x, z, { metal: t.metal, ornate });
  }
}
function centralLantern(o, d) {
  if (d === 0) {
    for (const x of [-3.2, 3.2])
      for (const z of [-3.2, 3.2]) cylinder(o, 'stone', x, z, 21, 30, 0.6, 0.6, cream, 3);
    loft(o, 'stone', [radialRing(30, 5.5, 5.5, 4), radialRing(39, 2.2, 2.2, 4)], cream);
    for (const x of [-2, 2]) cylinder(o, 'stone', x, 0, 39, 48, 0.18, 0.18, cream, 3);
    loft(o, 'stone', [radialRing(48, 2.5, 2.5, 4), radialRing(53, 0.3, 0.3, 4)], cream);
    B(o, 'inlay', 0, 53, 0, 0.15, 3, 0.15, gold);
    return;
  }
  const n = d === 0 ? 4 : d === 1 ? 4 : d === 2 ? 8 : 12,
    rs = 5.7;
  cylinder(o, 'stone', 0, 0, 21, 21.7, rs, rs, cream, n);
  // Lower pointed arcade is genuinely open between its four great buttress piers.
  for (let j = 0; j < 4; j++) {
    const a = (j * Math.PI) / 2 + Math.PI / 4,
      x = 4.0 * Math.cos(a),
      z = 4.0 * Math.sin(a);
    cylinder(o, 'stone', x, z, 21.7, 30, 0.6, 0.55, cream, d >= 2 ? 8 : 4);
  }
  cylinder(o, 'trim', 0, 0, 29.8, 30.5, 5.5, 5.5, trim, n);
  loft(o, 'stone', [radialRing(30.5, 5.5, 5.5, n), radialRing(38, 2.25, 2.25, n)], cream);
  if (d > 0) {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2,
        q = facing(o, a, Math.sin(a) * 5.65, Math.cos(a) * 5.65);
      outline(q, 'trim', arch(0, 21.5, 5.7, 26.8, 3, 12).slice(2), 0, 0.25, trim);
      if (d >= 2) {
        for (const side of [-1, 1])
          beam(q, 'trim', [side * 3.0, 30.0, 0], [side * 1.3, 38.0, -2.2], 0.27, 0.27, trim);
        outline(q, 'inlay', circle(0, 33.4, 0.65, 0.9, 16), -0.4, 0.15, darkStone, true);
      }
    }
  }
  // Upper colonnade and tapering crown remain separate from the six roof lanterns.
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    cylinder(
      o,
      'stone',
      2.15 * Math.cos(a),
      2.15 * Math.sin(a),
      38,
      48,
      0.18,
      0.15,
      cream,
      d >= 2 ? 6 : 3,
    );
  }
  cylinder(o, 'trim', 0, 0, 47.8, 48.6, 2.5, 2.5, trim, n);
  loft(
    o,
    'stone',
    [radialRing(48.6, 2.5, 2.5, n), radialRing(51, 0.75, 0.75, n), radialRing(53, 0.45, 0.45, n)],
    cream,
  );
  cylinder(o, 'stone', 0, 0, 53, 55.3, 0.24, 0.13, cream, d >= 2 ? 10 : 4);
  if (d > 0) {
    for (const x of [-0.45, 0.45]) beam(o, 'inlay', [0, 55.1, 0], [x, 55.55, 0], 0.1, 0.1, gold);
    sphere(o, 'inlay', [0, 55.75, 0], [0.18, 0.25, 0.12], gold, 8, 4);
  } else B(o, 'inlay', 0, 55.3, 0, 0.16, 0.7, 0.16, gold);
}
const excludedRoofIds = new Set([
  '35185335389992',
  '35185335389989',
  '35185335389990',
  '35185335389991',
  '35185335389988',
  '35185335389993',
  '35185335389987',
  ...frame.authoredComponents.roofFaces.map((f) => f.id.split('/')[1]),
  ...roofTowers.map((f) => f.id.split('/')[1]),
  ...frame.features
    .filter((f) => f.properties.min_height === 35 && f.properties.height === 46)
    .map((f) => f.id.split('/')[1]),
]);
const roofParts = frame.features.filter(
  (f) =>
    !excludedRoofIds.has(f.id.split('/')[1]) &&
    f.properties.height > 20 &&
    Math.max(...f.bounds.map((r) => r[1] - r[0])) < 10 &&
    f.id !== 'buildings/35185335435496' &&
    f.id !== 'buildings/35185335435485' &&
    f.properties.min_height !== 7,
);
const pairs = roofParts
    .filter((f) => (f.properties.min_height ?? 0) >= 30 && f.properties.min_height < 35)
    .map((top) => ({
      top,
      bottom: roofParts.find(
        (f) =>
          Math.abs(f.properties.height - top.properties.min_height) < 0.1 &&
          Math.hypot(f.center[0] - top.center[0], f.center[1] - top.center[1]) < 0.6,
      ),
    }))
    .filter((p) => p.bottom),
  pairedIds = new Set(pairs.flatMap((p) => [p.top.id, p.bottom.id]));
function inlays(_o, d, q, w, y, h, type = 0) {
  if (d < 2) return;
  if (type % 2 === 0) {
    for (const yy of [y + h * 0.25, y + h * 0.62]) {
      surface(
        q,
        'inlay',
        [
          [0, yy - 0.55],
          [w * 0.27, yy],
          [0, yy + 0.55],
          [-w * 0.27, yy],
        ],
        0.06,
        iron,
      );
      outline(
        q,
        'trim',
        [
          [0, yy - 0.85],
          [w * 0.39, yy],
          [0, yy + 0.85],
          [-w * 0.39, yy],
        ],
        0.08,
        0.09,
        trim,
        true,
      );
    }
  } else
    for (const yy of [y + h * 0.3, y + h * 0.68]) {
      surface(q, 'inlay', circle(0, yy, w * 0.24, w * 0.24, d === 3 ? 16 : 8), 0.05, iron);
      outline(
        q,
        'trim',
        circle(0, yy, w * 0.32, w * 0.32, d === 3 ? 20 : 10),
        0.09,
        0.1,
        trim,
        true,
      );
    }
}
function stack(o, d, f, bottom = null) {
  const p = f.properties,
    [x, z] = f.center,
    start = bottom ? (bottom.properties.min_height ?? 21) : (p.min_height ?? 18),
    top = p.height,
    w = Math.min(f.bounds[0][1] - f.bounds[0][0], f.bounds[1][1] - f.bounds[1][0]);
  if (d <= 1) {
    if (top <= 30.1) return;
    B(
      o,
      'stone',
      x,
      Math.max(start, 30),
      z,
      Math.max(w, 1),
      top - Math.max(start, 30),
      Math.max(w, 1),
      cream,
    );
    return;
  }
  const y0 = bottom ? Math.max(start, 21) : start,
    r = f.rings[0];
  poly(o, 'stone', r, y0, top, cream);
  if (bottom) {
    poly(o, 'stone', bottom.rings[0], start, p.min_height, cream);
    const a = Math.atan2(x, z),
      q = facing(o, a, x + Math.sin(a) * 2.1, z + Math.cos(a) * 2.1);
    window(q, d, 0, start + 1.0, 1.8, 4.5, { applied: true, wood: true });
    B(q, 'trim', 0, start + 6.0, 0, 3.8, 0.25, 0.4, trim);
    if (d >= 2)
      panel(
        q,
        'trim',
        [
          [-1.9, start + 6.2],
          [1.9, start + 6.2],
          [1.4, p.min_height - 0.5],
          [-1.4, p.min_height - 0.5],
        ],
        -0.02,
        0.15,
        trim,
      );
  }
  if (d > 0) {
    B(o, 'trim', x, top - 0.2, z, Math.max(w + 0.4, 1.4), 0.35, Math.max(w + 0.4, 1.4), trim);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2,
        q = facing(
          o,
          a,
          x + (Math.sin(a) * Math.max(w, 0.9)) / 2,
          z + (Math.cos(a) * Math.max(w, 0.9)) / 2,
        );
      inlays(
        o,
        d,
        q,
        Math.max(w, 0.9),
        Math.max(start, top - 10),
        Math.min(top - start, 10),
        f.index % 2,
      );
      if (d === 3) {
        for (const dx of [-w * 0.3, w * 0.3])
          B(
            q,
            'trim',
            dx,
            Math.max(start, top - 10),
            0.03,
            0.1,
            Math.min(top - start, 10),
            0.15,
            trim,
          );
      }
    }
  }
  if (d === 3)
    for (const dx of [-0.35, 0, 0.35]) {
      const xx = x + dx * Math.max(1, w);
      finial(o, 1, xx, top + 0.15, z, 0.7);
    }
}
function dormer(o, d, f) {
  const p = f.properties,
    y0 = (p.min_height ?? 0) >= 18 ? p.min_height : 18,
    peak = p.height;
  if (peak - y0 < 2) return;
  const fs = faces(f.rings[0]),
    [x, z] = f.center,
    near = roofTowers.find((t) => Math.hypot(x - t.center[0], z - t.center[1]) < 9),
    direction = near ? [x - near.center[0], z - near.center[1]] : [x, z],
    f0 = fs.reduce(
      (best, a) =>
        Math.sin(a.angle) * direction[0] + Math.cos(a.angle) * direction[1] >
        Math.sin(best.angle) * direction[0] + Math.cos(best.angle) * direction[1]
          ? a
          : best,
      fs[0],
    ),
    wallTop = Math.max(y0 + 2.0, peak - 3.0),
    windowY = y0 + 0.6,
    windowH = Math.max(1.2, Math.min(4.8, wallTop - windowY - 0.4));
  if (d === 0) return;
  if (d === 1) {
    const q = facing(o, f0.angle, f0.x, f0.z);
    B(q, 'stone', 0, y0, -0.65, Math.min(f0.w, 4.5), wallTop - y0, 1.3, cream);
    surface(q, 'glass', rect(0, windowY, Math.min(f0.w * 0.7, 2.1), windowH), 0.02, glass);
    surface(
      q,
      'trim',
      [
        [-f0.w / 2, wallTop],
        [f0.w / 2, wallTop],
        [0, peak],
      ],
      0.02,
      trim,
    );
    return;
  }
  cap(o, [f.rings[0]], wallTop, slate, 'roof');
  for (const face of fs) {
    const q = facing(o, face.angle, face.x, face.z),
      front = face === f0,
      w = Math.min(2.1, face.w * 0.7),
      hole = rect(0, windowY, w, windowH);
    wall(q, rect(0, y0, face.w, wallTop - y0), front && d >= 2 ? [hole] : [], 0, 0.25);
    if (front) {
      window(q, d, 0, windowY, w, windowH, { wood: true, applied: d < 2 });
      const half = face.w / 2 + 0.2,
        profile = [
          [-half, wallTop],
          [half, wallTop],
          [half * 0.7, wallTop + 0.5],
          [half * 0.5, peak - 0.8],
          [0, peak],
          [-half * 0.5, peak - 0.8],
          [-half * 0.7, wallTop + 0.5],
        ];
      panel(q, 'trim', profile, -0.1, 0.15, trim);
      if (d >= 2) {
        B(q, 'trim', 0, wallTop - 0.15, 0.12, face.w + 0.6, 0.25, 0.42, trim);
        inlays(o, d, q, face.w, wallTop - 0.7, 0.6, 1);
        outline(q, 'trim', profile, 0.22, 0.1, darkStone, true);
        for (const dx of [-half * 0.85, 0, half * 0.85])
          finial(q, 1, dx, peak - 0.6 - Math.abs(dx) * 0.25, 0.15, 0.7);
      }
    }
  }
}
function smallTurret(o, d, f) {
  const [x, z] = f.center,
    p = f.properties,
    y0 = p.min_height ?? 18,
    h = p.height,
    r = Math.max(0.5, Math.min(...f.bounds.map((r) => r[1] - r[0])) / 2),
    n = d === 0 ? 4 : d === 1 ? 6 : d === 2 ? 10 : 16;
  if (d === 1) {
    cylinder(o, 'stone', x, z, y0, h - 3.5, r, r, cream, 4);
    cylinder(o, 'roof', x, z, h - 3.5, h, r + 0.15, 0.02, slate, 4);
    return;
  }
  cylinder(o, 'stone', x, z, y0, h - 3.5, r, r, cream, n);
  dome(o, 'roof', x, z, h - 3.5, r + 0.15, 3.5, slate, n);
  if (d >= 2)
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const q = facing(o, a, x + Math.sin(a) * (r + 0.02), z + Math.cos(a) * (r + 0.02));
      window(q, d, 0, h - 7, 0.5, 2.1, { applied: true });
      inlays(o, d, q, 1.5, h - 4.1, 0.5, 1);
    }
  if (d > 0) finial(o, 1, x, h, z, 0.8);
}
function roofDetails(o, d, pairDetail = d) {
  if (d === 0) {
    for (const p of pairs) stack(o, 0, p.top, p.bottom);
    for (const f of roofParts.filter(
      (f) =>
        !pairedIds.has(f.id) &&
        f.properties.height >= 34 &&
        f.rings[0].length === 4 &&
        Math.max(...f.bounds.map((r) => r[1] - r[0])) < 3,
    ))
      stack(o, 0, f);
    return;
  }
  for (const { top, bottom } of pairs) stack(o, pairDetail, top, bottom);
  for (const f of roofParts.filter((f) => !pairedIds.has(f.id))) {
    const p = f.properties,
      max = Math.max(...f.bounds.map((r) => r[1] - r[0])),
      min = Math.min(...f.bounds.map((r) => r[1] - r[0]));
    if (f.rings[0].length >= 8) smallTurret(o, d, f);
    else if (max <= 2.9 && min < 2.2 && p.height >= 26) stack(o, d, f);
    else dormer(o, d, f);
  }
  // Two small visible side-wing stair turrets have native independent locations.
  for (const id of ['35185335435496', '35185335435485']) smallTurret(o, d, byId(id));
}
function exteriorStairs(o, d, ramp = false) {
  const landing = (x, z, y, radius, n) => {
    const outer = radialRing(y, radius, radius, n, [x, z]).map((p) => [p[0], p[2]]),
      inner = radialRing(y, 0.85, 0.85, n, [x, z]).map((p) => [p[0], p[2]]);
    cap(o, [outer, inner], y + 0.24, trim, 'trim');
    cap(o, [outer, inner], y, trim, 'trim', -1);
    for (const ring of [outer, [...inner].reverse()])
      for (const f of faces(ring, ring !== outer))
        quad(
          o,
          'trim',
          [
            [f.a[0], y, f.a[1]],
            [f.b[0], y, f.b[1]],
            [f.b[0], y + 0.24, f.b[1]],
            [f.a[0], y + 0.24, f.a[1]],
          ],
          [f.normal[0], 0, f.normal[1]],
          trim,
        );
  };
  for (const f of frame.authoredComponents.courtStairs) {
    const [x, z] = f.center,
      r = 2.55,
      n = d === 0 ? 4 : d === 1 ? 6 : 12;
    if (d === 0) {
      cylinder(o, 'stone', x, z, 0.4, 22, r, r, cream, 4);
      const ring = radialRing(22, r + 0.15, r + 0.15, 4, [x, z]);
      for (let k = 0; k < 4; k++) {
        const p = [ring[k], ring[(k + 1) % 4], [x, 25, z]];
        if (normalFor(...p)[1] < 0) p.reverse();
        o.addTriangle(
          'roof',
          ref,
          p,
          normalFor(...p),
          p.map((p) => [p[0], p[2]]),
          slate,
        );
      }
      continue;
    }
    if (d === 1) {
      for (const dx of [-1.8, 1.8])
        for (const dz of [-1.8, 1.8])
          cylinder(o, 'stone', x + dx, z + dz, 0.4, 22, 0.25, 0.25, cream, 3);
      for (const y of [7.4, 14.4]) landing(x, z, y, r, 4);
      cylinder(o, 'roof', x, z, 22, 25, r + 0.15, 0.03, slate, 6);
      if (ramp) {
        for (let j = 0; j < 72; j++) {
          const a = (j / 24) * Math.PI * 2,
            b = ((j + 1) / 24) * Math.PI * 2,
            y = 0.65 + (j / 72) * 21,
            yy = 0.65 + ((j + 1) / 72) * 21,
            p = [
              [x + Math.cos(a), y, z + Math.sin(a)],
              [x + 2.35 * Math.cos(a), y, z + 2.35 * Math.sin(a)],
              [x + 2.35 * Math.cos(b), yy, z + 2.35 * Math.sin(b)],
              [x + Math.cos(b), yy, z + Math.sin(b)],
            ];
          {
            const n = normalFor(...p);
            quad(o, 'stone', p, n[1] < 0 ? n.map((v) => -v) : n, cream);
          }
        }
      }
      continue;
    }
    for (const y of [0.4, 7.4, 14.4, 21.4]) {
      landing(x, z, y, r + 0.15, n);
      if (d >= 2 && y > 1 && y < 21)
        balustrade(
          o,
          2,
          Array.from({ length: 13 }, (_, j) => [
            x + r * Math.cos((j / 12) * Math.PI * 2),
            z + r * Math.sin((j / 12) * Math.PI * 2),
          ]),
          y + 0.24,
          { height: 0.85, spacing: 2.2 },
        );
    }
    for (let j = 0; j < 6; j++) {
      const a = (j / 6) * Math.PI * 2,
        cx = x + r * Math.cos(a),
        cz = z + r * Math.sin(a);
      for (const y of [0.65, 7.65, 14.65])
        cylinder(o, 'stone', cx, cz, y, y + 6.7, 0.22, 0.22, cream, d === 3 ? 8 : 4);
      if (d === 3) {
        const mid = a + Math.PI / 6,
          q = facing(o, Math.PI / 2 - mid, x + r * Math.cos(mid), z + r * Math.sin(mid));
        for (const y of [0.65, 7.65, 14.65])
          outline(q, 'trim', arch(0, y, 2.15, y + 5.25, 1.075, 6).slice(2), 0, 0.25, trim);
      }
    }
    dome(o, 'roof', x, z, 21.7, r + 0.3, 3.3, slate, d >= 2 ? 24 : 8);
    if (d >= 2) {
      const count = d === 3 ? 90 : 36,
        turns = 3;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * turns * Math.PI * 2,
          b = ((i + 1) / count) * turns * Math.PI * 2,
          y = 0.65 + (i / count) * 21,
          ps = [
            [x + 1.0 * Math.cos(a), z + 1.0 * Math.sin(a)],
            [x + 2.35 * Math.cos(a), z + 2.35 * Math.sin(a)],
            [x + 2.35 * Math.cos(b), z + 2.35 * Math.sin(b)],
            [x + 1.0 * Math.cos(b), z + 1.0 * Math.sin(b)],
          ];
        poly(o, 'stone', ps, y - 0.13, y, cream);
      }
      if (d === 3)
        loft(
          o,
          'stone',
          Array.from({ length: 43 }, (_, j) => {
            const a = (j / 42) * turns * Math.PI * 2,
              y = 0.65 + (j / 42) * 21;
            return [
              [2.26, y + 0.18],
              [2.43, y + 0.18],
              [2.43, y + 0.95],
              [2.26, y + 0.95],
            ].map(([radius, height]) => [
              x + radius * Math.cos(a),
              height,
              z + radius * Math.sin(a),
            ]);
          }),
          cream,
        );
    }
    finial(o, 1, x, 25, z, 0.7);
  }
}
function entrance(o, d) {
  const q = facing(o, 0, entranceX, 67.3),
    w = 9.0;
  if (d > 0) {
    const profile = arch(0, 0.4, 3.7, 3.85, 1.85, 12),
      portal = facing(o, 0, entranceX, 0);
    for (let i = 2; i < profile.length - 1; i++) {
      const a = profile[i],
        b = profile[i + 1],
        p = [
          [a[0], a[1], 54.3],
          [a[0], a[1], 67.25],
          [b[0], b[1], 67.25],
          [b[0], b[1], 54.3],
        ];
      quad(portal, 'stone', p, normalFor(...p), darkStone);
    }
    for (const side of [-1, 1])
      B(portal, 'stone', side * 1.975, 0.4, 60.77, 0.25, 3.45, 12.95, darkStone);
    for (const x of [-w * 0.42, w * 0.42]) B(q, 'trim', x, 0.4, 0.13, 0.45, 6.4, 0.25, trim);
    B(q, 'trim', 0, 6.8, 0.17, w + 0.4, 0.3, 0.5, trim);
    panel(
      q,
      'trim',
      [
        [-w * 0.55, 7.1],
        [w * 0.55, 7.1],
        [0, 9.7],
      ],
      -0.2,
      0.22,
      trim,
    );
    outline(
      q,
      'trim',
      [
        [-w * 0.57, 7.1],
        [0, 9.85],
        [w * 0.57, 7.1],
      ],
      0.27,
      0.16,
      darkStone,
    );
  }
}
function sample(x, z) {
  let u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v);
  u -= i;
  v -= j;
  const h = terrain.heightsMeters;
  return (
    h[j][i] * (1 - u) * (1 - v) +
    h[j][i + 1] * u * (1 - v) +
    h[j + 1][i] * (1 - u) * v +
    h[j + 1][i + 1] * u * v -
    terrain.modelDatumElevationMeters
  );
}
function paving(o, d) {
  if (d !== 3) return;
  const ring = frame.authoredComponents.whole[1],
    step = 3,
    clip = (ps, k, value, sign) => {
      const out = [];
      for (let i = 0; i < ps.length; i++) {
        const a = ps[i],
          b = ps[(i + 1) % ps.length],
          ia = (a[k] - value) * sign >= -1e-8,
          ib = (b[k] - value) * sign >= -1e-8;
        if (ia) out.push(a);
        if (ia !== ib) {
          const t = (value - a[k]) / (b[k] - a[k]);
          out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        }
      }
      return out;
    };
  for (let z = -30; z < 58; z += step)
    for (let x = -60; x < 57; x += step) {
      let ps = ring;
      for (const [k, v, s] of [
        [0, x, 1],
        [0, x + step, -1],
        [1, z, 1],
        [1, z + step, -1],
      ]) {
        ps = clip(ps, k, v, s);
        if (ps.length < 3) break;
      }
      if (ps.length < 3) continue;
      const idx = earcut(ps.flat());
      for (let j = 0; j < idx.length; j += 3) {
        const p = idx.slice(j, j + 3).map((i) => [ps[i][0], sample(...ps[i]), ps[i][1]]);
        // A thin authored paving skin clears the unchanged bilinear field even when a
        // triangle crosses provider cells. Only this own paving is lifted, never terrain.
        let lift = 0.07;
        for (let u = 0; u <= 12; u++)
          for (let v = 0; v <= 12 - u; v++) {
            const weights = [u / 12, v / 12, 1 - (u + v) / 12],
              q = [0, 1, 2].map((k) => p.reduce((s, p, i) => s + p[k] * weights[i], 0));
            lift = Math.max(lift, sample(q[0], q[2]) - q[1] + 0.055);
          }
        for (const q of p) q[1] += lift;
        if (Math.abs(normalFor(...p)[1]) < 0.1) continue;
        if (normalFor(...p)[1] < 0) p.reverse();
        o.addTriangle(
          'paving',
          ref,
          p,
          normalFor(...p),
          p.map((p) => [p[0], p[2]]),
          rgb('bdb7a7'),
        );
      }
    }
}
function build(o, d) {
  if (d === 2) {
    base(o, 2);
    for (const b of bodies) body(o, 2, b, true);
    pavilionRoofs(o, 2);
    cones(o, 2);
    centralLantern(o, 2);
    roofDetails(o, 1, 2);
    exteriorStairs(o, 1, true);
    entrance(o, 2);
    return;
  }
  base(o, d);
  for (const b of bodies) body(o, d === 3 ? 2 : d, b);
  pavilionRoofs(o, d);
  cones(o, d === 3 ? 2 : d, d === 3);
  centralLantern(o, d === 1 ? 0 : d);
  roofDetails(o, d === 3 ? 2 : d);
  exteriorStairs(o, d);
  entrance(o, d);
  paving(o, d);
}
export const chambordClose = (o) => build(o, 3),
  chambordStreet = (o) => build(o, 2),
  chambordDistrict = (o) => build(o, 1),
  chambordSkyline = (o) => build(o, 0);
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.95, metallic: 0 },
  trim: { slot: 'trim', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.9, metallic: 0 },
  lead: { slot: 'roof', graph: 'metal_painted', roughness: 0.7, metallic: 0.45 },
  glass: { slot: 'window', localRef: ref, roughness: 0.4, metallic: 0.05 },
  wood: { slot: 'door', localRef: ref, roughness: 0.85, metallic: 0 },
  inlay: { slot: 'trim', localRef: ref, roughness: 0.8, metallic: 0.15 },
  paving: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
};
export const chambordModel = {
  id: 'chateau_de_chambord',
  key: 'chateau_de_chambord',
  recipe: 'structure-chateau-de-chambord.mjs',
  cell: 'u0/u03',
  title: 'Château de Chambord',
  brief:
    'Connected native château with open courtyard: square keep/four great round towers, four separate steep hipped pavilion roofs, central open stone lantern to56m, six restored open corner lanterns, chapel/royal side wings, recessed connecting galleries and low enclosure/two flat front towers. Three-storey pilaster/moulding facade grid, crossed windows and upper open gallery bays, true courtyard entrance portal, supported exterior circular staircases, native roof dormers/chimneys/stair turrets with original restrained circular/diamond inlays and abstract relief. Current2025 aerial controls silhouette and restored blue-grey lead; older close photos control stone/window forms. Gardens, detached buildings, moat, interiors, people and photo textures excluded.',
  camera: [171, 113, 203],
  lookAt: [-2, 15, 21],
  qaCameras: [
    { name: 'front', position: [-1.5, 24, 158], lookAt: [-1.5, 18, 18] },
    { name: 'keep-court', position: [21, 20, 55], lookAt: [0, 13, 22] },
    { name: 'garden-front', position: [1, 28, -105], lookAt: [0, 20, -20] },
    { name: 'roof-village', position: [75, 75, 72], lookAt: [0, 34, 0] },
    { name: 'central-lantern', position: [21, 47, 24], lookAt: [0, 37, 0] },
    { name: 'royal-stair', position: [34, 17, 12], lookAt: [50.5, 13, -14.6] },
    { name: 'chapel-wing', position: [-108, 28, -2], lookAt: [-66, 20, -12] },
    { name: 'entry-portal', position: [entranceX + 8, 4, 91], lookAt: [entranceX, 3, 64] },
  ],
  mediumFiContext: { scale: 1.3, cameraYaw: 0, groundY: -4 },
  build: chambordClose,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Independent official IGN field acquired before geometry:25921 unchanged provider values on2m grid,77.73m dry entrance datum at[0,74], original request/response hashes retained. Native own-outline ground−2.230..+0.356m; foundations continue to−4m, courtyard paving follows unchanged samples. Baseline Terrarium84.0464m entrance/building returns is preserved and rejected. Effective source resolution and surveyed accuracy remain unspecified. Compatible host field required; footprint replacement disabled.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-chateau-de-chambord.mjs',
    level: 'skyline',
    export: 'chambordSkyline',
    errorMeters: 3,
    surfaces,
    authoredLevels: {
      district: { export: 'chambordDistrict', errorMeters: 1.3, surfaces },
      street: { export: 'chambordStreet', errorMeters: 0.4, surfaces },
    },
  },
  limitations: frame.limitations,
};
export {
  base,
  bodies,
  body,
  build,
  centralLantern,
  clean,
  cones,
  entranceX,
  exteriorStairs,
  faces,
  frame,
  lantern,
  pairs,
  pavilionRoofs,
  paving,
  roofDetails,
  roofParts,
  roofTowers,
  sample,
  terrain,
  windowLayout,
};
