/** The Kasbah of the Udayas, its fortified perimeter and the riverside white-roofed quarter. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const { features } = read('map-frame.json');
const field = read('terrain-grid.json');
const { residential } = read('native-map/residential-footprints.json');
const gardenMap = read('native-map/andalusian-garden-controls.json');
const mapped = new Map(features.map(({ id, points }) => [Number(id.slice(4)), points]));
const palette = 'palette:#ffffff';
const up = [0, 1, 0];
const colors = Object.fromEntries(
  Object.entries({
    stone: 'b28e66',
    wall: 'a78663',
    lightStone: 'c5a577',
    cutStone: '9c734a',
    sand: 'bba287',
    white: 'e2e1d7',
    cream: 'dfd8c8',
    lime: 'd8dbd7',
    pearl: 'e9e5d8',
    blue: '638ba8',
    wood: '6d5945',
    dark: '515552',
    roof: 'c1b5a4',
    green: '537362',
    myrtle: '637451',
    lowHedge: '7e8555',
    fountain: '6d8c83',
  }).map(([key, hex]) => [key, rgb(hex)]),
);
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.95, metallic: 0 },
  ashlar: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.94, metallic: 0 },
  lime: { slot: 'wall', graph: 'plaster_lime', roughness: 0.9, metallic: 0 },
  paving: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.93, metallic: 0 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.91, metallic: 0 },
  shade: { slot: 'window', localRef: palette, roughness: 0.85, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.85, metallic: 0 },
};
const mix = (a, b, t) => a + (b - a) * t;
const distance = ([x, z], [u, v]) => Math.hypot(u - x, v - z);
const center = (ring) =>
  [0, 1].map((axis) => ring.reduce((sum, p) => sum + p[axis], 0) / ring.length);
const area = (ring) =>
  ring.reduce((sum, [x, z], i) => {
    const [u, v] = ring[(i + 1) % ring.length];
    return sum + x * v - z * u;
  }, 0) / 2;
const outline = (id) => mapped.get(id).slice(0, -1);
const seed = (id) => Math.imul(id, 2654435761) >>> 0;

function ground(x, z) {
  const u = (x - field.origin[0]) / field.stepMeters;
  const v = (z - field.origin[1]) / field.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const a = field.heightsMeters[j];
  const b = field.heightsMeters[j + 1];
  return (
    mix(mix(a[i], a[i + 1], u - i), mix(b[i], b[i + 1], u - i), v - j) -
    field.modelDatumElevationMeters
  );
}

function surface(out, slot, vertices, outward, color) {
  out.addConvexPolygon(
    slot,
    palette,
    vertices,
    outward,
    ([x, y, z]) => (outward[1] > 0.65 ? [x, z] : [x - z, y]),
    color,
  );
}

function sloped(out, slot, vertices, outward, color) {
  for (const p of [
    [vertices[0], vertices[1], vertices[2]],
    [vertices[0], vertices[2], vertices[3]],
  ]) {
    const normal = normalFor(...p);
    if (normal[0] * outward[0] + normal[1] * outward[1] + normal[2] * outward[2] < 0)
      surface(
        out,
        slot,
        p,
        normal.map((v) => -v),
        color,
      );
    else surface(out, slot, p, normal, color);
  }
}

function cap(out, slot, ring, y, color, holes = []) {
  const mesh = new MeshBufferBuilder();
  const height = typeof y === 'function' ? y : () => y;
  if (!mesh.addCap(slot, palette, ring, holes, height, up, (p) => p, color))
    throw Error('Invalid Kasbah roof outline');
  const baked = mesh.finalize();
  for (let i = 0; i < baked.indices.length; i += 3) {
    const vertices = Array.from(baked.indices.slice(i, i + 3), (index) =>
      Array.from(baked.positions.slice(index * 3, index * 3 + 3)),
    );
    surface(out, slot, vertices, up, color);
  }
}

function frame([x, z], [nx, nz]) {
  const length = Math.hypot(nx, nz);
  nx /= length;
  nz /= length;
  return {
    point: (u, y, v) => [x + nz * u + nx * v, y, z - nx * u + nz * v],
    vector: ([u, y, v]) => [nz * u + nx * v, y, -nx * u + nz * v],
    local: ([u, v]) => [(u - x) * nz - (v - z) * nx, (u - x) * nx + (v - z) * nz],
  };
}

function oriented(out, axes) {
  return {
    addQuad(slot, material, vertices, normal, uv, color) {
      out.addQuad(
        slot,
        material,
        vertices.map((p) => axes.point(...p)),
        axes.vector(normal),
        uv,
        color,
      );
    },
    addTriangle(slot, material, vertices, normal, uv, color) {
      out.addTriangle(
        slot,
        material,
        vertices.map((p) => axes.point(...p)),
        axes.vector(normal),
        uv,
        color,
      );
    },
    addConvexPolygon(slot, material, vertices, normal, uvOf, color) {
      out.addConvexPolygon(
        slot,
        material,
        vertices.map((p) => axes.point(...p)),
        axes.vector(normal),
        uvOf,
        color,
      );
    },
  };
}

function simplify(path, tolerance) {
  if (path.length <= 2) return path;
  const first = path[0];
  const last = path.at(-1);
  const x = last[0] - first[0];
  const z = last[1] - first[1];
  const squared = x * x + z * z;
  let farthest = tolerance;
  let index = -1;
  for (let i = 1; i < path.length - 1; i++) {
    const p = path[i];
    const t =
      squared === 0
        ? 0
        : Math.max(0, Math.min(1, ((p[0] - first[0]) * x + (p[1] - first[1]) * z) / squared));
    const gap = distance(p, [first[0] + x * t, first[1] + z * t]);
    if (gap <= farthest) continue;
    farthest = gap;
    index = i;
  }
  if (index < 0) return [first, last];
  return [
    ...simplify(path.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplify(path.slice(index), tolerance),
  ];
}

function pathSections(raw, lod, closed) {
  const path = simplify(raw, [7.5, 2.5, 0.88, 0.19][lod]);
  const sections = [];
  for (let i = 1; i < path.length; i++) {
    const [x, z] = path[i - 1],
      [u, v] = path[i];
    const length = distance(path[i - 1], path[i]);
    const steps = Math.ceil(length / [62, 24, 14, 9][lod]);
    for (let j = 0; j < steps; j++) sections.push([mix(x, u, j / steps), mix(z, v, j / steps)]);
  }
  if (!closed) sections.push(path.at(-1));
  return sections;
}

function rampart(out, raw, { height, width, closed = false, gate = false }, lod) {
  const line = pathSections(raw, lod, closed);
  const stations = line.map(([x, z], i) => {
    const [a, b] = line[closed ? (i + line.length - 1) % line.length : Math.max(0, i - 1)];
    const [c, d] = line[closed ? (i + 1) % line.length : Math.min(line.length - 1, i + 1)];
    const n = [d - b, a - c];
    const length = Math.hypot(...n);
    const wall = ground(x, z);
    return {
      point: (side, y, scale) => [
        x + (side * width * scale * n[0]) / length,
        y,
        z + (side * width * scale * n[1]) / length,
      ],
      top: wall + height,
      foot: wall - 1.45,
    };
  });
  const count = closed ? line.length : line.length - 1;
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % line.length;
    const [x, z] = line[i],
      [u, v] = line[j];
    const length = distance(line[i], line[j]);
    if (
      gate &&
      Math.abs(gateAxes.local([(x + u) / 2, (z + v) / 2])[0]) < 5.5 &&
      Math.abs(gateAxes.local([(x + u) / 2, (z + v) / 2])[1]) < 20.3
    )
      continue;
    const a = stations[i],
      b = stations[j];
    for (const side of [-1, 1]) {
      sloped(
        out,
        'stone',
        [
          a.point(side, a.foot, 0.54),
          b.point(side, b.foot, 0.54),
          b.point(side, b.top, 0.5),
          a.point(side, a.top, 0.5),
        ],
        [side * (v - z), 0, side * (x - u)],
        colors.wall,
      );
    }
    sloped(
      out,
      'ashlar',
      [
        a.point(-1, a.top, 0.5),
        b.point(-1, b.top, 0.5),
        b.point(1, b.top, 0.5),
        a.point(1, a.top, 0.5),
      ],
      up,
      colors.lightStone,
    );
    if (lod < 2 || !gate || z < -155 || z > 120 || length < 2.4) continue;
    const step = z < -65 ? 4.5 : 3.3;
    const count = Math.floor(length / step);
    const sign = Math.sign(area(line));
    const axes = frame([(x + u) / 2, (z + v) / 2], [sign * (v - z), sign * (x - u)]);
    const local = oriented(out, axes);
    for (let k = 1; k <= count; k++) {
      const t = k / (count + 1);
      const offset = sign * (t - 0.5) * length;
      merlon(local, offset, mix(a.top, b.top, t) - 0.09, width * 0.39, 0.83, 0.59, lod);
    }
  }
}

function shell(out, ring, y, slot, color, { roofing = color, roofSlot = slot, holes = [] } = {}) {
  for (const [path, inverse] of [[ring, 1], ...holes.map((hole) => [hole, -1])]) {
    const sign = Math.sign(area(path)) * inverse;
    for (let i = 0; i < path.length; i++) {
      const [x, z] = path[i];
      const [u, v] = path[(i + 1) % path.length];
      const len = distance([x, z], [u, v]);
      if (len < 0.025) continue;
      surface(
        out,
        slot,
        [
          [x, ground(x, z) - 0.65, z],
          [u, ground(u, v) - 0.65, v],
          [u, y, v],
          [x, y, z],
        ],
        [(sign * (v - z)) / len, 0, (sign * (x - u)) / len],
        color,
      );
    }
  }
  cap(out, roofSlot, ring, y, roofing, holes);
}

function edgeFrame(ring, i, sign) {
  const [x, z] = ring[i];
  const [u, v] = ring[(i + 1) % ring.length];
  return frame([(x + u) / 2, (z + v) / 2], [sign * (v - z), sign * (x - u)]);
}

function top(ring) {
  return Math.max(...ring.map(([x, z]) => ground(x, z)));
}

function bastion(out, id, height, lod) {
  const ring = outline(id);
  const roof = top(ring) + height;
  shell(out, ring, roof, 'stone', colors.stone, { roofSlot: 'paving', roofing: colors.sand });
  if (lod === 0) return;
  const sign = Math.sign(area(ring));
  for (let i = 0; i < ring.length; i++) {
    const length = distance(ring[i], ring[(i + 1) % ring.length]);
    if (length < 1.3) continue;
    const local = oriented(out, edgeFrame(ring, i, sign));
    box(
      local,
      'ashlar',
      [-length / 2, roof - 0.3, -0.95],
      [length / 2, roof + 0.57, 0.11],
      colors.lightStone,
    );
    if (lod > 1 && length > 3.4) {
      const count = Math.ceil(length / 2.95);
      for (let j = 0; j < count; j++)
        merlon(local, length * ((j + 0.5) / count - 0.5), roof + 0.56, -0.42, 0.86, 0.83, lod);
    }
  }
}

function hipped(out, slot, x, z, y, width, depth, h, color) {
  const left = x - width / 2,
    right = x + width / 2;
  const near = z + depth / 2,
    far = z - depth / 2;
  const ridge = (width - depth) / 2;
  const a = [x - ridge, y + h, z],
    b = [x + ridge, y + h, z];
  const p = [
    [left, y, near],
    [right, y, near],
    [right, y, far],
    [left, y, far],
  ];
  const faces = [
    [p[0], p[1], b, a],
    [p[1], p[2], b],
    [p[2], p[3], a, b],
    [p[3], p[0], a],
  ];
  for (const polygon of faces) {
    const normal = normalFor(...polygon);
    surface(out, slot, polygon, normal[1] > 0 ? normal : normal.map((v) => -v), color);
  }
}

function merlon(local, x, y, z, width, height, lod) {
  const half = width / 2;
  box(
    local,
    'ashlar',
    [x - half, y, z - half],
    [x + half, y + height, z + half],
    colors.lightStone,
  );
  if (lod < 2) return;
  const tip = [x, y + height + 0.25, z];
  const base = [
    [x - half, y + height, z + half],
    [x + half, y + height, z + half],
    [x + half, y + height, z - half],
    [x - half, y + height, z - half],
  ];
  for (let i = 0; i < base.length; i++) {
    const vertices = [base[i], base[(i + 1) % base.length], tip];
    const n = normalFor(...vertices);
    surface(local, 'ashlar', vertices, n[1] > 0 ? n : n.map((v) => -v), colors.lightStone);
  }
}

function arch(local, x, floor, z, width, height, lod, door) {
  const segments = [4, 8, 12, 22][lod];
  const r = width / 2;
  const spring = floor + height - r;
  const surround = r * 0.27;
  const inset = 0.33;
  const n = [0, 0, 1];
  const point = (theta, radius, depth) => [
    x + radius * Math.cos(theta),
    spring + radius * Math.sin(theta),
    depth,
  ];
  const start = -0.36;
  const stop = Math.PI + 0.36;
  const a = point(start, r, z),
    b = point(stop, r, z);
  quad(
    local,
    door ? 'wood' : 'shade',
    [[b[0], floor, z], [a[0], floor, z], a, b],
    n,
    door ? colors.wood : colors.dark,
  );
  surface(
    local,
    door ? 'wood' : 'shade',
    [a, b, [x, spring, z]],
    n,
    door ? colors.wood : colors.dark,
  );
  for (let i = 0; i < segments; i++) {
    const t0 = mix(start, stop, i / segments);
    const t1 = mix(start, stop, (i + 1) / segments);
    surface(
      local,
      door ? 'wood' : 'shade',
      [[x, spring, z], point(t0, r, z), point(t1, r, z)],
      n,
      door ? colors.wood : colors.dark,
    );
    const color = i % 3 === 1 ? colors.stone : colors.lightStone;
    quad(
      local,
      'ashlar',
      [
        point(t0, r, z + 0.02),
        point(t0, r + surround, z + inset),
        point(t1, r + surround, z + inset),
        point(t1, r, z + 0.02),
      ],
      n,
      color,
    );
    if (lod > 1 && door) {
      quad(
        local,
        'ashlar',
        [
          point(t0, r + surround + 0.06, z + inset),
          point(t0, r + surround + 0.17, z + inset),
          point(t1, r + surround + 0.17, z + inset),
          point(t1, r + surround + 0.06, z + inset),
        ],
        n,
        colors.cutStone,
      );
    }
  }
  for (const p of [a, b]) {
    const sign = Math.sign(p[0] - x);
    const u = p[0] + sign * surround * 0.94;
    const y = p[1] - surround * 0.36;
    quad(
      local,
      'ashlar',
      [
        [p[0], floor, z + 0.02],
        [u, floor, z + inset],
        [u, y, z + inset],
        [p[0], p[1], z + 0.02],
      ],
      n,
      colors.lightStone,
    );
  }
  if (lod > 1 && door) {
    const half = r * 0.94;
    for (let i = 1; i < 12; i++) {
      const u = (i / 6 - 1) * half;
      const hi = spring + Math.sqrt(r * r - u * u) - 0.07;
      box(
        local,
        'shade',
        [x + u - 0.016, floor + 0.05, z + 0.016],
        [x + u + 0.016, hi, z + 0.033],
        colors.dark,
      );
    }
  }
}

const gateAxes = frame(plan.gate.center, plan.gate.normal);

function grandGate(out, lod) {
  const ring = outline(1557576004);
  const y = plan.gate.threshold;
  const roof = y + plan.gate.faceHeightMeters;
  const local = oriented(out, gateAxes);
  const normal = [0, 0, 1];
  const face =
    ring
      .map((p) => gateAxes.local(p))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .reduce((sum, p) => sum + p[1], 0) / 3;
  shell(out, ring, roof, 'stone', colors.stone, { roofSlot: 'paving', roofing: colors.sand });
  box(
    local,
    'ashlar',
    [-6.8, y - 0.55, face - 0.6],
    [6.8, roof + 0.35, face + 0.48],
    colors.lightStone,
  );
  const pane = face + 0.54;
  for (const [u, v] of [
    [-6.8, -5.7],
    [5.7, 6.8],
  ]) {
    box(local, 'ashlar', [u, y - 0.25, pane - 0.4], [v, roof + 0.68, pane + 0.42], colors.stone);
    box(
      local,
      'ashlar',
      [u - 0.07, roof - 1.36, pane - 0.41],
      [v + 0.07, roof - 1.17, pane + 0.48],
      colors.cutStone,
    );
  }
  const archHeight = 7.86;
  arch(local, 0, y, pane + 0.01, 5.73, archHeight, lod, true);
  const bands = [archHeight + 1.13, archHeight + 1.62, archHeight + 2.72, 12.37];
  for (const h of bands)
    box(
      local,
      'ashlar',
      [-5.68, y + h, pane - 0.04],
      [5.68, y + h + 0.17, pane + 0.22],
      colors.cutStone,
    );
  if (lod > 1) {
    // Repeated relief profiles suggest the recessed border and carved spandrels.
    for (const offset of [-1, 1]) {
      const count = lod === 3 ? 13 : 7;
      for (let i = 0; i < count; i++) {
        const hi = 2.1 + (i * 6.76) / count;
        const u = offset * 4.93;
        surface(
          local,
          'ashlar',
          [
            [u, y + hi + 0.28, pane + 0.09],
            [u - 0.22, y + hi, pane + 0.09],
            [u, y + hi - 0.28, pane + 0.09],
            [u + 0.22, y + hi, pane + 0.09],
          ],
          normal,
          colors.cutStone,
        );
      }
      for (let i = 0; i < 3; i++) {
        const u = offset * (4.25 - 0.37 * i),
          hi = y + 7.07 + 0.59 * i;
        surface(
          local,
          'ashlar',
          [
            [u - 0.26, hi, pane + 0.085],
            [u, hi - 0.18, pane + 0.085],
            [u + 0.26, hi, pane + 0.085],
            [u, hi + 0.18, pane + 0.085],
          ],
          normal,
          colors.cutStone,
        );
      }
    }
    const letters = lod === 3 ? 26 : 14;
    for (let i = 0; i < letters; i++) {
      const x = (i / (letters - 1) - 0.5) * 10.5;
      box(
        local,
        'ashlar',
        [x, y + 9.65, pane + 0.02],
        [x + 0.13, y + 10 + (i % 3) * 0.12, pane + 0.065],
        colors.cutStone,
      );
    }
  }
  const count = [3, 7, 16, 25][lod];
  let grade = y;
  for (let i = 0; i < count; i++) {
    const near = face + 0.5 + (i * 29) / count;
    const far = face + 0.5 + ((i + 1) * 29) / count;
    const half = 5.7 + (i / count) * 2.75;
    const samples = [-half, 0, half].flatMap((x) =>
      [near, far].map((z) => {
        const [u, , v] = gateAxes.point(x, 0, z);
        return ground(u, v);
      }),
    );
    const pavement = Math.max(...samples) + 0.06;
    const step = Math.max(pavement, Math.min(y, grade - 3.8 / count));
    box(
      local,
      'paving',
      [-half, Math.min(...samples) - 0.28, near],
      [half, step, far],
      colors.sand,
    );
    grade = step;
  }

  // The low rounded tower meets the wall on the east side of the gate approach.
  const towerCenter = [-38, 57];
  const radius = 4.05;
  const sides = [6, 12, 16, 26][lod];
  const tower = Array.from({ length: sides }, (_, i) => {
    const a = (i * Math.PI * 2) / sides;
    return [towerCenter[0] + radius * Math.cos(a), towerCenter[1] + radius * Math.sin(a)];
  });
  const towerY = top(tower) + 9.6;
  shell(out, tower, towerY, 'stone', colors.stone, { roofSlot: 'paving', roofing: colors.sand });
  if (lod > 0) {
    for (let i = 0; i < tower.length; i++) {
      const edge = oriented(out, edgeFrame(tower, i, 1));
      const len = distance(tower[i], tower[(i + 1) % tower.length]);
      box(
        edge,
        'ashlar',
        [-len / 2, towerY - 0.45, -0.12],
        [len / 2, towerY + 0.12, 0.12],
        colors.lightStone,
      );
      if (i === 2 || i === 4) arch(edge, 0, towerY - 3.2, 0.04, 0.76, 1.23, lod, false);
    }
  }
}

function wallTower(out, pt, normal, width, height, lod, doorway = false) {
  const local = oriented(out, frame(pt, normal));
  const y = ground(...pt);
  const crown = y + height;
  const half = width / 2;
  box(local, 'stone', [-half, y - 2.2, -1.8], [half, crown, 1.75], colors.stone);
  box(
    local,
    'ashlar',
    [-half - 0.11, crown - 0.49, -1.94],
    [half + 0.11, crown - 0.16, 1.87],
    colors.lightStone,
  );
  if (doorway) arch(local, 0, y - 0.15, 1.81, 1.95, 3.36, lod, true);
  if (lod > 0) {
    for (let i = 0; i < 4; i++)
      merlon(local, (i / 3 - 0.5) * (width - 1.0), crown, 1.32, 0.81, 0.73, lod);
    for (const x of [-width * 0.19, width * 0.19])
      arch(local, x, crown - 3.44, 1.79, 0.68, 1.46, lod, false);
  }
}

const houseColors = [colors.white, colors.lime, colors.pearl, colors.white, colors.cream];
const houses = residential.map(({ id, outline, properties }) => {
  const rand = seed(Number(id.slice(4)));
  const level =
    Number(properties['building:levels']) || 1 + (rand % 9 > 1 ? 1 : 0) + (rand % 9 > 6 ? 1 : 0);
  return {
    ring: outline,
    center: center(outline),
    roof: top(outline) + 0.45 + 2.56 * level,
    color: houseColors[rand % houseColors.length],
    rand,
  };
});

function mergedHouses(size) {
  const groups = new Map();
  for (const house of houses) {
    const key = house.center.map((value) => Math.floor(value / size)).join(':');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(house);
  }
  return [...groups.values()].map((group) => {
    const vertices = group.flatMap(({ ring }) => ring);
    const [x, z] = [0, 1].map((i) => Math.min(...vertices.map((p) => p[i])));
    const [u, v] = [0, 1].map((i) => Math.max(...vertices.map((p) => p[i])));
    return {
      ring: [
        [x, z],
        [u, z],
        [u, v],
        [x, v],
      ],
      roof: Math.max(
        top([
          [x, z],
          [u, z],
          [u, v],
          [x, v],
        ]) + 2.6,
        group.reduce((sum, house) => sum + house.roof, 0) / group.length,
      ),
      color: group[0].color,
    };
  });
}

function housing(out, lod) {
  if (lod < 2) {
    for (const { ring, roof, color } of mergedHouses(lod === 0 ? 43 : 19))
      shell(out, ring, roof, 'lime', color);
    return;
  }
  for (const { ring, roof, color, rand } of houses) {
    shell(out, ring, roof, 'lime', color, { roofing: rand % 7 === 0 ? colors.cream : color });
    const sign = Math.sign(area(ring));
    const edges = ring
      .map((p, i) => [i, distance(p, ring[(i + 1) % ring.length])])
      .sort((a, b) => b[1] - a[1])
      .slice(0, lod === 3 ? 3 : 1);
    for (const [i, len] of edges) {
      if (len < 2.1) continue;
      const local = oriented(out, edgeFrame(ring, i, sign));
      if (lod === 3 || rand % 3 === 0)
        box(
          local,
          'lime',
          [-len / 2 + 0.035, roof - 0.03, -0.17],
          [len / 2 - 0.035, roof + 0.38, -0.015],
          color,
        );
      if (lod === 2 && rand % 4 !== 0) continue;
      const count = Math.min(6, Math.floor(len / 2.25));
      for (let j = 0; j < count; j++) {
        const u = len * ((j + 0.5) / count - 0.5);
        const [x, , z] = edgeFrame(ring, i, sign).point(u, 0, 0);
        const base = ground(x, z);
        const lower = roof - 2.25;
        if (lower < base + 0.39) continue;
        facePanel(local, 'shade', u - 0.4, lower, 0.021, 0.8, 0.86, colors.dark);
        if (lod === 3 && rand % 6 === 0 && lower > base + 3.1)
          facePanel(local, 'lime', u - 0.46, base + 0.05, 0.024, 0.92, 1.94, colors.blue);
      }
    }
  }
}

function facePanel(out, slot, x, y, z, width, height, color) {
  surface(
    out,
    slot,
    [
      [x, y, z],
      [x + width, y, z],
      [x + width, y + height, z],
      [x, y + height, z],
    ],
    [0, 0, 1],
    color,
  );
}

function mosque(out, lod) {
  const ring = outline(283167030);
  const hole = outline(1323548942);
  const y = top(ring) + 4.8;
  shell(out, ring, y, 'lime', colors.white, { holes: [hole], roofing: colors.cream });
  const xz = plan.minaret.center;
  const half = plan.minaret.shaftWidthMeters / 2;
  const base = ground(...xz);
  const upper = base + plan.minaret.heightMeters;
  const local = oriented(out, frame(xz, [0.905, 0.425]));
  box(local, 'ashlar', [-half, base - 0.6, -half], [half, upper - 2.35, half], colors.stone);
  box(
    local,
    'ashlar',
    [-half - 0.22, upper - 2.52, -half - 0.22],
    [half + 0.22, upper - 1.96, half + 0.22],
    colors.lightStone,
  );
  box(local, 'ashlar', [-0.79, upper - 1.96, -0.79], [0.79, upper - 0.06, 0.79], colors.stone);
  hipped(local, 'tile', 0, 0, upper - 0.06, 1.82, 1.79, 0.53, colors.green);
  if (lod < 2) return;
  for (const [a, b] of [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ]) {
    const side = oriented(local, frame([0, 0], [a, b]));
    arch(side, 0, upper - 5.45, half + 0.05, 0.84, 1.66, lod, false);
    facePanel(side, 'ashlar', -0.63, upper - 7.25, half + 0.04, 1.26, 0.2, colors.cutStone);
  }
}

function palace(out, lod) {
  const ring = lod === 0 ? simplify(mapped.get(283167034), 2.3).slice(0, -1) : outline(283167034);
  const roof = top(ring) + 5.1;
  const [x, z] = center(ring);
  shell(out, ring, roof, 'stone', colors.stone, { roofSlot: 'paving', roofing: colors.roof });
  if (lod === 0) return;
  const local = oriented(out, frame([x, z], [0.8, 0.6]));
  hipped(local, 'tile', -4.6, -2.8, roof, 9.1, 6.1, 2.22, colors.green);
  hipped(local, 'tile', 5.2, 3.1, roof, 7.7, 4.3, 1.53, colors.green);
  const sign = Math.sign(area(ring));
  for (let i = 0; i < ring.length; i++) {
    const len = distance(ring[i], ring[(i + 1) % ring.length]);
    if (len < 3.3) continue;
    const façade = oriented(out, edgeFrame(ring, i, sign));
    box(
      façade,
      'ashlar',
      [-len / 2, roof - 0.29, -0.19],
      [len / 2, roof + 0.12, 0.08],
      colors.lightStone,
    );
    if (lod > 1) arch(façade, 0, roof - 3.28, 0.045, 0.95, 1.3, lod, false);
  }
}

function garden(out, lod) {
  if (lod === 0) return;
  for (const [i, { ring }] of gardenMap.beds.entries()) {
    const height = ([x, z]) => ground(x, z) + (lod === 1 ? 0.16 : 0.44 + (i % 3) * 0.11);
    const color = i % 4 === 0 ? colors.lowHedge : colors.myrtle;
    cap(out, 'shade', ring, height, color);
    if (lod === 1) continue;
    const sign = Math.sign(area(ring));
    for (let j = 0; j < ring.length; j++) {
      const a = ring[j];
      const b = ring[(j + 1) % ring.length];
      if (distance(a, b) < 0.06) continue;
      sloped(
        out,
        'shade',
        [
          [a[0], ground(...a) - 0.15, a[1]],
          [b[0], ground(...b) - 0.15, b[1]],
          [b[0], height(b), b[1]],
          [a[0], height(a), a[1]],
        ],
        [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
        color,
      );
    }
  }
  if (lod < 2) return;
  for (const [i, { point }] of gardenMap.fountains.entries()) {
    const radius = i === 0 ? 1.38 : 1.05;
    const sides = lod === 3 ? 12 : 8;
    const ring = Array.from({ length: sides }, (_, j) => {
      const angle = (j * Math.PI * 2) / sides;
      return [point[0] + radius * Math.cos(angle), point[1] + radius * Math.sin(angle)];
    });
    const h = top(ring) + 0.34;
    shell(out, ring, h, 'ashlar', colors.lightStone);
    cap(
      out,
      'shade',
      ring.map(([x, z]) => [mix(point[0], x, 0.79), mix(point[1], z, 0.79)]),
      h + 0.011,
      colors.fountain,
    );
  }
}

function draw(out, lod) {
  rampart(out, mapped.get(283350005), { height: 8.45, width: 2.5, closed: true, gate: true }, lod);
  rampart(out, mapped.get(283350002), { height: 6.15, width: 2.2 }, lod);
  if (lod > 0) rampart(out, mapped.get(1497354952), { height: 3.8, width: 1.45 }, lod);
  for (const [id, height] of [
    [283167031, 7.8],
    [1557576007, 7.8],
    [1557576002, 7.15],
    [1277795404, 7.3],
    [277429195, 7.75],
  ])
    bastion(out, id, height, lod);
  grandGate(out, lod);
  wallTower(out, [-21.9, 73.5], [-0.72, 0.69], 5.05, 12.8, lod);
  wallTower(out, [-7.92, 101.5], [-0.8, 0.59], 6.35, 12.4, lod, true);
  housing(out, lod);
  mosque(out, lod);
  palace(out, lod);
  garden(out, lod);
}

export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [342, 103, -116];
const lookAt = [0, -3, -28];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe: slug + '-model.mjs',
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
    'The Kasbah of the Udayas above the Bou Regreg with Bab Oudaia, the Almohad ramparts, the white-roofed residential quarter, Jami al-Atiq and the Andalusian garden wall.',
  camera,
  lookAt,
  sunDirection: [185, 177, 123],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1,
    cameraYaw: -0.32,
    focus: { center: lookAt },
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    {
      name: 'bab-oudaia-carved-sandstone-and-steps',
      position: [-25, 8, 103],
      lookAt: [-55, 4, 46],
    },
    { name: 'white-roofs-and-minaret', position: [173, 47, -66], lookAt: [13, 1, -84] },
    { name: 'borj-khanzira-bou-regreg', position: [128, 22, -297], lookAt: [37, -10, -193] },
    { name: 'andalusian-garden-and-museum', position: [137, 36, 226], lookAt: [50, -9, 131] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: slug + '-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 13.5,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 7.1, surfaces },
      street: { export: 'street', errorMeters: 0.81, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.25, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Independent geographic reconstruction with public-domain and CC0 photographs, ODbL footprints and unchanged Terrarium elevation samples.',
};
