/**
 * Locomotives: GE ES44AC (six-axle wide-cab road freight), EMD GP38-2 (four-axle road switcher)
 * and MPI MP36PH-3C (cab-forward commuter cowl unit). A shared kit builds the frame, pilots,
 * corner steps, walkway railings, hoods, a cab shell with real window openings, lights and the
 * cab interior (desktop or AAR control stand). Front +Z, +X the left side (the engineer sits on
 * the right, at -X), y = 0 top of rail, z = 0 midway between the truck centres.
 */
import '../../worldgen/scripts/install-deterministic-math.mjs';
import * as T from 'three';
import {
  coupler,
  endText,
  group,
  locoTruck,
  Mesher,
  railMaterials,
  sideText,
} from './rail-geometry.mjs';
import { detailKit } from './vehicle-detail.mjs';
import { panelTools } from './vehicle-interiors.mjs';

// --- Kit -----------------------------------------------------------------------------------------

/** Cross-section with rounded upper corners, for hoods and carbodies. */
function roundedSection(hw, bottom, top, r = 0.16, steps = 3) {
  const pts = [
    [-hw, bottom],
    [hw, bottom],
  ];
  for (let i = 0; i <= steps; i++) {
    const a = ((i / steps) * Math.PI) / 2;
    pts.push([hw - r + r * Math.cos(a), top - r + r * Math.sin(a)]);
  }
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI / 2 + ((i / steps) * Math.PI) / 2;
    pts.push([-hw + r + r * Math.cos(a), top - r + r * Math.sin(a)]);
  }
  return pts;
}

function hood(m, material, { hw, bottom, top, z0, z1, r = 0.16 }) {
  m.slab(material, roundedSection(hw, bottom, top, r), z1 - z0, 'xy', [0, 0, z0]);
}

/** Door shut lines and latches on both hood sides between z0 and z1. */
function doorSeams(m, M, { hw, y0, y1, z0, z1, pitch = 0.95 }) {
  for (const s of [1, -1]) {
    const x = s * (hw + 0.003);
    const n = Math.max(1, Math.round((z1 - z0) / pitch));
    for (let i = 0; i <= n; i++) {
      const z = z0 + ((z1 - z0) * i) / n;
      m.box(M.dark, [0.006, y1 - y0, 0.016], [x, (y0 + y1) / 2, z]);
      if (i < n) {
        const zc = z + (z1 - z0) / n / 2;
        m.box(M.steel, [0.02, 0.1, 0.03], [s * (hw + 0.01), (y0 + y1) / 2, zc + 0.22]);
      }
    }
    for (const y of [y0, y1]) m.box(M.dark, [0.006, 0.016, z1 - z0], [x, y, (z0 + z1) / 2]);
  }
}

/** Louvred grille on a side face (x plane) or, with `top`, on a horizontal face. */
export function grille(m, M, { x, y0, y1, z0, z1, side = 1, pitch = 0.07 }) {
  m.box(M.dark, [0.012, y1 - y0, z1 - z0], [x + side * 0.004, (y0 + y1) / 2, (z0 + z1) / 2]);
  for (let y = y0 + pitch / 2; y < y1; y += pitch)
    m.box(M.frame, [0.02, 0.014, z1 - z0 - 0.02], [x + side * 0.012, y, (z0 + z1) / 2]);
  for (const z of [z0, z1])
    m.box(M.frame, [0.03, y1 - y0 + 0.03, 0.03], [x + side * 0.012, (y0 + y1) / 2, z]);
}

export function roofGrille(m, M, { x0, x1, y, z0, z1, pitch = 0.08 }) {
  m.box(M.dark, [x1 - x0, 0.012, z1 - z0], [(x0 + x1) / 2, y + 0.004, (z0 + z1) / 2]);
  for (let z = z0 + pitch / 2; z < z1; z += pitch)
    m.box(M.frame, [x1 - x0 - 0.02, 0.014, 0.014], [(x0 + x1) / 2, y + 0.012, z]);
}

/** Radiator or blower fan set into a roof: shroud ring, dark well, guard bars, hub. */
function fan(m, M, { x = 0, y, z, r }) {
  m.cyl(M.frame, r + 0.04, r + 0.04, 0.08, [x, y + 0.03, z], 'y', 24, true);
  m.cyl(M.dark, r, r, 0.02, [x, y + 0.01, z], 'y', 24);
  for (let i = -3; i <= 3; i++)
    m.box(
      M.frame,
      [0.016, 0.016, 2 * r * Math.sqrt(1 - Math.pow(i / 3.6, 2))],
      [x + (i * r) / 3.6, y + 0.06, z],
    );
  m.cyl(M.frame, 0.1, 0.1, 0.05, [x, y + 0.05, z], 'y', 10);
}

export function headlight(m, M, { x, y, z, dir, r = 0.1 }) {
  m.cyl(M.frame, r + 0.025, r + 0.025, 0.1, [x, y, z + dir * 0.03], 'z', 14);
  m.cyl(M.lamp, r, r, 0.02, [x, y, z + dir * 0.085], 'z', 14);
}

export function numberBoard(m, M, { text, x, y, z, dir, w = 0.46, h = 0.2 }) {
  m.box(M.frame, [w + 0.04, h + 0.04, 0.05], [x, y, z + dir * 0.02]);
  m.box(M.board, [w, h, 0.02], [x, y, z + dir * 0.04]);
  endText(m, M.ink, text, dir, x, y, z + dir * 0.052, h * 0.62);
}

/** Stanchions with top and knee rails through `posts` ([x, z] pairs). */
function railing(m, M, posts, deckY, height = 1.0) {
  for (const [x, z] of posts) m.rod(M.safety, [x, deckY, z], [x, deckY + height, z], 0.02, 6);
  m.path(
    M.safety,
    posts.map(([x, z]) => [x, deckY + height, z]),
    0.02,
    6,
  );
  m.path(
    M.safety,
    posts.map(([x, z]) => [x, deckY + height * 0.52, z]),
    0.016,
    6,
  );
}

/** Corner step well: stringers, three treads, grab irons rising to the walkway railing. */
function cornerSteps(m, M, { x, z, deckY, bottom = 0.42, width = 0.52 }) {
  const s = Math.sign(x);
  for (const dz of [-width / 2 - 0.02, width / 2 + 0.02])
    m.span(
      M.frame,
      [x - s * 0.34, bottom - 0.08, z + dz - 0.015],
      [x, deckY - 0.04, z + dz + 0.015],
    );
  for (let i = 0; i < 3; i++) {
    const y = bottom + (i * (deckY - bottom)) / 3;
    m.span(
      M.steel,
      [x - s * (0.3 - i * 0.02), y - 0.025, z - width / 2],
      [x, y + 0.025, z + width / 2],
    );
    m.box(M.safety, [0.02, 0.02, width], [x + s * 0.005, y + 0.03, z]);
  }
  for (const dz of [-width / 2 - 0.05, width / 2 + 0.05])
    m.path(
      M.safety,
      [
        [x + s * 0.04, bottom + 0.3, z + dz],
        [x + s * 0.04, deckY + 0.2, z + dz],
        [x - s * 0.02, deckY + 1.0, z + dz],
      ],
      0.018,
      6,
    );
}

