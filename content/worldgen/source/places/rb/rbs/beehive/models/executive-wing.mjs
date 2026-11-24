import {
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  facade,
  fbox,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  structure: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.94 },
  podium: { slot: 'foundation', graph: 'stone_granite', roughness: 0.93 },
  roof: { slot: 'roof', graph: 'metal_copper', roughness: 0.87 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.78 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.43 },
};
const white = rgb('cac5b6'),
  limestone = rgb('a9a797'),
  pale = rgb('d2cdc0');
const concrete = rgb('b4b09f'),
  dark = rgb('5a625f'),
  metal = rgb('6b6b5f');
const glass = rgb('526875'),
  copper = rgb('948e77'),
  shade = rgb('706a59');
const peak = site.rings.at(-1);
const tau = Math.PI * 2;
const split = (detail) => [12, 26, 56, 84][detail];
const center0 = site.rings[0].center;
const ground = site.foundationBottom;

function circular(out, slot, center, profile, detail, color, cap = true) {
  const n = split(detail);
  loft(
    out,
    slot,
    profile.map(([y, r]) => radialRing(y, r, r, n, center, 0.019)),
    color,
    { cap },
  );
}
function face(out, slot, f, a, b, y0, y1, color) {
  const p = f.P;
  quad4(out, slot, p(a, y0), p(b, y0), p(b, y1), p(a, y1), color);
}
function base(out, detail) {
  for (const [outline, height, pane] of [
    [site.podium, 2.1, false],
    [site.connector, 5.06, true],
    [site.connectorCore, 7.85, true],
  ]) {
    const ring = outwardRing(outline);
    for (const [i, a] of ring.entries()) {
      const f = wallFace(a, ring[(i + 1) % ring.length]);
      if (f.length < 0.015) continue;
      if (pane) {
        face(out, 'glass', f, 0, f.length, 0.18, height - 0.24, glass);
        face(out, 'trim', f, 0, f.length, height - 0.26, height, white);
        if (detail > 0) {
          const n = Math.max(1, Math.round(f.length / 2.8));
          for (let i = 0; i < n; i++) {
            const u = (i * f.length) / n;
            fbox(
              out,
              'trim',
              f,
              u - 0.054,
              u + 0.054,
              0.19,
              height - 0.25,
              -0.09,
              0.083,
              trimColor(i),
            );
          }
        }
      } else face(out, 'podium', f, 0, f.length, ground, height, limestone);
    }
    cap(out, pane ? 'trim' : 'podium', outline, height, pane ? white : limestone);
  }
}

const trimColor = (i) => (i % 3 === 0 ? concrete : white);
function taperedPost(out, center, angle, bottom, top) {
  const ring = (h, r, w, d) => {
    const ca = Math.cos(angle),
      sa = Math.sin(angle);
    return [
      [-d, -w],
      [-d, w],
      [d, w],
      [d, -w],
    ].map(([x, z]) => [center[0] + (r + x) * ca - z * sa, h, center[1] + (r + x) * sa + z * ca]);
  };
  loft(
    out,
    'structure',
    [
      ring(bottom, 25.26, 0.43, 0.66),
      ring(top - 0.81, 25.38, 0.51, 0.72),
      ring(top, 25.51, 0.63, 0.84),
    ],
    pale,
  );
}

function lobby(out, detail) {
  const { center, radius } = site.rings[0];
  circular(
    out,
    'podium',
    center,
    [
      [ground, radius],
      [0.7, radius],
      [1.12, radius - 0.3],
    ],
    detail,
    limestone,
  );
  circular(
    out,
    'glass',
    center,
    [
      [1.05, radius - 2.15],
      [8.52, radius - 2.15],
      [16.55, radius - 2.64],
    ],
    detail,
    glass,
    false,
  );
  circular(
    out,
    'structure',
    center,
    [
      [16.24, radius - 2.42],
      [17.04, radius + 0.14],
      [17.91, radius + 0.14],
      [18.39, radius - 0.34],
    ],
    detail,
    concrete,
  );
  if (detail > 0) {
    circular(
      out,
      'trim',
      center,
      [
        [7.9, radius - 2.14],
        [8.1, radius - 2.11],
      ],
      detail,
      dark,
      false,
    );
    const n = [0, 18, 24, 28][detail];
    for (let i = 0; i < n; i++) {
      const theta = (i * tau) / n + 0.023;
      taperedPost(out, center, theta, 1.16, 16.8);
      if (detail > 1) {
        const ca = Math.cos(theta),
          sa = Math.sin(theta),
          p = [center[0] + (radius - 2.12) * ca, center[1] + (radius - 2.12) * sa];
        const f = facade(p, [sa, -ca]);
        fbox(out, 'trim', f, -0.73, 0.73, 5.76, 5.94, -0.25, 0.08, metal);
      }
    }
  }
  const { center: position, normal, floor } = site.entry;
  const f = facade(position, [normal[1], -normal[0]]);
  fbox(out, 'podium', f, -4.45, 4.45, ground, floor, -1.15, 3.04, limestone);
  fbox(out, 'glass', f, -3.95, 3.95, floor, 4.86, -0.066, 0.27, glass);
  fbox(out, 'trim', f, -4.35, 4.35, 4.78, 5.31, -1.07, 3.53, dark, true);
  for (const x of [-3.85, 0, 3.85])
    fbox(out, 'trim', f, x - 0.069, x + 0.069, floor, 4.78, 0.31, 0.49, dark);
}

