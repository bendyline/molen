import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  abox,
  extrude,
  fbox,
  gableRoof,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const shape = read('native-map/basilica-and-convent-of-san-francisco-quito-shape-controls');
const map = shape.roofs;
const exterior = outwardRing(shape.outline);
const church = wallFace(...shape.mainFacade);
const atrium = 2.53;
const surfaces = {
  masonry: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.97 },
  stoneTrim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.91 },
  plaster: { slot: 'wall', graph: 'stucco', roughness: 0.92 },
  terracotta: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.94 },
  slate: { slot: 'roof', graph: 'tile_glazed', roughness: 0.87 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.88 },
  pavement: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.98 },
  shade: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.72 },
};
const cutStone = rgb('a89b84');
const darkStone = rgb('857767');
const paleStone = rgb('bdb199');
const mortar = rgb('b3a38c');
const plaster = rgb('e1d5bc');
const ivory = rgb('e4ddc5');
const tile = rgb('ae7059');
const slate = rgb('636b62');
const bronze = rgb('716b51');
const glass = rgb('4d4d43');
const darkWood = rgb('534439');
const fireclay = rgb('ba8568');
const moss = rgb('79805e');

function band(
  out,
  f,
  y,
  h,
  depth,
  color = paleStone,
  left = 0,
  right = f.length,
  surface = 'stoneTrim',
) {
  fbox(out, surface, f, left, right, y, y + h, -0.075, depth, color);
}

function rect(out, f, u, y, w, h, level, { door = false, arch = false, offset = 0.04 } = {}) {
  const surface = door ? 'timber' : 'shade';
  const color = door ? darkWood : glass;
  if (level === 1) {
    quad4(
      out,
      surface,
      f.P(u - w / 2, y, offset),
      f.P(u + w / 2, y, offset),
      f.P(u + w / 2, y + h, offset),
      f.P(u - w / 2, y + h, offset),
      color,
    );
    return;
  }
  opening(out, f, u, y, w, h, {
    head: arch ? 'round' : 'flat',
    glassSlot: surface,
    frameSlot: 'stoneTrim',
    glass: color,
    frame: paleStone,
    frameWidth: w * 0.105,
    frameDepth: 0.24,
    d: offset,
    sill: !door,
    mullions: level >= 3 && w > 1.03 ? 1 : 0,
    transoms: level >= 3 && h > 1.95 ? 1 : 0,
    mullionColor: bronze,
  });
}

function stoneColumn(out, f, u, y, h, r, level, color = paleStone) {
  const [x, , z] = f.P(u, 0, 0.45);
  const r1 = r * 1.29;
  fbox(out, 'stoneTrim', f, u - r1, u + r1, y, y + 0.38, 0.03, 0.86, color);
  if (level === 0) {
    fbox(out, 'stoneTrim', f, u - r, u + r, y + 0.35, y + h - 0.25, 0.09, 0.67, color);
  } else {
    lathe(
      out,
      'stoneTrim',
      [x, z],
      [
        [y + 0.36, r1, r1],
        [y + 0.56, r1, r1],
        [y + 0.74, r, r],
        [y + h - 0.45, r * 0.84, r * 0.84],
        [y + h - 0.21, r1, r1],
      ],
      level >= 3 ? 10 : 6,
      color,
      { capTop: false },
    );
  }
  fbox(out, 'stoneTrim', f, u - r1, u + r1, y + h - 0.23, y + h, 0.04, 0.89, color);
}

function flatCap(out, slot, outline, height, color) {
  const builder = new MeshBufferBuilder();
  if (
    !builder.addCap(
      slot,
      'palette:#ffffff',
      outwardRing(outline),
      [],
      () => height,
      [0, 1, 0],
      (p) => p,
      color,
    )
  )
    throw Error('San Francisco convent roof could not be triangulated');
  const { positions, indices } = builder.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const p = [];
    for (let j = 0; j < 3; j++) {
      const n = indices[i + j] * 3;
      p.push([positions[n], positions[n + 1], positions[n + 2]]);
    }
    tri(out, slot, ...p, color);
  }
}

const midpoint = (ring) =>
  ring.reduce(([x, z], p) => [x + p[0] / ring.length, z + p[1] / ring.length], [0, 0]);

