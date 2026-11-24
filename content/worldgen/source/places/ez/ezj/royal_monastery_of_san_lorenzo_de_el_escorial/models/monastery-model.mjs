import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  granite: { slot: 'wall', graph: 'stone_granite', roughness: 0.95 },
  trim: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.93 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.86 },
  stoneRoof: { slot: 'roof', graph: 'stone_limestone_weathered', roughness: 0.89 },
  metal: { slot: 'trim', graph: 'metal_copper', roughness: 0.8 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', metallic: 0.01, roughness: 0.72 },
  wood: { slot: 'door', graph: 'wood_shou_sugi_ban', roughness: 0.91 },
};

const granite = rgb('c3b6a3');
const dressed = rgb('cabbab');
const basement = rgb('ac9e8a');
const slate = rgb('656872');
const stoneRoof = rgb('b9aa94');
const glazing = rgb('494b48');
const door = rgb('544837');
const copper = rgb('7a7771');
const a = (site.planAngleDegrees * Math.PI) / 180,
  cos = Math.cos(a),
  sin = Math.sin(a);
const world = (x, y, z) => [x * cos - z * sin, y, x * sin + z * cos];
const cw = [
  [-1, -1],
  [-1, 1],
  [1, 1],
  [1, -1],
];
const foundation = -9.4;

function area(p) {
  return p.reduce((s, [x, z], i) => {
    const [a, b] = p[(i + 1) % p.length];
    return s + x * b - z * a;
  }, 0);
}
function ring(p) {
  return area(p) < 0 ? p : p.toReversed();
}
function center(p) {
  return [0, 1].map((i) => p.reduce((s, q) => s + q[i] / p.length, 0));
}
function simplify(p) {
  if (p.length <= 4) return p;
  const clean = p.filter((b, i) => {
    const a = p[(i + p.length - 1) % p.length],
      c = p[(i + 1) % p.length];
    const x = c[0] - a[0],
      z = c[1] - a[1],
      l = Math.hypot(x, z);
    if (l < 0.15) return true;
    const t = ((b[0] - a[0]) * x + (b[1] - a[1]) * z) / (l * l);
    return t <= 0 || t >= 1 || Math.abs(x * (b[1] - a[1]) - z * (b[0] - a[0])) / l > 0.092;
  });
  return clean.length >= 3 ? clean : p;
}
function face(out, slot, points, color, target) {
  points = points.map((p) => p.map(Math.fround));
  if (target && normalFor(...points).reduce((s, v, i) => s + v * target[i], 0) < 0)
    points = points.toReversed();
  for (let i = 1; i + 1 < points.length; i++) {
    const t = [points[0], points[i], points[i + 1]],
      n = normalFor(...t);
    if (Math.hypot(...n) > 0.9) out.addTriangle(slot, '', t, n, [], color);
  }
}
function capTriangles(p, holes = []) {
  const builder = new MeshBufferBuilder();
  if (
    !builder.addCap(
      'foundation',
      'palette:#ffffff',
      p,
      holes,
      () => 0,
      [0, 1, 0],
      (v) => v,
      granite,
    )
  )
    throw Error('Invalid El Escorial outline');
  const m = builder.finalize();
  const result = [];
  for (let i = 0; i < m.indices.length; i += 3)
    result.push(
      [0, 1, 2].map((j) => [
        m.positions[m.indices[i + j] * 3],
        m.positions[m.indices[i + j] * 3 + 2],
      ]),
    );
  return result;
}
function roofFace(out, slot, p, height, color) {
  face(
    out,
    slot,
    p.map(([x, z]) => world(x, height(x, z), z)),
    color,
    [0, 1, 0],
  );
}
function wall(out, p, lo, hi, color = granite) {
  for (let i = 0; i < p.length; i++) {
    const [x, z] = p[i],
      [a, b] = p[(i + 1) % p.length];
    if (Math.hypot(a - x, b - z) < 0.001) continue;
    face(
      out,
      'granite',
      [world(x, lo, z), world(a, lo, b), world(a, hi(a, b), b), world(x, hi(x, z), z)],
      color,
    );
  }
}
function box(out, slot, x, y, z, width, height, depth, color) {
  loft(
    out,
    slot,
    [y, y + height].map((h) =>
      cw.map(([u, v]) => world(x + (u * width) / 2, h, z + (v * depth) / 2)),
    ),
    color,
  );
}
function clip(p, plane) {
  const result = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      lo = plane(...a),
      hi = plane(...b);
    if (lo <= 1e-6) result.push(a);
    if ((lo < -1e-6 && hi > 1e-6) || (lo > 1e-6 && hi < -1e-6))
      result.push(a.map((x, i) => x + ((b[i] - x) * lo) / (lo - hi)));
  }
  return result;
}

