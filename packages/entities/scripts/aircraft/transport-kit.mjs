/** Construction for measured civil transports. Holds no aircraft shape: every type supplies its own
 * traced tables (see the per-type modules beside this file).
 *
 * Datum. u runs aft from the nose tip; h is height above the barrel keel, level in the body. Tables
 * are written in (u, h) because that is how the drawings are traced. The finished airframe then
 * sits in a rigid `airframe` group at its measured ground attitude, so the static nose-down or
 * tail-down stance comes from one number rather than from bent tables. Only the wheels live outside
 * that group, because they stand on the ground. World +Z is forward, +X is pilot left, +Y is up.
 *
 * The fuselage is an analytic surface, S(u, a): a is the angle round the section from the crown.
 * Station tables give half-breadth, keel, crown and the height of maximum breadth, interpolated
 * monotonically so nothing overshoots the traced outline. Windows, doors and seams are placed by
 * (u, h) on that same surface, so they cannot float off the skin.
 */
import { addAircraftCockpit } from '../aircraft-interiors.mjs';
import { cleanGeometry, detailKit, mat, T } from './mesh-kit.mjs';

const PI = Math.PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

/** Monotone cubic through the points; flat outside them. xs must be strictly increasing. */
export function pchip(xs, ys) {
  const n = xs.length,
    h = [],
    d = [],
    m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) {
    h[i] = xs[i + 1] - xs[i];
    d[i] = (ys[i + 1] - ys[i]) / h[i];
  }
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) continue;
    const a = 2 * h[i] + h[i - 1],
      b = h[i] + 2 * h[i - 1];
    m[i] = (a + b) / (a / d[i - 1] + b / d[i]);
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let lo = 0,
      hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] <= x) lo = mid;
      else hi = mid;
    }
    const t = (x - xs[lo]) / h[lo],
      t2 = t * t,
      t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[lo] +
      (t3 - 2 * t2 + t) * h[lo] * m[lo] +
      (-2 * t3 + 3 * t2) * ys[lo + 1] +
      (t3 - t2) * h[lo] * m[lo + 1]
    );
  };
}
/** Straight lines between rows, for planforms whose kinks are real. Rows sorted by column 0. */
const piecewise = (rows, x) => {
  if (x <= rows[0][0]) return rows[0];
  for (let i = 1; i < rows.length; i++)
    if (x <= rows[i][0]) {
      const a = rows[i - 1],
        b = rows[i],
        t = (x - a[0]) / (b[0] - a[0]);
      return a.map((v, k) => lerp(v, b[k], t));
    }
  return rows.at(-1);
};

/** Interpolated body surface. Rows: u, half-breadth, keel, crown, optional max-breadth fraction. */
export function bodySurface(A) {
  const rows = A.body,
    us = rows.map((r) => r[0]),
    column = (k, fallback) =>
      pchip(
        us,
        rows.map((r) => r[k] ?? fallback),
      );
  const half = column(1),
    keel = column(2),
    crown = column(3),
    mid = column(4, A.midFraction),
    upper = 2 / (A.upperPower ?? 2),
    lower = 2 / (A.lowerPower ?? 2);
  const section = (u) => {
    const b = keel(u),
      t = crown(u);
    return { w: half(u), b, t, m: b + mid(u) * (t - b) };
  };
  const point = (u, a, side = 1, offset = 0) => {
    const { w, b, t, m } = section(u),
      s = Math.sin(a),
      c = Math.cos(a),
      up = c >= 0;
    const x = w * Math.pow(Math.abs(s), up ? upper : lower),
      y = up ? m + (t - m) * Math.pow(c, upper) : m - (m - b) * Math.pow(-c, lower);
    if (!offset) return [side * x, y, u];
    // Outward by the section's own gradient; the slope along u is small wherever decals sit.
    const dy = up ? t - m : m - b,
      nx = x / Math.max(w * w, 1e-6),
      ny = (y - m) / Math.max(dy * dy, 1e-6),
      l = Math.hypot(nx, ny) || 1;
    return [side * (x + (offset * nx) / l), y + (offset * ny) / l, u];
  };
  /** Section angle at which the skin reaches height y; 0 where the crown is below it. */
  const angle = (u, y) => {
    const { b, t, m } = section(u);
    if (y >= t) return 0;
    if (y <= b) return PI;
    const v = y >= m ? (y - m) / (t - m) : -(m - y) / (m - b),
      c = Math.sign(v) * Math.pow(Math.abs(v), y >= m ? 1 / upper : 1 / lower);
    return Math.acos(clamp(c, -1, 1));
  };
  return { section, point, angle, half, keel, crown, length: us.at(-1) };
}

function indexedMesh(parent, name, positions, indices, material) {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new T.Mesh(geometry, material);
  mesh.name = name;
  parent.add(mesh);
  return mesh;
}
/** Quad grid over closed rings. Outward winding comes from each ring's own centre. */
function ringIndices(rings, stride, start = 0, skip = () => false) {
  const out = [];
  for (let i = 0; i < rings.length - 1; i++)
    for (let j = 0; j < stride; j++) {
      if (skip(i, j)) continue;
      const a = start + i * stride + j,
        b = start + i * stride + ((j + 1) % stride),
        c = start + (i + 1) * stride + ((j + 1) % stride),
        e = start + (i + 1) * stride + j;
      out.push(a, b, c, a, c, e);
    }
  return out;
}
const orient = (positions, indices, rings, stride) => {
  // Flip the whole patch when its first quad faces its own axis.
  const p = (k) => new T.Vector3(positions[k * 3], positions[k * 3 + 1], positions[k * 3 + 2]);
  const axis = rings[0]
    .slice(0, stride)
    .reduce((s, q) => s.add(new T.Vector3(...q)), new T.Vector3())
    .multiplyScalar(1 / stride);
  for (let k = 0; k + 2 < indices.length; k += 3) {
    const a = p(indices[k]),
      n = p(indices[k + 1])
        .sub(a)
        .cross(p(indices[k + 2]).sub(a));
    if (n.lengthSq() < 1e-10) continue;
    if (n.dot(a.clone().sub(axis)) < 0)
      for (let q = 0; q + 2 < indices.length; q += 3)
        [indices[q + 1], indices[q + 2]] = [indices[q + 2], indices[q + 1]];
    return;
  }
};
/** Smooth closed loft through rings of 3D points, with end fans. Used for every round form. */
export function loftRings(parent, name, rings, material, { caps = true } = {}) {
  const n = rings[0].length,
    positions = rings.flat(2),
    indices = ringIndices(rings, n);
  orient(positions, indices, rings, n);
  if (caps) {
    const last = rings.length - 1;
    for (let j = 1; j < n - 1; j++) {
      indices.push(0, j + 1, j);
      indices.push(last * n, last * n + j, last * n + j + 1);
    }
  }
  return indexedMesh(parent, name, positions, indices, material);
}
const ellipseRing = (n, cx, cy, z, w, top, bottom, lowerPower = 2) =>
  Array.from({ length: n }, (_, j) => {
    const a = (j * 2 * PI) / n,
      s = Math.sin(a),
      c = Math.cos(a),
      p = 2 / lowerPower;
    return c >= 0
      ? [cx + w * s, cy + top * c, z]
      : [cx + w * Math.sign(s) * Math.pow(Math.abs(s), p), cy - bottom * Math.pow(-c, p), z];
  });
