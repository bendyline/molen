/** The reconstructed mission cathedral and belfry in San Ignacio de Velasco. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  beamPath,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const requireFromWorldgen = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
);
const { default: earcut } = requireFromWorldgen('earcut');
const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  s = plan.section;
const frame = read('map-frame');
const terrain = read('terrain-grid');
const [outline, annex] = frame.geometry.polygons;
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.91, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.95, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.87, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.84, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.69, metallic: 0.21 },
};
const c = Object.fromEntries(
  Object.entries({
    plaster: 'dfd4be',
    plasterShade: 'c9b89d',
    base: 'aa8a6b',
    tile: '8f5740',
    tileLight: 'a2694d',
    underside: '6a4331',
    trim: '845a43',
    timber: '593d2b',
    dark: '382a22',
    wood: '74523c',
    ochre: 'b48353',
    rust: '9d5741',
    paint: 'ad7c64',
    pale: 'efdfc3',
    bronze: '796745',
    iron: '666661',
    balcony: '643e2b',
    glass: '443e34',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const white = 'palette:#ffffff',
  up = [0, 1, 0],
  front = [0, 0, 1];

function face(out, slot, points, outward, color) {
  let n = normalFor(...points);
  if (n.reduce((sum, v, i) => sum + v * outward[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, color);
  else
    out.addTriangle(
      slot,
      white,
      points,
      n,
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      color,
    );
}

function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    dx = u - i,
    dz = v - j;
  const [a, b] = terrain.heightsMeters.slice(j, j + 2);
  return (
    (a[i] * (1 - dx) + a[i + 1] * dx) * (1 - dz) +
    (b[i] * (1 - dx) + b[i + 1] * dx) * dz -
    terrain.modelDatumElevationMeters
  );
}

function foundation(out, polygon, top, lod) {
  const ring = [...polygon];
  const area = ring.reduce((sum, [x, z], i) => {
    const [u, v] = ring[(i + 1) % ring.length];
    return sum + x * v - z * u;
  }, 0);
  if (area < 0) ring.reverse();
  for (let i = 0; i < ring.length; i++) {
    const [x, z] = ring[i],
      [u, v] = ring[(i + 1) % ring.length];
    const segments = lod >= 2 ? Math.max(1, Math.ceil(Math.hypot(u - x, v - z) / 6)) : 1;
    for (let j = 0; j < segments; j++) {
      const point = (k, upper) => {
        const px = x + ((u - x) * k) / segments,
          pz = z + ((v - z) * k) / segments;
        return [px, upper ? top : Math.min(top - 0.15, ground(px, pz) - 0.26), pz];
      };
      face(
        out,
        'base',
        [point(j, false), point(j + 1, false), point(j + 1, true), point(j, true)],
        [v - z, 0, x - u],
        c.base,
      );
    }
  }
  const triangles = earcut(ring.flat());
  if (!triangles.length) throw Error('Cathedral foundation outline could not be triangulated');
  for (let i = 0; i < triangles.length; i += 3) {
    const vertices = triangles
      .slice(i, i + 3)
      .map((index) => [ring[index][0], top, ring[index][1]]);
    face(out, 'base', vertices, up, c.ochre);
  }
}

function roof(out, lod) {
  const z0 = s.plazaFrontZ + 0.69,
    z1 = s.rearZ - 0.77;
  const shape = (rear, side) => {
    const [a, b] = rear ? s.rearEaveX : s.frontEaveX;
    return { x: side < 0 ? a : b, z: rear ? z1 : z0, center: rear ? s.rearAxisX : s.frontAxisX };
  };
  for (const side of [-1, 1]) {
    const a = shape(false, side),
      b = shape(true, side);
    const p = (eave, f, down = 0) => [
      eave.x + (eave.center - eave.x) * f,
      s.eave + (s.ridge - s.eave) * f - down,
      eave.z,
    ];
    face(out, 'roof', [p(a, 0), p(b, 0), p(b, 1), p(a, 1)], up, c.tile);
    face(
      out,
      'wood',
      [p(a, 0, 0.19), p(b, 0, 0.19), p(b, 1, 0.19), p(a, 1, 0.19)],
      [0, -1, 0],
      c.underside,
    );
    beam(out, 'wood', p(a, 0, 0.17), p(a, 1, 0.17), 0.22, 0.21, c.timber);
    beam(out, 'wood', p(a, 0, 0.15), p(b, 0, 0.15), 0.19, 0.24, c.timber);
    if (lod >= 2) {
      const count = lod === 3 ? 39 : 20;
      for (let i = 0; i <= count; i++) {
        const t = i / count;
        const leading = p(a, t, -0.034),
          trailing = p(b, t, -0.034);
        beam(out, 'roof', leading, trailing, 0.071, 0.086, i % 4 ? c.tile : c.tileLight);
        if (lod === 3 && i % 2 === 0) {
          beam(
            out,
            'wood',
            [leading[0], leading[1] - 0.23, z0 - 1.12],
            [leading[0], leading[1] - 0.24, z0 + 0.13],
            0.082,
            0.106,
            c.underside,
          );
        }
      }
    }
  }
  beam(
    out,
    'roof',
    [s.frontAxisX, s.ridge + 0.035, z0],
    [s.rearAxisX, s.ridge + 0.035, z1],
    0.23,
    0.17,
    c.tileLight,
  );
  if (lod >= 1) {
    beam(
      out,
      'wood',
      [s.frontAxisX, s.ridge - 0.62, z0 - 0.5],
      [s.frontAxisX, s.ridge - 0.25, z0 - 0.49],
      0.18,
      0.19,
      c.ochre,
    );
  }
}

function pillar(out, x, z, y, top, lod, width = 0.66) {
  if (lod >= 2) {
    box(out, 'base', x, y - 0.09, z, width + 0.19, 0.25, width + 0.18, c.base);
    loft(
      out,
      'wood',
      [
        radialRing(y + 0.13, width / 2, width / 2, 8, [x, z]),
        radialRing(top - 0.18, width * 0.46, width * 0.46, 8, [x, z]),
      ],
      c.timber,
    );
    box(out, 'wood', x, top - 0.3, z, width + 0.2, 0.29, width + 0.18, c.timber);
  } else box(out, 'wood', x, y, z, width, top - y, width, c.timber);
}

function nave(out, lod) {
  foundation(out, outline, s.floor, lod);
  roof(out, lod);
  const [left, right] = s.wallX,
    center = (left + right) / 2,
    width = right - left;
  const z0 = s.wallFrontZ,
    z1 = s.rearZ + 0.27,
    h = s.eave - 0.46;
  const roofAt = (x) =>
    s.eave +
    (s.ridge - s.eave) *
      (1 -
        Math.abs(x - s.frontAxisX) /
          (x < s.frontAxisX ? s.frontAxisX - s.frontEaveX[0] : s.frontEaveX[1] - s.frontAxisX));
  box(out, 'plaster', center, s.floor, (z0 + z1) / 2, width, h - s.floor, z0 - z1, c.plaster);
  const plasterEnd = (z, outward) => {
    face(
      out,
      'plaster',
      [
        [left, h, z],
        [right, h, z],
        [right, roofAt(right) - 0.33, z],
        [left, roofAt(left) - 0.33, z],
      ],
      outward,
      c.plaster,
    );
    face(
      out,
      'plaster',
      [
        [left, roofAt(left) - 0.33, z],
        [right, roofAt(right) - 0.33, z],
        [s.frontAxisX, s.ridge - 0.43, z],
      ],
      outward,
      c.plaster,
    );
  };
  plasterEnd(z0 + 0.005, front);
  plasterEnd(z1 - 0.005, [0, 0, -1]);

  for (const side of [-1, 1]) {
    const x = side < 0 ? left : right;
    box(out, 'plaster', x + side * 0.025, s.floor, (z0 + z1) / 2, 0.076, 0.73, z0 - z1, c.rust);
    if (lod) {
      for (let z = z1 + 6.2; z < z0 - 2.4; z += 7.1) {
        box(out, 'plaster', x + side * 0.029, s.floor + 1.55, z, 0.087, 2.39, 1.35, c.paint);
        box(out, 'wood', x + side * 0.086, s.floor + 1.76, z, 0.093, 1.98, 0.98, c.glass);
        if (lod >= 2) {
          for (const shift of [-0.3, 0, 0.3]) {
            box(
              out,
              'wood',
              x + side * 0.145,
              s.floor + 1.79,
              z + shift,
              0.047,
              1.9,
              0.056,
              c.trim,
            );
          }
        }
      }
    }
    const galleryX = side < 0 ? s.frontEaveX[0] + 1.12 : s.frontEaveX[1] - 1.12;
    for (let z = s.plazaFrontZ - 0.32; z > s.rearZ + 0.8; z -= lod ? 5.24 : 17.1) {
      const t = (s.plazaFrontZ - z) / (s.plazaFrontZ - s.rearZ);
      const rearOffset =
        (side < 0 ? s.rearEaveX[0] : s.rearEaveX[1]) -
        (side < 0 ? s.frontEaveX[0] : s.frontEaveX[1]);
      const position = galleryX + rearOffset * t;
      pillar(out, position, z, s.floor, s.eave + 0.27, lod, 0.62);
    }
  }
  for (const shift of [-11.21, -5.49, 5.49, 11.21]) {
    const x = s.frontAxisX + shift;
    pillar(
      out,
      x,
      s.plazaFrontZ - 0.34,
      s.floor,
      roofAt(x) - 0.2,
      lod,
      Math.abs(shift) < 6 ? 0.75 : 0.65,
    );
  }
}

function tilePanel(out, x, y, z, width, height, color, slot = 'plaster') {
  box(out, slot, x, y, z, width, height, 0.031, color);
}

function paintedBorders(out, x, y, z, height, lod) {
  const low = y + 0.05,
    high = y + height;
  for (const dx of [-0.35, 0.35]) {
    beam(out, 'plaster', [x + dx, low, z], [x + dx, high, z], 0.048, 0.056, c.paint);
  }
  if (lod < 2) return;
  for (let level = low + 0.29; level < high - 0.21; level += lod === 3 ? 0.54 : 0.81) {
    const w = 0.2,
      h = 0.17;
    const points = [
      [x - w, level, z],
      [x, level + h, z],
      [x + w, level, z],
      [x, level - h, z],
    ];
    beamPath(out, 'plaster', points, 0.044, 0.037, c.paint, true);
  }
}

function frontWindow(out, x, y, z, width, height, lod) {
  const spring = y + height - 0.38;
  tilePanel(out, x, y, z, width, spring - y, c.glass, 'wood');
  const points = Array.from({ length: lod >= 2 ? 9 : 5 }, (_, i) => {
    const a = (Math.PI * i) / (lod >= 2 ? 8 : 4);
    return [x - (Math.cos(a) * width) / 2, spring + Math.sin(a) * 0.38, z + 0.028];
  });
  const center = [x, spring - 0.02, z + 0.017];
  for (let i = 1; i < points.length; i++)
    face(out, 'wood', [center, points[i - 1], points[i]], front, c.glass);
  beamPath(
    out,
    'plaster',
    [[x - width / 2, y, z + 0.026], ...points, [x + width / 2, y, z + 0.026]],
    0.1,
    0.11,
    c.paint,
  );
  if (lod) {
    for (const shift of [-0.3, 0, 0.3]) {
      beam(
        out,
        'wood',
        [x + shift * width, y, z + 0.044],
        [x + shift * width, spring, z + 0.044],
        0.065,
        0.064,
        c.trim,
      );
    }
  }
}

function stairs(out, lod) {
  const x = s.frontAxisX,
    z = s.wallFrontZ + 1.08,
    deck = 6.14,
    bottom = 3.64;
  box(out, 'wood', x, deck - 0.19, z, 8.56, 0.21, 2.08, c.balcony);
  beam(
    out,
    'wood',
    [x - 4.25, deck + 0.94, z + 1.01],
    [x + 4.25, deck + 0.94, z + 1.01],
    0.16,
    0.16,
    c.timber,
  );
  for (const sign of [-1, 1]) {
    const low = x + sign * 12.25,
      high = x + sign * 4.08;
    const count = lod >= 2 ? 15 : lod ? 8 : 2;
    const at = (i) => [low + ((high - low) * i) / count, bottom + ((deck - bottom) * i) / count];
    for (let i = 0; i < count; i++) {
      const [a, y] = at(i),
        [b, h] = at(i + 1);
      box(
        out,
        'wood',
        (a + b) / 2,
        y - 0.14,
        z,
        Math.abs(b - a) + 0.026,
        h - y + 0.14,
        1.83,
        c.balcony,
      );
    }
    const a = [low, bottom, z + 0.89],
      b = [high, deck, z + 0.89];
    beam(out, 'wood', a, b, 0.16, 0.19, c.timber);
    beam(out, 'wood', [a[0], a[1] + 1.0, a[2]], [b[0], b[1] + 1.0, b[2]], 0.16, 0.15, c.timber);
    if (lod) {
      const gap = lod >= 2 ? 1 : 2;
      for (let i = 0; i <= count; i += gap) {
        const [u, y] = at(i);
        beam(out, 'wood', [u, y, z + 0.89], [u, y + 1.01, z + 0.89], 0.092, 0.091, c.timber);
      }
      // Lower access is recessed behind the timber gallery return.
      for (let i = 0; i < (lod >= 2 ? 9 : 4); i++) {
        const n = lod >= 2 ? 9 : 4;
        const stepY = s.floor + ((bottom - s.floor) * (i + 1)) / n;
        const stepZ = z + 2.65 - (2.65 * (i + 0.5)) / n;
        box(out, 'wood', low, stepY - 0.39, stepZ, 1.87, 0.39, 2.65 / n + 0.02, c.wood);
      }
    }
  }
  if (lod >= 2) {
    for (let a = x - 4.12; a <= x + 4.2; a += 0.46) {
      beam(out, 'wood', [a, deck, z + 1.02], [a, deck + 0.97, z + 1.02], 0.078, 0.077, c.timber);
    }
  }
}

function facade(out, lod) {
  const x = s.frontAxisX,
    z = s.wallFrontZ + 0.065,
    y = s.floor;
  tilePanel(out, x, y, z, 6.04, 5.72, c.trim, 'wood');
  tilePanel(out, x, y + 0.1, z + 0.08, 5.45, 5.43, c.dark, 'wood');
  tilePanel(out, x, 6.22, z + 0.11, 6.19, 4.13, c.dark, 'wood');
  for (const sign of [-1, 1]) {
    const outer = x + sign * 7.55;
    frontWindow(out, outer, y + 1.07, z + 0.1, 1.96, 3.05, lod);
    frontWindow(out, x + sign * 4.05, y + 2.24, z + 0.1, 1.14, 2.19, lod);
    if (lod) frontWindow(out, x + sign * 4.04, 7.11, z + 0.09, 1.06, 1.89, lod);
  }
  tilePanel(out, x, 5.83, z + 0.12, 6.55, 0.43, c.ochre, 'wood');
  for (const stripe of [0.11, 1.65, 2.06]) {
    tilePanel(out, x, y + stripe, z - 0.02, s.wallX[1] - s.wallX[0], 0.089, c.rust);
  }
  stairs(out, lod);
  if (!lod) return;
  for (const shift of [-11.42, -8.95, -6.19, -3.19, 3.19, 6.19, 8.95, 11.42]) {
    const height = Math.abs(shift) < 6.3 ? 9.86 : 4.67;
    paintedBorders(out, x + shift, y + 0.51, z + 0.09, height - 0.58, lod);
  }
  if (lod >= 2) {
    for (let i = -2; i <= 2; i++) {
      const px = x + i * 0.96;
      for (let j = 0; j < 5; j++) {
        const py = y + 0.35 + j * 0.98;
        tilePanel(out, px, py, z + 0.118, 0.78, 0.81, c.wood, 'wood');
        if (lod === 3) tilePanel(out, px, py + 0.22, z + 0.148, 0.31, 0.36, c.trim, 'wood');
      }
    }
    for (let j = 0; j < 7; j++) {
      const py = 6.49 + j * 0.53;
      tilePanel(out, x, py, z + 0.146, 5.92, 0.082, c.trim, 'wood');
    }
    for (let i = -5; i <= 5; i++)
      tilePanel(out, x + i * 0.48, 6.46, z + 0.149, 0.059, 3.72, c.trim, 'wood');
  }
}

function belfry(out, lod) {
  const {
    center: [x, z],
    width,
    depth,
    galleryY,
    eaveY,
    crossTopY,
  } = s.tower;
  const faceZ = z + depth / 2,
    y = s.floor;
  box(out, 'plaster', x, y, z, width, galleryY - y, depth, c.plaster);
  box(out, 'wood', x, galleryY - 0.19, z, width + 1.02, 0.31, depth + 1.04, c.trim);
  const cap = eaveY - 0.32,
    postWidth = 0.89;
  for (const dx of [-1, 1])
    for (const dz of [-1, 1]) {
      box(
        out,
        'plaster',
        x + (dx * (width - postWidth)) / 2,
        galleryY,
        z + (dz * (depth - postWidth)) / 2,
        postWidth,
        cap - galleryY,
        postWidth,
        c.plaster,
      );
    }
  box(out, 'plaster', x, cap, z, width, 0.43, depth, c.plaster);
  const canopy = (yy, w, d) => [
    [x - w, yy, z - d],
    [x - w, yy, z + d],
    [x + w, yy, z + d],
    [x + w, yy, z - d],
  ];
  loft(
    out,
    'roof',
    [
      canopy(eaveY - 0.08, width / 2 + 0.53, depth / 2 + 0.55),
      canopy(eaveY + 0.57, width * 0.36, depth * 0.36),
    ],
    c.tile,
  );
  beam(out, 'metal', [x, eaveY + 0.53, z], [x, crossTopY, z], 0.12, 0.12, c.iron);
  beam(
    out,
    'metal',
    [x - 0.46, crossTopY - 0.43, z],
    [x + 0.46, crossTopY - 0.43, z],
    0.12,
    0.12,
    c.iron,
  );
  const bellY = galleryY + 1.24;
  for (const h of lod ? [bellY, bellY + 2.02, bellY + 3.98] : [bellY + 2.02]) {
    const sides = lod >= 2 ? 12 : 6;
    loft(
      out,
      'metal',
      [
        [0, 0.48],
        [0.15, 0.4],
        [0.61, 0.28],
        [0.88, 0.15],
      ].map(([rise, r]) => radialRing(h + rise, r, r, sides, [x, z + 0.19])),
      c.bronze,
    );
    beam(
      out,
      'wood',
      [x - 1.63, h + 0.85, z + 0.19],
      [x + 1.63, h + 0.85, z + 0.19],
      0.14,
      0.13,
      c.timber,
    );
  }
  if (!lod) return;
  for (const shift of [-1.69, 1.69]) {
    paintedBorders(out, x + shift, 7.7, faceZ + 0.034, galleryY - 8.02, lod);
    paintedBorders(out, x + shift, galleryY + 0.42, faceZ + 0.034, cap - galleryY - 0.56, lod);
  }
  frontWindow(out, x, 10.62, faceZ + 0.035, 1.56, 2.43, lod);
  for (const yy of [9.72, 13.44, 17.47]) tilePanel(out, x, yy, faceZ + 0.06, 3.1, 0.095, c.paint);
  const circle = (r, a) => [x + Math.cos(a) * r, 15.57 + Math.sin(a) * r, faceZ + 0.08];
  const medallion = Array.from({ length: 12 }, (_, i) => circle(0.72, (i * Math.PI) / 6));
  beamPath(out, 'plaster', medallion, 0.093, 0.08, c.paint, true);
  if (lod >= 2) {
    for (let i = 0; i < 6; i++) {
      beam(
        out,
        'plaster',
        circle(0.22, (i * Math.PI) / 3),
        circle(0.58, (i * Math.PI) / 3),
        0.07,
        0.07,
        c.ochre,
      );
    }
    const rail = canopy(galleryY + 1.04, width / 2 + 0.46, depth / 2 + 0.47);
    beamPath(out, 'metal', rail, 0.066, 0.068, c.iron, true);
    for (let i = 0; i < rail.length; i++) {
      const a = rail[i],
        b = rail[(i + 1) % rail.length];
      for (let j = 0; j < 9; j++) {
        const at = [a[0] + ((b[0] - a[0]) * j) / 9, a[1], a[2] + ((b[2] - a[2]) * j) / 9];
        beam(out, 'metal', [at[0], galleryY + 0.08, at[2]], at, 0.047, 0.045, c.iron);
      }
    }
    for (const sign of [-1, 1]) {
      beam(
        out,
        'wood',
        [x - sign * 1.36, galleryY + 0.33, faceZ - 0.18],
        [x + sign * 1.32, galleryY + 3.41, faceZ - 0.18],
        0.079,
        0.08,
        c.trim,
      );
    }
  }
}

function rearRange(out, lod) {
  const floor = -1.78;
  foundation(out, annex, floor, lod);
  const midX = annex.reduce((sum, [x]) => sum + x, 0) / annex.length;
  const midZ = annex.reduce((sum, [, z]) => sum + z, 0) / annex.length;
  box(out, 'plaster', midX, floor, midZ, 14.62, 4.68, 6.08, c.plasterShade);
  const y = floor + 4.58;
  for (const side of [-1, 1]) {
    face(
      out,
      'roof',
      [
        [midX - 7.51, y, midZ + side * 3.35],
        [midX + 7.51, y, midZ + side * 3.35],
        [midX + 7.51, y + 1.43, midZ],
        [midX - 7.51, y + 1.43, midZ],
      ],
      up,
      c.tile,
    );
  }
  for (const side of [-1, 1]) {
    const xx = midX + side * 7.44;
    face(
      out,
      'plaster',
      [
        [xx, y, midZ - 3.2],
        [xx, y, midZ + 3.2],
        [xx, y + 1.43, midZ],
      ],
      [side, 0, 0],
      c.plasterShade,
    );
  }
}

function build(out, lod) {
  nave(out, lod);
  facade(out, lod);
  belfry(out, lod);
  rearRange(out, lod);
}

export const cathedralSkyline = (out) => build(out, 0);
export const cathedralDistrict = (out) => build(out, 1);
export const cathedralStreet = (out) => build(out, 2);
export const cathedralCloseup = (out) => build(out, 3);

const recipe = 'san-ignacio-velasco-model.mjs';
const camera = [66, 47, 106],
  lookAt = [-0.1, 9.1, -1.7];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'cathedralDistrict', 0.42],
    ['street', 'cathedralStreet', 0.19],
    ['closeup', 'cathedralCloseup', 0.065],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);

export const cathedralModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: cathedralCloseup,
  category: 'cathedral',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The reconstructed mission cathedral with a broad tiled gable, timber veranda and choir stairs, patterned facade, square belfry and rear range.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  buildingCutout: {
    outline,
    minimumCoverage: 0.9,
    basis: 'Named cathedral envelope, OpenStreetMap way 165819243.',
  },
  mediumFiContext: {
    scale: 0.88,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_sandstone_raw',
    'tile_ceramic',
    'wood_plain',
    'metal_painted',
  ],
  qaCameras: [
    {
      name: 'plaza-gable-painted-front-and-belfry',
      position: [-5.8, 4.7, 82],
      lookAt: [-4.5, 11.0, 26.8],
    },
    {
      name: 'front-choir-stairs-and-gallery',
      position: [12.5, 8.6, 57],
      lookAt: [-3.0, 6.0, 30.2],
    },
    {
      name: 'side-veranda-and-attached-rear-range',
      position: [70, 33, -50],
      lookAt: [-2.1, 6.8, -8.4],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-san-ignacio-cathedral-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'cathedralSkyline',
    errorMeters: 0.81,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license, OpenStreetMap ODbL 1.0 and one exact first-party CC0 Qualla photograph.',
};
