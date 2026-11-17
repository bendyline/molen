/** The surviving upper adobe citadel of Meybod as photographed in 2009. */
import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const terrain = read('terrain-grid');
const [footprint] = frame.geometry.polygons;
const controls = plan.estimatedControls;
const surfaces = {
  clay: { slot: 'wall', graph: 'earth_adobe', roughness: 0.98, metallic: 0 },
  fill: { slot: 'foundation', graph: 'earth_rammed', roughness: 0.99, metallic: 0 },
  accent: { slot: 'trim', graph: 'earth_adobe', roughness: 0.98, metallic: 0 },
};
const tone = Object.fromEntries(
  Object.entries({
    light: 'b49a75',
    clay: 'a58b64',
    old: '9c825d',
    crest: 'b69c77',
    pale: 'c0a480',
    ground: 'aa916c',
    erosion: '9a7e58',
    shadow: '725b40',
    deep: '614b32',
  }).map(([name, color]) => [name, rgb(color)]),
);
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const toPoint = ([x, z], y) => [x, y, z];
function ground([x, z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const h = terrain.heightsMeters;
  return (
    lerp(lerp(h[j][i], h[j][i + 1], u - i), lerp(h[j + 1][i], h[j + 1][i + 1], u - i), v - j) -
    terrain.modelDatumElevationMeters
  );
}
const tau = 2 * Math.PI;

function emit(out, slot, points, direction, color) {
  const facing = normalFor(...points).reduce((sum, x, i) => sum + x * direction[i], 0);
  const ordered = facing > 0 ? points : points.toReversed();
  if (ordered.length === 4) face(out, slot, ordered, color);
  else triangle(out, slot, ordered, color);
}

function cap(out, slot, points, color) {
  const indices = earcut(points.flatMap(([x, , z]) => [x, z]));
  for (let i = 0; i < indices.length; i += 3) {
    emit(
      out,
      slot,
      indices.slice(i, i + 3).map((j) => points[j]),
      [0, 1, 0],
      color,
    );
  }
}

function skin(out, slot, lower, upper, colors) {
  for (let i = 0; i < lower.length; i++) {
    const j = (i + 1) % lower.length;
    const a = lower[i],
      b = lower[j];
    emit(
      out,
      slot,
      [a, b, upper[j], upper[i]],
      [a[2] - b[2], 0, b[0] - a[0]],
      colors[i % colors.length],
    );
  }
}

function ringDetail(points, n) {
  return points.flatMap((p, i) => {
    const other = points[(i + 1) % points.length];
    return Array.from({ length: n }, (_, j) => mix(p, other, j / n));
  });
}

function mound(out, lod) {
  const outline = ringDetail(footprint, [1, 3, 6, 8][lod]);
  const rubble = (p, i) =>
    (Math.sin(i * 1.39 + p[0] * 0.29) + Math.cos(i * 2.57 + p[1] * 0.23)) * 0.49;
  const bank = outline.map((p) => toPoint(p, ground(p) - 1.05));
  const toe = outline.map((p, i) => toPoint(p, ground(p) + 0.8 + rubble(p, i) * 0.31));
  const slope = outline.map((p, i) =>
    toPoint(mix([1, -1], p, 0.91 + (i % 5) * 0.014), 2.8 + rubble(p, i)),
  );
  const shoulder = outline.map((p, i) => toPoint(mix([1, -2], p, 0.83), 5.3 + rubble(p, i) * 0.75));
  const top = outline.map((p, i) => toPoint(mix([2, -2], p, 0.78), 6.2 + rubble(p, i) * 0.32));
  skin(out, 'fill', bank, toe, [tone.ground, tone.erosion, tone.ground, tone.old]);
  if (lod >= 1) {
    skin(out, 'fill', toe, slope, [tone.erosion, tone.ground, tone.ground, tone.old, tone.ground]);
    skin(out, 'fill', slope, shoulder, [tone.ground, tone.ground, tone.old, tone.ground]);
    skin(out, 'fill', shoulder, top, [tone.light, tone.old, tone.clay, tone.light]);
  } else {
    skin(out, 'fill', toe, top, [tone.ground, tone.old]);
  }
  cap(out, 'fill', top, tone.ground);
  if (lod < 2) return;
  for (let i = 0; i < outline.length; i++) {
    if (i % 6 === 2 || i % 6 === 3) continue;
    const j = (i + 1) % outline.length;
    const a = mix(toe[i], slope[i], 0.41 + (i % 5) * 0.11);
    const b = mix(toe[j], slope[j], 0.41 + (i % 5) * 0.11);
    const normal = normalFor(toe[i], toe[j], slope[j]);
    const offset = (p, y) => [p[0] + normal[0] * 0.065, p[1] + y, p[2] + normal[2] * 0.065];
    emit(
      out,
      'accent',
      [offset(a, 0.0), offset(b, -0.08), offset(b, 0.14), offset(a, 0.23)],
      normal,
      i % 5 === 0 ? tone.deep : tone.erosion,
    );
  }
}

const curtain = [
  [27, 21],
  [29, 1],
  [15, -19],
  [2, -23],
  [-17, -20],
  [-22, -12],
  [-28, 20],
  [18, 25],
];
const remnantHeights = [9.8, 10.6, 9.4, 11.7, 10.0, 10.8, 12.6, 10.6];

function rampart(out, lod) {
  const n = [1, 3, 5, 7][lod];
  const outline = ringDetail(curtain, n);
  const crest = outline.map((_, i) => {
    const segment = Math.floor(i / n),
      t = (i % n) / n;
    return (
      lerp(remnantHeights[segment], remnantHeights[(segment + 1) % curtain.length], t) -
      (i % 3) * 0.21
    );
  });
  const lower = outline.map((p) => toPoint(p, Math.max(0.8, ground(p) + 0.35)));
  const middle = outline.map((p, i) => toPoint(mix([0, 0], p, 0.968), lerp(5.7, crest[i], 0.28)));
  const edge = outline.map((p, i) => toPoint(mix([0, -1], p, 0.92), crest[i]));
  const inner = outline.map((p, i) => toPoint(mix([1, 0], p, 0.82), crest[i] - 0.12));
  skin(out, 'clay', lower, middle, [tone.old, tone.clay, tone.clay, tone.old]);
  skin(out, 'clay', middle, edge, [tone.clay, tone.clay, tone.light, tone.clay]);
  skin(out, 'fill', edge, inner, [tone.crest, tone.light]);
  skin(
    out,
    'clay',
    inner,
    inner.map(([x, , z]) => [x, 5.0, z]),
    [tone.clay, tone.old],
  );
  if (lod < 2) return;
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    if (i % 3 === 2) continue;
    for (const [station, y, w] of [
      [0.31, 0.53, 0.12],
      [0.72, 0.73, 0.08],
    ]) {
      const a = mix(middle[i], middle[j], station - w);
      const b = mix(middle[i], middle[j], station + w);
      const c = mix(edge[i], edge[j], station + w);
      const d = mix(edge[i], edge[j], station - w);
      const shift = normalFor(a, b, c).map((x) => x * 0.028);
      const onWall = (a, b, f) => mix(a, b, f).map((x, axis) => x + shift[axis]);
      emit(
        out,
        'accent',
        [onWall(a, d, y), onWall(b, c, y), onWall(b, c, y + 0.088), onWall(a, d, y + 0.061)],
        shift,
        i % 5 === 0 ? tone.deep : tone.erosion,
      );
    }
  }
}

