/** The former municipal palace facing Plaza Botero in Medellín. */
import fs from 'node:fs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import {
  box as meshBox,
  quad,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const { outline } = read('map-frame').geometry;
const d = plan.dimensions;
const palette = 'palette:#ffffff';
const colors = Object.fromEntries(
  Object.entries({
    body: 'b69476',
    warm: 'ae876b',
    darkBrick: '93755d',
    course: 'c9b29b',
    render: 'cbbca7',
    pale: 'e1d9c8',
    sill: 'bcb1a1',
    foundation: '9a9286',
    stone: 'aaa498',
    coping: 'aba397',
    shadow: '776f66',
    glass: '505b59',
    sash: '90918a',
    gate: '575954',
    roof: '98928a',
    court: 'bcafa1',
    blue: '899f96',
    leaf: '7e846f',
    basin: 'aaa99b',
  }).map(([key, hex]) => [key, rgb(hex)]),
);
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.95 },
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.94 },
  roof: { slot: 'roof', localRef: palette, roughness: 0.95 },
  trim: { slot: 'trim', localRef: palette, roughness: 0.89 },
  glass: { slot: 'window', localRef: palette, roughness: 0.68 },
};
const at = ([x, z], y) => [x, y, z];
const box = (out, slot, x0, x1, y0, y1, z0, z1, tint) =>
  meshBox(out, slot, [x0, y0, z0], [x1, y1, z1], tint);
const rect = ([x0, z0, x1, z1]) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
const mainCourts = d.courtyards.map(rect);
const rearCourts = d.rearLightwells.map(rect);
const allCourts = [...mainCourts, ...rearCourts];

function edges(ring, inward = false) {
  const twiceArea = ring.reduce((sum, [x, z], i) => {
    const [nx, nz] = ring[(i + 1) % ring.length];
    return sum + x * nz - nx * z;
  }, 0);
  const direction = Math.sign(twiceArea) * (inward ? -1 : 1);
  return ring.map(([x, z], i) => {
    const [nx, nz] = ring[(i + 1) % ring.length];
    const dx = nx - x;
    const dz = nz - z;
    const length = Math.hypot(dx, dz);
    const tangent = [dx / length, 0, dz / length];
    const normal = [(direction * dz) / length, 0, (-direction * dx) / length];
    const point = (u, y, depth = 0) => [
      x + (dx * u) / length + normal[0] * depth,
      y,
      z + (dz * u) / length + normal[2] * depth,
    ];
    return { length, normal, tangent, point };
  });
}
const exterior = edges(outline);

function panel(out, face, slot, u0, u1, y0, y1, depth, tint) {
  const p = face.point;
  quad(
    out,
    slot,
    [p(u0, y0, depth), p(u1, y0, depth), p(u1, y1, depth), p(u0, y1, depth)],
    face.normal,
    tint,
  );
}

function ledge(out, face, u0, u1, y0, y1, depth, tint, base = 0) {
  const p = face.point;
  panel(out, face, 'trim', u0, u1, y0, y1, depth, tint);
  quad(
    out,
    'trim',
    [p(u0, y1, base), p(u1, y1, base), p(u1, y1, depth), p(u0, y1, depth)],
    [0, 1, 0],
    tint,
  );
  quad(
    out,
    'trim',
    [p(u0, y0, base), p(u0, y0, depth), p(u0, y1, depth), p(u0, y1, base)],
    face.tangent.map((value) => -value),
    tint,
  );
  quad(
    out,
    'trim',
    [p(u1, y0, depth), p(u1, y0, base), p(u1, y1, base), p(u1, y1, depth)],
    face.tangent,
    tint,
  );
}

