import { readFileSync } from 'node:fs';
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  at,
  block,
  cap,
  closed,
  edge,
  face,
  mix,
  pairs,
  palette,
  panel,
  pavilion,
  rect,
  ring,
  shell,
  surface,
  trimBlock,
  up,
  xz,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const C = palette({
  wall: 'd4c8b1',
  pier: 'cdb899',
  trim: 'dfd2b9',
  soffit: 'b2a189',
  stone: '9d9383',
  lower: '8e8474',
  coping: 'b5a48d',
  dark: '454546',
  timber: '734736',
  lattice: 'bdb09a',
  glass: '667075',
  dome: 'ab8d71',
  cap: 'b5a38c',
  roof: 'a09785',
  soil: '8b8173',
  metal: '627366',
});
const surfaces = {
  brick: surface('wall', 'brick_flemish', 0.9),
  rock: surface('foundation', 'stone_drywall', 0.92),
  trim: surface('trim', 'stone_ashlar', 0.87),
  floor: surface('foundation', 'stone_ashlar', 0.87),
  clay: surface('roof', 'clay_fired', 0.9),
  wood: surface('door', 'wood_plain', 0.79),
  glass: surface('window', 'storefront', 0.58, 0.025),
  metal: surface('trim', 'metal_painted', 0.71, 0.18),
};
const roofPaint = { wall: 'brick', color: C.wall, roof: 'floor', roofColor: C.roof };

function retainingFace(out, wall, y, ground, lod, stone = C.stone) {
  const count = Math.max(2, Math.ceil(wall.length / (lod === 0 ? 6 : 2.55)));
  for (let i = 0; i < count; i++) {
    const a = (i * wall.length) / count,
      b = ((i + 1) * wall.length) / count;
    const low = (u) => Math.min(ground(xz(wall.p(u, 0))) - 0.35, y - 0.38);
    face(
      out,
      'rock',
      [wall.p(a, low(a)), wall.p(b, low(b)), wall.p(b, y), wall.p(a, y)],
      wall.normal,
      stone,
    );
  }
  if (lod > 0)
    trimBlock(out, 'trim', wall, 0, wall.length, y - 0.18, y + 0.02, -0.075, 0.18, C.coping);
}

function archPath(center, half, spring, rise, n) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = Math.PI * (1 - i / n);
    return [center + half * Math.cos(a), spring + rise * Math.sin(a)];
  });
}

function windows(out, w, y, tops, lod, bays) {
  const bay = w.length / bays,
    bottom = y + 1.28,
    spring = y + 4.36,
    rise = 1.14,
    half = bay * 0.322;
  const ceiling = tops[0];
  let last = 0;
  panel(out, 'brick', w, 0, w.length, y, bottom, 0, C.wall);
  for (let i = 0; i < bays; i++) {
    const center = (i + 0.5) * bay;
    const left = center - half,
      right = center + half;
    const curve = archPath(center, half, spring, rise, [4, 7, 10, 14][lod]);
    panel(out, 'brick', w, last, left, bottom, ceiling, 0, C.wall);
    panel(out, 'glass', w, left, right, bottom, spring, -0.128, C.dark);
    for (const [[a, h], [b, k]] of pairs(curve)) {
      face(
        out,
        'brick',
        [w.p(a, h), w.p(b, k), w.p(b, ceiling), w.p(a, ceiling)],
        w.normal,
        C.wall,
      );
      face(
        out,
        'glass',
        [
          w.p(a, spring - 0.043, -0.13),
          w.p(b, spring - 0.043, -0.13),
          w.p(b, k, -0.13),
          w.p(a, h, -0.13),
        ],
        w.normal,
        C.dark,
      );
      if (lod > 1)
        face(
          out,
          'wood',
          [w.p(a, h, 0.014), w.p(b, k, 0.014), w.p(b, k + 0.115, 0.014), w.p(a, h + 0.115, 0.014)],
          w.normal,
          C.timber,
        );
    }
    if (lod > 0) {
      const panes = lod === 3 ? 6 : 4;
      for (let j = 0; j <= panes; j++) {
        const u = mix(left, right, j / panes);
        panel(out, 'wood', w, u - 0.033, u + 0.033, bottom, spring, -0.07, C.timber);
      }
      panel(out, 'wood', w, left, right, spring - 0.087, spring + 0.025, -0.049, C.timber);
      trimBlock(
        out,
        'trim',
        w,
        left - 0.12,
        right + 0.12,
        bottom - 0.148,
        bottom - 0.032,
        0,
        0.212,
        C.trim,
      );
      if (lod > 1)
        for (let j = 1; j <= 7; j++) {
          const a = (Math.PI * j) / 8;
          beamPath(
            out,
            'metal',
            [
              w.p(center, spring + 0.027, -0.071),
              w.p(center + half * 0.89 * Math.cos(a), spring + rise * 0.86 * Math.sin(a), -0.071),
            ],
            0.025,
            0.025,
            C.lattice,
          );
        }
      if (lod === 3) {
        const inside = archPath(center, half * 0.65, spring + 0.04, rise * 0.59, 11);
        beamPath(
          out,
          'metal',
          inside.map(([u, h]) => w.p(u, h, -0.062)),
          0.026,
          0.026,
          C.lattice,
        );
      }
    }
    last = right;
  }
  panel(out, 'brick', w, last, w.length, bottom, ceiling, 0, C.wall);
}

