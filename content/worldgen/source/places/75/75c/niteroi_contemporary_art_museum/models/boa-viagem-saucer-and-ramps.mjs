import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  lathe,
  outwardRing,
  quad4,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.93 },
  pavement: { slot: 'foundation', graph: 'stone_granite', roughness: 0.96 },
  rail: { slot: 'trim', graph: 'metal_painted', roughness: 0.87 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.62 },
};

const chalk = rgb('e3ded1'),
  shell = rgb('e9e6dd'),
  rim = rgb('d6d0c4'),
  shadow = rgb('c2bdaf');
const bronze = rgb('927f6e'),
  steel = rgb('93948a'),
  windows = rgb('4c5959');
const granite = rgb('9d998a'),
  water = rgb('5e8180'),
  ramp = rgb('a6463c');
const center = site.center;
const circle = (r, n) =>
  Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return [center[0] + r * Math.cos(a), center[1] + r * Math.sin(a)];
  });
const profile = (points) => points.map(([y, r]) => [y, r, r]);

function pavedTerrace(out, n) {
  const ring = outwardRing(site.terrace);
  const apron = new MeshBufferBuilder(),
    normal = [0, 1, 0],
    ref = 'palette:#ffffff';
  if (
    !apron.addCap(
      'pavement',
      ref,
      ring,
      [circle(16.89, n)],
      () => site.plazaY,
      normal,
      (p) => p,
      rim,
    )
  )
    throw Error('Could not triangulate the museum terrace');
  const { positions, indices } = apron.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const points = Array.from(indices.slice(i, i + 3), (j) => positions.slice(j * 3, j * 3 + 3));
    out.addTriangle(
      'pavement',
      ref,
      points,
      normal,
      points.map((p) => [p[0], p[2]]),
      rim,
    );
  }
  const pos = ([x, z], y) => [x, y, z];
  for (const [i, a] of ring.entries()) {
    const b = ring[(i + 1) % ring.length];
    const low = site.terraceGrades[site.terrace.indexOf(a)],
      high = site.terraceGrades[site.terrace.indexOf(b)];
    quad4(
      out,
      'pavement',
      pos(a, low),
      pos(b, high),
      pos(b, site.plazaY),
      pos(a, site.plazaY),
      granite,
    );
  }
}

function basement(out, n) {
  pavedTerrace(out, n);
  lathe(
    out,
    'pavement',
    center,
    profile([
      [-0.57, 16.89],
      [-0.49, 16.89],
      [site.plazaY, 16.89],
      [site.plazaY, 16.53],
      [-0.43, 16.53],
    ]),
    n,
    granite,
  );
  cap(out, 'glass', circle(16.52, n), -0.19, water);
  lathe(
    out,
    'concrete',
    center,
    profile([
      [-2.5, site.pedestalRadius],
      [2.48, site.pedestalRadius],
      [3.07, 4.82],
      [3.73, 5.96],
      [4.12, 7.92],
    ]),
    n,
    chalk,
  );
}

function museum(out, detail, n) {
  const bottom =
    detail === 0
      ? [
          [4.12, 7.92],
          [4.66, 16.27],
          [7.41, 20.06],
        ]
      : [
          [4.12, 7.92],
          [4.35, 13.39],
          [4.75, 16.28],
          [5.46, 17.61],
          [6.58, 19.26],
          [7.41, 20.06],
        ];
  lathe(out, 'concrete', center, profile(bottom), n, chalk);
  const glazing = [
    [7.41, 20.06],
    [9.22, 21.89],
    [11.24, 23.79],
  ];
  lathe(out, 'glass', center, profile(glazing), n, windows);
  lathe(
    out,
    'concrete',
    center,
    profile([
      [11.24, 23.79],
      [12.18, 24.46],
      [13.76, site.roofRadius],
      [15.66, site.roofRadius],
      [site.roofHeight, 24.73],
    ]),
    n,
    shell,
    { capTop: true },
  );
  if (detail === 0) return;

  const at = (angle, r, y) => [center[0] + r * Math.cos(angle), y, center[1] + r * Math.sin(angle)];
  const frequency = detail === 1 ? 2 : 1;
  for (let i = 0; i < n; i += frequency) {
    const theta = (2 * Math.PI * i) / n;
    for (let j = 0; j < glazing.length - 1; j++) {
      const [y, r] = glazing[j],
        [Y, R] = glazing[j + 1];
      beam(out, 'rail', at(theta, r + 0.042, y), at(theta, R + 0.042, Y), 0.071, 0.073, bronze);
    }
  }
  lathe(
    out,
    'rail',
    center,
    profile([
      [9.055, 21.769],
      [9.138, 21.86],
    ]),
    n,
    bronze,
  );
  // The barrel leans outward across the dark glazing and is capped by a plain concrete lip.
  if (detail > 1) {
    lathe(
      out,
      'concrete',
      center,
      profile([
        [15.825, 24.8],
        [15.94, 24.68],
        [15.94, 24.5],
      ]),
      n,
      rim,
    );
  }
}