function horizontal(out, ring, holes, y, tint) {
  const points = [...ring, ...holes.flat()];
  let cut = ring.length;
  const offsets = holes.map((hole) => {
    const start = cut;
    cut += hole.length;
    return start;
  });
  const triangles = earcut(points.flat(), offsets);
  for (let i = 0; i < triangles.length; i += 3) {
    const triangle = triangles.slice(i, i + 3).map((index) => points[index]);
    out.addTriangle(
      'roof',
      palette,
      triangle.map((p) => at(p, y)),
      [0, 1, 0],
      triangle,
      tint,
    );
  }
}

function openings(out, face, u, y, width, height, level, courtyard = false) {
  const w = width / 2;
  const depth = courtyard ? 0.055 : 0.095;
  if (level >= 2)
    panel(
      out,
      face,
      'trim',
      u - w - 0.105,
      u + w + 0.105,
      y - 0.095,
      y + height + 0.095,
      depth,
      colors.sill,
    );
  panel(out, face, 'glass', u - w, u + w, y, y + height, depth + 0.012, colors.glass);
  if (level >= 2)
    ledge(out, face, u - w - 0.15, u + w + 0.15, y - 0.16, y - 0.045, depth + 0.14, colors.sill);
  if (level < 3) return;
  panel(out, face, 'trim', u - 0.034, u + 0.034, y, y + height, depth + 0.021, colors.sash);
  panel(
    out,
    face,
    'trim',
    u - w,
    u + w,
    y + height * 0.78,
    y + height * 0.78 + 0.04,
    depth + 0.023,
    colors.sash,
  );
}

function perimeter(out, level) {
  exterior.forEach((face, index) => {
    const n = face.length;
    panel(out, face, 'stone', 0, n, d.foundationY, d.terraceY, 0, colors.foundation);
    panel(out, face, 'brick', 0, n, d.terraceY, d.parapetY, 0, colors.body);
    if (index !== 0) ledge(out, face, 0, n, 0.52, d.terraceY, 1.34, colors.stone);
    ledge(out, face, 0, n, d.parapetY - 0.28, d.parapetY + 0.03, 0.14, colors.coping);
    if (n < 9) {
      panel(out, face, 'stone', 0.1, n - 0.1, d.terraceY, d.mainRoofY, 0.018, colors.render);
      return;
    }
    const intervals =
      index === 4
        ? [
            [1.05, n / 2 - 5.45],
            [n / 2 + 5.45, n - 1.05],
          ]
        : [[0.8, n - 0.8]];
    for (const [left, right] of intervals) {
      ledge(out, face, left, right, 16.44, 16.81, 0.34, colors.render);
      const bays = Math.max(2, Math.round((right - left) / (level === 0 ? 7.5 : 3.25)));
      const spacing = (right - left) / bays;
      for (let i = 0; i < bays; i++) {
        const u = left + (i + 0.5) * spacing;
        const pier = left + i * spacing;
        const windowWidth = Math.min(1.61, spacing * 0.57);
        panel(
          out,
          face,
          'brick',
          u - spacing * 0.37,
          u + spacing * 0.37,
          2.15,
          15.95,
          0.037,
          colors.warm,
        );
        if (level >= 1) {
          ledge(out, face, pier - 0.16, pier + 0.16, 1.22, 16.68, 0.23, colors.render);
          if (level >= 2) {
            for (const y of [5.17, 9.82, 14.3]) {
              ledge(
                out,
                face,
                u - spacing * 0.37,
                u + spacing * 0.37,
                y,
                y + 0.17,
                0.095,
                colors.course,
              );
            }
          }
        }
        for (const y of [2.9, 7.48, 12.08]) openings(out, face, u, y, windowWidth, 2.07, level);
        if (level >= 2 && index !== 4)
          openings(out, face, u, -1.49, windowWidth * 0.85, 0.75, level);
      }
    }
  });
}

