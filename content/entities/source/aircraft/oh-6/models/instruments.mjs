/** Small, portable mechanical instrument parts; aircraft layout stays in interior.json. */
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const GLYPHS = {
  A: '010/101/111/101/101',
  B: '110/101/110/101/110',
  C: '011/100/100/100/011',
  D: '110/101/101/101/110',
  E: '111/100/110/100/111',
  F: '111/100/110/100/100',
  G: '011/100/101/101/011',
  H: '101/101/111/101/101',
  I: '111/010/010/010/111',
  J: '001/001/001/101/010',
  K: '101/101/110/101/101',
  L: '100/100/100/100/111',
  M: '101/111/111/101/101',
  N: '101/111/111/111/101',
  O: '010/101/101/101/010',
  P: '110/101/110/100/100',
  Q: '010/101/101/111/011',
  R: '110/101/110/101/101',
  S: '011/100/010/001/110',
  T: '111/010/010/010/010',
  U: '101/101/101/101/111',
  V: '101/101/101/101/010',
  W: '101/101/111/111/101',
  X: '101/101/010/101/101',
  Y: '101/101/010/010/010',
  Z: '111/001/010/100/111',
  0: '111/101/101/101/111',
  1: '010/110/010/010/111',
  2: '110/001/010/100/111',
  3: '110/001/010/001/110',
  4: '101/101/111/001/001',
  5: '111/100/110/001/110',
  6: '011/100/111/101/111',
  7: '111/001/010/010/010',
  8: '111/101/111/101/111',
  9: '111/101/111/001/110',
  '-': '000/000/111/000/000',
  '.': '000/000/000/000/010',
  '/': '001/001/010/100/100',
};

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
    const vertices = [],
      normals = [],
      indices = [];
    [...value.toUpperCase()].forEach((char, c) => {
      (GLYPHS[char]?.split('/') ?? []).forEach((row, r) => {
        [...row].forEach((bit, col) => {
          if (bit !== '1') return;
          // +X is left to a seated pilot looking +Z. Every glyph faces -Z.
          const px = x + ((value.length * 4 - 1) / 2 - c * 4 - col) * pixel;
          const py = y + (2.5 - r) * pixel;
          const i = vertices.length / 3;
          vertices.push(
            px,
            py,
            z,
            px - pixel * 0.82,
            py,
            z,
            px - pixel * 0.82,
            py - pixel * 0.82,
            z,
            px,
            py - pixel * 0.82,
            z,
          );
          normals.push(0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1);
          indices.push(i, i + 2, i + 1, i, i + 3, i + 2);
        });
      });
    });
    if (!vertices.length) return;
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
    geometry.setIndex(indices);
    return mesh(parent, name, geometry, material);
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
    mesh(instrument, `${id}-bezel`, new T.TorusGeometry(r, r * 0.065, 5, 24), bezel);
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
    text(instrument, `${id}-label`, label, 0, -r * 0.25, -0.008, r * 0.029);
    text(instrument, `${id}-units`, units, 0, -r * 0.45, -0.008, r * 0.024);
    if (type === 'horizon') {
      const ball = group(instrument, 'attitude-ball', [0, 0, -0.011]);
      for (const [name, offset, material] of [
        ['sky', 0, blue],
        ['earth', Math.PI, brown],
      ]) {
        const half = mesh(
          ball,
          `horizon-${name}`,
          new T.CircleGeometry(r * 0.72, 36, offset, Math.PI),
          material,
        );
        half.rotation.y = Math.PI;
      }
      box(ball, 'horizon-line', [r * 1.4, r * 0.018, 0.001], [0, 0, -0.002], white);
      for (const pitch of [-2, -1, 1, 2]) {
        box(
          ball,
          `pitch-mark-${pitch}`,
          [r * (Math.abs(pitch) === 1 ? 0.55 : 0.38), r * 0.015, 0.001],
          [0, pitch * r * 0.17, -0.004],
          paper,
        );
      }
      for (const side of [-1, 1])
        box(
          instrument,
          `horizon-wing-${side}`,
          [r * 0.45, r * 0.035, 0.002],
          [side * r * 0.29, 0, -0.018],
          yellow,
        );
      box(
        instrument,
        'horizon-aircraft',
        [r * 0.06, r * 0.12, 0.002],
        [0, -r * 0.04, -0.019],
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
      new T.CircleGeometry(r * 0.94, 48),
      lens,
      [0, 0, -0.023],
    );
    cover.rotation.y = Math.PI;
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
