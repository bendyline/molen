/** Roofless nave and enclosed eastern sanctuary of the historic Red Monastery near Sohag. */
import { readFileSync } from 'node:fs';
import { beam, loft, normalFor, radialRing } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { face, triangle } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { B as box, rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const [outline] = read('map-frame').geometry.polygons;
const terrain = read('terrain-grid');
const { section: s } = plan;

const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.94, metallic: 0 },
  earth: { slot: 'wall', graph: 'earth_adobe', roughness: 0.96, metallic: 0 },
  limestone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.91, metallic: 0 },
  paving: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'plaster_lime', roughness: 0.93, metallic: 0 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.93, metallic: 0 },
  shadow: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.96, metallic: 0 },
};
const c = Object.fromEntries(Object.entries({
  wall: 'c3a27e', wallLow: 'bd9e7c', wallInner: 'b59578', lower: 'ad896e', brickDark: 'a27a61',
  recess: 'a68263', sand: 'c1ae8d', limestone: 'd1bb98', lighter: 'dcc8a4', paving: 'bdad95',
  roof: 'b6a086', dome: 'b38e73', earth: 'ab8c74', shadow: '4e3e31', wood: '554034', granite: '6a5d54',
}).map(([name, value]) => [name, rgb(value)]));
const up = [0, 1, 0];
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function directed(out, slot, p, normal, tint) {
  const wound = dot(normalFor(...p), normal) >= 0 ? p : p.toReversed();
  if (p.length === 3) triangle(out, slot, wound, tint);
  else face(out, slot, wound, tint);
}
const rect = (out, slot, x0, x1, y0, y1, z0, z1, tint) =>
  box(out, slot, (x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, tint);

function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u), j = Math.floor(v), a = u - i, b = v - j;
  const [row, next] = terrain.heightsMeters.slice(j, j + 2);
  return (1 - b) * ((1 - a) * row[i] + a * row[i + 1]) +
    b * ((1 - a) * next[i] + a * next[i + 1]) - terrain.modelDatumElevationMeters;
}

function floor(out) {
  const points = outline.map(([x, z]) => [x, s.floor, z]);
  directed(out, 'paving', points, up, c.paving);
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    const end = ([x, z]) => [x, Math.min(s.floor - 0.19, ground(x, z) - 0.21), z];
    directed(out, 'paving', [end(a), end(b), points[(i + 1) % outline.length], points[i]],
      [b[1] - a[1], 0, a[0] - b[0]], c.sand);
  }
}

function arched(x, y, width, h, n) {
  const radius = width / 2, spring = y + h - radius;
  const crown = Array.from({ length: n + 1 }, (_, i) => {
    const a = i * Math.PI / n;
    return [x + Math.cos(a) * radius, spring + Math.sin(a) * radius];
  });
  return [[x - radius, y], [x + radius, y], ...crown];
}

function flatPoly(out, slot, profile, world, normal, tint) {
  const ix = earcut(profile.flat());
  for (let i = 0; i < ix.length; i += 3) {
    directed(out, slot, ix.slice(i, i + 3).map((k) => world(...profile[k])), normal, tint);
  }
}

function faceLayout(index, span, lod) {
  const side = index % 2 === 1;
  const count = [6, 10, 6, 10][index];
  const margin = side ? 3.1 : 2.45;
  const portalX = (index === 1 ? 0.67 : 0.33) * span;
  const slots = [];
  for (const [row, base, width, height] of [[0, 4.03, 0.74, 1.39], [1, 8.13, 0.70, 1.34]]) {
    for (let i = 0; i < count; i++) {
      const x = margin + (span - 2 * margin) * i / (count - 1);
      const y = base + ((i * 7 + row * 3) % 5 - 2) * 0.047;
      slots.push({ x, y, width, height, depth: row === 0 ? 0.26 : 0.22,
        profile: arched(x, y, width, height, [2, 4, 7, 9][lod]), portal: false });
    }
  }
  if (side) {
    const x = portalX, y = s.floor + 0.08, width = 1.50, height = 2.62;
    slots.push({ x, y, width, height, depth: 0.45,
      profile: [[x - width / 2, y], [x + width / 2, y],
        [x + width / 2, y + height], [x - width / 2, y + height]], portal: true });
  }
  return slots;
}

