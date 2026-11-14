/** North American Rockwell OV-10A Bronco, unarmed: twin booms, tandem greenhouse cockpit.
 * Contours are hand-authored in metres from published dimensions (12.19 m span, 12.67 m length,
 * 4.62 m height, 27.03 m2 wing, 2.59 m three-blade propellers) and public-domain USAF/USMC
 * photographs; see the Bronco entry in AIRCRAFT-EXPANSION.md. Sponsons are faired: no guns,
 * racks or stores. Model z = 4.6 - s, where s is metres aft of the nose tip; z 0 is the centre
 * of mass, ahead of the main wheels.
 */
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

const Z0 = 4.6,
  zs = (s) => Z0 - s,
  SILL = 1.9;

export const ov10Frame = () => ({
  heli: false,
  fighter: false,
  large: false,
  radius: 0.58,
  cy: 2.05,
  ry: 0.8,
  cabinZ: 2.55,
  cabinWidth: 1,
  // Front ejection seat, over the stick; the rear seat is raised for the observer's view.
  eye: [0, 2.3, 2.55],
  rearEye: [0, 2.46, 1.3],
  panelZ: 3.18,
  floor: 1.12,
});

/** A tyre with rounded shoulders on a dished rim, the axle along X through `at`. */
function wheel(d, at, r, w, tyre, rim) {
  const lathe = (points, segments) =>
    new T.LatheGeometry(
      points.map(([x, y]) => new T.Vector2(x, y)),
      segments,
    ).rotateZ(Math.PI / 2);
  d.add(
    lathe(
      [
        [r * 0.62, -w * 0.5],
        [r * 0.88, -w * 0.5],
        [r * 0.97, -w * 0.4],
        [r, -w * 0.2],
        [r, w * 0.2],
        [r * 0.97, w * 0.4],
        [r * 0.88, w * 0.5],
        [r * 0.62, w * 0.5],
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
          [r * 0.62, w * 0.5],
          [r * 0.58, w * 0.32],
          [r * 0.26, w * 0.32],
          [r * 0.18, w * 0.44],
          [0.001, w * 0.46],
        ]),
        16,
      ),
      rim,
      at,
    );
  }
}

