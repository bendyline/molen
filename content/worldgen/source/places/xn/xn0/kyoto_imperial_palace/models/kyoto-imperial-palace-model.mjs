/** Kyoto's palace halls, tiled gates, courts and continuous roofed enclosure. */
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { buildPalaceGate } from './palace-gates.mjs';
import { buildPalacePerimeter } from './palace-perimeter.mjs';
import { buildShishinden, palaceHipGable } from './shishinden.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const map = read('map-frame.json');
const terrain = read('terrain-grid.json');
const shishinden = read('shishinden-controls.json');
const section = plan.section;
const surfaces = {
  bark: { slot: 'roof', graph: 'wood_painted_shingle', roughness: 0.97, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.91, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95, metallic: 0 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.94, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.95, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.93, metallic: 0.08 },
};
const tint = Object.fromEntries(
  Object.entries({
    wood: '645043',
    dark: '49392e',
    plaster: 'ded0b4',
    red: 'a84635',
    redDark: '873b2d',
    shadow: '544439',
    stone: 'a49b88',
    tile: '636970',
    bark: '655343',
    cream: 'ded4b9',
    foundation: 'a9a294',
    green: '69816b',
    gold: 'b89b61',
  }).map(([k, v]) => [k, rgb(v)]),
);
const mix = (a, b, t) => a + (b - a) * t;
const span = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const mid = (a, b) => [mix(a[0], b[0], 0.5), mix(a[1], b[1], 0.5)];
const xyz = ([x, z], y) => [x, y, z];
const edgeFrame = (out, a, b) =>
  transform(out, -Math.atan2(b[1] - a[1], b[0] - a[0]), [a[0], 0, a[1]]);
const signed = (p) =>
  p.reduce((sum, [x, z], i) => {
    const [a, b] = p[(i + 1) % p.length];
    return sum + x * b - a * z;
  }, 0);
const outward = (p) => (signed(p) > 0 ? p : p.toReversed());

function ground([x, z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const a = Math.floor(u),
    b = Math.floor(v),
    h = terrain.heightsMeters;
  return (
    mix(mix(h[b][a], h[b][a + 1], u - a), mix(h[b + 1][a], h[b + 1][a + 1], u - a), v - b) -
    terrain.modelDatumElevationMeters
  );
}

function bounds(points) {
  const x = points.map((p) => p[0]),
    z = points.map((p) => p[1]);
  return [Math.min(...x), Math.min(...z), Math.max(...x), Math.max(...z)];
}
const dimensions = ([left, front, right, back]) => [right - left, back - front];
const middle = ([left, front, right, back]) => [(left + right) / 2, (front + back) / 2];

function triangulate(ring) {
  const out = new MeshBufferBuilder();
  if (
    !out.addCap(
      'tile',
      'palette:#ffffff',
      ring,
      [],
      () => 0,
      [0, 1, 0],
      (p) => p,
      tint.tile,
    )
  )
    throw Error('Kyoto palace roof polygon could not be triangulated');
  const mesh = out.finalize();
  return Array.from({ length: mesh.indices.length / 3 }, (_, i) =>
    Array.from(mesh.indices.slice(i * 3, i * 3 + 3), (j) => [
      mesh.positions[j * 3],
      mesh.positions[j * 3 + 2],
    ]),
  ).filter((p) => Math.abs(signed(p)) > 1e-5);
}

function stableRing(ring, tolerance) {
  const clean = ring.filter((p, i) => span(p, ring.at(i - 1)) > 0.035);
  return clean.filter((p, i) => {
    const a = clean.at(i - 1),
      b = clean[(i + 1) % clean.length];
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz);
    if (len < 0.12) return true;
    const along = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len;
    const side = Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / len;
    return side > tolerance || along < 0 || along > len;
  });
}

