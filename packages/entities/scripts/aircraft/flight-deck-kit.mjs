/** Parts for type-specific transport flight decks. Holds no aircraft's arrangement: each type lays
 * out its own deck in its *-cockpit.mjs module from published dimensions. Geometry is original and
 * diagrammatic. Displays are live where the simulation has the value (attitude, true airspeed,
 * geometric altitude, true heading, vertical speed, engine speed, flaps, gear and the crew's own
 * inputs) and dark or dashed where it does not. No vendor imagery, no invented readings.
 *
 * Frames. Body frame as in transport-kit: +X pilot left, +Y up, +Z forward. Every mounting surface
 * is a group whose local X is body X, whose local Y runs up the surface as its labels read and whose
 * local -Z faces the crew, so one set of part builders serves panel, pedestal, overhead and consoles.
 *
 * Screens sit in panel apertures. Symbology that moves (horizon card, tapes, compass cards) lives
 * behind the panel face and behind a black mask with windows, so it never shows outside its window:
 *   +0.015 backing, +0.011 horizon card, +0.008 horizon mask, +0.0075 tape ground,
 *   +0.006 moving tapes and cards, +0.0045 screen mask, +0.003 fixed symbols, +0.002 digits,
 *   0 panel face, -0.006 bezel face.
 */
import { instrumentGeometry } from './instrument-geometry.mjs';
import { beveledBox, detailKit, group, mat, sheet, T } from './mesh-kit.mjs';

const PI = Math.PI;
export const rect = (x, y, w, h, z = 0) => [
  [x - w / 2, y - h / 2, z],
  [x + w / 2, y - h / 2, z],
  [x + w / 2, y + h / 2, z],
  [x - w / 2, y + h / 2, z],
];
export function rounded(x, y, w, h, r, z = 0, n = 3) {
  const out = [];
  for (const [cx, cy, a0] of [
    [x + w / 2 - r, y + h / 2 - r, 0],
    [x - w / 2 + r, y + h / 2 - r, PI / 2],
    [x - w / 2 + r, y - h / 2 + r, PI],
    [x + w / 2 - r, y - h / 2 + r, 1.5 * PI],
  ])
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i * PI) / 2 / n;
      out.push([cx + r * Math.cos(a), cy + r * Math.sin(a), z]);
    }
  return out;
}
export const circle = (x, y, r, z = 0, n = 24) =>
  Array.from({ length: n }, (_, i) => [
    x + r * Math.cos((2 * PI * i) / n),
    y + r * Math.sin((2 * PI * i) / n),
    z,
  ]);

