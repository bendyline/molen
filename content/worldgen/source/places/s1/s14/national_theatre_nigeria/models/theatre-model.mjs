/** National Arts Theatre in Iganmu, Lagos, April 1978. */
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  poly,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const outline = frame.geometry.polygons[0];
const terrain = read('terrain-grid');
const {
  foundationBottom,
  wingRoof,
  coreRadius,
  radialSectorControlIndices,
  roofTerraceRings,
  saddle,
  approaches,
} = plan.section;

const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.87, metallic: 0 },
  board: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.72, metallic: 0.17 },
  glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.32, metallic: 0.13 },
  shadow: { slot: 'trim', localRef: 'palette:#fffdf9', roughness: 0.85, metallic: 0 },
};
const colors = Object.fromEntries(
  Object.entries({
    concrete: 'ded9ca',
    board: 'a89e8b',
    roof: '777a76',
    glass: '46565b',
    shadow: '585348',
    terrace: 'bfb6a1',
    frame: '858279',
    deep: '3d4645',
    rail: '82857c',
  }).map(([key, value]) => [key, rgb(value)]),
);

function face(out, slot, points, expected, color = colors[slot]) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, value, i) => sum + value * expected[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, color);
  else
    out.addTriangle(
      slot,
      'palette:#ffffff',
      points,
      normal,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      color,
    );
}

function footprint(out, slot, ring, bottom, top, color = colors[slot]) {
  const builder = new MeshBufferBuilder();
  poly(builder, slot, ring, bottom, top, color);
  const { indices, normals, positions } = builder.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const points = Array.from(indices.slice(i, i + 3), (index) =>
      Array.from(positions.slice(index * 3, index * 3 + 3)),
    );
    const normal = Array.from(normals.slice(indices[i] * 3, indices[i] * 3 + 3));
    face(out, slot, points, normal, color);
  }
}
function groundAt(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const a = terrain.heightsMeters[j],
    b = terrain.heightsMeters[j + 1];
  const near = a[i] + (a[i + 1] - a[i]) * (u - i);
  const far = b[i] + (b[i + 1] - b[i]) * (u - i);
  return near + (far - near) * (v - j) - terrain.modelDatumElevationMeters;
}
function edge(a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / length,
    dz = (b[1] - a[1]) / length;
  return {
    length,
    normal: [dz, 0, -dx],
    along: [dx, 0, dz],
    point: (u, y, d = 0) => [a[0] + dx * u + dz * d, y, a[1] + dz * u - dx * d],
  };
}
function strip(out, slot, e, a, b, low, high, offset, color = colors[slot]) {
  face(
    out,
    slot,
    [
      e.point(a, low, offset),
      e.point(b, low, offset),
      e.point(b, high, offset),
      e.point(a, high, offset),
    ],
    e.normal,
    color,
  );
}
function groundTrim(out, lod) {
  if (!lod) return;
  for (const [i, a] of outline.entries()) {
    const e = edge(a, outline[(i + 1) % outline.length]);
    const l = e.length;
    strip(out, 'shadow', e, 0, l, 7.42, 7.82, 0.026, colors.frame);
    if (lod >= 2) {
      strip(out, 'concrete', e, 0, l, 7.82, 8.25, 0.13);
      const bayCount = Math.max(2, Math.round(l / 4.3));
      const spacing = l / bayCount;
      for (let j = 0; j < bayCount; j++) {
        const center = spacing * (j + 0.5);
        strip(
          out,
          'glass',
          e,
          center - spacing * 0.29,
          center + spacing * 0.29,
          4.8,
          6.43,
          0.03,
          colors.deep,
        );
        if (lod === 3)
          strip(out, 'roof', e, center - 0.1, center + 0.1, 4.8, 6.43, 0.074, colors.frame);
      }
    }
  }
}
function wing(out, ring, lod) {
  const x = ring.reduce((total, p) => total + p[0], 0) / ring.length;
  const z = ring.reduce((total, p) => total + p[1], 0) / ring.length;
  const center = [x * 0.91, z * 0.91];
  const height = ([a, b]) => wingRoof - Math.max(0, Math.hypot(a, b) - coreRadius) * 0.062;
  const head = [center[0], height(center), center[1]];
  for (const [i, a] of ring.entries()) {
    const b = ring[(i + 1) % ring.length],
      e = edge(a, b);
    const ya = height(a),
      yb = height(b),
      l = e.length;
    face(
      out,
      'board',
      [e.point(0, 9.3), e.point(l, 9.3), e.point(l, yb - 0.81), e.point(0, ya - 0.81)],
      e.normal,
    );
    face(
      out,
      'concrete',
      [e.point(0, ya - 0.81), e.point(l, yb - 0.81), e.point(l, yb), e.point(0, ya)],
      e.normal,
    );
    face(out, 'concrete', [e.point(0, ya), e.point(l, yb), head], [0, 1, 0], colors.terrace);
    if (lod >= 2 && i < ring.length - 1) {
      const count = Math.max(2, Math.round(l / 3.1));
      for (let j = 0; j < count; j++) {
        const u = ((j + 0.5) * l) / count;
        const high = ya + ((yb - ya) * u) / l - 0.87;
        strip(out, 'concrete', e, u - 0.14, u + 0.14, 9.25, high, 0.1);
      }
    }
  }
}

