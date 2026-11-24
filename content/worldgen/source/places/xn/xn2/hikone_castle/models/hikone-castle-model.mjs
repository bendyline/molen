import fs from 'node:fs';
import {
  beamPath,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const terrain = JSON.parse(fs.readFileSync(new URL('../terrain-grid.json', import.meta.url)));
const outline = frame.geometry.outline;
const plaster = rgb('e1ded2');
const fascia = rgb('c3bcaa');
const timber = rgb('584637');
const agedWood = rgb('695649');
const slit = rgb('302a25');
const roofTile = rgb('50535a');
const grayTile = rgb('626367');
const gold = rgb('b29760');
const stone = rgb('998876');
const rubble = ['a29380', '9e907b', '938573', '978875', 'a79881', '988877', 'a09280'].map(rgb);
const surfaces = {
  plaster: { slot: 'wall', graph: 'stucco', roughness: 0.94 },
  stone: { slot: 'foundation', graph: 'stone_drywall', roughness: 0.97 },
  tile: { slot: 'roof', graph: 'tile_flat', roughness: 0.9 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.91 },
  detail: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.86 },
};

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const baseTop = 6.32;
const keepOrigin = [-0.32, -1.07];
const mainFoot = [
  outline[5],
  outline[6],
  outline[7],
  outline[8],
  outline[9],
  outline[10],
  [-11.52, -9.1],
];
const connectorFoot = [outline[0], outline[1], outline[2], outline[3], outline[7], outline[5]];
const turretFoot = [outline[10], ...outline.slice(11, 17), outline[5], [-2.8, -11.9]];

function box(out, slot, x, z, w, d, y0, y1, color) {
  abox(out, slot, [x - w / 2, y0, z - d / 2], [x + w / 2, y1, z + d / 2], color, {
    bottom: false,
  });
}

function rect(x, z, w, d) {
  return [
    [x - w / 2, z - d / 2],
    [x - w / 2, z + d / 2],
    [x + w / 2, z + d / 2],
    [x + w / 2, z - d / 2],
  ];
}

function terrainY([x, z]) {
  const column = Math.round((x - terrain.origin[0]) / terrain.stepMeters);
  const row = Math.round((z - terrain.origin[1]) / terrain.stepMeters);
  return terrain.heightsMeters[row][column] - terrain.modelDatumElevationMeters;
}

function cap(out, slot, ring, y, color) {
  const indices = earcut(ring.flat(), [], 2);
  const p = (i) => [ring[i][0], y, ring[i][1]];
  for (let i = 0; i < indices.length; i += 3)
    tri(out, slot, p(indices[i]), p(indices[i + 2]), p(indices[i + 1]), color);
}

function foundation(out, foot, center, top, ratio, level) {
  const ring = outwardRing(foot);
  const upper = ring.map((p) => mix(center, p, ratio));
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    const low = (p) => [p[0], terrainY(p) - 0.72, p[1]];
    const high = (p) => [p[0], top, p[1]];
    const a = low(ring[i]);
    const b = low(ring[j]);
    const c = high(upper[j]);
    const d = high(upper[i]);
    const point = (u, v) => mix(mix(a, b, u), mix(d, c, u), v);
    const rows = level < 2 ? 1 : 5;
    const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const count = level < 2 ? 1 : Math.max(1, Math.ceil(length / (level === 3 ? 1.45 : 2.5)));
    for (let r = 0; r < rows; r++) {
      const cut = (k, row) => {
        if (k === 0 || k === count) return k / count;
        return (k + 0.27 * Math.sin(i * 6.38 + row * 13.3 + k * 17.5)) / count;
      };
      for (let k = 0; k < count; k++) {
        const tint =
          rows === 1 ? stone : rubble[(3 * i + 2 * r + k * (r % 2 ? 3 : 5)) % rubble.length];
        quad4(
          out,
          'stone',
          point(cut(k, r), r / rows),
          point(cut(k + 1, r), r / rows),
          point(cut(k + 1, r + 1), (r + 1) / rows),
          point(cut(k, r + 1), (r + 1) / rows),
          tint,
        );
      }
    }
  }
  cap(out, 'stone', upper, top, stone);
}

