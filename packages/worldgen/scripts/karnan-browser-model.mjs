/** N0620 browser derivatives. Detailed historic/current source karnan-model.mjs is preserved. */
import { readFileSync } from 'node:fs';
import { beam } from './authored-structure-mesh.mjs';
import { face, transform, triangle } from './heritage-tower-detail-mesh.mjs';
import { box, tube as sourceTube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const outline = JSON.parse(readFileSync(structureSourcePath('n0620_karnan', 'map-frame.json')))
    .geometry.outline,
  stone = [0.8, 0.76, 0.65],
  dark = [0.075, 0.085, 0.085];
const means = {
  brick: [0.620345, 0.549823, 0.504963],
  sandstone: [0.790898, 0.790898, 0.790898],
  metal: [0.908889, 0.908889, 0.908889],
  wood: [0.825128, 0.825128, 0.825128],
  concrete: [0.710816, 0.710816, 0.681928],
  slate: [0.59493, 0.632794, 0.653753],
};
function detail(out, mode) {
  const panelStep = mode === 'closeup' ? 1.2 : 1.8,
    archSegments = mode === 'closeup' ? 16 : mode === 'street' ? 8 : 4,
    circleSegments = mode === 'closeup' ? 32 : mode === 'street' ? 16 : 8,
    stairSegments = mode === 'skyline' ? 8 : mode === 'district' ? 16 : 32,
    stairPosts = mode === 'skyline' ? 2 : mode === 'district' ? 4 : 8,
    roofPosts = mode === 'skyline' ? 2 : mode === 'district' ? 4 : 12;
  const tube = (o, s, a, b, r, c, n) =>
    sourceTube(o, s, a, b, r, c, Math.min(n, mode === 'closeup' ? 8 : mode === 'street' ? 6 : 4));
  const archY = (x, radius, rise, pointed) =>
    rise *
    (pointed
      ? Math.sqrt(Math.max(0, 4 - (Math.abs(x) / radius + 1) ** 2)) / Math.sqrt(3)
      : Math.sqrt(Math.max(0, 1 - (x / radius) ** 2)));
  /** A true arch opening cut out of a rectangular wall, with jamb/soffit reveals. */
  function archBay(
    out,
    slot,
    x,
    width,
    y0,
    spring,
    rise,
    top,
    z,
    thickness,
    color = stone,
    { pointed = false, back = true, trim = 0.12 } = {},
  ) {
    const r = width / 2,
      n = archSegments;
    if (back)
      box(
        out,
        'shadow',
        [x - r, y0, z - thickness - 0.1],
        [x + r, spring + rise, z - thickness],
        dark,
      );
    for (let i = 0; i < n; i++) {
      const a = -r + (width * i) / n,
        b = -r + (width * (i + 1)) / n;
      const ya = spring + archY(a, r, rise, pointed),
        yb = spring + archY(b, r, rise, pointed);
      if (top > Math.max(ya, yb))
        face(
          out,
          slot,
          [
            [x + a, ya, z],
            [x + b, yb, z],
            [x + b, top, z],
            [x + a, top, z],
          ],
          color,
        );
      face(
        out,
        slot,
        [
          [x + a, ya, z - thickness],
          [x + b, yb, z - thickness],
          [x + b, yb, z],
          [x + a, ya, z],
        ],
        color,
      );
      if (trim) beam(out, slot, [x + a, ya, z + 0.025], [x + b, yb, z + 0.025], trim, trim, color);
    }
    if (spring > y0) {
      face(
        out,
        slot,
        [
          [x - r, y0, z],
          [x - r, y0, z - thickness],
          [x - r, spring, z - thickness],
          [x - r, spring, z],
        ],
        color,
      );
      face(
        out,
        slot,
        [
          [x + r, y0, z - thickness],
          [x + r, y0, z],
          [x + r, spring, z],
          [x + r, spring, z - thickness],
        ],
        color,
      );
      if (trim)
        for (const sign of [-1, 1])
          box(
            out,
            slot,
            [x + sign * r - trim / 2, y0, z],
            [x + sign * r + trim / 2, spring, z + trim],
            color,
          );
    }
  }

  const brick = [0.52, 0.31, 0.24],
    stone = [0.69, 0.65, 0.53];
  const wood = [0.38, 0.34, 0.26],
    iron = [0.19, 0.2, 0.18];

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
    const nx =
        mode === 'skyline' || mode === 'district'
          ? 1
          : Math.max(1, Math.ceil((x1 - x0) / panelStep)),
      ny =
        mode === 'skyline' || mode === 'district'
          ? 1
          : Math.max(1, Math.ceil((y1 - y0) / panelStep));
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
    for (let i = 0; i < circleSegments; i++) {
      const a = (i * Math.PI * 2) / circleSegments,
        b = ((i + 1) * Math.PI * 2) / circleSegments;
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
    const holes = windows.filter((o) => mode !== 'district' || o.w > 0.5);
    if (mode === 'district')
      for (const o of windows.filter((o) => o.w <= 0.5))
        face(
          out,
          'shadow',
          [
            [o.x - o.w / 2, o.y, 0.008],
            [o.x + o.w / 2, o.y, 0.008],
            [o.x + o.w / 2, o.top, 0.008],
            [o.x - o.w / 2, o.top, 0.008],
          ],
          [0.08, 0.065, 0.05],
        );
    if (putlogs && mode === 'closeup')
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
    if (putlogs && mode === 'street')
      for (let iy = 0; iy < 29; iy++)
        for (let ix = 0; ix < 13; ix++) {
          if ((ix * 7 + iy * 11) % 9 < 3) continue;
          const x = -width / 2 + 0.7 + (ix * (width - 1.4)) / 12,
            y = 1.1 + iy * 1.05;
          if (
            y < y0 ||
            y + 0.15 > y1 ||
            [...windows, ...skip].some(
              (o) =>
                x + 0.075 > o.x - o.w / 2 - 0.2 &&
                x - 0.075 < o.x + o.w / 2 + 0.2 &&
                y + 0.15 > o.y - 0.2 &&
                y < o.top + 0.2,
            )
          )
            continue;
          face(
            out,
            'shadow',
            [
              [x - 0.075, y, 0.008],
              [x + 0.075, y, 0.008],
              [x + 0.075, y + 0.15, 0.008],
              [x - 0.075, y + 0.15, 0.008],
            ],
            [0.12, 0.09, 0.065],
          );
        }
    if (mode === 'skyline') {
      panel(out, 'brick', -width / 2, width / 2, y0, y1, 0, brick);
      for (const o of windows)
        face(
          out,
          'shadow',
          [
            [o.x - o.w / 2, o.y, 0.01],
            [o.x + o.w / 2, o.y, 0.01],
            [o.x + o.w / 2, o.top, 0.01],
            [o.x - o.w / 2, o.top, 0.01],
          ],
          [0.08, 0.065, 0.05],
        );
      return;
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
    const n = archSegments;
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
    if (mode !== 'closeup') {
      box(out, 'sandstone', [-w / 2, y, -0.1], [w / 2, y + 0.23, 0.2], stone);
      return;
    }
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
    for (let course = 0; mode !== 'skyline' && mode !== 'district' && course < 3; course++)
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
      if (mode !== 'skyline')
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
        if (mode !== 'skyline') archedTrim(o, frontWindows[0], 'brick', 0.2);
        if (mode !== 'skyline') archedTrim(o, frontWindows[1], 'sandstone', 0.22);
        if (mode !== 'skyline') archedTrim(o, frontWindows[4], 'brick', 0.16);
        const royal = frontWindows[1];
        for (const s of mode === 'skyline' ? [] : [-1, 1])
          beam(
            o,
            'sandstone',
            [royal.x + s * 0.97, 16.88, 0.12],
            [royal.x, 17.45, 0.12],
            0.16,
            0.19,
            stone,
          );
        for (const s of mode === 'skyline' ? [] : [-1, 1])
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
      if (side === 0 && mode !== 'skyline' && mode !== 'district') {
        // Small recessed oratory oculus beside the long lancet.
        const p = [1.8, 17.25, 0.025];
        for (let i = 0; i < circleSegments; i++) {
          const a = (i * Math.PI * 2) / circleSegments,
            b = ((i + 1) * Math.PI * 2) / circleSegments;
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
    if (mode === 'skyline' || mode === 'district') return;
    for (let x = o.x - o.w / 2 + 0.1; x < o.x + o.w / 2; x += step) {
      const t = (x - o.x) / (o.w / 2),
        top = o.spring + o.rise * Math.sqrt(Math.max(0, 1 - t * t));
      box(out, 'metal', [x - 0.014, o.y, -depth], [x + 0.014, top, -depth + 0.027], iron);
    }
    for (let y = o.y + 0.3; y < o.spring; y += 0.38)
      box(
        out,
        'metal',
        [o.x - o.w / 2, y, -depth],
        [o.x + o.w / 2, y + 0.025, -depth + 0.027],
        iron,
      );
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
    if (mode === 'skyline') {
      box(
        out,
        'wood',
        [o.x - o.w / 2, o.y, 0.015],
        [o.x + o.w / 2, o.spring, 0.03],
        [0.16, 0.12, 0.075],
      );
      return;
    }
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
      n = stairSegments;
    box(out, 'wood', [x - 0.88, rise - 0.15, -0.1], [x + 0.88, rise, start], wood);
    for (let i = 0; i < n; i++) {
      const z = start + (i * run) / n,
        y = rise - (i * rise) / n;
      box(out, 'wood', [x - 0.79, y - 0.09, z], [x + 0.79, y, z + run / n + 0.02], wood);
    }
    for (const s of [-1, 1]) {
      const xx = x + s * 0.85;
      beam(out, 'wood', [xx, rise - 0.18, start], [xx, 0.11, start + run], 0.17, 0.26, wood);
      for (let i = 0; i <= stairPosts; i++) {
        const z = start + (i * run) / stairPosts,
          y = rise - (i * rise) / 8;
        box(
          out,
          'wood',
          [xx - 0.045, Math.max(0, y - 0.2), z - 0.045],
          [xx + 0.045, y + 1.0, z + 0.045],
          wood,
        );
        if (i < stairPosts)
          for (const h of mode === 'skyline' || mode === 'district' ? [0.99] : [0.32, 0.63, 0.99])
            beam(
              out,
              'wood',
              [xx, y + h, z],
              [xx, y - rise / 8 + h, z + run / 8],
              0.06,
              0.07,
              wood,
            );
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
        openings.push({
          x: 0,
          w: 0.68,
          y: 32.6,
          spring: 34.12,
          rise: 0.34,
          top: 34.46,
          depth: 0.4,
        });
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
    box(out, 'concrete', [-5.75, 32.51, -7.25], [8.4, 32.6, 7.25], [0.57, 0.55, 0.49]);
    // Low inner edge and a discrete modern safety rail, pending exact roof survey.
    for (let i = 0; i < 4; i++) {
      const { out: o, width: w } = edge(out, main[i], main[(i + 1) % 4]);
      for (let k = 0; k < roofPosts; k++) {
        const x = -w / 2 + 0.75 + (k * (w - 1.5)) / (roofPosts - 1);
        if (i === 3 && x < -1 && x > -5.5) continue;
        tube(o, 'metal', [x, 32.6, -1], [x, 33.62, -1], 0.017, iron, 8);
      }
      tube(o, 'metal', [-w / 2 + 0.75, 33.62, -1], [w / 2 - 0.75, 33.62, -1], 0.023, iron, 8);
    }
  }
  function collar(out) {
    if (mode !== 'closeup') {
      for (const [a, b] of [
        [
          [-12, 12.7],
          [14.2, 12.7],
        ],
        [
          [14.2, 12.7],
          [14.2, -12.7],
        ],
        [
          [14.2, -12.7],
          [-12, -12.7],
        ],
        [
          [-12, -12.7],
          [-12, 12.7],
        ],
      ]) {
        const e = edge(out, a, b);
        if (a[0] === -12 && b[0] === -12) {
          for (const sign of [-1, 1])
            box(
              e.out,
              'sandstone',
              [sign < 0 ? -e.width / 2 : 2, 0, -0.72],
              [sign < 0 ? -1.8 : e.width / 2, 0.52, 0.08],
              [0.56, 0.54, 0.47],
            );
        } else
          box(
            e.out,
            'sandstone',
            [-e.width / 2, 0, -0.72],
            [e.width / 2, 0.52, 0.08],
            [0.56, 0.54, 0.47],
          );
      }
      return;
    }
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

  mainWalls(out);
  stairTurret(out);
  privy(out);
  roof(out);
  collar(out);
}
export function buildKarnanDistrict(out) {
  detail(out, 'district');
}
export function buildKarnanStreet(out) {
  detail(out, 'street');
}
export function buildKarnanCloseup(out) {
  detail(out, 'closeup');
}
export function buildKarnanSkyline(destination) {
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
    brick = [0.48, 0.29, 0.22],
    pale = [0.69, 0.65, 0.53],
    wood = [0.38, 0.34, 0.26],
    _iron = [0.19, 0.2, 0.18],
    main = [outline[4], outline[3], outline[2], outline[1]],
    turret = [
      outline[10],
      outline[9],
      outline[8],
      outline[7],
      outline[6],
      [-5.18, -2.5],
      [-5.1, -4.1],
      outline[0],
    ];
  const edge = (a, b) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    return {
      out: transform(out, Math.atan2(-dz, dx), [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2]),
      w: Math.hypot(dx, dz),
    };
  };
  for (let i = 0; i < 4; i++) {
    const e = edge(main[i], main[(i + 1) % 4]),
      t = e.out,
      w = e.w;
    face(
      t,
      'brick',
      [
        [-w / 2, 0, 0],
        [w / 2, 0, 0],
        [w / 2, 32.35, 0],
        [-w / 2, 32.35, 0],
      ],
      brick,
    );
    box(t, 'brick', [-w / 2, 32.35, -0.82], [w / 2, 33.08, 0.13], brick);
    box(t, 'sandstone', [-w / 2, 11.1, -0.1], [w / 2, 11.33, 0.2], pale);
    for (let j = 0; j < 8; j++) {
      const x = -w / 2 + 0.56 + (j * (w - 1.12)) / 7;
      box(t, 'brick', [x - 0.56, 33.08, -0.82], [x + 0.56, 34.5, 0.13], brick);
    }
    for (const [x, y, w, h] of i === 3
      ? [
          [0.63, 5.8, 1.54, 2.17],
          [2.22, 14.95, 1.24, 2],
          [2.22, 27.48, 1.29, 2],
          [2.22, 20.05, 0.24, 0.9],
          [2.22, 24.05, 0.23, 0.82],
        ]
      : i === 0
        ? [
            [0, 16, 0.25, 2.5],
            [0, 7.4, 0.18, 0.9],
            [0, 20.1, 0.22, 1],
            [0, 24.1, 0.22, 0.9],
            [0, 27.8, 0.21, 1],
          ]
        : i === 1
          ? [
              [2.1, 1.75, 0.72, 2.47],
              [-3.5, 23.9, 0.18, 0.72],
            ]
          : [
              [0, 24.4, 0.22, 0.82],
              [0, 27.9, 0.21, 0.9],
              [0, 31.15, 0.2, 0.75],
            ])
      face(
        t,
        i === 3 && y === 5.8 ? 'wood' : 'shadow',
        [
          [x - w / 2, y, 0.018],
          [x + w / 2, y, 0.018],
          [x + w / 2, y + h, 0.018],
          [x - w / 2, y + h, 0.018],
        ],
        [0.08, 0.065, 0.05],
      );
    if (i === 3) {
      const x = 0.63;
      box(t, 'wood', [x - 0.88, 5.65, -0.1], [x + 0.88, 5.8, 1.15], wood);
      for (let j = 0; j < 8; j++) {
        const z = 1.15 + (j * 7.4) / 8,
          y = 5.8 - (j * 5.8) / 8;
        box(t, 'wood', [x - 0.79, y - 0.15, z], [x + 0.79, y, z + 7.4 / 8 + 0.02], wood);
      }
      for (const s of [-1, 1]) {
        const xx = x + s * 0.85;
        beam(t, 'wood', [xx, 5.62, 1.15], [xx, 0.11, 8.55], 0.17, 0.26, wood);
        beam(t, 'wood', [xx, 6.8, 1.15], [xx, 1, 8.55], 0.09, 0.09, wood);
        for (const z of [1.15, 4.85]) {
          const y = 5.8 - ((z - 1.15) * 5.8) / 7.4;
          box(t, 'wood', [xx - 0.08, 0, z - 0.08], [xx + 0.08, y + 1, z + 0.08], wood);
        }
      }
    }
  }
  face(
    out,
    'concrete',
    [
      [-5.75, 32.6, -7.25],
      [-5.75, 32.6, 7.25],
      [8.4, 32.6, 7.25],
      [8.4, 32.6, -7.25],
    ],
    [0.57, 0.55, 0.49],
  );
  for (let i = 0; i < 8; i++) {
    const e = edge(turret[i], turret[(i + 1) % 8]),
      t = e.out,
      w = e.w;
    face(
      t,
      'brick',
      [
        [-w / 2, i < 4 || i === 7 ? 0 : 32.6, 0],
        [w / 2, i < 4 || i === 7 ? 0 : 32.6, 0],
        [w / 2, 37.4, 0],
        [-w / 2, 37.4, 0],
      ],
      brick,
    );
    const mw = Math.min(0.74, w * 0.6);
    box(t, 'brick', [-mw / 2, 37.4, -0.36], [mw / 2, 38.5, 0.12], brick);
    if (i < 4 || i === 7) box(t, 'sandstone', [-w / 2, 11.1, -0.1], [w / 2, 11.33, 0.2], pale);
  }
  for (let i = 0; i < 8; i++)
    triangle(
      out,
      'concrete',
      [
        [-7.13, 37.08, -3.21],
        [turret[i][0], 37.08, turret[i][1]],
        [turret[(i + 1) % 8][0], 37.08, turret[(i + 1) % 8][1]],
      ],
      [0.47, 0.46, 0.42],
    );
  sourceTube(
    out,
    'metal',
    [-7.13, 37.08, -3.21],
    [-7.13, 44.08, -3.21],
    0.048,
    [0.78, 0.78, 0.71],
    4,
  );
  box(out, 'brick', [0.125, 0, -9.205], [2.475, 21.16, -8.15], brick);
  box(out, 'slate', [0.025, 21.16, -9.35], [2.575, 21.47, -8.115], [0.32, 0.31, 0.26]);
  for (const [a, b] of [
    [
      [-12, 12.7],
      [14.2, 12.7],
    ],
    [
      [14.2, 12.7],
      [14.2, -12.7],
    ],
    [
      [14.2, -12.7],
      [-12, -12.7],
    ],
    [
      [-12, -12.7],
      [-12, 12.7],
    ],
  ]) {
    const e = edge(a, b);
    if (a[0] === -12 && b[0] === -12) {
      for (const sign of [-1, 1])
        box(
          e.out,
          'sandstone',
          [sign < 0 ? -e.w / 2 : 2, 0, -0.72],
          [sign < 0 ? -1.8 : e.w / 2, 0.52, 0.08],
          pale,
        );
    } else box(e.out, 'sandstone', [-e.w / 2, 0, -0.72], [e.w / 2, 0.52, 0.08], pale);
  }
}
