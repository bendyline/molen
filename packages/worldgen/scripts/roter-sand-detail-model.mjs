/** Survey-controlled Roter Sand exterior; original master is separately preserved. */

import { beam, normalFor, sphere as originalSphere } from './authored-structure-mesh.mjs';
import { ring as originalRing, shell as originalShell } from './lighthouse-expansion-models.mjs';
import { lathe as originalLathe, panel, transformed } from './lighthouse-models.mjs';
import { buildRoterSand as originalMaster } from './roter-sand-model.mjs';
import { box, tube as originalTube, quad } from './structure-mesh.mjs';
export function buildRoterSandMaster(out) {
  originalMaster(out);
}
function detail(target, mode = 'reviewed') {
  const selectCount = (master, close, street, district) =>
    mode === 'reviewed'
      ? master
      : mode === 'closeup'
        ? close
        : mode === 'street'
          ? street
          : district;
  const bayDistance = 0.95 / Math.sqrt(2) + Math.sqrt(2.55 * 2.55 - (0.95 * 0.95) / 2);
  const lathe = (o, s, p, c, count, center) =>
    originalLathe(
      o,
      s,
      p,
      c,
      mode === 'district' && p.at(-1)[0] === 30.7 ? 6 : selectCount(count, 48, 24, 8),
      center,
    );
  const ring = (o, s, y, a, b, h, c, count) =>
    mode === 'district' && h <= 0.04
      ? undefined
      : originalRing(o, s, y, a, b, h, c, selectCount(count, 48, 24, 8));
  const tube = (o, s, a, b, r, c, count = 8) =>
    originalTube(o, s, a, b, r, c, selectCount(count, 6, 4, 3));
  const sphere = (o, s, p, r, c) =>
    originalSphere(o, s, p, r, c, selectCount(6, 4, 4, 3), selectCount(4, 3, 3, 2));
  function shell(out, options) {
    const { profile, holes = [], cutBays = false, bayAngle } = options,
      radius = (y) => {
        let i = 1;
        while (i < profile.length - 1 && y > profile[i][0]) i++;
        const [a, r] = profile[i - 1],
          [b, s] = profile[i];
        return r + ((s - r) * (y - a)) / (b - a);
      };
    const circular = holes.filter((h) => h.circular);
    const adapter = {
      addQuad(s, r, p, norm, uv, c) {
        if (r === 'metric:uv') {
          const x = p.reduce((v, q) => v + q[0] / 4, 0),
            z = p.reduce((v, q) => v + q[2] / 4, 0);
          if (
            cutBays &&
            [0, (-5 * Math.PI) / 8, (3 * Math.PI) / 4].some(
              (a) =>
                Math.hypot(x - bayDistance * Math.sin(a), z - bayDistance * Math.cos(a)) < 0.95,
            )
          )
            return;
          if (
            bayAngle !== undefined &&
            Math.hypot(x + bayDistance * Math.sin(bayAngle), z + bayDistance * Math.cos(bayAngle)) <
              2.55
          )
            return;
        }
        out.addQuad(s, r, p, norm, uv, c);
      },
      addTriangle(...v) {
        out.addTriangle(...v);
      },
      addConvexPolygon(...v) {
        out.addConvexPolygon(...v);
      },
    };
    // Cut exact circle-intersection boundaries before rejecting internal wall faces.
    const cutAngles = cutBays
      ? [0, (-5 * Math.PI) / 8, (3 * Math.PI) / 4].flatMap((a) => {
          const t = Math.acos(
            (2.55 * 2.55 + bayDistance * bayDistance - 0.95 * 0.95) / (2 * 2.55 * bayDistance),
          );
          return [a - t, a + t];
        })
      : bayAngle !== undefined
        ? [bayAngle + (3 * Math.PI) / 4, bayAngle - (3 * Math.PI) / 4]
        : [];
    // Original shell fills rectangular doors/windows. Circular boxes are filtered and filled below.
    const sourceHoles = holes.map((h) =>
      h.circular ? { ...h, trimSlot: 'circular-placeholder' } : h,
    );
    const filter = {
      ...adapter,
      addQuad(s, r, p, norm, uv, c) {
        if (s === 'circular-placeholder') return;
        adapter.addQuad(s, r, p, norm, uv, c);
      },
      addTriangle(s, r, p, norm, uv, c) {
        if (s === 'circular-placeholder') return;
        adapter.addTriangle(s, r, p, norm, uv, c);
      },
    };
    // A second proxy removes the rectangular opaque panes by exact center height/angle.
    const final = {
      ...filter,
      addQuad(s, r, p, norm, uv, c) {
        if (
          s === 'glass' &&
          circular.some(
            (h) => Math.abs(p.reduce((v, q) => v + q[1] / 4, 0) - (h.y + h.h / 2)) < 0.001,
          )
        )
          return;
        filter.addQuad(s, r, p, norm, uv, c);
      },
    };
    if (cutAngles.length) {
      // Blind zero-width cuts insert angular boundaries without adding any visible panels.
      for (const a of cutAngles)
        sourceHoles.push({
          angle: a,
          y: profile[0][0],
          h: 0,
          w: 0,
          blind: true,
          trimSlot: 'circular-placeholder',
        });
    }
    originalShell(final, { ...options, holes: sourceHoles });
    for (const h of circular) {
      const yc = h.y + h.h / 2,
        r = radius(yc),
        size = h.w / 2,
        count = selectCount(48, 24, 16, 8),
        local = transformed(out, h.angle);
      const pos = (x, y, depth = 0) => {
        const a = Math.asin(x / radius(h.y));
        // Match the surrounding shell's actual chords, including cuts from other floors.
        const cuts = [
          ...new Set([
            0,
            ...holes.flatMap((q) => {
              const angle = q.angle ?? 0,
                t = Math.asin((q.w ?? 0.65) / (2 * radius(q.y)));
              return [angle - t, angle + t].map((v) =>
                Math.atan2(Math.sin(v - h.angle), Math.cos(v - h.angle)),
              );
            }),
            ...Array.from({ length: options.segments + 1 }, (_, i) =>
              Math.atan2(
                Math.sin((i * Math.PI * 2) / options.segments - h.angle),
                Math.cos((i * Math.PI * 2) / options.segments - h.angle),
              ),
            ),
          ]),
        ].sort((a, b) => a - b);
        let j = 1;
        while (j < cuts.length - 1 && a > cuts[j]) j++;
        const lo = cuts[j - 1],
          hi = cuts[j],
          t = (a - lo) / (hi - lo),
          ry = radius(y);
        return [
          ry * (Math.sin(lo) + (Math.sin(hi) - Math.sin(lo)) * t),
          y,
          ry * (Math.cos(lo) + (Math.cos(hi) - Math.cos(lo)) * t) - depth,
        ];
      };
      for (let i = 0; i < count; i++) {
        const a = (i * Math.PI * 2) / count,
          b = ((i + 1) * Math.PI * 2) / count;
        const xy = (t) => [size * Math.cos(t), size * Math.sin(t)],
          square = (t) => {
            const c = Math.cos(t),
              s = Math.sin(t),
              k = size / Math.max(Math.abs(c), Math.abs(s));
            return [c * k, s * k];
          };
        const [ax, ay] = xy(a),
          [bx, by] = xy(b),
          [sx, sy] = square(a),
          [tx, ty] = square(b);
        const color =
          typeof options.color === 'function' ? options.color(yc, h.angle) : options.color;
        // Coplanar square corners may collapse one triangle; use triangles and skip degenerate ones.
        const face = [pos(sx, yc + sy), pos(tx, yc + ty), pos(bx, yc + by), pos(ax, yc + ay)];
        for (const ps of [
          [face[0], face[1], face[2]],
          [face[0], face[2], face[3]],
        ])
          if (Math.hypot(...normalFor(...ps)) > 0)
            local.addTriangle(
              options.slot,
              'metric:uv',
              ps,
              normalFor(...ps),
              ps.map((p) => [p[0], p[1]]),
              color,
            );
        quad(
          local,
          'metal',
          [
            pos(ax, yc + ay),
            pos(bx, yc + by),
            pos(bx, yc + by, h.depth),
            pos(ax, yc + ay, h.depth),
          ],
          [0, 0, 1],
          color,
        );
        const outer = 0.237,
          _size0 = size,
          po = (t) => [
            outer * Math.cos(t),
            yc + outer * Math.sin(t),
            radius(yc + outer * Math.sin(t)) * Math.cos(Math.asin((outer * Math.cos(t)) / r)) +
              0.025,
          ];
        quad(
          local,
          'metal',
          [pos(ax, yc + ay, -0.025), po(a), po(b), pos(bx, yc + by, -0.025)],
          [0, 0, 1],
          [0.86, 0.85, 0.79],
        );
        local.addTriangle(
          'glass',
          'palette:#ffffff',
          [pos(0, yc, h.depth), pos(ax, yc + ay, h.depth), pos(bx, yc + by, h.depth)],
          [0, 0, 1],
          [
            [0, 0],
            [1, 0],
            [1, 1],
          ],
          [0.075, 0.11, 0.13],
        );
      }
    }
  }
  const red = [0.65, 0.085, 0.045],
    white = [0.86, 0.85, 0.79];
  const black = [0.035, 0.043, 0.043],
    glass = [0.075, 0.11, 0.13];
  const tau = Math.PI * 2;
  const point = (r, y, a) => [Math.sin(a) * r, y, Math.cos(a) * r];
  const shaftRadius = (y) => 3.2 - ((Math.min(20.7, Math.max(8, y)) - 8) * 0.65) / 12.7;
  const paint = (y) => (y < 12.3 ? white : y < 16.6 ? red : white);
  const bays = [0, (-5 * Math.PI) / 8, (3 * Math.PI) / 4]; // south, WNW, NE in +X east/-Z north.

  function rivet(out, center, color, radius = 0.021) {
    sphere(out, 'metal', center, [radius, radius, radius], color, 6, 4);
  }
  function dome(out, radius, y, rise, center = [0, 0]) {
    const profile = Array.from({ length: selectCount(25, 13, 9, 5) }, (_, i) => {
      const a = (i * Math.PI) / (2 * (selectCount(25, 13, 9, 5) - 1));
      return [y + Math.sin(a) * rise, Math.max(0.025, Math.cos(a) * radius)];
    });
    lathe(out, 'metal', profile, black, 96, center);
    // Raised meridional seams remain fine geometry instead of per-model maps.
    for (let i = 0; i < selectCount(16, 8, 4, 0); i++)
      for (let j = 0; j < selectCount(16, 8, 4, 0); j++) {
        const a = (i * tau) / selectCount(16, 8, 4, 1),
          u = (j * Math.PI) / (2 * (selectCount(16, 8, 4, 1) + 1)),
          v = ((j + 1) * Math.PI) / (2 * (selectCount(16, 8, 4, 1) + 1));
        const p = (t) => [
          center[0] + Math.sin(a) * (radius + 0.013) * Math.cos(t),
          y + rise * Math.sin(t) + 0.012,
          center[1] + Math.cos(a) * (radius + 0.013) * Math.cos(t),
        ];
        tube(out, 'metal', p(u), p(v), 0.012, black, 6);
      }
  }
  function gallery(out, radius, y, center = [0, 0], start = 0, end = tau) {
    const n = Math.ceil(((end - start) / tau) * selectCount(96, 32, 16, 8));
    const p = (r, h, a) => [center[0] + Math.sin(a) * r, h, center[1] + Math.cos(a) * r];
    for (let i = 0; i < n; i++) {
      const a = start + ((end - start) * i) / n,
        b = start + ((end - start) * (i + 1)) / n;
      for (const dy of mode === 'district' ? [1.06] : [0.5, 1.06])
        tube(out, 'metal', p(radius, y + dy, a), p(radius, y + dy, b), 0.022, white, 8);
      if (i % 3 === 0) tube(out, 'metal', p(radius, y, a), p(radius, y + 1.09, a), 0.026, white, 8);
    }
  }
  function build(target) {
    // Piecewise floor alignment to GMG II-2 / III-9: local datum NN - 2.05 m.
    const levels = [
      [0, 0],
      [1.8, 2.28],
      [8, 8.44],
      [12.3, 12.65],
      [16.6, 16.95],
      [20.7, 21.11],
      [24.1, 24.81],
      [30.7, 30.95],
    ];
    const height = (y) => {
      let i = 1;
      while (i < levels.length - 1 && y > levels[i][0]) i++;
      const [a, b] = levels[i - 1],
        [c, d] = levels[i];
      return b + ((y - a) * (d - b)) / (c - a);
    };
    const solid = (ps) => {
      const [a, b, c] = ps.map((p) => p.map(Math.fround)),
        u = b.map((v, i) => v - a[i]),
        v = c.map((w, i) => w - a[i]);
      return (
        Math.hypot(
          u[1] * v[2] - u[2] * v[1],
          u[2] * v[0] - u[0] * v[2],
          u[0] * v[1] - u[1] * v[0],
        ) > 1e-10
      );
    };
    const mapped = (points) => points.map(([x, y, z]) => [x, height(y), z]);
    const out = {
      addQuad(slot, ref, points, _normal, uv, color) {
        const p = mapped(points);
        if (solid(p.slice(0, 3)) && solid([p[0], p[2], p[3]]))
          target.addQuad(slot, ref, p, normalFor(...p.slice(0, 3)), uv, color);
      },
      addTriangle(slot, ref, points, _normal, uv, color) {
        const p = mapped(points);
        if (solid(p)) target.addTriangle(slot, ref, p, normalFor(...p), uv, color);
      },
      addConvexPolygon(slot, ref, points, _normal, uv, color) {
        const p = mapped(points);
        target.addConvexPolygon(slot, ref, p, normalFor(...p.slice(0, 3)), uv, color);
      },
    };
    // Lowest modeled datum is historic low water. Buried caisson is deliberately excluded.
    const base = transformed(out, -Math.PI / 8);
    const lens = [];
    for (let i = 0; i < selectCount(128, 64, 32, 16); i++) {
      const a = (i * tau) / selectCount(128, 64, 32, 16);
      const z = Math.sqrt(7.3 * 7.3 - 1.8 * 1.8) * Math.cos(a);
      lens.push([Math.sign(Math.sin(a)) * (Math.sqrt(Math.max(0, 7.3 * 7.3 - z * z)) - 1.8), 0, z]);
    }
    for (let i = 0; i < selectCount(128, 64, 32, 16); i++) {
      const a = lens[i],
        b = lens[(i + 1) % selectCount(128, 64, 32, 16)];
      const n = [(a[0] + b[0]) / 2, 0, (a[2] + b[2]) / 2],
        length = Math.hypot(...n);
      quad(
        base,
        'metal',
        [a, b, [b[0], 1.8, b[2]], [a[0], 1.8, a[2]]],
        n.map((v) => v / length),
        black,
      );
      base.addTriangle(
        'metal',
        'palette:#ffffff',
        [
          [0, 1.8, 0],
          [a[0], 1.8, a[2]],
          [b[0], 1.8, b[2]],
        ],
        [0, 1, 0],
        [
          [0, 0],
          [0, 1],
          [1, 1],
        ],
        black,
      );
    }
    lathe(
      out,
      'metal',
      [
        [1.8, 5.05],
        [2.1, 5.03],
        [7.9, 3.2],
        [8, 3.2],
      ],
      black,
      192,
    );
    for (const y of [2.2, 3.4, 4.6, 5.8, 7]) {
      const r = 5.05 - ((y - 1.8) * 1.85) / 6.1;
      ring(out, 'metal', y, r - 0.01, r + 0.016, 0.035, black, 192);
      for (let i = 0; i < selectCount(160, 80, 0, 0); i++)
        rivet(out, point(r + 0.024, y + 0.06, (i * tau) / selectCount(160, 80, 1, 1)), black);
    }
    // The documented opposing 19-rung ladders follow the taper, ENE and WSW.
    for (const a of [(5 * Math.PI) / 8, (-3 * Math.PI) / 8]) {
      const o = transformed(out, a),
        bottom = 5.04,
        top = 3.26;
      for (const x of [-0.26, 0.26])
        beam(o, 'metal', [x, 1.85, bottom], [x, 8.2, top], 0.055, 0.06, black);
      for (let i = 0; i < 19; i++) {
        const t = i / 18;
        tube(
          o,
          'metal',
          [-0.26, 2.05 + 5.95 * t, bottom + (top - bottom) * t],
          [0.26, 2.05 + 5.95 * t, bottom + (top - bottom) * t],
          0.027,
          black,
          8,
        );
      }
    }
    const doors = [(5 * Math.PI) / 8, (-3 * Math.PI) / 8].map((angle) => ({
      angle,
      y: 8.05,
      h: 1.92,
      w: 0.73,
      depth: 0.13,
      trimSlot: 'metal',
      trimColor: white,
    }));
    shell(out, {
      profile: [
        [8, 3.2],
        [12.3, shaftRadius(12.3)],
        [16.6, shaftRadius(16.6)],
        [20.7, 2.55],
      ],
      holes:
        mode === 'district'
          ? doors
          : [
              ...doors,
              ...[9.55, 13.8, 18.05].flatMap((y) =>
                [0, Math.PI / 2, Math.PI, -Math.PI / 2].map((angle) => ({
                  angle,
                  y: y - 0.19,
                  h: 0.38,
                  w: 0.38,
                  depth: 0.13,
                  circular: true,
                })),
              ),
            ],
      slot: 'metal',
      color: paint,
      segments: selectCount(192, 64, 32, 12),
    });

    for (let y = 8.25; y < 20.7; y += 1.06) {
      const r = shaftRadius(y);
      ring(out, 'metal', y, r - 0.012, r + 0.012, 0.021, paint(y), 192);
      for (let i = 0; i < selectCount(112, 56, 0, 0); i++)
        rivet(
          out,
          point(r + 0.018, y + 0.06, (i * tau) / selectCount(112, 56, 1, 1)),
          paint(y),
          0.015,
        );
    }
    for (let i = 0; i < selectCount(12, 6, 0, 0); i++)
      for (let y = 8.15; y < 20.6; y += selectCount(0.24, 0.48, 1, 1))
        rivet(out, point(shaftRadius(y) + 0.022, y, ((i + 0.5) * tau) / 12), paint(y), 0.016);
    // Service room: three 1.9 m projecting round bays, NE bay extends to the stair lantern.
    const serviceHoles = [Math.PI / 2, Math.PI, -Math.PI / 4].map((angle) => ({
      angle,
      y: 21.65,
      h: 1.35,
      w: 0.64,
      depth: 0.12,
      trimSlot: 'metal',
      trimColor: white,
      grid: mode !== 'district',
    }));
    shell(out, {
      profile: [
        [20.7, 2.55],
        [24.1, 2.55],
      ],
      holes: serviceHoles,
      cutBays: true,
      slot: 'metal',
      color: red,
      segments: 192,
    });
    if (mode === 'district')
      for (const y of [9.55, 13.8, 18.05])
        for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
          panel(
            transformed(out, a),
            'glass',
            -0.19,
            0.19,
            y - 0.19,
            y + 0.19,
            shaftRadius(y) + 0.02,
            glass,
          );
    ring(out, 'metal', 20.63, 2.48, 2.7, 0.14, red, 192);
    for (const a of bays) {
      const c = point(bayDistance, 0, a),
        o = transformed(out, 0, c),
        stair = a === bays[2];
      lathe(
        o,
        'metal',
        [
          [18.65, 0.05],
          [19.05, 0.27],
          [20.45, 0.85],
          [20.7, 0.98],
        ],
        red,
        96,
      );
      const windowAngle = a,
        top = stair ? 27.5 : 24.1;
      shell(o, {
        profile: [[20.7, 0.95], [24.1, 0.95], ...(stair ? [[27.5, 0.95]] : [])],
        bayAngle: a,
        holes: [
          {
            angle: windowAngle,
            y: 21.6,
            h: 1.42,
            w: 0.62,
            trimSlot: 'metal',
            trimColor: white,
            depth: 0.11,
            grid: true,
          },
          ...(stair
            ? [
                {
                  angle: windowAngle,
                  y: 25.3,
                  h: 1.15,
                  w: 0.65,
                  trimSlot: 'metal',
                  trimColor: white,
                  depth: 0.11,
                  grid: true,
                },
              ]
            : []),
        ],
        slot: 'metal',
        color: (y) => (y < 24.1 ? red : white),
        segments: selectCount(96, 48, 24, 12),
      });
      ring(o, 'metal', 20.63, 0.87, 1.01, 0.14, red, 96);
      if (stair) {
        ring(o, 'metal', top, 0.9, 1.04, 0.12, white, 96);
        dome(o, 1.06, top + 0.1, 0.75);
        lathe(
          o,
          'metal',
          [
            [28.35, 0.12],
            [28.65, 0.04],
          ],
          black,
          32,
        );
      } else {
        ring(o, 'metal', 24.1, 0.05, 1.05, 0.15, white, 96);
        gallery(out, 1.07, 24.26, [c[0], c[2]], a - (3 * Math.PI) / 4, a + (3 * Math.PI) / 4);
      }
      for (const y of [21, 22.9, 23.9])
        for (let i = 0; i < selectCount(64, 32, 0, 0); i++)
          rivet(o, point(0.966, y, (i * tau) / selectCount(64, 32, 1, 1)), red, 0.016);
    }
    ring(out, 'metal', 24.1, 1.95, 2.68, 0.15, white, 192);
    // Gallery perimeter follows each projecting bay; avoid a railing through the access bay.
    for (let i = 0; i < selectCount(192, 64, 32, 12); i++) {
      const a = (i * tau) / selectCount(192, 64, 32, 12),
        b = ((i + 1) * tau) / selectCount(192, 64, 32, 12),
        mid = (a + b) / 2;
      if (bays.some((t) => Math.abs(Math.atan2(Math.sin(mid - t), Math.cos(mid - t))) < 0.37))
        continue;
      for (const y of mode === 'district' ? [25.31] : [24.75, 25.31])
        tube(out, 'metal', point(2.68, y, a), point(2.68, y, b), 0.022, white, 8);
      if (i % 4 === 0)
        tube(out, 'metal', point(2.68, 24.25, a), point(2.68, 25.33, a), 0.026, white, 8);
    }
    // White lantern drum, recessed separated glazing, dark copper dome and ventilation finial.
    lathe(
      out,
      'metal',
      [
        [24.25, 1.99],
        [25.85, 1.99],
      ],
      white,
      128,
    );
    for (let i = 0; i < selectCount(16, 16, 12, 8); i++) {
      const a = (i * tau) / selectCount(16, 16, 12, 8),
        b = ((i + 1) * tau) / selectCount(16, 16, 12, 8);
      quad(
        out,
        mode === 'skyline' ? 'glass' : 'glassClear',
        [
          point(1.95, 25.85, a + 0.018),
          point(1.95, 25.85, b - 0.018),
          point(1.95, 27.38, b - 0.018),
          point(1.95, 27.38, a + 0.018),
        ],
        [Math.sin((a + b) / 2), 0, Math.cos((a + b) / 2)],
        glass,
      );
      tube(out, 'metal', point(1.99, 25.84, a), point(1.99, 27.45, a), 0.042, white, 8);
      tube(out, 'metal', point(1.985, 26.57, a), point(1.985, 26.57, b), 0.028, white, 8);
    }
    ring(out, 'metal', 27.4, 1.92, 2.13, 0.16, white, 128);
    dome(out, 2.13, 27.55, 1.75);
    lathe(
      out,
      'metal',
      [
        [29.29, 0.15],
        [29.48, 0.23],
        [29.72, 0.23],
        [29.86, 0.09],
        [30.2, 0.055],
        [30.7, 0.016],
      ],
      black,
      48,
    );
    // Connecting barrel and east-side battery cupboard, separately legible at gallery level.
    const connect = transformed(out, bays[2]);
    box(connect, 'metal', [-0.56, 24.25, 1.55], [0.56, 26.85, bayDistance], white);
    for (let i = 0; i < selectCount(24, 12, 8, 4); i++) {
      const a = (i * Math.PI) / selectCount(24, 12, 8, 4),
        b = ((i + 1) * Math.PI) / selectCount(24, 12, 8, 4);
      quad(
        connect,
        'metal',
        [
          [0.6 * Math.cos(a), 26.85 + 0.6 * Math.sin(a), 1.45],
          [0.6 * Math.cos(b), 26.85 + 0.6 * Math.sin(b), 1.45],
          [0.6 * Math.cos(b), 26.85 + 0.6 * Math.sin(b), bayDistance],
          [0.6 * Math.cos(a), 26.85 + 0.6 * Math.sin(a), bayDistance],
        ],
        [Math.cos((a + b) / 2), Math.sin((a + b) / 2), 0],
        black,
      );
    }
    box(out, 'metal', [1.75, 24.25, -0.6], [2.73, 26.05, 0.65], white);
    box(out, 'metal', [1.7, 26.05, -0.65], [2.8, 26.14, 0.7], black);
    panel(transformed(out, Math.PI / 2), 'glass', -0.35, 0.35, 24.5, 25.78, 2.745, glass);
    // Landing davit and two timber mooring dolphins from the maintained offshore appearance.
    const davit = transformed(out, (-3 * Math.PI) / 8);
    beam(davit, 'metal', [0, 18.1, 2.91], [0, 20.3, 2.91], 0.08, 0.1, black);
    beam(davit, 'metal', [0, 20.3, 2.91], [0, 20.85, 4.5], 0.08, 0.1, black);
    tube(davit, 'metal', [0, 20.85, 4.5], [0, 17.9, 4.5], 0.014, black, 6);
    for (const a of [(5 * Math.PI) / 8, (-3 * Math.PI) / 8]) {
      const p = point(6.35, 0, a);
      tube(out, 'wood', p, [p[0], 7.7, p[2]], 0.2, [0.22, 0.18, 0.14], 20);
      for (const y of [2, 4.4, 6.7])
        lathe(
          out,
          'metal',
          [
            [y, 0.22],
            [y + 0.1, 0.22],
          ],
          black,
          32,
          [p[0], p[2]],
        );
    }
  }

  build(target);
}
export function buildRoterSandReviewed(out) {
  detail(out);
}
export function buildRoterSandCloseup(out) {
  detail(out, 'closeup');
}
export function buildRoterSandStreet(out) {
  detail(out, 'street');
}
export function buildRoterSandDistrict(out) {
  detail(out, 'district');
}
