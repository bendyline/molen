/** Original Montevideo exterior: measured envelope, independently authored architectural detail. */
import { readFileSync } from 'node:fs';
import { beam, loft, normalFor, radialRing, torus } from './authored-structure-mesh.mjs';
import { hashEvidenceText } from './evidence-text-hash.mjs';
import { box, quad, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const frameBytes = readFileSync(structureSourcePath('n0619_montevideo', 'map-frame.json'));
const frame = JSON.parse(frameBytes);
const survey = JSON.parse(
  readFileSync(structureSourcePath('n0619_montevideo', 'roof-envelope.json')),
);
const height = (id) => {
  const h = survey.roofs.find((roof) => roof.id === id).height;
  return (h[0] + h[1]) / 2;
};
const transfer = height(355),
  northTerrace = height(322),
  wingRoof = height(339);
const linkRoof = height(361),
  terraceRoof = height(360);
const brick = [0.43, 0.12, 0.055],
  pale = [0.79, 0.81, 0.78];
const dark = [0.105, 0.135, 0.14],
  metal = [0.39, 0.44, 0.45],
  glass = [0.22, 0.36, 0.405];
const silver = [0.69, 0.73, 0.73],
  roof = [0.33, 0.35, 0.34];
const sequence = (lo, hi, count) =>
  Array.from({ length: count + 1 }, (_, i) => lo + ((hi - lo) * i) / count);
const lowerFloors = sequence(8.02, transfer, 26),
  upperFloors = sequence(transfer, 136.65, 15);
const lowFloors = sequence(8.02, wingRoof, 10);
const noise = (i) => {
  let n = Math.imul(i + 197, 374761393);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};
const tint = (color, i, amount = 0.035) => color.map((v) => v + (noise(i) - 0.5) * amount);
const face = (out, slot, points, color) => quad(out, slot, points, normalFor(...points), color);

/** Local +Z faces outward. Edges run clockwise around the plan in X/Z coordinates. */
function edge(out, a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / length,
    uz = (b[1] - a[1]) / length;
  const vector = ([x, y, z]) => [ux * x - uz * z, y, uz * x + ux * z];
  const point = (p) => {
    const q = vector(p);
    return [q[0] + a[0], q[1], q[2] + a[1]];
  };
  return {
    length,
    addQuad: (slot, ref, p, n, uv, color) =>
      out.addQuad(slot, ref, p.map(point), vector(n), uv, color),
    addTriangle: (slot, ref, p, n, uv, color) =>
      out.addTriangle(slot, ref, p.map(point), vector(n), uv, color),
    addConvexPolygon: (slot, ref, p, n, uv, color) =>
      out.addConvexPolygon(slot, ref, p.map(point), vector(n), uv, color),
  };
}

function panel(o, slot, x0, x1, y0, y1, color, z = 0, thickness = 0.19) {
  if (x1 - x0 < 0.015 || y1 - y0 < 0.015) return;
  const b = Math.min(0.009, (x1 - x0) / 5, (y1 - y0) / 5);
  const ring = (inset, depth) => [
    [x0 + inset, y0 + inset, depth],
    [x1 - inset, y0 + inset, depth],
    [x1 - inset, y1 - inset, depth],
    [x0 + inset, y1 - inset, depth],
  ];
  const p = ring(b, z),
    e = ring(0, z - b),
    back = ring(0, z - thickness);
  face(o, slot, p, color);
  for (let i = 0; i < 4; i++) {
    const k = (i + 1) % 4;
    face(o, slot, [e[i], e[k], p[k], p[i]], color);
    face(o, slot, [back[i], back[k], e[k], e[i]], color);
  }
}
function pane(o, x0, x1, y0, y1, z, serial, clear = false) {
  face(
    o,
    clear ? 'clear_glass' : 'glass',
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    clear ? [0.66, 0.76, 0.77] : tint(glass, serial, 0.09),
  );
  for (const x of [x0, x1])
    box(o, 'metal', [x - 0.027, y0, z - 0.035], [x + 0.027, y1, z + 0.045], metal);
  for (const y of [y0, y1])
    box(o, 'metal', [x0, y - 0.029, z - 0.035], [x1, y + 0.029, z + 0.045], metal);
}
function glazing(o, x0, x1, y0, y1, z, serial, width = 1.15, clear = false) {
  const count = Math.max(1, Math.round((x1 - x0) / width));
  for (let i = 0; i < count; i++)
    pane(
      o,
      x0 + ((x1 - x0) * i) / count,
      x0 + ((x1 - x0) * (i + 1)) / count,
      y0,
      y1,
      z,
      serial + i,
      clear,
    );
}
function windowCell(o, x0, x1, y0, y1, serial, kind, variant = 0) {
  const slot = kind === 'brick' ? 'brick' : 'concrete',
    color = kind === 'brick' ? brick : pale;
  const width = x1 - x0,
    left = x0 + width * (variant === 1 ? 0.13 : 0.22),
    right = x1 - width * (variant === 2 ? 0.31 : 0.14);
  const sill = y0 + (variant === 3 ? 0.28 : 0.64),
    lintel = y1 - 0.36;
  const joint = kind === 'brick' ? 0.002 : 0.014;
  // Recessed joint backing prevents a sightline through the hollow exterior shell.
  for (const [a, b, c, d] of [
    [x0 - 0.02, x1 + 0.02, y0 - 0.02, y0 + 0.04],
    [x0 - 0.02, x1 + 0.02, y1 - 0.04, y1 + 0.02],
    [x0 - 0.02, x0 + 0.04, y0, y1],
    [x1 - 0.04, x1 + 0.02, y0, y1],
  ])
    face(
      o,
      'recess',
      [
        [a, c, -0.205],
        [b, c, -0.205],
        [b, d, -0.205],
        [a, d, -0.205],
      ],
      dark,
    );
  panel(o, slot, x0 + joint, left, y0 + joint, y1 - joint, tint(color, serial));
  panel(o, slot, right, x1 - joint, y0 + joint, y1 - joint, tint(color, serial + 1));
  panel(o, slot, left, right, y0 + joint, sill, tint(color, serial + 2));
  panel(o, slot, left, right, lintel, y1 - joint, tint(color, serial + 3));
  // Four independent reveal surfaces join the recessed glass; there is no wall behind it.
  const front = [
    [left, sill, 0],
    [right, sill, 0],
    [right, lintel, 0],
    [left, lintel, 0],
  ];
  const back = front.map(([x, y]) => [x, y, -0.23]);
  for (let i = 0; i < 4; i++) {
    const k = (i + 1) % 4;
    face(o, slot, [front[k], front[i], back[i], back[k]], color);
  }
  glazing(o, left + 0.025, right - 0.025, sill + 0.035, lintel - 0.025, -0.24, serial, 0.9);
  box(o, 'metal', [left - 0.04, sill - 0.055, -0.27], [right + 0.04, sill, 0.085], silver);
  if (variant === 3) {
    box(o, 'metal', [left, lintel - 0.5, -0.29], [right, lintel - 0.45, -0.19], metal);
    box(
      o,
      'metal',
      [right - 0.12, sill + 0.55, -0.17],
      [right - 0.095, sill + 0.72, -0.13],
      silver,
    );
  }
}
function windowField(o, x0, x1, floors, count, kind, serial = 0) {
  for (let row = 0; row < floors.length - 1; row++)
    for (let col = 0; col < count; col++) {
      windowCell(
        o,
        x0 + ((x1 - x0) * col) / count,
        x0 + ((x1 - x0) * (col + 1)) / count,
        floors[row],
        floors[row + 1],
        serial + row * 83 + col,
        kind,
        (row + col * 2) % 4,
      );
    }
}
function circularCell(o, x0, x1, y0, y1, serial) {
  const cx = (x0 + x1) / 2,
    cy = (y0 + y1) / 2,
    r = Math.min(0.71, (x1 - x0) * 0.38, (y1 - y0) * 0.32),
    outer = r + 0.1;
  panel(o, 'concrete', x0, cx - outer, y0, y1, pale);
  panel(o, 'concrete', cx + outer, x1, y0, y1, pale);
  panel(o, 'concrete', cx - outer, cx + outer, y0, cy - outer, pale);
  panel(o, 'concrete', cx - outer, cx + outer, cy + outer, y1, pale);
  for (let i = 0; i < 64; i++) {
    const angle = (k) => (k * Math.PI * 2) / 64;
    const ring = (k, radius, z, square = false) => {
      const a = angle(k),
        c = Math.cos(a),
        s = Math.sin(a),
        t = square ? outer / Math.max(Math.abs(c), Math.abs(s)) : radius;
      return [cx + c * t, cy + s * t, z];
    };
    const a = ring(i, r, 0),
      b = ring(i + 1, r, 0),
      c = ring(i + 1, outer, 0, true),
      d = ring(i, outer, 0, true);
    face(o, 'concrete', [a, d, c, b], pale);
    face(o, 'metal', [ring(i, r, -0.21), a, b, ring(i + 1, r, -0.21)], silver);
    const p = [[cx, cy, -0.23], ring(i, r, -0.23), ring(i + 1, r, -0.23)];
    o.addTriangle(
      'glass',
      'palette:#ffffff',
      p,
      [0, 0, 1],
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      tint(glass, serial),
    );
  }
}
function loggias(o, width, floors, serial = 0, border = 'brick') {
  const color = border === 'brick' ? brick : pale,
    slot = border === 'brick' ? 'brick' : 'concrete';
  panel(o, slot, 0, 0.78, floors[0], floors.at(-1) + 0.9, color);
  panel(o, slot, width - 0.78, width, floors[0], floors.at(-1) + 0.9, color);
  panel(o, slot, 0.78, width - 0.78, floors.at(-1), floors.at(-1) + 0.9, color);
  for (let row = 0; row < floors.length - 1; row++) {
    const y0 = floors[row],
      y1 = floors[row + 1];
    box(o, 'concrete', [0.78, y0, -1.75], [width - 0.78, y0 + 0.16, 0.02], pale);
    glazing(o, 0.88, width - 0.88, y0 + 0.2, y1 - 0.19, -1.64, serial + row * 101, 1.05);
    // Openable outer glazing and rail leave a readable depth between the two skins.
    glazing(o, 0.85, width - 0.85, y0 + 0.21, y1 - 0.21, -0.11, serial + row * 101, 1.38, true);
    for (const x of [0.79, width - 0.79])
      box(o, slot, [x - 0.045, y0, -1.75], [x + 0.045, y1, 0], color);
    tube(
      o,
      'stainless',
      [0.84, y0 + 1.12, -0.075],
      [width - 0.84, y0 + 1.12, -0.075],
      0.027,
      silver,
      8,
    );
    for (let i = 1; i < Math.floor(width / 3.8); i++) {
      const x = 0.82 + ((width - 1.64) * i) / Math.floor(width / 3.8);
      box(o, 'metal', [x - 0.025, y0 + 0.18, -1.7], [x + 0.025, y0 + 1.17, -0.08], metal);
    }
  }
}
function ribbon(o, width, floors, serial = 0, slot = 'brick') {
  const color = slot === 'brick' ? brick : pale;
  for (let row = 0; row < floors.length - 1; row++) {
    const a = floors[row],
      b = floors[row + 1],
      split = width / (row % 2 ? 7 : 6);
    panel(o, slot, 0, width, a, a + 0.62, color);
    panel(o, slot, 0, width, b - 0.35, b, color);
    const bays = Math.round(width / split);
    for (let col = 0; col < bays; col++) {
      const x0 = (width * col) / bays,
        x1 = (width * (col + 1)) / bays;
      const solid = (row + 2 * col) % 7 === 0;
      if (solid) panel(o, slot, x0, x1, a + 0.62, b - 0.35, tint(color, col + row * 7));
      else
        glazing(o, x0 + 0.08, x1 - 0.08, a + 0.64, b - 0.37, -0.2, serial + row * 91 + col, 0.97);
      box(o, slot, [x0, a + 0.62, -0.23], [x0 + 0.09, b - 0.35, 0], color);
    }
  }
}
function terraceRail(out, a, b, y, color = silver) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = Math.max(1, Math.ceil(length / 1.3));
  for (let i = 0; i <= n; i++) {
    const x = a[0] + ((b[0] - a[0]) * i) / n,
      z = a[1] + ((b[1] - a[1]) * i) / n;
    tube(out, 'metal', [x, y, z], [x, y + 1.1, z], 0.025, color, 8);
  }
  for (const h of [0.3, 1.08])
    tube(out, 'metal', [a[0], y + h, a[1]], [b[0], y + h, b[1]], 0.028, color, 8);
}
function slab(out, x0, x1, z0, z1, y) {
  box(out, 'concrete', [x0, y - 0.22, z0], [x1, y, z1], roof);
}
function tower(out) {
  // Podium walls retain the measured western bay and southern glazed projection.
  let o = edge(out, [-43.9, 5.55], [-30.05, 5.55]);
  windowField(o, 0, o.length, lowerFloors, 5, 'brick', 100);
  o = edge(out, [-30.05, 7.74], [-15.4, 7.74]);
  loggias(o, o.length, lowerFloors, 2000);
  o = edge(out, [-30.05, 5.55], [-30.05, 7.74]);
  windowField(o, 0, o.length, lowerFloors, 1, 'brick', 3100);
  o = edge(out, [-15.4, 7.74], [-15.4, -21.9]);
  windowField(o, 0, o.length, lowerFloors, 10, 'brick', 4100);
  o = edge(out, [-15.4, -21.9], [-30.95, -21.9]);
  windowField(o, 0, o.length, lowerFloors, 5, 'brick', 5200);
  o = edge(out, [-30.95, -21.9], [-43.9, -21.9]);
  windowField(o, 0, o.length, sequence(8.02, northTerrace, 20), 5, 'brick', 6100);
  o = edge(out, [-43.9, -21.9], [-43.9, -17.9]);
  windowField(o, 0, o.length, sequence(8.02, northTerrace, 20), 2, 'pale', 7000);
  o = edge(out, [-43.9, -17.9], [-46, -17.9]);
  windowField(o, 0, o.length, lowerFloors, 1, 'pale', 7100);
  o = edge(out, [-46, -17.9], [-46, -1.25]);
  for (let row = 0; row < 26; row++) {
    const y0 = lowerFloors[row],
      y1 = lowerFloors[row + 1];
    const circleX = row % 2 === 0 ? 11.5 : 7.4;
    windowField(
      o,
      0,
      circleX - 1.25,
      [y0, y1],
      Math.max(2, Math.round((circleX - 1.25) / 2.1)),
      'pale',
      8000 + row * 21,
    );
    circularCell(o, circleX - 1.25, circleX + 1.25, y0, y1, 9000 + row);
    windowField(o, circleX + 1.25, o.length, [y0, y1], 2, 'pale', 9100 + row * 13);
  }
  o = edge(out, [-46, -1.25], [-43.9, -1.25]);
  windowField(o, 0, o.length, lowerFloors, 1, 'brick', 10100);
  o = edge(out, [-43.9, -1.25], [-43.9, 5.55]);
  windowField(o, 0, o.length, lowerFloors, 2, 'brick', 11000);
  o = edge(out, [-30.95, -17.6], [-43.9, -17.6]);
  windowField(o, 0, o.length, sequence(northTerrace, transfer, 5), 5, 'pale', 12100);
  o = edge(out, [-30.95, -21.9], [-30.95, -17.6]);
  windowField(o, 0, o.length, sequence(northTerrace, transfer, 5), 2, 'pale', 13000);
  slab(out, -43.9, -30.95, -21.9, -17.6, northTerrace);
  terraceRail(out, [-43.7, -21.65], [-31.1, -21.65], northTerrace);
  slab(out, -43.9, -15.4, -17.9, 5.55, transfer);
  slab(out, -30.05, -15.4, 5.55, 7.74, transfer);
  slab(out, -46, -43.9, -17.9, -1.25, transfer);
  // Upper fifteen levels shift and recess independently of the concrete-zone outline.
  o = edge(out, [-46, -9.7], [-46, 7.2]);
  loggias(o, o.length, upperFloors, 14000);
  panel(o, 'brick', 0, o.length, 137.55, 139.5, brick);
  o = edge(out, [-46, 7.2], [-30.05, 7.2]);
  windowField(o, 0, o.length, upperFloors, 6, 'brick', 16000);
  panel(o, 'brick', 0, o.length, 136.65, 139.5, brick);
  o = edge(out, [-30.05, 7.2], [-30.05, 5.55]);
  windowField(o, 0, o.length, upperFloors, 1, 'brick', 17200);
  o = edge(out, [-30.05, 5.55], [-18, 5.55]);
  windowField(o, 0, o.length, upperFloors, 4, 'pale', 18100);
  o = edge(out, [-18, 5.55], [-18, -17.6]);
  windowField(o, 0, o.length, upperFloors, 8, 'pale', 19300);
  o = edge(out, [-18, -17.6], [-43.9, -17.6]);
  windowField(o, 0, o.length, upperFloors, 9, 'pale', 20200);
  o = edge(out, [-43.9, -17.6], [-43.9, -9.7]);
  windowField(o, 0, o.length, upperFloors, 3, 'pale', 21400);
  o = edge(out, [-43.9, -9.7], [-46, -9.7]);
  windowField(o, 0, o.length, upperFloors, 1, 'pale', 22500);
  slab(out, -43.9, -18, -17.6, 5.55, 136.65);
  slab(out, -46, -30.05, -9.7, 7.2, 139.5);
  for (const [a, b] of [
    [
      [-30.05, -9.7],
      [-46, -9.7],
    ],
    [
      [-30.05, 7.2],
      [-30.05, -9.7],
    ],
  ]) {
    const cap = edge(out, a, b);
    panel(cap, 'brick', 0, cap.length, 136.65, 139.5, brick);
  }
  // Recessed roof services and perimeter parapets follow the separate pale/brick caps.
  box(out, 'metal', [-40, 136.65, -14.2], [-21.5, 137.4, -11.6], silver);
  for (let x = -39.8; x < -21.5; x += 0.22)
    box(out, 'recess', [x, 136.73, -14.26], [x + 0.07, 137.28, -14.2], dark);
  for (const [a, b] of [
    [
      [-43.8, -17.5],
      [-18.1, -17.5],
    ],
    [
      [-18.1, -17.5],
      [-18.1, 5.4],
    ],
    [
      [-18.1, 5.4],
      [-29.9, 5.4],
    ],
  ])
    terraceRail(out, a, b, 136.65);
  for (const [a, b] of [
    [
      [-15.55, 7.5],
      [-15.55, -21.7],
    ],
    [
      [-15.55, -21.7],
      [-30.7, -21.7],
    ],
  ])
    terraceRail(out, a, b, transfer);
}

