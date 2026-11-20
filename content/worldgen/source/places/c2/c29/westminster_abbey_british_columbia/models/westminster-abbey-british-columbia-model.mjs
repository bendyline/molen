import { readFileSync } from 'node:fs';
import {
  areaSign,
  at,
  block,
  cap,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  palette,
  panel,
  pairs,
  planarMid,
  rect,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const dimensions = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const colors = palette({
  grey: 'b8b8ad',
  greyShade: 'aaa99f',
  grayBright: 'cac8b9',
  sill: 'a6a6a0',
  roof: '888a83',
  zinc: 'a2aaa2',
  brick: '835a51',
  timber: '915d3a',
  glass: '6d787b',
  glassDim: '59696d',
  lead: '8c938b',
  blue: '6d838f',
  umber: '888371',
  green: '77897e',
});
const surfaces = {
  concrete: surface('wall', 'concrete_boardformed', 0.88),
  bright: surface('trim', 'concrete_panel', 0.91),
  roof: surface('roof', 'metal_standing_seam', 0.82, 0.08),
  brick: surface('wall', 'brick', 0.94),
  timber: surface('door', 'wood_vertical', 0.87),
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.76, metallic: 0.02 },
};
const ground = (point) => grade(point) - 0.34;
const wallEdges = (outline) =>
  pairs(closed(outline)).map(([a, b]) => edge(a, b, areaSign(outline)));
const lancetBays = new Set([
  0, 2, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 28, 30, 32, 34, 36, 38, 42, 44, 46, 48, 50, 52, 54,
  56, 58, 60, 63, 65, 67, 69,
]);

function lancet(out, w, bottom, top, level, open) {
  const radius = Math.min(0.82, w.length * 0.27);
  const center = w.length / 2;
  const left = center - radius;
  const right = center + radius;
  const low = open ? 2.5 : 3.2;
  const spring = 10.25;
  const rise = 1.72;
  if (!open) panel(out, 'concrete', w, 0, w.length, bottom, low, 0, colors.grey);
  panel(out, 'concrete', w, 0, left, open ? bottom : low, top, 0, colors.grey);
  panel(out, 'concrete', w, right, w.length, open ? bottom : low, top, 0, colors.greyShade);
  const shape = (u) =>
    spring +
    (rise * Math.sqrt(Math.max(0, 4 - (1 + Math.abs(u - center) / radius) ** 2))) / Math.sqrt(3);
  const n = [2, 4, 8, 10][level];
  const glazingDepth = -0.15;
  const distance = open ? 0.31 : -glazingDepth;
  const inside = [];
  for (let i = 0; i <= n; i++) {
    const u = mix(left, right, i / n);
    inside.push([u, shape(u)]);
  }
  for (const [[a, ya], [b, yb]] of pairs(inside)) {
    face(
      out,
      'concrete',
      [w.p(a, ya), w.p(b, yb), w.p(b, top), w.p(a, top)],
      w.normal,
      colors.grey,
    );
    if (level > 0 || open)
      face(
        out,
        'bright',
        [w.p(a, ya, -distance), w.p(b, yb, -distance), w.p(b, yb), w.p(a, ya)],
        [0, -1, 0],
        colors.sill,
      );
  }
  if (open) return;

  panel(out, 'glass', w, left, right, low, spring, glazingDepth, colors.glass);
  face(
    out,
    'glass',
    inside.map(([u, y]) => w.p(u, y, glazingDepth)),
    w.normal,
    colors.glass,
  );
  if (level === 0) return;
  for (const [u, sign] of [
    [left, 1],
    [right, -1],
  ]) {
    const facing = [w.normal[2] * sign, 0, -w.normal[0] * sign];
    face(
      out,
      'bright',
      [w.p(u, low, glazingDepth), w.p(u, low), w.p(u, spring), w.p(u, spring, glazingDepth)],
      facing,
      colors.sill,
    );
  }
  trimBlock(
    out,
    'bright',
    w,
    left - 0.045,
    right + 0.045,
    low - 0.11,
    low,
    glazingDepth,
    0.055,
    colors.sill,
  );
  const bands = [4.95, 6.7, 8.42, 10.05];
  for (const y of bands)
    panel(out, 'bright', w, left, right, y, y + 0.075, glazingDepth + 0.013, colors.lead);
  if (level < 2) return;
  for (const fraction of [0.31, 0.66]) {
    const u = mix(left, right, fraction);
    panel(
      out,
      'bright',
      w,
      u - 0.029,
      u + 0.029,
      low,
      shape(u) - 0.13,
      glazingDepth + 0.014,
      colors.lead,
    );
  }
  const panes = [colors.blue, colors.umber, colors.glassDim, colors.green];
  const rows = level === 2 ? 5 : 11;
  for (let i = 0; i < rows; i++) {
    const y = mix(low + 0.2, spring - 0.28, i / rows);
    const column = (i * 7 + Math.round(w.length * 10)) % 3;
    const u = left + (right - left) * (0.12 + column * 0.28);
    panel(
      out,
      'glass',
      w,
      u,
      u + radius * 0.28,
      y,
      y + 0.23 + (i % 3) * 0.12,
      glazingDepth + 0.007,
      panes[i % panes.length],
    );
  }
}

