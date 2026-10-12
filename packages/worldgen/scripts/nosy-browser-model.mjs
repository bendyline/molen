/** N0662 source-local entry/landing repair and full browser tower; historical buildNosyAlanana is preserved. */
import {
  beam,
  loft,
  normalFor,
  sphere as originalSphere,
  radialRing,
} from './authored-structure-mesh.mjs';
import { ring as originalRing } from './lighthouse-expansion-models.mjs';
import { lathe as originalLathe, panel, piercedFacade, transformed } from './lighthouse-models.mjs';
import { box, tube as originalTube, quad } from './structure-mesh.mjs';

function detail(out, mode) {
  const cap = mode === 'district' ? 12 : mode === 'street' ? 32 : 192,
    archSegments = mode === 'district' ? 4 : mode === 'street' ? 12 : 24,
    pickets = mode === 'district' ? 2 : 5,
    domeSegments = mode === 'district' ? 4 : mode === 'street' ? 8 : 13,
    domeSeams = mode === 'district' ? 0 : mode === 'street' ? 8 : 16;
  const lathe = (o, s, p, c, n) => originalLathe(o, s, p, c, Math.min(n, cap));
  const ring = (o, s, y, ri, ro, h, c, n) => originalRing(o, s, y, ri, ro, h, c, Math.min(n, cap));
  const tube = (o, s, a, b, r, c, n) =>
    mode === 'district' && s === 'wood'
      ? beam(o, s, a, b, r * 2, r * 2, c)
      : originalTube(
          o,
          s,
          a,
          b,
          r,
          c,
          Math.min(n, mode === 'district' ? 4 : mode === 'street' ? 6 : n),
        );
  const sphere = (o, s, p, r, c, n, m) =>
    originalSphere(
      o,
      s,
      p,
      r,
      c,
      Math.min(n, mode === 'district' ? 8 : mode === 'street' ? 12 : n),
      Math.min(m, mode === 'district' ? 4 : mode === 'street' ? 6 : m),
    );
  const white = [0.86, 0.86, 0.82],
    black = [0.065, 0.075, 0.074],
    red = [0.56, 0.095, 0.055];
  const polar = (r, y, a) => [Math.sin(a) * r, y, Math.cos(a) * r];
  function glazing(out, y0, y1, r, color = white, n = 16) {
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n,
        b = ((i + 1) * Math.PI * 2) / n,
        ps = [polar(r, y0, a), polar(r, y0, b), polar(r, y1, b), polar(r, y1, a)];
      quad(out, 'glass', ps, normalFor(...ps.slice(0, 3)), [0.23, 0.31, 0.32]);
      tube(out, 'metal', ps[0], ps[3], 0.027, color, 8);
    }
    for (const y of [y0, y0 + (y1 - y0) * 0.32, y0 + (y1 - y0) * 0.67, y1])
      ring(out, 'metal', y, r - 0.033, r + 0.033, 0.046, color, 96);
  }
  function dome(out, y, r, h, color) {
    const profile = Array.from({ length: domeSegments }, (_, i) => {
      const a = (i * Math.PI) / 2 / domeSegments;
      return [y + h * Math.sin(a), r * Math.cos(a)];
    });
    profile.push([y + h, r * 0.03]);
    lathe(out, 'metal', profile, color, 128);
    for (let k = 0; k < domeSeams; k++)
      for (let i = 1; i < profile.length; i++)
        tube(
          out,
          'metal',
          polar(profile[i - 1][1] + 0.015, profile[i - 1][0], (k * Math.PI * 2) / domeSeams),
          polar(profile[i][1] + 0.015, profile[i][0], (k * Math.PI) / 8),
          0.022,
          color,
          8,
        );
  }

  function archedWindow(out, h, z, wallColor) {
    const radius = h.w / 2,
      cy = h.y + h.h - radius;
    for (let k = 0; k < archSegments; k++) {
      const a = (k * Math.PI) / archSegments,
        b = ((k + 1) * Math.PI) / archSegments,
        p = [h.x + radius * Math.cos(a), cy + radius * Math.sin(a), z],
        q = [h.x + radius * Math.cos(b), cy + radius * Math.sin(b), z];
      quad(
        out,
        'plaster',
        [p, [p[0], h.y + h.h + 0.002, z], [q[0], h.y + h.h + 0.002, z], q],
        [0, 0, 1],
        wallColor,
      );
      tube(out, 'wood', p, q, 0.032, white, 8);
    }
    for (const x of [h.x - radius, h.x + radius])
      beam(out, 'wood', [x, h.y, z], [x, cy, z], 0.055, 0.06, white);
    beam(
      out,
      'wood',
      [h.x, h.y, z - 0.08],
      [h.x, cy + radius - 0.04, z - 0.08],
      0.048,
      0.05,
      white,
    );
    for (const y of [h.y, h.y + h.h * 0.47])
      beam(
        out,
        'wood',
        [h.x - radius, y, z - 0.08],
        [h.x + radius, y, z - 0.08],
        0.052,
        0.06,
        white,
      );
  }
  function buildNosyAlanana(out) {
    const body = [0.67, 0.68, 0.64],
      upper = [0.16, 0.175, 0.165],
      base = [0.4, 0.405, 0.37];
    const apothem = (y) => 3.55 - ((y - 0.8) * 1.73) / 52.1;
    loft(
      out,
      'plaster',
      [
        radialRing(0, 5.1, 5.1, 8, [0, 0], Math.PI / 8),
        radialRing(0.8, 5.1, 5.1, 8, [0, 0], Math.PI / 8),
      ],
      base,
    );
    const windows = [];
    // Ascending stairs illuminate through staggered arched openings on adjacent octagonal faces.
    for (let j = 0; j < 8; j++) {
      windows.push({
        face: j % 2,
        y: 5.2 + j * 5.65,
        w: 0.76,
        h: 1.55,
        x: 0,
        trim: 0,
        depth: 0.31,
      });
      windows.push({
        face: 4 + (j % 2),
        y: 7.9 + j * 5.65,
        w: 0.7,
        h: 1.48,
        x: 0,
        trim: 0,
        depth: 0.31,
      });
    }
    windows.push({ face: 0, x: 0, y: 0.8, w: 1.38, h: 2.22, trim: 0, depth: 0.32, door: true });
    for (let f = 0; f < 8; f++)
      for (const [lo, hi, color] of [
        [0.8, 44.4, body],
        [44.4, 52.9, upper],
      ]) {
        const o = transformed(out, (f * Math.PI) / 4),
          a = apothem(lo);
        const taper = Object.fromEntries(
          ['addQuad', 'addTriangle', 'addConvexPolygon'].map((method) => [
            method,
            (s, ref, p, _n, uv, c) => {
              const ps = p.map(([x, y, z]) => [(x * apothem(y)) / a, y, (z * apothem(y)) / a]);
              o[method](s, ref, ps, normalFor(...ps.slice(0, 3)), uv, c);
            },
          ]),
        );
        const hs = windows.filter((h) => h.face === f && h.y >= lo && h.y + h.h <= hi);
        piercedFacade(taper, {
          half: a * Math.tan(Math.PI / 8),
          z: a,
          y0: lo,
          y1: hi,
          holes: hs,
          slot: 'plaster',
          color,
        });
        for (const h of hs) if (!h.door) archedWindow(taper, h, a + 0.013, color);
      }
    panel(out, 'wood', -0.63, 0.63, 0.82, 2.95, 3.245, [0.26, 0.21, 0.145]);
    for (let x = -0.56; x < 0.63; x += 0.16)
      beam(out, 'wood', [x, 0.86, 3.27], [x, 2.9, 3.27], 0.02, 0.02, [0.32, 0.265, 0.185]);
    box(out, 'concrete', [-1.5, 3.02, 3.33], [1.5, 3.2, 4.57], base);
    // Three broad entrance steps and low side cheeks, visible in the operator's2020 visit photo.
    for (let i = 0; i < 4; i++)
      box(
        out,
        'concrete',
        [-1.57, 0, 4.88 + i * 0.43],
        [1.57, 0.8 - i * 0.2, 5.31 + i * 0.43],
        base,
      );
    for (const x of [-1.7, 1.7])
      box(out, 'concrete', [x - 0.11, 0, 4.88], [x + 0.11, 0.7, 6.6], base);
    // Eight strong gallery consoles and the octagonal concrete balustrade are unlike a steel-ring lighthouse.
    for (let f = 0; f < 8; f++) {
      const o = transformed(out, (f * Math.PI) / 4);
      beam(o, 'plaster', [0, 51.15, 1.92], [0, 53.05, 3.27], 0.3, 0.34, upper);
    }
    loft(
      out,
      'plaster',
      [
        radialRing(52.85, 3.37, 3.37, 8, [0, 0], Math.PI / 8),
        radialRing(53.15, 3.49, 3.49, 8, [0, 0], Math.PI / 8),
      ],
      body,
    );
    box(out, 'concrete', [-1.57, 0, 4.65], [1.57, 0.8, 4.91], base);
    const rr = 3.23;
    for (let f = 0; f < 8; f++) {
      const a = (f * Math.PI) / 4 + Math.PI / 8,
        b = ((f + 1) * Math.PI) / 4 + Math.PI / 8,
        p = polar(rr, 53.16, a),
        q = polar(rr, 53.16, b);
      beam(out, 'plaster', [p[0], 54.12, p[2]], [q[0], 54.12, q[2]], 0.18, 0.18, body);
      beam(out, 'plaster', p, q, 0.17, 0.17, body);
      for (let k = 0; k < pickets; k++) {
        const t = k / pickets,
          x = p[0] + (q[0] - p[0]) * t,
          z = p[2] + (q[2] - p[2]) * t;
        box(out, 'plaster', [x - 0.062, 53.16, z - 0.062], [x + 0.062, 54.13, z + 0.062], body);
      }
    }
    lathe(
      out,
      'plaster',
      [
        [53.14, 1.64],
        [54.53, 1.64],
      ],
      body,
      96,
    );
    ring(out, 'metal', 54.51, 1.58, 1.78, 0.13, black, 96);
    glazing(out, 54.64, 57.48, 1.63, black, 12);
    ring(out, 'metal', 57.45, 1.55, 1.85, 0.15, black, 96);
    dome(out, 57.59, 1.85, 1.24, black);
    lathe(
      out,
      'metal',
      [
        [58.82, 0.22],
        [59.02, 0.22],
      ],
      black,
      48,
    );
    sphere(out, 'metal', [0, 59.08, 0], [0.19, 0.18, 0.19], black, 24, 12);
    tube(out, 'metal', [0, 59.2, 0], [0, 60, 0], 0.025, black, 8);
    for (const y of [59.44, 59.68])
      beam(out, 'metal', [-0.2, y, 0], [0.2, y, 0], 0.024, 0.024, black);
  }

  buildNosyAlanana(out);
}
export function buildNosyReviewed(out) {
  detail(out, 'master');
}
export function buildNosyDistrict(out) {
  detail(out, 'district');
}
export function buildNosyStreet(out) {
  detail(out, 'street');
}
export function buildNosyCloseup(out) {
  detail(out, 'master');
}
const means = {
  plaster: [0.856015, 0.827728, 0.727643],
  metal: [0.908889, 0.908889, 0.908889],
  wood: [0.825128, 0.825128, 0.825128],
  concrete: [0.710816, 0.710816, 0.681928],
};
export function buildNosySkyline(destination) {
  const out = Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
        k,
        (s, r, p, n, u, c) =>
          destination[k](
            s,
            r,
            p,
            n,
            u,
            c.map((v, i) => v * (means[s]?.[i] ?? 1)),
          ),
      ]),
    ),
    pale = [0.67, 0.68, 0.64],
    dark = [0.16, 0.175, 0.165],
    black = [0.065, 0.075, 0.074],
    base = [0.4, 0.405, 0.37],
    polar = (r, y, a) => [Math.sin(a) * r, y, Math.cos(a) * r],
    r = (y) => 3.55 - ((y - 0.8) * 1.73) / 52.1;
  loft(
    out,
    'plaster',
    [
      radialRing(0, 5.1, 5.1, 8, [0, 0], Math.PI / 8),
      radialRing(0.8, 5.1, 5.1, 8, [0, 0], Math.PI / 8),
    ],
    base,
  );
  for (const [y0, y1, c] of [
    [0.8, 44.4, pale],
    [44.4, 52.9, dark],
  ])
    loft(
      out,
      'plaster',
      [y0, y1].map((y) =>
        radialRing(
          y,
          r(y) / Math.cos(Math.PI / 8),
          r(y) / Math.cos(Math.PI / 8),
          8,
          [0, 0],
          Math.PI / 8,
        ),
      ),
      c,
    );
  for (let j = 0; j < 8; j++)
    for (const [f, y, w, h] of [
      [j % 2, 5.2 + j * 5.65, 0.76, 1.55],
      [4 + (j % 2), 7.9 + j * 5.65, 0.7, 1.48],
    ])
      panel(
        transformed(out, (f * Math.PI) / 4),
        'glass',
        -w / 2,
        w / 2,
        y,
        y + h,
        r(y) + 0.016,
        [0.12, 0.17, 0.16],
      );
  panel(out, 'wood', -0.63, 0.63, 0.82, 2.95, 3.57, [0.26, 0.21, 0.145]);
  box(out, 'concrete', [-1.5, 3.02, 3.33], [1.5, 3.2, 4.57], base);
  box(out, 'concrete', [-1.57, 0, 4.65], [1.57, 0.8, 4.91], base);
  for (let i = 0; i < 4; i++)
    box(out, 'concrete', [-1.57, 0, 4.88 + i * 0.43], [1.57, 0.8 - i * 0.2, 5.31 + i * 0.43], base);
  for (const x of [-1.7, 1.7])
    box(out, 'concrete', [x - 0.11, 0, 4.88], [x + 0.11, 0.7, 6.6], base);
  for (let f = 0; f < 8; f++)
    beam(
      transformed(out, (f * Math.PI) / 4),
      'plaster',
      [0, 51.15, 1.92],
      [0, 53.05, 3.27],
      0.3,
      0.34,
      dark,
    );
  loft(
    out,
    'plaster',
    [
      radialRing(52.85, 3.37, 3.37, 8, [0, 0], Math.PI / 8),
      radialRing(53.15, 3.49, 3.49, 8, [0, 0], Math.PI / 8),
    ],
    pale,
  );
  for (let f = 0; f < 8; f++) {
    const a = (f * Math.PI) / 4 + Math.PI / 8,
      b = ((f + 1) * Math.PI) / 4 + Math.PI / 8,
      p = polar(3.23, 53.16, a),
      q = polar(3.23, 53.16, b);
    beam(out, 'plaster', [p[0], 54.12, p[2]], [q[0], 54.12, q[2]], 0.18, 0.18, pale);
    beam(out, 'plaster', p, [p[0], 54.13, p[2]], 0.125, 0.125, pale);
  }
  originalLathe(
    out,
    'plaster',
    [
      [53.14, 1.64],
      [54.53, 1.64],
    ],
    pale,
    8,
  );
  originalLathe(
    out,
    'glass',
    [
      [54.64, 1.63],
      [57.48, 1.63],
    ],
    [0.23, 0.31, 0.32],
    8,
  );
  for (const y of [54.51, 57.45]) originalRing(out, 'metal', y, 1.55, 1.85, 0.15, black, 8);
  originalLathe(
    out,
    'metal',
    Array.from({ length: 5 }, (_, i) => [
      57.59 + 1.24 * Math.sin((i * Math.PI) / 8),
      Math.max(0.055, 1.85 * Math.cos((i * Math.PI) / 8)),
    ]),
    black,
    8,
  );
  originalLathe(
    out,
    'metal',
    [
      [58.82, 0.22],
      [59.02, 0.22],
      [59.2, 0.025],
    ],
    black,
    8,
  );
  originalTube(out, 'metal', [0, 59.2, 0], [0, 60, 0], 0.025, black, 4);
}