function roundStack(out, center, levels, radii, n, finish) {
  const rings = levels.map((height, band) =>
    Array.from({ length: n }, (_, i) => {
      const a = (-tau * i) / n;
      const r = radii[band];
      const lip = finish && band === levels.length - 1 ? ((i % 3) - 1) * 0.16 : 0;
      return [center[0] + r * Math.cos(a), height + lip, center[1] + r * Math.sin(a)];
    }),
  );
  for (let i = 1; i < rings.length; i++)
    skin(out, 'clay', rings[i - 1], rings[i], [tone.clay, tone.light, tone.clay, tone.old]);
  cap(out, 'fill', rings.at(-1), tone.old);
}

function decoratedTower(out, lod) {
  const center = controls.tower,
    heights = controls.towerLevels,
    radii = controls.towerRadii;
  roundStack(out, center, heights, radii, [12, 24, 42, 56][lod], true);
  if (lod === 0) return;
  const onTower = (a, y) => {
    const band = y > heights[2] ? 2 : 1;
    const r =
      lerp(
        radii[band],
        radii[band + 1],
        (y - heights[band]) / (heights[band + 1] - heights[band]),
      ) + 0.043;
    return [center[0] + r * Math.cos(a), y, center[1] + r * Math.sin(a)];
  };
  const decorate = (a, y, points, color) =>
    emit(
      out,
      'accent',
      points.map(([u, v]) => onTower(a + u, y + v)),
      [Math.cos(a), 0, Math.sin(a)],
      color,
    );
  for (let i = 0; i < 18; i++) {
    const a = (tau * i) / 18;
    for (const [j, y] of [13.4, 15.3, 17.0].entries()) {
      const phi = a + (j === 1 ? tau / 36 : 0);
      decorate(
        phi,
        y,
        [
          [-0.128, 0.07],
          [-0.014, -0.45],
          [0.039, -0.29],
          [-0.075, 0.22],
        ],
        tone.shadow,
      );
      decorate(
        phi,
        y,
        [
          [-0.019, -0.44],
          [0.103, 0.06],
          [0.062, 0.22],
          [-0.046, -0.25],
        ],
        tone.erosion,
      );
    }
    if (i % 2 === 0) {
      decorate(
        a,
        19.1,
        [
          [-0.039, -0.43],
          [0.036, -0.43],
          [0.036, 0.45],
          [-0.039, 0.45],
        ],
        tone.deep,
      );
      decorate(
        a + 0.17,
        18.9,
        [
          [-0.065, 0],
          [0, -0.38],
          [0.064, 0],
          [0, 0.44],
        ],
        tone.shadow,
      );
    }
    if (lod >= 2) {
      decorate(
        a,
        20.71,
        [
          [-0.131, 0.0],
          [0.137, 0.0],
          [0.137, 0.15],
          [-0.131, 0.15],
        ],
        tone.light,
      );
      decorate(
        a,
        21.54,
        [
          [-0.13, 0],
          [0.045, 0],
          [0.09, 0.24],
          [-0.096, 0.24],
        ],
        tone.pale,
      );
    }
  }
}

