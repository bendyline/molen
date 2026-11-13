/**
 * Freight cars: 50 ft high-cube boxcar, three-bay covered hopper, DOT-117 tank car, 53 ft
 * double-stack well car, enclosed bi-level autorack, 52 ft mill gondola and centerbeam flatcar.
 * All share freightBase (three-piece trucks, couplers) and the parts in rail-geometry.mjs.
 * Front +Z, +X the car's left, y = 0 top of rail, z = 0 midway between the truck centres.
 */
import '../../worldgen/scripts/install-deterministic-math.mjs';
import * as T from 'three';
import {
  brakeGear,
  brakeWheel,
  corrugations,
  coupler,
  freightTruck,
  grab,
  group,
  ladder,
  letter,
  Mesher,
  railMaterials,
  reflectors,
  seeded,
  sideText,
  sillStep,
  stencilBlock,
} from './rail-geometry.mjs';

// --- Shared freight car frame --------------------------------------------------------------------

/**
 * Root, trucks (axle-1..4 front to rear) and both couplers for a two-truck freight car. Returns
 * the root, the body Mesher (emitted by `finishFreight`) and the striker half-length.
 */
export function freightBase(recipe, M, name) {
  const root = group(name);
  const body = group('body');
  root.add(body);
  const r = recipe.wheelRadius,
    tc = recipe.truckCenters / 2,
    wb = recipe.truckWheelbase ?? 1.778;
  root.add(
    freightTruck(
      M,
      'truck-front',
      tc,
      [
        ['axle-1', wb / 2],
        ['axle-2', -wb / 2],
      ],
      { r, wheelbase: wb },
    ),
  );
  root.add(
    freightTruck(
      M,
      'truck-rear',
      -tc,
      [
        ['axle-3', wb / 2],
        ['axle-4', -wb / 2],
      ],
      { r, wheelbase: wb },
    ),
  );
  const m = new Mesher();
  const face = recipe.couplerLength / 2;
  const striker = recipe.length / 2;
  for (const dir of [1, -1])
    coupler(m, M, dir, face, striker, {
      halfWidth: recipe.width / 2 - 0.1,
      sillY: recipe.sillY ?? 1.0,
    });
  return { root, body, m, r, tc, striker };
}

/** Underframe common to box-type cars: centre sill, body bolsters, cross bearers, end sills. */
export function underframe(
  m,
  M,
  { striker, tc, halfWidth, floorY, sillBottom, center = true, bearers = [] },
) {
  if (center)
    m.span(M.frame, [-0.21, 0.68, -striker + 0.02], [0.21, floorY - 0.04, striker - 0.02]);
  for (const s of [1, -1]) {
    // Body bolsters over the trucks and the end sills at the strikers.
    m.span(
      M.frame,
      [-halfWidth + 0.05, 0.69, s * tc - 0.2],
      [halfWidth - 0.05, floorY - 0.05, s * tc + 0.2],
    );
    m.span(
      M.frame,
      [-halfWidth + 0.04, sillBottom - 0.1, s * striker - 0.14],
      [halfWidth - 0.04, floorY, s * striker],
    );
  }
  for (const z of bearers)
    m.span(
      M.frame,
      [-halfWidth + 0.08, floorY - 0.3, z - 0.08],
      [halfWidth - 0.08, floorY - 0.05, z + 0.08],
    );
}

export function finishFreight(root, body, m, extraNodes = []) {
  m.emit(body);
  for (const node of extraNodes) root.add(node);
  return root;
}

/** Reporting marks and data stencils at the left end of each side, plus FRA reflectors. */
export function carMarkings(
  m,
  M,
  { halfWidth, number, markY, z, dataY, reflectY, reflectZ, height = 0.27, ink = M.lettering },
) {
  for (const side of [1, -1]) {
    const x = side * (halfWidth + 0.004);
    const zz = side * z;
    sideText(m, ink, 'MLNX', side, x, markY, zz, height);
    sideText(m, ink, number, side, x, markY - height * 1.45, zz, height * 0.8);
    if (dataY !== undefined) {
      stencilBlock(m, ink, side, x, dataY, zz + side * 0.2, 1.1, 4);
      stencilBlock(m, ink, side, x, dataY, -zz - side * 0.1, 0.8, 3);
    }
    if (reflectZ) reflectors(m, M, side, side * halfWidth, reflectY, reflectZ);
  }
}

// --- 50 ft high-cube boxcar ---------------------------------------------------------------------

