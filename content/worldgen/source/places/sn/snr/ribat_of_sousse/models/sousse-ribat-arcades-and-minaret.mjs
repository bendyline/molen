import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  abox,
  facade,
  fan,
  fbox,
  lathe,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  rubble: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.98 },
  trim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.96 },
  course: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.96 },
  pavement: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.98 },
};

const sand = rgb('b3a080');
const galleryStone = rgb('bba888');
const dress = rgb('c4b08b');
const shade = rgb('625847');
const deckStone = rgb('a39783');
const start = -4.52;
const roof = 8.86;
const courtFloor = site.courtFloor;
const gateFace = wallFace(...site.gate.edge.map((i) => site.outline[i]));
const courtyard = site.court.map((a, i) => wallFace(a, site.court[(i + 1) % site.court.length]));
const at = (f, u, y, d) => f.P(u, y, d);
const xz = ([x, , z]) => [x, z];

function panel(out, slot, f, u, U, y, Y, d, color) {
  quad4(out, slot, at(f, u, y, d), at(f, U, y, d), at(f, U, Y, d), at(f, u, Y, d), color);
}

function roofWithCourt(out, outline, court) {
  const mesh = new MeshBufferBuilder();
  const material = 'palette:#ffffff';
  if (
    !mesh.addCap(
      'roof',
      material,
      outline,
      [court],
      () => roof,
      [0, 1, 0],
      (p) => p,
      deckStone,
    )
  )
    throw new Error('Could not triangulate the ribat roof around its courtyard');
  const { positions, indices } = mesh.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const points = Array.from(indices.slice(i, i + 3), (index) =>
      positions.slice(index * 3, index * 3 + 3),
    );
    out.addTriangle('pavement', material, points, [0, 1, 0], points.map(xz), deckStone);
  }
}

// Build a wall with real arched holes and masonry reveals behind its outside face.
function arcade(out, f, from, to, y, Y, doors, depth, segments, color) {
  let last = from;
  for (const { u, half, spring, sill = y } of doors) {
    const left = u - half;
    const right = u + half;
    if (left - last > 1e-4) panel(out, 'rubble', f, last, left, y, Y, 0, color);
    if (sill - y > 1e-4) panel(out, 'rubble', f, left, right, y, sill, 0, color);
    const arch = roundArch(half, segments).map(([x, h]) => [u + x, spring + h]);
    for (let i = 0; i < arch.length - 1; i++) {
      const [a, b] = arch[i];
      const [c, d] = arch[i + 1];
      quad4(out, 'rubble', at(f, a, b, 0), at(f, c, d, 0), at(f, c, Y, 0), at(f, a, Y, 0), color);
      quad4(
        out,
        'course',
        at(f, a, b, 0),
        at(f, a, b, -depth),
        at(f, c, d, -depth),
        at(f, c, d, 0),
        dress,
      );
    }
    quad4(
      out,
      'course',
      at(f, left, sill, 0),
      at(f, left, sill, -depth),
      at(f, left, spring, -depth),
      at(f, left, spring, 0),
      dress,
    );
    quad4(
      out,
      'course',
      at(f, right, sill, -depth),
      at(f, right, sill, 0),
      at(f, right, spring, 0),
      at(f, right, spring, -depth),
      dress,
    );
    if (sill - y > 1e-4)
      quad4(
        out,
        'course',
        at(f, left, sill, 0),
        at(f, right, sill, 0),
        at(f, right, sill, -depth),
        at(f, left, sill, -depth),
        dress,
      );
    last = right;
  }
  if (to - last > 1e-4) panel(out, 'rubble', f, last, to, y, Y, 0, color);
}

function stoneArchFrame(out, f, u, spring, half, width, depth, segments) {
  const inner = roundArch(half, segments);
  const outer = roundArch(half + width, segments);
  for (let i = 0; i < segments; i++) {
    const p = ([x, h], d) => at(f, u + x, spring + h, d);
    const a = inner[i],
      b = inner[i + 1],
      c = outer[i + 1],
      d = outer[i];
    quad4(out, 'trim', p(a, depth), p(b, depth), p(c, depth), p(d, depth), dress);
    quad4(out, 'trim', p(a, 0), p(b, 0), p(b, depth), p(a, depth), dress);
    quad4(out, 'trim', p(d, depth), p(c, depth), p(c, 0), p(d, 0), dress);
  }
}

