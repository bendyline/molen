/** Surviving roofless Toghrol brick shell; native envelope, inner void and20mheight. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/tn/tnk/toghrol_tower/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff';
const colors = {
  brick: rgb('baa681'),
  trim: rgb('c0aa82'),
  shadow: rgb('8d7e60'),
  dark: rgb('41473c'),
  stone: rgb('c4c0ad'),
};
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_longformat', roughness: 0.99, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.98, metallic: 0 },
  shadow: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
  dark: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.98, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.96, metallic: 0 },
};
const outerNative = plan.components.find((c) => c.role === 'outer').outline;
function envelopeRadius(angle) {
  const direction = [Math.cos(angle), Math.sin(angle)];
  let result = plan.outerRadiusMean;
  for (let i = 0; i < outerNative.length; i++) {
    const a = outerNative[i],
      b = outerNative[(i + 1) % outerNative.length],
      v = [b[0] - a[0], b[1] - a[1]],
      cross = direction[0] * v[1] - direction[1] * v[0];
    if (Math.abs(cross) < 1e-8) continue;
    const t = (a[0] * v[1] - a[1] * v[0]) / cross,
      u = (a[0] * direction[1] - a[1] * direction[0]) / cross;
    if (t > 0 && u >= 0 && u <= 1) {
      result = t;
      break;
    }
  }
  return result;
}
function star() {
  return Array.from({ length: plan.buttressCount * 2 }, (_, i) => {
    const a = (-i / (plan.buttressCount * 2)) * Math.PI * 2,
      r = envelopeRadius(a) - (i % 2 ? 1.05 : 0);
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
}
function circle(r, n) {
  return Array.from({ length: n }, (_, i) => {
    const a = (-i / n) * Math.PI * 2;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
}
function tri(out, slot, ps, target = null) {
  if (target && normalFor(...ps).reduce((s, v, i) => s + v * target[i], 0) < 0)
    ps = [ps[0], ps[2], ps[1]];
  out.addTriangle(
    slot,
    ref,
    ps,
    normalFor(...ps),
    ps.map((p) => [p[0], p[2]]),
    colors[slot],
  );
}
function cap(out, rings, y, slot, up = true) {
  const pts = rings.flat(),
    starts = rings.slice(1).map((_, i) => rings.slice(0, i + 1).reduce((s, r) => s + r.length, 0)),
    ix = earcut(pts.flat(), starts);
  for (let i = 0; i < ix.length; i += 3)
    tri(
      out,
      slot,
      ix.slice(i, i + 3).map((j) => [pts[j][0], y, pts[j][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function shell(out, a, b, y0, y1, slot) {
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length,
      ps = [
        [a[i][0], y0, a[i][1]],
        [a[j][0], y0, a[j][1]],
        [b[j][0], y1, b[j][1]],
        [b[i][0], y1, b[i][1]],
      ];
    quad(out, slot, ps, normalFor(...ps), colors[slot]);
  }
}
function frame(a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [-u[1], u[0]];
  return {
    len,
    u,
    n,
    p: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[1] * z],
  };
}
function pointed(x, bottom, w, spring, peak) {
  return [
    [x - w / 2, bottom],
    [x + w / 2, bottom],
    [x + w / 2, spring],
    [x, peak],
    [x - w / 2, spring],
  ];
}
function panel(out, r, holes, f, slot, depth = 0) {
  const pts = [r, ...holes].flat(),
    starts = holes.map((_, i) => r.length + holes.slice(0, i).reduce((s, r) => s + r.length, 0)),
    ix = earcut(pts.flat(), starts);
  for (let i = 0; i < ix.length; i += 3)
    tri(
      out,
      slot,
      ix.slice(i, i + 3).map((j) => f.p(...pts[j], depth)),
      [f.n[0], 0, f.n[1]],
    );
}
function niche(out, r, f, d, depth = -0.2) {
  panel(out, r, [], f, 'shadow', depth);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      ps = [f.p(...a), f.p(...b), f.p(...b, depth), f.p(...a, depth)];
    quad(out, 'brick', ps, normalFor(...ps), colors.brick);
    if (d > 1)
      beam(
        out,
        'trim',
        f.p(a[0], a[1], 0.018),
        f.p(b[0], b[1], 0.018),
        d === 2 ? 0.045 : 0.055,
        0.06,
        colors.trim,
      );
  }
}
function crown(out, r, d) {
  for (let i = 0; i < r.length; i++) {
    const f = frame(r[i], r[(i + 1) % r.length]),
      holes = [];
    if (d > 0 && (d > 1 || i % 2 === 0))
      holes.push(pointed(f.len / 2, 19.08, f.len * 0.78, 19.45, 19.78));
    if (d > 1 && i % 2 === 0) holes.push(pointed(f.len / 2, 18.36, f.len * 0.68, 18.65, 18.97));
    panel(
      out,
      [
        [0, 18.2],
        [f.len, 18.2],
        [f.len, 20],
        [0, 20],
      ],
      holes,
      f,
      'brick',
    );
    for (const h of holes) niche(out, h, f, d);
    if (d > 0)
      for (const y of [18.21, 19.98])
        beam(out, 'trim', f.p(0, y, 0.035), f.p(f.len, y, 0.035), 0.12, 0.14, colors.trim);
  }
}
function portal(out, d) {
  const f = { n: [0, 1], p: (x, y, z = 0) => [x, y, plan.outerRadiusMean + 0.1 + z] },
    profile = [
      [-1.95, -0.35],
      [1.95, -0.35],
      [1.95, 6.35],
      [-1.95, 6.35],
    ],
    hole = pointed(0, 0.18, 2.1, 3.15, 4.75);
  panel(out, profile, [hole], f, 'brick', 0.16);
  panel(out, hole, [], f, 'dark', 0.035);
  // Closed visual entry; the upper hollow chamber/top remains a genuine geometric void.
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i],
      b = profile[(i + 1) % profile.length],
      ps = [f.p(...a, 0.16), f.p(...a, -0.25), f.p(...b, -0.25), f.p(...b, 0.16)];
    quad(out, 'brick', ps, normalFor(...ps), colors.brick);
    if (d > 0) beam(out, 'trim', f.p(...a, 0.21), f.p(...b, 0.21), 0.17, 0.15, colors.trim);
  }
  for (let i = 0; i < hole.length; i++) {
    const a = hole[i],
      b = hole[(i + 1) % hole.length],
      ps = [f.p(...a, 0.17), f.p(...b, 0.17), f.p(...b, 0.035), f.p(...a, 0.035)];
    quad(out, 'trim', ps, normalFor(...ps), colors.trim);
    if (d > 0) beam(out, 'trim', f.p(...a, 0.22), f.p(...b, 0.22), 0.2, 0.18, colors.trim);
  }
  if (d > 1) {
    const r = pointed(0, 0.18, 2.7, 3.25, 5.25);
    for (let i = 1; i < r.length; i++)
      beam(
        out,
        'trim',
        f.p(...r[i], 0.23),
        f.p(...r[(i + 1) % r.length], 0.23),
        0.075,
        0.08,
        colors.trim,
      );
    for (const x of [-1.43, 1.43])
      panel(
        out,
        [
          [x - 0.16, 1.05],
          [x + 0.16, 1.05],
          [x + 0.16, 2.28],
          [x - 0.16, 2.28],
        ],
        [],
        f,
        'stone',
        0.25,
      );
    for (const y of [5.6, 5.85, 6.1])
      beam(out, 'trim', f.p(-1.65, y, 0.2), f.p(1.65, y, 0.2), 0.06, 0.075, colors.trim);
  }
}
function build(out, _frame, d = 3) {
  const outer = star(),
    upper = circle(plan.outerRadiusMean, 48),
    inner = circle(plan.innerRadiusMean, [24, 32, 64, 96][d]);
  shell(out, outer, outer, -0.4, 17.55, 'brick');
  shell(out, outer, upper, 17.55, 18.2, 'brick');
  // Reverse the inner ring so its wall faces into the open chamber.
  const inward = [...inner].reverse();
  shell(out, inward, inward, -0.4, 20, 'brick');
  cap(out, [outer, inward], -0.4, 'brick', false);
  cap(out, [upper, inward], 20, 'brick');
  crown(out, upper, d);
  portal(out, d);
  if (d > 1)
    for (let i = 0; i < outer.length; i += 2) {
      const a = outer[i],
        b = outer[(i + 1) % outer.length];
      beam(out, 'trim', [a[0], 17.5, a[1]], [b[0], 17.5, b[1]], 0.07, 0.08, colors.trim);
    }
}
export const toghrolSkyline = (o, f) => build(o, f, 0);
export const toghrolDistrict = (o, f) => build(o, f, 1);
export const toghrolStreet = (o, f) => build(o, f, 2);
export const toghrolTowerModel = {
  id: 'toghrol_tower',
  key: 'toghrol_tower',
  recipe: 'structure-toghrol-tower.mjs',
  cell: 'tn/tnk',
  title: 'Toghrol Tower',
  category: 'tower-monument',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Surviving20mroofless brick tomb tower at the original named native envelope:24sharp angled buttresses around a thick hollow circular chamber, open top with visible inner wall/annular rim, restrained pointed entry surround and two layered rows of physical pointed niches/corbel edging at the crown. No conjectural dome, lost calligraphy or surrounding garden structures.',
  camera: [29, 22, 34],
  lookAt: [0, 9, 0],
  portableGroundY: -0.18,
  mediumFiContext: { scale: 0.8 },
  qaCameras: [
    { name: 'pointed-entry-and-24-buttresses', position: [17, 10, 25], lookAt: [0, 6, 6] },
    { name: 'open-chamber-and-annular-rim', position: [16, 32, 17], lookAt: [0, 15, 0] },
    { name: 'layered-crown-and-brickwork', position: [13, 24, -12], lookAt: [0, 18, 0] },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Original named ruined brick tower relation8048810defines the actual outer envelope/inner chamber and explicit20mheight. A fixed open southern approach outside that envelope defines approximate groundY0 before terrain sampling; portal facing/phase remains approximate.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-toghrol-tower.mjs',
    level: 'skyline',
    export: 'toghrolSkyline',
    errorMeters: 0.75,
    surfaces,
    authoredLevels: {
      district: { export: 'toghrolDistrict', errorMeters: 0.3, surfaces },
      street: { export: 'toghrolStreet', errorMeters: 0.1, surfaces },
    },
  },
  limitations: [
    'Exact OSM relation8048810/Q3437688, outer way563594145and inner way563594148control the native anchor, outer envelope, hollow chamber and20mheight.24angled buttresses follow the local story and inspected historical plan;19native sampling vertices are not treated as the buttress count. Root depth, phase and portal facing are medium-fi estimates within that envelope.',
    'Exact published Qualla Pesce/METCC0recto and1840CostePD-oldplan/details control persistent fluted shell, thick circular chamber, pointed entry and layered pointed-niche/corbel character. Native inner diameter~10.46m is consistent with the historical10.70mannotation at medium-fi precision. Sources predate later restorations: current crown and portal sections are approximate, not an exact re-creation of lostKufictext, historic erosion or either historical state.',
    'CosteTOUR RESTAUREEconjectural dome/elevation is excluded; the surviving top/chamber is genuinely open. The similarly titled second METfile is an annotated blank verso, not a second architecture photograph, and is excluded. FlandinYezid/Rheyviews, modern attribution/share-alike photographs and supplemental imagery are unused. Brick palette is an authored warm earth tone, not a claimed true-color reading of sepia paper.',
    'Exterior shell only: the pointed portal is a closed dark visual recess; no traversable doorway, tomb/burial furnishings, room interiors, legible historic inscriptions, adjacent graves, garden, earth piles or cultural-center reconstruction. Small marble-like entry plates are blank and approximate. Niche depth/frames, corbel courses and fine rim detail simplify with distance.',
    'Footings extend.4m below a fixed dry point12m south of the native center. Exact local foundation and chamber floor/terrain contact remain approximate; unmodified source terrain is retained without a whole-garden platform or blanket ground opening.',
  ],
};
