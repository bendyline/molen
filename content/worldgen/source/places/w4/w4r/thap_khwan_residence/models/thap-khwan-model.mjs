/** Thap Khwan's raised teak house group around an open court. */
import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file + '.json', import.meta.url)));
const frame = read('map-frame'),
  plan = read('plan-controls'),
  terrain = read('terrain-grid');
const { deck, pavilions, stairX, treeWellSize } = plan.dimensions;
const outline = frame.geometry.outline;
const surfaces = {
  wood: { slot: 'wall', graph: 'wood_plain', roughness: 0.89, metallic: 0 },
  trim: { slot: 'trim', localRef: 'palette:#5d493d', roughness: 0.83, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.91, metallic: 0 },
  pane: { slot: 'window', localRef: 'palette:#474139', roughness: 0.88, metallic: 0 },
};
const color = {
  teak: rgb('735748'),
  plank: rgb('7a5d4c'),
  trim: rgb('6a4b3f'),
  beam: rgb('604d44'),
  roof: rgb('51474a'),
  ridge: rgb('694c43'),
  opening: rgb('45443b'),
};
const white = 'palette:#ffffff',
  up = [0, 1, 0];
const mix = (a, b, t) => a + (b - a) * t;

function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    h = terrain.heightsMeters;
  return (
    mix(mix(h[j][i], h[j][i + 1], u - i), mix(h[j + 1][i], h[j + 1][i + 1], u - i), v - j) -
    terrain.modelDatumElevationMeters
  );
}

