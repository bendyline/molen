/** Standing Tamozawa Imperial Villa in Nikkō, with courtyard wings and its taller Edo residence. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (file) => JSON.parse(fs.readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const { outline, holes } = read('map-frame.json').geometry;
const d = plan.dimensions;
const surfaces = {
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.85, metallic: 0.16 },
  verge: { slot: 'trim', graph: 'wood_plain', roughness: 0.9, metallic: 0 },
  wall: { slot: 'wall', graph: 'wood_vertical', roughness: 0.92, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.96, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.45, metallic: 0 },
};
const c = Object.fromEntries(
  Object.entries({
    roof: '667a82',
    ridge: '687d83',
    wood: '654f3e',
    verge: '4a3d34',
    deck: '826b55',
    stone: '93897c',
    white: 'b7a88e',
    glass: '7d827f',
    shadow: '4e4640',
  }).map(([key, hex]) => [key, rgb(hex)]),
);
const crossXZ = (a, b) => a[0] * b[1] - a[1] * b[0];
const area = (ring) => ring.reduce((sum, p, i) => sum + crossXZ(p, ring[(i + 1) % ring.length]), 0);
const orient = (ring, positive) => (area(ring) > 0 === positive ? ring : [...ring].reverse());
const rings = [orient(outline, true), ...holes.map((ring) => orient(ring, false))];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const mid = (a, b) => [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5];
const span = (a, b) => {
  const length = dist(a, b);
  return { a, b, length, dx: (b[0] - a[0]) / length, dz: (b[1] - a[1]) / length };
};
const roofEdges = rings.flatMap((r) => r.map((p, i) => span(p, r[(i + 1) % r.length])));
const capBuilder = new MeshBufferBuilder();
if (
  !capBuilder.addCap(
    'copper',
    'palette:#ffffff',
    rings[0],
    rings.slice(1),
    () => 0,
    [0, 1, 0],
    (p) => p,
    c.roof,
  )
)
  throw Error('Tamozawa roof outline or courtyard geometry did not triangulate');
const cap = capBuilder.finalize();
const triangulated = Array.from({ length: cap.indices.length / 3 }, (_, i) =>
  Array.from(cap.indices.slice(i * 3, i * 3 + 3), (index) => [
    cap.positions[index * 3],
    cap.positions[index * 3 + 2],
  ]),
);

/** Split shared edges at the same midpoint so the pitched roof remains continuous. */
function refineRoof(triangles, reach) {
  for (;;) {
    let subdivided = false;
    const next = [];
    for (const vertices of triangles) {
      const edge = vertices.map((p, i) => dist(p, vertices[(i + 1) % 3]) > reach);
      const count = edge.filter(Boolean).length;
      if (!count) {
        next.push(vertices);
        continue;
      }
      subdivided = true;
      if (count === 3) {
        const [a, b, c] = vertices;
        const ab = mid(a, b),
          bc = mid(b, c),
          ca = mid(c, a);
        next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
        continue;
      }
      const start = edge.indexOf(count === 1);
      const a = vertices[start],
        b = vertices[(start + 1) % 3],
        c = vertices[(start + 2) % 3];
      if (count === 1) {
        const ab = mid(a, b);
        next.push([a, ab, c], [ab, b, c]);
        continue;
      }
      const bc = mid(b, c),
        ca = mid(c, a);
      next.push([a, b, bc], [a, bc, ca], [ca, bc, c]);
    }
    if (!subdivided) return next;
    triangles = next;
  }
}

function roofY([x, z]) {
  let nearest = Infinity;
  for (const { a, length, dx, dz } of roofEdges) {
    const t = Math.max(0, Math.min(length, (x - a[0]) * dx + (z - a[1]) * dz));
    nearest = Math.min(nearest, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t));
  }
  const rise = d.singleStoreyRidgeY - d.singleStoreyEavesY;
  const profile = 1 + nearest * 0.26;
  return d.singleStoreyEavesY + rise * (1 - 1 / (profile * profile));
}
function triangle(out, slot, points, color) {
  const normal = normalFor(...points);
  out.addTriangle(
    slot,
    'palette:#ffffff',
    points,
    normal,
    points.map(([x, , z]) => [x, z]),
    color,
  );
}
function face(out, slot, points, color) {
  quad(out, slot, points, normalFor(...points), color);
}
function connectedRoof(out, level) {
  const faces = refineRoof(triangulated, [22.5, 9.35, 4.1, 2.65][level]);
  const elevations = new Map();
  for (const paving of faces) {
    const points = paving.map(([x, z]) => {
      const key = x + '/' + z;
      if (!elevations.has(key)) elevations.set(key, roofY([x, z]));
      return [x, elevations.get(key), z];
    });
    if (normalFor(...points)[1] < 0) points.reverse();
    triangle(out, 'copper', points, c.roof);
  }
}

