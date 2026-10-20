/** Researched iron pier, three-shelter angled head and attached sandstone tollhouse. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';

const traceryControls = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/gc/gcj/clevedon_pier/tracery-construction-controls.json',
      import.meta.url,
    ),
  ),
);

import earcut from 'earcut';
import { beam, normalFor, sphere } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  tau = 2 * Math.PI,
  iron = rgb('39453e'),
  green = rgb('538d7d'),
  wood = rgb('989587'),
  stone = rgb('8b826c'),
  trim = rgb('b2a68b'),
  cream = rgb('e0e1cd'),
  glass = rgb('a5b3aa'),
  amber = rgb('958c61'),
  roof = rgb('738584'),
  brass = rgb('a69764'),
  concrete = rgb('8e938a'),
  neck = 280.2093,
  shore = -neck / 2,
  head = neck / 2,
  deck = 0.55;
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
function roofFace(o, p, c = roof) {
  let n = normalFor(p[0], p[1], p[2]);
  if (n[1] < 0) {
    p = [...p].reverse();
    n = normalFor(p[0], p[1], p[2]);
  }
  if (p.length === 3)
    o.addTriangle(
      'roof',
      ref,
      p,
      n,
      p.map((p) => [p[0], p[2]]),
      c,
    );
  else quad(o, 'roof', p, n, c);
}
function slim(o, d, s, a, b, w, c) {
  if (d > 2) beam(o, s, a, b, w, w, c);
  else {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      dx = ((-(b[1] - a[1]) / len) * w) / 2,
      dy = (((b[0] - a[0]) / len) * w) / 2;
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
function lamp(o, d, x, z, y = deck) {
  if (!d) {
    B(o, 'iron', x, y, z, 0.16, 2.65, 0.16, iron);
    B(o, 'light', x, y + 2.65, z, 0.4, 0.45, 0.4, cream);
    return;
  }
  B(o, 'iron', x, y, z, 0.32, 0.18, 0.32, iron);
  B(o, 'iron', x, y + 0.18, z, 0.21, 2.25, 0.21, iron);
  for (const yy of d === 3 ? [0.26, 1.0, 2.25, 2.4] : [0.26, 2.4])
    B(o, 'iron', x, y + yy, z, 0.29, 0.08, 0.29, iron);
  sphere(o, 'light', [x, y + 2.8, z], [0.35, 0.36, 0.35], cream, d === 3 ? 12 : 6, d === 3 ? 8 : 3);
  if (d === 3) {
    for (let i = 0; i < 12; i++) {
      const a = (i * tau) / (d === 3 ? 12 : 6);
      beam(
        o,
        'iron',
        [x + 0.33 * Math.cos(a), y + 2.78, z + 0.33 * Math.sin(a)],
        [x + 0.15 * Math.cos(a), y + 2.48, z + 0.15 * Math.sin(a)],
        0.025,
        0.025,
        iron,
      );
    }
    beam(o, 'iron', [x, y + 3.2, z], [x, y + 2.8, z], 0.035, 0.035, iron);
  }
}
function pagodaRoof(o, d, w, dep, y, height, top = false) {
  const stages = d === 0 ? 2 : d === 1 ? 3 : d === 2 ? 5 : 8,
    profiles = [];
  for (let i = 0; i <= stages; i++) {
    const t = i / stages,
      k = 1 - (top ? 0.65 : 0.78) * t;
    profiles.push({
      w: w * k,
      z: dep * k,
      y: y + height * (top ? 0.65 : 1) * (0.12 * t + 0.88 * t * t),
    });
  }
  for (let j = 0; j < stages; j++) {
    const a = profiles[j],
      b = profiles[j + 1];
    for (const s of [-1, 1]) {
      roofFace(o, [
        [(s * a.w) / 2, a.y, -a.z / 2],
        [(s * a.w) / 2, a.y, a.z / 2],
        [(s * b.w) / 2, b.y, b.z / 2],
        [(s * b.w) / 2, b.y, -b.z / 2],
      ]);
      roofFace(o, [
        [-a.w / 2, a.y, (s * a.z) / 2],
        [a.w / 2, a.y, (s * a.z) / 2],
        [b.w / 2, b.y, (s * b.z) / 2],
        [-b.w / 2, b.y, (s * b.z) / 2],
      ]);
    }
  }
  const p = profiles.at(-1);
  for (const s of [-1, 1]) {
    roofFace(o, [
      [(s * p.w) / 2, p.y, -p.z / 2],
      [(s * p.w) / 2, p.y, p.z / 2],
      [0, p.y + height * (top ? 0.5 : 0.38), 0],
    ]);
    roofFace(o, [
      [-p.w / 2, p.y, (s * p.z) / 2],
      [p.w / 2, p.y, (s * p.z) / 2],
      [0, p.y + height * (top ? 0.5 : 0.38), 0],
    ]);
  }
  if (d > 1) {
    for (const s of [-1, 1]) {
      B(o, 'green', (s * w) / 2, y - 0.08, 0, 0.09, 0.13, dep, green);
      B(o, 'green', 0, y - 0.08, (s * dep) / 2, w, 0.13, 0.09, green);
    }
    if (d === 3)
      for (const u of [-0.36, 0, 0.36])
        for (const s of [-1, 1])
          for (let j = 0; j < stages; j++) {
            const a = profiles[j],
              b = profiles[j + 1];
            beam(
              o,
              'green',
              [u * a.w, a.y + 0.015, (s * a.z) / 2],
              [u * b.w, b.y + 0.015, (s * b.z) / 2],
              0.035,
              0.025,
              green,
            );
          }
  }
  if (top) {
    const crownY = y + height * 0.65,
      cw = w * 0.39;
    for (const s of [-1, 1]) {
      B(o, 'green', (s * cw) / 2, crownY, 0, 0.055, 0.1, cw, green);
      B(o, 'green', 0, crownY, (s * cw) / 2, cw, 0.1, 0.055, green);
    }
    if (d === 3) constructedCrest(o, cw, crownY);
    B(o, 'iron', 0, y + height * 1.15, 0, 0.05, 1, 0.05, iron);
    if (d > 0) {
      beam(
        o,
        'iron',
        [-0.55, y + height * 1.15 + 0.65, 0],
        [0.55, y + height * 1.15 + 0.65, 0],
        0.025,
        0.025,
        iron,
      );
      panel(o, 'green', 0.15, y + height * 1.15 + 0.73, 0, 0.55, 0.18, green);
    }
  }
}
function rail(o, d, length, y, z, c = green) {
  for (const yy of [y, y + 0.95]) B(o, 'green', 0, yy, z, length, 0.065, 0.07, c);
  if (d) {
    const step = d === 1 ? 3 : d === 2 ? 1.6 : 0.4;
    for (let x = -length / 2; x < length / 2 + 0.01; x += step)
      B(o, 'green', x, y, z, 0.04, 0.95, 0.04, c);
    if (d === 3)
      for (let x = -length / 2 + 0.2; x < length / 2 - 0.1; x += 0.4) {
        slim(o, 0, 'green', [x - 0.16, y + 0.12, z], [x + 0.16, y + 0.75, z], 0.025, c);
        slim(o, 0, 'green', [x - 0.16, y + 0.75, z], [x + 0.16, y + 0.12, z], 0.025, c);
      }
  }
}
function shelter(o, d, w, dep, raised = false) {
  const y = raised ? deck + 3.2 : deck,
    wallH = raised ? 3.1 : 2.7;
  for (const x of [-w / 2, w / 2])
    for (const z of [-dep / 2, dep / 2])
      B(o, 'green', x, y, z, d === 0 ? 0.18 : 0.12, wallH, 0.12, green);
  for (const s of [-1, 1]) {
    for (const yy of [y + 0.7, y + wallH - 0.55, y + wallH]) {
      B(o, 'green', 0, yy, (s * dep) / 2, w, 0.08, 0.08, green);
      B(o, 'green', (s * w) / 2, yy, 0, 0.08, 0.08, dep, green);
    }
    panel(
      facing(o, s < 0 ? Math.PI : 0, 0, (s * dep) / 2 - 0.04 * s),
      'glass',
      0,
      y + 0.12,
      0,
      w - 0.22,
      wallH - 0.2,
      glass,
    );
    panel(
      facing(o, s < 0 ? Math.PI / 2 : -Math.PI / 2, (s * w) / 2 - 0.04 * s, 0),
      'glass',
      0,
      y + 0.12,
      0,
      dep - 0.22,
      wallH - 0.2,
      glass,
    );
  }
  if (d) {
    for (const s of [-1, 1])
      for (let x = -w / 2 + 0.6; x < w / 2; x += 0.65)
        B(o, 'green', x, y, (s * dep) / 2, 0.045, wallH, 0.065, green);
    for (const s of [-1, 1])
      for (let z = -dep / 2 + 0.6; z < dep / 2; z += 0.65)
        B(o, 'green', (s * w) / 2, y, z, 0.065, wallH, 0.045, green);
    if (raised)
      for (const s of [-1, 1])
        panel(
          facing(o, s < 0 ? Math.PI : 0, 0, (s * dep) / 2 + 0.007 * s),
          'amber',
          0,
          y + wallH - 0.55,
          0,
          w - 0.2,
          0.46,
          amber,
        );
  }
  pagodaRoof(o, d, w + 1.6, dep + 1.6, y + wallH + 0.12, raised ? 3 : 1.15, raised);
}
function headDeck(o) {
  B(o, 'wood', 0, deck - 0.25, -1.7, 28.5, 0.25, 11.0, wood);
  for (const [a, b] of [
    [-14.25, -3.3],
    [-1.5, 1.5],
    [3.3, 14.25],
  ])
    B(o, 'wood', (a + b) / 2, deck - 0.25, 5.5, b - a, 0.25, 3.4, wood);
}

// Closed metal tracery with actual counters; all curves are original medium-fi interpretations.
function traceryQuad(o, slot, p, col) {
  const n = normalFor(...p),
    u = p[1].map((v, i) => v - p[0][i]),
    len = Math.hypot(...u);
  for (let i = 0; i < 3; i++) u[i] /= len;
  const v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]],
    uv = p.map((q) => {
      const d = q.map((v, i) => v - p[0][i]);
      return [d.reduce((s, x, i) => s + x * u[i], 0), d.reduce((s, x, i) => s + x * v[i], 0)];
    });
  o.addQuad(slot, ref, p, n, uv, col);
}
function traceryPlate(o, slot, outer, holes, back, front, col) {
  const area = (r) =>
      r.reduce(
        (a, p, i) => a + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1],
        0,
      ),
    orient = (r, positive) => (area(r) > 0 === positive ? r : [...r].reverse()),
    rings = [orient(outer, true), ...holes.map((r) => orient(r, false))],
    flat = rings.flat(),
    holeStarts = [];
  let start = rings[0].length;
  for (let j = 1; j < rings.length; j++) {
    holeStarts.push(start);
    start += rings[j].length;
  }
  for (const ring of rings)
    for (let i = 0; i < ring.length; i++) {
      const j = (i + 1) % ring.length;
      traceryQuad(
        o,
        slot,
        [
          [...ring[i], back],
          [...ring[j], back],
          [...ring[j], front],
          [...ring[i], front],
        ],
        col,
      );
    }
  const ids = earcut(flat.flat(), holeStarts);
  for (const [z, reverse] of [
    [back, true],
    [front, false],
  ])
    for (let i = 0; i < ids.length; i += 3) {
      let p = ids.slice(i, i + 3).map((j) => [...flat[j], z]);
      if (normalFor(...p)[2] < 0 !== reverse) p = [...p].reverse();
      o.addTriangle(
        slot,
        ref,
        p,
        normalFor(...p),
        p.map((p) => [p[0], p[1]]),
        col,
      );
    }
}
function traceryRod(o, slot, a, b, w, back, front, col) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    len = Math.hypot(dx, dy),
    u = [(dy * w) / (2 * len), (-dx * w) / (2 * len)];
  traceryPlate(
    o,
    slot,
    [
      [a[0] + u[0], a[1] + u[1]],
      [b[0] + u[0], b[1] + u[1]],
      [b[0] - u[0], b[1] - u[1]],
      [a[0] - u[0], a[1] - u[1]],
    ],
    [],
    back,
    front,
    col,
  );
}
function constructedBalconyRail(o, length) {
  const c = traceryControls.balcony,
    n = Math.round(length / c.modulePitch),
    pitch = length / n,
    y = c.y,
    back = -c.plateDepth / 2,
    front = c.plateDepth / 2;
  for (const yy of [y, y + c.height]) B(o, 'balconyIron', 0, yy, 0, length, 0.065, 0.07, cream);
  for (let i = 0; i <= n; i++)
    B(
      o,
      'balconyIron',
      -length / 2 + i * pitch,
      c.postBottom,
      0,
      0.04,
      y + c.height - c.postBottom,
      0.04,
      cream,
    );
  for (let i = 0; i < n; i++) {
    const x = -length / 2 + (i + 0.5) * pitch,
      shape = (delta) =>
        Array.from({ length: c.profileSegments }, (_, j) => {
          const a = (j * tau) / c.profileSegments,
            r = c.flowerBaseRadius + c.flowerLobeRadius * Math.cos(4 * a) + delta;
          return [x + r * Math.cos(a), y + 0.48 + c.flowerYAspect * r * Math.sin(a)];
        });
    traceryPlate(
      o,
      'balconyIron',
      shape(c.flowerRimHalfWidth),
      [shape(-c.flowerRimHalfWidth)],
      back,
      front,
      cream,
    );
    for (const points of [
      [
        [x, y + 0.738],
        [x + 0.08, y + 0.84],
        [x, y + c.height],
      ],
      [
        [x, y + 0.222],
        [x - 0.08, y + 0.11],
        [x, y],
      ],
    ])
      for (let j = 1; j < points.length; j++)
        traceryRod(o, 'balconyIron', points[j - 1], points[j], 0.025, back, front, cream);
  }
}
function constructedBalcony(o) {
  const c = traceryControls.balcony;
  for (const sign of [-1, 1]) {
    constructedBalconyRail(facing(o, sign < 0 ? Math.PI : 0, 0, sign * c.frontZ), c.frontLength);
    constructedBalconyRail(facing(o, (sign * Math.PI) / 2, sign * c.sideX, 0), c.sideLength);
  }
}
function constructedCrest(o, width, y) {
  const c = traceryControls.crest,
    pitch = width / c.modulesPerSide,
    w = pitch - 0.004;
  for (let face = 0; face < 4; face++) {
    const q = facing(
      o,
      (face * tau) / 4,
      (Math.sin((face * tau) / 4) * width) / 2,
      (Math.cos((face * tau) / 4) * width) / 2,
    );
    for (let i = 0; i < c.modulesPerSide; i++) {
      const x = -width / 2 + (i + 0.5) * pitch,
        outer = [
          [-w / 2, 0.08],
          [w / 2, 0.08],
          [w / 2, 0.25],
          [w * 0.36, 0.25],
          [w * 0.36, 0.34],
          [w * 0.23, 0.34],
          [w * 0.23, 0.28],
          [w * 0.11, 0.28],
          [w * 0.11, 0.38],
          [-w * 0.11, 0.38],
          [-w * 0.11, 0.28],
          [-w * 0.23, 0.28],
          [-w * 0.23, 0.34],
          [-w * 0.36, 0.34],
          [-w * 0.36, 0.25],
          [-w / 2, 0.25],
        ].map(([u, v]) => [x + u, y + v]),
        hole = Array.from({ length: c.holeSegments }, (_, j) => [
          x + c.holeRadius * Math.cos((j * tau) / c.holeSegments),
          y + c.holeHeight + c.holeRadius * Math.sin((j * tau) / c.holeSegments),
        ]);
      traceryPlate(q, 'crestIron', outer, [hole], -c.depth / 2, c.depth / 2, green);
    }
  }
}
function constructedSpanTies(o, d) {
  const c = traceryControls.ties,
    shore = -c.neckLength / 2,
    inset = (y) =>
      (c.rakedLegFootOffset * (y - c.rakedLegTopY)) / (c.rakedLegFootY - c.rakedLegTopY),
    cross = (a, b) => a[0] * b[1] - a[1] * b[0];
  for (let k = 0; k < c.spans; k++)
    for (const z of c.planes) {
      const start = shore + (k * c.neckLength) / c.spans,
        end = shore + ((k + 1) * c.neckLength) / c.spans,
        A = [k === 0 ? shore + c.shoreXOffset : start + inset(c.top), c.top],
        B = [end - inset(c.bottom), c.bottom],
        C = [
          k === 0 ? shore + c.shoreXOffset : start + inset(c.bottom),
          k === 0 ? c.shoreBottom : c.bottom,
        ],
        D = [end - inset(c.top), c.top];
      for (const [a, b] of [
        [A, B],
        [C, D],
      ]) {
        if (d === 3) beam(o, 'spanTies', [...a, z], [...b, z], c.width, c.width, iron);
        else {
          const dx = b[0] - a[0],
            dy = b[1] - a[1],
            len = Math.hypot(dx, dy),
            u = [(-dy * c.width) / (2 * len), (dx * c.width) / (2 * len)],
            p = [
              [a[0] + u[0], a[1] + u[1], z],
              [b[0] + u[0], b[1] + u[1], z],
              [b[0] - u[0], b[1] - u[1], z],
              [a[0] - u[0], a[1] - u[1], z],
            ];
          quad(o, 'spanTies', p, normalFor(...p), iron);
        }
      }
      if (d === 3) {
        const r = B.map((v, i) => v - A[i]),
          s = D.map((v, i) => v - C[i]),
          t =
            cross(
              C.map((v, i) => v - A[i]),
              s,
            ) / cross(r, s),
          x = A[0] + t * r[0],
          y = A[1] + t * r[1],
          outer = Array.from({ length: 8 }, (_, i) => [
            x + c.nodeRadius * Math.cos((i * tau) / 8),
            y + c.nodeRadius * Math.sin((i * tau) / 8),
          ]);
        traceryPlate(o, 'spanNodes', outer, [], z - c.nodeDepth / 2, z + c.nodeDepth / 2, iron);
      }
    }
}
function headModel(o, d) {
  const q = facing(o, 1.216, 147.8305, 1.45),
    w = 28.5,
    dep = 14.4; // Own head width is oblique to the neck; not an axis-aligned enlarged deck.
  headDeck(q);
  for (const z of [-dep / 2, dep / 2]) {
    B(q, 'green', 0, deck - 0.7, z, w, 0.45, 0.18, green);
    rail(q, d, w, deck + 0.05, z);
  }
  for (const x of [-w / 2, w / 2]) rail(facing(q, Math.PI / 2, x, 0), d, dep, deck + 0.05, 0);
  for (let i = 0; i < 6; i++)
    for (const z of [-5.7, -1.9, 1.9, 5.7]) {
      const x = -12.6 + i * 5.04;
      if (d === 0) {
        if (z === -5.7 || z === 5.7) B(q, 'iron', x, -25, z, 0.38, 25, 0.38, iron);
      } else {
        B(q, 'iron', x, -25, z, 0.34, 25, 0.34, iron);
        if (d === 3) for (const y of [-13, -6, -0.8]) B(q, 'iron', x, y, z, 0.5, 0.22, 0.5, iron);
      }
    }
  if (d > 0)
    for (const z of [-5.7, 5.7])
      for (let i = 0; i < 5; i++) {
        const x = -12.6 + i * 5.04;
        for (const y of [-20, -13, -6]) {
          slim(q, d, 'iron', [x, y, z], [x + 5.04, y + 6, z], 0.075, iron);
          slim(q, d, 'iron', [x + 5.04, y, z], [x, y + 6, z], 0.075, iron);
        }
      }
  for (const x of [-12.15, 12.15]) shelter(facing(q, 0, x, -2.25), d, 2.8, 8.5, false);
  // Raised central room, open ground level and actual landing stair void.
  const central = facing(q, 0, 0, 0);
  B(central, 'wood', 0, deck + 3.05, 0, 10.4, 0.2, 9.8, wood);
  for (const x of [-5.1, 5.1])
    for (const z of [-4.8, 4.8]) B(central, 'green', x, deck, z, 0.16, 3.05, 0.16, green);
  shelter(central, d, 7.0, 8.1, true);
  if (d === 3) constructedBalcony(central);
  else {
    for (const z of [-4.85, 4.85]) rail(central, d, 10.3, deck + 3.3, z, cream);
    for (const x of [-5.15, 5.15])
      rail(facing(central, Math.PI / 2, x, 0), d, 9.7, deck + 3.3, 0, cream);
  }
  if (d > 0) {
    const q0 = facing(central, 0, 0, -4.55);
    for (let i = 0; i < 16; i++)
      B(q0, 'wood', -3.5 + i * 0.44, deck + i * 0.2, 0, 0.45, 0.18, 0.8, wood);
    for (const z of [-0.5, 0.5]) {
      beam(q0, 'green', [-3.6, deck + 1, z], [3.5, deck + 4.2, z], 0.05, 0.05, cream);
      for (let i = 0; i <= 8; i++)
        B(q0, 'green', -3.5 + i * 0.88, deck + i * 0.4, z, 0.035, 1, 0.035, cream);
    }
    if (d > 1) {
      const badge = facing(central, Math.PI, 0, -4.94);
      const shield = (ww, hh, col, z) =>
        badge.addConvexPolygon(
          'light',
          ref,
          [
            [-ww / 2, deck + 4.5, z],
            [ww / 2, deck + 4.5, z],
            [ww * 0.4, deck + 4.5 - hh * 0.65, z],
            [0, deck + 4.5 - hh, z],
            [-ww * 0.4, deck + 4.5 - hh * 0.65, z],
          ],
          [0, 0, 1],
          (p) => [p[0], p[1]],
          col,
        );
      shield(1.1, 1.2, cream, 0.01);
      shield(0.8, 0.9, brass, 0.025);
      for (const x of [-0.23, 0, 0.23])
        panel(badge, 'iron', x, deck + 3.95, 0.04, 0.11, 0.15, iron);
    }
  }
  // Paired stairs to a lower concrete landing. Hole under central room remains open.
  for (const sign of [-1, 1]) {
    const stair = facing(q, 0, sign * 2.4, 3.8);
    for (let i = 0; i < (d > 0 ? 20 : 4); i++) {
      const n = d > 0 ? 20 : 4;
      B(
        stair,
        'concrete',
        0,
        deck - ((i + 1) * 6) / n,
        ((i + 0.5) * 6) / n,
        1.6,
        0.16,
        6 / n + 0.03,
        concrete,
      );
    }
    beam(
      stair,
      'green',
      [0.85, deck + 1, 0],
      [0.85, deck - 5, 7],
      d > 0 ? 0.07 : 0.12,
      0.07,
      green,
    );
  }
  const land = facing(q, 0, 0, 9.1);
  B(land, 'concrete', 0, deck - 6.3, 0, 28.4, 0.35, 4.6, concrete);
  for (const x of [-13, -8, -3, 3, 8, 13])
    for (const z of [-1.7, 1.7]) B(land, 'concrete', x, -25, z, 0.5, 19.2, 0.5, concrete);
  for (const x of [-13.6, -9, -4.5, 0, 4.5, 9, 13.6])
    B(land, 'wood', x, -25, 2.7, 0.35, 24.3, 0.35, wood);
  if (d) {
    rail(land, d, 28.4, deck - 5.9, 2.1);
    for (const x of [-13.9, 13.9]) rail(facing(land, Math.PI / 2, x, 0), d, 4.5, deck - 5.9, 0);
  }
  if (d > 1) for (const x of [-13.4, -7, 0, 7, 13.4]) for (const z of [-6.3, 6.3]) lamp(q, d, x, z);
}
function windowWall(o, d, w, y0, y1, holes) {
  const xs = [-w / 2, w / 2, ...holes.flatMap((h) => [h.x - h.w / 2, h.x + h.w / 2])].sort(
      (a, b) => a - b,
    ),
    ys = [y0, y1, ...holes.flatMap((h) => [h.y, h.y + h.h])].sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < ys.length - 1; j++) {
      const x = (xs[i] + xs[i + 1]) / 2,
        y = (ys[j] + ys[j + 1]) / 2,
        ww = xs[i + 1] - xs[i],
        hh = ys[j + 1] - ys[j];
      if (
        ww < 0.001 ||
        hh < 0.001 ||
        holes.some((h) => Math.abs(x - h.x) < h.w / 2 - 0.0001 && y > h.y && y < h.y + h.h)
      )
        continue;
      if (d < 0) panel(o, 'stone', x, ys[j], 0, ww, hh, stone);
      else B(o, 'stone', x, ys[j], -0.22, ww, hh, 0.44, stone);
    }
  for (const h of holes) {
    panel(o, 'glass', h.x, h.y, -0.34, h.w, h.h, glass);
    if (d >= 0)
      for (const s of [-1, 1]) {
        B(o, 'trim', h.x + s * (h.w / 2 + 0.06), h.y - 0.08, 0.03, 0.12, h.h + 0.16, 0.16, trim);
        B(o, 'trim', h.x, h.y + (s > 0 ? h.h : 0), 0.03, h.w + 0.2, 0.11, 0.17, trim);
      }
    if (d > 0) {
      B(o, 'light', h.x, h.y, -0.15, 0.055, h.h, 0.08, cream);
      B(o, 'light', h.x, h.y + h.h * 0.58, -0.15, h.w, 0.06, 0.08, cream);
    }
  }
}
function tollhouse(o, d) {
  const cx = -140.3,
    cz = -5.7,
    q = facing(o, 0, cx, cz),
    ring = [
      [-5.45, -1.0],
      [-4.8, -2.15],
      [3.8, -2.15],
      [5.8, -1],
      [5.7, 1.8],
      [4.0, 2.4],
      [-4.9, 2.4],
      [-5.7, 0.9],
    ];
  polygon(q, 'stone', ring, -5, 0.65, stone);
  for (const sign of [-1, 1]) {
    const v = facing(q, sign < 0 ? Math.PI : 0, 0, sign > 0 ? 2.4 : -2.15);
    windowWall(v, d, 9.4, 0.65, 7.3, [
      {
        x: sign > 0 ? -3.1 : -2.7,
        y: sign > 0 ? 0.65 : 1.35,
        w: sign > 0 ? 0.95 : 1.25,
        h: sign > 0 ? 2.1 : 1.8,
      },
      { x: 0.1, y: 1.35, w: 1.5, h: 1.8 },
      {
        x: sign > 0 ? 2.8 : 2.6,
        y: sign > 0 ? 0.65 : 1.35,
        w: sign > 0 ? 0.95 : 0.75,
        h: sign > 0 ? 2.1 : 1.8,
      },
      { x: -1.5, y: 4.7, w: 0.8, h: 1.65 },
      { x: 2.9, y: 4.7, w: 0.75, h: 1.65 },
    ]);
    for (const y of [0.65, 3.65, 7.2]) B(v, 'trim', 0, y, 0.04, 9.7, 0.13, 0.22, trim);
    B(v, 'stone', 0, 7.3, 0, 9.5, 0.45, 0.4, stone);
    for (let x = -4.5; x < 4.8; x += 0.75) B(v, 'stone', x, 7.7, 0, 0.5, 0.6, 0.4, stone);
    if (d > 1)
      for (let j = 0; j < 10; j++) {
        const yy = 0.8 + j * 0.64;
        for (let i = 0; i < 13; i++) {
          const xx = -4.4 + i * 0.73 + (j % 2) * 0.22;
          if (xx > 4.4) continue;
          const holes = [
            [-2.7, 1.35, 1.25, 1.8],
            [0.1, 1.35, 1.5, 1.8],
            [2.6, 1.35, 0.75, 1.8],
            [-1.5, 4.7, 0.8, 1.65],
            [2.9, 4.7, 0.75, 1.65],
          ];
          if (
            holes.some(
              ([x, y, w, h]) => Math.abs(xx - x) < w / 2 + 0.35 && yy > y - 0.1 && yy < y + h + 0.1,
            )
          )
            continue;
          panel(
            v,
            'stone',
            xx,
            yy,
            0.015,
            0.62,
            0.52,
            rgb(j % 3 === 0 ? '8c836e' : i % 4 === 0 ? '9b927b' : '817d6c'),
          );
        }
      }
  }
  for (const sign of [-1, 1]) {
    const v = facing(q, (sign * Math.PI) / 2, sign * 5.05, 0.125);
    windowWall(v, d, 4.55, 0.65, 7.3, [
      { x: 0, y: 1.3, w: 0.7, h: 1.8 },
      { x: 0, y: 4.7, w: 0.75, h: 1.65 },
    ]);
    B(v, 'stone', 0, 7.3, 0, 4.55, 0.45, 0.4, stone);
    for (const x of [-1.4, -0.7, 0, 0.7, 1.4]) B(v, 'stone', x, 7.7, 0, 0.45, 0.6, 0.4, stone);
  }
  for (const x of [-4.8, 4.8])
    for (const z of [-1.9, 2.2]) B(q, 'stone', x, 0.65, z, 0.65, 6.65, 0.5, stone);
  polygon(q, 'roof', ring, 7.0, 7.13, roof);
  // Narrow chamfered corner tower rises above the main parapet; no neighbouring hotel.
  const tower = facing(q, 0, -4.5, -1.55),
    tr = [
      [-0.7, -0.7],
      [0.55, -0.7],
      [0.9, -0.3],
      [0.9, 0.5],
      [0.45, 0.85],
      [-0.55, 0.85],
      [-0.9, 0.4],
      [-0.9, -0.3],
    ];
  polygon(tower, 'stone', tr, 0.65, 9.0, stone);
  for (let i = 0; i < tr.length; i++) {
    const a = tr[i],
      b = tr[(i + 1) % tr.length],
      x = (a[0] + b[0]) / 2,
      z = (a[1] + b[1]) / 2;
    B(tower, 'stone', x, 9, z, 0.4, 0.65, 0.4, stone);
  }
  if (d > 0) {
    for (const y of [3.65, 7.2])
      polygon(
        tower,
        'trim',
        tr.map(([x, z]) => [x * 1.08, z * 1.08]),
        y,
        y + 0.13,
        trim,
      );
  }
  // Two north entry bays with the landward small pyramidal porch.
  for (const x of [-3.1, 2.8]) {
    const v = facing(q, 0, x, 2.4);
    B(v, 'stone', 0, 0.45, 0.1, 1.3, 0.2, 0.7, stone);
    B(v, 'green', 0, 0.65, -0.12, 0.9, 2.0, 0.12, green);
    for (const s of [-1, 1]) B(v, 'trim', s * 0.52, 0.65, 0, 0.12, 2.12, 0.16, trim);
    B(v, 'trim', 0, 2.72, 0, 1.16, 0.13, 0.25, trim);
    if (x < 0) {
      B(v, 'stone', 0, 2.85, 0, 1.5, 0.18, 1, stone);
      for (const s of [-1, 1])
        roofFace(
          v,
          [
            [s * 0.86, 3.03, -0.55],
            [s * 0.86, 3.03, 0.75],
            [0, 3.9, 0],
          ],
          roof,
        );
    } else {
      B(v, 'stone', 0, 2.9, -0.1, 1.2, 4.2, 0.6, stone);
      B(v, 'trim', 0, 7.05, -0.1, 1.4, 0.25, 0.8, trim);
    }
  }
}
function build(o, d) {
  const archN = [6, 8, 10, 24][d];
  B(o, 'wood', 0, deck - 0.22, 0, neck, 0.22, 6.1, wood);
  for (const z of [-3.06, 3.06]) {
    B(o, 'green', 0, -0.65, z, neck, 1.0, 0.14, green);
    B(o, 'wood', 0, deck + 0.55, z, neck, 0.24, 0.16, wood);
    if (d > 0) B(o, 'wood', 0, deck + 0.88, z, neck, 0.23, 0.14, wood);
    B(o, 'wood', 0, deck + 0.4, z - Math.sign(z) * 0.35, neck, 0.12, 0.65, wood);
  }
  for (let k = 0; k < 8; k++) {
    const a = shore + (k * neck) / 8,
      b = a + neck / 8;
    for (const z of [-2.8, 2.8]) {
      for (let i = 0; i < archN; i++) {
        const p = (t) => [a + (b - a) * t, -1 - 9.5 * (2 * t - 1) ** 2, z];
        slim(o, d, 'iron', p(i / archN), p((i + 1) / archN), d > 1 ? 0.21 : 0.3, iron);
      }
      if (d > 0) {
        for (let i = 1; i < (d === 1 ? 5 : 9); i++) {
          const n = d === 1 ? 5 : 9,
            t = i / n,
            x = a + (b - a) * t;
          slim(o, d, 'iron', [x, -1 - 9.5 * (2 * t - 1) ** 2, z], [x, -0.65, z], 0.1, iron);
        }
      }
    }
  }
  for (let i = 0; i <= 8; i++) {
    const x = shore + (i * neck) / 8;
    for (const z of [-2.8, 2.8]) {
      if (i > 0)
        for (const sign of [-1, 1]) {
          const foot = [x + sign * 2.4, -15, z],
            top = [x, -0.5, z];
          slim(o, d, 'iron', foot, top, d === 0 ? 0.3 : 0.22, iron);
          if (d > 0) {
            B(o, 'iron', foot[0], -25, z, 0.38, 10, 0.38, iron);
            if (d > 1) B(o, 'concrete', foot[0], -25.1, z, 0.9, 0.6, 0.8, concrete);
          }
        }
      if (d > 0) {
        for (const yy of [-5, -11]) B(o, 'iron', x, yy, z, 4, 0.09, 0.09, iron);
        slim(o, d, 'iron', [x - 2.3, -14, z], [x + 1, -2, z], 0.045, iron);
        slim(o, d, 'iron', [x + 2.3, -14, z], [x - 1, -2, z], 0.045, iron);
      }
      if (d > 0 || i % 2 === 0) lamp(o, d, x, z);
    }
  }
  if (d > 1) {
    for (let x = shore; x < head; x += d === 3 ? 2.5 : 6)
      for (const z of [-3.14, 3.14]) B(o, 'green', x, -0.6, z, 0.055, 1.65, 0.07, green);
    for (let z = -2.6; z <= 2.6; z += 0.23)
      B(o, 'wood', 0, deck + 0.003, z, neck, 0.009, 0.015, rgb('787d72'));
    for (let x = shore; x < head; x += d === 3 ? 7 : 20)
      for (const z of [-2.97, 2.97])
        panel(facing(o, z < 0 ? 0 : Math.PI, x, z), 'brass', 0, deck + 0.66, 0, 0.27, 0.09, brass);
    if (d === 3)
      for (let x = shore; x < head; x += 6)
        for (const z of [-2.8, 2.8]) {
          B(o, 'iron', x, deck + 0.1, z, 0.05, 0.1, 0.08, iron);
          B(o, 'green', x, deck + 0.2, z, 0.07, 0.9, 0.08, green);
        }
  }
  if (d >= 2) constructedSpanTies(o, d);
  headModel(o, d);
  tollhouse(o, d);
  B(o, 'stone', shore - 1.2, -6, 0, 2.5, 6.55, 7.0, stone);
  B(o, 'stone', shore - 5, 0.32, 0, 8, 0.23, 6.5, stone);
  for (const z of [-3.3, 3.3]) {
    B(o, 'stone', shore - 6.8, -2, z, 1.1, 2.55, 1.1, stone);
    lamp(o, d, shore - 6.8, z);
    if (d > 0) rail(facing(o, 0, shore - 4.2, 0), d, 5, deck + 0.08, z);
  }
}
/** Coarse views retain open arches/stairs and three separate roofs with planar structural strips. */
function coarse(o, d) {
  B(o, 'wood', 0, deck - 0.22, 0, neck, 0.22, 6.1, wood);
  for (const z of [-3.06, 3.06]) {
    B(o, 'green', 0, -0.65, z, neck, 1, 0.14, green);
    B(o, 'wood', 0, deck + 0.55, z, neck, 0.42, 0.12, wood);
  }
  for (let k = 0; k < 8; k++)
    for (const z of [-2.8, 2.8]) {
      const a = shore + (k * neck) / 8,
        b = a + neck / 8,
        n = d ? 8 : 5,
        p = (t) => [a + (b - a) * t, -1 - 9.5 * (2 * t - 1) ** 2, z];
      for (let j = 0; j < n; j++) slim(o, 0, 'iron', p(j / n), p((j + 1) / n), 0.32, iron);
      if (d)
        for (const t of [0.2, 0.4, 0.6, 0.8])
          slim(o, 0, 'iron', p(t), [a + (b - a) * t, -0.65, z], 0.14, iron);
    }
  for (let i = 1; i <= 8; i++) {
    const x = shore + (i * neck) / 8;
    for (const z of [-2.8, 2.8])
      for (const sign of [-1, 1])
        slim(o, 0, 'iron', [x + sign * 2.4, -25, z], [x, -0.5, z], 0.4, iron);
    if (d) {
      for (const z of [-2.8, 2.8]) {
        lamp(o, 0, x, z);
        slim(o, 0, 'iron', [x - 2, -15, z], [x + 1, -3, z], 0.1, iron);
      }
    }
  }
  const q = facing(o, 1.216, 147.8305, 1.45);
  headDeck(q);
  for (const z of [-7.2, 7.2]) B(q, 'green', 0, deck + 0.55, z, 28.5, 0.65, 0.12, green);
  for (let i = 0; i < 6; i++)
    for (const z of [-5.7, 5.7])
      slim(
        q,
        0,
        'iron',
        [-12.6 + i * 5.04, -25, z],
        [-12.6 + i * 5.04, deck - 0.25, z],
        0.45,
        iron,
      );
  if (d)
    for (const z of [-5.7, 5.7])
      for (let i = 0; i < 5; i++)
        slim(q, 0, 'iron', [-12.6 + i * 5.04, -18, z], [-12.6 + (i + 1) * 5.04, -1, z], 0.1, iron);
  for (const x of [-12.15, 12.15]) {
    const v = facing(q, 0, x, -2.25);
    B(v, 'glass', 0, deck + 0.1, 0, 2.6, 2.6, 8.3, glass);
    for (const z of [-4.25, 4.25])
      for (const x of [-1.4, 1.4])
        slim(v, 0, 'green', [x, deck, z], [x, deck + 2.8, z], 0.15, green);
    pagodaRoof(v, d, 4.4, 10.1, deck + 2.82, 1.15);
  }
  B(q, 'wood', 0, deck + 3.05, 0, 10.4, 0.2, 9.8, wood);
  for (const x of [-5.1, 5.1])
    for (const z of [-4.8, 4.8])
      slim(q, 0, 'green', [x, deck, z], [x, deck + 3.05, z], 0.22, green);
  B(q, 'glass', 0, deck + 3.3, 0, 6.85, 2.9, 7.9, glass);
  for (const z of [-4.05, 4.05]) {
    B(q, 'green', 0, deck + 3.3, z, 7, 0.1, 0.1, green);
    B(q, 'green', 0, deck + 6.3, z, 7, 0.1, 0.1, green);
    if (d) for (const x of [-3.5, 0, 3.5]) B(q, 'green', x, deck + 3.3, z, 0.1, 3, 0.1, green);
  }
  pagodaRoof(q, d, 8.6, 9.7, deck + 6.42, 3, true);
  for (const z of [-4.85, 4.85]) B(q, 'light', 0, deck + 3.45, z, 10.3, 0.65, 0.08, cream);
  // Open center with separate diagonal stairs, not a filled lower pavilion.
  beam(q, 'wood', [-3.5, deck, -4.55], [3.5, deck + 3.2, -4.55], 0.8, 0.15, wood);
  for (const sign of [-1, 1])
    beam(q, 'concrete', [sign * 2.4, deck, 3.8], [sign * 2.4, deck - 6, 9.8], 1.5, 0.22, concrete);
  const land = facing(q, 0, 0, 9.1);
  B(land, 'concrete', 0, deck - 6.3, 0, 28.4, 0.35, 4.6, concrete);
  for (const x of [-13, -4.5, 4.5, 13])
    for (const z of [-1.7, 1.7])
      slim(land, 0, 'concrete', [x, -25, z], [x, deck - 6.3, z], 0.6, concrete);
  // Same narrow house silhouette and actual small window recesses.
  const t = facing(o, 0, -140.3, -5.7);
  B(t, 'stone', 0, -5, 0.125, 10.3, 5.65, 4.55, stone);
  for (const sign of [-1, 1])
    windowWall(facing(t, sign < 0 ? Math.PI : 0, 0, sign > 0 ? 2.4 : -2.15), -1, 9.4, 0.65, 7.3, [
      { x: 0, y: 1.35, w: 1.5, h: 1.8 },
      { x: -1.5, y: 4.7, w: 0.8, h: 1.65 },
    ]);
  for (const x of [-5.05, 5.05]) B(t, 'stone', x, 0.65, 0.125, 0.3, 6.65, 4.55, stone);
  for (const x of [-4.8, 4.8])
    for (const z of [-1.9, 2.2]) B(t, 'stone', x, 0.65, z, 0.65, 6.65, 0.5, stone);
  B(t, 'roof', 0, 7, 0.125, 10.3, 0.13, 4.55, roof);
  for (const z of [-2.15, 2.4]) {
    B(t, 'stone', 0, 7.3, z, 9.5, 0.45, 0.4, stone);
    if (d) for (let x = -4.5; x < 4.8; x += 1.5) B(t, 'stone', x, 7.7, z, 0.8, 0.6, 0.4, stone);
  }
  B(t, 'stone', -4.5, 0.65, -1.55, 1.6, 9.0, 1.6, stone);
  B(o, 'stone', shore - 1.2, -6, 0, 2.5, 6.55, 7, stone);
  B(o, 'stone', shore - 5, 0.32, 0, 8, 0.23, 6.5, stone);
}
export const clevedonPier = (o) => build(o, 3),
  clevedonPierStreet = (o) => build(o, 2),
  clevedonPierDistrict = (o) => coarse(o, 1),
  clevedonPierSkyline = (o) => coarse(o, 0);
