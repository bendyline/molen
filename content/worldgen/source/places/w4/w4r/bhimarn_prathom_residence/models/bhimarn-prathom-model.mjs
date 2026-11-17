/** The four connected royal halls behind the east garden of Sanam Chandra Palace. */
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  beamPath,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const [mainOutline, linkOutline, audienceOutline] = frame.geometry.polygons;
const [court] = frame.geometry.holes;
const height = plan.dimensions;

const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.88, metallic: 0 },
  westernTile: { slot: 'roof', graph: 'tile_flat', roughness: 0.88, metallic: 0 },
  thaiTile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.79, metallic: 0 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.88, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#484e4a', roughness: 0.72, metallic: 0 },
  gilt: { slot: 'trim', localRef: 'palette:#b89349', roughness: 0.74, metallic: 0.1 },
};
const ink = {
  wall: rgb('e0d9bf'),
  pale: rgb('ebdfc7'),
  base: rgb('b8afa0'),
  gallery: rgb('4a665f'),
  shutter: rgb('56706a'),
  glass: rgb('3f4d48'),
  roof: rgb('717f88'),
  roofDeep: rgb('65777f'),
  thaiWall: rgb('e8e3d2'),
  clay: rgb('bb6536'),
  blue: rgb('3b475a'),
  gilt: rgb('c1a05a'),
  shadowedWood: rgb('6e4440'),
};
const white = 'palette:#ffffff';
const up = [0, 1, 0];
const mix = (a, b, t) => a + (b - a) * t;
const segment = (a, b, t) => a.map((value, index) => mix(value, b[index], t));

function plane(out, slot, points, color, target) {
  let normal = normalFor(...points);
  if (target && normal.reduce((sum, value, k) => sum + value * target[k], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, color);
  else
    out.addTriangle(
      slot,
      white,
      points,
      normal,
      points.map(([x, y, z]) => [x + z, y]),
      color,
    );
}

function cap(out, slot, ring, holes, y, color) {
  // Reuse the kernel's hole triangulation, then emit through the same
  // surface interface in the source and runtime detail generators.
  const builder = new MeshBufferBuilder();
  if (
    !builder.addCap(
      slot,
      white,
      ring,
      holes,
      () => y,
      up,
      (p) => p,
      color,
    )
  ) {
    throw Error('Invalid surface in the mapped palace plan');
  }
  const { positions, indices } = builder.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const points = Array.from(indices.slice(i, i + 3), (index) =>
      Array.from(positions.slice(3 * index, 3 * index + 3)),
    );
    out.addTriangle(
      slot,
      white,
      points,
      up,
      points.map(([x, , z]) => [x, z]),
      color,
    );
  }
}

function signedArea(ring) {
  return ring.reduce((sum, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return sum + p[0] * q[1] - p[1] * q[0];
  }, 0);
}

function edge(a, b, sign = 1) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const x = (b[0] - a[0]) / length;
  const z = (b[1] - a[1]) / length;
  const n = [sign * z, 0, -sign * x];
  return {
    length,
    n,
    point: (u, y, offset = 0) => [a[0] + x * u + n[0] * offset, y, a[1] + z * u + n[2] * offset],
  };
}

function panel(out, f, slot, a, b, y0, y1, offset, color) {
  plane(
    out,
    slot,
    [
      f.point(a, y0, offset),
      f.point(b, y0, offset),
      f.point(b, y1, offset),
      f.point(a, y1, offset),
    ],
    color,
    f.n,
  );
}

function walls(out, ring, y0, y1, color, slot = 'plaster', invert = false) {
  const sign = (signedArea(ring) > 0 ? 1 : -1) * (invert ? -1 : 1);
  return ring.map((a, i) => {
    const f = edge(a, ring[(i + 1) % ring.length], sign);
    panel(out, f, slot, 0, f.length, y0, y1, 0, color);
    return f;
  });
}

