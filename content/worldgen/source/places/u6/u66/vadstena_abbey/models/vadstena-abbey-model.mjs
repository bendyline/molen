import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  arch,
  areaSign,
  block,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  palette,
  panel,
  pairs,
  rect,
  shell,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (path) => JSON.parse(readFileSync(new URL('../' + path, import.meta.url)));
const plan = read('plan-controls.json');
const { dimensions: d } = plan;
const grade = floorSampler(read('terrain-grid.json'));
const colors = palette({
  stone: 'b6aba0',
  light: 'c1b4a6',
  sill: 'a99f91',
  shade: 'a59786',
  granite: '8d8684',
  slate: '525a61',
  slateEdge: '6c7377',
  copper: '546c67',
  oxidized: '749083',
  lead: '626965',
  glazing: '484a48',
  dimGlass: '5b5b56',
  plaster: 'd1c7b6',
  paleRender: 'ded4bf',
  redTimber: '784d41',
  paintedDoor: '5b4942',
  brick: '9d6553',
  brickDark: '855648',
  oldTile: '704b44',
  chimney: '83665e',
  ruins: '8e857b',
  path: 'a39b85',
});
const surfaces = {
  stone: surface('wall', 'stone_ashlar', 0.93),
  slate: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 0.85 },
  metal: surface('trim', 'metal_painted', 0.7, 0.28),
  masonryTrim: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.88 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.55 },
  door: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.8 },
  plaster: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.93 },
  brick: surface('wall', 'brick_flemish', 0.91),
};
const stoneStyle = { wall: 'stone', color: colors.stone, roof: 'slate', roofColor: colors.slate };

function fill(out, slot, shape, world, normal, color) {
  const indices = earcut(shape.flat());
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3).map((idx) => shape[idx]);
    const projectedArea = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    if (Math.abs(projectedArea) < 0.00005) continue;
    face(out, slot, [a, b, c].map(world), normal, color);
  }
}

function prismRoof(out, xLow, xHigh, profile, slot, color, endSlot, endColor) {
  for (const [[z0, y0], [z1, y1]] of pairs(profile)) {
    face(
      out,
      slot,
      [
        [xLow, y0, z0],
        [xHigh, y0, z0],
        [xHigh, y1, z1],
        [xLow, y1, z1],
      ],
      [0, 1, 0],
      color,
    );
  }
  const section = [
    ...profile,
    [profile.at(-1)[0], Math.min(...profile.map((p) => p[1])) - 0.08],
    [profile[0][0], Math.min(...profile.map((p) => p[1])) - 0.08],
  ];
  fill(out, endSlot, section, ([z, y]) => [xLow, y, z], [-1, 0, 0], endColor);
  fill(out, endSlot, section, ([z, y]) => [xHigh, y, z], [1, 0, 0], endColor);
}

function gothic(out, wall, u, low, spring, half, rise, level, kind = 'glass') {
  const head = [];
  const segments = [1, 3, 5, 8][level];
  for (let i = 0; i <= 2 * segments; i++) {
    const t = i / segments - 1;
    head.push([u + half * t, spring + rise * (1 - t * t) * (1 - 0.34 * Math.abs(t))]);
  }
  const silhouette = [[u - half, low], ...head, [u + half, low]];
  const ink = kind === 'glass' ? colors.glazing : colors.copper;
  const rear = ([x, y]) => wall.p(x, y, 0.024);
  fill(out, kind, silhouette, rear, wall.normal, ink);
  const sill = level === 0 ? 0.1 : 0.27;
  panel(
    out,
    'masonryTrim',
    wall,
    u - half - sill,
    u + half + sill,
    low - sill,
    low,
    0.13,
    colors.sill,
  );
  if (level === 0) return;
  if (level === 1) {
    panel(
      out,
      'masonryTrim',
      wall,
      u - 0.07,
      u + 0.07,
      low,
      spring + rise * 0.55,
      0.077,
      colors.shade,
    );
    return;
  }
  const edgeProfile = silhouette.map(([x, y]) => wall.p(x, y, 0.132));
  for (const [a, b] of pairs(edgeProfile))
    beam(out, 'masonryTrim', a, b, 0.125, 0.105, colors.light);
  if (kind === 'door') {
    beam(
      out,
      'metal',
      wall.p(u, low + 0.05, 0.133),
      wall.p(u, spring + rise - 0.13, 0.133),
      0.063,
      0.06,
      colors.lead,
    );
    return;
  }
  for (const offset of [-0.37, 0.37]) {
    const x = u + half * offset;
    beam(
      out,
      'masonryTrim',
      wall.p(x, low, 0.112),
      wall.p(x, spring + rise * 0.48, 0.112),
      0.095,
      0.088,
      colors.shade,
    );
  }
  if (level >= 2) {
    const pin = wall.p(u, spring + rise * 0.87, 0.12);
    for (const offset of [-0.37, 0.37]) {
      const base = wall.p(u + half * offset, spring + rise * 0.48, 0.12);
      beam(out, 'masonryTrim', base, pin, 0.098, 0.083, colors.light);
    }
    panel(
      out,
      'masonryTrim',
      wall,
      u - half,
      u + half,
      spring - 1.45,
      spring - 1.36,
      0.11,
      colors.shade,
    );
  }
}

