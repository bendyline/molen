import {
  beam,
  beamPath,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  block,
  cap,
  edge,
  face,
  mix,
  palette,
  panel,
  pavilion,
  rect,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  wall: surface('wall', 'stucco'),
  tile: surface('roof', 'tile_ceramic', 0.85, 0.015),
  stone: surface('foundation', 'stone_ashlar'),
  timber: surface('trim', 'wood_plain'),
  grate: surface('trim', 'metal_painted', 0.7, 0.1),
  glass: surface('window', 'window_punched', 0.54, 0.03),
};
const C = palette({
  clay: 'ad624d',
  brightClay: 'ba7055',
  darkClay: '98553f',
  ridge: '935d4a',
  white: 'ded7c5',
  wall: 'd2c8b2',
  shade: 'c4baa4',
  stone: '9c9585',
  base: '5d5952',
  paved: 'b4a692',
  timber: '625447',
  green: '556955',
  yellow: 'b9a071',
  ivory: 'd9cfb4',
  glass: '6f7970',
  shadow: '554b40',
});

function platform(out, plan, grade, y, shade = C.stone) {
  shell(out, plan, (p) => Math.min(grade(p) - 0.21, y - 0.16), y, {
    wall: 'stone',
    color: shade,
    roof: 'stone',
    roofColor: C.paved,
  });
}

function roofCourse(out, cx, cz, lower, upper, lod) {
  const ring = ([x, z, y]) => rect(cx - x, cz - z, cx + x, cz + z).map(([a, b]) => [a, y, b]);
  const a = ring(lower),
    b = ring(upper);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(out, 'tile', [a[i], a[j], b[j], b[i]], up, [C.clay, C.brightClay, C.clay, C.darkClay][i]);
    if (lod >= 2) {
      beam(out, 'tile', a[i], b[i], 0.106, 0.07, C.ridge);
      beam(out, 'timber', a[i], a[j], 0.11, 0.084, C.shadow);
    }
    if (lod === 3 && Math.hypot(a[i][0] - a[j][0], a[i][2] - a[j][2]) > 8)
      for (const f of [0.33, 0.66]) {
        const pts = [
          a[i].map((v, k) => mix(v, b[i][k], f)),
          a[j].map((v, k) => mix(v, b[j][k], f)),
        ];
        beam(out, 'tile', pts[0], pts[1], 0.027, 0.035, C.clay);
      }
  }
  cap(
    out,
    'tile',
    b.map(([x, , z]) => [x, z]),
    upper[2],
    C.ridge,
  );
}

function hip(out, cx, cz, w, d, base, height, lod) {
  const ridge = Math.max(0.36, Math.abs(w - d) * 0.45);
  const top = w >= d ? [ridge, 0.13, base + height] : [0.13, ridge, base + height];
  roofCourse(out, cx, cz, [w / 2, d / 2, base], top, lod);
  if (lod > 1) {
    if (w >= d)
      beam(
        out,
        'tile',
        [cx - ridge, base + height, cz],
        [cx + ridge, base + height, cz],
        0.16,
        0.12,
        C.ridge,
      );
    else
      beam(
        out,
        'tile',
        [cx, base + height, cz - ridge],
        [cx, base + height, cz + ridge],
        0.16,
        0.12,
        C.ridge,
      );
  }
}

function post(out, x, z, bottom, top, wide, lod) {
  const h = wide / 2;
  if (lod === 0) {
    block(out, 'wall', x - h, bottom, z - h, wide, top - bottom, wide, C.white);
    return;
  }
  block(out, 'stone', x - h * 1.24, bottom, z - h * 1.24, wide * 1.24, 0.27, wide * 1.24, C.base);
  block(out, 'wall', x - h, bottom + 0.23, z - h, wide, top - bottom - 0.23, wide, C.white);
  if (lod > 0) {
    block(
      out,
      'timber',
      x - h * 1.45,
      top - 0.24,
      z - h * 1.45,
      wide * 1.45,
      0.25,
      wide * 1.45,
      C.green,
    );
    block(
      out,
      'timber',
      x - h * 1.24,
      bottom + 0.31,
      z - h * 1.24,
      wide * 1.24,
      0.11,
      wide * 1.24,
      C.ivory,
    );
  }
}

