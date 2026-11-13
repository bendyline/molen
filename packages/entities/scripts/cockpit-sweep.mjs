/** Measure every aircraft's flight deck from the seated eye. Local evidence only.
 *
 * A side view cannot show these faults, and overall dimensions say nothing about them. Rays are
 * cast through the source GLB from `spec.pilotEye`, dead ahead at the runtime's vertical field of
 * view of 60 degrees. Glazing is transparent to the view but still counts as a surface next
 * to the head. Rotors, propellers and nodes hidden until a binding shows them are ignored.
 *
 * node packages/entities/scripts/cockpit-sweep.mjs [--ids=slug,slug] [--json=.artifacts/cockpits.json]
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const option = (name) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../content/entities');
const selection = option('ids')?.split(',');
const VIEW_HEIGHT = 60,
  VIEW_WIDTH = 96,
  COLS = 64,
  ROWS = 36,
  REACH = 7;
/** Findings a person should look at. Limits come from real flight decks, kept deliberately loose. */
const LIMITS = {
  headroom: [0.17, 0.75],
  wall: [0.2, Number.POSITIVE_INFINITY],
  panel: [0.55, 1.25],
  cushion: [0.6, 0.98],
  seatback: [0.15, 0.48],
  outside: [38, 100],
  horizon: [60, 100],
  overNose: [Number.NEGATIVE_INFINITY, -4],
  attitude: [-36, 0],
  dial: [40, 115],
  poked: [0, 0.4],
};

function triangles(scene, eye) {
  scene.updateMatrixWorld(true);
  const list = [],
    a = new T.Vector3(),
    b = new T.Vector3(),
    c = new T.Vector3();
  scene.traverse((mesh) => {
    if (!mesh.isMesh) return;
    let ignored = false;
    for (let n = mesh; n; n = n.parent) if (n.userData.ignored) ignored = true;
    if (ignored) return;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const glass =
      (material.transparent && material.opacity < 0.75) ||
      /glass|glaz|window|canopy|bubble|windscreen|windshield/i.test(material.name);
    let cockpit = false;
    for (let n = mesh; n; n = n.parent) if (n.userData.cockpit) cockpit = true;
    const position = mesh.geometry.getAttribute('position');
    const index = mesh.geometry.index;
    const count = index ? index.count : position.count;
    for (let i = 0; i < count; i += 3) {
      const ids = [0, 1, 2].map((k) => (index ? index.getX(i + k) : i + k));
      a.fromBufferAttribute(position, ids[0]).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(position, ids[1]).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(position, ids[2]).applyMatrix4(mesh.matrixWorld);
      if (Math.min(a.distanceTo(eye), b.distanceTo(eye), c.distanceTo(eye)) > REACH) continue;
      list.push({
        v: [a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z],
        glass,
        cockpit,
        material: material.name,
      });
    }
  });
  return list;
}

/** Nearest hit of a ray over a triangle soup: Moller-Trumbore, both faces. */
function cast(tris, o, d, accept) {
  let best = null,
    nearest = Number.POSITIVE_INFINITY;
  for (const t of tris) {
    if (accept && !accept(t)) continue;
    const v = t.v,
      e1x = v[3] - v[0],
      e1y = v[4] - v[1],
      e1z = v[5] - v[2],
      e2x = v[6] - v[0],
      e2y = v[7] - v[1],
      e2z = v[8] - v[2],
      px = d[1] * e2z - d[2] * e2y,
      py = d[2] * e2x - d[0] * e2z,
      pz = d[0] * e2y - d[1] * e2x,
      det = e1x * px + e1y * py + e1z * pz;
    if (det > -1e-9 && det < 1e-9) continue;
    const inv = 1 / det,
      sx = o[0] - v[0],
      sy = o[1] - v[1],
      sz = o[2] - v[2],
      u = (sx * px + sy * py + sz * pz) * inv;
    if (u < 0 || u > 1) continue;
    const qx = sy * e1z - sz * e1y,
      qy = sz * e1x - sx * e1z,
      qz = sx * e1y - sy * e1x,
      w = (d[0] * qx + d[1] * qy + d[2] * qz) * inv;
    if (w < 0 || u + w > 1) continue;
    const dist = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if (dist > 0.03 && dist < nearest) {
      nearest = dist;
      best = t;
    }
  }
  return best ? { distance: nearest, t: best } : null;
}

const direction = (yaw, pitch) => {
  const y = (yaw * Math.PI) / 180,
    p = (pitch * Math.PI) / 180;
  return [Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p)];
};
const solidOnly = (t) => !t.glass;

