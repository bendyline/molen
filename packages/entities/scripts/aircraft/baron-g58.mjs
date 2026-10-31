/** 2016 Baron G58, TH-2453 onward equipment. Main axle origin; +Z nose, +X pilot left.
 * Manufacturer three-view and panel diagram, with exterior/cabin photographic checks.
 */
import { aircraftPanelTools as panelTools } from '../vehicle-interiors.mjs';
import { addG1000Bezels, addG1000Readouts } from './g1000-panel.mjs';
import { instrumentGeometry } from './instrument-geometry.mjs';
import {
  beveledBox,
  cleanGeometry,
  detailKit,
  ellipsoid,
  group,
  loft,
  mat,
  outline,
  quad,
  sheet,
  T,
  wing,
} from './mesh-kit.mjs';

export const baronFrame = () => ({
  heli: false,
  fighter: false,
  large: false,
  radius: 0.625,
  cy: 1.3,
  ry: 0.76,
  cabinZ: 0.35,
  cabinWidth: 1.07,
  eye: [0.28, 1.88, 0.35],
  panelZ: 1.12,
  floor: 0.75,
});
export function buildBaron(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('Baron-ivory', '#e6e6df', { side: T.DoubleSide }),
    accent = mat('Baron-navy', '#234367', { side: T.DoubleSide }),
    metal = mat('Baron-alloy', '#a7afaf', { metalness: 0.7 }),
    dark = mat('Baron-trim', '#262c31'),
    rubber = mat('Baron-tires', '#202728'),
    glass = mat('Baron-glazing', '#b2cbd0', {
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.15,
    });
  const d = detailKit(root, 'Baron-shell'),
    bindings = [],
    flaps = [],
    ailerons = [];
  // Stations follow the side-view roof/belly and independent plan-view half widths:
  // [z, half width, belly, crown, belt, dome squareness, lower roundness]. Full lower sides rise
  // to the belt (widest); above it the cabin is a superellipse dome (D55 front view) with the
  // side windows cut into that curved skin, not into a flat slab. The tail cone rounds off
  // below the belt; the cabin keeps a flat floor.
  const stations = [
    [3.25, 0.025, 1.19, 1.27],
    [2.6, 0.4, 0.87, 1.58],

    // Windscreen base; the dome stays full to the header, over the panel and glareshield.
    [1.42, 0.58, 0.59, 1.72, 1.3, 4, 0.3],
    [0.6, 0.625, 0.59, 2.14, 1.46, 2.6, 0],
    [-0.08, 0.625, 0.59, 2.12, 1.44, 2.3, 0],
    [-0.78, 0.61, 0.59, 2.02, 1.42, 2.3, 0],
    [-1.38, 0.57, 0.59, 1.91, 1.39, 2.3, 0],
    [-2.03, 0.52, 0.6, 1.8, 1.37, 2.3, 0],
    [-2.75, 0.43, 0.65, 1.73, 1.3, 2.2, 0.4],
    [-3.75, 0.3, 0.76, 1.59],
    [-4.75, 0.15, 0.94, 1.4],
    // The tail cone ends under the rudder; only the rudder reaches the overall length.
    [-5.3, 0.03, 1.18, 1.3],
  ];
  // Right-side points from the crown (0): 1-5 dome at 15-75 degrees, 6 belt, 7-10 lower side,
  // 11 keel; the left side mirrors them at index 22 - k.
  const N = 22;
  const section = ([, w, b, t, belt = b + (t - b) * 0.5, n = 2.4, round = 0.8]) => {
    const dome = [1, 2, 3, 4, 5].map((k) => {
      const a = (k * Math.PI) / 12;
      return [w * Math.pow(Math.sin(a), 2 / n), belt + (t - belt) * Math.pow(Math.cos(a), 2 / n)];
    });
    const lower = [
      [w, b + (belt - b) * 0.42],
      [w * 0.985, b + (belt - b) * 0.15],
      [w * 0.82, b + (belt - b) * 0.03],
      [w * 0.45, b - 0.012],
    ].map(([x, y], k) => {
      const a = ((k + 1) * Math.PI) / 10;
      return [
        x + (w * Math.pow(Math.cos(a), 0.8) - x) * round,
        y + (belt - (belt - b + 0.025) * Math.pow(Math.sin(a), 0.8) - y) * round,
      ];
    });
    const right = [...dome, [w, belt], ...lower];
    return [[0, t], ...right, [0, b - 0.025], ...right.reverse().map(([x, y]) => [-x, y])];
  };
  const rings = stations.map((s) => ({ z: s[0], points: section(s) }));
  const p = (i, j) => [...rings[i].points[j], rings[i].z];
  // Windscreen: crown to the 45-degree dome point, cowl ring to cabin header. The side band
  // (right-side columns k = point k to k + 1, mirrored left) is rebuilt around the windows.
  const screen = [19, 20, 21, 0, 1, 2],
    bandTop = (i) => (i === 2 ? 3 : 2),
    inBand = (i, k) => i >= 2 && i <= 6 && k >= bandTop(i) && k <= 6;
  loft(d, rings, paint, {
    skip: (i, j) =>
      i < 2 || (i === 2 && screen.includes(j)) || inBand(i, j) || inBand(i, N - 1 - j),
  });
  // The baggage nose is a rounded bullet: each section blends from the cabin's dome section
  // (exactly matching the cabin ring at the windshield) towards an ellipse.
  const noseRings = [
    [3.25, 0.025, 1.19, 1.27, 1],
    [3.18, 0.17, 1.12, 1.39, 1],
    [2.95, 0.31, 0.96, 1.49, 0.9],
    [2.6, 0.4, 0.87, 1.58, 0.72],
    [2.1, 0.51, 0.71, 1.65, 0.42],
    [1.42, 0.58, 0.59, 1.72, 0],
  ].map(([z, w, b, t, k]) => {
    const c = (t + b) / 2,
      h = (t - b) / 2;
    return {
      z,
      points: section([z, w, b, t, b + (t - b) * (0.71 / 1.13), 4, 0.3]).map(([x, y]) => {
        const a = Math.atan2((y - c) / h, x / w);
        return [x * (1 - k) + w * Math.cos(a) * k, y * (1 - k) + (c + h * Math.sin(a)) * k];
      }),
    };
  });
  loft(d, noseRings, paint, { caps: false });
  sheet(
    d,
    noseRings[0].points.map((q) => [...q, noseRings[0].z]),
    paint,
    [0, 0, 1],
  );
  // Starboard/port skin half-width of the nose at a station and height (for surface details).
  const noseX = (z, y) => {
    const i = Math.max(0, noseRings.findIndex((r, n) => n > 0 && z >= r.z) - 1),
      a = noseRings[i],
      b = noseRings[i + 1],
      f = (a.z - z) / (a.z - b.z),
      ring = a.points.map((q, j) => [
        q[0] * (1 - f) + b.points[j][0] * f,
        q[1] * (1 - f) + b.points[j][1] * f,
      ]);
    for (let j = 0; j <= 10; j++) {
      const [x0, y0] = ring[j],
        [x1, y1] = ring[j + 1];
      if ((y - y0) * (y - y1) <= 0 && y0 !== y1) return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
    }
    return a.points[6][0];
  };
  for (const j of screen)
    quad(d, p(2, j), p(3, j), p(3, (j + 1) % N), p(2, (j + 1) % N), glass, [0, 1, 1]);
  outline(
    d,
    [p(2, 19), ...[...screen, 3].map((j) => p(3, j)), ...[3, 2, 1, 0, 21, 20].map((j) => p(2, j))],
    0.013,
    paint,
  );
  // Skin at a station: rings interpolated in z, so windows, doors and trim follow the dome.
  const ringAt = (z) => {
    let i = rings.findIndex((r, n) => n < rings.length - 1 && z <= r.z && z >= rings[n + 1].z);
    if (i < 0) i = z > rings[0].z ? 0 : rings.length - 2;
    const a = rings[i].points,
      b = rings[i + 1].points,
      u = (z - rings[i].z) / (rings[i + 1].z - rings[i].z);
    return a.map((q, j) => [q[0] + (b[j][0] - q[0]) * u, q[1] + (b[j][1] - q[1]) * u]);
  };
  // Profile parameter v of height y: k plus the fraction from right-side point k to k + 1.
  const toV = (z, y) => {
    const q = ringAt(z);
    for (let k = 0; k <= 10; k++)
      if (y <= q[k][1] && y >= q[k + 1][1]) return k + (y - q[k][1]) / (q[k + 1][1] - q[k][1] || 1);
    return y > q[0][1] ? 0 : 11;
  };
  const onBand = (side, z, v) => {
    const q = ringAt(z),
      k = Math.min(10, Math.floor(v)),
      f = v - k;
    return [
      side * (q[k][0] + (q[k + 1][0] - q[k][0]) * f),
      q[k][1] + (q[k + 1][1] - q[k][1]) * f,
      z,
    ];
  };
  const halfWidth = (z, y) => onBand(1, z, toV(z, y))[0];
  // Side band around convex (z, v) window apertures, by vertical decomposition: between
  // consecutive breakpoints every column leaves trapezoids bounded by column lines or window
  // edges, so the skin keeps the dome's facets right up to each window frame.
  const band = (side, windows) => {
    const edges = windows.flatMap((w) => w.map((a, n) => [a, w[(n + 1) % w.length]]));
    for (let i = 2; i <= 6; i++)
      for (let k = bandTop(i); k <= 6; k++) {
        const z0 = rings[i + 1].z,
          z1 = rings[i].z,
          cuts = [z0, z1];
        for (const [[sa, va], [sb, vb]] of edges) {
          if (sa > z0 && sa < z1) cuts.push(sa);
          for (const level of [k, k + 1])
            if ((va - level) * (vb - level) < 0) {
              const s = sa + ((sb - sa) * (level - va)) / (vb - va);
              if (s > z0 && s < z1) cuts.push(s);
            }
        }
        cuts.sort((a, b) => a - b);
        for (let c = 0; c < cuts.length - 1; c++) {
          const sa = cuts[c],
            sb = cuts[c + 1],
            sm = (sa + sb) / 2;
          if (sb - sa < 1e-6) continue;
          const spans = [];
          for (const w of windows) {
            const lines = w
              .map((a, n) => [a, w[(n + 1) % w.length]])
              .filter(([[s0], [s1]]) => (s0 - sm) * (s1 - sm) < 0)
              .map(
                ([[s0, v0], [s1, v1]]) =>
                  (s) =>
                    v0 + ((v1 - v0) * (s - s0)) / (s1 - s0),
              );
            if (lines.length !== 2) continue;
            const [f, g] = lines[0](sm) < lines[1](sm) ? lines : [lines[1], lines[0]];
            if (g(sm) > k && f(sm) < k + 1) spans.push([f, g]);
          }
          spans.sort((a, b) => a[0](sm) - b[0](sm));
          const clamp = (fn) => (s) => Math.min(k + 1, Math.max(k, fn(s)));
          let low = () => k;
          for (const [f, g] of [...spans, [() => k + 1, () => k + 1]]) {
            if (f(sm) > low(sm) + 1e-9) {
              const lo = clamp(low),
                hi = clamp(f);
              quad(
                d,
                onBand(side, sa, lo(sa)),
                onBand(side, sb, lo(sb)),
                onBand(side, sb, hi(sb)),
                onBand(side, sa, hi(sa)),
                paint,
                [side, 0, 0],
              );
            }
            if (g(sm) > low(sm)) low = g;
          }
        }
      }
  };
  // A (z, v) aperture on the skin, split where it crosses columns and stations.
  const aperture = (side, w) =>
    w.flatMap(([s0, v0], n) => {
      const [s1, v1] = w[(n + 1) % w.length],
        ts = [0];
      for (let k = 1; k <= 10; k++) if ((v0 - k) * (v1 - k) < 0) ts.push((k - v0) / (v1 - v0));
      for (const r of rings) if ((s0 - r.z) * (s1 - r.z) < 0) ts.push((r.z - s0) / (s1 - s0));
      return ts
        .sort((a, b) => a - b)
        .map((t) => onBand(side, s0 + (s1 - s0) * t, v0 + (v1 - v0) * t));
    });
  // A side-view (z, y) path laid on the skin, subdivided so it follows the curvature.
  const onSkin = (side, path, closed = true, lift = 0.003) => {
    const out = [];
    for (let i = 0; i < path.length - (closed ? 0 : 1); i++) {
      const [za, ya] = path[i],
        [zb, yb] = path[(i + 1) % path.length],
        steps = Math.max(1, Math.ceil(Math.max(Math.abs(yb - ya) / 0.06, Math.abs(zb - za) / 0.3)));
      for (let k = 0; k < steps; k++) {
        const z = za + ((zb - za) * k) / steps,
          y = ya + ((yb - ya) * k) / steps;
        out.push([side * (halfWidth(z, y) + lift), y, z]);
      }
    }
    if (!closed) {
      const [z, y] = path.at(-1);
      out.push([side * (halfWidth(z, y) + lift), y, z]);
    }
    return out;
  };
  // Side-view (z, y) window layout: the pilot window, then three cabin windows whose bays span
  // u along the station pair and v down from 0.14 m under the crown towards 0.15 m over the
  // belly, each with a level sill.
  const windows = [
    [
      [1.02, 1.56],
      [0.57, 1.98],
      [0.48, 2.0],
      [0.02, 1.98],
      [0.0, 1.92],
      [0.0, 1.55],
      [0.06, 1.52],
      [0.95, 1.52],
    ],
  ];
  for (let i = 4; i <= 6; i++) {
    const [za, , ba, ta] = stations[i],
      [zb, , bb, tb] = stations[i + 1],
      bottom = 1.48 - (i - 4) * 0.03;
    windows.push(
      [
        [0.08, 0.06],
        [0.15, 0.025],
        [0.85, 0.025],
        [0.93, 0.075],
        [0.93, bottom + 0.035],
        [0.87, bottom],
        [0.13, bottom],
        [0.07, bottom + 0.035],
      ].map(([u, v], n) => {
        const top = ta - 0.14 + (tb - ta) * u;
        return [za + (zb - za) * u, n < 4 ? top + (ba + 0.15 + (bb - ba) * u - top) * v : v];
      }),
    );
  }
  const apertures = windows.map((w) => w.map(([z, y]) => [z, toV(z, y)]));
  for (const side of [-1, 1]) {
    const pilotPoint = (z, y) => [side * halfWidth(z, y), y, z];
    band(side, apertures);
    for (const w of apertures) {
      const hole = aperture(side, w);
      sheet(d, hole, glass, [side, 0, 0]);
      outline(d, hole, 0.006, dark);
    }
    if (side > 0) {
      const weather = [
        [0.97, 1.55],
        [0.97, 1.68],
        [0.74, 1.68],
        [0.74, 1.55],
      ].map(([z, y]) => pilotPoint(z, y));
      outline(d, weather, 0.003, metal);
      d.rod(weather[2], weather[3], 0.004, metal);
    }
    // Two longitudinal bands and skin joints, using the local shell width at every station.
    for (let i = 2; i < stations.length - 3; i++) {
      const a = stations[i],
        b = stations[i + 1];
      for (const [offset, h] of [
        [0.28, 0.09],
        [0.43, 0.024],
      ])
        quad(
          d,
          ...[
            [a[0], a[2] + offset],
            [b[0], b[2] + offset],
            [b[0], b[2] + offset + h],
            [a[0], a[2] + offset + h],
          ].map(([z, yy]) => [side * (halfWidth(z, yy) + 0.002), yy, z]),
          accent,
          [side, 0, 0],
        );
      for (let t = 0; t < 1; t += 0.13 / Math.abs(b[0] - a[0])) {
        const z = a[0] + (b[0] - a[0]) * t,
          yy = a[2] + (b[2] - a[2]) * t + 0.22;
        d.add(new T.SphereGeometry(0.0025, 5, 3), metal, [
          side * (halfWidth(z, yy) + 0.003),
          yy,
          z,
        ]);
      }
    }
    for (const r of [noseRings[3], ...[2, 7, 8, 9, 10].map((i) => rings[i])])
      outline(
        d,
        r.points.map((q) => [...q, r.z]),
        0.0016,
        metal,
      );
    if (side < 0) {
      outline(
        d,
        onSkin(-1, [
          [0.57, 1.99],
          [-0.08, 1.98],
          [-0.08, 0.71],
          [1.15, 0.7],
        ]),
        0.003,
        metal,
      );
      d.box([0.02, 0.025, 0.13], [-halfWidth(0.02, 1.27) - 0.007, 1.27, 0.02], metal);
      outline(
        d,
        onSkin(-1, [
          [-0.78, 1.88],
          [-2.03, 1.66],
          [-2.03, 0.7],
          [-0.78, 0.69],
        ]),
        0.003,
        metal,
      );
      outline(
        d,
        onSkin(
          -1,
          [
            [-1.38, 1.76],
            [-1.38, 0.68],
          ],
          false,
        ),
        0.003,
        metal,
        false,
      );
      for (const z of [-1.24, -1.51])
        d.box([0.02, 0.04, 0.08], [-halfWidth(z, 1.25) - 0.007, 1.25, z], metal);
      d.box([0.24, 0.009, 0.8], [-0.76, 0.91, -0.31], dark);
      d.rod([-0.54, 0.62, -1.46], [-0.8, 0.31, -1.48], 0.015, metal);
      d.box([0.25, 0.025, 0.12], [-0.88, 0.31, -1.48], dark);
    }
    const y = (x) => 0.9 + Math.abs(x) * Math.tan(Math.PI / 30),
      chord = (x) => 2.27 - (1.32 * Math.abs(x)) / 5.74,
      le = (x) => 0.83 - (2.27 - chord(x)) * 0.25,
      te = (x) => le(x) - chord(x),
      hinge = (x) => te(x) + chord(x) * 0.23;
    wing(
      d,
      [
        [side * 0.52, y(0.52), le(0.52), hinge(0.52), 0.12],
        [side * 3.08, y(3.08), le(3.08), hinge(3.08), 0.09],
        [side * 5.51, y(5.51), le(5.51), hinge(5.51), 0.058],
        [side * 5.74, y(5.74), le(5.74) - 0.035, te(5.74) + 0.05, 0.035],
      ],
      paint,
    );
    // Fixed trailing-edge bay behind the nacelle, between the split flap panels.
    wing(
      d,
      [
        [side * 1.37, y(1.37), hinge(1.37), te(1.37), 0.018],
        [side * 2.12, y(2.12), hinge(2.12), te(2.12), 0.016],
      ],
      paint,
    );
    for (const [kind, begin, end] of [
      ['flap', 0.58, 1.37],
      ['flap', 2.12, 3.08],
      ['aileron', 3.11, 5.52],
    ]) {
      const g = group(root, `Baron-${kind}-${side}-${Math.round(begin * 100)}`, [
          side * begin,
          y(begin),
          hinge(begin),
        ]),
        dd = detailKit(g, g.name);
      wing(
        dd,
        [
          [0, 0, 0, te(begin) - hinge(begin), 0.018],
          [
            side * (end - begin),
            y(end) - y(begin),
            hinge(end) - hinge(begin),
            te(end) - hinge(begin),
            0.013,
          ],
        ],
        paint,
      );
      for (let x = begin + 0.07; x < end; x += 0.11)
        dd.rod(
          [side * (x - begin), y(x) - y(begin) + 0.015, hinge(x) - hinge(begin) - 0.015],
          [side * (x - begin), y(x) - y(begin) + 0.008, te(x) - hinge(begin) + 0.02],
          0.0018,
          metal,
        );
      dd.finish();
      (kind === 'flap' ? flaps : ailerons).push({
        node: g.name,
        axis: 'x',
        multiplier: kind === 'flap' ? -Math.PI / 6 : -side * 0.28,
      });
    }
    for (let x = 0.8; x < 5.53; x += 0.35) {
      const h = 0.12 - (x - 0.52) * 0.014,
        upper = (u) =>
          u < 0.25
            ? (h * u) / 0.25
            : u < 0.75
              ? h * (1 - (u - 0.25) * 0.96)
              : (h * 0.52 * (1 - u)) / 0.25;
      const line = [0.05, 0.25, 0.5, 0.75, 0.96].map((u) => [
        side * x,
        y(x) + upper(u) + 0.002,
        le(x) - u * (le(x) - hinge(x)),
      ]);
      outline(d, line, 0.0014, metal, false);
      for (let u = 0.1; u < 0.96; u += 0.11)
        d.add(new T.SphereGeometry(0.0023, 5, 3), metal, [
          side * x,
          y(x) + upper(u) + 0.003,
          le(x) - u * (le(x) - hinge(x)),
        ]);
    }
    // Separate tip light, leading-edge lamp, filler and small vortex-generator plates.
    ellipsoid(
      d,
      [side * 5.7404, y(5.74), 0.32],
      [0.025, 0.026, 0.052],
      side > 0 ? d.red : d.green,
      10,
    );
    d.box([0.18, 0.055, 0.015], [side * 3.93, y(3.93), le(3.93) + 0.012], dark);
    for (const dx of [-0.045, 0.045])
      d.add(new T.CircleGeometry(0.022, 12), d.ivory, [
        side * 3.93 + dx,
        y(3.93),
        le(3.93) + 0.021,
      ]);
    d.add(new T.CylinderGeometry(0.045, 0.045, 0.01, 16), metal, [
      side * 1.17,
      y(1.17) + 0.105,
      0.31,
    ]);
    for (let x = 3.2; x < 5.4; x += 0.24)
      d.box([0.006, 0.025, 0.037], [side * x, y(x) + 0.06, le(x) - 0.1], paint);
    const leTail = (x) => -3.82 - Math.abs(x) * 0.11,
      teTail = (x) => -5.08 + Math.abs(x) * 0.06;
    wing(
      d,
      [
        [0, 1.27, leTail(0), -4.34, 0.06],
        [side * 2.26, 1.27, leTail(2.26), -4.34, 0.036],
        [side * 2.4257, 1.27, leTail(2.4257) - 0.06, teTail(2.4257) + 0.08, 0.02],
      ],
      paint,
    );
    const eg = group(root, `Baron-elevator-${side}`, [0, 1.27, -4.35]),
      ed = detailKit(eg, eg.name);
    wing(
      ed,
      [
        [side * 0.12, 0, 0, teTail(0.12) + 4.35, 0.018],
        [side * 2.26, 0, 0, teTail(2.26) + 4.35, 0.012],
      ],
      paint,
    );
    ed.rod([side * 0.2, 0.016, -0.31], [side * 0.85, 0.016, -0.28], 0.0025, metal);
    ed.finish();
    bindings.push({
      node: eg.name,
      source: 'elevator',
      property: 'rotation',
      axis: 'x',
      scale: 0.35,
    });
  }
  const fin = [
    [-2.45, 1.7],
    [-3.65, 1.68],
    [-4.03, 1.82],
    [-5.04, 2.94],
    [-5.12, 2.94],
    [-5.58, 2.9],
    [-5.05, 1.26],
  ];
  for (const side of [-1, 1])
    sheet(
      d,
      fin.map(([z, y]) => [side * 0.034, y, z]),
      paint,
      [side, 0, 0],
    );
  for (let i = 0; i < fin.length; i++) {
    const a = fin[i],
      b = fin[(i + 1) % fin.length];
    quad(
      d,
      [-0.034, a[1], a[0]],
      [-0.034, b[1], b[0]],
      [0.034, b[1], b[0]],
      [0.034, a[1], a[0]],
      paint,
      [0, 1, 0],
    );
  }
  const rg = group(root, 'Baron-rudder', [0, 1.26, -5.05]),
    rd = detailKit(rg, rg.name);
  for (const side of [-1, 1]) {
    sheet(
      rd,
      [
        [side * 0.035, 0, 0],
        [side * 0.035, 1.64, -0.53],
        [side * 0.035, 1.62, -0.79],
        [side * 0.035, 0.15, -0.5],
      ],
      accent,
      [side, 0, 0],
    );
    rd.rod([side * 0.038, 0.15, -0.22], [side * 0.038, 0.43, -0.28], 0.003, metal);
    for (let t = 0.05; t < 1; t += 0.055)
      rd.add(new T.SphereGeometry(0.0025, 5, 3), metal, [side * 0.038, t * 1.24, -0.32 * t - 0.02]);
  }
  rd.finish();
  bindings.push({
    node: rg.name,
    source: 'yawInput',
    property: 'rotation',
    axis: 'y',
    scale: 0.35,
  });
  d.add(new T.CylinderGeometry(0.025, 0.025, 0.036, 12), d.red, [0, 2.9538, -5.1]);
  d.rod([0, 2.11, -0.4], [0, 2.4, -0.64], 0.008, paint);
  d.rod([0, 1.91, -1.5], [0, 2.09, -1.65], 0.006, paint);
  const enginePoints = [],
    rotors = [];
  for (const [index, side] of [
    [1, 1],
    [2, -1],
  ]) {
    const x = side * 1.85,
      y = 1.35,
      z = 1.88;
    const nacelle = group(root, `Baron-nacelle-${index}`, [x, y, 0]),
      nd = detailKit(nacelle, nacelle.name);
    const sections = [
      [1.86, 0.38, -0.24, 0.26],
      [1.65, 0.45, -0.29, 0.31],
      [0.65, 0.455, -0.38, 0.3],
      [0, 0.41, -0.4, 0.25],
      [-0.35, 0.27, -0.22, 0.12],
      [-0.72, 0.06, -0.06, 0.04],
    ];
    // Rounded cowl sections: a domed top over a flatter belly that carries the gear doors.
    const nr = sections.map(([zz, w, b, t]) => ({
      z: zz,
      points: Array.from({ length: 16 }, (_, k) => {
        const a = (k * Math.PI) / 8,
          c = Math.cos(a),
          e = c > 0 ? 2 / 2.6 : 0.5;
        return [
          w * Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), e),
          (t + b) / 2 + ((t - b) / 2) * Math.sign(c) * Math.pow(Math.abs(c), e),
        ];
      }),
    }));
    loft(nd, nr, paint);
    for (const zz of [1.66, 0.65, 0]) {
      const ring = nr.find((r) => r.z === zz) || nr[1];
      outline(
        nd,
        ring.points.map((p) => [...p, ring.z]),
        0.002,
        metal,
      );
    }
    for (const sign of [-1, 1]) {
      ellipsoid(nd, [sign * 0.22, 0.08, 1.869], [0.13, 0.075, 0.012], dark, 16);
      nd.rod([sign * 0.3, -0.32, 0.6], [sign * 0.32, -0.48, 0.37], 0.023, metal);
      nd.box([0.19, 0.014, 0.27], [sign * 0.22, -0.35, 0.38], paint);
      for (let zz = 0.72; zz < 1.65; zz += 0.12)
        nd.add(new T.SphereGeometry(0.0028, 5, 3), metal, [sign * 0.457, 0.05, zz]);
    }
    ellipsoid(nd, [0, -0.18, 1.87], [0.095, 0.045, 0.012], dark, 16);
    nd.add(new T.CircleGeometry(0.07, 16), d.ivory, [0, -0.24, 0.45]);
    nd.finish();
    const eg = group(root, `engine-${index}`, [x, y, z]),
      prop = group(eg, `Baron-propeller-${index}`),
      pd = detailKit(prop, prop.name);
    // Bullet spinner: full-bodied ogive to a short point (G58 nacelle close-ups), not a cone.
    const spinner = Array.from({ length: 9 }, (_, i) => {
      const u = i / 8;
      return new T.Vector2(0.185 * Math.pow(1 - Math.pow(u, 1.8), 0.62), 0.42 * u);
    });
    pd.add(new T.LatheGeometry(spinner, 24).rotateX(Math.PI / 2), metal);
    for (let i = 0; i < 3; i++) {
      const g = group(prop, `Baron-prop-${index}-blade-${i}`);
      g.rotation.z = (i * 2 * Math.PI) / 3 - Math.PI / 2;
      const dd = detailKit(g, g.name),
        pts = [
          [0.12, -0.04, 0],
          [0.35, -0.075, 0.01],
          [0.86, -0.055, 0],
          [0.965, -0.025, -0.01],
          [0.9779, 0, -0.01],
          [0.965, 0.03, -0.01],
          [0.62, 0.07, 0.005],
          [0.13, 0.04, 0],
        ];
      sheet(dd, pts, dark, [0, 0, 1]);
      sheet(
        dd,
        pts.map((p) => [p[0], p[1], p[2] - 0.014]),
        dark,
        [0, 0, -1],
      );
      dd.box([0.036, 0.05, 0.016], [0.942, 0.003, -0.009], paint);
      dd.finish();
    }
    pd.finish();
    enginePoints.push({ id: eg.name, position: [x, y, z] });
    rotors.push({ node: prop.name, axis: 'z', multiplier: 1, engine: eg.name });
  }
  // Radar radome, nose baggage hatch and windscreen defrost seams.
  outline(
    d,
    [
      [1.53, 2.57],
      [1.51, 2.28],
      [1.12, 2.28],
      [1.13, 2.57],
    ].map(([y, z]) => [noseX(z, y) + 0.01, y, z]),
    0.003,
    metal,
  );
  d.box([0.015, 0.035, 0.08], [noseX(2.32, 1.34) + 0.008, 1.34, 2.32], dark);
  // Actual main struts retract inboard; nose leg retracts aft. Doors stay attached to their legs.
  for (const [index, x, z, top, r] of [
    [0, 0, 2.46, 0.8, 0.205],
    [1, 1.4605, 0, 0.91, 0.24],
    [2, -1.4605, 0, 0.91, 0.24],
  ]) {
    const g = group(root, `Baron-gear-${index}`, [x, top, z]),
      dd = detailKit(g, g.name),
      h = top - r;
    dd.rod([0, 0, 0], [0, -h, 0], 0.03, metal);
    dd.rod([0, -0.18, -0.08], [0, -h + 0.1, 0], 0.018, dark);
    dd.add(new T.CylinderGeometry(r, r, 0.13, 24).rotateZ(Math.PI / 2), rubber, [0, -h, 0]);
    for (const side of [-1, 1])
      dd.add(new T.CircleGeometry(r * 0.54, 16).rotateY((side * Math.PI) / 2), metal, [
        side * 0.068,
        -h,
        0,
      ]);
    if (x) {
      dd.rod([-0.18 * Math.sign(x), 0, -0.28], [0, -h + 0.12, 0], 0.017, metal);
      sheet(
        dd,
        [
          [Math.sign(x) * 0.095, -0.03, 0.25],
          [Math.sign(x) * 0.095, -0.03, -0.3],
          [Math.sign(x) * 0.095, -h + 0.07, -0.22],
          [Math.sign(x) * 0.095, -h + 0.07, 0.12],
        ],
        paint,
        [Math.sign(x), 0, 0],
      );
    } else {
      for (const side of [-1, 1])
        dd.rod([side * 0.08, -h + 0.15, -0.06], [side * 0.08, -h, 0], 0.016, metal);
      dd.box([0.19, 0.35, 0.018], [0, -0.22, -0.09], paint);
    }
    dd.finish();
    const angle = x ? (-Math.sign(x) * Math.PI) / 2 : Math.PI / 2;
    bindings.push({
      node: g.name,
      source: 'gear',
      property: 'rotation',
      axis: x ? 'z' : 'x',
      offset: angle,
      scale: -angle,
    });
  }
  d.finish();
  const interior = cockpit(root, { paint, accent, metal, dark });
  cleanGeometry(root);
  return {
    root,
    frame: baronFrame(),
    enginePoints,
    visual: {
      rotors,
      gearNodes: [],
      flaps,
      ailerons,
      animation: { bindings },
      interior,
    },
    modelSignals: {
      sources: interior.sources,
      derived: interior.derived,
      bindings: [...interior.bindings, ...bindings],
    },
  };
}

