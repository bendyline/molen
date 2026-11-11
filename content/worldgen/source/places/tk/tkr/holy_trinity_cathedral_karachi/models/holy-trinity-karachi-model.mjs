/** The shortened Holy Trinity clock tower and barrel-roofed nave, Karachi circa 2002. */
import { readFileSync } from 'node:fs';
import { beam, normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { face, triangle } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { B as box, rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const [outline] = read('map-frame').geometry.polygons;
const terrain = read('terrain-grid');
const { section: s } = plan;
const body = outline.slice(0, 4);
const tower = outline.slice(4);
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.93, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.87, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.76, metallic: 0.13 },
  stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.94, metallic: 0 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.87, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.78, metallic: 0.12 },
};
const c = Object.fromEntries(Object.entries({
  wall: 'bfa686', shaded: 'ae9579', trim: 'cdb69a', light: 'ddc8a8', roof: 'b38a69',
  roofLight: 'c6a288', stone: '9e8d77', dark: '423930', pane: '555950', clock: '484139',
  clockMark: 'c4af91', edge: '9b775c',
}).map(([name, value]) => [name, rgb(value)]));
const up = [0, 1, 0];
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);

function directed(out, slot, points, normal, tint) {
  const wound = dot(normalFor(...points), normal) >= 0 ? points : points.toReversed();
  if (points.length === 3) triangle(out, slot, wound, tint);
  else face(out, slot, wound, tint);
}

function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u), j = Math.floor(v), a = u - i, b = v - j;
  const [row, next] = terrain.heightsMeters.slice(j, j + 2);
  return (1 - b) * ((1 - a) * row[i] + a * row[i + 1]) +
    b * ((1 - a) * next[i] + a * next[i + 1]) - terrain.modelDatumElevationMeters;
}

const midpoint = (a, b) => lerp(a, b, 0.5);
const ringEdge = (a, b) => {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const outward = [(a[1] - b[1]) / length, 0, (b[0] - a[0]) / length];
  return { length, outward, p(u, y, inset = 0) {
    const [x, z] = lerp(a, b, u / length);
    return [x - outward[0] * inset, y, z - outward[2] * inset];
  } };
};

function foundation(out) {
  const top = s.floor;
  const indices = earcut(outline.flat());
  for (let i = 0; i < indices.length; i += 3) {
    directed(out, 'stone', indices.slice(i, i + 3).map((k) => [outline[k][0], top, outline[k][1]]), up, c.stone);
  }
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    const bottom = ([x, z]) => [x, Math.min(top - 0.24, ground(x, z) - 0.19), z];
    directed(out, 'stone', [bottom(a), bottom(b), [b[0], top, b[1]], [a[0], top, a[1]]],
      [a[1] - b[1], 0, b[0] - a[0]], c.stone);
  }
}

function arched(x, y, w, h, lod) {
  const n = [3, 5, 8, 10][lod], r = w / 2;
  return [[x - r, y], [x + r, y], ...Array.from({ length: n + 1 }, (_, i) => {
    const angle = i * Math.PI / n;
    return [x + r * Math.cos(angle), y + h - r + r * Math.sin(angle)];
  })];
}

function panel(out, slot, outline, position, outward, tint) {
  const indices = earcut(outline.flat());
  for (let i = 0; i < indices.length; i += 3) {
    directed(out, slot, indices.slice(i, i + 3).map((k) => position(...outline[k])), outward, tint);
  }
}

