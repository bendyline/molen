/** california_lighthouse complete restored tower; original detailed master remains unchanged. */
import {
  beam,
  loft,
  normalFor,
  sphere as originalSphere,
  radialRing,
} from './authored-structure-mesh.mjs';
import { buildCalifornia as master } from './lighthouse-americas-models.mjs';
import { ring as originalRing, shell as originalShell } from './lighthouse-expansion-models.mjs';
import { lathe as originalLathe, panel, piercedFacade, transformed } from './lighthouse-models.mjs';
import { box, tube as originalTube, quad } from './structure-mesh.mjs';

function detail(out, mode) {
  const cap = mode === 'street' ? 32 : 12,
    profileSegments = mode === 'street' ? 8 : 4,
    roofSeams = mode === 'street' ? 8 : 0;
  const lathe = (o, s, p, c, n) => originalLathe(o, s, p, c, Math.min(n, cap));
  const ring = (o, s, y, ri, ro, h, c, n) => originalRing(o, s, y, ri, ro, h, c, Math.min(n, cap));
  const shell = (o, p) => {
    if (mode !== 'district' || p.profile.at(-1)[0] - p.profile[0][0] < 10)
      return originalShell(o, { ...p, segments: Math.min(p.segments, cap) });
    // Each tapered facet owns its openings, avoiding a global cross-product of all window
    // edge angles and elevations. Sixteen closed facets retain the complete fourteen-window
    // pattern and deep reveals without wasting distant triangles on unrelated wall bands.
    const [[y0, r0], [y1, r1]] = p.profile,
      count = 16;
    for (let f = 0; f < count; f++) {
      const angle = (f * Math.PI * 2) / count,
        face = transformed(o, angle);
      const scale = (y) => 1 + ((r1 / r0 - 1) * (y - y0)) / (y1 - y0);
      const tapered = Object.fromEntries(
        ['addQuad', 'addTriangle', 'addConvexPolygon'].map((method) => [
          method,
          (slot, ref, points, reference, uv, color) => {
            const q = points.map(([x, y, z]) => [x * scale(y), y, z * scale(y)]),
              raw = normalFor(...q.slice(0, 3));
            const sign = raw.reduce((sum, v, i) => sum + v * reference[i], 0) < 0 ? -1 : 1;
            face[method](
              slot,
              ref,
              q,
              raw.map((v) => v * sign),
              uv,
              color,
            );
          },
        ]),
      );
      const holes = p.holes
        .filter(
          (h) => Math.abs(Math.atan2(Math.sin(h.angle - angle), Math.cos(h.angle - angle))) < 0.001,
        )
        .map((h) => ({
          ...h,
          x: 0,
          w: h.w / scale(h.y + h.h / 2),
          depth: h.depth / scale(h.y + h.h / 2),
          trim: 0,
        }));
      piercedFacade(tapered, {
        half: r0 * Math.sin(Math.PI / count),
        z: r0 * Math.cos(Math.PI / count),
        y0,
        y1,
        slot: p.slot,
        color: p.color,
        holes,
      });
    }
  };
  const tube = (o, s, a, b, r, c, n) =>
    originalTube(o, s, a, b, r, c, Math.min(n, mode === 'street' ? 6 : 4));
  const sphere = (o, s, p, r, c, n, m) =>
    originalSphere(
      o,
      s,
      p,
      r,
      c,
      Math.min(n, mode === 'street' ? 12 : 8),
      Math.min(m, mode === 'street' ? 6 : 4),
    );
  const railRing = (o, y, r, h, c) => {
    const n = mode === 'street' ? 24 : 8;
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n,
        b = ((i + 1) * Math.PI * 2) / n;
      for (const yy of [y + h * 0.48, y + h])
        beam(
          o,
          'metal',
          [Math.cos(a) * r, yy, Math.sin(a) * r],
          [Math.cos(b) * r, yy, Math.sin(b) * r],
          0.05,
          0.05,
          c,
        );
      beam(
        o,
        'metal',
        [Math.cos(a) * r, y, Math.sin(a) * r],
        [Math.cos(a) * r, y + h, Math.sin(a) * r],
        0.055,
        0.055,
        c,
      );
    }
  };
  const ivory = [0.85, 0.83, 0.73],
    pink = [0.82, 0.75, 0.7],
    green = [0.035, 0.25, 0.21],
    dark = [0.075, 0.09, 0.085];
  const P = (r, y, a) => [Math.sin(a) * r, y, Math.cos(a) * r];
  function windowFrame(out, a, y, w, h, r, { pediment = true, color = ivory } = {}) {
    if (mode === 'district') {
      const o = transformed(out, a),
        z = Math.sqrt(r * r - (w * w) / 4) - 0.1;
      box(o, 'wood', [-0.018, y, z], [0.018, y + h, z + 0.045], green);
      box(o, 'wood', [-w / 2, y + h / 2 - 0.021, z], [w / 2, y + h / 2 + 0.021, z + 0.045], green);
      if (pediment) {
        const zz = r + 0.015,
          yy = y + h + 0.16;
        outTriangle(
          o,
          'plaster',
          [
            [-w / 2 - 0.18, yy + 0.27, zz - 0.014],
            [w / 2 + 0.18, yy + 0.27, zz - 0.014],
            [0, yy + 0.5, zz - 0.014],
          ],
          color,
        );
        box(
          o,
          'plaster',
          [-w / 2 - 0.13, y - 0.09, zz - 0.22],
          [w / 2 + 0.13, y + 0.015, zz + 0.08],
          color,
        );
      }
      return;
    }
    const o = transformed(out, a),
      z = Math.sqrt(r * r - (w * w) / 4) - 0.1;
    for (const x of [-w / 2, 0, w / 2])
      box(o, 'wood', [x - 0.018, y, z], [x + 0.018, y + h, z + 0.045], green);
    for (const yy of [y, y + h / 2, y + h])
      box(o, 'wood', [-w / 2, yy - 0.021, z], [w / 2, yy + 0.021, z + 0.045], green);
    if (!pediment) return;
    const zz = r + 0.015,
      yy = y + h + 0.16;
    for (const [offset, width, height, depth] of [
      [0, w + 0.37, 0.13, 0.23],
      [0.15, w + 0.48, 0.09, 0.29],
    ])
      box(
        o,
        'plaster',
        [-width / 2, yy + offset, zz - depth],
        [width / 2, yy + offset + height, zz + 0.08],
        color,
      );
    for (const s of [-1, 1]) {
      box(
        o,
        'plaster',
        [s * (w / 2 + 0.11) - 0.065, yy - 0.28, zz - 0.11],
        [s * (w / 2 + 0.11) + 0.065, yy + 0.04, zz + 0.05],
        color,
      );
      beam(
        o,
        'plaster',
        [s * (w / 2 + 0.3), yy + 0.26, zz + 0.05],
        [0, yy + 0.57, zz + 0.05],
        0.08,
        0.13,
        color,
      );
    }
    const points = [
      [-w / 2 - 0.18, yy + 0.27, zz - 0.014],
      [w / 2 + 0.18, yy + 0.27, zz - 0.014],
      [0, yy + 0.5, zz - 0.014],
    ];
    outTriangle(o, 'plaster', points, color);
    box(
      o,
      'plaster',
      [-w / 2 - 0.13, y - 0.09, zz - 0.22],
      [w / 2 + 0.13, y + 0.015, zz + 0.08],
      color,
    );
  }
  function outTriangle(out, slot, p, color) {
    out.addTriangle(
      slot,
      'palette:#fff',
      p,
      normalFor(...p),
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      color,
    );
  }
  function lanternGlass(out, y0, y1, r, color, segments = 16) {
    for (let i = 0; i < segments; i++) {
      const a = (i * Math.PI * 2) / segments,
        b = ((i + 1) * Math.PI * 2) / segments,
        p = [P(r, y0, a), P(r, y0, b), P(r, y1, b), P(r, y1, a)];
      quad(out, 'glass', p, normalFor(...p.slice(0, 3)), [0.17, 0.26, 0.25]);
      tube(out, 'metal', p[0], p[3], 0.026, color, 8);
    }
    for (const y of [y0, y1]) ring(out, 'metal', y, r - 0.035, r + 0.055, 0.055, color, 96);
  }
  function roundedCap(out, y, r, h, color) {
    const profile = Array.from({ length: profileSegments + 1 }, (_, i) => {
      const a = ((i / profileSegments) * Math.PI) / 2;
      return [y + h * Math.sin(a), Math.max(0.035, r * Math.cos(a))];
    });
    lathe(out, 'metal', profile, color, 144);
    for (let i = 0; i < roofSeams; i++)
      for (let j = 1; j < profile.length - 1; j++)
        tube(
          out,
          'metal',
          P(profile[j - 1][1] + 0.013, profile[j - 1][0], (i * Math.PI * 2) / roofSeams),
          P(profile[j][1] + 0.013, profile[j][0], (i * Math.PI * 2) / roofSeams),
          0.012,
          color,
          6,
        );
  }

  function buildCalifornia(out) {
    const baseR = 2.65,
      apothem = baseR * Math.cos(Math.PI / 8),
      half = baseR * Math.sin(Math.PI / 8);
    loft(
      out,
      'plaster',
      [
        radialRing(0, 2.79, 2.79, 8, [0, 0], Math.PI / 8),
        radialRing(0.5, 2.79, 2.79, 8, [0, 0], Math.PI / 8),
      ],
      ivory,
    );
    for (let f = 0; f < 8; f++) {
      const o = transformed(out, (f * Math.PI) / 4);
      piercedFacade(o, {
        half,
        z: apothem,
        y0: 0.5,
        y1: 3.39,
        holes: f === 0 ? [{ x: 0, y: 0.51, w: 0.92, h: 2.19, depth: 0.42, trim: 0.1 }] : [],
        slot: 'plaster',
        color: pink,
      });
    }
    // Layered octagonal cornice around the pedestal.
    loft(
      out,
      'plaster',
      [
        [3.38, 2.65],
        [3.52, 2.79],
        [3.68, 2.88],
        [3.79, 2.81],
      ].map(([y, r]) => radialRing(y, r, r, 8, [0, 0], Math.PI / 8)),
      ivory,
    );
    const r = (y) => 2.11 - ((y - 3.79) * 0.68) / (23.88 - 3.79),
      holes = [];
    // Four stair-facing ranks alternate three and four openings, as shown by the owner's opposing views.
    for (let f = 0; f < 4; f++)
      for (const y of f % 2 ? [4.38, 9.58, 14.78, 19.98] : [7, 12.2, 17.4])
        holes.push({
          angle: (f * Math.PI) / 2,
          y,
          w: 0.53,
          h: 1.14,
          depth: 0.14,
          trimSlot: 'plaster',
          trimColor: ivory,
        });
    for (let f = 0; f < 4; f++)
      holes.push({
        angle: (f * Math.PI) / 2,
        y: 22.45,
        w: 0.61,
        h: 0.7,
        depth: 0.14,
        trimSlot: 'plaster',
        trimColor: ivory,
      });
    shell(out, {
      profile: [
        [3.79, 2.11],
        [23.88, 1.43],
      ],
      holes,
      slot: 'plaster',
      color: pink,
      segments: 192,
    });
    for (const h of holes)
      windowFrame(out, h.angle, h.y, h.w, h.h, r(h.y + h.h / 2), { pediment: h.y < 22 });
    panel(out, 'wood', -0.43, 0.43, 0.52, 2.7, apothem - 0.385, [0.025, 0.045, 0.035]);
    const entry = transformed(out, 0, [0, 0, apothem]);
    for (const x of [-0.57, 0.57])
      box(entry, 'plaster', [x - 0.075, 0.5, -0.2], [x + 0.075, 2.8, 0.11], ivory);
    box(entry, 'plaster', [-0.81, 2.74, -0.1], [0.81, 2.88, 0.16], ivory);
    for (const s of [-1, 1])
      beam(entry, 'plaster', [s * 0.83, 2.91, 0.13], [0, 3.29, 0.13], 0.085, 0.13, ivory);
    for (let i = 0; i < 3; i++)
      box(
        out,
        'limestone',
        [-0.82, i / 6, apothem + 0.92 - i * 0.31],
        [0.82, (i + 1) / 6, apothem + 1.25 - i * 0.31],
        ivory,
      );
    lathe(
      out,
      'plaster',
      [
        [23.87, 1.43],
        [24.04, 1.52],
        [24.32, 1.6],
        [24.67, 1.85],
        [24.79, 2.02],
        [24.96, 2.03],
        [25.08, 1.94],
      ],
      ivory,
      192,
    );
    shell(out, {
      profile: [
        [25.03, 1],
        [27.12, 1],
      ],
      holes: [
        {
          angle: 0,
          y: 25.08,
          w: 0.52,
          h: 1.66,
          depth: 0.15,
          trimSlot: 'metal',
          trimColor: [0.56, 0.6, 0.51],
        },
      ],
      slot: 'metal',
      color: [0.67, 0.68, 0.56],
      segments: 128,
    });
    ring(out, 'metal', 25.02, 0.96, 1.96, 0.11, [0.55, 0.58, 0.53], 128);
    railRing(out, 25.14, 1.87, 1.06, [0.54, 0.58, 0.53], 40);
    for (const y of [25.38, 26.72])
      ring(out, 'metal', y, 0.99, 1.025, 0.045, [0.38, 0.43, 0.36], 96);
    ring(out, 'metal', 27.1, 0.9, 1.96, 0.1, [0.46, 0.5, 0.43], 128);
    // Small upper gallery and narrow cream drum below the green lantern.
    lathe(
      out,
      'metal',
      [
        [27.2, 1.04],
        [27.91, 1.04],
      ],
      [0.68, 0.68, 0.57],
      128,
    );
    for (let i = 0; i < 8; i++)
      box(
        transformed(out, (i * Math.PI) / 4),
        'metal',
        [-0.12, 27.35, 1.035],
        [0.12, 27.44, 1.071],
        [0.42, 0.47, 0.4],
      );
    lanternGlass(out, 27.91, 29.04, 1.04, green, 16);
    ring(out, 'metal', 29.01, 0.97, 1.22, 0.09, green, 128);
    roundedCap(out, 29.1, 1.19, 0.53, green);
    lathe(
      out,
      'metal',
      [
        [29.6, 0.19],
        [29.89, 0.19],
      ],
      green,
      48,
    );
    sphere(out, 'metal', [0, 29.97, 0], [0.13, 0.13, 0.13], green, 32, 16);
    // Published30m structure height excludes the thin vane assembly above the cap.
    tube(out, 'metal', [0, 29.86, 0], [0, 30.83, 0], 0.014, dark, 8);
    for (const y of [30.33, 30.64])
      beam(out, 'metal', [-0.4, y, 0], [0.4, y, 0], 0.018, 0.022, dark);
    for (const [x, y] of [
      [-0.32, 30.3],
      [0.32, 30.59],
    ])
      box(out, 'metal', [x - 0.05, y - 0.09, -0.017], [x + 0.05, y + 0.08, 0.017], dark);
    const ladder = transformed(out, Math.PI / 2);
    for (const x of [-0.18, 0.18])
      tube(ladder, 'metal', [x, 25.18, 1.75], [x, 27.16, 1.56], 0.026, [0.45, 0.49, 0.44], 8);
    for (let y = 25.27; y < 27.12; y += 0.23)
      tube(
        ladder,
        'metal',
        [-0.18, y, 1.75 - (y - 25.18) * 0.096],
        [0.18, y, 1.75 - (y - 25.18) * 0.096],
        0.021,
        [0.45, 0.49, 0.44],
        8,
      );
  }

  buildCalifornia(out);
}
export function buildCaliforniaDistrict(out) {
  detail(out, 'district');
}
export function buildCaliforniaStreet(out) {
  detail(out, 'street');
}
export function buildCaliforniaCloseup(out) {
  master(out);
}
const means = {
  plaster: [0.856015, 0.827728, 0.727643],
  limestone: [0.7539, 0.710243, 0.616244],
  metal: [0.908889, 0.908889, 0.908889],
  granite: [0.701109, 0.701109, 0.701109],
  wood: [0.825128, 0.825128, 0.825128],
};
export function buildCaliforniaSkyline(destination) {
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
    ivory = [0.85, 0.83, 0.73],
    pink = [0.82, 0.75, 0.7],
    green = [0.035, 0.25, 0.21];
  loft(
    out,
    'plaster',
    [
      [0, 2.79],
      [0.5, 2.79],
    ].map(([y, r]) => radialRing(y, r, r, 8, [0, 0], Math.PI / 8)),
    ivory,
  );
  loft(
    out,
    'plaster',
    [
      [0.5, 2.65],
      [3.39, 2.65],
    ].map(([y, r]) => radialRing(y, r, r, 8, [0, 0], Math.PI / 8)),
    pink,
  );
  loft(
    out,
    'plaster',
    [
      [3.38, 2.65],
      [3.68, 2.88],
      [3.79, 2.81],
    ].map(([y, r]) => radialRing(y, r, r, 8, [0, 0], Math.PI / 8)),
    ivory,
  );
  panel(
    out,
    'wood',
    -0.46,
    0.46,
    0.51,
    2.7,
    2.65 * Math.cos(Math.PI / 8) + 0.006,
    [0.025, 0.045, 0.035],
  );
  originalLathe(
    out,
    'plaster',
    [
      [3.79, 2.11],
      [23.88, 1.43],
    ],
    pink,
    12,
  );
  originalLathe(
    out,
    'plaster',
    [
      [23.87, 1.43],
      [24.32, 1.6],
      [24.79, 2.02],
      [25.08, 1.94],
    ],
    ivory,
    12,
  );
  originalLathe(
    out,
    'metal',
    [
      [25.03, 1],
      [27.2, 1],
      [27.2, 1.96],
      [27.3, 1.96],
      [27.3, 1.04],
      [27.91, 1.04],
    ],
    [0.67, 0.68, 0.56],
    12,
  );
  originalLathe(
    out,
    'glass',
    [
      [27.91, 1.04],
      [29.04, 1.04],
    ],
    [0.17, 0.26, 0.25],
    12,
  );
  originalLathe(
    out,
    'metal',
    [
      [29.01, 1.22],
      [29.1, 1.19],
      [29.3, 1.1],
      [29.52, 0.7],
      [29.63, 0.035],
      [29.89, 0.19],
      [30.1, 0.04],
    ],
    green,
    12,
  );
  originalTube(out, 'metal', [0, 29.86, 0], [0, 30.83, 0], 0.02, [0.075, 0.09, 0.085], 4);
  for (let i = 0; i < 3; i++)
    box(
      out,
      'limestone',
      [-0.82, i / 6, 2.65 * Math.cos(Math.PI / 8) + 0.92 - i * 0.31],
      [0.82, (i + 1) / 6, 2.65 * Math.cos(Math.PI / 8) + 1.25 - i * 0.31],
      ivory,
    );
  // Low-cost dark window marks retain all fourteen alternating ranks; near levels cut real recesses.
  for (let f = 0; f < 4; f++)
    panel(
      transformed(out, (f * Math.PI) / 2),
      'wood',
      -0.305,
      0.305,
      22.45,
      23.15,
      2.11 - ((22.45 - 3.79) * 0.68) / (23.88 - 3.79) + 0.006,
      green,
    );
  for (let f = 0; f < 4; f++)
    for (const y of f % 2 ? [4.38, 9.58, 14.78, 19.98] : [7, 12.2, 17.4]) {
      const r = 2.11 - ((y - 3.79) * 0.68) / (23.88 - 3.79);
      panel(
        transformed(out, (f * Math.PI) / 2),
        'wood',
        -0.265,
        0.265,
        y,
        y + 1.14,
        r + 0.006,
        green,
      );
    }
}