/** Fairing of elliptical sections. Rows: z, half-width, bottom, top, optional centre x. */
export function pod(parent, name, rows, material, x = 0, n = 16) {
  return loftRings(
    parent,
    name,
    rows.map(([z, w, b, t, cx = x]) =>
      ellipseRing(n, cx, (b + t) / 2, z, w, (t - b) / 2, (t - b) / 2),
    ),
    material,
  );
}

const FOIL = [0, 0.012, 0.045, 0.1, 0.2, 0.32, 0.46, 0.62, 0.78, 0.92, 1];
const thickness = (x) =>
  (0.2969 * Math.sqrt(x) -
    0.126 * x -
    0.3516 * x * x +
    0.2843 * x * x * x -
    0.1036 * x * x * x * x) /
  0.1002;
/** One closed foil section between chord fractions x0 and x1. */
function foilRing(st, x0, x1, lower) {
  const at = (x, sign) => {
    const h = st.half * thickness(x) * (sign > 0 ? 1 : lower);
    return st.le.map((v, k) => v + (st.te[k] - v) * x + st.normal[k] * h * sign);
  };
  const xs = FOIL.map((f) => x0 + (x1 - x0) * f);
  return [
    ...xs.map((x) => at(x, 1)),
    ...xs
      .slice()
      .reverse()
      .map((x) => at(x, -1)),
  ];
}
/** Adds each station's thickness direction, square to its chord and its local span. */
function withNormals(stations) {
  return stations.map((s, i) => {
    const a = new T.Vector3(...stations[Math.max(0, i - 1)].le),
      b = new T.Vector3(...stations[Math.min(stations.length - 1, i + 1)].le),
      span = b.sub(a).normalize(),
      chord = new T.Vector3(...s.te).sub(new T.Vector3(...s.le)).normalize(),
      normal = chord.cross(span).normalize();
    if (normal.y < -1e-3 || (Math.abs(normal.y) <= 1e-3 && normal.x < 0)) normal.negate();
    return { ...s, normal: normal.toArray() };
  });
}
function foilLoft(parent, name, stations, material, { x0 = 0, x1 = () => 1, lower = 0.72 } = {}) {
  return loftRings(
    parent,
    name,
    stations.map((s, i) => foilRing(s, x0, x1(i), lower)),
    material,
  );
}

/** A surface hinged on the straight line a to b. The frame group carries the hinge's direction and
 * the named child takes the binding, so a plain axis rotation really is a turn about the hinge. */
function hinged(parent, name, a, b, axis) {
  const pa = new T.Vector3(...a),
    pb = new T.Vector3(...b),
    direction = pb.clone().sub(pa).normalize(),
    frame = new T.Group();
  frame.name = `${name}-hinge`;
  frame.position.copy(pa.clone().add(pb).multiplyScalar(0.5));
  frame.quaternion.setFromUnitVectors(
    axis === 'x' ? new T.Vector3(1, 0, 0) : new T.Vector3(0, 1, 0),
    direction,
  );
  parent.add(frame);
  const node = new T.Group();
  node.name = name;
  frame.add(node);
  frame.updateMatrix();
  const inverse = frame.matrix.clone().invert();
  return { node, local: (p) => new T.Vector3(...p).applyMatrix4(inverse).toArray() };
}

/** Flat ribbons laid on a surface, batched into one mesh per material. */
function decals() {
  const batches = new Map();
  const batch = (material) => {
    if (!batches.has(material)) batches.set(material, { positions: [], indices: [] });
    return batches.get(material);
  };
  const push = (b, p) => {
    b.positions.push(...p);
    return b.positions.length / 3 - 1;
  };
  return {
    fan(material, center, ring) {
      const b = batch(material),
        c = push(b, center),
        first = b.positions.length / 3;
      for (const q of ring) push(b, q);
      for (let j = 0; j < ring.length; j++)
        b.indices.push(c, first + j, first + ((j + 1) % ring.length));
    },
    ribbon(material, points, width, closed = false, up = null) {
      const b = batch(material),
        n = points.length,
        first = b.positions.length / 3;
      for (let i = 0; i < n; i++) {
        const p = new T.Vector3(...points[i]),
          t = new T.Vector3(...points[closed ? (i + 1) % n : Math.min(n - 1, i + 1)]).sub(
            new T.Vector3(...points[closed ? (i + n - 1) % n : Math.max(0, i - 1)]),
          ),
          radial = (up ?? new T.Vector3(p.x, p.y - 2, 0)).clone().normalize(),
          across = t.cross(radial).normalize().multiplyScalar(width);
        push(b, p.clone().add(across).toArray());
        push(b, p.clone().sub(across).toArray());
      }
      for (let i = 0; i < n - (closed ? 0 : 1); i++) {
        const a = first + i * 2,
          c = first + ((i + 1) % n) * 2;
        b.indices.push(a, a + 1, c + 1, a, c + 1, c);
      }
    },
    finish(parent) {
      let i = 0;
      for (const [material, { positions, indices }] of batches) {
        // Orientation is not assured for a ribbon; these materials are double sided.
        material.side = T.DoubleSide;
        indexedMesh(parent, `skin-detail-${i++}`, positions, indices, material);
      }
    },
  };
}

