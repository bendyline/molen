/** Civilian Wright-powered DC-3; UAL DC-3/DST manual (1942 revision),
 * Boeing dimensions and Knoxville museum photographs. All positions in flight datum. */
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { smoothSurface } from '../surface-normals.mjs';
import { dc3Cockpit } from './dc-3-cockpit.mjs';
import {
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

/** A tyre with rounded shoulders on a dished rim with a domed hub cap, the axle along X through
 * `at`: radius r, width w. It replaces flat cylinder-and-disc wheels. */
function wheel(d, at, r, w, tyre, rim, cap = rim) {
  const lathe = (points, segments) =>
    new T.LatheGeometry(
      points.map(([x, y]) => new T.Vector2(x, y)),
      segments,
    ).rotateZ(Math.PI / 2);
  d.add(
    lathe(
      // Listed from the -Y bead round to the +Y bead so the lathe faces point outward.
      [
        [r * 0.64, -w * 0.5],
        [r * 0.88, -w * 0.5],
        [r * 0.97, -w * 0.4],
        [r, -w * 0.2],
        [r, w * 0.2],
        [r * 0.97, w * 0.4],
        [r * 0.88, w * 0.5],
        [r * 0.64, w * 0.5],
      ],
      20,
    ),
    tyre,
    at,
  );
  for (const side of [-1, 1]) {
    const mirror = (points) => (side > 0 ? points : points.map(([x, y]) => [x, -y]).reverse());
    d.add(
      lathe(
        mirror([
          [r * 0.64, w * 0.5],
          [r * 0.6, w * 0.34],
          [r * 0.3, w * 0.34],
          [r * 0.22, w * 0.44],
        ]),
        16,
      ),
      rim,
      at,
    );
    d.add(
      lathe(
        mirror(
          Array.from({ length: 5 }, (_, k) => {
            const a = (k * Math.PI) / 8;
            return [r * 0.22 * Math.cos(a), w * 0.44 + r * 0.09 * Math.sin(a)];
          }),
        ),
        12,
      ),
      cap,
      at,
    );
  }
}
/** Front and back z of a side-view outline [[z, y], ...] at height y (0 width outside it). */
function chordAt(outline, y) {
  const zs = [];
  for (let n = 0; n < outline.length; n++) {
    const [za, ya] = outline[n],
      [zb, yb] = outline[(n + 1) % outline.length];
    if ((ya - y) * (yb - y) <= 0 && ya !== yb) zs.push(za + ((zb - za) * (y - ya)) / (yb - ya));
  }
  return zs.length ? [Math.max(...zs), Math.min(...zs)] : [0, 0];
}
/** Horizontal ribs [y, front z, back z] of a side-view outline, at every vertex height. */
function outlineRibs(outline) {
  const ys = [...new Set(outline.map(([, y]) => y))].sort((a, b) => a - b),
    low = ys[0] + 0.004,
    high = ys.at(-1) - 0.004;
  return [low, ...ys.filter((y) => y > low && y < high), high].map((y) => [
    y,
    ...chordAt(outline, y),
  ]);
}
/** Half width of a foil rib at z, for details laid on its surface. */
function foilX([, front, back, half, lead, trail], z) {
  const u = (front - z) / (front - back),
    xs = [
      [0, lead],
      [0.3, half],
      [0.75, trail + (half - trail) * 0.45],
      [1, trail],
    ];
  for (let k = 0; k < 3; k++)
    if (u <= xs[k + 1][0])
      return xs[k][1] + ((xs[k + 1][1] - xs[k][1]) * (u - xs[k][0])) / (xs[k + 1][0] - xs[k][0]);
  return trail;
}
/** A symmetric fin or rudder lofted through ribs [y, front z, back z, half thickness at 30 %
 * chord, front-face half width, back-face half width] and closed at both ends: a tapered
 * section instead of a constant-thickness slab. */
function foil(d, ribs, material) {
  const rings = ribs.map(([y, front, back, half, lead, trail]) => {
    const c = front - back,
      right = [
        [lead, front],
        [half, front - c * 0.3],
        [trail + (half - trail) * 0.45, front - c * 0.75],
        [trail, back],
      ];
    return [...right, ...[...right].reverse().map(([x, z]) => [-x, z])].map(([x, z]) => [x, y, z]);
  });
  for (let i = 0; i < rings.length - 1; i++)
    for (let j = 0; j < 8; j++) {
      const q = [rings[i][j], rings[i + 1][j], rings[i + 1][(j + 1) % 8], rings[i][(j + 1) % 8]],
        mid = (k) => q.reduce((sum, p) => sum + p[k], 0) / 4,
        axis = (ribs[i][1] + ribs[i][2] + ribs[i + 1][1] + ribs[i + 1][2]) / 4;
      quad(d, ...q, material, [mid(0), 0, mid(2) - axis]);
    }
  sheet(d, rings[0], material, [0, -1, 0]);
  sheet(d, rings.at(-1), material, [0, 1, 0]);
}

const angle = (11.5 * Math.PI) / 180,
  offset = -0.821,
  ppm = 756 / 19.6469;
export const dc3Pose = (p) =>
  new T.Vector3(...p)
    .applyAxisAngle(new T.Vector3(1, 0, 0), -angle)
    .add(new T.Vector3(0, offset, 0))
    .toArray();
const zz = (u) => 9.82345 - (u - 93) / ppm,
  yy = (v) => (362 - v) / ppm;
export const dc3Frame = () => ({
  heli: false,
  fighter: false,
  large: true,
  radius: 1.24,
  cy: 3.3,
  ry: 1.32,
  cabinZ: dc3Pose([0.56, 4.4, 7.5])[2],
  cabinWidth: 2.3,
  eye: dc3Pose([0.56, 4.4, 7.5]),
  panelZ: dc3Pose([0, 3.9, 8.15])[2],
  floor: 2.18,
});
function radial(body, side, m) {
  const g = group(body, `engine-${side === 1 ? 1 : 2}`, [side * 2.8194, 2.159, 6.57]),
    d = detailKit(g, `DC3-engine-${side}`);
  const ring = (z, r) => ({
    z,
    points: Array.from({ length: 32 }, (_, i) => [
      r * Math.sin((i * Math.PI) / 16),
      r * Math.cos((i * Math.PI) / 16),
    ]),
  });
  const rings = [
    [0.26, 0.765],
    [0.12, 0.835],
    [-0.4, 0.84],
    [-0.82, 0.81],
  ].map((q) => ring(...q));
  loft(d, rings, m.metal, { caps: false });
  const outer = ring(0.262, 0.765).points.map((q) => [...q, 0.262]),
    inner = ring(0.263, 0.69).points.map((q) => [...q, 0.263]);
  sheet(d, outer, m.orange, [0, 0, 1], [inner]);
  for (let i = 0; i < 32; i++)
    quad(
      d,
      inner[i],
      inner[(i + 1) % 32],
      [inner[(i + 1) % 32][0], inner[(i + 1) % 32][1], -0.12],
      [inner[i][0], inner[i][1], -0.12],
      m.dark,
      [0, 0, 1],
    );
  // Nine exposed single-row Cyclone cylinders, paired pushrods and cooling fins.
  ellipsoid(d, [0, 0, 0.045], [0.32, 0.32, 0.27], m.engine, 20);
  for (let j = 0; j < 9; j++) {
    const a = (j * Math.PI * 2) / 9,
      p = (r) => [Math.sin(a) * r, Math.cos(a) * r, -0.02],
      c = group(g, `DC3-cylinder-${side}-${j}`, p(0.46));
    c.rotation.z = -a;
    const cd = detailKit(c, c.name);
    cd.add(new T.CylinderGeometry(0.105, 0.09, 0.35, 10), m.dark, [0, 0, 0]);
    for (let k = 0; k < 9; k++)
      cd.add(new T.CylinderGeometry(0.12, 0.12, 0.008, 10), m.engine, [0, -0.15 + k * 0.035, 0]);
    cd.box([0.2, 0.065, 0.19], [0, 0.19, 0], m.engine);
    cd.finish();
    for (const dx of [-0.045, 0.045])
      d.rod(
        [p(0.26)[0] + dx, p(0.26)[1], 0.15],
        [p(0.61)[0] + dx, p(0.61)[1], 0.09],
        0.009,
        m.metal,
      );
  }
  const tail = [
    [-0.8, 0.78, 0],
    [-1.4, 0.72, -0.05],
    [-2.4, 0.58, 0.15],
    [-3.6, 0.28, 0.15],
    [-4.3, 0.018, -0.15],
  ].map(([z, r, dy]) => ({ z, points: ring(z, r).points.map(([x, y]) => [x, y + dy]) }));
  loft(d, tail, m.metal);
  d.box([0.29, 0.11, 0.75], [0, 0.83, -0.7], m.metal);
  d.box([0.23, 0.07, 0.015], [0, 0.84, -0.31], m.dark);
  for (const sign of [-1, 1]) {
    d.rod([sign * 0.58, -0.52, -0.55], [sign * 0.7, -0.72, -1.3], 0.074, m.engine);
    d.add(new T.CircleGeometry(0.064, 12), m.dark, [sign * 0.7, -0.72, -1.38]);
  }
  for (const z of [-0.72, -1.38, -2.35]) {
    outline(
      d,
      ring(z, z > -0.8 ? 0.813 : z > -1.5 ? 0.725 : 0.59).points.map((q) => [...q, z]),
      0.0025,
      m.dark,
    );
  }
  const prop = group(g, `DC3-propeller-${side}`, [0, 0, 0.5]),
    pd = detailKit(prop, prop.name);
  ellipsoid(pd, [0, 0, 0.13], [0.18, 0.18, 0.24], m.metal, 20);
  pd.ring(0.145, 0.008, [0, 0, 0.25], m.engine);
  for (let j = 0; j < 3; j++) {
    const b = group(prop, `DC3-blade-${side}-${j}`);
    b.rotation.z = (j * Math.PI * 2) / 3;
    const bd = detailKit(b, b.name),
      pts = [
        [0.12, -0.07, 0.02],
        [0.42, -0.12, 0],
        [1.35, -0.12, -0.02],
        [1.7, -0.06, -0.01],
        [1.7526, 0, 0],
        [1.71, 0.055, 0.01],
        [1.3, 0.12, 0.025],
        [0.4, 0.11, 0.02],
        [0.12, 0.07, 0],
      ];
    sheet(bd, pts, m.metal, [0, 0, 1]);
    sheet(
      bd,
      pts.map((q) => [q[0], q[1], q[2] - 0.02]),
      m.dark,
      [0, 0, -1],
    );
    sheet(
      bd,
      [
        [1.61, -0.083, 0.012],
        [1.7, -0.06, 0.012],
        [1.7526, 0, 0.012],
        [1.71, 0.055, 0.012],
        [1.61, 0.077, 0.012],
      ],
      m.orange,
      [0, 0, 1],
    );
    bd.finish();
  }
  pd.finish();
  d.finish();
  return prop;
}
export function buildDC3(s) {
  const root = new T.Group();
  root.name = s.slug;
  const body = group(root, 'DC3-airframe');
  body.rotation.x = -angle;
  body.position.y = offset;
  const m = {
      metal: mat('DC3-aluminium', '#aeb9be', {
        metalness: 0.72,
        roughness: 0.36,
        side: T.DoubleSide,
      }),
      orange: mat('DC3-orange', '#dc6329', { side: T.DoubleSide }),
      blue: mat('DC3-blue', '#203f60', { side: T.DoubleSide }),
      dark: mat('DC3-dark', '#202827', { side: T.DoubleSide }),
      engine: mat('DC3-engine-case', '#6c7c80', { metalness: 0.6 }),
      rubber: mat('DC3-tyre', '#1b2022'),
      fabric: mat('DC3-fabric-controls', '#9ca9ad', { side: T.DoubleSide }),
    },
    glass = mat('DC3-glass', '#a7bec5', {
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.12,
    }),
    // Tinted passenger windows: the photos show them as dark panes with thin seals.
    tinted = mat('DC3-cabin-glass', '#28333a', {
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      side: T.DoubleSide,
      metalness: 0.35,
      roughness: 0.1,
    }),
    d = detailKit(body, 'DC3-shell'),
    bindings = [];
  const stations = [
    [93, 0.015, 251, 247],
    // Nose half-widths from the MMK-Draw plan view (blunt round nose, not a pointed cone).
    [107, 0.5, 266, 231],
    [133, 0.8, 277, 217],
    [153, 0.93, 281, 207],
    [173, 1.02, 284, 189],
    [211, 1.2, 290, 179],
    [280, 1.24, 292, 178],
    [382, 1.24, 291, 178],
    [535, 1.19, 280, 181],
    [630, 1.02, 263, 187],
    [709, 0.69, 244, 197],
    [770, 0.38, 233, 209],
    [828, 0.12, 227, 217],
    [848, 0.012, 223, 222],
  ].map(([u, w, b, t]) => [zz(u), w, yy(b), yy(t)]);
  // Near-circular nose and cabin sections (head-on photo of USAF 716): an elliptical upper
  // half over the window band and a fuller lower half over the wing centre section, widest at
  // mid-height; no flat vertical sides. The cockpit rings (windscreen base and header) keep the
  // flat-topped upper section the crew, panel and windscreen need and a fuller floor, blended
  // back over rings 2 and 5.
  // Right-side points from the crown (0): 1-10 at the angles below, 11 keel; the left side
  // mirrors them at index 22 - k.
  const N = 22,
    angles = [12, 25, 38, 50, 62, 74, 86, 100, 122, 148],
    cockpitSection = [0, 0, 0.5, 1, 1, 0.5];
  const rings = stations.map(([z, w, b, t], i) => {
      const c = (t + b) / 2,
        h = (t - b) / 2,
        s = cockpitSection[i] ?? 0,
        box = [
          [0, t],
          [w * 0.58, t - h * 0.07],
          [w * 0.9, t - h * 0.24],
          [w, t - h * 0.52],
          [w, b + h * 0.76],
          [w * 0.82, b + h * 0.16],
          [w * 0.46, b + h * 0.03],
          [0, b],
        ],
        right = angles.map((deg) => {
          const a = (deg * Math.PI) / 180,
            q = Math.cos(a),
            n = q > 0 ? 2.3 : 3 + 2 * s,
            round = [
              w * Math.pow(Math.sin(a), 2 / n),
              c + Math.sign(q) * h * Math.pow(Math.abs(q), 2 / n),
            ];
          if (!s || q <= 0) return round;
          // The flat-topped section where the ray from the centre through the round point
          // crosses it.
          const [dx, dy] = [round[0], round[1] - c];
          for (let k = 0; k < box.length - 1; k++) {
            const [x0, y0] = box[k],
              [x1, y1] = box[k + 1],
              den = dx * (y1 - y0) - dy * (x1 - x0);
            if (Math.abs(den) < 1e-12) continue;
            const f = (dx * (c - y0) + dy * x0) / den,
              r = (x0 + (x1 - x0) * f) / (dx || 1e-12);
            if (f >= 0 && f <= 1 && r > 0) {
              const flat = [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f];
              return round.map((v, n) => v + (flat[n] - v) * s);
            }
          }
          return round;
        });
      return {
        z,
        points: [[0, t], ...right, [0, b], ...right.reverse().map(([x, y]) => [-x, y])],
      };
    }),
    p = (i, j) => [...rings[i].points[j], rings[i].z];
  // Windscreen: crown to the 38-degree point between ring 3 and the cockpit header (ring 4).
  // The side band (right-side columns 3-7, points 3-8, mirrored left) is rebuilt around the
  // cockpit and cabin windows.
  const screen = [19, 20, 21, 0, 1, 2],
    inBand = (i, k) => i >= 3 && i <= 10 && k >= 3 && k <= 7;
  loft(d, rings, m.metal, {
    skip: (i, j) =>
      i === 0 || (i === 3 && screen.includes(j)) || inBand(i, j) || inBand(i, N - 1 - j),
  });
  // Blunt round nose: the first ring closes over an elliptical dome that leaves ring 1 on the
  // loft's own slope, instead of every ring converging on a single faceted point.
  {
    const tip = (stations[0][2] + stations[0][3]) / 2;
    loft(
      d,
      [0, 0.3, 0.55, 0.75, 0.9, 1].map((t) => {
        const k = Math.sqrt(1 - t * t) * (1 - 0.35 * t);
        return {
          z: rings[1].z + (stations[0][0] - rings[1].z) * t,
          points: rings[1].points.map(([x, y]) => [x * k, tip + (y - tip) * k]),
        };
      }),
      m.metal,
      { caps: false },
    );
  }
  for (const j of screen)
    quad(d, p(3, j), p(4, j), p(4, (j + 1) % N), p(3, (j + 1) % N), glass, [0, 1, 1]);
  for (const j of [0, 3, 19]) d.rod(p(3, j), p(4, j), 0.016, m.metal);
  for (const i of [3, 4])
    outline(
      d,
      [19, 20, 21, 0, 1, 2, 3].map((j) => p(i, j)),
      0.016,
      m.metal,
      false,
    );
  const sample = (z, k) => {
    for (let i = 0; i < stations.length - 1; i++)
      if (z <= stations[i][0] && z >= stations[i + 1][0]) {
        const t = (stations[i][0] - z) / (stations[i][0] - stations[i + 1][0]);
        return stations[i][k] * (1 - t) + stations[i + 1][k] * t;
      }
    return stations.at(-1)[k];
  };
  // Skin half width at a station and height, so windows, stripes and rivets follow the skin.
  const ringAt = (z) => {
    let i = rings.findIndex((r, n) => n < rings.length - 1 && z <= r.z && z >= rings[n + 1].z);
    if (i < 0) i = z > rings[0].z ? 0 : rings.length - 2;
    const a = rings[i].points,
      b = rings[i + 1].points,
      u = (z - rings[i].z) / (rings[i + 1].z - rings[i].z);
    return a.map((q, j) => [q[0] + (b[j][0] - q[0]) * u, q[1] + (b[j][1] - q[1]) * u]);
  };
  // Profile parameter v of height y: right-side point k plus the fraction towards point k + 1.
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
  // consecutive breakpoints every column leaves quads bounded by column lines or window edges,
  // so the skin keeps the section's facets right up to each window frame.
  const band = (side, windows) => {
    // Collected and smoothed together like the loft, so the band does not shade in stripes.
    const parts = [],
      skin = { add: (geometry) => parts.push(geometry) };
    const edges = windows.flatMap((w) => w.map((a, n) => [a, w[(n + 1) % w.length]]));
    for (let i = 3; i <= 10; i++)
      for (let k = 3; k <= 7; k++) {
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
                skin,
                onBand(side, sa, lo(sa)),
                onBand(side, sb, lo(sb)),
                onBand(side, sb, hi(sb)),
                onBand(side, sa, hi(sa)),
                m.metal,
                [side, 0, 0],
              );
            }
            if (g(sm) > low(sm)) low = g;
          }
        }
      }
    const merged = mergeGeometries(parts);
    d.add(smoothSurface(merged), m.metal);
    merged.dispose();
    for (const geometry of parts) geometry.dispose();
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
  // Side-view (u, v) manual-pixel windows: two cockpit side windows and seven cabin windows.
  const win = (u, v, w, h) => [
    [u - w / 2, v - h / 2],
    [u + w / 2, v - h / 2],
    [u + w / 2, v + h / 2],
    [u - w / 2, v + h / 2],
  ];
  const apertures = [
    [
      [154, 217],
      [171, 204],
      [171, 227],
      [154, 228],
    ],
    [
      [176, 203],
      [205, 197],
      [205, 227],
      [176, 227],
    ],
    ...[293, 331, 369, 407, 445, 483, 521].map((u) => win(u, 231, 21, 17)),
  ].map((w) => w.map(([u, v]) => [zz(u), toV(zz(u), yy(v))]));
  for (const side of [-1, 1]) {
    const pt = (z, y, off = 0) => [side * (halfWidth(z, y) + off), y, z];
    band(side, apertures);
    for (const [n, w] of apertures.entries()) {
      const h = aperture(side, w);
      sheet(d, h, n < 2 ? glass : tinted, [side, 0, 0]);
      outline(d, h, 0.005, m.blue);
    }
    // Narrow painted lightning stripe; no photographic skin.
    for (let i = 1; i < stations.length - 2; i++) {
      const a = stations[i],
        b = stations[i + 1],
        ha = a[2] + (a[3] - a[2]) * 0.4,
        hb = b[2] + (b[3] - b[2]) * 0.4;
      quad(
        d,
        pt(a[0], ha, 0.009),
        pt(b[0], hb, 0.009),
        pt(b[0], hb + 0.1, 0.009),
        pt(a[0], ha + 0.1, 0.009),
        m.orange,
        [side, 0, 0],
      );
    }
    for (const [u1, u2, v1, v2] of side === -1
      ? [[549, 575, 209, 264]]
      : [
          [179, 203, 229, 263],
          [628, 656, 220, 242],
        ]) {
      const pts = [
        [u1, v2],
        [u1, v1 + 5],
        [u1 + 5, v1],
        [u2 - 5, v1],
        [u2, v1 + 5],
        [u2, v2],
      ].map(([u, v]) => pt(zz(u), yy(v), 0.007));
      outline(d, pts, 0.003, m.dark);
      d.rod(
        pt(zz(u1 + 6), yy((v1 + v2) / 2), 0.02),
        pt(zz(u1 + 13), yy((v1 + v2) / 2), 0.02),
        0.012,
        m.metal,
      );
    }
    for (let z = 8.8; z > -7.8; z -= 0.73) {
      const b = sample(z, 2),
        t = sample(z, 3);
      for (let f = 0.13; f < 0.94; f += 0.07) {
        const y = b + (t - b) * f;
        if (y > 3.15 && y < 3.8 && z < 6 && z > -2) continue;
        d.add(new T.SphereGeometry(0.003, 4, 2), m.metal, pt(z, y, 0.001));
      }
    }
    // Frame seams over the crown, down to the top of the window band.
    for (const z of [8.5, 7.3, 5.0, 3.6, 1.3, -1, -3.5, -5.4, -7.3])
      outline(
        d,
        ringAt(z)
          .slice(0, 4)
          .map(([x, y]) => [side * x * 1.003, y + 0.004, z]),
        0.0018,
        m.engine,
        false,
      );
    const decal = group(body, `DC3-label-${side}`, [
      side * (halfWidth(3.7, 3.0) + 0.006),
      3.0,
      3.7,
    ]);
    decal.rotation.y = (side * Math.PI) / 2;
    const dd = detailKit(decal, decal.name);
    dd.text('DOUGLAS  DC-3', [0, 0, 0], 0.17, 0, m.blue);
    dd.finish();
  }
  // 170-inch centre-section chord, 51.5-inch outer-tip chord, five-degree dihedral.
  const join = 3.6068,
    wy = (x) => 2.37 + Math.tan((5 * Math.PI) / 180) * Math.max(0, x - join),
    lead = (x) => 5.05 - Math.max(0, x - join) * 0.295;
  for (const side of [-1, 1]) {
    wing(
      d,
      [
        // Root buried in the rounded lower fuselage, so the wing meets the skin without a gap.
        [side * 0.8, wy(0.8), 5.05, 0.732, 0.32],
        [side * join, wy(join), 5.05, 0.732, 0.32],
        [side * 6.32, wy(6.32), lead(6.32), 1.32, 0.24],
        [side * 13.72, wy(13.72), lead(13.72), 0.732, 0.1],
        [side * 14.12, wy(14.12), 1.95, 0.83, 0.08],
        [side * 14.39, wy(14.39), 1.69, 1.02, 0.045],
        [side * 14.478, wy(14.478), 1.39, 1.24, 0.015],
      ],
      m.metal,
    );
    for (const [kind, a, b] of [
      ['flap', 1.13, 6.3],
      ['aileron', 6.36, 13.69],
    ]) {
      const hinge = kind === 'flap' ? 1.55 : 1.32,
        g = group(body, `DC3-${kind}-${side}`, [side * a, wy(a) - 0.025, hinge]),
        dd = detailKit(g, g.name);
      wing(
        dd,
        [
          [0, 0, 0, 0.732 - hinge, 0.023],
          [side * (b - a), wy(b) - wy(a), 0, 0.732 - hinge, 0.02],
        ],
        m.fabric,
      );
      for (let xx = 0.15; xx < b - a; xx += 0.3)
        dd.rod(
          [side * xx, wy(a + xx) - wy(a) + 0.022, -0.02],
          [side * xx, wy(a + xx) - wy(a) + 0.012, 0.75 - hinge],
          0.002,
          m.engine,
        );
      dd.finish();
      bindings.push({
        node: g.name,
        source: kind === 'flap' ? 'flapPosition' : side === 1 ? 'aileronL' : 'aileronR',
        property: 'rotation',
        axis: 'x',
        scale: kind === 'flap' ? -Math.PI / 4 : 1,
      });
    }
    for (const xx of [3.65, 6.3, 9.5, 12.5]) {
      const y = wy(xx) + 0.22 * (1 - xx / 17);
      d.rod([side * xx, y, lead(xx) - 0.2], [side * xx, y, 1.37], 0.0025, m.engine);
      for (let z = 1.5; z < lead(xx) - 0.22; z += 0.12)
        d.add(new T.SphereGeometry(0.003, 4, 2), m.metal, [side * (xx + 0.026), y + 0.004, z]);
    }
    // The round fixed stabilizer and separate broad fabric elevator.
    wing(
      d,
      [
        [side * 0.18, 3.77, -6.2, -8.85, 0.1],
        [side * 3.62, 3.77, -8.04, -8.85, 0.065],
        [side * 3.94, 3.77, -8.3, -8.95, 0.045],
        [side * 4.064, 3.77, -8.6, -8.95, 0.012],
      ],
      m.metal,
    );
    const eg = group(body, `DC3-elevator-${side}`, [0, 3.77, -8.85]),
      ed = detailKit(eg, eg.name);
    wing(
      ed,
      [
        [side * 0.18, 0, 0, -0.86, 0.065],
        [side * 3.64, 0, 0, -0.85, 0.035],
        [side * 3.92, 0, -0.06, -0.65, 0.02],
        [side * 4.04, 0, -0.1, -0.25, 0.01],
      ],
      m.fabric,
    );
    for (let x = 0.4; x < 3.7; x += 0.3)
      ed.rod([side * x, 0.067, -0.03], [side * x, 0.02, -0.8], 0.002, m.engine);
    ed.box([0.65, 0.025, 0.15], [side * 2.8, 0, -0.79], m.metal);
    ed.finish();
    bindings.push({
      node: eg.name,
      source: 'elevatorAngle',
      property: 'rotation',
      axis: 'x',
      scale: 1,
    });
    const gear = group(body, `DC3-main-gear-${side}`, [side * 2.8194, 2.1, 4.4]),
      gd = detailKit(gear, gear.name);
    for (const sign of [-1, 1]) {
      gd.rod([sign * 0.3, 0, 0], [sign * 0.3, -1.1, -0.18], 0.039, m.metal);
      gd.rod([sign * 0.3, -0.65, -0.11], [sign * 0.3, -1.5, -0.22], 0.03, m.engine);
      gd.rod([sign * 0.3, -1.4, -0.22], [sign * 0.3, -0.15, -1.8], 0.031, m.metal);
    }
    gd.rod([-0.34, -1.5285, -0.22], [0.34, -1.5285, -0.22], 0.05, m.metal);
    wheel(gd, [0, -1.5285, -0.22], 0.5715, 0.4318, m.rubber, m.metal, m.engine);
    for (const sign of [-1, 1])
      for (let j = 0; j < 8; j++) {
        const a = (j * Math.PI) / 4;
        gd.add(new T.SphereGeometry(0.014, 6, 4), m.dark, [
          sign * 0.153,
          -1.5285 + 0.15 * Math.sin(a),
          -0.22 + 0.15 * Math.cos(a),
        ]);
      }
    gd.finish();
    bindings.push({
      node: gear.name,
      source: 'gearPosition',
      property: 'rotation',
      axis: 'x',
      scale: 1.3,
      offset: -1.3,
    });
    const lamp = ellipsoid(
      d,
      [side * 5.5, wy(5.5), lead(5.5) - 0.015],
      [0.12, 0.095, 0.04],
      m.dark,
      16,
    );
    lamp.name = `DC3-landing-light-${side}`;
    ellipsoid(d, [side * 5.5, wy(5.5), lead(5.5) + 0.01], [0.085, 0.065, 0.026], m.metal, 12);
  }
  // Fin silhouette follows the manual; rudder hinge and rounded trailing edge are distinct.
  // Fin and rudder are tapered sections (10 % of the combined chord, at most 0.2 m thick over
  // the dorsal fillet), not constant-thickness slabs.
  const finOutline = [
      [612, 187],
      [640, 177],
      [668, 171],
      [690, 151],
      [707, 125],
      [724, 99],
      [740, 87],
      [762, 84],
      [762, 199],
      [845, 224],
      [772, 218],
      [700, 206],
      [625, 196],
    ].map(([u, v]) => [zz(u), yy(v)]),
    hinge = [yy(199), zz(762)],
    // Hinge, rounded cap and trailing edge sit forward/higher than the manual trace: matched to
    // the Commons DC-3 line three-view aligned on the main and tail wheel hubs.
    rudderOutline = [
      [762, 199],
      [762, 84],
      [786, 85],
      [810, 92],
      [817, 120],
      [821, 170],
      [826, 205],
      [845, 224],
    ].map(([u, v]) => [zz(u) - hinge[1], yy(v) - hinge[0]]),
    chordOf = (outline, y) => {
      const [front, back] = chordAt(outline, y);
      return front - back;
    },
    finHalf = (y) =>
      Math.min(
        0.1,
        Math.max(0.02, 0.05 * (chordOf(finOutline, y) + chordOf(rudderOutline, y - hinge[0]))),
      ),
    rudderRib = (h) => {
      const half = finHalf(h + hinge[0]);
      return [h, ...chordAt(rudderOutline, h), half * 0.5, half * 0.55, 0.004];
    };
  foil(
    d,
    outlineRibs(finOutline).map(([y, f, b]) => [
      y,
      f,
      b,
      finHalf(y),
      finHalf(y) * 0.35,
      finHalf(y) * 0.55,
    ]),
    m.metal,
  );
  const rudder = group(body, 'DC3-rudder', [0, hinge[0], hinge[1]]),
    rd = detailKit(rudder, rudder.name);
  foil(
    rd,
    outlineRibs(rudderOutline).map(([h]) => rudderRib(h)),
    m.fabric,
  );
  // Fabric rib stitching on both sides of the rudder surface.
  for (let h = 0.2; h < 2.8; h += 0.27) {
    const rib = rudderRib(h),
      end = Math.max(rib[2] * 0.95, -1.2);
    for (const side of [-1, 1])
      outline(
        rd,
        [-0.02, end * 0.3, end * 0.75, end].map((z) => [side * (foilX(rib, z) + 0.003), h, z]),
        0.002,
        m.engine,
        false,
      );
  }
  rd.finish();
  bindings.push({
    node: rudder.name,
    source: 'yawInput',
    property: 'rotation',
    axis: 'y',
    scale: Math.PI / 6,
  });
  const tail = group(body, 'DC3-tail-wheel', [0, 2.706, -6.35]),
    td = detailKit(tail, tail.name);
  td.rod([0, 0.18, 0.09], [0, -0.12, 0], 0.042, m.metal);
  for (const side of [-1, 1])
    td.rod([side * 0.14, -0.05, 0], [side * 0.14, -0.24, -0.17], 0.024, m.metal);
  wheel(td, [0, -0.26, -0.17], 0.2794, 0.2286, m.rubber, m.metal);
  td.finish();
  const props = [radial(body, 1, m), radial(body, -1, m)];
  d.rod([0, 4.78, 6.2], [0, 5.12, 6.0], 0.014, m.metal);
  d.rod([0, 5.12, 6], [0, 6.3, -7.5], 0.002, m.dark);
  for (const side of [-1, 1]) {
    d.rod([side * 0.07, 4.03, 8.3], [side * 0.55, 4.17, 8.08], 0.012, m.dark);
    d.rod([side * 0.4, 4.12, 8.17], [side * 0.77, 4.23, 7.95], 0.009, m.dark);
    d.rod([side * 0.6, 2.1, 8.1], [side * 0.6, 1.78, 8.1], 0.016, m.dark);
    d.rod([side * 0.6, 1.78, 8.1], [side * 0.6, 1.78, 8.45], 0.013, m.metal);
  }
  d.finish();
  const interior = dc3Cockpit(body, m);
  body.getObjectByName('cockpit').position.z = -0.25;
  cleanGeometry(root);
  return {
    root,
    frame: dc3Frame(),
    enginePoints: [
      { id: 'engine-1', position: dc3Pose([2.8194, 2.159, 6.57]) },
      { id: 'engine-2', position: dc3Pose([-2.8194, 2.159, 6.57]) },
    ],
    visual: {
      rotors: props.map((p, i) => ({
        node: p.name,
        engine: `engine-${i + 1}`,
        axis: 'z',
        multiplier: 1,
      })),
      gearNodes: [],
      flaps: [],
      ailerons: [],
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
