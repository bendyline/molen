/** Brisbane's former Treasury Building after its 1990s adaptation, in 2005. */
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  cleanRing,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  frame = read('map-frame'),
  ground = read('terrain-grid');
const [outline] = frame.geometry.polygons;
const {
  foundationBottom,
  baseCourse,
  levels,
  wallEaves,
  parapetTop,
  cornerPavilions,
  pavilionEaves,
  pavilionTop,
  courtyard,
  coveredCourtyardEaves,
  coveredCourtyardRidge,
  entrances,
} = plan.section;
const sandstone = { slot: 'wall', graph: 'stone_sandstone', roughness: 0.92, metallic: 0 };
const surfaces = {
  stone: sandstone,
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.79, metallic: 0.16 },
  glass: { slot: 'window', localRef: 'palette:#fffdfe', roughness: 0.62, metallic: 0.04 },
  trim: sandstone,
  detail: { slot: 'trim', localRef: 'palette:#fefffd', roughness: 0.79, metallic: 0 },
};
const colors = Object.fromEntries(
  Object.entries({
    stone: 'c6b094',
    base: 'ac9886',
    trim: 'ceb89a',
    shadow: 'ac937b',
    cap: 'd1bca0',
    pane: '4e5150',
    brown: '735947',
    frame: '92816e',
    roof: '776c60',
    copper: '8b7465',
    court: '626a63',
    courtRib: '7e8275',
    flag: '645f57',
  }).map(([k, v]) => [k, rgb(v)]),
);
const white = 'palette:#ffffff';
const area = (ring) =>
  ring.reduce((sum, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return sum + p[0] * q[1] - p[1] * q[0];
  }, 0);