function parapet(out, w, low, high, lod, bays) {
  const span = w.length / bays;
  trimBlock(out, 'trim', w, 0, w.length, low - 0.26, low + 0.08, -0.025, 0.27, C.coping);
  for (let i = 0; i < bays; i++) {
    const a = i * span + 0.255,
      b = (i + 1) * span - 0.255;
    const corner = i * span;
    const u0 = Math.max(0, corner - 0.18),
      u1 = corner + 0.19;
    trimBlock(out, 'brick', w, u0, u1, low - 6.55, high + 0.24, 0, 0.255, C.pier);
    if (lod <= 1) {
      panel(out, 'brick', w, a, b, low, high, -0.036, lod === 1 ? C.lattice : C.wall);
    } else {
      panel(out, 'brick', w, a, b, low, low + 0.13, 0.029, C.trim);
      panel(out, 'brick', w, a, b, high - 0.156, high, 0.035, C.trim);
      const minY = low + 0.139,
        maxY = high - 0.162;
      for (const sign of [-1, 1]) {
        const dot = lod === 3 ? 0.262 : 0.392,
          rise = maxY - minY;
        for (let first = a - rise; first < b; first += dot) {
          const l = Math.max(a, first),
            r = Math.min(first + rise, b);
          if (r - l < 0.04) continue;
          const h = (t) => (sign === 1 ? minY + t - first : maxY - t + first);
          beamPath(out, 'trim', [w.p(l, h(l), 0.023), w.p(r, h(r), 0.026)], 0.07, 0.065, C.trim);
        }
      }
    }
  }
  trimBlock(out, 'brick', w, w.length - 0.24, w.length, low - 6.55, high + 0.24, 0, 0.25, C.pier);
}

function facade(out, d, ground, lod) {
  const {
    front: [a, b],
    facadeBase: y,
    parapetHeight,
  } = d;
  const roof = parapetHeight - 1.28 + y;
  const wall = edge(a, b);
  const project = (u, offset) => xz(wall.p(u, 0, offset));
  const envelope = [a, b, project(wall.length, -8.73), project(0, -8.73)];
  shell(
    out,
    envelope,
    () => y - 0.25,
    roof,
    roofPaint,
    (i) => i !== 0,
  );
  const slab = [
    project(-0.24, 2.52),
    project(wall.length + 0.25, 2.52),
    project(wall.length + 0.25, -8.78),
    project(-0.24, -8.78),
  ];
  cap(out, 'floor', slab, y - 0.024, C.coping);
  for (const [i, [m, n]] of pairs(closed(slab)).entries())
    retainingFace(out, edge(m, n), y - 0.038, ground, lod, i === 0 ? C.stone : C.lower);
  windows(out, wall, y, [roof], lod, 6);
  parapet(out, wall, roof + 0.035, y + parapetHeight, lod, 6);
  if (lod > 1) {
    const path = [project(0.38, 2.12), project(wall.length - 0.88, 2.12)];
    const railing = edge(...path);
    beamPath(
      out,
      'metal',
      [railing.p(0, y + 0.91), railing.p(railing.length, y + 0.91)],
      0.052,
      0.051,
      C.metal,
    );
    for (let i = 0; i <= Math.floor(railing.length / 1.62); i++) {
      const u = (i / Math.floor(railing.length / 1.62)) * railing.length;
      beamPath(
        out,
        'metal',
        [railing.p(u, y - 0.01), railing.p(u, y + 0.91)],
        0.048,
        0.052,
        C.metal,
      );
    }
  }
}

