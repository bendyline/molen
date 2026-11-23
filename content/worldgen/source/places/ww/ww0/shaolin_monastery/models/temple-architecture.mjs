import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { buildChineseHipRoof } from '../../../../../../../../packages/worldgen/scripts/chinese-roof-geometry.mjs';
import { transform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { cleanRing } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import {
  extrude,
  facade,
  fbox,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

export const surfaces = {
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.91 },
  stone: { slot: 'wall', graph: 'stone_granite', roughness: 0.96 },
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.97 },
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96 },
  wood: { slot: 'door', graph: 'wood_vertical', roughness: 0.88 },
  metal: { slot: 'trim', graph: 'metal_bronze_cast', metallic: 0.19, roughness: 0.84 },
  shade: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.83 },
};
export const color = {
  greyTile: rgb('687470'),
  greenTile: rgb('667964'),
  darkTile: rgb('606a67'),
  vermillion: rgb('ac5241'),
  redBrick: rgb('a75b49'),
  quietRed: rgb('a36653'),
  timber: rgb('784131'),
  oldTimber: rgb('765e46'),
  ochre: rgb('bea081'),
  stone: rgb('aaa79c'),
  greyBrick: rgb('9a968b'),
  cream: rgb('bcb4a1'),
  teal: rgb('3e6660'),
  bluish: rgb('3a5357'),
  gold: rgb('c4a166'),
  black: rgb('453f35'),
};
export const rect = (x, X, z, Z) => [
  [x, z],
  [x, Z],
  [X, Z],
  [X, z],
];
export const edges = (r) => outwardRing(r).map((a, i, p) => wallFace(a, p[(i + 1) % p.length]));
export const panel = (out, slot, f, l, r, y, h, d, tint) => {
  const p = f.P;
  quad4(out, slot, p(l, y, d), p(r, y, d), p(r, h, d), p(l, h, d), tint);
};

