/** Complete source-authored Klaipeda browser levels with shared mineral/metal/wood graphs. */
import {
  beam,
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
  const close = level === 'closeup',
    district = level === 'district',
    segments = close ? 96 : district ? 16 : 48;
  function lathe(out, slot, profile, color, n = 64, center = [0, 0]) {
    fullLathe(
      out,
      slot,
      profile,
      color,
      Math.min(n, district && Math.max(...profile.map((p) => p[1])) < 0.6 ? 8 : segments),
      center,
    );
  }
  function box(out, slot, a, b, color) {
    if (
      district &&
      b[2] - a[2] < 0.5 &&
      (slot === 'wood' || b[0] - a[0] < 0.35 || b[1] - a[1] < 0.35)
    )
      panel(out, slot, a[0], b[0], a[1], b[1], b[2], color);
    else fullBox(out, slot, a, b, color);
  }
  function ring(out, slot, y, inside, outside, h, color, n = 80) {
    n = Math.min(n, outside < 0.6 ? (close ? 32 : district ? 8 : 16) : segments);
    if (district && inside === 1.8) {
      for (let i = 0; i < n; i++) {
        const a = (i * Math.PI * 2) / n,
          b = ((i + 1) * Math.PI * 2) / n,
          p = (r, y, t) => [r * Math.sin(t), y, r * Math.cos(t)];
        for (const points of [
          [p(outside, y, a), p(outside, y, b), p(outside, y + h, b), p(outside, y + h, a)],
          [p(inside, y + h, a), p(outside, y + h, a), p(outside, y + h, b), p(inside, y + h, b)],
          [p(inside, y, b), p(outside, y, b), p(outside, y, a), p(inside, y, a)],
        ])
          quad(out, slot, points, normalFor(...points.slice(0, 3)), color);
      }
      return;
    }
    fullRing(out, slot, y, inside, outside, h, color, n);
  }
  function tube(out, slot, a, b, r, color, n = 6) {
    fullTube(out, slot, a, b, r, color, Math.min(n, close ? 6 : district ? 3 : 4));
  }
  function sphere(out, slot, center, radii, color, n = 24, m = 12) {
    fullSphere(
      out,
      slot,
      center,
      radii,
      color,
      Math.min(n, close ? 24 : district ? 8 : 12),
      Math.min(m, close ? 12 : district ? 4 : 6),
    );
  }
  function shell(out, options) {
    const phase = district ? Math.PI / segments : 0,
      color = options.color;
    fullShell(transformed(out, phase), {
      ...options,
      segments: Math.min(options.segments ?? 128, segments),
      holes: (options.holes ?? []).map((h) => ({ ...h, angle: (h.angle ?? 0) - phase })),
      color: typeof color === 'function' ? (y, a) => color(y, a + phase) : color,
    });
  }
  const TAU = Math.PI * 2,
    white = [0.86, 0.87, 0.82],
    black = [0.038, 0.045, 0.047],
    orange = [0.8, 0.205, 0.135];
  const P = (r, y, a) => [r * Math.sin(a), y, r * Math.cos(a)];
  function path(out, points, slot, color, r = 0.016) {
    tubePath(out, slot, points, r, color, close ? 6 : district ? 3 : 4);
  }
  function roofSeams(out, profile, n, color) {
    n = Math.min(n, close ? 32 : district ? 0 : 12);
    for (let i = 0; i < n; i++)
      path(
        out,
        profile.map(([y, r]) => P(r + 0.012, y, (i * TAU) / n)),
        'metal',
        color,
        0.014,
      );
  }
  function rectangleRail(out, half, y, h, color) {
    for (let f = 0; f < 4; f++) {
      const o = transformed(out, (f * Math.PI) / 2);
      for (const dy of [0, h * 0.48, h])
        tube(o, 'metal', [-half, y + dy, half], [half, y + dy, half], 0.027, color, 10);
      for (let x = -half; x <= half + 0.01; x += half / (close ? 8 : district ? 1 : 4))
        tube(o, 'metal', [x, y, half], [x, y + h, half], 0.017, color, 8);
    }
  }
  function roundRail(out, r, y, h, n, color) {
    n = Math.min(n, close ? 24 : district ? 8 : 12);
    for (let i = 0; i < n; i++)
      tube(out, 'metal', P(r, y, (i * TAU) / n), P(r, y + h, (i * TAU) / n), 0.018, color, 8);
    for (const dy of [0, h * 0.48, h]) {
      if (district)
        tubePath(
          out,
          'metal',
          Array.from({ length: n }, (_, i) => P(r, y + dy, (i * TAU) / n)),
          0.022,
          color,
          3,
          true,
        );
      else ring(out, 'metal', y + dy - 0.016, r - 0.022, r + 0.022, 0.032, color, 128);
    }
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
    const spring = y + h - rise;
    const segments = close ? 24 : district ? 6 : 12;
    for (let i = 0; i < segments; i++) {
      const a = (i * Math.PI) / segments,
        b = ((i + 1) * Math.PI) / segments,
        p = [w * 0.5 * Math.cos(a), spring + rise * Math.sin(a), z],
        q = [w * 0.5 * Math.cos(b), spring + rise * Math.sin(b), z];
      quad(out, slot, [p, [p[0], y + h + 0.018, z], [q[0], y + h + 0.018, z], q], [0, 0, 1], color);
      const ps = [p, q, [q[0], q[1], z - depth], [p[0], p[1], z - depth]];
      quad(out, slot, ps, normalFor(...ps.slice(0, 3)), color);
      if (trim) tube(out, 'metal', p, q, trim, frame, 8);
    }
  }
  function roundel(out, a, y, r, bodyR, color) {
    const o = transformed(out, a);
    const segments = close ? 32 : district ? 8 : 16;
    for (let i = 0; i < segments; i++) {
      const p = (i * TAU) / segments,
        q = ((i + 1) * TAU) / segments;
      const ps = [
        [0, y, bodyR + 0.013],
        [r * Math.cos(p), y + r * Math.sin(p), bodyR + 0.013],
        [r * Math.cos(q), y + r * Math.sin(q), bodyR + 0.013],
      ];
      o.addTriangle(
        'metal',
        'palette:#ffffff',
        ps,
        [0, 0, 1],
        [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
        color,
      );
    }
    if (!district)
      path(
        o,
        Array.from({ length: segments + 1 }, (_, i) => [
          r * Math.cos((i * TAU) / segments),
          y + r * Math.sin((i * TAU) / segments),
          bodyR + 0.025,
        ]),
        'metal',
        black,
        0.025,
      );
  }
  function buildKlaipeda(out) {
    // Broad surviving plinth, with a double folded-metal shoulder below the slim stair shaft.
    lathe(
      out,
      'concrete',
      [
        [0, 4.24],
        [0.22, 4.24],
        [0.3, 4.12],
      ],
      black,
      160,
    );
    const baseHoles = [
      {
        angle: 0,
        y: 0.36,
        w: 1.36,
        h: 2.75,
        depth: 0.23,
        trimSlot: 'plaster',
        trimColor: white,
        trim: 0.13,
      },
      ...[-Math.PI / 2, Math.PI / 2, Math.PI].map((angle) => ({
        angle,
        y: 3.31,
        w: 1.15,
        h: 0.53,
        depth: 0.18,
        trimSlot: 'plaster',
        trimColor: white,
        trim: 0.09,
      })),
    ];
    recessShell(out, {
      profile: [
        [0.3, 4.12],
        [4.57, 4.12],
      ],
      holes: baseHoles,
      slot: 'plaster',
      color: black,
      segments: 160,
    });
    archHead(out, { y: 0.36, w: 1.36, h: 2.75, z: 4.08, depth: 0.23, color: black, trim: 0.105 });
    panel(out, 'wood', -0.57, 0.57, 0.4, 2.93, 3.89, [0.17, 0.16, 0.14]);
    for (let x = -0.5; x <= 0.51; x += 0.2)
      box(out, 'wood', [x - 0.009, 0.43, 3.9], [x + 0.009, 2.64, 3.914], [0.1, 0.095, 0.083]);
    box(out, 'metal', [0.4, 1.25, 3.919], [0.47, 1.53, 3.969], white);
    for (let i = 0; i < 2; i++)
      box(
        out,
        'concrete',
        [-1.16, 0, 3.98],
        [1.16, 0.36 - i * 0.18, 4.62 + i * 0.38],
        [0.38, 0.39, 0.37],
      );
    for (const y of [3.02, 4.52]) ring(out, 'plaster', y, 4.07, 4.19, 0.1, black, 160);
    const collar = [
      [4.57, 4.43],
      [4.92, 4.43],
      [5.7, 3.26],
      [6.15, 3.26],
      [6.66, 2.58],
    ];
    lathe(out, 'metal', collar, black, 128);
    roofSeams(out, collar, 112, [0.075, 0.084, 0.083]);
    const band0 = 6.66,
      bandH = 2.63,
      shaftTop = 32.96;
    const h = [];
    for (let i = 0; i < 6; i++)
      h.push({
        angle: 0,
        y: 7.2 + i * 4.52,
        w: 0.48,
        h: 1.16,
        depth: 0.16,
        trim: 0.045,
        trimSlot: 'metal',
        trimColor: i % 2 ? black : white,
        grid: true,
      });
    // Preserve band boundaries in the mesh so each daymark is a true continuous colored surface.
    const profile = Array.from({ length: 11 }, (_, i) => [band0 + i * bandH, 2.58]);
    const bandColor = (y, a) => {
      const k = Math.min(9, Math.floor((y - band0) / bandH));
      const strip =
        Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2))) < 0.125;
      return strip || k % 2 === 0 ? black : white;
    };
    recessShell(out, {
      profile,
      holes: h.filter((v) => v.y + v.h < shaftTop),
      slot: 'plaster',
      color: bandColor,
      segments: 192,
    });
    lathe(
      out,
      'plaster',
      [
        [shaftTop, 2.58],
        [33.2, 2.72],
        [33.49, 2.72],
        [33.62, 2.66],
      ],
      black,
      160,
    );
    recessShell(out, {
      profile: [
        [33.62, 2.66],
        [34.1, 2.66],
      ],
      slot: 'plaster',
      color: black,
      holes: [],
      segments: 160,
    });
    for (let i = 0; i < 4; i++) roundel(out, (i * TAU) / 4, 33.87, 0.12, 2.66, [0.55, 0.57, 0.55]);
    const capital = [
      [34.1, 2.65],
      [34.21, 2.8],
      [34.33, 3.05],
      [34.5, 3.27],
      [34.69, 3.39],
      [34.86, 3.38],
      [35.03, 3.18],
      [35.16, 2.97],
    ];
    lathe(out, 'plaster', capital, [0.11, 0.12, 0.12], 192);
    box(out, 'metal', [-3.78, 35.15, -3.78], [3.78, 35.44, 3.78], black);
    rectangleRail(out, 3.7, 35.46, 1.03, orange);
    // Seaward half of lantern glazed; landward half has solid orange weather panels.
    lathe(
      out,
      'metal',
      [
        [35.44, 1.84],
        [36.72, 1.84],
      ],
      orange,
      128,
    );
    for (let i = 0; i < 16; i++) {
      const a = (i * TAU) / 16,
        b = ((i + 1) * TAU) / 16,
        glass = Math.sin((a + b) / 2) < -0.1,
        ps = [P(1.84, 36.72, a), P(1.84, 36.72, b), P(1.84, 38.54, b), P(1.84, 38.54, a)];
      quad(
        out,
        glass ? 'glassClear' : 'metal',
        ps,
        normalFor(...ps.slice(0, 3)),
        glass ? [0.74, 0.85, 0.84] : orange,
      );
      tube(out, 'metal', P(1.863, 35.5, a), P(1.863, 38.57, a), 0.038, orange, 10);
    }
    for (const y of [36.72, 37.32, 37.93, 38.54])
      ring(out, 'metal', y, 1.8, 1.89, 0.047, orange, 128);
    const cap = [
      [38.56, 2.02],
      [38.65, 2.03],
      [38.87, 1.61],
      [39.16, 0.83],
      [39.32, 0.19],
    ];
    lathe(out, 'metal', cap, orange, 128);
    roofSeams(
      out,
      cap,
      16,
      orange.map((v) => v * 0.75),
    );
    lathe(
      out,
      'metal',
      [
        [39.3, 0.19],
        [39.45, 0.19],
      ],
      orange,
      48,
    );
    sphere(out, 'metal', [0, 39.57, 0], [0.15, 0.15, 0.15], orange, 32, 16);
    tube(out, 'metal', [0, 39.69, 0], [0, 40, 0], 0.014, black, 8);
    roundRail(out, 1.98, 38.65, 0.27, 24, black);
    // Published modern exterior shows a small dish, paired aerials and gallery-mounted lights.
    for (const x of [-2.6, 2.6]) {
      tube(out, 'metal', [x, 35.44, 2.9], [x, 37.57, 2.9], 0.021, black, 8);
      for (const y of [36.6, 37.05])
        tube(out, 'metal', [x - 0.36, y, 2.9], [x + 0.36, y, 2.9], 0.014, black, 8);
    }
    for (const x of [-3.32, 3.32]) {
      beam(out, 'metal', [x, 35.67, 3.35], [x, 36.08, 4.28], 0.065, 0.065, black);
      box(out, 'metal', [x - 0.2, 35.94, 4.12], [x + 0.2, 36.2, 4.64], [0.53, 0.54, 0.5]);
      panel(out, 'glass', x - 0.155, x + 0.155, 35.985, 36.155, 4.648, [0.65, 0.71, 0.68]);
    }
    const dish = transformed(out, 0.42);
    // Compact lamp/pedestal silhouette visible behind the seaward sector glazing.
    // External photographs constrain the silhouette, not the internal optical prescription.
    lathe(
      out,
      'metal',
      [
        [35.46, 0.34],
        [36.86, 0.34],
        [36.94, 0.47],
      ],
      [0.48, 0.51, 0.48],
      64,
    );
    lathe(
      out,
      'glassClear',
      [
        [36.94, 0.32],
        [37.07, 0.47],
        [37.62, 0.47],
        [37.75, 0.31],
      ],
      [0.66, 0.83, 0.74],
      80,
    );
    for (let y = 37.06; !district && y < 37.65; y += 0.085)
      ring(out, 'metal', y, 0.45, 0.48, 0.014, [0.46, 0.54, 0.48], 80);
    lathe(
      out,
      'metal',
      [
        [37.75, 0.34],
        [37.8, 0.34],
      ],
      [0.25, 0.29, 0.26],
      64,
    );
    sphere(dish, 'metal', [0, 36.95, 1.96], [0.34, 0.34, 0.075], [0.8, 0.81, 0.77], 48, 24);
    beam(dish, 'metal', [0, 36.5, 1.9], [0, 36.8, 2.03], 0.07, 0.07, black);
  }

  function distant(out) {
    const theta = Math.asin(0.68 / 4.12),
      angles = [
        ...Array.from({ length: 8 }, (_, i) => (i * TAU) / 8),
        theta,
        TAU - theta,
        (3 * Math.PI) / 2 - 0.125,
        (3 * Math.PI) / 2 + 0.125,
      ].sort((a, b) => a - b);
    const face = (slot, p, color) => quad(out, slot, p, normalFor(...p.slice(0, 3)), color);
    function profile(slot, stations, color) {
      loft(
        out,
        slot,
        stations.map(([y, r]) => angles.map((a) => P(r, y, a))),
        color,
      );
    }
    profile(
      'concrete',
      [
        [0, 4.24],
        [0.3, 4.12],
      ],
      black,
    );
    const ys = [0.3, 0.36, 3.11, 4.57];
    for (let j = 1; j < ys.length; j++)
      for (let i = 0; i < angles.length; i++) {
        const a = angles[i],
          b = i + 1 < angles.length ? angles[i + 1] : TAU + angles[0],
          mid = (a + b) / 2;
        if (j === 2 && Math.abs(Math.atan2(Math.sin(mid), Math.cos(mid))) < theta) continue;
        face(
          'plaster',
          [P(4.12, ys[j - 1], a), P(4.12, ys[j - 1], b), P(4.12, ys[j], b), P(4.12, ys[j], a)],
          black,
        );
      }
    for (const x of [-0.68, 0.68]) {
      const points = [
        [x, 0.36, 4.064],
        [x, 3.11, 4.064],
        [x, 3.11, 3.84],
        [x, 0.36, 3.84],
      ];
      face('plaster', x < 0 ? points.toReversed() : points, black);
    }
    panel(out, 'glass', -0.68, 0.68, 0.36, 3.11, 3.84, [0.12, 0.16, 0.19]);
    panel(out, 'wood', -0.57, 0.57, 0.4, 2.93, 3.89, [0.17, 0.16, 0.14]);
    for (const sign of [-1, 1])
      panel(out, 'plaster', sign * 0.68 - 0.13, sign * 0.68 + 0.13, 0.23, 2.43, 4.21, white);
    const spring = 2.43;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 6,
        b = ((i + 1) * Math.PI) / 6,
        p = [0.68 * Math.cos(a), spring + 0.68 * Math.sin(a), 4.08],
        q = [0.68 * Math.cos(b), spring + 0.68 * Math.sin(b), 4.08];
      face('plaster', [p, [p[0], 3.128, 4.08], [q[0], 3.128, 4.08], q], black);
      face('plaster', [p, q, [q[0], q[1], 3.85], [p[0], p[1], 3.85]], black);
      face(
        'plaster',
        [
          [0.785 * Math.cos(a), spring + 0.785 * Math.sin(a), 4.092],
          [0.785 * Math.cos(b), spring + 0.785 * Math.sin(b), 4.092],
          [q[0], q[1], 4.092],
          [p[0], p[1], 4.092],
        ],
        white,
      );
    }
    for (let i = 0; i < 2; i++)
      box(
        out,
        'concrete',
        [-1.16, 0, 3.98],
        [1.16, 0.36 - i * 0.18, 4.62 + i * 0.38],
        [0.38, 0.39, 0.37],
      );
    for (const a of [-Math.PI / 2, Math.PI / 2, Math.PI]) {
      const o = transformed(out, a);
      panel(o, 'plaster', -0.665, 0.665, 3.22, 3.93, 4.13, white);
      panel(o, 'glass', -0.575, 0.575, 3.31, 3.84, 4.14, [0.12, 0.16, 0.19]);
    }
    profile(
      'metal',
      [
        [4.57, 4.43],
        [4.92, 4.43],
        [5.7, 3.26],
        [6.15, 3.26],
        [6.66, 2.58],
      ],
      black,
    );
    for (let j = 0; j < 10; j++)
      for (let i = 0; i < angles.length; i++) {
        const a = angles[i],
          b = i + 1 < angles.length ? angles[i + 1] : angles[0] + TAU,
          mid = (a + b) / 2,
          strip =
            Math.abs(Math.atan2(Math.sin(mid + Math.PI / 2), Math.cos(mid + Math.PI / 2))) < 0.125;
        face(
          'plaster',
          [
            P(2.58, 6.66 + j * 2.63, a),
            P(2.58, 6.66 + j * 2.63, b),
            P(2.58, 6.66 + (j + 1) * 2.63, b),
            P(2.58, 6.66 + (j + 1) * 2.63, a),
          ],
          strip || j % 2 === 0 ? black : white,
        );
      }
    for (let i = 0; i < 6; i++)
      panel(out, 'glass', -0.24, 0.24, 7.2 + i * 4.52, 8.36 + i * 4.52, 2.6, [0.12, 0.16, 0.19]);
    profile(
      'plaster',
      [
        [32.96, 2.58],
        [33.49, 2.72],
        [34.1, 2.66],
        [34.5, 3.27],
        [34.86, 3.38],
        [35.16, 2.97],
      ],
      [0.11, 0.12, 0.12],
    );
    box(out, 'metal', [-3.78, 35.15, -3.78], [3.78, 35.44, 3.78], black);
    for (let side = 0; side < 4; side++) {
      const o = transformed(out, (side * Math.PI) / 2);
      const p = [
        [-3.7, 36.463, 3.7],
        [3.7, 36.463, 3.7],
        [3.7, 36.517, 3.7],
        [-3.7, 36.517, 3.7],
      ];
      quad(o, 'metal', p, [0, 0, 1], orange);
      quad(o, 'metal', p.toReversed(), [0, 0, -1], orange);
      for (const x of [-3.7, 3.7]) {
        const p = [
          [x - 0.017, 35.46, 3.7],
          [x + 0.017, 35.46, 3.7],
          [x + 0.017, 36.49, 3.7],
          [x - 0.017, 36.49, 3.7],
        ];
        quad(o, 'metal', p, [0, 0, 1], orange);
        quad(o, 'metal', p.toReversed(), [0, 0, -1], orange);
      }
    }
    fullLathe(
      out,
      'metal',
      [
        [35.44, 1.84],
        [36.72, 1.84],
      ],
      orange,
      8,
    );
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8,
        b = ((i + 1) * TAU) / 8,
        glass = Math.sin((a + b) / 2) < -0.1;
      face(
        glass ? 'glassClear' : 'metal',
        [P(1.84, 36.72, a), P(1.84, 36.72, b), P(1.84, 38.54, b), P(1.84, 38.54, a)],
        glass ? [0.14, 0.21, 0.24] : orange,
      );
      const o = transformed(out, a),
        p = [
          [-0.038, 35.5, 1.863],
          [0.038, 35.5, 1.863],
          [0.038, 38.57, 1.863],
          [-0.038, 38.57, 1.863],
        ];
      quad(o, 'metal', p, [0, 0, 1], orange);
      quad(o, 'metal', p.toReversed(), [0, 0, -1], orange);
    }
    fullLathe(
      out,
      'metal',
      [
        [38.56, 2.02],
        [38.65, 2.03],
        [38.87, 1.61],
        [39.16, 0.83],
        [39.32, 0.19],
      ],
      orange,
      8,
    );
    fullLathe(
      out,
      'metal',
      [
        [39.3, 0.19],
        [39.45, 0.19],
        [39.57, 0.15],
        [39.72, 0.05],
      ],
      orange,
      4,
    );
    fullTube(out, 'metal', [0, 39.69, 0], [0, 40, 0], 0.014, black, 3);
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8,
        b = ((i + 1) * TAU) / 8,
        p = [P(1.958, 38.92, a), P(2.002, 38.92, a), P(2.002, 38.92, b), P(1.958, 38.92, b)];
      face('metal', p, black);
      face('metal', p.toReversed(), black);
    }
    for (let i = 0; i < 4; i++) {
      const o = transformed(out, (i * TAU) / 4),
        p = [
          [-0.018, 38.65, 1.98],
          [0.018, 38.65, 1.98],
          [0.018, 38.92, 1.98],
          [-0.018, 38.92, 1.98],
        ];
      quad(o, 'metal', p, [0, 0, 1], black);
      quad(o, 'metal', p.toReversed(), [0, 0, -1], black);
    }
  }
  return { build: buildKlaipeda, distant };
}
export const klaipedaDistrict = (out) => components('district').build(out);
export const klaipedaStreet = (out) => components('street').build(out);
export const klaipedaCloseup = (out) => components('closeup').build(out);

export function klaipedaSkyline(out) {
  const target = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((method) => [
      method,
      (slot, ref, p, n, uv, color) =>
        out[method](
          slot,
          ref,
          p,
          n,
          uv,
          ['glass', 'glassClear'].includes(slot) ? color : color.map((v) => v * 0.65),
        ),
    ]),
  );
  components('skyline').distant(target);
}