/** Flap track fairing below the wing, about a metre of it behind the trailing edge. Offsets
 * are from the wing plane: u, half-width, bottom, top. */
export const canoe = (from, length, depth = 1) => [
  [from, 0.02, -0.16 * depth, -0.1 * depth],
  [from + length * 0.12, 0.13, -0.34 * depth, -0.06 * depth],
  [from + length * 0.45, 0.17, -0.42 * depth, -0.04 * depth],
  [from + length * 0.8, 0.12, -0.32 * depth, -0.08 * depth],
  [from + length, 0.015, -0.14 * depth, -0.12 * depth],
];

export const noseZ = (A) => A.length / 2;
/** Body-to-world pose. `stance` is [nose-down pitch in radians, u, keel height there]. */
export function pose(A) {
  const [pitch, u, keel] = A.stance,
    z = noseZ(A) - u;
  // World y of body (h, z) is Y + h cos(pitch) - z sin(pitch).
  return { pitch, Y: keel + z * Math.sin(pitch) };
}
const toWorld = (A, [x, h, z]) => {
  const { pitch, Y } = pose(A),
    c = Math.cos(pitch),
    s = Math.sin(pitch);
  return [x, Y + h * c - z * s, h * s + z * c];
};

export function transportFrame(A) {
  const z = noseZ(A) - A.eye.u,
    body = {
      heli: false,
      fighter: false,
      large: !A.compactDeck,
      radius: A.width / 2,
      cy: A.bodyHeight / 2,
      ry: A.bodyHeight / 2,
      cabinZ: z,
      cabinWidth: A.cabinWidth,
      eye: [A.eye.x, A.eye.h, z],
      panelZ: z + 0.67,
      floor: A.eye.floor,
    };
  return {
    ...body,
    large: true,
    cy: toWorld(A, [0, body.cy, 0])[1],
    cabinZ: toWorld(A, [0, A.eye.h, z])[2],
    eye: toWorld(A, body.eye),
    panelZ: toWorld(A, [0, A.eye.h, body.panelZ])[2],
    floor: toWorld(A, [0, A.eye.floor, z])[1],
    body,
  };
}

/** Half-breadth of the skin at height y on station u; 0 above the crown or under the keel. */
function skinHalf(A, M, u, y) {
  const { w, b, t, m } = M.section(u);
  if (y >= t || y <= b) return 0;
  const p = (y >= m ? A.upperPower : A.lowerPower) ?? 2,
    q = Math.abs(y - m) / (y >= m ? t - m : m - b);
  return w * Math.pow(1 - Math.pow(q, p), 1 / p);
}
/** Where the shared flight deck fits this nose. The published eye stations sit well forward, where
 * the nose has closed in, so panel, glareshield, floor and overhead take their reach from the skin
 * rather than from the cabin width. All distances are forward of the eye, in the body frame. */
function deckFit(A, M) {
  const { u, h, floor, bulkhead } = A.eye,
    half = A.cabinWidth / 2,
    skin = (ahead, y) => skinHalf(A, M, u - ahead, y),
    clear = (ahead, ...ys) => Math.min(...ys.map((y) => skin(ahead, y))) - 0.03;
  // The panel is chamfered: full width up to its displays, then in to fit under the windscreen.
  const panelWidth = 2 * Math.min(half, clear(0.77, h - 0.72, h - 0.33));
  let fore = 0.2,
    wallFore = 0.2;
  while (fore < 1.1 && skin(fore + 0.02, floor) > half + 0.08) fore += 0.02;
  while (wallFore < 1.1 && skin(wallFore + 0.02, floor + 0.67) > half + 0.06) wallFore += 0.02;
  // The overhead stays inside the roof: its forward edge slides aft until the skin passes it,
  // and under a low roof it sits lower, never closer than 0.3 m over the eye.
  const overhead = Math.min(0.72, A.cabinWidth * 0.6) / 2,
    front = (rise) => {
      let ahead = 0.53;
      while (ahead > -0.6 && skin(ahead, h + rise + 0.04) < overhead + 0.03) ahead -= 0.02;
      return ahead;
    };
  let overheadRise = 0.48;
  while (overheadRise > 0.3 && front(overheadRise) < 0) overheadRise -= 0.02;
  return {
    panelWidth,
    panelTop: Math.min(panelWidth / 2, clear(0.77, h - 0.25)),
    fore,
    wallFore,
    aft: bulkhead - u - 0.04,
    overheadY: overheadRise,
    overheadZ: front(overheadRise) - 0.29,
    // Glareshield hood in plan: half-widths at its lip and where it meets the windscreen sill.
    hood: { near: clear(0.6, h - 0.21), far: clear(0.8, h - 0.21) },
  };
}

/** The inside of the nose ahead of the glass and under its sill, dark, so that it reads as the
 * coaming the windscreen stands on and not as bare skin. Offset just inside the skin. */
