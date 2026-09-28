/** Restored Wisłoujście Fort Carré, from museum plans, current photos and mapped walls. */

import earcut from 'earcut';
import { beam, normalFor, sphere } from './authored-structure-mesh.mjs';
import { lighthouseStudy, ring, shell } from './lighthouse-expansion-models.mjs';
import { lathe, panel, piercedFacade, railRing, transformed } from './lighthouse-models.mjs';
import { box, quad, tube } from './structure-mesh.mjs';
import plan from './wisloujscie-footprints.json' with { type: 'json' };

const brick = [0.57, 0.3, 0.19],
  salmon = [0.73, 0.32, 0.27],
  pale = [0.81, 0.82, 0.72],
  green = [0.24, 0.32, 0.2],
  iron = [0.11, 0.13, 0.12],
  roof = [0.51, 0.2, 0.14],
  timber = [0.52, 0.37, 0.22];
const P = (r, y, a) => [Math.sin(a) * r, y, Math.cos(a) * r];
const radians = (d) => (d * Math.PI) / 180;
function profileArc(out, slot, profile, color, a0 = 0, a1 = Math.PI * 2, n = 192) {
  for (let k = 1; k < profile.length; k++)
    for (let i = 0; i < n; i++) {
      const a = a0 + ((a1 - a0) * i) / n,
        b = a0 + ((a1 - a0) * (i + 1)) / n;
      const [y0, r0] = profile[k - 1],
        [y1, r1] = profile[k];
      const p = [P(r0, y0, a), P(r0, y0, b), P(r1, y1, b), P(r1, y1, a)];
      quad(out, slot, p, normalFor(...p.slice(0, 3)), color);
    }
}
function arch(out, w, y, h, z, depth, color, slot = 'brick', rise = w / 2) {
  const spring = y + h - rise,
    n = 24;
  for (let i = 0; i < n; i++) {
    const x0 = -w / 2 + (i * w) / n,
      x1 = -w / 2 + ((i + 1) * w) / n;
    const a = spring + rise * Math.sqrt(Math.max(0, 1 - ((2 * x0) / w) ** 2)),
      b = spring + rise * Math.sqrt(Math.max(0, 1 - ((2 * x1) / w) ** 2));
    quad(
      out,
      slot,
      [
        [x0, a, z],
        [x1, b, z],
        [x1, y + h + 0.015, z],
        [x0, y + h + 0.015, z],
      ],
      [0, 0, 1],
      color,
    );
    const p = [
      [x0, a, z],
      [x0, a, z - depth],
      [x1, b, z - depth],
      [x1, b, z],
    ];
    quad(out, slot, p, normalFor(...p.slice(0, 3)), color);
  }
  for (let i = 0; i < 20; i++) {
    const a = (i * Math.PI) / 20,
      b = ((i + 1) * Math.PI) / 20;
    const p = (r, t) => [Math.cos(t) * r, spring + Math.sin(t) * r, z + 0.025];
    quad(
      out,
      slot,
      [p(w / 2, a), p(w / 2 + 0.16, a), p(w / 2 + 0.16, b), p(w / 2, b)],
      [0, 0, 1],
      color.map((v) => v * 0.94),
    );
  }
}
function dividedWindow(out, x, y, w, h, z, { shutters = false, color = pale } = {}) {
  panel(out, 'glass', x - w / 2, x + w / 2, y, y + h, z, [0.15, 0.22, 0.2]);
  for (const xx of [x - w / 2, x + w / 2, x])
    box(
      out,
      'wood',
      [xx - 0.035, y - 0.045, z + 0.015],
      [xx + 0.035, y + h + 0.045, z + 0.07],
      color,
    );
  for (const yy of [y, y + h, y + h * 0.61])
    box(out, 'wood', [x - w / 2, yy - 0.035, z + 0.017], [x + w / 2, yy + 0.035, z + 0.075], color);
  for (let i = 1; i < 5; i++)
    for (const offset of [-w / 4, w / 4])
      box(
        out,
        'wood',
        [x + offset - 0.009, y + (i * h) / 5 - 0.01, z + 0.032],
        [x + offset + 0.009, y + (i * h) / 5 + 0.01, z + 0.07],
        color,
      );
  for (const offset of [-w / 4, w / 4])
    box(
      out,
      'wood',
      [x + offset - 0.012, y, z + 0.023],
      [x + offset + 0.012, y + h, z + 0.06],
      color,
    );
  for (let i = 1; i < 5; i++)
    box(
      out,
      'wood',
      [x - w / 2, y + (i * h) / 5 - 0.012, z + 0.023],
      [x + w / 2, y + (i * h) / 5 + 0.012, z + 0.06],
      color,
    );
  if (shutters)
    for (const s of [-1, 1]) {
      const cx = x + s * w * 0.8;
      box(
        out,
        'wood',
        [cx - w * 0.24, y - 0.02, z + 0.005],
        [cx + w * 0.24, y + h + 0.02, z + 0.06],
        green,
      );
      for (let i = 1; i < 5; i++)
        box(
          out,
          'wood',
          [cx - w * 0.24 + i * w * 0.096, y, z + 0.061],
          [cx - w * 0.24 + i * w * 0.096 + 0.012, y + h, z + 0.072],
          green.map((v) => v * 0.8),
        );
    }
}
/** Circular facade with cut rectangular openings, reversible for the open courtyard. */
function circularWall(
  out,
  r,
  y0,
  y1,
  holes,
  color,
  { inside = false, slot = 'brick', n = 192 } = {},
) {
  const hs = holes.map((h) => ({ ...h, a: h.a ?? 0, theta: Math.asin(h.w / (2 * r)) }));
  const ys = [...new Set([y0, y1, ...hs.flatMap((h) => [h.y, h.y + h.h])])].sort((a, b) => a - b);
  const as = [
    ...new Set([
      ...Array.from({ length: n + 1 }, (_, i) => (i * Math.PI * 2) / n),
      ...hs.flatMap((h) =>
        [h.a - h.theta, h.a + h.theta].map((a) => (a + Math.PI * 2) % (Math.PI * 2)),
      ),
    ]),
  ].sort((a, b) => a - b);
  for (let j = 1; j < ys.length; j++)
    for (let i = 1; i < as.length; i++) {
      const a = as[i - 1],
        b = as[i],
        ym = (ys[j] + ys[j - 1]) / 2,
        am = (a + b) / 2;
      if (
        hs.some(
          (h) =>
            ym > h.y &&
            ym < h.y + h.h &&
            Math.abs(Math.atan2(Math.sin(am - h.a), Math.cos(am - h.a))) < h.theta,
        )
      )
        continue;
      let p = [P(r, ys[j - 1], a), P(r, ys[j - 1], b), P(r, ys[j], b), P(r, ys[j], a)];
      let uv = [
        [a * r, ys[j - 1]],
        [b * r, ys[j - 1]],
        [b * r, ys[j]],
        [a * r, ys[j]],
      ];
      if (inside) {
        p = p.reverse();
        uv = uv.reverse();
      }
      out.addQuad(slot, 'metric:uv', p, normalFor(...p.slice(0, 3)), uv, color);
    }
  for (const h of hs) {
    const o = transformed(out, h.a + (inside ? Math.PI : 0), P(r * Math.cos(h.theta), 0, h.a));
    const depth = h.depth ?? 0.28,
      w = h.w / 2;
    for (const x of [-w, w])
      box(o, slot, [x - 0.055, h.y - 0.04, -depth], [x + 0.055, h.y + h.h + 0.04, 0.018], color);
    for (const y of [h.y, h.y + h.h])
      box(o, slot, [-w - 0.04, y - 0.035, -depth], [w + 0.04, y + 0.035, 0.018], color);
    if (h.arch) arch(o, h.w, h.y, h.h, 0.005, depth, color, slot);
    if (h.door) panel(o, 'wood', -w, w, h.y, h.y + h.h, -depth + 0.012, green);
    else if (!h.open) dividedWindow(o, 0, h.y, h.w, h.h, -depth + 0.02, { color: pale });
  }
}
function rectangleRoof(out, rx, depth, y, h, color = roof) {
  const a = [-rx, y, 0],
    b = [rx, y, 0],
    c = [0, y + h, 0],
    aa = [-rx, y, -depth],
    bb = [rx, y, -depth],
    cc = [0, y + h, -depth];
  for (const p of [
    [a, aa, cc, c],
    [c, cc, bb, b],
  ])
    quad(out, 'tiles', p, normalFor(...p.slice(0, 3)), color);
  const opening = [
      [-0.51, y + 0.55],
      [0.51, y + 0.55],
      [0.51, y + 1.6],
      [-0.51, y + 1.6],
    ],
    points = [[-rx, y], [rx, y], [0, y + h], ...opening];
  const indices = earcut(points.flat(), [3], 2);
  for (let i = 0; i < indices.length; i += 3) {
    let ps = indices.slice(i, i + 3).map((k) => [...points[k], 0]);
    if (normalFor(...ps)[2] < 0) ps = ps.toReversed();
    out.addTriangle(
      'plaster',
      'metric:uv',
      ps,
      [0, 0, 1],
      ps.map((p) => [p[0], p[1]]),
      salmon,
    );
  }
  for (let i = 0; i < opening.length; i++) {
    const a = opening[i],
      b = opening[(i + 1) % opening.length],
      ps = [
        [...a, 0],
        [...a, -0.28],
        [...b, -0.28],
        [...b, 0],
      ];
    quad(out, 'plaster', ps, normalFor(...ps.slice(0, 3)), salmon);
  }
}
function ringAndHouses(out) {
  const outer = 17.05,
    inner = 12.25;
  const topHoles = Array.from({ length: 16 }, (_, i) => ({
    a: radians(-42) + (i * Math.PI) / 8,
    y: 8.83,
    w: 1.07,
    h: 1.51,
    arch: true,
    depth: 0.65,
    open: true,
  }));
  circularWall(out, outer, 0, 11.32, topHoles, brick);
  const innerHoles = Array.from({ length: 20 }, (_, i) => ({
    a: (i * Math.PI) / 10,
    y: i % 5 === 0 ? 0.08 : 0.86,
    w: i % 5 === 0 ? 1.07 : 0.93,
    h: i % 5 === 0 ? 2.54 : 1.36,
    arch: i % 3 === 0,
    door: i % 5 === 0,
    depth: 0.31,
  }));
  circularWall(out, inner, 0, 6.36, innerHoles, brick, { inside: true });
  ring(out, 'wood', 6.33, inner - 0.13, 16.38, 0.17, timber, 192);
  for (let i = 0; i < 32; i++) {
    const a = (i * Math.PI) / 16,
      b = ((i + 1) * Math.PI) / 16;
    const o = transformed(out, a, P(inner - 0.06, 0, a));
    box(o, 'wood', [-0.11, 6.5, -0.11], [0.11, 10.39, 0.11], timber);
    for (const y of [6.89, 7.24, 7.62])
      beam(out, 'wood', P(inner - 0.07, y, a), P(inner - 0.07, y, b), 0.075, 0.09, timber);
    beam(o, 'wood', [-0.04, 8.96, 0], [1.02, 10.15, 0], 0.15, 0.15, timber);
    beam(o, 'wood', [0.04, 8.96, 0], [-1.02, 10.15, 0], 0.15, 0.15, timber);
    beam(out, 'wood', P(inner - 0.22, 10.41, a), P(17.5, 12.18, a), 0.15, 0.19, timber);
  }
  // Restored shed roof over the open timber gallery, sloping into the courtyard.
  profileArc(
    out,
    'tiles',
    [
      [12.23, 17.47],
      [10.45, 11.85],
    ],
    roof,
  );
  profileArc(
    out,
    'wood',
    [
      [10.31, 11.85],
      [12.09, 17.47],
    ],
    timber,
  );
  ring(out, 'wood', 10.3, 11.73, 12.01, 0.15, timber, 192);
  ring(out, 'brick', 11.29, 16.6, 17.31, 0.16, brick, 192);
  for (let i = 0; i < 72; i++)
    box(
      transformed(out, (i * Math.PI) / 36),
      'limestone',
      [-0.16, 10.86, 17.03],
      [0.16, 11.31, 17.26],
      pale,
    );
  // Ten distinct radial officer-house bays; the larger commander house occupies the southwest arc.
  for (let i = 0; i < 10; i++) {
    const a = radians(30.5 + i * 12.75),
      r = 21.73,
      half = 2.39;
    const o = transformed(out, a, P(r, 0, a));
    const small = i % 2 === 1;
    const holes = [
      { x: -0.7, y: 0.58, w: 1.37, h: 1.57 },
      { x: 1.48, y: 0.06, w: 0.76, h: 2.13 },
      { x: small ? -0.56 : 0, y: 3.89, w: small ? 1.37 : 1.66, h: 1.92 },
    ];
    if (small) holes.push({ x: 1.52, y: 4.2, w: 0.57, h: 1.29 });
    piercedFacade(o, {
      half,
      y0: 0,
      y1: 6.8,
      z: 0,
      holes: holes.map((h) => ({ ...h, trim: 0 })),
      slot: 'plaster',
      color: salmon,
    });
    for (const h of holes) {
      if (h.y < 0.1) {
        panel(o, 'wood', h.x - h.w / 2, h.x + h.w / 2, h.y, h.y + h.h, -0.26, iron);
        for (const xx of [h.x - h.w / 2 - 0.08, h.x + h.w / 2 + 0.08])
          box(o, 'limestone', [xx - 0.055, h.y, -0.01], [xx + 0.055, h.y + h.h + 0.08, 0.08], pale);
      } else dividedWindow(o, h.x, h.y, h.w, h.h, -0.24, { shutters: h.y < 2 });
      box(
        o,
        'limestone',
        [h.x - h.w / 2 - 0.1, h.y - 0.09, -0.06],
        [h.x + h.w / 2 + 0.1, h.y + 0.02, 0.12],
        pale,
      );
    }
    rectangleRoof(o, half, 5.22, 6.8, 3.33);
    dividedWindow(o, 0, 7.35, 1.02, 1.05, -0.24);
    for (const s of [-1, 1])
      box(o, 'plaster', [s * half - 0.05, 0, -5.22], [s * half + 0.05, 6.8, -0.015], salmon);
    for (const s of [-1, 1]) {
      beam(o, 'limestone', [s * half, 6.8, 0.035], [0, 10.13, 0.035], 0.12, 0.16, pale);
      box(o, 'limestone', [s * half - 0.15, 6.57, -0.1], [s * half + 0.15, 6.84, 0.23], pale);
    }
    box(o, 'limestone', [-0.12, 9.77, -0.08], [0.12, 10.55, 0.18], pale);
    tube(o, 'metal', [0, 10.55, 0.05], [0, 11.22, 0.05], 0.024, iron, 8);
    sphere(o, 'metal', [0, 10.94, 0.05], [0.07, 0.07, 0.07], iron, 12, 8);
    for (const x of [-half + 0.09])
      tube(o, 'metal', [x, 0.16, 0.095], [x, 6.77, 0.095], 0.046, [0.33, 0.31, 0.25], 10);
    const chimney = transformed(out, a - radians(6.2), P(17.59, 0, a - radians(6.2)));
    box(chimney, 'brick', [-0.29, 7.9, -0.25], [0.29, 12.6, 0.25], [0.6, 0.4, 0.26]);
    box(chimney, 'brick', [-0.35, 12.56, -0.31], [0.35, 12.75, 0.31], brick);
  }
  // Curved commander-house facade with four broad modules and a higher hipped roof.
  const lo = radians(-42),
    hi = radians(24),
    r = 21.87;
  const section = transformed(out, 0);
  const commanderHoles = [];
  for (let i = 0; i < 8; i++) {
    const a = lo + ((hi - lo) * (i + 0.5)) / 8;
    commanderHoles.push({ a, y: 0.65, w: 1.12, h: 1.6 }, { a, y: 3.94, w: 1.17, h: 1.86 });
  }
  // Suppress all other circle sectors: build exact selected arc facade via clipping wrapper.
  const clipped = Object.create(section);
  clipped.addQuad = (slot, ref, ps, n, uv, color) => {
    const c = ps.reduce((s, p) => [s[0] + p[0], s[1] + p[2]], [0, 0]);
    const a = Math.atan2(c[0], c[1]);
    if (a >= lo - 0.03 && a <= hi + 0.03) section.addQuad(slot, ref, ps, n, uv, color);
  };
  circularWall(clipped, r, 0, 6.8, commanderHoles, salmon, { slot: 'plaster' });
  profileArc(
    out,
    'tiles',
    [
      [6.85, 22.17],
      [9.89, 18.52],
      [10.02, 17.02],
    ],
    roof,
    lo,
    hi,
    80,
  );
  for (const a of [lo, hi]) {
    const ps = [
      P(21.87, 0, a),
      P(17.04, 0, a),
      P(17.04, 10.01, a),
      P(18.52, 9.89, a),
      P(22.17, 6.85, a),
    ];
    if (a === hi) ps.reverse();
    out.addConvexPolygon(
      'plaster',
      'palette:#fff',
      ps,
      normalFor(...ps.slice(0, 3)),
      () => [0, 0],
      salmon,
    );
  }
  const portal = transformed(out, radians(-9), P(22.08, 0, radians(-9)));
  box(portal, 'limestone', [-1.39, 0, -1.4], [1.39, 0.52, 1.95], pale);
  for (let i = 0; i < 5; i++)
    box(
      portal,
      'limestone',
      [-1.05, i * 0.14, 1.82 - i * 0.25],
      [1.05, (i + 1) * 0.14, 2.08 - i * 0.25],
      pale,
    );
  for (const x of [-1.15, 1.15]) {
    box(portal, 'limestone', [x - 0.12, 0.52, -0.04], [x + 0.12, 3.46, 0.25], pale);
    box(portal, 'limestone', [x - 0.2, 3.3, -0.1], [x + 0.2, 3.56, 0.33], pale);
  }
  box(portal, 'limestone', [-1.51, 3.57, -0.26], [1.51, 3.78, 1.24], pale);
  for (let i = 0; i < 10; i++)
    box(portal, 'limestone', [-1.35 + i * 0.3, 3.78, 1.07], [-1.25 + i * 0.3, 4.56, 1.2], pale);
  box(portal, 'limestone', [-1.51, 4.55, 0.97], [1.51, 4.68, 1.28], pale);
}

