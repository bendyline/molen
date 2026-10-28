/** Ristna browser subdivision recipe, isolated so other Baltic masters and reviews remain unchanged. */
import earcut from 'earcut';
import { normalFor, sphere } from './authored-structure-mesh.mjs';
import { ring, shell } from './lighthouse-expansion-models.mjs';
import { lathe, railRing, transformed } from './lighthouse-models.mjs';
import { box, quad, tube, tubePath } from './structure-mesh.mjs';

const TAU = Math.PI * 2,
  red = [0.43, 0.075, 0.049],
  dark = [0.075, 0.083, 0.075],
  pale = [0.78, 0.79, 0.72];
const P = (r, y, a) => [r * Math.sin(a), y, r * Math.cos(a)];
export function radialPlate(out, angle, profile, thickness, slot, color) {
  const o = transformed(out, angle),
    ix = earcut(profile.flat());
  for (const sign of [-1, 1])
    for (let i = 0; i < ix.length; i += 3) {
      const p = ix
        .slice(i, i + 3)
        .map((k) => [(sign * thickness) / 2, profile[k][0], profile[k][1]]);
      if (normalFor(...p)[0] * sign < 0) p.reverse();
      o.addTriangle(
        slot,
        'metric:uv',
        p,
        [sign, 0, 0],
        p.map((v) => [v[2], v[1]]),
        color,
      );
    }
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i],
      b = profile[(i + 1) % profile.length],
      p = [
        [-thickness / 2, ...a],
        [thickness / 2, ...a],
        [thickness / 2, ...b],
        [-thickness / 2, ...b],
      ];
    // Profile lies in Y/Z; a clockwise loop gives the outward edge order above.
    if (
      profile.reduce(
        (s, v, k) =>
          s +
          v[0] * profile[(k + 1) % profile.length][1] -
          v[1] * profile[(k + 1) % profile.length][0],
        0,
      ) > 0
    )
      p.reverse();
    quad(o, slot, p, normalFor(...p.slice(0, 3)), color);
  }
}
const originalRistnaPrimitives = { lathe, ring, tube, sphere, shell, railRing };
export function buildRistna(out) {
  return buildRistnaDetail(out);
}
/** Only subdivisions and repeated tiny fittings change; apertures and structural members survive. */
export function buildRistnaDetail(out, resolution = 1) {
  const subdivisions = (n) => Math.max(4, Math.round(n * resolution));
  const lathe = (o, s, p, c, n = 80) => originalRistnaPrimitives.lathe(o, s, p, c, subdivisions(n));
  const ring = (o, s, y, a, b, h, c, n = 80) =>
    originalRistnaPrimitives.ring(o, s, y, a, b, h, c, subdivisions(n));
  const tube = (o, s, a, b, r, c, n = 8) =>
    originalRistnaPrimitives.tube(o, s, a, b, r, c, Math.max(3, Math.round(n * resolution)));
  const sphere = (o, s, p, r, c, n = 16, m = 8) =>
    originalRistnaPrimitives.sphere(
      o,
      s,
      p,
      r,
      c,
      subdivisions(n),
      Math.max(3, Math.round(m * resolution)),
    );
  const shell = (o, options) =>
    originalRistnaPrimitives.shell(o, {
      ...options,
      segments: subdivisions(options.segments ?? 128),
    });
  const railRing = (o, y, r, h, c, n) => {
    if (resolution === 1) return originalRistnaPrimitives.railRing(o, y, r, h, c, n);
    for (const yy of [y + 0.1, y + h]) ring(o, 'metal', yy, r - 0.02, r + 0.02, 0.03, c, 128);
    for (let i = 0; i < n; i++)
      tube(o, 'metal', P(r, y, (i * TAU) / n), P(r, y + h, (i * TAU) / n), 0.021, c, 8);
  };
  function bead(out, p, color = red, r = 0.022) {
    sphere(out, 'metal', p, [r, r, r], color, 6, 3);
  }
  function line(out, ps, color = red, r = 0.012) {
    tubePath(out, 'metal', ps, r, color, Math.max(3, Math.round(6 * resolution)));
  }
  function seam(out, r, y0, y1, angle, color = red, width = 0.075) {
    const o = transformed(out, angle);
    box(o, 'metal', [-width / 2, y0, r - 0.012], [width / 2, y1, r + 0.014], color);
    for (let y = y0 + 0.08; y < y1; y += 0.18 / resolution)
      for (const dx of [-width * 0.28, width * 0.28]) bead(o, [dx, y, r + 0.019], color, 0.014);
  }
  function boltedRing(out, y, r, color = red, width = 0.11, count = 80) {
    ring(out, 'metal', y - width / 2, r - 0.013, r + 0.022, width, color, 128);
    for (let j = 0; j < subdivisions(count); j++)
      for (const dy of [-width * 0.28, width * 0.28])
        bead(out, P(r + 0.028, y + dy, (j * TAU) / subdivisions(count)), color, 0.015);
  }
  function dome(out, y, r, height, color, segments = 128) {
    const profile = Array.from({ length: subdivisions(24) + 1 }, (_, i) => [
      y + Math.sin((i * Math.PI) / (2 * subdivisions(24))) * height,
      Math.max(0.028, r * Math.cos((i * Math.PI) / (2 * subdivisions(24)))),
    ]);
    lathe(out, 'metal', profile, color, segments);
    for (let j = 0; j < 12; j++)
      line(
        out,
        profile.map(([yy, rr]) => P(rr + 0.008, yy, (j * TAU) / 12)),
        color.map((v) => v * 0.8),
        0.012,
      );
  }
  function ristnaRails(out, y, r, height) {
    const c = [0.63, 0.07, 0.035];
    for (const yy of [y + 0.1, y + height])
      ring(out, 'metal', yy, r - 0.025, r + 0.026, 0.035, c, 128);
    for (let i = 0; i < 24; i++) {
      const a = (i * TAU) / 24,
        b = ((i + 1) * TAU) / 24;
      tube(out, 'metal', P(r, y, a), P(r, y + height, a), 0.022, c, 10);
      for (const t of [0.32, 0.68]) {
        const ang = a + (b - a) * t;
        tube(out, 'metal', P(r, y + 0.1, ang), P(r, y + height - 0.13, ang), 0.014, c, 8);
      }
      line(
        out,
        Array.from({ length: subdivisions(8) + 1 }, (_, j) =>
          P(
            r,
            y + height - 0.13 + 0.1 * Math.sin((j * Math.PI) / subdivisions(8)),
            a + (b - a) * (0.32 + (0.36 * j) / subdivisions(8)),
          ),
        ),
        c,
        0.014,
      );
    }
  }
  function ristnaShell(out, options) {
    shell(
      {
        addQuad(slot, ref, ...args) {
          if (ref === 'metric:uv' || slot === 'glass') out.addQuad(slot, ref, ...args);
        },
        addTriangle(...args) {
          out.addTriangle(...args);
        },
      },
      options,
    );
    for (const h of options.holes) {
      const r = options.profile[0][1],
        z = Math.sqrt(r * r - (h.w * h.w) / 4),
        t = h.w < 0.4 ? 0.024 : 0.06,
        w = h.w / 2,
        o = transformed(out, h.angle ?? 0),
        c = h.trimColor;
      for (const x of [-w, w])
        box(o, h.trimSlot, [x - t, h.y - t, z - h.depth], [x + t, h.y + h.h + t, z + 0.026], c);
      for (const y of [h.y, h.y + h.h])
        box(o, h.trimSlot, [-w - t, y - t, z - h.depth], [w + t, y + t, z + 0.03], c);
    }
  }

  const c = [0.63, 0.062, 0.033],
    steel = [0.56, 0.055, 0.028],
    white = [0.89, 0.88, 0.8];
  lathe(
    out,
    'granite',
    [
      [0, 2.77],
      [0.57, 2.77],
    ],
    [0.5, 0.48, 0.42],
    128,
  );
  ring(out, 'granite', 0.55, 1.08, 2.78, 0.08, [0.59, 0.56, 0.49], 128);
  const holes = [
    { angle: 0, y: 0.61, w: 0.78, h: 1.91, depth: 0.16, trimSlot: 'plaster', trimColor: c },
    ...Array.from({ length: 4 }, (_, i) => ({
      angle: 0,
      y: 3.74 + i * 4.55,
      w: 0.27,
      h: 0.53,
      depth: 0.055,
      trimSlot: 'plaster',
      trimColor: c,
    })),
  ];
  ristnaShell(out, {
    profile: [
      [0.6, 1.16],
      [19.48, 1.16],
    ],
    slot: 'plaster',
    color: c,
    segments: 160,
    holes,
  });
  const edge = [
    [0.61, 2.47],
    [1, 2.32],
    [1.6, 2.14],
    [2.4, 1.96],
    [3.5, 1.8],
    [5.1, 1.72],
    [18.4, 1.72],
    [18.74, 1.77],
    [19.03, 1.9],
    [19.25, 2.14],
    [19.36, 2.52],
  ];
  for (let i = 0; i < 8; i++)
    radialPlate(
      out,
      ((i + 0.5) * TAU) / 8,
      [[0.61, 1.06], ...edge, [19.48, 2.52], [19.48, 1.06]],
      0.22,
      'plaster',
      c,
    );
  for (const y of [5.65, 10.95, 16.23]) ring(out, 'plaster', y, 1.15, 1.735, 0.18, c, 128);
  lathe(
    out,
    'metal',
    [
      [19.4, 1.16],
      [19.65, 2.49],
    ],
    steel,
    128,
  );
  ristnaShell(out, {
    profile: [
      [19.65, 2.49],
      [22.03, 2.49],
    ],
    slot: 'metal',
    color: steel,
    segments: 160,
    holes: Array.from({ length: 16 }, (_, i) => ({
      angle: (i * TAU) / 16,
      y: 21.14,
      w: 0.21,
      h: 0.43,
      depth: 0.035,
      trimSlot: 'metal',
      trimColor: steel,
    })),
  });
  for (let i = 0; i < 16; i++) seam(out, 2.5, 19.66, 22.02, ((i + 0.5) * TAU) / 16, steel, 0.055);
  boltedRing(out, 19.68, 2.49, steel, 0.07, 96);
  ring(out, 'metal', 22.02, 1.12, 2.96, 0.11, steel, 128);
  ring(out, 'metal', 22.14, 1.12, 3.01, 0.08, steel, 128);
  for (let i = 0; i < 24; i++) {
    const profile = [
      [21.53, 2.46],
      [21.56, 2.59],
      [21.7, 2.68],
      [21.91, 2.77],
      [22.04, 2.95],
      [22.13, 2.95],
      [22.13, 2.46],
    ];
    radialPlate(out, ((i + 0.5) * TAU) / 24, profile, 0.075, 'metal', steel);
    bead(out, P(2.56, 21.86, ((i + 0.5) * TAU) / 24), steel, 0.027);
  }
  ristnaRails(out, 22.22, 2.95, 0.96);
  ristnaShell(out, {
    profile: [
      [22.22, 1.46],
      [23.7, 1.46],
    ],
    slot: 'metal',
    color: c,
    segments: 128,
    holes: [
      { angle: 0, y: 22.26, w: 0.67, h: 1.37, depth: 0.12, trimSlot: 'metal', trimColor: steel },
    ],
  });
  for (let i = 0; i < 12; i++) seam(out, 1.47, 22.23, 23.68, ((i + 0.5) * TAU) / 12, steel, 0.055);
  ring(out, 'metal', 23.7, 1.1, 1.84, 0.095, steel, 128);
  railRing(out, 23.8, 1.79, 0.92, steel, 16);
  // This lantern has diamond glazing bars, not Ruhnu's rectangular grids.
  for (let i = 0; i < 12; i++) {
    const a = (i * TAU) / 12,
      b = ((i + 1) * TAU) / 12,
      r = 1.43,
      y0 = 23.81,
      y1 = 25.44,
      p = [P(r, y0, a), P(r, y0, b), P(r, y1, b), P(r, y1, a)];
    quad(out, 'glassClear', p, normalFor(...p.slice(0, 3)), [0.81, 0.9, 0.89]);
    tube(out, 'metal', P(r, y0, a), P(r, y1, a), 0.021, steel, 10);
    line(
      out,
      [P(r, y0 + 0.5, a), P(r, (y0 + y1) / 2, (a + b) / 2), P(r, y1 - 0.4, a)],
      steel,
      0.012,
    );
    line(
      out,
      [P(r, y0 + 0.5, b), P(r, (y0 + y1) / 2, (a + b) / 2), P(r, y1 - 0.4, b)],
      steel,
      0.012,
    );
  }
  for (const y of [23.81, 25.44]) ring(out, 'metal', y, 1.4, 1.49, 0.035, steel, 128);
  lathe(
    out,
    'metal',
    [
      [25.46, 1.59],
      [25.55, 1.59],
      [25.6, 1.53],
    ],
    white,
    128,
  );
  dome(out, 25.6, 1.53, 0.77, white);
  lathe(
    out,
    'metal',
    [
      [26.34, 0.12],
      [26.49, 0.16],
      [26.57, 0.11],
    ],
    white,
    48,
  );
  sphere(out, 'metal', [0, 26.67, 0], [0.16, 0.19, 0.16], white, 32, 16);
  tube(out, 'metal', [0, 26.8, 0], [0, 27.2, 0], 0.012, white, 8);
  tube(out, 'metal', [-0.39, 27.04, 0], [0.4, 27.04, 0], 0.012, white, 8);
  box(out, 'metal', [-0.38, 26.99, -0.012], [-0.18, 27.13, 0.012], white);
  lathe(
    out,
    'metal',
    [
      [23.8, 0.23],
      [24.45, 0.23],
      [24.5, 0.32],
    ],
    pale,
    64,
  );
  lathe(
    out,
    'glassClear',
    [
      [24.5, 0.28],
      [24.89, 0.28],
    ],
    [0.8, 0.9, 0.87],
    64,
  );
  for (let y = 24.51; y < 24.9; y += 0.056) ring(out, 'metal', y, 0.25, 0.31, 0.014, pale, 64);
  box(out, 'metal', [-0.34, 0.68, 1.032], [0.34, 2.45, 1.08], dark);
  for (const y of [0.9, 1.5, 2.17])
    box(out, 'metal', [-0.3, y - 0.024, 1.078], [0.3, y + 0.024, 1.11], [0.13, 0.13, 0.1]);
  tube(out, 'metal', [0.24, 1.27, 1.11], [0.24, 1.44, 1.11], 0.023, pale, 8);
  for (let i = 0; i < 4; i++)
    box(
      out,
      'granite',
      [-0.74, 0, 1.04],
      [0.74, 0.6 - i * 0.15, 2.15 + i * 0.27],
      [0.49, 0.48, 0.41],
    );
  for (const x of [-0.85, 0.85])
    box(out, 'granite', [x - 0.14, 0, 1.8], [x + 0.14, 0.83, 3.04], [0.53, 0.51, 0.44]);
  // Ground-ring block joints follow the operator's granite plinth photograph.
  for (let i = 0; i < 24; i++)
    line(
      out,
      [P(2.777, 0.03, (i * TAU) / 24), P(2.777, 0.54, (i * TAU) / 24)],
      [0.34, 0.34, 0.3],
      0.007,
    );
}
