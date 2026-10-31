/** Complete source-authored Kullen browser models, with the original detailed master retained. */
import {
  sphere as fullSphere,
  loft,
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
import { opticMount, porchGroundContact } from './kullen-supports.mjs';

function components(level) {
  const close = level === 'closeup',
    district = level === 'district',
    segments = close ? 64 : district ? 12 : 32,
    lensBands = close ? 12 : district ? 3 : 6,
    lensSegments = close ? 32 : district ? 12 : 24,
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
        Math.max(...profile.map((p) => p[1])) < 0.6 ? (close ? 24 : district ? 8 : 12) : segments,
      ),
      center,
    );
  }
  function piercedFacade(out, options) {
    if (!district) return fullPiercedFacade(out, options);
    fullPiercedFacade(out, { ...options, holes: options.holes.map((h) => ({ ...h, trim: 0 })) });
    for (const h of options.holes) {
      const a = h.x - h.w / 2,
        b = h.x + h.w / 2,
        c = [0.64, 0.6, 0.51],
        y = h.y,
        z = options.z + 0.025,
        w = h.trim ?? 0.09;
      for (const [x0, x1, y0, y1] of [
        [a - w, a, y - w, y + h.h + w],
        [b, b + w, y - w, y + h.h + w],
        [a, b, y - w, y],
        [a, b, y + h.h, y + h.h + w],
      ])
        panel(out, 'granite', x0, x1, y0, y1, z, c);
    }
  }
  function shell(out, options) {
    fullShell(out, { ...options, segments: Math.min(options.segments ?? 128, segments) });
  }
  function ring(out, slot, y, inside, outside, h, color, n = 80) {
    fullRing(out, slot, y, inside, outside, h, color, Math.min(n, segments));
  }
  function box(out, slot, a, b, color) {
    if (district && b[2] - a[2] < 0.5 && (b[0] - a[0] < 0.35 || b[1] - a[1] < 0.35))
      panel(out, slot, a[0], b[0], a[1], b[1], b[2], color);
    else fullBox(out, slot, a, b, color);
  }
  function tube(out, slot, a, b, r, color, n = 8) {
    if (district && r < 0.023 && Math.max(a[1], b[1]) < 14.7) return;
    fullTube(out, slot, a, b, r, color, Math.min(n, close ? 6 : district ? 3 : 4));
  }
  function sphere(out, slot, p, r, color, n = 24, m = 12) {
    if (district && slot === 'granite' && r[0] < 0.2) return;
    if (district && slot === 'glass' && r[0] === 0.125) {
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3,
          b = ((i + 1) * Math.PI) / 3;
        const ps = [
          [p[0], p[1], p[2] + r[2]],
          [p[0] + r[0] * Math.cos(a), p[1] + r[1] * Math.sin(a), p[2] + r[2]],
          [p[0] + r[0] * Math.cos(b), p[1] + r[1] * Math.sin(b), p[2] + r[2]],
        ];
        out.addTriangle(
          slot,
          'palette:#ffffff',
          ps,
          [0, 0, 1],
          ps.map((q) => [q[0], q[1]]),
          color,
        );
      }
      return;
    }
    fullSphere(
      out,
      slot,
      p,
      r,
      color,
      Math.min(n, close ? 24 : district ? 8 : 12),
      Math.min(m, close ? 12 : district ? 4 : 6),
    );
  }
  function line(out, points, slot, color, r = 0.018) {
    if (r < 0.02) return;
    tubePath(out, slot, points, r, color, close ? 6 : district ? 3 : 4);
  }
  function circularRail(out, r, y, h, n, color = white) {
    n = close ? 24 : district ? 8 : 12;
    for (let i = 0; i < n; i++) {
      const a = (i * TAU) / n,
        o = transformed(out, a);
      if (district) {
        panel(o, 'metal', -0.023, 0.023, y, y + h, r, color);
        quad(
          o,
          'metal',
          [
            [0.023, y, r],
            [-0.023, y, r],
            [-0.023, y + h, r],
            [0.023, y + h, r],
          ],
          [0, 0, -1],
          color,
        );
      } else tube(out, 'metal', P(r, y, a), P(r, y + h, a), 0.023, color, 10);
    }
    for (const dy of [h * 0.5, h]) {
      if (district) {
        for (let i = 0; i < n; i++) {
          const a = (i * TAU) / n,
            b = ((i + 1) * TAU) / n,
            ps = [
              P(r, y + dy - 0.017, a),
              P(r, y + dy - 0.017, b),
              P(r, y + dy + 0.017, b),
              P(r, y + dy + 0.017, a),
            ];
          quad(out, 'metal', ps, normalFor(...ps.slice(0, 3)), color);
          ps.reverse();
          quad(out, 'metal', ps, normalFor(...ps.slice(0, 3)), color);
        }
      } else ring(out, 'metal', y + dy - 0.017, r - 0.024, r + 0.024, 0.034, color, 128);
    }
  }
  function roofSeams(out, profile, n, color) {
    n = Math.min(n, close ? 12 : district ? 0 : 6);
    for (let i = 0; i < n; i++)
      line(
        out,
        profile.map(([y, r]) => P(r + 0.012, y, (i * TAU) / n)),
        'metal',
        color,
        0.018,
      );
  }
  function simpleGlass(out, r, y0, y1, n, color = white) {
    n = Math.min(n, close ? 18 : district ? 12 : 18);
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
      tube(out, 'metal', P(r + 0.018, y0, a), P(r + 0.018, y1, a), 0.035, color, 10);
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

  const kStone = [0.41, 0.405, 0.345],
    kTrim = [0.59, 0.55, 0.455],
    kRoof = [0.37, 0.225, 0.13];
  function buildKullen(out) {
    lathe(
      out,
      'granite',
      [
        [0, 3.3],
        [0.34, 3.3],
        [0.41, 3.19],
      ],
      kTrim,
      160,
    );
    shell(out, {
      profile: [
        [0.41, 3.19],
        [7.75, 3.1],
      ],
      slot: 'ashlar',
      color: kStone,
      segments: 160,
      holes: [
        ...[-1, -0.5, 0, 0.5, 1].map((a) => ({
          angle: Math.PI + a,
          y: 6.05,
          w: 0.68,
          h: 1.18,
          depth: 0.25,
          trimColor: kTrim,
        })),
        { angle: Math.PI + 0.8, y: 3.05, w: 0.37, h: 0.75, depth: 0.3, trimColor: kTrim },
        { angle: -Math.PI / 2, y: 1.2, w: 0.48, h: 0.75, depth: 0.3, trimColor: kTrim },
      ],
    });
    // The broad rubble parapet has an inset deck rather than a solid disk over the lantern foot.
    lathe(
      out,
      'granite',
      [
        [7.73, 3.11],
        [7.82, 3.26],
        [8.08, 3.26],
        [8.14, 3.13],
      ],
      kTrim,
      160,
    );
    ring(out, 'ashlar', 8.14, 2.79, 3.15, 0.57, kStone, 160);
    ring(out, 'granite', 8.71, 2.76, 3.26, 0.18, kTrim, 160);
    lathe(
      out,
      'concrete',
      [
        [8.07, 2.77],
        [8.14, 2.77],
      ],
      kTrim,
      128,
    );
    for (let i = 0; i < 8; i++) {
      const o = transformed(out, (i * TAU) / 8);
      fullBox(o, 'granite', [-0.17, 7.96, 3.01], [0.17, 8.31, 3.48], kTrim);
      fullBox(o, 'metal', [-0.095, 8.15, 3.47], [0.095, 8.25, 3.63], dark);
    }
    lathe(
      out,
      'metal',
      [
        [8.13, 1.92],
        [9.47, 1.92],
        [9.53, 2.14],
      ],
      white,
      160,
    );
    const ventSegments = close ? 24 : district ? 6 : 12;
    for (let i = 0; i < 6; i++) {
      const o = transformed(out, (i * TAU) / 6);
      sphere(o, 'glass', [0, 8.91, 1.925], [0.125, 0.125, 0.02], [0.1, 0.18, 0.2], 24, 12);
      line(
        o,
        Array.from({ length: ventSegments + 1 }, (_, j) => [
          0.17 * Math.cos((j * TAU) / ventSegments),
          8.91 + 0.17 * Math.sin((j * TAU) / ventSegments),
          1.95,
        ]),
        'metal',
        white,
        0.036,
      );
    }
    ring(out, 'metal', 9.46, 1.82, 2.42, 0.12, white, 160);
    circularRail(out, 2.28, 9.58, 0.95, 18, [0.46, 0.47, 0.4]);
    simpleGlass(out, 1.86, 9.58, 12.55, 18, white);
    for (const y of [10.93, 12.53])
      ring(out, 'metal', y, 1.83, 1.9, 0.045, [0.48, 0.49, 0.44], 160);
    const dome = [
      [12.55, 2.01],
      [12.62, 2.01],
      [12.81, 1.92],
      [13.15, 1.69],
      [13.49, 1.31],
      [13.7, 0.82],
      [13.81, 0.36],
    ];
    lathe(out, 'metal', dome, dark, 192);
    roofSeams(out, dome, 12, [0.11, 0.12, 0.11]);
    lathe(
      out,
      'metal',
      [
        [13.8, 0.28],
        [13.97, 0.25],
      ],
      dark,
      64,
    );
    sphere(out, 'metal', [0, 14.21, 0], [0.31, 0.31, 0.31], dark, 48, 24);
    // Three original radial lens panels: concentric annular surfaces and steel support cheeks.
    lathe(
      out,
      'metal',
      [
        [9.5, 0.38],
        [10.16, 0.38],
      ],
      white,
      64,
    );
    for (let f = 0; f < 3; f++) {
      const o = transformed(out, (f * TAU) / 3);
      for (let band = 0; band < lensBands; band++) {
        const ri = 0.07 + band * (1.188 / lensBands),
          ro = ri + 1.188 / lensBands - 0.001;
        for (let i = 0; i < lensSegments; i++) {
          const a = (i * TAU) / lensSegments,
            b = ((i + 1) * TAU) / lensSegments,
            pt = (r, t) => [
              r * Math.cos(t),
              11.13 + r * Math.sin(t),
              0.9 + 0.28 * Math.sqrt(Math.max(0, 1 - (r / 1.29) ** 2)),
            ];
          const ps = [pt(ri, a), pt(ro, a), pt(ro, b), pt(ri, b)];
          roofFace(o, 'glassClear', ps, [0.58, 0.77, 0.62]);
        }
        if (!district)
          tubePath(
            o,
            'metal',
            Array.from({ length: lensSegments }, (_, i) => [
              ro * Math.cos((i * TAU) / lensSegments),
              11.13 + ro * Math.sin((i * TAU) / lensSegments),
              0.906 + 0.28 * Math.sqrt(Math.max(0, 1 - (ro / 1.29) ** 2)),
            ]),
            0.009,
            [0.49, 0.62, 0.48],
            close ? 6 : 4,
            true,
          );
      }
      if (district)
        tubePath(
          o,
          'metal',
          Array.from({ length: 8 }, (_, i) => [
            0.67 * Math.cos((i * TAU) / 8),
            11.13 + 0.67 * Math.sin((i * TAU) / 8),
            0.906 + 0.28 * Math.sqrt(1 - (0.67 / 1.29) ** 2),
          ]),
          0.009,
          [0.49, 0.62, 0.48],
          3,
          true,
        );
      line(
        o,
        Array.from({ length: lensSegments + 1 }, (_, i) => [
          1.29 * Math.cos((i * TAU) / lensSegments),
          11.13 + 1.29 * Math.sin((i * TAU) / lensSegments),
          0.9,
        ]),
        'metal',
        [0.25, 0.29, 0.23],
        0.025,
      );
      for (const x of [-1.3, 1.3])
        tube(o, 'metal', [x, 9.52, 0.86], [x, 12.5, 0.86], 0.032, dark, 10);
    }
    const mast = transformed(out, 0, [0.93, 0, -1.48]);
    tube(mast, 'metal', [0, 9.46, 0], [0, 15, 0], 0.025, white, 10);
    for (let y = 10.1; y < 14.8; y += close ? 0.22 : district ? 0.88 : 0.44)
      tube(mast, 'metal', [-0.16, y, 0], [0.16, y, 0], 0.016, white, 8);
    tube(mast, 'metal', [-0.16, 10, 0], [-0.16, 14.85, 0], 0.018, white, 8);
    tube(mast, 'metal', [0.16, 10, 0], [0.16, 14.85, 0], 0.018, white, 8);
    for (let i = 0; i < 3; i++) {
      const a = (i * TAU) / 3;
      tube(mast, 'metal', [0, 14.72, 0], P(0.48, 14.72, a), 0.02, white, 8);
      lathe(
        transformed(mast, 0, P(0.48, 0, a)),
        'metal',
        [
          [14.72, 0.13],
          [14.91, 0.03],
        ],
        white,
        32,
      );
    }
    // Attached single-storey stone house follows the surveyed ensemble footprint.
    const house = transformed(out, 0, [7.87, 0, 5.93]),
      rx = 7.5,
      rz = 4.33,
      eave = 3.42;
    box(house, 'plaster', [-rx, 0, -rz], [rx, 0.36, rz], white);
    for (let f = 0; f < 4; f++) {
      const o = transformed(house, (f * Math.PI) / 2),
        half = f % 2 ? rz : rx,
        z = f % 2 ? rx : rz;
      const hs = (
        f === 0 ? [-5.7, -3.2, -0.7, 2.1, 5.0] : f === 2 ? [-5, -1.9, 1.3] : [-1.75, 1.75]
      ).map((x) => ({ x, y: 1.25, w: 1.21, h: 1.18, depth: 0.23, trim: 0.09 }));
      if (f === 2)
        hs.push({ x: 3.63, y: 0.65, w: 1.17, h: 1.97, depth: 0.22, trim: 0.08, door: true });
      piercedFacade(o, { half, y0: 0.36, y1: eave, z, holes: hs, slot: 'ashlar', color: kStone });
      for (const h of hs) if (!h.door) framedWindow(o, h, z, [0.5, 0.32, 0.16]);
      box(
        o,
        'granite',
        [-half - 0.08, eave - 0.09, z - 0.13],
        [half + 0.08, eave + 0.14, z + 0.14],
        kTrim,
      );
      tube(
        o,
        'metal',
        [-half - 0.14, eave + 0.16, z + 0.23],
        [half + 0.14, eave + 0.16, z + 0.23],
        0.07,
        dark,
        10,
      );
    }
    hipRoof(house, {
      x0: -rx - 0.31,
      x1: rx + 0.31,
      z0: -rz - 0.3,
      z1: rz + 0.3,
      y: 3.58,
      rise: 0.66,
      color: kRoof,
    });
    for (const x of [-7.24, 7.24])
      tube(house, 'metal', [x, 0.3, 4.45], [x, 3.6, 4.45], 0.055, dark, 10);
    // Recessed northeast corner entrance with rusticated return and carved granite column.
    box(out, 'ashlar', [3.12, 0.1, -1.01], [6.4, 0.62, 1.66], kStone);
    for (let i = 0; i < 4; i++)
      box(
        out,
        'granite',
        [3.16, 0.02 + i * 0.15, -2.5 + i * 0.37],
        [5.01, 0.17 + i * 0.15, -1.01],
        kTrim,
      );
    const porch = transformed(out, 0, [6.15, 0, -0.77]);
    loft(
      porch,
      'granite',
      [
        [
          [-0.48, 0.6, -0.48],
          [-0.48, 0.6, 0.48],
          [0.48, 0.6, 0.48],
          [0.48, 0.6, -0.48],
        ],
        [
          [-0.28, 1.04, -0.28],
          [-0.28, 1.04, 0.28],
          [0.28, 1.04, 0.28],
          [0.28, 1.04, -0.28],
        ],
        [
          [-0.28, 1.2, -0.28],
          [-0.28, 1.2, 0.28],
          [0.28, 1.2, 0.28],
          [0.28, 1.2, -0.28],
        ],
      ],
      kTrim,
    );
    lathe(
      porch,
      'granite',
      [
        [1.2, 0.29],
        [1.33, 0.25],
        [2.67, 0.22],
        [2.78, 0.32],
        [2.97, 0.38],
      ],
      kTrim,
      64,
    );
    for (let i = 0; i < 4; i++)
      sphere(
        transformed(porch, (i * Math.PI) / 2),
        'granite',
        [0, 2.77, 0.29],
        [0.18, 0.13, 0.13],
        kTrim,
        24,
        12,
      );
    box(out, 'granite', [3, 2.97, -1.15], [6.58, 3.18, 1.73], kTrim);
    hipRoof(out, { x0: 2.99, x1: 6.59, z0: -1.16, z1: 1.74, y: 3.2, rise: 0.45, color: kRoof });
    roofFace(
      out,
      'wood',
      [
        [4.84, 0.65, 1.71],
        [3.67, 0.65, 1.71],
        [3.67, 2.62, 1.71],
        [4.84, 2.62, 1.71],
      ],
      [0.36, 0.21, 0.115],
    );
    for (let y = 0.79; y < 2.6; y += 0.19)
      box(out, 'wood', [3.68, y, 1.68], [4.83, y + 0.014, 1.705], [0.23, 0.13, 0.08]);
    for (const y of [0.94, 2.29]) box(out, 'metal', [3.7, y, 1.72], [4.78, y + 0.045, 1.76], dark);
    sphere(out, 'metal', [4.61, 1.58, 1.77], [0.065, 0.065, 0.07], dark, 24, 12);
  }

  return (out) => {
    const mapped = {};
    for (const method of ['addQuad', 'addTriangle', 'addConvexPolygon'])
      mapped[method] = (slot, ...args) =>
        out[method](slot === 'concrete' ? 'granite' : slot, ...args);
    buildKullen(mapped);
    porchGroundContact(mapped);
    opticMount(mapped, { sides: close ? 6 : district ? 3 : 4 });
    fullBox(mapped, 'wood', [3, 3.18, -1.15], [6.58, 3.2, 1.73], [0.37, 0.225, 0.13]);
  };
}
export const kullenDistrict = components('district');
export const kullenStreet = components('street');
export const kullenCloseup = components('closeup');