function clipWest(ring, limit) {
  const result = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    if (a[0] <= limit) result.push(a);
    if (a[0] <= limit !== b[0] <= limit)
      result.push([limit, mix(a[1], b[1], (limit - a[0]) / (b[0] - a[0]))]);
  }
  return result;
}

function rail(out, f, a, b, y, slot, color, level) {
  if (level === 0) return;
  if (level === 1) {
    panel(out, f, slot, a, b, y + 0.72, y + 0.86, 0, color);
    return;
  }
  for (const offset of [0.07, 0.82]) {
    beam(out, slot, f.point(a, y + offset), f.point(b, y + offset), 0.13, 0.12, color);
  }
  const gaps = Math.ceil((b - a) / (level === 3 ? 0.33 : 0.51));
  for (let i = 1; i < gaps; i++) {
    const u = mix(a, b, i / gaps);
    beam(out, slot, f.point(u, y + 0.11), f.point(u, y + 0.81), 0.07, 0.08, color);
  }
}

function window(out, f, u, base, width, h, level, style = 'western') {
  const a = u - width / 2,
    b = u + width / 2;
  const thai = style === 'thai',
    trim = thai ? 'gilt' : 'wood',
    color = thai ? ink.gilt : ink.shutter;
  if (level > 0)
    panel(out, f, trim, a - 0.12, b + 0.12, base - 0.12, base + h + 0.11, 0.028, color);
  panel(out, f, 'glass', a, b, base, base + h, 0.051, ink.glass);
  if (thai) {
    plane(
      out,
      trim,
      [
        f.point(a - 0.16, base + h, 0.061),
        f.point(b + 0.16, base + h, 0.061),
        f.point(u, base + h + width * 0.66, 0.093),
      ],
      color,
      f.n,
    );
    if (level > 1) {
      plane(
        out,
        'wood',
        [
          f.point(a + 0.11, base + h + 0.084, 0.086),
          f.point(b - 0.11, base + h + 0.084, 0.086),
          f.point(u, base + h + width * 0.39, 0.109),
        ],
        ink.shadowedWood,
        f.n,
      );
    }
  }
  if (level > 1) {
    panel(out, f, trim, u - 0.036, u + 0.036, base, base + h, 0.063, color);
    panel(out, f, trim, a, b, base + h * 0.67, base + h * 0.67 + 0.065, 0.069, color);
  }
}

function roofSurface(out, a, b, c, d, thai) {
  if (!thai) {
    plane(out, 'westernTile', [a, b, c, d], ink.roof, up);
    return;
  }
  const p = (u, v) => segment(segment(a, b, u), segment(d, c, u), v);
  const band = (u, v, r, s, color) =>
    plane(out, 'thaiTile', [p(u, v), p(r, v), p(r, s), p(u, s)], color, up);
  band(0, 0, 1, 0.115, ink.blue);
  band(0, 0.89, 1, 1, ink.blue);
  band(0, 0.115, 0.062, 0.89, ink.blue);
  band(0.938, 0.115, 1, 0.89, ink.blue);
  band(0.062, 0.115, 0.938, 0.89, ink.clay);
}

function chofa(out, p, direction, size, level) {
  const [x, y, z] = p;
  const v = (t, r) => [x + direction[0] * t, y + r, z + direction[1] * t];
  plane(out, 'gilt', [v(-0.18 * size, 0), v(0.36 * size, 0), v(0.23 * size, 1.1 * size)], ink.gilt);
  plane(out, 'gilt', [v(0.23 * size, 1.1 * size), v(0.36 * size, 0), v(-0.18 * size, 0)], ink.gilt);
  if (level > 0) {
    beamPath(
      out,
      'gilt',
      [v(0, 0), v(0.24 * size, 0.42 * size), v(0.23 * size, 1.09 * size)],
      0.09 * size,
      0.095 * size,
      ink.gilt,
    );
  }
}