function elevatedEntrance(out, level) {
  const z = d.entryCenterZ;
  const x = d.entryFrontX;
  const w = 4.97;
  const x0 = 29.38;
  box(out, 'stone', x0, x, d.terraceY, d.entryRoofY, z - w, z + w, colors.render);
  box(
    out,
    'trim',
    x - 0.24,
    x + 0.22,
    d.entryRoofY - 0.26,
    d.entryRoofY + 0.08,
    z - w - 0.16,
    z + w + 0.16,
    colors.pale,
  );
  box(
    out,
    'brick',
    x0 - 1.0,
    x0 + 1.0,
    d.mainRoofY,
    19.62,
    z - w - 0.83,
    z + w + 0.83,
    colors.warm,
  );
  box(out, 'trim', x0 - 1.18, x0 + 1.15, 19.52, 19.73, z - w - 0.98, z + w + 0.98, colors.coping);
  const [face] = edges([
    [x, z - w],
    [x, z + w],
    [x0, z + w],
    [x0, z - w],
  ]);
  const center = face.length / 2;
  panel(out, face, 'trim', center - 3.44, center + 3.44, 1.15, 8.95, 0.1, colors.shadow);
  for (const shift of [-2.23, 0, 2.23]) {
    const u = center + shift;
    panel(out, face, 'glass', u - 0.9, u + 0.9, 1.18, 5.6, 0.122, colors.gate);
    openings(out, face, u, 10.2, 1.27, 5.65, level);
    if (level >= 2) {
      for (const offset of [-0.55, -0.28, 0, 0.28, 0.55]) {
        panel(
          out,
          face,
          'trim',
          u + offset - 0.025,
          u + offset + 0.025,
          1.36,
          5.5,
          0.139,
          colors.sash,
        );
      }
    }
  }
  for (const shift of [-3.65, -1.12, 1.12, 3.65]) {
    const u = center + shift;
    ledge(out, face, u - 0.13, u + 0.13, 1.15, 16.8, 0.29, colors.pale);
  }
  ledge(out, face, center - 3.72, center + 3.72, 8.92, 9.28, 0.62, colors.sill);
  ledge(out, face, center - 3.55, center + 3.55, 16.74, 17.02, 0.22, colors.pale);
  const steps = level > 0 ? 5 : 2;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const zHalf = 5.62 - t * 0.56;
    box(
      out,
      'stone',
      x - 0.22,
      x + 3.5 - t * 3.18,
      -1.3,
      ((i + 1) * d.terraceY) / steps,
      z - zHalf,
      z + zHalf,
      colors.stone,
    );
  }
}

