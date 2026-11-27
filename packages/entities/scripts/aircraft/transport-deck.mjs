/** Kit transport flight decks: A220, CJ4, Q400 and G650 (transport-kit.mjs). One shell fits every
 * measured nose: a floor and liners on the skin from the footwell to the flight-deck bulkhead, a
 * footwell wall, the panel board and glareshield hood, seats and rudder pedals. Each type's builder
 * supplies a `deck` layout that draws its own displays, glareshield controller, pedestal, control
 * wheels or side-sticks and levers with the helpers handed to it (`ctx`). Body frame as in
 * transport-kit: +X pilot left, +Y up, +Z forward; panel parts face the pilot (-Z).
 */
import { aircraftPanelTools as panelTools } from '../vehicle-interiors.mjs';
import {
  bar,
  contour,
  lathe,
  loftUp,
  partPalette,
  pedalGeometry,
  place,
  roundedBox,
  tube,
} from './cockpit-parts.mjs';
import { detailKit, group, sheet, T } from './mesh-kit.mjs';

const pi = Math.PI;
const mat = (name, color, roughness = 0.75) =>
  new T.MeshStandardMaterial({ name, color, roughness, metalness: 0.05, flatShading: true });

const lerp = (a, b, t) => a + (b - a) * t;
const steps = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => lerp(a, b, i / n));
const smoothMat = (name, color, roughness = 0.88) =>
  new T.MeshStandardMaterial({ name, color, roughness, metalness: 0.02 });

/** Bake a part drawn by a library function into kit `k` at a pose in the kit's frame. The part
 * keeps its own (shared) materials, so stamped parts batch together. Not for lettering. */
export function stamp(k, at, rotation, draw) {
  const holder = new T.Group();
  draw(detailKit(holder, 'stamp'));
  holder.position.fromArray(at);
  holder.rotation.set(...rotation);
  holder.updateMatrixWorld(true);
  holder.traverse((mesh) => {
    if (mesh.isMesh) k.add(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld), mesh.material);
  });
}