function roofPlanes(part, p, roofBase) {
  let direction;
  if (part.direction !== undefined) {
    const d = ((part.direction - site.planAngleDegrees) * Math.PI) / 180;
    direction = [Math.sin(d), -Math.cos(d)];
  } else {
    const xs = p.map((q) => q[0]),
      zs = p.map((q) => q[1]);
    const longX = Math.max(...xs) - Math.min(...xs) >= Math.max(...zs) - Math.min(...zs);
    direction = longX !== (part.orientation === 'across') ? [0, 1] : [1, 0];
  }
  const ranges = (u, v) => p.map(([x, z]) => x * u + z * v);
  const cross = ranges(...direction),
    lo = Math.min(...cross),
    hi = Math.max(...cross),
    span = hi - lo;
  const depth = (x, z) => x * direction[0] + z * direction[1];
  const h = part.rise;
  if (part.shape === 'skillion') return [(x, z) => roofBase + (h * (hi - depth(x, z))) / span];
  const fields = [
    (x, z) => roofBase + (2 * h * (depth(x, z) - lo)) / span,
    (x, z) => roofBase + (2 * h * (hi - depth(x, z))) / span,
  ];
  if (part.shape === 'pyramidal' || part.shape === 'hipped') {
    const [u, v] = direction;
    const q = ranges(v, -u),
      a = Math.min(...q),
      b = Math.max(...q),
      length = b - a;
    const hs = part.shape === 'hipped' ? Math.min(length * 0.47, span / 2) : length / 2;
    fields.push(
      (x, z) => roofBase + (h * (x * v - z * u - a)) / hs,
      (x, z) => roofBase + (h * (b - x * v + z * u)) / hs,
    );
  }
  return fields;
}

function dome(out, p, eave, height, detail) {
  const [x, z] = center(p);
  const compact =
    detail < 2 ? p.filter((_, i) => i % Math.max(1, Math.ceil(p.length / 12)) === 0) : p;
  const rows =
    detail === 0
      ? [0, 0.56, 1]
      : detail === 1
        ? [0, 0.43, 0.72, 1]
        : [0, 0.095, 0.21, 0.34, 0.46, 0.58, 0.7, 0.82, 0.91, 0.97, 1];
  const outline = rows.map((t) => {
    const radius = Math.max(0.025, Math.cos(t * Math.PI * 0.5));
    const y = eave + (height - eave) * Math.sin(t * Math.PI * 0.5);
    return compact.map(([u, v]) => world(x + (u - x) * radius, y, z + (v - z) * radius));
  });
  loft(out, 'stoneRoof', outline, stoneRoof, { cap: false });
  const top = outline.at(-1);
  face(out, 'stoneRoof', top, stoneRoof, [0, 1, 0]);
}