const keep = [
  [7.3, 4.8],
  [6.1, -15.2],
  [-3.3, -23.5],
  [-21.7, -17.1],
  [-24.8, -0.9],
  [-17.9, 7.3],
];
const centralCrest = [18.3, 18.6, controls.keepCrest, 18.9, 18.1, 17.5];

function keepWall(out, lod) {
  const tiers = [7.5, 12.2, 15.2];
  const bases = keep.map((p) => toPoint(mix(controls.keepCenter, p, 1.15), tiers[0]));
  const lower = keep.map((p) => toPoint(mix(controls.keepCenter, p, 1.12), tiers[1]));
  const shoulder = keep.map((p) => toPoint(p, tiers[2]));
  const upper = keep.map((p, i) => toPoint(mix(controls.keepCenter, p, 0.98), centralCrest[i]));
  skin(out, 'clay', bases, lower, [tone.old, tone.clay, tone.clay]);
  skin(out, 'clay', lower, shoulder, [tone.clay, tone.light, tone.old]);
  skin(out, 'clay', shoulder, upper, [tone.clay, tone.clay, tone.old, tone.light]);
  cap(out, 'fill', upper, tone.crest);
  for (let i = 0; i < keep.length; i++) {
    const j = (i + 1) % keep.length;
    const a = shoulder[i],
      b = shoulder[j],
      c = upper[j],
      d = upper[i];
    const normal = normalFor(a, b, c);
    const onWall = (u, v, offset) =>
      mix(mix(a, b, u), mix(d, c, u), v).map((p, axis) => p + normal[axis] * offset);
    const n = [1, 4, 6, 7][lod];
    for (let k = 0; k < n; k++) {
      const u = (k + 0.6) / (n + 0.13);
      const w = 0.13 / n;
      emit(
        out,
        'accent',
        [
          onWall(u - w, 0.28, 0.024),
          onWall(u + w, 0.28, 0.024),
          onWall(u + w, 0.53, 0.024),
          onWall(u - w, 0.53, 0.024),
        ],
        normal,
        tone.shadow,
      );
      if (lod >= 2 && (i + k) % 3 < 2) {
        const bottom = [onWall(u - w, 0.97, 0.09), onWall(u + w, 0.97, 0.09)];
        const lip = bottom.map(([x, y, z]) => [x, y + 0.43 + ((k + i) % 3) * 0.12, z]);
        const rear = lip.map(([x, y, z]) => [x - normal[0] * 0.56, y - 0.03, z - normal[2] * 0.56]);
        emit(out, 'clay', [...bottom, ...lip.toReversed()], normal, tone.old);
        emit(out, 'fill', [...lip, ...rear.toReversed()], [0, 1, 0], tone.crest);
      }
    }
  }
}

