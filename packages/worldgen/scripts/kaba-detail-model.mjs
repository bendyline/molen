/** ka_ba_ye_zartosht source-local reviewed exterior and four complete browser derivatives. The original heritage draft is preserved. */
import { normalFor } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';

const stone = [0.79, 0.73, 0.61],
  pale = [0.83, 0.8, 0.72],
  darkStone = [0.34, 0.36, 0.35],
  _ref = 'palette:#ffffff';
function detail(destination, mode) {
  const wallOpenings = [];
  const out = {
    addQuad: (s, ...a) =>
      destination.addQuad(s === 'limestone' || s === 'darkstone' ? 'limestone_raw' : s, ...a),
    addTriangle: (s, ...a) =>
      destination.addTriangle(s === 'limestone' || s === 'darkstone' ? 'limestone_raw' : s, ...a),
    addConvexPolygon: (s, ...a) =>
      destination.addConvexPolygon(
        s === 'limestone' || s === 'darkstone' ? 'limestone_raw' : s,
        ...a,
      ),
  };
  function face(out, slot, points, color) {
    quad(out, slot, points, normalFor(...points), color);
  }
  /** Flat facade with actual recessed panels and reveals. x/y cuts keep the front watertight. */
  function recessedFacade(out, slot, width, y0, y1, depth, holes, color, rotate = 0) {
    const c = Math.cos(rotate),
      s = Math.sin(rotate);
    const p = (x, y, z) => [x * c + z * s, y, -x * s + z * c];
    const panel = (points, tint = color, component = slot) =>
      face(
        out,
        component,
        points.map(([x, y, z]) => p(x, y, z)),
        tint,
      );
    const globalXs = [
      ...new Set([-width / 2, width / 2, ...holes.flatMap((h) => [h.x0, h.x1])]),
    ].sort((a, b) => a - b);
    const ys = [...new Set([y0, y1, ...holes.flatMap((h) => [h.y0, h.y1])])].sort((a, b) => a - b);
    for (let j = 0; j < ys.length - 1; j++) {
      const mid = (ys[j] + ys[j + 1]) / 2;
      const cuts =
        mode === 'master'
          ? globalXs
          : [
              ...new Set([
                -width / 2,
                width / 2,
                ...holes.filter((h) => mid > h.y0 && mid < h.y1).flatMap((h) => [h.x0, h.x1]),
              ]),
            ].sort((a, b) => a - b);
      const xs = cuts;
      for (let i = 0; i < xs.length - 1; i++) {
        const x = (xs[i] + xs[i + 1]) / 2,
          y = (ys[j] + ys[j + 1]) / 2;
        if (x < -width / 2 || x > width / 2 || y < y0 || y > y1) continue;
        if (holes.some((h) => x > h.x0 && x < h.x1 && y > h.y0 && y < h.y1)) continue;
        panel([
          [xs[i], ys[j], depth],
          [xs[i + 1], ys[j], depth],
          [xs[i + 1], ys[j + 1], depth],
          [xs[i], ys[j + 1], depth],
        ]);
      }
    }
    for (const h of holes) {
      const { x0, x1, y0: b, y1: t, inset = 0.04 } = h;
      const z = depth - inset;
      panel(
        [
          [x0, b, z],
          [x1, b, z],
          [x1, t, z],
          [x0, t, z],
        ],
        h.tint ?? color.map((v) => v * 0.84),
        h.component ?? slot,
      );
      panel([
        [x0, b, depth],
        [x0, b, z],
        [x0, t, z],
        [x0, t, depth],
      ]);
      panel([
        [x1, b, z],
        [x1, b, depth],
        [x1, t, depth],
        [x1, t, z],
      ]);
      panel([
        [x0, b, depth],
        [x1, b, depth],
        [x1, b, z],
        [x0, b, z],
      ]);
      panel([
        [x0, t, z],
        [x1, t, z],
        [x1, t, depth],
        [x0, t, depth],
      ]);
    }
  }

  function rotatedBox(out, slot, lo, hi, color, rotation) {
    const c = Math.cos(rotation),
      s = Math.sin(rotation);
    const transform = (points) => points.map(([x, y, z]) => [x * c + z * s, y, -x * s + z * c]);
    box(
      {
        addQuad(_slot, _ref, points, _normal, _uv, tint) {
          face(out, slot, transform(points), tint);
        },
      },
      slot,
      lo,
      hi,
      color,
    );
  }
  function marker(out, slot, lo, hi, color, rotation) {
    const c = Math.cos(rotation),
      s = Math.sin(rotation);
    face(
      out,
      slot,
      [
        [lo[0], lo[1], hi[2]],
        [hi[0], lo[1], hi[2]],
        [hi[0], hi[1], hi[2]],
        [lo[0], hi[1], hi[2]],
      ].map(([x, y, z]) => [x * c + z * s, y, -x * s + z * c]),
      color,
    );
  }

  function roofSlabs(out) {
    const zs = [-3.86, -1.85, 0.1, 2.05, 3.86],
      xs = [-3.86, -2.05, 0, 2.05, 3.86];
    const roofY = (x, z) => 14.12 - (0.25 * Math.max(Math.abs(x), Math.abs(z))) / 3.86;
    const shift = (x, z, i) => [x, z + (i === 3 ? (0.6 * (x + 3.86)) / 7.72 : 0)];
    for (let i = 0; i < 4; i++) {
      const z0 = zs[i],
        z1 = zs[i + 1];
      const cutZ = [z0, ...[-2.05, 0, 2.05].filter((z) => z > z0 && z < z1), z1];
      for (let a = 0; a < xs.length - 1; a++)
        for (let b = 0; b < cutZ.length - 1; b++) {
          const x0 = xs[a],
            x1 = xs[a + 1],
            a0 = cutZ[b],
            a1 = cutZ[b + 1];
          const pts = [
            [x0, a0],
            [x0, a1],
            [x1, a1],
            [x1, a0],
          ].map(([x, z]) => {
            const p = shift(x, z, i);
            return [p[0], roofY(x, z), p[1]];
          });
          face(out, 'limestone', pts, pale);
        }
      // Four separate slab edges; north-west end has the documented60cm displacement.
      for (const [a, b] of [
        [
          [-3.86, z0],
          [-3.86, z1],
        ],
        [
          [-3.86, z1],
          [3.86, z1],
        ],
        [
          [3.86, z1],
          [3.86, z0],
        ],
        [
          [3.86, z0],
          [-3.86, z0],
        ],
      ]) {
        const pa = shift(...a, i),
          pb = shift(...b, i);
        face(
          out,
          'limestone',
          [
            [pa[0], 13.67, pa[1]],
            [pb[0], 13.67, pb[1]],
            [pb[0], roofY(...b), pb[1]],
            [pa[0], roofY(...a), pa[1]],
          ],
          pale,
        );
      }
    }
    // Solid roof backing closes the historic joint; interiors are outside this exterior scope.
    box(out, 'limestone', [-3.64, 13.55, -3.64], [3.64, 13.67, 3.64], [0.39, 0.37, 0.32]);
    if (mode === 'master' || mode === 'closeup')
      for (const z of [-1.85, 0.1, 2.05])
        for (let i = 0; i < 10; i++) {
          const x = -3.4 + i * 0.755,
            _y = roofY(x, z) + 0.004;
          for (const pts of [
            [
              [-0.14, -0.06],
              [-0.14, 0.06],
              [-0.02, 0.027],
              [-0.02, -0.027],
            ],
            [
              [-0.02, -0.027],
              [-0.02, 0.027],
              [0.02, 0.027],
              [0.02, -0.027],
            ],
            [
              [0.02, -0.027],
              [0.02, 0.027],
              [0.14, 0.06],
              [0.14, -0.06],
            ],
          ])
            face(
              out,
              'darkstone',
              pts.map(([dx, dz]) => [x + dx, roofY(x + dx, z + dz) + 0.007, z + dz]),
              [0.29, 0.28, 0.25],
            );
        }
  }
  function survivingStair(out) {
    // Eight measured surviving steps, above the four missing original lower risers.
    for (let i = 0; i < 8; i++) {
      const z = 8.52 - i * 0.27,
        w = (2.12 - (0.085 * i) / 7) / 2,
        y = 1.08 + 0.27 * (i + 1);
      const top = [
        [-w, y, z - 0.27],
        [-w + 0.02, y - 0.012, z],
        [w - 0.015, y - 0.02, z],
        [w, y, z - 0.27],
      ];
      face(out, 'limestone', top, pale);
      for (const [a, b] of [
        [top[1], top[2]],
        [top[0], top[1]],
        [top[2], top[3]],
      ])
        face(out, 'limestone', [[a[0], 0.65, a[2]], [b[0], 0.65, b[2]], b, a], pale);
    }
    // Photograph-supported upper rubble. Shapes are approximate, not invented complete access steps.
    rotatedBox(out, 'limestone', [-0.85, 3.22, 6.2], [0.84, 3.54, 6.78], stone, -0.075);
    rotatedBox(out, 'limestone', [-0.45, 3.52, 6.18], [0.53, 3.77, 6.63], stone, 0.11);
    if (mode === 'master' || mode === 'closeup') {
      for (let i = 0; i < 8; i++) {
        const z = 8.52 - i * 0.27,
          y = 1.08 + 0.27 * (i + 1);
        for (const x of [-0.68, 0.13, 0.66])
          face(
            out,
            'darkstone',
            [
              [x - 0.012, y + 0.003, z - 0.245],
              [x + 0.012, y + 0.003, z - 0.245],
              [x + 0.027, y + 0.003, z - 0.065],
              [x + 0.009, y + 0.003, z - 0.065],
            ],
            [0.38, 0.35, 0.3],
          );
      }
    }
  }
  function originalBlockJoints(out) {
    if (mode !== 'master' && mode !== 'closeup') return;
    const step = 12.02 / 21;
    for (const { holes, rotation, d } of wallOpenings)
      for (let row = 0; row < 21; row++) {
        const y = 1.35 + (row + 1) * step;
        const cuts = [
          ...new Set([
            -3.62,
            3.62,
            ...holes
              .filter((h) => y >= h.y0 - 0.012 && y <= h.y1 + 0.012)
              .flatMap((h) => [h.x0 - 0.012, h.x1 + 0.012]),
          ]),
        ].sort((a, b) => a - b);
        for (let i = 0; i < cuts.length - 1; i++) {
          const x = (cuts[i] + cuts[i + 1]) / 2;
          if (
            holes.some(
              (h) => x > h.x0 - 0.012 && x < h.x1 + 0.012 && y >= h.y0 - 0.012 && y <= h.y1 + 0.012,
            )
          )
            continue;
          rotatedBox(
            out,
            'limestone',
            [cuts[i], y, d + 0.001],
            [cuts[i + 1], y + 0.008, d + 0.003],
            [0.65, 0.6, 0.5],
            rotation,
          );
        }
        for (let c = 0; c < 3; c++) {
          const x = -2.5 + c * 2.15 + (row % 3) * 0.21,
            ys = [
              y - step + 0.015,
              y - 0.012,
              ...holes
                .filter((h) => x > h.x0 - 0.015 && x < h.x1 + 0.015 && h.y0 < y && h.y1 > y - step)
                .flatMap((h) => [
                  Math.max(y - step + 0.015, h.y0 - 0.012),
                  Math.min(y - 0.012, h.y1 + 0.012),
                ]),
            ].sort((a, b) => a - b);
          for (let i = 0; i < ys.length - 1; i++) {
            if (ys[i + 1] - ys[i] < 0.0001) continue;
            const yy = (ys[i] + ys[i + 1]) / 2;
            if (
              holes.some(
                (h) =>
                  x > h.x0 - 0.015 && x < h.x1 + 0.015 && yy > h.y0 - 0.012 && yy < h.y1 + 0.012,
              )
            )
              continue;
            rotatedBox(
              out,
              'limestone',
              [x, ys[i], d + 0.001],
              [x + 0.008, ys[i + 1], d + 0.003],
              [0.65, 0.6, 0.5],
              rotation,
            );
          }
        }
      }
  }
  function buildKaba(out) {
    // Schmidt 1970 pp. 18-28, 35-37. Surviving monument, not restored thirty-step reconstruction.
    box(out, 'limestone', [-7.31, 0, -7.31], [7.31, 0.25, 7.31], pale);
    box(out, 'limestone', [-5.72, 0.25, -5.72], [5.72, 0.53, 5.72], pale);
    box(out, 'limestone', [-4.4, 0.53, -4.4], [4.4, 1.03, 4.4], pale);
    box(out, 'limestone', [-3.54, 1.03, -3.54], [3.54, 1.35, 3.54], pale);
    const base = 1.35,
      top = 13.87,
      w = 7.3,
      d = w / 2;
    for (let side = 0; side < 4; side++) {
      const rotation = (side * Math.PI) / 2;
      const north = side === 0;
      const holes = [];
      const windows = north
        ? [
            { x: 0, y: 10.14, width: 0.56, height: 0.78 },
            { x: 0, y: 12.58, width: 0.56, height: 0.78 },
          ]
        : [-1.61, 1.61].flatMap((x) => [
            { x, y: 7.28, width: 1.02, height: 1.62 },
            { x, y: 10.32, width: 1.42, height: 1.3 },
            { x, y: 12.58, width: 0.56, height: 0.78 },
          ]);
      const excluded = windows.map((v) => ({
        x0: v.x - v.width / 2 - 0.08,
        x1: v.x + v.width / 2 + 0.08,
        y0: v.y - 0.08,
        y1: v.y + v.height + 0.08,
      }));
      if (north) excluded.push({ x0: -1.18, x1: 1.18, y0: 2.9, y1: 10.1 });
      for (let row = 0; row < (north ? 16 : 15); row++) {
        const y = base + (north ? 2.97 : 2.83) + row * 0.58;
        for (let col = 0; mode !== 'skyline' && col < 7; col++) {
          const x = -2.37 + col * 0.75 + (row % 2 ? 0.34 : 0);
          if (x + 0.075 > 2.58) continue;
          const h = { x0: x - 0.075, x1: x + 0.075, y0: y, y1: y + 0.39, inset: 0.04 };
          if (!excluded.some((r) => h.x1 > r.x0 && h.x0 < r.x1 && h.y1 > r.y0 && h.y0 < r.y1)) {
            if (mode === 'district')
              marker(
                out,
                'limestone',
                [h.x0, h.y0, d + 0.002],
                [h.x1, h.y1, d + 0.003],
                [0.65, 0.61, 0.53],
                rotation,
              );
            else holes.push(h);
          }
        }
      }
      for (const v of windows) {
        holes.push({
          x0: v.x - v.width / 2,
          x1: v.x + v.width / 2,
          y0: v.y,
          y1: v.y + v.height,
          inset: mode === 'skyline' ? 0.025 : 0.18,
          tint: darkStone,
          component: 'darkstone',
        });
        // Two-step dark limestone frames, photographed/measured in Fig. 11.
        const b = Math.min(0.18, v.width * 0.18);
        if (mode !== 'skyline')
          for (const [lo, hi] of [
            [
              [v.x - v.width / 2, v.y, d - 0.09],
              [v.x - v.width / 2 + b, v.y + v.height, d + 0.008],
            ],
            [
              [v.x + v.width / 2 - b, v.y, d - 0.09],
              [v.x + v.width / 2, v.y + v.height, d + 0.008],
            ],
            [
              [v.x - v.width / 2 + b, v.y + v.height - b, d - 0.09],
              [v.x + v.width / 2 - b, v.y + v.height, d + 0.008],
            ],
            [
              [v.x - v.width / 2 + b, v.y, d - 0.09],
              [v.x + v.width / 2 - b, v.y + b, d + 0.008],
            ],
          ])
            rotatedBox(out, 'darkstone', lo, hi, darkStone, rotation);
      }
      if (north) {
        holes.push({
          x0: -0.855,
          x1: 0.855,
          y0: base + 6.35,
          y1: base + 8.26,
          inset: 1.85,
          tint: [0.19, 0.18, 0.16],
        });
        // Surviving broken scar below elevated doorway: recessed masonry, no fabricated complete staircase.
        // Fig.13A: jagged missing masonry below the door, with a closed rough backing.
        for (const [a, b, x0, x1, inset] of [
          [3.15, 3.8, -0.88, 0.88, 0.16],
          [3.8, 4.35, -0.82, 1.02, 0.35],
          [4.35, 4.92, -1.0, 1.02, 0.21],
          [4.92, 5.48, -0.92, 0.56, 0.42],
          [5.48, 6.03, -0.65, 0.82, 0.22],
          [6.03, 6.57, -1.03, 0.68, 0.35],
          [6.57, 7.12, -0.92, 0.98, 0.19],
          [7.12, 7.69, -0.68, 1.08, 0.3],
        ])
          holes.push({ x0, x1, y0: a, y1: b, inset, tint: [0.67, 0.62, 0.52] });
      }
      wallOpenings.push({ holes, rotation, d });
      recessedFacade(out, 'limestone', w, base, top - 0.5, d, holes, pale, rotation);
      for (const sign of [-1, 1])
        rotatedBox(
          out,
          'limestone',
          [sign < 0 ? -d : d - 1.06, base, d],
          [sign < 0 ? -d + 1.06 : d, top - 0.5, d + 0.19],
          pale,
          rotation,
        );
      rotatedBox(out, 'limestone', [-d, top - 0.5, d - 0.16], [d, top, d + 0.2], pale, rotation);
      for (let i = 0; i < 17; i++) {
        const x = -2.49 + i * 0.3;
        if (mode === 'skyline')
          marker(
            out,
            'limestone',
            [x, top - 0.5, d + 0.2],
            [x + 0.15, top - 0.23, d + 0.21],
            pale,
            rotation,
          );
        else
          rotatedBox(
            out,
            'limestone',
            [x, top - 0.5, d + 0.2],
            [x + 0.15, top - 0.23, d + 0.325],
            pale,
            rotation,
          );
      }
    }
    roofSlabs(out);
    survivingStair(out);
    // Door lintel: architrave, fillet, ovolo and upturned outer ends.
    box(out, 'limestone', [-1.12, 9.61, 3.63], [1.12, 9.79, 3.72], pale);
    box(out, 'limestone', [-1.19, 9.79, 3.61], [1.19, 9.87, 3.77], pale);
    box(out, 'limestone', [-1.22, 9.87, 3.61], [1.22, 10.02, 3.78], pale);
    for (const s of [-1, 1])
      box(
        out,
        'limestone',
        [s < 0 ? -1.22 : 1.08, 10.02, 3.61],
        [s < 0 ? -1.08 : 1.22, 10.14, 3.78],
        pale,
      );
  }

  buildKaba(out);
  originalBlockJoints(out);
}
export function buildKabaReviewed(o) {
  detail(o, 'master');
}
export function buildKabaCloseup(o) {
  detail(o, 'closeup');
}
export function buildKabaStreet(o) {
  detail(o, 'street');
}
export function buildKabaDistrict(o) {
  detail(o, 'district');
}
const surfaceMeans = {
  limestone_raw: [0.886354, 0.886354, 0.886354],
  darkstone: [0.540547, 0.565118, 0.537968],
};
export function buildKabaSkyline(destination) {
  detail(
    {
      addQuad: (s, _r, p, n, u, c) =>
        destination.addQuad(
          'body',
          'palette:#ffffff',
          p,
          n,
          u,
          c.map((v, i) => v * (surfaceMeans[s]?.[i] ?? 1)),
        ),
      addTriangle: (s, _r, p, n, u, c) =>
        destination.addTriangle(
          'body',
          'palette:#ffffff',
          p,
          n,
          u,
          c.map((v, i) => v * (surfaceMeans[s]?.[i] ?? 1)),
        ),
      addConvexPolygon: (s, _r, p, n, u, c) =>
        destination.addConvexPolygon(
          'body',
          'palette:#ffffff',
          p,
          n,
          u,
          c.map((v, i) => v * (surfaceMeans[s]?.[i] ?? 1)),
        ),
    },
    'skyline',
  );
}
