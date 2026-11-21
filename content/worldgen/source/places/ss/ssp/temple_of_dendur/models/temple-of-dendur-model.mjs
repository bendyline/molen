import { readFileSync } from 'node:fs';
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  at,
  block,
  closed,
  edge,
  face,
  mix,
  pairs,
  palette,
  panel,
  rect,
  ring,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const tone = palette({
  warm: 'c4a572',
  buff: 'd3b686',
  light: 'd7be93',
  earth: 'aa906c',
  bare: 'a68761',
  ledge: 'b69567',
  detail: 'b99a70',
  pale: 'd9c49d',
  engrave: 'ab8d66',
  shadow: '624c37',
  dark: '55432f',
});
const surfaces = {
  temple: surface('wall', 'stone_sandstone', 0.95),
  terrace: surface('foundation', 'stone_ashlar', 0.97),
  cap: surface('trim', 'stone_sandstone_raw', 0.9),
  rock: surface('foundation', 'earth_rammed', 0.97),
  engraving: surface('trim', 'stone_limestone_weathered', 0.94),
};
const floor = d.templeFloor;
const terrace = d.terraceTop;

function stone(out, slot, x0, x1, z0, z1, bottom, top, tint) {
  block(out, slot, x0, bottom, z0, x1 - x0, top - bottom, z1 - z0, tint);
}

function terraceWall(out, lod) {
  shell(out, d.platform, () => -0.18, terrace, { wall: 'terrace', color: tone.warm });
  shell(out, d.court, () => -0.12, terrace, { wall: 'rock', color: tone.earth });
  if (lod === 0) return;
  const top = d.platform.map(([x, z]) => [x * 1.013, z + 0.035]);
  shell(
    out,
    top,
    () => terrace - 0.22,
    terrace + 0.025,
    { wall: 'cap', color: tone.ledge },
    (i) => i !== 5,
  );
  for (const [i, [p, q]] of pairs(closed(d.platform)).entries()) {
    if (i === 5) continue;
    const e = edge(p, q, -1);
    const rows = lod === 1 ? 2 : 5;
    for (let j = 1; j <= rows; j++) {
      const y = ((terrace - 0.29) * j) / (rows + 1);
      panel(out, 'engraving', e, 0.02, e.length - 0.02, y, y + 0.05, 0.004, tone.detail);
    }
    if (lod < 2 || e.length < 5.4) continue;
    const n = Math.floor(e.length / 2.18);
    for (let j = 0; j < 5; j++) {
      const y = 0.24 + 0.53 * j;
      for (let k = 0; k < n; k++) {
        const z = (e.length * (k + 0.25 + 0.41 * (j % 2))) / n;
        panel(out, 'engraving', e, z, z + 0.032, y, y + 0.54, 0.008, tone.detail);
      }
    }
  }
}