function roofLantern(out, level) {
  const center = [30.2, 16.4];
  const low = 14.12;
  const high = dimensions.crossingRoof;
  const arms = [
    [center[0] - 7.8, center[1] - 1.1],
    [center[0] - 3.6, center[1] - 5.25],
    [center[0] + 0.9, center[1] - 7.45],
    [center[0] + 6.65, center[1] - 3.2],
    [center[0] + 7.45, center[1] + 1.65],
    [center[0] + 3.55, center[1] + 5.2],
    [center[0] - 1.1, center[1] + 7.2],
    [center[0] - 6.25, center[1] + 4.05],
  ];
  const upper = arms.map(([x, z], i) => [
    mix(center[0], x, i % 2 ? 0.72 : 0.62),
    high - (i % 2 ? 1.2 : 0.55),
    mix(center[1], z, i % 2 ? 0.72 : 0.62),
  ]);
  const top = [center[0], high + 0.42, center[1]];
  for (let i = 0; i < arms.length; i++) {
    const j = (i + 1) % arms.length;
    const w = edge(arms[i], arms[j], areaSign(arms));
    face(
      out,
      'concrete',
      [at(arms[i], low), at(arms[j], low), upper[j], upper[i]],
      w.normal,
      colors.greyShade,
    );
    face(out, 'roof', [upper[i], upper[j], top], up, colors.zinc);
  }
  block(
    out,
    'bright',
    29.75,
    high + 0.35,
    15.95,
    0.9,
    level > 0 ? 1.35 : 1.18,
    0.9,
    colors.grayBright,
  );
}

function abbeyChurch(out, level) {
  const { outline, height } = dimensions.parts.church;
  const walls = wallEdges(outline);
  cap(out, 'roof', outline, height - 0.12, colors.roof);
  for (const [i, w] of walls.entries()) {
    const bottom = Math.min(ground(outline[i]), ground(outline[(i + 1) % outline.length]));
    const open = i === 19 || i === 63;
    if (lancetBays.has(i)) {
      lancet(out, w, bottom, height, level, open);
    } else {
      panel(
        out,
        'concrete',
        w,
        0,
        w.length,
        bottom,
        height,
        0,
        i % 3 ? colors.grey : colors.greyShade,
      );
    }
    if (level > 0) {
      trimBlock(
        out,
        'bright',
        w,
        0,
        w.length,
        height - 0.19,
        height + 0.09,
        -0.06,
        0.09,
        colors.sill,
      );
      if (lancetBays.has(i)) {
        const u = Math.min(0.45, w.length * 0.18);
        trimBlock(out, 'bright', w, 0.02, u, -0.08, height + 0.22, -0.05, 0.25, colors.grayBright);
      }
    }
  }
  roofLantern(out, level);
}

function tower(out, level) {
  const { outline, height } = dimensions.parts.tower;
  const center = planarMid(outline);
  const bottom = ground(center);
  const shoulder = dimensions.towerShoulder;
  const section = (scale) =>
    outline.map(([x, z]) => [mix(center[0], x, scale), mix(center[1], z, scale)]);
  const shaft = section(0.91);
  const shaftTop = shoulder - 10.3;
  shell(out, shaft, ground, shaftTop, { wall: 'concrete', color: colors.grey, roof: 'bright' });
  const cage = section(1.04);
  const cageFinish = [
    [shaftTop - 0.06, shaftTop + 0.37],
    [shoulder - 0.55, shoulder + 0.06],
  ];
  for (const [lo, hi] of cageFinish)
    shell(out, cage, () => lo, hi, { wall: 'bright', color: colors.grey, roof: 'bright' });
  for (const w of wallEdges(cage)) {
    const side = 0.67;
    const lo = shaftTop + 0.32;
    const hi = shoulder - 0.53;
    for (const [a, b] of [
      [0, side],
      [w.length - side, w.length],
    ])
      trimBlock(out, 'concrete', w, a, b, lo, hi, -0.48, 0, colors.grey);
    panel(out, 'glass', w, side, w.length - side, lo + 0.03, hi - 0.04, -0.48, colors.glassDim);
    if (level > 0) {
      const middle = w.length / 2;
      trimBlock(
        out,
        'bright',
        w,
        middle - 0.16,
        middle + 0.16,
        lo,
        hi,
        -0.37,
        -0.02,
        colors.greyShade,
      );
      for (const f of [0.17, 0.33, 0.49, 0.65, 0.81]) {
        const y = mix(lo, hi, f);
        panel(out, 'bright', w, side, w.length - side, y, y + 0.17, -0.38, colors.greyShade);
      }
    }
  }
  const rim = section(0.93);
  const peak = section(0.27);
  const top = bottom + height + 0.34;
  const roofTop = top - 0.79;
  for (const [i, w] of wallEdges(rim).entries()) {
    const j = (i + 1) % rim.length;
    face(
      out,
      'concrete',
      [at(rim[i], shoulder), at(rim[j], shoulder), at(peak[j], roofTop), at(peak[i], roofTop)],
      w.normal,
      colors.grey,
    );
  }
  shell(out, peak, () => roofTop, top, {
    wall: 'bright',
    color: colors.grayBright,
    roof: 'bright',
  });
  if (level > 1) {
    for (const w of wallEdges(shaft)) {
      const u = w.length / 2;
      for (const y of [4.7, 10.45, 16.25, 22.05, 27.8])
        panel(out, 'glass', w, u - 0.18, u + 0.18, y, y + 1.5, 0.017, colors.glassDim);
    }
  }
}