function coaming(parent, A, M, ck, zOf, material) {
  const bottom = A.eye.h - 0.6,
    // Its top runs a little past the sill, so no bare skin shows between the two in parallax.
    edge = ck.uStart + 0.07,
    us = [edge - 1e-3];
  for (let u = edge - 0.1; u > 0.1 && us.length < 16; u -= 0.1) us.unshift(u);
  for (let u = edge; u < A.eye.u - 0.45; u += 0.08) us.push(u);
  const n = 10,
    positions = [],
    indices = [];
  for (const side of [-1, 1]) {
    const first = positions.length / 3;
    for (const u of us) {
      const a0 = u < edge ? 0 : Math.max(0, M.angle(u, ck.low(u)) - 0.07),
        a1 = Math.max(a0, M.angle(u, bottom));
      for (let j = 0; j <= n; j++) {
        const [x, y] = M.point(u, lerp(a0, a1, j / n), side, -0.035);
        positions.push(x, y, zOf(u));
      }
    }
    for (let i = 0; i < us.length - 1; i++)
      for (let j = 0; j < n; j++) {
        const a = first + i * (n + 1) + j,
          b = a + n + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
  }
  return indexedMesh(parent, 'cockpit-coaming', positions, indices, material);
}

/** Half rings of 2*H nodes in four bands, so node lines run exactly along the lower and upper edges
 * of the flight deck windows and along the paint break, and those edges are real skin edges. */
const H = 36,
  ROOF = 7,
  GLASS = 13,
  BREAK = 22;
function ringAngles(M, ck, u, breakAngle) {
  const low = M.angle(u, ck.low(u)),
    top = Math.min(low, M.angle(u, ck.top(u)));
  return Array.from({ length: H + 1 }, (_, j) =>
    j <= ROOF
      ? (top * j) / ROOF
      : j <= GLASS
        ? lerp(top, low, (j - ROOF) / (GLASS - ROOF))
        : j <= BREAK
          ? lerp(low, breakAngle, (j - GLASS) / (BREAK - GLASS))
          : lerp(breakAngle, PI, (j - BREAK) / (H - BREAK)),
  );
}
function fuselage(body, A, M, ck, m, zOf) {
  const stations = new Set(A.body.map((r) => r[0])),
    tip = A.body[0][0],
    aft = M.length;
  const add = (from, to, step) => {
    for (let u = from; u < to - 1e-6; u += step) stations.add(Math.round(u * 1000) / 1000);
  };
  const a = ck.uStart - 0.3,
    b = ck.uEnd + 0.3;
  add(tip, a, 0.22);
  add(a, b, 0.11);
  add(b, 7, 0.5);
  add(7, aft - 12, 2);
  add(aft - 12, aft, 0.75);
  stations.add(ck.uStart);
  stations.add(ck.uEnd);
  const us = [...stations].sort((p, q) => p - q);
  const positions = [],
    rings = [];
  for (const u of us) {
    const angles = ringAngles(M, ck, u, A.bellyAngle),
      ring = [];
    for (let j = 0; j < 2 * H; j++) {
      const [x, y] = M.point(u, angles[j <= H ? j : 2 * H - j], j <= H ? 1 : -1);
      ring.push([x, y, zOf(u)]);
    }
    rings.push(ring);
    positions.push(...ring.flat());
  }
  const paint = [],
    belly = [],
    glass = [],
    first = us.indexOf(ck.uStart),
    last = us.indexOf(ck.uEnd);
  const quad = (list, i, j) => {
    const k = (j + 1) % (2 * H),
      p = i * 2 * H;
    list.push(p + j, p + k, p + 2 * H + k, p + j, p + 2 * H + k, p + 2 * H + j);
  };
  for (let i = 0; i < us.length - 1; i++)
    for (let j = 0; j < 2 * H; j++) {
      const q = j < H ? j : 2 * H - 1 - j,
        glazed = i >= first && i < last && q >= ROOF && q < GLASS;
      quad(glazed ? glass : q >= BREAK ? belly : paint, i, j);
    }
  orient(positions, paint, rings, 2 * H);
  const flip = (list) => {
    if (paint.length && orientationOf(paint, positions) !== orientationOf(list, positions))
      for (let q = 0; q + 2 < list.length; q += 3)
        [list[q + 1], list[q + 2]] = [list[q + 2], list[q + 1]];
  };
  flip(belly);
  flip(glass);
  // Caps close the nose tip and tail cone.
  const n = 2 * H,
    last_ = us.length - 1;
  for (let j = 1; j < n - 1; j++) paint.push(0, j, j + 1);
  for (let j = 1; j < n - 1; j++) belly.push(last_ * n, last_ * n + j + 1, last_ * n + j);
  indexedMesh(body, 'fuselage-skin', positions, paint, m.paint);
  indexedMesh(body, 'fuselage-belly', positions, belly, m.belly);
  indexedMesh(body, 'cockpit-canopy-glazing', positions, glass, m.glass);
}
const orientationOf = (list, positions) => {
  // Sign of the outward test on a quad well away from the axis.
  for (let k = 0; k + 2 < list.length; k += 3) {
    const v = (q) => new T.Vector3(positions[q * 3], positions[q * 3 + 1], positions[q * 3 + 2]),
      a = v(list[k]),
      n = v(list[k + 1])
        .sub(a)
        .cross(v(list[k + 2]).sub(a));
    if (n.lengthSq() > 1e-8 && Math.abs(a.x) > 0.5) return Math.sign(n.x * a.x);
  }
  return 1;
};

/** Everything traced on the skin: windows, door and hatch outlines, seams. */
function skinDetail(A, M, ck, m, dec, zOf) {
  const onSkin = (u, y, side, off = 0.012) => {
    const [x, h] = M.point(u, M.angle(u, y), side, off);
    return [x, h, zOf(u)];
  };
  const { windows, doors = [], seams = [] } = A;
  for (const side of [-1, 1]) {
    for (const run of windows?.runs ?? [])
      for (let k = 0; k < run.count; k++) {
        const u = run.from + k * (run.pitch ?? windows.pitch),
          hw = windows.w / 2,
          hh = windows.h / 2,
          c = windows.corner ?? 0.42;
        const shape = windows.oval
          ? Array.from({ length: 14 }, (_, j) => {
              const t = (j * PI) / 7;
              return [hw * Math.cos(t), hh * Math.sin(t)];
            })
          : [
              [-hw, -hh * (1 - c)],
              [-hw * (1 - c), -hh],
              [hw * (1 - c), -hh],
              [hw, -hh * (1 - c)],
              [hw, hh * (1 - c)],
              [hw * (1 - c), hh],
              [-hw * (1 - c), hh],
              [-hw, hh * (1 - c)],
            ];
        dec.fan(
          m.window,
          onSkin(u, windows.y, side),
          shape.map(([du, dy]) => onSkin(u + du, windows.y + dy, side)),
        );
      }
    for (const door of doors) {
      if (door.side && door.side !== side) continue;
      const r = door.corner ?? 0.11,
        steps = 3,
        points = [];
      const corner = (cu, cy, from) => {
        for (let k = 0; k <= steps; k++) {
          const t = from + (k / steps) * (PI / 2);
          points.push([cu + Math.cos(t) * r, cy + Math.sin(t) * r]);
        }
      };
      corner(door.u1 - r, door.y1 - r, 0);
      corner(door.u0 + r, door.y1 - r, PI / 2);
      corner(door.u0 + r, door.y0 + r, PI);
      corner(door.u1 - r, door.y0 + r, PI * 1.5);
      dec.ribbon(
        m.trim,
        points.map(([u, y]) => onSkin(u, y, side, 0.008)),
        0.012,
        true,
      );
    }
    // Windscreen frames: the two glazing edges, then each post from lower to upper edge.
    const edge = (fn) => {
      const out = [];
      for (let u = ck.uStart; u <= ck.uEnd + 1e-6; u += 0.08) {
        const y = fn(u);
        if (M.crown(u) > y + 1e-3) out.push(onSkin(u, y, side, 0.018));
      }
      return out;
    };
    dec.ribbon(m.frame, edge(ck.low), 0.03);
    dec.ribbon(m.frame, edge(ck.top), 0.03);
    // A sill or header that crosses the nose on one station, from height y over to the centerline.
    for (const [u, y] of ck.arcs ?? [])
      dec.ribbon(
        m.frame,
        Array.from({ length: 9 }, (_, k) => {
          const [x, h] = M.point(u, (M.angle(u, y) * (8 - k)) / 8, side, 0.018);
          return [x, h, zOf(u)];
        }),
        0.03,
      );
    for (const [uLow, uTop] of [...ck.posts, [ck.uEnd, ck.uEnd]]) {
      const y0 = ck.low(uLow),
        y1 = ck.top(uTop),
        points = Array.from({ length: 7 }, (_, k) => {
          const t = k / 6,
            u = lerp(uLow, uTop, t),
            y = lerp(y0, y1, t);
          return M.crown(u) > y ? onSkin(u, y, side, 0.018) : null;
        }).filter(Boolean);
      if (points.length > 1) dec.ribbon(m.frame, points, 0.034);
    }
  }
  if (ck.centerPost) {
    const a = ck.uStart + 0.02,
      b = ck.centerPost,
      points = Array.from({ length: 8 }, (_, k) => {
        const u = lerp(a, b, k / 7);
        return [0, M.crown(u) + 0.018, zOf(u)];
      });
    dec.ribbon(m.frame, points, 0.04, false, new T.Vector3(0, 1, 0));
  }
  for (const u of seams)
    dec.ribbon(
      m.trim,
      Array.from({ length: 2 * H }, (_, j) => {
        const a = ((j <= H ? j : 2 * H - j) * PI) / H,
          [x, y] = M.point(u, a, j <= H ? 1 : -1, 0.006);
        return [x, y, zOf(u)];
      }),
      0.008,
      true,
    );
}

const station = (x, h, le, te, half, zOf) => ({
  le: [x, h, zOf(le)],
  te: [x, h, zOf(te)],
  half,
});

/** Wing, tip device and its moving surfaces, one side. Rows: x, h, u-LE, u-TE, half thickness. */
function wings(body, A, m, zOf, visual) {
  const { rows, surfaces = [] } = A.wing;
  const breaks = surfaces.flatMap((s) => [s.from - 0.012, s.from, s.to, s.to + 0.012]),
    xs = [...new Set([...rows.map((r) => r[0]), ...breaks])].sort((p, q) => p - q),
    inRange = (x) => surfaces.find((s) => x >= s.from - 1e-6 && x <= s.to + 1e-6);
  for (const side of [-1, 1]) {
    const stations = withNormals(
      xs.map((x) => {
        const [, h, le, te, half] = piecewise(rows, x);
        return station(side * x, h, le, te, half, zOf);
      }),
    );
    foilLoft(body, `wing-${side}`, stations, m.wing, {
      x1: (i) => {
        const s = inRange(xs[i]);
        return s ? 1 - s.chord : 1;
      },
    });
    for (const s of surfaces) {
      const a = withNormals(
          [s.from, s.to].map((x) => {
            const [, h, le, te, half] = piecewise(rows, x);
            return station(side * x, h, le, te, half, zOf);
          }),
        ),
        hingePoint = (q) => q.le.map((v, k) => lerp(v, q.te[k], 1 - s.chord)),
        ends = side > 0 ? [a[0], a[1]] : [a[1], a[0]],
        name = `${s.kind}-${side > 0 ? 'left' : 'right'}-${s.name ?? ''}`.replace(/-$/, ''),
        { node, local } = hinged(body, name, hingePoint(ends[0]), hingePoint(ends[1]), 'x');
      const moved = a.map((q) => ({
        ...q,
        le: local(q.le),
        te: local(q.te),
        normal: q.normal,
      }));
      foilLoft(node, `${name}-skin`, moved, m.control, { x0: 1 - s.chord + 0.003 });
      if (s.kind === 'flap')
        visual.flaps.push({ node: name, axis: 'x', multiplier: -(s.travel ?? 0.6) });
      else visual.ailerons.push({ node: name, axis: 'x', multiplier: -side * 0.32 });
    }
    for (const row of A.wing.pods ?? []) {
      const [, h] = piecewise(rows, row.x);
      pod(
        body,
        `flap-track-${side}-${row.x}`,
        row.rows.map(([u, w, b, t]) => [zOf(u), w, h + b, h + t]),
        m.wing,
        side * row.x,
        10,
      );
    }
  }
}

/** Fin as a vertical foil. Rows: h, u-LE, u-TE, half thickness. */
function fin(body, A, m, zOf, bindings) {
  const { rows, rudder } = A.fin,
    cuts = rudder ? [rudder.from - 0.012, rudder.from, rudder.to, rudder.to + 0.012] : [],
    hs = [...new Set([...rows.map((r) => r[0]), ...cuts])].sort((p, q) => p - q),
    active = (h) => rudder && h >= rudder.from - 1e-6 && h <= rudder.to + 1e-6,
    stations = withNormals(
      hs.map((h) => {
        const [, le, te, half] = piecewise(rows, h);
        return { le: [0, h, zOf(le)], te: [0, h, zOf(te)], half };
      }),
    );
  foilLoft(body, 'fin', stations, m.tail, {
    lower: 1,
    x1: (i) => (active(hs[i]) ? 1 - rudder.chord : 1),
  });
  if (rudder) {
    const ends = withNormals(
        [rudder.from, rudder.to].map((h) => {
          const [, le, te, half] = piecewise(rows, h);
          return { le: [0, h, zOf(le)], te: [0, h, zOf(te)], half };
        }),
      ),
      hingePoint = (q) => q.le.map((v, k) => lerp(v, q.te[k], 1 - rudder.chord)),
      { node, local } = hinged(body, 'rudder', hingePoint(ends[0]), hingePoint(ends[1]), 'y');
    foilLoft(
      node,
      'rudder-skin',
      ends.map((q) => ({ ...q, le: local(q.le), te: local(q.te) })),
      m.tail,
      { x0: 1 - rudder.chord + 0.003, lower: 1 },
    );
    bindings.push({
      node: 'rudder',
      source: 'yawInput',
      property: 'rotation',
      axis: 'y',
      scale: 0.38,
    });
  }
  for (const cap of A.fin.caps ?? [])
    pod(
      body,
      cap.name,
      cap.rows.map(([u, w, b, t]) => [zOf(u), w, b, t]),
      m.tail,
      0,
      12,
    );
}
/** Tailplane. Rows: x, h, u-LE, u-TE, half thickness; `elevator` gives span range and chord. */
function tailplane(body, A, m, zOf, bindings) {
  const { rows, elevator } = A.tailplane,
    xs = [
      ...new Set([
        ...rows.map((r) => r[0]),
        elevator.from - 0.012,
        elevator.from,
        elevator.to,
        elevator.to + 0.012,
      ]),
    ].sort((p, q) => p - q);
  for (const side of [-1, 1]) {
    const stations = withNormals(
      xs.map((x) => {
        const [, h, le, te, half] = piecewise(rows, x);
        return station(side * x, h, le, te, half, zOf);
      }),
    );
    foilLoft(body, `tailplane-${side}`, stations, m.tail, {
      lower: 0.9,
      x1: (i) =>
        xs[i] >= elevator.from - 1e-6 && xs[i] <= elevator.to + 1e-6 ? 1 - elevator.chord : 1,
    });
    const a = withNormals(
        [elevator.from, elevator.to].map((x) => {
          const [, h, le, te, half] = piecewise(rows, x);
          return station(side * x, h, le, te, half, zOf);
        }),
      ),
      hingePoint = (q) => q.le.map((v, k) => lerp(v, q.te[k], 1 - elevator.chord)),
      ends = side > 0 ? [a[0], a[1]] : [a[1], a[0]],
      name = `elevator-${side}`,
      { node, local } = hinged(body, name, hingePoint(ends[0]), hingePoint(ends[1]), 'x');
    foilLoft(
      node,
      `${name}-skin`,
      a.map((q) => ({ ...q, le: local(q.le), te: local(q.te) })),
      m.tail,
      { x0: 1 - elevator.chord + 0.003, lower: 0.9 },
    );
    bindings.push({
      node: name,
      source: 'pitchInput',
      property: 'rotation',
      axis: 'x',
      scale: 0.3,
    });
  }
}

/** Turbofan pod. Rows: du aft of the highlight, half-width, top, bottom, measured from the axis. */
function turbofan(group, E, m, index, visual) {
  const zOf = (du) => -du,
    n = 40,
    power = E.lowerPower ?? 2,
    ringOf = ([du, w, top, bottom]) => ellipseRing(n, 0, 0, zOf(du), w, top, bottom, power);
  const k = detailKit(group, `engine-${index}-fittings`);
  loftRings(group, `nacelle-${index}`, E.cowl.map(ringOf), m.nacelle, { caps: false });
  // The polished lip runs from the highlight round into the throat.
  const lip = E.lip.map(ringOf);
  loftRings(group, `nacelle-lip-${index}`, lip, m.lip, { caps: false });
  loftRings(group, `inlet-duct-${index}`, E.duct.map(ringOf), m.duct, { caps: false });
  // Fan exit: the aft cowl's inner wall, dark, with the core inside it.
  const tail = E.cowl.at(-1),
    inner = [tail[0] - 0.5, tail[1] - 0.05, tail[2] - 0.05, tail[3] - 0.05];
  loftRings(group, `fan-exit-${index}`, [tail, inner].map(ringOf), m.duct, { caps: false });
  const core = E.core.map(([du, r, cy = 0]) => ellipseRing(24, 0, cy, zOf(du), r, r, r));
  loftRings(group, `core-${index}`, core, m.core, { caps: false });
  const plug = E.plug.map(([du, r, cy = 0]) => ellipseRing(20, 0, cy, zOf(du), r, r, r));
  loftRings(group, `plug-${index}`, plug, m.nozzle);
  const fan = new T.Group();
  fan.name = `fan-${index}`;
  fan.position.set(0, 0, zOf(E.fanAt));
  group.add(fan);
  const f = detailKit(fan, `fan-${index}-disc`),
    spinner = E.spinner;
  f.add(new T.ConeGeometry(spinner[0], spinner[1], 24).rotateX(PI / 2), m.nozzle, [
    0,
    0,
    spinner[1] / 2,
  ]);
  f.add(new T.CircleGeometry(E.fanRadius, 32), m.duct, [0, 0, -0.04]);
  for (let b = 0; b < (E.blades ?? 24); b++) {
    const a = (b * 2 * PI) / (E.blades ?? 24),
      c = Math.cos(a),
      s = Math.sin(a),
      r0 = spinner[0] * 0.9,
      r1 = E.fanRadius * 0.98,
      skew = 0.16;
    const blade = new T.BufferGeometry();
    blade.setAttribute(
      'position',
      new T.Float32BufferAttribute(
        [
          [r0, -skew, 0.06],
          [r1, -skew * 1.6, 0.03],
          [r1, skew * 1.6, -0.03],
          [r0, skew, -0.06],
        ].flatMap(([r, t, z]) => [r * s + t * c, r * c - t * s, z]),
        3,
      ),
    );
    blade.setIndex([0, 1, 2, 0, 2, 3]);
    f.add(blade.toNonIndexed(), m.fan);
  }
  f.finish();
  visual.rotors.push({ node: fan.name, axis: 'z', multiplier: 1, engine: group.name });
  k.finish();
}

/** Six-blade turboprop on a long underwing nacelle. Rows as for the turbofan cowl. */
function turboprop(group, E, m, index, visual) {
  const n = 28,
    rings = E.cowl.map(([du, w, top, bottom]) => ellipseRing(n, 0, 0, -du, w, top, bottom));
  loftRings(group, `nacelle-${index}`, rings, m.nacelle);
  const prop = new T.Group();
  prop.name = `propeller-${index}`;
  prop.position.set(0, 0, E.propAt);
  group.add(prop);
  const p = detailKit(prop, `propeller-${index}-hub`);
  p.add(new T.ConeGeometry(E.spinner[0], E.spinner[1], 24).rotateX(PI / 2), m.prop, [
    0,
    0,
    E.spinner[1] / 2,
  ]);
  for (let j = 0; j < E.blades; j++) {
    const blade = new T.Group();
    blade.name = `propeller-${index}-blade-${j}`;
    blade.rotation.z = (j * 2 * PI) / E.blades;
    prop.add(blade);
    const b = detailKit(blade, `${blade.name}-skin`),
      r = E.radius;
    const pts = [
      [0.07, -0.07],
      [0.3, -0.15],
      [0.72, -0.14],
      [0.96, -0.08],
      [1, 0],
      [0.97, 0.06],
      [0.74, 0.12],
      [0.3, 0.12],
      [0.07, 0.07],
    ].map(([q, w]) => new T.Vector2(q * r, w * (E.bladeChord ?? 1)));
    const shape = new T.Shape(pts);
    b.add(
      new T.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false, steps: 1 }).rotateZ(PI / 2),
      m.prop,
    );
    b.finish();
  }
  p.finish();
  visual.rotors.push({ node: prop.name, axis: 'z', multiplier: 1, engine: group.name });
}

