import {
  narrowbodyWindows,
  transportCell,
  transportCoaming,
  transportSection,
  transportWindowFrames,
  transportWinglet,
} from '../../../../../../packages/entities/scripts/aircraft/transport-profiles.mjs';
/**
 * Deterministic Bendy Small Airliner, with an operator cabin and polygonal close-view fittings.
 * Local shared procedural finishes. Nose +Z; origin at ground level with gear down.
 * `node models/generate.mjs` rewrites models/source.glb (hand edits are preserved); `--out <path>`
 * writes a review candidate instead.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { completeCockpitControls } from '../../../../../../packages/entities/scripts/aircraft/cockpit-controls.mjs';
import {
  embedCockpitTextures,
  finishAircraftCockpit,
  writeCockpitTextures,
} from '../../../../../../packages/entities/scripts/aircraft/cockpit-surfaces.mjs';
import { smoothSurface } from '../../../../../../packages/entities/scripts/surface-normals.mjs';
import {
  addRivetRows,
  detailKit,
} from '../../../../../../packages/entities/scripts/vehicle-detail.mjs';
import { aircraftPanelTools as panelTools } from '../../../../../../packages/entities/scripts/vehicle-interiors.mjs';

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
const mat = (name, color, metalness = 0, roughness = 0.6, extra = {}) =>
  new T.MeshStandardMaterial({ name, color, metalness, roughness, ...extra });
const paint = mat('airliner-white', '#f3f4f2', 0.2, 0.4);
const livery = mat('airliner-livery', '#1f4f8c', 0.2, 0.4);
const belly = mat('airliner-belly', '#b9bfc4', 0.3, 0.45);
const metal = mat('engine-metal', '#8f989e', 0.8, 0.3);
const glass = mat('vehicle-glass', '#26343c', 0.1, 0.12, { transparent: true, opacity: 0.82 });
const rubber = mat('rubber', '#141718', 0, 0.92);
const dark = mat('fan-dark', '#1c2126', 0.3, 0.6);

const SPAN = 35.8;
const R = 1.95; // fuselage radius

function box(parent, name, size, pos, material) {
  const mesh = new T.Mesh(new T.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...pos);
  parent.add(mesh);
  return mesh;
}

function tube(
  parent,
  name,
  radiusFront,
  radiusBack,
  length,
  z,
  material,
  segments = 24,
  open = false,
) {
  const mesh = new T.Mesh(
    new T.CylinderGeometry(radiusFront, radiusBack, length, segments, 1, open),
    material,
  );
  mesh.name = name;
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(0, 0, z);
  parent.add(mesh);
  return mesh;
}

/**
 * Closed airfoil loft through spanwise stations [x, y, leading-edge z, chord, t/c], all in
 * fuselage-axis coordinates. Symmetric 4-digit thickness; `vertical` swaps x and y for a fin.
 */
function airfoil(parent, name, stations, material, side = 1, vertical = false) {
  const us = [1, 0.8, 0.6, 0.4, 0.25, 0.12, 0.05, 0.015, 0];
  const half = (u) =>
    5 *
    (0.2969 * Math.sqrt(u) -
      0.126 * u -
      0.3516 * u * u +
      0.2843 * u * u * u -
      0.1036 * u * u * u * u);
  const ring = ([x, y, le, chord, t]) => {
    const points = [];
    for (const u of us) points.push([u, half(u) * chord * t]);
    for (const u of [...us].reverse().slice(1, -1)) points.push([u, -half(u) * chord * t]);
    return points.map(([u, h]) =>
      vertical ? [h, y, le - u * chord] : [side * x, y + h, le - u * chord],
    );
  };
  const rings = stations.map(ring),
    n = rings[0].length,
    positions = [],
    indices = [];
  for (const r of rings) for (const p of r) positions.push(...p);
  const flip = !vertical && side > 0;
  const tri = (a, b, c) => (flip ? indices.push(a, c, b) : indices.push(a, b, c));
  for (let s = 0; s < rings.length - 1; s++)
    for (let i = 0; i < n; i++) {
      const a = s * n + i,
        b = s * n + ((i + 1) % n),
        c = (s + 1) * n + ((i + 1) % n),
        d = (s + 1) * n + i;
      tri(a, d, c);
      tri(a, c, b);
    }
  for (const [s, dir] of [
    [0, 1],
    [rings.length - 1, -1],
  ])
    for (let i = 1; i < n - 1; i++)
      dir > 0 ? tri(s * n, s * n + i, s * n + i + 1) : tri(s * n, s * n + i + 1, s * n + i);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new T.Mesh(geometry, material);
  mesh.name = name;
  parent.add(mesh);
  return mesh;
}