function openingWall(out, edge, bottom, top, openings, lod, tint = c.wall) {
  const { length, outward, p } = edge;
  const border = [[0, bottom], [length, bottom], [length, top], [0, top]];
  const profiles = openings.map(({ x, y, w, h }) => arched(x, y, w, h, lod));
  if (!lod || !profiles.length) {
    directed(out, 'wall', border.map((q) => p(...q)), outward, tint);
    for (const profile of profiles) panel(out, 'dark', profile, (u, y) => p(u, y, -0.025), outward, c.dark);
    return;
  }
  let start = border.length;
  const cuts = profiles.map((profile) => {
    const offset = start;
    start += profile.length;
    return offset;
  });
  const flat = [...border, ...profiles.flat()];
  const indices = earcut(flat.flat(), cuts);
  for (let i = 0; i < indices.length; i += 3) {
    directed(out, 'wall', indices.slice(i, i + 3).map((k) => p(...flat[k])), outward, tint);
  }
  for (const [k, profile] of profiles.entries()) {
    const { x, y, w, h, depth = 0.37, glass = false } = openings[k];
    panel(out, 'dark', profile, (u, v) => p(u, v, depth), outward, glass ? c.pane : c.dark);
    for (let i = 0; i < profile.length; i++) {
      const a = profile[i], b = profile[(i + 1) % profile.length];
      const center = p(x, y + h * 0.43), mid = p(...midpoint(a, b));
      directed(out, 'trim', [p(...a), p(...b), p(...b, depth), p(...a, depth)],
        center.map((v, axis) => v - mid[axis]), c.shaded);
    }
    if (lod >= 2 && glass) {
      beam(out, 'trim', p(x, y + 0.01, depth - 0.04), p(x, y + h - 0.12, depth - 0.04),
        0.065, 0.067, c.trim);
      beam(out, 'trim', p(x - w / 2, y + h * 0.49, depth - 0.04),
        p(x + w / 2, y + h * 0.49, depth - 0.04), 0.07, 0.067, c.trim);
    }
  }
}

function sideAisles(out, lod) {
  for (let i = 0; i < body.length; i++) {
    const a = body[i], b = body[(i + 1) % body.length], edge = ringEdge(a, b);
    const side = i % 2 === 0;
    const row = side ? Array.from({ length: 8 }, (_, k) => ({
      x: 3.5 + (edge.length - 7) * k / 7, y: 1.30, w: 2.18, h: 3.22, depth: 0.55,
    })) : [0.25, 0.5, 0.75].filter((v) => i === 1 || v !== 0.5).map((v) => ({
      x: edge.length * v, y: 1.72, w: 1.82, h: 2.85, glass: true,
    }));
    openingWall(out, edge, s.floor, s.aisleEave, row, lod);
    beam(out, 'trim', edge.p(0, s.aisleEave), edge.p(edge.length, s.aisleEave), 0.28, 0.25, c.trim);
    if (lod) {
      beam(out, 'trim', edge.p(0, s.aisleEave - 0.55), edge.p(edge.length, s.aisleEave - 0.55), 0.13, 0.18, c.trim);
    }
    if (side) {
      const sign = Math.sign((a[0] + b[0]) / 2);
      const edgeRoof = (p) => [p[0] + sign * 0.18, s.aisleEave + 0.11, p[1]];
      const inner = (p) => [sign * s.centralHalfWidth, 7.02, p[1]];
      directed(out, 'roof', [edgeRoof(a), edgeRoof(b), inner(b), inner(a)], up, c.roof);
      if (lod >= 2) {
        for (let j = 1; j < 17; j++) {
          const p = lerp(a, b, j / 17);
          beam(out, 'roof', edgeRoof(p).map((v, k) => v + (k === 1 ? 0.041 : 0)),
            inner(p).map((v, k) => v + (k === 1 ? 0.041 : 0)), 0.043, 0.055, c.roofLight);
        }
      }
    }
  }
}