/** Pilot (end plate with coupler pocket and snowplow), MU receptacles, hoses, ditch lights. */
function pilot(m, M, { dir, zEnd, deckY, hw, ditch = true, plow = true, sill = true }) {
  const z0 = dir > 0 ? zEnd - 0.08 : -zEnd;
  // Body-coloured end sill with a safety stripe over the darker pilot plate.
  const plateTop = sill ? deckY - 0.3 : deckY;
  if (sill) {
    m.span(
      M.body,
      [-hw + 0.04, plateTop, z0 - (dir > 0 ? 0 : 0.01)],
      [hw - 0.04, deckY, z0 + 0.09],
    );
    m.span(
      M.stripe,
      [-hw + 0.04, plateTop + 0.1, dir * (zEnd + 0.012) - 0.003],
      [hw - 0.04, plateTop + 0.2, dir * (zEnd + 0.012) + 0.003],
    );
  }
  m.slab(
    M.frame,
    [
      [-hw + 0.06, 0.3],
      [hw - 0.06, 0.3],
      [hw - 0.06, plateTop],
      [-hw + 0.06, plateTop],
    ],
    0.08,
    'xy',
    [0, 0, z0],
    [
      [
        [-0.32, 0.6],
        [0.32, 0.6],
        [0.32, 1.12],
        [-0.32, 1.12],
      ],
    ],
  );
  const z = dir * zEnd;
  m.span(M.dark, [-0.3, 0.62, z - dir * 0.6], [0.3, 1.1, z - dir * 0.08]);
  if (plow)
    for (const s of [1, -1])
      m.face(
        M.frame,
        [
          [s * (hw - 0.06), 0.14, z - dir * 0.02],
          [0, 0.14, z + dir * 0.26],
          [0, 0.52, z + dir * 0.14],
          [s * (hw - 0.06), 0.52, z - dir * 0.04],
        ],
        [s * 0.3, 0.2, dir],
      );
  for (const s of [1, -1]) {
    m.box(M.frame, [0.22, 0.16, 0.1], [s * 0.62, deckY - 0.2, z + dir * 0.05]);
    for (const xh of [0.42, 0.78])
      m.path(
        M.dark,
        [
          [s * xh, deckY - 0.32, z + dir * 0.04],
          [s * xh, deckY - 0.62, z + dir * 0.12],
          [s * (xh - 0.06), 0.62, z + dir * 0.14],
        ],
        0.022,
        6,
      );
    if (ditch) {
      m.box(M.frame, [0.2, 0.22, 0.14], [s * (hw - 0.3), deckY + 0.13, z - dir * 0.08]);
      m.cyl(M.lamp, 0.07, 0.07, 0.02, [s * (hw - 0.3), deckY + 0.14, z - dir * 0.0], 'z', 12);
    }
  }
}

/** Frame: side sills (striped), walkway plate, centre sills and the couplers. */
function frame(m, M, { hw, deckY, sillBottom, zEnd, face, stripe = true }) {
  for (const s of [1, -1]) {
    m.span(M.body, [s * (hw - 0.14), sillBottom, -zEnd], [s * hw, deckY - 0.05, zEnd]);
    if (stripe)
      m.span(
        M.stripe,
        [s * hw - s * 0.002, (sillBottom + deckY) / 2 - 0.09, -zEnd],
        [s * (hw + 0.004), (sillBottom + deckY) / 2 + 0.09, zEnd],
      );
  }
  m.span(M.frame, [-hw, deckY - 0.05, -zEnd], [hw, deckY, zEnd]);
  for (const s of [1, -1])
    m.span(M.frame, [s * 0.32, sillBottom, -zEnd + 0.4], [s * 0.6, deckY - 0.05, zEnd - 0.4]);
  for (const dir of [1, -1])
    coupler(m, M, dir, face, zEnd, { halfWidth: hw - 0.05, sillY: deckY - 0.2 });
}

function fuelTank(m, M, { hw, y0, y1, z0, z1 }) {
  const r = 0.2;
  m.slab(
    M.frame,
    [
      [-hw, y1],
      [-hw, y0 + r],
      [-hw + r * 0.3, y0 + r * 0.3],
      [-hw + r, y0],
      [hw - r, y0],
      [hw - r * 0.3, y0 + r * 0.3],
      [hw, y0 + r],
      [hw, y1],
    ],
    z1 - z0,
    'xy',
    [0, 0, z0],
  );
  for (const s of [1, -1]) {
    for (const z of [z0 + 0.6, z1 - 0.6])
      m.cyl(M.steel, 0.07, 0.07, 0.06, [s * (hw + 0.02), y1 - 0.18, z], 'x', 10);
    m.cyl(M.lettering, 0.06, 0.06, 0.02, [s * (hw + 0.01), (y0 + y1) / 2, (z0 + z1) / 2], 'x', 10);
    for (const z of [z0 + 1.5, (z0 + z1) / 2, z1 - 1.5])
      m.box(M.dark, [0.008, y1 - y0 - 0.1, 0.02], [s * (hw + 0.003), (y0 + y1) / 2, z]);
  }
}

/** Horn cluster (five bells on a manifold), bell, antennas. */
export function roofGear(m, M, { x = 0, y, z }) {
  m.box(M.frame, [0.32, 0.08, 0.14], [x, y + 0.06, z]);
  for (let i = 0; i < 5; i++) {
    const dir = i % 2 ? 1 : -1,
      len = 0.18 + i * 0.03;
    m.cyl(
      M.steel,
      0.03,
      0.065,
      len,
      [x - 0.12 + i * 0.06, y + 0.12, z + dir * (len / 2 + 0.05)],
      'z',
      8,
    );
  }
}

/**
 * Cab shell: front and rear walls and both sides as slabs with real window holes, glazing and
 * rubber gaskets, a cambered roof with a visor. Window rectangles: front [x0, x1, y0, y1], side
 * [z0, z1, y0, y1] (mirrored on both sides).
 */
