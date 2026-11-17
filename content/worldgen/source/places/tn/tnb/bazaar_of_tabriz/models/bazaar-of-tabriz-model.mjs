/** Standing pitched brick vaults, roof clusters and open courts of Tabriz's historic market. */
import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const terrain = read('terrain-grid.json'),
  plan = read('plan-controls.json'),
  controls = read('roof-controls.json');
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.93 },
  arch: { slot: 'trim', graph: 'brick_longformat', roughness: 0.91 },
  vault: { slot: 'roof', graph: 'brick_stack', roughness: 0.93, doubleSided: true },
  roof: { slot: 'roof', graph: 'plaster_lime', roughness: 0.96 },
  stone: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.91 },
  pane: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.87 },
};
const detailedLanes = new Set([392928920, 392928923, 401741283, 494339692]);
const c = Object.fromEntries(
  Object.entries({
    brick: 'c29971',
    brickAlt: 'b88b67',
    paleBrick: 'd4b18d',
    redBrick: 'b47858',
    vault: 'bc9470',
    rib: 'd8ae84',
    crown: 'ddbd99',
    dark: '4b3930',
    wood: '694739',
    woodLight: '8d6751',
    roof: 'c5a989',
    roofA: 'bfab91',
    roofB: 'bda083',
    roofC: 'c9ad8c',
    stone: '999080',
    court: 'b0a18d',
    shade: '594c40',
  }).map(([k, v]) => [k, rgb(v)]),
);
const mix = (a, b, t) => a + (b - a) * t;
const mixPoint = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
const at = (point, y) => [point[0], y, point[1]];
const length = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const signed = (ring) =>
  ring.reduce((total, p, i) => {
    const next = ring[(i + 1) % ring.length];
    return total + p[0] * next[1] - p[1] * next[0];
  }, 0) * 0.5;
const oriented = (ring, clockwise) => (signed(ring) < 0 === clockwise ? ring : ring.toReversed());
const solid = (out, mat, x0, x1, y0, y1, z0, z1, tone) =>
  box(out, mat, [x0, y0, z0], [x1, y1, z1], c[tone]);

function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    low = terrain.heightsMeters[j],
    high = terrain.heightsMeters[j + 1];
  return (
    mix(mix(low[i], low[i + 1], u - i), mix(high[i], high[i + 1], u - i), v - j) -
    terrain.modelDatumElevationMeters
  );
}

function simplified(source, tolerance) {
  const ring = source.filter((p, i) => length(p, source[(i + 1) % source.length]) > 0.064);
  for (let i = ring.length - 1; i >= 0 && ring.length > 3; i--) {
    const a = ring[(i + ring.length - 1) % ring.length],
      p = ring[i],
      b = ring[(i + 1) % ring.length];
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = dx * dx + dz * dz;
    if (len < 0.05) continue;
    const offset = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len;
    if (offset > 0 && offset < 1 && length(p, mixPoint(a, b, offset)) < tolerance)
      ring.splice(i, 1);
  }
  return ring;
}

function roofCap(out, mat, outline, holes, elevation, tone) {
  const rings = [outline, ...holes];
  const vertices = rings.flat();
  const indices = earcut(
    vertices.flat(),
    holes.map((_, i) => rings.slice(0, i + 1).reduce((n, r) => n + r.length, 0)),
    2,
  );
  for (let i = 0; i < indices.length; i += 3) {
    const t = indices.slice(i, i + 3).map((j) => vertices[j]);
    if (Math.abs(signed(t)) < 0.0015) continue;
    triangle(
      out,
      mat,
      oriented(t, true).map((p) => at(p, elevation(p))),
      c[tone],
    );
  }
}

function cityRoof(out, building, lod) {
  const tolerance = lod === 0 ? 4.2 : lod === 1 ? 2.25 : lod === 2 ? 0.5 : 0.29;
  const outline = simplified(building.boundary, tolerance);
  const holes = building.holes
    .map((r) => simplified(r, tolerance))
    .filter((r) => r.length >= 3 && Math.abs(signed(r)) > 2.5);
  const y = ground(...building.center) + building.height;
  const elevation = () => y;
  const tone = ['roof', 'roofA', 'roofB', 'roofC'][building.id % 4];
  roofCap(out, 'roof', outline, holes, elevation, tone);
  for (const [ring, isOutside] of [[outline, true], ...holes.map((r) => [r, false])]) {
    const perimeter = oriented(ring, isOutside);
    for (let i = 0; i < perimeter.length; i++) {
      const a = perimeter[i],
        b = perimeter[(i + 1) % perimeter.length];
      const g = (p) => Math.min(y - 0.35, ground(...p) - 0.45);
      if (length(a, b) < 0.055) continue;
      face(
        out,
        'brick',
        [at(a, g(a)), at(b, g(b)), at(b, y), at(a, y)],
        c[isOutside ? 'brick' : 'brickAlt'],
      );
      if (lod >= 2 && length(a, b) > 3.5) {
        const top = y + 0.32;
        face(out, 'arch', [at(a, y - 0.03), at(b, y - 0.03), at(b, top), at(a, top)], c.paleBrick);
      }
    }
  }
}

