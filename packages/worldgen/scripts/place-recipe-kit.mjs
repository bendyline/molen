/**
 * Geometry vocabulary for dedicated place recipes emitted by place-master-emitter.mjs: oriented
 * facade planes, boxes and openings on any wall, concave extrusions with courtyards, ribbon
 * windows, gable roofs on any axis and polygonal towers. Units are metres in the bundle frame
 * (+Y up); slots are the recipe's surface names. Normals follow winding, so every face is
 * authored counterclockwise as seen from outside.
 */
import './install-deterministic-math.mjs';
import { normalize } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

export { rgb };

const REF = 'palette:#ffffff';
const UV3 = [
  [0, 0],
  [1, 0],
  [1, 1],
];
const UV4 = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];
const sub = (a, b) => a.map((v, i) => v - b[i]);
const cross3 = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const faceNormal = (a, b, c) => normalize(cross3(sub(b, a), sub(c, a)));

/** Triangle a→b→c, counterclockwise seen from the side it faces. */
export function tri(out, slot, a, b, c, color) {
  const n = faceNormal(a, b, c);
  if (!n.every(Number.isFinite)) return;
  out.addTriangle(slot, REF, [a, b, c], n, UV3, color);
}

/** Planar quad a→b→c→d, counterclockwise seen from the side it faces. */
export function quad4(out, slot, a, b, c, d, color) {
  const n = faceNormal(a, b, c);
  if (!n.every(Number.isFinite)) return;
  out.addQuad(slot, REF, [a, b, c, d], n, UV4, color);
}

/** Convex planar polygon, counterclockwise seen from the side it faces. */
export function fan(out, slot, points, color) {
  const n = faceNormal(points[0], points[1], points[2]);
  if (!n.every(Number.isFinite)) return;
  out.addConvexPolygon(slot, REF, points, n, () => [0, 0], color);
}

/**
 * A vertical facade plane. `origin` [x, z] is u = 0 on the wall line, `along` points to +u and
 * the outward normal is `along` turned clockwise seen from above (from +Y with +X right, +Z
 * down: +X along faces +Z). A viewer in front sees +u to their right. P(u, y, d) is the point
 * u along the wall, at height y, d metres in front of it. outwardRing() orders footprints so
 * wallFace(ring[i], ring[i + 1]) faces out.
 */
export function facade(origin, along) {
  const [ax, az] = normalize([along[0], 0, along[1]]).filter((_, i) => i !== 1);
  const nx = -az,
    nz = ax;
  const P = (u, y, d = 0) => [origin[0] + ax * u + nx * d, y, origin[1] + az * u + nz * d];
  return { P, along: [ax, az], normal: [nx, nz], origin };
}

/** The facade running from footprint point a to b (outside on the normal side). */
export function wallFace(a, b) {
  const f = facade(a, [b[0] - a[0], b[1] - a[1]]);
  return { ...f, length: Math.hypot(b[0] - a[0], b[1] - a[1]) };
}

/** Box in a facade frame: u0..u1 along, y0..y1 up, d0..d1 out from the wall. */
export function fbox(out, slot, F, u0, u1, y0, y1, d0, d1, color, { bottom = false } = {}) {
  const p = (u, y, d) => F.P(u, y, d);
  const A = p(u0, y0, d1),
    B = p(u1, y0, d1),
    C = p(u1, y1, d1),
    D = p(u0, y1, d1);
  const a = p(u0, y0, d0),
    b = p(u1, y0, d0),
    c = p(u1, y1, d0),
    d = p(u0, y1, d0);
  quad4(out, slot, A, B, C, D, color); // front
  quad4(out, slot, b, a, d, c, color); // back
  quad4(out, slot, a, A, D, d, color); // -u end
  quad4(out, slot, B, b, c, C, color); // +u end
  quad4(out, slot, D, C, c, d, color); // top
  if (bottom) quad4(out, slot, a, b, B, A, color);
}

/** Axis-aligned box (all six faces unless bottom: false). */
export function abox(out, slot, lo, hi, color, { bottom = true } = {}) {
  fbox(
    out,
    slot,
    facade([lo[0], hi[2]], [1, 0]),
    0,
    hi[0] - lo[0],
    lo[1],
    hi[1],
    -(hi[2] - lo[2]),
    0,
    color,
    { bottom },
  );
}

