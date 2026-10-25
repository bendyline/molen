/** 'temple_of_hibis': Hibis's roofed body, open varied-capital portico and pictured entrance gate. */

import { openingBuilder, openingReveals, prepareOpening } from './authored-wall-openings.mjs';
import { denderaCavetto } from './dendera-temple-model.mjs';
import { box, loft, prism, rect } from './khmer-structure-geometry.mjs';

export function buildHibisTemple(emit, detail, r, sample) {
  const frame = (b) => {
    const c = Math.cos(b.angle),
      s = Math.sin(b.angle),
      point = ([x, y, z]) => [
        b.center[0] + x * c - z * s,
        b.floorY + y,
        b.center[1] + x * s + z * c,
      ];
    return {
      f: (role, ps, n) =>
        emit(role, ps.map(point), [n[0] * c - n[2] * s, n[1], n[0] * s + n[2] * c]),
      ground: (x, z) => {
        const p = point([x, 0, z]);
        return sample(p[0], p[2]) - b.floorY;
      },
    };
  };
  const cornice = (f, x, y, z, w, d, h = 1.2) => {
    if (detail === 0) {
      box(f, 'stone', x, y, z, w + 0.7, h, d + 0.7);
      return;
    }
    const scale = h / 1.2;
    denderaCavetto(
      (role, ps, n) =>
        f(
          role,
          ps.map(([u, v, t]) => [u, y + (v - y) * scale, t]),
          [n[0], n[1] / scale, n[2]],
        ),
      x,
      y,
      z,
      w,
      d,
      Math.min(detail, 2),
    );
  };
  const floor = (f, grade, p, top = 0) => {
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        low = Math.min(grade(...a), grade(...b), top - 0.2) - 0.4;
      f(
        'wall',
        [
          [a[0], low, a[1]],
          [b[0], low, b[1]],
          [b[0], top - 0.13, b[1]],
          [a[0], top - 0.13, a[1]],
        ],
        [b[1] - a[1], 0, a[0] - b[0]],
      );
    }
    prism(f, 'stone', { outline: p }, top - 0.13, top);
  };
  const steps = (f, grade, x, z, width, run, axis) => {
    const end = grade(x + axis[0] * run, z + axis[1] * run) + 0.05,
      n = detail === 0 ? 2 : 5,
      low =
        Math.min(
          -0.4,
          ...Array.from({ length: 8 }, (_, i) =>
            grade(x + (axis[0] * run * i) / 7, z + (axis[1] * run * i) / 7),
          ),
        ) - 0.4;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n,
        y = end + ((0 - end) * (n - i - 1)) / n;
      box(
        f,
        'stone',
        x + axis[0] * run * t,
        low,
        z + axis[1] * run * t,
        axis[0] ? run / n : width,
        Math.max(0.05, y - low),
        axis[0] ? width : run / n,
      );
    }
  };
  const wall = (f, x, z, w, d, low, high, apertures = []) => {
    const holes = apertures.map((h) => prepareOpening(h, 0, detail)),
      adapter = { addTriangle: (role, _ref, p, n) => f(role, p, n) },
      clipped = openingBuilder(adapter, holes),
      cut = (role, p, n) => {
        for (let i = 1; i < p.length - 1; i++)
          clipped.addTriangle(role, 'palette:#ffffff', [p[0], p[i], p[i + 1]], n);
      };
    if (detail < 2) box(cut, 'wall', x, low, z, w, high - low, d);
    else {
      box(cut, 'rubble', x, low, z, w > 0.95 ? w : w - 0.08, high - low, d > 0.95 ? d : d - 0.08);
      const alongX = w > d,
        length = alongX ? w : d,
        rows = Math.ceil((high - low) / 0.8),
        cols = Math.ceil(length / 2.4);
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++)
          box(
            cut,
            'wall',
            x + (alongX ? -length / 2 + ((i + 0.5) * length) / cols : 0),
            low + (j * (high - low)) / rows + 0.008,
            z + (!alongX ? -length / 2 + ((i + 0.5) * length) / cols : 0),
            alongX ? length / cols - 0.015 : w,
            (high - low) / rows - 0.016,
            alongX ? d : length / cols - 0.015,
          );
    }
    openingReveals(
      { addTriangle: (_role, _ref, p, n) => f('wall', p, n) },
      rect(x, z, w, d).outline,
      () => low,
      () => high,
      holes,
      undefined,
    );
  };
  const wingedDisc = (f, x, y, z) => {
    const n = detail >= 3 ? 16 : 8;
    f(
      'stone',
      Array.from({ length: n }, (_, i) => [
        x,
        y + Math.sin((i * Math.PI * 2) / n) * 0.23,
        z + Math.cos((i * Math.PI * 2) / n) * 0.3,
      ]),
      [1, 0, 0],
    );
    for (const hand of [-1, 1])
      f(
        'stone',
        [
          [x, y + 0.08, z],
          [x, y + 0.17, z + hand * 1.1],
          [x, y - 0.02, z + hand * 0.98],
          [x, y - 0.13, z + hand * 0.32],
        ],
        [1, 0, 0],
      );
  };
  const gateway = (f, grade, x, width, depth, height, standalone) => {
    if (standalone) floor(f, grade, rect(x, 0, depth + 0.3, width + 0.4).outline);
    const opening = 2.2,
      sill = 0,
      head = height - 1.2,
      clear = head - 0.65;
    wall(f, x, -(width + opening) / 4, depth, (width - opening) / 2, sill, head);
    wall(f, x, (width + opening) / 4, depth, (width - opening) / 2, sill, head);
    wall(f, x, 0, depth, opening, clear, head);
    cornice(f, x, head, 0, depth, width, 1.2);
    if (detail >= 1) {
      for (const hand of [-1, 1])
        box(f, 'stone', x + depth / 2 + 0.045, 0, hand * (opening / 2 + 0.1), 0.12, clear, 0.18);
      box(f, 'stone', x + depth / 2 + 0.05, clear, 0, 0.14, 0.14, opening + 0.38);
    }
    if (detail >= 2) wingedDisc(f, x + depth / 2 + 0.08, head + 0.43, 0);
  };
  const { f, ground } = frame(r.temple);
  floor(f, ground, rect(1.5, 0, 41, 20).outline);
  const door = {
      center: [8, 0],
      axis: [0, 1],
      width: 2.5,
      bottom: 0,
      height: 3.9,
      depth: 2,
      shape: 'rectangle',
    },
    sideDoor = {
      center: [-5, 8.5],
      axis: [1, 0],
      width: 1.8,
      bottom: 0,
      height: 3.4,
      depth: 2,
      shape: 'rectangle',
    },
    sockets = [];
  if (detail >= 2)
    for (const hand of [-1, 1])
      for (let i = 0; i < 10; i++) {
        const x = -15.4 + i * 2.2;
        if (hand === 1 && Math.abs(x + 5) < 1.5) continue;
        sockets.push({
          center: [x, hand * 8.05],
          axis: [1, 0],
          width: 0.28,
          bottom: 2.7,
          height: 0.34,
          depth: 1.5,
          shape: 'rectangle',
        });
      }
  wall(
    f,
    -5,
    -8.05,
    26,
    0.9,
    0,
    5.8,
    sockets.filter((h) => h.center[1] < 0),
  );
  wall(f, -5, 8.05, 26, 0.9, 0, 5.8, [sideDoor, ...sockets.filter((h) => h.center[1] > 0)]);
  wall(f, -17.55, 0, 0.9, 15.2, 0, 5.8);
  wall(f, 7.55, 0, 0.9, 15.2, 0, 5.8, [door]);
  for (const h of sockets)
    box(
      f,
      'inset',
      h.center[0],
      h.bottom,
      h.center[1] + (h.center[1] > 0 ? -0.28 : 0.28),
      0.27,
      0.33,
      0.035,
    );
  cornice(f, -5, 5.8, 0, 26, 17, 1.1);
  // Roofless exterior portico. Four stations per exposed edge; hidden room inventory is not restored.
  const columns = [];
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++)
      if (i === 0 || i === 3 || j === 0 || j === 3)
        columns.push({ x: 8.8 + i * 3.6, z: -7 + (j * 14) / 3, type: (i + j) % 3 });
  for (const q of columns) {
    if (detail === 0) {
      box(f, 'column', q.x, 0, q.z, 1.0, 5.9, 1.0);
      box(f, 'column', q.x, 5.9, q.z, 1.55, 1.2, 1.55);
      continue;
    }
    const n = detail === 1 ? 8 : detail === 2 ? 16 : 24,
      ring = (w) =>
        Array.from({ length: n }, (_, i) => {
          const a = (i * Math.PI * 2) / n,
            rad = (w / 2) * (q.type === 1 && detail >= 2 ? 1 + 0.035 * Math.cos(a * 8) : 1);
          return [Math.cos(a) * rad, Math.sin(a) * rad];
        });
    loft(
      f,
      'column',
      q.x,
      q.z,
      [
        [0, 1.35],
        [0.14, 1.35],
        [0.2, 1.1],
        [5.7, 0.94],
      ],
      false,
      ring,
    );
    const cap =
      q.type === 0
        ? [
            [5.7, 0.94],
            [6.1, 1.18],
            [6.7, 1.75],
            [6.9, 1.65],
          ]
        : q.type === 1
          ? [
              [5.7, 0.94],
              [6.0, 1.28],
              [6.5, 1.45],
              [6.85, 1.05],
              [6.9, 1.05],
            ]
          : [
              [5.7, 0.94],
              [6.25, 1.2],
              [6.9, 1.78],
            ];
    loft(f, 'column', q.x, q.z, cap, false, ring);
    box(f, 'stone', q.x, 6.9, q.z, 1.42, 0.2, 1.42);
    if (detail >= 2) {
      loft(
        f,
        'stone',
        q.x,
        q.z,
        [
          [5.45, 1.01],
          [5.56, 1.01],
          [5.61, 0.95],
        ],
        false,
        ring,
      );
      const leaves = detail === 3 ? 12 : 8;
      for (let k = 0; k < leaves; k++) {
        const a = (k * Math.PI * 2) / leaves,
          co = Math.cos(a),
          si = Math.sin(a),
          at = (u, y, rad) => [q.x + co * rad - si * u, y, q.z + si * rad + co * u],
          radius = q.type === 1 ? 0.72 : 0.9;
        f(
          'column',
          [
            at(-0.12, 5.95, 0.55),
            at(0.12, 5.95, 0.55),
            at(0.18, 6.68, radius),
            at(0, 6.87, radius + 0.035),
            at(-0.18, 6.68, radius),
          ],
          [co, 0.2, si],
        );
      }
    }
  }
  for (const x of [8.8, 19.6]) cornice(f, x, 7.1, 0, 1.12, 15.2, 1.45);
  for (const z of [-7, 7]) cornice(f, 14.2, 7.1, z, 11.92, 1.12, 1.45);
  // Screens have actual openings at the main front and the pictured south-side entrance.
  wall(f, 14.2, -7.85, 13.2, 0.65, 0, 2.8);
  wall(f, 10.9, 7.85, 6.6, 0.65, 0, 2.8);
  wall(f, 18.9, 7.85, 3.8, 0.65, 0, 2.8);
  wall(f, 20.45, -4.925, 0.65, 6.85, 0, 2.8);
  wall(f, 20.45, 4.925, 0.65, 6.85, 0, 2.8);
  gateway(f, ground, 21, 5.2, 1.15, 6.1, false);
  if (detail >= 2) {
    // Quiet original geometric bands imply carved masonry without copied signs or narratives.
    for (const hand of [-1, 1])
      for (const y of [1.0, 4.3, 5.1]) box(f, 'stone', -5, y, hand * 8.53, 25, 0.045, 0.045);
    if (detail === 3)
      for (let i = 0; i < 12; i++) {
        const x = -16 + i * 1.9;
        for (const hand of [-1, 1]) {
          if (hand === 1 && Math.abs(x + 5) < 1.5) continue;
          box(f, 'stone', x, 3.35, hand * 8.54, 0.05, 0.55, 0.035);
          box(f, 'stone', x + 0.15, 3.82, hand * 8.54, 0.34, 0.045, 0.035);
        }
      }
  }
  steps(f, ground, 22, 0, 14.8, 2.1, [1, 0]);
  steps(f, ground, 14.2, 10, 10.2, 1.8, [0, 1]);
  const { f: gf, ground: gg } = frame(r.gate);
  gateway(gf, gg, 0, 5.2, 2.8, 6.3, true);
  steps(gf, gg, 1.55, 0, 2.8, 1.1, [1, 0]);
}
