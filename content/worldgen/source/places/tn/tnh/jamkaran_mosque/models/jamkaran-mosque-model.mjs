import fs from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  cleanRing,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (file) => JSON.parse(fs.readFileSync(new URL('../' + file, import.meta.url)));
const requireGeometry = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
);
const { default: earcut } = requireGeometry('earcut');
const plan = read('plan-controls.json');
const terrain = read('terrain-grid.json');
const d = plan.dimensions;
const color = {
  brick: rgb('bfab89'),
  brickPale: rgb('d3bf9d'),
  marble: rgb('c2bfb2'),
  roof: rgb('a69983'),
  turquoise: rgb('389f9b'),
  green: rgb('46735f'),
  cobalt: rgb('2a526d'),
  ink: rgb('263541'),
  ivory: rgb('d3c3a1'),
  gold: rgb('c5a263'),
};
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_marble', roughness: 0.92, metallic: 0 },
  roof: { slot: 'roof', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  tile: { slot: 'trim', graph: 'tile_glazed', roughness: 0.64, metallic: 0.04 },
  mosaic: { slot: 'trim', graph: 'tile_mosaic', roughness: 0.72, metallic: 0 },
  opening: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.96, metallic: 0 },
};
const levels = [
  { segments: 8, bands: 0, passage: 0, arcadeWidth: 60, decoration: false },
  { segments: 12, bands: 1, passage: 1, arcadeWidth: 15.3, decoration: false },
  { segments: 20, bands: 2, passage: 2, arcadeWidth: 8.5, decoration: false },
  { segments: 36, bands: 3, passage: 3, arcadeWidth: 5.9, decoration: true },
];

function grade([x, z]) {
  const s = (x - terrain.origin[0]) / terrain.stepMeters;
  const t = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(s);
  const j = Math.floor(t);
  if (i < 0 || j < 0 || i >= terrain.size[0] - 1 || j >= terrain.size[1] - 1) {
    throw Error('Jamkaran paving exceeds the source elevation window');
  }
  const u = s - i;
  const v = t - j;
  const sample = (r) => terrain.heightsMeters[r][i] * (1 - u) + terrain.heightsMeters[r][i + 1] * u;
  return sample(j) * (1 - v) + sample(j + 1) * v - terrain.modelDatumElevationMeters;
}

function panel(out, slot, points, tint) {
  const normal = normalFor(...points);
  if (points.length === 4) {
    quad(out, slot, points, normal, tint);
  } else {
    out.addConvexPolygon(slot, 'palette:#ffffff', points, normal, (p) => [p[0], p[1] + p[2]], tint);
  }
}

function cap(out, slot, ring, heightAt, tint, facing = 1) {
  const indices = earcut(ring.flat(), null, 2);
  for (let i = 0; i < indices.length; i += 3) {
    const points = indices.slice(i, i + 3).map((j) => {
      const [x, z] = ring[j];
      return [x, heightAt(ring[j]), z];
    });
    panel(out, slot, normalFor(...points)[1] * facing > 0 ? points : points.toReversed(), tint);
  }
}

function extrude(out, slot, input, bottom, top, tint) {
  const signed = input.reduce((area, a, i) => {
    const b = input[(i + 1) % input.length];
    return area + a[0] * b[1] - b[0] * a[1];
  }, 0);
  const ring = signed > 0 ? input : input.toReversed();
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i],
      [bx, bz] = ring[(i + 1) % ring.length];
    panel(
      out,
      slot,
      [
        [bx, bottom, bz],
        [ax, bottom, az],
        [ax, top, az],
        [bx, top, bz],
      ],
      tint,
    );
  }
  cap(out, slot, ring, () => top, tint);
  cap(out, slot, ring, () => bottom, tint, -1);
}

