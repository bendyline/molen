/** Car cabin parts in distinct real-world families: air vents, steering wheels, pedals and gear
 * selectors. Original polygonal geometry (no photographs); round forms get 12–24 sides, as the
 * medium-fi guide asks of a close view. Parts draw into a detail kit and batch by material.
 * Panel parts sit on the dash face at `at` and protrude toward the driver (-Z); +X is the
 * driver's left. A palette `P` supplies { dark, trim, metal, ink, black?, accent? } materials.
 */
import '../../worldgen/scripts/install-deterministic-math.mjs';
import * as T from 'three';
import {
  bar,
  batch,
  contour,
  disc,
  emit,
  lathe,
  loftUp,
  place,
  roundedBox,
  sphere,
  tube,
} from './aircraft/cockpit-parts.mjs';

const materials = new Map();
const shared = (name, color, metalness = 0.05, roughness = 0.85) => {
  if (!materials.has(name))
    materials.set(
      name,
      new T.MeshStandardMaterial({ name, color, metalness, roughness, flatShading: true }),
    );
  return materials.get(name);
};
/** The dark recess behind vent louvres. */
const throatMaterial = () => shared('cabin-vent-throat', '#0b0d0e', 0, 0.95);

/** A chamfered rectangle `inset` inside a w×h outline, at depth z: eight corners. */
function chamferRing(w, h, corner, [inset, z]) {
  const X = w / 2 - inset,
    Y = h / 2 - inset,
    c = Math.max(0.0004, Math.min(corner - inset * 0.6, X * 0.9, Y * 0.9));
  return [
    [X, Y - c],
    [X - c, Y],
    [-X + c, Y],
    [-X, Y - c],
    [-X, -Y + c],
    [-X + c, -Y],
    [X - c, -Y],
    [X, -Y + c],
  ].map(([x, y]) => [x, y, z]);
}
/** A rectangular ring swept through a profile of [inset, z] points, outer edge first. Faces
 * point out of the solid the profile encloses, so the front faces the driver (-Z). `cap` closes
 * the last ring with a back facing the driver. One swept bezel costs about 80 triangles where
 * four rounded bars cost 500. */
