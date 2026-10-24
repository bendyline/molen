/** Independently mapped Khonsu, Opet and Bab El Amara exterior group. */
import './install-deterministic-math.mjs';
import earcut from 'earcut';

export const karnakWestCandidateId = 'karnak_temple_complex';

function localFace(f, frame) {
  const { origin: o, u, v } = frame;
  return (role, points, normal, tint) =>
    f(
      role,
      points.map(([x, y, z]) => [o[0] + u[0] * x + v[0] * z, y, o[1] + u[1] * x + v[1] * z]),
      [u[0] * normal[0] + v[0] * normal[2], normal[1], u[1] * normal[0] + v[1] * normal[2]],
      tint,
    );
}

/** Battered wing, with genuine paired upper apertures in the nearer models. */
function wing(f, box, a, b, height, depth, floor, detail) {
  const bottom = floor - 0.45,
    top = floor + height,
    inset = height * 0.045,
    outer = [
      [a, bottom],
      [b, bottom],
      [b - inset, top],
      [a + inset, top],
    ],
    holes =
      detail >= 2
        ? [0.32, 0.7].map((t) => {
            const x = a + (b - a) * t;
            return [
              [x - 0.48, floor + height - 3.1],
              [x + 0.48, floor + height - 3.1],
              [x + 0.48, floor + height - 2.15],
              [x - 0.48, floor + height - 2.15],
            ];
          })
        : [],
    rings = [outer, ...holes],
    points = rings.flat(),
    offsets = holes.map((_, i) => 4 + i * 4),
    indices = earcut(points.flat(), offsets, 2),
    vertex = ([x, y], side) => [
      x,
      y,
      side === 1 ? -(y - floor) * 0.045 : -depth + (y - floor) * 0.045,
    ];
  for (const side of [-1, 1])
    for (let i = 0; i < indices.length; i += 3)
      f(
        'wall',
        indices.slice(i, i + 3).map((k) => vertex(points[k], side)),
        [0, 0, side],
      );
  for (let k = 0; k < rings.length; k++)
    for (let i = 0; i < rings[k].length; i++) {
      const p = rings[k][i],
        q = rings[k][(i + 1) % rings[k].length],
        n = [q[1] - p[1], p[0] - q[0], 0].map((x) => x * (k ? -1 : 1));
      f('stone', [vertex(p, -1), vertex(q, -1), vertex(q, 1), vertex(p, 1)], n);
    }
  // Broad cavetto silhouette. Reliefs and individual stone joints use shared graphs.
  if (detail > 0)
    box(
      f,
      'stone',
      (a + b) / 2,
      top,
      -depth / 2,
      b - a - 2 * inset + 0.5,
      0.6,
      depth - 2 * inset + 0.5,
    );
  if (detail >= 2)
    box(
      f,
      'stone',
      (a + b) / 2,
      top + 0.6,
      -depth / 2,
      b - a - 2 * inset + 0.9,
      0.2,
      depth - 2 * inset + 0.9,
    );
}

function portal(f, box, width, depth, height, opening, floor, z, detail) {
  const side = (width - opening) / 2;
  for (const s of [-1, 1])
    box(f, 'wall', (s * (opening + side)) / 2, floor, z, side, height, depth);
  box(f, 'stone', 0, floor + height * 0.69, z, opening, height * 0.31, depth);
  if (detail > 0) box(f, 'stone', 0, floor + height, z, width + 0.5, 0.55, depth + 0.5);
}