function mappedDome(out, points, center, y, rise, lod) {
  const profile = [
    [0, 1],
    [0.13, 0.975],
    [0.34, 0.858],
    [0.6, 0.68],
    [0.81, 0.45],
    [0.95, 0.221],
    [1, 0.046],
  ];
  const shape =
    lod === 0
      ? points.filter((_, i) => i % 3 === 0)
      : lod === 1
        ? points.filter((_, i) => i % 2 === 0)
        : points;
  const selected = lod === 0 ? profile.filter((_, i) => i % 2 === 0) : profile;
  const location = (p, h, r) => [mix(center[0], p[0], r), y + h * rise, mix(center[1], p[1], r)];
  const facing = areaSign(shape);
  for (const [[a, ra], [b, rb]] of pairs(selected))
    for (const [i, p] of shape.entries()) {
      const q = shape[(i + 1) % shape.length];
      const w = edge(p, q, facing);
      face(
        out,
        'clay',
        [location(p, a, ra), location(q, a, ra), location(q, b, rb), location(p, b, rb)],
        [w.normal[0], 0.42, w.normal[2]],
        a === 0 ? C.cap : C.dome,
      );
    }
  cap(
    out,
    'clay',
    shape.map((p) => xz(location(p, 1, 0.046))),
    y + rise,
    C.cap,
  );
}

function sanctuary(out, d, ground, lod) {
  const { parts, center, facadeBase: y, domeBase, domeRise } = d;
  shell(out, parts.drum, (p) => Math.min(ground(p) - 0.28, y - 0.8), domeBase - 0.013, {
    wall: 'rock',
    color: C.stone,
    roof: 'rock',
    roofColor: C.cap,
  });
  const sign = areaSign(parts.drum);
  if (lod > 0)
    for (const [a, b] of pairs(closed(parts.drum))) {
      const w = edge(a, b, sign);
      trimBlock(
        out,
        'trim',
        w,
        0,
        w.length,
        domeBase - 0.52,
        domeBase - 0.3,
        0.015,
        0.18,
        C.coping,
      );
    }
  mappedDome(out, parts.dome, center, domeBase, domeRise, lod);
  for (const [x, z, radius, level] of [
    [7.4, 3.45, 2.63, 2.44],
    [14, 7.95, 2.44, 3.45],
  ]) {
    const top = y + level,
      plan = rect(x - radius, z - radius, x + radius, z + radius);
    shell(out, plan, (p) => Math.min(y - 0.2, ground(p) - 0.31), top, {
      wall: 'rock',
      color: C.stone,
      roof: 'floor',
      roofColor: C.cap,
    });
    const segments = [8, 10, 14, 19][lod];
    ring(
      out,
      'clay',
      [x, z],
      [
        [top, radius * 0.94],
        [top + 0.38, radius * 0.91],
        [top + radius * 0.52, radius * 0.55],
        [top + radius * 0.63, 0.11],
      ],
      segments,
      C.dome,
    );
    cap(out, 'clay', rect(x - 0.1, z - 0.1, x + 0.1, z + 0.1), top + radius * 0.63, C.dome);
  }
}