function rectSweep(w, h, profile, corner = 0.006, cap = false) {
  const rings = profile.map((point) => chamferRing(w, h, corner, point));
  const positions = [];
  for (let i = 0; i + 1 < rings.length; i++)
    for (let j = 0; j < 8; j++) {
      const k = (j + 1) % 8;
      const [A, B, C, D] = [rings[i][j], rings[i][k], rings[i + 1][k], rings[i + 1][j]];
      positions.push(...A, ...C, ...B, ...A, ...D, ...C);
    }
  if (cap) {
    const last = rings.at(-1);
    for (let k = 1; k < 7; k++) positions.push(...last[0], ...last[k + 1], ...last[k]);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// ---------------------------------------------------------------------------------------------
// Air vents. Styles:
//   slat         rectangular, thin horizontal vanes, adjuster tab (most modern cars)
//   chrome-slat  the same in a bright bezel with a chrome tab (luxury, retro)
//   slim         a long thin slot of two vanes (EVs, modern premium dashboards)
//   vertical     tall with vertical vanes (pickups, vans, some Volvos)
//   grid         horizontal vanes in front of vertical ones (VW group, Subaru)
//   round        round with horizontal vanes and a center knob (Mini, Fiat, Miata)
//   turbine      round with radial fins round a hub (Audi TT, sports cars)
//   eyeball      round swiveling ball with a slot (city cars, retro, utility)

export const VENT_STYLES = [
  'slat',
  'chrome-slat',
  'slim',
  'vertical',
  'grid',
  'round',
  'turbine',
  'eyeball',
];
export function carVent(d, P, at, { style = 'slat', width = 0.12, height, aim = 0 } = {}) {
  const b = batch();
  const throat = throatMaterial();
  const chrome = style === 'chrome-slat' || style === 'turbine';
  const bezel = chrome ? P.metal : P.dark,
    vane = P.vane ?? P.dark;
  if (style === 'round' || style === 'turbine' || style === 'eyeball') {
    const R = width / 2;
    b.add(
      bezel,
      lathe(
        [
          [R * 0.8, 0.0],
          [R, 0.002],
          [R * 1.01, 0.008],
          [R * 0.92, 0.0115],
          [R * 0.84, 0.0105],
        ],
        18,
      ).rotateX(-Math.PI / 2),
    );
    b.add(throat, disc(R * 0.84, 0.004, [0, 0, 0.006], [Math.PI / 2, 0, 0], 18));
    if (style === 'round') {
      for (const k of [-0.5, -0.17, 0.17, 0.5]) {
        const y = k * R * 1.1,
          chord = 2 * Math.sqrt(Math.max(0, (R * 0.82) ** 2 - y * y));
        b.add(
          vane,
          place(new T.BoxGeometry(chord, 0.0022, 0.012), [0, y, 0.001], [-0.3 + aim, 0, 0]),
        );
      }
      b.add(P.metal, disc(R * 0.16, 0.012, [0, 0, -0.004], [Math.PI / 2, 0, 0], 12));
    } else if (style === 'turbine') {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const fin = place(
          new T.BoxGeometry(R * 0.6, 0.0022, 0.011),
          [R * 0.52, 0, 0],
          [0.55, 0, 0],
        );
        fin.rotateZ(a);
        b.add(vane, fin);
      }
      b.add(
        P.metal,
        lathe(
          [
            [0, 0],
            [R * 0.22, 0],
            [R * 0.24, 0.006],
            [R * 0.2, 0.014],
            [0, 0.016],
          ],
          14,
        ).rotateX(-Math.PI / 2),
      );
      b.add(P.metal, place(new T.TorusGeometry(R * 0.62, 0.0013, 4, 24), [0, 0, -0.004]));
    } else {
      const ball = batch();
      ball.add(vane, sphere(R * 0.8, [0, 0, 0], [1, 1, 0.5], 16, 10));
      ball.add(throat, disc(R * 0.5, 0.012, [0, 0, -R * 0.36], [Math.PI / 2, 0, 0], 14));
      for (const x of [-0.25, 0.25])
        ball.add(vane, place(new T.BoxGeometry(0.0022, R * 0.95, 0.01), [x * R, 0, -R * 0.4]));
      ball.add(P.metal, place(new T.BoxGeometry(R * 0.3, R * 0.14, 0.008), [0, 0, -R * 0.44]));
      emit(d, ball.map, [at[0], at[1], at[2] + R * 0.25], [aim * 0.5 - 0.08, 0.12, 0]);
    }
    emit(d, b.map, at);
    return;
  }
  const h =
    height ??
    { slat: 0.055, 'chrome-slat': 0.058, slim: 0.026, vertical: width * 1.4, grid: width * 0.72 }[
      style
    ] ??
    0.055;
  const w = width,
    t = style === 'slim' ? 0.004 : 0.0055;
  // A thin chamfered bezel round a recessed dark throat.
  const corner = Math.min(0.006, h / 3);
  b.add(
    bezel,
    rectSweep(
      w,
      h,
      [
        [0, 0.0055],
        [0, -0.0025],
        [0.0015, -0.0055],
        [t - 0.0012, -0.0055],
        [t, -0.0035],
        [t, 0.0055],
      ],
      corner,
    ),
  );
  b.add(
    throat,
    rectSweep(
      w,
      h,
      [
        [t, 0.0055],
        [t, 0.0145],
      ],
      corner,
      true,
    ),
  );
  const innerW = w - 2 * t - 0.002,
    innerH = h - 2 * t - 0.002;
  const horizontal = (count, z = 0.0005) => {
    for (let i = 0; i < count; i++) {
      const y = -innerH / 2 + ((i + 0.5) * innerH) / count;
      b.add(vane, place(new T.BoxGeometry(innerW, 0.0017, 0.011), [0, y, z], [-0.28 + aim, 0, 0]));
    }
  };
  const vertical = (count, z = 0.0005) => {
    for (let i = 0; i < count; i++) {
      const x = -innerW / 2 + ((i + 0.5) * innerW) / count;
      b.add(vane, place(new T.BoxGeometry(0.0017, innerH, 0.011), [x, 0, z], [0, 0.22, 0]));
    }
  };
  if (style === 'vertical') vertical(Math.max(3, Math.round(innerW / 0.014)));
  else if (style === 'grid') {
    horizontal(Math.max(2, Math.round(innerH / 0.011)));
    vertical(Math.max(3, Math.round(innerW / 0.016)), 0.007);
  } else horizontal(Math.max(2, Math.round(innerH / (style === 'slim' ? 0.008 : 0.0105))));
  // The adjuster tab rides the middle vane; a slim slot has a small thumb roller at one end.
  if (style === 'slim')
    b.add(
      P.metal,
      place(
        new T.CylinderGeometry(0.005, 0.005, 0.004, 10),
        [w / 2 - t - 0.012, 0, -0.002],
        [0, 0, Math.PI / 2],
      ),
    );
  else
    b.add(
      chrome || style === 'slat' ? P.metal : (P.black ?? P.dark),
      place(
        new T.BoxGeometry(
          style === 'vertical' ? 0.008 : 0.014,
          style === 'vertical' ? 0.014 : 0.008,
          0.012,
        ),
        [0, 0, -0.005],
      ),
    );
  emit(d, b.map, at);
}

// ---------------------------------------------------------------------------------------------
// Steering wheels, drawn into the wheel's own kit (rim in its XY plane, facing the driver at -Z).
// Styles: modern (three spokes, switch pads), two-spoke, sport (flat-bottomed, thick rim, paddles),
// four-spoke, retro (thin rim, round metal spokes), bus (large and thin).

export const WHEEL_STYLES = ['modern', 'two-spoke', 'sport', 'four-spoke', 'retro', 'bus'];
export function steeringWheelGeometry(kit, P, { style = 'modern', radius = 0.16, accent } = {}) {
  const b = batch();
  const rim = { sport: 0.0165, retro: 0.0095, bus: 0.0125, 'four-spoke': 0.012 }[style] ?? 0.0145;
  if (style === 'sport') {
    const points = [];
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      points.push([Math.cos(a) * radius, Math.max(Math.sin(a) * radius, -radius * 0.82), 0]);
    }
    b.add(P.rim ?? P.dark, tube(points, rim, 8, true));
    b.add(
      accent ?? P.metal,
      place(roundedBox([0.012, rim * 2.1, rim * 2.1], 0.002), [0, radius, 0]),
    );
  } else b.add(P.rim ?? P.dark, new T.TorusGeometry(radius, rim, 8, 40));
  const spoke = (from, to, height, depth = 0.016, material = P.dark) => {
    const dx = to[0] - from[0],
      dy = to[1] - from[1],
      length = Math.hypot(dx, dy);
    b.add(
      material,
      place(
        roundedBox([length, height, depth], Math.min(0.006, height / 3), 1, 1),
        [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, 0.002],
        [0, 0, Math.atan2(dy, dx)],
      ),
    );
  };
  const pad = (x, y, buttons = 4) => {
    b.add(P.black ?? P.dark, place(roundedBox([0.042, 0.03, 0.006], 0.004, 1, 1), [x, y, -0.01]));
    for (let i = 0; i < buttons; i++)
      b.add(
        P.ink,
        disc(
          0.0042,
          0.003,
          [x + (i % 2 ? 0.01 : -0.01), y + (i < 2 ? 0.007 : -0.007), -0.0135],
          [Math.PI / 2, 0, 0],
          6,
        ),
      );
  };
  if (style === 'retro' || style === 'bus') {
    b.add(
      P.metal,
      lathe(
        [
          [0, 0.02],
          [0.034, 0.02],
          [0.028, 0.0],
          [0.024, -0.016],
          [0, -0.022],
        ],
        16,
      ).rotateX(-Math.PI / 2),
    );
    b.add(P.black ?? P.dark, disc(0.02, 0.006, [0, 0, -0.024], [Math.PI / 2, 0, 0], 20));
    const angles = style === 'bus' ? [-0.25, Math.PI + 0.25] : [0, Math.PI, -Math.PI / 2];
    for (const a of angles)
      b.add(
        P.metal,
        bar(
          [Math.cos(a) * 0.028, Math.sin(a) * 0.028, 0],
          [Math.cos(a) * (radius - rim), Math.sin(a) * (radius - rim), 0.004],
          style === 'bus' ? 0.006 : 0.0045,
          10,
        ),
      );
  } else {
    b.add(
      P.dark,
      place(
        roundedBox([style === 'two-spoke' ? 0.125 : 0.112, 0.086, 0.046], 0.018),
        [0, -0.004, -0.004],
      ),
    );
    b.add(P.metal, disc(0.011, 0.004, [0, 0.004, -0.028], [Math.PI / 2, 0, 0], 18));
    if (style === 'four-spoke') {
      for (const a of [0.42, Math.PI - 0.42, -0.62, Math.PI + 0.62])
        spoke(
          [Math.cos(a) * 0.04, Math.sin(a) * 0.035],
          [Math.cos(a) * (radius - 0.004), Math.sin(a) * (radius - 0.004)],
          0.022,
          0.012,
        );
    } else {
      const droop = style === 'two-spoke' ? -0.03 : -0.016;
      for (const s of [-1, 1]) {
        spoke(
          [s * 0.05, -0.008],
          [s * (radius - 0.004), droop],
          style === 'two-spoke' ? 0.05 : style === 'sport' ? 0.04 : 0.034,
        );
        pad(s * 0.088, -0.006 + droop * 0.4, style === 'two-spoke' ? 6 : 4);
      }
      if (style !== 'two-spoke') {
        // One broad lower spoke; a sports wheel's carries a bright trim strip.
        const bottom = -(style === 'sport' ? radius * 0.82 : radius) + 0.006;
        spoke([0, -0.045], [0, bottom], 0.036, 0.014);
        if (style === 'sport')
          b.add(
            accent ?? P.metal,
            place(roundedBox([0.012, -bottom - 0.06, 0.004], 0.0015, 1, 1), [
              0,
              (bottom - 0.045) / 2,
              -0.008,
            ]),
          );
      }
      if (style === 'sport')
        // Shift paddles behind the spokes.
        for (const s of [-1, 1])
          b.add(
            P.black ?? P.dark,
            place(
              roundedBox([0.03, 0.055, 0.004], 0.006, 1, 1),
              [s * (radius * 0.66), 0.03, 0.03],
              [0, 0, s * -0.25],
            ),
          );
    }
  }
  emit(kit, b.map);
}