/** Points of a pointed (two-centred) arch over a span of halfWidth, apex `rise` above spring. */
export function pointedArch(halfWidth, rise, steps = 6) {
  // Two arcs of radius R centred on the springing line; choose R so the apex sits at `rise`.
  const R = (rise * rise + halfWidth * halfWidth) / (2 * halfWidth);
  const left = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = Math.PI - t * Math.atan2(rise, R - halfWidth);
    left.push([R - halfWidth + R * Math.cos(angle), R * Math.sin(angle)]);
  }
  left[steps] = [0, rise];
  const right = left
    .slice(0, -1)
    .reverse()
    .map(([u, y]) => [-u, y]);
  return [...left, ...right];
}

/** Round (semicircular) arch points over halfWidth. */
export function roundArch(halfWidth, steps = 8) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI - (i / steps) * Math.PI;
    points.push([halfWidth * Math.cos(a), halfWidth * Math.sin(a)]);
  }
  return points;
}

/**
 * An opening on a facade: glass face d proud of the wall, a projecting surround and optional
 * mullions. `head` is 'flat', 'round', 'pointed' or 'tudor' (low pointed).
 */
export function opening(out, F, u, y0, width, height, options = {}) {
  const {
    head = 'flat',
    glassSlot = 'glass',
    frameSlot = 'trim',
    glass = rgb('3f4a52'),
    frame = rgb('d8d0bc'),
    frameWidth = 0.22,
    frameDepth = 0.18,
    sill = true,
    mullions = 0,
    transoms = 0,
    mullionColor = frame,
    d = 0.03,
    rise,
  } = options;
  const half = width / 2;
  const headRise =
    head === 'flat'
      ? 0
      : head === 'round'
        ? half
        : (rise ?? (head === 'tudor' ? half * 0.55 : half * 1.6));
  const spring = y0 + height - headRise;
  const headPoints =
    head === 'flat'
      ? [
          [-half, 0],
          [half, 0],
        ]
      : head === 'round'
        ? roundArch(half)
        : pointedArch(half, headRise, head === 'tudor' ? 3 : 6);
  const outline = [
    [u + half, y0],
    ...headPoints
      .slice()
      .reverse()
      .map(([du, dy]) => [u + du, spring + dy]),
    [u - half, y0],
  ];
  // Counterclockwise seen from outside: walk +u along the sill, then back over the head.
  const ring = [[u - half, y0], ...outline.slice(0, -1)];
  fan(
    out,
    glassSlot,
    ring.map(([pu, py]) => F.P(pu, py, d)),
    glass,
  );
  if (frameWidth > 0) {
    // Jambs and head as short boxes following the outline.
    const path = [
      [u - half, y0],
      ...headPoints.map(([du, dy]) => [u + du, spring + dy]),
      [u + half, y0],
    ];
    for (let i = 0; i + 1 < path.length; i++) {
      const [ua, ya] = path[i],
        [ub, yb] = path[i + 1];
      const len = Math.hypot(ub - ua, yb - ya);
      if (len < 1e-4) continue;
      const tu = (ub - ua) / len,
        ty = (yb - ya) / len;
      // Offset outward from the opening (to the left of the walking direction in u/y).
      const ou = -ty * frameWidth,
        oy = tu * frameWidth;
      const q = [
        [ua, ya],
        [ub, yb],
        [ub + ou, yb + oy],
        [ua + ou, ya + oy],
      ];
      const front = q.map(([pu, py]) => F.P(pu, py, frameDepth));
      const back = q.map(([pu, py]) => F.P(pu, py, 0));
      quad4(out, frameSlot, front[0], front[1], front[2], front[3], frame);
      quad4(out, frameSlot, back[0], back[1], front[1], front[0], frame);
      quad4(out, frameSlot, front[3], front[2], back[2], back[3], frame);
    }
    if (sill)
      fbox(
        out,
        frameSlot,
        F,
        u - half - frameWidth,
        u + half + frameWidth,
        y0 - 0.2,
        y0,
        0,
        frameDepth + 0.08,
        frame,
      );
  }
  for (let i = 1; i <= mullions; i++) {
    const mu = u - half + (width * i) / (mullions + 1);
    fbox(
      out,
      frameSlot,
      F,
      mu - 0.06,
      mu + 0.06,
      y0,
      spring + (head === 'flat' ? 0 : headRise * 0.4),
      d,
      d + 0.08,
      mullionColor,
    );
  }
  for (let i = 1; i <= transoms; i++) {
    const ty = y0 + ((spring - y0) * i) / (transoms + 1);
    fbox(out, frameSlot, F, u - half, u + half, ty - 0.06, ty + 0.06, d, d + 0.08, mullionColor);
  }
}