function court(out, d, ground, lod) {
  const { outline, facadeBase: y } = d;
  const sign = areaSign(outline);
  for (const [i, [a, b]] of pairs(closed(outline)).entries()) {
    if (i === 4 || i === 8) continue;
    const w = edge(a, b, sign),
      mid = xz(w.p(w.length / 2, 0));
    const crest = Math.max(y + 0.85, Math.max(ground(a), ground(b), ground(mid)) + 0.81);
    retainingFace(out, w, crest, ground, lod, C.lower);
  }
  const main = rect(-9.23, -7.6, 4.72, 13.94),
    back = rect(-27.37, 9.9, -9.23, 14.62);
  cap(out, 'floor', main, y + 0.002, C.roof);
  cap(out, 'floor', back, y + 0.08, C.roof);
  for (const [l, a, r, b, base, top, bays] of [
    [-22.95, -7.79, -10.4, 3.52, y + 4.2, y + 7.82, 3],
    [-28.9, 10.1, -23.3, 14.65, y + 4.28, y + 7.57, 2],
  ]) {
    const footprint = rect(l, a, r, b),
      w = edge(footprint[0], footprint[1]);
    shell(out, footprint, (p) => Math.min(ground(p) - 0.25, base - 0.25), top, roofPaint);
    for (let i = 0; i < bays; i++) {
      const u = ((i + 0.5) * w.length) / bays;
      panel(out, 'glass', w, u - 0.51, u + 0.51, base + 0.5, base + 2.14, 0.031, C.dark);
      if (lod > 0)
        trimBlock(out, 'wood', w, u - 0.56, u + 0.56, base + 0.29, base + 0.4, 0, 0.15, C.timber);
    }
    if (lod > 1)
      trimBlock(out, 'trim', w, 0, w.length, top + 0.01, top + 0.28, 0.01, 0.15, C.coping);
  }
  if (lod > 0) {
    const z = -10.33,
      theFloor = Math.max(ground([-14.55, z]), y - 0.91);
    for (let i = 0; i < 5; i++) {
      const step = mix(theFloor - 0.04, y + 0.14, (i + 1) / 5);
      block(
        out,
        'rock',
        -13.66 + i * 0.45,
        Math.min(ground([-13.66 + i * 0.45, z]) - 0.29, y - 0.76),
        z,
        0.452,
        Math.max(0.1, step - Math.min(ground([-13.66 + i * 0.45, z]) - 0.29, y - 0.76)),
        2.04,
        C.coping,
      );
    }
  }
}

function draw(out, lod, d, ground) {
  court(out, d, ground, lod);
  facade(out, d, ground, lod);
  sanctuary(out, d, ground, lod);
}
const shrine = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [28, 37, -66],
    lookAt: [3, 8.6, -1],
    yaw: 0.51,
    sun: [-450, 660, -520],
    brief:
      'The standing shrine of Bibi Shahrbanu at Rayy, with its six arched facade bays, pierced parapet, masonry domes and mountainside terrace.',
    views: [
      {
        name: 'six-arched-bays-and-pierced-parapet',
        position: [10.5, 12.1, -43],
        lookAt: [6.2, 10.4, -15.3],
      },
      {
        name: 'mapped-masonry-dome-and-south-vaults',
        position: [34, 24, -11.5],
        lookAt: [13, 12, 0.3],
      },
      {
        name: 'open-courtyard-and-stepped-enclosure',
        position: [-5, 39, 30],
        lookAt: [-5, 9, -0.3],
      },
      {
        name: 'retaining-masonry-over-original-slope',
        position: [36, 9, -35],
        lookAt: [12, 7, -3],
      },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = shrine;
const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const model = {
  ...shrine.model,
  category: 'historic-religion',
  recipeDependencies: [...shrine.model.recipeDependencies, 'authored-structure-mesh.mjs'],
  buildingCutout: {
    outline: plan.dimensions.outline,
    minimumCoverage: 0.91,
    basis:
      'The named twelve-point shrine outline replaces the corresponding generic mass on the mountainside.',
  },
};