function hipRing(x, z, w, d, y, lift) {
  return [
    [x - w / 2, y + lift, z - d / 2],
    [x - w / 2, y, z],
    [x - w / 2, y + lift, z + d / 2],
    [x, y, z + d / 2],
    [x + w / 2, y + lift, z + d / 2],
    [x + w / 2, y, z],
    [x + w / 2, y + lift, z - d / 2],
    [x, y, z - d / 2],
  ];
}

// The lower eaves gently turn up at the ends. A smaller upper rectangle leaves
// room for the storey above and for the projecting gables to intersect the tiles.
function sweptSkirt(out, x, z, w, d, eave, upperW, upperD, rise, level, rafters = true) {
  const outer = hipRing(x, z, w, d, eave, 0.36);
  const upper = hipRing(x, z, upperW, upperD, eave + rise, 0);
  const middle = outer.map((p, i) => {
    const q = mix(p, upper[i], 0.55);
    return [q[0], lerp(eave + 0.1, eave + rise, 0.24) + (p[1] - eave) * 0.38, q[2]];
  });
  const innerSoffit = outer.map((p) => [lerp(x, p[0], 0.76), eave - 0.24, lerp(z, p[2], 0.72)]);
  const lowerEdge = outer.map(([px, py, pz]) => [px, py - 0.14, pz]);
  loft(out, 'tile', level === 0 ? [outer, upper] : [outer, middle, upper], roofTile, {
    cap: false,
  });
  loft(out, 'tile', [lowerEdge, outer], grayTile, { cap: false });
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length;
    quad4(out, 'plaster', lowerEdge[j], lowerEdge[i], innerSoffit[i], innerSoffit[j], fascia);
    if (level < 2) continue;
    const span = Math.hypot(outer[i][0] - outer[j][0], outer[i][2] - outer[j][2]);
    const n = Math.floor(span / (level === 3 ? 0.56 : 1.05));
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const low = mix(outer[i], outer[j], t);
      const mid = mix(middle[i], middle[j], t);
      const high = mix(upper[i], upper[j], t);
      const raised = ([px, py, pz]) => [px, py + 0.028, pz];
      if (level === 3) beamPath(out, 'tile', [low, mid, high].map(raised), 0.077, 0.058, grayTile);
      if (rafters)
        box(
          out,
          'plaster',
          lerp(x, low[0], 0.94),
          lerp(z, low[2], 0.93),
          0.12,
          0.13,
          eave - 0.31,
          eave - 0.13,
          fascia,
        );
    }
  }
}

// Gables are drawn along the outward wall normal. The long eave tips remain
// higher than the adjacent shoulder, and the curved karahafu has an arched crest.
function gable(
  out,
  F,
  width,
  eave,
  rise,
  front,
  back,
  level,
  { curved = false, crest = false } = {},
) {
  const count = level < 2 ? 4 : level === 2 ? 8 : 12;
  const arch = (s) =>
    curved
      ? Math.pow(Math.cos((Math.PI * s) / 2), 1.75) * rise + 0.26 * s * s
      : Math.pow(1 - Math.abs(s), 1.62) * rise + 0.26 * Math.pow(Math.abs(s), 6);
  const p = (i, d, offset = 0) => {
    const s = (2 * i) / count - 1;
    return F.P((s * width) / 2, eave + arch(s) + offset, d);
  };
  const frontLine = [];
  const underLine = [];
  for (let i = 0; i <= count; i++) {
    frontLine.push(p(i, front, 0.018));
    underLine.push(p(i, front - 0.13, -0.15));
    if (i === count) continue;
    quad4(out, 'tile', p(i, front), p(i + 1, front), p(i + 1, back), p(i, back), roofTile);
    quad4(
      out,
      'plaster',
      p(i + 1, front, -0.12),
      p(i, front, -0.12),
      p(i, front - 0.53, -0.17),
      p(i + 1, front - 0.53, -0.17),
      fascia,
    );
    if (level > 1) {
      const tileStart = p(i, front - 0.055, 0.026);
      const tileEnd = p(i, back + 0.1, 0.026);
      if (level === 3) beamPath(out, 'tile', [tileStart, tileEnd], 0.07, 0.055, grayTile);
    }
    const u0 = width * (i / count - 0.5);
    const u1 = width * ((i + 1) / count - 0.5);
    quad4(
      out,
      'plaster',
      F.P(u0, eave - 0.22, front - 0.36),
      F.P(u1, eave - 0.22, front - 0.36),
      p(i + 1, front - 0.36, -0.085),
      p(i, front - 0.36, -0.085),
      plaster,
    );
  }
  if (level === 0) return;
  beamPath(out, 'tile', frontLine, 0.17, 0.15, grayTile);
  if (level > 1) beamPath(out, 'plaster', underLine, 0.14, 0.14, fascia);
  if (crest) {
    fbox(
      out,
      'detail',
      F,
      -0.115,
      0.115,
      eave + rise - 0.73,
      eave + rise - 0.5,
      front - 0.34,
      front - 0.31,
      curved ? gold : slit,
    );
    beamPath(
      out,
      'tile',
      [
        F.P(-0.49, eave + rise + 0.05, front - 0.015),
        F.P(0, eave + rise + 0.12, front + 0.015),
        F.P(0, eave + rise + 0.49, front + 0.04),
      ],
      0.15,
      0.125,
      grayTile,
    );
  }
}