function radial(out, slot, center, profile, count, tint) {
  const rings = profile.map(([y, r]) =>
    Array.from({ length: count }, (_, i) => {
      const angle = (2 * Math.PI * i) / count;
      return [center[0] + r * Math.cos(angle), y, center[1] + r * Math.sin(angle)];
    }),
  );
  for (let k = 1; k < rings.length; k++) {
    const a = rings[k - 1],
      b = rings[k];
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count;
      panel(out, slot, [a[i], b[i], b[j], a[j]], tint);
    }
  }
}
const centroid = (points) =>
  [0, 1].map((axis) => points.reduce((sum, point) => sum + point[axis], 0) / points.length);
function inset(points, factor) {
  const center = centroid(points);
  return points.map((p) => p.map((v, i) => center[i] + (v - center[i]) * factor));
}
function rect(x, z, w, l) {
  return [
    [x - w / 2, z - l / 2],
    [x + w / 2, z - l / 2],
    [x + w / 2, z + l / 2],
    [x - w / 2, z + l / 2],
  ];
}

function hall(out, row, lod) {
  const ring = cleanRing(row.outline);
  const y = row.floor + row.height;
  if (!lod.bands) {
    const xs = ring.map((p) => p[0]);
    const zs = ring.map((p) => p[1]);
    box(
      out,
      'brick',
      [Math.min(...xs), row.foundation, Math.min(...zs)],
      [Math.max(...xs), y, Math.max(...zs)],
      color.brick,
    );
    return;
  }
  extrude(out, 'brick', ring, row.foundation, y, color.brick);
  cap(out, 'roof', inset(ring, 0.98), () => y + 0.08, color.roof);
  if (lod.bands >= 2) extrude(out, 'stone', ring, row.floor - 0.08, row.floor + 1.15, color.marble);
  const outline = inset(ring, 1.005);
  for (let i = 0; i < outline.length; i++) {
    const [ax, az] = outline[i],
      [bx, bz] = outline[(i + 1) % outline.length];
    const L = Math.hypot(bx - ax, bz - az);
    const u = (bx - ax) / L,
      v = (bz - az) / L;
    const outward =
      ring.reduce(
        (t, p, j) =>
          t + p[0] * ring[(j + 1) % ring.length][1] - p[1] * ring[(j + 1) % ring.length][0],
        0,
      ) > 0
        ? 1
        : -1;
    const at = (x, y, p = 0) => [ax + u * x + v * p * outward, y, az + v * x - u * p * outward];
    if (lod.bands >= 2)
      beam(out, 'tile', at(0, y - 0.22, 0.03), at(L, y - 0.22, 0.03), 0.28, 0.68, color.turquoise);
    if (L < 10) continue;
    const n = Math.round(L / (lod.passage > 1 ? 7.4 : 17));
    for (let j = 0; j < n; j++) {
      const x = (L * (j + 0.5)) / n,
        b = row.floor + 1.7,
        top = row.floor + row.height * 0.72;
      if (row.id === 684924911 && az < -10 && bz < -10 && Math.abs(at(x, b)[0]) < 12) continue;
      const p = [
        at(x - 1.22, b, 0.075),
        at(x + 1.22, b, 0.075),
        at(x + 1.22, top - 1.25, 0.075),
        at(x, top, 0.075),
        at(x - 1.22, top - 1.25, 0.075),
      ];
      panel(out, 'opening', outward > 0 ? p.toReversed() : p, color.ink);
      if (lod.decoration) {
        beam(
          out,
          'mosaic',
          at(x - 1.3, top - 1.25, 0.13),
          at(x, top + 0.1, 0.13),
          0.16,
          0.24,
          color.cobalt,
        );
        beam(
          out,
          'mosaic',
          at(x, top + 0.1, 0.13),
          at(x + 1.3, top - 1.25, 0.13),
          0.16,
          0.24,
          color.cobalt,
        );
      }
    }
  }
}

