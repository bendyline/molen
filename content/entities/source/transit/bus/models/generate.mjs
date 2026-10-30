/**
 * Deterministic master for a 12 m low-floor city bus. No network, textures or private tools.
 * Front faces +Z, the kerb-side doors are on the right (-X), wheels sit on y = 0.
 * Run `node models/generate.mjs` to rewrite models/source.glb (hand edits are preserved: a
 * master matching neither source.json's pin nor this output is left alone), or
 * `node models/generate.mjs --out /tmp/bus-candidate.glb` to review a candidate.
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
// Off-white, never pure white on a large surface (medium-fi palette). Liveries recolor this
// material by node (source/liveries.json), so the body keeps its node names and material.
const paint = mat('vehicle-paint-and-trim', '#e8e6de', 0.15, 0.42);
const tint = mat('tinted-glass', '#1c2830', 0.15, 0.15, {
  transparent: true,
  opacity: 0.62,
  depthWrite: false,
});
const glass = mat('vehicle-glass', '#26343c', 0.1, 0.12, { transparent: true, opacity: 0.82 });
// Wheel housings are seen from inside their arches, so the trim renders both faces.
const trim = mat('trim-charcoal', '#22272b', 0.05, 0.7, { side: T.DoubleSide });
const rubber = mat('rubber', '#141718', 0, 0.92);
const rim = mat('wheel-rim', '#9aa2a6', 0.7, 0.35);
const lamp = mat('lamp-lens', '#fff4d6', 0, 0.3, { emissive: '#fff4d6', emissiveIntensity: 0.6 });
const tail = mat('tail-lens', '#c9302c', 0, 0.3, { emissive: '#8a1512', emissiveIntensity: 0.5 });
// The sign band is seen from the driver's seat too, so it renders both faces.
const sign = mat('destination-sign', '#12161a', 0, 0.5, { side: T.DoubleSide });
const marker = mat('marker-lens', '#e8992e', 0, 0.3, {
  emissive: '#9a5300',
  emissiveIntensity: 0.5,
});

const L = 12.0; // length
const W = 2.55; // width
const H = 3.2; // height over the roof pod
const WHEEL_R = 0.5;
// Axles of a 12 m low-floor city bus, measured from a side profile: 2.6 m front overhang (the
// front door sits ahead of the axle) and 3.3 m rear overhang over the engine.
const FRONT_AXLE = L / 2 - 2.6;
const REAR_AXLE = -L / 2 + 3.3;
// Section heights above the road: skirt, interior floor, windscreen base, side window sill, engine
// bay top (the rear window is a strip above the tall engine compartment), side window head, roof
// edge and roof deck.
const SKIRT = 0.27,
  FLOOR = 0.36,
  SCREEN = 1.08,
  SILL = 1.17,
  ENGINE = 1.72,
  WIN = 2.42,
  EDGE = 2.86,
  CROWN = 2.97;
const ARCH = WHEEL_R + 0.08; // wheel opening radius
// Plan-view corners: the front ones are quarter ellipses (RFX across, RF along), so the whole
// windscreen curves; the rear ones are circles.
const RFX = 0.85,
  RF = 0.5,
  RR = 0.36,
  N = 6; // segments per corner
const RAKE = 0.2; // the windscreen leans back this far between its base and the roof
const CAP = 0.12; // the rear cap leans in this far between the engine bay and the roof
// Destination sign behind the top of the windscreen (a dark header band), and its lettering.
const HEADER = 2.47,
  SIGN_Y = 2.665;
// Kerb-side door openings (z0, z1): a double door ahead of the front axle and one mid-body.
const DOORS = [
  [L / 2 - 1.9, L / 2 - 0.7],
  [-1.0, 0.2],
];

function box(parent, name, size, pos, material) {
  const mesh = new T.Mesh(new T.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...pos);
  parent.add(mesh);
  return mesh;
}

// Rounded-rectangle plan outline at `inset` from the body sides, as [x, z] points: front-left
// corner, front-right corner, rear-right corner, rear-left corner (N + 1 points each). Points on
// the front corners lean back with height `y` so the windscreen rakes; the rear corners lean in
// above the engine bay, rounding the rear cap.
const COUNT = 4 * (N + 1);
const FRONT = range(0, 2 * N + 1),
  REAR = range(2 * N + 2, 4 * N + 3),
  // Right side, rear, left side: everything but the windscreen.
  AFT = range(2 * N + 1, 0);
function range(a, b) {
  const out = [a];
  for (let i = a; i !== b; ) {
    i = (i + 1) % COUNT;
    out.push(i);
  }
  return out;
}
function plan(inset, y) {
  const hw = W / 2 - inset,
    zf = L / 2 - inset,
    zr = -L / 2 + inset;
  const rfx = Math.max(RFX - inset, 0.02),
    rf = Math.max(RF - inset, 0.02),
    rr = Math.max(RR - inset, 0.02);
  const lean = RAKE * Math.min(1, Math.max(0, (y - SCREEN) / (EDGE - SCREEN))),
    cap = CAP * Math.min(1, Math.max(0, (y - ENGINE) / (EDGE - ENGINE)));
  const out = [];
  const arc = (cx, cz, rx, rz, a0) => {
    for (let i = 0; i <= N; i++) {
      const a = a0 + (i * Math.PI) / (2 * N);
      out.push([cx + rx * Math.cos(a), cz + rz * Math.sin(a)]);
    }
  };
  arc(hw - rfx, zf - rf, rfx, rf, 0);
  arc(-hw + rfx, zf - rf, rfx, rf, Math.PI / 2);
  arc(-hw + rr, zr + rr, rr, rr, Math.PI);
  arc(hw - rr, zr + rr, rr, rr, Math.PI * 1.5);
  return out.map(([x, z]) => [
    x,
    z > zf - rf
      ? z - (lean * (z - zf + rf)) / rf
      : z < zr + rr
        ? z + (cap * (zr + rr - z)) / rr
        : z,
  ]);
}
// Rear surface z at height y on the centreline (the rear cap leans in above the engine bay).
const rearFace = (y) => plan(0, y)[3 * N + 2][1];
// Front surface z at (x, y), interpolated along the plan outline, so the lettering, wipers and
// cab fascia follow the raked windscreen.
function face(x, y, inset = 0) {
  const outline = plan(inset, y);
  const p = FRONT.map((i) => outline[i]);
  for (let k = 1; k < p.length; k++) {
    const [xa, za] = p[k - 1],
      [xb, zb] = p[k];
    if (x <= xa && x >= xb) return xa - xb < 1e-9 ? za : za + ((zb - za) * (xa - x)) / (xa - xb);
  }
  return p[0][1];
}
// Lamp strip on the front corner of `side`, along the skin from arc length s0 to s1 (measured
// from the centreline across the flat face and round the plan radius). Rows are [y, proud]; the
// strip runs out flush at both ends so it stays closed.
function cornerStrip(side, s0, s1, rows, out) {
  const flat = W / 2 - RFX;
  const at = (s) => {
    if (s <= flat) return [s, L / 2, 0, 1];
    // Round the elliptical corner at roughly constant speed.
    const a = Math.PI / 2 - (2 * (s - flat)) / (RFX + RF);
    const n = Math.hypot(Math.cos(a) / RFX, Math.sin(a) / RF);
    return [
      flat + RFX * Math.cos(a),
      L / 2 - RF + RF * Math.sin(a),
      Math.cos(a) / RFX / n,
      Math.sin(a) / RF / n,
    ];
  };
  const n = 8;
  const path = Array.from({ length: n + 1 }, (_, k) => at(s0 + ((s1 - s0) * k) / n));
  const grid = rows.map(([y, proud]) =>
    path.map(([x, z, nx, nz], k) => {
      const t = proud * Math.min(1, k, n - k);
      return [side * (x + nx * t), y, z + nz * t];
    }),
  );
  for (let r = 1; r < grid.length; r++)
    for (let k = 1; k <= n; k++) {
      const [p, q, s, t] = [grid[r - 1][k - 1], grid[r - 1][k], grid[r][k], grid[r][k - 1]];
      out.push([p, q, s], [p, s, t]);
    }
  return out;
}

// Triangles face away from the body's long axis (or `centre`), so shells render from outside.
function surface(name, material, triangles, parent, centre) {
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
    o.sub(centre ?? new T.Vector3(0, 1.4, Math.max(-L / 2 + 1.6, Math.min(L / 2 - 1.6, o.z))));
    for (const v of n.dot(o) < 0 ? [a, c, b] : [a, b, c]) p.push(v.x, v.y, v.z);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  const mesh = new T.Mesh(g, material);
  mesh.name = name;
  parent.add(mesh);
  return mesh;
}
// Band between two plan outlines (lower and upper edge), over the listed outline points.
function band(indices, lower, upper, out = []) {
  const a = plan(lower[1], lower[0]),
    b = plan(upper[1], upper[0]);
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

// Painted lower side between two z limits, with round-topped wheel openings.
function lowerSide(z0, z1) {
  const pts = [[z0, SKIRT]];
  for (const axle of [REAR_AXLE, FRONT_AXLE]) {
    if (axle - ARCH <= z0 || axle + ARCH >= z1) continue;
    pts.push([axle - ARCH, SKIRT], [axle - ARCH, WHEEL_R]);
    for (let i = 1; i < 16; i++) {
      const a = Math.PI - (i * Math.PI) / 16;
      pts.push([axle + ARCH * Math.cos(a), WHEEL_R + ARCH * Math.sin(a)]);
    }
    pts.push([axle + ARCH, WHEEL_R], [axle + ARCH, SKIRT]);
  }
  pts.push([z1, SKIRT], [z1, SILL], [z0, SILL]);
  const shape = new T.Shape(pts.map(([z, y]) => new T.Vector2(z, y)));
  return new T.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false }).rotateY(-Math.PI / 2);
}

function wheel(parent, name, x, z) {
  const group = new T.Group();
  group.name = name;
  group.position.set(x, WHEEL_R, z);
  parent.add(group);
  // The first child spins about X (createVehicleVisual rotates children[0].rotation.x).
  const spinner = new T.Group();
  spinner.name = `${name}-spin`;
  group.add(spinner);
  // Profiles are [radius, offset along the axle], swept round the axle (lathe Y turned to X).
  const lathe = (points, material, meshName) => {
    const geometry = new T.LatheGeometry(
      points.map(([r, a]) => new T.Vector2(r, a)),
      20,
    ).rotateZ(-Math.PI / 2);
    spinner.add(Object.assign(new T.Mesh(geometry, material), { name: meshName }));
  };
  // Tyre: tread, rounded shoulders and sidewalls down to the bead.
  lathe(
    [
      [0.29, -0.15],
      [0.43, -0.16],
      [0.48, -0.15],
      [WHEEL_R, -0.12],
      [WHEEL_R, 0.12],
      [0.48, 0.15],
      [0.43, 0.16],
      [0.29, 0.15],
    ],
    rubber,
    'wheel-mesh',
  );
  // 22.5 in steel disc wheel: rim flange, dished disc and a hub boss standing out of the dish.
  // The rear wheel is the outer one of a dual pair, so its disc sits deep inside the tyre.
  const dish = z < 0 ? 0.08 : 0.025,
    floor = 0.15 - dish,
    boss = floor + 0.06;
  const half = [
    [0.29, 0.15],
    [0.27, 0.14],
    [0.255, floor],
    [0.14, floor],
    [0.12, boss],
    [0, boss],
  ];
  lathe([...half.map(([r, a]) => [r, -a]).reverse(), ...half], rim, 'wheel-hub');
  // Wheel nuts and cap on the boss, hand holes in the dish (outer face only).
  const out = Math.sign(x);
  const nuts = [
    new T.CylinderGeometry(0.06, 0.06, 0.03, 12)
      .rotateZ(Math.PI / 2)
      .translate(out * (boss + 0.015), 0, 0),
  ];
  const holes = [];
  for (let k = 0; k < 10; k++) {
    const a = (k * Math.PI) / 5;
    nuts.push(
      new T.CylinderGeometry(0.014, 0.014, 0.024, 6)
        .rotateZ(Math.PI / 2)
        .translate(out * (boss + 0.012), Math.cos(a) * 0.09, Math.sin(a) * 0.09),
    );
    if (k < 8)
      holes.push(
        new T.CylinderGeometry(0.032, 0.032, 0.006, 8)
          .rotateZ(Math.PI / 2)
          .translate(out * (floor + 0.003), Math.cos(a * 1.25) * 0.2, Math.sin(a * 1.25) * 0.2),
      );
  }
  spinner.add(Object.assign(new T.Mesh(mergeGeometries(nuts), rim), { name: 'wheel-nuts' }));
  spinner.add(Object.assign(new T.Mesh(mergeGeometries(holes), trim), { name: 'wheel-holes' }));
}

function bus() {
  const g = new T.Group();
  g.name = 'bus';
  const body = new T.Group();
  body.name = 'body';
  g.add(body);
  // Floor, narrowed between the wheel housings so it never shows through the dished wheels.
  const floorStations = [
    -L / 2 + 0.4,
    REAR_AXLE - ARCH,
    REAR_AXLE + ARCH,
    FRONT_AXLE - ARCH,
    FRONT_AXLE + ARCH,
    L / 2 - 0.4,
  ];
  const floor = floorStations
    .slice(1)
    .map((b, k) =>
      new T.BoxGeometry(k % 2 ? W - 0.76 : W - 0.1, 0.1, b - floorStations[k]).translate(
        0,
        FLOOR,
        (b + floorStations[k]) / 2,
      ),
    );
  body.add(Object.assign(new T.Mesh(mergeGeometries(floor), trim), { name: 'floor' }));
  // Straight sides run between the corner radii; the kerb side is split by its door openings.
  const za = -L / 2 + RR,
    zb = L / 2 - RF;
  for (const side of [1, -1]) {
    const x = (side * W) / 2;
    const spans = [[za, zb]];
    if (side < 0)
      for (const [d0, d1] of DOORS) {
        const s = spans.findIndex(([a, b]) => a < d0 && d1 < b);
        spans.splice(s, 1, [spans[s][0], d0], [d1, spans[s][1]]);
      }
    // One painted lower side per side (the livery slot), with round wheel openings.
    const lower = mergeGeometries(
      spans.map(([a, b]) => lowerSide(a, b).translate(side > 0 ? x : x + 0.04, 0, 0)),
    );
    body.add(Object.assign(new T.Mesh(lower, paint), { name: 'lower-side' }));
    // Sill rubbing band, flush side glazing and window pillars.
    const belt = mergeGeometries(
      spans.map(([a, b]) =>
        new T.BoxGeometry(0.03, 0.09, b - a).translate(x + side * 0.008, SILL, (a + b) / 2),
      ),
    );
    body.add(Object.assign(new T.Mesh(belt, paint), { name: 'belt-side' }));
    const panes = mergeGeometries(
      spans.map(([a, b]) =>
        new T.BoxGeometry(0.012, WIN - SILL, b - a).translate(
          x - side * 0.012,
          (SILL + WIN) / 2,
          (a + b) / 2,
        ),
      ),
    );
    body.add(Object.assign(new T.Mesh(panes, tint), { name: 'window-band' }));
    const posts =
      side > 0
        ? Array.from({ length: 9 }, (_, i) => zb - 0.55 - (i * (zb - za - 0.75)) / 8)
        : [za + 0.2, -4.47, -3.38, ...DOORS[1], 1.5, 2.8, ...DOORS[0]];
    for (const z of posts)
      box(body, 'pillar', [0.03, WIN - SILL, 0.09], [x - side * 0.002, (SILL + WIN) / 2, z], paint);
    // Wheel housings close the arches from the cabin; lips trim the openings.
    for (const axle of [FRONT_AXLE, REAR_AXLE]) {
      const well = new T.Mesh(
        new T.CylinderGeometry(ARCH - 0.02, ARCH - 0.02, 0.5, 16, 1, true, 0, Math.PI),
        trim,
      );
      well.name = 'wheel-well';
      well.rotation.z = Math.PI / 2;
      well.position.set(x - side * 0.28, WHEEL_R, axle);
      body.add(well);
      const cap = new T.Mesh(new T.CircleGeometry(ARCH - 0.02, 16, 0, Math.PI), trim);
      cap.name = 'wheel-well';
      cap.rotation.y = Math.PI / 2;
      cap.position.set(x - side * 0.53, WHEEL_R, axle);
      body.add(cap);
      const lip = new T.Mesh(new T.TorusGeometry(ARCH + 0.02, 0.05, 4, 16, Math.PI), trim);
      lip.name = 'arch-lip';
      lip.rotation.y = Math.PI / 2;
      lip.position.set(x + side * 0.015, WHEEL_R, axle);
      body.add(lip);
    }
  }
  // Ends: rounded lower front and engine bay (the 'lower-end' livery slots).
  surface('lower-end', paint, band(FRONT, [SKIRT, 0], [SCREEN, 0]), body);
  surface('lower-end', paint, band(REAR, [SKIRT, 0], [ENGINE, 0]), body);
  // Wraparound windscreen up to the roof, and the rear window over the engine bay.
  surface('windscreen', glass, band(FRONT, [SCREEN, 0], [EDGE, 0]), body);
  surface('rear-window', tint, band(REAR, [ENGINE, 0], [WIN, 0]), body);
  // Upper band and radiused roof. The roof deck is one flat polygon inside the radius.
  const roof = band(AFT, [WIN, 0], [EDGE, 0]);
  // Roof edge: a quarter ellipse from the walls into the deck.
  const roofEdge = [0, 1, 2, 3].map((k) => {
    const a = (k * Math.PI) / 6;
    return [EDGE + (CROWN - EDGE) * Math.sin(a), 0.3 * (1 - Math.cos(a))];
  });
  for (let k = 1; k < roofEdge.length; k++)
    band([...FRONT, ...AFT.slice(1)], roofEdge[k - 1], roofEdge[k], roof);
  const deck = plan(0.3, CROWN);
  for (const [i, j, k] of T.ShapeUtils.triangulateShape(
    deck.map(([x, z]) => new T.Vector2(x, z)),
    [],
  ))
    roof.push([i, j, k].map((n) => [deck[n][0], CROWN, deck[n][1]]));
  surface('roof', paint, roof, body);
  // Air-conditioning pod over the engine, radiused like the roof.
  const pod = [];
  const podPlan = (inset, y) => {
    const hw = W * 0.35 - inset,
      z0 = -L / 2 + 1.05 + inset,
      z1 = -L / 2 + 3.85 - inset,
      r = Math.max(0.3 - inset, 0.02);
    const out = [];
    for (const [cx, cz, a0] of [
      [hw - r, z1 - r, 0],
      [-hw + r, z1 - r, Math.PI / 2],
      [-hw + r, z0 + r, Math.PI],
      [hw - r, z0 + r, Math.PI * 1.5],
    ])
      for (let i = 0; i <= 3; i++) {
        const a = a0 + (i * Math.PI) / 6;
        out.push([cx + r * Math.cos(a), y, cz + r * Math.sin(a)]);
      }
    return out;
  };
  const rings = [podPlan(0, CROWN - 0.01), podPlan(0, H - 0.07), podPlan(0.07, H)];
  for (let k = 0; k < rings.length - 1; k++)
    for (let i = 0; i < 16; i++) {
      const j = (i + 1) % 16;
      pod.push(
        [rings[k][i], rings[k][j], rings[k + 1][j]],
        [rings[k][i], rings[k + 1][j], rings[k + 1][i]],
      );
    }
  const top = rings.at(-1);
  for (let i = 1; i < 15; i++) pod.push([top[0], top[i], top[i + 1]]);
  surface('roof-pod', paint, pod, body, new T.Vector3(0, CROWN - 0.3, -L / 2 + 2.45));
  for (const x of [-0.45, 0.45])
    for (let i = 0; i < 6; i++)
      box(body, 'pod-grille', [0.5, 0.012, 0.06], [x, H + 0.002, -L / 2 + 1.8 + i * 0.25], trim);

  // Front: destination sign band behind the top of the windscreen, A pillars, wiper base,
  // clearance lamps on the roof edge, lamps, bumper.
  const zf = L / 2;
  const pillars = [Math.round(N * 0.45), 2 * N + 1 - Math.round(N * 0.45)];
  surface('sign', sign, band(range(...pillars), [HEADER, 0.03], [EDGE - 0.01, 0.03]), body);
  const markers = [-1.02, -0.3, 0, 0.3, 1.02].map((x) =>
    new T.BoxGeometry(0.07, 0.035, 0.03).translate(x, EDGE + 0.04, face(x, EDGE + 0.04, 0.012)),
  );
  body.add(Object.assign(new T.Mesh(mergeGeometries(markers), marker), { name: 'marker-lamp' }));
  const screenBase = plan(0, SCREEN),
    screenHead = plan(0, EDGE);
  for (const i of pillars) {
    const p = new T.Vector3(screenBase[i][0], SCREEN, screenBase[i][1]),
      q = new T.Vector3(screenHead[i][0], EDGE, screenHead[i][1]);
    const post = box(
      body,
      'a-pillar',
      [0.08, p.distanceTo(q), 0.05],
      p.clone().lerp(q, 0.5).toArray(),
      trim,
    );
    post.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), q.clone().sub(p).normalize());
  }
  // Screen base gasket round the curved front, and the centre post of the two-piece screen.
  surface(
    'screen-base',
    trim,
    band(range(...pillars), [SCREEN - 0.04, -0.006], [SCREEN + 0.03, -0.006]),
    body,
  );
  const [p0, p1] = [SCREEN, HEADER].map((y) => new T.Vector3(0, y, face(0, y) + 0.012));
  box(
    body,
    'screen-divider',
    [0.05, p0.distanceTo(p1), 0.025],
    p0.clone().lerp(p1, 0.5).toArray(),
    trim,
  ).quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), p1.clone().sub(p0).normalize());
  // Headlamp clusters swept round the lower corners: a dark housing carrying a large LED lamp
  // and an amber indicator, set in the body-colour lower front.
  const lamps = { housing: [], led: [], turn: [] };
  for (const side of [-1, 1]) {
    const rows = (y0, y1, proud) => [
      [y0, 0],
      [y0 + 0.012, proud],
      [y1 - 0.012, proud],
      [y1, 0],
    ];
    cornerStrip(side, 0.36, 1.38, rows(0.56, 0.95, 0.018), lamps.housing);
    cornerStrip(side, 0.42, 1.12, rows(0.66, 0.87, 0.03), lamps.led);
    cornerStrip(side, 1.16, 1.34, rows(0.62, 0.9, 0.03), lamps.turn);
  }
  surface('lamp-housing', trim, lamps.housing, body);
  surface('headlamp', lamp, lamps.led, body);
  surface('turn-lamp', marker, lamps.turn, body);
  box(body, 'front-bumper', [W - 2 * RFX, 0.3, 0.12], [0, 0.42, zf - 0.04], trim);
  for (const side of [-1, 1]) {
    const c = new T.Mesh(
      new T.CylinderGeometry(1, 1, 0.3, 6, 1, true, side > 0 ? 0 : -Math.PI / 2, Math.PI / 2),
      trim,
    );
    c.name = 'front-bumper';
    c.scale.set(RFX + 0.02, 1, RF + 0.02);
    c.position.set(side * (W / 2 - RFX), 0.42, zf - RF);
    body.add(c);
  }
  // Folded bike rack on the front bumper: side frames, two wheel trays and the hinge arms.
  const rodGeometry = (a, b, r) => {
    const from = new T.Vector3(...a),
      to = new T.Vector3(...b);
    return new T.CylinderGeometry(r, r, from.distanceTo(to), 6)
      .applyQuaternion(
        new T.Quaternion().setFromUnitVectors(
          new T.Vector3(0, 1, 0),
          to.clone().sub(from).normalize(),
        ),
      )
      .translate(...from.lerp(to, 0.5).toArray());
  };
  const rack = [];
  for (const x of [-0.38, 0.38]) {
    rack.push(rodGeometry([x, 0.56, zf + 0.06], [x, 1.0, zf + 0.13], 0.018));
    rack.push(rodGeometry([x * 0.7, 0.55, zf + 0.02], [x * 0.7, 0.6, zf + 0.08], 0.022));
  }
  for (const [y, z] of [
    [0.66, 0.09],
    [0.86, 0.12],
    [1.0, 0.13],
  ])
    rack.push(rodGeometry([-0.42, y, zf + z], [0.42, y, zf + z], 0.016));
  body.add(Object.assign(new T.Mesh(mergeGeometries(rack), rim), { name: 'bike-rack' }));
  // Rear: a tall engine-compartment door (framed, louvred grille in its upper half) under the
  // rear window strip in the rounded cap, corner lamp columns (stop/tail, turn, reversing lamps
  // in a dark housing), a framed rear window and a stepped bumper wrapped round the corners.
  const zr = -L / 2;
  const door = [-0.6, 0.6].map((x) =>
    new T.BoxGeometry(0.04, 1.06, 0.02).translate(x, 1.13, zr - 0.006),
  );
  for (const y of [0.62, 1.64])
    door.push(new T.BoxGeometry(1.24, 0.04, 0.02).translate(0, y, zr - 0.006));
  body.add(Object.assign(new T.Mesh(mergeGeometries(door), trim), { name: 'engine-door' }));
  box(body, 'engine-grille', [1.1, 0.46, 0.03], [0, 1.34, zr - 0.006], trim);
  const lenses = { 'tail-lamp': [], 'turn-lamp': [], 'reversing-lamp': [] };
  for (const x of [-W / 2 + RR + 0.1, W / 2 - RR - 0.1]) {
    box(body, 'tail-lamp-housing', [0.3, 0.96, 0.03], [x, 1.04, zr - 0.004], trim);
    for (const [y, part] of [
      [1.37, 'tail-lamp'],
      [1.14, 'tail-lamp'],
      [0.91, 'turn-lamp'],
      [0.71, 'reversing-lamp'],
    ]) {
      const r = part === 'reversing-lamp' ? 0.055 : 0.1;
      lenses[part].push(
        new T.CylinderGeometry(r, r, 0.03, 16).rotateX(Math.PI / 2).translate(x, y, zr - 0.02),
      );
    }
  }
  for (const [part, m] of [
    ['tail-lamp', tail],
    ['turn-lamp', marker],
    ['reversing-lamp', lamp],
  ])
    body.add(Object.assign(new T.Mesh(mergeGeometries(lenses[part]), m), { name: part }));
  surface(
    'rear-window-frame',
    trim,
    band(REAR, [ENGINE - 0.06, -0.004], [ENGINE + 0.01, -0.004]).concat(
      band(REAR, [WIN - 0.01, -0.004], [WIN + 0.05, -0.004]),
    ),
    body,
  );
  const signY = (WIN + EDGE) / 2 + 0.02;
  box(body, 'rear-sign', [0.8, 0.24, 0.02], [0, signY, rearFace(signY) - 0.008], sign);
  // The bumper stands 0.12 m proud of the rear face, a step below the engine door.
  box(body, 'rear-bumper', [W - 2 * RR, 0.3, 0.2], [0, 0.42, zr - 0.02], trim);
  for (const side of [-1, 1]) {
    const c = new T.Mesh(
      new T.CylinderGeometry(1, 1, 0.3, 6, 1, false, side > 0 ? Math.PI / 2 : Math.PI, Math.PI / 2),
      trim,
    );
    c.name = 'rear-bumper';
    c.scale.set(RR + 0.02, 1, RR + 0.12);
    c.position.set(side * (W / 2 - RR), 0.42, zr + RR);
    body.add(c);
  }
  // Kerb-side door leaves: glazed, framed, closing on a centre seam.
  for (const [d0, d1] of DOORS) {
    const w = (d1 - d0) / 2;
    for (const z of [d0 + w / 2, d1 - w / 2]) {
      box(
        body,
        'door',
        [0.03, WIN - FLOOR - 0.02, w - 0.06],
        [-W / 2 + 0.02, (WIN + FLOOR) / 2, z],
        glass,
      );
      for (const dz of [-w / 2 + 0.03, w / 2 - 0.03])
        box(
          body,
          'door-frame',
          [0.05, WIN - FLOOR, 0.05],
          [-W / 2 + 0.02, (WIN + FLOOR) / 2, z + dz],
          trim,
        );
      for (const y of [FLOOR + 0.02, WIN - 0.02, 1.25])
        box(body, 'door-frame', [0.05, 0.05, w], [-W / 2 + 0.02, y, z], trim);
    }
  }
  // Mirrors on arms from the body sides behind the front corners, reaching ahead of the screen
  // pillars.
  for (const side of [-1, 1]) {
    const from = new T.Vector3(side * (W / 2 - 0.02), 2.62, zf - RF - 0.06),
      to = new T.Vector3(side * (W / 2 + 0.22), 2.33, zf + 0.13);
    const arm = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, from.distanceTo(to), 6), trim);
    arm.name = 'mirror-arm';
    arm.position.copy(from.clone().lerp(to, 0.5));
    arm.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    body.add(arm);
    box(body, 'mirror', [0.07, 0.4, 0.2], [side * (W / 2 + 0.24), 2.13, zf + 0.13], trim);
  }
  // Amber side marker lamps low on both sides, clear of the doors and arches.
  const sideMarkers = [];
  for (const side of [-1, 1])
    for (const z of [2.2, -1.8, -5.25])
      sideMarkers.push(
        new T.BoxGeometry(0.02, 0.05, 0.1).translate(side * (W / 2 + 0.008), 0.62, z),
      );
  body.add(
    Object.assign(new T.Mesh(mergeGeometries(sideMarkers), marker), { name: 'side-marker' }),
  );
  // Driver's sliding window on the left: a dark frame with a sash rail and a split, so it reads
  // apart from the passenger windows.
  const [w0, w1] = [4.02, L / 2 - RF - 0.06];
  const xw = W / 2 + 0.004,
    wz = (w0 + w1) / 2;
  const driverWindow = [
    ...[SILL + 0.03, 1.86, WIN - 0.03].map((y) =>
      new T.BoxGeometry(0.03, 0.05, w1 - w0).translate(xw, y, wz),
    ),
    ...[w0, wz, w1].map((z) =>
      new T.BoxGeometry(0.03, WIN - 1.86, 0.05).translate(xw, (WIN + 1.86) / 2, z),
    ),
    new T.BoxGeometry(0.03, 1.86 - SILL, 0.05).translate(xw, (SILL + 1.86) / 2, w0),
  ];
  body.add(
    Object.assign(new T.Mesh(mergeGeometries(driverWindow), trim), { name: 'driver-window' }),
  );
  // Engine radiator grille in the left side behind the rear axle, with its louvres.
  const grilleZ = (REAR_AXLE - ARCH - 0.25 - L / 2 + RR + 0.2) / 2;
  box(body, 'radiator-grille', [0.02, 0.56, 1.0], [W / 2 + 0.01, 0.82, grilleZ], trim);
  const louvres = Array.from({ length: 6 }, (_, i) =>
    new T.BoxGeometry(0.025, 0.025, 0.92).translate(W / 2 + 0.02, 0.6 + i * 0.088, grilleZ),
  );
  body.add(Object.assign(new T.Mesh(mergeGeometries(louvres), rim), { name: 'radiator-louvres' }));
  // Wheels: left is +X when facing +Z.
  wheel(g, 'wheel-front-left', W / 2 - 0.2, FRONT_AXLE);
  wheel(g, 'wheel-front-right', -W / 2 + 0.2, FRONT_AXLE);
  wheel(g, 'wheel-rear-left', W / 2 - 0.2, REAR_AXLE);
  wheel(g, 'wheel-rear-right', -W / 2 + 0.2, REAR_AXLE);
  glass.opacity = 0.18;
  glass.depthWrite = false;
  addTransitDetail(g, false, { face, signY: SIGN_Y, signInset: 0.025 });
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
  await new GLTFExporter().parseAsync(bus(), { binary: true, onlyVisible: false }),
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
console.log(`bus: ${bytes.length} bytes, ${generatedHash}`);