function pointed(t, eave, rise) {
  const ratio = Math.abs(2 * t - 1);
  return eave + (rise * Math.sqrt(4 - Math.pow(1 + ratio, 2))) / Math.sqrt(3);
}

function frames(out, path, lod) {
  const lines = path.centerline,
    width = path.halfWidth,
    rise = path.rise,
    eave = path.eave;
  let last = 0;
  for (let i = 1; i < lines.length; i++) {
    const a = lines[last],
      b = lines[i],
      d = length(a, b);
    if (d < (lod === 0 ? 5 : 1.6) && i !== lines.length - 1) continue;
    last = i;
    if (d < 0.38) continue;
    const u = Math.atan2(b[0] - a[0], b[1] - a[1]);
    const local = transform(out, u, at(a, 0));
    const y0 = ground(...a),
      y1 = ground(...b);
    const y = (z) => mix(y0, y1, z / d);
    const q = (i, z, pad = 0) => [
      (i * 2 - 1) * (width + pad),
      y(z) + pointed(i, eave + 0.08, rise) + pad,
      z,
    ];
    const steppedLod = detailedLanes.has(path.id) ? lod : Math.min(lod, 2);
    const spans = steppedLod === 3 ? Math.max(1, Math.round(d / 6.8)) : 1;
    const contour = steppedLod === 0 ? 2 : steppedLod === 1 ? 2 : steppedLod === 2 ? 6 : 10;
    for (let bay = 0; bay < spans; bay++) {
      const z0 = (d * bay) / spans,
        z1 = (d * (bay + 1)) / spans,
        middle = (z0 + z1) * 0.5;
      const ventilated = steppedLod === 3 && z1 - z0 > 4.1;
      for (let j = 0; j < contour; j++) {
        const t0 = j / contour,
          t1 = (j + 1) / contour,
          next = z1 + (i === lines.length - 1 ? 0 : 0.095);
        const ranges =
          ventilated && (j === contour / 2 - 1 || j === contour / 2)
            ? [
                [z0, middle - 0.29],
                [middle + 0.29, next],
              ]
            : [[z0, next]];
        for (const [near, far] of ranges) {
          const skin = [q(t0, near), q(t0, far), q(t1, far), q(t1, near)];
          face(local, 'vault', skin, c.vault);
          if (steppedLod === 3)
            face(
              local,
              'vault',
              skin.toReversed().map(([x, y, z]) => [x, y - 0.17, z]),
              c.vault,
            );
        }
        if (steppedLod === 3)
          beam(local, 'arch', q(t0, z0, -0.16), q(t1, z0, -0.16), 0.21, 0.32, c.rib);
      }
      if (ventilated) {
        const rimY = q(0.5, middle)[1];
        for (const side of [-1, 1]) {
          const x = side * 0.273;
          solid(
            local,
            'arch',
            x - 0.075,
            x + 0.075,
            rimY - 0.76,
            rimY + 0.11,
            middle - 0.42,
            middle + 0.42,
            'crown',
          );
        }
      }
      if (steppedLod >= 2) stalls(local, width, y, z0, z1, steppedLod);
    }
    for (const s of [-1, 1]) {
      const x = s * width,
        outer = s * (width + 0.26);
      const ends = [
        [
          [x, y0 - 0.32, 0],
          [x, y1 - 0.32, d],
          [x, y1 + eave, d],
          [x, y0 + eave, 0],
        ],
        [
          [outer, y0 - 0.49, 0],
          [outer, y1 - 0.49, d],
          [outer, y1 + eave + 0.29, d],
          [outer, y0 + eave + 0.29, 0],
        ],
      ];
      if (steppedLod > 1)
        for (const [j, side] of ends.entries())
          face(local, 'brick', s > 0 === (j === 0) ? side : side.toReversed(), c.brick);
    }
    if (steppedLod === 3) {
      const floor = (x, z) => [x, y(z) + 0.11, z];
      face(
        local,
        'stone',
        [floor(-width, 0), floor(-width, d), floor(width, d), floor(width, 0)],
        c.stone,
      );
    }
  }
}

