/** Muzium Negara, Kuala Lumpur, in January 2008. */
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  poly,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const outline = read('map-frame').geometry.polygons[0];
const terrain = read('terrain-grid');
const { foundationBottom, threshold, wings, pavilion } = plan.section;

const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.89, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.86, metallic: 0 },
  mosaic: { slot: 'trim', graph: 'tile_mosaic', roughness: 0.73, metallic: 0 },
  stone: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.92, metallic: 0 },
  dark: { slot: 'trim', localRef: 'palette:#fffefb', roughness: 0.85, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.12 },
};
const colors = Object.fromEntries(
  Object.entries({
    wall: 'd6cbbb',
    roof: '80534d',
    mosaic: '887857',
    stone: 'bab3a4',
    dark: '4e514b',
    metal: '969385',
    eaves: '585950',
    edge: 'beb7a9',
    threshold: '9e7866',
    ceiling: 'bab9a9',
    tileFrame: '756455',
    shade: '64665c',
  }).map(([k, v]) => [k, rgb(v)]),
);
function face(out, slot, points, expected, color = colors[slot]) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, v, i) => sum + v * expected[i], 0) < 0) {
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
function block(out, slot, [x0, x1, z0, z1], bottom, top, color = colors[slot]) {
  box(out, slot, (x0 + x1) / 2, bottom, (z0 + z1) / 2, x1 - x0, top - bottom, z1 - z0, color);
}
function foundation(out) {
  const out2 = new MeshBufferBuilder();
  poly(out2, 'stone', outline, foundationBottom, threshold, colors.stone);
  const { indices, positions, normals } = out2.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const points = Array.from(indices.slice(i, i + 3), (j) =>
      Array.from(positions.slice(j * 3, j * 3 + 3)),
    );
    const normal = Array.from(normals.slice(indices[i] * 3, indices[i] * 3 + 3));
    face(out, 'stone', points, normal);
  }
}
function groundAt(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    a = terrain.heightsMeters[j],
    b = terrain.heightsMeters[j + 1];
  return (
    (a[i] + (a[i + 1] - a[i]) * (u - i)) * (1 - v + j) +
    (b[i] + (b[i + 1] - b[i]) * (u - i)) * (v - j) -
    terrain.modelDatumElevationMeters
  );
}
function rect(out, slot, x0, x1, y0, y1, z, sign, color = colors[slot]) {
  face(
    out,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    [0, 0, sign],
    color,
  );
}
function wing(out, { bounds: [x0, x1, z0, z1], eaves, ridge, frontLine }, lod) {
  block(out, 'wall', [x0, x1, z0, z1], threshold, eaves - 0.2);
  const lip = 0.71,
    zMid = (z0 + z1) / 2;
  for (const z of [z0 - lip, z1 + lip])
    face(
      out,
      'roof',
      [
        [x0 - lip, eaves, z],
        [x1 + lip, eaves, z],
        [x1 + lip, ridge, zMid],
        [x0 - lip, ridge, zMid],
      ],
      [0, 1, 0],
    );
  for (const [x, sign] of [
    [x0, -1],
    [x1, 1],
  ])
    face(
      out,
      'wall',
      [
        [x, eaves - 0.2, z0],
        [x, eaves - 0.2, z1],
        [x, ridge, zMid],
      ],
      [sign, 0, 0],
    );
  block(out, 'metal', [x0 - lip, x1 + lip, z1 + 0.29, z1 + lip], eaves - 0.21, eaves, colors.eaves);
  block(out, 'metal', [x0 - lip, x1 + lip, z0 - lip, z0 - 0.29], eaves - 0.21, eaves, colors.eaves);
  const inset = 0.7,
    edge = frontLine + 0.035;
  rect(out, 'mosaic', x0 + inset, x1 - inset, threshold + 3.78, eaves - 1.13, edge, 1);
  if (lod) {
    const low = threshold + 3.63,
      high = eaves - 0.96;
    for (const y of [low, high])
      rect(
        out,
        'stone',
        x0 + inset - 0.19,
        x1 - inset + 0.19,
        y,
        y + 0.15,
        edge + 0.047,
        1,
        colors.tileFrame,
      );
    for (const x of [x0 + inset, x1 - inset])
      rect(out, 'stone', x - 0.16, x + 0.16, low, high, edge + 0.047, 1, colors.tileFrame);
    const n = Math.round((x1 - x0) / 4.2),
      pitch = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      const x = x0 + (i + 0.5) * pitch;
      rect(
        out,
        'dark',
        x - pitch * 0.29,
        x + pitch * 0.29,
        threshold + 2.12,
        eaves - 1.75,
        z0 - 0.036,
        -1,
      );
      if (lod >= 2)
        for (const f of [-0.16, 0.16])
          rect(
            out,
            'metal',
            x + f - 0.045,
            x + f + 0.045,
            threshold + 2.12,
            eaves - 1.75,
            z0 - 0.065,
            -1,
            colors.edge,
          );
    }
  }
}
function roofPavilion(out, lod) {
  const {
    center: x,
    bounds: [x0, x1, z0, z1],
    eaves,
    ridge,
  } = pavilion;
  const eaveHalf = (x1 - x0) / 2 + 0.95,
    lip = 1.06;
  const p = (sign, f, y, z) => [x + sign * eaveHalf * f, y, z];
  const roofProfile = [
    [1, eaves],
    [0.59, eaves + (ridge - eaves) * 0.37],
    [0, ridge],
  ];
  for (const sign of [-1, 1])
    for (let i = 1; i < roofProfile.length; i++) {
      const [f, y] = roofProfile[i - 1],
        [g, yy] = roofProfile[i];
      face(
        out,
        'roof',
        [
          p(sign, f, y, z0 - lip),
          p(sign, f, y, z1 + lip),
          p(sign, g, yy, z1 + lip),
          p(sign, g, yy, z0 - lip),
        ],
        [0, 1, 0],
      );
      for (const [z, direction] of [
        [z0 - lip, -1],
        [z1 + lip, 1],
      ]) {
        face(
          out,
          'wall',
          [p(sign, f, y - 0.49, z), p(sign, g, yy - 0.49, z), p(sign, g, yy, z), p(sign, f, y, z)],
          [0, 0, direction],
          colors.edge,
        );
        const inner = z - direction * lip;
        face(
          out,
          'wall',
          [
            p(sign, f, y - 0.49, z),
            p(sign, g, yy - 0.49, z),
            p(sign, g, yy - 0.49, inner),
            p(sign, f, y - 0.49, inner),
          ],
          [0, -1, 0],
          colors.ceiling,
        );
        if (lod >= 2)
          beam(
            out,
            'metal',
            p(sign, f, y - 0.115, z + direction * 0.035),
            p(sign, g, yy - 0.115, z + direction * 0.035),
            0.085,
            0.135,
            colors.edge,
          );
      }
    }
  block(out, 'wall', [x0, x1, z0, z1], threshold, eaves - 0.23);
  for (const [z, direction] of [
    [z0, -1],
    [z1, 1],
  ]) {
    const h = eaves - 0.24;
    face(
      out,
      'wall',
      [
        [x0, h, z],
        [x1, h, z],
        [x + eaveHalf * 0.59, eaves + (ridge - eaves) * 0.37 - 0.27, z],
        [x - eaveHalf * 0.59, eaves + (ridge - eaves) * 0.37 - 0.27, z],
      ],
      [0, 0, direction],
    );
    face(
      out,
      'wall',
      [
        [x - eaveHalf * 0.59, eaves + (ridge - eaves) * 0.37 - 0.27, z],
        [x + eaveHalf * 0.59, eaves + (ridge - eaves) * 0.37 - 0.27, z],
        [x, ridge - 0.26, z],
      ],
      [0, 0, direction],
    );
  }
  for (const z of [z0 - lip, z1 + lip]) {
    beam(
      out,
      'wall',
      [x - 0.82, ridge - 0.63, z],
      [x + 0.65, ridge + 0.67, z],
      0.22,
      0.28,
      colors.edge,
    );
    beam(
      out,
      'wall',
      [x + 0.82, ridge - 0.63, z],
      [x - 0.65, ridge + 0.67, z],
      0.22,
      0.28,
      colors.edge,
    );
  }
}
function entry(out, lod) {
  const {
    center: x,
    bounds: [, , , front],
    ridge,
    eaves,
  } = pavilion;
  const top = eaves + 1.68;
  const ventBase = eaves + (ridge - eaves) * 0.62;
  face(
    out,
    'dark',
    [
      [x - 2.72, ventBase, front + 0.04],
      [x + 2.72, ventBase, front + 0.04],
      [x, ridge - 1.34, front + 0.04],
    ],
    [0, 0, 1],
    colors.shade,
  );
  block(
    out,
    'wall',
    [x - 3.15, x + 3.15, front, front + 0.31],
    ventBase - 0.23,
    ventBase + 0.04,
    colors.edge,
  );
  rect(out, 'dark', x - 4.22, x + 4.22, threshold + 1.58, top, front + 0.029, 1, colors.shade);
  for (const dx of [-2.74, 0, 2.74]) {
    const u = x + dx,
      z = front + 0.28;
    rect(out, 'dark', u - 0.99, u + 0.99, threshold, threshold + 2.48, z, 1);
    block(out, 'wall', [u - 1.38, u - 1.16, front - 0.11, front + 0.25], threshold, top + 0.28);
    block(out, 'wall', [u + 1.16, u + 1.37, front - 0.11, front + 0.25], threshold, top + 0.28);
    const high = threshold + 5.22,
      low = threshold + 2.96;
    beam(out, 'wall', [u - 1.18, low, z], [u, high, z], 0.17, 0.24, colors.wall);
    beam(out, 'wall', [u + 1.18, low, z], [u, high, z], 0.17, 0.24, colors.wall);
    if (lod) {
      beam(
        out,
        'wall',
        [u - 0.21, high - 0.08, z],
        [u + 0.26, high + 0.53, z],
        0.1,
        0.12,
        colors.edge,
      );
      beam(
        out,
        'wall',
        [u + 0.21, high - 0.08, z],
        [u - 0.26, high + 0.53, z],
        0.1,
        0.12,
        colors.edge,
      );
      if (lod >= 2)
        for (const oy of [2.7, 3.4, 4.1, 5.6, 6.3, 7.0, 7.7, 8.4]) {
          const y = threshold + oy;
          if (y < top - 0.19)
            rect(out, 'metal', u - 1.13, u + 1.13, y, y + 0.1, front + 0.081, 1, colors.shade);
        }
      if (lod === 3)
        for (const f of [-0.72, -0.36, 0, 0.36, 0.72])
          rect(
            out,
            'metal',
            u + f - 0.042,
            u + f + 0.042,
            threshold + 2.55,
            top - 0.14,
            front + 0.116,
            1,
            colors.metal,
          );
    }
  }
  const finialY = top + (ridge - top) * 0.28,
    n = lod ? 12 : 6;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n,
      p = (r, a) => [x + r * Math.cos(a), finialY + r * Math.sin(a), front + 0.045];
    face(out, 'metal', [p(0.43, a), p(0.58, a), p(0.58, b), p(0.43, b)], [0, 0, 1], colors.shade);
  }
  const stairHalf = 6.95,
    start = front + 0.28,
    run = 10.6;
  const low = groundAt(x, start + run) + 0.075;
  const stairFoundation =
    Math.min(low, ...[-stairHalf, stairHalf].map((dx) => groundAt(x + dx, start + run))) - 0.38;
  const count = lod ? 15 : 5,
    step = run / count;
  if (low < threshold - 0.13)
    for (let i = 0; i < count; i++) {
      const y = threshold - ((threshold - low) * i) / count;
      block(
        out,
        'stone',
        [x - stairHalf, x + stairHalf, start + i * step, start + (i + 1) * step],
        stairFoundation,
        y,
        colors.threshold,
      );
    }
  if (low < threshold - 0.13) {
    for (const sign of [-1, 1]) {
      const x0 = x + sign * (stairHalf + 0.22),
        x1 = x + sign * 13.2;
      const xBounds = [Math.min(x0, x1), Math.max(x0, x1)];
      const [a, b] = xBounds;
      const end = start + 3.7;
      const underside = Math.min(groundAt(a, end), groundAt(b, end), threshold - 0.48) - 0.22;
      block(out, 'stone', [a, b, start, end], underside, threshold, colors.stone);
      const wallTop = threshold + 0.68;
      block(out, 'wall', [a, b, end - 0.46, end], threshold, wallTop);
      if (lod)
        block(
          out,
          'metal',
          [a - 0.095, b + 0.095, end - 0.54, end + 0.08],
          wallTop,
          wallTop + 0.13,
          colors.eaves,
        );
    }
  }
  if (lod && low < threshold - 0.13)
    for (const dx of [-4.44, 4.44]) {
      const u = x + dx;
      beam(
        out,
        'metal',
        [u, threshold + 0.93, start],
        [u, low + 1.02, start + run],
        0.085,
        0.1,
        colors.metal,
      );
      for (const f of [0.02, 0.35, 0.67, 0.98]) {
        const y = threshold + (low - threshold) * f,
          z = start + run * f;
        beam(out, 'metal', [u, y, z], [u, y + 0.91, z], 0.078, 0.085, colors.metal);
      }
    }
}
function build(out, _frame, lod = 3) {
  foundation(out);
  for (const item of wings) wing(out, item, lod);
  roofPavilion(out, lod);
  entry(out, lod);
}
export const museumSkyline = (out) => build(out, undefined, 0);
export const museumDistrict = (out) => build(out, undefined, 1);
export const museumStreet = (out) => build(out, undefined, 2);
export const museumCloseup = (out) => build(out, undefined, 3);