function hip(out, slot, ring, low, high, rx, rz, color) {
  const edges = outwardRing(ring);
  const [cx, cz] = midpoint(edges);
  const top = edges.map(([x, z]) => [cx + (x - cx) * rx, cz + (z - cz) * rz]);
  for (let i = 0; i < edges.length; i++) {
    const j = (i + 1) % edges.length;
    quad4(
      out,
      slot,
      [edges[i][0], low, edges[i][1]],
      [edges[j][0], low, edges[j][1]],
      [top[j][0], high, top[j][1]],
      [top[i][0], high, top[i][1]],
      color,
    );
  }
  flatCap(out, slot, top, high, color);
}

function disk(out, f, u, y, r, level, color, centerColor) {
  if (level < 2) return;
  const ring = level === 3 ? 16 : 10;
  for (let i = 0; i < ring; i++) {
    const a = (i * 2 * Math.PI) / ring,
      b = ((i + 1) * 2 * Math.PI) / ring;
    const P = (t, k, d) => f.P(u + Math.cos(t) * r * k, y + Math.sin(t) * r * k, d);
    quad4(
      out,
      'stoneTrim',
      P(a, 1, 0.188),
      P(b, 1, 0.188),
      P(b, 0.77, 0.205),
      P(a, 0.77, 0.205),
      color,
    );
    tri(out, 'shade', f.P(u, y, 0.179), P(a, 0.77, 0.179), P(b, 0.77, 0.179), centerColor);
  }
}

function basementAndNave(out, level) {
  const ring = map.basilica.outline;
  extrude(out, 'masonry', ring, -4.0, 13.92, cutStone, { top: false });
  flatCap(out, 'terracotta', ring, 13.92, tile);
  abox(out, 'plaster', [-10.235, 13.9, -3.7], [15.52, 16.82, 46.72], ivory);
  gableRoof(out, 'terracotta', [2.64, -3.8], [2.64, 46.86], 25.77, 16.83, 21.72, tile, {
    overhang: 0.3,
    endSlot: 'plaster',
    endColor: ivory,
  });
  abox(out, 'plaster', [-13.24, 13.65, -31.54], [15.44, 16.11, -3.44], ivory);
  gableRoof(out, 'terracotta', [0.98, -31.64], [0.98, -3.55], 28.0, 16.15, 20.36, tile, {
    overhang: 0.24,
    endSlot: 'plaster',
    endColor: ivory,
  });
  if (level >= 2) {
    const west = wallFace([-10.25, 38.15], [-10.23, 7.47]);
    const rear = wallFace([15.6, -31.42], [-12.95, -32.24]);
    for (const [f, n] of [
      [west, 6],
      [rear, 5],
    ]) {
      for (let i = 0; i < n; i++) {
        const u = ((i + 0.5) * f.length) / n;
        rect(out, f, u, 10.15, 1.08, 2.58, level, { arch: true });
        fbox(out, 'masonry', f, u - 2.34, u - 1.7, 2.42, 13.86, 0.03, 0.79, cutStone);
      }
    }
  }
}

function dome(out, key, drum, peak, level) {
  const ring = map[key].outline;
  const center = midpoint(ring);
  const radius = Math.max(...ring.map(([x, z]) => Math.hypot(x - center[0], z - center[1])));
  const facets = level === 0 ? 6 : level === 1 ? 12 : level === 2 ? 16 : 24;
  const r = radius;
  const roofStart = drum + 1.67;
  const drumProfile = [
    [drum - 0.43, r * 0.93, r * 0.93],
    [drum, r, r],
    [roofStart, r, r],
    [roofStart + 0.17, r * 1.02, r * 1.02],
  ];
  lathe(
    out,
    'plaster',
    center,
    level === 0 ? [drumProfile[0], drumProfile[3]] : drumProfile,
    facets,
    ivory,
    { capTop: false },
  );
  const profile = [
    [roofStart + 0.12, r * 1.025, r * 1.025],
    [roofStart + (peak - roofStart) * 0.31, r * 0.94, r * 0.94],
    [roofStart + (peak - roofStart) * 0.52, r * 0.79, r * 0.79],
    [roofStart + (peak - roofStart) * 0.76, r * 0.53, r * 0.53],
    [peak, r * 0.18, r * 0.18],
  ];
  lathe(out, 'terracotta', center, profile, facets, fireclay, { capTop: true });
  if (level >= 1) {
    lathe(
      out,
      'stoneTrim',
      center,
      [
        [peak - 0.018, radius * 0.23, radius * 0.23],
        [peak + 0.24, radius * 0.23, radius * 0.23],
        [peak + 1.01, radius * 0.17, radius * 0.17],
        [peak + 1.26, 0, 0],
      ],
      level >= 3 ? 10 : 6,
      paleStone,
      { capTop: false },
    );
  }
  if (level < 2) return;
  for (let i = 0; i < 6; i++) {
    const angle = (i * 2 * Math.PI) / 6;
    const x = center[0] + Math.cos(angle) * (r + 0.02),
      z = center[1] + Math.sin(angle) * (r + 0.02);
    const dx = Math.sin(angle) * 0.74,
      dz = -Math.cos(angle) * 0.74;
    const facade = wallFace([x - dx, z - dz], [x + dx, z + dz]);
    rect(out, facade, facade.length * 0.5, drum + 0.18, 0.75, 1.18, level, { arch: true });
  }
}