function dome(out, details, lod) {
  const center = details.center;
  const radius = Math.max(
    ...details.outline.map((p) => Math.hypot(p[0] - center[0], p[1] - center[1])),
  );
  const rise = details.top - details.spring;
  const y = details.spring;
  const r = radius;
  const tint = color[details.color];
  const skin =
    lod.bands < 2
      ? [
          [y, r * 0.68],
          [y + rise * 0.4, r],
          [y + rise * 0.75, r * 0.67],
          [y + rise, r * 0.044],
        ]
      : [
          [y, r * 0.68],
          [y + 1.12, r * 0.71],
          [y + rise * 0.18, r * 0.9],
          [y + rise * 0.35, r],
          [y + rise * 0.53, r * 0.96],
          [y + rise * 0.71, r * 0.77],
          [y + rise * 0.85, r * 0.49],
          [y + rise * 0.94, r * 0.26],
          [y + rise, r * 0.034],
        ];
  radial(out, 'tile', center, skin, lod.segments, tint);
  if (lod.bands >= 1) {
    radial(
      out,
      'mosaic',
      center,
      [
        [y - 0.4, r * 0.69],
        [y + 0.19, r * 0.717],
        [y + 0.9, r * 0.716],
      ],
      lod.segments,
      color.cobalt,
    );
    radial(
      out,
      'tile',
      center,
      [
        [details.top - 0.12, r * 0.08],
        [details.top + 0.42, r * 0.08],
        [details.top + 0.73, r * 0.026],
      ],
      lod.segments,
      color.gold,
    );
  }
  if (!lod.decoration) return;
  const lines = details.color === 'turquoise' ? 16 : 10;
  for (let i = 0; i < lines; i++) {
    const a = (2 * Math.PI * i) / lines;
    const u = Math.cos(a),
      v = Math.sin(a);
    const p = skin.map(([h, rad]) => [
      center[0] + u * (rad + 0.07),
      h,
      center[1] + v * (rad + 0.07),
    ]);
    for (let k = 2; k < p.length; k++) {
      const p0 = p[k - 1],
        p1 = p[k];
      beam(out, 'tile', p0, p1, 0.11, 0.18, i % 2 === 0 ? color.gold : color.turquoise);
    }
  }
}

function minaret(out, tower, lod) {
  const [x, z] = tower.center,
    h = tower.height,
    r = tower.radius,
    y = tower.grade;
  const n = lod.bands === 0 ? 6 : lod.bands === 1 ? 8 : lod.segments;
  const radius = tower.role === 'gate' ? r * 0.85 : r;
  extrude(
    out,
    'brick',
    rect(x, z, r * 2.2, r * 2.2),
    y - 2.05,
    y + Math.max(4, h * 0.12),
    color.brickPale,
  );
  const profile =
    lod.bands < 2
      ? [
          [y + h * 0.1, radius],
          [y + h * 0.86, radius * 0.7],
          [y + h, radius * 0.21],
        ]
      : [
          [y + h * 0.1, radius],
          [y + h * 0.27, radius * 0.96],
          [y + h * 0.7, radius * 0.78],
          [y + h * 0.84, radius * 0.71],
          [y + h * 0.95, radius * 0.55],
        ];
  const shaftSegments = tower.role === 'gate' ? 8 : n;
  radial(out, 'brick', tower.center, profile, shaftSegments, color.brickPale);
  if (!lod.bands) return;
  for (const fraction of lod.bands === 1 ? [0.2, 0.84] : [0.21, 0.48, 0.72, 0.85]) {
    const base = y + h * fraction,
      w = radius * (1.075 - fraction * 0.41);
    radial(
      out,
      'tile',
      tower.center,
      [
        [base, w],
        [base + Math.max(0.32, h * 0.017), w],
      ],
      shaftSegments,
      color.turquoise,
    );
  }
  radial(
    out,
    'mosaic',
    tower.center,
    [
      [y + h * 0.81, radius * 0.76],
      [y + h * 0.852, radius * 1.09],
      [y + h * 0.882, radius * 1.09],
      [y + h * 0.888, radius * 0.69],
    ],
    shaftSegments,
    color.cobalt,
  );
  radial(
    out,
    'tile',
    tower.center,
    [
      [y + h * 0.925, radius * 0.6],
      [y + h * 0.952, radius * 0.8],
      [y + h * 0.975, radius * 0.64],
      [y + h, radius * 0.04],
    ],
    shaftSegments,
    tower.role === 'gate' ? color.turquoise : color.cobalt,
  );
  if (lod.decoration) {
    for (let j = 0; j < 8; j++) {
      const a = (j * Math.PI) / 4;
      const px = x + Math.cos(a) * radius * 0.67,
        pz = z + Math.sin(a) * radius * 0.67;
      beam(out, 'stone', [px, y + h * 0.882, pz], [px, y + h * 0.948, pz], 0.19, 0.19, color.ivory);
    }
  }
}

