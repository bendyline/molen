/** A library of distinct cockpit parts: pedals, stick grips, yokes, throttle and quadrant levers,
 * gear, flap, brake and engine handles, switches and vents.
 *
 * Each part is original polygonal geometry shaped after the real control family it names (a
 * Hornet grip, a Cessna ram's-horn yoke, a Boeing thrust lever), with 12–20 sided round forms, as
 * the medium-fi guide asks of a close view. Parts draw into a detail kit, so they batch with the
 * builder's own geometry by material. Frames:
 *  - levers, sticks and pedals stand on their pivot: +Y up, +Z forward (away from the pilot);
 *  - panel parts (knobs, switches, handles, vents) sit on the panel face, protruding toward the
 *    pilot along local -Z, as instrument faces do.
 * +X is the pilot's left throughout. Mount a part by placing and rotating its group.
 */
import '../../../worldgen/scripts/install-deterministic-math.mjs';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { joinedPath } from '../../../worldgen/scripts/joined-path.mjs';
import { smoothSurface } from '../surface-normals.mjs';
import { detailKit, group, mat, T } from './mesh-kit.mjs';

let shared;
/** Shared default materials, named so the cockpit finisher gives them its rubber, alloy and panel
 * finishes. Pass `palette` to any part to use the builder's own materials instead. */
export function partPalette(overrides = {}) {
  shared ??= {
    grip: mat('flight-control-grip', '#1d2124', { roughness: 0.86, metalness: 0.02 }),
    alloy: mat('flight-control-alloy', '#9aa4a2', { metalness: 0.7, roughness: 0.36 }),
    steel: mat('flight-control-steel', '#596165', { metalness: 0.55, roughness: 0.45 }),
    panel: mat('flight-control-panel', '#30383b', { roughness: 0.82 }),
    legend: mat('flight-control-legend', '#e0e5da'),
    red: mat('flight-control-master', '#a8392f', { roughness: 0.45 }),
    blue: mat('flight-control-propeller', '#2f6fa3', { roughness: 0.45 }),
    white: mat('flight-control-knob', '#e4e1d6', { roughness: 0.5 }),
    yellow: mat('flight-control-caution', '#d6a62a', { roughness: 0.5 }),
    black: mat('flight-control-black', '#101314', { roughness: 0.5 }),
    tread: mat('flight-control-tread', '#2a2f31', { roughness: 0.95 }),
    lamp: mat('flight-control-lamp', '#e0473a', { emissive: '#7a160e', emissiveIntensity: 0.7 }),
  };
  return { ...shared, ...overrides };
}

// ---------------------------------------------------------------------------------------------
// Geometry helpers. Each returns a BufferGeometry in the caller's local frame.

const euler = new T.Euler();
const matrix = new T.Matrix4();
const quaternion = new T.Quaternion();
const unitScale = new T.Vector3(1, 1, 1);
/** Rotate (XYZ Euler) then translate a geometry in place. */
export function place(geometry, at = [0, 0, 0], rotation = [0, 0, 0], scale) {
  quaternion.setFromEuler(euler.set(...rotation));
  matrix.compose(
    new T.Vector3(...at),
    quaternion,
    scale ? new T.Vector3(...scale) : unitScale.clone(),
  );
  return geometry.applyMatrix4(matrix);
}
/** A turned part from a [radius, y] profile, bottom to top, about local +Y. Creases above
 * `crease` degrees stay hard, so a knob keeps its skirt edge and a smooth flank. */
