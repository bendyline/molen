import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  abox,
  facade,
  fbox,
  lathe,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
  opening,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}.json`, import.meta.url)));
const plan = read('plan-controls');
const map = read('map-frame');
const measured = read('native-map/temple-of-the-tooth-shape-controls');
const c = Object.fromEntries(
  Object.entries({
    bone: 'e5dac1',
    ivory: 'd7c9ad',
    cream: 'cfc0a1',
    range: 'd3c6a9',
    tile: '865344',
    tileLight: 'a0624d',
    darkTile: '715145',
    stone: '8b806c',
    darker: '726758',
    stoneLight: 'aaa08a',
    plaque: 'b3a086',
    oak: '674738',
    shadow: '453a31',
    water: '626d50',
    gold: 'c6a04a',
    goldTrim: 'd4ad50',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93 },
  stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.96 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.91 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.87 },
  metal: { slot: 'roof', graph: 'metal_painted', roughness: 0.53, metallic: 0.51 },
  shade: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.95 },
  water: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.46 },
};
const outline = outwardRing(measured.outline);
const octagon = outwardRing([0, 1, 3, 5, 8, 10, 11, 12].map((i) => measured.octagon[i]));
const centre = [14.58, 35.14];
const courtY = 2.91;
const gateX = measured.gatewayCenter;
const boxRing = ([x0, x1, z0, z1]) => [
  [x0, z1],
  [x1, z1],
  [x1, z0],
  [x0, z0],
];
const at = (ring, y) => ring.map(([x, z]) => [x, y, z]);
const scale = (ring, centre, ratio) =>
  ring.map(([x, z]) => [centre[0] + (x - centre[0]) * ratio, centre[1] + (z - centre[1]) * ratio]);
const facadeWalls = (ring) => ring.map((p, i) => wallFace(p, ring[(i + 1) % ring.length]));

function sides(out, slot, lower, upper, col) {
  for (let i = 0; i < lower.length; i++) {
    const j = (i + 1) % lower.length;
    quad4(out, slot, lower[i], lower[j], upper[j], upper[i], col);
  }
}

function cap(out, slot, ring, y, col) {
  const temp = new MeshBufferBuilder();
  if (
    !temp.addCap(
      slot,
      'palette:#ffffff',
      outwardRing(ring),
      [],
      () => y,
      [0, 1, 0],
      (p) => p,
      col,
    )
  )
    throw Error('Temple of the Tooth slab could not be triangulated');
  const { positions, indices } = temp.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const point = (n) => Array.from(positions.slice(n * 3, n * 3 + 3));
    tri(out, slot, point(indices[i]), point(indices[i + 1]), point(indices[i + 2]), col);
  }
}

function hipped(
  out,
  box,
  eave,
  ridge,
  { roof = 'tile', color = c.tile, trim = 'timber', ridgeColor = c.oak, level = 1 } = {},
) {
  const [x0, x1, z0, z1] = box;
  const ax = x1 - x0,
    az = z1 - z0,
    x = (x0 + x1) / 2,
    z = (z0 + z1) / 2;
  const centre = [x, z];
  const ring = boxRing(box);
  const middle = scale(ring, centre, 0.8);
  const y = eave + (ridge - eave) * 0.21;
  sides(out, trim, at(ring, eave - 0.19), at(ring, eave), ridgeColor);
  sides(out, roof, at(ring, eave), at(middle, y), color);
  const dx = ax > az ? Math.max(0.08, (ax - az) * 0.35) : 0;
  const dz = az >= ax ? Math.max(0.08, (az - ax) * 0.35) : 0;
  const first = [x - dx, ridge, z - dz],
    last = [x + dx, ridge, z + dz];
  const [a, b, d, e] = at(middle, y);
  if (dx > 0) {
    quad4(out, roof, a, b, last, first, color);
    tri(out, roof, b, d, last, color);
    quad4(out, roof, d, e, first, last, color);
    tri(out, roof, e, a, first, color);
  } else {
    tri(out, roof, a, b, last, color);
    quad4(out, roof, b, d, first, last, color);
    tri(out, roof, d, e, first, color);
    quad4(out, roof, e, a, last, first, color);
  }
  if (level >= 1) {
    abox(
      out,
      trim,
      [x - dx - 0.08, ridge - 0.06, z - dz - 0.08],
      [x + dx + 0.08, ridge + 0.16, z + dz + 0.08],
      ridgeColor,
      { bottom: false },
    );
  }
}

function stair(out, x, width, z0, z1, y0, y1, n) {
  const left = x - width / 2,
    right = x + width / 2;
  for (let i = 0; i < n; i++) {
    const z = z0 + ((z1 - z0) * i) / n,
      next = z0 + ((z1 - z0) * (i + 1)) / n;
    const y = y0 + ((y1 - y0) * i) / n,
      high = y0 + ((y1 - y0) * (i + 1)) / n;
    quad4(out, 'stone', [left, y, z], [right, y, z], [right, high, z], [left, high, z], c.darker);
    quad4(
      out,
      'stone',
      [left, high, z],
      [right, high, z],
      [right, high, next],
      [left, high, next],
      c.stoneLight,
    );
  }
}

function scallopedWall(out, points, y, external, level) {
  for (let i = 0; i < points.length - 1; i++) {
    const f = wallFace(points[i], points[i + 1]);
    const L = f.length;
    const slab = external ? c.stone : c.stoneLight;
    if (level === 0) {
      fbox(out, 'plaster', f, 0, L, y - 2.5, y + 1.18, -0.21, 0.21, c.ivory);
      continue;
    }
    fbox(out, 'stone', f, 0, L, y - 2.85, y + 0.37, -0.29, 0.26, c.darker);
    fbox(out, 'stone', f, -0.035, L + 0.035, y + 0.35, y + 0.57, -0.38, 0.36, slab);
    fbox(out, 'plaster', f, 0, L, y + 0.56, y + 0.78, -0.21, 0.22, external ? c.ivory : c.bone);
    const n = Math.max(1, Math.round(L / (level === 1 ? 2.63 : 1.62)));
    for (let j = 0; j < n; j++) {
      const a = (L * j) / n,
        b = (L * (j + 1)) / n,
        mid = (a + b) * 0.5,
        half = (b - a) * 0.5;
      const stroke = external ? c.ivory : c.bone;
      const h = y + (external ? 1.27 : 1.62);
      const base = y + 0.78;
      const crest = [
        [a, base + 0.035],
        [mid - half * 0.61, base + 0.23],
        [mid - half * 0.36, h - 0.05],
        [mid, h + 0.055],
        [mid + half * 0.36, h - 0.05],
        [mid + half * 0.61, base + 0.23],
        [b, base + 0.035],
      ];
      if (level === 1) {
        tri(out, 'plaster', f.P(a, base, 0.21), f.P(b, base, 0.21), f.P(mid, h, 0.21), stroke);
        tri(out, 'plaster', f.P(b, base, -0.21), f.P(a, base, -0.21), f.P(mid, h, -0.21), stroke);
        continue;
      }
      const thickness = 0.11 + (external ? 0.01 : 0.025);
      for (let k = 0; k < crest.length - 1; k++) {
        const [u0, y0] = crest[k],
          [u1, y1] = crest[k + 1];
        const p = f.P(u0, y0, 0.23),
          q = f.P(u1, y1, 0.23),
          r = f.P(u1, y1, -0.23),
          s = f.P(u0, y0, -0.23);
        quad4(out, 'plaster', p, q, r, s, stroke);
        quad4(
          out,
          'plaster',
          f.P(u0, Math.max(base, y0 - thickness), 0.23),
          f.P(u1, Math.max(base, y1 - thickness), 0.23),
          q,
          p,
          stroke,
        );
        quad4(
          out,
          'plaster',
          r,
          s,
          f.P(u0, Math.max(base, y0 - thickness), -0.23),
          f.P(u1, Math.max(base, y1 - thickness), -0.23),
          stroke,
        );
      }
      if (level >= 2) {
        for (const dx of [-0.27, 0.27]) {
          const x = mid + half * dx;
          fbox(
            out,
            'plaster',
            f,
            x - 0.056,
            x + 0.056,
            base,
            base + (h - base) * 0.63,
            -0.16,
            0.18,
            stroke,
          );
        }
      }
    }
  }
}

function passageArch(out, f, width, spring, top, depth, level) {
  const path = roundArch(width / 2, level === 0 ? 6 : level === 1 ? 9 : 15);
  for (let i = 0; i < path.length - 1; i++) {
    const [a, ay] = path[i],
      [b, by] = path[i + 1];
    const p = f.P(a, spring + ay, 0),
      q = f.P(b, spring + by, 0);
    const u = f.P(a, spring + ay, -depth),
      v = f.P(b, spring + by, -depth);
    quad4(out, 'stone', p, q, f.P(b, top, 0), f.P(a, top, 0), c.stone);
    quad4(out, 'stone', v, u, f.P(a, top, -depth), f.P(b, top, -depth), c.stone);
    quad4(out, 'stone', q, p, u, v, c.darker);
    if (level >= 2)
      quad4(
        out,
        'stone',
        f.P(a, spring + ay, 0.09),
        f.P(b, spring + by, 0.09),
        f.P(b * 1.125, spring + by * 1.125, 0.086),
        f.P(a * 1.125, spring + ay * 1.125, 0.086),
        c.stoneLight,
      );
  }
}

function elephantRelief(out, f, centre, sign) {
  const draw = (loop, depth, color) => {
    const vertices = loop.map(([x, y]) => f.P(centre + sign * x, y, depth));
    if (sign < 0) vertices.reverse();
    for (let i = 1; i + 1 < vertices.length; i++)
      tri(out, 'stone', vertices[0], vertices[i], vertices[i + 1], color);
  };
  draw(
    [
      [-0.42, 0.91],
      [-0.13, 0.81],
      [0.43, 0.83],
      [0.62, 1.01],
      [0.52, 1.2],
      [0.21, 1.33],
      [-0.15, 1.33],
      [-0.39, 1.19],
    ],
    0.3,
    c.plaque,
  );
  draw(
    [
      [-0.62, 0.99],
      [-0.47, 0.91],
      [-0.28, 0.92],
      [-0.2, 1.12],
      [-0.34, 1.27],
      [-0.61, 1.13],
    ],
    0.324,
    c.plaque,
  );
  draw(
    [
      [-0.45, 1.03],
      [-0.28, 1.0],
      [-0.22, 1.13],
      [-0.29, 1.23],
      [-0.44, 1.19],
    ],
    0.34,
    c.stoneLight,
  );
  draw(
    [
      [-0.71, 0.72],
      [-0.54, 0.79],
      [-0.48, 1.03],
      [-0.61, 1.06],
      [-0.66, 0.83],
      [-0.75, 0.76],
    ],
    0.328,
    c.plaque,
  );
  draw(
    [
      [-0.64, 0.9],
      [-0.43, 0.95],
      [-0.5, 0.98],
    ],
    0.352,
    c.cream,
  );
  for (const x of [-0.29, -0.1, 0.27, 0.47])
    draw(
      [
        [x - 0.052, 0.55],
        [x + 0.05, 0.55],
        [x + 0.065, 0.99],
        [x - 0.064, 0.99],
      ],
      0.313,
      c.plaque,
    );
}

function portal(out, level) {
  const f = facade([gateX, 44.28], [1, 0]);
  const w = 1.49,
    spring = 4.32,
    depth = 4.45,
    crown = 6.48;
  const porch = 1.26;
  abox(out, 'stone', [gateX - 2.05, -0.45, 38.85], [gateX + 2.05, porch, 48.65], c.stone);
  if (level >= 1)
    abox(out, 'stone', [gateX - 2.07, -1.2, 48.38], [gateX + 2.07, 0.1, 50.61], c.stone);
  stair(out, gateX, 4.14, 50.61, 48.36, 0.1, porch, 5);
  for (const sign of [-1, 1]) {
    const u = sign * (w + 1.15);
    fbox(out, 'stone', f, u - 1.15, u + 1.15, porch, crown, -depth, 0.01, c.stone);
    if (level === 0) continue;
    fbox(
      out,
      'stone',
      f,
      u - 1.17,
      u + 1.17,
      porch - 0.09,
      porch + 0.49,
      -depth - 0.1,
      0.36,
      c.darker,
    );
    fbox(out, 'stone', f, u - 1.2, u + 1.2, 3.07, 3.27, -depth - 0.04, 0.24, c.stoneLight);
    fbox(out, 'stone', f, u - 0.62, u - 0.48, 1.54, 6.4, -0.01, 0.22, c.stoneLight);
    if (level >= 1)
      opening(out, f, u + 0.13, 3.51, 0.79, 1.76, {
        head: 'round',
        glassSlot: 'shade',
        frameSlot: 'stone',
        glass: c.darker,
        frame: c.stoneLight,
        frameWidth: 0.085,
        frameDepth: 0.15,
        d: 0.085,
        sill: false,
      });
    const wing = sign * 2.92;
    const reliefFace = facade([gateX, 49.02], [1, 0]);
    fbox(out, 'stone', reliefFace, wing - 1.02, wing + 1.02, 0.1, 2.03, -1.23, 0.195, c.stone);
    fbox(
      out,
      'stone',
      reliefFace,
      wing - 1.085,
      wing + 1.085,
      1.9,
      2.15,
      -1.31,
      0.31,
      c.stoneLight,
    );
    fbox(out, 'stone', reliefFace, wing - 0.79, wing + 0.79, 0.43, 1.64, 0.16, 0.25, c.darker);
    if (level >= 2) {
      elephantRelief(out, reliefFace, wing, sign);
      const axis = [gateX + wing, 48.77];
      lathe(
        out,
        'metal',
        axis,
        [
          [2.09, 0.23, 0.23],
          [2.27, 0.19, 0.19],
          [2.43, 0.116, 0.116],
          [3.14, 0.09, 0.09],
          [3.29, 0.23, 0.23],
          [3.58, 0.24, 0.24],
          [3.72, 0.16, 0.16],
          [3.95, 0.042, 0.042],
        ],
        level === 3 ? 10 : 7,
        c.oak,
      );
    }
  }
  passageArch(out, f, w * 2, spring, crown, depth, level);
  fbox(out, 'stone', f, -3.91, 3.91, crown - 0.12, crown + 0.27, -depth - 0.28, 0.29, c.darker);
  fbox(out, 'stone', f, -3.84, 3.84, crown + 0.27, crown + 0.46, -depth - 0.19, 0.22, c.stoneLight);
  for (const u of level === 0 ? [-2.91, 0, 2.91] : [-2.91, -1.62, 0, 1.62, 2.91]) {
    const h = crown + (u === 0 ? 1.43 : 1.04);
    fbox(out, 'stone', f, u - 0.34, u + 0.34, crown + 0.44, h, -0.69, 0.08, c.stone);
    if (level >= 1)
      fbox(out, 'stone', f, u - 0.415, u + 0.415, h - 0.07, h + 0.1, -0.76, 0.17, c.stoneLight);
  }
}

function pavilion(out, level) {
  const base = scale(octagon, centre, 0.985);
  sides(out, 'stone', at(base, -1.7), at(base, 2.04), c.darker);
  sides(out, 'plaster', at(base, 2.04), at(base, 6.28), c.bone);
  const moldings = level === 0 ? [2.04, 6.26] : [2.04, 2.61, 3.24, 3.75, 4.28, 4.81, 5.58, 6.23];
  for (const y of moldings) {
    const lip = scale(base, centre, y > 6 ? 1.063 : 1.037);
    sides(out, 'plaster', at(lip, y - 0.04), at(lip, y + 0.15), c.ivory);
  }
  const facadeRing = scale(octagon, centre, 0.77);
  const balcony = scale(octagon, centre, 1.045);
  const eave = scale(octagon, centre, 1.125);
  const shoulder = scale(octagon, centre, 0.665);
  const neck = scale(octagon, centre, 0.28);
  sides(out, 'plaster', at(facadeRing, 6.28), at(facadeRing, 9.95), c.bone);
  for (const f of facadeWalls(facadeRing)) {
    opening(out, f, f.length * 0.5, 6.63, f.length * 0.54, 2.23, {
      head: level === 0 ? 'flat' : 'round',
      glassSlot: 'shade',
      frameSlot: 'plaster',
      glass: c.shadow,
      frame: c.cream,
      frameWidth: level >= 2 ? 0.14 : 0,
      d: 0.07,
      frameDepth: 0.15,
      sill: false,
    });
  }
  for (const f of facadeWalls(balcony)) {
    fbox(out, 'plaster', f, -0.12, 0.29, 6.23, 9.93, -0.58, 0.1, c.bone);
    if (level === 0) continue;
    fbox(out, 'timber', f, 0.27, f.length - 0.01, 6.68, 6.83, -0.18, 0.02, c.oak);
    if (level >= 1) {
      const n = level === 1 ? 4 : level === 2 ? 8 : 13;
      for (let i = 1; i < n; i++) {
        const u = (f.length * i) / n;
        fbox(out, 'timber', f, u - 0.059, u + 0.059, 6.3, 6.7, -0.142, -0.043, c.oak);
      }
    }
  }
  sides(out, 'timber', at(eave, 9.76), at(eave, 9.99), c.oak);
  sides(out, 'tile', at(eave, 9.99), at(shoulder, 10.98), c.tile);
  sides(out, 'tile', at(shoulder, 10.98), at(neck, 13.54), c.tileLight);
  const tip = [centre[0], 15.48, centre[1]];
  const ring = at(neck, 13.54);
  for (let i = 0; i < ring.length; i++)
    tri(out, 'tile', ring[i], ring[(i + 1) % ring.length], tip, c.tileLight);
  if (level >= 1) {
    lathe(
      out,
      'metal',
      centre,
      [
        [15.4, 0.21, 0.21],
        [15.56, 0.23, 0.23],
        [15.67, 0.11, 0.11],
        [15.93, 0.16, 0.16],
        [16.05, 0.103, 0.103],
        [16.34, 0.027, 0.027],
      ],
      level >= 2 ? 10 : 6,
      c.goldTrim,
    );
  }
}

function ranges(out, level) {
  const blocks = [
    { box: [-20.15, 8.25, 19.25, 36.1], eave: 8.98, ridge: 13.26, front: true },
    { box: [-20.15, -13.2, -13.68, 19.3], eave: 7.73, ridge: 10.83 },
    { box: [12.55, 22.17, -13.68, 19.3], eave: 7.49, ridge: 11.14 },
    { box: [-20.13, 22.13, -15.87, -10.64], eave: 7.61, ridge: 10.66 },
  ];
  for (const { box, eave, ridge, front } of blocks) {
    const [x0, x1, z0, z1] = box;
    const ground = courtY - 0.14;
    const high = eave - 0.12;
    if (front && level >= 1) {
      abox(out, 'plaster', [x0, ground, z0], [gateX - 1.69, high, z1], c.range, { bottom: false });
      abox(out, 'plaster', [gateX + 1.69, ground, z0], [x1, high, z1], c.range, { bottom: false });
      abox(out, 'plaster', [gateX - 1.69, courtY + 2.87, z0], [gateX + 1.69, high, z1], c.range);
    } else {
      abox(out, 'plaster', [x0, ground, z0], [x1, high, z1], c.range, { bottom: false });
    }
    hipped(out, [x0 - 0.62, x1 + 0.62, z0 - 0.62, z1 + 0.61], eave, ridge, { level });
    if (level >= 1) {
      const f = facade([x0, z1], [1, 0]);
      const n = front ? 7 : Math.max(2, Math.round((x1 - x0) / 4.1));
      for (let i = 0; i < n; i++) {
        const u = ((x1 - x0) * (i + 0.5)) / n;
        opening(out, f, u, 5.58, front ? 2.65 : 1.28, 2.45, {
          head: 'round',
          glassSlot: 'shade',
          frameSlot: 'plaster',
          glass: c.shadow,
          frame: c.bone,
          frameWidth: level >= 2 ? 0.12 : 0,
          frameDepth: 0.15,
          d: 0.065,
          sill: false,
        });
      }
    }
  }
}

function shrine(out, level) {
  const [x0, x1, z0, z1] = [-5.66, 5.66, -8.82, 8.82];
  abox(
    out,
    'stone',
    [x0 - 0.58, courtY - 0.3, z0 - 0.62],
    [x1 + 0.58, courtY + 0.63, z1 + 0.62],
    c.stoneLight,
  );
  abox(
    out,
    'plaster',
    [x0 + 0.72, courtY + 0.6, z0 + 0.63],
    [x1 - 0.72, 9.88, z1 - 0.63],
    c.ivory,
    { bottom: false },
  );
  hipped(out, [x0 - 0.57, x1 + 0.57, z0 - 0.57, z1 + 0.64], 6.51, 8.36, {
    color: c.darkTile,
    level,
  });
  const points = boxRing([x0 - 0.05, x1 + 0.05, z0 - 0.05, z1 + 0.05]);
  for (const f of level === 0 ? [] : facadeWalls(points)) {
    const n = level === 1 ? 5 : Math.ceil(f.length / 1.75);
    for (let i = 0; i <= n; i++) {
      const u = (f.length * i) / n;
      fbox(out, 'timber', f, u - 0.09, u + 0.09, courtY + 0.57, 6.46, -0.13, 0.07, c.oak);
      if (level >= 2) {
        fbox(out, 'timber', f, u - 0.155, u + 0.155, 6.1, 6.49, -0.18, 0.13, c.oak);
        fbox(
          out,
          'stone',
          f,
          u - 0.121,
          u + 0.121,
          courtY + 0.55,
          courtY + 0.81,
          -0.155,
          0.095,
          c.stone,
        );
      }
    }
  }
  hipped(out, [x0 - 0.76, x1 + 0.76, z0 - 0.64, z1 + 0.72], 9.88, 13.19, {
    color: c.darkTile,
    level,
  });
  const f = facade([0, z1 - 0.55], [1, 0]);
  if (level >= 1)
    opening(out, f, 0, courtY + 0.72, 2.22, 2.23, {
      glassSlot: 'shade',
      frameSlot: 'timber',
      glass: c.shadow,
      frame: c.oak,
      frameWidth: 0.15,
      frameDepth: 0.17,
      d: 0.09,
      sill: false,
    });
  for (const x of [-6.35, 6.35]) {
    for (const z of [-8.28, 8.28]) {
      abox(
        out,
        'stone',
        [x - 0.29, courtY - 0.16, z - 0.29],
        [x + 0.29, courtY + 0.31, z + 0.29],
        c.stone,
      );
      abox(out, 'metal', [x - 0.11, courtY + 0.24, z - 0.11], [x + 0.11, 13.42, z + 0.11], c.oak, {
        bottom: false,
      });
    }
  }
  hipped(out, [-7.08, 7.08, -9.512, 9.512], 13.19, 16.32, {
    roof: 'metal',
    color: c.gold,
    trim: 'metal',
    ridgeColor: c.goldTrim,
    level,
  });
  if (level >= 1)
    lathe(
      out,
      'metal',
      [0, 0],
      [
        [16.24, 0.29, 0.29],
        [16.5, 0.24, 0.24],
        [16.76, 0.11, 0.11],
        [17.13, 0.025, 0.025],
      ],
      level === 1 ? 6 : 10,
      c.goldTrim,
    );
}

const interior = outwardRing([
  [-20.3, 36.95],
  [7.38, 36.63],
  [10.9, 42.7],
  [18.4, 42.4],
  [24.3, 36.81],
  [22.85, -15.88],
  [-20.8, -15.92],
]);
const moat = outwardRing(measured.moat);
const terrainOpening = outwardRing([
  [-19.05, 43.86],
  [-16.5, 50.2],
  [-11.75, 50.22],
  [-10.75, 47.0],
  [5.95, 46.39],
  [9.95, 50.18],
  [19.49, 49.61],
  [24.35, 45.69],
  [44.55, 44.98],
  [44.35, 37.27],
  [26.15, 36.66],
  [22.3, -14.96],
  [-20.45, -15.06],
]);

function build(out, level) {
  cap(out, 'water', moat, 0.39, c.water);
  sides(out, 'stone', at(interior, -2.8), at(interior, courtY - 0.035), c.stone);
  cap(out, 'stone', interior, courtY - 0.035, c.stoneLight);
  scallopedWall(out, measured.outerWall, 0.62, true, level);
  scallopedWall(out, measured.northWall, 0.76, true, level);
  scallopedWall(out, measured.innerWall, 2.48, false, level);
  portal(out, level);
  stair(out, gateX, 3.8, 38.85, 35.91, 1.26, courtY + 0.04, 6);
  pavilion(out, level);
  ranges(out, level);
  shrine(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'temple-of-the-tooth-model.mjs';
const camera = [71, 38, 99];
const lookAt = [4, 6, 21];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'buddhist-temple',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: map.terrainContact.basis,
  brief:
    'Kandy’s public stone gateway, moat, covered octagonal pavilion, courtyard shrine and gilded canopy.',
  camera,
  lookAt,
  sunDirection: [49, 66, 81],
  mediumFiContext: {
    scale: 1.12,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.9,
    basis:
      'The two-storey shrine plinth follows the named OSM footprint at the centre of the temple.',
  },
  groundCutout: {
    outline: terrainOpening,
    basis:
      'Within the mapped moat and built courtyard the ancient paving and controlled water level replace the coarse Copernicus roof elevations.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    {
      name: 'arched-west-gate-and-elephant-stones',
      position: [-14.1, 6.7, 65],
      lookAt: [-13.55, 4.18, 44.5],
    },
    { name: 'octagonal-pavilion-from-the-moat', position: [38, 12, 63], lookAt: [11.6, 7.1, 35.6] },
    { name: 'sacred-court-and-gilded-canopy', position: [32, 24, -19], lookAt: [0, 10, 3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'temple-of-the-tooth-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.3,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.58, surfaces },
      street: { export: 'street', errorMeters: 0.17, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.065, surfaces },
    },
  },
};