// ---------------------------------------------------------------------------------------------
// Pedals and gear selectors.

/** One pedal: 'brake' or 'accelerator' hung from the pedal box, or a floor-hinged 'organ'
 * accelerator. `at` is the middle of the pad; the arm rises toward `pivot`. */
export function carPedal(d, P, at, { kind = 'brake', pivot, organ = false } = {}) {
  const b = batch();
  const tread = P.tread ?? P.dark;
  if (kind === 'accelerator' && organ) {
    b.add(tread, place(roundedBox([0.05, 0.16, 0.012], 0.008, 1, 1), [0, 0, 0], [-1.05, 0, 0]));
    b.add(
      P.metal,
      place(new T.CylinderGeometry(0.006, 0.006, 0.05, 8), [0, -0.035, 0.065], [0, 0, Math.PI / 2]),
    );
    emit(d, b.map, at);
    return;
  }
  const [w, h] = kind === 'brake' ? [0.075, 0.055] : [0.048, 0.1];
  b.add(tread, place(roundedBox([w, h, 0.012], 0.01, 1, 1), [0, 0, 0], [0.35, 0, 0]));
  for (let i = -1; i <= 1; i++)
    b.add(
      tread,
      place(new T.BoxGeometry(w * 0.8, 0.003, 0.004), [0, i * h * 0.25, -0.006], [0.35, 0, 0]),
    );
  const top = pivot ? pivot.map((v, i) => v - at[i]) : [0, 0.2, 0.18];
  b.add(
    P.black ?? P.dark,
    tube([[0, h * 0.3, 0.01], [0, top[1] * 0.5, top[2] * 0.35], top], 0.0065, 8),
  );
  emit(d, b.map, at);
}
/** A gear selector on its gate. Styles: sculpted (automatic knob with a release button), tee
 * (truck/van T-handle), ball (manual knob with its shift pattern), joystick (short e-shifter). */
