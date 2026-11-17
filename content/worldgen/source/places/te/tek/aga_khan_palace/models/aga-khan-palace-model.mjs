/** Standing arcaded exterior of Aga Khan Palace in Pune. */
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const map = read('map-frame');
const terrain = read('terrain-grid');
const outline = map.geometry.outline;
const {
  foundation,
  groundFloor,
  firstFloor,
  firstCornice,
  entranceRoof,
  pavilionEaves,
  pavilionRidge,
  verandaDepth,
  porchCenter,
  frontZ,
} = plan.section;
const ref = 'palette:#ffffff';
const colors = Object.fromEntries(
  Object.entries({
    wall: 'eee5ce',
    ivory: 'f2e8d4',
    plaster: 'ddd1b8',
    trim: 'f4eee0',
    base: '7e7870',
    column: '696963',
    paving: '9c9182',
    cool: 'a09a8e',
    roof: 'a45543',
    roofShadow: '904a3b',
    deck: 'b6a898',
    pane: '555859',
    wood: '564339',
    shadow: '726b5a',
    metal: '5a5146',
    water: '718789',
  }).map(([name, value]) => [name, rgb(value)]),
);
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.9, metallic: 0 },
  base: { slot: 'wall', graph: 'stone_basalt', roughness: 0.95, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.93, metallic: 0 },
  deck: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.94, metallic: 0 },
  detail: { slot: 'trim', localRef: 'palette:#f9f8f5', roughness: 0.68, metallic: 0 },
};

const up = [0, 1, 0];
const pointOn = ([x, z], y) => [x, y, z];
function face(out, slot, points, normal, color) {
  let winding = normalFor(...points);
  if (winding.reduce((sum, n, i) => sum + n * normal[i], 0) < 0) {
    points = [...points].reverse();
    winding = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, winding, color);
  else
    out.addTriangle(
      slot,
      ref,
      points,
      winding,
      points.map(([x, , z]) => [x, z]),
      color,
    );
}

function cap(out, slot, ring, height, color) {
  const builder = new MeshBufferBuilder();
  if (
    !builder.addCap(
      slot,
      ref,
      ring,
      [],
      () => height,
      up,
      (p) => p,
      color,
    )
  )
    throw Error('Invalid palace roof or veranda footprint');
  const mesh = builder.finalize();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const points = Array.from(mesh.indices.slice(i, i + 3), (j) =>
      Array.from(mesh.positions.slice(3 * j, 3 * j + 3)),
    );
    out.addTriangle(
      slot,
      ref,
      points,
      up,
      points.map(([x, , z]) => [x, z]),
      color,
    );
  }
}

function edge(a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / length;
  const dz = (b[1] - a[1]) / length;
  return {
    length,
    n: [dz, 0, -dx],
    at: (u, y, d = 0) => [a[0] + dx * u + dz * d, y, a[1] + dz * u - dx * d],
  };
}
const frames = (ring) => ring.map((p, i) => edge(p, ring[(i + 1) % ring.length]));
const front = edge(outline[13], outline[15]);
const porchU = outline[13][0] - porchCenter;
const rect = (left, right, back, fore) => [
  [left, back],
  [right, back],
  [right, fore],
  [left, fore],
];
const northWing = rect(23.17, 36.06, -8.46, 0.03);
const upperFootprint = rect(-45.44, 22.74, -9.42, frontZ);
const rearRoof = rect(-44.9, -2.62, -12.66, -5.49);

function panel(out, slot, f, u0, u1, y0, y1, d, color) {
  face(out, slot, [f.at(u0, y0, d), f.at(u1, y0, d), f.at(u1, y1, d), f.at(u0, y1, d)], f.n, color);
}
function molding(out, slot, f, u0, u1, y0, y1, d, color) {
  panel(out, slot, f, u0, u1, y0, y1, d, color);
  face(
    out,
    slot,
    [f.at(u0, y1, d), f.at(u1, y1, d), f.at(u1, y1, -0.07), f.at(u0, y1, -0.07)],
    up,
    color,
  );
}
function plinth(out, lod) {
  cap(out, 'deck', outline, groundFloor, colors.paving);
  for (const f of frames(outline)) {
    panel(out, 'base', f, 0, f.length, foundation, groundFloor, 0, colors.base);
    if (lod > 0)
      molding(
        out,
        'trim',
        f,
        0,
        f.length,
        groundFloor - 0.15,
        groundFloor + 0.04,
        0.14,
        colors.cool,
      );
  }
}