export function boxcar(recipe) {
  const M = railMaterials({ body: recipe.color });
  const { root, body, m, tc, striker } = freightBase(recipe, M, 'boxcar-50ft');
  const H = 1.53, // side sheet half-width
    E = striker - 0.12, // end sheet outer face
    sill = 1.0,
    floor = 1.17,
    eave = 4.92,
    ridge = 5.1;
  underframe(m, M, {
    striker,
    tc,
    halfWidth: H,
    floorY: floor,
    sillBottom: sill,
    bearers: [-3.2, 3.2],
  });
  // Side sheets (outer face at ±H), side sills, top chords and exterior hat-section posts that
  // stop at the door posts.
  const door = 1.55;
  for (const s of [1, -1]) {
    m.slab(
      M.body,
      [
        [-E, sill],
        [E, sill],
        [E, eave],
        [-E, eave],
      ],
      0.03,
      'zy',
      [s > 0 ? H : -H + 0.03, 0, 0],
    );
    m.span(M.body, [s * H - 0.03, sill - 0.08, -E], [s * (H + 0.04), sill + 0.12, E]);
    m.span(M.body, [s * H - 0.03, eave - 0.1, -E - 0.02], [s * (H + 0.05), eave, E + 0.02]);
    const posts = [];
    for (let i = 0; i < 6; i++) {
      const z = door + 0.42 + (i * (E - door - 0.6)) / 5.4;
      posts.push(z, -z);
    }
    for (const z of posts) {
      m.box(M.body, [0.045, eave - sill - 0.12, 0.11], [s * (H + 0.022), (sill + eave) / 2, z]);
      m.box(M.body, [0.02, eave - sill - 0.12, 0.18], [s * (H + 0.006), (sill + eave) / 2, z]);
    }
    // Plug door: panel standing proud in the opening, door posts and header, horizontal
    // stiffeners, top and bottom tracks, operating pipes and the two locking bars with cams.
    const dx = s * (H + 0.025);
    m.box(M.body, [0.04, eave - 0.32 - floor, 2 * door - 0.1], [dx, (eave - 0.32 + floor) / 2, 0]);
    for (const z of [-door, door])
      m.box(M.body, [0.07, eave - sill - 0.1, 0.12], [s * (H + 0.035), (sill + eave) / 2, z]);
    m.box(M.body, [0.07, 0.14, 2 * door + 0.12], [s * (H + 0.035), eave - 0.25, 0]);
    for (let i = 0; i < 6; i++)
      m.box(M.body, [0.025, 0.07, 2 * door - 0.2], [s * (H + 0.055), floor + 0.35 + i * 0.6, 0]);
    for (const y of [floor + 0.05, eave - 0.36]) {
      m.box(M.frame, [0.05, 0.06, 2 * door + 3.2], [s * (H + 0.055), y, s * -1.5]);
      m.cyl(M.steel, 0.022, 0.022, 2 * door - 0.1, [s * (H + 0.075), y + 0.12, 0], 'z', 6);
    }
    for (const z of [-0.75, 0.75]) {
      m.cyl(
        M.steel,
        0.02,
        0.02,
        eave - floor - 0.5,
        [s * (H + 0.085), (eave + floor) / 2 - 0.1, z],
        'y',
        6,
      );
      for (const y of [floor + 0.25, eave - 0.55])
        m.box(M.frame, [0.05, 0.1, 0.12], [s * (H + 0.08), y, z]);
      m.box(M.steel, [0.03, 0.05, 0.42], [s * (H + 0.1), floor + 1.4, z - 0.2]);
    }
    // Door stops at the far end of the track.
    m.box(M.frame, [0.07, 0.2, 0.1], [s * (H + 0.06), floor + 0.1, s * -(2 * door + 1.6)]);
  }
  // Ends: corrugated (horizontal ribs), corner posts, gable to the roof.
  for (const dir of [1, -1]) {
    m.slab(
      M.body,
      [
        [-H, sill],
        [H, sill],
        [H, eave],
        [0, ridge - 0.03],
        [-H, eave],
      ],
      0.03,
      'xy',
      [0, 0, dir > 0 ? E - 0.03 : -E],
    );
    for (let i = 0; i < 7; i++) {
      const y = sill + 0.45 + i * 0.52;
      m.box(M.body, [2 * H - 0.3, 0.2, 0.05], [0, y, dir * (E + 0.02)]);
      m.box(M.body, [2 * H - 0.5, 0.1, 0.03], [0, y, dir * (E + 0.055)]);
    }
    for (const s of [1, -1])
      m.box(
        M.body,
        [0.12, eave - sill, 0.12],
        [s * (H - 0.03), (sill + eave) / 2, dir * (E - 0.03)],
      );
  }
  // Peaked roof sheet with an eave overhang and raised panel seams.
  m.slab(
    M.body,
    [
      [-H - 0.05, eave - 0.02],
      [-H - 0.05, eave + 0.03],
      [0, ridge + 0.05],
      [H + 0.05, eave + 0.03],
      [H + 0.05, eave - 0.02],
      [0, ridge],
    ],
    2 * E + 0.1,
    'xy',
    [0, 0, -E - 0.05],
  );
  for (let i = 0; i <= 12; i++) {
    const z = -E + 0.3 + (i * (2 * E - 0.6)) / 12;
    for (const s of [1, -1]) {
      const a = Math.atan2(ridge - eave, H);
      m.box(
        M.body,
        [Math.hypot(H, ridge - eave), 0.03, 0.08],
        [s * H * 0.5, (eave + ridge) / 2 + 0.05, z],
        [0, 0, -s * a],
      );
    }
  }
  // Safety appliances: side ladders at all four corners, end ladders, sill steps, grabs.
  for (const s of [1, -1])
    for (const dir of [1, -1]) {
      ladder(m, M.body, {
        x: s * (H + 0.02),
        z: dir * (E - 0.42),
        y0: sill - 0.05,
        y1: 3.4,
        width: 0.42,
        along: 'z',
        out: 0.05,
      });
      sillStep(m, M.body, s * (H + 0.04), dir * (E - 0.12), sill + 0.05);
      grab(
        m,
        M.body,
        [s * (H + 0.02), 3.75, dir * (E - 0.62)],
        [s * (H + 0.02), 3.75, dir * (E - 0.22)],
        [s, 0, 0],
      );
    }
  for (const dir of [1, -1]) {
    const x = -dir * 0.95;
    ladder(m, M.body, {
      x,
      z: dir * (E + 0.08),
      y0: floor,
      y1: 3.3,
      width: 0.42,
      along: 'x',
      out: 0.08,
    });
    grab(
      m,
      M.body,
      [dir * 0.2, floor + 0.35, dir * (E + 0.08)],
      [dir * 0.75, floor + 0.35, dir * (E + 0.08)],
      [0, 0, dir],
    );
  }
  // B end (rear): high-mounted brake wheel and brake step.
  brakeWheel(m, M, -1, 0.75, 3.45, -(E + 0.08));
  m.span(M.steel, [0.3, 2.62, -(E + 0.42)], [1.2, 2.66, -(E + 0.06)]);
  for (const x of [0.32, 1.18]) m.rod(M.frame, [x, 2.62, -(E + 0.4)], [x, 2.25, -(E + 0.08)], 0.02);
  brakeGear(m, M, -0.6, 0.86);
  carMarkings(m, M, {
    halfWidth: H + 0.03,
    number: recipe.number ?? '501234',
    markY: 4.1,
    z: 5.0,
    dataY: 2.1,
    reflectY: sill + 0.04,
    reflectZ: [-7.2, -5.4, -3.6, 3.6, 5.4, 7.2],
  });
  return { model: finishFreight(root, body, m) };
}

const sheetMat = (name, color, metalness = 0.25, roughness = 0.62) =>
  new T.MeshStandardMaterial({ name, color, metalness, roughness, flatShading: true });

// --- Three-bay covered hopper (5,161 cu ft class) ----------------------------------------------