/** The roof's ridge runs along u; v crosses the roof. */
function pitched(out, roof, level) {
  const {
    point,
    bounds: [u0, u1, v0, v1],
    eave,
    ridge,
    hip = 0,
    thai = false,
    fancy = false,
  } = roof;
  const v = (v0 + v1) / 2;
  const a = point(u0, eave, v0),
    b = point(u1, eave, v0),
    c = point(u1, eave, v1),
    d = point(u0, eave, v1);
  const r0 = point(u0 + hip, ridge, v),
    r1 = point(u1 - hip, ridge, v);
  roofSurface(out, a, b, r1, r0, thai);
  roofSurface(out, d, c, r1, r0, thai);
  const slot = thai ? 'thaiTile' : 'westernTile';
  const trim = thai ? 'gilt' : 'wood';
  const trimColor = thai ? ink.gilt : ink.gallery;
  const uDirection = [b[0] - a[0], b[2] - a[2]].map((n) => n / (u1 - u0));
  const gableColor = hip ? ink.roofDeep : thai ? ink.blue : ink.wall;
  const gableSlot = hip ? slot : thai ? 'wood' : 'plaster';
  plane(out, gableSlot, [a, d, r0], gableColor, hip ? up : [-uDirection[0], 0, -uDirection[1]]);
  plane(out, gableSlot, [c, b, r1], gableColor, hip ? up : [uDirection[0], 0, uDirection[1]]);
  if (level > 1) {
    for (const [start, end] of [
      [a, b],
      [d, c],
    ])
      beam(out, trim, start, end, 0.13, 0.16, trimColor);
    if (!hip) {
      for (const [left, tall, right] of [
        [a, r0, d],
        [b, r1, c],
      ]) {
        beamPath(out, trim, [left, tall, right], thai ? 0.165 : 0.16, 0.19, trimColor);
      }
    }
  }
  if (thai) {
    chofa(
      out,
      r0,
      uDirection.map((n) => -n),
      fancy ? 1.28 : 0.87,
      level,
    );
    chofa(out, r1, uDirection, fancy ? 1.28 : 0.87, level);
    if (level > 1) {
      for (const [corner, dir] of [
        [a, -1],
        [d, -1],
        [b, 1],
        [c, 1],
      ]) {
        chofa(
          out,
          corner,
          uDirection.map((n) => n * dir),
          0.65,
          level,
        );
      }
    }
    if (fancy && level > 1) {
      for (const [u, step] of [
        [u0, -1],
        [u1, 1],
      ]) {
        const front = [step * uDirection[0], 0, step * uDirection[1]];
        for (const t of [-0.25, 0, 0.25]) {
          const center = v + t * (v1 - v0);
          const y = mix(eave, ridge, 0.32 + 0.26 * (1 - Math.abs(t) / 0.25));
          const w = (v1 - v0) * 0.054,
            x = u + step * 0.04;
          plane(
            out,
            'gilt',
            [point(x, y - w, center), point(x, y, center + w), point(x, y + w, center)],
            ink.gilt,
            front,
          );
          plane(
            out,
            'gilt',
            [point(x, y + w, center), point(x, y, center - w), point(x, y - w, center)],
            ink.gilt,
            front,
          );
        }
      }
    }
  }
}

const alongX = (u, y, v) => [u, y, v];
const alongZ = (u, y, v) => [v, y, u];
function rotated(x, z, heading) {
  const c = Math.cos(heading),
    s = Math.sin(heading);
  return (u, y, v) => [x + c * u - s * v, y, z + s * u + c * v];
}