function curve(f, mid, across, spring, rise, segments, d, pointed = false) {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const a = (Math.PI * i) / segments;
    const x = -across * Math.cos(a);
    const y = pointed ? rise * Math.sin(a) * (1 - 0.31 * Math.abs(x / across)) : rise * Math.sin(a);
    return f.at(mid + x, spring + y, d);
  });
}

/** Solid arc and vaulted reveal between the front and the recessed passage. */
function arch(out, f, mid, half, y, spring, rise, ceiling, depth, lod, pointed = false) {
  const segments = [4, 5, 10, 14][lod];
  const inside = curve(f, mid, half, spring, rise, segments, depth, pointed);
  const behind = curve(f, mid, half, spring, rise, segments, depth - 0.36, pointed);
  const rim = curve(f, mid, half + 0.17, spring, rise + 0.17, segments, depth + 0.07, pointed);
  for (let i = 0; i < segments; i++) {
    const a = inside[i],
      b = inside[i + 1];
    face(out, 'wall', [a, b, [b[0], ceiling, b[2]], [a[0], ceiling, a[2]]], f.n, colors.wall);
    const reveal = [a, behind[i], behind[i + 1], b];
    if (lod > 1) {
      face(out, 'trim', reveal, [0, -1, 0], colors.plaster);
      face(out, 'trim', [a, b, rim[i + 1], rim[i]], f.n, colors.trim);
    }
  }
  if (lod > 1) {
    const leftReveal = [
      inside[0],
      behind[0],
      f.at(mid - half, y, depth - 0.36),
      f.at(mid - half, y, depth),
    ];
    const rightReveal = [
      inside.at(-1),
      f.at(mid + half, y, depth),
      f.at(mid + half, y, depth - 0.36),
      behind.at(-1),
    ];
    quad(out, 'trim', leftReveal, normalFor(...leftReveal), colors.plaster);
    quad(out, 'trim', rightReveal, normalFor(...rightReveal), colors.plaster);
  }
}

function balustrade(out, f, left, right, y, lod, d = 0.06) {
  molding(out, 'trim', f, left, right, y + 0.76, y + 0.92, d + 0.08, colors.trim);
  molding(out, 'trim', f, left, right, y + 0.02, y + 0.2, d + 0.08, colors.ivory);
  const count = Math.max(2, Math.round((right - left) / [3.5, 1.45, 0.49, 0.38][lod]));
  for (let i = 0; i < count; i++) {
    const u = left + ((right - left) * (i + 0.5)) / count;
    if (lod <= 1) panel(out, 'trim', f, u - 0.09, u + 0.09, y + 0.2, y + 0.77, d, colors.trim);
    else
      beam(
        out,
        'trim',
        f.at(u, y + 0.2, d - 0.04),
        f.at(u, y + 0.77, d - 0.04),
        0.14,
        0.16,
        colors.trim,
      );
  }
}

function innerDoor(out, f, u, base, upper, lod, d, height = 3.02) {
  const half = upper ? 0.87 : 1.08;
  if (lod > 1)
    molding(
      out,
      'trim',
      f,
      u - half - 0.13,
      u + half + 0.13,
      base + 0.16,
      base + height,
      d + 0.08,
      colors.ivory,
    );
  panel(
    out,
    'detail',
    f,
    u - half,
    u + half,
    base + 0.21,
    base + height - 0.18,
    d + 0.092,
    upper ? colors.pane : colors.wood,
  );
  if (lod > 1) {
    for (const x of [-half / 2, 0, half / 2])
      panel(
        out,
        'detail',
        f,
        u + x - 0.024,
        u + x + 0.024,
        base + 0.31,
        base + height - 0.23,
        d + 0.106,
        colors.metal,
      );
    panel(
      out,
      'trim',
      f,
      u - half,
      u + half,
      base + height * 0.68,
      base + height * 0.68 + 0.05,
      d + 0.113,
      colors.cool,
    );
  }
}