function courtyard(out, ring, index, level) {
  const main = index < 2;
  const floor = main ? 1.08 : 5.5;
  horizontal(out, ring, [], floor, colors.court);
  for (const face of edges(ring, true)) {
    const n = face.length;
    panel(out, face, 'stone', 0, n, floor, d.mainRoofY, 0, colors.render);
    ledge(out, face, 0, n, d.mainRoofY - 0.18, d.mainRoofY + 0.21, 0.2, colors.coping);
    if (level === 0) continue;
    const collar = main ? 1.7 : 0.3;
    if (main) ledge(out, face, 0, n, d.mainRoofY - 0.32, d.mainRoofY, collar, colors.pale);
    const count = Math.max(2, Math.round(n / 3.65));
    const spacing = n / count;
    for (const y of main ? [5.58, 10.6] : [9.9, 13.6]) {
      ledge(out, face, 0, n, y - 0.26, y + 0.47, collar, colors.pale);
      for (let i = 0; i < count; i++) {
        const u = (i + 0.5) * spacing;
        const pier = i * spacing + 0.2;
        if (main) {
          ledge(
            out,
            face,
            pier - 0.16,
            pier + 0.16,
            y + 0.47,
            y === 10.6 ? d.mainRoofY - 0.32 : y + 4.76,
            collar,
            colors.pale,
            collar - 0.32,
          );
          panel(
            out,
            face,
            'trim',
            u - spacing * 0.35,
            u + spacing * 0.35,
            y + 0.5,
            y + 0.58,
            collar - 0.02,
            colors.sash,
          );
        }
        openings(out, face, u, y + 0.58, Math.min(1.62, spacing * 0.6), 2.46, level, true);
      }
    }
    for (let i = 0; i < count; i++) {
      const u = (i + 0.5) * spacing;
      openings(out, face, u, floor + 0.65, Math.min(1.55, spacing * 0.6), 2.37, level, true);
    }
  }
  const [x0, z0] = ring[0];
  const [x1, z1] = ring[2];
  const x = (x0 + x1) / 2;
  const z = (z0 + z1) / 2;
  if (index === 0 && level >= 1) {
    const octagon = Array.from({ length: 8 }, (_, i) => {
      const a = ((i + 0.5) * Math.PI) / 4;
      return [x + Math.cos(a) * 2.5, z + Math.sin(a) * 2.5];
    });
    for (const face of edges(octagon)) {
      panel(out, face, 'stone', 0, face.length, floor, floor + 0.44, 0, colors.basin);
      ledge(out, face, 0, face.length, floor + 0.39, floor + 0.47, 0.1, colors.stone);
    }
    horizontal(out, octagon, [], floor + 0.31, colors.blue);
    if (level >= 2) {
      box(out, 'stone', x - 0.42, x + 0.42, floor, floor + 1.0, z - 0.42, z + 0.42, colors.basin);
      box(
        out,
        'stone',
        x - 0.71,
        x + 0.71,
        floor + 0.94,
        floor + 1.2,
        z - 0.71,
        z + 0.71,
        colors.stone,
      );
      for (const edge of [-1, 1]) {
        const px = x + edge * 5.28;
        box(
          out,
          'stone',
          px - 1.65,
          px + 1.65,
          floor,
          floor + 0.34,
          z - 3.1,
          z + 3.1,
          colors.stone,
        );
        box(
          out,
          'roof',
          px - 1.52,
          px + 1.52,
          floor + 0.33,
          floor + 0.38,
          z - 3.02,
          z + 3.02,
          colors.leaf,
        );
      }
    }
  }
  if (index === 2 && level >= 1) {
    box(out, 'stone', x - 1.2, x + 1.2, floor, floor + 0.17, z - 4.2, z + 4.2, colors.basin);
    box(
      out,
      'roof',
      x - 0.95,
      x + 0.95,
      floor + 0.16,
      floor + 0.19,
      z - 3.95,
      z + 3.95,
      colors.blue,
    );
  }
}

function draw(out, level) {
  perimeter(out, level);
  horizontal(out, outline, allCourts, d.mainRoofY, colors.roof);
  elevatedEntrance(out, level);
  allCourts.forEach((ring, index) => courtyard(out, ring, index, level));
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [107, 77, 104];
const lookAt = [1, 8, -1];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe: `${slug}-model.mjs`,
  surfaces,
  build: closeup,
  wikidataId: plan.wikidataId,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Former municipal palace in Medellín with its three-storey Art Deco perimeter, projecting axial arrival and paired open courtyards.',
  camera,
  lookAt,
  sunDirection: [102, 156, -109],
  recipeDependencies: ['generate-motat-building.mjs', 'polygon-triangulation.mjs'],
  embeddedCanonicalGraphs: ['brick', 'stone_limestone_raw'],
  mediumFiContext: {
    scale: 1,
    cameraYaw: 0.96,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'palace-and-open-courts', position: [81, 77, 70], lookAt: [0, 8, 0] },
    { name: 'carabobo-elevation', position: [83, 13, -13], lookAt: [30, 10, -1] },
    { name: 'north-court-gallery', position: [9, 25, -21], lookAt: [-6, 6, -15] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `${slug}-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 2.1,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.95, surfaces },
      street: { export: 'street', errorMeters: 0.33, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.11, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original geometry from the mapped footprint, an exact public-domain Qualla site plan, two original photographer-dedicated courtyard photographs and the conservation survey.',
};
