import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const controls = {
  anchor: [22.566880900480378, 44.3194556427666],
  heading: 1.16539296702902,
  datum: 35,
  coping: 10.2,
  floor: -5.8,
  reserve: { inner: [-7.22, 7.22], gates: [-79.62, 79.62] },
  main: { inner: [21.3, 55.3], gates: [-171.8, 138.2] },
  // [station, west face, east face, optional coping Y]. The tail drops below DN56B.
  divider: [
    [-235.5, 7, 10.6],
    [-187, 7.22, 21.3],
    [165, 7.22, 21.3],
    [186, 9.85, 21.3, 3.8],
    [212, 13.1, 21.3, 3.8],
    [216.3, 16, 18.9, 3.8],
  ],
  eastWall: [
    [-235.5, 58.3, 62.6],
    [-171.8, 55.3, 60.5],
    [158, 55.3, 61.2],
    [186, 54.19, 59.96, 2.2],
    [194, 54, 59.6, 2.2],
  ],
};

const palette = {
  concrete: { slot: 'wall', graph: 'concrete_boardformed', rgb: [0.43, 0.414, 0.375] },
  coping: { slot: 'trim', graph: 'concrete_plain', rgb: [0.62, 0.59, 0.515] },
  deck: { slot: 'foundation', graph: 'concrete_panel', rgb: [0.39, 0.366, 0.319] },
  gate: { slot: 'door', graph: 'metal_painted', rgb: [0.178, 0.24, 0.234] },
  steel: { slot: 'trim', graph: 'metal_painted', rgb: [0.51, 0.51, 0.448] },
  roof: { slot: 'roof', graph: 'metal_standing_seam', rgb: [0.31, 0.351, 0.338] },
  glass: { slot: 'window', graph: 'window_grid', rgb: [0.13, 0.179, 0.184] },
};
export const surfaces = Object.fromEntries(
  Object.entries(palette).map(([name, { rgb, ...surface }]) => [name, surface]),
);
const { floor, coping, divider, eastWall, reserve, main } = controls;
const tiers = ['skyline', 'district', 'street', 'closeup', 'master'];
const rod = (out, material, a, b, width, depth = width) =>
  beam(out, material, a, b, width, depth, palette[material].rgb);

function panel(out, material, points, toward, shade = 1) {
  let n = normalFor(...points);
  if (n.reduce((sum, value, axis) => sum + value * toward[axis], 0) < 0) {
    points = points.toReversed();
    n = normalFor(...points);
  }
  out.addQuad(
    material,
    'palette:#ffffff',
    points,
    n,
    undefined,
    palette[material].rgb.map((v) => v * shade),
  );
}

function box(out, material, [west, east], [low, high], [north, south]) {
  rod(
    out,
    material,
    [(west + east) / 2, low, (north + south) / 2],
    [(west + east) / 2, high, (north + south) / 2],
    south - north,
    east - west,
  );
}

// Each course covers the whole wall, with adjoining faces using the same edge coordinates.
function wall(out, sections, low, high, detail) {
  const first = sections[0],
    last = sections.at(-1);
  const course = (y, top) => (top === high ? y : low + ((y - low) * (top - low)) / (high - low));
  const bands =
    detail < 2
      ? [[low, high - 0.35, 0.87]]
      : [
          [low, 0.8, 0.6],
          [0.8, 3.3, 0.74],
          [3.3, 6.7, 0.88],
          [6.7, high - 0.35, 1],
        ];
  const rows = [...bands, [high - 0.35, high, 1]];
  for (const [offset, [y, Y, shade]] of rows.entries()) {
    const material = offset === rows.length - 1 ? 'coping' : 'concrete';
    for (const [section, direction] of [
      [first, -1],
      [last, 1],
    ]) {
      const [station, west, east, top = high] = section;
      const lower = course(y, top),
        upper = course(Y, top);
      panel(
        out,
        material,
        [
          [west, lower, station],
          [east, lower, station],
          [east, upper, station],
          [west, upper, station],
        ],
        [0, 0, direction],
        shade,
      );
    }
  }
  for (let index = 1; index < sections.length; index++) {
    const [z, west, east, top = high] = sections[index - 1],
      [Z, West, East, Top = high] = sections[index];
    panel(
      out,
      'deck',
      [
        [west, top, z],
        [east, top, z],
        [East, Top, Z],
        [West, Top, Z],
      ],
      [0, 1, 0],
    );
    panel(
      out,
      'concrete',
      [
        [west, low, z],
        [east, low, z],
        [East, low, Z],
        [West, low, Z],
      ],
      [0, -1, 0],
    );
    const count = detail < 2 ? 1 : Math.ceil((Z - z) / (detail === 2 ? 28 : 12));
    for (const [side, start, end] of [
      [-1, west, West],
      [1, east, East],
    ]) {
      const at = (t, y) => [
        start + (end - start) * t,
        course(y, top + (Top - top) * t),
        z + (Z - z) * t,
      ];
      for (let segment = 0; segment < count; segment++) {
        const a = segment / count,
          b = (segment + 1) / count;
        const wear = 0.96 + ((index * 11 + segment * 7 + side * 2) % 13) * 0.005;
        for (const [offset, [y, Y, shade]] of rows.entries()) {
          const material = offset === rows.length - 1 ? 'coping' : 'concrete';
          panel(
            out,
            material,
            [at(a, y), at(b, y), at(b, Y), at(a, Y)],
            [side, 0, 0],
            shade * wear,
          );
        }
      }
    }
  }
}