function arcade(out, f, segment, lo, hi, lod, upper = false) {
  const [left, right, count] = segment;
  const width = (right - left) / count;
  const darkStone = !upper;
  const d = -verandaDepth;
  const pier = count === 3 && width > 5 ? 0.52 : 0.35;
  const spring = lo + (upper ? 2.48 : 2.18);
  const rise = Math.min(width * 0.36, hi - spring - 0.51);
  panel(out, 'wall', f, left, right, lo, hi, d, colors.shadow);
  for (let i = 0; i < count; i++) {
    const low = left + i * width;
    const mid = low + width * 0.5;
    const half = width * 0.5 - pier;
    const slot = darkStone ? 'base' : 'trim';
    panel(out, 'wall', f, low, mid - half, lo, hi, 0, colors.wall);
    panel(out, 'wall', f, mid + half, low + width, lo, hi, 0, colors.wall);
    arch(out, f, mid, half, lo, spring, rise, hi, 0, lod);
    const point = f.at(low + pier * 0.45, lo + 0.22, 0.06);
    const top = f.at(low + pier * 0.45, spring, 0.06);
    if (lod > 1) {
      beam(out, slot, point, top, 0.28, 0.28, darkStone ? colors.column : colors.trim);
      molding(
        out,
        'trim',
        f,
        low + 0.02,
        low + 0.46,
        spring - 0.13,
        spring + 0.07,
        0.26,
        colors.ivory,
      );
    } else {
      panel(
        out,
        slot,
        f,
        low + 0.03,
        low + 0.32,
        lo + 0.2,
        spring,
        0.11,
        darkStone ? colors.column : colors.trim,
      );
    }
    if (upper) balustrade(out, f, mid - half, mid + half, lo, lod);
    if (lod > 0) innerDoor(out, f, mid, lo, upper, lod, d);
  }
  molding(out, 'trim', f, left, right, hi - 0.29, hi + 0.06, 0.24, colors.ivory);
}

function solidRange(out, f, bottom, top, lod, d = 0) {
  panel(out, 'wall', f, 0, f.length, bottom, top, d, colors.plaster);
  molding(out, 'trim', f, 0, f.length, top - 0.27, top + 0.04, d + 0.14, colors.ivory);
  const count = Math.round(f.length / 4.7) - 1;
  if (f.length <= 4 || lod === 0) return;
  for (let i = 0; i < count; i++)
    innerDoor(
      out,
      f,
      f.length * ((i + 1) / (count + 1)),
      bottom + 0.22,
      true,
      lod,
      d,
      Math.min(3.02, top - bottom - 0.6),
    );
}

function hip(out, bounds, bottom, top, lod) {
  const [left, right, back, fore] = bounds;
  const ring = rect(left, right, back, fore);
  const mid = (back + fore) / 2;
  const setback = Math.min((right - left) * 0.36, (fore - back) * 0.46);
  const a = [left + setback, top, mid];
  const b = [right - setback, top, mid];
  const [p0, p1, p2, p3] = ring.map((p) => pointOn(p, bottom));
  face(out, 'roof', [p0, p1, b, a], up, colors.roofShadow);
  face(out, 'roof', [p1, p2, b], up, colors.roof);
  face(out, 'roof', [p2, p3, a, b], up, colors.roof);
  face(out, 'roof', [p3, p0, a], up, colors.roofShadow);
  if (lod > 0) beam(out, 'roof', a, b, 0.18, 0.18, colors.roofShadow);
}

function rotundaFinial(out, x, y, z, lod) {
  const segments = [4, 5, 7, 10][lod];
  const rings =
    lod === 0
      ? [
          [0, 0.32],
          [0.49, 0.2],
          [0.91, 0.045],
        ]
      : [
          [0, 0.32],
          [0.17, 0.32],
          [0.35, 0.16],
          [0.5, 0.23],
          [0.69, 0.18],
          [0.91, 0.045],
        ];
  loft(
    out,
    'trim',
    rings.map(([dy, r]) => radialRing(y + dy, r, r, segments, [x, z])),
    colors.trim,
  );
}

function pavilion(out, left, right, back, fore, lod) {
  const ring = rect(left, right, back, fore);
  for (const f of frames(ring)) {
    solidRange(out, f, firstCornice, pavilionEaves, lod);
    if (lod > 0) {
      for (const u of [0.23, f.length - 0.23])
        molding(out, 'trim', f, u - 0.18, u + 0.18, firstCornice, pavilionEaves, 0.23, colors.trim);
    }
  }
  hip(
    out,
    [left - 0.14, right + 0.14, back - 0.16, fore + 0.16],
    pavilionEaves,
    pavilionRidge,
    lod,
  );
  rotundaFinial(out, (left + right) / 2, pavilionRidge, (back + fore) / 2, lod);
}