function face(out, slot, points, expected, tint) {
  let n = normalFor(...points);
  if (n.reduce((sum, value, i) => sum + value * expected[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, tint);
  else
    out.addTriangle(
      slot,
      white,
      points,
      n,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      tint,
    );
}
function edge(a, b, sign = 1) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / length,
    dz = (b[1] - a[1]) / length;
  const n = [dz * sign, 0, -dx * sign];
  return {
    length,
    n,
    point: (u, y, p = 0) => [a[0] + u * dx + p * n[0], y, a[1] + u * dz + p * n[2]],
  };
}
function edges(ring) {
  const sign = Math.sign(area(ring));
  return ring.map((p, i) => edge(p, ring[(i + 1) % ring.length], sign));
}
function panel(out, slot, e, a, b, bottom, top, p, tint) {
  face(
    out,
    slot,
    [e.point(a, bottom, p), e.point(b, bottom, p), e.point(b, top, p), e.point(a, top, p)],
    e.n,
    tint,
  );
}
const arch = (center, half, spring, top, count) =>
  Array.from({ length: count + 1 }, (_, i) => {
    const t = (Math.PI * i) / count;
    return [center - half * Math.cos(t), spring + (top - spring) * Math.sin(t)];
  });

const rectangle = ([a, b, c, d]) => [
  [a, c],
  [b, c],
  [b, d],
  [a, d],
];
const ring = cleanRing(outline);
function grade(x, z) {
  const u = (x - ground.origin[0]) / ground.stepMeters,
    v = (z - ground.origin[1]) / ground.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j;
  const data = ground.heightsMeters;
  return (
    (data[j][i] * (1 - a) + data[j][i + 1] * a) * (1 - b) +
    (data[j + 1][i] * (1 - a) + data[j + 1][i + 1] * a) * b -
    ground.modelDatumElevationMeters
  );
}
function arched(out, slot, e, u, w, bottom, spring, top, p, tint, n) {
  const h = w / 2;
  panel(out, slot, e, u - h, u + h, bottom, spring, p, tint);
  const samples = arch(u, h, spring, top, n),
    center = e.point(u, spring, p);
  for (let i = 1; i < samples.length; i++)
    face(out, slot, [center, e.point(...samples[i - 1], p), e.point(...samples[i], p)], e.n, tint);
}
function window(out, e, u, width, bottom, top, lod, curved, deep = false) {
  const h = width / 2,
    spring = top - width * (deep ? 0.39 : 0.3);
  if (lod === 0) {
    panel(out, 'glass', e, u - h, u + h, bottom, top, 0.036, colors.pane);
    return;
  }
  if (lod === 1) {
    if (curved) arched(out, 'glass', e, u, width, bottom, spring, top, 0.04, colors.pane, 4);
    else panel(out, 'glass', e, u - h, u + h, bottom, top, 0.037, colors.pane);
    return;
  }
  if (curved) {
    const n = 8;
    arched(
      out,
      'trim',
      e,
      u,
      width + 0.31,
      bottom - 0.09,
      spring,
      top + 0.18,
      0.045,
      colors.shadow,
      n,
    );
    arched(out, 'glass', e, u, width, bottom, spring, top, 0.075, colors.pane, n);
  } else {
    panel(
      out,
      'trim',
      e,
      u - h - 0.09,
      u + h + 0.09,
      bottom - 0.07,
      top + 0.11,
      0.042,
      colors.shadow,
    );
    panel(out, 'glass', e, u - h, u + h, bottom, top, 0.075, colors.pane);
  }
  if (lod >= 2) {
    panel(
      out,
      'trim',
      e,
      u - h - 0.16,
      u + h + 0.16,
      bottom - 0.14,
      bottom + 0.014,
      0.146,
      colors.cap,
    );
    panel(out, 'detail', e, u - 0.031, u + 0.031, bottom, top - 0.06, 0.102, colors.frame);
    if (deep)
      panel(out, 'trim', e, u - h - 0.03, u + h + 0.03, bottom, bottom + 0.7, 0.1, colors.trim);
    else
      panel(
        out,
        'detail',
        e,
        u - h,
        u + h,
        bottom + (top - bottom) * 0.52,
        bottom + (top - bottom) * 0.52 + 0.06,
        0.103,
        colors.frame,
      );
    if (curved && lod === 3)
      panel(out, 'trim', e, u - 0.106, u + 0.106, top + 0.085, top + 0.32, 0.13, colors.cap);
  }
}
function course(out, e, y, depth, height, lod) {
  panel(out, 'trim', e, -0.07, e.length + 0.07, y, y + height, depth, colors.trim);
  if (lod >= 1)
    face(
      out,
      'trim',
      [
        e.point(0, y + height),
        e.point(e.length, y + height),
        e.point(e.length, y + height, depth),
        e.point(0, y + height, depth),
      ],
      [0, 1, 0],
      colors.cap,
    );
}
function pilaster(out, e, u, bottom, top, depth, lod) {
  const center = e.point(u, bottom, depth / 2);
  const width = lod >= 2 ? 0.58 : 0.45;
  const wallX = Math.abs(e.n[0]) > 0.7;
  box(
    out,
    'trim',
    center[0],
    bottom,
    center[2],
    wallX ? depth : width,
    top - bottom,
    wallX ? width : depth,
    colors.trim,
  );
  if (lod >= 2) {
    const p = e.point(u, top, depth * 0.67);
    box(
      out,
      'trim',
      p[0],
      top - 0.29,
      p[2],
      wallX ? depth * 1.34 : 0.81,
      0.29,
      wallX ? 0.81 : depth * 1.34,
      colors.cap,
    );
  }
}
function facade(out, lod) {
  const eList = edges(ring);
  for (let i = 0; i < eList.length; i++) {
    const e = eList[i],
      length = e.length;
    panel(out, 'stone', e, 0, length, foundationBottom, baseCourse, 0, colors.base);
    panel(out, 'stone', e, 0, length, baseCourse, wallEaves, 0, colors.stone);
    panel(out, 'trim', e, 0, length, wallEaves, parapetTop, 0.03, colors.cap);
    for (const [y, d, h] of [
      [2.6, 0.22, 0.26],
      [8.68, 0.3, 0.31],
      [14.93, 0.34, 0.32],
      [20.87, 0.46, 0.38],
      [22.36, 0.36, 0.32],
      [23.52, 0.26, 0.22],
    ])
      course(out, e, y, d, h, lod);
    if (length < 3.5) continue;
    const west = e.n[0] < -0.8,
      entry = entrances.find((x) => x.segment === i),
      center = entry?.fraction * length;
    const count = Math.max(1, Math.round(length / (lod ? (west ? 6.2 : 6.55) : 9.4)));
    for (let j = 0; j < count; j++) {
      const u = ((j + 0.5) * length) / count;
      const floorPositions = west
        ? [u]
        : (lod >= 2 || (lod === 1 && i === 10)) && length / count > 5.1
          ? [u - 0.88, u + 0.88]
          : [u];
      if (lod && j > 0) {
        const x = u - length / (2 * count);
        pilaster(out, e, x, 2.92, 20.86, west ? 0.53 : 0.34, lod);
        if (lod >= 2) panel(out, 'trim', e, x - 0.46, x + 0.46, 2.83, 3.26, 0.15, colors.cap);
      }
      for (const pos of floorPositions) {
        if (!entry || Math.abs(pos - center) > entry.width / 2 + 0.56) {
          const [x, , z] = e.point(pos, 0, 0.23),
            g = grade(x, z);
          if (lod && g < 1.84) window(out, e, pos, 0.9, Math.min(0.35, g + 0.8), 2.08, lod, false);
          window(out, e, pos, west ? 2.45 : 1.08, 3.83, 7.85, lod, true, west);
        }
        window(out, e, pos, west ? 2.45 : 1.08, 9.83, 13.92, lod, true, west);
        window(out, e, pos, west ? 2.17 : 1.08, 16.08, 19.72, lod, west);
      }
    }
    if (lod >= 2) {
      for (let j = 0; j <= count; j++) {
        const u = (j * length) / count;
        if (u < 0.22 || u > length - 0.22) continue;
        panel(out, 'trim', e, u - 0.1, u + 0.1, 21.02, 21.61, 0.54, colors.cap);
      }
      for (const y of [baseCourse - 1.01, baseCourse - 1.86]) course(out, e, y, 0.038, 0.083, lod);
    }
  }
}

function cap(out, slot, polygon, holes, y, tint) {
  const scratch = new MeshBufferBuilder();
  if (
    !scratch.addCap(
      slot,
      white,
      polygon,
      holes,
      () => y,
      [0, 1, 0],
      (p) => p,
      tint,
    )
  )
    throw Error('The Treasury roof cap could not be triangulated');
  const { positions, indices } = scratch.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const p = Array.from(indices.slice(i, i + 3), (j) =>
      Array.from(positions.slice(j * 3, j * 3 + 3)),
    );
    face(out, slot, p, [0, 1, 0], tint);
  }
}
function roof(out, lod) {
  const court = rectangle(courtyard);
  cap(out, 'roof', ring, [court], wallEaves - 0.13, colors.roof);
  for (const [i, p] of court.entries()) {
    const e = edge(p, court[(i + 1) % court.length], -1);
    panel(
      out,
      'stone',
      e,
      0,
      e.length,
      coveredCourtyardEaves - 0.08,
      wallEaves - 0.12,
      0,
      colors.base,
    );
  }
  const [a, b, c, d] = courtyard,
    r = (c + d) / 2;
  for (const p of [c, d])
    face(
      out,
      'roof',
      [
        [a, coveredCourtyardEaves, p],
        [b, coveredCourtyardEaves, p],
        [b, coveredCourtyardRidge, r],
        [a, coveredCourtyardRidge, r],
      ],
      [0, 1, 0],
      colors.court,
    );
  for (const x of [a, b])
    face(
      out,
      'glass',
      [
        [x, coveredCourtyardEaves, c],
        [x, coveredCourtyardEaves, d],
        [x, coveredCourtyardRidge, r],
      ],
      [x === a ? -1 : 1, 0, 0],
      colors.court,
    );
  if (lod) {
    const bayCount = lod === 1 ? 3 : 9;
    for (let i = 0; i <= bayCount; i++) {
      const x = a + (i * (b - a)) / bayCount;
      for (const z of [c, d])
        beam(
          out,
          'detail',
          [x, coveredCourtyardEaves + 0.05, z],
          [x, coveredCourtyardRidge + 0.05, r],
          0.1,
          0.09,
          colors.courtRib,
        );
    }
    for (const [x, z] of [
      [-12, -29],
      [10, -29],
      [9, 31],
      [-11, 31],
    ]) {
      box(out, 'trim', x, wallEaves - 0.2, z, 1.4, 0.99, 1.13, colors.base);
      box(out, 'trim', x, wallEaves + 0.7, z, 1.58, 0.2, 1.32, colors.cap);
    }
    for (const [x, z] of [
      [-23.8, -11],
      [26.2, 10],
    ]) {
      box(out, 'glass', x, wallEaves - 0.14, z, 2.8, 1.06, 4.9, colors.court);
      const t = wallEaves + 1.47;
      for (const side of [-1, 1])
        face(
          out,
          'roof',
          [
            [x + side * 1.55, t - 0.65, z - 2.62],
            [x + side * 1.55, t - 0.65, z + 2.62],
            [x, t, z + 2.62],
            [x, t, z - 2.62],
          ],
          [0, 1, 0],
          colors.copper,
        );
    }
  }
}