function tower(out) {
  const doorway = radians(-28),
    r = 3.86;
  const holes = [
    {
      angle: doorway,
      y: 0.03,
      w: 1.61,
      h: 2.86,
      depth: 0.6,
      trimSlot: 'limestone',
      trimColor: pale,
    },
  ];
  for (let i = 0; i < 8; i++)
    for (const y of [7.1, 11.7, 16.4, 20.3])
      holes.push({
        angle: (i * Math.PI) / 4,
        y: y + (i % 2) * 0.28,
        w: 0.31,
        h: 0.86,
        depth: 0.43,
        trimSlot: 'plaster',
        trimColor: pale,
      });
  shell(out, {
    profile: [
      [0, r],
      [6.27, r],
      [22.93, 3.71],
    ],
    holes,
    slot: 'plaster',
    color: (y) => (y < 6.27 ? brick : pale),
    segments: 192,
  });
  // Exposed lower brick replaces painted plaster while preserving the real openings.
  circularWall(
    out,
    r + 0.006,
    0,
    6.27,
    [{ a: doorway, y: 0.03, w: 1.61, h: 2.86, door: true, arch: true, depth: 0.63 }],
    brick,
  );
  ring(out, 'brick', 22.9, 3.12, 3.78, 0.18, brick, 160);
  lathe(
    out,
    'concrete',
    [
      [21.79, 3.13],
      [21.88, 3.13],
    ],
    [0.39, 0.4, 0.34],
    128,
  );
  railRing(out, 21.88, 3.13, 1.12, iron, 48);
  // Stone top merlon/embrasure details remain low, as in the current restored tower.
  for (let i = 0; i < 12; i++)
    box(
      transformed(out, (i * Math.PI) / 6),
      'limestone',
      [-0.11, 22.17, 3.72],
      [0.11, 23.1, 3.82],
      pale,
    );
  const o = transformed(out, doorway, P(r + 0.04, 0, doorway));
  arch(o, 1.61, 0.03, 2.86, 0.014, 0.6, pale, 'limestone');
  // Reconstructed cartouche: central plaque, scrolling frame, drapes and crown relief.
  box(o, 'metal', [-0.68, 3.38, 0.07], [0.68, 5.6, 0.105], [0.105, 0.13, 0.14]);
  for (const x of [-0.85, 0.85])
    beam(o, 'limestone', [x, 3.28, 0.09], [x * 0.87, 5.7, 0.09], 0.17, 0.2, pale);
  for (const y of [3.21, 5.73]) box(o, 'limestone', [-1.13, y, 0.02], [1.13, y + 0.16, 0.24], pale);
  for (const s of [-1, 1]) {
    sphere(o, 'limestone', [s * 0.95, 3.48, 0.16], [0.28, 0.3, 0.1], pale, 24, 12);
    sphere(o, 'limestone', [s * 0.81, 5.58, 0.19], [0.16, 0.16, 0.07], pale, 20, 10);
    for (let j = 0; j < 4; j++)
      beam(
        o,
        'metal',
        [s * (0.93 + j * 0.045), 4.18 + j * 0.16, 0.05],
        [s * (1.16 + j * 0.025), 5.3 - j * 0.1, 0.05],
        0.065,
        0.06,
        [0.49, 0.24, 0.23],
      );
  }
  sphere(o, 'limestone', [0, 6.1, 0.11], [0.23, 0.27, 0.1], pale, 24, 12);
  for (const s of [-1, 1])
    beam(
      o,
      'metal',
      [s * 0.08, 5.94, 0.18],
      [s * 0.43, 6.31, 0.18],
      0.033,
      0.044,
      [0.55, 0.43, 0.14],
    );
  tube(out, 'metal', P(3.48, 22.5, doorway), P(3.48, 27.43, doorway), 0.031, [0.6, 0.61, 0.56], 12);
  const flag = transformed(out, doorway, P(3.48, 0, doorway));
  for (const [y, c] of [
    [25.98, [0.79, 0.015, 0.035]],
    [26.56, [0.91, 0.92, 0.88]],
  ]) {
    const p = [
      [0, y, 0],
      [1.52, y + 0.16, 0.18],
      [1.55, y + 0.73, 0.12],
      [0, y + 0.58, 0],
    ];
    quad(flag, 'canvas', p, normalFor(...p.slice(0, 3)), c);
    quad(flag, 'canvas', p.toReversed(), normalFor(...p.toReversed().slice(0, 3)), c);
  }
}
function pathWalls(out, pts, bottom, top, slot, color, thickness = 0.6) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1],
      b = pts[i],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz);
    if (len < 0.03) continue;
    beam(
      out,
      slot,
      [a[0], (bottom + top) / 2, a[1]],
      [b[0], (bottom + top) / 2, b[1]],
      thickness,
      top - bottom,
      color,
    );
  }
}
function cleanLoop(points) {
  const p = points.slice();
  if (Math.hypot(p[0][0] - p.at(-1)[0], p[0][1] - p.at(-1)[1]) < 0.01) p.pop();
  return p;
}
function pointIn(poly, p) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
function flatPolygon(out, slot, points, y, color, holes = []) {
  const outer = cleanLoop(points),
    hs = holes.map(cleanLoop),
    all = [...outer, ...hs.flat()],
    starts = [];
  let offset = outer.length;
  for (const h of hs) {
    starts.push(offset);
    offset += h.length;
  }
  const indices = earcut(all.flat(), starts, 2);
  for (let i = 0; i < indices.length; i += 3) {
    let p = indices.slice(i, i + 3).map((k) => [all[k][0], y, all[k][1]]);
    if (normalFor(...p)[1] < 0) p = p.toReversed();
    out.addTriangle(
      slot,
      'metric:uv',
      p,
      [0, 1, 0],
      p.map((v) => [v[0], v[2]]),
      color,
    );
  }
}
function fortGate(out) {
  const anchor = [60.0987, 0, 45.3311],
    angle = Math.atan2(0.905, 0.425);
  const o = transformed(out, angle, anchor),
    stone = [0.58, 0.48, 0.39],
    gray = [0.49, 0.51, 0.46];
  piercedFacade(o, {
    half: 4.18,
    y0: 0,
    y1: 5.06,
    z: 0.61,
    holes: [{ x: 0, y: 0.03, w: 3.96, h: 4.1, depth: 0.94, trim: 0 }],
    slot: 'limestone',
    color: stone,
  });
  arch(o, 3.96, 0.03, 4.1, 0.635, 0.94, stone, 'limestone');
  panel(o, 'wood', -1.98, 1.98, 0.02, 4.15, -0.29, [0.34, 0.22, 0.14]);
  for (let i = 0; i < 22; i++)
    box(
      o,
      'wood',
      [-1.97 + i * 0.18, 0.05, -0.276],
      [-1.955 + i * 0.18, 4.11, -0.26],
      [0.23, 0.16, 0.1],
    );
  for (const x of [-0.05, 0.05])
    box(o, 'metal', [x - 0.019, 0.05, -0.245], [x + 0.019, 4.06, -0.222], iron);
  for (const y of [0.67, 1.72, 2.78])
    for (const s of [-1, 1]) {
      box(
        o,
        'metal',
        [s < 0 ? -1.91 : 0.11, y, -0.235],
        [s < 0 ? -0.11 : 1.91, y + 0.075, -0.2],
        iron,
      );
      for (let i = 0; i < 7; i++)
        sphere(
          o,
          'metal',
          [s * (0.2 + i * 0.25), y + 0.04, -0.187],
          [0.02, 0.02, 0.012],
          iron,
          8,
          6,
        );
    }
  // Alternating rose and gray rustication is explicit relief around the real arched opening.
  for (let row = 0; row < 10; row++)
    for (const s of [-1, 1]) {
      const y = row * 0.5,
        x = s * 3.08,
        c = row % 2 ? gray : stone;
      box(
        o,
        'limestone',
        [x - 1.04, y + 0.025, 0.63],
        [x + 1.04, y + 0.485, row % 2 ? 0.86 : 0.78],
        c,
      );
      if (row % 2 === 0)
        box(o, 'limestone', [x - 0.025, y + 0.03, 0.77], [x + 0.025, y + 0.48, 0.8], gray);
    }
  for (let i = 0; i < 13; i++) {
    const a = (i * Math.PI) / 13,
      b = ((i + 1) * Math.PI) / 13;
    const point = (r, t, z) => [Math.cos(t) * r, 2.15 + Math.sin(t) * r, z];
    const ps = [
      point(1.98, a, 0.67),
      point(2.37, a, 0.76),
      point(2.37, b, 0.76),
      point(1.98, b, 0.67),
    ];
    quad(o, 'limestone', ps, normalFor(...ps.slice(0, 3)), i % 2 ? gray : stone);
  }
  for (const [y, w, z, h] of [
    [5.01, 4.29, 0.95, 0.16],
    [5.18, 4.42, 1.06, 0.23],
    [5.42, 4.29, 0.99, 0.14],
  ])
    box(o, 'limestone', [-w, y, -0.1], [w, y + h, z], stone);
  for (const s of [-1, 1]) {
    box(o, 'limestone', [s * 3.18 - 0.29, 4.57, 0.82], [s * 3.18 + 0.29, 4.98, 1.01], gray);
    sphere(o, 'limestone', [s * 3.18, 4.39, 0.84], [0.27, 0.36, 0.14], gray, 24, 12);
  }
  // Inner mouth of the mapped vaulted gate passage.
  const inside = transformed(out, -Math.PI / 2, [32.4, 0, 44.4]);
  piercedFacade(inside, {
    half: 2.48,
    y0: 0,
    y1: 3.8,
    z: 0,
    holes: [{ x: 0, y: 0.03, w: 2.82, h: 2.96, depth: 1.2, trim: 0 }],
    slot: 'brick',
    color: brick,
  });
  arch(inside, 2.82, 0.03, 2.96, 0.02, 1.2, brick);
  panel(inside, 'wood', -1.41, 1.41, 0.03, 2.99, -1.17, [0.035, 0.03, 0.024]);
}
function ancillaryBuildings(out) {
  // Exact irregular footprint of the long two-storey barracks against the southeastern rampart.
  const points = cleanLoop(plan.features['185876662'].outline),
    center = points.reduce(
      (s, p) => [s[0] + p[0] / points.length, s[1] + p[1] / points.length],
      [0, 0],
    );
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.1) continue;
    let angle = Math.atan2(b[1] - a[1], -(b[0] - a[0]));
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (Math.sin(angle) * (mid[0] - center[0]) + Math.cos(angle) * (mid[1] - center[1]) < 0)
      angle += Math.PI;
    const o = transformed(out, angle, [mid[0], 0, mid[1]]),
      count = Math.floor(len / 3.6),
      holes = [];
    if (len > 6)
      for (let j = 0; j < count; j++)
        for (const y of [0.68, 3.16])
          holes.push({
            x: ((j + 0.5) / count - 0.5) * len,
            y,
            w: 0.87,
            h: 1.15,
            trim: 0,
            depth: 0.28,
          });
    piercedFacade(o, { half: len / 2, y0: 0, y1: 5.53, z: 0, holes, slot: 'brick', color: brick });
    for (const h of holes) dividedWindow(o, h.x, h.y, h.w, h.h, -0.23, { color: green });
    box(o, 'limestone', [-len / 2, 5.48, -0.16], [len / 2, 5.68, 0.17], [0.57, 0.55, 0.47]);
  }
  flatPolygon(out, 'metal', points, 5.62, [0.29, 0.3, 0.28]);
  const a = [37.3, 41.9],
    b = [53.1, 0.6];
  for (let i = 0; i < 8; i++) {
    const t = (i + 0.5) / 8,
      x = a[0] + (b[0] - a[0]) * t,
      z = a[1] + (b[1] - a[1]) * t;
    const o = transformed(out, Math.atan2(b[0] - a[0], b[1] - a[1]), [x, 0, z]);
    box(o, 'brick', [-0.32, 5.55, -0.32], [0.32, 6.81, 0.32], brick);
    box(o, 'limestone', [-0.41, 6.76, -0.41], [0.41, 6.94, 0.41], pale);
    for (const x of [-0.15, 0.15])
      for (const z of [-0.15, 0.15])
        box(o, 'metal', [x - 0.075, 6.941, z - 0.075], [x + 0.075, 6.95, z + 0.075], iron);
  }
  const shed = cleanLoop(plan.features['185876646'].outline);
  pathWalls(out, [...shed, shed[0]], 0, 2.74, 'brick', brick, 0.34);
  flatPolygon(out, 'tiles', shed, 2.81, roof);
}
function clipSurface(poly, fn) {
  const result = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      fa = fn(a),
      fb = fn(b);
    if (fa >= 0) result.push(a);
    if (fa >= 0 !== fb >= 0) {
      const t = fa / (fa - fb);
      result.push(a.map((v, j) => v + (b[j] - v) * t));
    }
  }
  return result;
}
function terrainRing(out, outer, inner, outerY, innerY, holes = [], doorway = false) {
  const rings = [cleanLoop(outer), cleanLoop(inner), ...holes.map(cleanLoop)],
    all = rings.flat(),
    starts = [];
  let off = rings[0].length;
  for (const ring of rings.slice(1)) {
    starts.push(off);
    off += ring.length;
  }
  const indices = earcut(all.flat(), starts, 2),
    topEnd = rings[0].length + rings[1].length;
  const height = (k) => (k < rings[0].length ? outerY : k < topEnd ? innerY : 3.1);
  for (let i = 0; i < indices.length; i += 3) {
    let ps = indices.slice(i, i + 3).map((k) => [all[k][0], height(k), all[k][1]]);
    if (normalFor(...ps)[1] < 0) ps = ps.toReversed();
    let pieces = [ps];
    if (doorway) {
      const angle = Math.atan2(0.905, 0.425),
        c = Math.cos(angle),
        s = Math.sin(angle);
      const localX = (p) => (p[0] - 60.0987) * c - (p[2] - 45.3311) * s;
      const localZ = (p) => (p[0] - 60.0987) * s + (p[2] - 45.3311) * c;
      let remainder = ps;
      pieces = [];
      // Actual recessed portal volume, bounded behind its closed timber leaves.
      for (const fn of [
        (p) => localX(p) + 2.03,
        (p) => 2.03 - localX(p),
        (p) => localZ(p) + 1.1,
        (p) => 0.4 - localZ(p),
      ]) {
        const outside = clipSurface(remainder, (p) => -fn(p));
        if (outside.length >= 3) pieces.push(outside);
        remainder = clipSurface(remainder, fn);
        if (remainder.length < 3) break;
      }
    }
    for (const poly of pieces)
      for (let j = 1; j < poly.length - 1; j++) {
        ps = [poly[0], poly[j], poly[j + 1]];
        const ab = ps[1].map((v, k) => v - ps[0][k]),
          ac = ps[2].map((v, k) => v - ps[0][k]);
        if (
          Math.hypot(
            ab[1] * ac[2] - ab[2] * ac[1],
            ab[2] * ac[0] - ab[0] * ac[2],
            ab[0] * ac[1] - ab[1] * ac[0],
          ) < 1e-7
        )
          continue;
        out.addTriangle(
          'ground',
          'metric:uv',
          ps,
          normalFor(...ps),
          ps.map((p) => [p[0], p[2]]),
          [0.38, 0.43, 0.23],
        );
      }
  }
}
function bastions(out) {
  const f = plan.features,
    // The shoreline includes the low moat ledge and approach. Earth above the
    // rampart starts at the retaining wall, otherwise it buries the gateway.
    outer = f['640670274'].outline,
    top = f['640670272'].outline,
    inner = f['640670279'].outline;
  const wall = f['640670274'].outline;
  // Leave the mapped gateway opening; its arched stone portal is authored separately.
  for (const run of [wall.slice(0, 37), wall.slice(38)]) {
    pathWalls(out, run, -4.35, 2.45, 'brick', brick, 1.1);
    pathWalls(out, run, 2.42, 2.59, 'limestone', [0.6, 0.61, 0.52], 1.2);
  }
  pathWalls(out, f['640670274'].outline, -4.35, -2.85, 'rubble', [0.49, 0.47, 0.38], 1.17);
  // Concave bastions require actual polygon triangulation; radial fans jump across the flanks.
  const court = [
    [2, -34],
    [39, -21],
    [48, -1],
    [58, 10],
    [45, 44],
    [24, 57],
    [-27, 38],
    [-29, 9],
    [-17, -22],
  ];
  const gunWells = [];
  for (let id = 640670258; id <= 640670270; id++) {
    const p = f[id]?.outline;
    if (!p || p.length < 4) continue;
    const q = cleanLoop(p);
    if (q.every((p) => pointIn(outer, p) && !pointIn(top, p))) gunWells.push(q);
  }
  terrainRing(out, outer, top, 2.58, 4.23, gunWells, true);
  terrainRing(out, top, inner, 4.23, 4.23);
  terrainRing(out, inner, court, 4.23, 0);
  flatPolygon(out, 'ground', court, -0.02, [0.57, 0.55, 0.43]);
  for (const p of gunWells) {
    pathWalls(out, [...p, p[0]], 1.03, 3.16, 'brick', brick, 0.27);
    flatPolygon(out, 'ground', p, 1.02, [0.2, 0.21, 0.15]);
    pathWalls(out, [...p, p[0]], 3.15, 3.24, 'limestone', [0.54, 0.56, 0.48], 0.33);
  }
  for (const [id, v] of Object.entries(f)) {
    if (v.tags?.man_made !== 'ventilation_shaft') continue;
    const p = cleanLoop(v.outline),
      pCount = p.length,
      c = p.reduce((s, p) => [s[0] + p[0] / pCount, s[1] + p[1] / pCount], [0, 0]);
    const r = Math.max(...p.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1]))),
      o = transformed(out, 0, [c[0], 0, c[1]]);
    const y = pointIn(inner, c) ? 0 : 4.23;
    if (p.length > 8) {
      lathe(
        o,
        'limestone',
        [
          [y, r * 0.93],
          [y + 0.62, r * 0.93],
        ],
        [0.69, 0.67, 0.56],
        48,
      );
      ring(o, 'metal', y + 0.61, r * 0.59, r * 0.99, 0.11, [0.39, 0.24, 0.16], 48);
      for (let i = 0; i < 5; i++)
        beam(
          o,
          'metal',
          [-r * 0.58 + i * r * 0.29, y + 0.74, -r * 0.48],
          [-r * 0.58 + i * r * 0.29, y + 0.74, r * 0.48],
          0.05,
          0.06,
          iron,
        );
    } else {
      pathWalls(out, [...p, p[0]], y, y + 0.38, 'brick', brick, 0.17);
      flatPolygon(out, 'metal', p, y + 0.4, [0.42, 0.34, 0.25]);
    }
    void id;
  }
  for (const id of ['640670276', '640670277', '640670278', '1421973361'])
    pathWalls(out, f[id].outline, 0, 3.5, 'brick', brick, 0.52);
  // Actual mapped bridge spans the eastern moat, with narrow railings and four pile pairs.
  const bp = f['640674957'].outline,
    center = bp.slice(0, -1).reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4], [0, 0]);
  const edge = [bp[1][0] - bp[0][0], bp[1][1] - bp[0][1]],
    len = Math.hypot(...edge),
    a = Math.atan2(edge[0], edge[1]);
  const o = transformed(out, a, [center[0], 0, center[1]]),
    width = Math.hypot(bp[2][0] - bp[1][0], bp[2][1] - bp[1][1]);
  // The bridge is wider than its lifting leaf is long: mapped road way39965892 resolves the axis.
  const bridge = o,
    L = len,
    W = width;
  box(bridge, 'wood', [-W / 2, -0.43, -L / 2], [W / 2, 0.03, L / 2], timber);
  for (let z = -L / 2 + 0.13; z < L / 2; z += 0.27)
    box(
      bridge,
      'wood',
      [-W / 2, 0.031, z],
      [W / 2, 0.05, z + 0.04],
      timber.map((v) => v * 0.87),
    );
  for (const x of [-W / 2, W / 2]) {
    for (let z = -L / 2; z <= L / 2; z += 1.3)
      box(bridge, 'wood', [x - 0.06, -0.12, z - 0.06], [x + 0.06, 0.99, z + 0.06], timber);
    for (const y of [0.41, 0.94])
      beam(bridge, 'wood', [x, y, -L / 2], [x, y, L / 2], 0.08, 0.1, timber);
  }
  for (let z = -L * 0.34; z < L * 0.45; z += L * 0.23)
    for (const x of [-W * 0.37, W * 0.37])
      box(
        bridge,
        'wood',
        [x - 0.16, -4.3, z - 0.16],
        [x + 0.16, -0.42, z + 0.16],
        timber.map((v) => v * 0.63),
      );
  // Photo-documented twin timber balance beams, struts, pivot caps and lifting chains.
  for (const x of [-W * 0.43, W * 0.43]) {
    box(
      bridge,
      'wood',
      [x - 0.18, -0.1, -L * 0.4 - 0.18],
      [x + 0.18, 4.75, -L * 0.4 + 0.18],
      [0.4, 0.23, 0.14],
    );
    beam(bridge, 'wood', [x, 0.12, -L * 0.49], [x, 3.41, -L * 0.19], 0.19, 0.2, [0.4, 0.23, 0.14]);
    beam(bridge, 'wood', [x, 4.72, -L * 0.87], [x, 4.91, L * 0.49], 0.2, 0.31, [0.4, 0.23, 0.14]);
    tube(bridge, 'metal', [x - 0.25, 4.69, -L * 0.4], [x + 0.25, 4.69, -L * 0.4], 0.095, iron, 16);
    tube(bridge, 'metal', [x, 4.9, L * 0.45], [x, 0.12, L * 0.45], 0.019, iron, 8);
    for (let y = 0.18; y < 4.85; y += 0.11) {
      const points = [];
      for (let j = 0; j < 8; j++) {
        const a = (j * Math.PI) / 4;
        points.push([x + Math.cos(a) * 0.035, y + Math.sin(a) * 0.06, L * 0.45]);
      }
      for (let j = 0; j < 8; j++)
        tube(bridge, 'metal', points[j], points[(j + 1) % 8], 0.009, iron, 6);
    }
  }
  beam(
    bridge,
    'wood',
    [-W * 0.45, 4.58, -L * 0.4],
    [W * 0.45, 4.58, -L * 0.4],
    0.24,
    0.24,
    [0.4, 0.23, 0.14],
  );
  // The wooden leaf connects cobbled causeways on either side of the narrow moat opening.
  for (const id of ['39965893', '304439880']) causeway(out, f[id].outline, 5.7);
  const approach = f['174765668'].outline;
  causeway(out, [approach[1], approach[2]], 5.7);
}
function causeway(out, points, width) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz),
      o = transformed(out, Math.atan2(dx, dz), [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2]);
    box(o, 'rubble', [-width / 2, -4.2, -len / 2], [width / 2, -0.12, len / 2], [0.42, 0.4, 0.31]);
    box(
      o,
      'ground',
      [-width / 2, -0.12, -len / 2],
      [width / 2, 0.035, len / 2],
      [0.58, 0.55, 0.46],
    );
    for (const x of [-width / 2, width / 2]) {
      for (let z = -len / 2; z < len / 2; z += 2.1)
        box(o, 'metal', [x - 0.038, -0.04, z - 0.038], [x + 0.038, 0.91, z + 0.038], iron);
      for (const y of [0.43, 0.9])
        beam(o, 'metal', [x, y, -len / 2], [x, y, len / 2], 0.045, 0.045, iron);
    }
  }
}
export function buildWisloujscie(out) {
  bastions(out);
  fortGate(out);
  ancillaryBuildings(out);
  ringAndHouses(out);
  tower(out);
}