/** Elliptic-section loft through [z, half-width, bottom, top] stations (open ends). */
function sectionLoft(parent, name, sections, material, segments = 48) {
  const positions = [],
    indices = [];
  for (const [z, w, b, t] of sections)
    for (let i = 0; i < segments; i++) {
      const a = (i * 2 * Math.PI) / segments;
      positions.push(Math.sin(a) * w, (b + t) / 2 + Math.cos(a) * ((t - b) / 2), z);
    }
  for (let s = 0; s < sections.length - 1; s++)
    for (let i = 0; i < segments; i++) {
      const a = s * segments + i,
        b = s * segments + ((i + 1) % segments),
        c = (s + 1) * segments + ((i + 1) % segments),
        d = (s + 1) * segments + i;
      indices.push(a, b, c, a, c, d);
    }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new T.Mesh(geometry, material);
  mesh.name = name;
  parent.add(mesh);
  return mesh;
}

/** Side-plane prism ([z, y] outline) extruded across +-halfWidth in x. */
function prism(parent, name, outline, halfWidth, material) {
  const shape = new T.Shape(outline.map(([z, y]) => new T.Vector2(z, y)));
  const geometry = new T.ExtrudeGeometry(shape, { depth: halfWidth * 2, bevelEnabled: false });
  geometry.translate(0, 0, -halfWidth);
  // Shape x -> world z, shape y -> world y, extrusion -> world x.
  geometry.rotateY(-Math.PI / 2);
  const mesh = new T.Mesh(geometry, material);
  mesh.name = name;
  parent.add(mesh);
  return mesh;
}

// A320-family proportions (Airbus A320 three-view by J. Scavini, CC BY-SA 3.0, scaled to this
// 39 m airframe; published 12.64 m wheelbase / 7.59 m track): stations below are metres in
// fuselage-axis coordinates (axis 3.8 m above ground, nose at z = 19.5).
const ENGINE = { x: 5.97, y: -1.88, z: 6.23, radius: 1.3, length: 3.74 };
const COWL = [
  [-0.5, 0.74],
  [-0.36, 0.84],
  [-0.15, 0.95],
  [0.1, 1],
  [0.3, 1],
  [0.42, 0.97],
  [0.47, 0.92],
  [0.5, 0.87],
];
// Tail cone [z, half-width, bottom, top]: the belly sweeps up from behind the wing to an
// APU exhaust 1.2 m above the cabin axis, the crown stays nearly level.
const TAIL = [
  [-7.0, R, -R, R],
  [-7.8, 1.92, -1.71, 1.95],
  [-9.75, 1.82, -1.48, 1.95],
  [-11.31, 1.64, -1.18, 1.94],
  [-13.26, 1.4, -0.77, 1.92],
  [-14.82, 1.14, -0.34, 1.88],
  [-16.38, 0.86, 0.12, 1.79],
  [-18.33, 0.54, 0.6, 1.66],
  [-19.5, 0.22, 0.97, 1.47],
];
/** Half-width of the outer shell at height y and station z (cabin cylinder or tail cone). */
function shellX(z, y) {
  if (z >= TAIL[0][0]) return Math.sqrt(Math.max(0, R * R - y * y));
  let i = TAIL.findIndex((s) => s[0] <= z);
  i = Math.max(1, i < 0 ? TAIL.length - 1 : i);
  const a = TAIL[i - 1],
    b = TAIL[i],
    t = (z - a[0]) / (b[0] - a[0]);
  const [w, lo, hi] = [1, 2, 3].map((k) => a[k] + (b[k] - a[k]) * t);
  const v = (y - (lo + hi) / 2) / ((hi - lo) / 2);
  return w * Math.sqrt(Math.max(0, 1 - v * v));
}

