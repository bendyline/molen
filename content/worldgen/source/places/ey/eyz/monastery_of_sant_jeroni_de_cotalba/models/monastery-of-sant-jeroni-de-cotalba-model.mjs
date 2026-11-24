import fs from 'node:fs';
import {
  abox,
  extrude,
  facade,
  fan,
  fbox,
  gableRoof,
  opening,
  outwardRing,
  pointedArch,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const map = read('map-frame');
const outline = map.geometry.outline;
const [court] = map.geometry.holes;
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  stone: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.96 },
  trim: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.94 },
  brick: { slot: 'trim', graph: 'brick', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.93 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.86 },
};
const plaster = rgb('b1a08a');
const porch = rgb('c4bcb0');
const ashlar = rgb('c4b69f');
const limestone = rgb('a59881');
const base = rgb('9e9381');
const clay = rgb('987460');
const agedClay = rgb('9d7c66');
const firedBrick = rgb('995f46');
const recess = rgb('554a40');
const frame = rgb('a49a87');
const iron = rgb('635c52');
const pane = rgb('5c605d');
const towerBounds = { x0: -38.18, x1: -29.97, z0: 16.65, z1: 24.61 };
const southwest = facade([-30.1, 0], [0, 1]);

function panel(out, slot, f, left, right, low, high, color, depth = 0) {
  if (right - left < 0.001 || high - low < 0.001) return;
  quad4(
    out,
    slot,
    f.P(left, low, depth),
    f.P(right, low, depth),
    f.P(right, high, depth),
    f.P(left, high, depth),
    color,
  );
}

function sill(out, f, left, right, low, high, depth = 0.16, color = ashlar) {
  fbox(out, 'trim', f, left, right, low, high, -0.01, depth, color);
}

function archBand(out, f, u, floor, width, spring, rise, deep, crown, level, options = {}) {
  const {
    round = false,
    masonry = 'wall',
    wallColor = plaster,
    ringSlot = 'trim',
    ringColor = ashlar,
    lining = recess,
    backed = true,
  } = options;
  const half = width / 2;
  const band = options.band ?? 0.15;
  const steps = [2, 2, 5, 7][level];
  const inner = round ? roundArch(half, steps * 2) : pointedArch(half, rise, steps);
  const outer = round
    ? roundArch(half + band, steps * 2)
    : pointedArch(half + band, rise + band, steps);
  const span = half + band;
  const r = (p, d = 0) => f.P(u + p[0], spring + p[1], d);
  panel(out, ringSlot, f, u - span, u - half, floor, spring, ringColor, 0.024);
  panel(out, ringSlot, f, u + half, u + span, floor, spring, ringColor, 0.024);
  for (let i = 0; i < inner.length - 1; i++) {
    const a = inner[i],
      b = inner[i + 1],
      c = outer[i],
      d = outer[i + 1];
    quad4(out, ringSlot, r(a, 0.024), r(b, 0.024), r(d, 0.024), r(c, 0.024), ringColor);
    quad4(out, masonry, r(c), r(d), f.P(u + d[0], crown), f.P(u + c[0], crown), wallColor);
    quad4(out, ringSlot, r(b), r(a), r(a, -deep), r(b, -deep), lining);
  }
  quad4(
    out,
    ringSlot,
    f.P(u - half, spring),
    f.P(u - half, floor),
    f.P(u - half, floor, -deep),
    f.P(u - half, spring, -deep),
    lining,
  );
  quad4(
    out,
    ringSlot,
    f.P(u + half, floor),
    f.P(u + half, spring),
    f.P(u + half, spring, -deep),
    f.P(u + half, floor, -deep),
    lining,
  );
  if (backed) {
    fan(
      out,
      'dark',
      [
        f.P(u - half, floor, -deep),
        f.P(u + half, floor, -deep),
        ...inner
          .slice()
          .reverse()
          .map((p) => r(p, -deep)),
      ],
      recess,
    );
  }
  return span;
}