function measure(tris, eye, side) {
  const o = eye;
  let outside = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const yaw = ((c + 0.5) / COLS - 0.5) * VIEW_WIDTH,
        pitch = ((r + 0.5) / ROWS - 0.5) * VIEW_HEIGHT;
      if (!cast(tris, o, direction(yaw, pitch), solidOnly)) outside++;
    }
  let horizon = 0;
  const HORIZON = 41;
  for (let i = 0; i < HORIZON; i++)
    if (!cast(tris, o, direction(-35 + (i * 70) / (HORIZON - 1), 0), solidOnly)) horizon++;
  let overNose = 0;
  for (let p = 0; p >= -40; p -= 1) {
    if (cast(tris, o, direction(0, p), solidOnly)) break;
    overNose = p;
  }
  // The closest surface around the head, with a small cone so one seam gap cannot hide a roof.
  const nearest = (dirs) => {
    let d = Number.POSITIVE_INFINITY;
    for (const q of dirs) d = Math.min(d, cast(tris, o, q)?.distance ?? d);
    return d;
  };
  const cone = (axis) => {
    const out = [axis];
    for (let a = 0; a < 8; a++) {
      const yaw = a * 45;
      for (const tilt of [10, 20]) {
        const t = (tilt * Math.PI) / 180,
          s = Math.sin(t),
          cs = Math.cos(t),
          ca = Math.cos((yaw * Math.PI) / 180),
          sa = Math.sin((yaw * Math.PI) / 180);
        if (axis[1] !== 0) out.push([s * ca, axis[1] * cs, s * sa]);
        else out.push([axis[0] * cs, s * ca, s * sa]);
      }
    }
    return out;
  };
  const headroom = nearest(cone([0, 1, 0]));
  const wall = nearest(cone([side, 0, 0]));
  // The panel face: the solid surfaces of the deck ahead, below the eye line.
  const ahead = [];
  for (let p = -28; p <= -6; p += 2) {
    const hit = cast(tris, o, direction(0, p), (t) => !t.glass && t.cockpit);
    if (hit && hit.distance < 2.2) ahead.push(hit.distance);
  }
  ahead.sort((a, b) => a - b);
  const panel = ahead.length ? ahead[Math.floor(ahead.length / 2)] : null;
  // Straight down from the eye lands on the thighs, not the floor, unless the seat is too far aft.
  const cushion = cast(tris, o, [0, -1, 0], solidOnly)?.distance ?? null;
  // Seatback behind the shoulders: a seated head is about 0.3 m ahead of it.
  const shoulder = [o[0], o[1] - 0.3, o[2]];
  const seatback = cast(tris, shoulder, [0, 0, -1], (t) => !t.glass && t.cockpit)?.distance ?? null;
  return {
    outside: (100 * outside) / (ROWS * COLS),
    horizon: (100 * horizon) / HORIZON,
    overNose,
    headroom,
    wall,
    panel,
    cushion,
    seatback,
  };
}

/** Cockpit vertices with open sky beyond them in most directions have left the shell. */
function poked(tris, eye) {
  const shell = tris.filter((t) => !t.cockpit);
  // Cabin furnishing far from the seat is not the flight deck, and the shell is cut off at REACH.
  const cockpit = tris.filter(
    (t) => t.cockpit && Math.hypot(t.v[0] - eye[0], t.v[1] - eye[1], t.v[2] - eye[2]) < 3,
  );
  if (cockpit.length === 0) return null;
  const step = Math.max(1, Math.floor(cockpit.length / 500));
  const directions = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
  ];
  let outside = 0,
    samples = 0,
    worst = null;
  for (let i = 0; i < cockpit.length; i += step) {
    const v = cockpit[i].v,
      p = [v[0], v[1], v[2]];
    samples++;
    let open = 0;
    for (const d of directions) if (!cast(shell, p, d)) open++;
    if (open >= 3) {
      outside++;
      const reach = Math.hypot(p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]);
      if (!worst || reach > worst.reach) worst = { reach, at: p.map((n) => Number(n.toFixed(2))) };
    }
  }
  return { share: (100 * outside) / samples, at: worst?.at };
}

/**
 * Degrees below level of the attitude display nearest the pilot's line of sight. World-explorer
 * enters the seat looking 10.3 degrees down, so the frame ends at -40: a display centered below
 * about -36 is cut off. A real airliner's primary display is near -32.
 */