function westernPortico(out, level) {
  const x0 = 1.72,
    x1 = 10.17,
    z = 7.03;
  const floor = height.westFloor,
    balcony = height.westGallery;
  const f = edge([x1, z], [x0, z]);
  box(out, 'stone', [x0, balcony - 0.38, 1.78], [x1, balcony, z + 0.15], ink.pale);
  if (level > 0) {
    for (let i = 0; i < 3; i++) {
      box(
        out,
        'stone',
        [4.11, 0.15, z + i * 0.29],
        [7.81, floor - i * 0.24, z + (i + 1) * 0.31],
        ink.pale,
      );
    }
  }
  const span = f.length / 3;
  for (let i = 0; i <= 3; i++) {
    const x = mix(x0, x1, i / 3);
    box(out, 'stone', [x - 0.22, floor, z - 0.49], [x + 0.22, balcony, z + 0.03], ink.pale);
    if (i === 3) break;
    const a = i * span,
      b = (i + 1) * span;
    if (level > 1) {
      const arch = [
        f.point(a + 0.22, balcony - 1.02, 0.035),
        f.point(a + 0.49, balcony - 0.72, 0.035),
        f.point(a + 0.78, balcony - 0.54, 0.035),
        f.point(b - 0.78, balcony - 0.54, 0.035),
        f.point(b - 0.49, balcony - 0.72, 0.035),
        f.point(b - 0.22, balcony - 1.02, 0.035),
      ];
      beamPath(out, 'stone', arch, 0.165, 0.12, ink.pale);
    }
    rail(out, f, a + 0.08, b - 0.08, balcony, 'stone', ink.pale, level);
  }
  const back = edge([x1, 2.21], [x0, 2.21]);
  panel(out, back, 'plaster', 0, back.length, floor, height.westEave, 0, ink.wall);
  for (const u of [1.6, 4.2, 6.85]) {
    window(out, back, u, balcony + 0.26, 1.15, 2.23, level);
    if (level > 0) window(out, back, u, floor + 0.34, 1.09, 2.5, level);
  }
  pitched(
    out,
    { point: alongZ, bounds: [-7.75, 2.96, 0.97, 11.0], eave: height.westEave, ridge: 11.26 },
    level,
  );
  if (level > 0) {
    for (const x of [2.5, 4.18, 5.985, 7.78, 9.4]) {
      const y = height.westEave + 2.55 * (1 - Math.abs(x - 5.985) / 5.015);
      beam(out, 'wood', [x, height.westEave + 0.1, 2.99], [x, y, 2.99], 0.13, 0.11, ink.gallery);
    }
  }
}

