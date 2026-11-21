import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  block,
  closed,
  edge,
  face,
  mix,
  opening,
  pairs,
  palette,
  panel,
  pavilion,
  planarMid,
  plane,
  rect,
  ring,
  shell,
  stairs,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import controls from '../plan-controls.json' with { type: 'json' };

const surfaces = {
  plaster: surface('wall', 'plaster_lime'),
  concrete: surface('trim', 'concrete_plain'),
  stone: surface('foundation', 'stone_limestone_raw'),
  brick: surface('wall', 'brick_flemish'),
  glass: surface('window', 'window_grid', 0.63),
  roof: surface('roof', 'metal_corrugated', 0.87, 0.09),
  metal: surface('trim', 'metal_painted', 0.75, 0.14),
};
const C = palette({
  ivory: 'e0ddcb',
  white: 'e6e3d3',
  stone: 'aba79b',
  gray: 'a5a9a2',
  brick: '986453',
  deepBrick: '8d6051',
  glass: '687c7a',
  dark: '495651',
  milk: 'c6d4cc',
  roof: '8a9690',
  charcoal: '6e7874',
  terra: 'a45846',
});

function roofShell(out, polygon, grade, base, eaves, color = C.ivory) {
  shell(out, polygon, (p) => Math.min(base, grade(p) - 0.35), eaves, {
    wall: 'plaster',
    color,
    roof: 'roof',
    roofColor: C.roof,
  });
}

function glassBand(out, w, l, r, low, high, lod, vented = false) {
  opening(out, w, l, r, low, high, 'metal', C.glass, 'glass', C.white, lod, 0.049);
  if (lod < 1) return;
  const bays = Math.max(2, Math.ceil((r - l) / (lod === 1 ? 3 : 1.56)));
  for (let i = 1; i < bays; i++) {
    const x = mix(l, r, i / bays);
    panel(out, 'metal', w, x - 0.037, x + 0.037, low, high, 0.095, C.white);
  }
  if (lod >= 2 && vented) {
    const count = lod === 3 ? 8 : 4;
    for (let i = 1; i < count; i++) {
      const y = mix(low, high, i / count);
      panel(out, 'metal', w, l, r, y - 0.023, y + 0.023, 0.085, C.white);
    }
  }
}

function eavesLine(out, w, y, lod, color = C.white) {
  if (w.length < 0.3) return;
  if (lod > 0) trimBlock(out, 'concrete', w, 0, w.length, y - 0.18, y + 0.1, -0.035, 0.22, color);
  else panel(out, 'concrete', w, 0, w.length, y - 0.18, y, 0.05, color);
}

function pyramid(out, polygon, eave, peak, lod) {
  const [x, z] = planarMid(polygon);
  for (const [[a, b], [u, v]] of pairs(closed(polygon))) {
    face(
      out,
      'roof',
      [
        [a, eave, b],
        [u, eave, v],
        [x, peak, z],
      ],
      up,
      C.roof,
    );
    if (lod >= 2) beam(out, 'metal', [a, eave, b], [x, peak, z], 0.13, 0.15, C.charcoal);
  }
}

function shallowRoof(out, x0, z0, x1, z1, y, rise, lod) {
  const m = (z0 + z1) / 2;
  const peak = y + rise;
  for (const end of [z0, z1])
    face(
      out,
      'roof',
      [
        [x0, y, end],
        [x1, y, end],
        [x1, peak, m],
        [x0, peak, m],
      ],
      up,
      C.roof,
    );
  for (const [x, n] of [
    [x0, -1],
    [x1, 1],
  ])
    face(
      out,
      'plaster',
      [
        [x, y, z0],
        [x, y, z1],
        [x, peak, m],
      ],
      [n, 0, 0],
      C.ivory,
    );
  if (lod >= 1) beam(out, 'metal', [x0, peak, m], [x1, peak, m], 0.14, 0.15, C.charcoal);
}

function screen(out, w, left, right, y, h, lod) {
  if (lod < 2) {
    panel(out, 'concrete', w, left, right, y, y + h, 0.044, C.gray);
    return;
  }
  const columns = Math.max(2, Math.round((right - left) / 0.71));
  const rows = lod === 3 ? 4 : 3;
  const dx = (right - left) / columns,
    dy = h / rows;
  panel(out, 'stone', w, left, right, y, y + h, 0.029, C.dark);
  for (let i = 0; i <= columns; i++) {
    const x = left + i * dx;
    trimBlock(out, 'concrete', w, x - 0.078, x + 0.078, y, y + h, 0.045, 0.16, C.white);
  }
  for (let i = 0; i <= rows; i++) {
    const h0 = y + i * dy;
    trimBlock(out, 'concrete', w, left, right, h0 - 0.053, h0 + 0.053, 0.047, 0.17, C.white);
  }
}

