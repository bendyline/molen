/** Exterior of the western Lubiechów glasshouses, fitted to their separate mapped outline. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

export const key = 'ksiaz_palm_west_greenhouses';
export const title = 'Lubiechów Palm House west greenhouses';
export const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.89, metallic: 0 },
  sandstone: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.91, metallic: 0 },
  frame: { slot: 'trim', graph: 'metal_painted', roughness: 0.63, metallic: 0.21 },
  glass: { slot: 'window', roughness: 0.44, metallic: 0.06 },
};
export const palette = {
  brick: 'b4876e',
  stone: 'b9ad93',
  rail: 'd8d9bc',
  sash: 'acba9d',
  downpipe: '95aa89',
  glass: '5e7779',
  glassLit: '789092',
  roof: '8da09a',
  roofShade: '778f8c',
  vent: '68847d',
  door: '56624b',
};
const color = Object.fromEntries(Object.entries(palette).map(([name, hex]) => [name, rgb(hex)]));
const ref = 'palette:#ffffff';
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const frame = read('../map-frame.json'),
  means = read('../surface-means.json');
const ring = frame.geometry.outline.slice(0, -1),
  { door, roof, siteFit } = frame;
const winding = Math.sign(
  ring.reduce((s, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return s + p[0] * q[1] - q[0] * p[1];
  }, 0),
);

function face(out, slot, tint, points, direction) {
  for (let i = 1; i < points.length - 1; i++) {
    const tri = [points[0], points[i], points[i + 1]].map((p) => p.map(Math.fround));
    let n = normalFor(...tri);
    const dot = n.reduce((sum, v, i) => sum + v * direction[i], 0);
    if (Math.abs(dot) < 1e-6) continue;
    if (dot < 0) {
      [tri[1], tri[2]] = [tri[2], tri[1]];
      n = n.map((v) => -v);
    }
    out.addTriangle(
      slot,
      ref,
      tri,
      n,
      tri.map((p) => [p[0], p[2]]),
      color[tint],
    );
  }
}
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const atHeight = ([x, z], y) => [x, y, z];
const roofY = (z) => {
  const i = roof.findIndex(([edge]) => edge >= z);
  const [a, b] = [roof[i - 1], roof[i]];
  return a[1] + ((b[1] - a[1]) * (z - a[0])) / (b[0] - a[0]);
};
function halfPlane(poly, z, north) {
  return poly.flatMap((a, i) => {
    const b = poly[(i + 1) % poly.length];
    const inside = (p) => (north ? p[1] <= z : p[1] >= z);
    return [
      ...(inside(a) ? [a] : []),
      ...(inside(a) === inside(b) ? [] : [mix(a, b, (z - a[1]) / (b[1] - a[1]))]),
    ];
  });
}
function lineIntervals(poly, axis, coordinate) {
  const hits = poly
    .flatMap((a, i) => {
      const b = poly[(i + 1) % poly.length];
      if (a[axis] > coordinate === b[axis] > coordinate) return [];
      return [mix(a, b, (coordinate - a[axis]) / (b[axis] - a[axis]))];
    })
    .sort((a, b) => a[1 - axis] - b[1 - axis]);
  const lines = [];
  for (let i = 1; i < hits.length; i += 2)
    if (hits[i][1 - axis] - hits[i - 1][1 - axis] > 0.08) lines.push([hits[i - 1], hits[i]]);
  return lines;
}
function rail(out, a, b, size, tint = 'rail') {
  if (Math.hypot(...a.map((v, i) => v - b[i])) < 0.025) return;
  beam(out, 'frame', a, b, size, size, color[tint]);
}
function roofGeometry(out, detail) {
  for (const [i, [z0]] of roof.slice(0, -1).entries()) {
    const z1 = roof[i + 1][0],
      patch = halfPlane(halfPlane(ring, z0, false), z1, true);
    if (patch.length < 3) continue;
    const indices = earcut(patch.flat());
    const p3 = (p, lift = 0) => atHeight(p, roofY(p[1]) + lift);
    for (let t = 0; t < indices.length; t += 3) {
      face(
        out,
        'glass',
        i % 2 ? 'roofShade' : 'roof',
        indices.slice(t, t + 3).map((k) => p3(patch[k])),
        [0, 1, 0],
      );
    }
    if (!detail) continue;
    const spacing = [0, 7.6, 2.35, 1.2][detail];
    for (let x = -32.7; x < 33; x += spacing) {
      for (const [a, b] of lineIntervals(patch, 0, x))
        rail(out, p3(a, 0.025), p3(b, 0.025), detail === 1 ? 0.1 : 0.067, 'sash');
    }
    const rows = detail === 3 ? [0.13, 0.48, 0.79] : [0.32];
    for (const t of rows) {
      const z = z0 + (z1 - z0) * t;
      for (const [a, b] of lineIntervals(patch, 1, z)) rail(out, p3(a, 0.042), p3(b, 0.042), 0.075);
    }
    for (const [a, b] of lineIntervals(patch, 1, z1 - 0.018))
      rail(out, p3(a, 0.04), p3(b, 0.04), 0.115);
    if (detail < 2 || ![0, 3, 6].includes(i)) continue;
    // Hinged ventilator leaves stand just above one slope under the ridge.
    for (const x of [-23, -9.6, 4, 17.8]) {
      const z = z1 - 0.62,
        zz = z - 0.63;
      const leaf = [
        [x - 1.31, zz],
        [x + 1.31, zz],
        [x + 1.31, z],
        [x - 1.31, z],
      ].map((p, k) => p3(p, k < 2 ? 0.12 : 0.044));
      face(out, 'glass', 'vent', leaf, [0, 1, 0]);
      for (let k = 0; k < leaf.length; k++)
        rail(out, leaf[k], leaf[(k + 1) % leaf.length], 0.065, 'sash');
    }
  }
}
function elevations(out, detail) {
  for (const [i, a] of ring.entries()) {
    const b = ring[(i + 1) % ring.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz);
    const nx = (winding * dz) / length,
      nz = (-winding * dx) / length,
      n = [nx, 0, nz];
    const at = (t, y, offset = 0) => [a[0] + t * dx + nx * offset, y, a[1] + t * dz + nz * offset];
    const segment = (t0, t1, lo, y0, y1, slot, tint, offset = 0) =>
      face(
        out,
        slot,
        tint,
        [at(t0, lo, offset), at(t1, lo, offset), at(t1, y1, offset), at(t0, y0, offset)],
        n,
      );
    const ts = [0, 1, ...roof.map(([z]) => (z - a[1]) / dz).filter((t) => t > 0 && t < 1)];
    const s =
      i === door.edge ? Math.hypot(door.center[0] - a[0], door.center[1] - a[1]) / length : -2;
    const left = s - door.width / (2 * length),
      right = s + door.width / (2 * length);
    if (i === door.edge) ts.push(left, right);
    ts.sort((u, v) => u - v);
    // Split glazing heights exactly at every roof break so the gables remain closed at each LOD.
    for (let k = 1; k < ts.length; k++) {
      const t0 = ts[k - 1],
        t1 = ts[k],
        mid = (t0 + t1) / 2;
      const opening = mid > left && mid < right;
      const h0 = roofY(a[1] + t0 * dz),
        h1 = roofY(a[1] + t1 * dz),
        low = opening ? door.sill : siteFit.plinthTop;
      segment(t0, t1, siteFit.footingBottom, low, low, 'brick', 'brick');
      segment(t0, t1, opening ? door.head : low, h0, h1, 'glass', nz < 0 ? 'glass' : 'glassLit');
      if (!detail) continue;
      rail(out, at(t0, h0, 0.025), at(t1, h1, 0.025), 0.086);
      if (opening) continue;
      rail(out, at(t0, low + 0.04, 0.02), at(t1, low + 0.04, 0.02), 0.092);
      const divisions = Math.max(
        1,
        Math.round(((t1 - t0) * length) / [0, 3.1, 1.61, 0.98][detail]),
      );
      for (let j = 0; j <= divisions; j++) {
        if (j === 0 && k > 1) continue;
        const t = t0 + ((t1 - t0) * j) / divisions;
        rail(
          out,
          at(t, low, 0.034),
          at(t, roofY(a[1] + t * dz), 0.034),
          detail === 3 ? 0.055 : 0.076,
          'sash',
        );
      }
      if (detail >= 2) {
        const railY = low + 0.69;
        rail(out, at(t0, railY, 0.051), at(t1, railY, 0.051), 0.069, 'sash');
      }
    }
    if (i === door.edge) {
      segment(left, right, door.sill, door.head, door.head, 'frame', 'door', -door.recess);
      const h = door.head;
      for (const t of [left, right]) {
        face(
          out,
          'brick',
          'brick',
          [at(t, door.sill), at(t, door.sill, -door.recess), at(t, h, -door.recess), at(t, h)],
          t === left ? [dx, 0, dz] : [-dx, 0, -dz],
        );
      }
      face(
        out,
        'frame',
        'sash',
        [at(left, h), at(right, h), at(right, h, -door.recess), at(left, h, -door.recess)],
        [0, -1, 0],
      );
      if (detail) {
        const d = -door.recess + 0.008,
          win = (right - left) * 0.08;
        for (const [u, v] of [
          [left + win, s - win],
          [s + win, right - win],
        ]) {
          segment(u, v, door.sill + 0.74, door.head - 0.21, door.head - 0.21, 'glass', 'glass', d);
        }
        rail(out, at(s, door.sill, -door.recess + 0.025), at(s, h, -door.recess + 0.025), 0.073);
      }
    }
    if (detail >= 2 && length > 18) {
      for (const t of [0.07, 0.93])
        rail(
          out,
          at(t, siteFit.plinthTop - 0.29, 0.102),
          at(t, roofY(a[1] + t * dz) - 0.04, 0.102),
          0.105,
          'downpipe',
        );
    }
  }
}
function approach(out) {
  const [nx, nz] = door.normal,
    [cx, cz] = door.center;
  const at = (u, y, v) => [cx + nz * u + nx * v, y, cz - nx * u + nz * v];
  const pair = (z, y) => {
    const w = 1 + ((door.footWidth / 2 - 1) * (z + 0.15)) / (door.depth + 0.15);
    return [at(-w, y[0], z), at(w, y[1], z)];
  };
  const slab = (inner, outer) => {
    face(out, 'sandstone', 'stone', [...inner, outer[1], outer[0]], [0, 1, 0]);
    for (const i of [0, 1]) {
      const a = inner[i],
        b = outer[i];
      face(
        out,
        'sandstone',
        'stone',
        [a, b, [b[0], siteFit.footingBottom, b[2]], [a[0], siteFit.footingBottom, a[2]]],
        i ? [nz, 0, -nx] : [-nz, 0, nx],
      );
    }
  };
  const riser = (a, b) => face(out, 'sandstone', 'stone', [...a, b[1], b[0]], [nx, 0, nz]);
  const apron = pair(0.95, door.toeY),
    toe = pair(door.depth, door.toeY);
  slab(apron, toe);
  riser(
    toe,
    toe.map((p) => [p[0], siteFit.footingBottom, p[2]]),
  );
  const landing = (z, y) => pair(z, [y, y]),
    step = (door.sill - (door.toeY[0] + door.toeY[1]) / 2) / 3;
  let prior = apron;
  for (const [i, z] of [0.95, 0.65, 0.35].entries()) {
    const y = door.sill - (2 - i) * step,
      next = landing(z, y);
    riser(prior, next);
    prior = landing(i === 2 ? -0.15 : z - 0.3, y);
    slab(prior, next);
  }
  face(
    out,
    'sandstone',
    'stone',
    [
      ...prior,
      at(door.width / 2, door.sill, -door.recess),
      at(-door.width / 2, door.sill, -door.recess),
    ],
    [0, 1, 0],
  );
}

export function buildWestGreenhouses(out, level = 'closeup') {
  const detail = { skyline: 0, district: 1, street: 2, closeup: 3 }[level];
  if (detail === undefined) throw Error(`Unknown greenhouse detail level ${level}`);
  elevations(out, detail);
  roofGeometry(out, detail);
  approach(out);
}
export function buildWestGreenhousesSkyline(out) {
  buildWestGreenhouses(
    {
      addTriangle: (s, r, p, n, uv, c) =>
        out.addTriangle(
          'silhouette',
          r,
          p,
          n,
          uv,
          c.map((v, i) => v * (means[s]?.[i] ?? 1)),
        ),
    },
    'skyline',
  );
}
