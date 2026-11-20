import { readFileSync } from 'node:fs';
import {
  closed,
  edge,
  face,
  floorSampler,
  mix,
  palette,
  pairs,
  shell,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json'),
  d = plan.dimensions,
  grade = floorSampler(read('terrain-grid.json'));
const c = palette({
  bed: '77756a',
  cap: '8a8775',
  shadow: '625f56',
  moss: '747563',
  tread: '888578',
  stone1: '8f8a7b',
  stone2: '7d7d72',
  stone3: '9a9482',
  stone4: '75786e',
  stone5: '878779',
});
const variants = [c.stone1, c.stone2, c.stone3, c.stone4, c.stone5, c.moss];
const surfaces = {
  fieldstone: surface('wall', 'stone_drywall', 0.97),
  coping: surface('foundation', 'stone_ashlar', 0.94),
};

function ridgeProfile(wall, u, inside, raised) {
  const heightAt = (distance) => {
    const [x, , z] = wall.p(u, 0, inside * distance);
    return grade([x, z]);
  };
  return {
    foot: Math.min(heightAt(0), heightAt(-0.85)) - 0.27,
    crest: Math.max(heightAt(0) + raised, heightAt(2.05) + 0.38),
  };
}
function campStone(out, wall, forward, a, b, lower, upper, j, i, count) {
  const phase = (i * 11 + j * 19) % variants.length;
  const width = b - a;
  const ext = 0.036 + (phase % 3) * 0.021;
  const point = (u, f) =>
    wall.p(u, mix(lower.foot, lower.crest, f), forward * (ext - (1 - f) * 0.37));
  const pointB = (u, f) =>
    wall.p(u, mix(upper.foot, upper.crest, f), forward * (ext - (1 - f) * 0.37));
  const fb = (j + 0.11) / count,
    ft = (j + 0.85) / count;
  const lo = a + width * 0.1,
    hi = b - width * 0.11;
  face(
    out,
    'fieldstone',
    [
      point(lo, fb + 0.025),
      pointB(hi, fb + 0.012),
      pointB(hi + 0.018, ft - 0.016),
      pointB(hi - width * 0.11, ft + 0.013),
      point(lo + width * 0.08, ft - 0.021),
    ],
    wall.normal.map((n) => n * forward),
    variants[phase],
  );
}

function retainingRun(out, route, level, kind) {
  for (const [segment, [a, b]] of pairs(route.local).entries()) {
    const w = edge(a, b);
    if (w.length < 0.48) continue;
    const middle = w.length * 0.5;
    const relativeGrade = (d) => {
      const [x, , z] = w.p(middle, 0, d);
      return grade([x, z]);
    };
    const inside = kind === 'tier' ? 1 : relativeGrade(2.9) >= relativeGrade(-2.9) ? 1 : -1;
    const outer = -inside;
    const raised = kind === 'tier' ? 0.95 : 0.73;
    const width = kind === 'tier' ? 1.04 : 1.45;
    const splits = Math.max(1, Math.ceil(w.length / [13, 7.4, 4.3, 3.85][level]));
    const profile = (u) => ridgeProfile(w, u, inside, raised);
    for (let i = 0; i < splits; i++) {
      const u = (w.length * i) / splits,
        v = (w.length * (i + 1)) / splits;
      const p = profile(u),
        q = profile(v);
      const pLow = w.p(u, p.foot, inside * 0.37),
        qLow = w.p(v, q.foot, inside * 0.37);
      const pFront = w.p(u, p.crest, 0),
        qFront = w.p(v, q.crest, 0);
      const pBack = w.p(u, p.crest - 0.04, inside * width),
        qBack = w.p(v, q.crest - 0.04, inside * width);
      const pBackLow = w.p(u, p.foot - 0.15, inside * width),
        qBackLow = w.p(v, q.foot - 0.15, inside * width);
      const normal = w.normal.map((n) => n * outer);
      face(
        out,
        'fieldstone',
        [pLow, qLow, qFront, pFront],
        normal,
        (segment + i) % 4 === 2 ? c.moss : c.bed,
      );
      face(
        out,
        'coping',
        [pFront, qFront, qBack, pBack],
        [0, 1, 0],
        (segment + i) % 3 === 1 ? c.moss : c.cap,
      );
      face(
        out,
        'fieldstone',
        [qBackLow, pBackLow, pBack, qBack],
        w.normal.map((n) => n * inside),
        c.shadow,
      );
      if (i === 0)
        face(
          out,
          'fieldstone',
          [pLow, pFront, pBack, pBackLow],
          [a[0] - b[0], 0, a[1] - b[1]],
          c.bed,
        );
      if (i === splits - 1)
        face(
          out,
          'fieldstone',
          [qLow, qFront, qBack, qBackLow],
          [b[0] - a[0], 0, b[1] - a[1]],
          c.bed,
        );
      if (level < 2 || (kind !== 'tier' && level < 3)) continue;
      const height = (p.crest - p.foot + q.crest - q.foot) / 2;
      const rows = Math.max(2, Math.ceil(height / [1, 1, 0.68, 0.43][level]));
      const stones = Math.max(2, Math.floor((v - u) / [1, 1, 0.95, 0.63][level]));
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < stones; col++) {
          const u0 = u + ((v - u) * (col + (row % 2) * 0.16)) / stones;
          const u1 = Math.min(v, u + ((v - u) * (col + 0.94 + (row % 2) * 0.16)) / stones);
          if (u1 - u0 < 0.08) continue;
          campStone(out, w, outer, u0, u1, profile(u0), profile(u1), row, col + i + segment, rows);
        }
      }
    }
  }
}

