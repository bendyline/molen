/** The two surviving Bellman exhibition hangars and the open space between them. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url)));
const plan = read('plan-controls.json');
const terrain = read('terrain-grid.json');
const palette = 'palette:#ffffff';
const up = [0, 1, 0];
const surfaces = {
  wall: { slot: 'wall', graph: 'metal_corrugated', roughness: 0.91, metallic: 0.14 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.86, metallic: 0.21 },
  door: { slot: 'door', graph: 'metal_corrugated', roughness: 0.9, metallic: 0.15 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.88, metallic: 0.09 },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.54, metallic: 0.02 },
};
const c = Object.fromEntries(
  Object.entries({
    wall: 'abaea1',
    wallAlt: 'b6b5a9',
    roof: '838881',
    roofAlt: '92928a',
    trim: '666f65',
    paleTrim: 'b8b8a8',
    door: '92988b',
    doorAlt: 'a0a495',
    concrete: '9c9a8f',
    path: 'adab9f',
    glazing: '667f80',
    hood: '7b8279',
    dark: '575d53',
  }).map(([key, value]) => [key, rgb(value)]),
);

function face(out, slot, points, direction, color) {
  const normal = normalFor(...points);
  const dot = normal.reduce((sum, n, i) => sum + n * direction[i], 0);
  out.addConvexPolygon(
    slot,
    palette,
    points,
    dot < 0 ? normal.map((n) => -n) : normal,
    ([x, y, z]) => (Math.abs(normal[1]) > 0.6 ? [x, z] : [x - z * 0.47, y]),
    color,
  );
}

function grade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const a = u - i,
    b = v - j;
  const lo = terrain.heightsMeters[j],
    hi = terrain.heightsMeters[j + 1];
  return (
    (lo[i] * (1 - a) + lo[i + 1] * a) * (1 - b) +
    (hi[i] * (1 - a) + hi[i + 1] * a) * b -
    terrain.modelDatumElevationMeters
  );
}

function hallFrame(hall) {
  const {
    center: [x, z],
    across: [ux, uz],
    span,
    length,
    eave,
    ridge,
    floor,
  } = hall;
  const vx = -uz,
    vz = ux;
  return {
    h: span / 2,
    d: length / 2,
    eave: floor + eave,
    ridge: floor + ridge,
    floor,
    p: (u, y, v) => [x + u * ux + v * vx, y, z + u * uz + v * vz],
    across: (s) => [s * ux, 0, s * uz],
    along: (s) => [s * vx, 0, s * vz],
  };
}

function foundations(out, { p, h, d, floor, across, along }) {
  const corners = [
    [-h, -d],
    [h, -d],
    [h, d],
    [-h, d],
  ];
  const directions = [along(-1), across(1), along(1), across(-1)];
  for (let i = 0; i < corners.length; i++) {
    const [u, v] = corners[i];
    const [a, b] = corners[(i + 1) % corners.length];
    const bottom = (x, z) => {
      const [wx, , wz] = p(x, 0, z);
      return p(x, Math.min(floor - 0.17, grade(wx, wz) - 0.26), z);
    };
    face(
      out,
      'foundation',
      [bottom(u, v), bottom(a, b), p(a, floor, b), p(u, floor, v)],
      directions[i],
      c.concrete,
    );
  }
}

function shellRoof(out, { p, h, d, eave, ridge }, lod, roofColor) {
  const overhang = 0.32;
  for (const s of [-1, 1]) {
    const end = s * (h + overhang),
      endY = eave - ((ridge - eave) * overhang) / h;
    const start = -d - overhang,
      finish = d + overhang;
    face(
      out,
      'roof',
      [p(0, ridge, start), p(end, endY, start), p(end, endY, finish), p(0, ridge, finish)],
      up,
      roofColor,
    );
    if (lod > 0)
      beam(
        out,
        'trim',
        p(end, endY - 0.055, start),
        p(end, endY - 0.055, finish),
        0.13,
        0.1,
        c.trim,
      );
    if (lod > 1) {
      const bays = Math.round((2 * d) / 3.81);
      for (let i = 1; i < bays; i++) {
        const v = -d + (2 * d * i) / bays;
        beam(out, 'trim', p(0, ridge + 0.023, v), p(end, endY + 0.023, v), 0.032, 0.028, roofColor);
      }
      for (const v of [start, finish])
        beam(out, 'trim', p(0, ridge, v), p(end, endY, v), 0.09, 0.125, c.paleTrim);
    }
  }
  if (lod > 0)
    beam(
      out,
      'trim',
      p(0, ridge + 0.035, -d - overhang),
      p(0, ridge + 0.035, d + overhang),
      0.24,
      0.1,
      c.trim,
    );
}

function longWalls(out, frame, lod, wallColor) {
  const { p, h, d, eave, floor, across } = frame;
  const bays = Math.round((2 * d) / 3.81);
  for (const s of [-1, 1]) {
    const u = s * h,
      dir = across(s);
    const panel = (slot, a, b, lo, hi, depth, color) => {
      const x = u + s * depth;
      face(out, slot, [p(x, lo, a), p(x, lo, b), p(x, hi, b), p(x, hi, a)], dir, color);
    };
    panel('wall', -d, d, floor, eave, 0, wallColor);
    panel('trim', -d, d, floor + 0.04, floor + 0.17, 0.018, c.trim);
    if (lod > 0) {
      for (let i = 1; i < bays; i++) {
        const v = -d + (2 * d * i) / bays;
        panel('trim', v - 0.032, v + 0.032, floor + 0.16, eave, 0.032, c.paleTrim);
        if (i % 2 !== 0) continue;
        const z = v + d / bays;
        const y = eave - 1.98;
        panel('trim', z - 0.83, z + 0.83, y - 0.08, y + 1.09, 0.035, c.trim);
        panel('glass', z - 0.74, z + 0.74, y, y + 1.01, 0.05, c.glazing);
        if (lod > 1) {
          panel('trim', z - 0.026, z + 0.026, y, y + 1.02, 0.063, c.paleTrim);
          panel('trim', z - 0.75, z + 0.75, y + 0.46, y + 0.51, 0.063, c.paleTrim);
        }
      }
      for (const v of [-d + 0.19, d - 0.19]) {
        const x = u + s * 0.1;
        beam(out, 'trim', p(x, eave - 0.085, v), p(x, floor + 0.21, v), 0.09, 0.09, c.hood);
      }
    }
  }
}

function entranceSteps(out, frame, u, sign) {
  const { p, d, floor, along, across } = frame;
  const a = u - 0.89;
  const b = u + 0.89;
  const ground = (x, v) => {
    const [wx, , wz] = p(x, 0, v);
    return grade(wx, wz);
  };
  const levels = Math.max(1, Math.min(6, Math.ceil((floor - ground(u, sign * (d + 1.4))) / 0.18)));
  const run = 1.4 / levels;
  for (let i = 0; i < levels; i++) {
    const t = sign * (d + run * i);
    const v = sign * (d + run * (i + 1));
    const y = floor - (floor - ground(u, v)) * (i / levels);
    const next =
      i + 1 === levels ? ground(u, v) - 0.04 : floor - (floor - ground(u, v)) * ((i + 1) / levels);
    face(out, 'foundation', [p(a, y, t), p(b, y, t), p(b, y, v), p(a, y, v)], up, c.path);
    face(
      out,
      'foundation',
      [p(a, next, v), p(b, next, v), p(b, y, v), p(a, y, v)],
      along(sign),
      c.concrete,
    );
    for (const [x, dir] of [
      [a, -1],
      [b, 1],
    ]) {
      face(
        out,
        'foundation',
        [
          p(x, Math.min(y - 0.045, ground(x, t)), t),
          p(x, Math.min(y - 0.045, ground(x, v)), v),
          p(x, y, v),
          p(x, y, t),
        ],
        across(dir),
        c.concrete,
      );
    }
  }
}

function gableEnds(out, frame, hall, lod, wallColor) {
  const { p, h, d, eave, ridge, floor, along } = frame;
  for (const s of [-1, 1]) {
    const z = s * d,
      dir = along(s);
    const panel = (slot, a, b, lo, hi, depth, color) => {
      const v = z + s * depth;
      face(out, slot, [p(a, lo, v), p(b, lo, v), p(b, hi, v), p(a, hi, v)], dir, color);
    };
    face(
      out,
      'wall',
      [p(-h, floor, z), p(h, floor, z), p(h, eave, z), p(0, ridge, z), p(-h, eave, z)],
      dir,
      wallColor,
    );
    // Original sliding doors are retained visually as overlapping closed leaves.
    const half = h * 0.88;
    const top = eave - 0.53;
    const leaves = lod === 0 ? 2 : 4;
    const step = (2 * half) / leaves;
    for (let i = 0; i < leaves; i++) {
      const a = i * step - half;
      panel(
        'door',
        a + 0.027,
        a + step - 0.027,
        floor + 0.09,
        top,
        i % 2 ? 0.098 : 0.071,
        i % 2 ? c.door : c.doorAlt,
      );
      if (lod > 0) {
        panel('trim', a + 0.035, a + 0.114, floor + 0.09, top, 0.12, c.trim);
        if (lod > 1) {
          panel('trim', a + 0.086, a + step - 0.073, floor + 0.24, floor + 0.34, 0.12, c.trim);
          panel('trim', a + 0.086, a + step - 0.073, top - 0.23, top - 0.14, 0.12, c.trim);
        }
        if (lod === 3) {
          for (const fraction of [0.32, 0.68]) {
            const u = a + fraction * step;
            panel('trim', u - 0.018, u + 0.018, floor + 0.34, top - 0.22, 0.123, c.paleTrim);
          }
        }
      }
    }
    panel('trim', -h * 0.94, h * 0.94, top + 0.015, top + 0.15, 0.17, c.trim);
    if (lod > 1) {
      for (const x of [-half, half]) {
        panel('trim', x - 0.07, x + 0.07, floor, top + 0.2, 0.15, c.paleTrim);
      }
      panel('trim', -h * 0.96, h * 0.96, floor - 0.01, floor + 0.07, 0.18, c.dark);
    }
    if (s !== hall.courtEnd) continue;
    const x = h * 0.55;
    panel('glass', x - 0.62, x + 0.62, floor + 0.05, floor + 2.24, 0.152, c.glazing);
    entranceSteps(out, frame, x, s);
    if (lod > 0) {
      for (const u of [x - 0.64, x + 0.64, x])
        panel('trim', u - 0.028, u + 0.028, floor + 0.04, floor + 2.3, 0.17, c.paleTrim);
      panel('trim', x - 0.67, x + 0.67, floor + 2.23, floor + 2.31, 0.172, c.trim);
      const canopy = z + s * 1.14;
      face(
        out,
        'roof',
        [
          p(x - 0.92, floor + 2.64, z),
          p(x + 0.92, floor + 2.64, z),
          p(x + 0.92, floor + 2.5, canopy),
          p(x - 0.92, floor + 2.5, canopy),
        ],
        up,
        c.hood,
      );
    }
  }
}

function cap(out, slot, ring, height, color) {
  const ids = earcut(ring.flat());
  for (let i = 0; i < ids.length; i += 3) {
    const points = ids.slice(i, i + 3).map((index) => {
      const [x, z] = ring[index];
      return [x, height(x, z), z];
    });
    face(out, slot, points, up, color);
  }
}

const [ux, uz] = plan.dimensions.siteAcross;
const sitePoint = ([u, v]) => [u * ux - v * uz, u * uz + v * ux];
function court(out) {
  for (const [left, start, right, finish] of plan.dimensions.paths) {
    const pieces = Math.ceil((finish - start) / 5);
    for (let i = 0; i < pieces; i++) {
      const a = start + ((finish - start) * i) / pieces;
      const b = start + ((finish - start) * (i + 1)) / pieces;
      const ring = [
        [left, a],
        [right, a],
        [right, b],
        [left, b],
      ].map(sitePoint);
      cap(out, 'foundation', ring, (x, z) => grade(x, z) + 0.06, c.path);
    }
  }
}

function annex(out, { outline, top, finish, windows }, level) {
  const roofColor = finish === 'library' ? c.roofAlt : c.roof;
  cap(out, 'roof', outline, () => top, roofColor);
  const signedArea = outline.reduce((sum, [x, z], i) => {
    const [u, v] = outline[(i + 1) % outline.length];
    return sum + x * v - z * u;
  }, 0);
  const winding = Math.sign(signedArea);
  for (const [i, [x, z]] of outline.entries()) {
    const [u, v] = outline[(i + 1) % outline.length];
    const length = Math.hypot(u - x, v - z);
    const normal = [(winding * (v - z)) / length, 0, (winding * (x - u)) / length];
    face(
      out,
      'wall',
      [
        [x, grade(x, z) - 0.21, z],
        [u, grade(u, v) - 0.21, v],
        [u, top, v],
        [x, top, z],
      ],
      normal,
      c.wallAlt,
    );
    if (level > 0) {
      beam(out, 'trim', [x, top - 0.12, z], [u, top - 0.12, v], 0.13, 0.18, c.trim);
    }
    if (level < 2 || !windows || length < 12) continue;
    const count = Math.round(length / 4.2);
    const at = (k, y) => [
      x + (u - x) * k + normal[0] * 0.04,
      y,
      z + (v - z) * k + normal[2] * 0.04,
    ];
    for (let j = 0; j < count; j++) {
      const a = (j + 0.22) / count,
        b = (j + 0.78) / count;
      face(
        out,
        'glass',
        [at(a, top - 1.91), at(b, top - 1.91), at(b, top - 0.95), at(a, top - 0.95)],
        normal,
        c.glazing,
      );
    }
  }
}

function draw(out, level) {
  court(out);
  for (const wing of plan.dimensions.wings) annex(out, wing, level);
  for (const [i, hall] of plan.dimensions.hangars.entries()) {
    const frame = hallFrame(hall);
    foundations(out, frame);
    shellRoof(out, frame, level, i === 0 ? c.roof : c.roofAlt);
    longWalls(out, frame, level, i === 0 ? c.wall : c.wallAlt);
    gableEnds(out, frame, hall, level, i === 0 ? c.wall : c.wallAlt);
  }
}

export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model,
  slug = id.replaceAll('_', '-');
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
const { camera, lookAt, detailCameras } = plan;
export const model = {
  id,
  key: id,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  category: 'museum-library',
  recipe: `${slug}-model.mjs`,
  recipeDependencies: ['generate-motat-building.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Ditsong’s military museum in Saxonwold, including the two original Bellman exhibition hangars, attached ranges, the Masondo Library and open paths between the buildings.',
  camera,
  lookAt,
  sunDirection: [-39, 72, 44],
  embeddedCanonicalGraphs: [...new Set(Object.values(surfaces).map(({ graph }) => graph))],
  mediumFiContext: {
    scale: 1,
    cameraYaw: 0.68,
    focus: { center: lookAt },
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: detailCameras,
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
    errorMeters: 2.36,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.79, surfaces },
      street: { export: 'street', errorMeters: 0.27, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.1, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Reconstructed from the museum’s written records, published open footprint data and original Terrarium elevation samples.',
};
