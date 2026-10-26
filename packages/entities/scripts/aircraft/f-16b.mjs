/** F-16B Block 15, original analog front/rear panels, clean configuration.
 * Main axle datum; +Z forward and +X pilot left. General-arrangement dimensions,
 * separate tandem-canopy photograph, and distinct front/rear panel references.
 */
import { panelTools } from '../vehicle-interiors.mjs';
import { instrumentGeometry } from './instrument-geometry.mjs';
import {
  beveledBox,
  cleanGeometry,
  detailKit,
  group,
  loft,
  mat,
  outline,
  quad,
  sheet,
  T,
  wing,
} from './mesh-kit.mjs';

export const f16Frame = () => ({
  heli: false,
  fighter: true,
  large: false,
  radius: 0.65,
  cy: 1.98,
  ry: 0.62,
  cabinZ: 4.75,
  cabinWidth: 0.84,
  eye: [0, 2.82, 4.75],
  rearEye: [0, 2.94, 3.1],
  panelZ: 5.54,
  floor: 1.43,
});
export function buildF16B(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('F16-light-gray', '#8e979e', { side: T.DoubleSide }),
    upper = mat('F16-upper-gray', '#616e78', { side: T.DoubleSide }),
    radome = mat('F16-radome', '#6b7378'),
    dark = mat('F16-seals', '#22282c'),
    metal = mat('F16-alloy', '#adb4b8', { metalness: 0.7 }),
    nozzle = mat('F16-exhaust', '#716d66', { metalness: 0.7 }),
    glass = mat('F16-canopy', '#b6c0b2', {
      transparent: true,
      opacity: 0.19,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.18,
    }),
    rubber = mat('F16-tire', '#222528');
  const d = detailKit(root, 'F16-airframe'),
    bindings = [],
    flaps = [],
    ailerons = [];
  // Per-station fuselage sections: the intake is a separate hollow duct below it.
  const stations = [
    [8.8, 0.015, 1.59, 1.64],
    [8.25, 0.16, 1.5, 1.82],
    [7.6, 0.32, 1.45, 2.01],
    [7.03, 0.48, 1.45, 2.22],
    [6.45, 0.55, 1.44, 2.35],
    [5.65, 0.59, 1.43, 2.43],
    [4.75, 0.61, 1.43, 2.46],
    [3.5, 0.63, 1.41, 2.46],
    [2.5, 0.66, 1.34, 2.45],
    [1.4, 0.7, 1.04, 2.43],
    [0, 0.76, 0.72, 2.4],
    [-1.6, 0.78, 0.85, 2.42],
    [-2.9, 0.73, 1.05, 2.49],
    [-4.3, 0.63, 1.2, 2.42],
    [-5.25, 0.51, 1.37, 2.3],
  ];
  const rings = stations.map(([z, w, b, t]) => ({
    z,
    points: Array.from({ length: 24 }, (_, j) => {
      const a = (j * Math.PI) / 12;
      return [Math.sin(a) * w, (t + b) / 2 + (Math.cos(a) * (t - b)) / 2];
    }),
  }));
  loft(d, rings, paint, {
    skip: (i, j) => i < 3 || (i >= 4 && i <= 7 && (j < 5 || j >= 19)),
    caps: true,
  });
  // Distinct radome seam and probe, without an opaque cockpit roof beneath the glass.
  loft(d, rings.slice(0, 4), radome);
  d.rod([0, 1.62, 8.8], [0, 1.62, 9.391], 0.012, metal);
  const p = (i, j) => [...rings[i].points[j], rings[i].z];
  for (const i of [3, 9, 11, 12, 13])
    outline(
      d,
      rings[i].points.map((q) => [...q, rings[i].z]),
      0.0035,
      dark,
    );
  for (const i of [5, 6, 7, 8])
    for (const side of [-1, 1]) {
      const edge = side === 1 ? 5 : 19;
      d.rod(p(i, edge), p(i + 1, edge), 0.012, dark);
    }
  // One long two-seat canopy with its central transverse arch; no invented center mullion.
  const canopy = [
    [6.45, 0.15, 2.35, 2.37],
    [6.05, 0.39, 2.4, 2.7],
    [5.55, 0.49, 2.43, 2.96],
    [4.95, 0.52, 2.45, 3.08],
    [4.2, 0.52, 2.45, 3.1],
    [3.55, 0.49, 2.45, 3.06],
    [2.95, 0.43, 2.45, 2.93],
    [2.5, 0.32, 2.45, 2.66],
    [2.3, 0.02, 2.44, 2.46],
  ];
  const cr = canopy.map(([z, w, b, t]) => ({
    z,
    points: Array.from({ length: 17 }, (_, i) => {
      const a = (i * Math.PI) / 16;
      return [Math.cos(a) * w, b + Math.sin(a) * (t - b)];
    }),
  }));
  loft(d, cr, glass, { caps: false, skip: (_i, j) => j === 16 });
  for (const i of [0, 4, 8])
    outline(
      d,
      cr[i].points.map((q) => [...q, cr[i].z]),
      i === 4 ? 0.019 : 0.013,
      dark,
      false,
    );
  for (const side of [0, 16])
    outline(
      d,
      cr.map((r) => [...r.points[side], r.z]),
      0.016,
      paint,
      false,
    );
  // Close the lower canopy shoulder to the open fuselage ring, retaining a hollow cabin.
  for (let i = 0; i < canopy.length - 1; i++)
    for (const sign of [-1, 1]) {
      const a = canopy[i],
        b = canopy[i + 1];
      const shoulder = (z) => {
        const j = stations.findIndex(
          (st, n) => n < stations.length - 1 && z <= st[0] && z >= stations[n + 1][0],
        );
        const n = Math.max(0, j),
          t = (stations[n][0] - z) / (stations[n][0] - stations[n + 1][0]);
        const q = [1, 2, 3].map((k) => stations[n][k] * (1 - t) + stations[n + 1][k] * t);
        return [
          sign * q[0] * Math.sin((5 * Math.PI) / 12),
          (q[1] + q[2]) / 2 + (Math.cos((5 * Math.PI) / 12) * (q[2] - q[1])) / 2,
          z,
        ];
      };
      quad(
        d,
        [sign * a[1], a[2], a[0]],
        [sign * b[1], b[2], b[0]],
        shoulder(b[0]),
        shoulder(a[0]),
        paint,
        [sign, 0, 0],
      );
    }
  // Intake upper lip is flattened, lower lip a deep ellipse; recessed interior blocks sky-through.
  const intakeSection = (z, w, b, t) => ({
    z,
    points: Array.from({ length: 28 }, (_, j) => {
      const a = (j * Math.PI) / 14;
      return [Math.sin(a) * w, (t + b) / 2 + (Math.cos(a) * (t - b)) / 2];
    }),
  });
  const intake = [
    intakeSection(4.8, 0.62, 0.83, 1.58),
    intakeSection(4.68, 0.67, 0.77, 1.63),
    intakeSection(4.1, 0.65, 0.71, 1.62),
    intakeSection(2.8, 0.66, 0.64, 1.68),
    intakeSection(1.2, 0.7, 0.65, 1.75),
    intakeSection(0.2, 0.72, 0.72, 1.82),
  ];
  loft(d, intake, paint, { caps: false });
  const inner = [
    intakeSection(4.8, 0.565, 0.88, 1.54),
    intakeSection(4.1, 0.54, 0.92, 1.57),
    intakeSection(3.1, 0.48, 1.02, 1.7),
  ];
  loft(d, inner, dark, { caps: false });
  sheet(
    d,
    inner.at(-1).points.map((q) => [...q, 3.1]),
    dark,
    [0, 0, 1],
  );
  for (let j = 0; j < 28; j++)
    quad(
      d,
      [...intake[0].points[j], 4.8],
      [...intake[0].points[(j + 1) % 28], 4.8],
      [...inner[0].points[(j + 1) % 28], 4.8],
      [...inner[0].points[j], 4.8],
      metal,
      [0, 0, 1],
    );
  d.box([1.0, 0.055, 0.35], [0, 1.66, 4.72], paint);
  d.box([0.035, 0.1, 0.8], [0, 1.69, 4.35], paint);
  // Blended wing-root extensions and the 40-degree swept, thin wings.
  for (const side of [-1, 1]) {
    const x = (v) => v * side;
    wing(
      d,
      [
        [x(0.52), 1.81, 6.18, 1.9, 0.05],
        [x(0.85), 1.91, 4.25, -1.62, 0.06],
        [x(1.37), 1.94, 2.15, -1.62, 0.055],
      ],
      upper,
    );
    wing(
      d,
      [
        [x(1.37), 1.94, 2.15, -0.86, 0.06],
        [x(3), 1.94, 0.78, -1.01, 0.04],
        [x(4.572), 1.91, -0.54, -1.24, 0.024],
      ],
      upper,
    );
    const fg = group(root, `F16-flaperon-${side}`, [0, 1.94, -0.86]),
      fd = detailKit(fg, fg.name);
    wing(
      fd,
      [
        [x(1.37), 0, 0, -0.76, 0.022],
        [x(3), 0, -0.15, -0.76, 0.02],
        [x(4.572), -0.03, -0.38, -0.76, 0.012],
      ],
      paint,
    );
    fd.finish();
    const signal = `flaperon${side === 1 ? 'Left' : 'Right'}`;
    bindings.push({ node: fg.name, source: signal, property: 'rotation', axis: 'x', scale: 1 });
    // Empty slender wingtip fittings are airframe geometry; no stores or pylons.
    d.box([0.11, 0.11, 1.55], [x(4.64), 1.92, -1.05], paint);
    for (const f of [0, 0.42, 0.8]) {
      const a = [x(1.38), 2.004, 2.14 - (2.14 + 0.84) * f],
        b = [x(4.55), 1.945, -0.54 - 0.7 * f];
      d.rod(a, b, 0.0035, dark);
      for (let n = 0; n < 36; n++) {
        const t = n / 35;
        d.add(
          new T.SphereGeometry(0.0037, 5, 3),
          metal,
          a.map((v, i) => v + (b[i] - v) * t),
        );
      }
    }
    for (const xx of [1.8, 2.8, 3.8]) {
      const le = 2.15 - (xx - 1.37) * 0.842;
      d.rod([x(xx), 1.99, le], [x(xx), 1.99, -0.9], 0.003, dark);
    }
    // All-moving, anhedral Block 15 stabilators. Common pitch plus differential roll.
    const tg = group(root, `F16-stabilator-${side}`, [x(1.04), 1.85, -4.3]),
      td = detailKit(tg, tg.name);
    wing(
      td,
      [
        [0, 0, 1.55, -0.92, 0.055],
        [x(1.75), -0.31, 0.1, -0.93, 0.025],
        [x(1.9), -0.335, -0.12, -0.7, 0.012],
      ],
      upper,
    );
    td.finish();
    bindings.push({
      node: tg.name,
      source: `stabilator${side === 1 ? 'Left' : 'Right'}`,
      property: 'rotation',
      axis: 'x',
      scale: 1,
    });
    // Canted ventral fins, speed-brake petals and static discharge wicks.
    sheet(
      d,
      [
        [x(0.67), 1.02, -1.28],
        [x(0.81), 0.46, -1.55],
        [x(0.92), 0.68, -2.65],
        [x(0.68), 1.18, -2.55],
      ],
      upper,
      [side, 0, 0],
    );
    sheet(
      d,
      [
        [x(0.5), 2.15, -4.33],
        [x(1.08), 1.98, -4.5],
        [x(1.08), 1.85, -5.3],
        [x(0.5), 1.85, -5.3],
      ],
      paint,
      [0, 1, 0],
    );
    d.rod([x(4.62), 1.92, -1.78], [x(4.62), 1.92, -2.03], 0.006, dark);
    for (const xx of [2.1, 2.6]) d.rod([x(xx), 1.58, -5.23], [x(xx), 1.58, -5.43], 0.004, dark);
  }
  // Narrow dorsal fin root, swept leading edge and separate rudder.
  const fin = [
    [0, 2.43, -0.6],
    [0, 2.72, -1.52],
    [0, 3.03, -2.38],
    [0, 5.094, -4.5],
    [0, 5.094, -5.696],
    [0, 4.88, -5.16],
    [0, 2.43, -4.64],
  ];
  for (const side of [-1, 1])
    sheet(
      d,
      fin.map(([x, y, z]) => [x + side * 0.065, y, z]),
      upper,
      [side, 0, 0],
    );
  for (let i = 0; i < fin.length; i++)
    quad(
      d,
      [0.065, fin[i][1], fin[i][2]],
      [0.065, fin[(i + 1) % fin.length][1], fin[(i + 1) % fin.length][2]],
      [-0.065, fin[(i + 1) % fin.length][1], fin[(i + 1) % fin.length][2]],
      [-0.065, fin[i][1], fin[i][2]],
      upper,
      [0, 1, 0],
    );
  const rg = group(root, 'F16-rudder', [0, 2.5, -4.64]),
    rd = detailKit(rg, rg.name);
  for (const side of [-1, 1])
    sheet(
      rd,
      [
        [side * 0.07, 0, 0],
        [side * 0.055, 2.34, -0.52],
        [side * 0.055, 2.34, -1.02],
        [side * 0.07, 0, -0.33],
      ],
      paint,
      [side, 0, 0],
    );
  rd.finish();
  bindings.push({ node: rg.name, source: 'yawInput', property: 'rotation', axis: 'y', scale: 0.4 });
  // Petal nozzle, internal tunnel and recessed turbine disk. No luminous fake flame.
  const nr = [
    [-5.23, 0.51],
    [-5.4, 0.51],
    [-5.61, 0.43],
  ];
  for (let j = 0; j < 20; j++) {
    const a = (j * Math.PI) / 10,
      b = ((j + 1) * Math.PI) / 10,
      p = (r, ang, z) => [Math.sin(ang) * r, 1.86 + Math.cos(ang) * r, z];
    for (let n = 0; n < 2; n++)
      quad(
        d,
        p(nr[n][1], a, nr[n][0]),
        p(nr[n][1], b, nr[n][0]),
        p(nr[n + 1][1], b, nr[n + 1][0]),
        p(nr[n + 1][1], a, nr[n + 1][0]),
        nozzle,
        [Math.sin(a), Math.cos(a), 0],
      );
    d.rod(p(0.512, a, -5.24), p(0.432, a, -5.61), 0.005, dark);
  }
  d.add(
    new T.CylinderGeometry(0.415, 0.36, 0.55, 32, true).rotateX(Math.PI / 2),
    dark,
    [0, 1.86, -5.3],
  );
  d.add(new T.CircleGeometry(0.36, 32).rotateY(Math.PI), dark, [0, 1.86, -5.02]);
  // Three independently pivoted landing-gear assemblies, bracing and wheel hubs.
  for (const [i, x, z, r] of [
    [0, 0, 4.013, 0.2286],
    [1, -1.1811, 0, 0.32385],
    [2, 1.1811, 0, 0.32385],
  ]) {
    const pivot = [i ? x * 0.48 : 0, i ? 1.12 : 1.33, i ? 0.57 : 4.28],
      g = group(root, `F16-gear-${i}`, pivot),
      dd = detailKit(g, g.name),
      at = (a) => a.map((v, k) => v - pivot[k]);
    dd.rod(at(pivot), at([x, r + 0.17, z + 0.08]), 0.045, metal);
    dd.rod(at([x, r + 0.17, z + 0.08]), at([x, r, z]), 0.03, metal);
    dd.rod(at([i ? x * 0.2 : 0.19, 1.14, z + 0.72]), at([x, r + 0.2, z + 0.06]), 0.018, metal);
    dd.add(
      new T.CylinderGeometry(r, r, i ? 0.19 : 0.14, 28).rotateZ(Math.PI / 2),
      rubber,
      at([x, r, z]),
    );
    for (const side of [-1, 1]) {
      dd.add(
        new T.CylinderGeometry(r * 0.52, r * 0.52, 0.017, 20).rotateZ(Math.PI / 2),
        metal,
        at([x + side * (i ? 0.102 : 0.077), r, z]),
      );
      for (let j = 0; j < 8; j++) {
        const a = (j * Math.PI) / 4;
        dd.add(
          new T.SphereGeometry(0.015, 6, 4),
          dark,
          at([
            x + side * (i ? 0.115 : 0.09),
            r + Math.cos(a) * r * 0.34,
            z + Math.sin(a) * r * 0.34,
          ]),
        );
      }
    }
    if (i) dd.box([0.04, 0.43, 0.78], at([x * 0.8, 0.69, 0.05]), paint);
    else dd.box([0.04, 0.42, 0.63], at([0.22, 0.84, 4.17]), paint);
    dd.finish();
    bindings.push({
      node: g.name,
      source: 'gear',
      property: 'rotation',
      axis: i ? 'z' : 'x',
      offset: i ? -Math.sign(x) * 1.2 : 1.45,
      scale: i ? Math.sign(x) * 1.2 : -1.45,
    });
  }
  // Close-view access panels, panel fasteners, rescue markings and embedded port muzzle opening.
  for (const side of [-1, 1]) {
    for (const z of [6.7, 5.8, 4.9, 3.7, 2.7, 0.4, -1.1, -2.6]) {
      const w = z > 2 ? 0.6 : 0.74,
        points = [
          [side * w, 1.83, z - 0.26],
          [side * w, 2.11, z - 0.26],
          [side * w, 2.11, z + 0.26],
          [side * w, 1.83, z + 0.26],
        ];
      outline(d, points, 0.003, dark);
      for (const p of points) d.add(new T.SphereGeometry(0.006, 5, 3), metal, p);
    }
    const yaw = (side * Math.PI) / 2;
    d.text('RESCUE', [side * 0.61, 2.12, 5.08], 0.055, yaw, d.ivory);
    const arrow = [
      [side * 0.615, 2.03, 5.3],
      [side * 0.615, 2.03, 4.91],
      [side * 0.615, 2.07, 4.97],
      [side * 0.615, 2.03, 4.91],
      [side * 0.615, 1.99, 4.97],
    ];
    outline(d, arrow, 0.006, d.ivory, false);
    d.text('DANGER INTAKE', [side * 0.66, 1.28, 4.48], 0.035, yaw, d.ivory);
    // Operator identifiers belong to the selected livery, not the shared airframe.
    d.box([0.12, 0.035, 0.22], [side * 0.68, 1.8, 4.5], side === 1 ? d.red : d.green);
  }
  const muzzle = group(root, 'F16-integral-port-opening', [0.68, 2.04, 3.2]),
    md = detailKit(muzzle, muzzle.name);
  md.add(new T.SphereGeometry(1, 12, 8).scale(0.015, 0.065, 0.23), dark);
  md.finish();
  d.finish();
  const interior = f16Cockpits(root, { paint, upper, dark, metal, glass });
  cleanGeometry(root);
  const derived = {
    ...interior.derived,
    flapDeflection: { op: 'multiply', args: ['flapPosition', -0.35] },
    rollDeflection: { op: 'multiply', args: ['rollInput', 0.3] },
    pitchDeflection: { op: 'multiply', args: ['pitchInput', 0.32] },
    tailRollDeflection: { op: 'multiply', args: ['rollInput', 0.12] },
    flaperonLeft: { op: 'subtract', args: ['flapDeflection', 'rollDeflection'] },
    flaperonRight: { op: 'add', args: ['flapDeflection', 'rollDeflection'] },
    stabilatorLeft: { op: 'subtract', args: ['pitchDeflection', 'tailRollDeflection'] },
    stabilatorRight: { op: 'add', args: ['pitchDeflection', 'tailRollDeflection'] },
  };
  interior.derived = derived;
  return {
    root,
    frame: f16Frame(),
    enginePoints: [{ id: 'engine-1', position: [0, 1.86, -4.6] }],
    visual: { rotors: [], gearNodes: [], flaps, ailerons, animation: { bindings }, interior },
    modelSignals: {
      sources: interior.sources,
      derived,
      bindings: [...interior.bindings, ...bindings],
    },
  };
}

