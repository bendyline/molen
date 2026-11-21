import { readFileSync } from 'node:fs';
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  at,
  block,
  cap,
  closed,
  edge,
  face,
  mix,
  pairs,
  palette,
  panel,
  pavilion,
  rect,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const C = palette({
  wall: 'c4b7a5',
  tower: 'bbb09f',
  soffit: 'b0aaa0',
  cap: 'd1c9bb',
  tile: 'a27055',
  tileEdge: '946854',
  dark: '737066',
  frame: '54544d',
  glass: '586566',
  paving: 'a9a195',
  step: 'b5ada1',
  shadows: '8b8178',
  glazedFill: '6e7573',
  railing: '77756b',
});
const surfaces = {
  wall: surface('wall', 'stucco', 0.87),
  base: surface('foundation', 'concrete_plain', 0.89),
  tile: surface('roof', 'tile_ceramic', 0.88),
  cap: surface('trim', 'stone_travertine', 0.87),
  roof: surface('roof', 'concrete_boardformed', 0.88),
  glass: surface('window', 'storefront', 0.59, 0.03),
  frame: surface('trim', 'metal_painted', 0.75, 0.18),
};
const baseShell = { wall: 'wall', color: C.wall, roof: 'roof', roofColor: C.soffit };

function hippedRoof(out, bounds, y, rise, zAligned, lod) {
  const [l, a, r, b] = bounds;
  const [u0, v0, u1, v1] = zAligned ? [a, l, b, r] : bounds;
  const pad = 0.16,
    half = (v1 - v0) / 2 + pad,
    center = (v0 + v1) / 2;
  const inset = Math.min(half * 0.69, (u1 - u0) * 0.325);
  const section = (u, v, h) => (zAligned ? [v, h, u] : [u, h, v]);
  const left = u0 - pad,
    right = u1 + pad,
    vLow = v0 - pad,
    vHigh = v1 + pad;
  const p = section(left, vLow, y),
    q = section(right, vLow, y);
  const r1 = section(right, vHigh, y),
    s = section(left, vHigh, y);
  const h1 = section(left + inset, center, y + rise),
    h2 = section(right - inset, center, y + rise);
  for (const [i, strip] of [
    [p, q, h2, h1],
    [q, r1, h2],
    [r1, s, h1, h2],
    [s, p, h1],
  ].entries())
    face(out, 'tile', strip, up, i % 2 === 0 ? C.tile : C.tileEdge);
  if (lod < 2) return;
  beamPath(out, 'tile', [h1, h2], 0.14, 0.122, C.tileEdge);
  for (const [corner, crest] of [
    [p, h1],
    [q, h2],
    [r1, h2],
    [s, h1],
  ])
    beamPath(out, 'tile', [corner, crest], 0.108, 0.094, C.tileEdge);
}

function raisedRange(out, range, y, lowerTop, lod) {
  const { bounds, eaves, rise, name } = range;
  const [l, a, r, b] = bounds;
  const top = y + eaves;
  const polygon = rect(...bounds),
    walls = pairs(closed(polygon));
  const isLapidarium = name === 'lapidarium',
    twoStoreys = name === 'south-annex';
  const lightWall = { ...baseShell, color: twoStoreys ? C.tower : C.wall };
  shell(out, polygon, () => lowerTop - 0.04, top, lightWall);
  const fascia = rect(l - 0.27, a - 0.27, r + 0.27, b + 0.27);
  const eaveBand = { wall: 'cap', color: C.cap, roof: 'roof', roofColor: C.soffit };
  shell(out, fascia, () => top - 0.24, top + 0.13, eaveBand);
  hippedRoof(out, bounds, top + 0.127, rise, b - a > r - l, lod);
  for (const [index, [p, q]] of walls.entries()) {
    const w = edge(p, q);
    const publicFace = index === 0 || index === 2;
    if (lod > 0) panel(out, 'cap', w, 0, w.length, top - 0.67, top - 0.5, 0.009, C.cap);
    if (isLapidarium && index === 2) {
      const count = Math.max(3, Math.round(w.length / 3));
      for (let i = 0; i < count; i++) {
        const a = (i * w.length) / count,
          b = ((i + 1) * w.length) / count;
        panel(
          out,
          'glass',
          w,
          a + 0.18,
          b - 0.18,
          lowerTop + 0.03,
          top - 0.83,
          0.027,
          C.glazedFill,
        );
        if (lod > 0)
          trimBlock(
            out,
            'cap',
            w,
            a - 0.077,
            a + 0.114,
            lowerTop - 0.03,
            top - 0.5,
            0.034,
            0.302,
            C.cap,
          );
        if (lod > 1)
          panel(out, 'frame', w, a + 0.13, b - 0.12, top - 1.36, top - 1.26, 0.064, C.frame);
      }
    } else if (twoStoreys && publicFace) {
      const n = Math.max(3, Math.floor(w.length / 2.85)),
        major = (top + lowerTop) * 0.5;
      for (let i = 0; i < n; i++) {
        const u = ((i + 0.5) * w.length) / n;
        panel(out, 'glass', w, u - 0.66, u + 0.66, major - 0.51, major + 0.73, 0.027, C.glass);
        if (lod > 0)
          trimBlock(
            out,
            'cap',
            w,
            u - 0.71,
            u + 0.71,
            major - 0.65,
            major - 0.55,
            0.023,
            0.144,
            C.cap,
          );
      }
    } else if (lod > 1 && publicFace && w.length > 9.2) {
      const lower = top - 1.05,
        high = top - 0.73;
      panel(out, 'base', w, 0.9, w.length - 0.9, lower, high, 0.014, C.shadows);
      for (let u = 2.3; u < w.length - 1.2; u += 3) {
        panel(out, 'wall', w, u - 0.075, u + 0.075, lower, high, 0.027, C.cap);
      }
    }
  }
}

