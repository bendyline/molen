/** Small, portable mechanical instrument parts; aircraft layout stays in interior.json. */
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cockpitText } from '../../../../../../packages/entities/scripts/aircraft/cockpit-lettering.mjs';
import {
  domeDepth,
  instrumentDome,
} from '../../../../../../packages/entities/scripts/aircraft/rounded-instruments.mjs';

export function instrumentParts(api) {
  const { group, box, rod, sphere, mesh, dark, silver, white, yellow, blue, brown, rubber } = api;
  const dial = new T.MeshStandardMaterial({
    name: 'instrument-matte-black',
    color: '#101314',
    roughness: 0.87,
  });
  const bezel = new T.MeshStandardMaterial({
    name: 'instrument-painted-bezel',
    color: '#252a29',
    metalness: 0.35,
    roughness: 0.5,
  });
  const paper = new T.MeshStandardMaterial({
    name: 'instrument-ivory-print',
    color: '#d8d5bb',
    emissive: '#d8d5bb',
    emissiveIntensity: 0.12,
    roughness: 0.8,
  });
  const lens = new T.MeshStandardMaterial({
    name: 'instrument-cover-glass',
    color: '#cdd4cf',
    transparent: true,
    opacity: 0.06,
    roughness: 0.13,
    depthWrite: false,
    side: T.DoubleSide,
  });

  function text(parent, name, value, x, y, z, pixel = 0.0015, material = paper) {
    return cockpitText(
      parent,
      name,
      value,
      [x, y, z],
      pixel * 5,
      material,
      'period',
      Math.max(1, value.length * 4 - 1) * pixel,
    );
  }

  function plate(parent, name, outline, z, material = dark, depth = 0.035) {
    const shape = new T.Shape();
    outline.forEach(([x, y], i) => {
      if (i) shape.lineTo(x, y);
      else shape.moveTo(x, y);
    });
    shape.closePath();
    return mesh(
      parent,
      name,
      new T.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelSize: 0.005,
        bevelThickness: 0.004,
        bevelSegments: 2,
        steps: 1,
      }),
      material,
      [0, 0, z],
    );
  }
  function screw(parent, name, x, y, z, r = 0.004) {
    const head = mesh(parent, name, new T.CylinderGeometry(r, r, 0.0025, 8), silver, [x, y, z]);
    head.rotation.x = Math.PI / 2;
    box(parent, `${name}-slot`, [r * 1.35, 0.0007, 0.001], [x, y, z - 0.0018], dark);
  }
  function placard(parent, name, label, position, width = 0.14, pixel = 0.0015) {
    box(parent, name, [width, 0.026, 0.003], position, dial);
    text(parent, `${name}-print`, label, position[0], position[1], position[2] - 0.002, pixel);
  }
  function gauge(parent, spec) {
    const {
      id,
      label,
      position: [x, y, z],
      radius: r,
      numbers = ['0', '2', '4', '6', '8'],
      units = '',
      type = 'dial',
    } = spec;
    const instrument = group(parent, `${id}-instrument`, [x, y, z]);
    if (spec.square) {
      box(instrument, `${id}-mount`, [r * 2.35, r * 2.35, 0.009], [0, 0, 0.006], bezel);
      for (const sx of [-1, 1])
        for (const sy of [-1, 1])
          screw(instrument, `${id}-screw-${sx}-${sy}`, sx * r, sy * r, -0.001, r * 0.055);
    }
    mesh(
      instrument,
      `${id}-bezel`,
      new T.TorusGeometry(r, r * 0.065, type === 'horizon' ? 12 : 5, type === 'horizon' ? 64 : 24),
      bezel,
    );
    const face = mesh(
      instrument,
      `${id}-dial`,
      new T.CircleGeometry(r * 0.955, 48),
      dial,
      [0, 0, -0.002],
    );
    face.rotation.y = Math.PI;
    const ticks = [];
    const start = type === 'compass' || id === 'altimeter' ? 0 : -2.3;
    const sweep = type === 'compass' || id === 'altimeter' ? Math.PI * 2 : 4.6;
    for (let i = 0; i <= 40; i++) {
      const a = start + (i / 40) * sweep;
      const major = i % 5 === 0;
      const geometry = new T.BoxGeometry(r * 0.016, r * (major ? 0.13 : 0.055), 0.001);
      geometry.rotateZ(-a).translate(Math.sin(a) * r * 0.82, Math.cos(a) * r * 0.82, -0.005);
      ticks.push(geometry);
    }
    mesh(instrument, `${id}-scale`, mergeGeometries(ticks), paper);
    numbers.forEach((number, i) => {
      const a = start + (i / (numbers.length - (sweep > 5 ? 0 : 1))) * sweep;
      text(
        instrument,
        `${id}-number-${i}`,
        number,
        Math.sin(a) * r * 0.63,
        Math.cos(a) * r * 0.63,
        -0.006,
        r * 0.037,
      );
    });
    // Keep captions above the bottom numerals on closed scales, and use the clear
    // lower gap for units on open scales.
    text(instrument, `${id}-label`, label, 0, -r * (sweep > 5 ? 0.15 : 0.25), -0.008, r * 0.029);
    text(instrument, `${id}-units`, units, 0, -r * (sweep > 5 ? 0.35 : 0.62), -0.008, r * 0.024);
    if (type === 'horizon') {
      const ball = group(instrument, 'attitude-ball', [0, 0, -0.011]);
      const radius = r * 0.72,
        depth = r * 0.18;
      const curvedLine = (name, y, width, thickness, material) => {
        const points = Array.from({ length: 17 }, (_, i) => {
          const x = (i / 16 - 0.5) * width;
          return new T.Vector3(x, y, domeDepth(x, y, radius, depth) - thickness);
        });
        mesh(
          ball,
          name,
          new T.TubeGeometry(new T.CatmullRomCurve3(points), 16, thickness, 6, false),
          material,
        );
      };
      for (const [name, offset, material] of [
        ['sky', 0, blue],
        ['earth', Math.PI, brown],
      ]) {
        mesh(ball, `horizon-${name}`, instrumentDome(radius, depth, offset, Math.PI), material);
      }
      curvedLine('horizon-line', 0, r * 1.4, r * 0.009, white);
      for (const pitch of [-2, -1, 1, 2]) {
        curvedLine(
          `pitch-mark-${pitch}`,
          pitch * r * 0.17,
          r * (Math.abs(pitch) === 1 ? 0.55 : 0.38),
          r * 0.0075,
          paper,
        );
      }
      for (const side of [-1, 1])
        box(
          instrument,
          `horizon-wing-${side}`,
          [r * 0.45, r * 0.035, 0.002],
          [side * r * 0.29, 0, -0.016 - depth],
          yellow,
        );
      box(
        instrument,
        'horizon-aircraft',
        [r * 0.06, r * 0.12, 0.002],
        [0, -r * 0.04, -0.017 - depth],
        yellow,
      );
    } else if (type === 'turn') {
      box(
        instrument,
        'turn-aircraft-wings',
        [r * 1.05, r * 0.036, 0.002],
        [0, r * 0.13, -0.015],
        paper,
      );
      box(
        instrument,
        'turn-aircraft-fin',
        [r * 0.06, r * 0.27, 0.002],
        [0, r * 0.2, -0.015],
        paper,
      );
      box(instrument, 'slip-tube', [r * 1.35, r * 0.17, 0.003], [0, -r * 0.38, -0.011], paper);
      sphere(instrument, 'slip-ball', [r * 0.085, r * 0.085, 0.003], [0, -r * 0.38, -0.017], dial);
      for (const side of [-1, 1])
        box(
          instrument,
          `slip-reference-${side}`,
          [r * 0.017, r * 0.21, 0.001],
          [side * r * 0.13, -r * 0.38, -0.017],
          dark,
        );
    } else {
      const needle = group(instrument, `needle-${id}`, [0, 0, -0.015]);
      // Runtime bindings own these pivots. Unbound engine/system needles get plausible resting angles.
      needle.rotation.z = ['airspeed', 'altimeter', 'heading', 'vsi', 'rpm'].includes(id)
        ? 0
        : (spec.angle ?? -0.65);
      box(needle, `${id}-pointer`, [r * 0.035, r * 0.79, 0.002], [0, r * 0.29, 0], paper);
      box(needle, `${id}-counterweight`, [r * 0.07, r * 0.23, 0.002], [0, -r * 0.17, 0], paper);
      sphere(needle, `${id}-hub`, [r * 0.085, r * 0.085, 0.003], [0, 0, -0.002], bezel);
      if (id === 'altimeter' || spec.dual) {
        const second = group(needle, `${id}-second-hand`);
        second.rotation.z = 1.3;
        box(
          second,
          `${id}-short-pointer`,
          [r * 0.05, r * 0.44, 0.002],
          [0, r * 0.19, -0.003],
          white,
        );
      }
    }
    const cover = mesh(
      instrument,
      `${id}-cover`,
      type === 'horizon' ? instrumentDome(r * 0.94, r * 0.025) : new T.CircleGeometry(r * 0.94, 48),
      lens,
      [0, 0, type === 'horizon' ? -0.022 - r * 0.18 : -0.023],
    );
    if (type !== 'horizon') cover.rotation.y = Math.PI;
    return instrument;
  }
  function toggle(parent, name, position, label = '') {
    const [x, y, z] = position;
    mesh(parent, `${name}-nut`, new T.TorusGeometry(0.007, 0.002, 5, 6), silver, position);
    rod(parent, name, [x, y, z], [x, y + 0.012, z - 0.026], 0.0025, silver);
    if (label) text(parent, `${name}-label`, label, x, y + 0.024, z - 0.002, 0.001);
  }
  function grip(parent, name, position, length = 0.12) {
    const [x, y, z] = position;
    const handle = mesh(
      parent,
      name,
      new T.CapsuleGeometry(0.022, length - 0.044, 4, 10),
      rubber,
      position,
    );
    for (let i = 0; i < 7; i++)
      mesh(
        parent,
        `${name}-rib-${i}`,
        new T.TorusGeometry(0.0225, 0.0015, 4, 12).rotateX(Math.PI / 2),
        dark,
        [x, y - length * 0.3 + i * length * 0.1, z],
      );
    sphere(
      parent,
      `${name}-trigger`,
      [0.009, 0.011, 0.007],
      [x, y + length * 0.38, z + 0.019],
      yellow,
    );
    return handle;
  }
  return { text, plate, screw, placard, gauge, toggle, grip };
}