function component(out, part, detail) {
  const p = ring(detail === 1 ? simplify(part.outline) : part.outline),
    y0 = part.base > 0 ? part.base : foundation;
  const roofBase = Math.max(part.height - part.rise, part.base + 0.025);
  const slot =
    part.roofMaterial === 'metal'
      ? 'metal'
      : part.roofMaterial === 'stone' || part.shape === 'dome'
        ? 'stoneRoof'
        : 'slate';
  const color = slot === 'metal' ? copper : slot === 'stoneRoof' ? stoneRoof : slate;
  if (part.shape === 'dome') {
    wall(out, p, y0, () => roofBase);
    dome(out, p, roofBase, part.height, detail);
    return;
  }
  if (!part.rise || part.shape === 'flat') {
    wall(out, p, y0, () => part.height);
    for (const t of capTriangles(p)) roofFace(out, 'stoneRoof', t, () => part.height, stoneRoof);
    return;
  }
  const fields = roofPlanes(part, p, roofBase),
    height = (x, z) => Math.min(...fields.map((f) => f(x, z)));
  // Partition both the slate and the wall tops at the mapped roof creases.
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      ts = [0, 1];
    for (let j = 0; j < fields.length; j++)
      for (let k = j + 1; k < fields.length; k++) {
        const v = fields[j](...a) - fields[k](...a),
          w = fields[j](...b) - fields[k](...b);
        if (v * w < -1e-6) ts.push(v / (v - w));
      }
    ts.sort((a, b) => a - b);
    for (let j = 1; j < ts.length; j++) {
      if (ts[j] - ts[j - 1] < 1e-6) continue;
      const at = (t) => a.map((v, i) => v + (b[i] - v) * t);
      const [x, z] = at(ts[j - 1]),
        [u, v] = at(ts[j]);
      face(
        out,
        'granite',
        [world(x, y0, z), world(u, y0, v), world(u, height(u, v), v), world(x, height(x, z), z)],
        granite,
      );
    }
  }
  for (const t of capTriangles(p)) {
    for (const f of fields) {
      let polygon = t;
      for (const g of fields) if (g !== f) polygon = clip(polygon, (x, z) => f(x, z) - g(x, z));
      if (polygon.length >= 3) roofFace(out, slot, polygon, f, color);
    }
  }
}

function skyline(out) {
  const outline = ring(site.plan),
    holes = site.courtyards.map((c) => c.outline);
  wall(out, outline, foundation, () => 17.6);
  for (const court of holes) wall(out, ring(court).toReversed(), 0.12, () => 17.6);
  for (const t of capTriangles(outline, holes)) roofFace(out, 'slate', t, () => 17.6, slate);
  const tall = new Set([
    ...site.towers,
    885736202,
    885736195,
    885736190,
    885736183,
    885736205,
    885736199,
    885736191,
    885736184,
    885736166,
    885736165,
    885736164,
    885736163,
    887512419,
    887512422,
    887512418,
    887512421,
    663968140,
    878714721,
  ]);
  for (const part of site.parts) {
    if (!tall.has(part.id)) continue;
    const p = part.outline,
      [x, z] = center(p);
    const r = (i) => Math.max(...p.map((q) => q[i])) - Math.min(...p.map((q) => q[i]));
    const w = r(0) / 2,
      d = r(1) / 2;
    const low = part.base || (part.id === site.pavilion ? 0.05 : 17.6),
      y = part.height - part.rise;
    const body = cw.map(([u, v]) => [x + u * w, z + v * d]);
    if (y > low + 0.02) wall(out, body, low, () => y);
    if (part.shape === 'dome') {
      const round = Array.from({ length: 8 }, (_, i) => [
        x + w * Math.cos((-i * Math.PI) / 4),
        z + d * Math.sin((-i * Math.PI) / 4),
      ]);
      dome(out, round, y, part.height, 0);
    } else if (part.rise) {
      for (let i = 0; i < body.length; i++) {
        const [u, v] = body[i],
          [p, q] = body[(i + 1) % body.length];
        face(
          out,
          part.roofMaterial === 'stone' ? 'stoneRoof' : 'slate',
          [world(u, y, v), world(p, y, q), world(x, part.height, z)],
          slate,
          [0, 1, 0],
        );
      }
    }
  }
}

