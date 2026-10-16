/** Restored Ford Island control/water tower and its connected operations building. */
import './install-deterministic-math.mjs';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { B, c, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const orange = rgb('c9512c'),
  cream = rgb('e2e0c8'),
  glazing = rgb('536d70');
const tau = Math.PI * 2;
function cylinder(o, s, x, z, r, y, h, color, sides = 24, top = r) {
  loft(
    o,
    s,
    [
      radialRing(y, r, r, sides, [x, z], Math.PI / 8),
      radialRing(y + h, top, top, sides, [x, z], Math.PI / 8),
    ],
    color,
  );
}
function pane(o, x, y, z, w, h, detail, axis = 'z', sign = 1) {
  const point = (u, v) => (axis === 'z' ? [x + u, y + v, z] : [x, y + v, z + u]);
  const rect = (u, v, ww, hh, col, slot = 'glass', depth = 0) => {
    const points = [
      point(u - ww / 2, v),
      point(u + ww / 2, v),
      point(u + ww / 2, v + hh),
      point(u - ww / 2, v + hh),
    ];
    for (const p of points) p[axis === 'z' ? 2 : 0] += sign * depth;
    quad(o, slot, points, axis === 'z' ? [0, 0, sign] : [sign, 0, 0], col);
  };
  rect(0, 0, w, h, glazing);
  if (!detail) return;
  for (const u of [-w / 2, 0, w / 2]) rect(u, 0, 0.065, h, c.cream, 'metal', 0.015);
  for (const v of [0, h / 2, h]) rect(0, v, w, 0.065, c.cream, 'metal', 0.02);
  if (detail > 1) for (const u of [-w / 4, w / 4]) rect(u, 0, 0.04, h, c.cream, 'metal', 0.025);
}
function rail(o, x, z, r, y, color, detail, sides = 24) {
  if (!detail) return;
  const n = detail === 1 ? 8 : sides;
  // Distant rings retain a simple outline; full views retain posts and midrail.
  for (let i = 0; i < n; i++) {
    const a = (i * tau) / n,
      b = ((i + 1) * tau) / n;
    const p = (h) => [x + Math.cos(a) * r, y + h, z + Math.sin(a) * r];
    beam(
      o,
      'metal',
      p(0.96),
      [x + Math.cos(b) * r, y + 0.96, z + Math.sin(b) * r],
      0.055,
      0.055,
      color,
    );
    if (detail > 1) {
      beam(o, 'metal', p(0), p(0.98), 0.055, 0.055, color);
      beam(
        o,
        'metal',
        p(0.48),
        [x + Math.cos(b) * r, y + 0.48, z + Math.sin(b) * r],
        0.045,
        0.045,
        color,
      );
    }
  }
}
function cab(o, x, z, y, r, detail, tall = false) {
  const col = tall ? orange : cream;
  cylinder(o, 'metal', x, z, r + 0.65, y - 0.3, 0.3, col, 8);
  cylinder(o, 'metal', x, z, r, y, 0.65, col, 8);
  cylinder(o, 'glass', x, z, r, y + 0.65, 1.85, glazing, 8);
  cylinder(o, 'metal', x, z, r + 0.15, y + 2.5, 0.22, col, 8);
  cylinder(o, 'metal', x, z, r + 0.12, y + 2.72, 0.22, col, 8, r * 0.8);
  if (detail) {
    const ring = radialRing(y + 0.62, r + 0.025, r + 0.025, 8, [x, z], Math.PI / 8);
    for (let i = 0; i < 8; i++) {
      const p = ring[i],
        q = ring[(i + 1) % 8];
      beam(o, 'metal', p, [p[0], y + 2.55, p[2]], 0.12, 0.12, col);
      if (detail > 1) {
        const mid = p.map((v, k) => (v + q[k]) / 2);
        beam(o, 'metal', mid, [mid[0], y + 2.55, mid[2]], 0.065, 0.065, col);
      }
    }
    rail(o, x, z, r + 0.53, y, col, detail, 16);
    if (tall && detail > 1) rail(o, x, z, r * 0.8, y + 2.94, col, detail, 8);
  }
}
function spiral(o, detail) {
  if (!detail) return;
  const turns = 13,
    start = 10,
    end = 48.2,
    n = turns * (detail === 1 ? 10 : detail === 2 ? 20 : 28),
    x = -2.65,
    z = 1.1;
  const point = (t, r, dy = 0) => [
    x + Math.cos(t * tau * turns) * r,
    start + t * (end - start) + dy,
    z + Math.sin(t * tau * turns) * r,
  ];
  for (let i = 0; i < n; i++) {
    const t = i / n,
      u = (i + 1) / n;
    const pts = [point(t, 0.14), point(t, 0.95), point(u, 0.95), point(u, 0.14)];
    if (detail > 1) for (const p of pts) p[1] = start + t * (end - start);
    quad(o, 'metal', pts, [0, 1, 0], cream);
    // Each tread has a short outer riser so the spiral does not disappear edge-on.
    if (detail > 1) {
      const a = pts[1],
        b = pts[2];
      quad(
        o,
        'metal',
        [a, b, [b[0], b[1] - 0.07, b[2]], [a[0], a[1] - 0.07, a[2]]],
        normalFor(a, b, [b[0], b[1] - 0.07, b[2]]),
        cream,
      );
      beam(o, 'metal', point(t, 0.97, 0.95), point(u, 0.97, 0.95), 0.045, 0.045, c.white);
      if (i % 3 === 0) beam(o, 'metal', point(t, 0.97), point(t, 0.97, 0.95), 0.04, 0.04, c.white);
    }
  }
  if (detail > 1) cylinder(o, 'metal', x, z, 0.1, start, end - start, c.white, 8);
}
function operations(o, detail) {
  const x = -3.25,
    z = 13.85,
    w = 34.2,
    d = 13.3;
  B(o, 'concrete', x, -0.7, z, w, 9.0, d, cream);
  B(o, 'concrete', 0, -0.7, 1.7, 9.1, 8.8, 11.1, cream);
  B(o, 'concrete', 0, 8.1, 1.7, 9.2, 0.22, 11.2, cream);
  // Flat canopies, parapet and first-floor belt are defining Moderne horizontal lines.
  B(o, 'concrete', x, 8.25, z, w + 1.9, 0.18, d + 1.4, cream);
  if (detail) {
    B(o, 'concrete', x, 8.43, z + 6.5, w, 0.95, 0.25, cream);
    B(o, 'concrete', x, 4.05, z + 6.75, w + 0.5, 0.18, 0.75, cream);
  }
  // Two garage openings at the northeastern/left end of the front facade.
  for (const xx of [-17.0, -12.2]) {
    pane(o, xx, 0.2, 20.53, 3.6, 3.65, detail);
    if (detail > 1) {
      B(o, 'metal', xx, 0.22, 20.56, 3.4, 1.5, 0.08, rgb('877d61'));
      for (const yy of [0.5, 1.0, 1.45]) B(o, 'metal', xx, yy, 20.61, 3.4, 0.04, 0.04, cream);
    }
  }
  for (const xx of [-17, -12.2, -7.4, -2.6, 2.2, 11.1]) pane(o, xx, 5.2, 20.53, 3.45, 1.7, detail);
  for (const xx of [-7.4, 2.2, 11.1]) pane(o, xx, 1.7, 20.53, 3.45, 1.8, detail);
  pane(o, -2.6, 0.4, 20.56, 1.75, 2.55, detail);
  if (detail) {
    B(o, 'concrete', -2.6, 3.05, 20.65, 2.25, 0.3, 0.3, cream);
    for (let i = 0; i < 3; i++)
      B(o, 'concrete', -2.6, i * 0.14, 21.3 - i * 0.22, 3.1, 0.14, 0.85, cream);
    for (const xx of [-19.3, -9.8, -5.0, -0.2, 4.5, 9.0, 13.2])
      B(o, 'concrete', xx, 0.1, 20.57, 0.2, 8.15, 0.15, cream);
  }
  // Curved projecting bay on the southwestern/right front. Rear half lies within the wall.
  const sides = detail > 1 ? 24 : 8;
  cylinder(o, 'concrete', 6.65, 20.35, 1.72, -0.7, 1.9, cream, sides);
  cylinder(o, 'glass', 6.65, 20.35, 1.735, 1.2, 2.1, glazing, sides);
  cylinder(o, 'concrete', 6.65, 20.35, 1.75, 3.3, 1.85, cream, sides);
  cylinder(o, 'glass', 6.65, 20.35, 1.735, 5.15, 1.9, glazing, sides);
  cylinder(o, 'concrete', 6.65, 20.35, 1.75, 7.05, 2.32, cream, sides);
  if (detail)
    for (let i = 0; i <= 6; i++) {
      const a = (i * Math.PI) / 6;
      for (const [y, h] of [
        [1.2, 2.1],
        [5.15, 1.9],
      ])
        B(
          o,
          'metal',
          6.65 + Math.cos(a) * 1.76,
          y,
          20.35 + Math.sin(a) * 1.76,
          0.07,
          h,
          0.07,
          cream,
        );
    }
  // Back and end elevations use conservative opening rhythm where references are incomplete.
  if (detail) {
    for (const xx of [-17, -12, -7, 7, 11])
      for (const yy of [1.5, 5.2]) pane(o, xx, yy, 7.17, 2.4, 1.65, detail, 'z', -1);
    for (const sign of [-1, 1])
      for (const zz of [9.5, 14.5, 18.4])
        for (const yy of [1.5, 5.2])
          pane(o, x + (sign * w) / 2 + sign * 0.025, yy, zz, 2.6, 1.65, detail, 'x', sign);
    for (const sign of [-1, 1])
      for (const zz of [-1.5, 3.8])
        for (const yy of [1.7, 5.2]) pane(o, sign * 4.58, yy, zz, 0.9, 1.3, detail, 'x', sign);
    for (const xx of [-2.8, 2.8])
      for (const yy of [1.7, 5.2]) pane(o, xx, yy, -3.88, 0.9, 1.3, detail, 'z', -1);
    // Photographed outside stair on the southwest end, two flights and a landing.
    B(o, 'metal', 14.9, 4.0, 13.85, 2.1, 0.18, 2.0, cream);
    for (let i = 0; i < 20; i++) {
      const yy = i * 0.2,
        zz = 19.8 - i * 0.3;
      B(o, 'metal', 14.9, yy, zz, 1.7, 0.12, 0.32, cream);
    }
    if (detail > 1)
      for (const xx of [14.05, 15.75]) {
        beam(o, 'metal', [xx, 0.95, 20], [xx, 4.95, 13.9], 0.06, 0.06, cream);
        for (let i = 0; i <= 10; i++)
          beam(
            o,
            'metal',
            [xx, i * 0.4, 19.8 - i * 0.6],
            [xx, i * 0.4 + 0.95, 19.8 - i * 0.6],
            0.05,
            0.05,
            cream,
          );
      }
  }
  cylinder(o, 'concrete', -0.8, 12.2, 3.1, 8.3, 2.0, cream, 8);
  cab(o, -0.8, 12.2, 10.3, 3.6, detail);
  if (detail > 1)
    for (const xx of [-18, 12]) {
      beam(o, 'metal', [xx, 8.4, 15.5], [xx, 21.5, 15.5], 0.07, 0.07, c.white);
      for (const zz of [12, 19])
        beam(o, 'metal', [xx, 8.4, zz], [xx, 13.7, 15.5], 0.035, 0.035, c.white);
    }
}
function build(o, detail) {
  operations(o, detail);
  const sides = detail === 0 ? 8 : detail === 1 ? 12 : detail === 2 ? 24 : 40;
  const bands = [
    [0, 9, cream],
    [9, 14, orange],
    [14, 20, cream],
    [20, 26, orange],
    [26, 32, cream],
    [32, 38, orange],
    [38, 44, cream],
    [44, 48.2, orange],
  ];
  for (const [lo, hi, col] of bands) {
    cylinder(o, 'metal', 0, 0, 2.286, lo, hi - lo, col, sides);
    B(o, 'metal', -0.15, lo, 2.18, 2.65, hi - lo, 1.45, col);
  }
  for (const [y, col] of [
    [20.5, orange],
    [31.5, cream],
    [42.5, cream],
  ]) {
    cylinder(o, 'metal', 0, 0, 3.6, y, 0.2, col, sides);
    rail(o, 0, 0, 3.49, y + 0.2, col, detail, 24);
    if (detail > 1)
      for (let i = 0; i < 8; i++) {
        const a = (i * tau) / 8;
        beam(
          o,
          'metal',
          [Math.cos(a) * 2.25, y - 0.8, Math.sin(a) * 2.25],
          [Math.cos(a) * 3.45, y, Math.sin(a) * 3.45],
          0.09,
          0.11,
          col,
        );
      }
  }
  spiral(o, detail);
  // Wider upper observation room on the tapered transition, distinct from the lower cab.
  cylinder(o, 'metal', 0, 0, 2.286, 48.2, 1.5, orange, 8, 4.05);
  cylinder(o, 'metal', 0, 0, 4.05, 49.7, 1.5, orange, 8);
  cab(o, 0, 0, 51.2, 3.9, detail, true);
  beam(o, 'metal', [-2, 54.14, 0], [-2, 59.5, 0], 0.07, 0.07, orange);
  if (detail) {
    for (const yy of [44.7, 46.9, 49.0]) pane(o, -0.15, yy, 2.92, 0.46, 0.58, detail);
    if (detail > 1)
      for (const y of [55.3, 57, 58.5])
        beam(o, 'metal', [-2.3, y, 0], [-1.7, y, 0], 0.035, 0.035, c.white);
  }
}
export function fordTower(o) {
  build(o, 3);
}
export function fordTowerSkyline(o) {
  build(o, 0);
}
export function fordTowerDistrict(o) {
  build(o, 1);
}
export function fordTowerStreet(o) {
  build(o, 2);
}
const surfaces = {
  ...landmarkSurfaces,
  glass: { ...landmarkSurfaces.glass, localRef: 'palette:#ffffff' },
};
export const fordTowerModel = {
  id: 'ford_island_control_tower',
  recipe: 'structure-ford-island-control-tower.mjs',
  key: 'ford_island_control_tower',
  cell: '87/87z',
  title: 'Ford Island control tower',
  brief:
    'Restored orange-and-white control/water tower, three intermediate circular balconies, elevator spine, spiral escape stair and upper octagonal glazed cab; attached cream Moderne operations building with garage bays, rounded bay and smaller aerological cab.',
  camera: [62, 35, 90],
  lookAt: [-2, 25, 6],
  build: fordTower,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  mediumFiContext: { scale: 1.6 },
  groundContactBasis:
    'Front entrance [-3.25,21] defines the 3.9986 m host datum. Preserved terrain spans -0.005437..0.0014 m across mapped vertices. Operations foundation closes to -0.7 m. Exact paving elevation is not surveyed.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-ford-island-control-tower.mjs',
    level: 'skyline',
    export: 'fordTowerSkyline',
    errorMeters: 1.2,
    authoredLevels: {
      district: { export: 'fordTowerDistrict', errorMeters: 0.35, surfaces },
      street: { export: 'fordTowerStreet', errorMeters: 0.15, surfaces },
    },
  },
  limitations: [
    'Original medium-fi restored exterior, using inspected local Qualla aerial for site context and museum/Warren LeMay supplemental front and side photographs for architectural evidence; not a measured survey.',
    'Museum sources describe 158 ft tower height and 168 ft observation access differently. The recipe approximates a 48.2 m shaft/tank transition and 51.2 m upper deck; individual levels, cabin roof and antenna heights are estimates.',
    'Orange/white restored exterior represents the modern tower, not the incomplete camouflage-era 1941 structure. Spiral tread count, hidden rear windows, rail subdivisions, doors and rooftop equipment are simplified.',
    'Includes the attached operations building and small aerological cab. Hangars, museum aircraft, interiors, vegetation and other site structures are excluded.',
    'Reference photographs are viewed for research and are not embedded or redistributed. Generalized map geometry and host terrain require review when using another elevation dataset.',
  ],
};
