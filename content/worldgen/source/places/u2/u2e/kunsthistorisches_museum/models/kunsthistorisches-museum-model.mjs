/** Vienna's Kunsthistorisches Museum, with the two open courts and its square-facing dome. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const load = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = load('plan-controls');
const frame = load('map-frame');
const grid = load('terrain-grid');
const [outer, ...courts] = frame.geometry.polygons;
const center = 2.55;
const domeZ = 21.7;
const stoneRoof = 27.05;
const surfaces = {
  masonry: { slot: 'wall', graph: 'stone_limestone', roughness: 0.92 },
  limestone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.91 },
  base: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.95 },
  slate: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.87 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.81, metalness: 0.17 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.49, metalness: 0.1 },
};
const c = Object.fromEntries(
  Object.entries({
    stone: 'c0ac8b',
    stoneLight: 'd6c3a0',
    trim: 'cdb58e',
    shadowStone: 'ac9675',
    plinth: 'b2a084',
    graphite: '5e6662',
    slate: '686c67',
    copper: '4f5954',
    seam: '68706a',
    shadow: '49413a',
    glass: '525e5f',
    clear: '68716b',
    frame: '796a54',
    timber: '724936',
    bronze: '697967',
  }).map(([key, value]) => [key, rgb(value)]),
);
const mix = (a, b, t) => a + (b - a) * t;
const at = ([x, z], y) => [x, y, z];
const size = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
function ground(x, z) {
  const u = (x - grid.origin[0]) / grid.stepMeters,
    v = (z - grid.origin[1]) / grid.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const a = u - i,
    b = v - j,
    h = grid.heightsMeters;
  return (
    mix(mix(h[j][i], h[j][i + 1], a), mix(h[j + 1][i], h[j + 1][i + 1], a), b) -
    grid.modelDatumElevationMeters
  );
}

function panel(out, slot, x0, x1, y0, y1, z, tint) {
  face(
    out,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    tint,
  );
}

function block(out, slot, x, y, z, w, h, d, tint) {
  box(out, slot, [x - w / 2, y, z], [x + w / 2, y + h, z + d], tint);
}

function signedArea(ring) {
  return ring.reduce((s, [x, z], i) => {
    const [nx, nz] = ring[(i + 1) % ring.length];
    return s + x * nz - nx * z;
  }, 0);
}

function simplified(ring) {
  return ring.filter((p, i) => {
    const a = ring[(i + ring.length - 1) % ring.length],
      b = ring[(i + 1) % ring.length];
    const length = size(a, b);
    if (length < 1e-6) return true;
    return Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) / length > 0.18;
  });
}

function roofDeck(out, rings, y, slot, tint) {
  const points = rings.flat(),
    holes = [];
  let index = rings[0].length;
  for (const ring of rings.slice(1)) {
    holes.push(index);
    index += ring.length;
  }
  const indices = earcut(points.flat(), holes);
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, d] = indices.slice(i, i + 3).map((k) => at(points[k], y));
    triangle(out, slot, [a, d, b], tint);
  }
}

function lowWall(out, lo, hi, inner, lod) {
  panel(out, 'masonry', lo, hi, 0, stoneRoof, 0, inner ? c.shadowStone : c.stone);
  if (hi - lo <= 4) return;
  if (inner && lod === 0) return;
  const count = Math.max(1, Math.round((hi - lo) / (lod === 0 ? 23.5 : 6)));
  const width = (hi - lo) / count;
  for (let index = 0; index < count; index++) {
    const x = lo + (index + 0.5) * width;
    const half = width * 0.275;
    for (const [bottom, spring, rise] of lod === 0
      ? [[13.26, 19.61, 1.78]]
      : [
          [2.54, 7.05, 1.35],
          [13.26, 19.61, 1.78],
        ]) {
      panel(out, 'glass', x - half, x + half, bottom, spring, 0.025, c.glass);
      if (lod === 0) continue;
      const points = Array.from({ length: 5 }, (_, i) => {
        const a = Math.PI * (i / 4);
        return [x - half * Math.cos(a), spring + rise * Math.sin(a), 0.025];
      });
      for (let i = 0; i < 4; i++)
        triangle(out, 'glass', [[x, spring - 0.01, 0.025], points[i + 1], points[i]], c.clear);
    }
    if (lod >= 1)
      panel(out, 'glass', x - half * 0.71, x + half * 0.71, 24.93, 26.2, 0.019, c.shadow);
  }
}

function archLevel(out, w, low, high, sill, spring, rise, width, depth, lod, door = false) {
  const r = width / 2,
    left = -w / 2,
    right = w / 2;
  const divisions = lod === 2 ? 5 : 8;
  const bottomTone = low < 5 ? c.plinth : c.stone;
  if (sill > low + 0.002) panel(out, 'masonry', left, right, low, sill, 0, bottomTone);
  panel(out, 'masonry', left, -r, sill, high, 0, bottomTone);
  panel(out, 'masonry', r, right, sill, high, 0, bottomTone);
  const z = -depth;
  const tint = door ? c.timber : c.glass;
  panel(out, 'glass', -r, r, sill, spring, z, tint);
  face(
    out,
    'limestone',
    [
      [-r, sill, z],
      [-r, spring, z],
      [-r, spring, 0],
      [-r, sill, 0],
    ],
    c.plinth,
  );
  face(
    out,
    'limestone',
    [
      [r, sill, 0],
      [r, spring, 0],
      [r, spring, z],
      [r, sill, z],
    ],
    c.plinth,
  );
  face(
    out,
    'limestone',
    [
      [-r, sill, 0],
      [r, sill, 0],
      [r, sill, z],
      [-r, sill, z],
    ],
    c.trim,
  );
  const outline = (i, radius, height) => {
    const angle = (Math.PI * i) / divisions;
    return [-radius * Math.cos(angle), spring + height * Math.sin(angle)];
  };
  for (let i = 0; i < divisions; i++) {
    const a = outline(i, r, rise),
      b = outline(i + 1, r, rise);
    const aa = outline(i, r + 0.18, rise + 0.18),
      bb = outline(i + 1, r + 0.18, rise + 0.18);
    if (rise > 0) {
      face(
        out,
        'masonry',
        [
          [a[0], a[1], 0],
          [b[0], b[1], 0],
          [b[0], high, 0],
          [a[0], high, 0],
        ],
        bottomTone,
      );
      face(
        out,
        'limestone',
        [
          [a[0], a[1], z],
          [b[0], b[1], z],
          [b[0], b[1], 0],
          [a[0], a[1], 0],
        ],
        c.shadowStone,
      );
      triangle(
        out,
        'glass',
        [
          [0, spring, z],
          [b[0], b[1], z],
          [a[0], a[1], z],
        ],
        door ? c.shadow : c.clear,
      );
      if (lod >= 2) {
        const zTrim = 0.075;
        face(
          out,
          'limestone',
          [
            [a[0], a[1], zTrim],
            [b[0], b[1], zTrim],
            [bb[0], bb[1], zTrim],
            [aa[0], aa[1], zTrim],
          ],
          i === Math.floor(divisions / 2) ? c.stoneLight : c.trim,
        );
      }
    }
  }
  if (lod < 2) return;
  block(out, 'limestone', 0, sill - 0.18, -0.12, width + 0.47, 0.2, 0.53, c.trim);
  if (!door && lod === 3)
    block(out, 'limestone', 0, sill - 0.4, -0.1, width + 0.18, 0.19, 0.34, c.shadowStone);
  for (const x of [-r + 0.024, r - 0.024])
    panel(out, 'limestone', x - 0.09, x + 0.09, sill, spring, 0.088, c.trim);
  const lower = sill + (spring - sill) * 0.57;
  const louver = door ? c.shadow : c.frame;
  panel(out, 'limestone', -r, r, lower - 0.036, lower + 0.036, z + 0.048, louver);
  panel(out, 'limestone', -0.045, 0.045, sill, spring + rise - 0.08, z + 0.048, louver);
  if (lod === 3) {
    for (const x of [-r * 0.52, r * 0.52]) {
      panel(out, 'limestone', x - 0.023, x + 0.023, sill, spring - 0.01, z + 0.055, louver);
    }
    if (!door)
      block(out, 'limestone', 0, spring + rise - 0.035, 0.08, 0.26, 0.32, 0.25, c.stoneLight);
  }
}

function upperWindow(out, w, lod) {
  const r = Math.min(1.19, w * 0.26);
  panel(out, 'masonry', -w / 2, w / 2, 24.6, stoneRoof, 0, c.stone);
  panel(out, 'glass', -r, r, 24.9, 26.32, 0.025, c.shadow);
  if (lod >= 2) {
    for (const x of [-r, 0, r])
      panel(out, 'limestone', x - 0.048, x + 0.048, 24.91, 26.31, 0.055, c.trim);
    for (const y of [24.89, 26.34])
      block(out, 'limestone', 0, y, -0.03, 2 * r + 0.42, 0.13, 0.31, c.trim);
  }
}

function facadeBay(out, w, lod, door, inner, rustic) {
  const opening = w * (door ? 0.62 : inner ? 0.46 : 0.56);
  archLevel(
    out,
    w,
    0,
    11.14,
    door ? 0.36 : 2.42,
    door ? 7.7 : 7.1,
    door ? 1.76 : 1.37,
    opening,
    door ? 1.18 : 0.68,
    lod,
    door,
  );
  archLevel(out, w, 11.14, 24.6, 13.24, 19.65, 1.92, w * (inner ? 0.54 : 0.61), 0.78, lod);
  upperWindow(out, w, lod);
  if (lod < 2) return;
  const gap = opening * 0.5 + 0.14;
  if (!inner) {
    for (const x of [-w / 2 + 0.085, w / 2 - 0.085]) {
      block(out, 'limestone', x, 11.77, -0.12, w * 0.09, 11.44, 0.48, c.trim);
      for (const y of [11.57, 22.7])
        panel(out, 'limestone', x - w * 0.07, x + w * 0.07, y, y + 0.5, 0.51, c.stoneLight);
    }
  }
  if (!rustic) return;
  for (let y = 1.33; y < 10.8; y += 1.12) {
    const long = y < 2.37 || y > 9.73;
    if (long) panel(out, 'base', -w / 2, w / 2, y, y + 0.042, 0.028, c.shadowStone);
    else {
      panel(out, 'base', -w / 2, -gap, y, y + 0.042, 0.029, c.shadowStone);
      panel(out, 'base', gap, w / 2, y, y + 0.042, 0.029, c.shadowStone);
    }
  }
  if (lod === 3 && !inner) {
    block(out, 'limestone', 0, 21.92, -0.08, w * 0.76, 0.32, 0.44, c.trim);
    block(out, 'limestone', 0, 12.7, -0.09, w * 0.63, 0.3, 0.37, c.stoneLight);
  }
}

function balustrade(out, length, lod, inner) {
  if (inner || lod < 2) return;
  if (lod === 2) {
    panel(out, 'limestone', 0, length, 27.2, 27.76, 0.096, c.stoneLight);
    panel(out, 'limestone', 0, length, 28.53, 28.85, 0.091, c.trim);
  } else {
    block(out, 'limestone', length / 2, 27.26, -0.28, length, 0.48, 0.55, c.stoneLight);
    block(out, 'limestone', length / 2, 28.53, -0.29, length, 0.31, 0.57, c.trim);
  }
  const count = Math.max(1, Math.round(length / (lod === 2 ? 3.5 : 1.16)));
  for (let i = 0; i < count; i++) {
    const x = (length * (i + 0.5)) / count;
    if (lod === 2) panel(out, 'limestone', x - 0.13, x + 0.13, 27.74, 28.54, 0.035, c.trim);
    else block(out, 'limestone', x, 27.73, -0.16, 0.22, 0.8, 0.32, c.trim);
    if (lod === 3 && i % 4 === 1)
      block(out, 'limestone', x, 27.75, -0.19, 0.31, 0.23, 0.38, c.stoneLight);
  }
}

function wallLoop(out, input, lod, inner) {
  const native = simplified(input);
  const aim = inner ? 1 : -1;
  const ring = signedArea(native) * aim > 0 ? native : [...native].reverse();
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      length = size(a, b);
    if (length < 0.005) continue;
    const angle = Math.atan2(a[1] - b[1], b[0] - a[0]);
    const local = transform(out, angle, [a[0], 0, a[1]]);
    const m = [mix(a[0], b[0], 0.5), mix(a[1], b[1], 0.5)];
    const base = Math.min(ground(...a), ground(...b), ground(...m), 0) - 0.48;
    panel(local, 'base', 0, length, base, 0.02, 0, c.plinth);
    const regular = length > 4.55;
    const entrance = !inner && m[1] > 35.2 && Math.abs(m[0] - center) < 5.8;
    const fine = lod === 3 || (lod === 2 && !inner && m[1] > 25);
    if (!fine || !regular) lowWall(local, 0, length, inner, lod);
    else {
      const count = Math.max(1, Math.round(length / (inner ? 6.3 : 5.95)));
      const w = length / count;
      for (let j = 0; j < count; j++)
        facadeBay(transform(local, 0, [(j + 0.5) * w, 0, 0]), w, lod, entrance, inner, true);
    }
    if (length > 1.2) {
      for (const [y, h, d] of [
        [1.09, 0.44, 0.28],
        [10.53, 0.52, 0.35],
        [11.48, 0.34, 0.45],
        [23.78, 0.46, 0.31],
        [26.82, 0.49, 0.464],
      ]) {
        if (lod === 0) {
          if (y === 26.82 && length > 12)
            panel(local, 'limestone', 0, length, y, y + h, 0.07, c.trim);
        } else if (lod === 1 || (lod === 2 && (!fine || y < 10))) {
          panel(local, 'limestone', 0, length, y, y + h, 0.075, c.trim);
        } else {
          block(local, 'limestone', length / 2, y, -0.17, length, h, d, c.trim);
        }
      }
      balustrade(local, length, lod, inner);
    }
  }
}

function roofStrips(out, lod) {
  if (lod === 0) return;
  const strips = [];
  for (const court of courts) {
    const xs = court.map((p) => p[0]),
      min = Math.min(...xs) + 2.6,
      max = Math.max(...xs) - 2.6;
    for (const dir of [-1, 1]) strips.push([min, max, dir * 12.25, dir * 28.9, dir * 20.8]);
  }
  strips.push([-9.95, 14.85, -27, -12.05, -19.7]);
  for (const [lo, hi, inner, outerZ, ridge] of strips) {
    const r = stoneRoof + 2.28;
    for (const edge of [inner, outerZ]) {
      const p = [
        [lo, stoneRoof, edge],
        [hi, stoneRoof, edge],
        [hi - 3.2, r, ridge],
        [lo + 3.2, r, ridge],
      ];
      face(out, 'slate', edge < ridge ? p.slice().reverse() : p, c.slate);
      if (lod === 3) {
        const length = hi - lo;
        const count = Math.max(6, Math.round(length / (lod === 3 ? 2.55 : 6.7)));
        for (let i = 1; i < count; i++) {
          const t = i / count;
          beam(
            out,
            'slate',
            [mix(lo, hi, t), stoneRoof + 0.035, edge],
            [mix(lo + 3.2, hi - 3.2, t), r + 0.035, ridge],
            0.058,
            0.04,
            c.graphite,
          );
        }
      }
    }
    for (const x of [lo, hi]) {
      const p = [
        [x, stoneRoof, inner],
        [x, stoneRoof, outerZ],
        [x + (x === lo ? 3.2 : -3.2), r, ridge],
      ];
      triangle(
        out,
        'slate',
        x === lo
          ? inner < outerZ
            ? p
            : p.slice().reverse()
          : inner > outerZ
            ? p
            : p.slice().reverse(),
        c.slate,
      );
    }
  }
}

function roofLantern(out, x, z, lod) {
  const y = 31.84;
  const facets = lod === 0 ? 4 : 8;
  const rings = (entries) =>
    entries.map(([elev, r]) => radialRing(elev, r, r, facets, [x, z], Math.PI / 8));
  loft(
    out,
    'limestone',
    rings([
      [y - 1.15, 2.39],
      [y, 2.39],
      [y + 0.62, 1.96],
    ]),
    c.trim,
  );
  if (lod === 0)
    loft(
      out,
      'limestone',
      rings([
        [y + 0.61, 1.37],
        [y + 5.0, 1.37],
      ]),
      c.trim,
    );
  else {
    const lower = rings([[y + 0.58, 1.67]])[0],
      upper = rings([[y + 5.12, 1.58]])[0];
    for (let i = 0; i < facets; i++) {
      beam(out, 'limestone', lower[i], upper[i], lod === 3 ? 0.52 : 0.55, 0.57, c.stoneLight);
      if (lod >= 2)
        for (const [p, h] of [
          [lower[i], 0.33],
          [upper[i], 0.2],
        ])
          block(out, 'limestone', p[0], p[1], p[2] - 0.45, 0.83, h, 0.9, c.trim);
    }
  }
  loft(
    out,
    'limestone',
    rings([
      [y + 4.92, 1.91],
      [y + 5.18, 2.12],
      [y + 5.46, 1.96],
    ]),
    c.stoneLight,
  );
  loft(
    out,
    'copper',
    rings([
      [y + 5.41, 2.02],
      [y + 6.45, 1.81],
      [y + 7.32, 0.98],
      [y + 7.97, 0.27],
    ]),
    c.copper,
  );
  if (lod >= 1)
    loft(
      out,
      'copper',
      rings([
        [y + 7.85, 0.37],
        [y + 8.73, 0.14],
        [y + 8.93, 0.06],
      ]),
      c.seam,
    );
}

function pavilion(out, lod) {
  const x = center;
  const z = domeZ;
  block(out, 'masonry', x, 26.8, 12.15, 27.65, 4.78, 23.92, c.stone);
  for (const [y, h, width, depth] of [
    [29.06, 0.52, 29.0, 23.85],
    [30.53, 0.61, 28.8, 23.4],
    [31.38, 0.48, 27.7, 23.05],
  ]) {
    if (lod > 0) block(out, 'limestone', x, y, 12.62, width, h, depth, c.trim);
  }
  const n = 8;
  const radius = 8.69;
  const phase = Math.PI / 8;
  const atRing = (y, r) => radialRing(y, r, r, n, [x, z], phase);
  loft(out, 'limestone', [atRing(31.55, 9.18), atRing(34.09, 9.18), atRing(35.18, radius)], c.trim);
  const bottom = atRing(35.1, radius),
    top = atRing(43.71, radius);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = bottom[i],
      b = bottom[j];
    const length = Math.hypot(b[0] - a[0], b[2] - a[2]),
      angle = Math.atan2(a[2] - b[2], b[0] - a[0]);
    const panelOut = transform(out, angle, [(a[0] + b[0]) / 2, 35.1, (a[2] + b[2]) / 2]);
    if (lod < 2) {
      face(out, 'masonry', [a, b, top[j], top[i]], c.stone);
      panel(panelOut, 'glass', -length * 0.21, length * 0.21, 2.08, 6.01, 0.018, c.glass);
    } else {
      archLevel(
        panelOut,
        length,
        0,
        8.61,
        1.41,
        5.63,
        1.05,
        Math.min(2.69, length * 0.52),
        0.67,
        lod,
      );
      block(panelOut, 'limestone', -length * 0.43, 1.0, -0.19, 0.48, 6.77, 0.57, c.stoneLight);
      block(panelOut, 'limestone', length * 0.43, 1.0, -0.19, 0.48, 6.77, 0.57, c.stoneLight);
    }
  }
  loft(
    out,
    'limestone',
    [atRing(43.65, 8.72), atRing(43.98, 9.16), atRing(44.45, 9.0), atRing(44.72, 8.62)],
    c.stoneLight,
  );
  const segments = [6, 16, 24, 32][lod];
  const profile = [
    [44.71, 8.49],
    [46.8, 8.21],
    [48.75, 7.36],
    [50.62, 6.02],
    [52.01, 4.54],
    [53.22, 3.03],
    [54.06, 1.64],
  ];
  const dome = (lod === 0 ? profile.filter((_, i) => i % 2 === 0) : profile).map(([y, r]) =>
    radialRing(y, r, r, segments, [x, z], phase),
  );
  loft(out, 'copper', dome, c.copper);
  if (lod >= 2) {
    for (let i = 0; i < segments; i += segments / 8) {
      for (let j = 1; j < dome.length; j++) {
        const r0 = profile[j - 1][1],
          r1 = profile[j][1],
          a = dome[j - 1][i],
          b = dome[j][i];
        const rib = (p, r) => [
          p[0] + ((p[0] - x) * 0.08) / r,
          p[1] + 0.02,
          p[2] + ((p[2] - z) * 0.08) / r,
        ];
        beam(out, 'copper', rib(a, r0), rib(b, r1), 0.128, 0.11, c.seam);
      }
    }
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const local = transform(out, angle, [x, 47.1, z]);
      block(local, 'copper', 0, 0, 7.94, 1.32, 1.65, 0.48, c.seam);
      block(local, 'glass', 0, 0.34, 8.38, 0.87, 0.97, 0.07, c.shadow);
      block(local, 'copper', 0, 1.52, 7.9, 1.52, 0.32, 0.65, c.seam);
    }
  }
  loft(
    out,
    'copper',
    [
      atRing(54.0, 1.84),
      atRing(54.38, 1.79),
      atRing(54.7, 1.17),
      atRing(56.2, 1.11),
      atRing(56.48, 1.46),
      atRing(57.26, 0.74),
      atRing(57.71, 0.42),
    ],
    c.copper,
  );
  if (lod >= 2) {
    for (const [x, z] of atRing(0, 1.0).map(([x, , z]) => [x, z]))
      block(out, 'copper', x, 54.69, z - 0.115, 0.21, 1.59, 0.225, c.seam);
  }
  figure(out, x, 57.68, z, 2.1, lod, true);
  for (const offset of [-11.48, 11.42]) roofLantern(out, x + offset, 32.8, lod);
}

function figure(out, x, y, z, h, lod, athena = false) {
  const material = athena ? 'copper' : 'limestone',
    color = athena ? c.bronze : c.trim;
  const n = lod === 3 ? 8 : 5,
    r = h * 0.12;
  const buildRing = (k, w) => radialRing(y + k * h, w * r, w * r * 0.85, n, [x, z]);
  loft(
    out,
    material,
    [
      buildRing(0, 1.24),
      buildRing(0.13, 1.15),
      buildRing(0.52, 0.86),
      buildRing(0.7, 0.99),
      buildRing(0.84, 0.49),
    ],
    color,
  );
  if (lod >= 1) {
    sphere(out, material, [x, y + h * 0.914, z], [r * 0.49, h * 0.086, r * 0.54], color, n, 4);
    if (lod >= 2) {
      beam(
        out,
        material,
        [x + r * 0.72, y + h * 0.71, z],
        [x + r * 1.36, y + h * 0.48, z + r * 0.52],
        r * 0.38,
        r * 0.41,
        color,
      );
      beam(
        out,
        material,
        [x - r * 0.72, y + h * 0.7, z],
        [x - r * 1.09, y + h * 0.53, z + r * 0.65],
        r * 0.4,
        r * 0.41,
        color,
      );
    }
  }
  if (athena && lod >= 1) {
    beam(
      out,
      material,
      [x - r * 1.22, y + h * 0.05, z],
      [x - r * 1.32, y + h * 1.11, z],
      0.079,
      0.079,
      color,
    );
    if (lod >= 2)
      block(
        out,
        material,
        x + r * 0.96,
        y + h * 0.34,
        z + r * 0.55,
        r * 1.12,
        h * 0.37,
        r * 0.45,
        color,
      );
  }
}

function stonework(out, lod) {
  for (let step = 0; step < 4; step++) {
    const z = 36.46 + step * 0.56;
    const groundY = ground(center, z);
    const y = Math.max(groundY + 0.1, 0.76 - step * 0.19);
    block(
      out,
      'base',
      center,
      Math.min(groundY - 0.31, -0.12),
      z,
      18.2 + step * 0.65,
      y - Math.min(groundY - 0.31, -0.12),
      0.62,
      c.plinth,
    );
  }
  if (lod >= 2) {
    for (const x of [-81.15, -77.1, -72, -68.4, 73.75, 77.23, 82.38, 86.52]) {
      block(out, 'limestone', x, 28.35, 34.35, 0.82, 0.58, 0.94, c.stoneLight);
      figure(out, x, 28.9, 34.94, 1.77, lod);
    }
    for (const x of [-11.18, -7.1, 11.75, 16.03]) figure(out, x, 31.66, 35.2, 1.47, lod);
  }
}

function build(out, lod) {
  wallLoop(out, outer, lod, false);
  for (const court of courts) wallLoop(out, court, lod, true);
  roofDeck(out, [outer, ...courts], stoneRoof, 'slate', c.slate);
  roofStrips(out, lod);
  pavilion(out, lod);
  stonework(out, lod);
}

export const kunsthistorischesSkyline = (out) => build(out, 0);
export const kunsthistorischesDistrict = (out) => build(out, 1);
export const kunsthistorischesStreet = (out) => build(out, 2);
export const kunsthistorischesCloseup = (out) => build(out, 3);
const recipe = 'kunsthistorisches-museum-model.mjs';
const camera = [151, 107, 185],
  lookAt = [2, 26, 5];
export const kunsthistorischesModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  category: 'landmark',
  build: kunsthistorischesCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.geometryBasis,
  buildingCutout: {
    outline: outer,
    minimumCoverage: 0.82,
    basis:
      'Municipal museum perimeter, excluding adjacent square features and neighbouring museum buildings.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Vienna’s Renaissance Revival Kunsthistorisches Museum, with open courts, long wings of round-arched windows, a square-facing portal, copper dome and Pallas Athena.',
  camera,
  lookAt,
  sunDirection: [-43, 62, 58],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 0.88,
    cameraYaw: 0.14,
    focus: { center: [2, 16, 8] },
    groundY: 0,
    far: 1800,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'maria-theresien-platz-entrance', position: [39, 15, 91], lookAt: [2, 19, 34] },
    { name: 'copper-dome-and-lanterns', position: [38, 65, 86], lookAt: [2, 42, 24] },
    { name: 'open-courts-and-hipped-roofs', position: [114, 128, -97], lookAt: [2, 16, 0] },
    { name: 'west-wing-bays-and-statues', position: [76, 22, 86], lookAt: [55, 18, 32] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'kunsthistorischesSkyline',
    errorMeters: 4.7,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'kunsthistorischesDistrict', 2.05],
        ['street', 'kunsthistorischesStreet', 0.71],
        ['closeup', 'kunsthistorischesCloseup', 0.14],
      ].map(([key, name, errorMeters]) => [key, { export: name, errorMeters, surfaces }]),
    ),
  },
  sourceLicense:
    'Original mesh based on the public-domain and CC0 reference photographs of C1815 and Peter Gugerell, and the attributed ODbL 1.0 OpenStreetMap building outline.',
  limitations: plan.limitations,
};
