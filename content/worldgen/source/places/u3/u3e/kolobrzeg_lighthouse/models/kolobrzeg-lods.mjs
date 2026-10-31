/** Complete source-local browser levels for the circular fort and Kołobrzeg Lighthouse. Detailed masters stay intact. */
import {
  beam,
  sphere as fullSphere,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  ring as fullRing,
  shell as fullShell,
} from '../../../../../../../../packages/worldgen/scripts/lighthouse-expansion-models.mjs';
import {
  lathe as fullLathe,
  panel,
  transformed,
} from '../../../../../../../../packages/worldgen/scripts/lighthouse-models.mjs';
import {
  box as fullBox,
  tube as fullTube,
  quad,
  tubePath,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { addStairSupport } from './stair-support.mjs';

function components(level) {
  const close = level === 'closeup',
    district = level === 'district',
    segments = close ? 64 : district ? 8 : 24,
    TAU = Math.PI * 2,
    white = [0.86, 0.87, 0.82],
    black = [0.038, 0.045, 0.047];
  const arcadeSegments = close ? 12 : district ? 3 : 6;
  const P = (r, y, a) => [r * Math.sin(a), y, r * Math.cos(a)];
  function lathe(out, slot, profile, color, n = 64, center = [0, 0]) {
    if (district && Math.max(...profile.map((p) => p[1])) < 0.6) {
      fullLathe(
        out,
        slot,
        [
          [profile[0][0], Math.max(...profile.map((p) => p[1]))],
          [profile.at(-1)[0], Math.max(...profile.map((p) => p[1]))],
        ],
        color,
        4,
        center,
      );
      return;
    }
    fullLathe(
      out,
      slot,
      profile,
      color,
      Math.min(
        n,
        Math.max(...profile.map((p) => p[1])) < 0.6 ? (close ? 16 : district ? 6 : 8) : segments,
      ),
      center,
    );
  }
  function shell(out, options) {
    fullShell(out, { ...options, segments: Math.min(options.segments ?? 128, segments) });
  }
  function ring(out, slot, y, inside, outside, h, color, n = 80) {
    if (district && outside - inside < 0.12) {
      for (let i = 0; i < 8; i++) {
        const a = (i * TAU) / 8,
          b = ((i + 1) * TAU) / 8,
          ps = [P(outside, y, a), P(outside, y, b), P(outside, y + h, b), P(outside, y + h, a)];
        quad(out, slot, ps, normalFor(...ps.slice(0, 3)), color);
        quad(out, slot, [...ps].reverse(), normalFor(...[...ps].reverse().slice(0, 3)), color);
      }
      return;
    }
    fullRing(
      out,
      slot,
      y,
      inside,
      outside,
      h,
      color,
      district && outside > 3.2 && outside < 3.3
        ? 16
        : Math.min(
            n,
            outside < 0.6 ? (close ? 24 : district ? 6 : 12) : close ? 64 : district ? 8 : 16,
          ),
    );
  }
  function box(out, slot, a, b, color) {
    if (district && b[2] - a[2] < 0.5 && (b[0] - a[0] < 0.35 || b[1] - a[1] < 0.35))
      panel(out, slot, a[0], b[0], a[1], b[1], b[2], color);
    else fullBox(out, slot, a, b, color);
  }
  function tube(out, slot, a, b, r, color, n = 8) {
    fullTube(out, slot, a, b, r, color, Math.min(n, close ? 6 : district ? 3 : 4));
  }
  function sphere(out, slot, p, r, color, n = 20, m = 10) {
    if (district) {
      panel(out, slot, p[0] - r[0], p[0] + r[0], p[1] - r[1], p[1] + r[1], p[2] + r[2], color);
      return;
    }
    fullSphere(
      out,
      slot,
      p,
      r,
      color,
      Math.min(n, close ? 16 : district ? 6 : 10),
      Math.min(m, close ? 8 : district ? 3 : 5),
    );
  }
  function path(out, points, slot, color, r = 0.016) {
    if (district && points.every((p) => Math.abs(p[2] - points[0][2]) < 1e-8)) {
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1],
          b = points[i],
          length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (!length) continue;
        const dx = (-(b[1] - a[1]) * r) / length,
          dy = ((b[0] - a[0]) * r) / length;
        quad(
          out,
          slot,
          [
            [a[0] - dx, a[1] - dy, a[2]],
            [b[0] - dx, b[1] - dy, b[2]],
            [b[0] + dx, b[1] + dy, b[2]],
            [a[0] + dx, a[1] + dy, a[2]],
          ],
          [0, 0, 1],
          color,
        );
      }
    } else tubePath(out, slot, points, r, color, close ? 6 : district ? 3 : 4);
  }
  function roofSeams(out, profile, n, color) {
    n = Math.min(n, close ? 12 : district ? 0 : 6);
    for (let i = 0; i < n; i++)
      path(
        out,
        profile.map(([y, r]) => P(r + 0.012, y, (i * TAU) / n)),
        'metal',
        color,
        0.014,
      );
  }
  function roundRail(out, r, y, h, n, color) {
    n = Math.min(n, close ? 48 : district ? 8 : 16);
    for (let i = 0; i < n; i++)
      tube(out, 'metal', P(r, y, (i * TAU) / n), P(r, y + h, (i * TAU) / n), 0.018, color);
    if (district) {
      for (const dy of [h * 0.48, h])
        for (let i = 0; i < n; i++) {
          const a = (i * TAU) / n,
            b = ((i + 1) * TAU) / n;
          for (const sign of [1, -1]) {
            const ps = [
              P(r, y + dy - 0.023, a),
              P(r, y + dy - 0.023, b),
              P(r, y + dy + 0.023, b),
              P(r, y + dy + 0.023, a),
            ];
            if (sign < 0) ps.reverse();
            quad(out, 'metal', ps, normalFor(...ps.slice(0, 3)), color);
          }
        }
    } else
      for (const dy of [0, h * 0.48, h])
        ring(out, 'metal', y + dy - 0.016, r - 0.022, r + 0.022, 0.032, color);
  }
  function recessShell(out, options) {
    shell(
      {
        addQuad(s, r, ...a) {
          if (r === 'metric:uv' || s === 'glass') out.addQuad(s, r, ...a);
        },
        addTriangle(...a) {
          out.addTriangle(...a);
        },
      },
      { ...options, holes: (options.holes ?? []).map((h) => ({ ...h, grid: false })) },
    );
    const radius = (y) => {
      let j = 1;
      while (j < options.profile.length - 1 && options.profile[j][0] < y) j++;
      const [a, r] = options.profile[j - 1],
        [b, t] = options.profile[j];
      return r + ((t - r) * (y - a)) / (b - a);
    };
    for (const h of options.holes ?? []) {
      const o = transformed(out, h.angle ?? 0),
        w = h.w / 2,
        z = Math.sqrt(radius(h.y + h.h / 2) ** 2 - w * w),
        t = h.trim ?? 0.045,
        c = h.trimColor ?? white,
        s = h.trimSlot ?? 'metal';
      for (const x of [-w, w])
        box(o, s, [x - t, h.y - t, z - h.depth], [x + t, h.y + h.h + t, z + 0.025], c);
      for (const y of [h.y, h.y + h.h])
        box(o, s, [-w - t, y - t, z - h.depth], [w + t, y + t, z + 0.03], c);
      if (h.grid) {
        box(
          o,
          'metal',
          [-0.018, h.y, z - h.depth + 0.014],
          [0.018, h.y + h.h, z - h.depth + 0.05],
          c,
        );
        box(
          o,
          'metal',
          [-w, h.y + h.h * 0.49 - 0.018, z - h.depth + 0.014],
          [w, h.y + h.h * 0.49 + 0.018, z - h.depth + 0.05],
          c,
        );
      }
    }
  }
  function archHead(
    out,
    { y, w, h, z, depth, color, slot = 'plaster', rise = w / 2, trim = 0.08, frame = white },
  ) {
    const spring = y + h - rise,
      archSegments = close ? 16 : district ? 4 : 8;
    for (let i = 0; i < archSegments; i++) {
      const a = (i * Math.PI) / archSegments,
        b = ((i + 1) * Math.PI) / archSegments,
        p = [w * 0.5 * Math.cos(a), spring + rise * Math.sin(a), z],
        q = [w * 0.5 * Math.cos(b), spring + rise * Math.sin(b), z];
      quad(out, slot, [p, [p[0], y + h + 0.018, z], [q[0], y + h + 0.018, z], q], [0, 0, 1], color);
      const ps = [p, q, [q[0], q[1], z - depth], [p[0], p[1], z - depth]];
      quad(out, slot, ps, normalFor(...ps.slice(0, 3)), color);
      if (trim) {
        if (district)
          quad(
            out,
            'metal',
            [
              [p[0], p[1] - trim, p[2] + 0.01],
              [q[0], q[1] - trim, q[2] + 0.01],
              [q[0], q[1] + trim, q[2] + 0.01],
              [p[0], p[1] + trim, p[2] + 0.01],
            ],
            [0, 0, 1],
            frame,
          );
        else tube(out, 'metal', p, q, trim, frame, 8);
      }
    }
  }
  const fortBrick = [0.48, 0.225, 0.17],
    towerBrick = [0.58, 0.285, 0.21],
    sand = [0.79, 0.75, 0.64];
  function kolobrzegWindow(out, a, y) {
    const o = transformed(out, a),
      z = Math.sqrt(4.16 ** 2 - 0.36 ** 2);
    archHead(o, {
      y,
      w: 0.72,
      h: 1.54,
      z,
      depth: 0.28,
      color: towerBrick,
      slot: 'brick',
      frame: sand,
      trim: 0.09,
    });
    for (const x of [-0.36, 0.36])
      box(o, 'limestone', [x - 0.07, y - 0.06, z - 0.27], [x + 0.07, y + 1.18, z + 0.025], sand);
    box(o, 'limestone', [-0.48, y - 0.09, z - 0.27], [0.48, y + 0.03, z + 0.07], sand);
    box(o, 'metal', [-0.018, y + 0.04, z - 0.23], [0.018, y + 1.43, z - 0.19], sand);
    box(o, 'metal', [-0.3, y + 0.65, z - 0.23], [0.3, y + 0.685, z - 0.19], sand);
  }
  function digit(out, d, x, y, z, scale = 0.6) {
    const paths = {
      0: [
        [0.15, 0],
        [0.8, 0],
        [1, 0.22],
        [1, 0.8],
        [0.8, 1],
        [0.15, 1],
        [0, 0.8],
        [0, 0.22],
        [0.15, 0],
      ],
      1: [
        [0.17, 0.8],
        [0.5, 1],
        [0.5, 0],
      ],
      3: [
        [0, 0.9],
        [0.2, 1],
        [0.8, 1],
        [1, 0.85],
        [1, 0.67],
        [0.6, 0.5],
        [1, 0.35],
        [1, 0.15],
        [0.8, 0],
        [0.1, 0],
        [0, 0.1],
      ],
      4: [
        [0.85, 0],
        [0.85, 1],
        [0, 0.27],
        [1, 0.27],
      ],
      5: [
        [1, 1],
        [0.03, 1],
        [0.03, 0.55],
        [0.78, 0.55],
        [1, 0.4],
        [1, 0.15],
        [0.8, 0],
        [0.1, 0],
        [0, 0.1],
      ],
      8: [
        [0.2, 0.5],
        [0, 0.68],
        [0, 0.85],
        [0.2, 1],
        [0.8, 1],
        [1, 0.85],
        [1, 0.68],
        [0.8, 0.5],
        [0.2, 0.5],
        [0, 0.32],
        [0, 0.15],
        [0.2, 0],
        [0.8, 0],
        [1, 0.15],
        [1, 0.32],
        [0.8, 0.5],
      ],
      9: [
        [0.02, 0.1],
        [0.22, 0],
        [0.77, 0.02],
        [1, 0.28],
        [1, 0.81],
        [0.8, 1],
        [0.2, 1],
        [0, 0.81],
        [0, 0.6],
        [0.2, 0.44],
        [0.78, 0.44],
        [1, 0.6],
      ],
      '-': [
        [0, 0.5],
        [1, 0.5],
      ],
    };
    const ps = paths[d];
    if (ps)
      path(
        out,
        ps.map(([u, v]) => [x + u * scale * 0.53, y + v * scale, z]),
        'metal',
        black,
        0.028,
      );
  }
  function dateOnDrum(out, text, angle, y, r) {
    const step = 0.42,
      start = -(text.length * step) / 2;
    for (let i = 0; i < text.length; i++) {
      const a = angle + (start + i * step) / r,
        o = transformed(out, a);
      digit(o, text[i], 0, y, r + 0.06, 0.59);
    }
  }
  function kolobrzegRelief(out) {
    const o = transformed(out, Math.PI / 2),
      z = 4.24,
      c = [0.18, 0.19, 0.15];
    // Raised maritime memorial: anchor, wreath and folded flag planes, reconstructed from the operator's lit facade.
    tube(o, 'metal', [0, 15.85, z], [0, 17.75, z], 0.075, c, 12);
    tube(o, 'metal', [-0.7, 17.2, z], [0.7, 17.2, z], 0.06, c, 10);
    path(
      o,
      Array.from({ length: arcadeSegments + 1 }, (_, i) => {
        const a = Math.PI + (i * Math.PI) / arcadeSegments;
        return [0.95 * Math.cos(a), 16.67 + 0.91 * Math.sin(a), z + 0.035];
      }),
      'metal',
      c,
      0.1,
    );
    for (const side of [-1, 1]) {
      path(
        o,
        [
          [0, 16.02, z],
          [side * 0.88, 16.17, z],
          [side * 1.02, 16.62, z],
        ],
        'metal',
        c,
        0.08,
      );
      for (let i = 0; i < 6; i++)
        sphere(
          o,
          'metal',
          [side * (0.25 + i * 0.105), 15.65 + i * 0.09, z + 0.1],
          [0.13, 0.07, 0.045],
          c,
          10,
          6,
        );
    }
    path(
      o,
      Array.from({ length: 33 }, (_, i) => [
        0.26 * Math.cos((i * TAU) / 32),
        17.8 + 0.26 * Math.sin((i * TAU) / 32),
        z,
      ]),
      'metal',
      c,
      0.055,
    );
    for (const side of [-1, 1]) {
      const ps = [
        [side * 0.16, 17.62, z + 0.04],
        [side * 1.02, 17.23, z + 0.12],
        [side * 0.91, 16.68, z + 0.16],
        [side * 0.29, 17.02, z + 0.1],
      ];
      if (normalFor(...ps.slice(0, 3))[2] < 0) ps.reverse();
      quad(o, 'metal', ps, normalFor(...ps.slice(0, 3)), c);
    }
  }
  function buildKolobrzeg(out) {
    lathe(
      out,
      'granite',
      [
        [0, 8.45],
        [0.18, 8.45],
      ],
      [0.42, 0.4, 0.36],
      192,
    );
    const openings = [
      {
        angle: 0,
        y: 0.18,
        w: 1.65,
        h: 2.18,
        depth: 0.38,
        trim: 0.03,
        trimColor: fortBrick,
        trimSlot: 'brick',
      },
      ...Array.from({ length: 10 }, (_, i) => ({
        angle: (i * TAU) / 10,
        y: 3.15,
        w: 1.36,
        h: 0.74,
        depth: 0.48,
        trim: 0.04,
        trimColor: fortBrick,
        trimSlot: 'brick',
      })),
      ...[-1.15, 1.15, Math.PI].map((angle) => ({
        angle,
        y: 0.65,
        w: 1.58,
        h: 0.6,
        depth: 0.45,
        trim: 0.04,
        trimColor: fortBrick,
        trimSlot: 'brick',
      })),
    ];
    recessShell(out, {
      profile: [
        [0.18, 8.38],
        [5.69, 8.38],
      ],
      holes: openings,
      slot: 'brick',
      color: fortBrick,
      segments: 240,
    });
    for (const h of openings) {
      const o = transformed(out, h.angle),
        z = Math.sqrt(8.38 ** 2 - (h.w / 2) ** 2);
      archHead(o, { ...h, z, slot: 'brick', color: fortBrick, rise: h.w * 0.16, trim: 0 });
      if (!district && h.w > 1.5 && h.y > 0.2) {
        for (let x = -h.w * 0.42; x < h.w * 0.45; x += 0.23)
          tube(o, 'metal', [x, h.y, z - 0.33], [x, h.y + h.h - 0.06, z - 0.33], 0.018, black, 8);
      }
    }
    // Radial brick buttresses remain proud of the round fort walls.
    for (let i = 0; i < 8; i++) {
      const a = ((i + 0.5) * TAU) / 8,
        o = transformed(out, a);
      if (district) {
        for (const [ps, n] of [
          [
            [
              [-0.22, 0.17, 8.58],
              [0.22, 0.17, 8.58],
              [0.22, 5.65, 8.58],
              [-0.22, 5.65, 8.58],
            ],
            [0, 0, 1],
          ],
          [
            [
              [-0.22, 0.17, 8.18],
              [-0.22, 0.17, 8.58],
              [-0.22, 5.65, 8.58],
              [-0.22, 5.65, 8.18],
            ],
            [-1, 0, 0],
          ],
          [
            [
              [0.22, 0.17, 8.58],
              [0.22, 0.17, 8.18],
              [0.22, 5.65, 8.18],
              [0.22, 5.65, 8.58],
            ],
            [1, 0, 0],
          ],
          [
            [
              [-0.22, 5.65, 8.58],
              [0.22, 5.65, 8.58],
              [0.22, 5.65, 8.18],
              [-0.22, 5.65, 8.18],
            ],
            [0, 1, 0],
          ],
        ])
          quad(o, 'brick', ps, n, fortBrick);
      } else box(o, 'brick', [-0.22, 0.17, 8.18], [0.22, 5.65, 8.58], fortBrick);
    }
    ring(out, 'limestone', 5.69, 4.12, 8.58, 0.19, [0.51, 0.5, 0.44], 192);
    ring(out, 'granite', 5.87, 4.12, 8.43, 0.06, [0.48, 0.47, 0.41], 192);
    const copingCount = district ? 6 : 16;
    for (let i = 0; i < copingCount; i++) {
      const o = transformed(out, (i * TAU) / copingCount);
      box(o, 'limestone', [-0.38, 5.92, 8.06], [0.38, 6.12, 8.43], sand);
    }
    const shaftHoles = [];
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
      for (const y of [7.05, 10.23, 13.41])
        shaftHoles.push({
          angle: a,
          y,
          w: 0.72,
          h: 1.54,
          depth: 0.28,
          trim: 0,
          trimColor: towerBrick,
          trimSlot: 'brick',
        });
    // Filter default rectangles; arched stone surrounds are added below.
    shell(
      {
        addQuad(s, r, ...a) {
          if (r === 'metric:uv' || s === 'glass') out.addQuad(s, r, ...a);
        },
        addTriangle(...a) {
          out.addTriangle(...a);
        },
      },
      {
        profile: [
          [5.87, 4.16],
          [19.32, 4.16],
        ],
        slot: 'brick',
        color: towerBrick,
        holes: shaftHoles,
        segments: 224,
      },
    );
    for (const h of shaftHoles) kolobrzegWindow(out, h.angle, h.y);
    // Thirty-two pale blind-arcade moldings are an essential part of the tower silhouette.
    for (let i = 0; i < 32; i++) {
      const a = ((i + 0.5) * TAU) / 32,
        o = transformed(out, a),
        w = 0.65,
        z = 4.19,
        y = 17.2;
      for (const x of [-w / 2, w / 2])
        box(o, 'limestone', [x - 0.045, y, z - 0.025], [x + 0.045, y + 0.25, z + 0.035], sand);
      path(
        o,
        Array.from({ length: arcadeSegments + 1 }, (_, j) => [
          (w / 2) * Math.cos((j * Math.PI) / arcadeSegments),
          y + 0.25 + (w / 2) * Math.sin((j * Math.PI) / arcadeSegments),
          z + 0.028,
        ]),
        'limestone',
        sand,
        0.052,
      );
      if (!district)
        box(
          o,
          'limestone',
          [-w / 2 - 0.045, y - 0.035, z - 0.025],
          [w / 2 + 0.045, y + 0.035, z + 0.035],
          sand,
        );
    }
    ring(out, 'brick', 18.98, 3.95, 4.22, 0.28, towerBrick, 192);
    ring(out, 'limestone', 19.26, 1.4, 4.47, 0.17, sand, 192);
    ring(out, 'metal', 19.43, 1.43, 4.51, 0.065, [0.35, 0.34, 0.29], 192);
    roundRail(out, 4.22, 19.5, 1.02, 120, sand);
    // Eight white pillars encircle the glazed watch room and carry the upper lantern balcony.
    const c = sand;
    for (let i = 0; i < 8; i++) {
      const p = P(2.94, 0, ((i + 0.5) * TAU) / 8),
        o = transformed(out, 0, p);
      lathe(
        o,
        'plaster',
        [
          [19.49, 0.25],
          [19.67, 0.25],
          [19.77, 0.18],
          [22.11, 0.18],
          [22.18, 0.26],
        ],
        c,
        40,
      );
    }
    const watchSegments = district ? 8 : 16;
    for (let i = 0; i < watchSegments; i++) {
      const a = (i * TAU) / watchSegments,
        b = ((i + 1) * TAU) / watchSegments,
        ps = [P(1.89, 19.51, a), P(1.89, 19.51, b), P(1.89, 22.2, b), P(1.89, 22.2, a)];
      quad(out, 'glassClear', ps, normalFor(...ps.slice(0, 3)), [0.65, 0.78, 0.78]);
      tube(out, 'metal', P(1.92, 19.51, a), P(1.92, 22.2, a), 0.028, c, 8);
    }
    for (const y of [19.55, 20.47, 21.41, 22.17]) ring(out, 'metal', y, 1.86, 1.94, 0.037, c, 128);
    // Watch-room access stair is visible through the transparent enclosure.
    for (let i = 0; i < 14; i++) {
      const a = i * 0.34,
        p = P(0.85, 19.54 + i * 0.17, a),
        o = transformed(out, a);
      if (district) {
        const ps = [
          [-0.32, p[1] + 0.07, 0.4],
          [-0.32, p[1] + 0.07, 1.27],
          [0.32, p[1] + 0.07, 1.27],
          [0.32, p[1] + 0.07, 0.4],
        ];
        quad(o, 'metal', ps, [0, 1, 0], [0.35, 0.37, 0.34]);
        quad(o, 'metal', [...ps].reverse(), [0, -1, 0], [0.35, 0.37, 0.34]);
      } else box(o, 'metal', [-0.32, p[1], 0.4], [0.32, p[1] + 0.07, 1.27], [0.35, 0.37, 0.34]);
    }
    ring(out, 'plaster', 22.18, 1.47, 3.23, 0.17, c, 144);
    ring(out, 'metal', 22.34, 1.47, 3.27, 0.075, c, 144);
    roundRail(out, 3.03, 22.42, 0.99, 84, c);
    lathe(
      out,
      'metal',
      [
        [22.4, 1.68],
        [23.35, 1.68],
      ],
      white,
      128,
    );
    for (let i = 0; i < 12; i++) {
      const a = (i * TAU) / 12,
        b = ((i + 1) * TAU) / 12,
        open = Math.cos((a + b) / 2) < 0.5,
        ps = [P(1.68, 23.35, a), P(1.68, 23.35, b), P(1.68, 24.51, b), P(1.68, 24.51, a)];
      quad(
        out,
        open ? 'glassClear' : 'metal',
        ps,
        normalFor(...ps.slice(0, 3)),
        open ? [0.7, 0.84, 0.82] : white,
      );
      tube(out, 'metal', P(1.705, 22.45, a), P(1.705, 24.53, a), 0.035, c, 8);
    }
    ring(out, 'metal', 24.48, 1.63, 1.9, 0.1, c, 128);
    const roof = [
      [24.55, 2.06],
      [24.63, 1.99],
      [25.07, 1.26],
      [25.79, 0.15],
      [25.91, 0.08],
    ];
    lathe(out, 'metal', roof, [0.28, 0.3, 0.28], 128);
    roofSeams(out, roof, 12, [0.39, 0.4, 0.36]);
    tube(out, 'metal', [0, 25.9, 0], [0, 26, 0], 0.018, black, 8);
    lathe(
      out,
      'metal',
      [
        [22.43, 0.26],
        [23.54, 0.26],
      ],
      c,
      48,
    );
    lathe(
      out,
      'glassClear',
      [
        [23.54, 0.48],
        [24.13, 0.48],
      ],
      [0.65, 0.87, 0.85],
      80,
    );
    for (let y = 23.55; !district && y < 24.12; y += close ? 0.065 : 0.13)
      ring(out, 'metal', y, 0.45, 0.49, 0.012, c, 64);
    // Main mapped entrance, curved canopy and small brick guard booth adjoining the fort.
    panel(out, 'wood', -0.76, 0.76, 0.22, 2.28, 7.98, black);
    for (const x of [-0.75, 0.75])
      box(out, 'brick', [x - 0.18, 0.18, 8.12], [x + 0.18, 2.48, 8.57], fortBrick);
    const canopySegments = close ? 16 : district ? 4 : 8;
    for (let i = 0; i < canopySegments; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / canopySegments,
        b = -Math.PI / 2 + ((i + 1) * Math.PI) / canopySegments,
        p = [1.33 * Math.sin(a), 2.48 + 0.36 * Math.cos(a), 8.18],
        q = [1.33 * Math.sin(b), 2.48 + 0.36 * Math.cos(b), 8.18];
      const ps = [p, q, [q[0], q[1], 9.66], [p[0], p[1], 9.66]];
      if (normalFor(...ps.slice(0, 3))[1] < 0) ps.reverse();
      quad(out, 'glassClear', ps, normalFor(...ps.slice(0, 3)), [0.73, 0.79, 0.72]);
      if (i % 4 === 0) tube(out, 'metal', p, [p[0], p[1], 9.66], 0.021, black, 8);
    }
    for (const z of [8.18, 9.66])
      path(
        out,
        Array.from({ length: canopySegments + 1 }, (_, i) => [
          1.33 * Math.sin(-Math.PI / 2 + (i * Math.PI) / canopySegments),
          2.48 + 0.36 * Math.cos(-Math.PI / 2 + (i * Math.PI) / canopySegments),
          z,
        ]),
        'metal',
        black,
        0.025,
      );
    const booth = transformed(out, 0, [2.33, 0, 8.23]);
    box(booth, 'brick', [-0.68, 0, -0.64], [0.68, 2.59, 0.64], fortBrick);
    for (const sign of [-1, 1]) {
      const ps = [
        [0, 3.2, -0.79],
        [0, 3.2, 0.79],
        [sign * 0.84, 2.57, 0.79],
        [sign * 0.84, 2.57, -0.79],
      ];
      if (normalFor(...ps.slice(0, 3))[1] < 0) ps.reverse();
      quad(booth, 'tiles', ps, normalFor(...ps.slice(0, 3)), [0.49, 0.23, 0.15]);
    }
    for (const z of [-0.64, 0.64]) {
      const ps = [
        [-0.68, 2.58, z],
        [0.68, 2.58, z],
        [0, 3.13, z],
      ];
      if (normalFor(...ps)[2] * z < 0) ps.reverse();
      booth.addTriangle(
        'brick',
        'metric:uv',
        ps,
        normalFor(...ps),
        ps.map((p) => [p[0], p[1]]),
        fortBrick,
      );
    }
    panel(booth, 'glass', -0.17, 0.17, 0.85, 1.47, 0.653, [0.15, 0.19, 0.16]);
    if (!district) {
      dateOnDrum(out, '1939-1945', 0, 16.14, 4.16);
      dateOnDrum(out, '1000-1945', Math.PI, 16.14, 4.16);
    }
    kolobrzegRelief(out);
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const o = transformed(out, a);
      beam(o, 'metal', [0, 19.36, 4.25], [0, 19.36, 5.0], 0.065, 0.065, black);
      sphere(o, 'metal', [0, 19.24, 5.0], [0.2, 0.15, 0.2], sand, 20, 10);
    }
  }

  return (out) => {
    const mapped = {};
    for (const method of ['addQuad', 'addTriangle', 'addConvexPolygon'])
      mapped[method] = (slot, ...args) =>
        out[method](slot === 'granite' ? 'limestone' : slot, ...args);
    buildKolobrzeg(mapped);
    addStairSupport(mapped, { district, sides: close ? 6 : 4 });
  };
}
export const kolobrzegDistrict = components('district');
export const kolobrzegStreet = components('street');
export const kolobrzegCloseup = components('closeup');