function storey(out, footprint, bottom, top, level, kind) {
  extrude(out, 'plaster', footprint, bottom, top, plaster, { top: false });
  const ring = outwardRing(footprint);
  const lower = kind === 'lower';
  const gallery = kind === 'gallery';
  for (let i = 0; i < ring.length; i++) {
    const F = wallFace(ring[i], ring[(i + 1) % ring.length]);
    const L = F.length;
    if (lower) {
      fbox(out, 'wood', F, 0, L, bottom + 0.18, bottom + 1.36, -0.028, 0.074, timber);
      fbox(out, 'wood', F, 0, L, bottom + 0.12, bottom + 0.27, 0.02, 0.15, agedWood);
    }
    if (gallery) {
      fbox(out, 'wood', F, -0.44, L + 0.44, bottom - 0.02, bottom + 0.12, -0.02, 0.51, timber);
      for (const height of level === 0 ? [0.68] : [0.29, 0.55, 0.84])
        fbox(
          out,
          'wood',
          F,
          -0.35,
          L + 0.35,
          bottom + height,
          bottom + height + 0.1,
          0.4,
          0.53,
          agedWood,
        );
    }
    if (level === 0) continue;
    const count = lower ? (L > 17 ? 3 : 2) : gallery ? 2 : L > 11 ? 3 : 2;
    for (let j = 0; j < count; j++) {
      const u = (L * (j + 1)) / (count + 1);
      if (gallery) {
        opening(out, F, u, bottom + 0.29, 1.16, 1.51, {
          head: 'tudor',
          frameSlot: 'wood',
          glassSlot: 'detail',
          frame: agedWood,
          glass: slit,
          frameWidth: 0.125,
          frameDepth: 0.15,
          d: 0.04,
          sill: true,
          mullions: level > 1 ? 2 : 0,
        });
      } else {
        const half = lower ? 0.93 : 0.55;
        const sill = bottom + (lower ? 0.28 : 0.9);
        const lintel = sill + (lower ? 1.55 : 0.88);
        fbox(out, 'detail', F, u - half, u + half, sill, lintel, 0.064, 0.11, slit);
        fbox(
          out,
          'wood',
          F,
          u - half - 0.12,
          u + half + 0.12,
          sill - 0.09,
          sill + 0.06,
          0.082,
          0.21,
          agedWood,
        );
        quad4(
          out,
          'wood',
          F.P(u - half - 0.16, lintel - 0.11, lower ? 0.54 : 0.18),
          F.P(u + half + 0.16, lintel - 0.11, lower ? 0.54 : 0.18),
          F.P(u + half + 0.16, lintel + 0.13, 0.025),
          F.P(u - half - 0.16, lintel + 0.13, 0.025),
          agedWood,
        );
        if (level > 1)
          for (const offset of [-0.61, -0.31, 0, 0.31, 0.61])
            fbox(
              out,
              'wood',
              F,
              u + half * offset - 0.045,
              u + half * offset + 0.045,
              sill,
              lintel - 0.04,
              0.11,
              0.173,
              timber,
            );
      }
    }
    if (level < 2) continue;
    if (lower) {
      const sections = Math.round(L / (level === 3 ? 0.68 : 1.12));
      for (let k = 1; k < sections; k++) {
        const u = (L * k) / sections;
        if (
          Array.from({ length: count }, (_, j) => (L * (j + 1)) / (count + 1)).some(
            (v) => Math.abs(v - u) < 1.03,
          )
        )
          continue;
        fbox(
          out,
          'wood',
          F,
          u - 0.04,
          u + 0.04,
          bottom + 0.22,
          bottom + 1.4,
          0.07,
          0.118,
          agedWood,
        );
      }
      for (const height of [0.52, 0.91, 1.33])
        fbox(out, 'wood', F, 0, L, bottom + height, bottom + height + 0.05, 0.069, 0.11, agedWood);
    }
    if (gallery) {
      const posts = Math.ceil(L / (level === 3 ? 1.04 : 1.9));
      for (let k = 0; k <= posts; k++) {
        const u = lerp(-0.36, L + 0.36, k / posts);
        fbox(
          out,
          'wood',
          F,
          u - 0.058,
          u + 0.058,
          bottom + 0.07,
          bottom + 0.94,
          0.38,
          0.55,
          agedWood,
        );
      }
    }
  }
}