export function coveredHopper(recipe) {
  const M = railMaterials({ body: recipe.color });
  const { root, body, m, tc, striker } = freightBase(recipe, M, 'covered-hopper');
  const H = 1.53,
    top = 4.36,
    crown = 4.46,
    knee = 4.08, // where the sloped end sheet meets the vertical end
    E = striker - 0.4,
    bottom = 1.45, // side sheet lower edge over the bays
    bay = 5.55; // the end slope meets the side sheet bottom here
  const slope = (E - bay) / (knee - bottom); // dz per metre of height
  const slopeY = (z) => bottom + (Math.abs(z) - bay) / slope;
  // Side sheets: trapezoids whose lower corners follow the sloped ends.
  const outline = [
    [-bay, bottom],
    [bay, bottom],
    [E, knee],
    [E, top],
    [-E, top],
    [-E, knee],
  ];
  for (const s of [1, -1]) {
    m.slab(M.body, outline, 0.03, 'zy', [s > 0 ? H : -H + 0.03, 0, 0]);
    m.span(M.body, [s * H - 0.02, bottom - 0.08, -bay], [s * (H + 0.05), bottom + 0.06, bay]);
    for (const d of [1, -1])
      m.rod(M.body, [s * (H + 0.02), bottom, d * bay], [s * (H + 0.02), knee, d * E], 0.045, 4);
    m.span(M.body, [s * H - 0.02, top - 0.12, -E - 0.03], [s * (H + 0.06), top, E + 0.03]);
    // Exterior side posts down to the sheet's lower edge.
    for (let i = -8; i <= 8; i++) {
      const z = i * 0.93;
      const y0 = Math.abs(z) <= bay ? bottom : slopeY(z);
      if (y0 > top - 0.4) continue;
      m.box(M.body, [0.05, top - 0.12 - y0, 0.1], [s * (H + 0.025), (top - 0.12 + y0) / 2, z]);
    }
  }
  // Sloped end sheets with the short vertical end above them.
  for (const d of [1, -1]) {
    m.face(
      M.body,
      [
        [-H, knee, d * E],
        [H, knee, d * E],
        [H, bottom, d * bay],
        [-H, bottom, d * bay],
      ],
      [0, 0.6, d],
    );
    m.face(
      M.body,
      [
        [-H, knee, d * E],
        [H, knee, d * E],
        [H, top, d * E],
        [-H, top, d * E],
      ],
      [0, 0, d],
    );
    for (const x of [-0.75, 0, 0.75])
      m.rod(
        M.body,
        [x, knee - 0.05, d * (E + 0.02)],
        [x, bottom + 0.4, d * (bay + 0.4 * slope + 0.02)],
        0.035,
        4,
      );
  }
  // Three hopper bays: chutes converging on an outlet gate with its capstans.
  for (const c of [-3.7, 0, 3.7]) {
    const a = [c - 1.85, c + 1.85],
      gate = 0.42,
      low = 0.68;
    const T0 = [
      [-H, bottom, a[0]],
      [H, bottom, a[0]],
      [H, bottom, a[1]],
      [-H, bottom, a[1]],
    ];
    const B0 = [
      [-gate, low, c - gate],
      [gate, low, c - gate],
      [gate, low, c + gate],
      [-gate, low, c + gate],
    ];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const mid = [(T0[i][0] + T0[j][0]) / 2, 0, (T0[i][2] + T0[j][2]) / 2 - c];
      m.face(M.body, [T0[i], T0[j], B0[j], B0[i]], [mid[0], -0.5, mid[2]]);
    }
    m.span(M.frame, [-0.5, low - 0.04, c - 0.5], [0.5, low, c + 0.5]);
    m.span(M.frame, [-0.45, low - 0.2, c - 0.45], [0.45, low - 0.04, c + 0.45]);
    m.cyl(M.frame, 0.03, 0.03, 1.6, [0, low - 0.14, c + 0.3], 'x', 6);
    for (const s of [1, -1])
      m.cyl(M.steel, 0.07, 0.07, 0.1, [s * 0.82, low - 0.14, c + 0.3], 'x', 6);
  }
  // Roof with a continuous trough hatch: coaming, eight covers, latches.
  m.slab(
    M.body,
    [
      [-H - 0.04, top - 0.02],
      [0, crown - 0.04],
      [H + 0.04, top - 0.02],
      [H + 0.04, top + 0.02],
      [0.9, crown - 0.005],
      [0, crown],
      [-0.9, crown - 0.005],
      [-H - 0.04, top + 0.02],
    ],
    2 * E + 0.06,
    'xy',
    [0, 0, -E - 0.03],
  );
  m.span(M.body, [-0.36, crown - 0.03, -E + 0.4], [0.36, crown + 0.08, E - 0.4]);
  for (let i = 0; i < 8; i++) {
    const z0 = -E + 0.45 + (i * (2 * E - 0.9)) / 8,
      z1 = z0 + (2 * E - 0.9) / 8 - 0.04;
    m.span(M.body, [-0.4, crown + 0.08, z0], [0.4, crown + 0.12, z1]);
    for (const s of [1, -1])
      m.box(M.frame, [0.05, 0.08, 0.1], [s * 0.42, crown + 0.06, (z0 + z1) / 2]);
  }
  // Stub sills and bolsters, end platforms under the sloped ends, ladders, grabs, hand brake.
  for (const d of [1, -1]) {
    m.span(M.frame, [-0.21, 0.68, d * 5.9], [0.21, 1.1, d * striker]);
    m.span(M.frame, [-1.4, 0.69, d * tc - 0.2], [1.4, 1.05, d * tc + 0.2]);
    m.span(M.frame, [-H + 0.04, 0.82, d * (striker - 0.14)], [H - 0.04, 1.1, d * striker]);
    m.span(M.steel, [-H + 0.1, 1.1, d * (E - 0.6)], [H - 0.1, 1.14, d * (striker - 0.04)]);
    // End ladder rising from the platform to the roof, braced back to the slope sheet.
    const x = -d * 1.12;
    const lz = d * (E + 0.08);
    for (const u of [-0.21, 0.21])
      m.box(M.body, [0.05, top - 1.14, 0.012], [x + u, (top + 1.14) / 2, lz]);
    for (let y = 1.4; y < top - 0.1; y += 0.4)
      m.rod(M.body, [x - 0.21, y, lz], [x + 0.21, y, lz], 0.012, 5);
    for (const y of [1.6, 2.6, 3.6]) {
      const back = y < knee ? bay + (y - bottom) * slope : E;
      for (const u of [-0.21, 0.21]) m.rod(M.body, [x + u, y, lz], [x + u, y, d * back], 0.012, 4);
    }
    for (const s of [1, -1]) {
      sillStep(m, M.body, s * (H - 0.05), d * (striker - 0.3), 1.12);
      grab(
        m,
        M.body,
        [s * (H + 0.02), 3.0, d * (E - 0.55)],
        [s * (H + 0.02), 3.0, d * (E - 0.15)],
        [s, 0, 0],
      );
    }
  }
  brakeWheel(m, M, -1, 0.6, 2.2, -(striker - 0.42));
  m.rod(M.frame, [0.6, 1.14, -(striker - 0.32)], [0.6, 1.7, -(striker - 0.32)], 0.04, 6);
  brakeGear(m, M, -7.3, 1.6, 0.55, false);
  carMarkings(m, M, {
    halfWidth: H + 0.03,
    number: recipe.number ?? '402215',
    markY: 3.85,
    z: 4.6,
    dataY: 2.25,
    reflectY: bottom - 0.02,
    reflectZ: [-5.0, -3.7, -1.2, 1.2, 3.7, 5.0],
    ink: M.ink,
  });
  return { model: finishFreight(root, body, m) };
}

// --- DOT-117 jacketed tank car -----------------------------------------------------------------