export function positioned(out, a, offset) {
  const model = transform(out, -a, offset);
  model.addCap = (slot, ref, rings, holes, y, n, uv, tint) => {
    const temp = new MeshBufferBuilder();
    if (!temp.addCap('wall', ref, rings, holes, y, n, uv, tint)) return false;
    const { positions, indices } = temp.finalize();
    for (let i = 0; i < indices.length; i += 3) {
      const p = [0, 1, 2].map((j) => positions.slice(3 * indices[i + j], 3 * indices[i + j] + 3));
      model.addTriangle(
        slot,
        ref,
        p,
        n,
        [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
        tint,
      );
    }
    return true;
  };
  return model;
}

export function roof(out, x, z, w, d, y, rise, detail, tint = color.greyTile) {
  const emit = (slot, ring, target) => {
    if (detail === 0 && target[1] < -0.5) return;
    const flip =
      normalFor(ring[0], ring[1], ring[2]).reduce((sum, n, i) => sum + n * target[i], 0) < 0;
    const p = flip ? ring.slice().reverse() : ring;
    for (let i = 1; i < p.length - 1; i++) tri(out, slot, p[0], p[i], p[i + 1], tint);
  };
  buildChineseHipRoof(emit, { x, z, width: w, depth: d, low: y, rise }, detail, 'roof');
}

export function fitFootprint(ring) {
  const r = cleanRing(ring);
  const f = edges(r).reduce((a, b) => (a.length > b.length ? a : b));
  const sign = f.along[0] < 0 ? -1 : 1;
  return fitAtAngle(r, Math.atan2(f.along[1] * sign, f.along[0] * sign));
}

export function fitAtAngle(ring, a = 0) {
  const c = Math.cos(a),
    s = Math.sin(a);
  const shape = ring.map(([x, z]) => [c * x + s * z, c * z - s * x]);
  const low = (axis) => Math.min(...shape.map((q) => q[axis]));
  const hi = (axis) => Math.max(...shape.map((q) => q[axis]));
  const x = (low(0) + hi(0)) * 0.5,
    z = (low(1) + hi(1)) * 0.5;
  const center = [x * c - z * s, x * s + z * c];
  return {
    center,
    a,
    w: hi(0) - low(0),
    d: hi(1) - low(1),
    ring: shape.map(([p, q]) => [p - x, q - z]),
  };
}

export function wallLoop(out, slot, ring, base, eave, tint) {
  for (const f of edges(ring))
    if (f.length > 0.003) panel(out, slot, f, 0, f.length, base, eave, 0, tint);
}

export function post(out, x, z, y, Y, r, detail, tint = color.vermillion) {
  const ring = (height, rr) =>
    radialRing(height, rr, rr, detail === 3 ? 10 : detail === 2 ? 7 : 4, [x, z], Math.PI / 4);
  loft(out, 'wood', [ring(y, r), ring(Y, r * 0.88)], tint, { cap: false });
  if (detail >= 2)
    loft(out, 'stone', [ring(y - 0.015, r * 1.22), ring(y + 0.175, r * 1.17)], color.stone);
}

export function panels(out, f, start, end, y, Y, detail, tint = color.timber, opening = 0) {
  const w = end - start,
    d = 0.064,
    u = (start + end) * 0.5;
  if (w < 0.3) return;
  panel(out, 'wood', f, start, end, y, Y, d, tint);
  if (!detail) return;
  const margin = w * 0.111;
  const base = y + (Y - y) * 0.34,
    edge = y + (Y - y) * 0.925;
  panel(out, 'shade', f, start + margin, end - margin, base, edge, d + 0.019, color.black);
  const count = detail === 3 ? 5 : detail === 2 ? 3 : 1;
  for (let i = 1; i <= count; i++) {
    const x = start + margin + (i * (w - 2 * margin)) / (count + 1);
    panel(out, 'wood', f, x - 0.027, x + 0.027, base, edge, d + 0.03, tint);
  }
  for (let i = 1; i <= count; i++) {
    const h = base + ((edge - base) * i) / (count + 1);
    panel(out, 'wood', f, start + margin, end - margin, h - 0.027, h + 0.027, d + 0.032, tint);
  }
  if (opening && detail >= 2)
    panel(out, 'metal', f, u - 0.044, u + 0.044, y + 0.9, y + 1.01, d + 0.047, color.gold);
}

export function eaveBand(
  out,
  f,
  y,
  detail,
  { wood = color.timber, paint = color.teal, bay = 2.4 } = {},
) {
  const l = f.length;
  fbox(out, 'wood', f, 0, l, y - 0.22, y + 0.05, -0.14, 0.25, wood);
  if (!detail) return;
  fbox(out, 'wood', f, 0, l, y - 0.66, y - 0.28, -0.12, 0.185, paint);
  if (detail === 1) return;
  const n = Math.max(1, Math.round(l / bay));
  for (let i = 0; i < n; i++) {
    const u = (l * (i + 0.5)) / n;
    fbox(out, 'wood', f, u - 0.19, u + 0.19, y - 0.85, y - 0.41, -0.06, 0.27, wood);
    fbox(out, 'wood', f, u - 0.31, u + 0.31, y - 0.45, y - 0.29, -0.04, 0.39, paint);
    if (detail === 3) {
      fbox(out, 'wood', f, u - 0.46, u + 0.46, y - 0.29, y - 0.15, -0.035, 0.52, paint);
      const p = f.P;
      quad4(
        out,
        'metal',
        p(u - 0.145, y - 0.51, 0.274),
        p(u, y - 0.64, 0.274),
        p(u + 0.145, y - 0.51, 0.274),
        p(u, y - 0.39, 0.274),
        color.gold,
      );
    }
  }
}

export function stairs(out, f, u, w, y0, Y, depth, detail) {
  const count = [2, 3, 7, 13][detail],
    increment = (Y - y0) / count;
  for (let i = 0; i < count; i++)
    fbox(
      out,
      'stone',
      f,
      u - w * 0.5,
      u + w * 0.5,
      y0 - 0.17,
      y0 + (i + 1) * increment,
      -0.05,
      (depth * (count - i)) / count,
      color.stone,
    );
}

export function railing(out, f, l, r, y, detail) {
  if (r - l < 0.8) return;
  fbox(out, 'stone', f, l, r, y, y + 0.2, -0.15, 0.17, color.stone);
  if (detail < 2) return;
  const n = Math.max(1, Math.ceil((r - l) / 1.87)),
    w = (r - l) / n;
  fbox(out, 'stone', f, l, r, y + 0.76, y + 0.88, -0.17, 0.16, color.stone);
  for (let i = 0; i <= n; i++) {
    const x = l + i * w;
    fbox(out, 'stone', f, x - 0.104, x + 0.104, y + 0.16, y + 0.97, -0.18, 0.19, color.stone);
    if (detail === 3 && i < n) {
      const p = f.P,
        u = x + w * 0.5;
      for (const s of [-1, 1])
        beam(
          out,
          'stone',
          p(u - 0.49, y + 0.44, 0.026),
          p(u + 0.49, y + 0.44 + s * 0.2, 0.026),
          0.051,
          0.047,
          color.stone,
        );
    }
  }
}

export function secondary(out, b, detail, flavor = {}) {
  const { ring, center, a, w, d } = fitFootprint(b.plan);
  const m = positioned(out, a, [center[0], 0, center[1]]);
  const y = b.base,
    eave = y + (flavor.height ?? Math.max(2.65, Math.min(5.85, Math.min(w, d) * 0.445)));
  const rise = flavor.rise ?? Math.min(3.45, Math.max(1.62, d * 0.24));
  const plaster = flavor.wall ?? color.greyBrick;
  const separateBase = detail >= 2 && flavor.highlight;
  wallLoop(m, 'wall', ring, separateBase ? y + 0.35 : b.foundation, eave, plaster);
  if (!detail) {
    const apex = [0, eave + rise, 0];
    const base = rect(-w * 0.5 - 0.16, w * 0.5 + 0.16, -d * 0.5 - 0.16, d * 0.5 + 0.16);
    for (let i = 0; i < base.length; i++) {
      const [x, z] = base[i],
        [a, b] = base[(i + 1) % base.length];
      tri(m, 'roof', [x, eave, z], [a, eave, b], apex, flavor.tile ?? color.greyTile);
    }
    return;
  }
  const tile = flavor.tile ?? color.greyTile;
  if (detail === 1 && !flavor.highlight) {
    const [a, b, c, e] = rect(-w * 0.5 - 0.2, w * 0.5 + 0.2, -d * 0.5 - 0.2, d * 0.5 + 0.2).map(
      ([x, z]) => [x, eave, z],
    );
    const lo = [-w * 0.33, eave + rise, 0],
      hi = [w * 0.33, eave + rise, 0];
    tri(m, 'roof', a, b, lo, tile);
    quad4(m, 'roof', b, c, hi, lo, tile);
    tri(m, 'roof', c, e, hi, tile);
    quad4(m, 'roof', e, a, lo, hi, tile);
  } else {
    roof(m, 0, 0, w, d, eave, rise, detail === 3 && flavor.highlight ? 2 : 0, tile);
  }
  if (separateBase) {
    extrude(m, 'stone', ring, b.foundation, y + 0.35, color.stone);
    for (const f of edges(ring)) if (f.length > 3.2) eaveBand(m, f, eave, detail === 3 ? 2 : 1);
  }
  for (const f of edges(ring)) {
    if (f.length < 4.5 || (!flavor.highlight && Math.abs(f.normal[1]) < 0.72)) continue;
    if (detail === 1 && !flavor.highlight && f.normal[1] < 0) continue;
    const n = Math.max(
      1,
      Math.min(detail === 3 ? 9 : detail === 2 ? 4 : 3, Math.floor(f.length / 3.4)),
    );
    for (let i = 0; i < n; i++) {
      const u = (f.length * (i + 0.5)) / n,
        width = Math.min(1.94, (f.length / n) * 0.69);
      if (detail === 1) {
        panel(
          m,
          'shade',
          f,
          u - width * 0.51,
          u + width * 0.51,
          y + 0.66,
          Math.min(eave - 0.5, y + 2.47),
          0.043,
          color.black,
        );
      } else {
        panels(
          m,
          f,
          u - width * 0.5,
          u + width * 0.5,
          y + 0.42,
          Math.min(eave - 0.58, y + 2.82),
          detail === 3 && flavor.highlight ? 2 : 0,
        );
      }
    }
  }
}

export function courtFace(x, z, width) {
  const f = facade([x - width * 0.5, z], [1, 0]);
  return { ...f, length: width };
}
