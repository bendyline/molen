/** Imperial Hall, northern court and glazed portals of the unfinished Temple of Heaven site. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';

const frame = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/wx/wx4/temple_of_heaven/map-frame.json',
      import.meta.url,
    ),
  ),
);
if (frame.candidateId !== 'temple_of_heaven')
  throw new Error('Wrong northern Temple of Heaven source');
const rec = frame.reconstruction.north;
const { axis, normal, hall, floorY } = rec;
const point = (u, y, v) => [
  hall.center[0] + u * axis[0] + v * normal[0],
  floorY + y,
  hall.center[1] + u * axis[1] + v * normal[1],
];
const direction = (u, y, v) => [u * axis[0] + v * normal[0], y, u * axis[1] + v * normal[1]];

export function buildHeavenNorth(face, detail) {
  const quad = (role, coords, outward) =>
    face(
      role,
      coords.map(([u, y, v]) => point(u, y, v)),
      direction(...outward),
    );
  const box = (role, u0, u1, v0, v1, y0, y1, bottom = false) => {
    quad(
      role,
      [
        [u0, y0, v1],
        [u1, y0, v1],
        [u1, y1, v1],
        [u0, y1, v1],
      ],
      [0, 0, 1],
    );
    quad(
      role,
      [
        [u0, y0, v0],
        [u1, y0, v0],
        [u1, y1, v0],
        [u0, y1, v0],
      ],
      [0, 0, -1],
    );
    quad(
      role,
      [
        [u0, y0, v0],
        [u0, y0, v1],
        [u0, y1, v1],
        [u0, y1, v0],
      ],
      [-1, 0, 0],
    );
    quad(
      role,
      [
        [u1, y0, v0],
        [u1, y0, v1],
        [u1, y1, v1],
        [u1, y1, v0],
      ],
      [1, 0, 0],
    );
    // Portal pier/header tops are covered by their header/roof at skyline distance.
    if (detail > 0 || role !== 'gate')
      quad(
        role,
        [
          [u0, y1, v0],
          [u1, y1, v0],
          [u1, y1, v1],
          [u0, y1, v1],
        ],
        [0, 1, 0],
      );
    if (bottom)
      quad(
        role,
        [
          [u0, y0, v0],
          [u1, y0, v0],
          [u1, y0, v1],
          [u0, y0, v1],
        ],
        [0, -1, 0],
      );
  };
  const hipRoof = (u, v, hx, hz, eave, ridge, ornament = false) => {
    const n = detail === 0 ? 4 : 8;
    const outline = (x, z) =>
      n === 4
        ? [
            [-x, -z],
            [x, -z],
            [x, z],
            [-x, z],
          ]
        : [
            [-x, -z],
            [0, -z],
            [x, -z],
            [x, 0],
            [x, z],
            [0, z],
            [-x, z],
            [-x, 0],
          ];
    const tiers =
      detail === 0
        ? [
            [hx, hz, eave],
            [Math.max(0.2, hx - hz), 0.08, ridge],
          ]
        : [
            [hx, hz, eave],
            [hx - 0.5, hz - 0.35, eave + 0.45],
            [hx - hz * 0.55, hz * 0.4, eave + (ridge - eave) * 0.53],
            [Math.max(0.2, hx - hz), 0.08, ridge],
          ];
    const rings = tiers.map(([x, z, y], j) =>
      outline(x, z).map(([a, b], i) => [
        a + u,
        y + (j === 0 && n === 8 && i % 2 === 0 ? 0.28 : 0),
        b + v,
      ]),
    );
    for (let row = 1; row < rings.length; row++)
      for (let i = 0; i < n; i++) {
        const next = (i + 1) % n,
          a = rings[row - 1][i],
          b = rings[row - 1][next];
        const target = [(a[0] + b[0]) / 2 - u, 0.5, (a[2] + b[2]) / 2 - v];
        quad('roof', [a, b, rings[row][next], rings[row][i]], target);
      }
    const corners = (ring) => (n === 8 ? ring.filter((_, i) => i % 2 === 0) : ring);
    quad('roof', corners(rings.at(-1)), [0, 1, 0]);
    // Closed underside and fascia: back-face culling must not expose an empty roof.
    const underside = outline(hx, hz).map(([a, b]) => [
      a + u,
      eave - (detail > 0 ? 0.24 : 0),
      b + v,
    ]);
    quad('band', corners(underside), [0, -1, 0]);
    for (let i = 0; detail > 0 && i < n; i++)
      quad(
        'band',
        [underside[i], underside[(i + 1) % n], rings[0][(i + 1) % n], rings[0][i]],
        [underside[i][0] - u, 0, underside[i][2] - v],
      );
    if (detail > 0)
      box(
        'roof',
        u - Math.max(0.3, hx - hz) - 0.15,
        u + Math.max(0.3, hx - hz) + 0.15,
        v - 0.18,
        v + 0.18,
        ridge,
        ridge + 0.3,
        true,
      );
    if (detail >= 2 && ornament)
      for (const sign of [-1, 1]) {
        const end = u + sign * (hx - hz);
        const scale = Math.min(1, hx / 8);
        const sections = [
          [0, 0.12, 0.3],
          [0.14, 0.65, 0.24],
          [0.34, 1.15, 0.16],
        ].map(([lean, y, w]) =>
          [
            [-w, -0.22],
            [w, -0.22],
            [w, 0.22],
            [-w, 0.22],
          ].map(([a, b]) => [
            end + sign * lean * scale + a * scale,
            ridge + y * scale,
            v + b * scale,
          ]),
        );
        for (let j = 1; j < sections.length; j++)
          for (let i = 0; i < 4; i++) {
            const next = (i + 1) % 4;
            quad(
              'roof',
              [sections[j - 1][i], sections[j - 1][next], sections[j][next], sections[j][i]],
              [
                [0, 0, -1],
                [1, 0, 0],
                [0, 0, 1],
                [-1, 0, 0],
              ][i],
            );
          }
        quad('roof', sections.at(-1), [0, 1, 0]);
      }
  };
  const steps = (u, v, width, run, low, high, count) => {
    for (let i = 0; i < count; i++) {
      const v0 = v + run * (1 - (i + 1) / count),
        v1 = v + run * (1 - i / count),
        y0 = low + ((high - low) * i) / count,
        y1 = low + ((high - low) * (i + 1)) / count;
      if (detail === 0)
        quad(
          'stone',
          [
            [u - width / 2, low, v + run],
            [u + width / 2, low, v + run],
            [u + width / 2, high, v],
            [u - width / 2, high, v],
          ],
          [0, 1, 0],
        );
      else {
        quad(
          'stone',
          [
            [u - width / 2, y0, v1],
            [u + width / 2, y0, v1],
            [u + width / 2, y1, v1],
            [u - width / 2, y1, v1],
          ],
          [0, 0, 1],
        );
        quad(
          'stone',
          [
            [u - width / 2, y1, v1],
            [u + width / 2, y1, v1],
            [u + width / 2, y1, v0],
            [u - width / 2, y1, v0],
          ],
          [0, 1, 0],
        );
      }
      for (const sign of [-1, 1])
        quad(
          'stone',
          [
            [u + (sign * width) / 2, low - 0.15, v0],
            [u + (sign * width) / 2, low - 0.15, v1],
            [u + (sign * width) / 2, detail === 0 ? low : y1, v1],
            [u + (sign * width) / 2, detail === 0 ? high : y1, v0],
          ],
          [sign, 0, 0],
        );
    }
  };
  const court = rec.courtyard,
    platform = rec.platform;
  box('brick', -court.halfWidth, court.halfWidth, court.back, court.front, -1.3, 0);
  box(
    'stone',
    -platform.halfWidth,
    platform.halfWidth,
    -platform.halfDepth,
    platform.halfDepth,
    0,
    platform.top,
  );
  steps(
    0,
    platform.halfDepth,
    platform.frontStairWidth,
    platform.frontStairRun,
    0,
    platform.top,
    detail === 0 ? 1 : detail === 1 ? 4 : 10,
  );

  // Main body follows the four retained map vertices, not a generic axis-aligned rectangle.
  const footprint = hall.polygons[0].outline;
  for (let i = 0; i < footprint.length; i++) {
    const a = footprint[i],
      b = footprint[(i + 1) % footprint.length],
      m = a.map((x, k) => (x + b[k]) / 2 - hall.center[k]);
    face(
      'wall',
      [
        [a[0], floorY + platform.top, a[1]],
        [b[0], floorY + platform.top, b[1]],
        [b[0], floorY + rec.hallHeights.wallTop, b[1]],
        [a[0], floorY + rec.hallHeights.wallTop, a[1]],
      ],
      [m[0], 0, m[1]],
    );
  }
  hipRoof(
    0,
    0,
    rec.width / 2 + 1.8,
    rec.depth / 2 + 1.8,
    rec.hallHeights.roofEave,
    rec.hallHeights.roofRidge,
    true,
  );
  const front = rec.depth / 2 + 0.08;
  box(
    'band',
    -rec.width / 2 - 0.05,
    rec.width / 2 + 0.05,
    front - 0.18,
    front + 0.05,
    7.45,
    9.2,
    true,
  );
  if (detail > 0) {
    box('gold', -rec.width / 2, rec.width / 2, front + 0.06, front + 0.1, 7.45, 7.64, true);
    box('gold', -rec.width / 2, rec.width / 2, front + 0.06, front + 0.1, 8.85, 9.0, true);
  }
  for (let bay = 0; bay < 5; bay++) {
    const center = ((bay - 2) * rec.width) / 5,
      half = rec.width / 10 - 0.32;
    quad(
      'dark',
      [
        [center - half, 2.05, front + 0.03],
        [center + half, 2.05, front + 0.03],
        [center + half, 7.15, front + 0.03],
        [center - half, 7.15, front + 0.03],
      ],
      [0, 0, 1],
    );
    if (detail >= 2) {
      box('gold', center - 0.065, center + 0.065, front + 0.04, front + 0.13, 2.25, 7.0, true);
      for (const y of [3.6, 5.3])
        box('wall', center - half, center + half, front + 0.04, front + 0.15, y, y + 0.13, true);
      box('gold', center - half, center + half, front + 0.07, front + 0.13, 7.8, 8.5, true);
      box(
        'band',
        center - half + 0.22,
        center + half - 0.22,
        front + 0.14,
        front + 0.18,
        7.94,
        8.35,
        true,
      );
    }
  }
  if (detail >= 2)
    for (let column = 0; column < 6; column++) {
      const u = -rec.width / 2 + (column * rec.width) / 5;
      box('wall', u - 0.27, u + 0.27, front - 0.3, front + 0.4, platform.top, 7.5, true);
      box(
        'stone',
        u - 0.39,
        u + 0.39,
        front - 0.4,
        front + 0.5,
        platform.top,
        platform.top + 0.32,
        true,
      );
    }
  if (detail > 0) {
    box('gold', -1.25, 1.25, front + 0.12, front + 0.18, 8.0, 9.7, true);
    box('roof', -1.04, 1.04, front + 0.19, front + 0.23, 8.18, 9.52, true);
  }
  // Gray brick enclosure; extent is a picture-guided estimate, not a mapped wall survey.
  const wall = (u0, u1, v0, v1) => {
    box('brick', u0, u1, v0, v1, 0, court.wallHeight);
    if (detail > 0)
      box('roof', u0 - 0.1, u1 + 0.1, v0 - 0.1, v1 + 0.1, court.wallHeight, court.wallHeight + 0.2);
  };
  wall(-court.halfWidth, court.halfWidth, court.back, court.back + court.wallThickness);
  for (const sign of [-1, 1])
    wall(
      sign * court.halfWidth - court.wallThickness / 2,
      sign * court.halfWidth + court.wallThickness / 2,
      court.back,
      court.front,
    );
  let last = -court.halfWidth;
  for (const gate of rec.gates) {
    const u = rec.gateAt[0] + gate.offset,
      v = rec.gateAt[1],
      half = gate.openingWidth / 2,
      pier = 0.85,
      depth = 1.1;
    const left = u - half - pier,
      right = u + half + pier;
    if (left > last) wall(last, left, v - 0.3, v + 0.3);
    for (const sign of [-1, 1]) {
      const a = sign < 0 ? left : u + half,
        b = sign < 0 ? u - half : right;
      box('gate', a, b, v - depth, v + depth, 0.3, gate.openingHeight);
      box('stone', a - 0.14, b + 0.14, v - depth - 0.1, v + depth + 0.1, 0, 0.3);
    }
    box('gate', left, right, v - depth, v + depth, gate.openingHeight, gate.eave - 0.35, true);
    box(
      'band',
      left - 0.08,
      right + 0.08,
      v - depth - 0.15,
      v + depth + 0.15,
      gate.eave - 0.38,
      gate.eave,
      true,
    );
    if (detail > 0)
      box(
        'gold',
        left,
        right,
        v + depth + 0.16,
        v + depth + 0.2,
        gate.eave - 0.32,
        gate.eave - 0.12,
        true,
      );
    hipRoof(u, v, (right - left) / 2 + 0.55, depth + 0.65, gate.eave, gate.ridge, true);
    last = right;
  }
  if (last < court.halfWidth) wall(last, court.halfWidth, court.front - 0.3, court.front + 0.3);
  if (detail >= 2) {
    // Broad stone railing panels keep the platform perimeter legible without tiny balusters.
    for (const sign of [-1, 1])
      box(
        'stone',
        sign * (platform.halfWidth - 0.55) - 0.13,
        sign * (platform.halfWidth - 0.55) + 0.13,
        -10.5,
        10.5,
        platform.top + 0.15,
        platform.top + 0.95,
        true,
      );
    box('stone', -19.5, 19.5, -10.65, -10.35, platform.top + 0.15, platform.top + 0.95, true);
    for (const sign of [-1, 1])
      box(
        'stone',
        sign < 0 ? -19.5 : 3.3,
        sign < 0 ? -3.3 : 19.5,
        10.35,
        10.65,
        platform.top + 0.15,
        platform.top + 0.95,
        true,
      );
  }
  // World-aligned connector meets the pre-existing north terrace stair foot.
  const c = rec.connector,
    count = detail === 0 ? 1 : detail === 1 ? 4 : 10;
  face(
    'brick',
    [
      [-9, floorY + 0.015, -58],
      [9, floorY + 0.015, -58],
      [9, floorY + 0.015, c.startZ],
      [-9, floorY + 0.015, c.startZ],
    ],
    [0, 1, 0],
  );
  for (let i = 0; i < count; i++) {
    const z0 = c.endZ + ((c.startZ - c.endZ) * i) / count,
      z1 = c.endZ + ((c.startZ - c.endZ) * (i + 1)) / count;
    const y0 = c.low + ((c.high - c.low) * i) / count,
      y1 = c.low + ((c.high - c.low) * (i + 1)) / count;
    if (detail === 0)
      face(
        'stone',
        [
          [-c.halfWidth, y0, z0],
          [c.halfWidth, y0, z0],
          [c.halfWidth, y1, z1],
          [-c.halfWidth, y1, z1],
        ],
        [0, 1, 0],
      );
    else {
      face(
        'stone',
        [
          [-c.halfWidth, y0, z0],
          [c.halfWidth, y0, z0],
          [c.halfWidth, y1, z0],
          [-c.halfWidth, y1, z0],
        ],
        [0, 0, -1],
      );
      face(
        'stone',
        [
          [-c.halfWidth, y1, z0],
          [c.halfWidth, y1, z0],
          [c.halfWidth, y1, z1],
          [-c.halfWidth, y1, z1],
        ],
        [0, 1, 0],
      );
    }
    for (const sign of [-1, 1])
      face(
        'stone',
        [
          [sign * c.halfWidth, c.low - 0.15, z0],
          [sign * c.halfWidth, c.low - 0.15, z1],
          [sign * c.halfWidth, y1, z1],
          [sign * c.halfWidth, detail === 0 ? y0 : y1, z0],
        ],
        [sign, 0, 0],
      );
  }
}