export function tankCar(recipe) {
  const M = railMaterials({ body: recipe.color });
  const { root, body, m, tc, striker } = freightBase(recipe, M, 'tank-car');
  const top = 4.15,
    R0 = 1.48,
    bulge = 0.06, // sloped bottom: the shell is deepest at the centre outlet
    half = 7.3,
    head = 0.74,
    seg = 32;
  const Rz = (z) => R0 + bulge * (1 - Math.min(1, Math.abs(z) / half));
  const cy = (z) => top - Rz(z);
  const ring = (z, r = Rz(z), y = cy(z)) =>
    Array.from({ length: seg }, (_, i) => {
      const a = (i / seg) * 2 * Math.PI;
      return [Math.sin(a) * r, y + Math.cos(a) * r, z];
    });
  m.loft(
    M.body,
    [-half, -half / 2, 0, half / 2, half].map((z) => ring(z)),
    { smooth: true },
  );
  // 2:1 heads under integral full-height head shields.
  for (const d of [1, -1]) {
    const rings = [0, 0.3, 0.55, 0.75, 0.9, 0.98].map((t) => {
      const a = (t * Math.PI) / 2;
      return ring(d * (half + head * Math.sin(a)), R0 * Math.cos(a), cy(half));
    });
    m.loft(M.body, rings, { smooth: true, caps: true });
  }
  // Jacket girth seams and the head-shield seam.
  for (const z of [-half, -4.6, -1.6, 1.6, 4.6, half])
    m.lathe(
      M.body,
      [
        [Rz(z) + 0.008, 0.03],
        [Rz(z) + 0.008, -0.03],
      ],
      seg,
      'z',
      [0, cy(z), z],
    );
  // Stub sills, bolsters with saddles, end sills.
  for (const d of [1, -1]) {
    m.span(M.frame, [-0.21, 0.7, d * 5.8], [0.21, 1.1, d * striker]);
    m.span(M.frame, [-1.35, 0.7, d * tc - 0.22], [1.35, 1.0, d * tc + 0.22]);
    const bottomAt = cy(tc) - Rz(tc);
    m.span(M.frame, [-0.75, 1.0, d * tc - 0.25], [0.75, bottomAt + 0.03, d * tc + 0.25]);
    m.span(M.frame, [-1.3, 0.82, d * (striker - 0.14)], [1.3, 1.1, d * striker]);
    m.span(M.frame, [-0.3, 1.1, d * (half - 0.2)], [0.3, cy(half) - R0 + 0.04, d * (half + 0.3)]);
    // End platform, low end railing, sill steps.
    m.span(M.steel, [-1.28, 1.1, d * (half + 0.1)], [1.28, 1.14, d * (striker - 0.03)]);
    for (const s of [1, -1]) {
      const x = s * 1.26,
        zo = d * (striker - 0.08),
        zi = d * (half + 0.15);
      m.rod(M.frame, [x, 1.14, zo], [x, 2.05, zo], 0.022);
      m.path(
        M.frame,
        [
          [x, 2.05, zi],
          [x, 2.05, zo],
          [s * 0.35, 2.05, zo],
        ],
        0.02,
        5,
      );
      m.rod(M.frame, [x, 1.6, zi], [x, 1.6, zo], 0.018);
      sillStep(m, M.frame, s * 1.3, d * (striker - 0.2), 1.12);
    }
  }
  brakeWheel(m, M, -1, 0.55, 1.95, -(striker - 0.3));
  m.rod(M.frame, [0.55, 1.14, -(striker - 0.25)], [0.55, 1.5, -(striker - 0.25)], 0.04, 6);
  brakeGear(m, M, -(half + 0.55), 1.25, 0.75, false);
  // Bottom outlet valve with its skid and operating handle.
  const low = cy(0) - Rz(0);
  m.cyl(M.frame, 0.13, 0.13, low - 0.78, [0, (low + 0.78) / 2, 0], 'y', 12);
  m.span(M.frame, [-0.28, 0.72, -0.28], [0.28, 0.84, 0.28]);
  m.rod(M.steel, [0, 0.95, 0.15], [1.3, 0.95, 0.15], 0.02);
  // Top fittings protective housing with its lid, operating platform, low railing.
  m.cyl(M.body, 0.55, 0.55, 0.42, [0, top + 0.13, 0], 'y', 24);
  m.cyl(M.body, 0.57, 0.57, 0.04, [0, top + 0.36, 0], 'y', 24);
  m.box(M.frame, [0.1, 0.08, 0.3], [0.6, top + 0.34, 0]);
  for (const d of [1, -1]) {
    m.span(M.steel, [-0.62, top + 0.04, d * 0.62], [0.62, top + 0.07, d * 1.45]);
    for (const s of [1, -1])
      m.rod(M.frame, [s * 0.58, top + 0.07, d * 1.4], [s * 0.58, top - 0.2, d * 1.4], 0.02);
  }
  for (const s of [1, -1]) {
    m.path(
      M.safety,
      [
        [s * 0.6, top + 0.07, -1.42],
        [s * 0.6, top + 0.42, -1.42],
        [s * 0.6, top + 0.42, 1.42],
        [s * 0.6, top + 0.07, 1.42],
      ],
      0.018,
      5,
    );
    // Side ladder at mid-length: vertical, then curving over the shell to the platform.
    const lx = s * (Rz(0) + 0.06);
    const pts = [
      [lx, 0.95],
      [lx, 3.05],
      [s * (Rz(0) - 0.12), 3.75],
      [s * 0.65, top + 0.07],
    ];
    for (const u of [-0.21, 0.21])
      m.path(
        M.frame,
        pts.map(([x, y]) => [x, y, u]),
        0.016,
        5,
      );
    for (let y = 1.15; y < 3.0; y += 0.38) m.rod(M.frame, [lx, y, -0.21], [lx, y, 0.21], 0.013, 5);
    for (const [x, y] of [
      [s * (Rz(0) - 0.03), 3.4],
      [s * (Rz(0) - 0.25), 3.85],
    ])
      m.rod(M.frame, [x, y, -0.21], [x, y, 0.21], 0.013, 5);
    for (const y of [1.6, 2.6])
      for (const u of [-0.21, 0.21])
        m.rod(M.frame, [lx, y, u], [s * (Rz(0) - 0.01), y, u], 0.012, 4);
    // Placard holder beside the ladder, lettering laid on the curved shell.
    const onShell = (dy, z) => {
      const R = Rz(z);
      const phi = Math.asin(dy / R);
      return {
        at: [s * Math.cos(phi) * (R + 0.006), cy(z) + Math.sin(phi) * (R + 0.006), z],
        up: [-s * Math.sin(phi), Math.cos(phi), 0],
      };
    };
    const plac = onShell(-0.2, -s * 1.15);
    m.box(M.lettering, [0.012, 0.3, 0.3], plac.at, [Math.PI / 4, 0, 0]);
    const zc = s * 4.6;
    const mark = onShell(0.5, zc);
    letter(m, M.lettering, 'MLNX', mark.at, [0, 0, -s], mark.up, 0.26);
    const num = onShell(0.12, zc);
    letter(m, M.lettering, recipe.number ?? '117045', num.at, [0, 0, -s], num.up, 0.22);
    const spec = onShell(-0.35, zc);
    letter(m, M.lettering, 'DOT-117J100W', spec.at, [0, 0, -s], spec.up, 0.09);
    const cap = onShell(0.3, -zc);
    letter(m, M.lettering, '30000 GAL', cap.at, [0, 0, -s], cap.up, 0.09);
  }
  for (const d of [1, -1])
    m.box(
      M.lettering,
      [0.3, 0.3, 0.012],
      [0, cy(half) + 0.25, d * (half + head * 0.86)],
      [0, 0, Math.PI / 4],
    );
  return { model: finishFreight(root, body, m) };
}

// --- 53 ft double-stack well car with two high-cube containers ----------------------------------