function buttress(out, w, u, bottom, top, width, level) {
  const tiers =
    level === 0
      ? [[top, 0.56]]
      : [
          [top * 0.43, 1.68],
          [top * 0.75, 1.05],
          [top, 0.53],
        ];
  let y = bottom,
    front = 1.92;
  for (const [cap, depth] of tiers) {
    const z = cap - 0.51;
    face(
      out,
      'stone',
      [
        w.p(u - width, y, front),
        w.p(u + width, y, front),
        w.p(u + width, z, front),
        w.p(u - width, z, front),
      ],
      w.normal,
      colors.light,
    );
    for (const side of [-1, 1]) {
      const x = u + side * width;
      const target = [side * w.normal[2], 0, -side * w.normal[0]];
      face(
        out,
        'stone',
        [w.p(x, y, 0), w.p(x, y, front), w.p(x, z, front), w.p(x, cap, depth), w.p(x, cap, 0)],
        target,
        colors.stone,
      );
    }
    face(
      out,
      'slate',
      [
        w.p(u - width, z, front),
        w.p(u + width, z, front),
        w.p(u + width, cap, depth),
        w.p(u - width, cap, depth),
      ],
      [0, 1, 0],
      colors.slateEdge,
    );
    y = cap;
    front = depth;
  }
}