function pavilions(out, lod) {
  for (const [x, z] of cornerPavilions) {
    const p = rectangle([x - 5.9, x + 5.9, z - 5.68, z + 5.68]);
    box(
      out,
      'stone',
      x,
      wallEaves - 1.52,
      z,
      11.8,
      pavilionEaves - wallEaves + 1.52,
      11.36,
      colors.stone,
    );
    box(out, 'roof', x, pavilionEaves - 0.11, z, 12.12, 0.22, 11.69, colors.roof);
    for (const e of edges(p)) {
      course(out, e, pavilionEaves - 0.37, 0.41, 0.33, lod);
      course(out, e, pavilionEaves + 0.77, 0.37, 0.22, lod);
      for (const q of lod ? [0.25, 0.5, 0.75] : [0.5]) {
        const u = q * e.length;
        window(out, e, u, 1.02, wallEaves - 1.06, pavilionEaves - 0.64, lod, true);
      }
      if (lod >= 2)
        for (let i = 0; i <= 5; i++) {
          const p = e.point((i * e.length) / 5, pavilionEaves + 0.04, 0.12);
          box(out, 'trim', p[0], p[1], p[2], 0.28, 0.81, 0.28, colors.trim);
        }
    }
    if (lod)
      for (const dx of [-5.78, 5.78])
        for (const dz of [-5.48, 5.48]) {
          box(
            out,
            'trim',
            x + dx,
            pavilionEaves,
            z + dz,
            0.61,
            pavilionTop - pavilionEaves - 0.45,
            0.61,
            colors.trim,
          );
          if (lod >= 1)
            box(out, 'trim', x + dx, pavilionTop - 0.49, z + dz, 0.43, 0.48, 0.43, colors.cap);
        }
    if (!lod)
      box(
        out,
        'trim',
        x,
        pavilionEaves,
        z,
        1.04,
        pavilionTop - pavilionEaves - 0.02,
        1.08,
        colors.trim,
      );
    if (lod >= 2) box(out, 'trim', x, pavilionEaves - 0.22, z, 2.82, 1.11, 2.58, colors.base);
  }
}
function portals(out, lod) {
  const eList = edges(ring);
  for (const { segment, fraction, width, top } of entrances) {
    const e = eList[segment],
      u = fraction * e.length,
      w = width / 2,
      [x, , z] = e.point(u, 0, 0.45);
    const slope = grade(x, z),
      threshold = slope + (segment === 2 ? 0.7 : 0.46);
    const spring = top - 0.44 * w;
    const n = lod >= 2 ? 8 : 4;
    arched(out, 'trim', e, u, width + 0.45, threshold, spring, top + 0.24, 0.058, colors.trim, n);
    arched(out, 'glass', e, u, width, threshold, spring, top, 0.098, colors.brown, n);
    for (const d of [-1, 1]) pilaster(out, e, u + d * (w + 0.38), threshold, top + 0.19, 0.49, lod);
    panel(out, 'trim', e, u - w - 0.65, u + w + 0.65, top + 0.18, top + 0.46, 0.55, colors.cap);
    if (lod) {
      panel(out, 'detail', e, u - 0.055, u + 0.055, threshold, top - 0.16, 0.127, colors.frame);
      const count = segment === 2 ? 5 : 3;
      const base = Math.min(slope, grade(x + e.n[0], z + e.n[2])) - 0.26;
      for (let i = 0; i < count; i++) {
        const depth = 0.44 * (i + 1),
          [xx, , zz] = e.point(u, 0, depth / 2);
        const y = threshold - ((threshold - base - 0.11) * i) / count;
        box(
          out,
          'trim',
          xx,
          base,
          zz,
          Math.abs(e.n[0]) > 0.7 ? depth : width + 0.42,
          y - base,
          Math.abs(e.n[0]) > 0.7 ? width + 0.42 : depth,
          colors.base,
        );
      }
    }
  }
}
function buildLevel(out, lod) {
  facade(out, lod);
  roof(out, lod);
  pavilions(out, lod);
  portals(out, lod);
}
export const treasurySkyline = (out) => buildLevel(out, 0);
export const treasuryDistrict = (out) => buildLevel(out, 1);
export const treasuryStreet = (out) => buildLevel(out, 2);
export const treasuryCloseup = (out) => buildLevel(out, 3);