function cabShell(
  m,
  M,
  { hw, z0, z1, bottom, eave, crown, front = [], side = [], wall = 0.06, visor = 0.1 },
) {
  const rect = (a0, a1, b0, b1) => [
    [a0, b0],
    [a1, b0],
    [a1, b1],
    [a0, b1],
  ];
  m.slab(
    M.body,
    rect(-hw, hw, bottom, eave),
    wall,
    'xy',
    [0, 0, z1 - wall],
    front.map((w) => rect(...w)),
  );
  m.slab(M.body, rect(-hw, hw, bottom, eave), wall, 'xy', [0, 0, z0]);
  for (const s of [1, -1])
    m.slab(
      M.body,
      rect(z0, z1, bottom, eave),
      wall,
      'zy',
      [s > 0 ? hw : -hw + wall, 0, 0],
      side.map((w) => rect(...w)),
    );
  const arch = [];
  for (let i = 0; i <= 6; i++) {
    const t = -1 + i / 3;
    arch.push([t * (hw + 0.03), eave + (crown - eave) * (1 - t * t)]);
  }
  m.slab(
    M.body,
    [
      ...arch,
      ...arch
        .slice()
        .reverse()
        .map(([x, y]) => [x * 0.97, y - 0.06]),
    ],
    z1 - z0 + visor + 0.03,
    'xy',
    [0, 0, z0 - 0.03],
  );
  const gasket = 0.03;
  for (const [x0, x1, y0, y1] of front) {
    m.box(M.glass, [x1 - x0, y1 - y0, 0.012], [(x0 + x1) / 2, (y0 + y1) / 2, z1 - wall / 2]);
    for (const y of [y0, y1])
      m.box(M.dark, [x1 - x0 + gasket, gasket, 0.02], [(x0 + x1) / 2, y, z1 + 0.004]);
    for (const x of [x0, x1])
      m.box(M.dark, [gasket, y1 - y0, 0.02], [x, (y0 + y1) / 2, z1 + 0.004]);
  }
  for (const s of [1, -1])
    for (const [za, zb, y0, y1] of side) {
      const x = s * (hw - wall / 2);
      m.box(M.glass, [0.012, y1 - y0, zb - za], [x, (y0 + y1) / 2, (za + zb) / 2]);
      for (const y of [y0, y1])
        m.box(M.dark, [0.02, gasket, zb - za + gasket], [s * (hw + 0.004), y, (za + zb) / 2]);
      for (const z of [za, zb])
        m.box(M.dark, [0.02, y1 - y0, gasket], [s * (hw + 0.004), (y0 + y1) / 2, z]);
    }
}

/** Wipers parked along the bottom of each windscreen pane (outside). */
export function wipers(m, M, panes, z, dir = 1, tilt = 0) {
  for (const [x0, x1, y0] of panes) {
    const pivot = [(x0 + x1) / 2 + (x1 > 0 ? 0.25 : -0.25), y0 + 0.05, z + dir * 0.025];
    m.rod(
      M.dark,
      pivot,
      [x0 + (x1 > 0 ? 0.08 : 0.4), y0 + 0.08, z + dir * (0.03 + tilt)],
      0.012,
      4,
    );
    m.cyl(M.frame, 0.025, 0.025, 0.04, pivot, 'z', 8);
  }
}

// --- Cab interiors -------------------------------------------------------------------------------

/**
 * Cab furniture under `close-detail`, plus the live `throttle-handle` and `brake-handle` beside
 * it. `style` 'desktop' (GE / MPI desktop console) or 'aar' (EMD AAR control stand with a
 * separate 26L brake stand). Returns the interior signal spec for the entity type.
 */
