import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { transform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { lettering } from '../../../../../../../../packages/worldgen/scripts/stadium-lettering.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const surfaces = {
  paint: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.08 },
  apron: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96 },
  marking: {
    slot: 'trim',
    localRef: 'palette:#ffffff',
    name: 'painted exhibit stripes',
    roughness: 0.96,
  },
};
const pale = [0.85, 0.85, 0.8];
const wing = [0.63, 0.65, 0.64];
const dark = [0.13, 0.15, 0.16];
const blue = [0.092, 0.21, 0.41];
const arkiaBlue = [0.1, 0.33, 0.54];
const orange = [0.68, 0.28, 0.085];
const cohorts = {
  skyline: { facets: 5, undercarriage: false, glazing: 0, marks: false },
  district: { facets: 9, undercarriage: true, glazing: 0, marks: false },
  street: { facets: 14, undercarriage: true, glazing: 13, marks: true },
  closeup: { facets: 20, undercarriage: true, glazing: 23, marks: true },
  master: { facets: 26, undercarriage: true, glazing: 30, marks: true },
};
const flat = (out, material, vertices, color) =>
  out.addConvexPolygon(
    material,
    'palette:#ffffff',
    vertices,
    normalFor(...vertices),
    (p) => [p[0], p[2]],
    color,
  );