const recipe = 'brisbane-treasury-model.mjs',
  camera = [79, 43, 100],
  lookAt = [1, 13, 3];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'treasuryDistrict', 0.3],
    ['street', 'treasuryStreet', 0.098],
    ['closeup', 'treasuryCloseup', 0.044],
  ].map(([name, entry, errorMeters]) => [name, { export: entry, errorMeters, surfaces }]),
);
export const treasuryModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: treasuryCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The former Treasury Building as it stood in 2005, with four sandstone frontages, regular paired sash, deep cornices, raised corner pavilions and a covered courtyard.',
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
    basis: 'The complete twenty-vertex outer boundary of OSM Treasury Building relation 7772386.',
  },
  mediumFiContext: {
    scale: 0.79,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['stone_sandstone', 'metal_standing_seam'],
  qaCameras: [
    { name: 'elizabeth-street-from-queens-gardens', position: [4, 17, 110], lookAt: [0, 13, 26] },
    {
      name: 'william-and-queen-street-elevations',
      position: [-80, 24, -85],
      lookAt: [-10, 12, -7],
    },
    { name: 'covered-courtyard-and-four-street-wings', position: [38, 98, 47], lookAt: [0, 11, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-brisbane-treasury-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'treasurySkyline',
    errorMeters: 0.62,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. OpenStreetMap ODbL 1.0 geographic controls. Original public-domain references by Figaro and H. W. Mobsby, latter via State Library of Queensland.',
};
