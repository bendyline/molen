import { readFileSync } from 'node:fs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  extrude,
  facade,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const site = read('native-map/bahla-fort-shape-controls');
const surfaces = {
  adobe: { slot: 'wall', graph: 'earth_adobe', roughness: 0.98 },
  rubble: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.99 },
  coping: { slot: 'trim', graph: 'plaster_lime', roughness: 0.94 },
  terrace: { slot: 'roof', graph: 'earth_rammed', roughness: 0.98 },
  shadow: { slot: 'window', localRef: 'palette:#59483a', roughness: 1 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.94 },
};
const colors = {
  adobe: rgb('b3a080'),
  north: rgb('c0ad8c'),
  house: rgb('b7a27f'),
  rubble: rgb('8d7d64'),
  coping: rgb('c3af8a'),
  terrace: rgb('9f8968'),
  shadow: rgb('504031'),
  timber: rgb('66513a'),
};
const tint = (base, seed) =>
  base.map((channel) => channel * (0.91 + ((17 * seed + 23) % 13) * 0.012));
const at = ([x, z], y) => [x, y, z];
const mix = (a, b, t) => a + (b - a) * t;
const curtain = outwardRing(site.curtain);
const sourceIndices = curtain.map((point) => site.curtain.indexOf(point));
const ground = sourceIndices.map((i) => site.terrainAtCurtain[i]);
const crest = sourceIndices.map(
  (i) =>
    [
      12, 13.7, 14.9, 16.2, 14.7, 14.1, 14.2, 15.4, 17.1, 17.8, 18.1, 16.7, 16.6, 16.2, 15.2, 13.9,
      12.9, 12.1, 12.3, 12.2, 11.1, 10.4, 10.4,
    ][i],
);
const inset = curtain.map((p, i) => {
  const prev = wallFace(curtain.at(i - 1), p).normal;
  const next = wallFace(p, curtain[(i + 1) % curtain.length]).normal;
  const x = prev[0] + next[0];
  const z = prev[1] + next[1];
  const inverse = 1 / Math.max(0.9, Math.hypot(x, z));
  return [p[0] - x * 2.15 * inverse, p[1] - z * 2.15 * inverse];
});

function plane(out, slot, face, left, right, bottom, top, depth, color) {
  quad4(
    out,
    slot,
    face.P(left, bottom, depth),
    face.P(right, bottom, depth),
    face.P(right, top, depth),
    face.P(left, top, depth),
    color,
  );
}

function door(out, face, u, bottom, top, lod) {
  const radius = 1.38;
  const spring = bottom + 2.05;
  const arc = roundArch(radius, lod ? 8 : 4);
  const timber = (x, y) => face.P(u + x, y, -1.15);
  const upper = (x, y) => face.P(u + x, y, 0.08);
  plane(out, 'timber', face, u - radius, u + radius, bottom, spring, -1.15, colors.timber);
  for (let i = 1; i < arc.length; i++) {
    const [a, ya] = arc[i - 1];
    const [b, yb] = arc[i];
    tri(
      out,
      'timber',
      timber(0, spring),
      timber(b, spring + yb),
      timber(a, spring + ya),
      colors.timber,
    );
    quad4(
      out,
      'adobe',
      upper(a, spring + ya),
      upper(b, spring + yb),
      upper(b, top),
      upper(a, top),
      colors.adobe,
    );
    quad4(
      out,
      'rubble',
      upper(b, spring + yb),
      upper(a, spring + ya),
      timber(a, spring + ya),
      timber(b, spring + yb),
      tint(colors.rubble, i),
    );
  }
  for (const x of [-radius, radius]) {
    const a = upper(x, bottom);
    const b = upper(x, spring);
    const c = timber(x, spring);
    const d = timber(x, bottom);
    if (x < 0) quad4(out, 'rubble', d, c, b, a, colors.rubble);
    else quad4(out, 'rubble', a, b, c, d, colors.rubble);
  }
  if (lod > 1)
    for (const x of [-0.88, -0.43, 0, 0.43, 0.88])
      plane(
        out,
        'shadow',
        face,
        u + x - 0.025,
        u + x + 0.025,
        bottom,
        spring,
        -1.145,
        colors.shadow,
      );
}