function wing(out, part, key, level) {
  const { outline, height } = part;
  const brick = key === 'porch' || key === 'residence';
  shell(out, outline, ground, height, {
    wall: brick ? 'brick' : 'concrete',
    color: brick ? colors.brick : colors.greyShade,
    roof: 'roof',
    roofColor: colors.roof,
  });
  if (level === 0) return;
  const light = key === 'porch' ? colors.timber : colors.glassDim;
  for (const [i, w] of wallEdges(outline).entries()) {
    const count = Math.floor(w.length / (level === 1 ? 5.1 : 3.5));
    if (count < 1) continue;
    const p = w.p(w.length / 2, 0);
    const bottom = grade([p[0], p[2]]);
    const floors = key === 'porch' || key === 'gallery' ? 1 : 3;
    const story = Math.min((height - bottom - 0.55) / floors, 3.4);
    for (let j = 0; j < floors; j++) {
      const sill = height - (floors - j) * story + 0.7;
      for (let k = 0; k < count; k++) {
        const u = (w.length * (k + 0.5)) / count;
        const h = key === 'porch' ? 2.04 : 1.18;
        const wide = key === 'porch' ? 0.75 : 0.69;
        panel(out, 'glass', w, u - wide, u + wide, sill, sill + h, 0.019, light);
        if (level > 1) {
          panel(
            out,
            'bright',
            w,
            u - wide - 0.045,
            u + wide + 0.045,
            sill - 0.075,
            sill,
            0.038,
            colors.sill,
          );
          panel(
            out,
            'bright',
            w,
            u - 0.035,
            u + 0.035,
            sill + 0.035,
            sill + h - 0.035,
            0.041,
            colors.lead,
          );
        }
      }
    }
    if (level > 1 && i % 2 === 0)
      panel(
        out,
        'bright',
        w,
        0.04,
        w.length - 0.04,
        height - 0.145,
        height - 0.075,
        0.018,
        colors.sill,
      );
  }
  if (key === 'porch') {
    const left = 27.2,
      right = 35.3,
      front = 43.4,
      back = 48.8;
    for (const x of [left, right - 0.39])
      block(
        out,
        'bright',
        x,
        ground([x, back - 0.6]),
        back - 0.6,
        0.39,
        3.44,
        0.46,
        colors.grayBright,
      );
    const canopy = rect(left - 0.48, front, right + 0.55, back);
    shell(out, canopy, () => 3.03, 3.23, {
      wall: 'bright',
      color: colors.greyShade,
      roof: 'roof',
      roofColor: colors.zinc,
    });
    block(out, 'timber', 29.5, 0.03, 44.8, 2.15, 2.83, 0.18, colors.timber);
  }
}

function build(out, level) {
  abbeyChurch(out, level);
  tower(out, level);
  for (const key of ['gallery', 'seminary', 'residence', 'porch'])
    wing(out, dimensions.parts[key], key, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'westminster-abbey-british-columbia-model.mjs';
const camera = [171, 112, 177];
const lookAt = [40, 10, -21];
const errors = { district: 0.84, street: 0.33, closeup: 0.11 };
export const westminsterAbbeyAsset = {
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
    'Native bare-earth height along the abbey church’s southern visitor approach.',
  brief:
    'A folded concrete abbey church with tall pointed windows, a separate Pfitzer Memorial Bell Tower, and adjoining seminary ranges overlooking the Fraser Valley.',
  camera,
  lookAt,
  sunDirection: [-9, 16, 17],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: dimensions.outline,
    outlines: dimensions.polygons,
    minimumCoverage: 0.92,
    basis: 'Six independently mapped above-ground structures at the abbey.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap((s) => s.graph ?? []),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'folded-concrete-and-pointed-windows', position: [-33, 8, 87], lookAt: [29, 8, 24] },
    { name: 'bell-tower-and-northern-courtyard', position: [115, 33, -53], lookAt: [46, 20, -10] },
    { name: 'roof-profile-and-southern-range', position: [124, 51, 71], lookAt: [40, 11, 34] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'westminster-abbey-british-columbia-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.53,
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
    'Original mesh under repository license. Natural Resources Canada elevation and © OpenStreetMap contributors.',
};
