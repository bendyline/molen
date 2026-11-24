import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  extrude,
  facade,
  fbox,
  gableRoof,
  lathe,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  sandstone: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.96 },
  relief: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.93 },
  granite: { slot: 'foundation', graph: 'stone_granite', roughness: 0.99 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.9 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.92 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.63 },
};

const sandstone = rgb('b48d68'),
  honey = rgb('c5a17a'),
  tan = rgb('b99b78'),
  shadow = rgb('91765e');
const iron = rgb('646a67'),
  dark = rgb('51544d'),
  glass = rgb('606f69'),
  granite = rgb('8e897b');
const copper = rgb('91a996'),
  patina = rgb('829588'),
  rim = rgb('9eb3a3');
const eaves = 14.21;
const F = facade(site.frame.origin, site.frame.along);
const faces = (r) => r.map((a, i) => wallFace(a, r[(i + 1) % r.length]));

function at(f, u, d) {
  const [x, , z] = f.P(u, 0, d);
  return [x, z];
}

function panel(out, slot, f, u, U, y, Y, d, color) {
  quad4(out, slot, f.P(u, y, d), f.P(U, y, d), f.P(U, Y, d), f.P(u, Y, d), color);
}

function mass(out, ring, y, Y, slot, color, top = slot, roof = color) {
  extrude(out, slot, ring, y, Y, color, { top: false });
  cap(out, top, ring, Y, roof);
}

function reliefArch(out, f, u, y, w, H, detail) {
  const half = w / 2,
    spring = y + H - half;
  const points = roundArch(half, [3, 4, 6, 10][detail]);
  panel(out, 'glazing', f, u - half, u + half, y, spring, 0.031, dark);
  for (let k = 0; k < points.length - 1; k++) {
    const [a, h] = points[k],
      [b, j] = points[k + 1];
    const A = f.P(u + a, spring, 0.031),
      B = f.P(u + b, spring, 0.031);
    const C = f.P(u + b, spring + j, 0.031),
      D = f.P(u + a, spring + h, 0.031);
    if (k === 0) tri(out, 'glazing', A, B, C, dark);
    else if (k === points.length - 2) tri(out, 'glazing', A, B, D, dark);
    else quad4(out, 'glazing', A, B, C, D, dark);
    const r = 0.08 + half * 0.14;
    quad4(
      out,
      'relief',
      f.P(u + a, spring + h, 0.11),
      f.P(u + b, spring + j, 0.11),
      f.P(u + b * 1.12, spring + j + r, 0.15),
      f.P(u + a * 1.12, spring + h + r, 0.15),
      honey,
    );
  }
  if (detail > 1) {
    panel(out, 'relief', f, u - half - 0.072, u - half, y, spring, 0.13, tan);
    panel(out, 'relief', f, u + half, u + half + 0.072, y, spring, 0.13, tan);
    panel(out, 'relief', f, u - 0.043, u + 0.043, y, spring + half * 0.78, 0.066, honey);
    panel(out, 'relief', f, u - half - 0.11, u + half + 0.11, y - 0.1, y, 0.16, tan);
  }
}

function wallCourse(out, f, y, Y, d, color, detail) {
  if (detail > 1) fbox(out, 'relief', f, 0, f.length, y, Y, -0.018, d, color);
  else panel(out, 'relief', f, 0, f.length, y, Y, d, color);
}

function arcade(out, f, y, Y, detail, podium) {
  const l = f.length;
  if (l < 2) return;
  wallCourse(out, f, Y - 0.39, Y - 0.12, 0.24, honey, detail);
  if (detail === 0) return;
  const count = Math.max(1, Math.round(l / [1, 7.42, 4.65, 4.13][detail]));
  const w = l / count;
  for (let i = 0; i < count; i++) {
    const u = w * (i + 0.5);
    if (podium) {
      const g = Math.min(w * 0.3, 1.61);
      const edge = f.P(u, 0)[2];
      const grade = Math.max(-2.15, Math.min(2.76, -0.019 * edge));
      panel(out, 'glazing', f, u - g, u + g, grade + 0.18, 4.13, 0.036, dark);
      if (detail > 1) panel(out, 'relief', f, u - 0.07, u + 0.07, grade + 0.18, 4.13, 0.082, tan);
      reliefArch(out, f, u, 6.11, Math.min(w * 0.67, 2.62), 4.69, detail);
      if (detail > 1) reliefArch(out, f, u, 11.03, Math.min(w * 0.51, 1.86), 2.42, detail);
      if (detail > 1) {
        const v = u - w * 0.465;
        if (detail === 2) panel(out, 'relief', f, v - 0.1, v + 0.1, 5.91, 13.84, 0.19, honey);
        else fbox(out, 'relief', f, v - 0.1, v + 0.1, 5.91, 13.84, 0, 0.19, honey);
        if (detail > 2) fbox(out, 'relief', f, v - 0.14, v + 0.14, 5.5, 6.1, -0.05, 0.28, tan);
      }
    } else if (Y - y > 2.5) {
      reliefArch(out, f, u, y + 0.23, Math.min(w * 0.43, 1.27), Y - y - 0.58, detail);
    }
  }
}