function lowBlock(out) {
  const connectingFloors = [8.02, 11.3, 14.85, 18.7, 22.1, 25.4, linkRoof];
  let o = edge(out, [-15.4, -3.3], [23.45, -3.3]);
  ribbon(o, o.length, connectingFloors, 24000);
  o = edge(out, [23.45, -21.45], [-15.4, -21.45]);
  ribbon(o, o.length, connectingFloors, 24800);
  slab(out, -15.4, 23.45, -21.45, -3.3, linkRoof);
  o = edge(out, [-15.4, 5.55], [22.77, 5.55]);
  ribbon(o, o.length, [8.02, 11.3, terraceRoof], 25600);
  slab(out, -15.4, 22.77, -3.3, 5.55, terraceRoof);
  terraceRail(out, [-15.2, 5.35], [22.5, 5.35], terraceRoof);
  terraceRail(out, [-15.2, -21.2], [23.1, -21.2], linkRoof);
  // Large side wing: glazed southern end, rhythmic brick strips on its two long sides.
  o = edge(out, [22.77, 21.94], [45.94, 21.94]);
  loggias(o, o.length, lowFloors, 26600);
  o = edge(out, [45.94, 21.94], [45.94, -21.9]);
  ribbon(o, o.length, lowFloors, 28000);
  o = edge(out, [45.94, -21.9], [23.45, -21.9]);
  windowField(o, 0, o.length, lowFloors, 7, 'brick', 30000);
  o = edge(out, [23.45, -21.9], [23.45, 5.55]);
  ribbon(o, o.length, lowFloors, 31300);
  o = edge(out, [22.77, 5.55], [22.77, 21.94]);
  ribbon(o, o.length, lowFloors, 32700);
  slab(out, 23.45, 45.94, -21.9, 21.94, wingRoof);
  slab(out, 22.77, 23.45, 5.55, 21.94, wingRoof);
  o = edge(out, [23.45, 5.55], [22.77, 5.55]);
  panel(o, 'brick', 0, o.length, 8.02, wingRoof, brick);
  box(out, 'brick', [22.77, 7.76, 5.55], [45.94, 8.02, 21.94], brick);
  // Individually jointed soffit and broad diaphragm beams under the unsupported end.
  for (let x = 23; x < 45.7; x += 1.85)
    for (let z = 6.3; z < 21.6; z += 1.6)
      box(
        out,
        'concrete',
        [x, 7.67, z],
        [Math.min(x + 1.82, 45.75), 7.74, Math.min(z + 1.57, 21.75)],
        tint(pale, Math.round(x * 37 + z)),
      );
  for (const x of [24.2, 30.65, 37.1, 43.55]) {
    beam(out, 'metal', [x, 0.32, 7.5], [x, 7.58, 14.4], 0.6, 0.6, pale);
    box(out, 'metal', [x - 0.48, 0, 7.05], [x + 0.48, 0.18, 7.95], silver);
    box(out, 'metal', [x - 0.47, 7.49, 13.99], [x + 0.47, 7.67, 14.86], pale);
    for (const dx of [-0.32, 0.32])
      for (const dz of [-0.3, 0.3])
        tube(
          out,
          'stainless',
          [x + dx, 0.18, 7.5 + dz],
          [x + dx, 0.25, 7.5 + dz],
          0.045,
          silver,
          8,
        );
  }
  // Roof volumes are separated from the large terrace and terminate at their own levels.
  for (const [x0, x1, z0, z1, top] of [
    [28.8, 40.6, -7.6, 12.3, 40.5],
    [28.8, 40.2, -17.5, -7.6, 42.6],
  ]) {
    const floors = [wingRoof, top];
    for (const [a, b] of [
      [
        [x0, z1],
        [x1, z1],
      ],
      [
        [x1, z1],
        [x1, z0],
      ],
      [
        [x1, z0],
        [x0, z0],
      ],
      [
        [x0, z0],
        [x0, z1],
      ],
    ]) {
      const side = edge(out, a, b);
      ribbon(side, side.length, floors, 34000, 'concrete');
    }
    slab(out, x0, x1, z0, z1, top);
  }
  for (const [a, b] of [
    [
      [23.1, 21.6],
      [45.6, 21.6],
    ],
    [
      [45.6, 21.6],
      [45.6, -21.55],
    ],
    [
      [45.6, -21.55],
      [23.8, -21.55],
    ],
  ])
    terraceRail(out, a, b, wingRoof);
  for (const x of [-6, 1, 8]) {
    box(out, 'metal', [x, linkRoof, -13], [x + 3.8, linkRoof + 0.75, -10.7], silver);
    for (let k = 0; k < 14; k++)
      box(
        out,
        'recess',
        [x + 0.14 + k * 0.25, linkRoof + 0.08, -13.03],
        [x + 0.21 + k * 0.25, linkRoof + 0.64, -12.99],
        dark,
      );
  }
  // Proportional reconstruction of the rooftop tank sculpture, independently from building mass.
  const cx = 37.4,
    cz = -12.4,
    base = 42.6,
    tankBottom = 46.2,
    r = 1.3;
  for (const dx of [-0.85, 0.85])
    for (const dz of [-0.85, 0.85])
      beam(
        out,
        'metal',
        [cx + dx, base, cz + dz],
        [cx + dx * 0.8, tankBottom, cz + dz * 0.8],
        0.14,
        0.14,
        metal,
      );
  for (const dz of [-0.85, 0.85]) {
    beam(
      out,
      'metal',
      [cx - 0.85, base, cz + dz],
      [cx + 0.68, tankBottom, cz + dz * 0.8],
      0.055,
      0.055,
      metal,
    );
    beam(
      out,
      'metal',
      [cx + 0.85, base, cz + dz],
      [cx - 0.68, tankBottom, cz + dz * 0.8],
      0.055,
      0.055,
      metal,
    );
  }
  loft(
    out,
    'metal',
    [radialRing(tankBottom, r, r, 64, [cx, cz]), radialRing(48.6, r, r, 64, [cx, cz])],
    silver,
  );
  loft(
    out,
    'metal',
    [radialRing(48.6, 1.4, 1.4, 64, [cx, cz]), radialRing(49.2, 0.07, 0.07, 64, [cx, cz])],
    metal,
  );
  for (const y of [tankBottom + 0.15, 47.35, 48.5])
    torus(out, 'metal', [cx, y, cz], r + 0.018, 0.022, metal, 64, 8);
  for (let i = 0; i < 32; i++) {
    const a = (i * Math.PI) / 16;
    tube(
      out,
      'metal',
      [cx + r * Math.cos(a), tankBottom, cz + r * Math.sin(a)],
      [cx + r * Math.cos(a), 48.6, cz + r * Math.sin(a)],
      0.012,
      metal,
      6,
    );
  }
}
function ground(out) {
  const fronts = [
    [
      [-43.9, 5.55],
      [-15.4, 5.55],
    ],
    [
      [-15.4, 5.55],
      [22.77, 5.55],
    ],
    [
      [45.94, 5.55],
      [45.94, -21.9],
    ],
    [
      [45.94, -21.9],
      [-43.9, -21.9],
    ],
    [
      [-43.9, -21.9],
      [-43.9, 5.55],
    ],
    [
      [23.45, -21.9],
      [23.45, 5.55],
    ],
  ];
  for (const [index, [a, b]] of fronts.entries()) {
    const o = edge(out, a, b),
      n = Math.max(2, Math.round(o.length / 3.3));
    for (const [y0, y1] of [
      [0.17, 4.18],
      [4.35, 7.71],
    ])
      glazing(o, 0.12, o.length - 0.12, y0, y1, -0.24, index * 31 + y0, 1.25, true);
    for (const y of [0, 4.18, 7.71])
      box(o, 'metal', [0, y, -0.45], [o.length, y + 0.16, 0.06], silver);
    for (let i = 0; i <= n; i++) {
      const x = Math.max(0.3, Math.min(o.length - 0.3, (o.length * i) / n));
      box(o, 'metal', [x - 0.23, 0, -0.4], [x + 0.23, 7.7, 0.04], pale);
    }
    // Interior backdrop, set well behind transparent entry glazing.
    box(o, 'recess', [0.35, 0.14, -3.2], [o.length - 0.35, 7.7, -3.05], dark);
  }
  slab(out, -43.9, -15.4, -21.9, 5.55, 8.02);
  slab(out, -15.4, 23.45, -21.45, 5.55, 8.02);
  slab(out, 23.45, 45.94, -21.9, 5.55, 8.02);
  // Tower entry framing and accessible thresholds are confined to its own footprint.
  const o = edge(out, [-43.9, 5.55], [-15.4, 5.55]);
  for (const x of [5.6, 7.2, 18.4, 20]) {
    pane(o, x, x + 1.42, 0.1, 3.18, -0.04, 36000 + Math.round(x), true);
    tube(o, 'stainless', [x + 1.17, 0.9, 0.07], [x + 1.17, 1.58, 0.07], 0.019, silver, 10);
  }
  box(o, 'metal', [3.8, 3.35, -0.2], [10.3, 3.55, 1.65], silver);
  for (const x of [0.45, 9.65, 19.05, 27.8])
    beam(o, 'metal', [x, 0.16, -0.32], [Math.min(x + 2.5, 28.1), 7.7, -0.32], 0.6, 0.6, pale);
}

