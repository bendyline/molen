/**
 * Bombardier BiLevel commuter coach and cab car. The section that makes a BiLevel: vertical lower
 * sides carrying the lower-level windows, upper sides sloping inward with the upper-level windows,
 * a low-floor lower level between the trucks and intermediate-level vestibules over them with a
 * kinked side door at each end. Saloon furniture (seats, stairs, racks, lights) is under
 * `close-detail`. Front +Z, +X the left side, y = 0 top of rail, z = 0 midway between the trucks.
 */
import '../../worldgen/scripts/install-deterministic-math.mjs';
import * as T from 'three';
import {
  coupler,
  endText,
  grab,
  group,
  Mesher,
  passengerTruck,
  railMaterials,
  sideText,
} from './rail-geometry.mjs';
import {
  cabInterior,
  headlight,
  numberBoard,
  roofGear,
  roofGrille,
  wipers,
} from './rail-locomotives.mjs';

const mat = (name, color, metalness, roughness, extra = {}) =>
  new T.MeshStandardMaterial({ name, color, metalness, roughness, flatShading: true, ...extra });

const rect = (a0, a1, b0, b1) => [
  [a0, b0],
  [a1, b0],
  [a1, b1],
  [a0, b1],
];

/** Double seat facing `facing` (+1 toward +Z) between x0 and x1 (x1 at the wall). */
function bench(m, mats, x0, x1, floorY, z, facing) {
  const w = Math.abs(x1 - x0),
    xc = (x0 + x1) / 2,
    aisle = Math.abs(x0) < Math.abs(x1) ? x0 : x1;
  m.box(mats.frame, [w - 0.16, 0.36, 0.08], [xc, floorY + 0.2, z]);
  m.box(mats.seat, [w, 0.12, 0.46], [xc, floorY + 0.44, z + facing * 0.02]);
  m.box(mats.seat, [w, 0.66, 0.1], [xc, floorY + 0.8, z - facing * 0.23], [-facing * 0.12, 0, 0]);
  m.box(mats.frame, [0.04, 0.05, 0.38], [aisle, floorY + 0.66, z]);
  m.box(mats.frame, [0.05, 0.1, 0.05], [aisle, floorY + 1.18, z - facing * 0.27]);
}