function stalls(out, width, groundAt, z0, z1, lod) {
  const d = z1 - z0;
  if (d < 3.3) return;
  const slots = lod === 3 ? Math.max(1, Math.round(d / 4.4)) : 1;
  for (let i = 0; i < slots; i++) {
    const a = mix(z0, z1, i / slots) + 0.39,
      b = mix(z0, z1, (i + 1) / slots) - 0.39;
    const y = groundAt((a + b) / 2);
    for (const side of [-1, 1]) {
      const x = side * (width - 0.039);
      const p = [
        [x, y + 0.38, a],
        [x, y + 0.38, b],
        [x, y + 3.03, b],
        [x, y + 3.03, a],
      ];
      face(out, 'pane', side > 0 ? p : p.toReversed(), c.dark);
      if (lod === 3) {
        solid(out, 'pane', x - 0.035, x + 0.035, y + 2.56, y + 2.64, a, b, 'woodLight');
        const middle = (a + b) * 0.5;
        solid(
          out,
          'pane',
          x - 0.07,
          x + 0.07,
          y + 0.37,
          y + 2.6,
          middle - 0.049,
          middle + 0.049,
          'woodLight',
        );
        solid(out, 'arch', x - 0.13, x + 0.13, y + 3.05, y + 3.23, a - 0.08, b + 0.08, 'paleBrick');
      }
    }
  }
}

function ringDome(out, datum, dome, lod) {
  const { center, radiusX, radiusZ, spring, height, angle, major } = dome;
  const local = transform(out, angle, at(center, datum));
  const steps = lod === 0 ? 8 : lod === 1 ? 12 : lod === 2 ? 22 : 32;
  const levels = lod < 2 ? 2 : lod === 2 ? 5 : 8;
  const finish = 0.965;
  const point = (section, ring) => {
    const t = (section / levels) * finish,
      theta = (ring / steps) * Math.PI * 2;
    const rad = Math.cos(t * Math.PI * 0.5);
    const y = spring + (height - spring) * Math.sin(t * Math.PI * 0.5);
    return [radiusX * rad * Math.cos(theta), y, radiusZ * rad * Math.sin(theta)];
  };
  for (let j = 0; j < levels; j++)
    for (let i = 0; i < steps; i++) {
      const skin = [point(j, i), point(j + 1, i), point(j + 1, i + 1), point(j, i + 1)];
      face(local, 'vault', skin, c.vault);
      if (lod === 3 && major)
        face(
          local,
          'vault',
          skin.toReversed().map(([x, y, z]) => [x, y - 0.17, z]),
          c.vault,
        );
    }
  for (let i = 0; i < steps; i++) {
    const p = point(0, i),
      q = point(0, i + 1);
    if (lod > 0) {
      face(local, 'arch', [[p[0], spring - 0.33, p[2]], [q[0], spring - 0.33, q[2]], q, p], c.rib);
      const atCardinalDoor = i % Math.round(steps / 4) <= Math.floor(steps / 15);
      const floor = atCardinalDoor ? Math.min(spring - 0.38, 3.65) : -0.67;
      face(
        local,
        'brick',
        [
          [q[0], floor, q[2]],
          [p[0], floor, p[2]],
          [p[0], spring - 0.33, p[2]],
          [q[0], spring - 0.33, q[2]],
        ],
        c.brick,
      );
    }
    if (major && lod === 3 && i % 4 === 0) {
      for (let j = 0; j < levels - 1; j++) {
        const inset = (a) => [a[0] * 0.989, a[1] - 0.11, a[2] * 0.989];
        beam(local, 'arch', inset(point(j, i)), inset(point(j + 1, i)), 0.19, 0.22, c.rib);
      }
    }
  }
  if (lod > 1) {
    const y = point(levels, 0)[1];
    const a = Math.max(0.37, Math.abs(point(levels, 0)[0]));
    const b = Math.max(0.38, Math.abs(point(levels, steps / 4)[2]));
    for (let i = 0; i < 12; i++) {
      const p = (j, h) => [a * Math.cos((j * Math.PI) / 6), y + h, b * Math.sin((j * Math.PI) / 6)];
      face(local, 'arch', [p(i + 1, 0), p(i, 0), p(i, 0.47), p(i + 1, 0.47)], c.crown);
    }
  }
}