function gabledHallRoof(out, bounds, bottom, ridge, lod) {
  const [left, right, back, fore] = bounds;
  const mid = (left + right) / 2;
  for (const [x, color] of [
    [left, colors.roofShadow],
    [right, colors.roof],
  ]) {
    face(
      out,
      'roof',
      [
        [x, bottom, back],
        [x, bottom, fore],
        [mid, ridge, fore],
        [mid, ridge, back],
      ],
      up,
      color,
    );
  }
  for (const z of [back, fore]) {
    const outward = [0, 0, z === fore ? 1 : -1];
    face(
      out,
      'wall',
      [
        [left, bottom, z],
        [right, bottom, z],
        [mid, ridge, z],
      ],
      outward,
      colors.ivory,
    );
    if (lod === 0) continue;
    const offset = z + outward[2] * 0.03;
    const center = [mid, bottom + (ridge - bottom) * 0.44, offset];
    const count = lod > 1 ? 12 : 6;
    const r = 0.52;
    const at = (i, scale = 1) => {
      const a = (2 * Math.PI * i) / count;
      return [mid + r * scale * Math.cos(a), center[1] + r * scale * Math.sin(a), offset];
    };
    for (let i = 0; i < count; i++) {
      const a = at(i, 0.77),
        b = at(i + 1, 0.77);
      face(out, 'detail', [center, a, b], outward, colors.pane);
      face(out, 'trim', [a, b, at(i + 1), at(i)], outward, colors.ivory);
    }
    if (lod > 1) {
      for (let i = 0; i < count; i += 2) {
        const end = at(i, 0.74);
        beam(
          out,
          'trim',
          [mid, center[1], offset + outward[2] * 0.02],
          [end[0], end[1], offset + outward[2] * 0.02],
          0.044,
          0.045,
          colors.trim,
        );
      }
    }
  }
}

function entrance(out, lod) {
  const west = porchCenter - 11.75,
    east = porchCenter + 11.75;
  const back = -8.26,
    fore = frontZ - 0.82;
  const ring = rect(west, east, back, fore);
  const gallery = edge(ring[2], ring[3]);
  for (const f of frames(ring).filter((_, i) => i !== 2))
    solidRange(out, f, firstCornice, entranceRoof, lod);
  cap(out, 'deck', ring, entranceRoof, colors.deck);
  const mid = gallery.length / 2;
  const rise = 1.22;
  panel(out, 'wall', gallery, 0, gallery.length, firstCornice, entranceRoof, -0.24, colors.wall);
  for (const offset of [-7.46, 0, 7.46]) {
    const u = mid + offset;
    const pointed = offset === 0;
    const half = pointed ? 1.62 : 1.42;
    panel(
      out,
      'detail',
      gallery,
      u - half,
      u + half,
      firstCornice + 0.58,
      entranceRoof - 0.84,
      -0.198,
      colors.wood,
    );
    arch(
      out,
      gallery,
      u,
      half,
      firstCornice + 0.42,
      entranceRoof - 1.87,
      rise,
      entranceRoof,
      0,
      lod,
      pointed,
    );
    if (lod > 1) {
      for (const dx of [-0.72, -0.36, 0, 0.36, 0.72])
        beam(
          out,
          'trim',
          gallery.at(u + dx, firstCornice + 0.54, 0.062),
          gallery.at(u + dx, entranceRoof - 0.88 - Math.abs(dx) * 0.31, 0.067),
          0.07,
          0.08,
          colors.ivory,
        );
      for (const drop of [2.1, 2.48])
        molding(
          out,
          'trim',
          gallery,
          u - half,
          u + half,
          entranceRoof - drop,
          entranceRoof - drop + 0.065,
          0.066,
          colors.trim,
        );
    }
  }
  for (const f of frames(ring)) {
    molding(
      out,
      'trim',
      f,
      0,
      f.length,
      entranceRoof - 0.16,
      entranceRoof + 0.11,
      0.13,
      colors.trim,
    );
    balustrade(out, f, 0.08, f.length - 0.08, entranceRoof + 0.09, lod);
  }
  for (const [x, z] of ring) rotundaFinial(out, x, entranceRoof + 0.98, z, lod);
  gabledHallRoof(
    out,
    [west + 4.4, east - 4.4, back + 1.25, fore - 0.89],
    entranceRoof + 0.05,
    entranceRoof + 1.86,
    lod,
  );
}

function gradeAt(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const row = (k) =>
    terrain.heightsMeters[k][i] +
    (terrain.heightsMeters[k][i + 1] - terrain.heightsMeters[k][i]) * (u - i);
  return row(j) + (row(j + 1) - row(j)) * (v - j) - terrain.modelDatumElevationMeters;
}

