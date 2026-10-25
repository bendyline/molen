/** Five-bastion Cape Town fort, its open native yards and the Kat courtyard pediment. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor, sphere } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/k3/k3v/castle_of_good_hope/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const ref = 'palette:#ffffff';
const colors = {
  stone: rgb('a89d85'),
  roof: rgb('a49e89'),
  plaster: rgb('cfb269'),
  trim: rgb('ded9bc'),
  dark: rgb('35483b'),
  metal: rgb('47483e'),
};
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_granite', roughness: 0.98, metallic: 0 },
  roof: { slot: 'roof', graph: 'stone_sandstone', roughness: 0.98, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96, metallic: 0 },
  trim: { slot: 'trim', graph: 'plaster_lime', roughness: 0.95, metallic: 0 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.92, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.87, metallic: 0.15 },
};
const signedArea = (r) =>
  r.reduce((s, p, i) => {
    const q = r[(i + 1) % r.length];
    return s + p[0] * q[1] - q[0] * p[1];
  }, 0) / 2;
function ring(r, outer = true) {
  const q = r.filter(
    (p, i) =>
      Math.hypot(
        p[0] - r[(i + r.length - 1) % r.length][0],
        p[1] - r[(i + r.length - 1) % r.length][1],
      ) > 0.01,
  );
  return signedArea(q) < 0 === outer ? q : [...q].reverse();
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
    starts = rings.slice(1).map((_, i) => rings.slice(0, i + 1).reduce((s, r) => s + r.length, 0));
  const ix = earcut(pts.flat(), starts);
  for (let i = 0; i < ix.length; i += 3)
    tri(
      out,
      slot,
      ix.slice(i, i + 3).map((j) => [pts[j][0], y, pts[j][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function inset(r, distance) {
  return r.map((p, i) => {
    const a = r[(i + r.length - 1) % r.length],
      b = r[(i + 1) % r.length];
    const la = Math.hypot(p[0] - a[0], p[1] - a[1]),
      lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const n = [-(p[1] - a[1]) / la - (b[1] - p[1]) / lb, (p[0] - a[0]) / la + (b[0] - p[0]) / lb];
    const len = Math.hypot(...n) || 1;
    return [p[0] - (distance * n[0]) / len, p[1] - (distance * n[1]) / len];
  });
}
function frameAt(center, u) {
  const n = [-u[1], u[0]];
  return (x, y, z = 0) => [center[0] + u[0] * x + n[0] * z, y, center[1] + u[1] * x + n[1] * z];
}
function facade(out, a, b, h, d) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [-u[1], 0, u[0]],
    p = frameAt(a, u);
  const boundary = [
      [0, -0.4],
      [len, -0.4],
      [len, h],
      [0, h],
    ],
    holes = [];
  if (d > 0 && len > 5) {
    const count = Math.max(1, Math.floor(len / (d === 1 ? 13 : 5.1))),
      levels = d === 1 ? [4.9] : [1.15, 4.85];
    for (const y of levels)
      for (let i = 0; i < count; i++) {
        const x = (len * (i + 0.5)) / count,
          w = 0.95;
        holes.push([
          [x - w / 2, y],
          [x + w / 2, y],
          [x + w / 2, y + 1.55],
          [x - w / 2, y + 1.55],
        ]);
      }
  }
  const rings = [boundary, ...holes],
    pts = rings.flat(),
    starts = holes.map((_, i) => 4 + i * 4),
    ix = earcut(pts.flat(), starts);
  for (let i = 0; i < ix.length; i += 3)
    tri(
      out,
      'plaster',
      ix.slice(i, i + 3).map((j) => p(...pts[j])),
      n,
    );
  for (const r of holes) {
    capPanel(
      out,
      r.map((q) => p(q[0], q[1], -0.22)),
      'dark',
      n,
    );
    for (let i = 0; i < 4; i++) {
      const a = r[i],
        b = r[(i + 1) % 4],
        ps = [p(...a), p(...b), p(b[0], b[1], -0.22), p(a[0], a[1], -0.22)];
      quad(out, 'trim', ps, normalFor(...ps), colors.trim);
      if (d === 3 || (d === 2 && (i === 0 || i === 2)))
        beam(out, 'trim', p(a[0], a[1], 0.025), p(b[0], b[1], 0.025), 0.13, 0.12, colors.trim);
    }
    if (d === 3) {
      const x = (r[0][0] + r[1][0]) / 2,
        y = r[0][1];
      beam(out, 'trim', p(x, y, -0.14), p(x, y + 1.55, -0.14), 0.045, 0.06, colors.trim);
      beam(
        out,
        'trim',
        p(x - 0.47, y + 0.79, -0.14),
        p(x + 0.47, y + 0.79, -0.14),
        0.045,
        0.06,
        colors.trim,
      );
      for (const side of [-1, 1]) {
        const c = x + side * 0.76;
        capPanel(
          out,
          [
            [c - 0.23, y],
            [c + 0.23, y],
            [c + 0.23, y + 1.55],
            [c - 0.23, y + 1.55],
          ].map((q) => p(...q, 0.055)),
          'dark',
          n,
        );
        for (let k = 1; k < 4; k++)
          beam(
            out,
            'dark',
            p(c - 0.22, y + k * 0.36, 0.075),
            p(c + 0.22, y + k * 0.36, 0.075),
            0.045,
            0.035,
            colors.dark,
          );
      }
    }
  }
  if (d > 0 && (d > 1 || len > 3))
    beam(out, 'trim', p(0, h - 0.1, 0.08), p(len, h - 0.1, 0.08), 0.34, 0.28, colors.trim);
  if (d > 1 && len > 5)
    beam(out, 'trim', p(0, 0.3, 0.07), p(len, 0.3, 0.07), 0.22, 0.2, colors.trim);
}
function capPanel(out, ps, slot, target) {
  const n = normalFor(...ps),
    axis = Math.abs(n[1]) > 0.8 ? 1 : Math.abs(n[0]) > 0.8 ? 0 : 2;
  const flat = ps.flatMap((p) =>
      axis === 1 ? [p[0], p[2]] : axis === 0 ? [p[2], p[1]] : [p[0], p[1]],
    ),
    ix = earcut(flat);
  for (let i = 0; i < ix.length; i += 3)
    tri(
      out,
      slot,
      ix.slice(i, i + 3).map((j) => ps[j]),
      target,
    );
}
function arch(w, spring, bottom, d) {
  const r = [
      [-w / 2, bottom],
      [w / 2, bottom],
      [w / 2, spring],
    ],
    n = [5, 7, 12, 18][d];
  for (let i = 1; i <= n; i++) {
    const a = (i / n) * Math.PI;
    r.push([(Math.cos(a) * w) / 2, spring + (Math.sin(a) * w) / 2]);
  }
  return r;
}
function gate(out, d) {
  const n = [plan.approach[0] - plan.mainEntrance[0], plan.approach[1] - plan.mainEntrance[1]],
    l = Math.hypot(...n),
    u = [n[1] / l, -n[0] / l],
    p = frameAt(plan.approach, u),
    normal = [n[0] / l, 0, n[1] / l];
  const outline = [
      [-4, -0.35],
      [4, -0.35],
      [4, 8.8],
      [-4, 8.8],
    ],
    hole = arch(3.0, 2.5, 0.12, d),
    pts = [...outline, ...hole],
    ix = earcut(pts.flat(), [4]);
  for (let i = 0; i < ix.length; i += 3)
    tri(
      out,
      'plaster',
      ix.slice(i, i + 3).map((j) => p(...pts[j], 0.25)),
      normal,
    );
  capPanel(
    out,
    hole.map((q) => p(...q, 0.05)),
    'dark',
    normal,
  );
  for (let i = 0; i < hole.length; i++)
    if (d > 0)
      beam(
        out,
        'trim',
        p(...hole[i], 0.32),
        p(...hole[(i + 1) % hole.length], 0.32),
        0.3,
        0.25,
        colors.trim,
      );
  for (const x of [-3.8, 3.8])
    beam(out, 'trim', p(x, 0, 0.35), p(x, 8.8, 0.35), 0.45, 0.45, colors.trim);
  beam(out, 'trim', p(-4.2, 8.7, 0.1), p(4.2, 8.7, 0.1), 0.55, 0.85, colors.trim);
  // Four open corner piers preserve the small bell chamber, rather than a solid tower block.
  for (const x of [-1.35, 1.35])
    for (const z of [-1.4, 1.0])
      beam(out, 'plaster', p(x, 8.8, z), p(x, 11.5, z), 0.5, 0.5, colors.plaster);
  if (d > 0) {
    beam(out, 'metal', p(-0.75, 10.85, -0.2), p(0.75, 10.85, -0.2), 0.16, 0.18, colors.metal);
    sphere(
      out,
      'metal',
      p(0, 10.1, -0.2),
      [0.5, 0.64, 0.5],
      colors.metal,
      d === 1 ? 6 : 10,
      d === 1 ? 4 : 6,
    );
  }
  const r = [
    [-1.85, -1.85],
    [1.85, -1.85],
    [1.85, 1.45],
    [-1.85, 1.45],
  ];
  for (let i = 0; i < 4; i++)
    tri(out, 'dark', [
      p(r[i][0], 11.65, r[i][1]),
      p(r[(i + 1) % 4][0], 11.65, r[(i + 1) % 4][1]),
      p(0, 13.1, -0.2),
    ]);
  if (d > 0) beam(out, 'metal', p(0, 13.1, -0.2), p(0, 13.5, -0.2), 0.08, 0.08, colors.metal);
}
function kat(out, d) {
  const u = [-0.846, 0.533],
    p = frameAt([-12.6, -5.5], u),
    normal = [-u[1], 0, u[0]];
  // The curved crown rises above the native central cross-wing, facing the first courtyard.
  const profile = [
    [-5.3, 8.15],
    [-5.3, 8.65],
    [-3.4, 8.65],
  ];
  const steps = [4, 6, 12, 20][d];
  for (let i = 0; i <= steps; i++) {
    const x = -3.4 + (6.8 * i) / steps;
    profile.push([x, 9.0 + 2.15 * Math.cos(((x / 3.4) * Math.PI) / 2)]);
  }
  profile.push([3.4, 8.65], [5.3, 8.65], [5.3, 8.15]);
  capPanel(
    out,
    profile.map((q) => p(...q, 0.2)),
    'plaster',
    normal,
  );
  capPanel(
    out,
    profile.map((q) => p(...q, -0.24)),
    'plaster',
    normal.map((v) => -v),
  );
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i],
      b = profile[(i + 1) % profile.length],
      ps = [p(...a, -0.24), p(...b, -0.24), p(...b, 0.2), p(...a, 0.2)];
    quad(out, 'plaster', ps, normalFor(...ps), colors.plaster);
    if (d > 0) beam(out, 'trim', p(...a, 0.25), p(...b, 0.25), 0.13, 0.15, colors.trim);
  }
  if (d === 0) return;
  beam(out, 'trim', p(-5.7, 8.14, 0.25), p(5.7, 8.14, 0.25), 0.32, 0.65, colors.trim);
  // White shield, flags, drums and seated allegorical reliefs; no invented lettering.
  const shield = [
    [-0.65, 8.65],
    [0.65, 8.65],
    [0.6, 9.65],
    [0, 10.05],
    [-0.6, 9.65],
  ];
  capPanel(
    out,
    shield.map((q) => p(...q, 0.4)),
    'trim',
    normal,
  );
  if (d > 1) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const x = side * (1.0 + i * 0.65),
          y = 9.4 + i * 0.13;
        beam(out, 'trim', p(side * 0.3, 8.6, 0.36), p(x, y + 0.75, 0.36), 0.075, 0.09, colors.trim);
        capPanel(
          out,
          [
            [x, y + 0.62],
            [x + side * 0.52, y + 0.26],
            [x + side * 0.13, y - 0.2],
          ].map((q) => p(...q, 0.4)),
          'trim',
          normal,
        );
      }
      sphere(out, 'trim', p(side * 1.1, 8.5, 0.52), [0.8, 0.28, 0.28], colors.trim, 10, 5);
      const x = side * 4.3;
      sphere(out, 'trim', p(x, 9.25, 0.38), [0.38, 0.63, 0.28], colors.trim, 10, 6);
      sphere(out, 'trim', p(x, 10.12, 0.4), [0.25, 0.32, 0.24], colors.trim, 10, 6);
      beam(out, 'trim', p(x, 8.8, 0.4), p(x + side * 0.45, 8.48, 0.66), 0.28, 0.25, colors.trim);
      beam(
        out,
        'trim',
        p(x + side * 0.45, 8.48, 0.66),
        p(x + side * 0.75, 8.18, 0.82),
        0.21,
        0.2,
        colors.trim,
      );
      beam(out, 'trim', p(x, 9.45, 0.4), p(x + side * 0.85, 9.18, 0.54), 0.17, 0.16, colors.trim);
      beam(
        out,
        'trim',
        p(x + side * 0.85, 9.18, 0.54),
        p(x + side * 1.1, 9.45, 0.54),
        0.13,
        0.13,
        colors.trim,
      );
      if (d === 3) {
        const staff = x + side * 1.1;
        beam(out, 'trim', p(staff, 8.4, 0.55), p(staff, 10.25, 0.55), 0.055, 0.055, colors.trim);
        for (const off of [-0.18, 0.18])
          beam(
            out,
            'trim',
            p(staff, 9.98, 0.55),
            p(staff + off, 10.3, 0.55),
            0.045,
            0.045,
            colors.trim,
          );
      }
    }
    // Balcony slab and short physical balustrade on the mapped curved courtyard projection.
    beam(out, 'trim', p(-3.6, 4.25, 1.65), p(3.6, 4.25, 1.65), 0.4, 1.6, colors.trim);
    beam(out, 'trim', p(-3.6, 5.25, 2.2), p(3.6, 5.25, 2.2), 0.14, 0.18, colors.trim);
    const count = d === 2 ? 8 : 16;
    for (let i = 0; i <= count; i++)
      beam(
        out,
        'trim',
        p(-3.6 + (7.2 * i) / count, 4.4, 2.2),
        p(-3.6 + (7.2 * i) / count, 5.18, 2.2),
        0.09,
        0.09,
        colors.trim,
      );
  }
}
function build(out, _frame, d = 3) {
  const outer = ring(plan.components[0].outline),
    top = inset(outer, 0.55),
    holes = plan.components.filter((v) => v.role === 'inner').map((v) => ring(v.outline, false));
  cap(out, [top, ...holes], 8, 'roof');
  cap(out, [outer, ...holes], -0.4, 'stone', false);
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length,
      ps = [
        [outer[i][0], -0.4, outer[i][1]],
        [outer[j][0], -0.4, outer[j][1]],
        [top[j][0], 8, top[j][1]],
        [top[i][0], 8, top[i][1]],
      ];
    quad(out, 'stone', ps, normalFor(...ps), colors.stone);
    if (d > 0)
      beam(
        out,
        'stone',
        [top[i][0], 8.1, top[i][1]],
        [top[j][0], 8.1, top[j][1]],
        0.45,
        0.38,
        colors.stone,
      );
  }
  for (const r of holes)
    for (let i = 0; i < r.length; i++) facade(out, r[i], r[(i + 1) % r.length], 8, d);
  const island = ring(plan.components.find((v) => v.id === 'way/424911893').outline);
  cap(out, [island], 6.8, 'roof');
  cap(out, [island], -0.4, 'stone', false);
  for (let i = 0; i < island.length; i++)
    facade(out, island[i], island[(i + 1) % island.length], 6.8, d);
  gate(out, d);
  kat(out, d);
}
export const castleGoodHopeSkyline = (o, f) => build(o, f, 0);
export const castleGoodHopeDistrict = (o, f) => build(o, f, 1);
export const castleGoodHopeStreet = (o, f) => build(o, f, 2);
export const castleGoodHopeModel = {
  id: 'castle_of_good_hope',
  key: 'castle_of_good_hope',
  recipe: 'structure-castle-of-good-hope.mjs',
  cell: 'k3/k3v',
  title: 'Castle of Good Hope',
  category: 'palace-castle-fort',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete surviving five-point star fort on its original native plan: battered plain stone curtains, five angular bastions and low coping, both large open courtyards and small cross-wing void, the independent island wing, recessed ochre courtyard windows/green shutters, northwest arched gateway/open bell chamber and the curved yellow-and-white Kat courtyard pediment with simplified physical heraldic relief.',
  camera: [-240, 220, -245],
  lookAt: [-5, 3, -3],
  portableGroundY: -0.18,
  mediumFiContext: { scale: 1.35 },
  qaCameras: [
    { name: 'native-star-and-open-courtyards', position: [-140, 240, -160], lookAt: [-6, 0, -2] },
    { name: 'main-entrance-and-bell', position: [-94, 18, -82], lookAt: [-55, 6, -45] },
    { name: 'kat-balcony-and-curved-pediment', position: [-31, 14, -35], lookAt: [-12.6, 8, -5.5] },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Original named castle relation57263 retains its signed whole fort and courtyard geometry. The original approach gate outside the main entrance defines a fixed approximate dry approach datum before terrain sampling.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-castle-of-good-hope.mjs',
    level: 'skyline',
    export: 'castleGoodHopeSkyline',
    errorMeters: 1.2,
    surfaces,
    authoredLevels: {
      district: { export: 'castleGoodHopeDistrict', errorMeters: 0.5, surfaces },
      street: { export: 'castleGoodHopeStreet', errorMeters: 0.18, surfaces },
    },
  },
  limitations: [
    'Original OSM relation57263 and all five named bastion plans control the complete signed star footprint, open courtyard rings, dividing cross-wing and separate island wing. Native bastion8mheight controls the principal wall level; the whole-object13.5mheight is used only as the small gateway/bell maximum. Local wing heights, wall batter, roof/coping thickness and openings are medium-fi estimates, not a measured survey.',
    'The exact published Qualla2006AndrewMassyn public-domain Kat pediment photograph controls its curved yellow crown, white heraldic shield/flags/drums and flanking seated allegorical figures. Its placement is on the central courtyard wing, not the outer entrance. Sculptural anatomy, inscriptions and hidden carving are simplified; no portrait or textual accuracy is claimed.',
    'The exact published Qualla circa1880public-domain original controls plain battered stone curtain typology only. Railway, signals, train, people and the rest of the town are excluded. Gateway/cupola sections, courtyard window/shutter rhythm, local roofs and balcony dimensions are bounded architectural estimates. No disputed atlas image, stylized1689round-fort engraving or non-public-domain photograph is used.',
    'Exterior assembly only; dark recessed portals are closed visual openings, not a traversable interior. Native yards remain genuinely unmeshed voids. Detached city buildings, moat/landscape reconstruction and interiors are excluded. Footings extend.4m below the fixed approach datum; host terrain and yard contact are approximate, with no whole-site platform or source-height fitting.',
  ],
};
