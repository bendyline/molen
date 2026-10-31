/** Complete source-local Lizard Lighthouse browser levels; the detailed master is preserved. */
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
  piercedFacade as fullPiercedFacade,
  panel,
  transformed,
} from '../../../../../../../../packages/worldgen/scripts/lighthouse-models.mjs';
import {
  box as fullBox,
  tube as fullTube,
  quad,
  tubePath,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

function components(level) {
  const skyline = level === 'skyline',
    district = level === 'district',
    close = level === 'closeup',
    segments = close ? 48 : district ? 12 : 24,
    diamondSteps = close ? 12 : district ? 3 : 6,
    baySegments = close ? 32 : district ? 8 : 16,
    hornSegments = close ? 32 : district ? 8 : 16,
    TAU = Math.PI * 2,
    white = [0.87, 0.88, 0.84],
    dark = [0.065, 0.075, 0.071];
  const P = (r, y, a) => [r * Math.sin(a), y, r * Math.cos(a)];
  function lathe(out, slot, profile, color, n = 64, center = [0, 0]) {
    fullLathe(
      out,
      slot,
      profile,
      color,
      Math.min(
        n,
        n === 8
          ? 8
          : Math.max(...profile.map((p) => p[1])) < 0.6
            ? close
              ? 16
              : district
                ? 4
                : 8
            : segments,
      ),
      center,
    );
  }
  function ring(out, slot, y, inner, outer, h, color, n = 80) {
    fullRing(
      out,
      slot,
      y,
      inner,
      outer,
      h,
      color,
      Math.min(n, outer < 1 ? (close ? 24 : district ? 8 : 12) : segments),
    );
  }
  function shell(out, options) {
    fullShell(out, { ...options, segments: Math.min(options.segments ?? 128, segments) });
  }
  function box(out, slot, a, b, color) {
    if (!close && b[2] - a[2] < 0.25 && (b[0] - a[0] < 0.35 || b[1] - a[1] < 0.35))
      panel(out, slot, a[0], b[0], a[1], b[1], b[2], color);
    else fullBox(out, slot, a, b, color);
  }
  function tube(out, slot, a, b, r, color, n = 8) {
    if (district && r <= 0.031 && Math.min(a[1], b[1]) >= 14.39 && Math.max(a[1], b[1]) <= 15.31) {
      const vertical = Math.abs(b[1] - a[1]) > 0.1,
        ps = vertical
          ? [
              [a[0] - r, a[1], a[2]],
              [a[0] + r, a[1], a[2]],
              [b[0] + r, b[1], b[2]],
              [b[0] - r, b[1], b[2]],
            ]
          : [
              [a[0], a[1] - r, a[2]],
              [b[0], b[1] - r, b[2]],
              [b[0], b[1] + r, b[2]],
              [a[0], a[1] + r, a[2]],
            ];
      quad(out, slot, ps, normalFor(...ps.slice(0, 3)), color);
      ps.reverse();
      quad(out, slot, ps, normalFor(...ps.slice(0, 3)), color);
      return;
    }
    if (district && r < 0.03 && Math.min(a[1], b[1]) < 14) return;
    fullTube(out, slot, a, b, r, color, Math.min(n, close ? 6 : district ? 3 : 4));
  }
  function sphere(out, slot, p, r, color, n = 20, m = 10) {
    if (Math.max(...r) < 0.1) {
      if (!close) return;
      n = 8;
      m = 4;
    }
    fullSphere(
      out,
      slot,
      p,
      r,
      color,
      Math.min(n, close ? 20 : district ? 8 : 12),
      Math.min(m, close ? 10 : district ? 4 : 6),
    );
  }
  function line(out, points, slot, color, r = 0.018) {
    if (skyline || r < 0.02) return;
    const ps = points;
    if (district && r < 0.04) {
      for (let i = 1; i < ps.length; i++) {
        const a = ps[i - 1],
          b = ps[i],
          dx = b[0] - a[0],
          dy = b[1] - a[1],
          dz = b[2] - a[2],
          nx = a[0] + b[0],
          nz = a[2] + b[2],
          across = [dy * nz, dz * nx - dx * nz, -dy * nx],
          length = Math.hypot(...across),
          u = across.map((v) => (v / length) * r),
          q = [
            a.map((v, k) => v + u[k]),
            b.map((v, k) => v + u[k]),
            b.map((v, k) => v - u[k]),
            a.map((v, k) => v - u[k]),
          ];
        quad(out, slot, q, normalFor(...q.slice(0, 3)), color);
        q.reverse();
        quad(out, slot, q, normalFor(...q.slice(0, 3)), color);
      }
    } else tubePath(out, slot, ps, r, color, close ? 6 : 4);
  }
  function roofSeams() {}
  function simpleGlass(out, r, y0, y1, n, color = white) {
    n = close ? 24 : district ? 12 : 16;
    for (let i = 0; i < n; i++) {
      const a = (i * TAU) / n,
        b = ((i + 1) * TAU) / n;
      quad(
        out,
        'glassClear',
        [P(r, y0, a), P(r, y0, b), P(r, y1, b), P(r, y1, a)],
        [Math.sin((a + b) / 2), 0, Math.cos((a + b) / 2)],
        [0.78, 0.86, 0.83],
      );
      tube(out, 'metal', P(r + 0.018, y0, a), P(r + 0.018, y1, a), 0.035, color, 6);
    }
  }
  function piercedFacade(out, o) {
    if (!district) return fullPiercedFacade(out, o);
    panel(out, o.slot, -o.half, o.half, o.y0, o.y1, o.z, o.color);
    for (const h of o.holes) {
      panel(
        out,
        h.door ? 'wood' : 'glass',
        h.x - h.w / 2,
        h.x + h.w / 2,
        h.y,
        h.y + h.h,
        o.z + 0.015,
        h.door ? [0.15, 0.245, 0.21] : [0.09, 0.115, 0.12],
      );
    }
  }
  function roofFace(out, slot, ps, c) {
    quad(out, slot, ps, normalFor(...ps.slice(0, 3)), c);
  }
  function hipRoof(
    out,
    { x0, x1, z0, z1, y, rise, slot = 'tiles', color = [0.4, 0.23, 0.13], seams = false },
  ) {
    const dx = (x1 - x0) / 2,
      dz = (z1 - z0) / 2,
      cz = (z0 + z1) / 2;
    if (dx >= dz) {
      const a = [x0 + dz, y + rise, cz],
        b = [x1 - dz, y + rise, cz];
      roofFace(out, slot, [a, b, [x1, y, z0], [x0, y, z0]], color);
      roofFace(out, slot, [b, a, [x0, y, z1], [x1, y, z1]], color);
      out.addTriangle(
        slot,
        'palette:#fff',
        [[x0, y, z0], [x0, y, z1], a],
        normalFor([x0, y, z0], [x0, y, z1], a),
        [
          [0, 0],
          [2 * dz, 0],
          [dz, Math.hypot(dz, rise)],
        ],
        color,
      );
      out.addTriangle(
        slot,
        'palette:#fff',
        [[x1, y, z1], [x1, y, z0], b],
        normalFor([x1, y, z1], [x1, y, z0], b),
        [
          [0, 0],
          [2 * dz, 0],
          [dz, Math.hypot(dz, rise)],
        ],
        color,
      );
      if (seams)
        for (let x = x0 + 0.2; x < x1; x += 0.42)
          for (const z of [z0, z1]) {
            const X = Math.max(x0 + dz, Math.min(x1 - dz, x));
            line(
              out,
              [
                [x, y + 0.016, z],
                [X, y + rise + 0.016, cz],
              ],
              'metal',
              color,
              0.014,
            );
          }
      line(out, [a, b], 'metal', color, 0.045);
    } else
      hipRoof(transformed(out, Math.PI / 2), {
        x0: -z1,
        x1: -z0,
        z0: x0,
        z1: x1,
        y,
        rise,
        slot,
        color,
        seams,
      });
  }
  function framedWindow(out, h, z, color = white, { hood = false, greenSill = false } = {}) {
    if (district) {
      const { x = 0, y, w, h: height } = h;
      if (hood)
        panel(
          out,
          'plaster',
          x - w / 2 - 0.18,
          x + w / 2 + 0.18,
          y + height + 0.11,
          y + height + 0.25,
          z + 0.1,
          white,
        );
      if (greenSill)
        panel(
          out,
          'metal',
          x - w / 2 - 0.1,
          x + w / 2 + 0.1,
          y - 0.09,
          y + 0.015,
          z + 0.12,
          [0.075, 0.34, 0.22],
        );
      return;
    }
    const { x = 0, y, w, h: height, depth = 0.22 } = h,
      t = 0.045;
    for (const X of [x - w / 2, x + w / 2])
      box(out, 'metal', [X - t, y, z - depth + 0.01], [X + t, y + height, z - depth + 0.08], color);
    for (const Y of [y, y + height * 0.58, y + height])
      box(
        out,
        'metal',
        [x - w / 2, Y - t, z - depth + 0.015],
        [x + w / 2, Y + t, z - depth + 0.075],
        color,
      );
    box(out, 'metal', [x - t, y, z - depth + 0.018], [x + t, y + height, z - depth + 0.08], color);
    if (hood) {
      box(
        out,
        'plaster',
        [x - w / 2 - 0.2, y + height + 0.12, z - 0.06],
        [x + w / 2 + 0.2, y + height + 0.26, z + 0.15],
        white,
      );
      for (const X of [x - w / 2 - 0.13, x + w / 2 + 0.13])
        box(
          out,
          'plaster',
          [X - 0.06, y + height - 0.05, z - 0.06],
          [X + 0.06, y + height + 0.23, z + 0.15],
          white,
        );
    }
    if (greenSill)
      box(
        out,
        'metal',
        [x - w / 2 - 0.1, y - 0.09, z - 0.12],
        [x + w / 2 + 0.1, y + 0.015, z + 0.12],
        [0.075, 0.34, 0.22],
      );
  }

  function farHouse(out, { x0, x1, z0, z1, eave, rise, windows, gable }) {
    const cx = (x0 + x1) / 2,
      cz = (z0 + z1) / 2,
      rx = (x1 - x0) / 2,
      rz = (z1 - z0) / 2,
      o = transformed(out, 0, [cx, 0, cz]);
    fullBox(o, 'plaster', [-rx, 0, -rz], [rx, eave, rz], lWall);
    for (const [f, h] of windows.entries()) {
      if (
        skyline &&
        ((windows.length > 12 && f % 2) || (windows.length < 8 && !h.door && h.face % 2))
      )
        continue;
      const face = transformed(o, (h.face * Math.PI) / 2),
        z = h.face % 2 ? rx : rz;
      panel(
        face,
        h.door ? 'wood' : 'glass',
        h.x - h.w / 2,
        h.x + h.w / 2,
        h.y,
        h.y + h.h,
        z + 0.02,
        h.door ? [0.15, 0.245, 0.21] : [0.09, 0.115, 0.12],
      );
      if (district) framedWindow(face, h, z, white, { hood: true, greenSill: true });
    }
    const X = rx + 0.13,
      Z = rz + 0.15,
      Y = eave + 0.16,
      R = Y + rise;
    if (gable) {
      for (const ps of [
        [
          [-X, Y, Z],
          [X, Y, Z],
          [X, R, 0],
          [-X, R, 0],
        ],
        [
          [X, Y, -Z],
          [-X, Y, -Z],
          [-X, R, 0],
          [X, R, 0],
        ],
      ])
        quad(o, 'slate', ps, normalFor(...ps.slice(0, 3)), lSlate);
      for (const s of [-1, 1]) {
        const ps =
          s > 0
            ? [
                [rx, eave, -rz],
                [rx, eave, rz],
                [rx, R, 0],
              ]
            : [
                [-rx, eave, rz],
                [-rx, eave, -rz],
                [-rx, R, 0],
              ];
        o.addTriangle(
          'plaster',
          'metric:uv',
          ps,
          [s, 0, 0],
          [
            [0, 0],
            [2 * rz, 0],
            [rz, rise],
          ],
          lWall,
        );
      }
    } else hipRoof(o, { x0: -X, x1: X, z0: -Z, z1: Z, y: Y, rise, slot: 'slate', color: lSlate });
  }
  function ribbon(out, ps, color) {
    quad(out, 'metal', ps, normalFor(...ps.slice(0, 3)), color);
  }
  function farTower(out, active) {
    const r = 3.37,
      half = r * Math.tan(Math.PI / 8);
    fullLathe(
      transformed(out, Math.PI / 8),
      'plaster',
      [
        [0, r / Math.cos(Math.PI / 8) + 0.08],
        [0.32, r / Math.cos(Math.PI / 8) + 0.08],
      ],
      lWall,
      8,
    );
    for (let f = 0; f < 8; f++) {
      const o = transformed(out, (f * TAU) / 8);
      panel(o, 'plaster', -half, half, 0.31, 14.03, r, lWall);
      if (f % 2 === 0)
        for (const [y, w, h] of [
          [6.6, 0.74, 1.3],
          [11.18, 1.03, 1.27],
        ])
          panel(o, 'glass', -w / 2, w / 2, y, y + h, r + 0.01, [0.09, 0.115, 0.12]);
      const w = 3.48 * Math.tan(Math.PI / 8);
      panel(o, 'metal', -0.035, 0.035, 14.4, 15.28, 3.48, white);
      for (const y of [14.75, 15.21]) panel(o, 'metal', -w, w, y - 0.02, y + 0.02, 3.48, white);
    }
    fullLathe(
      transformed(out, Math.PI / 8),
      'plaster',
      [
        [13.9, 3.56 / Math.cos(Math.PI / 8)],
        [14.39, 3.69 / Math.cos(Math.PI / 8)],
      ],
      lWall,
      8,
    );
    if (!active) return;
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8,
        b = ((i + 1) * TAU) / 8,
        o = transformed(out, (a + b) / 2),
        w = 2.33 * Math.sin(Math.PI / 8),
        z = 2.33 * Math.cos(Math.PI / 8);
      quad(
        out,
        'glass',
        [P(2.33, 14.6, a), P(2.33, 14.6, b), P(2.33, 17.17, b), P(2.33, 17.17, a)],
        [Math.sin((a + b) / 2), 0, Math.cos((a + b) / 2)],
        [0.4, 0.52, 0.5],
      );
      panel(transformed(out, a), 'metal', -0.035, 0.035, 14.6, 17.17, 2.36, white);
      for (const s of [-1, 1]) {
        const lo = s > 0 ? 14.6 : 17.17,
          hi = s > 0 ? 17.17 : 14.6,
          ps = [
            [-w, lo - 0.02, z + 0.02],
            [w, hi - 0.02, z + 0.02],
            [w, hi + 0.02, z + 0.02],
            [-w, lo + 0.02, z + 0.02],
          ];
        ribbon(o, ps, white);
      }
    }
    fullLathe(
      out,
      'metal',
      [
        [17.17, 2.49],
        [17.6, 1.68],
        [18.16, 0.16],
        [18.62, 0.16],
      ],
      white,
      8,
    );
    fullTube(out, 'metal', [0, 18.52, 0], [0, 19, 0], 0.024, [0.64, 0.55, 0.3], 3);
    fullBox(out, 'metal', [-0.76, 18.78, -0.02], [0.77, 18.99, 0.02], [0.64, 0.55, 0.3]);
  }
  function farBay(out) {
    const o = transformed(out, 0, [-33.01, 0, 33.1]),
      n = 6;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / n,
        b = -Math.PI / 2 + ((i + 1) * Math.PI) / n;
      quad(
        o,
        'plaster',
        [P(3.46, 0, a), P(3.46, 0, b), P(3.46, 3.64, b), P(3.46, 3.64, a)],
        normalFor(P(3.46, 0, a), P(3.46, 0, b), P(3.46, 3.64, b)),
        lWall,
      );
      o.addTriangle(
        'metal',
        'metric:uv',
        [P(3.46, 3.65, a), P(3.46, 3.65, b), [0, 3.65, 0]],
        [0, 1, 0],
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        lSlate,
      );
    }
    for (const a of [-0.88, 0, 0.88])
      panel(transformed(o, a), 'glass', -0.6, 0.6, 0.84, 2.63, 3.47, [0.09, 0.115, 0.12]);
    for (const x of [-1.15, 1.15])
      ribbon(
        o,
        [
          [x - 0.07, 3.65, 0],
          [x + 0.07, 3.65, 0],
          [0.07, 7.12, 0],
          [-0.07, 7.12, 0],
        ],
        dark,
      );
    const profiles = [
      [0.02, 0.3],
      [0.95, 0.47],
      [1.5, 0.95],
    ];
    for (let j = 1; j < profiles.length; j++)
      for (let i = 0; i < 6; i++) {
        const a = (i * TAU) / 6,
          b = ((i + 1) * TAU) / 6,
          p = (k, t) => [
            profiles[k][1] * Math.cos(t),
            7.12 + profiles[k][1] * Math.sin(t),
            profiles[k][0],
          ];
        const ps = [p(j - 1, a), p(j - 1, b), p(j, b), p(j, a)];
        quad(o, 'metal', ps, normalFor(...ps.slice(0, 3)), dark);
      }
    for (let i = 0; i < 6; i++) {
      const a = (i * TAU) / 6,
        b = ((i + 1) * TAU) / 6;
      o.addTriangle(
        'metal',
        'metric:uv',
        [
          [0, 7.12, 1.49],
          [0.95 * Math.cos(a), 7.12 + 0.95 * Math.sin(a), 1.49],
          [0.95 * Math.cos(b), 7.12 + 0.95 * Math.sin(b), 1.49],
        ],
        [0, 0, 1],
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        [0.01, 0.012, 0.012],
      );
    }
  }
  const lWall = [0.91, 0.915, 0.87],
    lSlate = [0.235, 0.27, 0.28];
  function lizardHouse(
    out,
    { x0, x1, z0, z1, eave = 7.8, rise = 1.4, windows = [], gable = false },
  ) {
    if (skyline || district) return farHouse(out, { x0, x1, z0, z1, eave, rise, windows, gable });
    const cx = (x0 + x1) / 2,
      cz = (z0 + z1) / 2,
      rx = (x1 - x0) / 2,
      rz = (z1 - z0) / 2,
      o = transformed(out, 0, [cx, 0, cz]);
    box(o, 'plaster', [-rx, 0, -rz], [rx, 0.22, rz], lWall);
    for (let f = 0; f < 4; f++) {
      const h = windows.filter((h) => h.face === f).map((h) => ({ ...h, trim: 0 })),
        b = transformed(o, (f * Math.PI) / 2),
        half = f % 2 ? rz : rx,
        z = f % 2 ? rx : rz;
      piercedFacade(b, { half, y0: 0.22, y1: eave, z, holes: h, slot: 'plaster', color: lWall });
      for (const win of h) {
        framedWindow(b, win, z, white, { hood: true, greenSill: true });
        if (win.door)
          panel(
            b,
            'wood',
            win.x - win.w / 2 + 0.04,
            win.x + win.w / 2 - 0.04,
            win.y,
            win.y + win.h * 0.73,
            z - (win.depth ?? 0.22) + 0.09,
            [0.15, 0.245, 0.21],
          );
      }
      box(
        b,
        'plaster',
        [-half - 0.045, eave - 0.11, z - 0.12],
        [half + 0.045, eave + 0.19, z + 0.14],
        lWall,
      );
      for (const X of [-half + 0.13, half - 0.13])
        box(b, 'plaster', [X - 0.085, 0.22, z - 0.02], [X + 0.085, eave + 0.12, z + 0.11], white);
      tube(
        b,
        'metal',
        [-half - 0.05, eave + 0.07, z + 0.13],
        [half + 0.05, eave + 0.07, z + 0.13],
        0.055,
        dark,
        8,
      );
    }
    if (gable) {
      const X = rx + 0.13,
        Z = rz + 0.15,
        Y = eave + 0.16,
        R = Y + rise;
      roofFace(
        o,
        'slate',
        [
          [-X, Y, Z],
          [X, Y, Z],
          [X, R, 0],
          [-X, R, 0],
        ],
        lSlate,
      );
      roofFace(
        o,
        'slate',
        [
          [X, Y, -Z],
          [-X, Y, -Z],
          [-X, R, 0],
          [X, R, 0],
        ],
        lSlate,
      );
      for (const s of [-1, 1]) {
        const ps =
          s > 0
            ? [
                [rx, eave, -rz],
                [rx, eave, rz],
                [rx, R, 0],
              ]
            : [
                [-rx, eave, rz],
                [-rx, eave, -rz],
                [-rx, R, 0],
              ];
        o.addTriangle(
          'plaster',
          'palette:#fff',
          ps,
          [s, 0, 0],
          [
            [0, 0],
            [2 * rz, 0],
            [rz, rise],
          ],
          lWall,
        );
        line(
          o,
          [
            [s * (rx + 0.04), eave + 0.15, -rz],
            [s * (rx + 0.04), R + 0.05, 0],
            [s * (rx + 0.04), eave + 0.15, rz],
          ],
          'plaster',
          lWall,
          0.105,
        );
      }
      line(
        o,
        [
          [-X, R + 0.04, 0],
          [X, R + 0.04, 0],
        ],
        'metal',
        lSlate,
        0.06,
      );
    } else
      hipRoof(o, {
        x0: -rx - 0.15,
        x1: rx + 0.15,
        z0: -rz - 0.15,
        z1: rz + 0.15,
        y: eave + 0.16,
        rise,
        slot: 'slate',
        color: lSlate,
      });
    for (const x of [-rx + 0.2, rx - 0.2])
      tube(o, 'metal', [x, 0.28, rz + 0.15], [x, eave + 0.1, rz + 0.15], 0.044, dark, 8);
  }
  function lizardTower(out, active) {
    if (skyline) return farTower(out, active);
    const r = 3.37,
      h = 14.03,
      half = r * Math.tan(Math.PI / 8);
    lathe(
      transformed(out, Math.PI / 8),
      'plaster',
      [
        [0, r / Math.cos(Math.PI / 8) + 0.08],
        [0.32, r / Math.cos(Math.PI / 8) + 0.08],
      ],
      lWall,
      8,
    );
    for (let f = 0; f < 8; f++) {
      const o = transformed(out, (f * TAU) / 8);
      const hs = (
        f % 2 === 0
          ? [
              { x: 0, y: 6.6, w: 0.74, h: 1.3 },
              { x: 0, y: 11.18, w: 1.03, h: 1.27 },
            ]
          : []
      ).map((h) => ({ ...h, depth: 0.31, trim: 0 }));
      if (f === 4) hs.push({ x: 0, y: 0.33, w: 1.11, h: 2.29, depth: 0.29, trim: 0, door: true });
      piercedFacade(o, { half, y0: 0.31, y1: h, z: r, holes: hs, slot: 'plaster', color: lWall });
      for (const w of hs) {
        framedWindow(o, w, r, white, { hood: true });
        if (w.door) panel(o, 'wood', -0.51, 0.51, 0.34, 1.93, r - 0.19, [0.12, 0.18, 0.15]);
      }
      box(o, 'plaster', [-half - 0.025, 13.9, r - 0.07], [half + 0.025, 14.1, r + 0.19], white);
      box(o, 'plaster', [-half - 0.075, 14.1, r - 0.08], [half + 0.075, 14.26, r + 0.28], lWall);
    }
    lathe(
      transformed(out, Math.PI / 8),
      'plaster',
      [
        [14.26, 3.69 / Math.cos(Math.PI / 8)],
        [14.39, 3.69 / Math.cos(Math.PI / 8)],
      ],
      lWall,
      8,
    );
    const rr = 3.48;
    for (let f = 0; f < 8; f++) {
      const o = transformed(out, (f * TAU) / 8),
        w = rr * Math.tan(Math.PI / 8);
      for (const y of [14.75, 15.21]) tube(o, 'metal', [-w, y, rr], [w, y, rr], 0.025, white, 10);
      for (let x = -w; x <= w + 0.01; x += w / (district ? 1 : 2)) {
        tube(o, 'metal', [x, 14.4, rr], [x, 15.28, rr], 0.031, white, 10);
        sphere(o, 'metal', [x, 15.29, rr], [0.061, 0.077, 0.061], white, 20, 10);
      }
      for (const x of [-w * 0.65, 0, w * 0.65])
        line(
          o,
          Array.from({ length: 25 }, (_, i) => [
            x + 0.14 * Math.cos((i * TAU) / 24),
            14.87 + 0.14 * Math.sin((i * TAU) / 24),
            rr,
          ]),
          'metal',
          white,
          0.014,
        );
    }
    if (!active) {
      lathe(
        out,
        'metal',
        [
          [14.4, 0.34],
          [14.49, 0.34],
        ],
        dark,
        64,
      );
      return;
    }
    lathe(
      out,
      'metal',
      [
        [14.39, 2.49],
        [14.58, 2.49],
      ],
      white,
      128,
    );
    simpleGlass(out, 2.33, 14.6, 17.17, 32, white);
    // Diamond glazing, two diagonal directions, follows the cylinder rather than straight chords.
    for (let i = 0; i < (district ? 8 : 16); i++)
      for (const sign of [-1, 1])
        line(
          out,
          Array.from({ length: diamondSteps + 1 }, (_, j) =>
            P(
              2.366,
              14.6 + (2.57 * j) / diamondSteps,
              (i * TAU) / (district ? 8 : 16) + (((sign * TAU) / 8) * j) / diamondSteps,
            ),
          ),
          'metal',
          white,
          0.028,
        );
    const dome = [
      [17.17, 2.49],
      [17.28, 2.49],
      [17.6, 1.68],
      [17.85, 0.79],
      [17.99, 0.22],
    ];
    lathe(out, 'metal', dome, white, 160);
    roofSeams(out, dome, 16, [0.72, 0.75, 0.71]);
    lathe(
      out,
      'metal',
      [
        [17.99, 0.19],
        [18.16, 0.16],
      ],
      white,
      64,
    );
    sphere(out, 'metal', [0, 18.36, 0], [0.26, 0.26, 0.26], white, 48, 24);
    tube(out, 'metal', [0, 18.52, 0], [0, 19, 0], 0.024, [0.64, 0.55, 0.3], 10);
    beam(out, 'metal', [-0.76, 18.8, 0], [0.74, 18.8, 0], 0.035, 0.035, [0.64, 0.55, 0.3]);
    const vane = [
      [-0.76, 18.8, 0],
      [-0.47, 18.95, 0],
      [-0.47, 18.65, 0],
    ];
    out.addTriangle(
      'metal',
      'palette:#fff',
      vane,
      [0, 0, 1],
      [
        [0, 0],
        [1, 1],
        [1, 0],
      ],
      [0.64, 0.55, 0.3],
    );
    out.addTriangle(
      'metal',
      'palette:#fff',
      [...vane].reverse(),
      [0, 0, -1],
      [
        [0, 0],
        [1, 1],
        [1, 0],
      ],
      [0.64, 0.55, 0.3],
    );
    box(out, 'metal', [0.3, 18.63, -0.013], [0.77, 18.99, 0.013], [0.64, 0.55, 0.3]);
    lathe(
      out,
      'metal',
      [
        [14.58, 0.42],
        [15.0, 0.42],
      ],
      white,
      64,
    );
    lathe(
      out,
      'glassClear',
      [
        [15.0, 0.39],
        [15.16, 0.69],
        [15.5, 0.83],
        [16.08, 0.83],
        [16.53, 0.47],
        [16.76, 0.24],
      ],
      [0.59, 0.79, 0.65],
      96,
    );
    for (let y = 15.11; y < 16.65; y += close ? 0.21 : district ? 0.7 : 0.35) {
      const r = y < 15.5 ? 0.65 + (y - 15.16) * 0.53 : y < 16.08 ? 0.84 : 0.84 - (y - 16.08) * 0.69;
      ring(out, 'metal', y, r - 0.022, r + 0.012, 0.014, [0.44, 0.56, 0.43], 96);
    }
    const antenna = transformed(out, 0.6);
    for (let y = 14.52; y < 15.82; y += 0.3)
      box(antenna, 'metal', [-0.14, y, 3.4], [0.14, y + 0.17, 3.56], white);
    beam(antenna, 'metal', [0.8, 14.49, 3.45], [1.8, 15.1, 4.4], 0.045, 0.045, white);
  }
  function lizardChimney(out, x, z, y = 9.14) {
    if (skyline)
      return fullBox(
        out,
        'metal',
        [x - 0.56, y - 0.06, z - 0.42],
        [x + 0.56, y + 2.85, z + 0.42],
        dark,
      );
    box(out, 'metal', [x - 0.56, y, z - 0.42], [x + 0.56, y + 2.29, z + 0.42], dark);
    box(out, 'metal', [x - 0.64, y + 2.13, z - 0.5], [x + 0.64, y + 2.3, z + 0.5], dark);
    if (district) {
      for (const dx of [-0.33, 0, 0.33])
        panel(out, 'metal', x + dx - 0.12, x + dx + 0.12, y + 2.29, y + 2.85, z + 0.01, dark);
      return;
    }
    for (const dx of [-0.33, 0, 0.33])
      lathe(
        out,
        'metal',
        [
          [y + 2.29, 0.095],
          [y + 2.8, 0.092],
          [y + 2.85, 0.12],
        ],
        dark,
        32,
        [x + dx, z],
      );
  }
  function buildLizard(out) {
    lizardTower(out, true);
    lizardTower(transformed(out, 0, [-67.95, 0, 2.82]), false);
    const windows = [];
    for (const face of [0, 2])
      for (const y of [1.05, 4.69])
        for (let i = 0; i < 11; i++)
          windows.push({ face, x: -25.2 + i * 5.1, y, w: 1.36, h: 1.56, depth: 0.26 });
    lizardHouse(out, { x0: -63.9, x1: -3.37, z0: 0.18, z1: 9.16, eave: 7.43, rise: 1.52, windows });
    // Projecting end bays of the keeper range have street-facing gables and hooded paired windows.
    for (const [cx, z] of [
      [-59.18, 10.77],
      [-8.2, 10.32],
    ]) {
      const o = transformed(out, Math.PI / 2, [cx, 0, z]);
      lizardHouse(o, {
        x0: -2.82,
        x1: 2.82,
        z0: -2.7,
        z1: 2.7,
        eave: 7.83,
        rise: 1.13,
        gable: true,
        windows: [
          { face: 3, x: 0, y: 1.0, w: 1.3, h: 1.64 },
          { face: 3, x: 0, y: 4.77, w: 1.3, h: 1.5 },
          { face: 0, x: 0, y: 4.72, w: 1.16, h: 1.45 },
          { face: 2, x: 0, y: 4.72, w: 1.16, h: 1.45 },
        ],
      });
    }
    for (const x of [-58, -48, -38, -28, -18, -8]) lizardChimney(out, x, 4.67, 9.14);
    // Individually mapped rear outshuts and hipped service wings.
    for (const [x0, x1, z0, z1] of [
      [-60.02, -55.87, -7.63, 1.75],
      [-53.97, -49.6, -7.87, 1.97],
      [-48.05, -43.73, -9.96, 0.04],
      [-39.58, -34.77, -11.05, 0.11],
      [-30.05, -25.47, -7.83, 0.25],
      [-16.43, -12.93, -8.54, 0.22],
      [-8.86, -4.61, -8.9, 0.21],
    ]) {
      const half = (z1 - z0) / 2;
      lizardHouse(out, {
        x0,
        x1,
        z0,
        z1,
        eave: 3.24,
        rise: 1.25,
        windows: [
          { face: 2, x: 0, y: 0.55, w: 0.98, h: 1.62, door: true },
          ...[1, 3].flatMap((face) =>
            [-half * 0.52, half * 0.52].map((x) => ({ face, x, y: 0.87, w: 0.83, h: 1.27 })),
          ),
        ],
      });
    }
    lizardHouse(out, {
      x0: -51.89,
      x1: -41.2,
      z0: -15.48,
      z1: -9.96,
      eave: 3.4,
      rise: 1.42,
      windows: [
        ...[-3.5, 0, 3.5].map((x) => ({ face: 2, x, y: 0.8, w: 1.05, h: 1.45 })),
        { face: 1, x: 0, y: 0.36, w: 1.17, h: 2.19, door: true },
      ],
    });
    // Covered center passage reaches the engine house without inventing a filled courtyard.
    lizardHouse(out, {
      x0: -34.77,
      x1: -32.66,
      z0: 9.16,
      z1: 23.12,
      eave: 3.28,
      rise: 0.54,
      windows: [
        ...[1, 3].flatMap((face) =>
          [-4, 0, 4].map((x) => ({ face, x, y: 0.84, w: 0.84, h: 1.53 })),
        ),
      ],
    });
    const ew = [];
    for (const face of [0, 2])
      for (const x of [-11.4, -7.7, -3.85, 0, 3.85, 7.7, 11.4])
        ew.push({ face, x, y: 0.74, w: 1.29, h: 1.88 });
    for (const face of [1, 3])
      for (const x of [-2.7, 0, 2.7])
        ew.push({
          face,
          x,
          y: x === 0 ? 0.3 : 0.84,
          w: 1.1,
          h: x === 0 ? 2.55 : 1.8,
          door: x === 0,
        });
    lizardHouse(out, {
      x0: -47.42,
      x1: -18.88,
      z0: 23.12,
      z1: 33.1,
      eave: 4.89,
      rise: 2.59,
      gable: true,
      windows: ew,
    });
    for (const x of [-41, -26]) lizardChimney(out, x, 28.11, 7.65);
    // South semicircular fog-signal bay, with the black flared trumpet visible in operator views.
    if (skyline) farBay(out);
    else {
      const bay = transformed(out, 0, [-33.01, 0, 33.1]);
      const bayHoles = [-0.88, 0, 0.88].map((angle) => ({
        angle,
        y: 0.84,
        w: 1.2,
        h: 1.79,
        depth: 0.2,
        trimSlot: 'plaster',
        trimColor: white,
      }));
      shell(bay, {
        profile: [
          [0.02, 3.46],
          [3.64, 3.46],
        ],
        holes: bayHoles,
        slot: 'plaster',
        color: lWall,
        segments: 128,
      });
      for (const h of bayHoles)
        framedWindow(transformed(bay, h.angle), h, Math.sqrt(3.46 ** 2 - 0.6 ** 2), white, {
          hood: true,
          greenSill: true,
        });
      for (let i = 0; i < baySegments; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / baySegments,
          b = -Math.PI / 2 + ((i + 1) * Math.PI) / baySegments;
        roofFace(
          bay,
          'plaster',
          [P(3.55, 3.38, a), P(3.55, 3.38, b), P(3.55, 3.64, b), P(3.55, 3.64, a)],
          white,
        );
        roofFace(
          bay,
          'plaster',
          [P(3.46, 3.64, a), P(3.55, 3.64, a), P(3.55, 3.64, b), P(3.46, 3.64, b)],
          white,
        );
        bay.addTriangle(
          'metal',
          'palette:#fff',
          [P(3.48, 3.65, a), P(3.48, 3.65, b), [0, 3.65, 0]],
          [0, 1, 0],
          [
            [3.48 * Math.sin(a), 3.48 * Math.cos(a)],
            [3.48 * Math.sin(b), 3.48 * Math.cos(b)],
            [0, 0],
          ],
          lSlate,
        );
      }
      for (const x of [-1.15, 1.15])
        beam(bay, 'metal', [x, 3.62, -0.1], [0, 7.09, 0.14], 0.12, 0.12, dark);
      beam(bay, 'metal', [-1.08, 3.63, -0.8], [0, 7.09, 0.14], 0.12, 0.12, dark);
      // Axial loft along+Z, with open black horn mouth and visible annular rim.
      const hornRings = [
        [0.02, 0.3],
        [0.55, 0.31],
        [0.95, 0.47],
        [1.32, 0.79],
        [1.5, 0.95],
      ].map(([z, r]) =>
        Array.from({ length: hornSegments }, (_, i) => [
          r * Math.cos((i * TAU) / hornSegments),
          7.12 + r * Math.sin((i * TAU) / hornSegments),
          z,
        ]),
      );
      for (let j = 1; j < hornRings.length; j++)
        for (let i = 0; i < hornSegments; i++) {
          const k = (i + 1) % hornSegments;
          roofFace(
            bay,
            'metal',
            [hornRings[j - 1][i], hornRings[j - 1][k], hornRings[j][k], hornRings[j][i]],
            dark,
          );
        }
      const circle = Array.from({ length: hornSegments + 1 }, (_, i) => [
        0.95 * Math.cos((i * TAU) / hornSegments),
        7.12 + 0.95 * Math.sin((i * TAU) / hornSegments),
        1.5,
      ]);
      line(bay, circle, 'metal', [0.045, 0.05, 0.048], 0.055);
      sphere(bay, 'metal', [0, 7.12, 1.2], [0.84, 0.84, 0.07], [0.01, 0.012, 0.012], 64, 24);
    }
    // Finite site wall sections and gated entrances; the cliff itself is supplied by terrain.
    box(out, 'plaster', [-72, 0.03, 42.2], [7, 1.15, 42.65], white);
    box(out, 'plaster', [-72, 0.03, 4.5], [-71.55, 1.15, 42.65], white);
    box(out, 'plaster', [6.55, 0.03, -10], [7, 1.15, 42.65], white);
    if (!skyline)
      for (const x of [-72, 6.55])
        for (let z = 6; z < 43; z += 7.3)
          box(out, 'plaster', [x - 0.09, 0.02, z - 0.2], [x + 0.53, 1.35, z + 0.2], white);
  }

  return buildLizard;
}
export const lizardSkyline = components('skyline'),
  lizardDistrict = components('district'),
  lizardStreet = components('street'),
  lizardCloseup = components('closeup');