function crown(out) {
  const cx = -34,
    cz = -2.1,
    base = 144.317,
    top = 152.317;
  // Central weather-vane pivot and its open supporting gantry.
  tube(out, 'metal', [cx, 139.5, cz], [cx, base + 0.1, cz], 0.31, metal, 40);
  for (const y of [140, 142.35, 144.06])
    torus(out, 'stainless', [cx, y, cz], 0.48, 0.055, silver, 48, 8);
  for (const x of [-2.3, 2.3])
    beam(out, 'metal', [cx + x, 139.5, cz], [cx, 143.9, cz], 0.15, 0.15, silver);
  box(out, 'metal', [cx - 4.55, base - 0.3, cz - 0.8], [cx + 4.55, base, cz + 0.8], silver);
  // An M assembled from open ribbons: front/back chords and alternating diagonals.
  const ribbonBeam = (a, b) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      len = Math.hypot(dx, dy),
      nx = (-dy / len) * 0.34,
      ny = (dx / len) * 0.34;
    const p = (t, side, depth) => [
      cx + a[0] + dx * t + nx * side,
      base + a[1] + dy * t + ny * side,
      cz + depth,
    ];
    for (const z of [-0.6, 0.6])
      for (const s of [-1, 1]) tube(out, 'metal', p(0, s, z), p(1, s, z), 0.045, pale, 10);
    const n = Math.ceil(len / 0.8);
    for (let i = 0; i <= n; i++) {
      for (const z of [-0.6, 0.6])
        tube(out, 'metal', p(i / n, -1, z), p(i / n, 1, z), 0.032, pale, 8);
      for (const s of [-1, 1])
        tube(out, 'metal', p(i / n, s, -0.6), p(i / n, s, 0.6), 0.032, pale, 8);
      if (i < n)
        for (const z of [-0.6, 0.6])
          tube(
            out,
            'metal',
            p(i / n, i % 2 ? -1 : 1, z),
            p((i + 1) / n, i % 2 ? 1 : -1, z),
            0.033,
            pale,
            8,
          );
    }
  };
  for (const [a, b] of [
    [
      [-3.8, 0],
      [-3.8, 7.92],
    ],
    [
      [-3.8, 7.65],
      [0, 1.9],
    ],
    [
      [0, 1.9],
      [3.8, 7.65],
    ],
    [
      [3.8, 7.92],
      [3.8, 0],
    ],
  ])
    ribbonBeam(a, b);
  // Keep the measured tip at 152.317 m, including chord radius at the capped uprights.
  for (const x of [cx - 3.8, cx + 3.8])
    box(out, 'metal', [x - 0.34, top - 0.08, cz - 0.63], [x + 0.34, top, cz + 0.63], pale);
  // Parked maintenance unit, with a suspended cradle and independent wheel truck.
  box(out, 'metal', [-29.8, 139.5, -6.7], [-27.6, 140.2, -4.5], silver);
  for (const x of [-29.55, -27.85])
    for (const z of [-6.45, -4.75])
      tube(out, 'metal', [x, 139.5, z - 0.09], [x, 139.5, z + 0.09], 0.23, dark, 24);
  beam(out, 'metal', [-28.7, 140, -5.6], [-28.7, 142.2, -5.6], 0.35, 0.35, silver);
  beam(out, 'metal', [-32.8, 142, -5.6], [-17.1, 142.45, -5.6], 0.25, 0.32, silver);
  for (let x = -32.8; x < -17.5; x += 1.25) {
    beam(
      out,
      'metal',
      [x, 142, -5.76],
      [Math.min(x + 1.25, -17.1), 142.85, -5.76],
      0.06,
      0.06,
      silver,
    );
    beam(
      out,
      'metal',
      [x, 142.85, -5.44],
      [Math.min(x + 1.25, -17.1), 142, -5.44],
      0.06,
      0.06,
      silver,
    );
  }
  beam(out, 'metal', [-32.8, 142.85, -5.6], [-17.1, 142.85, -5.6], 0.11, 0.24, silver);
  box(out, 'metal', [-33.8, 141.7, -6.1], [-32.5, 143.1, -5.1], dark);
  for (const z of [-6.1, -5.1])
    tube(out, 'metal', [-17.1, 142.5, z], [-17.1, 137.5, z], 0.018, metal, 8);
  box(out, 'metal', [-18.2, 137.4, -6.5], [-16, 137.53, -4.7], silver);
  terraceRail(out, [-18.15, -6.45], [-16.05, -6.45], 137.53);
  terraceRail(out, [-18.15, -4.75], [-16.05, -4.75], 137.53);
}

