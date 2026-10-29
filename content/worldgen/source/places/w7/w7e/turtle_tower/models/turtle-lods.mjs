/** Complete browser derivatives; dense weathered masters remain unchanged. */
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  beamPath,
  sphere as fullSphere,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { box as fullBox } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

function components(level) {
  const skyline = level === 'skyline',
    district = level === 'district' || skyline,
    close = level === 'closeup',
    tau = Math.PI * 2,
    stone = [0.73, 0.71, 0.65],
    edge = [0.64, 0.63, 0.55];
  function box(out, slot, a, b, color) {
    if (
      district &&
      slot === 'plaster' &&
      b[2] - a[2] < 0.3 &&
      (b[0] - a[0] < 0.25 || b[1] - a[1] < 0.16)
    )
      face(
        out,
        slot,
        [
          [a[0], a[1], b[2]],
          [b[0], a[1], b[2]],
          [b[0], b[1], b[2]],
          [a[0], b[1], b[2]],
        ],
        color,
      );
    else fullBox(out, slot, a, b, color);
  }
  function sphere(out, slot, c, r, color, n = 16, lat = 8) {
    fullSphere(
      out,
      slot,
      c,
      r,
      color,
      Math.min(n, close ? 16 : district ? 6 : 8),
      Math.min(lat, close ? 8 : district ? 3 : 4),
    );
  }
  function facade(out, slot, width, y0, y1, z, windows, color) {
    const xs = [
        ...new Set([
          -width / 2,
          width / 2,
          ...windows.flatMap((w) => [w.x - w.w / 2, w.x + w.w / 2]),
        ]),
      ].sort((a, b) => a - b),
      ys = [...new Set([y0, y1, ...windows.flatMap((w) => [w.y, w.top])])].sort((a, b) => a - b);
    for (let j = 0; j < ys.length - 1; j++)
      for (let i = 0; i < xs.length - 1; i++) {
        const x = (xs[i] + xs[i + 1]) / 2,
          y = (ys[j] + ys[j + 1]) / 2;
        if (windows.some((w) => x > w.x - w.w / 2 && x < w.x + w.w / 2 && y > w.y && y < w.top))
          continue;
        face(
          out,
          slot,
          [
            [xs[i], ys[j], z],
            [xs[i + 1], ys[j], z],
            [xs[i + 1], ys[j + 1], z],
            [xs[i], ys[j + 1], z],
          ],
          color,
        );
      }
    for (const w of windows) {
      const r = w.w / 2,
        n = close ? 16 : skyline ? 2 : district ? 4 : 8,
        t = w.depth ?? 0.45,
        h = (x) =>
          w.spring +
          w.rise *
            (w.pointed
              ? Math.sqrt(Math.max(0, 4 - (Math.abs(x) / r + 1) ** 2)) / Math.sqrt(3)
              : Math.sqrt(Math.max(0, 1 - (x / r) ** 2))),
        arc = [];
      if (w.back !== false)
        face(
          out,
          'plaster',
          [
            [w.x - r, w.y, z - t],
            [w.x + r, w.y, z - t],
            [w.x + r, w.spring + w.rise, z - t],
            [w.x - r, w.spring + w.rise, z - t],
          ],
          edge,
        );
      for (let i = 0; i < n; i++) {
        const a = -r + (w.w * i) / n,
          b = -r + (w.w * (i + 1)) / n,
          ya = h(a),
          yb = h(b);
        arc.push([w.x + a, ya, z + 0.025]);
        if (w.top > Math.max(ya, yb))
          face(
            out,
            slot,
            [
              [w.x + a, ya, z],
              [w.x + b, yb, z],
              [w.x + b, w.top, z],
              [w.x + a, w.top, z],
            ],
            color,
          );
        face(
          out,
          slot,
          [
            [w.x + a, ya, z - t],
            [w.x + b, yb, z - t],
            [w.x + b, yb, z],
            [w.x + a, ya, z],
          ],
          color,
        );
      }
      arc.push([w.x + r, h(r), z + 0.025]);
      if (w.trim) {
        if (district)
          for (let i = 1; i < arc.length; i++) {
            const a = arc[i - 1],
              b = arc[i];
            face(
              out,
              slot,
              [
                [a[0], a[1] - w.trim / 2, a[2]],
                [b[0], b[1] - w.trim / 2, b[2]],
                [b[0], b[1] + w.trim / 2, b[2]],
                [a[0], a[1] + w.trim / 2, a[2]],
              ],
              color,
            );
          }
        else beamPath(out, slot, arc, w.trim, w.trim, color);
      }
      if (w.spring > w.y) {
        face(
          out,
          slot,
          [
            [w.x - r, w.y, z],
            [w.x - r, w.y, z - t],
            [w.x - r, w.spring, z - t],
            [w.x - r, w.spring, z],
          ],
          color,
        );
        face(
          out,
          slot,
          [
            [w.x + r, w.y, z - t],
            [w.x + r, w.y, z],
            [w.x + r, w.spring, z],
            [w.x + r, w.spring, z - t],
          ],
          color,
        );
        if (w.trim)
          for (const sign of [-1, 1])
            box(
              out,
              slot,
              [w.x + sign * r - w.trim / 2, w.y, z],
              [w.x + sign * r + w.trim / 2, w.spring, z + w.trim],
              color,
            );
      }
    }
  }
  function band(out, w, d, y, h, over = 0, color = edge) {
    box(
      out,
      'plaster',
      [-w / 2 - over, y, -d / 2 - over],
      [w / 2 + over, y + h, d / 2 + over],
      color,
    );
  }
  function curve(out, points, width = 0.06, color = edge, slot = 'plaster') {
    const max = close ? 36 : district ? 5 : 12;
    if (points.length > max + 1)
      points = Array.from(
        { length: max + 1 },
        (_, i) => points[Math.round((i * (points.length - 1)) / max)],
      );
    beamPath(out, slot, points, width, width, color);
  }

  function stairs(out) {
    for (let i = 0; i < 4; i++)
      box(out, 'plaster', [-0.82, i * 0.2, 2.36], [0.82, (i + 1) * 0.2, 3.85 - i * 0.32], stone);
    for (const x of [-0.97, 0.97]) {
      loft(
        out,
        'plaster',
        [
          [
            [x - 0.12, 0, 2.43],
            [x - 0.12, 0, 3.94],
            [x + 0.12, 0, 3.94],
            [x + 0.12, 0, 2.43],
          ],
          [
            [x - 0.12, 1.02, 2.43],
            [x - 0.12, 0.54, 3.94],
            [x + 0.12, 0.54, 3.94],
            [x + 0.12, 1.02, 2.43],
          ],
        ],
        edge,
      );
      box(out, 'plaster', [x - 0.18, 0, 3.69], [x + 0.18, 0.61, 4.05], edge);
      box(out, 'plaster', [x - 0.23, 0.61, 3.64], [x + 0.23, 0.7, 4.1], stone);
      sphere(out, 'plaster', [x, 0.745, 3.87], [0.18, 0.075, 0.18], edge, 12, 6);
    }
  }
  function arcade(out, w, d, y0, y1, upper = false) {
    for (let side = 0; side < 4; side++) {
      const o = transform(out, (side * Math.PI) / 2),
        width = side % 2 ? d : w,
        depth = side % 2 ? w : d;
      const xs = side % 2 ? [-width * 0.255, width * 0.255] : [-width * 0.325, 0, width * 0.325];
      const windows = xs.map((x, i) => {
        const center = side % 2 === 0 && i === 1;
        const ww = upper ? (center ? 1.05 : 0.57) : center ? 1.4 : 0.73,
          spring = y0 + (upper ? (center ? 1.02 : 0.89) : center ? 1.12 : 0.96);
        return {
          x,
          w: ww,
          y: y0,
          spring,
          rise: upper ? (center ? 0.65 : 0.54) : center ? 0.87 : 0.67,
          top: y1 - 0.19,
          depth: upper ? 0.33 : 0.42,
          back: false,
          pointed: true,
          trim: 0.065,
        };
      });
      facade(o, 'plaster', width, y0, y1, depth / 2, windows, stone);
      // Inner faces keep the open galleries convincing when viewed through several arches.
      const inner = transform(o, Math.PI, [0, 0, depth - 0.4 * 2]);
      facade(
        inner,
        'plaster',
        width - 0.8,
        y0,
        y1,
        depth / 2 - 0.4,
        windows.map((v) => ({ ...v, x: -v.x, trim: 0, depth: 0.015 })),
        stone,
      );
      for (const x of [-width / 2 + 0.1, width / 2 - 0.1])
        box(o, 'plaster', [x - 0.1, y0, depth / 2], [x + 0.1, y1, depth / 2 + 0.105], edge);
      // Rectangular recessed surrounds and vertical pilasters above each pointed arch.
      for (const win of windows) {
        const span = upper ? win.w + 0.28 : win.w + 0.38;
        for (const x of [win.x - span / 2, win.x + span / 2])
          box(
            o,
            'plaster',
            [x - 0.042, y0 + 0.01, depth / 2 + 0.006],
            [x + 0.042, y1 - 0.17, depth / 2 + 0.083],
            edge,
          );
        box(
          o,
          'plaster',
          [win.x - span / 2 - 0.04, y1 - 0.26, depth / 2 + 0.006],
          [win.x + span / 2 + 0.04, y1 - 0.17, depth / 2 + 0.084],
          edge,
        );
      }
    }
    band(out, w, d, y1, 0.1, 0.14, edge);
    band(out, w, d, y1 + 0.1, 0.09, 0.23, stone);
    band(out, w, d, y1 + 0.19, 0.075, 0.17, edge);
  }
  function lowerParapet(out) {
    // Solid brick infill, divided by short stone posts, above the first arcade.
    for (let side = 0; side < 4; side++) {
      const o = transform(out, (side * Math.PI) / 2),
        w = side % 2 ? 4.54 : 6.28,
        z = side % 2 ? 3.14 : 2.27;
      box(
        o,
        'brick',
        [-w / 2 + 0.16, 3.54, z - 0.16],
        [w / 2 - 0.16, 3.88, z + 0.02],
        [0.56, 0.39, 0.29],
      );
      for (const x of [-w / 2 + 0.02, 0, w / 2 - 0.02]) {
        box(o, 'plaster', [x - 0.1, 3.5, z - 0.23], [x + 0.1, 4.03, z + 0.075], edge);
        box(o, 'plaster', [x - 0.17, 4.03, z - 0.29], [x + 0.17, 4.12, z + 0.14], stone);
      }
      box(o, 'plaster', [-w / 2, 3.89, z - 0.22], [w / 2, 3.98, z + 0.055], edge);
    }
  }
  function upperRail(out, w, d, y) {
    for (let side = 0; side < 4; side++) {
      const o = transform(out, (side * Math.PI) / 2),
        width = side % 2 ? d : w,
        z = (side % 2 ? w : d) / 2;
      const n = Math.floor(width / (close ? 0.15 : district ? 0.5 : 0.25));
      box(o, 'plaster', [-width / 2, y, z - 0.15], [width / 2, y + 0.105, z + 0.07], edge);
      for (let j = 0; j <= n; j++) {
        const x = -width / 2 + (width * j) / n;
        box(o, 'plaster', [x - 0.035, y + 0.1, z - 0.085], [x + 0.035, y + 0.44, z + 0.025], stone);
      }
      box(
        o,
        'plaster',
        [-width / 2 - 0.025, y + 0.44, z - 0.16],
        [width / 2 + 0.025, y + 0.535, z + 0.1],
        edge,
      );
      for (const x of [-width / 2 + 0.04, width / 2 - 0.04]) {
        box(o, 'plaster', [x - 0.1, y - 0.02, z - 0.19], [x + 0.1, y + 0.68, z + 0.13], edge);
        box(o, 'plaster', [x - 0.14, y + 0.68, z - 0.23], [x + 0.14, y + 0.76, z + 0.17], stone);
      }
    }
  }
  function circleWall(out, width, y0, y1, z, cy, r) {
    const n = close ? 48 : skyline ? 8 : district ? 12 : 24,
      point = (a, rr) => [Math.cos(a) * rr, cy + Math.sin(a) * rr, z],
      outer = [
        [-width / 2, y0],
        [width / 2, y0],
        [width / 2, y1],
        [-width / 2, y1],
      ],
      hole = Array.from({ length: n }, (_, i) => [
        Math.cos((i * tau) / n) * r,
        cy + Math.sin((i * tau) / n) * r,
      ]),
      temp = new MeshBufferBuilder();
    if (
      !temp.addCap(
        'plaster',
        'palette:#ffffff',
        outer,
        [hole],
        () => 0,
        [0, 1, 0],
        (p) => p,
        stone,
      )
    )
      throw new Error('Turtle circular aperture triangulation failed');
    const mesh = temp.finalize();
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const p = Array.from(mesh.indices.slice(i, i + 3), (j) => [
        mesh.positions[j * 3],
        mesh.positions[j * 3 + 2],
        z,
      ]);
      triangle(out, 'plaster', [p[0], p[2], p[1]], stone);
    }
    for (let i = 0; i < n; i++) {
      const a = (i * tau) / n,
        b = ((i + 1) * tau) / n,
        ia = point(a, r),
        ib = point(b, r);
      face(out, 'plaster', [ia, ib, [ib[0], ib[1], z - 0.24], [ia[0], ia[1], z - 0.24]], edge);
      const p = [
        point(a, r + 0.0075),
        point(a, r + 0.0625),
        point(b, r + 0.0625),
        point(b, r + 0.0075),
      ].map((p) => [p[0], p[1], z + 0.0275]);
      face(out, 'plaster', p, edge);
    }
  }

  function medallion(out, x, y, z, r) {
    if (district) {
      for (let i = 0; i < 8; i++) {
        const a = (i * tau) / 8,
          b = ((i + 1) * tau) / 8,
          p = (rr, t) => [x + Math.cos(t) * rr, y + Math.sin(t) * rr, z];
        face(
          out,
          'plaster',
          [p(r - 0.022, a), p(r + 0.022, a), p(r + 0.022, b), p(r - 0.022, b)],
          edge,
        );
        triangle(out, 'plaster', [[x, y, z + 0.008], p(r * 0.25, a), p(r * 0.25, b)], edge);
      }
      return;
    }
    const segments = close ? 24 : 12;
    for (let i = 0; i < segments; i++) {
      const a = (i * tau) / segments,
        b = ((i + 1) * tau) / segments;
      beam(
        out,
        'plaster',
        [x + Math.cos(a) * r, y + Math.sin(a) * r, z],
        [x + Math.cos(b) * r, y + Math.sin(b) * r, z],
        0.045,
        0.045,
        edge,
      );
    }
    for (let i = 0; i < (close ? 12 : 6); i++) {
      const a = (i * tau) / (close ? 12 : 6);
      beam(
        out,
        'plaster',
        [x + Math.cos(a) * r * 0.28, y + Math.sin(a) * r * 0.28, z + 0.012],
        [x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86, z + 0.012],
        0.035,
        0.035,
        edge,
      );
    }
    sphere(out, 'plaster', [x, y, z + 0.008], [r * 0.25, r * 0.25, 0.035], edge, 16, 8);
  }
  function third(out) {
    const w = 2.97,
      d = 1.9,
      y0 = 6.23,
      y1 = 7.53;
    circleWall(out, w, y0, y1, d / 2, 6.85, 0.34);
    box(out, 'plaster', [-w / 2, y0, -d / 2], [w / 2, y1, -d / 2 + 0.24], stone);
    for (const s of [-1, 1]) {
      const o = transform(out, (s * Math.PI) / 2);
      facade(
        o,
        'plaster',
        d,
        y0,
        y1,
        w / 2,
        [
          {
            x: 0,
            w: 0.56,
            y: y0 + 0.12,
            spring: 7.08,
            rise: 0.28,
            top: y1,
            depth: 0.2,
            back: true,
            trim: 0.06,
          },
        ],
        stone,
      );
      const p = [];
      const segments = close ? 16 : district ? 4 : 8;
      for (let i = 0; i <= segments; i++) {
        const x = -d / 2 + (i * d) / segments;
        p.push([x, 7.4 + 0.52 * Math.sin((Math.PI * i) / segments), w / 2 + 0.055]);
      }
      curve(o, p, 0.105, edge);
    }
    // Original restrained inscription plaque: border/three relief fields, no invented characters.
    box(out, 'plaster', [-0.54, 7.27, d / 2], [0.54, 7.47, d / 2 + 0.065], edge);
    for (const x of [-0.35, 0, 0.35])
      box(out, 'plaster', [x - 0.11, 7.3, d / 2 + 0.065], [x + 0.11, 7.44, d / 2 + 0.085], stone);
    band(out, w, d, 7.53, 0.1, 0.13);
    band(out, 2, 2, 7.64, 0.47, 0, stone);
    for (let side = 0; side < 4; side++) {
      const o = transform(out, (side * Math.PI) / 2);
      medallion(o, 0, 7.88, 1.008, 0.19);
      for (const x of [-0.88, -0.68, 0.68, 0.88])
        box(o, 'plaster', [x - 0.035, 7.7, 1.0], [x + 0.035, 8.05, 1.075], edge);
    }
  }
  function roof(out) {
    const y = 8.11;
    const ring = (yy, r) => radialRing(yy, r, r, 4, [0, 0], Math.PI / 4);
    loft(out, 'plaster', [ring(y, 1.75), ring(8.31, 1.42), ring(8.47, 0.38)], edge);
    for (let side = 0; side < 4; side++) {
      const o = transform(out, (side * Math.PI) / 2);
      // Four upward-curled ridge tips and paired scrolls match the Vietnamese roof silhouette.
      const pts = [
        [-1.19, 8.14, 1.19],
        [-1.29, 8.2, 1.29],
        [-1.37, 8.33, 1.37],
        [-1.43, 8.55, 1.43],
        [-1.42, 8.74, 1.42],
        [-1.31, 8.75, 1.31],
      ];
      curve(o, pts, 0.095, edge);
      for (const sign of [-1, 1]) {
        const p = [[sign * 0.85, 8.2, 1.1]];
        const segments = close ? 24 : district ? 4 : 12;
        for (let i = 0; i <= segments; i++) {
          const t = i / segments,
            a = t * Math.PI * 1.66,
            r = 0.27 * (1 - t * 0.56);
          p.push([sign * (0.58 + Math.cos(a) * r), 8.31 + Math.sin(a) * r, 1.1]);
        }
        curve(o, p, 0.07, edge);
      }
      for (let i = 0; !district && i < 15; i += close ? 1 : 3) {
        const x = -1.1 + (i * 2.2) / 14;
        curve(
          o,
          [
            [x, 8.13, 1.14],
            [x * 0.7, 8.31, 0.83],
            [x * 0.22, 8.47, 0.26],
          ],
          0.034,
          [0.47, 0.47, 0.4],
        );
      }
    }
    sphere(out, 'plaster', [0, 8.53, 0], [0.16, 0.18, 0.16], edge, 24, 12);
  }
  function lights(out) {
    for (let side = 0; side < 4; side++) {
      const o = transform(out, (side * Math.PI) / 2),
        w = side % 2 ? 4.54 : 6.28,
        z = (side % 2 ? 6.28 : 4.54) / 2;
      for (const y of [0.65, 3.25])
        for (const x of [-w * 0.32, 0, w * 0.32]) {
          const fixture = transform(o, -0.25, [x, y, z + 0.16]);
          box(fixture, 'metal', [-0.09, 0, 0], [0.09, 0.17, 0.16], [0.28, 0.3, 0.28]);
          box(fixture, 'glass', [-0.07, 0.02, 0.161], [0.07, 0.13, 0.17], [0.64, 0.66, 0.53]);
        }
    }
  }
  function build(raw) {
    const out = raw;
    band(out, 6.48, 4.74, 0, 0.64, 0, stone);
    band(out, 6.28, 4.54, 0.64, 0.09, 0.19, edge);
    band(out, 6.28, 4.54, 0.73, 0.07, 0.13, stone);
    stairs(out);
    arcade(out, 6.28, 4.54, 0.8, 3.21);
    lowerParapet(out);
    arcade(out, 4.8, 3.64, 3.47, 5.7, true);
    upperRail(out, 4.8, 3.64, 5.965);
    third(out);
    roof(out);
    if (!district) lights(raw);
  }

  function distant(out) {
    band(out, 6.48, 4.74, 0, 0.64, 0, stone);
    band(out, 6.28, 4.54, 0.64, 0.16, 0.19, edge);
    for (let i = 0; i < 4; i++)
      box(out, 'plaster', [-0.82, i * 0.2, 2.36], [0.82, (i + 1) * 0.2, 3.85 - i * 0.32], stone);
    for (const x of [-0.97, 0.97]) {
      loft(
        out,
        'plaster',
        [
          [
            [x - 0.12, 0, 2.43],
            [x - 0.12, 0, 3.94],
            [x + 0.12, 0, 3.94],
            [x + 0.12, 0, 2.43],
          ],
          [
            [x - 0.12, 1.02, 2.43],
            [x - 0.12, 0.54, 3.94],
            [x + 0.12, 0.54, 3.94],
            [x + 0.12, 1.02, 2.43],
          ],
        ],
        edge,
        { cap: false },
      );
      box(out, 'plaster', [x - 0.2, 0, 3.65], [x + 0.2, 0.7, 4.1], edge);
    }
    for (const [w, d, y0, y1, upper] of [
      [6.28, 4.54, 0.8, 3.21, false],
      [4.8, 3.64, 3.47, 5.7, true],
    ]) {
      for (let side = 0; side < 4; side++) {
        const o = transform(out, (side * Math.PI) / 2),
          width = side % 2 ? d : w,
          depth = side % 2 ? w : d,
          xs = side % 2 ? [-width * 0.255, width * 0.255] : [-width * 0.325, 0, width * 0.325];
        facade(
          o,
          'plaster',
          width,
          y0,
          y1,
          depth / 2,
          xs.map((x, i) => {
            const center = side % 2 === 0 && i === 1;
            return {
              x,
              w: upper ? (center ? 1.05 : 0.57) : center ? 1.4 : 0.73,
              y: y0,
              spring: y0 + (upper ? (center ? 1.02 : 0.89) : center ? 1.12 : 0.96),
              rise: upper ? (center ? 0.65 : 0.54) : center ? 0.87 : 0.67,
              top: y1 - 0.19,
              depth: upper ? 0.33 : 0.42,
              back: false,
              pointed: true,
              trim: 0,
            };
          }),
          stone,
        );
        for (const x of [-width / 2 + 0.1, width / 2 - 0.1])
          face(
            o,
            'plaster',
            [
              [x - 0.1, y0, depth / 2 + 0.105],
              [x + 0.1, y0, depth / 2 + 0.105],
              [x + 0.1, y1, depth / 2 + 0.105],
              [x - 0.1, y1, depth / 2 + 0.105],
            ],
            edge,
          );
      }
      band(out, w, d, y1, 0.265, 0.23, edge);
    }
    for (let side = 0; side < 4; side++) {
      const o = transform(out, (side * Math.PI) / 2),
        w = side % 2 ? 4.54 : 6.28,
        z = side % 2 ? 3.14 : 2.27;
      box(
        o,
        'brick',
        [-w / 2 + 0.16, 3.54, z - 0.16],
        [w / 2 - 0.16, 3.88, z + 0.02],
        [0.56, 0.39, 0.29],
      );
      face(
        o,
        'plaster',
        [
          [-w / 2, 3.98, z + 0.055],
          [w / 2, 3.98, z + 0.055],
          [w / 2, 3.98, z - 0.22],
          [-w / 2, 3.98, z - 0.22],
        ],
        edge,
      );
      face(
        o,
        'plaster',
        [
          [-0.1, 3.5, z + 0.075],
          [0.1, 3.5, z + 0.075],
          [0.1, 4.12, z + 0.075],
          [-0.1, 4.12, z + 0.075],
        ],
        edge,
      );
    }
    for (const x of [-3.02, 3.02])
      for (const z of [-2.15, 2.15])
        box(out, 'plaster', [x - 0.1, 3.5, z - 0.1], [x + 0.1, 4.12, z + 0.1], edge);
    for (let side = 0; side < 4; side++) {
      const o = transform(out, (side * Math.PI) / 2),
        w = side % 2 ? 3.64 : 4.8,
        z = (side % 2 ? 4.8 : 3.64) / 2;
      for (const [y, h] of [
        [5.965, 0.105],
        [6.405, 0.095],
      ])
        face(
          o,
          'plaster',
          [
            [-w / 2, y, z + 0.1],
            [w / 2, y, z + 0.1],
            [w / 2, y + h, z + 0.1],
            [-w / 2, y + h, z + 0.1],
          ],
          edge,
        );
      for (const x of [-w / 6, w / 6])
        face(
          o,
          'plaster',
          [
            [x - 0.035, 6.07, z + 0.025],
            [x + 0.035, 6.07, z + 0.025],
            [x + 0.035, 6.405, z + 0.025],
            [x - 0.035, 6.405, z + 0.025],
          ],
          stone,
        );
    }
    for (const x of [-2.36, 2.36])
      for (const z of [-1.78, 1.78])
        box(out, 'plaster', [x - 0.1, 5.945, z - 0.1], [x + 0.1, 6.725, z + 0.1], edge);
    circleWall(out, 2.97, 6.23, 7.53, 0.95, 6.85, 0.34);
    box(out, 'plaster', [-1.485, 6.23, -0.95], [1.485, 7.53, -0.71], stone);
    for (const sign of [-1, 1])
      facade(
        transform(out, (sign * Math.PI) / 2),
        'plaster',
        1.9,
        6.23,
        7.53,
        1.485,
        [
          {
            x: 0,
            w: 0.56,
            y: 6.35,
            spring: 7.08,
            rise: 0.28,
            top: 7.53,
            depth: 0.2,
            back: true,
            trim: 0,
          },
        ],
        stone,
      );
    band(out, 2.97, 1.9, 7.53, 0.1, 0.13);
    band(out, 2, 2, 7.64, 0.47, 0, stone);
    face(
      out,
      'plaster',
      [
        [-0.54, 7.27, 1.015],
        [0.54, 7.27, 1.015],
        [0.54, 7.47, 1.015],
        [-0.54, 7.47, 1.015],
      ],
      edge,
    );
    for (const x of [-0.35, 0, 0.35])
      face(
        out,
        'plaster',
        [
          [x - 0.11, 7.3, 1.035],
          [x + 0.11, 7.3, 1.035],
          [x + 0.11, 7.44, 1.035],
          [x - 0.11, 7.44, 1.035],
        ],
        stone,
      );
    for (let side = 0; side < 4; side++)
      for (let i = 0; i < 8; i++) {
        const a = (i * tau) / 8,
          b = ((i + 1) * tau) / 8;
        triangle(
          transform(out, (side * Math.PI) / 2),
          'plaster',
          [
            [0, 7.88, 1.009],
            [Math.cos(a) * 0.19, 7.88 + Math.sin(a) * 0.19, 1.009],
            [Math.cos(b) * 0.19, 7.88 + Math.sin(b) * 0.19, 1.009],
          ],
          edge,
        );
      }
    const r = (y, rr) => radialRing(y, rr, rr, 4, [0, 0], Math.PI / 4);
    loft(out, 'plaster', [r(8.11, 1.75), r(8.31, 1.42), r(8.47, 0.38)], edge);
    box(out, 'plaster', [-0.13, 8.47, -0.13], [0.13, 8.71, 0.13], edge);
    for (let side = 0; side < 4; side++) {
      const o = transform(out, (side * Math.PI) / 2),
        pts = [
          [-1.19, 8.14, 1.19],
          [-1.29, 8.2, 1.29],
          [-1.37, 8.33, 1.37],
          [-1.43, 8.55, 1.43],
          [-1.42, 8.79, 1.42],
          [-1.31, 8.8, 1.31],
        ];
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1],
          b = pts[i],
          l = Math.hypot(b[0] - a[0], b[2] - a[2]),
          nx = (-(b[2] - a[2]) * 0.0475) / l,
          nz = ((b[0] - a[0]) * 0.0475) / l,
          p = [
            [a[0] + nx, a[1], a[2] + nz],
            [b[0] + nx, b[1], b[2] + nz],
            [b[0] - nx, b[1], b[2] - nz],
            [a[0] - nx, a[1], a[2] - nz],
          ];
        face(o, 'plaster', p, edge);
        face(o, 'plaster', [...p].reverse(), edge);
      }
      for (const sign of [-1, 1]) {
        const p = [
          [sign * 0.3, 8.31, 1.1],
          [sign * 0.58, 8.55, 1.1],
          [sign * 0.85, 8.31, 1.1],
          [sign * 0.58, 8.14, 1.1],
        ];
        face(o, 'plaster', p, edge);
        face(o, 'plaster', [...p].reverse(), edge);
      }
    }
  }
  return { build, distant };
}
function buildNear(out, level) {
  const target = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((method) => [
      method,
      (slot, ref, p, n, uv, color) =>
        out[method](slot, ref, p, n, uv, slot === 'plaster' ? color.map((v) => v * 0.88) : color),
    ]),
  );
  components(level).build(target);
}
export const turtleDistrict = (out) => buildNear(out, 'district');
export const turtleStreet = (out) => buildNear(out, 'street');
export const turtleCloseup = (out) => buildNear(out, 'closeup');
export function turtleSkyline(out) {
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
          color.map((v) => v * 0.65 * (slot === 'plaster' ? 0.88 : 1)),
        ),
    ]),
  );
  components('skyline').distant(target);
}
