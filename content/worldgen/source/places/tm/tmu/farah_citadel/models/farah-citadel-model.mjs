/** Farah Bala Hisar's earthen curtain, mapped bastions, and photographed portico. */
import { readFileSync } from 'node:fs';
import {
  loft,
  radialRing,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const grid = read('terrain-grid');
const controls = read('native-map/citadel-controls');
const wall = controls.localWall;
const surfaces = {
  clay: { slot: 'wall', graph: 'earth_adobe', roughness: 0.98, metallic: 0 },
  crown: { slot: 'roof', graph: 'earth_rammed', roughness: 0.99, metallic: 0 },
  foot: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.96, metallic: 0 },
  plaster: { slot: 'trim', graph: 'plaster_lime', roughness: 0.93, metallic: 0 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.98, metallic: 0 },
};
const c = Object.fromEntries(
  Object.entries({
    earth: 'ba9d77',
    lower: 'aa906d',
    pale: 'c4aa84',
    crest: 'b49b79',
    rock: '9f886d',
    plaster: 'c3ad8e',
    light: 'd1bda0',
    wall: 'b5a08a',
    worn: 'ab9076',
    dark: '66513d',
    timber: '735b45',
  }).map(([name, color]) => [name, rgb(color)]),
);
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const clamp = (x) => Math.min(1, Math.max(0, x));

function grade(x, z) {
  const u = (x - grid.origin[0]) / grid.stepMeters;
  const v = (z - grid.origin[1]) / grid.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const a = lerp(grid.heightsMeters[j][i], grid.heightsMeters[j][i + 1], u - i);
  const b = lerp(grid.heightsMeters[j + 1][i], grid.heightsMeters[j + 1][i + 1], u - i);
  return lerp(a, b, v - j) - grid.modelDatumElevationMeters;
}

function offsets(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const l = Math.hypot(dx, dz);
  return { along: [dx / l, dz / l], outward: [-dz / l, dx / l], length: l };
}

const segment = wall.map((a, i) => offsets(a, wall[(i + 1) % wall.length]));
const normalAt = wall.map((_, i) => {
  const p = segment[(i + wall.length - 1) % wall.length].outward;
  const n = segment[i].outward;
  const a = [p[0] + n[0], p[1] + n[1]];
  const l = Math.hypot(...a);
  return a.map((v) => v / l);
});

function wallHeight(x, z) {
  const long = Math.sin(x * 0.012 + z * 0.008);
  const worn = Math.sin(x * 0.075 + z * 0.034);
  const nearPortico = clamp(
    1 - Math.hypot(x - plan.portico.origin[0], z - plan.portico.origin[1]) / 54,
  );
  return Math.max(3.1, 8.0 + 1.9 * long + 1.35 * worn + clamp(-z / 380) * 3.3 - 4.8 * nearPortico);
}

function section(center, normal, lod) {
  const [x, z] = center;
  const ground = grade(x, z);
  const height = wallHeight(x, z);
  const radius = 5.0 + 0.83 * Math.sin(x * 0.049 - z * 0.027);
  const p = (side, y) => [x + side * normal[0], y, z + side * normal[1]];
  const onGround = (side) => grade(x + side * normal[0], z + side * normal[1]) - 0.68;
  if (lod === 0)
    return [p(radius, onGround(radius)), p(0, ground + height), p(-radius, onGround(-radius))];
  const lowOuter = radius + 3.65,
    lowInner = -radius - 1.45;
  const topOuter = radius * 0.36,
    topInner = -radius * 0.38;
  const highOuter = ground + height;
  const highInner = highOuter - 0.35 - 0.47 * Math.sin(x * 0.03 + z * 0.05);
  if (lod === 1)
    return [
      p(lowOuter, onGround(lowOuter)),
      p(topOuter, highOuter),
      p(topInner, highInner),
      p(lowInner, onGround(lowInner)),
    ];
  return [
    p(lowOuter, onGround(lowOuter)),
    p(radius, ground + height * 0.28),
    p(radius * 0.69, ground + height * 0.68),
    p(topOuter, highOuter),
    p(topInner, highInner),
    p(-radius * 0.62, ground + height * 0.53),
    p(lowInner, onGround(lowInner)),
  ];
}

