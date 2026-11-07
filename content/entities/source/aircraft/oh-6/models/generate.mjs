/**
 * Deterministic OH-6A master, rebuilt from the Army's station diagram rather than analytic solids.
 * Every airframe table below is in that diagram's own frame: STA inches aft of the datum (nose 28,
 * mast 100), WL inches above the keel, X inches to the pilot's left. `at` then sets the airframe on
 * its skids, tail low. Four main blades, two tail blades, a single raised stabilizer on the right.
 * Tail node names stay as entity.types.json's damage parts bind them: `tail-stabilizer--1` and
 * `tail-brace--1` are the right stabilizer and its strut, `tail-stabilizer-1` is the lower fin and
 * `tail-brace-1` its tail skid. Everything mounted on the boom is parented to `tail-boom`.
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
const olive = mat('olive-drab-enamel', '#5a5c48', 0.08, 0.66);
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
const seam = mat('panel-seam', '#30332a', 0, 0.8);
const glass = new T.MeshStandardMaterial({
  name: 'clear-cabin-glazing',
  color: '#c3d4d6',
  transparent: true,
  opacity: 0.2,
  metalness: 0.25,
  roughness: 0.08,
  side: T.DoubleSide,
  depthWrite: false,
});
const tinted = new T.MeshStandardMaterial({
  name: 'tinted-roof-glazing',
  color: '#27343a',
  transparent: true,
  opacity: 0.55,
  metalness: 0.25,
  roughness: 0.1,
  side: T.DoubleSide,
  depthWrite: false,
});

// The station frame. The airframe sits PITCH nose-up on its skids, as the Army's side view and the
// reference photographs show; the keel at the mast is KEEL above the ground.
const IN = 0.0254;
const PITCH = (5 * Math.PI) / 180;
const KEEL = 0.4;
const DATUM_Z = -0.082;
const sinP = Math.sin(PITCH),
  cosP = Math.cos(PITCH);
/** Station frame (inches) to model metres. */
const at = (sta, wl, x = 0) => {
  const f = (100 - sta) * IN,
    u = wl * IN;
  return [x * IN, KEEL + f * sinP + u * cosP, DATUM_Z + f * cosP - u * sinP];
};
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
const signPow = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);

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
function tube(parent, name, points, material = olive, radius = 0.014, closed = false) {
  return mesh(
    parent,
    name,
    new T.TubeGeometry(
      new T.CatmullRomCurve3(
        points.map((p) => new T.Vector3(...p)),
        closed,
      ),
      points.length === 2 ? 1 : Math.max(12, points.length * 2),
      radius,
      6,
      closed,
    ),
    material,
  );
}

/** Monotone cubic through [x, y] rows, so a traced table cannot ring between its stations. */
function spline(rows) {
  const xs = rows.map((r) => r[0]),
    ys = rows.map((r) => r[1]),
    n = xs.length,
    d = Array.from({ length: n - 1 }, (_, i) => (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i])),
    m = Array.from({ length: n }, (_, i) => {
      if (i === 0) return d[0];
      if (i === n - 1) return d[n - 2];
      return d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]);
    });
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i],
      t = (x - xs[i]) / h,
      t2 = t * t,
      t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h * m[i] +
      (3 * t2 - 2 * t3) * ys[i + 1] +
      (t3 - t2) * h * m[i + 1]
    );
  };
}
/** Closed Catmull-Rom loop through 2D control points. */
function smoothLoop(points, steps = 5) {
  const n = points.length,
    out = [];
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [-1, 0, 1, 2].map((k) => points[(i + k + n) % n]);
    for (let s = 0; s < steps; s++) {
      const t = s / steps,
        t2 = t * t,
        t3 = t2 * t;
      out.push(
        [0, 1].map(
          (c) =>
            0.5 *
            (2 * p1[c] +
              (p2[c] - p0[c]) * t +
              (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 +
              (3 * p1[c] - p0[c] - 3 * p2[c] + p3[c]) * t3),
        ),
      );
    }
  }
  return out;
}
/** Signed distance to a closed polygon, negative inside. */
function polygonField(points) {
  const n = points.length;
  return (u, v) => {
    let best = Infinity,
      inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const [ax, ay] = points[j],
        [bx, by] = points[i],
        ex = bx - ax,
        ey = by - ay,
        t = clamp(((u - ax) * ex + (v - ay) * ey) / (ex * ex + ey * ey), 0, 1),
        dx = u - ax - ex * t,
        dy = v - ay - ey * t;
      best = Math.min(best, dx * dx + dy * dy);
      if (by > v !== ay > v && u < ax + ((v - ay) * ex) / ey) inside = !inside;
    }
    return (inside ? -1 : 1) * Math.sqrt(best);
  };
}
/** Polynomial smooth maximum: intersects two fields with a rounded corner of about radius k. */
const smax = (a, b, k = 1) => {
  const h = clamp(0.5 + (0.5 * (a - b)) / k, 0, 1);
  return lerp(b, a, h) + k * h * (1 - h);
};

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

/**
 * TM 55-1520-214-23 / NPS fuselage station diagram, traced at 7.18 px/in along the body and
 * 7.15 px/in up from WL 0: STA, crown WL, keel WL. Half-breadth comes from the TM's plan view,
 * calibrated by its own 4 ft 6.81 in dimension. The aft face is STA 172.4, WL 22.4 to 34.96.
 */