function bank(out, lod) {
  // Gau's section describes a low bluff immediately behind a small shelf.
  const xPositions = [-26, -20, -14.4, -8.8, -3, 0, 3.8, 10.3, 14.6, 20.3, 26];
  const zPositions = [-30, -25, -21.5, -19.05, -18.58, -15, -9, -2, 5, 10, 17, 24, 30];
  const clamp = (value) => Math.max(0, Math.min(1, value));
  const height = (x, z) => {
    const near = clamp((26 - Math.abs(x)) / 8.8);
    const front = clamp((31 - z) / 13);
    const shelf = Math.max(0.09, terrace - 0.085 - Math.max(0, z - 8) * 0.126);
    const back = clamp((-z - 18.58) / 1.2);
    const rock = 3.91 + 0.36 * Math.sin(x * 0.47) + 0.28 * Math.cos(z * 0.87 + x);
    const edgeVariation = 0.21 * Math.sin(x * 1.17 + z) * (1 - near);
    return 0.015 + Math.max(0, (shelf + rock * back) * near * front + edgeVariation);
  };
  const columns = lod === 0 ? xPositions.filter((_, i) => i % 2 === 0) : xPositions;
  const rows = zPositions.map((z) => columns.map((x) => [x, height(x, z), z]));
  for (let j = 0; j < rows.length - 1; j++) {
    for (let i = 0; i < rows[j].length - 1; i++) {
      const p = rows[j][i],
        q = rows[j][i + 1],
        r = rows[j + 1][i + 1],
        v = rows[j + 1][i];
      const tint = (i * 17 + j * 23) % 7 < 3 ? tone.bare : tone.earth;
      face(out, 'rock', [p, q, r], up, tint);
      face(out, 'rock', [p, r, v], up, tone.earth);
    }
  }
  const ends = [
    rows[0],
    rows[rows.length - 1],
    rows.map((row) => row[0]),
    rows.map((row) => row.at(-1)),
  ];
  for (const [i, line] of ends.entries()) {
    for (const [a, b] of pairs(line)) {
      face(
        out,
        'rock',
        [[a[0], -0.2, a[2]], [b[0], -0.2, b[2]], b, a],
        i < 2 ? [0, 0, i === 0 ? -1 : 1] : [i === 2 ? -1 : 1, 0, 0],
        tone.earth,
      );
    }
  }
  if (lod < 2) return;
  const count = lod === 2 ? 12 : 22;
  for (let i = 0; i < count; i++) {
    const t = ((i * 37) % 113) / 113,
      k = ((i * 53) % 97) / 97;
    const x = (i % 2 ? -1 : 1) * (14.3 + t * 6.1),
      z = mix(-22, 20, k);
    const h = 0.2 + 0.32 * t,
      w = 0.39 + 0.96 * k;
    const y = height(x, z);
    const polygon = [
      [x - w, z - w * 0.47],
      [x + w * 0.58, z - w * 0.55],
      [x + w, z + w * 0.31],
      [x + w * 0.27, z + w * 0.55],
      [x - w * 0.88, z + w * 0.38],
    ];
    shell(out, polygon, (p) => Math.min(y + h - 0.04, height(...p) - 0.28), y + h, {
      wall: 'rock',
      color: i % 3 === 0 ? tone.ledge : tone.earth,
    });
  }
}

function chamber(out, lod) {
  const { x, z, mouthWidth } = d.shrine;
  const y = 3.36,
    w = mouthWidth * 0.5;
  const wall = edge([x - 2, z], [x + 2, z], -1);
  const u = 2;
  panel(out, 'cap', wall, u - w - 0.21, u + w + 0.21, y - 0.06, y + 2.12, 0.05, tone.warm);
  panel(out, 'temple', wall, u - w, u + w, y, y + 1.79, 0.08, tone.dark);
  panel(out, 'cap', wall, u - w - 0.37, u + w + 0.37, y + 1.82, y + 2.19, 0.14, tone.buff);
  for (const sign of [-1, 1]) {
    const v = x + sign * 1.08;
    stone(out, 'terrace', v - 0.28, v + 0.28, z + 0.11, z + 1.91, y - 0.45, y + 0.31, tone.ledge);
  }
  if (lod > 0) {
    panel(out, 'cap', wall, u - w - 0.27, u + w + 0.27, y + 2.18, y + 2.27, 0.19, tone.pale);
    for (const mid of [1.1, 2.9]) {
      panel(
        out,
        'engraving',
        wall,
        mid - 0.028,
        mid + 0.028,
        y + 0.3,
        y + 1.72,
        0.152,
        tone.detail,
      );
    }
  }
}

function courses(out, slots, x0, x1, z0, z1, start, rise, shade) {
  for (const [i, [inset, h]] of [
    [0.0, 0.11],
    [0.07, 0.15],
    [0.17, 0.18],
    [0.32, 0.19],
  ].entries()) {
    const a = start + i * rise;
    stone(
      out,
      i === 0 ? slots[0] : slots[1],
      x0 - inset,
      x1 + inset,
      z0 - inset,
      z1 + inset,
      a,
      a + h,
      shade,
    );
  }
}

