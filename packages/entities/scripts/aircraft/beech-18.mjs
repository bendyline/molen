/** D18S low-cabin Twin Beech. Dimensioned Beech Specification 131 and
 * Art Mills / Paul Matt's earlier Model 18 three-view, checked against Smithsonian N522B photographs. */
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { smoothSurface } from '../surface-normals.mjs';
import { beech18Cockpit } from './beech-18-cockpit.mjs';
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

const angle = (12.283 * Math.PI) / 180,
  offset = -0.613,
  ppm = 1380 / 10.41;
const pose = (p) =>
  new T.Vector3(...p)
    .applyAxisAngle(new T.Vector3(1, 0, 0), -angle)
    .add(new T.Vector3(0, offset, 0))
    .toArray();
const engineY = 1.584;
const zz = (u) => 5.205 - (u - 190) / ppm,
  yy = (v) => (1260 - v) / ppm;
export const beech18Frame = () => ({
  heli: false,
  fighter: false,
  large: true,
  radius: 0.71,
  cy: 1.95,
  ry: 0.78,
  cabinZ: pose([0.34, 2.75, 3.1])[2],
  cabinWidth: 1.31,
  eye: pose([0.34, 2.75, 3.1]),
  panelZ: pose([0, 2, 3.55])[2],
  floor: 1.19,
});
function radial(parent, side, m) {
  const engine = group(parent, `engine-${side === 1 ? 1 : 2}`, [side * 1.9685, engineY, 4.0]),
    d = detailKit(engine, `Beech18-engine-${side}`);
  const rings = [
    [0.22, 0.56],
    [0.13, 0.64],
    [-0.2, 0.665],
    [-0.69, 0.64],
    [-0.78, 0.6],
  ].map(([z, r]) => ({
    z,
    points: Array.from({ length: 32 }, (_, j) => [
      r * Math.sin((j * Math.PI) / 16),
      r * Math.cos((j * Math.PI) / 16),
    ]),
  }));
  loft(d, rings, m.blue, { caps: false });
  const outer = rings[0].points.map((q) => [...q, 0.22]),
    inner = outer.map((q) => [q[0] * 0.84, q[1] * 0.84, q[2]]);
  sheet(d, outer, m.metal, [0, 0, 1], [inner]);
  for (let j = 0; j < 32; j++)
    quad(
      d,
      inner[j],
      inner[(j + 1) % 32],
      [inner[(j + 1) % 32][0], inner[(j + 1) % 32][1], -0.12],
      [inner[j][0], inner[j][1], -0.12],
      m.dark,
      [0, 0, 1],
    );
  d.add(new T.CircleGeometry(0.55, 32), m.dark, [0, 0, -0.17]);
  ellipsoid(d, [0, 0, 0.12], [0.21, 0.21, 0.17], m.metal, 20);
  for (let j = 0; j < 9; j++) {
    const g = group(engine, `Beech18-cylinder-${side}-${j}`);
    g.rotation.z = (j * 2 * Math.PI) / 9;
    const cd = detailKit(g, g.name);
    cd.add(new T.CylinderGeometry(0.09, 0.085, 0.25, 12), m.dark, [0, 0.35, 0]);
    for (let y = 0.24; y < 0.49; y += 0.027)
      cd.add(new T.CylinderGeometry(0.105, 0.105, 0.008, 12), m.metal, [0, y, 0]);
    for (const a of [-1, 1]) cd.rod([a * 0.07, 0.15, 0.18], [a * 0.05, 0.45, 0.1], 0.012, m.metal);
    cd.finish();
  }
  for (const r of rings.slice(1, -1))
    outline(
      d,
      r.points.map((q) => [...q, r.z]),
      0.0018,
      m.metal,
    );
  for (let j = 0; j < 24; j++) {
    const a = (j * Math.PI) / 12;
    d.add(new T.SphereGeometry(0.003, 5, 3), m.metal, [
      0.646 * Math.sin(a),
      0.646 * Math.cos(a),
      -0.67,
    ]);
  }
  ellipsoid(d, [0, -0.61, -0.53], [0.15, 0.1, 0.26], m.blue, 14);
  d.rod([side * 0.39, -0.43, -0.7], [side * 0.52, -0.62, -1], 0.059, m.metal);
  d.add(new T.CircleGeometry(0.053, 16).rotateY(side * 0.4), m.dark, [side * 0.52, -0.62, -1.005]);
  d.finish();
  const prop = group(engine, `Beech18-propeller-${side}`, [0, 0, 0.43]),
    pd = detailKit(prop, prop.name);
  ellipsoid(pd, [0, 0, 0.05], [0.15, 0.15, 0.14], m.metal, 20);
  for (const sign of [-1, 1]) {
    const g = group(prop, `Beech18-blade-${side}-${sign}`);
    g.rotation.z = (sign === 1 ? 0 : Math.PI) + 0.6;
    const bd = detailKit(g, g.name),
      pts = [
        [0.13, -0.06, 0],
        [0.38, -0.11, 0.02],
        [1.16, -0.09, 0],
        [1.279, -0.04, -0.01],
        [1.295, 0, -0.01],
        [1.279, 0.04, -0.01],
        [1.16, 0.09, 0],
        [0.38, 0.11, -0.02],
        [0.13, 0.06, 0],
      ];
    sheet(bd, pts, m.metal, [0, 0, 1]);
    sheet(
      bd,
      pts.map((q) => [q[0], q[1], q[2] - 0.018]),
      m.dark,
      [0, 0, -1],
    );
    bd.box([0.075, 0.12, 0.02], [1.22, 0, 0], m.white);
    bd.finish();
  }
  pd.finish();
  return prop;
}
export function buildBeech18(s) {
  const root = new T.Group();
  root.name = s.slug;
  const body = group(root, 'Beech18-airframe'),
    m = {
      white: mat('Beech18-ivory', '#e4e4da', { side: T.DoubleSide }),
      blue: mat('Beech18-blue', '#214453', { side: T.DoubleSide }),
      dark: mat('Beech18-dark', '#222a2b', { side: T.DoubleSide }),
      metal: mat('Beech18-alloy', '#aeb7b6', { metalness: 0.75 }),
      rubber: mat('Beech18-tyre', '#1a1e20'),
    },
    glass = mat('Beech18-glass', '#a5bdc5', {
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.14,
    }),
    // Tinted passenger windows: the photos show them as dark panes with thin seals.
    tinted = mat('Beech18-cabin-glass', '#28333a', {
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      side: T.DoubleSide,
      metalness: 0.35,
      roughness: 0.1,
    }),
    d = detailKit(body, 'Beech18-shell'),
    bindings = [];
  // All stations are authored for the low-cabin D18S, not the taller E18S.
  const stations = [
    [190, 0.02, 1024, 1021],
    [215, 0.28, 1067, 988],
    [280, 0.49, 1090, 956],
    [365, 0.62, 1101, 940],
    [455, 0.69, 1103, 894],
    [535, 0.71, 1100, 881],
    [735, 0.7, 1114, 881],
    [865, 0.65, 1092, 880],
    [970, 0.57, 1075, 884],
    [1150, 0.4, 1040, 893],
    [1350, 0.22, 1000, 902],
    [1460, 0.09, 975, 907],
    [1480, 0.015, 945, 914],
  ]
    .map(([u, w, b, t]) => [zz(u), w, yy(b), yy(t)])
    .flatMap((s, i, list) => {
      // Midway stations along the tail cone (Catmull-Rom through the traced ones), so its
      // taper reads as a smooth curve rather than a few facets. Stations 0-9 are unchanged.
      if (i < 9 || i >= list.length - 1) return [s];
      const a = list[i - 1],
        c = list[i + 1],
        e = list[i + 2] ?? c;
      return [s, s.map((v, k) => (-a[k] + 9 * v + 9 * c[k] - e[k]) / 16)];
    });
  body.rotation.x = -angle;
  body.position.y = offset;
  // The nose is a rounded oval (E18S/SNB-1 front photos), not a box with small radii: the
  // nose rings are superellipses, and below the widest line every ring rounds under like the
  // photos' belly (fuller under the wing root). The cockpit and cabin keep their radiused roof,
  // which the low D18S cabin needs over the crew's heads.
  const superellipse = (w, y0, h, angles, n) =>
    angles.map((deg) => {
      const a = (deg * Math.PI) / 180;
      return [
        w * Math.pow(Math.abs(Math.sin(a)), 2 / n),
        y0 + Math.sign(Math.cos(a)) * h * Math.pow(Math.abs(Math.cos(a)), 2 / n),
      ];
    });
  const rings = stations.map(([z, w, b, t], i) => {
      const r = Math.min(0.22, w * 0.7),
        mid = (t + b) / 2,
        upper =
          i < 3
            ? superellipse(w, mid, (t - b) / 2, [28, 55, 78], 2.4)
            : i <= 4
              ? // Windscreen base and header keep the radiused box over the instrument panel.
                [
                  [w - r, t],
                  [w - r * 0.293, t - r * 0.293],
                  [w, t - r],
                ]
              : // Cockpit and cabin: a rounded roof (superellipse) over the window band, as in
                // the E18S/SNB-1 front photos, instead of a flat top with 0.22 m corner radii.
                superellipse(w, mid, (t - b) / 2, [16, 34, 62], 4),
        // Fuller under the cockpit and cabin floor (pedals, seat legs); rounder under the nose and
        // the tail cone.
        lower = superellipse(w, mid, (t - b) / 2, [90, 122, 152], i < 3 ? 2.6 : i < 9 ? 7 : 4);
      const right = [...upper, ...lower];
      return {
        z,
        points: [[0, t], ...right, [0, b], ...right.reverse().map(([x, y]) => [-x, y])],
      };
    }),
    p = (i, j) => [...rings[i].points[j], rings[i].z];
  loft(d, rings, m.white, {
    skip: (i, j) =>
      i === 0 ||
      (i === 3 && [0, 1, 12, 13].includes(j)) ||
      (i >= 3 && i <= 8 && [2, 3, 10, 11].includes(j)),
  });
  // Blunt rounded nose cap: an elliptical dome from the first ring to the tip, replacing the
  // short cone that read as a faceted point head-on.
  {
    const tip = [0, (stations[0][2] + stations[0][3]) / 2],
      first = rings[1];
    loft(
      d,
      [0, 25, 50, 70, 90].map((deg) => {
        const a = (deg * Math.PI) / 180,
          k = Math.cos(a);
        return {
          z: first.z + (stations[0][0] - first.z) * Math.sin(a),
          points: first.points.map(([x, y]) => [x * k, tip[1] + (y - tip[1]) * k]),
        };
      }),
      m.white,
      { caps: false },
    );
  }
  for (const j of [0, 1, 12, 13])
    quad(d, p(3, j), p(4, j), p(4, (j + 1) % 14), p(3, (j + 1) % 14), glass, [0, 1, 1]);
  for (const j of [0, 2, 12]) d.rod(p(3, j), p(4, j), 0.009, m.blue);
  for (const i of [3, 4])
    outline(d, [p(i, 12), p(i, 13), p(i, 0), p(i, 1), p(i, 2)], 0.008, m.white, false);
  const sample = (z, k) => {
    for (let i = 0; i < stations.length - 1; i++)
      if (z <= stations[i][0] && z >= stations[i + 1][0]) {
        const t = (stations[i][0] - z) / (stations[i][0] - stations[i + 1][0]);
        return stations[i][k] * (1 - t) + stations[i + 1][k] * t;
      }
    return stations.at(-1)[k];
  };
  // Skin half width at a station and height, so windows, doors and trim follow the skin.
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
    for (let k = 0; k < 7; k++)
      if (y <= q[k][1] && y >= q[k + 1][1]) return k + (y - q[k][1]) / (q[k + 1][1] - q[k][1] || 1);
    return y > q[0][1] ? 0 : 7;
  };
  const onBand = (side, z, v) => {
    const q = ringAt(z),
      k = Math.min(6, Math.floor(v)),
      f = v - k;
    return [
      side * (q[k][0] + (q[k + 1][0] - q[k][0]) * f),
      q[k][1] + (q[k + 1][1] - q[k][1]) * f,
      z,
    ];
  };
  const skinX = (z, y) => onBand(1, z, toV(z, y))[0];
  // The side band (columns 2-3: roof corner to the widest line, rings 3-9) around convex (z, v)
  // window apertures, by vertical decomposition, so every pane is a true opening in the loft's
  // own facets. It replaces one non-planar sheet whose long triangles crossed the cockpit
  // windows on the inside.
  const band = (side, windows) => {
    const parts = [],
      skin = { add: (geometry) => parts.push(geometry) },
      edges = windows.flatMap((w) => w.map((a, n) => [a, w[(n + 1) % w.length]]));
    for (let i = 3; i <= 8; i++)
      for (let k = 2; k <= 3; k++) {
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
                m.white,
                [side, 0, 0],
              );
            }
            if (g(sm) > low(sm)) low = g;
          }
        }
      }
    const merged = mergeGeometries(parts);
    d.add(smoothSurface(merged), m.white);
    merged.dispose();
    for (const geometry of parts) geometry.dispose();
  };
  // A (z, v) aperture on the skin, split where it crosses columns and stations.
  const aperture = (side, w) =>
    w.flatMap(([s0, v0], n) => {
      const [s1, v1] = w[(n + 1) % w.length],
        ts = [0];
      for (let k = 1; k <= 6; k++) if ((v0 - k) * (v1 - k) < 0) ts.push((k - v0) / (v1 - v0));
      for (const r of rings) if ((s0 - r.z) * (s1 - r.z) < 0) ts.push((r.z - s0) / (s1 - s0));
      return ts
        .sort((a, b) => a - b)
        .map((t) => onBand(side, s0 + (s1 - s0) * t, v0 + (v1 - v0) * t));
    });
  // Side-view (z, y) windows: two cockpit windows under the roof corner and five cabin windows.
  const window = (z, y, w, h) =>
    [
      [-w / 2, -h / 2],
      [-w / 2 + 0.055, -h / 2],
      [w / 2 - 0.055, -h / 2],
      [w / 2, -h / 2 + 0.055],
      [w / 2, h / 2 - 0.055],
      [w / 2 - 0.055, h / 2],
      [-w / 2 + 0.055, h / 2],
      [-w / 2, h / 2 - 0.055],
    ].map(([a, b]) => [z + a, y + b]);
  const apertures = [
    [
      [371, 941],
      [450, 897],
      [450, 960],
      [406, 963],
    ].map(([u, v]) => [zz(u), yy(v)]),
    [
      [462, 897],
      [531, 897],
      [531, 963],
      [461, 963],
    ].map(([u, v]) => [zz(u), yy(v)]),
    window(zz(595), yy(951), 0.49, 0.25),
    window(zz(703), yy(951), 0.49, 0.25),
    window(zz(815), yy(950), 0.49, 0.25),
    window(zz(911), yy(952), 0.23, 0.23),
    window(zz(1018), yy(944), 0.21, 0.21),
  ].map((w) => w.map(([z, y]) => [z, toV(z, y)]));
  for (const side of [-1, 1]) {
    const pt = (z, y, off = 0) => [side * (skinX(z, y) + off), y, z];
    band(side, apertures);
    const holes = apertures.map((w) => aperture(side, w));
    for (const [n, h] of holes.entries()) {
      sheet(d, h, n < 2 ? glass : tinted, [side, 0, 0]);
      outline(d, h, 0.005, m.blue);
    }
    for (let i = 0; i < stations.length - 1; i++) {
      const a = stations[i],
        b = stations[i + 1];
      // The cheat line rides just under the widest line, on the side rather than the round belly.
      const low = (q) => Math.max(q[2] + 0.25, (q[2] + q[3]) / 2 - 0.2);
      quad(
        d,
        pt(a[0], low(a), 0.004),
        pt(b[0], low(b), 0.004),
        pt(b[0], low(b) + 0.13, 0.004),
        pt(a[0], low(a) + 0.13, 0.004),
        m.blue,
        [side, 0, 0],
      );
    }
    const doorEdge = [
      [zz(458), 2.8],
      [zz(538), 2.8],
      [zz(538), 1.3],
      [zz(458), 1.3],
    ];
    outline(
      d,
      doorEdge.flatMap(([za, ya], n) => {
        const [zb, yb] = doorEdge[(n + 1) % 4],
          steps = Math.max(1, Math.ceil(Math.abs(yb - ya) / 0.08));
        return Array.from({ length: steps }, (_, k) =>
          pt(za + ((zb - za) * k) / steps, ya + ((yb - ya) * k) / steps, 0.003),
        );
      }),
      0.0022,
      m.dark,
    );
    d.rod(pt(zz(475), 2.16, 0.015), pt(zz(491), 2.16, 0.015), 0.011, m.metal);
    for (const z of [4.65, 3.7, 2.7, 1.8, 0.8, -0.2, -1.2, -2.2, -3.2]) {
      const b = sample(z, 2),
        t = sample(z, 3);
      for (let y = b + 0.08; y < t - 0.18; y += 0.09)
        d.add(new T.SphereGeometry(0.0028, 5, 3), m.metal, pt(z, y, 0.005));
    }
    for (const z of [4.7, 4.25, 3.27, -2, -3.3]) {
      const i = stations.findIndex((a) => a[0] === z);
      if (i >= 0)
        outline(
          d,
          rings[i].points.map((q) => [...q, z]),
          0.0014,
          m.metal,
        );
    }
    // Laid on the tapering tail cone (it was half buried in the skin ahead of its centre).
    const decal = group(body, `Beech18-decal-${side}`, [side * (sample(-2, 1) + 0.006), 2.29, -2]);
    decal.rotation.y = side * (Math.PI / 2 + Math.atan((sample(-1.7, 1) - sample(-2.3, 1)) / 0.6));
    const dd = detailKit(decal, decal.name);
    dd.text('D 18 S', [0, 0, 0], 0.11, 0, m.blue);
    dd.finish();
  }
  // Taper and six-degree dihedral checked against the manufacturer's wing dimensions. Wing height:
  // head-on photograph (VH-CII, prop hubs anchored) and the C-45 front silhouette both put the
  // upper surface level with the hubs at the nacelle, while hub and belly heights already matched.
  const span = 14.5288,
    wy = (x) => 1.65 + Math.tan(Math.PI / 30) * Math.max(0, x - 1.9685),
    lead = (x) => 3.4 - x * 0.205,
    trail = (x) => -0.032 + x * 0.12;
  for (const side of [-1, 1]) {
    wing(
      d,
      [
        // Root buried in the rounded belly, so the underside meets the skin without a slot.
        [side * 0.4, wy(0.4), lead(0.4), trail(0.4), 0.26],
        [side * 1.8, wy(1.8), lead(1.8), trail(1.8), 0.23],
        [side * 3.43, wy(3.43), lead(3.43), trail(3.43) + 0.42, 0.18],
        [side * 6.95, wy(6.95), lead(6.95), trail(6.95) + 0.3, 0.08],
        [side * 7.17, wy(7.17), 1.8, 0.89, 0.06],
        [(side * span) / 2, wy(span / 2), 1.48, 1.11, 0.025],
      ],
      m.white,
    );
    // Split flaps sit under the original trailing edge, as on the D18S.
    for (const [kind, a, b] of [
      ['flap', 0.74, 3.42],
      ['aileron', 3.48, 6.93],
    ]) {
      const g = group(body, `Beech18-${kind}-${side}`, [side * a, wy(a) - 0.03, trail(a) + 0.42]),
        cd = detailKit(g, g.name);
      wing(
        cd,
        [
          [0, 0, 0, -0.42, 0.015],
          [side * (b - a), wy(b) - wy(a), trail(b) - trail(a), trail(b) - trail(a) - 0.3, 0.012],
        ],
        m.blue,
      );
      for (let x = a + 0.12; x < b; x += 0.14)
        cd.rod(
          [side * (x - a), wy(x) - wy(a), trail(x) - trail(a) - 0.04],
          [side * (x - a), wy(x) - wy(a), trail(x) - trail(a) - 0.29],
          0.0018,
          m.metal,
        );
      cd.finish();
      bindings.push({
        node: g.name,
        source: kind === 'flap' ? 'flapPosition' : side === 1 ? 'aileronL' : 'aileronR',
        property: 'rotation',
        axis: 'x',
        scale: kind === 'flap' ? -Math.PI / 4 : 1,
      });
    }
    for (let x = 2.1; x < 6.8; x += 0.5)
      for (let t = 0.25; t < 0.8; t += 0.15)
        d.add(new T.SphereGeometry(0.0028, 5, 3), m.metal, [
          side * x,
          wy(x) + (0.23 - (x - 1.8) * 0.028) * (1 - (t - 0.25)),
          lead(x) - (lead(x) - trail(x)) * t,
        ]);
    ellipsoid(d, [side * 7.2, wy(7.2), 1.29], [0.04, 0.04, 0.07], side === 1 ? d.red : d.green, 8);
    // Long streamlined engine nacelles and partially exposed retractable main wheels.
    const ng = group(body, `Beech18-nacelle-${side}`, [side * 1.9685, engineY, 0]),
      nd = detailKit(ng, ng.name);
    loft(
      nd,
      [
        [3.25, 0.6, 0.57],
        [2.7, 0.6, 0.62],
        [2.1, 0.46, 0.55],
        [1.55, 0.22, 0.34],
        [1.25, 0.025, 0.06],
      ].map(([z, w, h]) => ({
        z,
        points: Array.from({ length: 24 }, (_, j) => [
          w * Math.sin((j * Math.PI) / 12),
          h * Math.cos((j * Math.PI) / 12),
        ]),
      })),
      m.white,
    );
    nd.finish();
    const gear = group(body, `Beech18-main-gear-${side}`, [side * 1.9685, 0.94, 2.84]),
      gd = detailKit(gear, gear.name);
    for (const sign of [-1, 1]) {
      gd.rod([sign * 0.14, 0, 0], [sign * 0.14, -0.55, 0.08], 0.041, m.metal);
      gd.rod([sign * 0.14, -0.15, -0.48], [sign * 0.14, -0.52, 0.08], 0.025, m.metal);
    }
    wheel(gd, [0, -0.57, 0.08], 0.35, 0.25, m.rubber, m.metal);
    gd.finish();
    bindings.push({
      node: gear.name,
      source: 'gearPosition',
      property: 'rotation',
      axis: 'x',
      scale: 1.32,
      offset: -1.32,
    });
    // Rounded twin fins, outboard rudders and full-span horizontal stabilizer.
    wing(
      d,
      [
        [side * 0.07, 2.6, -3.43, -4.56, 0.08],
        [side * 1.9, 2.6, -3.51, -4.56, 0.06],
        [side * 2.286, 2.6, -3.77, -4.56, 0.03],
      ],
      m.white,
    );
    const eg = group(body, `Beech18-elevator-${side}`, [side * 0.07, 2.6, -4.56]),
      ed = detailKit(eg, eg.name);
    wing(
      ed,
      [
        [0, 0, 0, -0.645, 0.025],
        [side * 1.83, 0, 0, -0.6, 0.025],
        [side * 2.216, 0, 0, -0.41, 0.015],
      ],
      m.blue,
    );
    for (let x = 0.15; x < 2.1; x += 0.14)
      ed.rod([side * x, 0.025, -0.06], [side * x, 0.01, -0.52], 0.002, m.metal);
    ed.finish();
    bindings.push({
      node: eg.name,
      source: 'elevatorAngle',
      property: 'rotation',
      axis: 'x',
      scale: 1,
    });
    // Twin fins and rudders are tapered sections (10 % of the combined chord, at most 0.11 m
    // thick), not constant-thickness slabs.
    const finOutline = [
        [1395, 916],
        [1404, 850],
        [1421, 802],
        [1450, 776],
        [1488, 769],
        [1490, 987],
        [1456, 979],
        [1420, 951],
      ].map(([u, v]) => [zz(u), yy(v)]),
      // Corner-cut twice so the elliptical Beech fins and rudders do not read as polygons; the
      // hinge line (fin points 4-5, rudder points 0-1) stays straight.
      roundOff = (outline, fixed) => {
        let pts = outline.map((p, i) => [p, fixed.includes(i)]);
        for (let pass = 0; pass < 2; pass++)
          pts = pts.flatMap(([p, keep], i) => {
            if (keep) return [[p, true]];
            const prev = pts[(i + pts.length - 1) % pts.length][0],
              next = pts[(i + 1) % pts.length][0];
            return [
              [p.map((v, k) => v + (prev[k] - v) * 0.25), false],
              [p.map((v, k) => v + (next[k] - v) * 0.25), false],
            ];
          });
        return pts.map(([p]) => p);
      },
      hinge = [yy(987), zz(1490)],
      rudderOutline = [
        [1490, 987],
        [1490, 769],
        [1520, 781],
        [1543, 813],
        [1561, 858],
        [1567, 912],
        [1558, 953],
        [1533, 980],
      ].map(([u, v]) => [zz(u) - hinge[1], yy(v) - hinge[0]]),
      finRound = roundOff(finOutline, [4, 5]),
      rudderRound = roundOff(rudderOutline, [0, 1]),
      chordOf = (outline, h) => {
        const [front, back] = chordAt(outline, h);
        return front - back;
      },
      finHalf = (h) =>
        Math.min(
          0.055,
          Math.max(0.012, 0.05 * (chordOf(finRound, h) + chordOf(rudderRound, h - hinge[0]))),
        ),
      rudderRib = (h) => {
        const half = finHalf(h + hinge[0]);
        return [h, ...chordAt(rudderRound, h), half * 0.5, half * 0.55, 0.003];
      };
    const fg = group(body, `Beech18-fin-${side}`, [side * 2.27, 0, 0]),
      fd = detailKit(fg, fg.name);
    foil(
      fd,
      outlineRibs(finRound).map(([h, f, b]) => [
        h,
        f,
        b,
        finHalf(h),
        finHalf(h) * 0.35,
        finHalf(h) * 0.55,
      ]),
      m.white,
    );
    fd.finish();
    const rg = group(body, `Beech18-rudder-${side}`, [side * 2.27, hinge[0], hinge[1]]),
      rd = detailKit(rg, rg.name);
    foil(
      rd,
      outlineRibs(rudderRound).map(([h]) => rudderRib(h)),
      m.blue,
    );
    for (let h = 0.15; h < 1.5; h += 0.14) {
      const rib = rudderRib(h);
      for (const a of [-1, 1])
        outline(
          rd,
          [-0.03, -0.1, -0.22, -0.29].map((z) => [a * (foilX(rib, z) + 0.002), h, z]),
          0.0018,
          m.metal,
          false,
        );
    }
    rd.finish();
    bindings.push({
      node: rg.name,
      source: 'yawInput',
      property: 'rotation',
      axis: 'y',
      scale: 0.4363,
    });
  }
  const tail = group(body, 'Beech18-tail-gear', [0, 2.205, -4.04]),
    td = detailKit(tail, tail.name);
  td.rod([0, 0.12, 0.1], [0, -0.3, 0], 0.03, m.metal);
  for (const sign of [-1, 1])
    td.rod([sign * 0.065, -0.24, 0], [sign * 0.065, -0.46, -0.13], 0.024, m.metal);
  wheel(td, [0, -0.47, -0.13], 0.18, 0.12, m.rubber, m.metal);
  td.finish();
  bindings.push({
    node: tail.name,
    source: 'gearPosition',
    property: 'rotation',
    axis: 'x',
    scale: -1.2,
    offset: 1.2,
  });
  const props = [radial(body, 1, m), radial(body, -1, m)];
  d.rod([0, 2.83, 2.75], [0, 3.1, 2.75], 0.012, m.metal);
  d.rod([0, 3.1, 2.75], [0, 3.1, 2.3], 0.008, m.dark);
  d.rod([0, 2.76, -0.9], [0, 2.98, -1], 0.01, m.metal);
  d.rod([0, 2.98, -1], [0, 2.52, -4.1], 0.0018, m.dark);
  for (const side of [-1, 1]) {
    d.rod([side * 0.03, 2.46, 3.86], [side * 0.4, 2.67, 3.51], 0.009, m.dark);
    d.rod([side * 0.3, 2.61, 3.62], [side * 0.54, 2.73, 3.35], 0.007, m.dark);
  }
  d.finish();
  const interior = beech18Cockpit(body, m);
  body.getObjectByName('cockpit').position.set(0, 0.55, 0.55);
  cleanGeometry(root);
  return {
    root,
    frame: beech18Frame(),
    enginePoints: [
      { id: 'engine-1', position: pose([1.9685, engineY, 4.0]) },
      { id: 'engine-2', position: pose([-1.9685, engineY, 4.0]) },
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
