/** Surviving collapsed mudbrick, not the lost ideal pyramid or its symbolic map circle. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import { normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const dir = new URL(
    '../../../content/worldgen/source/places/st/stq/black_pyramid/',
    import.meta.url,
  ),
  p = JSON.parse(fs.readFileSync(new URL('plan-controls.json', dir))),
  ref = 'palette:#ffffff',
  colors = { core: rgb('99856f'), broken: rgb('a18d75'), talus: rgb('ad9a7e') },
  surfaces = {
    core: { slot: 'wall', graph: 'earth_adobe', roughness: 0.98, metallic: 0 },
    broken: { slot: 'trim', graph: 'earth_rammed', roughness: 0.98, metallic: 0 },
    talus: { slot: 'roof', graph: 'gravel', roughness: 0.99, metallic: 0 },
  };
function T(o, s, q, normal) {
  q = q.map((v) => v.map(Math.fround));
  let n = normalFor(...q);
  if (n.every((v) => v === 0)) return;
  if (normal && n.reduce((a, v, i) => a + v * normal[i], 0) < 0) q = [q[0], q[2], q[1]];
  n = normalFor(...q);
  const shade = 0.985 + 0.015 * Math.sin(q[0][0] * 0.61 + q[0][1] * 2.37 + q[0][2] * 0.41);
  o.addTriangle(
    s,
    ref,
    q,
    n,
    q.map((v) => [v[0] + v[2], v[1]]),
    colors[s].map((v) => v * shade),
  );
}
const mix = (a, b, t) => a + (b - a) * t;
function section(y) {
  const levels = p.profiles;
  if (y <= 0) return levels[0];
  for (let i = 1; i < levels.length; i++) {
    if (y > levels[i].y) continue;
    const a = levels[i - 1],
      b = levels[i],
      t = (y - a.y) / (b.y - a.y);
    return Object.fromEntries(Object.keys(a).map((k) => [k, mix(a[k], b[k], t)]));
  }
  return levels.at(-1);
}
function tent(v, at, radius) {
  let distance = Math.abs(v - at);
  distance = Math.min(distance, 32 - distance);
  return Math.max(0, 1 - distance / radius);
}
/** Explicit photographic sections retain the upper cliff, right shoulder and front gullies. */
function point(y, u, detail) {
  const s = section(y),
    t = (((u % 1) + 1) % 1) * 32,
    i = Math.floor(t),
    f = t - i,
    a = p.estimatedOutline[i],
    b = p.estimatedOutline[(i + 1) % 32],
    bx = mix(a[0], b[0], f) / 56,
    bz = mix(a[1], b[1], f) / 51,
    // The plan runs counterclockwise: front (+Z/west) is control 8.
    gully = tent(t, 7.1, 1.15) + tent(t, 9.8, 0.95) * 0.68,
    brokenRight = tent(t, 3.7, 1.6) * Math.max(0, 1 - Math.abs(y - 27) / 16),
    cliff = Math.max(0, Math.min(1, (y - 22) / 10)) * Math.max(0, Math.min(1, (51 - y) / 5)),
    // Sub-metre course relief never changes the authored large-scale silhouette.
    relief =
      detail < 2
        ? 0
        : (detail > 2 ? 0.025 : 0.015) *
          cliff *
          (Math.sin(y * 4.3 + t * 1.7) + 0.5 * Math.sin(y * 1.7 - t * 1.9)),
    channel = Math.max(0, 1 - Math.abs(y - 27) / 25) * Math.sin(t * 3.1) * (detail > 1 ? 0.24 : 0);
  let x = s.x + (bx * s.w) / 2 + Math.sign(bx) * (relief + channel),
    z = s.z + (bz * s.d) / 2 + Math.sign(bz) * (relief + channel);
  z -= s.gully * gully;
  x += brokenRight * 2.4;
  const breaks = [0.7, -1.6, 0.2, 1.5, -1.1, 2.2, -0.6, 1.2],
    v = t / 4,
    at = Math.floor(v),
    brokenLevel =
      mix(breaks[at], breaks[(at + 1) % breaks.length], v - at) *
      Math.max(0, Math.min(1, y / 10, (52 - y) / 10));
  return [x, y + brokenLevel, z];
}
function build(o, _frame, detail = 3) {
  const nominal = [16, 32, 64, 144][detail],
    us = [
      ...new Set([
        ...Array.from({ length: nominal }, (_, i) => i / nominal),
        ...[7.1, 8.3, 9.8, 11].map((v) => v / 32),
      ]),
    ].sort((a, b) => a - b),
    count = us.length,
    rows = [16, 40, 90, 160][detail],
    ys = [
      ...new Set([
        -0.55,
        ...p.profiles.map((r) => r.y),
        ...Array.from({ length: rows - 1 }, (_, i) => ((i + 1) / rows) * 52),
      ]),
    ].sort((a, b) => a - b);
  for (let j = 1; j < ys.length; j++) {
    const y0 = ys[j - 1],
      y1 = ys[j],
      s0 = section(y0),
      s1 = section(y1),
      slope = Math.hypot(s1.w - s0.w, s1.d - s0.d) / Math.max(0.01, y1 - y0);
    for (let i = 0; i < count; i++) {
      const u0 = us[i],
        u1 = us[(i + 1) % count],
        a = point(y0, u0, detail),
        b = point(y0, u1, detail),
        c = point(y1, u1, detail),
        d = point(y1, u0, detail),
        nearGully = tent(((u0 + u1) / 2) * 32, 7.1, 1.3) + tent(((u0 + u1) / 2) * 32, 9.8, 1.1),
        slot = y1 < 23 || slope > 3 ? 'talus' : nearGully > 0.35 ? 'broken' : 'core';
      // Winding follows the real irregular section, including the recessed gullies.
      // Reversing the counterclockwise ring yields outward-facing walls.
      T(o, slot, [a, d, c]);
      T(o, slot, [a, c, b]);
    }
  }
  const top = p.profiles.at(-1),
    crown = [top.x, top.y, top.z];
  for (let i = 0; i < count; i++) {
    T(
      o,
      'broken',
      [crown, point(52, us[i], detail), point(52, us[(i + 1) % count], detail)],
      [0, 1, 0],
    );
    T(
      o,
      'talus',
      [[0, -0.55, 0], point(-0.55, us[i], detail), point(-0.55, us[(i + 1) % count], detail)],
      [0, -1, 0],
    );
  }
}
export function blackPyramidSkyline(o) {
  build(o, undefined, 0);
}
export function blackPyramidDistrict(o) {
  build(o, undefined, 1);
}
export function blackPyramidStreet(o) {
  build(o, undefined, 2);
}
export function blackPyramidCloseup(o) {
  build(o, undefined, 3);
}
export const blackPyramidModel = {
  id: 'black_pyramid',
  key: 'black_pyramid',
  cell: 'st/stq',
  recipe: 'structure-black-pyramid.mjs',
  title: 'Black Pyramid',
  category: 'monument',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [110, 72, 145],
  lookAt: [-4, 24, 0],
  portableGroundY: -0.18,
  mediumFiContext: {
    scale: 1.6,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    {
      name: 'whole-collapsed-core-and-offset-truncated-crown',
      position: [0, 39, 150],
      lookAt: [-4, 25, 0],
    },
    {
      name: 'steep-mudbrick-cliff-and-eroded-front-gullies',
      position: [14, 36, 51],
      lookAt: [-2, 34, 5],
    },
    {
      name: 'broken-summit-and-asymmetric-shoulders',
      position: [-31, 75, 36],
      lookAt: [-7, 38, -1],
    },
    { name: 'rear-ruin-profile-bounded-estimate', position: [-110, 65, -130], lookAt: [-3, 24, 0] },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent400m129x129field frozen before geometry; fixed western approach datum. Monument returns/coarse DEM do not establish surveyed base/host contact.',
  groundCutout: {
    outline: p.estimatedOutline.map((q) => q.map((v) => v * 0.97)),
    basis:
      'Only overlap beneath the estimated intrinsic core/talus is clipped for terrain review. Raw independent source field remains unchanged and can include the ruin itself; avoid rendering two copies of the mound. This is not the symbolic native180m circle or a desert parcel opening. Exact live host contact remains unverified.',
  },
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-black-pyramid.mjs',
    level: 'skyline',
    export: 'blackPyramidSkyline',
    errorMeters: 1.7,
    surfaces,
    authoredLevels: {
      district: { export: 'blackPyramidDistrict', errorMeters: 0.8, surfaces },
      street: { export: 'blackPyramidStreet', errorMeters: 0.32, surfaces },
      closeup: { export: 'blackPyramidCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Qualla-first ca1857FrancisFrith museumCC0original and supplemental exact lumoplank modern creatorCC0original individually inspected/native-SHA1matched. Modern primary author/creator and transfer bind same NSID/CC0release. Historic detail informs construction only; current major masses confirmed separately. No uncertain copyright source or photographic texture.',
    'Whole surviving mudbrick core and intrinsic collapsed rubble slopes only. Off-center truncated crown, steep upper cliffs, lower right shoulder and two eroded front gullies are original shaped geometry.52mheight/112x102mcollapse envelope and concealed erosion/courses are explicit photographic medium-fi estimates, not surveyed dimensions or exact current fracture census. No ideal75mcap, limestone casing reconstruction, generic cone or fantasy entrance.',
    'Native32vertex180m circle is a coarse archaeological identity/area, not the ruin footprint. It is retained separately and never extruded; nearby temples/enclosure/anonymous ruins, burial interiors and museum pyramidion are excluded.',
    'Independent400m129x129field/16641samples unchanged; composite DEM may include the ruined mound itself. Only intrinsic model overlap is opened for context/shared terrain so the model is not doubled. Isolated portable stage intentionally has flat review ground. No fitted/flattened desert slab; exact base/host-terrain contact unverified/replaceFootprint=false.',
  ],
};