function campanile(out, key, level) {
  const ring = outwardRing(map[key].outline);
  const minX = Math.min(...ring.map((v) => v[0]));
  const maxX = Math.max(...ring.map((v) => v[0]));
  const minZ = Math.min(...ring.map((v) => v[1]));
  const maxZ = Math.max(...ring.map((v) => v[1]));
  const front = wallFace([minX, maxZ + 0.049], [maxX, maxZ + 0.049]);
  const box = [
    [minX, minZ],
    [minX, maxZ],
    [maxX, maxZ],
    [maxX, minZ],
  ];
  extrude(out, 'masonry', box, 12.66, 20.22, cutStone, { top: false });
  extrude(out, 'plaster', box, 19.82, 26.64, ivory, { top: false });
  const center = midpoint(box);
  const spireFoot = box.map(([x, z]) => [
    center[0] + (x - center[0]) * 0.88,
    center[1] + (z - center[1]) * 0.88,
  ]);
  flatCap(out, 'stoneTrim', box, 26.6, paleStone);
  hip(out, 'slate', spireFoot, 26.61, 32.47, 0.22, 0.22, slate);
  const courses = [
    [26.16, 0.43],
    [26.42, 0.31],
    [20.15, 0.32],
  ];
  for (const [h, width] of level === 0 ? courses.slice(0, 1) : courses) {
    for (let j = 0; j < box.length; j++) {
      const f = wallFace(box[j], box[(j + 1) % box.length]);
      band(out, f, h, 0.26, width, paleStone, -0.06, f.length + 0.06);
    }
  }
  if (level >= 1) {
    for (let j = 0; j < box.length; j++) {
      const f = wallFace(box[j], box[(j + 1) % box.length]);
      rect(out, f, f.length * 0.51, 20.57, f.length * 0.39, 4.67, level, {
        door: true,
        arch: true,
      });
      if (level >= 2) {
        for (const u of [0.71, f.length - 0.7]) {
          fbox(out, 'stoneTrim', f, u - 0.34, u + 0.34, 20.43, 25.96, 0.012, 0.22, paleStone);
          band(out, f, 25.74, 0.27, 0.33, ivory, u - 0.53, u + 0.53);
        }
      }
    }
    for (const [x, z] of box) {
      lathe(
        out,
        'stoneTrim',
        [x * 0.92 + center[0] * 0.08, z * 0.92 + center[1] * 0.08],
        [
          [26.56, 0.26, 0.26],
          [26.89, 0.34, 0.34],
          [27.27, 0.29, 0.29],
          [27.45, 0, 0],
        ],
        level >= 3 ? 8 : 5,
        ivory,
        { capTop: false },
      );
    }
  }
  if (level >= 2) {
    const u = front.length / 2;
    disk(out, front, u, 16.9, 0.83, level, paleStone, darkStone);
    const face = wallFace([center[0] - 1.75, maxZ - 0.96], [center[0] + 1.75, maxZ - 0.96]);
    const clock = key === 'westTower';
    disk(out, face, 1.75, 27.24, 0.64, level, paleStone, clock ? ivory : glass);
    if (clock) {
      fbox(out, 'shade', face, 1.71, 1.78, 27.19, 27.56, 0.18, 0.23, glass);
      fbox(out, 'shade', face, 1.47, 1.78, 27.2, 27.28, 0.18, 0.23, glass);
    }
    const [x, z] = center;
    abox(out, 'stoneTrim', [x - 0.048, 32.42, z - 0.052], [x + 0.048, 33.31, z + 0.052], bronze);
    abox(out, 'stoneTrim', [x - 0.3, 32.97, z - 0.043], [x + 0.3, 33.06, z + 0.043], bronze);
  }
}

