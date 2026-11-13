/** November 2006 Rafael Uribe Uribe Palace of Culture, Medellín. */
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
const frame = read('map-frame');
const outer = frame.geometry.polygons[0];
const courtyard = frame.geometry.courtyards[0];
const { foundationBottom, baseTop, roofLine, mainCupolaTop } = plan.section;
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.92, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.88, metallic: 0 },
  pane: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.53, metallic: 0.02 },
};
const tint = Object.fromEntries(
  Object.entries({
    cream: 'c5bda6',
    charcoal: '50534c',
    band: 'a5a18d',
    pale: 'dbd8ca',
    court: 'bdb6a3',
    roof: '565f5a',
    base: '878879',
    pane: '4a5350',
    wood: '68514a',
    slate: '69716b',
  }).map(([name, value]) => [name, rgb(value)]),
);

function face(out, slot, points, wanted, color) {
  let normal = normalFor(...points);
  if (normal.reduce((dot, v, i) => dot + v * wanted[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, color);
  else
    out.addTriangle(
      slot,
      'palette:#ffffff',
      points,
      normal,
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      color,
    );
}
const at = ([x, z], y) => [x, y, z];
function edge([x, z], [ex, ez], sign = 1) {
  const length = Math.hypot(ex - x, ez - z);
  const u = (ex - x) / length,
    v = (ez - z) / length,
    nx = -v * sign,
    nz = u * sign;
  return {
    length,
    normal: [nx, 0, nz],
    at: (s, y, d = 0) => [x + u * s + nx * d, y, z + v * s + nz * d],
  };
}
function sides(ring, sign = 1) {
  return ring.map((p, i) => edge(p, ring[(i + 1) % ring.length], sign));
}
function panel(out, slot, s, left, right, low, high, d, color) {
  face(
    out,
    slot,
    [s.at(left, low, d), s.at(right, low, d), s.at(right, high, d), s.at(left, high, d)],
    s.normal,
    color,
  );
}
function cap(out, slot, ring, holes, y, color) {
  const mesh = new MeshBufferBuilder();
  if (
    !mesh.addCap(
      slot,
      'palette:#ffffff',
      ring,
      holes,
      () => y,
      [0, 1, 0],
      (p) => p,
      color,
    )
  )
    throw Error('Palace cap triangulation failed');
  const { indices, positions } = mesh.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const points = Array.from(indices.slice(i, i + 3), (index) =>
      Array.from(positions.slice(index * 3, index * 3 + 3)),
    );
    face(out, slot, points, [0, 1, 0], color);
  }
}
function course(out, s, y, thickness, depth, color = tint.cream) {
  panel(out, 'trim', s, 0, s.length, y, y + thickness, depth, color);
}
function checks(out, s, low, high, lod, seed) {
  if (lod === 0) return;
  const [width, height] = [
    [0, 0],
    [2.4, 1.55],
    [1.12, 0.73],
    [0.62, 0.42],
  ][lod];
  for (let row = 0; low + height * row < high; row++) {
    const y = low + row * height;
    const a = row % 2 ? width / 2 : 0;
    for (let col = -1; col * width + a < s.length; col++) {
      const l = Math.max(0, col * width + a),
        r = Math.min(s.length, (col + 1) * width + a);
      const cell =
        Math.imul(col + 113, 0x9e3779b1) ^
        Math.imul(row + 7, 0x85ebca6b) ^
        Math.imul(seed + 1, 0xc2b2ae35);
      const shuffled = Math.imul(cell ^ (cell >>> 16), 0x27d4eb2d);
      const value = ((shuffled ^ (shuffled >>> 15)) >>> 0) % 13;
      if (value >= 6 || r - l < 0.035) continue;
      const yEnd = Math.min(y + height, high);
      if (yEnd - y > 0.035)
        panel(
          out,
          'stone',
          s,
          l + 0.009,
          r - 0.009,
          y + 0.008,
          yEnd - 0.007,
          0.027,
          value < 2 ? tint.band : tint.cream,
        );
    }
  }
}
function arch(out, s, u, base, width, shoulder, top, lod, pattern = true) {
  const r = width / 2;
  if (lod === 0) {
    panel(out, 'pane', s, u - r, u + r, base, shoulder + 0.3, 0.066, tint.pane);
    return;
  }
  if (lod === 1) {
    panel(out, 'pane', s, u - r, u + r, base, shoulder, 0.075, tint.pane);
    face(
      out,
      'pane',
      [s.at(u - r, shoulder, 0.075), s.at(u + r, shoulder, 0.075), s.at(u, top, 0.075)],
      s.normal,
      tint.pane,
    );
    panel(out, 'trim', s, u - r - 0.12, u + r + 0.12, base - 0.13, base, 0.093, tint.cream);
    return;
  }
  const n = lod >= 3 ? 10 : 6;
  const curve = (i, border) => {
    const a = (i * Math.PI) / n,
      cs = Math.cos(a);
    return s.at(
      u + (r + border) * cs,
      shoulder + (top - shoulder) * (0.77 * Math.sin(a) + 0.23 * (1 - Math.abs(cs))) + border,
      0.074 + 0.005 * (border > 0),
    );
  };
  panel(out, 'pane', s, u - r, u + r, base, shoulder, 0.075, tint.pane);
  for (let i = 0; i < n; i++) {
    const a = curve(i, 0),
      b = curve(i + 1, 0);
    face(out, 'pane', [s.at(u, shoulder, 0.074), a, b], s.normal, tint.pane);
    face(
      out,
      'trim',
      [a, b, curve(i + 1, 0.17), curve(i, 0.17)],
      s.normal,
      pattern && i % 2 ? tint.charcoal : tint.cream,
    );
  }
  for (const x of [u - r - 0.08, u + r + 0.08])
    panel(out, 'trim', s, x - 0.075, x + 0.075, base, shoulder, 0.087, tint.cream);
  panel(out, 'trim', s, u - r - 0.19, u + r + 0.19, base - 0.18, base, 0.096, tint.cream);
  if (lod >= 2) {
    const y = base + (shoulder - base) * 0.54;
    panel(
      out,
      'trim',
      s,
      u - 0.055,
      u + 0.055,
      base,
      shoulder + (top - shoulder) * 0.58,
      0.093,
      tint.cream,
    );
    panel(out, 'trim', s, u - r, u + r, y, y + 0.055, 0.096, tint.wood);
  }
}
function flatWindow(out, s, u, base, width, height, lod) {
  const r = width / 2;
  panel(
    out,
    'trim',
    s,
    u - r - 0.11,
    u + r + 0.11,
    base - 0.09,
    base + height + 0.12,
    0.041,
    tint.cream,
  );
  panel(out, 'pane', s, u - r, u + r, base, base + height, 0.066, tint.pane);
  if (lod >= 2) panel(out, 'trim', s, u - 0.053, u + 0.053, base, base + height, 0.085, tint.cream);
}
function patternedEdge(index) {
  return index >= 1 && index <= 13;
}
function masonry(out, lod) {
  for (const [i, s] of sides(outer).entries()) {
    const pattern = patternedEdge(i);
    const coat = pattern ? (lod === 0 ? tint.base : tint.charcoal) : tint.pale;
    panel(out, 'stone', s, 0, s.length, foundationBottom, baseTop, 0, tint.base);
    panel(out, pattern ? 'stone' : 'plaster', s, 0, s.length, baseTop, roofLine, 0, coat);
    if (pattern) checks(out, s, baseTop, roofLine, lod, i);
    course(out, s, baseTop, 0.28, 0.098, tint.base);
    course(out, s, roofLine - 0.48, 0.44, 0.1);
    if (s.length < 5.5) continue;
    if (!pattern) {
      const count = i === 0 ? 3 : Math.floor(s.length / 6);
      for (let bay = 0; bay < count; bay++) {
        const u = i === 0 ? 38.6 + bay * 6.05 : ((bay + 0.5) * s.length) / count;
        for (const y of [3.2, 7.46, 11.67, 15.84]) flatWindow(out, s, u, y, 2.15, 2.71, lod);
      }
      continue;
    }
    const count = Math.max(1, Math.round(s.length / 6.0)),
      pitch = s.length / count;
    for (let k = 0; k < count; k++) {
      const u = (k + 0.5) * pitch,
        width = Math.min(3.5, pitch * 0.72);
      for (const y of [2.72, 8.15, 13.55]) arch(out, s, u, y, width, y + 2.43, y + 3.38, lod);
      if (lod >= 2 && k < count - 1) {
        const q = (k + 1) * pitch;
        panel(
          out,
          'stone',
          s,
          q - 0.22,
          q + 0.22,
          baseTop + 0.28,
          roofLine - 0.39,
          0.072,
          tint.band,
        );
      }
    }
    for (const y of [7.45, 12.85, 18.65]) course(out, s, y, 0.21, 0.083, tint.band);
  }
  cap(out, 'roof', outer, [courtyard], roofLine, tint.slate);
  cap(out, 'stone', courtyard, [], Math.max(baseTop - 1.62, 0.6), tint.court);
  for (const s of sides(courtyard)) {
    panel(out, 'plaster', s, 0, s.length, foundationBottom, roofLine, 0, tint.court);
    if (lod <= 1) continue;
    const count = Math.max(2, Math.round(s.length / 4.8)),
      width = Math.min(3.1, (s.length / count) * 0.74);
    for (let k = 0; k < count; k++) {
      const u = ((k + 0.5) * s.length) / count;
      flatWindow(out, s, u, 1.07, 0.92, 2.54, lod);
      for (const y of [5.0, 9.9, 14.8]) arch(out, s, u, y, width, y + 2.54, y + 3.19, lod, false);
    }
    for (const y of [4.52, 9.48, 14.43, 19.48]) course(out, s, y, 0.19, 0.096, tint.cream);
  }
}

function ring(x, z, r, count) {
  return Array.from({ length: count }, (_, i) => {
    const angle = Math.PI / 8 + (i * Math.PI * 2) / count;
    return [x + r * Math.cos(angle), z + r * Math.sin(angle)];
  });
}
function radial(out, slot, x, z, sections, count, color) {
  for (let j = 1; j < sections.length; j++) {
    const [low, r0] = sections[j - 1],
      [high, r1] = sections[j];
    const a = ring(x, z, r0, count),
      b = ring(x, z, r1, count);
    for (let i = 0; i < count; i++) {
      const n = (i + 1) % count;
      const normal = [(a[i][0] + a[n][0]) / 2 - x, 0, (a[i][1] + a[n][1]) / 2 - z];
      const points = [at(a[i], low), at(a[n], low), at(b[n], high)];
      if (r1 !== 0) points.push(at(b[i], high));
      face(out, slot, points, normal, color);
    }
  }
}
function columnDome(out, x, z, r, eaves, lod, seed) {
  if (lod === 0) {
    radial(
      out,
      'stone',
      x,
      z,
      [
        [baseTop, r],
        [eaves, r],
      ],
      6,
      tint.base,
    );
    radial(
      out,
      'roof',
      x,
      z,
      [
        [eaves, r + 0.17],
        [eaves + 2.18, r * 0.71],
        [eaves + 3.82, 0],
      ],
      6,
      tint.roof,
    );
    return;
  }
  const n = lod >= 2 ? 12 : 8,
    outer = ring(x, z, r, n);
  for (const [i, s] of sides(outer, -1).entries()) {
    panel(out, 'stone', s, 0, s.length, baseTop, eaves, 0, tint.charcoal);
    checks(out, s, baseTop, eaves, lod, seed + i);
    if (i % 2 === 0) {
      const u = s.length / 2,
        w = Math.min(0.91, s.length * 0.7);
      for (const y of lod === 1 ? [eaves - 4.28] : [4.5, 9.55, eaves - 5.25])
        arch(out, s, u, y, w, y + 1.35, y + 1.74, lod);
    }
    for (const y of [baseTop, 8.77, eaves - 1.42, eaves - 0.39])
      course(out, s, y, 0.21, 0.08, tint.cream);
  }
  radial(
    out,
    'trim',
    x,
    z,
    [
      [eaves - 0.24, r],
      [eaves + 0.16, r + 0.3],
      [eaves + 0.42, r + 0.12],
    ],
    n,
    tint.band,
  );
  const y = eaves + 0.42;
  radial(
    out,
    'roof',
    x,
    z,
    [
      [y, r + 0.1],
      [y + 0.78, r],
      [y + 1.74, r * 0.83],
      [y + 2.75, r * 0.47],
      [y + 3.13, 0.21],
    ],
    n,
    tint.roof,
  );
  radial(
    out,
    'trim',
    x,
    z,
    [
      [y + 3.12, 0.23],
      [y + 3.41, 0.24],
      [y + 3.74, 0],
    ],
    6,
    tint.band,
  );
}
function gableFacade(out, s, center, base, half, peak, lod) {
  const corners = [
    s.at(center - half, base, 0.17),
    s.at(center + half, base, 0.17),
    s.at(center, peak, 0.17),
  ];
  face(out, 'stone', corners, s.normal, tint.charcoal);
  if (lod >= 2) {
    for (let row = 0, y = base + 0.16; y < peak - 0.32; row++, y += 0.47) {
      const width = half * (1 - (y + 0.31 - base) / (peak - base)) - 0.19;
      if (width < 0.32) continue;
      const count = Math.floor((width * 2) / 0.84),
        offset = (width * 2) / count;
      for (let n = 0; n < count; n++)
        if ((n + row) % 2 === 0) {
          const left = center - width + n * offset;
          panel(out, 'stone', s, left, left + offset - 0.022, y, y + 0.31, 0.196, tint.cream);
        }
    }
    for (const sign of [-1, 1])
      beam(
        out,
        'trim',
        s.at(center + sign * half, base - 0.06, 0.2),
        s.at(center, peak, 0.2),
        0.3,
        0.27,
        tint.cream,
      );
  }
}
function entrance(out, lod) {
  const s = edge(outer[1], outer[2]),
    u = s.length * 0.48;
  arch(out, s, u, baseTop - 0.33, 3.58, 6.85, 8.2, lod);
  for (const offset of [-1.51, 0, 1.51]) {
    arch(out, s, u + offset, 9.23, 1.3, 11.52, 12.29, lod);
    arch(out, s, u + offset, 13.4, 1.3, 16.62, 17.43, lod);
  }
  gableFacade(out, s, u, roofLine - 0.2, 6.8, roofLine + 6.62, lod);
  for (const sign of [-1, 1])
    face(
      out,
      'roof',
      [
        s.at(u + sign * 6.8, roofLine - 0.2, 0.17),
        s.at(u + sign * 6.8, roofLine - 0.2, -5.0),
        s.at(u, roofLine + 4.48, -5.0),
        s.at(u, roofLine + 6.62, 0.17),
      ],
      [0, 1, 0],
      tint.slate,
    );
  const center = s.at(u, 0, -0.46);
  radial(
    out,
    'trim',
    center[0],
    center[2],
    [
      [roofLine + 6.54, 0.27],
      [roofLine + 7.09, 0.33],
      [roofLine + 7.52, 0],
    ],
    6,
    tint.band,
  );
}
function cupola(out, lod) {
  const x = -17.2,
    z = -14.3,
    n = lod >= 2 ? 16 : 8,
    r = 7.4;
  const drum = ring(x, z, r, 8);
  for (const s of sides(drum, -1)) {
    panel(
      out,
      'stone',
      s,
      0,
      s.length,
      roofLine - 0.19,
      26.52,
      0,
      lod === 0 ? tint.base : tint.charcoal,
    );
    checks(out, s, roofLine, 26.52, lod, 3);
    const u = s.length / 2;
    arch(out, s, u, roofLine + 0.56, 3.2, 24.78, 26.23, lod);
    gableFacade(out, s, u, 26.23, s.length * 0.45, 29.06, lod);
  }
  radial(
    out,
    'roof',
    x,
    z,
    [
      [26.2, 7.26],
      [28.0, 6.96],
      [30.23, 6.38],
      [32.47, 5.22],
      [34.42, 3.72],
      [35.83, 1.7],
      [36.18, 1.3],
    ],
    n,
    tint.roof,
  );
  if (lod >= 2)
    for (const point of drum) {
      const dx = point[0] - x,
        dz = point[1] - z;
      for (const [ya, yb, ra, rb] of [
        [26.7, 30.17, 0.988, 0.862],
        [30.17, 34.34, 0.862, 0.511],
        [34.34, 35.9, 0.511, 0.218],
      ])
        beam(
          out,
          'roof',
          [x + dx * ra, ya, z + dz * ra],
          [x + dx * rb, yb, z + dz * rb],
          0.105,
          0.104,
          tint.slate,
        );
    }
  const lantern = ring(x, z, 1.66, 8);
  for (const s of sides(lantern, -1)) {
    panel(out, 'stone', s, 0, s.length, 35.75, 39.65, 0, tint.charcoal);
    arch(out, s, s.length / 2, 36.22, 0.72, 38.44, 39.12, lod, false);
  }
  radial(
    out,
    'trim',
    x,
    z,
    [
      [39.51, 1.67],
      [39.75, 1.76],
      [40.15, 1.46],
    ],
    8,
    tint.cream,
  );
  radial(
    out,
    'roof',
    x,
    z,
    [
      [40.1, 1.47],
      [40.76, 1.11],
      [41.52, 0.34],
      [mainCupolaTop, 0],
    ],
    8,
    tint.slate,
  );
}

function pinnacles(out, lod) {
  for (const [i, s] of sides(outer).entries()) {
    if (!patternedEdge(i) || s.length < 10) continue;
    const count = Math.max(1, Math.floor(s.length / [17, 12, 6, 6][lod]));
    for (let k = 0; k < count; k++) {
      const [x, , z] = s.at(((k + 0.55) * s.length) / count, 0, -0.44);
      if (lod) B(out, 'stone', x, roofLine - 0.16, z, 0.67, 1.56, 0.66, tint.band);
      if (lod) B(out, 'trim', x, roofLine + 1.11, z, 0.83, 0.19, 0.82, tint.cream);
      radial(
        out,
        'trim',
        x,
        z,
        [
          [lod ? roofLine + 1.3 : roofLine - 0.04, 0.38],
          [roofLine + 1.86, 0.24],
          [roofLine + 2.27, 0],
        ],
        4,
        tint.band,
      );
    }
  }
}

function build(out, _frame, lod = 3) {
  masonry(out, lod);
  entrance(out, lod);
  for (const [i, [x, z, r, y]] of [
    [31.22, 14.75, 2.53, 20.9],
    [31.49, -1.21, 2.48, 21.08],
    [33.3, -12.06, 2.41, 20.8],
    [-20.94, -24.36, 2.43, 20.87],
  ].entries())
    columnDome(out, x, z, r, y, lod, i);
  cupola(out, lod);
  pinnacles(out, lod);
}
export const palaceSkyline = (out) => build(out, undefined, 0);
export const palaceDistrict = (out) => build(out, undefined, 1);
export const palaceStreet = (out) => build(out, undefined, 2);
export const palaceCloseup = (out) => build(out, undefined, 3);

const recipe = 'palace-model.mjs',
  camera = [89, 48, -105],
  lookAt = [0, 15, -2];
export const palaceModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  recipe,
  surfaces,
  build,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Medellín palace with checker masonry, clustered Gothic turrets, the principal slate cupola, pale later wings and an open inner court.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  portableGroundY: 0.33,
  groundCutout: {
    outline: courtyard,
    basis:
      'The original source field rises above the lower courtyard level. Bound the display opening to the mapped court and retain every original terrain sample.',
  },
  buildingCutout: {
    outline: outer,
    minimumCoverage: 0.95,
    basis: 'The named building multipolygon fixes the outer masonry footprint.',
  },
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['stone_limestone_raw', 'plaster_lime', 'stone_sandstone_raw', 'slate'],
  qaCameras: [
    {
      name: 'street-checker-masonry-and-south-gable',
      position: [76, 16, -49],
      lookAt: [11, 14, -7],
    },
    { name: 'cupola-and-lantern', position: [-58, 37, -55], lookAt: [-15, 28, -15] },
    { name: 'open-court-and-plaza-wing', position: [-13, 64, 48], lookAt: [0, 13, 2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-medellin-palace-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'palaceSkyline',
    errorMeters: 0.34,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'palaceDistrict', 0.19],
        ['street', 'palaceStreet', 0.079],
        ['closeup', 'palaceCloseup', 0.026],
      ].map(([name, exportName, errorMeters]) => [
        name,
        { export: exportName, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. SajoR released the 2006 photos into the public domain, and Sebastian Reategui dedicated the 2017 view under CC0. OpenStreetMap contributors supply the geographic outline under ODbL.',
};