/** 53 ft high-cube box container: corrugated sides and front, doors at `doorDir`'s end. */
function container(m, material, M, { y0, half = 8.075, doorDir = -1 }) {
  const hw = 1.295,
    h = 2.896,
    y1 = y0 + h;
  const rail = 0.15;
  // Corrugated side walls between the corner posts.
  for (const s of [1, -1]) {
    const pts = corrugations(-half + 0.16, half - 0.16, 0.28, 0.035, 0.45);
    for (let i = 0; i + 1 < pts.length; i++) {
      const [za, da] = pts[i],
        [zb, db] = pts[i + 1];
      const xa = s * (hw - 0.04 + da),
        xb = s * (hw - 0.04 + db);
      m.face(
        material,
        [
          [xa, y0 + rail, za],
          [xb, y0 + rail, zb],
          [xb, y1 - 0.1, zb],
          [xa, y1 - 0.1, za],
        ],
        [s, 0, 0],
      );
    }
    m.span(material, [s * (hw - 0.06), y0, -half], [s * hw, y0 + rail, half]);
    m.span(material, [s * (hw - 0.06), y1 - 0.1, -half], [s * hw, y1, half]);
  }
  // Front end: vertical corrugations; door end: two leaves, locking bars, hinges.
  const front = -doorDir;
  const fp = corrugations(-hw + 0.16, hw - 0.16, 0.3, 0.035, 0.45);
  for (let i = 0; i + 1 < fp.length; i++) {
    const [xa, da] = fp[i],
      [xb, db] = fp[i + 1];
    const za = front * (half - 0.04 + da),
      zb = front * (half - 0.04 + db);
    m.face(
      material,
      [
        [xa, y0 + rail, za],
        [xb, y0 + rail, zb],
        [xb, y1 - 0.1, zb],
        [xa, y1 - 0.1, za],
      ],
      [0, 0, front],
    );
  }
  for (const d of [1, -1]) {
    m.span(material, [-hw, y0, d * (half - 0.06)], [hw, y0 + rail, d * half]);
    m.span(material, [-hw, y1 - 0.12, d * (half - 0.06)], [hw, y1, d * half]);
    for (const s of [1, -1]) {
      m.span(material, [s * (hw - 0.16), y0, d * (half - 0.16)], [s * hw, y1, d * half]);
      for (const y of [y0 + 0.06, y1 - 0.06])
        m.box(M.frame, [0.18, 0.12, 0.18], [s * (hw - 0.085), y, d * (half - 0.085)]);
    }
  }
  const dz = doorDir * (half - 0.01);
  for (const s of [1, -1]) {
    m.box(
      material,
      [hw - 0.17, h - 0.28, 0.03],
      [(s * (hw - 0.17)) / 2, (y0 + y1) / 2, dz - doorDir * 0.02],
    );
    for (const x of [0.33, 0.95]) {
      m.cyl(
        M.steel,
        0.018,
        0.018,
        h - 0.2,
        [s * x, (y0 + y1) / 2, dz + doorDir * 0.02],
        'y',
        6,
        true,
      );
      for (const y of [y0 + 0.18, y1 - 0.16])
        m.box(M.frame, [0.07, 0.07, 0.05], [s * x, y, dz + doorDir * 0.02]);
      m.box(M.frame, [0.05, 0.22, 0.05], [s * (x - 0.06), y0 + 1.2, dz + doorDir * 0.04]);
    }
    for (const y of [y0 + 0.4, y0 + 1.1, y0 + 1.8, y1 - 0.4])
      m.box(M.frame, [0.1, 0.08, 0.05], [s * (hw - 0.2), y, dz + doorDir * 0.02]);
  }
  m.box(M.dark, [0.03, h - 0.28, 0.02], [0, (y0 + y1) / 2, dz + doorDir * 0.005]);
  m.span(material, [-hw + 0.04, y1 - 0.04, -half + 0.05], [hw - 0.04, y1 - 0.01, half - 0.05]);
  m.span(material, [-hw + 0.04, y0 + 0.02, -half + 0.05], [hw - 0.04, y0 + 0.06, half - 0.05]);
}

export function wellCar(recipe) {
  const M = railMaterials({ body: recipe.color });
  const colors = recipe.containerColors ?? ['#8e4b3b', '#4d6b88'];
  const lower = sheetMat('container-lower', colors[0], 0.3, 0.6),
    upper = sheetMat('container-upper', colors[1], 0.3, 0.6);
  const { root, body, m, tc, striker } = freightBase(recipe, M, 'well-car');
  const G = 1.47,
    wellEnd = 8.14,
    floor = 0.24,
    deck = 1.15,
    girderTop = 1.97;
  // Side girders: deep in the well, stepping up over the trucks; top and bottom chords and
  // stiffeners on the outer face.
  const outline = [
    [-striker + 0.02, 1.0],
    [-(wellEnd + 0.35), 1.0],
    [-wellEnd, floor],
    [wellEnd, floor],
    [wellEnd + 0.35, 1.0],
    [striker - 0.02, 1.0],
    [striker - 0.02, girderTop],
    [-striker + 0.02, girderTop],
  ];
  for (const s of [1, -1]) {
    m.slab(M.body, outline, 0.03, 'zy', [s > 0 ? G : -G + 0.03, 0, 0]);
    m.span(
      M.body,
      [s * (G - 0.32), girderTop - 0.12, -striker + 0.02],
      [s * (G + 0.03), girderTop, striker - 0.02],
    );
    m.span(M.body, [s * (G - 0.22), floor, -wellEnd], [s * (G + 0.03), floor + 0.1, wellEnd]);
    for (let i = -7; i <= 7; i++)
      m.box(
        M.body,
        [0.03, girderTop - floor - 0.22, 0.08],
        [s * (G + 0.015), (girderTop + floor) / 2 - 0.01, i * 1.08],
      );
    for (const d of [1, -1]) {
      m.box(
        M.body,
        [0.03, girderTop - 1.0, 0.08],
        [s * (G + 0.015), (girderTop + 1.0) / 2, d * (wellEnd + 0.55)],
      );
      // Corner ladders and sill steps over the trucks.
      ladder(m, M.body, {
        x: s * (G + 0.02),
        z: d * (striker - 0.45),
        y0: 0.65,
        y1: girderTop + 0.4,
        width: 0.4,
        along: 'z',
        out: 0.05,
      });
      sillStep(m, M.body, s * (G + 0.03), d * (striker - 0.15), 1.02);
    }
  }
  // Well floor bearers and container guides at the four corners of the well.
  for (let i = -5; i <= 5; i++)
    m.span(M.frame, [-G + 0.03, floor, i * 1.5 - 0.07], [G - 0.03, floor + 0.11, i * 1.5 + 0.07]);
  for (const d of [1, -1]) {
    m.span(M.body, [-G + 0.03, 1.0, d * (wellEnd + 0.05)], [G - 0.03, deck, d * (striker - 0.02)]);
    m.span(M.frame, [-0.21, 0.68, d * (wellEnd + 0.4)], [0.21, 1.0, d * striker]);
    m.span(M.frame, [-1.4, 0.69, d * tc - 0.2], [1.4, 1.0, d * tc + 0.2]);
    m.span(M.body, [-G + 0.03, floor, d * (wellEnd - 0.12)], [G - 0.03, deck, d * wellEnd]);
    for (const s of [1, -1]) {
      m.box(M.body, [0.1, 1.2, 0.18], [s * 1.33, deck + 0.6, d * (wellEnd + 0.03)]);
      m.box(
        M.body,
        [0.08, 0.5, 0.1],
        [s * 1.33, deck + 1.35, d * (wellEnd + 0.12)],
        [-d * 0.5, 0, 0],
      );
      grab(
        m,
        M.body,
        [s * 0.4, deck + 0.3, d * striker],
        [s * 1.0, deck + 0.3, d * striker],
        [0, 0, d],
      );
    }
  }
  brakeWheel(m, M, -1, 0.75, 1.75, -(striker - 0.2), { housing: false });
  m.box(M.frame, [0.3, 0.45, 0.14], [0.75, 1.35, -(striker - 0.12)]);
  brakeGear(m, M, -(wellEnd + 0.9), 1.2, 0.6, false);
  // Reporting marks on the girder ends over the trucks.
  for (const s of [1, -1]) {
    const x = s * (G + 0.035),
      z = s * (striker - 1.9);
    sideText(m, M.lettering, 'MLNX', s, x, 1.72, z, 0.2);
    sideText(m, M.lettering, recipe.number ?? '720318', s, x, 1.42, z, 0.16);
    stencilBlock(m, M.lettering, s, x, 1.75, -z - s * 0.4, 0.7, 3);
    reflectors(m, M, s, s * (G + 0.03), girderTop - 0.25, [-6, -3, 0, 3, 6]);
  }
  m.emit(body);
  // The containers sit in the well, upper locked on the lower with interbox connectors.
  const load = group('load');
  const c = new Mesher();
  container(c, lower, M, { y0: floor + 0.1, doorDir: -1 });
  container(c, upper, M, { y0: floor + 0.1 + 2.9, doorDir: 1 });
  for (const s of [1, -1])
    for (const d of [1, -1]) c.box(M.frame, [0.14, 0.05, 0.14], [s * 1.2, floor + 3.0, d * 7.99]);
  c.emit(load);
  root.add(load);
  return { model: root };
}