function steps(out, way, level) {
  for (const [a, b] of pairs(way.local)) {
    const w = edge(a, b),
      width = w.length > 8 ? 1.7 : 1.35;
    const n = Math.max(1, Math.round(w.length / [1.65, 0.86, 0.5, 0.43][level]));
    for (let i = 0; i < n; i++) {
      const u = (w.length * i) / n,
        v = (w.length * (i + 1)) / n;
      const corners = [
        w.p(u, 0, -width / 2),
        w.p(v + 0.025, 0, -width / 2),
        w.p(v + 0.025, 0, width / 2),
        w.p(u, 0, width / 2),
      ].map(([x, , z]) => [x, z]);
      const [x, , z] = w.p((u + v) / 2, 0);
      const y = grade([x, z]) + 0.29 + (i % 3) * 0.016;
      shell(out, corners, (p) => Math.min(y - 0.1, grade(p) - 0.29), y, {
        wall: 'coping',
        color: c.shadow,
        roof: 'coping',
        roofColor: i % 4 === 1 ? c.cap : c.tread,
      });
    }
  }
}

function build(out, level) {
  for (const way of d.tierWalls) retainingRun(out, way, level, 'tier');
  for (const way of d.retainingWalls) retainingRun(out, way, level, 'wall');
  for (const way of d.stairRuns) steps(out, way, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'iwamura-castle-model.mjs';
const camera = [123, 56, -132],
  lookAt = [5, -6, 5];
const errors = { district: 0.58, street: 0.21, closeup: 0.095 };
export const iwamuraCastleAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'castle',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: 'Original GSI 5 m bare-earth elevation inside the summit Honmaru.',
  brief:
    'The surviving Iwamura Castle retaining walls and six-tiered approach, with dry fieldstone faces and stone access steps integrated into the summit terrain.',
  camera,
  lookAt,
  sunDirection: [15, 55, -40],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
    groundY: -76,
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'six-stone-tiers', position: [28, -5.5, -47], lookAt: [14.5, -5.8, -25] },
    { name: 'summit-enclosure-and-stone-path', position: [-31, 18, -39], lookAt: [-5, -1, 5] },
    { name: 'west-retaining-wall-and-ascent', position: [-56, -0.2, -4], lookAt: [-26, -4, 8] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'iwamura-castle-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.2,
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
    'Original mesh under the project license. © OpenStreetMap contributors. Elevation by the Geospatial Information Authority of Japan.',
};