/** A symmetric fin section lofted through ribs [y, front z, back z, half thickness]. */
function fin(d, ribs, material) {
  const rings = ribs.map(([y, front, back, half]) => {
    const c = front - back,
      right = [
        [half * 0.35, front],
        [half, front - c * 0.3],
        [half * 0.6, front - c * 0.72],
        [half * 0.12, back],
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

/** Rounded-rectangle section: half width w, belly yb, waist yc, roof yt (16 points, top first). */
function podRing(w, yb, yc, yt) {
  const n = 2.6;
  return Array.from({ length: 16 }, (_, j) => {
    const a = (j * Math.PI) / 8,
      s = Math.sin(a),
      c = Math.cos(a);
    return [
      w * Math.sign(s) * Math.pow(Math.abs(s), 2 / n),
      yc + (c >= 0 ? yt - yc : yc - yb) * Math.sign(c) * Math.pow(Math.abs(c), 2 / n),
    ];
  });
}

// Canopy cross-section template (x of the sill half width, y of the sill-to-roof height), from
// the left sill over the roof: the side panels bulge outboard for the downward view.
const CANOPY = [
  [1, 0],
  [1.08, 0.17],
  [1.1, 0.37],
  [1.05, 0.59],
  [0.9, 0.79],
  [0.62, 0.93],
  [0.31, 0.99],
  [0, 1],
];
const canopyArc = (w, top) =>
  [
    ...CANOPY,
    ...CANOPY.slice(0, -1)
      .reverse()
      .map(([x, y]) => [-x, y]),
  ].map(([x, y]) => [x * w, SILL + y * (top - SILL)]);

export function buildOV10(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('Bronco-gray', s.color ?? '#a2a79f', { side: T.DoubleSide }),
    accent = mat('Bronco-antiglare', s.accent ?? '#2c3134', { side: T.DoubleSide }),
    frame = mat('Bronco-canopy-frame', '#3a4044', { side: T.DoubleSide }),
    metal = mat('Bronco-alloy', '#aab1b3', { metalness: 0.7, roughness: 0.38 }),
    oleo = mat('Bronco-oleo', '#d4d8da', { metalness: 0.85, roughness: 0.2 }),
    dark = mat('Bronco-intake', '#22282b', { side: T.DoubleSide }),
    rubber = mat('Bronco-tyres', '#1b1f21', { roughness: 0.9 }),
    blade = mat('Bronco-propeller', '#25292b'),
    tip = mat('Bronco-prop-tip', '#c4462f'),
    glass = mat('Bronco-glazing', '#9fbfca', {
      transparent: true,
      opacity: 0.21,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.1,
    });
  const d = detailKit(root, 'Bronco-shell'),
    bindings = [],
    rotors = [],
    enginePoints = [];

  // ---- Fuselage pod: [s, half width, belly, waist, roof]. Between the windshield base
  // (s 1.25) and the canopy end (s 4.25) the waist is the canopy sill and the roof is glazing.
  const stations = [
    [0, 0.05, 1.5, 1.56, 1.62],
    [0.07, 0.22, 1.3, 1.56, 1.79],
    [0.25, 0.37, 1.12, 1.58, 1.93],
    [0.65, 0.47, 1.02, 1.64, 2.0],
    [1.25, 0.52, 1.0, SILL, 2.04],
    [1.8, 0.56, 0.98, SILL, 2.1],
    [2.6, 0.58, 0.98, SILL, 2.1],
    [3.4, 0.58, 1.0, SILL, 2.1],
    [4.25, 0.58, 1.02, SILL, 2.66],
    [5.2, 0.58, 1.05, SILL, 2.7],
    [6.2, 0.55, 1.12, 1.92, 2.66],
    [7.0, 0.45, 1.32, 2.0, 2.5],
    [7.7, 0.29, 1.6, 2.04, 2.32],
    [8.0, 0.1, 1.86, 2.02, 2.14],
  ];
  const rings = stations.map(([u, w, yb, yc, yt]) => ({
    z: zs(u),
    points: podRing(w, yb, yc, yt),
  }));
  const top = (j) => j <= 3 || j >= 12;
  const open = (i) => i >= 4 && i <= 7;
  // Anti-glare panel on the nose ahead of the windshield, as a separate dark band.
  const glare = (i, j) => (i === 2 || i === 3) && (j <= 1 || j >= 15);
  loft(d, rings, paint, { skip: (i, j) => (open(i) && top(j)) || glare(i, j) });
  loft(d, rings, accent, { caps: false, skip: (i, j) => !glare(i, j) });
  const podAt = (u) => {
    for (let i = 0; i < stations.length - 1; i++)
      if (u >= stations[i][0] && u <= stations[i + 1][0]) {
        const t = (u - stations[i][0]) / (stations[i + 1][0] - stations[i][0]);
        return stations[i].map((v, k) => v + (stations[i + 1][k] - v) * t);
      }
    return stations.at(-1);
  };

  // ---- Greenhouse canopy: windshield, front and rear cockpits, bulged side panels.
  const canopyStations = [
    [1.25, 2.04],
    [1.45, 2.32],
    [1.65, 2.52],
    [1.86, 2.66],
    [2.7, 2.72],
    [3.5, 2.78],
    [4.05, 2.8],
    [4.25, 2.78],
  ].map(([u, yTop]) => ({ u, z: zs(u), arc: canopyArc(podAt(u)[1], yTop) }));
  for (let i = 0; i < canopyStations.length - 1; i++) {
    const a = canopyStations[i],
      b = canopyStations[i + 1];
    for (let k = 0; k < a.arc.length - 1; k++)
      quad(
        d,
        [...a.arc[k], a.z],
        [...b.arc[k], b.z],
        [...b.arc[k + 1], b.z],
        [...a.arc[k + 1], a.z],
        glass,
        [(a.arc[k][0] + a.arc[k + 1][0]) / 2, (a.arc[k][1] + a.arc[k + 1][1]) / 2 - SILL, 0.2],
      );
  }
  // Frames: windshield base and arch, the hoop between the cockpits, the rear hoop and the sill
  // rails. The windshield centre panel is unbroken, so the pilot's sightline has no post.
  for (const i of [0, 3, 4, 6, 7])
    outline(
      d,
      canopyStations[i].arc.map(([x, y]) => [x, y, canopyStations[i].z]),
      i === 0 ? 0.02 : 0.012,
      frame,
      false,
    );
  for (const k of [0, 4, 10, 14])
    outline(
      d,
      canopyStations.map(({ arc, z }) => [arc[k][0], arc[k][1], z]),
      k === 0 || k === 14 ? 0.016 : 0.008,
      frame,
      false,
    );
  // Door frames of the two side-opening panels, on both sides.
  for (const k of [2, 12])
    for (const [a, b] of [
      [3, 4],
      [4, 6],
    ])
      outline(
        d,
        [canopyStations[a], canopyStations[b]].map(({ arc, z }) => [arc[k][0], arc[k][1], z]),
        0.009,
        frame,
        false,
      );
  // The canopy's aft end closes against the wing root fairing.
  {
    const end = canopyStations.at(-1),
      ring = rings[8].points,
      roof = [13, 14, 15, 0, 1, 2, 3].map((j) => ring[j]);
    sheet(
      d,
      [...end.arc.map(([x, y]) => [x, y, end.z]), ...roof.map(([x, y]) => [x, y, end.z])],
      paint,
      [0, 0, -1],
    );
  }

  // ---- Faired sponsons (stub wings) on the lower fuselage: no guns, racks or stores.
  for (const side of [-1, 1]) {
    wing(
      d,
      [
        [side * 0.45, 1.2, zs(3.25), zs(6.0), 0.085],
        [side * 1.5, 1.04, zs(3.55), zs(5.85), 0.06],
        [side * 1.56, 1.035, zs(3.75), zs(5.75), 0.035],
      ],
      paint,
    );
    // Faired-over gun bay doors and a boarding step on the left sponson.
    outline(
      d,
      [
        [side * 0.62, 1.29, zs(3.7)],
        [side * 1.25, 1.21, zs(3.85)],
        [side * 1.25, 1.21, zs(4.9)],
        [side * 0.62, 1.29, zs(5.05)],
      ],
      0.004,
      frame,
    );
  }
  d.rod([0.6, 1.05, zs(2.3)], [0.6, 0.62, zs(2.3)], 0.02, metal);
  d.box([0.2, 0.025, 0.12], [0.6, 0.62, zs(2.3)], metal);

  // ---- Wing: constant 2.22 m chord, no dihedral, 15 % section; rounded tips. Flaps inboard and
  // outboard of the booms; ailerons outboard.
  const WY = 2.78,
    LE = zs(4.0),
    TE = zs(6.22),
    HINGE = zs(5.65),
    TIP = 6.095;
  wing(
    d,
    [
      [TIP, WY + 0.01, LE - 0.12, HINGE + 0.03, 0.1],
      [TIP - 0.12, WY, LE - 0.02, HINGE, 0.17],
      [-(TIP - 0.12), WY, LE - 0.02, HINGE, 0.17],
      [-TIP, WY + 0.01, LE - 0.12, HINGE + 0.03, 0.1],
    ],
    paint,
  );
  // Fixed trailing edge over the fuselage and behind each nacelle.
  for (const [a, b] of [
    [-0.62, 0.62],
    [1.82, 2.58],
    [-2.58, -1.82],
  ])
    wing(
      d,
      [
        [b, WY, HINGE, TE, 0.05],
        [a, WY, HINGE, TE, 0.05],
      ],
      paint,
    );
  const surfaces = [];
  for (const side of [-1, 1]) {
    for (const [kind, a, b] of [
      ['flap', 0.62, 1.82],
      ['flap', 2.58, 4.3],
      ['aileron', 4.32, 5.95],
    ]) {
      const name = `Bronco-${kind}-${side > 0 ? 'left' : 'right'}-${a < 2 ? 'inner' : 'outer'}`,
        g = group(root, kind === 'aileron' ? `Bronco-aileron-${side}` : name, [
          side * a,
          WY,
          HINGE,
        ]),
        gd = detailKit(g, `${g.name}-skin`);
      wing(
        gd,
        [
          [0, 0, 0, TE - HINGE, 0.045],
          [side * (b - a), 0, 0, TE - HINGE, 0.045],
        ],
        paint,
      );
      gd.finish();
      surfaces.push(g.name);
      bindings.push({
        node: g.name,
        source: kind === 'flap' ? 'flapPosition' : 'rollInput',
        property: 'rotation',
        axis: 'x',
        scale: kind === 'flap' ? -0.7 : -side * 0.3,
      });
    }
    ellipsoid(
      d,
      [side * (TIP - 0.02), WY, LE - 0.55],
      [0.05, 0.04, 0.09],
      side > 0 ? d.red : d.green,
      10,
    );
    // Pitot-static boom on the left wing tip's leading edge is not on the A; a static port strip.
    for (let x = 0.7; x < TIP - 0.2; x += 0.6)
      d.box([0.004, 0.003, 0.02], [side * x, WY + 0.155, LE - 0.55], metal);
  }

  // ---- Nacelles and tail booms, one continuous loft each. Main wheels stow in the deep boom
  // section behind the nacelle; T76 intakes sit under the spinners.
  const BOOM = 2.2,
    THRUST_Y = 2.28,
    PROP_S = 2.95;
  const boom = [
    [3.0, 0.27, 2.0, 2.56],
    [3.25, 0.33, 1.9, 2.66],
    [3.9, 0.35, 1.84, 2.7],
    [5.2, 0.35, 1.84, 2.7],
    [6.2, 0.33, 1.88, 2.7],
    [7.0, 0.29, 1.92, 2.68],
    [7.6, 0.24, 2.08, 2.64],
    [8.8, 0.2, 2.2, 2.6],
    [10.4, 0.17, 2.25, 2.6],
    [11.6, 0.15, 2.28, 2.6],
    [12.3, 0.11, 2.32, 2.56],
    [12.55, 0.04, 2.4, 2.5],
  ];
  const boomRings = boom.map(([u, w, yb, yt]) => ({
    z: zs(u),
    points: Array.from({ length: 16 }, (_, j) => {
      const a = (j * Math.PI) / 8,
        c = (yb + yt) / 2,
        h = (yt - yb) / 2;
      return [w * Math.sin(a), c + h * Math.cos(a) * (Math.cos(a) < 0 ? 1 : 0.96)];
    }),
  }));
  for (const [i, side] of [1, -1].entries()) {
    const x = side * BOOM;
    loft(
      d,
      boomRings.map((r) => ({ z: r.z, points: r.points.map(([px, py]) => [px + x, py]) })),
      paint,
    );
    // Main gear bay: a dark slot under the boom, open while the gear is down.
    sheet(
      d,
      [
        [x + 0.15, 1.858, zs(4.95)],
        [x - 0.15, 1.858, zs(4.95)],
        [x - 0.15, 1.9, zs(7.0)],
        [x + 0.15, 1.9, zs(7.0)],
      ],
      dark,
      [0, -1, 0],
    );
    // Exhaust on the outboard side of the nacelle, above the wing's lower surface line.
    const ex = group(root, `Bronco-exhaust-${i}`, [x + side * 0.32, 2.42, zs(4.55)]);
    ex.rotation.y = side * 0.35;
    const exd = detailKit(ex, ex.name);
    exd.add(new T.CylinderGeometry(0.075, 0.09, 0.32, 14, 1, true).rotateX(Math.PI / 2), metal);
    exd.add(new T.CircleGeometry(0.07, 14).rotateY(Math.PI), dark, [0, 0, -0.14]);
    exd.finish();
    // Cowling panel lines, on the loft's own sections (below the wing's lower surface).
    for (const k of [2, 3])
      outline(
        d,
        boomRings[k].points
          .filter(([, py]) => py < WY - 0.13)
          .map(([px, py]) => [x + px * 1.012, py, boomRings[k].z]),
        0.003,
        frame,
        false,
      );
    const eg = group(root, `engine-${i + 1}`, [x, THRUST_Y, zs(PROP_S)]),
      nd = detailKit(eg, `Bronco-cowl-${i}`);
    // Chin intake under the spinner: a lipped, dark mouth.
    const mouth = Array.from({ length: 18 }, (_, j) => {
      const a = (j * Math.PI * 2) / 18;
      return [Math.cos(a) * 0.15, -0.24 + Math.sin(a) * 0.075, -0.04];
    });
    sheet(nd, mouth, dark, [0, 0, 1]);
    outline(nd, mouth, 0.016, paint);
    nd.box([0.5, 0.04, 0.04], [0, 0.27, -0.04], paint);
    nd.finish();
    const hand = side > 0 ? 1 : -1;
    const prop = group(eg, `Bronco-propeller-${i}`, [0, 0, 0.04]),
      pd = detailKit(prop, prop.name);
    pd.add(
      new T.LatheGeometry(
        Array.from({ length: 10 }, (_, k) => {
          const t = k / 9;
          return new T.Vector2(0.2 * Math.pow(1 - t * t, 0.7), t * 0.5);
        }),
        24,
      ).rotateX(Math.PI / 2),
      metal,
    );
    for (let j = 0; j < 3; j++) {
      const b = group(prop, `Bronco-blade-${i}-${j}`);
      b.rotation.z = (j * Math.PI * 2) / 3;
      const bd = detailKit(b, b.name),
        pts = [
          [0.15, -0.06, 0],
          [0.5, -0.12, 0.02],
          [1.1, -0.1, 0.01],
          [1.285, -0.06, 0],
          [1.295, 0.02, 0],
          [1.2, 0.08, -0.01],
          [0.62, 0.12, -0.02],
          [0.15, 0.06, 0],
        ].map(([px, py, pz]) => [px, py * hand, pz]);
      sheet(bd, pts, blade, [0, 0, 1]);
      sheet(
        bd,
        pts.map((q) => [q[0], q[1], q[2] - 0.022]),
        blade,
        [0, 0, -1],
      );
      bd.box([0.17, 0.17, 0.026], [1.2, 0.01 * hand, -0.011], tip);
      bd.rod([0.05, 0, -0.011], [0.2, 0, -0.011], 0.05, metal);
      bd.finish();
    }
    pd.finish();
    enginePoints.push({ id: eg.name, position: [x, THRUST_Y, zs(PROP_S)] });
    rotors.push({ node: prop.name, axis: 'z', multiplier: hand, engine: eg.name });
  }

  // ---- Twin fins and rudders on the boom ends; the tailplane sits on top of both fins.
  const lean = Math.atan2(0.24, 2.1),
    hingeLength = Math.hypot(0.24, 2.1);
  for (const side of [-1, 1]) {
    const x = side * BOOM,
      fd = detailKit(
        group(root, `Bronco-fin-${side > 0 ? 'left' : 'right'}`, [x, 0, 0]),
        `Bronco-fin-${side}`,
      );
    fin(
      fd,
      [
        [2.5, zs(10.55), zs(12.0), 0.065],
        [3.0, zs(10.78), zs(12.06), 0.06],
        [4.0, zs(11.24), zs(12.18), 0.05],
        [4.5, zs(11.47), zs(12.24), 0.045],
      ],
      paint,
    );
    // Dorsal fillet where the fin leading edge meets the boom.
    fin(
      fd,
      [
        [2.52, zs(9.9), zs(10.9), 0.05],
        [2.78, zs(10.66), zs(10.95), 0.03],
      ],
      paint,
    );
    fd.finish();
    const rudder = group(root, `Bronco-rudder-hinge-${side}`, [x, 2.4, zs(12.0)]);
    rudder.rotation.x = -lean;
    const moving = group(rudder, `Bronco-rudder-${side > 0 ? 'left' : 'right'}`),
      rd = detailKit(moving, `${moving.name}-skin`);
    fin(
      rd,
      [
        [0, 0, -0.42, 0.04],
        [hingeLength, 0, -0.42, 0.034],
      ],
      paint,
    );
    rd.finish();
    bindings.push({
      node: moving.name,
      source: 'yawInput',
      property: 'rotation',
      axis: 'y',
      scale: 0.4,
    });
    // Formation light strip and the fin-tip position light.
    d.box([0.006, 0.4, 0.04], [x + side * 0.05, 3.4, zs(11.6)], d.green);
  }
  const STAB_Y = 4.53;
  wing(
    d,
    [
      [2.34, STAB_Y, zs(11.42), zs(12.26), 0.08],
      [-2.34, STAB_Y, zs(11.42), zs(12.26), 0.08],
    ],
    paint,
  );
  const elevator = group(root, 'Bronco-elevator', [0, STAB_Y, zs(12.26)]),
    ed = detailKit(elevator, 'Bronco-elevator-skin');
  wing(
    ed,
    [
      [2.34, 0, 0, -0.41, 0.035],
      [-2.34, 0, 0, -0.41, 0.035],
    ],
    paint,
  );
  ed.finish();
  bindings.push({
    node: elevator.name,
    source: 'pitchInput',
    property: 'rotation',
    axis: 'x',
    scale: 0.35,
  });

  // ---- Landing gear. Trailing-link nose leg folds forward into the nose; the long main legs
  // fold aft into the booms. `gear` is 1 when down.
  for (const [index, x, pivot, wheelAt, r, retract] of [
    [0, 0, [1.3, zs(1.75)], [0.28, zs(1.88)], 0.28, -1.72],
    [1, BOOM, [2.29, zs(4.65)], [0.37, zs(5.35)], 0.37, 1.22],
    [2, -BOOM, [2.29, zs(4.65)], [0.37, zs(5.35)], 0.37, 1.22],
  ]) {
    const g = group(root, `Bronco-gear-${index}`, [x, pivot[0], pivot[1]]),
      gd = detailKit(g, g.name),
      axle = [0, wheelAt[0] - pivot[0], wheelAt[1] - pivot[1]],
      knee = [0, axle[1] + r * (index ? 0.55 : 0.75), axle[2] + (index ? 0.5 : 0.24)];
    gd.rod([0, 0.05, 0], [0, knee[1] + 0.25, knee[2]], index ? 0.075 : 0.05, metal);
    gd.rod([0, knee[1] + 0.3, knee[2]], knee, index ? 0.055 : 0.04, oleo);
    for (const side of [-1, 1]) {
      const off = side * (index ? 0.16 : 0.12);
      gd.rod([off, knee[1], knee[2]], [off, axle[1], axle[2]], index ? 0.04 : 0.03, metal);
    }
    gd.rod(
      [-(index ? 0.17 : 0.13), knee[1], knee[2]],
      [index ? 0.17 : 0.13, knee[1], knee[2]],
      0.035,
      metal,
    );
    gd.rod(
      [-(index ? 0.17 : 0.13), axle[1], axle[2]],
      [index ? 0.17 : 0.13, axle[1], axle[2]],
      0.03,
      metal,
    );
    // Drag brace back up into the bay.
    gd.rod([0, -0.05, index ? -0.55 : 0.32], [0, knee[1] + 0.4, knee[2]], 0.025, metal);
    wheel(gd, axle, r, index ? 0.25 : 0.19, rubber, metal);
    if (!index)
      // Nose leg door, carried on the leg.
      gd.box([0.02, 0.5, 0.26], [0.16, -0.32, 0.02], paint);
    gd.finish();
    bindings.push({
      node: g.name,
      source: 'gear',
      property: 'rotation',
      axis: 'x',
      offset: retract,
      scale: -retract,
    });
  }

  // ---- Small fittings: nose pitot, antennas, step, lights.
  d.rod([0, 1.56, zs(-0.02)], [0, 1.56, zs(-0.32)], 0.011, metal);
  d.rod([0, 1.56, zs(-0.02)], [0, 1.56, zs(0.1)], 0.022, metal);
  d.rod([0, 2.7, zs(6.6)], [0, 3.35, zs(6.95)], 0.008, dark);
  d.rod([0, 2.1, zs(7.5)], [0, 2.1, zs(7.5) + 0.1], 0.02, dark);
  for (const u of [3.8, 5.6]) d.rod([0, 0.99, zs(u)], [0, 0.82, zs(u) - 0.08], 0.01, dark);
  d.box([0.08, 0.02, 0.18], [0, 0.99, zs(4.6)], d.red);
  d.finish();

  const interior = broncoCockpit(root, { paint, accent, frame, metal, dark }, rings);
  cleanGeometry(root);
  return {
    root,
    frame: ov10Frame(),
    enginePoints,
    visual: { rotors, gearNodes: [], flaps: [], ailerons: [], animation: { bindings }, interior },
    modelSignals: {
      sources: interior.sources,
      derived: interior.derived,
      bindings: [...interior.bindings, ...bindings],
    },
  };
}

const RATED_SHAFT_W = 533000;

function broncoCockpit(root, m, sections) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'Bronco-cabin'),
    ins = instrumentGeometry(cabin, 'Bronco'),
    pt = panelTools(d),
    { bindings, derived, ink, black } = ins;
  const face = mat('Bronco-panel', '#2f3538'),
    consoleMat = mat('Bronco-console', '#3a4144'),
    cushion = mat('Bronco-seat-cushion', '#58604f'),
    seatFrame = mat('Bronco-seat-frame', '#454b4b'),
    yellow = mat('Bronco-ejection-handle', '#d8b432'),
    green = mat('Bronco-cockpit-green', '#5e6b63');
  const sources = {};
  for (const [name, component, path] of [
    ['trueAirspeed', 'aircraftState', ['airspeed']],
    ['altitude', 'transform', ['pos', 1]],
    ['yaw', 'aircraftState', ['yaw']],
    ['roll', 'aircraftState', ['roll']],
    ['pitch', 'aircraftState', ['pitch']],
    ['verticalSpeed', 'aircraftState', ['verticalSpeed']],
    ['flapPosition', 'aircraftState', ['flapPosition']],
    ['gear', 'aircraftState', ['gearPosition']],
    ['fuel', 'aircraftState', ['fuel']],
    ['power', 'aircraftInput', ['power']],
    ['pitchInput', 'aircraftInput', ['pitch']],
    ['rollInput', 'aircraftInput', ['roll']],
    ['yawInput', 'aircraftInput', ['yaw']],
    ['engine1', 'aircraftState', ['engines', 'engine-1', 'rpm']],
    ['engine2', 'aircraftState', ['engines', 'engine-2', 'rpm']],
    ['shaft1', 'aircraftState', ['engines', 'engine-1', 'shaftPower']],
    ['shaft2', 'aircraftState', ['engines', 'engine-2', 'shaftPower']],
  ])
    sources[name] = { component, path };
  Object.assign(derived, {
    knots: { op: 'multiply', args: ['trueAirspeed', 3600 / 1852] },
    feet: { op: 'divide', args: ['altitude', 0.3048] },
    northYaw: { op: 'subtract', args: [Math.PI, 'yaw'] },
    trueHeading: { op: 'modulo', args: ['northYaw', 2 * Math.PI] },
    degreesTrue: { op: 'multiply', args: ['trueHeading', 180 / Math.PI] },
    verticalFpm: { op: 'multiply', args: ['verticalSpeed', 60 / 0.3048] },
    rpm1: { op: 'multiply', args: ['engine1', 100] },
    rpm2: { op: 'multiply', args: ['engine2', 100] },
    torque1: { op: 'multiply', args: ['shaft1', 100 / RATED_SHAFT_W] },
    torque2: { op: 'multiply', args: ['shaft2', 100 / RATED_SHAFT_W] },
    fuelPounds: { op: 'multiply', args: ['fuel', 2.20462] },
    gearLocked: { op: 'greater', args: ['gear', 0.999] },
    gearOffStop: { op: 'greater', args: ['gear', 0.001] },
    gearNotLocked: { op: 'less', args: ['gear', 0.999] },
    gearInTransit: { op: 'and', args: ['gearOffStop', 'gearNotLocked'] },
  });
  const airspeed = [
      [0, 0],
      [60, 0.9],
      [100, 2],
      [150, 3.2],
      [200, 4.2],
      [250, 5],
      [300, 5.6],
    ],
    vsi = [
      [-4000, -2.6],
      [0, 0],
      [4000, 2.6],
    ],
    percent = [
      [0, -2.4],
      [110, 2.4],
    ];

  // ---- Front cockpit: analog panel under a short coaming, consoles each side.
  const PZ = 3.18;
  const panel = [
    [0.4, 1.47],
    [0.4, 1.95],
    [0.31, 2.02],
    [-0.31, 2.02],
    [-0.4, 1.95],
    [-0.4, 1.47],
  ].map(([x, y]) => [x, y, PZ]);
  const adi = [0, 1.85],
    adiHole = Array.from({ length: 28 }, (_, i) => [
      adi[0] + Math.cos((i * Math.PI) / 14) * 0.05,
      adi[1] + Math.sin((i * Math.PI) / 14) * 0.05,
      PZ,
    ]);
  sheet(d, panel, face, [0, 0, -1], [adiHole]);
  sheet(
    d,
    panel.map(([x, y]) => [x, y, PZ + 0.06]),
    black,
    [0, 0, 1],
  );
  outline(d, panel.slice(1, 5), 0.014, m.accent, false);
  // Coaming from the panel top forward to the windshield base, below the pilot's sightline.
  quad(
    d,
    [0.31, 2.02, PZ],
    [-0.31, 2.02, PZ],
    [-0.5, 2.03, 3.35],
    [0.5, 2.03, 3.35],
    m.accent,
    [0, 1, 0],
  );
  ins.horizon('front-ADI', [adi[0], adi[1], PZ + 0.008], 0.1, 0.1, {
    round: true,
    blankBackdrop: true,
  });
  d.ring(0.051, 0.005, [adi[0], adi[1], PZ - 0.004], black);
  ins.dial(
    'front-airspeed',
    [0.135, 1.86, PZ - 0.006],
    0.042,
    'knots',
    airspeed,
    [0, 100, 200, 300],
    'KNOTS',
    {
      responseSeconds: 0.2,
    },
  );
  ins.altimeter('front-altimeter', [-0.135, 1.86, PZ - 0.006], 0.042, 'feet');
  ins.dial(
    'front-heading',
    [0, 1.7, PZ - 0.006],
    0.045,
    'degreesTrue',
    [
      [0, 0],
      [360, Math.PI * 2],
    ],
    [0, 90, 180, 270],
    'HDG',
    { period: 2 * Math.PI, tickLabels: { 0: 'N', 90: 'E', 180: 'S', 270: 'W' } },
  );
  ins.dial(
    'front-VSI',
    [-0.135, 1.72, PZ - 0.006],
    0.038,
    'verticalFpm',
    vsi,
    [-4000, 0, 4000],
    'VSI',
  );
  pt.gauge(0.135, 1.72, PZ - 0.006, 0.034, black, false);
  d.text('CLOCK', [0.135, 1.705, PZ - 0.013], 0.006, Math.PI, ink);
  // Engine instruments on the right of the panel: torque and RPM for each engine, and fuel.
  for (const [j, x] of [
    [1, -0.255],
    [2, -0.335],
  ]) {
    ins.dial(
      `torque-${j}`,
      [x, 1.9, PZ - 0.006],
      0.034,
      `torque${j}`,
      percent,
      [0, 50, 100],
      `TQ ${j}`,
    );
    ins.dial(
      `rpm-${j}`,
      [x, 1.79, PZ - 0.006],
      0.034,
      `rpm${j}`,
      percent,
      [0, 50, 100],
      `RPM ${j}`,
    );
    pt.gauge(x, 1.68, PZ - 0.006, 0.03, black, false);
    d.text(`TIT ${j}`, [x, 1.665, PZ - 0.012], 0.005, Math.PI, ink);
  }
  ins.dial(
    'fuel',
    [-0.295, 1.565, PZ - 0.006],
    0.04,
    'fuelPounds',
    [
      [0, -2.3],
      [1600, 2.3],
    ],
    [0, 800, 1600],
    'FUEL LB',
  );
  // Flap position and gear lamps on the left of the panel, the wheel-shaped gear handle below.
  ins.dial(
    'flap-position',
    [0.3, 1.9, PZ - 0.006],
    0.03,
    'flapPosition',
    [
      [0, -1.4],
      [1, 1.4],
    ],
    [0, 1],
    'FLAPS',
    { tickLabels: { 0: 'UP', 1: 'DN' } },
  );
  for (const [index, x] of [0.27, 0.3, 0.33].entries()) {
    d.add(new T.CircleGeometry(0.008, 12).rotateY(Math.PI), black, [x, 1.79, PZ - 0.004]);
    const lamp = group(cabin, `Bronco-gear-lamp-${index}`, [x, 1.79, PZ - 0.006]),
      ld = detailKit(lamp, lamp.name);
    ld.add(new T.CircleGeometry(0.0065, 12).rotateY(Math.PI), d.green);
    ld.finish();
    bindings.push({
      node: lamp.name,
      source: 'gearLocked',
      property: 'visible',
      scale: 1,
      missing: 'hide',
    });
  }
  const transit = group(cabin, 'Bronco-gear-transit', [0.36, 1.79, PZ - 0.006]),
    td = detailKit(transit, transit.name);
  td.add(new T.CircleGeometry(0.0065, 12).rotateY(Math.PI), ins.red);
  td.finish();
  bindings.push({
    node: transit.name,
    source: 'gearInTransit',
    property: 'visible',
    scale: 1,
    missing: 'hide',
  });
  d.text('GEAR', [0.315, 1.815, PZ - 0.006], 0.006, Math.PI, ink);
  const gearHandle = group(cabin, 'Bronco-gear-handle', [0.32, 1.66, PZ - 0.012]),
    gh = detailKit(gearHandle, gearHandle.name);
  gh.box([0.012, 0.02, 0.01], [0, -0.012, 0.004], d.metal);
  gh.rod([0, 0, 0], [0, -0.03, -0.035], 0.004, d.metal);
  gh.add(
    new T.CylinderGeometry(0.016, 0.016, 0.012, 16).rotateX(Math.PI / 2),
    black,
    [0, -0.032, -0.04],
  );
  gh.finish();
  bindings.push({
    node: gearHandle.name,
    source: 'gear',
    property: 'rotation',
    axis: 'x',
    offset: 0.6,
    scale: -0.6,
  });
  // Standby compass on the coaming, offset so the windshield centre stays clear.
  ins.headingDrum('standby-compass', [-0.2, 2.07, 3.24], 0.022, 'trueHeading');
  d.box([0.06, 0.04, 0.05], [-0.2, 2.055, 3.265], black);

  // Floors: the rear cockpit sits 0.2 m higher than the front.
  fittedFloor(d, sections, m.dark, { y: 1.12, front: 3.3, back: 1.72, width: 1.04 });
  fittedFloor(d, sections, m.dark, { y: 1.32, front: 1.72, back: 0.45, width: 1.04 });
  d.box([0.98, 0.2, 0.03], [0, 1.22, 1.72], m.dark);
  // Aft bulkhead between the rear seat and the cargo bay.
  sheet(
    d,
    [4, 5, 6, 7, 8, 9, 10, 11, 12].map((j) => [...sections[8].points[j], sections[8].z + 0.02]),
    green,
    [0, 0, 1],
  );

  const cockpit = (tag, z, floor, eyeY) => {
    // Stick, pedals and the ejection seat. LW-3B-style seats: tall back, headbox, side rails.
    const stick = group(cabin, `Bronco-stick-${tag}`, [0, floor + 0.04, z + 0.42]),
      sd = detailKit(stick, `${stick.name}-moving`);
    sd.rod([0, 0, 0], [0, 0.5, -0.05], 0.014, d.metal);
    sd.add(new T.CylinderGeometry(0.019, 0.022, 0.12, 12), black, [0, 0.56, -0.058]);
    sd.box([0.016, 0.012, 0.016], [0, 0.625, -0.05], ins.red);
    sd.finish();
    d.add(new T.CylinderGeometry(0.06, 0.08, 0.06, 14), black, [0, floor + 0.03, z + 0.42]);
    bindings.push(
      { node: stick.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.15 },
      { node: stick.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.14 },
    );
    for (const side of [-1, 1]) {
      const pedal = group(cabin, `Bronco-pedal-${tag}-${side > 0 ? 'left' : 'right'}`, [
          side * 0.15,
          floor + 0.16,
          z + 0.78,
        ]),
        pd = detailKit(pedal, `${pedal.name}-moving`);
      pd.box([0.1, 0.16, 0.025], [0, 0, 0], d.metal);
      for (let j = 0; j < 4; j++)
        pd.box([0.09, 0.004, 0.006], [0, -0.06 + j * 0.04, -0.015], black);
      pd.rod([0, -0.08, 0.01], [0, -0.16, 0.1], 0.012, d.metal);
      pd.finish();
      bindings.push({
        node: pedal.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: side * 0.04,
      });
    }
    const seatZ = z - 0.12,
      pan = floor + 0.33;
    beveledBox(d, [0.46, 0.09, 0.44], [0, pan, seatZ + 0.04], cushion, 0.03);
    beveledBox(d, [0.5, 0.1, 0.48], [0, pan - 0.08, seatZ + 0.04], seatFrame, 0.02);
    const back = group(cabin, `Bronco-seat-back-${tag}`, [0, pan + 0.36, seatZ - 0.2]);
    back.rotation.x = -0.2;
    const bd = detailKit(back, back.name);
    beveledBox(bd, [0.44, 0.66, 0.08], [0, 0, 0.02], cushion, 0.03);
    beveledBox(bd, [0.52, 0.86, 0.14], [0, 0.06, -0.08], seatFrame, 0.025);
    beveledBox(bd, [0.32, 0.2, 0.16], [0, 0.46, -0.06], seatFrame, 0.03);
    beveledBox(bd, [0.26, 0.14, 0.05], [0, 0.44, 0.04], cushion, 0.02);
    for (const side of [-1, 1])
      bd.rod([side * 0.25, -0.4, -0.06], [side * 0.25, 0.48, -0.06], 0.02, d.metal);
    bd.finish();
    // Lower ejection handle between the knees, harness straps across the cushion.
    outline(
      d,
      [
        [-0.06, pan + 0.06, seatZ + 0.27],
        [-0.06, pan + 0.1, seatZ + 0.3],
        [0.06, pan + 0.1, seatZ + 0.3],
        [0.06, pan + 0.06, seatZ + 0.27],
      ],
      0.007,
      yellow,
      false,
    );
    for (const side of [-1, 1])
      d.rod(
        [side * 0.12, pan + 0.06, seatZ - 0.12],
        [side * 0.08, pan + 0.06, seatZ + 0.18],
        0.012,
        green,
      );
    // Side consoles under the sills; the lower fuselage narrows too fast for them to reach the
    // floor, so each stands on an inboard web.
    const top = floor + (floor > 1.2 ? 0.46 : 0.5);
    for (const side of [-1, 1]) {
      beveledBox(d, [0.12, 0.2, 0.95], [side * 0.38, top - 0.1, z + 0.05], consoleMat, 0.02);
      d.box(
        [0.02, top - 0.2 - floor, 0.8],
        [side * 0.33, (top - 0.2 + floor) / 2, z + 0.05],
        consoleMat,
      );
    }
    return { pan, eyeY };
  };
  cockpit('front', 2.55, 1.12, 2.3);
  cockpit('rear', 1.3, 1.32, 2.46);

  // Left console, front: power levers outboard, condition levers inboard, flap lever aft.
  const engineIds = ['engine-1', 'engine-2'];
  for (const [i, x] of [0.425, 0.4].entries()) {
    const lever = group(cabin, `Bronco-power-lever-${i + 1}`, [x, 1.62, 2.72]),
      ld = detailKit(lever, `${lever.name}-moving`);
    ld.rod([0, 0, 0], [0, 0.11, 0.01], 0.006, d.metal);
    beveledBox(ld, [0.026, 0.035, 0.04], [0, 0.125, 0.012], black, 0.008);
    ld.finish();
    bindings.push({
      node: lever.name,
      source: 'power',
      property: 'rotation',
      axis: 'x',
      offset: -0.45,
      scale: 0.9,
    });
  }
  for (const [i, x] of [0.365, 0.343].entries()) {
    const lever = group(cabin, `Bronco-condition-lever-${i + 1}`, [x, 1.62, 2.6]),
      ld = detailKit(lever, `${lever.name}-moving`);
    ld.rod([0, 0, 0], [0, 0.085, 0.01], 0.005, d.metal);
    beveledBox(ld, [0.018, 0.026, 0.03], [0, 0.095, 0.012], ins.red, 0.006);
    ld.finish();
    lever.userData.aircraftControl = {
      action: 'propeller',
      engine: engineIds[i],
      motion: { property: 'rotation', axis: 'x', scale: 0.65, offset: -0.65 },
    };
  }
  d.text('PWR COND', [0.38, 1.625, 2.9], 0.008, Math.PI / 2, ink);
  const flapLever = group(cabin, 'Bronco-flap-lever', [0.4, 1.62, 2.36]),
    fl = detailKit(flapLever, `${flapLever.name}-moving`);
  fl.rod([0, 0, 0], [0, 0.07, 0], 0.005, d.metal);
  fl.box([0.03, 0.012, 0.03], [0, 0.075, 0], ink);
  fl.finish();
  bindings.push({
    node: flapLever.name,
    source: 'flapPosition',
    property: 'rotation',
    axis: 'x',
    scale: -0.6,
  });
  // Rear cockpit power levers follow the front pair (mechanically linked).
  for (const [i, x] of [0.425, 0.4].entries()) {
    const lever = group(cabin, `Bronco-rear-pwr-${i + 1}`, [x, 1.78, 1.48]),
      ld = detailKit(lever, `${lever.name}-moving`);
    ld.rod([0, 0, 0], [0, 0.1, 0.01], 0.006, d.metal);
    beveledBox(ld, [0.024, 0.032, 0.036], [0, 0.112, 0.012], black, 0.008);
    ld.finish();
    bindings.push({
      node: lever.name,
      source: 'power',
      property: 'rotation',
      axis: 'x',
      offset: -0.45,
      scale: 0.9,
    });
  }
  // Right console, front: engine master and start switches, parking brake handle.
  const switches = [
    ['Bronco-engine-master', undefined, 2.82],
    ['Bronco-start-1', 'engine-1', 2.72],
    ['Bronco-start-2', 'engine-2', 2.64],
  ];
  for (const [name, engine, z] of switches) {
    const sw = group(cabin, name, [-0.38, 1.627, z]),
      sd = detailKit(sw, `${name}-moving`);
    sd.box([0.035, 0.012, 0.03], [0, 0, 0], engine ? black : ins.red);
    sd.rod([0, 0, 0], [0, 0.03, 0.006], 0.004, d.metal);
    sd.finish();
    sw.userData.aircraftControl = {
      action: 'engine',
      ...(engine ? { engine } : {}),
      motion: { property: 'rotation', axis: 'x', scale: -0.5 },
    };
  }
  d.text('MASTER START', [-0.38, 1.625, 2.92], 0.007, -Math.PI / 2, ink);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) pt.knob(-0.41 + c * 0.03, 1.627, 2.45 - r * 0.07, 0.007);
  const brake = group(cabin, 'Bronco-parking-brake', [-0.25, 1.52, PZ - 0.03]),
    bk = detailKit(brake, `${brake.name}-moving`);
  bk.rod([0, 0, 0], [0, 0, -0.05], 0.005, d.metal);
  bk.box([0.05, 0.016, 0.014], [0, 0, -0.055], black);
  bk.finish();
  brake.userData.aircraftControl = {
    action: 'brake',
    motion: { property: 'position', axis: 'z', scale: -0.022 },
  };
  d.text('PARK BRK', [-0.25, 1.545, PZ - 0.004], 0.005, Math.PI, ink);

  // ---- Rear cockpit: two instrument pods either side of the front seat's headbox, each a
  // flat face over a shallow housing. The left pod's attitude card shows through an aperture.
  const RZ = 1.94;
  const rearAdi = [0.27, 2.0];
  for (const side of [-1, 1]) {
    const contour = [
      [0.17, 1.8],
      [0.48, 1.8],
      [0.48, 2.08],
      [0.17, 2.08],
    ].map(([x, y]) => [side * x, y, RZ]);
    const holes =
      side > 0
        ? [
            Array.from({ length: 24 }, (_, i) => [
              rearAdi[0] + Math.cos((i * Math.PI) / 12) * 0.034,
              rearAdi[1] + Math.sin((i * Math.PI) / 12) * 0.034,
              RZ,
            ]),
          ]
        : [];
    sheet(d, contour, face, [0, 0, -1], holes);
    outline(d, contour, 0.008, m.accent);
    d.box([0.29, 0.26, 0.06], [side * 0.325, 1.94, RZ + 0.045], black);
  }
  ins.horizon('rear-ADI', [rearAdi[0], rearAdi[1], RZ + 0.006], 0.066, 0.066, {
    round: true,
    blankBackdrop: true,
  });
  ins.dial(
    'rear-airspeed',
    [0.4, 2.0, RZ - 0.006],
    0.036,
    'knots',
    airspeed,
    [0, 100, 200, 300],
    'KNOTS',
    {
      responseSeconds: 0.2,
    },
  );
  ins.dial(
    'rear-heading',
    [0.27, 1.87, RZ - 0.006],
    0.034,
    'degreesTrue',
    [
      [0, 0],
      [360, Math.PI * 2],
    ],
    [0, 90, 180, 270],
    'HDG',
    { period: 2 * Math.PI, tickLabels: { 0: 'N', 90: 'E', 180: 'S', 270: 'W' } },
  );
  ins.dial('rear-VSI', [0.4, 1.87, RZ - 0.006], 0.034, 'verticalFpm', vsi, [-4000, 0, 4000], 'VSI');
  ins.altimeter('rear-altimeter', [-0.27, 2.0, RZ - 0.006], 0.036, 'feet');
  ins.dial('rear-rpm-1', [-0.4, 2.0, RZ - 0.006], 0.034, 'rpm1', percent, [0, 50, 100], 'RPM 1');
  ins.dial('rear-rpm-2', [-0.4, 1.87, RZ - 0.006], 0.034, 'rpm2', percent, [0, 50, 100], 'RPM 2');
  ins.dial(
    'rear-fuel',
    [-0.27, 1.87, RZ - 0.006],
    0.034,
    'fuelPounds',
    [
      [0, -2.3],
      [1700, 2.3],
    ],
    [0, 800, 1600],
    'FUEL LB',
  );
  d.finish();
  return { nodes: ['cockpit'], sources, derived, bindings };
}