const full = Math.PI * 2;
const radial = (radius, theta, y) => [radius * Math.cos(theta), y, radius * Math.sin(theta)];
function ringFace(out, slot, a, b, radius, low, high, color = colors[slot]) {
  face(
    out,
    slot,
    [
      radial(radius, a, low),
      radial(radius, b, low),
      radial(radius, b, high),
      radial(radius, a, high),
    ],
    [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
    color,
  );
}
function annulus(out, slot, a, b, inner, outer, y, color = colors[slot]) {
  face(
    out,
    slot,
    [radial(inner, a, y), radial(inner, b, y), radial(outer, b, y), radial(outer, a, y)],
    [0, 1, 0],
    color,
  );
}
function terraces(out, sides, lod) {
  for (const [j, tier] of roofTerraceRings.entries()) {
    const { radius, bottom, top, glazed } = tier;
    const inner = roofTerraceRings[j + 1]?.radius ?? saddle.radius;
    for (let i = 0; i < sides; i++) {
      const a = (i * full) / sides,
        b = ((i + 1) * full) / sides;
      const slot = glazed ? 'glass' : 'board';
      ringFace(out, slot, a, b, radius, bottom, top);
      ringFace(out, 'concrete', a, b, radius + 0.24, top - 0.58, top);
      annulus(out, 'concrete', a, b, inner, radius + 0.24, top, colors.terrace);
      if (lod && glazed) {
        const divisions = lod === 3 ? 3 : lod === 2 ? 2 : 1;
        const point = (fraction, y) => {
          const p = radial(radius, a, y),
            q = radial(radius, b, y);
          const angle = (a + b) / 2;
          return [
            p[0] + (q[0] - p[0]) * fraction + 0.085 * Math.cos(angle),
            y,
            p[2] + (q[2] - p[2]) * fraction + 0.085 * Math.sin(angle),
          ];
        };
        for (let k = 0; k < divisions; k++) {
          const f = (k + 0.5) / divisions,
            w = 0.038 / divisions;
          face(
            out,
            'roof',
            [
              point(f - w, bottom),
              point(f + w, bottom),
              point(f + w, top - 0.57),
              point(f - w, top - 0.57),
            ],
            [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
            colors.frame,
          );
        }
      }
      if (lod >= 2 && j < 2) {
        ringFace(out, 'roof', a, b, radius - 0.32, top + 0.81, top + 0.96, colors.rail);
        const center = (a + b) / 2;
        ringFace(
          out,
          'roof',
          center - 0.0019,
          center + 0.0019,
          radius - 0.32,
          top,
          top + 0.89,
          colors.rail,
        );
      }
    }
  }
}
function shell(out, sides, lod) {
  const { radius, center, edgeRise, edgeFall, highestPoint } = saddle;
  const bias = highestPoint - center - edgeRise;
  const height = (theta, t) => {
    const x = t * Math.cos(theta),
      z = t * Math.sin(theta);
    return center + edgeRise * x * x - edgeFall * z * z + bias * x;
  };
  const point = (theta, t, drop = 0) => radial(radius * t, theta, height(theta, t) - drop);
  const radialSteps = [2, 3, 5, 8][lod];
  const base = roofTerraceRings.at(-1).top;
  for (let i = 0; i < sides; i++) {
    const a = (i * full) / sides,
      b = ((i + 1) * full) / sides;
    const normal = [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)];
    face(
      out,
      'roof',
      [[0, center, 0], point(a, 1 / radialSteps), point(b, 1 / radialSteps)],
      [0, 1, 0],
    );
    for (let j = 1; j < radialSteps; j++)
      face(
        out,
        'roof',
        [
          point(a, j / radialSteps),
          point(a, (j + 1) / radialSteps),
          point(b, (j + 1) / radialSteps),
          point(b, j / radialSteps),
        ],
        [0, 1, 0],
      );
    face(out, 'concrete', [point(a, 1, 0.43), point(b, 1, 0.43), point(b, 1), point(a, 1)], normal);
    face(
      out,
      'shadow',
      [
        radial(radius - 0.12, a, base),
        radial(radius - 0.12, b, base),
        point(b, 1, 0.35),
        point(a, 1, 0.35),
      ],
      normal,
    );
    if (lod === 3) {
      const mid = (a + b) / 2;
      for (let j = 2; j < radialSteps; j++) {
        const u = j / radialSteps,
          v = (j + 1) / radialSteps;
        face(
          out,
          'roof',
          [
            point(mid - 0.0015, u, -0.043),
            point(mid - 0.0015, v, -0.043),
            point(mid + 0.0015, v, -0.043),
            point(mid + 0.0015, u, -0.043),
          ],
          [0, 1, 0],
          colors.frame,
        );
      }
    }
  }
}
function entrance(out, { edgeIndex, threshold, length, width }, lod) {
  const e = edge(outline[edgeIndex], outline[edgeIndex + 1]);
  const u = e.length / 2,
    half = width / 2;
  const p = (x, y, d) => e.point(u + x, y, d);
  const [x, , z] = p(0, 0, length);
  const approach = groundAt(x, z) + 0.11;
  const lower = Math.min(approach, threshold) - 0.63;
  const walk = (d) => threshold + (approach - threshold) * Math.max(0, (d - 2.8) / (length - 2.8));
  const stations = [0, 2.8, length];
  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1],
      b = stations[i],
      ya = walk(a),
      yb = walk(b);
    face(
      out,
      'concrete',
      [p(-half, ya, a), p(half, ya, a), p(half, yb, b), p(-half, yb, b)],
      [0, 1, 0],
      colors.terrace,
    );
    for (const sign of [-1, 1]) {
      const x = half * sign;
      const normal = e.along.map((v) => v * sign);
      face(out, 'board', [p(x, lower, a), p(x, lower, b), p(x, yb, b), p(x, ya, a)], normal);
      if (lod) {
        face(
          out,
          'concrete',
          [p(x, ya, a), p(x, yb, b), p(x, yb + 0.62, b), p(x, ya + 0.62, a)],
          normal,
        );
        face(
          out,
          'concrete',
          [
            p(x, ya + 0.62, a),
            p(x, yb + 0.62, b),
            p(x - sign * 0.26, yb + 0.62, b),
            p(x - sign * 0.26, ya + 0.62, a),
          ],
          [0, 1, 0],
        );
      }
    }
  }
  const doorHalf = half * 0.81,
    doorTop = threshold + 2.75;
  strip(out, 'glass', e, u - doorHalf, u + doorHalf, threshold, doorTop, 0.042, colors.deep);
  if (lod) {
    strip(out, 'concrete', e, u - half, u + half, doorTop, doorTop + 0.35, 0.29);
    for (const k of [-1, -0.5, 0, 0.5, 1]) {
      const mid = u + k * doorHalf;
      strip(out, 'roof', e, mid - 0.08, mid + 0.08, threshold, doorTop, 0.083, colors.frame);
    }
  }
}
function build(out, _frame, lod = 3) {
  const sides = [16, 36, 64, 92][lod];
  footprint(out, 'concrete', outline, foundationBottom, 9.3);
  footprint(
    out,
    'board',
    outline.map(([x, z]) => [x * 0.996, z * 0.996]),
    9.3,
    12.7,
  );
  for (const [start, end] of radialSectorControlIndices)
    wing(out, outline.slice(start, end + 1), lod);
  groundTrim(out, lod);
  for (const approach of approaches) entrance(out, approach, lod);
  terraces(out, sides, lod);
  shell(out, sides, lod);
}
export const theatreSkyline = (out) => build(out, undefined, 0);
export const theatreDistrict = (out) => build(out, undefined, 1);
export const theatreStreet = (out) => build(out, undefined, 2);
export const theatreCloseup = (out) => build(out, undefined, 3);

