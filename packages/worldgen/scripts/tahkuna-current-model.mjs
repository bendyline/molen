import { sphere } from './authored-structure-mesh.mjs';
import { shell } from './lighthouse-expansion-models.mjs';
import { railRing } from './lighthouse-models.mjs';
import { box, tube } from './structure-mesh.mjs';
/** Current authority height; original detailed platework recipe remains independently rebuildable. */

import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { ring } from './lighthouse-expansion-models.mjs';
import { buildTahkuna } from './lighthouse-final-coastal-models.mjs';
import { lathe, panel, transformed } from './lighthouse-models.mjs';
import { quad } from './structure-mesh.mjs';

export const tahkunaCurrentAssetId = 'molen.worldgen.structure.n0661_tahkuna_lighthouse';
export const tahkunaHeightScale = 45.2 / 42.6;
export function buildTahkunaCurrent(out) {
  const mapped = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((method) => [
      method,
      (slot, ref, points, _normal, uv, color) => {
        const p = points.map(([x, y, z]) => [x, y * tahkunaHeightScale, z]);
        out[method](slot, ref, p, normalFor(...p.slice(0, 3)), uv, color);
      },
    ]),
  );
  buildTahkuna(mapped);
}
export function buildTahkunaSkyline(out) {
  const white = [0.86, 0.86, 0.82],
    red = [0.56, 0.095, 0.055];
  const form = (profile, color, sides = 16) =>
    loft(
      out,
      'wall',
      profile.map(([y, r]) => radialRing(y * tahkunaHeightScale, r, r, sides)),
      color,
    );
  form(
    [
      [0, 4.65],
      [0.23, 4.65],
      [0.35, 4.475],
      [34.65, 2],
      [34.95, 2.18],
      [35.3, 2.63],
      [35.53, 2.83],
      [35.72, 2.83],
    ],
    white,
  );
  form(
    [
      [35.7, 1.95],
      [37.45, 1.95],
      [37.6, 2.05],
    ],
    white,
  );
  form(
    [
      [37.6, 1.91],
      [40.42, 1.91],
    ],
    [0.23, 0.31, 0.16],
  );
  form(
    [
      [40.43, 2.05],
      [40.55, 2.05],
    ],
    white,
  );
  form(
    [
      [40.55, 2.05],
      [41.05, 1.9],
      [41.6, 1.3],
      [41.87, 0.06],
      [42.05, 0.26],
      [42.3, 0.06],
    ],
    red,
  );
  form(
    [
      [42.3, 0.04],
      [42.6, 0.04],
    ],
    [0.065, 0.075, 0.074],
    4,
  );
}

/** District retains plate courses, window ranks and galleries; fine vertical battens use close levels. */
export function buildTahkunaDistrict(out) {
  const white = [0.86, 0.86, 0.82],
    red = [0.56, 0.095, 0.055],
    dark = [0.23, 0.31, 0.16],
    k = tahkunaHeightScale;
  const form = (profile, slot, color, n = 24) =>
    lathe(
      out,
      slot,
      profile.map(([y, r]) => [y * k, r]),
      color,
      n,
    );
  form(
    [
      [0, 4.65],
      [0.23, 4.65],
      [0.35, 4.475],
    ],
    'concrete',
    white,
  );
  form(
    [
      [0.35, 4.475],
      [34.65, 2],
    ],
    'metal',
    white,
  );
  form(
    [
      [34.65, 2],
      [35.3, 2.63],
      [35.53, 2.83],
      [35.72, 2.83],
      [35.7, 1.95],
      [37.45, 1.95],
    ],
    'metal',
    white,
  );
  const r = (y) => 4.475 - ((y - 0.35) * 2.475) / 34.3;
  for (let j = 0; j <= 16; j++) {
    const y = 0.35 + (j * 34.3) / 16;
    // District shows only the exposed course face; its embedded inner faces are omitted.
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12,
        b = ((i + 1) * Math.PI) / 12;
      const p = (h, t) => [Math.sin(t) * (r(h) + 0.04), h * k, Math.cos(t) * (r(h) + 0.04)];
      const points = [p(y, a), p(y, b), p(y + 0.045, b), p(y + 0.045, a)];
      quad(out, 'metal', points, normalFor(...points.slice(0, 3)), [0.74, 0.75, 0.71]);
    }
  }
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
    for (let j = 0; j < 7; j++) {
      const y = 4.35 + j * 4.54,
        z = r(y + 0.39) + 0.035,
        o = transformed(out, angle);
      panel(o, 'glass', -0.255, 0.255, y * k, (y + 0.78) * k, z, [0.08, 0.13, 0.14]);
      for (const [a, b] of [
        [
          [-0.34, (y + 0.84) * k, z],
          [0, (y + 1.12) * k, z],
        ],
        [
          [0, (y + 1.12) * k, z],
          [0.34, (y + 0.84) * k, z],
        ],
      ])
        beam(o, 'metal', a, b, 0.07, 0.11, white);
    }
  panel(out, 'wood', -0.55, 0.55, 0.35 * k, 2.63 * k, 4.47, [0.25, 0.18, 0.115]);
  form(
    [
      [37.43, 2.22],
      [37.6, 2.22],
    ],
    'metal',
    white,
  );
  form(
    [
      [37.6, 1.91],
      [40.42, 1.91],
    ],
    'glass',
    dark,
  );
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8,
      p = (r, y) => [Math.sin(a) * r, y * k, Math.cos(a) * r];
    beam(out, 'metal', p(2.71, 35.72), p(2.71, 36.71), 0.045, 0.045, white);
    beam(out, 'metal', p(2.08, 37.59), p(2.08, 40.52), 0.042, 0.042, white);
  }
  for (const [y, r] of [
    [36.71, 2.71],
    [38.5, 2.08],
    [40.49, 2.08],
  ])
    ring(out, 'metal', y * k, r - 0.02, r + 0.02, 0.04 * k, white, 16);
  form(
    [
      [40.43, 2.05],
      [40.55, 2.05],
    ],
    'metal',
    white,
  );
  form(
    [
      [40.55, 2.05],
      [41.05, 1.9],
      [41.6, 1.3],
      [41.87, 0.06],
      [42.05, 0.26],
      [42.3, 0.06],
    ],
    'metal',
    red,
  );
  form(
    [
      [42.3, 0.04],
      [42.6, 0.04],
    ],
    'metal',
    [0.065, 0.075, 0.074],
    4,
  );
}

