/** Baphuon's restored terraces, roofless galleries, western Buddha and east causeway. */
import earcut from 'earcut';

function box(f, role, x, y, z, w, h, d) {
  const p = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([u, v]) => [x + (u * w) / 2, y, z + (v * d) / 2]);
  const q = p.map(([x, y, z]) => [x, y + h, z]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    f(role, [p[i], p[j], q[j], q[i]], [p[j][2] - p[i][2], 0, p[i][0] - p[j][0]]);
  }
  f(role, p, [0, -1, 0]);
  f(role, q, [0, 1, 0]);
}
function prism(f, role, p, bottom, top) {
  const area = p.reduce((n, a, i) => {
      const b = p[(i + 1) % p.length];
      return n + a[0] * b[1] - b[0] * a[1];
    }, 0),
    sign = Math.sign(area);
  const at = (q, h) => [q[0], typeof h === 'function' ? h(...q) : h, q[1]],
    tris = earcut(p.flat());
  for (let i = 0; i < tris.length; i += 3) {
    const t = tris.slice(i, i + 3).map((j) => p[j]);
    f(
      role,
      t.map((q) => at(q, top)),
      [0, 1, 0],
    );
    f(
      role,
      t.map((q) => at(q, bottom)),
      [0, -1, 0],
    );
  }
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    f(
      role,
      [at(a, bottom), at(b, bottom), at(b, top), at(a, top)],
      [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
    );
  }
}
function rotate(f, angle, x = 0, z = 0) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return (role, ps, n) =>
    f(
      role,
      ps.map(([u, y, v]) => [x + c * u - s * v, y, z + s * u + c * v]),
      [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
    );
}
function ramp(f, x, y, z, run, rise, width) {
  const a = [
      [x, y, z - width / 2],
      [x + run, y, z - width / 2],
      [x, y + rise, z - width / 2],
    ],
    b = a.map((p) => [p[0], p[1], p[2] + width]);
  f('stone', a, [0, 0, -1]);
  f('stone', b, [0, 0, 1]);
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    f('stone', [a[i], a[j], b[j], b[i]], [a[j][1] - a[i][1], a[i][0] - a[j][0], 0]);
  }
}
function stairs(f, x, y, z, run, rise, width, detail) {
  if (!detail) {
    ramp(f, x, y, z, run, rise, width);
    return;
  }
  const n = [0, 5, 18, 28][detail];
  for (let i = 0; i < n; i++)
    box(f, 'stone', x + (run * (i + 0.5)) / n, y, z, run / n + 0.015, rise * (1 - i / n), width);
  for (const side of [-1, 1]) ramp(f, x, y, z + side * (width / 2 + 0.42), run, rise + 0.3, 0.64);
}
function gate(f, x, y, z, scale, detail, angle = 0) {
  const g = rotate(f, angle, x, z),
    w = 5 * scale,
    h = 4 * scale;
  // Open doorway remains open; broad lintel and stepped corbel crown survive roof loss.
  for (const s of [-1, 1]) box(g, 'trim', 0, y, s * w * 0.37, 3.6 * scale, h, w * 0.26);
  box(g, 'stone', 0, y + h, 0, 4.2 * scale, 0.65 * scale, w * 1.13);
  for (let i = 0; i < (detail >= 2 ? 4 : 2); i++)
    box(
      g,
      'stone',
      0,
      y + h + (0.65 + i * 0.72) * scale,
      0,
      (3.8 - i * 0.6) * scale,
      0.73 * scale,
      (4.7 - i * 0.9) * scale,
    );
  if (detail >= 2) {
    for (const s of [-1, 1])
      box(
        g,
        'trim',
        2 * scale,
        y + 0.25 * scale,
        s * 1.28 * scale,
        0.33 * scale,
        h - 0.3 * scale,
        0.34 * scale,
      );
    box(g, 'trim', 2.2 * scale, y + h + 0.2 * scale, 0, 0.3 * scale, 0.6 * scale, 3.1 * scale);
  }
}
function gallery(f, w, d, y, detail) {
  // Open lintel galleries rather than a reconstructed complete stone roof.
  const spacing = [100, 12, 4.8, 3.7][detail];
  for (let side = 0; side < 4; side++) {
    const g = rotate(f, (side * Math.PI) / 2),
      length = side % 2 ? d : w,
      offset = (side % 2 ? w : d) / 2;
    box(g, 'stone', 0, y + 0.03, offset, length, 0.32, 2.7);
    box(g, 'stone', 0, y + 3.2, offset, length, 0.55, 2.9);
    const n = detail ? Math.ceil(length / spacing) : 1;
    for (let i = 0; i <= n; i++) {
      const x = -length / 2 + (i / n) * length;
      if (Math.abs(x) < 4 && detail) continue;
      box(g, 'trim', x, y + 0.3, offset, 0.65, 2.9, 0.7);
      if (detail >= 2) {
        box(g, 'stone', x, y + 0.3, offset, 0.95, 0.23, 1.1);
        box(g, 'stone', x, y + 2.95, offset, 0.95, 0.25, 1.1);
      }
    }
    if (detail >= 2)
      for (let i = 0; i < Math.ceil(length / 5); i++) {
        if (i % 4 === 2) continue;
        const x = -length / 2 + 2.5 + i * 5;
        box(g, 'stone', x, y + 0.32, offset - 1.2, 4.5, 0.65 + (i % 3) * 0.21, 0.6);
      }
  }
}
function inside(p, poly) {
  let yes = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
function relief(f, detail) {
  // West conversion is a wall-sized block relief supported by the lower terrace.
  box(f, 'stone', -30.2, 8.2, 0, 9.2, 6.2, 62);
  if (detail === 1) {
    box(f, 'buddha', -35.2, 9.1, 5, 1.4, 3.9, 47);
    box(f, 'buddha', -35.4, 10.2, -23, 2.6, 7.2, 9);
  } else {
    const dz = detail === 2 ? 2.8 : 1.8,
      dy = detail === 2 ? 1.7 : 1.1;
    for (let z = -28; z < 30; z += dz)
      for (let y = 8.3; y < 17.8; y += dy) {
        const head = z < -18,
          headT = (z + 23) / 5.5;
        const center = head ? 13.8 : 11.4 - 0.8 * ((z + 18) / 48),
          height = head
            ? 3.9 * Math.sqrt(Math.max(0, 1 - headT * headT))
            : 2.3 - 0.6 * ((z + 18) / 48);
        if (Math.abs(y + dy / 2 - center) > height) continue;
        const fullness = Math.max(0, 1 - ((y + dy / 2 - center) / Math.max(height, 0.2)) ** 2),
          depth = 0.65 + (head ? 1.7 : 1.15) * fullness + 0.12 * Math.sin(z * 2.3 + y * 1.9);
        box(f, 'buddha', -34.6 - depth / 2, y, z, depth, dy - 0.035, dz - 0.04);
      }
  }
  // Softly closed eyes, broad nose, mouth and resting hand within the coarse stone face.
  for (const z of [-25.1, -21.0]) {
    box(f, 'stone', -37.12, 14.7, z, 0.25, 0.18, 2.5);
    box(f, 'buddha', -37.05, 15.0, z, 0.4, 0.42, 2.7);
  }
  box(f, 'buddha', -37.2, 13.0, -23.1, 1.2, 1.8, 1.1);
  box(f, 'stone', -37.15, 11.85, -23.1, 0.25, 0.16, 2.6);
  box(f, 'buddha', -35.7, 8.4, -20, 2.5, 1.0, 13);
}

export function buildBaphuonTemple(f, detail, r, sample) {
  const g = rotate(f, r.architecturalAngleRadians, ...r.templeCenter),
    grade = r.baseY;
  if (detail === 0) {
    let y = -8;
    for (const t of r.terraces) {
      box(g, 'stone', 0, y, 0, t.width, t.top - y, t.depth);
      y = t.top;
    }
    for (const [w, d, y] of [
      [65, 61, 8.2],
      [32, 30, 27.2],
    ])
      for (let side = 0; side < 4; side++) {
        const h = rotate(g, (side * Math.PI) / 2);
        box(h, 'stone', 0, y, (side % 2 ? w : d) / 2, side % 2 ? d : w, 3.5, 1.1);
      }
    box(g, 'trim', 19, 27.2, 0, 4, 5.8, 4.7);
    box(g, 'stone', 19, 33, 0, 2.5, 1.1, 2.8);
    box(g, 'buddha', -35.4, 10.5, 0, 1.6, 3.2, 54);
    box(g, 'buddha', -36.2, 11.5, -22.5, 2.5, 6.1, 9);
    for (const id of [
      35185157705646, 35185157705647, 35185157705648, 35185157705649, 35185157705637,
    ]) {
      const p = r.controls.find((c) => c.id === id).polygons[0].outline;
      const y = Math.max(...p.map((p) => sample(...p))) + 0.15;
      prism(f, 'stone', p, Math.min(...p.map((p) => sample(...p))) - 0.5, y + 0.6);
      const x = p.reduce((s, q) => s + q[0] / p.length, 0),
        z = p.reduce((s, q) => s + q[1] / p.length, 0);
      box(f, 'trim', x, y + 0.6, z, 3.6, id === 35185157705637 ? 8 : 6, 5);
    }
    buildCauseway(f, detail, r, sample);
    return;
  }
  let bottom = grade;
  for (const [i, t] of r.terraces.entries()) {
    box(
      g,
      'stone',
      0,
      i ? bottom - 0.12 : -8,
      0,
      t.width,
      t.top - (i ? bottom - 0.12 : -8),
      t.depth,
    );
    const bands = detail ? [2, 4, 7, 9][detail] : 0;
    for (let k = 0; k < bands; k++) {
      const y = bottom + ((t.top - bottom) * (k + 0.4)) / bands;
      box(g, 'trim', 0, y, 0, t.width + 0.42, 0.22, t.depth + 0.42);
    }
    bottom = t.top;
  }
  for (let side = 0; side < (detail ? 4 : 1); side++) {
    const h = rotate(g, (side * Math.PI) / 2),
      ys = [grade, ...r.terraces.map((t) => t.top)],
      edges = side % 2 ? [34, 26.5, 18.5] : [36, 28, 19.5];
    box(h, 'stone', edges[0] + 4, -12, 0, 12, grade + 12, 7.4);
    for (let i = 0; i < 3; i++)
      stairs(h, edges[i] - 2, ys[i], 0, i ? 9 : 12, ys[i + 1] - ys[i], i ? 5.5 : 7.4, detail);
  }
  gallery(g, 65, 61, 8.2, detail);
  gallery(g, 32, 30, 27.2, detail);
  gate(g, 19, 27.2, 0, 0.86, detail);
  if (detail) {
    gate(g, 33, 8.2, 0, 0.85, detail);
    gate(g, 26, 17.2, 0, 0.75, detail);
    gate(g, 0, 27.2, -17, 0.7, detail, -Math.PI / 2);
  }
  box(g, 'stone', 0, 27.2, 0, 14, 0.8, 14); // Open summit: lost central tower is not invented.
  relief(g, detail);
  for (const id of [35185157705646, 35185157705647, 35185157705648, 35185157705649]) {
    const p = r.controls.find((c) => c.id === id).polygons[0].outline,
      x = p.reduce((s, q) => s + q[0] / p.length, 0),
      z = p.reduce((s, q) => s + q[1] / p.length, 0),
      y = Math.max(...p.map((p) => sample(...p))) + 0.12;
    prism(f, 'stone', p, Math.min(...p.map((p) => sample(...p))) - 0.5, y + 0.65);
    gate(f, x, y + 0.65, z, 0.85, detail);
    if (detail >= 2) {
      for (const s of [-1, 1]) box(f, 'stone', x, y + 0.65, z + s * 3.8, 4, 2.7, 2.2);
    }
  }
  const entrance = r.controls.find((c) => c.id === 35185157705637).polygons[0].outline,
    ey = Math.max(...entrance.map((p) => sample(...p))) + 0.15;
  prism(f, 'stone', entrance, Math.min(...entrance.map((p) => sample(...p))) - 0.6, ey + 0.6);
  gate(f, 61, ey + 0.6, -1, 1.25, detail);
  for (const z of [-11, 10]) gate(f, 61, ey + 0.6, z, 0.7, detail);
  buildCauseway(f, detail, r, sample);
}

function buildCauseway(f, detail, r, sample) {
  const causeway = r.controls.find((c) => c.id === r.causewayId).polygons;
  // Deck follows exactly the pinned map polygon. Interior strips carry terrain-dependent elevations.
  const deck = (x, z) => sample(x, z) + 1.8;
  for (const { outline: p } of causeway) {
    // Split triangles into small patches so the noisy native terrain does not pierce a long chord.
    const tris = earcut(p.flat());
    const emitPatch = (a, b, c, depth = 0) => {
      const lengths = [
          [a, b],
          [b, c],
          [c, a],
        ].map(([u, v]) => Math.hypot(u[0] - v[0], u[1] - v[1])),
        index = lengths.indexOf(Math.max(...lengths));
      if (lengths[index] > [40, 30, 13, 8][detail] && depth < 13) {
        const ps = [a, b, c],
          u = ps[index],
          v = ps[(index + 1) % 3],
          w = ps[(index + 2) % 3],
          m = u.map((x, i) => (x + v[i]) / 2);
        emitPatch(u, m, w, depth + 1);
        emitPatch(m, v, w, depth + 1);
        return;
      }
      for (const offset of [0, -0.38])
        f(
          'stone',
          [a, b, c].map((q) => [q[0], deck(...q) + offset, q[1]]),
          [0, offset ? -1 : 1, 0],
        );
    };
    for (let i = 0; i < tris.length; i += 3) emitPatch(...tris.slice(i, i + 3).map((j) => p[j]));
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        n = Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) / [40, 30, 13, 8][detail]);
      const area = p.reduce((s, a, i) => {
          const b = p[(i + 1) % p.length];
          return s + a[0] * b[1] - b[0] * a[1];
        }, 0),
        sign = Math.sign(area);
      for (let j = 0; j < n; j++) {
        const u = a.map((x, k) => x + ((b[k] - x) * j) / n),
          v = a.map((x, k) => x + ((b[k] - x) * (j + 1)) / n);
        f(
          'stone',
          [
            [u[0], deck(...u) - 0.38, u[1]],
            [v[0], deck(...v) - 0.38, v[1]],
            [v[0], deck(...v), v[1]],
            [u[0], deck(...u), u[1]],
          ],
          [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
        );
      }
    }
    if (detail === 0) {
      for (let x = 90; x < 305; x += 40) {
        const z = -3 - (x - 90) * 0.017,
          y = sample(x, z) - 0.5;
        box(f, 'stone', x, y, z, 1.2, 2.3, 1.2);
      }
      continue;
    }
    const xs = p.map((p) => p[0]),
      zs = p.map((p) => p[1]),
      dx = [30, 26, 7, 5.8][detail],
      dz = detail ? 1.55 : 3;
    for (let x = Math.min(...xs) + 1.2; x < Math.max(...xs) - 0.6; x += dx)
      for (let z = Math.min(...zs) + 0.7; z < Math.max(...zs) - 0.4; z += dz)
        if (inside([x, z], p)) {
          const y = sample(x, z) - 0.5;
          box(f, 'stone', x, y, z, 0.6, deck(x, z) - 0.3 - y, 0.6);
          if (detail >= 2) box(f, 'trim', x, deck(x, z) - 0.65, z, 0.88, 0.3, 0.88);
        }
  }
}
