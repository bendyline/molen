/** Compact Jamuna concrete crossing. Retains the original mapped circle and span schedule. */
import './install-deterministic-math.mjs';
import { beam, cross, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { quad, tube } from './structure-mesh.mjs';
const MEANS = {
  iron: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
  steel: [0.818960257808076, 0.8228885700850488, 0.8228885700850488],
  concrete: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
  road: [1, 1, 1],
  marking: [1, 1, 1],
};
const R = 12003.42057124,
  CX = 2.943736527,
  CZ = 11871.608378814 - 1.75,
  SHIFT = -3.0105926,
  END = 2528;
const supports = [-2400, ...Array.from({ length: 48 }, (_, i) => -2335.3125 + i * 99.375), 2400],
  stations = [-END, ...supports, END];
const concrete = [0.69, 0.685, 0.635],
  pale = [0.77, 0.76, 0.7],
  metal = [0.52, 0.55, 0.54],
  road = [0.13, 0.145, 0.145];
const plan = (s, z = 0, y = 0) => {
  const a = (s + SHIFT) / R;
  return [CX + (R - z) * Math.sin(a), y, CZ - (R - z) * Math.cos(a)];
};
const grade = (s) => 22.55 - 10.15 * (Math.abs(s) / END) ** 2;
const deck = (s, z = 0, h = 0) => plan(s, z, grade(s) - 0.025 * Math.abs(z - 1.7) + h);
function depth(s) {
  let i = 0;
  while (i < supports.length - 2 && s > supports[i + 1]) i++;
  const t = (s - supports[i]) / (supports[i + 1] - supports[i]);
  return 3.3 + 2.9 * (2 * t - 1) ** 2;
}
function writer(out, far) {
  const tri = (slot, p, c) => {
    p = p.map((v) => v.map(Math.fround));
    const a = p[1].map((v, i) => v - p[0][i]),
      b = p[2].map((v, i) => v - p[0][i]);
    if (Math.hypot(...cross(a, b)) < 1e-10) return;
    out.addTriangle(
      slot,
      'palette:#ffffff',
      p,
      normalFor(...p),
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      far ? c.map((v, i) => v * (MEANS[slot]?.[i] ?? 1)) : c,
    );
  };
  return {
    addTriangle(s, r, p, n, u, c) {
      tri(s, p, c);
    },
    addQuad(s, r, p, n, u, c) {
      tri(s, p.slice(0, 3), c);
      tri(s, [p[0], p[2], p[3]], c);
    },
    addConvexPolygon(s, r, p, n, u, c) {
      for (let i = 1; i < p.length - 1; i++) tri(s, [p[0], p[i], p[i + 1]], c);
    },
  };
}
function localBox(out, slot, s, z, y, width, deep, height, c, cap = true) {
  loft(
    out,
    slot,
    [y, y + height].map((h) =>
      [
        [-width / 2, -deep / 2],
        [-width / 2, deep / 2],
        [width / 2, deep / 2],
        [width / 2, -deep / 2],
      ].map(([ds, dz]) => plan(s + ds, z + dz, h)),
    ),
    c,
    { cap },
  );
}
function strip(out, slot, a, b, z0, z1, lo, hi, c) {
  loft(
    out,
    slot,
    [a, b].map((s) =>
      [
        [z0, hi],
        [z1, hi],
        [z1, lo],
        [z0, lo],
      ].map(([z, h]) => deck(s, z, h)),
    ),
    c,
    { cap: false },
  );
}
function build(out, tier) {
  const w = writer(out, tier === 0),
    cfg = [
      { steps: 1, ring: 0 },
      { steps: 1, ring: 6 },
      { steps: 2, ring: 6, rail: 200, pipe: 150, wire: 2 },
      { steps: 8, ring: 16, rail: 32, pipe: 50, wire: 8 },
    ][tier];
  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1],
      b = stations[i],
      approach = i === 1 || i === stations.length - 1;
    const profile = (s) =>
      tier === 0
        ? [
            [-9.25, 0],
            [9.25, 0],
            [0, -(approach ? 1.65 : depth(s))],
          ]
        : [
            [-9.25, 0],
            [9.25, 0],
            [9.25, -0.28],
            [5.3, -0.72],
            [3.2, -(approach ? 1.65 : depth(s))],
            [-3.2, -(approach ? 1.65 : depth(s))],
            [-5.3, -0.72],
            [-9.25, -0.28],
          ];
    const n = cfg.steps,
      rings = Array.from({ length: n + 1 }, (_, j) => {
        const s = a + ((b - a) * j) / n;
        return profile(s).map(([z, h]) => deck(s, z, h));
      });
    loft(w, 'concrete', rings, concrete, { cap: false });
    for (let j = 0; tier > 0 && j < n; j++) {
      const s = a + ((b - a) * j) / n,
        e = a + ((b - a) * (j + 1)) / n;
      quad(
        w,
        'road',
        [deck(s, 2, 0.025), deck(s, 8.7, 0.025), deck(e, 8.7, 0.025), deck(e, 2, 0.025)],
        [0, 1, 0],
        road,
      );
      quad(
        w,
        'road',
        [deck(s, -4.8, 0.025), deck(s, 1.1, 0.025), deck(e, 1.1, 0.025), deck(e, -4.8, 0.025)],
        [0, 1, 0],
        road,
      );
      if (tier > 1)
        for (const [z0, z1] of [
          [-9.25, -4.8],
          [1.1, 2],
          [8.7, 9.25],
        ])
          tier === 2
            ? quad(
                w,
                'concrete',
                [deck(s, z0, 0.05), deck(s, z1, 0.05), deck(e, z1, 0.05), deck(e, z0, 0.05)],
                [0, 1, 0],
                pale,
              )
            : strip(w, 'concrete', s, e, z0, z1, 0.03, 0.24, pale);
    }
  }
  for (const s of supports) {
    const top = grade(s) - depth(s) - 0.55,
      base = Math.min(7, top - 2.72);
    if (tier > 0) {
      const ring = (y, rx, rz) =>
        radialRing(y, rx, rz, cfg.ring).map((p) => plan(s + p[0], p[2], p[1]));
      loft(w, 'concrete', [ring(0, 3.7, 5.5), ring(base, 2.5, 3.5)], concrete);
    }
    localBox(
      w,
      'concrete',
      s,
      0,
      tier === 0 ? 0 : base,
      2.5,
      6.4,
      top - (tier === 0 ? 0 : base),
      pale,
      false,
    );
    if (tier > 2) {
      localBox(w, 'concrete', s, 0, top, 2.9, 6.8, 0.2, concrete);
      for (const z of [-2.1, 2.1])
        localBox(w, 'iron', s, z, top + 0.2, 1.4, 1.4, 0.35, [0.16, 0.18, 0.18]);
    }
  }
  for (const side of [-1, 1]) {
    localBox(w, 'concrete', side * END, 0, 0, 2.2, 20, grade(END) - 0.4, concrete, false);
    for (let k = 0; k <= 12; k += tier === 0 ? 6 : tier === 1 ? 3 : 1) {
      const s = side * (-END + k * 10),
        top = grade(s) - 1.67;
      localBox(w, 'concrete', s, 0, 0, 1.3, 14, top, pale, false);
    }
  }
  const poles = [];
  for (let i = 1; i < supports.length - 1; i += 2) {
    const s = supports[i],
      y = grade(s),
      z = -10.3;
    poles.push(s);
    if (tier === 0) {
      const p = [
        plan(s - 0.55, z, y),
        plan(s + 0.55, z, y),
        plan(s + 0.18, z, y + 29),
        plan(s - 0.18, z, y + 29),
      ];
      quad(w, 'iron', p, [0, 0, -1], [0.8, 0.45, 0.2]);
      quad(w, 'iron', [...p].reverse(), [0, 0, 1], [0.8, 0.45, 0.2]);
      continue;
    }
    for (let k = 0; k < (tier === 1 ? 1 : 4); k++)
      localBox(
        w,
        'iron',
        s,
        z,
        y + k * 7.25,
        1.0 - 0.15 * k,
        1.0 - 0.15 * k,
        tier === 1 ? 29 : 7.25,
        k % 2 ? [0.8, 0.19, 0.055] : [0.84, 0.84, 0.78],
      );
    for (const h of [16, 21, 26]) {
      beam(w, 'steel', plan(s, z - 3.8, y + h), plan(s, z + 3.8, y + h), 0.25, 0.28, metal);
      if (tier > 1)
        for (const dz of [-3.8, 3.8])
          tube(
            w,
            'iron',
            plan(s, z + dz, y + h),
            plan(s, z + dz, y + h - 1.7),
            0.14,
            [0.24, 0.29, 0.25],
            4,
          );
    }
  }
  if (tier > 1) {
    for (let i = 1; i < poles.length; i++)
      for (const [h, dz] of tier === 2
        ? [
            [19.3, -3.8],
            [19.3, 3.8],
            [30, 0],
          ]
        : [
            [14.3, -3.8],
            [14.3, 3.8],
            [19.3, -3.8],
            [19.3, 3.8],
            [24.3, -3.8],
            [24.3, 3.8],
            [30, 0],
          ])
        for (let j = 0; j < cfg.wire; j++) {
          const a = poles[i - 1],
            b = poles[i],
            point = (t) => {
              const s = a + (b - a) * t;
              return plan(s, -10.3 + dz, grade(s) + h - 14 * t * (1 - t));
            };
          tube(
            w,
            'iron',
            point(j / cfg.wire),
            point((j + 1) / cfg.wire),
            0.019,
            [0.22, 0.25, 0.25],
            4,
          );
        }
    for (let s = -END; s < END; s += cfg.pipe) {
      const e = Math.min(END, s + cfg.pipe);
      tube(w, 'iron', deck(s, 6.8, -1.25), deck(e, 6.8, -1.25), 0.375, [0.46, 0.48, 0.44], 6);
      beam(w, 'steel', deck(s, 6.1, -0.28), deck(s, 7.5, -1.78), 0.09, 0.09, metal);
    }
    for (const z of [-9.1, 9.1])
      for (let s = -END; s < END; s += cfg.rail) {
        const e = Math.min(END, s + cfg.rail);
        for (const h of [0.4, 1.1])
          beam(w, 'iron', deck(s, z, h), deck(e, z, h), 0.09, 0.09, metal);
        beam(w, 'iron', deck(s, z, 0.2), deck(s, z, 1.15), 0.1, 0.1, metal);
      }
    for (let s = -END + 13; s < END; s += tier === 2 ? 198.75 : 132.5) {
      beam(w, 'steel', deck(s, 1.58, 0.87), deck(s, 1.58, 9.8), 0.15, 0.15, metal);
      for (const dz of [-2.2, 2.2]) {
        beam(w, 'steel', deck(s, 1.58, 9.7), deck(s, 1.58 + dz, 10.2), 0.1, 0.1, metal);
        localBox(w, 'marking', s, 1.58 + dz, grade(s) + 10.05, 0.35, 0.8, 0.15, [0.86, 0.87, 0.8]);
      }
    }
    for (let s = -END; s < END; s += 32)
      for (const z of [-1.7, 5.4]) {
        const e = Math.min(END, s + 6);
        quad(
          w,
          'marking',
          [
            deck(s, z - 0.075, 0.032),
            deck(s, z + 0.075, 0.032),
            deck(e, z + 0.075, 0.032),
            deck(e, z - 0.075, 0.032),
          ],
          [0, 1, 0],
          [0.82, 0.82, 0.75],
        );
      }
  }
}
export const buildJamunaSkyline = (o) => build(o, 0),
  buildJamunaDistrict = (o) => build(o, 1),
  buildJamunaStreet = (o) => build(o, 2),
  buildJamunaCloseup = (o) => build(o, 3);