function curtain(out, lod) {
  const gate = plan.gateIndex;
  for (let i = 0; i < wall.length; i++) {
    const k = (i + 1) % wall.length;
    const { length } = segment[i];
    const start = i === gate ? plan.gateHalfClear / length : 0;
    const end = k === gate ? 1 - plan.gateHalfClear / length : 1;
    const count = lod < 2 ? 1 : Math.max(2, Math.ceil(length / (lod === 2 ? 12 : 7)));
    const profile = (j) => {
      const t = lerp(start, end, j / count);
      return section(mix(wall[i], wall[k], t), mix(normalAt[i], normalAt[k], t), lod);
    };
    let a = profile(0);
    for (let j = 1; j <= count; j++) {
      const b = profile(j);
      for (let r = 0; r < a.length - 1; r++) {
        const crown = r === Math.floor((a.length - 1) / 2) && lod > 0;
        const base = lod > 1 && (r === 0 || r === a.length - 2);
        const slot = crown ? 'crown' : base ? 'foot' : 'clay';
        const tint = crown
          ? c.crest
          : base
            ? c.lower
            : mix(c.earth, c.pale, 0.2 + ((i * 17 + j * 7) % 19) / 42);
        face(out, slot, [a[r], b[r], b[r + 1], a[r + 1]], tint);
      }
      if (j === 1 && i === gate) closeEnd(out, a, wall[i], wall[k], true);
      if (j === count && k === gate) closeEnd(out, b, wall[i], wall[k], false);
      a = b;
    }
  }
}

function closeEnd(out, ring, a, b, atStart) {
  const { along } = offsets(a, b);
  for (let i = 1; i < ring.length - 1; i++) {
    const vertices = [ring[0], ring[i], ring[i + 1]];
    const n = normalFor(...vertices);
    if ((n[0] * along[0] + n[2] * along[1]) * (atStart ? -1 : 1) < 0) vertices.reverse();
    triangle(out, 'clay', vertices, c.earth);
  }
}

function bastions(out, lod) {
  for (const [i, record] of controls.bastions.entries()) {
    const [x, z] = record.local;
    const base = grade(x, z) - 0.85;
    const nearPortico = Math.hypot(x - plan.portico.origin[0], z - plan.portico.origin[1]) < 29;
    const height = wallHeight(x, z) + 1.25 + ((i * 7) % 11) * 0.27;
    const radius = 4.2 + ((i * 13) % 9) * 0.26;
    const sides = [4, 7, 10, 13][lod];
    const origin = [x, z];
    const rings = [
      radialRing(base, radius + 0.85, radius + 0.85, sides, origin, Math.PI / 4),
      ...(lod === 3
        ? [
            radialRing(
              base + height * 0.35,
              radius - 0.3,
              radius - 0.35,
              sides,
              origin,
              Math.PI / 4,
            ),
          ]
        : []),
      radialRing(
        base + height,
        nearPortico ? radius * 0.68 : radius * 0.63,
        radius * 0.65,
        sides,
        origin,
        Math.PI / 4,
      ),
    ];
    if (lod > 0) {
      const crest = rings.at(-1);
      for (let j = 0; j < crest.length; j++)
        crest[j][1] += Math.sin(i * 1.2 + j * 1.8) * (lod === 3 ? 0.77 : 0.45);
    }
    loft(out, 'clay', rings, mix(c.earth, c.pale, (i % 5) / 10), { cap: false });
    const crest = rings.at(-1);
    const mid = [x, crest.reduce((sum, p) => sum + p[1], 0) / sides + 0.12, z];
    if (lod === 0) {
      triangle(out, 'crown', [crest[0], crest[1], crest[2]], c.crest);
      triangle(out, 'crown', [crest[0], crest[2], crest[3]], c.crest);
    } else {
      for (let j = 0; j < sides; j++)
        triangle(out, 'crown', [crest[j], crest[(j + 1) % sides], mid], c.crest);
    }
  }
}

const localShape = (out, at, axis) => {
  const cosine = Math.cos(axis),
    sine = Math.sin(axis);
  const transform = ([x, y, z]) => [
    at[0] + x * cosine + z * sine,
    at[1] + y,
    at[2] - x * sine + z * cosine,
  ];
  return {
    addQuad(slot, _ref, points, _normal, _uv, color) {
      face(out, slot, points.map(transform), color);
    },
    addTriangle(slot, _ref, points, _normal, _uv, color) {
      triangle(out, slot, points.map(transform), color);
    },
  };
};