function merlon(out, f, u, y, width, detail) {
  const half = width / 2,
    shoulder = y + 0.77,
    thickness = 0.45;
  if (detail === 0) {
    fbox(out, 'course', f, u - half, u + half, y, y + 0.77, -thickness, 0, dress);
    return;
  }
  const head = roundArch(half, detail > 1 ? 5 : 3).map(([x, h]) => [u + x, shoulder + h]);
  const front = 0,
    back = -thickness;
  const points = [[u - half, y], [u + half, y], ...head.slice().reverse()];
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = points[i],
      [c, d] = points[i + 1];
    quad4(
      out,
      'course',
      at(f, a, b, back),
      at(f, c, d, back),
      at(f, c, d, front),
      at(f, a, b, front),
      dress,
    );
  }
  const slit = 0.047;
  const edges =
    detail > 1
      ? [
          [u - half, u - slit],
          [u + slit, u + half],
        ]
      : [[u - half, u + half]];
  for (const d of [front, back]) {
    const pf = d === front ? f : facade(xz(at(f, 0, y, d)), [-f.along[0], -f.along[1]]);
    const sign = d === front ? 1 : -1;
    const face = (a, b, l, h) =>
      panel(
        out,
        'course',
        pf,
        Math.min(sign * a, sign * b),
        Math.max(sign * a, sign * b),
        l,
        h,
        0,
        dress,
      );
    for (const [a, b] of edges) face(a, b, y, shoulder);
    if (detail > 1) {
      face(u - slit, u + slit, y, y + 0.2);
      face(u - slit, u + slit, y + 0.64, shoulder);
    }
    const dome = head.map(([a, b]) => at(f, a, b, d));
    fan(out, 'course', d === front ? dome.slice().reverse() : dome, dress);
  }
  quad4(
    out,
    'course',
    at(f, u - half, shoulder, back),
    at(f, u - half, y, back),
    at(f, u - half, y, front),
    at(f, u - half, shoulder, front),
    dress,
  );
}

function circularMerlons(out, center, radius, y, angles, count, detail, width) {
  const [a, b] = angles;
  const circle = b - a > 6.27;
  for (let i = 0; i < count; i++) {
    const t = a + ((b - a) * (i + 0.5)) / count;
    const outward = [Math.cos(t), Math.sin(t)];
    const f = facade(
      [center[0] + outward[0] * radius, center[1] + outward[1] * radius],
      [outward[1], -outward[0]],
    );
    merlon(out, f, 0, y, width, detail);
  }
  if (circle && detail > 1) {
    const radii = [
      [y - 0.16, radius, radius],
      [y, radius, radius],
    ];
    lathe(out, 'trim', center, radii, 24, dress, { capTop: false });
  }
}

function exteriorWall(out, f, detail) {
  const u = f.length;
  if (detail > 1 && u > 7) {
    const count = Math.round(u / 6);
    const width = 0.17,
      bottom = 4.24,
      top = 5.34;
    panel(out, 'rubble', f, 0, u, start, bottom, 0, sand);
    panel(out, 'rubble', f, 0, u, top, roof, 0, sand);
    let last = 0;
    for (let i = 0; i < count; i++) {
      const x = ((i + 0.5) * u) / count;
      panel(out, 'rubble', f, last, x - width, bottom, top, 0, sand);
      fbox(out, 'course', f, x - width, x + width, bottom, top - 0.001, -0.24, -0.21, shade, {
        bottom: true,
      });
      quad4(
        out,
        'course',
        at(f, x - width, bottom, 0),
        at(f, x - width, bottom, -0.21),
        at(f, x - width, top, -0.21),
        at(f, x - width, top, 0),
        dress,
      );
      quad4(
        out,
        'course',
        at(f, x + width, bottom, -0.21),
        at(f, x + width, bottom, 0),
        at(f, x + width, top, 0),
        at(f, x + width, top, -0.21),
        dress,
      );
      last = x + width;
    }
    panel(out, 'rubble', f, last, u, bottom, top, 0, sand);
    for (let j = 1; j < Math.floor(u / 0.92); j++)
      stoneArchFrame(out, f, j * 0.92, roof - 0.52, 0.3, 0.085, 0.065, 4);
  } else panel(out, 'rubble', f, 0, u, start, roof, 0, sand);
  if (u < 3) return;
  if (detail > 0)
    fbox(out, 'trim', f, -0.015, u + 0.015, roof - 0.26, roof + 0.03, -0.45, 0.09, dress);
  if (detail === 0) {
    for (let i = 1; i < Math.floor(u / 4.7); i++) merlon(out, f, i * 4.7, roof, 0.95, 0);
  } else {
    const count = Math.max(2, Math.round(u / (detail === 1 ? 1.98 : 1.68)));
    for (let i = 0; i < count; i++)
      merlon(
        out,
        f,
        ((i + 0.5) * u) / count,
        roof,
        1.03,
        detail === 1 && f.normal[1] < 0.5 ? 0 : detail,
      );
  }
}