function wallCurtain(out, lod) {
  for (const [i, a] of curtain.entries()) {
    const j = (i + 1) % curtain.length;
    const b = curtain[j];
    const face = wallFace(a, b);
    const ya = crest[i];
    const yb = crest[j];
    const lowerA = ground[i] - 2.1;
    const lowerB = ground[j] - 2.1;
    const stoneA = ground[i] + 3.15;
    const stoneB = ground[j] + 3.15;
    const shade = tint(colors.adobe, i);
    const gate = sourceIndices[i] === 22 && sourceIndices[j] === 21;
    const exterior = (slot, from, to, aLow, bLow, aHigh, bHigh, color) =>
      quad4(
        out,
        slot,
        face.P(from, aLow, 0),
        face.P(to, bLow, 0),
        face.P(to, bHigh, 0),
        face.P(from, aHigh, 0),
        color,
      );
    if (gate) {
      const length = face.length;
      const center = length * 0.62;
      const bottom = mix(ground[i], ground[j], 0.62) + 0.15;
      const left = center - 1.38;
      const right = center + 1.38;
      const doorTop = Math.min(ya, yb) - 0.13;
      const leftCrest = mix(ya, yb, left / length);
      const rightCrest = mix(ya, yb, right / length);
      exterior('adobe', 0, left, lowerA, bottom - 1.5, ya, leftCrest, shade);
      exterior('adobe', right, length, bottom - 1.5, lowerB, rightCrest, yb, shade);
      exterior('adobe', left, right, doorTop, doorTop, leftCrest, rightCrest, shade);
      exterior('rubble', left, right, bottom - 1.5, bottom - 1.5, bottom, bottom, colors.rubble);
      door(out, face, center, bottom, doorTop, lod);
    } else {
      exterior('rubble', 0, face.length, lowerA, lowerB, stoneA, stoneB, tint(colors.rubble, i));
      exterior('adobe', 0, face.length, stoneA, stoneB, ya, yb, shade);
    }
    quad4(
      out,
      'adobe',
      at(inset[j], stoneB - 1.1),
      at(inset[i], stoneA - 1.1),
      at(inset[i], ya),
      at(inset[j], yb),
      tint(shade, 5),
    );
    tri(out, 'coping', at(a, ya), at(b, yb), at(inset[j], yb), colors.coping);
    tri(out, 'coping', at(a, ya), at(inset[j], yb), at(inset[i], ya), colors.coping);
    if (lod < 1 || face.length < 6) continue;
    const count = Math.floor(face.length / (lod > 1 ? 4 : 6));
    for (let k = 0; k < count; k++) {
      const t = (k + 0.51) / count;
      const u = t * face.length;
      const y = mix(ya, yb, t);
      if ((i + 2 * k) % 5 !== 1) {
        const span = 0.46 + ((i + k) % 3) * 0.11;
        const h = 0.45 + ((i + 3 * k) % 5) * 0.12;
        const crestY = (Math.abs(ya - yb) * span) / face.length + 0.055;
        fbox(out, 'adobe', face, u - span, u + span, y - crestY, y + h, -1.05, -0.12, shade);
      }
      if (lod > 1 && (!gate || Math.abs(u - face.length * 0.62) > 2.2)) {
        const h = (i + k) % 4 === 3 ? 0.79 : 0.47;
        plane(
          out,
          'shadow',
          face,
          u - 0.105,
          u + 0.105,
          y - 2.8,
          y - 2.8 + h,
          0.015,
          colors.shadow,
        );
      }
      if (lod > 2) masonry(out, face, u, mix(stoneA, stoneB, t), i * 7 + k);
    }
  }
}

