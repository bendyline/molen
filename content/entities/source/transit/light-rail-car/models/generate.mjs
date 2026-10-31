/**
 * Deterministic master for a 27 m two-section light-rail vehicle. No network, textures or private
 * tools. Front faces +Z; the rail head is y = 0. Both cabs are identical, so a consist can run
 * either way. `node models/generate.mjs` rewrites models/source.glb (hand edits are preserved);
 * `--out <path>` writes a review candidate instead.
 */
import '../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { addTransitDetail } from '../../../../../../packages/entities/scripts/vehicle-detail.mjs';

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
// Off-white, never pure white on a large surface (medium-fi palette).
const paint = mat('rail-livery-body', '#e8e6de', 0.1, 0.45);
const livery = mat('rail-livery-stripe', '#1d6f8f', 0.1, 0.45);
const doorGlass = mat('door-glass', '#1d2a31', 0.1, 0.15, { transparent: true, opacity: 0.85 });
const glass = mat('vehicle-glass', '#26343c', 0.1, 0.12, { transparent: true, opacity: 0.82 });
const trim = mat('trim-charcoal', '#22272b', 0.05, 0.7, { side: T.DoubleSide });
const rim = mat('wheel-rim', '#9aa2a6', 0.7, 0.35);
const lamp = mat('lamp-lens', '#fff4d6', 0, 0.3, { emissive: '#fff4d6', emissiveIntensity: 0.6 });
const tail = mat('tail-lens', '#c9302c', 0, 0.3, { emissive: '#8a1512', emissiveIntensity: 0.5 });
// The sign band is seen from the driver's seat too, so it renders both faces.
const signPanel = mat('destination-sign', '#12161a', 0, 0.5, { side: T.DoubleSide });

const L = 27.0;
const W = 2.65;
const FLOOR = 0.95;
// Articulated LRV section (SD-160 floor height and side layout, S70/S200-style cab): body-colour
// skirt low along the side over the bogies, articulation skirt, livery stripe, windscreen base
// and glass head, window sill and head, roof edge and crown. Heights in metres above the rail
// head.
const SKIRT = 0.42,
  TRUCK_SKIRT = 0.86,
  STRIPE = 1.58,
  SCREEN = 1.75,
  SILL = 1.85,
  HEAD = 3.08,
  SCREEN_HEAD = 3.38,
  EDGE = 3.42,
  CROWN = 3.6;
const CAB = L / 2, // nose face
  ART = 0.5, // section end at the articulation
  // Cab corners are quarter ellipses in plan, wide across the car and deep along it, so the
  // nose is round in plan and the windscreen wraps round the corners to the cab side windows.
  RCX = 0.95,
  RCZ = 1.1,
  RA = 0.05,
  N = 6;
// Cab profile on the centreline as [height, setback behind CAB]: a dark apron tucks under the
// nose, which stands furthest forward over the coupler and rounds over to the windscreen base;
// the screen sweeps back about 0.45 m and curves into the roof. Every setback stays below the
// corner depth (RCZ), so the nose stays convex up to the roof.
const PROFILE = [
  [SKIRT, 0.24],
  [0.6, 0.06],
  [0.78, 0],
  [1.0, 0],
  [1.22, 0.04],
  [1.45, 0.12],
  [SCREEN - 0.07, 0.23],
  [SCREEN, 0.26],
  [2.3, 0.44],
  [2.8, 0.58],
  [SCREEN_HEAD, 0.69],
  [EDGE, 0.72],
  [CROWN, 0.75],
];
// Destination sign behind the top of the windscreen.
const SIGN = [3.12, 3.36];
const TRUCKS = [L / 2 - 4.2, 0, -L / 2 + 4.2];
const DOOR_W = 1.34;
const DOORS = [3.5, 9.5]; // door centres from the articulation, per section and side

function box(parent, name, size, pos, material) {
  const mesh = new T.Mesh(new T.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...pos);
  parent.add(mesh);
  return mesh;
}
function rod(parent, name, a, b, radius, material) {
  const from = new T.Vector3(...a),
    to = new T.Vector3(...b);
  const mesh = new T.Mesh(new T.CylinderGeometry(radius, radius, from.distanceTo(to), 6), material);
  mesh.name = name;
  mesh.position.copy(from.clone().lerp(to, 0.5));
  mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), to.sub(from).normalize());
  parent.add(mesh);
  return mesh;
}