export function shifterGeometry(d, P, at, { style = 'sculpted', boot = true } = {}) {
  const b = batch();
  const [x, y, z] = at;
  b.add(P.trim ?? P.dark, place(roundedBox([0.075, 0.008, 0.13], 0.004, 1, 1), [0, -0.004, 0]));
  for (let i = 0; i < 4; i++)
    b.add(P.ink, place(new T.BoxGeometry(0.006, 0.0015, 0.004), [0.025, 0.001, -0.03 + i * 0.016]));
  if (boot)
    b.add(
      P.dark,
      lathe(
        [
          [0.036, 0],
          [0.033, 0.01],
          [0.026, 0.012],
          [0.024, 0.022],
          [0.017, 0.025],
          [0.015, 0.034],
          [0.011, 0.038],
          [0.0095, 0.045],
          [0, 0.045],
        ],
        10,
        30,
      ),
    );
  const knob = batch();
  if (style === 'joystick') {
    knob.add(
      P.dark,
      lathe(
        [
          [0, 0],
          [0.012, 0],
          [0.015, 0.02],
          [0.017, 0.035],
          [0.012, 0.045],
          [0, 0.047],
        ],
        18,
      ),
    );
    knob.add(P.metal, disc(0.009, 0.004, [0, 0.046, 0], [0, 0, 0], 16));
  } else {
    b.add(P.metal, bar([0, 0.03, 0], [0, 0.075, -0.008], 0.0055, 12));
    if (style === 'ball') {
      knob.add(P.dark, sphere(0.022, [0, 0.018, 0], [1, 0.95, 1], 12, 8));
      knob.add(P.metal, disc(0.0135, 0.004, [0, 0.038, 0], [0, 0, 0], 14));
      knob.add(P.ink, place(new T.BoxGeometry(0.016, 0.0012, 0.0012), [0, 0.0405, 0]));
      for (const xx of [-0.006, 0, 0.006])
        knob.add(P.ink, place(new T.BoxGeometry(0.0012, 0.0012, 0.012), [xx, 0.0405, 0]));
    } else if (style === 'tee') {
      knob.add(P.dark, place(roundedBox([0.06, 0.024, 0.03], 0.01), [0, 0.016, 0]));
      knob.add(P.metal, place(roundedBox([0.014, 0.008, 0.01], 0.002), [-0.02, 0.03, -0.006]));
    } else {
      knob.add(
        P.dark,
        loftUp([
          { y: 0, points: contour(0, 0, 0.014, 0.017, 16, 2.2) },
          { y: 0.022, points: contour(0, 0.003, 0.02, 0.026, 16, 2.2) },
          { y: 0.045, points: contour(0, 0.004, 0.022, 0.03, 16, 2.4) },
          { y: 0.056, points: contour(0, 0.002, 0.016, 0.022, 16, 2.4) },
          { y: 0.06, points: contour(0, 0.002, 0.008, 0.01, 16, 2.2) },
        ]),
      );
      knob.add(P.metal, place(roundedBox([0.012, 0.016, 0.008], 0.002), [0.019, 0.034, 0.004]));
    }
    emit(d, knob.map, [x, y + 0.074, z - 0.008]);
  }
  if (style === 'joystick') emit(d, knob.map, [x, y + 0.03, z]);
  emit(d, b.map, at);
}
