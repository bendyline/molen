import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const controls = {
  anchor: [102.63402758, 26.324833519],
  heading: 0.292,
  datum: 913.95816425,
  crestElevation: 988,
  foundation: 718,
  center: [-18, -28],
  crestHalfSpan: 133.2785566171949,
  crestLength: 326.95,
  crestWidth: 12,
  normalPool: 975,
  surfaceBays: [-38, -19, 0, 19, 38],
  lowerBays: [-49, -29.4, -9.8, 9.8, 29.4, 49],
};

const palette = {
  face: { slot: 'wall', graph: 'concrete_boardformed', rgb: [0.58, 0.565, 0.523] },
  liner: { slot: 'trim', graph: 'concrete_plain', rgb: [0.4, 0.398, 0.37] },
  coping: { slot: 'wall', graph: 'concrete_plain', rgb: [0.72, 0.708, 0.657] },
  gate: { slot: 'door', graph: 'metal_painted', rgb: [0.233, 0.332, 0.365] },
  rail: { slot: 'trim', graph: 'metal_painted', rgb: [0.36, 0.379, 0.371] },
  service: { slot: 'roof', graph: 'metal_standing_seam', rgb: [0.35, 0.4, 0.404] },
};
export const damSurfaces = Object.fromEntries(
  Object.entries(palette).map(([name, { rgb, ...surface }]) => [name, surface]),
);

const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const { datum, crestElevation, foundation, center, crestHalfSpan, crestLength } = controls;
const halfArc = crestLength / 2;
const p = (x, y, z) => [x, y - datum, z];
const section = [
  // Elevation, span factor, downstream shift, half thickness.
  [foundation, 0.235, 65, 25.5],
  [778, 0.34, 47, 24],
  [831, 0.46, 28, 19.6],
  [880, 0.6, 14, 15],
  [924, 0.76, 6.5, 11.6],
  [954, 0.88, 1.8, 8.3],
  [crestElevation, 1, 0, controls.crestWidth / 2],
];

function profile(y) {
  const j = section.findIndex((row) => row[0] >= y);
  if (j === 0) return section[0].slice(1);
  const [a, b] = [section[j - 1], section[j]];
  const t = (y - a[0]) / (b[0] - a[0]);
  return a.slice(1).map((v, i) => v + (b[i + 1] - v) * t);
}

export function archPoint(u, y, side = 0) {
  const [scale, shift, halfWidth] = profile(y);
  // The asymmetric end sweeps enter the mapped concrete shoulders.
  const t = u / halfArc;
  const sweep = t < 0 ? 89 : 83;
  const taper = t < 0 ? 0 : 30;
  const z = sweep * t * t + taper * t * t * (1 - t);
  return p(
    center[0] + crestHalfSpan * t * scale,
    y,
    center[1] + shift + z * scale + side * halfWidth,
  );
}

function panel(out, material, points, facing, shade = 1) {
  let normal = normalFor(...points);
  if (normal.reduce((dot, v, i) => dot + v * facing[i], 0) < 0) {
    points = points.toReversed();
    normal = normalFor(...points);
  }
  out.addQuad(
    material,
    'palette:#ffffff',
    points,
    normal,
    undefined,
    palette[material].rgb.map((v) => v * shade),
  );
}

const bar = (out, m, a, b, w, h) => beam(out, m, a, b, w, h, palette[m].rgb);
const bays = [
  ...controls.surfaceBays.map((center) => ({ center, width: 13, sill: 961, lintel: 980 })),
  ...controls.lowerBays.map((center) => ({ center, width: 11, sill: 914, lintel: 926 })),
];