/** Divide a bent roof plan into longitudinal bays without filling its court or reentrant corners. */
function roofBays(ring) {
  const box = bounds(ring);
  const [w, d] = dimensions(box);
  if (Math.abs(signed(ring)) / 2 > w * d * 0.82) return [box];
  const nodes = ring.map((p) => p[0]).sort((a, b) => a - b);
  const cuts = nodes.filter((x, i) => i === 0 || x - nodes[i - 1] > 0.85);
  if (nodes.at(-1) - cuts.at(-1) > 0.36) cuts.push(nodes.at(-1));
  const result = [];
  for (let i = 1; i < cuts.length; i++) {
    const a = cuts[i - 1],
      b = cuts[i],
      x = (a + b) / 2,
      z = [];
    if (b - a < 1.06) continue;
    for (let j = 0; j < ring.length; j++) {
      const p = ring[j],
        q = ring[(j + 1) % ring.length];
      if (p[0] < x !== q[0] < x) z.push(mix(p[1], q[1], (x - p[0]) / (q[0] - p[0])));
    }
    z.sort((p, q) => p - q);
    for (let j = 1; j < z.length; j += 2) {
      const near = z[j - 1],
        far = z[j];
      if (far - near < 1.52 || (b - a) * (far - near) < 12) continue;
      const previous = result.find(
        (r) => Math.abs(r[2] - a) < 0.28 && Math.abs(r[1] - near) < 1 && Math.abs(r[3] - far) < 1,
      );
      if (previous) previous[2] = b;
      else result.push([a, near, b, far]);
    }
  }
  return result
    .sort((a, b) => {
      const [aw, ad] = dimensions(a),
        [bw, bd] = dimensions(b);
      return bw * bd - aw * ad;
    })
    .slice(0, 9);
}
const openCourt = new Set(section.court.vermilionRanges);
const perimeterWays = new Set(section.court.borderWayIds.map((id) => 'way/' + id));
const detailRoles = new Set(Object.keys(section.signatureHalls));
const gateRoles = new Set(section.gates.map((g) => g.role));
const selected = map.features.filter(
  ({ id, role }) =>
    !perimeterWays.has(id) &&
    !gateRoles.has(role) &&
    !['gekkamon-gate-roof', 'shishinden'].includes(role),
);

const halls = selected.map(({ id, role, points }) => {
  const ring = outward(stableRing(points, 0.032));
  const area = Math.abs(signed(ring)) / 2;
  const footprint = bounds(ring);
  const wall = role === 'roofed-wall';
  const front = openCourt.has(id);
  const info = section.signatureHalls[role] ?? {};
  const named = detailRoles.has(role);
  const floor = ground(middle(footprint)) + (named ? 0.51 : 0.26);
  const height =
    info.height ?? (wall ? 2.56 : front ? 3.57 : area > 300 ? 4.28 : area > 70 ? 3.69 : 2.86);
  const rise =
    info.rise ?? (wall ? 0.73 : front ? 1.91 : area > 300 ? 3.2 : area > 70 ? 2.17 : 1.56);
  return {
    id,
    role,
    ring,
    area,
    footprint,
    wall,
    front,
    named,
    floor,
    height,
    rise,
    info,
    bays: roofBays(ring),
    cap: triangulate(ring),
  };
});

const gates = section.gates.map((g) => {
  const { points } = map.features.find((f) => f.role === g.role);
  const footprint = bounds(points),
    center = middle(footprint),
    dims = dimensions(footprint);
  const aligned = Math.abs(Math.cos(g.rotation)) > 0.5;
  return {
    ...g,
    center,
    heading: g.rotation,
    floor: ground(center) + 0.15,
    width: dims[aligned ? 0 : 1],
    depth: dims[aligned ? 1 : 0],
  };
});

const square = (w, d, y) => [
  [-w, y, -d],
  [-w, y, d],
  [w, y, d],
  [w, y, -d],
];
function lightRoof(out, w, d, y, rise, ceramic, lod) {
  const slot = ceramic ? 'tile' : 'bark',
    color = ceramic ? tint.tile : tint.bark;
  const a = square(w / 2, d / 2, y);
  const b = square(w * 0.36, Math.max(0.09, d * 0.035), y + rise);
  const lip = square(w * 0.45, d * 0.348, y + rise * 0.16);
  for (const [low, high] of lod === 0
    ? [[a, b]]
    : [
        [a, lip],
        [lip, b],
      ])
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      face(out, slot, [low[i], low[j], high[j], high[i]], color);
    }
  face(out, slot, b, color);
}

function renderableRoofBays(out, hall, lod) {
  const { floor, height, rise, wall, named, front, info, bays } = hall;
  const eaves = floor + height;
  for (const [i, bay] of bays.entries()) {
    const [x, z] = middle(bay),
      [w, d] = dimensions(bay);
    const heading = info.roofHeading ?? (d > w ? Math.PI / 2 : 0);
    const east = Math.abs(Math.cos(heading)) > 0.5;
    const frame = transform(out, heading, [x, 0, z]);
    const long = east ? w : d,
      short = east ? d : w;
    const roofRise = Math.min(rise * (i === 0 ? 1 : 0.78), Math.max(1.12, short * 0.54));
    const observedBark = named && info.style !== 'reception';
    const ceramic = !observedBark && (wall || front || !named || hall.role === 'okurumayose');
    const first = named && i === 0;
    if (first && lod > 0) {
      palaceHipGable(
        frame,
        {
          width: long + 1.28,
          depth: short + 0.86,
          eaves,
          ridge: eaves + roofRise,
          ceramic,
          expressedSkirt: hall.role === 'seiryoden',
        },
        lod === 3 ? 2 : 0,
      );
    } else {
      lightRoof(frame, long + 0.76, short + 0.56, eaves, roofRise, ceramic, lod === 3 ? 1 : 0);
    }
  }
}