// --- 89 ft enclosed bi-level autorack ------------------------------------------------------------

export function autorack(recipe) {
  const M = railMaterials({ body: recipe.color });
  const perforated = sheetMat('rail-perforated-panel', recipe.panelColor ?? '#8a9093', 0.45, 0.7);
  const { root, body, m, tc, striker } = freightBase(recipe, M, 'autorack');
  const H = 1.56,
    deck = 1.25,
    eave = 5.55,
    crown = 5.92,
    E = striker - 0.18;
  // 89 ft flatcar: side sills, deck, fishbelly centre sill, bolsters, end sills.
  for (const s of [1, -1]) m.span(M.frame, [s * 1.48, 0.95, -striker], [s * 1.56, deck, striker]);
  m.span(M.frame, [-1.5, deck - 0.06, -striker], [1.5, deck, striker]);
  m.slab(
    M.frame,
    [
      [-striker, 0.76],
      [-(tc + 0.3), 0.72],
      [-(tc - 1.6), 0.5],
      [tc - 1.6, 0.5],
      [tc + 0.3, 0.72],
      [striker, 0.76],
      [striker, deck - 0.06],
      [-striker, deck - 0.06],
    ],
    0.5,
    'zy',
    [0.25, 0, 0],
  );
  for (const d of [1, -1]) {
    m.span(M.frame, [-1.45, 0.7, d * tc - 0.22], [1.45, deck - 0.06, d * tc + 0.22]);
    m.span(M.frame, [-1.5, 0.82, d * (striker - 0.14)], [1.5, deck, d * striker]);
  }
  // Rack sides: posts, perforated panels between kick plate and fascia, rails, fascia.
  const bays = 19;
  for (const s of [1, -1]) {
    m.span(perforated, [s * (H - 0.08), deck + 0.2, -E], [s * (H - 0.06), eave - 0.8, E]);
    m.span(M.body, [s * (H - 0.08), deck, -E], [s * (H - 0.02), deck + 0.2, E]);
    m.span(M.body, [s * (H - 0.09), eave - 0.8, -E - 0.02], [s * H, eave, E + 0.02]);
    for (const y of [deck + 0.2, 3.15, eave - 0.8])
      m.span(M.body, [s * (H - 0.08), y - 0.05, -E], [s * (H - 0.02), y + 0.05, E]);
    for (let i = 0; i <= bays; i++) {
      const z = -E + (i * 2 * E) / bays;
      m.box(M.body, [0.08, eave - deck - 0.8, 0.12], [s * (H - 0.04), (eave - 0.8 + deck) / 2, z]);
      m.box(M.body, [0.02, eave - deck - 0.8, 0.2], [s * (H - 0.005), (eave - 0.8 + deck) / 2, z]);
    }
    for (let i = 0; i < bays; i++) {
      const z = -E + ((i + 0.5) * 2 * E) / bays;
      for (const y of [2.2, 4.1])
        m.box(M.body, [0.025, 0.04, (2 * E) / bays - 0.2], [s * (H - 0.05), y, z]);
    }
    // Corner ladders and sill steps on the flatcar.
    for (const d of [1, -1]) {
      ladder(m, M.body, {
        x: s * 1.58,
        z: d * (striker - 0.55),
        y0: 0.6,
        y1: 2.6,
        width: 0.4,
        along: 'z',
        out: 0.04,
      });
      sillStep(m, M.body, s * 1.56, d * (striker - 0.15), 0.97);
    }
  }
  // Arched roof with transverse ribs and an overhang.
  const arch = [];
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI * (i / 8);
    arch.push([-Math.cos(a) * (H + 0.03), eave + Math.sin(a) * (crown - eave - 0.02)]);
  }
  const roof = [
    ...arch,
    ...arch
      .slice()
      .reverse()
      .map(([x, y]) => [x * 0.985, y - 0.04]),
  ];
  m.slab(M.body, roof, 2 * E + 0.12, 'xy', [0, 0, -E - 0.06]);
  for (let k = 0; k <= 12; k++) {
    const z = -E + (k * 2 * E) / 12;
    for (let i = 0; i < 8; i++) {
      const [x0, y0] = arch[i],
        [x1, y1] = arch[i + 1];
      const len = Math.hypot(x1 - x0, y1 - y0);
      m.box(
        M.body,
        [len, 0.025, 0.06],
        [(x0 + x1) / 2, (y0 + y1) / 2 + 0.01, z],
        [0, 0, Math.atan2(y1 - y0, x1 - x0)],
      );
    }
  }
  // End doors: two perforated leaves in a frame, with locking bars and a header.
  for (const d of [1, -1]) {
    const z = d * E;
    m.span(M.body, [-H, eave - 0.3, z - 0.06], [H, eave, z + 0.06]);
    for (const s of [1, -1]) {
      m.span(M.body, [s * (H - 0.12), deck, z - 0.08], [s * H, eave, z + 0.08]);
      m.span(
        perforated,
        [s * 0.03, deck + 0.12, z - 0.015],
        [s * (H - 0.14), eave - 0.34, z + 0.015],
      );
      for (const y of [deck + 0.15, 3.1, eave - 0.38])
        m.span(M.body, [s * 0.03, y - 0.05, z - 0.03], [s * (H - 0.14), y + 0.05, z + 0.03]);
      m.span(M.body, [s * 0.03, deck + 0.12, z - 0.03], [s * 0.12, eave - 0.34, z + 0.03]);
      m.cyl(
        M.steel,
        0.02,
        0.02,
        eave - deck - 0.5,
        [s * 0.75, (eave + deck) / 2 - 0.1, z + d * 0.05],
        'y',
        6,
        true,
      );
      grab(
        m,
        M.body,
        [s * 1.2, deck + 0.3, d * (striker - 0.02)],
        [s * 0.6, deck + 0.3, d * (striker - 0.02)],
        [0, 0, d],
      );
    }
  }
  brakeWheel(m, M, -1, -1.0, 2.0, -(E + 0.12));
  brakeGear(m, M, -3.0, 0.85, 0.75);
  for (const s of [1, -1]) {
    const x = s * (H + 0.004);
    sideText(m, M.ink, `MLNX ${recipe.number ?? '801276'}`, s, x, eave - 0.4, s * (E - 4.2), 0.34);
    stencilBlock(m, M.ink, s, x, eave - 0.25, -s * (E - 2.2), 1.2, 3);
    reflectors(m, M, s, s * 1.56, 1.08, [-12, -8, -4, 0, 4, 8, 12]);
  }
  return { model: finishFreight(root, body, m) };
}

// --- 52 ft mill gondola with an optional scrap load ----------------------------------------------