function wheelSet(k, m, { r, w, spread, x = 0, y, z = 0 }) {
  for (const dx of spread ? [-spread / 2, spread / 2] : [0]) {
    const at = [x + dx, y, z];
    k.add(new T.CylinderGeometry(r, r, w, 28).rotateZ(PI / 2), m.tyre, at);
    k.add(new T.CylinderGeometry(r * 0.62, r * 0.62, w + 0.012, 18).rotateZ(PI / 2), m.hub, at);
  }
}
/** Gear stands on the ground, outside the attitude group. `top` is the leg pivot in the world;
 * `hinge` puts that pivot ahead of the axle, and a negative `retract` folds the leg aft. */
function gear(root, A, m, zOf, visual, bindings) {
  const legs = [
    { ...A.gear.nose, id: 0, x: 0, sign: 0 },
    { ...A.gear.main, id: 1, sign: 1 },
    { ...A.gear.main, id: 2, sign: -1 },
  ];
  for (const leg of legs) {
    const side = leg.sign,
      z = zOf(leg.u),
      px = side * (leg.pivotX ?? leg.x ?? 0),
      wheelX = side * (leg.x ?? 0),
      name = `gear-${leg.id}`,
      node = new T.Group();
    node.name = name;
    const hinge = leg.hinge ?? 0;
    node.position.set(px, leg.top, z + hinge);
    root.add(node);
    const k = detailKit(node, `${name}-fittings`),
      axle = leg.r - leg.top,
      dx = wheelX - px,
      az = -hinge;
    k.rod([0, 0, 0], [dx, axle + leg.r * 0.2, az], leg.strut ?? 0.1, m.hub);
    k.rod([dx, axle + leg.r * 0.2, az], [dx, axle, az], (leg.strut ?? 0.1) * 0.6, m.piston);
    k.rod(
      [0, -0.1, leg.sign ? -0.55 : 0.5],
      [dx, axle + leg.r, az],
      (leg.strut ?? 0.1) * 0.42,
      m.hub,
    );
    k.rod(
      [dx - (leg.spread ?? 0.1) / 2, axle, az],
      [dx + (leg.spread ?? 0.1) / 2, axle, az],
      0.05,
      m.hub,
    );
    if (leg.sign) {
      const span = (leg.top - leg.r) * 0.55;
      k.rod([side * -0.5, -0.12, 0.28], [dx * 0.6, -span, az * 0.55], 0.05, m.hub);
    }
    wheelSet(k, m, { r: leg.r, w: leg.w, spread: leg.spread, x: dx, y: axle, z: az });
    k.finish();
    visual.gearNodes.push(name);
    // Mains fold inboard about the fore-and-aft axis unless a type says otherwise; a leg turning
    // about X folds forward, as every nose leg does, or aft with a negative `retract`.
    const axis = leg.axis ?? (leg.sign ? 'z' : 'x'),
      angle = leg.retract ?? (leg.sign ? 1.45 : 1.5),
      turn = axis === 'z' ? side : 1;
    bindings.push({
      node: name,
      source: 'gear',
      property: 'rotation',
      axis,
      scale: turn * angle,
      offset: -turn * angle,
    });
  }
}

