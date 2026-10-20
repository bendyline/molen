/** El Morro: registered masonry terraces, open parade, casemates, bridge and lighthouse. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';

const directory = new URL(
  '../../../content/worldgen/source/places/de/de2/el_morro/',
  import.meta.url,
);
const read = (name) => JSON.parse(fs.readFileSync(new URL(name, directory)));
const layout = read('fort-layout.json'),
  registration = read('plan-registration.json');
const frame = read('map-frame.json'),
  opening = read('ground-opening.json');
const scale = registration.metersPerPixel,
  origin = [1900, 1045];
const point = ([u, v]) => [(u - origin[0]) * scale, (v - origin[1]) * scale];
const path = (p) => p.map(point),
  levels = layout.levels;
const ref = 'palette:#ffffff';
const stone = rgb('a49b80'),
  pale = rgb('d0c3a4'),
  floor = rgb('b9ae96');
const ochre = rgb('c59847'),
  white = rgb('e1dcc8'),
  green = rgb('68745b');
const blue = rgb('657e88'),
  iron = rgb('313b3b'),
  brick = rgb('9b6a4c');
const tint = (c, k) => c.map((v) => Math.min(1, v * k));
function triangle(o, slot, p, colour, desired) {
  p = p.map((q) => q.map(Math.fround));
  let n = normalFor(...p);
  if (Math.hypot(...n) < 0.5) return;
  if (desired && n.reduce((sum, v, i) => sum + v * desired[i], 0) < 0) {
    p = [p[0], p[2], p[1]];
    n = n.map((v) => -v);
  }
  o.addTriangle(
    slot,
    ref,
    p,
    n,
    p.map((q) => [q[0] + q[2], q[1]]),
    colour,
  );
}
function quad(o, slot, p, colour, n) {
  triangle(o, slot, [p[0], p[1], p[2]], colour, n);
  triangle(o, slot, [p[0], p[2], p[3]], colour, n);
}
function polygon(o, slot, p, colour, n = [0, 1, 0], holes = []) {
  const axes = Math.abs(n[1]) > 0.7 ? [0, 2] : Math.abs(n[0]) > 0.7 ? [2, 1] : [0, 1];
  const all = [...p, ...holes.flat()],
    starts = [];
  let off = p.length;
  for (const h of holes) {
    starts.push(off);
    off += h.length;
  }
  const ids = earcut(
    all.flatMap((q) => axes.map((k) => q[k])),
    starts,
  );
  for (let i = 0; i < ids.length; i += 3)
    triangle(
      o,
      slot,
      ids.slice(i, i + 3).map((j) => all[j]),
      colour,
      n,
    );
}
function cap(o, r, y, colour = floor, slot = 'paving') {
  polygon(
    o,
    slot,
    r.map(([x, z]) => [x, y, z]),
    colour,
  );
}
function facing(o, a, x = 0, z = 0) {
  const c = Math.cos(a),
    s = Math.sin(a);
  const v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]];
  const p = (q) => {
    const r = v(q);
    return [r[0] + x, r[1], r[2] + z];
  };
  return {
    addTriangle: (slot, ref, ps, n, uv, col) => o.addTriangle(slot, ref, ps.map(p), v(n), uv, col),
    addQuad: (slot, ref, ps, n, uv, col) => o.addQuad(slot, ref, ps.map(p), v(n), uv, col),
    addConvexPolygon: (slot, ref, ps, n, uv, col) => {
      const transformed = ps.map(p),
        coordinates = ps.map(uv);
      return o.addConvexPolygon(
        slot,
        ref,
        transformed,
        v(n),
        (q) => coordinates[transformed.indexOf(q)],
        col,
      );
    },
  };
}
function signedArea(r) {
  return r.reduce((a, p, i) => {
    const q = r[(i + 1) % r.length];
    return a + p[0] * q[1] - q[0] * p[1];
  }, 0);
}
function solid(
  o,
  r,
  lo,
  hi,
  colour = stone,
  { batter = 0, topColour = floor, slot = 'masonry', topSlot = slot } = {},
) {
  const area = signedArea(r),
    center = r.reduce((a, p) => a.map((v, k) => v + p[k] / r.length), [0, 0]);
  const lower = r.map((p) => {
    const len = Math.hypot(p[0] - center[0], p[1] - center[1]);
    return p.map((v, k) => v + ((v - center[k]) * batter) / len);
  });
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length,
      a = r[i],
      b = r[j];
    const n = [area > 0 ? b[1] - a[1] : a[1] - b[1], 0, area > 0 ? a[0] - b[0] : b[0] - a[0]];
    quad(
      o,
      slot,
      [
        [...lower[i].slice(0, 1), lo, lower[i][1]],
        [lower[j][0], lo, lower[j][1]],
        [b[0], hi, b[1]],
        [a[0], hi, a[1]],
      ],
      colour,
      n,
    );
  }
  cap(o, r, hi, topColour, topSlot);
}
function segmentFrame(o, a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return [facing(o, -Math.atan2(b[1] - a[1], b[0] - a[0]), a[0], a[1]), len];
}
function cylinder(o, x, z, base, height, r0, r1, colour, slot, n) {
  const ring = (r) =>
    Array.from({ length: n }, (_, i) => [
      x + r * Math.cos((i * 2 * Math.PI) / n),
      z + r * Math.sin((i * 2 * Math.PI) / n),
    ]);
  const a = ring(r0),
    b = ring(r1);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    quad(
      o,
      slot,
      [
        [a[i][0], base, a[i][1]],
        [a[j][0], base, a[j][1]],
        [b[j][0], base + height, b[j][1]],
        [b[i][0], base + height, b[i][1]],
      ],
      colour,
      [Math.cos(((i + 0.5) * 2 * Math.PI) / n), 0, Math.sin(((i + 0.5) * 2 * Math.PI) / n)],
    );
  }
  cap(o, b, base + height, colour, slot);
}
function arch(x, bottom, width, height, steps) {
  const p = [
    [x - width / 2, bottom],
    [x + width / 2, bottom],
  ];
  for (let i = 0; i <= steps; i++) {
    const a = (Math.PI * i) / steps;
    p.push([
      x + width * 0.5 * Math.cos(a),
      bottom + height - width / 2 + width * 0.5 * Math.sin(a),
    ]);
  }
  return p;
}
/** Two wall planes with actual negative volumes and intrados; optional closed recessed rear. */
function pierced(
  o,
  width,
  lo,
  hi,
  depth,
  holes,
  d,
  colour = stone,
  slot = 'masonry',
  back = false,
  endCaps = true,
) {
  const outline = [
    [-width / 2, lo],
    [width / 2, lo],
    [width / 2, hi],
    [-width / 2, hi],
  ];
  for (const side of [-1, 1])
    polygon(
      o,
      slot,
      outline.map(([x, y]) => [x, y, (side * depth) / 2]),
      colour,
      [0, 0, side],
      holes.map((h) => h.map(([x, y]) => [x, y, (side * depth) / 2])),
    );
  for (const h of holes) {
    for (let i = 0; i < h.length; i++) {
      const a = h[i],
        b = h[(i + 1) % h.length];
      quad(
        o,
        slot,
        [
          [a[0], a[1], -depth / 2],
          [b[0], b[1], -depth / 2],
          [b[0], b[1], depth / 2],
          [a[0], a[1], depth / 2],
        ],
        tint(colour, 0.88),
      );
    }
    if (back)
      polygon(
        o,
        'metal',
        h.map(([x, y]) => [x, y, 0]),
        iron,
        [0, 0, 1],
      );
    if (d > 1)
      for (let i = 2; i + 1 < h.length; i++) {
        const a = h[i],
          b = h[i + 1];
        if (d === 3)
          beam(
            o,
            slot,
            [a[0], a[1], depth / 2 + 0.018],
            [b[0], b[1], depth / 2 + 0.018],
            slot === 'plaster' ? 0.34 : 0.19,
            0.08,
            slot === 'plaster' ? white : pale,
          );
        else {
          const dx = b[0] - a[0],
            dy = b[1] - a[1],
            len = Math.hypot(dx, dy),
            nx = (-dy / len) * 0.13,
            ny = (dx / len) * 0.13,
            z = depth / 2 + 0.018;
          quad(
            o,
            slot,
            [
              [a[0] - nx, a[1] - ny, z],
              [b[0] - nx, b[1] - ny, z],
              [b[0] + nx, b[1] + ny, z],
              [a[0] + nx, a[1] + ny, z],
            ],
            pale,
            [0, 0, 1],
          );
        }
      }
  }
  if (endCaps) {
    B(o, slot, 0, hi - 0.015, 0, width, 0.03, depth, colour);
    for (const x of [-width / 2, width / 2]) B(o, slot, x, lo, 0, 0.02, hi - lo, depth, colour);
  }
}
/** Measured architectural floor; independent provider roof heights never become paving. */
function paving(o, ring) {
  solid(o, ring, levels.lowerCourt - 1.3, levels.parade, stone, {
    topColour: tint(floor, 1.03),
    topSlot: 'paving',
  });
}
function parapets(o, ring, y, d, { embrasures = false, width = 1.1, height = 1.5 } = {}) {
  if (d === 0) return;
  for (let i = 0; i + 1 < ring.length; i++) {
    const [q, len] = segmentFrame(o, ring[i], ring[i + 1]);
    B(q, 'masonry', len / 2, y, 0, len, embrasures && d ? 0.65 : height, width, stone);
    if (embrasures && d) {
      const n = d === 1 ? 1 : Math.max(1, Math.round(len / 4));
      for (let j = 0; j < n; j++) {
        const x = ((j + 0.5) * len) / n;
        B(
          q,
          'masonry',
          x,
          y + 0.65,
          0,
          Math.max(0.4, len / n - 1.15),
          height - 0.65,
          width,
          tint(stone, 1.06),
        );
        if (d > 2)
          B(q, 'masonry', x, y + height, 0, Math.max(0.4, len / n - 1.15), 0.1, width + 0.1, pale);
      }
    }
  }
}
function gunPlatform(o, runPixels, d) {
  const r = path(runPixels);
  for (let i = 0; i + 1 < r.length; i++) {
    const [q, len] = segmentFrame(o, r[i], r[i + 1]);
    const width = 5.0;
    B(
      q,
      'masonry',
      len / 2,
      levels.lowerCourt - 0.5,
      (d === 0 ? width : width - 0.8) / 2,
      len,
      levels.seaBattery - levels.lowerCourt + 0.5,
      d === 0 ? width : width - 0.8,
      stone,
    );
    if (d > 0) {
      const count = Math.max(1, Math.floor(len / (d === 1 ? 20 : 5.6)));
      const holes = [];
      for (let j = 0; j < count; j++) {
        const x = ((j + 0.5) * len) / count;
        holes.push(arch(x - len / 2, levels.lowerCourt + 0.45, 1.75, 2.9, d === 1 ? 3 : 8));
        if (d > 1) {
          const segments = d === 3 ? 18 : 8;
          for (const radius of d === 3 ? [1.7, 2.2] : [2.0])
            for (let k = 0; k < segments; k++) {
              const a = (Math.PI * k) / segments,
                b = (Math.PI * (k + 1)) / segments;
              quad(
                q,
                'brick',
                [
                  [
                    x + radius * Math.cos(a),
                    levels.seaBattery + 0.025,
                    width - radius * Math.sin(a),
                  ],
                  [
                    x + (radius + 0.11) * Math.cos(a),
                    levels.seaBattery + 0.025,
                    width - (radius + 0.11) * Math.sin(a),
                  ],
                  [
                    x + (radius + 0.11) * Math.cos(b),
                    levels.seaBattery + 0.025,
                    width - (radius + 0.11) * Math.sin(b),
                  ],
                  [
                    x + radius * Math.cos(b),
                    levels.seaBattery + 0.025,
                    width - radius * Math.sin(b),
                  ],
                ],
                brick,
                [0, 1, 0],
              );
            }
        }
      }
      pierced(
        facing(q, 0, len / 2, width - 0.4),
        len,
        levels.lowerCourt - 0.5,
        levels.seaBattery,
        0.8,
        holes,
        d,
        stone,
        'masonry',
        true,
      );
    }
  }
  parapets(o, r, levels.seaBattery, d, { embrasures: true, width: 1.35, height: 1.8 });
}
function lowerFort(o, d) {
  solid(o, path(layout.lowOuter), -24.3, levels.lowerCourt, stone, { batter: 0.7 });
  solid(o, path(layout.waterBattery), -29.0, levels.waterBattery, stone, { batter: 0.8 });
  for (const r of layout.gunRuns) gunPlatform(o, r, d);
  const water = path(layout.waterBattery);
  parapets(o, [...water, water[0]], levels.waterBattery, d, { embrasures: true });
  // Main historical ramp and attached steps: lower court to first landing, then upper gate.
  const ramp = path([
    [1155, 905],
    [1300, 1010],
    [1515, 1025],
  ]);
  rampRun(o, ramp[0], ramp[1], levels.lowerCourt + 0.2, levels.lowerCourt + 4.0, 4.0, d);
  rampRun(o, ramp[1], ramp[2], levels.lowerCourt + 4.0, levels.parade - 2.4, 3.7, d);
  rampRun(o, ramp[2], point([1660, 1025]), levels.parade - 2.4, levels.parade, 3.6, d);
}
function rampRun(o, a, b, ya, yb, width, d) {
  const [q, len] = segmentFrame(o, a, b);
  quad(
    q,
    'paving',
    [
      [0, ya, -width / 2],
      [len, yb, -width / 2],
      [len, yb, width / 2],
      [0, ya, width / 2],
    ],
    floor,
    [0, 1, 0],
  );
  if (d > 0)
    for (const s of [-1, 1]) {
      quad(
        q,
        'masonry',
        [
          [0, ya - 0.8, (s * width) / 2],
          [len, yb - 0.8, (s * width) / 2],
          [len, yb + 1.0, (s * width) / 2],
          [0, ya + 1.0, (s * width) / 2],
        ],
        stone,
        [0, 0, s],
      );
      if (d > 0)
        beam(
          q,
          'masonry',
          [0, ya + 0.95, (s * width) / 2],
          [len, yb + 0.95, (s * width) / 2],
          0.25,
          0.25,
          pale,
        );
    }
  if (d > 1) {
    const n = Math.ceil(Math.abs(yb - ya) / (d === 3 ? 0.25 : 0.6));
    for (let i = 0; i < n; i++)
      B(
        q,
        'masonry',
        ((i + 0.5) * len) / n,
        ya + ((yb - ya) * i) / n - 0.16,
        width / 2 + 1.3,
        len / n,
        Math.abs(yb - ya) / n + 0.16,
        1.7,
        stone,
      );
  }
}
function bastions(o, d) {
  const north = path(layout.northBastion),
    south = path(layout.southBastion);
  for (const r of [north, south]) {
    solid(o, r, levels.moat - 0.65, levels.upper, stone, { batter: 1.65 });
    parapets(o, [...r, r[0]], levels.upper, d, { embrasures: true, width: 1.4, height: 1.7 });
  }
  for (const r of [layout.northLower, layout.southLower]) {
    const p = path(r);
    solid(o, p, levels.lowerCourt, levels.parade, stone, { batter: 1 });
    parapets(o, p, levels.parade, d, { width: 0.8, height: 1.25 });
  }
  if (d === 0) {
    // Keep the exposed southwest coping over its wall toe at the coarsest level.
    const edge = path(layout.southLower).slice(4);
    for (let i = 0; i + 1 < edge.length; i++) {
      const [q, len] = segmentFrame(o, edge[i], edge[i + 1]),
        y = levels.parade;
      quad(
        q,
        'masonry',
        [
          [0, y, -0.4],
          [len, y, -0.4],
          [len, y + 1.25, -0.4],
          [0, y + 1.25, -0.4],
        ],
        stone,
        [0, 0, -1],
      );
      cap(
        q,
        [
          [0, -0.4],
          [len, -0.4],
          [len, 0.4],
          [0, 0.4],
        ],
        y + 1.25,
        pale,
        'masonry',
      );
    }
  }
  // The western Caballero face retains real recessed gun windows below its parapet.
  const r = path(layout.caballeroWall);
  for (let i = 0; i + 1 < r.length; i++) {
    const [q, len] = segmentFrame(o, r[i], r[i + 1]);
    const holes = [];
    if (d > 0 && len > 8)
      for (let x = 3.5; x < len - 2; x += d === 1 ? 20 : 5.9)
        holes.push(arch(x - len / 2, levels.parade - 4.4, 1.7, 1.65, d === 1 ? 4 : 8));
    const centered = facing(q, 0, len / 2, 0);
    pierced(
      centered,
      len,
      levels.lowerCourt - 1.3,
      levels.parade + 1.7,
      2.9,
      holes,
      d,
      stone,
      'masonry',
      true,
    );
    if (d > 0) B(q, 'masonry', len / 2, levels.parade + 1.7, 0, len, 0.24, 3.1, pale);
  }
  paving(o, path(layout.parade));
  if (d > 0) {
    rampRun(o, point([1795, 690]), point([1910, 650]), levels.parade, levels.upper, 3, d);
    rampRun(o, point([1820, 1320]), point([1960, 1410]), levels.parade, levels.upper, 3, d);
  }
}
function casemates(o, d) {
  const a = layout.arcade,
    u0 = point([a.uFront, 1045])[0],
    u1 = point([a.uBack, 1045])[0];
  const u2 = point([a.uOuter, 1045])[0],
    v0 = point([1900, a.vStart])[1],
    v1 = point([1900, a.vEnd])[1];
  const gateHalf = layout.gate.openingWidthMeters / 2 + 0.22;
  // Separate solid blocks leave an actual through sallyport, not an applied dark shape.
  for (const [lo, hi] of [
    [v0, -gateHalf],
    [gateHalf, v1],
  ])
    B(
      o,
      'masonry',
      (u1 + u2) / 2,
      levels.parade,
      (lo + hi) / 2,
      u2 - u1,
      levels.upper - levels.parade,
      hi - lo,
      stone,
    );
  B(o, 'paving', (u0 + u2) / 2, levels.upper - 0.25, (v0 + v1) / 2, u2 - u0, 0.25, v1 - v0, floor);
  const front = facing(o, -Math.PI / 2, u0, (v0 + v1) / 2),
    length = v1 - v0;
  const holes = (d === 0 ? [850, 945, 1045, 1190] : a.bayCenters).map((v) =>
    arch(
      (v - 1045) * scale - (v0 + v1) / 2,
      levels.parade - 0.06,
      d === 0 ? 9 : 4.25,
      4.9,
      d === 0 ? 2 : d === 1 ? 3 : 10,
    ),
  );
  pierced(front, length, levels.parade - 0.3, levels.upper, 0.65, holes, d, ochre, 'plaster');
  B(o, 'paving', (u0 + u1) / 2, levels.parade - 0.15, (v0 + v1) / 2, u1 - u0, 0.15, length, floor);
  if (d > 0) {
    for (const [index, v] of a.bayCenters.entries()) {
      const z = (v - 1045) * scale;
      if (d > 1 || index % 2 === 0)
        for (const sign of [-1, 1])
          B(
            o,
            'plaster',
            u0 - 0.37,
            levels.parade - 0.03,
            z + sign * 2.35,
            0.17,
            4.15,
            0.35,
            white,
          );
      if (d > 1)
        for (const sign of [-1, 1])
          B(o, 'plaster', u0 - 0.4, levels.parade - 0.04, z + sign * 2.35, 0.18, 0.63, 0.35, green);
      if (d > 1 && Math.abs(z) > 3) {
        const door = facing(o, -Math.PI / 2, u1 - 0.14, z);
        pierced(
          door,
          4.0,
          levels.parade,
          levels.upper - 0.28,
          0.25,
          [arch(0, levels.parade + 0.05, 1.25, 2.9, 6)],
          d,
          ochre,
          'plaster',
          true,
        );
      }
    }
    B(o, 'plaster', u0 - 0.38, levels.upper - 0.32, (v0 + v1) / 2, 0.34, 0.32, length, white);
  }
  parapets(
    o,
    [
      [u0, v0],
      [u0, v1],
    ],
    levels.upper,
    d,
    { width: 0.5, height: 0.8 },
  );
}
function galleryReturns(o, d) {
  for (const gallery of layout.galleryReturns) {
    const roof = path(gallery.roof),
      front = path(gallery.front);
    if (d === 0) {
      solid(o, roof, levels.parade, levels.upper, ochre, { topSlot: 'paving' });
      continue;
    }
    // The return roof, recessed room core and porch floor are separate volumes.
    solid(o, roof, levels.upper - 0.25, levels.upper, ochre, { topSlot: 'paving' });
    solid(o, path(gallery.body), levels.parade, levels.upper - 0.25, ochre);
    solid(o, roof, levels.lowerCourt - 1.3, levels.parade, stone, { topSlot: 'paving' });
    for (let i = 0; i + 1 < front.length; i++) {
      const [q, len] = segmentFrame(o, front[i], front[i + 1]);
      const count = Math.max(1, Math.round(len / 5.6));
      const width = Math.min(4.1, len / count - 0.75);
      const holes =
        width > 1.4 && !gallery.solidSegments?.includes(i)
          ? Array.from({ length: count }, (_, j) =>
              arch(
                ((j + 0.5) * len) / count - len / 2,
                levels.parade - 0.05,
                width,
                4.9,
                d === 1 ? 3 : d === 2 ? 6 : 10,
              ),
            )
          : [];
      const face = facing(q, Math.PI, len / 2, 0);
      pierced(
        face,
        len,
        levels.parade - 0.3,
        levels.upper,
        0.65,
        holes,
        d,
        ochre,
        'plaster',
        false,
        false,
      );
      if (d > 1) {
        B(q, 'plaster', len / 2, levels.upper - 0.32, -0.38, len, 0.32, 0.32, white);
        for (let j = 0; j <= count; j++) {
          B(q, 'plaster', (j * len) / count, levels.parade, -0.37, 0.3, 4.15, 0.17, white);
          B(q, 'plaster', (j * len) / count, levels.parade, -0.4, 0.3, 0.63, 0.18, green);
        }
      }
    }
  }
}
function gateAndBridge(o, d) {
  const g = layout.gate,
    f = point(g.front),
    b = point(g.back),
    e = point(g.bridgeEnd);
  const steps = d === 0 ? 2 : d === 1 ? 3 : d === 2 ? 8 : 14;
  const opening = arch(0, levels.parade - 0.04, g.openingWidthMeters, g.openingHeightMeters, steps);
  const gate = facing(o, Math.PI / 2, (f[0] + b[0]) / 2, f[1]);
  pierced(gate, 6.8, levels.parade - 0.2, levels.upper + 0.25, f[0] - b[0], [opening], d, stone);
  const front = facing(o, Math.PI / 2, f[0] + 0.16, f[1]);
  if (d === 0)
    polygon(
      front,
      'masonry',
      [
        [-3.25, levels.upper + 0.25, 0.5],
        [3.25, levels.upper + 0.25, 0.5],
        [0, levels.parade + g.pedimentAboveParadeMeters, 0.5],
      ],
      pale,
      [0, 0, 1],
    );
  if (d > 0) {
    for (const x of [-2.4, 2.4])
      for (const shift of [-0.32, 0.32]) {
        cylinder(
          front,
          x + shift,
          0.2,
          levels.parade,
          0.55,
          0.34,
          0.34,
          pale,
          'masonry',
          d > 1 ? 10 : 6,
        );
        cylinder(
          front,
          x + shift,
          0.2,
          levels.parade + 0.55,
          5.6,
          0.24,
          0.24,
          pale,
          'masonry',
          d > 1 ? 10 : 6,
        );
        B(front, 'masonry', x + shift, levels.parade + 6.12, 0.2, 0.68, 0.25, 0.7, pale);
      }
    B(front, 'masonry', 0, levels.parade + 6.4, 0.17, 6.45, 0.55, 0.65, pale);
    B(front, 'masonry', 0, levels.parade + 7.1, 0.17, 6.95, 0.3, 0.84, pale);
    for (const z of [-0.2, 0.5])
      polygon(
        front,
        'masonry',
        [
          [-3.25, levels.parade + 7.4, z],
          [3.25, levels.parade + 7.4, z],
          [0, levels.parade + g.pedimentAboveParadeMeters, z],
        ],
        pale,
        [0, 0, z > 0 ? 1 : -1],
      );
    beam(
      front,
      'masonry',
      [-3.3, levels.parade + 7.42, 0.52],
      [0, levels.parade + g.pedimentAboveParadeMeters, 0.52],
      0.2,
      0.22,
      white,
    );
    beam(
      front,
      'masonry',
      [0, levels.parade + g.pedimentAboveParadeMeters, 0.52],
      [3.3, levels.parade + 7.42, 0.52],
      0.2,
      0.22,
      white,
    );
  }
  const [bridge, len] = segmentFrame(o, f, e),
    bottom = levels.parade - 4.2799;
  const centers = Array.from({ length: 6 }, (_, i) => ((i + 0.5) * len) / 6 - len / 2);
  const holes = centers.map((x) => arch(x, bottom - 0.15, len / 6 - 1.0, 3.6, steps));
  pierced(
    facing(bridge, 0, len / 2, 0),
    len,
    bottom - 0.5,
    levels.parade - 0.12,
    4.2,
    holes,
    d,
    stone,
  );
  if (d === 0)
    cap(
      bridge,
      [
        [0, -g.bridgeWidthMeters / 2],
        [len, -g.bridgeWidthMeters / 2],
        [len, g.bridgeWidthMeters / 2],
        [0, g.bridgeWidthMeters / 2],
      ],
      levels.parade + 0.12,
      floor,
    );
  else B(bridge, 'paving', len / 2, levels.parade - 0.12, 0, len, 0.24, g.bridgeWidthMeters, floor);
  for (const z of [-2.32, 2.32])
    B(bridge, 'masonry', len / 2, levels.parade + 0.12, z, len, 0.85, 0.42, pale);
}
/** The constructed dry moat has its own measured formation below the entrance bridge. */
function dryMoat(o, d) {
  const y = layout.moat.floor,
    r = path(layout.moat.outline),
    grass = rgb('84955f');
  if (d < 2) cap(o, r, y, grass, 'lawn');
  else solid(o, r, -5.5, y, stone, { topColour: grass, topSlot: 'lawn' });
  cap(
    o,
    path([
      [2048, 1020],
      [2395, 1020],
      [2395, 1070],
      [2048, 1070],
    ]),
    y + 0.016,
    floor,
  );
  if (d === 0) return;
  const outer = path(layout.moat.counterscarp);
  for (let i = 0; i + 1 < outer.length; i++) {
    const [q, len] = segmentFrame(o, outer[i], outer[i + 1]),
      top = layout.moat.counterscarpTop;
    if (d === 1) {
      quad(
        q,
        'masonry',
        [
          [0, -5.5, -0.4],
          [len, -5.5, -0.4],
          [len, top, -0.4],
          [0, top, -0.4],
        ],
        stone,
        [0, 0, -1],
      );
      quad(
        q,
        'masonry',
        [
          [0, top, -0.4],
          [len, top, -0.4],
          [len, top, 0.4],
          [0, top, 0.4],
        ],
        pale,
        [0, 1, 0],
      );
    } else {
      B(q, 'masonry', len / 2, -5.5, 0, len, top + 5.5, 0.8, stone);
    }
  }
}
function garita(o, p, y, d) {
  const [x, z] = point(p),
    n = d === 0 ? 5 : d === 1 ? 5 : d === 2 ? 8 : 18;
  if (d < 2) {
    B(o, 'masonry', x, y, z, 1.6, 2.8, 1.6, stone);
    cylinder(o, x, z, y + 2.8, 1.0, 1.1, 0.03, pale, 'masonry', 4);
    return;
  }
  cylinder(o, x, z, y - 0.55, 0.55, 0.4, 0.95, stone, 'masonry', n);
  cylinder(o, x, z, y, 0.24, 1.06, 1.06, pale, 'masonry', n);
  cylinder(o, x, z, y + 0.24, 2.45, 0.9, 0.9, stone, 'masonry', n);
  cylinder(o, x, z, y + 2.69, 0.19, 1.05, 1.05, pale, 'masonry', n);
  const rings = d === 3 ? 5 : d === 2 ? 3 : 1;
  for (let j = 0; j < rings; j++) {
    const t = j / rings,
      tt = (j + 1) / rings;
    cylinder(
      o,
      x,
      z,
      y + 2.88 + t * 0.95,
      (tt - t) * 0.95,
      1.03 * Math.cos((t * Math.PI) / 2),
      1.03 * Math.cos((tt * Math.PI) / 2),
      pale,
      'masonry',
      n,
    );
  }
  cylinder(o, x, z, y + 3.83, 0.27, 0.12, 0.06, pale, 'masonry', n);
  if (d > 0)
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const q = facing(o, a, x, z);
      B(q, 'metal', 0, y + 1.3, 0.902, 0.14, 0.75, 0.025, iron);
    }
}
function lighthouse(o, d) {
  const [x, z] = point(layout.lighthouse.center),
    y = levels.upper;
  const n = d === 0 ? 4 : d === 1 ? 8 : 12,
    q = facing(o, 0, x, z);
  if (d < 2) {
    if (d === 1) cylinder(q, 0, 0, y, 4.1, 2.7, 2.7, blue, 'plaster', 8);
    else B(q, 'plaster', 0, y, 0, 5.4, 4.1, 5.4, blue);
    B(q, 'plaster', 0, y + 4.1, 0, 4.15, 5.05, 4.15, blue);
    B(q, 'plaster', 0, y + 9.15, 0, 4.85, 0.3, 4.85, white);
    cylinder(q, 0, 0, y + 9.45, 3.1, 1.45, 1.45, iron, 'metal', 4);
    cylinder(q, 0, 0, y + 12.55, 1.85, 1.7, 0.02, iron, 'metal', 4);
    if (d === 1) {
      for (const xx of [-1.91, 1.91])
        for (const zz of [-1.91, 1.91]) B(q, 'plaster', xx, y + 9.45, zz, 0.68, 0.97, 0.68, white);
      for (let i = 0; i < 4; i++) {
        const face = facing(q, (i * Math.PI) / 2);
        for (const yy of [y + 1.05, y + 4.7, y + 6.8])
          polygon(
            face,
            'metal',
            arch(0, yy, 0.75, 1.45, 2).map(([u, v]) => [u, v, yy < y + 2 ? 2.71 : 2.083]),
            iron,
            [0, 0, 1],
          );
      }
    }
    return;
  }
  cylinder(q, 0, 0, y, 0.55, 3.05, 3.05, pale, 'plaster', 8);
  cylinder(q, 0, 0, y + 0.55, 3.55, 2.7, 2.7, blue, 'plaster', 8);
  B(q, 'plaster', 0, y + 3.55, 0, 4.15, 5.25, 4.15, blue);
  B(q, 'plaster', 0, y + 8.8, 0, 4.6, 0.35, 4.6, white);
  B(q, 'plaster', 0, y + 9.15, 0, 4.85, 0.3, 4.85, white);
  cylinder(q, 0, 0, y + 9.45, 0.35, 1.65, 1.65, iron, 'metal', n);
  cylinder(q, 0, 0, y + 9.8, 2.55, 1.38, 1.38, tint(blue, 0.7), 'metal', n);
  cylinder(q, 0, 0, y + 12.35, 0.2, 1.7, 1.7, iron, 'metal', n);
  cylinder(q, 0, 0, y + 12.55, 0.95, 1.7, 0.6, iron, 'metal', n);
  cylinder(q, 0, 0, y + 13.5, 0.5, 0.6, 0.08, iron, 'metal', n);
  cylinder(q, 0, 0, y + 14.0, 0.4, 0.08, 0.03, iron, 'metal', n);
  if (d > 0) {
    for (const xx of [-1.91, 1.91])
      for (const zz of [-1.91, 1.91]) {
        B(q, 'plaster', xx, y + 9.45, zz, 0.58, 0.8, 0.58, blue);
        B(q, 'plaster', xx, y + 10.25, zz, 0.78, 0.17, 0.78, white);
      }
    for (let i = 0; i < 4; i++) {
      const face = facing(q, (i * Math.PI) / 2, 0, 0);
      for (const yy of [y + 1.05, y + 4.7, y + 6.8]) {
        const w = yy < y + 2 ? 0.8 : 0.7,
          front = yy < y + 2 ? 2.71 : 2.083;
        const ps = arch(0, yy, w, 1.45, d > 1 ? 8 : 4).map(([u, v]) => [u, v, front]);
        polygon(face, 'metal', ps, iron, [0, 0, 1]);
        if (d > 1)
          for (let j = 0; j + 1 < ps.length; j++)
            beam(face, 'plaster', ps[j], ps[j + 1], 0.1, 0.07, white);
      }
      B(face, 'plaster', 0, y + 4.1, 2.13, 4.18, 0.15, 0.16, white);
    }
    // Actual lantern bars follow the helical divisions visible in the2019 photograph.
    const count = d > 1 ? 10 : 0,
      segments = d === 3 ? 9 : 4;
    for (let i = 0; i < count; i++)
      for (let k = 0; k < segments; k++) {
        const t = k / segments,
          tt = (k + 1) / segments,
          a = (i * 2 * Math.PI) / count + t * 0.42,
          b = (i * 2 * Math.PI) / count + tt * 0.42;
        beam(
          q,
          'metal',
          [1.41 * Math.cos(a), y + 9.8 + t * 2.55, 1.41 * Math.sin(a)],
          [1.41 * Math.cos(b), y + 9.8 + tt * 2.55, 1.41 * Math.sin(b)],
          0.065,
          0.065,
          iron,
        );
      }
  }
}
function weathering(o, d) {
  if (d < 2) return;
  // Broad, restrained geometry patches indicate weathered limewash; no copied photo texture.
  const r = path(layout.caballeroWall);
  for (let i = 0; i + 1 < r.length; i++) {
    const [q, len] = segmentFrame(o, r[i], r[i + 1]);
    const spacing = d === 3 ? 2.2 : 5.5;
    for (let x = 0.8, j = 0; x < len - 0.5; x += spacing, j++) {
      const low = levels.lowerCourt + 1.1 + (j % 4) * 0.43,
        hi = levels.parade - 5 - (j % 5) * 0.7;
      quad(
        q,
        'masonry',
        [
          [x, low, -1.458],
          [x + 0.37 + (j % 3) * 0.3, low + 0.3, -1.458],
          [x + 0.25, hi, -1.458],
          [x - 0.2, hi - 1.4, -1.458],
        ],
        tint(stone, 0.67 + (j % 3) * 0.05),
        [0, 0, -1],
      );
    }
  }
}
export function elMorro(o, _frame = frame, d = 3) {
  const m = registration.matrixSourcePixelsToLocalXZ,
    t = registration.translationLocalXZ;
  const ox = m[0][0] * origin[0] + m[0][1] * origin[1] + t[0],
    oz = m[1][0] * origin[0] + m[1][1] * origin[1] + t[1];
  const q = facing(o, -registration.rotationRadians, ox, oz);
  lowerFort(q, d);
  bastions(q, d);
  casemates(q, d);
  galleryReturns(q, d);
  gateAndBridge(q, d);
  dryMoat(q, d);
  lighthouse(q, d);
  for (const p of layout.garitas.filter((_, i) => d > 1 || (d === 1 && i < 2)))
    garita(q, p, p[0] > 1850 ? levels.upper + 1.7 : levels.seaBattery + 1.8, d);
  weathering(q, d);
}
export const elMorroSkyline = (o) => elMorro(o, undefined, 0);
export const elMorroDistrict = (o) => elMorro(o, undefined, 1);
export const elMorroStreet = (o) => elMorro(o, undefined, 2);
const surfaces = {
  masonry: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.96, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93, metallic: 0 },
  paving: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.66, metallic: 0.12 },
  brick: { slot: 'trim', graph: 'brick', roughness: 0.94, metallic: 0 },
  lawn: { slot: 'foundation', localRef: ref, roughness: 0.98, metallic: 0 },
};
export const elMorroModel = {
  id: 'el_morro',
  key: 'el_morro',
  recipe: 'structure-el-morro.mjs',
  cell: 'de/de2',
  title: 'El Morro',
  brief:
    'San Juan coastal fort with separate battered landfront bastions, six-arch entrance bridge and pedimented through sallyport, measured dry moat and counterscarp, open elongated parade and wraparound ochre/white arcade, high Caballero wall, stepped lower court and gun batteries with real ramps, corbelled garitas and blue-gray octagonal/square lighthouse with black helical lantern. Registered historical component plans checked against dated current photos; no monolithic8m map extrusion.',
  camera: [235, 165, 265],
  lookAt: [8, -1, 15],
  qaCameras: [
    { name: 'landfront', position: [160, 36, 175], lookAt: [41, 5, 55] },
    { name: 'seaward-tiers', position: [-205, 68, -170], lookAt: [-20, -4, -15] },
    { name: 'open-parade', position: [-24, 63, 70], lookAt: [13, 3, 15] },
    { name: 'arcade', position: [-10, 6, 16], lookAt: [15, 3, 23] },
    { name: 'gate-and-bridge', position: [65, 10, 91], lookAt: [35, 4, 42] },
    { name: 'lighthouse', position: [90, 29, 27], lookAt: [64, 15, 1] },
    { name: 'lower-battery', position: [-67, -3, -28], lookAt: [-15, -9, -17] },
    { name: 'overhead', position: [5, 345, 13], lookAt: [5, -4, 12] },
  ],
  portableGroundY: -36.18,
  mediumFiContext: {
    scale: 1.2,
    groundY: -31,
    terrain: {
      descriptor: 'terrain-site-review.terrain.json',
      heightmap: 'terrain-site-review.height.png',
    },
  },
  groundCutout: { outline: opening.outline, basis: opening.basis },
  build: elMorro,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Frozen source-specific USGS3DEP D24 raster34494, independent1m257² baseline and281² whole-site review grids. Provider-relative34.8123m dry esplanade contact; entry floor approximately1.135m above model datum. Terrain reference uses explicit external approach contact, not terrain at the model anchor. Current geometry/visual clearance approval remains in qa.json.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-el-morro.mjs',
    level: 'skyline',
    export: 'elMorroSkyline',
    errorMeters: 6.6,
    surfaces,
    authoredLevels: {
      district: { export: 'elMorroDistrict', errorMeters: 0.7, surfaces },
      street: { export: 'elMorroStreet', errorMeters: 0.22, surfaces },
    },
  },
  limitations: [
    ...frame.limitations,
    ...layout.limitations,
    'Four terrace heights and individual minor alterations are photo/provider interpretations. Physical model-owned ground opening exposes the true bridge arches and galleries while preserving original provider samples for anchoring and restoring the terrain when the model hides. No hidden-room, safety, navigation or construction-survey claim.',
    'Bulk photographs and measured drawing TIFFs remain in local evidence; original geometry/palette only, no copied photographic pixels. Review captures and source/runtime validation must be current before completion annotations.',
  ],
};