function windows(out, detail) {
  const done = new Set();
  for (const part of site.parts) {
    if (part.base > 1 || part.levels < 2) continue;
    const p = ring(part.outline),
      eaves = part.height - part.rise;
    for (let j = 0; j < p.length; j++) {
      const [x, z] = p[j],
        [b, c] = p[(j + 1) % p.length];
      const dx = b - x,
        dz = c - z,
        length = Math.hypot(dx, dz);
      const u = dx / length,
        v = dz / length,
        mx = (x + b) / 2,
        mz = (z + c) / 2;
      const outer =
        (mx < -132.4 && v > 0.92) ||
        (mz > 102 && u > 0.92) ||
        (mz < -101.8 && u < -0.92) ||
        (mx > 25.5 && mx < 28.4 && v < -0.92);
      const basilica = part.id === site.basilica;
      if (length < 4.25 || (!outer && !basilica)) continue;
      const key = [p[j], p[(j + 1) % p.length]]
        .map((q) => q.map((a) => a.toFixed(2)).join(','))
        .sort()
        .join('/');
      if (done.has(key)) continue;
      done.add(key);
      const n = Math.floor(length / (detail === 2 ? 4.45 : 3.1));
      const at = (t, y, offset = 0.021) => world(x + t * u - v * offset, y, z + t * v + u * offset);
      for (let i = 0; i < n; i++) {
        const t = ((i + 0.5) * length) / n;
        const cx = x + t * u,
          cz = z + t * v;
        if (cx < -132 && Math.abs(cz) < 9.4) continue;
        const top = Math.min(eaves, 18) - 0.72;
        for (const y of [2.05, 5.35, 8.28, 11.11, 14.17].filter((y) => y + 1.5 < top)) {
          const w = y < 2.1 ? 0.57 : 0.47;
          face(
            out,
            'glass',
            [at(t - w, y), at(t + w, y), at(t + w, y + 1.39), at(t - w, y + 1.39)],
            glazing,
          );
          if (detail >= 3) {
            face(
              out,
              'trim',
              [
                at(t - w - 0.17, y - 0.15, 0.059),
                at(t + w + 0.17, y - 0.15, 0.059),
                at(t + w + 0.17, y + 0.02, 0.059),
                at(t - w - 0.17, y + 0.02, 0.059),
              ],
              dressed,
            );
          }
          if (detail === 4 && outer && y < 8.3)
            face(
              out,
              'trim',
              [
                at(t - 0.029, y, 0.066),
                at(t + 0.029, y, 0.066),
                at(t + 0.029, y + 1.38, 0.066),
                at(t - 0.029, y + 1.38, 0.066),
              ],
              basement,
            );
        }
        if (detail >= 3 && outer && part.shape === 'skillion' && part.rise > 2.7 && i % 2 === 0) {
          const height = roofPlanes(part, p, eaves)[0];
          const slope = (sub, offset) => height(x + sub * u - v * offset, z + sub * v + u * offset);
          const j = t - 0.57,
            k = t + 0.57,
            front = -1.12,
            back = -3.04;
          const lo = slope(t, front) - 0.09,
            mid = lo + 1.27,
            top = mid + 0.51;
          const rear = Math.max(top - 0.28, slope(t, back) + 0.15);
          face(
            out,
            'trim',
            [
              at(j, lo, front),
              at(k, lo, front),
              at(k, mid, front),
              at(t, top, front),
              at(j, mid, front),
            ],
            dressed,
          );
          face(
            out,
            'glass',
            [
              at(t - 0.24, lo + 0.22, front + 0.021),
              at(t + 0.24, lo + 0.22, front + 0.021),
              at(t + 0.24, mid - 0.18, front + 0.021),
              at(t - 0.24, mid - 0.18, front + 0.021),
            ],
            glazing,
          );
          for (const edge of [j, k])
            face(
              out,
              'slate',
              [
                at(edge, mid, front),
                at(t, top, front),
                at(t, rear, back),
                at(edge, rear - 0.5, back),
              ],
              slate,
              [0, 1, 0],
            );
        }
      }
    }
  }
}