function keep(out, level) {
  foundation(out, mainFoot, keepOrigin, baseTop, 0.87, level);
  const [x, z] = keepOrigin;
  storey(out, rect(x, z, 20.18, 12.7), baseTop - 0.07, 11.88, level, 'lower');
  box(out, 'plaster', x, z, 20.8, 13.18, baseTop - 0.16, baseTop + 0.16, fascia);
  sweptSkirt(out, x, z, 23, 15.26, 11.51, 16.26, 10.12, 2.42, level);
  storey(out, rect(x, z, 16.22, 10.1), 12.42, 15.46, level, 'middle');
  sweptSkirt(out, x, z, 18.46, 12.46, 15.18, 12.46, 7.57, 1.82, level);
  storey(out, rect(x, z, 11.54, 7.17), 16.78, 18.93, level, 'gallery');
  sweptSkirt(out, x, z, 14.32, 9.77, 18.87, 10.32, 6.58, 0.64, level);

  for (const sign of [-1, 1]) {
    const Fn = (offset) => facade([x, z + offset], [0, -sign]);
    gable(out, Fn(0), 6.58, 19.51, 2.88, 5.23, -0.08, level, { crest: true });
    gable(out, Fn(0), 8.6, 15.12, 1.62, 8.87, 3.45, level, { curved: true, crest: true });
    gable(out, Fn(0), 10.28, 12.05, 4.13, 10.48, 4.1, level, { crest: true });
    for (const offset of [-5.28, 5.28])
      gable(out, Fn(offset), 5.78, 10.12, 3.32, 11.32, 8.68, level, { crest: true });

    const F = facade([x - sign * 1.15, z], [sign, 0]);
    gable(out, F, 12.85, 11.77, 3.72, 7.19, 1.9, level, { crest: true });
    if (level > 1) {
      for (const delta of [-3.35, -2.23, 2.23, 3.35])
        fbox(out, 'detail', Fn(0), delta - 0.18, delta + 0.18, 15.0, 15.13, 8.5, 8.54, gold);
    }
  }
  if (level > 0)
    beamPath(
      out,
      'tile',
      [
        [x - 5.28, 22.42, z],
        [x, 22.46, z],
        [x + 5.28, 22.42, z],
      ],
      0.24,
      0.18,
      grayTile,
    );
}

