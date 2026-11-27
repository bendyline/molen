/** 2015 Bonanza G36, E-4063–4080 equipment. Main axle origin; +Z nose, +X pilot left.
 * Manufacturer three-view and panel diagram, with exterior/cabin photographic checks.
 */
import { aircraftPanelTools as panelTools } from '../vehicle-interiors.mjs';
import { skinSection, wallAt } from './cockpit-fit.mjs';
import {
  bar,
  flapSelectorGeometry,
  lathe,
  leverGate,
  partPalette,
  place,
  roundedBox,
} from './cockpit-parts.mjs';
import { addG1000Bezels, addG1000Readouts } from './g1000-panel.mjs';
import {
  beechClimatePanel,
  beechQuadrantLever,
  beechYoke,
  cabinHeadliner,
  cabinLiner,
  frameTrim,
  gaGearSwitch,
  gaPedal,
  placedKit,
} from './ga-cabin.mjs';
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

export const bonanzaFrame = () => ({
  heli: false,
  fighter: false,
  large: false,
  radius: 0.625,
  cy: 1.3,
  ry: 0.76,
  cabinZ: 0.35,
  cabinWidth: 1.07,
  // The A36 roof is low: the eye trades headroom (0.13 m) against the view over the glareshield.
  eye: [0.28, 1.81, 0.35],
  panelZ: 1.12,
  floor: 0.75,
});
export function buildBonanza(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('Bonanza-ivory', '#e6e6df', { side: T.DoubleSide }),
    accent = mat('Bonanza-navy', '#234367', { side: T.DoubleSide }),
    metal = mat('Bonanza-alloy', '#a7afaf', { metalness: 0.7 }),
    dark = mat('Bonanza-trim', '#262c31'),
    rubber = mat('Bonanza-tires', '#202728'),
    glass = mat('Bonanza-glazing', '#b2cbd0', {
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.15,
    });
  const d = detailKit(root, 'Bonanza-shell'),
    bindings = [],
    flaps = [],
    ailerons = [];
  // Stations follow the side-view roof/belly and independent plan-view half widths:
  // [z, half width, belly, crown, belt, dome squareness, lower roundness]. Full lower sides rise
  // to the belt (widest); above it the cabin is a superellipse dome (A36 front view) with the
  // side windows cut into that curved skin, not into a flat slab. The cowl and tail cone round
  // off below the belt; the cabin keeps a flat floor.
  const stations = [
    // Nose bowl: the chin curls up under the spinner (A36 three-view), not a deep flat face.
    [2.6, 0.39, 0.98, 1.57, 1.26, 3, 0.8],
    [2.38, 0.47, 0.75, 1.63, 1.22, 3, 0.6],
    // Windscreen base; the dome stays full to the header, over the panel and glareshield.
    [1.42, 0.58, 0.59, 1.72, 1.3, 4, 0.3],
    // A36 three-view: cabin roof about 2.03 m above the main-wheel ground line, low behind
    // a long sloping windscreen; the old roof stood a hand's width proud of it.
    [0.6, 0.625, 0.59, 2.07, 1.46, 2.6, 0],
    [-0.08, 0.625, 0.59, 2.06, 1.44, 2.3, 0],
    [-0.78, 0.61, 0.59, 1.97, 1.42, 2.3, 0],
    [-1.38, 0.57, 0.59, 1.88, 1.39, 2.3, 0],
    [-2.03, 0.52, 0.6, 1.8, 1.37, 2.3, 0],
    [-2.75, 0.43, 0.65, 1.73, 1.3, 2.2, 0.4],
    [-3.75, 0.3, 0.76, 1.59],
    [-4.75, 0.15, 0.9, 1.4],
    [-5.402, 0.025, 1.11, 1.19],
  ];
  // Right-side points from the crown (0): 1-5 dome at 15-75 degrees, 6 belt, 7-10 lower side,
  // 11 keel; the left side mirrors them at index 22 - k.
  const N = 22;
  const rings = stations.map(([z, w, b, t, belt = b + (t - b) * 0.5, n = 2.4, round = 0.8]) => {
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
    return {
      z,
      points: [[0, t], ...right, [0, b - 0.025], ...right.reverse().map(([x, y]) => [-x, y])],
    };
  });
  const p = (i, j) => [...rings[i].points[j], rings[i].z];
  // Windscreen: crown to the 45-degree dome point, cowl ring to cabin header. The side band
  // (right-side columns k = point k to k + 1, mirrored left) is rebuilt around the windows.
  const screen = [19, 20, 21, 0, 1, 2],
    bandTop = (i) => (i === 2 ? 3 : 2),
    inBand = (i, k) => i >= 2 && i <= 6 && k >= bandTop(i) && k <= 6;
  loft(d, rings, paint, {
    skip: (i, j) => (i === 2 && screen.includes(j)) || inBand(i, j) || inBand(i, N - 1 - j),
  });
  for (const j of screen)
    quad(d, p(2, j), p(3, j), p(3, (j + 1) % N), p(2, (j + 1) % N), glass, [0, 1, 1]);
  outline(
    d,
    [p(2, 19), ...[...screen, 3].map((j) => p(3, j)), ...[3, 2, 1, 0, 21, 20].map((j) => p(2, j))],
    0.013,
    paint,
  );
  // Skin half width at a station and height, so windows, doors and trim follow the curved side.
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
      [0.57, 1.92],
      [0.48, 1.93],
      [0.02, 1.92],
      [0.0, 1.87],
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
  // Wing reference: chord line height, chord, leading edge, trailing edge, flap/aileron hinge.
  const y = (x) => 0.77 + Math.abs(x) * Math.tan(Math.PI / 30),
    chord = (x) => 2.185 - (1.075 * Math.abs(x)) / 5.08,
    le = (x) => 0.77 - (2.185 - chord(x)) * 0.25,
    te = (x) => le(x) - chord(x),
    hinge = (x) => te(x) + chord(x) * 0.23,
    // Half-thickness parameter of mesh-kit wing() (1.65 of it is the depth at 25% chord).
    // The A36 root is a NACA 23016.5 tapering to a 23012 tip: about 14% of the chord at the
    // root here and 11% outboard. The old 0.12 root (under 10%) had no room for the main
    // wheel, which lay on top of the skin when retracted.
    half = (x) => {
      const a = Math.abs(x);
      return a < 2.75
        ? 0.19 - ((a - 0.52) * 0.055) / 2.23
        : a < 4.86
          ? 0.135 - ((a - 2.75) * 0.055) / 2.11
          : 0.08 - ((a - 4.86) * 0.03) / 0.22;
    };
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
    for (let i = 0; i < stations.length - 1; i++) {
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
    for (const i of [1, 2, 7, 8, 9, 10])
      outline(
        d,
        rings[i].points.map((q) => [...q, rings[i].z]),
        0.0016,
        metal,
      );
    if (side < 0) {
      outline(
        d,
        onSkin(-1, [
          [0.57, 1.93],
          [-0.08, 1.92],
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
      // Wing walk on the right root, laid on the upper skin's two aft facets (40-92% of the
      // chord to the flap hinge), not a flat plank that floats over the falling chord.
      const walk = (x, u) => {
        const h = half(x),
          lift = u < 0.75 ? h * (1 - (u - 0.25) * 0.96) : (h * 0.52 * (1 - u)) / 0.25;
        return [-x, y(x) + lift + 0.004, le(x) - u * (le(x) - hinge(x))];
      };
      for (const [u0, u1] of [
        [0.4, 0.75],
        [0.75, 0.92],
      ])
        quad(d, walk(0.64, u0), walk(0.88, u0), walk(0.88, u1), walk(0.64, u1), dark, [0, 1, 0]);
      d.rod([-0.54, 0.62, -1.46], [-0.8, 0.31, -1.48], 0.015, metal);
      d.box([0.25, 0.025, 0.12], [-0.88, 0.31, -1.48], dark);
    }
    wing(
      d,
      [
        [side * 0.52, y(0.52), le(0.52), hinge(0.52), half(0.52)],
        [side * 2.75, y(2.75), le(2.75), hinge(2.75), half(2.75)],
        [side * 4.86, y(4.86), le(4.86), hinge(4.86), half(4.86)],
        [side * 5.08, y(5.08), le(5.08) - 0.035, te(5.08) + 0.05, half(5.08)],
      ],
      paint,
    );
    for (const [kind, begin, end] of [
      ['flap', 0.58, 2.75],
      ['aileron', 2.78, 4.87],
    ]) {
      const g = group(root, `Bonanza-${kind}-${side}`, [side * begin, y(begin), hinge(begin)]),
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
    for (let x = 0.8; x < 4.88; x += 0.35) {
      const h = half(x),
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
      [side * 5.0804, y(5.08), 0.32],
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
      y(1.17) + half(1.17) * 0.984 - 0.004,
      0.31,
    ]);
    // Vortex generators stand on the leading-edge slope (upper surface 0.31 h at 0.1 m aft).
    for (let x = 2.9; x < 4.8; x += 0.24)
      d.box([0.006, 0.025, 0.037], [side * x, y(x) + half(x) * 0.31 + 0.011, le(x) - 0.1], paint);
    const leTail = (x) => -3.98 - Math.abs(x) * 0.11,
      teTail = (x) => -5.1 + Math.abs(x) * 0.06;
    wing(
      d,
      [
        [0, 1.27, leTail(0), -4.64, 0.06],
        [side * 1.7, 1.27, leTail(1.7), -4.64, 0.036],
        [side * 1.8542, 1.27, leTail(1.8542) - 0.06, teTail(1.8542) + 0.08, 0.02],
      ],
      paint,
    );
    const eg = group(root, `Bonanza-elevator-${side}`, [0, 1.27, -4.65]),
      ed = detailKit(eg, eg.name);
    wing(
      ed,
      [
        [side * 0.12, 0, 0, teTail(0.12) + 4.65, 0.018],
        [side * 1.7, 0, 0, teTail(1.7) + 4.65, 0.012],
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
    [-4.71, 2.55],
    [-4.85, 2.58],
    [-5.26, 2.5],
    [-4.94, 1.26],
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
  const rg = group(root, 'Bonanza-rudder', [0, 1.26, -4.94]),
    rd = detailKit(rg, rg.name);
  for (const side of [-1, 1]) {
    sheet(
      rd,
      [
        [side * 0.035, 0, 0],
        [side * 0.035, 1.24, -0.32],
        [side * 0.035, 1.21, -0.462],
        [side * 0.035, -0.08, -0.29],
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
  d.add(new T.CylinderGeometry(0.025, 0.025, 0.036, 12), d.red, [0, 2.5982, -4.83]);
  d.rod([0, 2.05, -0.4], [0, 2.34, -0.64], 0.008, paint);
  d.rod([0, 1.91, -1.5], [0, 2.09, -1.65], 0.006, paint);
  for (const side of [-1, 1]) {
    ellipsoid(d, [side * 0.22, 1.42, 2.606], [0.14, 0.085, 0.016], dark, 16);
    d.rod([side * 0.29, 0.66, 1.67], [side * 0.31, 0.52, 1.43], 0.024, metal);
    d.box([0.13, 0.014, 0.26], [side * 0.3, 0.65, 1.46], paint);
    // Lower cowl louver slots, set into the curved side.
    for (let i = 0; i < 10; i++) {
      const z = 2.2 - i * 0.032;
      d.rod(
        [side * (halfWidth(z, 1.0) + 0.002), 1.0, z],
        [side * (halfWidth(z, 0.92) + 0.002), 0.92, z],
        0.0045,
        dark,
      );
    }
  }
  ellipsoid(d, [0, 1.11, 2.609], [0.1, 0.055, 0.014], dark, 16);
  const engine = group(root, 'engine-1', [0, 1.43, 2.61]),
    prop = group(engine, 'Bonanza-propeller'),
    pd = detailKit(prop, prop.name);
  pd.add(new T.ConeGeometry(0.15, 0.37, 24).rotateX(Math.PI / 2), metal, [0, 0, 0.185]);
  for (let i = 0; i < 3; i++) {
    const g = group(prop, `Bonanza-prop-blade-${i}`);
    g.rotation.z = (i * 2 * Math.PI) / 3 - Math.PI / 2;
    const dd = detailKit(g, g.name);
    const pts = [
      [0.12, -0.04, 0],
      [0.35, -0.075, 0.01],
      [0.86, -0.045, 0],
      [1.016, -0.015, -0.01],
      [1.016, 0.04, -0.01],
      [0.62, 0.075, 0.005],
      [0.13, 0.04, 0],
    ];
    sheet(dd, pts, dark, [0, 0, 1]);
    sheet(
      dd,
      pts.map((p) => [p[0], p[1], p[2] - 0.014]),
      dark,
      [0, 0, -1],
    );
    dd.box([0.045, 0.06, 0.016], [0.979, 0.012, -0.009], paint);
    dd.finish();
  }
  pd.finish();
  // Actual main struts retract inboard; nose leg retracts aft. Doors stay attached to their legs.
  // Hinges sit where the stowed wheel lands inside the skin: the mains at mid-depth of the wing
  // root (y 0.87; at 0.91 the tyre lay on top of the wing), the nose wheel up in the nose bowl
  // (at 0.8 a third of it hung below the belly).
  for (const [index, x, z, top, r] of [
    [0, 0, 2.46, 0.95, 0.205],
    [1, 1.4605, 0, 0.87, 0.24],
    [2, -1.4605, 0, 0.87, 0.24],
  ]) {
    const g = group(root, `Bonanza-gear-${index}`, [x, top, z]),
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
      // The drag brace runs fore-aft in the leg's plane of swing, so it folds flat into the wing
      // with the leg (an inboard brace swung 18 cm above the upper skin).
      dd.rod([0, -0.04, -0.28], [0, -h + 0.12, 0], 0.017, metal);
      // The strut door rides outboard of the leg, set off so that, retracted, it lies on the
      // wing's lower skin (the leg's local y becomes the spanwise station inboard of the hinge).
      const sx = Math.sign(x),
        offset = (ly) => {
          const at = Math.abs(x) + ly;
          return sx * (top - (y(at) - half(at) * 0.586) + 0.004);
        };
      sheet(
        dd,
        [
          [offset(-0.03), -0.03, 0.25],
          [offset(-0.03), -0.03, -0.3],
          [offset(-h + 0.07), -h + 0.07, -0.22],
          [offset(-h + 0.07), -h + 0.07, 0.12],
        ],
        paint,
        [sx, 0, 0],
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
  // Skin height over the cowl at (x, z) along the dome (right-side points 0-6), for the
  // glareshield to tuck under the windscreen base.
  const skinTop = (x, z) => {
    const q = ringAt(z),
      ax = Math.min(Math.abs(x), q[6][0]);
    for (let k = 0; k < 6; k++)
      if (ax >= q[k][0] && ax <= q[k + 1][0])
        return q[k][1] + ((q[k + 1][1] - q[k][1]) * (ax - q[k][0])) / (q[k + 1][0] - q[k][0] || 1);
    return q[6][1];
  };
  // Firewall: the cowl was open from the cabin to the inlet, so from the seat the eye looked
  // over the glareshield into the engine bay and out past the spinner to the propeller, and
  // from the inlet straight into the cabin. A bulkhead just ahead of the windscreen base closes
  // both views.
  const firewall = ringAt(1.5).map(([x, yy]) => [x * 0.995, yy - 0.004, 1.5]);
  sheet(d, firewall, dark, [0, 0, -1]);
  sheet(d, [...firewall].reverse(), dark, [0, 0, 1]);
  const { stations: controlStations, ...interior } = cockpit(root, {
    paint,
    accent,
    metal,
    dark,
    skinTop,
    ring: (i) => rings[i],
  });
  cleanGeometry(root);
  return {
    root,
    frame: { ...bonanzaFrame(), controlStations },
    enginePoints: [{ id: 'engine-1', position: [0, 1.43, 2.61] }],
    visual: {
      rotors: [{ node: prop.name, axis: 'z', multiplier: 1, engine: 'engine-1' }],
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
    d = detailKit(cabin, 'Bonanza-cabin'),
    pt = panelTools(d),
    instruments = instrumentGeometry(cabin, 'Bonanza');
  const { bindings, derived, ink, black, red } = instruments,
    face = mat('Bonanza-panel', '#383e40'),
    seat = mat('Bonanza-leather', '#41494c'),
    headliner = mat('Bonanza-headliner', '#cbc9be'),
    // Ivory side panels and posts (Textron G36 cabin and Flying 2013 panel photographs); the
    // taupe they were read as brown khaki round the windscreen.
    sidewall = mat('Bonanza-sidewall', '#b9b2a3'),
    // The molded Beech wheel is satin titanium gray round its black hub plate, not black.
    yokeShell = mat('Bonanza-yoke', '#8f9395', { metalness: 0.35, roughness: 0.45 });
  // Panel diagram at 1376px width, calibrated with the physical 11.8-inch display bezel.
  const k = 0.29972 / 318,
    px = (u) => (690 - u) * k,
    py = (v) => 1.54 - (v - 585) * k,
    z = 1.12,
    at = (u, v, dz = 0) => [px(u), py(v), z + dz];
  const rect = (x, y, w, h, zz = z) => [
    [x - w / 2, y - h / 2, zz],
    [x + w / 2, y - h / 2, zz],
    [x + w / 2, y + h / 2, zz],
    [x - w / 2, y + h / 2, zz],
  ];
  const edge = [
    [145, 736],
    [145, 622],
    [200, 468],
    [270, 410],
    [1015, 410],
    [1112, 450],
    [1182, 525],
    [1239, 679],
    [1239, 718],
    [1210, 740],
    [1050, 740],
    [1020, 769],
    [430, 772],
    [404, 746],
    [374, 746],
    [340, 772],
    [164, 772],
  ];
  const centers = [
    [px(397), py(585)],
    [px(790), py(585)],
  ];
  const holes = centers.map(([x, y]) => rect(x, y, 0.213, 0.16));
  holes.push(
    Array.from({ length: 40 }, (_, i) => [
      px(1016) + Math.cos((i * Math.PI) / 20) * 0.035,
      py(581) + Math.sin((i * Math.PI) / 20) * 0.035,
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
  const brow = edge.slice(1, 8).map((p) => at(...p));
  // The hood overhangs the panel face by some 7 cm and its padded edge droops at both ends (G36
  // panel photographs); a padded black edge (it was a headliner-colored tube that read white
  // over the panel) on the lip.
  const lip = brow.map(([x, y, zz], i) => [
    x * 0.99,
    y - (i === 0 || i === 6 ? 0.012 : 0),
    zz - 0.07,
  ]);
  for (let i = 0; i < brow.length - 1; i++) {
    quad(d, brow[i], brow[i + 1], lip[i + 1], lip[i], m.dark, [0, 1, 0]);
    quad(d, lip[i], lip[i + 1], brow[i + 1], brow[i], m.dark, [0, -1, 0]);
  }
  outline(d, lip, 0.014, m.dark, false);
  // The glareshield runs forward under the windscreen and tucks 5 cm under the cowl skin past
  // the windscreen base (z 1.42). It used to stop at z 1.38, 6 cm under that base, leaving an
  // open slot over the panel through which the eye saw into the cowl and out past the spinner
  // to the propeller.
  const tuck = 1.47,
    front = (p) => [p[0], m.skinTop(p[0], tuck) - 0.012, tuck];
  for (let i = 0; i < brow.length - 1; i++) {
    const a = brow[i],
      b = brow[i + 1];
    quad(d, a, b, front(b), front(a), m.dark, [0, 1, 0]);
  }
  addG1000Bezels(d, centers, z, black, m.dark);
  const sources = addG1000Readouts({
    cabin,
    d,
    instruments,
    prefix: 'Bonanza',
    pfd: centers[0],
    mfd: centers[1],
    z,
    maxRpm: 2700,
  });
  Object.assign(sources, {
    gear: { component: 'aircraftState', path: ['gearPosition'] },
    flapPosition: { component: 'aircraftState', path: ['flapPosition'] },
  });
  d.box([0.03302, 0.19558, 0.012], at(594, 585, -0.008), black);
  for (let row = 0; row < 11; row++)
    for (const side of [-1, 1])
      d.box([0.009, 0.005, 0.004], at(594 + side * 7, 505 + row * 14, -0.018), m.dark);
  pt.knob(px(594), py(677), z - 0.02, 0.006);
  instruments.dial(
    'standby-speed',
    at(1016, 486, -0.006),
    0.038,
    'knots',
    [
      [0, 0.25],
      [40, 0.65],
      [80, 1.8],
      [120, 3.3],
      [160, 4.5],
      [200, 5.45],
      [220, 5.85],
    ],
    [40, 80, 120, 160, 200],
    'TAS',
    { responseSeconds: 0.2, minorStep: 10 },
  );
  instruments.horizon('standby-attitude', at(1016, 581, 0.008), 0.06, 0.06, { round: true });
  d.ring(0.035, 0.004, at(1016, 581, -0.005), black);
  instruments.altimeter('standby-altimeter', at(1016, 679, -0.006), 0.038, 'feet');
  d.box([0.035, 0.052, 0.015], at(1130, 548, -0.015), m.metal);
  d.box([0.018, 0.027, 0.02], at(1130, 548, -0.027), red);
  d.text('ELT', at(1130, 583, -0.025), 0.005, Math.PI, ink);
  // Center glareshield standby compass: rotating cylindrical card behind a real aperture.
  instruments.headingDrum('compass', at(690, 353, -0.015), 0.025, 'trueHeading');
  d.rod(at(690, 390, 0.01), at(690, 375, 0.01), 0.012, m.metal);
  // Subpanels are a separate plane under the yoke shafts; three center ventilation outlets.
  d.box([1.08, 0.19, 0.025], at(690, 870, 0.006), face);
  for (const [u, v] of [
    [683, 883],
    [748, 883],
    [814, 883],
  ])
    pt.vent(px(u), py(v), z - 0.01, 'round', 0.042);
  for (const [u, v] of [
    [171, 839],
    [198, 839],
    [226, 839],
    [253, 839],
    [298, 839],
    [324, 839],
    [352, 839],
    [267, 895],
    [291, 895],
    [316, 895],
    [340, 895],
    [364, 895],
    [431, 895],
    [455, 895],
    [479, 895],
    [503, 895],
    [475, 839],
    [503, 839],
  ]) {
    pt.knob(px(u), py(v), z - 0.02, 0.005);
    d.rod(at(u, v, -0.025), at(u, v - 9, -0.037), 0.0027, m.metal);
  }
  for (const u of [195, 238, 281, 324]) pt.knob(px(u), py(954), z - 0.025, 0.009);
  // The pilot's sidewall switch and breaker console ahead of the left knee (G36 factory and
  // Flying 2013 photographs): a black box on the sidewall trim, its face turned up toward the
  // seat, three rows of rocker switches.
  {
    const wall = wallAt(skinSection(root, 0.86), 1.0, 1) ?? 0.53,
      g = group(cabin, 'Bonanza-sidewall-switches', [wall - 0.07, 1.0, 0.86]);
    g.rotation.set(0.45, Math.PI / 2, 0, 'YXZ');
    const sd = detailKit(g, g.name);
    beveledBox(sd, [0.3, 0.14, 0.04], [0, 0, 0], black, 0.008);
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 7; col++)
        sd.box([0.012, 0.02, 0.008], [-0.12 + col * 0.04, 0.042 - row * 0.042, -0.022], m.metal);
    sd.finish();
  }
  d.text('BAT  ALT  AVIONICS', at(257, 818, -0.026), 0.005, Math.PI, ink);
  d.text('LIGHTS', at(465, 868, -0.026), 0.005, Math.PI, ink);
  for (let i = 0; i < 19; i++) pt.knob(px(862 + i * 20), py(950), z - 0.025, 0.0045);
  beveledBox(d, [0.17, 0.145, 0.018], at(1144, 834, -0.004), m.dark, 0.012);
  d.box([0.047, 0.04, 0.008], at(1106, 835, -0.019), m.metal);
  d.box([0.06, 0.052, 0.01], at(617, 814, -0.014), black);
  d.text('SUCTION', at(617, 805, -0.023), 0.004, Math.PI, ink);
  d.text('INOP', at(617, 826, -0.023), 0.005, Math.PI, ink);
  // Gear lamps reflect locked-down state, not merely the pilot's selected handle position.
  derived.gearLocked = { op: 'greater', args: ['gear', 0.999] };
  derived.gearOffStop = { op: 'greater', args: ['gear', 0.001] };
  derived.gearNotLocked = { op: 'less', args: ['gear', 0.999] };
  derived.gearInTransit = { op: 'and', args: ['gearOffStop', 'gearNotLocked'] };
  for (const [index, u, v] of [
    [0, 538, 830],
    [1, 530, 844],
    [2, 547, 844],
  ]) {
    d.add(new T.CircleGeometry(0.006, 12).rotateY(Math.PI), black, at(u, v, -0.025));
    const lamp = group(cabin, `Bonanza-gear-lamp-${index}`, at(u, v, -0.027)),
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
  const transit = group(cabin, 'Bonanza-gear-transit', at(565, 837, -0.027)),
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
  // Landing-gear switch: the wheel-shaped knob on a short lever, on the subpanel face.
  const gearLever = group(cabin, 'Bonanza-gear-handle', at(550, 879, -0.007)),
    gd = detailKit(gearLever, gearLever.name);
  gaGearSwitch(placedKit(gd, [0, 0, 0], [-Math.PI / 4, 0, 0]), {
    palette: { black: partPalette().white },
  });
  gd.finish();
  d.add(place(roundedBox([0.03, 0.05, 0.003], 0.003), at(550, 885, -0.0075)), black);
  d.text('GEAR', at(550, 852, -0.008), 0.0045, Math.PI, ink);
  bindings.push({
    node: gearLever.name,
    source: 'gear',
    property: 'rotation',
    axis: 'x',
    offset: -0.7,
    scale: 0.7,
  });
  for (const [value, v] of [
    [0, 805],
    [0.4, 822],
    [1, 839],
  ]) {
    const key = `flap.${value}`;
    derived[`${key}.delta`] = { op: 'subtract', args: ['flapPosition', value] };
    derived[`${key}.distance`] = { op: 'abs', args: [`${key}.delta`] };
    derived[key] = { op: 'less', args: [`${key}.distance`, 0.02] };
    const g = group(cabin, `Bonanza-flap-lamp-${Math.round(value * 100)}`, at(865, v, -0.023)),
      dd = detailKit(g, g.name);
    dd.add(new T.CircleGeometry(0.005, 12).rotateY(Math.PI), instruments.amber);
    dd.finish();
    bindings.push({ node: g.name, source: key, property: 'visible', scale: 1, missing: 'hide' });
  }
  // Flap switch: an airfoil knob in a three-position gate (UP, APPROACH, DOWN).
  const fl = group(cabin, 'Bonanza-flap-handle', at(906, 851, -0.007)),
    fld = detailKit(fl, fl.name);
  flapSelectorGeometry(fld, { style: 'airfoil', scale: 0.9 });
  fld.finish();
  leverGate(placedKit(d, at(906, 865, -0.0065)), { size: [0.02, 0.045], marks: 3 });
  d.text('FLAPS', at(906, 822, -0.008), 0.0045, Math.PI, ink);
  bindings.push({
    node: fl.name,
    source: 'flapPosition',
    property: 'position',
    axis: 'y',
    scale: -0.027,
  });
  for (const u of [391, 992]) {
    // Dual Beech control wheels: the M-shaped wheel (horns rising from a dipped cross arm, a
    // trim/PTT switch head on each) in satin gray round the black Beechcraft hub plate, on a
    // black column (G36 factory and Flying 2013 panel photographs).
    const g = group(cabin, `Bonanza-yoke-${u}`, at(u, 777, -0.17)),
      dd = detailKit(g, g.name);
    beechYoke(placedKit(dd, [0, 0, -0.078]), { width: 0.25, material: yokeShell });
    dd.add(bar([0, 0, -0.063], [0, 0, 0.18], 0.0125, 16), black);
    dd.add(
      place(
        lathe(
          [
            [0, 0],
            [0.0135, 0],
            [0.0135, 0.004],
            [0, 0.004],
          ],
          14,
        ),
        [0, 0, 0.18],
        [-Math.PI / 2, 0, 0],
      ),
      m.metal,
    );
    dd.text('BEECHCRAFT', [0, -0.034, -0.1048], 0.004, Math.PI, ink);
    dd.finish();
    bindings.push(
      { node: g.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.65 },
      { node: g.name, source: 'pitchInput', property: 'position', axis: 'z', scale: -0.055 },
    );
  }
  // Center pedestal under the subpanel: the T-P-M quadrant on its sloping top (the throttle a
  // black barrel with the GO AROUND button on its left end, the propeller a fluted blue block,
  // the mixture a fluted red barrel, each in its own slot), the Digital Climate Control panel
  // on its face with the rudder trim knob below it, the elevator trim wheel on its left flank
  // (G36 factory and Flying 2013 photographs).
  const pedestal = group(cabin, 'Bonanza-pedestal', [0, 1.06, 0.96]),
    dd = detailKit(pedestal, pedestal.name);
  beveledBox(dd, [0.2, 0.28, 0.3], [0, -0.01, 0.01], face, 0.02);
  beveledBox(dd, [0.19, 0.02, 0.16], [0, 0.133, 0.03], black, 0.006);
  dd.ring(0.07, 0.009, [0.103, -0.02, -0.06], black, 'x');
  beechClimatePanel(dd, [0, 0.06, -0.143], { width: 0.15 });
  dd.text('RUD TRIM', [0, -0.03, -0.141], 0.006, Math.PI, ink);
  for (const [x, t] of [
    [0.06, 'T'],
    [0, 'P'],
    [-0.06, 'M'],
  ])
    dd.text(t, [x, 0.115, -0.141], 0.009, Math.PI, ink);
  for (const x of [0.06, 0, -0.06])
    dd.box([0.01, 0.003, 0.12], [x, 0.1445, 0.03], partPalette().black);
  for (const [x, label] of [
    [0.06, 'throttle'],
    [0, 'propeller'],
    [-0.06, 'mixture'],
  ]) {
    const g = group(pedestal, `Bonanza-${label}`, [x, 0.13, 0.04]),
      ld = detailKit(g, g.name);
    // The rotor animator and the propeller collision disc take the heaviest node named
    // 'Bonanza-propeller', which the propeller lever shares: keep it far lighter than the spinner.
    beechQuadrantLever(ld, {
      kind: { throttle: 'throttle', propeller: 'prop', mixture: 'mixture' }[label],
      height: 0.1,
      rake: -0.035,
      length: 0.05,
      goAround: label === 'throttle',
    });
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
  dd.add(
    place(
      lathe(
        [
          [0, 0],
          [0.016, 0],
          [0.016, 0.014],
          [0.012, 0.018],
          [0, 0.018],
        ],
        16,
      ),
      [0, -0.075, -0.14],
      [-Math.PI / 2, 0, 0],
    ),
    black,
  );
  dd.finish();
  // Cabin floor; 1.02 m keeps its aft corners inside the narrowing skin (1.06 showed through).
  d.box([1.02, 0.035, 3.05], [0, 0.75, -0.38], m.dark);
  d.box([0.18, 0.03, 0.3], [0.24, 0.79, 0.42], face);
  d.ring(0.045, 0.005, [0.24, 0.81, 0.42], m.metal, 'y');
  d.rod([0.24, 0.82, 0.42], [0.27, 0.82, 0.45], 0.008, red);
  // Six seats: front pair, aft-facing middle pair, forward-facing rear pair.
  for (const [row, zz, facing] of [
    [0, 0.17, 0],
    [1, -0.53, Math.PI],
    [2, -1.52, 0],
  ])
    for (const side of [-1, 1]) {
      // The aft pair sits closer together where the cabin narrows under the rounded roof.
      const x = side * (row === 2 ? 0.24 : 0.275),
        g = group(cabin, `Bonanza-seat-${row}-${side}`, [x, 0.97, zz]);
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
      const g = group(cabin, `Bonanza-pedal-${side}-${j}`, [side * 0.28 + j * 0.075, 0.86, 1.25]),
        dd = detailKit(g, g.name);
      gaPedal(dd, { side: j, drop: 0.06, tread: partPalette().tread });
      dd.finish();
      bindings.push({
        node: g.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: -j * 0.035,
      });
    }
    d.box([0.24, 0.025, 0.2], [side * 0.26, 1.95, 0.45], headliner);
    for (const zz of [0, -0.8, -1.4]) {
      d.ring(0.026, 0.005, [side * 0.2, 1.92 + zz * 0.1, zz], m.metal, 'y');
      d.add(new T.SphereGeometry(0.014, 12, 8), black, [side * 0.2, 1.91 + zz * 0.1, zz]);
    }
  }
  beveledBox(d, [0.022, 0.32, 0.46], [-0.505, 1.04, -0.98], headliner, 0.006);
  // Gray leather sidewalls from under the floor edge to the sills and round the windows, the
  // headliner over the roof, and trim over the painted windscreen frame: from the seat the inside
  // of the ivory skin showed white on every wall.
  cabinLiner(d, root, {
    zFrom: 1.49,
    zTo: -2.0,
    yFrom: 0.66,
    yTo: 1.46,
    material: sidewall,
    zSteps: 12,
    rows: 4,
    reach: 0.68,
  });
  cabinLiner(d, root, {
    zFrom: 1.45,
    zTo: -2.0,
    yFrom: 1.44,
    yTo: 1.95,
    material: sidewall,
    zSteps: 12,
    rows: 4,
    reach: 0.68,
    inset: 0.014,
  });
  cabinHeadliner(d, root, {
    zFrom: 0.62,
    zTo: -2.0,
    yFrom: 1.95,
    material: headliner,
    zSteps: 8,
    margin: 0.002,
  });
  // Footwell floor on to the firewall: the cabin floor stopped under the panel, over bare skin.
  d.box([1.0, 0.035, 0.36], [0, 0.75, 1.32], m.dark);
  const ringPoint = (i, j) => [...m.ring(i).points[j], m.ring(i).z];
  frameTrim(
    d,
    [3, 2, 1, 0, 21, 20, 19].map((j) => ringPoint(3, j)),
    headliner,
    { center: 1.3 },
  );
  frameTrim(d, [ringPoint(2, 3), ringPoint(3, 3)], sidewall, { center: 1.3 });
  frameTrim(d, [ringPoint(2, 19), ringPoint(3, 19)], sidewall, { center: 1.3 });
  d.finish();
  // Magneto/start key at the left end of the subpanel; the parking-brake pull handle below the
  // pilot's subpanel, inboard of the yoke column.
  const stations = [
    {
      action: 'engine',
      style: 'key',
      at: at(150, 905, -0.007),
      label: 'MAGNETOS',
      labelAt: [0, 0.028, -0.002],
      labelHeight: 0.0045,
    },
    {
      action: 'brake',
      style: 'tee',
      at: at(470, 948, -0.007),
      label: 'PARK BRAKE',
      labelAt: [0, 0.02, -0.002],
      labelHeight: 0.0045,
    },
  ];
  return { nodes: ['cockpit'], sources, derived, bindings, stations };
}
