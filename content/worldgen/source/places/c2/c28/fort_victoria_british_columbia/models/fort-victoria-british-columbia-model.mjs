/** Fort Victoria before the December 1860 dismantling. Dimensions are in metres. */
import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { transform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const load = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = load('plan-controls');
const section = plan.section;
const grid = load('terrain-grid');
const { corners, gates, bastions, bell, buildings, well, yardSlope, stockadeHeight, gateWidth } =
  section;
const surfaces = {
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.92, metallic: 0 },
  logs: { slot: 'wall', graph: 'wood_log', roughness: 0.93, metallic: 0 },
  stockade: { slot: 'wall', graph: 'wood_board_batten', roughness: 0.94, metallic: 0 },
  board: { slot: 'wall', graph: 'wood_weatherboard', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', graph: 'shingle_cedar', roughness: 0.94, metallic: 0 },
  solid: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.95, metallic: 0 },
};
const palette = Object.fromEntries(
  Object.entries({
    pine: '866f52',
    palePine: 'a38b68',
    pineDeep: '6a5b47',
    rough: '867055',
    cedar: 'a08b69',
    cedarPale: 'a48a69',
    cedarDark: '85755d',
    cedarGrey: '93846f',
    edge: 'b5a386',
    white: 'dfdace',
    warmWhite: 'd7cdb8',
    trim: 'e2dac7',
    window: '565e5b',
    shutter: '6d6558',
    rail: '9c8c73',
    dark: '393c35',
    iron: '4f4d42',
    yard: 'a99c81',
    stone: '7e8174',
    brick: '88746a',
    roofBrown: '6d6556',
    roofWarm: '847d68',
    roofGrey: '707671',
  }).map(([key, hex]) => [key, rgb(hex)]),
);
const up = [0, 1, 0];
const xy = ([x, z], y) => [x, y, z];
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const midpoint = (a, b) => lerp(a, b, 0.5);
const yardGrade = ([x, z]) => x * yardSlope[0] + z * yardSlope[1] + 0.03;
const perimeter = (points) => {
  const [x, , z] = points.reduce(([x, , z], p) => [x + p[0], 0, z + p[2]], [0, 0, 0]);
  return [x, 0, z];
};