function westernHalls(out, level) {
  const footprint = clipWest(mainOutline, 34.88);
  const floor = height.westFloor,
    balcony = height.westGallery,
    eave = height.westEave;
  cap(out, 'stone', footprint, [court], floor, ink.base);
  walls(out, footprint, 0.15, floor, ink.base, 'stone');
  walls(out, court, 0.15, floor, ink.base, 'stone', true);
  const direction = signedArea(footprint) > 0 ? 1 : -1;
  for (let i = 0; i < footprint.length; i++) {
    const a = footprint[i],
      b = footprint[(i + 1) % footprint.length],
      f = edge(a, b, direction);
    const [x, z] = segment(a, b, 0.5);
    const portico = x > 1.1 && x < 10.7 && z > 3.31;
    if (portico) continue;
    const open = x > 10.5 && x < 24.6 && z > 0.9;
    const bays = Math.max(1, Math.round(f.length / (level > 1 ? 3.26 : 5.6)));
    if (open) {
      rail(out, f, 0, f.length, balcony, 'wood', ink.gallery, level);
      panel(out, f, 'wood', 0, f.length, eave - 0.63, eave, 0, ink.gallery);
      const supports = level === 0 ? 1 : bays;
      for (let j = 0; j <= supports; j++) {
        const u = mix(0, f.length, j / supports);
        beam(out, 'wood', f.point(u, balcony), f.point(u, eave), 0.18, 0.17, ink.gallery);
        beam(out, 'stone', f.point(u, floor), f.point(u, balcony), 0.39, 0.37, ink.pale);
      }
      const deckInset = 2.15;
      plane(
        out,
        'stone',
        [
          f.point(0, balcony),
          f.point(f.length, balcony),
          f.point(f.length, balcony, -deckInset),
          f.point(0, balcony, -deckInset),
        ],
        ink.pale,
        up,
      );
      continue;
    }
    panel(out, f, 'plaster', 0, f.length, floor, eave, 0, ink.wall);
    if (level === 0 || f.length < 2.7 || Math.abs(x - 34.88) < 0.03) continue;
    panel(out, f, 'stone', 0, f.length, balcony - 0.2, balcony + 0.02, 0.05, ink.pale);
    for (let j = 0; j < bays; j++) {
      const u = (f.length * (j + 0.5)) / bays;
      const width = Math.min(1.04, f.length / bays - 0.33);
      window(out, f, u, balcony + 0.64, width, 1.71, level);
      if (level > 0) window(out, f, u, floor + 0.45, width, 2.06, level);
    }
  }
  for (const inner of walls(out, court, floor, eave - 0.1, ink.wall, 'plaster', true)) {
    if (level > 0) window(out, inner, inner.length / 2, balcony + 0.38, 0.91, 1.91, level);
  }
  // The low roof surfaces close connecting wings while the surveyed court remains open.
  cap(out, 'westernTile', footprint, [court], eave - 0.04, ink.roofDeep);
  pitched(
    out,
    { point: alongX, bounds: [-8.9, 8.9, -20.7, 2.66], eave, ridge: 10.85, hip: 4.75 },
    level,
  );
  pitched(
    out,
    {
      point: alongX,
      bounds: [1.55, 23.28, -3.68, 1.88],
      eave: eave - 0.03,
      ridge: 9.98,
      hip: 2.52,
    },
    level,
  );
  pitched(
    out,
    {
      point: alongX,
      bounds: [17.5, 34.92, -9.66, -4.12],
      eave: eave - 0.09,
      ridge: 10.0,
      hip: 2.09,
    },
    level,
  );
  pitched(
    out,
    {
      point: rotated(-14.55, -13.9, -0.782),
      bounds: [-14.5, 13, -5.35, 5.22],
      eave: eave + 0.04,
      ridge: 10.75,
      hip: 4.15,
    },
    level,
  );
  pitched(
    out,
    {
      point: rotated(-25.74, -30.33, 0.785),
      bounds: [-18.8, 16.6, -5.0, 5.1],
      eave: eave - 0.04,
      ridge: 10.5,
      hip: 3.7,
    },
    level,
  );
  pitched(
    out,
    {
      point: rotated(-31.8, -38.3, -0.785),
      bounds: [-8.25, 10.5, -5.5, 5.8],
      eave: eave - 0.11,
      ridge: 10.48,
      hip: 3.99,
    },
    level,
  );
  pitched(
    out,
    {
      point: rotated(13.84, -25.4, 0.77),
      bounds: [-9.5, 10.3, -4.1, 4.23],
      eave: eave - 0.05,
      ridge: 10.38,
      hip: 3.09,
    },
    level,
  );
  westernPortico(out, level);
}