function gate(out, lod) {
  if (lod === 0) return;
  const [x, z] = controls.entrance.local;
  const a = segment[plan.gateIndex].along;
  const g = localShape(out, [x, grade(x, z), z], -Math.atan2(a[1], a[0]));
  const colors = [c.lower, c.earth];
  for (const [i, side] of [-1, 1].entries()) {
    const center = side * 5.9;
    box(g, 'foot', [center - 2.31, -0.56, -4.1], [center + 2.31, 1.6, 4.1], colors[i]);
    const offset = [center, 0];
    const wallTop = side < 0 ? 6.1 : 6.7;
    const bottom = radialRing(0.9, 2.31, 3.46, 4, offset, Math.PI / 4);
    const cap = radialRing(wallTop, 1.83, 2.6, 4, offset, Math.PI / 4);
    loft(g, 'clay', [bottom, cap], c.earth, { cap: false });
    face(g, 'crown', cap, c.crest);
  }
}

function brokenWall(out) {
  const ring = [
    [-13, 0],
    [-5.45, 0],
    [-5.45, 4.1],
    [-6.05, 4.8],
    [-5.76, 5.7],
    [-6.69, 6.5],
    [-7.1, 8.6],
    [-8.25, 8.22],
    [-9.16, 8.83],
    [-10.45, 7.9],
    [-11.8, 8.14],
    [-13, 7.6],
  ];
  const z = 1.42;
  const hole = [
    [-11.48, 1.13],
    [-8.27, 1.13],
    [-8.27, 3.83],
    [-9.1, 4.2],
    [-11.35, 4.03],
  ];
  const vertices = [...ring, ...hole];
  const indices = earcut(vertices.flat(), [ring.length]);
  for (let i = 0; i < indices.length; i += 3) {
    const p = indices.slice(i, i + 3).map((j) => vertices[j]);
    const front = p.map((q) => [...q, z]);
    if (normalFor(...front)[2] < 0) front.reverse();
    triangle(out, 'plaster', front, c.worn);
    triangle(out, 'plaster', front.map(([x, y]) => [x, y, z - 0.96]).reverse(), c.wall);
  }
  for (const polygon of [ring, hole]) {
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i],
        b = polygon[(i + 1) % polygon.length];
      face(
        out,
        'foot',
        [
          [...a, z],
          [...a, z - 0.96],
          [...b, z - 0.96],
          [...b, z],
        ],
        c.rock,
      );
    }
  }
}