function outerWalls(out, lod) {
  const top = s.wallTop;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const outward = [(b[1] - a[1]) / span, 0, (a[0] - b[0]) / span];
    const inward = outward.map((v) => -v);
    const p = (u, y, inset = 0) => {
      const [x, z] = lerp(a, b, u / span), batter = 1 - 0.033 * (y / top);
      return [x * batter - outward[0] * inset, y, z * batter - outward[2] * inset];
    };
    const cuts = faceLayout(i, span, lod);
    const border = [[0, s.floor], [span, s.floor], [span, top], [0, top]];
    if (lod === 0) {
      directed(out, 'brick', border.map((v) => p(...v)), outward, c.wall);
      for (const cut of cuts) flatPoly(out, 'shadow', cut.profile, (u, y) => p(u, y, -0.014), outward, c.recess);
    } else {
      const outline2d = [...border, ...cuts.flatMap((cut) => cut.profile)];
      let offset = border.length;
      const starts = cuts.map((cut) => {
        const start = offset;
        offset += cut.profile.length;
        return start;
      });
      const tris = earcut(outline2d.flat(), starts);
      for (let j = 0; j < tris.length; j += 3) {
        const profile = tris.slice(j, j + 3).map((k) => outline2d[k]);
        const height = profile.reduce((sum, v) => sum + v[1], 0) / 3;
        directed(out, 'brick', profile.map((v) => p(...v)), outward, height < 4.18 ? c.wallLow : c.wall);
      }
      for (const cut of cuts) {
        const { profile, depth, x, y, height, width, portal } = cut;
        flatPoly(out, portal ? 'wood' : 'brick', profile, (u, h) => p(u, h, depth),
          outward, portal ? c.wood : c.recess);
        for (let j = 0; j < profile.length; j++) {
          const a = profile[j], b = profile[(j + 1) % profile.length];
          const mid = lerp(a, b, 0.5), center = p(x, y + height * 0.44);
          const inside = p(...mid);
          directed(out, 'brick', [p(...a), p(...b), p(...b, depth), p(...a, depth)],
            center.map((v, axis) => v - inside[axis]), c.wallLow);
        }
        if (portal) {
          const sill = y - 0.07, head = y + height;
          for (const u of [x - width / 2 - 0.10, x + width / 2 + 0.10]) {
            beam(out, 'limestone', p(u, sill, -0.055), p(u, head + 0.13, -0.055), 0.20, 0.22, c.limestone);
            if (lod >= 2) beam(out, 'limestone', p(u - 0.16, head - 0.03, -0.07), p(u + 0.16, head - 0.03, -0.07), 0.13, 0.31, c.lighter);
          }
          beam(out, 'limestone', p(x - width * 0.73, head + 0.17, -0.09),
            p(x + width * 0.73, head + 0.17, -0.09), 0.26, 0.28, c.limestone);
        } else if (lod >= 2) {
          const w = width * 0.18, h = height * 0.31;
          const q = [[x - w, y + 0.09], [x + w, y + 0.09], [x + w, y + 0.09 + h], [x - w, y + 0.09 + h]];
          directed(out, 'shadow', q.map((v) => p(...v, depth - 0.016)), outward, c.shadow);
        }
      }
    }
    const inside = border.map((v) => p(...v, s.wallThickness));
    directed(out, 'brick', inside, inward, c.wallInner);
    directed(out, 'limestone', [p(0, top), p(span, top), inside[2], inside[3]], up, c.limestone);
    if (lod) {
      const count = i % 2 === 0 ? 22 : 38;
      for (let j = 0; j < count; j += lod === 1 ? 2 : 1) {
        const u = (j + 0.5) * span / count, w = span / count * 0.44;
        const y = top - 0.19 + ((j * 13) % 7) * 0.018;
        beam(out, 'limestone', p(u - w, y, 0.016), p(u + w, y, 0.016), 0.23, 0.25, j % 7 ? c.limestone : c.sand);
      }
      if (lod >= 2) {
        for (let j = 0; j < 12; j++) {
          const y = 0.39 + j * 0.63;
          const w = j % 2 === 0 ? 0.57 : 0.42;
          beam(out, 'limestone', p(0.045, y, -0.025), p(w, y, -0.025), 0.055, 0.22, c.sand);
        }
      }
    }
  }
}

