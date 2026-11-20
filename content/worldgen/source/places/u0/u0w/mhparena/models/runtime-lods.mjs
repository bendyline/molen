import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { transformed } from '../../../../../../../../packages/worldgen/scripts/lighthouse-models.mjs';
import { mhpSections } from '../../../../../../../../packages/worldgen/scripts/mhp-arena-model.mjs';
import { lettering } from '../../../../../../../../packages/worldgen/scripts/stadium-lettering.mjs';
import {
  face,
  soccerPitch,
} from '../../../../../../../../packages/worldgen/scripts/stadium-models.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const { ground, inner, oldY, outer, rimY, roofPoint, seat, seatColor, upperY } = mhpSections;
const white = [0.89, 0.9, 0.89];
const concrete = [0.61, 0.63, 0.62];
const glass = [0.13, 0.23, 0.29];
const dark = [0.038, 0.05, 0.054];
const red = [0.47, 0.024, 0.042];
const up = [0, 1, 0];
const down = [0, -1, 0];
const turn = Math.PI * 2;
const radial = (a, r, y) => [r * Math.sin(a), y, r * Math.cos(a)];
const withY = ([x, , z], y) => [x, y, z];

export const surfaces = {
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.65, metallic: 0 },
  membrane: { slot: 'roof', graph: 'membrane', roughness: 0.86, metallic: 0 },
  glass: {
    slot: 'window',
    localRef: 'palette:#ffffff',
    name: 'arena-glazing',
    roughness: 0.34,
    metallic: 0.06,
  },
  plastic: {
    slot: 'trim',
    localRef: 'palette:#ffffff',
    name: 'red-seats-and-painted-lines',
    roughness: 0.74,
    metallic: 0,
  },
  turf: {
    slot: 'foundation',
    localRef: 'palette:#ffffff',
    name: 'playing-field',
    roughness: 1,
    metallic: 0,
  },
};

function canopy(out, detail) {
  const count = 40 / detail.bayStride;
  const radialT = detail.radial;
  for (let i = 0; i < count; i++) {
    const bay = i * detail.bayStride;
    const point = (u, t) => {
      const bayAlong = u * detail.bayStride;
      const offset = Math.floor(bayAlong);
      return roofPoint(bay + offset, bayAlong - offset, t);
    };
    for (let j = 0; j < detail.curve; j++) {
      const u = j / detail.curve;
      const v = (j + 1) / detail.curve;
      for (let k = 1; k < radialT.length; k++) {
        const t0 = radialT[k - 1],
          t1 = radialT[k];
        const panels = [point(u, t0), point(v, t0), point(v, t1), point(u, t1)];
        const tint = k === 1 ? [0.84, 0.87, 0.86] : white;
        face(out, 'membrane', panels, tint, up);
        face(
          out,
          'membrane',
          panels.map(([x, y, z]) => [x, y - 0.055, z]),
          tint,
          down,
        );
      }
    }
    const a = (turn * i) / count,
      b = (turn * (i + 1)) / count;
    const high = radial(a, outer(a), upperY(a));
    const next = radial(b, outer(b), upperY(b));
    const low = radial(a, outer(a), rimY(a) - 0.4);
    beam(out, 'metal', radial(a, outer(a) - 5, 0), high, 0.65, 0.9, white);
    beam(out, 'metal', high, next, 0.6, 1.05, white);
    if (detail.cables) {
      const older = point(0, 0.22);
      const mast = [older[0], older[1] + 4.7, older[2]];
      beam(out, 'metal', low, radial(b, outer(b), rimY(b) - 0.4), 0.68, 0.64, white);
      beam(out, 'metal', older, mast, 0.17, 0.17, concrete);
      for (const end of [point(0, 0), point(0, 0.65), high]) {
        beam(out, 'metal', mast, end, 0.08, 0.08, concrete);
      }
      const ring = (x) => radial(x, inner(x) + 13.5, oldY(x) - 1.35);
      beam(out, 'metal', ring(a), ring(b), 0.3, 0.22, concrete);
    }
  }
}

