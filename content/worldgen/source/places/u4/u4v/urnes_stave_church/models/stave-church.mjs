import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  beamPath,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  tarred: { slot: 'wall', graph: 'wood_shou_sugi_ban', roughness: 0.96 },
  planks: { slot: 'wall', graph: 'wood_vertical', roughness: 0.95 },
  roof: { slot: 'roof', graph: 'shingle_cedar', roughness: 0.96 },
  carved: { slot: 'trim', graph: 'wood_plain', roughness: 0.94 },
  plinth: { slot: 'foundation', graph: 'stone_drywall', roughness: 1 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.88 },
};

const northWood = rgb('72665a'),
  southWood = rgb('a98255'),
  endWood = rgb('806850');
const tile = rgb('5c5a54'),
  edge = rgb('776657'),
  pale = rgb('afa08a');
const clay = rgb('989482'),
  glazing = rgb('414749'),
  shade = rgb('4d4841'),
  relief = rgb('8a7a68');
const angle = (site.planAngleDegrees * Math.PI) / 180,
  c = Math.cos(angle),
  s = Math.sin(angle);
const world = (x, y, z) => [x * c - z * s, y, x * s + z * c];
const box = (x0, x1, z0, z1) => [
  [x0, z0],
  [x0, z1],
  [x1, z1],
  [x1, z0],
];

function ccw(ring) {
  const area = ring.reduce((sum, [x, z], i) => {
    const [u, v] = ring[(i + 1) % ring.length];
    return sum + x * v - z * u;
  }, 0);
  return area < 0 ? ring : ring.toReversed();
}

function face(out, slot, points, color, normal) {
  let p = points.map((q) => world(...q).map(Math.fround));
  if (normal && normalFor(...p).reduce((t, v, i) => t + v * normal[i], 0) < 0) p = p.toReversed();
  for (let i = 1; i < p.length - 1; i++) {
    const q = [p[0], p[i], p[i + 1]],
      n = normalFor(...q);
    if (Math.hypot(...n) > 0.9) out.addTriangle(slot, '', q, n, [], color);
  }
}

function cap(out, slot, ring, y, color) {
  const scratch = new MeshBufferBuilder();
  if (
    !scratch.addCap(
      'foundation',
      'palette:#ffffff',
      ring,
      [],
      () => y,
      [0, 1, 0],
      (p) => p,
      color,
    )
  )
    throw Error('Invalid Urnes footprint');
  const { positions, indices } = scratch.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const p = [0, 1, 2].map((j) => 3 * indices[i + j]);
    face(
      out,
      slot,
      p.map((k) => positions.slice(k, k + 3)),
      color,
      [0, 1, 0],
    );
  }
}

function wall(out, ring, from, y0, y1, slot, color) {
  const a = ring[from],
    b = ring[(from + 1) % ring.length];
  face(
    out,
    slot,
    [
      [a[0], y0, a[1]],
      [b[0], y0, b[1]],
      [b[0], y1, b[1]],
      [a[0], y1, a[1]],
    ],
    color,
  );
}

function slab(out, slot, outline, low, high, color) {
  const ring = ccw(outline);
  for (let i = 0; i < ring.length; i++) wall(out, ring, i, low, high, slot, color);
  cap(out, slot, ring, high, color);
}

function block(out, slot, x0, x1, z0, z1, low, high, color) {
  slab(out, slot, box(x0, x1, z0, z1), low, high, color);
}

function roof(out, x0, x1, z0, z1, eave, ridge, detail, transverse = false) {
  const p = transverse ? (x, y, z) => [z, y, x] : (x, y, z) => [x, y, z];
  const mid = (z0 + z1) / 2;
  const a = p(x0, eave, z0),
    b = p(x1, eave, z0),
    f = p(x1, eave, z1),
    d = p(x0, eave, z1);
  const m = p(x0, ridge, mid),
    n = p(x1, ridge, mid);
  face(out, 'roof', [a, b, n, m], tile, [0, 1, 0]);
  face(out, 'roof', [m, n, f, d], tile, [0, 1, 0]);
  face(out, 'tarred', [a, m, d], northWood, transverse ? world(0, 0, -1) : world(-1, 0, 0));
  face(out, 'planks', [b, f, n], endWood, transverse ? world(0, 0, 1) : world(1, 0, 0));
  if (detail === 0) return;
  for (const [p, q] of [
    [a, m],
    [m, d],
    [b, n],
    [n, f],
    [m, n],
    [a, b],
    [d, f],
  ])
    beam(out, 'carved', world(...p), world(...q), 0.082, 0.095, edge);
  if (detail < 3) return;
  const span = x1 - x0,
    nTails = Math.ceil(span / 0.52);
  for (let i = 1; i < nTails; i++) {
    const x = x0 + (span * i) / nTails;
    for (const sign of [-1, 1]) {
      const z = sign < 0 ? z0 : z1;
      beam(
        out,
        'carved',
        world(...p(x, eave - 0.092, z)),
        world(...p(x, eave + 0.21, z - sign * 0.28)),
        0.075,
        0.074,
        edge,
      );
    }
  }
}