// Local +Z points to the nose. Wider upper rings toward the nose form the miniature's upper deck.
const fuselage = [
  [-1.43, 0.032, 0.06, 0.027],
  [-1.28, 0.065, 0.02, 0.061],
  [-1.03, 0.104, 0, 0.105],
  [-0.69, 0.146, 0, 0.148],
  [0.18, 0.148, 0.016, 0.159],
  [0.46, 0.148, 0.055, 0.195],
  [0.91, 0.145, 0.061, 0.192],
  [1.16, 0.107, 0.061, 0.149],
  [1.38, 0.078, 0.042, 0.081],
  [1.48, 0.023, 0.026, 0.029],
];
const bodyY = 0.288;
function airframeRing(z, rx, y, ry, sides, x = 0) {
  return Array.from({ length: sides }, (_, i) => {
    const angle = (i * Math.PI * 2) / sides;
    return [x + rx * Math.cos(angle), y + ry * Math.sin(angle), z];
  });
}
function shell(out, detail) {
  const rings = new Map(
    fuselage.map((row) => [
      row,
      airframeRing(row[0], row[1], bodyY + row[2], row[3], detail.facets),
    ]),
  );
  loft(out, 'paint', [...rings.values()], pale);
  return rings;
}
function thinSurface(out, outline, color, thickness = 0.018) {
  const top = [...outline].reverse();
  loft(out, 'paint', [top.map(([x, y, z]) => [x, y - thickness, z]), top], color);
}
function sweptWings(out, side) {
  const mirror = (outline) =>
    side > 0 ? outline : outline.map(([x, y, z]) => [-x, y, z]).reverse();
  thinSurface(
    out,
    mirror([
      [0.12, 0.261, 0.22],
      [0.12, 0.261, -0.43],
      [1.24, 0.353, -0.77],
      [1.29, 0.367, -0.66],
      [0.64, 0.303, -0.27],
    ]),
    wing,
  );
  thinSurface(
    out,
    mirror([
      [0.048, 0.361, -0.93],
      [0.045, 0.357, -1.35],
      [0.52, 0.414, -1.45],
      [0.57, 0.415, -1.34],
    ]),
    pale,
    0.013,
  );
}
function tail(out, livery) {
  const profile = [
    [0.374, -1.367],
    [0.92, -1.412],
    [0.916, -1.17],
    [0.344, -0.76],
  ];
  const ring = (x) => profile.map(([y, z]) => [x, y, z]);
  loft(out, 'paint', [ring(-0.019), ring(0.019)], livery === 'arkia' ? arkiaBlue : pale);
  for (const side of [-1, 1]) {
    const x = side * 0.0205;
    const patch =
      livery === 'arkia'
        ? [
            [0.737, -1.056],
            [0.754, -1.081],
            [0.714, -1.396],
            [0.692, -1.395],
          ]
        : [
            [0.446, -0.858],
            [0.484, -0.897],
            [0.428, -1.371],
            [0.394, -1.368],
          ];
    const points = patch.map(([y, z]) => [x, y, z]);
    flat(out, 'marking', side > 0 ? points.reverse() : points, livery === 'arkia' ? orange : blue);
    if (livery === 'arkia') {
      const high = [
        [x, 0.843, -1.118],
        [x, 0.86, -1.143],
        [x, 0.826, -1.402],
        [x, 0.805, -1.401],
      ];
      flat(out, 'marking', side > 0 ? high.reverse() : high, orange);
    }
  }
}
function nacelle(out, x, z, radius, detail, livery) {
  const y = 0.204 + Math.abs(x) * 0.049;
  const rounds = [-0.145, -0.117, 0.105, 0.157].map((offset, i) =>
    airframeRing(
      z + offset,
      radius * [0.69, 0.94, 1, 0.88][i],
      y,
      radius * [0.69, 0.94, 1, 0.88][i],
      detail.facets,
      x,
    ),
  );
  const color = livery === 'arkia' ? arkiaBlue : pale;
  if (!detail.undercarriage) {
    loft(out, 'paint', [rounds[0], rounds[2], rounds[3]], color);
    return;
  }
  loft(out, 'paint', rounds, color, { cap: false });
  const lip = airframeRing(z + 0.157, radius * 0.62, y, radius * 0.62, detail.facets, x);
  const intake = airframeRing(z + 0.128, radius * 0.61, y, radius * 0.61, detail.facets, x);
  loft(out, 'paint', [rounds.at(-1), lip], wing, { cap: false });
  loft(out, 'paint', [lip, intake], dark, { cap: false });
  flat(out, 'marking', intake, dark);
  const exhaust = airframeRing(z - 0.148, radius * 0.58, y, radius * 0.58, detail.facets, x);
  loft(out, 'paint', [exhaust, rounds[0]], wing, { cap: false });
  flat(out, 'marking', exhaust.reverse(), dark);
  beam(
    out,
    'paint',
    [x, y + 0.022, z - 0.019],
    [x, 0.25 + 0.084 * (Math.abs(x) - 0.12), z - 0.059],
    0.044,
    0.05,
    wing,
  );
}
function gear(out, detail) {
  for (const [x, z] of [
    [0, 1.04],
    [-0.188, -0.34],
    [0.188, -0.34],
  ]) {
    beam(out, 'paint', [x, 0.041, z], [x, 0.158, z - 0.028], 0.021, 0.021, wing);
    const wheel = (column) =>
      Array.from({ length: detail.facets }, (_, i) => {
        const t = (i * Math.PI * 2) / detail.facets;
        return [column, 0.032 + 0.032 * Math.cos(t), z + 0.032 * Math.sin(t)];
      });
    for (const side of [-1, 1]) {
      const center = x + side * 0.022;
      loft(out, 'paint', [wheel(center - 0.009), wheel(center + 0.009)], dark);
    }
  }
}
function sectionFrame(z) {
  const i = fuselage.findIndex((row) => row[0] > z);
  const a = fuselage[i - 1];
  const b = fuselage[i];
  const t = (z - a[0]) / (b[0] - a[0]);
  return { a, b, t };
}
function outerSection(z, rings) {
  const { a, b, t } = sectionFrame(z);
  const p = rings.get(a),
    q = rings.get(b);
  const blend = (a, b) => [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  // The diagonal of each loft quad creates a second section point between the seam vertices.
  return p.flatMap((point, i) => [blend(point, q[i]), blend(point, q[(i + 1) % p.length])]);
}
function bodyCenter(z) {
  const { a, b, t } = sectionFrame(z);
  return [bodyY + a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
}
function sideMarker(rings, side, y, z, offset = 0.0025) {
  const ring = outerSection(z, rings);
  const intersections = ring.flatMap(([x0, y0], i) => {
    const [x1, y1] = ring[(i + 1) % ring.length];
    if (y0 === y1 || y < Math.min(y0, y1) || y > Math.max(y0, y1)) return [];
    return [x0 + ((x1 - x0) * (y - y0)) / (y1 - y0)];
  });
  const edge = side > 0 ? Math.max(...intersections) : Math.min(...intersections);
  return [edge + side * offset, y, z];
}
function titles(out, rings, side, name) {
  function paint(slot, _ref, vertices, _normal, _uv, color) {
    const points = vertices.map(([x, y, depth]) =>
      sideMarker(rings, side, y, 0.74 - side * x, 0.0038 + depth),
    );
    flat(out, slot, points, color);
  }
  lettering({ addQuad: paint, addConvexPolygon: paint }, name === 'arkia' ? 'ARKIA' : 'EL AL', {
    width: 0.43,
    height: 0.055,
    y: 0.404,
    stroke: 0.007,
    slot: 'marking',
    color: name === 'arkia' ? arkiaBlue : blue,
  });
}
function cockpitGlazing(out, rings) {
  const forward = outerSection(1.314, rings);
  const aft = outerSection(1.264, rings);
  for (let i = 0; i < forward.length; i++) {
    const j = (i + 1) % forward.length;
    // Upper front panes follow the same loft facets as the nose.
    if (Math.min(forward[i][1], forward[j][1]) < 0.377) continue;
    const fend = (k) => [forward[k][0], forward[k][1] + 0.001, 1.3155];
    const aend = (k) => [aft[k][0], aft[k][1] + 0.001, 1.2655];
    flat(out, 'marking', [aend(i), aend(j), fend(j), fend(i)], [0.08, 0.12, 0.15]);
  }
}
function livery(out, detail, name, rings) {
  const accent = name === 'arkia' ? orange : blue;
  const ribbon =
    name === 'arkia'
      ? [
          [-1.23, -0.49, -0.43],
          [-0.69, -0.63, -0.45],
          [0.37, -0.63, -0.45],
          [1.02, -0.58, -0.5],
        ]
      : [
          [-1.26, 0.18, 0.3],
          [-0.7, 0.08, 0.19],
          [-0.23, -0.45, -0.19],
          [0.44, -0.64, -0.31],
          [1.18, -0.61, -0.41],
          [1.37, -0.57, -0.53],
        ];
  for (const side of [-1, 1]) {
    const stamp = (z0, z1, low0, high0, low1, high1, color) => {
      const patch = [
        sideMarker(rings, side, low0, z0),
        sideMarker(rings, side, low1, z1),
        sideMarker(rings, side, high1, z1),
        sideMarker(rings, side, high0, z0),
      ];
      flat(out, 'marking', side > 0 ? patch.reverse() : patch, color);
    };
    // Narrow strips sit above the faceted fuselage and keep the painted stripe continuous.
    for (let i = 1; i < ribbon.length; i++) {
      const a = ribbon[i - 1],
        b = ribbon[i];
      const sections = Math.ceil((b[0] - a[0]) / 0.045);
      const evaluate = (t) => {
        const z = a[0] + (b[0] - a[0]) * t;
        const [center, height] = bodyCenter(z);
        const bands = a.slice(1).map((v, j) => center + (v + (b[j + 1] - v) * t) * height);
        return [z, bands];
      };
      for (let j = 0; j < sections; j++) {
        const [z0, [low0, high0]] = evaluate(j / sections);
        const [z1, [low1, high1]] = evaluate((j + 1) / sections);
        for (let k = 0; k < 3; k++) {
          const lo = k / 3,
            hi = (k + 1) / 3;
          stamp(
            z0,
            z1,
            low0 + (high0 - low0) * lo,
            low0 + (high0 - low0) * hi,
            low1 + (high1 - low1) * lo,
            low1 + (high1 - low1) * hi,
            accent,
          );
        }
      }
    }
    for (let i = 0; i < detail.glazing; i++) {
      const z = -0.97 + (2.21 * (i + 0.5)) / detail.glazing;
      const [center, height] = bodyCenter(z);
      const y = center + 0.09 * height;
      const w = detail.glazing > 15 ? 0.022 : 0.029;
      stamp(
        z - w * 0.5,
        z + w * 0.5,
        y - w * 0.39,
        y + w * 0.39,
        y - w * 0.39,
        y + w * 0.39,
        [0.17, 0.21, 0.22],
      );
    }
    if (detail.glazing > 15) titles(out, rings, side, name);
  }
  cockpitGlazing(out, rings);
}
function miniature(out, detail, x, z, name) {
  const body = transform(out, -Math.PI / 2, [x, 0, z]);
  const rings = shell(body, detail);
  tail(body, name);
  for (const side of [-1, 1]) {
    sweptWings(body, side);
    nacelle(body, side * 0.41, -0.22, 0.063, detail, name);
    nacelle(body, side * 0.75, -0.408, 0.057, detail, name);
  }
  if (detail.undercarriage) gear(body, detail);
  if (detail.marks) livery(body, detail, name, rings);
}

export const apronBounds = [-6.35, -4.46, 6.35, 4.46];
export function buildAirportExhibit(out, tier) {
  const detail = cohorts[tier];
  // Separate deck strips retain the two recessed grooves seen in the archive photos.
  const [west, north, east, south] = apronBounds;
  for (const [back, front] of [
    [north, -1.744],
    [-1.694, 1.491],
    [1.541, south],
  ])
    box(out, 'apron', [west, -0.23, back], [east, 0, front], [0.41, 0.46, 0.48]);
  for (const z of [-1.72, 1.516]) {
    box(out, 'apron', [west, -0.24, z - 0.031], [east, -0.035, z + 0.031], [0.18, 0.19, 0.19]);
    if (detail.marks)
      for (const side of [-1, 1]) {
        const q = z + side * 0.36;
        flat(
          out,
          'marking',
          [
            [west + 0.24, 0.001, q - 0.013],
            [west + 0.24, 0.001, q + 0.013],
            [east - 0.24, 0.001, q + 0.013],
            [east - 0.24, 0.001, q - 0.013],
          ],
          [0.58, 0.56, 0.43],
        );
      }
  }
  miniature(out, detail, 0.88, -1.72, 'elal');
  miniature(out, detail, -0.94, 1.516, 'arkia');
}

export const buildSkyline = (out) => buildAirportExhibit(out, 'skyline');
export const buildDistrict = (out) => buildAirportExhibit(out, 'district');
export const buildStreet = (out) => buildAirportExhibit(out, 'street');
export const buildCloseup = (out) => buildAirportExhibit(out, 'closeup');