function bowl(out, detail) {
  const n = detail.facets;
  const rows = detail.rows;
  for (let i = 0; i < n; i++) {
    const a = (turn * i) / n,
      b = (turn * (i + 1)) / n;
    const middle = (a + b) / 2;
    const outward = radial(middle, 1, 0);
    const inward = radial(middle, -1, 0);
    for (const tier of [0, 1]) {
      for (let j = 1; j <= rows; j++) {
        const y0 = (29 * (j - 1)) / rows,
          y1 = (29 * j) / rows;
        const p = seat(a, tier, y0),
          q = seat(b, tier, y0);
        const r = seat(b, tier, y1),
          s = seat(a, tier, y1);
        const aisle = detail.cables && i % Math.max(3, Math.round(n / 30)) === 0;
        const standing = tier === 0 && p[2] > 70 && Math.abs(p[0]) < 43;
        const color =
          aisle || standing
            ? concrete
            : seatColor(seat(middle, tier, (y0 + y1) / 2), tier, (y0 + y1) / 2);
        const material = aisle || standing ? 'concrete' : 'plastic';
        if (detail.cables) {
          const outerRight = withY(r, q[1]);
          const outerLeft = withY(s, p[1]);
          face(out, material, [p, q, outerRight, outerLeft], color, up);
          face(
            out,
            'concrete',
            [outerLeft, outerRight, r, s],
            color.map((c) => c * 0.76),
            inward,
          );
        } else {
          face(out, material, [p, q, r, s], color, up);
        }
      }
    }
    const lower = seat(a, 1, 0),
      nextLower = seat(b, 1, 0);
    face(
      out,
      'glass',
      [withY(lower, lower[1] - 2.25), withY(nextLower, nextLower[1] - 2.25), nextLower, lower],
      glass,
      inward,
    );
    const outerBack = seat(a, 1, 29),
      nextBack = seat(b, 1, 29);
    face(
      out,
      'concrete',
      [withY(outerBack, -0.45), withY(nextBack, -0.45), nextBack, outerBack],
      concrete,
      outward,
    );
    const ga = ground(a),
      gb = ground(b);
    face(
      out,
      'concrete',
      [radial(a, ga, 0), radial(b, gb, 0), radial(b, gb - 14, 0), radial(a, ga - 14, 0)],
      concrete,
      up,
    );
  }
}

function frontage(out, detail) {
  for (let i = 0; i < detail.facets; i++) {
    const a = (turn * i) / detail.facets,
      b = (turn * (i + 1)) / detail.facets;
    const R = ground(a) - 8,
      S = ground(b) - 8,
      facing = radial((a + b) / 2, 1, 0);
    for (let k = 1; k <= detail.storeys; k++) {
      const span = 1 / detail.storeys;
      const tall = 20 + 4 * Math.max(0, Math.sin((a + b) / 2));
      const lo = (k - 1) * span * tall,
        hi = k * span * tall;
      face(
        out,
        'glass',
        [
          radial(a, R - 1, lo),
          radial(b, S - 1, lo),
          radial(b, S - 1, hi - 0.4),
          radial(a, R - 1, hi - 0.4),
        ],
        glass,
        facing,
      );
      face(
        out,
        'concrete',
        [radial(a, R, hi - 0.43), radial(b, S, hi - 0.43), radial(b, S, hi), radial(a, R, hi)],
        concrete,
        facing,
      );
      if (detail.cables)
        face(
          out,
          'concrete',
          [radial(a, R - 6, hi), radial(b, S - 6, hi), radial(b, S, hi), radial(a, R, hi)],
          concrete,
          up,
        );
    }
  }
  const end = transformed(out, Math.PI, [0, 0, -136]);
  box(end, 'concrete', [-46, 0, -22], [46, 8.2, 10.4], concrete);
  box(end, 'glass', [-43, 0.7, 10.42], [43, 6.8, 10.45], glass);
  if (!detail.cables) return;
  for (const side of [-1, 1]) {
    const a = (side * Math.PI) / 2;
    const frame = transformed(out, a, radial(a, outer(a), 0));
    lettering(frame, 'MHP ARENA', {
      width: 42,
      height: 3.3,
      y: rimY(a) + 1,
      z: 0.2,
      slot: 'metal',
      color: dark,
      stroke: 0.4,
    });
    for (const z of [-71, -39, 39, 71]) {
      const theta = Math.atan2(side * 104, z),
        length = ground(theta) - 5;
      const x = radial(theta, length, 0)[0];
      const tower = transformed(out, a, [x, 0, z]);
      box(tower, 'concrete', [-3.2, 0, -5], [3.2, 24, 0.1], concrete);
      box(tower, 'glass', [-2.85, 0.5, 0.11], [2.85, 22.8, 0.14], glass);
      if (!detail.fullField) continue;
      for (let y = 2; y < 21; y += 2.1)
        beam(tower, 'metal', [-2.85, y, 0.19], [2.85, y, 0.19], 0.13, 0.16, white);
    }
  }
  for (const y of [12.4, 15.9]) {
    box(out, 'concrete', [71, y - 0.3, -64], [82, y, 64], concrete);
    box(out, 'glass', [81.7, y, -64], [81.84, y + 3.1, 64], glass);
    beam(out, 'plastic', [71.06, y + 0.15, -64], [71.06, y + 0.15, 64], 0.12, 0.31, red);
  }
  for (const side of [-1, 1]) {
    const z = side * 112;
    box(out, 'metal', [-6.2, 27, z - 0.34], [6.2, 32.4, z + 0.34], white);
    box(out, 'glass', [-6, 27.15, z - 0.36], [6, 32.23, z + 0.36], dark);
  }
}

