/** Original DHC-2 Mk.I landplane, PSM 1-2-1 Fig 1-3/1-4/1-10.
 * Dimensions/contours are reference-authored; no photograph textures.
 */
import { smoothSurface } from '../surface-normals.mjs';
import { aircraftPanelTools as panelTools } from '../vehicle-interiors.mjs';
import { cockpitBulkhead, cockpitLiner } from './cockpit-fit.mjs';
import {
  bar,
  contour,
  lathe,
  loftUp,
  partPalette,
  place,
  roundedBox,
  switchGeometry,
  tube,
} from './cockpit-parts.mjs';
import { instrumentGeometry } from './instrument-geometry.mjs';
import {
  beveledBox,
  cleanGeometry,
  detailKit,
  ellipsoid,
  fittedFloor,
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
/** A kit proxy that draws each library part it receives at `at`, turned by `rotation` (library
 * parts draw at their own origin). */
const offsetKit = (d, at, rotation = [0, 0, 0]) => ({
  add: (geometry, material) => d.add(place(geometry, at, rotation), material),
});
/** A side profile [[z, y], ...] extruded across X (centred, `width` wide), its edges rounded by
 * `bevel`: the quadrant housing and its curved placards. */
function extrudeAcross(profile, width, bevel = 0.004, curve = 12) {
  const shape = new T.Shape(profile.map(([z, y]) => new T.Vector2(z, y)));
  const geometry = new T.ExtrudeGeometry(shape, {
    depth: Math.max(1e-5, width - 2 * bevel),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: curve,
    steps: 1,
  });
  geometry.deleteAttribute('uv');
  // Shape x becomes model z; the extrusion runs along -x, re-centred.
  geometry.rotateY(-Math.PI / 2).translate(width / 2 - bevel, 0, 0);
  const result = smoothSurface(geometry, 40);
  geometry.dispose();
  return result;
}
/** One Beaver rudder pedal at its pivot (the pad's middle): a cast pad leaned forward with a
 * rubber insert, a rounded toe bar and a heel cup, the toe-brake cylinder on its outboard edge,
 * and the arm running down through the toe board. `side` +1 is the pair's outboard (+X) pedal. */
function beaverPedal(d, side, metal) {
  const P = partPalette(),
    lean = 0.38,
    leaned = (geometry, at = [0, 0, 0], rotation = [0, 0, 0]) =>
      place(place(geometry, at, rotation), [0, 0, 0], [lean, 0, 0]);
  d.add(leaned(roundedBox([0.096, 0.125, 0.012], 0.012, 1)), metal);
  d.add(leaned(roundedBox([0.074, 0.074, 0.005], 0.008, 1), [0, -0.008, -0.007]), P.tread);
  d.add(leaned(bar([-0.042, 0.047, -0.01], [0.042, 0.047, -0.01], 0.0055, 12)), metal);
  d.add(leaned(roundedBox([0.1, 0.012, 0.034], 0.004, 1), [0, -0.064, -0.015]), metal);
  for (const s of [-1, 1])
    d.add(leaned(roundedBox([0.008, 0.03, 0.03], 0.003, 1), [s * 0.046, -0.05, -0.014]), metal);
  d.add(leaned(bar([side * 0.03, -0.02, 0.012], [side * 0.03, -0.1, 0.07], 0.0095, 12)), P.steel);
  d.add(leaned(bar([0, -0.04, 0.01], [0, -0.16, 0.06], 0.0085, 12)), P.alloy);
}
/** A section point `j` of ring `i`, moved `inset` into the cabin (inboard and down). */
const insetPoint = (rings, i, j, inset) => {
  const [x, y] = rings[i].points[j];
  return [x - Math.sign(x) * inset, y - inset, rings[i].z];
};
/** A headliner under the roof: the upper ring points `js` (side to side over the top) between
 * rings `from`..`to`, `inset` inside the skin, facing the cabin. */
function headliner(d, rings, from, to, js, material, inset = 0.012) {
  for (let i = from; i < to; i++)
    for (let k = 0; k < js.length - 1; k++) {
      const a = insetPoint(rings, i, js[k], inset),
        b = insetPoint(rings, i + 1, js[k], inset),
        c = insetPoint(rings, i + 1, js[k + 1], inset),
        e = insetPoint(rings, i, js[k + 1], inset);
      quad(d, a, b, c, e, material, [-(a[0] + c[0]) / 2, -0.3, 0]);
    }
}
/** A faired leg from a to b: an elliptical section `thick` across and `chord` fore and aft,
 * tapering to `taper` of its size at b. */
function fairedLeg(d, a, b, thick, chord, taper, material) {
  const from = new T.Vector3(...a),
    v = new T.Vector3(...b).sub(from),
    geometry = new T.CylinderGeometry(taper, 1, v.length(), 16, 1).scale(thick, 1, chord),
    mesh = d.add(geometry, material, from.clone().addScaledVector(v, 0.5).toArray());
  // Keep the chord fore and aft: yaw the leg into the plane of the segment, then tilt it.
  const sideways = new T.Vector3(v.x, v.y, 0).normalize(),
    roll = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), sideways),
    pitch = new T.Quaternion().setFromUnitVectors(sideways, v.clone().normalize());
  mesh.quaternion.copy(pitch.multiply(roll));
  return mesh;
}
/** Front and back z of a side-view outline [[z, y], ...] at height y (0 width outside it). */
/** The lofted skin's ring at station z (linear between the authored rings). */
function ringAt(rings, z) {
  let i = rings.findIndex((r, n) => n < rings.length - 1 && z <= r.z && z >= rings[n + 1].z);
  if (i < 0) i = z > rings[0].z ? 0 : rings.length - 2;
  const a = rings[i].points,
    b = rings[i + 1].points,
    u = Math.min(1, Math.max(0, (z - rings[i].z) / (rings[i + 1].z - rings[i].z)));
  return a.map((q, j) => [q[0] + (b[j][0] - q[0]) * u, q[1] + (b[j][1] - q[1]) * u]);
}
/** Skin half width at station z and height y; cabin trim and seats are kept inside it. */
function skinHalfWidth(rings, z, y) {
  const q = ringAt(rings, z);
  let x = 0;
  for (let j = 0; j < q.length; j++) {
    const [ax, ay] = q[j],
      [bx, by] = q[(j + 1) % q.length];
    if ((ay - y) * (by - y) <= 0 && ay !== by)
      x = Math.max(x, Math.abs(ax + ((bx - ax) * (y - ay)) / (by - ay)));
  }
  return x;
}
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

const angle = Math.atan2(54, 325),
  ppm = 444 / 9.2456,
  zz = (u) => 4.6228 - (u - 461) / ppm,
  yy = (v) => (1306 - v) / ppm,
  groundOffset = -Math.sin(angle) * zz(543);