function rangeRoof(out, F, length, width, wallHalf, eave, rise, level) {
  const half = width / 2;
  const ridge = (u) => F.P(u, eave + rise + 0.06, 0);
  const side = (u, sign, inner) =>
    F.P(u, eave + (inner ? rise * 0.27 : 0), sign * half * (inner ? 0.48 : 1));
  for (const sign of [-1, 1]) {
    const [a, b] = sign === 1 ? [-0.23, length + 0.23] : [length + 0.23, -0.23];
    quad4(
      out,
      'tile',
      side(a, sign, false),
      side(b, sign, false),
      side(b, sign, true),
      side(a, sign, true),
      roofTile,
    );
    quad4(out, 'tile', side(a, sign, true), side(b, sign, true), ridge(b), ridge(a), roofTile);
    quad4(
      out,
      'plaster',
      F.P(b, eave - 0.038, sign * half),
      F.P(a, eave - 0.038, sign * half),
      F.P(a, eave - 0.038, sign * (wallHalf - 0.027)),
      F.P(b, eave - 0.038, sign * (wallHalf - 0.027)),
      fascia,
    );
    if (level > 1) {
      const n = Math.floor(length / (level === 3 ? 0.72 : 1.55));
      for (let i = 1; i <= n; i++) {
        const u = (length * i) / (n + 0.5);
        const raise = ([x, y, z]) => [x, y + 0.027, z];
        beamPath(
          out,
          'tile',
          [side(u, sign, false), side(u, sign, true), ridge(u)].map(raise),
          0.077,
          0.057,
          grayTile,
        );
      }
    }
    if (level > 0)
      beamPath(out, 'tile', [side(a, sign, false), side(b, sign, false)], 0.13, 0.14, grayTile);
  }
  const wallEdgeHeight = eave + (rise * 0.27 * (half - wallHalf)) / (half * 0.52);
  for (const sign of [-1, 1]) {
    const u = sign > 0 ? length : 0;
    const base = F.P(u, eave - 0.08, 0);
    const profile = [
      F.P(u, eave - 0.08, sign * wallHalf),
      F.P(u, wallEdgeHeight, sign * wallHalf),
      side(u, sign, true),
      ridge(u),
      side(u, -sign, true),
      F.P(u, wallEdgeHeight, -sign * wallHalf),
      F.P(u, eave - 0.08, -sign * wallHalf),
    ];
    for (let i = 1; i < profile.length; i++)
      tri(out, 'plaster', base, profile[i], profile[i - 1], plaster);
  }
  if (level > 0) beamPath(out, 'tile', [ridge(-0.25), ridge(length + 0.25)], 0.23, 0.16, grayTile);
}

function annex(out, level) {
  foundation(out, connectorFoot, [5.2, -10.4], 4.28, 0.88, level);
  foundation(out, turretFoot, [2, -17.8], 3.72, 0.91, level);

  const lower = [outline[12], outline[14]];
  const f = facade([-2.15, -15.95], [lower[1][0] - lower[0][0], lower[1][1] - lower[0][1]]);
  const length = 19.0;
  const ring = (F, l, d) =>
    [
      [0, -d],
      [l, -d],
      [l, d],
      [0, d],
    ].map(([u, offset]) => {
      const [x, , z] = F.P(u, 0, offset);
      return [x, z];
    });
  const walls = ring(f, length, 2.95);
  storey(out, walls, 3.7, 7.56, level, 'annex');
  rangeRoof(out, f, length, 7.4, 2.95, 7.52, 2.65, level);

  const connect = facade([-10.43, -11.26], [1, 0.1]);
  extrude(out, 'plaster', ring(connect, 17.34, 3.16), 4.14, 8.42, plaster, { top: false });
  rangeRoof(out, connect, 17.34, 7.54, 3.16, 8.39, 2.36, level);
  if (level > 0)
    for (const u of [2.2, 5.8, 9.6, 13.65])
      fbox(out, 'detail', connect, u - 0.41, u + 0.41, 5.7, 6.43, 3.149, 3.199, slit);
}

function build(out, level) {
  keep(out, level);
  annex(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'hikone-castle-model.mjs';
const camera = [55, 28, 44];
const lookAt = [0, 10.4, -6.1];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Hikone Castle',
  wikidataId: plan.wikidataId,
  category: 'castle',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The hilltop Hikone Castle keep and connected turrets, with three tiers of curved tile roofs, white gables, timber skirting and battered stone.',
  camera,
  lookAt,
  sunDirection: [49, 52, 24],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.92,
    basis: 'Mapped building outline for the standing keep and its attached ranges.',
  },
  embeddedCanonicalGraphs: ['stucco', 'stone_drywall', 'tile_flat', 'wood_plain'],
  recipeDependencies: ['place-recipe-kit.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'southeast-approach-gables', position: [40, 4.2, -3.1], lookAt: [1.8, 12.6, -3.2] },
    { name: 'hilltop-and-connected-turrets', position: [39, 30, -56], lookAt: [1, 9.2, -12.4] },
    { name: 'west-gallery-and-foundation', position: [-39, 13.8, 16], lookAt: [-1.7, 12.1, -2.2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'hikone-castle-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.0,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.45, surfaces },
      street: { export: 'street', errorMeters: 0.18, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.065, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};