function forecourt(out, lod) {
  const stepFront = map.geometry.centerlines[0][1][1];
  const stepWidth = 7.12;
  const stairStart = gradeAt(porchCenter, stepFront) - 0.09;
  const steps = lod > 0 ? 9 : 4;
  for (let i = 0; i < steps; i++) {
    const y = stairStart + ((groundFloor - stairStart) * (i + 1)) / steps;
    const z = stepFront - ((stepFront - frontZ) * i) / steps;
    box(
      out,
      'deck',
      [porchCenter - stepWidth / 2, foundation, frontZ - 0.1],
      [porchCenter + stepWidth / 2, y, z],
      colors.paving,
    );
  }
  const mapped = map.features.find(({ id }) => id === 'way/1134548507').points;
  const ring = lod === 0 ? mapped.filter((_, i) => i % 2 === 0) : mapped;
  const center = [-20.812, 17.19];
  const inside = ring.map((p) => p.map((v, i) => center[i] + (v - center[i]) * 0.8));
  const floor = gradeAt(...center);
  cap(out, 'detail', inside, floor + 0.22, colors.water);
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    const f = edge(ring[i], ring[j]);
    panel(out, 'base', f, 0, f.length, floor - 0.34, floor + 0.44, 0, colors.cool);
    face(
      out,
      'trim',
      [ring[i], ring[j], inside[j], inside[i]].map((p) => pointOn(p, floor + 0.44)),
      up,
      colors.ivory,
    );
    const reverse = edge(inside[j], inside[i]);
    panel(out, 'trim', reverse, 0, reverse.length, floor + 0.13, floor + 0.44, 0, colors.plaster);
  }
  const collar =
    lod === 0
      ? [
          [0.22, 0.49],
          [0.45, 0.26],
          [1.12, 0.4],
        ]
      : [
          [0.22, 0.49],
          [0.36, 0.49],
          [0.45, 0.26],
          [0.89, 0.18],
          [1.01, 0.4],
          [1.12, 0.4],
        ];
  loft(
    out,
    'trim',
    collar.map(([y, r]) => radialRing(floor + y, r, r, [5, 8, 12, 16][lod], center)),
    colors.trim,
  );
}

function reliefMedallions(out, lod) {
  for (const offset of [-5.76, 0, 5.76]) {
    const [x, y, z] = front.at(porchU + offset, firstFloor - 0.47, 0.24);
    const sides = lod > 2 ? 16 : 8;
    for (let i = 0; i < sides; i++) {
      const a = (2 * Math.PI * i) / sides,
        b = (2 * Math.PI * (i + 1)) / sides;
      const points = [
        [x, y, z + 0.04],
        [x + 0.27 * Math.cos(a), y + 0.27 * Math.sin(a), z],
        [x + 0.27 * Math.cos(b), y + 0.27 * Math.sin(b), z],
      ];
      face(out, 'trim', points, front.n, colors.ivory);
    }
  }
}

function secondaryWings(out, lod) {
  for (const f of frames(northWing)) solidRange(out, f, firstFloor - 0.16, 8.97, lod);
  hip(out, [23.05, 36.18, -8.55, 0.14], 8.97, 11.01, lod);
  for (const f of frames(rearRoof)) solidRange(out, f, firstFloor - 0.1, 9.43, lod);
  hip(out, [-45.02, -2.51, -12.78, -5.39], 9.43, 11.48, lod);
}

function distant(out) {
  plinth(out, 0);
  cap(out, 'deck', outline, firstFloor, colors.deck);
  for (const [i, f] of frames(outline).entries()) {
    if (i === 13 || i === 14) continue;
    solidRange(out, f, groundFloor, firstFloor, 0);
  }
  cap(out, 'deck', upperFootprint, firstCornice, colors.deck);
  for (const [i, f] of frames(upperFootprint).entries()) {
    if (i !== 2) solidRange(out, f, firstFloor, firstCornice, 0);
  }
  for (const [a, b, n] of [
    [0, porchU - 8, 5],
    [porchU - 8, porchU + 8, 3],
    [porchU + 8, front.length, 3],
  ]) {
    panel(out, 'wall', front, a, b, groundFloor, firstCornice, -0.06, colors.ivory);
    for (let i = 0; i < n; i++) {
      const u = a + ((b - a) * (i + 0.5)) / n;
      for (const y of [groundFloor, firstFloor]) {
        const half = 1.2;
        const points = curve(front, u, half, y + 2.44, 1.22, 4, 0.02);
        panel(out, 'detail', front, u - half, u + half, y + 0.28, y + 2.44, 0.02, colors.pane);
        for (let j = 0; j < points.length - 2; j++)
          face(out, 'detail', [points[0], points[j + 1], points[j + 2]], front.n, colors.pane);
      }
    }
    molding(out, 'trim', front, a, b, firstFloor - 0.2, firstFloor + 0.1, 0.19, colors.trim);
    molding(out, 'trim', front, a, b, firstCornice - 0.32, firstCornice + 0.86, 0.14, colors.trim);
  }
  secondaryWings(out, 0);
  pavilion(out, -43.75, -35.03, -5.44, 4.36, 0);
  pavilion(out, 0.93, 9.65, -5.44, 4.36, 0);
  entrance(out, 0);
  forecourt(out, 0);
}