/** Full granite tower, seaward window belt, lantern and attached house/columned porch. */
export function kullenSkyline(out) {
  const TAU = Math.PI * 2,
    stone = [0.41, 0.405, 0.345],
    trim = [0.59, 0.55, 0.455],
    roof = [0.37, 0.225, 0.13],
    white = [0.87, 0.88, 0.84],
    dark = [0.065, 0.075, 0.071],
    P = (r, y, a) => [r * Math.sin(a), y, r * Math.cos(a)];
  fullLathe(
    out,
    'granite',
    [
      [0, 3.3],
      [0.41, 3.19],
    ],
    trim,
    8,
  );
  const holes = [-1, -0.5, 0, 0.5, 1].map((a) => ({
    angle: Math.PI + a,
    y: 6.05,
    w: 0.68,
    h: 1.18,
    depth: 0.25,
  }));
  fullShell(
    {
      addQuad(s, r, ...args) {
        if (r === 'metric:uv' || s === 'glass') out.addQuad(s, r, ...args);
      },
      addTriangle(...args) {
        out.addTriangle(...args);
      },
    },
    {
      profile: [
        [0.41, 3.19],
        [7.75, 3.1],
      ],
      slot: 'ashlar',
      color: stone,
      segments: 8,
      holes,
    },
  );
  const radius = (y) => 3.19 + ((3.1 - 3.19) * (y - 0.41)) / (7.75 - 0.41);
  for (const h of holes) {
    const o = transformed(out, h.angle),
      z = Math.sqrt(radius(h.y + h.h / 2) ** 2 - (h.w / 2) ** 2),
      w = h.w / 2,
      d = 0.25,
      y = h.y,
      Y = y + h.h;
    for (const ps of [
      [
        [-w, y, z],
        [-w, y, z - d],
        [-w, Y, z - d],
        [-w, Y, z],
      ],
      [
        [w, y, z - d],
        [w, y, z],
        [w, Y, z],
        [w, Y, z - d],
      ],
      [
        [-w, y, z - d],
        [-w, y, z],
        [w, y, z],
        [w, y, z - d],
      ],
      [
        [-w, Y, z],
        [-w, Y, z - d],
        [w, Y, z - d],
        [w, Y, z],
      ],
    ])
      quad(o, 'granite', ps, normalFor(...ps.slice(0, 3)), trim);
    for (const [x0, x1, y0, y1] of [
      [-w - 0.07, -w, y - 0.08, Y + 0.08],
      [w, w + 0.07, y - 0.08, Y + 0.08],
      [-w, w, y - 0.08, y],
      [-w, w, Y, Y + 0.08],
    ])
      panel(o, 'granite', x0, x1, y0, y1, z + 0.025, trim);
  }
  fullLathe(
    out,
    'granite',
    [
      [7.73, 3.11],
      [8.14, 3.26],
    ],
    trim,
    8,
  );
  fullRing(out, 'ashlar', 8.14, 2.76, 3.26, 0.75, stone, 8);
  for (let i = 0; i < 8; i++) {
    const o = transformed(out, (i * TAU) / 8);
    fullBox(o, 'granite', [-0.17, 7.96, 3.01], [0.17, 8.31, 3.625], trim);
    panel(o, 'metal', -0.095, 0.095, 8.15, 8.25, 3.63, dark);
  }
  fullLathe(
    out,
    'metal',
    [
      [8.13, 1.92],
      [9.47, 1.92],
      [9.53, 2.14],
    ],
    white,
    8,
  );
  fullRing(out, 'metal', 9.46, 1.82, 2.42, 0.12, white, 8);
  for (let i = 0; i < 6; i++)
    panel(
      transformed(out, (i * TAU) / 6),
      'glass',
      -0.125,
      0.125,
      8.785,
      9.035,
      1.945,
      [0.1, 0.18, 0.2],
    );
  for (let i = 0; i < 8; i++) {
    const a = (i * TAU) / 8,
      b = ((i + 1) * TAU) / 8,
      o = transformed(out, a);
    panel(o, 'metal', -0.023, 0.023, 9.58, 10.53, 2.28, [0.46, 0.47, 0.4]);
    for (const y of [10.055, 10.53]) {
      const ps = [
        P(2.28, y - 0.017, a),
        P(2.28, y - 0.017, b),
        P(2.28, y + 0.017, b),
        P(2.28, y + 0.017, a),
      ];
      quad(out, 'metal', ps, normalFor(...ps.slice(0, 3)), [0.46, 0.47, 0.4]);
    }
    const ps = [P(1.86, 9.58, a), P(1.86, 9.58, b), P(1.86, 12.55, b), P(1.86, 12.55, a)];
    quad(out, 'glass', ps, normalFor(...ps.slice(0, 3)), [0.4, 0.5, 0.46]);
    panel(o, 'metal', -0.035, 0.035, 9.58, 12.55, 1.88, white);
  }
  fullLathe(
    out,
    'metal',
    [
      [12.55, 2.01],
      [13.15, 1.69],
      [13.7, 0.82],
      [13.97, 0.25],
      [14.21, 0.31],
      [14.52, 0.08],
    ],
    dark,
    8,
  );
  const mast = transformed(out, 0, [0.93, 0, -1.48]);
  fullTube(mast, 'metal', [0, 9.46, 0], [0, 15, 0], 0.025, white, 3);
  for (let i = 0; i < 3; i++) {
    const a = (i * TAU) / 3,
      p = P(0.48, 14.72, a);
    fullTube(mast, 'metal', [0, 14.72, 0], p, 0.02, white, 3);
    fullLathe(
      transformed(mast, 0, P(0.48, 0, a)),
      'metal',
      [
        [14.72, 0.13],
        [14.91, 0.03],
      ],
      white,
      4,
    );
  }
  function hip(out, x0, x1, z0, z1, y, rise) {
    const dz = (z1 - z0) / 2,
      cz = (z0 + z1) / 2,
      a = [x0 + dz, y + rise, cz],
      b = [x1 - dz, y + rise, cz];
    for (const ps of [
      [a, b, [x1, y, z0], [x0, y, z0]],
      [b, a, [x0, y, z1], [x1, y, z1]],
    ])
      quad(out, 'tiles', ps, normalFor(...ps.slice(0, 3)), roof);
    for (const ps of [
      [[x0, y, z0], [x0, y, z1], a],
      [[x1, y, z1], [x1, y, z0], b],
    ])
      out.addTriangle(
        'tiles',
        'metric:uv',
        ps,
        normalFor(...ps),
        ps.map((p) => [p[0], p[2]]),
        roof,
      );
  }
  const house = transformed(out, 0, [7.87, 0, 5.93]),
    rx = 7.5,
    rz = 4.33;
  fullBox(house, 'plaster', [-rx, 0, -rz], [rx, 0.36, rz], white);
  fullBox(house, 'ashlar', [-rx, 0.36, -rz], [rx, 3.42, rz], stone);
  for (let f = 0; f < 4; f++) {
    const face = transformed(house, (f * Math.PI) / 2),
      z = f % 2 ? rx : rz;
    for (const x of f === 0
      ? [-5.7, -3.2, -0.7, 2.1, 5]
      : f === 2
        ? [-5, -1.9, 1.3]
        : [-1.75, 1.75])
      panel(face, 'glass', x - 0.605, x + 0.605, 1.25, 2.43, z + 0.015, [0.09, 0.115, 0.12]);
    if (f === 2) panel(face, 'wood', 3.045, 4.215, 0.65, 2.62, z + 0.02, [0.36, 0.21, 0.115]);
  }
  hip(house, -7.81, 7.81, -4.63, 4.63, 3.58, 0.66);
  fullBox(out, 'ashlar', [3.12, 0.1, -1.01], [6.4, 0.62, 1.66], stone);
  for (let i = 0; i < 4; i++) {
    const x0 = 3.16,
      x1 = 5.01,
      y0 = 0.02 + i * 0.15,
      y1 = 0.17 + i * 0.15,
      z0 = -2.5 + i * 0.37,
      z1 = -1.01;
    for (const [ps, n] of [
      [
        [
          [x1, y0, z0],
          [x0, y0, z0],
          [x0, y1, z0],
          [x1, y1, z0],
        ],
        [0, 0, -1],
      ],
      [
        [
          [x0, y1, z1],
          [x1, y1, z1],
          [x1, y1, z0],
          [x0, y1, z0],
        ],
        [0, 1, 0],
      ],
      [
        [
          [x0, y0, z0],
          [x0, y0, z1],
          [x0, y1, z1],
          [x0, y1, z0],
        ],
        [-1, 0, 0],
      ],
      [
        [
          [x1, y0, z1],
          [x1, y0, z0],
          [x1, y1, z0],
          [x1, y1, z1],
        ],
        [1, 0, 0],
      ],
    ])
      quad(out, 'granite', ps, n, trim);
  }
  const porch = transformed(out, 0, [6.15, 0, -0.77]),
    r = (y) => [
      [-y[1], y[0], -y[1]],
      [-y[1], y[0], y[1]],
      [y[1], y[0], y[1]],
      [y[1], y[0], -y[1]],
    ];
  loft(
    porch,
    'granite',
    [
      [0.6, 0.48],
      [1.04, 0.28],
      [1.2, 0.28],
    ].map(r),
    trim,
  );
  fullLathe(
    porch,
    'granite',
    [
      [1.2, 0.29],
      [2.67, 0.22],
      [2.97, 0.38],
    ],
    trim,
    4,
  );
  fullBox(out, 'granite', [3, 2.97, -1.15], [6.58, 3.18, 1.73], trim);
  fullBox(out, 'wood', [3, 3.18, -1.15], [6.58, 3.2, 1.73], roof);
  hip(out, 2.99, 6.59, -1.16, 1.74, 3.2, 0.45);
  panel(transformed(out, Math.PI), 'wood', -4.84, -3.67, 0.65, 2.62, -1.71, [0.36, 0.21, 0.115]);
  porchGroundContact(out);
}