const recipe = 'theatre-model.mjs';
const camera = [220, 117, 216],
  lookAt = [0, 11, 0];
export const theatreModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'National Arts Theatre in Lagos in April 1978, with its four curved wings, ring terraces and saddle auditorium roof.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  buildingCutout: {
    outline,
    minimumCoverage: 0.95,
    basis: 'The original 46-corner theatre footprint identifies its generic building.',
  },
  mediumFiContext: {
    scale: 0.85,
    groundY: 0,
    terrain: {
      descriptor: 'terrain-review.terrain.json',
      heightmap: 'terrain-review.height.png',
    },
  },
  embeddedCanonicalGraphs: ['concrete_plain', 'concrete_boardformed', 'metal_painted'],
  qaCameras: [
    { name: 'east-entrance-and-saddle-roof', position: [151, 38, -39], lookAt: [16, 15, -7] },
    { name: 'four-mapped-wings-and-terraces', position: [122, 190, -140], lookAt: [0, 8, 0] },
    { name: 'west-ramp-and-glazed-terraces', position: [-145, 35, 64], lookAt: [-17, 14, 9] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-national-arts-theatre-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'theatreSkyline',
    errorMeters: 0.95,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'theatreDistrict', 0.41],
        ['street', 'theatreStreet', 0.15],
        ['closeup', 'theatreCloseup', 0.075],
      ].map(([name, exportName, errorMeters]) => [
        name,
        { export: exportName, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. Footprint from OpenStreetMap. Written architectural facts only. No imagery is baked into the asset or used as an exterior reference.',
};