function entryColumns(out, lod) {
  const n = [8, 12, 18, 24][lod];
  for (const x of [-1.66, 1.66]) {
    const p = [x, -0.1],
      b = floor;
    ring(
      out,
      'temple',
      p,
      [
        [b, 0.51],
        [b + 0.16, 0.54],
        [b + 0.28, 0.43],
        [b + 3.05, 0.37],
        [b + 3.3, 0.49],
        [b + 3.65, 0.68],
        [b + 3.81, 0.66],
      ],
      n,
      tone.buff,
    );
    stone(out, 'cap', x - 0.53, x + 0.53, -0.58, 0.36, b + 3.79, b + 4.05, tone.ledge);
    if (lod < 2) continue;
    for (let i = 0; i < (lod === 2 ? 8 : 12); i++) {
      const a = (i * 2 * Math.PI) / (lod === 2 ? 8 : 12);
      const dx = Math.cos(a),
        dz = Math.sin(a);
      beamPath(
        out,
        'engraving',
        [
          [x + dx * 0.41, b + 0.49, p[1] + dz * 0.41],
          [x + dx * 0.39, b + 2.95, p[1] + dz * 0.39],
        ],
        0.021,
        0.028,
        tone.detail,
      );
      beamPath(
        out,
        'cap',
        [
          [x + dx * 0.45, b + 3.24, p[1] + dz * 0.45],
          [x + dx * 0.56, b + 3.59, p[1] + dz * 0.56],
          [x + dx * 0.66, b + 3.74, p[1] + dz * 0.66],
        ],
        0.097,
        0.083,
        tone.buff,
      );
    }
  }
}

function temple(out, lod) {
  const roof = floor + d.roofHeight;
  stone(out, 'terrace', -3.46, 3.46, -13.45, 0.24, terrace - 0.11, floor, tone.ledge);
  for (const x of [-3.26, 2.55]) {
    stone(out, 'temple', x, x + 0.73, -13.3, 0, floor, roof - 0.42, tone.warm);
  }
  for (const z of [-13.28, -9.87, -5.03]) {
    stone(out, 'temple', -2.56, -0.64, z, z + 0.62, floor, roof - 0.56, tone.buff);
    stone(out, 'temple', 0.64, 2.58, z, z + 0.62, floor, roof - 0.56, tone.buff);
    stone(out, 'cap', -0.65, 0.65, z, z + 0.62, floor + 2.65, roof - 0.56, tone.warm);
  }
  stone(out, 'temple', -3.27, 3.26, -10.6, 0.16, roof - 0.55, roof - 0.19, tone.warm);
  courses(out, ['cap', 'temple'], -3.22, 3.2, -10.36, 0.04, roof - 0.33, 0.103, tone.buff);
  for (const side of [-1, 1]) {
    const a = side === -1 ? -3.27 : 2.55,
      b = a + 0.72;
    stone(out, 'cap', a - 0.07, b + 0.07, -0.66, 0.13, floor + 0.03, floor + 4.39, tone.buff);
  }
  entryColumns(out, lod);
  stone(out, 'temple', 1.96, 2.61, -0.15, 0.115, floor + 0.01, floor + 1.6, tone.buff);
  stone(out, 'cap', 1.82, 2.66, -0.17, 0.2, floor + 1.58, floor + 1.75, tone.warm);
  if (lod > 0) {
    for (const [i, [x, w, h]] of [
      [-2.95, 0.69, 0.28],
      [-1.96, 0.88, 0.21],
      [-0.91, 0.77, 0.15],
      [0.31, 0.88, 0.2],
      [1.67, 1.01, 0.29],
      [2.71, 0.72, 0.25],
    ].entries()) {
      const z = -0.17 - (i % 3) * 0.08;
      stone(
        out,
        'cap',
        x - w * 0.5,
        x + w * 0.5,
        z,
        z + 0.3,
        roof + 0.12,
        roof + 0.12 + h,
        tone.pale,
      );
    }
  }
}

