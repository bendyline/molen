/** Geometry for the three independently placed Chongar crossing assets. */
import { beam, beamPath } from './authored-structure-mesh.mjs';
import { face, tri } from './signature-tower-expansion-models.mjs';
import { box } from './structure-mesh.mjs';

export const chongarKinds = {
  chongar_e105_road_bridge: 'road',
  chongar_old_road_bridge: 'old',
  chongar_railway_bridge: 'rail',
};

export const surfaces = {
  concrete: { slot: 'foundation', graph: 'concrete_boardformed' },
  paving: { slot: 'wall', graph: 'concrete_plain' },
  steel: { slot: 'trim', graph: 'metal_painted' },
  stone: { slot: 'foundation', graph: 'gravel' },
  timber: { slot: 'trim', graph: 'wood_plain' },
  paint: { slot: 'trim', localRef: 'palette:#ffffff', name: 'Road markings and heads' },
};

const oldConcrete = [0.58, 0.52, 0.43];
const concrete = [0.69, 0.67, 0.6];
const darkConcrete = [0.5, 0.5, 0.44];
const asphalt = [0.265, 0.272, 0.266];
const gravel = [0.41, 0.4, 0.35];
const wood = [0.4, 0.34, 0.26];
const coated = [0.48, 0.54, 0.5];
const darkSteel = [0.3, 0.34, 0.34];
const rusty = [0.53, 0.39, 0.27];
const white = [0.83, 0.83, 0.74];

function interpolate(stations, x) {
  const after = stations.findIndex((row) => row[0] >= x);
  if (after === 0) return stations[0].slice(1);
  if (after < 0) return stations.at(-1).slice(1);
  const [a, b] = [stations[after - 1], stations[after]];
  const t = (x - a[0]) / (b[0] - a[0]);
  return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function path(stations, first, last) {
  return [
    [first, ...interpolate(stations, first)],
    ...stations.filter((row) => row[0] > first && row[0] < last),
    [last, ...interpolate(stations, last)],
  ];
}

const rectangular = (lowY, highY, left, right) => [
  [highY, left],
  [highY, right],
  [lowY, right],
  [lowY, left],
];

function solid(out, slot, stations, crossSection, color) {
  const n = crossSection.length;
  const rows = stations.map(([x, y, z]) => crossSection.map(([dy, dz]) => [x, y + dy, z + dz]));
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1],
      b = rows[i];
    for (let v = 0; v < n; v++) {
      const w = (v + 1) % n;
      face(out, slot, [a[v], a[w], b[w], b[v]], color);
    }
  }
  const start = rows[0],
    end = rows.at(-1);
  for (let v = 1; v < n - 1; v++) {
    tri(out, slot, [start[0], start[v + 1], start[v]], color);
    tri(out, slot, [end[0], end[v], end[v + 1]], color);
  }
}

function band(out, slot, stations, left, right, y, color) {
  for (let i = 1; i < stations.length; i++) {
    const [x0, y0, z0] = stations[i - 1],
      [x1, y1, z1] = stations[i];
    face(
      out,
      slot,
      [
        [x0, y0 + y, z0 + left],
        [x0, y0 + y, z0 + right],
        [x1, y1 + y, z1 + right],
        [x1, y1 + y, z1 + left],
      ],
      color,
    );
  }
}

function castSupports(out, frame, detail) {
  const {
    mode,
    design: { stations, width, piers },
  } = frame;
  const [, westY, westZ] = stations[0],
    [, eastY, eastZ] = stations.at(-1);
  const left = stations[0][0],
    right = stations.at(-1)[0];
  const color = mode === 'old' ? oldConcrete : concrete;
  for (const [x, y, z, side] of [
    [left, westY, westZ, 1],
    [right, eastY, eastZ, -1],
  ]) {
    const [a, b] = [x + 0.04 * side, x + 3.6 * side].sort((u, v) => u - v);
    box(out, 'concrete', [a, -1.35, z - width * 0.5], [b, y - 0.41, z + width * 0.5], color);
    if (detail >= 2) {
      for (const zSign of [-1, 1]) {
        const flange = z + zSign * (width * 0.51 + 0.32);
        box(out, 'concrete', [a, -1.08, flange - 0.36], [b, y - 0.23, flange + 0.36], darkConcrete);
      }
    }
  }
  for (const x of piers) {
    const [y, z] = interpolate(stations, x);
    const wall = mode === 'old' || mode === 'rail';
    const pileWidth = wall ? width * 0.76 : width * 0.67;
    const top = y - (detail === 0 ? 0.53 : 1.06);
    if (wall || detail === 0) {
      box(
        out,
        'concrete',
        [x - 0.67, -1.55, z - pileWidth * 0.5],
        [x + 0.67, top, z + pileWidth * 0.5],
        color,
      );
    } else {
      for (const offset of [-width * 0.28, width * 0.28])
        box(
          out,
          'concrete',
          [x - 0.54, -1.52, z + offset - 0.53],
          [x + 0.54, top, z + offset + 0.53],
          color,
        );
    }
    if (detail >= 1) {
      box(
        out,
        'concrete',
        [x - 1.02, top - 0.27, z - width * 0.43],
        [x + 1.02, top + 0.29, z + width * 0.43],
        color,
      );
      if (detail >= 3) {
        for (const offset of [-width * 0.29, 0, width * 0.29])
          box(
            out,
            'steel',
            [x - 0.37, top + 0.28, z + offset - 0.21],
            [x + 0.37, top + 0.44, z + offset + 0.21],
            darkSteel,
          );
      }
    }
  }
}