function gate(out, detail) {
  const span = gateFace.length;
  const mid = span / 2;
  const height = 11.37;
  const sill = site.gate.threshold;
  const domed = [{ u: mid, half: 0.82, spring: 2.72, sill }];
  const segments = detail === 0 ? 3 : detail === 1 ? 5 : 10;
  arcade(out, gateFace, 0, span, start, roof, domed, site.gate.inset + 0.48, segments, sand);
  const back = facade(xz(at(gateFace, span, 0, -site.gate.inset - 3.12)), [
    -gateFace.along[0],
    -gateFace.along[1],
  ]);
  const half = domed[0].half;
  const openingCurve = roundArch(half, segments);
  for (let i = 1; i < openingCurve.length; i++) {
    const [a, y] = openingCurve[i - 1],
      [b, Y] = openingCurve[i];
    const p = (x, h, d) => at(gateFace, mid + x, 2.72 + h, d);
    quad4(out, 'course', p(a, y, -1.53), p(a, y, -4.17), p(b, Y, -4.17), p(b, Y, -1.53), dress);
  }
  for (const s of [-1, 1])
    fbox(
      out,
      'rubble',
      gateFace,
      mid + s * half - 0.08,
      mid + s * half + 0.08,
      courtFloor,
      2.72,
      -4.17,
      -1.53,
      sand,
    );
  const side = site.gate.inset;
  fbox(out, 'rubble', gateFace, 0, span, roof, height, -2.89, 0, sand);
  fbox(out, 'trim', gateFace, -0.1, span + 0.1, height - 0.3, height, -3.0, 0.1, dress);
  fbox(out, 'trim', gateFace, 0, span, roof - 0.28, roof + 0.06, -side, 0.14, dress);
  if (detail > 0) {
    stoneArchFrame(out, gateFace, mid, 2.72, 0.82, 0.19, 0.123, segments);
    arcade(
      out,
      back,
      0,
      span,
      courtFloor,
      4.42,
      [{ u: mid, half: 0.81, spring: 2.15 }],
      0.58,
      segments,
      galleryStone,
    );
  }
  const domeCenter = xz(at(gateFace, mid, 0, -1.42));
  const domeSteps = detail < 2 ? 3 : 7;
  const dome = Array.from({ length: domeSteps + 1 }, (_, i) => {
    const angle = (i * Math.PI) / (2 * domeSteps);
    const r = i === domeSteps ? 0 : 1.37 * Math.cos(angle);
    return [height + 1.37 * Math.sin(angle), r, r];
  });
  lathe(out, 'trim', domeCenter, dome, detail < 2 ? 10 : 24, dress);
  const depth = 11.94,
    steps = detail === 0 ? 3 : 7;
  const landing = [
    [mid - 1.26, 0],
    [mid + 1.26, 0],
    [mid + 1.26, -depth],
    [mid - 1.26, -depth],
  ].map(([u, d]) => xz(at(gateFace, u, courtFloor, d)));
  cap(out, 'pavement', landing, courtFloor - 0.009, deckStone);
  for (let i = 0; i < steps; i++) {
    const length = ((i + 1) * depth) / steps;
    const level = sill - ((sill - courtFloor) * i) / (steps - 1);
    const front = (-i * depth) / steps;
    fbox(
      out,
      'pavement',
      gateFace,
      mid - 0.81,
      mid + 0.81,
      courtFloor - 0.16,
      level,
      -length,
      front,
      deckStone,
    );
  }
}