export function lathe(profile, segments = 16, crease = 35) {
  const geometry = new T.LatheGeometry(
    profile.map(([r, y]) => new T.Vector2(Math.max(r, 0), y)),
    segments,
  );
  const result = smoothSurface(geometry, crease);
  geometry.dispose();
  return result;
}
/** A round bar along a polyline (bends are mitered), `sides` facets around. */
export function tube(points, radius, sides = 12, closed = false) {
  const { positions, indices } = joinedPath(points, radius, sides, closed);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
/** A straight round bar between two points, optionally tapered. */
export function bar(a, b, radius, sides = 14, radiusB = radius) {
  const from = new T.Vector3(...a),
    delta = new T.Vector3(...b).sub(from);
  const geometry = new T.CylinderGeometry(radiusB, radius, delta.length(), sides);
  geometry.applyQuaternion(
    new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), delta.clone().normalize()),
  );
  geometry.translate(...from.addScaledVector(delta, 0.5).toArray());
  return geometry;
}
/** A box with rounded vertical corners and rounded front/back edges. */
export function roundedBox([w, h, depth], radius = 0.004, segments, curve) {
  // Switch-sized parts get a single chamfer: rounding them costs triangles nobody can see.
  // `segments`/`curve` 1 asks the same of a larger part that is seen only in passing.
  const small = Math.max(w, h, depth) < 0.03;
  segments ??= small ? 1 : 2;
  curve ??= small ? 1 : 3;
  const r = Math.max(0, Math.min(radius, w / 2 - 1e-5, h / 2 - 1e-5, depth / 2 - 1e-5));
  const iw = w / 2 - r,
    ih = h / 2 - r;
  const shape = new T.Shape();
  const c = Math.max(1e-5, Math.min(iw, ih) * 0.35);
  shape.moveTo(-iw + c, -ih);
  shape.lineTo(iw - c, -ih);
  shape.quadraticCurveTo(iw, -ih, iw, -ih + c);
  shape.lineTo(iw, ih - c);
  shape.quadraticCurveTo(iw, ih, iw - c, ih);
  shape.lineTo(-iw + c, ih);
  shape.quadraticCurveTo(-iw, ih, -iw, ih - c);
  shape.lineTo(-iw, -ih + c);
  shape.quadraticCurveTo(-iw, -ih, -iw + c, -ih);
  const geometry = new T.ExtrudeGeometry(shape, {
    depth: Math.max(1e-5, depth - 2 * r),
    steps: 1,
    bevelEnabled: r > 0,
    bevelThickness: r,
    bevelSize: r,
    bevelSegments: segments,
    curveSegments: curve,
  });
  geometry.deleteAttribute('uv');
  geometry.translate(0, 0, -depth / 2 + r);
  const result = smoothSurface(geometry, 50);
  geometry.dispose();
  return result;
}
/** A superellipse contour [x, z] around (cx, cz); power 2 is an ellipse, higher is squarer. */
export function contour(cx, cz, rx, rz, count = 16, power = 2.4) {
  return Array.from({ length: count }, (_, i) => {
    const t = (i / count) * Math.PI * 2,
      c = Math.cos(t),
      s = Math.sin(t);
    return [
      cx + rx * Math.sign(c) * Math.abs(c) ** (2 / power),
      cz + rz * Math.sign(s) * Math.abs(s) ** (2 / power),
    ];
  });
}
/** A solid lofted up local +Y through [x, z] sections of equal count; capped both ends. */
export function loftUp(sections, crease = 55) {
  const positions = [];
  const push = (...points) => {
    for (const p of points) positions.push(...p);
  };
  const center = (s) => {
    const n = s.points.length;
    return s.points.reduce((sum, [x, z]) => [sum[0] + x / n, s.y, sum[2] + z / n], [0, 0, 0]);
  };
  const v = new T.Vector3(),
    w = new T.Vector3(),
    o = new T.Vector3();
  const facing = (a, b, c, out) => {
    v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    w.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    v.cross(w);
    o.set(...out);
    return v.dot(o) >= 0;
  };
  for (let i = 0; i < sections.length - 1; i++) {
    const s0 = sections[i],
      s1 = sections[i + 1],
      n = s0.points.length,
      c0 = center(s0),
      c1 = center(s1);
    for (let j = 0; j < n; j++) {
      const a = [s0.points[j][0], s0.y, s0.points[j][1]],
        b = [s1.points[j][0], s1.y, s1.points[j][1]],
        c = [s1.points[(j + 1) % n][0], s1.y, s1.points[(j + 1) % n][1]],
        e = [s0.points[(j + 1) % n][0], s0.y, s0.points[(j + 1) % n][1]];
      const mid = [0, 1, 2].map((k) => (a[k] + b[k] + c[k] + e[k]) / 4 - (c0[k] + c1[k]) / 2);
      mid[1] = 0;
      if (facing(a, b, c, mid)) push(a, b, c, a, c, e);
      else push(a, c, b, a, e, c);
    }
  }
  for (const [s, up] of [
    [sections[0], -1],
    [sections.at(-1), 1],
  ]) {
    const c = center(s),
      n = s.points.length;
    for (let j = 0; j < n; j++) {
      const a = [s.points[j][0], s.y, s.points[j][1]],
        b = [s.points[(j + 1) % n][0], s.y, s.points[(j + 1) % n][1]];
      if (facing(c, a, b, [0, up, 0])) push(c, a, b);
      else push(c, b, a);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  const result = smoothSurface(geometry, crease);
  geometry.dispose();
  return result;
}
export const sphere = (r, at, scale = [1, 1, 1], w = 14, h = 10) =>
  place(new T.SphereGeometry(r, w, h), at, [0, 0, 0], scale);
export const disc = (r, h, at, rotation = [0, 0, 0], sides = 16) =>
  place(new T.CylinderGeometry(r, r, h, sides), at, rotation);
/** Merge geometries per material, transform them once, and add them to the kit. */
export function emit(d, byMaterial, at = [0, 0, 0], rotation = [0, 0, 0]) {
  const meshes = [];
  for (const [material, list] of byMaterial) {
    const geometries = list.filter(Boolean).map((g) => (g.index ? g.toNonIndexed() : g));
    for (const g of geometries) {
      g.deleteAttribute('uv');
      if (!g.getAttribute('normal')) g.computeVertexNormals();
    }
    if (!geometries.length) continue;
    const merged = mergeGeometries(geometries);
    place(merged, at, rotation);
    meshes.push(d.add(merged, material));
  }
  return meshes;
}
/** Collects geometry by material for one emit. */
export function batch() {
  const map = new Map();
  const add = (material, ...geometries) => {
    if (!map.has(material)) map.set(material, []);
    map.get(material).push(...geometries);
  };
  return { map, add };
}

// ---------------------------------------------------------------------------------------------
// Rudder pedals. Origin at the middle of the pad; the pad faces the pilot (-Z) and leans its top
// forward by `lean`, as real pedals do. `side` is +1 for the left pedal (outboard +X).

const PEDAL_LEAN = { fighter: 0.3, ga: 0.42, airliner: 0.22, heli: 0.35, warbird: 0.3 };
/** Draw one rudder pedal into a kit at its pivot. `drop` is how far the arm runs down to the
 * floor or hinge; styles: fighter, ga, airliner, heli, warbird. */
export function pedalGeometry(d, { style = 'ga', side = 1, lean, scale = 1, drop, palette } = {}) {
  const P = partPalette(palette);
  const k = scale,
    out = side >= 0 ? 1 : -1,
    tilt = lean ?? PEDAL_LEAN[style] ?? 0.3;
  const pad = batch(), // in the leaned pad frame
    fixed = batch(); // in the pedal frame
  if (style === 'fighter') {
    const w = 0.085 * k,
      h = 0.15 * k;
    pad.add(P.steel, roundedBox([w, h, 0.016], 0.006));
    // Raised rubber tread with a toe bar across its top; the guard keeps the boot inboard.
    pad.add(P.tread, place(roundedBox([w * 0.74, h * 0.62, 0.005], 0.004), [0, h * 0.06, -0.009]));
    pad.add(P.steel, bar([-w * 0.38, h * 0.43, -0.011], [w * 0.38, h * 0.43, -0.011], 0.0045, 12));
    pad.add(
      P.steel,
      place(roundedBox([0.007, h * 0.78, 0.048], 0.003), [out * (w / 2 + 0.002), -h * 0.06, -0.02]),
    );
    pad.add(P.steel, place(roundedBox([w * 1.02, 0.01, 0.04], 0.003), [0, -h / 2 + 0.004, -0.017]));
    const down = drop ?? 0.13 * k;
    pad.add(
      P.alloy,
      tube(
        [
          [0, -h * 0.2, 0.012],
          [0, -h * 0.45, 0.035],
          [0, -h * 0.5 - down * 0.7, 0.06],
        ],
        0.008,
        12,
      ),
    );
    pad.add(P.steel, disc(0.012, 0.03, [0, -h * 0.5 - down * 0.7, 0.06], [0, 0, Math.PI / 2]));
  } else if (style === 'ga') {
    // Cessna/Piper pedal: a curved toe-brake pad on a flat arm, the brake cylinder behind it.
    const w = 0.1 * k,
      h = 0.072 * k;
    pad.add(P.alloy, roundedBox([w, h, 0.01], 0.012));
    for (const y of [-0.38, 0, 0.38])
      pad.add(P.alloy, bar([-w * 0.42, y * h, -0.0065], [w * 0.42, y * h, -0.0065], 0.0022, 8));
    pad.add(P.steel, place(roundedBox([w * 0.3, h * 0.18, 0.012], 0.003), [0, -h * 0.55, 0.005]));
    const down = drop ?? 0.16 * k;
    pad.add(
      P.steel,
      place(roundedBox([0.018, down, 0.009], 0.003), [0, -h * 0.5 - down / 2, 0.012], [0.12, 0, 0]),
    );
    pad.add(
      P.alloy,
      bar([out * w * 0.22, h * 0.3, 0.012], [out * w * 0.22, -h * 1.2, 0.09], 0.006, 12),
    );
    pad.add(
      P.steel,
      bar([out * w * 0.22, -h * 0.55, 0.055], [out * w * 0.22, -h * 1.35, 0.11], 0.0095, 14),
    );
  } else if (style === 'airliner') {
    // Boeing/Airbus pedal: a broad rounded plate with a rubber face and a heel rest, hung from an
    // arm that rises to the pedal box.
    const w = 0.12 * k,
      h = 0.19 * k;
    pad.add(P.steel, roundedBox([w, h, 0.018], 0.018));
    pad.add(P.tread, place(roundedBox([w * 0.82, h * 0.78, 0.005], 0.012), [0, h * 0.04, -0.01]));
    pad.add(P.steel, place(roundedBox([w * 0.86, 0.016, 0.05], 0.005), [0, -h / 2 - 0.004, -0.02]));
    pad.add(
      P.alloy,
      tube(
        [
          [0, h * 0.38, 0.012],
          [0, h * 0.5 + 0.05, 0.05],
          [0, h * 0.5 + 0.11, 0.12],
        ],
        0.011,
        12,
      ),
    );
  } else if (style === 'heli') {
    // Bell/Robinson pedal: a small paddle on a post, with a heel bar.
    const w = 0.075 * k,
      h = 0.1 * k;
    pad.add(P.steel, roundedBox([w, h, 0.012], 0.01));
    pad.add(P.tread, place(roundedBox([w * 0.8, h * 0.5, 0.004], 0.006), [0, h * 0.12, -0.007]));
    pad.add(P.steel, bar([-w * 0.45, -h * 0.48, -0.02], [w * 0.45, -h * 0.48, -0.02], 0.005, 12));
    const down = drop ?? 0.12 * k;
    pad.add(P.alloy, bar([0, -h * 0.4, 0.01], [0, -h * 0.5 - down, 0.03], 0.008, 12));
  } else if (style === 'warbird') {
    // Stirrup pedal: a pierced metal tread between side rails, a strap over the toes.
    const w = 0.095 * k,
      h = 0.14 * k;
    pad.add(P.steel, place(roundedBox([w, h, 0.007], 0.004), [0, 0, 0.002]));
    for (const s of [-1, 1])
      pad.add(
        P.alloy,
        tube(
          [
            [s * w * 0.52, -h * 0.5, -0.004],
            [s * w * 0.52, h * 0.5, -0.004],
          ],
          0.006,
          10,
        ),
      );
    pad.add(P.alloy, bar([-w * 0.52, h * 0.5, -0.004], [w * 0.52, h * 0.5, -0.004], 0.006, 10));
    // Lightening holes, two staggered rows.
    for (const [x, y] of [
      [-0.25, 0.3],
      [0.25, 0.3],
      [0, 0.02],
      [-0.25, -0.26],
      [0.25, -0.26],
    ])
      pad.add(P.black, disc(w * 0.13, 0.009, [x * w, y * h, 0.002], [Math.PI / 2, 0, 0], 14));
    pad.add(
      P.tread,
      tube(
        [
          [-w * 0.52, h * 0.12, -0.004],
          [0, h * 0.14, -0.04],
          [w * 0.52, h * 0.12, -0.004],
        ],
        0.005,
        8,
      ),
    );
    const down = drop ?? 0.12 * k;
    pad.add(P.alloy, bar([0, -h * 0.5, 0], [0, -h * 0.5 - down, 0.04], 0.009, 12));
  } else throw Error(`Unknown pedal style: ${style}`);
  emit(d, pad.map, [0, 0, 0], [tilt, 0, 0]);
  emit(d, fixed.map);
}
export function pedal(parent, name, at, options = {}) {
  const g = group(parent, name, at),
    d = detailKit(g, g.name);
  pedalGeometry(d, options);
  d.finish();
  return g;
}

// ---------------------------------------------------------------------------------------------
// Stick grips and sticks. A grip's base is at its origin, +Y along the grip, the trigger at +Z.

/** Draw a stick grip into a batch; styles: hornet, b8, f16, euro, soviet, cyclic, airbus, warbird. */
function gripInto(b, style, P, k = 1) {
  const L = (rows) =>
    loftUp(
      rows.map(([y, cz, rx, rz, power = 2.4]) => ({
        y: y * k,
        points: contour(0, cz * k, rx * k, rz * k, 18, power),
      })),
    );
  const s = (v) => v * k;
  if (style === 'hornet') {
    b.add(
      P.alloy,
      lathe(
        [
          [0, 0],
          [s(0.019), 0],
          [s(0.02), s(0.006)],
          [s(0.017), s(0.012)],
          [0, s(0.012)],
        ],
        18,
      ),
    );
    b.add(
      P.grip,
      L([
        [0.012, 0, 0.016, 0.019],
        [0.035, 0.002, 0.019, 0.023],
        [0.062, 0.004, 0.0195, 0.024],
        [0.088, 0.002, 0.019, 0.023],
        [0.108, -0.001, 0.021, 0.026],
        [0.124, -0.003, 0.024, 0.028],
        [0.14, -0.004, 0.023, 0.027],
        [0.149, -0.004, 0.016, 0.019],
        [0.152, -0.004, 0.007, 0.008],
      ]),
    );
    b.add(
      P.black,
      disc(s(0.0055), s(0.008), [s(0.004), s(0.152), s(-0.009)]),
      sphere(s(0.004), [s(0.004), s(0.157), s(-0.009)], [1, 0.6, 1], 10, 6),
    );
    b.add(
      P.black,
      place(roundedBox([s(0.009), s(0.006), s(0.01)], s(0.002)), [s(-0.01), s(0.151), s(0.004)]),
    );
    b.add(P.red, disc(s(0.0045), s(0.006), [s(0.011), s(0.151), s(0.008)]));
    b.add(
      P.black,
      place(roundedBox([s(0.006), s(0.012), s(0.01)], s(0.002)), [s(0.024), s(0.128), s(-0.004)]),
    );
    b.add(
      P.alloy,
      tube(
        [
          [0, s(0.118), s(0.024)],
          [0, s(0.115), s(0.046)],
          [0, s(0.086), s(0.05)],
          [0, s(0.068), s(0.024)],
        ],
        s(0.0028),
        10,
      ),
    );
    b.add(
      P.black,
      tube(
        [
          [0, s(0.106), s(0.025)],
          [0, s(0.099), s(0.036)],
          [0, s(0.088), s(0.035)],
        ],
        s(0.0048),
        10,
      ),
    );
    b.add(
      P.black,
      place(
        roundedBox([s(0.006), s(0.014), s(0.012)], s(0.002)),
        [s(0.011), s(0.032), s(0.022)],
        [0.3, 0, 0],
      ),
    );
  } else if (style === 'b8') {
    // The classic US fighter grip (F-14, F-15, AV-8B, OV-10): round body, head canted forward.
    b.add(
      P.alloy,
      lathe(
        [
          [0, 0],
          [s(0.018), 0],
          [s(0.019), s(0.008)],
          [0, s(0.008)],
        ],
        18,
      ),
    );
    b.add(
      P.grip,
      L([
        [0.008, 0, 0.017, 0.02, 2],
        [0.04, 0.002, 0.019, 0.022, 2],
        [0.075, 0.003, 0.0185, 0.021, 2],
        [0.1, 0.006, 0.02, 0.024, 2.2],
        [0.118, 0.012, 0.022, 0.028, 2.6],
        [0.132, 0.016, 0.02, 0.027, 2.6],
        [0.138, 0.016, 0.012, 0.018, 2.4],
      ]),
    );
    b.add(P.red, disc(s(0.0055), s(0.006), [s(-0.006), s(0.138), s(0.026)], [0.45, 0, 0]));
    b.add(
      P.black,
      disc(s(0.006), s(0.008), [s(0.006), s(0.139), s(0.008)]),
      sphere(s(0.0045), [s(0.006), s(0.144), s(0.008)], [1, 0.55, 1], 10, 6),
    );
    b.add(
      P.black,
      place(roundedBox([s(0.012), s(0.008), s(0.008)], s(0.002)), [s(0.021), s(0.118), s(0.004)]),
    );
    b.add(
      P.alloy,
      tube(
        [
          [0, s(0.11), s(0.03)],
          [0, s(0.098), s(0.056)],
          [0, s(0.07), s(0.052)],
          [0, s(0.058), s(0.022)],
        ],
        s(0.003),
        10,
      ),
    );
    b.add(
      P.black,
      tube(
        [
          [0, s(0.098), s(0.03)],
          [0, s(0.088), s(0.042)],
          [0, s(0.076), s(0.038)],
        ],
        s(0.005),
        10,
      ),
    );
    b.add(
      P.black,
      place(
        roundedBox([s(0.008), s(0.028), s(0.01)], s(0.003)),
        [s(-0.016), s(0.05), s(0.017)],
        [0, 0, 0.1],
      ),
    );
  } else if (style === 'f16') {
    // Side-stick: raked forward, a palm swell on the right, thumb switches on the left of the top.
    b.add(
      P.grip,
      L([
        [0, 0.006, 0.021, 0.026, 2.6],
        [0.03, 0.01, 0.024, 0.03, 2.4],
        [0.06, 0.012, 0.025, 0.031, 2.3],
        [0.085, 0.01, 0.023, 0.029, 2.3],
        [0.1, 0.006, 0.019, 0.025, 2.3],
        [0.108, 0.004, 0.01, 0.015, 2.2],
      ]),
    );
    b.add(P.grip, sphere(s(0.016), [s(-0.016), s(0.05), s(-0.004)], [0.7, 1.3, 1]));
    b.add(
      P.black,
      disc(s(0.006), s(0.007), [s(0.008), s(0.106), s(-0.004)]),
      disc(s(0.0042), s(0.006), [s(0.009), s(0.1), s(0.016)], [0.6, 0, 0]),
    );
    b.add(P.red, disc(s(0.0045), s(0.005), [s(-0.006), s(0.107), s(0.01)]));
    b.add(
      P.black,
      tube(
        [
          [0, s(0.085), s(0.036)],
          [0, s(0.076), s(0.046)],
          [0, s(0.064), s(0.042)],
        ],
        s(0.0055),
        10,
      ),
    );
    b.add(
      P.black,
      place(roundedBox([s(0.01), s(0.016), s(0.01)], s(0.003)), [s(0.021), s(0.07), s(0.018)]),
    );
  } else if (style === 'euro') {
    // Typhoon/Gripen/Rafale: a smooth egg-shaped grip under a thumb shelf crowded with switches.
    b.add(
      P.alloy,
      lathe(
        [
          [0, 0],
          [s(0.017), 0],
          [s(0.018), s(0.01)],
          [0, s(0.01)],
        ],
        18,
      ),
    );
    b.add(
      P.grip,
      L([
        [0.01, 0, 0.017, 0.02, 2],
        [0.045, 0.004, 0.021, 0.025, 2],
        [0.08, 0.004, 0.021, 0.025, 2],
        [0.105, 0, 0.022, 0.025, 2.2],
        [0.12, -0.004, 0.027, 0.028, 2.6],
        [0.132, -0.006, 0.026, 0.026, 2.6],
        [0.137, -0.006, 0.016, 0.016, 2.2],
      ]),
    );
    b.add(
      P.grip,
      place(
        roundedBox([s(0.03), s(0.012), s(0.032)], s(0.005)),
        [s(0.018), s(0.123), s(-0.006)],
        [0, 0, -0.25],
      ),
    );
    for (const [x, z] of [
      [0.022, -0.012],
      [0.012, -0.016],
      [0.004, 0.008],
      [0.026, 0.004],
    ])
      b.add(P.black, disc(s(0.0038), s(0.006), [s(x), s(0.137), s(z)]));
    b.add(P.red, disc(s(0.004), s(0.006), [s(-0.008), s(0.136), s(0.012)]));
    b.add(
      P.black,
      tube(
        [
          [0, s(0.1), s(0.025)],
          [0, s(0.088), s(0.036)],
          [0, s(0.074), s(0.032)],
        ],
        s(0.0055),
        10,
      ),
    );
  } else if (style === 'soviet') {
    // MiG grip: a round body under a domed head; the wheel-brake lever arcs down its front.
    b.add(
      P.alloy,
      lathe(
        [
          [0, 0],
          [s(0.02), 0],
          [s(0.021), s(0.01)],
          [0, s(0.01)],
        ],
        18,
      ),
    );
    b.add(
      P.grip,
      lathe(
        [
          [0, s(0.01)],
          [s(0.018), s(0.01)],
          [s(0.021), s(0.05)],
          [s(0.02), s(0.09)],
          [s(0.023), s(0.11)],
          [s(0.026), s(0.125)],
          [s(0.022), s(0.14)],
          [s(0.012), s(0.148)],
          [0, s(0.15)],
        ],
        18,
        50,
      ),
    );
    b.add(
      P.red,
      place(
        roundedBox([s(0.016), s(0.006), s(0.022)], s(0.003)),
        [0, s(0.149), s(0.004)],
        [0.15, 0, 0],
      ),
    );
    b.add(P.black, disc(s(0.005), s(0.007), [s(0.014), s(0.142), s(-0.008)], [0, 0, 0.5]));
    b.add(
      P.alloy,
      tube(
        [
          [s(-0.004), s(0.13), s(0.026)],
          [s(-0.004), s(0.11), s(0.05)],
          [s(-0.004), s(0.06), s(0.056)],
          [s(-0.004), s(0.03), s(0.044)],
        ],
        s(0.0042),
        12,
      ),
    );
    b.add(P.alloy, sphere(s(0.006), [s(-0.004), s(0.03), s(0.044)]));
    b.add(
      P.black,
      tube(
        [
          [0, s(0.112), s(0.028)],
          [0, s(0.1), s(0.038)],
          [0, s(0.088), s(0.032)],
        ],
        s(0.005),
        10,
      ),
    );
  } else if (style === 'cyclic') {
    // Helicopter cyclic grip: slim, a cocked head carrying the trim beeper and release switches.
    b.add(
      P.grip,
      L([
        [0, 0, 0.015, 0.017, 2],
        [0.04, 0.002, 0.017, 0.019, 2],
        [0.08, 0.003, 0.017, 0.019, 2],
        [0.105, 0.008, 0.019, 0.022, 2.2],
        [0.122, 0.014, 0.021, 0.025, 2.5],
        [0.132, 0.016, 0.018, 0.022, 2.4],
        [0.136, 0.016, 0.01, 0.013, 2.2],
      ]),
    );
    b.add(
      P.black,
      disc(s(0.0065), s(0.008), [s(0.002), s(0.137), s(0.012)], [0.35, 0, 0]),
      sphere(s(0.005), [s(0.002), s(0.141), s(0.014)], [1, 0.55, 1], 10, 6),
    );
    b.add(
      P.red,
      place(
        roundedBox([s(0.012), s(0.009), s(0.008)], s(0.002)),
        [s(0.016), s(0.126), s(0.02)],
        [0.3, 0, 0],
      ),
    );
    b.add(
      P.black,
      place(roundedBox([s(0.009), s(0.009), s(0.009)], s(0.002)), [s(-0.017), s(0.12), s(0.01)]),
    );
    b.add(
      P.black,
      tube(
        [
          [0, s(0.098), s(0.022)],
          [0, s(0.088), s(0.032)],
          [0, s(0.076), s(0.028)],
        ],
        s(0.0048),
        10,
      ),
    );
  } else if (style === 'airbus') {
    // Side-stick: a short grip on a domed boot, the red takeover button on its left shoulder.
    b.add(
      P.grip,
      L([
        [0, 0.006, 0.02, 0.025, 2.2],
        [0.03, 0.008, 0.022, 0.027, 2.2],
        [0.06, 0.008, 0.022, 0.027, 2.2],
        [0.08, 0.004, 0.022, 0.026, 2.4],
        [0.092, 0, 0.018, 0.022, 2.4],
        [0.097, 0, 0.008, 0.01, 2.2],
      ]),
    );
    b.add(P.red, disc(s(0.0065), s(0.007), [s(0.014), s(0.09), s(-0.006)], [0, 0, 0.45]));
    b.add(
      P.black,
      tube(
        [
          [0, s(0.078), s(0.03)],
          [0, s(0.068), s(0.04)],
          [0, s(0.056), s(0.035)],
        ],
        s(0.006),
        10,
      ),
    );
  } else if (style === 'warbird') {
    // AN-5 pistol grip with the bomb button on top and the gun trigger in front.
    b.add(
      P.alloy,
      lathe(
        [
          [0, 0],
          [s(0.017), 0],
          [s(0.018), s(0.012)],
          [0, s(0.012)],
        ],
        16,
      ),
    );
    b.add(
      P.grip,
      L([
        [0.012, 0, 0.018, 0.02, 2],
        [0.06, 0.002, 0.02, 0.023, 2],
        [0.1, 0.01, 0.021, 0.025, 2.2],
        [0.122, 0.02, 0.021, 0.03, 2.4],
        [0.13, 0.022, 0.014, 0.022, 2.2],
      ]),
    );
    b.add(P.red, disc(s(0.006), s(0.008), [0, s(0.13), s(0.03)], [0.7, 0, 0]));
    b.add(
      P.alloy,
      tube(
        [
          [0, s(0.098), s(0.034)],
          [0, s(0.088), s(0.058)],
          [0, s(0.058), s(0.05)],
          [0, s(0.05), s(0.022)],
        ],
        s(0.003),
        10,
      ),
    );
    b.add(
      P.black,
      tube(
        [
          [0, s(0.09), s(0.032)],
          [0, s(0.08), s(0.045)],
          [0, s(0.068), s(0.04)],
        ],
        s(0.0055),
        10,
      ),
    );
  } else throw Error(`Unknown grip style: ${style}`);
}
/** A stick from its pivot: boot, shaft to `height` (top raked `rake` along Z), and a grip. */
export function stickGeometry(
  d,
  { style = 'hornet', height = 0.5, rake = 0, boot = true, shaft = 0.011, scale = 1, palette } = {},
) {
  const P = partPalette(palette);
  const fixed = batch(),
    grip = batch();
  const top = [0, height, rake],
    tilt = Math.atan2(rake, height);
  if (boot) {
    const r = Math.max(0.035, shaft * 4);
    fixed.add(
      P.tread,
      lathe(
        [
          [0, 0],
          [r, 0],
          [r * 0.95, 0.014],
          [r * 0.72, 0.022],
          [r * 0.7, 0.034],
          [r * 0.48, 0.044],
          [r * 0.46, 0.056],
          [shaft * 1.35, 0.075],
          [shaft * 1.3, 0.085],
          [0, 0.085],
        ],
        18,
        28,
      ),
    );
  }
  fixed.add(P.alloy, bar([0, boot ? 0.08 : 0, 0], top, shaft, 14, shaft * 0.92));
  gripInto(grip, style, P, scale);
  emit(d, fixed.map);
  emit(d, grip.map, top, [tilt, 0, 0]);
}

// ---------------------------------------------------------------------------------------------
// Control wheels (yokes). Origin at the hub; horns stand in the XY plane facing the pilot (-Z);
// an optional column runs forward (+Z) from the hub. `width` is the span between grip centers.

/** Styles: cessna (ram's horn), piper (slanted horns on a shield), beech (M-shaped), boeing
 * (airliner wheel), kingair (tall horns with switch heads), wheel (spoked rim). */
export function yokeGeometry(
  d,
  { style = 'cessna', width, column = 0, columnRadius = 0.014, palette } = {},
) {
  const P = partPalette(palette);
  const b = batch();
  const spans = { cessna: 0.3, piper: 0.32, beech: 0.3, boeing: 0.36, kingair: 0.34, wheel: 0.36 };
  const half = (width ?? spans[style] ?? 0.3) / 2;
  const horn = (x, h, rx = 0.014, rz = 0.017, cant = 0, y0 = 0) =>
    place(
      loftUp([
        { y: 0, points: contour(0, 0, rx * 0.9, rz * 0.9, 16, 2.2) },
        { y: h * 0.3, points: contour(0, 0.001, rx, rz, 16, 2.2) },
        { y: h * 0.75, points: contour(0, 0.001, rx * 1.02, rz, 16, 2.2) },
        { y: h * 0.93, points: contour(0, 0, rx * 0.85, rz * 0.85, 16, 2.2) },
        { y: h, points: contour(0, 0, rx * 0.35, rz * 0.35, 16, 2.2) },
      ]),
      [x, y0, 0],
      [0, 0, cant],
    );
  if (style === 'cessna') {
    b.add(P.grip, roundedBox([0.09, 0.052, 0.04], 0.012));
    for (const s of [-1, 1]) {
      b.add(
        P.grip,
        tube(
          [
            [s * 0.04, -0.004, 0.002],
            [s * (half - 0.05), -0.012, -0.004],
            [s * (half - 0.012), 0.0, -0.008],
            [s * half, 0.03, -0.01],
          ],
          0.012,
          14,
        ),
      );
      b.add(P.grip, horn(s * half, 0.115, 0.0145, 0.018, -s * 0.06, 0.02));
    }
    b.add(P.black, place(roundedBox([0.012, 0.016, 0.008], 0.003), [half - 0.002, 0.13, -0.012]));
    b.add(P.red, disc(0.004, 0.006, [half + 0.004, 0.118, -0.02], [Math.PI / 2, 0, 0]));
    b.add(P.alloy, place(roundedBox([0.05, 0.018, 0.004], 0.004), [0, 0.004, -0.021]));
  } else if (style === 'piper') {
    b.add(
      P.grip,
      loftUp([
        { y: -0.035, points: contour(0, 0, 0.03, 0.018, 16, 3) },
        { y: 0.0, points: contour(0, 0, 0.05, 0.02, 16, 3) },
        { y: 0.03, points: contour(0, 0, 0.055, 0.02, 16, 3) },
        { y: 0.034, points: contour(0, 0, 0.045, 0.016, 16, 3) },
      ]),
    );
    for (const s of [-1, 1]) {
      b.add(
        P.grip,
        tube(
          [
            [s * 0.05, 0.01, 0],
            [s * (half - 0.03), 0.02, -0.004],
            [s * half, 0.045, -0.008],
          ],
          0.0125,
          14,
        ),
      );
      b.add(P.grip, horn(s * half, 0.1, 0.014, 0.017, -s * 0.32, 0.03));
    }
    b.add(P.white, place(roundedBox([0.06, 0.03, 0.004], 0.006), [0, 0.004, -0.022]));
  } else if (style === 'beech') {
    b.add(P.grip, roundedBox([0.07, 0.07, 0.042], 0.014));
    for (const s of [-1, 1]) {
      b.add(
        P.grip,
        tube(
          [
            [s * 0.03, -0.025, 0],
            [s * (half * 0.55), -0.05, -0.006],
            [s * (half - 0.01), -0.03, -0.01],
            [s * half, 0.0, -0.012],
          ],
          0.012,
          14,
        ),
      );
      b.add(P.grip, horn(s * half, 0.13, 0.0145, 0.019, -s * 0.04, -0.005));
      b.add(P.black, disc(0.0045, 0.006, [s * half, 0.128, -0.016], [Math.PI / 2, 0, 0]));
    }
    b.add(P.alloy, place(roundedBox([0.05, 0.022, 0.004], 0.003), [0, 0.0, -0.022]));
  } else if (style === 'kingair') {
    b.add(P.grip, roundedBox([0.1, 0.06, 0.045], 0.014));
    for (const s of [-1, 1]) {
      b.add(
        P.grip,
        tube(
          [
            [s * 0.045, -0.01, 0],
            [s * (half - 0.04), -0.03, -0.006],
            [s * half, 0.01, -0.012],
          ],
          0.013,
          14,
        ),
      );
      b.add(P.grip, horn(s * half, 0.12, 0.016, 0.02, -s * 0.08, 0.005));
      b.add(
        P.grip,
        place(
          roundedBox([0.04, 0.03, 0.04], 0.01),
          [s * (half - 0.004), 0.135, -0.006],
          [0, 0, -s * 0.08],
        ),
      );
      b.add(
        P.black,
        place(roundedBox([0.012, 0.012, 0.006], 0.003), [s * (half - 0.01), 0.15, -0.026]),
      );
    }
    b.add(P.alloy, place(roundedBox([0.07, 0.024, 0.004], 0.004), [0, 0.002, -0.024]));
  } else if (style === 'boeing') {
    // A wide wheel: thick horns topped by switch heads, a broad flattened rim beneath.
    b.add(P.grip, roundedBox([0.12, 0.07, 0.05], 0.018));
    for (const s of [-1, 1]) {
      b.add(
        P.grip,
        tube(
          [
            [s * 0.05, -0.02, 0],
            [s * (half * 0.6), -0.055, -0.006],
            [s * (half - 0.015), -0.03, -0.012],
            [s * half, 0.02, -0.014],
          ],
          0.015,
          14,
        ),
      );
      b.add(P.grip, horn(s * half, 0.1, 0.018, 0.022, -s * 0.12, 0.01));
      b.add(
        P.grip,
        place(
          roundedBox([0.05, 0.03, 0.05], 0.012),
          [s * (half + 0.004), 0.12, -0.012],
          [0, 0, -s * 0.12],
        ),
      );
      b.add(
        P.black,
        place(roundedBox([0.012, 0.01, 0.012], 0.003), [s * (half - 0.004), 0.138, -0.03]),
      );
      b.add(
        P.alloy,
        place(roundedBox([0.016, 0.006, 0.008], 0.002), [s * (half + 0.015), 0.134, -0.032]),
      );
    }
    b.add(P.steel, place(roundedBox([0.1, 0.05, 0.006], 0.006), [0, 0.0, -0.028]));
  } else if (style === 'wheel') {
    b.add(P.grip, place(new T.TorusGeometry(half, 0.012, 10, 40), [0, 0, -0.01]));
    b.add(P.alloy, disc(0.03, 0.03, [0, 0, 0], [Math.PI / 2, 0, 0], 18));
    for (const a of [Math.PI / 2 + 0.25, Math.PI * 1.5, Math.PI * 1.5 - 0.25 + Math.PI / 2])
      b.add(
        P.alloy,
        bar([0, 0, -0.005], [Math.cos(a) * half, Math.sin(a) * half, -0.01], 0.007, 10),
      );
  } else throw Error(`Unknown yoke style: ${style}`);
  if (column > 0) b.add(P.alloy, bar([0, 0, 0.015], [0, 0, column], columnRadius, 16));
  emit(d, b.map);
}

// ---------------------------------------------------------------------------------------------
// Quadrant and throttle levers. Origin at the pivot; the shaft rises +Y and the knob caps it.

/** A fluted cylinder (a propeller knob's serrated rim). */
const ribbed = (r, h, ribs = 16, depth = 0.12, y = 0) =>
  loftUp(
    [0, h].map((dy) => ({
      y: y + dy,
      points: Array.from({ length: ribs * 2 }, (_, i) => {
        const a = (i / (ribs * 2)) * Math.PI * 2,
          rr = r * (i % 2 ? 1 - depth : 1);
        return [Math.cos(a) * rr, Math.sin(a) * rr];
      }),
    })),
    20,
  );
/** A scalloped knob (a mixture knob's crinkled rim). */
const scalloped = (r, h, lobes = 8, y = 0) =>
  loftUp(
    [0, h * 0.85, h].map((dy, i) => ({
      y: y + dy,
      points: Array.from({ length: lobes * 6 }, (_, j) => {
        const a = (j / (lobes * 6)) * Math.PI * 2,
          rr = r * (i === 2 ? 0.8 : 1) * (1 - 0.14 * Math.abs(Math.sin((a * lobes) / 2)));
        return [Math.cos(a) * rr, Math.sin(a) * rr];
      }),
    })),
    40,
  );
/** Knob shapes for quadrant levers and push-pull controls, built about +Y from y=0. */
function knobInto(b, kind, P, k = 1) {
  const s = (v) => v * k;
  if (kind === 'throttle')
    b.add(
      P.black,
      lathe(
        [
          [0, 0],
          [s(0.012), 0],
          [s(0.018), s(0.006)],
          [s(0.019), s(0.016)],
          [s(0.016), s(0.022)],
          [0, s(0.024)],
        ],
        20,
      ),
    );
  else if (kind === 'throttle-t') {
    b.add(P.black, place(roundedBox([s(0.052), s(0.018), s(0.024)], s(0.008)), [0, s(0.012), 0]));
    b.add(
      P.black,
      lathe(
        [
          [s(0.007), 0],
          [s(0.01), s(0.004)],
          [s(0.009), s(0.006)],
        ],
        12,
      ),
    );
  } else if (kind === 'prop') {
    b.add(P.blue, ribbed(s(0.017), s(0.016), 18, 0.1, s(0.004)));
    b.add(
      P.blue,
      lathe(
        [
          [s(0.006), 0],
          [s(0.012), s(0.004)],
          [0, s(0.004)],
        ],
        14,
      ),
    );
    b.add(
      P.blue,
      lathe(
        [
          [s(0.0155), s(0.02)],
          [s(0.01), s(0.023)],
          [0, s(0.023)],
        ],
        18,
      ),
    );
  } else if (kind === 'mixture') {
    b.add(P.red, scalloped(s(0.017), s(0.018), 8, s(0.004)));
    b.add(
      P.red,
      lathe(
        [
          [s(0.006), 0],
          [s(0.012), s(0.004)],
          [0, s(0.004)],
        ],
        14,
      ),
    );
  } else if (kind === 'condition') {
    b.add(
      P.grip,
      lathe(
        [
          [s(0.006), 0],
          [s(0.014), s(0.004)],
          [s(0.016), s(0.014)],
          [s(0.013), s(0.03)],
          [s(0.015), s(0.04)],
          [s(0.012), s(0.046)],
          [0, s(0.047)],
        ],
        18,
      ),
    );
    for (let i = 0; i < 4; i++)
      b.add(
        P.white,
        place(
          new T.TorusGeometry(s(0.0145), s(0.0012), 6, 24),
          [0, s(0.012 + i * 0.007), 0],
          [Math.PI / 2, 0, 0],
        ),
      );
  } else if (kind === 'tee')
    b.add(P.grip, place(roundedBox([s(0.034), s(0.014), s(0.016)], s(0.005)), [0, s(0.008), 0]));
  else throw Error(`Unknown knob: ${kind}`);
}
/**
 * Styles: throttle, throttle-t, prop, mixture, condition (GA and turboprop quadrant knobs);
 * thrust-boeing, thrust-airbus, power-turboprop, start-lever (airliner pedestal);
 * hotas-left, hotas-right, hotas-euro (twin fighter grips), hotas-f16, mig, collective.
 * `side` turns an outboard switch toward +X (1) or -X (-1).
 */
export function leverGeometry(
  d,
  {
    style = 'throttle',
    height = 0.12,
    rake = 0,
    side = 1,
    shaft = 'flat',
    palette,
    scale = 1,
  } = {},
) {
  const P = partPalette(palette);
  const fixed = batch(),
    head = batch();
  const top = [0, height, rake],
    tilt = Math.atan2(rake, height),
    s = (v) => v * scale;
  const flatShaft = (w = 0.008, depth = 0.016) =>
    fixed.add(
      P.alloy,
      place(
        roundedBox([w, Math.hypot(height, rake), depth], 0.002, 1),
        [0, height / 2, rake / 2],
        [tilt, 0, 0],
      ),
    );
  const box = (material, size, at, rotation, radius = 0.003) =>
    head.add(material, place(roundedBox(size.map(s), s(radius)), at.map(s), rotation));
  if (['throttle', 'throttle-t', 'prop', 'mixture', 'condition'].includes(style)) {
    if (shaft === 'round') fixed.add(P.alloy, bar([0, 0, 0], top, 0.0045, 12));
    else flatShaft();
    knobInto(head, style, P, scale);
  } else if (style === 'thrust-boeing') {
    fixed.add(
      P.alloy,
      tube(
        [
          [0, 0, 0],
          [0, height * 0.55, rake * 0.4],
          [0, height, rake],
        ],
        0.006,
        10,
      ),
    );
    fixed.add(
      P.steel,
      place(
        roundedBox([0.012, height * 0.5, 0.02], 0.003),
        [0, height * 0.3, rake * 0.2],
        [tilt, 0, 0],
      ),
    );
    const rod = (r, length, x, material) =>
      head.add(
        material,
        place(
          new T.CylinderGeometry(s(r), s(r), s(length), 20),
          [side * s(x), s(0.008), 0],
          [0, 0, Math.PI / 2],
        ),
      );
    rod(0.0145, 0.07, 0.012, P.black);
    rod(0.0148, 0.006, 0.049, P.alloy);
    rod(0.006, 0.005, 0.054, P.red);
    box(P.black, [0.012, 0.01, 0.012], [0, -0.022, -0.012]);
  } else if (style === 'thrust-airbus') {
    fixed.add(
      P.steel,
      place(
        roundedBox([0.016, Math.hypot(height, rake), 0.026], 0.004),
        [0, height / 2, rake / 2],
        [tilt, 0, 0],
      ),
    );
    head.add(
      P.grip,
      loftUp([
        { y: 0, points: contour(0, 0, s(0.016), s(0.02), 16, 2.6) },
        { y: s(0.02), points: contour(0, s(0.004), s(0.02), s(0.028), 16, 2.6) },
        { y: s(0.05), points: contour(0, s(0.006), s(0.021), s(0.03), 16, 2.8) },
        { y: s(0.062), points: contour(0, s(0.004), s(0.016), s(0.024), 16, 2.6) },
      ]),
    );
    head.add(
      P.red,
      place(
        new T.CylinderGeometry(s(0.0055), s(0.0055), s(0.005), 12),
        [side * s(0.021), s(0.04), s(0.004)],
        [0, 0, Math.PI / 2],
      ),
    );
  } else if (style === 'power-turboprop') {
    flatShaft(0.01, 0.018);
    box(P.black, [0.075, 0.02, 0.028], [0, 0.014, 0], undefined, 0.009);
    box(P.black, [0.018, 0.02, 0.02], [0, -0.001, 0], undefined, 0.004);
    box(P.alloy, [0.012, 0.006, 0.02], [side * 0.03, 0.026, 0], undefined, 0.002);
  } else if (style === 'start-lever') {
    // Airliner start (fuel control) lever: a short bar with a knob that lifts over its detent.
    flatShaft(0.007, 0.012);
    box(P.black, [0.022, 0.026, 0.03], [0, 0.012, 0.002], undefined, 0.007);
    box(P.white, [0.024, 0.003, 0.012], [0, 0.02, -0.012], undefined, 0.001);
  } else if (style === 'hotas-left' || style === 'hotas-right' || style === 'hotas-euro') {
    // Fighter throttle: a lever under a sculpted grip; the outboard grip carries the switches
    // (speed brake, radio, cage), the inboard one is a plain hand rest.
    const outboard = style !== 'hotas-right';
    const wide = style === 'hotas-euro' ? 0.026 : 0.024;
    flatShaft(0.012, 0.022);
    head.add(
      P.grip,
      loftUp([
        { y: 0, points: contour(0, 0, s(0.017), s(0.026), 16, 2.8) },
        { y: s(0.025), points: contour(side * s(0.003), s(-0.004), s(0.022), s(0.034), 16, 2.6) },
        { y: s(0.06), points: contour(side * s(0.006), s(-0.008), s(wide), s(0.04), 16, 2.6) },
        { y: s(0.085), points: contour(side * s(0.005), s(-0.012), s(0.022), s(0.036), 16, 2.6) },
        { y: s(0.096), points: contour(side * s(0.003), s(-0.012), s(0.014), s(0.024), 16, 2.4) },
      ]),
    );
    if (outboard) {
      box(P.black, [0.008, 0.016, 0.02], [side * 0.03, 0.07, -0.012]);
      head.add(
        P.black,
        disc(s(0.005), s(0.008), [side * s(0.028), s(0.05), s(-0.03)], [0, 0, Math.PI / 2]),
      );
      box(P.black, [0.014, 0.008, 0.008], [side * 0.008, 0.096, -0.02], undefined, 0.002);
      head.add(P.red, disc(s(0.0045), s(0.006), [side * s(0.004), s(0.097), s(-0.004)]));
      box(P.black, [0.01, 0.012, 0.008], [0, 0.06, 0.03]);
    } else box(P.black, [0.008, 0.03, 0.008], [0, 0.05, 0.03]);
  } else if (style === 'hotas-f16') {
    flatShaft(0.014, 0.026);
    head.add(
      P.grip,
      loftUp([
        { y: 0, points: contour(0, 0, s(0.02), s(0.028), 16, 3) },
        { y: s(0.03), points: contour(side * s(0.006), s(-0.006), s(0.028), s(0.04), 16, 2.6) },
        { y: s(0.07), points: contour(side * s(0.01), s(-0.014), s(0.03), s(0.046), 16, 2.6) },
        { y: s(0.095), points: contour(side * s(0.008), s(-0.02), s(0.024), s(0.04), 16, 2.6) },
        { y: s(0.106), points: contour(side * s(0.006), s(-0.02), s(0.014), s(0.026), 16, 2.4) },
      ]),
    );
    for (const [x, y, z] of [
      [0.038, 0.08, -0.02],
      [0.036, 0.06, -0.044],
      [0.012, 0.104, -0.03],
      [0.004, 0.1, 0.004],
    ])
      box(P.black, [0.009, 0.01, 0.009], [side * x, y, z]);
    head.add(
      P.black,
      tube(
        [
          [side * s(0.02), s(0.05), s(0.022)],
          [side * s(0.02), s(0.04), s(0.028)],
        ],
        s(0.006),
        10,
      ),
    );
  } else if (style === 'mig') {
    fixed.add(P.alloy, bar([0, 0, 0], top, 0.007, 12));
    head.add(
      P.grip,
      lathe(
        [
          [s(0.008), 0],
          [s(0.016), s(0.008)],
          [s(0.022), s(0.03)],
          [s(0.021), s(0.05)],
          [s(0.014), s(0.062)],
          [0, s(0.066)],
        ],
        18,
        50,
      ),
    );
    head.add(P.red, disc(s(0.005), s(0.006), [s(0.008), s(0.064), s(-0.004)]));
    box(P.black, [0.01, 0.014, 0.008], [side * 0.02, 0.04, -0.012]);
  } else if (style === 'collective') {
    // Collective head: the twist-grip throttle under a switch box with the idle release.
    fixed.add(P.alloy, bar([0, 0, 0], top, 0.012, 14));
    head.add(
      P.grip,
      place(new T.CylinderGeometry(s(0.02), s(0.019), s(0.09), 18), [0, s(-0.05), 0]),
    );
    for (let i = 0; i < 5; i++)
      head.add(
        P.black,
        place(
          new T.TorusGeometry(s(0.0195), s(0.0015), 6, 24),
          [0, s(-0.088 + i * 0.019), 0],
          [Math.PI / 2, 0, 0],
        ),
      );
    box(P.steel, [0.05, 0.045, 0.055], [0, 0.02, -0.006], undefined, 0.008);
    for (const [x, y] of [
      [-0.012, 0.044],
      [0.012, 0.044],
      [0, 0.03],
    ])
      head.add(P.black, disc(s(0.005), s(0.006), [s(x), s(y), s(-0.035)], [Math.PI / 2, 0, 0]));
    box(P.white, [0.016, 0.008, 0.008], [side * 0.024, 0.012, -0.035], undefined, 0.002);
  } else throw Error(`Unknown lever style: ${style}`);
  emit(d, fixed.map);
  emit(d, head.map, top, [tilt, 0, 0]);
}
/** A push-pull panel control: shaft out of the panel (-Z) to a quadrant-style knob. */
export function pushPullGeometry(d, { kind = 'throttle', reach = 0.03, palette, scale = 1 } = {}) {
  const P = partPalette(palette);
  const fixed = batch(),
    knob = batch();
  fixed.add(
    P.alloy,
    lathe(
      [
        [0, 0],
        [0.011, 0],
        [0.011, 0.004],
        [0.008, 0.006],
        [0, 0.006],
      ],
      16,
    ),
    bar([0, 0, 0], [0, reach, 0], 0.0035, 12),
  );
  knobInto(knob, kind, P, scale);
  emit(d, fixed.map, [0, 0, 0], [-Math.PI / 2, 0, 0]);
  emit(d, knob.map, [0, 0, -reach], [-Math.PI / 2, 0, 0]);
}

// ---------------------------------------------------------------------------------------------
// Panel parts. Origin on the panel face at the part's pivot; the part protrudes toward -Z.

/** A small wheel-shaped knob facing the pilot, as gear handles wear. */
const wheelKnob = (b, P, r, width, at, tire = P.black, hub = P.alloy, lamp) => {
  b.add(tire, place(new T.TorusGeometry(r, width / 2, 10, 28), at));
  b.add(
    hub,
    place(new T.CylinderGeometry(r * 0.72, r * 0.72, width * 0.8, 20), at, [Math.PI / 2, 0, 0]),
  );
  if (lamp)
    b.add(
      lamp,
      place(new T.CylinderGeometry(r * 0.42, r * 0.42, width * 0.85, 16), at, [Math.PI / 2, 0, 0]),
    );
};
/** Styles: jet (fighter/airliner lever with a wheel knob and red lamp), ga (small wheel-knob
 * switch), lever (a long lever with a ball knob). The lever points at the pilot at rest. */
export function gearHandleGeometry(
  d,
  { style = 'jet', palette, scale = 1, length = 0.075, knob = 0.024, lamp = true, knobColor } = {},
) {
  const P = partPalette(palette);
  const b = batch(),
    s = (v) => v * scale;
  if (style === 'jet') {
    // `length` (lever), `knob` (wheel radius), `lamp` and `knobColor` vary it by type.
    b.add(P.alloy, bar([0, 0, 0], [0, 0, s(-length)], s(0.006), 12));
    b.add(P.alloy, place(roundedBox([s(0.014), s(0.016), s(0.02)], s(0.004)), [0, 0, s(-0.006)]));
    const face = knobColor ?? P.white;
    wheelKnob(
      b,
      P,
      s(knob),
      s(knob * 0.75),
      [0, 0, s(-length - 0.01)],
      face,
      face,
      lamp ? P.lamp : undefined,
    );
  } else if (style === 'ga') {
    b.add(P.alloy, bar([0, 0, 0], [0, 0, s(-0.026)], s(0.0035), 12));
    wheelKnob(b, P, s(0.011), s(0.008), [0, 0, s(-0.03)], P.black, P.alloy);
  } else if (style === 'lever') {
    b.add(P.alloy, bar([0, 0, 0], [0, s(0.02), s(-0.09)], s(0.005), 12));
    b.add(P.red, sphere(s(0.014), [0, s(0.022), s(-0.098)], [1, 1, 1], 16, 12));
  } else throw Error(`Unknown gear handle style: ${style}`);
  emit(d, b.map);
}
/** The fixed escutcheon a panel lever travels in: a plate with a slot and detent marks, facing
 * the pilot (-Z). `upright` lays it flat on a console top, facing up, its slot running fore and
 * aft, for a lever that stands up out of the console. */
export function leverGate(d, { size = [0.04, 0.11], marks = 3, palette, upright = false } = {}) {
  const P = partPalette(palette);
  const b = batch();
  const [w, h] = size;
  b.add(P.panel, place(roundedBox([w, h, 0.005], 0.004), [0, 0, 0.0005]));
  b.add(P.black, place(roundedBox([0.008, h * 0.8, 0.002], 0.001), [0, 0, -0.0025]));
  for (let i = 0; i < marks; i++) {
    const y = -h * 0.36 + (i * h * 0.72) / Math.max(1, marks - 1);
    b.add(P.legend, place(roundedBox([w * 0.22, 0.002, 0.001], 0.0004), [w * 0.3, y, -0.0032]));
  }
  emit(d, b.map, [0, 0, 0], upright ? [Math.PI / 2, 0, 0] : [0, 0, 0]);
}
/** A small airfoil-section knob, span along X, chord along Z. */
const airfoilKnob = (span, chord, thickness) => {
  const section = Array.from({ length: 16 }, (_, i) => {
    const t = (i / 16) * Math.PI * 2,
      z = (Math.cos(t) * chord) / 2,
      lead = 1 - (z / chord + 0.5);
    return [Math.sin(t) * thickness * (0.35 + 0.65 * Math.sqrt(Math.max(0, lead))), z];
  });
  return place(
    loftUp([
      { y: -span / 2, points: section.map(([x, z]) => [x * 0.7, z * 0.85]) },
      { y: -span / 2 + 0.003, points: section },
      { y: span / 2 - 0.003, points: section },
      { y: span / 2, points: section.map(([x, z]) => [x * 0.7, z * 0.85]) },
    ]),
    [0, 0, 0],
    [0, 0, Math.PI / 2],
  );
};
/** Styles: airfoil (GA panel switch with a wing knob), lever (airliner pedestal lever with a
 * wing-shaped handle; stands +Y), toggle (fighter three-way switch with a paddle), johnson (the
 * Piper floor lever between the seats; stands +Y, raked aft). */
export function flapSelectorGeometry(
  d,
  { style = 'airfoil', palette, scale = 1, height = 0.1 } = {},
) {
  const P = partPalette(palette);
  const b = batch(),
    s = (v) => v * scale;
  if (style === 'airfoil') {
    b.add(P.alloy, bar([0, 0, 0], [0, 0, s(-0.03)], s(0.003), 10));
    b.add(
      P.white,
      place(airfoilKnob(s(0.042), s(0.022), s(0.007)), [0, 0, s(-0.036)], [Math.PI / 2, 0, 0]),
    );
  } else if (style === 'lever') {
    b.add(P.alloy, place(roundedBox([0.008, height, 0.014], 0.002, 1), [0, height / 2, 0]));
    b.add(P.white, place(airfoilKnob(s(0.07), s(0.03), s(0.011)), [0, height + s(0.006), 0]));
  } else if (style === 'toggle') {
    b.add(
      P.alloy,
      place(
        new T.CylinderGeometry(s(0.006), s(0.006), s(0.006), 6),
        [0, 0, s(-0.003)],
        [Math.PI / 2, 0, 0],
      ),
    );
    b.add(P.alloy, bar([0, 0, s(-0.004)], [0, 0, s(-0.02)], s(0.0022), 10));
    b.add(
      P.white,
      place(airfoilKnob(s(0.024), s(0.013), s(0.005)), [0, 0, s(-0.025)], [Math.PI / 2, 0, 0]),
    );
  } else if (style === 'johnson') {
    b.add(P.steel, place(roundedBox([0.03, 0.03, 0.06], 0.006), [0, 0.012, 0]));
    b.add(
      P.alloy,
      tube(
        [
          [0, 0.02, 0],
          [0, height * 0.6, -height * 0.55],
          [0, height * 0.9, -height * 0.95],
        ],
        0.009,
        14,
      ),
    );
    b.add(
      P.grip,
      place(
        new T.CylinderGeometry(0.014, 0.013, 0.09, 18),
        [0, height * 0.94, -height * 1.02],
        [Math.atan2(height * 0.4, height * 0.3) + Math.PI / 2, 0, 0],
      ),
    );
    b.add(P.black, disc(0.007, 0.012, [0, height + 0.012, -height * 1.08], [0.8, 0, 0]));
  } else throw Error(`Unknown flap selector style: ${style}`);
  emit(d, b.map);
}
/** Styles: tee (GA pull handle under the panel), lever (airliner pedestal handle; stands +Y),
 * rotary (Airbus handle that turns a quarter, face +Y), loop (fighter pull handle). */
export function parkingBrakeGeometry(d, { style = 'tee', palette, scale = 1 } = {}) {
  const P = partPalette(palette);
  const b = batch(),
    s = (v) => v * scale;
  if (style === 'tee') {
    b.add(
      P.alloy,
      lathe(
        [
          [0, 0],
          [s(0.01), 0],
          [s(0.009), s(0.004)],
          [0, s(0.004)],
        ],
        14,
      ).rotateX(-Math.PI / 2),
    );
    b.add(P.alloy, bar([0, 0, 0], [0, 0, s(-0.03)], s(0.0035), 12));
    b.add(P.red, place(roundedBox([s(0.05), s(0.014), s(0.014)], s(0.005)), [0, 0, s(-0.036)]));
  } else if (style === 'lever') {
    b.add(P.alloy, place(roundedBox([0.009, 0.07, 0.014], 0.002, 1), [0, 0.035, 0], [-0.25, 0, 0]));
    b.add(
      P.red,
      place(roundedBox([s(0.05), s(0.02), s(0.026)], s(0.008)), [0, s(0.072), s(-0.018)]),
    );
  } else if (style === 'rotary') {
    b.add(P.panel, disc(s(0.03), s(0.006), [0, s(0.003), 0], [0, 0, 0], 20));
    b.add(P.grip, place(roundedBox([s(0.07), s(0.022), s(0.02)], s(0.008)), [0, s(0.016), 0]));
    b.add(
      P.legend,
      place(roundedBox([s(0.004), s(0.002), s(0.016)], s(0.0008)), [s(0.03), s(0.028), 0]),
    );
  } else if (style === 'loop') {
    b.add(P.alloy, bar([0, 0, 0], [0, 0, s(-0.024)], s(0.004), 12));
    b.add(
      P.yellow,
      tube(
        [
          [s(-0.025), 0, s(-0.024)],
          [s(-0.025), 0, s(-0.05)],
          [s(0.025), 0, s(-0.05)],
          [s(0.025), 0, s(-0.024)],
        ],
        s(0.005),
        10,
        true,
      ),
    );
    for (const x of [-0.014, 0.002, 0.018])
      b.add(
        P.black,
        place(
          roundedBox([s(0.006), s(0.0102), s(0.004)], s(0.001)),
          [s(x), 0, s(-0.05)],
          [0, 0, 0.6],
        ),
      );
  } else throw Error(`Unknown parking brake style: ${style}`);
  emit(d, b.map);
}
/** Styles: key (magneto/ignition key), guarded (toggle under a red flip guard), button (start
 * button in a guard ring), rotary (master knob), fuel-valve (a T-handle valve). */
export function engineMasterGeometry(d, { style = 'key', palette, scale = 1 } = {}) {
  const P = partPalette(palette);
  const b = batch(),
    s = (v) => v * scale;
  const lip = (r, material = P.alloy) =>
    b.add(
      material,
      lathe(
        [
          [0, 0],
          [r, 0],
          [r, s(0.003)],
          [r * 0.85, s(0.006)],
          [0, s(0.006)],
        ],
        20,
      ).rotateX(-Math.PI / 2),
    );
  if (style === 'key') {
    lip(s(0.016));
    b.add(P.steel, disc(s(0.008), s(0.008), [0, 0, s(-0.008)], [Math.PI / 2, 0, 0], 16));
    b.add(
      P.alloy,
      place(roundedBox([s(0.006), s(0.024), s(0.003)], s(0.001)), [0, s(0.004), s(-0.013)]),
    );
    b.add(
      P.black,
      place(roundedBox([s(0.016), s(0.016), s(0.005)], s(0.005)), [0, s(0.019), s(-0.013)]),
    );
    b.add(
      P.alloy,
      place(
        new T.TorusGeometry(s(0.006), s(0.0012), 6, 16),
        [0, s(0.033), s(-0.013)],
        [0, Math.PI / 2, 0],
      ),
    );
  } else if (style === 'guarded' || style === 'toggle') {
    toggleInto(b, P, s);
    if (style === 'guarded') {
      b.add(
        P.red,
        place(
          roundedBox([s(0.02), s(0.004), s(0.03)], s(0.0015)),
          [0, s(0.017), s(-0.016)],
          [0.25, 0, 0],
        ),
      );
      for (const x of [-0.0095, 0.0095])
        b.add(
          P.red,
          place(roundedBox([s(0.0025), s(0.016), s(0.026)], s(0.001)), [s(x), s(0.008), s(-0.016)]),
        );
    }
  } else if (style === 'button') {
    lip(s(0.017), P.steel);
    b.add(
      P.red,
      lathe(
        [
          [0, 0],
          [s(0.0105), 0],
          [s(0.0105), s(0.01)],
          [s(0.009), s(0.013)],
          [0, s(0.014)],
        ],
        20,
      ).rotateX(-Math.PI / 2),
    );
    b.add(P.alloy, place(new T.TorusGeometry(s(0.0145), s(0.002), 6, 24), [0, 0, s(-0.012)]));
  } else if (style === 'rotary') {
    lip(s(0.02), P.panel);
    b.add(P.grip, place(roundedBox([s(0.012), s(0.04), s(0.02)], s(0.005)), [0, 0, s(-0.016)]));
    b.add(
      P.white,
      place(roundedBox([s(0.003), s(0.014), s(0.002)], s(0.001)), [0, s(0.012), s(-0.027)]),
    );
  } else if (style === 'fuel-valve') {
    b.add(P.alloy, bar([0, 0, 0], [0, 0, s(-0.03)], s(0.004), 12));
    b.add(
      P.red,
      place(roundedBox([s(0.012), s(0.05), s(0.012)], s(0.005)), [0, s(0.012), s(-0.034)]),
    );
  } else throw Error(`Unknown engine master style: ${style}`);
  emit(d, b.map);
}
/** A bat-handle toggle on its hex bushing, lever pointing at the pilot and tipped up. */
function toggleInto(b, P, s, { length = 0.018, tip = 0.35, knob = 'bat' } = {}) {
  b.add(
    P.alloy,
    place(
      new T.CylinderGeometry(s(0.0065), s(0.0065), s(0.004), 6),
      [0, 0, s(-0.002)],
      [Math.PI / 2, 0, 0],
    ),
  );
  b.add(
    P.alloy,
    place(
      new T.CylinderGeometry(s(0.0045), s(0.0045), s(0.004), 14),
      [0, 0, s(-0.006)],
      [Math.PI / 2, 0, 0],
    ),
  );
  const end = [0, Math.sin(tip) * s(length), -Math.cos(tip) * s(length) - s(0.007)];
  b.add(P.alloy, bar([0, 0, s(-0.007)], end, s(0.0016), 10, s(0.0026)));
  if (knob === 'paddle')
    b.add(P.black, place(roundedBox([s(0.01), s(0.004), s(0.012)], s(0.0015)), end, [tip, 0, 0]));
  else if (knob === 'ball') b.add(P.alloy, sphere(s(0.0035), end, [1, 1, 1], 10, 8));
}
/** Panel switches. Styles: toggle, paddle, guarded, rocker, korry (lit square pushbutton),
 * pointer / fluted / chicken / concentric (rotary knobs). */
export function switchGeometry(
  d,
  { style = 'toggle', palette, scale = 1, lit, at = [0, 0, 0] } = {},
) {
  const P = partPalette(palette);
  const b = batch(),
    s = (v) => v * scale;
  if (style === 'toggle') toggleInto(b, P, s);
  else if (style === 'paddle') toggleInto(b, P, s, { knob: 'paddle' });
  else if (style === 'guarded') {
    toggleInto(b, P, s);
    b.add(
      P.red,
      place(
        roundedBox([s(0.02), s(0.004), s(0.03)], s(0.0015)),
        [0, s(0.017), s(-0.016)],
        [0.25, 0, 0],
      ),
    );
    for (const x of [-0.0095, 0.0095])
      b.add(
        P.red,
        place(roundedBox([s(0.0025), s(0.016), s(0.026)], s(0.001)), [s(x), s(0.008), s(-0.016)]),
      );
  } else if (style === 'rocker') {
    b.add(P.black, place(roundedBox([s(0.014), s(0.026), s(0.004)], s(0.0015)), [0, 0, s(-0.002)]));
    b.add(
      P.grip,
      place(roundedBox([s(0.011), s(0.022), s(0.006)], s(0.002)), [0, 0, s(-0.006)], [0.18, 0, 0]),
    );
    b.add(
      P.legend,
      place(
        roundedBox([s(0.006), s(0.002), s(0.001)], s(0.0004)),
        [0, s(0.006), s(-0.0095)],
        [0.18, 0, 0],
      ),
    );
  } else if (style === 'korry') {
    b.add(P.black, place(roundedBox([s(0.024), s(0.024), s(0.006)], s(0.002)), [0, 0, s(-0.003)]));
    b.add(
      lit ?? P.grip,
      place(roundedBox([s(0.02), s(0.009), s(0.004)], s(0.0015)), [0, s(0.0055), s(-0.007)]),
    );
    b.add(
      P.grip,
      place(roundedBox([s(0.02), s(0.009), s(0.004)], s(0.0015)), [0, s(-0.0055), s(-0.007)]),
    );
    b.add(
      P.legend,
      place(roundedBox([s(0.012), s(0.0015), s(0.0006)], s(0.0003)), [0, s(-0.0055), s(-0.0093)]),
    );
  } else if (style === 'pointer') {
    b.add(
      P.grip,
      lathe(
        [
          [0, 0],
          [s(0.012), 0],
          [s(0.012), s(0.004)],
          [s(0.0085), s(0.006)],
          [s(0.0075), s(0.014)],
          [0, s(0.015)],
        ],
        20,
      ).rotateX(-Math.PI / 2),
    );
    b.add(
      P.legend,
      place(roundedBox([s(0.0018), s(0.009), s(0.001)], s(0.0004)), [0, s(0.0035), s(-0.0153)]),
    );
  } else if (style === 'fluted') {
    b.add(P.grip, ribbed(s(0.009), s(0.012), 12, 0.14).rotateX(-Math.PI / 2));
    b.add(
      P.grip,
      lathe(
        [
          [s(0.0085), s(0.012)],
          [s(0.006), s(0.014)],
          [0, s(0.014)],
        ],
        16,
      ).rotateX(-Math.PI / 2),
    );
    b.add(
      P.legend,
      place(roundedBox([s(0.0015), s(0.005), s(0.001)], s(0.0003)), [0, s(0.003), s(-0.0143)]),
    );
  } else if (style === 'chicken') {
    b.add(P.grip, disc(s(0.008), s(0.006), [0, 0, s(-0.003)], [Math.PI / 2, 0, 0], 16));
    b.add(
      P.grip,
      place(roundedBox([s(0.008), s(0.028), s(0.012)], s(0.003)), [0, s(0.004), s(-0.011)]),
    );
    b.add(
      P.legend,
      place(roundedBox([s(0.0018), s(0.006), s(0.001)], s(0.0004)), [0, s(0.014), s(-0.0175)]),
    );
  } else if (style === 'concentric') {
    b.add(P.grip, ribbed(s(0.012), s(0.007), 16, 0.1).rotateX(-Math.PI / 2));
    b.add(P.grip, ribbed(s(0.0075), s(0.008), 12, 0.12, s(0.007)).rotateX(-Math.PI / 2));
    b.add(
      P.grip,
      lathe(
        [
          [s(0.007), s(0.015)],
          [s(0.005), s(0.016)],
          [0, s(0.016)],
        ],
        14,
      ).rotateX(-Math.PI / 2),
    );
  } else throw Error(`Unknown switch style: ${style}`);
  emit(d, b.map, at);
}
/** Styles: lever (airliner speed-brake handle on the pedestal; stands +Y, raked aft), slider (a
 * thumb slider on a throttle grip or console), hook (the arrester-hook handle with its hooked
 * grip), canopy (a sill handle). */
export function handleGeometry(d, { style = 'lever', palette, scale = 1, height = 0.1 } = {}) {
  const P = partPalette(palette);
  const b = batch(),
    s = (v) => v * scale;
  if (style === 'lever') {
    b.add(
      P.alloy,
      place(roundedBox([0.01, height, 0.016], 0.002, 1), [0, height / 2, 0], [-0.2, 0, 0]),
    );
    b.add(
      P.grip,
      place(
        roundedBox([s(0.03), s(0.022), s(0.05)], s(0.008)),
        [0, height + s(0.008), s(-0.03)],
        [-0.2, 0, 0],
      ),
    );
    b.add(
      P.white,
      place(
        roundedBox([s(0.031), s(0.004), s(0.02)], s(0.001)),
        [0, height + s(0.02), s(-0.032)],
        [-0.2, 0, 0],
      ),
    );
  } else if (style === 'slider') {
    b.add(P.black, place(roundedBox([s(0.014), s(0.028), s(0.004)], s(0.0015)), [0, 0, s(-0.002)]));
    b.add(P.grip, place(roundedBox([s(0.012), s(0.01), s(0.009)], s(0.003)), [0, 0, s(-0.007)]));
    for (const y of [-0.0025, 0, 0.0025])
      b.add(
        P.black,
        place(roundedBox([s(0.012), s(0.0008), s(0.001)], s(0.0003)), [0, s(y), s(-0.0118)]),
      );
  } else if (style === 'hook') {
    b.add(P.alloy, bar([0, 0, 0], [0, 0, s(-0.04)], s(0.0045), 12));
    b.add(
      P.yellow,
      tube(
        [
          [0, s(0.014), s(-0.04)],
          [0, s(-0.012), s(-0.04)],
          [0, s(-0.026), s(-0.05)],
          [0, s(-0.026), s(-0.066)],
          [0, s(-0.012), s(-0.072)],
          [0, s(-0.004), s(-0.064)],
        ],
        s(0.0065),
        12,
      ),
    );
    b.add(P.black, sphere(s(0.007), [0, s(0.016), s(-0.04)], [1, 1, 1], 12, 8));
  } else if (style === 'canopy') {
    b.add(P.alloy, bar([0, 0, 0], [0, 0, s(-0.035)], s(0.005), 12));
    b.add(
      P.grip,
      tube(
        [
          [0, 0, s(-0.035)],
          [0, s(0.04), s(-0.04)],
          [0, s(0.05), s(-0.03)],
        ],
        s(0.008),
        12,
      ),
    );
    b.add(
      P.yellow,
      place(new T.CylinderGeometry(s(0.0085), s(0.0085), s(0.01), 14), [0, s(0.024), s(-0.037)]),
    );
  } else throw Error(`Unknown handle style: ${style}`);
  emit(d, b.map);
}
// ---------------------------------------------------------------------------------------------
// Control stations: one physical control placed where the real aircraft has it.

const SWITCH_STYLES = [
  'toggle',
  'paddle',
  'guarded',
  'rocker',
  'korry',
  'pointer',
  'fluted',
  'chicken',
  'concentric',
];
const LEVER_STYLES = [
  'throttle',
  'throttle-t',
  'prop',
  'mixture',
  'condition',
  'thrust-boeing',
  'thrust-airbus',
  'power-turboprop',
  'start-lever',
  'hotas-left',
  'hotas-right',
  'hotas-euro',
  'hotas-f16',
  'mig',
  'collective',
];
const KNOB_STYLES = ['throttle', 'throttle-t', 'prop', 'mixture', 'condition', 'tee'];
/** Default part style for each action when a station names none. */
export const STATION_STYLES = {
  gear: 'jet',
  flaps: 'airfoil',
  brake: 'tee',
  engine: 'key',
  speedBrake: 'lever',
  tailHook: 'hook',
  canopy: 'canopy',
  wipers: 'pointer',
  headlights: 'toggle',
  mixture: 'mixture',
  propeller: 'prop',
  power: 'throttle',
  thrustVector: 'throttle-t',
};
const rot = (axis, scale, offset) => ({
  property: 'rotation',
  axis,
  scale,
  ...(offset === undefined ? {} : { offset }),
});
const pos = (axis, scale, offset) => ({
  property: 'position',
  axis,
  scale,
  ...(offset === undefined ? {} : { offset }),
});
/** Rest-relative motion of a station part for an action's 0..1 value. */
export function stationMotion(action, style, { pushPull = false } = {}) {
  if (pushPull) return pos('z', 0.055, -0.055);
  if (['toggle', 'paddle', 'guarded'].includes(style)) return rot('x', 0.7, -0.7);
  if (style === 'rocker') return rot('x', 0.3, -0.15);
  if (style === 'korry' || style === 'button') return pos('z', 0.003);
  if (['pointer', 'fluted', 'chicken', 'concentric', 'rotary'].includes(style)) return rot('z', 1);
  switch (action) {
    case 'gear':
      return rot('x', -0.7, 0.35);
    case 'flaps':
      return style === 'johnson'
        ? rot('x', 0.5, -0.1)
        : rot('x', style === 'lever' ? -0.7 : -0.6, style === 'lever' ? 0.35 : 0.3);
    case 'brake':
      return style === 'lever'
        ? rot('x', -0.5)
        : style === 'rotary'
          ? rot('y', 1.57)
          : pos('z', -0.025);
    case 'engine':
      return style === 'key'
        ? rot('z', 0.8)
        : style === 'fuel-valve'
          ? rot('z', 1.57)
          : rot('x', 0.5, -0.5);
    case 'speedBrake':
      return style === 'slider' ? pos('y', -0.008) : rot('x', -0.6);
    case 'tailHook':
      return pos('y', -0.03);
    case 'canopy':
      return rot('x', -0.8);
    case 'thrustVector':
      return rot('x', -0.9);
    case 'power':
      return rot('x', 0.6, -0.3);
    case 'mixture':
    case 'propeller':
      return rot('x', 0.65, -0.65);
    default:
      return rot('x', 0.5);
  }
}
/** Draw a station's part into a kit at its pivot, by action and style. */
export function stationGeometry(d, action, station = {}) {
  const style = station.style ?? STATION_STYLES[action];
  // The station's own `at`/`rotation` place its holder; the part is drawn at the pivot.
  const { at: _at, rotation: _rotation, ...rest } = station;
  const options = { ...rest, style };
  if (station.pushPull)
    return pushPullGeometry(d, {
      ...options,
      kind: KNOB_STYLES.includes(style) ? style : 'throttle',
    });
  if (SWITCH_STYLES.includes(style)) return switchGeometry(d, options);
  if (LEVER_STYLES.includes(style) && !(action === 'flaps' && style === 'lever'))
    return leverGeometry(d, options);
  if (action === 'gear') return gearHandleGeometry(d, options);
  if (action === 'flaps') return flapSelectorGeometry(d, options);
  if (action === 'brake') return parkingBrakeGeometry(d, options);
  if (action === 'engine') return engineMasterGeometry(d, options);
  if (['lever', 'slider', 'hook', 'canopy'].includes(style)) return handleGeometry(d, options);
  throw Error(`No ${style} part for ${action}`);
}
/**
 * Build one physical control station at `at` / `rotation` (model frame), parented under
 * `parent` (or the node named by `station.parent`), returning the moving pivot. `label` adds a
 * legend on a fixed mount (offset by `labelAt` in the station frame); `gate` adds a lever
 * escutcheon behind a panel lever.
 */
export function controlStation(model, parent, name, action, station, write) {
  const holder = new T.Group();
  holder.name = `${name}-mount`;
  holder.position.fromArray(station.at);
  holder.rotation.set(...(station.rotation ?? [0, 0, 0]));
  model.add(holder);
  model.updateMatrixWorld(true);
  // A station can ride on another part (a speed-brake switch on a throttle grip).
  const host = station.parent ? model.getObjectByName(station.parent) : parent;
  if (!host) throw Error(`Station ${name}: no parent node ${station.parent}`);
  host.attach(holder);
  const fixed = detailKit(holder, `${name}-mount-detail`);
  if (station.gate)
    leverGate(fixed, {
      ...(station.gate === true ? {} : station.gate),
      upright: station.gate?.upright,
    });
  if (station.label) {
    // `labelRotation` turns the legend's own plate (an upright lever's legend lying flat).
    const plate = new T.Group();
    plate.rotation.set(...(station.labelRotation ?? [0, 0, 0]));
    holder.add(plate);
    const host = station.labelRotation ? plate : holder;
    const kit = station.labelRotation ? detailKit(plate, `${name}-legend-plate`) : fixed;
    write(
      kit,
      host,
      station.label,
      station.labelAt ?? [0, 0.032, -0.003],
      station.labelHeight ?? 0.0075,
    );
    if (station.labelRotation) kit.finish();
    else holder.remove(plate);
  }
  fixed.finish();
  const pivot = group(holder, name);
  const d = detailKit(pivot, `${name}-moving`);
  stationGeometry(d, action, station);
  d.finish();
  pivot.userData.aircraftControl = {
    action,
    ...(station.engineId === undefined ? {} : { engine: station.engineId }),
    motion:
      station.motion ?? stationMotion(action, station.style ?? STATION_STYLES[action], station),
  };
  return pivot;
}

/** A swiveling eyeball vent in a round bezel, louvre aimed by its center tab. */
export function eyeballVentGeometry(d, { radius = 0.03, palette, aim = [0.15, -0.1] } = {}) {
  const P = partPalette(palette);
  const b = batch(),
    r = radius;
  b.add(
    P.panel,
    lathe(
      [
        [r * 0.78, 0],
        [r, 0],
        [r * 1.02, r * 0.12],
        [r * 0.92, r * 0.2],
        [r * 0.82, r * 0.18],
      ],
      24,
    ).rotateX(-Math.PI / 2),
  );
  const ball = batch();
  ball.add(P.grip, sphere(r * 0.8, [0, 0, 0], [1, 1, 0.55], 20, 12));
  ball.add(
    P.black,
    place(
      new T.CylinderGeometry(r * 0.55, r * 0.55, r * 0.5, 20),
      [0, 0, -r * 0.24],
      [Math.PI / 2, 0, 0],
    ),
  );
  for (const x of [-0.25, 0.25])
    ball.add(
      P.grip,
      place(roundedBox([r * 0.05, r * 1.0, r * 0.4], r * 0.02), [x * r, 0, -r * 0.3]),
    );
  ball.add(P.grip, place(roundedBox([r * 0.36, r * 0.12, r * 0.16], r * 0.04), [0, 0, -r * 0.48]));
  emit(d, b.map);
  emit(d, ball.map, [0, 0, -r * 0.1], [aim[1], aim[0], 0]);
}