function lobby(out, lod, grade, dimensions) {
  const left = -24.85,
    right = -7.08,
    front = -5.74,
    back = 6.38;
  const floor = Math.max(0.06, grade([dimensions.entrance[0], front]) + 0.89);
  const roofY = floor + 6.15;
  const west = edge([left, back], [left, front]);
  const north = plane(front - 0.01, -1);
  const rear = plane(back + 0.02, 1);
  const building = rect(left, front, right, back);
  shell(out, building, (p) => Math.min(grade(p) - 0.38, floor - 0.2), floor, {
    wall: 'stone',
    color: C.stone,
  });
  shell(out, building, () => floor, roofY, {
    wall: 'plaster',
    color: C.ivory,
    roof: 'roof',
    roofColor: C.roof,
  });
  glassBand(out, west, 0.18, west.length - 0.16, floor + 0.22, roofY - 1.27, lod, true);
  glassBand(out, north, -21.91, -10.49, floor + 0.2, roofY - 1.48, lod, true);
  screen(out, north, -22.65, -9.08, roofY - 1.36, 0.91, lod);
  screen(out, rear, -23.79, -15.33, floor + 0.95, 3.78, lod);
  eavesLine(out, west, roofY, lod);
  const coral = lod >= 1 ? C.terra : C.ivory;
  const s = dimensions.entrance[0];
  block(out, 'concrete', s - 5.36, roofY - 1.14, front - 4.41, 10.72, 0.33, 4.64, C.white);
  for (const x of [s - 4.69, s + 4.69])
    ring(
      out,
      'concrete',
      [x, front - 3.89],
      [
        [floor, 0.18],
        [roofY - 1.12, 0.16],
      ],
      lod < 2 ? 6 : 12,
      coral,
    );
  const porch = rect(s - 5.35, front - 4.45, s + 5.35, front + 0.1);
  shell(out, porch, (p) => Math.min(floor - 0.14, grade(p) - 0.2), floor, {
    wall: 'stone',
    color: C.stone,
    roof: 'concrete',
    roofColor: C.gray,
  });
  stairs(
    out,
    grade,
    'concrete',
    s - 2.43,
    s + 2.43,
    front - 6.11,
    front - 4.39,
    floor,
    lod >= 2 ? 4 : 2,
    C.gray,
  );
  opening(
    out,
    north,
    s - 1.53,
    s + 1.53,
    floor + 0.04,
    roofY - 2.07,
    'metal',
    C.dark,
    'glass',
    C.white,
    lod,
    0.122,
  );
  block(
    out,
    'stone',
    right - 0.58,
    floor - 0.22,
    front - 0.43,
    0.64,
    roofY - floor + 0.67,
    back - front + 0.5,
    C.stone,
  );
  const at = dimensions.lowSkylight,
    r = 2.85;
  ring(
    out,
    'concrete',
    at,
    [
      [roofY - 0.1, r - 0.11],
      [roofY + 0.15, r],
    ],
    lod > 1 ? 20 : 8,
    C.white,
  );
  ring(
    out,
    'glass',
    at,
    [
      [roofY + 0.13, r - 0.12],
      [roofY + 0.52, r * 0.78],
      [roofY + 0.79, r * 0.42],
      [roofY + 0.88, 0.082],
    ],
    lod > 1 ? 20 : 8,
    C.milk,
  );
}

function sashTwelve(out, w, lod, y) {
  const width = w.length / 9;
  const top = y + 5.25;
  if (lod === 0) {
    panel(out, 'plaster', w, 0, w.length, y, top, 0, C.ivory);
    return;
  }
  for (let i = 0; i < 9; i++) {
    const start = width * i,
      end = width * (i + 1);
    const step = end - width * 0.23;
    const wall = [w.p(start, y, 0), w.p(step, y, -0.79), w.p(step, top, -0.79), w.p(start, top, 0)];
    face(out, 'plaster', wall, w.normal, C.ivory);
    const inside = {
      normal: w.normal,
      p: (u, h, d = 0) => w.p(u, h, -0.79 + d),
    };
    glassBand(out, inside, step, end, y + 0.69, top - 0.32, lod, true);
    panel(out, 'stone', inside, step, end, y, y + 0.68, 0.04, C.stone);
    panel(out, 'plaster', inside, step, end, top - 0.32, top, 0, C.ivory);
  }
}

