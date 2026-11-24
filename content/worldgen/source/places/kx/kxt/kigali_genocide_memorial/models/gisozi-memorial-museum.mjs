import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  fbox,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  plaster: { slot: 'wall', graph: 'stucco', roughness: 0.95 },
  plinth: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94 },
  tile: { slot: 'roof', graph: 'tile_flat', roughness: 0.92 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.82 },
  steps: { slot: 'foundation', graph: 'stone_travertine', roughness: 0.94 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.59 },
};

const cream = rgb('d3bca9'),
  pale = rgb('d7c7b7'),
  stone = rgb('655f57'),
  paving = rgb('a99b86');
const aluminum = rgb('c9c6bd'),
  dark = rgb('575f5b'),
  clear = rgb('65706e'),
  shadow = rgb('77736d');
const tiles = ['aa8e70', 'b09a7c', 'b39b7e', 'ab9277', 'b7a082'].map(rgb);
const { outline, lobes, gable, hub, eave, grade, foundation } = site;
const ordered = outwardRing(outline)[0] === outline[0];
const next = (i) => (i + 1) % outline.length;
const edge = (i) =>
  ordered ? wallFace(outline[i], outline[next(i)]) : wallFace(outline[next(i)], outline[i]);

function panel(out, slot, f, from, to, bottom, top, d, color) {
  const p = f.P;
  quad4(out, slot, p(from, bottom, d), p(to, bottom, d), p(to, top, d), p(from, top, d), color);
}

function wall(out, slot, f, bottom, top, d, color) {
  panel(out, slot, f, 0, f.length, bottom, top, d, color);
}

function openings(out, f, width, bottom, top, details, options) {
  const { door = false, bays = 2 } = options;
  const left = (f.length - width) * 0.5;
  const right = left + width;
  const depth = -0.134;
  panel(out, 'plaster', f, 0, left, bottom, top, 0, cream);
  panel(out, 'plaster', f, right, f.length, bottom, top, 0, cream);
  panel(out, 'glass', f, left, right, bottom, top, depth, door ? dark : clear);
  if (details === 0) return;
  const frame = (x, y, a, b) => fbox(out, 'trim', f, x, y, a, b, depth - 0.01, 0.037, aluminum);
  const w = 0.045;
  frame(left, right, top - w * 2, top);
  frame(left, right, bottom, bottom + w * 2);
  for (let j = 0; j <= bays; j++) {
    const u = left + (width * j) / bays;
    frame(u - w, u + w, bottom, top);
  }
  if (details > 1) {
    const y = top - (door ? 0.48 : 0.32);
    frame(left, right, y - w, y + w);
    if (details === 3 && door) {
      const center = f.length * 0.5;
      frame(center - 0.15, center - 0.112, bottom + 0.92, bottom + 1.21);
      frame(center + 0.112, center + 0.15, bottom + 0.92, bottom + 1.21);
    } else if (details === 3) {
      fbox(
        out,
        'plaster',
        f,
        left - 0.055,
        right + 0.055,
        bottom - 0.082,
        bottom + 0.01,
        -0.155,
        0.094,
        pale,
      );
    }
  }
}