function engine(parent, side) {
  const g = new T.Group();
  g.name = side > 0 ? 'engine-left' : 'engine-right';
  g.position.set(side * ENGINE.x, ENGINE.y, ENGINE.z);
  parent.add(g);
  const er = ENGINE.radius,
    el = ENGINE.length,
    lip = COWL.at(-1)[1];
  // Fan cowl: inlet highlight inside the maximum diameter, tapering to the fan nozzle.
  const cowl = new T.Mesh(
    new T.LatheGeometry(
      COWL.map(([z, r]) => new T.Vector2(er * r, el * z)),
      40,
    ).rotateX(Math.PI / 2),
    paint,
  );
  cowl.name = 'nacelle';
  g.add(cowl);
  const duct = new T.Mesh(
    new T.CylinderGeometry(er * lip, er * lip * 0.96, 0.5, 32, 1, true).rotateX(Math.PI / 2),
    dark,
  );
  duct.name = 'inlet-duct';
  duct.position.z = el / 2 - 0.25;
  g.add(duct);
  const fan = new T.Group();
  fan.name = side > 0 ? 'fan-left' : 'fan-right';
  fan.position.set(0, 0, el / 2 - 0.4);
  g.add(fan);
  const disc = tube(fan, 'fan-disc', er * lip * 0.95, er * lip * 0.95, 0.05, 0, metal, 20);
  disc.name = 'fan-disc';
  for (let i = 0; i < 12; i++) {
    const blade = box(fan, 'fan-blade', [0.06, er * lip * 1.9, 0.03], [0, 0, 0.03], dark);
    blade.rotation.z = (i * Math.PI) / 12;
  }
  // Fan-nozzle annulus, core cowl and plug behind the shorter fan cowl.
  const annulus = new T.Mesh(new T.RingGeometry(er * 0.5, er * 0.74, 32).rotateY(Math.PI), dark);
  annulus.name = 'fan-exhaust';
  annulus.position.z = -el / 2 + 0.06;
  g.add(annulus);
  const core = new T.Mesh(
    new T.LatheGeometry(
      [
        [-1.02, 0.015],
        [-0.86, 0.17],
        [-0.72, 0.28],
        [-0.72, 0.36],
        [-0.42, 0.45],
        [0, 0.53],
        [0.25, 0.58],
      ].map(([z, r]) => new T.Vector2(er * r, -el / 2 + el * 0.3 * z)),
      24,
    ).rotateX(Math.PI / 2),
    metal,
  );
  core.name = 'engine-core';
  g.add(core);
  // Pylon from the nacelle crown into the wing's lower surface, behind the leading edge.
  prism(
    g,
    'pylon',
    [
      [0.6, 1.0],
      [0.0, 1.42],
      [-2.3, 1.42],
      [-4.0, 0.95],
      [-4.0, 0.45],
      [-1.5, 0.45],
    ],
    0.15,
    paint,
  );
}

function gear(parent, name, x, z, top, r, spread) {
  const g = new T.Group();
  g.name = name;
  g.position.set(x, top, z);
  parent.add(g);
  // Axle sits one tyre radius above the ground (3.8 m below the cabin axis).
  const height = top - (r - 3.8);
  // Round oleo leg, a short axle beam and grey hubs, rather than a square post.
  const strut = new T.Mesh(new T.CylinderGeometry(0.1, 0.085, height, 12), metal);
  strut.name = 'gear-strut';
  strut.position.y = -height / 2;
  g.add(strut);
  box(g, 'gear-axle', [spread * 2, 0.1, 0.12], [0, -height, 0], metal);
  for (const dx of [-spread, spread]) {
    const hub = new T.Mesh(new T.CylinderGeometry(r * 0.55, r * 0.55, r * 0.62, 14), metal);
    hub.name = 'gear-hub';
    hub.rotation.z = Math.PI / 2;
    hub.position.set(dx, -height, 0);
    g.add(hub);
    const tyre = new T.Mesh(new T.CylinderGeometry(r, r, r * 0.6, 14), rubber);
    tyre.name = 'gear-tyre';
    tyre.rotation.z = Math.PI / 2;
    tyre.position.set(dx, -height, 0);
    g.add(tyre);
  }
}