// Broad control arcs resolve the closely spaced survey vertices on the two return bends.
const rampControls = [
  [
    [
      [25, -45.8],
      [36.25, -43.65],
      [34.15, -37.6],
    ],
    [
      [32.54, -32.88],
      [24.68, -27.42],
      [27.35, -18.7],
    ],
    [[28.45, -15.08], [31.6, -8.6], site.lanes[0].points.at(-1)],
  ],
  [
    [
      [33.0, -14.1],
      [41.5, -19.3],
      [39, -24.9],
    ],
    [
      [36.5, -30.5],
      [31.58, -29.35],
      [32.12, -23.45],
    ],
    [
      [32.66, -17.55],
      [36.6, -12.45],
      [34.75, -7.93],
    ],
    [[34.11, -6.37], [32, -4.7], site.lanes[1].points.at(-1)],
  ],
];

function laneSamples(start, controls, divisions) {
  const points = [];
  let a = start;
  for (const [b, c, d] of controls) {
    for (let i = 0; i < divisions; i++) {
      const t = i / divisions,
        u = 1 - t;
      points.push(
        a.map(
          (v, k) => u * u * u * v + 3 * u * u * t * b[k] + 3 * u * t * t * c[k] + t * t * t * d[k],
        ),
      );
    }
    a = d;
  }
  return [...points, a];
}
function wing(out, lane, detail, n, index) {
  const samples = laneSamples(lane.points[0], rampControls[index], [3, 6, 10, 14][detail]);
  const distances = [0];
  for (let i = 1; i < samples.length; i++)
    distances.push(
      distances.at(-1) +
        Math.hypot(samples[i][0] - samples[i - 1][0], samples[i][1] - samples[i - 1][1]),
    );
  const length = distances.at(-1);
  const sections = samples.map(([x, z], i) => {
    const a = samples[Math.max(0, i - 1)],
      b = samples[Math.min(samples.length - 1, i + 1)];
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      h = Math.hypot(dx, dz);
    const nx = -dz / h,
      nz = dx / h,
      y = lane.y0 + ((lane.y1 - lane.y0) * distances[i]) / length;
    const cross = (x - a[0]) * (b[1] - a[1]) - (z - a[1]) * (b[0] - a[0]);
    const radius =
      cross === 0
        ? Infinity
        : (Math.hypot(x - a[0], z - a[1]) * Math.hypot(b[0] - x, b[1] - z) * h) /
          (2 * Math.abs(cross));
    const halfWidth = Math.min(lane.width * 0.5, radius * 0.76);
    return (side, height) => [x + side * halfWidth * nx, y + height, z + side * halfWidth * nz];
  });
  for (let i = 0; i < sections.length - 1; i++) {
    const a = sections[i],
      b = sections[i + 1];
    quad4(out, 'concrete', a(-1, 0), a(1, 0), b(1, 0), b(-1, 0), ramp);
    quad4(out, 'concrete', b(-1, -0.34), b(1, -0.34), a(1, -0.34), a(-1, -0.34), chalk);
    for (const side of [-1, 1]) {
      const points = [a(side, -0.34), b(side, -0.34), b(side, 0.065), a(side, 0.065)];
      quad4(out, 'concrete', ...(side > 0 ? points : points.slice().reverse()), rim);
      const railHeight = detail === 0 ? 0.57 : 0.96;
      if (detail === 0) {
        const rail = [a(side, 0.42), b(side, 0.42), b(side, railHeight), a(side, railHeight)];
        quad4(out, 'rail', ...(side > 0 ? rail : rail.slice().reverse()), steel);
      } else
        beam(
          out,
          'rail',
          a(side * 0.985, railHeight),
          b(side * 0.985, railHeight),
          0.061,
          0.066,
          steel,
        );
      if (detail > 0 && i % [1, 2, 2, 3][detail] === 0) {
        beam(out, 'rail', a(side * 0.985, 0.045), a(side * 0.985, railHeight), 0.056, 0.063, steel);
        if (detail > 1) beam(out, 'rail', a(side, 0.44), b(side, 0.44), 0.035, 0.046, steel);
      }
    }
  }
  const supports = index === 0 ? [0.3, 0.58, 0.85] : [0.51, 0.77];
  for (const t of supports) {
    const i = Math.round(t * (sections.length - 1)),
      p = sections[i](0, -0.34),
      r = index === 0 ? 0.41 : 0.29;
    const bottom = index === 0 ? -1.21 : Math.max(1.6, p[1] - 5.2);
    lathe(
      out,
      'concrete',
      [p[0], p[2]],
      profile([
        [bottom, r],
        [p[1], r],
      ]),
      Math.min(n, 12),
      shadow,
    );
  }
}
function build(out, detail) {
  const n = [14, 24, 36, 52][detail];
  basement(out, n);
  museum(out, detail, n);
  for (const [i, lane] of site.lanes.entries()) wing(out, lane, detail, n, i);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
