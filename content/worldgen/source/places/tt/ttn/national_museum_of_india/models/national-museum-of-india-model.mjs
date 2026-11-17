/** The standing Janpath museum and its open sculpture courtyard. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const terrain = read('terrain-grid.json');
const features = new Map(
  read('map-frame.json').features.map(({ id, points }) => [
    Number(id.slice(id.indexOf('/') + 1)),
    points,
  ]),
);
const outline = (id) => features.get(id).slice(0, -1);
const pal = 'palette:#ffffff';
const front = [0, 0, 1];
const up = [0, 1, 0];
const colors = Object.fromEntries(
  Object.entries({
    pale: 'cfc0a6',
    warm: 'c4b597',
    edge: 'dcccb0',
    shadowStone: 'a59277',
    brown: 'a77869',
    deepPink: 'a68378',
    pink: 'b99688',
    gray: '9f9788',
    rock: 'a09b90',
    roof: 'aaa89e',
    blackBlue: '53646a',
    glazing: '565e60',
    screen: '87746a',
    steel: '8a8f8b',
    wood: '716b62',
    green: '637954',
    hedge: '899464',
    water: '658a91',
    bluePaint: '617f93',
  }).map(([label, hex]) => [label, rgb(hex)]),
);
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.93, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.91, metallic: 0 },
  plinth: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.97, metallic: 0 },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.93, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.55, metallic: 0.02 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.86, metallic: 0.08 },
  paving: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.95, metallic: 0 },
  shade: { slot: 'window', localRef: pal, roughness: 0.84, metallic: 0 },
};
const mix = (a, b, t) => a + (b - a) * t;
const blend = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
const xyz = ([x, z], y) => [x, y, z];
const dist = ([a, b], [x, z]) => Math.hypot(x - a, z - b);
const area = (ring) =>
  ring.reduce((sum, [x, z], i) => {
    const [a, b] = ring[(i + 1) % ring.length];
    return sum + x * b - z * a;
  }, 0);
const center = (ring) => [0, 1].map((i) => ring.reduce((sum, p) => sum + p[i], 0) / ring.length);

function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const a = terrain.heightsMeters[j],
    b = terrain.heightsMeters[j + 1];
  return (
    mix(mix(a[i], a[i + 1], u - i), mix(b[i], b[i + 1], u - i), v - j) -
    terrain.modelDatumElevationMeters
  );
}

function face(out, slot, vertices, desired, color) {
  const n = normalFor(...vertices);
  const d = n.reduce((sum, f, i) => sum + f * desired[i], 0);
  out.addConvexPolygon(
    slot,
    pal,
    vertices,
    d < 0 ? n.map((v) => -v) : n,
    ([x, y, z]) => [x - z, y],
    color,
  );
}

function cap(out, slot, ring, y, color, holes = []) {
  const geometry = new MeshBufferBuilder();
  if (
    !geometry.addCap(
      slot,
      pal,
      ring,
      holes,
      () => y,
      up,
      (p) => p,
      color,
    )
  )
    throw Error('Invalid Janpath museum polygon');
  const baked = geometry.finalize();
  for (let i = 0; i < baked.indices.length; i += 3) {
    const vertices = Array.from(baked.indices.slice(i, i + 3), (j) =>
      Array.from(baked.positions.slice(j * 3, j * 3 + 3)),
    );
    face(out, slot, vertices, up, color);
  }
}

function frame([x, z], normal) {
  const [nx, nz] = normal.map((v) => v / Math.hypot(...normal));
  return {
    p: (u, y, v) => [x + nz * u + nx * v, y, z - nx * u + nz * v],
    n: ([u, y, v]) => [nz * u + nx * v, y, -nx * u + nz * v],
  };
}

function oriented(out, axes) {
  return {
    addQuad(slot, ref, vertices, normal, uv, color) {
      out.addQuad(
        slot,
        ref,
        vertices.map((p) => axes.p(...p)),
        axes.n(normal),
        uv,
        color,
      );
    },
    addConvexPolygon(slot, ref, vertices, normal, uv, color) {
      out.addConvexPolygon(
        slot,
        ref,
        vertices.map((p) => axes.p(...p)),
        axes.n(normal),
        uv,
        color,
      );
    },
  };
}

function edge(a, b, sign) {
  return frame(blend(a, b, 0.5), [sign * (b[1] - a[1]), sign * (a[0] - b[0])]);
}

function panel(out, slot, x, y, z, w, h, color) {
  quad(
    out,
    slot,
    [
      [x, y, z],
      [x + w, y, z],
      [x + w, y + h, z],
      [x, y + h, z],
    ],
    front,
    color,
  );
}

function opening(out, x, y, z, width, height, lod, strips = 3) {
  const half = width / 2;
  panel(
    out,
    'shade',
    x - half - 0.065,
    y - 0.052,
    z,
    width + 0.13,
    height + 0.104,
    colors.shadowStone,
  );
  panel(out, 'glass', x - half, y, z + 0.012, width, height, colors.glazing);
  if (lod < 2) return;
  panel(out, 'metal', x - half, y + height * 0.71, z + 0.027, width, 0.038, colors.steel);
  for (let i = 1; i < strips; i++)
    panel(
      out,
      'metal',
      x - half + (width * i) / strips - 0.021,
      y,
      z + 0.031,
      0.042,
      height,
      colors.steel,
    );
}

function walls(out, ring, roofY, floor, inner = false, color = colors.pale) {
  const sign = Math.sign(area(ring)) * (inner ? -1 : 1);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const outwards = edge(a, b, sign).n(front);
    const baseA = Math.min(ground(...a) - 0.46, floor - 0.2);
    const baseB = Math.min(ground(...b) - 0.46, floor - 0.2);
    face(
      out,
      'plinth',
      [xyz(a, baseA), xyz(b, baseB), xyz(b, floor + 0.7), xyz(a, floor + 0.7)],
      outwards,
      colors.rock,
    );
    face(
      out,
      'stone',
      [xyz(a, floor + 0.7), xyz(b, floor + 0.7), xyz(b, roofY), xyz(a, roofY)],
      outwards,
      color,
    );
  }
}

function stoneBand(out, width, y, h, depth, color, lod) {
  if (lod === 1) panel(out, 'trim', -width / 2, y, depth, width, h, color);
  else box(out, 'trim', [-width / 2, y, 0.01], [width / 2, y + h, depth], color);
}

function parapet(out, ring, y, lod, inward = false) {
  const sign = Math.sign(area(ring)) * (inward ? -1 : 1);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      span = dist(a, b);
    if (span < 1.0) continue;
    const local = oriented(out, edge(a, b, sign));
    const height = plan.dimensions.parapetMeters;
    if (lod === 1) {
      panel(local, 'trim', -span / 2, y - 0.02, 0.048, span, height + 0.02, colors.edge);
      face(
        local,
        'trim',
        [
          [-span / 2, y + height, 0.048],
          [span / 2, y + height, 0.048],
          [span / 2, y + height, -0.32],
          [-span / 2, y + height, -0.32],
        ],
        up,
        colors.edge,
      );
    } else {
      box(local, 'trim', [-span / 2, y - 0.12, -0.37], [span / 2, y + height, 0.048], colors.edge);
    }
  }
}

const museumFloor = plan.dimensions.mainExteriorFloorMeters;
const annexFloor = plan.dimensions.oldAsiExteriorFloorMeters;
const courtFloorY = plan.dimensions.courtyardPavingHeightMeters;
const frontDoor = features.get(11816215887)[0];
const entryAxes = frame(frontDoor, [-0.999, -0.047]);
const court = outline(1243005415);

function nearDoor(a, b) {
  return Math.min(dist(a, frontDoor), dist(b, frontDoor)) < 0.02;
}

function facade(out, ring, floor, height, lod, isAnnex) {
  const sign = Math.sign(area(ring));
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      length = dist(a, b);
    if (length < 3.5) continue;
    const local = oriented(out, edge(a, b, sign));
    if (lod > 0) {
      for (const h of [1.03, 4.36, 8.41, height - 0.35])
        stoneBand(
          local,
          length - 0.05,
          floor + h,
          0.16,
          0.112,
          h === 1.03 ? colors.brown : colors.edge,
          lod,
        );
    }
    if (nearDoor(a, b) || (lod === 0 && length < 17)) continue;
    const spacing = lod === 0 ? 8.6 : lod === 1 ? 5.18 : 3.78;
    const bays = Math.max(1, Math.round(length / spacing));
    const size = length / bays;
    for (let j = 0; j < bays; j++) {
      const x = size * (j + 0.5 - bays / 2);
      const w = size * 0.66;
      if (isAnnex || i % 5 !== 2) opening(local, x, floor + 1.52, 0.074, w, 1.76, lod);
      if (lod > 0) {
        opening(local, x, floor + 5.03, 0.045, w, 1.87, lod);
        opening(
          local,
          x,
          floor + (isAnnex ? 9.72 : 9.28),
          0.059,
          w * 0.75,
          isAnnex ? 2.34 : 1.12,
          lod,
        );
      }
      if (lod > 1 && size > 2.5)
        box(
          local,
          'stone',
          [x + size * 0.5 - 0.14, floor + 0.84, 0.025],
          [x + size * 0.5 + 0.08, floor + 8.12, 0.2],
          colors.pale,
        );
    }
  }
}

function mainEntrance(out, lod) {
  const local = oriented(out, entryAxes);
  const y = plan.dimensions.approachFloorMeters;
  box(local, 'stone', [-10.6, y + 3.74, -0.46], [10.6, y + 4.41, 4.33], colors.warm);
  box(local, 'trim', [-10.75, y + 4.37, -0.46], [10.75, y + 4.61, 4.34], colors.edge);
  for (const x of [-9.53, -3.23, 3.23, 9.53]) {
    box(local, 'stone', [x - 0.43, y + 0.02, 3.12], [x + 0.43, y + 3.77, 3.96], colors.pale);
    if (lod > 0)
      box(local, 'trim', [x - 0.49, y + 0.01, 3.06], [x + 0.49, y + 0.23, 4.02], colors.edge);
  }
  const steps = lod === 0 ? 2 : lod === 3 ? 6 : 4;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    box(
      local,
      'paving',
      [-10.5 - 0.17 * i, y - 1.02, 0.5 + 4.14 * t],
      [10.5 + 0.17 * i, y + 0.01 - 0.64 * t, 0.51 + (4.14 * (i + 1)) / steps],
      colors.deepPink,
    );
  }
  for (const [x, w] of [
    [-7, 3.11],
    [-2.3, 3.9],
    [2.96, 3.9],
    [7.18, 3.11],
  ])
    opening(local, x, y + 0.06, 0.185, w, 3.11, lod, 4);
  if (lod > 1) {
    const awningPanels = 11;
    for (let i = 1; i < awningPanels; i++) {
      const x = 21.2 * (i / awningPanels - 0.5);
      panel(local, 'trim', x, y + 3.8, 4.341, 0.049, 0.52, colors.shadowStone);
    }
  }
}

function circle([x, z], radius, count) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i * 2 * Math.PI) / count;
    return [x + radius * Math.cos(angle), z + radius * Math.sin(angle)];
  });
}

function cylinder(out, slot, origin, bottom, top, radius, count, color, capped = true) {
  const ring = circle(origin, radius, count);
  for (let i = 0; i < count; i++) {
    const a = ring[i],
      b = ring[(i + 1) % count];
    const n = [a[0] + b[0] - 2 * origin[0], 0, a[1] + b[1] - 2 * origin[1]];
    face(out, slot, [xyz(a, bottom), xyz(b, bottom), xyz(b, top), xyz(a, top)], n, color);
  }
  if (capped)
    face(
      out,
      slot,
      ring.map((p) => xyz(p, top)),
      up,
      color,
    );
}

function courtyardFacade(out, roofY, lod) {
  const side = -Math.sign(area(court));
  const y = courtFloorY + 0.08;
  const segments = lod === 0 ? court.filter((_, i) => i % 2 === 0) : court;
  for (let i = 0; i < segments.length; i++) {
    const a = segments[i],
      b = segments[(i + 1) % segments.length];
    const w = dist(a, b);
    const local = oriented(out, edge(a, b, side));
    const alternate = i % 4 === 2;
    if (lod > 0) {
      for (const offset of [0.87, 4.18, 8.45, roofY - y - 0.38])
        stoneBand(local, w, y + offset, 0.13, 0.18, offset < 0.9 ? colors.brown : colors.edge, lod);
    }
    for (const offset of [1.06, 5.02]) {
      if (alternate && lod > 0) {
        box(
          local,
          'trim',
          [-0.56, y + offset + 0.12, 0.019],
          [0.56, y + offset + 1.72, 0.186],
          colors.brown,
        );
        panel(local, 'shade', -0.39, y + offset + 0.22, 0.192, 0.78, 1.38, colors.screen);
        if (lod > 1)
          for (let j = 0; j < 4; j++)
            for (let k = 0; k < 6; k++)
              panel(
                local,
                'trim',
                -0.33 + j * 0.173,
                y + offset + 0.34 + k * 0.2,
                0.198,
                0.06,
                0.06,
                colors.edge,
              );
      } else opening(local, 0, y + offset, 0.048, Math.min(4.4, w * 0.8), 2.92, lod, 3);
    }
    if (lod > 0) {
      opening(local, 0, roofY - 2.35, 0.044, Math.min(1.23, w * 0.48), 1.08, lod, 2);
      const pillar = w / 2 - 0.05;
      for (const [lo, hi] of [
        [1.04, 4.09],
        [5.02, 8.07],
      ]) {
        if (lod === 1)
          box(
            local,
            'trim',
            [pillar - 0.14, y + lo, -0.05],
            [pillar + 0.12, y + hi, 0.21],
            colors.edge,
          );
        else {
          const axes = edge(a, b, side);
          const [x, , z] = axes.p(pillar, 0, 0.086);
          cylinder(
            out,
            'trim',
            [x, z],
            y + lo,
            y + hi,
            0.16,
            lod === 2 ? 5 : 9,
            colors.edge,
            false,
          );
          cylinder(out, 'stone', [x, z], y + hi - 0.15, y + hi, 0.194, 6, colors.pale, false);
        }
      }
    }
  }
}

function courtFloor(out, lod) {
  const y = plan.dimensions.courtyardPavingHeightMeters;
  cap(out, 'paving', court, y, colors.pink);
  const font = features.get(12917149347)[0];
  const detail = [10, 14, 20, 28][lod];
  cylinder(out, 'plinth', font, y, y + 0.19, 2.31, detail, colors.gray);
  cylinder(out, 'metal', font, y + 0.18, y + 0.51, 1.73, detail, colors.bluePaint);
  cylinder(out, 'shade', font, y + 0.505, y + 0.516, 1.53, detail, colors.water);
  if (lod === 0) return;
  const flowering = [
    [6.7, 5.6, 3.95, 2.15],
    [-0.63, 3.48, 3.24, 1.6],
    [10.2, -1.98, 3.19, 1.64],
  ];
  for (const [x, z, w, h] of flowering) {
    const ring = circle([x, z], 1, lod === 3 ? 16 : 10).map(([a, b]) => [
      x + ((a - x) * w) / 2,
      z + ((b - z) * h) / 2,
    ]);
    cap(out, 'shade', ring, y + 0.075, colors.hedge);
    if (lod > 1)
      for (const side of [-1, 1])
        cylinder(
          out,
          'shade',
          [x + side * w * 0.27, z],
          y + 0.03,
          y + 0.43,
          w * 0.12,
          7,
          colors.green,
        );
  }
  for (const [x, z] of [
    [-1, -5.7],
    [7.2, -8.1],
    [17.3, 3.45],
    [5.2, 11.45],
  ]) {
    box(out, 'plinth', [x - 0.47, y, z - 0.47], [x + 0.47, y + 0.55, z + 0.47], colors.gray);
  }
}

function services(out, y, lod) {
  for (const [x, z, w, h] of [
    [-21, -13, 6.3, 1.42],
    [11, -14.85, 7.25, 1.48],
    [32, -46, 8.4, 1.72],
  ]) {
    box(out, 'stone', [x - w / 2, y - 0.07, z - 2.08], [x + w / 2, y + h, z + 2.08], colors.pale);
    box(
      out,
      'roof',
      [x - w / 2 - 0.1, y + h - 0.01, z - 2.18],
      [x + w / 2 + 0.1, y + h + 0.16, z + 2.18],
      colors.roof,
    );
  }
  cylinder(out, 'metal', [14.1, -14.6], y + 1.52, y + 3.18, 1.36, lod === 0 ? 8 : 16, colors.pale);
  if (lod > 1) {
    for (const [x, z, w] of [
      [37, 17, 6.6],
      [-38, -35, 6.4],
      [-29, 0, 4.9],
    ]) {
      box(
        out,
        'metal',
        [x - w / 2, y - 0.012, z - 0.91],
        [x + w / 2, y + 0.65, z + 0.91],
        colors.steel,
      );
      for (let i = 0; i < 4; i++)
        panel(
          out,
          'shade',
          x - w / 2 + 0.3,
          y + 0.14 + i * 0.11,
          z + 0.921,
          w - 0.6,
          0.032,
          colors.blackBlue,
        );
    }
  }
}

const building = outline(44186070);
const annex = outline(378259127);
const serviceCourts = [1272478682, 1272478683, 1272478684].map(outline);
const annexCourt = outline(1243005414);

function draw(out, lod) {
  const mainY = museumFloor + plan.dimensions.museumEaveMeters;
  const annexY = annexFloor + plan.dimensions.oldAsiEaveMeters;
  walls(out, building, mainY, museumFloor);
  facade(out, building, museumFloor, plan.dimensions.museumEaveMeters, lod, false);
  walls(out, court, mainY, courtFloorY - 0.16, true);
  for (const hole of serviceCourts) walls(out, hole, mainY, museumFloor, true, colors.warm);
  cap(out, 'roof', building, mainY, colors.roof, [court, ...serviceCourts]);
  if (lod > 0) {
    parapet(out, building, mainY, lod);
    parapet(out, court, mainY, lod, true);
  }
  mainEntrance(out, lod);
  courtyardFacade(out, mainY, lod);
  courtFloor(out, lod);
  services(out, mainY, lod);
  walls(out, annex, annexY, annexFloor, false, colors.warm);
  facade(out, annex, annexFloor, plan.dimensions.oldAsiEaveMeters, lod, true);
  walls(out, annexCourt, annexY, annexFloor, true);
  cap(out, 'roof', annex, annexY, colors.roof, [annexCourt]);
  if (lod > 0) {
    parapet(out, annex, annexY, lod);
    parapet(out, annexCourt, annexY, lod, true);
  }
}

export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [-151, 96, 160];
const lookAt = [-2, 4, 18];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
const inner = center(court);

export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe: slug + '-model.mjs',
  recipeDependencies: ['generate-motat-building.mjs'],
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  groundCutout: {
    outline: court,
    minHeight: courtFloorY - 0.46,
    basis:
      'The original composite elevation samples cross the mapped open sculpture courtyard. Terrain clearance is limited to its native courtyard outline and preserves all source elevations.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Janpath National Museum of India with its sandstone bays, open circular sculpture court and adjoining old Archaeological Survey of India block.',
  camera,
  lookAt,
  sunDirection: [-125, 135, 96],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1,
    cameraYaw: 0.27,
    focus: { center: lookAt },
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'janpath-entrance-and-facade', position: [-104, 13.5, -17], lookAt: [-48, 6, -4] },
    {
      name: 'circular-sculpture-courtyard',
      position: [inner[0] - 7.1, 5.61, inner[1] + 5.4],
      lookAt: [inner[0] + 5.4, 6.11, inner[1] - 3.3],
    },
    {
      name: 'north-galleries-and-polygonal-footprint',
      position: [47, 46, -110],
      lookAt: [0, 5, -17],
    },
    {
      name: 'old-archaeological-survey-of-india-wing',
      position: [83, 34, 144],
      lookAt: [24, 6, 62],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: slug + '-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 2.75,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 1.1, surfaces },
      street: { export: 'street', errorMeters: 0.41, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.13, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Independent geographic reconstruction using a creator-dedicated public-domain Qualla photo, ODbL map controls and the unchanged Terrarium elevation field.',
};