function at({ a, dx, dz }, u, y, o = 0) {
  return [a[0] + dx * u + dz * o, y, a[1] + dz * u - dx * o];
}
function panel(out, slot, e, u0, u1, y0, y1, offset, color) {
  face(
    out,
    slot,
    [at(e, u1, y0, offset), at(e, u0, y0, offset), at(e, u0, y1, offset), at(e, u1, y1, offset)],
    color,
  );
}
function deck(out, slot, e, u0, u1, y, inner, outer, color) {
  face(
    out,
    slot,
    [at(e, u0, y, inner), at(e, u1, y, inner), at(e, u1, y, outer), at(e, u0, y, outer)],
    color,
  );
}
function insetWall(ring, depth) {
  return ring.map((p, i) => {
    const before = span(ring.at(i - 1), p);
    const after = span(p, ring[(i + 1) % ring.length]);
    const inset = Math.min(depth, Math.min(before.length, after.length) * 0.31);
    const angle = 1 + before.dx * after.dx + before.dz * after.dz;
    const miter = inset / Math.max(0.47, angle);
    return [p[0] - (before.dz + after.dz) * miter, p[1] + (before.dx + after.dx) * miter];
  });
}
const wallRings = rings.map((ring, index) => insetWall(ring, index ? 0.36 : 0.58));
function screen(out, edge, start, end, y0, y1, level, offset = 0) {
  const lo = start + 0.12,
    hi = end - 0.12;
  if (hi - lo < 0.43) return;
  panel(out, 'glass', edge, lo, hi, y0, y1, offset + 0.035, c.glass);
  if (level < 2) return;
  const dividers = level === 3 ? 5 : 2;
  for (let i = 1; i < dividers; i++) {
    const u = lo + ((hi - lo) * i) / dividers;
    panel(out, 'verge', edge, u - 0.022, u + 0.022, y0, y1, offset + 0.049, c.verge);
  }
  const crossbars = level === 3 ? [0.22, 0.5, 0.76] : [0.54];
  for (const v of crossbars) {
    const y = y0 + (y1 - y0) * v;
    panel(out, 'verge', edge, lo, hi, y - 0.022, y + 0.022, offset + 0.05, c.verge);
  }
}

function veranda(out, level) {
  for (const [group, ring] of rings.entries()) {
    const inner = wallRings[group];
    for (let i = 0; i < ring.length; i++) {
      const j = (i + 1) % ring.length;
      const eave = span(ring[i], ring[j]);
      const wall = span(inner[i], inner[j]);
      if (level === 0) {
        panel(out, 'wall', eave, 0, eave.length, d.foundationY, d.singleStoreyEavesY, 0, c.wood);
        continue;
      }
      panel(
        out,
        'verge',
        eave,
        0,
        eave.length,
        d.singleStoreyEavesY - 0.2,
        d.singleStoreyEavesY + 0.035,
        0.008,
        c.verge,
      );
      face(
        out,
        'verge',
        [
          at(eave, 0, d.singleStoreyEavesY - 0.2),
          at(eave, eave.length, d.singleStoreyEavesY - 0.2),
          at(wall, wall.length, d.singleStoreyEavesY - 0.2),
          at(wall, 0, d.singleStoreyEavesY - 0.2),
        ],
        c.verge,
      );
      panel(out, 'wall', wall, 0, wall.length, d.verandaY, d.singleStoreyEavesY, 0, c.wood);
      panel(out, 'stone', wall, 0, wall.length, d.foundationY, d.verandaY - 0.14, 0.002, c.stone);
      const fac = group ? 0.23 : 0.42;
      deck(out, 'wall', wall, 0, wall.length, d.verandaY + 0.003, -0.03, fac, c.deck);
      panel(out, 'verge', wall, 0, wall.length, d.verandaY - 0.17, d.verandaY + 0.02, fac, c.verge);
      const bays = Math.max(1, Math.round(wall.length / [0, 4.5, 2.6, 2.18][level]));
      const width = wall.length / bays;
      for (let k = 0; k < bays; k++) {
        const u0 = width * k,
          u1 = width * (k + 1);
        if ((k + i * 2 + group) % 7 < 5) {
          screen(out, wall, u0, u1, d.verandaY + 0.31, d.singleStoreyEavesY - 0.78, level);
        } else if (width > 0.66) {
          panel(
            out,
            'plaster',
            wall,
            u0 + 0.15,
            u1 - 0.15,
            d.verandaY + 0.32,
            d.singleStoreyEavesY - 0.79,
            0.024,
            c.white,
          );
        }
        if (level > 1 && width > 0.48) {
          const u = u0 + 0.057;
          panel(
            out,
            'verge',
            wall,
            u - 0.053,
            u + 0.053,
            d.verandaY + 0.02,
            d.singleStoreyEavesY - 0.28,
            0.065,
            c.verge,
          );
          panel(
            out,
            'stone',
            wall,
            u - 0.12,
            u + 0.12,
            d.verandaY - 0.63,
            d.verandaY - 0.17,
            fac + 0.004,
            c.stone,
          );
        }
      }
    }
  }
}