// Rounded plan outline of one section at `inset` (dir +1 front section, -1 rear). Cab corners
// first, then the articulation corners; cab-facing points lean back with height.
const COUNT = 4 * (N + 1);
const range = (a, b) => {
  const out = [a];
  for (let i = a; i !== b; ) {
    i = (i + 1) % COUNT;
    out.push(i);
  }
  return out;
};
const CAB_END = range(0, 2 * N + 1),
  ART_END = range(2 * N + 2, 4 * N + 3),
  AFT = range(2 * N + 1, 0),
  ALL = [...CAB_END, ...AFT.slice(1)],
  // The windscreen wraps round each corner almost to the side wall; dark posts (the first and
  // last outline segments) close it to the cab side windows.
  SCREEN_SPAN = range(1, 2 * N);
// Setback of the cab face behind CAB on the centreline at height y (PROFILE, linear between
// its knots).
function setback(y) {
  const k = PROFILE.findIndex(([h]) => h >= y);
  if (k <= 0) return PROFILE[k < 0 ? PROFILE.length - 1 : 0][1];
  const [[h0, s0], [h1, s1]] = [PROFILE[k - 1], PROFILE[k]];
  return s0 + ((s1 - s0) * (y - h0)) / (h1 - h0);
}
function plan(dir, inset, y) {
  const hw = W / 2 - inset,
    zc = CAB - inset,
    za = ART + inset;
  const rx = Math.max(RCX - inset, 0.02),
    rz = Math.max(RCZ - inset, 0.02),
    ra = Math.max(RA - inset, 0.01);
  const lean = setback(y);
  const out = [];
  const arc = (cx, cz, r, s, a0) => {
    for (let i = 0; i <= N; i++) {
      const a = a0 + (i * Math.PI) / (2 * N);
      out.push([cx + r * Math.cos(a), cz + s * Math.sin(a)]);
    }
  };
  arc(hw - rx, zc - rz, rx, rz, 0);
  arc(-hw + rx, zc - rz, rx, rz, Math.PI / 2);
  arc(-hw + ra, za + ra, ra, ra, Math.PI);
  arc(hw - ra, za + ra, ra, ra, Math.PI * 1.5);
  return out.map(([x, z]) => [x, dir * (z > zc - rz ? z - (lean * (z - zc + rz)) / rz : z)]);
}
// Front cab surface z at (x, y), interpolated along the plan outline, so the sign, lamps,
// wipers and cab fascia follow the raked, rounded face instead of a fixed plane.
function face(x, y, inset = 0) {
  const outline = plan(1, inset, y);
  const p = CAB_END.map((i) => outline[i]);
  for (let k = 1; k < p.length; k++) {
    const [xa, za] = p[k - 1],
      [xb, zb] = p[k];
    if (x <= xa && x >= xb) return xa - xb < 1e-9 ? za : za + ((zb - za) * (xa - x)) / (xa - xb);
  }
  return p[0][1];
}
// Lay a part on the cab face at (x, y), `proud` along the surface normal of section `dir`.
function onFace(mesh, dir, x, y, proud = 0) {
  const d = 0.02;
  const n = new T.Vector3(
    -(face(x + d, y) - face(x - d, y)) / (2 * d),
    -(face(x, y + d) - face(x, y - d)) / (2 * d),
    1,
  ).normalize();
  mesh.position.set(x, y, face(x, y)).addScaledVector(n, proud);
  mesh.position.z *= dir;
  // The rear cab is the front one turned half round (a turn, not a mirror, so parts keep
  // their orientation): align to the normal at -x, then turn about Y.
  const Z = new T.Vector3(0, 0, 1);
  if (dir > 0) mesh.quaternion.setFromUnitVectors(Z, n);
  else
    mesh.quaternion
      .setFromAxisAngle(new T.Vector3(0, 1, 0), Math.PI)
      .multiply(new T.Quaternion().setFromUnitVectors(Z, new T.Vector3(-n.x, n.y, n.z)));
  return mesh;
}
function band(dir, indices, lower, upper, out = []) {
  const a = plan(dir, lower[1], lower[0]),
    b = plan(dir, upper[1], upper[0]);
  for (let k = 0; k < indices.length - 1; k++) {
    const i = indices[k],
      j = indices[k + 1];
    const p = [a[i][0], lower[0], a[i][1]],
      q = [a[j][0], lower[0], a[j][1]],
      r = [b[j][0], upper[0], b[j][1]],
      s = [b[i][0], upper[0], b[i][1]];
    out.push([p, q, r], [p, r, s]);
  }
  return out;
}
// Raised strip on the cab face (a lamp cluster) from x0 to x1 between heights y0 and y1,
// standing `proud` along the surface normal with chamfered edges; its ends run out flush, so
// it stays closed.
function faceStrip(dir, x0, x1, y0, y1, proud, out = []) {
  const n = 6,
    d = 0.02,
    e = Math.min(0.012, (y1 - y0) / 4);
  const rings = [
    [y0, 0],
    [y0 + e, proud],
    [y1 - e, proud],
    [y1, 0],
  ].map(([y, p]) =>
    Array.from({ length: n + 1 }, (_, k) => {
      const x = x0 + ((x1 - x0) * k) / n;
      const normal = new T.Vector3(
        -(face(x + d, y) - face(x - d, y)) / (2 * d),
        -(face(x, y + d) - face(x, y - d)) / (2 * d),
        1,
      ).normalize();
      const v = new T.Vector3(x, y, face(x, y)).addScaledVector(normal, p * Math.min(1, k, n - k));
      return [v.x, v.y, dir * v.z];
    }),
  );
  for (let r = 1; r < rings.length; r++)
    for (let k = 1; k <= n; k++) {
      const [p, q, s, t] = [rings[r - 1][k - 1], rings[r - 1][k], rings[r][k], rings[r][k - 1]];
      out.push([p, q, s], [p, s, t]);
    }
  return out;
}
// Triangles face away from `centre(z)`, so the shell renders from outside.
function surface(name, material, triangles, centre) {
  const p = [];
  const a = new T.Vector3(),
    b = new T.Vector3(),
    c = new T.Vector3(),
    n = new T.Vector3(),
    o = new T.Vector3();
  for (const t of triangles) {
    a.fromArray(t[0]);
    b.fromArray(t[1]);
    c.fromArray(t[2]);
    n.subVectors(b, a).cross(o.subVectors(c, a));
    if (n.lengthSq() < 1e-12) continue;
    o.copy(a)
      .add(b)
      .add(c)
      .multiplyScalar(1 / 3);
    o.sub(centre(o.z));
    for (const v of n.dot(o) < 0 ? [a, c, b] : [a, b, c]) p.push(v.x, v.y, v.z);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return Object.assign(new T.Mesh(g, material), { name });
}
// Rounded window or door opening, (z, y) centre and size.
function opening(z, y, w, h, r = 0.09) {
  return [
    [z - w / 2 + r, y - h / 2],
    [z + w / 2 - r, y - h / 2],
    [z + w / 2, y - h / 2 + r],
    [z + w / 2, y + h / 2 - r],
    [z + w / 2 - r, y + h / 2],
    [z - w / 2 + r, y + h / 2],
    [z - w / 2, y + h / 2 - r],
    [z - w / 2, y - h / 2 + r],
  ];
}
// Skirt height along the car: body-colour skirts run low over the bogies as well (low-floor
// look), clear of the wheels outboard of them.
const skirt = () => SKIRT;

function bogie(parent, name, z, motor) {
  const g = new T.Group();
  g.name = name;
  g.position.set(0, 0, z);
  parent.add(g);
  // Transom between two side frames outboard of the wheels, axle boxes and springs.
  box(g, 'bogie-frame', [1.5, 0.2, 0.45], [0, 0.56, 0], trim);
  for (const x of [-0.86, 0.86]) {
    box(g, 'bogie-side-frame', [0.14, 0.24, 2.5], [x, 0.5, 0], trim);
    box(g, 'bogie-side-frame', [0.14, 0.18, 0.9], [x, 0.66, 0], trim);
    for (const dz of [-0.9, 0.9]) {
      box(g, 'axle-box', [0.18, 0.22, 0.3], [x, 0.36, dz], rim);
      box(g, 'spring', [0.12, 0.16, 0.16], [x, 0.58, dz], rim);
    }
  }
  if (motor)
    for (const dz of [-0.45, 0.45]) box(g, 'traction-motor', [0.8, 0.34, 0.42], [0, 0.4, dz], trim);
  for (const dz of [-0.9, 0.9])
    for (const x of [-0.72, 0.72]) {
      const pivot = new T.Group();
      pivot.name = `${name}-wheel-${dz < 0 ? 'rear' : 'front'}-${x < 0 ? 'right' : 'left'}`;
      pivot.position.set(x, 0.34, dz);
      g.add(pivot);
      const spin = new T.Group();
      spin.name = `${pivot.name}-spin`;
      pivot.add(spin);
      const wheel = new T.Mesh(new T.CylinderGeometry(0.34, 0.34, 0.14, 24), rim);
      wheel.name = 'rail-wheel-tread';
      wheel.rotation.z = Math.PI / 2;
      spin.add(wheel);
      const flange = new T.Mesh(new T.CylinderGeometry(0.365, 0.365, 0.025, 24), trim);
      flange.rotation.z = Math.PI / 2;
      flange.position.x = -Math.sign(x) * 0.065;
      spin.add(flange);
    }
  for (const dz of [-0.9, 0.9]) rod(g, 'axle', [-0.8, 0.34, dz], [0.8, 0.34, dz], 0.06, trim);
}

// One body section: rounded cab end, flush side walls with window and door openings, radiused
// roof. dir +1 builds the front section, -1 the rear one.
function section(body, dir) {
  const centre = (z) =>
    new T.Vector3(0, 2.0, dir * Math.max(ART + 1.6, Math.min(CAB - 1.6, dir * z)));
  // The cab surfaces are banded at the profile knots so the nose and the screen curve.
  const knots = (lo, hi) => PROFILE.map(([h]) => h).filter((h) => h >= lo && h <= hi);
  const bands = (indices, heights, inset, out = []) => {
    for (let k = 1; k < heights.length; k++)
      band(dir, indices, [heights[k - 1], inset], [heights[k], inset], out);
    return out;
  };
  const shell = bands(CAB_END, knots(0.6, SCREEN), 0);
  band(dir, AFT, [HEAD, 0], [EDGE, 0], shell);
  band(dir, ART_END, [TRUCK_SKIRT, 0], [HEAD, 0], shell);
  // Roof edge: a quarter ellipse from the wall into the flat deck.
  const roofEdge = [0, 1, 2, 3].map((k) => {
    const a = (k * Math.PI) / 6;
    return [EDGE + (CROWN - EDGE) * Math.sin(a), 0.3 * (1 - Math.cos(a))];
  });
  for (let k = 1; k < roofEdge.length; k++) band(dir, ALL, roofEdge[k - 1], roofEdge[k], shell);
  const deck = plan(dir, 0.3, CROWN);
  for (const tri of T.ShapeUtils.triangulateShape(
    deck.map(([x, z]) => new T.Vector2(x, z)),
    [],
  ))
    shell.push(tri.map((i) => [deck[i][0], CROWN, deck[i][1]]));
  body.add(surface('body-shell', paint, shell, centre));
  // Dark apron under the nose, round the coupler.
  body.add(surface('nose-apron', trim, band(dir, CAB_END, [SKIRT, 0], [0.6, 0]), centre));
  const screen = knots(SCREEN, SCREEN_HEAD);
  // The driver looks out through the clear centre; the wraps round the corners are tinted
  // like the saloon glass, so the cab reads dark from the side.
  body.add(surface('windscreen', glass, bands(range(3, 2 * N - 2), screen, 0), centre));
  const wraps = bands(range(1, 3), screen, 0);
  body.add(
    surface('windscreen', doorGlass, bands(range(2 * N - 2, 2 * N), screen, 0, wraps), centre),
  );
  // Dark gasket under the screen, posts at the corners and a header into the roof; each
  // overlay spans the same heights as the surface beside it, so the facets match.
  const frame = band(dir, CAB_END, [SCREEN - 0.07, -0.006], [SCREEN, -0.006]);
  for (const k of [0, 2 * N]) bands([k, k + 1], screen, -0.006, frame);
  band(dir, CAB_END, [SCREEN_HEAD, -0.006], [EDGE, -0.006], frame);
  body.add(surface('windscreen-frame', trim, frame, centre));
  // Destination sign behind the top of the glass.
  body.add(
    surface(
      'destination-sign',
      signPanel,
      band(dir, SCREEN_SPAN, [SIGN[0], 0.03], [SIGN[1], 0.03]),
      centre,
    ),
  );
  // Livery stripe below the windows wraps the cab.
  body.add(
    surface(
      'stripe',
      livery,
      band(dir, CAB_END, [STRIPE - 0.07, -0.006], [STRIPE + 0.07, -0.006]),
      centre,
    ),
  );

  // Side walls between the corner radii, split by the doors, with rounded window openings.
  const z0 = ART + RA,
    z1 = CAB - RCZ;
  const doors = DOORS.map((d) => [d - DOOR_W / 2, d + DOOR_W / 2]);
  const spans = [
    [z0, doors[0][0]],
    [doors[0][1], doors[1][0]],
    [doors[1][1], z1],
  ];
  // Shapes are drawn at world z (dir applied) so both sections keep outward-facing walls.
  const walls = [];
  const v2 = ([z, y]) => new T.Vector2(dir * z, y);
  for (const [a, b] of spans) {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const z = a + ((b - a) * i) / 24;
      pts.push([z, skirt(z)]);
    }
    pts.push([b, HEAD], [a, HEAD]);
    const shape = new T.Shape(pts.map(v2));
    // Passenger windows fill each span between pillars; the cab span ends in the cab window.
    const end = b === z1 ? CAB - 1.95 : b;
    const n = Math.max(1, Math.round((end - a) / 1.6));
    const pitch = (end - a) / n;
    const windows = Array.from({ length: n }, (_, i) => [a + pitch * (i + 0.5), pitch - 0.3]);
    if (b === z1) windows.push([CAB - 1.575, 0.75]);
    for (const [z, w] of windows)
      shape.holes.push(
        new T.Path(opening(z, (SILL + HEAD - 0.08) / 2, w, HEAD - SILL - 0.16).map(v2)),
      );
    walls.push(
      new T.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false }).rotateY(-Math.PI / 2),
    );
  }
  const wall = mergeGeometries(walls);
  const frames = [];
  for (const side of [-1, 1]) {
    const m = new T.Mesh(wall.clone(), paint);
    m.name = 'side-wall';
    m.position.x = side > 0 ? W / 2 : -W / 2 + 0.04;
    body.add(m);
    const x = (side * W) / 2;
    // Flush glazing behind the openings (tinted along the saloon, clear at the cab), and the
    // livery stripe.
    const cabGlass = CAB - 2.02;
    for (const [a, b, m] of [
      [z0, cabGlass, doorGlass],
      [cabGlass, z1, glass],
    ])
      box(
        body,
        'side-glass',
        [0.012, HEAD - SILL, b - a],
        [x - side * 0.035, (SILL + HEAD) / 2, (dir * (a + b)) / 2],
        m,
      );
    box(
      body,
      'stripe',
      [0.012, 0.14, z1 - z0],
      [x + side * 0.004, STRIPE, (dir * (z0 + z1)) / 2],
      livery,
    );
    // Plug doors: painted leaves with tall dark windows reaching well below the saloon sill, a
    // dark frame round the opening, a centre seal and a sill panel.
    for (const [d0, d1] of doors) {
      const zc = (dir * (d0 + d1)) / 2;
      for (const dz of [-DOOR_W / 4, DOOR_W / 4]) {
        box(
          body,
          'door',
          [0.03, HEAD - FLOOR - 0.04, DOOR_W / 2 - 0.03],
          [x - side * 0.02, (HEAD + FLOOR) / 2, zc + dz],
          paint,
        );
        box(
          body,
          'door-window',
          [0.036, 1.55, DOOR_W / 2 - 0.16],
          [x - side * 0.02, 2.1, zc + dz],
          doorGlass,
        );
      }
      for (const dz of [-DOOR_W / 2, DOOR_W / 2])
        frames.push(
          new T.BoxGeometry(0.04, HEAD - FLOOR + 0.05, 0.05).translate(
            x - side * 0.012,
            (HEAD + FLOOR) / 2,
            zc + dz,
          ),
        );
      frames.push(
        new T.BoxGeometry(0.04, 0.05, DOOR_W + 0.05).translate(x - side * 0.012, HEAD, zc),
      );
      box(
        body,
        'door-seal',
        [0.04, HEAD - FLOOR, 0.03],
        [x - side * 0.015, (HEAD + FLOOR) / 2, zc],
        trim,
      );
      const low = skirt((d0 + d1) / 2);
      box(
        body,
        'door-sill',
        [0.04, FLOOR - low, DOOR_W],
        [x - side * 0.02, (FLOOR + low) / 2, zc],
        paint,
      );
      box(body, 'door-step', [0.05, 0.05, DOOR_W], [x, FLOOR, zc], trim);
    }
  }
  body.add(Object.assign(new T.Mesh(mergeGeometries(frames), trim), { name: 'door-frame' }));
  // Articulation end wall above the middle truck.
  // Cab face: destination sign, head, marker and tail lamps, anticlimber and coupler.
  // Lamp clusters set into the nose round each corner (a dark housing with the headlamp
  // inboard and the tail lamp outboard), marker lamps behind the glass beside the sign.
  const zf = dir * CAB;
  const clusters = { housing: [], head: [], tail: [] };
  for (const side of [-1, 1]) {
    const across = (x0, x1) => (side > 0 ? [x0, x1] : [-x1, -x0]);
    faceStrip(dir, ...across(0.5, 1.2), 0.96, 1.26, 0.016, clusters.housing);
    faceStrip(dir, ...across(0.56, 0.98), 1.04, 1.18, 0.03, clusters.head);
    faceStrip(dir, ...across(1.02, 1.16), 1.02, 1.2, 0.03, clusters.tail);
    const signY = (SIGN[0] + SIGN[1]) / 2;
    onFace(box(body, 'marker-lamp', [0.08, 0.06, 0.03], [0, 0, 0], tail), dir, side, signY, -0.022);
  }
  body.add(surface('lamp-housing', trim, clusters.housing, centre));
  body.add(surface('headlamp', lamp, clusters.head, centre));
  body.add(surface('tail-lamp', tail, clusters.tail, centre));
  box(body, 'anticlimber', [W - 1.3, 0.16, 0.16], [0, 0.48, dir * (face(0, 0.48) - 0.02)], trim);
  box(body, 'coupler-shroud', [0.5, 0.26, 0.4], [0, 0.4, dir * (face(0, 0.4) - 0.02)], trim);
  // Roof spotlight on the leading edge of the roof deck.
  const roofFront = face(0, CROWN, 0.3);
  const spot = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, 0.08, 12).rotateX(Math.PI / 2), lamp);
  spot.name = 'roof-headlamp';
  spot.position.set(0, CROWN + 0.08, dir * (roofFront - 0.12));
  body.add(spot);
  box(
    body,
    'roof-headlamp-mount',
    [0.12, 0.08, 0.12],
    [0, CROWN + 0.02, dir * (roofFront - 0.15)],
    trim,
  );
  // Mirror / camera pods on arms from the cab sides, ahead of the cab windows.
  for (const side of [-1, 1]) {
    rod(
      body,
      'mirror-arm',
      [side * (W / 2 - 0.02), 2.95, zf - dir * (RCZ + 0.12)],
      [side * (W / 2 + 0.19), 2.88, zf - dir * (RCZ - 0.16)],
      0.03,
      trim,
    );
    box(
      body,
      'mirror',
      [0.1, 0.16, 0.26],
      [side * (W / 2 + 0.21), 2.82, zf - dir * (RCZ - 0.2)],
      trim,
    );
  }
  // Cab back wall behind the driver's seat: it closes the cab off from the saloon, so the
  // windscreen reads dark from outside as on the real car.
  box(
    body,
    'cab-bulkhead',
    [W - 0.1, CROWN - FLOOR - 0.12, 0.05],
    [0, (FLOOR + CROWN - 0.12) / 2, zf - dir * 1.75],
    trim,
  );
  // Rooftop air-conditioning unit near the cab, faired like the roof.
  const hv = [];
  const hvPlan = (inset, y) => {
    const hw = 0.82 - inset,
      za = CAB - 4.4 + inset,
      zb = CAB - 1.6 - inset,
      r = Math.max(0.25 - inset, 0.02);
    const out = [];
    for (const [cx, cz, a0] of [
      [hw - r, zb - r, 0],
      [-hw + r, zb - r, Math.PI / 2],
      [-hw + r, za + r, Math.PI],
      [hw - r, za + r, Math.PI * 1.5],
    ])
      for (let i = 0; i <= 3; i++) {
        const a = a0 + (i * Math.PI) / 6;
        out.push([cx + r * Math.cos(a), y, dir * (cz + r * Math.sin(a))]);
      }
    return out;
  };
  const rings = [hvPlan(0, CROWN - 0.01), hvPlan(0, CROWN + 0.24), hvPlan(0.08, CROWN + 0.31)];
  for (let k = 0; k < 2; k++)
    for (let i = 0; i < 16; i++) {
      const j = (i + 1) % 16;
      hv.push(
        [rings[k][i], rings[k][j], rings[k + 1][j]],
        [rings[k][i], rings[k + 1][j], rings[k + 1][i]],
      );
    }
  for (let i = 1; i < 15; i++) hv.push([rings[2][0], rings[2][i], rings[2][i + 1]]);
  const hvCentre = new T.Vector3(0, CROWN - 0.2, dir * (CAB - 3));
  body.add(surface('roof-hvac', paint, hv, () => hvCentre));
  for (let i = 0; i < 5; i++)
    box(
      body,
      'hvac-grille',
      [1.2, 0.012, 0.08],
      [0, CROWN + 0.312, dir * (CAB - 3.8 + i * 0.4)],
      trim,
    );
}

