/** Rungrado 1st of May Stadium on Rungna Island, Pyongyang. */
import fs from 'node:fs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const { outline, pitch } = read('map-frame').geometry;
const d = plan.dimensions;
const colors = Object.fromEntries(
  Object.entries({
    apron: 'a4a296',
    plinth: '8e938d',
    concrete: 'a9aaa0',
    roof: 'd3d5cd',
    rim: 'e0dfd1',
    seam: 'b9bdb6',
    underside: 'a9b5b2',
    pier: 'c7cbc1',
    glazing: '667d80',
    recess: '516869',
    band: 'a1abaa',
    tier: '9d9d94',
    seatRed: 'ad6c59',
    seatBlue: '72888e',
    seatGrey: '94a19a',
    track: '9e6a58',
    trackEdge: '889295',
    green: '778965',
    greenLight: '84956f',
    line: 'dadcbe',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const palette = 'palette:#ffffff';
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.93 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.72, metallic: 0.12 },
  glazing: { slot: 'window', localRef: palette, roughness: 0.7 },
  trim: { slot: 'trim', localRef: palette, roughness: 0.86 },
  ground: { slot: 'foundation', localRef: palette, roughness: 0.95 },
};
const turn = 2 * Math.PI;
const segment = turn / d.roofSectors;
const phase = -segment / 2;
const mix = (a, b, t) => a + (b - a) * t;
const cross2 = ([x, z], [u, v]) => x * v - z * u;
const direction = (theta) => [Math.sin(theta), Math.cos(theta)];
const outlineEdges = outline.map((a, i) => {
  const b = outline[(i + 1) % outline.length];
  return [a, [b[0] - a[0], b[1] - a[1]]];
});
function mappedRadius(theta) {
  const dir = direction(theta);
  let found = Infinity;
  for (const [a, e] of outlineEdges) {
    const div = cross2(dir, e);
    if (Math.abs(div) < 1e-10) continue;
    const along = cross2(a, dir) / div;
    const distance = cross2(a, e) / div;
    if (along >= 0 && along <= 1 && distance > 0) found = Math.min(found, distance);
  }
  if (!Number.isFinite(found)) throw Error('Stadium perimeter could not be sampled');
  return found;
}
const radial = (angle, radius, y) => [radius * Math.sin(angle), y, radius * Math.cos(angle)];
const outward = (angle) => [Math.sin(angle), 0, Math.cos(angle)];
const onEllipse = (angle, x, z, y) => [x * Math.sin(angle), y, z * Math.cos(angle)];

function normal(a, b, c) {
  const [x, y, z] = b.map((v, i) => v - a[i]);
  const [u, v, w] = c.map((v, i) => v - a[i]);
  return [y * w - z * v, z * u - x * w, x * v - y * u];
}

function roofPoint(theta, progress, radius, bay, underside = 0) {
  const outer =
    d.archFootY +
    (d.archCrownY - d.archFootY) * Math.pow(Math.max(0, Math.sin(Math.PI * bay)), 0.67);
  const inner = d.innerEaveY + 2.7 * Math.cos(Math.PI * (bay - 0.5));
  const eased = progress * progress * (3 - 2 * progress);
  const swell = Math.sin(Math.PI * progress) * (10.8 + 2.4 * Math.sin(Math.PI * bay));
  const height = Math.min(d.roofCrestY, mix(outer, inner, eased) + swell);
  const innerRadius = 1 / Math.hypot(Math.sin(theta) / 77, Math.cos(theta) / 102);
  return radial(theta, mix(radius, innerRadius, progress), height - underside);
}

function canopy(out, level) {
  const span = [3, 6, 14, 22][level];
  const depth = [2, 4, 8, 11][level];
  for (let sector = 0; sector < d.roofSectors; sector++) {
    const section = phase + sector * segment;
    const stations = Array.from({ length: span + 1 }, (_, i) => {
      const t = i / span;
      const a = section + segment * t;
      return { t, a, r: mappedRadius(a) * 0.997 };
    });
    for (let i = 0; i < span; i++) {
      const one = stations[i];
      const two = stations[i + 1];
      const point = (row, t, offset = 0) => roofPoint(row.a, t, row.r, row.t, offset);
      for (let j = 0; j < depth; j++) {
        const near = j / depth;
        const far = (j + 1) / depth;
        const a = point(one, near),
          b = point(two, near),
          c = point(two, far),
          e = point(one, far);
        const shade = i === 0 || i === span - 1 ? colors.rim : colors.roof;
        quad(out, 'roof', [a, b, c, e], normal(a, b, e), shade);
      }
      const outside0 = point(one, 0),
        outside1 = point(two, 0);
      const bottom0 = point(one, 0, 1.05),
        bottom1 = point(two, 0, 1.05);
      quad(
        out,
        'trim',
        [outside0, outside1, bottom1, bottom0],
        outward((one.a + two.a) / 2),
        colors.rim,
      );
      if (level >= 1) {
        const begin = point(one, 1),
          end = point(two, 1);
        quad(
          out,
          'trim',
          [begin, end, point(two, 1, 1.4), point(one, 1, 1.4)],
          outward((one.a + two.a) / 2).map((x) => -x),
          colors.underside,
        );
        const underside = [
          point(one, 1, 1.4),
          point(two, 1, 1.4),
          point(two, 0.78, 1.3),
          point(one, 0.78, 1.3),
        ];
        const n = normal(underside[0], underside[1], underside[3]);
        quad(out, 'roof', underside, n, colors.underside);
      }
      if (level >= 2 && i % 2 === 0) {
        for (let j = Math.ceil(depth * 0.15); j < depth; j++) {
          const o0 = j / depth,
            o1 = (j + 1) / depth;
          const delta = Math.min(0.0032, (two.a - one.a) * 0.17);
          const inset = { ...one, a: one.a + delta, t: one.t + delta / segment };
          const a = point(one, o0, -0.12),
            b = point(inset, o0, -0.12),
            c = point(inset, o1, -0.12),
            e = point(one, o1, -0.12);
          quad(out, 'trim', [a, b, c, e], normal(a, b, e), colors.seam);
        }
      }
    }
  }
}

function verticalBand(out, slot, ring, bottom, top, tint) {
  for (let i = 0; i < ring.length; i++) {
    const [a, ra, capA] = ring[i];
    const [first, rb, capB] = ring[(i + 1) % ring.length];
    const b = i + 1 === ring.length ? first + turn : first;
    const ya = Math.min(top, capA);
    const yb = Math.min(top, capB);
    if (ya <= bottom && yb <= bottom) continue;
    const n = outward((a + b) / 2);
    const baseA = radial(a, ra, bottom),
      baseB = radial(b, rb, bottom);
    const highA = radial(a, ra, ya),
      highB = radial(b, rb, yb);
    if (ya > bottom && yb > bottom) {
      quad(out, slot, [baseA, baseB, highB, highA], n, tint);
      continue;
    }
    const t = (bottom - ya) / (yb - ya);
    const cut = radial(mix(a, b, t), mix(ra, rb, t), bottom);
    const triangle = ya > bottom ? [baseA, cut, highA] : [cut, baseB, highB];
    out.addTriangle(
      slot,
      palette,
      triangle,
      n,
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      tint,
    );
  }
}

function facadeCap(theta, radius) {
  const phaseAngle = (theta - phase) / segment;
  const bay = phaseAngle - Math.floor(phaseAngle);
  const r = radius * 0.997;
  const inner = 1 / Math.hypot(Math.sin(theta) / 77, Math.cos(theta) / 102);
  const across = (r - radius * 0.86) / (r - inner);
  return roofPoint(theta, across, r, bay)[1] - 2.2;
}

function exterior(out, level) {
  const n = [32, 48, 96, 128][level];
  const samples = Array.from({ length: n }, (_, i) => {
    const theta = phase + (turn * i) / n;
    return [theta, mappedRadius(theta)];
  });
  const ring = (factor, trim = false) =>
    samples.map(([theta, r]) => [theta, r * factor, trim ? facadeCap(theta, r) : Infinity]);
  verticalBand(out, 'concrete', ring(0.997), d.foundationY, d.apronY, colors.plinth);
  verticalBand(out, 'concrete', ring(0.94), d.apronY, 6.2, colors.concrete);
  verticalBand(out, 'glazing', ring(0.86, true), 6.2, 37.5, colors.glazing);
  const bands =
    level === 0
      ? [14.6, 29.4]
      : level === 1
        ? [10.95, 19.6, 28.25, 36.7]
        : [10.1, 15.35, 20.7, 26.05, 31.4, 36.75];
  for (const y of bands)
    verticalBand(out, 'trim', ring(0.863, true), y, y + (level <= 1 ? 1.38 : 0.6), colors.band);
  for (const [near, far, y] of [
    [0.997, 0.94, d.apronY],
    [0.94, 0.86, 6.2],
  ]) {
    samples.forEach(([a, ra], i) => {
      const [b, rb] = samples[(i + 1) % n];
      quad(
        out,
        'ground',
        [
          radial(a, ra * near, y),
          radial(b, rb * near, y),
          radial(b, rb * far, y),
          radial(a, ra * far, y),
        ],
        [0, 1, 0],
        colors.apron,
      );
    });
  }
  if (level === 0) return;
  for (let i = 0; i < n; i++) {
    const [theta, r] = samples[i];
    const radius = r * 0.864;
    const middle = outward(theta);
    const width = i % (n / 16) === 0 ? 0.013 : 0.0048;
    const left = theta - width,
      right = theta + width;
    const top = Math.max(6.07, Math.min(36.8, facadeCap(theta, r)));
    quad(
      out,
      'concrete',
      [
        radial(left, radius, 5.65),
        radial(right, radius, 5.65),
        radial(right, radius, top),
        radial(left, radius, top),
      ],
      middle,
      colors.pier,
    );
    const doorRadius = r * 0.942;
    quad(
      out,
      'glazing',
      [
        radial(left - width, doorRadius, d.apronY + 0.18),
        radial(right + width, doorRadius, d.apronY + 0.18),
        radial(right + width, doorRadius, 4.25),
        radial(left - width, doorRadius, 4.25),
      ],
      middle,
      colors.recess,
    );
  }
}

function bowl(out, level) {
  const count = [20, 36, 80, 112][level];
  const rows = [1, 5, 16, 24][level];
  const seatingTints = [colors.seatGrey, colors.seatRed, colors.seatBlue, colors.seatGrey];
  for (let i = 0; i < count; i++) {
    const a = (turn * i) / count;
    const b = (turn * (i + 1)) / count;
    const front = onEllipse(a, 64, 105, d.fieldY);
    const frontEnd = onEllipse(b, 64, 105, d.fieldY);
    out.addTriangle(
      'ground',
      palette,
      [[0, d.fieldY, 0], front, frontEnd],
      [0, 1, 0],
      [
        [0.5, 0.5],
        [1, 0],
        [0, 0],
      ],
      colors.apron,
    );
    for (let row = 0; row < rows; row++) {
      const lo = row / rows,
        hi = (row + 1) / rows;
      const x0 = mix(64, 123, lo),
        x1 = mix(64, 123, hi);
      const z0 = mix(105, 159, lo),
        z1 = mix(105, 159, hi);
      const floor = mix(3.3, 38, lo);
      const top = mix(3.3, 38, hi);
      const sectorColor = seatingTints[Math.floor((16 * i) / count) % seatingTints.length];
      const circulation = level >= 2 && (i % 5 === 0 || row === Math.floor(rows * 0.43));
      quad(
        out,
        'ground',
        [
          onEllipse(a, x0, z0, floor),
          onEllipse(b, x0, z0, floor),
          onEllipse(b, x1, z1, floor),
          onEllipse(a, x1, z1, floor),
        ],
        [0, 1, 0],
        circulation ? colors.tier : sectorColor,
      );
      const inside = outward((a + b) / 2).map((x) => -x);
      quad(
        out,
        'concrete',
        [
          onEllipse(a, x1, z1, floor),
          onEllipse(b, x1, z1, floor),
          onEllipse(b, x1, z1, top),
          onEllipse(a, x1, z1, top),
        ],
        inside,
        colors.tier,
      );
    }
  }
}

const pitchCenter = pitch.reduce((sum, [x, z]) => [sum[0] + x / 4, sum[1] + z / 4], [0, 0]);
const [px, pz] = pitchCenter;
const caps = (angle, r, y) => {
  const x = Math.sin(angle) * r;
  const z = Math.cos(angle) * r + Math.sign(Math.cos(angle)) * 42.15;
  return [px + x, y, pz + z];
};
function ovalPoints(radius, y, count) {
  const angles = Array.from({ length: count }, (_, i) => (turn * i) / count);
  return angles.map((a) => caps(a, radius, y));
}
function turf(out, level) {
  const y = d.fieldY + 0.11;
  const n = [24, 48, 72, 104][level];
  const perimeter = ovalPoints(46.55, y, n);
  const inner = ovalPoints(36.7, y, n);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    quad(out, 'ground', [inner[i], inner[j], perimeter[j], perimeter[i]], [0, 1, 0], colors.track);
    if (level >= 1) {
      const lanes = level >= 2 ? 8 : 3;
      for (let lane = 0; lane <= lanes; lane++) {
        const radius = mix(36.75, 46.38, lane / lanes);
        const a = (turn * i) / n,
          b = (turn * (i + 1)) / n;
        quad(
          out,
          'trim',
          [
            caps(a, radius, y + 0.025),
            caps(b, radius, y + 0.025),
            caps(b, radius + 0.08, y + 0.025),
            caps(a, radius + 0.08, y + 0.025),
          ],
          [0, 1, 0],
          colors.line,
        );
      }
    }
  }
  const fieldY = y + 0.035;
  out.addTriangle(
    'ground',
    palette,
    [pitch[0], pitch[1], pitch[2]].map(([x, z]) => [x, fieldY, z]),
    [0, 1, 0],
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    colors.green,
  );
  out.addTriangle(
    'ground',
    palette,
    [pitch[0], pitch[2], pitch[3]].map(([x, z]) => [x, fieldY, z]),
    [0, 1, 0],
    [
      [0, 0],
      [1, 1],
      [0, 1],
    ],
    colors.green,
  );
  if (level < 2) return;
  const bands = level >= 3 ? 12 : 8;
  const pitchX = Math.abs(pitch[1][0] - pitch[0][0]) / 2;
  const pitchZ = Math.abs(pitch[3][1] - pitch[0][1]) / 2;
  for (let i = 0; i < bands; i += 2) {
    const z0 = pz + mix(-pitchZ, pitchZ, i / bands);
    const z1 = pz + mix(-pitchZ, pitchZ, (i + 1) / bands);
    boxPaint(out, px - pitchX, px + pitchX, z0, z1, fieldY + 0.012, colors.greenLight);
  }
  const paintY = fieldY + 0.032;
  for (const i of [-1, 1]) {
    const touch = px + i * pitchX;
    const goal = pz + i * pitchZ;
    boxPaint(out, touch - 0.065, touch + 0.065, pz - pitchZ, pz + pitchZ, paintY, colors.line);
    boxPaint(out, px - pitchX, px + pitchX, goal - 0.065, goal + 0.065, paintY, colors.line);
    const top = goal - i * 16.5;
    boxPaint(out, px - 20.15, px + 20.15, top - 0.052, top + 0.052, paintY, colors.line);
    for (const side of [-1, 1]) {
      const line = px + side * 20.15;
      boxPaint(
        out,
        line - 0.052,
        line + 0.052,
        Math.min(top, goal),
        Math.max(top, goal),
        paintY,
        colors.line,
      );
    }
  }
  boxPaint(out, px - pitchX, px + pitchX, pz - 0.06, pz + 0.06, paintY, colors.line);
  const radius = 9.15;
  const count = level >= 3 ? 44 : 28;
  for (let i = 0; i < count; i++) {
    const a = (turn * i) / count,
      b = (turn * (i + 1)) / count;
    const p = (theta, r) => [px + r * Math.sin(theta), paintY, pz + r * Math.cos(theta)];
    quad(
      out,
      'trim',
      [p(a, radius), p(b, radius), p(b, radius + 0.1), p(a, radius + 0.1)],
      [0, 1, 0],
      colors.line,
    );
  }
}