function verticalFin(out, center, theta, y, bottomRadius, topRadius, detail) {
  const ca = Math.cos(theta),
    sa = Math.sin(theta);
  const P = (r, h, u) => [center[0] + ca * r - sa * u, h, center[1] + sa * r + ca * u];
  const lower = y - 5.12,
    upper = y - 0.25;
  if (detail < 2) {
    quad4(
      out,
      'structure',
      P(bottomRadius + 0.11, lower, -0.11),
      P(bottomRadius + 0.11, lower, 0.11),
      P(topRadius + 1.02, upper, 0.24),
      P(topRadius + 1.02, upper, -0.24),
      pale,
    );
    return;
  }
  const profile = [
    [lower, bottomRadius, 0.11, 0.17],
    [upper, topRadius + 0.24, 0.19, 1.1],
  ];
  loft(
    out,
    'structure',
    profile.map(([y, r, w, d]) => [
      P(r - d * 0.48, y, -w),
      P(r - d * 0.48, y, w),
      P(r + d * 0.48, y, w),
      P(r + d * 0.48, y, -w),
    ]),
    pale,
  );
}
function floors(out, detail) {
  const steps = [{ center: center0, y: 22.04, radius: 26.59 }, ...site.rings.slice(1, -2)];
  for (const [i, band] of steps.entries()) {
    const { center, radius, y } = band;
    const below = steps[i - 1]?.y ?? 18.25;
    const width = i === 0 ? 0.59 : 1.13;
    const bottomRadius = radius - width * 0.7,
      topRadius = radius - width * 0.9;
    circular(
      out,
      'glass',
      center,
      [
        [below - 0.04, bottomRadius],
        [y - 0.86, topRadius],
      ],
      detail,
      glass,
      false,
    );
    const bandProfile =
      detail === 0
        ? [
            [y - 0.85, radius],
            [y, radius],
          ]
        : [
            [y - 1.05, topRadius],
            [y - 0.55, radius],
            [y - 0.18, radius],
            [y, radius - 0.08],
          ];
    circular(out, 'structure', center, bandProfile, detail, i % 2 === 1 ? white : concrete, false);
    if (detail > 0) {
      const n = [0, 28, 69, 104][detail];
      for (let j = 0; j < n; j++)
        verticalFin(out, center, (j * tau) / n + 0.019, y, bottomRadius, topRadius, detail);
    }
  }
}

function crown(out, detail) {
  const { center, radius } = site.rings.at(-2);
  circular(
    out,
    'glass',
    center,
    [
      [62.83, radius + 0.61],
      [65.64, radius + 0.26],
    ],
    detail,
    glass,
    false,
  );
  circular(
    out,
    'structure',
    center,
    [
      [63.24, radius + 0.28],
      [64.72, radius + 1.88],
      [65.67, radius + 1.74],
      [66.01, radius + 1.15],
    ],
    detail,
    white,
  );
  const profile = [
    [65.93, radius + 0.45],
    [69.96, radius],
    [71.1, peak.radius + 2.44],
    [site.peak, peak.radius],
  ];
  circular(out, 'roof', center, profile, detail, copper);
  if (detail > 0) {
    const n = detail === 3 ? 40 : detail === 2 ? 30 : 22;
    for (let i = 0; i < n; i++) {
      const a = (i * tau) / n;
      const p = (r, y, u) => [
        center[0] + r * Math.cos(a) - u * Math.sin(a),
        y,
        center[1] + r * Math.sin(a) + u * Math.cos(a),
      ];
      const span = 0.14;
      quad4(
        out,
        'roof',
        p(radius + 0.3, 66.22, span),
        p(radius + 1.28, 66.34, span),
        p(radius + 0.18, 71.18, span),
        p(radius - 1.15, 70.51, span),
        i % 2 === 0 ? copper : shade,
      );
      if (detail > 1)
        quad4(
          out,
          'roof',
          p(radius - 1.15, 70.51, -span),
          p(radius + 0.18, 71.18, -span),
          p(radius + 1.28, 66.34, -span),
          p(radius + 0.3, 66.22, -span),
          shade,
        );
    }
  }
}

function build(out, detail) {
  base(out, detail);
  lobby(out, detail);
  floors(out, detail);
  crown(out, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
