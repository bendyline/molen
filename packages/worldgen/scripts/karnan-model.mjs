/** Kärnan: individually authored present exterior, in its signed mapped footprint frame. */
import { readFileSync } from 'node:fs';
import { beam } from './authored-structure-mesh.mjs';
import { compactAuthoredMesh } from './compact-authored-mesh.mjs';
import { hashEvidenceText } from './evidence-text-hash.mjs';
import { archBay, face, transform, triangle } from './heritage-tower-detail-mesh.mjs';
import { box, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const bytes = readFileSync(structureSourcePath('n0620_karnan', 'map-frame.json'));
const map = JSON.parse(bytes);
const brick = [0.52, 0.31, 0.24],
  stone = [0.69, 0.65, 0.53];
const wood = [0.38, 0.34, 0.26],
  iron = [0.19, 0.2, 0.18];
const outline = map.geometry.outline;
const main = [outline[4], outline[3], outline[2], outline[1]];
const turret = [
  outline[10],
  outline[9],
  outline[8],
  outline[7],
  outline[6],
  [-5.18, -2.5],
  [-5.1, -4.1],
  outline[0],
];

function edge(out, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  return {
    out: transform(out, Math.atan2(-dz, dx), [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2]),
    width: Math.hypot(dx, dz),
  };
}

// Split large wall panels for continuous original weathering; metric UVs still use the shared graph.
function panel(out, slot, x0, x1, y0, y1, z, color) {
  const nx = Math.max(1, Math.ceil((x1 - x0) / 0.58)),
    ny = Math.max(1, Math.ceil((y1 - y0) / 0.58));
  for (let ix = 0; ix < nx; ix++)
    for (let iy = 0; iy < ny; iy++) {
      const a = x0 + ((x1 - x0) * ix) / nx,
        b = x0 + ((x1 - x0) * (ix + 1)) / nx;
      const c = y0 + ((y1 - y0) * iy) / ny,
        d = y0 + ((y1 - y0) * (iy + 1)) / ny;
      face(
        out,
        slot,
        [
          [a, c, z],
          [b, c, z],
          [b, d, z],
          [a, d, z],
        ],
        color,
      );
    }
}
function rectangularReveal(out, o, slot, color) {
  const a = o.x - o.w / 2,
    b = o.x + o.w / 2,
    y = o.y,
    t = o.top,
    d = o.depth ?? 0.32;
  for (const p of [
    [
      [a, y, 0],
      [a, y, -d],
      [a, t, -d],
      [a, t, 0],
    ],
    [
      [b, y, -d],
      [b, y, 0],
      [b, t, 0],
      [b, t, -d],
    ],
    [
      [a, t, 0],
      [a, t, -d],
      [b, t, -d],
      [b, t, 0],
    ],
    [
      [a, y, -d],
      [a, y, 0],
      [b, y, 0],
      [b, y, -d],
    ],
  ])
    face(out, slot, p, color);
  face(
    out,
    'shadow',
    [
      [a, y, -d],
      [b, y, -d],
      [b, t, -d],
      [a, t, -d],
    ],
    [0.07, 0.06, 0.05],
  );
}
function circularReveal(out, o) {
  const r = o.w / 2,
    y = (o.y + o.top) / 2,
    d = o.depth ?? 0.45;
  for (let i = 0; i < 64; i++) {
    const a = (i * Math.PI) / 32,
      b = ((i + 1) * Math.PI) / 32;
    const p = (t, rr, z) => [o.x + rr * Math.cos(t), y + rr * Math.sin(t), z];
    const q = (t) => p(t, r / Math.max(Math.abs(Math.cos(t)), Math.abs(Math.sin(t))), 0);
    const points = [p(a, r, 0), q(a), q(b), p(b, r, 0)];
    // Tangency at a square midpoint reduces this panel to one triangle.
    const unique = points.filter(
      (v, k) => !points.slice(0, k).some((w) => Math.hypot(...v.map((n, j) => n - w[j])) < 1e-8),
    );
    if (unique.length === 4) face(out, 'brick', unique, brick);
    else if (unique.length === 3) triangle(out, 'brick', unique, brick);
    face(out, 'brick', [p(a, r, 0), p(b, r, 0), p(b, r, -d), p(a, r, -d)], brick);
    triangle(out, 'shadow', [[o.x, y, -d], p(a, r, -d), p(b, r, -d)], [0.06, 0.055, 0.045]);
  }
}
function masonryWall(out, width, y0, y1, windows = [], putlogs = false, skip = []) {
  const holes = [...windows];
  if (putlogs)
    for (let iy = 0; iy < 29; iy++)
      for (let ix = 0; ix < 13; ix++) {
        if ((ix * 7 + iy * 11) % 9 < 3) continue;
        const x = -width / 2 + 0.7 + (ix * (width - 1.4)) / 12,
          y = 1.1 + iy * 1.05;
        const w = 0.15,
          top = y + 0.15;
        if (
          y < y0 ||
          top > y1 ||
          [...windows, ...skip].some(
            (o) =>
              x + w / 2 > o.x - o.w / 2 - 0.2 &&
              x - w / 2 < o.x + o.w / 2 + 0.2 &&
              top > o.y - 0.2 &&
              y < o.top + 0.2,
          )
        )
          continue;
        holes.push({ x, w, y, top, depth: 0.22, rect: true });
      }
  const cuts = [...holes, ...skip];
  const xs = [
    ...new Set([-width / 2, width / 2, ...cuts.flatMap((o) => [o.x - o.w / 2, o.x + o.w / 2])]),
  ].sort((a, b) => a - b);
  const ys = [...new Set([y0, y1, ...cuts.flatMap((o) => [o.y, o.top])])].sort((a, b) => a - b);
  for (let j = 1; j < ys.length; j++)
    for (let i = 1; i < xs.length; i++) {
      const x = (xs[i - 1] + xs[i]) / 2,
        y = (ys[j - 1] + ys[j]) / 2;
      if (x < -width / 2 || x > width / 2 || y < y0 || y > y1) continue;
      if (cuts.some((o) => x > o.x - o.w / 2 && x < o.x + o.w / 2 && y > o.y && y < o.top))
        continue;
      panel(out, 'brick', xs[i - 1], xs[i], ys[j - 1], ys[j], 0, brick);
    }
  for (const o of holes) {
    if (o.circle) circularReveal(out, o);
    else if (o.rect) rectangularReveal(out, o, 'brick', brick);
    else {
      archBay(out, 'brick', o.x, o.w, o.y, o.spring, o.rise, o.top, 0, o.depth ?? 0.6, brick, {
        pointed: o.pointed ?? false,
        trim: 0,
        back: true,
      });
      face(
        out,
        'brick',
        [
          [o.x - o.w / 2, o.y, 0],
          [o.x + o.w / 2, o.y, 0],
          [o.x + o.w / 2, o.y, -(o.depth ?? 0.6)],
          [o.x - o.w / 2, o.y, -(o.depth ?? 0.6)],
        ],
        brick,
      );
    }
  }
}
function slit(x, y, w = 0.24, h = 0.88) {
  return { x, w, y, spring: y + h - w / 2, rise: w / 2, top: y + h, depth: 0.62 };
}
function archedTrim(out, o, slot = 'brick', border = 0.18) {
  const r = o.w / 2;
  for (const sign of [-1, 1])
    box(
      out,
      slot,
      [o.x + sign * r - border / 2, o.y, -0.08],
      [o.x + sign * r + border / 2, o.spring, 0.08],
      slot === 'brick' ? brick : stone,
    );
  const n = 32;
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * i) / n,
      b = (Math.PI * (i + 1)) / n;
    beam(
      out,
      slot,
      [o.x + r * Math.cos(a), o.spring + o.rise * Math.sin(a), 0.025],
      [o.x + r * Math.cos(b), o.spring + o.rise * Math.sin(b), 0.025],
      border,
      0.2,
      slot === 'brick' ? brick : stone,
    );
  }
  box(
    out,
    slot,
    [o.x - r - border / 2, o.y - 0.13, -0.14],
    [o.x + r + border / 2, o.y, 0.22],
    slot === 'brick' ? brick : stone,
  );
}
function belt(out, w, y = 11.1) {
  box(out, 'sandstone', [-w / 2, y, -0.1], [w / 2, y + 0.16, 0.15], stone);
  for (let i = 0; i < Math.ceil(w / 0.65); i++) {
    const x0 = -w / 2 + (i * w) / Math.ceil(w / 0.65),
      x1 = -w / 2 + ((i + 1) * w) / Math.ceil(w / 0.65) - 0.008;
    box(out, 'sandstone', [x0, y + 0.16, -0.08], [x1, y + 0.23, 0.2], stone);
  }
}
function battlements(out, w, top = 34.5, count = 8, depth = 0.82) {
  const base = top - 2.15,
    notch = top - 1.42;
  box(out, 'brick', [-w / 2, base, -depth], [w / 2, notch, 0.13], brick);
  for (let course = 0; course < 3; course++)
    box(
      out,
      'brick',
      [-w / 2, base - 0.27 + course * 0.09, -depth],
      [w / 2, base - 0.18 + course * 0.09, 0.03 + course * 0.05],
      brick,
    );
  const pitch = (w - 1.12) / (count - 1);
  for (let i = 0; i < count; i++) {
    const x = -w / 2 + 0.56 + i * pitch;
    box(out, 'brick', [x - 0.56, notch, -depth], [x + 0.56, top - 0.055, 0.13], brick);
    box(
      out,
      'brick',
      [x - 0.575, top - 0.055, -depth - 0.015],
      [x + 0.575, top, 0.145],
      [0.58, 0.48, 0.31],
    );
  }
}