/** An indexed quad grid through rows of points, wound to face `toward(point)`. */
function grid(k, rows, material, toward) {
  const n = rows[0].length,
    positions = rows.flat(2),
    indices = [];
  for (let i = 0; i < rows.length - 1; i++)
    for (let j = 0; j < n - 1; j++) {
      const a = i * n + j;
      indices.push(a, a + 1, a + n + 1, a, a + n + 1, a + n);
    }
  const p = (q) => new T.Vector3().fromArray(positions, q * 3);
  for (let t = 0; t < indices.length; t += 3) {
    const a = p(indices[t]),
      normal = p(indices[t + 1])
        .sub(a)
        .cross(p(indices[t + 2]).sub(a));
    if (normal.lengthSq() < 1e-10) continue;
    if (normal.dot(toward(a)) < 0)
      for (let q = 0; q < indices.length; q += 3)
        [indices[q + 1], indices[q + 2]] = [indices[q + 2], indices[q + 1]];
    break;
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return k.add(geometry, material);
}

/** Liners just inside the skin, from the footwell wall `from` back to the bulkhead: the roof over
 * the window headers, the sides under the sills down to the floor, and the whole side aft of the
 * glass. The kit's window-frame members stand proud of them, so their edges meet under a frame. */
function deckLining(d, shell, material, { from, floor, center, inset = 0.02, step = 0.14 }) {
  // A little past the bulkhead: its disc stands inside the skin, and the ring between showed paint.
  const to = shell.bulkhead - 0.06,
    glassAft = shell.glass[0];
  const zs = [
    ...new Set([...steps(from, to, Math.max(2, Math.round((from - to) / step))), glassAft]),
  ]
    .filter((z) => z <= from && z >= to)
    .sort((a, b) => b - a);
  const aFloor = (z) => shell.angle(z, floor - 0.03),
    aTop = (z) =>
      shell.crown(z) <= shell.top(z)
        ? 0
        : Math.min(aFloor(z), shell.angle(z, shell.top(z)) + 0.015),
    aSill = (z) => Math.min(aFloor(z), Math.max(aTop(z), shell.angle(z, shell.sill(z)) - 0.015));
  const toward = (p) => new T.Vector3(-p.x, center - p.y, 0);
  for (const side of [-1, 1]) {
    const strip = (list, a0, a1, n) => {
      if (list.length > 1)
        grid(
          d,
          list.map((z) => steps(a0(z), a1(z), n).map((a) => shell.point(z, a, side, -inset))),
          material,
          toward,
        );
    };
    strip(zs, () => 0, aTop, 6);
    strip(
      zs.filter((z) => z <= glassAft + 1e-6),
      aTop,
      aSill,
      4,
    );
    strip(zs, aSill, aFloor, 7);
  }
}

/** A flat contour from left-edge points mirrored to the right, facing `normal`. */
const halfSheet = (d, points, material, normal) =>
  sheet(d, [...points, ...points.map(([x, y, z]) => [-x, y, z]).reverse()], material, normal);

/** A flat display ring (a dial or compass rose outline) facing the pilot: far fewer triangles
 * than a torus. */
const dial = (k, radius, width, at, material) =>
  k.add(new T.RingGeometry(radius - width, radius + width, 28, 1).rotateY(pi), material, at);

export function transportDeck(root, s, f) {
  const L = f.layout ?? {};
  const C = {
    panel: '#4d595e',
    glare: '#2b3033',
    lining: '#8d9497',
    floor: '#3b4144',
    seat: '#9d9787',
    bezel: '#22282b',
    ...L.colors,
  };
  const cabin = group(root, 'cockpit');
  const d = detailKit(cabin, 'cockpit-fixed');
  const m = {
    panel: mat('instrument-panel', C.panel),
    // A second panel colour takes the same satin finish under the shared control-panel name.
    console: C.console ? mat('flight-control-panel', C.console) : undefined,
    padded: mat('coaming-padding', C.glare),
    lining: smoothMat('cockpit-lining', C.lining),
    floor: mat('cockpit-floor', C.floor, 0.95),
    seat: smoothMat('seat-fabric', C.seat, 0.92),
    belt: mat('seat-harness', '#b7b29c'),
    bezel: mat('display-bezel', C.bezel, 0.55),
    screen: mat('instrument-display', '#0b161b', 0.3),
    sky: mat('display-sky', '#2f6fae', 0.4),
    ground: mat('display-ground', '#7a4b26', 0.4),
    symbol: mat('display-symbol', '#e8e6da', 0.4),
    green: mat('display-green', '#3fbf6a', 0.4),
    cyan: mat('display-cyan', '#41b8d0', 0.4),
    magenta: mat('display-magenta', '#c45ac8', 0.4),
    amber: mat('display-amber', '#e0a23a', 0.4),
  };
  m.console ??= m.panel;
  const P = partPalette({ panel: m.console });
  const tools = panelTools(d, { screen: m.screen }),
    bindings = [];
  const [ex, ey, ez] = f.eye,
    { floor, deck, shell } = f,
    sy = ey - 0.48,
    sz = ez + 0.67,
    width = f.cabinWidth,
    panelWidth = deck.panelWidth,
    consoleY = Math.max(ey - (f.large ? 0.92 : 0.72), floor + 0.25),
    footZ = sz + 0.2;
  const kits = [];
  const text = (k, label, at, height = 0.008, role = 'panel', material = d.ivory) =>
    k.text(label, at, height, pi, material, role);
  /** A fixed kit posed in the body frame; panel parts face its local -Z. */
  const face = (name, at, rotation = [0, 0, 0], parent = cabin) => {
    const g = group(parent, name, at);
    g.rotation.set(...rotation);
    const k = detailKit(g, `${name}-detail`);
    kits.push(k);
    return k;
  };
  /** A moving control: its own pivot group with the aircraftControl metadata the client reads.
   * `engine` indexes the engines from the left (0 = engine-1, on +X). */
  const control = (name, at, rotation, { action, engine, motion }, parent = cabin) => {
    const g = group(parent, name, at);
    g.rotation.set(...rotation);
    const k = detailKit(g, `${name}-moving`);
    kits.push(k);
    g.userData.aircraftControl = {
      action,
      ...(engine === undefined ? {} : { engine: `engine-${engine + 1}` }),
      motion,
    };
    return k;
  };
  /** A display: bezel, glass and simple original symbology by kind. A `horizon` name adds the
   * bound attitude cue (roll and pitch) over a PFD. */
  const screen = (k, x, y, z, w, h, kind, { horizon, parent = cabin, bezel = m.bezel } = {}) => {
    k.box([w + 0.024, h + 0.024, 0.02], [x, y, z + 0.009], bezel);
    k.box([w, h, 0.003], [x, y, z - 0.0025], m.screen);
    const front = z - 0.0045,
      at = (u, v) => [x + u * w, y + v * h, front],
      flat = (u, v, sw, sh, material, lift = 0) =>
        k.box([sw * w, sh * h, 0.001], [x + u * w, y + v * h, front - lift], material);
    if (kind === 'pfd') {
      flat(0, 0.2, 0.5, 0.36, m.sky);
      flat(0, -0.12, 0.5, 0.28, m.ground);
      flat(-0.36, 0.1, 0.12, 0.6, d.dark, 0.0005);
      flat(0.36, 0.1, 0.12, 0.6, d.dark, 0.0005);
      flat(0, 0.04, 0.16, 0.012, m.amber, 0.001);
      dial(k, h * 0.17, 0.0012, at(0, -0.36), m.symbol);
      flat(0, -0.36, 0.01, 0.07, m.symbol, 0.0008);
      flat(-0.36, 0.1, 0.1, 0.05, m.symbol, 0.001);
      flat(0.36, 0.1, 0.1, 0.05, m.symbol, 0.001);
      if (horizon) {
        const g = group(parent, horizon, [x, y + h * 0.04, front - 0.0016]);
        const cue = detailKit(g, 'horizon-line');
        cue.box([w * 0.48, 0.0025, 0.001], [0, 0, 0], m.symbol);
        for (const v of [-2, -1, 1, 2])
          cue.box([w * (v % 2 ? 0.12 : 0.2), 0.0012, 0.001], [0, v * h * 0.07, 0], m.symbol);
        cue.finish();
        // Faces look along -Z, where +Z rotation is clockwise: the horizon turns against the bank.
        bindings.push(
          { node: horizon, source: 'roll', property: 'rotation', axis: 'z', scale: -1 },
          {
            node: horizon,
            source: 'pitch',
            property: 'position',
            axis: 'y',
            scale: -0.09,
            min: -h * 0.22,
            max: h * 0.22,
          },
        );
      }
    } else if (kind === 'map') {
      dial(k, h * 0.36, 0.0012, at(0, -0.28), m.symbol);
      dial(k, h * 0.2, 0.001, at(0, -0.28), m.cyan);
      k.rod(at(0, -0.28), at(0.12, 0.25), 0.0012, m.magenta);
      k.rod(at(0.12, 0.25), at(-0.1, 0.4), 0.0012, m.magenta);
      flat(0, -0.28, 0.03, 0.03, m.symbol, 0.0008);
      flat(-0.38, 0.42, 0.14, 0.04, m.green);
      flat(0.38, 0.42, 0.14, 0.04, m.cyan);
    } else if (kind === 'eicas') {
      for (const u of [-0.22, 0.22])
        for (const [v, r] of [
          [0.25, 0.14],
          [-0.02, 0.1],
        ]) {
          dial(k, h * r, 0.0014, at(u, v), m.symbol);
          k.rod(at(u, v), at(u + 0.06, v + 0.08), 0.0013, m.green);
        }
      for (let i = 0; i < 4; i++) flat(0, -0.22 - i * 0.065, 0.62, 0.022, i ? m.green : m.amber);
    } else if (kind === 'synoptic') {
      for (const u of [-0.25, 0, 0.25]) flat(u, 0.05, 0.012, 0.5, m.green);
      flat(0, 0.3, 0.6, 0.012, m.green);
      flat(0, -0.2, 0.6, 0.012, m.green);
      for (const u of [-0.25, 0.25]) dial(k, h * 0.06, 0.0012, at(u, 0.05), m.cyan);
      flat(0, 0.44, 0.84, 0.05, d.dark);
    } else if (kind === 'cdu') {
      for (let i = 0; i < 5; i++)
        flat(-0.1, 0.36 - i * 0.16, 0.6, 0.06, i % 2 ? m.cyan : m.green, 0.0005);
    } else {
      for (let i = 0; i < 4; i++) flat(0, 0.3 - i * 0.18, 0.6, 0.025, i % 2 ? m.cyan : m.symbol);
    }
  };
  /** An integrated standby display, with the standby airspeed and altitude pointers bound. */
  const standby = (k, x, y, z, size, parent = cabin) => {
    k.box([size + 0.02, size + 0.02, 0.02], [x, y, z + 0.009], m.bezel);
    k.box([size, size, 0.003], [x, y, z - 0.0025], m.screen);
    k.box([size * 0.46, size * 0.26, 0.001], [x, y + size * 0.13, z - 0.0045], m.sky);
    k.box([size * 0.46, size * 0.26, 0.001], [x, y - size * 0.13, z - 0.0045], m.ground);
    for (const [i, u, source, scale] of [
      [0, -0.37, 'airspeed', 0.04],
      [1, 0.37, 'altitude', 0.02],
    ]) {
      const r = size * 0.1,
        at = [x + u * size, y + size * 0.15, z - 0.0045];
      dial(k, r, 0.001, at, m.symbol);
      const needle = group(parent, `needle-standby-${i}`, [at[0], at[1], at[2] - 0.001]),
        n = detailKit(needle, `standby-${i}-pointer`);
      n.box([0.0016, r * 0.85, 0.0008], [0, r * 0.4, 0], m.symbol);
      n.finish();
      bindings.push({
        node: needle.name,
        source,
        property: 'rotation',
        axis: 'z',
        scale,
        offset: 0,
      });
    }
    for (const u of [-1, 1])
      k.box([0.006, 0.006, 0.004], [x + u * size * 0.38, y - size * 0.42, z - 0.004], d.dark);
  };
  /** An outboard console from `inner` (|x|) out to the lined wall, its top at `top`, between `aft`
   * and `fore`; the outboard edge follows the skin. Returns the narrowest wall it met. */
  const sideConsole = (side, { inner, top, aft, fore, material = m.console }) => {
    const zs = steps(fore, aft, 8),
      wall = (z, y) => Math.max(inner + 0.05, shell.skin(z, y) - 0.03);
    sheet(
      d,
      [
        ...zs.map((z) => [side * inner, top, z]),
        ...zs.map((z) => [side * wall(z, top), top, z]).reverse(),
      ],
      material,
      [0, 1, 0],
    );
    sheet(
      d,
      [
        [side * inner, floor, fore],
        [side * inner, top, fore],
        [side * inner, top, aft],
        [side * inner, floor, aft],
      ],
      material,
      [-side, 0, 0],
    );
    for (const [z, normal] of [
      [fore, 1],
      [aft, -1],
    ]) {
      const ys = steps(floor, top, 6);
      sheet(
        d,
        [
          ...ys.map((y) => [side * inner, y, z]),
          ...ys.map((y) => [side * wall(z, y), y, z]).reverse(),
        ],
        material,
        [0, 0, normal],
      );
    }
    return Math.min(...zs.map((z) => wall(z, top)));
  };
  /** A centre pedestal: a side profile [[z, y], ...] (a simple polygon) extruded across ±half. */
  const pedestal = (profile, half, material = m.console) =>
    d.add(
      new T.ExtrudeGeometry(new T.Shape(profile.map(([z, y]) => new T.Vector2(z, y))), {
        depth: 2 * half,
        bevelEnabled: false,
      })
        .rotateY(-pi / 2)
        .translate(half, 0, 0),
      material,
    );
  const ctx = {
    s,
    f,
    cabin,
    sideConsole,
    pedestal,
    d,
    m,
    P,
    tools,
    bindings,
    eye: f.eye,
    floor,
    sy,
    sz,
    width,
    panelWidth,
    consoleY,
    deck,
    shell,
    face,
    control,
    screen,
    standby,
    text,
    stamp,
  };

  // Shell. The floor runs to the skin; liners hide the painted skin's inner face; the footwell
  // wall closes the nose under the panel, behind the pedals.
  halfSheet(
    d,
    steps(footZ, shell.bulkhead + 0.02, 14).map((z) => [
      Math.max(0.1, shell.skin(z, floor + 0.004) - 0.012),
      floor,
      z,
    ]),
    m.floor,
    [0, 1, 0],
  );
  halfSheet(
    d,
    steps(floor - 0.01, sy - 0.19, 8).map((y) => [
      Math.max(0.1, shell.skin(footZ, y) - 0.014),
      y,
      footZ,
    ]),
    m.lining,
    [0, 0, -1],
  );
  deckLining(d, shell, m.lining, { from: footZ, floor, center: ey });

  // Panel board, chamfered under the windscreen; all faces point at the pilot (-Z).
  const half = panelWidth / 2,
    board = new T.Shape(
      [
        [-half, -0.215],
        [half, -0.215],
        [half, 0.125],
        [deck.panelTop, 0.215],
        [-deck.panelTop, 0.215],
        [-half, 0.125],
      ].map(([x, y]) => new T.Vector2(x, y)),
    );
  d.add(new T.ExtrudeGeometry(board, { depth: 0.08, bevelEnabled: false }), m.panel, [
    0,
    sy,
    sz + 0.015,
  ]);
  // A thin padded hood running forward to the sill, narrowing with the nose, with a rolled lip.
  const { near, far } = deck.hood,
    lip = sz - 0.07,
    hoodY = sy + 0.262,
    plan = new T.Shape([
      new T.Vector2(-near, 0),
      new T.Vector2(near, 0),
      new T.Vector2(far, 0.2),
      new T.Vector2(-far, 0.2),
    ]);
  // Falls away from the pilot, so the lip and not the far edge sets the view over the nose.
  d.add(
    new T.ExtrudeGeometry(plan, { depth: 0.022, bevelEnabled: false }).rotateX(pi / 2 + 0.24),
    m.padded,
    [0, hoodY, lip],
  );
  d.rod([-near, hoodY - 0.012, lip], [near, hoodY - 0.012, lip], 0.017, m.padded);

  // Seats, rudder pedals and the two control wheels or side-sticks (bound control-N, pedal-N-S).
  for (const [seatIndex, x] of [Math.abs(ex), -Math.abs(ex)].entries()) {
    crewSeat(d, m, x, ey - 0.8, ez - 0.18, floor, L.seat);
    const controlX = L.controlX ? L.controlX(x, ctx) : x,
      at = { ...ctx, seat: seatIndex, x: controlX, side: Math.sign(x) };
    const pivot = group(cabin, `control-${seatIndex}`, [controlX, ey - 0.56, ez + 0.3]);
    const c = detailKit(pivot, 'control-hardware');
    L.control?.(c, at);
    c.finish();
    bindings.push(
      { node: pivot.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.22 },
      { node: pivot.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.3 },
    );
    L.column?.(d, at);
    for (const side of [-1, 1]) {
      const pedal = group(cabin, `pedal-${seatIndex}-${side}`, [
        x + side * 0.12,
        floor + 0.16,
        ez + 0.53,
      ]);
      const p = detailKit(pedal, 'pedal');
      pedalGeometry(p, { style: 'airliner', ...L.pedals, side, palette: P });
      p.finish();
      // Right rudder pushes the right pedal (-X) forward.
      bindings.push({
        node: pedal.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: -side * 0.035,
      });
    }
  }
  // Power levers on the pedestal quadrant (bound power-lever-N); the type draws each lever.
  for (let i = 0; i < 2; i++) {
    const lever = group(cabin, `power-lever-${i}`, [
      (i - 0.5) * (L.leverSpacing ?? 0.048),
      consoleY + 0.06,
      ez + 0.38,
    ]);
    const p = detailKit(lever, 'lever');
    L.powerLever?.(p, { ...ctx, index: i, side: i ? 1 : -1 });
    p.finish();
    bindings.push({
      node: lever.name,
      source: 'power',
      property: 'rotation',
      axis: 'x',
      scale: 0.6,
      offset: -0.3,
    });
  }
  // The overhead panel, inside the roof (deckFit); the type adds its switches.
  const overhead = {
    w: Math.min(0.72, width * 0.6),
    y: ey + deck.overheadY,
    z: ez + deck.overheadZ,
    depth: 0.58,
  };
  // Under a low roof (CJ4) deckFit cannot lift it clear: drop it under the crown and narrow it to
  // the skin so its top edges stay inside the lining.
  const roofZs = steps(overhead.z - overhead.depth / 2, overhead.z + overhead.depth / 2, 6);
  overhead.y = Math.min(overhead.y, Math.min(...roofZs.map((rz) => shell.crown(rz))) - 0.1);
  overhead.w = Math.min(
    overhead.w,
    2 * Math.min(...roofZs.map((rz) => shell.skin(rz, overhead.y + 0.03) - 0.045)),
  );
  d.box([overhead.w, 0.055, overhead.depth], [0, overhead.y, overhead.z], m.console);
  L.build?.({ ...ctx, overhead });
  for (const k of kits) k.finish();
  d.finish();
  return { nodes: ['cockpit'], bindings };
}

/**
 * A control wheel about its hub, the horns in the XY plane facing the pilot (-Z). Its proportions
 * make each type's own wheel: `span` between grip centres, `horn` grip height, `cant` outward lean
 * of the horns, `grip` radius, `drop` how far the arms dip under the hub, `hub` [w, h, d], `heads`
 * the switch pods on the horn tops (scale, 0 for none), `plate` a checklist plate [w, h].
 */
export function controlWheel(
  k,
  P,
  {
    span = 0.32,
    horn = 0.12,
    cant = 0.08,
    grip = 0.016,
    drop = 0.03,
    hub = [0.09, 0.065, 0.05],
    heads = 1,
    plate,
    flare = 1,
  } = {},
) {
  const half = span / 2,
    z = -hub[2] / 2 + 0.006;
  k.add(roundedBox(hub, Math.min(0.015, hub[1] / 3)), P.grip);
  k.add(
    place(new T.CylinderGeometry(0.018, 0.022, 0.07, 14), [0, -0.01, 0.05], [pi / 2, 0, 0]),
    P.steel,
  );
  for (const s of [-1, 1]) {
    k.add(
      tube(
        [
          [s * hub[0] * 0.42, -0.008, z],
          [s * half * 0.55, -drop, z - 0.004],
          [s * (half - 0.012), -drop * 0.45, z - 0.008],
          [s * half, 0.008, z - 0.01],
        ],
        grip * 0.78,
        10,
      ),
      P.grip,
    );
    const r = grip,
      section = (y, scale, dz = 0) => ({
        y,
        points: contour(0, dz, r * scale * flare, r * scale * 1.15, 12, 2.3),
      });
    k.add(
      place(
        loftUp([
          section(-0.01, 0.8),
          section(horn * 0.2, 1.0),
          section(horn * 0.6, 0.95, 0.002),
          section(horn * 0.95, 0.92),
          section(horn, 0.5),
        ]),
        [s * half, 0.006, z - 0.01],
        [0, 0, -s * cant],
      ),
      P.grip,
    );
    if (heads) {
      const top = [s * (half + Math.sin(cant) * horn), 0.006 + Math.cos(cant) * horn, z - 0.012];
      k.add(
        place(roundedBox([0.03 * heads, 0.026 * heads, 0.036 * heads], 0.008 * heads), top, [
          0,
          0,
          -s * cant,
        ]),
        P.grip,
      );
      k.add(
        place(
          new T.CylinderGeometry(0.005, 0.005, 0.006, 12),
          [top[0], top[1] + 0.012 * heads, top[2] - 0.006],
          [0, 0, 0],
        ),
        P.black,
      );
      k.add(
        place(roundedBox([0.01, 0.008, 0.006], 0.002), [
          top[0] - s * 0.008,
          top[1],
          top[2] - 0.019 * heads,
        ]),
        P.red,
      );
    }
  }
  if (plate)
    k.add(
      place(
        roundedBox([plate[0], plate[1], 0.006], 0.004),
        [0, -hub[1] / 2 - plate[1] / 2 - 0.012, z + 0.01],
        [0.25, 0, 0],
      ),
      P.steel,
    );
}

/** A floor-mounted control column: booted at the floor, raked up to just under the wheel hub. */
export function controlColumn(d, P, x, floor, [, ey, ez], { radius = 0.024, boot = 0.06 } = {}) {
  const foot = [x, floor, ez + 0.47],
    head = [x, ey - 0.6, ez + 0.34];
  d.add(
    lathe(
      [
        [0, 0],
        [boot, 0],
        [boot * 0.9, 0.02],
        [boot * 0.6, 0.04],
        [radius * 1.5, 0.08],
        [radius * 1.3, 0.1],
        [0, 0.1],
      ],
      16,
    ),
    P.tread,
    foot,
  );
  d.add(bar(foot, head, radius, 16, radius * 0.85), P.steel);
}

/** A crew seat: cushion, reclined back, headrest, armrests, harness and its floor pedestal. */
function crewSeat(d, m, x, seatY, seatZ, floor, { width = 0.46, armrests = 2 } = {}) {
  d.add(place(roundedBox([width, 0.12, 0.5], 0.035), [x, seatY, seatZ]), m.seat);
  d.add(
    place(roundedBox([width, 0.62, 0.13], 0.04), [x, seatY + 0.34, seatZ - 0.27], [-0.14, 0, 0]),
    m.seat,
  );
  d.add(
    place(
      roundedBox([width * 0.6, 0.18, 0.11], 0.035),
      [x, seatY + 0.72, seatZ - 0.33],
      [-0.1, 0, 0],
    ),
    m.seat,
  );
  for (const side of [-1, 1]) {
    const arm = x + side * (width / 2 + 0.03);
    if (armrests > 1 || side === Math.sign(x)) {
      d.add(
        place(roundedBox([0.055, 0.05, 0.32], 0.018), [arm, seatY + 0.2, seatZ - 0.02]),
        d.dark,
      );
      d.rod([arm, seatY + 0.18, seatZ - 0.17], [arm, seatY + 0.05, seatZ - 0.22], 0.012, d.dark);
    }
    d.rod(
      [x + side * 0.15, seatY + 0.6, seatZ - 0.2],
      [x + side * 0.06, seatY + 0.07, seatZ + 0.1],
      0.014,
      m.belt,
    );
    d.rod([x + side * 0.21, seatY + 0.08, seatZ], [x, seatY + 0.08, seatZ + 0.14], 0.014, m.belt);
    d.box([0.03, 0.025, 0.62], [x + side * 0.15, floor + 0.0125, seatZ], d.metal);
  }
  d.box([0.05, 0.035, 0.016], [x, seatY + 0.08, seatZ + 0.15], d.metal);
  d.box([width * 0.7, seatY - floor - 0.07, 0.38], [x, (seatY + floor) / 2 - 0.03, seatZ], d.dark);
}
