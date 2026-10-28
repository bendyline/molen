/** UH-1H: TM 55-1520-210-10 figs 2-2, 2-4, 2-5 and cited photographs.
 * Rotor mast is z=0. The nose is 11 ft 8.65 in forward, independently of rotor envelope.
 * Construction landmarks are meters; window apertures and panels are individually authored.
 */
import {
  cleanGeometry,
  detailKit,
  ellipsoid,
  glazing,
  group,
  loft,
  mat,
  outline,
  quad,
  sheet,
  T,
  wing,
} from './mesh-kit.mjs';

export function hueyFrame() {
  return {
    heli: true,
    fighter: false,
    large: false,
    radius: 1.05,
    cy: 1.24,
    ry: 1.08,
    cabinZ: 2.05,
    cabinWidth: 1.98,
    eye: [-0.47, 1.9, 1.65],
    panelZ: 2.66,
    floor: 0.48,
    mainRotorPosition: [0, 3.98, 0],
  };
}
export function buildHuey(s) {
  const root = new T.Group();
  root.name = s.slug;
  const f = hueyFrame();
  let d = detailKit(root, 'huey-airframe');
  const paint = mat('huey-olive-drab', '#59634a', { side: T.DoubleSide }),
    seam = mat('huey-joints', '#323a2e'),
    metal = mat('huey-machined-metal', '#858b85', { metalness: 0.7, roughness: 0.42 }),
    rubber = mat('huey-rubber', '#202623'),
    glass = mat('huey-glazing', '#9bb9bb', {
      transparent: true,
      opacity: 0.17,
      depthWrite: false,
      roughness: 0.16,
      side: T.DoubleSide,
    }),
    roofGlass = mat('huey-green-skylights', '#355b3c', {
      transparent: true,
      opacity: 0.56,
      depthWrite: false,
      side: T.DoubleSide,
    });
  const fasteners = (points, spacing = 0.13) => {
    for (let i = 0; i < points.length; i++) {
      const a = new T.Vector3(...points[i]),
        b = new T.Vector3(...points[(i + 1) % points.length]),
        n = Math.max(1, Math.floor(a.distanceTo(b) / spacing));
      for (let j = 1; j < n; j++)
        d.add(
          new T.SphereGeometry(0.0045, 6, 3),
          metal,
          a
            .clone()
            .lerp(b, j / n)
            .toArray(),
        );
    }
  };
  // Main cabin: flat door sides, chamfered belly/roof, no generic elliptical pod.
  const cabinRing = (w, bottom, top) => [
    [0, top],
    [w * 0.8, top - 0.025],
    [w, top - 0.25],
    [w, 1.06],
    [w * 0.79, bottom + 0.07],
    [0, bottom],
    [-w * 0.79, bottom + 0.07],
    [-w, 1.06],
    [-w, top - 0.25],
    [-w * 0.8, top - 0.025],
  ];
  const sections = [
    { z: 1.45, points: cabinRing(1.05, 0.66, 2.68) },
    { z: -1.65, points: cabinRing(1.05, 0.67, 2.68) },
    { z: -2.35, points: cabinRing(0.88, 0.76, 2.35) },
    { z: -2.7, points: cabinRing(0.57, 1.2, 2.14) },
  ];
  loft(d, sections, paint, { caps: false, skip: (i, j) => i === 0 && (j === 2 || j === 7) });
  // Side sheets have actual holes for two sliding-door windows.
  for (const side of [-1, 1]) {
    const x = side * 1.05;
    const wall = [
      [x, 1.06, 1.45],
      [x, 2.43, 1.45],
      [x, 2.43, -1.65],
      [x, 1.06, -1.65],
    ];
    const windows = [0.62, -0.67].map((z) => [
      [x, 1.58, z + 0.43],
      [x, 2.23, z + 0.43],
      [x, 2.23, z - 0.43],
      [x, 1.58, z - 0.43],
    ]);
    sheet(d, wall, paint, [side, 0, 0], windows);
    for (const window of windows) {
      glazing(d, window, glass, seam, 0.017, [side, 0, 0]);
      fasteners(window);
    }
    // Sliding door boundary, top track and handles.
    outline(
      d,
      [
        [x + 0.006 * side, 0.92, 1.15],
        [x + 0.006 * side, 2.49, 1.15],
        [x + 0.006 * side, 2.49, -1.45],
        [x + 0.006 * side, 0.92, -1.45],
      ],
      0.007,
      seam,
    );
    d.rod([x, 2.55, 1.25], [x, 2.55, -1.85], 0.018, paint);
    d.rod([x + 0.025 * side, 1.4, 1.02], [x + 0.025 * side, 1.4, 0.84], 0.015, metal);
    d.rod([x + 0.025 * side, 1.4, -1.3], [x + 0.025 * side, 1.4, -1.12], 0.015, metal);
  }
  // Rounded nose and broad curved chin windows, fitted to the front and side references.
  // Rows: height, half-width, forward extent. Glazing follows authored pane boundaries.
  const noseRows = [
    [0.69, 0.65, 3.06],
    [0.8, 0.88, 3.35],
    [1.0, 1.02, 3.53],
    [1.2, 1.05, 3.57251],
    [1.4, 1.02, 3.48],
    [1.6, 0.96, 3.35],
    [1.73, 0.91, 3.23],
  ];
  const angles = [-Math.PI / 2, -1.3, -1.05, -0.75, -0.4, 0, 0.4, 0.75, 1.05, 1.3, Math.PI / 2];
  const nosePoint = (row, a) => [
    row[1] * Math.sin(a),
    row[0] - Math.max(0, row[0] - 1.4) * (0.28 / 0.33) * Math.sin(a) * Math.sin(a),
    2.88 + (row[2] - 2.88) * Math.cos(a),
  ];
  for (let r = 0; r < noseRows.length - 1; r++)
    for (let a = 0; a < angles.length - 1; a++) {
      const pane = r >= 1 && r <= 3 && ((a >= 1 && a <= 3) || (a >= 6 && a <= 8));
      quad(
        d,
        nosePoint(noseRows[r], angles[a]),
        nosePoint(noseRows[r], angles[a + 1]),
        nosePoint(noseRows[r + 1], angles[a + 1]),
        nosePoint(noseRows[r + 1], angles[a]),
        pane ? glass : paint,
        [Math.sin((angles[a] + angles[a + 1]) / 2), 0, 1],
      );
    }
  for (const side of [-1, 1]) {
    const pane = [
      ...noseRows.slice(1, 5).map((row) => nosePoint(row, side * 0.4)),
      ...angles.slice(7, 10).map((a) => nosePoint(noseRows[4], a * side)),
      ...noseRows
        .slice(1, 4)
        .reverse()
        .map((row) => nosePoint(row, side * 1.3)),
      ...angles
        .slice(6, 9)
        .reverse()
        .map((a) => nosePoint(noseRows[1], a * side)),
    ];
    outline(d, pane, 0.022, paint);
  }
  const noseContour = [
    [0, 1.73],
    ...noseRows.toReversed().map((row) => [row[1], nosePoint(row, Math.PI / 2)[1]]),
    [0, 0.66],
    ...noseRows.map((row) => [-row[1], nosePoint(row, Math.PI / 2)[1]]),
  ];
  loft(
    d,
    [
      { z: 2.88, points: noseContour },
      {
        z: 2.3,
        points: noseContour.map(([x, y]) => [Math.sign(x) * Math.min(1.05, Math.abs(x) * 1.1), y]),
      },
      {
        z: 1.45,
        points: noseContour.map(([x, y]) => [Math.sign(x) * Math.min(1.05, Math.abs(x) * 1.1), y]),
      },
    ],
    paint,
    { caps: false, skip: (_i, j) => j === 0 || j === noseContour.length - 1 },
  );
  sheet(d, [...angles.map((a) => nosePoint(noseRows[0], a)), [0, 0.66, 2.88]], paint, [0, -1, 0]);
  for (const side of [-1, 1]) {
    // Windscreen and corner pane, individually located rather than cut from an oval shell.
    const lower = [],
      upper = [];
    for (let i = 0; i <= 4; i++) {
      const u = i / 4,
        x = 0.035 + 0.875 * u;
      lower.push(nosePoint(noseRows.at(-1), side * Math.asin(x / 0.91)));
      upper.push([side * (0.035 + 0.785 * u), 2.63 - 0.06 * u * u, 2.54 - 0.27 * u * u]);
    }
    for (let i = 0; i < 4; i++)
      quad(d, lower[i], lower[i + 1], upper[i + 1], upper[i], glass, [side * 0.25, 0.35, 1]);
    const front = [...lower, ...upper.toReversed()];
    outline(d, front, 0.032, paint);
    fasteners(front, 0.09);
    const corner = [
      [side * 0.91, 1.45, 2.88],
      [side * 1.05, 1.55, 2.52],
      [side * 1.02, 2.43, 2.05],
      [side * 0.82, 2.57, 2.27],
    ];
    glazing(d, corner, glass, paint, 0.025, [side, 0.2, 0.3]);
    const door = [
      [side * 1.05, 0.76, 2.52],
      [side * 1.05, 1.55, 2.52],
      [side * 1.02, 2.43, 2.05],
      [side * 1.05, 2.43, 1.45],
      [side * 1.05, 0.76, 1.45],
    ];
    // Flat door uses a slightly inset window; the lower skin stays opaque.
    const win = [
      [side * 1.051, 1.25, 2.4],
      [side * 1.051, 1.55, 2.4],
      [side * 1.031, 2.32, 2.0],
      [side * 1.051, 2.32, 1.57],
      [side * 1.051, 1.25, 1.57],
    ];
    sheet(d, door, paint, [side, 0, 0], [win]);
    glazing(d, win, glass, seam, 0.014, [side, 0, 0]);
    outline(d, door, 0.012, seam);
    d.rod([side * 1.08, 1.08, 1.72], [side * 1.08, 1.08, 1.92], 0.016, metal);
    // Roof quarter and tinted overhead window.
    const roof = [
      [side * 0.035, 2.63, 2.54],
      [side * 0.82, 2.57, 2.27],
      [side * 1.02, 2.43, 2.05],
      [side * 0.84, 2.655, 1.45],
      [side * 0.035, 2.68, 1.45],
    ];
    const sky = [
      [side * 0.18, 2.645, 2.36],
      [side * 0.67, 2.62, 2.18],
      [side * 0.76, 2.65, 1.65],
      [side * 0.18, 2.675, 1.65],
    ];
    sheet(d, roof, paint, [0, 1, 0], [sky]);
    glazing(d, sky, roofGlass, paint, 0.025, [0, 1, 0]);
    sheet(
      d,
      [
        [side * 1.02, 2.43, 2.05],
        [side * 1.05, 2.43, 1.45],
        [side * 0.84, 2.655, 1.45],
      ],
      paint,
      [side, 0.5, 0],
    );
    // Overhead wiper spindles and blades, resting at the top of the glazing.
    d.rod([side * 0.7, 2.5, 2.31], [side * 0.48, 2.37, 2.52], 0.012, seam);
    d.rod([side * 0.25, 2.37, 2.6], [side * 0.71, 2.34, 2.43], 0.013, rubber);
  }
  d.rod([0, 1.72, 3.23], [0, 2.63, 2.54], 0.033, paint);
  // Engine/transmission cowling above the cabin, with a raised forward fairing and aft exhaust.
  const cowl = (z, w, low, high) => ({
    z,
    points: [
      [0, high],
      [w * 0.76, high - 0.035],
      [w, low + 0.15],
      [w, low],
      [-w, low],
      [-w, low + 0.15],
      [-w * 0.76, high - 0.035],
    ],
  });
  loft(
    d,
    [
      cowl(0.67, 0.18, 2.67, 2.78),
      cowl(0.23, 0.58, 2.68, 3.08),
      cowl(-0.63, 0.62, 2.67, 3.16),
      cowl(-1.72, 0.53, 2.48, 3.01),
      cowl(-2.15, 0.34, 2.3, 2.82),
    ],
    paint,
  );
  for (const side of [-1, 1])
    for (let i = 0; i < 9; i++)
      d.box([0.015, 0.1, 0.026], [side * 0.604, 2.91, -0.5 - i * 0.065], seam);
  d.add(
    new T.CylinderGeometry(0.245, 0.28, 0.42, 24, true).rotateX(Math.PI / 2),
    metal,
    [0, 2.74, -2.28],
  );
  d.add(new T.CircleGeometry(0.237, 24).rotateY(Math.PI), rubber, [0, 2.74, -2.5]);
  // Cabin datum: ground to roof is approximately 2.39 m in the dimensioned side view.
  // Keep the rotor and tail datums independent; cabin coordinates above use a local origin.
  d.finish();
  d.root.position.y = -0.29;
  d = detailKit(root, 'huey-running-structure');
  // Tapered tail boom; its section and raised tail-fin junction are structurally distinct.
  const boom = (z, w, cy, h) => ({
    z,
    points: [
      [0, cy + h],
      [w * 0.72, cy + h * 0.72],
      [w, cy],
      [w * 0.72, cy - h * 0.72],
      [0, cy - h],
      [-w * 0.72, cy - h * 0.72],
      [-w, cy],
      [-w * 0.72, cy + h * 0.72],
    ],
  });
  loft(
    d,
    [
      boom(-2.43, 0.58, 1.39, 0.48),
      boom(-4.4, 0.39, 1.55, 0.34),
      boom(-6.6, 0.235, 1.69, 0.235),
      boom(-8.15, 0.14, 1.82, 0.16),
      boom(-8.63, 0.09, 1.93, 0.12),
    ],
    paint,
  );
  for (const side of [-1, 1]) {
    const fin = [
      [side * 0.075, 1.76, -7.79],
      [side * 0.055, 2.03, -8.16],
      [side * 0.045, 3.26, -8.93],
      [side * 0.045, 3.27, -9.05],
      [side * 0.06, 1.91, -8.85],
    ];
    sheet(d, fin, paint, [side, 0, 0]);
    outline(d, fin, 0.023, paint);
    wing(
      d,
      [
        [side * 0.26, 1.72, -5.7, -6.48],
        [side * 1.4262, 1.72, -5.74, -6.46],
      ],
      paint,
      0.045,
    );
  }
  d.rod([0, 1.73, -8.13], [0, 1.54, -8.86], 0.025, seam);
  d.rod([0, 1.54, -8.86], [0, 1.57, -9.05], 0.025, seam);
  // Low skids, bowed cross tubes, and curved forward toes. No triangular strut substitution.
  for (const side of [-1, 1]) {
    outline(
      d,
      [
        [side * 1.23802, 0.38, 2.58],
        [side * 1.23802, 0.21, 2.4],
        [side * 1.23802, 0.07, 2.12],
        [side * 1.23802, 0.07, -1.12],
      ],
      0.065,
      metal,
      false,
    );
    for (const z of [1.6, -0.62])
      outline(
        d,
        [
          [side * 0.61, 0.39, z],
          [side * 0.83, 0.47, z],
          [side * 1.1, 0.43, z],
          [side * 1.23802, 0.14, z],
        ],
        0.047,
        metal,
        false,
      );
    d.box([0.16, 0.03, 0.28], [side * 1.14, 0.38, 1.75], seam);
  }
  // Mast, rotating two-blade teetering hub and stabilizer bar.
  d.add(new T.CylinderGeometry(0.085, 0.12, 0.88, 16), metal, [0, 3.26, 0]);
  d.rod([0, 3.65, 0], [0, 3.99, 0], 0.065, metal);
  for (const [radius, y] of [
    [0.25, 2.88],
    [0.21, 2.99],
    [0.15, 3.66],
  ])
    d.ring(radius, 0.028, [0, y, 0], metal, 'y');
  for (const side of [-1, 1])
    d.rod([side * 0.2, 2.97, 0.12], [side * 0.14, 3.76, 0.09], 0.018, metal);
  const rotor = group(root, 'main-rotor', [0, 3.98, 0]),
    rd = detailKit(rotor, 'main-rotor-detail');
  rd.box([0.66, 0.15, 0.2], [0, 0, 0], metal);
  for (const side of [-1, 1]) {
    rd.rod([side * 0.24, 0, 0], [side * 0.98, 0.025, 0], 0.045, metal);
    wing(
      rd,
      [
        [side * 0.77, 0, 0.24, -0.24],
        [side * 1.35, 0.005, 0.28, -0.26],
        [side * 7.27, 0.06, 0.25, -0.23],
        [side * 7.315, 0.06, 0.2, -0.19],
      ],
      rubber,
      0.018,
    );
    rd.box([0.15, 0.012, 0.43], [side * 7.14, 0.073, 0.01], rd.amber);
    rd.rod([0, 0.17, 0], [0, 0.17, side * 1.26], 0.024, metal);
    rd.box([0.16, 0.1, 0.29], [0, 0.17, side * 1.23], metal);
    rd.rod([side * 0.24, 0.06, 0], [0, 0.17, side * 0.55], 0.017, metal);
  }
  rd.finish();
  d.rod([0, 3.13, -8.88], [0.36, 3.13, -8.88], 0.065, metal);
  const tail = group(root, 'tail-rotor', [0.37, 3.13, -8.88]),
    td = detailKit(tail, 'tail-rotor-detail');
  for (const side of [-1, 1]) {
    td.rod([0, 0, 0], [0, side * 0.22, 0], 0.032, metal);
    td.box([0.035, 1.13, 0.16], [0, side * 0.73, 0], rubber);
    td.box([0.04, 0.14, 0.16], [0, side * 1.23, 0], td.red);
  }
  td.finish();
  // Navigation fittings and service joints are deliberately subordinate to the outline.
  d.rod([0.24, 2.39, 1.88], [0.24, 2.6, 2.04], 0.015, metal);
  d.rod([0, 2.82, -1.16], [0, 3.21, -1.46], 0.012, seam);
  for (const side of [-1, 1])
    ellipsoid(d, [side * 1.075, 1.46, 1.27], [0.035, 0.048, 0.075], side < 0 ? d.green : d.red, 12);
  for (const z of [-3.1, -4.8, -6.55]) {
    const section =
      z === -3.1
        ? boom(z, 0.51, 1.44, 0.43)
        : z === -4.8
          ? boom(z, 0.36, 1.58, 0.31)
          : boom(z, 0.24, 1.69, 0.24);
    outline(
      d,
      section.points.map((p) => [...p, z]),
      0.003,
      seam,
    );
  }
  d.finish();
  const interior = addHueyCockpit(root);
  cleanGeometry(root);
  return {
    root,
    frame: f,
    enginePoints: [],
    visual: {
      rotors: [
        { node: 'main-rotor', axis: 'y', multiplier: 1 },
        { node: 'tail-rotor', axis: 'x', multiplier: 5 },
      ],
      gearNodes: [],
      flaps: [],
      ailerons: [],
      animation: { bindings: [] },
      interior,
    },
  };
}