function archBetween(out, frame, width, base, shoulder, crown, depth, segments, tint) {
  const half = width * 0.5,
    peak = shoulder + crown;
  const from = (x, y, z) => frame(x, base + y, z);
  // The voussoirs span from the spring to the pointed apex.
  const steps = Array.from({ length: segments + 1 }, (_, i) => {
    const u = i / segments,
      x = (u * 2 - 1) * half;
    const y =
      shoulder + crown * (1 - Math.abs(2 * u - 1) * 0.69 - Math.pow(Math.abs(2 * u - 1), 2) * 0.31);
    return [x, y, 1.05 * y + 0.32];
  });
  for (let i = 1; i < steps.length; i++) {
    const [a, ay, ao] = steps[i - 1],
      [b, by, bo] = steps[i];
    for (const z of [0, depth]) {
      const p = [from(a, ay, z), from(b, by, z), from(b, bo, z), from(a, ao, z)];
      panel(out, 'tile', z === 0 ? p.toReversed() : p, tint);
    }
    panel(
      out,
      'brick',
      [from(b, by, 0), from(a, ay, 0), from(a, ay, depth), from(b, by, depth)],
      color.brickPale,
    );
  }
  return peak;
}

function portal(out, center, width, depth, base, height, lod, gate = false) {
  const [x, z] = center;
  const half = width * 0.5,
    passage = width * 0.63,
    shoulder = height * 0.55,
    crown = height * 0.34;
  const align = (u, y, l) => [x + u, y, z + l];
  const pierWidth = (width - passage) / 2;
  for (const side of [-1, 1]) {
    const cx = x + side * (half - pierWidth / 2);
    const p = rect(cx, z + depth / 2, pierWidth, depth);
    extrude(out, 'brick', p, base - 1.25, base + height, color.brickPale);
    box(
      out,
      'mosaic',
      [cx - pierWidth * 0.43, base + 0.43, z - 0.24],
      [cx + pierWidth * 0.43, base + height - 0.65, z + 0.035],
      color.cobalt,
    );
  }
  const segments = lod.passage < 2 ? 6 : 10;
  const top = archBetween(
    out,
    align,
    passage,
    base,
    shoulder,
    crown,
    depth,
    segments,
    color.turquoise,
  );
  const upper = base + height;
  box(
    out,
    'tile',
    [x - half - 0.32, upper - 0.43, z - 0.3],
    [x + half + 0.32, upper + 0.19, z + depth + 0.22],
    color.cobalt,
  );
  const shape = Array.from({ length: segments + 1 }, (_, i) => {
    const u = i / segments,
      x = ((u * 2 - 1) * passage) / 2;
    return [
      x,
      1.05 *
        (shoulder +
          crown * (1 - Math.abs(2 * u - 1) * 0.69 - Math.pow(Math.abs(2 * u - 1), 2) * 0.31)) +
        0.32,
    ];
  });
  for (let i = 1; i < shape.length; i++) {
    const [a, ay] = shape[i - 1],
      [b, by] = shape[i];
    panel(
      out,
      'mosaic',
      [
        [x + b, base + by, z - 0.025],
        [x + a, base + ay, z - 0.025],
        [x + a, upper - 0.38, z - 0.025],
        [x + b, upper - 0.38, z - 0.025],
      ],
      color.cobalt,
    );
  }
  if (!gate) {
    const inner = z + depth - 1.52;
    const left = x - passage / 2,
      right = x + passage / 2;
    panel(
      out,
      'mosaic',
      [
        [right, base, inner],
        [left, base, inner],
        [left, base + shoulder, inner],
        [x, base + top, inner],
        [right, base + shoulder, inner],
      ],
      color.cobalt,
    );
    const doorWidth = 2.8,
      y0 = base + 0.16;
    for (const dx of [-3.38, 0, 3.38]) {
      const at = x + dx;
      panel(
        out,
        'opening',
        [
          [at + doorWidth / 2, y0, inner - 0.04],
          [at - doorWidth / 2, y0, inner - 0.04],
          [at - doorWidth / 2, y0 + 3.3, inner - 0.04],
          [at, y0 + 4.35, inner - 0.04],
          [at + doorWidth / 2, y0 + 3.3, inner - 0.04],
        ],
        color.ink,
      );
    }
  }
  if (lod.decoration) {
    for (const side of [-1, 1]) {
      const px = x + side * (half - pierWidth * 0.5),
        scale = pierWidth * 0.25;
      for (let k = 1; k < 6; k++) {
        const y = base + 0.19 * height + 0.12 * height * k;
        panel(
          out,
          'mosaic',
          [
            [px + scale, y, z - 0.27],
            [px, y - scale, z - 0.27],
            [px - scale, y, z - 0.27],
            [px, y + scale, z - 0.27],
          ],
          k % 2 === 0 ? color.gold : color.turquoise,
        );
      }
    }
  }
}