const white = [0.86, 0.86, 0.82],
  black = [0.065, 0.075, 0.074],
  red = [0.56, 0.095, 0.055];
const polar = (r, y, a) => [Math.sin(a) * r, y, Math.cos(a) * r];
function glazing(out, y0, y1, r, color = white, n = 16) {
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n,
      ps = [polar(r, y0, a), polar(r, y0, b), polar(r, y1, b), polar(r, y1, a)];
    quad(out, 'glass', ps, normalFor(...ps.slice(0, 3)), [0.23, 0.31, 0.16]);
    tube(out, 'metal', ps[0], ps[3], 0.027, color, 4);
  }
  for (const y of [y0, y0 + (y1 - y0) * 0.16, y0 + (y1 - y0) * 0.67, y1])
    ring(out, 'metal', y, r - 0.033, r + 0.033, 0.046, color, 16);
}
function dome(out, y, r, h, color) {
  const profile = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 2 / 8;
    return [y + h * Math.sin(a), r * Math.cos(a)];
  });
  profile.push([y + h, r * 0.03]);
  lathe(out, 'metal', profile, color, 16);
  for (let k = 0; k < 16; k++)
    for (let i = 1; i < profile.length; i++)
      tube(
        out,
        'metal',
        polar(profile[i - 1][1] + 0.015, profile[i - 1][0], (k * Math.PI) / 8),
        polar(profile[i][1] + 0.015, profile[i][0], (k * Math.PI) / 8),
        0.022,
        color,
        4,
      );
}
function pediment(out, x, y, w, h, z, color = white) {
  for (const [a, b] of [
    [
      [x - w * 0.66, y + h + 0.06, z],
      [x, y + h + 0.34, z],
    ],
    [
      [x, y + h + 0.34, z],
      [x + w * 0.66, y + h + 0.06, z],
    ],
  ])
    beam(out, 'metal', a, b, 0.07, 0.11, color);
  beam(
    out,
    'metal',
    [x - w * 0.64, y + h + 0.04, z],
    [x + w * 0.64, y + h + 0.04, z],
    0.06,
    0.09,
    color,
  );
}
function buildTahkunaStreetBase(out) {
  const r = (y) => 4.475 - ((y - 0.35) * 2.475) / 34.3;
  lathe(
    out,
    'concrete',
    [
      [0, 4.65],
      [0.23, 4.65],
      [0.35, 4.475],
    ],
    white,
    16,
  );
  const holes = [];
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
    for (let j = 0; j < 7; j++)
      holes.push({
        angle,
        y: 4.35 + j * 4.54,
        w: 0.51,
        h: 0.78,
        depth: 0.22,
        trimSlot: 'metal',
        trimColor: white,
      });
  holes.push({
    angle: 0,
    y: 0.35,
    w: 1.1,
    h: 2.28,
    depth: 0.25,
    trimSlot: 'metal',
    trimColor: white,
  });
  shell(out, {
    profile: [
      [0.35, 4.475],
      [34.65, 2],
    ],
    holes,
    slot: 'metal',
    color: white,
    segments: 16,
  });
  // Barbier & Fenestre cover battens: sixteen staggered courses with sixteen panels per course.
  for (let j = 0; j <= 16; j++) {
    const y = 0.35 + (j * 34.3) / 16,
      rr = r(y);
    ring(out, 'metal', y, rr - 0.013, rr + 0.04, 0.045, [0.74, 0.75, 0.71], 16);
    if (j === 16) continue;
    const hi = y + 34.3 / 16;
    for (let k = 0; k < 16; k++) {
      const a = ((k + (j % 2) * 0.5) * Math.PI) / 8;
      // Window seams do not run across the actual apertures.
      const breaks = [
        y,
        hi,
        ...holes
          .filter(
            (q) =>
              Math.abs(Math.atan2(Math.sin(a - q.angle), Math.cos(a - q.angle))) < 0.1 &&
              q.y < hi &&
              q.y + q.h > y,
          )
          .flatMap((q) => [Math.max(y, q.y - 0.1), Math.min(hi, q.y + q.h + 0.15)]),
      ].sort((a, b) => a - b);
      for (let b = 1; b < breaks.length; b++) {
        const lo = breaks[b - 1],
          top = breaks[b],
          mid = (lo + top) / 2;
        if (
          top - lo < 0.01 ||
          holes.some(
            (q) =>
              Math.abs(Math.atan2(Math.sin(a - q.angle), Math.cos(a - q.angle))) < 0.1 &&
              mid > q.y - 0.1 &&
              mid < q.y + q.h + 0.15,
          )
        )
          continue;
        beam(
          out,
          'metal',
          polar(r(lo) + 0.02, lo, a),
          polar(r(top) + 0.02, top, a),
          0.045,
          0.035,
          [0.76, 0.77, 0.73],
        );
      }
    }
  }
  for (const hole of holes) {
    const o = transformed(out, hole.angle),
      z = r(hole.y + hole.h * 0.5) + 0.07;
    pediment(o, 0, hole.y, hole.w, hole.h, z);
    if (hole.y > 0.4)
      beam(
        o,
        'metal',
        [-0.25, hole.y + hole.h * 0.6, z - 0.12],
        [0.25, hole.y + hole.h * 0.6, z - 0.12],
        0.035,
        0.04,
        white,
      );
  }
  panel(out, 'wood', -0.49, 0.49, 0.4, 2.54, 4.25, [0.25, 0.18, 0.115]);
  for (let i = 0; i < 2; i++)
    box(
      out,
      'concrete',
      [-0.8, 0, 4.42 + i * 0.16],
      [0.8, 0.16 - i * 0.15, 4.74 + i * 0.16],
      [0.59, 0.59, 0.56],
    );
  lathe(
    out,
    'metal',
    [
      [34.65, 2],
      [34.95, 2.18],
      [35.3, 2.63],
      [35.53, 2.83],
      [35.72, 2.83],
    ],
    white,
    16,
  );
  for (let i = 0; i < 24; i++) {
    const o = transformed(out, (i * Math.PI) / 12);
    beam(o, 'metal', [0, 34.52, 2.03], [0, 35.55, 2.72], 0.105, 0.105, white);
  }
  railRing(out, 35.73, 2.71, 0.98, white, 16);
  lathe(
    out,
    'metal',
    [
      [35.7, 1.95],
      [37.45, 1.95],
    ],
    white,
    16,
  );
  // Raised watchroom plate panels and a gallery access door.
  for (let i = 0; i < 16; i++)
    beam(
      out,
      'metal',
      polar(1.164, 35.72, (i * Math.PI) / 8),
      polar(1.164, 37.42, (i * Math.PI) / 8),
      0.028,
      0.035,
      [0.75, 0.76, 0.72],
    );
  panel(out, 'metal', -0.37, 0.37, 35.75, 37.17, 1.976, [0.72, 0.74, 0.7]);
  ring(out, 'metal', 37.43, 1.88, 2.22, 0.16, white, 16);
  glazing(out, 37.6, 40.42, 1.91, white, 16);
  // The cleaning gallery outside the lantern, with open cage and hoop rails.
  for (let i = 0; i < 16; i++)
    tube(
      out,
      'metal',
      polar(2.08, 37.59, (i * Math.PI) / 8),
      polar(2.08, 40.52, (i * Math.PI) / 8),
      0.021,
      white,
      4,
    );
  for (const y of [37.64, 38.5, 39.51, 40.49])
    ring(out, 'metal', y, 2.054, 2.084, 0.027, white, 16);
  ring(out, 'metal', 40.43, 1.84, 2.05, 0.12, white, 16);
  dome(out, 40.53, 2.05, 1.34, red);
  sphere(out, 'metal', [0, 42.05, 0], [0.26, 0.25, 0.26], red, 16, 6);
  tube(out, 'metal', [0, 42.22, 0], [0, 42.6, 0], 0.025, black, 4);
}

/** Full plate/window topology at reduced radial tessellation. */
export function buildTahkunaStreet(out) {
  const mapped = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((method) => [
      method,
      (slot, ref, points, _normal, uv, color) => {
        const p = points.map(([x, y, z]) => [x, y * tahkunaHeightScale, z]);
        out[method](slot, ref, p, normalFor(...p.slice(0, 3)), uv, color);
      },
    ]),
  );
  buildTahkunaStreetBase(mapped);
}