function windowAt(out, f, u, bottom, width, height, lod, options = {}) {
  const { d = 0.055, head = 'flat', balcony = false, shadow = pane } = options;
  opening(out, f, u, bottom, width, height, {
    glassSlot: 'dark',
    frameSlot: 'trim',
    glass: shadow,
    frame,
    head,
    d,
    frameWidth: lod >= 2 ? 0.105 : 0,
    frameDepth: 0.09,
    sill: lod >= 2,
    mullions: lod === 3 && width > 0.83 ? 1 : 0,
    transoms: lod === 3 && height > 1.6 ? 1 : 0,
    mullionColor: iron,
  });
  if (balcony && lod > 0) {
    const l = u - width * 0.72,
      r = u + width * 0.72;
    sill(out, f, l, r, bottom - 0.22, bottom - 0.05, 0.67, limestone);
    fbox(out, 'dark', f, l, r, bottom + 0.77, bottom + 0.83, 0.62, 0.68, iron);
    for (let step = 0; step <= (lod === 3 ? 6 : 2); step++) {
      const pitch = (r - l) / (lod === 3 ? 6 : 2);
      const s = l + pitch * step;
      fbox(out, 'dark', f, s - 0.022, s + 0.022, bottom - 0.05, bottom + 0.79, 0.636, 0.666, iron);
    }
    if (lod >= 2) {
      fbox(out, 'dark', f, l - 0.025, l + 0.025, bottom + 0.75, bottom + 0.82, 0.13, 0.64, iron);
      fbox(out, 'dark', f, r - 0.025, r + 0.025, bottom + 0.75, bottom + 0.82, 0.13, 0.64, iron);
    }
  }
}

function gable(out, a, b, width, low, peak, shade = clay) {
  gableRoof(out, 'roof', a, b, width, low, peak, shade, {
    overhang: 0.22,
    endSlot: 'wall',
    endColor: plaster,
  });
}

function hipped(out, x0, x1, z0, z1, low, high, shade = clay) {
  const dx = x1 - x0,
    dz = z1 - z0;
  const x = (x0 + x1) / 2,
    z = (z0 + z1) / 2;
  const a = [x0, low, z0],
    b = [x1, low, z0],
    c = [x1, low, z1],
    d = [x0, low, z1];
  const offset = Math.min(dx, dz) * 0.32;
  if (dx > dz) {
    const e = [x0 + offset, high, z],
      f = [x1 - offset, high, z];
    quad4(out, 'roof', b, a, e, f, shade);
    quad4(out, 'roof', d, c, f, e, agedClay);
    tri(out, 'roof', a, d, e, shade);
    tri(out, 'roof', c, b, f, shade);
  } else {
    const e = [x, high, z0 + offset],
      f = [x, high, z1 - offset];
    quad4(out, 'roof', a, d, f, e, shade);
    quad4(out, 'roof', c, b, e, f, agedClay);
    tri(out, 'roof', b, a, e, shade);
    tri(out, 'roof', d, c, f, shade);
  }
}