export function cabInterior(
  root,
  {
    style,
    zFront,
    cabRear,
    floor,
    hw,
    eye,
    lining = '#b9bcb5',
    label,
    parent = root,
    name = 'close-detail',
  },
) {
  const d = detailKit(parent, name);
  const cab = panelTools(d);
  const liner = new T.MeshStandardMaterial({
    name: 'rail-cab-lining',
    color: lining,
    roughness: 0.75,
    flatShading: true,
  });
  const seat = new T.MeshStandardMaterial({
    name: 'rail-cab-seat',
    color: '#3c4a5c',
    roughness: 0.8,
    flatShading: true,
  });
  const box = (size, at, material = d.dark) => d.box(size, at, material);
  // The cab may be short (a cab car): nothing behind its rear bulkhead.
  const back = Math.max(eye[2] - 1.3, cabRear + 0.08);
  // Rubber floor mat and seats (engineer at -X, conductor at +X) on pedestals.
  box([2 * hw - 0.14, 0.03, zFront - back], [0, floor + 0.015, (zFront + back) / 2]);
  for (const x of [eye[0], -eye[0]]) {
    const z = eye[2] - 0.05;
    d.add(new T.CylinderGeometry(0.06, 0.09, 0.45, 10), d.metal, [x, floor + 0.25, z]);
    box([0.5, 0.11, 0.5], [x, floor + 0.53, z], seat);
    box([0.5, 0.66, 0.11], [x, floor + 0.9, z - 0.29], seat);
    box([0.32, 0.18, 0.09], [x, floor + 1.33, z - 0.31], seat);
    for (const s of [1, -1])
      box([0.06, 0.05, 0.36], [x + s * 0.27, floor + 0.76, z - 0.02], d.dark);
  }
  const deskTop = floor + 0.86;
  if (style === 'desktop') {
    // Engineer's desktop console: knee recess, desk slab, sloped display panel to the screen.
    const x0 = -hw + 0.08,
      x1 = -0.1;
    box([x1 - x0, 0.84, 0.3], [(x0 + x1) / 2, floor + 0.42, zFront - 0.24]);
    box([x1 - x0, 0.05, 0.62], [(x0 + x1) / 2, deskTop, zFront - 0.42]);
    const panel = d.box([x1 - x0, 0.36, 0.05], [(x0 + x1) / 2, deskTop + 0.17, zFront - 0.12]);
    panel.rotation.x = -0.55;
    cab.display(-1.02, deskTop + 0.2, zFront - 0.22, 0.32, 0.2, 'driver');
    cab.display(-0.55, deskTop + 0.2, zFront - 0.22, 0.32, 0.2, 'map');
    cab.gauge(-0.79, deskTop + 0.22, zFront - 0.2, 0.06);
    cab.buttons(-0.8, deskTop + 0.06, zFront - 0.42, 6, 0.04);
    cab.buttons(-0.55, deskTop + 0.06, zFront - 0.52, 4, 0.04);
    d.text('THROTTLE', [-0.32, deskTop + 0.03, zFront - 0.72], 0.018, Math.PI);
    d.text('AUTO', [-1.2, deskTop + 0.03, zFront - 0.72], 0.018, Math.PI);
    d.text('IND', [-1.33, deskTop + 0.03, zFront - 0.66], 0.018, Math.PI);
    // Reverser beside the throttle, independent brake beside the automatic brake.
    d.rod(
      [-0.45, deskTop + 0.03, zFront - 0.5],
      [-0.45, deskTop + 0.12, zFront - 0.48],
      0.012,
      d.metal,
    );
    d.box([0.05, 0.03, 0.06], [-0.45, deskTop + 0.13, zFront - 0.48], d.red);
    d.rod(
      [-1.33, deskTop + 0.03, zFront - 0.5],
      [-1.33, deskTop + 0.14, zFront - 0.5],
      0.014,
      d.metal,
    );
    d.box([0.04, 0.03, 0.12], [-1.33, deskTop + 0.15, zFront - 0.56], d.dark);
    // Conductor's desk: display, radio handset and the emergency brake valve.
    box([hw - 0.18, 0.05, 0.5], [(hw + 0.1) / 2, deskTop - 0.04, zFront - 0.36]);
    box([hw - 0.18, 0.8, 0.26], [(hw + 0.1) / 2, floor + 0.4, zFront - 0.2]);
    cab.display(0.75, deskTop + 0.14, zFront - 0.2, 0.3, 0.18, 'route');
    box([0.06, 0.14, 0.05], [0.35, deskTop + 0.06, zFront - 0.3]);
    d.rod([1.2, deskTop - 0.02, zFront - 0.4], [1.2, deskTop + 0.1, zFront - 0.45], 0.012, d.red);
  } else {
    // AAR control stand at the engineer's left, gauge panel over it, 26L brake stand ahead.
    const sx = eye[0] + 0.5;
    box([0.3, 1.02, 0.62], [sx, floor + 0.51, eye[2] + 0.38]);
    const top = d.box([0.32, 0.05, 0.64], [sx, floor + 1.05, eye[2] + 0.38]);
    top.rotation.z = 0.25;
    for (let i = 0; i < 2; i++) {
      d.rod(
        [sx - 0.06 + i * 0.1, floor + 1.06, eye[2] + 0.2 + i * 0.14],
        [sx - 0.06 + i * 0.1, floor + 1.18, eye[2] + 0.24 + i * 0.14],
        0.012,
        d.metal,
      );
      d.box(
        [0.05, 0.04, 0.05],
        [sx - 0.06 + i * 0.1, floor + 1.19, eye[2] + 0.24 + i * 0.14],
        d.dark,
      );
    }
    box([0.6, 0.34, 0.08], [sx - 0.05, floor + 1.15, zFront - 0.12]);
    for (const [gx, gy] of [
      [-0.18, 1.22],
      [0.0, 1.22],
      [0.18, 1.22],
      [-0.09, 1.08],
      [0.09, 1.08],
    ])
      cab.gauge(sx - 0.05 + gx, floor + gy, zFront - 0.17, 0.055);
    const bx = eye[0] - 0.02;
    d.add(new T.CylinderGeometry(0.08, 0.12, 0.9, 10), d.dark, [bx, floor + 0.45, zFront - 0.42]);
    box([0.3, 0.16, 0.3], [bx, floor + 0.95, zFront - 0.42]);
    d.rod(
      [bx - 0.08, floor + 0.88, zFront - 0.42],
      [bx - 0.08, floor + 0.88, zFront - 0.6],
      0.013,
      d.metal,
    );
    d.text('THROTTLE', [sx, floor + 1.2, eye[2] + 0.02], 0.018, Math.PI);
    box([hw - 0.25, 0.05, 0.42], [(hw + 0.1) / 2, deskTop - 0.04, zFront - 0.3]);
    d.rod([1.1, deskTop - 0.02, zFront - 0.35], [1.1, deskTop + 0.1, zFront - 0.4], 0.012, d.red);
  }
  // Sun visors, cab lights, radio, extinguisher, rear lockers.
  for (const s of [1, -1]) box([0.9, 0.012, 0.32], [s * 0.72, eye[1] + 0.56, zFront - 0.25]);
  for (const s of [1, -1]) box([0.4, 0.03, 0.12], [s * 0.6, eye[1] + 0.82, eye[2] - 0.4], d.ivory);
  box([0.3, 0.16, 0.14], [0.2, eye[1] + 0.68, zFront - 0.35]);
  d.add(new T.CylinderGeometry(0.07, 0.07, 0.42, 10), d.red, [
    hw - 0.2,
    floor + 0.3,
    Math.max(eye[2] - 0.75, back + 0.1),
  ]);
  if (eye[2] - 1.13 > back) {
    box([2 * hw - 0.5, 1.1, 0.35], [0, floor + 0.55, eye[2] - 0.95]);
    d.text(label, [0, floor + 1.14, eye[2] - 0.77], 0.03, 0);
  }
  d.finish();
  // Interior lining over the shell's inner faces: below the windows, ceiling, rear wall.
  const lin = new Mesher();
  const zr = back;
  lin.span(liner, [-hw + 0.06, eye[1] + 0.95, zr], [hw - 0.06, eye[1] + 0.98, zFront - 0.07]);
  lin.span(liner, [-hw + 0.06, floor, zr], [hw - 0.06, eye[1] + 0.95, zr + 0.02]);
  for (const s of [1, -1])
    lin.span(liner, [s * (hw - 0.065), floor, zr], [s * (hw - 0.08), eye[1] - 0.28, zFront - 0.07]);
  lin.span(liner, [-hw + 0.06, floor, zFront - 0.08], [hw - 0.06, eye[1] - 0.28, zFront - 0.065]);
  lin.span(seat, [-hw + 0.08, floor + 0.03, zr + 0.02], [hw - 0.08, floor + 0.05, zr + 0.4]);
  lin.emit(d.root, name);
  // Live handles: throttle (rotation about x) and automatic brake (swing about y).
  const throttleAt =
    style === 'desktop'
      ? [-0.3, deskTop + 0.03, zFront - 0.5]
      : [eye[0] + 0.48, floor + 1.08, eye[2] + 0.52];
  const throttle = group('throttle-handle', throttleAt);
  root.add(throttle);
  const t = detailKit(throttle, 'throttle-lever');
  t.rod([0, 0, 0], [0, 0.16, 0], 0.014);
  t.box([0.1, 0.04, 0.045], [0, 0.17, 0], t.dark);
  t.finish();
  const brakeAt =
    style === 'desktop'
      ? [-1.18, deskTop + 0.03, zFront - 0.52]
      : [eye[0] - 0.02, floor + 1.04, zFront - 0.42];
  const brake = group('brake-handle', brakeAt);
  root.add(brake);
  const b = detailKit(brake, 'brake-lever');
  b.rod([0, 0, 0], [0, 0.08, 0], 0.016);
  b.box([0.04, 0.03, 0.2], [0, 0.09, -0.08], b.dark);
  b.box([0.05, 0.05, 0.05], [0, 0.1, -0.18], b.red);
  b.finish();
  return {
    nodes: ['close-detail', 'throttle-handle', 'brake-handle'],
    bindings: [
      {
        node: 'throttle-handle',
        source: 'throttle',
        property: 'rotation',
        axis: 'x',
        scale: style === 'desktop' ? 0.5 : -0.45,
        min: -0.5,
        max: 0.5,
        responseSeconds: 0.2,
      },
      {
        node: 'brake-handle',
        source: 'brake',
        property: 'rotation',
        axis: 'y',
        scale: -0.7,
        responseSeconds: 0.3,
      },
    ],
  };
}

function mountData(eye, entry, exitX) {
  return {
    seats: [
      { id: 'driver', role: 'driver', position: eye },
      { id: 'conductor', role: 'passenger', position: [-eye[0], eye[1], eye[2]] },
    ],
    entries: [entry, [-entry[0], entry[1], entry[2]]],
    exits: [
      [exitX, 0, entry[2]],
      [-exitX, 0, entry[2]],
    ],
  };
}