function chamber(out, detail, { inner: [west, east], gates: [upper, lower] }) {
  const center = (west + east) / 2;
  box(out, 'concrete', [west, east], [floor - 0.35, floor], [upper, lower]);
  box(out, 'gate', [west, east], [floor, 8.5], [upper - 0.48, upper + 0.48]);
  for (const edge of [west, east]) {
    const tip = lower - (east - west) * 0.16;
    rod(out, 'gate', [edge, 1.4, lower], [center, 1.4, tip], 0.64, 14.35);
    if (detail > 0) {
      for (const height of [2, 5.4, 8.55]) {
        rod(out, 'steel', [edge, height, lower + 0.3], [center, height, tip + 0.3], 0.19, 0.15);
      }
    }
  }
  if (detail === 0) return;
  rod(out, 'steel', [west, 9.12, upper], [east, 9.12, upper], 0.34, 0.95);
  for (const edge of [west, east]) {
    const inside = edge === west ? 1 : -1;
    const x = edge + inside * 0.2;
    for (const z of [upper + 10, lower - 12]) {
      box(out, 'steel', [x - 0.85, x + 0.85], [coping - 0.15, coping + 0.58], [z - 1.15, z + 1.15]);
    }
    if (detail < 2) continue;
    const rail = edge - inside * 0.38;
    for (const offset of [0.45, 1.08]) {
      rod(
        out,
        'steel',
        [rail, coping + offset, upper + 4],
        [rail, coping + offset, lower - 4],
        0.072,
      );
    }
    for (let z = upper + 4; z < lower - 3; z += detail === 2 ? 8 : 4.5) {
      rod(out, 'steel', [rail, coping, z], [rail, coping + 1.1, z], 0.085);
    }
    if (detail < 3) continue;
    for (let z = upper + 20; z < lower - 9; z += 32) {
      for (const dx of [0, 0.36])
        rod(out, 'steel', [x + dx, 2.3, z], [x + dx, coping + 0.13, z], 0.052);
      for (let y = 2.6; y < coping; y += 0.42)
        rod(out, 'steel', [x, y, z], [x + 0.36, y, z], 0.049);
    }
  }
  if (detail < 2) return;
  for (let x = west + (east - west) / 8; x < east; x += (east - west) / 4) {
    rod(out, 'steel', [x, floor + 0.3, upper + 0.5], [x, 8.2, upper + 0.5], 0.29, 0.17);
  }
}

function headworks(out, detail) {
  box(out, 'concrete', [-13, 7.22], [floor, coping], [-86.3, -80.15]);
  box(out, 'concrete', [-13, 7.22], [floor, coping], [80.15, 87.3]);
  wall(
    out,
    [
      [-86, -12.7, -7.22],
      [87, -12.7, -7.22],
    ],
    floor,
    coping,
    detail,
  );
  wall(out, eastWall, floor, coping, detail);
  for (const [west, east, z] of [
    [-12.5, -7.3, -83],
    [12.4, 20.5, -174],
    [55.4, 60.5, -174],
    [14.1, 21.2, 138.9],
  ]) {
    box(out, 'coping', [west, east], [coping - 0.13, coping + 3.3], [z - 2.5, z + 2.5]);
    box(out, 'roof', [west - 0.15, east + 0.15], [coping + 3.3, coping + 3.54], [z - 2.7, z + 2.7]);
    if (detail > 1) {
      panel(
        out,
        'glass',
        [
          [west + 0.65, coping + 1.05, z + 2.513],
          [east - 0.65, coping + 1.05, z + 2.513],
          [east - 0.65, coping + 2.35, z + 2.513],
          [west + 0.65, coping + 2.35, z + 2.513],
        ],
        [0, 0, 1],
      );
    }
  }
  if (detail < 2) return;
  for (let z = -206; z <= 185; z += 36) {
    const x = z < -187 ? 10.5 : 15.2;
    rod(out, 'steel', [x, coping, z], [x, coping + 5.4, z], 0.12);
    rod(out, 'steel', [x, coping + 5.4, z], [x + 1.55, coping + 6, z], 0.1);
    rod(out, 'coping', [x + 1.55, coping + 6, z], [x + 2.2, coping + 6, z], 0.19, 0.27);
  }
}

export function buildRomanianLocks(out, level) {
  const detail = tiers.indexOf(level);
  if (detail < 0) throw new Error(`Unknown Romanian locks detail level ${level}`);
  wall(out, divider, floor, coping, detail);
  headworks(out, detail);
  chamber(out, detail, reserve);
  chamber(out, detail, main);
}

export const buildSkyline = (out) => buildRomanianLocks(out, 'skyline');
export const buildDistrict = (out) => buildRomanianLocks(out, 'district');
export const buildStreet = (out) => buildRomanianLocks(out, 'street');
export const buildCloseup = (out) => buildRomanianLocks(out, 'closeup');
