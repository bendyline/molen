/** Hermannsdenkmal's stepped eastern landing and sampled hilltop foundation. */
import { readFileSync } from 'node:fs';
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import { finalHeritageTowers } from './final-heritage-tower-models.mjs';
import { annulus, face, transform } from './heritage-tower-detail-mesh.mjs';
import { box, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const { foundationBottom, staircase } = JSON.parse(
  readFileSync(structureSourcePath('hermannsdenkmal', 'fit-controls.json')),
);
const original = finalHeritageTowers.find((tower) => tower.id === 'hermannsdenkmal').build;
const stone = [0.49, 0.48, 0.43];
const shadowStone = [0.41, 0.41, 0.37];
const rail = [0.16, 0.18, 0.16];
const point = (r, y, a) => [r * Math.sin(a), y, r * Math.cos(a)];
const arcadePhase = staircase.radial.angle - (11 * Math.PI) / 10;

function sector(out, inner, outer, from, to, bottom, top, color) {
  const a = Math.min(from, to);
  const b = Math.max(from, to);
  const ring = (y) => [
    point(inner, y, a),
    point(outer, y, a),
    point(outer, y, b),
    point(inner, y, b),
  ];
  loft(out, 'grunewald_stone', [ring(bottom), ring(top)], color);
}

function entrance(out, skyline = false) {
  const { innerRadius, outerRadius, landingY, landingInnerRadius, flights, radial } = staircase;
  for (const flight of flights) {
    const { footY, groundY, startAngle, endAngle } = flight;
    const steps = skyline ? 3 : flight.steps;
    const angle = (i) => startAngle + ((endAngle - startAngle) * i) / steps;
    const height = (i) => footY + ((landingY - footY) * i) / steps;
    for (let i = 0; i < steps; i++) {
      const color = i % 3 === 1 ? [0.52, 0.51, 0.46] : stone;
      sector(
        out,
        innerRadius,
        outerRadius,
        angle(i),
        angle(i + 1),
        groundY - 0.35,
        height(i + 1),
        color,
      );
    }
    if (skyline) continue;
    for (let i = 0; i < steps; i += 2) {
      const a = angle(i);
      const b = angle(i + 2);
      const radius = outerRadius - 0.09;
      beam(
        out,
        'metal',
        point(radius, height(i) + 0.62, a),
        point(radius, height(i + 2) + 0.62, b),
        0.045,
        0.045,
        rail,
      );
      beam(
        out,
        'metal',
        point(radius, height(i + 1), a),
        point(radius, height(i) + 0.62, a),
        0.047,
        0.047,
        rail,
      );
    }
  }
  const [a, b] = flights.map((f) => f.endAngle).sort((p, q) => p - q);
  const landingSegments = skyline ? 2 : 5;
  for (let i = 0; i < landingSegments; i++)
    sector(
      out,
      landingInnerRadius,
      outerRadius,
      a + ((b - a) * i) / landingSegments,
      a + ((b - a) * (i + 1)) / landingSegments,
      -0.08,
      landingY,
      stone,
    );

  const steps = transform(out, radial.angle);
  const risers = skyline ? 2 : radial.steps;
  const treadLength = (radial.outerRadius - radial.innerRadius) / risers;
  for (let i = 0; i < risers; i++) {
    const outer = radial.outerRadius - i * treadLength;
    const top = landingY + ((radial.topY - landingY) * (i + 1)) / risers;
    box(
      steps,
      'grunewald_stone',
      [-radial.width / 2, landingY - 0.08, outer - treadLength],
      [radial.width / 2, top, outer],
      stone,
    );
  }
}

function weatheredStone(out) {
  const arcade = transform(out, arcadePhase);
  const surface = (method) => (slot, ref, points, normal, uv, color) => {
    if (slot === 'limestone') {
      const atArcade = points.every(([x, y, z]) => y >= 2.7 && y <= 17.84 && Math.hypot(x, z) > 5);
      (atArcade ? arcade : out)[method]('grunewald_stone', ref, points, normal, uv, [
        color[0] * 0.88,
        color[1] * 0.96,
        color[2] * 1.15,
      ]);
    } else out[method](slot, ref, points, normal, uv, color);
  };
  return {
    addQuad: surface('addQuad'),
    addTriangle: surface('addTriangle'),
    addConvexPolygon: surface('addConvexPolygon'),
  };
}

export function buildFittedHermannsdenkmal(out) {
  original(weatheredStone(out));
  const skirt = [
    radialRing(foundationBottom, 10.245, 10.245, 80),
    radialRing(0.01, 10.245, 10.245, 80),
  ];
  loft(out, 'grunewald_stone', skirt, shadowStone, { cap: false });
  annulus(out, 'grunewald_stone', 7.98, 8.28, 19.08, 19.63, stone, 80);
  for (let i = 0; i < 10; i++) {
    const capital = transform(out, arcadePhase + (i * Math.PI) / 5);
    sphere(capital, 'grunewald_stone', [0, 17.6, 7.84], [0.48, 0.47, 0.53], shadowStone, 12, 8);
    beam(capital, 'metal', [0, 18.44, 7.81], [0, 18.3, 9.08], 0.14, 0.16, rail);
  }
  entrance(out);
}

function distantMonument(out, district) {
  const wallSides = district ? 40 : 12;
  const form = (profile, color, sides = wallSides, center = [0, 0], slot = 'grunewald_stone') =>
    loft(
      out,
      slot,
      profile.map(([y, rx, rz = rx]) => radialRing(y, rx, rz, sides, center)),
      color,
    );
  const base = district
    ? [
        [foundationBottom, 10.25],
        [0.25, 10.25],
        [0.4, 10.03],
        [1.85, 10.03],
        [2.2, 9.8],
      ]
    : [
        [foundationBottom, 10.25],
        [1.85, 10.25],
        [2.2, 9.8],
      ];
  form(base, stone);
  form(
    [
      [2.2, 8.2],
      [2.8, 7.85],
    ],
    stone,
  );
  form(
    [
      [2.7, 4.75],
      [17.8, 4.75],
    ],
    shadowStone,
    district ? 24 : 8,
  );
  for (let i = 0; i < 10; i++) {
    const angle = arcadePhase + (i * Math.PI) / 5;
    const [x, , z] = point(6.95, 0, angle);
    const pier = district
      ? [
          [2.7, 1.48],
          [3.12, 1.48],
          [3.4, 1.22],
          [13.5, 1.11],
          [14.13, 1.48],
        ]
      : [
          [2.7, 1.48],
          [14.13, 1.26],
        ];
    form(pier, stone, district ? 6 : 4, [x, z]);
    if (district) {
      const capital = transform(out, angle);
      sphere(capital, 'grunewald_stone', [0, 17.6, 7.84], [0.47, 0.44, 0.5], shadowStone, 8, 5);
    }
    const bay = transform(out, angle + Math.PI / 10);
    const faceHeights = [
      [-2.18, 14.12],
      [-1.25, 15.8],
      [0, 16.17],
      [1.25, 15.8],
      [2.18, 14.12],
    ];
    for (let j = 1; j < faceHeights.length; j++) {
      const [u, y0] = faceHeights[j - 1];
      const [v, y1] = faceHeights[j];
      face(
        bay,
        'grunewald_stone',
        [
          [u, y0, 6.64],
          [v, y1, 6.64],
          [v, 17.8, 6.64],
          [u, 17.8, 6.64],
        ],
        stone,
      );
      if (district)
        face(
          bay,
          'grunewald_stone',
          [
            [u, y0, 5.92],
            [v, y1, 5.92],
            [v, y1, 6.64],
            [u, y0, 6.64],
          ],
          shadowStone,
        );
    }
  }
  form(
    [
      [17.72, 8.05],
      [18.48, 8.52],
      [19.63, 8.26],
    ],
    stone,
  );
  form(
    [
      [19.08, 5.72],
      [22.15, 5.28],
      [24.4, 4.24],
      [26.89, 3.14],
    ],
    stone,
  );
  entrance(out, !district);

  const copper = [0.35, 0.65, 0.61];
  const reduced = (profile, center = [0, 0]) =>
    form(profile, copper, district ? 12 : 6, center, 'metal');
  const link = (a, b, r, color = copper) => tube(out, 'metal', a, b, r, color, district ? 6 : 4);
  reduced([
    [26.86, 3.2],
    [27.25, 2.78],
  ]);
  link([-1.05, 27.3, 0.3], [-1.03, 36.8, 0], 0.7);
  link([1.32, 27.53, -0.42], [0.77, 33.65, 0.35], 0.69);
  link([0.77, 33.5, 0.35], [0.7, 36.85, 0], 0.88);
  reduced([
    [35.7, 2.16, 1.13],
    [38.2, 1.57, 0.96],
    [41.55, 1.91, 1.02],
    [42.25, 1.1, 0.83],
  ]);
  reduced(
    [
      [30.2, 1.3, 0.34],
      [36.8, 2.06, 0.44],
      [41.75, 1.16, 0.25],
    ],
    [0.15, -1.15],
  );
  reduced(
    [
      [27.15, 0.27, 0.13],
      [30.6, 1.08, 0.25],
      [37.15, 0.72, 0.18],
    ],
    [2.41, 0.39],
  );
  reduced([
    [42.15, 0.48, 0.53],
    [43.5, 0.8, 0.77],
    [44.32, 0.92, 0.8],
    [44.82, 0.2, 0.24],
  ]);
  for (const sign of [-1, 1]) link([sign * 0.67, 44, 0], [sign * 1.5, 45.27, -0.29], 0.23);
  link([-1.62, 41.3, 0.1], [-2.41, 43.55, 0.2], 0.65);
  link([-2.35, 43.3, 0.2], [-2.91, 46.56, 0.28], 0.43);
  link([1.67, 41.12, 0.02], [2.21, 39.28, 0.24], 0.62);
  link([2.21, 39.28, 0.24], [2.47, 37.16, 0.53], 0.48);
  form(
    [
      [46.46, 0.14, 0.059],
      [52.91, 0.14, 0.059],
      [53.46, 0.012],
    ],
    [0.74, 0.72, 0.62],
    4,
    [-2.9, 0.3],
    'metal',
  );
  box(out, 'metal', [-3.65, 46.72, 0.2], [-2.15, 46.93, 0.39], copper);
}

export function buildHermannsdenkmalSkyline(out) {
  distantMonument(out, false);
}

export function buildHermannsdenkmalDistrict(out) {
  distantMonument(out, true);
}