function portico(out, lod) {
  const { origin, bearing, width, depth, threshold } = plan.portico;
  const angle = Math.PI - bearing;
  const r = localShape(out, [origin[0], threshold, origin[1]], angle);
  const rear = -depth + 2.7;
  const front = 2.7;
  const half = width / 2 + 0.82;
  const lip = [
    [-half, 0, front + 0.22],
    [half, 0, front + 0.22],
    [half, 0, rear - 0.26],
    [-half, 0, rear - 0.26],
  ];
  const foot = lip.map(([x, _y, z], i) => {
    const u = x * (1.2 + (i % 2) * 0.045);
    const v = z + (z > 0 ? 3.15 : -2.1);
    const east = origin[0] + u * Math.cos(angle) + v * Math.sin(angle);
    const south = origin[1] - u * Math.sin(angle) + v * Math.cos(angle);
    return [u, Math.min(-0.37, grade(east, south) - threshold - 0.48), v];
  });
  loft(r, 'foot', [foot, lip], c.rock, { cap: false });
  face(r, 'crown', lip, c.crest);
  if (lod === 0) {
    box(r, 'plaster', [-width / 2, 0, rear], [width / 2, 4.35, front], c.plaster);
    return;
  }
  const frontLine = [
    [-6, front],
    [-1.9, front],
    [2.1, front],
    [5.8, front],
    [8.8, front - 0.36],
    [11.5, front - 1.56],
    [12.15, front - 3.16],
  ];
  for (const [i, [x, z]] of frontLine.entries()) {
    const w = i === 0 ? 0.93 : 0.63;
    box(r, 'plaster', [x - w / 2, 0, z - w / 2], [x + w / 2, 4.32, z + w / 2], c.plaster);
    box(
      r,
      'plaster',
      [x - w / 2 - 0.14, 3.75, z - w / 2 - 0.11],
      [x + w / 2 + 0.14, 4.07, z + w / 2 + 0.13],
      c.light,
    );
    if (lod > 1) {
      box(
        r,
        'plaster',
        [x - w / 2 - 0.075, 0.06, z - w / 2 - 0.075],
        [x + w / 2 + 0.075, 0.32, z + w / 2 + 0.075],
        c.wall,
      );
      box(
        r,
        'plaster',
        [x - w / 2 - 0.05, 3.45, z - w / 2 - 0.054],
        [x + w / 2 + 0.05, 3.52, z + w / 2 + 0.054],
        c.worn,
      );
    }
  }
  const roofRing = [
    [-6.5, front + 0.65],
    [-1.9, front + 0.65],
    [2.1, front + 0.65],
    [6.0, front + 0.65],
    [9.14, front + 0.23],
    [12.05, front - 1.08],
    [12.72, front - 2.97],
    [12.2, rear],
    [-6.5, rear],
  ];
  const roofFloor = roofRing.map(([x, z]) => [x, 4.04, z]);
  const roofTop = roofRing.map(([x, z], i) => [x, 4.74 + 0.08 * Math.sin(i * 1.75), z]);
  loft(r, 'plaster', [roofFloor, roofTop], c.plaster, { cap: false });
  const roofTriangles = earcut(roofRing.flat());
  for (let i = 0; i < roofTriangles.length; i += 3) {
    const selected = roofTriangles.slice(i, i + 3);
    const p = selected.map((j) => roofTop[j]);
    if (normalFor(...p)[1] < 0) p.reverse();
    triangle(r, 'plaster', p, c.light);
    const bottom = selected.map((j) => roofFloor[j]);
    if (normalFor(...bottom)[1] > 0) bottom.reverse();
    triangle(r, 'wood', bottom, c.timber);
  }
  for (let i = 0; i < frontLine.length - 1; i++) {
    const [x, z] = frontLine[i];
    const [b, d] = frontLine[i + 1];
    const trim = [
      [x, 4.54, z + 0.43],
      [b, 4.54, d + 0.43],
      [b, 5.21, d + 0.43],
      [x, 5.27, z + 0.43],
    ];
    face(r, 'plaster', trim, c.light);
    if (lod > 1) {
      const a0 = mix(trim[0], trim[1], 0.1),
        a1 = mix(trim[0], trim[1], 0.9);
      const b0 = mix(trim[3], trim[2], 0.1),
        b1 = mix(trim[3], trim[2], 0.9);
      face(
        r,
        'plaster',
        [mix(a0, b0, 0.24), mix(a1, b1, 0.24), mix(a1, b1, 0.76), mix(a0, b0, 0.76)].map(
          ([u, y, v]) => [u, y, v + 0.026],
        ),
        c.worn,
      );
    }
  }
  box(r, 'plaster', [-6.43, 0, rear], [12.1, 4.05, rear + 0.49], c.worn);
  box(r, 'plaster', [-6.55, 0, rear], [-6.03, 4.03, front], c.wall);
  brokenWall(r);
  box(r, 'foot', [-13, 0, rear], [-12.28, 6.08, front - 0.96], c.rock);
  if (lod === 3) {
    for (let i = 0; i < 10; i++) {
      const x = -5.8 + i * 1.86;
      box(r, 'wood', [x, 3.98, rear + 0.31], [x + 0.18, 4.07, front - 0.22], c.dark);
    }
  }
}

function build(out, lod) {
  curtain(out, lod);
  bastions(out, lod);
  gate(out, lod);
  portico(out, lod);
}
export const citadelSkyline = (out) => build(out, 0);
export const citadelDistrict = (out) => build(out, 1);
export const citadelStreet = (out) => build(out, 2);
export const citadelCloseup = (out) => build(out, 3);
const recipe = 'farah-citadel-model.mjs';
const camera = [705, 560, 845];
const lookAt = [0, 0, 0];
export const citadelModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: citadelCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Farah’s eroded earthen walls and round bastions, the southeast gate passage and the surviving pale columned portico.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-43, 59, -30],
  mediumFiContext: {
    scale: 19,
    groundY: 0,
    far: 11000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'earth_adobe',
    'earth_rammed',
    'stone_sandstone_raw',
    'plaster_lime',
    'wood_plain',
  ],
  qaCameras: [
    {
      name: 'southern-portico-and-rising-ground',
      position: [-125, -0.05, 393],
      lookAt: [-120, 3.9, 426],
    },
    { name: 'southeast-entrance-and-bastions', position: [163, 15, 412], lookAt: [152, 6, 346] },
    { name: 'earthen-northern-circuit', position: [-12, 143, -693], lookAt: [53, 0, -312] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-citadel-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'citadelSkyline',
    errorMeters: 4.2,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'citadelDistrict', 1.75],
        ['street', 'citadelStreet', 0.61],
        ['closeup', 'citadelCloseup', 0.21],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. The mapped wall and bastion controls are ODbL. The two exact Qualla photographs are CC0.',
};
