/** The standing cedar-log Château Montebello, with six mapped wings around the rotunda. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url)));
const plan = read('plan-controls.json');
const terrain = read('terrain-grid.json');
const outline = read('map-frame.json').geometry.outline;
const { coreCenter, chimneyHeightMeters } = plan.dimensions;
const pal = 'palette:#ffffff';
const up = [0, 1, 0];
const plinth = -0.11;
const c = Object.fromEntries(
  Object.entries({
    stone: 'b9ac99',
    stoneShade: 'a59784',
    lintel: 'c4b7a5',
    cedar: '875e46',
    cedarShade: '79533e',
    endGrain: 'aa8060',
    logShadow: '674e40',
    fascia: '775441',
    trim: 'aa9074',
    sash: 'b9ab94',
    darkness: '494947',
    roof: '625c57',
    roofLight: '706660',
    roofShade: '575451',
    glass: '6e7a7b',
    door: '5f4b3d',
    stair: '9f907c',
  }).map(([key, value]) => [key, rgb(value)]),
);
const surfaces = {
  foundation: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.93, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.94, metallic: 0 },
  log: { slot: 'wall', graph: 'wood_log', roughness: 0.89, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.85, metallic: 0 },
  roof: { slot: 'roof', graph: 'shingle_asphalt', roughness: 0.87, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.57, metallic: 0.04 },
  paint: { slot: 'trim', localRef: pal, roughness: 0.89, metallic: 0 },
};

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const mid = ([a, b]) => mix(outline[a], outline[b], 0.5);
const pos = ([x, z], y) => [x, y, z];
const area = (ring) =>
  ring.reduce((sum, [x, z], i) => {
    const [a, b] = ring[(i + 1) % ring.length];
    return sum + x * b - a * z;
  }, 0);
const outwardSign = Math.sign(area(outline));

function grade([x, z]) {
  const i = (x - terrain.origin[0]) / terrain.stepMeters;
  const j = (z - terrain.origin[1]) / terrain.stepMeters;
  const ix = Math.floor(i);
  const iz = Math.floor(j);
  const a = i - ix;
  const b = j - iz;
  const low = terrain.heightsMeters[iz];
  const high = terrain.heightsMeters[iz + 1];
  return (
    (low[ix] * (1 - a) + low[ix + 1] * a) * (1 - b) +
    (high[ix] * (1 - a) + high[ix + 1] * a) * b -
    terrain.modelDatumElevationMeters
  );
}

function face(out, slot, points, toward, color, uv = ([x, y, z]) => [x + 0.3 * z, y]) {
  const n = normalFor(...points);
  const flip = n.reduce((sum, val, k) => sum + val * toward[k], 0) < 0;
  out.addConvexPolygon(slot, pal, points, flip ? n.map((n) => -n) : n, uv, color);
}

function wing(name, start, end, startPair, endPair, half, eaves, ridge, guestFloors) {
  const origin = mid(startPair);
  const tip = mid(endPair);
  const length = Math.hypot(tip[0] - origin[0], tip[1] - origin[1]);
  const nx = (tip[0] - origin[0]) / length;
  const nz = (tip[1] - origin[1]) / length;
  const along = ([x, z]) => (x - origin[0]) * nx + (z - origin[1]) * nz;
  const across = ([x, z]) => -(x - origin[0]) * nz + (z - origin[1]) * nx;
  const world = (u, v) => [origin[0] + nx * u - nz * v, origin[1] + nz * u + nx * v];
  const ring = Array.from(
    { length: end - start + 1 },
    (_, k) => outline[(start + k) % outline.length],
  );
  const rise = ridge - eaves;
  return {
    name,
    ring,
    eaves,
    ridge,
    guestFloors,
    world,
    along,
    across,
    span: ring.reduce((max, p) => Math.max(max, along(p)), -Infinity),
    height: (p) => eaves + rise * (1 - Math.min(1, Math.abs(across(p)) / half)),
  };
}

// Each roof starts and ends at a mapped junction with the next wing.
const wings = [
  wing('west', 3, 14, [5, 13], [6, 13], 9.25, 7.12, 13.36, 2),
  wing('northwest', 14, 20, [14, 20], [16, 17], 10.18, 4.96, 10.41, 0),
  wing('northeast', 20, 34, [21, 33], [22, 30], 9.12, 7.09, 13.05, 2),
  wing('east', 34, 44, [34, 44], [39, 40], 10.2, 6.64, 12.13, 2),
  wing('southeast', 44, 48, [44, 48], [45, 46], 16.7, 3.97, 10.96, 0),
  wing('southwest', 48, 53, [3, 48], [0, 1], 10.24, 6.87, 13.29, 2),
];
const coreOutline = [3, 14, 20, 34, 44, 48].map((i) => outline[i]);

function splitAtRidge(ring, across, sign) {
  const result = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const da = sign * across(a);
    const db = sign * across(b);
    if (da >= 0) result.push(a);
    if ((da > 0 && db < 0) || (da < 0 && db > 0)) result.push(mix(a, b, da / (da - db)));
  }
  return result;
}

function roofPlane(out, ring, height, uvs, color) {
  const polygons = new MeshBufferBuilder();
  if (
    !polygons.addCap(
      'roof',
      pal,
      ring,
      [],
      () => 0,
      up,
      (p) => p,
      color,
    )
  ) {
    throw new Error('Cannot triangulate the mapped roof outline');
  }
  const cap = polygons.finalize();
  for (let i = 0; i < cap.indices.length; i += 3) {
    const corners = Array.from(cap.indices.subarray(i, i + 3), (index) => {
      const p = [cap.positions[index * 3], cap.positions[index * 3 + 2]];
      return pos(p, height(p));
    });
    face(out, 'roof', corners, up, color, uvs);
  }
}

function faceCoordinates(a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const x = (b[0] - a[0]) / length;
  const z = (b[1] - a[1]) / length;
  const nx = outwardSign * z;
  const nz = -outwardSign * x;
  return {
    point: (t, y, d = 0) => [a[0] + x * t + nx * d, y, a[1] + z * t + nz * d],
    length,
    outward: [nx, 0, nz],
    uvs: ([px, y, pz]) => [px * x + pz * z, y],
  };
}

function panel(out, edge, slot, a, b, low, high, depth, color) {
  const p = edge.point;
  face(
    out,
    slot,
    [p(a, low, depth), p(b, low, depth), p(b, high, depth), p(a, high, depth)],
    edge.outward,
    color,
    edge.uvs,
  );
}

function foundation(out, edge, a, b, lod) {
  const divisions = Math.ceil(edge.length / (lod === 0 ? 24 : 5));
  for (let i = 0; i < divisions; i++) {
    const t = i / divisions;
    const s = (i + 1) / divisions;
    const lowA = Math.min(grade(mix(a, b, t)) - 0.32, plinth - 0.42);
    const lowB = Math.min(grade(mix(a, b, s)) - 0.32, plinth - 0.42);
    const p = edge.point;
    face(
      out,
      'foundation',
      [
        p(t * edge.length, lowA),
        p(s * edge.length, lowB),
        p(s * edge.length, plinth),
        p(t * edge.length, plinth),
      ],
      edge.outward,
      c.stone,
      edge.uvs,
    );
  }
}

function sash(out, edge, x, y, width, height, lod, door = false) {
  const left = x - width / 2;
  const right = x + width / 2;
  panel(
    out,
    edge,
    'paint',
    left - 0.09,
    right + 0.09,
    y - 0.07,
    y + height + 0.12,
    0.047,
    c.logShadow,
  );
  panel(
    out,
    edge,
    door ? 'wood' : 'glass',
    left,
    right,
    y,
    y + height,
    0.064,
    door ? c.door : c.glass,
  );
  if (lod === 0) return;
  const p = edge.point;
  if (lod === 1) {
    panel(
      out,
      edge,
      'paint',
      left - 0.078,
      right + 0.078,
      y + height,
      y + height + 0.062,
      0.084,
      c.trim,
    );
    return;
  }
  if (lod === 2) {
    for (const at of [left, right])
      panel(out, edge, 'paint', at - 0.045, at + 0.045, y, y + height, 0.083, c.trim);
    panel(
      out,
      edge,
      'paint',
      left - 0.07,
      right + 0.07,
      y + height - 0.025,
      y + height + 0.052,
      0.084,
      c.trim,
    );
    panel(out, edge, 'paint', x - 0.027, x + 0.027, y, y + height, 0.077, c.sash);
    return;
  }
  for (const at of [left, right])
    beam(
      out,
      'wood',
      p(at, y - 0.015, 0.083),
      p(at, y + height + 0.04, 0.083),
      0.075,
      0.08,
      c.trim,
    );
  beam(
    out,
    'wood',
    p(left - 0.07, y + height, 0.093),
    p(right + 0.07, y + height, 0.093),
    0.08,
    0.1,
    c.trim,
  );
  if (!door) {
    beam(out, 'wood', p(left - 0.11, y, 0.095), p(right + 0.11, y, 0.095), 0.096, 0.108, c.sash);
    panel(out, edge, 'paint', x - 0.027, x + 0.027, y, y + height, 0.077, c.sash);
    if (lod === 3)
      panel(
        out,
        edge,
        'paint',
        left,
        right,
        y + height * 0.55 - 0.023,
        y + height * 0.55 + 0.023,
        0.079,
        c.sash,
      );
  }
}

function arch(out, edge, x, bottom, lod) {
  const radius = 0.86;
  const spring = bottom + 1.14;
  const p = edge.point;
  const pieces = [4, 6, 8, 12][lod];
  panel(out, edge, 'glass', x - radius, x + radius, bottom, spring, 0.085, c.glass);
  for (let i = 0; i < pieces; i++) {
    const a = (i * Math.PI) / pieces;
    const b = ((i + 1) * Math.PI) / pieces;
    const at = (angle, r, d) => p(x + r * Math.cos(angle), spring + r * Math.sin(angle), d);
    face(
      out,
      'glass',
      [p(x, spring, 0.085), at(a, radius, 0.085), at(b, radius, 0.085)],
      edge.outward,
      c.glass,
      edge.uvs,
    );
    face(
      out,
      'stone',
      [
        at(a, radius, 0.093),
        at(a, radius + 0.16, 0.093),
        at(b, radius + 0.16, 0.093),
        at(b, radius, 0.093),
      ],
      edge.outward,
      c.lintel,
      edge.uvs,
    );
  }
  if (lod > 0) {
    panel(out, edge, 'paint', x - 0.029, x + 0.029, bottom, spring + radius, 0.1, c.sash);
    panel(out, edge, 'paint', x - radius, x + radius, spring - 0.027, spring + 0.027, 0.1, c.sash);
  }
}

function endLogs(out, edge, top, lod) {
  if (lod < 2) return;
  const p = edge.point;
  const count = Math.floor((top - plinth) / 0.38);
  const every = lod === 2 ? 5 : 1;
  for (let k = 1; k < count; k += every) {
    const y = plinth + k * 0.38;
    const x = k % 2 === 0 ? 0.17 : 0.27;
    const profile = Array.from({ length: 6 }, (_, i) => {
      const a = (i * Math.PI) / 3;
      return [x + 0.135 * Math.cos(a), y + 0.125 * Math.sin(a)];
    });
    loft(
      out,
      'wood',
      [0.03, 0.245].map((d) => profile.map(([u, h]) => p(u, h, d))),
      k % 3 === 1 ? c.trim : c.endGrain,
    );
  }
}

function diningStair(out, edge, u, lod) {
  const p = edge.point;
  const half = 1.24;
  const top = 0.08;
  const run = 5.15;
  const [x, , z] = p(u, 0, run);
  const foot = grade([x, z]) + 0.04;
  const steps = lod === 1 ? 5 : 15;
  const above = (i) => top + ((foot - top) * i) / steps;
  const across = (i) => 0.72 + ((run - 0.72) * i) / steps;
  for (let i = 0; i <= steps; i++) {
    const depth = i === 0 ? 0.035 : across(i - 1);
    const outer = across(i);
    const y = above(i);
    const low = i === steps ? foot - 0.16 : above(i + 1);
    face(
      out,
      'stone',
      [p(u - half, y, depth), p(u + half, y, depth), p(u + half, y, outer), p(u - half, y, outer)],
      up,
      c.stair,
    );
    panel(out, edge, 'stone', u - half, u + half, low, y, outer, c.stoneShade);
  }
  const forward = edge.outward;
  const tangent = [forward[2], 0, -forward[0]];
  for (const sign of [-1, 1]) {
    const side = u + sign * half;
    face(
      out,
      'stone',
      [
        p(side, top, 0.035),
        p(side, top, 0.72),
        p(side, foot - 0.15, run),
        p(side, foot - 0.15, 0.035),
      ],
      tangent.map((v) => v * sign * outwardSign),
      c.stoneShade,
    );
    if (lod > 1) {
      for (const i of [0, 5, 10, 15])
        beam(
          out,
          'wood',
          p(side, above(i), across(i)),
          p(side, above(i) + 0.84, across(i)),
          0.103,
          0.103,
          c.trim,
        );
      beam(out, 'wood', p(side, top + 0.84, 0.72), p(side, foot + 0.84, run), 0.1, 0.13, c.trim);
    }
  }
}

function frontage(out, a, b, wing, lod) {
  const edge = faceCoordinates(a, b);
  const { length, point: p } = edge;
  const topA = wing.height(a);
  const topB = wing.height(b);
  foundation(out, edge, a, b, lod);
  const sideA = wing.across(a);
  const sideB = wing.across(b);
  const run = [[0, topA]];
  if (sideA * sideB < 0) {
    const t = sideA / (sideA - sideB);
    if (t > 0.00001 && t < 0.99999) run.push([t * length, wing.ridge]);
  }
  run.push([length, topB]);
  for (let i = 1; i < run.length; i++) {
    const [u, y] = run[i - 1];
    const [v, z] = run[i];
    const thickness = lod === 0 ? 0 : 0.06;
    face(
      out,
      'log',
      [p(u, plinth), p(v, plinth), p(v, z - thickness), p(u, y - thickness)],
      edge.outward,
      wing.name === 'southeast' ? c.cedar : c.cedarShade,
      edge.uvs,
    );
    if (lod > 0)
      face(
        out,
        'wood',
        [p(u, y - 0.25, 0.075), p(v, z - 0.25, 0.075), p(v, z, 0.06), p(u, y, 0.06)],
        edge.outward,
        c.fascia,
        edge.uvs,
      );
  }
  if (length > 4) endLogs(out, edge, wing.eaves - 0.29, lod);
  if (length < (lod === 0 ? 7 : 2.95)) return;
  const pitch = lod === 0 ? 7.9 : 3.65;
  const count = Math.max(1, Math.floor((length - 0.65) / pitch));
  for (let i = 0; i < count; i++) {
    const x = ((i + 0.5) * length) / count;
    if (wing.name === 'southeast') {
      const site = mix(a, b, x / length);
      const bottom = Math.min(-2.18, grade(site) + 0.22);
      const entrance = lod > 0 && a === outline[45] && i === Math.floor(count * 0.74);
      if (lod === 0)
        panel(out, edge, 'glass', x - 0.84, x + 0.84, bottom, bottom + 1.8, 0.05, c.glass);
      else if (!entrance) arch(out, edge, x, bottom, lod);
      sash(out, edge, x, entrance ? 0.09 : 0.95, 1.76, entrance ? 2.39 : 1.6, lod, entrance);
      if (entrance) diningStair(out, edge, x, lod);
    } else {
      const entrance = wing.name === 'northwest' && length < 22 && i === Math.floor(count / 2);
      sash(
        out,
        edge,
        x,
        entrance ? 0.1 : 0.94,
        entrance ? 1.65 : 1.32,
        entrance ? 2.4 : 1.46,
        lod,
        entrance,
      );
      if (wing.guestFloors > 0 && (lod > 0 || i % 2 === 0))
        sash(out, edge, x, 3.78, 1.36, 1.75, lod);
      if (lod > 0 && wing.guestFloors > 0 && i % 2 === 0) {
        const gradeY = grade(mix(a, b, x / length));
        if (gradeY < -1.54) sash(out, edge, x, Math.min(-1.11, gradeY + 0.5), 0.94, 0.82, lod);
      }
      if (lod > 0 && wing.guestFloors > 0 && length < 12 && Math.min(topA, topB) > 6.2)
        sash(out, edge, x, 5.9, 0.85, 0.73, lod);
    }
  }
}

function wingRoof(out, wing, lod) {
  const uv = ([x, y, z]) => [wing.along([x, z]), Math.hypot(wing.across([x, z]), y - wing.ridge)];
  const left = splitAtRidge(wing.ring, wing.across, -1);
  const right = splitAtRidge(wing.ring, wing.across, 1);
  roofPlane(out, left, wing.height, uv, c.roof);
  roofPlane(out, right, wing.height, uv, c.roofShade);
  if (lod > 0) {
    const stations = left.filter((p) => Math.abs(wing.across(p)) < 0.0001).map(wing.along);
    const from = wing.world(Math.min(...stations) + 0.45, 0);
    const to = wing.world(Math.max(...stations) - 0.45, 0);
    beam(
      out,
      'roof',
      pos(from, wing.ridge + 0.05),
      pos(to, wing.ridge + 0.05),
      0.19,
      0.16,
      c.roofShade,
    );
  }
}

function turret(out, wing, lod) {
  const [x, z] = wing.world(wing.span - (wing.name === 'southwest' ? 4.9 : 6.8), 0);
  const radius = wing.name === 'east' ? 3.7 : 3.25;
  const top = wing.ridge + 0.94;
  const center = [x, z];
  const n = lod === 0 ? 6 : 8;
  const ring = (y, r) => radialRing(y, r, r, n, center, Math.PI / 8);
  loft(out, 'log', [ring(wing.ridge - 2.7, radius), ring(top, radius)], c.cedar);
  const canopy = [ring(top - 0.13, radius + 0.4), ring(top + 2.45, 0.28)];
  if (lod > 0) canopy.splice(1, 0, ring(top + 0.18, radius + 0.42));
  loft(out, 'roof', canopy, c.roof);
  if (lod > 1) {
    const outer = ring(top - 1.48, radius);
    for (let i = 0; i < n; i += 2) {
      const a = outer[i];
      const b = outer[(i + 1) % n];
      const edge = faceCoordinates([a[0], a[2]], [b[0], b[2]]);
      // Radial rings and the mapped outline can have opposite winding.
      const dot = edge.outward[0] * (a[0] - x) + edge.outward[2] * (a[2] - z);
      if (dot < 0)
        sash(
          out,
          faceCoordinates([b[0], b[2]], [a[0], a[2]]),
          edge.length / 2,
          top - 1.83,
          0.68,
          1.14,
          lod,
        );
      else sash(out, edge, edge.length / 2, top - 1.83, 0.68, 1.14, lod);
    }
  }
}

function dormer(out, wing, start, side, lod) {
  const d = wing.name === 'southeast' ? 8.7 : 4.5;
  const center = wing.world(start, side * d);
  const y = wing.height(center) - 0.16;
  const a = wing.world(start - 0.91, side * (d + 0.86));
  const b = wing.world(start + 0.91, side * (d + 0.86));
  const left = wing.world(start - 0.91, side * (d - 1.68));
  const right = wing.world(start + 0.91, side * (d - 1.68));
  const front = faceCoordinates(side === 1 ? a : b, side === 1 ? b : a);
  const p = front.point;
  const normal = front.outward;
  const rise = y + 2.02;
  const head = y + 1.22;
  panel(out, front, 'log', 0, front.length, y - 0.36, head, 0, c.cedarShade);
  face(
    out,
    'log',
    [p(0, head), p(front.length, head), p(front.length / 2, rise)],
    normal,
    c.cedarShade,
  );
  const back = wing.world(start, side * (d - 1.68));
  const peak = pos(back, rise + 0.12);
  face(
    out,
    'roof',
    [pos(a, head), p(front.length / 2, rise), peak, pos(left, head)],
    up,
    c.roofLight,
  );
  face(out, 'roof', [p(front.length / 2, rise), pos(b, head), pos(right, head), peak], up, c.roof);
  const inward = normal.map((v) => -v);
  face(
    out,
    'log',
    [pos(a, y - 0.4), pos(left, head - 0.46), pos(left, head), pos(a, head)],
    [normal[2], 0, -normal[0]],
    c.cedarShade,
  );
  face(
    out,
    'log',
    [pos(right, head - 0.46), pos(b, y - 0.4), pos(b, head), pos(right, head)],
    [inward[2], 0, -inward[0]],
    c.cedarShade,
  );
  sash(out, front, front.length / 2, y + 0.1, 0.87, 0.91, lod);
}

function rotunda(out, lod) {
  const eaveY = 7.39;
  const ring = coreOutline.map((p) => mix(coreCenter, p, 1.13));
  const upperY = 14.62;
  const top = ring.map((p) => mix(coreCenter, p, 0.1));
  for (let i = 0; i < ring.length; i++) {
    const next = (i + 1) % ring.length;
    const a = ring[i];
    const b = ring[next];
    const side = faceCoordinates(a, b);
    const low = side.point;
    face(
      out,
      'log',
      [low(0, 3.28), low(side.length, 3.28), low(side.length, eaveY), low(0, eaveY)],
      side.outward,
      c.cedarShade,
      side.uvs,
    );
    face(
      out,
      'roof',
      [pos(a, eaveY), pos(b, eaveY), pos(top[next], upperY), pos(top[i], upperY)],
      up,
      i % 2 === 0 ? c.roofLight : c.roof,
      ([x, y, z]) => [side.uvs([x, y, z])[0], y * 1.75],
    );
  }
  const height = grade(coreCenter) + chimneyHeightMeters;
  const topRing = (y, r) => radialRing(y, r, r, lod === 0 ? 6 : 12, coreCenter);
  loft(out, 'stone', [topRing(upperY - 0.24, 1.38), topRing(height - 0.41, 1.38)], c.lintel);
  loft(
    out,
    'roof',
    [topRing(height - 0.34, 1.63), topRing(height, 1.58), topRing(height + 0.26, 1.1)],
    c.roof,
  );
  if (lod > 0) {
    const ring = topRing(upperY + 0.32, 1.388);
    for (let i = 0; i < ring.length; i += 2) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const first = [a[0], a[2]];
      const second = [b[0], b[2]];
      const face = faceCoordinates(second, first);
      const frame =
        face.outward[0] * (a[0] - coreCenter[0]) + face.outward[2] * (a[2] - coreCenter[1]) < 0
          ? faceCoordinates(first, second)
          : face;
      panel(
        out,
        frame,
        'paint',
        frame.length * 0.21,
        frame.length * 0.79,
        upperY + 0.31,
        height - 0.91,
        0.027,
        c.darkness,
      );
    }
  }
}

function draw(out, lod) {
  for (const wing of wings) {
    wingRoof(out, wing, lod);
    for (let i = 1; i < wing.ring.length; i++)
      frontage(out, wing.ring[i - 1], wing.ring[i], wing, lod);
    if (wing.guestFloors) turret(out, wing, lod);
    if (lod > 0 && wing.guestFloors && wing.span > 29)
      for (const offset of [0.32, 0.52, 0.7]) {
        dormer(out, wing, wing.span * offset, 1, lod);
        if (lod > 1) dormer(out, wing, wing.span * offset, -1, lod);
      }
  }
  rotunda(out, lod);
}

export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [112, 99, 137];
const lookAt = [-4, 7.6, 9];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
export const model = {
  id,
  key: id,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe: `${slug}-model.mjs`,
  recipeDependencies: ['generate-motat-building.mjs'],
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Château Montebello’s cedar-log hotel with its hexagonal rotunda, guest wing turrets, riverside dining room and stone lower level.',
  camera,
  lookAt,
  sunDirection: [-98, 115, 153],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1,
    cameraYaw: 0.66,
    focus: { center: lookAt },
    groundY: -2.1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    {
      name: 'riverside-dining-room-and-guest-wing',
      position: [-9, 5.7, 115],
      lookAt: [-8, 6.4, 32],
    },
    { name: 'cedar-log-end-towers', position: [-92, 6.8, 19], lookAt: [-63, 6.0, -2] },
    { name: 'hexagonal-hall-and-radial-wings', position: [-13, 107, -92], lookAt: [-5, 7, 17] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `${slug}-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 3.5,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 1.1, surfaces },
      street: { export: 'street', errorMeters: 0.35, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.11, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Modeled from the public-domain 1930 Qualla postcard, the mapped CanVec outline, architectural histories and original Terrarium elevations.',
};
