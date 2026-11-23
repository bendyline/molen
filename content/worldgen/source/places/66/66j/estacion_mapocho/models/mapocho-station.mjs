import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { deform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {
  facade, fan, fbox, gableRoof, opening, outwardRing, quad4, rgb, roundArch, tri, wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.94 },
  trim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.9 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.95 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.77 },
  iron: { slot: 'trim', graph: 'metal_corrugated', roughness: 0.86 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.63 },
};
const stone = rgb('dbbfaa'), trim = rgb('e2cbb6'), plinth = rgb('9d8b82');
const bronze = rgb('766552'), blue = rgb('677480'), glazing = rgb('454c48');
const reed = rgb('767e6d'), roof = rgb('777575'), warm = rgb('a87256');
const frame = facade(site.frame.origin, site.frame.along);
const front = facade([0, 0], [1, 0]);
const { width } = site.frame;
const { wallHeight, archCenters, archRadius, domeCenters, domeHeight } = site.front;
const floor = 0.52, eave = 17.55;

function face(out, slot, f, a, b, low, high, d, color) {
  const p = f.P;
  quad4(out, slot, p(a, low, d), p(b, low, d), p(b, high, d), p(a, high, d), color);
}

function window(out, detail, f, u, y, w, h, head = 'round') {
  if (detail < 2) {
    face(out, 'glass', f, u - w / 2, u + w / 2, y, y + h, 0.026, glazing);
    return;
  }
  opening(out, f, u, y, w, h, {
    head, glassSlot: 'glass', frameSlot: 'trim', glass: glazing, frame: trim,
    frameWidth: 0.16, frameDepth: 0.14, mullions: 1, transoms: 1,
    mullionColor: bronze, d: 0.056,
  });
}

function sides(out, detail) {
  const ring = outwardRing(site.plan);
  for (const [i, a] of ring.entries()) {
    const b = ring[(i + 1) % ring.length];
    if (Math.abs(a[1]) < 0.018 && Math.abs(b[1]) < 0.018) continue;
    const f = wallFace(a, b), l = f.length;
    if (l < 0.016) continue;
    const height = Math.max(a[1], b[1]) < -90.5 ? 11.8 : eave;
    face(out, 'base', f, 0, l, site.foundationBottom, floor, 0, plinth);
    face(out, 'stone', f, 0, l, floor, height, 0, stone);
    face(out, 'trim', f, 0, l, height - 0.51, height - 0.19, 0.13, trim);
    if (detail === 0 || l < 4.3) continue;
    const n = Math.max(1, Math.floor(l / 4.29));
    for (let j = 0; j < n; j++) {
      const u = ((j + 0.5) * l) / n;
      window(out, detail, f, u, height - 5.25, 1.62, 3.52);
      if (detail > 1) window(out, detail === 2 ? 1 : detail, f, u, 2.55, 1.39, 3.56, 'flat');
      if (detail > 0 && j)
        fbox(out, 'trim', f, (j * l) / n - 0.17, (j * l) / n + 0.17, floor, height - 0.48, 0, 0.14, trim);
    }
  }
  cap(out, 'roof', ring, 11.76, roof);
  cap(out, 'roof', [[0.02, -0.05], [width - 0.02, -0.05], [width - 0.12, -12.2], [0.13, -12.2]], eave, roof);
}

function shed(out, detail) {
  const s = site.shed;
  const p = (u, y, d) => [u + s.center, y, d];
  const arc = roundArch(s.width / 2, [6, 10, 16, 24][detail])
    .map(([x, y]) => [x, s.eaves + (y / (s.width / 2)) * (s.ridge - s.eaves)]);
  cap(out, 'roof', [[2.48, -85.7], [59.9, -85.7], [59.9, -14.4], [2.48, -14.4]], s.eaves - 0.08, roof);
  for (let i = 1; i < arc.length; i++) {
    const [a, h] = arc[i - 1], [b, y] = arc[i];
    quad4(out, 'roof', p(a, h, s.from), p(b, y, s.from), p(b, y, s.to), p(a, h, s.to), i % 2 ? roof : rgb('817a75'));
    for (const d of [s.from, s.to]) {
      const ring = [p(a, h, d), p(b, y, d), p(b, s.eaves, d), p(a, s.eaves, d)];
      if (i === 1) ring.pop();
      if (i === arc.length - 1) ring.splice(2, 1);
      fan(out, 'stone', d === s.from ? ring.reverse() : ring, warm);
    }
    if (detail > 0) {
      beam(out, 'iron', p(a, h + 0.04, s.from), p(a, h + 0.04, s.to), 0.065, 0.066, bronze);
      for (const d of [s.from + 0.05, s.to - 0.05])
        beam(out, 'iron', p(a, h + 0.08, d), p(b, y + 0.08, d), 0.105, 0.137, blue);
    }
  }
}