function stoneColumn(out, x, z, height, lod) {
  const n = [5, 7, 9, 12][lod], y = s.floor;
  const bands = [[y, 0.34], [y + 0.14, 0.34], [y + 0.24, 0.22],
    [y + height - 0.24, 0.17], [y + height - 0.10, 0.28], [y + height, 0.30]];
  loft(out, 'limestone', bands.map(([h, radius]) => radialRing(h, radius, radius, n, [x, z])), c.granite);
}

function sanctuary(out, lod) {
  const [x, z] = s.sanctuaryCenter, y = s.eastRoof;
  rect(out, 'paving', 4.88, 19.03, s.floor, s.floor + 0.44, -9.52, 9.55, c.limestone);
  for (const t of [-1, 1]) {
    rect(out, 'brick', 5.23, 19.40, s.floor + 0.35, y, t < 0 ? -9.60 : 4.49, t < 0 ? -4.49 : 9.60, c.wallInner);
    rect(out, 'roof', 5.24, 19.62, y - 0.03, y + 0.20, t < 0 ? -9.61 : 4.49, t < 0 ? -4.49 : 9.61, c.roof);
  }
  rect(out, 'roof', 5.06, 19.57, y - 0.08, y + 0.24, -4.51, 4.51, c.roof);
  rect(out, 'brick', 5.0, 5.59, s.floor, y, -4.58, 4.58, c.brickDark);
  rect(out, 'wood', 4.95, 5.08, s.floor + 0.43, s.floor + 3.08, -0.95, 0.95, c.wood);
  for (const dz of [-3.12, 3.12]) stoneColumn(out, 3.08, dz, 4.12, lod);
  const n = lod < 2 ? 10 : 18;
  rect(out, 'brick', x - 3.19, x + 3.19, y + 0.17, 10.24, z - 3.16, z + 3.16, c.brickDark);
  rect(out, 'limestone', x - 3.26, x + 3.26, 10.12, 10.30, z - 3.23, z + 3.23, c.limestone);
  const layers = [[10.20, 2.88], [10.57, 2.89], [11.18, 2.70], [11.87, 2.25],
    [12.41, 1.57], [12.69, 0.73], [12.78, 0.15]];
  loft(out, 'roof', layers.map(([h, r]) => radialRing(h, r, r, n, [x, z])), c.dome);
  rect(out, 'wood', x - 0.043, x + 0.043, 12.76, 13.51, z - 0.05, z + 0.05, c.wood);
  rect(out, 'wood', x - 0.25, x + 0.25, 13.16, 13.25, z - 0.05, z + 0.05, c.wood);
  if (lod >= 2) {
    for (const dz of [-2.00, 0, 2.00]) {
      const p = [[x - 3.21, 8.76, z + dz - 0.19], [x - 3.21, 9.57, z + dz - 0.19],
        [x - 3.21, 9.57, z + dz + 0.19], [x - 3.21, 8.76, z + dz + 0.19]];
      directed(out, 'shadow', p, [-1, 0, 0], c.shadow);
    }
  }
}