function khonsu(f, detail, { box, lathe }, data, floor) {
  const g = localFace(f, data.frame),
    w = data.width,
    length = data.length;
  box(g, 'stone', 0, floor - 0.5, -length / 2, w, 0.5, length);
  wing(g, box, -w / 2, -2.25, 16.8, 7, floor, detail);
  wing(g, box, 2.25, w / 2, 16.8, 7, floor, detail);
  box(g, 'stone', 0, floor + 6.8, -3.5, 4.5, 2.7, 6.5);
  if (detail >= 2) box(g, 'stone', 0, floor + 9.5, -3.5, 5.2, 0.6, 7);
  // Separate side walls, open peristyle court and stepped roofed rear ranges.
  if (detail > 0)
    for (const sign of [-1, 1])
      box(g, 'wall', sign * (w / 2 - 0.7), floor, -(length + 7) / 2, 1.4, 7.1, length - 7);
  if (detail > 0) box(g, 'wall', 0, floor, -length + 0.7, w, 7.1, 1.4);
  if (detail === 0) {
    box(g, 'wall', 0, floor, -51, w - 2.8, 9.4, 27);
  } else if (detail === 1) {
    for (const sign of [-1, 1]) box(g, 'wall', sign * (w / 4 + 1), floor, -45, w / 2 - 3, 8.8, 15);
    box(g, 'stone', 0, floor + 8.8, -45, w - 2.8, 0.6, 15);
    box(g, 'wall', 0, floor, -59, w - 2.8, 6.8, 12);
    // Four visible court piers retain the open center at remote levels.
    for (const sign of [-1, 1]) {
      box(g, 'stone', sign * 10.6, floor, -12.5, 1.9, 6.5, 1.9);
      box(g, 'stone', sign * 10.6, floor, -29, 1.9, 6.5, 1.9);
    }
  } else {
    for (const sign of [-1, 1]) {
      for (let i = 0; i < 6; i++)
        lathe(
          g,
          sign * 10.6,
          -10.5 - i * 4.1,
          detail < 3
            ? [
                [0, 1.1],
                [5.9, 0.87],
                [6.5, 1.35],
              ]
            : [
                [0, 1.25],
                [0.3, 1.25],
                [0.5, 1.06],
                [5.5, 0.87],
                [6.1, 1.35],
                [6.5, 1.15],
              ],
          detail < 3 ? 4 : 12,
        );
      box(g, 'stone', sign * 11.6, floor + 6.5, -21.1, 4.8, 0.8, 25.4);
    }
    portal(g, box, w - 2.8, 1.7, 8.8, 3.3, floor, -36.8, detail);
    for (const sign of [-1, 1])
      for (const z of [-40.5, -47.5])
        lathe(
          g,
          sign * 4.4,
          z,
          detail < 3
            ? [
                [0, 1.2],
                [7.7, 1],
                [8.8, 1.5],
              ]
            : [
                [0, 1.4],
                [0.4, 1.4],
                [0.6, 1.15],
                [7.4, 1],
                [8.3, 1.5],
                [8.8, 1.3],
              ],
          detail < 3 ? 4 : 12,
        );
    // Central clerestory is taller than the side roof strips, with open side gaps.
    box(g, 'stone', 0, floor + 8.8, -44.6, 12, 0.6, 14);
    for (const sign of [-1, 1]) {
      box(g, 'stone', sign * 9.7, floor + 7.1, -44.6, 7.4, 0.6, 14);
      for (const z of [-39.4, -44.7, -49.8])
        box(g, 'stone', sign * 6.5, floor + 7.7, z, 1, 1.1, 1.25);
    }
    portal(g, box, w - 2.8, 1.6, 6.8, 2.6, floor, -52.5, detail);
    box(g, 'stone', 0, floor + 6.8, -59.4, w - 2.8, 0.6, 12.2);
    for (const sign of [-1, 1]) box(g, 'wall', sign * 4.1, floor, -59.4, 1, 6.8, 12.2);
  }
  if (detail >= 2)
    for (const sign of [-1, 1]) {
      box(g, 'granite', sign * 7.1, floor, 2.5, 3.2, 0.65, 3.8);
      // Broken recumbent entrance remnants; no invented full standing statues.
      box(g, 'stone', sign * 7.1, floor + 0.65, 2.6, 2.2, 0.8, 2.8);
    }
}