function barrelNave(out, lod) {
  const r = s.centralHalfWidth;
  const ends = [1, 3].map((i) => {
    const a = body[i], b = body[(i + 1) % body.length];
    const zAt = (x) => a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
    const outward = ringEdge(a, b).outward;
    const near = [a[0], s.aisleEave, a[1]], far = [b[0], s.aisleEave, b[1]];
    const nearInner = [Math.sign(a[0]) * r, 7.0, zAt(Math.sign(a[0]) * r)];
    const farInner = [Math.sign(b[0]) * r, 7.0, zAt(Math.sign(b[0]) * r)];
    directed(out, 'wall', [near, far, farInner, nearInner], outward, c.wall);
    return { zAt, sign: Math.sign(a[1]) };
  });
  const count = [6, 9, 14, 18][lod];
  const path = Array.from({ length: count + 1 }, (_, i) => {
    const a = i * Math.PI / count;
    return [r * Math.cos(a), s.clerestoryEave + (s.roofCrown - s.clerestoryEave) * Math.sin(a)];
  });
  for (let i = 1; i < path.length; i++) {
    const [a, b] = [path[i - 1], path[i]];
    const at = ([x, y], end, overhang) => [x, y, end.zAt(x) + end.sign * overhang];
    directed(out, 'roof', [at(a, ends[0], 0.26), at(a, ends[1], 0.26),
      at(b, ends[1], 0.26), at(b, ends[0], 0.26)], up, i % 5 ? c.roof : c.roofLight);
    for (const end of ends) {
      directed(out, 'wall', [at([a[0], 7.0], end, 0), at([b[0], 7.0], end, 0),
        at(b, end, 0), at(a, end, 0)], [0, 0, end.sign], c.wall);
      if (lod) beam(out, 'trim', at(a, end, 0.18), at(b, end, 0.18), 0.13, 0.16, c.trim);
    }
  }
  for (const sign of [-1, 1]) {
    const z0 = ends[0].zAt(sign * r), z1 = ends[1].zAt(sign * r);
    const a = [sign * r, sign > 0 ? z1 : z0], b = [sign * r, sign > 0 ? z0 : z1];
    const e = ringEdge(a, b);
    const n = lod ? 8 : 6;
    const slots = Array.from({ length: n }, (_, j) => ({
      x: 2.5 + (e.length - 5) * (j + 0.5) / n, y: 7.38, w: 1.17, h: 1.46,
      depth: 0.24, glass: true,
    }));
    openingWall(out, e, 7.0, s.clerestoryEave, slots, lod, c.shaded);
  }
  if (lod >= 2) {
    for (let i = 1; i <= 12; i++) {
      const zAt = (x) => ends[0].zAt(x) + (ends[1].zAt(x) - ends[0].zAt(x)) * i / 13;
      for (let j = 1; j < path.length; j++) {
        const [a, b] = [path[j - 1], path[j]];
        beam(out, 'roof', [a[0], a[1] + 0.034, zAt(a[0])], [b[0], b[1] + 0.034, zAt(b[0])],
          0.058, 0.067, c.roofLight);
      }
    }
  }
}

function towerClock(out, edge, lod) {
  const { length, p, outward } = edge;
  const x = length / 2, y = 24.9, radius = 0.69;
  const ring = (r, inset, a) => p(x + Math.cos(a) * r, y + Math.sin(a) * r, inset);
  const n = lod < 2 ? 10 : 20;
  for (let i = 0; i < n; i++) {
    const a = i * Math.PI * 2 / n, b = (i + 1) * Math.PI * 2 / n;
    directed(out, 'dark', [p(x, y, -0.09), ring(radius, -0.09, a), ring(radius, -0.09, b)], outward, c.clock);
    if (lod) directed(out, 'trim', [ring(radius, -0.087, a), ring(radius + 0.085, -0.059, a),
      ring(radius + 0.085, -0.059, b), ring(radius, -0.087, b)], outward, c.trim);
  }
  if (lod >= 2) {
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI * 2 / 12;
      beam(out, 'metal', ring(0.57, -0.10, a), ring(0.65, -0.10, a), 0.033, 0.031, c.clockMark);
    }
    beam(out, 'metal', p(x, y, -0.106), p(x - 0.39, y + 0.19, -0.106), 0.049, 0.044, c.clockMark);
    beam(out, 'metal', p(x, y, -0.108), p(x + 0.28, y + 0.43, -0.108), 0.031, 0.035, c.clockMark);
  }
}