export const wisloujscieStudies = [
  lighthouseStudy({
    id: 'N0666',
    key: 'wis_oujscie_fortress',
    title: 'Wisłoujście Fortress',
    wikidataId: 'Q1409002',
    build: buildWisloujscie,
    size: [210, 32, 220],
    smoothNormalSlots: ['trim'],
    previewGroundY: -4.5,
    previewCamera: { position: [123, 112, 132], lookAt: [13, 4, 15], fov: 46 },
    visualBrief:
      'Current restored Fort Carré: mapped four-bastion brick enclosure, pierced gun wells and ventilation shafts, white-over-brick flat-topped watchtower with cartouche, open circular timber gallery under its restored tile roof, ten salmon gabled officers’ houses, curved commander house and balcony, inner barracks, rusticated arched gate and timber balance-beam drawbridge with causeways.',
    sourceFacts: {
      towerHeightMeters: 23,
      historicRingDiameterMeters: 31,
      currentMappedRingDiameterApproxMeters: 34,
      towerDiameterMappedMeters: 7.7,
      exteriorReconstruction:
        'Mapped bastion/gun-well/vent/ancillary-building plans and the museum panorama govern the wider compound. The bridge is a short, broad lifting leaf: mapped road way39965892 controls its axis rather than assuming the longest rectangle edge is longitudinal. Gate rustication, portal voussoirs, gallery joinery and drawbridge balance arms follow museum close photographs.',
      basis:
        'Museum2020 architectural brief gives23m restored tower, historic31m ring, ten gabled officers’ houses and four-module commander house. Posted1:100 ground/upper floor plans and developed elevations govern bay sequence and gallery structure. Current2023 museum photographs govern white tower, salmon walls, green joinery and reconstructed timber gallery roof. Exact mapped tower and Fort Carré wall/earthwork paths govern ground dimensions; the current mapped ring is wider than the historical31m description.',
    },
    referencePages: [
      'https://bip.muzeumgdansk.pl/en/zamowienia-publiczne/zamowienia-do-ktorych-nie-stosuje-sie-przepisow-prawa-zamowien-publicznych/szczegoly-zamowienia/news/muzeum-gdanska-prosi-o-przygotowanie-oferty-na-badania-architektoniczne-twierdzy-wisloujscie/',
      'https://bip.muzeumgdansk.pl/fileadmin/user_upload/zal1._Rzut_parteru.pdf',
      'https://bip.muzeumgdansk.pl/fileadmin/user_upload/zal2._Rzut_baszty_i_wienca.pdf',
      'https://bip.muzeumgdansk.pl/fileadmin/user_upload/zal3._Rzut_dzialobitni_i_elewacje.pdf',
      'https://media.muzeumgdansk.pl/komunikaty/817511/nowe-oblicze-twierdzy-wisloujscie',
      'https://wirtualne.muzeumgdansk.pl/oddzialy/twierdza-wisloujscie',
      'https://www.openstreetmap.org/way/640670283',
      'https://www.openstreetmap.org/way/640670274',
      'https://www.openstreetmap.org/way/640674957',
      'https://www.openstreetmap.org/way/39965892',
      'https://www.openstreetmap.org/way/185876662',
      'https://www.openstreetmap.org/relation/19455901',
    ],
    geographicProposal: {
      anchor: plan.anchor,
      heading: 0,
      elevationMode: 'terrain-contact',
      groundModelY: 0,
      groundContactReviewed: true,
      groundContactBasis:
        'The museum ground-floor plan and exterior photographs distinguish the occupied courtyard and gate threshold from moat-facing retaining foundations. ModelY0 is the courtyard and gate threshold; the negative4.35m lower walls are intentional below-courtyard geometry, not an origin error.',
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/way/640670283',
      notes:
        'Origin is the actual tower circle, with +X east and +Z south. Exact mapped bastion paths and house arc establish world orientation; the commander house is southwest and the bridge southeast. Courtyard contact is modelY0; retaining walls descend4.35m toward the moat. This wider compound should suppress underlying mapped duplicate buildings. Host water and terrain supply the moat and surrounding island.',
    },
    limitations: [
      'Model scope is Fort Carré and its eastern bridge; detached buildings and the outer seventeen-hectare eastern earthworks are separate map/environment features. Current roof/restoration details are taken from2023 museum photographs; the unbuilt historical spire is intentionally absent. Small ornaments and bay dimensions are authored from published elevations and photographs rather than copied texture images; inscription lettering is represented as plaque relief. Earthwork elevations are photo-scaled between mapped plan controls.',
    ],
    qaCameras: [
      { name: 'near-courtyard', position: [-9, 8.5, 4], lookAt: [-0.5, 8, -10] },
      { name: 'near-houses', position: [40, 13, 38], lookAt: [12, 6, 13] },
      { name: 'near-cartouche', position: [-4.8, 5.8, 8.2], lookAt: [-1.5, 4.2, 3.1] },
      { name: 'near-gate', position: [78, 8.4, 58], lookAt: [60.1, 2.9, 45.3] },
      { name: 'near-drawbridge', position: [92, 10, 47], lookAt: [77, 1.8, 53] },
      { name: 'far-fort', position: [170, 149, 189], lookAt: [4, 5, 7] },
    ],
  }),
];