function church(out, level) {
  const { nave: n, choir: c } = d;
  const bottom = -1.1;
  const naveOutline = rect(n.west, n.north, n.east, n.south);
  shell(out, naveOutline, () => bottom, n.eaves, stoneStyle);
  const center = (n.north + n.south) / 2;
  prismRoof(
    out,
    n.west,
    n.east,
    [
      [n.north - 0.21, n.eaves],
      [center - 7.1, 25.4],
      [center, n.ridge],
      [center + 7.1, 25.4],
      [n.south + 0.21, n.eaves],
    ],
    'slate',
    colors.slate,
    'stone',
    colors.stone,
  );
  const lightUnderRidge = level >= 2;
  if (lightUnderRidge) {
    beam(
      out,
      'metal',
      [n.west, 25.4, center - 7.1],
      [n.east, 25.4, center - 7.1],
      0.09,
      0.1,
      colors.slateEdge,
    );
    beam(
      out,
      'metal',
      [n.west, 25.4, center + 7.1],
      [n.east, 25.4, center + 7.1],
      0.09,
      0.1,
      colors.slateEdge,
    );
  }
  const choirOutline = rect(c.west, c.north, c.east, c.south);
  shell(
    out,
    choirOutline,
    () => bottom,
    c.eaves,
    stoneStyle,
    (i) => i !== 1,
  );
  prismRoof(
    out,
    c.west,
    c.east,
    [
      [c.north - 0.15, c.eaves],
      [(c.north + c.south) / 2, c.ridge],
      [c.south + 0.15, c.eaves],
    ],
    'slate',
    colors.slate,
    'stone',
    colors.stone,
  );
  const sacristy = rect(-20.2, 6.05, -12.11, 11.8);
  shell(
    out,
    sacristy,
    () => bottom,
    4.7,
    stoneStyle,
    (i) => i === 2 || i === 3,
  );
  prismRoof(
    out,
    -20.2,
    -12.11,
    [
      [6.05, 6.5],
      [11.8, 4.7],
    ],
    'slate',
    colors.slate,
    'stone',
    colors.stone,
  );

  const walls = pairs(closed(naveOutline)).map(([a, b]) => edge(a, b, areaSign(naveOutline)));
  for (const [i, w] of walls.entries()) {
    panel(out, 'stone', w, 0, w.length, bottom, 0.76, 0.13, colors.granite);
    if (i === 0 || i === 2) {
      for (let bay = 0; bay < 5; bay++) {
        const u = ((bay + 0.5) * w.length) / 5;
        gothic(out, w, u, 4.3, 12.1, 1.52, 2.48, level);
        if (bay > 0 && (level > 0 || bay % 2 === 0))
          buttress(out, w, (bay * w.length) / 5, bottom, 15.6, 0.65, level);
      }
      for (const u of [1.1, w.length - 1.05]) buttress(out, w, u, bottom, 15.2, 0.62, level);
    }
  }
  const east = walls[1];
  for (const [u, top] of [
    [1.9, 16.8],
    [10.3, 22.1],
    [24.0, 22.0],
    [35.3, 16.3],
  ]) {
    buttress(out, east, u, bottom, top, 0.71, level);
  }
  for (const [u, low, height, half] of [
    [6.1, 6.5, 12.7, 1.05],
    [17.8, 6.2, 14.8, 1.35],
    [30.5, 6.3, 12.5, 1.03],
  ]) {
    gothic(out, east, u, low, height, half, 1.52, level);
  }
  gothic(out, east, 9.15, 0.2, 3.1, 1.34, 0.84, level, 'door');
  gothic(out, east, 26.82, 0.2, 3.14, 1.43, 1.07, level, 'door');
  const west = edge(choirOutline[3], choirOutline[0], areaSign(choirOutline));
  gothic(out, west, west.length / 2, 3, 8.05, 1.51, 2.13, level);
  if (level >= 1) {
    for (let i = 1; i <= 5; i++) {
      const x = mix(n.west, n.east, i / 6);
      for (const sign of [-1, 1]) {
        const z = center + sign * 11.1;
        const y = 22.8;
        face(
          out,
          'metal',
          [
            [x - 0.48, y, z + sign * 0.64],
            [x + 0.48, y, z + sign * 0.64],
            [x, y + 0.64, z - sign * 0.32],
          ],
          [0, 1, 0],
          colors.oxidized,
        );
      }
    }
    const south = walls[2];
    gothic(out, south, south.length - 6.3, 0.2, 2.9, 1.15, 0.76, level, 'door');
  }
  const { x, z, base, cap } = d.fleche;
  const sides = level === 0 ? 6 : 8;
  const section = (radius, y) => radialRing(y, radius, radius, sides, [x, z], Math.PI / 8);
  loft(
    out,
    'metal',
    [
      section(1.3, base - 0.78),
      section(1.3, base + 3),
      section(1.55, base + 3.33),
      section(1.52, base + 4.45),
    ],
    colors.copper,
  );
  loft(
    out,
    'metal',
    [
      section(1.44, base + 4.34),
      section(0.94, base + 7.0),
      section(0.37, cap - 4.9),
      section(0.062, cap - 0.84),
    ],
    colors.oxidized,
  );
  beam(out, 'metal', [x, cap - 1, z], [x, cap, z], 0.081, 0.08, colors.lead);
  if (level >= 1) {
    beam(
      out,
      'metal',
      [x - 0.58, cap - 0.48, z],
      [x + 0.58, cap - 0.48, z],
      0.09,
      0.085,
      colors.lead,
    );
    for (let i = 0; i < sides; i++) {
      const a = ((i + 0.5) * 2 * Math.PI) / sides + Math.PI / 8;
      const px = x + 1.46 * Math.cos(a),
        pz = z + 1.46 * Math.sin(a);
      beam(
        out,
        'masonryTrim',
        [px, base + 3.58, pz],
        [px, base + 4.22, pz],
        0.15,
        0.12,
        colors.glazing,
      );
    }
  }
}