const pose = (p) =>
  new T.Vector3(...p)
    .applyAxisAngle(new T.Vector3(1, 0, 0), -angle)
    .add(new T.Vector3(0, groundOffset, 0))
    .toArray();
export const beaverFrame = () => ({
  heli: false,
  fighter: false,
  large: false,
  radius: 0.75,
  cy: 1.7,
  ry: 0.9,
  cabinZ: pose([0, 2.585, 2.33])[2],
  cabinWidth: 1.4,
  // The front seats sit high behind the radial: the eye clears the cowl/windscreen-frame
  // sightline straight ahead and sits at the top of the crew-door window (N72355 photo), not
  // against the roof above all the glazing.
  eye: pose([0.34, 2.585, 2.33]),
  panelZ: pose([0, 2.1, 3.14])[2],
  floor: 1.04,
});
const rect = (x, y, w, h, z) => [
  [x - w / 2, y - h / 2, z],
  [x + w / 2, y - h / 2, z],
  [x + w / 2, y + h / 2, z],
  [x - w / 2, y + h / 2, z],
];
export function buildBeaver(s) {
  const root = new T.Group();
  root.name = s.slug;
  const airframe = group(root, 'Beaver-airframe', [0, groundOffset, 0]);
  airframe.rotation.x = -angle;
  const paint = mat('Beaver-ivory', '#dfdfd5', { side: T.DoubleSide }),
    accent = mat('Beaver-burgundy', '#8b322b', { side: T.DoubleSide }),
    metal = mat('Beaver-alloy', '#a6aeae', { metalness: 0.75 }),
    dark = mat('Beaver-trim', '#252c2e', { side: T.DoubleSide }),
    rubber = mat('Beaver-tyre', '#1b2021'),
    glass = mat('Beaver-glazing', '#a8c6ce', {
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.14,
    });
  const d = detailKit(airframe, 'Beaver-shell'),
    bindings = [];
  const stations = [
    [521, 0.68, 1258, 1195],
    [531, 0.71, 1258, 1190],
    [555, 0.735, 1258, 1170],
    [576, 0.75, 1258, 1169],
    [632, 0.68, 1258, 1180],
    [660, 0.6, 1255, 1183],
    [692, 0.5, 1251, 1186],
    [753, 0.32, 1246, 1192],
    [813, 0.18, 1238, 1191],
    [866, 0.1, 1231, 1210],
    [905, 0.012, 1222, 1219],
  ]
    .map(([u, w, b, t]) => [zz(u), w, yy(b), yy(t)])
    .flatMap((s, i, list) => {
      // Midway stations along the tail cone (Catmull-Rom through the traced ones), so its
      // taper reads as a smooth curve rather than a few facets. Stations 0-7 are unchanged.
      if (i < 7 || i >= list.length - 1) return [s];
      const a = list[i - 1],
        c = list[i + 1],
        e = list[i + 2] ?? c;
      return [s, s.map((v, k) => (-a[k] + 9 * v + 9 * c[k] - e[k]) / 16)];
    });
  const rings = stations.map(([z, w, b, t]) => {
      const h = t - b;
      return {
        z,
        points: [
          [0, t],
          [w * 0.65, t - 0.015 * h],
          [w * 0.94, t - 0.11 * h],
          [w, t - 0.26 * h],
          [w, b + 0.21 * h],
          [w * 0.8, b + 0.05 * h],
          [w * 0.4, b],
          [0, b],
          [-w * 0.4, b],
          [-w * 0.8, b + 0.05 * h],
          [-w, b + 0.21 * h],
          [-w, t - 0.26 * h],
          [-w * 0.94, t - 0.11 * h],
          [-w * 0.65, t - 0.015 * h],
        ],
      };
    }),
    p = (i, j) => [...rings[i].points[j], rings[i].z];
  loft(d, rings, paint, {
    skip: (i, j) =>
      (i === 1 && [0, 1, 12, 13].includes(j)) || (i >= 1 && i <= 5 && [2, 3, 10, 11].includes(j)),
  });
  for (const j of [0, 1, 12, 13])
    quad(d, p(1, j), p(2, j), p(2, (j + 1) % 14), p(1, (j + 1) % 14), glass, [0, 1, 1]);
  for (const j of [0, 2, 12]) d.rod(p(1, j), p(2, j), 0.012, dark);
  for (const i of [1, 2])
    outline(d, [p(i, 12), p(i, 13), p(i, 0), p(i, 1), p(i, 2)], 0.013, paint, false);
  const sample = (z, k) => {
    for (let i = 0; i < stations.length - 1; i++)
      if (z <= stations[i][0] && z >= stations[i + 1][0]) {
        const t = (stations[i][0] - z) / (stations[i][0] - stations[i + 1][0]);
        return stations[i][k] * (1 - t) + stations[i + 1][k] * t;
      }
    return stations.at(-1)[k];
  };
  const sideWalls = [];
  for (const side of [-1, 1]) {
    const pt = (z, y, off = 0) => [side * (sample(z, 1) + off), y, z],
      // Crew-door window: from the roof rail down to the belt line, its front edge raked behind
      // the windscreen frame and reaching aft past the pilot's head (Kenmore Air N72355 photo).
      // It was a low quadrilateral wholly ahead of the pilot, who saw only the door post.
      h1 = [
        [540, 1212],
        [556, 1181],
        [559, 1180],
        [574, 1180],
        [576, 1182],
        [576, 1209],
        [574, 1211],
      ].map(([u, v]) => pt(zz(u), yy(v))),
      // Cabin-door window: vertical front edge, level top, raked rear edge and rounded
      // corners (U-6A 41707 photo); it sits in the upper side like the crew window.
      h2 = [
        [588, 1211],
        [588, 1192],
        [590, 1188],
        [595, 1187],
        [612, 1187],
        [616, 1189],
        [626, 1209],
        [625, 1213],
        [621, 1214],
        [591, 1214],
      ].map(([u, v]) => pt(zz(u), yy(v))),
      h3 = Array.from({ length: 20 }, (_, j) =>
        pt(
          zz(644) + Math.sin((j * Math.PI) / 10) * 0.135,
          yy(1197) + Math.cos((j * Math.PI) / 10) * 0.135,
        ),
      );
    const upper = side > 0 ? 2 : 12,
      lower = side > 0 ? 4 : 10;
    const wall = [
      ...[1, 2, 3, 4, 5, 6].map((i) => p(i, upper)),
      ...[6, 5, 4, 3, 2, 1].map((i) => p(i, lower)),
    ];
    sheet(d, wall, paint, [side, 0, 0], [h1, h2, h3]);
    // The cabin lines this side inside (beaverCockpit), with the same window openings.
    sideWalls.push({ side, wall, holes: [h1, h2, h3] });
    for (const h of [h1, h2, h3]) {
      sheet(d, h, glass, [side, 0, 0]);
      outline(d, h, 0.005, dark);
    }
    for (const a of [
      [
        [534, 1200],
        [552, 1182],
        [579, 1182],
        [579, 1253],
        [538, 1255],
      ],
      [
        [582, 1187],
        [633, 1189],
        [633, 1252],
        [588, 1254],
      ],
    ])
      outline(
        d,
        a.map(([u, v]) => pt(zz(u), yy(v), 0.003)),
        0.0025,
        dark,
      );
    d.rod(pt(zz(568), yy(1239), 0.02), pt(zz(560), yy(1239), 0.02), 0.012, metal);
    for (let i = 0; i < stations.length - 1; i++) {
      const a = stations[i],
        b = stations[i + 1];
      quad(
        d,
        pt(a[0], a[2] + 0.12, 0.003),
        pt(b[0], b[2] + 0.12, 0.003),
        pt(b[0], b[2] + 0.28, 0.003),
        pt(a[0], a[2] + 0.28, 0.003),
        accent,
        [side, 0, 0],
      );
    }
    for (const z of [1.9, 1.1, 0.3, -0.5, -1.4, -2.3, -3.2]) {
      const b = sample(z, 2),
        t = sample(z, 3);
      d.rod(pt(z, b + 0.08, 0.003), pt(z, t - 0.2, 0.003), 0.0014, metal);
      for (let y = b + 0.13; y < t - 0.2; y += 0.095)
        d.add(new T.SphereGeometry(0.0028, 5, 3), metal, pt(z + 0.018, y, 0.005));
    }
    // Registrations, titles and serials are livery markings (scripts/liveries/aircraft/dhc-2.mjs),
    // not lettering baked into the skin.
    d.rod([side * 0.8, 1.05, 1.05], [side * 0.97, 0.76, 1.1], 0.02, metal);
    d.rod([side * 0.97, 0.76, 1.1], [side * 0.97, 0.76, 0.7], 0.02, metal);
    d.rod([side * 0.97, 0.76, 0.7], [side * 0.8, 1.05, 0.7], 0.02, metal);
  }
  // Open radial cowling, recessed nine-cylinder Wasp Junior, visible cooling fins and pushrods.
  const engine = group(airframe, 'engine-1', [0, 1.65, 3.96]),
    nd = detailKit(engine, 'Beaver-engine');
  const ns = [
    [0.26, 0.575],
    [0.18, 0.66],
    [-0.1, 0.68],
    [-0.64, 0.68],
    [-0.74, 0.65],
  ].map(([z, r]) => ({
    z,
    points: Array.from({ length: 32 }, (_, j) => [
      Math.sin((j * Math.PI) / 16) * r,
      Math.cos((j * Math.PI) / 16) * r,
    ]),
  }));
  loft(nd, ns, paint, { caps: false });
  const outer = ns[0].points.map((q) => [...q, 0.26]),
    inner = ns[0].points.map((q) => [q[0] * 0.83, q[1] * 0.83, 0.26]);
  sheet(nd, outer, metal, [0, 0, 1], [inner]);
  for (let j = 0; j < 32; j++)
    quad(
      nd,
      inner[j],
      inner[(j + 1) % 32],
      [inner[(j + 1) % 32][0], inner[(j + 1) % 32][1], -0.08],
      [inner[j][0], inner[j][1], -0.08],
      dark,
      [0, 0, 1],
    );
  nd.add(new T.CircleGeometry(0.56, 32), dark, [0, 0, -0.18]);
  ellipsoid(nd, [0, 0, 0.13], [0.21, 0.21, 0.18], metal, 20);
  for (let j = 0; j < 9; j++) {
    const g = group(engine, `Beaver-cylinder-${j}`);
    g.rotation.z = (j * 2 * Math.PI) / 9;
    const dd = detailKit(g, g.name);
    dd.add(new T.CylinderGeometry(0.09, 0.085, 0.25, 12), dark, [0, 0.36, 0]);
    for (let y = 0.26; y < 0.49; y += 0.025)
      dd.add(new T.CylinderGeometry(0.105, 0.105, 0.008, 12), metal, [0, y, 0]);
    dd.rod([-0.07, 0.16, 0.17], [-0.05, 0.45, 0.1], 0.012, metal);
    dd.rod([0.07, 0.16, 0.17], [0.05, 0.45, 0.1], 0.012, metal);
    dd.finish();
  }
  for (const r of ns.slice(1, -1))
    outline(
      nd,
      r.points.map((q) => [...q, r.z]),
      0.0018,
      metal,
    );
  for (let j = 0; j < 12; j++) {
    const a = (j * Math.PI) / 6;
    nd.add(new T.SphereGeometry(0.003, 5, 3), metal, [
      Math.sin(a) * 0.684,
      Math.cos(a) * 0.684,
      -0.61,
    ]);
  }
  ellipsoid(nd, [0, -0.69, -0.5], [0.23, 0.12, 0.35], accent, 14);
  nd.rod([0.29, -0.46, -0.7], [0.42, -0.69, -0.95], 0.065, metal);
  nd.add(new T.CircleGeometry(0.055, 16).rotateY(0.6), dark, [0.42, -0.69, -0.96]);
  nd.finish();
  const prop = group(engine, 'Beaver-propeller', [0, 0, 0.44]),
    pd = detailKit(prop, prop.name);
  ellipsoid(pd, [0, 0, 0.11], [0.15, 0.15, 0.24], metal, 20);
  for (const side of [-1, 1]) {
    const bg = group(prop, `Beaver-prop-blade-${side}`);
    bg.rotation.z = side === 1 ? 0.72 : 0.72 + Math.PI;
    const bd = detailKit(bg, bg.name),
      pts = [
        [0.12, -0.06, 0],
        [0.42, -0.1, 0.02],
        [1.19, -0.065, 0],
        [1.295, -0.025, 0],
        [1.295, 0.025, 0],
        [1.19, 0.065, 0],
        [0.5, 0.09, -0.02],
        [0.12, 0.06, 0],
      ];
    sheet(bd, pts, metal, [0, 0, 1]);
    sheet(
      bd,
      pts.map((q) => [q[0], q[1], q[2] - 0.018]),
      dark,
      [0, 0, -1],
    );
    bd.box([0.075, 0.1, 0.02], [1.24, 0, 0], paint);
    bd.finish();
  }
  pd.finish();
  const wy = (x) => 2.74 + Math.tan((2 * Math.PI) / 180) * Math.max(0, x - 0.73);
  for (const side of [-1, 1]) {
    wing(
      d,
      [
        [side * 0.7, wy(0.7), 2.7, 1.47, 0.14],
        [side * 6.94, wy(6.94), 2.7, 1.47, 0.13],
        [side * 7.18, wy(7.18), 2.59, 1.43, 0.11],
        [side * 7.315, wy(7.315), 2.35, 1.33, 0.06],
      ],
      paint,
    );
    for (const [kind, a, b] of [
      ['flap', 0.78, 4.2],
      ['aileron', 4.24, 6.94],
    ]) {
      const g = group(airframe, `Beaver-${kind}-${side}`, [side * a, wy(a), 1.47]),
        dd = detailKit(g, g.name);
      wing(
        dd,
        [
          [0, 0, 0, -0.42, 0.027],
          [side * (b - a), wy(b) - wy(a), 0, -0.42, 0.024],
        ],
        accent,
      );
      for (let x = a + 0.12; x < b; x += 0.13)
        dd.rod([side * (x - a), 0.02, -0.03], [side * (x - a), 0.008, -0.38], 0.002, metal);
      dd.finish();
      bindings.push({
        node: g.name,
        source: kind === 'flap' ? 'flapPosition' : `aileron${side > 0 ? 'L' : 'R'}`,
        property: 'rotation',
        axis: 'x',
        scale: kind === 'flap' ? -0.55 : 1,
      });
    }
    for (let x = 0.95; x < 6.9; x += 0.42)
      for (let u = 0.12; u < 0.8; u += 0.13) {
        const h = 0.135 * (u < 0.25 ? u / 0.25 : 1 - (u - 0.25) * 0.96);
        d.add(new T.SphereGeometry(0.003, 5, 3), metal, [
          side * x,
          wy(x) + h + 0.003,
          2.7 - u * 1.23,
        ]);
      }
    const a = new T.Vector3(side * 0.72, 1.02, 0.92),
      b = new T.Vector3(side * 3.0, wy(3) - 0.06, 1.98);
    // Streamlined lift strut (elliptical section, chord fore and aft), not a square box.
    fairedLeg(d, a.toArray(), b.toArray(), 0.035, 0.11, 1, accent);
    d.rod([side * 1.95, 2.1, 1.6], [side * 1.95, wy(1.95) - 0.03, 1.6], 0.015, metal);
    ellipsoid(d, [side * 7.28, wy(7.28), 1.75], [0.04, 0.04, 0.07], side > 0 ? d.red : d.green, 8);
    wing(
      d,
      [
        [side * 0.12, 1.89, -3.78, -4.23, 0.075],
        [side * 2.27, 1.89, -3.43, -4.05, 0.067],
        [side * 2.413, 1.89, -3.6, -4.05, 0.045],
      ],
      paint,
    );
    const eg = group(airframe, `Beaver-elevator-${side}`, [side * 0.12, 1.89, -4.23]),
      ed = detailKit(eg, eg.name);
    wing(
      ed,
      [
        [0, 0, 0, -0.35, 0.022],
        [side * 2.15, 0, 0.18, -0.16, 0.019],
      ],
      accent,
    );
    for (let x = 0.15; x < 2.15; x += 0.13)
      ed.rod([side * x, 0.018, 0.08 * x - 0.025], [side * x, 0.005, 0.08 * x - 0.3], 0.002, metal);
    ed.finish();
    bindings.push({
      node: eg.name,
      source: 'pitchInput',
      property: 'rotation',
      axis: 'x',
      scale: 0.35,
    });
  }
  // Full de Havilland dorsal fillet and a fin that reaches the horn-balanced rudder; traced
  // from the USAF L-20A three-view in flight datum (the old fin top sat 0.16 m low). The
  // rounded top carries its chord further forward, as in the N130WA and 41707 side photos.
  const fin = [
      [-0.8, 2.38],
      [-1.5, 2.4],
      [-1.95, 2.53],
      [-2.39, 2.7],
      [-2.68, 2.86],
      [-2.95, 3.09],
      [-3.15, 3.36],
      [-3.29, 3.6],
      [-3.56, 3.6],
      [-3.56, 2.1],
    ],
    rudderOutline = [
      [0, 0],
      [0, 1.5],
      [0.26, 1.5],
      [0.21, 1.61],
      [0.05, 1.735],
      [-0.12, 1.79],
      [-0.29, 1.76],
      [-0.44, 1.61],
      [-0.58, 1.36],
      [-0.69, 1.0],
      [-0.75, 0.41],
      [-0.745, 0.17],
      [-0.73, 0.04],
    ],
    span = (outline, y) => {
      const [front, back] = chordAt(outline, y);
      return front - back;
    },
    // Tapered sections (12 % of the combined chord, at most 0.12 m thick), not slabs; the horn
    // balance above the fin is a rounded section of its own.
    finHalf = (y) =>
      Math.min(0.06, Math.max(0.012, 0.06 * (span(fin, y) + span(rudderOutline, y - 2.1)))),
    rudderRib = (y) => {
      const h = finHalf(y + 2.1),
        [front, back] = chordAt(rudderOutline, y);
      return y > 1.5
        ? [y, front, back, h * 0.7, h * 0.25, 0.003]
        : [y, front, back, h * 0.5, h * 0.55, 0.003];
    };
  foil(
    d,
    outlineRibs(fin).map(([y, f, b]) => [
      y,
      f,
      b,
      finHalf(y),
      finHalf(y) * 0.35,
      finHalf(y) * 0.55,
    ]),
    paint,
  );
  const rud = group(airframe, 'Beaver-rudder', [0, 2.1, -3.56]),
    g = group(rud, 'Beaver-rudder-moving'),
    rd = detailKit(g, g.name);
  foil(
    rd,
    [...outlineRibs(rudderOutline).map(([y]) => y), 1.499, 1.501]
      .sort((a, b) => a - b)
      .map(rudderRib),
    accent,
  );
  for (let y = 0.13; y < 1.45; y += 0.12) {
    const rib = rudderRib(y),
      end = -(0.71 - 0.39 * y);
    outline(
      rd,
      [-0.03, end * 0.3, end * 0.75, end].map((z) => [foilX(rib, z) + 0.002, y, z]),
      0.002,
      metal,
      false,
    );
  }
  rd.finish();
  bindings.push({ node: g.name, source: 'yawInput', property: 'rotation', axis: 'y', scale: 0.42 });
  // Fixed wheel geometry is authored in flight datum, then rigidly posed against the
  // manual's sloping ground line. All three tyres meet the local ground in that stance.
  for (const side of [-1, 1]) {
    const x = side * 1.5494,
      z = zz(543),
      r = 0.292;
    const gd = detailKit(group(airframe, `Beaver-main-gear-${side}`), 'Beaver-main-gear');
    // Faired oleo leg (streamlined, deeper fore and aft than across), not a round tube.
    fairedLeg(gd, [side * 0.64, 1.07, z - 0.08], [x, r + 0.1, z], 0.065, 0.17, 0.7, accent);
    gd.rod([side * 0.68, 1.08, z - 0.9], [x, r + 0.05, z], 0.045, metal);
    wheel(gd, [x, r, z], r, 0.2, rubber, metal, dark);
    gd.finish();
  }
  const tailZ = zz(869),
    tailY = (0.16 - groundOffset - Math.sin(angle) * tailZ) / Math.cos(angle),
    td = detailKit(group(airframe, 'Beaver-tailwheel'), 'Beaver-tailwheel');
  td.rod([0, yy(1235), tailZ + 0.24], [0, tailY + 0.18, tailZ], 0.038, metal);
  for (const side of [-1, 1])
    td.rod([side * 0.075, tailY + 0.2, tailZ + 0.05], [side * 0.075, tailY, tailZ], 0.019, metal);
  wheel(td, [0, tailY, tailZ], 0.16, 0.12, rubber, metal);
  td.finish();
  d.rod([0, 2.93, 2.05], [0, 3.15, 2.02], 0.014, dark);
  d.rod([0, 3.15, 2.02], [0, 3.58, -3.5], 0.002, dark);
  d.finish();
  const { stations: controlStations, ...interior } = beaverCockpit(
    airframe,
    { paint, accent, metal, dark },
    rings,
    sideWalls,
  );
  Object.assign(interior.derived, {
    aileronDroop: { op: 'multiply', args: ['flapPosition', -0.18] },
    rollLeft: { op: 'multiply', args: ['rollInput', -0.32] },
    rollRight: { op: 'multiply', args: ['rollInput', 0.32] },
    aileronL: { op: 'add', args: ['aileronDroop', 'rollLeft'] },
    aileronR: { op: 'add', args: ['aileronDroop', 'rollRight'] },
  });
  cleanGeometry(root);
  return {
    root,
    frame: { ...beaverFrame(), controlStations },
    enginePoints: [{ id: 'engine-1', position: pose([0, 1.65, 3.96]) }],
    visual: {
      rotors: [{ node: prop.name, engine: 'engine-1', axis: 'z', multiplier: 1 }],
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
function beaverCockpit(root, m, sections, sideWalls) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'Beaver-cockpit'),
    pt = panelTools(d),
    ins = instrumentGeometry(cabin, 'Beaver'),
    { bindings, derived, ink, black } = ins;
  const face = mat('Beaver-panel', '#87948e'),
    // Sidewall trim: a warm grey vinyl, darker than the ivory paint it covers.
    liner = mat('Beaver-liner', '#8f8b7e'),
    seat = mat('Beaver-upholstery', '#655c4f');
  const k = 0.00165,
    x = (u) => (542 - u) * k,
    y = (v) => 2.12 + (540 - v) * k,
    z = 3.14,
    at = (u, v, dz = 0) => [x(u), y(v), z + dz];
  const edge = [
    [162, 780],
    [160, 550],
    [177, 515],
    [244, 491],
    [452, 460],
    // The centre block rises above the quadrant for the manifold-pressure and RPM gauges
    // (N4787C photo).
    [458, 458],
    [460, 398],
    [468, 388],
    [616, 388],
    [624, 398],
    [626, 453],
    [716, 469],
    [890, 501],
    [919, 540],
    [915, 780],
  ].map((q) => at(...q));
  sheet(d, edge, face, [0, 0, -1], [rect(x(350), y(562), 0.083, 0.083, z)]);
  sheet(
    d,
    edge.map((q) => [q[0], q[1], q[2] + 0.12]),
    black,
    [0, 0, 1],
  );
  // The coaming is the panel's own grey paint: no separate black hood.
  outline(d, edge.slice(1, -1), 0.021, face, false);
  quad(
    d,
    [-0.62, 2.14, z],
    [0.62, 2.14, z],
    // The coaming runs forward under the cowl; its corners stood out of the cowl sides.
    [Math.min(0.65, skinHalfWidth(sections, 3.32, 2.24) - 0.025), 2.24, 3.32],
    [-Math.min(0.65, skinHalfWidth(sections, 3.32, 2.24) - 0.025), 2.24, 3.32],
    face,
    [0, 1, 0],
  );
  // Raised six-pack on pilot's left, blank copilot map panel, engine stack at center.
  for (const [u, v, w, h] of [
    [338, 591, 220, 172],
    [739, 595, 214, 170],
  ]) {
    sheet(
      d,
      rect(x(u), y(v), w * k, h * k, z - 0.006),
      m.dark,
      [0, 0, -1],
      u === 338 ? [rect(x(350), y(562), 0.086, 0.086, z - 0.006)] : [],
    );
    outline(d, rect(x(u), y(v), w * k + 0.008, h * k + 0.008, z - 0.008), 0.003, m.metal);
  }
  const sources = {};
  for (const [name, component, path] of [
    ['trueAirspeed', 'aircraftState', ['airspeed']],
    ['altitude', 'transform', ['pos', 1]],
    ['yaw', 'aircraftState', ['yaw']],
    ['pitch', 'aircraftState', ['pitch']],
    ['roll', 'aircraftState', ['roll']],
    ['verticalSpeed', 'aircraftState', ['verticalSpeed']],
    ['yawRate', 'aircraftState', ['yawRate']],
    ['flapPosition', 'aircraftState', ['flapPosition']],
    ['engine1', 'aircraftState', ['engines', 'engine-1', 'rpm']],
    ['pitchInput', 'aircraftInput', ['pitch']],
    ['rollInput', 'aircraftInput', ['roll']],
    ['yawInput', 'aircraftInput', ['yaw']],
    ['power', 'aircraftInput', ['power']],
  ])
    sources[name] = { component, path };
  Object.assign(derived, {
    mph: { op: 'multiply', args: ['trueAirspeed', 3600 / 1609.344] },
    feet: { op: 'divide', args: ['altitude', 0.3048] },
    verticalFpm: { op: 'multiply', args: ['verticalSpeed', 60 / 0.3048] },
    northYaw: { op: 'subtract', args: [Math.PI, 'yaw'] },
    trueHeading: { op: 'modulo', args: ['northYaw', Math.PI * 2] },
    engineRpm: { op: 'multiply', args: ['engine1', 2300] },
    // Positive turning right, so the needle leans into the turn (yawRate is positive left).
    turnDegrees: { op: 'multiply', args: ['yawRate', -180 / Math.PI] },
  });
  ins.dial(
    'speed',
    at(280, 573, -0.014),
    0.046,
    'mph',
    [
      [0, 0],
      [25, 0.5],
      [50, 1.1],
      [75, 1.7],
      [100, 2.3],
      [125, 2.9],
      [150, 3.5],
      [175, 4.1],
      [200, 4.7],
      [225, 5.3],
      [250, 5.9],
    ],
    [0, 50, 100, 150, 200, 250],
    'TAS MPH',
    { responseSeconds: 0.2 },
  );
  ins.horizon('attitude', at(350, 562, 0.011), 0.083, 0.083, { round: true, blankBackdrop: true });
  d.ring(0.046, 0.003, at(350, 562, -0.014), m.metal);
  ins.dial(
    'vsi',
    at(421, 573, -0.014),
    0.044,
    'verticalFpm',
    [
      [-2000, -2.4],
      [0, 0],
      [2000, 2.4],
    ],
    [-2000, -1000, 0, 1000, 2000],
    'FT MIN',
    { responseSeconds: 0.5 },
  );
  ins.altimeter('altimeter', at(280, 640, -0.014), 0.045, 'feet');
  ins.headingDrum('heading', at(350, 640, -0.014), 0.042, 'trueHeading');
  ins.dial(
    'turn',
    at(421, 640, -0.014),
    0.043,
    'turnDegrees',
    [
      [-6, -0.6],
      [0, 0],
      [6, 0.6],
    ],
    [-3, 0, 3],
    'TURN DEG S',
    { responseSeconds: 0.2 },
  );
  d.text('SIM DATUM', at(350, 602, -0.02), 0.006, Math.PI, ink, 'display');
  // Late installation engine instrument positions, as the manual explicitly permits.
  const panel = rect(x(542), y(670), 0.255, 0.34, z - 0.012);
  sheet(d, panel, face, [0, 0, -1]);
  outline(d, panel, 0.003, m.metal);
  // Manifold pressure and RPM: the two big dials on the raised centre block above the quadrant,
  // either side of the throttle slot (N4787C photo).
  pt.gauge(x(503), y(424), z - 0.014, 0.044, undefined, false);
  d.text('MAN PRESS', at(503, 438, -0.024), 0.0055, Math.PI, ink);
  d.text('--', at(503, 410, -0.024), 0.007, Math.PI, ink);
  ins.dial(
    'rpm',
    at(581, 424, -0.0085),
    0.044,
    'engineRpm',
    [
      [0, 0],
      [500, 0.9],
      [1000, 1.8],
      [1500, 2.7],
      [2000, 3.6],
      [2500, 4.5],
    ],
    [0, 500, 1000, 1500, 2000, 2500],
    'RPM',
    { responseSeconds: 0.2 },
  );
  for (const [u, v, label] of [
    [509, 704, 'OIL --'],
    [576, 704, 'FUEL --'],
    [509, 758, 'CARB --'],
    [576, 758, 'CHT --'],
  ]) {
    pt.gauge(x(u), y(v), z - 0.025, v === 758 ? 0.034 : 0.041, undefined, false);
    d.text(label, at(u, v, -0.049), 0.008, Math.PI, ink);
  }
  // The de Havilland quadrant at the panel centre (N4787C photo): a grey housing standing out of
  // the panel, its top rolling over aft, three curved black placards with the lever slots, a
  // bright trim band and three friction knobs on its face. The throttle arm is thrown out to the
  // pilot's side under a black ball; the prop lever carries a paddle, the mixture a black knob.
  const P = partPalette();
  const q = group(cabin, 'Beaver-quadrant', [0, 2.11, 2.99]),
    qd = detailKit(q, q.name);
  const arc = (r, from, to, count = 10) =>
    Array.from({ length: count + 1 }, (_, i) => {
      const a = from + ((to - from) * i) / count;
      return [-r * Math.sin(a), r * Math.cos(a)];
    });
  // The panel face is 0.15 m ahead of the group; the housing's back rests on it.
  qd.add(
    extrudeAcross(
      [[0.147, -0.078], [0.147, 0.07], ...arc(0.07, 0, Math.PI / 2), [-0.07, -0.078]],
      0.25,
      0.005,
    ),
    face,
  );
  const travel = [0.004, 1.35];
  for (const [i, xx, label, source] of [
    [0, 0.09, 'THROTTLE', 'power'],
    [1, 0, 'PROP', null],
    [2, -0.09, 'MIXTURE', null],
  ]) {
    // Curved placard (housing surface is r 0.075 after its bevel) with the slot and a white
    // arrow line along it.
    const band = [
      [0.04, 0.0772],
      ...arc(0.0772, 0, travel[1]),
      ...arc(0.0756, travel[1], 0),
      [0.04, 0.0756],
    ];
    qd.add(place(extrudeAcross(band, 0.044, 0), [xx, 0, 0]), m.dark);
    qd.add(
      tube(
        [[xx, 0.0776, 0.03], ...arc(0.0776, travel[0], 0.75, 6).map(([zz, yy]) => [xx, yy, zz])],
        0.0032,
        10,
      ),
      black,
    );
    qd.add(
      tube(
        arc(0.0776, 0.25, travel[1] - 0.2, 6).map(([zz, yy]) => [xx + 0.013, yy, zz]),
        0.0008,
        6,
      ),
      ink,
    );
    qd.text(label, [xx, -0.011, -0.0757], 0.0055, Math.PI, ink);
    // Friction knob under each slot.
    qd.add(
      place(
        lathe(
          [
            [0, 0],
            [0.013, 0],
            [0.0145, 0.004],
            [0.0138, 0.012],
            [0.009, 0.0155],
            [0, 0.0162],
          ],
          16,
        ).rotateX(-Math.PI / 2),
        [xx, -0.056, -0.075],
      ),
      black,
    );
    const g = group(q, `Beaver-quadrant-${i}`, [xx, 0.05, 0]),
      dd = detailKit(g, g.name);
    // Flat alloy lever raked toward the pilot, out of the slot.
    const top = [0, 0.1, -0.034],
      tilt = Math.atan2(top[2], top[1]),
      length = Math.hypot(top[1], top[2]);
    dd.add(
      place(
        roundedBox([0.0075, length, 0.013], 0.002, 1),
        [0, top[1] / 2, top[2] / 2],
        [tilt, 0, 0],
      ),
      m.metal,
    );
    if (i === 0) {
      dd.add(bar(top, [0.074, top[1] + 0.006, top[2] - 0.006], 0.0048, 14), m.metal);
      dd.add(new T.SphereGeometry(0.019, 18, 12), P.black, [0.088, top[1] + 0.008, top[2] - 0.008]);
    } else if (i === 1)
      dd.add(
        place(roundedBox([0.046, 0.022, 0.012], 0.005), [0, top[1] + 0.01, top[2]], [tilt, 0, 0]),
        P.black,
      );
    else
      dd.add(
        place(
          lathe(
            [
              [0.004, 0],
              [0.011, 0.002],
              [0.0155, 0.008],
              [0.0158, 0.019],
              [0.012, 0.025],
              [0, 0.026],
            ],
            18,
          ),
          top,
          [tilt, 0, 0],
        ),
        P.black,
      );
    dd.finish();
    if (source)
      bindings.push({ node: g.name, source, property: 'rotation', axis: 'x', scale: 0.65 });
  }
  qd.add(place(roundedBox([0.236, 0.012, 0.004], 0.0018), [0, -0.03, -0.0765]), m.metal);
  qd.finish();
  ins.pointer('flap-indicator', at(412, 485, -0.025), 0.022, 'flapPosition', [
    [0, -1.1],
    [1, 1.1],
  ]);
  d.text('FLAPS', at(412, 466, -0.026), 0.007, Math.PI, ink);
  // Radios and electrical switchboard below the copilot map storage recess.
  for (const [v, label] of [
    [711, 'COM --'],
    [737, 'NAV --'],
  ]) {
    d.box([0.31, 0.032, 0.018], at(746, v, -0.02), black);
    for (const u of [661, 827]) pt.knob(x(u), y(v), z - 0.038, 0.008);
    d.text(label, at(746, v, -0.032), 0.009, Math.PI, ink);
  }
  for (let i = 0; i < 10; i++) {
    const u = 638 + i * 25;
    // Bat-handle toggles on the panel face (they floated 3-4 cm proud of it as bare rods).
    switchGeometry(offsetKit(d, at(u, 768, -0.0005)), { style: 'toggle' });
    d.text(['BAT', 'GEN', 'PITOT', 'LTS', 'NAV'][i % 5], at(u, 754, -0.002), 0.0045, Math.PI, ink);
  }
  for (const [u, v, w, h, label] of [
    [229, 719, 70, 63, 'FUEL'],
    [324, 719, 95, 63, 'CHECKLIST'],
    [420, 719, 75, 63, 'IGNITION'],
  ]) {
    d.box([w * k, h * k, 0.012], at(u, v, -0.014), m.dark);
    // The ignition (magneto) switch is a control station with its own legend (end of function).
    if (label === 'IGNITION') continue;
    d.text(label, at(u, v - 14, -0.025), 0.008, Math.PI, ink);
    if (label !== 'CHECKLIST') pt.knob(x(u), y(v + 5), z - 0.04, 0.018);
    else
      for (let j = 0; j < 5; j++)
        d.rod(at(u - 35, v - 4 + j * 7, -0.025), at(u + 35, v - 4 + j * 7, -0.025), 0.0008, ink);
  }
  // Throw-over column and one control wheel, neutral left seat configuration.
  // A grey column out of a rubber boot on the toe board, a cast elbow, and the throw-over arm
  // curving up and across to the wheel hub (N4787C photo: painted tube arm).
  const col = group(cabin, 'Beaver-column', [0, 1.41, 2.62]),
    cd = detailKit(col, col.name);
  cd.add(
    lathe(
      [
        [0, -0.275],
        [0.062, -0.275],
        [0.058, -0.258],
        [0.045, -0.248],
        [0.043, -0.232],
        [0.034, -0.222],
        [0.033, -0.206],
        [0.03, -0.195],
        [0, -0.195],
      ],
      18,
      28,
    ),
    P.tread,
  );
  cd.add(bar([0, -0.21, 0], [0, 0.4, 0], 0.025, 16), P.steel);
  cd.add(
    lathe(
      [
        [0, 0.38],
        [0.031, 0.38],
        [0.034, 0.405],
        [0.03, 0.44],
        [0, 0.45],
      ],
      16,
    ),
    P.steel,
  );
  cd.add(
    tube(
      [
        [0, 0.42, 0],
        [0.035, 0.49, 0.004],
        [0.13, 0.585, 0.016],
        [0.27, 0.65, 0.03],
        [0.365, 0.668, 0.036],
      ],
      0.02,
      14,
    ),
    P.steel,
  );
  cd.finish();
  bindings.push({
    node: col.name,
    source: 'pitchInput',
    property: 'rotation',
    axis: 'x',
    scale: -0.14,
  });
  // The DHC wheel: a boss, two spokes to a dished lower bar, and two horns wrapped in leather.
  const wheel = group(col, 'Beaver-wheel', [0.38, 0.67, 0.02]),
    wd = detailKit(wheel, wheel.name);
  wd.add(
    lathe(
      [
        [0, 0],
        [0.031, 0],
        [0.033, 0.012],
        [0.03, 0.03],
        [0.022, 0.038],
        [0, 0.04],
      ],
      18,
    )
      .rotateX(-Math.PI / 2)
      .translate(0, 0, 0.016),
    m.dark,
  );
  wd.add(
    tube(
      [
        [-0.168, 0.004, -0.012],
        [-0.15, -0.05, -0.012],
        [-0.075, -0.072, -0.01],
        [0.075, -0.072, -0.01],
        [0.15, -0.05, -0.012],
        [0.168, 0.004, -0.012],
      ],
      0.0125,
      14,
    ),
    m.dark,
  );
  for (const s of [-1, 1]) {
    wd.add(
      tube(
        [
          [0, 0, -0.008],
          [s * 0.04, -0.035, -0.009],
          [s * 0.075, -0.07, -0.01],
        ],
        0.0105,
        12,
      ),
      m.dark,
    );
    const sections = [
      [0, 0.0128],
      [0.012, 0.0158],
      [0.04, 0.0168],
      [0.07, 0.0166],
      [0.09, 0.0148],
      [0.1, 0.0095],
      [0.104, 0.004],
    ];
    wd.add(
      place(
        loftUp(sections.map(([yy, r]) => ({ y: yy, points: contour(0, 0, r, r * 1.12, 16, 2.1) }))),
        [s * 0.168, 0.002, -0.012],
        [0, 0, -s * 0.14],
      ),
      seat,
    );
  }
  wd.finish();
  bindings.push({
    node: wheel.name,
    source: 'rollInput',
    property: 'rotation',
    axis: 'z',
    scale: 0.65,
  });
  // Roof trim handwheels, floor flap pump and oil filler are modeled as mechanical details.
  for (const x of [-0.045, 0.045])
    d.add(new T.TorusGeometry(0.058, 0.008, 10, 32).rotateY(Math.PI / 2), black, [x, 2.73, 2.28]);
  d.add(new T.TorusGeometry(0.048, 0.007, 10, 32).rotateY(Math.PI / 2), black, [0, 2.73, 2.05]);
  // Hydraulic hand pump between the seats: the barrel lies on the floor, the long handle rises
  // inboard of the right seat to a rubber grip; the flap selector on the panel picks the
  // direction (FLAPS placard, flap indicator above the six-pack).
  d.add(bar([-0.14, 1.118, 2.34], [-0.14, 1.118, 2.07], 0.027, 16), m.metal);
  d.add(bar([-0.14, 1.118, 2.07], [-0.14, 1.118, 2.04], 0.02, 16), m.metal);
  d.add(roundedBox([0.07, 0.03, 0.05], 0.006), m.metal, [-0.14, 1.1, 2.2]);
  d.add(
    tube(
      [
        [-0.14, 1.118, 2.34],
        [-0.12, 1.1, 2.42],
        [-0.05, 1.1, 2.5],
      ],
      0.005,
      8,
    ),
    m.dark,
  );
  const pump = group(cabin, 'Beaver-flap-pump', [-0.14, 1.11, 2.2]),
    fd = detailKit(pump, pump.name);
  fd.add(
    lathe(
      [
        [0, -0.016],
        [0.02, -0.016],
        [0.02, 0.016],
        [0, 0.016],
      ],
      16,
    ).rotateZ(Math.PI / 2),
    m.metal,
  );
  fd.add(
    tube(
      [
        [0, 0, 0],
        [0.012, 0.2, -0.065],
        [0.066, 0.47, -0.135],
      ],
      0.0105,
      14,
    ),
    m.metal,
  );
  const gripAxis = new T.Vector3(0.054, 0.27, -0.07).normalize();
  fd.add(
    lathe(
      [
        [0, 0],
        [0.015, 0],
        [0.0175, 0.008],
        [0.0178, 0.07],
        [0.015, 0.082],
        [0, 0.084],
      ],
      16,
    ).applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), gripAxis)),
    black,
    [0.064, 0.46, -0.133],
  );
  fd.finish();
  bindings.push({
    node: pump.name,
    source: 'flapPosition',
    property: 'rotation',
    axis: 'x',
    scale: 0.45,
  });
  d.add(new T.CylinderGeometry(0.067, 0.067, 0.06, 20), m.accent, [-0.2, 1.14, 2.65]);
  fittedFloor(d, sections, m.dark, { y: 1.09, front: 3.2, back: 0.025, width: 1.33 });
  // Raised toe board: the pedals come up with the high front seats.
  sheet(
    d,
    [
      [-0.62, 1.09, 2.5],
      [0.62, 1.09, 2.5],
      [0.62, 1.34, 3.1],
      [-0.62, 1.34, 3.1],
    ].map(([x, y, zz]) => [
      Math.sign(x) * Math.min(0.62, skinHalfWidth(sections, zz, y) - 0.025),
      y,
      zz,
    ]),
    m.dark,
    [0, 1, -1],
  );
  for (const side of [-1, 1]) {
    d.add(bar([side * 0.67, 1.68, 2.6], [side * 0.67, 1.68, 2.12], 0.021, 14), m.dark);
    for (const sign of [-1, 1]) {
      const pedal = group(cabin, `Beaver-pedal-${side}-${sign}`, [
          side * 0.33 + sign * 0.09,
          1.4,
          3.02,
        ]),
        dd = detailKit(pedal, pedal.name);
      beaverPedal(dd, sign, m.metal);
      dd.finish();
      bindings.push({
        node: pedal.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        // Right rudder pushes the right pedal (-X) forward.
        scale: -sign * 0.04,
      });
    }
  }
  // The rear bench sits where the cabin narrows and the belly rises: a narrower pair, a little
  // forward, keeps it inside the skin (full-size seats stood out of both sides).
  for (const [x, z, w] of [
    [0.34, 2.16, 0.48],
    [-0.34, 2.16, 0.48],
    [0.34, 1.15, 0.48],
    [-0.34, 1.15, 0.48],
    [0.265, 0.4, 0.4],
    [-0.265, 0.4, 0.4],
  ]) {
    const lift = z > 2 ? 0.41 : 0,
      n = w / 0.48;
    beveledBox(d, [w, 0.11, 0.45], [x, 1.32 + lift, z], seat, 0.04);
    beveledBox(d, [0.46 * n, 0.6, 0.13], [x, 1.65 + lift, z - 0.2], seat, 0.04);
    for (const side of [-1, 1])
      d.rod(
        [x + side * 0.19 * n, z < 1 ? 1.17 : 1.09, z],
        [x + side * 0.19 * n, 1.28 + lift, z],
        0.018,
        m.metal,
      );
    d.rod([x - 0.2 * n, 1.4 + lift, z - 0.14], [x + 0.18 * n, 1.4 + lift, z + 0.13], 0.013, liner);
    d.box([0.05, 0.014, 0.03], [x + 0.04, 1.415 + lift, z + 0.04], m.metal);
  }
  // Fit the cockpit to the airframe: a grey glare-shield face from the panel top up to the
  // windscreen sill and the grey-green firewall below it close the fuselage just ahead of the
  // panel, and trimmed liners run along both sides from the floor to under the windows, so no
  // ivory skin shows round the panel, in the footwells or along the sidewalls.
  cockpitBulkhead(d, root, { z: 3.18, yFrom: 1.96, yTo: 2.42, material: face });
  cockpitBulkhead(d, root, { z: 3.18, yFrom: 1.08, yTo: 1.96, material: face });
  cockpitLiner(d, root, {
    zFrom: 0,
    zTo: 3.17,
    yFrom: 1.1,
    yTo: 1.31,
    material: liner,
    zSteps: 12,
    ySteps: 3,
  });
  // The flat sides above, with the door and cabin windows cut through and a dark reveal round
  // each opening.
  for (const { side, wall, holes } of sideWalls) {
    const inboard = ([px, py, pz]) => [px - side * 0.012, py, pz];
    sheet(
      d,
      wall.map(inboard),
      liner,
      [-side, 0, 0],
      holes.map((h) => h.map(inboard)),
    );
    for (const h of holes) outline(d, h.map(inboard), 0.006, m.dark);
  }
  // Headliner from the windscreen's aft frame back over the cabin, and dark trim inside both
  // windscreen frames (they are painted ivory outside).
  headliner(d, sections, 2, 6, [2, 1, 0, 13, 12], liner);
  // The front frame is seen from behind and above, the aft one from below: each trim sits on the
  // face the pilot sees.
  for (const [i, dy, dz] of [
    [1, -0.004, -0.016],
    [2, -0.015, -0.004],
  ])
    outline(
      d,
      [12, 13, 0, 1, 2].map((j) => {
        // Kept inside the skin and under the glass: 0.015 inboard of the sides.
        const [px, py, pz] = insetPoint(sections, i, j, 0.015);
        return [px, py + 0.015 + dy, pz + dz];
      }),
      0.012,
      m.dark,
      false,
    );
  d.finish();
  // Where the real controls are (PSM 1-2-1 panel diagram): the ignition switch on the lower left
  // panel, the parking brake pull handle under the panel's lower edge. Stations are in the model
  // frame, so they follow the airframe's tail-down pose.
  const mount = (point) => ({ at: pose(point), rotation: [-angle, 0, 0] });
  const stations = [
    {
      action: 'engine',
      style: 'rotary',
      ...mount(at(420, 726, -0.0205)),
      label: 'IGNITION',
      labelAt: [0, 0.03, -0.002],
    },
    {
      action: 'brake',
      style: 'tee',
      ...mount(at(229, 768, -0.001)),
      label: 'PARK BRAKE',
      labelAt: [-0.064, -0.002, -0.002],
      labelHeight: 0.0065,
    },
  ];
  return { nodes: ['cockpit'], sources, derived, bindings, stations };
}