function arcades(out, lod) {
  for (const segment of d.courtyardArcades) {
    const a = segment.from,
      b = segment.to;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const u = (b[0] - a[0]) / length,
      v = (b[1] - a[1]) / length;
    const count = Math.round(length / lod.arcadeWidth);
    const span = length / count;
    const y = Math.max(...[a, b, centroid([a, b])].map(grade)) + 6.4;
    const place = (s, y, d) => [a[0] + u * s + v * d, y, a[1] + v * s - u * d];
    beam(out, 'roof', place(0, y, 0), place(length, y, 0), 6.5, 0.89, color.roof);
    if (lod.passage > 0)
      beam(
        out,
        'tile',
        place(0, y + 0.24, 3.05),
        place(length, y + 0.24, 3.05),
        0.35,
        0.52,
        color.turquoise,
      );
    for (let i = 0; i <= count; i++) {
      const at = i * span,
        p = place(at, 0, 3.05);
      const g = grade([p[0], p[2]]);
      const width = lod.passage === 0 ? 1.3 : 0.74;
      if (lod.passage <= 1) {
        panel(
          out,
          'stone',
          [
            place(at - width / 2, g - 0.56, 3.05),
            place(at + width / 2, g - 0.56, 3.05),
            place(at + width / 2, y - 0.24, 3.05),
            place(at - width / 2, y - 0.24, 3.05),
          ],
          color.ivory,
        );
      } else {
        beam(
          out,
          'stone',
          place(at, g - 0.56, 3.05),
          place(at, y - 0.24, 3.05),
          width,
          width,
          color.ivory,
        );
      }
      if (i === count || lod.passage <= 1) continue;
      const middle = at + span / 2;
      const local = (x, yy, z) => place(middle + x, yy, 3.05 - z);
      archBetween(
        out,
        local,
        span - 0.68,
        y - 5.61,
        3.5,
        1.65,
        0.42,
        lod.passage >= 2 ? 4 : 2,
        color.cobalt,
      );
    }
  }
}

