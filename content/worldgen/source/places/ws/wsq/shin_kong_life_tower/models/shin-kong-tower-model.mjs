/** The rose granite and ribbon-glazed Shin Kong Life Tower, Taipei, in August 2014. */
import { readFileSync } from 'node:fs';
import { beam, normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { face, triangle } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box as boundsBox } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const [outline] = read('map-frame').geometry.polygons;
const surfaces = {
  rose: { slot: 'wall', graph: 'stone_granite', roughness: 0.85, metallic: 0 },
  trim: { slot: 'trim', graph: 'concrete_panel', roughness: 0.90, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.42, metallic: 0.16 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.78, metallic: 0.16 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.79, metallic: 0.16 },
  base: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
};
const c = Object.fromEntries(Object.entries({
  rose: 'ad8d92', upper: 'a5828b', bright: 'c1a3a3', band: '997d84',
  brown: 'a09087', cut: '726268', roof: '76665f', concrete: 'a99c91',
  glass: '6e909a', darkGlass: '526b73', paleGlass: '7d9ba2', glassInset: '414b53',
  seam: '8a7277', steel: '5b5c58', screen: 'bec2a2', lattice: 'a4a784',
}).map(([key, value]) => [key, rgb(value)]));
const up = [0, 1, 0];
const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const at = ([x, z], y) => [x, y, z];

function directed(out, slot, points, normal, color) {
  const wound = dot(normalFor(...points), normal) >= 0 ? points : points.toReversed();
  if (points.length === 3) triangle(out, slot, wound, color);
  else face(out, slot, wound, color);
}

function cap(out, slot, ring, y, color) {
  const indices = earcut(ring.flat());
  for (let i = 0; i < indices.length; i += 3) {
    directed(out, slot, indices.slice(i, i + 3).map((j) => at(ring[j], y)), up, color);
  }
}

function box(out, slot, x, bottom, z, width, height, depth, tint) {
  boundsBox(out, slot, [x - width / 2, bottom, z - depth / 2],
    [x + width / 2, bottom + height, z + depth / 2], tint);
}

function edges(ring) {
  const orientation = Math.sign(ring.reduce((sum, a, i) => {
    const b = ring[(i + 1) % ring.length];
    return sum + a[0] * b[1] - a[1] * b[0];
  }, 0));
  return ring.map((a, i) => {
    const b = ring[(i + 1) % ring.length];
    const dx = b[0] - a[0], dz = b[1] - a[1], width = Math.hypot(dx, dz);
    const normal = [orientation * dz / width, 0, -orientation * dx / width];
    const p = (u, y, offset = 0) => [a[0] + dx * u / width + normal[0] * offset,
      y, a[1] + dz * u / width + normal[2] * offset];
    return { p, width, normal };
  });
}

function panel(out, section, slot, u0, u1, low, high, offset, color) {
  const { p, normal } = section;
  directed(out, slot, [p(u0, low, offset), p(u1, low, offset),
    p(u1, high, offset), p(u0, high, offset)], normal, color);
}

function envelope(out, ring, low, high, tint, roofTint = c.roof) {
  const sides = edges(ring);
  for (const side of sides) panel(out, side, 'rose', 0, side.width, low, high, 0, tint);
  cap(out, 'roof', ring, high, roofTint);
  return sides;
}

function glazing(out, side, u0, u1, low, high, tint, lod) {
  panel(out, side, 'glass', u0, u1, low, high, 0.039, tint);
  if (lod < 2) return;
  const panes = Math.max(1, Math.round((u1 - u0) / 2.20));
  for (let i = 1; i < panes; i++) {
    const x = u0 + (u1 - u0) * i / panes;
    panel(out, side, 'metal', x - 0.024, x + 0.024, low, high, 0.061, c.steel);
    if (lod === 3 && i % 4 === 1) {
      panel(out, side, 'glass', x + 0.043, x + (u1 - u0) / panes - 0.055, low + 0.042,
        high - 0.042, 0.056, c.paleGlass);
    }
  }
}