function keep(out, lod) {
  const [x, z, width, depth, top] = s.keep;
  const ring = (y, factor) => [
    [x - width * factor / 2, y, z - depth * factor / 2],
    [x - width * factor / 2, y, z + depth * factor / 2],
    [x + width * factor / 2, y, z + depth * factor / 2],
    [x + width * factor / 2, y, z - depth * factor / 2],
  ];
  const base = Math.min(-0.10, ground(x, z) - 0.28);
  loft(out, 'brick', [ring(base, 1.0), ring(5.59, 0.91)], c.brickDark);
  loft(out, 'earth', [ring(5.59, 0.91), ring(top - 0.37, 0.82)], c.earth);
  loft(out, 'limestone', [ring(top - 0.40, 0.84), ring(top, 0.86)], c.sand);
  if (lod) {
    for (const [y, zFace] of [[2.42, z + depth * 0.48], [5.18, z + depth * 0.46], [8.28, z + depth * 0.435]]) {
      for (const dx of [-1.32, 1.23]) box(out, 'shadow', x + dx, y, zFace, 0.21, 0.65, 0.075, c.shadow);
    }
  }
  rect(out, 'earth', x + width * 0.43, x + width * 0.72, -0.32, 4.25, 10.08, z + 0.98, c.earth);
}

function build(out, lod) {
  floor(out);
  outerWalls(out, lod);
  sanctuary(out, lod);
  keep(out, lod);
}
export const monasterySkyline = (out) => build(out, 0);
export const monasteryDistrict = (out) => build(out, 1);
export const monasteryStreet = (out) => build(out, 2);
export const monasteryCloseup = (out) => build(out, 3);
const recipe = 'red-monastery-model.mjs', camera = [-52, 24, -47], lookAt = [-1.2, 5.9, 1.2];
const authoredLevels = Object.fromEntries([
  ['district', 'monasteryDistrict', 0.41],
  ['street', 'monasteryStreet', 0.14],
  ['closeup', 'monasteryCloseup', 0.035],
].map(([name, entry, errorMeters]) => [name, { export: entry, errorMeters, surfaces }]));
export const monasteryModel = {
  id: plan.model, key: plan.model, title: plan.title, cell: plan.cell, wikidataId: plan.wikidataId,
  recipe, surfaces, build: monasteryCloseup, category: 'landmark', quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json', geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization', progressLedger: 'qualla-003.PROGRESS.md',
  brief: 'Coptic monastery church at Sohag with its battered brick exterior, roofless nave, sanctuary dome and southern keep.',
  appearance: { kind: 'historical', representedDate: plan.representedDate, validFrom: plan.validFrom,
    validUntil: plan.validUntil, currentWorldEligible: false },
  camera, lookAt,
  buildingCutout: { outline, minimumCoverage: 0.94, basis: 'Named historic church envelope, OpenStreetMap way 515100191.' },
  mediumFiContext: { scale: 2.0, groundY: 0, terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' } },
  embeddedCanonicalGraphs: ['brick', 'earth_adobe', 'stone_limestone_raw', 'stone_ashlar', 'plaster_lime', 'wood_plain'],
  qaCameras: [
    { name: 'west-end-and-two-rows-of-arches', position: [-42, 9.2, -27], lookAt: [-10, 5.1, 0] },
    { name: 'south-portal-and-four-storey-keep', position: [-8, 11, 48], lookAt: [-8, 5.2, 6.7] },
    { name: 'roofless-nave-and-east-dome', position: [26, 30, -22], lookAt: [2.7, 3.9, 0.1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-red-monastery-${reviewLod}`, position: camera, lookAt, reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline', export: 'monasterySkyline', errorMeters: 0.79, surfaces, authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense: 'Original geometry under the repository license. OpenStreetMap footprint is ODbL. Eng-Bavly dedicated the exact May 2024 Qualla exterior photograph under CC0.',
};