function trucks(root, M, recipe, axleZ, style) {
  const tc = recipe.truckCenters / 2;
  const r = recipe.wheelRadius;
  const n = axleZ.length;
  const names = (offset) => axleZ.map((dz, i) => [`axle-${offset + i + 1}`, dz]);
  root.add(locoTruck(M, 'truck-front', tc, names(0), { r, style }));
  root.add(locoTruck(M, 'truck-rear', -tc, names(n), { r, style }));
}

// --- GE ES44AC -----------------------------------------------------------------------------------

export function es44ac(recipe) {
  const M = railMaterials({ body: recipe.color, stripe: recipe.stripe ?? '#d9a43b' });
  const root = group('ge-es44ac');
  const body = group('body');
  root.add(body);
  const m = new Mesher();
  const hw = 1.56,
    deckY = 1.68,
    sillBottom = 1.15,
    zEnd = recipe.length / 2,
    face = recipe.couplerLength / 2;
  trucks(root, M, recipe, [2.07, 0, -2.07], 'ge');
  frame(m, M, { hw, deckY, sillBottom, zEnd, face });
  for (const dir of [1, -1]) pilot(m, M, { dir, zEnd, deckY, hw });
  fuelTank(m, M, { hw: 1.38, y0: 0.42, y1: sillBottom, z0: -5.1, z1: 5.1 });
  // Wide-cab nose: tall front face, sloped top rising to the windscreens; nose door, headlights.
  const noseFront = 10.25,
    cabFront = 8.85,
    cabRear = 6.15,
    nhw = 1.24;
  m.slab(
    M.body,
    [
      [cabFront - 0.02, deckY],
      [noseFront, deckY],
      [noseFront, 2.62],
      [noseFront - 0.3, 2.9],
      [cabFront - 0.02, 2.97],
    ],
    2 * nhw,
    'zy',
    [nhw, 0, 0],
  );
  m.span(
    M.stripe,
    [-nhw - 0.004, deckY + 0.2, noseFront - 0.2],
    [nhw + 0.004, deckY + 0.36, noseFront + 0.004],
  );
  for (const x of [0.32, 0.92])
    m.box(M.dark, [0.016, 0.92, 0.012], [x, deckY + 0.5, noseFront + 0.004]);
  m.box(M.dark, [0.6, 0.016, 0.012], [0.62, deckY + 0.96, noseFront + 0.004]);
  m.box(M.steel, [0.03, 0.1, 0.03], [0.4, deckY + 0.5, noseFront + 0.02]);
  m.span(M.frame, [-0.4, 2.3, noseFront - 0.02], [0.4, 2.56, noseFront + 0.02]);
  for (const x of [-0.17, 0.17]) headlight(m, M, { x, y: 2.43, z: noseFront, dir: 1, r: 0.09 });
  // Full-width cab with twin windscreens, side windows, AC unit, horn and antennas.
  const front = [
    [0.1, 1.33, 2.99, 3.74],
    [-1.33, -0.1, 2.99, 3.74],
  ];
  cabShell(m, M, {
    hw: 1.55,
    z0: cabRear,
    z1: cabFront,
    bottom: deckY - 0.04,
    eave: 4.4,
    crown: 4.55,
    front,
    side: [
      [8.05, 8.62, 2.99, 3.7],
      [7.38, 7.98, 2.99, 3.7],
    ],
  });
  wipers(m, M, front, cabFront);
  for (const s of [1, -1]) {
    numberBoard(m, M, {
      text: recipe.number ?? '5521',
      x: s * 1.02,
      y: 4.06,
      z: cabFront,
      dir: 1,
      w: 0.5,
      h: 0.18,
    });
    m.span(M.stripe, [s * 1.55 - s * 0.003, 2.42, cabRear], [s * (1.555 + 0.004), 2.56, cabFront]);
    sideText(m, M.lettering, recipe.number ?? '5521', s, s * 1.56, 2.0, 7.5, 0.3);
  }
  m.box(M.frame, [1.1, 0.12, 0.95], [0, 4.6, 7.4]);
  roofGear(m, M, { x: 0.35, y: 4.52, z: 6.55 });
  m.rod(M.frame, [-0.8, 4.5, 6.5], [-0.8, 4.72, 6.5], 0.01);
  m.cyl(M.lettering, 0.07, 0.04, 0.05, [-0.4, 4.57, 6.45], 'y', 10);
  // Long hood: electrical cabinet and dynamic-brake housing behind the cab, engine room with
  // doors, inertial intake, exhaust stack and the flared radiator section at the rear.
  const hoodTop = 4.15,
    hhw = 1.2;
  hood(m, M.body, { hw: hhw, bottom: deckY, top: hoodTop, z0: -6.0, z1: cabRear - 0.04 });
  hood(m, M.body, { hw: hhw + 0.04, bottom: 3.5, top: 4.4, z0: 3.3, z1: cabRear - 0.04 });
  for (const s of [1, -1])
    grille(m, M, { x: s * (hhw + 0.04), side: s, y0: 3.72, y1: 4.18, z0: 3.5, z1: 5.95 });
  roofGrille(m, M, { x0: -0.85, x1: 0.85, y: 4.4, z0: 3.6, z1: 5.8 });
  hood(m, M.body, { hw: hhw + 0.03, bottom: 3.6, top: 4.3, z0: 0.9, z1: 2.7 });
  for (const s of [1, -1])
    grille(m, M, { x: s * (hhw + 0.03), side: s, y0: 3.75, y1: 4.15, z0: 1.05, z1: 2.55 });
  m.box(M.frame, [0.38, 0.3, 0.95], [0, hoodTop + 0.12, -1.7]);
  m.box(M.dark, [0.3, 0.02, 0.85], [0, hoodTop + 0.275, -1.7]);
  doorSeams(m, M, { hw: hhw, y0: deckY + 0.15, y1: 3.55, z0: -5.85, z1: 3.2, pitch: 0.95 });
  for (const s of [1, -1])
    m.span(M.stripe, [s * hhw - s * 0.003, 2.42, -6.0], [s * (hhw + 0.004), 2.56, cabRear]);
  const wing = [
    [-hhw, deckY],
    [hhw, deckY],
    [hhw, 3.4],
    [1.55, 3.95],
    [1.55, 4.42],
    [1.4, 4.58],
    [-1.4, 4.58],
    [-1.55, 4.42],
    [-1.55, 3.95],
    [-hhw, 3.4],
  ];
  const radRear = -10.25;
  m.slab(M.body, wing, -6.0 - radRear, 'xy', [0, 0, radRear]);
  for (const s of [1, -1]) {
    grille(m, M, { x: s * 1.55, side: s, y0: 3.98, y1: 4.38, z0: -9.95, z1: -6.3, pitch: 0.06 });
    m.span(M.stripe, [s * hhw - s * 0.003, 2.42, radRear], [s * (hhw + 0.004), 2.56, -6.0]);
    sideText(m, M.lettering, 'MLN', s, s * (hhw + 0.004), 3.0, -2.2, 0.55);
  }
  for (const z of [-7.0, -8.9]) fan(m, M, { y: 4.58, z, r: 0.62 });
  // Rear end: headlights, number boards, rear platform.
  for (const x of [-0.17, 0.17]) headlight(m, M, { x, y: 4.0, z: radRear, dir: -1, r: 0.09 });
  for (const s of [1, -1])
    numberBoard(m, M, {
      text: recipe.number ?? '5521',
      x: s * 0.85,
      y: 4.28,
      z: radRear,
      dir: -1,
      w: 0.46,
      h: 0.18,
    });
  // Corner steps, walkway and end railings, sand fillers.
  for (const s of [1, -1])
    for (const d of [1, -1]) {
      cornerSteps(m, M, { x: s * hw, z: d * (zEnd - 0.42), deckY });
      m.cyl(M.steel, 0.06, 0.06, 0.06, [s * 1.35, deckY + 0.03, d * (zEnd - 0.9)], 'y', 8);
    }
  for (const s of [1, -1]) {
    railing(
      m,
      M,
      [
        [s * 0.62, zEnd - 0.06],
        [s * 1.5, zEnd - 0.06],
        [s * 1.5, noseFront - 0.3],
        [s * 1.5, cabFront + 0.08],
      ],
      deckY,
    );
    railing(
      m,
      M,
      [
        [s * 1.5, cabRear - 0.1],
        [s * 1.5, 3.6],
        [s * 1.5, 1.0],
        [s * 1.5, -1.6],
        [s * 1.5, -4.2],
        [s * 1.5, -6.8],
        [s * 1.5, -9.4],
        [s * 1.5, -zEnd + 0.06],
        [s * 0.62, -zEnd + 0.06],
      ],
      deckY,
    );
  }
  m.emit(body);
  const eye = recipe.driverEye;
  const interior = cabInterior(root, {
    style: 'desktop',
    zFront: cabFront - 0.06,
    cabRear,
    floor: deckY + 0.07,
    hw: 1.49,
    eye,
    label: 'MLN',
  });
  return {
    model: root,
    driverEye: eye,
    interior,
    mount: mountData(eye, [hw + 0.25, 0.45, zEnd - 0.42], hw + 0.9),
  };
}