function carvedFront(out, level) {
  const u = church.length * 0.5;
  const left = u - 5.65,
    right = u + 5.65;
  fbox(out, 'masonry', church, 0, church.length, atrium, 14.25, -1.31, 0.04, darkStone);
  fbox(out, 'masonry', church, 0.24, church.length - 0.24, 13.2, 20.1, -1.25, 0.07, cutStone);
  for (const [y, h, d] of [
    [3.13, 0.35, 0.4],
    [11.85, 0.32, 0.51],
    [12.26, 0.3, 0.66],
    [12.68, 0.44, 0.71],
    [19.72, 0.27, 0.49],
    [20.07, 0.25, 0.55],
  ]) {
    band(out, church, y, h, d, paleStone, -0.12, church.length + 0.12);
  }
  fbox(out, 'masonry', church, left, right, atrium, 18.53, 0.045, 0.36, darkStone);
  for (const dx of [-4.16, -2.83, 2.83, 4.16])
    stoneColumn(out, church, u + dx, atrium + 0.19, 8.4, 0.37, level, paleStone);
  if (level >= 1) {
    rect(out, church, u, atrium + 0.29, 4.41, 7.23, level, {
      door: true,
      arch: true,
      offset: 0.48,
    });
    for (const x of [3.31, church.length - 3.31])
      rect(out, church, x, atrium + 0.81, 1.6, 3.31, level, { door: true, offset: 0.11 });
    rect(out, church, u, 13.98, 2.87, 3.74, level, { arch: true, offset: 0.43 });
    for (const dx of [-3.3, 3.3])
      stoneColumn(out, church, u + dx, 13.57, 5.19, 0.28, level, cutStone);
  }
  const profile = [
    [-7.31, 13.06],
    [-5.21, 13.49],
    [-4.08, 15.06],
    [-3.39, 17.97],
    [-2.7, 19.34],
    [-1.12, 19.67],
    [0, 19.47],
    [1.15, 19.67],
    [2.73, 19.34],
    [3.42, 17.97],
    [4.1, 15.06],
    [5.24, 13.49],
    [7.35, 13.06],
  ];
  for (let i = 0; i < profile.length - 1; i++) {
    const [[a, ya], [b, yb]] = [profile[i], profile[i + 1]];
    quad4(
      out,
      'stoneTrim',
      church.P(u + a, ya - 0.105, 0.51),
      church.P(u + b, yb - 0.105, 0.51),
      church.P(u + b, yb + 0.099, 0.51),
      church.P(u + a, ya + 0.099, 0.51),
      paleStone,
    );
  }
  if (level < 2) return;
  for (let s = 0.46; s < church.length - 0.29; s += 0.91) {
    fbox(out, 'stoneTrim', church, s - 0.127, s + 0.127, 19.14, 19.58, 0.112, 0.51, mortar);
    if (level === 3) disk(out, church, s, 20.38, 0.235, level, ivory, darkStone);
  }
  for (const x of [3.49, church.length - 3.62]) {
    for (const dir of [-1, 1]) {
      quad4(
        out,
        'stoneTrim',
        church.P(x + dir * 2.33, 15.36, 0.41),
        church.P(x, 16.78, 0.41),
        church.P(x, 17.05, 0.41),
        church.P(x + dir * 2.33, 15.58, 0.41),
        paleStone,
      );
    }
    for (let i = 0; i < 6; i++) {
      const y = 13.42 + i * 0.77;
      band(out, church, y, 0.12, 0.18, mortar, x - 2.82, x + 2.8);
    }
    disk(out, church, x, 16.55, 0.97, level, paleStone, darkStone);
  }
}