export function bilevel(recipe) {
  const cab = recipe.cab === true;
  const M = railMaterials({ body: recipe.color, stripe: recipe.stripe });
  const mats = {
    seat: mat('rail-seat', '#3f5874', 0.05, 0.82),
    frame: mat('rail-seat-frame', '#8d9194', 0.5, 0.45),
  };
  const floorMat = mat('rail-floor', '#6e6b66', 0.05, 0.85);
  const lining = mat('rail-interior-lining', '#dcd9cf', 0.05, 0.7);
  const light = mat('rail-cabin-light', '#f5f0e0', 0, 0.4, {
    emissive: '#f2ebd3',
    emissiveIntensity: 0.55,
  });
  const root = group(cab ? 'bilevel-cab-car' : 'bilevel-coach');
  const body = group('body');
  root.add(body);
  const m = new Mesher();
  const hw = 1.485,
    end = recipe.length / 2,
    face = recipe.couplerLength / 2,
    belt = 2.62, // slope start: the upper-level floor line
    slopeTop = 4.56,
    roofHw = 1.06,
    crown = recipe.height,
    lowFloor = 0.62,
    midFloor = 1.3,
    upFloor = 2.62,
    belly = 0.4,
    endBottom = 1.12,
    bellyEnd = 6.6,
    door = [9.75, 10.95];
  const theta = Math.atan2(hw - roofHw, slopeTop - belt),
    slopeLen = Math.hypot(hw - roofHw, slopeTop - belt);
  const slopeX = (y) => hw - ((y - belt) / (slopeTop - belt)) * (hw - roofHw);
  const tc = recipe.truckCenters / 2,
    r = recipe.wheelRadius;
  root.add(
    passengerTruck(
      M,
      'truck-front',
      tc,
      [
        ['axle-1', 1.295],
        ['axle-2', -1.295],
      ],
      { r },
    ),
  );
  root.add(
    passengerTruck(
      M,
      'truck-rear',
      -tc,
      [
        ['axle-3', 1.295],
        ['axle-4', -1.295],
      ],
      { r },
    ),
  );

  // Window layout: six lower and six upper bays between the trucks, two intermediate-level windows
  // and one end window each end.
  const bays = [-4.9, -2.95, -0.98, 0.98, 2.95, 4.9];
  const lower = bays.map((z) => [z - 0.8, z + 0.8, 1.04, 1.96]);
  const mid = [7.55, 8.85].flatMap((z) => [
    [z - 0.5, z + 0.5, 1.82, 2.48],
    [-z - 0.5, -z + 0.5, 1.82, 2.48],
  ]);
  const upper = bays.map((z) => [z - 0.8, z + 0.8, 0.36, 1.36]);
  const endWin = (d) => (d > 0 ? [11.3, 12.2, 1.82, 2.48] : [-12.2, -11.3, 1.82, 2.48]);

  for (const s of [1, -1]) {
    const off = [s > 0 ? hw : -hw + 0.05, 0, 0];
    // Lower sides: the deep belly between the trucks, split at the side doors.
    m.slab(
      M.body,
      [
        [-door[0], endBottom],
        [-(bellyEnd + 0.2), endBottom],
        [-bellyEnd, belly],
        [bellyEnd, belly],
        [bellyEnd + 0.2, endBottom],
        [door[0], endBottom],
        [door[0], belt],
        [-door[0], belt],
      ],
      0.05,
      'zy',
      off,
      [...lower, ...mid].map((w) => rect(...w)),
    );
    for (const d of [1, -1]) {
      const [z0, z1] = d > 0 ? [door[1], end] : [-end, -door[1]];
      m.slab(M.body, rect(z0, z1, endBottom, belt), 0.05, 'zy', off, [rect(...endWin(d))]);
    }
    // Sloped upper sides, in the plane through (hw, belt) leaning in by theta.
    const tilt = new T.Matrix4()
      .makeTranslation(s * hw, belt, 0)
      .multiply(new T.Matrix4().makeRotationZ(s * theta));
    const slabUp = (outline, holes = []) =>
      m.slab(M.body, outline, 0.05, 'zy', [s > 0 ? 0 : 0.05, 0, 0], holes, tilt);
    slabUp(
      rect(-door[0], door[0], 0, slopeLen),
      upper.map((w) => rect(...w)),
    );
    for (const d of [1, -1]) {
      slabUp(d > 0 ? rect(door[1], end, 0, slopeLen) : rect(-end, -door[1], 0, slopeLen));
      slabUp(
        d > 0 ? rect(door[0], door[1], 0.66, slopeLen) : rect(-door[1], -door[0], 0.66, slopeLen),
      );
    }
    // Glazing (tinted) and dark gaskets.
    const x = s * (hw - 0.025);
    for (const [z0, z1, y0, y1] of [...lower, ...mid, endWin(1), endWin(-1)]) {
      m.box(M.tint, [0.012, y1 - y0, z1 - z0], [x, (y0 + y1) / 2, (z0 + z1) / 2]);
      m.box(M.dark, [0.02, 0.03, z1 - z0 + 0.03], [s * (hw + 0.004), y0, (z0 + z1) / 2]);
      m.box(M.dark, [0.02, 0.03, z1 - z0 + 0.03], [s * (hw + 0.004), y1, (z0 + z1) / 2]);
    }
    for (const [z0, z1, v0, v1] of upper) {
      m.geo(
        new T.BoxGeometry(0.012, v1 - v0, z1 - z0).translate(
          -s * 0.025,
          (v0 + v1) / 2,
          (z0 + z1) / 2,
        ),
        M.tint,
        tilt,
      );
      for (const v of [v0, v1])
        m.geo(
          new T.BoxGeometry(0.02, 0.03, z1 - z0 + 0.03).translate(s * 0.004, v, (z0 + z1) / 2),
          M.dark,
          tilt,
        );
    }
    // Livery: belt band and a band along the belly.
    for (const [z0, z1] of [
      [-door[0], door[0]],
      [door[1], end],
      [-end, -door[1]],
    ])
      m.span(M.stripe, [s * hw - s * 0.003, 2.3, z0], [s * (hw + 0.004), 2.52, z1]);
    m.span(M.stripe, [s * hw - s * 0.003, 0.68, -bellyEnd], [s * (hw + 0.004), 0.82, bellyEnd]);
    // Side doors: two leaves kinked to follow the slope, windows, frame, step well, grab poles.
    for (const d of [1, -1]) {
      const zc = d * ((door[0] + door[1]) / 2);
      for (const dz of [-0.3, 0.3]) {
        m.box(
          M.body,
          [0.03, belt - midFloor, 0.58],
          [s * (hw - 0.02), (belt + midFloor) / 2, zc + dz],
        );
        m.box(M.tint, [0.036, 0.8, 0.38], [s * (hw - 0.02), 2.12, zc + dz]);
        m.geo(
          new T.BoxGeometry(0.03, 0.66, 0.58).translate(-s * 0.02, 0.33, zc + dz),
          M.body,
          tilt,
        );
      }
      m.box(M.dark, [0.036, belt - midFloor, 0.02], [s * (hw - 0.01), (belt + midFloor) / 2, zc]);
      for (const z of [d * door[0], d * door[1]])
        m.box(M.dark, [0.04, belt - 0.55, 0.04], [s * hw, (belt + 0.55) / 2, z]);
      m.geo(
        new T.BoxGeometry(0.04, 0.04, door[1] - door[0] + 0.04).translate(0, 0.66, zc),
        M.dark,
        tilt,
      );
      m.span(M.dark, [s * (hw - 0.62), 0.5, zc - 0.58], [s * (hw - 0.04), endBottom, zc + 0.58]);
      for (const [y, inset] of [
        [0.62, 0.04],
        [0.96, 0.3],
      ])
        m.span(
          M.steel,
          [s * (hw - inset - 0.28), y - 0.03, zc - 0.56],
          [s * (hw - inset), y, zc + 0.56],
        );
      for (const z of [d * door[0] - 0.05 * d, d * door[1] + 0.05 * d])
        m.rod(M.steel, [s * (hw + 0.05), 0.75, z], [s * (hw + 0.05), 2.2, z], 0.018, 6);
      sideText(m, M.ink, recipe.number ?? '2470', s, s * (hw + 0.005), 1.48, d * 11.75, 0.22);
    }
  }
  // Roof, floors and closing plates.
  const arch = [
    [-roofHw - 0.02, slopeTop - 0.02],
    [-0.75, crown - 0.08],
    [0, crown],
    [0.75, crown - 0.08],
    [roofHw + 0.02, slopeTop - 0.02],
  ];
  m.slab(
    M.body,
    [
      ...arch,
      ...arch
        .slice()
        .reverse()
        .map(([x, y]) => [x * 0.96, y - 0.07]),
    ],
    2 * end,
    'xy',
    [0, 0, -end],
  );
  for (const z of [-10.4, 10.4])
    roofGrille(m, M, { x0: -0.55, x1: 0.55, y: crown - 0.01, z0: z - 0.9, z1: z + 0.9 });
  m.span(M.frame, [-hw, belly, -bellyEnd], [hw, belly + 0.04, bellyEnd]);
  m.span(floorMat, [-hw + 0.05, lowFloor - 0.04, -bellyEnd], [hw - 0.05, lowFloor, bellyEnd]);
  for (const d of [1, -1]) {
    m.span(M.frame, [-hw, belly, d * bellyEnd - 0.1 * d], [hw, endBottom, d * (bellyEnd + 0.2)]);
    m.span(M.frame, [-hw, endBottom - 0.02, d * (bellyEnd + 0.2)], [hw, endBottom + 0.02, d * end]);
    m.span(
      floorMat,
      [-hw + 0.05, midFloor - 0.04, d * bellyEnd],
      [hw - 0.05, midFloor, d * (end - 0.04)],
    );
    // Underfloor equipment between the belly and the trucks, and under the vestibules.
    m.span(M.frame, [-1.0, 0.55, d * (bellyEnd + 0.25)], [1.0, endBottom, d * (tc - 1.9)]);
    m.span(M.frame, [-0.9, 0.62, d * (tc + 1.95)], [0.9, endBottom, d * (end - 0.3)]);
  }
  // Upper floor (with the up-stair openings on the left half) and its lining seen from below.
  m.span(floorMat, [-hw + 0.06, upFloor - 0.08, -4.85], [hw - 0.06, upFloor, 4.85]);
  m.span(lining, [-hw + 0.06, upFloor - 0.12, -4.85], [hw - 0.06, upFloor - 0.08, 4.85]);
  for (const d of [1, -1]) {
    m.span(floorMat, [-hw + 0.06, upFloor - 0.08, d * 4.85], [0.0, upFloor, d * 6.3]);
    m.span(lining, [-hw + 0.06, upFloor - 0.12, d * 4.85], [0.0, upFloor - 0.08, d * 6.3]);
  }

  // Ends: end wall of the car section, end door with diaphragm (coach ends), couplers, grabs,
  // marker lights; the cab car's front end carries the operating cab instead.
  const section = [
    [-hw, endBottom],
    [hw, endBottom],
    [hw, belt],
    [roofHw, slopeTop],
    [0.75, crown - 0.08],
    [0, crown],
    [-0.75, crown - 0.08],
    [-roofHw, slopeTop],
    [-hw, belt],
  ];
  const screens = [
    [0.12, 1.25, 2.55, 3.45],
    [-1.25, -0.12, 2.55, 3.45],
  ];
  for (const d of [1, -1]) {
    const cabEnd = cab && d > 0;
    const zw = d > 0 ? end - 0.06 : -end;
    const z = d * end;
    m.slab(
      M.body,
      section,
      0.06,
      'xy',
      [0, 0, zw],
      cabEnd ? screens.map((w) => rect(...w)) : [rect(-0.42, 0.42, midFloor, 3.3)],
    );
    m.span(M.frame, [-hw + 0.05, 0.92, z - d * 0.12], [hw - 0.05, endBottom, z]);
    coupler(m, M, d, face, end, { halfWidth: hw - 0.05, sillY: 1.0 });
    for (const s of [1, -1]) {
      m.cyl(M.marker, 0.05, 0.05, 0.04, [s * 1.1, 3.9, z + d * 0.02], 'z', 10);
      grab(m, M.steel, [s * 1.3, 1.25, z], [s * 1.3, 2.4, z], [0, 0, d], 0.08, 0.016);
      m.box(M.dark, [0.16, 0.12, 0.08], [s * 0.75, 1.2, z + d * 0.04]);
      m.path(
        M.dark,
        [
          [s * 0.75, 1.14, z + d * 0.06],
          [s * 0.7, 0.95, z + d * 0.2],
          [s * 0.55, 0.92, z + d * 0.28],
        ],
        0.02,
        5,
      );
    }
    if (cabEnd) {
      for (const [x0, x1, y0, y1] of screens) {
        m.box(M.glass, [x1 - x0, y1 - y0, 0.012], [(x0 + x1) / 2, (y0 + y1) / 2, end - 0.03]);
        for (const y of [y0, y1])
          m.box(M.dark, [x1 - x0 + 0.03, 0.03, 0.02], [(x0 + x1) / 2, y, end + 0.004]);
        for (const x of [x0, x1])
          m.box(M.dark, [0.03, y1 - y0, 0.02], [x, (y0 + y1) / 2, end + 0.004]);
      }
      wipers(m, M, screens, end);
      for (const x of [-0.55, 0.55]) headlight(m, M, { x, y: 1.95, z: end, dir: 1, r: 0.1 });
      for (const x of [-1.2, 1.2]) headlight(m, M, { x, y: 1.4, z: end, dir: 1, r: 0.08 });
      numberBoard(m, M, {
        text: recipe.number ?? '254',
        x: 0,
        y: 3.86,
        z: end,
        dir: 1,
        w: 0.5,
        h: 0.18,
      });
      m.span(M.stripe, [-hw, 2.3, end - 0.005], [hw, 2.36, end + 0.004]);
      roofGear(m, M, { x: 0, y: crown - 0.22, z: end - 0.6 });
    } else {
      m.box(M.body, [0.82, 1.98, 0.03], [0, (midFloor + 3.28) / 2, z - d * 0.03]);
      m.box(M.tint, [0.4, 0.55, 0.036], [0, 2.75, z - d * 0.03]);
      // Diaphragm: a rubber frame round the end door, standing proud of the end.
      for (const s of [1, -1]) m.box(M.dark, [0.12, 2.3, 0.22], [s * 0.6, 2.3, z + d * 0.11]);
      m.box(M.dark, [1.32, 0.12, 0.22], [0, 3.45, z + d * 0.11]);
      m.box(M.dark, [1.32, 0.1, 0.22], [0, 1.2, z + d * 0.11]);
    }
    if (!cabEnd) endText(m, M.ink, recipe.number ?? '2470', d, 0, 4.15, z + d * 0.004, 0.16);
  }
  m.emit(body);

  // Saloon furniture under close-detail: seats on both levels and the vestibules, stairs, racks,
  // ceiling lights, grab poles.
  const detail = group('close-detail');
  root.add(detail);
  const f = new Mesher();
  const rows = [];
  for (let k = 0; k < 13; k++) rows.push({ z: (k - 6) * 0.85, facing: k % 2 === 0 ? 1 : -1 });
  for (const { z, facing } of rows) {
    for (const s of [1, -1])
      if (s < 0 || Math.abs(z) <= 4.5) bench(f, mats, s * 0.33, s * 1.38, lowFloor, z, facing);
    for (const s of [1, -1]) {
      const limit = s > 0 ? 4.5 : 5.95;
      if (Math.abs(z) <= limit) bench(f, mats, s * 0.3, s * 1.17, upFloor, z, facing);
    }
  }
  // Intermediate level: a facing pair beside each end window (the cab car's front end is its cab).
  for (const d of cab ? [-1] : [1, -1])
    for (const [z, facing] of [
      [d * 11.45, d],
      [d * 12.25, -d],
    ])
      bench(f, mats, 0.35, 1.4, midFloor, z, facing);
  // Stairs: down to the lower level on the right half, up to the upper level on the left half.
  for (const d of [1, -1]) {
    for (let i = 0; i < 4; i++) {
      const y = midFloor - (i + 1) * ((midFloor - lowFloor) / 4);
      const z = d * (6.6 - (i + 0.5) * 0.225);
      f.span(mats.frame, [-0.85, lowFloor, z - 0.113], [-0.06, y + 0.02, z + 0.113]);
    }
    // The up-stair is a solid flight: its underside closes off the end of the lower saloon.
    for (let i = 0; i < 7; i++) {
      const y = midFloor + (i + 1) * ((upFloor - midFloor) / 7);
      const z = d * (6.6 - (i + 0.5) * 0.257);
      f.span(mats.frame, [0.06, y - 0.18, z - 0.13], [0.85, y, z + 0.13]);
      f.span(lining, [0.06, lowFloor, z - 0.13], [0.85, y - 0.18, z + 0.13]);
    }
    f.path(
      mats.frame,
      [
        [0.03, midFloor + 0.95, d * 6.65],
        [0.03, upFloor + 0.95, d * 4.85],
      ],
      0.02,
      6,
    );
    f.path(
      mats.frame,
      [
        [-0.03, midFloor + 0.9, d * 6.65],
        [-0.03, lowFloor + 0.9, d * 5.75],
      ],
      0.02,
      6,
    );
    f.span(lining, [0.0, upFloor, d * 4.85], [0.05, upFloor + 1.0, d * 6.3]);
    f.span(lining, [-0.9, lowFloor, d * 5.7], [-0.86, midFloor + 1.0, d * 6.6]);
    // Vestibule grab poles and a partition with a window toward the saloon.
    for (const s of [1, -1])
      f.rod(
        mats.frame,
        [s * 1.0, midFloor, d * 9.65],
        [s * 1.0, midFloor + 2.0, d * 9.65],
        0.02,
        6,
      );
  }
  // Racks and ceiling lights on both levels.
  for (const s of [1, -1]) {
    f.span(mats.frame, [s * 1.08, 2.2, -5.5], [s * 1.42, 2.23, 5.5]);
    f.span(mats.frame, [s * 0.86, 4.08, -5.9], [s * (slopeX(4.08) - 0.06), 4.11, 5.9]);
    for (const z of [-5.0, -2.5, 0, 2.5, 5.0]) {
      f.box(mats.frame, [0.03, 0.18, 0.03], [s * 1.36, 2.3, z]);
      f.box(mats.frame, [0.03, 0.16, 0.03], [s * (slopeX(4.18) - 0.07), 4.18, z]);
    }
    f.span(light, [s * 0.44, upFloor - 0.15, -5.4], [s * 0.58, upFloor - 0.12, 5.4]);
    f.span(light, [s * 0.36, 4.66, -5.8], [s * 0.5, 4.69, 5.8]);
    for (const d of [1, -1]) f.span(light, [s * 0.3, 3.4, d * 8.0], [s * 0.6, 3.43, d * 9.4]);
  }
  f.emit(detail);

  const info = { model: root };
  const seat = (id, s, level, z, facing) => ({
    id,
    role: 'passenger',
    position: [
      s * (level === 'upper' ? 0.96 : 1.12),
      (level === 'upper' ? upFloor : lowFloor) + 1.2,
      Math.round((z - facing * 0.08) * 1000) / 1000,
    ],
  });
  const front = rows[9],
    back = rows[2];
  const seats = [
    seat('upper-left-1', 1, 'upper', front.z, front.facing),
    seat('upper-right-1', -1, 'upper', front.z, front.facing),
    seat('lower-left-1', 1, 'lower', front.z, front.facing),
    seat('lower-right-1', -1, 'lower', front.z, front.facing),
    seat('upper-left-2', 1, 'upper', back.z, back.facing),
    seat('upper-right-2', -1, 'upper', back.z, back.facing),
    seat('lower-left-2', 1, 'lower', back.z, back.facing),
    seat('lower-right-2', -1, 'lower', back.z, back.facing),
    {
      id: 'vestibule',
      role: 'passenger',
      position: [0, midFloor + 1.6, -((door[0] + door[1]) / 2)],
    },
  ];
  const doorZ = (door[0] + door[1]) / 2;
  const entries = [];
  const exits = [];
  for (const d of [1, -1])
    for (const s of [1, -1]) {
      entries.push([s * (hw + 0.3), 0.55, d * doorZ]);
      exits.push([s * (hw + 0.9), 0, d * doorZ]);
    }
  if (cab) {
    const eye = recipe.driverEye;
    // Cab floor raised over the front vestibule level, behind the windscreens.
    const c = new Mesher();
    c.span(floorMat, [-hw + 0.06, midFloor, door[1] + 0.02], [hw - 0.06, 1.55, end - 0.06]);
    c.emit(body, 'body-cab');
    info.interior = cabInterior(root, {
      style: 'desktop',
      zFront: end - 0.06,
      cabRear: door[1],
      floor: 1.55,
      hw: 1.42,
      eye,
      label: 'MLN',
      parent: detail,
      name: 'cab-detail',
    });
    info.driverEye = eye;
    seats.unshift({ id: 'driver', role: 'driver', position: eye });
  } else {
    info.interior = { nodes: ['close-detail'], bindings: [] };
  }
  info.mount = { seats, entries, exits };
  return info;
}