const bodyStations = [
  [28, 29.5, 29.5, 0],
  [28.1, 33, 26, 4.2],
  [29, 37.8, 20.5, 10.4],
  [30.4, 40.6, 17.2, 14],
  [33.8, 45.1, 12.7, 18.9],
  [37.3, 49.2, 9.9, 22],
  [40.8, 52.4, 8.1, 23.9],
  [44.3, 55.1, 6.4, 25],
  [47.8, 57.4, 5, 25.7],
  [54.7, 61, 3.1, 26.7],
  [61.7, 63.8, 1.9, 27.2],
  [68.7, 65.6, 1, 27.4],
  [75.6, 66.6, 0.3, 27.35],
  [82.6, 67.1, 0, 27.1],
  [90, 67.2, 0, 26.6],
  [100, 66.3, 0, 25.9],
  [110.5, 64.4, 0.3, 24.9],
  [120.9, 61.4, 2, 23.2],
  [131.3, 57, 4.2, 20.9],
  [141.8, 52.1, 7.4, 17.9],
  [152.2, 46.6, 11.7, 15],
  [162.7, 40.9, 16.8, 11],
  [169.6, 36.9, 21, 8],
  [172.4, 35, 22.4, 6.6],
];
const tailStation = 172.4;
const rootOf = (sta) => Math.sqrt(Math.max(0, sta - 28));
// Interpolated in root-distance from the nose, which keeps the nose a blunt ellipse.
const crownAt = spline(bodyStations.map((r) => [rootOf(r[0]), r[1]])),
  keelAt = spline(bodyStations.map((r) => [rootOf(r[0]), r[2]])),
  breadthAt = spline(bodyStations.map((r) => [rootOf(r[0]), r[3]])),
  beltAt = spline(
    [
      [28, 29.5],
      [50, 31.5],
      [80, 33],
      [130, 32],
      [172.4, 28.7],
    ].map(([s, w]) => [rootOf(s), w]),
  ),
  // The Army front view and the head-on photographs show a nearly flat-sided lower shell.
  lowerPower = spline(
    [
      [28, 2.2],
      [40, 2.4],
      [60, 3],
      [125, 3],
      [172.4, 2.2],
    ].map(([s, n]) => [rootOf(s), n]),
  );
const UPPER_POWER = 2.25;
function section(sta) {
  const q = rootOf(sta);
  return {
    crown: crownAt(q),
    keel: keelAt(q),
    breadth: breadthAt(q),
    belt: beltAt(q),
    lower: lowerPower(q),
  };
}
/** Skin half-breadth, inches, at a station and waterline. */
function halfBreadth(sta, wl) {
  const s = section(sta),
    up = wl >= s.belt,
    a = up ? s.crown - s.belt : s.belt - s.keel,
    n = up ? UPPER_POWER : s.lower,
    r = clamp(Math.abs(wl - s.belt) / a, 0, 1);
  return s.breadth * Math.pow(1 - Math.pow(r, n), 1 / n);
}
/** A skin point from root-station q and girth angle t: t 0 at the crown, rising to port. */
function skin(q, t) {
  const sta = 28 + q * q,
    s = section(sta),
    c = Math.cos(t),
    z = Math.sin(t),
    up = c >= 0,
    n = up ? UPPER_POWER : s.lower,
    a = up ? s.crown - s.belt : s.belt - s.keel;
  return { sta, wl: s.belt + a * signPow(c, 2 / n), x: s.breadth * signPow(z, 2 / n) };
}
const skinPosition = (q, t) => {
  const p = skin(q, t);
  return new T.Vector3(...at(p.sta, p.wl, p.x));
};
function skinNormal(q, t) {
  const Q = Math.max(q, 0.06),
    e = 0.012,
    dq = skinPosition(Q + e, t).sub(skinPosition(Math.max(0.02, Q - e), t)),
    dt = skinPosition(Q, t + e).sub(skinPosition(Q, t - e)),
    n = dt.cross(dq).normalize(),
    axis = new T.Vector3(...at(28 + Q * Q, section(28 + Q * Q).belt)),
    out = skinPosition(Q, t).sub(axis);
  return n.dot(out) < 0 ? n.negate() : n;
}
/** A station and waterline as a point on the skin, lifted clear of it by `lift` metres. */
function onSkin(sta, wl, side, lift = 0.003) {
  const x = side * halfBreadth(sta, wl),
    s = section(sta),
    a = wl >= s.belt ? s.crown - s.belt : s.belt - s.keel,
    p = new T.Vector3(...at(sta, wl, x)),
    n = new T.Vector3(
      x / (s.breadth * s.breadth),
      ((wl - s.belt) / (a * a)) * cosP,
      ((wl - s.belt) / (a * a)) * -sinP,
    ).normalize();
  return p.addScaledVector(n, lift).toArray();
}

// Glazing outlines, from the station diagram's door and frame lines, read at 16.45 px/in. The TM
// places the lower canopy transverse frame at WL 38.64 and describes a slim centerline frame.
const RAIL_WL = 38.64;
const windshieldEdge = [
  [66.2, 72],
  [66.2, 60],
  [62.4, 57.4],
  [58, 54.7],
  [53.5, 50.2],
  [49.5, 46.2],
  [44.7, 41.3],
  [42.2, 36.4],
  [40.8, 32],
  [40.4, 27.9],
  [40.4, 23.1],
  [41.6, 19.4],
  [43.5, 16.4],
  [44.4, 8],
  [15, 8],
  [15, 72],
];
const roofPanel = [
  [67, 72],
  [67.1, 61],
  [85.9, 61.2],
  [87.8, 67],
  [87.8, 72],
];
const doorWindow = [
  [72.2, 57.7],
  [62.8, 55.3],
  [56.8, 49.8],
  [50.7, 40.1],
  [49.5, 31.6],
  [50.1, 27.9],
  [52.5, 24.3],
  [56.2, 21.6],
  [61, 20.6],
  [64.7, 21.6],
  [68.9, 24.3],
  [72.5, 27.3],
  [75.6, 32.2],
  [78, 38.3],
  [79.5, 42.5],
  [80.1, 46.8],
  [80.1, 51.6],
  [78.6, 55.3],
];
const cargoWindow = [
  [90.7, 51],
  [95.6, 53.5],
  [101.7, 53.5],
  [108.9, 51],
  [111.9, 47.4],
  [112.5, 41.9],
  [111.3, 38.3],
  [108.9, 36.8],
  [91.9, 37.1],
  [88.9, 39.5],
  [88.3, 43.1],
  [89.8, 48],
];
const eyebrowWindow = [
  [91, 61.7],
  [97, 61.2],
  [104, 59.6],
  [110, 57.4],
  [114.4, 55.4],
  [110, 56],
  [103, 57],
  [96, 57.8],
  [91, 58.2],
];
const doorSeam = [
  [47, 40],
  [47, 21],
  [49, 15.4],
  [64.5, 15],
  [72.5, 22.5],
  [77.4, 29.1],
  [79.8, 37.1],
  [82.2, 43.1],
  [84, 49.8],
  [82.2, 56.5],
  [77.4, 59.8],
  [72.5, 60.2],
  [66.5, 59.8],
  [58, 54.7],
  [52, 48.6],
  [48, 43.6],
];
const cargoSeam = [
  [90.7, 56.2],
  [101, 56.2],
  [108.9, 54.1],
  [113.5, 50],
  [115.2, 43],
  [114.8, 25],
  [114.2, 13.4],
  [99, 13.3],
  [78.4, 13.3],
  [82, 26],
  [86, 40],
];
const doorField = polygonField(smoothLoop(doorWindow)),
  cargoField = polygonField(smoothLoop(cargoWindow)),
  eyebrowField = polygonField(smoothLoop(eyebrowWindow, 3)),
  screenField = polygonField(windshieldEdge),
  roofField = polygonField(roofPanel);