function courtSide(out, f, index, detail) {
  const count = index % 2 === 0 ? 5 : 4;
  const segments = [3, 3, 7, 9][detail];
  const stride = f.length / count;
  const portal = index === 2;
  const center = f.length / 2 + 0.23;
  const openings = Array.from({ length: count }, (_, i) => ({
    u: portal && i === 2 ? center : (i + 0.5) * stride,
    half: portal && i === 2 ? 1.08 : Math.min(1.29, stride * 0.32),
    spring: 1.87,
  }));
  arcade(out, f, 0, f.length, courtFloor, 3.58, openings, 0.66, segments, galleryStone);
  const floor = [
    [0, 0],
    [f.length, 0],
    [f.length, -3.19],
    [0, -3.19],
  ].map(([u, d]) => xz(at(f, u, courtFloor, d)));
  if (portal) {
    for (const [u, U] of [
      [0, center - 1.1],
      [center + 1.1, f.length],
    ]) {
      const platform = [
        [u, 0],
        [U, 0],
        [U, -3.19],
        [u, -3.19],
      ].map(([x, d]) => xz(at(f, x, courtFloor, d)));
      cap(out, 'pavement', platform, courtFloor, deckStone);
    }
  } else cap(out, 'pavement', floor, courtFloor, deckStone);
  fbox(out, 'trim', f, 0, f.length, 3.57, 3.86, -3.18, 0.21, dress);
  if (portal) {
    panel(out, 'rubble', f, 0, center - 1.1, courtFloor, 3.57, -3.18, shade);
    panel(out, 'rubble', f, center + 1.1, f.length, courtFloor, 3.57, -3.18, shade);
  } else panel(out, 'rubble', f, 0, f.length, courtFloor, 3.57, -3.18, shade);
  const upper = Array.from({ length: count }, (_, i) => ({
    u: (i + 0.5) * stride,
    half: 0.6,
    spring: 5.73,
    sill: 4.97,
  }));
  arcade(out, f, 0, f.length, 3.86, roof, upper, 0.44, segments, sand);
  panel(out, 'rubble', f, 0, f.length, 3.86, roof - 0.001, -1.1, shade);
  if (detail > 1) {
    for (const { u, half, spring } of [...openings, ...upper]) {
      stoneArchFrame(out, f, u, spring, half, 0.15, 0.047, segments);
    }
  }
}

function courtStair(out, detail) {
  const steps = detail > 1 ? 19 : 7;
  const width = 1.64;
  const x = site.court[1][0] - 0.14;
  const beginning = -1.18;
  const run = 11.46;
  for (let i = 0; i < steps; i++) {
    const z = beginning + (i * run) / steps;
    const y = courtFloor + ((i + 1) * (3.91 - courtFloor)) / steps;
    abox(
      out,
      'course',
      [x - width, y - 0.35, z],
      [x, y, beginning + ((i + 1) * run) / steps],
      dress,
    );
  }
  const edge = facade([x - width, beginning + run], [0, -1]);
  const high = 3.86;
  const low = courtFloor + 0.18;
  const slab = (u, y, d) => at(edge, u, y, d);
  quad4(
    out,
    'rubble',
    slab(0, high - 0.48, 0),
    slab(run, low - 0.48, 0),
    slab(run, low, 0),
    slab(0, high, 0),
    sand,
  );
  quad4(
    out,
    'rubble',
    slab(run, low - 0.48, -width),
    slab(0, high - 0.48, -width),
    slab(0, high, -width),
    slab(run, low, -width),
    sand,
  );
  quad4(
    out,
    'rubble',
    slab(run, low - 0.48, 0),
    slab(0, high - 0.48, 0),
    slab(0, high - 0.48, -width),
    slab(run, low - 0.48, -width),
    shade,
  );
  for (const [u, U] of [
    [0, 0.72],
    [3.46, 4.04],
    [6.85, 7.51],
  ]) {
    fbox(
      out,
      'rubble',
      edge,
      u,
      U,
      courtFloor,
      high - ((high - low) * u) / run - 0.31,
      -width,
      0,
      sand,
    );
  }
  for (let i = 0; i < steps; i++) {
    const z = (i * run) / steps;
    const y = 3.91 - (i * (3.91 - courtFloor)) / steps;
    fbox(
      out,
      'rubble',
      edge,
      z,
      z + run / steps,
      Math.max(courtFloor, y - 0.96),
      y + 0.49,
      -0.36,
      0,
      sand,
    );
  }
  abox(out, 'pavement', [x - width, 3.58, beginning + run], [x, 3.91, 12.45], deckStone);
}