function face(out, slot, points, look, color) {
  let normal = normalFor(...points);
  if (look && normal.reduce((sum, v, i) => sum + v * look[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, color);
  else
    out.addTriangle(
      slot,
      'palette:#ffffff',
      points,
      normal,
      points.map(([x, , z]) => [x, z]),
      color,
    );
}

function sampleTerrain([x, z]) {
  const u = (x - grid.origin[0]) / grid.stepMeters,
    v = (z - grid.origin[1]) / grid.stepMeters;
  const ix = Math.floor(u),
    iz = Math.floor(v);
  const a = grid.heightsMeters[iz],
    b = grid.heightsMeters[iz + 1];
  const ux = u - ix,
    vz = v - iz;
  const low = a[ix] + (a[ix + 1] - a[ix]) * ux;
  const high = b[ix] + (b[ix + 1] - b[ix]) * ux;
  return low + (high - low) * vz - grid.modelDatumElevationMeters;
}
const footing = (p) => Math.min(yardGrade(p) - 0.38, sampleTerrain(p) - 0.18);
const finalGrade = (p) => Math.max(yardGrade(p), sampleTerrain(p) - 0.2);

function paths(out, lod) {
  const [a, b] = gates;
  const [x0, z] = a;
  const count = [6, 12, 18, 26][lod];
  for (let i = 0; i < count; i++) {
    const start = x0 + ((b[0] - x0) * i) / count;
    const end = x0 + ((b[0] - x0) * (i + 1)) / count;
    const points = [
      [start, z - 2.73],
      [end, z - 2.73],
      [end, z + 2.73],
      [start, z + 2.73],
    ];
    face(
      out,
      'solid',
      points.map((p) => xy(p, sampleTerrain(p) + 0.06)),
      up,
      palette.yard,
    );
  }
  if (lod < 2) return;
  const [x, wz] = well.center;
  const route = [
    [x - 0.62, z + 2.65],
    [x + 0.62, z + 2.65],
    [x + 0.62, wz],
    [x - 0.62, wz],
  ];
  face(
    out,
    'solid',
    route.map((p) => xy(p, sampleTerrain(p) + 0.075)),
    up,
    palette.yard,
  );
}

function edgeFrame(a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const axis = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
  const left = [-axis[1], axis[0]];
  const at = (t, offset = 0) => [
    a[0] + axis[0] * t + left[0] * offset,
    a[1] + axis[1] * t + left[1] * offset,
  ];
  return { length, axis, left, at };
}

function palisadeRun(out, a, b, lod, sectionId) {
  const { length, axis, left, at } = edgeFrame(a, b);
  const count = Math.ceil(length / (lod === 3 ? 0.31 : lod === 2 ? 1.3 : lod === 1 ? 4.6 : 30));
  for (let i = 0; i < count; i++) {
    const start = (length * i) / count,
      end = (length * (i + 1)) / count;
    const center = at((start + end) / 2);
    const step = stockadeHeight + (lod >= 2 ? ((((i + sectionId * 3) * 19) % 17) - 8) * 0.014 : 0);
    if (lod < 2) {
      const base = [at(start), at(end)].map((p) => xy(p, footing(p)));
      const cover = [at(start), at(end)].map((p) => xy(p, yardGrade(p) + step));
      const panel = [base[0], base[1], cover[1], cover[0]];
      face(
        out,
        'stockade',
        panel,
        [left[0], 0, left[1]],
        i % 3 === 2 ? palette.cedarGrey : palette.cedar,
      );
      face(out, 'stockade', panel, [-left[0], 0, -left[1]], palette.cedar);
      continue;
    }
    const depth = lod === 3 ? 0.16 : 0.18;
    const points = [at(start, -depth), at(end, -depth), at(end, depth), at(start, depth)];
    const base = points.map((p) => xy(p, footing(p)));
    const shoulder = points.map((p) => xy(p, yardGrade(p) + step - (lod === 3 ? 0.28 : 0.21)));
    const tip = xy(center, yardGrade(center) + step + 0.018);
    const shades = [palette.cedar, palette.cedarGrey, palette.cedarPale, palette.cedarDark];
    const color = shades[(i * 17 + sectionId * 3) % shades.length];
    for (const j of [0, 2]) {
      const k = (j + 1) % 4;
      const sign = j === 0 ? -1 : 1;
      face(
        out,
        'stockade',
        [base[j], base[k], shoulder[k], shoulder[j]],
        [left[0] * sign, 0, left[1] * sign],
        color,
      );
      face(out, 'timber', [shoulder[j], shoulder[k], tip], up, palette.edge);
    }
    if (i === 0 || i === count - 1 || (lod === 3 && i % 9 === 0)) {
      const j = i === 0 ? 3 : 1,
        k = (j + 1) % 4;
      const sign = j === 1 ? 1 : -1;
      face(
        out,
        'stockade',
        [base[j], base[k], shoulder[k], shoulder[j]],
        [axis[0] * sign, 0, axis[1] * sign],
        palette.cedarDark,
      );
      face(out, 'timber', [shoulder[j], shoulder[k], tip], up, palette.cedar);
    }
  }
  if (!lod) return;
  for (const bar of lod === 1 ? [2.1] : [1.66, 3.95]) {
    const first = at(0.05, -0.19),
      last = at(length - 0.05, -0.19);
    beam(
      out,
      'timber',
      xy(first, yardGrade(first) + bar),
      xy(last, yardGrade(last) + bar),
      0.19,
      0.23,
      palette.rough,
    );
  }
  const posts = Math.max(1, Math.floor(length / (lod === 1 ? 14 : 7.7)));
  for (let i = 0; i < posts; i++) {
    const p = at((length * (i + 0.5)) / posts, -0.12);
    const low = footing(p),
      top = yardGrade(p) + stockadeHeight + 0.24;
    box(out, 'timber', p[0], low, p[1], 0.49, top - low, 0.49, palette.rough);
  }
}

function portal(out, center, direction, lod) {
  const grade = finalGrade(center);
  const [x, z] = center;
  const frame = transform(out, Math.PI * 0.5, [x, grade, z]);
  const w = gateWidth / 2;
  for (const side of [-1, 1]) {
    const y = footing([x, z + side * w]) - grade;
    box(frame, 'timber', side * w, y, 0, 0.53, 5.47 - y, 0.55, palette.pineDeep);
    const inner = side * (w - 0.22);
    const far = side * (w - 1.43);
    const swing = direction * 1.27;
    const panel = [
      [inner, 0.12, 0],
      [far, 0.12, swing],
      [far, 3.05, swing],
      [inner, 3.47, 0],
    ];
    face(frame, 'stockade', panel, [0, 0, -direction], palette.cedar);
    face(frame, 'stockade', panel, [0, 0, direction], palette.cedarDark);
    if (lod) {
      beam(
        frame,
        'timber',
        [inner, 0.36, direction * 0.035],
        [far, 0.42, swing],
        0.17,
        0.17,
        palette.rough,
      );
      beam(
        frame,
        'timber',
        [inner, 2.84, direction * 0.035],
        [far, 0.47, swing],
        0.14,
        0.15,
        palette.rough,
      );
      const n = lod > 1 ? 6 : 3;
      for (let i = 0; i < n; i++) {
        const k = (i + 0.45) / n;
        const xp = inner + (far - inner) * k,
          zp = swing * k;
        beam(
          frame,
          'timber',
          [xp, 0.16, zp],
          [xp, 3.47 - 0.42 * k, zp],
          0.08,
          0.08,
          palette.cedarPale,
        );
      }
    }
  }
  box(frame, 'timber', 0, 5.02, 0, gateWidth + 0.56, 0.36, 0.48, palette.pineDeep);
  if (lod >= 2) box(frame, 'timber', 0, 4.36, 0.04, gateWidth + 0.12, 0.18, 0.28, palette.rough);
}

function stockade(out, lod) {
  const [nw, ne, se, sw] = corners;
  const [west, east] = gates;
  const stop = ([x, z], offset) => [x, z + offset];
  const endNear = (a, b) => lerp(a, b, Math.min(0.45, 2.5 / Math.hypot(b[0] - a[0], b[1] - a[1])));
  const segments = [
    [nw, endNear(ne, nw)],
    [endNear(ne, se), stop(east, -gateWidth / 2)],
    [stop(east, gateWidth / 2), se],
    [se, endNear(sw, se)],
    [endNear(sw, nw), stop(west, gateWidth / 2)],
    [stop(west, -gateWidth / 2), nw],
  ];
  segments.forEach(([a, b], i) => palisadeRun(out, a, b, lod, i));
  portal(out, west, 1, lod);
  portal(out, east, -1, lod);
}

function octagon(radius, y, angle = Math.PI / 8) {
  return Array.from({ length: 8 }, (_, i) => {
    const t = (i * Math.PI) / 4 + angle;
    return [Math.cos(t) * radius, y, Math.sin(t) * radius];
  });
}
function polygon(out, slot, ring, look, color) {
  const center = ring.reduce((acc, p) => acc.map((v, i) => v + p[i] / ring.length), [0, 0, 0]);
  for (let i = 0; i < ring.length; i++)
    face(out, slot, [ring[i], ring[(i + 1) % ring.length], center], look, color);
}
function paneledOctagon(out, lower, y, slot, color, lod, portY) {
  const upper = lower.map(([x, , z]) => [x, y, z]);
  for (let i = 0; i < lower.length; i++) {
    const j = (i + 1) % lower.length;
    const [a, b, c, d] = [lower[i], lower[j], upper[j], upper[i]];
    const normal = perimeter([a, b, c, d]);
    const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (portY === null || (!lod && i % 2)) {
      face(out, slot, [a, b, c, d], normal, color);
      continue;
    }
    const v = (t, h) => {
      const p = lerp(a, b, t);
      return [p[0], h, p[2]];
    };
    const margin = 0.53 / length;
    const left = 0.5 - margin,
      right = 0.5 + margin;
    const low = portY - 0.36,
      high = portY + 0.36;
    for (const [u0, u1, y0, y1] of [
      [0, 1, a[1], low],
      [0, left, low, high],
      [right, 1, low, high],
      [0, 1, high, y],
    ]) {
      face(out, slot, [v(u0, y0), v(u1, y0), v(u1, y1), v(u0, y1)], normal, color);
    }
    const inner = (p) => [p[0] * 0.934, p[1], p[2] * 0.934];
    const opening = [v(left, low), v(right, low), v(right, high), v(left, high)];
    face(out, 'solid', opening.map(inner), normal, palette.dark);
    if (lod >= 2) {
      for (let k = 0; k < 4; k++) {
        const u = opening[k],
          v = opening[(k + 1) % 4];
        beam(out, 'timber', u, v, 0.17, 0.18, palette.palePine);
        face(out, 'timber', [u, v, inner(v), inner(u)], null, palette.pineDeep);
      }
      if (lod >= 2 && i % 3 === 0) {
        const start = inner(v(0.5, portY - 0.115));
        const end = [start[0] * 1.27, start[1] + 0.05, start[2] * 1.27];
        beam(out, 'solid', start, end, 0.16, 0.17, palette.iron);
      }
    }
  }
}
function bastion(out, part, lod) {
  const [x, z] = part.center;
  const baseY = finalGrade(part.center);
  const local = transform(out, 0, [x, baseY, z]);
  const start = footing(part.center) - baseY - 0.32;
  const base = octagon(part.baseRadius, start);
  paneledOctagon(
    local,
    base,
    part.gunFloor + 0.12,
    'logs',
    palette.pine,
    lod,
    part.gunFloor - 1.17,
  );
  const hang = octagon(part.gunRadius, part.gunFloor);
  polygon(local, 'timber', hang, [0, -1, 0], palette.pineDeep);
  paneledOctagon(local, hang, part.gunEave, 'board', palette.palePine, lod, part.gunFloor + 1.48);
  const eave = octagon(part.gunRadius + 0.3, part.gunEave);
  const tip = [0, part.ridge, 0];
  for (let i = 0; i < eave.length; i++) {
    const j = (i + 1) % eave.length;
    face(local, 'roof', [eave[i], eave[j], tip], up, palette[part.roofTone]);
    if (lod) {
      const q = eave[i].map((v, k) => (k === 1 ? v - 0.1 : v));
      beam(
        local,
        'timber',
        q,
        eave[j].map((v, k) => (k === 1 ? v - 0.1 : v)),
        0.19,
        0.18,
        palette.pineDeep,
      );
    }
    if (lod >= 2) {
      beam(local, 'roof', eave[i], tip, 0.125, 0.105, palette.roofGrey);
      const inner = base[i];
      beam(
        local,
        'timber',
        [inner[0], part.gunFloor - 1.0, inner[2]],
        [hang[i][0] * 0.96, part.gunFloor, hang[i][2] * 0.96],
        0.22,
        0.24,
        palette.pineDeep,
      );
      beam(
        local,
        'timber',
        hang[i],
        [hang[i][0], part.gunEave, hang[i][2]],
        0.19,
        0.19,
        palette.palePine,
      );
    }
  }
  if (lod >= 2) beam(local, 'timber', tip, [0, part.ridge + 0.23, 0], 0.16, 0.16, palette.pineDeep);
}

function roof(out, width, depth, y, rise, variant, color, lod) {
  const w = width / 2,
    d = depth / 2;
  const faces = [
    [-w, y, -d],
    [w, y, -d],
    [w, y, d],
    [-w, y, d],
  ];
  const ridge = Math.max(0.05, w - d * (variant === 'gable' ? 0 : 0.78));
  const a = [-ridge, y + rise, 0],
    b = [ridge, y + rise, 0];
  face(out, 'roof', [faces[0], faces[1], b, a], up, color);
  face(out, 'roof', [faces[3], a, b, faces[2]], up, color);
  if (variant === 'gable') {
    const sectionLeft = [-w + 0.17, y + rise - 0.11, 0],
      sectionRight = [w - 0.17, y + rise - 0.11, 0];
    face(
      out,
      'board',
      [[sectionLeft[0], y, -d + 0.15], [sectionLeft[0], y, d - 0.15], sectionLeft],
      [-1, 0, 0],
      palette.pine,
    );
    face(
      out,
      'board',
      [[sectionRight[0], y, -d + 0.15], [sectionRight[0], y, d - 0.15], sectionRight],
      [1, 0, 0],
      palette.pine,
    );
  } else {
    face(out, 'roof', [faces[0], a, faces[3]], up, color);
    face(out, 'roof', [faces[1], faces[2], b], up, color);
  }
  if (lod) {
    beam(out, 'roof', a, b, 0.125, 0.17, color);
    for (const side of [-d, d])
      box(out, 'timber', 0, y - 0.14, side, width, 0.17, 0.14, palette.rough);
    if (lod >= 2 && variant !== 'gable') {
      for (const [i, p] of faces.entries())
        beam(out, 'roof', p, i === 0 || i === 3 ? a : b, 0.11, 0.11, color);
    }
  }
}

function window(out, x, y, z, width, height, facing, light, lod) {
  const n = [0, 0, facing];
  const loc = ([px, py]) => [x + px, y + py, z];
  const w = width / 2;
  const rim = light ? palette.trim : palette.palePine;
  face(
    out,
    'timber',
    [
      [-w - 0.09, -0.08],
      [w + 0.09, -0.08],
      [w + 0.09, height + 0.08],
      [-w - 0.09, height + 0.08],
    ].map(loc),
    n,
    rim,
  );
  const glazing = ([px, py]) => [x + px, y + py, z + facing * 0.026];
  face(
    out,
    'solid',
    [
      [-w, 0],
      [w, 0],
      [w, height],
      [-w, height],
    ].map(glazing),
    n,
    palette.window,
  );
  if (lod < 2) return;
  const fz = z + facing * 0.061;
  box(out, 'timber', x, y - 0.105, fz, width + 0.26, 0.105, 0.13, rim);
  box(out, 'timber', x, y + 0.02, fz, 0.075, height - 0.04, 0.058, rim);
  box(out, 'timber', x, y + height * 0.51, fz, width, 0.062, 0.063, rim);
  if (lod === 3 && light) {
    const panel = ([px, py]) => [x + px, y + py, fz + facing * 0.031];
    const glassPatch = [
      [-w + 0.09, height * 0.64],
      [-w + 0.27, height * 0.8],
      [-w + 0.27, height * 0.91],
      [-w + 0.09, height * 0.78],
    ].map(panel);
    face(out, 'solid', glassPatch, n, rgb('777d72'));
  }
}
function stairs(out, x, z, grade, floor, paletteColor, lod) {
  const height = Math.max(0.1, floor - grade);
  const run = Math.max(0.85, height * 1.68);
  const steps = lod >= 2 ? Math.max(3, Math.ceil(height / 0.21)) : 2;
  for (let i = 0; i < steps; i++) {
    const length = run * (1 - i / steps);
    box(
      out,
      'timber',
      x,
      grade + (height * i) / steps,
      z + length / 2,
      1.35,
      height / steps + 0.025,
      length,
      paletteColor,
    );
  }
}
function porch(out, width, d, foot, wall, lod) {
  const p = 1.85;
  const posts = lod >= 2 ? 6 : 4;
  const eave = wall * 0.64;
  box(out, 'timber', 0, -0.19, d + p / 2, width, 0.24, p + 0.14, palette.rough);
  face(
    out,
    'roof',
    [
      [-width / 2 - 0.22, eave + 0.36, d],
      [width / 2 + 0.22, eave + 0.36, d],
      [width / 2 + 0.22, eave - 0.13, d + p + 0.18],
      [-width / 2 - 0.22, eave - 0.13, d + p + 0.18],
    ],
    up,
    palette.roofGrey,
  );
  if (!lod) return;
  for (let i = 0; i < posts; i++) {
    const x = -width / 2 + 0.33 + (i * (width - 0.66)) / (posts - 1);
    box(out, 'timber', x, 0, d + p, 0.13, eave, 0.14, palette.trim);
    box(out, 'timber', x, foot, d + p, 0.25, -foot, 0.21, palette.rough);
  }
  stairs(out, 0, d + p, foot + 0.15, 0, palette.rough, lod);
  if (lod < 2) return;
  for (const sign of [-1, 1]) {
    const rail = (a, b, y) =>
      beam(out, 'timber', [sign * a, y, d + p], [sign * b, y, d + p], 0.11, 0.12, palette.trim);
    rail(1.06, width / 2 - 0.28, 0.77);
    rail(1.06, width / 2 - 0.28, 0.13);
    for (let offset = 1.15; offset < width / 2 - 0.2; offset += lod === 3 ? 0.64 : 1.15) {
      box(out, 'timber', sign * offset, 0.13, d + p, 0.06, 0.63, 0.063, palette.trim);
    }
  }
}
function yardBuilding(out, record, lod) {
  const { center, width, depth, turn, wall, rise, floor, kind, windows, chimneys } = record;
  const base = finalGrade(center);
  const low = footing(center) - 0.47;
  const height = base + floor;
  const [x, z] = center;
  const angle = turn ? (x > 0 ? -Math.PI / 2 : Math.PI / 2) : z > 0 ? Math.PI : 0;
  const rotated = transform(out, angle, [x, height, z]);
  const light = kind === 'white' || kind === 'porch';
  const trim = light ? palette.trim : palette.rough;
  const color = light ? (windows % 2 === 0 ? palette.warmWhite : palette.white) : palette.pine;
  const slot = light ? 'board' : 'logs';
  const d = depth / 2,
    e = width / 2;
  box(rotated, slot, 0, 0, 0, width, wall, depth, color);
  if (!lod) {
    box(
      rotated,
      'timber',
      0,
      low - height,
      0,
      width * 0.78,
      height - low - 0.03,
      depth * 0.8,
      palette.pineDeep,
    );
  } else {
    const rows = lod >= 2 ? 4 : 2;
    for (let i = 0; i < rows; i++) {
      const cx = (i / (rows - 1) - 0.5) * (width - 0.66);
      for (const zz of [-d + 0.31, d - 0.31]) {
        box(
          rotated,
          'timber',
          cx,
          low - height,
          zz,
          0.38,
          height - low + 0.08,
          0.37,
          palette.pineDeep,
        );
      }
    }
    if (lod >= 2) {
      for (const side of [-1, 1]) {
        const ax = side * (e - 0.055);
        for (const end of [-1, 1]) {
          box(rotated, 'timber', ax, 0, end * (d + 0.034), 0.14, wall, 0.106, trim);
        }
      }
    }
  }
  const porchHere = kind === 'porch';
  if (porchHere) porch(rotated, width - 0.2, d, low - height, wall, lod);
  const roofSlot = palette[record.roof];
  roof(rotated, width + 0.49, depth + 0.53, wall, rise, kind, roofSlot, lod);
  if (chimneys) {
    for (let i = 0; i < chimneys; i++) {
      const cx = chimneys === 1 ? e * 0.56 : (i * 2 - 1) * e * 0.47;
      box(rotated, 'solid', cx, wall + rise * 0.56, 0.56, 0.52, rise * 0.63, 0.55, palette.brick);
      if (lod >= 2)
        box(rotated, 'solid', cx, wall + rise * 1.18, 0.56, 0.61, 0.17, 0.63, palette.stone);
    }
  }
  if (!lod) return;
  for (const side of [-1, 1]) {
    const n = lod === 1 ? Math.min(3, windows) : windows;
    for (let i = 0; i < n; i++) {
      const px = (i / (n - 1) - 0.5) * (width - 2.7);
      if (i === (n - 1) / 2 && side === 1) continue;
      const floor = light ? 1.18 : 1.62;
      const size = light ? 1.25 : 1.03;
      window(rotated, px, floor, side * (d + 0.026), light ? 0.75 : 0.56, size, side, light, lod);
      if (lod === 3 && wall > 4.05 && light)
        window(rotated, px, 3.22, side * (d + 0.026), 0.48, 0.56, side, light, 1);
    }
  }
  box(
    rotated,
    'timber',
    0,
    0.02,
    d + 0.075,
    light ? 1.04 : 2.05,
    light ? 2.23 : 2.62,
    0.105,
    light ? palette.shutter : palette.pineDeep,
  );
  if (lod >= 2) {
    box(rotated, 'timber', 0, light ? 2.24 : 2.6, d + 0.067, light ? 1.23 : 2.32, 0.17, 0.15, trim);
    if (!porchHere && floor > 0.42)
      stairs(rotated, 0, d, low - height + 0.17, 0, palette.rough, lod);
    if (light)
      window(
        transform(rotated, Math.PI * 0.5, [e + 0.029, 0, 0]),
        0,
        1.25,
        0,
        0.69,
        1.17,
        1,
        true,
        lod,
      );
  }
}

function bellTower(out, lod) {
  const [x, z] = bell.center;
  const base = finalGrade(bell.center);
  const tower = transform(out, 0, [x, base, z]);
  const half = bell.base / 2,
    small = 1.49;
  const low = footing(bell.center) - base - 0.21;
  const square = (w, y) => [
    [-w, y, -w],
    [w, y, -w],
    [w, y, w],
    [-w, y, w],
  ];
  const feet = square(half, low),
    deck = square(small, bell.platform),
    eaves = square(small, bell.eaves);
  const braces = square(half * 0.58, bell.base);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    beam(tower, 'timber', feet[i], deck[i], 0.31, 0.33, palette.rough);
    beam(tower, 'timber', deck[i], eaves[i], 0.25, 0.27, palette.palePine);
    if (!lod) continue;
    beam(tower, 'timber', feet[i], deck[j], 0.19, 0.23, palette.rough);
    beam(tower, 'timber', braces[j], braces[i], 0.24, 0.26, palette.cedar);
    if (lod >= 2) {
      const nudge = deck[j].map((v, k) => (k === 1 ? v + 0.035 : v * 0.973));
      beam(tower, 'timber', feet[j], deck[i], 0.19, 0.21, palette.pineDeep);
      beam(tower, 'timber', nudge, lerp(deck[j], eaves[j], 0.72), 0.12, 0.13, palette.cedar);
      beam(
        tower,
        'timber',
        lerp(deck[i], eaves[i], 0.31),
        lerp(deck[j], eaves[j], 0.31),
        0.12,
        0.14,
        palette.rail,
      );
    }
  }
  box(
    tower,
    'timber',
    0,
    bell.platform - 0.16,
    0,
    small * 2 + 0.2,
    0.22,
    small * 2 + 0.2,
    palette.pineDeep,
  );
  box(tower, 'timber', 0, bell.crossbar, 0, small * 2, 0.19, 0.22, palette.pineDeep);
  beam(
    tower,
    'solid',
    [0, bell.crossbar - 0.08, 0],
    [0, bell.crossbar - 0.88, 0],
    0.47,
    0.47,
    palette.iron,
  );
  if (lod >= 2) {
    box(tower, 'solid', 0, bell.crossbar - 1.02, 0, 0.65, 0.17, 0.66, palette.iron);
    beam(
      tower,
      'timber',
      [-0.88, bell.crossbar - 0.18, 0.12],
      [-0.88, 0.97, 0.12],
      0.027,
      0.027,
      palette.rough,
    );
  }
  roof(tower, 3.94, 3.94, bell.eaves, bell.ridge - bell.eaves, 'hip', palette.roofBrown, lod);
}

function yardWell(out, lod) {
  if (lod < 1) return;
  const base = finalGrade(well.center);
  const o = transform(out, 0, [well.center[0], base, well.center[1]]);
  const inside = octagon(well.radius - 0.19, 0.44);
  const outer = octagon(well.radius, 0.44);
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    const a = outer[i],
      b = outer[j];
    face(o, 'solid', [a, b, inside[j], inside[i]], up, palette.stone);
    face(
      o,
      'solid',
      [[a[0], -0.22, a[2]], [b[0], -0.22, b[2]], b, a],
      perimeter([a, b]),
      palette.stone,
    );
  }
  if (lod >= 2) {
    polygon(
      o,
      'solid',
      inside.map(([x, , z]) => [x, 0.04, z]),
      up,
      palette.dark,
    );
    beam(o, 'timber', [-0.72, 0.44, 0], [-0.72, 1.41, 0], 0.13, 0.14, palette.rough);
    beam(o, 'timber', [0.72, 0.44, 0], [0.72, 1.41, 0], 0.13, 0.14, palette.rough);
    beam(o, 'timber', [-0.82, 1.36, 0], [0.85, 1.36, 0], 0.14, 0.16, palette.pine);
  }
}
function build(out, lod) {
  paths(out, lod);
  stockade(out, lod);
  for (const part of bastions) bastion(out, part, lod);
  for (const part of buildings) yardBuilding(out, part, lod);
  bellTower(out, lod);
  yardWell(out, lod);
}
export const fortSkyline = (out) => build(out, 0);
export const fortDistrict = (out) => build(out, 1);
export const fortStreet = (out) => build(out, 2);
export const fortCloseup = (out) => build(out, 3);