function pavilionRoof(out, { x, z, roofW, roofD, floor, levels }, lod) {
  const eave = floor + 3.13;
  const w = roofW / 2,
    d = roofD / 2;
  if (levels === 2) {
    roofCourse(out, x, z, [w, d, eave], [w * 0.62, d * 0.6, eave + 2.33], lod);
    roofCourse(out, x, z, [w * 0.61, d * 0.59, eave + 2.5], [w * 0.33, 0.21, eave + 5.55], lod);
  } else {
    roofCourse(out, x, z, [w, d, eave], [w * 0.78, d * 0.77, eave + 1.25], lod);
    roofCourse(out, x, z, [w * 0.77, d * 0.76, eave + 1.32], [w * 0.5, d * 0.49, eave + 3.25], lod);
    roofCourse(out, x, z, [w * 0.5, d * 0.48, eave + 3.47], [w * 0.25, 0.19, eave + 6.25], lod);
  }
  if (lod >= 2) {
    const ridge = eave + (levels === 2 ? 5.55 : 6.25);
    beam(out, 'tile', [x - w * 0.27, ridge, z], [x + w * 0.27, ridge, z], 0.16, 0.11, C.ridge);
  }
}

function openPavilion(out, grade, lod, form) {
  const { x, z, wallW, wallD, floor, roofW, roofD } = form;
  const w = wallW / 2,
    d = wallD / 2;
  const plinth = rect(x - w, z - d, x + w, z + d);
  platform(out, plinth, grade, floor, C.base);
  pavilionRoof(out, form, lod);
  const eave = floor + 3.13;
  for (const dx of [-w + 0.48, w - 0.48])
    for (const dz of [-d + 0.43, 0, d - 0.43]) post(out, x + dx, z + dz, floor, eave, 0.52, lod);
  for (const dx of [-w / 3, w / 3])
    for (const dz of [-d + 0.43, d - 0.43]) post(out, x + dx, z + dz, floor, eave, 0.52, lod);
  if (lod > 0) {
    for (const dx of [-w * 0.43, w * 0.43])
      for (const dz of [-d * 0.39, d * 0.39])
        post(out, x + dx, z + dz, floor, eave + 1.4, 0.66, lod);
    for (const y of [eave - 0.28, eave - 0.13])
      for (const side of [-1, 1]) {
        beam(
          out,
          'timber',
          [x - w + 0.15, y, z + side * (d - 0.42)],
          [x + w - 0.15, y, z + side * (d - 0.42)],
          0.16,
          0.13,
          C.green,
        );
        beam(
          out,
          'timber',
          [x + side * (w - 0.42), y, z - d + 0.15],
          [x + side * (w - 0.42), y, z + d - 0.15],
          0.15,
          0.13,
          C.green,
        );
      }
  }
  if (lod >= 2) {
    const zFront = z + d;
    for (const dx of [-w + 0.54, -w / 3, w / 3, w - 0.54])
      beamPath(
        out,
        'timber',
        [
          [x + dx - 0.21, eave - 0.76, zFront - 0.43],
          [x + dx, eave - 0.39, zFront - 0.43],
          [x + dx + 0.21, eave - 0.76, zFront - 0.43],
        ],
        0.09,
        0.13,
        C.ivory,
      );
    const zBack = z - roofD / 2 + 0.73;
    const width = roofW * 0.42;
    block(out, 'timber', x - width / 2, floor + 0.11, zBack, width, 2.5, 0.35, C.shadow);
    for (let i = 0; i < 7; i++)
      block(
        out,
        'timber',
        x - width / 2 + (width * i) / 7,
        floor + 0.11,
        zBack + 0.34,
        0.06,
        2.5,
        0.07,
        C.green,
      );
  }
}

