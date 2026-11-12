/** The twin-tower residence at Palacio San José, with both mapped open courts. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const {
  polygons: [outer],
  holes,
} = read('map-frame').geometry;
const courts = holes.map((ring) => [...ring].reverse());
const { foundationBottom, galleryFloor, mainEaves, towerCrown, honorFloor, serviceFloor } =
  plan.section;
const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.92, metallic: 0 },
  trim: { slot: 'trim', graph: 'plaster_lime', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'brick_longformat', roughness: 0.94, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.65, metallic: 0.32 },
  pane: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.49, metallic: 0.03 },
};
const tone = Object.fromEntries(
  Object.entries({
    wall: 'c68077',
    trim: 'eee3cb',
    trimShade: 'd4c2a4',
    roof: '99655c',
    court: '9b8c7b',
    iron: '403b35',
    pane: '4c4440',
    door: '423735',
    base: 'ab8777',
    deck: 'c79e82',
  }).map(([name, color]) => [name, rgb(color)]),
);

function face(out, slot, p, wanted, tint = tone[slot]) {
  let normal = normalFor(...p);
  if (normal.reduce((sum, v, i) => sum + v * wanted[i], 0) < 0) {
    p = [...p].reverse();
    normal = normalFor(...p);
  }
  if (p.length === 4) quad(out, slot, p, normal, tint);
  else
    out.addTriangle(
      slot,
      'palette:#ffffff',
      p,
      normal,
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      tint,
    );
}

function cap(out, slot, ring, voids, y, tint = tone[slot]) {
  const local = new MeshBufferBuilder();
  if (
    !local.addCap(
      slot,
      'palette:#ffffff',
      ring,
      voids,
      () => y,
      [0, 1, 0],
      (p) => p,
      tint,
    )
  )
    throw Error('Could not triangulate the palace roof and courts');
  const mesh = local.finalize();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const points = Array.from(mesh.indices.slice(i, i + 3), (j) =>
      Array.from(mesh.positions.slice(j * 3, j * 3 + 3)),
    );
    face(out, slot, points, [0, 1, 0], tint);
  }
}

function edge([x, z], b) {
  const length = Math.hypot(b[0] - x, b[1] - z);
  const dx = (b[0] - x) / length,
    dz = (b[1] - z) / length;
  return {
    length,
    normal: [-dz, 0, dx],
    at: (u, y, d = 0) => [x + dx * u - dz * d, y, z + dz * u + dx * d],
  };
}
const edges = (ring) => ring.map((p, i) => edge(p, ring[(i + 1) % ring.length]));

function panel(out, slot, side, left, right, base, top, offset = 0, tint) {
  if (right - left < 0.002 || top - base < 0.002) return;
  const { at, normal } = side;
  face(
    out,
    slot,
    [
      at(left, base, offset),
      at(right, base, offset),
      at(right, top, offset),
      at(left, top, offset),
    ],
    normal,
    tint,
  );
}

function trim(out, side, left, right, base, top, front, tint = tone.trim) {
  const { at, normal } = side;
  const back = -0.018;
  panel(out, 'trim', side, left, right, base, top, front, tint);
  for (const [y, sign] of [
    [base, -1],
    [top, 1],
  ]) {
    face(
      out,
      'trim',
      [at(left, y, back), at(right, y, back), at(right, y, front), at(left, y, front)],
      [0, sign, 0],
      tint,
    );
  }
  for (const [u, sign] of [
    [left, -1],
    [right, 1],
  ]) {
    face(
      out,
      'trim',
      [at(u, base, back), at(u, base, front), at(u, top, front), at(u, top, back)],
      [normal[2] * sign, 0, -normal[0] * sign],
      tint,
    );
  }
}

function sash(out, side, u, y, w, h, lod) {
  panel(out, 'trim', side, u - w / 2 - 0.12, u + w / 2 + 0.12, y - 0.12, y + h + 0.14, 0.025);
  panel(out, 'pane', side, u - w / 2, u + w / 2, y, y + h, 0.036, tone.pane);
  if (lod >= 1) {
    panel(out, 'trim', side, u - 0.023, u + 0.023, y, y + h, 0.052);
    panel(
      out,
      'trim',
      side,
      u - w / 2,
      u + w / 2,
      y + h * 0.64 - 0.022,
      y + h * 0.64 + 0.022,
      0.052,
    );
  }
  if (lod >= 2) {
    trim(out, side, u - w / 2 - 0.18, u + w / 2 + 0.18, y - 0.15, y - 0.045, 0.21);
    trim(out, side, u - w / 2 - 0.21, u + w / 2 + 0.21, y + h + 0.1, y + h + 0.21, 0.16);
  }
}

function column(out, side, u, bottom, top, lod) {
  const [x, , z] = side.at(u, 0, 0.13);
  const segments = lod < 2 ? 6 : lod === 2 ? 8 : 12;
  const heights =
    lod < 2
      ? [
          [bottom, 0.28],
          [top, 0.24],
        ]
      : [
          [bottom, 0.32],
          [bottom + 0.18, 0.32],
          [bottom + 0.27, 0.23],
          [top - 0.24, 0.19],
          [top - 0.12, 0.28],
          [top, 0.28],
        ];
  const point = (a, [y, r]) => [x + r * Math.cos(a), y, z + r * Math.sin(a)];
  for (let i = 1; i < heights.length; i++) {
    for (let j = 0; j < segments; j++) {
      const a = (j * 2 * Math.PI) / segments,
        b = ((j + 1) * 2 * Math.PI) / segments,
        m = (a + b) / 2;
      face(
        out,
        'trim',
        [
          point(a, heights[i - 1]),
          point(b, heights[i - 1]),
          point(b, heights[i]),
          point(a, heights[i]),
        ],
        [Math.cos(m), 0, Math.sin(m)],
      );
    }
  }
}

function arcade(out, side, start, end, count, floor, lod, front = false) {
  const span = (end - start) / count;
  const shoulder = front ? 3.18 : 2.99,
    radius = span * 0.42;
  const rise = Math.min(radius, front ? 1.62 : 1.41);
  const segments = [3, 5, 10, 14][lod];
  panel(out, 'wall', side, start, end, foundationBottom, floor, 0, tone.base);
  for (let j = 0; j < count; j++) {
    const u = start + (j + 0.5) * span;
    const l = u - radius,
      r = u + radius;
    const { at, normal } = side;
    panel(out, 'wall', side, start + j * span, l, floor, mainEaves);
    panel(out, 'wall', side, r, start + (j + 1) * span, floor, mainEaves);
    for (let i = 1; i <= segments; i++) {
      const a = ((i - 1) * Math.PI) / segments,
        b = (i * Math.PI) / segments;
      const p = (t, extra = 0, d = 0) =>
        at(u - (radius + extra) * Math.cos(t), shoulder + (rise + extra) * Math.sin(t), d);
      const ua = u - radius * Math.cos(a),
        ub = u - radius * Math.cos(b);
      face(out, 'wall', [p(a), p(b), at(ub, mainEaves), at(ua, mainEaves)], normal);
      if (lod || front)
        face(
          out,
          'trim',
          [p(a, 0, 0.045), p(b, 0, 0.045), p(b, 0.12, 0.045), p(a, 0.12, 0.045)],
          normal,
        );
      if (lod > 1)
        face(
          out,
          'trim',
          [p(a, 0, 0.023), p(b, 0, 0.023), p(b, 0, -0.48), p(a, 0, -0.48)],
          [0, -1, 0],
          tone.trimShade,
        );
    }
    for (const [edgeU, sign] of [
      [l, 1],
      [r, -1],
    ]) {
      if (lod > 1)
        face(
          out,
          'wall',
          [
            at(edgeU, floor),
            at(edgeU, shoulder),
            at(edgeU, shoulder, -0.48),
            at(edgeU, floor, -0.48),
          ],
          [normal[2] * sign, 0, -normal[0] * sign],
        );
    }
  }
  if (lod > 1 || front)
    for (let j = 0; j <= count; j++)
      column(out, side, start + j * span, floor, shoulder + 0.04, lod);
}

function gateway(out, side, floor, lod) {
  const { at, normal, length } = side;
  const center = length / 2,
    radius = 1.33,
    shoulder = 2.72,
    rise = 1.32;
  const left = center - radius,
    right = center + radius;
  panel(out, 'wall', side, 0, left, foundationBottom, mainEaves);
  panel(out, 'wall', side, right, length, foundationBottom, mainEaves);
  panel(out, 'wall', side, left, right, foundationBottom, floor, 0, tone.base);
  const count = [4, 6, 14, 14][lod];
  for (let j = 1; j <= count; j++) {
    const a = ((j - 1) * Math.PI) / count,
      b = (j * Math.PI) / count;
    const p = (t, extra = 0, d = 0) =>
      at(center - (radius + extra) * Math.cos(t), shoulder + (rise + extra) * Math.sin(t), d);
    face(
      out,
      'wall',
      [
        p(a),
        p(b),
        at(center - radius * Math.cos(b), mainEaves),
        at(center - radius * Math.cos(a), mainEaves),
      ],
      normal,
    );
    face(
      out,
      'trim',
      [p(a, 0, 0.042), p(b, 0, 0.042), p(b, 0.14, 0.042), p(a, 0.14, 0.042)],
      normal,
    );
  }
  panel(out, 'trim', side, left - 0.14, left, floor, shoulder, 0.042);
  panel(out, 'trim', side, right, right + 0.14, floor, shoulder, 0.042);
}

const front = edges(outer).at(-1);
const northFront = front.at(front.length, 0);
const southFront = front.at(0, 0);
const towerXs = [southFront[0] + 2.92, northFront[0] - 2.92];

function cornice(out, side, lod, ornament = false) {
  if (lod) trim(out, side, 0, side.length, 5.29, 5.46, 0.15);
  trim(out, side, 0, side.length, 5.48, mainEaves + 0.07, 0.27);
  if (ornament && lod >= 2) {
    const count = Math.floor(side.length / 0.62);
    for (let i = 0; i < count; i++) {
      const u = ((i + 0.5) * side.length) / count;
      trim(out, side, u - 0.071, u + 0.071, 5.43, 5.51, 0.205, tone.trimShade);
    }
  }
}

function railing(out, side, lo, hi, base, lod, pierSpacing = 2.5) {
  const { at } = side;
  for (const h of [0.15, 0.71])
    beam(out, 'iron', at(lo, base + h), at(hi, base + h), 0.05, 0.055, tone.iron);
  const spans = Math.max(1, Math.round((hi - lo) / pierSpacing));
  for (let j = 0; j <= spans; j++) {
    const u = lo + ((hi - lo) * j) / spans;
    const [x, , z] = at(u, base);
    B(out, 'wall', x, base, z, 0.25, 0.81, 0.28, tone.wall);
    B(out, 'trim', x, base + 0.79, z, 0.33, 0.085, 0.34, tone.trim);
  }
  if (lod >= 2) {
    const count = Math.max(2, Math.round((hi - lo) / 0.26));
    for (let i = 0; i < count; i++) {
      const u = lo + ((hi - lo) * (i + 0.5)) / count;
      const [x, , z] = at(u, base);
      B(out, 'iron', x, base + 0.15, z, 0.043, 0.56, 0.046, tone.iron);
    }
  }
}

function frontGallery(out, lod) {
  const end = front.length - 5.56;
  panel(out, 'wall', front, 0, 5.56, foundationBottom, mainEaves);
  panel(out, 'wall', front, end, front.length, foundationBottom, mainEaves);
  if (lod) {
    sash(out, front, 2.92, 3.02, 1.05, 1.64, lod);
    sash(out, front, front.length - 2.92, 3.02, 1.05, 1.64, lod);
  }
  face(
    out,
    'roof',
    [
      front.at(5.56, galleryFloor),
      front.at(end, galleryFloor),
      front.at(end, galleryFloor, -4.1),
      front.at(5.56, galleryFloor, -4.1),
    ],
    [0, 1, 0],
    tone.deck,
  );
  arcade(out, front, 5.56, end, 7, galleryFloor, lod, true);
  cornice(out, front, lod, true);
  if (lod) railing(out, front, 5.4, end + 0.14, mainEaves + 0.06, lod);
  else
    panel(
      out,
      'iron',
      front,
      5.4,
      end + 0.14,
      mainEaves + 0.06,
      mainEaves + 0.67,
      0.012,
      tone.iron,
    );
  const back = edge(
    [southFront[0] + 0.14, southFront[2] - 4.1],
    [northFront[0] - 0.14, northFront[2] - 4.1],
  );
  gateway(out, back, galleryFloor, lod);
  for (const shift of [-11.2, -7.9, -4.6, 4.6, 7.9, 11.2])
    sash(out, back, back.length / 2 + shift, 1.25, 1.05, 2.39, lod);
  if (lod)
    for (const u of [-1.25, 1.25])
      column(out, back, back.length / 2 + u * 1.63, galleryFloor, 4.58, lod);
  for (let i = 0; i < 3; i++) {
    const h = 0.16 + ((galleryFloor - 0.16) * (i + 1)) / 3;
    const depth = 1.22 - i * 0.34;
    B(
      out,
      'trim',
      front.at(front.length / 2, 0)[0],
      -0.14,
      40.19 + depth / 2,
      6.15,
      h + 0.14,
      depth + 0.3,
      tone.deck,
    );
  }
}

function tower(out, x, lod) {
  const z = 37.5,
    w = 5.42,
    d = 5.33,
    upper = 11.35;
  const ring = [
    [x - w / 2, z + d / 2],
    [x + w / 2, z + d / 2],
    [x + w / 2, z - d / 2],
    [x - w / 2, z - d / 2],
  ];
  if (lod === 0) {
    B(out, 'wall', x, foundationBottom, z, w, upper - foundationBottom, d, tone.wall);
    B(out, 'trim', x, upper - 0.22, z, w + 0.31, 0.27, d + 0.31, tone.trim);
    B(out, 'iron', x, upper + 0.04, z, w - 0.25, 0.69, d - 0.25, tone.iron);
    for (const [px, pz] of ring)
      B(out, 'wall', px, upper, pz, 0.39, towerCrown - upper, 0.39, tone.wall);
    for (const side of edges(ring))
      panel(
        out,
        'pane',
        side,
        side.length / 2 - 0.53,
        side.length / 2 + 0.53,
        8.19,
        10.15,
        0.034,
        tone.pane,
      );
    return;
  }
  for (const [index, side] of edges(ring).entries()) {
    panel(out, 'wall', side, 0, side.length, foundationBottom, upper);
    if (index !== 0) sash(out, side, side.length / 2, 3.02, 1.05, 1.64, lod);
    sash(out, side, side.length / 2, 8.19, 1.1, 2.05, lod);
    trim(out, side, 0, side.length, 6.51, 6.73, 0.24);
    trim(out, side, 0, side.length, upper - 0.42, upper - 0.27, 0.12);
    trim(out, side, 0, side.length, upper - 0.21, upper + 0.04, 0.26);
    if (lod) {
      for (const u of [0.14, side.length - 0.14])
        panel(out, 'trim', side, u - 0.14, u + 0.14, 6.78, upper - 0.42, 0.031, tone.trimShade);
      const lo = side.length / 2 - 0.83,
        hi = side.length / 2 + 0.83;
      const [a, , b] = side.at(lo, 0, 0.45),
        [c, , d] = side.at(hi, 0, 0.45);
      B(
        out,
        'trim',
        (a + c) / 2,
        8.06,
        (b + d) / 2,
        Math.abs(c - a) + 0.24,
        0.15,
        Math.abs(d - b) + 0.24,
        tone.trimShade,
      );
      if (lod >= 2) railing(out, edge([a, b], [c, d]), 0, hi - lo, 8.19, lod, 1.75);
    }
    railing(out, side, 0, side.length, upper + 0.05, lod, 3.9);
  }
  cap(out, 'roof', ring, [], upper + 0.015);
  for (const [px, pz] of ring)
    B(out, 'wall', px, upper, pz, 0.39, towerCrown - upper, 0.39, tone.wall);
}

function build(out, _frame, lod = 3) {
  const exterior = edges(outer);
  for (let i = 0; i < 3; i++) {
    const side = exterior[i];
    panel(out, 'wall', side, 0, side.length, foundationBottom, mainEaves);
    cornice(out, side, lod);
    const n = Math.round(side.length / 5.55);
    if (lod)
      for (let j = 0; j < n; j++)
        sash(out, side, (side.length * (j + 0.5)) / n, 1.22, 0.98, 2.13, lod);
  }
  frontGallery(out, lod);
  cap(out, 'roof', outer, courts, mainEaves, tone.roof);
  for (const [i, court] of courts.entries()) {
    const floor = i === 0 ? honorFloor : serviceFloor;
    cap(out, 'roof', court, [], floor, tone.court);
    for (const [j, side] of edges(court).entries()) {
      if (j % 2 === 0) gateway(out, side, floor, lod);
      else {
        const count = Math.round(side.length / 4.3);
        arcade(out, side, 0, side.length, count, floor, lod);
        const [x0, , z0] = side.at(0.13, 0, -2.24);
        const [x1, , z1] = side.at(side.length - 0.13, 0, -2.24);
        const backing = edge([x0, z0], [x1, z1]);
        panel(out, 'wall', backing, 0, backing.length, floor - 0.08, mainEaves);
        if (lod)
          for (let j = 0; j < count; j++)
            sash(out, backing, (backing.length * (j + 0.5)) / count, floor + 0.52, 1.13, 2.05, lod);
        face(
          out,
          'roof',
          [
            side.at(0, floor),
            side.at(side.length, floor),
            side.at(side.length, floor, -2.24),
            side.at(0, floor, -2.24),
          ],
          [0, 1, 0],
          tone.court,
        );
      }
    }
  }
  towerXs.forEach((x) => {
    tower(out, x, lod);
  });
}
export const sanJoseSkyline = (out, frame) => build(out, frame, 0);
export const sanJoseDistrict = (out, frame) => build(out, frame, 1);
export const sanJoseStreet = (out, frame) => build(out, frame, 2);
export const sanJoseCloseup = (out, frame) => build(out, frame, 3);

const recipe = 'san-jose-model.mjs';
const camera = [48, 29, 85],
  lookAt = [0, 4, 12];
export const sanJoseModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The pink Italianate residence at Palacio San José in Entre Ríos, with its twin towers, open Tuscan front arcade, and two axial courts.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  buildingCutout: {
    outline: outer,
    minimumCoverage: 0.96,
    basis:
      'Suppresses only the building mass matching the mapped main residence so the two mapped courts remain open.',
  },
  mediumFiContext: {
    scale: 1.64,
    groundY: -0.4,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['stucco', 'plaster_lime', 'brick_longformat', 'metal_painted'],
  qaCameras: [
    { name: 'twin-towers-and-tuscan-arcade', position: [10, 10, 73], lookAt: [0, 5.5, 37] },
    { name: 'open-axial-palace-courtyards', position: [8, 42, 23], lookAt: [0, 2.4, 1] },
    { name: 'terrace-balustrade-and-north-tower', position: [28, 14, 52], lookAt: [10.8, 7.3, 36] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-san-jose-palace-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'sanJoseSkyline',
    errorMeters: 0.41,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'sanJoseDistrict', 0.19],
        ['street', 'sanJoseStreet', 0.08],
        ['closeup', 'sanJoseCloseup', 0.026],
      ].map(([name, exportName, errorMeters]) => [
        name,
        { export: exportName, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. Belgrano released all cited original photographs into the public domain. OpenStreetMap contributors supply the mapped controls under ODbL.',
};