const ringArea = (ring) =>
  ring.reduce(
    (a, p, i) => a + p[0] * ring[(i + 1) % ring.length][1] - ring[(i + 1) % ring.length][0] * p[1],
    0,
  ) / 2;

/**
 * Orient a footprint ring so that wallFace(ring[i], ring[i+1]) faces outward: counterclockwise
 * seen from above (+X right, +Z down), which is a negative x/z shoelace area.
 */
export function outwardRing(ring) {
  const r = ring.slice();
  if (r.length > 1 && r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1]) r.pop();
  return ringArea(r) > 0 ? r.reverse() : r;
}

/** Walls of a (possibly concave) ring from y0 to y1, plus caps; holes become courtyards. */
export function extrude(
  out,
  slot,
  ring,
  y0,
  y1,
  color,
  { holes = [], top = true, bottom = false, topSlot = slot, topColor = color } = {},
) {
  const outer = outwardRing(ring);
  const walls = (r) => {
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-4) continue;
      quad4(
        out,
        slot,
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
        color,
      );
    }
  };
  walls(outer);
  const innerHoles = holes.map((h) => outwardRing(h).reverse());
  for (const h of innerHoles) walls(h);
  if (
    top &&
    !out.addCap(
      topSlot,
      REF,
      outer,
      innerHoles,
      () => y1,
      [0, 1, 0],
      (p) => p,
      topColor,
    )
  )
    throw new Error('extrude: cap triangulation failed');
  if (
    bottom &&
    !out.addCap(
      slot,
      REF,
      outer,
      innerHoles,
      () => y0,
      [0, -1, 0],
      (p) => p,
      color,
    )
  )
    throw new Error('extrude: cap triangulation failed');
}

/** Bands just proud of every wall of a ring, e.g. ribbon windows or a string course. */
export function ribbon(
  out,
  slot,
  ring,
  y0,
  y1,
  color,
  { offset = 0.04, minLength = 1.5, inset = 0.4 } = {},
) {
  const r = outwardRing(ring);
  for (let i = 0; i < r.length; i++) {
    const F = wallFace(r[i], r[(i + 1) % r.length]);
    if (F.length < minLength) continue;
    const a = F.P(inset, y0, offset),
      b = F.P(F.length - inset, y0, offset),
      c = F.P(F.length - inset, y1, offset),
      d = F.P(inset, y1, offset);
    quad4(out, slot, a, b, c, d, color);
  }
}

/**
 * Gable roof whose ridge runs from a to b ([x, z]); `width` across, eaves at yEave, ridge at
 * yRidge, `overhang` past the walls. Gable-end triangles go to endSlot when given.
 */