function cropSlope(shape, cross, limit, sign) {
  const result = [];
  for (const [a, b] of pairs(closed(shape))) {
    const u = cross(a),
      v = cross(b);
    const inside = (u - limit) * sign >= 0;
    if (inside) result.push(a);
    if (inside !== (v - limit) * sign >= 0) {
      const t = (limit - u) / (v - u);
      result.push([mix(a[0], b[0], t), mix(a[1], b[1], t)]);
    }
  }
  return result;
}

function rangeRoof(out, outline, axis, top, ridge, slot, tint, wallSlot, wallTint, level) {
  const a = outline[axis],
    b = outline[(axis + 1) % outline.length];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const cross = ([x, z]) => ((a[0] - b[0]) * z + (b[1] - a[1]) * x) / length;
  const values = outline.map(cross);
  const low = Math.min(...values),
    high = Math.max(...values),
    center = (low + high) / 2;
  const height = (p) =>
    top + (ridge - top) * (1 - Math.abs((cross(p) - center) / ((high - low) / 2)));
  for (const side of [-1, 1]) {
    const roof = cropSlope(outline, cross, center, side);
    fill(out, slot, roof, ([x, z]) => [x, height([x, z]), z], [0, 1, 0], tint);
  }
  const order = areaSign(outline);
  for (const [p, q] of pairs(closed(outline))) {
    const cuts = [p, q];
    const u = cross(p),
      v = cross(q);
    if (u < center !== v < center) {
      const t = (center - u) / (v - u);
      cuts.splice(1, 0, [mix(p[0], q[0], t), mix(p[1], q[1], t)]);
    }
    const w = edge(p, q, order);
    for (const [aa, bb] of pairs(cuts)) {
      const poly = [
        [aa[0], top - 0.05, aa[1]],
        [bb[0], top - 0.05, bb[1]],
        [bb[0], height(bb), bb[1]],
        [aa[0], height(aa), aa[1]],
      ];
      face(out, wallSlot, poly, w.normal, wallTint);
    }
  }
  if (level >= 1) {
    const points = cropSlope(outline, cross, center, 1).filter(
      (p) => Math.abs(cross(p) - center) < 0.001,
    );
    if (points.length >= 2) {
      for (const t of [0.26, 0.72]) {
        const x = mix(points[0][0], points.at(-1)[0], t);
        const z = mix(points[0][1], points.at(-1)[1], t);
        block(out, 'brick', x - 0.38, ridge - 0.12, z - 0.36, 0.76, 1.02, 0.72, colors.chimney);
        block(out, 'masonryTrim', x - 0.47, ridge + 0.83, z - 0.45, 0.94, 0.17, 0.9, colors.sill);
      }
    }
  }
}

