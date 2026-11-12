/** The weathered December 2011 exterior of Fort Christian in Charlotte Amalie. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
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
  holes: [court],
} = read('map-frame').geometry;
const { foundationBottom, courtLevel, wallTop, parapetTop, clockTop, taper } = plan.section;
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_drywall', roughness: 0.95, metallic: 0 },
  plaster: { slot: 'trim', graph: 'plaster_lime', roughness: 0.89, metallic: 0 },
  brick: { slot: 'roof', graph: 'brick_longformat', roughness: 0.93, metallic: 0 },
  painted: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.63, metallic: 0.04 },
};
const color = Object.fromEntries(
  Object.entries({
    stone: 'c4bdb0',
    ochre: 'bca788',
    plaster: 'dfdacf',
    shaded: 'b7af9f',
    red: 'b95542',
    cap: 'e5d5ba',
    brick: '9a7362',
    shutters: '457153',
    inside: '414438',
    dial: '70746b',
    ink: '363a35',
    hand: 'd2c9ae',
  }).map(([k, value]) => [k, rgb(value)]),
);

function face(out, slot, points, toward, tint = color[slot]) {
  let n = normalFor(...points);
  if (n.reduce((sum, v, i) => sum + v * toward[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, tint);
  else
    out.addTriangle(
      slot,
      'palette:#ffffff',
      points,
      n,
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      tint,
    );
}

function ringCap(out, slot, ring, holes, y, tint = color[slot]) {
  const scratch = new MeshBufferBuilder();
  if (
    !scratch.addCap(
      slot,
      'palette:#ffffff',
      ring,
      holes,
      () => y,
      [0, 1, 0],
      (p) => p,
      tint,
    )
  )
    throw Error('The mapped floor could not be triangulated');
  const mesh = scratch.finalize();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const points = Array.from(mesh.indices.slice(i, i + 3), (j) =>
      Array.from(mesh.positions.slice(j * 3, j * 3 + 3)),
    );
    face(out, slot, points, [0, 1, 0], tint);
  }
}

function edge(a, b, upperA = a, upperB = b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tx = (b[0] - a[0]) / length,
    tz = (b[1] - a[1]) / length;
  const normal = [-tz, 0, tx];
  return {
    length,
    normal,
    p(u, y, offset = 0) {
      const s = u / length,
        t = Math.min(1, Math.max(0, (y - foundationBottom) / (wallTop - foundationBottom)));
      const x = a[0] + (b[0] - a[0]) * s,
        z = a[1] + (b[1] - a[1]) * s;
      const dx = upperA[0] + (upperB[0] - upperA[0]) * s - x,
        dz = upperA[1] + (upperB[1] - upperA[1]) * s - z;
      return [x + dx * t + normal[0] * offset, y, z + dz * t + normal[2] * offset];
    },
  };
}

function panel(out, slot, side, a, b, y0, y1, depth = 0, tint) {
  if (b - a < 0.002 || y1 - y0 < 0.002) return;
  const { p, normal } = side;
  face(
    out,
    slot,
    [p(a, y0, depth), p(b, y0, depth), p(b, y1, depth), p(a, y1, depth)],
    normal,
    tint,
  );
}

function wallRing(outline, inset = outline) {
  return outline.map((p, i) => {
    const j = (i + 1) % outline.length;
    return edge(p, outline[j], inset[i], inset[j]);
  });
}

const outerEdges = wallRing(outer);
const inset = outer.map(([x, z], i) => {
  if (i === 13 || i === 14) return [x, z];
  const [a, , b] = outerEdges[(i + outer.length - 1) % outer.length].normal;
  const [c, , d] = outerEdges[i].normal;
  const scale = Math.min(taper / (1 + a * c + b * d), taper * 1.6);
  return [x - (a + c) * scale, z - (b + d) * scale];
});
const outerSides = wallRing(outer, inset),
  courtSides = wallRing(court);
const gateOuter = outerSides[13],
  gateInner = courtSides[6];
const gateU = gateOuter.length / 2;
const gateX = gateOuter.p(gateU, 0)[0];
const gateInnerU = (gateInner.length * (gateX - court[6][0])) / (court[7][0] - court[6][0]);

function gateProfile(side, u, lod) {
  const shoulder = 2.63,
    top = 3.79,
    half = 1.22,
    segments = lod < 2 ? 6 : 12;
  return Array.from({ length: segments + 1 }, (_, i) => {
    const t = (i / segments) * 2 - 1;
    return {
      u: u + t * half,
      y: shoulder + (top - shoulder) * (1 - Math.abs(t) * 0.54 - t * t * 0.46),
    };
  });
}

function gateway(out, side, u, bottom, lod, tint) {
  const profile = gateProfile(side, u, lod),
    l = profile[0].u,
    r = profile.at(-1).u,
    { p, normal } = side;
  panel(out, 'plaster', side, 0, l, bottom, wallTop, 0, tint);
  panel(out, 'plaster', side, r, side.length, bottom, wallTop, 0, tint);
  panel(out, 'plaster', side, l, r, bottom, courtLevel, 0, tint);
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1],
      b = profile[i];
    face(
      out,
      'plaster',
      [p(a.u, a.y), p(b.u, b.y), p(b.u, wallTop), p(a.u, wallTop)],
      normal,
      tint,
    );
    const trim = (v, d) => p(v.u + (v.u - u) * d, v.y + 0.17, 0.05);
    face(
      out,
      'plaster',
      [p(a.u, a.y, 0.05), p(b.u, b.y, 0.05), trim(b, 0.14), trim(a, 0.14)],
      normal,
      color.cap,
    );
  }
  for (const [a, b] of [
    [l - 0.19, l],
    [r, r + 0.19],
  ])
    panel(out, 'plaster', side, a, b, courtLevel, profile[0].y + 0.02, 0.05, color.cap);
  return profile;
}

function gate(out, lod) {
  const a = gateway(out, gateOuter, gateU, foundationBottom, lod, color.red);
  const b = gateway(out, gateInner, gateInnerU, courtLevel, lod, color.plaster).reverse();
  for (let i = 1; i < a.length; i++) {
    const [p, q, r, s] = [a[i - 1], a[i], b[i], b[i - 1]];
    face(
      out,
      'stone',
      [gateOuter.p(p.u, p.y), gateOuter.p(q.u, q.y), gateInner.p(r.u, r.y), gateInner.p(s.u, s.y)],
      [0, -1, 0],
      color.shaded,
    );
  }
  for (const [i, sign] of [
    [0, 1],
    [a.length - 1, -1],
  ]) {
    const p = a[i],
      q = b[i];
    face(
      out,
      'plaster',
      [
        gateOuter.p(p.u, courtLevel),
        gateInner.p(q.u, courtLevel),
        gateInner.p(q.u, q.y),
        gateOuter.p(p.u, p.y),
      ],
      [sign, 0, 0],
      color.shaded,
    );
  }
  face(
    out,
    'brick',
    [
      gateOuter.p(a[0].u, courtLevel, 0.48),
      gateOuter.p(a.at(-1).u, courtLevel, 0.48),
      gateInner.p(b.at(-1).u, courtLevel),
      gateInner.p(b[0].u, courtLevel),
    ],
    [0, 1, 0],
  );
}

function shutter(out, side, center, y, w, h, lod, tint = color.shutters) {
  panel(
    out,
    'plaster',
    side,
    center - w / 2 - 0.095,
    center + w / 2 + 0.095,
    y - 0.085,
    y + h + 0.085,
    0.025,
    color.cap,
  );
  panel(out, 'painted', side, center - w / 2, center + w / 2, y, y + h, 0.039, tint);
  if (lod >= 2 && w > 0.56) {
    panel(out, 'painted', side, center - 0.018, center + 0.018, y, y + h, 0.052, color.inside);
    if (lod === 3) {
      for (const f of [0.25, 0.5, 0.75])
        panel(
          out,
          'painted',
          side,
          center - w / 2,
          center + w / 2,
          y + h * f - 0.012,
          y + h * f + 0.012,
          0.052,
          color.inside,
        );
    }
  }
}

function walls(out, lod) {
  const cornerSides = new Set([0, 1, 5, 6, 10, 11, 15, 16]);
  for (const [i, s] of outerSides.entries()) {
    if (i !== 13) {
      const lower = i < 9 ? (i % 3 === 0 ? 3.1 : 2.2) : 3.85;
      const bedrock = cornerSides.has(i) || i === 2 || i === 4;
      panel(
        out,
        'stone',
        s,
        0,
        s.length,
        foundationBottom,
        lower,
        0,
        bedrock ? color.stone : color.ochre,
      );
      panel(out, 'plaster', s, 0, s.length, lower, wallTop, 0, color.plaster);
      if (s.length > 4.5) {
        const count = Math.max(1, Math.round(s.length / (i < 9 ? 4.1 : 4.8)));
        for (let j = 0; j < count; j++) {
          const u = (s.length * (j + 0.5)) / count;
          shutter(out, s, u, 3.62, i < 9 ? 0.74 : 0.61, 1.0, lod);
          if (lod && i < 9) shutter(out, s, u, 2.02, 0.34, 0.43, lod, color.inside);
        }
      }
    } else {
      for (const u of [2.0, 5.05, s.length - 5.05, s.length - 2.0])
        shutter(out, s, u, 2.08, 0.96, 2.19, lod);
    }
    const top = i === 13 ? parapetTop : cornerSides.has(i) ? parapetTop : parapetTop - 0.28;
    panel(out, 'plaster', s, 0, s.length, wallTop, top, 0, i === 13 ? color.red : color.plaster);
    panel(out, 'plaster', s, 0, s.length, wallTop, top, -0.28, color.shaded);
    face(
      out,
      'plaster',
      [s.p(0, top), s.p(s.length, top), s.p(s.length, top, -0.28), s.p(0, top, -0.28)],
      [0, 1, 0],
      color.cap,
    );
  }
  for (const [i, s] of courtSides.entries()) {
    if (i === 6) continue;
    panel(
      out,
      'plaster',
      s,
      0,
      s.length,
      courtLevel,
      wallTop,
      0,
      i % 4 === 0 ? color.red : color.plaster,
    );
    if (lod && s.length > 4) {
      const count = Math.max(1, Math.round(s.length / 4.3));
      for (let j = 0; j < count; j++)
        shutter(out, s, (s.length * (j + 0.5)) / count, 2.55, 0.77, 1.64, lod);
    }
  }
  gate(out, lod);
  ringCap(out, 'brick', inset, [court], wallTop, color.brick);
  ringCap(out, 'brick', court, [], courtLevel, rgb('a17d69'));
}

function turret(out, x, z, i, lod) {
  const sides = lod === 0 ? 5 : lod === 1 ? 6 : 10;
  const rings = [
    [parapetTop - 0.2, 0.48],
    [parapetTop + 0.76, 0.45],
    [parapetTop + 0.86, 0.51],
    [parapetTop + 1.07, 0.35],
  ];
  const point = (a, [y, r]) => [x + r * Math.cos(a), y, z + r * Math.sin(a)];
  for (let j = 1; j < rings.length; j++) {
    for (let k = 0; k < sides; k++) {
      const a = (k * 2 * Math.PI) / sides,
        b = ((k + 1) * 2 * Math.PI) / sides,
        mid = (a + b) / 2;
      face(
        out,
        'plaster',
        [point(a, rings[j - 1]), point(b, rings[j - 1]), point(b, rings[j]), point(a, rings[j])],
        [Math.cos(mid), 0, Math.sin(mid)],
        j === 1 && k < 2 ? color.red : color.plaster,
      );
      if (j === rings.length - 1)
        face(
          out,
          'plaster',
          [point(a, rings[j]), point(b, rings[j]), [x, parapetTop + 1.14, z]],
          [0, 1, 0],
          color.cap,
        );
    }
  }
  if (lod >= 2 && i === 16)
    B(out, 'painted', x, parapetTop + 1.08, z, 0.037, 2.65, 0.037, color.ink);
}

function dial(out, x, z, y, side, lod) {
  const dx = side % 2 === 0 ? 0 : side === 1 ? 1 : -1,
    dz = side % 2 === 1 ? 0 : side === 0 ? 1 : -1;
  const point = (u, v, d) => [x + dx * d + dz * u, y + v, z + dz * d - dx * u];
  const normal = [dx, 0, dz],
    segments = lod === 0 ? 6 : lod === 1 ? 8 : 16;
  const distance = 1.83;
  for (const [radius, tint, d] of [
    [0.57, color.ink, distance + 0.015],
    [0.48, color.dial, distance + 0.025],
  ]) {
    for (let j = 0; j < segments; j++) {
      const a = (j * 2 * Math.PI) / segments,
        b = ((j + 1) * 2 * Math.PI) / segments;
      face(
        out,
        'painted',
        [
          point(0, 0, d),
          point(radius * Math.cos(a), radius * Math.sin(a), d),
          point(radius * Math.cos(b), radius * Math.sin(b), d),
        ],
        normal,
        tint,
      );
    }
  }
  if (lod) {
    const d = distance + 0.035;
    face(
      out,
      'painted',
      [point(-0.03, 0, d), point(0.02, -0.03, d), point(0.19, 0.31, d)],
      normal,
      color.hand,
    );
    face(
      out,
      'painted',
      [point(0, -0.03, d), point(0.025, 0.021, d), point(-0.25, 0.12, d)],
      normal,
      color.hand,
    );
  }
}

function tower(out, lod) {
  const x = gateX,
    z = 22.64;
  for (const [base, w, h, depth, tint] of [
    [wallTop - 0.04, 5.68, 1.64, 5.3, color.red],
    [8.15, 5.91, 0.37, 5.62, color.cap],
    [8.48, 5.39, 0.47, 5.08, color.red],
    [8.88, 3.66, 3.72, 3.66, color.red],
    [12.42, 3.87, 0.3, 3.87, color.cap],
    [12.71, 4.02, 0.25, 4.02, color.red],
  ])
    B(out, 'plaster', x, base, z, w, h, depth, tint);
  for (let i = 0; i < 4; i++) dial(out, x, z, 11.2, i, lod);
  for (const sign of [-1, 1]) {
    const r = 1.85;
    for (const u of [-1.52, 0, 1.52]) {
      B(out, 'plaster', x + u, 12.94, z + sign * r, 0.49, clockTop - 12.94, 0.3, color.red);
      B(out, 'plaster', x + sign * r, 12.94, z + u, 0.3, clockTop - 12.94, 0.48, color.red);
    }
    if (lod >= 2)
      for (const u of [-1.47, -0.98, -0.49, 0, 0.49, 0.98, 1.47])
        B(out, 'plaster', x + u, 12.08, z + sign * 1.86, 0.13, 0.34, 0.16, color.cap);
  }
  for (const i of [1, 16]) {
    const [x, z] = inset[i];
    const base = Math.hypot(x, z);
    turret(out, x - (x / base) * 0.77, z - (z / base) * 0.77, i, lod);
  }
}

function build(out, _frame, lod = 3) {
  walls(out, lod);
  tower(out, lod);
}
export const fortSkyline = (out, frame) => build(out, frame, 0);
export const fortDistrict = (out, frame) => build(out, frame, 1);
export const fortStreet = (out, frame) => build(out, frame, 2);
export const fortCloseup = (out, frame) => build(out, frame, 3);

const recipe = 'fort-model.mjs';
const camera = [52, 27, 53],
  lookAt = [0, 4, 1];
export const fortModel = {
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
    'The four bastions, open brick court, weathered harbor walls, and red Gothic clock tower of Fort Christian in Charlotte Amalie.',
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
      'The named fort relation covers the mapped perimeter. Suppressing the matching generic building while the dated model is shown keeps the mapped courtyard open.',
  },
  mediumFiContext: {
    scale: 1.27,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['stone_drywall', 'plaster_lime', 'brick_longformat'],
  qaCameras: [
    { name: 'weathered-bastions-and-harbor-wall', position: [29, 10, -57], lookAt: [0, 4.6, -11] },
    { name: 'gothic-clock-tower-and-gate', position: [10, 6.3, 54], lookAt: [0, 6.6, 23] },
    { name: 'open-court-and-bastion-decks', position: [5, 31, 1], lookAt: [0, 2, 8] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-charlotte-amalie-fort-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'fortSkyline',
    errorMeters: 0.32,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'fortDistrict', 0.16],
        ['street', 'fortStreet', 0.065],
        ['closeup', 'fortCloseup', 0.023],
      ].map(([name, exportName, errorMeters]) => [
        name,
        { export: exportName, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. Smallbones dedicated both exact 2011 photographs to the public domain under CC0. OpenStreetMap contributors supply mapped geometry under ODbL.',
};
