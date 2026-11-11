/** Palacio Errázuriz Alvear. The wall planes follow the native perimeter. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { beam, normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { B, poly, rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const { outline, section } = plan;
const { foundationBottom, principalThreshold, wallTop, roofSpring, roofTop } = section;

const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.88, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.87, metallic: 0 },
  pane: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.45, metallic: 0.08 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.62, metallic: 0.3 },
};
const palette = Object.fromEntries(Object.entries({
  wall: 'd2c9b5', trim: 'ddd3bd', base: 'b0a491', accent: 'bdb097',
  roof: '515254', pane: '747b79', shadow: '343935', sash: 'b8b4a1', iron: '484945',
}).map(([key, hex]) => [key, rgb(hex)]));

function face(out, slot, points, toward, color = palette[slot]) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, n, i) => sum + n * toward[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, color);
  else out.addConvexPolygon(slot, 'palette:#ffffff', points, normal, ([x, y]) => [x, y], color);
}


function solid(out, slot, ring, bottom, top, color) {
  const buffer = new MeshBufferBuilder();
  poly(buffer, slot, ring, bottom, top, color);
  const mesh = buffer.finalize();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const positions = Array.from(mesh.indices.slice(i, i + 3),
      index => Array.from(mesh.positions.slice(index * 3, index * 3 + 3)));
    const start = mesh.indices[i] * 3;
    const normal = Array.from(mesh.normals.slice(start, start + 3));
    face(out, slot, positions, normal, color);
  }
}

function edge(a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
  return {
    length,
    normal: [-dz, 0, dx],
    point: (u, y, d = 0) => [a[0] + dx * u - dz * d, y, a[1] + dz * u + dx * d],
  };
}

function panel(out, slot, side, left, right, bottom, top, depth = 0, color) {
  if (right - left < 0.001 || top - bottom < 0.001) return;
  const { point, normal } = side;
  face(out, slot, [point(left, bottom, depth), point(right, bottom, depth),
    point(right, top, depth), point(left, top, depth)], normal, color);
}

function ledge(out, side, left, right, bottom, top, depth, color = palette.trim, back = -0.025) {
  const { point, normal } = side;
  panel(out, 'trim', side, left, right, bottom, top, depth, color);
  face(out, 'trim', [point(left, top, depth), point(right, top, depth),
    point(right, top, back), point(left, top, back)], [0, 1, 0], color);
  face(out, 'trim', [point(left, bottom, depth), point(right, bottom, depth),
    point(right, bottom, back), point(left, bottom, back)], [0, -1, 0], color);
  for (const [u, sign] of [[left, -1], [right, 1]]) {
    face(out, 'trim', [point(u, bottom, depth), point(u, bottom, back),
      point(u, top, back), point(u, top, depth)], [normal[2] * sign, 0, -normal[0] * sign], color);
  }
}

function column(out, x, z, base, top, radius, lod, order) {
  const rings = order === 'giant'
    ? [[0, 1.38], [0.23, 1.38], [0.37, 1.14], [0.49, 1.02], [top - base - 0.82, 0.87],
      [top - base - 0.59, 1.13], [top - base - 0.22, 1.42], [top - base, 1.42]]
    : [[0, 1.33], [0.21, 1.33], [0.34, 1.03], [top - base - 0.44, 0.88],
      [top - base - 0.21, 1.26], [top - base, 1.26]];
  const sides = lod < 2 ? 8 : lod === 2 ? 12 : 16;
  const at = (theta, [h, r]) => [x + radius * r * Math.cos(theta), base + h, z + radius * r * Math.sin(theta)];
  for (let j = 1; j < rings.length; j++) {
    for (let k = 0; k < sides; k++) {
      const start = k * 2 * Math.PI / sides, end = (k + 1) * 2 * Math.PI / sides;
      const mid = (start + end) / 2;
      const fluted = order === 'giant' && lod === 3 && j === 4 && k % 4 === 1;
      face(out, 'trim', [at(start, rings[j - 1]), at(end, rings[j - 1]),
        at(end, rings[j]), at(start, rings[j])], [Math.cos(mid), 0, Math.sin(mid)], fluted ? palette.wall : palette.trim);
    }
  }
}

function bays(side, count, width, left = 0, span = side.length) {
  return Array.from({length: count}, (_, i) => ({ u: left + span * (i + 0.5) / count, w: width }));
}

function windowBand(out, side, openings, bottom, top, lod, arch = false, base = false) {
  let cursor = 0;
  const wallColor = base ? palette.base : palette.wall;
  for (const {u, w, sill, head} of openings) {
    const left = u - w / 2, right = u + w / 2;
    panel(out, 'wall', side, cursor, left, bottom, top, 0, wallColor);
    panel(out, 'wall', side, left, right, bottom, sill, 0, wallColor);
    panel(out, 'wall', side, left, right, head, top, 0, wallColor);
    const shoulder = arch ? head - w * 0.44 : head;
    const { point, normal } = side;
    const reveal = -0.18;
    for (const [sideU, sign] of [[left, 1], [right, -1]]) {
      face(out, 'trim', [point(sideU, sill), point(sideU, shoulder),
        point(sideU, shoulder, reveal), point(sideU, sill, reveal)],
        [normal[2] * sign, 0, -normal[0] * sign], palette.accent);
    }
    face(out, 'trim', [point(left, sill), point(right, sill), point(right, sill, reveal),
      point(left, sill, reveal)], [0, 1, 0], palette.accent);
    panel(out, 'pane', side, left, right, sill, shoulder, reveal, base ? palette.shadow : palette.pane);
    if (arch) {
      const segments = [6, 8, 10, 12][lod];
      const inner = t => [u - w / 2 * Math.cos(t), shoulder + w * 0.44 * Math.sin(t)];
      const outer = t => [u - (w / 2 + 0.18) * Math.cos(t), shoulder + (w * 0.44 + 0.18) * Math.sin(t)];
      for (let i = 0; i < segments; i++) {
        const a = i * Math.PI / segments, b = (i + 1) * Math.PI / segments;
        const [ax, ay] = inner(a), [bx, by] = inner(b);
        const [ox, oy] = outer(a), [px, py] = outer(b);
        if (i === segments / 2 - 1)
          face(out, 'wall', [point(ax, ay), point(bx, by), point(ax, head)], normal, wallColor);
        else if (i === segments / 2)
          face(out, 'wall', [point(ax, ay), point(bx, by), point(bx, head)], normal, wallColor);
        else face(out, 'wall', [point(ax, ay), point(bx, by), point(bx, head), point(ax, head)], normal, wallColor);
        const top = [point(bx, by, reveal), point(ax, ay, reveal)];
        const fill = [point(ax, shoulder, reveal), point(bx, shoulder, reveal), ...top];
        if (i === 0) fill.pop();
        if (i === segments - 1) fill.splice(1, 1);
        face(out, 'pane', fill, normal, palette.pane);
        face(out, 'trim', [point(ax, ay, 0.075), point(bx, by, 0.075),
          point(px, py, 0.075), point(ox, oy, 0.075)], normal);
      }
    } else {
      face(out, 'trim', [point(left, head), point(right, head), point(right, head, reveal),
        point(left, head, reveal)], [0, -1, 0], palette.accent);
      ledge(out, side, left - 0.22, right + 0.22, head, head + 0.17, 0.16);
    }
    panel(out, 'trim', side, left - 0.16, left, sill, shoulder, 0.07);
    panel(out, 'trim', side, right, right + 0.16, sill, shoulder, 0.07);
    ledge(out, side, left - 0.24, right + 0.24, sill - 0.16, sill, 0.16);
    if (lod >= 1 && !base) {
      const divisions = lod === 3 ? [-0.28, 0, 0.28] : [0];
      for (const part of divisions) {
        const x = u + part * w;
        panel(out, 'pane', side, x - 0.025, x + 0.025, sill, shoulder, -0.155, palette.sash);
      }
      const crossbar = arch ? shoulder - 0.03 : sill + (head - sill) * 0.68;
      panel(out, 'pane', side, left, right, crossbar - 0.028, crossbar + 0.028, -0.152, palette.sash);
    }
    cursor = right;
  }
  panel(out, 'wall', side, cursor, side.length, bottom, top, 0, wallColor);
}

const elevations = [
  {start: 0, end: 1, lower: 5},
  {start: 1, end: 2, lower: 2},
  {start: 2, end: 3},
  {start: 3, end: 4, lower: 5, character: 'garden'},
  {start: 4, end: 5},
  {start: 5, end: 6, lower: 2},
  {start: 6, end: 7, lower: 2},
  {start: 7, end: 21, lower: 1, character: 'portico'},
  {start: 21, end: 22},
  {start: 22, end: 23, lower: 1},
  {start: 23, end: 24, lower: 1},
  {start: 24, end: 25},
  {start: 25, end: 0, lower: 9, character: 'avenue'},
];

function distantElevation(out, side, definition, lod, windows) {
  const { length, point } = side;
  const garden = definition.character === 'garden', avenue = definition.character === 'avenue';
  panel(out, 'wall', side, 0, length, foundationBottom, 0.07, 0, palette.base);
  panel(out, 'wall', side, 0, length, 0.07, 6.43);
  panel(out, 'wall', side, 0, length, 6.43, wallTop);
  for (const b of windows) {
    const u = b.u, w = b.w / 2;
    if (garden || definition.character === 'portico') {
      const shoulder = 4.85;
      const arch = [point(u - w, 0.32, 0.02), point(u + w, 0.32, 0.02)];
      for (let i = 0; i <= 4; i++) {
        const angle = i * Math.PI / 4;
        arch.push(point(u + w * Math.cos(angle), shoulder + w * Math.sin(angle), 0.02));
      }
      face(out, 'pane', arch, side.normal);
    } else panel(out, 'pane', side, u - w, u + w, 0.85, 5.73, 0.02);
    panel(out, 'pane', side, u - w * 0.86, u + w * 0.86, 7.15, 11, 0.02);
    if (lod === 1) {
      ledge(out, side, u - w - 0.21, u + w + 0.21, 0.67, 0.85, 0.16);
      ledge(out, side, u - w, u + w, 6.98, 7.15, 0.16);
      panel(out, 'pane', side, u - 0.035, u + 0.035, 7.15, 11, 0.035, palette.sash);
    }
  }
  panel(out, 'trim', side, 0, length, 6.19, 6.34, 0.035);
  ledge(out, side, 0, length, wallTop, roofSpring, 0.5);
  if (garden || avenue) {
    const piers = garden ? [0.45, ...windows.slice(1).map((b, i) => (b.u + windows[i].u) / 2), length - 0.45]
      : [12.63, 17.37, 22.27, 27.05];
    for (const u of piers) {
      if (lod === 1) {
        const [x, , z] = point(u, 0, 0.13);
        B(out, 'trim', x, 0.07, z, 0.59, 11.86, 0.59, palette.trim);
        B(out, 'trim', x, 11.93, z, 0.83, 0.44, 0.83, palette.trim);
      } else panel(out, 'trim', side, u - 0.28, u + 0.28, 0.07, 12.37, 0.045);
    }
    if (avenue) pediment(out, side, 11.75, 27.95, roofSpring - 0.05, 2.56, lod);
  }
}

function decorateElevation(out, side, definition, lod) {
  const {length, point} = side;
  const {lower: count = 0, character} = definition;
  const garden = character === 'garden', avenue = character === 'avenue', entrance = character === 'portico';
  const baseline = principalThreshold - 0.25;
  const streetBays = avenue ? [
    ...bays(side, 3, 1.55, 0.5, 11.4),
    ...bays(side, 3, 2.35, 12.6, 14.5),
    ...bays(side, 3, 1.55, 28, length - 28.5),
  ] : bays(side, count, garden ? 2.03 : entrance ? 2.55 : Math.min(1.8, length / (count + 1) * 0.66));
  if (lod < 2) {
    distantElevation(out, side, definition, lod, streetBays);
    return;
  }
  const lower = streetBays.map(b => ({...b, sill: garden || entrance ? principalThreshold : 0.85, head: entrance ? 5.15 : 5.73}));
  const upper = streetBays.map(b => ({...b, w: b.w * 0.88, sill: 7.15, head: 11.0}));
  const basement = entrance ? [] : streetBays.filter((_, i) => i % (avenue || garden ? 1 : 2) === 0)
    .map(b => ({...b, w: Math.min(b.w, 1.1), sill: -2.74, head: -1.72}));
  windowBand(out, side, basement, foundationBottom, baseline, lod, false, true);
  windowBand(out, side, lower, baseline, 6.43, lod, garden || entrance);
  windowBand(out, side, upper, 6.43, wallTop, lod);
  for (const [a, b, depth, tone] of [[-1.31, -1.16, 0.13, palette.accent], [-0.13, 0.05, 0.2, palette.trim],
    [6.15, 6.34, 0.13, palette.trim], [11.91, 12.05, 0.17, palette.accent],
    [12.48, 12.75, 0.38, palette.trim], [12.75, 13.00, 0.55, palette.trim],
    [13.00, roofSpring, 0.4, palette.trim]]) {
    ledge(out, side, 0, length, a, b, depth, tone);
  }
  if (garden || avenue) {
    const giant = garden ? [0.45, ...streetBays.slice(1).map((b, i) => (b.u + streetBays[i].u) / 2), length - 0.45]
      : [12.63, 17.37, 22.27, 27.05];
    for (const u of giant) {
      const [x, , z] = point(u, 0, 0.13);
      column(out, x, z, baseline, 12.37, garden ? 0.38 : 0.42, lod, 'giant');
    }
    if (avenue) pediment(out, side, 11.75, 27.95, roofSpring - 0.05, 2.56, lod);
  }
  if (lod === 3) {
    for (let u = 0.37; u < length - 0.25; u += 0.64) {
      ledge(out, side, u - 0.09, u + 0.09, 12.36, 12.52, 0.32, palette.accent);
    }
  }
}

function pediment(out, side, left, right, base, rise, lod) {
  const {point, normal} = side;
  const middle = (left + right) / 2;
  const a = point(left, base, 0.55), b = point(right, base, 0.55), crown = point(middle, base + rise, 0.55);
  face(out, 'trim', [a, b, crown], normal, palette.wall);
  face(out, 'roof', [a, crown, point(middle, base + rise - 0.3, -1.28),
    point(left, base, -1.28)], [0, 1, 0]);
  face(out, 'roof', [crown, b, point(right, base, -1.28),
    point(middle, base + rise - 0.3, -1.28)], [0, 1, 0]);
  ledge(out, side, left - 0.28, right + 0.28, base - 0.17, base + 0.10, 0.72);
  beam(out, 'trim', a, crown, 0.20, 0.34, palette.trim);
  beam(out, 'trim', crown, b, 0.20, 0.34, palette.trim);
  if (lod >= 2) {
    ledge(out, side, middle - 0.45, middle + 0.45, base + 0.55, base + 1.1, 0.68, palette.accent, 0.54);
    for (const sign of [-1, 1]) {
      const start = point(middle + sign * 0.44, base + 0.7, 0.61);
      const end = point(middle + sign * 2.64, base + 0.35, 0.61);
      beam(out, 'trim', start, end, 0.20, 0.14, palette.accent);
    }
  }
}

function atY([x, z], y) { return [x, y, z]; }

function balusters(out, side, left, right, base, lod) {
  const { point } = side;
  ledge(out, side, left, right, base, base + 0.16, 0.15, palette.trim, -0.15);
  ledge(out, side, left, right, base + 0.76, base + 0.94, 0.15, palette.trim, -0.15);
  const count = Math.max(1, Math.round((right - left) / (lod === 1 ? 1.45 : 0.58)));
  for (const {u} of bays(side, count, 0, left, right - left)) {
    const [x, , z] = point(u, base);
    B(out, 'trim', x, base + 0.15, z, 0.15, 0.62, 0.15, palette.trim);
  }
}

function mainRoof(out, lod) {
  const eaves = elevations.map(({start}) => outline[start]);
  // Intersect adjacent inset edges so the mansard closes around the re-entrant garden corners.
  const roofSetbacks = elevations.map(({character}) => character === 'avenue' ? 1.48 : character === 'garden' ? 1.62 : 0.95);
  const roofEdges = eaves.map((a, i) => edge(a, eaves[(i + 1) % eaves.length]));
  const inset = eaves.map(([x, z], i) => {
    const prev = (i + eaves.length - 1) % eaves.length;
    const [a, , b] = roofEdges[prev].normal;
    const [c, , d] = roofEdges[i].normal;
    const p = -roofSetbacks[prev], q = -roofSetbacks[i];
    const det = a * d - b * c;
    return [x + (p * d - b * q) / det, z + (a * q - p * c) / det];
  });
  for (let i = 0; i < eaves.length; i++) {
    const j = (i + 1) % eaves.length;
    face(out, 'roof', [atY(eaves[i], roofSpring - 0.04), atY(eaves[j], roofSpring - 0.04),
      atY(inset[j], roofTop), atY(inset[i], roofTop)], [0, 1, 0]);
  }
  solid(out, 'roof', inset, roofTop - 0.12, roofTop, palette.roof);
  for (const [a, b] of [[inset[0], inset[1]], [inset[1], inset[2]], [inset.at(-1), inset[0]]]) {
    const side = edge(a, b);
    if (side.length > 4 && lod > 0) balusters(out, side, 0, side.length, roofTop - 0.19, lod);
  }
  for (const [x, z, w, h, d] of [[-11.3, 2.0, 2.4, 1.72, 1.55], [14.2, -3.4, 2.7, 2.3, 1.6], [20.1, 2.7, 1.38, 1.53, 1.1]]) {
    B(out, 'wall', x, roofTop - 0.3, z, w, h, d, palette.wall);
    if (lod >= 1) B(out, 'trim', x, roofTop + h - 0.45, z, w + 0.22, 0.16, d + 0.22, palette.trim);
  }
  if (lod >= 1) {
    for (const x of [-11.2, -7.4, -3.8, 14.3, 18.3, 22.3]) {
      B(out, 'roof', x, 13.91, 11.18, 1.82, 0.66, 1.27, palette.roof);
      B(out, 'pane', x, 14.03, 11.83, 1.03, 0.44, 0.08, palette.shadow);
    }
  }
}

function porch(out, lod) {
  const projection = outline.slice(8, 21);
  const [near, far] = [outline[7], outline[21]];
  const ring = [near, ...projection, far];
  solid(out, 'wall', ring, -3.96, 0.07, palette.base);
  solid(out, 'trim', ring, 0.07, principalThreshold, palette.trim);
  const x = -23.92, z = -2.66;
  const crown = ring.map(([u, v]) => [x + (u - x) * 1.04, z + (v - z) * 1.04]);
  if (lod === 0) solid(out, 'trim', crown, 6.36, 7.15, palette.trim);
  else {
    solid(out, 'trim', ring, 6.36, 6.6, palette.accent);
    solid(out, 'trim', crown, 6.6, 6.94, palette.trim);
    solid(out, 'trim', ring, 6.94, 7.15, palette.trim);
  }

  const supports = [9, 12, 15, 18, 20].map(i => {
    const [u, v] = outline[i];
    return [x + (u - x) * 0.92, z + (v - z) * 0.92];
  });
  for (let i = 0; i < supports.length; i++) {
    const [u, v] = supports[i];
    const tangent = edge(supports[Math.max(0, i - 1)], supports[Math.min(supports.length - 1, i + 1)]);
    if (lod === 0) {
      B(out, 'trim', u, principalThreshold, v, 0.63, 5.34 - principalThreshold, 0.63, palette.trim);
    } else {
      const [x0, , z0] = tangent.point(0, 0);
      for (const offset of [-0.29, 0.29]) {
        const [dx, , dz] = tangent.point(offset, 0);
        if (lod === 1) {
          B(out, 'trim', u + dx - x0, principalThreshold, v + dz - z0,
            0.41, 5.34 - principalThreshold, 0.41, palette.trim);
        } else column(out, u + dx - x0, v + dz - z0, principalThreshold, 5.34, 0.26, lod, 'tuscan');
      }
    }
  }
  for (let i = 1; i < supports.length; i++) {
    const side = edge(supports[i - 1], supports[i]);
    const {point, length, normal} = side;
    const half = length / 2, radius = half - 0.43, shoulder = 4.67, rise = 1.43;
    const segments = [4, 6, 10, 10][lod];
    const arc = (t, d, band = 0) => point(half - (radius + band) * Math.cos(t),
      shoulder + (rise + band) * Math.sin(t), d);
    for (let j = 0; j < segments; j++) {
      const a = j * Math.PI / segments, b = (j + 1) * Math.PI / segments;
      face(out, 'trim', [arc(a, 0.22), arc(b, 0.22), arc(b, 0.22, 0.25), arc(a, 0.22, 0.25)], normal);
      if (lod > 0) face(out, 'trim', [arc(a, -0.22), arc(b, -0.22), arc(b, -0.22, 0.25), arc(a, -0.22, 0.25)], normal.map(n => -n));
      if (lod > 0) face(out, 'trim', [arc(a, 0.22), arc(b, 0.22), arc(b, -0.22), arc(a, -0.22)], [0, -1, 0]);
      const start = arc(a, 0.22, 0.25), end = arc(b, 0.22, 0.25);
      face(out, 'trim', [start, end, [end[0], 6.4, end[2]], [start[0], 6.4, start[2]]], normal, palette.wall);
    }
  }
  const ironTop = 7.93;
  for (let i = 1; i < projection.length; i++) {
    const a = projection[i - 1], b = projection[i];
    if (lod === 0) {
      const side = edge(a, b);
      panel(out, 'iron', side, 0, side.length, ironTop - 0.09, ironTop, 0);
    } else beam(out, 'iron', atY(a, ironTop), atY(b, ironTop), 0.065, 0.07, palette.iron);
    if (lod > 0) beam(out, 'iron', atY(a, 7.27), atY(b, 7.27), 0.04, 0.045, palette.iron);
    const side = edge(a, b);
    const count = lod >= 2 ? Math.max(2, Math.round(side.length / 0.22)) : lod === 1 ? 1 : 0;
    for (const {u} of bays(side, count, 0)) {
      const [px, , pz] = side.point(u, 0);
      B(out, 'iron', px, 7.24, pz, 0.037, 0.69, 0.037, palette.iron);
    }
  }
  const doorFace = edge(near, far);
  for (const offset of [1.1, doorFace.length - 1.1]) {
    if (lod === 0) continue;
    const segments = lod === 3 ? 12 : 8;
    for (let j = 0; j < segments; j++) {
      const a = j * 2 * Math.PI / segments, b = (j + 1) * 2 * Math.PI / segments;
      const p = (theta, r) => doorFace.point(offset + r * Math.cos(theta), 8.44 + r * Math.sin(theta), 0.12);
      face(out, 'trim', [p(a, 0.48), p(b, 0.48), p(b, 0.61), p(a, 0.61)], doorFace.normal);
    }
  }
}

function gardenTerrace(out, lod) {
  const z = -14.84, mid = 4.74, lower = -2.18, floor = principalThreshold;
  B(out, 'wall', mid, foundationBottom + 0.08, z - 1.62, 18.05, lower - foundationBottom + 0.08, 3.28, palette.base);
  B(out, 'trim', mid, lower, z - 1.63, 18.2, 0.18, 3.3, palette.trim);
  B(out, 'wall', mid, lower + 0.17, z - 0.65, 18.12, floor - lower - 0.2, 1.32, palette.wall);
  B(out, 'trim', mid, floor - 0.11, z - 0.67, 18.22, 0.14, 1.36, palette.trim);
  const steps = [3, 8, 12, 12][lod];
  for (const sign of [-1, 1]) {
    const start = mid + sign * 1.65;
    const run = 4.12;
    for (let j = 0; j < steps; j++) {
      const y = lower + 0.19 + (floor - lower - 0.19) * (j + 1) / steps;
      B(out, 'trim', start + sign * (j + 0.5) * run / steps, lower + 0.14, z - 2.06,
        run / steps + 0.001, y - lower - 0.14, 1.83, palette.trim);
    }
    const rail = edge([start, z - 3.05], [start + sign * run, z - 3.05]);
    const [a, b] = [rail.point(0, lower + 0.82), rail.point(run, floor + 0.7)];
    beam(out, 'trim', a, b, 0.18, 0.24, palette.trim);
    const count = lod === 0 ? 0 : 7;
    for (const {u} of bays(rail, count, 0)) {
      const y = lower + 0.19 + (floor - lower - 0.19) * u / run;
      const [x, , pz] = rail.point(u, y);
      B(out, 'trim', x, y, pz, 0.15, 0.58, 0.19, palette.trim);
    }
    const end = mid + sign * 8.85;
    if (lod > 0) balusters(out, edge([start + sign * run, z - 2.94], [end, z - 2.94]),
      0, Math.abs(end - start - sign * run), lower + 0.18, lod);
  }
}

function buildPalace(out, _frame, lod = 3) {
  for (const definition of elevations) {
    decorateElevation(out, edge(outline[definition.start], outline[definition.end]), definition, lod);
  }
  mainRoof(out, lod);
  porch(out, lod);
  gardenTerrace(out, lod);
}
export const palaceSkyline = (out, frame) => buildPalace(out, frame, 0);
export const palaceDistrict = (out, frame) => buildPalace(out, frame, 1);
export const palaceStreet = (out, frame) => buildPalace(out, frame, 2);
export const palaceCloseup = (out, frame) => buildPalace(out, frame, 3);

const camera = [-47, 27, 43], lookAt = [0, 5.8, -1];
const recipe = 'palace-model.mjs';
export const palaceModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: buildPalace,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief: 'The French neoclassical Palacio Errázuriz Alvear in Buenos Aires, with its limestone avenue front, arched garden doors and open circular entrance portico.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  mediumFiContext: {
    scale: 1.35,
    groundY: -4.4,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['stone_limestone', 'stone_limestone_weathered', 'slate', 'metal_painted'],
  qaCameras: [
    { name: 'avenue-pediment-and-palace', position: [-28, 18, 50], lookAt: [0, 6.1, 3] },
    { name: 'garden-order-and-stairs', position: [15, 9.7, -45], lookAt: [4.5, 5.4, -12] },
    { name: 'open-circular-portico', position: [-45, 6.9, -8], lookAt: [-23.9, 4.7, -2.7] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map(reviewLod => ({
    name: 'whole-palace-' + reviewLod, position: camera, lookAt, reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'palaceSkyline',
    errorMeters: 0.41,
    surfaces,
    authoredLevels: {
      district: { export: 'palaceDistrict', errorMeters: 0.2, surfaces },
      street: { export: 'palaceStreet', errorMeters: 0.09, surfaces },
      closeup: { export: 'palaceCloseup', errorMeters: 0.027, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense: 'Original deterministic geometry under the repository license. The cited Qualla photograph originals are public domain by their authors. OpenStreetMap contributors supply the mapped perimeter under ODbL.',
};