function cockpit(root, m) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'Baron-cabin'),
    pt = panelTools(d),
    instruments = instrumentGeometry(cabin, 'Baron');
  const { bindings, derived, ink, black, red } = instruments,
    face = mat('Baron-panel', '#383c40'),
    seat = mat('Baron-leather', '#aaa99c'),
    headliner = mat('Baron-headliner', '#d4d0c2'),
    blue = mat('Baron-prop-control', '#3f78bf');
  // 2016 factory cockpit photo, 1376px page: bezel width 282px = 11.8in.
  const k = 0.29972 / 282,
    px = (u) => (686 - u) * k,
    py = (v) => 1.61 - (v - 1090) * k,
    z = 1.12,
    at = (u, v, dz = 0) => [px(u), py(v), z + dz];
  const rect = (x, y, w, h, zz = z) => [
    [x - w / 2, y - h / 2, zz],
    [x + w / 2, y - h / 2, zz],
    [x + w / 2, y + h / 2, zz],
    [x - w / 2, y + h / 2, zz],
  ];
  const edge = [
    [225, 1238],
    [234, 1030],
    [257, 949],
    [310, 925],
    [1030, 925],
    [1085, 949],
    [1112, 1028],
    [1140, 1238],
  ];
  const centers = [
    [px(436), py(1090)],
    [px(779), py(1090)],
  ];
  const holes = centers.map(([x, y]) => rect(x, y, 0.213, 0.16));
  holes.push(
    Array.from({ length: 40 }, (_, i) => [
      px(968) + Math.cos((i * Math.PI) / 20) * 0.035,
      py(1084) + Math.sin((i * Math.PI) / 20) * 0.035,
      z,
    ]),
  );
  sheet(
    d,
    edge.map((p) => at(...p)),
    face,
    [0, 0, -1],
    holes,
  );
  sheet(
    d,
    edge.map((p) => at(...p, 0.065)),
    m.dark,
    [0, 0, 1],
  );
  const brow = edge.map((p) => at(...p));
  outline(d, brow, 0.014, m.dark, false);
  // The glareshield runs forward under the windscreen and stops behind its base.
  for (let i = 0; i < brow.length - 1; i++) {
    const a = brow[i],
      b = brow[i + 1];
    quad(
      d,
      a,
      b,
      [b[0], 1.67 - Math.abs(b[0]) * 0.12, 1.37],
      [a[0], 1.67 - Math.abs(a[0]) * 0.12, 1.37],
      m.dark,
      [0, 1, 0],
    );
  }
  addG1000Bezels(d, centers, z, black, m.dark);
  const sources = addG1000Readouts({
    cabin,
    d,
    instruments,
    prefix: 'Baron',
    pfd: centers[0],
    mfd: centers[1],
    z,
    maxRpm: 2700,
    twinEngine: true,
  });
  Object.assign(sources, {
    gear: { component: 'aircraftState', path: ['gearPosition'] },
    flapPosition: { component: 'aircraftState', path: ['flapPosition'] },
  });
  d.box([0.03302, 0.19558, 0.012], at(607, 1090, -0.008), black);
  for (let row = 0; row < 11; row++)
    for (const side of [-1, 1])
      d.box([0.009, 0.005, 0.004], at(607 + side * 7, 1010 + row * 14, -0.018), m.dark);
  pt.knob(px(607), py(1180), z - 0.02, 0.006);
  instruments.dial(
    'standby-speed',
    at(968, 999, -0.006),
    0.038,
    'knots',
    [
      [0, 0.2],
      [40, 0.5],
      [80, 1.55],
      [120, 2.8],
      [160, 4.1],
      [200, 5.15],
      [240, 5.8],
    ],
    [40, 80, 120, 160, 200, 240],
    'TAS',
    { responseSeconds: 0.2, minorStep: 10 },
  );
  instruments.horizon('standby-attitude', at(968, 1084, 0.008), 0.06, 0.06, { round: true });
  d.ring(0.035, 0.004, at(968, 1084, -0.005), black);
  instruments.altimeter('standby-altimeter', at(968, 1164, -0.006), 0.038, 'feet');
  d.box([0.035, 0.052, 0.015], at(1070, 1055, -0.015), m.metal);
  d.box([0.018, 0.027, 0.02], at(1070, 1055, -0.027), red);
  d.text('ELT', at(1070, 1024, -0.025), 0.005, Math.PI, ink);
  instruments.headingDrum('compass', at(680, 895, -0.015), 0.025, 'trueHeading');
  d.rod(at(680, 930, 0.01), at(680, 918, 0.01), 0.012, m.metal);
  d.box([1.03, 0.16, 0.025], at(686, 1305, 0.006), face);
  for (const u of [627, 675]) {
    pt.gauge(px(u), py(1272), z - 0.01, 0.025, black, false);
    d.text('INOP', at(u, 1272, -0.022), 0.005, Math.PI, ink);
  }
  for (const u of [675, 733, 790]) pt.vent(px(u), py(1327), z - 0.01, 'round', 0.036);
  for (let row = 0; row < 2; row++)
    for (let i = 0; i < 9; i++) {
      const u = 260 + i * 29,
        v = 1275 + row * 45;
      pt.knob(px(u), py(v), z - 0.02, 0.005);
      d.rod(at(u, v, -0.025), at(u, v - 8, -0.036), 0.0027, m.metal);
    }
  d.text('BAT ALT LIGHTS', at(380, 1252, -0.026), 0.005, Math.PI, ink);
  for (let i = 0; i < 16; i++) pt.knob(px(819 + i * 19), py(1375), z - 0.025, 0.0045);
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 6; col++)
      d.add(new T.CylinderGeometry(0.004, 0.004, 0.006, 8).rotateZ(Math.PI / 2), black, [
        0.516,
        1.09 + row * 0.025,
        0.7 + col * 0.036,
      ]);
  derived.gearLocked = { op: 'greater', args: ['gear', 0.999] };
  derived.gearOffStop = { op: 'greater', args: ['gear', 0.001] };
  derived.gearNotLocked = { op: 'less', args: ['gear', 0.999] };
  derived.gearInTransit = { op: 'and', args: ['gearOffStop', 'gearNotLocked'] };
  for (const [index, u, v] of [
    [0, 559, 1288],
    [1, 551, 1300],
    [2, 569, 1300],
  ]) {
    d.add(new T.CircleGeometry(0.006, 12).rotateY(Math.PI), black, at(u, v, -0.025));
    const lamp = group(cabin, `Baron-gear-lamp-${index}`, at(u, v, -0.027)),
      ld = detailKit(lamp, lamp.name);
    ld.add(new T.CircleGeometry(0.005, 12).rotateY(Math.PI), d.green);
    ld.finish();
    bindings.push({
      node: lamp.name,
      source: 'gearLocked',
      property: 'visible',
      scale: 1,
      missing: 'hide',
    });
  }
  const transit = group(cabin, 'Baron-gear-transit', at(582, 1294, -0.027)),
    td = detailKit(transit, transit.name);
  td.add(new T.CircleGeometry(0.006, 12).rotateY(Math.PI), red);
  td.finish();
  bindings.push({
    node: transit.name,
    source: 'gearInTransit',
    property: 'visible',
    scale: 1,
    missing: 'hide',
  });
  const gearLever = group(cabin, 'Baron-gear-handle', at(569, 1342, -0.045)),
    gd = detailKit(gearLever, gearLever.name);
  gd.rod([0, 0, 0], [0, -0.022, -0.02], 0.003, m.metal);
  gd.add(
    new T.CylinderGeometry(0.012, 0.012, 0.01, 12).rotateX(Math.PI / 2),
    black,
    [0, -0.025, -0.023],
  );
  gd.finish();
  bindings.push({
    node: gearLever.name,
    source: 'gear',
    property: 'rotation',
    axis: 'x',
    offset: -0.7,
    scale: 0.7,
  });
  for (const [value, v] of [
    [0, 1275],
    [0.4, 1288],
    [1, 1300],
  ]) {
    const key = `flap.${value}`;
    derived[`${key}.delta`] = { op: 'subtract', args: ['flapPosition', value] };
    derived[`${key}.distance`] = { op: 'abs', args: [`${key}.delta`] };
    derived[key] = { op: 'less', args: [`${key}.distance`, 0.02] };
    const g = group(cabin, `Baron-flap-lamp-${Math.round(value * 100)}`, at(825, v, -0.023)),
      dd = detailKit(g, g.name);
    dd.add(new T.CircleGeometry(0.005, 12).rotateY(Math.PI), instruments.amber);
    dd.finish();
    bindings.push({ node: g.name, source: key, property: 'visible', scale: 1, missing: 'hide' });
  }
  const fl = group(cabin, 'Baron-flap-handle', at(845, 1335, -0.035)),
    fld = detailKit(fl, fl.name);
  fld.box([0.02, 0.009, 0.035], [0, 0, 0], ink);
  fld.finish();
  bindings.push({
    node: fl.name,
    source: 'flapPosition',
    property: 'position',
    axis: 'y',
    scale: -0.027,
  });
  for (const u of [365, 998]) {
    const g = group(cabin, `Baron-yoke-${u}`, at(u, 1290, -0.17)),
      dd = detailKit(g, g.name);
    dd.rod([0, 0, 0.18], [0, 0, -0.055], 0.018, m.metal);
    outline(
      dd,
      [
        [-0.115, 0.1, -0.075],
        [-0.13, -0.035, -0.075],
        [-0.09, -0.045, -0.075],
        [0.09, -0.045, -0.075],
        [0.13, -0.035, -0.075],
        [0.115, 0.1, -0.075],
      ],
      0.016,
      m.metal,
      false,
    );
    const badge = [
      [-0.055, -0.041, -0.092],
      [-0.038, 0.052, -0.092],
      [0.035, 0.052, -0.092],
      [0.058, -0.041, -0.092],
    ];
    sheet(dd, badge, black, [0, 0, -1]);
    outline(dd, badge, 0.003, m.metal);
    dd.text('BEECHCRAFT', [0, -0.018, -0.096], 0.005, Math.PI, ink);
    for (const side of [-1, 1]) {
      beveledBox(dd, [0.027, 0.045, 0.033], [side * 0.115, 0.092, -0.074], headliner, 0.005);
      dd.box([0.015, 0.007, 0.015], [side * 0.115, 0.115, -0.08], black);
    }
    dd.finish();
    bindings.push(
      { node: g.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.65 },
      { node: g.name, source: 'pitchInput', property: 'position', axis: 'z', scale: -0.055 },
    );
  }
  const pedestal = group(cabin, 'Baron-pedestal', [-0.02, 1.12, 1.04]),
    dd = detailKit(pedestal, pedestal.name);
  beveledBox(dd, [0.27, 0.3, 0.37], [0, 0, 0], face, 0.025);
  dd.ring(0.074, 0.01, [0.137, -0.02, -0.1], black, 'x');
  // Three pairs: black throttles, blue propeller governors, red mixtures.
  for (const [pair, x, label, col] of [
    [0, 0.086, 'throttle', black],
    [1, 0, 'propeller', blue],
    [2, -0.086, 'mixture', red],
  ])
    for (let i = 0; i < 2; i++) {
      const g = group(pedestal, `Baron-${label === 'propeller' ? 'prop-lever' : label}-${i + 1}`, [
          x + (i === 0 ? 0.018 : -0.018),
          0.13,
          0.035 - pair * 0.025,
        ]),
        ld = detailKit(g, g.name);
      // Keep each grip above the quadrant throughout its full aft travel.
      const leverHeight = 0.12;
      ld.rod([0, 0, 0], [0, leverHeight, -0.045 - pair * 0.025], 0.005, m.metal);
      beveledBox(ld, [0.029, 0.027, 0.038], [0, leverHeight, -0.045 - pair * 0.025], col, 0.005);
      ld.finish();
      if (label === 'throttle')
        bindings.push({
          node: g.name,
          source: 'power',
          property: 'rotation',
          axis: 'x',
          offset: -0.35,
          scale: 0.7,
        });
    }
  beveledBox(dd, [0.2, 0.08, 0.017], [0, 0.08, -0.2], black, 0.01);
  dd.text('CABIN AIR', [0, 0.105, -0.212], 0.006, Math.PI, ink);
  for (const x of [-0.065, -0.022, 0.022, 0.065]) dd.ring(0.012, 0.002, [x, 0.07, -0.213], m.metal);
  dd.ring(0.035, 0.006, [0, -0.02, -0.14], black, 'y');
  dd.text('RUD TRIM', [0, 0.01, -0.2], 0.006, Math.PI, ink);
  dd.finish();
  d.box([1.06, 0.035, 3.05], [0, 0.75, -0.38], m.dark);
  for (const [row, zz, facing] of [
    [0, 0.17, 0],
    [1, -0.53, Math.PI],
    [2, -1.52, 0],
  ])
    for (const side of [-1, 1]) {
      // The aft pair sits closer together where the cabin narrows under the rounded roof.
      const g = group(cabin, `Baron-seat-${row}-${side}`, [
        side * (row === 2 ? 0.24 : 0.275),
        0.97,
        zz,
      ]);
      g.rotation.y = facing;
      const sd = detailKit(g, g.name);
      beveledBox(sd, [0.45, 0.13, 0.48], [0, 0, 0], seat, 0.04);
      beveledBox(sd, [0.43, 0.55, 0.12], [0, 0.32, -0.22], seat, 0.04);
      beveledBox(sd, [0.31, 0.4, 0.014], [0, 0.35, -0.148], seat, 0.025);
      beveledBox(sd, [0.28, 0.17, 0.1], [0, 0.67, -0.21], seat, 0.03);
      for (const j of [-1, 1]) {
        sd.rod([j * 0.08, 0.57, -0.21], [j * 0.08, 0.61, -0.21], 0.007, m.metal);
        sd.rod([j * 0.16, -0.18, 0], [j * 0.16, -0.05, 0], 0.012, m.metal);
        sd.rod([j * 0.19, 0.11, -0.13], [j * 0.19, 0.11, 0.13], 0.022, seat);
      }
      sd.rod([-0.16, 0.08, -0.11], [0.16, 0.08, 0.11], 0.014, black);
      sd.box([0.04, 0.013, 0.034], [0, 0.09, 0], m.metal);
      sd.finish();
    }
  for (const side of [-1, 1]) {
    d.box([0.022, 0.25, 2.6], [side * 0.531, 0.99, -0.35], seat);
    d.box([0.028, 0.035, 2.6], [side * 0.51, 1.12, -0.35], m.dark);
    for (const zz of [-0.7, -1.4]) {
      d.ring(0.033, 0.005, [side * 0.5, 1.145, zz], m.metal, 'y');
      d.box([0.012, 0.04, 0.085], [side * 0.51, 1.02, zz], black);
    }
    for (const j of [-1, 1]) {
      const g = group(cabin, `Baron-pedal-${side}-${j}`, [side * 0.28 + j * 0.075, 0.84, 1.25]),
        dd = detailKit(g, g.name);
      dd.box([0.125, 0.065, 0.04], [0, 0, 0], m.metal);
      for (let i = 0; i < 4; i++)
        dd.box([0.004, 0.05, 0.004], [-0.045 + i * 0.03, 0, -0.024], black);
      dd.finish();
      bindings.push({
        node: g.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: -j * 0.035,
      });
    }
    d.box([0.24, 0.025, 0.2], [side * 0.26, 2.02, 0.45], headliner);
    for (const zz of [0, -0.8, -1.4]) {
      d.ring(0.026, 0.005, [side * 0.2, 1.98 + zz * 0.1, zz], m.metal, 'y');
      d.add(new T.SphereGeometry(0.014, 12, 8), black, [side * 0.2, 1.97 + zz * 0.1, zz]);
    }
  }
  beveledBox(d, [0.022, 0.32, 0.46], [-0.505, 1.04, -0.98], headliner, 0.006);
  d.finish();
  return { nodes: ['cockpit'], sources, derived, bindings };
}