// --- EMD GP38-2 ----------------------------------------------------------------------------------

export function gp38(recipe) {
  const M = railMaterials({ body: recipe.color, stripe: recipe.stripe ?? '#e3d6a2' });
  const root = group('emd-gp38-2');
  const body = group('body');
  root.add(body);
  const m = new Mesher();
  const hw = 1.565,
    deckY = 1.55,
    sillBottom = 1.1,
    zEnd = recipe.length / 2,
    face = recipe.couplerLength / 2;
  trucks(root, M, recipe, [1.37, -1.37], 'blomberg');
  frame(m, M, { hw, deckY, sillBottom, zEnd, face });
  for (const dir of [1, -1]) pilot(m, M, { dir, zEnd, deckY, hw });
  fuelTank(m, M, { hw: 1.3, y0: 0.52, y1: sillBottom, z0: -3.1, z1: 3.1 });
  const hhw = 1.1,
    noseFront = 8.05,
    cabFront = 6.3,
    cabRear = 3.75;
  // Low short hood with the headlight and number-board housing on its nose.
  hood(m, M.body, { hw: hhw, bottom: deckY, top: 2.7, z0: cabFront - 0.04, z1: noseFront, r: 0.2 });
  m.span(M.frame, [-0.6, 2.58, noseFront - 0.32], [0.6, 2.86, noseFront + 0.02]);
  for (const x of [-0.13, 0.13]) headlight(m, M, { x, y: 2.72, z: noseFront, dir: 1, r: 0.08 });
  for (const s of [1, -1])
    numberBoard(m, M, {
      text: recipe.number ?? '2210',
      x: s * 0.42,
      y: 2.72,
      z: noseFront - 0.02,
      dir: 1,
      w: 0.26,
      h: 0.16,
    });
  m.span(
    M.stripe,
    [-hhw - 0.004, deckY + 0.25, noseFront - 0.01],
    [hhw + 0.004, deckY + 0.4, noseFront + 0.004],
  );
  doorSeams(m, M, {
    hw: hhw,
    y0: deckY + 0.12,
    y1: 2.45,
    z0: cabFront + 0.2,
    z1: noseFront - 0.2,
    pitch: 0.8,
  });
  // Standard cab: two front windows over the short hood, sliding side windows.
  const front = [
    [0.12, 1.05, 2.86, 3.64],
    [-1.05, -0.12, 2.86, 3.64],
  ];
  cabShell(m, M, {
    hw: 1.52,
    z0: cabRear,
    z1: cabFront,
    bottom: deckY - 0.04,
    eave: 4.38,
    crown: 4.55,
    front,
    side: [
      [5.38, 6.08, 2.86, 3.6],
      [4.6, 5.3, 2.86, 3.6],
      [3.95, 4.42, 2.9, 3.55],
    ],
  });
  wipers(m, M, front, cabFront);
  roofGear(m, M, { x: 0.3, y: 4.5, z: 4.3 });
  m.rod(M.frame, [-0.7, 4.48, 4.2], [-0.7, 4.7, 4.2], 0.01);
  for (const s of [1, -1]) {
    sideText(m, M.lettering, recipe.number ?? '2210', s, s * 1.523, 2.25, 5.0, 0.3);
  }
  // Long hood: electrical cabinet, carbody filter intake, dynamic brake blister, engine room,
  // exhaust stack, radiator section with two fans, rear headlight and number boards.
  const hoodTop = 4.05;
  hood(m, M.body, { hw: hhw, bottom: deckY, top: hoodTop, z0: -8.05, z1: cabRear - 0.04, r: 0.2 });
  hood(m, M.body, { hw: 1.28, bottom: 3.55, top: 4.3, z0: -0.9, z1: 1.6, r: 0.12 });
  fan(m, M, { y: 4.3, z: 0.35, r: 0.45 });
  for (const s of [1, -1]) {
    grille(m, M, { x: s * 1.28, side: s, y0: 3.68, y1: 4.15, z0: -0.75, z1: 1.45 });
    grille(m, M, { x: s * hhw, side: s, y0: 3.0, y1: 3.92, z0: -7.85, z1: -5.2, pitch: 0.06 });
    m.span(M.stripe, [s * hhw - s * 0.003, 2.3, -8.05], [s * (hhw + 0.004), 2.44, cabRear]);
    m.span(M.stripe, [s * hhw - s * 0.003, 2.3, cabFront], [s * (hhw + 0.004), 2.44, noseFront]);
    sideText(m, M.lettering, 'MLN', s, s * (hhw + 0.004), 2.95, -2.6, 0.5);
  }
  grille(m, M, { x: hhw, side: 1, y0: 3.15, y1: 3.85, z0: 2.0, z1: 3.4 });
  doorSeams(m, M, { hw: hhw, y0: deckY + 0.15, y1: 3.45, z0: -4.95, z1: 3.55, pitch: 0.92 });
  m.box(M.frame, [0.32, 0.26, 0.7], [0, hoodTop + 0.1, -2.4]);
  m.box(M.dark, [0.26, 0.02, 0.62], [0, hoodTop + 0.235, -2.4]);
  for (const z of [-5.9, -7.3]) fan(m, M, { y: hoodTop, z, r: 0.55 });
  m.span(M.frame, [-0.6, 3.5, -8.05 - 0.02], [0.6, 3.92, -8.05 + 0.02]);
  for (const x of [-0.13, 0.13]) headlight(m, M, { x, y: 3.72, z: -8.05, dir: -1, r: 0.08 });
  for (const s of [1, -1])
    numberBoard(m, M, {
      text: recipe.number ?? '2210',
      x: s * 0.42,
      y: 3.72,
      z: -8.05,
      dir: -1,
      w: 0.26,
      h: 0.16,
    });
  for (const s of [1, -1])
    for (const d of [1, -1]) {
      cornerSteps(m, M, { x: s * hw, z: d * (zEnd - 0.4), deckY });
      m.cyl(M.steel, 0.06, 0.06, 0.06, [s * 0.9, deckY + 0.03, d * (zEnd - 0.3)], 'y', 8);
    }
  for (const s of [1, -1]) {
    railing(
      m,
      M,
      [
        [s * 0.6, zEnd - 0.06],
        [s * 1.5, zEnd - 0.06],
        [s * 1.5, 7.2],
        [s * 1.5, cabFront + 0.08],
      ],
      deckY,
    );
    railing(
      m,
      M,
      [
        [s * 1.5, cabRear - 0.1],
        [s * 1.5, 1.4],
        [s * 1.5, -1.0],
        [s * 1.5, -3.5],
        [s * 1.5, -6.0],
        [s * 1.5, -zEnd + 0.06],
        [s * 0.6, -zEnd + 0.06],
      ],
      deckY,
    );
  }
  m.emit(body);
  const eye = recipe.driverEye;
  const interior = cabInterior(root, {
    style: 'aar',
    zFront: cabFront - 0.06,
    cabRear,
    floor: deckY + 0.07,
    hw: 1.46,
    eye,
    label: 'MLN',
  });
  return {
    model: root,
    driverEye: eye,
    interior,
    mount: mountData(eye, [hw + 0.25, 0.45, zEnd - 0.4], hw + 0.9),
  };
}

