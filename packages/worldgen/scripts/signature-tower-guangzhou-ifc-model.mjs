/** Guangzhou IFC: mapped curved triangle, double-curved shaft and fine diagrid. */
import { beam, cross, normalize, torus } from './authored-structure-mesh.mjs';
import {
  clockwise,
  face,
  localOutline,
  mappedCap,
  mappedSolid,
  panel,
  tri,
} from './signature-tower-expansion-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const add = (a, b, s = 1) => a.map((v, i) => v + b[i] * s);
function inside([x, z], plan) {
  let result = false;
  for (let i = 0, j = plan.length - 1; i < plan.length; j = i++) {
    const a = plan[i],
      b = plan[j];
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0])
      result = !result;
  }
  return result;
}
function arcCurve(plan) {
  // A closed centripetal-like cubic trace retains the separately mapped rounded
  // corners while avoiding the polygonal map's visibly flat 20 m glass facets.
  const p = clockwise(plan),
    samples = [];
  for (let i = 0; i < p.length; i++)
    for (let j = 0; j < 24; j++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        d = p[(i + 2) % p.length],
        t = j / 24;
      samples.push(
        b.map(
          (v, k) =>
            0.5 *
            (2 * v +
              (-a[k] + c[k]) * t +
              (2 * a[k] - 5 * v + 4 * c[k] - d[k]) * t * t +
              (-a[k] + 3 * v - 3 * c[k] + d[k]) * t * t * t),
        ),
      );
    }
  const lengths = [0];
  for (let i = 0; i < samples.length; i++)
    lengths.push(
      lengths.at(-1) + Math.hypot(...add(samples[(i + 1) % samples.length], samples[i], -1)),
    );
  const perimeter = lengths.at(-1);
  return {
    perimeter,
    at(t) {
      const distance = (((t % 1) + 1) % 1) * perimeter;
      let i = 0;
      while (lengths[i + 1] < distance) i++;
      return mix(
        samples[i],
        samples[(i + 1) % samples.length],
        (distance - lengths[i]) / (lengths[i + 1] - lengths[i]),
      );
    },
  };
}
export function buildGuangzhouIfc(out, mapped) {
  const curve = arcCurve(localOutline(mapped));
  const center = [-1.3, -7.6],
    R = 5100,
    waist = 145;
  const sag = (y) => R - Math.sqrt(R * R - (y - waist) ** 2);
  const surface = (t, y, offset = 0) => {
    const p = curve.at(t),
      radial = normalize(add(p, center, -1));
    const d = sag(0) - sag(y) + offset;
    return [p[0] + radial[0] * d, y, p[1] + radial[1] * d];
  };
  const ring = (y, offset = 0, n = 180) =>
    Array.from({ length: n }, (_, i) => surface(i / n, y, offset));
  const n = 150,
    top = 432.5,
    rows = 206;
  // Blue-grey glass on the continuously varying radius, with the three dark vent levels. The
  // diagrid is two families of 15 helical bands just proud of the glass, as wide as before;
  // the 4 cm pane seals and vent louvres were sub-pixel at every runtime level.
  const pitch = curve.perimeter / 15,
    slope = pitch / 54;
  const vents = [108, 216, 301.5].map((b) => {
    const starts = Array.from({ length: rows }, (_, j) => (top * j) / rows).filter(
      (y) => y >= b && y < b + 5.2,
    );
    return [starts[0], starts.at(-1) + top / rows];
  });
  const levels = [
    ...new Set([...Array.from({ length: 31 }, (_, k) => (top * k) / 30), ...vents.flat()]),
  ].sort((a, b) => a - b);
  for (let j = 1; j < levels.length; j++) {
    const y = levels[j - 1],
      yy = levels[j],
      vent = vents.some(([lo, hi]) => y >= lo && yy <= hi);
    for (let i = 0; i < n; i++) {
      // A faint per-panel variation; at the old pane amplitude, tall glass slabs read as stripes.
      const tint = 0.006 * Math.sin(i * 2.17 + j * 0.91),
        gray = vent ? [-0.105, -0.13, -0.13] : [0, 0, 0];
      const color = [0.19 + tint + gray[0], 0.34 + tint + gray[1], 0.405 + tint + gray[2]];
      const p = [
        surface(i / n, y),
        surface((i + 1) / n, y),
        surface((i + 1) / n, yy),
        surface(i / n, yy),
      ];
      tri(out, 'glass', [p[0], p[1], p[2]], color);
      tri(out, 'glass', [p[0], p[2], p[3]], color);
    }
  }
  const brace = [0.225, 0.365, 0.425];
  for (const sign of [-1, 1])
    for (let i = 0; i < 15; i++)
      for (let k = 0; k < 103; k++) {
        const y = (top * k) / 103,
          yy = (top * (k + 1)) / 103;
        // Split down the centre line so the band's chord stays in front of the glass where the
        // rounded corners turn tightly.
        const edge = (height, side) => {
          const width = (1.8 - 0.85 * (height / 432)) * Math.sqrt(1 + slope * slope);
          const s = i * pitch - sign * slope * height + (side * width) / 2;
          return surface(s / curve.perimeter, height, sign < 0 ? 0.05 : 0.055);
        };
        for (const [l, r] of [
          [-1, 0],
          [0, 1],
        ])
          face(out, 'metal', [edge(y, l), edge(y, r), edge(yy, r), edge(yy, l)], brace);
      }
  // Thin coping around the roof rim, and the triangular glazed atrium skylight.
  const outer = ring(top),
    inner = ring(top, -2.1);
  for (let i = 0; i < outer.length; i++) {
    const k = (i + 1) % outer.length;
    face(out, 'metal', [outer[i], outer[k], inner[k], inner[i]], [0.57, 0.64, 0.65]);
    beam(
      out,
      'metal',
      surface(i / 180, top + 0.12),
      surface(k / 180, top + 0.12),
      0.13,
      0.13,
      [0.48, 0.56, 0.59],
    );
  }
  const roofPlan = ring(top, -2.1).map(([x, , z]) => [x, z]);
  mappedCap(out, 'glass', roofPlan, top - 0.12, [0.09, 0.17, 0.23]);
  const glassRoof = [
    [-13, -17],
    [17, -16],
    [-3, 15],
  ];
  for (let row = 0; row < 12; row++) {
    const y = -16 + row * 2.4,
      z1 = y + 2.4;
    const left = -13 + ((y + 17) * 10) / 32,
      right = 17 - ((y + 16) * 20) / 31;
    if (right <= left) continue;
    beam(
      out,
      'metal',
      [left, top + 0.025, y],
      [right, top + 0.025, y],
      0.1,
      0.12,
      [0.32, 0.43, 0.48],
    );
    for (let x = Math.ceil(left / 2.4) * 2.4; x < right; x += 2.4) {
      const target = Math.min(z1, 15);
      beam(
        out,
        'metal',
        [x, top + 0.025, y],
        [Math.min(x, 17 - ((target + 16) * 20) / 31), top + 0.025, target],
        0.07,
        0.09,
        [0.33, 0.44, 0.48],
      );
    }
  }
  for (let i = 0; i < 3; i++)
    beam(
      out,
      'metal',
      [...glassRoof[i].slice(0, 1), top + 0.03, glassRoof[i][1]],
      [glassRoof[(i + 1) % 3][0], top + 0.03, glassRoof[(i + 1) % 3][1]],
      0.24,
      0.2,
      [0.48, 0.57, 0.6],
    );
  // Circular helipad is raised above the western roof edge; its net slopes
  // outward and is separate from the 437.5 m landing surface.
  const hx = -17,
    hz = -7,
    hy = 437.5,
    hr = 11.4;
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5,
      x = hx + 8.7 * Math.cos(a),
      z = hz + 8.7 * Math.sin(a);
    if (inside([x, z], roofPlan))
      tube(out, 'metal', [x, top - 0.1, z], [x, hy - 0.35, z], 0.16, [0.46, 0.54, 0.57], 10);
    beam(out, 'metal', [hx, top - 0.1, hz], [x, hy - 0.35, z], 0.14, 0.14, [0.41, 0.5, 0.53]);
  }
  const pad = Array.from({ length: 96 }, (_, i) => [
    hx + hr * Math.cos((i * Math.PI) / 48),
    hz - hr * Math.sin((i * Math.PI) / 48),
  ]);
  mappedSolid(out, 'metal', pad, hy - 0.24, hy, [0.28, 0.34, 0.35]);
  torus(out, 'metal', [hx, hy + 0.024, hz], 8.1, 0.062, [0.84, 0.84, 0.74], 96);
  for (const x of [hx - 2.1, hx + 2.1])
    box(
      out,
      'metal',
      [x - 0.22, hy + 0.024, hz - 3],
      [x + 0.22, hy + 0.043, hz + 3],
      [0.84, 0.86, 0.79],
    );
  box(
    out,
    'metal',
    [hx - 2.1, hy + 0.024, hz - 0.22],
    [hx + 2.1, hy + 0.043, hz + 0.22],
    [0.84, 0.86, 0.79],
  );
  for (let i = 0; i < 96; i++) {
    const a = (i * Math.PI) / 48,
      b = ((i + 1) * Math.PI) / 48;
    const p = [hx + hr * Math.cos(a), hy - 0.04, hz + hr * Math.sin(a)],
      q = [hx + (hr + 1.45) * Math.cos(a), hy + 0.38, hz + (hr + 1.45) * Math.sin(a)];
    if (i % 4 === 0) tube(out, 'metal', p, q, 0.032, [0.53, 0.59, 0.6], 6);
    for (const r of [hr + 0.35, hr + 0.7, hr + 1.1, hr + 1.45])
      tube(
        out,
        'metal',
        [hx + r * Math.cos(a), hy - 0.04 + ((r - hr) * 0.42) / 1.45, hz + r * Math.sin(a)],
        [hx + r * Math.cos(b), hy - 0.04 + ((r - hr) * 0.42) / 1.45, hz + r * Math.sin(b)],
        0.012,
        [0.55, 0.61, 0.62],
        4,
      );
  }
  tube(
    out,
    'metal',
    [hx + hr - 1.2, hy, hz],
    [hx + hr - 1.2, 438.6 - 0.045, hz],
    0.045,
    [0.6, 0.65, 0.65],
    8,
  );
  // Exterior stairs connect the raised helipad to the enclosed roof service area.
  for (let i = 0; i < 24; i++)
    box(
      out,
      'metal',
      [1.12 - (i + 1) * 0.28, top + (i * (hy - top)) / 24, -8.1],
      [1.19 - i * 0.28, top + ((i + 1) * (hy - top)) / 24, -5.9],
      [0.57, 0.63, 0.65],
    );
  for (const z of [-8.1, -5.9])
    beam(
      out,
      'metal',
      [1.12, top + 1.05, z],
      [-5.6, hy + 1.05, z],
      0.052,
      0.052,
      [0.6, 0.66, 0.67],
    );
  // Lobby doors and a slim cantilevered canopy on the broad northern frontage.
  const enterT = 0.86,
    enter = surface(enterT, 0),
    nrm = normalize([enter[0] - center[0], 0, enter[2] - center[1]]),
    u = normalize(cross(nrm, [0, 1, 0]));
  const p = (x, y, d) => add(add([enter[0], y, enter[2]], u, x), nrm, d);
  for (let i = 0; i < 8; i++)
    panel(
      out,
      [
        p(-8 + i * 2, 0, 0.055),
        p(-6 + i * 2, 0, 0.055),
        p(-6 + i * 2, 4.2, 0.055),
        p(-8 + i * 2, 4.2, 0.055),
      ],
      [0.14, 0.23, 0.27],
      0.065,
      [0.62, 0.67, 0.69],
    );
  const roofPoints = [p(-11, 6.2, -0.15), p(11, 6.2, -0.15), p(11, 6.2, 6.5), p(-11, 6.2, 6.5)];
  face(out, 'metal', roofPoints, [0.54, 0.62, 0.64]);
  face(out, 'metal', roofPoints.map((v) => add(v, [0, -0.18, 0])).toReversed(), [0.38, 0.47, 0.5]);
  for (let i = 0; i < 4; i++)
    face(
      out,
      'metal',
      [
        roofPoints[i],
        roofPoints[(i + 1) % 4],
        add(roofPoints[(i + 1) % 4], [0, -0.18, 0]),
        add(roofPoints[i], [0, -0.18, 0]),
      ],
      [0.6, 0.66, 0.67],
    );
  for (const x of [-9, 9])
    tube(out, 'metal', p(x, 0, 5.4), p(x, 6.02, 5.4), 0.115, [0.7, 0.73, 0.73], 12);
  // Original polygonal letter strokes follow the south-eastern glass curvature.
  const letterT = 0.39;
  const letterPoint = (x, y) => surface(letterT + x / curve.perimeter, 416 + y, 0.14);
  const strokes = [
    [
      [-8, 0],
      [-8, 12],
    ],
    [
      [-2, 0],
      [-2, 12],
    ],
    [
      [-2, 12],
      [3, 12],
    ],
    [
      [-2, 6.5],
      [2, 6.5],
    ],
    [
      [11, 11],
      [8, 12],
    ],
    [
      [8, 12],
      [5.5, 10],
    ],
    [
      [5.5, 10],
      [5.5, 2],
    ],
    [
      [5.5, 2],
      [8, 0],
    ],
    [
      [8, 0],
      [11, 1],
    ],
  ];
  for (const [a, b] of strokes) {
    const count = Math.ceil(Math.hypot(...add(b, a, -1)) / 0.6);
    for (let i = 0; i < count; i++)
      tube(
        out,
        'metal',
        letterPoint(...mix(a, b, i / count)),
        letterPoint(...mix(a, b, (i + 1) / count)),
        0.18,
        [0.73, 0.58, 0.31],
        6,
      );
  }
}