function boxPaint(out, x0, x1, z0, z1, y, tint) {
  quad(
    out,
    'ground',
    [
      [x0, y, z0],
      [x1, y, z0],
      [x1, y, z1],
      [x0, y, z1],
    ],
    [0, 1, 0],
    tint,
  );
}

function draw(out, level) {
  exterior(out, level);
  bowl(out, level);
  turf(out, level);
  canopy(out, level);
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [455, 238, 540];
const lookAt = [0, 20, 0];
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
    'Elliptical stadium with sixteen pale scalloped roof shells, tall glazed bays, tiered bowl, athletics track and a mapped soccer pitch.',
  camera,
  lookAt,
  sunDirection: [-207, 220, 310],
  recipeDependencies: ['generate-motat-building.mjs'],
  embeddedCanonicalGraphs: ['concrete_plain', 'metal_standing_seam'],
  mediumFiContext: {
    scale: 1,
    cameraYaw: 0.84,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'canopy-and-island', position: [340, 192, 435], lookAt: [0, 17, 0] },
    { name: 'south-scalloped-canopy', position: [-132, 58, 349], lookAt: [0, 29, 105] },
    { name: 'open-bowl-and-pitch', position: [123, 160, 144], lookAt: [6, 12, 4] },
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
    errorMeters: 4.7,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 2.0, surfaces },
      street: { export: 'street', errorMeters: 0.82, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.27, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original geometry based on the exact CC0 Qualla stadium crop, OSM stadium and pitch perimeters, written architectural descriptions, and original Copernicus terrain.',
};