const compounds = [
  {
    // Qasabah rises above the inner court and the northern curtain.
    outline: [
      [-42, -12],
      [-20, -32],
      [4, -44],
      [17, -48],
      [22, -37],
      [13, -19],
      [-12, -16],
      [-24, -7],
    ],
    base: 4.5,
    terrace: 11.6,
    roof: 20.5,
    parapet: 0.93,
    color: colors.north,
    holes: [
      [
        [-15, -23],
        [4, -34],
        [9, -30],
        [2, -23],
        [-14, -19],
      ],
    ],
  },
  {
    // Bayt al-Jabal follows the higher eastern part of the enclosure.
    outline: [
      [15, -10],
      [23, -36],
      [38, -48],
      [50, -44],
      [53, -23],
      [45, -7],
      [31, -3],
    ],
    base: 4.2,
    terrace: 10.45,
    roof: 17.75,
    parapet: 1.05,
    color: colors.house,
    holes: [
      [
        [30, -32],
        [39, -39],
        [45, -34],
        [44, -23],
        [35, -15],
        [28, -20],
      ],
    ],
  },
  {
    // The later residence is a lower group around an irregular southern court.
    outline: [
      [15, 11],
      [30, 8],
      [47, 14],
      [49, 24],
      [39, 48],
      [20, 46],
      [12, 34],
    ],
    base: 3,
    terrace: 7.1,
    roof: 13.5,
    parapet: 0.86,
    color: colors.adobe,
    holes: [
      [
        [23, 19],
        [35, 15],
        [42, 21],
        [35, 37],
        [25, 35],
        [20, 28],
      ],
    ],
  },
];

function masonry(out, F, u, y, seed) {
  const palette = [colors.rubble, colors.adobe, colors.north];
  for (let k = 0; k < 3; k++) {
    const x = u + (k - 1) * 0.62 + ((seed + k) % 4) * 0.07;
    const yy = y - 0.2 - ((4 * seed + 5 * k) % 9) * 0.23;
    const half = 0.18 + ((seed * 4 + k) % 5) * 0.05;
    plane(
      out,
      'rubble',
      F,
      x - half,
      x + half,
      yy,
      yy + 0.14,
      0.025,
      tint(palette[k], (seed + k) % 21),
    );
  }
}

function residence(out, block, lod) {
  const ring = outwardRing(block.outline);
  extrude(out, 'rubble', ring, block.base - 2.4, block.terrace, colors.rubble, {
    topSlot: 'terrace',
    topColor: colors.terrace,
  });
  extrude(out, 'adobe', ring, block.terrace - 0.025, block.roof, block.color, {
    holes: block.holes,
    topSlot: 'terrace',
    topColor: colors.terrace,
  });
  for (const [i, point] of ring.entries()) {
    const face = wallFace(point, ring[(i + 1) % ring.length]);
    if (lod || i % 2 === 0)
      fbox(
        out,
        'adobe',
        face,
        0.04,
        face.length - 0.04,
        block.roof - 0.08,
        block.roof + block.parapet - (i % 3) * 0.19,
        -0.68,
        0,
        tint(block.color, i),
      );
    if (!lod || face.length < 6) continue;
    const count = Math.max(1, Math.floor(face.length / 4.1));
    for (let k = 0; k < count; k++) {
      const u = face.length * ((k + 0.54) / count);
      const y = block.roof - (i % 3 === 1 ? 2.9 : 2.5);
      const width = (i + k) % 3 === 1 ? 0.48 : 0.77;
      const h = 1.1 + ((i + k) % 3) * 0.18;
      if (lod > 1) {
        opening(out, face, u, y, width, h, {
          head: i % 3 === 0 ? 'round' : 'flat',
          frameSlot: 'coping',
          glassSlot: 'shadow',
          frame: block.color,
          glass: colors.shadow,
          frameWidth: 0.08,
          d: 0.027,
        });
        plane(out, 'shadow', face, u - 0.12, u + 0.12, y - 2.95, y - 2.55, 0.012, colors.shadow);
      } else
        plane(out, 'shadow', face, u - width / 2, u + width / 2, y, y + h, 0.012, colors.shadow);
      if (lod > 2) {
        masonry(out, face, u, block.terrace, 9 * i + k);
        fbox(
          out,
          'timber',
          face,
          u + 1,
          u + 1.13,
          block.roof - 0.61,
          block.roof - 0.49,
          0,
          0.24 + (k % 3) * 0.09,
          colors.timber,
        );
      }
    }
  }
}