function bastions(out, detail) {
  for (const { center, radius, angles, top } of site.bastions) {
    const shaft = top - 0.89;
    const sides = detail < 2 ? 10 : 24;
    const bands =
      detail < 2
        ? [
            [roof - 0.25, radius, radius],
            [shaft, radius + 0.1, radius + 0.1],
          ]
        : [
            [roof - 0.66, radius, radius],
            [roof - 0.45, radius + 0.13, radius + 0.13],
            [shaft - 0.15, radius + 0.13, radius + 0.13],
            [shaft, radius + 0.08, radius + 0.08],
          ];
    lathe(out, 'course', center, bands, sides, sand);
    circularMerlons(
      out,
      center,
      radius + 0.08,
      shaft,
      angles,
      detail === 0 ? 3 : detail === 1 ? 5 : 8,
      detail,
      detail > 1 ? 0.52 : 0.62,
    );
  }
}

function minaret(out, detail) {
  const center = site.tower.center;
  const F = facade(center, gateFace.along);
  const sides = [10, 16, 24, 36][detail];
  const rings =
    detail < 2
      ? [
          [roof, 2.12, 2.12],
          [22.83, 1.85, 1.85],
          [23.56, 1.97, 1.97],
        ]
      : [
          [roof, 2.11, 2.11],
          [9.22, 2.19, 2.19],
          [9.49, 2.11, 2.11],
          [17.58, 1.97, 1.97],
          [17.62, 2.04, 2.04],
          [17.88, 2.02, 2.02],
          [18.02, 1.96, 1.96],
          [22.32, 1.86, 1.86],
          [22.53, 1.94, 1.94],
          [22.74, 2.06, 2.06],
          [23.52, 2.04, 2.04],
        ];
  lathe(out, 'course', center, rings, sides, sand);
  circularMerlons(
    out,
    center,
    detail < 2 ? 1.97 : 2.04,
    23.52,
    [0, 2 * Math.PI],
    detail === 0 ? 5 : 10,
    detail,
    0.56,
  );
  const lantern = 0.83;
  const peak = site.tower.height;
  if (detail === 0) fbox(out, 'trim', F, -lantern, lantern, 23.53, 24.63, -lantern, lantern, dress);
  else {
    const points = [
      [-lantern, -lantern],
      [lantern, -lantern],
      [lantern, lantern],
      [-lantern, lantern],
    ].map(([u, d]) => xz(at(F, u, 0, d)));
    points.forEach((q, i) => {
      const f = wallFace(points[(i + 1) % points.length], q);
      arcade(
        out,
        f,
        0,
        f.length,
        23.52,
        24.61,
        [{ u: f.length / 2, half: 0.31, spring: 24.04, sill: 23.69 }],
        0.14,
        5,
        dress,
      );
    });
  }
  const eave = lantern + 0.14;
  const ring = [
    [-eave, -eave],
    [eave, -eave],
    [eave, eave],
    [-eave, eave],
  ].map(([u, d]) => at(F, u, 24.61, d));
  for (let i = 0; i < ring.length; i++) {
    tri(out, 'pavement', ring[(i + 1) % 4], ring[i], at(F, 0, peak, 0), deckStone);
  }
}

function build(out, detail) {
  const outline = site.outline;
  for (let i = 0; i < outline.length; i++) {
    if (i === site.gate.edge[1]) continue;
    const f = wallFace(outline[(i + 1) % outline.length], outline[i]);
    exteriorWall(out, f, detail);
  }
  roofWithCourt(out, outline, site.court);
  cap(out, 'pavement', site.court, courtFloor, deckStone);
  if (detail > 0) {
    for (const [i, f] of courtyard.entries()) courtSide(out, f, i, detail);
    courtStair(out, detail);
  } else {
    for (const f of courtyard) panel(out, 'rubble', f, 0, f.length, courtFloor, roof, 0, sand);
  }
  gate(out, detail);
  bastions(out, detail);
  minaret(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
