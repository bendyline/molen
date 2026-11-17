/** Santo Domingo's basilica, corner bell tower, Veracruz chapel and convent in Lima. */
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const map = read('map-frame');
const terrain = read('terrain-grid');
const [church, chapel, convent] = map.geometry.polygons;
const courts = map.geometry.holes;
const {
  towerHeight,
  towerCenter,
  towerBaseRadius,
  naveEave,
  naveRidge,
  basilicaAisle,
  chapelEave,
  conventEave,
} = plan.dimensions;
const up = [0, 1, 0];
const ref = 'palette:#ffffff';
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.93, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.94, metallic: 0 },
  marble: { slot: 'trim', graph: 'stone_marble', roughness: 0.75, metallic: 0 },
  detail: { slot: 'trim', localRef: 'palette:#efebe0', roughness: 0.83, metallic: 0 },
};
const color = Object.fromEntries(
  Object.entries({
    church: 'c58f7c',
    red: 'ad634e',
    convent: 'dab49b',
    mainCourt: 'e2cbb3',
    chapel: 'a95b43',
    sandstone: 'b9a48e',
    stoneEdge: '827368',
    gallery: 'b59d8c',
    cream: 'e7d5b9',
    pale: 'f1dfbc',
    gray: 'b1a294',
    moulding: 'e2c5a6',
    dome: '8a5545',
    lantern: 'b47a60',
    tile: 'a06b56',
    roof: 'ad7c67',
    dark: '55433a',
    oak: '664838',
    oakLight: '785642',
    bronze: '596056',
    marble: '8f9ba1',
    tileBlue: '53738b',
    tileWhite: 'e6dcc4',
    floor: 'bfae95',
    grass: 'a6a57d',
  }).map(([key, hex]) => [key, rgb(hex)]),
);