function courtEdges(out, court, lod) {
  const outline = oriented(simplified(court.outline, lod === 3 ? 0.84 : 1.38), false);
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length],
      d = length(a, b);
    if (d < 2.75) continue;
    const angle = Math.atan2(a[1] - b[1], b[0] - a[0]);
    const ga = ground(...a),
      gb = ground(...b);
    const local = transform(out, angle, at(a, 0));
    const g = (x) => mix(ga, gb, x / d);
    for (const [base, top, push, tone] of [
      [-0.17, 0.59, 0.05, 'stone'],
      [0.59, court.height, 0.035, 'brick'],
    ]) {
      face(
        local,
        tone,
        [
          [0, g(0) + base, push],
          [d, g(d) + base, push],
          [d, g(d) + top, push],
          [0, g(0) + top, push],
        ],
        c[tone],
      );
    }
    if (lod < 3) continue;
    const bays = Math.floor(d / 4.1);
    if (!bays) continue;
    for (let j = 0; j < bays; j++) {
      const span = d / bays,
        x = (j + 0.5) * span,
        y = g(x),
        spring = y + 2.92,
        r = 0.47 * span - 0.34;
      const p = (t) => [x + r * Math.cos(Math.PI * t), pointed(t, spring, 1.03), 0.108];
      const darkBottom = y + 0.53;
      face(
        local,
        'pane',
        [
          [x - r, darkBottom, 0.106],
          [x + r, darkBottom, 0.106],
          [x + r, spring, 0.106],
          [x - r, spring, 0.106],
        ],
        c.dark,
      );
      for (let k = 0; k < 8; k++)
        triangle(local, 'pane', [[x, spring, 0.108], p(k / 8), p((k + 1) / 8)], c.dark);
      for (const yy of [y + 4.58, y + 5.73]) {
        face(
          local,
          'pane',
          [
            [x - 0.73, yy - 0.34, 0.11],
            [x + 0.73, yy - 0.34, 0.11],
            [x + 0.73, yy + 0.35, 0.11],
            [x - 0.73, yy + 0.35, 0.11],
          ],
          c.wood,
        );
      }
    }
  }
}

function build(out, lod) {
  const roofs =
    lod === 0
      ? controls.roofs.slice(0, 19)
      : lod === 1
        ? controls.roofs.slice(0, 91)
        : controls.roofs;
  for (const r of roofs) cityRoof(out, r, lod);
  const courtBands = lod === 1 ? 9 : lod === 2 ? 17 : controls.inferred.length;
  if (lod > 0) for (const wing of controls.inferred.slice(0, courtBands)) cityRoof(out, wing, 1);
  const lanes =
    lod === 0
      ? controls.corridors.filter((r) =>
          [392928920, 401741283, 401916906, 494339692].includes(r.id),
        )
      : lod === 1
        ? controls.corridors.filter((r) => r.major)
        : controls.corridors;
  for (const lane of lanes) frames(out, lane, lod);
  for (const dome of controls.domes) ringDome(out, ground(...dome.center), dome, lod);
  if (lod > 1) for (const court of controls.courts) courtEdges(out, court, lod);
}

export const bazaarOfTabrizSkyline = (out) => build(out, 0);
export const bazaarOfTabrizDistrict = (out) => build(out, 1);
export const bazaarOfTabrizStreet = (out) => build(out, 2);
export const bazaarOfTabrizCloseup = (out) => build(out, 3);
const recipe = 'bazaar-of-tabriz-model.mjs';
const camera = [-395, 415, 592],
  lookAt = [59, 0, -25];
const alley = controls.corridors.find((l) => l.id === 401741283);
const [aa, ab] = alley.centerline;
const eye = mixPoint(aa, ab, 0.77),
  focus = mixPoint(aa, ab, 0.43);
export const bazaarOfTabrizModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  category: 'commercial',
  build: bazaarOfTabrizCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  buildingCutout: {
    outline: controls.masks[0],
    outlines: controls.masks,
    minimumCoverage: 0.91,
    basis:
      'The largest native market building outlines. Open courts and public streets are separately preserved.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Tabriz’s historic roofscape of square brick blocks, long pointed vaults, domed carpet and gold halls, and open caravanserai courts.',
  camera,
  lookAt,
  sunDirection: [-410, 500, 340],
  portableGroundY: -14,
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 0.79,
    cameraYaw: 0.11,
    focus: { center: [60, 1, -25] },
    groundY: -14,
    far: 4500,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'connected-bazaar-roofscape', position: camera, lookAt },
    { name: 'amir-domes-and-open-caravanserai', position: [47, 70, 321], lookAt: [121, 3, 199] },
    { name: 'central-brick-roofs-and-carpet-hall', position: [-90, 50, 100], lookAt: [9, 1, -19] },
    {
      name: 'covered-amir-market-lane',
      position: at(eye, ground(...eye) + 1.65),
      lookAt: at(focus, ground(...focus) + 3.35),
    },
    {
      name: 'northern-covered-rows-and-courts',
      position: [265, 126, -405],
      lookAt: [122, -6, -203],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'market-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'bazaarOfTabrizSkyline',
    errorMeters: 8.5,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'bazaarOfTabrizDistrict', 3.1],
        ['street', 'bazaarOfTabrizStreet', 1.05],
        ['closeup', 'bazaarOfTabrizCloseup', 0.19],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  sourceLicense:
    'Original geometry informed by the self-released public-domain Qualla photograph. OpenStreetMap geometry ODbL 1.0.',
  limitations: plan.limitations,
};
