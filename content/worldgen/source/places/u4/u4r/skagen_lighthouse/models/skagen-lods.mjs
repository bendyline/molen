/** Complete source-local Skagen browser levels. The detailed master remains intact. */
import {
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
  piercedFacade,
  transformed,
} from '../../../../../../../../packages/worldgen/scripts/lighthouse-models.mjs';
import {
  box as fullBox,
  tube as fullTube,
  quad,
  tubePath,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { courtyardLinks } from './courtyard-links.mjs';

function components(level) {
  const close = level === 'closeup',
    district = level === 'district',
    segments = close ? 48 : district ? 12 : 24,
    TAU = Math.PI * 2,
    white = [0.86, 0.87, 0.82],
    black = [0.038, 0.045, 0.047],
    sand = [0.79, 0.75, 0.64];
  const P = (r, y, a) => [r * Math.sin(a), y, r * Math.cos(a)];
  function lathe(out, slot, profile, color, n = 64, center = [0, 0]) {
    fullLathe(
      out,
      slot,
      profile,
      color,
      district && slot === 'glassClear' && Math.max(...profile.map((p) => p[1])) < 1.2
        ? 8
        : Math.min(
            n,
            Math.max(...profile.map((p) => p[1])) < 0.6
              ? close
                ? 16
                : district
                  ? 6
                  : 8
              : segments,
          ),
      center,
    );
  }
  function shell(out, options) {
    fullShell(out, { ...options, segments: Math.min(options.segments ?? 128, segments) });
  }
  function ring(out, slot, y, inside, outside, h, color, n = 80) {
    n = Math.min(
      n,
      outside < 1.2 ? (close ? 24 : district ? 6 : 12) : close ? 48 : district ? 12 : 16,
    );
    if (!close && outside - inside < 0.15 && h < 0.1) {
      for (let i = 0; i < n; i++) {
        const a = (i * TAU) / n,
          b = ((i + 1) * TAU) / n,
          ps = [P(outside, y, a), P(outside, y, b), P(outside, y + h, b), P(outside, y + h, a)];
        quad(out, slot, ps, normalFor(...ps.slice(0, 3)), color);
        ps.reverse();
        quad(out, slot, ps, normalFor(...ps.slice(0, 3)), color);
      }
      return;
    }
    fullRing(out, slot, y, inside, outside, h, color, n);
  }
  function box(out, slot, a, b, color) {
    if (
      ((district && b[2] - a[2] < 0.5) || (!close && slot === 'wood' && b[2] - a[2] < 0.12)) &&
      (b[0] - a[0] < 0.35 || b[1] - a[1] < 0.35)
    )
      panel(out, slot, a[0], b[0], a[1], b[1], b[2], color);
    else fullBox(out, slot, a, b, color);
  }
  function tube(out, slot, a, b, r, color, n = 8) {
    const tip = Math.max(a[1], b[1]) === 46;
    if (!tip && ((district && r < 0.04) || r < 0.016)) return;
    fullTube(out, slot, a, b, r, color, Math.min(n, close ? 6 : district ? 3 : 4));
  }
  function sphere(out, slot, p, r, color, n = 20, m = 10) {
    fullSphere(
      out,
      slot,
      p,
      r,
      color,
      Math.min(n, close ? 16 : district ? 8 : 12),
      Math.min(m, close ? 8 : district ? 4 : 6),
    );
  }
  function path(out, points, slot, color, r = 0.016) {
    if (r < 0.016) return;
    if (district && r < 0.04) {
      if (
        r > 0.03 &&
        Math.min(...points.map((p) => p[1])) >= 39.77 &&
        Math.max(...points.map((p) => p[1])) <= 43.14
      ) {
        for (let i = 1; i < points.length; i++) {
          const a = points[i - 1],
            b = points[i],
            ps = [
              [a[0], a[1] - r, a[2]],
              [b[0], b[1] - r, b[2]],
              [b[0], b[1] + r, b[2]],
              [a[0], a[1] + r, a[2]],
            ];
          quad(out, slot, ps, normalFor(...ps.slice(0, 3)), color);
          ps.reverse();
          quad(out, slot, ps, normalFor(...ps.slice(0, 3)), color);
        }
      }
      return;
    }
    tubePath(out, slot, points, r, color, close ? 6 : district ? 3 : 4);
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
    n = close ? 48 : district ? 12 : 24;
    for (let i = 0; i < n; i++) {
      if (district) {
        const o = transformed(out, (i * TAU) / n),
          ps = [
            [-0.018, y, r],
            [0.018, y, r],
            [0.018, y + h, r],
            [-0.018, y + h, r],
          ];
        quad(o, 'metal', ps, [0, 0, 1], color);
        quad(o, 'metal', [...ps].reverse(), [0, 0, -1], color);
      } else
        fullTube(
          out,
          'metal',
          P(r, y, (i * TAU) / n),
          P(r, y + h, (i * TAU) / n),
          0.018,
          color,
          close ? 6 : 4,
        );
    }
    for (const dy of district ? [h] : [0, h * 0.48, h])
      ring(out, 'metal', y + dy - 0.016, r - 0.022, r + 0.022, 0.032, color);
  }
  function archHead(
    out,
    { y, w, h, z, depth, color, slot = 'plaster', rise = w / 2, trim = 0.08, frame = white },
  ) {
    const spring = y + h - rise,
      n = close ? 8 : district ? 1 : 3;
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI) / n,
        b = ((i + 1) * Math.PI) / n,
        p = [w * 0.5 * Math.cos(a), spring + rise * Math.sin(a), z],
        q = [w * 0.5 * Math.cos(b), spring + rise * Math.sin(b), z];
      quad(out, slot, [p, [p[0], y + h + 0.018, z], [q[0], y + h + 0.018, z], q], [0, 0, 1], color);
      const ps = [p, q, [q[0], q[1], z - depth], [p[0], p[1], z - depth]];
      quad(out, slot, ps, normalFor(...ps.slice(0, 3)), color);
      if (trim && !district) {
        if (close) tube(out, 'metal', p, q, trim, frame, 8);
        else
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
      }
    }
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
  const skagenBrick = [0.51, 0.38, 0.265],
    skagenWall = [0.82, 0.81, 0.735],
    skagenFrame = [0.18, 0.24, 0.19],
    skagenMetal = [0.39, 0.415, 0.4];
  function skagenPane(out, h, z) {
    const c = skagenFrame,
      o = transformed(out, 0, [h.x, 0, 0]),
      w = h.w / 2,
      d = h.depth ?? 0.24;
    if (district) {
      archHead(o, {
        y: h.y,
        w: h.w,
        h: h.h,
        z: z + 0.007,
        depth: d,
        color: skagenWall,
        rise: 0.13,
        trim: 0,
      });
      panel(o, 'wood', -0.025, 0.025, h.y, h.y + h.h - 0.02, z - d + 0.075, c);
      panel(o, 'wood', -w, w, h.y + h.h * 0.48 - 0.025, h.y + h.h * 0.48 + 0.025, z - d + 0.075, c);
      panel(o, 'limestone', -w - 0.11, w + 0.11, h.y - 0.1, h.y - 0.025, z + 0.11, sand);
      if (h.door) panel(o, 'wood', -w + 0.04, w - 0.04, h.y + 0.03, h.y + 0.75, z - d + 0.09, c);
      return;
    }
    archHead(o, {
      y: h.y,
      w: h.w,
      h: h.h,
      z: z + 0.007,
      depth: d,
      color: skagenWall,
      rise: 0.13,
      trim: 0.025,
      frame: c,
    });
    for (const x of [-w, w])
      box(
        o,
        'wood',
        [x - 0.035, h.y, z - d + 0.008],
        [x + 0.035, h.y + h.h - 0.11, z - d + 0.075],
        c,
      );
    for (const y of [h.y, h.y + h.h * 0.48, h.y + h.h * 0.78])
      box(o, 'wood', [-w, y - 0.025, z - d + 0.008], [w, y + 0.025, z - d + 0.072], c);
    box(o, 'wood', [-0.025, h.y, z - d + 0.008], [0.025, h.y + h.h - 0.02, z - d + 0.072], c);
    box(o, 'limestone', [-w - 0.11, h.y - 0.1, z - 0.12], [w + 0.11, h.y - 0.025, z + 0.11], sand);
    if (h.door) panel(o, 'wood', -w + 0.04, w - 0.04, h.y + 0.03, h.y + 0.75, z - d + 0.09, c);
  }
  function roofFace(out, points, color) {
    const n = normalFor(...points.slice(0, 3)),
      acrossX = Math.abs(n[0]) > Math.abs(n[2]),
      slope = (acrossX ? n[0] : n[2]) / Math.max(1e-8, Math.abs(n[1])),
      scale = Math.sqrt(1 + slope * slope),
      uv = points.map((p) => (acrossX ? [p[2], p[0] * scale] : [p[0], p[2] * scale]));
    if (points.length === 4) out.addQuad('roof', 'metric:uv', points, n, uv, color);
    else out.addTriangle('roof', 'metric:uv', points, n, uv, color);
  }
  function skagenHouse(out, { cx = 0, cz = 0, rx, rz, eave, ridge, gable = false, windows }) {
    const o = transformed(out, 0, [cx, 0, cz]);
    box(o, 'granite', [-rx, 0, -rz], [rx, 0.29, rz], [0.14, 0.155, 0.14]);
    for (let f = 0; f < 4; f++) {
      const face = transformed(o, (f * Math.PI) / 2),
        z = f % 2 ? rx : rz,
        half = f % 2 ? rz : rx,
        hs = windows.filter((h) => h.face === f).map((h) => ({ ...h, trim: 0, depth: 0.24 }));
      piercedFacade(face, {
        half,
        z,
        y0: 0.29,
        y1: eave,
        holes: hs,
        slot: 'plaster',
        color: skagenWall,
      });
      for (const h of hs) skagenPane(face, h, z);
    }
    for (const y of [eave - 0.14, eave]) {
      box(o, 'plaster', [-rx - 0.09, y, -rz - 0.09], [rx + 0.09, y + 0.08, rz + 0.09], skagenWall);
    }
    const X = rx + 0.22,
      Z = rz + 0.22;
    if (ridge - eave < 0.5) {
      box(o, 'roof', [-X, eave, -Z], [X, eave + 0.11, Z], skagenMetal);
      for (let x = -X + 0.4; x < X; x += 0.45)
        tube(o, 'metal', [x, eave + 0.125, -Z], [x, eave + 0.125, Z], 0.014, skagenMetal, 6);
    } else if (gable) {
      for (const side of [-1, 1]) {
        const ps = [
          [0, ridge, -Z],
          [0, ridge, Z],
          [side * X, eave, Z],
          [side * X, eave, -Z],
        ];
        if (normalFor(...ps.slice(0, 3))[1] < 0) ps.reverse();
        roofFace(o, ps, skagenMetal);
        for (let z = -Z; z < Z; z += 0.45)
          tube(
            o,
            'metal',
            [0, ridge + 0.015, z],
            [side * X, eave + 0.015, z],
            0.014,
            skagenMetal,
            6,
          );
      }
      for (const side of [-1, 1]) {
        const ps = [
          [-rx, eave, side * rz],
          [rx, eave, side * rz],
          [0, ridge - 0.07, side * rz],
        ];
        if (normalFor(...ps)[2] * side < 0) ps.reverse();
        o.addTriangle(
          'plaster',
          'metric:uv',
          ps,
          normalFor(...ps),
          ps.map((p) => [p[0], p[1]]),
          skagenWall,
        );
        const face = transformed(o, side < 0 ? Math.PI : 0);
        panel(face, 'glass', -0.27, 0.27, eave + 0.33, eave + 1.14, rz + 0.012, [0.18, 0.22, 0.2]);
        for (const x of [-0.28, 0.28])
          box(
            face,
            'wood',
            [x - 0.03, eave + 0.3, rz + 0.018],
            [x + 0.03, eave + 1.16, rz + 0.07],
            skagenFrame,
          );
        for (const y of [eave + 0.31, eave + 0.73, eave + 1.14])
          box(
            face,
            'wood',
            [-0.29, y - 0.025, rz + 0.018],
            [0.29, y + 0.025, rz + 0.07],
            skagenFrame,
          );
      }
    } else {
      const ridgeX = rx - rz + 0.3,
        faces = [
          [
            [-X, eave, -Z],
            [X, eave, -Z],
            [ridgeX, ridge, 0],
            [-ridgeX, ridge, 0],
          ],
          [
            [X, eave, Z],
            [-X, eave, Z],
            [-ridgeX, ridge, 0],
            [ridgeX, ridge, 0],
          ],
          [
            [-X, eave, Z],
            [-X, eave, -Z],
            [-ridgeX, ridge, 0],
          ],
          [
            [X, eave, -Z],
            [X, eave, Z],
            [ridgeX, ridge, 0],
          ],
        ];
      for (const ps of faces) {
        if (normalFor(...ps.slice(0, 3))[1] < 0) ps.reverse();
        roofFace(o, ps, skagenMetal);
      }
      for (let x = -X + 0.12; x < X - 0.08; x += 0.45) {
        const yEnd =
            Math.abs(x) <= ridgeX
              ? ridge
              : eave + ((ridge - eave) * (X - Math.abs(x))) / (X - ridgeX),
          zEnd = Math.abs(x) <= ridgeX ? 0 : (Z * (Math.abs(x) - ridgeX)) / (X - ridgeX);
        for (const side of [-1, 1])
          tube(
            o,
            'metal',
            [x, eave + 0.018, side * Z],
            [x, yEnd + 0.018, side * zEnd],
            0.013,
            skagenMetal,
            6,
          );
      }
      for (const x of [-5.05, 5.05]) {
        box(
          o,
          'plaster',
          [x - 0.46, ridge - 0.25, -0.4],
          [x + 0.46, ridge + 1.15, 0.4],
          skagenWall,
        );
        box(o, 'limestone', [x - 0.53, ridge + 1.12, -0.47], [x + 0.53, ridge + 1.25, 0.47], sand);
        box(o, 'metal', [x - 0.28, ridge + 1.251, -0.23], [x + 0.28, ridge + 1.27, 0.23], black);
      }
    }
    // Gutters and downpipes follow the renovated standing-seam roof edges.
    for (const side of [-1, 1]) {
      tube(
        o,
        'metal',
        [-rx - 0.1, eave + 0.035, side * (rz + 0.17)],
        [rx + 0.1, eave + 0.035, side * (rz + 0.17)],
        0.047,
        skagenMetal,
        10,
      );
      for (const x of [-rx + 0.13, rx - 0.13])
        path(
          o,
          [
            [x, eave, side * (rz + 0.17)],
            [x, eave - 0.33, side * (rz + 0.07)],
            [x, 0.19, side * (rz + 0.07)],
            [x, 0.08, side * (rz + 0.42)],
          ],
          'metal',
          skagenMetal,
          0.037,
        );
    }
  }
  function skagenMonogram(out) {
    if (district) return;
    const o = transformed(out, Math.PI),
      z = 3.765,
      red = [0.53, 0.065, 0.047],
      gold = [0.61, 0.45, 0.16];
    // Original cast-letter curves reproduce the visible FR VII /1858 badge without a bitmap decal.
    const bez = (a, b, c, d, n = close ? 12 : 6) =>
      Array.from({ length: n + 1 }, (_, i) => {
        const t = i / n,
          s = 1 - t;
        return [
          a[0] * s * s * s + 3 * b[0] * s * s * t + 3 * c[0] * s * t * t + d[0] * t * t * t,
          a[1] * s * s * s + 3 * b[1] * s * s * t + 3 * c[1] * s * t * t + d[1] * t * t * t,
          z,
        ];
      });
    path(
      o,
      [
        [-0.35, 3.32, z],
        [-0.35, 5.04, z],
        [0.8, 5.04, z],
      ],
      'metal',
      red,
      0.055,
    );
    path(
      o,
      [
        [-0.35, 4.32, z],
        [0.55, 4.32, z],
      ],
      'metal',
      red,
      0.047,
    );
    path(o, bez([-0.35, 5.04], [1.03, 5.14], [0.68, 4.13], [-0.35, 4.3]), 'metal', red, 0.058);
    path(o, bez([-0.31, 4.3], [0.91, 4.4], [0.52, 2.9], [1.02, 3.38]), 'metal', red, 0.058);
    path(o, bez([-0.35, 3.34], [-1.0, 2.92], [-0.8, 3.45], [-0.64, 3.6]), 'metal', red, 0.051);
    path(o, bez([-0.35, 5.02], [-0.98, 5.5], [-1.12, 4.45], [-0.45, 4.73]), 'metal', red, 0.05);
    for (const [x, letter] of [
      [-0.13, 'V'],
      [0.1, 'I'],
      [0.27, 'I'],
    ]) {
      if (letter === 'V')
        path(
          o,
          [
            [x - 0.07, 3.52, z + 0.03],
            [x + 0.02, 3.14, z + 0.03],
            [x + 0.12, 3.52, z + 0.03],
          ],
          'metal',
          black,
          0.025,
        );
      else tube(o, 'metal', [x, 3.16, z + 0.03], [x, 3.5, z + 0.03], 0.025, black, 8);
    }
    const crownY = 5.63;
    path(
      o,
      [
        [-0.56, crownY, z],
        [-0.65, crownY + 0.45, z],
        [-0.36, crownY + 0.25, z],
        [0, crownY + 0.66, z],
        [0.36, crownY + 0.25, z],
        [0.65, crownY + 0.45, z],
        [0.56, crownY, z],
        [-0.56, crownY, z],
      ],
      'metal',
      gold,
      0.049,
    );
    for (let i = 0; i < 3; i++) {
      const angle = (i * 2 * Math.PI) / 3;
      path(
        o,
        Array.from({ length: close ? 13 : 7 }, (_, j) => {
          const t = (j * Math.PI) / (close ? 12 : 6);
          return [
            Math.cos(t) * 0.65 * Math.cos(angle),
            crownY + 0.3 + Math.sin(t) * 0.51,
            z + 0.08 + Math.cos(t) * 0.09 * Math.sin(angle),
          ];
        }),
        'metal',
        gold,
        0.028,
      );
    }
    tube(o, 'metal', [0, 6.28, z], [0, 6.65, z], 0.025, gold, 8);
    tube(o, 'metal', [-0.12, 6.51, z], [0.12, 6.51, z], 0.022, gold, 8);
    for (let i = 0; i < 4; i++) digit(o, '1858'[i], -0.74 + i * 0.39, 2.47, z, 0.53);
  }
  function buildSkagen(out) {
    lathe(
      out,
      'granite',
      [
        [0, 4.15],
        [0.16, 4.15],
        [0.43, 3.96],
        [0.98, 3.96],
        [1.22, 3.75],
      ],
      [0.55, 0.54, 0.48],
      192,
    );
    // Visible foundation block joints are separate thin grooves rather than overscaled wall courses.
    for (let i = 0; close && i < 24; i++)
      path(
        out,
        [P(3.97, 0.43, (i * TAU) / 24), P(3.97, 1.02, (i * TAU) / 24)],
        'granite',
        [0.35, 0.35, 0.32],
        0.009,
      );
    const radius = (y) => (y <= 7.4 ? 3.75 : 3.75 - ((y - 7.4) * 0.82) / (37.55 - 7.4)),
      hs = [];
    for (let i = 0; i < 4; i++) {
      for (const a of [Math.PI - 0.55, -0.55])
        hs.push({
          angle: a,
          y: 8.0 + i * 7.12,
          w: 0.58,
          h: 1.26,
          depth: 0.28,
          trim: 0,
          trimSlot: 'brick',
          trimColor: skagenBrick,
        });
      for (const a of [Math.PI + 0.58, 0.58])
        hs.push({
          angle: a,
          y: 11.4 + i * 7.12,
          w: 0.58,
          h: 1.26,
          depth: 0.28,
          trim: 0,
          trimSlot: 'brick',
          trimColor: skagenBrick,
        });
    }
    const wrapper = {
      addQuad(s, r, ...a) {
        if (r === 'metric:uv' || s === 'glass') out.addQuad(s, r, ...a);
      },
      addTriangle(...a) {
        out.addTriangle(...a);
      },
    };
    if (!district)
      shell(wrapper, {
        profile: [
          [1.22, 3.75],
          [7.4, 3.75],
          [37.55, 2.93],
        ],
        holes: hs,
        slot: 'brick',
        color: skagenBrick,
        segments: 240,
      });
    if (district)
      fullLathe(
        transformed(out, Math.PI / 12),
        'brick',
        [
          [1.22, 3.75],
          [7.4, 3.75],
          [37.55, 2.93],
        ],
        skagenBrick,
        12,
      );
    for (const h of hs) {
      if (district) {
        const a = (Math.round(h.angle / (TAU / 12)) * TAU) / 12,
          r = radius(h.y + h.h / 2) * Math.cos(Math.PI / 12),
          x = r * Math.tan(h.angle - a),
          o = transformed(transformed(out, a), 0, [x, 0, 0]),
          z = r + 0.025;
        panel(
          o,
          'brick',
          -0.36,
          0.36,
          h.y - 0.08,
          h.y + h.h + 0.03,
          z,
          skagenBrick.map((v) => v * 1.17),
        );
        panel(o, 'glass', -0.29, 0.29, h.y, h.y + h.h, z + 0.01, [0.09, 0.115, 0.12]);
        continue;
      }
      const o = transformed(out, h.angle),
        z = Math.sqrt(radius(h.y + h.h / 2) ** 2 - (h.w / 2) ** 2);
      archHead(o, { ...h, z, slot: 'brick', color: skagenBrick, trim: 0.032, frame: skagenFrame });
      for (const x of [-0.29, 0.29])
        box(
          o,
          'brick',
          [x - 0.065, h.y, z - 0.27],
          [x + 0.065, h.y + 0.97, z + 0.055],
          skagenBrick.map((v) => v * 1.17),
        );
      for (const y of [h.y + 0.41, h.y + 0.82])
        box(o, 'metal', [-0.27, y - 0.021, z - 0.24], [0.27, y + 0.021, z - 0.195], skagenFrame);
      box(o, 'limestone', [-0.39, h.y - 0.095, z - 0.2], [0.39, h.y - 0.035, z + 0.15], sand);
    }
    ring(out, 'limestone', 7.25, 3.7, 3.88, 0.16, sand, 192);
    // Fine external iron hoops, with small tie plates visible in the owner elevations.
    for (let y = 9.1; y < 36.8; y += district ? 4.6 : 2.3) {
      const r = radius(y);
      ring(out, 'metal', y, r - 0.009, r + 0.026, 0.042, [0.35, 0.32, 0.26], 192);
      for (const a of [0.08, Math.PI + 0.08])
        box(
          transformed(out, a),
          'metal',
          [-0.12, y - 0.1, r + 0.025],
          [0.12, y + 0.13, r + 0.044],
          [0.34, 0.3, 0.245],
        );
    }
    skagenMonogram(out);
    lathe(
      out,
      'limestone',
      [
        [37.48, 2.96],
        [37.73, 3.07],
        [37.94, 3.38],
        [38.2, 3.61],
        [38.37, 3.75],
        [38.69, 3.75],
        [38.82, 3.9],
      ],
      sand,
      192,
    );
    ring(out, 'limestone', 38.8, 1.91, 3.91, 0.21, [0.72, 0.71, 0.64], 192);
    roundRail(out, 3.8, 39.03, 1.06, 144, [0.3, 0.23, 0.16]);
    lathe(
      out,
      'plaster',
      [
        [39.01, 2.59],
        [39.73, 2.59],
      ],
      skagenWall,
      144,
    );
    for (let i = 0; i < 24; i++)
      tube(
        out,
        'metal',
        P(2.6, 39.06, (i * TAU) / 24),
        P(2.6, 39.72, (i * TAU) / 24),
        0.019,
        skagenMetal,
        8,
      );
    const y0 = 39.77,
      y1 = 43.13,
      r = 2.08,
      n = close ? 24 : district ? 12 : 24;
    for (let i = 0; i < n; i++) {
      const a = (i * TAU) / n,
        b = ((i + 1) * TAU) / n,
        ps = [P(r, y0, a), P(r, y0, b), P(r, y1, b), P(r, y1, a)];
      quad(out, 'glassClear', ps, normalFor(...ps.slice(0, 3)), [0.67, 0.82, 0.8]);
    }
    // Three stacked diamond tiers, matching the exceptionally clear authority lantern photo.
    for (let j = 0; j < (district ? 1 : 3); j++)
      for (let i = 0; i < 12; i++) {
        const a = (i * TAU) / 12,
          b = ((i + 1) * TAU) / 12,
          yy = y0 + (j * (y1 - y0)) / (district ? 1 : 3),
          dy = (y1 - y0) / (district ? 1 : 3);
        path(
          out,
          Array.from({ length: close ? 9 : district ? 2 : 3 }, (_, k) =>
            P(
              r + 0.026,
              yy + (dy * k) / (close ? 8 : district ? 1 : 2),
              a + ((b - a) * k) / (close ? 8 : district ? 1 : 2),
            ),
          ),
          'metal',
          skagenMetal,
          0.031,
        );
        path(
          out,
          Array.from({ length: close ? 9 : district ? 2 : 3 }, (_, k) =>
            P(
              r + 0.026,
              yy + (dy * k) / (close ? 8 : district ? 1 : 2),
              b - ((b - a) * k) / (close ? 8 : district ? 1 : 2),
            ),
          ),
          'metal',
          skagenMetal,
          0.031,
        );
      }
    for (const y of [y0, y0 + (y1 - y0) / 3, y0 + (2 * (y1 - y0)) / 3, y1])
      ring(out, 'metal', y - 0.018, r - 0.015, r + 0.085, 0.045, skagenMetal, 144);
    const dome = [
      [43.15, 2.46],
      [43.26, 2.36],
      [43.39, 2.08],
      [43.62, 1.91],
      [43.97, 1.79],
      [44.3, 1.56],
      [44.55, 1.26],
      [44.73, 0.87],
      [44.85, 0.39],
      [45.01, 0.28],
      [45.13, 0.23],
    ];
    lathe(out, 'metal', dome, skagenMetal, 192);
    roofSeams(out, dome, 12, [0.48, 0.49, 0.45]);
    sphere(out, 'metal', [0, 45.43, 0], [0.32, 0.32, 0.32], skagenMetal, 48, 24);
    tube(out, 'metal', [0, 45.73, 0], [0, 46, 0], 0.013, black, 8);
    // Large rotating lens visible through the published diamond glazing.
    lathe(
      out,
      'metal',
      [
        [39.74, 0.55],
        [40.42, 0.55],
      ],
      white,
      64,
    );
    lathe(
      out,
      'glassClear',
      [
        [40.44, 0.55],
        [40.68, 0.89],
        [41.25, 1.14],
        [41.62, 1.14],
        [42.3, 0.64],
        [42.68, 0.25],
      ],
      [0.58, 0.84, 0.77],
      96,
    );
    for (let y = 40.6; !district && y < 42.55; y += close ? 0.12 : 0.24) {
      const r =
        y < 41.25 ? 0.89 + (y - 40.68) * 0.44 : y < 41.62 ? 1.14 : 1.14 - (y - 41.62) * 0.77;
      ring(out, 'metal', y, Math.max(0.24, r - 0.024), r + 0.015, 0.013, [0.56, 0.64, 0.54], 96);
    }
    // Exact mapped ensemble: connector, two-storey keeper house and two rear side wings.
    const main = [];
    for (const face of [0, 2])
      for (const y of [0.76, 4.32])
        for (let i = 0; i < 7; i++) {
          const x = -8.13 + i * 2.71;
          if (face === 2 && y < 1 && Math.abs(x) < 2.1) continue;
          main.push({ face, x, y, w: 1.07, h: 1.92, door: face === 0 && i === 3 && y < 1 });
        }
    for (const face of [1, 3])
      for (const y of [0.76, 4.32])
        for (const x of [-2.65, 2.65]) main.push({ face, x, y, w: 1.05, h: 1.92 });
    skagenHouse(out, { cz: 17.28, rx: 10.47, rz: 5.47, eave: 7.2, ridge: 10.06, windows: main });
    skagenHouse(out, {
      cz: 7.56,
      rx: 2.07,
      rz: 4.3,
      eave: 3.66,
      ridge: 3.95,
      gable: false,
      windows: [
        ...[-2.55, 0, 2.55].flatMap((x) =>
          [1, 3].map((face) => ({
            face,
            x,
            y: x === 0 ? 0.24 : 0.83,
            w: x === 0 ? 1.22 : 1.12,
            h: x === 0 ? 2.66 : 2.06,
            door: x === 0,
          })),
        ),
      ],
    });
    for (const cx of [-17.04, 16.91]) {
      const ws = [];
      for (const face of [0, 2])
        for (const x of [-2.46, 0, 2.46])
          ws.push({ face, x, y: 0.36, w: x === 0 ? 1.19 : 0.88, h: 2.44, door: true });
      for (const face of [1, 3])
        for (const x of [-3.62, -1.2, 1.2, 3.62]) ws.push({ face, x, y: 0.78, w: 0.91, h: 1.48 });
      skagenHouse(out, {
        cx,
        cz: 28.31,
        rx: 4.11,
        rz: 5.57,
        eave: 3.55,
        ridge: 6.3,
        gable: true,
        windows: ws,
      });
    }
    // Courtyard enclosure ends at the two wing backs; it does not include surrounding dunes.
    courtyardLinks(out, close ? 12 : district ? 2 : 6);
    box(out, 'plaster', [-12.93, 0.12, 33.56], [12.8, 1.29, 34.0], skagenWall);
    box(out, 'limestone', [-13, 1.29, 33.5], [12.9, 1.38, 34.06], sand);
    for (let x = -11.8; !district && x < 13; x += 3.9)
      box(out, 'plaster', [x - 0.15, 0.13, 33.38], [x + 0.15, 1.49, 34.03], skagenWall);
  }

  return (out) => {
    const mapped = {};
    for (const method of ['addQuad', 'addTriangle', 'addConvexPolygon'])
      mapped[method] = (slot, ...args) =>
        out[method](slot === 'limestone' ? 'granite' : slot, ...args);
    buildSkagen(mapped);
  };
}
export const skagenDistrict = components('district');
export const skagenStreet = components('street');
export const skagenCloseup = components('closeup');