function arch(out, tier) {
  const openings = tier === 0 ? bays.slice(0, controls.surfaceBays.length) : bays;
  const cuts = openings.flatMap((b) => [b.center - b.width / 2, b.center + b.width / 2]);
  const count = [9, 13, 21, 27, 35][tier];
  const u = [
    ...new Set([
      ...cuts,
      ...Array.from({ length: count + 1 }, (_, i) =>
        i === count ? halfArc : -halfArc + (i * crestLength) / count,
      ),
    ]),
  ].sort((a, b) => a - b);
  const y = [
    ...new Set([...section.map((row) => row[0]), ...openings.flatMap((b) => [b.sill, b.lintel])]),
  ].sort((a, b) => a - b);
  for (let i = 1; i < u.length; i++) {
    const [a, b] = [u[i - 1], u[i]];
    const mid = (a + b) / 2;
    for (let j = 1; j < y.length; j++) {
      const [bottom, top] = [y[j - 1], y[j]];
      const opening = openings.find(
        (s) =>
          bottom >= s.sill &&
          top <= s.lintel &&
          mid > s.center - s.width / 2 &&
          mid < s.center + s.width / 2,
      );
      for (const side of [-1, 1]) {
        const depth = side === 1 && opening ? 0.18 : side;
        const at = (x, h) => archPoint(x, h, depth);
        const tone = 1 + 0.02 * Math.cos(mid / 8) - (top <= 880 ? 0.09 : 0);
        panel(
          out,
          opening && side === 1 ? 'gate' : 'face',
          [at(a, bottom), at(b, bottom), at(b, top), at(a, top)],
          [0, 0, side],
          tone,
        );
      }
      if (opening) {
        for (const [h, facing] of [
          [bottom, 1],
          [top, -1],
        ]) {
          panel(
            out,
            'liner',
            [archPoint(a, h, 0.18), archPoint(b, h, 0.18), archPoint(b, h, 1), archPoint(a, h, 1)],
            [0, facing, 0],
          );
        }
      }
    }
    panel(
      out,
      'coping',
      [
        archPoint(a, crestElevation, -1),
        archPoint(b, crestElevation, -1),
        archPoint(b, crestElevation, 1),
        archPoint(a, crestElevation, 1),
      ],
      [0, 1, 0],
    );
  }
  for (const end of [-halfArc, halfArc])
    for (let j = 1; j < y.length; j++) {
      const [a, b] = [y[j - 1], y[j]];
      panel(
        out,
        'face',
        [archPoint(end, a, -1), archPoint(end, a, 1), archPoint(end, b, 1), archPoint(end, b, -1)],
        [Math.sign(end), 0, 0],
      );
    }
  for (const bay of openings) {
    for (const side of [-1, 1]) {
      const x = bay.center + (side * bay.width) / 2;
      for (let j = 1; j < y.length; j++) {
        const [lo, hi] = [y[j - 1], y[j]];
        if (lo < bay.sill || hi > bay.lintel) continue;
        panel(
          out,
          'liner',
          [
            archPoint(x, lo, 0.18),
            archPoint(x, lo, 1),
            archPoint(x, hi, 1),
            archPoint(x, hi, 0.18),
          ],
          [-side, 0, 0],
        );
      }
    }
  }
}

function crest(out, tier) {
  const crestAt = (u, side, h) =>
    archPoint(u, crestElevation, side).map((v, i) => (i === 1 ? v + h : v));
  const spacing = [19, 12, 7.5, 4.5, 3.75][tier];
  const steps = Math.ceil(crestLength / spacing);
  for (const side of [-1, 1])
    for (let i = 1; tier > 0 && i <= steps; i++) {
      const a = -halfArc + (crestLength * (i - 1)) / steps;
      const b = -halfArc + (crestLength * i) / steps;
      bar(out, 'coping', crestAt(a, side * 0.95, 0.26), crestAt(b, side * 0.95, 0.26), 0.4, 0.52);
      bar(out, 'rail', crestAt(a, side * 0.95, 1.09), crestAt(b, side * 0.95, 1.09), 0.084, 0.083);
      if (tier < 2) continue;
      bar(out, 'rail', crestAt(a, side * 0.95, 0.47), crestAt(a, side * 0.95, 1.08), 0.09, 0.09);
    }
  for (const u of controls.surfaceBays) {
    for (const side of [-1, 1]) {
      const a = crestAt(u + side * 6.8, 0.74, 0.02);
      const b = crestAt(u + side * 6.8, 0.74, 3.6);
      bar(out, 'coping', a, b, 1.7, 1.35);
    }
    bar(out, 'service', crestAt(u - 7, 0.74, 3.8), crestAt(u + 7, 0.74, 3.8), 2.15, 0.46);
    if (tier > 1)
      bar(out, 'gate', crestAt(u - 3.2, 0.74, 3.25), crestAt(u + 3.2, 0.74, 3.25), 1.4, 0.71);
  }
}

export function buildDamLevel(out, name) {
  const tier = tiers[name];
  if (tier === undefined) throw Error('Unknown Wudongde model tier: ' + name);
  arch(out, tier);
  crest(out, tier);
}
export const buildDamSkyline = (out) => buildDamLevel(out, 'skyline');
export const buildDamDistrict = (out) => buildDamLevel(out, 'district');
export const buildDamStreet = (out) => buildDamLevel(out, 'street');
export const buildDamCloseup = (out) => buildDamLevel(out, 'closeup');