function podium(out, lod) {
  const sides = envelope(out, plan.podium, -1.35, plan.office[0].lower, c.brown);
  cap(out, 'base', outline, -0.04, c.concrete);
  const ringSizes = [0, 6.7, 11.2, 16.2, 21.0, 25.8, 30.6, 35.5, 40.25, 45.2, 50.1];
  for (const side of sides) {
    const north = side.normal[2] < -0.9, south = side.normal[2] > 0.9;
    const fullFront = north || south;
    const center = side.width / 2;
    for (const [i, y] of ringSizes.entries()) {
      if (i === 0) {
        for (const [start, end] of [[0.08, 0.38], [0.47, 0.73], [0.79, 0.94]]) {
          glazing(out, side, side.width * start, side.width * end, 0.56, 5.4, c.glassInset, lod);
        }
        continue;
      }
      if (!lod && i % 2 === 0) continue;
      const half = fullFront ? (i > 7 ? 10.1 : 12.9) : side.width * 0.32;
      const height = i > 7 ? 2.02 : 2.76;
      const allDark = i === 8 || i === 10;
      glazing(out, side, allDark ? 1.5 : center - half, allDark ? side.width - 1.5 : center + half,
        y, y + height, allDark ? c.glassInset : c.darkGlass, lod);
      if (lod && i !== 8) panel(out, side, 'trim', 0.07, side.width - 0.07, y - 0.47, y - 0.24,
        0.052, c.concrete);
    }
    if (lod >= 1) {
      for (const y of [6.30, 22.8, 39.8, 47.85, 53.30]) {
        panel(out, side, 'rose', 0.035, side.width - 0.035, y, y + 0.52, 0.089, c.bright);
      }
    }
    if (lod >= 2) {
      const seams = Math.round(side.width / 3.10);
      for (let i = 1; i < seams; i++) {
        const x = i * side.width / seams;
        panel(out, side, 'trim', x - 0.015, x + 0.015, 5.8, 53.4, 0.018, c.cut);
      }
    }
  }
  for (const entrance of plan.northEntrances) {
    const portico = envelope(out, entrance.ring, -0.35, entrance.height, c.bright);
    for (const side of portico.filter((side) => side.width > 1.5 && side.normal[2] < 0.25)) {
      glazing(out, side, side.width * 0.12, side.width * 0.88, 0.35, Math.min(5.03, entrance.height - 0.75),
        c.darkGlass, lod);
    }
  }
}

function office(out, lod) {
  for (const { ring, lower, upper } of plan.office) {
    const sides = envelope(out, ring, lower, upper, lower > 180 ? c.upper : c.rose);
    for (const side of sides) {
      const { width } = side;
      if (width < (lod ? 3.15 : 6.6)) continue;
      const inset = Math.min(1.3, width * 0.13);
      if (lower < 180) {
        const interval = 4.42 * (lod ? 1 : 2);
        for (let i = 0, y = lower + 2.08; y + 1.85 < upper; i++, y += interval) {
          const tint = i % 6 === 4 ? c.paleGlass : i % 4 === 1 ? c.darkGlass : c.glass;
          glazing(out, side, inset, width - inset, y, y + (lod ? 1.76 : 2.58), tint, lod);
          if (lod >= 2) panel(out, side, 'rose', 0.016, width - 0.016, y - 1.02, y - 0.76, 0.021, c.band);
        }
        if (lod >= 2 && width > 6.2) {
          const columns = Math.round(width / 3.08);
          for (let i = 1; i < columns; i++) {
            const x = width * i / columns;
            panel(out, side, 'trim', x - 0.014, x + 0.014, lower + 0.46, upper - 0.16, 0.016, c.seam);
          }
        }
      } else {
        const floors = Math.max(1, Math.floor((upper - lower) / 3.55));
        for (let i = 0; i < floors; i++) {
          const y = lower + 1.32 + i * 3.55;
          glazing(out, side, inset * 1.14, width - inset * 1.14, y, y + 1.12,
            i === 0 ? c.darkGlass : c.glassInset, lod);
        }
        if (lod) panel(out, side, 'trim', 0.026, width - 0.026, upper - 1.18, upper - 0.83, 0.042, c.concrete);
      }
    }
  }
}

function screen(out, lod) {
  const width = 9.05, base = 192.84, height = 8.66, z = 23.37;
  box(out, 'trim', 0.18, base - 0.36, z - 0.23, width + 0.43, height + 0.73, 1.17, c.concrete);
  box(out, 'glass', 0.18, base, z + 0.402, width, height, 0.064, c.screen);
  if (!lod) return;
  const n = lod >= 2 ? 5 : 3;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const left = 0.18 - width / 2 + i * width / n, right = left + width / n;
      const bottom = base + j * height / n, top = bottom + height / n;
      beam(out, 'metal', [left, bottom, z + 0.45], [right, top, z + 0.45], 0.078, 0.068, c.lattice);
      beam(out, 'metal', [left, top, z + 0.45], [right, bottom, z + 0.45], 0.078, 0.068, c.lattice);
    }
  }
}

