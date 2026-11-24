import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { deform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {
  facade,
  fbox,
  opening,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.81 },
  siding: { slot: 'wall', graph: 'wood_painted_lap', roughness: 0.92 },
  timber: { slot: 'trim', graph: 'wood_vertical', roughness: 0.94 },
  foundation: { slot: 'foundation', graph: 'stone_basalt_raw', roughness: 0.97 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.56 },
};
const plank = rgb('91936f'),
  celadon = rgb('a6af86'),
  slate = rgb('7f8980');
const green = rgb('687562'),
  timber = rgb('6b5544'),
  lattice = rgb('b58e70');
const rock = rgb('62645d'),
  door = rgb('46554c'),
  glass = rgb('53615a');
const frame = facade(site.frame.origin, site.frame.along);
const front = facade([0, 0], [1, 0]);
const { porch } = site;

function face(out, slot, f, a, b, low, high, d, color) {
  const p = f.P;
  quad4(out, slot, p(a, low, d), p(b, low, d), p(b, high, d), p(a, high, d), color);
}

function wallShell(out, detail) {
  const outline = outwardRing(site.plan);
  for (const [i, a] of outline.entries()) {
    const b = outline[(i + 1) % outline.length],
      f = wallFace(a, b);
    const l = f.length;
    if (l < 0.024) continue;
    const mainFront = Math.abs(a[1]) < 0.024 && Math.abs(b[1]) < 0.024;
    const hallSide = Math.max(a[0], b[0]) < 38.2 && Math.min(a[1], b[1]) > -26.3;
    const top = mainFront ? 5.28 : hallSide ? 5.02 : 4.59;
    face(out, 'foundation', f, 0, l, site.foundationBottom, 0.78, 0, rock);
    face(out, 'siding', f, 0, l, 0.78, top, 0, mainFront ? green : celadon);
    if (!mainFront && detail > 0 && l > 4.1) {
      const bays = Math.floor(l / 4.31) || 1;
      for (let j = 0; j < bays; j++) {
        const u = ((j + 0.5) * l) / bays;
        if (detail === 1) face(out, 'glazing', f, u - 0.91, u + 0.91, 1.72, 3.18, 0.026, glass);
        else
          opening(out, f, u, 1.72, 1.82, 1.46, {
            glassSlot: 'glazing',
            frameSlot: 'timber',
            frame: green,
            glass,
            d: 0.043,
            frameWidth: 0.087,
            frameDepth: 0.095,
            mullions: 1,
            transoms: 1,
            mullionColor: timber,
          });
      }
    }
  }
  // Lower metal decks close the junctions between the three pitched roofs.
  cap(out, 'roof', outline, 4.5, green);
}

function hip(out, detail, a, b, low, high, eave, ridge) {
  const wide = b - a,
    depth = high - low;
  const x = (a + b) / 2,
    z = (low + high) / 2;
  const rx = Math.max(0.075, (wide - depth) * 0.45),
    rz = Math.max(0.075, (depth - wide) * 0.45);
  const eaves = [
    [a, eave, low],
    [a, eave, high],
    [b, eave, high],
    [b, eave, low],
  ];
  const crown = [
    [x - rx, ridge, z - rz],
    [x - rx, ridge, z + rz],
    [x + rx, ridge, z + rz],
    [x + rx, ridge, z - rz],
  ];
  loft(out, 'roof', [eaves, crown], slate);
  for (const [i, p] of eaves.entries()) {
    const j = (i + 1) % 4,
      q = eaves[j];
    beam(out, 'timber', [p[0], p[1] - 0.06, p[2]], [q[0], q[1] - 0.06, q[2]], 0.16, 0.2, green);
    if (detail > 1) {
      beam(
        out,
        'roof',
        [p[0], p[1] + 0.06, p[2]],
        [crown[i][0], ridge + 0.06, crown[i][2]],
        0.106,
        0.1,
        slate,
      );
    }
  }
}

