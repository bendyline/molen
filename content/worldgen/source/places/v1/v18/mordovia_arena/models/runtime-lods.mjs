import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { transformed } from '../../../../../../../../packages/worldgen/scripts/lighthouse-models.mjs';
import { mordoviaSections } from '../../../../../../../../packages/worldgen/scripts/mordovia-arena-model.mjs';
import { mordoviaPlan } from '../../../../../../../../packages/worldgen/scripts/mordovia-plan.mjs';
import { face } from '../../../../../../../../packages/worldgen/scripts/stadium-models.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const { angleAt, outer, roof, seat, skin, trussPoint } = mordoviaSections;
const white = [0.92, 0.91, 0.86];
const slab = [0.63, 0.63, 0.59];
const shadows = [0.16, 0.2, 0.21];
const orange = [
  [0.72, 0.095, 0.014],
  [0.83, 0.17, 0.027],
  [0.94, 0.24, 0.047],
];
const up = [0, 1, 0];
const down = [0, -1, 0];
const ribSections = [0, 0.22, 0.43, 0.5, 0.66, 0.83, 1];
const at = (angle, radius, y) => [radius * Math.sin(angle), y, radius * Math.cos(angle)];
const ray = (angle) => at(angle, 1, 0);
const underside = (s, t) => {
  const [x, y, z] = roof(s, t);
  return [x, y - 0.14, z];
};

export const surfaces = {
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.6, metallic: 0, doubleSided: true },
  membrane: { slot: 'roof', graph: 'membrane', roughness: 0.86, metallic: 0, doubleSided: true },
  perforated: { slot: 'wall', graph: 'metal_perforated_square', roughness: 0.48, metallic: 0 },
  translucent: {
    slot: 'roof',
    localRef: 'palette:#e8eae3',
    name: 'translucent-roof-rim',
    roughness: 0.6,
    metallic: 0,
    baseColorFactor: [1, 1, 1, 0.8],
    alphaMode: 'BLEND',
    doubleSided: true,
  },
  glass: {
    slot: 'window',
    localRef: 'palette:#ffffff',
    name: 'dark-gallery-glazing',
    roughness: 0.35,
    metallic: 0,
  },
  paint: {
    slot: 'trim',
    localRef: 'palette:#ffffff',
    name: 'seats-and-field-lines',
    roughness: 0.7,
    metallic: 0,
  },
  turf: {
    slot: 'foundation',
    localRef: 'palette:#ffffff',
    name: 'pitch-turf',
    roughness: 1,
    metallic: 0,
  },
};

function strip(out, slot, section, u, v, bottom, top, color, normal) {
  face(
    out,
    slot,
    [section(u, bottom), section(v, bottom), section(v, top), section(u, top)],
    color,
    normal,
  );
}

function cassetteColor(column, row, height) {
  const noise = (Math.imul(column + 23, 1597334677) ^ Math.imul(row + 167, 2654435761)) >>> 0;
  if (height < 0.76 && noise % 13 < (1 - height) * 10) return white;
  return orange[(noise >>> 11) % orange.length];
}