function barriers(out, stations, width, type, detail) {
  const kind = type;
  const ends = [stations[0][0], stations.at(-1)[0]];
  const high = kind === 'road' ? 1.08 : kind === 'rail' ? 0.98 : 0.79;
  const color = kind === 'old' ? rusty : coated;
  const zEdge = width * 0.5 - 0.24;
  for (const sign of [-1, 1]) {
    const z = sign * zEdge;
    if (detail === 0) {
      solid(out, 'steel', stations, rectangular(high - 0.085, high, z - 0.055, z + 0.055), color);
      continue;
    }
    const increments = detail === 1 ? 7.8 : kind === 'rail' ? 2.45 : 2.6;
    const length = ends[1] - ends[0],
      count = Math.ceil(length / increments);
    for (let i = 0; i <= count; i++) {
      const x = ends[0] + 0.24 + ((length - 0.48) * i) / count;
      const [y, centerZ] = interpolate(stations, x);
      if (kind === 'old' && ((i > 4 && i < 7) || (i > count * 0.67 && i < count * 0.72))) continue;
      const w = kind === 'rail' ? 0.076 : 0.095,
        c = kind === 'road' && detail >= 2 && i % 4 === 0 ? white : color;
      box(out, 'steel', [x - w, y - 0.025, centerZ + z - w], [x + w, y + high, centerZ + z + w], c);
      if (detail >= 3 && kind === 'road')
        box(
          out,
          'concrete',
          [x - 0.15, y, centerZ + z - 0.145],
          [x + 0.15, y + 0.084, centerZ + z + 0.145],
          concrete,
        );
      if (detail >= 4 && kind !== 'rail') {
        for (const dx of [-0.049, 0.049]) {
          const f = centerZ + z - sign * 0.113;
          box(
            out,
            'steel',
            [x + dx - 0.018, y + high - 0.069, f - 0.012],
            [x + dx + 0.018, y + high - 0.034, f + 0.012],
            darkSteel,
          );
        }
      }
    }
    const rows =
      kind === 'old'
        ? [
            path(stations, ends[0], ends[0] + length * 0.24),
            path(stations, ends[0] + length * 0.34, ends[0] + length * 0.7),
            path(stations, ends[0] + length * 0.74, ends[1]),
          ]
        : [stations];
    for (const part of rows) {
      solid(out, 'steel', part, rectangular(high - 0.109, high, z - 0.069, z + 0.069), color);
      if (detail >= 2)
        solid(
          out,
          'steel',
          part,
          rectangular(high * 0.55, high * 0.55 + 0.045, z - 0.036, z + 0.036),
          color,
        );
    }
  }
}