const towers = [
  { center: [-56.3, 6.55], radius: 5.95, foot: 1, top: 28.6, crown: 0.94, wind: true },
  { center: [22.4, -58.7], radius: 4.58, foot: 4.5, top: 21.7, crown: 0.86 },
  { center: [55.75, -49.7], radius: 5.15, foot: 3.5, top: 20.5, crown: 0.78 },
  { center: [-34.9, 29.15], radius: 3.18, foot: -0.8, top: 15.7, crown: 0.64 },
];

function tower(out, t, lod) {
  const count = [t.wind ? 8 : 6, 16, 24, 32][lod];
  const r = t.radius;
  const shoulder = r * (t.wind ? 0.73 : 0.85);
  const plinth = t.foot + (t.wind ? 7.05 : 4.3);
  lathe(
    out,
    'rubble',
    t.center,
    [
      [t.foot - 1.8, r, r],
      [plinth, r * 0.87, r * 0.87],
    ],
    count,
    colors.rubble,
    { capTop: false },
  );
  lathe(
    out,
    'adobe',
    t.center,
    [
      [plinth, r * 0.87, r * 0.87],
      [t.top - 2.1, shoulder, shoulder],
      [t.top, shoulder * 1.025, shoulder * 1.025],
    ],
    count,
    t.wind ? colors.north : colors.adobe,
  );
  if (lod)
    lathe(
      out,
      'coping',
      t.center,
      [
        [t.top - 1.84, shoulder * 1.025, shoulder * 1.025],
        [t.top - 1.61, shoulder * 1.025, shoulder * 1.025],
      ],
      count,
      colors.coping,
      { capTop: false },
    );
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const f = facade(
      [t.center[0] + c * shoulder * 1.016, t.center[1] + s * shoulder * 1.016],
      [s, -c],
    );
    if ((t.wind || lod > 0) && i % (lod > 1 ? 2 : 1) === 0) {
      const half = ((Math.PI * shoulder) / count) * (lod > 1 ? 0.91 : 0.52);
      const height = t.crown * (0.7 + ((i * 7) % 5) * 0.062);
      fbox(
        out,
        'adobe',
        f,
        -half,
        half,
        t.top - 0.18,
        t.top + height * 0.7,
        -0.68,
        0.025,
        tint(colors.north, i),
      );
      if (t.wind || lod > 1)
        tri(
          out,
          'coping',
          f.P(-half, t.top + height * 0.7, 0.025),
          f.P(half, t.top + height * 0.7, 0.025),
          f.P(0, t.top + height, -0.12),
          colors.coping,
        );
    }
    if (lod > 1 && i % (count / 4) === 0) {
      const y = t.top - (t.wind ? 4.95 : 5.4);
      const aperture = t.wind ? 0.38 : 0.18;
      const body = t.wind ? 0.21 : 0.13;
      plane(
        out,
        'shadow',
        f,
        -aperture,
        aperture,
        y,
        y + (t.wind ? 1.08 : 0.65),
        body,
        colors.shadow,
      );
    }
  }
}