function wings(out, level) {
  const ranges = [
    ['entryRange', atrium - 0.89, 13.5, 17.28, 0.83, 0.14],
    ['eastPlazaRange', atrium - 0.8, 12.79, 16.58, 0.85, 0.17],
    ['eastRearRange', -0.63, 13.66, 17.02, 0.82, 0.13],
    ['eastOuterRange', -0.59, 12.45, 15.33, 0.13, 0.86],
    ['middleRange', -0.5, 13.21, 16.28, 0.14, 0.84],
    ['rearRange', 0.11, 14.11, 17.9, 0.79, 0.25],
    ['westChapels', -4.85, 13.14, 16.24, 0.73, 0.77],
  ];
  for (const [key, base, eave, top, rx, rz] of ranges) {
    const ring = map[key].outline;
    extrude(out, 'plaster', ring, base, eave, ivory, { top: false });
    hip(out, 'terracotta', ring, eave - 0.017, top, rx, rz, tile);
  }
  const streetWalls = [
    { f: wallFace([-55.98, 52.64], [-10.38, 54.48]), n: 8, eave: 13.14 },
    { f: wallFace([15.6, 54.49], [61.36, 54.97]), n: 8, eave: 13.5 },
    { f: wallFace([61.43, 55.0], [108.48, 56.48]), n: 8, eave: 12.79 },
  ];
  for (const { f, n, eave } of streetWalls) {
    band(out, f, eave - 0.36, 0.29, 0.35, plaster);
    band(out, f, atrium + 0.125, 0.28, 0.19, cutStone);
    if (level === 0) continue;
    for (let i = 0; i < n; i++) {
      const u = ((i + 0.51) * f.length) / n;
      rect(out, f, u, 8.41, 1.33, 1.72, level);
      if (level >= 2)
        rect(out, f, u, atrium + 0.26, i === n - 2 ? 2.82 : 1.2, i === n - 2 ? 4.15 : 2.37, level, {
          arch: i === n - 2,
          door: i === n - 2 || i % 3 === 2,
        });
    }
  }
  if (level >= 2) {
    const west = streetWalls[0].f;
    const museum = streetWalls[1].f;
    for (const [f, u] of [
      [west, west.length * 0.19],
      [museum, museum.length * 0.28],
    ]) {
      rect(out, f, u, atrium + 0.25, 2.82, 4.16, level, { arch: true, door: true, offset: 0.09 });
      for (const s of [-1, 1])
        stoneColumn(out, f, u + s * 1.78, atrium + 0.2, 4.62, 0.24, level, paleStone);
      band(out, f, atrium + 4.83, 0.25, 0.46, paleStone, u - 2.19, u + 2.19);
    }
  }
}

function cloisterGallery(out, ring, level) {
  const facing = outwardRing(ring).reverse();
  flatCap(out, 'pavement', outwardRing(ring), 4.25, rgb('b9af8f'));
  if (level === 0) return;
  for (let i = 0; i < facing.length; i++) {
    const f = wallFace(facing[i], facing[(i + 1) % facing.length]);
    const n = Math.max(3, Math.round(f.length / 3.7));
    for (const [y, h] of [
      [4.31, 3.07],
      [8.66, 2.62],
    ]) {
      band(out, f, y + h + 0.17, 0.18, 0.25, plaster);
      for (let j = 0; j < n; j++) {
        const a = (f.length * j) / n,
          b = (f.length * (j + 1)) / n;
        const center = (a + b) / 2;
        const width = Math.min(2.77, (b - a) * 0.74);
        if (level === 2) {
          const radius = width / 2;
          const spring = y + h - radius;
          const head = roundArch(radius, 6).reverse();
          const rim = roundArch(radius + 0.17, 6).reverse();
          quad4(
            out,
            'shade',
            f.P(center - radius, y, 0.092),
            f.P(center + radius, y, 0.092),
            f.P(center + radius, spring, 0.092),
            f.P(center - radius, spring, 0.092),
            darkWood,
          );
          for (let k = 0; k + 1 < head.length; k++) {
            const edge = ([dx, dy]) => f.P(center + dx, spring + dy, 0.092);
            const trim = ([dx, dy]) => f.P(center + dx, spring + dy, 0.147);
            tri(
              out,
              'shade',
              f.P(center, spring, 0.092),
              edge(head[k]),
              edge(head[k + 1]),
              darkWood,
            );
            quad4(
              out,
              'stoneTrim',
              trim(head[k]),
              trim(rim[k]),
              trim(rim[k + 1]),
              trim(head[k + 1]),
              paleStone,
            );
          }
        } else {
          rect(out, f, center, y, width, h, level, { arch: true, door: true, offset: 0.091 });
        }
        if (level >= 2)
          fbox(
            out,
            'stoneTrim',
            f,
            a - 0.075,
            a + 0.075,
            y,
            y + h + 0.12,
            0.012,
            0.207,
            h > 3 ? paleStone : ivory,
          );
      }
    }
  }
  if (level >= 2) {
    const [x, z] = midpoint(ring);
    const s = level === 3 ? 16 : 10;
    for (const dx of [-5.6, 5.6]) {
      for (const dz of [-5.6, 5.6]) {
        abox(
          out,
          'stoneTrim',
          [x + dx - 2.46, 4.25, z + dz - 2.36],
          [x + dx + 2.46, 4.54, z + dz + 2.36],
          paleStone,
        );
        abox(
          out,
          'pavement',
          [x + dx - 2.32, 4.52, z + dz - 2.22],
          [x + dx + 2.32, 4.57, z + dz + 2.22],
          moss,
        );
      }
    }
    lathe(
      out,
      'stoneTrim',
      [x, z],
      [
        [4.25, 1.46, 1.46],
        [4.42, 1.46, 1.46],
        [4.49, 1.2, 1.2],
        [4.65, 0.77, 0.77],
        [5.11, 0.4, 0.4],
        [5.4, 0.66, 0.66],
        [5.56, 0.78, 0.78],
        [5.78, 0.77, 0.77],
      ],
      s,
      paleStone,
      { capTop: true },
    );
  }
}