function outerWalls(out, lod) {
  extrude(out, 'stone', outline, -2.95, 0.16, base, { holes: [court], top: false });
  // The eleven mapped straight segments have individually selected ceiling controls.
  const eaves = [11.45, 11.45, 15.83, 8.93, 8.93, 8.93, 15.91, 16, 16, 15.91, 11.45];
  const ring = outwardRing(outline);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const f = wallFace(a, b);
    const original = outline.indexOf(a),
      next = outline.indexOf(b);
    const index = next === (original + 1) % outline.length ? original : next;
    if (index === 7 || index === 8) continue; // Projecting bell tower has its own walls.
    const height = eaves[index];
    if (index === 9) {
      const left = Math.min(a[1], b[1]),
        right = Math.max(a[1], b[1]);
      const door = -17.2,
        church = 10.4,
        sillY = 0.16;
      const archA = archBand(out, southwest, door, sillY, 2.67, 2.52, 1.54, 1.13, height, lod, {
        ringColor: porch,
        band: 0.21,
      });
      const archB = archBand(out, southwest, church, sillY, 2.4, 2.48, 1.52, 1.15, height, lod, {
        band: 0.21,
      });
      for (const [lo, hi] of [
        [left, door - archA],
        [door + archA, church - archB],
        [church + archB, right],
      ]) {
        panel(out, 'wall', southwest, lo, hi, sillY, height, plaster);
        panel(out, 'wall', southwest, lo, hi, sillY, 2.34, porch, 0.025);
      }
      if (lod > 0) {
        const seal = Array.from({ length: 10 }, (_, index) => {
          const angle = (index / 10) * Math.PI * 2;
          return southwest.P(door + Math.cos(angle) * 0.38, 4.58 + Math.sin(angle) * 0.38, 0.067);
        });
        fan(out, 'trim', seal, ashlar);
        fbox(out, 'trim', southwest, church - 1.55, church - 1.27, 0.07, 4.73, -0.04, 0.65, ashlar);
        fbox(out, 'trim', southwest, church + 1.27, church + 1.55, 0.07, 4.73, -0.04, 0.65, ashlar);
        fbox(
          out,
          'wall',
          southwest,
          church - 1.57,
          church + 1.57,
          4.61,
          5.15,
          -0.04,
          0.68,
          plaster,
        );
      }
      for (let n = 0; n < 12; n++) {
        const z = left + 2.7 + n * 3.9;
        if (lod > 0 || n % 2 === 0) windowAt(out, southwest, z, 12.48, 0.88, 1.15, lod);
        if (n % 3 !== 2) {
          windowAt(out, southwest, z + 0.3, 5.84 + (n % 3) * 0.21, 1.05, 2.1, lod, {
            balcony: lod > 0 && n % 2 === 0,
          });
        }
        if (lod >= 2 && n % 3 === 1 && Math.min(Math.abs(z - door), Math.abs(z - church)) > 1.8)
          windowAt(out, southwest, z, 0.98, 0.67, 0.92, lod);
      }
      continue;
    }
    panel(
      out,
      'wall',
      f,
      0,
      f.length,
      0.16,
      height,
      index === 4 || index === 5 ? limestone : plaster,
    );
    if (index === 6 || f.length < 6) continue;
    if (index === 1) {
      const northAtEast = facade([30.4, 0], [0, -1]);
      panel(out, 'wall', northAtEast, -29.22, -13.91, height, 15.83, plaster);
    }
    if (index === 10) {
      const westChurch = facade([0, -32.38], [-1, 0]);
      panel(out, 'wall', westChurch, 6.79, 29.9, height, 15.91, plaster);
    }
    const n = Math.round(f.length / (lod > 0 ? 4.7 : 8.0));
    for (let i = 0; i < n; i++) {
      const u = ((i + 0.53) * f.length) / n;
      windowAt(out, f, u, height - 2.55, 0.78, 1.0, lod);
      if (i % 2 === 0) windowAt(out, f, u - 0.18, 5.34, 1.02, 1.67, lod);
      if (lod >= 2 && i % 3 === 0) windowAt(out, f, u + 0.24, 1.4, 0.65, 0.88, lod);
    }
    if (lod >= 2) sill(out, f, 0.05, f.length - 0.05, height - 0.26, height - 0.09, 0.12);
  }
}

function roofs(out, lod) {
  // Clerestory and firewalls support the visible changes of roof level.
  const churchEnd = facade([0, 27.91], [1, 0]);
  panel(out, 'wall', churchEnd, -29.89, -7.06, 8.84, 15.91, plaster);
  const aboveAnnex = facade([-27.87, 0], [0, 1]);
  panel(out, 'wall', aboveAnnex, 24.67, 27.91, 8.86, 16.57, plaster);
  const innerCrossWing = facade([-14.45, 0], [0, 1]);
  panel(out, 'wall', innerCrossWing, 13.91, 29.27, 10.84, 15.83, plaster);
  const tallWingBack = facade([0, 13.91], [-1, 0]);
  panel(out, 'wall', tallWingBack, -30.5, 14.45, 10.84, 15.83, plaster);
  // Independently pitched ranges meet at the four sides of the open cloister.
  gable(out, [-18.45, -32.38], [-18.45, 27.91], 23.35, 15.91, 19.37);
  gable(out, [23.35, -32.38], [23.35, 14.08], 14.1, 11.45, 14.38, agedClay);
  hipped(out, -6.76, 16.65, -32.42, -21.9, 11.47, 14.47);
  gable(out, [4.5, 2.04], [4.5, 14.07], 23.6, 10.86, 13.81, agedClay);
  hipped(out, -14.45, 30.5, 13.91, 29.27, 15.83, 18.52, agedClay);
  hipped(out, -27.89, -14.39, 28.78, 37.1, 8.93, 11.11);
  if (lod >= 2) {
    for (const [x, z, y, width] of [
      [-18.46, -15.9, 19.36, 0.55],
      [22.8, -17.6, 14.22, 0.62],
      [4.43, 9.2, 13.75, 0.5],
      [9.7, 21.1, 18.34, 0.54],
    ]) {
      abox(
        out,
        'wall',
        [x - width / 2, y - 0.28, z - width / 2],
        [x + width / 2, y + 0.96, z + width / 2],
        limestone,
      );
      abox(
        out,
        'roof',
        [x - width * 0.62, y + 0.92, z - width * 0.62],
        [x + width * 0.62, y + 1.07, z + width * 0.62],
        clay,
      );
    }
  }
}