function crown(out, lod) {
  const transition = envelope(out, plan.crown[0], 211.04, 214.88, c.upper);
  for (const side of transition.filter((side) => side.width > 3.3)) {
    glazing(out, side, side.width * 0.17, side.width * 0.83, 212.0, 212.87, c.glassInset, lod);
  }
  const { base, roof, mast } = plan.pyramid;
  const upper = envelope(out, plan.crown[1], 214.88, base, c.upper);
  for (const side of upper.filter((side) => side.width > 2.75)) {
    for (let i = 0, y = 215.82; y < base - 1.0; i++, y += lod ? 2.77 : 5.54) {
      panel(out, side, 'rose', 0.014, side.width - 0.014, y, y + 0.31, 0.032, i % 2 ? c.bright : c.band);
    }
    if (lod) glazing(out, side, side.width * 0.22, side.width * 0.77, 215.29, 216.72, c.glassInset, lod);
  }
  const roofRing = [[-6.15,-6.19],[6.60,-6.19],[6.60,6.45],[-6.15,6.45]];
  const apex = [0.21, roof, 0.13];
  for (const [i, p] of roofRing.entries()) {
    const next = roofRing[(i + 1) % roofRing.length];
    directed(out, 'roof', [at(p, base - 0.03), at(next, base - 0.03), apex], up, c.roof);
    if (lod) beam(out, 'roof', at(p, base - 0.015), apex, 0.095, 0.07, c.concrete);
  }
  beam(out, 'metal', apex, [0.21, mast, 0.13], 0.31, 0.31, c.steel);
  if (lod) {
    for (let i = 0; i < 8; i++) {
      const y = roof + 0.36 + i * 0.69;
      beam(out, 'metal', [-0.42, y, 0.13], [0.84, y, 0.13], 0.075, 0.082, c.steel);
    }
  }
  screen(out, lod);
}

function build(out, lod) {
  podium(out, lod);
  office(out, lod);
  crown(out, lod);
}

export const towerSkyline = (out) => build(out, 0);
export const towerDistrict = (out) => build(out, 1);
export const towerStreet = (out) => build(out, 2);
export const towerCloseup = (out) => build(out, 3);

const recipe = 'shin-kong-tower-model.mjs', camera = [-246, 150, 360], lookAt = [0, 120, 0];
const authoredLevels = Object.fromEntries([
  ['district', 'towerDistrict', 0.60], ['street', 'towerStreet', 0.19], ['closeup', 'towerCloseup', 0.050],
].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]));
export const towerModel = {
  id: plan.model, key: plan.model, title: plan.title, cell: plan.cell, wikidataId: plan.wikidataId,
  recipe, surfaces, build: towerCloseup, category: 'landmark', quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json', geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization', progressLedger: 'qualla-003.PROGRESS.md',
  brief: 'A rose-colored 244-metre Taipei tower with teal ribbon glazing, broad department-store podium and a stepped pyramidal crown.',
  appearance: { kind: 'historical', representedDate: plan.representedDate, validFrom: plan.validFrom,
    validUntil: plan.validUntil, currentWorldEligible: false },
  camera, lookAt, portableGroundY: 0,
  groundCutout: { outline: [...outline, outline[0]],
    basis: 'The mapped building and its entry structures bound the display opening. The composite ground includes neighboring roof heights.' },
  buildingCutout: { outline, minimumCoverage: 0.94, basis: 'The named tower-and-podium envelope from OpenStreetMap way 204711206.' },
  mediumFiContext: { scale: 2.6, groundY: 0, far: 3300, terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' } },
  embeddedCanonicalGraphs: ['stone_granite', 'concrete_panel', 'metal_standing_seam', 'metal_painted', 'concrete_plain'],
  qaCameras: [
    { name: 'southwest-photo-elevation', position: [-147, 97, 363], lookAt: [0, 120, 1] },
    { name: 'stepped-crown-and-pyramid', position: [-84, 223, 103], lookAt: [0, 210, 0] },
    { name: 'north-retail-base-and-entrances', position: [-70, 25, -113], lookAt: [0, 23, -28] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-taipei-tower-' + reviewLod, position: camera, lookAt, reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline', export: 'towerSkyline', errorMeters: 1.35, surfaces, authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense: 'Original geometry under the repository license. Mapped footprints are ODbL. The photographer released the exact Qualla photo under CC0.',
};