function lowerRoof(out, detail) {
  const y = 4.0,
    h = 6.03;
  const outer = box(-8.13, 2.81, -4.89, 3.42),
    inset = box(-7.08, 2.49, -3.02, 1.58);
  loft(
    out,
    'roof',
    [outer.map(([x, z]) => world(x, y, z)), inset.map(([x, z]) => world(x, h, z))],
    tile,
    { cap: false },
  );
  if (detail >= 1)
    for (let i = 0; i < outer.length; i++) {
      const [x, z] = outer[i],
        [u, v] = outer[(i + 1) % outer.length];
      beam(out, 'carved', world(x, y - 0.03, z), world(u, y - 0.03, v), 0.097, 0.138, edge);
    }
}

function panels(out, part) {
  const ring = ccw(part.outline),
    { sill, eave } = part;
  const {
    center: [cx, north],
    width,
    height,
    sill: threshold,
    depth,
  } = site.portal;
  for (let i = 0; i < ring.length; i++) {
    const [x, z] = ring[i],
      [u, v] = ring[(i + 1) % ring.length];
    const dx = u - x,
      dz = v - z;
    if (
      part.name === 'nave' &&
      Math.abs(z - north) < 0.004 &&
      Math.abs(v - north) < 0.004 &&
      Math.min(x, u) < cx &&
      Math.max(x, u) > cx
    ) {
      const a = cx - width / 2,
        b = cx + width / 2,
        back = north + depth,
        top = threshold + height;
      const plane = (x0, x1, y0, y1) =>
        face(
          out,
          'tarred',
          [
            [x0, y0, north],
            [x1, y0, north],
            [x1, y1, north],
            [x0, y1, north],
          ],
          northWood,
          world(0, 0, -1),
        );
      plane(Math.min(x, u), a, sill, eave);
      plane(b, Math.max(x, u), sill, eave);
      plane(a, b, sill, threshold);
      plane(a, b, top, eave);
      face(
        out,
        'tarred',
        [
          [a, threshold, back],
          [b, threshold, back],
          [b, top, back],
          [a, top, back],
        ],
        shade,
        world(0, 0, -1),
      );
      for (const [d, m] of [
        [a, 1],
        [b, -1],
      ])
        face(
          out,
          'carved',
          [
            [d, threshold, north],
            [d, threshold, back],
            [d, top, back],
            [d, top, north],
          ],
          edge,
          world(m, 0, 0),
        );
      face(
        out,
        'carved',
        [
          [a, top, north],
          [b, top, north],
          [b, top, back],
          [a, top, back],
        ],
        edge,
        [0, -1, 0],
      );
      continue;
    }
    const sunny = dx > Math.abs(dz) * 0.17;
    wall(out, ring, i, sill, eave, sunny ? 'planks' : 'tarred', sunny ? southWood : northWood);
  }
}

function glassPane(out, x, y, z, w, h, detail, side = 1) {
  const p = (x, y, d) => [x, y, z + d * side];
  const q = (w, h, d) => [
    p(x - w / 2, y, d),
    p(x + w / 2, y, d),
    p(x + w / 2, y + h, d),
    p(x - w / 2, y + h, d),
  ];
  face(out, 'carved', q(w + 0.13, h + 0.13, 0.03), pale, world(0, 0, side));
  face(
    out,
    'glass',
    q(w, h, 0.055).map(([x, y, z]) => [x, y + 0.057, z]),
    glazing,
    world(0, 0, side),
  );
  if (detail >= 2) {
    for (const dx of [-w / 6, w / 6])
      beam(
        out,
        'carved',
        world(...p(x + dx, y + 0.062, 0.068)),
        world(...p(x + dx, y + h + 0.054, 0.068)),
        0.021,
        0.032,
        pale,
      );
    beam(
      out,
      'carved',
      world(...p(x - w / 2, y + h * 0.5, 0.068)),
      world(...p(x + w / 2, y + h * 0.5, 0.068)),
      0.025,
      0.033,
      pale,
    );
  }
}