function scrapLoad(hx, hz, floor, peak) {
  const load = group('load');
  const m = new Mesher();
  const rust = sheetMat('load-scrap', '#6f4b36', 0.3, 0.88),
    steel = sheetMat('load-scrap-steel', '#7b7872', 0.5, 0.62);
  const rnd = seeded(52061);
  const nx = 6,
    nz = 18;
  const height = (u, v) =>
    floor + 0.3 + (peak - floor - 0.3) * (1 - Math.pow(Math.abs(u), 3)) * (1 - v * v * 0.6);
  const grid = [];
  for (let j = 0; j <= nz; j++) {
    const row = [];
    for (let i = 0; i <= nx; i++) {
      const u = -1 + (2 * j) / nz,
        v = -1 + (2 * i) / nx;
      const edge = i === 0 || i === nx || j === 0 || j === nz;
      row.push([v * hx, height(u, v) + (edge ? 0 : (rnd() - 0.5) * 0.18), u * hz]);
    }
    grid.push(row);
  }
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++)
      m.face(rust, [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]], [0, 1, 0]);
  const surface = (x, z) => height(z / hz, x / hx);
  // Pieces lie roughly along the car (yaw within ±0.5 rad of the axis) and stay inside the
  // sides: the largest reach across the car is half their length times sin(yaw).
  for (let k = 0; k < 72; k++) {
    const kind = rnd();
    const mat = rnd() < 0.7 ? rust : steel;
    const length = kind < 0.4 ? 0.5 + rnd() * 0.8 : 0.8 + rnd() * 1.1;
    const jitter = (rnd() - 0.5) * 1.0;
    const yaw = Math.PI / 2 + jitter;
    const reach = (length / 2) * Math.abs(Math.sin(jitter)) + 0.15;
    const x = (rnd() * 2 - 1) * Math.max(0.05, hx - reach),
      z = (rnd() * 2 - 1) * (hz - length / 2 - 0.1);
    const rot = [(rnd() - 0.5) * 0.5, yaw, (rnd() - 0.5) * 0.5];
    const y = surface(x, z) + 0.02;
    if (kind < 0.4) m.box(mat, [length, 0.025, 0.3 + rnd() * 0.4], [x, y + 0.04, z], rot);
    else if (kind < 0.75) m.box(mat, [length, 0.12, 0.12], [x, y + 0.04, z], rot);
    else {
      const radius = 0.06 + rnd() * 0.06;
      const g = new T.CylinderGeometry(radius, radius, length, 6, 1, true);
      const mtx = new T.Matrix4().compose(
        new T.Vector3(x, y + 0.08, z),
        new T.Quaternion()
          .setFromEuler(new T.Euler(rot[0], rot[1], rot[2]))
          .multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), Math.PI / 2)),
        new T.Vector3(1, 1, 1),
      );
      m.geo(g, mat, mtx);
    }
  }
  m.emit(load);
  return load;
}

export function gondola(recipe) {
  const M = railMaterials({ body: recipe.color });
  const { root, body, m, tc, striker } = freightBase(recipe, M, 'gondola-52ft');
  const H = 1.52,
    sill = 0.95,
    floor = 1.2,
    top = 2.55,
    E = striker - 0.12;
  underframe(m, M, {
    striker,
    tc,
    halfWidth: H,
    floorY: floor,
    sillBottom: sill,
    bearers: [-3, 0, 3],
  });
  m.span(M.frame, [-H + 0.03, floor - 0.03, -E + 0.03], [H - 0.03, floor, E - 0.03]);
  for (const s of [1, -1]) {
    m.slab(
      M.body,
      [
        [-E, sill],
        [E, sill],
        [E, top],
        [-E, top],
      ],
      0.025,
      'zy',
      [s > 0 ? H : -H + 0.025, 0, 0],
    );
    m.span(M.body, [s * (H - 0.06), top - 0.08, -E - 0.02], [s * (H + 0.08), top + 0.02, E + 0.02]);
    m.span(M.body, [s * H - 0.02, sill - 0.06, -E], [s * (H + 0.05), sill + 0.14, E]);
    for (let i = 0; i <= 12; i++) {
      const z = -E + 0.6 + (i * (2 * E - 1.2)) / 12;
      m.box(M.body, [0.05, top - sill - 0.12, 0.1], [s * (H + 0.025), (top + sill) / 2 - 0.03, z]);
      m.box(
        M.body,
        [0.015, top - sill - 0.12, 0.17],
        [s * (H + 0.006), (top + sill) / 2 - 0.03, z],
      );
    }
    for (const d of [1, -1]) {
      ladder(m, M.body, {
        x: s * (H + 0.02),
        z: d * (E - 0.4),
        y0: sill - 0.05,
        y1: top - 0.1,
        width: 0.4,
        along: 'z',
        out: 0.05,
        rungs: 3,
      });
      sillStep(m, M.body, s * (H + 0.04), d * (E - 0.12), sill + 0.05);
    }
  }
  for (const d of [1, -1]) {
    m.slab(
      M.body,
      [
        [-H, sill],
        [H, sill],
        [H, top],
        [-H, top],
      ],
      0.025,
      'xy',
      [0, 0, d > 0 ? E - 0.025 : -E],
    );
    for (const y of [1.45, 1.95, 2.42])
      m.box(M.body, [2 * H - 0.2, 0.1, 0.07], [0, y, d * (E + 0.035)]);
    for (const s of [1, -1])
      m.box(M.body, [0.12, top - sill, 0.12], [s * (H - 0.04), (top + sill) / 2, d * (E - 0.03)]);
    m.box(M.body, [0.12, top - sill, 0.06], [0, (top + sill) / 2, d * (E + 0.03)]);
    grab(
      m,
      M.body,
      [d * 0.25, floor + 0.2, d * (E + 0.07)],
      [d * 0.8, floor + 0.2, d * (E + 0.07)],
      [0, 0, d],
    );
  }
  brakeWheel(m, M, -1, 0.85, 2.15, -(E + 0.08), { housing: true });
  m.span(M.steel, [0.45, 1.3, -(E + 0.42)], [1.25, 1.34, -(E + 0.07)]);
  brakeGear(m, M, -0.5, 0.86);
  carMarkings(m, M, {
    halfWidth: H + 0.025,
    number: recipe.number ?? '355207',
    markY: 2.2,
    z: 5.0,
    height: 0.24,
    dataY: 1.55,
    reflectY: sill + 0.04,
    reflectZ: [-7, -3.5, 0, 3.5, 7],
  });
  const load = scrapLoad(H - 0.08, E - 0.12, floor, top + 0.18);
  return { model: finishFreight(root, body, m, [load]) };
}

// --- 73 ft centerbeam flatcar with wrapped lumber -----------------------------------------------

