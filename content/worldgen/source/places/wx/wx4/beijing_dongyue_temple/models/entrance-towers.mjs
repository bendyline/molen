/** Curved hip roofs and the two double-eaved entrance towers of Dongyue Temple. */
import {
  beamPath,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const tint = {
  green: rgb('496e51'),
  ochre: rgb('ae7947'),
  glazeEdge: rgb('b89757'),
  wood: rgb('a43e2e'),
  teal: rgb('246467'),
  blue: rgb('536068'),
  stone: rgb('928f82'),
  pale: rgb('b6ad99'),
  dark: rgb('47382e'),
};
const mix = (a, b, t) => a + (b - a) * t;

export function dongyueHipRoof(
  out,
  { width, depth, eave, rise, green = true, gable = false },
  lod,
) {
  const sections = [1, 4, 7, 10][lod];
  const profile = [
    [0, 1, 1, 0.32],
    [0.24, 0.84, 0.78, 0.2],
    [0.61, 0.61, 0.43, 0.09],
    [0.96, 0.39, 0.052, 0],
  ];
  if (gable) {
    profile[1] = [0.29, 0.84, 0.73, 0.19];
    profile[2] = [0.62, 0.81, 0.43, 0.06];
    profile[3] = [0.96, 0.78, 0.052, 0];
  }
  const ring = ([height, xScale, zScale, curl]) => {
    const x = (width * xScale) / 2,
      z = (depth * zScale) / 2;
    const square = [
      [-x, -z],
      [-x, z],
      [x, z],
      [x, -z],
    ];
    return square.flatMap((a, i) => {
      const b = square[(i + 1) % square.length];
      return Array.from({ length: sections }, (_, j) => {
        const t = j / sections,
          u = Math.abs(t * 2 - 1);
        const lift = curl * u * u * u * u;
        return [mix(a[0], b[0], t), eave + height * rise + lift, mix(a[1], b[1], t)];
      });
    });
  };
  const r = profile.map(ring);
  const tile = green ? tint.green : tint.ochre;
  if (gable) {
    for (let band = 1; band < r.length; band++)
      for (let j = 0; j < r[band].length; j++) {
        const next = (j + 1) % r[band].length;
        const end = band > 1 && Math.floor(j / sections) % 2 === 0;
        face(
          out,
          end ? 'wall' : 'roof',
          [r[band - 1][j], r[band - 1][next], r[band][next], r[band][j]],
          end ? tint.wood : tile,
        );
      }
  } else {
    loft(out, 'roof', r, tile, { cap: false });
  }
  const crown = r.at(-1);
  face(
    out,
    'roof',
    [crown[0], crown[sections], crown[2 * sections], crown[3 * sections]],
    green ? tint.green : tint.ochre,
  );
  if (lod > 0) {
    beamPath(out, 'trim', r[0], 0.124, 0.097, tint.glazeEdge, true);
    const x = width * (gable ? 0.403 : 0.205);
    beamPath(
      out,
      'roof',
      [
        [-x - 0.18, eave + rise + 0.18, 0],
        [-x + 0.12, eave + rise, 0],
        [x - 0.12, eave + rise, 0],
        [x + 0.18, eave + rise + 0.18, 0],
      ],
      0.18,
      0.22,
      green ? tint.green : tint.ochre,
    );
    if (lod > 1)
      for (let i = 0; i < 4; i++) {
        const from = r.map((a) => a[i * sections]);
        beamPath(out, 'trim', from, 0.11, 0.16, tint.glazeEdge);
      }
  }
}

function lintel(out, x, y, z, lod) {
  box(out, 'trim', [x - 0.295, y, z - 0.33], [x + 0.295, y + 0.28, z + 0.24], tint.teal);
  if (lod > 2)
    box(
      out,
      'trim',
      [x - 0.235, y + 0.23, z - 0.37],
      [x + 0.235, y + 0.38, z + 0.32],
      tint.glazeEdge,
    );
}

function podiumOpening(out, bottom, top, half, z, lod) {
  const segments = [5, 8, 12, 16][lod];
  const arch = (i) => {
    const theta = (i * Math.PI) / segments;
    return [-half * Math.cos(theta), bottom + 1.96 + 0.91 * Math.sin(theta), z];
  };
  const back = -0.21;
  box(out, 'recess', [-half, bottom, back - 0.03], [half, bottom + 2.87, back], tint.dark);
  for (let i = 0; i < segments; i++) {
    const a = arch(i),
      b = arch(i + 1);
    face(out, 'stone', [a, b, [b[0], top, z], [a[0], top, z]], tint.stone);
    if (lod > 1) face(out, 'stone', [a, b, [b[0], b[1], back], [a[0], a[1], back]], tint.pale);
  }
}

export function dongyueEntranceTower(out, { width, depth, floor, stonePodium }, lod) {
  const half = width / 2,
    far = depth / 2;
  const firstFloor = floor + 0.58,
    firstEave = floor + 5.55,
    upperEave = floor + 9.03;
  const opening = 1.32;
  box(out, 'stone', [-half, floor - 0.59, -far], [half, firstFloor, far], tint.stone);
  const pillars = [-half + 0.34, -half * 0.46, half * 0.46, half - 0.34];
  if (stonePodium) {
    box(out, 'stone', [-half, firstFloor, -far], [half, firstEave - 0.3, far - 0.49], tint.stone);
    box(
      out,
      'stone',
      [-half, firstFloor, far - 0.53],
      [-opening, firstEave - 0.3, far],
      tint.stone,
    );
    box(out, 'stone', [opening, firstFloor, far - 0.53], [half, firstEave - 0.3, far], tint.stone);
    podiumOpening(
      transform(out, 0, [0, 0, far - 0.07]),
      firstFloor,
      firstEave - 0.3,
      opening,
      0.07,
      lod,
    );
  } else {
    box(out, 'wall', [-half, firstFloor, -far], [half, firstEave - 0.3, far * 0.29], tint.wood);
    for (const x of pillars)
      for (const s of [-1, 1])
        box(
          out,
          'timber',
          [x - 0.17, firstFloor, s * far - 0.19],
          [x + 0.17, firstEave - 0.12, s * far + 0.15],
          tint.wood,
        );
  }
  box(
    out,
    'trim',
    [-half - 0.29, firstEave - 0.39, -far - 0.28],
    [half + 0.29, firstEave - 0.13, far + 0.27],
    tint.teal,
  );
  dongyueHipRoof(
    out,
    {
      width: width + 1.85,
      depth: depth + 1.77,
      eave: firstEave,
      rise: 2.11,
      green: stonePodium,
      gable: true,
    },
    lod,
  );
  const hx = half * 0.68,
    hz = far * 0.68;
  box(out, 'wall', [-hx, firstEave + 1.08, -hz], [hx, upperEave - 0.24, hz], tint.wood);
  for (const sign of [-1, 1]) {
    box(
      out,
      'trim',
      [-hx - 0.1, upperEave - 0.43, sign * hz - 0.16],
      [hx + 0.1, upperEave - 0.15, sign * hz + 0.16],
      tint.teal,
    );
    if (lod > 0)
      for (const x of [-hx * 0.72, 0, hx * 0.72]) {
        lintel(out, x, upperEave - 0.59, sign * hz, lod);
        lintel(out, x, firstEave - 0.62, sign * far, lod);
      }
  }
  dongyueHipRoof(
    out,
    {
      width: 2 * hx + 1.82,
      depth: 2 * hz + 1.58,
      eave: upperEave,
      rise: 2.27,
      green: stonePodium,
      gable: true,
    },
    lod,
  );
  if (lod > 1 && stonePodium)
    triangle(
      out,
      'recess',
      [
        [-0.62, firstEave + 1.74, hz + 0.018],
        [0.62, firstEave + 1.74, hz + 0.018],
        [0, firstEave + 2.88, hz + 0.018],
      ],
      tint.dark,
    );
}