function coreAndGalleries(out, lod, dimensions, grade) {
  const p = dimensions.outline;
  const base = -0.42;
  const core = [p[12], p[13], p[17], p[18], p[30], p[11]];
  roofShell(out, core, grade, base - 1.2, 5.91);
  const westOutline = [p[14], p[15], p[16], p[17]];
  const eave = 6.67;
  const sign = areaSign(westOutline);
  shell(
    out,
    westOutline,
    (p) => Math.min(grade(p) - 0.35, base),
    eave,
    { wall: 'plaster', color: C.ivory, roof: 'roof', roofColor: C.roof },
    (i) => i !== 0,
  );
  const saw = edge(westOutline[0], westOutline[1], sign);
  panel(out, 'stone', saw, 0, saw.length, -2.4, eave - 5.25, -0.011, C.stone);
  sashTwelve(out, saw, lod, eave - 5.25);
  eavesLine(out, saw, eave, lod);
  const north = edge(westOutline[1], westOutline[2], sign);
  glassBand(out, north, 0.72, north.length - 0.72, 2.03, 5.32, lod, true);
  shallowRoof(out, -34.74, -47.35, -25.91, -5.62, eave, 1.57, lod);

  const wings = [
    { p: [p[18], p[19], p[20], p[21], p[22], p[23], p[24]], size: 8.1 },
    { p: [p[24], p[25], p[26], p[27]], size: 7.91 },
    { p: [p[29], p[28], p[27], p[24], p[18], p[30]], size: 6.29 },
  ];
  for (const { p: polygon, size } of wings) {
    const center = planarMid(polygon);
    const y = grade(center) + size;
    roofShell(out, polygon, grade, base, y);
    const s = areaSign(polygon);
    for (const [a, b] of pairs(closed(polygon))) {
      const w = edge(a, b, s);
      if (w.length < 5.9) continue;
      eavesLine(out, w, y, lod);
      glassBand(out, w, 0.56, w.length - 0.56, y - 2.16, y - 0.85, lod, true);
      if (lod >= 1) {
        const low = y - size * 0.78;
        glassBand(out, w, 0.55, w.length - 0.61, low + 0.14, low + 1.18, Math.max(0, lod - 1));
        panel(out, 'stone', w, 0.37, w.length - 0.44, low - 1.21, low + 0.02, 0.062, C.stone);
      }
    }
  }

  const link = [p[0], p[1], p[10], p[11]];
  const linkY = grade(planarMid(link)) + 5.95;
  roofShell(out, link, grade, base, linkY, C.ivory);
  const long = edge(p[10], p[11], areaSign(link));
  glassBand(out, long, 0.45, long.length - 0.45, linkY - 2.24, linkY - 1.1, lod);
}

function octagonalGallery(out, lod, polygon, grade) {
  const center = planarMid(polygon);
  const foundation = grade(center);
  const eaves = foundation + 10.85;
  const sign = areaSign(polygon);
  shell(out, polygon, (p) => grade(p) - 0.44, eaves, {
    wall: 'brick',
    color: C.brick,
    roof: 'roof',
    roofColor: C.roof,
  });
  pyramid(out, polygon, eaves, eaves + 4.6, lod);
  for (const [a, b] of pairs(closed(polygon))) {
    const w = edge(a, b, sign);
    eavesLine(out, w, eaves, lod, C.gray);
    panel(out, 'concrete', w, 0, w.length, eaves - 4.31, eaves - 3.94, 0.055, C.gray);
    if (lod > 0) {
      trimBlock(
        out,
        'concrete',
        w,
        0.05,
        0.41,
        foundation + 0.12,
        eaves - 0.15,
        -0.03,
        0.16,
        C.gray,
      );
      if (w.normal[2] < 0.56) {
        const l = w.length * 0.19,
          r = w.length - l;
        glassBand(out, w, l, r, eaves - 3.06, eaves - 1.07, lod, true);
        if (w.normal[0] < -0.33)
          panel(
            out,
            'brick',
            w,
            l,
            l + (r - l) * 0.28,
            eaves - 3.07,
            eaves - 1.06,
            0.112,
            C.deepBrick,
          );
      }
    }
  }
}

function build(out, lod, dimensions, grade) {
  coreAndGalleries(out, lod, dimensions, grade);
  lobby(out, lod, grade, dimensions);
  octagonalGallery(out, lod, dimensions.octagon, grade);
}

const bundle = pavilion(
  import.meta.url,
  {
    surfaces,
    brief:
      '1954 Uganda National Museum and linked galleries on Kitante Hill. Includes the thin porch on columns, concrete screens, pale skylight, saw-leaf gallery, and the later octagonal Natural History Gallery.',
    camera: [-78, 34, -73],
    lookAt: [-10, 3.1, -2],
    sun: [-280, 480, -390],
    yaw: 0.55,
    views: [
      { name: 'entrance-canopy-and-screen', position: [-12, 6.8, -27], lookAt: [-16, 3.05, -5] },
      { name: 'saw-leaf-gallery', position: [-66, 12, -23], lookAt: [-29, 3.7, -23] },
      { name: 'natural-history-octagon', position: [-65, 19, 66], lookAt: [-24, 3, 17] },
    ],
  },
  build,
);
export const { model, skyline, district, street, closeup } = bundle;
model.buildingCutout = {
  outline: controls.dimensions.outline,
  minimumCoverage: 0.9,
  basis: 'Matched Kiira Road museum building outline removes the overlapping generic mass.',
};
