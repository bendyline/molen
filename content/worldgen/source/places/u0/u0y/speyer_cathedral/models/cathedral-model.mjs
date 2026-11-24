import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  wall: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.94 },
  trim: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.92 },
  slates: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.88 },
  copper: { slot: 'trim', graph: 'metal_copper', roughness: 0.86 },
  foundation: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.95 },
  timber: { slot: 'door', graph: 'wood_shou_sugi_ban', roughness: 0.9 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.9 },
};

const colors = Object.fromEntries(
  Object.entries({
    ashlar: 'bd927c',
    band: 'c6a483',
    dressed: 'd4b49b',
    west: 'c8a88e',
    brown: 'a57a64',
    dark: '49413b',
    seamRoof: '819d95',
    copper: '799b8d',
    patina: '8aa99b',
    westCap: 'a5a39a',
    footing: 'aa978c',
    door: '564235',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const angle = (site.planAngleDegrees * Math.PI) / 180;
const sin = Math.sin(angle),
  cos = Math.cos(angle);
const world = (x, y, z) => [x * cos - z * sin, y, x * sin + z * cos];
const box = (x0, x1, z0, z1) => [
  [x0, z0],
  [x0, z1],
  [x1, z1],
  [x1, z0],
];
const part = new Map(site.parts.map((value) => [value.id, value]));

function ccw(ring) {
  const area = ring.reduce((sum, [x, z], i) => {
    const [u, v] = ring[(i + 1) % ring.length];
    return sum + x * v - z * u;
  }, 0);
  return area < 0 ? ring : ring.toReversed();
}

function bounds(ring) {
  const x = ring.map((p) => p[0]),
    z = ring.map((p) => p[1]);
  return [Math.min(...x), Math.max(...x), Math.min(...z), Math.max(...z)];
}

function face(out, slot, points, color, normal) {
  let p = points.map((q) => world(...q).map(Math.fround));
  if (normal && normalFor(...p).reduce((s, v, i) => s + v * normal[i], 0) < 0) p = p.toReversed();
  for (let i = 1; i + 1 < p.length; i++) {
    const tri = [p[0], p[i], p[i + 1]],
      n = normalFor(...tri);
    if (Math.hypot(...n) > 0.9) out.addTriangle(slot, '', tri, n, [], color);
  }
}

function cap(out, slot, ring, height, color) {
  const scratch = new MeshBufferBuilder();
  if (
    !scratch.addCap(
      'foundation',
      'palette:#ffffff',
      ring,
      [],
      () => height,
      [0, 1, 0],
      (p) => p,
      color,
    )
  )
    throw new Error('Invalid Speyer roof or foundation outline');
  const { positions, indices } = scratch.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const q = [0, 1, 2].map((j) => 3 * indices[i + j]);
    face(
      out,
      slot,
      q.map((k) => [positions[k], height, positions[k + 2]]),
      color,
    );
  }
}

function wall(out, slot, ring, floor, top, color) {
  for (let i = 0; i < ring.length; i++) {
    const [x, z] = ring[i],
      [u, v] = ring[(i + 1) % ring.length];
    face(
      out,
      slot,
      [
        [x, floor, z],
        [u, floor, v],
        [u, top, v],
        [x, top, z],
      ],
      color,
    );
  }
}

function deck(out, slot, ring, floor, top, color) {
  wall(out, slot, ring, floor, top, color);
  cap(out, slot, ring, top, color);
}

function center(ring) {
  return [0, 1].map((axis) => ring.reduce((sum, p) => sum + p[axis], 0) / ring.length);
}

function scaled(ring, scale, [u, v]) {
  return ring.map(([x, z]) => [u + scale * (x - u), v + scale * (z - v)]);
}

function profile(out, slot, ring, rings, color, shift = center(ring), capTop = false) {
  const coordinates = rings.map(([y, s]) => scaled(ring, s, shift).map(([x, z]) => world(x, y, z)));
  loft(out, slot, coordinates, color, { cap: capTop });
}

function band(out, ring, height, thickness, projection, color) {
  const shift = center(ring);
  profile(
    out,
    'trim',
    ring,
    [
      [height - thickness, 1],
      [height - thickness * 0.6, projection],
      [height, projection],
      [height + thickness * 0.22, 1],
    ],
    color,
    shift,
  );
}

function block(out, slot, x0, x1, z0, z1, y0, y1, color) {
  deck(out, slot, box(x0, x1, z0, z1), y0, y1, color);
}

// The window and gallery frames use the outward direction of the masonry run.
function facade([x, z], [u, v]) {
  const span = Math.hypot(u - x, v - z);
  const dx = (u - x) / span,
    dz = (v - z) / span;
  return {
    span,
    normal: world(-dz, 0, dx),
    point: (p, y, q = 0) => [x + p * dx - q * dz, y, z + p * dz + q * dx],
  };
}

function arc(radius, base, rise, count) {
  return Array.from({ length: count + 1 }, (_, i) => {
    const a = Math.PI * (1 - i / count);
    return [radius * Math.cos(a), base + Math.sin(a) * rise];
  });
}

function opening(out, wall, offset, base, width, shaft, rise, detail, door = false) {
  const { point, normal } = wall,
    r = width / 2;
  const curve = arc(r, base + shaft, rise, detail >= 2 ? 8 : 4);
  const ring = [[r, base], [-r, base], ...curve];
  face(
    out,
    door ? 'timber' : 'glass',
    ring.map(([u, y]) => point(offset + u, y, 0.025)),
    door ? colors.door : colors.dark,
    normal,
  );
  if (detail < 2) return;
  const outer = arc(r + 0.19, base + shaft, rise + 0.19, 8);
  const trim = (a, b, c, d) =>
    face(
      out,
      'trim',
      [a, b, c, d].map(([u, y]) => point(offset + u, y, 0.17)),
      colors.dressed,
      normal,
    );
  for (let i = 0; i < 8; i++) trim(curve[i], curve[i + 1], outer[i + 1], outer[i]);
  for (const sign of [-1, 1]) {
    trim(
      [sign * r, base],
      [sign * r, base + shaft],
      [sign * (r + 0.19), base + shaft],
      [sign * (r + 0.19), base],
    );
  }
}

function bays(out, a, b, count, y, width, shaft, rise, detail) {
  const side = facade(a, b);
  for (let i = 0; i < count; i++)
    opening(out, side, ((i + 0.5) * side.span) / count, y, width, shaft, rise, detail);
}

function gable(out, x0, x1, z0, z1, eave, ridge, crosswise = false, detail = 0) {
  const p = crosswise ? (x, y, z) => [z, y, x] : (x, y, z) => [x, y, z];
  const mid = (z0 + z1) / 2;
  const a = p(x0, eave, z0),
    b = p(x1, eave, z0),
    c = p(x1, eave, z1),
    d = p(x0, eave, z1);
  const m = p(x0, ridge, mid),
    n = p(x1, ridge, mid);
  face(out, 'slates', [a, b, n, m], colors.seamRoof, [0, 1, 0]);
  face(out, 'slates', [m, n, c, d], colors.seamRoof, [0, 1, 0]);
  face(out, 'wall', [a, m, d], colors.ashlar, crosswise ? world(0, 0, -1) : world(-1, 0, 0));
  face(out, 'wall', [b, c, n], colors.ashlar, crosswise ? world(0, 0, 1) : world(1, 0, 0));
  if (detail < 3) return;
  beam(out, 'slates', world(...m), world(...n), 0.21, 0.19, colors.seamRoof);
  const length = x1 - x0;
  const count = Math.floor(length / 2.4);
  for (let i = 0; i < count; i++) {
    const x = x0 + ((i + 0.5) * length) / count;
    for (const z of [z0, z1]) {
      beam(
        out,
        'slates',
        world(...p(x, eave + 0.04, z)),
        world(...p(x, ridge + 0.04, mid)),
        0.048,
        0.05,
        colors.seamRoof,
      );
    }
  }
}

function cross(out, x, y, z, scale) {
  beam(
    out,
    'copper',
    world(x, y, z),
    world(x, y + 3 * scale, z),
    0.14 * scale,
    0.14 * scale,
    colors.patina,
  );
  beam(
    out,
    'copper',
    world(x - scale * 0.83, y + 2.08 * scale, z),
    world(x + scale * 0.83, y + 2.08 * scale, z),
    0.13 * scale,
    0.13 * scale,
    colors.patina,
  );
}

function tower(out, id, detail) {
  const features = part.get(id),
    eave = features.height - features.roofHeight;
  const [x0, x1, z0, z1] = bounds(features.outline),
    ring = box(x0, x1, z0, z1),
    [x, z] = center(ring);
  wall(out, 'wall', ring, 0, eave, colors.ashlar);
  profile(
    out,
    'copper',
    ring,
    [
      [eave - 0.24, 1.065],
      [eave + 0.9, 0.93],
      [features.height - 0.79, 0.098],
      [features.height, 0.018],
    ],
    colors.copper,
    [x, z],
    true,
  );
  if (detail === 0) return;
  cross(out, x, features.height - 0.05, z, 0.8);
  for (const height of [eave - 18.5, eave - 9.7, eave - 0.65])
    band(out, ring, height, 0.49, 1.07, colors.band);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const { span, point, normal } = facade(a, b);
    const inset = span * 0.13;
    const left = point(inset, eave - 0.25, 0.17);
    const right = point(span - inset, eave - 0.25, 0.17);
    const crest = point(span / 2, eave + features.roofHeight * 0.39, 0.17);
    const ridge = point(span / 2, crest[1], -span * 0.22);
    face(out, 'wall', [left, right, crest], colors.ashlar, normal);
    face(out, 'copper', [left, crest, ridge], colors.patina, [0, 1, 0]);
    face(out, 'copper', [right, ridge, crest], colors.copper, [0, 1, 0]);
    bays(out, a, b, 2, eave - 7.4, 1.47, 3.53, 0.73, detail);
    bays(out, a, b, 2, eave - 16.1, 1.2, 3.21, 0.59, detail);
    if (detail >= 2) bays(out, a, b, 1, eave - 24.2, 1.07, 2.92, 0.53, detail);
    face(
      out,
      'glass',
      [
        point(span / 2 - 0.26, eave + 0.64, 0.187),
        point(span / 2 + 0.26, eave + 0.64, 0.187),
        point(span / 2, eave + 1.44, 0.187),
      ],
      colors.dark,
      normal,
    );
  }
}

function cupola(out, id, east, detail) {
  const p = part.get(id),
    ring = ccw(p.outline),
    eave = p.height - p.roofHeight;
  const c = center(ring);
  wall(out, 'wall', ring, p.minHeight, eave, colors.west);
  const roof = east
    ? [
        [eave - 0.08, 1.037],
        [eave + 2.18, 0.91],
        [eave + 4.95, 0.67],
        [eave + 6.95, 0.33],
        [p.height, 0.055],
      ]
    : [
        [eave - 0.08, 1.04],
        [eave + 0.93, 0.88],
        [eave + 4.57, 0.25],
        [p.height, 0.035],
      ];
  profile(
    out,
    east ? 'copper' : 'slates',
    ring,
    roof,
    east ? colors.patina : colors.westCap,
    c,
    true,
  );
  if (detail === 0) return;
  band(out, ring, eave - 0.45, 0.62, 1.045, colors.dressed);
  band(out, ring, eave - 6.2, 0.46, 1.035, colors.band);
  cross(out, c[0], p.height - 0.05, c[1], 0.86);
  for (let i = 0; i < ring.length; i++)
    bays(
      out,
      ring[i],
      ring[(i + 1) % ring.length],
      east ? 3 : 2,
      eave - 4.66,
      east ? 0.91 : 1.13,
      1.7,
      0.5,
      detail,
    );
}

function ends(out, detail) {
  const west = part.get(504850107);
  const [x0, x1, z0, z1] = bounds(west.outline),
    ring = box(x0, x1, z0, z1);
  deck(out, 'wall', ring, 0, 29.8, colors.west);
  gable(out, x0 - 0.13, x1 + 0.15, z0 - 0.25, z1 + 0.25, 29.8, 37.2, false, detail);
  block(out, 'wall', x0 - 0.18, x0 + 0.4, z0 + 8, z1 - 8, 0, 32, colors.west);
  gable(out, z0 + 8, z1 - 8, x0 - 0.25, x0 + 8.8, 32, 38.9, true, detail);
  if (detail === 0) return;
  const westFront = facade([x0 - 0.18, z0], [x0 - 0.18, z1]);
  for (const [offset, width, top] of [
    [8, 3.15, 4.1],
    [19.6, 5.9, 6.7],
    [31, 3.15, 4.1],
  ]) {
    opening(out, westFront, offset, 0.09, width, top, width / 2, detail, true);
    if (detail >= 2) {
      for (const sign of [-1, 1]) {
        const z = z0 + offset + sign * (width / 2 + 0.34);
        block(out, 'trim', x0 - 0.61, x0 + 0.07, z - 0.2, z + 0.2, 0.08, top + 0.2, colors.dressed);
      }
    }
  }
  const rose = (n, r) =>
    Array.from({ length: n }, (_, i) => {
      const a = (2 * Math.PI * i) / n;
      return [z0 + 19.6 + r * Math.cos(a), 20.7 + r * Math.sin(a)];
    });
  const count = detail >= 2 ? 20 : 10;
  const inner = rose(count, 3.32),
    outer = rose(count, 3.87);
  face(
    out,
    'glass',
    inner.map(([z, y]) => [x0 - 0.2, y, z]),
    colors.dark,
    westFront.normal,
  );
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    face(
      out,
      'trim',
      [inner[i], outer[i], outer[j], inner[j]].map(([z, y]) => [x0 - 0.28, y, z]),
      colors.dressed,
      westFront.normal,
    );
    if (detail >= 2 && i % 2 === 0)
      beam(
        out,
        'trim',
        world(x0 - 0.3, 20.7, z0 + 19.6),
        world(x0 - 0.3, inner[i][1], inner[i][0]),
        0.18,
        0.16,
        colors.band,
      );
  }
  for (const y of [9.1, 14.5, 24.4]) band(out, ring, y, 0.46, 1.017, colors.band);
  bays(out, [x0 - 0.19, z0 + 8], [x0 - 0.19, z1 - 8], 7, 27, 0.91, 1.72, 0.5, detail);
  const outerFront = facade([x0, z0], [x0, z1]);
  for (const offset of [4.05, 34.4]) {
    opening(out, outerFront, offset, 18.3, 1.54, 4.1, 0.74, detail);
    const course = colors.band;
    for (const y of [15.4, 16.8, 23.8, 25.8]) {
      face(
        out,
        'trim',
        [
          outerFront.point(offset - 3.5, y, 0.09),
          outerFront.point(offset + 3.5, y, 0.09),
          outerFront.point(offset + 3.5, y + 0.19, 0.09),
          outerFront.point(offset - 3.5, y + 0.19, 0.09),
        ],
        course,
        outerFront.normal,
      );
    }
  }
}

