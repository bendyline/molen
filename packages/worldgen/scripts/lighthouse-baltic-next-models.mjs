/** Distinct Baltic navigation towers, each controlled by its own authority evidence. */
import earcut from 'earcut';
import { beam, cross, loft, normalFor, normalize, sphere } from './authored-structure-mesh.mjs';
import { lighthouseStudy, ring, shell } from './lighthouse-expansion-models.mjs';
import { lathe, railRing, transformed } from './lighthouse-models.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const TAU = Math.PI * 2,
  red = [0.43, 0.075, 0.049],
  dark = [0.075, 0.083, 0.075],
  pale = [0.78, 0.79, 0.72];
const P = (r, y, a) => [r * Math.sin(a), y, r * Math.cos(a)];
function bead(out, p, color = red, r = 0.022) {
  sphere(out, 'metal', p, [r, r, r], color, 6, 3);
}
function line(out, ps, color = red, r = 0.012) {
  for (let j = 1; j < ps.length; j++) tube(out, 'metal', ps[j - 1], ps[j], r, color, 6);
}
function seam(out, r, y0, y1, angle, color = red, width = 0.075) {
  const o = transformed(out, angle);
  box(o, 'metal', [-width / 2, y0, r - 0.012], [width / 2, y1, r + 0.014], color);
  for (let y = y0 + 0.08; y < y1; y += 0.18)
    for (const dx of [-width * 0.28, width * 0.28]) bead(o, [dx, y, r + 0.019], color, 0.014);
}
function boltedRing(out, y, r, color = red, width = 0.11, count = 80) {
  ring(out, 'metal', y - width / 2, r - 0.013, r + 0.022, width, color, 128);
  for (let j = 0; j < count; j++)
    for (const dy of [-width * 0.28, width * 0.28])
      bead(out, P(r + 0.028, y + dy, (j * TAU) / count), color, 0.015);
}
function pipeJoint(out, a, b, t, r, color = red) {
  const ax = normalize(b.map((v, i) => v - a[i])),
    u = normalize(cross(ax, [0, 0, 1])),
    v = cross(ax, u),
    point = (dy, ang, rr) =>
      a.map(
        (n, k) =>
          n + (b[k] - n) * t + ax[k] * dy + (u[k] * Math.cos(ang) + v[k] * Math.sin(ang)) * rr,
      );
  const rings = [-0.055, 0.055].map((dy) =>
    Array.from({ length: 48 }, (_, i) => point(dy, (-i * TAU) / 48, r + 0.025)),
  );
  loft(out, 'metal', rings, color);
  for (let i = 0; i < 20; i++)
    for (const dy of [-0.025, 0.025]) bead(out, point(dy, (i * TAU) / 20, r + 0.031), color, 0.014);
}
function lanternGlass(out, y0, y1, r, n = 12, color = [0.84, 0.9, 0.88], frame = pale) {
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n,
      b = ((i + 1) * TAU) / n,
      ps = [P(r, y0, a), P(r, y0, b), P(r, y1, b), P(r, y1, a)];
    quad(out, 'glassClear', ps, normalFor(...ps.slice(0, 3)), color);
    tube(out, 'metal', P(r + 0.022, y0, a), P(r + 0.022, y1, a), 0.027, frame, 10);
  }
  for (const y of [y0, y0 + (y1 - y0) * 0.34, y0 + (y1 - y0) * 0.68, y1])
    ring(out, 'metal', y - 0.013, r - 0.027, r + 0.038, 0.027, frame, 128);
}
function dome(out, y, r, height, color, segments = 128) {
  const profile = Array.from({ length: 25 }, (_, i) => [
    y + Math.sin((i * Math.PI) / 48) * height,
    Math.max(0.028, r * Math.cos((i * Math.PI) / 48)),
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
function ruhnuDoor(out) {
  const z = 1.285;
  box(out, 'metal', [-0.49, 0.32, z - 0.09], [0.49, 2.38, z - 0.015], red);
  for (const y of [0.54, 1.3, 2.16])
    box(out, 'metal', [-0.48, y - 0.027, z - 0.004], [0.48, y + 0.027, z + 0.025], red);
  for (const y of [0.54, 2.16]) {
    box(out, 'metal', [0.28, y - 0.08, z + 0.025], [0.63, y + 0.08, z + 0.09], [0.42, 0.34, 0.18]);
    for (const x of [0.33, 0.52]) bead(out, [x, y, z + 0.11], [0.45, 0.37, 0.19], 0.028);
  }
  for (let y = 0.42; y < 2.3; y += 0.16)
    for (const x of [-0.445, 0.445]) bead(out, [x, y, z + 0.025], red, 0.017);
  tube(out, 'metal', [-0.31, 1.2, z + 0.06], [-0.31, 1.43, z + 0.06], 0.028, dark, 10);
  box(out, 'metal', [-0.43, 2.64, z - 0.025], [0.43, 3.04, z + 0.028], [0.4, 0.35, 0.23]);
  for (const x of [-0.38, 0.38])
    for (const y of [2.69, 2.99]) bead(out, [x, y, z + 0.044], [0.52, 0.48, 0.31], 0.02);
  // Curved rain hood follows the round stair tube and the operator's close photograph.
  for (let i = 0; i < 24; i++) {
    const a = -0.49 + (i * 0.98) / 24,
      b = -0.49 + ((i + 1) * 0.98) / 24,
      p = [P(1.285, 2.43, a), P(1.58, 2.49, a), P(1.58, 2.49, b), P(1.285, 2.43, b)];
    if (normalFor(...p.slice(0, 3))[1] < 0) p.reverse();
    quad(out, 'metal', p, normalFor(...p.slice(0, 3)), red);
    const lower = p.map(([x, y, z]) => [x, y - 0.035, z]).reverse();
    quad(out, 'metal', lower, normalFor(...lower.slice(0, 3)), red);
    const lip = [P(1.58, 2.455, a), P(1.58, 2.455, b), P(1.58, 2.49, b), P(1.58, 2.49, a)];
    quad(out, 'metal', lip, normalFor(...lip.slice(0, 3)), red);
  }
  const light = transformed(out, -0.52);
  sphere(light, 'glass', [0, 2.14, 1.31], [0.085, 0.19, 0.067], [0.76, 0.74, 0.54], 16, 8);
  for (const x of [-0.072, 0.072])
    tube(light, 'metal', [x, 1.95, 1.385], [x, 2.33, 1.385], 0.009, [0.43, 0.4, 0.25], 6);
  for (const y of [2, 2.12, 2.24])
    tube(light, 'metal', [-0.073, y, 1.385], [0.073, y, 1.385], 0.009, [0.43, 0.4, 0.25], 6);
}
function ruhnuLegs(out) {
  for (let i = 0; i < 4; i++) {
    const angle = Math.PI / 4 + (i * Math.PI) / 2,
      a = P(6.04, 0.23, angle),
      b = P(1.79, 28.35, angle),
      foot = transformed(out, angle, [a[0], 0, a[2]]);
    box(foot, 'granite', [-0.67, 0, -0.67], [0.67, 0.14, 0.67], [0.46, 0.43, 0.35]);
    lathe(
      foot,
      'metal',
      [
        [0.14, 0.57],
        [0.22, 0.57],
        [0.29, 0.51],
        [0.47, 0.4],
      ],
      red,
      64,
    );
    tube(out, 'metal', a, b, 0.38, red, 64);
    for (let j = 1; j < 6; j++) pipeJoint(out, a, b, j / 6, 0.38);
    for (let y = 0.45; y < 28; y += 0.19) {
      const t = (y - a[1]) / (b[1] - a[1]),
        p = a.map((n, k) => n + (b[k] - n) * t);
      for (const da of [-0.06, 0.06])
        bead(
          out,
          [p[0] + Math.sin(angle + da) * 0.381, y, p[2] + Math.cos(angle + da) * 0.381],
          red,
          0.014,
        );
    }
    for (let j = 0; j < 8; j++) {
      const a0 = (j * TAU) / 8;
      tube(foot, 'metal', P(0.56, 0.16, a0), P(0.56, 0.49, a0), 0.024, dark, 8);
      bead(foot, P(0.56, 0.39, a0), red, 0.043);
      beam(foot, 'metal', P(0.51, 0.23, a0), P(0.39, 0.42, a0), 0.07, 0.07, red);
    }
    for (const y of [9.1, 18.25]) {
      const t = (y - 0.23) / (28.35 - 0.23),
        end = a.map((n, k) => n + (b[k] - n) * t),
        start = P(1.25, y, angle);
      tube(out, 'metal', start, end, 0.25, red, 48);
      pipeJoint(out, start, end, 0.25, 0.25);
      pipeJoint(out, start, end, 0.85, 0.25);
    }
  }
}
export function buildRuhnu(out) {
  lathe(
    out,
    'metal',
    [
      [0, 1.61],
      [0.14, 1.61],
      [0.3, 1.43],
      [0.47, 1.32],
    ],
    red,
    128,
  );
  const holes = [
    { angle: 0, y: 0.32, w: 0.99, h: 2.08, depth: 0.12, trimSlot: 'metal', trimColor: red },
    ...Array.from({ length: 8 }, (_, i) => ({
      angle: 0,
      y: 4.4 + i * 3.0,
      w: 0.25,
      h: 0.42,
      depth: 0.1,
      trimSlot: 'metal',
      trimColor: red,
    })),
  ];
  shell(out, {
    profile: [
      [0.3, 1.29],
      [28.45, 1.29],
    ],
    slot: 'metal',
    color: red,
    segments: 160,
    holes,
  });
  for (let y = 3.3; y < 28; y += 3.08) boltedRing(out, y, 1.29);
  for (let i = 0; i < 8; i++) seam(out, 1.3, 0.31, 28.32, ((i + 0.5) * TAU) / 8, red, 0.095);
  for (let i = 0; i < 20; i++) {
    const a = (i * TAU) / 20;
    bead(out, P(1.43, 0.36, a), red, 0.05);
    tube(out, 'metal', P(1.53, 0.02, a), P(1.53, 0.39, a), 0.025, dark, 8);
  }
  ruhnuDoor(out);
  ruhnuLegs(out);
  lathe(
    out,
    'metal',
    [
      [28.2, 1.5],
      [28.45, 2.6],
    ],
    red,
    128,
  );
  shell(out, {
    profile: [
      [28.45, 2.6],
      [31.11, 2.6],
    ],
    slot: 'metal',
    color: red,
    segments: 128,
    holes: Array.from({ length: 8 }, (_, i) => ({
      angle: ((i + 0.5) * TAU) / 8,
      y: 30.2,
      w: 0.28,
      h: 0.4,
      depth: 0.075,
      trimSlot: 'metal',
      trimColor: red,
    })),
  });
  lathe(
    out,
    'metal',
    [
      [31.11, 2.6],
      [31.21, 3.24],
      [31.32, 3.24],
    ],
    red,
    128,
  );
  // The broad lower service room is ringed by small rectangular ports.
  for (let i = 0; i < 8; i++) {
    seam(out, 2.61, 28.48, 31.08, (i * TAU) / 8, red, 0.075);
  }
  shell(out, {
    profile: [
      [31.32, 1.7],
      [33.71, 1.7],
    ],
    slot: 'metal',
    color: red,
    segments: 128,
    holes: [
      { angle: 0, y: 31.39, w: 0.72, h: 1.96, depth: 0.12, trimSlot: 'metal', trimColor: red },
    ],
  });
  for (let i = 0; i < 8; i++) seam(out, 1.71, 31.35, 33.67, ((i + 0.5) * TAU) / 8, red, 0.062);
  // Restored main gallery has closely spaced red rails and a taller pale inner safety rail.
  railRing(out, 31.33, 3.15, 1.18, red, 32);
  for (const y of [31.69, 32.04]) ring(out, 'metal', y, 3.126, 3.154, 0.025, red, 128);
  railRing(out, 31.33, 3.09, 1.57, [0.54, 0.57, 0.5], 24);
  ring(out, 'metal', 33.7, 1.1, 2.13, 0.13, red, 128);
  railRing(out, 33.84, 2.08, 0.86, red, 24);
  lanternGlass(out, 33.86, 36.2, 1.72, 12, [0.88, 0.93, 0.9], [0.58, 0.62, 0.55]);
  lathe(
    out,
    'metal',
    [
      [36.2, 1.81],
      [36.28, 1.81],
      [36.34, 1.74],
    ],
    red,
    128,
  );
  dome(out, 36.33, 1.75, 1.05, [0.31, 0.23, 0.115]);
  lathe(
    out,
    'metal',
    [
      [37.36, 0.11],
      [37.51, 0.14],
      [37.59, 0.095],
    ],
    [0.31, 0.23, 0.115],
    48,
  );
  sphere(out, 'metal', [0, 37.66, 0], [0.18, 0.18, 0.18], [0.36, 0.24, 0.12], 32, 16);
  tube(out, 'metal', [0, 37.78, 0], [0, 38.34, 0], 0.012, dark, 8);
  tube(out, 'metal', [-0.38, 38.13, 0], [0.3, 38.13, 0], 0.012, dark, 8);
  box(out, 'metal', [-0.37, 38.04, -0.012], [-0.16, 38.23, 0.012], dark);
  const arrow = [
    [0.31, 38.13, 0],
    [0.15, 38.23, 0],
    [0.15, 38.03, 0],
  ];
  out.addTriangle(
    'metal',
    'palette:#ffffff',
    arrow,
    [0, 0, 1],
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    dark,
  );
  // Contemporary LED beacon visible through the glazing, with the retained central mounting frame.
  lathe(
    out,
    'metal',
    [
      [33.83, 0.22],
      [34.52, 0.22],
      [34.6, 0.33],
    ],
    pale,
    64,
  );
  lathe(
    out,
    'glassClear',
    [
      [34.6, 0.28],
      [35.02, 0.28],
    ],
    [0.84, 0.88, 0.75],
    64,
  );
  for (let y = 34.62; y <= 35.03; y += 0.065) ring(out, 'metal', y, 0.26, 0.305, 0.016, pale, 64);
}
function radialPlate(out, angle, profile, thickness, slot, color) {
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
      Array.from({ length: 9 }, (_, j) =>
        P(
          r,
          y + height - 0.13 + 0.1 * Math.sin((j * Math.PI) / 8),
          a + (b - a) * (0.32 + (0.36 * j) / 8),
        ),
      ),
      c,
      0.014,
    );
  }
}
/** Small metal/concrete ports need narrow reveals rather than masonry-sized casing. */
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
export function buildRistna(out) {
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
const pilsumRed = [0.76, 0.038, 0.022],
  pilsumYellow = [0.97, 0.67, 0.012],
  pilsumBase = 0.3,
  pilsumEave = 10.15,
  pilsumCourse = (pilsumEave - pilsumBase) / 7;
const pilsumColor = (y) =>
  Math.floor(Math.max(0, Math.min(6.999, (y - pilsumBase) / pilsumCourse))) % 2
    ? pilsumYellow
    : pilsumRed;
function pilsumWindow(out, a, y, w, h, panes = 2) {
  const o = transformed(out, a),
    z = Math.sqrt(2.2 ** 2 - (w / 2) ** 2) - 0.07,
    c = [0.043, 0.049, 0.039];
  for (const x of [-w / 2, w / 2])
    box(o, 'metal', [x - 0.035, y - 0.035, z - 0.045], [x + 0.035, y + h + 0.035, z + 0.055], c);
  for (const yy of [y, y + h * 0.49, y + h])
    box(o, 'metal', [-w / 2, yy - 0.029, z - 0.025], [w / 2, yy + 0.029, z + 0.055], c);
  for (let i = 1; i < panes; i++) {
    const x = -w / 2 + (w * i) / panes;
    box(o, 'metal', [x - 0.025, y, z - 0.025], [x + 0.025, y + h, z + 0.055], c);
  }
  if (h < 1.3) {
    for (let yy = y + 0.1; yy < y + h; yy += 0.16)
      tube(o, 'metal', [-w * 0.47, yy, z + 0.062], [w * 0.47, yy, z + 0.062], 0.008, c, 6);
    for (let x = -w * 0.4; x < w * 0.49; x += 0.12)
      tube(o, 'metal', [x, y, z + 0.062], [x, y + h, z + 0.062], 0.008, c, 6);
  }
}
function pilsumHood(out, a, y, width = 0.46) {
  const o = transformed(out, a),
    c = pilsumColor(y);
  box(o, 'metal', [-width / 2, y - 0.025, 2.195], [width / 2, y + 0.15, 2.22], c);
  const p = [
    [-width / 2, y - 0.025, 2.36],
    [width / 2, y - 0.025, 2.36],
    [width / 2, y + 0.15, 2.215],
    [-width / 2, y + 0.15, 2.215],
  ];
  quad(o, 'metal', p, normalFor(...p.slice(0, 3)), c);
  for (const x of [-width / 2, width / 2]) {
    const ps = [
      [x, y - 0.025, 2.215],
      [x, y - 0.025, 2.36],
      [x, y + 0.15, 2.215],
    ];
    if (normalFor(...ps)[0] * x < 0) ps.reverse();
    o.addTriangle(
      'metal',
      'metric:uv',
      ps,
      normalFor(...ps),
      ps.map((v) => [v[2], v[1]]),
      c,
    );
  }
}
export function buildPilsum(out) {
  lathe(
    out,
    'brick',
    [
      [0, 2.48],
      [0.25, 2.48],
    ],
    [0.42, 0.38, 0.29],
    128,
  );
  lathe(
    out,
    'metal',
    [
      [0.25, 2.28],
      [0.31, 2.28],
    ],
    [0.19, 0.2, 0.15],
    128,
  );
  const opticalAngles = [2.1, 3.56],
    holes = [
      {
        angle: 0,
        y: 0.32,
        w: 0.84,
        h: 1.93,
        depth: 0.12,
        trimSlot: 'metal',
        trimColor: [0.12, 0.14, 0.1],
      },
      ...[1.56, 4.99].map((y) => ({
        angle: Math.PI,
        y,
        w: 0.57,
        h: 0.86,
        depth: 0.1,
        trimSlot: 'metal',
        trimColor: [0.04, 0.05, 0.04],
      })),
      ...opticalAngles.map((angle) => ({
        angle,
        y: 7.99,
        w: 1.74,
        h: 1.85,
        depth: 0.11,
        trimSlot: 'metal',
        trimColor: [0.03, 0.04, 0.03],
      })),
    ];
  shell(out, {
    profile: Array.from({ length: 8 }, (_, i) => [pilsumBase + i * pilsumCourse, 2.2]),
    slot: 'metal',
    color: pilsumColor,
    segments: 192,
    holes,
  });
  for (const h of holes.filter((h) => h.angle !== 0)) pilsumWindow(out, h.angle, h.y, h.w, h.h, 2);
  for (let j = 0; j < 7; j++) {
    const y0 = pilsumBase + j * pilsumCourse,
      y1 = y0 + pilsumCourse,
      c = pilsumColor((y0 + y1) / 2);
    // Riveted vertical plate joints stop at apertures; they are not grooves cut through windows.
    for (let i = 0; i < 12; i++) {
      const a = ((i + (j % 2) * 0.5) * TAU) / 12;
      const cuts = holes.filter(
        (h) =>
          Math.abs(Math.atan2(Math.sin(a - h.angle), Math.cos(a - h.angle))) <
            Math.asin(h.w / 4.4) + 0.025 &&
          h.y < y1 &&
          h.y + h.h > y0,
      );
      const ends = [
        y0,
        y1,
        ...cuts.flatMap((h) => [Math.max(y0, h.y - 0.08), Math.min(y1, h.y + h.h + 0.08)]),
      ].sort((a, b) => a - b);
      for (let k = 1; k < ends.length; k++)
        if (
          ends[k] - ends[k - 1] > 0.03 &&
          !cuts.some(
            (h) =>
              (ends[k] + ends[k - 1]) / 2 > h.y - 0.08 &&
              (ends[k] + ends[k - 1]) / 2 < h.y + h.h + 0.08,
          )
        )
          seam(out, 2.2, ends[k - 1] + 0.01, ends[k] - 0.01, a, c, 0.032);
    }
    if (j > 0)
      for (let i = 0; i < 128; i++) {
        const a = (i * TAU) / 128;
        if (
          !holes.some(
            (h) =>
              y0 > h.y - 0.02 &&
              y0 < h.y + h.h + 0.02 &&
              Math.abs(Math.atan2(Math.sin(a - h.angle), Math.cos(a - h.angle))) <
                Math.asin(h.w / 4.4) + 0.015,
          )
        )
          bead(out, P(2.202, y0 + 0.018, a), c, 0.012);
      }
  }
  const entry = transformed(out, 0);
  box(entry, 'metal', [-0.37, 0.36, 2.052], [0.37, 2.21, 2.116], [0.21, 0.23, 0.17]);
  for (const y of [0.61, 1.37, 2.03])
    box(entry, 'metal', [-0.33, y - 0.023, 2.116], [0.33, y + 0.023, 2.139], [0.13, 0.15, 0.12]);
  tube(entry, 'metal', [0.25, 1.15, 2.15], [0.25, 1.36, 2.15], 0.022, [0.6, 0.6, 0.5], 8);
  for (const y of [0.53, 1.93])
    box(entry, 'metal', [-0.4, y - 0.05, 2.115], [-0.27, y + 0.05, 2.158], [0.12, 0.13, 0.1]);
  for (let i = 0; i < 2; i++)
    box(
      out,
      'granite',
      [-0.65, 0, 2.16],
      [0.65, 0.28 - i * 0.14, 2.67 + i * 0.29],
      [0.43, 0.43, 0.37],
    );
  for (const a of [0.95, 2.86, 4.85]) pilsumHood(out, a, 9.38, 0.43);
  for (const a of [1.35, 2.5, 3.8, 5.15]) pilsumHood(out, a, 2.66, 0.44);
  ring(out, 'metal', 10.15, 1.9, 2.42, 0.09, pilsumRed, 160);
  for (let i = 0; i < 20; i++) {
    const a = (i * TAU) / 20;
    radialPlate(
      out,
      a,
      [
        [9.86, 2.18],
        [9.88, 2.27],
        [10.13, 2.46],
        [10.2, 2.46],
        [10.2, 2.18],
      ],
      0.07,
      'metal',
      pilsumRed,
    );
    tube(out, 'metal', P(2.41, 10.23, a), P(2.61, 10.69, a), 0.023, pilsumRed, 10);
  }
  for (const t of [0.24, 0.59, 1])
    ring(
      out,
      'metal',
      10.23 + 0.46 * t,
      2.41 + 0.2 * t - 0.014,
      2.41 + 0.2 * t + 0.015,
      0.022,
      pilsumRed,
      160,
    );
  const roof = [0.19, 0.19, 0.13];
  lathe(
    out,
    'metal',
    [
      [10.24, 2.41],
      [10.3, 2.41],
      [11.38, 0.15],
    ],
    roof,
    160,
  );
  for (let i = 0; i < 16; i++)
    line(
      out,
      [P(2.4, 10.31, (i * TAU) / 16), P(0.15, 11.39, (i * TAU) / 16)],
      roof.map((v) => v * 0.7),
      0.017,
    );
  for (let i = 0; i < 4; i++) {
    const a = ((i + 0.5) * TAU) / 4,
      r = 1.2,
      y = 10.3 + ((2.41 - r) / (2.41 - 0.15)) * 1.08,
      o = transformed(out, 0, P(r, 0, a));
    lathe(
      o,
      'metal',
      [
        [y, 0.053],
        [y + 0.13, 0.053],
        [y + 0.15, 0.092],
        [y + 0.18, 0.086],
      ],
      roof,
      24,
    );
  }
  lathe(
    out,
    'metal',
    [
      [11.36, 0.15],
      [11.48, 0.15],
      [11.56, 0.13],
    ],
    roof,
    64,
  );
  sphere(out, 'metal', [0, 11.69, 0], [0.23, 0.23, 0.23], pilsumRed, 48, 24);
  for (let i = 0; i < 24; i++) {
    const a = (i * TAU) / 24;
    line(out, [P(0.147, 11.51, a), P(0.19, 11.59, a)], dark, 0.014);
  }
  tube(out, 'metal', [0, 11.89, 0], [0, 12.45, 0], 0.011, dark, 8);
}
export const lighthouseBalticNextStudies = [
  lighthouseStudy({
    id: 'N0673',
    key: 'ruhnu_lighthouse',
    title: 'Ruhnu Lighthouse',
    wikidataId: 'Q3376563',
    build: buildRuhnu,
    metricTriangleUv: true,
    size: [10, 38.34, 10],
    visualBrief:
      'Restored dark-red riveted stair cylinder carried by four inclined tubular iron legs, with two levels of horizontal cylindrical braces, bolted footplates, small shaft windows, reinforced door and rain hood, broad service drum, two railed galleries, clear cylindrical lantern, bronze-toned dome and vane.',
    sourceFacts: {
      heightMeters: 38.34,
      focalHeightMeters: 64.7,
      appearance: 'Restored2021 exterior in municipality-supplied photographs.',
      photoApproxDimensionsMeters: {
        centralDiameter: 2.58,
        legDiameter: 0.76,
        legFootRadius: 6.04,
        mainGalleryDiameter: 6.48,
      },
      basis:
        'Current authority ATON2538 supplies38.34m height andWGS84coordinate. Municipal2021 restoration aerial and close photographs control four legs, two brace levels, bolted plate construction, eight visible shaft-port levels, door fittings and two galleries. All component diameters and heights below the published total are photo-proportioned; generic old40m catalog height is not used.',
    },
    referencePages: [
      'https://nma.transpordiamet.ee/aton/2538/',
      'https://nma.transpordiamet.ee/info_sheet/2538/en/',
      'https://www.transpordiamet.ee/ruhnu-tuletorn',
      'https://visitestonia.com/en/ruhnu-lighthouse',
      'https://visitestonia.com/images/3911370/V%C3%A4ike+formaat.jpg',
      'https://visitestonia.com/images/3911369/IMG_4954.JPG',
      'https://visitestonia.com/images/3911372/IMG_4977.JPG',
      'https://www.openstreetmap.org/way/1297215907',
    ],
    geographicProposal: {
      anchor: [23.26012233, 57.80135766],
      heading: 0,
      elevationMode: 'terrain-contact',
      groundModelY: 0,
      status: 'preview-proposal',
      source: 'https://nma.transpordiamet.ee/aton/2538/',
      notes:
        'Authority coordinate anchors the central tube. Mapped approach1297215907 ends directly south of the tower, resolving native+Z door to south. Four legs are placed symmetrically around this doorway as in the restored entry photograph. OSMcircle1297215911 is only5.7m wide and does not bound the external supporting legs, so it is not used to stretch the tower.',
    },
    limitations: [
      'Published total height and anchor are authoritative; iron-tube diameters, brace elevations and small fittings are photograph reconstructions. The centenary plaque is modeled as an unlettered cast panel because tiny text is outside useful exterior viewing scale. Detached station buildings and forest are supplied by map layers. Temporary safety signs and individual paint chips are omitted.',
    ],
    previewCamera: { position: [31, 24, 43], lookAt: [0, 18, 0], fov: 46 },
    qaCameras: [
      { name: 'near-entry-rivets', position: [3.1, 2.8, 5.4], lookAt: [0, 1.7, 1.3] },
      { name: 'near-legs-braces', position: [15, 12, 19], lookAt: [0, 12, 0] },
      { name: 'near-watch-gallery', position: [8, 31.3, 11], lookAt: [0, 31.5, 0] },
      { name: 'near-lantern', position: [5.4, 36.2, 7.1], lookAt: [0, 35.5, 0] },
      { name: 'far-silhouette', position: [40, 23, 49], lookAt: [0, 18.5, 0] },
    ],
  }),
  lighthouseStudy({
    id: 'N0674',
    key: 'ristna_lighthouse',
    title: 'Ristna Lighthouse',
    wikidataId: 'Q3376573',
    build: buildRistna,
    metricTriangleUv: true,
    size: [6.1, 27.2, 6.2],
    visualBrief:
      'Bright red concrete-jacketed stair tube with eight full-height ribs, flared foot and upper supports, three horizontal braces, expanded riveted service room with sixteen small ports, scalloped gallery brackets, close picket rail, diamond-glazed lantern and white dome/vane.',
    sourceFacts: {
      heightMeters: 27.2,
      focalHeightMeters: 35.9,
      serviceRoomDiameterMeters: 5,
      structuralRibs: 8,
      appearance:
        'Maintained red/white configuration following2026 completion of exterior restoration; no temporary scaffold.',
      basis:
        'Current ATON2844 gives27.2m height and coordinate. Lighthouse Society reproduces the National Archives1925 restoration elevation/sections, confirming eight ribs, three brace levels and service/lantern proportions. West Estonia industrial-heritage project gives5m service-room diameter. Authority2026 close photograph controls surviving details; photo-derived minor moldings remain explicit.',
    },
    referencePages: [
      'https://nma.transpordiamet.ee/aton/2844/',
      'https://www.etts.ee/tuletornide-nimekiri/ristna-tuletorn/',
      'https://www.etts.ee/wp-content/uploads/2023/09/ristna-4.jpg',
      'https://www.etts.ee/wp-content/uploads/2023/10/Ristna_tuletorn_2014.jpg',
      'https://westestonia.com/de/industrieerbe-tourismus/',
      'https://www.transpordiamet.ee/uudised/ehitustood-jatavad-ristna-tuletorni-kesksuveni-suletuks',
      'https://www.transpordiamet.ee/sites/default/files/2026-04/_MG_8067-15.jpg',
      'https://www.transpordiamet.ee/uudised/augustis-avavad-kulastajatele-uksed-kaks-uue-kuue-saanud-tuletorni',
    ],
    geographicProposal: {
      anchor: [22.05526516, 58.9400605],
      heading: 0.7853981634,
      elevationMode: 'terrain-contact',
      groundModelY: 0,
      status: 'preview-proposal',
      source: 'https://nma.transpordiamet.ee/aton/2844/',
      notes:
        'Authority coordinate fixes the tower within meters of exact-QIDnode3369819188. Native+Z doorway faces southeast, reconstructed from the2014 society aerial with western coast behind, the northern/eastern station buildings and the approach from Ristna majaka tee. This is a photographed quadrant reconstruction, not a surveyed doorway bearing; the eight-rib mass has45degree symmetry.',
    },
    limitations: [
      'Detailed exterior follows the documented post1920 concrete jacket, not the original1874 open iron frame. Published total height and5m service drum constrain a photographed/archival component reconstruction. Exact entrance azimuth and minor restored2026 vent fittings are not surveyed. Detached station buildings remain map structures.',
    ],
    previewCamera: { position: [20, 16, 28], lookAt: [0, 13, 0], fov: 45 },
    qaCameras: [
      { name: 'near-entry-ribs', position: [5, 3.8, 7.8], lookAt: [0, 2.4, 1.2] },
      { name: 'near-concrete-braces', position: [6, 12, 9], lookAt: [0, 11, 0] },
      { name: 'near-service-gallery', position: [6, 21.6, 8.5], lookAt: [0, 21.6, 0] },
      { name: 'near-lantern', position: [4.7, 25.2, 6.2], lookAt: [0, 24.8, 0] },
      { name: 'far-silhouette', position: [25, 15, 34], lookAt: [0, 13, 0] },
    ],
  }),
  lighthouseStudy({
    id: 'N0675',
    key: 'pilsum_lighthouse',
    title: 'Pilsum Lighthouse',
    wikidataId: 'Q539709',
    build: buildPilsum,
    metricTriangleUv: true,
    size: [5.25, 12.45, 5.5],
    visualBrief:
      'Seven horizontal red/yellow steel bands on a cylindrical sector lighthouse; riveted plate joints, north-northeast entrance, small barred rear windows, two broad black-framed sector windows, projecting ventilation hoods, outward leaning roof-edge railing, dark copper cone roof with mushroom vents, red ventilator ball and lightning rod.',
    sourceFacts: {
      heritageApproxStructureHeightMeters: 12,
      modelRoofBallTopMeters: 11.92,
      modelLightningTopMeters: 12.45,
      photoApproxShaftDiameterMeters: 4.4,
      bandCount: 7,
      rejectedMapHeightMeters: 65.3,
      basis:
        'Lower Saxony heritage authority states approximately12m and three storeys, and supplies a clear current exterior photograph. Local tourism quotes approximately11m; the heritage-specific architectural description controls this model. Photo proportions and commonly documented4.4m shaft width govern component scale, while OSM5.2m footprint includes the foundation. The65.3m OSMheight belongs to a different tower and is rejected.',
    },
    referencePages: [
      'https://denkmalatlas.niedersachsen.de/viewer/metadata/34661935/1/-/',
      'https://denkmalatlas.niedersachsen.de/viewer/rest/image/5e90d7a0-32d9-4dde-b4b6-ad7746d07939/52319607.jpeg/full/!1800,1800/0/default.jpg',
      'https://www.greetsiel.de/ferienregion-krummhoern/pilsumer-leuchtturm',
      'https://www.greetsiel.de/fileadmin/_processed_/6/d/csm_Foto_13.05.20__19_26_51_3cb923bae1.jpg',
      'https://www.openstreetmap.org/way/243297523',
      'https://www.openstreetmap.org/node/8949335764',
    ],
    geographicProposal: {
      anchor: [7.045705623, 53.497985478],
      heading: Math.atan2(
        (7.0457219 - 7.045705623) * Math.cos((53.497985478 * Math.PI) / 180),
        -(53.4980062 - 53.497985478),
      ),
      elevationMode: 'terrain-contact',
      groundModelY: 0,
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/node/8949335764',
      notes:
        'Exact-QIDcircleway243297523 fixes the tower center; surveyed main-entrance node8949335764 and two-stepway967353310 fix the native+Z entrance bearing north-northeast. Ground plane is the top of the dyke, with only the immediate circular plinth/door steps included. Optical window sectors are photograph-reconstructed on the seaward face; no claim of preserving historic navigational bearings.',
    },
    limitations: [
      'The heritage height is approximate and the lightning rod extends above the modeled roof/ventilator; minor window, hood, rivet and roof-vent dimensions are photo-derived. Shaft diameter and foundation are not survey measurements. Current red/yellow daymark and dark metal roof follow heritage/tourism photographs; transient scaffolding and graffiti are excluded. The separate love-lock structure and dyke terrain belong to map context.',
    ],
    previewCamera: { position: [15, 8, -16], lookAt: [0, 5.8, 0], fov: 44 },
    qaCameras: [
      { name: 'near-entry', position: [4.8, 3.2, 6.2], lookAt: [0, 1.6, 2.05] },
      { name: 'near-sector-windows', position: [5.9, 9.2, -7.1], lookAt: [0, 8.8, 0] },
      { name: 'near-roof-railing', position: [5.7, 12.2, 5.9], lookAt: [0, 10.8, 0] },
      { name: 'near-banded-plates', position: [-5.8, 5.6, -6.5], lookAt: [0, 5.4, 0] },
      { name: 'far-silhouette', position: [17, 8, -21], lookAt: [0, 6, 0] },
    ],
  }),
];
