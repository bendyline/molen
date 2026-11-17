/** Connected Abbey Museum and gallery, aligned with the mapped eastern approach. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  beamPath,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const terrain = read('terrain-grid.json');
const outline = frame.geometry.outline;
const { annexEaveHeight, annexRidgeHeight, frontFloorEstimate, mainEaveHeight, mainRidgeHeight } =
  plan.dimensions;
const pal = 'palette:#ffffff';
const up = [0, 1, 0];
const c = Object.fromEntries(
  Object.entries({
    timber: 'b49b80',
    timberShade: 'a89179',
    board: 'a89e8e',
    boardShade: '9a9283',
    trim: 'd5c8b0',
    foundation: 'a6a294',
    glass: '69797b',
    paleGlass: '849088',
    metal: '6b6d65',
    grey: '747c76',
    seam: '6a6f64',
    backDoor: '696b62',
    lintel: 'beae97',
    pavement: 'aaa397',
    white: 'dbd8c9',
  }).map(([key, value]) => [key, rgb(value)]),
);
const surfaces = {
  boards: { slot: 'wall', graph: 'wood_weatherboard', roughness: 0.91, metallic: 0 },
  addition: { slot: 'wall', graph: 'wood_board_batten', roughness: 0.91, metallic: 0 },
  stone: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  roofing: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.82, metallic: 0.08 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.88, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.54, metallic: 0.03 },
  paint: { slot: 'trim', localRef: pal, roughness: 0.86, metallic: 0 },
};

const [ox, oz] = outline[4];
const dx = outline[5][0] - ox,
  dz = outline[5][1] - oz;
const distance = Math.hypot(dx, dz);
const vx = dx / distance,
  vz = dz / distance;
const ux = -vz,
  uz = vx;
const world = (u, y, v) => [ox + ux * u + vx * v, y, oz + uz * u + vz * v];
const local = ([x, z]) => [(x - ox) * ux + (z - oz) * uz, (x - ox) * vx + (z - oz) * vz];
const p = outline.map(local);
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

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
const ground = ([u, v]) => {
  const [x, , z] = world(u, 0, v);
  return grade(x, z);
};
const floor = (u, v) => frontFloorEstimate + 0.006 * (v - 24) + 0.013 * (u - 20);
const _seamSouth = [p[1][0], p[2][1]];
const galleryCorner = [p[11][0], p[6][1]];
const join = [p[2][0], p[12][1]];
// Cut lines follow the mapped re-entrant corners. Roof subdivisions are estimated.
const sections = [
  {
    ring: [p[4], p[5], p[6], galleryCorner, p[11], p[12], join, p[2], p[3]],
    level: 'main',
    ridge: 7.75,
    axis: 0,
    eave: mainEaveHeight,
    peak: mainRidgeHeight,
    width: 8.73,
    wall: 'boards',
    color: c.timber,
  },
  {
    ring: [p[2], join, p[12], p[0], p[1]],
    level: 'south',
    ridge: 16.82,
    axis: 0,
    eave: annexEaveHeight,
    peak: annexRidgeHeight - 0.27,
    width: 4.48,
    wall: 'boards',
    color: c.timberShade,
  },
  {
    ring: [p[6], p[7], p[8], p[9], p[10], p[11], galleryCorner],
    level: 'gallery',
    ridge: 24.63,
    axis: 1,
    eave: annexEaveHeight,
    peak: annexRidgeHeight,
    width: 3.14,
    wall: 'addition',
    color: c.board,
  },
];

function face(out, slot, points, direction, color, uv = ([x, y, z]) => [x - 0.3 * z, y]) {
  const n = normalFor(...points);
  const flip = n.reduce((sum, value, i) => sum + value * direction[i], 0) < 0;
  out.addConvexPolygon(slot, pal, points, flip ? n.map((v) => -v) : n, uv, color);
}

function roofHeight(section, [u, v]) {
  const point = [u, v];
  return (
    floor(u, v) +
    section.eave +
    (section.peak - section.eave) *
      (1 - Math.min(1, Math.abs(point[section.axis] - section.ridge) / section.width))
  );
}

function ringArea(ring) {
  return ring.reduce((sum, [u, v], i) => {
    const [a, b] = ring[(i + 1) % ring.length];
    return sum + u * b - a * v;
  }, 0);
}

function split(section, sign) {
  const result = [];
  const offset = (p) => sign * (p[section.axis] - section.ridge);
  const { ring } = section;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      da = offset(a),
      db = offset(b);
    if (da >= 0) result.push(a);
    if (da * db < 0) result.push(mix(a, b, da / (da - db)));
  }
  return result;
}

function roof(out, section, lod) {
  const pos = ([u, v]) => world(u, roofHeight(section, [u, v]), v);
  for (const sign of [-1, 1]) {
    const ring = split(section, sign);
    const helper = new MeshBufferBuilder();
    if (
      !helper.addCap(
        'roofing',
        pal,
        ring,
        [],
        () => 0,
        up,
        (p) => p,
        c.grey,
      )
    )
      throw new Error('Museum roof is not triangulable');
    const mesh = helper.finalize();
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const points = Array.from(mesh.indices.slice(i, i + 3), (j) =>
        pos([mesh.positions[3 * j], mesh.positions[3 * j + 2]]),
      );
      face(out, 'roofing', points, up, sign > 0 ? c.grey : c.metal, ([x, _y, z]) => {
        const uv = local([x, z]);
        return [uv[section.axis], uv[1 - section.axis]];
      });
    }
  }
  if (lod === 0) return;
  const ridgePoints = split(section, 1)
    .filter((p) => Math.abs(p[section.axis] - section.ridge) < 0.0001)
    .sort((a, b) => a[1 - section.axis] - b[1 - section.axis]);
  const a = pos(ridgePoints[0]),
    b = pos(ridgePoints.at(-1));
  a[1] += 0.06;
  b[1] += 0.06;
  beam(out, 'roofing', a, b, 0.19, 0.115, c.seam);
}

function edgeFrame(a, b, winding) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const x = (b[0] - a[0]) / length,
    z = (b[1] - a[1]) / length;
  const nx = winding * z,
    nz = -winding * x;
  return {
    length,
    normal: [ux * nx + vx * nz, 0, uz * nx + vz * nz],
    point: (t, y, d = 0) => world(a[0] + x * t + nx * d, y, a[1] + z * t + nz * d),
    uv: ([px, y, pz]) => {
      const [u, v] = local([px, pz]);
      return [u * x + v * z, y];
    },
  };
}

function panel(out, edge, slot, a, b, low, high, depth, color) {
  const p = edge.point;
  face(
    out,
    slot,
    [p(a, low, depth), p(b, low, depth), p(b, high, depth), p(a, high, depth)],
    edge.normal,
    color,
    edge.uv,
  );
}

function windows(out, edge, lod, isGallery) {
  if (edge.length < 8) return;
  const count = isGallery ? 2 : Math.floor(edge.length / 6.0);
  const width = isGallery ? 1.4 : 0.83;
  for (let i = 0; i < count; i++) {
    const x = (edge.length * (i + 1)) / (count + 1);
    const y = isGallery ? 1.07 : 1.77;
    const high = isGallery ? 2.23 : 2.33;
    panel(out, edge, 'glass', x - width / 2, x + width / 2, y, high, 0.025, c.glass);
    if (lod === 0) continue;
    panel(
      out,
      edge,
      'paint',
      x - width / 2 - 0.055,
      x + width / 2 + 0.055,
      high,
      high + 0.072,
      0.046,
      c.metal,
    );
    panel(
      out,
      edge,
      'paint',
      x - width / 2 - 0.055,
      x + width / 2 + 0.055,
      y - 0.065,
      y,
      0.046,
      c.metal,
    );
    if (lod > 1) {
      const p = edge.point;
      for (const offset of [-0.5, 0, 0.5])
        beam(
          out,
          'paint',
          p(x + offset * width, y, 0.047),
          p(x + offset * width, high, 0.047),
          0.059,
          0.059,
          c.metal,
        );
    }
  }
}

function sectionWalls(out, section, lod) {
  const { ring } = section;
  const winding = Math.sign(ringArea(ring));
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const edge = edgeFrame(a, b, winding),
      p = edge.point;
    const floorA = floor(...a),
      floorB = floor(...b);
    const loA = Math.min(ground(a) - 0.24, floorA - 0.26),
      loB = Math.min(ground(b) - 0.24, floorB - 0.26);
    face(
      out,
      'stone',
      [p(0, loA), p(edge.length, loB), p(edge.length, floorB), p(0, floorA)],
      edge.normal,
      c.foundation,
      edge.uv,
    );
    const cuts = [0];
    const da = a[section.axis] - section.ridge,
      db = b[section.axis] - section.ridge;
    if (da * db < 0) cuts.push(da / (da - db));
    cuts.push(1);
    for (let k = 1; k < cuts.length; k++) {
      const first = cuts[k - 1],
        last = cuts[k];
      const s0 = first * edge.length,
        s1 = last * edge.length;
      const aa = mix(a, b, first),
        bb = mix(a, b, last);
      const y0 = roofHeight(section, aa),
        y1 = roofHeight(section, bb);
      face(
        out,
        section.wall,
        [p(s0, floor(...aa)), p(s1, floor(...bb)), p(s1, y1 - 0.06), p(s0, y0 - 0.06)],
        edge.normal,
        section.color,
        edge.uv,
      );
      face(
        out,
        'roofing',
        [p(s0, y0 - 0.18, 0.045), p(s1, y1 - 0.18, 0.045), p(s1, y1, 0.043), p(s0, y0, 0.043)],
        edge.normal,
        c.metal,
        edge.uv,
      );
    }
    if (edge.length > 6 && section.level === 'gallery' && a === ring[1])
      windows(out, edge, lod, true);
    if (section.level === 'main' && [0, 1].includes(i)) windows(out, edge, lod, false);
  }
}

function entrance(out, lod) {
  const [a, b] = plan.dimensions.entranceEdge.map((i) => p[i]);
  const edge = edgeFrame(a, b, Math.sign(ringArea(p))),
    q = edge.point;
  const center = 2.02;
  const y = floor(...mix(a, b, center / edge.length));
  const left = center - 1.43,
    right = center + 1.43;
  const high = y + 2.21;
  const archY = y + 2.13;
  const rx = 1.62,
    ry = 0.71;
  panel(out, edge, 'glass', left, right, y, high, 0.045, c.glass);
  if (lod > 0) {
    const pieces = lod === 3 ? 16 : lod === 2 ? 12 : 8;
    const arc = Array.from({ length: pieces + 1 }, (_, i) => {
      const t = (i * Math.PI) / pieces;
      return q(center + rx * Math.cos(t), archY + ry * Math.sin(t), 0.24);
    });
    beamPath(
      out,
      'trim',
      [q(center + rx, y, 0.24), ...arc, q(center - rx, y, 0.24)],
      0.145,
      0.18,
      c.lintel,
    );
    for (const d of [-1.41, -0.68, 0, 0.68, 1.41])
      beam(out, 'paint', q(center + d, y, 0.08), q(center + d, high, 0.08), 0.068, 0.091, c.metal);
    beam(out, 'paint', q(left, high, 0.082), q(right, high, 0.082), 0.095, 0.11, c.metal);
  }

  const pathway = frame.features[1].points;
  const start = q(center, 0, 0.02);
  const after = pathway.at(-2);
  const end = [after[0], grade(...after) + 0.018, after[1]];
  const dx = end[0] - start[0],
    dz = end[2] - start[2],
    l = Math.hypot(dx, dz);
  const nx = dz / l,
    nz = -dx / l;
  const pad = ([x, y, z], width, sign) => [x + width * nx * sign, y, z + width * nz * sign];
  start[1] = y - 0.008;
  const s0 = pad(start, 1.61, -1),
    s1 = pad(start, 1.61, 1);
  face(
    out,
    'stone',
    [s0, s1, pad(end, 1.16, 1), pad(end, 1.16, -1)],
    up,
    c.pavement,
    ([x, , z]) => [x, z],
  );
  if (lod > 1) {
    for (const [i, sign] of [-1, 1].entries()) {
      const side = i === 0 ? s0 : s1;
      const toe = pad(end, 1.16, sign);
      face(
        out,
        'stone',
        [
          side,
          toe,
          [toe[0], grade(toe[0], toe[2]) - 0.05, toe[2]],
          [side[0], grade(side[0], side[2]) - 0.12, side[2]],
        ],
        [nx * sign, 0, nz * sign],
        c.foundation,
      );
    }
  }
}

function draw(out, lod) {
  for (const section of sections) {
    sectionWalls(out, section, lod);
    roof(out, section, lod);
  }
  entrance(out, lod);
}

export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);
const id = plan.model,
  slug = id.replaceAll('_', '-');
const camera = [40, 30, -43],
  lookAt = [-2, 2.5, 0];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
export const model = {
  id,
  key: id,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe: `${slug}-model.mjs`,
  recipeDependencies: ['generate-motat-building.mjs'],
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Abbey Museum of Art and Archaeology at Caboolture with the connected gallery wing and step-free glazed entrance.',
  camera,
  lookAt,
  sunDirection: [77, 104, -105],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1,
    cameraYaw: 0.92,
    focus: { center: lookAt },
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    {
      name: 'pedestrian-approach-and-glass-entrance',
      position: [23, 4.2, -10],
      lookAt: [10, 1.85, -6],
    },
    { name: 'connected-gallery-and-museum', position: [28, 17, -32], lookAt: [-3, 1.9, 1] },
    { name: 'original-museum-envelope', position: [-39, 16, 22], lookAt: [-2, 2, 1] },
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
    errorMeters: 1.65,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.65, surfaces },
      street: { export: 'street', errorMeters: 0.28, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.095, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Independently modeled from the named building footprint, original public terrain, and written project and access descriptions.',
};