function roadDeck(out, frame, detail) {
  const {
    mode,
    design: { stations, width, piers },
  } = frame;
  const historic = mode === 'old',
    half = width * 0.5,
    skin = historic ? oldConcrete : concrete;
  const ends = [stations[0][0], stations.at(-1)[0]];
  solid(out, 'concrete', stations, rectangular(-0.54, -0.025, -half, half), skin);
  const gutter = historic ? 0.5 : 1.14;
  band(
    out,
    'paving',
    stations,
    -half + gutter,
    half - gutter,
    0,
    historic ? [0.43, 0.41, 0.34] : asphalt,
  );
  for (const sign of [-1, 1]) {
    const end = sign * half;
    const [a, b] = [end, end - sign * gutter].sort((p, q) => p - q);
    solid(out, 'concrete', stations, rectangular(-0.024, 0.14, a, b), skin);
    if (detail >= 1) {
      const z = sign * (half - 0.86);
      solid(
        out,
        'concrete',
        stations,
        [
          [-0.42, z - 0.42],
          [-0.42, z + 0.42],
          [-1.16, z + 0.23],
          [-1.16, z - 0.23],
        ],
        skin,
      );
    }
    if (historic && detail >= 2) {
      const spacing = detail >= 3 ? 3.1 : 4.9;
      for (let x = ends[0] + 3.15; x < ends[1] - 3; x += spacing) {
        const [y, z] = interpolate(stations, x);
        const inner = z + sign * (half - 0.96);
        const outer = z + sign * (half - 0.11);
        const a = [x - 0.145, y - 0.49, outer],
          b = [x + 0.145, y - 0.49, outer],
          c = [x - 0.145, y - 1.18, inner],
          d = [x + 0.145, y - 1.18, inner];
        face(out, 'concrete', sign > 0 ? [a, c, d, b] : [b, d, c, a], darkConcrete);
        if (detail >= 3) {
          const back = y - 0.49;
          tri(out, 'concrete', [a, [a[0], back, inner], c], skin);
          tri(out, 'concrete', [b, d, [b[0], back, inner]], skin);
        }
      }
    }
  }
  if (detail >= 2) {
    for (const [i, a] of piers.entries()) {
      const b = piers[i + 1];
      if (!b) break;
      for (let j = 1; j <= 2; j++) {
        const x = a + ((b - a) * j) / 3,
          [y, z] = interpolate(stations, x);
        box(
          out,
          'concrete',
          [x - 0.2, y - 0.94, z - half + 0.05],
          [x + 0.2, y - 0.38, z + half - 0.05],
          historic ? oldConcrete : darkConcrete,
        );
      }
    }
  }
  if (!historic) {
    const [first, last] = ends;
    const [, westY, westZ] = stations[0];
    solid(
      out,
      'paving',
      [
        [first - 0.47, westY - 0.015, westZ - 0.031],
        [first, westY - 0.004, westZ],
      ],
      rectangular(-0.058, 0, -half + gutter, half - gutter),
      asphalt,
    );
    for (let x = first + 1.05; x + 1.95 < last; x += 5.85)
      band(out, 'paint', path(stations, x, x + 1.95), -0.062, 0.062, 0.018, white);
    if (detail >= 2)
      for (const sign of [-1, 1]) {
        const z = sign * (half - gutter - 0.23);
        band(out, 'paint', stations, z - 0.051, z + 0.051, 0.015, white);
      }
    if (detail >= 3)
      for (const x of piers)
        band(
          out,
          'paving',
          path(stations, x - 0.057, x + 0.057),
          -half + gutter,
          half - gutter,
          0.019,
          darkSteel,
        );
  }
  barriers(out, stations, width, mode, detail);
}

function masts(out, stations, width, detail) {
  const first = stations[0][0],
    last = stations.at(-1)[0],
    high = 5.56;
  const left = width * 0.5 - 0.43;
  const supports = [];
  for (let x = first + 0.7, i = 0; x < last - 0.5; x += 31.8, i++) {
    const sign = i % 2 === 0 ? -1 : 1,
      [y, z] = interpolate(stations, x);
    const base = [x, y + 0.14, z + left * sign],
      top = [x, y + high + 0.63, z + left * sign];
    const arm = [x, y + high + 0.63, z - sign * 2.72];
    if (detail <= 1) beam(out, 'steel', base, top, 0.23, 0.2, darkSteel);
    else {
      const towerSide = 0.24;
      for (const dx of [-towerSide, towerSide]) {
        beam(
          out,
          'steel',
          [x + dx, base[1], base[2]],
          [x + dx, top[1], top[2]],
          0.076,
          0.08,
          darkSteel,
        );
      }
      const count = detail >= 3 ? 10 : 4;
      for (let j = 0; j < count; j++) {
        const low = base[1] + ((top[1] - base[1]) * j) / count,
          up = base[1] + ((top[1] - base[1]) * (j + 1)) / count;
        beam(
          out,
          'steel',
          [x - towerSide, low, base[2]],
          [x + towerSide, up, base[2]],
          0.047,
          0.043,
          darkSteel,
        );
        if (detail >= 3)
          beam(
            out,
            'steel',
            [x + towerSide, low, base[2]],
            [x - towerSide, up, base[2]],
            0.044,
            0.04,
            coated,
          );
      }
      box(
        out,
        'concrete',
        [x - 0.29, y - 0.035, base[2] - 0.29],
        [x + 0.29, y + 0.25, base[2] + 0.29],
        concrete,
      );
    }
    beam(out, 'steel', top, arm, 0.084, 0.084, darkSteel);
    beam(
      out,
      'steel',
      [x, y + high - 1.47, base[2]],
      [x, arm[1], z - sign * 1.45],
      0.061,
      0.063,
      coated,
    );
    supports.push([x, y, z]);
  }
  if (detail >= 1) {
    for (let i = 1; i < supports.length; i++) {
      const [a, b] = [supports[i - 1], supports[i]];
      for (const z of [-2.21, 2.21]) {
        const scales = detail >= 2 ? [0, 0.2, 0.42, 0.58, 0.8, 1] : [0, 0.5, 1];
        const wire = scales.map((t) => [
          a[0] + (b[0] - a[0]) * t,
          a[1] + (b[1] - a[1]) * t + high - 0.24 * Math.sin(Math.PI * t),
          a[2] + (b[2] - a[2]) * t + z,
        ]);
        beamPath(out, 'steel', wire, detail >= 2 ? 0.035 : 0.048, 0.038, darkSteel);
        if (detail >= 3) {
          const messenger = wire.map(([x, y, z], i) => [
            x,
            y + 0.42 - 0.12 * Math.sin(Math.PI * scales[i]),
            z,
          ]);
          beamPath(out, 'steel', messenger, 0.026, 0.03, coated);
          for (let j = 1; j < wire.length - 1; j++)
            beam(out, 'steel', wire[j], messenger[j], 0.019, 0.019, coated);
        }
      }
    }
  }
}