/** Entire joined lighthouse/keeper-house/courtyard ensemble at skyline distance. */
export function skagenSkyline(out) {
  const TAU = Math.PI * 2,
    brick = [0.51, 0.38, 0.265],
    wall = [0.82, 0.81, 0.735],
    frame = [0.18, 0.24, 0.19],
    metal = [0.39, 0.415, 0.4],
    sand = [0.79, 0.75, 0.64],
    glass = [0.18, 0.22, 0.2];
  const P = (r, y, a) => [r * Math.sin(a), y, r * Math.cos(a)],
    turn = (out) => transformed(out, Math.PI / 8);
  fullLathe(
    turn(out),
    'granite',
    [
      [0, 4.15],
      [0.98, 3.96],
      [1.22, 3.75],
    ],
    [0.55, 0.54, 0.48],
    8,
  );
  fullLathe(
    turn(out),
    'brick',
    [
      [1.22, 3.75],
      [7.4, 3.75],
      [37.55, 2.93],
    ],
    brick,
    8,
  );
  const radius = (y) => (y <= 7.4 ? 3.75 : 3.75 - ((y - 7.4) * 0.82) / (37.55 - 7.4));
  for (let i = 0; i < 4; i++)
    for (const [ys, angles] of [
      [8, [Math.PI - 0.55, -0.55]],
      [11.4, [Math.PI + 0.58, 0.58]],
    ])
      for (const angle of angles) {
        const y = ys + i * 7.12,
          a = (Math.round(angle / (TAU / 8)) * TAU) / 8,
          r = radius(y + 0.63) * Math.cos(Math.PI / 8),
          x = r * Math.tan(angle - a),
          o = transformed(transformed(out, a), 0, [x, 0, 0]);
        panel(o, 'glass', -0.29, 0.29, y, y + 1.26, r + 0.035, glass);
      }
  for (let i = 0; i < 4; i++) {
    const y = 9.1 + i * 9.2,
      r = radius(y) + 0.026;
    for (let j = 0; j < 8; j++) {
      const a = Math.PI / 8 + (j * TAU) / 8,
        b = Math.PI / 8 + ((j + 1) * TAU) / 8,
        ps = [P(r, y, a), P(r, y, b), P(r, y + 0.042, b), P(r, y + 0.042, a)];
      quad(out, 'metal', ps, normalFor(...ps.slice(0, 3)), [0.35, 0.32, 0.26]);
    }
  }
  fullLathe(
    turn(out),
    'limestone',
    [
      [37.48, 2.96],
      [38.37, 3.75],
      [39.01, 3.91],
    ],
    sand,
    8,
  );
  fullLathe(
    turn(out),
    'plaster',
    [
      [39.01, 2.59],
      [39.73, 2.59],
    ],
    wall,
    8,
  );
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i * TAU) / 8,
      b = Math.PI / 8 + ((i + 1) * TAU) / 8,
      ps = [P(3.8, 40.06, a), P(3.8, 40.06, b), P(3.8, 40.12, b), P(3.8, 40.12, a)],
      o = transformed(out, a);
    quad(out, 'metal', ps, normalFor(...ps.slice(0, 3)), frame);
    panel(o, 'metal', -0.022, 0.022, 39.03, 40.09, 3.8, frame);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i * TAU) / 8,
      b = ((i + 1) * TAU) / 8,
      ps = [P(2.08, 39.77, a), P(2.08, 39.77, b), P(2.08, 43.13, b), P(2.08, 43.13, a)];
    quad(out, 'glass', ps, normalFor(...ps.slice(0, 3)), [0.4, 0.5, 0.49]);
    for (const reverse of [false, true]) {
      const p = P(2.1, 39.77, reverse ? b : a),
        q = P(2.1, 43.13, reverse ? a : b),
        ribbon = [
          [p[0], p[1] - 0.031, p[2]],
          [q[0], q[1] - 0.031, q[2]],
          [q[0], q[1] + 0.031, q[2]],
          [p[0], p[1] + 0.031, p[2]],
        ];
      if (
        normalFor(...ribbon.slice(0, 3))[0] * (p[0] + q[0]) +
          normalFor(...ribbon.slice(0, 3))[2] * (p[2] + q[2]) <
        0
      )
        ribbon.reverse();
      quad(out, 'metal', ribbon, normalFor(...ribbon.slice(0, 3)), metal);
    }
  }
  fullLathe(
    out,
    'metal',
    [
      [43.15, 2.46],
      [43.97, 1.79],
      [44.73, 0.87],
      [45.13, 0.23],
      [45.43, 0.32],
      [45.73, 0.08],
      [46, 0.013],
    ],
    metal,
    8,
  );
  function house({ cx = 0, cz = 0, rx, rz, eave, ridge, gable = false, windows = [] }) {
    const o = transformed(out, 0, [cx, 0, cz]),
      X = rx + 0.22,
      Z = rz + 0.22;
    fullBox(o, 'granite', [-rx, 0, -rz], [rx, 0.29, rz], [0.14, 0.155, 0.14]);
    fullBox(o, 'plaster', [-rx, 0.29, -rz], [rx, eave, rz], wall);
    for (const h of windows) {
      const f = h.face,
        z = f % 2 ? rx : rz,
        face = transformed(o, (f * Math.PI) / 2),
        x = h.x;
      panel(face, 'glass', x - h.w / 2, x + h.w / 2, h.y, h.y + h.h, z + 0.015, glass);
      if (h.door)
        panel(
          face,
          'wood',
          x - h.w / 2 + 0.04,
          x + h.w / 2 - 0.04,
          h.y + 0.03,
          h.y + 0.75,
          z + 0.02,
          frame,
        );
    }
    const roof = [];
    if (ridge - eave < 0.5)
      roof.push([
        [-X, eave + 0.11, -Z],
        [-X, eave + 0.11, Z],
        [X, eave + 0.11, Z],
        [X, eave + 0.11, -Z],
      ]);
    else if (gable) {
      for (const sign of [-1, 1]) {
        roof.push([
          [0, ridge, -Z],
          [0, ridge, Z],
          [sign * X, eave, Z],
          [sign * X, eave, -Z],
        ]);
        const ps = [
          [-rx, eave, sign * rz],
          [rx, eave, sign * rz],
          [0, ridge - 0.07, sign * rz],
        ];
        if (normalFor(...ps)[2] * sign < 0) ps.reverse();
        o.addTriangle(
          'plaster',
          'metric:uv',
          ps,
          normalFor(...ps),
          ps.map((p) => [p[0], p[1]]),
          wall,
        );
        panel(
          transformed(o, sign < 0 ? Math.PI : 0),
          'glass',
          -0.27,
          0.27,
          eave + 0.33,
          eave + 1.14,
          rz + 0.015,
          glass,
        );
      }
    } else {
      const x = rx - rz + 0.3;
      roof.push(
        [
          [-X, eave, -Z],
          [X, eave, -Z],
          [x, ridge, 0],
          [-x, ridge, 0],
        ],
        [
          [X, eave, Z],
          [-X, eave, Z],
          [-x, ridge, 0],
          [x, ridge, 0],
        ],
        [
          [-X, eave, Z],
          [-X, eave, -Z],
          [-x, ridge, 0],
        ],
        [
          [X, eave, -Z],
          [X, eave, Z],
          [x, ridge, 0],
        ],
      );
      for (const x of [-5.05, 5.05])
        fullBox(o, 'plaster', [x - 0.46, ridge - 0.25, -0.4], [x + 0.46, ridge + 1.25, 0.4], wall);
    }
    for (const ps of roof) {
      if (normalFor(...ps.slice(0, 3))[1] < 0) ps.reverse();
      if (ps.length === 4) quad(o, 'metal', ps, normalFor(...ps.slice(0, 3)), metal);
      else
        o.addTriangle(
          'metal',
          'metric:uv',
          ps,
          normalFor(...ps),
          ps.map((p) => [p[0], p[2]]),
          metal,
        );
    }
  }
  const main = [];
  for (const face of [0, 2])
    for (const y of [0.76, 4.32])
      for (let i = 0; i < 7; i++) {
        const x = -8.13 + i * 2.71;
        if (face === 2 && y < 1 && Math.abs(x) < 2.1) continue;
        main.push({ face, x, y, w: 1.07, h: 1.92, door: face === 0 && i === 3 && y < 1 });
      }
  for (const face of [1, 3])
    for (const y of [0.76, 4.32])
      for (const x of [-2.65, 2.65]) main.push({ face, x, y, w: 1.05, h: 1.92 });
  house({ cz: 17.28, rx: 10.47, rz: 5.47, eave: 7.2, ridge: 10.06, windows: main });
  house({
    cz: 7.56,
    rx: 2.07,
    rz: 4.3,
    eave: 3.66,
    ridge: 3.95,
    windows: [
      ...[-2.55, 0, 2.55].flatMap((x) =>
        [1, 3].map((face) => ({
          face,
          x,
          y: x === 0 ? 0.24 : 0.83,
          w: x === 0 ? 1.22 : 1.12,
          h: x === 0 ? 2.66 : 2.06,
          door: x === 0,
        })),
      ),
    ],
  });
  for (const cx of [-17.04, 16.91]) {
    const windows = [];
    for (const face of [0, 2])
      for (const x of [-2.46, 0, 2.46])
        windows.push({ face, x, y: 0.36, w: x === 0 ? 1.19 : 0.88, h: 2.44, door: true });
    for (const face of [1, 3])
      for (const x of [-3.62, -1.2, 1.2, 3.62])
        windows.push({ face, x, y: 0.78, w: 0.91, h: 1.48 });
    house({ cx, cz: 28.31, rx: 4.11, rz: 5.57, eave: 3.55, ridge: 6.3, gable: true, windows });
  }
  courtyardLinks(out, 2);
  fullBox(out, 'plaster', [-13, 0, 33.5], [12.9, 1.38, 34.06], wall);
}