function buildFacade(out, detail, i) {
  const f = edge(i),
    front = site.front.includes(i),
    entry = i === 27 || i === 28;
  const sill = front ? 3.29 : 3.83;
  const header = front ? 5.81 : 5.58;
  wall(out, 'plinth', f, foundation, grade + 0.48, 0, stone);
  if (entry || (front && i > 23)) {
    openings(out, f, f.length * 0.78, grade + 0.115, 2.41, detail, { door: entry, bays: 2 });
    wall(out, 'plaster', f, grade + 0.079, grade + 0.115, 0.007, pale);
    wall(out, 'plaster', f, 2.41, sill, 0, cream);
  } else {
    wall(out, 'plaster', f, grade + 0.48, sill, 0, cream);
  }
  if (front || (i % 3 === 0 && f.length > 1.65))
    openings(out, f, Math.min(f.length * 0.78, front ? 3.47 : 1.42), sill, header, detail, {
      bays: front ? 3 : 2,
    });
  else wall(out, 'plaster', f, sill, header, 0, cream);
  wall(out, 'plaster', f, header, eave, 0, cream);
  if (detail > 1 && (front || i % 3 === 0)) {
    const mid = f.length * 0.5;
    panel(out, 'trim', f, mid - 0.23, mid + 0.23, eave - 0.24, eave - 0.16, 0.007, shadow);
  }
  if (i === gable || next(i) === gable) {
    const p = f.P,
      high = eave + 3.31;
    const peakAtEnd = ordered ? next(i) === gable : i === gable;
    const a = p(0, eave, 0),
      b = p(f.length, eave, 0),
      c = p(peakAtEnd ? f.length : 0, high, 0);
    tri(out, 'plaster', a, b, c, pale);
  }
  if (!entry) return;
  for (let j = 0; j < 3; j++) {
    const top = grade + 0.115 - 0.162 * j;
    fbox(out, 'steps', f, 0.04, f.length - 0.04, top - 0.29, top, 0.003, 0.37 + j * 0.29, paving);
  }
}

function roofTriangle(out, a, b, c, color) {
  const up = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
  tri(out, 'tile', a, ...(up > 0 ? [b, c] : [c, b]), color);
}

function buildRoof(out, detail) {
  const central = [hub[0], site.centralHeight, hub[1]];
  const outer = outline.map(([x, z], i) => [
    hub[0] + (x - hub[0]) * 1.025,
    eave + (i === gable ? 3.31 : 0),
    hub[1] + (z - hub[1]) * 1.025,
  ]);
  for (const [n, lobe] of lobes.entries()) {
    const ridge = [lobe.ridge[0], lobe.height, lobe.ridge[1]];
    const front = lobe.indices.map((i) => outer[i]);
    for (let i = 1; i < front.length; i++) {
      const a = front[i - 1],
        b = front[i];
      roofTriangle(out, a, b, ridge, tiles[(n + i) % tiles.length]);
      if (detail > 1) {
        const shift = (point) => [point[0], point[1] + 0.041, point[2]];
        if (i % 2 === 0)
          beam(out, 'tile', shift(a), shift(ridge), 0.12, 0.066, tiles[(n + 1) % tiles.length]);
        if (detail === 3) {
          const course = (eave, t) =>
            eave.map((v, axis) => v + (ridge[axis] - v) * t + (axis === 1 ? 0.012 : 0));
          for (let j = 1; j <= 5; j++) {
            const t = j / 6;
            const corners = [
              course(a, t),
              course(b, t),
              course(b, t + 0.009),
              course(a, t + 0.009),
            ];
            roofTriangle(out, corners[0], corners[1], corners[2], tiles[0]);
            roofTriangle(out, corners[0], corners[2], corners[3], tiles[0]);
          }
        }
      }
    }
    roofTriangle(out, front[0], central, ridge, tiles[n % tiles.length]);
    roofTriangle(out, ridge, central, front.at(-1), tiles[(n + 1) % tiles.length]);
    if (detail > 0) beam(out, 'tile', central, ridge, 0.22, 0.11, tiles[n % tiles.length]);
  }
  for (let i = 0; i < outer.length; i++) {
    const j = next(i),
      a = outer[i],
      b = outer[j];
    const c = [b[0], b[1] - 0.14, b[2]],
      d = [a[0], a[1] - 0.14, a[2]];
    quad4(out, 'trim', ...(ordered ? [d, c, b, a] : [c, d, a, b]), pale);
    const innerA = [outline[i][0], a[1] - 0.14, outline[i][1]];
    const innerB = [outline[j][0], b[1] - 0.14, outline[j][1]];
    quad4(out, 'plaster', ...(ordered ? [c, d, innerA, innerB] : [d, c, innerB, innerA]), pale);
  }
}

function build(out, detail) {
  for (let i = 0; i < outline.length; i++) buildFacade(out, detail, i);
  buildRoof(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