function build(out, lod) {
  mound(out, lod);
  rampart(out, lod);
  roundStack(
    out,
    controls.bastion,
    [Math.min(0, ground(controls.bastion)) - 0.5, 2.6, 6.6, 9.5],
    [controls.bastionRadius, 6.9, 6.0, 5.4],
    [10, 18, 26, 36][lod],
    false,
  );
  roundStack(
    out,
    [-25.1, 18],
    [2.2, 6.2, 11.3, 13.2],
    [5.2, 4.8, 4.12, 3.72],
    [8, 14, 22, 26][lod],
    true,
  );
  roundStack(
    out,
    [8.1, -6.6],
    [7.3, 10.3, 13.5, 14.0],
    [4.0, 3.7, 3.2, 3.14],
    [8, 14, 22, 26][lod],
    true,
  );
  keepWall(out, lod);
  decoratedTower(out, lod);
}

export const narynSkyline = (out) => build(out, 0);
export const narynDistrict = (out) => build(out, 1);
export const narynStreet = (out) => build(out, 2);
export const narynCloseup = (out) => build(out, 3);
const recipe = 'naryn-castle-meybod-model.mjs';
const camera = [61, 37, 92],
  lookAt = [-2, 8.3, 0];

export const narynModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: narynCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The surviving earthen citadel at Meybod, with irregular adobe ramparts on an eroded mound, a round tower bearing geometric adobe patterns and the stepped inner keep.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  portableGroundY: -8,
  sunDirection: [-18, 28, 35],
  mediumFiContext: {
    scale: 1.27,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: footprint,
    minimumCoverage: 0.92,
    basis: 'Named mapped upper citadel footprint.',
  },
  embeddedCanonicalGraphs: ['earth_adobe', 'earth_rammed'],
  qaCameras: [
    { name: 'southern-mound-tower-and-keep', position: [10, 15, 75], lookAt: [-5, 11.7, 0] },
    { name: 'patterned-round-tower', position: [37, 20, 41], lookAt: [17, 16, 12] },
    { name: 'eastern-bastion-and-curtain', position: [68, 26, 25], lookAt: [9, 7, 3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `south-citadel-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'narynSkyline',
    errorMeters: 1.3,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'narynDistrict', 0.51],
        ['street', 'narynStreet', 0.21],
        ['closeup', 'narynCloseup', 0.09],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model geometry under the repository license. The geographic outline is ODbL. The published photograph used as a reference is public domain by Betta27.',
};
