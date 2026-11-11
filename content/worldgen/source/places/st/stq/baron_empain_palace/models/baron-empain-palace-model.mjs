/** The restored Heliopolis palace, its terraces, dome and sculpted tower. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { beam, beamPath, loft, normalFor, radialRing } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { B as box, rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const requireFromWorldgen = createRequire(new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url));
const { default: earcut } = requireFromWorldgen('earcut');
const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'), section = plan.section, frame = read('map-frame');
const terrain = read('terrain-ground-grid');
const [outline] = frame.geometry.polygons;
const surfaces = {
  walls: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.87, metallic: 0 },
  plinth: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.96, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.92, metallic: 0 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.43, metallic: 0.07 },
};
const c = Object.fromEntries(Object.entries({
  terra: 'b58268', terraDark: '9f6b56', plinth: 'a57360', mold: 'd0ab8a',
  relief: 'c59c7b', crown: 'bf9875', pink: 'b48b72', plaster: 'bdaf94',
  stone: 'c1a488', window: '3e3b35', door: '5e4439', roof: 'aa8f77',
  cut: '795745', roofPale: 'c0a387',
}).map(([name, hex]) => [name, rgb(hex)]));
const white = 'palette:#ffffff', up = [0, 1, 0];
const circle = 2 * Math.PI;

function face(out, slot, points, outward, color) {
  let n = normalFor(...points);
  if (n.reduce((a, v, i) => a + v * outward[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, color);
  else out.addTriangle(slot, white, points, n, [[0, 0], [1, 0], [0, 1]], color);
}

function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u), j = Math.floor(v), dx = u - i, dz = v - j;
  const [a, b] = terrain.heightsMeters.slice(j, j + 2);
  return (a[i] * (1 - dx) + a[i + 1] * dx) * (1 - dz) +
    (b[i] * (1 - dx) + b[i + 1] * dx) * dz - terrain.modelDatumElevationMeters;
}

function basement(out, lod) {
  const y = section.plinthTop;
  const area = outline.reduce((sum, [x, z], i) => {
    const [u, v] = outline[(i + 1) % outline.length];
    return sum + x * v - z * u;
  }, 0);
  const ring = area > 0 ? outline : [...outline].reverse();
  for (let i = 0; i < ring.length; i++) {
    const [x, z] = ring[i], [u, v] = ring[(i + 1) % ring.length];
    const outward = [v - z, 0, x - u];
    const low = (a, b) => Math.min(0.11, ground(a, b) - 0.22);
    face(out, 'plinth', [[x, low(x, z), z], [u, low(u, v), v], [u, y, v], [x, y, z]], outward, c.plinth);
    if (lod) {
      const length = Math.hypot(...outward);
      const dx = outward[0] * 0.052 / length, dz = outward[2] * 0.052 / length;
      face(out, 'plinth', [[x + dx, y - 0.36, z + dz], [u + dx, y - 0.36, v + dz],
        [u + dx, y - 0.16, v + dz], [x + dx, y - 0.16, z + dz]], outward, c.terraDark);
    }
  }
  const indices = earcut(ring.flat());
  if (!indices.length) throw Error('Palace perimeter does not triangulate');
  for (let i = 0; i < indices.length; i += 3) {
    face(out, 'roof', indices.slice(i, i + 3).map((index) => [ring[index][0], y, ring[index][1]]), up, c.roofPale);
  }
  for (const [index, [x, z]] of section.entranceCenters.entries()) {
    const width = index === 0 ? 3.9 : 2.25;
    const start = z - (index === 0 ? 3.20 : 2.25);
    const bottom = Math.min(0.37, ground(x, start) - 0.12);
    const count = [2, 4, 8, 10][lod];
    for (let i = 0; i < count; i++) {
      const depth = (z - start) / count;
      box(out, 'plinth', x, bottom, start + depth * (i + 0.5), width, (y - bottom) * (i + 1) / count,
        depth + 0.045, c.terraDark);
    }
    if (lod >= 2) for (const side of [-1, 1]) {
      const xx = x + side * (width / 2 + 0.16);
      beam(out, 'trim', [xx, bottom + 0.26, start], [xx, y + 0.30, z], 0.29, 0.29, c.relief);
      box(out, 'trim', xx, bottom, start, 0.38, 0.76, 0.42, c.relief);
    }
  }
}

const panel = (out, slot, x, y, z, w, h, color) => box(out, slot, x, y, z, w, h, 0.072, color);
function cornice(out, [a, b, back, front], y, lod, tint = c.mold) {
  const x = (a + b) / 2, z = (back + front) / 2, w = b - a, d = front - back;
  box(out, 'trim', x, y, z, w + 0.44, 0.23, d + 0.43, tint);
  if (lod) {
    box(out, 'trim', x, y - 0.19, z, w + 0.20, 0.19, d + 0.20, c.relief);
    if (lod >= 2) box(out, 'trim', x, y + 0.23, z, w + 0.22, 0.13, d + 0.22, c.crown);
  }
}

function piers(out, x, z, floor, top, width, lod, color = c.terra) {
  const height = top - floor;
  if (!lod) {
    box(out, 'walls', x, floor, z, width, height, width, color);
    return;
  }
  if (lod === 1) {
    box(out, 'trim', x, floor, z, width * 1.23, 0.48, width * 1.23, c.stone);
    box(out, 'walls', x, floor + 0.48, z, width, height - 0.83, width, color);
    box(out, 'trim', x, top - 0.35, z, width * 1.29, 0.35, width * 1.29, c.mold);
    return;
  }
  box(out, 'trim', x, floor, z, width * 1.29, 0.33, width * 1.29, c.stone);
  box(out, 'trim', x, floor + 0.33, z, width * 1.10, 0.31, width * 1.10, c.relief);
  box(out, 'walls', x, floor + 0.63, z, width, height - 1.18, width, color);
  box(out, 'trim', x, top - 0.55, z, width * 1.12, 0.29, width * 1.12, c.relief);
  box(out, 'trim', x, top - 0.26, z, width * 1.36, 0.26, width * 1.36, c.mold);
  if (lod >= 2) {
    box(out, 'trim', x, floor + 0.74, z + width * 0.51, width * 0.71, 0.50, 0.096, c.relief);
    box(out, 'trim', x, top - 1.10, z + width * 0.49, width * 0.77, 0.47, 0.13, c.relief);
    if (lod === 3) {
      for (const shift of [-0.21, 0.21]) {
        box(out, 'trim', x + shift * width, floor + 1.28, z + width * 0.514, width * 0.11, height - 2.43, 0.045, c.crown);
      }
    }
  }
}

function opening(out, x, floor, z, w, h, sign, lod, color = c.window) {
  const detail = (slot, a, y, offset, width, height, tint) => {
    const zz = z + sign * offset;
    if (lod >= 2) panel(out, slot, a, y, zz, width, height, tint);
    else face(out, slot, [[a - width / 2, y, zz], [a + width / 2, y, zz],
      [a + width / 2, y + height, zz], [a - width / 2, y + height, zz]], [0, 0, sign], tint);
  };
  detail('glazing', x, floor, 0.034, w, h, color);
  if (!lod) return;
  for (const dx of [-w * 0.55, w * 0.55]) {
    detail('trim', x + dx, floor - 0.04, 0.084, w * 0.12, h + 0.18, c.relief);
  }
  detail('trim', x, floor + h, 0.10, w * 1.28, 0.18, c.mold);
  detail('trim', x, floor - 0.13, 0.09, w * 1.27, 0.13, c.relief);
  if (lod >= 2) {
    for (const dx of [-w * 0.29, 0, w * 0.29]) {
      panel(out, 'trim', x + dx, floor + 0.065, z + sign * 0.082, 0.052, h * 0.96, c.cut);
    }
    panel(out, 'trim', x, floor + h * 0.72, z + sign * 0.083, w, 0.056, c.cut);
  }
}

function parapet(out, a, b, y, z, lod) {
  beam(out, 'trim', [a, y + 0.11, z], [b, y + 0.11, z], 0.31, 0.22, c.relief);
  beam(out, 'trim', [a, y + 0.84, z], [b, y + 0.84, z], 0.31, 0.18, c.mold);
  const count = Math.max(2, Math.ceil((b - a) / [3.25, 1.65, 0.92, 0.60][lod]));
  for (let i = 0; i <= count; i++) {
    const x = a + (b - a) * i / count;
    box(out, 'trim', x, y + 0.21, z, [0.20, 0.22, 0.20, 0.17][lod], 0.62, 0.24, c.relief);
    if (lod === 3 && i < count) {
      const mid = x + (b - a) / count / 2;
      const chain = [[mid - 0.13, y + 0.51, z], [mid, y + 0.69, z], [mid + 0.13, y + 0.51, z], [mid, y + 0.32, z]];
      beamPath(out, 'trim', chain, 0.058, 0.075, c.crown, true);
    }
  }
}

function arcade(out, a, b, z, floor, top, bays, lod, width, ornament = true) {
  const step = (b - a) / bays;
  for (let i = 0; i <= bays; i++) piers(out, a + i * step, z, floor, top - 0.44, width, lod);
  box(out, 'trim', (a + b) / 2, top - 0.46, z, b - a + width * 1.5, 0.45, 0.67, c.mold);
  if (!lod || !ornament) return;
  for (let i = 0; i < bays; i++) {
    const x = a + (i + 0.5) * step;
    const count = lod === 3 ? 10 : lod === 2 ? 7 : 4;
    const lower = (j) => {
      const angle = Math.PI * j / count;
      const h = Math.sin(angle);
      return [x - Math.cos(angle) * (step - width * 1.1) / 2,
        top - 1.57 + 0.98 * h + (lod >= 2 ? 0.055 * Math.sin(j * 2.6) * h : 0), z + 0.17];
    };
    const edge = Array.from({ length: count + 1 }, (_, j) => lower(j));
    for (let j = 1; j < edge.length; j++) {
      const p = edge[j - 1], q = edge[j];
      face(out, 'trim', [p, q, [q[0], top - 0.36, q[2]], [p[0], top - 0.36, p[2]]], [0, 0, 1], c.relief);
    }
    beamPath(out, 'trim', edge, 0.13, 0.23, c.mold);
    if (lod >= 2) {
      for (const side of [-1, 1]) {
        const px = x + side * step * 0.43;
        beam(out, 'trim', [px, top - 1.49, z + 0.19], [px, top - 0.38, z + 0.51], 0.22, 0.20, c.crown);
      }
    }
  }
}

function gardenBody(out, lod) {
  const { body: [a, b, rear, front], groundFloor: y, firstFloor: f, roofFloor: roof } = section;
  box(out, 'walls', (a + b) / 2, section.plinthTop, (rear + front) / 2, b - a, roof - section.plinthTop, front - rear, c.terra);
  box(out, 'walls', 13.75, section.plinthTop, -3.63, 5.76, roof - section.plinthTop, 15.1, c.terraDark);
  box(out, 'walls', 7.61, section.plinthTop, 6.31, 7.94, roof - section.plinthTop, 2.18, c.terra);
  const [lo, hi, z] = section.arcade;
  for (const [floor, top] of [[y, f], [f, roof]]) {
    const radius = z + 0.46;
    cornice(out, [lo - 0.46, hi + 0.28, front - 0.05, radius], floor - 0.16, lod);
    arcade(out, lo, hi, z, floor + 0.14, top - 0.27, 3, lod, 0.64);
    if (lod) parapet(out, lo, hi, floor + 0.19, z + 0.34, Math.min(lod, 2));
    for (let i = 0; i < 3; i++) opening(out, lo + (hi - lo) * (i + 0.5) / 3, floor + 0.46, front + 0.014, 1.46, 2.81, 1, lod);
    opening(out, 7.72, floor + 0.29, 7.46, 2.64, 3.06, 1, lod, floor === y ? c.door : c.window);
    opening(out, 13.82, floor + 0.82, 3.96, 1.63, 2.47, 1, lod);
    if (lod) {
      cornice(out, [5.12, 10.51, 7.24, 8.54], top - 0.49, lod);
      for (const x of [5.33, 10.29]) piers(out, x, 8.14, floor + 0.06, top - 0.50, 0.61, lod);
    }
  }
  cornice(out, [a, 16.65, rear, front], roof - 0.35, lod);
  cornice(out, [5.02, 10.63, 7.20, 9.48], f - 0.46, lod);
  if (lod) {
    parapet(out, -1.71, 3.19, roof + 0.04, 6.82, lod);
    parapet(out, 12.43, 16.43, roof + 0.03, 4.67, lod);
    parapet(out, -7.68, 12.96, roof + 0.03, -8.25, Math.min(lod, 2));
  }
  for (const [i, x] of [-6.73, -2.66, 1.02, 4.34, 8.62, 12.01].entries()) {
    if (lod || i % 2 === 1) {
      opening(out, x, y + 0.40, rear - 0.012, i === 3 ? 2.75 : 1.53, i === 3 ? 3.56 : 2.71, -1, lod,
        i === 3 ? c.door : c.window);
      opening(out, x, f + 0.38, rear - 0.012, i === 3 ? 2.19 : 1.43, 2.82, -1, lod);
    }
  }
  if (lod >= 2) {
    for (const x of [-8.28, -4.74, -0.86, 2.82, 5.98, 10.47, 12.81]) {
      piers(out, x, rear - 0.15, y, f - 0.25, 0.44, lod);
      piers(out, x, rear - 0.15, f, roof - 0.40, 0.42, lod);
    }
  }
}

function steppedProfile(out, center, profile, segments, color) {
  loft(out, 'trim', profile.map(([y, r]) => radialRing(y, r, r, segments, center, Math.PI / 8)), color);
}

function pinnacle(out, x, z, y, height, radius, lod) {
  if (!lod) {
    const roof = [[y, radius], [y + height, radius * 0.22]];
    steppedProfile(out, [x, z], roof, 5, c.crown);
    return;
  }
  const profile = lod === 1 ? [[0, 1], [0.17, 1.03], [0.65, 0.46], [1, 0.11]] :
    [[0, 1.0], [0.15, 1.06], [0.27, 0.91], [0.56, 0.62], [0.72, 0.28], [0.87, 0.30], [1, 0.11]];
  steppedProfile(out, [x, z], profile.map(([t, r]) => [y + t * height, r * radius]), lod >= 2 ? 10 : 6, c.crown);
}

function pavilion(out, lod) {
  const { bounds: [a, b, back, front], roofDeck: y, cornice: roof, pinnacleTop } = section.gardenPavilion;
  cornice(out, [a - 0.16, b + 0.16, back - 0.15, front + 0.16], y - 0.53, lod);
  box(out, 'roof', (a + b) / 2, y - 0.34, (back + front) / 2, b - a, 0.28, front - back, c.roof);
  for (const z of [back + 0.13, front - 0.12]) arcade(out, a + 0.31, b - 0.33, z, y - 0.15, roof - 0.58, 3, lod, 0.55);
  cornice(out, [a, b, back, front], roof - 0.56, lod);
  box(out, 'roof', (a + b) / 2, roof - 0.35, (back + front) / 2, b - a + 0.21, 0.37, front - back + 0.19, c.roof);
  for (const x of [a + 0.34, b - 0.34]) {
    for (const z of [back + 0.42, front - 0.43]) pinnacle(out, x, z, roof - 0.22, pinnacleTop - roof + 0.22, 0.83, lod);
  }
  if (!lod) return;
  parapet(out, a + 0.31, b - 0.34, y + 0.03, front - 0.10, lod);
  for (let x = a + 1.10; x < b - 0.65; x += lod >= 2 ? 0.63 : 1.27) {
    pinnacle(out, x, front - 0.04, roof - 0.02, 0.51, 0.23, lod === 3 ? 1 : 0);
  }
  if (lod >= 2) {
    for (let x = a + 0.40; x < b - 0.2; x += 0.90) {
      beam(out, 'trim', [x, y - 1.80, front - 0.40], [x, y - 0.42, front + 0.15], 0.35, 0.37, c.relief);
    }
  }
}

function dome(out, lod) {
  const { center, radius, drumTop, height } = section.dome;
  const profile = lod ? [[12.16, 0.95], [12.64, 1.12], [13.05, 1.00], [15.57, 0.87], [drumTop, 1.00],
    [16.51, 1.06], [17.43, 1.00], [18.52, 0.75], [19.36, 0.41], [19.74, 0.18]] :
    [[12.16, 0.95], [drumTop, 1.0], [17.25, 1.02], [18.91, 0.63], [19.74, 0.18]];
  const sides = [7, 10, 16, 24][lod];
  steppedProfile(out, center, profile.map(([y, r]) => [y, r * radius]), sides, c.crown);
  pinnacle(out, ...center, 19.72, height - 19.72, 0.52, lod);
  if (lod >= 2) {
    const [cx, cz] = center;
    for (let i = 0; i < (lod === 3 ? 20 : 12); i++) {
      const angle = i * circle / (lod === 3 ? 20 : 12);
      const radial = (y, r) => [cx + r * radius * Math.cos(angle), y, cz + r * radius * Math.sin(angle)];
      beam(out, 'trim', radial(13.04, 0.978), radial(15.76, 0.932), 0.15, 0.15, c.mold);
    }
  }
}

function tower(out, lod) {
  const { center, radius, galleryTop, height } = section.tower;
  const [x, z] = center, sides = [7, 10, 16, 24][lod];
  const base = !lod ? [[section.plinthTop, radius], [galleryTop, radius * 0.84]] :
    lod === 1 ? [[section.plinthTop, radius], [6.55, radius], [7.02, radius * 0.90],
      [12.21, radius * 0.96], [12.89, radius * 0.84], [galleryTop, radius * 0.93]] :
    [[section.plinthTop, radius], [2.40, radius], [2.57, radius * 0.94], [6.02, radius * 0.94],
      [6.29, radius], [6.64, radius], [7.02, radius * 0.90], [11.72, radius * 0.90],
      [12.10, radius * 0.96], [12.50, radius * 0.96], [12.89, radius * 0.84],
      [16.96, radius * 0.84], [galleryTop, radius * 0.93]];
  loft(out, 'walls', base.map(([y, r]) => radialRing(y, r, r, sides, center, Math.PI / 8)), c.terra);
  const spire = lod <= 1 ? [[galleryTop, 1], [20.01, 0.91], [25.96, 0.63], [29.20, 0.29], [30.25, 0.48],
    [31.31, 0.35], [32.12, 0.20], [height, 0.035]] :
    [[galleryTop, 1], [18.2, 1.02], [20.01, 0.93], [22.1, 0.84], [24.31, 0.73], [26.36, 0.63],
      [28.65, 0.42], [29.20, 0.32], [29.61, 0.36], [30.1, 0.52], [30.62, 0.53], [31.05, 0.48],
      [31.40, 0.31], [31.84, 0.25], [32.11, 0.33], [32.49, 0.31], [32.77, 0.19], [33.25, 0.17], [height, 0.035]];
  steppedProfile(out, center, spire.map(([y, r]) => [y, r * radius]), sides, c.pink);
  if (lod) {
    const count = lod === 3 ? 16 : lod === 2 ? 12 : 6;
    for (let i = 0; i < count; i++) {
      const angle = Math.PI / 8 + i * circle / count;
      const radial = (y, r, d = 0) => [x + (r * radius + d) * Math.cos(angle), y, z + (r * radius + d) * Math.sin(angle)];
      const spine = lod === 1 ? [[17.55, 0.99], [20.01, 0.93], [24.31, 0.73], [28.65, 0.42], [29.20, 0.32]] :
        spire.slice(0, 8);
      beamPath(out, 'trim', spine.map(([y, r]) => radial(y, r, 0.047)), lod === 3 ? 0.16 : 0.20, 0.14, c.relief);
      if (lod >= 2) {
        for (const y of [19.10, 20.86, 22.61, 24.30, 26.14, 27.71]) {
          const k = spire.findIndex(([h]) => h >= y);
          const [lo, a] = spire[k - 1], [hi, b] = spire[k];
          const r = a + (b - a) * (y - lo) / (hi - lo);
          const [cx, cy, cz] = radial(y, r, 0.092);
          box(out, 'trim', cx, cy, cz, 0.29, 0.34, 0.29, c.crown);
        }
        if (i % (count / 4) === 0) {
          const [cx, , cz] = radial(22.42, 0.86, 0.16);
          pinnacle(out, cx, cz, 20.65, 2.10, 0.43, lod);
        }
      }
    }
    for (const [cy, r] of [[7.31, 0.88], [12.78, 0.83]]) {
      for (const side of [-1, 1]) opening(out, x, cy, z + side * radius * r, 1.18, 2.03, side, lod);
    }
  }
  if (lod >= 2) {
    for (let i = 0; i < 12; i++) {
      const angle = circle * i / 12;
      const radial = (y, r) => [x + r * radius * Math.cos(angle), y, z + r * radius * Math.sin(angle)];
      beamPath(out, 'trim', [radial(29.65, 0.37), radial(30.13, 0.54), radial(30.62, 0.55),
        radial(31.09, 0.49), radial(31.4, 0.32)], 0.096, 0.105, c.relief);
    }
  }
}

function build(out, lod) {
  basement(out, lod);
  gardenBody(out, lod);
  tower(out, lod);
  dome(out, lod);
  pavilion(out, lod);
}

export const palaceSkyline = (out) => build(out, 0);
export const palaceDistrict = (out) => build(out, 1);
export const palaceStreet = (out) => build(out, 2);
export const palaceCloseup = (out) => build(out, 3);

const recipe = 'baron-empain-palace-model.mjs';
const camera = [39, 34, 73], lookAt = [-1.8, 12.6, 1.7];
const authoredLevels = Object.fromEntries([
  ['district', 'palaceDistrict', 0.36], ['street', 'palaceStreet', 0.16], ['closeup', 'palaceCloseup', 0.060],
].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]));

export const palaceModel = {
  id: plan.model, key: plan.model, title: plan.title, cell: plan.cell, wikidataId: plan.wikidataId,
  recipe, surfaces, build: palaceCloseup, category: 'palace', quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json', geographicStatus: 'historical-proposal', orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief: 'The restored Heliopolis palace with a high tapered tower, lower dome, deep arcades, warm carved exterior and ornamental rooftop pavilion.',
  appearance: { kind: 'historical', representedDate: plan.representedDate, validFrom: plan.validFrom, validUntil: plan.validUntil, currentWorldEligible: false },
  camera, lookAt,
  buildingCutout: { outline, minimumCoverage: 0.90, basis: 'Named palace envelope, OpenStreetMap way 24886453.' },
  mediumFiContext: { scale: 0.89, groundY: 0, terrain: { descriptor: 'terrain-ground-review.terrain.json', heightmap: 'terrain-ground-review.height.png' } },
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_sandstone', 'stone_sandstone_raw', 'concrete_plain'],
  qaCameras: [
    { name: 'restored-garden-elevation-and-spire', position: [2.4, 18.2, 72], lookAt: [-0.6, 14.6, 1.6] },
    { name: 'carved-galleries-dome-and-roof-pavilion', position: [22, 19.8, 32], lookAt: [1.4, 12.5, 6.1] },
    { name: 'northwest-entrances-and-tower', position: [31, 21, -53], lookAt: [-1.3, 11.3, -3.7] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-baron-empain-palace-${reviewLod}`, position: camera, lookAt, reviewLod,
  })),
  runtimeLodOverlay: { module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline', export: 'palaceSkyline', errorMeters: 0.78, surfaces, authoredLevels },
  limitations: plan.limitations,
  sourceLicense: 'Original geometry under the repository license, OpenStreetMap ODbL 1.0, one exact CC0 Qualla photo and GEDTM30 elevation data under CC BY 4.0.',
};