function outerHall(out, detail) {
  const outer = outwardRing(site.outline);
  extrude(out, 'granite', outer, -9.6, -1.34, granite, { top: false });
  mass(out, outer, -1.34, eaves, 'sandstone', sandstone, 'roof', iron);
  for (const f of faces(outer)) {
    arcade(out, f, 0, eaves, detail, true);
    wallCourse(out, f, 4.48, 4.81, 0.19, honey, detail);
    wallCourse(out, f, 5.46, 5.78, 0.26, tan, detail);
    wallCourse(out, f, 13.55, 13.83, 0.29, honey, detail);
    if (f.length < 8) continue;
    const d = 1.75,
      y = 4.45,
      Y = 5.04;
    quad4(
      out,
      'roof',
      f.P(0.05, y, d),
      f.P(f.length - 0.05, y, d),
      f.P(f.length - 0.05, Y, 0),
      f.P(0.05, Y, 0),
      tan,
    );
    quad4(
      out,
      'roof',
      f.P(f.length - 0.05, y - 0.11, d),
      f.P(0.05, y - 0.11, d),
      f.P(0.05, Y - 0.11, 0),
      f.P(f.length - 0.05, Y - 0.11, 0),
      shadow,
    );
    panel(out, 'relief', f, 0, f.length, y - 0.12, y + 0.016, d, shadow);
  }
  for (const { outline, top } of site.endGroups) {
    const ring = outwardRing(outline);
    mass(out, ring, eaves - 0.015, top, 'sandstone', sandstone, 'roof', iron);
    for (const f of faces(ring)) arcade(out, f, eaves, top, detail, false);
  }
}

function dome(out, center, r, y, Y, n, detail) {
  const h = Y - y;
  const profile =
    detail === 0
      ? [
          [y, r],
          [y + h * 0.53, r * 0.84],
          [Y, r * 0.13],
        ]
      : [
          [y, r],
          [y + h * 0.1, r],
          [y + h * 0.37, r * 0.936],
          [y + h * 0.63, r * 0.78],
          [y + h * 0.84, r * 0.53],
          [Y, r * 0.132],
        ];
  lathe(
    out,
    'copper',
    center,
    profile.map(([h, w]) => [h, w, w]),
    n,
    copper,
  );
  if (detail < 2) return;
  const ribs = detail === 2 ? n / 2 : n;
  for (let i = 0; i < ribs; i++) {
    const a = (i * 2 * Math.PI) / ribs,
      ca = Math.cos(a),
      sn = Math.sin(a);
    const p = ([h, r]) => [center[0] + (r + 0.028) * ca, h, center[1] + (r + 0.028) * sn];
    for (let j = 1; j < profile.length - 1; j++) {
      const A = p(profile[j]),
        B = p(profile[j + 1]);
      const w = detail === 2 ? 0.041 : 0.052;
      quad4(
        out,
        'copper',
        [A[0] + w * sn, A[1], A[2] - w * ca],
        [A[0] - w * sn, A[1], A[2] + w * ca],
        [B[0] - w * sn, B[1], B[2] + w * ca],
        [B[0] + w * sn, B[1], B[2] - w * ca],
        patina,
      );
    }
  }
}

