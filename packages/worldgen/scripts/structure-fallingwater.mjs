/** Fallingwater: crossed cantilevers and stone core above Bear Run, with uphill guest wing. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { decodePng16 } from '../../terrain/dist/kernel.mjs';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, c, cleanRing, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const framePath = new URL(
  '../../../content/worldgen/source/places/dp/dpp/fallingwater/map-frame.json',
  import.meta.url,
);
const surveyPath = new URL(
  '../../../content/worldgen/source/places/dp/dpp/fallingwater/survey-controls.json',
  import.meta.url,
);
const mainSurveyPath = new URL(
  '../../../content/worldgen/source/places/dp/dpp/fallingwater/main-survey-controls.json',
  import.meta.url,
);
const channelPath = new URL(
  '../../../content/worldgen/source/places/dp/dpp/fallingwater/rock-channel-controls.json',
  import.meta.url,
);
const buff = rgb('e1d2a4'),
  masonry = rgb('a8a795'),
  red = rgb('713e32'),
  water = rgb('566560'),
  rock = rgb('858676');
function polygon(o, r, y0, y1, color, slot = 'concrete', top = color, caps = true) {
  r = cleanRing(r);
  if (
    r.reduce(
      (s, a, i) => s + a[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * a[1],
      0,
    ) < 0
  )
    r.reverse();
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    quad(
      o,
      slot,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [b[1] - a[1], 0, a[0] - b[0]],
      color,
    );
  }
  if (!caps) return;
  const ii = earcut(r.flat());
  for (const [y, n, col] of [
    [y0, [0, -1, 0], color],
    [y1, [0, 1, 0], top],
  ])
    for (let i = 0; i < ii.length; i += 3) {
      const p = ii.slice(i, i + 3).map((j) => [r[j][0], y, r[j][1]]);
      o.addTriangle(
        slot,
        'palette:#ffffff',
        p,
        n,
        p.map((p) => [p[0], p[2]]),
        col,
      );
    }
}
function rounded(x, z, w, d, r, detail) {
  if (!detail)
    return [
      [x - w / 2, z - d / 2],
      [x + w / 2, z - d / 2],
      [x + w / 2, z + d / 2],
      [x - w / 2, z + d / 2],
    ];
  const pts = [];
  for (const [cx, cz, start] of [
    [x + w / 2 - r, z + d / 2 - r, 0],
    [x - w / 2 + r, z + d / 2 - r, Math.PI / 2],
    [x - w / 2 + r, z - d / 2 + r, Math.PI],
    [x + w / 2 - r, z - d / 2 + r, Math.PI * 1.5],
  ])
    for (let i = 0; i <= 3; i++) {
      const a = start + (i * Math.PI) / 6;
      pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
  return pts;
}
function slab(o, x, z, w, d, y, h, detail, top = c.roof) {
  polygon(o, rounded(x, z, w, d, 0.16, detail > 1), y, y + h, buff, 'concrete', top);
}
function perforatedSlab(o, outline, opening, y0, y1, color) {
  const outer = cleanRing(outline),
    hole = cleanRing(opening);
  const area = (r) =>
    r.reduce((s, a, i) => s + a[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * a[1], 0);
  if (area(outer) < 0) outer.reverse();
  if (area(hole) > 0) hole.reverse();
  for (const ring of [outer, hole])
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        p = [
          [a[0], y0, a[1]],
          [b[0], y0, b[1]],
          [b[0], y1, b[1]],
          [a[0], y1, a[1]],
        ];
      quad(o, 'concrete', p, normalFor(...p), color);
    }
  const vertices = [...outer, ...hole],
    triangles = earcut(vertices.flat(), [outer.length]);
  for (const top of [false, true])
    for (let i = 0; i < triangles.length; i += 3) {
      const p = triangles
        .slice(i, i + 3)
        .map((j) => [vertices[j][0], top ? y1 : y0, vertices[j][1]]);
      if (normalFor(...p)[1] > 0 !== top) p.reverse();
      o.addTriangle(
        'concrete',
        'palette:#ffffff',
        p,
        normalFor(...p),
        p.map(([x, , z]) => [x, z]),
        color,
      );
    }
}
function stoneBlock(o, x, y, z, w, h, d, detail) {
  B(o, 'stone', x, y, z, w, h, d, masonry);
  if (detail < 2) return;
  // Irregular individual ledges replace the old continuous concrete stripes.
  // The original HABS photographs show pronounced, thin horizontal sandstone courses.
  const rowHeight = detail > 2 ? 0.21 : 0.65;
  for (let row = 0; row < Math.floor(h / rowHeight); row++) {
    const yy = y + row * rowHeight + 0.025;
    for (const [axis, width, depth] of [
      [0, w, d],
      [2, d, w],
    ]) {
      const count = Math.max(1, Math.ceil(width / (detail > 2 ? 0.95 : 1.8)));
      for (let j = 0; j < count; j++) {
        const left = -width / 2 + (width * j) / count,
          right = -width / 2 + (width * (j + 1)) / count,
          offset = ((row + j * 3) % 4) * 0.012,
          length = right - left - 0.025,
          projection = 0.035 + ((row * 7 + j * 3) % 5) * 0.015,
          height = 0.21 * (0.59 + ((row + j) % 3) * 0.08),
          shade = masonry.map((v) => v * (0.78 + ((row * 3 + j * 7) % 7) * 0.035));
        for (const sign of [-1, 1]) {
          const along = (left + right) / 2,
            across = sign * (depth / 2 + projection / 2);
          B(
            o,
            'stone',
            x + (axis === 0 ? along : across),
            yy + offset,
            z + (axis === 0 ? across : along),
            axis === 0 ? length : projection,
            height,
            axis === 0 ? projection : length,
            shade,
          );
        }
      }
    }
  }
}
function glazing(o, a, b, y, h, detail) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    n = [dz / len, 0, -dx / len];
  const pp = (t, v, d = 0.025) => [a[0] + dx * t + n[0] * d, y + v, a[1] + dz * t + n[2] * d];
  quad(o, 'glass', [pp(0, 0), pp(1, 0), pp(1, h), pp(0, h)], n, c.glass);
  if (!detail) return;
  const count = Math.max(1, Math.round(len / (detail > 1 ? 1.25 : 2.5)));
  for (let i = 0; i <= count; i++)
    beam(o, 'metal', pp(i / count, 0, 0.035), pp(i / count, h, 0.035), 0.065, 0.075, red);
  for (const t of detail > 1 ? [0, 0.3, 0.75, 1] : [0, 1])
    beam(o, 'metal', pp(0, h * t, 0.045), pp(1, h * t, 0.045), 0.055, 0.065, red);
}
function walkPlate(o, a, b, width, height, detail) {
  if (detail) {
    beam(o, 'stone', a, b, width, height, masonry);
    return;
  }
  const dx = b[0] - a[0],
    dz = b[2] - a[2],
    len = Math.hypot(dx, dz),
    nx = ((-dz / len) * width) / 2,
    nz = ((dx / len) * width) / 2;
  quad(
    o,
    'stone',
    [
      [a[0] + nx, a[1] + height / 2, a[2] + nz],
      [b[0] + nx, b[1] + height / 2, b[2] + nz],
      [b[0] - nx, b[1] + height / 2, b[2] - nz],
      [a[0] - nx, a[1] + height / 2, a[2] - nz],
    ],
    [0, 1, 0],
    masonry,
  );
}
// The native grid is a source of contact heights only. These model-owned rock
// faces and retaining walls do not resample, flatten or modify that heightfield.
function siteGround() {
  const grid = JSON.parse(fs.readFileSync(new URL('terrain-grid.json', channelPath))),
    descriptor = JSON.parse(fs.readFileSync(new URL('terrain-review.terrain.json', channelPath))),
    png = decodePng16(fs.readFileSync(new URL('terrain-review.height.png', channelPath))),
    heights = Array.from(png.data, (v) =>
      Math.fround(descriptor.height.min + v * (descriptor.height.max - descriptor.height.min)),
    );
  return (x, z) => {
    const fx = (x - grid.origin[0]) / grid.stepMeters,
      fz = (z - grid.origin[1]) / grid.stepMeters,
      ix = Math.floor(fx),
      iz = Math.floor(fz),
      u = fx - ix,
      v = fz - iz,
      n = grid.size[0],
      a = heights[iz * n + ix],
      b = heights[iz * n + ix + 1],
      d = heights[(iz + 1) * n + ix],
      e = heights[(iz + 1) * n + ix + 1];
    return u + v <= 1 ? a + (b - a) * u + (d - a) * v : e + (d - e) * (1 - u) + (b - e) * (1 - v);
  };
}
function lowerStairCut() {
  const data = JSON.parse(fs.readFileSync(mainSurveyPath)),
    controls = JSON.parse(fs.readFileSync(surveyPath)),
    trace = data.traceFrame,
    center = [
      trace.modelXZ[0] + (785 - trace.referencePixel[0]) * trace.metersPerPixel,
      trace.modelXZ[1] + (183 - trace.referencePixel[1]) * trace.metersPerPixel,
    ],
    path = [];
  // Same 15 risers as the upper-hall stair. Only the lower canopy flight
  // needs excavation; higher flights retain their original ground underneath.
  for (let i = 0; i <= 15; i++) {
    const a = Math.PI / 2 - (Math.PI * i) / 15;
    path.push({
      x: center[0] + Math.cos(a) * 1.55,
      z: center[1] + Math.sin(a) * 1.55,
      y:
        data.levelsAboveMainFloor.second +
        ((data.levelsAboveMainFloor.third - data.levelsAboveMainFloor.second) * i) / 15 -
        0.1,
      nx: Math.cos(a),
      nz: Math.sin(a),
    });
  }
  const points = controls.canopy.stations.map(([x, z]) => [x, z]);
  for (let j = 1; j <= 12; j++) {
    const t = j / 12,
      at = (t) =>
        [0, 1].map((axis) => {
          const [a, b, c, d] = [points[0], points[0], points[1], points[2]].map((p) => p[axis]);
          return (
            0.5 *
            (2 * b +
              (-a + c) * t +
              (2 * a - 5 * b + 4 * c - d) * t * t +
              (-a + 3 * b - 3 * c + d) * t * t * t)
          );
        }),
      p = at(t),
      a = at(Math.max(0, t - 0.001)),
      b = at(Math.min(1, t + 0.001)),
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    path.push({
      x: p[0],
      z: p[1],
      y:
        controls.canopy.stations[0][2] +
        (controls.canopy.stations[1][2] - controls.canopy.stations[0][2]) * t -
        0.1,
      nx: -(b[1] - a[1]) / len,
      nz: (b[0] - a[0]) / len,
    });
  }
  return path;
}
function cutOutline(path, halfWidth) {
  return [
    ...path.map((p) => [p.x + p.nx * halfWidth, p.z + p.nz * halfWidth]),
    ...path
      .slice()
      .reverse()
      .map((p) => [p.x - p.nx * halfWidth, p.z - p.nz * halfWidth]),
  ];
}
function stairRockFaces(o, detail) {
  const path = lowerStairCut(),
    ground = siteGround();
  const face = (points) => {
    for (const ids of [
      [0, 1, 2],
      [0, 2, 3],
    ]) {
      const p = ids.map((i) => points[i]);
      if (normalFor(...p)[1] < 0) p.reverse();
      o.addTriangle(
        'bedrock',
        'palette:#ffffff',
        p,
        normalFor(...p),
        p.map(([x, , z]) => [x, z]),
        rock,
      );
    }
  };
  if (detail < 2) {
    // A continuous rock surface retains the exact opening boundary at distant
    // levels. Interior stair detail can collapse without creating holes in ground.
    const outer = cutOutline(path, 1.25).map(([x, z]) => [x, ground(x, z), z]),
      inner = cutOutline(
        [0, 5, 10, 15, 21, 27].map((i) => path[i]),
        0.9,
      ),
      inner3 = inner.map(([x, z], i) => {
        const selected = [0, 5, 10, 15, 21, 27],
          index = i < 6 ? i : 11 - i;
        return [x, path[selected[index]].y - 0.13, z];
      }),
      vertices = [...outer, ...inner3];
    for (const [points, holes] of [
      [vertices, [outer.length]],
      [inner3, []],
    ]) {
      const ids = earcut(
        points.flatMap(([x, , z]) => [x, z]),
        holes,
      );
      for (let j = 0; j < ids.length; j += 3) {
        const p = ids.slice(j, j + 3).map((i) => points[i]);
        if (normalFor(...p)[1] < 0) p.reverse();
        o.addTriangle(
          'bedrock',
          'palette:#ffffff',
          p,
          normalFor(...p),
          p.map(([x, , z]) => [x, z]),
          rock,
        );
      }
    }
  }
  // Rock under the steps closes the opening; the stone treads remain separate.
  for (let i = 0; detail >= 2 && i < path.length - 1; i++) {
    const a = path[i],
      b = path[i + 1],
      edge = (p, sign, width, native) => {
        const x = p.x + p.nx * width * sign,
          z = p.z + p.nz * width * sign;
        return [x, native ? ground(x, z) : p.y - 0.13, z];
      };
    face([edge(a, 1, 0.9), edge(b, 1, 0.9), edge(b, -1, 0.9), edge(a, -1, 0.9)]);
    for (const sign of [-1, 1]) {
      const outerA = edge(a, sign, 1.25, true),
        outerB = edge(b, sign, 1.25, true),
        ts = [0, 1];
      // Split only the rock's native boundary at actual terrain triangle crossings.
      for (const axis of [0, 2, -1]) {
        const value = (p) => (axis < 0 ? p[0] + p[2] : p[axis]),
          lo = value(outerA),
          hi = value(outerB),
          delta = hi - lo;
        if (Math.abs(delta) < 1e-9) continue;
        for (let k = Math.floor(Math.min(lo, hi)) + 1; k < Math.max(lo, hi); k++)
          ts.push((k - lo) / delta);
      }
      const sorted = ts.sort((a, b) => a - b).filter((t, i, all) => !i || t - all[i - 1] > 1e-7),
        mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
        innerA = edge(a, sign, 0.9),
        innerB = edge(b, sign, 0.9);
      for (let j = 0; j < sorted.length - 1; j++) {
        const p = mix(outerA, outerB, sorted[j]),
          q = mix(outerA, outerB, sorted[j + 1]);
        p[1] = ground(p[0], p[2]);
        q[1] = ground(q[0], q[2]);
        face([mix(innerA, innerB, sorted[j]), mix(innerA, innerB, sorted[j + 1]), q, p]);
      }
    }
  }
  // A narrow rocky cleft under the upper-hall bridge, visible in original HABS
  // photographs 1/2. Its bottom is physical rock, not an empty ground mask.
  const bridge = [
    [2.9, -3.17],
    [5.6, -3.17],
    [5.6, -9.4],
    [2.9, -9.4],
  ];
  polygon(o, bridge, -0.1, 0.2, rock, 'bedrock');
  for (let i = 1; i <= 3; i += 2) {
    const a = bridge[i],
      b = bridge[(i + 1) % 4],
      count = detail ? 14 : 4;
    for (let j = 0; j < count; j++) {
      const p = a.map((v, k) => v + ((b[k] - v) * j) / count),
        q = a.map((v, k) => v + ((b[k] - v) * (j + 1)) / count);
      face(
        [
          [p[0], 0.2, p[1]],
          [q[0], 0.2, q[1]],
          [q[0], ground(...q), q[1]],
          [p[0], ground(...p), p[1]],
        ].reverse(),
      );
    }
  }
}
function mainHouse(o, detail) {
  const data = JSON.parse(fs.readFileSync(mainSurveyPath)),
    level = data.levelsAboveMainFloor,
    trace = data.traceFrame,
    point = ([x, z]) => [
      trace.modelXZ[0] + (x - trace.referencePixel[0]) * trace.metersPerPixel,
      trace.modelXZ[1] + (z - trace.referencePixel[1]) * trace.metersPerPixel,
    ],
    mass = (ring, y0, y1, col = buff, slot = 'concrete') =>
      polygon(o, ring.map(point), y0, y1, col, slot, col, col !== c.dark),
    rect = ([x0, z0, x1, z1]) => [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ],
    wall = (a, b, y, h, width = 0.3, slot = 'concrete', col = buff) => {
      a = point(a);
      b = point(b);
      if (detail > 1 || (detail === 1 && h < 0.8))
        beam(o, slot, [a[0], y + h / 2, a[1]], [b[0], y + h / 2, b[1]], width, h, col);
      else {
        const dx = b[0] - a[0],
          dz = b[1] - a[1],
          length = Math.hypot(dx, dz),
          nx = ((dz / length) * width) / 2,
          nz = ((-dx / length) * width) / 2;
        for (const sign of [-1, 1])
          quad(
            o,
            slot,
            [
              [a[0] + sign * nx, y, a[1] + sign * nz],
              [b[0] + sign * nx, y, b[1] + sign * nz],
              [b[0] + sign * nx, y + h, b[1] + sign * nz],
              [a[0] + sign * nx, y + h, a[1] + sign * nz],
            ],
            [(sign * dz) / length, 0, (-sign * dx) / length],
            col,
          );
        quad(
          o,
          slot,
          [
            [a[0] - nx, y + h, a[1] - nz],
            [b[0] - nx, y + h, b[1] - nz],
            [b[0] + nx, y + h, b[1] + nz],
            [a[0] + nx, y + h, a[1] + nz],
          ],
          [0, 1, 0],
          col,
        );
      }
    },
    inside = (p, ring) => {
      let yes = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[i],
          b = ring[j];
        if (
          a[1] > p[1] !== b[1] > p[1] &&
          p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
        )
          yes = !yes;
      }
      return yes;
    },
    panels = (paths, rooms, y, h) => {
      for (const [from, to] of paths) {
        let a = point(from),
          b = point(to);
        const dx = b[0] - a[0],
          dz = b[1] - a[1],
          len = Math.hypot(dx, dz),
          outside = [(a[0] + b[0]) / 2 + (dz / len) * 0.08, (a[1] + b[1]) / 2 - (dx / len) * 0.08];
        if (rooms.some((r) => inside(outside, r.map(point)))) [a, b] = [b, a];
        glazing(o, a, b, y, h, detail);
      }
    };
  // Original floor plans distinguish occupied rooms from the open cantilevered terraces.
  const floorRing = detail
    ? data.floorRing
    : [
        [305, 395],
        [575, 395],
        [575, 493],
        [916, 493],
        [916, 593],
        [1230, 593],
        [1230, 655],
        [1041, 655],
        [1041, 949],
        [410, 949],
        [410, 788],
        [520, 788],
        [520, 575],
        [305, 575],
      ];
  perforatedSlab(
    o,
    floorRing.map(point),
    rect([806, 806, 947, 872]).map(point),
    -0.28,
    0.05,
    c.cream,
  );
  mass(data.livingRoomRing, 0.05, detail ? level.second - 0.28 : level.second, c.dark);
  if (detail) mass(data.livingRoomRing, level.second - 0.28, level.second, c.cream);
  if (detail) mass(rect(data.entryLoggiaRect), level.second - 0.28, level.second, c.cream);
  panels(data.livingGlazing, [data.livingRoomRing], 0.12, level.second - 0.48);
  const firstTerrace = rect([410, 788, 1041, 949]);
  for (const edge of [1, 2, 3]) wall(firstTerrace[edge], firstTerrace[(edge + 1) % 4], 0, 1.05);
  // Kitchen/servants' end is stone, unlike the living-room's red-framed glass frontage.
  if (detail) {
    mass(rect([305, 395, 420, 483]), -0.3, level.second - 0.28, masonry, 'stone');
    mass(rect([420, 400, 560, 575]), -0.3, level.second - 0.28, masonry, 'stone');
  } else mass(rect([305, 395, 560, 575]), -0.3, level.second - 0.28, masonry, 'stone');
  panels(
    [
      [
        [305, 483],
        [420, 483],
      ],
      [
        [420, 440],
        [420, 535],
      ],
    ],
    [rect([305, 395, 420, 483]), rect([420, 400, 560, 575])],
    0.35,
    1.65,
  );
  for (const room of data.secondRooms) mass(room, level.second + 0.05, level.third - 0.25, c.dark);
  if (detail)
    mass(rect(data.secondHallRect), level.second + 0.05, level.third - 0.25, masonry, 'stone');
  else
    quad(
      o,
      'stone',
      rect(data.secondHallRect)
        .map(point)
        .reverse()
        .map(([x, z]) => [x, level.second + 0.05, z]),
      [0, 1, 0],
      masonry,
    );
  panels(
    data.secondGlazing,
    data.secondRooms,
    level.second + 0.13,
    level.third - level.second - 0.43,
  );
  for (const terrace of data.secondTerraces) {
    const ring = rect(terrace.rect);
    mass(ring, level.second - 0.24, level.second + 0.05, c.cream);
    for (const edge of terrace.edges) wall(ring[edge], ring[(edge + 1) % 4], level.second, 1.05);
  }
  // The third-level slab also forms the lower rooms' broad, thin, east-west roof.
  mass(
    detail
      ? data.thirdSlabRing
      : [
          [420, 390],
          [685, 390],
          [685, 440],
          [925, 440],
          [925, 535],
          [1230, 535],
          [1230, 630],
          [1273, 630],
          [1273, 742],
          [465, 742],
          [465, 575],
          [420, 575],
        ],
    level.third - 0.28,
    level.third,
    c.cream,
  );
  for (const room of data.thirdRooms) mass(room, level.third + 0.04, level.roof - 0.25, c.dark);
  panels(data.thirdGlazing, data.thirdRooms, level.third + 0.13, level.roof - level.third - 0.43);
  const topTerrace = rect(data.thirdTerraceRect);
  for (const edge of [1, 2, 3])
    wall(topTerrace[edge], topTerrace[(edge + 1) % 4], level.third, 1.05);
  mass(
    detail ? data.thirdRoofRing : rect([420, 390, 865, 550]),
    level.roof - 0.25,
    level.roof,
    buff,
  );
  // The native mapped axes remain the geographic comparison for these interpreted core volumes.
  stoneBlock(o, -3.6, -2.5, 0.1, 2.8, level.chimney + 2.5, 4.2, detail);
  stoneBlock(o, -6.5, -2.5, -4.3, 3, 11.15, 3.2, detail);
  stoneBlock(o, -0.4, -2.5, 0, 1.35, level.roof + 2.5, 3.4, detail);
  glazing(o, [-5.45, -2.6], [-5.45, 2.2], 0.2, 7.7, detail);
  if (detail)
    for (const [x, z, w, d] of [
      [10.3, 3.3, 2.1, 4.4],
      [-4.1, 5.7, 3.4, 3.3],
    ])
      stoneBlock(o, x, -2.5, z, w, 2.55, d, detail);
  if (detail) {
    // Open pergola alongside the south bedroom terrace; no solid roof closes its slots.
    for (let j = 0; j < 9; j++)
      wall([810, 740 + j * 30], [935, 740 + j * 30], level.second + 0.06, 0.2, 0.2);
    for (let j = 0; j < 7; j++)
      wall([850 + j * 44, 310], [850 + j * 44, 570], level.second + 0.05, 0.19, 0.19);
    for (const x of [0, 3.3, 6.6])
      beam(o, 'concrete', [x, -0.5, 10.1], [x, -2.45, 4.7], 0.55, 0.6, buff);
  }
  // Surveyed hatch axis is east-west. Its platform is about7ft2in below the main terrace.
  const stair = data.streamStair,
    a = point(stair.startPixel),
    b = point(stair.endPixel),
    count = detail ? stair.risers : 1;
  for (let i = 0; i < count; i++) {
    const t0 = i / count,
      t1 = (i + 1) / count,
      y = level.streamPlatform * t1;
    beam(
      o,
      'concrete',
      [a[0] + (b[0] - a[0]) * t0, detail ? y : 0, a[1]],
      [a[0] + (b[0] - a[0]) * t1, y, b[1]],
      stair.widthMeters,
      0.12,
      buff,
    );
  }
  B(
    o,
    'concrete',
    b[0] + 0.2,
    level.streamPlatform - 0.12,
    b[1],
    1.2,
    0.15,
    stair.widthMeters + 0.2,
    buff,
  );
  if (detail)
    for (const sign of [-1, 1]) {
      const z = a[1] + sign * (stair.widthMeters / 2 + 0.05);
      beam(o, 'metal', [a[0], 1, z], [b[0], level.streamPlatform + 1, z], 0.045, 0.045, red);
      for (let i = 0; i <= stair.risers; i++) {
        const t = i / stair.risers,
          x = a[0] + (b[0] - a[0]) * t,
          y = level.streamPlatform * t;
        beam(o, 'metal', [x, y, z], [x, y + 1, z], 0.035, 0.035, red);
      }
    }
  // Exterior north bridge and curved stair link the upper hall to the higher covered walkway.
  const bridge = rect(data.canopyBridge.rect);
  mass(bridge, level.second - 0.25, level.second + 0.03, c.cream);
  if (detail)
    for (const edge of [1, 3]) wall(bridge[edge], bridge[(edge + 1) % 4], level.second, 0.82, 0.18);
  const center = point([785, 183]),
    radius = 1.55,
    arcSteps = detail ? 15 : 3;
  for (let i = 0; i < arcSteps; i++) {
    const a0 = Math.PI / 2 - (Math.PI * i) / arcSteps,
      a1 = Math.PI / 2 - (Math.PI * (i + 1)) / arcSteps,
      y = level.second + ((level.third - level.second) * (i + 1)) / arcSteps;
    const p = [center[0] + Math.cos(a0) * radius, y, center[1] + Math.sin(a0) * radius],
      q = [center[0] + Math.cos(a1) * radius, y, center[1] + Math.sin(a1) * radius];
    walkPlate(o, p, q, 1.75, 0.16, detail);
  }
  // Original photos show a solid cream parapet around the outside of this stair.
  const wallSteps = detail > 1 ? 15 : detail ? 5 : 3;
  for (let i = 0; i < wallSteps; i++) {
    const a = Math.PI / 2 - (Math.PI * i) / wallSteps,
      b = Math.PI / 2 - (Math.PI * (i + 1)) / wallSteps,
      floorA = level.second + ((level.third - level.second) * i) / wallSteps,
      floorB = level.second + ((level.third - level.second) * (i + 1)) / wallSteps,
      p = (angle, radius, y) => [
        center[0] + Math.cos(angle) * radius,
        y,
        center[1] + Math.sin(angle) * radius,
      ];
    for (const sign of [-1, 1])
      quad(
        o,
        'concrete',
        [
          p(a, 2.43 + sign * 0.08, floorA),
          p(b, 2.43 + sign * 0.08, floorB),
          p(b, 2.43 + sign * 0.08, floorB + 0.82),
          p(a, 2.43 + sign * 0.08, floorA + 0.82),
        ],
        [sign * Math.cos((a + b) / 2), 0, sign * Math.sin((a + b) / 2)],
        buff,
      );
    const top = [
      p(a, 2.35, floorA + 0.82),
      p(b, 2.35, floorB + 0.82),
      p(b, 2.51, floorB + 0.82),
      p(a, 2.51, floorA + 0.82),
    ];
    quad(o, 'concrete', top, normalFor(...top), buff);
  }
}
function guestWing(o, _frame, detail) {
  const controls = JSON.parse(fs.readFileSync(surveyPath)),
    ground = siteGround();
  const levels = controls.levelsAboveGuestFloor,
    plan = controls.guestPlan,
    floor = controls.guestFloorInModel,
    [ox, oz] = plan.origin,
    w = plan.returnWidthMeters,
    d = plan.returnDepthMeters,
    length = plan.lowRoofLengthMeters,
    depth = plan.lowWallDepthMeters,
    upperFloor = floor + levels.secondFloor,
    upperRoof = floor + levels.upperStoneWall,
    lowRoof = floor + levels.lowerStoneEave,
    fine = detail > 1 ? detail : 0,
    point = ([x, z]) => [ox + x, oz + z],
    block = (slot, x0, z0, x1, z1, y0, y1, col) =>
      B(o, slot, ox + (x0 + x1) / 2, y0, oz + (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, col),
    window = (a, b, y, h) => glazing(o, point(a), point(b), y, h, fine);
  // The low guest rooms and taller staff/car-court return have different roof levels.
  if (detail) {
    block('stone', 0, -depth, length, 0, floor - 0.9, floor + 1.5, masonry);
    block('concrete', 0, -depth, length, 0, floor + 1.5, lowRoof, buff);
  } else block('stone', 0, -depth, length, 0, floor - 0.9, lowRoof, masonry);
  slab(o, ox + length / 2, oz - depth / 2, length + 0.5, depth + 0.5, lowRoof, 0.18, detail, buff);
  block('stone', -w, -d, 0, 0, floor - 0.9, floor, masonry);
  block('stone', -0.3, -d, 0, 0, floor, upperFloor, masonry);
  block('stone', -w, -d, 0, -d + 0.3, floor, upperFloor, masonry);
  block('concrete', -w, -d, 0, 0, upperFloor - 0.18, upperFloor, buff);
  block('concrete', -w, -d, 0, 0, upperFloor, upperRoof, buff);
  slab(o, ox - w / 2, oz - d / 2, w + 0.45, d + 0.45, upperRoof, 0.18, detail, buff);
  const theater = plan.theaterTerraceRing.map(point);
  polygon(o, theater, floor - 0.9, upperFloor, masonry, 'stone', c.cream);
  for (let i = 0; i < 4; i++) {
    const a = theater[i],
      b = theater[i + 1];
    if (detail) {
      beam(
        o,
        'stone',
        [a[0], (upperFloor + floor + levels.chimney) / 2, a[1]],
        [b[0], (upperFloor + floor + levels.chimney) / 2, b[1]],
        0.35,
        floor + levels.chimney - upperFloor,
        masonry,
      );
    } else {
      const dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz),
        nx = (dz / len) * 0.175,
        nz = (-dx / len) * 0.175,
        top = floor + levels.chimney;
      for (const sign of [-1, 1])
        quad(
          o,
          'stone',
          [
            [a[0] + nx * sign, upperFloor, a[1] + nz * sign],
            [b[0] + nx * sign, upperFloor, b[1] + nz * sign],
            [b[0] + nx * sign, top, b[1] + nz * sign],
            [a[0] + nx * sign, top, a[1] + nz * sign],
          ],
          [(dz / len) * sign, 0, (-dx / len) * sign],
          masonry,
        );
      quad(
        o,
        'stone',
        [
          [a[0] - nx, top, a[1] - nz],
          [b[0] - nx, top, b[1] - nz],
          [b[0] + nx, top, b[1] + nz],
          [a[0] + nx, top, a[1] + nz],
        ],
        [0, 1, 0],
        masonry,
      );
    }
  }
  // Original plans and west elevation show an exposed car court at main level.
  // Its physical apron and short approach retain the hill at their edges.
  const court = plan.carCourtApproach,
    west = ox - w - court.apronWidthMeters,
    east = ox - w + court.interiorOverlapMeters,
    courtRows = [oz - d, oz, oz + court.approachRunMeters],
    row = (z, last) => [west, east].map((x) => [x, last ? ground(x, z) : floor, z]),
    rows = courtRows.map((z, i) => row(z, i === 2));
  for (let i = 0; i < rows.length - 1; i++) {
    quad(o, 'stone', [rows[i][0], rows[i + 1][0], rows[i + 1][1], rows[i][1]], [0, 1, 0], masonry);
    for (let side = 0; side < 2; side++) {
      const a = rows[i][side],
        b = rows[i + 1][side],
        count = detail > 1 ? Math.ceil(Math.abs(b[2] - a[2])) : 1;
      for (let j = 0; j < count; j++) {
        const p = a.map((v, k) => v + ((b[k] - v) * j) / count),
          q = a.map((v, k) => v + ((b[k] - v) * (j + 1)) / count),
          points = [p, q, [q[0], ground(q[0], q[2]), q[2]], [p[0], ground(p[0], p[2]), p[2]]];
        for (const ids of [
          [0, 1, 2],
          [0, 2, 3],
        ]) {
          const p = ids.map((i) => points[i]);
          // The last retaining face tapers exactly to zero at native grade.
          if (Math.hypot(...normalFor(...p)) < 0.5) continue;
          o.addTriangle(
            'stone',
            'palette:#ffffff',
            p,
            [side ? -1 : 1, 0, 0],
            p.map(([x, , z]) => [x, z]),
            masonry,
          );
        }
      }
    }
  }
  const back = rows[0];
  quad(
    o,
    'stone',
    [
      back[0],
      back[1],
      [back[1][0], ground(back[1][0], back[1][2]), back[1][2]],
      [back[0][0], ground(back[0][0], back[0][2]), back[0][2]],
    ],
    [0, 0, 1],
    masonry,
  );
  block('stone', -1.35, -4.5, -0.2, -3, floor, floor + levels.chimney, masonry);
  // The first-floor survey shows continuous stone paving between the guest rooms
  // and the raised pool. Keep it architectural geometry, separate from native ground.
  const terrace = plan.terraceConnection;
  polygon(
    o,
    terrace.outline.map(point),
    floor - terrace.slabThicknessMeters,
    floor,
    masonry,
    'stone',
  );
  // Threshold and pool-corner returns connect the continuous stone paving.
  for (const [x0, z0, x1, z1] of [
    [-0.5, -0.1, 0.1, 0.8],
    [plan.poolOrigin[0], plan.poolOrigin[1], plan.poolOrigin[0] + 0.65, plan.poolOrigin[1] + 0.65],
  ]) {
    if (detail) block('stone', x0, z0, x1, z1, floor - 0.2, floor, masonry);
    else
      quad(
        o,
        'stone',
        [
          [x0, z1],
          [x1, z1],
          [x1, z0],
          [x0, z0],
        ].map(([x, z]) => [ox + x, floor, oz + z]),
        [0, 1, 0],
        masonry,
      );
  }
  if (detail) {
    for (let i = 0; i < terrace.frontSteps; i++) {
      const z0 = 4.872 + i * terrace.frontStepRunMeters;
      block(
        'stone',
        5.9,
        z0,
        plan.poolOrigin[0],
        z0 + terrace.frontStepRunMeters,
        floor - terrace.frontStepRiseMeters * (i + 2),
        floor - terrace.frontStepRiseMeters * (i + 1),
        masonry,
      );
    }
    if (detail > 1) {
      // Sparse irregular paving joints suggest large flagstones without photo textures.
      for (let i = 0; i < 11; i++) {
        const x = 0.4 + i * 1.6;
        beam(
          o,
          'stone',
          [ox + x, floor + 0.005, oz + 0.08],
          [ox + x + (i % 2 ? 0.3 : -0.2), floor + 0.005, oz + 4.7],
          0.018,
          0.006,
          rock,
        );
      }
    }
  }
  // Close the exposed paving and lowest step to the natural slope with stone
  // foundations. The slab and step levels remain fixed by the architecture.
  for (const [a, b, top] of [
    [[0, 4.872], [5.9, 4.872], floor - 0.2],
    [[5.9, 5.772], [plan.poolOrigin[0], 5.772], floor - 0.6],
    [[27.67845, -4.8768], [27.67845, 0.3], floor - 0.2],
  ]) {
    const count = detail > 1 ? Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])) : 1;
    for (let i = 0; i < count; i++) {
      const p = point(a.map((v, k) => v + ((b[k] - v) * i) / count)),
        q = point(a.map((v, k) => v + ((b[k] - v) * (i + 1)) / count));
      const vertices = [
        [p[0], top, p[1]],
        [q[0], top, q[1]],
        [q[0], Math.min(top - 0.02, ground(...q) - 0.04), q[1]],
        [p[0], Math.min(top - 0.02, ground(...p) - 0.04), p[1]],
      ];
      quad(o, 'stone', vertices, normalFor(...vertices), masonry);
    }
  }
  // HABS photographs and sections show a raised, rounded cream pool beside the front terrace.
  const [poolX, poolZ] = plan.poolOrigin,
    poolLength = plan.poolLengthMeters,
    poolWidth = plan.poolWidthMeters,
    radius = plan.poolCornerRadiusMeters,
    coping = floor + levels.poolCoping,
    ring = [];
  const corners = [
    [poolX + poolLength - radius, poolZ + radius, -Math.PI / 2],
    [poolX + poolLength - radius, poolZ + poolWidth - radius, 0],
    [poolX + radius, poolZ + poolWidth - radius, Math.PI / 2],
    [poolX + radius, poolZ + radius, Math.PI],
  ];
  if (!detail)
    ring.push(
      ...[
        [poolX, poolZ],
        [poolX + poolLength, poolZ],
        [poolX + poolLength, poolZ + poolWidth],
        [poolX, poolZ + poolWidth],
      ].map(point),
    );
  else
    for (const [x, z, angle] of corners)
      for (let i = 0, count = detail > 1 ? 6 : 2; i <= count; i++) {
        const a = angle + ((Math.PI / 2) * i) / count;
        ring.push(point([x + Math.cos(a) * radius, z + Math.sin(a) * radius]));
      }
  polygon(o, ring, floor - 0.9, detail ? coping - 0.18 : coping, buff);
  const poolCenter = point([poolX + poolLength / 2, poolZ + poolWidth / 2]);
  const inset = ring.map(([x, z]) => [
    poolCenter[0] + (x - poolCenter[0]) * (1 - 0.4 / poolLength),
    poolCenter[1] + (z - poolCenter[1]) * (1 - 0.4 / poolWidth),
  ]);
  polygon(o, inset, coping - (detail ? 0.17 : 0.04), coping - (detail ? 0.15 : 0.02), water);
  for (let i = 0; detail && i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    beam(o, 'concrete', [a[0], coping - 0.08, a[1]], [b[0], coping - 0.08, b[1]], 0.2, 0.16, buff);
  }
  for (let i = 0; detail && i < 3; i++)
    block(
      'stone',
      poolX - 1.35 + i * 0.35,
      poolZ + 0.25,
      poolX,
      poolZ + 1.65,
      floor - 0.45,
      floor + ((i + 1) * levels.poolCoping) / 3,
      masonry,
    );
  if (detail) {
    // Rear clerestory, front room openings and an exposed trellis replace continuous glass strips.
    window([length - 0.3, -depth - 0.025], [0.3, -depth - 0.025], floor + 1.55, 0.48);
    window([0.35, 0.025], [5.8, 0.025], floor + 0.3, 1.7);
    window([9.8, 0.025], [length - 0.35, 0.025], floor + 0.3, 1.7);
    for (const z of [-1.8, -5.15, -8.5]) {
      // Recessed car-court bays are at the two-storey end, beneath the staff rooms.
      window([-w + 0.85, z + 1.35], [-w + 0.85, z - 1.35], floor + 0.08, levels.secondFloor - 0.28);
      block('stone', -w, z + 1.35, -w + 0.4, z + 1.65, floor, upperFloor, masonry);
      window([-w - 0.025, z + 0.95], [-w - 0.025, z - 0.95], upperFloor + 0.35, 1.45);
    }
    window([0.025, -d + 0.6], [0.025, -d + 3.5], upperFloor + 0.3, 1.5);
    const fins = detail > 1 ? 10 : 4;
    for (let i = 0; i < fins; i++) {
      const x = 7 + ((length - 6) * i) / (fins - 1);
      beam(
        o,
        'concrete',
        [ox + x, lowRoof, oz - 0.3],
        [ox + x, lowRoof, oz + 1.5],
        0.15,
        0.18,
        buff,
      );
    }
  }
  const points = controls.canopy.stations.map(([x, z]) => [x, z]);
  const at = (i, t) => {
    const p = [-1, 0, 1, 2].map((j) => points[Math.max(0, Math.min(points.length - 1, i + j))]);
    return [0, 1].map((axis) => {
      const [a, b, c, d] = p.map((q) => q[axis]);
      return (
        0.5 *
        (2 * b +
          (-a + c) * t +
          (2 * a - 5 * b + 4 * c - d) * t * t +
          (-a + 3 * b - 3 * c + d) * t * t * t)
      );
    });
  };
  const across = (i, t) => {
    const a = at(i, Math.max(0, t - 0.001)),
      b = at(i, Math.min(1, t + 0.001));
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz);
    return [-dz / length, dx / length];
  };
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i],
      b = points[i + 1],
      y0 = controls.canopy.stations[i][2],
      y1 = controls.canopy.stations[i + 1][2];
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz),
      roofY = y1 + levels.lowerStoneEave,
      steps = detail > 1 ? Math.ceil((y1 - y0) / 0.17) : detail ? 4 : 1,
      samples = [1, 2, 4, 6][detail],
      edge = (sign) =>
        Array.from({ length: samples + 1 }, (_, j) => {
          const t = j / samples,
            p = at(i, t),
            n = across(i, t);
          return [p[0] + sign * n[0] * 1.3, p[1] + sign * n[1] * 1.3];
        });
    // Each canopy section is level, stepping up at the next section. It is not a ramp.
    polygon(o, [...edge(1), ...edge(-1).reverse()], roofY, roofY + 0.18, buff);
    // Real stone stair flights have a continuous masonry body, rather than
    // disconnected thin plates suspended over the hillside. Foundations extend
    // into the unchanged source ground; the lower rock cutting remains separate.
    for (let j = 0; j < samples; j++) {
      const t0 = j / samples,
        t1 = (j + 1) / samples,
        p0 = at(i, t0),
        p1 = at(i, t1),
        n0 = across(i, t0),
        n1 = across(i, t1),
        top = (t) => y0 + (y1 - y0) * t - 0.12,
        point = (p, n, sign, t, bottom = false) => {
          const x = p[0] + n[0] * sign * 0.9,
            z = p[1] + n[1] * sign * 0.9;
          return [x, bottom ? Math.min(top(t) - 0.12, ground(x, z) - 0.1) : top(t), z];
        };
      for (const sign of [-1, 1])
        quad(
          o,
          'stone',
          [
            point(p0, n0, sign, t0, true),
            point(p1, n1, sign, t1, true),
            point(p1, n1, sign, t1),
            point(p0, n0, sign, t0),
          ],
          [(sign * (n0[0] + n1[0])) / 2, 0, (sign * (n0[1] + n1[1])) / 2],
          masonry,
        );
      if (detail > 1)
        quad(
          o,
          'stone',
          [
            point(p0, n0, 1, t0),
            point(p1, n1, 1, t1),
            point(p1, n1, -1, t1),
            point(p0, n0, -1, t0),
          ],
          [0, 1, 0],
          masonry,
        );
    }
    for (let j = 0; j < steps; j++) {
      const t0 = j / steps,
        t1 = (j + 1) / steps,
        y = y0 + (y1 - y0) * t1,
        pa = at(i, t0),
        pb = at(i, t1);
      walkPlate(o, [pa[0], y, pa[1]], [pb[0], y, pb[1]], 1.8, 0.18, detail);
    }
    // Small real landings close the stair flights at the changing canopy stations.
    // Keeping a top proxy at skyline also closes the common physical floor boundary.
    const ux = dx / length,
      uz = dz / length,
      landing = [
        [a[0] - ux * 0.2 - uz * 0.9, y0, a[1] - uz * 0.2 + ux * 0.9],
        [a[0] + ux * 0.2 - uz * 0.9, y0, a[1] + uz * 0.2 + ux * 0.9],
        [a[0] + ux * 0.2 + uz * 0.9, y0, a[1] + uz * 0.2 - ux * 0.9],
        [a[0] - ux * 0.2 + uz * 0.9, y0, a[1] - uz * 0.2 - ux * 0.9],
      ];
    if (detail)
      beam(
        o,
        'stone',
        [a[0] - ux * 0.2, y0 - 0.09, a[1] - uz * 0.2],
        [a[0] + ux * 0.2, y0 - 0.09, a[1] + uz * 0.2],
        1.8,
        0.18,
        masonry,
      );
    else quad(o, 'stone', landing, [0, 1, 0], masonry);
    if (detail) {
      // Thin steel posts replace the former thick stone columns in the stair path.
      const nx = -dz / length,
        nz = dx / length;
      beam(o, 'metal', [a[0] + nx, y0, a[1] + nz], [a[0] + nx, roofY, a[1] + nz], 0.07, 0.07, red);
      // Close the vertical change between consecutive horizontal canopy sections.
      if (i > 0)
        beam(
          o,
          'concrete',
          [
            a[0] + across(i, 0)[0] * 1.3,
            (roofY + y0 + levels.lowerStoneEave) / 2,
            a[1] + across(i, 0)[1] * 1.3,
          ],
          [
            a[0] - across(i, 0)[0] * 1.3,
            (roofY + y0 + levels.lowerStoneEave) / 2,
            a[1] - across(i, 0)[1] * 1.3,
          ],
          0.16,
          roofY - y0 - levels.lowerStoneEave,
          buff,
        );
    }
  }
}
function streamAndLedges(o, detail) {
  const controls = JSON.parse(fs.readFileSync(channelPath)),
    rows = controls.rows,
    grid = JSON.parse(fs.readFileSync(new URL('terrain-grid.json', channelPath))),
    descriptor = JSON.parse(fs.readFileSync(new URL('terrain-review.terrain.json', channelPath))),
    png = decodePng16(fs.readFileSync(new URL('terrain-review.height.png', channelPath))),
    heights = Array.from(png.data, (v) =>
      Math.fround(descriptor.height.min + v * (descriptor.height.max - descriptor.height.min)),
    ),
    mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  // Match the original rendered terrain's a-d-b / b-d-e topology, including its
  // unchanged heightfield quantization. This joins rock edges; it moves no ground.
  const ground = (x, z) => {
    const fx = (x - grid.origin[0]) / grid.stepMeters,
      fz = (z - grid.origin[1]) / grid.stepMeters,
      ix = Math.floor(fx),
      iz = Math.floor(fz),
      u = fx - ix,
      v = fz - iz,
      n = grid.size[0],
      a = heights[iz * n + ix],
      b = heights[iz * n + ix + 1],
      d = heights[(iz + 1) * n + ix],
      e = heights[(iz + 1) * n + ix + 1];
    return u + v <= 1 ? a + (b - a) * u + (d - a) * v : e + (d - e) * (1 - u) + (b - e) * (1 - v);
  };
  const cuts = (a, b) => {
    const ts = [0, 1];
    for (const axis of [(p) => p[0], (p) => p[2], (p) => p[0] + p[2]]) {
      const lo = axis(a),
        hi = axis(b),
        delta = hi - lo;
      if (Math.abs(delta) < 1e-8) continue;
      for (let k = Math.floor(Math.min(lo, hi)) + 1; k < Math.max(lo, hi); k++)
        ts.push((k - lo) / delta);
    }
    return ts;
  };
  const unique = (list) =>
    list.sort((a, b) => a - b).filter((v, i, a) => !i || v - a[i - 1] > 0.0001);
  const profile = (i, c) => {
    const r = rows[i],
      left = r.bankJoin[0],
      right = r.bankJoin[1],
      bedRatio = (r.waterHalfWidth * 0.88) / r.bankHalfWidth,
      rimRatio =
        (r.waterHalfWidth *
          (1 + (controls.bankRimAboveWaterMeters / controls.bedBelowWaterMeters) * 0.12)) /
        r.bankHalfWidth,
      abs = Math.abs(c),
      sign = Math.sign(c),
      ratio =
        abs <= 0.5
          ? (abs / 0.5) * bedRatio
          : abs < 0.6
            ? bedRatio + ((rimRatio - bedRatio) * (abs - 0.5)) / 0.1
            : rimRatio + ((1 - rimRatio) * (abs - 0.6)) / 0.4,
      p = mix(left, right, (sign * ratio + 1) / 2);
    if (abs <= 0.5) p[1] = r.waterY - controls.bedBelowWaterMeters;
    else if (abs < 0.6)
      p[1] =
        r.waterY -
        controls.bedBelowWaterMeters +
        ((controls.bedBelowWaterMeters + controls.bankRimAboveWaterMeters) * (abs - 0.5)) / 0.1;
    else {
      const t = (abs - 0.6) / 0.4;
      p[1] = (r.waterY + controls.bankRimAboveWaterMeters) * (1 - t) + ground(p[0], p[2]) * t;
    }
    return p;
  };
  const crossParameter = (row, ratio) => {
    const a = Math.abs(ratio),
      bed = (row.waterHalfWidth * 0.88) / row.bankHalfWidth,
      rim =
        (row.waterHalfWidth *
          (1 + (controls.bankRimAboveWaterMeters / controls.bedBelowWaterMeters) * 0.12)) /
        row.bankHalfWidth;
    return (
      Math.sign(ratio) *
      (a <= bed
        ? (0.5 * a) / bed
        : a < rim
          ? 0.5 + (0.1 * (a - bed)) / (rim - bed)
          : 0.6 + (0.4 * (a - rim)) / (1 - rim))
    );
  };
  const adaptive = (a, b, tolerance) => {
    const candidates = unique(cuts(a, b));
    const height = (t) => {
      const p = mix(a, b, t);
      return ground(p[0], p[2]);
    };
    const pick = (lo, hi) => {
      const y0 = height(candidates[lo]),
        y1 = height(candidates[hi]);
      let error = 0,
        worst = -1;
      for (let j = lo + 1; j < hi; j++) {
        const f = (candidates[j] - candidates[lo]) / (candidates[hi] - candidates[lo]),
          e = Math.abs(height(candidates[j]) - (y0 + (y1 - y0) * f));
        if (e > error) {
          error = e;
          worst = j;
        }
      }
      if (error > tolerance && worst > lo)
        return [...pick(lo, worst).slice(0, -1), ...pick(worst, hi)];
      return [candidates[lo], candidates[hi]];
    };
    return pick(0, candidates.length - 1);
  };
  const face = (slot, points, color, up = true) => {
    for (const ids of [
      [0, 1, 2],
      [0, 2, 3],
    ]) {
      const p = ids.map((i) => points[i]);
      if (up && normalFor(...p)[1] < 0) p.reverse();
      o.addTriangle(
        slot,
        'palette:#ffffff',
        p,
        normalFor(...p),
        p.map((q) => [q[0], q[2]]),
        color,
      );
    }
  };
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i],
      b = rows[i + 1],
      terminal = i === 0 || i === rows.length - 2,
      ts =
        detail > 1
          ? unique([
              ...cuts(a.bankJoin[0], b.bankJoin[0]),
              ...cuts(a.bankJoin[1], b.bankJoin[1]),
              ...(i === 0 ? [0.2] : []),
              ...(i === rows.length - 2 ? [0.8] : []),
            ])
          : [0, 1],
      columns = detail ? [-1, -0.6, -0.5, 0.5, 0.6, 1] : [-1, 0, 1];
    if (detail > 1 && terminal) {
      const end = i === 0 ? a : b;
      for (const t of cuts(end.bankJoin[0], end.bankJoin[1]))
        columns.push(crossParameter(end, t * 2 - 1));
    }
    const cols = unique(columns);
    const at = (t, c) => {
      const p = mix(profile(i, c), profile(i + 1, c), t);
      if (Math.abs(c) > 0.99999) p[1] = ground(p[0], p[2]);
      const blend =
        i === 0 ? Math.max(0, 1 - t * 5) : i === rows.length - 2 ? Math.max(0, t * 5 - 4) : 0;
      if (blend) p[1] = p[1] * (1 - blend) + ground(p[0], p[2]) * blend;
      return p;
    };
    if (detail < 2) {
      const coarseCols = detail ? [-1, -0.5, 0.5, 1] : [-1, 0, 1],
        tolerance = 0.035,
        left = adaptive(a.bankJoin[0], b.bankJoin[0], tolerance),
        right = adaptive(a.bankJoin[1], b.bankJoin[1], tolerance),
        start =
          i === 0
            ? adaptive(a.bankJoin[0], a.bankJoin[1], tolerance).map((t) =>
                crossParameter(a, t * 2 - 1),
              )
            : [],
        finish =
          i === rows.length - 2
            ? adaptive(b.bankJoin[0], b.bankJoin[1], tolerance).map((t) =>
                crossParameter(b, t * 2 - 1),
              )
            : [];
      for (let k = 0; k < coarseCols.length - 1; k++) {
        const c0 = coarseCols[k],
          c1 = coarseCols[k + 1],
          boundary = [
            at(0, c0),
            ...start.filter((c) => c > c0 + 0.0001 && c < c1 - 0.0001).map((c) => at(0, c)),
            at(0, c1),
            ...(c1 === 1 ? right.slice(1, -1).map((t) => at(t, c1)) : []),
            at(1, c1),
            ...finish
              .filter((c) => c > c0 + 0.0001 && c < c1 - 0.0001)
              .reverse()
              .map((c) => at(1, c)),
            at(1, c0),
            ...(c0 === -1
              ? left
                  .slice(1, -1)
                  .reverse()
                  .map((t) => at(t, c0))
              : []),
          ],
          center = at(0.5, (c0 + c1) / 2),
          color = rock.map((v) => v * (0.9 + ((i + k) % 3) * 0.03));
        for (let j = 0; j < boundary.length; j++) {
          const p = [center, boundary[j], boundary[(j + 1) % boundary.length]];
          if (normalFor(...p)[1] < 0) p.reverse();
          o.addTriangle(
            'bedrock',
            'palette:#ffffff',
            p,
            normalFor(...p),
            p.map((q) => [q[0], q[2]]),
            color,
          );
        }
      }
      continue;
    }
    for (let j = 0; j < ts.length - 1; j++) {
      const t0 = ts[j],
        t1 = ts[j + 1];
      for (let k = 0; k < cols.length - 1; k++) {
        const c0 = cols[k],
          c1 = cols[k + 1];
        face(
          'bedrock',
          [at(t0, c0), at(t1, c0), at(t1, c1), at(t0, c1)],
          rock.map((v) => v * (0.88 + ((i + k) % 4) * 0.035)),
        );
      }
    }
  }
  // This is a continuous geological surface patch meeting the original ground,
  // not a deep box or pad. Native terrain remains unchanged outside its boundary.
  const wet = rows.map((r) => {
    const [a, b] = r.bankJoin,
      ratio = r.waterHalfWidth / r.bankHalfWidth;
    return [-1, 1].map((sign) => {
      const p = mix(a, b, (1 + sign * ratio) / 2);
      p[1] = r.waterY;
      return p;
    });
  });
  for (let i = 0; i < wet.length - 1; i++) {
    face('glass', [wet[i][0], wet[i][1], wet[i + 1][1], wet[i + 1][0]], water);
    if (rows[i].waterY - rows[i + 1].waterY < 1) continue;
    const normal = normalFor(wet[i][0], wet[i][1], wet[i + 1][1]);
    if (normal[1] < 0) for (let k = 0; k < 3; k++) normal[k] *= -1;
    const flow = (along, across) =>
      mix(
        mix(wet[i][0], wet[i][1], Math.max(0.01, Math.min(0.99, across))),
        mix(wet[i + 1][0], wet[i + 1][1], Math.max(0.01, Math.min(0.99, across))),
        along,
      ).map((v, k) => v + normal[k] * 0.026);
    for (let j = 0, count = detail > 1 ? 21 : detail ? 9 : 2; j < count; j++) {
      const lateral = 0.025 + ((j + 0.12 + ((j * 7) % 5) * 0.07) / count) * 0.94,
        width = (0.25 + ((j * 11) % 6) * 0.15) / count,
        start = j % 4 === 0 ? 0.015 : 0.07 + (j % 3) * 0.055,
        end = j % 5 === 2 ? 0.86 : 0.99,
        parts = detail > 1 ? 3 : 1;
      for (let k = 0; k < parts; k++) {
        const a = start + ((end - start) * k) / parts,
          b = start + ((end - start) * (k + 1)) / parts,
          drift0 = (((j + k * 3) % 5) - 2) * 0.008,
          drift1 = (((j + (k + 1) * 3) % 5) - 2) * 0.008,
          w0 = width * (0.65 + ((j + k) % 4) * 0.16),
          w1 = width * (0.65 + ((j + k + 1) % 4) * 0.16);
        face(
          'concrete',
          [
            flow(a, lateral + drift0),
            flow(a, lateral + w0 + drift0),
            flow(b, lateral + w1 + drift1),
            flow(b, lateral + drift1),
          ],
          c.white.map((v) => v * (0.65 + ((j * 3 + k * 5) % 6) * 0.045)),
        );
      }
    }
    if (detail > 1 && i + 2 < wet.length)
      for (let j = 0; j < 7; j++) {
        const a = (j + 0.3) / 7,
          b = Math.min(0.99, a + 0.035 + (j % 3) * 0.016),
          p0 = mix(wet[i + 1][0], wet[i + 1][1], a),
          p1 = mix(wet[i + 1][0], wet[i + 1][1], b),
          f = 0.035 + (j % 3) * 0.025,
          q0 = mix(p0, mix(wet[i + 2][0], wet[i + 2][1], a), f),
          q1 = mix(p1, mix(wet[i + 2][0], wet[i + 2][1], b), f);
        face(
          'concrete',
          [p0, p1, q1, q0].map((p) => [p[0], p[1] + 0.018, p[2]]),
          c.white.map((v) => v * (0.64 + (j % 3) * 0.06)),
        );
      }
  }
}
function build(o, frame, detail) {
  mainHouse(o, detail);
  guestWing(o, frame, detail);
  streamAndLedges(o, detail);
  stairRockFaces(o, detail);
}
export function fallingwater(o, frame) {
  build(o, frame, 3);
}
export function fallingwaterSkyline(o) {
  build(o, JSON.parse(fs.readFileSync(framePath)), 0);
}
export function fallingwaterDistrict(o) {
  build(o, JSON.parse(fs.readFileSync(framePath)), 1);
}
export function fallingwaterStreet(o) {
  build(o, JSON.parse(fs.readFileSync(framePath)), 2);
}
const surfaces = {
  ...landmarkSurfaces,
  bedrock: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.96, metallic: 0 },
  glass: { ...landmarkSurfaces.glass, localRef: 'palette:#ffffff' },
};
export const fallingwaterModel = {
  id: 'fallingwater',
  recipe: 'structure-fallingwater.mjs',
  key: 'fallingwater',
  cell: 'dp/dpp',
  title: 'Fallingwater',
  brief:
    'Crossed buff concrete cantilevers, stratified sandstone core, red window frames and hanging stream stair above Bear Run, with an uphill guest wing and covered curved connection.',
  camera: [-31, 11, 43],
  lookAt: [1, 1, 2],
  qaCameras: [
    { name: 'front', position: [0, 7, 55], lookAt: [1, 0, 3] },
    { name: 'back', position: [-32, 26, -66], lookAt: [1, 5, -15] },
    { name: 'guest-wing-detail', position: [26, 18.6, -12], lookAt: [0, 12.4, -30] },
    { name: 'canopy-detail', position: [-18, 14.6, -13], lookAt: [-2.8, 8.6, -17] },
    { name: 'guest-court-detail', position: [-27, 18.6, -39], lookAt: [-6, 12.3, -34] },
    { name: 'pool-detail', position: [32, 15.6, -15], lookAt: [20, 11.1, -24] },
    { name: 'river-detail', position: [-31, 3, 47], lookAt: [-4, -4, 15] },
    { name: 'stream-stair-detail', position: [17, -0.2, 14], lookAt: [8, -1, 9] },
    { name: 'north-stair-detail', position: [15, 8, -16], lookAt: [4.7, 4.5, -9.8] },
  ],
  mediumFiContext: { scale: 0.7 },
  build: fallingwater,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Original HABS first-floor plan and cleared Qualla entrance view identify the actual entry/loggia approach [6.4,-0.8], giving 403.4939 m NAVD88 on unchanged USGS native ground. The previous [4,-8.2] reference was behind/above the first-floor entry and is rejected. Guest floor +10.3314 m retains its previous absolute threshold elevation. Architectural floor relations follow the original measured sheets; separate modeled rock cuts and guest retaining walls close the source-ground interfaces without changing native heights.',
  groundCutout: {
    outline: (() => {
      const r = JSON.parse(fs.readFileSync(channelPath)).rows;
      return [
        ...r.map((r) => [r.bankJoin[0][0], r.bankJoin[0][2]]),
        ...r
          .slice()
          .reverse()
          .map((r) => [r.bankJoin[1][0], r.bankJoin[1][2]]),
      ];
    })(),
    additionalOutlines: (() => {
      const { guestPlan: p } = JSON.parse(fs.readFileSync(surveyPath)),
        [x, z] = p.origin;
      return [
        cutOutline(lowerStairCut(), 1.25),
        [
          [2.9, -3.17],
          [5.6, -3.17],
          [5.6, -9.4],
          [2.9, -9.4],
        ],
        p.theaterTerraceRing.map(([px, pz]) => [x + px, z + pz]),
        [
          [x - p.returnWidthMeters, z - p.returnDepthMeters],
          [x, z - p.returnDepthMeters],
          [x, z],
          [x - p.returnWidthMeters, z],
        ],
        [
          [x, z - p.lowWallDepthMeters],
          [x + p.lowRoofLengthMeters, z - p.lowWallDepthMeters],
          [x + p.lowRoofLengthMeters, z],
          [x, z],
        ],
        [
          [x - p.returnWidthMeters - p.carCourtApproach.apronWidthMeters, z - p.returnDepthMeters],
          [
            x - p.returnWidthMeters + p.carCourtApproach.interiorOverlapMeters,
            z - p.returnDepthMeters,
          ],
          [
            x - p.returnWidthMeters + p.carCourtApproach.interiorOverlapMeters,
            z + p.carCourtApproach.approachRunMeters,
          ],
          [
            x - p.returnWidthMeters - p.carCourtApproach.apronWidthMeters,
            z + p.carCourtApproach.approachRunMeters,
          ],
        ],
      ];
    })(),
    basis:
      'Separate physical excavations: the modeled river channel, curved lower stair/first covered flight, narrow rocky cleft beneath the upper-hall bridge, solid guest-house/theater footprints and exposed car-court apron. Cleared Qualla photographs and original HABS plans/photos control their topology. Native heights are unchanged; rock faces meet that surface and building walls retain the uphill ground. No broad whole-house or garden opening.',
  },
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-fallingwater.mjs',
    level: 'skyline',
    export: 'fallingwaterSkyline',
    errorMeters: 1.1,
    authoredLevels: {
      district: { export: 'fallingwaterDistrict', errorMeters: 0.3, surfaces },
      street: { export: 'fallingwaterStreet', errorMeters: 0.15, surfaces },
    },
  },
  limitations: [
    'Original medium-fi exterior starts with cleared public-domain Qualla photographs and original public-domain HABS PA-5346/PA-5346-A site, floor, elevation and section drawings. Main-house occupied rooms, open terraces, floor heights and east-west stream stair replace earlier generalized assumptions. Raster tracing, core partitions and geographic registration remain interpreted; bounded exterior acceptance is recorded in qa.json. Old copied plan and miniature images are excluded.',
    'Crossing terrace axes, stone core, red glazing, hanging stair and clear underside are modeled. Exact room plans, hidden facades, guest-wing openings, structural repairs and roof drains are simplified interpretations.',
    'The static stream, shaped rock channel and two cascades illustrate the house-waterfall relationship. Separate bounded openings follow physical rock cuts and solid guest-house floors, retaining ground between the structures. The narrow cleft under the upper-hall bridge has a modeled rock bottom. These are not a hydrologic simulation, exact geological reconstruction or current water-level claim. Native terrain values are preserved.',
    'The north upper-floor bridge and curved exterior stair are distinct from the first-floor entrance. Guest floor +10.3314 m is an interpreted threshold above independent ground, not a combined-site floor survey. Original HABS floor/site topology and relative levels control the geometry; manually traced plan proportions are not georeferenced CAD. Physical cuts, exposed car-court apron, stone stair bodies and retaining walls represent the excavated architecture. Apron width, short approach and geological surfaces are interpreted exterior geometry.',
    'No interior furnishings, sculpture replica, surrounding forest or external image textures are included. Local reference photography remains outside runtime packs.',
  ],
};