const surfaces = {
  balconyIron: { slot: 'trim', graph: 'metal_painted', roughness: 0.84, metallic: 0.15 },
  crestIron: { slot: 'trim', graph: 'metal_painted', roughness: 0.84, metallic: 0.15 },
  spanTies: {
    slot: 'trim',
    graph: 'metal_painted',
    roughness: 0.82,
    metallic: 0.2,
    doubleSided: true,
  },
  spanNodes: {
    slot: 'trim',
    graph: 'metal_painted',
    roughness: 0.82,
    metallic: 0.2,
    doubleSided: true,
  },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.82, metallic: 0.2, doubleSided: true },
  green: {
    slot: 'trim',
    graph: 'metal_painted',
    roughness: 0.84,
    metallic: 0.15,
    doubleSided: true,
  },
  wood: { slot: 'wall', graph: 'wood_plain', roughness: 0.97, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.96, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.92, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.85, metallic: 0.2 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  brass: { slot: 'trim', graph: 'metal_painted', roughness: 0.6, metallic: 0.4 },
  light: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.75, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.4, metallic: 0.08 },
  amber: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.5, metallic: 0.06 },
};
export const clevedonPierModel = {
  id: 'clevedon_pier',
  key: 'clevedon_pier',
  recipe: 'structure-clevedon-pier.mjs',
  cell: 'gc/gcj',
  title: 'Clevedon Pier',
  brief:
    'Selected2007–2013 slender iron pier: eight real open arched spans/radiating struts, paired raked trestles/ties, grey timber deck/continuous benches, teal side girders/globe lamps, angled column-supported head with two low glazed shelters and raised central pagoda/white balcony/external stair, open landing stairs/lower concrete stage and narrow castellated sandstone tollhouse. Neighboring hotel, later Glass Box and Bell Room infill excluded.',
  camera: [30, 75, 250],
  lookAt: [5, -3, 0],
  qaCameras: [
    { name: 'balcony-tracery', position: [138.925, 4.9, 0.404], lookAt: [142.536, 4.32, 1.742] },
    { name: 'pier-crest', position: [137.307, 11.5, 3.962], lookAt: [147.8305, 9.1, 1.45] },
    { name: 'front', position: [15, 35, -240], lookAt: [5, -5, 0] },
    { name: 'front-detail', position: [122, 19, -22], lookAt: [148, 4, 1.5] },
    { name: 'back', position: [-15, 55, 245], lookAt: [5, -4, 0] },
    { name: 'base-detail', position: [-120, 8, -26], lookAt: [-140, 3, -5] },
    { name: 'iron-detail', position: [-65, -5, -32], lookAt: [-87, -7, 0] },
    { name: 'head-detail', position: [180, 13, 28], lookAt: [150, 0, 1.5] },
    { name: 'deck-detail', position: [105, 7, 0], lookAt: [149, 5, 1.5] },
  ],
  mediumFiContext: { scale: 3, cameraYaw: 0 },
  build: clevedonPier,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Dry shore entrance[-147,1.8] establishes native unchanged Terrarium datum15.8501m. Deck top.55m clears sampled shore approach; separate rock-faced own footing continues below tollhouse. Marine terrain is composite bathymetric/coastal evidence, not tide or seabed survey; fixed support/pile depths and landing/stair levels remain bounded visual estimates. Footprint replacement disabled.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-clevedon-pier.mjs',
    level: 'skyline',
    export: 'clevedonPierSkyline',
    errorMeters: 3,
    surfaces,
    authoredLevels: {
      district: { export: 'clevedonPierDistrict', errorMeters: 1.2, surfaces },
      street: { export: 'clevedonPierStreet', errorMeters: 0.6, surfaces },
    },
  },
  limitations: [
    'New close white quatrefoil balcony tracery and rectangular perforated green crest plus street/close crossed iron span ties use four exact named Ownwork/PD-self/CC0originals,starting with two cleared local Qualla natives. Full fixed eight-span pier/head/pagoda/two shelters/landing/tollhouse scope retained. Exact ornament/counts,profile dimensions,hidden surfaces and current condition remain estimates; cleared tollhouse coverage still missing. Earlier attribution/private image controls are historical and excluded.',
    'Selected2007–2013 exterior predates2016 Glass Box and later Bell Room infill. Eight equal estimated station intervals follow independent280.21m mapped neck; nominal published100ft spans/historical842ft dimensions conflict with mapped/story overall length. Exact chainages and elevations remain estimates.',
    'All source images inspected as recorded; original approximate iron profiles/curved roofs/ornaments and unseen tollhouse walls/windows are not scans or construction drawings. Integral benches and lamps retained; tiny plaque marks have no copied names. No photographic pixels embedded.',
    'Fixed landing/stair pose and pile depths are estimates, not tidal/structural engineering. Source independent terrain retained unchanged; native composite marine returns are not measured water surface or seabed. Current terrain contact requires separate visual review and host compatibility remains limited. Footprint replacement disabled.',
    'Neighboring Royal Pier Hotel, shore Glass Box/streets/landscape/rock/sea/boats, temporary flags and visitors, nonintegral sculptures/furniture and interiors excluded.',
  ],
};