export function centerbeam(recipe) {
  const M = railMaterials({ body: recipe.color });
  const wrap = sheetMat('load-lumber-wrap', '#d8d1bc', 0.05, 0.7),
    lumber = sheetMat('load-lumber', '#b88d5e', 0, 0.85);
  const { root, body, m, tc, striker } = freightBase(recipe, M, 'centerbeam-flatcar');
  const H = 1.56,
    deck = 1.22,
    B = striker - 0.25,
    beamTop = 4.55,
    lean = 0.05; // bunks fall toward the beam so the load leans in
  for (const s of [1, -1]) m.span(M.body, [s * 1.48, 0.92, -striker], [s * H, deck, striker]);
  m.slab(
    M.body,
    [
      [-striker, 0.76],
      [-(tc + 0.3), 0.72],
      [-(tc - 1.6), 0.48],
      [tc - 1.6, 0.48],
      [tc + 0.3, 0.72],
      [striker, 0.76],
      [striker, deck],
      [-striker, deck],
    ],
    0.46,
    'zy',
    [0.23, 0, 0],
  );
  for (const d of [1, -1]) {
    m.span(M.frame, [-1.45, 0.7, d * tc - 0.22], [1.45, deck - 0.04, d * tc + 0.22]);
    m.span(M.body, [-1.5, 0.82, d * (striker - 0.14)], [1.5, deck, d * striker]);
  }
  // Cross bunks, sloping down to the centre sill.
  const angle = Math.atan(lean / (H - 0.2));
  for (let i = 0; i <= 22; i++) {
    const z = -B + 0.3 + (i * (2 * B - 0.6)) / 22;
    for (const s of [1, -1])
      m.box(
        M.body,
        [H - 0.2, 0.12, 0.14],
        [s * (H / 2 + 0.1), deck + 0.04 + lean * 0.5, z],
        [0, 0, s * angle],
      );
  }
  // Centre partition: top chord, posts and a Warren lattice down to the centre sill.
  m.span(M.body, [-0.18, beamTop - 0.3, -B], [0.18, beamTop, B]);
  m.span(M.body, [-0.1, deck, -B], [0.1, deck + 0.14, B]);
  const panels = 10;
  for (let i = 0; i <= panels; i++) {
    const z = -B + (i * 2 * B) / panels;
    m.box(M.body, [0.12, beamTop - 0.3 - deck, 0.14], [0, (beamTop - 0.3 + deck) / 2, z]);
    if (i < panels) {
      const z1 = -B + ((i + 1) * 2 * B) / panels;
      const ends =
        i % 2
          ? [
              [0, deck + 0.1, z],
              [0, beamTop - 0.32, z1],
            ]
          : [
              [0, beamTop - 0.32, z],
              [0, deck + 0.1, z1],
            ];
      m.rod(M.body, ends[0], ends[1], 0.055, 4);
    }
  }
  // Bulkheads: posts, rails, lower sheathing and braces.
  for (const d of [1, -1]) {
    const z = d * B;
    for (const x of [-1.48, 0, 1.48])
      m.box(M.body, [0.18, beamTop + 0.05 - deck, 0.24], [x, (beamTop + 0.05 + deck) / 2, z]);
    m.span(M.body, [-1.56, beamTop - 0.12, z - 0.14], [1.56, beamTop + 0.05, z + 0.14]);
    for (const y of [2.3, 3.4])
      m.span(M.body, [-1.5, y - 0.07, z - 0.08], [1.5, y + 0.07, z + 0.08]);
    m.span(M.body, [-1.5, deck, z - 0.03], [1.5, 2.3, z + 0.03]);
    for (const s of [1, -1]) {
      m.rod(
        M.body,
        [s * 1.45, beamTop - 0.1, z + d * 0.14],
        [s * 0.15, 2.35, z + d * 0.14],
        0.05,
        4,
      );
      ladder(m, M.body, {
        x: s * 1.58,
        z: d * (striker - 0.5),
        y0: 0.6,
        y1: 2.4,
        width: 0.4,
        along: 'z',
        out: 0.04,
        rungs: 4,
      });
      sillStep(m, M.body, s * 1.56, d * (striker - 0.15), 0.95);
      grab(m, M.body, [s * 1.3, 1.6, z + d * 0.14], [s * 0.8, 1.6, z + d * 0.14], [0, 0, d]);
    }
  }
  brakeWheel(m, M, -1, 0.75, 2.6, -(B + 0.14), { housing: true });
  brakeGear(m, M, -4.0, 0.85, 0.75);
  for (const s of [1, -1]) {
    const x = s * (H + 0.004);
    sideText(
      m,
      M.lettering,
      `MLNX ${recipe.number ?? '603418'}`,
      s,
      x,
      1.07,
      s * (striker - 3.6),
      0.17,
    );
    stencilBlock(m, M.lettering, s, x, 1.12, -s * (striker - 3.2), 0.9, 2);
  }
  m.emit(body);
  // Lumber: five tiers of wrapped bundles each side, leaning on the beam, strapped down.
  const load = group('load');
  const l = new Mesher();
  const bundleLen = (2 * B - 0.5 - 3 * 0.12) / 4;
  for (const s of [1, -1]) {
    const pivot = new T.Vector3(s * 0.2, deck + 0.1, 0);
    const toWorld = new T.Matrix4()
      .makeTranslation(pivot.x, pivot.y, pivot.z)
      .multiply(new T.Matrix4().makeRotationZ(s * angle))
      .multiply(new T.Matrix4().makeTranslation(-pivot.x, -pivot.y, 0));
    const p = (x, y, z) => new T.Vector3(x, y, z).applyMatrix4(toWorld).toArray();
    for (let tier = 0; tier < 5; tier++)
      for (let k = 0; k < 4; k++) {
        const z0 = -B + 0.25 + k * (bundleLen + 0.12),
          z1 = z0 + bundleLen;
        const y0 = deck + 0.1 + tier * 0.62,
          y1 = y0 + 0.58;
        const xa = s * 0.22,
          xb = s * 1.5;
        l.face(wrap, [p(xa, y1, z0), p(xb, y1, z0), p(xb, y1, z1), p(xa, y1, z1)], [0, 1, 0]);
        l.face(wrap, [p(xb, y0, z0), p(xb, y1, z0), p(xb, y1, z1), p(xb, y0, z1)], [s, 0, 0]);
        l.face(wrap, [p(xa, y0, z0), p(xa, y1, z0), p(xa, y1, z1), p(xa, y0, z1)], [-s, 0, 0]);
        l.face(wrap, [p(xa, y0, z0), p(xb, y0, z0), p(xb, y0, z1), p(xa, y0, z1)], [0, -1, 0]);
        l.face(lumber, [p(xa, y0, z1), p(xb, y0, z1), p(xb, y1, z1), p(xa, y1, z1)], [0, 0, 1]);
        l.face(lumber, [p(xa, y0, z0), p(xb, y0, z0), p(xb, y1, z0), p(xa, y1, z0)], [0, 0, -1]);
        // Dunnage strips under the upper bundles, visible at the outer face.
        if (tier > 0)
          for (const f of [0.2, 0.8]) {
            const zz = z0 + (z1 - z0) * f;
            l.face(
              M.frame,
              [
                p(xb, y0 - 0.04, zz - 0.05),
                p(xb, y0, zz - 0.05),
                p(xb, y0, zz + 0.05),
                p(xb, y0 - 0.04, zz + 0.05),
              ],
              [s, 0, 0],
            );
          }
      }
    // Straps from the top chord over the load to winches on the side sill.
    const corner = p(s * 1.5, deck + 0.1 + 5 * 0.62 - 0.04, 0);
    for (let k = 0; k < 8; k++) {
      const z = -B + 1.3 + (k * (2 * B - 2.6)) / 7;
      l.path(
        M.safety,
        [
          [s * 0.18, beamTop - 0.2, z],
          [s * 0.6, corner[1] + 0.03, z],
          [corner[0] + s * 0.03, corner[1] + 0.03, z],
          [s * 1.6, deck - 0.05, z],
        ],
        0.012,
        4,
      );
      l.cyl(M.frame, 0.06, 0.06, 0.16, [s * 1.6, deck - 0.12, z], 'z', 8);
    }
  }
  l.emit(load);
  root.add(load);
  return { model: root };
}