function envelope(out, detail) {
  for (let i = 0; i < detail.sectors; i++) {
    const u = i / detail.sectors;
    const v = (i + 1) / detail.sectors;
    const direction = ray(angleAt((u + v) / 2));
    for (let j = 0; j < detail.panels; j++) {
      const lower = j / detail.panels;
      const upper = (j + 1) / detail.panels;
      const color = cassetteColor(i, j, (lower + upper) / 2);
      const material = detail.perforated && upper <= 0.77 ? 'perforated' : 'metal';
      strip(out, material, skin, u, v, lower, upper, color, direction);
      if (material === 'perforated') {
        const backing = (s, h) => {
          const p = skin(s, h);
          const d = ray(angleAt(s));
          return [p[0] - d[0] * 0.56, p[1], p[2] - d[2] * 0.56];
        };
        strip(
          out,
          'metal',
          backing,
          u,
          v,
          lower,
          upper,
          color.map((c) => c * 0.56),
          direction,
        );
      }
    }
    strip(out, 'metal', roof, u, v, 0, 0.22, orange[(i * 7) % orange.length], up);
    strip(out, 'membrane', roof, u, v, 0.22, 0.55, white, up);
    strip(out, 'membrane', roof, u, v, 0.55, 0.83, white, up);
    strip(out, 'metal', underside, u, v, 0, 0.22, slab, down);
    strip(out, 'membrane', underside, u, v, 0.22, 0.55, slab, down);
    strip(out, 'membrane', underside, u, v, 0.55, 0.83, slab, down);
    strip(
      out,
      detail.translucent ? 'translucent' : 'membrane',
      roof,
      u,
      v,
      0.83,
      1,
      [0.84, 0.88, 0.86],
      up,
    );
    const gallery = (s, y) => {
      const angle = angleAt(s);
      return at(angle, outer(angle) - 4.7, y);
    };
    strip(out, 'glass', gallery, u, v, 0, 8, shadows, direction);
    const podium = (s, t) => {
      const angle = angleAt(s);
      return at(angle, outer(angle) - 4.7 + t * 12.7, 8.04);
    };
    strip(out, 'concrete', podium, u, v, 0, 1, slab, up);
    if (detail.frames && i % detail.frames === 0) {
      const angle = angleAt(u);
      for (let j = 1; j < ribSections.length; j++) {
        beam(
          out,
          'metal',
          trussPoint(u, ribSections[j - 1]),
          trussPoint(u, ribSections[j]),
          0.26,
          0.27,
          white,
        );
      }
      for (const y of [0, 4]) {
        beam(
          out,
          'concrete',
          at(angle, outer(angle) - 3.9, y),
          at(angle, outer(angle) - 3.9, y + 4),
          0.58,
          0.6,
          slab,
        );
      }
    }
  }
}

function stands(out, detail) {
  const bands = detail.bands;
  for (let i = 0; i < detail.sectors; i++) {
    const a = angleAt(i / detail.sectors),
      b = angleAt((i + 1) / detail.sectors);
    const inward = at(a, -1, 0);
    for (let j = 1; j < bands.length; j++) {
      const lo = bands[j - 1],
        hi = bands[j];
      const p = seat(a, lo),
        q = seat(b, lo),
        r = seat(b, hi),
        s = seat(a, hi);
      const recess = lo === 28;
      const aisle = detail.bands.length > 7 && i % 9 === 0;
      const color = recess ? shadows : aisle ? slab : cassetteColor(i, j + 3, 0.5);
      face(out, recess ? 'glass' : aisle ? 'concrete' : 'paint', [p, q, r, s], color, up);
      if (detail.translucent && !recess) {
        const line = (start, end) =>
          start.map((x, axis) => x + (end[axis] - x) * 0.13 + (axis === 1 ? 0.08 : 0));
        face(out, 'concrete', [p, q, line(q, r), line(p, s)], slab, inward);
      }
    }
  }
}

function field(out, detail) {
  // The native landcover draws slightly above the terrain. The turf deck clears it.
  const height = 0.28;
  box(out, 'turf', [-41, -0.08, -61], [41, height, 61], [0.147, 0.27, 0.079]);
  const stripes = detail.sectors > 24 ? 14 : 6;
  for (let i = 0; i < stripes; i++) {
    const a = -52.5 + (i * 105) / stripes,
      b = a + 105 / stripes;
    face(
      out,
      'turf',
      [
        [-34, height + 0.006, a],
        [34, height + 0.006, a],
        [34, height + 0.006, b],
        [-34, height + 0.006, b],
      ],
      i % 2 ? [0.18, 0.34, 0.088] : [0.22, 0.38, 0.108],
      up,
    );
  }
  function line(points) {
    for (let i = 1; i < points.length; i++) {
      const [x, z] = points[i - 1],
        [a, b] = points[i];
      const width = detail.sectors <= 24 ? 0.24 : 0.12;
      const length = Math.hypot(a - x, b - z);
      const dx = ((z - b) * width) / (2 * length),
        dz = ((a - x) * width) / (2 * length);
      const y = height + 0.011;
      face(
        out,
        'paint',
        [
          [x + dx, y, z + dz],
          [a + dx, y, b + dz],
          [a - dx, y, b - dz],
          [x - dx, y, z - dz],
        ],
        white,
        up,
      );
    }
  }
  line([
    [-34, -52.5],
    [34, -52.5],
    [34, 52.5],
    [-34, 52.5],
    [-34, -52.5],
  ]);
  line([
    [-34, 0],
    [34, 0],
  ]);
  const segments = detail.sectors > 24 ? 32 : 12;
  line(
    Array.from({ length: segments + 1 }, (_, i) => {
      const angle = (i * Math.PI * 2) / segments;
      return [9.15 * Math.cos(angle), 9.15 * Math.sin(angle)];
    }),
  );
  for (const side of [-1, 1]) {
    line([
      [-20.16, side * 52.5],
      [-20.16, side * 36],
      [20.16, side * 36],
      [20.16, side * 52.5],
    ]);
    if (detail.sectors < 48) continue;
    line([
      [-9.16, side * 52.5],
      [-9.16, side * 47],
      [9.16, side * 47],
      [9.16, side * 52.5],
    ]);
    const z = side * 52.5;
    for (const x of [-3.66, 3.66])
      beam(out, 'metal', [x, height, z], [x, height + 2.44, z], 0.12, 0.12, white);
    beam(out, 'metal', [-3.66, height + 2.44, z], [3.66, height + 2.44, z], 0.12, 0.12, white);
  }
}