function thaiHall(out, level) {
  const floor = height.vajariromayaFloor,
    balcony = height.vajariromayaGallery,
    eave = height.thaiEave;
  const body = [
    [34.9, -19.25],
    [57.62, -19.25],
    [57.62, 0.71],
    [34.9, 0.71],
  ];
  cap(out, 'stone', body, [], floor, ink.pale);
  walls(out, body, 0.32, floor, ink.base, 'stone');
  for (const f of walls(out, body, floor, eave, ink.thaiWall)) {
    const bays = Math.max(2, Math.round(f.length / (level > 1 ? 4.05 : 6.5)));
    panel(out, f, 'stone', 0, f.length, balcony - 0.26, balcony + 0.04, 0.065, ink.pale);
    for (let j = 0; j < bays; j++) {
      const u = (f.length * (j + 0.5)) / bays;
      if (level > 0) window(out, f, u, floor + 0.64, 0.96, 2.39, level, 'thai');
      window(out, f, u, balcony + 0.59, 1.08, 2.63, level, 'thai');
    }
  }
  pitched(
    out,
    {
      point: alongZ,
      bounds: [-20.15, 1.6, 33.98, 58.52],
      eave: eave - 0.52,
      ridge: 15.45,
      thai: true,
      fancy: true,
    },
    level,
  );
  pitched(
    out,
    {
      point: alongZ,
      bounds: [-17.4, -2.2, 35.15, 57.34],
      eave: eave + 0.62,
      ridge: 16.67,
      thai: true,
    },
    level,
  );
  // The south gabled portico has open sides and stairs below the upper gallery.
  box(out, 'stone', [24.56, balcony - 0.39, -4.91], [35.24, balcony, 0.23], ink.pale);
  const front = edge([24.68, -4.62], [24.68, 0.12], -1);
  for (const z of [-4.59, -0.18]) {
    beam(out, 'stone', [24.74, floor, z], [24.74, balcony, z], 0.43, 0.43, ink.pale);
    beam(out, 'gilt', [24.74, balcony, z], [24.74, eave - 1.84, z], 0.23, 0.22, ink.gilt);
  }
  rail(out, front, 0.25, front.length - 0.22, balcony, 'wood', ink.gallery, level);
  pitched(
    out,
    {
      point: alongX,
      bounds: [23.85, 35.25, -5.55, 1.13],
      eave: eave - 1.69,
      ridge: 12.7,
      thai: true,
      fancy: true,
    },
    level,
  );
  const steps = level > 1 ? 12 : level === 1 ? 7 : 2;
  for (let j = 0; j < steps; j++) {
    const x = mix(23.85, 29.55, j / steps),
      next = mix(23.85, 29.55, (j + 1) / steps);
    const y = mix(floor, balcony, (j + 1) / steps);
    box(out, 'stone', [x, floor - 0.11, 0.31], [next, y, 2.11], ink.pale);
  }
  beam(
    out,
    'wood',
    [23.85, floor + 0.91, 2.08],
    [29.55, balcony + 0.91, 2.08],
    0.15,
    0.15,
    ink.gallery,
  );
}

function roofedLink(out, level) {
  const deck = height.connectorDeck;
  const [minX, maxX, minZ, maxZ] = [
    Math.min(...linkOutline.map((p) => p[0])),
    Math.max(...linkOutline.map((p) => p[0])),
    Math.min(...linkOutline.map((p) => p[1])),
    Math.max(...linkOutline.map((p) => p[1])),
  ];
  box(out, 'stone', [minX, deck - 0.32, minZ], [maxX, deck, maxZ], ink.pale);
  for (const z of [minZ, maxZ]) {
    const f = edge([minX, z], [maxX, z]);
    rail(out, f, 0.1, f.length - 0.1, deck, 'wood', ink.gallery, level);
    for (const fraction of level > 0 ? [0.17, 0.39, 0.61, 0.83] : [0.2, 0.8]) {
      const x = mix(minX, maxX, fraction);
      beam(out, 'stone', [x, 0.38, z], [x, deck, z], 0.36, 0.4, ink.pale);
      if (level > 0) beam(out, 'wood', [x, deck, z], [x, deck + 2.71, z], 0.2, 0.21, ink.gallery);
    }
  }
  pitched(
    out,
    {
      point: alongX,
      bounds: [minX - 0.25, maxX + 0.26, minZ - 0.47, maxZ + 0.48],
      eave: deck + 2.68,
      ridge: deck + 4.55,
      thai: true,
    },
    level,
  );
}