export const montevideoStudy = {
  id: 'N0619',
  key: 'montevideo',
  title: 'Montevideo',
  wikidataId: 'Q176278',
  mapFrame: 'map-frame.json',
  build(out) {
    tower(out);
    lowBlock(out);
    ground(out);
    crown(out);
  },
  brief:
    'Rotterdam’s Montevideo: offset brick and pale tower volumes, an upper fifteen-level glazed balcony frame, lower circular windows, a stepped connecting block, the braced quay cantilever, rooftop water-tank sculpture and open lattice M weather vane.',
  sourceFacts: {
    publishedTipHeightMeters: 152.317,
    weatherVaneHeightMeters: 8,
    weatherVaneWeightTonnes: 9,
    apartments: 192,
    completed: 2005,
    surveyYear: 2022,
    highestOccupiedFloorMeters: 133.4,
    floorCount:
      'Map and catalog describe 43 levels; ABT describes 44. The engineer explicitly identifies the unserved technical floor 27A. These conventions remain distinct.',
  },
  reconstruction: {
    heightDatumsMeters: {
      transfer,
      northTerrace,
      wingRoof,
      linkRoof,
      terraceRoof,
      upperPaleRoof: 136.65,
      upperBrickRoof: 139.5,
    },
    lowerFacadeIntervals: 26,
    upperFacadeIntervals: 15,
    lowerFloors,
    upperFloors,
    lowFloors,
    envelope:
      'Regularized BAG plan with separate shifted upper volume; noisy roof polygons are reference evidence rather than imported mesh.',
    facade:
      'Bay widths, staggered windows, individual floor elevations, service equipment and sculpture proportions are reconstructed from linked photographs and drawings. Pale panel substrate is unconfirmed; the shared concrete graph approximates its matte finish.',
    vane: 'A fixed documented pose for reproducibility; the real M rotates with the wind.',
  },
  refs: [
    'https://www.mecanoo.nl/Projects/project/33/Montevideo-Residential-Tower?yr=0',
    'https://www.mecanoo.nl/News/ID/142/M-for-Rotterdam--10-years-of-Montevideo',
    'https://abt.eu/en/projects/montevideo/',
    'https://www.besix.com/en/projects/montevideo-tower',
    'https://vaneerdenconstructieadvies.nl/wp-content/uploads/2021/02/Montevideo-BMS.pdf',
    'https://www.skyscrapercenter.com/building/montevideo/5382',
    survey.source,
    'https://docs.3dbag.nl/en/copyright/',
    'https://www.openstreetmap.org/way/26545811',
  ],
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X northeast along the quay',
    front: '+Z southeast toward the water',
    origin: 'BAG plan envelope center; Y0 is terrain contact.',
  },
  geographic: () => ({
    anchor: frame.anchor,
    heading: frame.heading,
    mapGeometryHash: hashEvidenceText(frameBytes),
    mapGeometryLicense: 'CC-BY-4.0 / ODbL-1.0',
    attribution: frame.geometryAttribution,
    notes:
      'Exact BAG/OSM/Wikidata identity; signed quay axis transformed to WGS84. Tall tower southwest and projecting low wing northeast. Actual quay and entrance contact remain to verify.',
  }),
  geometrySource:
    'Original procedural exterior from architect photographs and published engineering plans, with separately retained attributed 3DBAG footprint and roof evidence. No downloaded mesh is rendered.',
  sourceLicense:
    'Original Molen recipe under the repository MIT license. Geographic measurements: © 3DBAG by tudelft3d and 3DGI, CC BY 4.0. Identity evidence: © OpenStreetMap contributors, ODbL-1.0. Reference photographs and publication drawings are linked, not redistributed.',
  dataAttribution:
    '© 3DBAG by tudelft3d and 3DGI, [CC BY 4.0](https://docs.3dbag.nl/en/copyright/). The source bundle retains the 2022 CityJSON response and coordinate operation. Molen regularizes roof and facade geometry and authors original architectural details. This is a reconstruction, not a survey or an endorsement.',
  sourceDocuments: ['bag-source.json', 'roof-envelope.json', 'reference-metadata.json'],
  limitations: [
    'Maximum-fidelity approval requires measured facade and floor schedules, exact pale-panel composition, current window arrangements, loggia depths and roof-equipment/sculpture dimensions. Photo-derived modules and the 43/44-level convention remain explicit approximations.',
    '3DBAG LoD2.2 roof evidence has 2.20 m RMSE; roof boundaries are regularized. The 152.317 m tip is established independently from the roof survey.',
    'Interior fit-out, underground parking, the surrounding quay, moored vessels and adjacent buildings are outside this exterior model. Balcony and entrance glazing is transparent; ordinary windows use opaque reflective PBR.',
    'Geographic approval requires actual terrain and quay contact, signed facade alignment and scene-level attribution verification. Footprint overlay captures alone do not establish those conditions.',
  ],
  camera: { position: [-144, 102, 164], lookAt: [-7, 74, 0], fov: 39 },
  qaCameras: [
    { name: 'quay-cantilever', position: [76, 12, 55], lookAt: [33, 12, 13] },
    { name: 'cantilever-soffit', position: [35, 1.8, 31], lookAt: [35, 7.6, 12] },
    { name: 'tower-entrance', position: [-29, 7, 33], lookAt: [-28, 4, 5] },
    { name: 'circular-windows', position: [-73, 56, -8], lookAt: [-45, 54, -8] },
    { name: 'upper-loggias', position: [-83, 116, 5], lookAt: [-45, 114, -1] },
    { name: 'upper-pale-grid', position: [-29, 110, -58], lookAt: [-29, 111, -17] },
    { name: 'linking-terraces', position: [8, 53, 52], lookAt: [2, 20, -5] },
    { name: 'water-tank-and-roof', position: [64, 61, -36], lookAt: [34, 42, -6] },
    { name: 'm-vane-and-crane', position: [-12, 153, 29], lookAt: [-30, 145, -3] },
    { name: 'roof-and-plan', position: [0, 320, 0.5], lookAt: [0, 0, 0] },
    { name: 'far-silhouette', position: [-420, 240, 480], lookAt: [-9, 72, 0] },
  ],
};