function bellTower(out, lod) {
  const { x0, x1, z0, z1 } = towerBounds;
  const ring = outwardRing([
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ]);
  const baseHeight = 18.9,
    parapet = 24.08,
    top = 25.36;
  extrude(out, 'stone', ring, -2.51, baseHeight, limestone, { top: false });
  for (let side = 0; side < ring.length; side++) {
    const f = wallFace(ring[side], ring[(side + 1) % ring.length]);
    const u = f.length / 2;
    const a = archBand(out, f, u, 18.9, 1.82, 21.4, 0.99, 0.91, parapet, lod, {
      masonry: 'stone',
      wallColor: limestone,
      backed: false,
      band: 0.16,
    });
    panel(out, 'stone', f, 0, u - a, 18.9, parapet, limestone);
    panel(out, 'stone', f, u + a, f.length, 18.9, parapet, limestone);
    for (const y of lod === 0 ? [18.83, 23.96] : [6.46, 12.29, 18.83, 23.96]) {
      sill(out, f, 0.025, f.length - 0.025, y - 0.13, y + 0.085, y > 23 ? 0.24 : 0.13, ashlar);
    }
    const count = 6;
    for (let j = 0; j < count; j++) {
      const pitch = f.length / (count - 1),
        center = j * pitch;
      const l = Math.max(0, center - 0.43),
        r = Math.min(f.length, center + 0.43);
      fbox(out, 'trim', f, l, r, parapet - 0.03, top, -0.61, 0.03, ashlar);
    }
    if (lod >= 2) {
      for (const [start, dir] of [
        [0.025, 1],
        [f.length - 0.025, -1],
      ]) {
        for (let j = 0; j < 17; j++) {
          const end = start + dir * (j % 2 === 0 ? 0.54 : 0.72);
          const low = -0.49 + j * 1.42;
          if (low > 22.5) continue;
          panel(
            out,
            'trim',
            f,
            Math.min(start, end),
            Math.max(start, end),
            low,
            low + 1.408,
            j % 3 === 0 ? ashlar : limestone,
            0.037,
          );
        }
      }
      for (const y of [9.16, 15.52])
        windowAt(out, f, u, y, 0.35, 1.29, lod, { d: 0.047, shadow: recess });
    }
  }
  abox(out, 'stone', [x0 + 0.32, 23.48, z0 + 0.32], [x1 - 0.32, 23.72, z1 - 0.32], limestone);
}

function priorTower(out, lod) {
  const ring = outwardRing([
    [-29.89, -32.33],
    [-21.84, -32.33],
    [-21.84, -24.22],
    [-29.89, -24.22],
  ]);
  extrude(out, 'wall', ring, 0.16, 18.14, plaster, { top: false });
  hipped(out, -30.09, -21.64, -32.56, -24.0, 18.08, 20.25);
  for (let i = 0; i < ring.length; i++) {
    const f = wallFace(ring[i], ring[(i + 1) % ring.length]);
    const u = f.length / 2;
    windowAt(out, f, u + 0.27, 16.1, 0.54, 0.75, lod, { shadow: recess });
    if (lod > 0) {
      windowAt(out, f, u - 0.84, 10.61, 1.07, 1.61, lod, { shadow: recess });
      windowAt(out, f, u + 0.6, 5.43, 1.11, 1.92, lod, { balcony: i % 2 === 0 });
      sill(out, f, 0.08, f.length - 0.08, 17.86, 18.02, 0.21);
    }
  }
}

