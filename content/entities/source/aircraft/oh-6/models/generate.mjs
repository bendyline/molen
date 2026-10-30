/**
 * Deterministic OH-6A master. Four main blades, two tail blades and the original braced tail.
 *
 * Proportions follow the Army 3-view and photographs of the OH-6A: a slim egg cabin about 3.5 m
 * long, 1.48 m wide and 1.68 m tall (its roof about 2.1 m above the skids), the rotor hub about
 * 2.5 m up and 1.97 m behind the nose, short skids that end just behind the rear cross tube, a
 * flat belly that sweeps up into a tail cone ending in the exhaust face under the boom root, and a
 * boom that grows out of the egg's upper rear. The tail has a swept upper fin, a ventral fin with a tail skid, and a single
 * stabilizer on the right side with strong dihedral, braced to the upper fin; the two-blade tail
 * rotor turns on the left. Node names stay as entity.types.json binds them: `tail-stabilizer--1`
 * and `tail-brace--1` are the right stabilizer and its strut, `tail-stabilizer-1` is the ventral fin
 * and `tail-brace-1` its tail skid. The pilot eye (-0.38, 1.7, 0.6) and cockpit come from interior.mjs.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { completeCockpitControls } from '../../../../../../packages/entities/scripts/aircraft/cockpit-controls.mjs';
import {
  embedCockpitTextures,
  finishAircraftCockpit,
  writeCockpitTextures,
} from '../../../../../../packages/entities/scripts/aircraft/cockpit-surfaces.mjs';
import { addRivetRows } from '../../../../../../packages/entities/scripts/vehicle-detail.mjs';
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
// The egg: centre and semi-axes (x half width, y half height, z half length).
const EGG = { y: 1.24, z: 0.26, rx: 0.74, ry: 0.84, rz: 1.73 };
const point = (theta, phi, lift = 0) => [
  (EGG.rx + lift) * Math.sin(theta) * Math.sin(phi),
  EGG.y + (EGG.ry + lift) * Math.cos(theta),
  EGG.z + (EGG.rz + lift) * Math.sin(theta) * Math.cos(phi),
];
/** Half width of the egg at height y and station z (0 outside it). */
const eggHalfWidth = (y, z) =>
  EGG.rx * Math.sqrt(Math.max(0, 1 - ((y - EGG.y) / EGG.ry) ** 2 - ((z - EGG.z) / EGG.rz) ** 2));
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
  // Glazing follows the same egg surface as the opaque doors. Army 3-view and right-side photo,
  // at the waist behind the nose: windscreen to 0.55 m, oval front-door window to 1.4 m, a post,
  // then the smaller rear-door window from 1.55 to 2.2 m (about 1.4-1.75 m up); the engine bay
  // behind it is unglazed. Boundaries are egg azimuths.
  const phiCount = 80;
  const [screenEnd, doorEnd, aftStart, aftEnd] = [0.261, 0.441, 0.467, 0.588].map(
    (v) => v * Math.PI,
  );
  const kind = (phi) => {
    const a = Math.abs(phi);
    return a <= screenEnd
      ? 'windshield'
      : a <= doorEnd
        ? 'door'
        : a >= aftStart && a <= aftEnd
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
      const u = (a - (screenEnd + doorEnd) / 2) / ((doorEnd - screenEnd) / 2);
      top = 0.68 + 0.2 * u * u;
      bottom = 1.65 - 0.1 * u * u;
    }
    if (k === 'aft-window') {
      const u = (a - (aftStart + aftEnd) / 2) / ((aftEnd - aftStart) / 2);
      top = 0.9 + 0.12 * u * u;
      bottom = 1.42 - 0.08 * u * u;
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
      // Extra rows keep the flat facets below the glazing from cutting into the slim egg.
      bottom + (2.38 - bottom) / 3,
      bottom + ((2.38 - bottom) * 2) / 3,
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
  // The lower windscreen is split by a painted centre panel about 0.17 m wide (OH-6A head-on
  // photo) that carries the round nose vent and the landing light.
  const post = 0.036 * Math.PI;
  const boundaries = [0, post, screenEnd, doorEnd, aftStart, aftEnd, Math.PI].flatMap((v) => [
    -v,
    v,
  ]);
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
      const glazed =
        k !== 'skin' && i >= 3 && i < 7 && !(k === 'windshield' && Math.abs(mid) < post && i >= 5);
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
          ...new T.Vector3(
            p[0] / EGG.rx ** 2,
            (p[1] - EGG.y) / EGG.ry ** 2,
            (p[2] - EGG.z) / EGG.rz ** 2,
          )
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
  // Round fresh-air vent and landing light on the centre panel, set into the skin.
  const [, , , , , rail, , sill] = cuts(0);
  for (const [name, theta, radius, material] of [
    ['nose-air-vent', rail + 0.13, 0.06, dark],
    ['nose-landing-light', sill - 0.14, 0.045, white],
  ]) {
    const p = point(theta, 0),
      n = new T.Vector3(
        p[0] / EGG.rx ** 2,
        (p[1] - EGG.y) / EGG.ry ** 2,
        (p[2] - EGG.z) / EGG.rz ** 2,
      ).normalize();
    const lens = mesh(
      parent,
      name,
      new T.CylinderGeometry(radius, radius, 0.03, 20),
      material,
      new T.Vector3(...p).addScaledVector(n, 0.004).toArray(),
    );
    lens.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), n);
    const rim = mesh(
      parent,
      'nose-lens-rim',
      new T.TorusGeometry(radius + 0.008, 0.008, 6, 20),
      olive,
      new T.Vector3(...p).addScaledVector(n, 0.016).toArray(),
    );
    rim.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), n);
  }
  for (const [name, data] of buffers) {
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(data.positions, 3));
    geo.setAttribute('normal', new T.Float32BufferAttribute(data.normals, 3));
    geo.setIndex(data.indices);
    mesh(parent, name, geo, name === 'cabin-panels' ? olive : glass);
    if (name === 'cabin-panels') lining(parent, 'cabin-interior', geo, [0, EGG.y, EGG.z], green);
  }
  for (const side of [-1, 1]) {
    const [, , , , , rail, , sill] = cuts(side * post);
    tube(
      parent,
      'glazing-upright',
      Array.from({ length: 8 }, (_, i) =>
        point(rail + ((sill - rail) * i) / 7, side * post, 0.004),
      ),
      olive,
      0.014,
    );
    for (const phi of [0, screenEnd, doorEnd, aftStart, aftEnd]) {
      const [, , , top, , rail, , bottom] = cuts(side * (phi + (phi === 0 ? 0 : -1e-6)));
      // The centre post stops at the cross rail, above the painted centre panel.
      const end = phi === 0 ? rail : bottom;
      tube(
        parent,
        'glazing-upright',
        Array.from({ length: 14 }, (_, i) =>
          point(top + ((end - top) * i) / 13, side * phi, 0.005),
        ),
        olive,
        phi === 0 ? 0.018 : 0.022,
      );
    }
    // Full door outline continues below its arched window to the belly sill.
    // Door seams and cowl fasteners (3–4 mm) are not modelled: sub-pixel detail at medium-fi.
    const handle = point(1.82, side * (doorEnd - 0.08), 0.018);
    rod(
      parent,
      `door-handle-${side}`,
      [handle[0], handle[1], handle[2] - 0.065],
      [handle[0], handle[1], handle[2] + 0.065],
      0.013,
      dark,
    );
    for (const theta of [1.13, 1.77]) {
      const p = point(theta, side * (aftEnd + 0.08), 0.015);
      box(parent, `door-hinge-${side}-${theta}`, [0.025, 0.035, 0.06], p, silver);
    }
    sphere(
      parent,
      `navigation-light-${side}`,
      [0.03, 0.025, 0.03],
      [side * (eggHalfWidth(1.2, -0.27) + 0.01), 1.2, -0.27],
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
  // Close both ends: the boom's tip, and its root buried in the cabin.
  for (const [k, flip] of [
    [0, false],
    [stations.length - 1, true],
  ]) {
    const [z, y] = stations[k];
    const centre = vertices.length / 3;
    vertices.push(0, y, z);
    for (let i = 0; i < n; i++) {
      const a = k * (n + 1) + i;
      indices.push(...(flip ? [centre, a + 1, a] : [centre, a, a + 1]));
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return mesh(parent, name, geo, material);
}
/** Extruded side outline; `bevel` rounds its edges (it adds to the outline and the width). */
function fin(parent, name, outline, width, material = olive, bevel = 0.005) {
  const shape = new T.Shape();
  outline.forEach(([z, y], i) => {
    if (i) shape.lineTo(z, y);
    else shape.moveTo(z, y);
  });
  shape.closePath();
  const geo = new T.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel * 0.8,
    bevelSegments: bevel > 0.01 ? 3 : 2,
    steps: 1,
  });
  // Shape XY is authored as ZY, extrusion becomes X.
  geo.rotateY(-Math.PI / 2);
  geo.translate(width / 2, 0, 0);
  return mesh(parent, name, geo, material);
}
/**
 * Tapered tail surface through chord lines ([leading edge, trailing edge] points, root first):
 * symmetric NACA 00xx sections offset along `normal`, rounded leading edge, capped ends.
 */
function airfoil(parent, name, chords, thickness, normal, material = olive) {
  const us = [0, 0.03, 0.1, 0.22, 0.4, 0.62, 0.82, 1],
    half = (u) =>
      thickness *
      5 *
      (0.2969 * Math.sqrt(u) -
        0.126 * u -
        0.3516 * u * u +
        0.2843 * u * u * u -
        0.1036 * u * u * u * u),
    n = new T.Vector3(...normal).normalize(),
    ring = [
      ...us.map((u) => [u, 1]),
      ...us
        .slice(1, -1)
        .map((u) => [u, -1])
        .reverse(),
    ],
    count = ring.length,
    vertices = [],
    indices = [];
  for (const [le, te] of chords) {
    const a = new T.Vector3(...le),
      b = new T.Vector3(...te),
      chord = a.distanceTo(b);
    for (const [u, side] of ring)
      vertices.push(
        ...a
          .clone()
          .lerp(b, u)
          .addScaledVector(n, side * half(u) * chord)
          .toArray(),
      );
  }
  for (let k = 0; k < chords.length - 1; k++)
    for (let i = 0; i < count; i++) {
      const a = k * count + i,
        b = k * count + ((i + 1) % count);
      indices.push(a, a + count, b, b, a + count, b + count);
    }
  for (const [k, flip] of [
    [0, true],
    [chords.length - 1, false],
  ]) {
    const centre = vertices.length / 3;
    const c = new T.Vector3();
    for (let i = 0; i < count; i++) c.add(new T.Vector3().fromArray(vertices, (k * count + i) * 3));
    vertices.push(...c.multiplyScalar(1 / count).toArray());
    for (let i = 0; i < count; i++) {
      const a = k * count + i,
        b = k * count + ((i + 1) % count);
      indices.push(...(flip ? [centre, b, a] : [centre, a, b]));
    }
  }
  // Wind outward: the first upper-surface panel must face along `normal`.
  const p = (i) => new T.Vector3().fromArray(vertices, i * 3);
  const face = p(count)
    .sub(p(0))
    .cross(p(1).sub(p(0)));
  if (face.dot(n) < 0)
    for (let i = 0; i < indices.length; i += 3)
      [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return mesh(parent, name, geo, material);
}
function engine(parent) {
  // The rear cabin skin already supplies the cowl; remove the old second oversized sphere.
  // Low transmission and engine fairing on the cabin roof, running back into the boom's top.
  fin(
    parent,
    'transmission-fairing',
    // Army 3-view: from just ahead of the mast (z 0.21) back to z -1.4, 2.25 m high. Rounded
    // edges (photos): the 4 cm bevel brings the outline back to that size and 0.48 m wide.
    [
      [0.21, 1.97],
      [0.1, 2.21],
      [-1.22, 2.21],
      [-1.37, 1.9],
    ],
    0.416,
    olive,
    0.04,
  );
  for (const side of [-1, 1]) {
    box(
      parent,
      `engine-air-intake-${side}`,
      [0.014, 0.16, 0.38],
      [side * 0.257, 2.06, -0.76],
      dark,
    );
    for (let i = 0; i < 7; i++)
      box(
        parent,
        `intake-louver-${side}-${i}`,
        [0.017, 0.009, 0.37],
        [side * 0.27, 1.993 + i * 0.022, -0.76],
        olive,
      );
  }
  // The tailpipe opens aft through the tail cone's end face, under the boom root.
  const exit = group(parent, 'exhaust-outlet', [0, 0.875, -1.492]);
  // A short straight run inside the tail cone to the mouth in its end face.
  const bend = new T.CatmullRomCurve3(
    [
      [0, 0.13, 0.21],
      [0, 0.11, 0.06],
      [0, 0.105, -0.1],
      [0, 0.12, -0.29],
    ].map((p) => new T.Vector3(...p)),
  );
  mesh(exit, 'exhaust-pipe', new T.TubeGeometry(bend, 20, 0.145, 24, false), exhaustMetal);
  const mouth = mesh(
    exit,
    'exhaust-dark-opening',
    new T.CircleGeometry(0.134, 32),
    dark,
    [0, 0.12, -0.298],
  );
  mouth.rotation.y = Math.PI;
  mesh(
    exit,
    'exhaust-lip',
    new T.TorusGeometry(0.143, 0.012, 8, 32),
    exhaustMetal,
    [0, 0.12, -0.293],
  );
  rod(exit, 'exhaust-divider', [0, -0.025, -0.3], [0, 0.265, -0.3], 0.009, exhaustMetal);
}
function rotorHead(parent) {
  // Hub about 2.5 m above the skids and 1.97 m behind the nose (Army 3-view), on a mast rising
  // out of the front of the transmission fairing.
  rod(parent, 'rotor-mast', [0, 2.12, 0.02], [0, 2.4, 0.02], 0.049, silver);
  const swash = group(parent, 'swashplate', [0, 2.25, 0.02]);
  for (const y of [0, 0.055])
    mesh(
      swash,
      'swashplate-ring',
      new T.TorusGeometry(0.135, 0.018, 8, 24).rotateX(Math.PI / 2),
      silver,
      [0, y, 0],
    );
  sphere(parent, 'mast-boot', [0.085, 0.11, 0.085], [0, 2.2, 0.02], rubber);
  const rotor = group(parent, 'main-rotor', [0, 2.4, 0.02]);
  const cap = mesh(rotor, 'rotor-head', new T.CylinderGeometry(0.09, 0.12, 0.1, 16), dark);
  cap.position.y = 0.03;
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
// Boom stations, tail to root: z, centre height, half width, half height. The root is buried in
// the egg's upper rear, so the boom grows out of the cabin as on the real airframe.
const BOOM = [
  [-4.62, 1.5, 0.065, 0.075],
  [-4.2, 1.52, 0.085, 0.1],
  [-3.0, 1.58, 0.13, 0.15],
  [-2.0, 1.57, 0.18, 0.3],
  [-1.8, 1.5, 0.19, 0.37],
  [-1.45, 1.55, 0.3, 0.38],
  [-0.7, 1.5, 0.32, 0.36],
];
// Army 3-view belly line, nose to tail: z, height. The belly stays flat (0.41-0.42 m) to behind the
// rear cross tube, then sweeps up to the exhaust face at z -1.78 under the boom root.
const BELLY = [
  [0.1, 0.4],
  [-0.45, 0.41],
  [-0.93, 0.42],
  [-1.15, 0.5],
  [-1.4, 0.61],
  [-1.58, 0.71],
  [-1.67, 0.77],
  [-1.78, 0.83],
];
/**
 * Belly fairing and tail cone: the egg's lower half stretched down to the belly line, so it grows
 * tangentially out of the egg's sides (just inside the egg at its waist, where the open top edge
 * hides). Aft of the egg it narrows inside the boom root to the exhaust face. Open-topped, so no
 * surface crosses the cabin.
 */
function tailCone(parent) {
  const K = 10,
    at = (z) => {
      const k = BELLY.findIndex((_, i) => i === BELLY.length - 2 || z >= BELLY[i + 1][0]);
      const [z0, y0] = BELLY[k],
        [z1, y1] = BELLY[k + 1];
      return y0 + ((y1 - y0) * (z - z0)) / (z1 - z0);
    };
  const sections = [
    0.1, -0.1, -0.3, -0.5, -0.7, -0.85, -0.95, -1.05, -1.15, -1.25, -1.32, -1.4, -1.5, -1.6, -1.7,
    -1.78,
  ].map((z) => {
    const s2 = Math.max(0, 1 - ((z - EGG.z) / EGG.rz) ** 2),
      boom = boomAt(z);
    // From z -1.15 aft the section blends from the egg's lower half to one inside the boom root,
    // its sides rising to the boom's axis.
    const u = Math.min(1, Math.max(0, (-1.15 - z) / 0.45)),
      t = u * u * (3 - 2 * u),
      yc = EGG.y - 0.14 * t,
      w = (1 - t) * 0.985 * EGG.rx * Math.sqrt(s2) + t * Math.max(0.95 * boom.rx, 0.23),
      top = yc + t * (boom.y - yc),
      low = yc - at(z);
    const arc = (k, side) => {
      const a = (Math.PI / 2) * (k / K);
      return [side * w * Math.sin(a), yc - low * Math.cos(a)];
    };
    return {
      z,
      points: [
        [w, top],
        ...Array.from({ length: K + 1 }, (_, k) => arc(K - k, 1)),
        ...Array.from({ length: K }, (_, k) => arc(k + 1, -1)),
        [-w, top],
      ],
    };
  });
  const count = 2 * K + 3,
    vertices = sections.flatMap(({ z, points }) => points.flatMap(([x, y]) => [x, y, z])),
    indices = [];
  for (let k = 0; k < sections.length - 1; k++)
    for (let i = 0; i < count - 1; i++) {
      const a = k * count + i,
        b = a + count;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  // The exhaust face closes the tail end.
  const last = (sections.length - 1) * count,
    centre = vertices.length / 3,
    face = sections.at(-1).points;
  vertices.push(
    face.reduce((sum, p) => sum + p[0], 0) / count,
    face.reduce((sum, p) => sum + p[1], 0) / count,
    sections.at(-1).z,
  );
  for (let i = 0; i < count; i++) indices.push(centre, last + i, last + ((i + 1) % count));
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  // Part of the cabin shell (and its paint), merged with the egg panels.
  return mesh(parent, 'cabin-panels', geo, olive);
}
/** Boom section at z (linear between stations): centre height, half width, half height. */
function boomAt(z) {
  for (let k = 0; k < BOOM.length - 1; k++) {
    const [z0, y0, rx0, ry0] = BOOM[k],
      [z1, y1, rx1, ry1] = BOOM[k + 1];
    if (z <= z1 || k === BOOM.length - 2) {
      const t = Math.max(0, Math.min(1, (z - z0) / (z1 - z0)));
      return { y: y0 + (y1 - y0) * t, rx: rx0 + (rx1 - rx0) * t, ry: ry0 + (ry1 - ry0) * t };
    }
  }
}
function tail(parent) {
  loft(parent, 'tail-boom', BOOM, olive);
  tailCone(parent);
  // Swept upper fin: a tapered airfoil with a rounded leading edge, not a flat plate.
  airfoil(
    parent,
    'tail-fin',
    [
      [
        [0, 1.55, -4.36],
        [0, 1.5, -4.68],
      ],
      [
        [0, 2.6, -4.86],
        [0, 2.62, -5.03],
      ],
    ],
    0.13,
    [1, 0, 0],
  );
  // Ventral fin (bound as `tail-stabilizer-1`) with its tubular tail skid (`tail-brace-1`).
  airfoil(
    parent,
    'tail-stabilizer-1',
    [
      [
        [0, 1.47, -4.4],
        [0, 1.48, -4.66],
      ],
      [
        [0, 0.86, -4.49],
        [0, 0.88, -4.73],
      ],
    ],
    0.13,
    [1, 0, 0],
  );
  tube(
    parent,
    'tail-brace-1',
    [
      [0, 0.9, -4.52],
      [0, 0.81, -4.6],
      [0, 0.8, -4.74],
      [0, 0.85, -4.82],
    ],
    olive,
    0.012,
  );
  // The single horizontal stabilizer stands out to the right with strong dihedral, braced to the
  // upper fin; the tail rotor turns on the left.
  // About 28 degrees of dihedral: the tip stands 0.54 m above the root.
  airfoil(
    parent,
    'tail-stabilizer--1',
    [
      [
        [0, 1.58, -4.36],
        [0, 1.58, -4.73],
      ],
      [
        [-1.015, 2.12, -4.41],
        [-0.998, 2.11, -4.7],
      ],
    ],
    0.12,
    [0.47, 0.883, 0],
  );
  // Tail-rotor gearbox fairing at the boom end, on the rotor side.
  sphere(parent, 'tail-boom', [0.07, 0.075, 0.13], [0.04, 1.5, -4.5], olive);
  rod(parent, 'tail-brace--1', [0, 2.15, -4.76], [-0.61, 1.93, -4.57], 0.016, olive);
  const rotor = group(parent, 'tail-rotor', [0.16, 1.5, -4.48]);
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
      // Short skids: they end just behind the rear cross tube and turn up under the nose.
      [
        [side * 0.99, 0.055, -0.62],
        [side * 0.99, 0.055, 0.6],
        [side * 0.99, 0.062, 1.3],
        [side * 0.99, 0.11, 1.6],
        [side * 0.99, 0.22, 1.77],
      ],
      olive,
      0.045,
    );
    for (const z of [-0.45, 0.85]) {
      // Straight faired leg, splayed about 53 degrees (head-on photo), from just inside the
      // lower egg down to the skid.
      let t = 0;
      while (0.99 - (t + 0.01) * 0.6 > eggHalfWidth(0.12 + (t + 0.01) * 0.8, z) - 0.03) t += 0.01;
      tube(
        parent,
        `skid-cross-tube-${side}-${z}`,
        [
          [side * (0.99 - t * 0.6), 0.12 + t * 0.8, z],
          [side * 0.99, 0.12, z],
        ],
        olive,
        0.042,
      );
      box(parent, 'skid-saddle', [0.12, 0.025, 0.09], [side * 0.99, 0.094, z], silver);
    }
    box(parent, `skid-step-${side}`, [0.08, 0.025, 0.3], [side * 0.86, 0.3, 0.72], dark);
  }
}
function details(parent) {
  for (const side of [-1, 1]) {
    const markings = group(parent, `tail-markings-${side}`, [side * 0.142, 1.6, -2.9]);
    // Text initially faces -Z; the local face rotates outward on either boom side.
    markings.rotation.y = side === 1 ? -Math.PI / 2 : Math.PI / 2;
    const stencil = text(markings, 'army-stencil', 'UNITED STATES ARMY', 0, 0, 0, 0.022, dark);
    markings.updateMatrixWorld(true);
    const positions = stencil.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const p = new T.Vector3()
        .fromBufferAttribute(positions, i)
        .applyMatrix4(markings.matrixWorld);
      // Wrap the lettering round the boom's section at its station.
      const { y, rx, ry } = boomAt(p.z);
      const dy = p.y - 1.6;
      p.set(side * (rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2)) + 0.003), y + dy, p.z);
      positions.setXYZ(i, ...p.toArray());
    }
    stencil.geometry.computeVertexNormals();
    stencil.geometry.computeBoundingBox();
    stencil.geometry.computeBoundingSphere();
    parent.add(stencil);
    parent.remove(markings);
    const serial = group(parent, `serial-markings-${side}`, [side * 0.252, 2.08, -0.83]);
    serial.rotation.y = side === 1 ? -Math.PI / 2 : Math.PI / 2;
    text(serial, 'aircraft-serial', '16172', 0, 0, 0, 0.017, dark);
  }
  rod(parent, 'belly-antenna', [0, 0.45, -0.1], [0, 0.18, 0.16], 0.009, dark);
  const antenna = boomAt(-2.66);
  rod(
    parent,
    'tail-antenna',
    [0, antenna.y - antenna.ry + 0.02, -2.66],
    [0, antenna.y - antenna.ry - 0.34, -2.92],
    0.009,
    dark,
  );
  sphere(parent, 'anti-collision-beacon', [0.045, 0.035, 0.045], [0, 2.27, -1.05], red);
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
      if (!object.material.userData.molenCockpitLettering) geometry.deleteAttribute('uv');
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
  const rows = [];
  for (const z of [-4.3, -4, -3.5, -3, -2.5, -2]) {
    const { y, rx, ry } = boomAt(z);
    rows.push(
      Array.from({ length: 28 }, (_, k) => {
        const a = (k * Math.PI * 2) / 28;
        return {
          point: [rx * Math.cos(a), y + ry * Math.sin(a), z],
          normal: [Math.cos(a), Math.sin(a), 0],
        };
      }),
    );
  }
  // Rows along the lower cabin's structural skin, never on its transparent panels.
  for (const side of [-1, 1])
    for (const y of [0.7, 0.82, 0.94])
      rows.push(
        Array.from({ length: 30 }, (_, k) => {
          const z = -0.65 + k * 0.065;
          return { point: [side * eggHalfWidth(y, z), y, z], normal: [side, 0, 0] };
        }).filter(({ point }) => Math.abs(point[0]) > 0.3),
      );
  addRivetRows(g, [g.getObjectByName('tail-boom'), g.getObjectByName('cabin-panels')], rows);
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
const definition = JSON.parse(await readFile(resolve(root, '../entity.types.json'), 'utf8'));
const controlSpec = Object.values(definition.types)[0].components.aircraft.spec;
const controlledModel = completeCockpitControls(helicopter(), controlSpec, {
  panelZ: interiorLayout.panelZ,
  letteringFont: 'technical',
});
finishAircraftCockpit(controlledModel, controlSpec, 'oh-6');
const { completeAircraftArticulation } = await import(
  '../../../../../../packages/entities/scripts/aircraft-articulation.mjs'
);
completeAircraftArticulation(controlledModel, controlSpec, { slug: 'oh-6' });
const bytes = embedCockpitTextures(
  Buffer.from(
    await new GLTFExporter().parseAsync(settleZeros(controlledModel), {
      binary: true,
      onlyVisible: false,
    }),
  ),
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
const source = JSON.parse(sourceText);
source.files.models.find((model) => model.path === 'models/source.glb').sha256 = generatedHash;
source.files.textures = await writeCockpitTextures(resolve(root, '..'), bytes);
await writeMetadata(sourcePath, source);
await writeMetadata(resolve(root, '../entity.types.json'), definition);
console.log(`oh6: ${bytes.length} bytes, ${generatedHash}`);

async function writeMetadata(path, value) {
  const temporary = `${path}.animation.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, path);
}