function court(out, lod) {
  const polygon = cleanRing(d.courtyard);
  const division = lod.passage >= 2 ? 3 : lod.passage;
  const paving = (a, b, c, level) => {
    if (level === 0) {
      const points = [a, b, c].map((p) => [p[0], grade(p) + 0.59, p[1]]);
      panel(out, 'stone', normalFor(...points)[1] > 0 ? points : points.toReversed(), color.marble);
      return;
    }
    const ab = centroid([a, b]),
      bc = centroid([b, c]),
      ca = centroid([c, a]);
    paving(a, ab, ca, level - 1);
    paving(ab, b, bc, level - 1);
    paving(ca, bc, c, level - 1);
    paving(ab, bc, ca, level - 1);
  };
  const indices = earcut(polygon.flat(), null, 2);
  for (let i = 0; i < indices.length; i += 3) {
    paving(polygon[indices[i]], polygon[indices[i + 1]], polygon[indices[i + 2]], division);
  }
  if (!lod.passage) return;
  const lengths = [
    [-0.04, -30],
    [-0.04, -207],
  ];
  const walkWidth = 6.4;
  for (const off of [-walkWidth, walkWidth]) {
    const a = [off, lengths[0][1]],
      b = [off, lengths[1][1]];
    beam(
      out,
      'stone',
      [a[0], grade(a) + 0.25, a[1]],
      [b[0], grade(b) + 0.25, b[1]],
      0.48,
      0.19,
      color.brickPale,
    );
  }
}

function build(out, level) {
  const lod = levels[level];
  d.halls.forEach((row) => hall(out, row, lod));
  d.domes.forEach((row) => dome(out, row, lod));
  d.towerSites.forEach((row) => minaret(out, row, lod));
  portal(out, [0, -23.9], 22, 9.4, 0.35, 27.5, lod);
  portal(out, [d.gateway[0], d.gateway[1] - 3], 22, 6.6, d.gateGrade, 16.6, lod, true);
  arcades(out, lod);
  court(out, lod);
}
export const skyline = (o) => build(o, 0);
export const district = (o) => build(o, 1);
export const street = (o) => build(o, 2);
export const closeup = (o) => build(o, 3);

const recipe = 'jamkaran-mosque-model.mjs';
const camera = [373, 301, -526],
  lookAt = [8, 16, -200];
const field = { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' };
export const jamkaranModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  sourceDocuments: plan.requiredSourceDocuments,
  surfaces,
  wikidataId: 'Q1681449',
  category: 'landmark',
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-exterior',
  groundContactBasis:
    'Independent ground contact in the open forecourt and component grades estimated across the terrain field.',
  brief:
    'Maqam iwan, five domes, arcaded courtyard, two pairs of tall minarets, adjoining prayer halls and the principal outer gateway.',
  camera,
  lookAt,
  sunDirection: [-54, 70, -51],
  embeddedCanonicalGraphs: Object.values(surfaces)
    .map((s) => s.graph)
    .filter(Boolean),
  buildingCutout: {
    outline: d.courtyard,
    outlines: d.halls.map((h) => h.outline),
    minimumCoverage: 0.87,
    basis: 'Separate exact prayer hall outlines suppress overlapping generic building geometry.',
  },
  mediumFiContext: { scale: 1, groundY: -0.15, terrain: field },
  qaCameras: [
    { name: 'maqam-iwan-and-turquoise-dome', position: [39, 37, -126], lookAt: [0, 29, -2] },
    {
      name: 'five-domes-and-connected-prayer-halls',
      position: [105, 94, -105],
      lookAt: [1, 20, -9],
    },
    { name: 'arcaded-court-and-halls', position: [130, 48, -178], lookAt: [-8, 14, -91] },
    { name: 'entrance-and-octagonal-minarets', position: [66, 106, -591], lookAt: [8, 45, -474] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'jamkaran-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 3.65,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 1.54, surfaces },
      street: { export: 'street', errorMeters: 0.58, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.21, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Reconstructed from mapped factual footprints and written architecture sources. OpenStreetMap controls are ODbL 1.0.',
};