function opet(f, detail, { box, lathe }, data, floor) {
  // +local X follows the mapped long axis eastwards, entrance at the western end.
  const g = localFace(f, data.frame),
    w = data.width,
    length = data.length,
    raised = floor + 1.35;
  if (detail === 0) {
    g(
      'stone',
      [
        [0, raised, -w / 2],
        [length, raised, -w / 2],
        [length, raised, w / 2],
        [0, raised, w / 2],
      ],
      [0, 1, 0],
    );
  } else box(g, 'stone', length / 2, floor - 0.5, 0, length, 1.85, w);
  if (detail > 0)
    for (const sign of [-1, 1])
      box(g, 'wall', length / 2, raised, sign * (w / 2 - 0.7), length, 6.6, 1.4);
  if (detail > 0) box(g, 'wall', length - 0.7, raised, 0, 1.4, 6.6, w);
  // West-facing doorway and low forecourt remain clear, rather than a solid roof box.
  for (const sign of [-1, 1])
    box(g, 'wall', 1.1, raised, sign * (w / 4 + 0.8), 2.2, 6.2, w / 2 - 2.1);
  box(g, 'stone', 1.1, raised + 4, 0, 2.2, 2.2, 4.2);
  if (detail > 0) box(g, 'stone', 1.1, raised + 6.2, 0, 2.7, 0.5, w + 0.2);
  if (detail <= 1) {
    box(g, 'wall', length * 0.66, raised, 0, length * 0.58, 7.5, w - 2.8);
  } else {
    for (const sign of [-1, 1])
      box(g, 'wall', length * 0.66, raised, sign * (w / 4 + 0.65), length * 0.58, 7.5, w / 2 - 2.7);
    // A coarse recessed sanctuary doorway, without reconstructing historical interiors.
    for (const sign of [-1, 1]) box(g, 'wall', length * 0.38, raised, sign * 3, 1.7, 7.5, 3.4);
    box(g, 'stone', length * 0.38, raised + 4.3, 0, 1.7, 3.2, 3);
    for (const z of [-4.5, 4.5])
      lathe(
        g,
        11.3,
        z,
        [
          [1.35, 0.9],
          [6.9, 0.75],
          [7.7, 1.1],
        ],
        detail < 3 ? 4 : 12,
      );
    // Selected broken roof range; no invented complete roof above the western court.
    box(g, 'stone', length * 0.64, raised + 7.5, 0, length * 0.54, 0.55, w - 2.8);
    box(g, 'stone', length * 0.67, raised + 8.05, 0, length * 0.26, 0.75, w - 8);
  }
  // Source footprint begins at the western jamb; stairs extend only a narrow approach.
  const count = detail <= 1 ? 1 : 5;
  for (let i = 0; detail > 0 && i < count; i++)
    box(
      g,
      'stone',
      -3 + ((i + 0.5) * 3) / count,
      floor - 0.3,
      0,
      3 / count,
      0.3 + (1.35 * (i + 1)) / count,
      4.2,
    );
}

export function buildKarnakWest(f, detail, primitives, rec) {
  const data = rec.west;
  if (!data) throw new Error('Karnak western source parameters missing');
  khonsu(f.withGrade('khonsu'), detail, primitives, data.khonsu, rec.floorY);
  opet(f.withGrade('opet'), detail, primitives, data.opet, rec.floorY);
  f = f.withGrade('bab');
  const gate = localFace(f, data.babElAmara.frame);
  primitives.box(gate, 'stone', 0, rec.floorY - 0.5, 0, 12.2, 0.5, 10.2);
  portal(
    gate,
    primitives.box,
    data.babElAmara.width,
    data.babElAmara.depth,
    17.2,
    5.2,
    rec.floorY,
    0,
    detail,
  );
  if (detail >= 2) {
    primitives.box(
      gate,
      'stone',
      0,
      rec.floorY + 17.75,
      0,
      data.babElAmara.width + 1,
      0.3,
      data.babElAmara.depth + 0.9,
    );
    // A separate narrow connection never fills the space between the two temples.
    const p = data.path,
      dx = p[1][0] - p[0][0],
      dz = p[1][1] - p[0][1],
      l = Math.hypot(dx, dz);
    const path = localFace(f.withGrade('bab-approach'), {
      origin: p[0],
      u: [dx / l, dz / l],
      v: [-dz / l, dx / l],
    });
    primitives.box(path, 'flat', l / 2, rec.floorY - 0.12, 0, l, 0.12, 4.2);
  }
}
