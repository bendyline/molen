/** CITIC Plaza: complete main office tower, authored browser levels, meters/+Y. */
import { readFileSync } from 'node:fs';
import { beam, loft, radialRing } from './authored-structure-mesh.mjs';
import {
  clockwise,
  face,
  localOutline,
  mappedCap,
  mappedSolid,
  partPlan,
  shift,
} from './signature-tower-expansion-models.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const key = 'n0164_citic_plaza',
  map = JSON.parse(readFileSync(structureSourcePath(key, 'map-frame.json'))),
  scope = JSON.parse(readFileSync(structureSourcePath(key, 'review-scope.json'))),
  white = [0.83, 0.85, 0.81],
  blue = [0.39, 0.59, 0.62],
  teal = [0.2, 0.44, 0.46];
const settings = {
  source: { floor: 3.6, column: 1.4, ring: 28, joints: true, mast: 16 },
  closeup: { floor: 3.6, column: 1.4, ring: 28, joints: true, mast: 16 },
  street: { floor: 3.6, column: 2.8, ring: 20, joints: false, mast: 12 },
  district: { floor: 18, column: 8, ring: 12, joints: false, mast: 8 },
  skyline: { floor: 0, column: 0, ring: 8, joints: false, mast: 6 },
};
const part = (id) =>
  partPlan(
    map,
    map.elements.find((p) => p.id === id),
  );
