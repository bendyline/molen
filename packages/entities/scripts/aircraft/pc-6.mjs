/** PC-6/B2-H4, analog panel. Pilatus drawing 190.000.1711 and Luigi Rosa cockpit photo.
 * Original meter-scale geometry; reference pixels are never embedded in the GLB. */
import { aircraftPanelTools as panelTools } from '../vehicle-interiors.mjs';
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

const angle = Math.atan2(98, 512),
  ppm = 1161 / 10.9;
const unpose = (p) => new T.Vector3(...p).applyAxisAngle(new T.Vector3(1, 0, 0), angle).toArray();
const pose = (p) => new T.Vector3(...p).applyAxisAngle(new T.Vector3(1, 0, 0), -angle).toArray();
const fromSide = (u, v, x = 0) => unpose([x, (671 - v) / ppm, 5.45 - (u - 412) / ppm]);
export const porterFrame = () => ({
  heli: false,
  fighter: false,
  large: false,
  radius: 0.635,
  cy: 1.3,
  ry: 0.75,
  cabinZ: pose([0.3, 1.99, 2.1])[2],
  cabinWidth: 1.16,
  eye: pose([0.3, 1.99, 2.1]),
  panelZ: pose([0, 1.37, 2.65])[2],
  floor: 0.59,
});
export function buildPorter(s) {
  const root = new T.Group();
  root.name = s.slug;
  const body = group(root, 'Porter-airframe');
  body.rotation.x = -angle;
  const white = mat('Porter-ivory', '#e3e3d6', { side: T.DoubleSide }),
    red = mat('Porter-red', '#b3392a', { side: T.DoubleSide }),
    dark = mat('Porter-trim', '#262b2c', { side: T.DoubleSide }),
    metal = mat('Porter-alloy', '#aeb4b4', { metalness: 0.75 }),
    rubber = mat('Porter-tyre', '#1b2021'),
    glass = mat('Porter-glazing', '#a8c4cd', {
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.13,
    }),
    d = detailKit(body, 'Porter-shell'),
    bindings = [];
  // Flight-datum sections: narrower engine wall, 1270mm cabin, 415mm rear frame,
  // and 140mm tail termination. Rounded corners remain deliberately faceted.
  const stations = [
    [5.34, 0.29, 0.73, 1.29],
    [5.22, 0.355, 0.69, 1.36],
    [4.51, 0.47, 0.58, 1.4],
    [3.05, 0.635, 0.59, 1.63],
    [2.61, 0.635, 0.59, 1.71],
    [2.2, 0.635, 0.59, 2.065],
    [1.76, 0.635, 0.59, 2.065],
    [-0.36, 0.635, 0.59, 2.05],
    [-1.48, 0.51, 0.81, 2.02],
    [-2.7, 0.35, 1.07, 1.99],
    [-3.96, 0.2075, 1.3, 1.951],
    [-4.81, 0.07, 1.4, 1.786],
    [-5.12, 0.035, 1.54, 1.68],
  ];
  // The PT6 cowl rings blend from the radiused box toward a superellipse (the Turbo-Porter's long
  // nose is rounded over the top and chin in the front photos); the cabin keeps its box section.
  const roundness = [0.75, 0.75, 0.55, 0.25];
  const sections = stations.map(([z, w, b, t], i) => {
      const r = Math.min(0.15, w * 0.65, (t - b) * 0.22),
        k = roundness[i] ?? 0,
        c = (t + b) / 2,
        h = (t - b) / 2,
        right = [
          [0, t],
          [w - r, t],
          [w - r * 0.293, t - r * 0.293],
          [w, t - r],
          [w, b + r],
          [w - r * 0.293, b + r * 0.293],
          [w - r, b],
          [0, b],
        ].map(([x, y], j) => {
          const a = ([0, 32, 58, 78, 102, 122, 148, 180][j] * Math.PI) / 180,
            q = Math.cos(a);
          return [
            x + (w * Math.pow(Math.sin(a), 2 / 2.6) - x) * k,
            y + (c + Math.sign(q) * h * Math.pow(Math.abs(q), 2 / 2.6) - y) * k,
          ];
        });
      return {
        z,
        points: [
          ...right,
          ...right
            .slice(1, 7)
            .reverse()
            .map(([x, y]) => [-x, y]),
        ],
      };
    }),
    p = (i, j) => [...sections[i].points[j], sections[i].z];
  loft(d, sections, white, {
    skip: (i, j) =>
      (i === 4 && [0, 1, 2, 11, 12, 13].includes(j)) || (i >= 4 && i <= 6 && [3, 10].includes(j)),
  });
  for (const j of [0, 1, 2, 11, 12, 13])
    quad(d, p(4, j), p(5, j), p(5, (j + 1) % 14), p(4, (j + 1) % 14), glass, [0, 1, 1]);
  for (const j of [0, 3, 11]) d.rod(p(4, j), p(5, j), 0.013, dark);
  for (const i of [4, 5])
    outline(
      d,
      [p(i, 11), p(i, 12), p(i, 13), p(i, 0), p(i, 1), p(i, 2), p(i, 3)],
      0.013,
      white,
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
  // Skin half width at height y, so trim on the rounded cowl follows the skin.
  const skinX = (z, y) => {
    let i = sections.findIndex(
      (s, n) => n < sections.length - 1 && z <= s.z && z >= sections[n + 1].z,
    );
    if (i < 0) i = z > sections[0].z ? 0 : sections.length - 2;
    const u = (z - sections[i].z) / (sections[i + 1].z - sections[i].z),
      q = sections[i].points.map((a, j) => [
        a[0] + (sections[i + 1].points[j][0] - a[0]) * u,
        a[1] + (sections[i + 1].points[j][1] - a[1]) * u,
      ]);
    for (let j = 0; j < 7; j++)
      if ((y - q[j][1]) * (y - q[j + 1][1]) <= 0 && q[j][1] !== q[j + 1][1])
        return q[j][0] + ((q[j + 1][0] - q[j][0]) * (y - q[j][1])) / (q[j + 1][1] - q[j][1]);
    return sample(z, 1);
  };
  for (const side of [-1, 1]) {
    // Windows and door seams stay on the flat cabin side; stripes and rivets follow the skin.
    const pt = (z, y, offset = 0) => [side * (skinX(z, y) + offset), y, z],
      flat = (z, y, offset = 0) => [side * (sample(z, 1) + offset), y, z],
      pix = (u, v, offset = 0) => {
        const q = fromSide(u, v);
        return flat(q[2], q[1], offset);
      };
    // Tall cockpit-door window (Turbo-Porter 3-view) and the two large D-shaped cabin-door
    // windows with rounded outer top corners (OE-EMD and PH-LLL photos), 0.55 by 0.44 m, level
    // in the flight datum and kept below the roof-shoulder radius so occupants see out through
    // them; they were small chamfered octagons.
    const dWindow = (zc, forward) => {
      const w = 0.55,
        h = 0.44,
        yc = 1.665,
        corner = (cz, cy, r, a0) =>
          [0, 1, 2, 3].map((k) => {
            const a = a0 + (k * Math.PI) / 6;
            return [cz + r * Math.cos(a), cy + r * Math.sin(a)];
          }),
        big = 0.13,
        small = 0.03,
        front = forward ? big : small,
        rear = forward ? small : big;
      // Counter-clockwise from the lower front corner in (z, y).
      return [
        ...corner(zc + w / 2 - small, yc - h / 2 + small, small, -Math.PI / 2),
        ...corner(zc + w / 2 - front, yc + h / 2 - front, front, 0),
        ...corner(zc - w / 2 + rear, yc + h / 2 - rear, rear, Math.PI / 2),
        ...corner(zc - w / 2 + small, yc - h / 2 + small, small, Math.PI),
      ].map(([z, y]) => flat(z, y));
    };
    const win = [
      [
        [770, 439],
        [776, 432],
        [809, 430],
        [815, 436],
        [806, 501],
        [799, 507],
        [774, 507],
        [768, 501],
      ].map((q) => pix(...q)),
      dWindow(1.37, true),
      dWindow(0.57, false),
    ];
    const q = fromSide(1048, 497),
      rr = 0.12;
    win.push(
      Array.from({ length: 20 }, (_, i) =>
        flat(q[2] + Math.sin((i * Math.PI) / 10) * rr, q[1] + Math.cos((i * Math.PI) / 10) * rr),
      ),
    );
    sheet(
      d,
      [
        ...[4, 5, 6, 7].map((i) => p(i, side > 0 ? 3 : 11)),
        ...[7, 6, 5, 4].map((i) => p(i, side > 0 ? 4 : 10)),
      ],
      white,
      [side, 0, 0],
      win,
    );
    for (const h of win) {
      sheet(d, h, glass, [side, 0, 0]);
      outline(d, h, 0.0045, dark);
    }
    for (const a of [
      [
        [753, 453],
        [813, 426],
        [832, 446],
        [814, 548],
        [752, 530],
      ],
      [
        [847, 446],
        [1009, 467],
        [1015, 501],
        [1000, 582],
        [835, 553],
      ],
    ])
      outline(
        d,
        a.map((q) => pix(...q, 0.004)),
        0.0025,
        dark,
      );
    d.rod(pix(836, 445, 0.018), pix(1060, 468, 0.018), 0.012, metal);
    d.rod(pix(840, 556, 0.016), pix(1001, 585, 0.016), 0.012, metal);
    d.rod(pix(806, 508, 0.019), pix(816, 511, 0.019), 0.011, metal);
    // Lower red band in four strips that follow the rounded cowl; on the cabin it sits on the
    // flat side just above the lower corner radius.
    for (let i = 2; i < stations.length - 1; i++)
      for (let k = 0; k < 4; k++) {
        const a = stations[i],
          b = stations[i + 1],
          lo = 0.15 + k * 0.055,
          hi = lo + 0.055;
        quad(
          d,
          pt(a[0], a[2] + lo, 0.005),
          pt(b[0], b[2] + lo, 0.005),
          pt(b[0], b[2] + hi, 0.005),
          pt(a[0], a[2] + hi, 0.005),
          red,
          [side, 0, 0],
        );
      }
    for (const z of [4.48, 3.8, 3.05, 1.5, 0.65, -0.36, -1.48, -2.7, -3.96]) {
      const b = sample(z, 2),
        t = sample(z, 3);
      d.rod(pt(z, b + 0.08, 0.004), pt(z, t - 0.17, 0.004), 0.0013, metal);
      for (let y = b + 0.14; y < t - 0.18; y += 0.08)
        d.add(new T.SphereGeometry(0.0028, 5, 3), metal, pt(z + 0.017, y, 0.005));
    }
    for (let z = 4.5; z > -4.8; z -= 0.16) {
      const b = sample(z, 2);
      d.add(new T.SphereGeometry(0.0028, 5, 3), metal, pt(z, b + 0.065, 0.005));
    }
    for (const z of [2.1, 0.83]) {
      d.rod([side * 0.63, 0.62, z], [side * 0.85, 0.33, z], 0.022, metal);
      d.rod([side * 0.85, 0.33, z], [side * 0.85, 0.33, z - 0.4], 0.02, metal);
      d.rod([side * 0.85, 0.33, z - 0.4], [side * 0.63, 0.62, z - 0.4], 0.022, metal);
    }
    const label = group(body, `Porter-label-${side}`, [side * 0.47, 1.33, -1.45]);
    label.rotation.y = (side * Math.PI) / 2;
    const ld = detailKit(label, label.name);
    ld.text('PC 6', [0, 0, 0], 0.16, 0, dark);
    ld.finish();
  }
  // PT6 cowling intake and exhaust outlets, three-blade Hartzell silhouette.
  const ep = fromSide(450, 458),
    engine = group(body, 'engine-1', ep),
    nd = detailKit(engine, 'Porter-nose');
  // Pointed conical spinner with slightly convex flanks (3-view and photos), not an egg.
  nd.add(
    new T.LatheGeometry(
      [0, 0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1].map(
        (t, i) => new T.Vector2(i ? 0.205 * Math.pow(1 - t, 0.62) : 0, 0.68 * t - 0.34),
      ),
      24,
    ).rotateX(Math.PI / 2),
    metal,
    [0, 0, 0.18],
  );
  // PT6 inlet under the spinner: a rounded mouth with a thick white lip around a dark duct set
  // 6 cm back, rather than a flat dark plate on the cowl face (N365BT/OE-EMD photos).
  const intake = Array.from({ length: 24 }, (_, i) => {
      const a = (i * Math.PI) / 12,
        c = Math.cos(a),
        s = Math.sin(a);
      return [
        0.17 * Math.sign(c) * Math.pow(Math.abs(c), 0.6),
        -0.33 + 0.14 * Math.sign(s) * Math.pow(Math.abs(s), 0.6),
        -0.03,
      ];
    }),
    duct = intake.map(([x, y, z]) => [x * 0.85, -0.33 + (y + 0.33) * 0.8, z - 0.06]);
  sheet(nd, duct, dark, [0, 0, 1]);
  for (let i = 0; i < intake.length; i++) {
    const n = (i + 1) % intake.length;
    quad(nd, intake[i], intake[n], duct[n], duct[i], dark, [
      -intake[i][0],
      -intake[i][1] - 0.33,
      0,
    ]);
  }
  outline(nd, intake, 0.022, white);
  for (const side of [-1, 1]) {
    const ex = group(engine, `Porter-exhaust-${side}`, [side * 0.32, 0.05, -0.36]);
    ex.rotation.y = side * 0.9;
    const ed = detailKit(ex, ex.name),
      ss = [
        [0.16, 0.078, 0.06],
        [0.02, 0.13, 0.1],
        [-0.25, 0.15, 0.17],
      ].map(([z, w, h]) => ({
        z,
        points: Array.from({ length: 20 }, (_, i) => [
          Math.sin((i * Math.PI) / 10) * w,
          Math.cos((i * Math.PI) / 10) * h,
        ]),
      }));
    loft(ed, ss, metal, { caps: false });
    ed.add(new T.CircleGeometry(0.073, 20), dark, [0, 0, 0.13]);
    ed.finish();
  }
  nd.finish();
  const prop = group(engine, 'Porter-propeller'),
    pd = detailKit(prop, prop.name);
  for (let i = 0; i < 3; i++) {
    const bg = group(prop, `Porter-blade-${i}`);
    bg.rotation.z = (i * Math.PI * 2) / 3;
    const bd = detailKit(bg, bg.name),
      a = [
        // 2.56 m (101 in) three-blade Hartzell disc.
        [0.14, -0.06, 0],
        [0.48, -0.085, 0.02],
        [1.1, -0.06, 0.01],
        [1.28, -0.025, 0],
        [1.28, 0.025, 0],
        [1.07, 0.07, -0.015],
        [0.48, 0.09, -0.025],
        [0.14, 0.06, 0],
      ];
    sheet(bd, a, dark, [0, 0, 1]);
    sheet(
      bd,
      a.map((p) => [p[0], p[1], p[2] - 0.018]),
      dark,
      [0, 0, -1],
    );
    bd.box([0.065, 0.07, 0.022], [1.235, 0, 0], white);
    bd.finish();
  }
  pd.finish();
  // 1.98m constant chord; four independent flap leaves and outer ailerons.
  for (const side of [-1, 1]) {
    wing(
      d,
      [
        [side * 0.62, 2.08, 2.12, 0.64, 0.145],
        [side * 7.62, 2.08, 2.12, 0.64, 0.145],
        [side * 7.85, 2.08, 2.02, 0.64, 0.09],
        [side * 7.935, 2.08, 1.78, 0.64, 0.035],
      ],
      white,
    );
    for (const [kind, a, b] of [
      ['flap-inner', 0.65, 2.35],
      ['flap-outer', 2.37, 4.06],
      ['aileron', 4.09, 7.5],
    ]) {
      const g = group(body, `Porter-${kind}-${side}`, [side * a, 2.08, 0.64]),
        dd = detailKit(g, g.name);
      wing(
        dd,
        [
          [0, 0, 0, -0.5, 0.026],
          [side * (b - a), 0, 0, -0.5, 0.026],
        ],
        red,
      );
      for (let x = a + 0.1; x < b; x += 0.16)
        dd.rod([side * (x - a), 0.018, -0.04], [side * (x - a), 0.006, -0.46], 0.0018, metal);
      dd.finish();
      bindings.push({
        node: g.name,
        source: kind.startsWith('flap') ? 'flapPosition' : 'rollInput',
        property: 'rotation',
        axis: 'x',
        scale: kind.startsWith('flap') ? -0.6632 : -side * 0.3,
      });
      for (const x of [a + 0.15, b - 0.15]) {
        d.rod([side * x, 2.02, 0.89], [side * x, 1.92, 0.63], 0.012, metal);
        d.rod([side * x, 1.92, 0.63], [side * x, 2.06, 0.47], 0.01, metal);
      }
    }
    for (let x = 0.8; x < 7.6; x += 0.45)
      for (let u = 0.15; u < 0.85; u += 0.12) {
        const h = 0.145 * (u < 0.25 ? u / 0.25 : 1 - (u - 0.25) * 0.96);
        d.add(new T.SphereGeometry(0.0028, 5, 3), metal, [
          side * x,
          2.08 + h + 0.003,
          2.12 - u * 1.48,
        ]);
      }
    const a = new T.Vector3(side * 0.62, 0.64, 1.1),
      b = new T.Vector3(side * 3.55, 2.02, 1.5);
    // Streamlined lift strut (elliptical section, chord fore and aft), not a square box.
    fairedLeg(d, a.toArray(), b.toArray(), 0.029, 0.085, 1, metal);
    d.rod([side * 2.1, 1.4, 1.32], [side * 2.1, 2.05, 1.32], 0.014, metal);
    // Leading-edge landing light recesses and fixed nav lamps.
    d.add(new T.CircleGeometry(0.07, 16), dark, [side * 6.78, 2.07, 2.126]);
    d.add(new T.CircleGeometry(0.05, 16), metal, [side * 6.78, 2.07, 2.128]);
    ellipsoid(d, [side * 7.89, 2.08, 1.65], [0.035, 0.04, 0.065], side > 0 ? d.red : d.green, 8);
    wing(
      d,
      [
        [side * 0.1, 1.85, -4.03, -4.87, 0.086],
        [side * 2.4, 1.85, -4.03, -4.87, 0.086],
        [side * 2.56, 1.85, -4.03, -4.4, 0.055],
      ],
      white,
    );
    const eg = group(body, `Porter-elevator-${side}`, [side * 0.1, 1.85, -4.87]),
      ed = detailKit(eg, eg.name);
    wing(
      ed,
      [
        [0, 0, 0, -0.395, 0.025],
        [side * 2.29, 0, 0, -0.395, 0.025],
      ],
      red,
    );
    for (let x = 0.12; x < 2.3; x += 0.14)
      ed.rod([side * x, 0.017, -0.025], [side * x, 0.005, -0.36], 0.002, metal);
    ed.finish();
    bindings.push({
      node: eg.name,
      source: 'pitchInput',
      property: 'rotation',
      axis: 'x',
      scale: 0.45,
    });
  }
  // Fin and rudder are tapered sections (12 % of the combined chord, at most 0.12 m thick over
  // the dorsal fillet), not constant-thickness slabs.
  const fin = [
      fromSide(1177, 487),
      fromSide(1403, 466),
      fromSide(1424, 346),
      fromSide(1493, 357),
      fromSide(1458, 548),
    ].map((q) => [q[2], q[1]]),
    rp = fromSide(1458, 548),
    rudderOutline = [
      [0, 0],
      [0, 1.82],
      [-0.43, 1.82],
      [-0.43, 0.02],
    ],
    span = (outline, y) => {
      const [front, back] = chordAt(outline, y);
      return front - back;
    },
    finHalf = (y) =>
      Math.min(0.06, Math.max(0.012, 0.06 * (span(fin, y) + span(rudderOutline, y - rp[1])))),
    rudderRib = (y) => {
      const h = finHalf(y + rp[1]);
      return [y, ...chordAt(rudderOutline, y), h * 0.5, h * 0.55, 0.003];
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
    white,
  );
  const rg = group(body, 'Porter-rudder', rp),
    rd = detailKit(rg, rg.name);
  foil(
    rd,
    outlineRibs(rudderOutline).map(([y]) => rudderRib(y)),
    red,
  );
  for (let y = 0.13; y < 1.8; y += 0.13) {
    const rib = rudderRib(y);
    outline(
      rd,
      [-0.03, -0.13, -0.32, -0.39].map((z) => [foilX(rib, z) + 0.002, y, z]),
      0.002,
      metal,
      false,
    );
  }
  rd.finish();
  bindings.push({
    node: rg.name,
    source: 'yawInput',
    property: 'rotation',
    axis: 'y',
    scale: 0.52,
  });
  // Ground-contact gear uses independent 3m track, not the narrower front illustration.
  for (const side of [-1, 1]) {
    const center = fromSide(730, 635, side * 1.5),
      gd = detailKit(group(body, `Porter-main-gear-${side}`), 'Porter-gear');
    for (const a of [
      [side * 0.59, 0.65, 2.5],
      [side * 0.59, 0.65, 1.15],
    ])
      gd.rod(a, center, 0.043, metal);
    gd.rod([side * 0.59, 1.4, 2.5], center, 0.06, metal);
    const q = new T.Vector3(...center).lerp(new T.Vector3(side * 0.59, 1.4, 2.5), 0.28);
    gd.rod(center, q.toArray(), 0.045, dark);
    wheel(gd, center, 0.335, 0.24, rubber, metal);
    for (const sign of [-1, 1])
      for (let j = 0; j < 8; j++) {
        const a = (j * Math.PI) / 4;
        gd.add(new T.SphereGeometry(0.014, 8, 4), dark, [
          center[0] + sign * 0.083,
          center[1] + Math.sin(a) * 0.13,
          center[2] + Math.cos(a) * 0.13,
        ]);
      }
    gd.finish();
  }
  const tail = fromSide(1559, 653),
    tg = group(body, 'Porter-tailwheel'),
    td = detailKit(tg, tg.name);
  td.rod([0, 1.46, -4.85], [0, tail[1] + 0.22, tail[2] + 0.12], 0.03, metal);
  for (const side of [-1, 1])
    td.rod(
      [side * 0.06, tail[1] + 0.18, tail[2] + 0.12],
      [side * 0.06, tail[1], tail[2]],
      0.025,
      metal,
    );
  wheel(td, tail, 0.165, 0.12, rubber, metal);
  td.finish();
  d.rod([0, 2.12, 1.6], [0, 2.48, 1.62], 0.01, dark);
  d.rod([0, 2.1, -0.25], [0, 2.38, -0.4], 0.012, dark);
  d.rod([0, 2.48, 1.62], [0, 3.86, -4.3], 0.0018, dark);
  d.finish();
  const interior = porterCockpit(body, { white, red, dark, metal }, sections);
  cleanGeometry(root);
  return {
    root,
    frame: porterFrame(),
    enginePoints: [{ id: 'engine-1', position: pose([0, 1.2, 4.8]) }],
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
function porterCockpit(root, m, sections) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'Porter-cockpit'),
    pt = panelTools(d),
    ins = instrumentGeometry(cabin, 'Porter'),
    { bindings, derived, ink, black } = ins,
    face = mat('Porter-panel', '#838e89'),
    liner = mat('Porter-liner', '#b5b9ac'),
    blue = mat('Porter-upholstery', '#3a627a');
  const k = 0.0011,
    x = (u) => (800 - u) * k,
    y = (v) => 1.65 + (250 - v) * k,
    z = 2.65,
    at = (u, v, dz = 0) => [x(u), y(v), z + dz];
  const edge = [
    [237, 630],
    [250, 405],
    [280, 348],
    [365, 294],
    [500, 265],
    [720, 250],
    [1020, 250],
    [1315, 271],
    [1320, 650],
  ].map((q) => at(...q));
  const aperture = (u, v, w, h) =>
    Array.from({ length: 40 }, (_, i) => [
      x(u) + (Math.cos((i * Math.PI) / 20) * w) / 2,
      y(v) + (Math.sin((i * Math.PI) / 20) * h) / 2,
      z,
    ]);
  const holes = [aperture(605, 364, 0.092, 0.092), aperture(345, 431, 0.061, 0.067)];
  sheet(d, edge, face, [0, 0, -1], holes);
  sheet(
    d,
    edge.map((q) => [q[0], q[1], q[2] + 0.1]),
    black,
    [0, 0, 1],
  );
  outline(d, edge.slice(1, 8), 0.027, m.dark, false);
  quad(
    d,
    [-0.59, 1.65, z],
    [0.61, 1.65, z],
    [0.58, 1.7, 2.85],
    [-0.57, 1.7, 2.85],
    m.dark,
    [0, 1, 0],
  );
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
    knots: { op: 'multiply', args: ['trueAirspeed', 3600 / 1852] },
    feet: { op: 'divide', args: ['altitude', 0.3048] },
    verticalFpm: { op: 'multiply', args: ['verticalSpeed', 60 / 0.3048] },
    northYaw: { op: 'subtract', args: [Math.PI, 'yaw'] },
    trueHeading: { op: 'modulo', args: ['northYaw', 2 * Math.PI] },
    rpmPercent: { op: 'multiply', args: ['engine1', 100] },
    turnDegrees: { op: 'multiply', args: ['yawRate', 180 / Math.PI] },
  });
  ins.dial(
    'speed',
    at(488, 358, -0.014),
    0.05,
    'knots',
    [
      [0, 0],
      [40, 0.65],
      [60, 1.2],
      [80, 1.8],
      [100, 2.4],
      [120, 3.0],
      [140, 3.7],
      [160, 4.4],
      [200, 5.7],
    ],
    [0, 40, 60, 80, 100, 120, 140, 160, 200],
    'TAS KT',
    { responseSeconds: 0.2 },
  );
  ins.horizon('attitude', at(605, 364, 0.011), 0.092, 0.092, { round: true, blankBackdrop: true });
  d.ring(0.051, 0.003, at(605, 364, -0.014), m.metal);
  ins.altimeter('altimeter', at(721, 369, -0.014), 0.051, 'feet');
  ins.headingDrum('heading', at(586, 483, -0.014), 0.052, 'trueHeading');
  ins.dial(
    'vsi',
    at(696, 487, -0.014),
    0.05,
    'verticalFpm',
    [
      [-2000, -2.5],
      [0, 0],
      [2000, 2.5],
    ],
    [-2000, -1000, 0, 1000, 2000],
    'FT MIN',
    { responseSeconds: 0.5 },
  );
  ins.dial(
    'turn',
    at(565, 581, -0.014),
    0.042,
    'turnDegrees',
    [
      [-6, -0.6],
      [0, 0],
      [6, 0.6],
    ],
    [-3, 0, 3],
    'TURN DEG S',
  );
  ins.horizon('standby-attitude', at(345, 431, 0.011), 0.061, 0.067, {
    round: true,
    blankBackdrop: true,
  });
  d.ring(0.036, 0.003, at(345, 431, -0.014), m.metal);
  // Analog engine stack: normalized sim RPM is explicitly labelled, unsupported needles absent.
  for (const [u, v, label] of [
    [868, 335, 'TORQUE --'],
    [953, 336, 'ITT --'],
    [940, 415, 'NG --'],
    [838, 493, 'OIL --'],
    [925, 499, 'OIL --'],
    [470, 467, 'NAV --'],
    [338, 519, 'NAV --'],
  ]) {
    pt.gauge(x(u), y(v), z - 0.02, label.startsWith('NAV') ? 0.043 : 0.038, undefined, false);
    d.text(label, at(u, v, -0.038), 0.007, Math.PI, ink);
  }
  ins.dial(
    'rpm',
    at(854, 414, -0.014),
    0.038,
    'rpmPercent',
    [
      [0, 0],
      [50, 2.7],
      [100, 5.4],
    ],
    [0, 25, 50, 75, 100],
    'RPM %',
    { responseSeconds: 0.25 },
  );
  ins.pointer('flaps', at(397, 424, -0.027), 0.016, 'flapPosition', [
    [0, -1],
    [1, 1],
  ]);
  d.text('FLAPS', at(397, 399, -0.029), 0.006, Math.PI, ink);
  // Original photo's navigation/radio face dimensions and dense lower annunciator bank.
  for (const [v, h, label] of [
    [328, 40, 'AUDIO'],
    [383, 54, 'COM --'],
    [456, 53, 'NAV --'],
    [532, 40, 'ADF --'],
    [589, 43, 'XPDR --'],
  ]) {
    d.box([0.25, h * k, 0.025], at(1131, v, -0.01), m.dark);
    for (const u of [1032, 1227]) pt.knob(x(u), y(v + 8), z - 0.03, 0.01);
    d.text(label, at(1131, v - 5, -0.027), 0.01, Math.PI, ink);
    for (let i = 0; i < 7; i++)
      d.box([0.01, 0.006, 0.005], at(1060 + i * 23, v + 12, -0.027), liner);
  }
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 5; col++) {
      const u = 831 + col * 27,
        v = 553 + row * 15;
      d.box([0.024, 0.012, 0.008], at(u, v, -0.01), black);
      d.text(['PWR', 'OIL', 'GEN', 'FUEL', 'TEMP'][col], at(u, v, -0.016), 0.0036, Math.PI, ink);
    }
  for (let i = 0; i < 15; i++) {
    const u = 270 + i * 65;
    d.rod(at(u, 633, -0.025), at(u, 626, -0.045), 0.0025, m.metal);
    d.text(['BAT', 'GEN', 'LTS', 'HEAT', 'NAV'][i % 5], at(u, 611, -0.02), 0.0045, Math.PI, ink);
  }
  d.text('SIM DATUM', at(604, 418, -0.02), 0.006, Math.PI, ink, 'display');
  d.text('NO NAV DATA', at(470, 503, -0.04), 0.006, Math.PI, ink);
  // Tall central quadrant with black power bar, blue prop lever and red condition knob.
  const q = group(cabin, 'Porter-quadrant', [0, 0.86, 2.3]),
    qd = detailKit(q, q.name);
  beveledBox(qd, [0.24, 0.16, 0.34], [0, 0, 0], m.metal);
  qd.rod([0, -0.28, 0.12], [0, -0.07, 0.12], 0.04, m.metal);
  for (const [i, xx, h, color, source] of [
    [0, 0.08, 0.38, black, 'power'],
    [1, 0, 0.27, blue, null],
    [2, -0.08, 0.2, m.red, null],
  ]) {
    qd.box([0.016, 0.008, 0.26], [xx, 0.085, 0], black);
    const lever = group(q, `Porter-power-${i}`, [xx, 0.07, 0]),
      ld = detailKit(lever, lever.name);
    ld.rod([0, 0, 0], [0, h, 0], 0.012, m.metal);
    if (i === 0) ld.rod([-0.06, h, 0], [0.06, h, 0], 0.026, color);
    else ellipsoid(ld, [0, h, 0], [0.025, 0.024, 0.035], color, 12);
    ld.finish();
    if (source)
      bindings.push({ node: lever.name, source, property: 'rotation', axis: 'x', scale: 0.7 });
  }
  qd.finish();
  // Dual floor-mounted sticks, rudder pedals and full tubular blue crossbar.
  d.rod([-0.6, 1.0, 2.1], [0.6, 1.0, 2.1], 0.025, blue);
  for (const side of [-1, 1]) {
    const pitch = group(cabin, `Porter-stick-pitch-${side}`, [side * 0.31, 0.67, 1.95]),
      roll = group(pitch, `Porter-stick-roll-${side}`),
      sd = detailKit(roll, roll.name);
    sd.rod([0, 0, 0], [0, 0.36, 0.03], 0.023, m.metal);
    sd.rod([0, 0.36, 0.03], [0, 0.52, 0], 0.027, black);
    sd.add(new T.SphereGeometry(0.015, 10, 8), m.red, [0, 0.52, -0.016]);
    sd.finish();
    bindings.push(
      { node: pitch.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.2 },
      { node: roll.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.23 },
    );
    for (const sign of [-1, 1]) {
      const pedal = group(cabin, `Porter-pedal-${side}-${sign}`, [
          side * 0.3 + sign * 0.1,
          0.72,
          2.74,
        ]),
        dd = detailKit(pedal, pedal.name);
      dd.box([0.13, 0.12, 0.023], [0, 0, 0], m.metal);
      for (let j = 0; j < 4; j++)
        dd.rod(
          [-0.05, -0.04 + j * 0.025, -0.014],
          [0.05, -0.04 + j * 0.025, -0.014],
          0.0025,
          black,
        );
      dd.finish();
      bindings.push({
        node: pedal.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: sign * 0.04,
      });
    }
    d.box([0.025, 0.27, 1.15], [side * 0.6, 0.78, 2.02], liner);
    d.rod([side * 0.58, 1.12, 2.6], [side * 0.58, 1.12, 2.1], 0.02, m.dark);
  }
  fittedFloor(d, sections, m.dark, { y: 0.66, front: 2.9, back: -0.66, width: 1.18 });
  for (const [x, z] of [
    [0.3, 1.78],
    [-0.3, 1.78],
    [0.3, 0.85],
    [-0.3, 0.85],
    [0.3, -0.02],
    [-0.3, -0.02],
    [0.3, -0.83],
    [-0.3, -0.83],
  ]) {
    beveledBox(d, [0.44, 0.1, 0.42], [x, 0.85, z], blue, 0.035);
    beveledBox(d, [0.44, 0.57, 0.12], [x, 1.17, z - 0.19], blue, 0.035);
    for (const side of [-1, 1])
      d.rod([x + side * 0.18, 0.61, z], [x + side * 0.18, 0.82, z], 0.015, m.metal);
    d.rod([x - 0.17, 0.92, z - 0.13], [x + 0.17, 0.92, z + 0.12], 0.012, liner);
    d.box([0.045, 0.015, 0.03], [x + 0.04, 0.93, z + 0.04], m.metal);
  }
  // Panel fixing screws, windscreen compass housing and ceiling cabin fixtures.
  for (const [u, v] of [
    [265, 400],
    [340, 305],
    [740, 272],
    [980, 275],
    [1295, 303],
    [1300, 624],
    [750, 625],
    [260, 623],
  ])
    d.add(new T.SphereGeometry(0.004, 6, 4), m.metal, at(u, v, -0.015));
  const compass = group(cabin, 'Porter-compass-housing', [0, 1.82, 2.72]),
    cd = detailKit(compass, compass.name);
  beveledBox(cd, [0.1, 0.09, 0.1], [0, 0, 0], black, 0.01);
  cd.rod([0, -0.15, 0], [0, -0.04, 0], 0.012, m.metal);
  cd.finish();
  ins.headingDrum('compass', [0, 1.82, 2.657], 0.037, 'trueHeading');
  for (const z of [0.8, -0.3]) d.box([0.13, 0.018, 0.06], [0, 2.03, z], liner);
  d.finish();
  return { nodes: ['cockpit'], sources, derived, bindings };
}