function lightRail() {
  const g = new T.Group();
  g.name = 'light-rail-car';
  const body = new T.Group();
  body.name = 'body';
  g.add(body);
  for (const [i, dir] of [
    [0, 1],
    [1, -1],
  ]) {
    box(
      body,
      `floor-${i}`,
      [W - 0.12, 0.1, CAB - ART - 0.4],
      [0, FLOOR, (dir * (CAB + ART)) / 2],
      trim,
    );
    section(body, dir);
  }
  // Articulation bellows over the middle truck, with a turntable skirt.
  box(
    body,
    'articulation',
    [W - 0.3, HEAD - TRUCK_SKIRT + 0.45, 2 * ART + 0.04],
    [0, (HEAD + 0.45 + TRUCK_SKIRT) / 2, 0],
    trim,
  );
  // Roof equipment: braking resistors on the rear section; single-arm pantograph on the front.
  box(body, 'roof-equipment', [W * 0.55, 0.26, 3.2], [0, CROWN + 0.12, -L / 4 + 0.5], trim);
  for (let i = 0; i < 6; i++)
    box(
      body,
      'roof-equipment-fin',
      [W * 0.5, 0.02, 0.06],
      [0, CROWN + 0.26, -L / 4 - 0.9 + i * 0.55],
      rim,
    );
  const pantograph = new T.Group();
  pantograph.name = 'pantograph';
  pantograph.position.set(0, CROWN + 0.04, L / 4 - 0.5);
  body.add(pantograph);
  box(pantograph, 'pantograph-base', [1.2, 0.08, 1.6], [0, 0.1, 0], trim);
  for (const x of [-0.5, 0.5])
    for (const z of [-0.65, 0.65])
      box(pantograph, 'pantograph-insulator', [0.1, 0.12, 0.1], [x, 0.0, z], rim);
  for (const x of [-0.22, 0.22]) {
    rod(pantograph, 'pantograph-arm', [x, 0.16, -0.6], [x * 0.3, 0.62, 0.62], 0.03, rim);
    rod(pantograph, 'pantograph-arm', [x * 0.3, 0.62, 0.62], [x * 0.5, 1.0, -0.25], 0.022, rim);
  }
  rod(pantograph, 'pantograph-arm', [0, 0.16, -0.6], [0, 0.42, 0.25], 0.012, rim);
  box(pantograph, 'pantograph-head', [1.3, 0.05, 0.12], [0, 1.03, -0.25], rim);
  for (const x of [-1, 1])
    rod(pantograph, 'pantograph-horn', [x * 0.65, 1.03, -0.25], [x * 0.88, 0.94, -0.25], 0.02, rim);
  bogie(g, 'bogie-front', TRUCKS[0], true);
  bogie(g, 'bogie-middle', TRUCKS[1], false);
  bogie(g, 'bogie-rear', TRUCKS[2], true);
  glass.opacity = 0.18;
  glass.depthWrite = false;
  addTransitDetail(g, true, { face, signY: (SIGN[0] + SIGN[1]) / 2, signInset: 0.022 });
  return g;
}

// source.json pins the master this generator last wrote. A master that matches neither the pin
// nor this run's output was edited by hand, and regenerating would discard that work.
const sourcePath = resolve(root, '../source.json');
const sourceText = await readFile(sourcePath, 'utf8');
const pinned = JSON.parse(sourceText).files.models.find(
  (m) => m.path === 'models/source.glb',
)?.sha256;
const bytes = Buffer.from(
  await new GLTFExporter().parseAsync(lightRail(), { binary: true, onlyVisible: false }),
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
if (pinned !== generatedHash)
  await writeFile(sourcePath, sourceText.replace(pinned ?? 'sha256:pending', generatedHash));
console.log(`light-rail-car: ${bytes.length} bytes, ${generatedHash}`);