function audienceHall(out, level) {
  const floor = height.audiencePlatform,
    eave = height.audienceEave;
  cap(out, 'stone', audienceOutline, [], floor, ink.pale);
  walls(out, audienceOutline, 0.72, floor, ink.base, 'stone');
  const inner = [
    [82.6, -14.7],
    [119.95, -14.7],
    [119.95, 0.14],
    [82.6, 0.14],
  ];
  for (const f of walls(out, inner, floor, eave, ink.thaiWall)) {
    if (level === 0) continue;
    if (f.length < 15) {
      for (const u of [f.length * 0.28, f.length * 0.5, f.length * 0.72])
        window(out, f, u, floor + 0.75, 1.18, 2.51, level, 'thai');
      continue;
    }
    const bays = level > 1 ? 8 : 5;
    for (let j = 0; j < bays; j++)
      window(out, f, (f.length * (j + 0.5)) / bays, floor + 0.79, 1.17, 2.67, level, 'thai');
  }
  for (const z of [-15.65, 1.75]) {
    for (const x of level > 1
      ? [84, 89.7, 95.4, 101.05, 106.7, 112.35, 118.0, 122.0]
      : [84, 97, 110, 122]) {
      beam(out, 'stone', [x, floor, z], [x, eave, z], 0.28, 0.24, ink.pale);
    }
  }
  const stairs = level > 1 ? 9 : level === 1 ? 6 : 2;
  for (const side of [-1, 1]) {
    const z = side > 0 ? 5.43 : -18.47;
    for (let j = 0; j < stairs; j++) {
      const a = z + side * j * 0.3,
        b = a + side * 0.31,
        y = mix(floor, 1.02, j / stairs);
      box(out, 'stone', [86.21, 0.67, Math.min(a, b)], [91.05, y, Math.max(a, b)], ink.pale);
    }
  }
  pitched(
    out,
    {
      point: alongX,
      bounds: [79.82, 124.18, -19.14, 5.2],
      eave: eave - 0.23,
      ridge: 14.86,
      thai: true,
      fancy: true,
    },
    level,
  );
  pitched(
    out,
    {
      point: alongX,
      bounds: [84.45, 120.75, -16.68, 2.75],
      eave: eave + 0.95,
      ridge: 16.36,
      thai: true,
    },
    level,
  );
}

function build(out, level) {
  westernHalls(out, level);
  thaiHall(out, level);
  roofedLink(out, level);
  audienceHall(out, level);
}
export const bhimarnSkyline = (out) => build(out, 0);
export const bhimarnDistrict = (out) => build(out, 1);
export const bhimarnStreet = (out) => build(out, 2);
export const bhimarnCloseup = (out) => build(out, 3);

const recipe = 'bhimarn-prathom-model.mjs';
const position = [18, 85, 135],
  lookAt = [38, 6, -13];
export const bhimarnPrathomModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  surfaces,
  build: bhimarnCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  buildingCutout: {
    outline: mainOutline,
    outlines: [mainOutline, linkOutline, audienceOutline],
    minimumCoverage: 0.995,
    basis:
      'The four linked halls occupy the surveyed compound perimeter, narrow roofed link and northern audience hall.',
  },
  brief:
    'Four connected royal halls with a blue-green tropical veranda at the east garden and stepped gold-edged Thai roofs to the north.',
  camera: position,
  lookAt,
  sunDirection: [-63, 104, 123],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 3.34,
    cameraYaw: -0.4,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'bhimarn-prathom-east-gallery', position: [-3, 13, 44], lookAt: [4.6, 5, -1.7] },
    { name: 'vajariromaya-gilded-south-gallery', position: [15.5, 18, 38], lookAt: [40, 8, -4] },
    { name: 'samakkhi-mukhamat-audience-hall', position: [144, 26, 45], lookAt: [104, 7, -7] },
    { name: 'light-court-and-connected-roofs', position: [56, 63, -89], lookAt: [30, 5, -10] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'bhimarn-prathom-' + reviewLod,
    position,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'bhimarnSkyline',
    errorMeters: 0.92,
    surfaces,
    authoredLevels: {
      district: { export: 'bhimarnDistrict', errorMeters: 0.39, surfaces },
      street: { export: 'bhimarnStreet', errorMeters: 0.17, surfaces },
      closeup: { export: 'bhimarnCloseup', errorMeters: 0.065, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original authored geometry from exact Qualla public-domain originals, written architectural records, attributed OpenStreetMap and Terrarium ground.',
};