function rectangle(x, z, w, depth) {
  return [
    [x - w / 2, z - depth / 2],
    [x + w / 2, z - depth / 2],
    [x + w / 2, z + depth / 2],
    [x - w / 2, z + depth / 2],
  ];
}
function upperStorey(out, center, width, depth, floor, eaves, level) {
  const shell = rectangle(...center, width, depth);
  for (const [i, p] of shell.entries()) {
    const wall = span(p, shell[(i + 1) % 4]);
    panel(out, 'wall', wall, 0, wall.length, floor, eaves, 0, c.wood);
    panel(out, 'verge', wall, 0, wall.length, floor + 0.2, floor + 0.34, 0.035, c.verge);
    if (level === 0) continue;
    const bays = Math.round(wall.length / 1.9);
    for (let k = 0; k < bays; k++)
      screen(
        out,
        wall,
        (k * wall.length) / bays,
        ((k + 1) * wall.length) / bays,
        floor + 0.59,
        eaves - 0.4,
        level,
      );
  }
}
function pavilionRoof(out, center, width, depth, eave, ridge, level) {
  const profiles =
    level < 2
      ? [
          [0, 1, 1],
          [0.44, 0.82, 0.48],
          [1, 0.66, 0.014],
        ]
      : [
          [0, 1, 1],
          [0.13, 0.95, 0.83],
          [0.42, 0.83, 0.52],
          [0.76, 0.72, 0.21],
          [1, 0.65, 0.014],
        ];
  const levels = profiles.map(([height, x, z]) =>
    rectangle(...center, width * x, depth * z).map(([u, v]) => [
      u,
      eave + (ridge - eave) * height,
      v,
    ]),
  );
  for (let i = 1; i < levels.length; i++) {
    const lower = levels[i - 1],
      upper = levels[i];
    for (let j = 0; j < 4; j++) {
      const k = (j + 1) % 4;
      const points = [lower[k], lower[j], upper[j], upper[k]];
      face(out, 'copper', points, c.roof);
    }
  }
  face(out, 'copper', [...levels.at(-1)].reverse(), c.ridge);
  const verge = levels[0];
  for (let j = 0; j < 4; j++) {
    const k = (j + 1) % 4;
    face(
      out,
      'verge',
      [
        [verge[k][0], eave - 0.18, verge[k][2]],
        [verge[j][0], eave - 0.18, verge[j][2]],
        verge[j],
        verge[k],
      ],
      c.verge,
    );
  }
}
function residentialPavilion(out, level) {
  const center = d.highPavilionCenter;
  upperStorey(out, center, 13.4, 8.25, 4.85, 8.04, level);
  pavilionRoof(out, center, 15.0, 9.63, 8.01, 10.55, level);
  upperStorey(out, center, 8.25, 5.25, 8.3, d.highPavilionUpperEavesY, level);
  pavilionRoof(
    out,
    center,
    10.4,
    6.7,
    d.highPavilionUpperEavesY - 0.02,
    d.highPavilionRidgeY,
    level,
  );
  const secondary = d.secondaryPavilionCenter;
  upperStorey(out, secondary, 6.1, 7.0, 4.87, 7.15, level);
  pavilionRoof(out, secondary, 7.84, 8.72, 7.13, 9.04, level);
}
function draw(out, level) {
  connectedRoof(out, level);
  veranda(out, level);
  residentialPavilion(out, level);
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [97, 46, 100];
const lookAt = [-10, 3.8, 9];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe: `${slug}-model.mjs`,
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The restored Tamozawa Imperial Villa with its joined blue-gray copper roofs, dark wood verandas, small courtyards and the taller residence incorporated into the complex.',
  camera,
  lookAt,
  sunDirection: [80, 122, 64],
  recipeDependencies: ['generate-motat-building.mjs'],
  embeddedCanonicalGraphs: [
    'metal_copper',
    'wood_plain',
    'wood_vertical',
    'stone_limestone_weathered',
    'plaster_lime',
  ],
  mediumFiContext: {
    scale: 1,
    cameraYaw: -0.72,
    groundY: 0.52,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'garden-and-central-residence', position: [72, 27, 87], lookAt },
    { name: 'timber-veranda-and-eaves', position: [49, 7, 57], lookAt: [29, 4.0, 33] },
    { name: 'connected-courtyard-roofs', position: [2, 68, -15], lookAt: [-5, 2.1, 10] },
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
    errorMeters: 1.85,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.88, surfaces },
      street: { export: 'street', errorMeters: 0.29, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.1, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original reconstruction using verified CC0 Qualla originals, native outline and courts, original Japanese GSI elevation, and the prefectural and villa operator’s written records.',
};