function panel(out, slot, x0, x1, y0, y1, z, color) {
  face(
    out,
    slot,
    [
      [x1, y0, z],
      [x0, y0, z],
      [x0, y1, z],
      [x1, y1, z],
    ],
    color,
  );
}

function roomFacade(out, a, b, hall, lod) {
  const { floor, height, named, front, info } = hall;
  const length = span(a, b);
  if (length < 2.6) return;
  const edge = edgeFrame(out, a, b);
  const eave = floor + height;
  const wood = front ? tint.red : tint.wood;
  const divisions = Math.round(length / (front ? 3.0 : named ? 3.25 : 4.65));
  const n = Math.max(1, divisions);
  const spacing = length / n;
  const wide = Math.abs(a[0] - b[0]) < Math.abs(a[1] - b[1]);
  const isOpen = info.openFront && wide && a[1] < b[1];
  if (isOpen)
    box(edge, 'timber', [0, floor - 0.42, -1.52], [length, floor + 0.41, 0.19], tint.wood);
  panel(edge, 'timber', 0, length, eave - 0.54, eave - 0.18, -0.04, wood);
  if (isOpen) panel(edge, 'timber', 0, length, eave - 1.06, eave - 0.81, -0.061, tint.green);
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) * spacing,
      post = i * spacing + 0.075;
    if (lod === 3 && (front || named))
      box(
        edge,
        'timber',
        [post - 0.095, floor - 0.05, isOpen ? -1.23 : -0.17],
        [post + 0.095, eave - 0.4, isOpen ? -1.04 : 0.1],
        wood,
      );
    else panel(edge, 'timber', post - 0.063, post + 0.063, floor - 0.01, eave - 0.4, -0.041, wood);
    const w = Math.min(spacing * 0.32, named ? 1.1 : 0.74);
    const bottom = floor + (front ? 0.24 : 0.9),
      top = eave - (front ? 0.61 : 1.34);
    if (!front || i % 3 === 1) {
      panel(edge, 'timber', x - w, x + w, bottom, top, -0.048, front ? tint.redDark : tint.shadow);
      if (lod > 1 && (named || front)) {
        const bars = lod === 3 ? 5 : 2;
        for (let j = 1; j <= bars; j++) {
          const l = mix(x - w, x + w, j / (bars + 1));
          panel(edge, 'timber', l - 0.018, l + 0.018, bottom, top, -0.051, wood);
        }
      }
    }
    if (named && lod > 1)
      panel(
        edge,
        'timber',
        x - w - 0.08,
        x + w + 0.08,
        bottom - 0.09,
        bottom + 0.03,
        -0.068,
        tint.dark,
      );
    if (isOpen && lod > 1)
      panel(edge, 'timber', x - w, x + w, floor + 0.82, floor + 0.91, -1.21, tint.wood);
  }
}

function distantHall(out, hall, lod) {
  const { floor, height, rise, area, named, front } = hall;
  const top = floor + height;
  const ceramic = !named || hall.info.style === 'reception';
  const slot = ceramic ? 'tile' : 'bark';
  const roofTint = ceramic ? tint.tile : tint.bark;
  const walled = front ? tint.redDark : tint.plaster;
  const bay = hall.bays[0] ?? hall.footprint;
  const change = dimensions(bay);
  const roof = (footprint) => {
    const [x, z] = middle(footprint),
      [w, d] = dimensions(footprint);
    const frame = transform(out, d > w ? Math.PI / 2 : 0, [x, 0, z]);
    lightRoof(
      frame,
      Math.max(w, d) + 0.42,
      Math.min(w, d) + 0.45,
      top,
      Math.min(rise, Math.min(w, d) * 0.48),
      ceramic,
      0,
    );
  };
  if (lod === 0) {
    const [x, z] = middle(bay);
    box(
      out,
      'plaster',
      [x - change[0] / 2, floor - 0.72, z - change[1] / 2],
      [x + change[0] / 2, top, z + change[1] / 2],
      walled,
    );
    roof(bay);
    return;
  }
  const ring = outward(stableRing(hall.ring, 0.51));
  if (ring.length < 3) return;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const foot = (p) => Math.min(floor - 0.15, ground(p) - 0.72);
    face(out, 'plaster', [xyz(b, foot(b)), xyz(a, foot(a)), xyz(a, top), xyz(b, top)], walled);
  }
  for (const f of triangulate(ring))
    triangle(
      out,
      slot,
      f.map((p) => xyz(p, top)),
      roofTint,
    );
  for (const part of area > 300 || named || front ? hall.bays.slice(0, 4) : [bay]) roof(part);
}