function approaches(out, detail) {
  for (const { outline } of mordoviaPlan.stairs) {
    const points = [...outline];
    if (Math.hypot(...points[0]) > Math.hypot(...points.at(-1))) points.reverse();
    for (let i = 1; i < points.length; i++) {
      const [x, z] = points[i - 1],
        [a, b] = points[i];
      const length = Math.hypot(a - x, b - z);
      const platform = transformed(out, Math.atan2(a - x, b - z), [x, 0, z]);
      const start = i < 3 ? 8 : 0,
        end = i === 1 ? 8 : 0;
      if (start === end) {
        box(platform, 'concrete', [-6, start - 0.38, 0], [6, start, length], slab);
      } else if (detail.steps === 1) {
        beam(platform, 'concrete', [0, start - 0.19, 0], [0, end - 0.19, length], 12, 0.38, slab);
      } else {
        for (let j = 0; j < detail.steps; j++) {
          const y = start + ((end - start) * j) / detail.steps;
          box(
            platform,
            'concrete',
            [-6, y - 0.38, (j * length) / detail.steps],
            [6, y, ((j + 1) * length) / detail.steps],
            slab,
          );
        }
      }
      if (detail.frames && i === 1) {
        for (const offset of [-4.1, 4.1]) {
          beam(
            platform,
            'concrete',
            [offset, 0, length * 0.8],
            [offset, 7.64, length * 0.8],
            0.72,
            0.62,
            slab,
          );
        }
      }
      if (detail.steps === 1) continue;
      for (const edge of [-5.8, 5.8]) {
        beam(platform, 'metal', [edge, start + 1, 0], [edge, end + 1, length], 0.12, 0.12, white);
        for (const t of [0, 0.25, 0.5, 0.75]) {
          const y = start + (end - start) * t;
          beam(
            platform,
            'metal',
            [edge, y, length * t],
            [edge, y + 1, length * t],
            0.09,
            0.09,
            white,
          );
        }
      }
    }
  }
}

function build(out, detail) {
  envelope(out, detail);
  stands(out, detail);
  approaches(out, detail);
  field(out, detail);
}

export const buildSkyline = (out) =>
  build(out, { sectors: 24, panels: 3, steps: 1, bands: [0, 14, 28, 36, 65] });
export const buildDistrict = (out) =>
  build(out, {
    sectors: 48,
    panels: 6,
    frames: 8,
    steps: 1,
    translucent: true,
    bands: [0, 6, 13, 20, 28, 31, 41, 52, 65],
  });
export const buildStreet = (out) =>
  build(out, {
    sectors: 88,
    panels: 11,
    frames: 2,
    steps: 6,
    translucent: true,
    bands: [0, 3, 7, 11, 16, 21, 25, 28, 31, 35, 39, 43, 47, 51, 55, 59, 62, 65],
  });
export const buildCloseup = (out) =>
  build(out, {
    sectors: 176,
    panels: 24,
    frames: 2,
    steps: 44,
    translucent: true,
    perforated: true,
    bands: Array.from({ length: 34 }, (_, i) => Math.min(2 * i, 65)),
  });