export function gableRoof(
  out,
  slot,
  a,
  b,
  width,
  yEave,
  yRidge,
  color,
  { overhang = 0.5, endSlot, endColor, ends = [true, true] } = {},
) {
  const F = facade(a, [b[0] - a[0], b[1] - a[1]]);
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const h = width / 2 + overhang;
  const drop = (overhang * (yRidge - yEave)) / (width / 2);
  const u0 = -overhang,
    u1 = length + overhang;
  const ridge0 = F.P(u0, yRidge, 0),
    ridge1 = F.P(u1, yRidge, 0);
  // Slopes on the normal (+d) side, then the -d side.
  quad4(out, slot, F.P(u0, yEave - drop, h), F.P(u1, yEave - drop, h), ridge1, ridge0, color);
  quad4(out, slot, F.P(u1, yEave - drop, -h), F.P(u0, yEave - drop, -h), ridge0, ridge1, color);
  // Undersides so the overhang never shows a missing face.
  quad4(
    out,
    slot,
    F.P(u1, yEave - drop - 0.02, h),
    F.P(u0, yEave - drop - 0.02, h),
    F.P(u0, yEave - 0.02, h - overhang),
    F.P(u1, yEave - 0.02, h - overhang),
    color,
  );
  quad4(
    out,
    slot,
    F.P(u0, yEave - drop - 0.02, -h),
    F.P(u1, yEave - drop - 0.02, -h),
    F.P(u1, yEave - 0.02, -h + overhang),
    F.P(u0, yEave - 0.02, -h + overhang),
    color,
  );
  if (endSlot) {
    const w = width / 2;
    if (ends[0])
      tri(out, endSlot, F.P(0, yEave, w), F.P(0, yRidge, 0), F.P(0, yEave, -w), endColor ?? color);
    if (ends[1])
      tri(
        out,
        endSlot,
        F.P(length, yEave, -w),
        F.P(length, yRidge, 0),
        F.P(length, yEave, w),
        endColor ?? color,
      );
  }
}

/** Regular polygonal prism (tower) centred at [x, z]; `rotation` turns the first vertex. */
export function tower(
  out,
  slot,
  center,
  radius,
  sides,
  y0,
  y1,
  color,
  { rotation = 0, top = true, topSlot = slot, topColor = color } = {},
) {
  const ring = Array.from({ length: sides }, (_, i) => {
    const a = rotation + (i / sides) * Math.PI * 2;
    return [center[0] + radius * Math.cos(a), center[1] + radius * Math.sin(a)];
  });
  extrude(out, slot, ring, y0, y1, color, { top, topSlot, topColor });
  return ring;
}

/** Pyramid or cone over a regular polygon base. */
export function spire(out, slot, center, radius, sides, y0, height, color, { rotation = 0 } = {}) {
  const apex = [center[0], y0 + height, center[1]];
  for (let i = 0; i < sides; i++) {
    const a0 = rotation + (i / sides) * Math.PI * 2,
      a1 = rotation + ((i + 1) / sides) * Math.PI * 2;
    const p0 = [center[0] + radius * Math.cos(a0), y0, center[1] + radius * Math.sin(a0)];
    const p1 = [center[0] + radius * Math.cos(a1), y0, center[1] + radius * Math.sin(a1)];
    // Base ring runs counterclockwise in x/z (toward +z from +x), i.e. clockwise seen from above.
    tri(out, slot, p1, p0, apex, color);
  }
}

/** Lofted ring stack: layers of [y, radiusX, radiusZ]; `sides` facets; open or capped ends. */
export function lathe(
  out,
  slot,
  center,
  layers,
  sides,
  color,
  { capTop = true, capBottom = false, rotation = 0 } = {},
) {
  const point = (layer, i) => {
    const a = rotation + (i / sides) * Math.PI * 2;
    return [center[0] + layer[1] * Math.cos(a), layer[0], center[1] + layer[2] * Math.sin(a)];
  };
  for (let j = 0; j + 1 < layers.length; j++)
    for (let i = 0; i < sides; i++) {
      const a = point(layers[j], i),
        b = point(layers[j], i + 1),
        c = point(layers[j + 1], i + 1),
        d = point(layers[j + 1], i);
      // Facing outward: a→d→c→b is counterclockwise seen from outside for this winding.
      if (layers[j][1] < 1e-6 && layers[j][2] < 1e-6) tri(out, slot, a, d, c, color);
      else if (layers[j + 1][1] < 1e-6 && layers[j + 1][2] < 1e-6) tri(out, slot, a, d, b, color);
      else quad4(out, slot, a, d, c, b, color);
    }
  const cap = (layer, up) => {
    const ring = Array.from({ length: sides }, (_, i) => point(layer, i));
    fan(out, slot, up ? ring.slice().reverse() : ring, color);
  };
  if (capTop && layers.at(-1)[1] > 1e-6) cap(layers.at(-1), true);
  if (capBottom && layers[0][1] > 1e-6) cap(layers[0], false);
}