function build(out, lod) {
  if (lod === 0) return distant(out);
  plinth(out, lod);
  cap(out, 'deck', outline, firstFloor, colors.deck);
  const sides = frames(outline);
  for (const [i, f] of sides.entries()) {
    if (i === 13 || i === 14) continue;
    if ([0, 1, 5, 7, 15, 16].includes(i))
      arcade(
        out,
        f,
        [0, f.length, Math.max(1, Math.round(f.length / 5.5))],
        groundFloor,
        firstFloor,
        lod,
      );
    else solidRange(out, f, groundFloor, firstFloor, lod);
  }
  const porchHalfWidth = 8.7;
  for (const run of [
    [0, porchU - porchHalfWidth, 7],
    [porchU - porchHalfWidth, porchU + porchHalfWidth, 3],
    [porchU + porchHalfWidth, front.length, 3],
  ]) {
    arcade(out, front, run, groundFloor, firstFloor, lod);
    arcade(out, front, run, firstFloor, firstCornice, lod, true);
  }
  cap(out, 'deck', upperFootprint, firstCornice, colors.deck);
  for (const [i, f] of frames(upperFootprint).entries()) {
    if (i !== 2) solidRange(out, f, firstFloor, firstCornice, lod);
    balustrade(out, f, 0.12, f.length - 0.12, firstCornice, lod);
  }
  secondaryWings(out, lod);
  pavilion(out, -43.75, -35.03, -5.44, 4.36, lod);
  pavilion(out, 0.93, 9.65, -5.44, 4.36, lod);
  entrance(out, lod);
  reliefMedallions(out, lod);
  forecourt(out, lod);
}

export const agaKhanSkyline = (out) => build(out, 0);
export const agaKhanDistrict = (out) => build(out, 1);
export const agaKhanStreet = (out) => build(out, 2);
export const agaKhanCloseup = (out) => build(out, 3);

const recipe = 'aga-khan-palace-model.mjs';
const camera = [-70, 31, 82];
const lookAt = [-8, 6.2, -1.7];
export const agaKhanModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  wikidataId: plan.wikidataId,
  cell: plan.cell,
  recipe,
  surfaces,
  category: 'landmark',
  build: agaKhanCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  buildingCutout: {
    outline,
    minimumCoverage: 0.995,
    basis:
      'The original named palace footprint, with separately mapped estate structures retained.',
  },
  brief:
    'Standing Aga Khan Palace in Pune, with deep Italianate arcades above a dark stone plinth, an embellished entrance, terracotta pavilion roofs and the mapped forecourt fountain.',
  camera,
  lookAt,
  sunDirection: [-32, 34, 53],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1.6,
    cameraYaw: -0.33,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'east-front-terracotta-pavilions', position: [-18, 17, 91], lookAt: [-8, 6, 0] },
    { name: 'three-entrance-arches-and-jali', position: [-28, 7.5, 38], lookAt: [-21, 8, 5] },
    { name: 'two-storeys-of-open-verandas', position: [-58, 8, 27], lookAt: [-26, 5.6, 4.5] },
    { name: 'west-range-and-elevation', position: [65, 31, -65], lookAt: [-4, 5, -8] },
    { name: 'palace-forecourt-fountain-and-stair', position: [3, 19, 46], lookAt: [-21, 1.2, 10] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `aga-khan-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'agaKhanSkyline',
    errorMeters: 0.85,
    surfaces,
    authoredLevels: {
      district: { export: 'agaKhanDistrict', errorMeters: 0.39, surfaces },
      street: { export: 'agaKhanStreet', errorMeters: 0.17, surfaces },
      closeup: { export: 'agaKhanCloseup', errorMeters: 0.07, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry based on written Pune architecture surveys, ODbL OpenStreetMap geography and openly attributed Terrarium elevation.',
};
