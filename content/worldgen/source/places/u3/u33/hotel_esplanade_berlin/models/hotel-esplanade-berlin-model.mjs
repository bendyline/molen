import { readFileSync } from 'node:fs';
import {
  arch,
  areaSign,
  at,
  block,
  cap,
  closed,
  edge,
  face,
  opening,
  pairs,
  palette,
  panel,
  pavilion,
  planarMid,
  rect,
  ring,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const color = palette({
  stone: 'b8aea0',
  interiorStone: 'c8bca8',
  lightStone: 'd0c1a7',
  trim: 'aa9d88',
  lower: '938679',
  base: '79736b',
  shadow: '8c8275',
  glass: '3d4a4f',
  metal: '4a504a',
  slate: '57595a',
  roof: '6c6865',
  zinc: '7e857f',
  garden: '737f53',
  walk: 'b3a78d',
  hedge: '586245',
  water: '768980',
});
const surfaces = {
  stone: surface('wall', 'stone_sandstone', 0.93),
  lower: surface('foundation', 'stone_ashlar', 0.96),
  roof: surface('roof', 'metal_painted', 0.86, 0.14),
  trim: surface('trim', 'stone_sandstone', 0.9),
  glazing: surface('window', 'storefront', 0.51, 0.09),
  metal: surface('trim', 'metal_painted', 0.79, 0.2),
  garden: surface('trim', 'plaster_lime', 0.95),
};
const archColors = { inner: color.glass, trim: color.lightStone, width: 0.12 };
const archSlots = { inner: 'glazing', trim: 'trim' };
const windowYs = [8.25, 12.15, 15.78, 19.15];
const windowHeights = [2.33, 2.18, 2.02, 1.52];

function edgeBlock(out, slot, w, l, r, y0, y1, before, after, tint) {
  const profile = [
    [l, y0],
    [r, y0],
    [r, y1],
    [l, y1],
  ];
  for (const [a, b] of pairs(closed(profile))) {
    const outward =
      Math.abs(a[0] - b[0]) > 0.01
        ? [0, a[1] === y0 ? -1 : 1, 0]
        : Math.sign(a[0] - (l + r) / 2) > 0
          ? [-w.normal[2], 0, w.normal[0]]
          : [w.normal[2], 0, -w.normal[0]];
    face(
      out,
      slot,
      [w.p(...a, before), w.p(...b, before), w.p(...b, after), w.p(...a, after)],
      outward,
      tint,
    );
  }
  panel(out, slot, w, l, r, y0, y1, after, tint);
}

function wallBase(out, w, y, top, bottom, kind) {
  const tint = kind === 'court' ? color.interiorStone : color.stone;
  const points = [
    [0, bottom[0]],
    [w.length, bottom[1]],
    [w.length, y + 6.35],
    [0, y + 6.35],
  ];
  face(
    out,
    'lower',
    points.map(([x, h]) => w.p(x, h)),
    w.normal,
    color.lower,
  );
  panel(out, 'stone', w, 0, w.length, y + 6.35, top, 0, tint);
}

function bay(out, w, x, y, lod, ornate) {
  const width = ornate ? 1.65 : 1.44;
  arch(
    out,
    w,
    x,
    y + 0.85,
    y + 3.68,
    ornate ? 1.23 : 0.92,
    ornate ? 1.05 : 0.79,
    0.028,
    lod,
    archColors,
    archSlots,
  );
  if (lod === 3) panel(out, 'trim', w, x - 0.024, x + 0.024, y + 0.84, y + 4.14, 0.059, color.trim);
  for (const [i, center] of windowYs.entries()) {
    const bottom = y + center - 1.05;
    const top = bottom + windowHeights[i];
    opening(
      out,
      w,
      x - width / 2,
      x + width / 2,
      bottom,
      top,
      'trim',
      color.glass,
      'glazing',
      color.lightStone,
      lod,
      0.027,
    );
    if (lod > 1 && i < 3) {
      panel(
        out,
        'trim',
        w,
        x - width * 0.56,
        x + width * 0.56,
        top - 0.52,
        top - 0.45,
        0.056,
        color.trim,
      );
      panel(
        out,
        'stone',
        w,
        x - width * 0.71,
        x + width * 0.71,
        bottom - 0.14,
        bottom + 0.015,
        0.09,
        color.lightStone,
      );
      if (lod === 3 && ornate && (i === 0 || i === 2)) {
        edgeBlock(
          out,
          'stone',
          w,
          x - width * 0.7,
          x + width * 0.7,
          bottom - 0.16,
          bottom + 0.025,
          0.015,
          0.49,
          color.trim,
        );
        panel(
          out,
          'metal',
          w,
          x - width * 0.67,
          x + width * 0.67,
          bottom + 0.05,
          bottom + 0.35,
          0.48,
          color.metal,
        );
      }
    }
  }
}

function wall(out, a, b, y, top, ground, lod, kind, sign) {
  const w = edge(a, b, sign);
  const street = kind === 'street';
  const court = kind === 'court';
  const ornate = street || court;
  wallBase(
    out,
    w,
    y,
    top,
    [Math.min(ground(a) - 0.21, y - 0.19), Math.min(ground(b) - 0.21, y - 0.19)],
    kind,
  );
  const bands = lod === 0 ? [6.5, 20.8] : [0.24, 5.82, 6.38, 10.46, 17.58, 20.8];
  for (const band of bands) {
    const ht = band === 20.8 ? 0.36 : 0.15;
    panel(out, 'trim', w, 0, w.length, y + band, y + band + ht, 0.08, color.trim);
  }
  if (lod === 3 && ornate)
    for (const h of [0.7, 1.18, 1.67, 2.16, 2.65, 3.14, 3.63, 4.12, 4.61, 5.1, 5.59])
      panel(out, 'lower', w, 0, w.length, y + h, y + h + 0.026, 0.012, color.shadow);
  if (w.length < 2.6) return;
  const bays = Math.max(1, Math.round(w.length / (street ? 4.05 : court ? 3.55 : 4.4)));
  for (const i of Array.from({ length: bays }, (_, i) => i)) {
    const x = (w.length * (i + 0.5)) / bays;
    if (street && [15.1, 60.8].some((door) => Math.abs(x - door) < 3.6)) continue;
    if (lod === 0) {
      if (i % 3 === 1)
        panel(out, 'glazing', w, x - 0.68, x + 0.68, y + 7.25, y + 16.4, 0.035, color.glass);
    } else if (lod === 1 || (!ornate && lod === 2)) {
      panel(out, 'glazing', w, x - 0.9, x + 0.9, y + 1.1, y + 4.58, 0.028, color.glass);
      for (const [i, center] of windowYs.entries())
        panel(
          out,
          'glazing',
          w,
          x - 0.76,
          x + 0.76,
          y + center - 1.05,
          y + center - 1.05 + windowHeights[i],
          0.028,
          color.glass,
        );
    } else {
      bay(out, w, x, y, lod, ornate);
      if (court && lod > 1 && i === 0 && w.length > 4)
        panel(out, 'trim', w, 0.32, 0.52, y + 6.52, y + 20.74, 0.054, color.trim);
    }
  }
}

function roofScale(outline, delta) {
  const [x, z] = planarMid(outline);
  return outline.map(([a, b]) => [a + (x - a) * delta, b + (z - b) * delta]);
}

function roofPanel(out, low, high, bottom, top) {
  for (let i = 0; i < low.length; i++) {
    const j = (i + 1) % low.length;
    face(
      out,
      'roof',
      [at(low[i], bottom), at(low[j], bottom), at(high[j], top), at(high[i], top)],
      up,
      color.slate,
    );
  }
}

function roofSurface(out, outline, holes, y) {
  const points = outline.concat(...holes);
  let i = outline.length;
  const limits = holes.map((hole) => {
    const start = i;
    i += hole.length;
    return start;
  });
  const triangles = earcut(points.flat(), limits);
  for (let j = 0; j < triangles.length; j += 3)
    face(
      out,
      'roof',
      triangles.slice(j, j + 3).map((k) => at(points[k], y)),
      up,
      color.roof,
    );
}

function openingCourt(out, outline, floor, eaves, ground, lod, kind) {
  const winding = -areaSign(outline);
  for (const [a, b] of pairs(closed(outline)))
    wall(out, a, b, floor, eaves, ground, lod, kind, winding);
}

function dormerRoof(out, cx, z, halfWidth, length, y, eaves, ridge, lod) {
  const footprint = rect(cx - halfWidth, z, cx + halfWidth, z + length);
  shell(out, footprint, () => y, eaves, {
    wall: 'stone',
    roof: 'roof',
    color: color.stone,
    roofColor: color.roof,
  });
  const high = rect(cx - halfWidth * 0.67, z + 1.25, cx + halfWidth * 0.67, z + length - 1.45);
  roofPanel(out, footprint, high, eaves, ridge);
  cap(out, 'roof', high, ridge, color.slate);
  if (lod > 0) {
    const w = edge(footprint[0], footprint[1]);
    for (const n of [-1, 0, 1])
      opening(
        out,
        w,
        halfWidth + n * 2.1 - 0.6,
        halfWidth + n * 2.1 + 0.6,
        y + 0.27,
        eaves - 0.3,
        'trim',
        color.glass,
        'glazing',
        color.trim,
        lod,
        0.037,
      );
  }
}

function streetPortal(out, w, x, y, width, lod, main) {
  edgeBlock(
    out,
    'stone',
    w,
    x - width / 2,
    x + width / 2,
    y - 0.47,
    y + 8.9,
    -0.06,
    0.5,
    color.stone,
  );
  arch(out, w, x, y + 0.55, y + 3.05, width * 0.248, 1.48, 0.55, lod, archColors, archSlots);
  if (lod > 0) {
    for (const side of [-1, 1]) {
      const c = x + side * width * 0.392;
      edgeBlock(
        out,
        'trim',
        w,
        c - 0.23,
        c + 0.23,
        y + 0.36,
        y + 5.38,
        0.49,
        0.82,
        color.lightStone,
      );
      panel(out, 'trim', w, c - 0.45, c + 0.45, y + 4.98, y + 5.45, 0.85, color.lightStone);
    }
    arch(out, w, x, y + 6.55, y + 7.57, width * 0.275, 0.85, 0.534, lod, archColors, archSlots);
  }
  if (main) {
    edgeBlock(out, 'metal', w, x - 2.3, x + 2.3, y + 3.77, y + 4.06, 0.55, 2.7, color.metal);
    for (let i = 0; i < [1, 3, 4, 5][lod]; i++)
      edgeBlock(
        out,
        'lower',
        w,
        x - 2.42,
        x + 2.42,
        y - 0.54,
        y + 0.55 * (1 - i / [1, 3, 4, 5][lod]),
        0.48,
        0.75 + 0.35 * i,
        color.trim,
      );
    if (lod > 1)
      for (const side of [-1, 1])
        edgeBlock(
          out,
          'metal',
          w,
          x + side * 1.96 - 0.075,
          x + side * 1.96 + 0.075,
          y + 0.17,
          y + 3.83,
          2.47,
          2.61,
          color.metal,
        );
  }
}

function formalCourt(out, outline, y, lod) {
  cap(out, 'trim', outline, y, color.walk);
  const [cx, cz] = [15.5, 13.1];
  const garden = [
    [cx - 9.8, cz - 8.6],
    [cx - 4.1, cz - 11],
    [cx + 4.1, cz - 11],
    [cx + 9.8, cz - 8.6],
    [cx + 9.8, cz + 8.6],
    [cx + 3.9, cz + 11.6],
    [cx - 3.9, cz + 11.6],
    [cx - 9.8, cz + 8.6],
  ];
  cap(out, 'garden', garden, y + 0.03, color.garden);
  ring(
    out,
    'trim',
    [cx, cz],
    [
      [y + 0.04, 3.35],
      [y + 0.42, 3.25],
      [y + 0.49, 2.98],
      [y + 0.21, 2.72],
    ],
    [12, 16, 20, 28][lod],
    color.lightStone,
  );
  ring(
    out,
    'trim',
    [cx, cz],
    [
      [y + 0.22, 1.57],
      [y + 1.29, 1.57],
      [y + 1.36, 1.49],
    ],
    [10, 14, 20, 24][lod],
    color.trim,
  );
  ring(
    out,
    'metal',
    [cx, cz],
    [
      [y + 0.28, 2.73],
      [y + 0.28, 0.04],
    ],
    [12, 16, 20, 28][lod],
    color.water,
  );
  ring(
    out,
    'metal',
    [cx, cz],
    [
      [y + 1.35, 1.48],
      [y + 1.35, 0.04],
    ],
    [10, 14, 20, 24][lod],
    color.water,
  );
  const terrace = rect(0.7, -7.2, 31.8, -2.2);
  shell(out, terrace, () => y, y + 1.48, {
    wall: 'trim',
    color: color.trim,
    roofColor: color.walk,
  });
  if (lod > 0)
    for (const x of [4, 25.1])
      for (let i = 0; i < 5; i++)
        block(out, 'trim', x, y, -2.2 + 0.53 * i, 3.4, 1.48 - 0.26 * i, 0.53, color.lightStone);
  if (lod > 1)
    for (const center of [
      [9.7, -2.4],
      [21.6, -2.4],
      [30, -2.4],
      [0.9, -2.4],
    ]) {
      ring(
        out,
        'trim',
        center,
        [
          [y + 1.48, 0.5],
          [y + 2.05, 0.5],
          [y + 2.14, 0.44],
        ],
        8,
        color.trim,
      );
      ring(
        out,
        'garden',
        center,
        [
          [y + 2.09, 0.41],
          [y + 2.54, 0.56],
          [y + 2.85, 0.21],
          [y + 2.89, 0.025],
        ],
        lod === 3 ? 10 : 6,
        color.hedge,
      );
    }
  if (lod === 3)
    for (const [a, b] of pairs(closed(garden))) {
      const w = edge(a, b, areaSign(garden));
      edgeBlock(out, 'garden', w, 0, w.length, y + 0.04, y + 0.37, -0.32, 0.05, color.hedge);
    }
}

function draw(out, lod, d, ground) {
  const y = d.floor;
  const eaves = y + d.bodyEaves;
  const top = y + d.mainRoof;
  const openings = [d.court, ...d.holes];
  const winding = areaSign(d.outline);
  for (const [i, [a, b]] of pairs(closed(d.outline)).entries())
    wall(
      out,
      a,
      b,
      y,
      eaves,
      ground,
      lod,
      i === d.outline.length - 1 ? 'street' : 'outside',
      winding,
    );
  openingCourt(out, d.court, y, eaves, ground, lod, 'court');
  for (const hole of d.holes) {
    openingCourt(out, hole, y + 0.18, eaves, ground, Math.min(lod, 2), 'well');
  }
  const upper = roofScale(d.outline, 0.034);
  const raisedOpenings = openings.map((hole) => roofScale(hole, -0.054));
  roofPanel(out, d.outline, upper, eaves - 0.025, top);
  for (const [i, hole] of openings.entries())
    roofPanel(out, hole, raisedOpenings[i], eaves - 0.025, top);
  roofSurface(out, upper, raisedOpenings, top);
  const front = edge(d.outline.at(-1), d.outline[0], winding);
  streetPortal(out, front, 60.8, y, 8.2, lod, true);
  streetPortal(out, front, 15.1, y, 6.15, lod, false);
  for (const [left, right] of [
    [53.9, 67.7],
    [9.2, 20.7],
  ]) {
    for (const u of [left, right])
      edgeBlock(
        out,
        'trim',
        front,
        u - 0.29,
        u + 0.29,
        y + 6.45,
        eaves - 0.16,
        0.005,
        0.43,
        color.lightStone,
      );
    panel(
      out,
      'trim',
      front,
      left - 0.14,
      right + 0.14,
      eaves - 0.52,
      eaves - 0.21,
      0.42,
      color.lightStone,
    );
  }
  dormerRoof(out, 13.8, -45.45, 7.6, 10.2, eaves - 0.18, y + 25.05, y + d.pavilionRidge, lod);
  dormerRoof(out, -31.9, -45.24, 5.25, 8.3, eaves - 0.18, y + 24.15, y + 26.7, lod);
  formalCourt(out, d.court, y + 0.04, lod);
  for (const [i, hole] of d.holes.entries()) {
    if (i === 1 || i === 2) {
      const [x, z] = planarMid(hole);
      const h = y + (i === 1 ? 10.7 : 9.4);
      const hip = roofScale(hole, 0.55);
      roofPanel(out, hole, hip, h, h + (i === 1 ? 2.3 : 2.0));
      cap(out, 'glazing', hip, h + (i === 1 ? 2.3 : 2.0), color.zinc);
      if (lod > 0)
        for (const offset of [-0.78, 0, 0.78]) {
          const w = edge([x - 2.2, z + offset], [x + 2.2, z + offset]);
          panel(
            out,
            'metal',
            w,
            0,
            w.length,
            h + (i === 1 ? 2.3 : 2.0),
            h + (i === 1 ? 2.3 : 2.0) + 0.09,
            0,
            color.metal,
          );
        }
    } else {
      cap(out, 'trim', hole, y + 0.19, color.walk);
    }
  }
}

const authored = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [117, 103, -144],
    lookAt: [2, 11, -3],
    yaw: 0.8,
    sun: [-76, 127, -110],
    brief:
      'The prewar Grand Hotel Esplanade at its original Bellevuestraße address, with its mansard-roofed stone wings and formal garden court.',
    views: [
      {
        name: 'the-94-meter-bellevuestrasse-front',
        position: [81, 22, -114],
        lookAt: [0, 12, -38],
      },
      { name: 'the-formal-garden-terrace-and-fountain', position: [33, 9, 28], lookAt: [7, 6, -6] },
      { name: 'prewar-roofs-and-open-courts', position: [-94, 96, 95], lookAt: [1, 8, -1] },
      { name: 'rusticated-main-entry', position: [23, 7, -63], lookAt: [13.8, 5.7, -43] },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = authored;
const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const model = {
  ...authored.model,
  category: 'hotel-commercial',
  geographicStatus: 'historical-proposal',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  recipeDependencies: [...authored.model.recipeDependencies],
  sourceLicense:
    'Independent architectural reconstruction from the original 1913 Berlin public-domain plates, Qualla courtyard image, and Berlin archival map and aerial survey.',
  buildingCutout: {
    outline: plan.dimensions.outline,
    minimumCoverage: 0.86,
    basis:
      'Suppresses coincident generated building geometry only within the documented prewar hotel site during its historical appearance.',
  },
};