function apse(out, detail) {
  const p = part.get(504842321),
    ref = ccw(p.outline),
    c = center(ref);
  const ring = detail === 0 ? ref.filter((_, i) => i % 2 === 0) : ref;
  const eave = p.height - p.roofHeight;
  const galleryY = eave - 3.5;
  wall(out, 'wall', ring, 0, detail >= 2 ? galleryY : eave, colors.ashlar);
  if (detail >= 2) {
    const core = scaled(ring, 0.8, c);
    wall(out, 'wall', core, galleryY - 0.08, eave + 0.04, colors.brown);
    cap(out, 'trim', ring, galleryY + 0.03, colors.dressed);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      if (a[0] < c[0] && b[0] < c[0]) continue;
      const { point, normal, span } = facade(a, b);
      const r = span / 2;
      const starts = arc(r - 0.16, eave - 1.4, 0.8, 5);
      for (let j = 0; j < starts.length - 1; j++) {
        const [x0, y0] = starts[j],
          [x1, y1] = starts[j + 1];
        face(
          out,
          'trim',
          [point(r + x0, y0), point(r + x1, y1), point(r + x1, eave), point(r + x0, eave)],
          colors.dressed,
          normal,
        );
      }
      const postRing = Array.from({ length: 8 }, (_, j) => {
        const a = (-j * Math.PI) / 4;
        return [b[0] + 0.15 * Math.cos(a), b[1] + 0.15 * Math.sin(a)];
      });
      profile(
        out,
        'trim',
        postRing,
        [
          [galleryY, 1.33],
          [galleryY + 0.22, 1],
          [eave - 1.4, 1],
          [eave - 1.22, 1.36],
        ],
        colors.band,
        [b[0], b[1]],
      );
      face(
        out,
        'trim',
        [point(0, eave - 1.4), point(0.16, eave - 1.4), point(0.16, eave), point(0, eave)],
        colors.dressed,
        normal,
      );
      face(
        out,
        'trim',
        [
          point(span - 0.16, eave - 1.4),
          point(span, eave - 1.4),
          point(span, eave),
          point(span - 0.16, eave),
        ],
        colors.dressed,
        normal,
      );
    }
  }
  profile(
    out,
    'slates',
    ring,
    [
      [eave, 1.038],
      [eave + 5.5, 0.44],
      [p.height, 0.04],
    ],
    colors.seamRoof,
    [c[0] - 2.45, c[1]],
    true,
  );
  if (detail === 0) return;
  for (const y of [2.4, 9.0, galleryY - 0.11, eave]) band(out, ring, y, 0.42, 1.032, colors.band);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    if (a[0] < c[0] || i % 3 !== 0) continue;
    bays(out, a, b, 1, 11.3, 0.94, 4.13, 0.48, detail);
  }
}

