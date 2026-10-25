/** Ryman Auditorium's surviving Gothic shell and separately bounded modern rear additions. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad as rawQuad } from './structure-mesh.mjs';

function quad(o, slot, p, n, c) {
  if (normalFor(...p).reduce((v, a, i) => v + a * n[i], 0) < 0) p = [...p].reverse();
  rawQuad(o, slot, p, n, c);
}
const frame = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/dn/dn6/ryman_auditorium/map-frame.json',
        import.meta.url,
      ),
    ),
  ),
  terrain = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/dn/dn6/ryman_auditorium/terrain-grid.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  brick = rgb('934f3c'),
  brickDark = rgb('753c31'),
  stone = rgb('c5c4af'),
  cream = rgb('e1dec9'),
  roofgrey = rgb('575c57'),
  dark = rgb('363d3e'),
  glass = rgb('51676d'),
  copper = rgb('ae865e'),
  W = 34.5,
  L = 50.03;
const grade = (x, z) => {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    h = terrain.heightsMeters;
  return (
    h[j][i] * (1 - a) * (1 - b) +
    h[j][i + 1] * a * (1 - b) +
    h[j + 1][i] * (1 - a) * b +
    h[j + 1][i + 1] * a * b -
    terrain.modelDatumElevationMeters
  );
};
function transform(o, a, x = 0, z = 0) {
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
function poly(o, slot, ps, y0, y1, col) {
  const p = ps.map((v) => v.slice());
  if (
    p.reduce(
      (a, v, i) => a + v[0] * p[(i + 1) % p.length][1] - v[1] * p[(i + 1) % p.length][0],
      0,
    ) < 0
  )
    p.reverse();
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    quad(
      o,
      slot,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [b[1] - a[1], 0, a[0] - b[0]],
      col,
    );
  }
  const ids = earcut(p.flat());
  for (const [y, n] of [
    [y0, [0, -1, 0]],
    [y1, [0, 1, 0]],
  ])
    for (let i = 0; i < ids.length; i += 3) {
      const ps = ids.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]);
      if (normalFor(...ps)[1] * n[1] < 0) ps.reverse();
      o.addTriangle(
        slot,
        ref,
        ps,
        n,
        ps.map((p) => [p[0], p[2]]),
        col,
      );
    }
}
function roof(o, ps, col = roofgrey) {
  if (normalFor(...ps)[1] < 0) ps = [...ps].reverse();
  const n = normalFor(...ps);
  if (ps.length === 3)
    o.addTriangle(
      'roof',
      ref,
      ps,
      n,
      ps.map((p) => [p[0], p[2]]),
      col,
    );
  else quad(o, 'roof', ps, n, col);
}
function strip(o, slot, a, b, w, col, n = [0, 0, 1]) {
  const v = b.map((p, i) => p - a[i]),
    q = [n[1] * v[2] - n[2] * v[1], n[2] * v[0] - n[0] * v[2], n[0] * v[1] - n[1] * v[0]],
    l = Math.hypot(...q);
  if (l < 1e-8) return;
  const u = q.map((v) => (v * w) / l / 2),
    ps = [
      a.map((v, i) => v - u[i]),
      b.map((v, i) => v - u[i]),
      b.map((v, i) => v + u[i]),
      a.map((v, i) => v + u[i]),
    ];
  quad(o, slot, ps, normalFor(...ps), col);
  if (slot === 'metal' || slot === 'stone') {
    const back = [...ps].reverse();
    quad(o, slot, back, normalFor(...back), col);
  }
}
function rod(o, d, slot, a, b, w, col, n) {
  if (d > 1) beam(o, slot, a, b, w, w, col);
  else strip(o, slot, a, b, w, col, n);
}
function clipY(ps, y, above) {
  const r = [];
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i],
      b = ps[(i + 1) % ps.length],
      A = above ? a[1] >= y : a[1] <= y,
      B = above ? b[1] >= y : b[1] <= y;
    if (A) r.push(a);
    if (A !== B) {
      const t = (y - a[1]) / (b[1] - a[1]);
      r.push(a.map((v, k) => v + (b[k] - v) * t));
    }
  }
  return r;
}
function flat(o, slot, ps, col) {
  if (ps.length < 3) return;
  for (let i = 1; i < ps.length - 1; i++) {
    const p = [ps[0], ps[i], ps[i + 1]];
    if (Math.hypot(...normalFor(...p)) < 0.5) continue;
    if (normalFor(...p)[2] < 0) p.reverse();
    const area =
      (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1]);
    if (Math.abs(area) < 1e-8) continue;
    o.addTriangle(
      slot,
      ref,
      p,
      [0, 0, 1],
      p.map((p) => [p[0], p[1]]),
      col,
    );
  }
}
function arch(w, h, n, style = 'pointed') {
  if (style === 'rect')
    return [
      [-w / 2, 0],
      [w / 2, 0],
      [w / 2, h],
      [-w / 2, h],
    ];
  let top = [];
  if (style === 'blunt')
    top = Array.from({ length: 2 * n + 1 }, (_, i) => {
      const x = w / 2 - (i * w) / (2 * n),
        t = Math.abs(x) / (w / 2);
      return [x, h - w * 0.3 * (0.45 * t + 0.55 * t * t)];
    });
  else if (style === 'segment')
    top = Array.from({ length: n + 1 }, (_, i) => {
      const a = (i * Math.PI) / n;
      return [(w / 2) * Math.cos(a), h - w * 0.26 + w * 0.26 * Math.sin(a)];
    });
  else if (style === 'ogee')
    top = Array.from({ length: 2 * n + 1 }, (_, i) => {
      const x = w / 2 - (i * w) / (2 * n),
        t = 1 - Math.abs(x) / (w / 2);
      return [x, h - w * 0.9 + w * 0.9 * (t + 0.13 * Math.sin(2 * Math.PI * t))];
    });
  else {
    const rise = (w * Math.sqrt(3)) / 2,
      base = h - rise;
    for (let i = 0; i <= n; i++) {
      const a = (i * Math.PI) / 3 / n;
      top.push([-w / 2 + w * Math.cos(a), base + w * Math.sin(a)]);
    }
    for (let i = 1; i <= n; i++) {
      const a = (2 * Math.PI) / 3 + (i * Math.PI) / 3 / n;
      top.push([w / 2 + w * Math.cos(a), base + w * Math.sin(a)]);
    }
  }
  return [[-w / 2, 0], [w / 2, 0], ...top];
}
function outline(o, _d, ps, z, col = cream, wide = 0.105, slot = 'trim') {
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i],
      b = ps[(i + 1) % ps.length];
    strip(o, slot, [a[0], a[1], z], [b[0], b[1], z], wide, col);
  }
}
function glazing(o, d, ps, z, op) {
  if (op.colored && d > 0) {
    const colors = ['59776b', '415773', 'a28c59', '5c7161', '8e5e60'],
      cuts = [op.y, op.y + op.h * 0.34, op.y + op.h * 0.68, op.y + op.h + 0.1];
    for (let j = 0; j < 3; j++) {
      const clipped = clipY(
        clipY(
          ps.map((p) => [p[0], p[1], z]),
          cuts[j],
          true,
        ),
        cuts[j + 1],
        false,
      );
      flat(o, 'glass', clipped, rgb(colors[(op.seed + j) % colors.length]));
    }
  } else
    flat(
      o,
      'glass',
      ps.map((p) => [p[0], p[1], z]),
      glass,
    );
}
function face(o, d, w, top, openings, { bottom = -4, foundation = true, col = brick } = {}) {
  const holes = openings.map((op) =>
      arch(op.w, op.h, d === 3 ? 8 : 2, op.style).map(([x, y]) => [op.x + x, op.y + y]),
    ),
    ps = [[-w / 2, bottom], [w / 2, bottom], [w / 2, top], [-w / 2, top], ...holes.flat()],
    starts = holes.map((_, i) => 4 + holes.slice(0, i).reduce((a, v) => a + v.length, 0)),
    ids = earcut(ps.flat(), starts);
  for (let i = 0; i < ids.length; i += 3) {
    const p = ids.slice(i, i + 3).map((j) => [ps[j][0], ps[j][1], 0]);
    if (foundation) {
      flat(o, 'stone', clipY(p, 0.9, false), stone);
      flat(o, 'brick', clipY(p, 0.9, true), col);
    } else flat(o, 'brick', p, col);
  }
  for (let k = 0; k < holes.length; k++) {
    const op = openings[k],
      ps = holes[k],
      depth = op.type === 'portal' ? 2.35 : d > 1 ? 0.18 : 0.06;
    if (op.type !== 'portal') {
      if (op.niche) {
        flat(
          o,
          'brick',
          ps.map((p) => [...p, -0.32]),
          brickDark,
        );
        B(o, 'metal', op.x, op.y + 0.65, -0.1, 0.28, 0.8, 0.18, dark);
        B(o, 'metal', op.x, op.y + 0.55, -0.08, 0.4, 0.13, 0.22, dark);
      } else glazing(o, d, ps, -depth, op);
    }
    if (d > 1 || op.type === 'portal')
      for (let i = 0; i < ps.length; i++) {
        const a = ps[i],
          b = ps[(i + 1) % ps.length],
          p = [
            [a[0], a[1], 0],
            [b[0], b[1], 0],
            [b[0], b[1], -depth],
            [a[0], a[1], -depth],
          ];
        quad(o, a[1] < 0.9 ? 'stone' : 'brick', p, normalFor(...p), a[1] < 0.9 ? stone : brickDark);
      }
    if ((d > 1 || op.type === 'portal') && !(d === 3 && op.mouldedFront)) {
      outline(o, d, ps, 0.035, cream, op.type === 'portal' ? 0.2 : 0.1);
      if (d > 2 && op.type !== 'portal') outline(o, 1, ps, 0.07, stone, 0.055);
    }
    if (op.type === 'portal') {
      const doorY = 0.9,
        doorH = 2.65,
        Bw = op.w * 0.78;
      B(o, 'wood', op.x, doorY, -depth + 0.04, Bw, doorH, 0.13, cream);
      if (d > 1)
        for (let j = 0; j < 4; j++) {
          const x = op.x - Bw / 2 + (Bw * (j + 0.5)) / 4;
          for (let y = 1.1; y < 3; y += 0.53) {
            B(o, 'trim', x, y, -depth + 0.12, Bw / 4 - 0.08, 0.37, 0.025, stone);
            if (d === 3)
              B(o, 'wood', x, y + 0.04, -depth + 0.15, Bw / 4 - 0.15, 0.28, 0.012, cream);
          }
          B(o, 'trim', x, 3.58, -depth + 0.13, 0.035, 0.8, 0.05, cream);
        }
      if (d > 0)
        flat(
          o,
          'glass',
          ps.map(([x, y]) => [x, Math.max(y, 3.6), -depth + 0.015]),
          glass,
        );
      if (d > 1) B(o, 'metal', op.x, 0.9, -depth + 0.18, 0.03, 2.6, 0.07, dark);
    } else if (d > 1 && !(d === 3 && op.mouldedFront)) {
      const y = op.y + op.h * 0.43;
      rod(
        o,
        1,
        'trim',
        [op.x - op.w / 2, y, -depth + 0.025],
        [op.x + op.w / 2, y, -depth + 0.025],
        0.045,
        cream,
      );
      if (op.h > 3.2)
        rod(
          o,
          1,
          'trim',
          [op.x - op.w / 2, op.y + op.h * 0.73, -depth + 0.025],
          [op.x + op.w / 2, op.y + op.h * 0.73, -depth + 0.025],
          0.045,
          cream,
        );
    }
  }
}
function gable(o, d, z, back = false) {
  const q = transform(o, back ? Math.PI : 0, 0, z),
    base = 12.2,
    w = 33.2,
    h = 9.5,
    opening = { x: 0, y: 15.4, w: 7.4, h: 4.1, style: 'segment' },
    shape = arch(opening.w, opening.h, d === 3 ? 24 : 8, 'segment').map(([x, y]) => [
      x,
      y + opening.y,
    ]),
    ps = [[-w / 2, base], [w / 2, base], [0, base + h], ...shape],
    idx = earcut(ps.flat(), [3]);
  for (let i = 0; i < idx.length; i += 3)
    flat(
      q,
      'brick',
      idx.slice(i, i + 3).map((j) => [ps[j][0], ps[j][1], 0]),
      brick,
    );
  if (back)
    flat(
      q,
      'wood',
      shape.map((p) => [...p, -0.12]),
      dark,
    );
  else glazing(q, d, shape, -0.18, opening);
  if (d > 0) {
    outline(q, d, shape, 0.025, cream, 0.11);
    if (!back)
      for (const x of [-10, 10]) {
        if (d === 1) {
          const p = [
            [x - 1.4, 12.65],
            [x + 1.4, 12.65],
            [x + 1.4, 14.95],
            [x - 1.4, 14.95],
          ];
          flat(
            q,
            'metal',
            p.map((v) => [...v, 0.03]),
            dark,
          );
          outline(q, d, p, 0.08, cream, 0.13);
          continue;
        }
        B(q, 'metal', x, 12.65, 0.03, 2.8, 2.3, 0.06, dark);
        for (const t of [-1, 1]) B(q, 'trim', x + t * 1.45, 12.6, 0.08, 0.13, 2.5, 0.13, cream);
        B(q, 'trim', x, 15.1, 0.08, 3.2, 0.18, 0.16, cream);
        if (d > 1)
          for (let y = 12.8; y < 14.9; y += 0.19)
            B(q, 'trim', x, y, 0.1, 2.75, 0.035, 0.055, stone);
      }
  }
  if (d > 1 && !back) {
    for (let i = -3; i <= 3; i++) {
      const x = i * 0.92,
        top = opening.y + opening.h - 0.2 - Math.pow(Math.abs(x) / 3.7, 2) * 1.9;
      rod(q, 1, 'trim', [x, opening.y + 0.1, 0.045], [x, top, 0.045], 0.065, cream);
      const a = arch(0.92, 1.9, 4).map(([u, v]) => [u + x, v + 16.7]);
      outline(q, 1, a, 0.055, cream, 0.045);
    }
    for (const y of [16.25, 17.1])
      rod(q, 1, 'trim', [-3.65, y, 0.055], [3.65, y, 0.055], 0.045, cream);
    for (const x of [-2.5, 0, 2.5]) {
      const op = { x, y: 13.35, w: 1.6, h: 2.0, style: 'ogee' },
        a = arch(op.w, op.h, 5, 'ogee').map(([u, v]) => [u + x, v + op.y]);
      flat(
        q,
        'glass',
        a.map((p) => [...p, 0.04]),
        glass,
      );
      outline(q, 1, a, 0.075, cream, 0.11);
    }
  }
  for (const s of [-1, 1])
    beam(q, 'trim', [(s * w) / 2, base, 0.06], [0, base + h, 0.06], 0.18, 0.2, cream);
}
function stairs(o, d, x, z, angle, width, run, top, bottom) {
  const q = transform(o, angle, x, z),
    n = d === 0 ? 2 : d === 1 ? 5 : Math.max(5, Math.round((top - bottom) / 0.17));
  for (let i = 0; i < n; i++)
    B(
      q,
      'stone',
      0,
      -4,
      ((i + 0.5) * run) / n,
      width,
      top - ((top - bottom) * i) / n + 4,
      run / n,
      stone,
    );
  if (d > 0)
    for (const s of [-1, 1]) {
      rod(
        q,
        d,
        'metal',
        [(s * width) / 2, top + 0.9, 0],
        [(s * width) / 2, bottom + 0.9, run],
        0.045,
        dark,
      );
      for (const t of [0, 0.5, 1])
        rod(
          q,
          d,
          'metal',
          [(s * width) / 2, top * (1 - t) + bottom * t, t * run],
          [(s * width) / 2, top * (1 - t) + bottom * t + 0.9, t * run],
          0.045,
          dark,
        );
    }
}
/** A thin stepped sash surround and separate upper hood leave the native brick arch visible. */
function mouldedLancets(o) {
  const sections = [
    [0, -0.015],
    [0, 0.055],
    [0.055, 0.07],
    [0.055, -0.015],
  ];
  for (const x of [-7.2, -5.4, -3.6, 3.6, 5.4, 7.2]) {
    const contours = sections.map(([pad, z]) =>
      arch(1.35 + pad * 2, 3.45 + pad * 2, 8).map(([u, y]) => [u + x, y + 7.3 - pad, z]),
    );
    for (let k = 0; k < contours.length; k++) {
      const a = contours[k],
        b = contours[(k + 1) % contours.length];
      for (let i = 0; i < a.length; i++) {
        const j = (i + 1) % a.length,
          p = [a[i], b[i], b[j], a[j]],
          n = normalFor(...p),
          u = p[1].map((v, j) => v - p[0][j]),
          length = Math.hypot(...u),
          v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]],
          uv = p.map((p) => [
            p.reduce((s, p, j) => s + ((p - a[i][j]) * u[j]) / length, 0),
            p.reduce((s, p, j) => s + ((p - a[i][j]) * v[j]) / length, 0),
          ]);
        o.addQuad('lancetMoulding', ref, p, n, uv, cream);
      }
    }
    const path = arch(1.75, 3.7, 4)
        .slice(2)
        .map(([u, y]) => [u + x, y + 7.3, 0.0725]),
      rings = path.map((p, i) => {
        const a = path[Math.max(0, i - 1)],
          b = path[Math.min(path.length - 1, i + 1)],
          dx = b[0] - a[0],
          dy = b[1] - a[1],
          length = Math.hypot(dx, dy);
        return [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([u, v]) => [
          p[0] + (dy / length) * u * 0.06,
          p[1] - (dx / length) * u * 0.06,
          p[2] - v * 0.0875,
        ]);
      });
    for (let j = 1; j < rings.length; j++)
      for (let i = 0; i < 4; i++) {
        const k = (i + 1) % 4;
        mouldFace(o, [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]]);
      }
    mouldFace(o, [...rings[0]].reverse());
    mouldFace(o, rings.at(-1));
    // One recessed horizontal sash matches the native front photograph.
    const y = 7.3 + 3.45 * 0.43;
    const joinery = {
      addQuad: (_s, _r, p) => mouldFace(o, p, 'windowJoinery'),
      addConvexPolygon: (_s, _r, p) => mouldFace(o, p, 'windowJoinery'),
    };
    beam(
      joinery,
      'windowJoinery',
      [x - 0.675, y, -0.155],
      [x + 0.675, y, -0.155],
      0.06,
      0.045,
      cream,
    );
  }
}
function mouldFace(o, p, slot = 'lancetHood') {
  const n = normalFor(...p),
    a = p[0],
    u = p[1].map((v, i) => v - a[i]),
    length = Math.hypot(...u),
    v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]],
    uv = p.map((p) => [
      p.reduce((s, p, i) => s + ((p - a[i]) * u[i]) / length, 0),
      p.reduce((s, p, i) => s + ((p - a[i]) * v[i]) / length, 0),
    ]);
  o.addQuad(slot, ref, p, n, uv, cream);
}
function front(o, d) {
  const q = transform(o, 0, 0, 25.015),
    ops = [];
  if (d > 0) {
    for (const s of [-1, 1]) {
      for (const a of [10.6, 12.4, 14.2, 16]) {
        ops.push({ x: s * a, y: 1.8, w: 1.18, h: 4.15 });
        ops.push({ x: s * a, y: 7.65, w: 1.22, h: 3.1 });
      }
      for (const a of [3.6, 5.4, 7.2])
        ops.push({ x: s * a, y: 7.3, w: 1.35, h: 3.45, mouldedFront: true });
    }
    ops.push({ x: 0, y: 1.8, w: 1.1, h: 2.1, niche: true });
  }
  for (const x of [-4.4, 4.4])
    ops.push({ x, y: 0.9, w: 5.1, h: 5.0, style: 'blunt', type: 'portal' });
  face(q, d, W, 12.2, ops);
  if (d === 3) mouldedLancets(q);
  for (const x of [-4.4, 4.4]) {
    const bottom = Math.min(...[-1.8, 0, 1.8].map((dx) => grade(x + dx, 29.4))) - 0.15;
    stairs(o, d, x, 25.02, 0, 4.0, 4.4, 0.9, bottom);
  }
  for (const x of [-17.1, -8.9, 8.9, 17.1]) {
    B(q, 'brick', x, -4, 0.2, 0.5, 16.3, 0.6, brick);
    if (d > 0) {
      for (const y of [4.9, 6.7]) B(q, 'trim', x, y, 0.26, 0.78, 0.13, 0.8, cream);
      for (let i = 0; i < 3; i++)
        B(q, 'trim', x, 8.6 + i * 0.37, 0.22, 0.85 - i * 0.12, 0.27, 0.7 - i * 0.05, cream);
      const pp = [
        [x - 0.5, 7.45, 0.62],
        [x + 0.5, 7.45, 0.62],
        [x, 8.0, 0.62],
      ];
      flat(q, 'trim', pp, cream);
    }
  }
  for (const y of [0.9, 6.7, 11.3, 12.1]) B(q, 'trim', 0, y, 0.055, W + 0.25, 0.12, 0.3, cream);
  if (d > 0) {
    const tablet = [
      [-0.8, 7.1],
      [0.8, 7.1],
      [0.8, 9.4],
      [0, 10.8],
      [-0.8, 9.4],
    ];
    flat(
      q,
      'trim',
      tablet.map((p) => [...p, 0.1]),
      stone,
    );
    outline(q, 1, tablet, 0.15, cream, 0.1);
    for (const s of [-1, 1]) {
      beam(q, 'trim', [s * 4.1, 12.3, 0.1], [0, 14.2, 0.1], 0.13, 0.19, cream);
      for (const x of [-1.1, 0, 1.1]) {
        const a = arch(0.75, 1.3, d > 1 ? 4 : 2).map(([u, v]) => [u + x, 12.3 + v]);
        flat(
          q,
          'glass',
          a.map((p) => [...p, 0.11]),
          glass,
        );
        outline(q, 1, a, 0.16, cream, 0.09);
      }
    }
    if (d > 1)
      for (let x = -16.5; x < 17; x += 0.55) {
        const a = arch(0.34, 0.65, 4, 'segment').map(([u, v]) => [u + x, v + 11.45]);
        flat(
          q,
          'brick',
          a.map((p) => [...p, 0.06]),
          brickDark,
        );
        if (d === 3) outline(q, 1, a, 0.085, brick, 0.055, 'brick');
      }
  }
  if (d === 3)
    for (const x of [-1.1, 0, 1.1])
      for (let y = 7.5; y < 9.2; y += 0.26)
        B(q, 'trim', x * 0.48, y, 0.21, 0.55, 0.035, 0.025, cream);
}
function sides(o, d) {
  for (const side of [-1, 1]) {
    const q = transform(o, (side * Math.PI) / 2, (side * W) / 2, 0),
      ops = [];
    if (d > 0) {
      for (const z of [23, 19, 15, -22]) {
        ops.push({
          x: -side * z,
          y: 7.65,
          w: 1.22,
          h: 3.1,
          colored: side < 0,
          seed: Math.round(z + 30) % 5,
        });
        if (Math.abs(z) !== 19 && Math.abs(z) !== 22)
          ops.push({ x: -side * z, y: 1.8, w: 1.1, h: 4.15, colored: side < 0, seed: 2 });
      }
      for (const z of [9.5, 4.3, -0.9, -6.1, -11.3, -16.5])
        for (const s of [-1, 1]) {
          const x = -side * z + s * 0.72;
          for (const [y, h] of [
            [1.8, 4.15],
            [7.65, 3.1],
          ])
            ops.push({
              x,
              y,
              w: 1.1,
              h,
              colored: side < 0,
              seed: Math.round((z + 30) * 2 + s + 2) % 5,
            });
        }
    }
    for (const z of [19, -22])
      ops.push({ x: -side * z, y: -2.5, w: 2.8, h: 6.0, style: 'blunt', type: 'portal' });
    face(q, d, L, 12.1, ops);
    for (const z of [19, -22]) {
      const x = -side * z;
      stairs(transform(q, 0, x, 0), d, 0, -2.25, 0, 2.15, 2.1, 0.9, -2.35);
    }
    const portalXs = [19, -22].map((z) => -side * z).sort((a, b) => a - b),
      wallRuns = [
        [-L / 2, portalXs[0] - 1.55],
        [portalXs[0] + 1.55, portalXs[1] - 1.55],
        [portalXs[1] + 1.55, L / 2],
      ];
    if (d > 0)
      for (const [a, b] of wallRuns) B(q, 'trim', (a + b) / 2, 0.9, 0.07, b - a, 0.12, 0.28, cream);
    for (const y of d > 0 ? [6.7, 11.9] : [11.9])
      B(q, 'trim', 0, y, 0.07, L + 0.12, 0.12, 0.28, cream);
    if (d > 0)
      for (const z of [-24.5, -19.3, -14.1, -8.9, -3.7, 1.5, 6.7, 11.9, 17.1, 23.3]) {
        const x = -side * z;
        B(q, 'brick', x, 0.9, 0.08, 0.31, 11.0, 0.25, brick);
        if (d > 1) {
          for (const y of [6.22, 11.5])
            for (let t = -2; t <= 2; t++)
              B(q, 'brick', x + t * 0.12, y, 0.2, 0.1, 0.18, 0.14, brickDark);
          if (d === 3) B(q, 'trim', x - 0.35, -1.3, 0.25, 0.09, 13.3, 0.09, cream);
        }
      }
    if (d > 1)
      for (let y = -3.8; y < 0.85; y += 0.32) {
        if (d > 0)
          for (const [a, b] of wallRuns)
            quad(
              q,
              'stone',
              [
                [a, y, 0.04],
                [b, y, 0.04],
                [b, y + 0.025, 0.04],
                [a, y + 0.025, 0.04],
              ],
              [0, 0, 1],
              rgb('aaa99c'),
            );
        if (d === 3)
          for (let x = -24; x < 25; x += 0.9) {
            const u = x + (Math.round(y * 3) % 2) * 0.43;
            if (portalXs.some((p) => Math.abs(p - u) < 1.6)) continue;
            quad(
              q,
              'stone',
              [
                [u, y, 0.041],
                [u + 0.024, y, 0.041],
                [u + 0.024, y + 0.3, 0.041],
                [u, y + 0.3, 0.041],
              ],
              [0, 0, 1],
              rgb('a4a598'),
            );
          }
      }
  }
}
function auditorium(o, d) {
  B(o, 'stone', 0, -4, 0, W - 4.7, 4.9, L - 4.7, stone);
  B(o, 'wood', 0, 0.9, 0, W, 0.12, L, rgb('9c8665'));
  front(o, d);
  sides(o, d);
  face(transform(o, Math.PI, 0, -25.015), d, W, 12.1, [], {});
  gable(o, d, 25.02);
  gable(o, d, -25.02, true);
  for (const s of [-1, 1]) {
    roof(
      o,
      [
        [(s * W) / 2, 12.15, 25],
        [(s * W) / 2, 12.15, -25],
        [0, 21.65, -25],
        [0, 21.65, 25],
      ],
      roofgrey,
    );
    beam(o, 'trim', [(s * W) / 2, 12.1, -25], [(s * W) / 2, 12.1, 25], 0.2, 0.2, cream);
  }
  for (const x of [-16.3, 16.3]) {
    B(o, 'brick', x, 0.9, -23.7, 0.85, 13.2, 0.85, brick);
    B(o, 'brick', x, 13.6, -23.7, 1.1, 0.25, 1.1, brickDark);
    B(o, 'brick', x, 14.0, -23.7, 1.0, 0.3, 1.0, brick);
  }
  if (d > 1)
    for (let z = -24.9; z < 25; z += d === 3 ? 0.8 : 2.4)
      for (const s of [-1, 1]) {
        const n = [s * 0.5, 0.86, 0],
          ps = [
            [(s * W) / 2, 12.18, z],
            [0, 21.68, z],
            [0, 21.68, z + 0.014],
            [(s * W) / 2, 12.18, z + 0.014],
          ];
        quad(o, 'roof', ps, n, rgb('636963'));
      }
}
function screen(o, d) {
  const q = transform(o, Math.PI / 2, 14.05, -45.6),
    w = 23.8,
    y0 = 4.85,
    y1 = 9.55;
  if (d < 2) {
    B(q, 'copper', 0, y0, 0, w, y1 - y0, 0.18, copper);
    if (d > 0)
      for (let x = -10; x < 11; x += 3.2)
        for (let y = 5.2; y < 9.5; y += 1.2)
          quad(
            q,
            'metal',
            [
              [x - 0.05, y - 0.05, 0.1],
              [x + 0.05, y - 0.05, 0.1],
              [x + 0.05, y + 0.05, 0.1],
              [x - 0.05, y + 0.05, 0.1],
            ],
            [0, 0, 1],
            dark,
          );
    return;
  }
  const cols = d === 3 ? 42 : 8,
    rows = d === 3 ? 17 : 4,
    pitchX = w / cols,
    pitchY = (y1 - y0) / rows,
    r = 0.053;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const x = -w / 2 + i * pitchX,
        y = y0 + j * pitchY;
      B(q, 'copper', x + pitchX / 2, y, 0, pitchX, pitchY / 2 - r, 0.055, copper);
      B(q, 'copper', x + pitchX / 2, y + pitchY / 2 + r, 0, pitchX, pitchY / 2 - r, 0.055, copper);
      for (const s of [-1, 1])
        B(
          q,
          'copper',
          x + pitchX / 2 + s * (pitchX / 4 + r / 2),
          y + pitchY / 2 - r,
          0,
          pitchX / 2 - r,
          r * 2,
          0.055,
          copper,
        );
    }
}
function additions(o, d) {
  const rear = frame.authoredComponents.rearOutline,
    pav = frame.authoredComponents.pavilionOutline;
  poly(o, 'stone', rear, -4, 0.9, stone);
  poly(o, 'roof', rear, 9.35, 9.55, roofgrey);
  const core = [];
  for (let i = 0; i < rear.length; i++) {
    const a = rear[i],
      b = rear[(i + 1) % rear.length],
      A = a[0] <= 9.5,
      C = b[0] <= 9.5;
    if (A) core.push(a);
    if (A !== C) {
      const t = (9.5 - a[0]) / (b[0] - a[0]);
      core.push([9.5, a[1] + t * (b[1] - a[1])]);
    }
  }
  poly(o, 'brick', core, 0.9, 9.35, brick); // native service envelope clipped behind the covered entrance.
  const q = transform(o, Math.PI / 2, 14.05, -45.6);
  for (const s of [-1, 1]) B(q, 'brick', s * 12.25, 0.9, 0, 0.7, 8.8, 0.9, brick);
  screen(o, d);
  B(q, 'metal', 0, 4.65, 2, 25, 0.23, 4.5, dark);
  quad(
    q,
    'glass',
    [
      [-11.8, 0.9, -2.65],
      [11.8, 0.9, -2.65],
      [11.8, 4.65, -2.65],
      [-11.8, 4.65, -2.65],
    ],
    [0, 0, 1],
    glass,
  );
  if (d > 0)
    for (let x = -11.2; x < 12; x += 1.7) B(q, 'metal', x, 0.9, -2.58, 0.06, 3.7, 0.13, dark);
  stairs(o, d, 14, -45.6, Math.PI / 2, 18, 5.5, 0.9, -2.65);
  poly(o, 'stone', pav, -4, 0.9, stone);
  poly(o, 'roof', pav, 5.15, 5.4, dark);
  const xs = pav.map((p) => p[0]),
    zs = pav.map((p) => p[1]),
    x = (Math.min(...xs) + Math.max(...xs)) / 2,
    z = (Math.min(...zs) + Math.max(...zs)) / 2,
    w = Math.max(...xs) - Math.min(...xs),
    dep = Math.max(...zs) - Math.min(...zs);
  for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    const side = transform(o, a, x + (Math.sin(a) * w) / 2, z + (Math.cos(a) * dep) / 2),
      ww = Math.abs(Math.sin(a)) > 0.5 ? dep : w;
    quad(
      side,
      'glass',
      [
        [-ww / 2, 0.9, 0],
        [ww / 2, 0.9, 0],
        [ww / 2, 5.15, 0],
        [-ww / 2, 5.15, 0],
      ],
      [0, 0, 1],
      glass,
    );
    if (d > 0)
      for (let u = -ww / 2; u <= ww / 2; u += 1.7)
        if (d === 1) rod(side, 1, 'metal', [u, 0.9, 0.03], [u, 5.15, 0.03], 0.06, dark);
        else B(side, 'metal', u, 0.9, 0.03, 0.06, 4.25, 0.1, dark);
    for (const y of d === 0 ? [] : [0.9, 3.1, 5.1])
      B(side, 'metal', 0, y, 0.05, ww, 0.09, 0.12, dark);
  }
  B(o, 'metal', 6, 4.8, -62, 13.5, 0.2, 3.0, dark);
  if (d > 1) {
    B(o, 'glass', -1, 9.55, -42.5, 3.3, 0.8, 6.7, glass);
    for (const s of [-1, 1])
      beam(
        o,
        'metal',
        [-2.7, 9.6, -42.5 + s * 3.35],
        [0.7, 10.35, -42.5 + s * 3.35],
        0.08,
        0.08,
        dark,
      );
    for (const z of [-45.7, -44.1, -42.5, -40.9, -39.3])
      beam(o, 'metal', [-2.7, 9.65, z], [0.7, 10.4, z], 0.07, 0.07, dark);
  }
}
function build(o, d) {
  auditorium(o, d);
  additions(o, d);
}
export const rymanAuditorium = (o) => build(o, 3),
  rymanAuditoriumStreet = (o) => build(o, 2),
  rymanAuditoriumDistrict = (o) => build(o, 1),
  rymanAuditoriumSkyline = (o) => build(o, 0);