function villageRange(out, range, level) {
  const { key, outline } = range;
  const center = outline.reduce(
    ([x, z], p) => [x + p[0] / outline.length, z + p[1] / outline.length],
    [0, 0],
  );
  const datum = grade(center);
  const top = range.top + datum,
    ridge = range.ridge + datum;
  const isBrick = key === 'palace';
  const wslot = isBrick ? 'brick' : 'plaster',
    wtint = isBrick ? colors.brick : key === 'brothers' ? colors.paleRender : colors.plaster;
  const rslot = 'slate',
    rtint = isBrick ? colors.oldTile : colors.slate;
  shell(out, outline, (p) => Math.min(datum - 0.3, grade(p) - 0.3), top, {
    wall: wslot,
    color: wtint,
    roof: rslot,
    roofColor: rtint,
  });
  if (key === 'brothers') {
    const [a, b, c, d, e, f, g, h] = outline;
    rangeRoof(out, [b, c, e, f, g, h], 0, top, ridge, rslot, rtint, wslot, wtint, level);
    rangeRoof(out, [a, b, g, h], 0, top, ridge - 0.66, rslot, rtint, wslot, wtint, 0);
    rangeRoof(out, [d, c, f, e], 0, top, ridge - 0.66, rslot, rtint, wslot, wtint, 0);
  } else {
    const axis = key === 'west' ? 3 : 1;
    rangeRoof(out, outline, axis, top, ridge, rslot, rtint, wslot, wtint, level);
  }
  const order = areaSign(outline);
  for (const [[a, b], i] of pairs(closed(outline)).map((p, i) => [p, i])) {
    const w = edge(a, b, order);
    const count = Math.max(1, Math.round(w.length / (isBrick ? 4.5 : 3.75)));
    if (w.length < 5 || (level === 0 && w.length < 24)) continue;
    for (const y of [datum + 0.37, top - 0.11]) {
      panel(
        out,
        'masonryTrim',
        w,
        0,
        w.length,
        y - 0.105,
        y,
        0.087,
        isBrick ? colors.brickDark : colors.sill,
      );
    }
    for (let j = 0; j < count; j++) {
      const u = ((j + 0.5) * w.length) / count,
        half = isBrick ? 0.58 : 0.61;
      const middle = j === Math.floor(count / 2);
      for (const sill of [datum + 1.41, top - 2.31]) {
        const lower = sill < datum + 3;
        if (lower && middle && ((key === 'brothers' && i === 1) || (key === 'west' && i === 3))) {
          arch(
            out,
            w,
            u,
            datum + 0.09,
            datum + 2.36,
            0.79,
            0.36,
            0.06,
            level,
            { inner: colors.paintedDoor, trim: colors.shade, width: 0.14 },
            { inner: 'door', trim: 'masonryTrim' },
          );
          continue;
        }
        if (level === 0 && j % 2 === 1) continue;
        panel(out, 'glass', w, u - half, u + half, sill, sill + 1.78, 0.035, colors.dimGlass);
        if (level === 1) {
          panel(
            out,
            'masonryTrim',
            w,
            u - 0.06,
            u + 0.06,
            sill,
            sill + 1.78,
            0.072,
            colors.redTimber,
          );
        }
        if (level >= 2) {
          const frameWidth = 0.065;
          for (const x of [u - half, u, u + half]) {
            panel(
              out,
              'masonryTrim',
              w,
              x - frameWidth / 2,
              x + frameWidth / 2,
              sill - 0.035,
              sill + 1.83,
              0.076,
              colors.redTimber,
            );
          }
          for (const y of [sill, sill + 0.81, sill + 1.76]) {
            panel(out, 'masonryTrim', w, u - half, u + half, y, y + 0.058, 0.084, colors.redTimber);
          }
        }
      }
    }
  }
}

function ruinWalls(out, level) {
  const paths =
    level === 0 ? d.ruins.slice(0, 2).map((path) => path.filter((_, i) => i % 2 === 0)) : d.ruins;
  for (const [i, path] of paths.entries()) {
    for (const [j, [a, b]] of pairs(path).entries()) {
      const width = level >= 2 ? 0.86 : 0.79;
      const y = Math.min(grade(a), grade(b));
      const h = 0.48 + 0.13 * ((2 * i + j) % 5);
      beam(
        out,
        'stone',
        [a[0], y + h * 0.38, a[1]],
        [b[0], y + h * 0.38, b[1]],
        width,
        h,
        colors.ruins,
      );
    }
  }
}

function build(out, level) {
  church(out, level);
  for (const range of d.ranges) villageRange(out, range, level);
  ruinWalls(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'vadstena-abbey-model.mjs';
const camera = [119, 57, 124],
  lookAt = [-4, 13, -10];
const errors = { district: 0.51, street: 0.16, closeup: 0.07 };
export const vadstenaAbbeyAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  category: 'religious',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'The native church, mapped convent ranges and ruins use original Vadstena ground. The east portals anchor the common church datum.',
  brief:
    'Vadstena Abbey’s two-pitch slate hall church, copper flèche, surviving palace and cloister ranges, and low ruin foundations.',
  camera,
  lookAt,
  sunDirection: [83, 117, 74],
  mediumFiContext: {
    scale: 1,
    groundY: -0.2,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.92,
    basis: 'Named mapped church and its west choir.',
  },
  embeddedCanonicalGraphs: ['stone_ashlar', 'metal_painted', 'brick_flemish'],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'east-gable-and-copper-fleche', position: [102, 14, 46], lookAt: [35, 17, 3] },
    { name: 'north-slate-roof-and-nuns-ranges', position: [33, 41, -114], lookAt: [11, 10, -35] },
    { name: 'brothers-convent-and-ruins', position: [-106, 23, 64], lookAt: [-39, 6, 24] },
    { name: 'west-choir-and-sacristy', position: [-59, 17, 34], lookAt: [-9, 10, 1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'vadstena-abbey-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.99,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(errors).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. Geographic vector data © OpenStreetMap contributors, ODbL 1.0.',
};