function railDeck(out, frame, detail) {
  const { stations, width, trackOffsets } = frame.design,
    half = width * 0.5;
  solid(out, 'concrete', stations, rectangular(-0.59, 0.02, -half, half), concrete);
  solid(
    out,
    'stone',
    stations,
    [
      [0.16, -half + 0.86],
      [0.16, half - 0.86],
      [0.01, half - 0.26],
      [0.01, -half + 0.26],
    ],
    gravel,
  );
  const [left, right] = [stations[0][0], stations.at(-1)[0]];
  for (const [west, east] of trackOffsets) {
    const trackOffset = (x) => west + ((x - left) / (right - left)) * (east - west);
    const tracks = stations.map(([x, y, z]) => [x, y, z + trackOffset(x)]);
    const gauge = 0.76;
    for (const offset of [-gauge, gauge]) {
      solid(out, 'steel', tracks, rectangular(0.17, 0.34, offset - 0.069, offset + 0.069), rusty);
      if (detail >= 2)
        band(out, 'steel', tracks, offset - 0.052, offset + 0.052, 0.343, [0.55, 0.56, 0.54]);
      if (detail >= 3)
        solid(
          out,
          'steel',
          tracks,
          rectangular(0.17, 0.23, offset - 0.124, offset + 0.124),
          darkSteel,
        );
    }
    if (detail >= 1) {
      const gap = [0, 3.9, 1.13, 0.68, 0.56][detail];
      for (let x = left + 0.37; x + 0.15 < right; x += gap) {
        const [y, z] = interpolate(tracks, x);
        box(out, 'timber', [x - 0.11, y + 0.124, z - 1.38], [x + 0.11, y + 0.202, z + 1.38], wood);
        if (detail >= 4)
          for (const off of [-gauge, gauge])
            box(
              out,
              'steel',
              [x - 0.14, y + 0.2, z + off - 0.14],
              [x + 0.14, y + 0.255, z + off + 0.14],
              darkSteel,
            );
      }
    }
  }
  for (const sign of [-1, 1]) {
    const span = [sign * (half - 0.78), sign * half].sort((a, b) => a - b);
    solid(out, 'concrete', stations, rectangular(0.018, 0.14, span[0], span[1]), darkConcrete);
  }
  barriers(out, stations, width, 'rail', detail);
  masts(out, stations, width, detail);
}

export function createChongarBridge(frame) {
  if (chongarKinds[frame.candidateId] !== frame.mode) throw Error('Incorrect Chongar bridge frame');
  const build = (out, detail) => {
    castSupports(out, frame, detail);
    if (frame.mode === 'rail') railDeck(out, frame, detail);
    else roadDeck(out, frame, detail);
  };
  return {
    buildSkyline: (out) => build(out, 0),
    buildDistrict: (out) => build(out, 1),
    buildStreet: (out) => build(out, 2),
    buildCloseup: (out) => build(out, 3),
    buildMaster: (out) => build(out, 4),
  };
}