/** Whole tower at skyline distance: solid fort/shaft, eight open columns and both galleries. */
export function kolobrzegSkyline(out) {
  const TAU = Math.PI * 2,
    brick = [0.48, 0.225, 0.17],
    shaft = [0.58, 0.285, 0.21],
    sand = [0.79, 0.75, 0.64],
    dark = [0.038, 0.045, 0.047],
    white = [0.86, 0.87, 0.82];
  const P = (r, y, a) => [r * Math.sin(a), y, r * Math.cos(a)];
  fullLathe(
    out,
    'limestone',
    [
      [0, 8.45],
      [0.18, 8.45],
    ],
    [0.42, 0.4, 0.36],
    8,
  );
  const door = { angle: 0, y: 0.18, w: 1.65, h: 2.18, depth: 0.38 };
  const turned = transformed(out, Math.PI / 8);
  fullShell(
    {
      addQuad(s, r, ...args) {
        if (r === 'metric:uv' || s === 'glass') turned.addQuad(s, r, ...args);
      },
      addTriangle(...args) {
        turned.addTriangle(...args);
      },
    },
    {
      profile: [
        [0.18, 8.38],
        [5.69, 8.38],
      ],
      holes: [{ ...door, angle: -Math.PI / 8 }],
      slot: 'brick',
      color: brick,
      segments: 8,
    },
  );
  const z = Math.sqrt(8.38 ** 2 - (1.65 / 2) ** 2),
    spring = 0.18 + 2.18 - 1.65 * 0.16;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 4,
      b = ((i + 1) * Math.PI) / 4,
      p = [0.825 * Math.cos(a), spring + 0.264 * Math.sin(a), z],
      q = [0.825 * Math.cos(b), spring + 0.264 * Math.sin(b), z];
    quad(out, 'brick', [p, [p[0], 2.378, z], [q[0], 2.378, z], q], [0, 0, 1], brick);
    quad(
      out,
      'brick',
      [p, q, [q[0], q[1], z - 0.38], [p[0], p[1], z - 0.38]],
      normalFor(p, q, [q[0], q[1], z - 0.38]),
      brick,
    );
  }
  panel(out, 'wood', -0.76, 0.76, 0.22, 2.28, 7.98, dark);
  for (let i = 0; i < 8; i++) {
    const o = transformed(out, ((i + 0.5) * TAU) / 8);
    const x = 0.22,
      y0 = 0.17,
      y1 = 5.65,
      z0 = 8.18,
      z1 = 8.58;
    for (const [ps, n] of [
      [
        [
          [-x, y0, z1],
          [x, y0, z1],
          [x, y1, z1],
          [-x, y1, z1],
        ],
        [0, 0, 1],
      ],
      [
        [
          [-x, y0, z0],
          [-x, y0, z1],
          [-x, y1, z1],
          [-x, y1, z0],
        ],
        [-1, 0, 0],
      ],
      [
        [
          [x, y0, z1],
          [x, y0, z0],
          [x, y1, z0],
          [x, y1, z1],
        ],
        [1, 0, 0],
      ],
      [
        [
          [-x, y1, z1],
          [x, y1, z1],
          [x, y1, z0],
          [-x, y1, z0],
        ],
        [0, 1, 0],
      ],
    ])
      quad(o, 'brick', ps, n, brick);
  }
  fullRing(transformed(out, Math.PI / 8), 'limestone', 5.69, 4.12, 8.7, 0.24, [0.51, 0.5, 0.44], 8);
  for (let i = 0; i < 10; i++) {
    const a = (i * TAU) / 10;
    const edge = (a - Math.PI / 8 + TAU) % (TAU / 8),
      offset = edge - TAU / 16,
      r = (8.38 * Math.cos(TAU / 16)) / Math.cos(offset),
      o = transformed(out, a);
    panel(o, 'glass', -0.68, 0.68, 3.15, 3.89, r + 0.04, [0.11, 0.135, 0.14]);
  }
  fullLathe(
    out,
    'brick',
    [
      [5.87, 4.16],
      [19.32, 4.16],
    ],
    shaft,
    12,
  );
  // Flush window cards preserve all three rows without subpixel reveals at this distance.
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
    for (const y of [7.05, 10.23, 13.41]) {
      const o = transformed(out, a);
      panel(o, 'limestone', -0.45, 0.45, y - 0.09, y + 1.63, 4.18, sand);
      panel(o, 'glass', -0.36, 0.36, y, y + 1.54, 4.19, [0.11, 0.135, 0.14]);
    }
  // The thin blind arcade is a continuous low-poly strip rhythm rather than 32 tube chains.
  for (let i = 0; i < 32; i++) {
    const o = transformed(out, ((i + 0.5) * TAU) / 32);
    for (let j = 0; j < 2; j++) {
      const a = (j * Math.PI) / 2,
        b = ((j + 1) * Math.PI) / 2,
        p = [0.325 * Math.cos(a), 17.45 + 0.325 * Math.sin(a), 4.22],
        q = [0.325 * Math.cos(b), 17.45 + 0.325 * Math.sin(b), 4.22];
      quad(
        o,
        'limestone',
        [
          [p[0], p[1] - 0.052, p[2]],
          [q[0], q[1] - 0.052, q[2]],
          [q[0], q[1] + 0.052, q[2]],
          [p[0], p[1] + 0.052, p[2]],
        ],
        [0, 0, 1],
        sand,
      );
    }
  }
  fullRing(out, 'limestone', 19.26, 1.4, 4.47, 0.235, sand, 8);
  for (let i = 0; i < 8; i++) {
    const p = P(2.94, 0, ((i + 0.5) * TAU) / 8);
    fullBox(
      transformed(out, ((i + 0.5) * TAU) / 8, p),
      'plaster',
      [-0.18, 19.49, -0.18],
      [0.18, 22.18, 0.18],
      sand,
    );
  }
  fullLathe(
    out,
    'glass',
    [
      [19.51, 1.89],
      [22.2, 1.89],
    ],
    [0.34, 0.43, 0.43],
    8,
  );
  fullRing(out, 'plaster', 22.18, 1.47, 3.27, 0.235, sand, 16);
  for (const [r, y, h] of [
    [4.22, 19.5, 1.02],
    [3.03, 22.42, 0.99],
  ])
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8,
        b = ((i + 1) * TAU) / 8,
        ps = [
          P(r, y + h - 0.04, a),
          P(r, y + h - 0.04, b),
          P(r, y + h + 0.04, b),
          P(r, y + h + 0.04, a),
        ];
      quad(out, 'metal', ps, normalFor(...ps.slice(0, 3)), sand);
      const o = transformed(out, a);
      panel(o, 'metal', -0.035, 0.035, y, y + h, r, sand);
    }
  fullLathe(
    out,
    'metal',
    [
      [22.4, 1.68],
      [23.35, 1.68],
    ],
    white,
    12,
  );
  for (let i = 0; i < 12; i++) {
    const a = (i * TAU) / 12,
      b = ((i + 1) * TAU) / 12,
      open = Math.cos((a + b) / 2) < 0.5,
      ps = [P(1.68, 23.35, a), P(1.68, 23.35, b), P(1.68, 24.51, b), P(1.68, 24.51, a)];
    quad(
      out,
      open ? 'glass' : 'metal',
      ps,
      normalFor(...ps.slice(0, 3)),
      open ? [0.34, 0.43, 0.43] : white,
    );
  }
  fullLathe(
    out,
    'metal',
    [
      [24.51, 2.06],
      [25.79, 0.15],
      [26, 0.018],
    ],
    [0.28, 0.3, 0.28],
    8,
  );
  // Entrance canopy and the attached gabled guard booth stay part of the full model.
  for (const x of [-0.75, 0.75])
    fullBox(out, 'brick', [x - 0.18, 0.18, 8.12], [x + 0.18, 2.48, 8.57], brick);
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 4,
      b = -Math.PI / 2 + ((i + 1) * Math.PI) / 4,
      p = [1.33 * Math.sin(a), 2.48 + 0.36 * Math.cos(a), 8.18],
      q = [1.33 * Math.sin(b), 2.48 + 0.36 * Math.cos(b), 8.18],
      ps = [p, q, [q[0], q[1], 9.66], [p[0], p[1], 9.66]];
    if (normalFor(...ps.slice(0, 3))[1] < 0) ps.reverse();
    quad(out, 'glass', ps, normalFor(...ps.slice(0, 3)), [0.4, 0.45, 0.4]);
  }
  const booth = transformed(out, 0, [2.33, 0, 8.23]);
  fullBox(booth, 'brick', [-0.68, 0, -0.64], [0.68, 2.59, 0.64], brick);
  for (const sign of [-1, 1]) {
    const ps = [
      [0, 3.2, -0.79],
      [0, 3.2, 0.79],
      [sign * 0.84, 2.57, 0.79],
      [sign * 0.84, 2.57, -0.79],
    ];
    if (normalFor(...ps.slice(0, 3))[1] < 0) ps.reverse();
    quad(booth, 'tiles', ps, normalFor(...ps.slice(0, 3)), [0.49, 0.23, 0.15]);
  }
  for (const z of [-0.64, 0.64]) {
    const ps = [
      [-0.68, 2.58, z],
      [0.68, 2.58, z],
      [0, 3.13, z],
    ];
    if (normalFor(...ps)[2] * z < 0) ps.reverse();
    booth.addTriangle(
      'brick',
      'metric:uv',
      ps,
      normalFor(...ps),
      ps.map((p) => [p[0], p[1]]),
      brick,
    );
  }
  panel(booth, 'glass', -0.17, 0.17, 0.85, 1.47, 0.653, [0.15, 0.19, 0.16]);
}