function church(out, detail) {
  const baseRing = ccw(site.plan);
  if (detail > 0) deck(out, 'foundation', baseRing, -4.5, 0.075, colors.footing);
  const westX = -50.26,
    transeptX = 25.75,
    eastX = 43.98,
    centerZ = -3.35;
  const nave = ccw(part.get(504842326).outline);
  const [nx0, nx1, nz0, nz1] = bounds(nave);
  const bodyRing = box(westX, nx1, nz0, nz1);
  wall(out, 'wall', bodyRing, 0, 32, colors.ashlar);
  gable(out, nx0 - 0.13, nx1 + 0.25, nz0 - 0.18, nz1 + 0.18, 32, 40, false, detail);

  const transept = part.get(504842325);
  const [tx0, tx1, tz0, tz1] = bounds(transept.outline);
  wall(out, 'wall', box(tx0, tx1, tz0, tz1), 0, 32, colors.ashlar);
  gable(out, tz0 - 0.2, tz1 + 0.2, tx0 - 0.2, tx1 + 0.2, 32, 40, true, detail);

  const aisle = ccw(part.get(504968017).outline);
  const [, , az0, az1] = bounds(aisle);
  wall(out, 'wall', aisle, 0, 14, colors.ashlar);
  for (const [zOuter, zInner, desired] of [
    [az0, nz0, -1],
    [az1, nz1, 1],
  ]) {
    const x0 = westX - 0.17,
      x1 = transeptX + 0.14;
    const a = [x0, 14, zOuter],
      b = [x1, 14, zOuter],
      c = [x1, 23, zInner],
      d = [x0, 23, zInner];
    face(out, 'slates', [a, b, c, d], colors.seamRoof, [0, 1, 0]);
    face(out, 'wall', [a, [x0, 14, zInner], d], colors.ashlar, world(-1, 0, 0));
    face(out, 'wall', [b, c, [x1, 14, zInner]], colors.ashlar, world(1, 0, 0));
    if (detail === 0) continue;
    const pair = (a, b) => (desired > 0 ? [a, b] : [b, a]);
    bays(out, ...pair([westX, zOuter], [transeptX, zOuter]), 9, 6.06, 1.83, 3.09, 0.92, detail);
    bays(out, ...pair([westX + 4, zInner], [transeptX, zInner]), 9, 25.1, 1.47, 2.78, 0.73, detail);
    if (detail >= 2) {
      for (let i = 0; i <= 9; i++) {
        const x = westX + ((transeptX - westX) * i) / 9;
        block(
          out,
          'trim',
          x - 0.28,
          x + 0.28,
          zOuter - 0.39,
          zOuter + 0.39,
          0.08,
          13.72,
          colors.band,
        );
      }
    }
  }
  ends(out, detail);
  for (const id of [358676327, 358676347, 504842322, 504842323]) tower(out, id, detail);
  cupola(out, 358676384, false, detail);
  cupola(out, 504842324, true, detail);
  apse(out, detail);

  for (const id of [504968007, 504968010, 504968013]) {
    const { outline, height, roofHeight } = part.get(id);
    const ring = ccw(outline),
      [x0, x1, z0, z1] = bounds(ring);
    const y = height - roofHeight;
    wall(out, 'wall', ring, 0, y, colors.west);
    gable(out, x0 - 0.07, x1 + 0.05, z0 - 0.07, z1 + 0.07, y, height, false, detail);
    if (detail >= 1) {
      const z = id === 504968007 ? z0 : z1;
      const [a, b] =
        id === 504968007
          ? [
              [x1, z],
              [x0, z],
            ]
          : [
              [x0, z],
              [x1, z],
            ];
      bays(out, a, b, 4, 2, 0.9, 1.8, 0.45, detail);
    }
  }
  if (detail >= 1) {
    bays(out, [transeptX, tz1], [eastX, tz1], 3, 15, 1.99, 5.7, 0.99, detail);
    bays(out, [eastX, tz0], [transeptX, tz0], 3, 15, 1.99, 5.7, 0.99, detail);
    bays(out, [nx1, nz1], [nx1, nz0], 3, 27, 1.45, 2.39, 0.73, detail);
    band(out, bodyRing, 31.35, 0.39, 1.012, colors.band);
    band(out, box(tx0, tx1, tz0, tz1), 31.23, 0.48, 1.018, colors.band);
    beam(
      out,
      'slates',
      world(transeptX, 39.7, centerZ),
      world(eastX, 39.7, centerZ),
      0.12,
      0.19,
      colors.seamRoof,
    );
  }
}

export const buildSkyline = (out) => church(out, 0);
export const buildDistrict = (out) => church(out, 1);
export const buildStreet = (out) => church(out, 2);
export const buildCloseup = (out) => church(out, 3);
export const buildMaster = buildCloseup;