const recipe = 'museum-model.mjs',
  camera = [92, 47, 118],
  lookAt = [4, 9, 0];
export const museumModel = {
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
    'Muzium Negara in 2008 with red roof wings, a steep crossed-apex entrance gable, screened bays, mosaic fields and broad stairs.',
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
    basis: 'Suppress the matching native main building only in the dated historical preview.',
  },
  mediumFiContext: {
    scale: 0.85,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'tile_ceramic',
    'tile_mosaic',
    'concrete_plain',
    'metal_painted',
  ],
  qaCameras: [
    {
      name: 'malay-palace-gable-and-entrance-stair',
      position: [5.7, 15, 65],
      lookAt: [5.7, 12, 17],
    },
    { name: 'museum-wings-and-mosaic-fields', position: [86, 39, 86], lookAt: [5, 11, 9] },
    { name: 'rear-pavilion-and-gallery-wings', position: [-66, 37, -78], lookAt: [4, 11, -4] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-muzium-negara-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'museumSkyline',
    errorMeters: 0.56,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'museumDistrict', 0.25],
        ['street', 'museumStreet', 0.09],
        ['closeup', 'museumCloseup', 0.034],
      ].map(([name, exportName, errorMeters]) => [
        name,
        { export: exportName, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. Footprint from OpenStreetMap. Verified photographer-released exterior references inform the architecture. Mosaic materials are generic and do not depict the original artworks.',
};