// --- MPI MP36PH-3C -------------------------------------------------------------------------------

export function mp36(recipe) {
  const M = railMaterials({
    body: recipe.color,
    stripe: recipe.stripe ?? '#2b4f86',
    accent: recipe.accent ?? '#c4493a',
  });
  const root = group('mpi-mp36ph-3c');
  const body = group('body');
  root.add(body);
  const m = new Mesher();
  const hw = 1.6,
    deckY = 1.58,
    skirt = 1.15,
    sillBottom = 1.1,
    roof = 4.75,
    eave = 4.42,
    zEnd = recipe.length / 2,
    face = recipe.couplerLength / 2;
  const front = 9.85,
    rear = -9.75,
    cabRear = 6.95;
  trucks(root, M, recipe, [1.37, -1.37], 'blomberg');
  frame(m, M, { hw: hw - 0.04, deckY, sillBottom, zEnd, face, stripe: false });
  for (const dir of [1, -1]) pilot(m, M, { dir, zEnd, deckY, hw: hw - 0.04, sill: false });
  fuelTank(m, M, { hw: 1.35, y0: 0.5, y1: sillBottom, z0: -4.15, z1: 4.15 });
  // Engine and HEP compartments: full-width cowl with a rounded roof.
  m.slab(M.body, roundedSection(hw, skirt, roof, 0.38, 4), cabRear - rear, 'xy', [0, 0, rear]);
  // Cab: side walls following the nose and raked windscreen, a sloped nose top, the windscreen
  // panel and the visor, all with real openings for the glazing.
  const profile = [
    [cabRear, skirt],
    [front, skirt],
    [front, 2.68],
    [9.1, 2.95],
    [8.7, 3.95],
    [8.5, eave],
    [cabRear, eave],
  ];
  const sideWin = [7.75, 8.55, 3.0, 3.78];
  const rect = (a0, a1, b0, b1) => [
    [a0, b0],
    [a1, b0],
    [a1, b1],
    [a0, b1],
  ];
  for (const s of [1, -1]) {
    m.slab(M.body, profile, 0.06, 'zy', [s > 0 ? hw : -hw + 0.06, 0, 0], [rect(...sideWin)]);
    m.box(
      M.glass,
      [0.012, sideWin[3] - sideWin[2], sideWin[1] - sideWin[0]],
      [s * (hw - 0.03), (sideWin[2] + sideWin[3]) / 2, (sideWin[0] + sideWin[1]) / 2],
    );
    for (const z of [sideWin[0], sideWin[1]])
      m.box(
        M.dark,
        [0.02, sideWin[3] - sideWin[2], 0.03],
        [s * (hw + 0.004), (sideWin[2] + sideWin[3]) / 2, z],
      );
    for (const y of [sideWin[2], sideWin[3]])
      m.box(
        M.dark,
        [0.02, 0.03, sideWin[1] - sideWin[0]],
        [s * (hw + 0.004), y, (sideWin[0] + sideWin[1]) / 2],
      );
  }
  m.face(
    M.body,
    [
      [-hw, skirt, front],
      [hw, skirt, front],
      [hw, 2.68, front],
      [-hw, 2.68, front],
    ],
    [0, 0, 1],
  );
  m.face(
    M.body,
    [
      [-hw, 2.68, front],
      [hw, 2.68, front],
      [hw, 2.95, 9.1],
      [-hw, 2.95, 9.1],
    ],
    [0, 1, 0.4],
  );
  m.face(
    M.body,
    [
      [-hw, 3.95, 8.7],
      [hw, 3.95, 8.7],
      [hw, eave, 8.5],
      [-hw, eave, 8.5],
    ],
    [0, 0.4, 1],
  );
  const lean = Math.atan2(9.1 - 8.7, 3.95 - 2.95);
  const span = Math.hypot(0.4, 1.0);
  const screen = new T.Matrix4()
    .makeTranslation(0, 2.95, 9.1)
    .multiply(new T.Matrix4().makeRotationX(-lean));
  const panes = [
    [0.08, 1.4, 0.06, span - 0.08],
    [-1.4, -0.08, 0.06, span - 0.08],
  ];
  m.slab(
    M.body,
    rect(-hw, hw, 0, span),
    0.05,
    'xy',
    [0, 0, -0.05],
    panes.map((p) => rect(...p)),
    screen,
  );
  for (const [x0, x1, v0, v1] of panes) {
    const g = new T.BoxGeometry(x1 - x0, v1 - v0, 0.012).translate(
      (x0 + x1) / 2,
      (v0 + v1) / 2,
      -0.025,
    );
    m.geo(g, M.glass, screen);
    for (const v of [v0, v1])
      m.geo(
        new T.BoxGeometry(x1 - x0 + 0.03, 0.03, 0.02).translate((x0 + x1) / 2, v, 0.004),
        M.dark,
        screen,
      );
    for (const x of [x0, x1])
      m.geo(
        new T.BoxGeometry(0.03, v1 - v0, 0.02).translate(x, (v0 + v1) / 2, 0.004),
        M.dark,
        screen,
      );
    const pivot = new T.Vector3(
      (x0 + x1) / 2 + (x1 > 0 ? 0.3 : -0.3),
      v0 + 0.06,
      0.03,
    ).applyMatrix4(screen);
    const tip = new T.Vector3(x0 + (x1 > 0 ? 0.1 : 0.45), v0 + 0.09, 0.03).applyMatrix4(screen);
    m.rod(M.dark, pivot.toArray(), tip.toArray(), 0.012, 4);
  }
  // Cab roof band (the cowl's rounded top continued over the cab) and the cab rear bulkhead.
  const arch = roundedSection(hw, eave, roof, 0.38, 4).slice(2);
  m.slab(
    M.body,
    [
      ...arch,
      ...arch
        .slice()
        .reverse()
        .map(([x, y]) => [x * 0.97, y - 0.06]),
    ],
    8.55 - cabRear,
    'xy',
    [0, 0, cabRear],
  );
  m.span(M.body, [-hw + 0.06, skirt, cabRear - 0.02], [hw - 0.06, eave, cabRear + 0.04]);
  // Livery: blue band with a red pinstripe wrapping the nose, number board in the visor,
  // headlights in the nose, cab doors with grab irons and steps.
  for (const s of [1, -1]) {
    m.span(M.stripe, [s * hw - s * 0.003, 1.95, rear], [s * (hw + 0.004), 2.55, front]);
    m.span(M.accent, [s * hw - s * 0.003, 2.6, rear], [s * (hw + 0.004), 2.66, front]);
    sideText(m, M.lettering, recipe.number ?? '901', s, s * (hw + 0.006), 2.25, -3.0, 0.36);
    // Cab door and its steps below.
    m.box(M.dark, [0.012, 2.1, 0.016], [s * (hw + 0.004), 2.8, 7.05]);
    m.box(M.dark, [0.012, 2.1, 0.016], [s * (hw + 0.004), 2.8, 7.65]);
    m.box(M.dark, [0.012, 0.016, 0.6], [s * (hw + 0.004), 3.85, 7.35]);
    m.box(M.steel, [0.03, 0.12, 0.03], [s * (hw + 0.012), 2.7, 7.15]);
    for (const z of [6.95, 7.75])
      m.rod(M.safety, [s * (hw + 0.06), 1.4, z], [s * (hw + 0.06), 3.4, z], 0.018, 6);
    for (let i = 0; i < 3; i++)
      m.span(
        M.steel,
        [s * (hw - 0.3), 0.45 + i * 0.37, 7.08],
        [s * (hw - 0.02), 0.49 + i * 0.37, 7.62],
      );
    for (const z of [7.04, 7.66])
      m.span(M.frame, [s * (hw - 0.32), 0.38, z - 0.015], [s * hw, skirt, z + 0.015]);
  }
  m.span(M.stripe, [-hw - 0.004, 1.95, front - 0.01], [hw + 0.004, 2.55, front + 0.004]);
  m.span(M.accent, [-hw - 0.004, 2.6, front - 0.01], [hw + 0.004, 2.66, front + 0.004]);
  for (const x of [-0.42, 0.42]) headlight(m, M, { x, y: 2.25, z: front, dir: 1, r: 0.1 });
  numberBoard(m, M, {
    text: recipe.number ?? '901',
    x: 0,
    y: 4.18,
    z: 8.6,
    dir: 1,
    w: 0.5,
    h: 0.17,
  });
  // Cowl sides: access doors, upper intake louvres, HEP and radiator grilles.
  doorSeams(m, M, { hw, y0: 1.3, y1: 3.75, z0: -6.4, z1: 4.4, pitch: 1.2 });
  for (const s of [1, -1]) {
    grille(m, M, { x: s * hw, side: s, y0: 2.85, y1: 4.25, z0: -9.45, z1: -6.6, pitch: 0.06 });
    grille(m, M, { x: s * hw, side: s, y0: 2.85, y1: 4.25, z0: 4.6, z1: 6.6, pitch: 0.06 });
    grille(m, M, { x: s * hw, side: s, y0: 3.85, y1: 4.25, z0: -6.2, z1: 4.3, pitch: 0.08 });
  }
  for (const z of [-7.4, -8.75]) fan(m, M, { y: roof - 0.07, z, r: 0.55 });
  roofGrille(m, M, { x0: -0.7, x1: 0.7, y: roof - 0.01, z0: -2.2, z1: -0.4 });
  fan(m, M, { y: roof - 0.07, z: 0.4, r: 0.4 });
  for (const z of [-3.6, 5.3]) {
    m.box(M.frame, [0.34, 0.1, 0.7], [0, roof - 0.01, z]);
    m.box(M.dark, [0.26, 0.02, 0.6], [0, roof + 0.045, z]);
  }
  roofGear(m, M, { x: 0, y: roof - 0.19, z: 7.6 });
  // Rear end: door, headlights, number board, marker lights.
  for (const x of [-0.42, 0.42]) m.box(M.dark, [0.016, 2.0, 0.012], [x, 2.6, rear - 0.004]);
  m.box(M.dark, [0.84, 0.016, 0.012], [0, 3.6, rear - 0.004]);
  m.box(M.glass, [0.5, 0.5, 0.012], [0, 3.15, rear - 0.006]);
  for (const x of [-0.9, 0.9]) headlight(m, M, { x, y: 3.9, z: rear, dir: -1, r: 0.09 });
  numberBoard(m, M, {
    text: recipe.number ?? '901',
    x: 0,
    y: 4.25,
    z: rear,
    dir: -1,
    w: 0.5,
    h: 0.17,
  });
  for (const x of [-1.3, 1.3]) m.cyl(M.marker, 0.06, 0.06, 0.04, [x, 4.15, rear - 0.02], 'z', 10);
  for (const s of [1, -1])
    m.path(
      M.safety,
      [
        [s * 0.55, 1.7, rear - 0.08],
        [s * 0.55, 3.3, rear - 0.08],
      ],
      0.018,
      6,
    );
  m.emit(body);
  const eye = recipe.driverEye;
  const interior = cabInterior(root, {
    style: 'desktop',
    zFront: 9.0,
    cabRear,
    floor: 1.72,
    hw: 1.52,
    eye,
    label: 'MLN',
  });
  return {
    model: root,
    driverEye: eye,
    interior,
    mount: mountData(eye, [hw + 0.2, 0.45, 7.35], hw + 0.9),
  };
}