function elevatedGallery(out, lod) {
  const F = facade([-17.3, -33.2], [-0.854, 0.52]);
  fbox(out, 'adobe', F, -8.9, 8.7, 17.1, 23.05, -4.8, 0, colors.north);
  fbox(out, 'adobe', F, -9.15, -7.4, 18.8, 25.95, -5.4, 0.38, colors.adobe);
  fbox(out, 'adobe', F, 7.5, 9.05, 18.8, 25.22, -5.4, 0.28, colors.adobe);
  fbox(out, 'adobe', facade([8.2, -45.7], [1, 0]), -2.7, 2.9, 17.6, 22.6, -5.3, 0, colors.adobe);
  if (!lod) return;
  for (const u of [-5.35, -2.8, 0, 2.81, 5.48]) {
    opening(out, F, u, 20.04, 1.36, 2.21, {
      head: 'round',
      frameSlot: 'coping',
      glassSlot: 'shadow',
      frame: colors.coping,
      glass: colors.shadow,
      frameWidth: 0.13,
      d: 0.025,
    });
    fbox(out, 'timber', F, u - 0.67, u + 0.67, 20.65, 20.78, 0.018, 0.11, colors.timber);
    if (lod > 1)
      fbox(out, 'timber', F, u - 0.66, u + 0.66, 21.19, 21.28, 0.018, 0.097, colors.timber);
  }
}

function approaches(out, lod) {
  extrude(
    out,
    'rubble',
    [
      [-53, 12],
      [-43, 4],
      [-27, -4],
      [-20, 8],
      [-25, 22],
      [-38, 23],
    ],
    0.4,
    7.5,
    colors.rubble,
    { topSlot: 'terrace', topColor: colors.terrace },
  );
  extrude(
    out,
    'rubble',
    [
      [-31, 23],
      [-22, 8],
      [-2, 4],
      [8, 15],
      [8, 38],
      [-4, 40],
      [-21, 31],
    ],
    0.55,
    7.25,
    colors.rubble,
    { topSlot: 'terrace', topColor: colors.terrace },
  );
  const steps = facade([-23, 21], [0.47, -0.883]);
  const count = lod > 1 ? 14 : 5;
  for (let i = 0; i < count; i++) {
    const depth = (-13 * i) / count;
    fbox(
      out,
      'rubble',
      steps,
      -1.7,
      1.7,
      2.1,
      3.5 + (3.75 * (i + 1)) / count,
      depth - 13 / count,
      depth,
      tint(colors.rubble, i),
    );
  }
}

function build(sink, lod) {
  const out = withFootprintCaps({
    addQuad: sink.addQuad.bind(sink),
    addTriangle: sink.addTriangle.bind(sink),
    addConvexPolygon: sink.addConvexPolygon.bind(sink),
  });
  wallCurtain(out, lod);
  approaches(out, lod);
  for (const block of compounds) residence(out, block, lod);
  for (const t of towers) tower(out, t, lod);
  elevatedGallery(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'bahla-fort-model.mjs';
const camera = [-143, 81, 160];
const lookAt = [0, 11, 0];

export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historic-fortification',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  limitations: plan.limitations,
  brief:
    'Bahla Fort as photographed in 1885, with terraced adobe enclosures, stone plinths, weathered parapets, a high wind tower and three main building groups.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: site.validFrom,
    validUntil: site.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-36, 61, 48],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs', 'place-footprint-caps.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'west-wind-tower-and-dry-stone-hill', position: [-112, 14, 38], lookAt: [-46, 14, 2] },
    {
      name: 'north-gallery-and-weathered-parapet',
      position: [-61, 12, -106],
      lookAt: [-11, 17, -35],
    },
    { name: 'south-approach-and-recessed-gate', position: [-25, 15, 82], lookAt: [-16, 8, 34] },
    { name: 'three-terraced-enclosures', position: [104, 98, 105], lookAt: [1, 9, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'bahla-fort-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.1,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.48, surfaces },
      street: { export: 'street', errorMeters: 0.17, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.046, surfaces },
    },
  },
};