function entrances(out, detail) {
  for (const { x, z, w, h, chapel } of [
    { x: -136.61, z: 0.22, w: 19.7, h: 28.6, chapel: false },
    { x: -58.09, z: 0.31, w: 27.7, h: 26.65, chapel: true },
  ]) {
    const at = (u, y, d = 0.02) => world(x - d, y, z + u);
    blockFacade(-w / 2, w / 2, 0, 0.56, 0.34);
    blockFacade(-w / 2, w / 2, h * 0.487, h * 0.548, 0.55);
    blockFacade(-w * 0.451, w * 0.451, h * 0.817, h * 0.848, 0.49);
    face(
      out,
      'trim',
      [at(-w * 0.456, h * 0.846, 0.64), at(w * 0.456, h * 0.846, 0.64), at(0, h * 0.99, 0.64)],
      dressed,
    );
    const r = chapel ? 1.64 : 1.18,
      y = chapel ? 6.01 : 4.59;
    face(
      out,
      'wood',
      [at(-r, 0.12, 0.045), at(r, 0.12, 0.045), at(r, y, 0.045), at(-r, y, 0.045)],
      door,
    );
    for (const u of [-0.38, -0.16, 0.16, 0.38]) {
      const cx = x - 0.44,
        cz = z + w * u;
      for (const [lo, hi] of [
        [0.55, h * 0.491],
        [h * 0.558, h * 0.82],
      ]) {
        const count = detail >= 3 ? 10 : 5;
        const profile = [
          [lo, 0.48],
          [lo + 0.34, 0.48],
          [lo + 0.54, 0.36],
          [hi - 0.36, 0.32],
          [hi, 0.473],
        ];
        loft(
          out,
          'trim',
          profile.map(([y, r]) =>
            Array.from({ length: count }, (_, i) => {
              const a = (-2 * Math.PI * i) / count;
              return world(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r);
            }),
          ),
          dressed,
        );
      }
    }
    if (detail >= 3) {
      for (const u of chapel ? [-0.3, -0.15, 0, 0.15, 0.3] : [0]) {
        const dx = w * u,
          k = chapel ? 0.49 : 0.45;
        const lo = h * 0.646,
          hi = h * 0.779;
        face(
          out,
          'glass',
          [at(dx - k, lo, 0.06), at(dx + k, lo, 0.06), at(dx + k, hi, 0.06), at(dx - k, hi, 0.06)],
          basement,
        );
        box(out, 'trim', x - 0.059, lo, z + dx, 0.23, hi - lo, 0.53, dressed);
      }
    }
    function blockFacade(u, v, a, b, d) {
      box(out, 'trim', x - d * 0.42, a, z + (u + v) / 2, d, b - a, v - u, dressed);
    }
  }
}

function templePavilion(out, part, detail) {
  const p = ring(part.outline);
  for (const t of capTriangles(p)) roofFace(out, 'trim', t, () => 0.29, dressed);
  wall(out, p, 0.038, () => 0.29, dressed);
  wall(out, p, 4.77, () => 6.04, dressed);
  for (const t of capTriangles(p)) roofFace(out, 'trim', t, () => 6.04, dressed);
  for (const [x, z] of p) {
    const sides = detail >= 3 ? 10 : 6;
    loft(
      out,
      'trim',
      [0.27, 0.49, 0.69, 4.49, 4.78].map((y, j) =>
        Array.from({ length: sides }, (_, i) => {
          const a = (-i * Math.PI * 2) / sides,
            r = [0.42, 0.42, 0.3, 0.265, 0.46][j];
          return world(x + r * Math.cos(a), y, z + r * Math.sin(a));
        }),
      ),
      dressed,
    );
  }
  const [x, z] = center(p);
  box(out, 'granite', x, 0.26, z, 3.82, 4.63, 3.82, granite);
}