function stairs(out, level) {
  abox(out, 'pavement', [-55.98, -4.61, 52.17], [61.35, atrium, 59.29], darkStone);
  abox(out, 'stoneTrim', [-56.12, atrium - 0.2, 58.43], [61.55, atrium + 0.018, 59.34], paleStone);
  const count = level === 0 ? 3 : 11;
  const x = 2.67;
  const span = 15.4;
  for (let j = 0; j < count; j++) {
    const t = j / count,
      tNext = (j + 1) / count;
    const half = span * 0.5 + 3.2 * tNext;
    const y = atrium - (atrium - 0.11) * t;
    abox(
      out,
      'pavement',
      [x - half, -0.019, 59.27 + 4.72 * t],
      [x + half, y, 59.28 + 4.72 * tNext],
      cutStone,
      { bottom: false },
    );
  }
  if (level >= 2) {
    for (const x0 of [-54.4, 59.09]) {
      const h0 = x0 < 0 ? -3.2 : -2.9;
      for (let j = 0; j < 13; j++) {
        const t = j / 13;
        const y = atrium - (atrium - h0) * t;
        abox(
          out,
          'pavement',
          [x0 - 1.66, h0 - 0.8, 59.22 + 5.42 * t],
          [x0 + 1.66, y, 59.65 + 5.42 * t],
          cutStone,
          { bottom: false },
        );
      }
    }
  }
}

function build(out, level) {
  stairs(out, level);
  basementAndNave(out, level);
  wings(out, level);
  carvedFront(out, level);
  campanile(out, 'westTower', level);
  campanile(out, 'eastTower', level);
  dome(out, 'mainDome', 18.2, 25.59, level);
  dome(out, 'westDome', 16.38, 22.64, level);
  dome(out, 'eastDome', 16.38, 22.77, level);
  for (const ring of shape.cloisters) cloisterGallery(out, ring, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'basilica-and-convent-of-san-francisco-quito-model.mjs';
const camera = [166, 96, 174];
const lookAt = [25, 9, 16];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historic-basilica-and-convent',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Quito’s San Francisco basilica with its carved plaza façade, paired campaniles, tiled roofs and the two connected convent courts.',
  camera,
  lookAt,
  sunDirection: [-45, 55, 62],
  mediumFiContext: {
    scale: 1.15,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: exterior,
    minimumCoverage: 0.86,
    basis:
      'The native perimeter of the church, connected chapels and cloister ranges south of Cuenca Street.',
  },
  groundCutout: {
    outline: outwardRing(shape.cloisters[0]),
    basis:
      'Keep the principal tiled court clear of roof returns in the coarse elevation raster, with the opening confined to the inside of its gallery walls.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'plaza-front-and-twin-campaniles', position: [-11, 17.8, 100], lookAt: [3, 14, 46] },
    { name: 'raised-atrium-and-convent-ranges', position: [87, 24, 115], lookAt: [26, 12, 43] },
    { name: 'cloister-galleries-and-dome-roofline', position: [107, 59, 31], lookAt: [25, 11, 15] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'basilica-and-convent-of-san-francisco-quito-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.46,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.51, surfaces },
      street: { export: 'street', errorMeters: 0.18, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.067, surfaces },
    },
  },
};
