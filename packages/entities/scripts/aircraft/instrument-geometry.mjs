/** Small, adaptable geometric instruments. Frames face local -Z; rotate the parent to mount.
 * Wiring uses the public client helpers; no photo texture or independent display clock.
 */
import {
  altimeterInstrument,
  annunciatorInstrument,
  attitudeInstrument,
  dialInstrument,
  modelSignalDisplacement,
  numericInstrument,
} from '../../../client/dist/instruments.mjs';
import { detailKit, group, mat, sheet, T } from './mesh-kit.mjs';

export function instrumentGeometry(parent, prefix) {
  const bindings = [],
    derived = {};
  const ink = mat(`${prefix}-instrument-ink`, '#ecf1db', {
    emissive: '#63716a',
    emissiveIntensity: 0.35,
  });
  const black = mat(`${prefix}-instrument-black`, '#101719');
  const sky = mat(`${prefix}-instrument-sky`, '#397aaf', {
    emissive: '#183650',
    emissiveIntensity: 0.5,
  });
  const earth = mat(`${prefix}-instrument-earth`, '#94683c');
  const amber = mat(`${prefix}-instrument-amber`, '#efbe45');
  const red = mat(`${prefix}-instrument-red`, '#dd4236');
  const name = (label) => `${prefix}-${label}`;
  function available(label, source, node) {
    const safe = `${prefix}.${label}.availableValue`,
      valid = `${prefix}.${label}.available`;
    derived[safe] = { op: 'coalesce', args: [source, -1e20] };
    derived[valid] = { op: 'greater', args: [safe, -1e20] };
    bindings.push(annunciatorInstrument(node, valid));
    return valid;
  }
  function readout(
    label,
    at,
    source,
    count,
    height,
    material = ink,
    signed = false,
    roundNearest = false,
  ) {
    const frame = group(parent, name(label), at),
      names = [],
      w = height * 0.46,
      step = height * 0.66;
    const segments = [
      [0, 0.5, false],
      [0.5, 0.25, true],
      [0.5, -0.25, true],
      [0, -0.5, false],
      [-0.5, -0.25, true],
      [-0.5, 0.25, true],
      [0, 0, false],
    ];
    for (let i = 0; i < count; i++) {
      const digit = [];
      segments.forEach(([x, y, vertical], j) => {
        const g = group(frame, name(`${label}-${i}-${j}`), [
          ((count - 1) * step) / 2 - i * step - x * w,
          y * height,
          0,
        ]);
        const d = detailKit(g, g.name);
        d.box(
          vertical ? [height * 0.075, height * 0.37, 0.0008] : [w * 0.8, height * 0.075, 0.0008],
          [0, 0, 0],
          material,
        );
        d.finish();
        digit.push(g.name);
      });
      names.push(digit);
    }
    let reading = source;
    if (signed) {
      reading = `${prefix}.${label}.magnitude`;
      const negative = `${prefix}.${label}.negative`;
      derived[reading] = { op: 'abs', args: [source] };
      derived[negative] = { op: 'less', args: [source, 0] };
      const sign = group(frame, name(`${label}-minus`), [((count + 0.1) * step) / 2, 0, 0]),
        d = detailKit(sign, sign.name);
      d.box([w * 0.8, height * 0.075, 0.0008], [0, 0, 0], material);
      d.finish();
      bindings.push(annunciatorInstrument(sign.name, negative));
    }
    if (roundNearest) {
      const rounded = `${prefix}.${label}.rounded`;
      derived[rounded] = { op: 'add', args: [reading, 0.5] };
      reading = rounded;
    }
    const wired = numericInstrument({
      source: reading,
      digits: names,
      prefix: `${prefix}.${label}`,
    });
    bindings.push(...wired.bindings);
    Object.assign(derived, wired.derived);
    return frame;
  }
  function pointer(label, at, radius, source, calibration, options = {}) {
    const frame = group(parent, name(label), at),
      d = detailKit(frame, frame.name);
    d.rod([0, -radius * 0.12, 0], [0, radius, 0], radius * 0.028, options.material ?? ink);
    d.add(new T.CircleGeometry(radius * 0.08, 12).rotateY(Math.PI), black, [0, 0, -0.001]);
    d.finish();
    const binding = dialInstrument({ node: frame.name, source, calibration, ...options });
    bindings.push(binding);
    available(label, source, frame.name);
    return binding;
  }
  function dial(label, at, radius, source, calibration, ticks, caption, options = {}) {
    const frame = group(parent, name(`${label}-face`), at),
      d = detailKit(frame, frame.name);
    d.add(new T.CylinderGeometry(radius, radius, 0.012, 32).rotateX(Math.PI / 2), black);
    d.ring(radius * 0.97, radius * 0.045, [0, 0, -0.008], d.metal);
    const b = pointer(
      label,
      [at[0], at[1], at[2] - 0.013],
      radius * 0.76,
      source,
      calibration,
      options,
    );
    const marks = options.minorStep
      ? Array.from(
          { length: Math.floor(calibration.at(-1)[0] / options.minorStep) + 1 },
          (_, i) => i * options.minorStep,
        )
      : ticks;
    for (const value of marks) {
      const a = modelSignalDisplacement(b, value),
        p = (r) => [-Math.sin(a) * r, Math.cos(a) * r, -0.009];
      d.rod(p(radius * (ticks.includes(value) ? 0.8 : 0.85)), p(radius * 0.91), radius * 0.01, ink);
      if (ticks.includes(value))
        d.text(
          String(options.tickLabels?.[value] ?? value),
          p(radius * 0.64),
          radius * 0.15,
          Math.PI,
          ink,
          'dial',
        );
    }
    for (const [lo, hi, color, ring = 0.93] of options.bands ?? []) {
      const material = mat(`${prefix}-${label}-${lo}-${hi}`, color);
      for (let value = lo; value < hi; value += 2) {
        const p = (v) => {
          const a = modelSignalDisplacement(b, v);
          return [-Math.sin(a) * radius * ring, Math.cos(a) * radius * ring, -0.0095];
        };
        d.rod(p(value), p(Math.min(hi, value + 2)), radius * 0.024, material);
      }
    }
    // Reserve the lower perimeter for scale numerals, including long unit captions.
    d.text(caption, [0, -radius * 0.22, -0.009], radius * 0.13, Math.PI, ink, 'dial');
    d.finish();
    return { frame, binding: b };
  }
  function altimeter(label, at, radius, source) {
    const face = group(parent, name(label), at),
      d = detailKit(face, face.name);
    d.add(new T.CylinderGeometry(radius, radius, 0.012, 32).rotateX(Math.PI / 2), black);
    d.ring(radius * 0.97, radius * 0.045, [0, 0, -0.008], d.metal);
    for (let i = 0; i < 50; i++) {
      const a = (i * Math.PI) / 25,
        p = (r) => [-Math.sin(a) * r, Math.cos(a) * r, -0.009];
      d.rod(p(radius * (i % 5 ? 0.86 : 0.79)), p(radius * 0.91), radius * 0.01, ink);
      if (i % 5 === 0) d.text(String(i / 5), p(radius * 0.66), radius * 0.18, Math.PI, ink, 'dial');
    }
    d.text('GEO FT', [0, -radius * 0.4, -0.01], radius * 0.14, Math.PI, ink, 'dial');
    d.finish();
    const nodes = [];
    [0.79, 0.53, 0.33].forEach((length, i) => {
      const g = group(face, name(`${label}-${i}`), [0, 0, -0.014 - i * 0.001]),
        dd = detailKit(g, g.name);
      dd.rod([0, -0.004, 0], [0, radius * length, 0], radius * (i === 1 ? 0.035 : 0.02), ink);
      dd.finish();
      nodes.push(g.name);
      available(`${label}-${i}`, source, g.name);
    });
    bindings.push(
      ...altimeterInstrument({
        source,
        hundreds: nodes[0],
        thousands: nodes[1],
        tenThousands: nodes[2],
        direction: 1,
        responseSeconds: 0.15,
      }),
    );
    return face;
  }
  /** Period directional gyro/compass card; the curved drum rotates behind a fixed window. */
  function headingDrum(label, at, radius, source) {
    const frame = group(parent, name(label), at),
      d = detailKit(frame, name(`${label}-fixed`)),
      r = radius * 0.9,
      drum = group(frame, name(`${label}-drum`), [0, 0, r + 0.002]),
      dd = detailKit(drum, drum.name);
    dd.add(new T.CylinderGeometry(r, r, radius * 0.6, 72), black);
    for (let deg = 0; deg < 360; deg += 5) {
      const a = (deg * Math.PI) / 180,
        x = -Math.sin(a) * (r + 0.0005),
        z = -Math.cos(a) * (r + 0.0005);
      dd.rod([x, radius * 0.2, z], [x, radius * (deg % 10 ? 0.14 : 0.07), z], 0.00045, ink);
      if (deg % 30 === 0)
        dd.text(
          deg % 90 ? String(deg / 10) : ['N', 'E', 'S', 'W'][deg / 90],
          [x, -radius * 0.08, z],
          radius * 0.22,
          Math.PI + a,
          ink,
          'dial',
        );
    }
    dd.finish();
    const circle = Array.from({ length: 48 }, (_, i) => [
      Math.cos((i * Math.PI) / 24) * radius,
      Math.sin((i * Math.PI) / 24) * radius,
      -0.002,
    ]);
    const hole = [
      [-0.75, -0.27],
      [0.75, -0.27],
      [0.75, 0.27],
      [-0.75, 0.27],
    ].map(([x, y]) => [x * radius, y * radius, -0.002]);
    sheet(d, circle, black, [0, 0, -1], [hole]);
    d.ring(radius * 0.97, radius * 0.045, [0, 0, -0.004], d.metal);
    d.rod([0, radius * 0.27, -0.004], [0, radius * 0.1, -0.004], 0.0007, amber);
    d.text('TRUE', [0, -radius * 0.52, -0.004], radius * 0.14, Math.PI, ink, 'dial');
    d.finish();
    bindings.push({
      node: drum.name,
      source,
      property: 'rotation',
      axis: 'y',
      scale: -1,
      period: 2 * Math.PI,
      responseSeconds: 0.15,
    });
    available(label, source, drum.name);
    return frame;
  }
  /** Caller supplies a true panel aperture; this mask covers the moving card at every angle. */
  function horizon(
    label,
    at,
    width,
    height,
    { round = false, roll = 'roll', pitch = 'pitch', blankBackdrop = false } = {},
  ) {
    const frame = group(parent, name(label), at),
      d = detailKit(frame, name(`${label}-fixed`));
    const bank = group(frame, name(`${label}-bank`)),
      card = group(bank, name(`${label}-pitch`)),
      cd = detailKit(card, name(`${label}-card`));
    const radius = Math.hypot(width, height) * 0.8,
      scale = height * 1.05;
    if (blankBackdrop)
      d.add(new T.CircleGeometry(radius, 48).rotateY(Math.PI), black, [0, 0, 0.004]);
    cd.add(new T.CircleGeometry(radius, 48, 0, Math.PI).rotateY(Math.PI), sky);
    cd.add(new T.CircleGeometry(radius, 48, Math.PI, Math.PI).rotateY(Math.PI), earth);
    cd.rod([-radius, 0, -0.001], [radius, 0, -0.001], 0.0007, ink);
    for (const deg of [-20, -10, -5, 5, 10, 20]) {
      const y = ((deg * Math.PI) / 180) * scale,
        length = width * (Math.abs(deg) % 10 ? 0.12 : 0.25);
      cd.rod([-length / 2, y, -0.001], [length / 2, y, -0.001], 0.0006, ink);
      if (Math.abs(deg) % 10 === 0)
        cd.text(
          String(Math.abs(deg)),
          [length * 0.8, y, -0.001],
          height * 0.065,
          Math.PI,
          ink,
          'dial',
        );
    }
    cd.finish();
    const z = -0.003,
      hole = round
        ? Array.from({ length: 48 }, (_, i) => [
            (Math.cos((i * Math.PI) / 24) * width) / 2,
            (Math.sin((i * Math.PI) / 24) * height) / 2,
            z,
          ])
        : [
            [-width / 2, -height / 2, z],
            [width / 2, -height / 2, z],
            [width / 2, height / 2, z],
            [-width / 2, height / 2, z],
          ];
    const extent = radius + height * 0.4;
    sheet(
      d,
      [
        [-extent, -extent, z],
        [extent, -extent, z],
        [extent, extent, z],
        [-extent, extent, z],
      ],
      black,
      [0, 0, -1],
      [hole],
    );
    for (const side of [-1, 1])
      d.rod([side * width * 0.08, 0, -0.006], [side * width * 0.31, 0, -0.006], 0.001, amber);
    d.rod([-width * 0.08, 0, -0.006], [0, -height * 0.045, -0.006], 0.001, amber);
    d.rod([0, -height * 0.045, -0.006], [width * 0.08, 0, -0.006], 0.001, amber);
    d.finish();
    bindings.push(
      ...attitudeInstrument({
        bankNode: bank.name,
        pitchNode: card.name,
        pitchSource: pitch,
        rollSource: roll,
        pitchScale: -scale,
        pitchLimit: height * 0.3,
        bankDirection: -1,
        responseSeconds: 0.08,
      }),
    );
    available(`${label}-bank`, roll, bank.name);
    available(`${label}-pitch`, pitch, card.name);
    return frame;
  }
  return {
    bindings,
    derived,
    ink,
    black,
    sky,
    earth,
    amber,
    red,
    readout,
    pointer,
    dial,
    altimeter,
    headingDrum,
    horizon,
    available,
  };
}