const recipe = 'fort-victoria-british-columbia-model.mjs';
const camera = [-178, 134, 157],
  lookAt = [-1, 2, -14];
export const fortModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  surfaces,
  category: 'landmark',
  wikidataId: 'Q5472227',
  build: fortCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'September 1860 Fort Victoria, with both timber bastions, cedar pickets and gates, tall bell tower, and the whitewashed and timber courtyard buildings.',
  camera,
  lookAt,
  sunDirection: [-51, 71, 48],
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  embeddedCanonicalGraphs: [
    'wood_plain',
    'wood_log',
    'wood_board_batten',
    'wood_weatherboard',
    'shingle_cedar',
  ],
  buildingCutout: {
    outline: section.corners,
    basis: 'The documented fort courtyard, limited to its historical viewing period.',
  },
  mediumFiContext: {
    scale: 1,
    groundY: -0.15,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'harbour-side-southwest-bastion', position: [-78, 4.0, 83], lookAt: [-50, 4.4, 58] },
    { name: 'courtyard-bell-and-fort-street-gate', position: [-8, 8.5, 6], lookAt: [36, 6.8, -5] },
    { name: 'government-street-northeast-bastion', position: [90, 14, -103], lookAt: [57, 6, -83] },
    { name: 'palisade-and-northern-warehouses', position: [-86, 21, -55], lookAt: [-27, 3, -42] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'fort-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'fortSkyline',
    errorMeters: 1.24,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'fortDistrict', 0.58],
        ['street', 'fortStreet', 0.21],
        ['closeup', 'fortCloseup', 0.063],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Sarah Lindley Crease’s watercolour and Fawcett’s period book illustrations are public domain. OpenStreetMap controls are ODbL 1.0.',
};