function pitch(out, detail) {
  box(out, 'concrete', [-43, -1.46, -63], [43, -1.31, 63], concrete);
  if (detail.fullField) {
    soccerPitch(transformed(out, 0, [0, -1.3, 0]));
    return;
  }
  box(out, 'turf', [-42, -1.34, -61], [42, -1.285, 61], [0.14, 0.29, 0.097]);
  for (let i = 0; i < 8; i++) {
    const a = -52.5 + (i * 105) / 8,
      b = a + 105 / 8,
      y = -1.283;
    face(
      out,
      'turf',
      [
        [-34, y, a],
        [34, y, a],
        [34, y, b],
        [-34, y, b],
      ],
      i % 2 ? [0.18, 0.35, 0.105] : [0.23, 0.39, 0.114],
      up,
    );
  }
  for (const z of [-52.5, 0, 52.5]) {
    face(
      out,
      'plastic',
      [
        [-34, -1.272, z - 0.12],
        [34, -1.272, z - 0.12],
        [34, -1.272, z + 0.12],
        [-34, -1.272, z + 0.12],
      ],
      white,
      up,
    );
  }
  for (const x of [-34, 34]) {
    face(
      out,
      'plastic',
      [
        [x - 0.12, -1.272, -52.5],
        [x + 0.12, -1.272, -52.5],
        [x + 0.12, -1.272, 52.5],
        [x - 0.12, -1.272, 52.5],
      ],
      white,
      up,
    );
  }
}

function build(out, detail) {
  canopy(out, detail);
  bowl(out, detail);
  frontage(out, detail);
  pitch(out, detail);
}

export const buildSkyline = (out) =>
  build(out, { facets: 20, bayStride: 2, curve: 1, radial: [0, 0.22, 1], rows: 1, storeys: 1 });
export const buildDistrict = (out) =>
  build(out, {
    facets: 40,
    bayStride: 1,
    curve: 2,
    radial: [0, 0.22, 0.6, 1],
    rows: 3,
    storeys: 3,
  });
export const buildStreet = (out) =>
  build(out, {
    facets: 80,
    bayStride: 1,
    curve: 3,
    radial: [0, 0.22, 0.48, 0.75, 1],
    rows: 9,
    storeys: 5,
    cables: true,
  });
export const buildCloseup = (out) =>
  build(out, {
    facets: 160,
    bayStride: 1,
    curve: 6,
    radial: [0, 0.11, 0.22, 0.4, 0.6, 0.8, 1],
    rows: 29,
    storeys: 5,
    cables: true,
    fullField: true,
  });