function airliner() {
  const g = new T.Group();
  g.name = 'airliner';
  const fuselage = new T.Group();
  fuselage.name = 'fuselage';
  g.add(fuselage);
  // Constant section from the flight deck to behind the wing (z = 14 .. -7); the upswept
  // tail cone continues it.
  tube(fuselage, 'cabin', R, R, 21, 3.5, paint);
  // Airliner-specific rounded radome (a full, round lower half) and six straight-edged
  // flight-deck panes. Its own
  // stations, not the A320neo profile's: this flight deck sits 1.2 m further aft. Stations
  // are [distance aft of tip, half-width, bottom, top] on an A320-size section (axis 3.85 m,
  // radius 1.975 m) scaled to this cylinder, and are smoothed between stations.
  const template = { cy: 3.85, ry: 2.03, radius: 1.975 };
  const profile = {
    cy: 0,
    ry: R,
    radius: R,
    smoothNose: true,
    windows: narrowbodyWindows,
    nose: [
      [0, 0.012, 3.06, 3.12],
      [0.05, 0.2, 2.91, 3.27],
      [0.15, 0.36, 2.78, 3.42],
      [0.3, 0.52, 2.66, 3.58],
      [0.8, 0.97, 2.25, 4.02],
      [1.5, 1.35, 2.02, 4.43],
      [2.1, 1.56, 1.93, 4.88],
      [2.8, 1.76, 1.87, 5.4],
      [3.6, 1.9, 1.84, 5.74],
      [4.6, 1.975, 1.82, 5.88],
      [6.5, 1.975, 1.82, 5.88],
    ].map(([d, w, b, t]) => [
      d,
      (w * R) / template.radius,
      ((b - template.cy) * R) / template.ry,
      ((t - template.cy) * R) / template.ry,
    ]),
  };
  const spec = { length: 39, category: 'airliner' },
    skin = [],
    glazing = [];
  const cuts = [
    14,
    19.5,
    ...profile.nose.map((a) => 19.5 - a[0]).filter((z) => z > 14),
    ...profile.windows.flatMap((w) => w.map((a) => 19.5 - a[1])),
  ];
  for (let z = 14; z < 19.5; z += 0.12) cuts.push(z);
  cuts.sort((a, b) => a - b);
  for (let i = 0; i < cuts.length - 1; i++)
    for (let j = 0; j < 64; j++) {
      const a = (j * Math.PI) / 32,
        b = ((j + 1) * Math.PI) / 32;
      transportCell(
        spec,
        profile,
        [
          [cuts[i], a],
          [cuts[i + 1], a],
          [cuts[i + 1], b],
          [cuts[i], b],
        ],
        (kind, points) => {
          const target = kind === 'skin' ? skin : glazing;
          for (let k = 1; k < points.length - 1; k++)
            target.push(...points[0], ...points[k], ...points[k + 1]);
        },
      );
    }
  const frames = detailKit(fuselage, 'flight-deck-window-frames');
  // Slim light-grey pane surrounds; heavy dark rods read as thick frames from outside.
  transportWindowFrames(frames, spec, profile, belly, 0.008);
  frames.finish();
  transportCoaming(g, spec, { profile, eye: [0.55, 0.85, 15.4], panelZ: 15.975 }, dark);
  for (const [name, positions, material] of [
    ['nose', skin, paint],
    ['flight-deck-glazing', glazing, glass],
  ]) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    const mesh = new T.Mesh(smoothSurface(geometry), material);
    mesh.name = name;
    fuselage.add(mesh);
  }
  // The exterior nose was one-sided: from the seats its entire lower half vanished.
  // Follow the same measured facets with inward-facing trim, preserving every window.
  const liningPositions = [];
  for (let i = 0; i < skin.length; i += 9) {
    if ([2, 5, 8].some((j) => skin[i + j] > 19)) continue;
    for (const j of [0, 6, 3]) {
      const z = skin[i + j + 2];
      const sec = transportSection(spec, profile, z),
        center = (sec[2] + sec[3]) / 2;
      liningPositions.push(skin[i + j] * 0.992, center + (skin[i + j + 1] - center) * 0.992, z);
    }
  }
  const liningGeometry = new T.BufferGeometry();
  liningGeometry.setAttribute('position', new T.Float32BufferAttribute(liningPositions, 3));
  liningGeometry.computeVertexNormals();
  const noseLining = new T.Mesh(liningGeometry, mat('flight-deck-lining', '#7d8788'));
  noseLining.name = 'flight-deck-lining';
  fuselage.add(noseLining);
  const noseCap = new T.Mesh(new T.CircleGeometry(profile.nose[0][1], 64), paint);
  noseCap.scale.y = (profile.nose[0][3] - profile.nose[0][2]) / (2 * profile.nose[0][1]);
  noseCap.name = 'nose-end-cap';
  noseCap.position.set(0, (profile.nose[0][2] + profile.nose[0][3]) / 2, 19.5);
  fuselage.add(noseCap);
  sectionLoft(fuselage, 'tail-cone', TAIL, paint);
  // Painted tail-cone end cap with a small (0.34 m) APU outlet, not an all-black disc.
  const cap = new T.Mesh(new T.CircleGeometry(1, 24).rotateY(Math.PI), paint);
  cap.name = 'tail-cone-cap';
  cap.scale.set(TAIL.at(-1)[1], (TAIL.at(-1)[3] - TAIL.at(-1)[2]) / 2, 1);
  cap.position.set(0, (TAIL.at(-1)[2] + TAIL.at(-1)[3]) / 2, TAIL.at(-1)[0]);
  fuselage.add(cap);
  const apu = new T.Mesh(new T.CircleGeometry(0.17, 16).rotateY(Math.PI), dark);
  apu.name = 'apu-exhaust';
  apu.position.set(0, (TAIL.at(-1)[2] + TAIL.at(-1)[3]) / 2, TAIL.at(-1)[0] - 0.006);
  fuselage.add(apu);
  // Wing-to-body fairing between the wing-root leading and trailing edges: a smooth keel
  // that swells 0.25 m below the belly and bulges past the sides at the wing root, then
  // fairs back into the shell at both ends (its ends stay inside the fuselage).
  const fairing = [];
  for (let i = 0; i <= 16; i++) {
    const u = i / 16,
      bump = Math.min(
        Math.sin((Math.min(1, u / 0.28) * Math.PI) / 2),
        Math.sin((Math.min(1, (1 - u) / 0.38) * Math.PI) / 2),
      );
    fairing.push([8.3 - 10.9 * u, 0.6 + 0.75 * Math.sqrt(bump), -R + 0.05 - 0.3 * bump, -0.9]);
  }
  // Painted like the fuselage: a grey fairing reads as a stain from below.
  sectionLoft(fuselage, 'belly-fairing', fairing, paint, 32);
  box(fuselage, 'cheatline', [R * 2.02, 0.22, 21], [0, 0.35, 3.5], livery);
  // Window band on both sides and the cockpit glazing. Narrow-body window pitch is about
  // 0.53 m (21 in); the windows share one merged mesh.
  const windows = detailKit(fuselage, 'passenger-windows');
  for (const side of [-1, 1])
    for (let i = 0; i < 44; i++) {
      const z = -11.6 + i * 0.53;
      if ([-11, 11.5].some((door) => Math.abs(z - door) < 0.6)) continue;
      // Individual rounded windows, seated on the round shell or the narrowing tail cone.
      const window = windows.add(
        new T.CylinderGeometry(1, 1, 0.035, 14).rotateZ(Math.PI / 2).scale(1, 0.16, 0.115),
        dark,
        [side * (shellX(z, 0.73) + 0.008), 0.73, z],
      );
      window.rotation.z = side * 0.39;
    }
  windows.finish();
  // Wings, tailplanes and fin: tapered airfoil lofts with dihedral. The wing has a straight
  // 27.6 deg leading edge and an unswept inboard trailing edge out to the kink.
  const wings = new T.Group();
  wings.name = 'wings';
  g.add(wings);
  const wingY = (x) => -1.1 + 0.089 * (x - 1.0);
  const le = (x) => 7.339 - 0.524 * x;
  // The tip station stops short of the 35.8 m span; a blended winglet rises 2.3 m from it
  // and curves out to the span, as on current narrow-bodies.
  const tip = SPAN / 2 - 0.42,
    tipChord = 3.838 + ((1.56 - 3.838) * (tip - 6.78)) / (SPAN / 2 - 6.78);
  for (const side of [1, -1]) {
    airfoil(
      wings,
      side > 0 ? 'wing-left' : 'wing-right',
      [
        [1.0, wingY(1.0), le(1.0), le(1.0) + 0.052, 0.13],
        [6.78, wingY(6.78), le(6.78), le(6.78) + 0.052, 0.12],
        [tip, wingY(tip), le(tip), tipChord, 0.11],
      ],
      paint,
      side,
    );
    const winglet = detailKit(wings, side > 0 ? 'winglet-left' : 'winglet-right');
    transportWinglet(
      winglet,
      [side * tip, wingY(tip), le(tip)],
      side,
      { height: 2.3, out: 0.4, root: tipChord - 0.1, tip: 0.45, sweep: 1.3 },
      livery,
    );
    winglet.finish();
    // Flap-track fairings: slim canoes under the rear spar, running past the trailing edge.
    const tracks = detailKit(wings, side > 0 ? 'flap-tracks-left' : 'flap-tracks-right');
    // Chord from the airfoil stations: the unswept inboard trailing edge, then linear taper.
    const chordAt = (x) =>
      x <= 6.78 ? le(x) + 0.052 : 3.838 + ((tipChord - 3.838) * (x - 6.78)) / (tip - 6.78);
    for (const x of [4.2, 7.6, 10.6, 13.4]) {
      const c = chordAt(x),
        trailing = le(x) - c;
      tracks.add(
        new T.SphereGeometry(1, 10, 12).scale(0.05 + c * 0.022, 0.06 + c * 0.04, c * 0.42),
        paint,
        [side * x, wingY(x) - c * 0.035 - 0.08, trailing - c * 0.06],
      );
    }
    tracks.finish();
    // Inboard flap along the unswept trailing edge; hinge (node origin) at its leading edge.
    const flap = new T.Mesh(new T.BoxGeometry(4.6, 0.08, 1.0), belly);
    flap.geometry.translate(side * 2.3, 0, -0.5);
    flap.name = side > 0 ? 'flap-left' : 'flap-right';
    flap.position.set(side * 2.1, wingY(2.1 + 2.3) - 0.3, 0.35);
    wings.add(flap);
    engine(g, side);
    airfoil(
      g,
      side > 0 ? 'stabilizer-left' : 'stabilizer-right',
      [
        [0.2, 0.97 + 0.105 * 0.2, -13.22, 3.91, 0.1],
        [6.46, 0.97 + 0.105 * 6.46, -17.34, 1.3, 0.1],
      ],
      paint,
      side,
    );
  }
  const fin = new T.Group();
  fin.name = 'fin';
  g.add(fin);
  // Fin: 39 deg leading edge from the fuselage crown to the 12.2 m tip, 2 m tip chord.
  airfoil(
    fin,
    'fin-surface',
    [
      [0, 1.6, -11.01, 5.93, 0.1],
      [0, 8.4, -16.6, 2.05, 0.1],
    ],
    livery,
    1,
    true,
  );
  // Dorsal fillet: a low swept fairing from the crown into the fin's leading edge.
  airfoil(
    fin,
    'dorsal-fillet',
    [
      [0, 1.75, -7.9, 3.6, 0.06],
      [0, 2.75, -11.75, 0.75, 0.1],
    ],
    livery,
    1,
    true,
  );
  gear(g, 'gear-nose', 0, 14.26, -1.6, 0.4, 0.25);
  gear(g, 'gear-left', 3.94, 1.13, -1.15, 0.6, 0.48);
  gear(g, 'gear-right', -3.94, 1.13, -1.15, 0.6, 0.48);
  glass.opacity = 0.18;
  glass.side = T.DoubleSide;
  glass.depthWrite = false;
  let detail = detailKit(g);
  for (const side of [-1, 1]) {
    detail.text('BENDY', [side * 1.955, 0.16, 7.5], 0.5, (side * Math.PI) / 2);
    for (const z of [-11, 11.5]) {
      const outline = [
        [-0.35, -0.9],
        [-0.45, -0.8],
        [-0.45, -0.4],
        [-0.45, 0],
        [-0.45, 0.4],
        [-0.45, 0.9],
        [-0.35, 1.0],
        [0.35, 1.0],
        [0.45, 0.9],
        [0.45, 0.4],
        [0.45, 0],
        [0.45, -0.4],
        [0.45, -0.8],
        [0.35, -0.9],
      ];
      const surface = ([dz, y]) => {
        // Match the actual 24-sided shell instead of putting a flat door behind curved skin.
        const angle = Math.asin(y / R),
          step = Math.PI / 12;
        const a = Math.floor(angle / step) * step,
          b = a + step;
        const t = (y - R * Math.sin(a)) / (R * Math.sin(b) - R * Math.sin(a));
        const x = R * (Math.cos(a) * (1 - t) + Math.cos(b) * t);
        const outer = Math.abs(y - 0.35) <= 0.115 ? Math.max(x, R * 1.01) : x;
        // The aft door sits on the narrowing tail cone, not the cylinder.
        if (z + dz < TAIL[0][0]) return [side * (shellX(z + dz, y) + 0.02), y, z + dz];
        return [side * (outer + 0.02), y, z + dz];
      };
      for (let i = 0; i < outline.length; i++) {
        const a = outline[i],
          b = outline[(i + 1) % outline.length];
        const steps = Math.max(1, Math.ceil(Math.abs(b[1] - a[1]) / 0.05));
        const point = (j) =>
          surface([a[0] + ((b[0] - a[0]) * j) / steps, a[1] + ((b[1] - a[1]) * j) / steps]);
        for (let j = 0; j < steps; j++) detail.rod(point(j), point(j + 1), 0.008, detail.dark);
      }
      detail.box([0.04, 0.06, 0.19], [side * (shellX(z, 0) + 0.01), 0, z], detail.metal);
    }
    detail.ring(
      ENGINE.radius * COWL.at(-1)[1],
      0.065,
      [side * ENGINE.x, ENGINE.y, ENGINE.z + ENGINE.length / 2],
      detail.metal,
    );
    detail.box([0.08, 0.08, 0.2], [side * 17.3, 0.36, -2.6], side > 0 ? detail.red : detail.green);
  }
  // Keep cabin finishes independent from the airframe fittings that use the same base palette.
  detail.finish();
  detail = detailKit(g, 'airliner-cabin-detail');
  detail.box([2.2, 0.055, 2.7], [0, -0.39, 15.6], detail.dark);
  // Solid console returns bridge the main panel to the fitted lower shell.
  for (const side of [-1, 1]) {
    detail.box([0.3, 0.7, 1.6], [side * 1.02, -0.015, 15.55], detail.dark);
    detail.box([0.06, 0.035, 0.28], [side * 0.87, 0.35, 15.2], detail.metal);
  }
  detail.box([2.1, 0.7, 0.08], [0, -0.04, 16.35], detail.dark);
  for (const side of [-1, 1]) {
    detail.box([0.5, 0.13, 0.6], [side * 0.55, -0.15, 15.2], detail.dark);
    detail.box([0.5, 0.75, 0.12], [side * 0.55, 0.15, 14.93], detail.dark);
  }
  const instruments = panelTools(detail);
  detail.box([2.08, 0.32, 0.38], [0, 0.4, 16.18], detail.dark);
  detail.box([2.1, 0.05, 0.42], [0, 0.685, 16.17], detail.dark);
  // Separate attitude/navigation pairs and central engine/system displays.
  for (const [x, kind] of [
    [-0.83, 'attitude'],
    [-0.5, 'radar'],
    [-0.17, 'engine'],
    [0.17, 'engine'],
    [0.5, 'radar'],
    [0.83, 'attitude'],
  ]) {
    instruments.display(x, 0.49, 15.975, 0.285, 0.235, kind);
    instruments.buttons(x, 0.35, 15.96, 5, 0.037);
    instruments.knob(x + 0.13, 0.365, 15.95, 0.012);
  }
  for (const [i, label] of ['COURSE', 'SPEED', 'HDG', 'ALT', 'VS'].entries()) {
    const x = -0.68 + i * 0.34;
    instruments.display(x, 0.73, 16.03, 0.12, 0.025, 'mode');
    instruments.knob(x, 0.68, 16.02, 0.016);
    detail.text(label, [x, 0.775, 16.015], 0.016, Math.PI, detail.ivory, 'display');
  }
  detail.box([0.42, 0.25, 0.76], [0, 0.04, 15.22], detail.dark);
  for (const side of [-1, 1]) {
    // Flight-management keypad and radio banks. No decorative numeric flight data.
    instruments.display(side * 0.17, 0.255, 15.57, 0.14, 0.09, 'route');
    for (let row = 0; row < 4; row++)
      instruments.buttons(side * 0.17, 0.19 - row * 0.025, 15.56, 4, 0.026);
    const lever = new T.Group();
    lever.name = `airliner-throttle-${side}`;
    lever.position.set(side * 0.065, 0.18, 15.24);
    lever.userData.aircraftControl = {
      action: 'power',
      engine: side > 0 ? 'left' : 'right',
      motion: { property: 'rotation', axis: 'x', scale: 0.65 },
    };
    g.add(lever);
    const ld = detailKit(lever, lever.name);
    ld.rod([0, 0, 0], [0, 0.22, 0.05], 0.012, detail.metal);
    ld.box([0.065, 0.035, 0.047], [0, 0.225, 0.05], detail.ivory);
    ld.finish();
    detail.rod([side * 0.19, 0.17, 15.1], [side * 0.19, 0.3, 15.14], 0.009, detail.metal);
    detail.box(
      [0.04, 0.025, 0.055],
      [side * 0.19, 0.305, 15.14],
      side < 0 ? detail.ivory : detail.dark,
    );
    // Harness hardware and inboard seat armrests.
    detail.box([0.035, 0.57, 0.009], [side * 0.55 + 0.12, 0.25, 15.0], detail.ivory);
    detail.box([0.06, 0.04, 0.35], [side * 0.28, 0.19, 15.14], detail.dark);
  }
  // Overhead systems panel, above the eye and aft of the windscreen.
  detail.box([0.7, 0.045, 0.58], [0, 1.3, 15.28], detail.dark);
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 7; col++) {
      const x = (col - 3) * 0.08,
        z = 15.08 + row * 0.12;
      detail.box([0.045, 0.006, 0.07], [x, 1.273, z], detail.metal);
      detail.rod([x, 1.27, z], [x, 1.244, z + 0.009], 0.004, detail.dark);
    }
  for (const x of [-0.2, 0, 0.2]) detail.box([0.05, 0.03, 0.075], [x, 1.265, 15.52], detail.red);
  detail.finish();
  const yoke = new T.Group();
  yoke.name = 'control-yoke';
  yoke.position.set(0.55, 0.35, 15.8);
  g.add(yoke);
  const controls = detailKit(yoke, 'yoke-trim');
  controls.rod([-0.15, 0.12, 0], [-0.15, 0, 0], 0.025, controls.dark);
  controls.rod([-0.15, 0, 0], [0.15, 0, 0], 0.025, controls.dark);
  controls.rod([0.15, 0, 0], [0.15, 0.12, 0], 0.025, controls.dark);
  controls.finish();
  const rows = [];
  for (let z = -6.5; z < 14; z += 1.25) {
    const row = [];
    for (let i = 0; i < 128; i++) {
      const a = (i * Math.PI * 2) / 128;
      row.push({
        point: [R * Math.cos(a), R * Math.sin(a), z],
        normal: [Math.cos(a), Math.sin(a), 0],
      });
    }
    rows.push(row);
  }
  addRivetRows(g, [fuselage.getObjectByName('cabin')], rows, 0.0035);
  // Ground-aligned origin shared by the simulator, seats, collision probes and model.
  for (const child of g.children) child.position.y += 3.8;
  return g;
}

