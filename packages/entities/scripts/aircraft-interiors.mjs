/** Model-owned, original cockpit geometry. Photo sources and variant caveats live in the ledger. */
import * as T from 'three';
import { detailKit } from './vehicle-detail.mjs';
import { panelTools } from './vehicle-interiors.mjs';

const pi = Math.PI;
const mat = (name, color, roughness = 0.75) =>
  new T.MeshStandardMaterial({ name, color, roughness, metalness: 0.05, flatShading: true });
function group(parent, name, at = [0, 0, 0]) {
  const g = new T.Group();
  g.name = name;
  g.position.fromArray(at);
  parent.add(g);
  return g;
}

export function addAircraftCockpit(root, s, f) {
  const cabin = group(root, 'cockpit');
  const d = detailKit(cabin, 'cockpit-fixed');
  const panel = mat(
    'instrument-panel',
    s.trim ??
      (s.layout === 'boeing-six'
        ? '#776754'
        : s.layout === 'mig29'
          ? '#447f73'
          : s.category === 'ga'
            ? '#66665e'
            : '#4d595e'),
  );
  const padded = mat('coaming-padding', '#2e3437'),
    seat = mat('seat-fabric', f.fighter ? '#727663' : f.heli ? '#616c68' : '#9d9787'),
    belt = mat('seat-harness', '#b7b29c');
  const tools = panelTools(d),
    bindings = [];
  const width = f.cabinWidth,
    eye = f.eye,
    py = eye[1] - 0.48,
    pz = f.panelZ;
  const text = (label, x, y, z, h = 0.026) => d.text(label, [x, y, z], h, pi, d.ivory);
  // Floor, inner sidewalls and footwell stop the outside skin appearing through controls.
  d.box(
    [width + 0.12, 0.055, f.fighter ? (s.tandem ? 3.4 : 2.1) : 2.8],
    [0, f.floor, eye[2] - 0.3],
    panel,
  );
  for (const side of [-1, 1]) {
    d.box([0.04, 0.65, 2.55], [side * (width / 2 + 0.03), f.floor + 0.34, eye[2] - 0.22], panel);
    d.rod(
      [side * (width / 2 - 0.04), eye[1] - 0.52, eye[2] + 0.1],
      [side * (width / 2 - 0.04), eye[1] - 0.52, eye[2] - 0.5],
      0.027,
      padded,
    );
  }
  const gauge = (x, y, z, r, name, source, scale = 1, offset = 0) => {
    tools.gauge(x, y, z, r, undefined, false);
    const needle = group(cabin, `needle-${name}`, [x, y, z - 0.014]);
    const k = detailKit(needle, `${name}-pointer`);
    k.rod([0, 0, 0], [0, r * 0.78, 0], r * 0.025, k.ivory);
    k.add(new T.CircleGeometry(r * 0.09, 12).rotateY(pi), k.metal, [0, 0, -0.003]);
    k.finish();
    bindings.push({ node: needle.name, source, property: 'rotation', axis: 'z', scale, offset });
    text(name.replaceAll('-', ' ').toUpperCase(), x, y - r * 0.54, z - 0.016, r * 0.17);
  };
  const screen = (x, y, z, w, h, kind, index) => {
    tools.display(x, y, z, w, h, kind);
    text(
      kind === 'attitude' ? 'PFD' : kind === 'map' ? 'NAV' : 'SYS',
      x,
      y - h * 0.43,
      z - 0.012,
      0.022,
    );
    // A small actual attitude cue above the static diagrammatic symbology.
    if (kind === 'attitude') {
      const horizon = group(cabin, `horizon-${index}`, [x, y, z - 0.014]);
      const k = detailKit(horizon, 'horizon-line');
      k.box([w * 0.4, 0.003, 0.002], [0, 0, 0], k.amber);
      k.box([0.004, h * 0.16, 0.002], [0, 0, 0], k.amber);
      k.finish();
      bindings.push({
        node: horizon.name,
        source: 'roll',
        property: 'rotation',
        axis: 'z',
        scale: 1,
      });
      bindings.push({
        node: horizon.name,
        source: 'pitch',
        property: 'position',
        axis: 'y',
        scale: -0.09,
        min: -h * 0.22,
        max: h * 0.22,
      });
    }
    for (const side of [-1, 1])
      for (let r = 0; r < 4; r++)
        d.box(
          [0.012, 0.009, 0.008],
          [x + side * (w / 2 + 0.012), y + (r - 1.5) * h * 0.2, z],
          d.dark,
        );
  };
  const stations = s.tandem
    ? [
        { z: eye[2], y: eye[1], suffix: '' },
        { z: eye[2] - 1.25, y: eye[1] + 0.12, suffix: '-rear' },
      ]
    : [{ z: eye[2], y: eye[1], suffix: '' }];
  for (const station of stations) {
    const sy = station.y - 0.48,
      sz = station.z + 0.67;
    const panelWidth =
      s.shape === 'robinson' ? 0.55 : s.slug === 'bell-206b' ? width * 0.82 : width;
    // All faces point toward the pilot (-Z); panel thickness is forward of the displays.
    d.box([panelWidth, 0.43, 0.08], [0, sy, sz + 0.055], panel);
    d.box([panelWidth + 0.035, 0.055, 0.24], [0, sy + 0.24, sz + 0.08], padded);
    d.box([panelWidth, 0.045, 0.22], [0, sy - 0.23, sz - 0.02], panel);
    const count = s.screens ?? (f.heli ? 0 : 2);
    if (count === 0) {
      const r = Math.min(0.064, panelWidth * (s.shape === 'robinson' ? 0.065 : 0.047)),
        dx = r * 2.55;
      const xcenter = f.fighter || s.shape === 'robinson' ? 0 : eye[0];
      const names = ['airspeed', 'attitude', 'altitude', 'turn', 'heading', 'climb'];
      const sources = ['airspeed', 'pitch', 'altitude', 'roll', 'heading', 'verticalSpeed'];
      const scales = [0.04, 1, 0.020614, 0.5, -1, 0.18];
      for (let i = 0; i < 6; i++)
        gauge(
          xcenter + ((i % 3) - 1) * dx,
          sy + 0.085 - Math.floor(i / 3) * dx,
          sz,
          r,
          names[i] + station.suffix,
          sources[i],
          scales[i],
          i === 0 ? -2.3 : 0,
        );
      if (!f.fighter && s.shape !== 'robinson') {
        const dual = f.large || s.shape === 'huey';
        for (let i = 0; i < (dual ? 6 : 4); i++)
          gauge(
            -eye[0] + ((i % (dual ? 3 : 2)) - (dual ? 1 : 0.5)) * dx,
            sy + 0.08 - Math.floor(i / (dual ? 3 : 2)) * dx,
            sz,
            r * (dual ? 1 : 0.75),
            `secondary-${i}${station.suffix}`,
            dual ? sources[i] : i % 2 ? 'power' : 'rpm',
            dual ? scales[i] : 3.4,
            dual ? 0 : -1.7,
          );
        for (let r = 0; r < 3; r++) {
          tools.display(0, sy + 0.12 - r * 0.09, sz, 0.15, 0.055, 'bars');
          tools.knob(0.09, sy + 0.12 - r * 0.09, sz);
        }
      }
    } else if (f.fighter) {
      if (s.layout === 'panoramic')
        screen(0, sy + 0.02, sz, width * 0.86, 0.21, 'map', `wide${station.suffix}`);
      else if (s.layout === 'f16') {
        for (const side of [-1, 1])
          screen(
            side * 0.245,
            sy + 0.03,
            sz,
            0.19,
            0.18,
            side > 0 ? 'attitude' : 'map',
            `mfd-${side}${station.suffix}`,
          );
        for (let i = 0; i < 3; i++)
          gauge(
            0,
            sy + 0.05 - i * 0.105,
            sz,
            0.043,
            `center-${i}${station.suffix}`,
            ['airspeed', 'altitude', 'heading'][i],
            [0.04, 0.02, -1][i],
          );
        for (let row = 0; row < 3; row++)
          for (let col = 0; col < 4; col++)
            d.box(
              [0.023, 0.018, 0.008],
              [(col - 1.5) * 0.032, sy + 0.165 - row * 0.025, sz - 0.015],
              d.ivory,
            );
      } else if (s.layout === 'mig29') {
        screen(0.21, sy + 0.035, sz, 0.19, 0.17, 'map', `crt${station.suffix}`);
        for (let row = 0; row < 3; row++)
          for (let col = 0; col < 3; col++)
            gauge(
              -0.26 + col * 0.12,
              sy + 0.1 - row * 0.12,
              sz,
              0.043,
              `round-${row}-${col}${station.suffix}`,
              ['airspeed', 'pitch', 'altitude'][col],
              [0.04, 1, 0.02][col],
            );
      } else if (!(s.layout === 'f14' && station.suffix)) {
        const cols = count >= 4 ? 3 : count,
          w = Math.min(0.21, (width - 0.08) / cols - 0.025),
          h = count >= 4 ? 0.13 : 0.18;
        for (let i = 0; i < count; i++)
          screen(
            ((i % cols) - (cols - 1) / 2) * (w + 0.028),
            sy + 0.07 - Math.floor(i / cols) * 0.17,
            sz,
            w,
            h,
            i === 0 ? 'attitude' : i === 1 ? 'map' : 'bars',
            `${i}${station.suffix}`,
          );
      }
      if (s.layout === 'f14' && station.suffix) {
        // Rear radar-intercept station's dominant round tactical-information display.
        tools.gauge(0, sy - 0.02, sz - 0.025, 0.145, undefined, false);
        text('TACTICAL DISPLAY', 0, sy - 0.2, sz - 0.05, 0.025);
        screen(-0.255, sy + 0.02, sz, 0.12, 0.14, 'bars', 'rio-left');
        screen(0.255, sy + 0.02, sz, 0.12, 0.14, 'bars', 'rio-right');
      }
      if (!['f16', 'mig29', 'panoramic'].includes(s.layout))
        for (let i = 0; i < (count < 4 ? 5 : 2); i++)
          gauge(
            (i - ((count < 4 ? 5 : 2) - 1) / 2) * 0.127,
            sy - 0.16,
            sz,
            0.04,
            `standby-${i}${station.suffix}`,
            ['airspeed', 'altitude', 'verticalSpeed', 'rpm', 'power'][i],
            i === 0 ? 0.04 : i === 1 ? 0.02 : 2.8,
          );
    } else {
      const maxWidth = Math.min(width - 0.08, 2.3),
        w = Math.min(0.34, (maxWidth - (count - 1) * 0.035) / count),
        h = Math.min(0.255, w * 0.85);
      if (count === 8) {
        for (let i = 0; i < 8; i++)
          screen(
            ((i % 4) - 1.5) * 0.4,
            sy + 0.09 - Math.floor(i / 4) * 0.19,
            sz,
            0.35,
            0.16,
            i === 0 || i === 3 ? 'attitude' : i % 2 ? 'map' : 'bars',
            `transport-${i}${station.suffix}`,
          );
      } else if (count === 6) {
        for (const side of [-1, 1])
          for (let i = 0; i < 2; i++)
            screen(
              side * (0.43 + i * 0.36),
              sy + 0.025,
              sz,
              0.32,
              0.245,
              i === 1 ? 'attitude' : 'map',
              `${side}-${i}${station.suffix}`,
            );
        for (let i = 0; i < 2; i++)
          screen(0, sy + 0.09 - i * 0.17, sz, 0.26, 0.145, 'bars', `center-${i}${station.suffix}`);
      } else
        for (let i = 0; i < count; i++)
          screen(
            (i - (count - 1) / 2) * (w + 0.035),
            sy + 0.025,
            sz,
            w,
            h,
            i === 0 || i === count - 1 ? 'attitude' : i % 2 ? 'map' : 'bars',
            `${i}${station.suffix}`,
          );
      if (count === 1)
        for (const side of [-1, 1])
          for (let row = 0; row < 2; row++)
            gauge(
              side * 0.29,
              sy + 0.08 - row * 0.15,
              sz,
              0.055,
              `aux-${side}-${row}`,
              row ? 'altitude' : 'airspeed',
              row ? 0.02 : 0.04,
            );
      // Standby round instruments remain distinct from the main screen layout.
      const spareX = count === 2 ? 0 : width * 0.34;
      for (let i = 0; i < (count <= 3 ? 3 : 2); i++)
        gauge(
          spareX + (count <= 3 ? 0 : (i - 0.5) * 0.09),
          sy - 0.13 - (count <= 3 ? i * 0.065 : 0),
          sz,
          0.027,
          `standby-${i}${station.suffix}`,
          i === 0 ? 'airspeed' : i === 1 ? 'altitude' : 'verticalSpeed',
          i === 0 ? 0.04 : i === 1 ? 0.02 : 0.18,
        );
    }
    // Glareshield mode controller, annunciators and panel-mount screws.
    for (let i = 0; i < (f.fighter ? 7 : 12); i++) {
      const x = (i - ((f.fighter ? 7 : 12) - 1) / 2) * ((panelWidth * 0.8) / (f.fighter ? 7 : 12));
      tools.knob(x, sy + 0.19, sz - 0.03, 0.009);
      d.box([0.017, 0.007, 0.003], [x, sy + 0.165, sz - 0.039], i % 4 === 0 ? d.amber : d.dark);
    }
    text(
      f.fighter ? 'FLIGHT' : f.heli ? 'ROTOR SYSTEMS' : 'FLIGHT GUIDANCE',
      0,
      sy + 0.27,
      sz - 0.05,
      0.024,
    );
    // Lower switch banks and circuit-breaker strips are separate geometry, not photographic decals.
    if (!f.fighter && s.shape !== 'robinson')
      for (let i = 0; i < 12; i++) {
        const x = (i - 5.5) * panelWidth * 0.07;
        d.box([0.018, 0.026, 0.009], [x, sy - 0.192, sz - 0.012], i === 0 ? d.red : d.dark);
        text(
          i % 4 === 0 ? 'LIGHTS' : i % 4 === 1 ? 'PUMP' : i % 4 === 2 ? 'PITOT' : 'CABIN',
          x,
          sy - 0.219,
          sz - 0.015,
          0.008,
        );
      }
    for (const x of [-panelWidth * 0.47, panelWidth * 0.47])
      for (const y of [sy - 0.19, sy + 0.18]) {
        d.add(new T.CircleGeometry(0.006, 8).rotateY(pi), d.metal, [x, y, sz - 0.007]);
        d.box([0.008, 0.001, 0.001], [x, y, sz - 0.008], d.dark);
      }
    if (f.fighter && !s.noHud && !station.suffix) {
      const glass = mat('hud-combiner', '#8bab96', 0.25);
      glass.transparent = true;
      glass.opacity = 0.32;
      glass.depthWrite = false;
      glass.side = T.DoubleSide;
      const combiner = d.box([0.23, 0.16, 0.006], [0, station.y - 0.1, sz + 0.01], glass);
      combiner.rotation.x = -0.22;
      for (const side of [-1, 1])
        d.rod(
          [side * 0.1, sy + 0.2, sz],
          [side * 0.1, station.y - 0.04, sz + 0.025],
          0.009,
          d.dark,
        );
      text('FLIGHT', 0, station.y - 0.1, sz - 0.006, 0.025);
    }
    const seatXs = f.fighter ? [0] : [Math.abs(eye[0]), -Math.abs(eye[0])];
    for (const [seatIndex, x] of seatXs.entries()) {
      const seatZ = station.z - 0.23,
        seatY = station.y - 0.74;
      d.box([0.43, 0.13, 0.49], [x, seatY, seatZ], seat);
      const back = d.box([0.43, 0.57, 0.12], [x, seatY + 0.3, seatZ - 0.25], seat);
      back.rotation.x = 0.08;
      d.box([0.28, 0.18, 0.09], [x, seatY + 0.68, seatZ - 0.25], seat);
      for (const side of [-1, 1]) {
        d.rod(
          [x + side * 0.16, seatY + 0.52, seatZ - 0.17],
          [x + side * 0.07, seatY + 0.07, seatZ + 0.08],
          0.016,
          belt,
        );
        d.rod([x + side * 0.2, seatY + 0.08, seatZ], [x, seatY + 0.08, seatZ + 0.13], 0.016, belt);
        d.rod(
          [x + side * 0.14, f.floor + 0.1, seatZ - 0.25],
          [x + side * 0.14, f.floor + 0.1, seatZ + 0.25],
          0.012,
          d.metal,
        );
      }
      d.box([0.05, 0.035, 0.015], [x, seatY + 0.08, seatZ + 0.15], d.metal);
      if (f.fighter) {
        // Unarmed aircraft retain their seat's safety handle as a visual fitting only.
        const handle = d.ring(0.045, 0.007, [x, seatY + 0.13, seatZ + 0.25], d.amber);
        handle.scale.x = 1.65;
      }
      for (let seam = 0; seam < 4; seam++)
        d.rod(
          [x - 0.17, seatY + 0.13, seatZ - 0.16 + seam * 0.095],
          [x + 0.17, seatY + 0.13, seatZ - 0.16 + seam * 0.095],
          0.002,
          belt,
        );
      const sideStick = s.control?.includes('side'),
        stick = f.fighter || f.heli || s.control === 'stick' || sideStick;
      const controlX = sideStick ? x - (x >= 0 ? 0.25 : -0.25) : x,
        controlZ = station.z + 0.3;
      const control = group(cabin, `control-${seatIndex}${station.suffix}`, [
        controlX,
        station.y - 0.56,
        controlZ,
      ]);
      const c = detailKit(control, 'control-hardware');
      if (stick) {
        c.rod([0, -0.32, 0], [0, 0.03, 0], 0.018, c.metal);
        c.box([0.045, 0.12, 0.045], [0, 0.07, 0], padded);
        c.box([0.014, 0.012, 0.012], [0.017, 0.13, -0.02], c.red);
        if (s.control === 'tbar') c.rod([-0.32, 0.02, 0], [0.32, 0.02, 0], 0.02, padded);
      } else {
        c.rod([0, -0.12, 0.16], [0, 0, 0], 0.025, c.metal);
        c.rod([-0.16, 0.07, 0], [0.16, 0.07, 0], 0.019, padded);
        for (const side of [-1, 1])
          c.rod([side * 0.16, 0.07, 0], [side * 0.16, 0.17, 0], 0.023, padded);
        c.box([0.09, 0.06, 0.045], [0, 0.06, 0], panel);
      }
      c.finish();
      bindings.push({
        node: control.name,
        source: 'pitchInput',
        property: 'rotation',
        axis: 'x',
        scale: -0.22,
      });
      bindings.push({
        node: control.name,
        source: 'rollInput',
        property: 'rotation',
        axis: 'z',
        scale: 0.3,
      });
      for (const side of [-1, 1]) {
        const pedal = group(cabin, `pedal-${seatIndex}-${side}${station.suffix}`, [
          x + side * 0.12,
          f.floor + 0.16,
          station.z + 0.53,
        ]);
        const p = detailKit(pedal, 'pedal');
        p.box([0.14, 0.12, 0.035], [0, 0, 0], p.metal);
        for (let i = 0; i < 4; i++)
          p.box([0.115, 0.005, 0.003], [0, (i - 1.5) * 0.027, -0.02], p.dark);
        p.finish();
        bindings.push({
          node: pedal.name,
          source: 'yawInput',
          property: 'position',
          axis: 'z',
          scale: side * 0.035,
        });
      }
    }
  }
  // Center or side console: power levers, radios, guarded switches, trim and nozzle controls.
  const consoleX = f.fighter ? width * 0.42 : 0,
    consoleWidth = f.fighter ? 0.2 : Math.min(0.32, width * 0.24),
    consoleY = eye[1] - 0.72;
  d.box([consoleWidth, 0.3, 0.75], [consoleX, consoleY - 0.1, eye[2] + 0.18], panel);
  for (let row = 0; row < 5; row++)
    for (let col = 0; col < 3; col++) {
      const x = consoleX + (col - 1) * consoleWidth * 0.24,
        z = eye[2] - 0.08 + row * 0.09;
      d.box([0.025, 0.014, 0.03], [x, consoleY + 0.057, z], d.dark);
      d.rod([x, consoleY + 0.067, z], [x, consoleY + 0.09, z + 0.008], 0.003, d.metal);
    }
  if (f.large) {
    // Paired flight-management keypads in the center pedestal.
    for (const side of [-1, 1]) {
      d.box([0.115, 0.025, 0.14], [side * 0.067, consoleY + 0.065, eye[2] + 0.01], d.dark);
      for (let row = 0; row < 4; row++)
        for (let col = 0; col < 3; col++)
          d.box(
            [0.017, 0.006, 0.015],
            [side * 0.067 + (col - 1) * 0.027, consoleY + 0.081, eye[2] - 0.035 + row * 0.027],
            d.ivory,
          );
    }
  }
  if (f.fighter)
    for (const side of [-1, 1]) {
      d.box([0.14, 0.12, 0.85], [side * width * 0.43, eye[1] - 0.69, eye[2] - 0.03], panel);
      for (let row = 0; row < 7; row++)
        for (let col = 0; col < 2; col++) {
          const x = side * width * 0.43 + (col - 0.5) * 0.045,
            z = eye[2] - 0.35 + row * 0.1;
          d.box([0.023, 0.009, 0.03], [x, eye[1] - 0.624, z], d.dark);
          d.rod([x, eye[1] - 0.62, z], [x, eye[1] - 0.596, z + 0.006], 0.003, d.metal);
        }
    }
  const levers = f.fighter
    ? 1
    : f.heli
      ? 1
      : Math.min(
          4,
          s.shape.includes('twin')
            ? 2
            : s.shape.includes('prop') || s.shape.includes('jet')
              ? s.count
              : 1,
        );
  for (let i = 0; i < levers; i++) {
    const x = consoleX + (i - (levers - 1) / 2) * 0.048,
      power = group(cabin, `power-lever-${i}`, [x, consoleY + 0.06, eye[2] + 0.38]);
    const p = detailKit(power, 'lever');
    p.rod([0, 0, 0], [0, 0.13, 0], 0.008, p.metal);
    p.box([0.034, 0.035, 0.05], [0, 0.14, 0], p.dark);
    p.finish();
    bindings.push({
      node: power.name,
      source: 'power',
      property: 'rotation',
      axis: 'x',
      scale: 0.6,
      offset: -0.3,
    });
  }
  if (f.heli) {
    const collective = group(cabin, 'collective', [eye[0] + 0.24, eye[1] - 0.76, eye[2] - 0.12]);
    const k = detailKit(collective, 'collective-lever');
    k.rod([0, 0, 0], [0, 0.07, 0.35], 0.018, k.dark);
    k.box([0.045, 0.045, 0.1], [0, 0.07, 0.35], padded);
    k.finish();
    bindings.push({
      node: 'collective',
      source: 'power',
      property: 'rotation',
      axis: 'x',
      scale: -0.5,
    });
  }
  if (['tiltrotor', 'vtol'].includes(s.category)) {
    const nozzle = group(cabin, 'vector-control', [consoleX - 0.07, consoleY + 0.06, eye[2] + 0.3]);
    const k = detailKit(nozzle, 'vector-lever');
    k.rod([0, 0, 0], [0, 0.13, 0], 0.007, k.metal);
    k.box([0.03, 0.025, 0.04], [0, 0.14, 0], k.amber);
    k.finish();
    bindings.push({
      node: nozzle.name,
      source: 'thrustVector',
      property: 'rotation',
      axis: 'x',
      scale: 0.8,
      offset: -0.4,
    });
    text(s.category === 'vtol' ? 'NOZZLE' : 'NACELLE', consoleX, py - 0.29, pz - 0.04, 0.025);
  }
  if (f.large || f.heli) {
    const oy = eye[1] + 0.48,
      oz = eye[2] + 0.24,
      ow = Math.min(0.72, width * 0.6);
    d.box([ow, 0.055, 0.58], [0, oy, oz], panel);
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 8; c++) {
        const x = ((c - 3.5) * ow) / 9,
          z = oz + (r - 2) * 0.09;
        d.rod([x, oy - 0.03, z], [x, oy - 0.061, z + 0.008], 0.004, d.metal);
        if ((c + r) % 4 === 0) d.box([0.018, 0.004, 0.013], [x, oy - 0.034, z - 0.02], d.amber);
      }
  }
  d.finish();
  return { nodes: ['cockpit'], bindings };
}
