/** Editable, deterministic aircraft masters. No network, bitmap textures, or private dependencies. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { addInterior } from './interior.mjs';

// GLTFExporter uses FileReader only to pack its binary buffer in Node.
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
const silver = mat('brushed-aluminum', '#9da9ae', 0.75, 0.38);
const red = mat('signal-red-paint', '#a32723', 0.2, 0.4);
const olive = mat('olive-drab', '#465544', 0.15, 0.62);
const dark = mat('cockpit-charcoal', '#172026', 0.05, 0.78);
const green = mat('interior-green', '#53624a');
const rubber = mat('rubber', '#14191b', 0, 0.92);
const white = mat('ivory-markings', '#ebe9d6', 0, 0.5);
const blue = mat('instrument-sky', '#33729c');
const brown = mat('instrument-earth', '#79583e');
const yellow = mat('warning-yellow', '#e3b63b');
const ink = mat('luminous-instrument-ink', '#dce9cd');
ink.emissive.set('#dce9cd');
ink.emissiveIntensity = 0.4;
const GLYPHS = {
  A: ['010', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  S: ['111', '100', '111', '001', '111'],
  L: ['100', '100', '100', '100', '111'],
  T: ['111', '010', '010', '010', '010'],
  R: ['110', '101', '110', '101', '101'],
  P: ['110', '101', '110', '100', '100'],
  M: ['101', '111', '111', '101', '101'],
  V: ['101', '101', '101', '101', '010'],
  H: ['101', '101', '111', '101', '101'],
  D: ['110', '101', '101', '101', '110'],
  G: ['111', '100', '101', '101', '111'],
  0: ['111', '101', '101', '101', '111'],
  3: ['111', '001', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
};
function lettering(parent, name, text, x, y, z, pixel = 0.0022) {
  const positions = [],
    normals = [],
    indices = [];
  [...text].forEach((char, c) => {
    (GLYPHS[char] ?? []).forEach((row, r) => {
      [...row].forEach((v, col) => {
        if (v !== '1') return;
        const px = x + ((text.length * 4) / 2 - c * 4 - col) * pixel,
          py = y + (2.5 - r) * pixel;
        const i = positions.length / 3;
        positions.push(
          px,
          py,
          z,
          px - pixel * 0.8,
          py,
          z,
          px - pixel * 0.8,
          py - pixel * 0.8,
          z,
          px,
          py - pixel * 0.8,
          z,
        );
        normals.push(0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1);
        indices.push(i, i + 2, i + 1, i, i + 3, i + 2);
      });
    });
  });
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  mesh(parent, name, geo, ink);
}
const glass = new T.MeshStandardMaterial({
  name: 'clear-canopy',
  color: '#a6d7e0',
  transparent: true,
  opacity: 0.22,
  metalness: 0.05,
  roughness: 0.22,
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
  return mesh(parent, name, new T.SphereGeometry(1, 28, 16), material, pos, radii);
}
function rod(parent, name, a, b, radius, material = silver) {
  const delta = new T.Vector3(...b).sub(new T.Vector3(...a));
  const obj = mesh(
    parent,
    name,
    new T.CylinderGeometry(radius, radius, delta.length(), 8),
    material,
    a,
  );
  obj.position.addScaledVector(delta, 0.5);
  obj.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
  return obj;
}
function lining(parent, name, shell, center, material) {
  // Physical sheet thickness keeps the interior visible without double-sided exterior
  // faces self-shadowing. Winding is reversed only on the inset interior surface.
  const geometry = shell.clone();
  geometry.translate(-center[0], -center[1], -center[2]);
  geometry.scale(0.975, 0.975, 0.975);
  geometry.translate(...center);
  const indices = geometry.index.array;
  for (let i = 0; i < indices.length; i += 3) {
    [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  }
  const normals = geometry.getAttribute('normal');
  for (let i = 0; i < normals.count; i++)
    normals.setXYZ(i, -normals.getX(i), -normals.getY(i), -normals.getZ(i));
  mesh(parent, name, geometry, material);
}
function loft(parent, name, stations, material, openCockpit = false) {
  const positions = [],
    indices = [],
    segments = 28;
  for (const [z, y, rx, ry] of stations)
    for (let j = 0; j <= segments; j++) {
      const a = (j / segments) * Math.PI * 2;
      if (openCockpit && z >= -1.15 - 1e-6 && z <= 0.99 + 1e-6 && j > 0 && j < 14) {
        // Bring the opaque sidewalls all the way up to the canopy's elliptical sill.
        // Removing the entire upper half left the seat and controls exposed from the side.
        const rim = 0.58 * Math.sqrt(Math.max(0, 1 - ((z + 0.08) / 1.07) ** 2));
        positions.push(Math.cos(((j - 1) / 12) * Math.PI) * rim, 2.05, z);
      } else {
        positions.push(Math.cos(a) * rx, y + Math.sin(a) * ry, z);
      }
    }
  for (let i = 0; i < stations.length - 1; i++)
    for (let j = 0; j < segments; j++) {
      if (
        openCockpit &&
        stations[i][0] >= -1.15 - 1e-6 &&
        stations[i + 1][0] <= 0.99 + 1e-6 &&
        j >= 1 &&
        j < 13
      )
        continue;
      const a = i * (segments + 1) + j,
        b = a + segments + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  if (openCockpit) lining(parent, 'fuselage-interior', geo, [0, 1.57, -0.08], green);
  return mesh(parent, name, geo, material);
}
function tube(parent, name, points, material, radius = 0.022, closed = false) {
  return mesh(
    parent,
    name,
    new T.TubeGeometry(
      new T.CatmullRomCurve3(
        points.map((p) => new T.Vector3(...p)),
        closed,
      ),
      Math.max(8, points.length * 2),
      radius,
      6,
      closed,
    ),
    material,
  );
}
function helicopterCabin(parent) {
  // One shared surface: opaque skin and glazed panels meet along the same edges.
  // A transparent whole sphere cannot stand in for the doors, roof and aft cabin.
  const latitudes = [
    0,
    0.24,
    0.48,
    0.68,
    0.88,
    1.1,
    1.32,
    1.56,
    1.7,
    1.9,
    2.12,
    2.36,
    2.62,
    2.88,
    Math.PI,
  ];
  const sides = 32;
  const point = (theta, phi) => [
    0.94 * Math.sin(theta) * Math.sin(phi),
    1.48 + 1.02 * Math.cos(theta),
    0.48 + 1.53 * Math.sin(theta) * Math.cos(phi),
  ];
  const panel = (i, j) => {
    if (i < 0 || i >= latitudes.length - 1) return 'skin';
    const theta = (latitudes[i] + latitudes[i + 1]) / 2;
    const phi = Math.abs(-Math.PI + ((((j + sides) % sides) + 0.5) * Math.PI * 2) / sides);
    if (phi < (Math.PI * 3) / 8 && theta > 0.48 && theta < 2.12) return 'windshield';
    if (phi < (Math.PI * 5) / 8 && theta > 0.88 && theta < 1.56) return 'door-window';
    return 'skin';
  };
  const buffers = {
    skin: { positions: [], normals: [], indices: [] },
    glass: { positions: [], normals: [], indices: [] },
  };
  for (let i = 0; i < latitudes.length - 1; i++) {
    for (let j = 0; j < sides; j++) {
      const a = latitudes[i],
        b = latitudes[i + 1];
      const c = -Math.PI + (j * Math.PI * 2) / sides,
        d = c + (Math.PI * 2) / sides;
      const kind = panel(i, j),
        buffer = buffers[kind === 'skin' ? 'skin' : 'glass'];
      const start = buffer.positions.length / 3;
      for (const [theta, phi] of [
        [a, c],
        [b, c],
        [b, d],
        [a, d],
      ]) {
        const p = point(theta, phi);
        buffer.positions.push(...p);
        buffer.normals.push(
          ...new T.Vector3(p[0] / 0.94 ** 2, (p[1] - 1.48) / 1.02 ** 2, (p[2] - 0.48) / 1.53 ** 2)
            .normalize()
            .toArray(),
        );
      }
      if (i > 0) buffer.indices.push(start, start + 1, start + 3);
      if (i < latitudes.length - 2) buffer.indices.push(start + 1, start + 2, start + 3);
      if (kind !== panel(i, j + 1) || (j === sides / 2 - 1 && kind === 'windshield')) {
        tube(parent, 'glazing-upright', [point(a, d), point((a + b) / 2, d), point(b, d)], olive);
      }
      if (kind !== panel(i + 1, j)) {
        tube(parent, 'glazing-rail', [point(b, c), point(b, (c + d) / 2), point(b, d)], olive);
      }
    }
  }
  for (const [kind, buffer] of Object.entries(buffers)) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(buffer.positions, 3));
    geometry.setAttribute('normal', new T.Float32BufferAttribute(buffer.normals, 3));
    geometry.setIndex(buffer.indices);
    mesh(
      parent,
      kind === 'skin' ? 'cabin-panels' : 'cabin-canopy-windows',
      geometry,
      kind === 'skin' ? olive : glass,
    );
    if (kind === 'skin') lining(parent, 'cabin-interior', geometry, [0, 1.48, 0.48], green);
  }
  for (const side of [-1, 1]) {
    const phi = (side * Math.PI * 5) / 8;
    tube(
      parent,
      'door-aft-seam',
      [1.56, 1.7, 1.9, 2.12, 2.36].map((theta) => point(theta, phi)),
      dark,
      0.008,
    );
    const handle = point(1.68, side * 1.78);
    rod(
      parent,
      'door-handle',
      [handle[0] + side * 0.02, handle[1], handle[2] - 0.08],
      [handle[0] + side * 0.02, handle[1], handle[2] + 0.08],
      0.016,
      dark,
    );
  }
}
function wing(parent, name, outline, height, thickness, material = silver) {
  const shape = new T.Shape();
  outline.forEach(([x, z], i) => {
    if (i) shape.lineTo(x, -z);
    else shape.moveTo(x, -z);
  });
  shape.closePath();
  const geo = new T.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSize: 0.035,
    bevelThickness: 0.025,
    bevelSegments: 1,
    steps: 1,
  });
  geo.rotateX(-Math.PI / 2);
  return mesh(parent, name, geo, material, [0, height, 0]);
}

function mustang() {
  const g = new T.Group();
  g.name = 'P-51D-Mustang';
  const cockpitStations = Array.from({ length: 15 }, (_, i) => {
    const z = -0.08 + 1.07 * Math.sin(-Math.PI / 2 + (i * Math.PI) / 14);
    const t = (z + 1.15) / 2.14;
    return [z, 1.57, 0.54 + t * 0.03, 0.6 + t * 0.03];
  });
  loft(
    g,
    'fuselage',
    [
      [-4.98, 1.42, 0.015, 0.06],
      [-4.4, 1.45, 0.15, 0.3],
      [-3.2, 1.52, 0.31, 0.44],
      ...cockpitStations,
      [2.5, 1.58, 0.51, 0.57],
      [3.9, 1.58, 0.38, 0.41],
      [4.35, 1.58, 0.3, 0.3],
    ],
    silver,
    true,
  );
  loft(
    g,
    'red-engine-cowl',
    [
      [3.65, 1.58, 0.425, 0.46],
      [4.35, 1.58, 0.31, 0.32],
    ],
    red,
  );
  box(g, 'anti-glare-panel', [0.65, 0.025, 2.5], [0, 2.13, 2.15], olive);
  sphere(g, 'ventral-radiator', [0.42, 0.38, 0.86], [0, 0.88, -0.68], silver);
  box(g, 'radiator-inlet', [0.6, 0.25, 0.04], [0, 0.86, 0.11], dark);
  for (const side of [-1, 1]) {
    wing(
      g,
      `wing-${side}`,
      [
        [side * 0.4, 1.65],
        [side * 2.3, 1.4],
        [side * 5.58, 0.45],
        [side * 5.6, -0.45],
        [side * 4.7, -0.86],
        [side * 0.4, -1.0],
      ],
      1.03,
      0.12,
    );
    wing(
      g,
      `tailplane-${side}`,
      [
        [side * 0.1, -3.35],
        [side * 2, -4.0],
        [side * 2, -4.5],
        [side * 0.1, -4.5],
      ],
      1.55,
      0.065,
    );
    const flap = group(g, `flap-${side}`, [side * 1.75, 1.08, -0.83]);
    box(flap, 'flap-surface', [1.9, 0.05, 0.31], [0, 0, -0.12], silver);
    const aileron = group(g, `aileron-${side}`, [side * 4.0, 1.08, -0.69]);
    box(aileron, 'aileron-surface', [1.9, 0.045, 0.25], [0, 0, 0], silver);
    for (let i = 0; i < 6; i++)
      rod(
        g,
        `exhaust-${side}-${i}`,
        [side * 0.48, 1.73, 2.6 - i * 0.18],
        [side * 0.62, 1.71, 2.5 - i * 0.18],
        0.045,
        dark,
      );
    for (let i = 0; i < 3; i++)
      box(
        g,
        `recognition-stripe-${side}-${i}`,
        [0.25, 0.014, 1.75],
        [side * (2.65 + i * 0.4), 1.19, 0.05],
        i % 2 ? white : dark,
      );
    const gear = group(g, `gear-${side}`, [side * 1.65, 1.08, 0.95]);
    rod(gear, 'oleo-strut', [0, 0, 0], [side * 0.1, -0.65, 0.05], 0.055);
    const wheel = mesh(gear, 'main-wheel', new T.CylinderGeometry(0.34, 0.34, 0.21, 20), rubber, [
      side * 0.1,
      -0.73,
      0.05,
    ]);
    wheel.rotation.z = Math.PI / 2;
    box(gear, 'gear-door', [0.22, 0.62, 0.055], [0, -0.28, 0], silver);
  }
  const fin = wing(
    g,
    'vertical-fin',
    [
      [0, -3.1],
      [1.55, -4.1],
      [1.55, -4.5],
      [0, -4.65],
    ],
    0,
    0.09,
    red,
  );
  fin.rotation.z = Math.PI / 2;
  fin.position.y = 1.68;
  const tailWheel = mesh(
    g,
    'tail-wheel',
    new T.CylinderGeometry(0.17, 0.17, 0.12, 16),
    rubber,
    [0, 0.18, -4],
  );
  tailWheel.rotation.z = Math.PI / 2;
  rod(g, 'tail-strut', [0, 0.26, -4], [0, 1.22, -3.9], 0.035);
  const canopy = mesh(
    g,
    'bubble-canopy',
    new T.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    glass,
    [0, 2.05, -0.08],
    [0.58, 0.65, 1.07],
  );
  canopy.renderOrder = 2;
  tube(
    g,
    'cockpit-sill',
    Array.from({ length: 28 }, (_, i) => {
      const a = (i * Math.PI * 2) / 28;
      return [0.58 * Math.cos(a), 2.05, -0.08 + 1.07 * Math.sin(a)];
    }),
    silver,
    0.018,
    true,
  );
  for (const z of [-0.91, 0.66]) {
    const points = [];
    const radius = Math.sqrt(1 - ((z + 0.08) / 1.07) ** 2);
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI;
      points.push(
        new T.Vector3(Math.cos(a) * 0.58 * radius, 2.05 + Math.sin(a) * 0.65 * radius, z),
      );
    }
    mesh(
      g,
      'canopy-frame',
      new T.TubeGeometry(new T.CatmullRomCurve3(points), 20, 0.02, 6, false),
      silver,
    );
  }
  tube(
    g,
    'windscreen-divider',
    [0.66, 0.78, 0.88, 0.96, 0.99].map((z) => [
      0,
      2.05 + 0.65 * Math.sqrt(Math.max(0, 1 - ((z + 0.08) / 1.07) ** 2)),
      z,
    ]),
    silver,
    0.018,
  );
  addInterior(g, interiorLayout, {
    group,
    box,
    rod,
    sphere,
    mesh,
    lettering,
    silver,
    dark,
    white,
    yellow,
    blue,
    brown,
    green,
    rubber,
    olive,
  });
  const prop = group(g, 'propeller', [0, 1.58, 4.36]);
  for (let i = 0; i < 4; i++) {
    const blade = group(prop, `prop-blade-${i}`);
    blade.rotation.z = (i * Math.PI) / 2;
    box(blade, 'blade', [0.16, 1.48, 0.05], [0.05, 0.84, 0], dark);
    box(blade, 'blade-tip', [0.16, 0.14, 0.056], [0.05, 1.54, 0], yellow);
  }
  const spinner = mesh(g, 'spinner', new T.ConeGeometry(0.32, 0.49, 24), red, [0, 1.58, 4.59]);
  spinner.rotation.x = Math.PI / 2;
  return g;
}
function _helicopter() {
  const g = new T.Group();
  g.name = 'OH-6';
  helicopterCabin(g);
  sphere(g, 'engine-housing', [0.76, 0.65, 0.89], [0, 1.8, -0.83], olive);
  loft(
    g,
    'tail-boom',
    [
      [-4.99, 1.81, 0.06, 0.07],
      [-4.3, 1.78, 0.1, 0.12],
      [-1.45, 1.62, 0.28, 0.3],
    ],
    olive,
  );
  for (const side of [-1, 1]) {
    rod(g, 'skid', [side * 1.02, 0.08, -1.22], [side * 1.02, 0.08, 1.48], 0.06, dark);
    rod(g, 'skid-toe', [side * 1.02, 0.08, 1.48], [side * 1.02, 0.23, 1.86], 0.06, dark);
    for (const z of [-0.7, 0.9])
      rod(g, 'skid-strut', [side * 0.57, 0.82, z], [side * 1.02, 0.12, z], 0.045, silver);
  }
  rod(g, 'rotor-mast', [0, 2.12, -0.25], [0, 2.6, -0.25], 0.09, silver);
  const rotor = group(g, 'main-rotor', [0, 2.64, -0.25]);
  for (let i = 0; i < 5; i++) {
    const blade = group(rotor, `rotor-blade-${i}`);
    blade.rotation.y = (i / 5) * Math.PI * 2;
    box(blade, 'rotor-airfoil', [3.72, 0.035, 0.17], [2.16, 0, 0], dark);
    box(blade, 'rotor-tip', [0.18, 0.04, 0.18], [3.91, 0, 0], yellow);
  }
  const tailFin = box(g, 'tail-fin', [0.07, 1.27, 0.54], [0, 1.79, -4.53], olive);
  tailFin.rotation.x = -0.16;
  box(g, 't-tail', [1.65, 0.055, 0.4], [0, 2.4, -4.47], olive);
  const tail = group(g, 'tail-rotor', [-0.18, 1.84, -4.58]);
  rod(tail, 'tail-hub', [-0.08, 0, 0], [0.08, 0, 0], 0.055);
  for (let i = 0; i < 1; i++) {
    const blade = box(tail, `tail-blade-${i}`, [0.04, 1.26, 0.12], [0, 0, 0], dark);
    blade.rotation.x = (i * Math.PI) / 2;
  }
  rod(g, 'exhaust', [-0.3, 2.0, -1.17], [-0.3, 2.17, -1.65], 0.14, dark);
  addInterior(g, interiorLayout, {
    group,
    box,
    rod,
    sphere,
    mesh,
    lettering,
    silver,
    dark,
    white,
    yellow,
    blue,
    brown,
    green,
    rubber,
    olive,
  });
  const collective = group(g, 'collective', [-0.68, 0.74, 0.67]);
  rod(collective, 'collective-lever', [0, 0, 0], [0, 0.16, 0.4], 0.022, dark);
  return g;
}
const baselinePath = resolve(root, 'baseline.json');
let baseline = {};
try {
  baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
} catch {}
const bytes = Buffer.from(
  await new GLTFExporter().parseAsync(mustang(), { binary: true, onlyVisible: false }),
);
const path = resolve(root, 'source.glb');
const current = await readFile(path).catch(() => undefined);
const hash = (buffer) => createHash('sha256').update(buffer).digest('hex');
const generatedHash = hash(bytes);
const outIndex = process.argv.indexOf('--out');
if (outIndex !== -1) {
  const argument = process.argv[outIndex + 1];
  if (!argument || argument.startsWith('--'))
    throw new Error('--out requires a candidate GLB path');
  const candidate = resolve(argument);
  if (candidate === path || candidate === baselinePath) {
    throw new Error('--out must be separate from the source master and reviewed baseline');
  }
  await mkdir(dirname(candidate), { recursive: true });
  await writeFile(candidate, bytes);
  console.log(`Candidate: ${candidate} sha256:${generatedHash}`);
  process.exit(0);
}
if (baseline.sha256 !== undefined && generatedHash !== baseline.sha256) {
  throw new Error(
    `Generated model changed from the reviewed baseline (${baseline.sha256} -> ${generatedHash}); inspect it before updating baseline.json.`,
  );
}
if (current && hash(current) !== baseline.sha256 && !current.equals(bytes)) {
  throw new Error(`Preserving artist edits in ${path}; move the master before regenerating.`);
}
await mkdir(root, { recursive: true });
await writeFile(path, bytes);
baseline = { sha256: generatedHash };
await writeFile(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
console.log(`p51d: ${bytes.length} bytes, sha256:${baseline.sha256}`);