function clean(plan, tolerance = 0.03) {
  const p = plan.map((q) => q.slice());
  let changed = true;
  while (changed && p.length > 3) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        d = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (
        d > 0 &&
        Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / d < tolerance &&
        (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) >= 0
      ) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return clockwise(p);
}
function facade(out, plan, lo, hi, body, trim, slot, c) {
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i],
      b = plan[(i + 1) % plan.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.03) continue;
    const n = [-(b[1] - a[1]) / len, 0, (b[0] - a[0]) / len],
      at = (s, y, lift = 0) =>
        shift([a[0] + (b[0] - a[0]) * s, y, a[1] + (b[1] - a[1]) * s], n, lift);
    face(out, 'glass', [at(0, lo), at(1, lo), at(1, hi), at(0, hi)], body);
    if (c.floor)
      for (let y = lo + c.floor; y < hi - 0.1; y += c.floor) {
        const w = slot === 'cladding' ? 0.55 : 0.28;
        face(
          out,
          slot,
          [at(0, y - w, 0.04), at(1, y - w, 0.04), at(1, y, 0.04), at(0, y, 0.04)],
          trim,
        );
      }
    if (c.column) {
      const count = Math.max(1, Math.ceil(len / c.column)),
        half = (slot === 'cladding' ? 0.14 : 0.07) / len;
      for (let j = 0; j <= count; j++) {
        const u = Math.max(0, j / count - half),
          v = Math.min(1, j / count + half);
        face(
          out,
          slot,
          [at(u, lo, 0.045), at(v, lo, 0.045), at(v, hi, 0.045), at(u, hi, 0.045)],
          trim,
        );
      }
    }
  }
}
function roundPlan(radius, sides, center = [0, 0]) {
  return Array.from({ length: sides }, (_, i) => {
    const a = (-i * Math.PI * 2) / sides;
    return [center[0] + radius * Math.cos(a), center[1] + radius * Math.sin(a)];
  });
}
function masts(out, c) {
  for (const id of [1548063161, 1548063162]) {
    const p = part(id),
      center = [0, 1].map((i) => p.reduce((s, q) => s + q[i] / p.length, 0));
    loft(
      out,
      'metal',
      [
        [321.9, 0.73],
        [344, 0.73],
        [358, 0.5],
        [375, 0.28],
        [389.8, 0.065],
        [390.2, 0.035],
      ].map(([y, r]) => radialRing(y, r, r, c.mast, center)),
      white,
    );
    if (c.joints)
      for (let y = 346; y < 375; y += 4.8)
        loft(
          out,
          'metal',
          [radialRing(y, 0.58, 0.58, 12, center), radialRing(y + 0.13, 0.58, 0.58, 12, center)],
          white,
        );
  }
}
function sign(out) {
  const stroke = (x1, y1, x2, y2, w = 0.9) =>
    beam(out, 'metal', [x1, y1, 0], [x2, y2, 0], w, 0.36, white);
  for (const q of [
    [-14, 333.5, -14, 341],
    [-14, 341, -5.3, 341],
    [-5.3, 341, -5.3, 333.5],
    [-5.3, 333.5, -14, 333.5],
    [-9.7, 330, -9.7, 344],
  ])
    stroke(...q);
  for (const q of [
    [3.1, 343.7, -0.4, 337.9],
    [1.2, 340, 1.2, 330],
    [8.6, 344, 10, 342.8],
    [4.7, 341.1, 15.2, 341.1],
    [5.5, 338.9, 14.4, 338.9],
    [5.5, 336.7, 14.4, 336.7],
    [5.5, 334.7, 14.4, 334.7],
    [5.5, 334.7, 5.5, 330.5],
    [14.4, 334.7, 14.4, 330.5],
    [5.5, 330.5, 14.4, 330.5],
  ])
    stroke(...q, 0.75);
  beam(out, 'metal', [-16.7, 330, 0], [16.7, 330, 0], 0.4, 0.4, [0.39, 0.47, 0.47]);
  beam(out, 'metal', [-16.7, 321.9, 0], [16.7, 321.9, 0], 0.6, 0.6, white);
}
function build(out, level) {
  const c = settings[level],
    outer = localOutline(map);
  mappedSolid(out, 'foundation', outer, 0, 0.18, [0.38, 0.4, 0.39]);
  // Reference27330 shows a recessed round glazed lobby beneath the dark upper base band.
  const lobby = roundPlan(15.8, c.ring);
  facade(out, lobby, 0.18, 17.7, [0.2, 0.31, 0.34], [0.72, 0.76, 0.75], 'metal', {
    ...c,
    floor: level === 'skyline' ? 0 : 5.84,
    column: level === 'skyline' ? 0 : 3.1,
  });
  mappedCap(out, 'metal', lobby, 17.7, [0.38, 0.46, 0.46]);
  for (const id of [1548063154, 1548063155, 1548063156, 1548063157]) {
    const p = part(id);
    mappedSolid(out, 'stone', p, 0.18, 17.7, [0.13, 0.16, 0.17]);
    if (level !== 'skyline')
      facade(out, p, 0.2, 17.7, [0.13, 0.16, 0.17], [0.56, 0.59, 0.58], 'metal', {
        ...c,
        floor: level === 'district' ? 8.8 : 5.84,
        column: level === 'district' ? 4 : 2.65,
      });
  }
  const lower = clean(part(1548063165));
  mappedCap(out, 'metal', lower, 17.7, [0.46, 0.52, 0.52], [], true);
  facade(out, lower, 17.7, 27, [0.14, 0.2, 0.21], [0.48, 0.53, 0.53], 'metal', {
    ...c,
    floor: level === 'skyline' ? 0 : 3.1,
    column: level === 'skyline' ? 0 : level === 'district' ? 8 : 3.1,
  });
  mappedCap(out, 'metal', lower, 27, [0.46, 0.52, 0.52]);
  for (const id of [1548063152, 1548063153]) {
    const p = clean(part(id), level === 'skyline' ? 0.25 : 0.03);
    facade(out, p, 27, 321.9, blue, white, 'cladding', c);
    mappedCap(out, 'metal', p, 321.9, [0.55, 0.61, 0.6]);
  }
  const middle = clean(part(1548063158));
  facade(out, middle, 27, 297, teal, [0.65, 0.77, 0.76], 'metal', c);
  mappedCap(out, 'metal', middle, 297, [0.48, 0.58, 0.57]);
  const crown = roundPlan(21.557, c.ring);
  facade(out, crown, 297, 310.8, teal, white, 'metal', {
    ...c,
    floor: level === 'skyline' ? 0 : 3.45,
    column: level === 'skyline' ? 0 : level === 'district' ? 8 : 2.4,
  });
  mappedCap(out, 'metal', crown, 310.8, [0.55, 0.61, 0.6]);
  for (const id of [1548063163, 1548063164]) {
    const p = part(id);
    facade(out, p, 321.9, 344, teal, white, 'metal', {
      ...c,
      floor: level === 'skyline' ? 0 : 7.3,
      column: 0,
    });
    mappedCap(out, 'metal', p, 344, white);
  }
  masts(out, c);
  sign(out);
}
export function buildCiticReviewedMaster(out) {
  build(out, 'source');
}
export function buildCiticCloseup(out) {
  build(out, 'closeup');
}
export function buildCiticStreet(out) {
  build(out, 'street');
}
export function buildCiticDistrict(out) {
  build(out, 'district');
}
export function buildCiticSkyline(out) {
  const wrapped = {};
  for (const method of ['addTriangle', 'addQuad', 'addConvexPolygon'])
    wrapped[method] = (component, _ref, p, n, uv, color) => {
      const graph = {
          foundation: 'concrete_plain',
          stone: 'stone_granite',
          cladding: 'metal_painted',
          metal: 'metal_painted',
        }[component],
        mean = scope.sourceFacts.surfaceMeans[graph];
      out[method](
        'glass',
        'palette:#ffffff',
        p,
        n,
        uv,
        mean ? color.map((v, i) => v * mean[i]) : color,
      );
    };
  build(wrapped, 'skyline');
}