function addHueyCockpit(root) {
  const cabin = group(root, 'cockpit', [0, -0.29, 0]),
    d = detailKit(cabin, 'huey-cockpit');
  const panel = mat('huey-panel', '#343a36'),
    coaming = mat('huey-coaming', '#202622', { roughness: 0.95 }),
    floor = mat('huey-floor', '#495044'),
    seat = mat('huey-seat-webbing', '#7c8061', { roughness: 0.95 }),
    face = mat('huey-gauge-face', '#101a17'),
    ink = mat('huey-gauge-ink', '#bec8a7'),
    sky = mat('huey-attitude-sky', '#7896a1'),
    earth = mat('huey-attitude-earth', '#69573f');
  const bindings = [];
  d.box([1.93, 0.055, 4.05], [0, 0.77, 0.35], floor);
  // Rear bench and internal door panels visible through the side windows.
  for (const side of [-1, 1]) {
    d.box([0.42, 0.1, 1.75], [side * 0.73, 1.03, -0.45], seat);
    d.box([0.09, 0.45, 1.75], [side * 0.91, 1.3, -0.45], seat);
    for (const z of [0.25, -0.65])
      d.rod([side * 0.73, 0.81, z], [side * 0.73, 0.98, z], 0.023, d.metal);
  }
  // Figure 2-4, PDF page 77 rasterized to 1700 px high: uniform relative calibration.
  // The face's 1.76 m width is an authored cabin-fit assumption, not a published dimension.
  // Keeping source image coordinates makes the relative outline/instrument layout auditable.
  const drawingScale = 1.76 / 703;
  const panelDrawing = (x, y) => [(689.5 - x) * drawingScale, 1.22 + (715 - y) * drawingScale];
  const panelOutline = [
    [338, 500],
    [425, 467],
    [550, 447],
    [690, 439],
    [825, 449],
    [960, 475],
    [1041, 502],
    [1041, 679],
    [1027, 705],
    [995, 715],
    [530, 715],
    [490, 704],
    [371, 704],
    [345, 694],
    [338, 675],
  ].map(([x, y]) => panelDrawing(x, y));
  const panelPoint = (x, y, z = 2.68) => [x, y, z + (1.62 - y) * 0.12];
  // The windshield sweeps aft at its corners. Keep the calibrated instrument face
  // flat, but taper the forward housing depth so its shoulders stay behind the glass.
  const panelFront = (x, y) => panelPoint(x, y, 2.96 - 0.24 * (x / 0.88) ** 2);
  sheet(
    d,
    panelOutline.map(([x, y]) => panelPoint(x, y)),
    panel,
    [0, 0, -1],
  );
  sheet(
    d,
    panelOutline.map(([x, y]) => panelFront(x, y)),
    coaming,
    [0, 0, 1],
  );
  for (let i = 0; i < panelOutline.length; i++) {
    const a = panelOutline[i],
      b = panelOutline[(i + 1) % panelOutline.length];
    quad(d, panelPoint(...a), panelPoint(...b), panelFront(...b), panelFront(...a), panel, [
      a[0],
      a[1] - 1.6,
      0,
    ]);
  }
  // Rounded hood wraps around, with visible forward depth, rather than a rectangular shelf.
  const hood = [
    [334, 599],
    [302, 539],
    [287, 477],
    [302, 444],
    [376, 413],
    [482, 387],
    [594, 376],
    [690, 375],
    [802, 379],
    [917, 396],
    [1018, 427],
    [1082, 459],
    [1100, 483],
    [1085, 541],
    [1062, 599],
  ].map(([px, py]) => {
    const [x, y] = panelDrawing(px, py);
    // Pull only the overhanging ears inward; preserve the opening around the panel.
    const width = Math.min(Math.abs(x), 0.88) + Math.max(0, Math.abs(x) - 0.88) * 0.25;
    return [Math.sign(x) * width, y];
  });
  const hoodFront = (x, y) => panelPoint(x, y, 2.93 - 0.29 * (x / 0.96) ** 2);
  for (let i = 0; i < hood.length - 1; i++) {
    const a = panelPoint(...hood[i], 2.58),
      b = panelPoint(...hood[i + 1], 2.58),
      c = hoodFront(...hood[i + 1]),
      e = hoodFront(...hood[i]);
    quad(d, a, b, c, e, coaming, [0, 1, 0]);
  }
  d.path(
    hood.map((p) => panelPoint(...p, 2.58)),
    0.022,
    coaming,
  );
  const hoodInner = [
    [338, 599],
    [338, 500],
    [425, 467],
    [550, 447],
    [690, 439],
    [825, 449],
    [960, 475],
    [1041, 502],
    [1041, 599],
  ].map(([x, y]) => panelDrawing(x, y));
  sheet(
    d,
    [...hood, ...hoodInner.toReversed()].map(([x, y]) => panelPoint(x, y, 2.58)),
    coaming,
    [0, 0, -1],
  );
  const instrument = (x, y, r, name, source = 'rpm', style = 'dial') => {
    const z = panelPoint(x, y)[2] - 0.015;
    d.box([r * 2.16, r * 2.16, 0.018], [x, y, z], coaming);
    d.ring(r, 0.008, [x, y, z - 0.014], d.dark);
    d.add(new T.CircleGeometry(r * 0.91, 28).rotateY(Math.PI), face, [x, y, z - 0.017]);
    if (style === 'attitude') {
      d.add(new T.CircleGeometry(r * 0.86, 24, 0, Math.PI).rotateY(Math.PI), sky, [x, y, z - 0.02]);
      d.add(new T.CircleGeometry(r * 0.86, 24, Math.PI, Math.PI).rotateY(Math.PI), earth, [
        x,
        y,
        z - 0.02,
      ]);
      for (const q of [-2, -1, 1, 2])
        d.box([r * 0.55, 0.002, 0.001], [x, y + q * r * 0.19, z - 0.023], ink);
    }
    for (let i = 0; i < 24; i++) {
      const angle = Math.PI * (-0.25 + (i * 1.5) / 23),
        outer = r * 0.84,
        inner = r * (i % 4 === 0 ? 0.68 : 0.77);
      d.rod(
        [x + Math.cos(angle) * inner, y + Math.sin(angle) * inner, z - 0.023],
        [x + Math.cos(angle) * outer, y + Math.sin(angle) * outer, z - 0.023],
        0.0016,
        ink,
      );
    }
    if (style !== 'attitude')
      for (let i = 0; i < 5; i++) {
        const angle = Math.PI * (-0.25 + (i * 1.5) / 4);
        d.text(
          source === 'heading' ? ['E', 'S', 'W', 'N', 'E'][i] : String(i * 2),
          [x + Math.cos(angle) * r * 0.58, y + Math.sin(angle) * r * 0.58, z - 0.025],
          r * 0.19,
          Math.PI,
          ink,
        );
      }
    const label = name.includes('altimeter')
      ? 'ALT'
      : name.includes('speed')
        ? 'KNOTS'
        : name.includes('torque')
          ? 'TORQUE'
          : name.includes('hsi')
            ? 'HDG'
            : name.includes('vsi')
              ? 'CLIMB'
              : name.includes('tachometer')
                ? 'RPM'
                : name.includes('oil')
                  ? 'OIL'
                  : name.includes('fuel')
                    ? 'FUEL'
                    : '';
    if (label) d.text(label, [x, y - r * 0.35, z - 0.026], r * 0.12, Math.PI, ink);
    const pointer = group(cabin, `huey-${name}-pointer`, [x, y, z - 0.026]),
      pd = detailKit(pointer, `huey-${name}-needle`);
    if (style === 'attitude') {
      pd.box([r * 1.15, 0.004, 0.003], [0, 0, 0], pd.amber);
      pd.box([0.006, r * 0.22, 0.003], [0, -r * 0.1, 0], pd.amber);
    } else {
      pd.rod([0, -r * 0.15, 0], [0, r * 0.69, 0], 0.0022, ink);
      if (name === 'dual-tachometer') pd.rod([0, 0, 0], [r * 0.58, r * 0.1, 0], 0.002, pd.amber);
      pd.add(new T.CircleGeometry(r * 0.09, 12).rotateY(Math.PI), ink, [0, 0, -0.002]);
    }
    pd.finish();
    bindings.push({
      node: pointer.name,
      source,
      property: 'rotation',
      axis: 'z',
      scale:
        style === 'attitude'
          ? 1
          : source === 'airspeed'
            ? 0.043
            : source === 'altitude'
              ? 0.0206
              : source === 'heading'
                ? -1
                : 3.7,
      offset: style === 'attitude' ? 0 : -1.8,
    });
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        d.add(new T.CircleGeometry(0.0028, 6).rotateY(Math.PI), d.metal, [
          x + sx * r * 0.96,
          y + sy * r * 0.96,
          z - 0.011,
        ]);
  };
  // Manual instrument centers/radii in pixels. Pilot is right (-X); left panel differs.
  for (const [px, py, pr, name, source, style] of [
    [384, 532, 26, 'copilot-speed', 'airspeed'],
    [450, 531, 29, 'copilot-attitude', 'roll', 'attitude'],
    [520, 533, 27, 'copilot-altimeter', 'altitude'],
    [449, 600, 27, 'copilot-heading', 'heading'],
    [519, 601, 27, 'copilot-vsi', 'verticalSpeed'],
    [844, 533, 27, 'pilot-speed', 'airspeed'],
    [922, 533, 35, 'pilot-attitude', 'roll', 'attitude'],
    [999, 533, 26, 'pilot-altimeter', 'altitude'],
    [999, 600, 26, 'pilot-vsi', 'verticalSpeed'],
    [920, 622, 29, 'pilot-hsi', 'heading'],
    [832, 605, 24, 'pilot-rpm', 'rpm'],
    [832, 672, 24, 'pilot-turn', 'yaw'],
    [1002, 657, 19, 'clock', 'rpm'],
    [624, 514, 17, 'fuel-pressure', 'power'],
    [665, 513, 17, 'fuel-quantity', 'power'],
    [624, 552, 17, 'oil-pressure', 'rpm'],
    [665, 553, 17, 'oil-temperature', 'rpm'],
    [624, 595, 17, 'transmission-pressure', 'rpm'],
    [666, 594, 17, 'transmission-temperature', 'rpm'],
    [771, 529, 25, 'dual-tachometer', 'rpm'],
    [771, 588, 17, 'gas-producer', 'rpm'],
    [771, 632, 17, 'torque', 'power'],
    [771, 677, 17, 'exhaust-temperature', 'power'],
    [669, 642, 18, 'dc-voltage', 'rpm'],
    [670, 686, 18, 'ac-voltage', 'rpm'],
  ]) {
    const [x, y] = panelDrawing(px, py);
    instrument(x, y, pr * drawingScale, name, source, style);
  }
  for (const [px, py] of [
    [421, 441],
    [678, 417],
    [833, 424],
    [967, 449],
  ]) {
    const [x, y] = panelDrawing(px, py);
    d.box([0.085, 0.035, 0.018], panelPoint(x, y, 2.56), d.dark);
    d.box([0.055, 0.012, 0.003], panelPoint(x, y, 2.548), d.amber);
  }
  // Distinct blanking, warning and HSI control panels occupy the remaining reference areas.
  for (const [px, py, pw, ph] of [
    [579, 528, 37, 50],
    [548, 661, 99, 50],
    [563, 705, 65, 16],
    [622, 640, 28, 27],
    [622, 680, 28, 27],
    [716, 548, 51, 23],
    [724, 657, 60, 13],
    [919, 688, 79, 22],
  ]) {
    const [x, y] = panelDrawing(px, py);
    d.box([pw * drawingScale, ph * drawingScale, 0.012], panelPoint(x, y, 2.655), coaming);
  }
  // Radio/control pedestal slopes down toward the seats; it is separate from the flight panel.
  const pedestal = group(cabin, 'huey-center-pedestal', [0, 1.13, 1.87]);
  pedestal.rotation.x = Math.PI / 2 - 0.13;
  const cd = detailKit(pedestal, 'huey-pedestal');
  cd.box([0.41, 1.47, 0.16], [0, 0, 0.06], panel);
  const knob = (x, y, r = 0.017) => {
    cd.add(new T.CylinderGeometry(r, r, 0.022, 8).rotateX(Math.PI / 2), cd.dark, [x, y, -0.049]);
    cd.box([0.003, r * 0.8, 0.003], [x, y + r * 0.35, -0.062], ink);
  };
  const toggle = (x, y, color = cd.metal) => {
    cd.rod([x, y, -0.037], [x, y + 0.013, -0.073], 0.005, color);
  };
  // Fuel/system switches, paired communications controllers, navigation receiver and audio.
  // Exact radio installations vary; these groupings follow the cited Greek Army cockpit.
  cd.box([0.37, 0.21, 0.008], [0, 0.57, -0.026], coaming);
  for (const x of [-0.13, -0.07, 0, 0.07, 0.13]) toggle(x, 0.55);
  cd.box([0.055, 0.06, 0.04], [0.07, 0.61, -0.064], cd.red);
  knob(-0.12, 0.64, 0.025);
  for (const y of [0.31, 0.12]) {
    cd.box([0.37, 0.17, 0.008], [0, y, -0.026], coaming);
    cd.box([0.16, 0.04, 0.008], [0.015, y + 0.033, -0.035], face);
    for (const x of [-0.14, -0.055, 0.065, 0.14]) knob(x, y - 0.035, x === -0.14 ? 0.025 : 0.015);
    cd.text(y > 0.2 ? 'VHF' : 'UHF', [0, y + 0.057, -0.041], 0.014, Math.PI, ink);
  }
  cd.box([0.37, 0.21, 0.008], [0, -0.1, -0.026], coaming);
  cd.add(new T.CircleGeometry(0.038, 16).rotateY(Math.PI), face, [-0.09, -0.09, -0.036]);
  knob(-0.15, -0.16);
  knob(0.13, -0.14, 0.022);
  cd.box([0.14, 0.035, 0.006], [0.06, -0.055, -0.038], ink);
  for (const x of [-0.025, 0.025, 0.075, 0.125]) toggle(x, -0.14);
  cd.box([0.37, 0.18, 0.008], [0, -0.31, -0.026], coaming);
  for (let i = 0; i < 7; i++) toggle((i - 3) * 0.043, -0.3);
  knob(-0.13, -0.36, 0.013);
  knob(0.13, -0.36, 0.013);
  // Map-case lid and latch occupy the aft end instead of another cloned radio.
  cd.box([0.37, 0.29, 0.025], [0, -0.56, -0.033], panel);
  cd.rod([-0.07, -0.56, -0.055], [0.07, -0.56, -0.055], 0.009, cd.metal);
  cd.finish();
  // Seat frames, fabric pads, armor sides, four-point harness and floor-mounted curved cyclics.
  for (const side of [-1, 1]) {
    const x = side * 0.47;
    d.box([0.43, 0.11, 0.49], [x, 1.14, 1.78], seat);
    const back = d.box([0.44, 0.62, 0.095], [x, 1.48, 1.53], seat);
    back.rotation.x = -0.08;
    for (const edge of [-1, 1]) {
      d.rod([x + edge * 0.22, 0.79, 1.57], [x + edge * 0.22, 1.17, 1.57], 0.024, d.metal);
      d.box([0.025, 0.62, 0.32], [x + edge * 0.25, 1.48, 1.55], floor);
      d.rod([x + edge * 0.12, 1.77, 1.47], [x + edge * 0.035, 1.19, 1.91], 0.018, coaming);
      d.rod([x + edge * 0.22, 1.18, 1.7], [x + edge * 0.035, 1.19, 1.91], 0.022, coaming);
    }
    d.box([0.065, 0.042, 0.025], [x, 1.2, 1.92], d.metal);
    const stick = group(cabin, `huey-cyclic-${side}`, [x, 0.8, 2.16]),
      sd = detailKit(stick, 'cyclic');
    outline(
      sd,
      [
        [0, 0, 0],
        [0, 0.32, 0],
        [0, 0.48, -0.14],
        [0, 0.64, -0.19],
      ],
      0.023,
      sd.dark,
      false,
    );
    const grip = sd.box([0.075, 0.16, 0.067], [0, 0.68, -0.18], coaming);
    grip.rotation.x = 0.2;
    sd.box([0.025, 0.018, 0.018], [-0.024, 0.77, -0.2], sd.red);
    sd.finish();
    bindings.push(
      { node: stick.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.13 },
      { node: stick.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.12 },
    );
    const collective = group(cabin, `huey-collective-${side}`, [x + 0.26, 0.95, 1.57]),
      ld = detailKit(collective, 'collective');
    ld.rod([0, 0, 0], [0, 0.13, 0.48], 0.025, ld.dark);
    ld.box([0.07, 0.06, 0.19], [0, 0.14, 0.48], coaming);
    ld.box([0.022, 0.014, 0.024], [-0.018, 0.18, 0.53], ld.red);
    ld.finish();
    bindings.push({
      node: collective.name,
      source: 'power',
      property: 'rotation',
      axis: 'x',
      scale: -0.35,
    });
    for (const pedalSide of [-1, 1]) {
      const pedal = group(cabin, `huey-pedal-${side}-${pedalSide}`, [
          x + pedalSide * 0.13,
          0.91,
          2.61,
        ]),
        pd = detailKit(pedal, 'pedal');
      pd.box([0.17, 0.11, 0.025], [0, 0, 0], d.dark);
      for (let r = 0; r < 4; r++)
        pd.box([0.14, 0.004, 0.005], [0, (r - 1.5) * 0.021, -0.017], d.metal);
      pd.finish();
      bindings.push({
        node: pedal.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: -pedalSide * 0.045,
      });
    }
  }
  // Overhead: separate breaker banks and paired lighting/engine control columns.
  d.box([0.53, 0.05, 0.66], [0, 2.58, 1.97], panel);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 8; c++)
      d.add(new T.CylinderGeometry(0.008, 0.008, 0.013, 6), d.dark, [
        (c - 3.5) * 0.055,
        2.545,
        1.71 + r * 0.042,
      ]);
  for (const x of [-0.14, 0.14])
    for (let r = 0; r < 3; r++) d.box([0.23, 0.008, 0.115], [x, 2.549, 1.94 + r * 0.12], coaming);
  for (const x of [0.08, 0.2])
    for (const z of [1.92, 2.04, 2.16]) {
      d.add(new T.CylinderGeometry(0.022, 0.022, 0.019, 8), d.dark, [x, 2.535, z]);
      d.box([0.005, 0.006, 0.025], [x, 2.522, z], ink);
    }
  for (const z of [1.92, 2.04, 2.16])
    for (const x of [-0.2, -0.08]) d.rod([x, 2.54, z], [x, 2.51, z + 0.012], 0.005, d.metal);
  d.finish();
  return { nodes: ['cockpit'], bindings };
}