function cloister(out, lod) {
  const ring = outwardRing(court).reverse();
  const y0 = 0.18,
    y1 = 4.85,
    y2 = 9.75;
  fan(
    out,
    'stone',
    ring
      .slice()
      .reverse()
      .map(([x, z]) => [x, y0, z]),
    limestone,
  );
  for (let side = 0; side < ring.length; side++) {
    const f = wallFace(ring[side], ring[(side + 1) % ring.length]),
      length = f.length;
    const top = [11.45, 10.86, 15.91, 11.47][side];
    const interior = length - 0.8;
    const pitch = interior / 7,
      width = pitch - 0.69;
    if (lod === 0) {
      panel(out, 'wall', f, 0, length, y0, top, limestone);
      for (let i = 0; i < 7; i++) {
        const x = 0.4 + (i + 0.5) * pitch;
        panel(out, 'dark', f, x - width / 2, x + width / 2, 1.05, 3.63, recess, 0.033);
        panel(out, 'dark', f, x - width / 2, x + width / 2, 6.26, 8.25, pane, 0.037);
      }
      continue;
    }
    const a = width / 2 + 0.15,
      b = width / 2 + 0.13;
    for (let i = 0; i <= 7; i++) {
      const u = 0.4 + (i + 0.5) * pitch;
      const start = i === 0 ? 0 : u - pitch + a;
      const end = i === 7 ? length : u - a;
      panel(out, 'wall', f, start, end, y0, y1, porch);
      panel(out, 'trim', f, i === 0 ? 0 : u - pitch + b, i === 7 ? length : u - b, y1, y2, ashlar);
      if (i === 7) continue;
      archBand(out, f, u, y0, width, 2.85, 1.27, 1.52, y1, lod, {
        wallColor: porch,
        ringSlot: 'brick',
        ringColor: firedBrick,
        band: 0.15,
        lining: rgb('a19078'),
      });
      archBand(out, f, u, 5.13, width, 7.45, width / 2, 0.39, y2, lod, {
        round: true,
        masonry: 'trim',
        wallColor: ashlar,
        band: 0.13,
        lining: limestone,
        backed: false,
      });
      panel(out, 'trim', f, u - b, u + b, y1, 5.13, ashlar);
      if (lod >= 2) {
        windowAt(out, f, u, 5.33, width - 0.29, 2.99, lod, { d: -0.37, head: 'round' });
        sill(out, f, u - a - 0.13, u + a + 0.13, y1 - 0.22, y1 - 0.05, 0.19);
      } else {
        panel(out, 'dark', f, u - width / 2 + 0.09, u + width / 2 - 0.09, 5.28, 8.46, pane, -0.4);
      }
    }
    panel(out, 'wall', f, 0, length, y2, top, plaster);
    if (lod >= 2) {
      sill(out, f, 0.05, length - 0.05, y2 - 0.22, y2 - 0.06, 0.18);
      sill(out, f, 0.05, length - 0.05, 0.08, 0.31, 0.17, limestone);
    }
  }
}

function build(out, lod) {
  outerWalls(out, lod);
  roofs(out, lod);
  bellTower(out, lod);
  priorTower(out, lod);
  cloister(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'monastery-of-sant-jeroni-de-cotalba-model.mjs';
const camera = [-116, 32, 91];
const lookAt = [-6, 9.5, 3];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'religious',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: map.terrainContact.basis,
  brief:
    'The standing Alfauir monastery and church, with its tall crenellated Gothic belfry and open double-level cloister.',
  camera,
  lookAt,
  sunDirection: [-53, 64, 48],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.9,
    basis: 'The protected monastery’s current mapped perimeter.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'gothic-bell-tower-and-approach', position: [-82, 15, 52], lookAt: [-19, 11, 12] },
    {
      name: 'doorways-balconies-and-prioral-tower',
      position: [-77, 11, -47],
      lookAt: [-29, 8, -11],
    },
    { name: 'double-storey-cloister', position: [9.8, 11.5, -16.4], lookAt: [-2.6, 3.7, -1.1] },
    { name: 'roof-valleys-and-historic-court', position: [67, 83, 50], lookAt: [7, 5.5, -5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'cotalba-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.68,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.31, surfaces },
      street: { export: 'street', errorMeters: 0.14, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.049, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model based on photographer-dedicated Public Domain photographs, OpenStreetMap ODbL building geometry and attributed Spanish national elevation data.',
};