function meshLattice(out, detail, a, b, y0, y1, d) {
  const p = front.P;
  fbox(out, 'timber', front, a, b, y0 - 0.08, y0, d - 0.05, d + 0.05, timber);
  fbox(out, 'timber', front, a, b, y1, y1 + 0.08, d - 0.05, d + 0.05, timber);
  if (detail < 2) {
    face(out, 'timber', front, a, b, y0, y1, d, lattice);
    return;
  }
  const spacing = detail === 2 ? 0.23 : 0.141;
  const height = y1 - y0;
  for (const direction of [-1, 1]) {
    for (let x = a - height; x <= b; x += spacing) {
      const left = Math.max(a, x),
        right = Math.min(b, x + height);
      if (right - left < 0.04) continue;
      const start = direction > 0 ? y0 + left - x : y1 - left + x;
      const finish = direction > 0 ? y0 + right - x : y1 - right + x;
      beam(
        out,
        'timber',
        p(left, start, d),
        p(right, finish, d + direction * 0.014),
        0.032,
        0.026,
        lattice,
      );
    }
  }
}

function veranda(out, detail) {
  const { center, deckHeight, distance, width, eave } = porch;
  const a = center - width / 2,
    b = center + width / 2;
  const places = [a, center - 4.15, center + 4.15, b];
  const p = front.P;
  fbox(
    out,
    'foundation',
    front,
    a,
    b,
    site.foundationBottom,
    deckHeight - 0.13,
    -0.05,
    distance - 0.07,
    rock,
  );
  fbox(out, 'timber', front, a, b, deckHeight - 0.15, deckHeight, -0.08, distance, timber);
  for (const u of places)
    fbox(
      out,
      'timber',
      front,
      u - 0.13,
      u + 0.13,
      deckHeight,
      eave - 0.18,
      distance - 0.23,
      distance,
      timber,
    );
  for (const u of [29.1, 37.63])
    fbox(
      out,
      'timber',
      front,
      u - 0.125,
      u + 0.125,
      0.08,
      eave - 0.15,
      distance - 0.25,
      distance,
      timber,
    );
  fbox(out, 'timber', front, a, b, eave - 0.3, eave - 0.11, distance - 0.23, distance, green);
  const flight = { half: 2.45, run: 2.83, count: [3, 5, 7, 9][detail] };
  for (let i = 0; i < flight.count; i++) {
    const t = i / flight.count,
      next = (i + 1) / flight.count;
    fbox(
      out,
      'foundation',
      front,
      center - flight.half,
      center + flight.half,
      -0.64,
      deckHeight * (1 - t),
      distance + t * flight.run,
      distance + next * flight.run,
      i % 2 === 0 ? rock : rgb('6c6960'),
    );
  }
  for (const x of [center - flight.half - 0.18, center + flight.half + 0.18]) {
    const a = p(x, deckHeight + 0.31, distance - 0.04),
      b = p(x, 0.31, distance + flight.run + 0.18);
    const ring = (d0, y) => [
      p(x - 0.26, y, d0),
      p(x - 0.26, -0.75, d0),
      p(x + 0.26, -0.75, d0),
      p(x + 0.26, y, d0),
    ];
    const inn = ring(distance - 0.03, deckHeight + 0.26);
    const end = ring(distance + flight.run + 0.18, 0.26);
    for (let j = 0; j < 4; j++) {
      const k = (j + 1) % 4;
      quad4(out, 'foundation', inn[j], inn[k], end[k], end[j], rock);
    }
    quad4(out, 'foundation', ...end.reverse(), rock);
    if (detail > 0) beam(out, 'foundation', a, b, 0.54, 0.13, rock);
  }
  for (const u of [center - 6.13, center + 6.13]) {
    face(out, 'glazing', front, u - 2.37, u + 2.37, deckHeight + 0.36, eave - 0.32, 0.07, glass);
  }
  face(out, 'glazing', front, center - 2.13, center + 2.13, deckHeight + 0.04, 4.08, 0.08, door);
  if (detail > 0)
    for (const [lo, hi] of [
      [places[0], places[1]],
      [places[2], places[3]],
    ]) {
      meshLattice(
        out,
        detail,
        lo + 0.16,
        hi - 0.16,
        deckHeight + 0.08,
        deckHeight + 0.85,
        distance - 0.09,
      );
      meshLattice(out, detail, lo + 0.16, hi - 0.16, eave - 1.26, eave - 0.33, distance - 0.09);
    }
}

function build(out, detail) {
  const local = deform(out, ([u, y, d]) => frame.P(u, y, d));
  wallShell(local, detail);
  hip(local, detail, -0.48, 38.55, -26.86, porch.distance + 0.61, porch.eave, porch.ridge);
  hip(local, detail, 38.01, 64.16, -27.18, -8.37, 4.58, 6.35);
  hip(local, detail, 35.53, 51.28, -59.03, -26.45, 4.56, 6.91);
  veranda(local, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