function gallery(out, polygon, grade, low, high, lod) {
  shell(out, polygon, (p) => Math.min(grade(p) - 0.22, low - 0.13), high, {
    wall: 'wall',
    color: C.white,
    roof: 'stone',
    roofColor: C.stone,
  });
  for (const [i, a] of polygon.entries()) {
    const w = edge(a, polygon[(i + 1) % polygon.length], areaSign(polygon));
    if (w.length < 3.3) continue;
    panel(out, 'stone', w, 0.03, w.length - 0.039, low - 0.25, low + 0.29, 0.03, C.base);
    const count = Math.max(1, Math.floor(w.length / (lod === 0 ? 7 : 3.85)));
    for (let j = 0; j < count; j++) {
      const x = (w.length * (j + 0.5)) / count;
      const dy = high - low > 4.5 ? [1.07, 3.6] : [1.19];
      for (const y of dy) {
        panel(out, 'timber', w, x - 0.63, x + 0.63, low + y - 0.09, low + y + 1.44, 0.048, C.green);
        panel(out, 'glass', w, x - 0.5, x + 0.5, low + y, low + y + 1.31, 0.072, C.glass);
        if (lod >= 2)
          for (const dd of [-0.24, 0, 0.24])
            panel(
              out,
              'timber',
              w,
              x + dd - 0.023,
              x + dd + 0.023,
              low + y,
              low + y + 1.31,
              0.082,
              C.ivory,
            );
      }
    }
    if (lod > 0)
      trimBlock(out, 'wall', w, 0.03, w.length - 0.03, high - 0.24, high, -0.02, 0.13, C.shade);
  }
}

function frontage(out, site, grade, lod) {
  const w = edge(site.at(-1), site[0], -1);
  const gateCenters = [15, 42, 91.5];
  const intervals = [
    [0, 12.3],
    [17.7, 39.6],
    [44.4, 88.2],
    [94.8, w.length],
  ];
  for (const [a, b] of intervals) {
    const va = w.p(a, 0),
      vb = w.p(b, 0),
      y = Math.min(grade([va[0], va[2]]), grade([vb[0], vb[2]]));
    trimBlock(out, 'stone', w, a, b, y - 0.45, y + 0.55, -0.19, 0.19, C.base);
    trimBlock(out, 'wall', w, a, b, y + 0.52, y + 0.76, -0.21, 0.22, C.white);
    if (lod === 0) continue;
    const gaps = Math.max(1, Math.round((b - a) / 4.1)),
      pitch = (b - a) / gaps;
    for (let i = 0; i <= gaps; i++) {
      const mid = a + pitch * i;
      trimBlock(out, 'wall', w, mid - 0.24, mid + 0.24, y + 0.39, y + 2.1, -0.32, 0.36, C.white);
      trimBlock(out, 'wall', w, mid - 0.33, mid + 0.33, y + 2.04, y + 2.2, -0.35, 0.39, C.ivory);
      if (i === gaps) continue;
      panel(out, 'grate', w, mid + 0.28, mid + pitch - 0.28, y + 0.79, y + 1.63, 0.14, C.yellow);
      if (lod >= 2)
        for (let j = 1; j <= 5; j++) {
          const v = mid + (pitch * j) / 6;
          panel(out, 'grate', w, v - 0.024, v + 0.024, y + 0.8, y + 1.63, 0.16, C.green);
        }
    }
  }
  for (const mid of gateCenters) {
    const [x, , z] = w.p(mid, 0);
    const y = grade([x, z]);
    for (const dx of [-1.99, 1.99]) post(out, x + dx, z, y, y + 2.18, 0.69, lod);
  }
  if (lod > 0) {
    const center = 54;
    const [x, , z] = w.p(center, 0);
    const y = grade([x, z]);
    trimBlock(
      out,
      'wall',
      w,
      center - 3.42,
      center + 3.42,
      y + 0.62,
      y + 2.56,
      -0.23,
      0.26,
      C.white,
    );
    panel(out, 'grate', w, center - 2.95, center + 2.95, y + 0.92, y + 2.25, 0.279, C.green);
  }
}