function pylon(out, lod) {
  const z = 9.88;
  const base = d.gateFloor + 0.11,
    lintel = base + 3.92,
    high = base + 5.72;
  for (const sign of [-1, 1]) {
    const curve = (outer, inside) => {
      const a = outer * sign,
        b = inside * sign;
      return rect(Math.min(a, b), 8.61, Math.max(a, b), 11.14);
    };
    const bottom = curve(2.23, 0.89),
      upper = curve(1.94, 0.87);
    for (const [i, [p, q]] of pairs(closed(bottom)).entries()) {
      const u = upper[i],
        v = upper[(i + 1) % 4],
        n = edge(p, q).normal;
      face(
        out,
        'temple',
        [at(p, base), at(q, base), at(v, lintel + 0.49), at(u, lintel + 0.49)],
        n,
        tone.buff,
      );
    }
  }
  stone(out, 'temple', -1.96, 1.96, 8.61, 11.14, lintel, high - 0.39, tone.warm);
  courses(out, ['cap', 'temple'], -2.02, 2.02, 8.55, 11.19, high - 0.46, 0.142, tone.buff);
  const stepBase = terrace - 0.005;
  for (let i = 0; i < 4; i++) {
    stone(
      out,
      'terrace',
      -1.13,
      1.13,
      z + 1.34,
      z + 2.36 - i * 0.205,
      stepBase,
      stepBase + 0.055 * (i + 1),
      tone.ledge,
    );
  }
  if (lod === 0) return;
  for (const side of [-1, 1]) {
    const wall = edge([-2.025, z + side * 1.28], [2.025, z + side * 1.28], -side);
    for (const pos of [0.49, 3.56]) {
      for (let j = 0; j < 3; j++) {
        const y = base + 0.46 + j * 0.99;
        panel(out, 'engraving', wall, pos - 0.26, pos + 0.26, y, y + 0.81, 0.034, tone.detail);
      }
    }
    panel(out, 'engraving', wall, 0.1, 3.95, lintel + 0.48, lintel + 0.6, 0.04, tone.detail);
  }
}

function relief(out, lod) {
  if (lod < 1) return;
  for (const sign of [-1, 1]) {
    const wall = edge([sign * 3.27, -12.89], [sign * 3.27, -0.1], sign);
    const rows = lod === 1 ? 2 : 3;
    for (let j = 0; j < rows; j++) {
      const level = floor + 0.61 + j * 1.07;
      panel(
        out,
        'engraving',
        wall,
        0.09,
        wall.length - 0.12,
        level,
        level + 0.05,
        0.025,
        tone.detail,
      );
      if (lod < 2) continue;
      const count = lod === 2 ? 8 : 14;
      for (let i = 0; i < count; i++) {
        const p = ((i + 0.5) * wall.length) / count;
        const height = 0.61 + 0.045 * (i % 4);
        const y = level + 0.126;
        const points = [
          wall.p(p - 0.18, y, 0.02),
          wall.p(p - 0.03, y + height * 0.39, 0.02),
          wall.p(p - 0.06, y + height * 0.75, 0.02),
          wall.p(p + 0.06, y + height, 0.02),
          wall.p(p + 0.19, y + height * 0.83, 0.02),
          wall.p(p + 0.13, y + height * 0.39, 0.02),
          wall.p(p + 0.22, y, 0.02),
        ];
        for (let k = 0; k < points.length - 1; k++) {
          beamPath(out, 'engraving', [points[k], points[k + 1]], 0.032, 0.025, tone.engrave);
        }
      }
    }
  }
}

function build(out, lod) {
  bank(out, lod);
  terraceWall(out, lod);
  chamber(out, lod);
  temple(out, lod);
  pylon(out, lod);
  relief(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'temple-of-dendur-model.mjs';
const camera = [43, 28, 59];
const lookAt = [0, 4.0, 0];
export const dendurModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'religious',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis:
    'The independent DEM measures the present reservoir surface. The 1874 proposal uses estimated historical relative levels at the archaeological site.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
    basis:
      'The 1874 survey-era appearance is bounded to the photographic record before operation of the first Aswan reservoir.',
  },
  brief:
    'The Temple of Dendur at its original nineteenth-century Nubian site, with the sandstone temple, detached pylon gateway, paved terrace and original rock-cut shrine.',
  camera,
  lookAt,
  sunDirection: [34, 50, 69],
  mediumFiContext: {
    scale: 1,
    groundY: -0.1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap((s) => s.graph ?? []),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'standing-temple-and-gateway', position: [29, 13, 17], lookAt: [0, 5, 0] },
    { name: 'east-gateway-and-platform', position: [6, 10, 31], lookAt: [0, 5.4, 9.8] },
    { name: 'portico-and-papyrus-capitals', position: [6.6, 8.8, 6.8], lookAt: [0, 6.2, -0.63] },
    { name: 'rock-cut-shrine-and-rear', position: [12, 12, -13], lookAt: [0, 5.6, -16.8] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'dendur-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.85,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.48, surfaces },
      street: { export: 'street', errorMeters: 0.19, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.08, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under the repository license. The archival Gau and Teynard images are public domain. The Bridgman image is CC0 courtesy of The Metropolitan Museum of Art.',
};