function clockTower(out, lod) {
  for (let i = 0; i < tower.length; i++) {
    const edge = ringEdge(tower[i], tower[(i + 1) % tower.length]);
    const { length, p, outward } = edge;
    const center = length / 2;
    const entry = i === 1;
    const openings = [
      ...(entry ? [{ x: center, y: s.floor + 0.11, w: 2.16, h: 4.04, depth: 0.55 }] : []),
      ...(lod ? [{ x: center, y: 15.75, w: 0.65, h: 1.95, depth: 0.30 }] : []),
      { x: center, y: 20.02, w: 0.72, h: 2.01, depth: 0.37 },
      ...[-1.10, 0, 1.10].map((v) => ({ x: center + v, y: 27.93, w: 0.78, h: 2.66, depth: 0.48 })),
    ];
    openingWall(out, edge, s.floor, s.towerRoof, openings, lod);
    towerClock(out, edge, lod);
    const bands = lod ? [6.9, 12.6, 18.24, 23.25, 27.25, 32.04, 33.78] : [12.6, 23.25, 27.25, 33.78];
    for (const y of bands) {
      beam(out, 'trim', p(0, y, -0.043), p(length, y, -0.043), y > 32 ? 0.31 : 0.14, 0.27, c.trim);
    }
    const units = 4;
    for (let j = 0; j < units; j++) {
      const a = j * length / units + 0.065, b = Math.min(length - 0.065, a + length * 0.144);
      const bottom = s.towerRoof, top = s.towerParapet;
      const panel = [[a, bottom], [b, bottom], [b, top], [a, top]];
      directed(out, 'wall', panel.map((v) => p(...v, -0.095)), outward, c.wall);
      directed(out, 'wall', panel.map((v) => p(...v, 0.37)), outward.map((n) => -n), c.shaded);
      directed(out, 'trim', [p(a, top, -0.095), p(b, top, -0.095), p(b, top, 0.37), p(a, top, 0.37)], up, c.trim);
      for (const u of [a, b]) {
        const toward = p(b, top).map((v, k) => v - p(a, top)[k]);
        directed(out, 'wall', [p(u, bottom, -0.095), p(u, bottom, 0.37), p(u, top, 0.37), p(u, top, -0.095)],
          toward.map((v) => u === a ? -v : v), c.wall);
      }
    }
  }
  directed(out, 'stone', tower.map(([x, z]) => [x, s.towerRoof, z]), up, c.stone);
  const [x, z] = tower.reduce(([x, z], [u, v]) => [x + u / 4, z + v / 4], [0, 0]);
  box(out, 'metal', x, s.towerRoof, z, 0.061, 2.07, 0.061, c.clock);
}

function build(out, lod) {
  foundation(out);
  sideAisles(out, lod);
  barrelNave(out, lod);
  clockTower(out, lod);
}
export const cathedralSkyline = (out) => build(out, 0);
export const cathedralDistrict = (out) => build(out, 1);
export const cathedralStreet = (out) => build(out, 2);
export const cathedralCloseup = (out) => build(out, 3);
const recipe = 'holy-trinity-karachi-model.mjs', camera = [68, 26, 66], lookAt = [0.6, 12.7, 2.0];
const authoredLevels = Object.fromEntries([
  ['district', 'cathedralDistrict', 0.42],
  ['street', 'cathedralStreet', 0.14],
  ['closeup', 'cathedralCloseup', 0.038],
].map(([name, entry, errorMeters]) => [name, { export: entry, errorMeters, surfaces }]));
export const cathedralModel = {
  id: plan.model, key: plan.model, title: plan.title, cell: plan.cell, wikidataId: plan.wikidataId,
  recipe, surfaces, build: cathedralCloseup, category: 'landmark', quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json', geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization', progressLedger: 'qualla-003.PROGRESS.md',
  brief: 'Buff sandstone cathedral with a reduced crenellated clock tower, barrel nave roof, high arched lights and aisle arcades.',
  appearance: { kind: 'historical', representedDate: plan.representedDate, validFrom: plan.validFrom,
    validUntil: plan.validUntil, currentWorldEligible: false },
  camera, lookAt,
  buildingCutout: { outline, minimumCoverage: 0.93, basis: 'The mapped cathedral perimeter, including the projected tower, from OpenStreetMap way 687683620.' },
  mediumFiContext: { scale: 2.2, groundY: 0, terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' } },
  embeddedCanonicalGraphs: ['stone_sandstone', 'stone_sandstone_raw', 'metal_standing_seam', 'stone_ashlar', 'metal_painted'],
  qaCameras: [
    { name: 'crenellated-tower-and-barrel-nave', position: [64, 13, 28], lookAt: [0, 14.2, 6.8] },
    { name: 'clock-and-triple-belfry', position: [18, 28, 46], lookAt: [1.6, 27, 25.1] },
    { name: 'chancel-and-side-arcades', position: [-35, 19, -36], lookAt: [0, 5.6, -8.5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-holy-trinity-karachi-${reviewLod}`, position: camera, lookAt, reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline', export: 'cathedralSkyline', errorMeters: 0.82, surfaces, authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense: 'Original geometry under the repository license. OpenStreetMap footprint is ODbL. Calan dedicated the exact Qualla exterior photograph to the public domain.',
};