function mappedHall(out, hall, lod) {
  const { ring, floor, height, wall, front, named, area } = hall;
  const eave = floor + height;
  const col = front || named ? tint.cream : tint.plaster;
  if (lod === 3 && area > 34)
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      const base = (p) => Math.min(floor - 0.15, ground(p) - 0.69);
      face(
        out,
        'stone',
        [xyz(b, base(b)), xyz(a, base(a)), xyz(a, floor), xyz(b, floor)],
        tint.foundation,
      );
      face(out, 'plaster', [xyz(b, floor), xyz(a, floor), xyz(a, eave), xyz(b, eave)], col);
    }
  else
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      const base = (p) => Math.min(floor - 0.15, ground(p) - 0.69);
      face(out, 'plaster', [xyz(b, base(b)), xyz(a, base(a)), xyz(a, eave), xyz(b, eave)], col);
    }
  if (!wall && (named || front || (lod === 3 && area > 58)))
    for (let i = 0; i < ring.length; i++)
      roomFacade(out, ring[i], ring[(i + 1) % ring.length], hall, lod);
  for (const f of hall.cap)
    triangle(
      out,
      named ? 'bark' : 'tile',
      f.map((p) => xyz(p, eave)),
      named ? tint.bark : tint.tile,
    );
  renderableRoofBays(out, hall, lod);
}

function sandCourt(out, lod) {
  if (lod === 0) return;
  const [x0, z0, x1, z1] = section.court.rect;
  const n = lod === 3 ? 8 : 5;
  for (let x = 0; x < n; x++)
    for (let z = 0; z < n; z++) {
      const corner = (u, v) => [mix(x0, x1, u / n), mix(z0, z1, v / n)];
      const pts = [corner(x, z), corner(x, z + 1), corner(x + 1, z + 1), corner(x + 1, z)];
      const p = pts.map((a) => xyz(a, ground(a) + 0.13));
      triangle(out, 'plaster', [p[0], p[1], p[2]], tint.cream);
      triangle(out, 'plaster', [p[0], p[2], p[3]], tint.cream);
    }
}

function build(out, lod) {
  sandCourt(out, lod);
  buildPalacePerimeter(out, { bounds: section.bounds, gates, ground }, lod);
  for (const gate of gates) buildPalaceGate(out, gate, lod);
  for (const hall of halls)
    if (lod > 1) mappedHall(out, hall, lod);
    else if (hall.named || hall.front || hall.area >= [415, 89][lod]) distantHall(out, hall, lod);
  buildShishinden(out, shishinden, lod);
}

export const palaceSkyline = (out) => build(out, 0);
export const palaceDistrict = (out) => build(out, 1);
export const palaceStreet = (out) => build(out, 2);
export const palaceCloseup = (out) => build(out, 3);
const camera = [276, 249, 477],
  lookAt = [9, 1, 20];
const recipe = 'kyoto-imperial-palace-model.mjs';
export const palaceModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: palaceCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Kyoto Imperial Palace in April 2017, with Shishinden, Seiryoden, Kogosho and Otsunegoten, the connecting galleries, white-sand ceremonial court and the roofed gates set into the plaster perimeter.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-40, 66, 81],
  mediumFiContext: {
    scale: 1,
    groundY: -2.7,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'wood_painted_shingle',
    'tile_ceramic',
    'plaster_lime',
    'wood_plain',
    'stone_ashlar',
    'metal_painted',
  ],
  qaCameras: [
    { name: 'shishinden-and-south-garden', position: [-29, 9.6, 187], lookAt: [-9, 6.8, 124] },
    { name: 'kenreimon-and-shomeimon', position: [-9, 8.2, 260], lookAt: [-9, 5.8, 216] },
    { name: 'nikkamon-and-ceremonial-cloisters', position: [54, 11, 131], lookAt: [22, 4.3, 156] },
    { name: 'seiryoden-east-veranda', position: [-15, 8.3, 97], lookAt: [-47, 3.8, 99] },
    { name: 'residential-courtyards', position: [114, 45, 54], lookAt: [47, 4.3, -23] },
    {
      name: 'north-entrance-and-empress-residence',
      position: [44, 21, -251],
      lookAt: [14, 4.3, -192],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'kyoto-palace-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'palaceSkyline',
    errorMeters: 0.58,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'palaceDistrict', 0.28],
        ['street', 'palaceStreet', 0.12],
        ['closeup', 'palaceCloseup', 0.046],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. All six exact Qualla reference photographs are creator-released CC0. Native OpenStreetMap geometry under ODbL 1.0.',
};