function perimeter(out, outline, y, ground, lod) {
  const top = y + 3.72,
    bottom = (p) => Math.min(y - 0.29, ground(p) - 0.24);
  const facing = areaSign(outline);
  for (const [index, [a, b]] of pairs(closed(outline)).entries()) {
    const w = edge(a, b, facing);
    face(
      out,
      'wall',
      [at(a, bottom(a)), at(b, bottom(b)), at(b, top), at(a, top)],
      w.normal,
      C.wall,
    );
    if (w.length < 1.15) continue;
    panel(out, 'base', w, 0, w.length, y - 0.14, y + 0.27, 0.016, C.soffit);
    if (lod > 0) panel(out, 'cap', w, 0, w.length, top - 0.22, top - 0.053, 0.038, C.cap);
    const longCourt = index === 43,
      approaching = index === 17 || index === 30 || index === 67;
    if (!longCourt && !approaching) continue;
    const count = Math.max(1, Math.round(w.length / 4.5));
    const size = w.length / count;
    for (let i = 0; i < count; i++) {
      const a = i * size,
        b = (i + 1) * size;
      if (longCourt && i < 2) continue;
      const prop = i % 3 === 0 ? 0.18 : 0.32;
      panel(
        out,
        'glass',
        w,
        a + prop,
        b - prop,
        y + 0.22,
        top - 0.66,
        0.033,
        i % 3 === 0 ? C.glazedFill : C.glass,
      );
      if (lod > 0) {
        panel(out, 'frame', w, a + prop, b - prop, top - 1.42, top - 1.32, 0.061, C.frame);
        trimBlock(out, 'cap', w, a, a + 0.15, y + 0.09, top - 0.33, 0.025, 0.18, C.cap);
        if (lod === 3) {
          const u = (a + b) / 2;
          panel(out, 'frame', w, u - 0.033, u + 0.033, y + 0.22, top - 0.66, 0.076, C.frame);
        }
      }
    }
  }
  cap(out, 'roof', outline, top, C.soffit);
}

function gardenTerrace(out, ground, y, lod) {
  const apron = rect(-21.89, 0.987, 47.4, 5.84);
  const edgeFront = edge(apron[2], apron[3]);
  const lower = (p) => Math.min(ground(p) - 0.19, y - 0.28);
  cap(out, 'base', apron, y + 0.015, C.paving);
  for (const [a, b] of pairs(closed(apron))) {
    const w = edge(a, b);
    face(out, 'base', [at(a, lower(a)), at(b, lower(b)), at(b, y), at(a, y)], w.normal, C.step);
  }
  if (lod === 0) return;
  trimBlock(out, 'cap', edgeFront, 0, edgeFront.length, y - 0.2, y + 0.056, -0.03, 0.19, C.step);
  for (const [left, right] of [
    [-13.1, -4.5],
    [22.7, 31.7],
  ]) {
    const accessGround = Math.max(ground([left, 8.25]), ground([right, 8.25])) + 0.055;
    if (accessGround >= y - 0.11) {
      cap(out, 'base', rect(left, 5.81, right, 7.65), y + 0.018, C.step);
      continue;
    }
    const count = lod === 1 ? 3 : 5;
    for (let i = 0; i < count; i++) {
      const h = mix(y, accessGround, i / count),
        z = 5.73 + (1.68 * i) / count;
      const base = Math.min(h - 0.17, ground([left, z]) - 0.19, ground([right, z]) - 0.19);
      block(out, 'base', left, base, z, right - left, h - base, 1.68 / count + 0.014, C.step);
    }
  }
  if (lod > 1)
    for (let x = -21.3; x < 46.4; x += lod === 3 ? 3 : 6)
      block(out, 'base', x, y + 0.016, 1.14, 0.019, 0.005, 4.62, C.shadows);
}

function draw(out, lod, d, ground) {
  const { floor, outline, ranges } = d;
  perimeter(out, outline, floor, ground, lod);
  gardenTerrace(out, ground, floor, lod);
  for (const range of ranges) raisedRange(out, range, floor, floor + 3.72, lod);
}

const museum = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [111, 96, 125],
    lookAt: [0, 3.6, -3],
    yaw: 0.68,
    sun: [-450, 620, 730],
    brief:
      'The original Antalya Archaeological Museum as seen in June 2024. Its layered tile-roofed galleries and enclosed lapidarium wrap the large southern exhibition garden.',
    views: [
      {
        name: 'south-garden-and-enclosed-lapidarium',
        position: [20, 15.4, 28.8],
        lookAt: [18, 3.44, -1],
      },
      { name: 'historic-articulated-roofplan', position: [35, 121, 55], lookAt: [0, 3, -4] },
      {
        name: 'west-galleries-and-later-hipped-roofs',
        position: [-65, 27, -56],
        lookAt: [-20, 3.75, -33],
      },
      {
        name: 'attached-south-ranges-and-two-storey-annex',
        position: [86, 26, 61],
        lookAt: [44, 4.7, 38],
      },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = museum;
const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const model = {
  ...museum.model,
  geographicStatus: 'historical-proposal',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  sourceLicense:
    'Independent reconstruction from the June 2024 OpenStreetMap museum footprint, primary written conservation records and original Terrarium terrain.',
  recipeDependencies: [...museum.model.recipeDependencies, 'authored-structure-mesh.mjs'],
  buildingCutout: {
    outline: plan.dimensions.outline,
    minimumCoverage: 0.91,
    basis:
      'The map-dated polygon represents the original museum and suppresses the matching generated geometry during the supported historical period.',
  },
};