const POST = 0.85,
  RAIL = 0.72,
  VENT = 5.2;
const chin = (x) => 9.5 + 10.5 * Math.pow(clamp((x - VENT) / 19, 0, 1), 2.2);
const glazing = [
  {
    name: 'windshield-glazing',
    material: glass,
    field: ({ sta, wl, x }) =>
      smax(smax(screenField(sta, wl), RAIL_WL + RAIL - wl, 0.8), POST - Math.abs(x), 0.8),
  },
  {
    name: 'lower-windshield-glazing',
    material: glass,
    field: ({ sta, wl, x }) =>
      smax(
        smax(screenField(sta, wl), wl - (RAIL_WL - RAIL), 0.8),
        smax(VENT - Math.abs(x), chin(Math.abs(x)) - wl, 1.2),
        0.8,
      ),
  },
  {
    name: 'roof-glazing',
    material: tinted,
    field: ({ sta, wl, x }) => smax(roofField(sta, wl), POST - Math.abs(x), 0.8),
  },
  {
    name: 'door-glazing',
    material: glass,
    field: ({ sta, wl }) => doorField(sta, wl),
  },
  {
    name: 'aft-window-glazing',
    material: glass,
    field: ({ sta, wl }) => cargoField(sta, wl),
  },
  {
    name: 'eyebrow-glazing',
    material: tinted,
    field: ({ sta, wl }) => eyebrowField(sta, wl),
  },
];
/** Split a polygon of (q, t) corners along a field's zero set. */
function split(polygon, field) {
  const values = polygon.map((p) => field(skin(p.q, p.t)));
  if (values.every((v) => v <= 0)) return [polygon, undefined];
  if (values.every((v) => v > 0)) return [undefined, polygon];
  const inside = [],
    outside = [];
  polygon.forEach((a, i) => {
    const j = (i + 1) % polygon.length,
      b = polygon[j],
      fa = values[i],
      fb = values[j];
    (fa <= 0 ? inside : outside).push(a);
    if (fa <= 0 === fb <= 0) return;
    let lo = 0,
      hi = 1;
    for (let k = 0; k < 16; k++) {
      const mid = (lo + hi) / 2,
        v = field(skin(lerp(a.q, b.q, mid), lerp(a.t, b.t, mid)));
      if (v <= 0 === fa <= 0) lo = mid;
      else hi = mid;
    }
    const cut = { q: lerp(a.q, b.q, lo), t: lerp(a.t, b.t, lo) };
    inside.push(cut);
    outside.push(cut);
  });
  return [inside, outside];
}
function cabin(parent) {
  const rows = 88,
    columns = 104,
    top = rootOf(tailStation);
  const buffers = new Map();
  const buffer = (name) => {
    if (!buffers.has(name)) buffers.set(name, { positions: [], normals: [], indices: [] });
    return buffers.get(name);
  };
  const emit = (name, polygon, inset = 0) => {
    const dst = buffer(name),
      corners = polygon.map((p) => {
        const n = skinNormal(p.q, p.t);
        return { n, p: skinPosition(p.q, p.t).addScaledVector(n, -inset) };
      }),
      start = dst.positions.length / 3,
      count = corners.length;
    for (const { p, n } of corners) {
      dst.positions.push(p.x, p.y, p.z);
      if (inset) dst.normals.push(-n.x, -n.y, -n.z);
      else dst.normals.push(n.x, n.y, n.z);
    }
    // Each polygon is wound from its own geometry: outward on the skin, inward on the lining.
    const a = corners[1].p.clone().sub(corners[0].p),
      b = corners[count - 1].p.clone().sub(corners[0].p),
      facing = a.cross(b).dot(corners[0].n) > 0 === !inset;
    for (let i = 1; i < count - 1; i++)
      if (facing) dst.indices.push(start, start + i, start + i + 1);
      else dst.indices.push(start, start + i + 1, start + i);
  };
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < columns; i++) {
      const q0 = (top * j) / rows,
        q1 = (top * (j + 1)) / rows,
        t0 = (i * Math.PI * 2) / columns,
        t1 = ((i + 1) * Math.PI * 2) / columns;
      let rest = [
        { q: q0, t: t0 },
        { q: q1, t: t0 },
        { q: q1, t: t1 },
        { q: q0, t: t1 },
      ];
      if (j === 0) rest = rest.slice(1);
      for (const { name, material, field } of glazing) {
        if (!rest) break;
        const [inside, outside] = split(rest, field);
        if (inside?.length > 2) {
          emit(name, inside);
          buffer(name).material = material;
        }
        rest = outside;
      }
      if (rest?.length > 2) {
        emit('cabin-panels', rest);
        // The lining stops at the aft bulkhead; nothing behind it can be seen from the cabin.
        if (28 + q0 * q0 < 126) emit('cabin-interior', rest, 0.014);
      }
    }
  for (const [name, data] of buffers) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(data.positions, 3));
    geometry.setAttribute('normal', new T.Float32BufferAttribute(data.normals, 3));
    geometry.setIndex(data.indices);
    mesh(
      parent,
      name,
      geometry,
      name === 'cabin-panels' ? olive : name === 'cabin-interior' ? green : data.material,
    );
  }
  // Window seals, door seams and hardware all lie on the same table-driven skin.
  const line = (name, points, closed, radius, material, lift = 0.002, smooth = 0) => {
    for (const side of [-1, 1]) {
      const path = smooth ? smoothLoop(points, smooth) : points;
      tube(
        parent,
        name,
        path.map(([sta, wl]) => onSkin(sta, wl, side, lift)),
        material,
        radius,
        closed,
      );
    }
  };
  line('door-window-seal', doorWindow, true, 0.0085, rubber, 0.002, 3);
  line('aft-window-seal', cargoWindow, true, 0.0085, rubber, 0.002, 3);
  line('eyebrow-seal', eyebrowWindow, true, 0.006, rubber, 0.002, 2);
  line('door-seam', doorSeam, true, 0.0035, seam, 0, 3);
  line('cargo-door-seam', cargoSeam, false, 0.0035, seam, 0);
  line(
    'windshield-seal',
    windshieldEdge.slice(1, 13).map(([sta, wl]) => [sta + 0.12, wl]),
    false,
    0.007,
    rubber,
  );
  line(
    'cargo-step-seam',
    [
      [88.3, 14],
      [88.4, 18.2],
      [90.2, 20],
      [94, 20.2],
      [95.9, 18.4],
      [95.9, 14],
    ],
    false,
    0.003,
    seam,
    0,
  );
  // The canted station 124 frame and the engine access door, both legible on the real skin.
  line(
    'frame-124-seam',
    [
      [111.5, 62.5],
      [116, 53],
      [120, 44],
      [124, 34],
      [124.2, 20],
      [124.4, 6.5],
    ],
    false,
    0.003,
    seam,
    0,
  );
  line(
    'frame-138-seam',
    [
      [124, 34],
      [129, 40],
      [134, 46],
      [138.4, 51.5],
    ],
    false,
    0.003,
    seam,
    0,
  );
  line(
    'engine-door-seam',
    [
      [171.6, 33.2],
      [160, 34.96],
      [145, 34.96],
      [137.5, 34.96],
      [137.5, 20],
      [137.5, 8],
    ],
    false,
    0.003,
    seam,
    0,
  );
  for (const side of [-1, 1]) {
    // Door hinges at the TM's marked stations, then the handles and the navigation lights.
    for (const [sta, wl] of [
      [47, 39.8],
      [47, 19.7],
      [87.1, 36.4],
      [83.1, 21.6],
    ]) {
      const p = onSkin(sta, wl, side, 0.006);
      box(parent, `door-hinge-${side}-${sta}-${wl}`, [0.02, 0.03, 0.075], p, olive);
    }
    const handle = onSkin(113, 29, side, 0.022);
    rod(
      parent,
      `door-handle-${side}`,
      [handle[0], handle[1], handle[2] + 0.065],
      [handle[0], handle[1], handle[2] - 0.065],
      0.012,
      dark,
    );
    const latch = onSkin(77, 30, side, 0.018);
    rod(
      parent,
      `front-door-handle-${side}`,
      [latch[0], latch[1], latch[2] + 0.05],
      [latch[0], latch[1], latch[2] - 0.05],
      0.011,
      dark,
    );
    const lamp = onSkin(131, 28, side, 0.025);
    sphere(
      parent,
      `navigation-light-${side}`,
      [0.018, 0.018, 0.04],
      lamp,
      side === 1 ? red : mat('navigation-green', '#3f8156', 0.1, 0.25),
    );
  }
}
/** The centerline ventilating panel's duct and landing light, and the rear closure. */
function noseDetails(parent) {
  const frame = group(parent, 'nose-details', at(100, 0));
  frame.rotation.x = -PITCH;
  const local = (sta, wl) => [0, wl * IN, (100 - sta) * IN];
  const vent = mesh(frame, 'cabin-vent', new T.CircleGeometry(0.052, 24), dark, local(28.05, 33.6));
  vent.position.z += 0.003;
  const light = mesh(
    frame,
    'landing-light',
    new T.CircleGeometry(0.058, 28),
    mat('landing-light-lens', '#dfe3da', 0.4, 0.18),
    local(28.05, 26.2),
  );
  light.position.z += 0.003;
  const ring = mesh(
    frame,
    'landing-light-ring',
    new T.TorusGeometry(0.06, 0.006, 6, 28),
    silver,
    local(28.05, 26.2),
  );
  ring.position.z += 0.003;
}
/** Sections of the boom and its fairing: crown, keel and half-breadth, all in inches. */
const boomCrown = spline([
  [126, 52],
  [129.5, 54.5],
  [131.5, 56.4],
  [132.6, 59.5],
  [133.6, 62],
  [134.8, 63.6],
  [136.2, 64.5],
  [138.3, 65],
  [146, 64.8],
  [155.7, 64.2],
  [164, 63.7],
  [174, 63.1],
  [185.9, 62.3],
  [197.78, 61.7],
  [209.8, 61.1],
  [220, 60.4],
  [242.1, 58.9],
  [264.3, 57.4],
  [275.9, 56.7],
  [282.6, 56.3],
  [286, 55.7],
  [288.5, 55.1],
  [290.5, 54.6],
]);
const boomKeel = spline([
  [126, 44],
  [150, 38],
  [165, 36],
  [172.4, 34.96],
  [176.6, 36.8],
  [180.1, 39.4],
  [183.6, 41.9],
  [187.1, 44.1],
  [190.5, 46.2],
  [194, 47.8],
  [197.78, 49.37],
  [240, 49.4],
  [282.6, 49.5],
  [286, 51.2],
  [288.5, 52.6],
  [290.5, 53.8],
]);
const boomBreadth = spline([
  [126, 5],
  [129, 7],
  [132, 8.2],
  [137.5, 8.8],
  [146, 8.7],
  [155.7, 8.6],
  [164, 8.4],
  [174, 8.1],
  [185.9, 7.2],
  [197.78, 6.17],
  [282.6, 3.4],
  [286, 2.9],
  [288.5, 2],
  [290.5, 0.6],
]);
function boomSection(sta) {
  const crown = boomCrown(sta),
    keel = boomKeel(sta),
    breadth = boomBreadth(sta),
    radius = Math.min(breadth, (crown - keel) / 2),
    center = crown - radius,
    fair = clamp((sta - 172) / 26, 0, 1);
  return { crown, keel, breadth, radius, center, lower: lerp(1.6, 2, fair) };
}
function boomHalf(sta, wl) {
  const s = boomSection(sta),
    up = wl >= s.center,
    a = up ? s.radius : s.center - s.keel,
    n = up ? 2 : s.lower,
    r = clamp(Math.abs(wl - s.center) / a, 0, 1);
  return s.breadth * Math.pow(1 - Math.pow(r, n), 1 / n);
}
/** Close a set of rings, each the same length, into one smooth indexed surface. */
function ringSurface(parent, name, rings, material) {
  const n = rings[0].length,
    positions = rings.flat(2),
    indices = [];
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < n; i++) {
      const a = j * n + i,
        b = j * n + ((i + 1) % n),
        c = a + n,
        d = b + n;
      indices.push(a, c, b, b, c, d);
    }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return mesh(parent, name, geometry, material);
}
function boom(parent) {
  const stations = [
    126, 129.5, 131.5, 132.3, 133, 133.8, 134.8, 136.2, 138.3, 142, 146, 151, 155.7, 160, 164, 169,
    172.4, 174.5, 176.6, 178.4, 180.1, 183.6, 187.1, 190.5, 194, 197.78, 203, 209.8, 220, 231, 242,
    253, 264.3, 275.9, 282.6, 284.5, 286, 287.5, 288.5, 289.6, 290.5,
  ];
  const n = 44,
    rings = stations.map((sta) => {
      const s = boomSection(sta);
      return Array.from({ length: n }, (_, i) => {
        // Clockwise seen from behind, so computed normals face outward.
        const a = (i * Math.PI * 2) / n,
          c = Math.cos(a),
          z = Math.sin(a),
          up = c >= 0,
          e = up ? 1 : 2 / s.lower;
        return at(
          sta,
          s.center + (up ? s.radius : s.center - s.keel) * signPow(c, e),
          s.breadth * signPow(z, e),
        );
      });
    });
  const tailBoom = ringSurface(parent, 'tail-boom', rings, olive);
  // Joint between the boom fairing and the tailboom proper, seen on the TM side view. It rides
  // on the boom (identity transform), so a broken-off boom takes it along.
  tube(
    tailBoom,
    'boom-joint-seam',
    Array.from({ length: 28 }, (_, i) => {
      const a = (i * Math.PI * 2) / 28,
        s = boomSection(197.78);
      return at(197.78, s.center + s.radius * Math.cos(a), s.breadth * Math.sin(a));
    }),
    seam,
    0.0035,
    true,
  );
}
/** Engine and transmission fairing, built as stacked plan outlines. */
const pylonForward = spline([
  [50, 90],
  [58, 90],
  [66, 92.2],
  [67, 93],
  [70, 94.7],
  [73, 96.7],
  [76, 100],
  [77, 102],
  [77.6, 104],
]);
const pylonAft = spline([
  [50, 151.5],
  [58, 152.6],
  [64.2, 153],
  [71, 154.9],
  [74, 155.75],
  [77.6, 155.8],
]);
const pylonWidth = spline([
  [50, 7],
  [58, 8.6],
  [62, 9.3],
  [64, 9.4],
  [76, 6.9],
  [77.6, 6.6],
]);
const pylonTop = spline([
  [104, 77.7],
  [110.5, 77.8],
  [120.9, 77.4],
  [131.3, 77],
  [141.8, 76.4],
  [152.2, 75.9],
  [156, 75.6],
]);
function pylon(parent) {
  const base = 50,
    summit = 77.7,
    n = 72,
    levels = 18;
  const ring = (v) => {
    // Straight walls, then a tight rounded shoulder at the top edge.
    const shoulder = clamp((v - 0.82) / 0.18, 0, 1),
      arc = (shoulder * Math.PI) / 2,
      h = v < 0.82 ? (v / 0.82) * 0.94 : 0.94 + 0.06 * Math.sin(arc),
      inset = 1.6 * (1 - Math.cos(arc)),
      nominal = lerp(base, summit, h),
      front = pylonForward(nominal) + inset,
      back = pylonAft(nominal) - inset,
      width = Math.max(0.05, pylonWidth(nominal) - inset),
      middle = (front + back) / 2,
      half = (back - front) / 2,
      recess = 8 * clamp((nominal - 66) / 5, 0, 1);
    return Array.from({ length: n }, (_, i) => {
      const a = (i * Math.PI * 2) / n,
        c = Math.cos(a),
        z = Math.sin(a),
        u = signPow(c, 2 / 5),
        v2 = signPow(z, 2 / 5),
        x = width * v2,
        // The mast stands in a recess between the fairing's two forward cheeks.
        notch = recess * Math.exp(-Math.pow(x / 4.8, 2)) * Math.pow(Math.max(0, u), 3),
        sta = middle - half * u + notch,
        crown = pylonTop(sta),
        wl = base + h * (crown - base);
      return at(sta, wl, x);
    });
  };
  const rings = Array.from({ length: levels + 1 }, (_, i) => ring(i / levels));
  // Collapse the top into a slightly crowned flat so the last ring closes without a hole.
  const last = rings.at(-1),
    middle = last
      .reduce((sum, p) => sum.map((v, i) => v + p[i] / n), [0, 0, 0])
      .map((v, i) => (i === 1 ? v + 0.004 : v));
  rings.push(last.map(() => middle));
  ringSurface(parent, 'transmission-fairing', rings, olive);
  for (const side of [-1, 1]) {
    const inlet = new T.BufferGeometry(),
      a = at(103.8, 69.2, side * 1.4),
      b = at(104.6, 69.6, side * 4.6),
      c = at(109.5, 76.6, side * 4.2),
      d = at(108.5, 76.3, side * 1.4);
    inlet.setAttribute('position', new T.Float32BufferAttribute([...a, ...b, ...c, ...d], 3));
    inlet.setIndex(side > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]);
    inlet.computeVertexNormals();
    mesh(parent, `engine-air-intake-${side}`, inlet, dark);
  }
}
function exhaust(parent) {
  // The turbine exhausts low through the egg's aft face, not from a stub behind it.
  const frame = group(parent, 'exhaust-outlet', at(tailStation, 28.7));
  frame.rotation.x = -PITCH;
  // The closure starts on the skin's own last ring, so no gap can open at the rim.
  const count = 48,
    tip = rootOf(tailStation),
    outline = (scale, back) =>
      Array.from({ length: count }, (_, i) => {
        const p = skin(tip, (i * Math.PI * 2) / count);
        return [p.x * IN * scale, (p.wl - 28.7) * IN * scale, back];
      });
  // Rings run from the rim inward; reversing them keeps the visible face pointing aft.
  ringSurface(
    frame,
    'exhaust-fairing',
    [outline(1, 0), outline(0.97, -0.012), outline(0.8, -0.018), outline(0.8, 0.08)].reverse(),
    olive,
  );
  const mouth = mesh(
    frame,
    'exhaust-dark-opening',
    new T.CircleGeometry(0.128, 32),
    dark,
    [0, 0, 0.075],
  );
  mouth.rotation.y = Math.PI;
  mesh(
    frame,
    'exhaust-pipe',
    new T.CylinderGeometry(0.128, 0.128, 0.09, 32, 1, true).rotateX(Math.PI / 2),
    exhaustMetal,
    [0, 0, 0.03],
  ).material.side = T.DoubleSide;
  mesh(frame, 'exhaust-lip', new T.TorusGeometry(0.13, 0.009, 8, 32), exhaustMetal, [0, 0, -0.015]);
  rod(frame, 'exhaust-divider', [0, -0.11, -0.005], [0, 0.11, -0.005], 0.007, exhaustMetal);
}
/** Airfoil section around a chord, thickness along `normal`. */
function airfoilRing(lead, trail, normal, thickness, count = 10) {
  const chord = new T.Vector3(...trail).sub(new T.Vector3(...lead)),
    length = chord.length(),
    n = new T.Vector3(...normal).normalize(),
    ring = [];
  for (let i = 0; i < count; i++) {
    const a = (i * Math.PI * 2) / count,
      u = (1 + Math.cos(a)) / 2,
      half =
        0.5 * thickness * length * Math.sin(Math.PI * Math.pow(u, 0.62)) * Math.sign(Math.sin(a));
    ring.push(
      new T.Vector3(...lead)
        .addScaledVector(chord, 1 - u)
        .addScaledVector(n, half)
        .toArray(),
    );
  }
  return ring;
}
/** A lifting surface from root and tip chords, with a closed rounded tip. */
function surface(
  parent,
  name,
  rootLead,
  rootTrail,
  tipLead,
  tipTrail,
  thickness,
  material = olive,
) {
  const lead = (t) => rootLead.map((v, i) => lerp(v, tipLead[i], t)),
    trail = (t) => rootTrail.map((v, i) => lerp(v, tipTrail[i], t)),
    span = new T.Vector3(...tipLead).sub(new T.Vector3(...rootLead)),
    chord = new T.Vector3(...rootTrail).sub(new T.Vector3(...rootLead)),
    normal = chord.clone().cross(span).normalize().toArray(),
    ts = [0, 0.33, 0.66, 0.97],
    rings = ts.map((t) => airfoilRing(lead(t), trail(t), normal, thickness));
  const tipA = lead(0.985),
    tipB = trail(0.985),
    middle = tipA.map((v, i) => (v + tipB[i]) / 2);
  rings.push(
    airfoilRing(
      tipA.map((v, i) => lerp(v, middle[i], 0.12)),
      tipB.map((v, i) => lerp(v, middle[i], 0.12)),
      normal,
      thickness * 0.6,
    ),
  );
  rings.push(rings.at(-1).map(() => lead(1).map((v, i) => (v + trail(1)[i]) / 2)));
  const object = ringSurface(parent, name, rings, material);
  // Ring winding depends on which way the span runs: orient the whole surface outward.
  const position = object.geometry.getAttribute('position'),
    normals = object.geometry.getAttribute('normal'),
    probe = new T.Vector3(...normal).multiplyScalar(thickness * 0.5 * chord.length()),
    centre = new T.Vector3(...lead(0.33)).addScaledVector(chord, 0.3).add(probe);
  let nearest = 0,
    best = Infinity;
  for (let i = 0; i < position.count; i++) {
    const d = new T.Vector3().fromBufferAttribute(position, i).distanceToSquared(centre);
    if (d < best) {
      best = d;
      nearest = i;
    }
  }
  const facing = new T.Vector3().fromBufferAttribute(normals, nearest).dot(probe);
  if (facing < 0) {
    const index = object.geometry.index.array;
    for (let i = 0; i < index.length; i += 3)
      [index[i + 1], index[i + 2]] = [index[i + 2], index[i + 1]];
    object.geometry.computeVertexNormals();
  }
  return object;
}
function rotorHead(parent) {
  // TM figure 1-2: blades at 8 ft 4.3 in, the very top of the head at 8 ft 6 in. The swashplate
  // stands well clear of the fairing, as the pitch links do in the rotor head photographs.
  const mast = -0.25,
    plane = 2.548;
  rod(parent, 'rotor-mast', [0, 2.12, mast], [0, 2.5, mast], 0.058, silver);
  const swash = group(parent, 'swashplate', [0, 2.34, mast]);
  for (const y of [0, 0.03])
    mesh(
      swash,
      'swashplate-ring',
      new T.TorusGeometry(0.128, 0.017, 8, 24).rotateX(Math.PI / 2),
      silver,
      [0, y, 0],
    );
  sphere(parent, 'mast-boot', [0.08, 0.06, 0.08], [0, 2.27, mast], rubber);
  const rotor = group(parent, 'main-rotor', [0, plane, mast]);
  mesh(rotor, 'rotor-head', new T.CylinderGeometry(0.1, 0.13, 0.078, 16), dark);
  rod(rotor, 'mast-cap', [0, 0, 0], [0, 0.043, 0], 0.032, silver);
  for (let i = 0; i < 4; i++) {
    const blade = group(rotor, `rotor-blade-${i}`);
    blade.rotation.y = (i * Math.PI) / 2 + 0.25;
    rod(blade, 'blade-grip', [0.12, 0, 0], [0.6, -0.004, 0], 0.044, silver, 0.03);
    box(blade, 'grip-hinge', [0.09, 0.075, 0.105], [0.17, 0, 0], silver);
    box(blade, 'blade-damper', [0.13, 0.03, 0.06], [0.36, -0.052, 0], dark);
    rod(blade, 'pitch-link', [0.15, -0.2, 0.07], [0.22, -0.012, 0.07], 0.008, silver);
    // Constant 6.75 in chord, 26 ft 4 in diameter and a modest static droop.
    const vertices = [],
      indices = [];
    const sections = [
      [0.56, 0.12, -0.004],
      [0.66, 0.171, -0.008],
      [1.4, 0.171, -0.022],
      [2.6, 0.171, -0.06],
      [3.9, 0.171, -0.105],
      [4.013, 0.15, -0.11],
    ];
    for (const [r, chord, y] of sections)
      for (const [z, dy] of [
        [-0.5, 0.002],
        [-0.25, 0.0135],
        [0.5, 0.0015],
        [0.35, -0.0095],
        [-0.4, -0.0085],
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
    const last = (sections.length - 1) * 5;
    indices.push(0, 2, 1, 0, 3, 2, 0, 4, 3, last, last + 1, last + 2);
    indices.push(last, last + 2, last + 3, last, last + 3, last + 4);
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    mesh(blade, 'rotor-airfoil', geo, bladePaint);
    box(blade, 'rotor-tip', [0.07, 0.02, 0.15], [3.975, -0.108, 0], yellow);
  }
}
function tail(parent) {
  // Upper and lower vertical stabilizers, traced from the station diagram.
  surface(
    parent,
    'tail-fin',
    at(275.9, 57.5),
    at(290.3, 56),
    at(297.7, 104.8),
    at(304.8, 104.7),
    0.09,
  );
  surface(
    parent,
    'tail-stabilizer-1',
    at(275.6, 49.9),
    at(288, 50),
    at(288.3, 24.8),
    at(295, 24.7),
    0.09,
  );
  tube(
    parent,
    'tail-brace-1',
    [at(290.5, 26), at(291.5, 22.8), at(293.5, 21.6), at(295.4, 22)],
    silver,
    0.01,
  );
  // One horizontal stabilizer, right side only, raised 25 degrees, with one faired strut to the
  // fin: TM para 2-405 and its plan view.
  const raise = Math.tan((25 * Math.PI) / 180),
    tipX = -61;
  const stabilizerRoot = 2.8,
    wlRoot = 56.2,
    wlTip = wlRoot + (-tipX - stabilizerRoot) * raise;
  surface(
    parent,
    'tail-stabilizer--1',
    at(276.7, wlRoot, -stabilizerRoot),
    at(293.5, wlRoot - 0.6, -stabilizerRoot),
    at(276.9, wlTip, tipX),
    at(293.5, wlTip - 0.6, tipX),
    0.09,
  );
  const midStabilizer = at(284, lerp(wlRoot, wlTip, 0.56), lerp(-stabilizerRoot, tipX, 0.56)),
    midFin = at(289.5, 81.5, -0.3);
  rod(parent, 'tail-brace--1', midStabilizer, midFin, 0.017, olive);
  // The gearbox case rides on the boom (identity transform), so it leaves with a broken-off boom.
  const gearbox = group(parent.getObjectByName('tail-boom'), 'tail-gearbox', at(284.4, 54.26));
  gearbox.rotation.x = -PITCH;
  mesh(
    gearbox,
    'tail-gearbox-case',
    new T.CapsuleGeometry(0.044, 0.1, 4, 10).rotateZ(Math.PI / 2),
    olive,
    [0.11, 0, 0],
  );
  const rotor = group(parent, 'tail-rotor', at(284.4, 54.26, 12.6));
  rod(rotor, 'tail-hub', [-0.12, 0, 0], [0.06, 0, 0], 0.03, silver);
  mesh(rotor, 'tail-hub-yoke', new T.SphereGeometry(0.052, 12, 8), dark);
  for (let i = 0; i < 2; i++) {
    const blade = group(rotor, `tail-blade-${i}`);
    blade.rotation.x = i * Math.PI;
    // 4 ft 3 in diameter. Red and white bands, tip outward, as on the restored Cayuses.
    rod(blade, 'tail-blade-root', [0, 0.02, 0], [0, 0.17, 0], 0.024, silver, 0.018);
    box(blade, 'tail-blade-airfoil', [0.018, 0.255, 0.115], [0.008, 0.2925, 0], white);
    box(blade, 'tail-blade-warning', [0.019, 0.09, 0.116], [0.008, 0.465, 0], red);
    box(blade, 'tail-blade-band', [0.019, 0.075, 0.116], [0.008, 0.5475, 0], white);
    box(blade, 'tail-blade-tip', [0.019, 0.0625, 0.116], [0.008, 0.61625, 0], red);
  }
}
/** A faired landing gear strut, thick at the fuselage and pinched at the skid. */
function strut(parent, name, top, foot, material = olive) {
  const a = new T.Vector3(...top),
    b = new T.Vector3(...foot),
    axis = b.clone().sub(a).normalize(),
    chord = new T.Vector3(0, 0, 1).addScaledVector(axis, -axis.z).normalize(),
    width = axis.clone().cross(chord).normalize(),
    stations = [
      [0, 0.17, 0.062],
      [0.45, 0.165, 0.06],
      [0.8, 0.125, 0.052],
      [1, 0.092, 0.044],
    ];
  const n = 18,
    rings = stations.map(([t, c, w]) =>
      Array.from({ length: n }, (_, i) => {
        const v = (i * Math.PI * 2) / n,
          s = Math.sin(v);
        return a
          .clone()
          .lerp(b, t)
          .addScaledVector(chord, (c / 2) * Math.cos(v))
          .addScaledVector(width, (w / 2) * signPow(s, 0.8))
          .toArray();
      }),
    );
  ringSurface(parent, name, rings, material);
}
function skids(parent) {
  // 6 ft 9.25 in over the skids, from TM figure 1-2. The skid ends just behind its aft strut.
  const track = 1.032 - 0.038,
    forward = 0.82,
    aft = -0.555;
  for (const side of [-1, 1]) {
    const x = side * track;
    tube(
      parent,
      `skid-${side}`,
      [
        [x, 0.038, aft - 0.17],
        [x, 0.038, -0.1],
        [x, 0.038, 0.84],
        [x, 0.04, 1.16],
        [x, 0.055, 1.38],
        [x, 0.085, 1.56],
        [x, 0.125, 1.7],
        [x, 0.165, 1.79],
      ],
      olive,
      0.038,
    );
    sphere(parent, `skid-end-${side}`, [0.038, 0.038, 0.038], [x, 0.038, aft - 0.17], olive);
    sphere(parent, `skid-bow-${side}`, [0.038, 0.038, 0.038], [x, 0.165, 1.79], olive);
    for (const [label, z] of [
      ['forward', forward],
      ['aft', aft],
    ]) {
      strut(
        parent,
        `skid-strut-${label}-${side}`,
        [side * 0.47, 0.64, z - 0.3],
        [side * 0.96, 0.085, z],
      );
      box(parent, 'skid-saddle', [0.095, 0.03, 0.1], [x, 0.075, z], silver);
    }
  }
}
/** Map flat lettering, in its local XY, onto a side of the airframe. */
function wrapText(parent, name, value, sta, wl, side, pixel, half, slope = 0) {
  const object = text(parent, name, value, 0, 0, 0, pixel, dark),
    positions = object.geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const lx = positions.getX(i),
      ly = positions.getY(i),
      s = sta - (side * lx) / IN,
      w = wl + ly / IN + slope * (s - sta),
      p = at(s, w, side * (half(s, w) + 0.12));
    positions.setXYZ(i, ...p);
  }
  object.geometry.computeVertexNormals();
  object.geometry.computeBoundingBox();
  object.geometry.computeBoundingSphere();
  return object;
}
function details(parent) {
  for (const side of [-1, 1]) {
    wrapText(parent, 'army-stencil', 'UNITED STATES ARMY', 190, 55.6, side, 0.03, boomHalf, -0.03);
    wrapText(parent, 'aircraft-serial', '16172', 137, 70, side, 0.03, (s, w) =>
      pylonWidth(lerp(50, 77.7, (w - 50) / (pylonTop(s) - 50))),
    );
  }
  rod(parent, 'belly-antenna', at(50, 4, 4), at(38, 0, 0.6), 0.005, dark);
  rod(parent, 'belly-antenna', at(50, 4, -4), at(38, 0, -0.6), 0.005, dark);
  sphere(parent, 'anti-collision-beacon', [0.05, 0.03, 0.14], at(64, 1.2), red);
  surface(
    parent,
    'roof-antenna',
    at(84.5, 66.6, 0),
    at(90, 66.4, 0),
    at(72.5, 76.6, 0),
    at(74.5, 76.8, 0),
    0.12,
    olive,
  );
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
  boom(g);
  pylon(g);
  exhaust(g);
  noseDetails(g);
  skids(g);
  rotorHead(g);
  tail(g);
  details(g);
  mergeStaticFrames(g);
  const rows = [];
  for (const sta of [205, 225, 245, 265]) {
    const s = boomSection(sta);
    rows.push(
      Array.from({ length: 26 }, (_, k) => {
        const a = (k * Math.PI * 2) / 26;
        return {
          point: at(sta, s.center + s.radius * Math.cos(a), s.breadth * Math.sin(a)),
          normal: [Math.sin(a), Math.cos(a) * cosP, -Math.cos(a) * sinP],
        };
      }),
    );
  }
  // Rivet rows beside the door frames, on structural skin and never on the transparent panels.
  for (const side of [-1, 1])
    for (const [wl, from, to] of [
      [12, 52, 118],
      [9, 58, 118],
    ])
      rows.push(
        Array.from({ length: 30 }, (_, k) => {
          const sta = lerp(from, to, k / 29),
            point = onSkin(sta, wl, side, 0);
          return { point, normal: [side * 0.8, -0.6, 0] };
        }),
      );
  addRivetRows(g, [g.getObjectByName('tail-boom'), g.getObjectByName('cabin-panels')], rows);
  addInterior(g, interiorLayout, {
    ...api,
    frame: { position: at(100, 0), pitch: PITCH },
    wall: (sta, wl) => halfBreadth(sta, wl) * IN,
  });
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
const model = helicopter();
// interior.json authors the panel in its own leaning frame; the control module wants its face in
// the model's frame.
const panelFace = model.getObjectByName('instrument-panel').getWorldPosition(new T.Vector3());
const controlledModel = completeCockpitControls(model, controlSpec, {
  panelZ: panelFace.z,
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