function grade([x, z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const row = (k) =>
    terrain.heightsMeters[k][i] * (1 - u + i) + terrain.heightsMeters[k][i + 1] * (u - i);
  return row(j) * (1 - v + j) + row(j + 1) * (v - j) - terrain.modelDatumElevationMeters;
}

const p3 = ([x, z], y) => [x, y, z];
const mean = (points) =>
  points.reduce(([x, z], p) => [x + p[0] / points.length, z + p[1] / points.length], [0, 0]);
const mix = (a, b, t) => a.map((value, i) => value + (b[i] - value) * t);
const rect = (x0, x1, z0, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];

function face(out, slot, points, direction, shade) {
  let n = normalFor(...points);
  if (n.reduce((sum, value, i) => sum + value * direction[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, shade);
  else
    out.addTriangle(
      slot,
      ref,
      points,
      n,
      points.map(([x, , z]) => [x, z]),
      shade,
    );
}

function edge(a, b, winding = 1) {
  const width = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / width,
    dz = (b[1] - a[1]) / width;
  const nx = winding * dz,
    nz = -winding * dx;
  return {
    width,
    n: [nx, 0, nz],
    map(u, d = 0) {
      return [a[0] + dx * u + nx * d, a[1] + dz * u + nz * d];
    },
    at(u, y, d = 0) {
      return p3(this.map(u, d), y);
    },
  };
}

function ringEdges(ring, hole = false) {
  const area = ring.reduce((sum, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return sum + p[0] * q[1] - p[1] * q[0];
  }, 0);
  const winding = Math.sign(area) * (hole ? -1 : 1);
  return ring.map((a, i) => edge(a, ring[(i + 1) % ring.length], winding));
}

function panel(out, f, slot, u, v, b0, b1, t0, t1, d, shade) {
  face(out, slot, [f.at(u, b0, d), f.at(v, b1, d), f.at(v, t1, d), f.at(u, t0, d)], f.n, shade);
}

function cap(out, slot, ring, holes, height, shade) {
  const triangulation = new MeshBufferBuilder();
  if (!triangulation.addCap(slot, ref, ring, holes, height, up, (p) => p, shade))
    throw new Error('Cannot triangulate Santo Domingo plan');
  const { positions, indices } = triangulation.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const points = Array.from(indices.slice(i, i + 3), (index) =>
      Array.from(positions.slice(index * 3, index * 3 + 3)),
    );
    face(out, slot, points, up, shade);
  }
}

function shell(out, ring, top, shade, lod, trim = true) {
  for (const f of ringEdges(ring)) {
    const pieces = lod >= 2 ? Math.ceil(f.width / 10) : 1;
    for (let i = 0; i < pieces; i++) {
      const u = (f.width * i) / pieces,
        v = (f.width * (i + 1)) / pieces;
      const a = f.map(u),
        b = f.map(v),
        y0 = top(a),
        y1 = top(b);
      const b0 = Math.min(grade(a) - 0.35, y0 - 2),
        b1 = Math.min(grade(b) - 0.35, y1 - 2);
      panel(out, f, 'wall', u, v, b0, b1, y0, y1, 0, shade);
      if (trim && lod) {
        panel(out, f, 'stone', u, v, b0, b1, b0 + 0.78, b1 + 0.78, 0.033, color.sandstone);
        panel(
          out,
          f,
          'detail',
          u,
          v,
          y0 - 0.45,
          y1 - 0.45,
          y0 - 0.12,
          y1 - 0.12,
          0.045,
          color.moulding,
        );
      }
    }
  }
}

const basilicaFloor = ([x]) => -1.12 - 0.052 * x;
const cloisterFloor = ([x, z]) => -4.15 - 0.027 * x + 0.012 * (z + 30);
const chapelFloor = ([x]) => 0.14 - 0.022 * (x + 16);
const towerY = grade([towerCenter[0], 18.58]) + 0.12;
const feature = (id) => map.features.find(({ id: key }) => key === 'way/' + id).points;

function archProfile(u0, u1, spring, rise, parts) {
  const center = (u0 + u1) / 2,
    half = (u1 - u0) / 2;
  const values = [];
  for (let i = 0; i <= parts; i++) {
    const angle = Math.PI * (1 - i / parts);
    values.push([center + Math.cos(angle) * half, spring + Math.sin(angle) * rise]);
  }
  return values;
}

/** A masonry arch, with two jambs and wall above an open or shallow-recessed bay. */
function opening(out, f, params) {
  const {
    center,
    width,
    bottom,
    straight,
    rise,
    top,
    depth,
    steps,
    shade,
    trim = 0,
    fill,
  } = params;
  const left = center - width / 2,
    right = center + width / 2;
  const inner = archProfile(left, right, bottom + straight, rise, steps);
  if (fill) {
    panel(
      out,
      f,
      'detail',
      left,
      right,
      bottom,
      bottom,
      bottom + straight,
      bottom + straight,
      depth - 0.035,
      fill,
    );
    for (let i = 1; i < inner.length; i++) {
      const [a, ha] = inner[i - 1],
        [b, hb] = inner[i];
      face(
        out,
        'detail',
        [
          f.at(a, bottom + straight - 0.002, depth - 0.035),
          f.at(b, bottom + straight - 0.002, depth - 0.035),
          f.at(b, hb, depth - 0.035),
          f.at(a, ha, depth - 0.035),
        ],
        f.n,
        fill,
      );
    }
  } else {
    for (let i = 1; i < inner.length; i++) {
      const [a, ha] = inner[i - 1],
        [b, hb] = inner[i];
      panel(out, f, 'wall', a, b, ha, hb, top, top, depth, shade);
    }
  }
  if (!trim) return;
  const outer = archProfile(left - trim, right + trim, bottom + straight, rise + trim, steps);
  for (const [a, b] of [
    [left - trim, left],
    [right, right + trim],
  ])
    panel(
      out,
      f,
      'stone',
      a,
      b,
      bottom,
      bottom,
      bottom + straight,
      bottom + straight,
      depth + 0.095,
      shade,
    );
  for (let i = 1; i < inner.length; i++) {
    const [a, ha] = inner[i - 1],
      [b, hb] = inner[i],
      [u, hu] = outer[i - 1],
      [v, hv] = outer[i];
    face(
      out,
      'stone',
      [
        f.at(a, ha, depth + 0.096),
        f.at(b, hb, depth + 0.096),
        f.at(v, hv, depth + 0.105),
        f.at(u, hu, depth + 0.105),
      ],
      f.n,
      shade,
    );
  }
}

function pillar(out, f, u, width, y0, y1, projection, shade, lod) {
  const slot = 'stone';
  const a = f.at(u - width / 2, y0, projection - width * 0.26);
  const b = f.at(u + width / 2, y0, projection - width * 0.26);
  const c = f.at(u + width / 2, y0, projection + width * 0.26);
  const d = f.at(u - width / 2, y0, projection + width * 0.26);
  const ring = [a, d, c, b];
  loft(out, slot, [ring, ring.map(([x, , z]) => [x, y1, z])], shade, { cap: false });
  if (!lod) return;
  const low = y0 + 0.11,
    high = y1 - 0.13;
  panel(
    out,
    f,
    slot,
    u - width * 0.65,
    u + width * 0.65,
    y0,
    y0,
    low,
    low,
    projection + width * 0.32,
    color.cream,
  );
  panel(
    out,
    f,
    slot,
    u - width * 0.67,
    u + width * 0.67,
    high,
    high,
    y1,
    y1,
    projection + width * 0.36,
    color.cream,
  );
}

function dome(out, center, base, radius, height, lod, shade) {
  const sides = lod === 0 ? 8 : lod === 1 ? 12 : lod === 2 ? 16 : 24;
  const rings = [radialRing(base, radius, radius, sides, center)];
  const levels = lod > 1 ? 5 : 3;
  for (let i = 1; i <= levels; i++) {
    const theta = ((Math.PI / 2 - 0.035) * i) / levels;
    const r = Math.cos(theta) * radius;
    rings.push(radialRing(base + Math.sin(theta) * height, r, r, sides, center));
  }
  loft(out, 'roof', rings, shade);
}

function naveRoof(out, lod) {
  const x0 = -34.95,
    x1 = 45.21;
  const z0 = -8.45,
    z1 = 6.3,
    ridge = -1.8;
  const eave = ([x, z]) => basilicaFloor([x, z]) + naveEave;
  const high = ([x, z]) => basilicaFloor([x, z]) + naveRidge;
  const walls = rect(x0, x1, z0, z1);
  for (const f of ringEdges(walls)) {
    const a = f.map(0),
      b = f.map(f.width);
    panel(
      out,
      f,
      'wall',
      0,
      f.width,
      basilicaFloor(a) + 7.98,
      basilicaFloor(b) + 7.98,
      eave(a),
      eave(b),
      0,
      color.church,
    );
  }
  const a = [x0, ridge],
    b = [x1, ridge];
  for (const edgeZ of [z0, z1]) {
    const w = [
      [x0, edgeZ],
      [x1, edgeZ],
    ];
    face(
      out,
      'roof',
      [p3(w[0], eave(w[0])), p3(w[1], eave(w[1])), p3(b, high(b)), p3(a, high(a))],
      up,
      color.roof,
    );
  }
  for (const [x, normal] of [
    [x0, [-1, 0, 0]],
    [x1, [1, 0, 0]],
  ]) {
    const ends = [
      [x, z0],
      [x, z1],
    ];
    face(
      out,
      'wall',
      [p3(ends[0], eave(ends[0])), p3(ends[1], eave(ends[1])), p3([x, ridge], high([x, ridge]))],
      normal,
      color.church,
    );
  }
  if (lod >= 2) {
    for (const sign of [-1, 1]) {
      const z = sign < 0 ? z0 : z1;
      const f = edge([x0, z], [x1, z], -sign);
      for (let u = 6; u < f.width - 7; u += 7.1) {
        const y = eave(f.map(u)) - 2.22;
        opening(out, f, {
          center: u,
          width: 1.1,
          bottom: y,
          straight: 0.92,
          rise: 0.37,
          depth: 0.067,
          steps: 5,
          shade: color.cream,
          trim: 0.102,
          fill: color.dark,
        });
      }
    }
  }
}

function lantern(out, center, base, r, lod) {
  const sides = lod ? 12 : 8;
  const drum = [
    radialRing(base, r, r, sides, center),
    radialRing(base + r * 0.95, r, r, sides, center),
    radialRing(base + r * 1.1, r * 1.1, r * 1.1, sides, center),
  ];
  loft(out, 'wall', drum, color.lantern);
  if (lod >= 2) {
    const sides2d = drum[1].map(([x, , z]) => [x, z]);
    for (const f of ringEdges(sides2d))
      panel(
        out,
        f,
        'detail',
        f.width * 0.24,
        f.width * 0.76,
        base + r * 0.22,
        base + r * 0.22,
        base + r * 0.82,
        base + r * 0.82,
        0.01,
        color.dark,
      );
  }
  dome(out, center, base + r * 1.1, r * 1.12, r * 0.8, lod, color.dome);
}

function cupolas(out, lod) {
  for (const id of [
    440269141, 620649013, 620648983, 620648987, 620648991, 620648995, 620649000, 620649008,
  ]) {
    const shape = feature(id),
      center = mean(shape);
    const radial = shape.reduce(
      (sum, p) => sum + Math.hypot(p[0] - center[0], p[1] - center[1]) / shape.length,
      0,
    );
    // This mapped round part is within the footprint of the bell tower.
    if (id === 440269141) continue;
    const y = basilicaFloor(center) + basilicaAisle;
    if (id === 620649013) {
      const base = basilicaFloor(center) + naveRidge - 1.15;
      loft(
        out,
        'wall',
        [
          radialRing(base - 0.65, radial, radial, 12, center),
          radialRing(base + 1.15, radial, radial, 12, center),
        ],
        color.church,
      );
      dome(out, center, base + 1.15, radial * 1.03, radial * 0.81, lod, color.dome);
      if (lod >= 2) lantern(out, center, base + 1.12 + radial * 0.8, 0.76, lod);
    } else {
      if (lod < 2) {
        const ring = radialRing(y - 0.025, radial, radial, 6, center);
        const shoulder = radialRing(y + radial * 0.61, radial * 0.69, radial * 0.69, 6, center);
        if (lod === 1) loft(out, 'roof', [ring, shoulder], color.dome, { cap: false });
        const outline = lod === 0 ? ring : shoulder;
        for (let i = 0; i < outline.length; i++)
          face(
            out,
            'roof',
            [outline[i], outline[(i + 1) % outline.length], p3(center, y + radial * 0.98)],
            up,
            color.dome,
          );
      } else dome(out, center, y - 0.02, radial, radial * 0.98, 1, color.dome);
      if (lod >= 2) lantern(out, center, y + radial * 0.95, 0.18, 0);
    }
  }
}

function portal(out, f, u, y, width, height, lod, { ornate = true } = {}) {
  const straight = height - width * 0.44;
  const shade = ornate ? color.cream : color.sandstone;
  opening(out, f, {
    center: u,
    width,
    bottom: y,
    straight,
    rise: width * 0.44,
    depth: 0.12,
    steps: lod > 1 ? 10 : lod ? 5 : 3,
    shade,
    trim: lod ? (ornate ? 0.3 : 0.19) : 0,
    fill: color.oak,
  });
  if (!lod) return;
  const projection = ornate ? 0.38 : 0.17;
  const side = width / 2 + 0.64;
  for (const sign of [-1, 1]) {
    pillar(
      out,
      f,
      u + sign * side,
      ornate ? 0.77 : 0.47,
      y,
      y + height + 0.38,
      projection,
      shade,
      lod,
    );
    if (lod >= 2 && ornate)
      pillar(
        out,
        f,
        u + sign * (side + 0.62),
        0.43,
        y,
        y + height + 0.38,
        projection - 0.13,
        shade,
        lod,
      );
  }
  const lx = u - side - 0.58,
    rx = u + side + 0.58;
  panel(
    out,
    f,
    'stone',
    lx,
    rx,
    y + height + 0.24,
    y + height + 0.24,
    y + height + 0.68,
    y + height + 0.68,
    projection + 0.26,
    shade,
  );
  if (ornate) {
    const a = y + height + 0.78;
    const frameWidth = width * 0.68;
    opening(out, f, {
      center: u,
      width: frameWidth,
      bottom: a,
      straight: 1.6,
      rise: 0.44,
      depth: 0.15,
      steps: lod + 4,
      shade,
      trim: 0.24,
      fill: color.dark,
    });
    for (const sign of [-1, 1])
      pillar(out, f, u + sign * (frameWidth / 2 + 0.49), 0.44, a, a + 2.3, 0.21, shade, lod);
    const step = width * 0.45 + 0.55;
    panel(
      out,
      f,
      'detail',
      u - step,
      u + step,
      a + 2.19,
      a + 2.19,
      a + 2.44,
      a + 2.44,
      0.37,
      shade,
    );
    face(
      out,
      'stone',
      [f.at(u - step, a + 2.45, 0.24), f.at(u + step, a + 2.45, 0.24), f.at(u, a + 3.34, 0.22)],
      f.n,
      shade,
    );
  }
  if (lod >= 2) {
    for (const sign of [-1, 1]) {
      const center = u + sign * width * 0.24;
      for (let row = 0; row < 3; row++) {
        const h = y + 0.15 + row * 0.86;
        panel(
          out,
          f,
          'detail',
          center - width * 0.18,
          center + width * 0.18,
          h,
          h,
          h + 0.63,
          h + 0.63,
          0.14,
          color.oakLight,
        );
      }
    }
    panel(
      out,
      f,
      'detail',
      u - 0.023,
      u + 0.023,
      y,
      y,
      y + height - 0.12,
      y + height - 0.12,
      0.158,
      color.dark,
    );
  }
}

function streetFronts(out, lod) {
  const south = edge(church[14], church[13], -1);
  const camana = edge(church[10], church[11]);
  const ch = edge(chapel[4], chapel[0], -1);
  const fronts = [
    [south, 12.7, 3.55, 4.33, 7.4, true],
    [camana, 8.3, 4.2, 5.05, 8.1, true],
    [ch, 17, 3.25, 4.3, 6.0, false],
  ];
  for (const [f, u, width, height, , ornate] of fronts) {
    const threshold = grade(f.map(u, 0.65)) + 0.54;
    portal(out, f, u, threshold, width, height, lod, { ornate });
  }
  if (lod) {
    for (const [f, centers, y] of [
      [south, [5.3, 21.7], 4.7],
      [ch, [4, 29.9], 5.8],
    ]) {
      for (const u of centers)
        opening(out, f, {
          center: u,
          width: 1.06,
          bottom: y,
          straight: 1.1,
          rise: 0.34,
          depth: 0.068,
          steps: lod + 4,
          shade: color.sandstone,
          trim: 0.14,
          fill: color.dark,
        });
    }
    for (const [f, u, , , length] of fronts) {
      const y = grade(f.map(u, 0.65)) + 0.54;
      const steps = lod >= 2 ? 3 : 1;
      for (let i = 0; i < steps; i++) {
        const d = 0.57 + i * 0.33;
        const l = length * (0.5 + i * 0.025);
        const h = y - i * 0.16;
        const a = u - l,
          b = u + l;
        face(
          out,
          'stone',
          [f.at(a, h, d - 0.33), f.at(b, h, d - 0.33), f.at(b, h, d), f.at(a, h, d)],
          up,
          color.cream,
        );
        panel(out, f, 'stone', a, b, h - 0.22, h - 0.22, h, h, d, color.sandstone);
      }
    }
  }
}

const octagon = (y, radius) => radialRing(y, radius, radius, 8, towerCenter, Math.PI / 8);
const towerRing = (out, slot, y0, y1, r0, r1, shade) =>
  loft(out, slot, [octagon(towerY + y0, r0), octagon(towerY + y1, r1)], shade, { cap: false });

function towerBase(out, lod) {
  const baseRadius = towerBaseRadius;
  const at = octagon(towerY, baseRadius).map(([x, , z]) => [x, z]);
  for (const f of ringEdges(at)) {
    const a = f.map(0),
      b = f.map(f.width);
    const lowA = Math.min(towerY - 0.44, grade(a) - 0.49),
      lowB = Math.min(towerY - 0.44, grade(b) - 0.49);
    panel(out, f, 'wall', 0, f.width, lowA, lowB, towerY + 15.8, towerY + 15.8, 0, color.church);
    panel(
      out,
      f,
      'stone',
      0,
      f.width,
      lowA,
      lowB,
      towerY + 0.8,
      towerY + 0.8,
      0.058,
      color.sandstone,
    );
    if (lod && (f.n[0] > 0.66 || f.n[2] > 0.66)) {
      const u = f.width / 2;
      if (lod >= 2)
        opening(out, f, {
          center: u,
          width: 2.98,
          bottom: towerY + 2.19,
          straight: 7.65,
          rise: 1.25,
          depth: 0.028,
          steps: lod >= 2 ? 10 : 5,
          shade: color.cream,
          trim: 0.29,
          fill: color.sandstone,
        });
      for (const h of [3.2, 8.2])
        opening(out, f, {
          center: u,
          width: 1.03,
          bottom: towerY + h,
          straight: 0.93,
          rise: 0.35,
          depth: 0.082,
          steps: lod + 4,
          shade: color.sandstone,
          trim: 0.1,
          fill: color.dark,
        });
    }
    if (lod >= 2) {
      for (let j = 1; j <= 12; j++) {
        const low = towerY + 0.84 + j * 1.12;
        const side = 0.85 + (j % 2) * 0.27;
        for (const [u, v] of [
          [0.02, side],
          [f.width - side, f.width - 0.02],
        ])
          panel(out, f, 'stone', u, v, low, low, low + 1.06, low + 1.06, 0.075, color.sandstone);
      }
    }
  }
  const bands = lod
    ? [
        [15.28, 15.65, baseRadius + 0.15],
        [15.65, 16.18, baseRadius + 0.43],
        [16.18, 16.52, baseRadius + 0.3],
        [16.52, 16.86, baseRadius + 0.12],
      ]
    : [[15.38, 16.86, baseRadius + 0.27]];
  for (const [low, high, r] of bands) towerRing(out, 'stone', low, high, r, r, color.cream);
}

function bellStage(out, lod, { base, top, radius, shade }) {
  const perimeter = octagon(towerY + base, radius).map(([x, , z]) => [x, z]);
  const foot = towerY + base,
    roof = towerY + top;
  for (const f of ringEdges(perimeter)) {
    const u = f.width / 2,
      width = f.width * 0.463;
    const y = foot + 1.86,
      height = (top - base) * 0.58;
    panel(out, f, 'wall', 0, f.width, foot, foot, y, y, 0, shade);
    for (const [a, b] of [
      [0, u - width / 2],
      [u + width / 2, f.width],
    ])
      panel(out, f, 'wall', a, b, y, y, roof, roof, 0, shade);
    opening(out, f, {
      center: u,
      width,
      bottom: y,
      straight: height - width * 0.45,
      rise: width * 0.45,
      top: roof,
      depth: 0,
      steps: lod < 2 ? 3 : 9,
      shade,
      trim: lod >= 2 ? 0.2 : 0,
    });
    if (!lod) continue;
    for (const side of lod >= 2 ? [-1, 1] : []) {
      pillar(
        out,
        f,
        u + side * width * 0.79,
        0.55,
        foot + 0.46,
        roof - 0.31,
        0.13,
        color.cream,
        lod - 1,
      );
      if (lod >= 2)
        pillar(
          out,
          f,
          u + side * width * 0.99,
          0.31,
          foot + 0.54,
          roof - 0.28,
          0.09,
          color.moulding,
          lod - 1,
        );
    }
    const railHalf = width * 0.62;
    const a = u - railHalf,
      b = u + railHalf;
    face(
      out,
      'stone',
      [
        f.at(a, y + 0.04, 0),
        f.at(b, y + 0.04, 0),
        f.at(b, y + 0.04, 0.72),
        f.at(a, y + 0.04, 0.72),
      ],
      up,
      color.cream,
    );
    panel(out, f, 'stone', a, b, y - 0.16, y - 0.16, y + 0.06, y + 0.06, 0.72, color.cream);
    panel(out, f, 'detail', a, b, y + 0.58, y + 0.58, y + 0.65, y + 0.65, 0.69, color.moulding);
    if (lod >= 2) {
      for (let i = 1; i < 7; i++) {
        const p = a + ((b - a) * i) / 7;
        panel(
          out,
          f,
          'stone',
          p - 0.045,
          p + 0.045,
          y + 0.05,
          y + 0.05,
          y + 0.61,
          y + 0.61,
          0.678,
          color.cream,
        );
      }
      if (f.n[0] > 0.8 || f.n[2] > 0.8) {
        const bellCenter = f.map(u, -0.92);
        const bellTop = y + height * 0.83;
        loft(
          out,
          'detail',
          [
            radialRing(bellTop - 1.22, 0.51, 0.51, 10, bellCenter),
            radialRing(bellTop - 0.96, 0.37, 0.37, 10, bellCenter),
            radialRing(bellTop - 0.24, 0.22, 0.22, 10, bellCenter),
            radialRing(bellTop, 0.14, 0.14, 10, bellCenter),
          ],
          color.bronze,
        );
        const sp = u - width * 0.64,
          ep = u + width * 0.64;
        panel(
          out,
          f,
          'stone',
          sp,
          ep,
          y + height + 0.36,
          y + height + 0.36,
          y + height + 0.6,
          y + height + 0.6,
          0.23,
          color.moulding,
        );
        face(
          out,
          'stone',
          [
            f.at(sp, y + height + 0.61, 0.19),
            f.at(ep, y + height + 0.61, 0.19),
            f.at(u, y + height + 1.31, 0.17),
          ],
          f.n,
          color.cream,
        );
      }
    }
  }
  if (lod)
    towerRing(out, 'stone', base + 0.15, top - 0.35, radius * 0.54, radius * 0.54, color.stoneEdge);
  if (lod) {
    towerRing(out, 'stone', base + 0.03, base + 0.29, radius + 0.16, radius + 0.16, color.pale);
    towerRing(out, 'stone', top - 0.74, top - 0.46, radius + 0.14, radius + 0.3, color.moulding);
  }
  towerRing(out, 'stone', top - 0.34, top + 0.12, radius + 0.38, radius + 0.44, color.cream);
  towerRing(out, 'stone', top + 0.12, top + 0.4, radius + 0.44, radius - 0.05, color.cream);
}

function tower(out, lod) {
  towerBase(out, lod);
  bellStage(out, lod, { base: 16.75, top: 28.65, radius: 5.24, shade: color.church });
  bellStage(out, lod, { base: 28.92, top: 39.45, radius: 4.65, shade: color.church });
  towerRing(out, 'wall', 39.65, 41.62, 4.14, 3.63, color.red);
  towerRing(out, 'stone', 41.26, 41.66, 3.82, 3.8, color.cream);
  dome(out, towerCenter, towerY + 41.59, 3.58, 2.48, lod, color.dome);
  const [x, z] = towerCenter;
  const high = towerY + towerHeight;
  loft(
    out,
    'detail',
    [radialRing(high - 2, 0.43, 0.43, 8, [x, z]), radialRing(high - 1.42, 0.23, 0.23, 8, [x, z])],
    color.bronze,
  );
  if (!lod) {
    beam(out, 'detail', [x, high - 1.64, z], [x, high, z], 0.27, 0.22, color.bronze);
    return;
  }
  loft(
    out,
    'detail',
    [
      radialRing(high - 1.53, 0.15, 0.16, 6, [x, z]),
      radialRing(high - 0.42, 0.24, 0.18, 6, [x, z]),
      radialRing(high - 0.22, 0.105, 0.11, 6, [x, z]),
    ],
    color.bronze,
  );
  beam(
    out,
    'detail',
    [x, high - 0.28, z],
    [x + 0.79, high - 0.18, z + 0.18],
    0.095,
    0.075,
    color.bronze,
  );
  const wing = lod === 1 ? 0.65 : 0.86;
  for (const s of [-1, 1]) {
    face(
      out,
      'detail',
      [
        [x, high - 0.45, z],
        [x - 0.3, high - 0.99, z + s * wing * 0.48],
        [x - 0.24, high, z + s * wing],
      ],
      [1, 0, 0],
      color.bronze,
    );
  }
}

function courtArcades(out, ring, index, lod) {
  const center = mean(ring);
  const y = grade(center) + 0.19;
  const top = (p) => cloisterFloor(p) + conventEave;
  const floor = (p) => grade(p) + 0.12;
  cap(out, 'stone', ring, [], floor, color.floor);
  if (lod) {
    const outer = ring.map((p) =>
      p.map((v, i) => v + Math.sign(v - center[i]) * (index === 2 ? 1.6 : 2.35)),
    );
    cap(out, 'stone', outer, [ring], floor, color.floor);
    for (const f of ringEdges(outer, true)) {
      const a = f.map(0),
        b = f.map(f.width);
      panel(
        out,
        f,
        'wall',
        0,
        f.width,
        Math.min(y, floor(a)) - 0.25,
        Math.min(y, floor(b)) - 0.25,
        top(a),
        top(b),
        0,
        color.gallery,
      );
      if (lod < 2) continue;
      const bays = Math.max(2, Math.round(f.width / 6.2));
      for (let i = 0; i < bays; i++) {
        const center = (f.width * (i + 0.5)) / bays;
        opening(out, f, {
          center,
          width: 1.42,
          bottom: y + 0.17,
          straight: 1.75,
          rise: 0.55,
          depth: 0.065,
          steps: 5,
          shade: color.moulding,
          trim: 0.13,
          fill: color.oak,
        });
      }
    }
  }
  const edges = ringEdges(ring, true);
  for (const f of edges) {
    if (lod === 0 && index > 0) {
      const a = f.map(0),
        b = f.map(f.width);
      panel(out, f, 'wall', 0, f.width, floor(a), floor(b), top(a), top(b), 0, color.convent);
      continue;
    }
    const bays =
      lod === 0 ? 2 : Math.max(2, Math.round(f.width / (lod === 1 ? 6 : index === 0 ? 3.75 : 4.5)));
    const gap = f.width / bays;
    const upper = index === 0 && lod > 0;
    const trim = lod >= 2 ? 0.15 : 0;
    const lowerRise = index ? 1.15 : 1.32;
    for (let i = 0; i < bays; i++) {
      const a = gap * i,
        b = gap * (i + 1),
        u = (a + b) / 2;
      const h = y + 3.88;
      const pillarWidth = index === 0 ? 0.63 : 0.6;
      const hallWidth = gap - pillarWidth;
      const low = Math.min(floor(f.map(a)), floor(f.map(b)), y) - 0.31;
      for (const [left, right] of [
        [a, a + pillarWidth / 2],
        [b - pillarWidth / 2, b],
      ])
        panel(out, f, 'wall', left, right, low, low, h, h, 0, color.mainCourt);
      opening(out, f, {
        center: u,
        width: hallWidth,
        bottom: y + 0.03,
        straight: 2.03,
        rise: lowerRise,
        top: h,
        depth: 0,
        steps: lod < 2 ? 3 : 8,
        shade: color.mainCourt,
        trim,
      });
      const y0 = top(f.map(a)),
        y1 = top(f.map(b));
      if (upper && Math.min(y0, y1) - h > 2.85) {
        const lower = h + 0.58,
          ceiling = Math.min(y0, y1) - 0.25;
        const hi = Math.min(ceiling - lower - 0.33, 2.55);
        panel(out, f, 'wall', a, b, h, h, lower, lower, 0, color.mainCourt);
        for (const [left, right] of [
          [a, a + gap * 0.21],
          [b - gap * 0.21, b],
        ])
          panel(out, f, 'wall', left, right, lower, lower, ceiling, ceiling, 0, color.mainCourt);
        opening(out, f, {
          center: u,
          width: gap * 0.58,
          bottom: lower,
          straight: hi * 0.64,
          rise: hi * 0.36,
          top: ceiling,
          depth: 0,
          steps: lod + 3,
          shade: color.cream,
          trim: lod >= 2 ? 0.09 : 0,
        });
        panel(out, f, 'wall', a, b, ceiling, ceiling, y0, y1, 0, color.mainCourt);
      } else panel(out, f, 'wall', a, b, h, h, y0, y1, 0, color.mainCourt);
      if (lod >= 2) {
        const at = a + pillarWidth * 0.28;
        pillar(out, f, at, pillarWidth * 0.85, low, y + 2.07, 0.08, color.cream, lod - 1);
        panel(
          out,
          f,
          'marble',
          a + 0.065,
          a + pillarWidth * 0.56,
          y + 0.18,
          y + 0.18,
          y + 1.72,
          y + 1.72,
          0.23,
          color.marble,
        );
      }
      if (lod >= 3 && index === 0) {
        for (let row = 0; row < 5; row++) {
          const z0 = y + 0.22 + row * 0.294;
          const t = a + 0.09;
          const shade = row % 2 ? color.tileBlue : color.tileWhite;
          panel(out, f, 'detail', t, t + 0.23, z0, z0, z0 + 0.244, z0 + 0.244, 0.235, shade);
          face(
            out,
            'detail',
            [
              f.at(t + 0.02, z0 + 0.12, 0.239),
              f.at(t + 0.115, z0 + 0.023, 0.239),
              f.at(t + 0.205, z0 + 0.12, 0.239),
              f.at(t + 0.115, z0 + 0.216, 0.239),
            ],
            f.n,
            row % 2 ? color.tileWhite : color.tileBlue,
          );
        }
      }
    }
    if (lod > 0) {
      panel(out, f, 'stone', 0, f.width, y + 3.75, y + 3.75, y + 3.94, y + 3.94, 0.11, color.cream);
      const h0 = top(f.map(0)),
        h1 = top(f.map(f.width));
      panel(out, f, 'stone', 0, f.width, h0 - 0.21, h1 - 0.21, h0, h1, 0.09, color.cream);
    }
  }
  if (index === 0 && lod) {
    const [x, z] = center;
    cap(
      out,
      'detail',
      rect(x - 7.35, x + 7.35, z - 7.45, z + 7.45),
      [],
      (p) => floor(p) + 0.039,
      color.grass,
    );
  }
}

function build(out, lod) {
  const towerFinish = (p) => basilicaFloor(p) + basilicaAisle;
  const chapelFinish = (p) => chapelFloor(p) + chapelEave;
  const conventFinish = (p) => cloisterFloor(p) + conventEave;
  shell(out, church, towerFinish, color.church, lod);
  shell(out, chapel, chapelFinish, color.chapel, lod);
  shell(out, convent, conventFinish, color.convent, lod);
  cap(out, 'roof', church, [], towerFinish, color.roof);
  cap(out, 'roof', chapel, [], chapelFinish, color.tile);
  cap(out, 'roof', convent, courts, conventFinish, color.tile);
  naveRoof(out, lod);
  cupolas(out, lod);
  streetFronts(out, lod);
  for (const [index, ring] of courts.entries()) courtArcades(out, ring, index, lod);
  tower(out, lod);
}

export const santoDomingoSkyline = (out) => build(out, 0);
export const santoDomingoDistrict = (out) => build(out, 1);
export const santoDomingoStreet = (out) => build(out, 2);
export const santoDomingoCloseup = (out) => build(out, 3);

const recipe = 'santo-domingo-lima-model.mjs';
const camera = [100, 78, 126];
const lookAt = [-10, 12, -12];

export const santoDomingoModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  wikidataId: plan.wikidataId,
  cell: plan.cell,
  recipe,
  surfaces,
  build: santoDomingoCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  buildingCutout: {
    outline: church,
    outlines: [chapel, convent],
    minimumCoverage: 0.995,
    basis: 'Three named mapped building shells of the Dominican complex.',
  },
  brief:
    'The standing Santo Domingo basilica and Veracruz chapel in Lima, its 46 m Rococo bell tower and three open convent cloisters.',
  camera,
  lookAt,
  sunDirection: [86, 104, 93],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1.77,
    cameraYaw: 0.51,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'superunda-bell-tower-and-side-portal', position: [16, 8, 85], lookAt: [27, 13, 12] },
    { name: 'camana-basilica-front-and-bell-stage', position: [86, 6, 31], lookAt: [37, 12, 8] },
    { name: 'convent-and-open-courtyards', position: [-82, 74, -67], lookAt: [-16, 6, -29] },
    { name: 'principal-cloister-and-nave-cupolas', position: [13, 12, -37], lookAt: [-6, 2, -27] },
    { name: 'principal-cloister-gallery', position: [10.5, -3.9, -42], lookAt: [-9, -4.4, -29] },
    { name: 'two-rococo-campanile-stages', position: [68, 31, 53], lookAt: [34.6, 24, 12.4] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'santo-domingo-lima-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'santoDomingoSkyline',
    errorMeters: 1.44,
    surfaces,
    authoredLevels: {
      district: { export: 'santoDomingoDistrict', errorMeters: 0.62, surfaces },
      street: { export: 'santoDomingoStreet', errorMeters: 0.24, surfaces },
      closeup: { export: 'santoDomingoCloseup', errorMeters: 0.081, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry based on the cleared public-domain Qualla Courret cloister photograph, Garreaud’s public-domain 1900 plate, the operator’s written history, attributed OpenStreetMap and original Terrarium elevations.',
};