function attitudeDisplay(scene, eye) {
  scene.updateMatrixWorld(true);
  const box = new T.Box3(),
    center = new T.Vector3(),
    size = new T.Vector3();
  const nearest = (nodes) => {
    let best = null;
    for (const node of nodes) {
      box.setFromObject(node);
      if (box.isEmpty()) continue;
      box.getCenter(center);
      box.getSize(size);
      const [dx, dy, dz] = [center.x - eye[0], center.y - eye[1], center.z - eye[2]];
      if (dz <= 0 || Math.hypot(dx, dy, dz) > 3 || Math.max(size.x, size.y) > 0.5) continue;
      const elevation = (Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI,
        yaw = (Math.atan2(dx, dz) * 180) / Math.PI,
        off = Math.hypot(elevation, yaw);
      if (!best || off < best.off) best = { elevation, yaw, off };
    }
    return best;
  };
  const named = [];
  scene.traverse((node) => {
    if (/horizon|attitude|(^|-)adi(-|$)|pfd/i.test(node.name)) named.push(node);
  });
  // A card split into sky and earth has its center between them, so prefer the whole instrument.
  return (
    nearest(named.filter((n) => !/sky|earth|card|bank|pitch|line|fixed/i.test(n.name))) ??
    nearest(named)
  );
}

/** Pointers turn about their dial's center, and a needle reaches about 80 percent of the rim. */
function dials(scene, bindings) {
  const sizes = [],
    point = new T.Vector3(),
    center = new T.Vector3();
  for (const binding of bindings ?? []) {
    if (binding.property !== 'rotation' || binding.axis !== 'z') continue;
    // Compass cards and display pointers are not round dials.
    if (
      /heading|compass|hsi|rose|nav|bank|horizon|attitude|adi|pfd|mfd|display/i.test(binding.node)
    )
      continue;
    const node = scene.getObjectByName(binding.node);
    if (!node) continue;
    node.getWorldPosition(center);
    let reach = 0;
    node.traverse((mesh) => {
      if (!mesh.isMesh) return;
      const position = mesh.geometry.getAttribute('position');
      for (let i = 0; i < position.count; i++) {
        point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
        reach = Math.max(reach, point.distanceTo(center));
      }
    });
    // Beyond 0.09 m the pointer is drawn on a display, not mounted in a round case.
    if (reach > 0.012 && reach < 0.09) sizes.push((reach * 1000 * 2) / 0.8);
  }
  sizes.sort((a, b) => a - b);
  return sizes.length ? sizes[Math.floor(sizes.length / 2)] : null;
}

// The sweep measures geometry and materials only. Embedded cockpit textures need a DOM image
// loader that Node lacks, so they are skipped, as in update-aircraft-collision.mjs.
const loader = new GLTFLoader().register(() => ({
  name: 'sweep-geometry-only',
  loadTexture: () => Promise.resolve(null),
}));
const rows = [];
const directory = `${root}/source/aircraft`;
for (const slug of (await readdir(directory)).sort()) {
  if (selection && !selection.includes(slug)) continue;
  const definition = JSON.parse(await readFile(`${directory}/${slug}/entity.types.json`, 'utf8'));
  const [id] = Object.keys(definition.types);
  const spec = definition.types[id].components.aircraft.spec;
  const bytes = await readFile(`${directory}/${slug}/models/source.glb`);
  const { scene } = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  for (const rotor of spec.visual.rotors ?? [])
    scene.traverse((n) => {
      if (n.name === rotor.node) n.userData.ignored = true;
    });
  const interior = spec.visual.interior;
  // Tape rows and warning lamps are hidden until a binding shows them.
  for (const binding of interior?.bindings ?? [])
    if (binding.property === 'visible' && binding.missing === 'hide')
      scene.traverse((n) => {
        if (n.name === binding.node) n.userData.ignored = true;
      });
  for (const name of interior?.nodes ?? [])
    scene.traverse((n) => {
      if (n.name === name) n.userData.cockpit = true;
    });
  const eye = new T.Vector3(...spec.pilotEye);
  const tris = triangles(scene, eye);
  const side = spec.pilotEye[0] < 0 ? -1 : 1;
  const row = {
    slug,
    eye: spec.pilotEye,
    triangles: tris.length,
    ...measure(tris, spec.pilotEye, side),
    attitude: attitudeDisplay(scene, spec.pilotEye)?.elevation ?? null,
    dial: dials(scene, [...(interior?.bindings ?? [])]),
    poke: poked(tris, spec.pilotEye),
  };
  row.poked = row.poke?.share ?? null;
  row.flags = Object.entries(LIMITS)
    .filter(([key, [low, high]]) => {
      const value = row[key];
      return value !== null && value !== undefined && (value < low || value > high);
    })
    .map(([key]) => key);
  rows.push(row);
  const f = (v, n = 2, w = 6) =>
    (v === null || !Number.isFinite(v) ? '--' : v.toFixed(n)).padStart(w);
  console.log(
    slug.padEnd(20),
    f(row.outside, 0, 4),
    f(row.horizon, 0, 4),
    f(row.overNose, 0, 4),
    f(row.headroom),
    f(row.wall),
    f(row.panel),
    f(row.cushion),
    f(row.seatback),
    f(row.attitude, 0, 4),
    f(row.dial, 0, 4),
    f(row.poked, 1, 5),
    row.flags.length ? ` ${row.flags.join(' ')}` : '',
    row.flags.includes('poked') ? `@${row.poke.at}` : '',
  );
}
const json = option('json');
if (json) {
  await mkdir(dirname(resolve(json)), { recursive: true });
  await writeFile(resolve(json), `${JSON.stringify(rows, null, 2)}\n`);
}
const flagged = rows.filter((r) => r.flags.length);
console.log(`\n${rows.length} aircraft, ${flagged.length} flagged`);
console.log(
  'columns: outside% horizon% overNose headroom wall panel cushion seatback attitude dialmm poked%',
);