function courtArcades(out, detail) {
  if (detail < 2) return;
  for (const court of site.courtyards) {
    const ringIn = ring(court.outline).toReversed();
    const prime = [885736214, 885736215].includes(court.id);
    if (!prime && detail === 2) continue;
    for (let i = 0; i < ringIn.length; i++) {
      const [x, z] = ringIn[i],
        [a, b] = ringIn[(i + 1) % ringIn.length];
      const dx = a - x,
        dz = b - z,
        length = Math.hypot(dx, dz),
        u = dx / length,
        v = dz / length;
      const n = Math.round(length / (prime ? 4.24 : 4.36));
      if (n < 1) continue;
      const at = (t, y, o = 0.065) => world(x + t * u - v * o, y, z + t * v + u * o);
      for (let j = 0; j < n; j++) {
        const t = ((j + 0.5) * length) / n,
          r = prime ? 1.37 : 0.75;
        for (const row of prime ? [0, 5] : [0.6, 4.35]) {
          const base = row + 0.45,
            shoulder = base + (prime ? 2.63 : 1.65);
          const arch = Array.from({ length: 7 }, (_, k) => {
            const th = (k * Math.PI) / 6;
            return at(t + r * Math.cos(th), shoulder + r * 0.82 * Math.sin(th));
          });
          face(out, 'glass', [at(t - r, base), at(t + r, base), ...arch], glazing);
          if (prime && detail >= 3)
            face(
              out,
              'trim',
              [
                at(t - r - 0.14, base - 0.18, 0.13),
                at(t + r + 0.14, base - 0.18, 0.13),
                at(t + r + 0.14, base, 0.13),
                at(t - r - 0.14, base, 0.13),
              ],
              dressed,
            );
        }
      }
    }
  }
}

function courtPavilion(out, detail) {
  if (detail < 2) return;
  const part = site.parts.find((p) => p.id === site.pavilion);
  const [x, z] = center(part.outline);
  for (const u of [-1, 1])
    for (const v of [-1, 1]) {
      const color = rgb('687a45');
      const a = x + u * 11.3,
        b = z + v * 11.3;
      box(out, 'glass', a, 0.049, b, 11.94, 0.27, 11.94, color);
      for (const t of [-1, 1]) {
        box(out, 'glass', a + t * 5.5, 0.31, b, 0.76, 0.28, 11.96, color);
        box(out, 'glass', a, 0.31, b + t * 5.5, 11.96, 0.28, 0.76, color);
      }
    }
  for (const [u, v] of [
    [-6.5, 0],
    [6.5, 0],
    [0, -6.5],
    [0, 6.5],
  ]) {
    box(out, 'trim', x + u, 0.06, z + v, 3.8, 0.42, 3.8, dressed);
    for (const h of [-1, 1]) {
      box(out, 'granite', x + u + h * 1.83, 0.43, z + v, 0.26, 0.23, 3.86, basement);
      box(out, 'granite', x + u, 0.43, z + v + h * 1.83, 3.86, 0.23, 0.26, basement);
    }
    // A small still-water swatch describes the reflecting basin while leaving its geometry open.
    const q = rgb('859e94');
    face(
      out,
      'glass',
      cw.map(([a, b]) => world(x + u + a * 1.67, 0.5, z + v + b * 1.67)),
      q,
      [0, 1, 0],
    );
  }
}

function baseAndCourts(out) {
  const outer = ring(site.plan);
  for (const t of capTriangles(outer)) roofFace(out, 'trim', t, () => -0.08, basement);
  for (const court of site.courtyards) {
    const garden = court.id === 885736214;
    for (const t of capTriangles(court.outline))
      roofFace(out, 'trim', t, () => 0.045, garden ? dressed : granite);
  }
}

function build(out, detail) {
  baseAndCourts(out);
  if (detail === 0) {
    skyline(out);
    return;
  }
  for (const part of site.parts) {
    if (detail === 1 && part.height < 30 && Math.abs(area(part.outline)) < 29) continue;
    if (part.id === site.pavilion && detail >= 2) templePavilion(out, part, detail);
    else component(out, part, detail);
  }
  if (detail >= 2) {
    windows(out, detail);
    entrances(out, detail);
    courtArcades(out, detail);
  }
  courtPavilion(out, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = (out) => build(out, 4);