// source.json pins the master this generator last wrote. A master that matches neither the pin
// nor this run's output was edited by hand, and regenerating would discard that work.
const sourcePath = resolve(root, '../source.json');
const sourceText = await readFile(sourcePath, 'utf8');
const pinned = JSON.parse(sourceText).files.models.find(
  (m) => m.path === 'models/source.glb',
)?.sha256;
const definitionPath = resolve(root, '../entity.types.json');
const definitionText = await readFile(definitionPath, 'utf8');
const definition = JSON.parse(definitionText);
const controlSpec = Object.values(definition.types)[0].components.aircraft.spec;
controlSpec.visual.interior.nodes = [
  'airliner-cabin-detail',
  'control-yoke',
  'airliner-throttle--1',
  'airliner-throttle-1',
];
const controlledModel = completeCockpitControls(airliner(), controlSpec, {
  panelZ: 15.975,
  floor: 3.6,
});
finishAircraftCockpit(controlledModel, controlSpec, 'airliner');
const { completeAircraftArticulation } = await import(
  '../../../../../../packages/entities/scripts/aircraft-articulation.mjs'
);
completeAircraftArticulation(controlledModel, controlSpec, {
  slug: 'airliner',
  category: 'airliner',
  wingY: 2.7,
  wingZ: 0.4,
});
const bytes = embedCockpitTextures(
  Buffer.from(
    await new GLTFExporter().parseAsync(controlledModel, { binary: true, onlyVisible: false }),
  ),
);
const path = resolve(root, 'source.glb');
const current = await readFile(path).catch(() => undefined);
const hash = (buffer) => `sha256:${createHash('sha256').update(buffer).digest('hex')}`;
const generatedHash = hash(bytes);
const outIndex = process.argv.indexOf('--out');
if (outIndex !== -1) {
  const candidate = resolve(process.argv[outIndex + 1] ?? '');
  if (candidate === path || candidate === sourcePath)
    throw new Error('--out must be separate from the source master and its source.json');
  await mkdir(dirname(candidate), { recursive: true });
  await writeFile(candidate, bytes);
  console.log(`Candidate: ${candidate} ${generatedHash}`);
  process.exit(0);
}
if (current && pinned && hash(current) !== pinned && !current.equals(bytes))
  throw new Error(`Preserving artist edits in ${path}; move the master before regenerating.`);
if (!current?.equals(bytes)) await writeFile(path, bytes);
const source = JSON.parse(sourceText);
source.files.models.find((model) => model.path === 'models/source.glb').sha256 = generatedHash;
source.files.textures = await writeCockpitTextures(resolve(root, '..'), bytes);
async function writeChangedJson(path, value, previous) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (text === previous) return;
  // Live Windows editors can memory-map these manifests. Replace a completed
  // file instead of truncating it, as the aircraft batch generator does.
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, text);
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}
await writeChangedJson(sourcePath, source, sourceText);
await writeChangedJson(definitionPath, definition, definitionText);
console.log(`airliner: ${bytes.length} bytes, ${generatedHash}`);