function face(out, slot, points, tint, toward) {
  let normal = normalFor(...points);
  if (toward && normal.reduce((sum, n, i) => sum + n * toward[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, tint);
  else
    out.addTriangle(
      slot,
      white,
      points,
      normal,
      points.map(([x, y, z]) => [x + z, y]),
      tint,
    );
}

function localFrame({ center: [x, z], along }) {
  if (along === 'x') return (u, y, v) => [x + u, y, z + v];
  return (u, y, v) => [x - v, y, z + u];
}

function panelWalls(out, house, point, level) {
  const u = house.length / 2,
    v = house.width / 2,
    eave = house.eave;
  const base = deck + 0.025,
    inset = 0.21;
  const corners = [
    [-u, -v],
    [u, -v],
    [u, v],
    [-u, v],
  ];
  for (let i = 0; i < corners.length; i++) {
    const [a, b] = corners[i],
      [c, d] = corners[(i + 1) % corners.length];
    const pose = (t, y, depth = 0) => {
      const s = (inset * (y - base)) / (eave - base);
      const uu = mix(a, c, t),
        vv = mix(b, d, t);
      return point(uu * (1 - (s - depth) / u), y, vv * (1 - (s - depth) / v));
    };
    const loop = (p, q, l, h, depth) => [
      pose(p, l, depth),
      pose(q, l, depth),
      pose(q, h, depth),
      pose(p, h, depth),
    ];
    const edge = point(c, base, d).map((n, k) => n - point(a, base, b)[k]);
    const aim = [edge[2], 0, -edge[0]];
    face(out, 'wood', loop(0, 1, base, eave, 0), color.teak, aim);
    if (level === 0) continue;
    const length = Math.hypot(c - a, d - b);
    const bays = length > 8 ? 4 : length > 4 ? 3 : 2;
    for (let j = 0; j < bays; j++) {
      const mid = (j + 0.5) / bays,
        half = Math.min(0.4 / length, 0.16);
      const bottom = base + 0.62,
        top = base + (eave - base) * 0.77;
      face(
        out,
        'trim',
        loop(mid - half - 0.017, mid + half + 0.017, bottom - 0.08, top + 0.115, 0.047),
        color.trim,
        aim,
      );
      face(out, 'pane', loop(mid - half, mid + half, bottom, top, 0.084), color.opening, aim);
      if (level > 1) {
        const shift = 0.055 / length;
        face(out, 'wood', loop(mid - shift, mid + shift, bottom, top, 0.108), color.plank, aim);
        for (const t of [mid - 0.34 / bays, mid + 0.34 / bays]) {
          face(
            out,
            'trim',
            loop(t - 0.006, t + 0.006, base + 0.12, eave - 0.13, 0.071),
            color.trim,
            aim,
          );
        }
      }
      if (level === 3) {
        for (const offset of [0.09, 0.18]) {
          face(
            out,
            'wood',
            loop(mid - half, mid + half, bottom - offset, bottom - offset + 0.04, 0.096),
            color.plank,
            aim,
          );
        }
      }
    }
    if (level > 1) {
      for (const y of [base + 0.25, eave - 0.32]) {
        face(out, 'trim', loop(0, 1, y, y + 0.112, 0.043), color.trim, aim);
      }
    }
  }
}

function supports(out, house, point, level) {
  const u = house.length / 2 - 0.2,
    v = house.width / 2 - 0.22;
  const stations = level > 0 && house.length > 7 ? [-u, 0, u] : [-u, u];
  for (const x of stations) {
    for (const z of [-v, v]) {
      const p = point(x, deck, z);
      box(
        out,
        'wood',
        [p[0] - 0.13, ground(p[0], p[2]) - 0.18, p[2] - 0.132],
        [p[0] + 0.13, deck + 0.1, p[2] + 0.132],
        color.beam,
      );
      if (level > 1) {
        beam(
          out,
          'trim',
          point(x, deck + 0.19, z),
          point(x, house.eave - 0.03, z * 1.23),
          0.104,
          0.11,
          color.trim,
        );
      }
    }
  }
  if (level > 0) {
    for (const z of [-v, v])
      beam(out, 'wood', point(-u, deck - 0.2, z), point(u, deck - 0.2, z), 0.19, 0.23, color.beam);
  }
}

function gableRoof(out, house, point, level) {
  const halfLength = house.length / 2 + 0.56,
    halfWidth = house.width / 2 + 0.64;
  const { eave, rise } = house;
  const pitches =
    level === 0
      ? [
          [0, 0],
          [0.5, 0.31],
          [1, 1],
        ]
      : [
          [0, 0],
          [0.32, 0.14],
          [0.66, 0.51],
          [1, 1],
        ];
  for (const sign of [-1, 1]) {
    const ridgeSide = (u, [across, y]) =>
      point(u, eave + y * rise, sign * halfWidth * (1 - across));
    for (let i = 1; i < pitches.length; i++) {
      const a = pitches[i - 1],
        b = pitches[i];
      face(
        out,
        'roof',
        [
          ridgeSide(-halfLength, a),
          ridgeSide(halfLength, a),
          ridgeSide(halfLength, b),
          ridgeSide(-halfLength, b),
        ],
        color.roof,
        up,
      );
    }
    if (level > 0) {
      const skirt = 0.43;
      face(
        out,
        'roof',
        [
          point(-halfLength - 0.04, eave - skirt, sign * (halfWidth + 0.31)),
          point(halfLength + 0.04, eave - skirt, sign * (halfWidth + 0.31)),
          point(halfLength, eave + 0.055, sign * (halfWidth - 0.09)),
          point(-halfLength, eave + 0.055, sign * (halfWidth - 0.09)),
        ],
        color.roof,
        up,
      );
      beam(
        out,
        'trim',
        point(-halfLength, eave - skirt - 0.03, sign * (halfWidth + 0.31)),
        point(halfLength, eave - skirt - 0.03, sign * (halfWidth + 0.31)),
        0.12,
        0.15,
        color.trim,
      );
    }
  }
  for (const direction of [-1, 1]) {
    const u = direction * (halfLength - 0.06);
    const outward = point(direction, eave, 0).map((n, k) => n - point(0, eave, 0)[k]);
    const center = point(u, eave, 0);
    for (const sign of [-1, 1]) {
      const end = ([across, y]) => point(u, eave + y * rise, sign * halfWidth * (1 - across));
      for (let i = 1; i < pitches.length; i++) {
        face(out, 'wood', [center, end(pitches[i - 1]), end(pitches[i])], color.plank, outward);
      }
      if (level > 0) {
        const edgePoint = ([across, y]) =>
          point(direction * halfLength, eave + y * rise, sign * halfWidth * (1 - across));
        const profile = pitches.map(edgePoint);
        profile[0] = point(direction * halfLength, eave + 0.31, sign * (halfWidth + 0.16));
        profile[profile.length - 1] = point(direction * (halfLength + 0.22), eave + rise + 0.36, 0);
        beamPath(out, 'trim', profile, level > 1 ? 0.18 : 0.135, 0.13, color.trim);
      }
      if (level > 1) {
        for (const r of [0.17, 0.29, 0.41]) {
          const y = eave + r * rise;
          const width = halfWidth * (1 - r * 1.34);
          const a = point(direction * (halfLength - 0.022), y, 0),
            b = point(direction * (halfLength - 0.022), y, sign * width);
          beam(out, 'trim', a, b, 0.072, 0.08, color.trim);
        }
      }
    }
  }
  if (level > 1)
    beam(
      out,
      'trim',
      point(-halfLength, eave + rise + 0.021, 0),
      point(halfLength, eave + rise + 0.021, 0),
      0.1,
      0.1,
      color.ridge,
    );
}

function raisedDeck(out, level) {
  const edgeX = 14.84,
    edgeZ = 10.46,
    well = treeWellSize / 2;
  const bands = [
    [-edgeX, -edgeZ, -well, edgeZ],
    [well, -edgeZ, edgeX, edgeZ],
    [-well, -edgeZ, well, -well],
    [-well, well, well, edgeZ],
  ];
  for (const [x0, z0, x1, z1] of bands) {
    box(out, 'wood', [x0, deck - 0.2, z0], [x1, deck, z1], color.plank);
  }
  if (level > 0) {
    for (const z of [-7.1, -3.22, 3.22, 7.1]) {
      for (const x of [-6.98, 0, 6.98]) {
        box(
          out,
          'wood',
          [x - 0.12, ground(x, z) - 0.18, z - 0.12],
          [x + 0.12, deck - 0.16, z + 0.12],
          color.beam,
        );
      }
    }
  }
  if (level > 1) {
    for (const z of [-edgeZ, -well, well, edgeZ]) {
      const half = z < -well || z > well ? edgeX : well;
      beam(out, 'trim', [-half, deck - 0.12, z], [half, deck - 0.12, z], 0.13, 0.14, color.trim);
    }
    for (const x of [-well, well])
      beam(out, 'trim', [x, deck - 0.12, -well], [x, deck - 0.12, well], 0.12, 0.14, color.trim);
  }
}

function stair(out, x, level) {
  const topZ = 10.42,
    bottomZ = 13.57,
    bottom = ground(x, bottomZ) + 0.075;
  for (const dx of [-0.84, 0.84]) {
    beam(
      out,
      'wood',
      [x + dx, deck - 0.09, topZ],
      [x + dx, bottom - 0.08, bottomZ],
      0.16,
      0.24,
      color.beam,
    );
  }
  if (level === 0) {
    face(
      out,
      'wood',
      [
        [x - 0.84, deck, topZ],
        [x + 0.84, deck, topZ],
        [x + 0.84, bottom, bottomZ],
        [x - 0.84, bottom, bottomZ],
      ],
      color.teak,
      up,
    );
    return;
  }
  const steps = level > 1 ? 10 : 7;
  for (let i = 0; i < steps; i++) {
    const t = i / steps,
      z = mix(topZ, bottomZ, t),
      y = mix(deck, bottom, t);
    box(out, 'wood', [x - 0.94, y - 0.112, z], [x + 0.94, y, z + 0.29], color.plank);
  }
}

function build(out, level) {
  raisedDeck(out, level);
  for (const house of pavilions) {
    const point = localFrame(house);
    supports(out, house, point, level);
    panelWalls(out, house, point, level);
    gableRoof(out, house, point, level);
  }
  for (const x of stairX) stair(out, x, level);
}
export const thapSkyline = (out) => build(out, 0);
export const thapDistrict = (out) => build(out, 1);
export const thapStreet = (out) => build(out, 2);
export const thapCloseup = (out) => build(out, 3);

const recipe = 'thap-khwan-model.mjs',
  position = [31, 26, 38],
  lookAt = [0, 4.0, 0];
export const thapKhwanModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  surfaces,
  build: thapCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  buildingCutout: {
    outline,
    minimumCoverage: 0.995,
    basis: 'Named mapped perimeter of the connected raised teak houses.',
  },
  brief:
    'Eight dark teak pavilions with steep curved clay tile roofs surround a raised deck open to the sky.',
  camera: position,
  lookAt,
  sunDirection: [-58, 101, 122],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1.47,
    cameraYaw: 0.36,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'two-southern-stairs-and-teak-panels', position: [20, 9, 34], lookAt: [0, 4.2, 5] },
    { name: 'steep-gables-and-open-undercroft', position: [35, 8, 1], lookAt: [5, 3.7, 0] },
    { name: 'eight-roofs-and-central-deck', position: [-18, 37, 22], lookAt: [0, 3.15, 0] },
    { name: 'north-rear-pavilions', position: [-27, 13, -24], lookAt: [0, 3.4, -3.8] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'thap-khwan-' + reviewLod,
    position,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'thapSkyline',
    errorMeters: 0.9,
    surfaces,
    authoredLevels: {
      district: { export: 'thapDistrict', errorMeters: 0.45, surfaces },
      street: { export: 'thapStreet', errorMeters: 0.18, surfaces },
      closeup: { export: 'thapCloseup', errorMeters: 0.065, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original authored geometry using the photographer’s exact Qualla public-domain original, published architectural facts, OpenStreetMap and Terrarium elevations.',
};