function f16Cockpits(root, m) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'F16-cabin'),
    pt = panelTools(d),
    ins = instrumentGeometry(cabin, 'F16');
  const { bindings, derived, ink, black, amber } = ins,
    panel = mat('F16-panel-gray', '#67716e', { side: T.DoubleSide }),
    seat = mat('F16-seat-cushion', '#515747'),
    belt = mat('F16-harness', '#aaa98f');
  const sources = {
    trueAirspeed: { component: 'aircraftState', path: ['airspeed'] },
    altitude: { component: 'transform', path: ['pos', 1] },
    pitch: { component: 'aircraftState', path: ['pitch'] },
    roll: { component: 'aircraftState', path: ['roll'] },
    yaw: { component: 'aircraftState', path: ['yaw'] },
    verticalSpeed: { component: 'aircraftState', path: ['verticalSpeed'] },
    angleOfAttack: { component: 'aircraftState', path: ['angleOfAttack'] },
    pitchInput: { component: 'aircraftInput', path: ['pitch'] },
    rollInput: { component: 'aircraftInput', path: ['roll'] },
    yawInput: { component: 'aircraftInput', path: ['yaw'] },
    power: { component: 'aircraftInput', path: ['power'] },
    gear: { component: 'aircraftState', path: ['gearPosition'] },
    flapPosition: { component: 'aircraftState', path: ['flapPosition'] },
  };
  Object.assign(derived, {
    knots: { op: 'multiply', args: ['trueAirspeed', 1.9438444924406] },
    feet: { op: 'multiply', args: ['altitude', 3.2808398950131] },
    verticalFpm: { op: 'multiply', args: ['verticalSpeed', 196.85039370079] },
    headingRaw: { op: 'subtract', args: [Math.PI, 'yaw'] },
    trueHeading: { op: 'modulo', args: ['headingRaw', Math.PI * 2] },
    aoaDegrees: { op: 'multiply', args: ['angleOfAttack', 180 / Math.PI] },
    gearDown: { op: 'greater', args: ['gear', 0.999] },
    altitudeHundreds: { op: 'modulo', args: ['feet', 1000] },
  });
  // A/B-front and B-rear arrangements are deliberately different, including the display positions.
  for (const rear of [false, true]) {
    const prefix = rear ? 'rear' : 'front',
      k = rear ? 0.00083 : 0.0008,
      cx = rear ? 634 : 769,
      cy = rear ? 600 : 600,
      y0 = rear ? 2.45 : 2.34,
      z = rear ? 3.78 : 5.54;
    const at = (u, v, dz = 0) => [(cx - u) * k, y0 - (v - cy) * k, z + dz],
      px = (u) => (cx - u) * k,
      py = (v) => y0 - (v - cy) * k;
    const edge = rear
      ? [
          [78, 710],
          [165, 710],
          [185, 550],
          [390, 334],
          [860, 334],
          [1085, 550],
          [1110, 710],
          [1192, 710],
          [1192, 676],
          [1120, 670],
          [1095, 540],
          [865, 326],
          [390, 326],
          [175, 540],
          [148, 670],
          [78, 676],
        ]
      : [
          [187, 795],
          [304, 795],
          [325, 576],
          [462, 408],
          [1050, 408],
          [1194, 576],
          [1220, 795],
          [1320, 795],
          [1320, 820],
          [1155, 820],
          [1125, 780],
          [950, 780],
          [900, 838],
          [625, 838],
          [585, 780],
          [420, 780],
          [402, 846],
          [187, 846],
        ];
    // Main instrument face includes lower pedestal, with true horizon holes.
    const outlinePixels = rear
      ? [
          [185, 550],
          [390, 334],
          [860, 334],
          [1085, 550],
          [1110, 710],
          [1040, 710],
          [1000, 650],
          [755, 650],
          [755, 810],
          [708, 932],
          [560, 932],
          [514, 810],
          [514, 650],
          [320, 650],
          [280, 710],
          [165, 710],
        ]
      : [
          [325, 576],
          [462, 408],
          [1050, 408],
          [1194, 576],
          [1220, 795],
          [1155, 820],
          [1125, 780],
          [950, 780],
          [900, 838],
          [900, 1210],
          [625, 1210],
          [625, 838],
          [585, 780],
          [420, 780],
          [402, 846],
          [304, 846],
        ];
    const ah = rear ? [697, 612, 92] : [837, 756, 92],
      sh = rear ? [904, 486, 62] : [951, 481, 65],
      holes = [ah, sh].map(([u, v, r]) =>
        Array.from({ length: 40 }, (_, i) =>
          at(
            u + (Math.cos((i * Math.PI) / 20) * r) / 2,
            v + (Math.sin((i * Math.PI) / 20) * r) / 2,
          ),
        ),
      );
    sheet(
      d,
      outlinePixels.map((p) => at(...p)),
      panel,
      [0, 0, -1],
      holes,
    );
    outline(
      d,
      edge.map((p) => at(...p, -0.008)),
      0.008,
      m.dark,
      false,
    );
    for (const [u, v, r] of [ah, sh])
      ins.horizon(`${prefix}-attitude-${u}`, at(u, v, 0.015), r * k, r * k, {
        round: true,
        blankBackdrop: true,
      });
    // Airspeed dial follows the nonlinear analog layout; live value is explicitly TAS.
    const speed = rear ? [574, 610] : [700, 755];
    ins.dial(
      `${prefix}-speed`,
      at(...speed, -0.006),
      55 * k,
      'knots',
      [
        [0, 0],
        [60, 0.47],
        [100, 0.9],
        [200, 2.1],
        [300, 3.08],
        [400, 3.75],
        [500, 4.35],
        [600, 4.9],
        [800, 5.7],
      ],
      [0, 100, 200, 300, 400, 500, 600, 800],
      'TAS KT',
      {
        minorStep: 20,
        tickLabels: Object.fromEntries(
          [0, 100, 200, 300, 400, 500, 600, 800].map((v) => [v, v / 100]),
        ),
      },
    );
    const alt = rear ? [575, 735] : [697, 927];
    ins.dial(
      `${prefix}-altimeter`,
      at(...alt, -0.006),
      54 * k,
      'altitudeHundreds',
      [
        [0, 0],
        [1000, Math.PI * 2],
      ],
      [0, 100, 200, 300, 400, 500, 600, 700, 800, 900],
      'GEO FT',
      {
        period: Math.PI * 2,
        minorStep: 20,
        tickLabels: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i * 100, i])),
      },
    );
    d.box([0.043, 0.014, 0.003], at(alt[0], alt[1] + 4, -0.022), black);
    ins.readout(
      `${prefix}-altitude-counter`,
      at(alt[0], alt[1] + 4, -0.026),
      'feet',
      5,
      0.009,
      ink,
      true,
      true,
    );
    const hdg = rear ? [698, 735] : [833, 927];
    pt.gauge(px(hdg[0]), py(hdg[1]), z - 0.005, 52 * k, black, false);
    const hg = group(cabin, `F16-${prefix}-heading-card`, at(...hdg, -0.024)),
      hgd = detailKit(hg, hg.name);
    for (let deg = 0; deg < 360; deg += 10) {
      const a = (deg * Math.PI) / 180,
        p = (r) => [-Math.sin(a) * r, Math.cos(a) * r, 0];
      hgd.rod(p(44 * k), p((deg % 30 ? 48 : 50) * k), 0.0006, ink);
      if (deg % 30 === 0)
        hgd.text(
          deg % 90 ? String(deg / 10) : ['N', 'E', 'S', 'W'][deg / 90],
          p(36 * k),
          0.006,
          Math.PI,
          ink,
        );
    }
    hgd.finish();
    bindings.push({
      node: hg.name,
      source: 'trueHeading',
      property: 'rotation',
      axis: 'z',
      scale: -1,
      period: Math.PI * 2,
    });
    ins.available(`${prefix}-heading`, 'trueHeading', hg.name);
    d.rod(at(hdg[0], hdg[1] - 9, -0.028), at(hdg[0], hdg[1] + 9, -0.028), 0.001, ink);
    d.rod(at(hdg[0] - 10, hdg[1], -0.028), at(hdg[0] + 10, hdg[1], -0.028), 0.001, ink);
    d.text('TRUE', at(hdg[0], hdg[1] + 24, -0.028), 0.0045, Math.PI, ink);
    // Square instrument mounts and screws frame the round faces seen in the photographs.
    for (const [u, v, r] of [
      ...[ah, sh].map(([u, v, r]) => [u, v, r / 2 + 5]),
      [...speed, 60],
      [...alt, 60],
      [...hdg, 58],
    ]) {
      const points = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([x, y]) => at(u + x * r, v + y * r, -0.007));
      outline(d, points, 0.0025, m.dark);
      for (const p of points) d.add(new T.SphereGeometry(0.0027, 6, 4), m.metal, p);
    }
    const vsi = rear ? [806, 607] : [952, 580];
    ins.dial(
      `${prefix}-VSI`,
      at(...vsi, -0.006),
      38 * k,
      'verticalFpm',
      [
        [-6000, -4.2],
        [-2000, -2.5],
        [0, -Math.PI / 2],
        [2000, -0.64],
        [6000, 1.1],
      ],
      [-6000, -2000, 0, 2000, 6000],
      '1000 FPM',
      { tickLabels: { '-6000': '-6', '-2000': '-2', 0: '0', 2000: '2', 6000: '6' } },
    );
    // Fixed front HUD controls; the rear has a handgrip and a second CRT, not a duplicate HUD.
    if (!rear) {
      d.box([0.177, 0.15, 0.025], at(770, 522, -0.025), m.dark);
      for (const [u, v] of [
        [706, 466],
        [770, 462],
        [830, 466],
        [702, 576],
        [830, 576],
      ])
        pt.knob(px(u), py(v), z - 0.045, 0.013);
      for (const [u, v] of [
        [709, 508],
        [753, 508],
        [796, 508],
        [834, 508],
        [735, 552],
        [790, 552],
      ]) {
        d.rod(at(u, v, -0.04), at(u, v - 8, -0.052), 0.0025, m.metal);
      }
      d.text('HUD', at(770, 437, -0.046), 0.009, Math.PI, ink);
      const hud = [
        [665, 371],
        [668, 203],
        [685, 192],
        [854, 192],
        [871, 203],
        [876, 371],
      ].map(([u, v]) => at(u, v, 0.11));
      sheet(d, hud, m.glass, [0, 0, -1]);
      outline(d, hud, 0.007, m.dark);
      d.box([0.09, 0.035, 0.12], at(769, 360, 0.08), m.dark);
      // The glare shield wraps the panel and closes the forward cockpit well.
      sheet(
        d,
        [
          [-0.45, 2.49, z],
          [0.45, 2.49, z],
          [0.34, 2.45, 6.1],
          [-0.34, 2.45, 6.1],
        ],
        m.dark,
        [0, 1, 0],
      );
    } else
      outline(
        d,
        [
          [525, 334],
          [525, 250],
          [545, 210],
          [726, 210],
          [746, 250],
          [746, 334],
        ].map((p) => at(...p, -0.02)),
        0.012,
        m.dark,
        false,
      );
    // The real unmodeled receiver/engine/fuel instruments remain visibly unavailable.
    const displays = rear
      ? [
          [526, 459, 188, 145],
          [765, 451, 166, 166],
        ]
      : [
          [515, 677, 186, 148],
          [768, 1103, 171, 158],
        ];
    for (const [u, v, w, h] of displays) {
      d.box([w * k + 0.025, h * k + 0.025, 0.022], at(u, v, -0.018), m.dark);
      d.box([w * k, h * k, 0.004], at(u, v, -0.032), black);
      d.text('INOP', at(u, v, -0.035), 0.014, Math.PI, amber);
      for (let j = 0; j < 5; j++)
        for (const sign of [-1, 1])
          d.box(
            [0.007, 0.007, 0.005],
            at(u + sign * (w / 2 + 10), v - h / 2 + (j * h) / 4, -0.034),
            panel,
          );
    }
    const empty = rear
      ? [
          [362, 501, 44, 'RWR'],
          [983, 533, 34, 'FLOW'],
          [950, 603, 34, 'RPM'],
          [1023, 595, 24, 'NOZ'],
          [1024, 663, 34, 'FTIT'],
          [1035, 555, 12, 'OIL'],
          [470, 608, 32, 'G'],
        ]
      : [
          [566, 500, 54, 'RWR'],
          [1044, 494, 36, 'FLOW'],
          [1077, 648, 36, 'RPM'],
          [1153, 675, 24, 'NOZ'],
          [1078, 733, 35, 'FTIT'],
          [1155, 750, 35, 'FUEL'],
          [1155, 618, 19, 'OIL'],
        ];
    for (const [u, v, r, label] of empty) {
      pt.gauge(px(u), py(v), z - 0.008, r * k, black, false);
      d.text(label, at(u, v - r * 0.35, -0.033), Math.min(0.007, r * k * 0.24), Math.PI, ink);
      d.text('--', at(u, v + r * 0.2, -0.033), r * k * 0.4, Math.PI, amber);
    }
    const radio = rear ? [363, 585] : [1053, 578];
    d.box([0.084, 0.023, 0.014], at(...radio, -0.012), m.dark);
    d.text('--', at(...radio, -0.023), 0.009, Math.PI, ink);
    const switches = rear
      ? [
          [350, 390],
          [389, 390],
          [350, 423],
          [389, 423],
        ]
      : [
          [427, 516],
          [458, 516],
          [483, 489],
          [483, 516],
          [483, 543],
          [450, 543],
        ];
    for (const [u, v] of switches) {
      d.box([0.017, 0.012, 0.009], at(u, v, -0.012), m.dark);
      d.text('OFF', at(u, v, -0.019), 0.004, Math.PI, ink);
    }
    const aoa = rear ? [884, 589] : [935, 700];
    d.box([0.027, 0.091, 0.01], at(...aoa, -0.014), black);
    for (let i = 0; i <= 6; i++) {
      d.rod(
        at(aoa[0] - 8, aoa[1] - 45 + i * 15, -0.023),
        at(aoa[0] + 7, aoa[1] - 45 + i * 15, -0.023),
        0.0007,
        ink,
      );
    }
    const ag = group(cabin, `F16-${prefix}-AOA`, at(...aoa, -0.027)),
      ad = detailKit(ag, ag.name);
    ad.box([0.012, 0.002, 0.001], [0, 0, 0], ink);
    ad.finish();
    bindings.push({
      node: ag.name,
      source: 'aoaDegrees',
      property: 'position',
      axis: 'y',
      scale: 0.0024,
      offset: -0.018,
      min: -0.035,
      max: 0.035,
    });
    ins.available(`${prefix}-AOA`, 'aoaDegrees', ag.name);
    for (const [u, v] of rear
      ? [
          [250, 590],
          [285, 550],
          [255, 650],
          [985, 380],
        ]
      : [
          [365, 700],
          [365, 760],
          [1005, 701],
          [344, 805],
        ])
      pt.knob(px(u), py(v), z - 0.025, 0.012);
    for (const sign of [-1, 1])
      for (let j = 0; j < 4; j++) {
        const u = (rear ? 400 : 470) + (sign === 1 ? j * 20 : 430 + j * 20),
          v = rear ? 345 : 420;
        d.box([0.012, 0.01, 0.004], at(u, v, -0.018), black);
      }
    // Side consoles, reclined seat, footwell and elbow-supported force-sensing sidestick.
    const seatZ = rear ? 2.9 : 4.55,
      base = rear ? 1.58 : 1.46;
    d.box([0.86, 0.035, 1.34], [0, base, seatZ + 0.13], m.dark);
    for (const side of [-1, 1]) {
      d.box([0.155, 0.23, 1.08], [side * 0.39, base + 0.27, seatZ + 0.13], panel);
      for (let j = 0; j < 4; j++) {
        d.box([0.14, 0.012, 0.2], [side * 0.39, base + 0.39, seatZ - 0.22 + j * 0.23], m.dark);
        for (let q = 0; q < 3; q++) {
          d.rod(
            [side * 0.39 + (q - 1) * 0.038, base + 0.4, seatZ - 0.22 + j * 0.23],
            [side * 0.39 + (q - 1) * 0.038, base + 0.423, seatZ - 0.22 + j * 0.23 + 0.008],
            0.003,
            m.metal,
          );
        }
      }
    }
    const sg = group(cabin, `F16-${prefix}-seat`, [0, base + 0.48, seatZ + 0.55]);
    sg.rotation.x = -Math.PI / 6;
    const sd = detailKit(sg, sg.name);
    beveledBox(sd, [0.47, 0.1, 0.45], [0, 0, 0.12], seat);
    beveledBox(sd, [0.49, 0.72, 0.1], [0, 0.39, -0.1], seat);
    beveledBox(sd, [0.29, 0.24, 0.15], [0, 0.88, -0.1], m.dark);
    for (const side of [-1, 1]) {
      sd.rod([side * 0.25, -0.1, -0.14], [side * 0.25, 0.96, -0.14], 0.022, m.metal);
      sheet(
        sd,
        [
          [side * 0.13, 0.73, -0.035],
          [side * 0.18, 0.73, -0.035],
          [side * 0.08, 0.12, 0.04],
          [side * 0.03, 0.12, 0.04],
        ],
        belt,
        [0, 0, 1],
      );
    }
    sd.box([0.07, 0.04, 0.02], [0, 0.12, 0.05], m.metal);
    sd.finish();
    const stick = group(cabin, `F16-${prefix}-sidestick`, [-0.365, base + 0.43, seatZ + 0.28]),
      dd = detailKit(stick, stick.name);
    dd.rod([0, 0, 0], [0, 0.15, 0.015], 0.017, m.dark);
    dd.box([0.045, 0.055, 0.055], [0, 0.16, 0.015], m.dark);
    dd.add(new T.SphereGeometry(0.009, 8, 6), d.red, [0.025, 0.18, 0.015]);
    dd.finish();
    // Force stick has only millimetres of visual deflection, not a center-stick arc.
    bindings.push(
      { node: stick.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.025 },
      { node: stick.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.025 },
    );
    const throttle = group(cabin, `F16-${prefix}-throttle`, [0.38, base + 0.4, seatZ + 0.3]),
      td = detailKit(throttle, throttle.name);
    td.box([0.055, 0.07, 0.06], [0, 0.045, 0], m.dark);
    td.finish();
    bindings.push({
      node: throttle.name,
      source: 'power',
      property: 'position',
      axis: 'z',
      scale: 0.15,
    });
    for (const side of [-1, 1]) {
      const g = group(cabin, `F16-${prefix}-pedal-${side}`, [side * 0.13, base + 0.12, z + 0.09]),
        pd = detailKit(g, g.name);
      pd.box([0.12, 0.15, 0.045], [0, 0, 0], m.metal);
      for (let j = 0; j < 5; j++)
        pd.box([0.1, 0.005, 0.003], [0, -0.055 + j * 0.027, -0.025], m.dark);
      pd.finish();
      bindings.push({
        node: g.name,
        source: 'yawInput',
        property: 'position',
        axis: 'z',
        scale: -side * 0.055,
      });
    }
    for (let j = 0; j < 3; j++) {
      const lamp = group(cabin, `F16-${prefix}-gear-lamp-${j}`, [
          0.34 + (j - 1) * 0.02,
          base + 0.54,
          z - 0.16,
        ]),
        ld = detailKit(lamp, lamp.name);
      ld.box([0.012, 0.012, 0.004], [0, 0, 0], d.green);
      ld.finish();
      bindings.push({ node: lamp.name, source: 'gearDown', property: 'visible', scale: 1 });
    }
  }
  // Dark inner tub panels close the aperture down to the floor, leaving no view through skin seams.
  for (const side of [-1, 1]) {
    sheet(
      d,
      [
        [side * 0.52, 1.43, 2.45],
        [side * 0.52, 1.43, 5.9],
        [side * 0.52, 2.12, 5.9],
        [side * 0.52, 2.12, 2.45],
      ],
      panel,
      [-side, 0, 0],
    );
    d.rod([side * 0.48, 2.12, 2.5], [side * 0.48, 2.12, 5.8], 0.022, m.dark);
  }
  d.finish();
  return { nodes: ['cockpit'], sources, derived, bindings };
}