const surfaces = {
  lancetHood: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.87, metallic: 0 },
  lancetMoulding: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.87, metallic: 0 },
  windowJoinery: { slot: 'door', graph: 'wood_plain', roughness: 0.88, metallic: 0 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.94, metallic: 0 },
  stone: {
    slot: 'foundation',
    graph: 'stone_sandstone',
    roughness: 0.96,
    metallic: 0,
    doubleSided: true,
  },
  trim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.87, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.94, metallic: 0 },
  metal: {
    slot: 'trim',
    graph: 'metal_painted',
    roughness: 0.78,
    metallic: 0.14,
    doubleSided: true,
  },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.88, metallic: 0 },
  copper: { slot: 'trim', graph: 'metal_painted', roughness: 0.82, metallic: 0.2 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.36, metallic: 0.12 },
};
export const rymanAuditoriumModel = {
  id: 'ryman_auditorium',
  key: 'ryman_auditorium',
  recipe: 'structure-ryman-auditorium.mjs',
  cell: 'dn/dn6',
  title: 'Ryman Auditorium',
  brief:
    'Surviving red-brick Gothic auditorium on sloping limestone base, steep dark gabled roof with two rear chimneys, ornate white-banded front with twin deeply recessed door portals/stairs, grouped lancets/offset buttresses/Union Gospel panel and large traceried gable light. Long side paired stained-glass bays, real recessed side stair portals and downpipes. Separately bounded modern rear wing with copper screen/open covered entrance, concrete steps and lower glazed pavilion. No neighboring towers or honky-tonks/interior.',
  camera: [-78, 50, 99],
  lookAt: [0, 7, -15],
  qaCameras: [
    { name: 'front', position: [-42, 23, 65], lookAt: [0, 10, 24] },
    { name: 'front-detail', position: [-8, 7.5, 39], lookAt: [-4.4, 4, 24] },
    { name: 'lancet-detail', position: [-8, 10.3, 31], lookAt: [-5.4, 9.1, 25.015] },
    { name: 'gable-detail', position: [8, 21, 42], lookAt: [0, 15, 25] },
    { name: 'side-detail', position: [-31, 9, -2], lookAt: [-17.25, 6, 0] },
    { name: 'base-detail', position: [30, 2.5, -6], lookAt: [17.25, 0.5, -13] },
    { name: 'roof-detail', position: [-29, 37, -3], lookAt: [0, 16, -5] },
    { name: 'back', position: [48, 18, -73], lookAt: [5, 5, -48] },
    { name: 'pavilion-detail', position: [28, 11, -88], lookAt: [7, 3, -72] },
  ],
  mediumFiContext: { scale: 2, cameraYaw: 0, groundY: -4 },
  build: rymanAuditorium,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Unchanged original Terrarium tile/3m review grid resolve broad southward slope. Dry FifthAve sidewalk[-13,28] datum137.5265m, fixed historic/modern limestone foundation below grade to-4m. Floor/water table.9m, entry flights use separately sampled end grades without altering terrain. Exact thresholds/paving/hidden foundations remain estimates; bounded preview, footprint replacement disabled.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-ryman-auditorium.mjs',
    level: 'skyline',
    export: 'rymanAuditoriumSkyline',
    errorMeters: 2.5,
    surfaces,
    authoredLevels: {
      district: { export: 'rymanAuditoriumDistrict', errorMeters: 1, surfaces },
      street: { export: 'rymanAuditoriumStreet', errorMeters: 0.3, surfaces },
    },
  },
  limitations: [
    'Current2007–2023 historic exterior combined with built2015rear wing/pavilion. Source photographs/text inform exterior rather than a survey; fine tracery/trim/window colors/hidden faces and unmeasured roof heights are original proportional estimates.',
    'Native generalized historic plan34.5mfront/50.03msides retained; primary120ft/178ft nominal includes offsets/vestibule. Exact plan chainages and facade bay spacing remain approximate, no forced stretching.',
    'Independent original Terrarium heights remain unchanged.3m review grid/source3.857mpixels are not threshold surveys. Dry reference137.5265m/floor.9m/fixed-4m foundation and stair end levels are bounded authoring pose; host terrain compatibility remains dataset-dependent.',
    'Copper-screen hole pitch is coarsened geometrically at close/street; district uses geometric dark marks. Modern rooflight/service envelope and rear hidden facades are approximate native-plan masses subordinate to historic roof. Rear gable light is boarded per NPS description rather than duplicating front tracery.',
    'No original lost parapet crockets, actual signage/artwork/textures, interiors/pews/stage, neighboring towers/honky-tonks, trees/crowds/vehicles or photo pixels embedded. Shared metric material graphs and original palette colors only.',
  ],
};
export { front, gable, screen, sides };