const frontWindows = [
  { x: 0.63, w: 1.54, y: 5.8, spring: 7.2, rise: 0.77, top: 7.97, depth: 0.72 },
  { x: 2.22, w: 1.24, y: 14.95, spring: 16.32, rise: 0.62, top: 16.94, depth: 0.57 },
  slit(2.22, 20.05, 0.24, 0.9),
  slit(2.22, 24.05, 0.23, 0.82),
  { x: 2.22, w: 1.29, y: 27.48, spring: 28.85, rise: 0.645, top: 29.495, depth: 0.9 },
  slit(3.35, 31.0, 0.16, 0.66),
];
function mainWalls(out) {
  const windows = [
    [
      slit(0.0, 4.6, 0.19, 0.55),
      slit(0.25, 7.4, 0.18, 0.9),
      slit(-2.0, 11.6, 0.2, 0.66),
      slit(3.5, 11.6, 0.17, 0.72),
      slit(0, 16.0, 0.25, 2.5),
      slit(0, 20.1, 0.22, 1.03),
      slit(0, 24.1, 0.22, 0.9),
      slit(0, 27.8, 0.21, 0.98),
      slit(0, 31.35, 0.18, 0.58),
      { x: 1.8, w: 0.3, y: 17.1, top: 17.4, circle: true, depth: 0.6 },
    ],
    [
      { x: 2.1, w: 0.72, y: 1.75, top: 4.22, rect: true, depth: 0.55 },
      slit(-3.5, 23.9, 0.18, 0.72),
      slit(1.8, 28.6, 0.2, 0.8),
    ],
    [slit(0, 24.4, 0.22, 0.82), slit(0, 27.9, 0.21, 0.9), slit(0, 31.15, 0.2, 0.75)],
    frontWindows,
  ];
  for (let side = 0; side < 4; side++) {
    const { out: o, width: w } = edge(out, main[side], main[(side + 1) % 4]);
    masonryWall(o, w, 0, 32.08, windows[side], true);
    belt(o, w);
    battlements(o, w);
    if (side === 3) {
      archedTrim(o, frontWindows[0], 'brick', 0.2);
      archedTrim(o, frontWindows[1], 'sandstone', 0.22);
      archedTrim(o, frontWindows[4], 'brick', 0.16);
      const royal = frontWindows[1];
      for (const s of [-1, 1])
        beam(
          o,
          'sandstone',
          [royal.x + s * 0.97, 16.88, 0.12],
          [royal.x, 17.45, 0.12],
          0.16,
          0.19,
          stone,
        );
      for (const s of [-1, 1])
        box(
          o,
          'sandstone',
          [royal.x + s * 0.94 - 0.1, 16.62, 0.02],
          [royal.x + s * 0.94 + 0.1, 16.9, 0.2],
          stone,
        );
      windowGrille(o, royal, 0.36, 0.15, true);
      windowGrille(o, frontWindows[4], 0.3, 0.4, false);
      entryDoor(o, frontWindows[0]);
      entryStair(o);
    }
    if (side === 0) {
      // Small recessed oratory oculus beside the long lancet.
      const p = [1.8, 17.25, 0.025];
      for (let i = 0; i < 32; i++) {
        const a = (i * Math.PI) / 16,
          b = ((i + 1) * Math.PI) / 16;
        beam(
          o,
          'brick',
          [p[0] + 0.18 * Math.cos(a), p[1] + 0.18 * Math.sin(a), 0.02],
          [p[0] + 0.18 * Math.cos(b), p[1] + 0.18 * Math.sin(b), 0.02],
          0.09,
          0.08,
          brick,
        );
      }
    }
    if (side === 1) {
      const d = windows[side][0];
      for (let i = 0; i < 5; i++)
        box(
          o,
          'metal',
          [d.x - d.w / 2 + (i * d.w) / 5, d.y, -0.53],
          [d.x - d.w / 2 + ((i + 1) * d.w) / 5 - 0.008, d.top, -0.48],
          [0.33, 0.37, 0.33],
        );
    }
  }
}
function windowGrille(out, o, step, depth, glazed) {
  for (let x = o.x - o.w / 2 + 0.1; x < o.x + o.w / 2; x += step) {
    const t = (x - o.x) / (o.w / 2),
      top = o.spring + o.rise * Math.sqrt(Math.max(0, 1 - t * t));
    box(out, 'metal', [x - 0.014, o.y, -depth], [x + 0.014, top, -depth + 0.027], iron);
  }
  for (let y = o.y + 0.3; y < o.spring; y += 0.38)
    box(out, 'metal', [o.x - o.w / 2, y, -depth], [o.x + o.w / 2, y + 0.025, -depth + 0.027], iron);
  if (glazed)
    face(
      out,
      'glass',
      [
        [o.x - o.w / 2, o.y, -depth - 0.03],
        [o.x + o.w / 2, o.y, -depth - 0.03],
        [o.x + o.w / 2, o.spring, -depth - 0.03],
        [o.x - o.w / 2, o.spring, -depth - 0.03],
      ],
      [0.46, 0.48, 0.42],
    );
}
function entryDoor(out, o) {
  const r = o.w / 2;
  for (let i = 0; i < 10; i++) {
    const x0 = o.x - r + (i * o.w) / 10,
      x1 = x0 + o.w / 10 - 0.007;
    const top = (x) => o.spring + o.rise * Math.sqrt(Math.max(0, 1 - ((x - o.x) / r) ** 2));
    face(
      out,
      'wood',
      [
        [x0, o.y, -0.65],
        [x1, o.y, -0.65],
        [x1, top(x1), -0.65],
        [x0, top(x0), -0.65],
      ],
      [0.16, 0.12, 0.075],
    );
  }
  for (const y of [6.14, 6.85, 7.4])
    box(out, 'metal', [o.x - r + 0.1, y, -0.63], [o.x + r - 0.1, y + 0.055, -0.6], iron);
  tube(out, 'metal', [o.x + 0.46, 6.7, -0.57], [o.x + 0.46, 6.86, -0.57], 0.032, iron, 12);
}
function entryStair(out) {
  const x = 0.63,
    rise = 5.8,
    start = 1.15,
    run = 7.4,
    n = 32;
  box(out, 'wood', [x - 0.88, rise - 0.15, -0.1], [x + 0.88, rise, start], wood);
  for (let i = 0; i < n; i++) {
    const z = start + (i * run) / n,
      y = rise - (i * rise) / n;
    box(out, 'wood', [x - 0.79, y - 0.09, z], [x + 0.79, y, z + run / n + 0.02], wood);
  }
  for (const s of [-1, 1]) {
    const xx = x + s * 0.85;
    beam(out, 'wood', [xx, rise - 0.18, start], [xx, 0.11, start + run], 0.17, 0.26, wood);
    for (let i = 0; i <= 8; i++) {
      const z = start + (i * run) / 8,
        y = rise - (i * rise) / 8;
      box(
        out,
        'wood',
        [xx - 0.045, Math.max(0, y - 0.2), z - 0.045],
        [xx + 0.045, y + 1.0, z + 0.045],
        wood,
      );
      if (i < 8)
        for (const h of [0.32, 0.63, 0.99])
          beam(out, 'wood', [xx, y + h, z], [xx, y - rise / 8 + h, z + run / 8], 0.06, 0.07, wood);
    }
    for (const z of [start, start + run / 2]) {
      const y = rise - ((z - start) * rise) / run;
      box(out, 'wood', [xx - 0.1, 0, z - 0.1], [xx + 0.1, y, z + 0.1], wood);
      beam(out, 'wood', [xx, 0.2, z], [xx, y - 0.3, z + 0.9], 0.11, 0.15, wood);
    }
    for (const z of [0.05, start])
      box(out, 'wood', [xx - 0.05, rise - 0.1, z - 0.05], [xx + 0.05, rise + 1, z + 0.05], wood);
    beam(out, 'wood', [xx, rise + 1, 0.05], [xx, rise + 1, start], 0.07, 0.07, wood);
  }
}
function stairTurret(out) {
  for (let i = 0; i < turret.length; i++) {
    const { out: o, width: w } = edge(out, turret[i], turret[(i + 1) % turret.length]);
    const y0 = i < 4 || i === 7 ? 0 : 32.6;
    const openings = [];
    if (i < 4 || i === 7) {
      for (let j = 0; j < 7; j++) {
        const y = 6.0 + j * 4.05 + (i % 3) * 0.65;
        if (y + 0.72 < 36.25) openings.push(slit(0, y, 0.17, 0.72));
      }
    }
    if (i === 5)
      openings.push({ x: 0, w: 0.68, y: 32.6, spring: 34.12, rise: 0.34, top: 34.46, depth: 0.4 });
    masonryWall(o, w, y0, 37.0, openings, false);
    if (y0 === 0) belt(o, w);
    box(o, 'brick', [-w / 2, 36.9, -0.36], [w / 2, 37.4, 0.12], brick);
    box(o, 'brick', [-w / 2, 37.04, -0.36], [w / 2, 37.13, 0.2], brick);
    const mw = Math.min(0.74, w * 0.6);
    box(o, 'brick', [-mw / 2, 37.4, -0.36], [mw / 2, 38.5, 0.12], brick);
  }
  // Solid accessible roof slab below the small octagonal crenellated crown.
  const c = [-7.13, 37.08, -3.21];
  for (let i = 0; i < turret.length; i++)
    triangle(
      out,
      'concrete',
      [
        c,
        [turret[i][0], 37.08, turret[i][1]],
        [turret[(i + 1) % turret.length][0], 37.08, turret[(i + 1) % turret.length][1]],
      ],
      [0.47, 0.46, 0.42],
    );
  tube(out, 'metal', [-7.13, 37.08, -3.21], [-7.13, 44, -3.21], 0.048, [0.78, 0.78, 0.71], 16);
  tube(out, 'metal', [-7.13, 43.99, -3.21], [-7.13, 44.08, -3.21], 0.072, [0.64, 0.58, 0.37], 12);
}
function privy(out) {
  const base = transform(out, Math.PI, [1.3, 0, -8.155]);
  const w = 2.35,
    d = 1.05;
  masonryWall(transform(base, 0, [0, 0, d]), w, 0, 21.0, [slit(0, 19.0, 0.16, 0.6)], false);
  for (const s of [-1, 1]) {
    const side = transform(base, (s * Math.PI) / 2, [(s * w) / 2, 0, d / 2]);
    masonryWall(side, d, 0, 21, [], false);
  }
  box(base, 'brick', [-w / 2 - 0.09, 21, -0.03], [w / 2 + 0.09, 21.16, d + 0.13], brick);
  face(
    base,
    'slate',
    [
      [-w / 2 - 0.1, 21.16, d + 0.15],
      [w / 2 + 0.1, 21.16, d + 0.15],
      [w / 2 + 0.1, 21.47, -0.04],
      [-w / 2 - 0.1, 21.47, -0.04],
    ],
    [0.32, 0.31, 0.26],
  );
}
function roof(out) {
  // Present open terrace. No invented medieval gabled roof or pre-restoration artillery.
  for (let ix = 0; ix < 24; ix++)
    for (let iz = 0; iz < 25; iz++) {
      const x = -5.75 + ix * 0.59,
        z = -7.25 + iz * 0.58;
      if (x < -5.1 && z > -5.4 && z < -1.0) continue;
      box(out, 'concrete', [x, 32.51, z], [x + 0.582, 32.6, z + 0.572], [0.57, 0.55, 0.49]);
    }
  // Low inner edge and a discrete modern safety rail, pending exact roof survey.
  for (let i = 0; i < 4; i++) {
    const { out: o, width: w } = edge(out, main[i], main[(i + 1) % 4]);
    for (let k = 0; k < 12; k++) {
      const x = -w / 2 + 0.75 + (k * (w - 1.5)) / 11;
      if (i === 3 && x < -1 && x > -5.5) continue;
      tube(o, 'metal', [x, 32.6, -1], [x, 33.62, -1], 0.017, iron, 8);
    }
    tube(o, 'metal', [-w / 2 + 0.75, 33.62, -1], [w / 2 - 0.75, 33.62, -1], 0.023, iron, 8);
  }
}
function collar(out) {
  // Low visible remnant ring from the published plan, proportioned rather than surveyed.
  const ring = [
    [-12, 12.7],
    [14.2, 12.7],
    [14.2, -12.7],
    [-12, -12.7],
  ];
  for (let i = 0; i < 4; i++) {
    const { out: o, width: w } = edge(out, ring[i], ring[(i + 1) % 4]);
    for (let k = 0; k < Math.ceil(w / 0.72); k++) {
      const x = -w / 2 + (k * w) / Math.ceil(w / 0.72),
        b = x + w / Math.ceil(w / 0.72) - 0.015;
      if (i === 3 && x > -1.8 && x < 2) continue;
      const y = 0.35 + 0.07 * Math.sin(k * 2.73 + i);
      box(o, 'sandstone', [x, 0, -0.72], [b, y, 0.08], [0.48, 0.47, 0.41]);
      box(o, 'sandstone', [x - 0.1, y, -0.76], [b + 0.06, y + 0.18, 0.1], [0.59, 0.57, 0.49]);
    }
  }
}
function noise(x, y, z) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z);
  const ease = (t) => t * t * (3 - 2 * t),
    fx = ease(x - ix),
    fy = ease(y - iy),
    fz = ease(z - iz);
  let sum = 0;
  for (let dx = 0; dx < 2; dx++)
    for (let dy = 0; dy < 2; dy++)
      for (let dz = 0; dz < 2; dz++) {
        let h =
          Math.imul(ix + dx, 374761393) ^
          Math.imul(iy + dy, 668265263) ^
          Math.imul(iz + dz, 2147483647);
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        h ^= h >>> 16;
        sum +=
          ((h >>> 0) / 4294967295) * (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz);
      }
  return sum;
}
function decorateMesh(mesh) {
  const seen = new Set();
  for (const g of mesh.groups)
    if (g.materialRef === 'matgraph:molen.worldgen.material.brick')
      for (let j = g.start; j < g.start + g.count; j++) seen.add(mesh.indices[j]);
  for (const i of seen) {
    const p = i * 3,
      x = mesh.positions[p],
      y = mesh.positions[p + 1],
      z = mesh.positions[p + 2];
    const burnt = 0.29 * noise(x * 0.65, y * 0.38, z * 0.65) + 0.08 * noise(x * 2, y * 1.7, z * 2);
    const repair = Math.max(0, noise(x * 0.9 + 41, y * 1.3, z * 0.9) - 0.48) * 0.2;
    for (let c = 0; c < 3; c++)
      mesh.colors[p + c] = Math.round(
        255 *
          Math.max(
            0,
            Math.min(1, (mesh.colors[p + c] / 255) * (1 - burnt) + repair * [1, 0.37, 0.16][c]),
          ),
      );
  }
  compactAuthoredMesh(mesh);
}