function pavilion(out, detail, u) {
  const p = front.P, l = u - 5.9, r = u + 5.9, hi = wallHeight - 0.62;
  face(out, 'stone', front, l, r, floor, hi, 0, stone);
  for (const [a, b] of [[l + 0.25, l + 0.89], [r - 0.89, r - 0.25]])
    fbox(out, 'trim', front, a, b, floor, hi, 0, 0.34, trim);
  for (const y of [1.06, 6.86, 8.92, hi - 0.43])
    fbox(out, 'trim', front, l, r, y, y + 0.25, 0, 0.29, trim);
  window(out, detail, front, u, floor + 0.13, 5.1, 5.57, 'flat');
  for (const offset of [-2.17, 0, 2.17])
    window(out, detail, front, u + offset, 9.23, 1.57, 5.08);
  fbox(out, 'stone', front, l, r, hi - 1.5, wallHeight, -12.05, -0.04, stone);
  const left = p(l + 0.53, 17.6, 0.42), right = p(r - 0.53, 17.6, 0.42), tip = p(u, 19.39, 0.42);
  tri(out, 'trim', left, right, tip, trim);
  if (detail > 0) for (const [a, b] of [[left, tip], [tip, right], [right, left]])
    beam(out, 'trim', a, b, 0.32, 0.32, stone);
  const arc = detail === 0 ? 4 : detail === 1 ? 6 : 9;
  const dome = Array.from({ length: arc + 1 }, (_, i) => {
    const t = (i * Math.PI) / (2 * arc);
    return radialRing(wallHeight + (domeHeight - wallHeight) * Math.sin(t),
      Math.max(0.048, 5.52 * Math.cos(t)), Math.max(0.048, 5.3 * Math.cos(t)),
      [8, 16, 24, 32][detail], [u, -6.63]);
  });
  loft(out, 'roof', dome, blue);
  beam(out, 'iron', [u, domeHeight - 0.09, -6.63], [u, domeHeight + 5.62, -6.63], 0.068, 0.068, bronze);
  if (detail === 3) for (let i = 0; i < dome[0].length; i += 2) {
    for (let j = 1; j < dome.length - 1; j++) {
      const offset = ([x, y, z]) => [u + (x - u) * 1.007, y + 0.028, -6.63 + (z + 6.63) * 1.007];
      beam(out, 'iron', offset(dome[j - 1][i]), offset(dome[j][i]), 0.05, 0.055, blue);
    }
  }
}

function portal(out, detail, u) {
  const r = archRadius, spring = 10.04, p = front.P;
  const arc = roundArch(r, [5, 8, 13, 19][detail]);
  const soffit = 0.81, recess = -0.76;
  for (const [[a, h], [b, y]] of arc.slice(1).map((q, i) => [arc[i], q])) {
    const headA = spring + h, headB = spring + y;
    quad4(out, 'stone', p(u + a, headA, 0), p(u + b, headB, 0),
      p(u + b, wallHeight, 0), p(u + a, wallHeight, 0), stone);
    quad4(out, 'glass', p(u + a, spring - 0.11, recess), p(u + b, spring - 0.11, recess),
      p(u + b, headB, recess), p(u + a, headA, recess), glazing);
    if (detail < 1) continue;
    const q = (x, y) => p(u + x * (r + soffit) / r, spring + y * (r + soffit) / r, 0.29);
    quad4(out, 'trim', p(u + a, headA, 0.29), p(u + b, headB, 0.29), q(b, y), q(a, h), trim);
    quad4(out, 'trim', p(u + a, headA, recess), p(u + b, headB, recess),
      p(u + b, headB, 0.29), p(u + a, headA, 0.29), plinth);
  }
  const halfDoor = 5.2;
  face(out, 'glass', front, u - halfDoor, u + halfDoor, floor, spring, recess, glazing);
  for (const s of [-1, 1]) {
    const x = u + s * halfDoor;
    face(out, 'stone', front, Math.min(x, u + s * r), Math.max(x, u + s * r), floor, spring, 0, stone);
    fbox(out, 'trim', front, x - 0.31, x + 0.31, floor, 7.52, recess, 0.41, trim);
  }
  if (detail === 0) return;
  for (const y of [3.24, 5.39, 7.42, spring])
    fbox(out, 'iron', front, u - halfDoor, u + halfDoor, y, y + 0.124, recess, recess + 0.22, bronze);
  const n = detail === 1 ? 4 : 9;
  for (let i = 1; i < n; i++) {
    const x = (i / n * 2 - 1) * halfDoor;
    const y = spring + Math.sqrt(r * r - x * x) - 0.34;
    fbox(out, 'iron', front, u + x - 0.049, u + x + 0.049, floor, y, recess, recess + 0.17, bronze);
  }
  if (detail > 1) {
    fan(out, 'iron', Array.from({ length: 15 }, (_, i) =>
      p(u + 0.8 * Math.cos(i * Math.PI * 2 / 15), 11.68 + 0.8 * Math.sin(i * Math.PI * 2 / 15), recess + 0.21)), bronze);
    fan(out, 'glass', Array.from({ length: 15 }, (_, i) =>
      p(u + 0.61 * Math.cos(i * Math.PI * 2 / 15), 11.68 + 0.61 * Math.sin(i * Math.PI * 2 / 15), recess + 0.24)), glazing);
  }
}