function carving(out, detail) {
  const {
    center: [x, z],
    sill: y,
    height: h,
    width: w,
  } = site.portal;
  const border = z - 0.047;
  const sides = [x - w / 2 - 0.34, x + w / 2 + 0.34];
  for (const cx of sides) {
    block(
      out,
      'tarred',
      cx - 0.3,
      cx + 0.3,
      z - 0.033,
      z + 0.036,
      y - 0.03,
      y + h + 0.21,
      northWood,
    );
    if (detail >= 2) {
      for (let k = 0; k < 2; k++) {
        const count = detail === 2 ? 22 : 39;
        const path = Array.from({ length: count }, (_, i) => {
          const u = i / (count - 1),
            phase = 2 * Math.PI * (u * 2.1 + k * 0.45);
          const wave = Math.sin(phase) * (0.206 - 0.048 * Math.cos(u * Math.PI * 2));
          return world(
            cx + wave,
            y + 0.055 + (h + 0.11) * u,
            border - 0.017 * Math.cos(phase * 0.87) - 0.017 * k,
          );
        });
        beamPath(out, 'carved', path, k === 0 ? 0.039 : 0.026, 0.044, relief);
      }
    }
  }
  const fan = Array.from({ length: detail >= 2 ? 18 : 8 }, (_, i) => {
    const t = Math.PI * (1 - i / (detail >= 2 ? 17 : 7));
    return world(x + (w / 2 + 0.08) * Math.cos(t), y + h - 0.28 + 0.45 * Math.sin(t), border);
  });
  beamPath(out, 'carved', fan, 0.053, 0.064, edge);
  for (const sign of [-1, 1]) {
    const u = x + sign * (w / 2 + 0.08);
    beam(out, 'carved', world(u, y, border), world(u, y + h - 0.28, border), 0.07, 0.078, relief);
  }
  if (detail >= 3) {
    for (const ph of [0, Math.PI]) {
      const trace = Array.from({ length: 30 }, (_, i) => {
        const f = i / 29,
          a = 2 * Math.PI * 1.8 * f + ph;
        return world(
          x + 0.3 * Math.sin(a),
          y + 0.2 + (h - 0.62) * f,
          z + 0.054 - 0.021 * Math.cos(a),
        );
      });
      beamPath(out, 'carved', trace, 0.021, 0.027, edge);
    }
  }
}

function belfry(out, detail) {
  const {
    center: [x, z],
    top,
  } = site.tower;
  const r = 0.99,
    start = 9.23,
    crown = 12.02;
  block(out, 'tarred', x - r, x + r, z - r, z + r, start, crown, northWood);
  const ring = [
    [crown - 0.075, 1.38],
    [crown + 0.19, 1.22],
    [top - 0.43, 0.075],
    [top - 0.26, 0.057],
  ];
  loft(
    out,
    'roof',
    ring.map(([y, r]) => box(x - r, x + r, z - r, z + r).map(([x, z]) => world(x, y, z))),
    tile,
  );
  beam(out, 'carved', world(x, top - 0.45, z), world(x, top, z), 0.055, 0.055, pale);
  if (detail === 0) return;
  for (const dz of [-1, 1]) {
    glassPane(out, x - 0.34, 10.35, z + dz * r, 0.34, 0.99, detail, dz);
    glassPane(out, x + 0.34, 10.35, z + dz * r, 0.34, 0.99, detail, dz);
  }
  if (detail >= 2) {
    for (const a of [-1, 1])
      for (const b of [-1, 1]) {
        beam(
          out,
          'carved',
          world(x + a * 0.977, 10.2, z + b * 0.978),
          world(x + a * 0.977, crown, z + b * 0.978),
          0.089,
          0.103,
          relief,
        );
        beam(
          out,
          'carved',
          world(x + a * 1.374, crown - 0.07, z + b * 1.374),
          world(x + a * 0.081, top - 0.45, z + b * 0.081),
          0.064,
          0.063,
          edge,
        );
      }
  }
}

function church(out, detail) {
  slab(out, 'plinth', site.plan, -2.84, 0.823, clay);
  for (const group of site.groups) panels(out, group);
  lowerRoof(out, detail);
  block(out, 'tarred', -7.07, 2.49, -3.02, 1.58, 6.001, 8.27, northWood);
  roof(out, -7.22, 2.68, -3.13, 1.72, 8.24, 11.27, detail);
  roof(out, 2.34, 5.73, -3.55, 2.15, 3.84, 7.54, detail);
  roof(out, 5.49, 8.32, -3.25, 1.98, 3.19, 5.22, detail);
  belfry(out, detail);
  if (detail === 0) return;
  glassPane(out, -3.62, 2.58, 3.12, 0.57, 1.01, detail);
  glassPane(out, 6.87, 1.51, 1.821, 0.49, 0.64, detail);
  block(out, 'planks', 0.64, 1.95, 2.01, 2.97, 4.42, 5.64, southWood);
  roof(out, 2.04, 3.04, 0.53, 2.06, 5.6, 6.56, detail, true);
  glassPane(out, 1.3, 4.86, 2.97, 0.63, 0.76, detail);
  carving(out, detail);
}

export const buildSkyline = (out) => church(out, 0);
export const buildDistrict = (out) => church(out, 1);
export const buildStreet = (out) => church(out, 2);
export const buildCloseup = (out) => church(out, 3);
export const buildMaster = buildCloseup;