export const karnan = {
  id: 'n0620_karnan',
  planId: 'N0620',
  title: 'Kärnan',
  wikidata: 'Q1779457',
  authoringFile: 'karnan-model.mjs',
  componentMap: { sandstone: 'grunewald_stone' },
  build(out) {
    mainWalls(out);
    stairTurret(out);
    privy(out);
    roof(out);
    collar(out);
  },
  decorateMesh,
  front:
    'Native -X faces southwest toward the city and sea; native -Z is the northwest privy elevation, +Z southeast.',
  origin:
    'Mapped main footprint frame, including its offset stair turret; Y=0 is reconstructed surrounding ground.',
  brief:
    'Helsingborg’s brick keep with its asymmetric octagonal stair turret, eight merlons per main elevation, recessed windows and putlog holes, sandstone belt, raised timber entrance, projecting northwest privy shaft, open roof terrace and low collar-wall remnants. Shared metric materials and original continuous brick weathering.',
  facts: {
    mainBattlementHeightMeters: 34.5,
    mainPlanApproximateMeters: 15,
    stairTurretReconstructionHeightMeters: 38.5,
    mainMerlonsPerSide: 8,
    restorationYears: [1893, 1894],
    wallThicknessApproximateMeters: 4,
  },
  refs: [
    'https://helsingborg.se/uppleva-och-gora/kultur-och-museer/the-keep-of-helsingborg/',
    'https://karnan.se/om-karnan/utforska-karnan/',
    'https://stadslexikon.helsingborg.se/krnan/',
    'https://tidsskrift.dk/Hikuin/article/download/149897/192728/330000',
    'https://media.helsingborg.se/uploads/networks/1/2015/02/Bevprogram_HBG_Stadskarna_AtillJ_2002_sbf.pdf',
    'https://www.flickr.com/photos/helsingborgsmuseer/28102443388/in/album-72157690814895900',
    'https://commons.wikimedia.org/wiki/File:K%C3%A4rnan_1.jpg',
    'https://commons.wikimedia.org/wiki/File:K%C3%A4rnan_7.jpg',
    'https://commons.wikimedia.org/wiki/File:K%C3%A4rnan_2025.jpg',
    map.source,
  ],
  scaleBasis:
    'Mapped main plan is about15.8×16.3 m, compared with the city’s approximately15 m description. Main crenellations reach the mapped34.5 m. Current photographs establish the taller turret and individual facade layouts; turret38.5 m and5.8 m entrance are provisional proportional reconstruction. The1893 section predates restoration, and operator floor labels are not substituted for surveyed exterior datums.',
  geographicProposal: {
    anchor: map.anchor,
    heading: map.heading,
    source: map.source,
    mapGeometrySource: 'map-frame.json',
    mapGeometryHash: hashEvidenceText(bytes),
    evidence: map.basis,
    limitations:
      'The main footprint and signed facade orientation are map/publication based. Ground levels, the reconstructed collar wall and timber stair need detailed site terrain and survey confirmation.',
  },
  limits: [
    'Current restored turret height, flagpole height, roof terrace furniture and exterior opening elevations are proportional reconstructions; a measured restoration survey is still required.',
    'The putlog-hole field and repair tint distribution are original approximations, not a brick-for-brick measured reconstruction. The oratory openings have visible physical reveals; interior rooms are not modeled.',
    'The low collar-wall remnants and entrance stair are study dimensions. The archaeological predecessor outline, distant Terrasstrapporna, medieval interiors and mobile visitor equipment are outside this exterior asset.',
  ],
  previewCamera: { position: [-46, 27, 55], lookAt: [0, 18, 0], fov: 38 },
  cameras: [
    { name: 'southwest-entrance', position: [-86, 24, 7], lookAt: [-1, 21, 0] },
    { name: 'northwest-privy', position: [-37, 27, -76], lookAt: [0, 21, 0] },
    { name: 'southeast-oratory', position: [32, 25, 77], lookAt: [1, 21, 0] },
    { name: 'northeast-rear', position: [78, 24, -27], lookAt: [0, 21, 0] },
    { name: 'entrance-stair', position: [-28, 9, 13], lookAt: [-10, 5, 0.65] },
    { name: 'royal-window', position: [-22, 18, 5], lookAt: [-6.5, 16, 2.2] },
    { name: 'stair-turret-crown', position: [-19, 40, -14], lookAt: [-7, 36, -3] },
    { name: 'roof-terrace', position: [24, 58, 25], lookAt: [0, 31, 0] },
    { name: 'brick-and-putlogs', position: [0, 18, 17], lookAt: [0, 18, 8.15] },
    { name: 'ground-plan', position: [1, 93, 2], lookAt: [1, 0, 0] },
    { name: 'far-silhouette', position: [-76, 35, 95], lookAt: [0, 19, 0] },
  ],
};