// 3 x 5 cells, read row by row. Shared with vehicle-detail's lettering, plus a few symbols.
const GLYPHS = {
  A: '010101111101101',
  B: '110101110101110',
  C: '011100100100011',
  D: '110101101101110',
  E: '111100110100111',
  F: '111100110100100',
  G: '011100101101011',
  H: '101101111101101',
  I: '111010010010111',
  J: '001001001101010',
  K: '101101110101101',
  L: '100100100100111',
  M: '101111111101101',
  N: '101111111111101',
  O: '010101101101010',
  P: '110101110100100',
  Q: '010101101111011',
  R: '110101110101101',
  S: '011100010001110',
  T: '111010010010010',
  U: '101101101101111',
  V: '101101101101010',
  W: '101101111111101',
  X: '101101010101101',
  Y: '101101010010010',
  Z: '111001010100111',
  0: '111101101101111',
  1: '010110010010111',
  2: '110001010100111',
  3: '110001010001110',
  4: '101101111001001',
  5: '111100110001110',
  6: '011100111101111',
  7: '111001010010010',
  8: '111101111101111',
  9: '111101111001110',
  '-': '000000111000000',
  '.': '000000000000010',
  '/': '001001010100100',
  ':': '000010000010000',
  '+': '000010111010000',
  '<': '001010100010001',
  '>': '100010001010100',
};
/** Flat lettering facing -Z, centred on the origin; each lit run in a row is one quad. */
export function textGeometry(text, height) {
  const px = height / 5,
    chars = [...String(text).toUpperCase()],
    width = (chars.length * 4 - 1) * px,
    positions = [],
    index = [];
  chars.forEach((ch, n) => {
    const bits = GLYPHS[ch];
    if (!bits) return;
    for (let row = 0; row < 5; row++)
      for (let c = 0; c < 3; c++) {
        if (bits[row * 3 + c] !== '1' || (c > 0 && bits[row * 3 + c - 1] === '1')) continue;
        let e = c;
        while (e < 2 && bits[row * 3 + e + 1] === '1') e++;
        // Seen from -Z, reading runs toward -X.
        const x0 = width / 2 - (n * 4 + c) * px,
          x1 = width / 2 - (n * 4 + e + 1) * px + px * 0.15,
          y1 = height / 2 - row * px,
          y0 = y1 - px * 0.85,
          b = positions.length / 3;
        positions.push(x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y1, 0);
        index.push(b, b + 1, b + 2, b, b + 2, b + 3);
      }
  });
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** Common telemetry: the same named readings the ATR and C-17 decks use. */
function telemetry(engines) {
  const sources = {};
  for (const [name, component, path] of [
    ['trueAirspeed', 'aircraftState', ['airspeed']],
    ['altitude', 'transform', ['pos', 1]],
    ['yaw', 'aircraftState', ['yaw']],
    ['roll', 'aircraftState', ['roll']],
    ['pitch', 'aircraftState', ['pitch']],
    ['verticalSpeed', 'aircraftState', ['verticalSpeed']],
    ['flapPosition', 'aircraftState', ['flapPosition']],
    ['gearPosition', 'aircraftState', ['gearPosition']],
    ['power', 'aircraftInput', ['power']],
    ['pitchInput', 'aircraftInput', ['pitch']],
    ['rollInput', 'aircraftInput', ['roll']],
    ['yawInput', 'aircraftInput', ['yaw']],
  ])
    sources[name] = { component, path };
  const derived = {
    knots: { op: 'multiply', args: ['trueAirspeed', 3600 / 1852] },
    feet: { op: 'divide', args: ['altitude', 0.3048] },
    northYaw: { op: 'subtract', args: [PI, 'yaw'] },
    trueHeading: { op: 'modulo', args: ['northYaw', 2 * PI] },
    degreesTrue: { op: 'multiply', args: ['trueHeading', 180 / PI] },
    verticalFpm: { op: 'multiply', args: ['verticalSpeed', 60 / 0.3048] },
    gearDown: { op: 'greater', args: ['gearPosition', 0.98] },
    gearMoving: { op: 'and', args: ['gearUnlocked', 'gearExposed'] },
    gearUnlocked: { op: 'less', args: ['gearPosition', 0.98] },
    gearExposed: { op: 'greater', args: ['gearPosition', 0.02] },
  };
  for (let i = 1; i <= engines; i++) {
    sources[`engine${i}`] = {
      component: 'aircraftState',
      path: ['engines', `engine-${i}`, 'rpm'],
    };
    derived[`rpm${i}`] = { op: 'multiply', args: [`engine${i}`, 100] };
  }
  return { sources, derived };
}

/**
 * ctx: { parent, prefix, eye, floor, engines, skin(z, y), sill(z), top(z), lining? }
 * style: colours for panel, glareshield, controller, seat, seatTrim, liner, floor, carpet.
 */
export function flightDeck(ctx, style) {
  const { parent, prefix: P, eye, floor } = ctx;
  const cabin = group(parent, 'cockpit');
  const n = (s) => `${P}-${s}`;
  const { sources, derived } = telemetry(ctx.engines ?? 2),
    bindings = [],
    kits = [],
    instruments = [];
  const flat = (label, color, extra = {}) =>
    mat(n(label), color, { roughness: 0.8, metalness: 0.04, ...extra });
  const glow = (label, color, e = 0.5) =>
    mat(n(label), color, { emissive: color, emissiveIntensity: e, roughness: 0.5, metalness: 0 });
  // The backboard, glareshield padding and bare hardware carry the shared cockpit material names,
  // so the per-type cockpit finish profiles (cockpit-materials/library.json) recognise them.
  const shared = (name, color, extra = {}) =>
    mat(name, color, { roughness: 0.8, metalness: 0.04, ...extra });
  const m = {
    panel: shared('instrument-panel', style.panel),
    shield: shared('coaming-padding', style.glareshield ?? '#26292b', { roughness: 0.97 }),
    face: flat('controller', style.controller ?? style.panel),
    black: flat('screen', '#05080a', { roughness: 0.25 }),
    bezel: flat('bezel', style.bezel ?? '#1d2225', { roughness: 0.55 }),
    tape: flat('tape-ground', '#3c444a', { roughness: 0.6 }),
    ink: glow('ink', '#e8eef0', 0.6),
    green: glow('green', '#46d27a'),
    cyan: glow('cyan', '#52d0e4'),
    magenta: glow('magenta', '#d763d0'),
    amber: glow('amber', '#f2b33d'),
    red: glow('red', '#e8473c', 0.6),
    // Unlit annunciator lenses: coloured glass with its legend, dark until a fault.
    lensRed: glow('lens-red', '#7c2a26', 0.12),
    lensAmber: glow('lens-amber', '#7d6326', 0.12),
    lensGreen: glow('lens-green', '#2f5a3f', 0.1),
    lensWhite: glow('lens-white', '#6c7174', 0.08),
    paint: glow('lettering', style.lettering ?? '#e4e6df', 0.12),
    knob: flat('knob', style.knob ?? '#17191b', { roughness: 0.5 }),
    toggle: flat('toggle', '#c8ccce', { metalness: 0.6, roughness: 0.35 }),
    key: flat('key', style.key ?? '#30363a', { roughness: 0.6 }),
    seat: flat('seat', style.seat, { roughness: 0.95 }),
    seatTrim: flat('seat-frame', style.seatTrim ?? '#2b2e31'),
    liner: flat('liner', style.liner ?? '#c7cac6', { side: T.DoubleSide, roughness: 0.92 }),
    floor: flat('floor', style.floor ?? '#3a3e41', { roughness: 1 }),
    metal: shared('detail-alloy', '#a0a7aa', { metalness: 0.6, roughness: 0.35 }),
    grip: flat('grip', style.grip ?? '#1f2224', { roughness: 0.7 }),
  };
  const cd = detailKit(cabin, n('cabin-fixed'));
  kits.push(cd);
  const register = (ins) => {
    instruments.push(ins);
    return ins;
  };
  const label = (d, text, at, height, material = m.paint) =>
    d.add(textGeometry(text, height), material, at);

  /** A mounting surface. along: the surface's reading-up direction in the body frame. */
  function surface(name, origin, along = [0, 1, 0]) {
    const y = new T.Vector3(...along).normalize(),
      z = new T.Vector3(0, -y.z, y.y),
      x = new T.Vector3(1, 0, 0),
      g = group(cabin, n(name), origin);
    g.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z));
    const d = detailKit(g, n(`${name}-fixed`));
    kits.push(d);
    let ins;
    const S = {
      name,
      g,
      d,
      holes: [],
      get ins() {
        ins ??= register(instrumentGeometry(g, n(name)));
        return ins;
      },
      /** Body-frame point of a local surface point. */
      world(p) {
        g.updateMatrix();
        return new T.Vector3(...p).applyMatrix4(g.matrix).toArray();
      },
    };
    return S;
  }
  /** A child frame on a surface, e.g. a canted display or a controller housing. */
  function moving(S, name, at, build) {
    const g = group(S.g, n(name), at),
      d = detailKit(g, g.name);
    build(d, g);
    d.finish();
    return g;
  }
  const bind = (b) => bindings.push(b);

  // ---------------------------------------------------------------- panel faces and screens
  /** Sheet with the surface's accumulated apertures, a dark back and a lit edge trim. */
  function panelSheet(S, contour, { depth = 0.1, material = m.panel } = {}) {
    sheet(
      S.d,
      contour.map(([x, y]) => [x, y, 0]),
      material,
      [0, 0, -1],
      S.holes,
    );
    sheet(
      S.d,
      contour.map(([x, y]) => [x, y, depth]),
      m.bezel,
      [0, 0, 1],
    );
    const mx = contour.reduce((t, p) => t + p[0], 0) / contour.length,
      my = contour.reduce((t, p) => t + p[1], 0) / contour.length;
    for (let i = 0; i < contour.length; i++) {
      const [ax, ay] = contour[i],
        [bx, by] = contour[(i + 1) % contour.length];
      let nx = by - ay,
        ny = -(bx - ax);
      if (nx * ((ax + bx) / 2 - mx) + ny * ((ay + by) / 2 - my) < 0) [nx, ny] = [-nx, -ny];
      sheet(
        S.d,
        [
          [ax, ay, 0],
          [bx, by, 0],
          [bx, by, depth],
          [ax, ay, depth],
        ],
        material,
        [nx, ny, 0],
      );
    }
  }
  /** Bezel, aperture and backing. b: [left, right, top, bottom] margins as the crew sees them. */
  function screen(S, name, x, y, w, h, { b = [0.018, 0.018, 0.018, 0.03], keys = 0 } = {}) {
    const { d } = S,
      L = x + w / 2 + b[0],
      R = x - w / 2 - b[1],
      U = y + h / 2 + b[2],
      D = y - h / 2 - b[3];
    S.holes.push(rect(x, y, w, h, 0));
    sheet(
      d,
      [
        [L, D, -0.006],
        [R, D, -0.006],
        [R, U, -0.006],
        [L, U, -0.006],
      ],
      m.bezel,
      [0, 0, -1],
      [rect(x, y, w, h, -0.006)],
    );
    for (const [cx, cy, sw, sh] of [
      [(L + R) / 2, U - 0.002, L - R, 0.004],
      [(L + R) / 2, D + 0.002, L - R, 0.004],
      [L - 0.002, (U + D) / 2, 0.004, U - D],
      [R + 0.002, (U + D) / 2, 0.004, U - D],
    ])
      d.box([sw, sh, 0.006], [cx, cy, -0.003], m.bezel);
    d.box([w + 0.012, h + 0.012, 0.002], [x, y, 0.015], m.black);
    for (let i = 0; i < keys; i++) {
      const kx = x + w * 0.42 - (i * w * 0.84) / Math.max(1, keys - 1);
      d.box(
        [Math.min(0.022, (w * 0.7) / keys), 0.009, 0.006],
        [kx, D + b[3] * 0.45, -0.009],
        m.key,
      );
    }
    const G = group(S.g, n(name), [x, y, 0]),
      dd = detailKit(G, n(`${name}-fixed`));
    kits.push(dd);
    let ins;
    return {
      G,
      dd,
      w,
      h,
      get ins() {
        ins ??= register(instrumentGeometry(G, n(name)));
        return ins;
      },
    };
  }
  /** Mask in front of moving symbology: the screen in black, with windows. */
  const mask = (s, windows) =>
    sheet(s.dd, rect(0, 0, s.w + 0.006, s.h + 0.006, 0.0045), m.black, [0, 0, -1], windows);
  const lines = (d, points, r, material, z) => {
    for (let i = 0; i < points.length - 1; i++)
      d.rod([...points[i], z], [...points[i + 1], z], r, material);
  };
  const tri = (d, a, b, c, material) => sheet(d, [a, b, c], material, [0, 0, -1]);
  const frameBox = (d, cx, cy, w, h, r, material, z = 0.003) =>
    lines(
      d,
      [
        [cx + w / 2, cy - h / 2],
        [cx - w / 2, cy - h / 2],
        [cx - w / 2, cy + h / 2],
        [cx + w / 2, cy + h / 2],
        [cx + w / 2, cy - h / 2],
      ],
      r,
      material,
      z,
    );

  /** Vertical tape whose ticks scroll with the reading; the readout box carries the digits.
   * Position channels cannot wrap, so the ladder follows the reading modulo one tick cycle and
   * jumps back by exactly one cycle, which the repeating ticks hide. */
  function tape(s, name, win, source, span, tick, every, { side = 1, ground = true } = {}) {
    // side 1: ticks on the tape's edge toward the screen's right; -1 toward its left.
    const k = win.h / span,
      cycle = tick * every,
      period = cycle * k,
      signal = `${s.G.name}.${name}.cycle`;
    derived[signal] = { op: 'modulo', args: [source, cycle] };
    if (ground) s.dd.box([win.w, win.h, 0.0005], [win.cx, win.cy, 0.0075], m.tape);
    const edge = win.cx - (side * win.w) / 2,
      g = group(s.G, `${s.G.name}-${name}-tape`, [0, win.cy, 0.006]),
      d = detailKit(g, g.name);
    for (
      let i = -Math.ceil((win.h / 2 + period) / (tick * k));
      i * tick * k <= win.h / 2 + period;
      i++
    ) {
      const major = ((i % every) + every) % every === 0,
        len = win.w * (major ? 0.32 : 0.18);
      d.box(
        [len, Math.max(0.0007, win.h * 0.006), 0.0004],
        [edge + (side * len) / 2, i * tick * k, 0],
        m.ink,
      );
    }
    d.finish();
    bind({ node: g.name, source: signal, property: 'position', axis: 'y', scale: -k });
    s.ins.available(`${name}-tape`, source, g.name);
  }
  /** Black box with a white outline and live digits, pointing at the tape's reading. */
  function readoutBox(s, name, cx, cy, w, h, source, digits, { signed = false, color } = {}) {
    s.dd.box([w, h, 0.0006], [cx, cy, 0.003], m.black);
    frameBox(s.dd, cx, cy, w, h, Math.max(0.0005, h * 0.03), color ?? m.ink, 0.0028);
    s.ins.readout(name, [cx, cy, 0.002], source, digits, h * 0.62, color ?? m.ink, signed, true);
  }
  /** Rotating compass card with numerals; rest shows north at the top index. */
  function rose(s, cx, cy, r, { labels = true, step = 5 } = {}) {
    const g = group(s.G, `${s.G.name}-rose`, [cx, cy, 0.006]),
      d = detailKit(g, g.name);
    for (let deg = 0; deg < 360; deg += step) {
      const a = (deg * PI) / 180,
        p = (q) => [-Math.sin(a) * q, Math.cos(a) * q, 0],
        len = deg % 10 ? 0.06 : 0.11;
      d.rod(p(r * (1 - len)), p(r), Math.max(0.0005, r * 0.008), m.ink);
      if (labels && deg % 30 === 0)
        d.add(
          textGeometry(deg % 90 ? String(deg / 10) : ['N', 'E', 'S', 'W'][deg / 90], r * 0.1),
          m.ink,
          p(r * 0.78),
        ).rotation.z = a;
    }
    d.finish();
    bind({
      node: g.name,
      source: 'trueHeading',
      property: 'rotation',
      axis: 'z',
      scale: -1,
      period: 2 * PI,
      responseSeconds: 0.15,
    });
    s.ins.available('rose', 'trueHeading', g.name);
    // Lubber mark at the top index.
    tri(
      s.dd,
      [cx + r * 0.05, cy + r * 1.08, 0.003],
      [cx - r * 0.05, cy + r * 1.08, 0.003],
      [cx, cy + r * 0.99, 0.003],
      m.ink,
    );
    return g;
  }
  /** Horizontal heading scale on a drum about the screen's vertical: its front scrolls sideways
   * through the window and wraps through north. r: drum radius, about 1.15 window widths. */
  function headingDrum(s, win, r) {
    const g = group(s.G, `${s.G.name}-heading-drum`, [win.cx, win.cy, 0.006 + r]),
      d = detailKit(g, g.name);
    s.dd.box([win.w, win.h, 0.0005], [win.cx, win.cy, 0.0075], m.tape);
    for (let deg = 0; deg < 360; deg += 5) {
      const a = (deg * PI) / 180,
        // North faces the crew at rest; headings increase toward the screen's right.
        p = (q, y) => [-Math.sin(a) * q, y, -Math.cos(a) * q],
        major = deg % 10 === 0;
      d.box(
        [Math.max(0.0007, win.h * 0.04), win.h * (major ? 0.32 : 0.18), 0.0004],
        p(r, win.h * (major ? 0.32 : 0.41)),
        m.ink,
      ).rotation.y = a;
      if (major)
        d.add(textGeometry(String(deg / 10), win.h * 0.28), m.ink, p(r, -win.h * 0.12)).rotation.y =
          a;
    }
    d.finish();
    bind({
      node: g.name,
      source: 'trueHeading',
      property: 'rotation',
      axis: 'y',
      scale: -1,
      period: 2 * PI,
      responseSeconds: 0.15,
    });
    s.ins.available('heading-drum', 'trueHeading', g.name);
    s.dd.box([0.0012, win.h * 1.1, 0.0005], [win.cx, win.cy, 0.003], m.amber);
  }

  // ---------------------------------------------------------------- displays
  /**
   * Primary flight display. f: element boxes as fractions of the screen, [cx, cy, w, h], +x toward
   * the screen's left as the crew sees it. heading: { kind: 'arc' | 'tape' | 'rose', ... }.
   */
  function pfd(S, name, x, y, w, h, f, opt = {}) {
    const s = screen(S, name, x, y, w, h, opt.screen),
      box = ([cx, cy, bw, bh]) => ({ cx: cx * w, cy: cy * h, w: bw * w, h: bh * h }),
      A = box(f.attitude),
      windows = [rounded(A.cx, A.cy, A.w, A.h, Math.min(A.w, A.h) * (f.corner ?? 0.12), 0.0045)];
    s.ins.horizon('attitude', [A.cx, A.cy, 0.011], A.w * 1.02, A.h * 1.02, { blankBackdrop: true });
    // Bank scale above the sphere.
    for (const deg of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
      const a = (deg * PI) / 180,
        r = A.h * 0.5,
        p = (q) => [A.cx - Math.sin(a) * q, A.cy + Math.cos(a) * q, 0.003];
      s.dd.rod(p(r * 0.9), p(r * (deg % 30 ? 0.95 : 1.0)), A.h * 0.005, m.ink);
    }
    const V = box(f.speed),
      H = box(f.altitude);
    windows.push(rect(V.cx, V.cy, V.w, V.h, 0.0045), rect(H.cx, H.cy, H.w, H.h, 0.0045));
    tape(s, 'speed', V, 'knots', f.speedSpan ?? 80, 10, 2, { side: 1 });
    tape(s, 'altitude', H, 'feet', f.altitudeSpan ?? 800, 100, 5, { side: -1 });
    readoutBox(s, 'speed', V.cx, V.cy, V.w * 0.86, V.h * 0.12, 'knots', 3);
    readoutBox(s, 'altitude', H.cx, H.cy, H.w * 1.05, H.h * 0.11, 'feet', 5, { signed: true });
    label(s.dd, 'TAS', [V.cx, V.cy - V.h / 2 - h * 0.035, 0.003], h * 0.025, m.cyan);
    label(s.dd, 'GEO FT', [H.cx, H.cy - H.h / 2 - h * 0.035, 0.003], h * 0.025, m.cyan);
    if (f.vsi) {
      const Q = box(f.vsi);
      windows.push(rect(Q.cx, Q.cy, Q.w, Q.h, 0.0045));
      s.dd.box([Q.w, Q.h, 0.0005], [Q.cx, Q.cy, 0.0075], m.tape);
      for (const v of [-6, -2, -1, 0, 1, 2, 6]) {
        const yy = Q.cy + Math.sign(v) * Math.sqrt(Math.abs(v) / 6) * Q.h * 0.45;
        s.dd.box(
          [Q.w * (v ? 0.25 : 0.4), Math.max(0.0007, h * 0.004), 0.0004],
          [Q.cx + Q.w * 0.2, yy, 0.006],
          m.ink,
        );
      }
      // Needle pivoted beyond the screen's edge, as on the real displays.
      const pivot = [Q.cx - Q.w * 1.1, Q.cy, 0.0035],
        reach = Q.w * 1.45,
        angle = (v) =>
          -PI / 2 + Math.sign(v) * Math.atan((Math.sqrt(Math.abs(v) / 6000) * Q.h * 0.45) / reach);
      s.ins.pointer(
        'vsi',
        pivot,
        reach,
        'verticalFpm',
        [
          [-6000, angle(-6000)],
          [-1000, angle(-1000)],
          [0, 0 - PI / 2],
          [1000, angle(1000)],
          [6000, angle(6000)],
        ],
        { responseSeconds: 0.2 },
      );
    }
    const hd = f.heading;
    if (hd.kind === 'tape') {
      const W = box(hd.box);
      windows.push(rect(W.cx, W.cy, W.w, W.h, 0.0045));
      headingDrum(s, W, W.w * 1.15);
    } else {
      const c = box([hd.center[0], hd.center[1], 0, 0]),
        r = hd.radius * h;
      if (hd.kind === 'arc') {
        const W = box(hd.window);
        windows.push(rect(W.cx, W.cy, W.w, W.h, 0.0045));
      } else windows.push(circle(c.cx, c.cy, r * 1.12, 0.0045, 36));
      rose(s, c.cx, c.cy, r);
      tri(
        s.dd,
        [c.cx, c.cy + r * 0.35, 0.003],
        [c.cx + r * 0.12, c.cy - r * 0.15, 0.003],
        [c.cx - r * 0.12, c.cy - r * 0.15, 0.003],
        m.ink,
      );
      label(s.dd, 'TRU', [c.cx + r * 0.55, c.cy + r * 1.05, 0.003], h * 0.025, m.green);
    }
    mask(s, windows);
    // Flight mode annunciator columns: outlined and empty, since no mode is simulated.
    if (f.fma) {
      const [cy, fw, fh, cols] = f.fma;
      for (let i = 0; i < cols; i++) {
        const cx = (fw * w) / 2 - ((i + 0.5) * fw * w) / cols;
        if (i)
          s.dd.box(
            [0.0008, fh * h, 0.0004],
            [(fw * w) / 2 - (i * fw * w) / cols, cy * h, 0.003],
            m.ink,
          );
        s.dd.box([(fw * w * 0.12) / cols, 0.0012, 0.0004], [cx, cy * h, 0.003], m.green);
      }
    }
    return s;
  }
  /** Navigation display: an expanded arc or a full rose, range rings, own-ship symbol. */
  function nd(S, name, x, y, w, h, opt = {}) {
    const s = screen(S, name, x, y, w, h, opt.screen),
      arc = opt.kind !== 'rose',
      cy = arc ? h * (opt.center ?? -0.32) : 0,
      r = arc ? h * (opt.radius ?? 0.68) : Math.min(w, h) * 0.4;
    rose(s, 0, cy, r, { step: 5 });
    // The rose is wider than the screen in arc mode: the panel face hides the rest.
    for (const q of [0.5, 0.75]) {
      for (let a = -60; a <= 60; a += 6) {
        const t = (a * PI) / 180,
          p = [-Math.sin(t) * r * q, cy + Math.cos(t) * r * q, 0.003];
        if (!arc || Math.abs(t) < 0.9) s.dd.box([r * 0.012, r * 0.012, 0.0004], p, m.ink);
      }
    }
    tri(
      s.dd,
      [0, cy + r * 0.07, 0.003],
      [r * 0.04, cy - r * 0.05, 0.003],
      [-r * 0.04, cy - r * 0.05, 0.003],
      m.ink,
    );
    readoutBox(s, 'track', 0, h * 0.44, w * 0.13, h * 0.06, 'degreesTrue', 3);
    label(s.dd, 'TRU', [-w * 0.12, h * 0.44, 0.003], h * 0.028, m.green);
    label(s.dd, 'GS --', [w * 0.38, h * 0.44, 0.003], h * 0.028, m.ink);
    label(s.dd, 'NO ROUTE', [-w * 0.3, -h * 0.44, 0.003], h * 0.026, m.ink);
    mask(s, [rect(0, 0, w, h, 0.0045)]);
    return s;
  }
  /** Engine speed on an arc gauge, live, with its digits; EGT and the rest dashed. */
  function arcGauge(s, name, cx, cy, r, source, full = 110) {
    // Zero near nine o'clock, increasing clockwise as the crew sees it.
    const a0 = -PI / 2 - 0.15,
      a1 = a0 + 3.75,
      angle = (v) => a0 + ((a1 - a0) * v) / full;
    for (let i = 0; i <= 22; i++) {
      const a = a0 + ((a1 - a0) * i) / 22,
        b = a0 + ((a1 - a0) * (i + 1)) / 22,
        p = (t, q) => [cx - Math.sin(t) * q, cy + Math.cos(t) * q, 0.003];
      if (i < 22) s.dd.rod(p(a, r), p(b, r), r * 0.025, m.ink);
      if (i % 2 === 0) s.dd.rod(p(a, r * 0.86), p(a, r), r * 0.02, m.ink);
    }
    s.dd.rod(
      [cx - Math.sin(angle(100)) * r * 0.8, cy + Math.cos(angle(100)) * r * 0.8, 0.003],
      [cx - Math.sin(angle(100)) * r * 1.12, cy + Math.cos(angle(100)) * r * 1.12, 0.003],
      r * 0.04,
      m.red,
    );
    s.ins.pointer(
      name,
      [cx, cy, 0.0025],
      r * 0.95,
      source,
      [
        [0, a0],
        [full, a1],
      ],
      { responseSeconds: 0.25 },
    );
    readoutBox(s, `${name}-digits`, cx - r * 0.75, cy + r * 0.45, r * 0.9, r * 0.38, source, 3);
  }
  const blankGauge = (s, cx, cy, r, text) => {
    for (let i = 0; i < 16; i++) {
      const a = -PI / 2 - 0.15 + (3.75 * i) / 16,
        b = -PI / 2 - 0.15 + (3.75 * (i + 1)) / 16;
      s.dd.rod(
        [cx - Math.sin(a) * r, cy + Math.cos(a) * r, 0.003],
        [cx - Math.sin(b) * r, cy + Math.cos(b) * r, 0.003],
        r * 0.025,
        m.ink,
      );
    }
    label(s.dd, '--', [cx, cy, 0.003], r * 0.3, m.ink);
    label(s.dd, text, [cx, cy - r * 0.55, 0.003], r * 0.22, m.cyan);
  };
  /** Engine display: live engine speed dials, blank EGT, flap and gear where simulated. */
  function engines(S, name, x, y, w, h, opt = {}) {
    const s = screen(S, name, x, y, w, h, opt.screen),
      count = ctx.engines ?? 2,
      r = Math.min(w / (count * 2.6), h * 0.16),
      rowY = opt.row ?? h * 0.27;
    for (let i = 0; i < count; i++) {
      const cx = ((count - 1) / 2 - i) * w * (count > 2 ? 0.24 : 0.36);
      arcGauge(s, `rpm-${i + 1}`, cx, rowY, r, `rpm${i + 1}`);
      if (opt.egt !== false) blankGauge(s, cx, rowY - r * 2.5, r * 0.8, 'EGT');
    }
    label(s.dd, opt.caption ?? 'RPM', [0, rowY + r * 0.2, 0.003], h * 0.03, m.cyan);
    if (opt.flaps) flapScale(s, -w * 0.33, -h * 0.3, h * 0.2);
    label(s.dd, 'FUEL --', [w * 0.25, -h * 0.4, 0.003], h * 0.028, m.ink);
    mask(s, []);
    return s;
  }
  /** Flap position slider on a screen. */
  function flapScale(s, cx, cy, len) {
    s.dd.rod([cx, cy + len / 2, 0.003], [cx, cy - len / 2, 0.003], len * 0.012, m.ink);
    const g = group(s.G, `${s.G.name}-flap`, [cx, cy + len / 2, 0.0025]),
      d = detailKit(g, g.name);
    d.box([len * 0.16, len * 0.035, 0.0005], [len * 0.06, 0, 0], m.green);
    d.finish();
    bind({
      node: g.name,
      source: 'flapPosition',
      property: 'position',
      axis: 'y',
      scale: -len,
      min: -len,
      max: 0,
      responseSeconds: 0.3,
    });
    s.ins.available('flap', 'flapPosition', g.name);
    label(s.dd, 'FLAP', [cx, cy + len / 2 + len * 0.12, 0.003], len * 0.08, m.cyan);
  }
  /** Systems or secondary page: static diagram, dashed values; nothing invented. */
  function systems(S, name, x, y, w, h, opt = {}) {
    const s = screen(S, name, x, y, w, h, opt.screen),
      title = opt.title ?? 'STATUS';
    label(s.dd, title, [0, h * 0.42, 0.003], h * 0.035, m.ink);
    s.dd.box([w * 0.3, 0.0008, 0.0004], [0, h * 0.39, 0.003], m.ink);
    const rows = opt.rows ?? ['N2 --', 'FF --', 'OIL P --', 'OIL T --', 'VIB --'];
    rows.forEach((text, i) => {
      for (const side of [-1, 1])
        label(s.dd, text, [side * w * 0.24, h * (0.25 - i * 0.12), 0.003], h * 0.03, m.ink);
    });
    if (opt.gear) gearLamps(s.dd, s.G, `${s.G.name}-gear`, 0, -h * 0.36, h * 0.045, 0.003, true);
    mask(s, []);
    return s;
  }
  /** Three gear-down marks, live. */
  function gearLamps(d, parentGroup, name, cx, cy, size, z, caption) {
    [
      [0, size * 1.3],
      [size * 1.6, -size * 0.2],
      [-size * 1.6, -size * 0.2],
    ].forEach(([dx, dy], i) => {
      const g = group(parentGroup, `${name}-${i}`, [cx + dx, cy + dy, z]),
        k = detailKit(g, g.name);
      k.box([size, size * 0.7, 0.002], [0, 0, 0], m.green);
      k.finish();
      bind({ node: g.name, source: 'gearDown', property: 'visible', scale: 1, missing: 'hide' });
      const t = group(parentGroup, `${name}-transit-${i}`, [cx + dx, cy + dy, z]),
        kt = detailKit(t, t.name);
      kt.box([size, size * 0.7, 0.002], [0, 0, 0.0004], m.amber);
      kt.finish();
      bind({ node: t.name, source: 'gearMoving', property: 'visible', scale: 1, missing: 'hide' });
    });
    if (caption) label(d, 'GEAR', [cx, cy - size * 1.4, z], size * 0.55, m.cyan);
  }
  /** Multifunction display: navigation above, systems below, as on landscape suites. */
  function mfd(S, name, x, y, w, h, opt = {}) {
    const s = screen(S, name, x, y, w, h, opt.screen),
      split = opt.split ?? 0.62,
      top = h * (0.5 - split),
      r = Math.min(w * 0.45, h * split * 0.95);
    const ry = top - h * split * 0.35;
    rose(s, 0, ry, r, { step: 5 });
    tri(
      s.dd,
      [0, ry + r * 0.07, 0.003],
      [r * 0.04, ry - r * 0.05, 0.003],
      [-r * 0.04, ry - r * 0.05, 0.003],
      m.ink,
    );
    readoutBox(s, 'track', 0, h * 0.45, w * 0.12, h * 0.05, 'degreesTrue', 3);
    s.dd.box([w * 0.96, 0.001, 0.0004], [0, top, 0.003], m.ink);
    const rows = opt.rows ?? ['FUEL --', 'HYD --', 'ELEC --'];
    for (const [i, text] of rows.entries())
      label(
        s.dd,
        text,
        [w * 0.3 - i * w * 0.3, top - h * (1 - split) * 0.5 + h * 0.02, 0.003],
        h * 0.028,
        m.ink,
      );
    // The rose runs off the top half: the mask keeps it there.
    mask(s, [rect(0, top + (h * split) / 2 - 0.001, w, h * split, 0.0045)]);
    return s;
  }
  /** Integrated standby: small attitude window over speed and altitude digits. */
  function standby(S, name, x, y, size) {
    const s = screen(S, name, x, y, size, size, { b: [0.012, 0.012, 0.012, 0.016], keys: 3 });
    s.ins.horizon('attitude', [0, size * 0.04, 0.011], size * 0.56, size * 0.56, {
      blankBackdrop: true,
    });
    readoutBox(s, 'speed', size * 0.36, size * 0.04, size * 0.24, size * 0.1, 'knots', 3);
    readoutBox(s, 'altitude', -size * 0.37, size * 0.04, size * 0.24, size * 0.1, 'feet', 5, {
      signed: true,
    });
    mask(s, [rounded(0, size * 0.04, size * 0.5, size * 0.5, size * 0.06, 0.0045)]);
    return s;
  }
  /** Round electromechanical dial on a surface, live. */
  function dial(S, name, x, y, r, source, calibration, ticks, caption, options) {
    S.ins.dial(name, [x, y, -0.008], r, source, calibration, ticks, caption, options);
  }

  // ---------------------------------------------------------------- controllers and keypads
  /**
   * Glareshield controller housing on a surface. spec: { x, y, w, h, depth, windows: [[cx, w, label]],
   * knobs: [[cx, cy, r]], buttons: [[cx, cy, w, h]], lamps: [[cx, cy, w, h, colour]] } in housing
   * coordinates, +x to the crew's left.
   */
  function controller(S, spec) {
    const { d } = S,
      { x, y, w, h, depth = 0.05 } = spec,
      z = -depth / 2;
    beveledBox(d, [w, h, depth], [x, y, z + 0.005], m.face, 0.006);
    const front = -depth + 0.004;
    for (const [cx, cw, text, cy = 0.012] of spec.windows ?? []) {
      d.box([cw, h * 0.2, 0.002], [x + cx, y + cy, front], m.black);
      label(d, '---', [x + cx, y + cy, front - 0.0015], h * 0.12, m.amber);
      if (text) label(d, text, [x + cx, y + cy + h * 0.2, front], h * 0.075);
    }
    for (const [cx, cy, r] of spec.knobs ?? []) {
      d.add(new T.CylinderGeometry(r, r * 1.05, 0.018, 14).rotateX(PI / 2), m.knob, [
        x + cx,
        y + cy,
        front - 0.008,
      ]);
      d.add(new T.CylinderGeometry(r * 0.62, r * 0.62, 0.008, 12).rotateX(PI / 2), m.knob, [
        x + cx,
        y + cy,
        front - 0.02,
      ]);
      d.box([0.002, r * 0.5, 0.002], [x + cx, y + cy + r * 0.45, front - 0.0245], m.paint);
    }
    for (const [cx, cy, bw, bh, color] of spec.buttons ?? []) {
      d.box([bw, bh, 0.008], [x + cx, y + cy, front - 0.003], m.key);
      d.box(
        [bw * 0.6, bh * 0.18, 0.001],
        [x + cx, y + cy + bh * 0.2, front - 0.0075],
        color ? m[color] : m.green,
      );
    }
    for (const [cx, cy, text, size = h * 0.07] of spec.labels ?? [])
      label(d, text, [x + cx, y + cy, front], size);
  }
  /** Annunciator lens: a warning or caution push-light. */
  function lamp(S, x, y, w, h, color, text) {
    const lens =
      { red: m.lensRed, amber: m.lensAmber, green: m.lensGreen, white: m.lensWhite }[color] ??
      m[color];
    S.d.box([w + 0.008, h + 0.008, 0.016], [x, y, -0.006], m.bezel);
    S.d.box([w, h, 0.004], [x, y, -0.015], lens);
    if (text) label(S.d, text, [x, y, -0.0175], h * 0.3, m.ink);
  }
  /** Flight management keypad: screen, line keys each side, alpha and numeric keys. */
  function cdu(S, name, x, y, w, h, { screenColor = 'green' } = {}) {
    const { d } = S,
      sw = w * 0.62,
      sh = h * 0.36,
      sy = y + h * 0.24;
    beveledBox(d, [w, h, 0.03], [x, y, -0.012], m.face, 0.006);
    d.box([sw, sh, 0.002], [x, sy, -0.028], m.black);
    for (let i = 0; i < 6; i++) {
      const ly = sy + sh * 0.4 - (i * sh * 0.8) / 5;
      label(d, i % 2 ? '----' : '--', [x + sw * 0.25, ly, -0.0295], sh * 0.06, m[screenColor]);
      for (const side of [-1, 1])
        d.box([w * 0.07, sh * 0.07, 0.008], [x + side * (sw / 2 + w * 0.08), ly, -0.03], m.key);
    }
    label(d, name, [x, sy + sh * 0.43, -0.0295], sh * 0.07, m.ink);
    const ky = y - h * 0.05;
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 5; c++)
        d.box(
          [w * 0.1, h * 0.045, 0.008],
          [x - w * 0.06 - c * w * 0.11, ky - r * h * 0.065, -0.03],
          m.key,
        );
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 3; c++)
        d.box(
          [w * 0.085, h * 0.045, 0.008],
          [x + w * 0.38 - c * w * 0.1, ky - r * h * 0.065 - h * 0.06, -0.03],
          m.key,
        );
    for (let c = 0; c < 6; c++)
      d.box([w * 0.12, h * 0.04, 0.008], [x + w * 0.37 - c * w * 0.148, y - h * 0.0, -0.03], m.key);
  }
  /** A field of guarded toggles, rotary selectors and annunciators for overhead and side panels. */
  function switchField(S, x, y, w, h, { rows = 4, cols = 6, seed = 1, title } = {}) {
    const { d } = S;
    d.box([w, h, 0.006], [x, y, -0.003], m.face);
    // Etched sub-panel outline.
    frameBox(d, x, y, w * 0.97, h * 0.95, 0.0011, m.paint, -0.0065);
    if (title) label(d, title, [x, y + h * 0.42, -0.0065], Math.min(0.012, h * 0.08));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const cx = x + w * 0.4 - (c * w * 0.8) / Math.max(1, cols - 1),
          cy = y + h * 0.28 - (r * h * 0.62) / Math.max(1, rows - 1),
          kind = (r * 7 + c * 3 + seed) % 5;
        if (kind === 0) {
          d.add(new T.CylinderGeometry(0.009, 0.01, 0.012, 10).rotateX(PI / 2), m.knob, [
            cx,
            cy,
            -0.012,
          ]);
          d.box([0.002, 0.007, 0.002], [cx, cy + 0.004, -0.019], m.paint);
        } else if (kind === 1 || kind === 4) {
          d.box([0.014, 0.012, 0.004], [cx, cy, -0.008], m.knob);
          d.rod([cx, cy, -0.01], [cx, cy + 0.006, -0.026], 0.0025, m.toggle);
        } else if (kind === 2) {
          d.box([0.02, 0.016, 0.008], [cx, cy, -0.009], m.key);
          d.box(
            [0.016, 0.004, 0.001],
            [cx, cy + 0.003, -0.0135],
            (r + c + seed) % 3 ? m.cyan : m.amber,
          );
        } else {
          d.box([0.02, 0.016, 0.008], [cx, cy, -0.009], m.key);
          d.box([0.016, 0.004, 0.001], [cx, cy - 0.003, -0.0135], m.ink);
        }
        if ((r + c) % 2 === 0) d.box([0.016, 0.0018, 0.0005], [cx, cy - 0.013, -0.0065], m.paint);
      }
  }

  /** Landing gear lever with a wheel-shaped knob, live: down when the gear is down. */
  function gearLever(S, x, y, { knob = 'white' } = {}) {
    S.d.box([0.07, 0.13, 0.008], [x, y, -0.004], m.face);
    S.d.box([0.012, 0.09, 0.004], [x, y, -0.009], m.black);
    label(S.d, 'UP', [x - 0.026, y + 0.04, -0.009], 0.008);
    label(S.d, 'DN', [x - 0.026, y - 0.04, -0.009], 0.008);
    const g = group(S.g, n('gear-lever'), [x, y, -0.01]),
      d = detailKit(g, g.name);
    d.rod([0, 0, 0], [0, 0.045, -0.035], 0.006, m.metal);
    d.add(
      new T.CylinderGeometry(0.018, 0.018, 0.022, 14).rotateZ(PI / 2),
      knob === 'white' ? m.toggle : m.grip,
      [0, 0.05, -0.04],
    );
    d.finish();
    // Rest is up (handle raised); gear down swings it through the slot.
    bind({
      node: g.name,
      source: 'gearPosition',
      property: 'rotation',
      axis: 'x',
      scale: PI * 0.8,
      responseSeconds: 0.5,
    });
  }
  /** Digital clock or chronometer face. */
  function clock(S, x, y, w = 0.06, h = 0.05) {
    S.d.box([w, h, 0.012], [x, y, -0.006], m.bezel);
    S.d.box([w * 0.8, h * 0.4, 0.002], [x, y + h * 0.08, -0.0125], m.black);
    label(S.d, '--:--', [x, y + h * 0.08, -0.0138], h * 0.2, m.green);
    for (const dx of [-1, 1])
      S.d.box([0.008, 0.006, 0.004], [x + dx * w * 0.25, y - h * 0.3, -0.013], m.key);
  }
  /** Rotary selector with a pointer, on a surface. */
  function knob(S, x, y, r = 0.012) {
    S.d.add(new T.CylinderGeometry(r * 1.4, r * 1.4, 0.003, 14).rotateX(PI / 2), m.bezel, [
      x,
      y,
      -0.002,
    ]);
    S.d.add(new T.CylinderGeometry(r, r * 1.05, 0.016, 12).rotateX(PI / 2), m.knob, [x, y, -0.01]);
    S.d.box([0.002, r * 0.6, 0.002], [x, y + r * 0.45, -0.0185], m.paint);
  }
  /** Row of guarded switches: striped guards over toggles. */
  function guarded(S, x, y, count, pitch = 0.03, colour = 'amber') {
    for (let i = 0; i < count; i++) {
      const cx = x + ((count - 1) / 2 - i) * pitch;
      S.d.box([0.012, 0.012, 0.004], [cx, y, -0.004], m.knob);
      S.d.rod([cx, y, -0.006], [cx, y + 0.005, -0.02], 0.0022, m.toggle);
      S.d.box([0.02, 0.032, 0.003], [cx, y + 0.004, -0.024], m[colour]).rotation.x = -0.35;
    }
  }
  /** Cursor control device: palm rest with a trackpad. */
  function palmRest(S, x, y, w = 0.1, l = 0.15) {
    beveledBox(S.d, [w, l, 0.04], [x, y, -0.02], m.face, 0.015);
    S.d.box([w * 0.55, l * 0.3, 0.004], [x, y + l * 0.22, -0.041], m.black);
    for (const dx of [-1, 1])
      S.d.box([w * 0.18, 0.012, 0.004], [x + dx * w * 0.22, y - l * 0.05, -0.041], m.key);
  }
  /** Pull handle, e.g. the parking brake: a T or a striped grip on a short shaft. */
  function handle(S, x, y, { colour = 'red', width = 0.06 } = {}) {
    S.d.rod([x, y, -0.002], [x, y, -0.03], 0.006, m.metal);
    S.d.box([width, 0.016, 0.018], [x, y, -0.036], m[colour]);
  }
  /** Stabilizer trim wheel standing in the pedestal's side, with a white stripe. */
  function trimWheel(x, y, z, r = 0.11) {
    const g = group(cabin, n(`trim-wheel-${x > 0 ? 'L' : 'R'}`), [x, y, z]),
      d = detailKit(g, g.name);
    d.ring(r, 0.012, [0, 0, 0], m.grip, 'x');
    d.add(new T.CylinderGeometry(r * 0.9, r * 0.9, 0.025, 24).rotateZ(PI / 2), m.grip);
    for (let i = 0; i < 2; i++)
      d.box(
        [0.03, 0.012, r * 0.6],
        [Math.sign(x) * 0.003, 0, (i - 0.5) * r * 1.0],
        m.toggle,
      ).rotation.x = i * 0.0;
    d.add(new T.CylinderGeometry(0.012, 0.012, 0.05, 8).rotateZ(PI / 2), m.toggle, [
      Math.sign(x) * 0.03,
      r * 0.7,
      0,
    ]);
    d.finish();
  }
  /** Head-up display: a combiner glass on arms hanging from the roof. at: [x, y, z] of its centre. */
  function hud(at, { w = 0.17, h = 0.13, roof } = {}) {
    const glass = mat(n('hud-combiner'), '#9fc7b3', {
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.1,
    });
    const [x, y, z] = at,
      d = cd;
    const pane = d.box([w, h, 0.004], [x, y, z], glass);
    pane.rotation.x = 0.2;
    const top = roof ?? y + 0.3;
    for (const s of [-1, 1])
      d.rod(
        [x + s * w * 0.48, y + h * 0.45, z + 0.01],
        [x + s * w * 0.3, top, z + 0.12],
        0.008,
        m.grip,
      );
    beveledBox(d, [w * 0.8, 0.07, 0.16], [x, top - 0.02, z + 0.14], m.panel, 0.02);
  }

  // ---------------------------------------------------------------- structure
  /** Body-frame half-breadth available at (z, y), less a margin. */
  const room = (z, y, margin = 0.03) => Math.max(0, ctx.skin(z, y) - margin);
  /**
   * Glareshield: the aft face from the panel top up to topY at z = lipZ, a top that runs forward
   * under the windscreen sill and is clipped to the skin, and the underside over the displays.
   */
  function glareshield({
    lipZ,
    topY,
    faceBottom,
    panelTopZ,
    panelTopY,
    halfWidth,
    slope = 0.12,
    step = 0.04,
  }) {
    const d = cd,
      zs = [];
    for (let z = lipZ; z < lipZ + 1.4; z += step) zs.push(z);
    const tops = zs
      .map((z) => {
        // Falls away forward; where the model's sill is lower than the shield, it shows behind the glass.
        const y = topY - slope * (z - lipZ);
        return [z, y, Math.min(halfWidth, room(z, y, 0.035))];
      })
      .filter(([, , w], i) => i === 0 || w > 0.05);
    for (let i = 0; i < tops.length - 1; i++) {
      const [z0, y0, w0] = tops[i],
        [z1, y1, w1] = tops[i + 1];
      sheet(
        d,
        [
          [w0, y0, z0],
          [-w0, y0, z0],
          [-w1, y1, z1],
          [w1, y1, z1],
        ],
        m.shield,
        [0, z1 - z0, y0 - y1],
      );
    }
    // Rolled leather lip.
    d.rod(
      [tops[0][2], topY - 0.008, lipZ - 0.004],
      [-tops[0][2], topY - 0.008, lipZ - 0.004],
      0.014,
      m.shield,
    );
    const S = surface('glareshield-face', [0, faceBottom, lipZ], [0, 1, 0]),
      h = topY - faceBottom;
    sheet(S.d, rect(0, h / 2, tops[0][2] * 2, h, 0), m.shield, [0, 0, -1]);
    // Underside from the lip back to the panel's top edge.
    sheet(
      d,
      [
        [tops[0][2], faceBottom, lipZ],
        [-tops[0][2], faceBottom, lipZ],
        [-tops[0][2], panelTopY, panelTopZ],
        [tops[0][2], panelTopY, panelTopZ],
      ],
      m.shield,
      [0, -1, 0],
    );
    return { S, height: h, halfWidth: tops[0][2] };
  }
  /** Inner lining of the skin between section angles from(z) and to(z) (0 at the crown), from
   * station fromZ forward to toZ, offset inside the skin. Both sides, or one. */
  function lining({
    fromZ,
    toZ,
    from,
    to,
    material = m.liner,
    step = 0.08,
    n = 10,
    inset = 0.03,
    sides = [-1, 1],
  }) {
    const zs = [];
    for (let z = fromZ; z < toZ - 1e-6; z += step) zs.push(z);
    zs.push(toZ);
    for (const side of sides) {
      const positions = [],
        index = [];
      for (const z of zs) {
        const a0 = from(z),
          a1 = Math.max(a0 + 1e-3, to(z));
        for (let j = 0; j <= n; j++)
          positions.push(...ctx.point(z, a0 + ((a1 - a0) * j) / n, side, -inset));
      }
      for (let i = 0; i < zs.length - 1; i++)
        for (let j = 0; j < n; j++) {
          const a = i * (n + 1) + j,
            b = a + n + 1;
          index.push(a, b, a + 1, a + 1, b, b + 1);
        }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      g.setIndex(index);
      g.computeVertexNormals();
      cd.add(g, material);
    }
  }
  /** Lining heights as section angles: below the side windows and over the roof. */
  const below = (z) => ctx.angle(z, ctx.sill(z)) + 0.04,
    floorAngle = (z) => ctx.angle(z, floor + 0.01),
    aboveWindows = (z) => Math.max(0, ctx.angle(z, ctx.top(z)) - 0.04);
  function walls(fromZ, toZ, options = {}) {
    lining({ fromZ, toZ, from: below, to: floorAngle, ...options });
    lining({
      fromZ,
      toZ,
      from: () => 0,
      to: aboveWindows,
      material: options.roof ?? m.liner,
      ...options.roofOptions,
    });
  }
  /** Height of the inner roof at half-breadth x on station z. */
  function roofAt(z, x, inset = 0.04) {
    let lo = eye[1],
      hi = ctx.crown(z);
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (ctx.skin(z, mid) - inset > x) lo = mid;
      else hi = mid;
    }
    return lo;
  }
  /**
   * Overhead panel: a plane under the roof from forward edge zF to aft edge zA, halfWidth wide,
   * hanging `drop` below the roof at its edges. Returns its surface, local Y running aft.
   */
  function overhead({ zF, zA, halfWidth, drop = 0.03, material = m.panel }) {
    const yF = roofAt(zF, halfWidth) - drop,
      yA = roofAt(zA, halfWidth) - drop,
      L = Math.hypot(zF - zA, yA - yF),
      S = surface('overhead', [0, (yF + yA) / 2, (zF + zA) / 2], [0, yA - yF, zA - zF]);
    sheet(S.d, rect(0, 0, halfWidth * 2, L, 0), material, [0, 0, -1]);
    // Side skirts up to the roof, as a strip of quads: triangulating the whole outline joined
    // runs of nearly collinear roof points into sliver triangles. Then a forward end plate.
    for (const side of [-1, 1]) {
      const edge = [],
        roof = [];
      for (let i = 0; i <= 8; i++) {
        const z = zF + ((zA - zF) * i) / 8;
        edge.push([side * halfWidth, yF + ((yA - yF) * i) / 8, z]);
        roof.push([side * halfWidth, roofAt(z, halfWidth, 0.0) + 0.01, z]);
      }
      for (let i = 0; i < 8; i++)
        sheet(cd, [edge[i], edge[i + 1], roof[i + 1], roof[i]], material, [side, 0, 0]);
    }
    sheet(
      cd,
      [
        [halfWidth, yF, zF],
        [-halfWidth, yF, zF],
        [-halfWidth, roofAt(zF, halfWidth, 0) + 0.01, zF],
        [halfWidth, roofAt(zF, halfWidth, 0) + 0.01, zF],
      ],
      material,
      [0, 0, -1],
    );
    return { S, length: L };
  }
  /** Side console shelf along the wall: top at y from z0 (aft) to z1 (forward), inboard edge x. */
  function sideConsole(side, { z0, z1, y, inboard, material = m.panel }) {
    const zs = [];
    for (let z = z0; z <= z1 + 1e-6; z += 0.05) zs.push(z);
    const out = (z) => Math.max(inboard + 0.02, room(z, y, 0.035));
    sheet(
      cd,
      [
        ...zs.map((z) => [side * inboard, y, z]),
        ...zs
          .slice()
          .reverse()
          .map((z) => [side * out(z), y, z]),
      ],
      material,
      [0, 1, 0],
    );
    sheet(
      cd,
      [
        [side * inboard, y, z0],
        [side * inboard, y, z1],
        [side * inboard, floor, z1],
        [side * inboard, floor, z0],
      ],
      material,
      [-side, 0, 0],
    );
    for (const z of [z0, z1])
      sheet(
        cd,
        [
          [side * inboard, y, z],
          [side * out(z), y, z],
          [side * out(z), floor, z],
          [side * inboard, floor, z],
        ],
        material,
        [0, 0, z === z0 ? -1 : 1],
      );
    return surface(
      `console-${side > 0 ? 'L' : 'R'}`,
      [(side * (inboard + out((z0 + z1) / 2))) / 2, y + 0.001, (z0 + z1) / 2],
      [0, 0, 1],
    );
  }
  /** Nosewheel steering tiller: a small wheel with a knob on the side console. */
  function tiller(S, x, y) {
    const { d } = S;
    d.add(new T.CylinderGeometry(0.02, 0.025, 0.03, 12).rotateX(PI / 2), m.knob, [x, y, -0.015]);
    d.ring(0.06, 0.009, [x, y, -0.035], m.grip);
    d.rod([x + 0.06, y, -0.035], [x - 0.06, y, -0.035], 0.006, m.grip);
    d.add(new T.CylinderGeometry(0.009, 0.009, 0.04, 8).rotateX(PI / 2), m.grip, [
      x + 0.045,
      y + 0.02,
      -0.055,
    ]);
  }
  /** Clip a panel outline's corners inside the nose: |x| no wider than the skin allows there. */
  function fitToSkin(S, contour, margin = 0.035) {
    return contour.map(([x, v]) => {
      const [, y, z] = S.world([x, v, 0.05]),
        r = room(z, y, margin);
      return [Math.sign(x) * Math.min(Math.abs(x), r), v];
    });
  }
  /** Flat floor from the bulkhead forward, clipped to the skin. */
  function floorPlate(fromZ, toZ) {
    const zs = [];
    for (let z = fromZ; z <= toZ + 1e-6; z += 0.1) zs.push(z);
    const y = floor + 0.002;
    sheet(
      cd,
      [
        ...zs.map((z) => [room(z, y + 0.03, 0.02), y, z]),
        ...zs
          .slice()
          .reverse()
          .map((z) => [-room(z, y + 0.03, 0.02), y, z]),
      ],
      m.floor,
      [0, 1, 0],
    );
  }

  // ---------------------------------------------------------------- crew stations
  /** Crew seat: pan, reclined back, headrest, armrests, pedestal on tracks. */
  function seat(x, { z = eye[2], cushion = 0.8, back = 0.3, width = 0.5, color } = {}) {
    const d = cd,
      sy = eye[1] - cushion,
      sz = z - back + 0.28,
      cloth = color ? flat(`seat-${color.slice(1)}`, color, { roughness: 0.95 }) : m.seat;
    beveledBox(d, [width, 0.11, 0.5], [x, sy - 0.055, sz], cloth, 0.035);
    const bz = z - back - 0.05,
      backrest = beveledBox(d, [width * 0.96, 0.74, 0.12], [x, sy + 0.36, bz], cloth, 0.035);
    backrest.rotation.x = -0.14;
    beveledBox(d, [width * 0.6, 0.2, 0.11], [x, sy + 0.82, bz - 0.06], cloth, 0.03);
    for (const side of [-1, 1]) {
      beveledBox(
        d,
        [0.07, 0.06, 0.36],
        [x + side * (width / 2 + 0.03), sy + 0.21, sz - 0.05],
        m.seatTrim,
        0.015,
      );
      d.box([0.035, 0.18, 0.035], [x + side * (width / 2 + 0.03), sy + 0.1, sz - 0.2], m.seatTrim);
      d.box([0.04, 0.03, 0.9], [x + side * 0.16, floor + 0.015, sz], m.metal);
    }
    d.box(
      [width * 0.7, sy - 0.11 - floor, 0.42],
      [x, (sy - 0.11 + floor) / 2, sz - 0.03],
      m.seatTrim,
    );
  }
  /** Rudder pedals: two per station, live, right pedal forward for right yaw. */
  function pedals(x, z, { spread = 0.13, rise = 0.12, tag = '' } = {}) {
    for (const side of [-1, 1]) {
      const g = group(cabin, n(`pedal${tag}-${x > 0 ? 'L' : 'R'}-${side > 0 ? 'left' : 'right'}`), [
          x + side * spread,
          floor + rise,
          z,
        ]),
        d = detailKit(g, g.name);
      const plate = beveledBox(d, [0.13, 0.2, 0.025], [0, 0, 0], m.metal, 0.008);
      plate.rotation.x = 0.45;
      for (let j = 0; j < 4; j++)
        d.box([0.11, 0.006, 0.006], [0, -0.07 + j * 0.045, -0.02 + j * 0.02], m.grip);
      d.rod([0, -0.08, 0.06], [0, -rise, 0.12], 0.015, m.metal);
      d.finish();
      bind({
        node: g.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: side > 0 ? -0.05 : 0.05,
      });
    }
  }
  /**
   * Control column and wheel. style 'boeing' (W wheel, floor column), 'ram' (ram's-horn wheel),
   * 'panel' (column from under the panel). wheel: [y, z] of the hub; pivot: [y, z] of the column foot.
   */
  function yoke(
    x,
    { wheel, pivot, style = 'ram', width = 0.36, tag = '', color, gripColor, hubColor },
  ) {
    const body = color ? flat(`yoke-${color.slice(1)}`, color) : m.grip,
      grips = gripColor ? flat(`grip-${gripColor.slice(1)}`, gripColor) : m.grip;
    const side = x > 0 ? 'L' : 'R',
      col = group(cabin, n(`yoke-column${tag}-${side}`), [x, pivot[0], pivot[1]]),
      cdk = detailKit(col, col.name),
      hub = [0, wheel[0] - pivot[0], wheel[1] - pivot[1]];
    if (style === 'panel') {
      cdk.box([0.06, 0.06, Math.abs(hub[2]) + 0.05], [0, hub[1], hub[2] / 2 + 0.02], body);
    } else {
      // Column rising from the floor, bent aft at the top to the hub.
      const knee = [0, hub[1] * 0.82, hub[2] + 0.1];
      cdk.rod([0, 0, 0], knee, 0.032, body);
      cdk.rod(knee, [0, hub[1], hub[2] + 0.035], 0.026, body);
      cdk.box([0.16, 0.06, 0.2], [0, 0.03, 0], m.seatTrim);
    }
    cdk.finish();
    const w = group(col, n(`yoke${tag}-${side}`), hub),
      wd = detailKit(w, w.name),
      half = width / 2;
    if (style === 'boeing') {
      // W wheel: a bar with rounded horns rising at each end, centre plate.
      const path = [
        [half * 0.95, 0.13],
        [half, 0.06],
        [half * 0.92, -0.02],
        [half * 0.55, -0.045],
        [0.06, -0.035],
        [-0.06, -0.035],
        [-half * 0.55, -0.045],
        [-half * 0.92, -0.02],
        [-half, 0.06],
        [-half * 0.95, 0.13],
      ];
      for (let i = 0; i < path.length - 1; i++)
        wd.rod(
          [...path[i], -0.02],
          [...path[i + 1], -0.02],
          0.017,
          i < 2 || i > path.length - 4 ? grips : body,
        );
      beveledBox(
        wd,
        [0.15, 0.1, 0.03],
        [0, -0.005, -0.012],
        hubColor ? flat(`hub-${hubColor.slice(1)}`, hubColor) : m.panel,
        0.01,
      );
      wd.box([0.1, 0.05, 0.004], [0, 0.005, -0.03], m.bezel);
    } else {
      // Ram's horn: grips rise from a centre bar, flaring outward.
      const path = [
        [half * 0.86, 0.12],
        [half, 0.03],
        [half * 0.82, -0.05],
        [half * 0.3, -0.06],
        [-half * 0.3, -0.06],
        [-half * 0.82, -0.05],
        [-half, 0.03],
        [-half * 0.86, 0.12],
      ];
      for (let i = 0; i < path.length - 1; i++)
        wd.rod(
          [...path[i], -0.02],
          [...path[i + 1], -0.02],
          i < 2 || i > path.length - 4 ? 0.02 : 0.016,
          i < 2 || i > path.length - 4 ? grips : body,
        );
      beveledBox(
        wd,
        [0.12, 0.08, 0.035],
        [0, -0.03, -0.01],
        hubColor ? flat(`hub-${hubColor.slice(1)}`, hubColor) : body,
        0.012,
      );
    }
    for (const s of [-1, 1]) wd.box([0.025, 0.016, 0.02], [s * half * 0.88, 0.12, -0.03], m.key);
    wd.finish();
    bind({ node: col.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.11 });
    bind({ node: w.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.75 });
  }
  /** Side-stick on the outboard console with its armrest behind. base: [y, z] of the gaiter. */
  function sideStick(x, { base, tag = '' }) {
    const side = x > 0 ? 'L' : 'R',
      g = group(cabin, n(`side-stick${tag}-${side}`), [x, base[0], base[1]]),
      d = detailKit(g, g.name);
    d.add(new T.CylinderGeometry(0.03, 0.045, 0.04, 12), m.grip, [0, 0.02, 0]);
    const grip = beveledBox(d, [0.045, 0.13, 0.055], [0, 0.11, 0.005], m.grip, 0.015);
    grip.rotation.x = 0.12;
    d.box([0.03, 0.012, 0.03], [0, 0.18, 0.008], m.key);
    d.box([0.01, 0.018, 0.01], [-Math.sign(x) * 0.024, 0.15, 0], m.red);
    d.finish();
    cd.add(new T.CylinderGeometry(0.06, 0.06, 0.01, 16), m.grip, [x, base[0] + 0.004, base[1]]);
    bind({ node: g.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.28 });
    bind({ node: g.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.32 });
  }
  /** Power or thrust levers, live, on a pedestal surface. Pivot below the slot; forward is +Y. */
  function levers(
    S,
    {
      xs,
      y = 0,
      length = 0.17,
      knob = [0.05, 0.035, 0.03],
      source = 'power',
      name = 'thrust-lever',
      travel = 0.9,
      rest = -0.45,
      color = 'grip',
      slot = 0.16,
    },
  ) {
    const finish = color.startsWith('#') ? flat(`lever-${color.slice(1)}`, color) : m[color];
    xs.forEach((lx, i) => {
      if (slot) S.d.box([0.012, slot, 0.004], [lx, y, -0.002], m.black);
      const g = group(S.g, n(`${name}-${i + 1}`), [lx, y - 0.02, 0.06]),
        d = detailKit(g, g.name);
      d.rod([0, 0, 0], [0, 0, -length], 0.008, m.metal);
      beveledBox(d, knob, [0, 0, -length - knob[2] / 2 + 0.01], finish, 0.008);
      d.finish();
      // Lever stands out of the surface along -Z; rotating about X swings its knob along Y.
      g.rotation.x = rest;
      if (source)
        bind({
          node: g.name,
          source,
          property: 'rotation',
          axis: 'x',
          scale: travel,
          ...(source === 'flapPosition' ? { responseSeconds: 0.4 } : {}),
        });
    });
  }
  /** A box console with a sloped top, profile given in the body frame as [z, y] from fore to aft. */
  function prism(profile, x, halfWidth, material = m.panel, d = cd, skip = []) {
    for (const side of [-1, 1])
      sheet(
        d,
        [
          ...profile.map(([z, y]) => [x + side * halfWidth, y, z]),
          [x + side * halfWidth, floor, profile.at(-1)[0]],
          [x + side * halfWidth, floor, profile[0][0]],
        ],
        material,
        [side, 0, 0],
      );
    for (let i = 0; i < profile.length - 1; i++) {
      if (skip.includes(i)) continue;
      const [z0, y0] = profile[i],
        [z1, y1] = profile[i + 1];
      sheet(
        d,
        [
          [x + halfWidth, y0, z0],
          [x - halfWidth, y0, z0],
          [x - halfWidth, y1, z1],
          [x + halfWidth, y1, z1],
        ],
        material,
        [0, z0 - z1, y1 - y0],
      );
    }
    const [zl, yl] = profile.at(-1);
    sheet(
      d,
      [
        [x + halfWidth, yl, zl],
        [x - halfWidth, yl, zl],
        [x - halfWidth, floor, zl],
        [x + halfWidth, floor, zl],
      ],
      material,
      [0, 0, -1],
    );
  }
  /** Surface frame on segment i of a prism profile, origin at the segment's midpoint. */
  function onSegment(name, profile, i, x = 0) {
    const [z0, y0] = profile[i],
      [z1, y1] = profile[i + 1];
    // Reading up the segment is toward its forward end.
    return surface(name, [x, (y0 + y1) / 2, (z0 + z1) / 2], [0, y0 - y1, z0 - z1]);
  }

  function finish() {
    for (const ins of instruments) {
      bindings.push(...ins.bindings);
      Object.assign(derived, ins.derived);
    }
    for (const d of kits) d.finish();
    return { nodes: ['cockpit'], sources, derived, bindings };
  }
  return {
    cabin,
    m,
    n,
    cd,
    eye,
    floor,
    room,
    bind,
    label,
    surface,
    moving,
    panelSheet,
    screen,
    pfd,
    nd,
    mfd,
    engines,
    systems,
    standby,
    dial,
    gearLamps,
    flapScale,
    controller,
    lamp,
    gearLever,
    clock,
    knob,
    guarded,
    palmRest,
    handle,
    trimWheel,
    hud,
    cdu,
    switchField,
    glareshield,
    lining,
    walls,
    roofAt,
    overhead,
    sideConsole,
    tiller,
    fitToSkin,
    floorPlate,
    seat,
    pedals,
    yoke,
    sideStick,
    levers,
    prism,
    onSegment,
    finish,
  };
}
