/** Deterministic OH-6A master. Four main blades, two tail blades and the original braced tail. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { instrumentParts } from './instruments.mjs';
import { addInterior } from './interior.mjs';

globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = value;
      this.onloadend?.();
    });
  }
};
const root = dirname(fileURLToPath(import.meta.url));
const interiorLayout = JSON.parse(await readFile(resolve(root, 'interior.json'), 'utf8'));
const mat = (name, color, metalness = 0, roughness = 0.6) =>
  new T.MeshStandardMaterial({ name, color, metalness, roughness });
const silver = mat('machined-aluminum', '#a5a9a6', 0.78, 0.34);
const olive = mat('olive-drab-enamel', '#515442', 0.08, 0.66);
const dark = mat('cockpit-charcoal', '#232728', 0.12, 0.75);
const green = mat('interior-green', '#606950', 0, 0.85);
const rubber = mat('rubber', '#171a19', 0, 0.95);
const white = mat('ivory-markings', '#d9d9c9', 0, 0.62);
const blue = mat('instrument-sky', '#577d96');
const brown = mat('instrument-earth', '#6a604d');
const yellow = mat('warning-yellow', '#d8ae42');
const red = mat('warning-red', '#af312a', 0.08, 0.5);
const bladePaint = mat('rotor-blade-coating', '#303431', 0.32, 0.58);
const exhaustMetal = mat('heat-stained-exhaust', '#746b56', 0.68, 0.56);
const glass = new T.MeshStandardMaterial({
  name: 'clear-cabin-glazing',
  color: '#d5e0de',
  transparent: true,
  opacity: 0.12,
  metalness: 0.08,
  roughness: 0.13,
  side: T.DoubleSide,
  depthWrite: false,
});
function group(parent, name, pos = [0, 0, 0]) {
  const g = new T.Group();
  g.name = name;
  g.position.fromArray(pos);
  parent.add(g);
  return g;
}
function mesh(parent, name, geometry, material, pos = [0, 0, 0], scale = [1, 1, 1]) {
  const obj = new T.Mesh(geometry, material);
  obj.name = name;
  obj.position.fromArray(pos);
  obj.scale.fromArray(scale);
  parent.add(obj);
  return obj;
}
function box(parent, name, size, pos, material = dark) {
  return mesh(parent, name, new T.BoxGeometry(...size), material, pos);
}
function sphere(parent, name, radii, pos, material) {
  return mesh(parent, name, new T.SphereGeometry(1, 24, 16), material, pos, radii);
}
function rod(parent, name, a, b, radius, material = silver, topRadius = radius) {
  const delta = new T.Vector3(...b).sub(new T.Vector3(...a));
  const obj = mesh(
    parent,
    name,
    new T.CylinderGeometry(topRadius, radius, delta.length(), 12),
    material,
    a,
  );
  obj.position.addScaledVector(delta, 0.5);
  obj.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
  return obj;
}
function tube(parent, name, points, material = olive, radius = 0.014) {
  return mesh(
    parent,
    name,
    new T.TubeGeometry(
      new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
      points.length === 2 ? 1 : Math.max(12, points.length * 3),
      radius,
      6,
      false,
    ),
    material,
  );
}
const api = {
  group,
  mesh,
  box,
  sphere,
  rod,
  silver,
  olive,
  dark,
  green,
  rubber,
  white,
  blue,
  brown,
  yellow,
  red,
  glass,
};
const { text } = instrumentParts(api);
const point = (theta, phi, lift = 0) => [
  (0.91 + lift) * Math.sin(theta) * Math.sin(phi),
  1.43 + (1.02 + lift) * Math.cos(theta),
  0.26 + (1.73 + lift) * Math.sin(theta) * Math.cos(phi),
];
function lining(parent, name, geometry, center, material) {
  const geo = geometry.clone();
  geo.translate(-center[0], -center[1], -center[2]);
  geo.scale(0.982, 0.982, 0.982);
  geo.translate(...center);
  const index = geo.index.array;
  for (let i = 0; i < index.length; i += 3)
    [index[i + 1], index[i + 2]] = [index[i + 2], index[i + 1]];
  const normal = geo.getAttribute('normal');
  for (let i = 0; i < normal.count; i++)
    normal.setXYZ(i, -normal.getX(i), -normal.getY(i), -normal.getZ(i));
  mesh(parent, name, geo, material);
}
function cabin(parent) {
  // Glazing follows the same egg surface as the opaque doors, including separate aft windows.
  const phiCount = 80;
  const kind = (phi) => {
    const a = Math.abs(phi);
    return a <= Math.PI * 0.35
      ? 'windshield'
      : a <= Math.PI * 0.64
        ? 'door'
        : a >= Math.PI * 0.71 && a <= Math.PI * 0.9
          ? 'aft-window'
          : 'skin';
  };
  const cuts = (phi) => {
    const a = Math.abs(phi),
      k = kind(phi);
    let top = 0.72,
      bottom = 1.72;
    if (k === 'windshield') {
      top = 0.48;
      bottom = 2.18;
    }
    if (k === 'door') {
      const u = (a - Math.PI * 0.495) / 0.47;
      top = 0.64 + 0.3 * u * u;
      bottom = 1.72 - 0.15 * u * u;
    }
    if (k === 'aft-window') {
      const u = (a - Math.PI * 0.805) / 0.3;
      top = 0.86 + 0.18 * u * u;
      bottom = 1.51 - 0.09 * u * u;
    }
    return [
      0,
      0.22,
      0.43,
      top,
      top + (bottom - top) * 0.25,
      top + (bottom - top) * 0.5,
      top + (bottom - top) * 0.75,
      bottom,
      2.38,
      2.7,
      Math.PI,
    ];
  };
  const buffers = new Map();
  function buffer(name) {
    if (!buffers.has(name)) buffers.set(name, { positions: [], normals: [], indices: [] });
    return buffers.get(name);
  }
  // Boundary angles have duplicate columns: adjoining panels still meet exactly at their cut.
  const boundaries = [0, 0.35, 0.64, 0.71, 0.9, 1].flatMap((v) => [-v * Math.PI, v * Math.PI]);
  const phis = [
    ...new Set([
      ...Array.from({ length: phiCount + 1 }, (_, i) => -Math.PI + (i * Math.PI * 2) / phiCount),
      ...boundaries,
    ]),
  ].sort((a, b) => a - b);
  for (let j = 0; j < phis.length - 1; j++) {
    const a = phis[j],
      b = phis[j + 1],
      mid = (a + b) / 2,
      k = kind(mid);
    // Compute each column using this panel's side of the boundary to avoid seams.
    const inset = 1e-7;
    const ca = cuts(a + inset),
      cb = cuts(b - inset);
    for (let i = 0; i < ca.length - 1; i++) {
      const glazed = k !== 'skin' && i >= 3 && i < 7;
      const name = glazed ? `${k}-glazing` : 'cabin-panels';
      const dst = buffer(name),
        start = dst.positions.length / 3;
      for (const [theta, phi] of [
        [ca[i], a],
        [ca[i + 1], a],
        [cb[i + 1], b],
        [cb[i], b],
      ]) {
        const p = point(theta, phi);
        dst.positions.push(...p);
        dst.normals.push(
          ...new T.Vector3(p[0] / 0.91 ** 2, (p[1] - 1.43) / 1.02 ** 2, (p[2] - 0.26) / 1.73 ** 2)
            .normalize()
            .toArray(),
        );
      }
      if (i > 0) dst.indices.push(start, start + 1, start + 3);
      if (i < ca.length - 2) dst.indices.push(start + 1, start + 2, start + 3);
      if (glazed && (i === 3 || i === 6))
        tube(
          parent,
          `${k}-seal`,
          [point(ca[i === 3 ? i : i + 1], a, 0.003), point(cb[i === 3 ? i : i + 1], b, 0.003)],
          olive,
          0.013,
        );
    }
    if (k === 'windshield')
      tube(
        parent,
        'windscreen-cross-rail',
        [point(ca[5], a, 0.004), point(cb[5], b, 0.004)],
        olive,
        0.012,
      );
  }
  for (const [name, data] of buffers) {
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(data.positions, 3));
    geo.setAttribute('normal', new T.Float32BufferAttribute(data.normals, 3));
    geo.setIndex(data.indices);
    mesh(parent, name, geo, name === 'cabin-panels' ? olive : glass);
    if (name === 'cabin-panels') lining(parent, 'cabin-interior', geo, [0, 1.43, 0.26], green);
  }
  for (const side of [-1, 1]) {
    for (const phi of [0, Math.PI * 0.35, Math.PI * 0.64, Math.PI * 0.71, Math.PI * 0.9]) {
      const [, , , top, , , , bottom] = cuts(side * (phi + (phi === 0 ? 0 : -1e-6)));
      tube(
        parent,
        'glazing-upright',
        Array.from({ length: 14 }, (_, i) =>
          point(top + ((bottom - top) * i) / 13, side * phi, 0.005),
        ),
        olive,
        phi === 0 ? 0.018 : 0.022,
      );
    }
    // Full door outline continues below its arched window to the belly sill.
    // Door seams and cowl fasteners (3–4 mm) are not modelled: sub-pixel detail at medium-fi.
    const handle = point(1.82, side * 1.75, 0.018);
    rod(
      parent,
      `door-handle-${side}`,
      [handle[0], handle[1], handle[2] - 0.065],
      [handle[0], handle[1], handle[2] + 0.065],
      0.013,
      dark,
    );
    for (const theta of [1.13, 1.77]) {
      const p = point(theta, side * 2.02, 0.015);
      box(parent, `door-hinge-${side}-${theta}`, [0.025, 0.035, 0.06], p, silver);
    }
    sphere(
      parent,
      `navigation-light-${side}`,
      [0.03, 0.025, 0.03],
      [side * 0.88, 1.2, -0.27],
      side === 1 ? red : mat('navigation-green', '#3f8156', 0.1, 0.25),
    );
  }
}
function loft(parent, name, stations, material) {
  const n = 40,
    vertices = [],
    indices = [];
  for (const [z, y, rx, ry] of stations)
    for (let i = 0; i <= n; i++) {
      const a = (i * Math.PI * 2) / n;
      vertices.push(rx * Math.sin(a), y + ry * Math.cos(a), z);
    }
  for (let k = 0; k < stations.length - 1; k++)
    for (let i = 0; i < n; i++) {
      const a = k * (n + 1) + i,
        b = a + n + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return mesh(parent, name, geo, material);
}
function fin(parent, name, outline, width, material = olive) {
  const shape = new T.Shape();
  outline.forEach(([z, y], i) => {
    if (i) shape.lineTo(z, y);
    else shape.moveTo(z, y);
  });
  shape.closePath();
  const geo = new T.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: true,
    bevelSize: 0.005,
    bevelThickness: 0.004,
    bevelSegments: 2,
    steps: 1,
  });
  // Shape XY is authored as ZY, extrusion becomes X.
  geo.rotateY(-Math.PI / 2);
  geo.translate(width / 2, 0, 0);
  return mesh(parent, name, geo, material);
}
function engine(parent) {
  // The rear cabin skin already supplies the cowl; remove the old second oversized sphere.
  fin(
    parent,
    'transmission-fairing',
    [
      [-0.15, 2.22],
      [-0.35, 2.61],
      [-1.16, 2.44],
      [-1.28, 2.05],
    ],
    0.48,
  );
  for (const side of [-1, 1]) {
    box(parent, `engine-air-intake-${side}`, [0.014, 0.2, 0.38], [side * 0.257, 2.39, -0.76], dark);
    for (let i = 0; i < 7; i++)
      box(
        parent,
        `intake-louver-${side}-${i}`,
        [0.017, 0.009, 0.37],
        [side * 0.27, 2.305 + i * 0.025, -0.76],
        olive,
      );
  }
  const exit = group(parent, 'exhaust-outlet', [0, 1.42, -1.49]);
  const bend = new T.CatmullRomCurve3(
    [
      [0.16, 0.16, 0.21],
      [0.04, 0.13, 0.06],
      [0, 0.1, -0.1],
      [0, 0.12, -0.29],
    ].map((p) => new T.Vector3(...p)),
  );
  mesh(exit, 'exhaust-pipe', new T.TubeGeometry(bend, 20, 0.155, 24, false), exhaustMetal);
  const mouth = mesh(
    exit,
    'exhaust-dark-opening',
    new T.CircleGeometry(0.144, 32),
    dark,
    [0, 0.12, -0.298],
  );
  mouth.rotation.y = Math.PI;
  mesh(
    exit,
    'exhaust-lip',
    new T.TorusGeometry(0.153, 0.012, 8, 32),
    exhaustMetal,
    [0, 0.12, -0.293],
  );
  rod(exit, 'exhaust-divider', [0, -0.025, -0.3], [0, 0.265, -0.3], 0.009, exhaustMetal);
}
function rotorHead(parent) {
  rod(parent, 'rotor-mast', [0, 2.29, -0.25], [0, 2.69, -0.25], 0.049, silver);
  const swash = group(parent, 'swashplate', [0, 2.48, -0.25]);
  for (const y of [0, 0.055])
    mesh(
      swash,
      'swashplate-ring',
      new T.TorusGeometry(0.135, 0.018, 8, 24).rotateX(Math.PI / 2),
      silver,
      [0, y, 0],
    );
  sphere(parent, 'mast-boot', [0.085, 0.12, 0.085], [0, 2.4, -0.25], rubber);
  const rotor = group(parent, 'main-rotor', [0, 2.69, -0.25]);
  const cap = mesh(rotor, 'rotor-head', new T.CylinderGeometry(0.09, 0.12, 0.08, 16), dark);
  cap.position.y = 0.015;
  for (let i = 0; i < 4; i++) {
    const blade = group(rotor, `rotor-blade-${i}`);
    blade.rotation.y = (i * Math.PI) / 2 + 0.25;
    rod(blade, 'blade-grip', [0.1, 0, 0], [0.42, 0, 0], 0.036, silver);
    box(blade, 'grip-hinge', [0.085, 0.09, 0.105], [0.25, 0, 0], silver);
    rod(blade, 'pitch-link', [0.29, -0.2, 0.065], [0.35, -0.015, 0.065], 0.009, silver);
    // Chord, tapered tips and small droop; 4.025 m radius, rather than five MD-500 blades.
    const vertices = [],
      indices = [];
    const sections = [
      [0.38, 0.16, 0],
      [0.58, 0.18, 0],
      [1.2, 0.185, -0.01],
      [3.55, 0.18, -0.06],
      [4.025, 0.135, -0.085],
    ];
    for (const [r, chord, y] of sections)
      for (const [z, dy] of [
        [-0.5, 0.003],
        [-0.25, 0.02],
        [0.5, 0.002],
        [0.35, -0.014],
        [-0.4, -0.012],
      ])
        vertices.push(r, y + dy, z * chord);
    for (let j = 0; j < sections.length - 1; j++)
      for (let k = 0; k < 5; k++) {
        const a = j * 5 + k,
          b = j * 5 + ((k + 1) % 5),
          c = a + 5,
          d = b + 5;
        indices.push(a, b, c, b, d, c);
      }
    indices.push(0, 2, 1, 0, 3, 2, 0, 4, 3, 20, 21, 22, 20, 22, 23, 20, 23, 24);
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    mesh(blade, 'rotor-airfoil', geo, bladePaint);
    box(blade, 'rotor-tip', [0.1, 0.022, 0.13], [3.974, -0.082, 0], yellow);
  }
}
function tail(parent) {
  loft(
    parent,
    'tail-boom',
    [
      [-4.99, 1.63, 0.06, 0.07],
      [-4.5, 1.67, 0.083, 0.1],
      [-3.0, 1.84, 0.13, 0.15],
      [-1.3, 1.94, 0.26, 0.29],
    ],
    olive,
  );
  fin(
    parent,
    'tail-fin',
    [
      [-4.99, 0.91],
      [-4.8, 0.91],
      [-4.47, 2.52],
      [-4.71, 2.61],
    ],
    0.04,
  );
  // The original OH-6 has an angled, braced stabilizer beneath the upper fin, not a T-tail.
  for (const side of [-1, 1]) {
    const shape = new T.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(side * 0.76, 0.04);
    shape.lineTo(side * 0.69, -0.29);
    shape.lineTo(0, -0.31);
    shape.closePath();
    const geo = new T.ExtrudeGeometry(shape, {
      depth: 0.025,
      bevelEnabled: true,
      bevelSize: 0.004,
      bevelThickness: 0.003,
      bevelSegments: 1,
    });
    geo.rotateX(-Math.PI / 2);
    const stabilizer = mesh(parent, `tail-stabilizer-${side}`, geo, olive, [0, 2.02, -4.6]);
    stabilizer.rotation.z = side * 0.18;
    rod(parent, `tail-brace-${side}`, [0, 2.49, -4.6], [side * 0.67, 2.13, -4.75], 0.016, olive);
  }
  const rotor = group(parent, 'tail-rotor', [0.18, 1.7, -4.88]);
  rod(rotor, 'tail-hub', [-0.13, 0, 0], [0.095, 0, 0], 0.043, silver);
  for (let i = 0; i < 2; i++) {
    const blade = group(rotor, `tail-blade-${i}`);
    blade.rotation.x = i * Math.PI;
    box(blade, 'tail-blade-airfoil', [0.022, 0.6, 0.105], [0.014, 0.33, 0], white);
    box(blade, 'tail-blade-warning', [0.025, 0.075, 0.11], [0.014, 0.52, 0], red);
    box(blade, 'tail-blade-tip', [0.025, 0.035, 0.11], [0.014, 0.612, 0], yellow);
  }
}
function skids(parent) {
  for (const side of [-1, 1]) {
    tube(
      parent,
      `skid-${side}`,
      [
        [side * 0.99, 0.055, -1.42],
        [side * 0.99, 0.055, 0.6],
        [side * 0.99, 0.065, 1.4],
        [side * 0.99, 0.12, 1.66],
        [side * 0.99, 0.24, 1.84],
      ],
      olive,
      0.045,
    );
    for (const z of [-0.75, 0.91]) {
      tube(
        parent,
        `skid-cross-tube-${side}-${z}`,
        [
          [0, 0.54, z],
          [side * 0.47, 0.58, z],
          [side * 0.74, 0.48, z],
          [side * 0.99, 0.12, z],
        ],
        olive,
        0.035,
      );
      box(parent, 'skid-saddle', [0.12, 0.025, 0.09], [side * 0.99, 0.094, z], silver);
    }
    box(parent, `skid-step-${side}`, [0.08, 0.025, 0.41], [side * 0.88, 0.31, 0.53], dark);
  }
}
function details(parent) {
  for (const side of [-1, 1]) {
    const markings = group(parent, `tail-markings-${side}`, [side * 0.142, 1.91, -2.9]);
    // Text initially faces -Z; the local face rotates outward on either boom side.
    markings.rotation.y = side === 1 ? -Math.PI / 2 : Math.PI / 2;
    const stencil = text(markings, 'army-stencil', 'UNITED STATES ARMY', 0, 0, 0, 0.022, dark);
    markings.updateMatrixWorld(true);
    const positions = stencil.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const p = new T.Vector3()
        .fromBufferAttribute(positions, i)
        .applyMatrix4(markings.matrixWorld);
      const aft = p.z < -3;
      const t = aft ? (-p.z - 3) / 1.5 : (-p.z - 1.3) / 1.7;
      const rx = aft ? 0.13 - t * 0.047 : 0.26 - t * 0.13;
      const ry = aft ? 0.15 - t * 0.05 : 0.29 - t * 0.14;
      const y = aft ? 1.84 - t * 0.17 : 1.94 - t * 0.1;
      const dy = p.y - 1.91;
      p.set(side * (rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2)) + 0.003), y + dy, p.z);
      positions.setXYZ(i, ...p.toArray());
    }
    stencil.geometry.computeVertexNormals();
    stencil.geometry.computeBoundingBox();
    stencil.geometry.computeBoundingSphere();
    parent.add(stencil);
    parent.remove(markings);
    const serial = group(parent, `serial-markings-${side}`, [side * 0.272, 2.41, -0.83]);
    serial.rotation.y = side === 1 ? -Math.PI / 2 : Math.PI / 2;
    text(serial, 'aircraft-serial', '16172', 0, 0, 0, 0.017, dark);
  }
  rod(parent, 'belly-antenna', [0, 0.46, -0.1], [0, 0.18, 0.16], 0.009, dark);
  rod(parent, 'tail-antenna', [0, 1.81, -2.66], [0, 1.45, -2.92], 0.009, dark);
  sphere(parent, 'anti-collision-beacon', [0.045, 0.035, 0.045], [0, 2.47, -1.05], red);
}
/** Merge repeated static frame segments at the root, leaving every animated child intact. */
function mergeStaticFrames(parent) {
  const batches = new Map();
  for (const object of [...parent.children]) {
    if (!object.isMesh) continue;
    const key = `${object.name}:${object.material.name}`;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(object);
  }
  for (const objects of batches.values()) {
    if (objects.length < 2) continue;
    const geometries = objects.map((object) => {
      object.updateMatrix();
      const geometry = object.geometry.clone().applyMatrix4(object.matrix);
      geometry.deleteAttribute('uv');
      return geometry;
    });
    mesh(parent, objects[0].name, mergeGeometries(geometries), objects[0].material);
    for (const object of objects) parent.remove(object);
  }
}
function helicopter() {
  const g = new T.Group();
  g.name = 'OH-6A-Cayuse';
  cabin(g);
  engine(g);
  skids(g);
  rotorHead(g);
  tail(g);
  details(g);
  mergeStaticFrames(g);
  addInterior(g, interiorLayout, api);
  return g;
}
/**
 * Components that should be exactly 0 (sin(PI), tube frames on an axis) come out as ~1e-16
 * noise that depends on the last bits of the math library. float32 keeps such tiny values whole,
 * so that noise reaches the GLB bytes; set it to 0. Real coordinates are orders larger.
 */
