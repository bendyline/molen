/** The Sabatini hospital and the Nouvel extension of Madrid's Reina Sofía. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { prism, rect } from './khmer-structure-geometry.mjs';

export const layout = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/ez/ezj/museo_nacional_centro_de_arte_reina_sofia/layout.json',
      import.meta.url,
    ),
  ),
);
const clear = {
  slot: 'window',
  localRef: 'palette:#e4f5f6',
  roughness: 0.22,
  metallic: 0.08,
  alphaMode: 'BLEND',
  baseColorFactor: [1, 1, 1, 0.36],
  doubleSided: true,
};
const lime = { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 };
const stone = { slot: 'foundation', graph: 'stone_granite', roughness: 0.94 };
const steel = { slot: 'trim', graph: 'metal_standing_seam', roughness: 0.77, metallic: 0.15 };
const lacquer = { slot: 'roof', graph: 'metal_painted', roughness: 0.32, metallic: 0.17 };
const frit = { slot: 'wall', graph: 'glass_frit_triangular', roughness: 0.33 };
const garden = { slot: 'wall', graph: 'gravel', roughness: 0.97 };

// The mesh carries each role's tint. Reuse the same draw for materials with a common finish.
export const surfaces = {
  plaster: lime,
  limestone: lime,
  granite: stone,
  stonePanel: stone,
  slate: steel,
  graphite: steel,
  frame: steel,
  red: lacquer,
  soffit: lacquer,
  frit,
  basin: frit,
  door: { slot: 'door', graph: 'wood_shou_sugi_ban', roughness: 0.89 },
  paths: garden,
  lawn: garden,
  bark: garden,
  leaf: garden,
  clear,
};
const colors = {
  plaster: [0.76, 0.688, 0.55],
  limestone: [0.61, 0.544, 0.446],
  granite: [0.39, 0.364, 0.328],
  slate: [0.143, 0.159, 0.167],
  red: [0.48, 0.046, 0.032],
  soffit: [0.43, 0.047, 0.034],
  graphite: [0.061, 0.08, 0.084],
  frame: [0.62, 0.67, 0.68],
  stonePanel: [0.3, 0.337, 0.34],
  frit: [0.28, 0.455, 0.49],
  door: [0.046, 0.045, 0.039],
  paths: [0.61, 0.534, 0.386],
  lawn: [0.25, 0.35, 0.118],
  bark: [0.27, 0.165, 0.088],
  leaf: [0.185, 0.3, 0.079],
  basin: [0.16, 0.23, 0.19],
  clear: [0.57, 0.78, 0.81],
};
const up = [0, 1, 0],
  down = [0, -1, 0],
  ref = 'palette:#ffffff',
  mix = (a, b, t) => a + (b - a) * t;
const area = (r) =>
  r.reduce((a, p, i) => {
    const q = r[(i + 1) % r.length];
    return a + p[0] * q[1] - p[1] * q[0];
  }, 0) * 0.5;
const tone = (i, j = 0) =>
  0.95 + (((Math.imul(i + 23, 49999) ^ Math.imul(j + 37, 57803)) >>> 3) % 101) / 1150;
const ringAt = (r, y) => r.map(([x, z]) => [x, typeof y === 'function' ? y(x, z) : y, z]);
const block = (f, role, x, z, w, d, lo, hi) => prism(f, role, rect(x, z, w, d), lo, hi, false);
function faceWriter(out) {
  return (role, vertices, dir, light = 1) => {
    for (let i = 1; i < vertices.length - 1; i++) {
      const p = [vertices[0], vertices[i], vertices[i + 1]].map((v) => v.map(Math.fround));
      let n = normalFor(...p);
      if (Math.hypot(...n) < 0.5) continue;
      if (n.reduce((s, v, j) => s + v * dir[j], 0) < 0) {
        p.reverse();
        n = n.map((v) => -v);
      }
      out.addTriangle(
        role,
        ref,
        p,
        n,
        undefined,
        colors[role].map((x) => Math.min(1, x * light)),
      );
    }
  };
}
function cap(f, role, rings, y, n = up) {
  const vertices = rings.flat(),
    starts = [];
  let k = rings[0].length;
  for (const h of rings.slice(1)) {
    starts.push(k);
    k += h.length;
  }
  const ids = earcut(vertices.flat(), starts),
    p = ringAt(vertices, y);
  for (let i = 0; i < ids.length; i += 3) f(role, [p[ids[i]], p[ids[i + 1]], p[ids[i + 2]]], n);
}
function front(a, b, sign) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    w = Math.hypot(dx, dz),
    tx = dx / w,
    tz = dz / w;
  const n = [tz * sign, 0, -tx * sign];
  return {
    w,
    n,
    t: [tx, 0, tz],
    p: (u, y, d = 0) => [a[0] + tx * u + n[0] * d, y, a[1] + tz * u + n[2] * d],
  };
}
function panel(f, role, F, a, b, lo, hi, d = 0, light = 1) {
  if (b - a < 0.002 || hi - lo < 0.002) return;
  f(role, [F.p(a, lo, d), F.p(b, lo, d), F.p(b, hi, d), F.p(a, hi, d)], F.n, light);
}
function ribbon(f, role, F, a, b, lo, hi, d, depth) {
  if (b - a < 0.01) return;
  const outline = [F.p(a, 0, d - depth), F.p(b, 0, d - depth), F.p(b, 0, d), F.p(a, 0, d)].map(
    ([x, , z]) => [x, z],
  );
  prism(f, role, { outline }, lo, hi, false);
}
function edges(r, hole = false) {
  const sign = Math.sign(area(r)) * (hole ? -1 : 1);
  return r.map((p, i) => front(p, r[(i + 1) % r.length], sign));
}
function offset(r, amount, hole) {
  const f = edges(r, hole);
  return r.map(([x, z], i) => {
    const a = f.at(i - 1).n,
      b = f[i].n,
      s = amount / Math.max(0.58, 1 + a[0] * b[0] + a[2] * b[2]);
    return [x + (a[0] + b[0]) * s, z + (a[2] + b[2]) * s];
  });
}
function skin(f, role, a, b, ya, yb, hole = false) {
  const A = ringAt(a, ya),
    B = ringAt(b, yb),
    face = edges(a, hole);
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length;
    f(role, [A[i], A[j], B[j], B[i]], face[i].n, tone(i));
  }
}
function aperture(f, F, a, b, y, h, arched, tier, role = 'door') {
  const sill = y + 0.19,
    spring = y + h * (arched ? 0.73 : 1) - 0.12,
    top = y + h - 0.12,
    depth = tier >= 3 ? 0.23 : 0.01;
  const seg = arched ? (tier >= 3 ? 8 : tier === 2 ? 5 : 3) : 1;
  const outline = [
    [a, sill],
    [b, sill],
    [b, spring],
  ];
  if (arched)
    outline.push(
      ...Array.from({ length: seg }, (_, i) => {
        const t = (Math.PI * (i + 1)) / seg;
        return [(a + b) * 0.5 + (b - a) * 0.5 * Math.cos(t), spring + (top - spring) * Math.sin(t)];
      }),
    );
  else outline.push([a, spring]);
  f(
    role,
    outline.map(([u, y]) => F.p(u, y, -depth)),
    F.n,
  );
  if (tier < 3) return;
  for (let i = 0; i < outline.length; i++) {
    const [u, y] = outline[i],
      [v, z] = outline[(i + 1) % outline.length];
    const n = [F.t[0] * (y - z), v - u, F.t[2] * (y - z)];
    f('limestone', [F.p(u, y, -depth), F.p(v, z, -depth), F.p(v, z, 0.01), F.p(u, y, 0.01)], n);
  }
  if (tier >= 3) {
    const center = (a + b) * 0.5;
    panel(f, 'graphite', F, center - 0.038, center + 0.038, sill, spring - 0.03, -depth + 0.014);
    panel(
      f,
      'graphite',
      F,
      a + 0.05,
      b - 0.05,
      sill + (spring - sill) * 0.53,
      sill + (spring - sill) * 0.53 + 0.045,
      -depth + 0.014,
    );
  }
}
function historicWall(f, F, i, base, top, court, tier) {
  const w = F.w;
  const belt = [2.2, 6.78, 11.5, 16.04, 20.83],
    length = top - base;
  if (tier === 0 || w < 2.15) {
    panel(f, 'plaster', F, 0, w, base, top, 0, tone(i));
    return;
  }
  const n = Math.max(1, Math.round(w / (tier === 1 ? 6.6 : court ? 4.18 : 4.75)));
  panel(f, 'granite', F, 0, w, base, 2.2, 0.014);
  for (let row = 0; row < 4; row++) {
    const lo = belt[row],
      hi = belt[row + 1],
      height = hi - lo,
      arched = court && row < 3;
    if (tier <= 2) panel(f, 'plaster', F, 0, w, lo, hi, 0, tone(i, row));
    for (let bay = 0; bay < n; bay++) {
      const a = (w * bay) / n,
        b = (w * (bay + 1)) / n,
        center = (a + b) * 0.5;
      const ww = Math.min((b - a) * 0.62, row === 3 ? 1.28 : arched ? 2.62 : 1.66),
        u = center - ww * 0.5,
        v = center + ww * 0.5;
      const bottom = lo + height * (row === 3 ? 0.23 : 0.19),
        h = height * (row === 3 ? 0.57 : 0.68),
        sill = bottom + 0.19;
      const spring = bottom + h * (arched ? 0.73 : 1) - 0.12,
        top = bottom + h - 0.12;
      if (tier === 1) {
        if (bay % 2 === 0) panel(f, 'door', F, u, v, sill, top, 0.035);
        continue;
      }
      if (tier === 2) {
        const raised = { ...F, p: (u, y, d = 0) => F.p(u, y, d + 0.044) };
        aperture(f, raised, u, v, bottom, h, arched, tier);
        panel(f, 'limestone', F, u - 0.15, v + 0.15, sill - 0.14, sill - 0.01, 0.061);
        continue;
      }
      panel(f, 'plaster', F, a, u, lo, hi, 0, tone(i, bay));
      panel(f, 'plaster', F, v, b, lo, hi, 0, tone(i, bay));
      panel(f, 'plaster', F, u, v, lo, sill);
      panel(f, 'plaster', F, u, v, top, hi);
      if (arched) {
        const seg = tier >= 3 ? 8 : 5;
        for (let k = 0; k < seg; k++) {
          const at = (i) => [
            center + ww * 0.5 * Math.cos((Math.PI * i) / seg),
            spring + (top - spring) * Math.sin((Math.PI * i) / seg),
          ];
          const [x, y] = at(k),
            [X, Y] = at(k + 1);
          f('limestone', [F.p(x, y), F.p(X, Y), F.p(X, top), F.p(x, top)], F.n);
        }
      }
      aperture(f, F, u, v, bottom, h, arched, tier);
      if (tier >= 3) {
        ribbon(f, 'limestone', F, u - 0.18, v + 0.18, sill - 0.11, sill + 0.015, 0.13, 0.17);
        const frameHeight = arched ? spring : top + 0.1;
        panel(f, 'limestone', F, u - 0.13, u, sill, frameHeight, 0.021);
        panel(f, 'limestone', F, v, v + 0.13, sill, frameHeight, 0.021);
        if (!arched) panel(f, 'limestone', F, u - 0.13, v + 0.13, top, top + 0.1, 0.021);
        if (court && bay > 0 && row < 3)
          ribbon(f, 'limestone', F, a - 0.12, a + 0.12, lo + 0.05, hi - 0.05, 0.13, 0.14);
        if (tier === 4 && row < 3)
          for (const offset of [-0.29, 0.29]) {
            const x = center + ww * offset;
            panel(f, 'graphite', F, x - 0.018, x + 0.018, sill + 0.03, spring - 0.07, -0.196);
          }
      }
    }
    if (tier >= 2) ribbon(f, 'limestone', F, 0, w, hi - 0.135, hi + 0.025, 0.18, 0.23);
    else if (row === 0 || row === 3) panel(f, 'limestone', F, 0, w, hi - 0.12, hi + 0.023, 0.024);
  }
  panel(f, 'limestone', F, 0, w, top - 0.32, top);
  if (length > 23 && tier >= 3) ribbon(f, 'granite', F, 0, w, 2.04, 2.2, 0.16, 0.17);
}
function historic(f, tier) {
  const { base, cornice, ridge } = layout.historic,
    outer = tier === 0 ? layout.skylineOutline : layout.outline,
    court = layout.court;
  for (const [i, r] of [outer, court].entries()) {
    const hole = i === 1;
    for (const [j, F] of edges(r, hole).entries()) historicWall(f, F, j, base, cornice, hole, tier);
    const lip = offset(r, 0.3, hole),
      roofBase = offset(r, 0.18, hole),
      crown = offset(r, -1.06, hole);
    if (tier >= 2) {
      skin(f, 'limestone', r, lip, cornice - 0.19, cornice + 0.06, hole);
      skin(f, 'limestone', lip, roofBase, cornice + 0.06, cornice + 0.28, hole);
    } else {
      skin(f, 'limestone', r, roofBase, cornice - 0.19, cornice + 0.28, hole);
    }
    skin(f, 'slate', roofBase, crown, cornice + 0.28, ridge, hole);
  }
  const roof = [offset(outer, -1.06, false), offset(court, -1.06, true)];
  cap(f, 'slate', roof, ridge);
  if (tier >= 2) {
    for (const z of [-35, 36])
      for (const x of [-29, -13, 4, 22, 36]) {
        block(f, 'graphite', x, z, tier >= 3 ? 9.2 : 7.1, 2.05, ridge + 0.06, ridge + 0.22);
        if (tier >= 3)
          for (let i = 0; i < 6; i++)
            block(f, 'frit', x - 3.75 + i * 1.5, z, 1.37, 1.82, ridge + 0.22, ridge + 0.245);
      }
  }
}
function rail(f, F, u0, u1, y, tier, role = 'graphite') {
  panel(f, role, F, u0, u1, y + 0.94, y + 1.02);
  if (tier < 2) return;
  panel(f, role, F, u0, u1, y + 0.38, y + 0.43);
  panel(f, role, F, u0, u1, y + 0.63, y + 0.68);
  const count = Math.ceil((u1 - u0) / (tier >= 3 ? 1.5 : 3));
  for (let i = 0; i <= count; i++) {
    const u = mix(u0, u1, i / count);
    panel(f, role, F, u - 0.032, u + 0.032, y + 0.03, y + 1.0, 0.018);
  }
}
function entrance(f, tier) {
  const S = layout.stairs,
    { x0, x1, z0, z1, landing } = S;
  block(f, 'granite', 0, (z0 + z1) * 0.5, x1 - x0, z1 - z0, layout.historic.base, landing);
  for (const { start, end, grade, steps: actualSteps } of S.approaches) {
    const steps = tier === 0 ? 3 : tier === 1 ? 6 : actualSteps;
    for (let i = 0; i < steps; i++) {
      const a = mix(start, end, i / steps),
        b = mix(start, end, (i + 1) / steps),
        y = mix(grade, landing, (i + 1) / steps);
      block(
        f,
        'granite',
        (a + b) * 0.5,
        (z0 + z1) * 0.5,
        Math.abs(b - a),
        z1 - z0,
        layout.historic.base,
        y,
      );
      if (tier >= 2) rail(f, front([a, z0], [b, z0], 1), 0, Math.abs(b - a), y, tier);
    }
  }
  if (tier >= 1) {
    rail(f, front([x0, z0], [x1, z0], 1), 0, x1 - x0, landing, tier);
    const wall = front([-18, -46.03], [18, -45.92], 1);
    for (const u of [9.7, 18, 26.3]) {
      panel(f, 'door', wall, u - 1.45, u + 1.45, landing, landing + 3.01, 0.06);
      if (tier >= 2) {
        ribbon(f, 'limestone', wall, u - 1.72, u - 1.48, landing, landing + 3.39, 0.18, 0.16);
        ribbon(f, 'limestone', wall, u + 1.48, u + 1.72, landing, landing + 3.39, 0.18, 0.16);
        ribbon(
          f,
          'limestone',
          wall,
          u - 1.72,
          u + 1.72,
          landing + 3.14,
          landing + 3.39,
          0.18,
          0.16,
        );
      }
    }
  }
}
function lift(f, tier, L) {
  const { x, z, w, d, base, top, connect } = L,
    r = rect(x, z, w, d).outline,
    corner = edges(r);
  block(f, 'granite', x, z, w, d, base, 0.23);
  if (tier >= 1) {
    block(f, 'frit', x, z, w * 0.28, d * 0.4, 0.22, top - 0.45);
    for (const [u, v] of r) block(f, 'frame', u, v, 0.25, 0.25, 0.23, top + 0.35);
  }
  if (tier === 0) {
    for (const F of corner) panel(f, 'frit', F, 0.11, F.w - 0.11, 0.23, top);
  } else {
    for (const [i, F] of corner.entries()) {
      const bays = tier >= 3 ? (i % 2 ? 3 : 5) : tier >= 2 ? 3 : 1;
      for (let b = 0; b < bays; b++) {
        const a = (F.w * b) / bays,
          hi = (F.w * (b + 1)) / bays;
        panel(f, 'clear', F, a + 0.018, hi - 0.018, 0.23, top, 0);
        if (b > 0) ribbon(f, 'frame', F, a - 0.037, a + 0.037, 0.23, top, 0.044, 0.078);
      }
      for (let y = 3.7; y < top - 0.6; y += 4.13) {
        panel(f, 'frame', F, 0, F.w, y, y + 0.15, 0.034);
        if (tier >= 3) panel(f, 'frame', F, 0, F.w, y + 1.92, y + 1.98, 0.035);
      }
    }
  }
  for (let y = 3.65; tier >= 1 && y < top - 0.52; y += tier === 1 ? 8.28 : 4.14) {
    block(f, 'frame', x, z, w * 0.93, d * 0.9, y, y + 0.15);
    if (connect !== null && tier >= 1) {
      const end = z + d * 0.49,
        span = connect - end;
      block(f, 'frame', x, (connect + end) * 0.5, w * 0.6, span, y, y + 0.18);
      for (const side of tier >= 2 ? [-1, 1] : []) {
        const F = front([x + side * w * 0.3, end], [x + side * w * 0.3, connect], -side);
        panel(f, 'clear', F, 0, F.w, y + 0.19, y + 2.3);
        panel(f, 'frame', F, 0, F.w, y + 2.3, y + 2.44);
      }
    }
  }
  block(f, 'frame', x, z, w * 1.03, d * 1.04, top, top + 0.3);
  block(f, 'frame', x, z + 0.08, w * 1.13, 0.65, top + 1.04, top + 1.24);
  if (tier >= 2) {
    for (const side of [-1, 1]) {
      block(f, 'frame', x + side * w * 0.35, z + 0.08, 0.17, 0.29, top + 0.3, top + 1.04);
      rail(
        f,
        front([x - w * 0.56, z + 0.08 + side * 0.41], [x + w * 0.56, z + 0.08 + side * 0.41], side),
        0,
        w * 1.12,
        top + 1.24,
        tier,
        'frame',
      );
    }
  }
}
function modernFacade(f, B, F, i, tier, library) {
  const { base, plinth, roof } = B,
    w = F.w;
  panel(f, 'stonePanel', F, 0, w, base, plinth, 0, tone(i));
  panel(f, 'frit', F, 0, w, plinth, roof, 0, library ? 0.78 : 0.94);
  if (tier === 0) return;
  const n = Math.max(1, Math.round(w / (tier === 1 ? 8.2 : 2.48)));
  for (let b = 0; b <= n; b++) {
    const u = (w * b) / n;
    panel(f, 'graphite', F, Math.max(0, u - 0.086), Math.min(w, u + 0.086), plinth, roof, 0.045);
  }
  for (let y = plinth + 0.55; y < roof; y += 3.92) {
    panel(f, 'graphite', F, 0, w, y, y + 0.235, 0.07);
    if (tier >= 2) {
      panel(f, 'graphite', F, 0, w, y + 0.26, y + 0.64, 0.041);
      panel(f, 'frame', F, 0, w, y + 1.75, y + 1.8, 0.05);
    }
  }
  if (tier >= 2 && library && (i === 1 || i === 2)) {
    panel(f, 'graphite', F, 0, w, plinth, roof, 0.115, 0.8);
    for (let y = plinth + 0.24; y < roof - 0.19; y += tier >= 3 ? 0.3 : 0.64)
      panel(f, 'red', F, 0.12, w - 0.12, y, y + 0.11, 0.149, 0.79);
  }
  if (tier >= 3)
    for (let u = 1.9; u < w - 0.1; u += 1.9)
      panel(f, 'graphite', F, u, u + 0.032, base, plinth - 0.04, 0.032);
}
function softened(r, n) {
  if (!n) return r;
  return r.flatMap((p, i) => {
    const a = r.at(i - 1),
      b = r[(i + 1) % r.length],
      span = Math.min(
        1.6,
        Math.hypot(a[0] - p[0], a[1] - p[1]) * 0.2,
        Math.hypot(b[0] - p[0], b[1] - p[1]) * 0.2,
      );
    const inner = (q) => {
      const m = span / Math.hypot(q[0] - p[0], q[1] - p[1]);
      return q.map((v, j) => mix(p[j], v, m));
    };
    const u = inner(a),
      v = inner(b);
    return Array.from({ length: n + 1 }, (_, j) => {
      const t = j / n;
      return p.map((m, k) => mix(mix(u[k], m, t), mix(m, v[k], t), t));
    });
  });
}
function auditorium(f, B, tier) {
  const { outline, base, plinth, roof } = B;
  prism(f, 'stonePanel', { outline }, base, plinth, false);
  const body = softened(offset(outline, -0.48, false), tier >= 3 ? 4 : tier >= 2 ? 2 : 0);
  const shoulder = offset(body, 0.29, false);
  skin(f, 'red', body, shoulder, plinth, plinth + 3.0);
  skin(f, 'red', shoulder, shoulder, plinth + 3.0, roof - 1.17);
  skin(f, 'red', shoulder, body, roof - 1.17, roof);
  cap(f, 'slate', [body], roof);
  if (tier >= 1) {
    const r = edges(shoulder);
    r.forEach((F) => {
      if (F.w < 3.6) return;
      const bays = Math.max(1, Math.floor(F.w / 2.14));
      for (let k = 1; k < bays; k++) {
        const x = (F.w * k) / bays;
        if (tier >= 2)
          panel(f, 'graphite', F, x - 0.017, x + 0.017, plinth + 3.0, roof - 1.18, 0.021, 0.83);
        if (k % 4 !== 0) panel(f, 'door', F, x - 0.23, x + 0.23, roof - 3.2, roof - 1.49, 0.022);
      }
      if (tier >= 3)
        for (let y = plinth + 4.3; y < roof - 1.55; y += 1.52)
          panel(f, 'graphite', F, 0, F.w, y, y + 0.026, 0.018);
    });
    const overhang = rect(-26, 124, 10.6, 15.7).outline;
    prism(
      f,
      'red',
      { outline: softened(overhang, tier >= 3 ? 3 : 1) },
      plinth + 0.55,
      plinth + 6.22,
      false,
    );
  }
}
function extension(f, tier) {
  const [gallery, library, rooms] = layout.modern;
  for (const B of [gallery, library]) {
    const { outline, roof } = B;
    for (const [i, F] of edges(outline).entries()) modernFacade(f, B, F, i, tier, B === library);
    cap(f, 'slate', [outline], roof);
    if (tier >= 1) skin(f, 'frame', outline, outline, roof, roof + 0.3);
  }
  auditorium(f, rooms, tier);
  // External bridges are raised above the courtyard and leave the passage below clear.
  const decks = [
    [-32.5, 57.1, 9.1, 3.5, 10.68],
    [-20.5, 109, 10.8, 4.9, 9.92],
    [-13.1, 112.5, 6.7, 4.25, 12.15],
  ];
  for (const [x, z, w, d, y] of decks) {
    block(f, 'graphite', x, z, w, d, y - 0.43, y);
    if (tier >= 1)
      for (const F of edges(rect(x, z, w, d).outline)) rail(f, F, 0, F.w, y, tier, 'frame');
  }
  const { outline, holes, roofHeight, gradient, thickness } = layout.canopy;
  const top = (x, z) => roofHeight + z * gradient + x * 0.0032;
  const border = new Set(outline.map((p) => p.join(',')));
  const low = (x, z) => top(x, z) - (border.has([x, z].join(',')) ? 0.25 : thickness);
  const rings = [outline, ...holes];
  cap(f, 'slate', rings, top);
  cap(f, 'soffit', rings, low, down);
  skin(f, 'soffit', outline, outline, low, top);
  if (tier >= 1) for (const h of holes) skin(f, 'frame', h, h, low, top, true);
  if (tier >= 2) {
    for (const [x, z] of [
      [-63, 68],
      [-35, 58],
      [-32.5, 107],
      [-64, 137],
      [23, 72],
      [-8, 113],
    ]) {
      block(f, 'graphite', x, z, 0.54, 0.63, -4.6, low(x, z) + 0.2);
    }
  }
}
function polygonDisk(x, z, w, d, n, phase = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n + phase;
    return [x + Math.cos(a) * w * 0.5, z + Math.sin(a) * d * 0.5];
  });
}
function greenery(f, out, tier) {
  const { garden } = layout;
  for (const r of garden.paving) f('paths', r, up);
  // Garden planting has no structural role. Distant tiers keep the courtyard readable.
  for (const B of garden.beds) {
    const y = B.grade + 0.27,
      r = rect(B.x, B.z, B.w, B.d).outline;
    cap(f, 'lawn', [r], (x, z) => y + 0.014 * (-x + B.x) + 0.028 * (-z + B.z));
    if (tier >= 2) {
      for (const F of edges(r)) {
        const a = F.p(0, y + 0.06),
          b = F.p(F.w, y + 0.06);
        a[1] += 0.014 * (-a[0] + B.x) + 0.028 * (-a[2] + B.z);
        b[1] += 0.014 * (-b[0] + B.x) + 0.028 * (-b[2] + B.z);
        beam(out, 'frame', a, b, 0.044, 0.04, colors.frame);
      }
    }
  }
  if (tier === 0) return;
  for (const { x, z, y } of garden.fountains) {
    const n = tier >= 3 ? 24 : 12,
      outer = polygonDisk(x, z, 7.8, 4.2, n),
      inner = polygonDisk(x, z, 6.8, 3.3, n);
    prism(f, 'limestone', { outline: outer, holes: [inner] }, y - 0.4, y + 0.46, false);
    cap(f, 'basin', [inner], y + 0.26);
    block(f, 'limestone', x, z, 1.23, 1.06, y + 0.24, y + 1.43);
    if (tier >= 2) {
      const rim = polygonDisk(x, z, 1.72, 1.53, n);
      prism(f, 'limestone', { outline: rim }, y + 1.43, y + 1.67, false);
      block(f, 'limestone', x, z, 0.27, 0.27, y + 1.67, y + 2.06);
    }
  }
  for (const [i, { x, z, h, y }] of garden.trees.entries()) {
    const n = tier >= 3 ? 9 : tier === 2 ? 7 : 5;
    prism(f, 'bark', { outline: polygonDisk(x, z, 0.33, 0.38, n) }, y - 0.28, y + h * 0.63, false);
    const scale = h * 0.32,
      profile =
        tier === 1
          ? [
              [-0.26, 0.21],
              [0.07, 1],
              [0.38, 0.025],
            ]
          : [
              [-0.31, 0.19],
              [-0.12, 0.83],
              [0.05, 1],
              [0.22, 0.79],
              [0.36, 0.25],
              [0.41, 0.025],
            ];
    const centers =
      tier >= 3
        ? [
            [x - 0.49, z - 0.31, 1, 0],
            [x + 0.84, z + 0.51, 0.7, -0.105],
            [x - 0.42, z + 0.91, 0.54, -0.18],
          ]
        : [[x, z, 1, 0]];
    for (const [u, v, s, drop] of centers)
      for (let j = 1; j < profile.length; j++) {
        const [height, a] = profile[j - 1],
          [height2, b] = profile[j];
        const r = polygonDisk(u, v, scale * a * 2 * s, scale * a * 1.68 * s, n, i * 0.17),
          R = polygonDisk(u + 0.29, v, scale * b * 2 * s, scale * b * 1.68 * s, n, i * 0.17);
        skin(
          f,
          'leaf',
          r,
          R,
          y + h * (0.69 + drop + height * s),
          y + h * (0.69 + drop + height2 * s),
        );
        if (j === 1) cap(f, 'leaf', [r], y + h * (0.69 + drop + height * s), down);
        if (j === profile.length - 1) cap(f, 'leaf', [R], y + h * (0.69 + drop + height2 * s));
      }
  }
}

const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
export function buildReinaSofiaLevel(out, level) {
  const tier = tiers[level],
    f = faceWriter(out);
  historic(f, tier);
  entrance(f, tier);
  for (const L of layout.lifts) lift(f, tier, L);
  extension(f, tier);
  for (const r of layout.plaza.paving) f('granite', r, up);
  greenery(f, out, tier);
}
export const buildReinaSofiaSkyline = (out) => buildReinaSofiaLevel(out, 'skyline');
export const buildReinaSofiaDistrict = (out) => buildReinaSofiaLevel(out, 'district');
export const buildReinaSofiaStreet = (out) => buildReinaSofiaLevel(out, 'street');
export const buildReinaSofiaCloseup = (out) => buildReinaSofiaLevel(out, 'closeup');