function satellite(out, { center, radius, drumBase, domeBase, top }, detail) {
  const n = [5, 8, 10, 16][detail],
    r = radius * 0.915;
  if (detail < 2) {
    const sides = detail === 0 ? 4 : 6;
    const band = r * 0.91;
    lathe(
      out,
      'sandstone',
      center,
      [
        [drumBase, r, r],
        [domeBase, r, r],
      ],
      sides,
      sandstone,
      { capTop: false },
    );
    const profile = [[domeBase, r, r]];
    if (detail === 1 || drumBase > 16)
      profile.push([domeBase + (top - domeBase) * 0.43, band, band]);
    profile.push([top, r * 0.13, r * 0.13]);
    lathe(out, 'copper', center, profile, sides, copper);
    return;
  }
  lathe(
    out,
    'sandstone',
    center,
    [
      [drumBase, r, r],
      [domeBase, r, r],
    ],
    n,
    sandstone,
  );
  dome(out, center, r * 0.991, domeBase, top - 0.26, n, detail === 2 ? 1 : detail);
  const w = 0.142 + (r - 0.4) * 0.043;
  lathe(
    out,
    'copper',
    center,
    [
      [top - 0.36, w, w],
      [top - 0.12, w * 1.27, w * 1.27],
      [top, w * 0.62, w * 0.62],
    ],
    [5, 6, 7, 8][detail],
    rim,
  );
}

function crown(out, detail) {
  const { center, radius, eaves, top } = site.major,
    [x, z] = center;
  const n = [10, 14, 24, 40][detail],
    r = radius * 0.934;
  const drum = [
    [14.18, r * 0.92],
    [16.83, r * 0.92],
    [17.07, r],
    [21.61, r],
    [22.17, r * 1.035],
    [eaves, r * 1.035],
  ];
  lathe(
    out,
    'sandstone',
    center,
    (detail ? drum : drum.filter((_, i) => i % 2 === 0 || i === drum.length - 1)).map(([y, R]) => [
      y,
      R,
      R,
    ]),
    n,
    sandstone,
  );
  dome(out, center, r, eaves, 31.51, n, detail);
  const lantern = [
    [31.42, 2.02],
    [31.76, 1.91],
    [32.16, 1.51],
    [34.33, 1.51],
    [34.61, 1.86],
    [35.22, 1.24],
    [35.68, 0.28],
    [top, 0.1],
  ];
  lathe(
    out,
    'copper',
    center,
    (detail ? lantern : lantern.filter((_, i) => i % 2 === 0 || i === lantern.length - 1)).map(
      ([y, R]) => [y, R, R],
    ),
    [6, 8, 12, 20][detail],
    rim,
  );
  if (detail === 0) return;
  const ring = outwardRing(
    Array.from({ length: n }, (_, i) => [
      x + r * Math.cos((2 * Math.PI * i) / n),
      z + r * Math.sin((2 * Math.PI * i) / n),
    ]),
  );
  for (const f of faces(ring)) {
    reliefArch(out, f, f.length / 2, 17.46, Math.min(f.length * 0.53, 1.29), 3.91, detail);
    if (detail > 1) panel(out, 'relief', f, 0, 0.081, 17.21, 21.69, 0.1, honey);
  }
  const gallery = outwardRing(
    Array.from({ length: 12 }, (_, i) => [
      x + 1.521 * Math.cos((2 * Math.PI * i) / 12),
      z + 1.521 * Math.sin((2 * Math.PI * i) / 12),
    ]),
  );
  for (const f of faces(gallery)) {
    panel(out, 'glazing', f, 0.21, f.length - 0.21, 32.27, 34.09, 0.05, glass);
  }
}

function skylights(out, detail) {
  const r = site.frame.width;
  for (const [a, b] of [
    [13.9, r * 0.422],
    [r * 0.563, r - 15.08],
  ]) {
    const center = 15.1;
    const [A, B] = [at(F, a, center), at(F, b, center)];
    gableRoof(out, 'glazing', A, B, 6.74, 14.41, 16.85, glass, {
      overhang: 0.17,
      endSlot: 'roof',
      endColor: iron,
    });
    if (detail === 0) continue;
    const rows = Math.ceil((b - a) / (detail === 1 ? 8.16 : 3.02));
    for (let i = 0; i <= rows; i++) {
      const u = a + ((b - a) * i) / rows;
      for (const sign of [-1, 1]) {
        const ridge = F.P(u, 16.919, center),
          lower = F.P(u, 14.53, center + 3.32 * sign);
        beam(out, 'roof', ridge, lower, 0.071, 0.071, iron);
      }
    }
  }
}

function build(out, detail) {
  outerHall(out, detail);
  skylights(out, detail);
  for (const shape of site.satelliteDomes) satellite(out, shape, detail);
  crown(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