function plazaFront(out, detail) {
  const p = front.P;
  face(out, 'base', front, 0, width, site.foundationBottom, floor, 0, plinth);
  const gaps = [0, ...archCenters.flatMap(u => [u - archRadius, u + archRadius]), width];
  for (let i = 0; i < gaps.length; i += 2)
    face(out, 'stone', front, gaps[i], gaps[i + 1], floor, wallHeight, -0.035, stone);
  for (const u of domeCenters) pavilion(out, detail, u);
  for (const u of archCenters) portal(out, detail, u);
  for (const [y, h, depth] of [[0.69, 0.38, 0.35], [7.7, 0.25, 0.43], [17.39, 0.52, 0.53], [18.68, 0.51, 0.67]]) {
    if (y < 8) {
      for (let i = 0; i < gaps.length; i += 2)
        fbox(out, 'trim', front, gaps[i], gaps[i + 1], y, y + h, -0.04, depth, trim);
    } else fbox(out, 'trim', front, 0, width, y, y + h, -0.04, depth, trim);
  }
  if (detail > 0) {
    for (let i = 0; i < 24; i++) {
      const u = 11.47 + i * 1.71;
      fbox(out, 'trim', front, u - 0.13, u + 0.13, 19.25, 19.92, -0.12, 0.27, trim);
    }
  }
  for (const [a, b, depth] of [[1.15, 11.49, 2.75], [11.95, 49.42, 5.08], [50.35, 61.19, 2.75]]) {
    quad4(out, 'roof', p(a, 7.64, 0), p(a, 6.85, depth), p(b, 6.85, depth), p(b, 7.64, 0), reed);
    quad4(out, 'roof', p(b, 7.57, 0), p(b, 6.78, depth), p(a, 6.78, depth), p(a, 7.57, 0), reed);
    beam(out, 'iron', p(a, 6.82, depth), p(b, 6.82, depth), 0.11, 0.14, bronze);
    if (detail > 0) {
      const n = Math.ceil((b - a) / 1.83);
      for (let j = 0; j <= n; j++) {
        const u = a + (b - a) * j / n;
        beam(out, 'iron', p(u, 7.64, 0.03), p(u, 6.84, depth), 0.067, 0.069, bronze);
        if (j % 3 === 0) beam(out, 'iron', p(u, 5.48, 0.16), p(u, 6.81, depth - 0.35), 0.135, 0.12, bronze);
      }
    }
  }
  for (let i = 0; i < 3; i++)
    fbox(out, 'base', front, 0.28, width - 0.28, -0.28, floor - i * 0.163, 0, 0.7 + i * 0.4, plinth);
}

function build(out, detail) {
  const local = deform(out, ([x, y, z]) => frame.P(x, y, z));
  sides(local, detail);
  shed(local, detail);
  gableRoof(local, 'roof', [31.1, -90.4], [31.1, -148.4], 42.7, 11.8, 16.25, roof,
    { overhang: 0.22, endSlot: 'stone', endColor: stone });
  plazaFront(local, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