function settleZeros(object) {
  object.traverse(({ geometry }) => {
    for (const { array } of Object.values(geometry?.attributes ?? {})) {
      if (!(array instanceof Float32Array)) continue;
      for (let i = 0; i < array.length; i++) if (Math.abs(array[i]) < 1e-9) array[i] = 0;
    }
  });
  return object;
}
// source.json pins the master this generator last wrote. A master that matches neither the pin
// nor this run's output was edited by hand, and regenerating would discard that work.
const sourcePath = resolve(root, '../source.json');
const sourceText = await readFile(sourcePath, 'utf8');
const pinned = JSON.parse(sourceText).files.models.find(
  (model) => model.path === 'models/source.glb',
)?.sha256;
if (!pinned) throw new Error(`${sourcePath}: models/source.glb has no sha256 pin`);
const bytes = Buffer.from(
  await new GLTFExporter().parseAsync(settleZeros(helicopter()), {
    binary: true,
    onlyVisible: false,
  }),
);
const path = resolve(root, 'source.glb');
const current = await readFile(path).catch(() => undefined);
const hash = (buffer) => `sha256:${createHash('sha256').update(buffer).digest('hex')}`;
const generatedHash = hash(bytes);
const outIndex = process.argv.indexOf('--out');
if (outIndex !== -1) {
  const argument = process.argv[outIndex + 1];
  if (!argument || argument.startsWith('--'))
    throw new Error('--out requires a candidate GLB path');
  const candidate = resolve(argument);
  if (candidate === path || candidate === sourcePath) {
    throw new Error('--out must be separate from the source master and its source.json');
  }
  await mkdir(dirname(candidate), { recursive: true });
  await writeFile(candidate, bytes);
  console.log(`Candidate: ${candidate} ${generatedHash}`);
  process.exit(0);
}
if (current && hash(current) !== pinned && !current.equals(bytes)) {
  throw new Error(`Preserving artist edits in ${path}; move the master before regenerating.`);
}
await mkdir(root, { recursive: true });
if (!current?.equals(bytes)) await writeFile(path, bytes);
if (pinned !== generatedHash)
  await writeFile(sourcePath, sourceText.replace(pinned, generatedHash));
console.log(`oh6: ${bytes.length} bytes, ${generatedHash}`);