export function buildTransport(s, A) {
  const root = new T.Group();
  root.name = s.slug;
  const smooth = { side: T.DoubleSide, flatShading: false, metalness: 0.05, roughness: 0.42 };
  const m = {
    paint: mat(`${A.prefix}-paint`, s.color, smooth),
    belly: mat(`${A.prefix}-belly`, A.bellyColor ?? '#c4c8c8', smooth),
    wing: mat(`${A.prefix}-wing`, A.wingColor ?? '#bcc1c5', { ...smooth, roughness: 0.5 }),
    control: mat(`${A.prefix}-controls`, A.controlColor ?? '#aeb3b7', smooth),
    tail: mat(`${A.prefix}-tail`, A.tailColor ?? s.color, smooth),
    nacelle: mat(`${A.prefix}-nacelle`, A.nacelleColor ?? s.color, smooth),
    lip: mat(`${A.prefix}-lip`, '#cfd3d6', { ...smooth, metalness: 0.75, roughness: 0.28 }),
    duct: mat(`${A.prefix}-duct`, '#2b3034', smooth),
    core: mat(`${A.prefix}-core`, '#8d9296', { ...smooth, metalness: 0.5 }),
    nozzle: mat(`${A.prefix}-nozzle`, '#5a5f62', { ...smooth, metalness: 0.65 }),
    fan: mat(`${A.prefix}-fan`, '#4a5157', { metalness: 0.7, roughness: 0.35, side: T.DoubleSide }),
    prop: mat(`${A.prefix}-propeller`, '#23272a'),
    trim: mat(`${A.prefix}-seams`, A.seamColor ?? '#858c90', { side: T.DoubleSide }),
    frame: mat(`${A.prefix}-window-frame`, '#2a2f33', { side: T.DoubleSide }),
    window: mat(`${A.prefix}-cabin-window`, '#20282e', {
      side: T.DoubleSide,
      metalness: 0.2,
      roughness: 0.2,
    }),
    // Tinted from outside; seen from the seat the glass is clear, so the view is the outside.
    glass: mat(`${A.prefix}-glazing`, '#1d2a31', {
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      side: T.FrontSide,
      roughness: 0.12,
      metalness: 0.1,
    }),
    tyre: mat(`${A.prefix}-tyres`, '#1b1e20', { roughness: 0.9 }),
    hub: mat(`${A.prefix}-gear`, '#a9aeb1', { metalness: 0.55 }),
    piston: mat(`${A.prefix}-oleo`, '#d3d7d9', { metalness: 0.85, roughness: 0.2 }),
    accent: mat(`${A.prefix}-accent`, s.accent, smooth),
  };
  const zNose = noseZ(A),
    zOf = (u) => zNose - u,
    M = bodySurface(A),
    frame = transportFrame(A),
    { pitch, Y } = pose(A);
  const ck = {
    ...A.cockpit,
    low: pchip(
      A.cockpit.low.map((r) => r[0]),
      A.cockpit.low.map((r) => r[1]),
    ),
    top: pchip(
      A.cockpit.top.map((r) => r[0]),
      A.cockpit.top.map((r) => r[1]),
    ),
  };
  const body = new T.Group();
  body.name = 'airframe';
  body.position.set(0, Y, 0);
  body.rotation.x = pitch;
  root.add(body);
  const visual = { rotors: [], gearNodes: [], flaps: [], ailerons: [] },
    bindings = [],
    enginePoints = [];
  const dec = decals();
  fuselage(body, A, M, ck, m, zOf);
  skinDetail(A, M, ck, m, dec, zOf);
  // Flight deck bulkhead: the cabin tube behind the crew stays closed.
  const bulkU = A.eye.bulkhead;
  pod(
    body,
    'flight-deck-bulkhead',
    [
      [zOf(bulkU), M.half(bulkU) - 0.05, M.keel(bulkU) + 0.05, M.crown(bulkU) - 0.05],
      [zOf(bulkU) - 0.02, M.half(bulkU) - 0.05, M.keel(bulkU) + 0.05, M.crown(bulkU) - 0.05],
    ],
    mat(`${A.prefix}-bulkhead`, '#50595e', { side: T.DoubleSide }),
    0,
    24,
  );
  wings(body, A, m, zOf, visual);
  fin(body, A, m, zOf, bindings);
  tailplane(body, A, m, zOf, bindings);
  for (const f of A.fairings ?? [])
    pod(
      body,
      f.name,
      f.rows.map(([u, w, b, t, cx]) => [zOf(u), w, b, t, cx]),
      m[f.material ?? 'belly'],
      f.x ?? 0,
      f.n ?? 24,
    );
  const E = A.engine;
  for (const [index, side] of [
    [1, 1],
    [2, -1],
  ]) {
    const x = side * E.x,
      y = E.h,
      z = zOf(E.u),
      g = new T.Group();
    g.name = `engine-${index}`;
    g.position.set(x, y, z);
    g.rotation.y = side * (E.toe ?? 0);
    g.rotation.x = E.tilt ?? 0;
    body.add(g);
    if (E.kind === 'turboprop') turboprop(g, E, m, index, visual);
    else turbofan(g, E, m, index, visual);
    if (E.pylon)
      pod(
        body,
        `pylon-${index}`,
        E.pylon.map(([u, w, b, t, dx = 0]) => [zOf(u), w, b, t, x + side * dx]),
        m[E.pylonMaterial ?? 'nacelle'],
        x,
        12,
      );
    enginePoints.push({ id: g.name, position: toWorld(A, [x, y, z]) });
  }
  gear(root, A, m, zOf, visual, bindings);
  dec.finish(body);
  // A type with its own flight deck builds it from the measured nose; the rest share one.
  const interior = A.flightDeck
    ? A.flightDeck({
        parent: body,
        prefix: A.prefix,
        eye: [A.eye.x, A.eye.h, zOf(A.eye.u)],
        floor: A.eye.floor,
        bulkheadZ: zOf(A.eye.bulkhead),
        engines: 2,
        skin: (z, y) => skinHalf(A, M, zNose - z, y),
        sill: (z) => ck.low(zNose - z),
        top: (z) => ck.top(zNose - z),
        crown: (z) => M.crown(zNose - z),
        // Skin point at section angle a from the crown, offset along its normal (inward < 0).
        point: (z, a, side, offset = 0) => {
          const [x, y] = M.point(zNose - z, a, side, offset);
          return [x, y, z];
        },
        angle: (z, y) => M.angle(zNose - z, y),
      })
    : addAircraftCockpit(body, s, { ...frame.body, deck: deckFit(A, M) });
  coaming(
    body.getObjectByName('cockpit'),
    A,
    M,
    ck,
    zOf,
    mat(`${A.prefix}-coaming`, '#23282b', { side: T.DoubleSide, roughness: 1, metalness: 0 }),
  );
  cleanGeometry(root);
  const { body: _, ...world } = frame;
  return {
    root,
    frame: world,
    enginePoints,
    visual: { ...visual, animation: { bindings }, interior },
    ...(interior.sources
      ? {
          modelSignals: {
            sources: interior.sources,
            derived: interior.derived,
            // A copy: articulation appends exterior bindings here, which must not join the interior.
            bindings: [...interior.bindings],
          },
        }
      : {}),
  };
}