function draw(out, lod, { site, receiving, dalem, east, west, arts }, grade) {
  const floor = 2.53;
  const eave = floor + 3.13;
  const reception = {
    x: -0.41,
    z: 9.34,
    wallW: 16.25,
    wallD: 12.4,
    roofW: 20.45,
    roofD: 13.68,
    floor,
    levels: 2,
  };
  openPavilion(out, grade, lod, reception);
  platform(out, rect(-8.55, 1.03, 7.7, 3.26), grade, floor, C.base);
  for (const x of [-7.96, 7.08]) post(out, x, 2.3, floor, eave, 0.56, lod);
  hip(out, -0.43, 2.21, 17.16, 3.7, eave - 0.16, 1.47, lod);
  const gate = receiving.slice(2, 6),
    gateX = (gate[1][0] + gate[2][0]) * 0.5;
  const gz = (gate[1][1] + gate[2][1]) * 0.5 - 3.1;
  const gateGround = grade([gateX, gz]) + 0.19;
  for (const x of [gateX - 1.95, gateX + 1.95])
    post(out, x, gz, gateGround, gateGround + 2.81, 0.57, lod);
  hip(out, gateX, gz, 5.17, 6.91, gateGround + 2.91, 1.62, lod);
  if (lod > 0) {
    const w = edge([gateX - 1.625, gz + 0.37], [gateX + 1.625, gz + 0.37], -1);
    for (let i = 1; i < 12; i++) {
      const x = (w.length * i) / 12;
      panel(
        out,
        'grate',
        w,
        x - 0.018,
        x + 0.018,
        gateGround + 0.18,
        gateGround + 2.2,
        0.05,
        C.green,
      );
    }
  }
  gallery(out, dalem, grade, 2.5, 6.98, lod);
  hip(out, 0.29, -5.22, 13.77, 15.83, 7.02, 3.4, lod);
  hip(out, 2.2, -13.78, 9.77, 6.31, 7.06, 2.51, lod);
  gallery(out, east, grade, 2.34, 5.93, lod);
  hip(out, 23.35, -1.88, 18.47, 18.85, 5.97, 3.5, lod);
  hip(out, 11.91, -4.59, 9.04, 14.36, 5.99, 2.66, lod);
  gallery(out, west, grade, 1.73, 7.47, lod);
  hip(out, -23.21, 6.05, 11.86, 21.5, 7.5, 3.19, lod);
  hip(out, -15.89, -1.39, 20.8, 7.87, 7.52, 2.22, lod);
  const artsFloor = 1.63;
  const artsX = (arts[1][0] + arts[7][0]) * 0.5,
    z = (arts[1][1] + arts[7][1]) * 0.5;
  const artsForm = {
    x: artsX,
    z,
    wallW: 20,
    wallD: 21,
    roofW: 24,
    roofD: 21.6,
    floor: artsFloor,
    levels: 3,
  };
  openPavilion(out, grade, lod, artsForm);
  const artsDoor = 47.47;
  for (const x of [artsDoor - 2.48, artsDoor + 2.48])
    post(out, x, 14, artsFloor, artsFloor + 2.75, 0.46, lod);
  hip(out, artsDoor, 13.47, 7.75, 5.31, artsFloor + 2.89, 1.78, lod);
  platform(out, rect(44.3, 12.5, 50.4, 16.0), grade, artsFloor, C.base);
  const backdrop = rect(37.55, -9.79, 59.57, -7.42);
  gallery(out, backdrop, grade, 1.65, 4.48, lod);
  hip(out, 48.56, -8.68, 22.72, 3.36, 4.53, 1.31, lod);
  frontage(out, site, grade, lod);
}
const museum = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [104, 44, 98],
    lookAt: [13, 4.25, 1],
    yaw: 0.77,
    sun: [-395, 462, 570],
    brief:
      'Yogyakarta’s historic Sonobudoyo Unit I with the open Karsten pavilion, terracotta joglo roofs, gate, western wing and three-tier Pendapa Kesenian.',
    views: [
      {
        name: 'historic-frontage-and-receiving-pavilion',
        position: [-28, 12, 50],
        lookAt: [-2, 4.2, 10],
      },
      { name: 'karsten-roof-and-western-secretariat', position: [-40, 22, 4], lookAt: [0, 5.5, 1] },
      { name: 'pendapa-kesenian-open-arts-pavilion', position: [76, 18, 37], lookAt: [48, 5, 1] },
      { name: 'roof-envelopes-and-transition-range', position: [12, 75, -20], lookAt: [13, 2, 1] },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = museum;
export const model = {
  ...museum.model,
  category: 'museum',
  recipeDependencies: [...museum.model.recipeDependencies, 'authored-structure-mesh.mjs'],
  sourceLicense:
    'Independent geometry from the exact mapped footprint, original Terrarium terrain, the written regional heritage register, and the photographer’s CC0 image published by Qualla.',
};
