/** Single-seat Typhoon, clean configuration. Dimensions and reference limits in reference-review.
 * +Z forward, +X pilot left. Three-display cockpit, not the proposed large-area-display upgrade.
 */
import { cockpitBulkhead, skinSection, wallAt } from './cockpit-fit.mjs';
import { bar, leverGeometry, pedalGeometry, stickGeometry } from './cockpit-parts.mjs';
import { instrumentGeometry } from './instrument-geometry.mjs';
import {
  beveledBox,
  cleanGeometry,
  detailKit,
  group,
  loft,
  mat,
  outline,
  quad,
  sheet,
  T,
  wing,
} from './mesh-kit.mjs';

export const typhoonFrame = () => ({
  heli: false,
  fighter: true,
  large: false,
  radius: 0.59,
  cy: 2.1,
  ry: 0.63,
  cabinZ: 4.7,
  cabinWidth: 0.9,
  eye: [0, 3.08, 4.7],
  panelZ: 5.55,
  floor: 1.72,
});
/** Ray-casts onto the triangles `build(kit)` emits (the same quads the airframe uses) and lifts
 * the hit along the face normal toward the caster, for laying panel lines on the actual skin. */
function surfaceCaster(build, lift = 0.005) {
  const holder = new T.Group(),
    surface = new T.MeshBasicMaterial({ side: T.DoubleSide });
  build({ add: (geometry) => holder.add(new T.Mesh(geometry, surface)) });
  holder.updateMatrixWorld(true);
  const ray = new T.Raycaster();
  return (origin, direction) => {
    const dir = new T.Vector3(...direction).normalize();
    ray.set(new T.Vector3(...origin), dir);
    const hit = ray.intersectObject(holder, true)[0];
    if (!hit) throw Error(`Typhoon marking misses the skin at ${origin}`);
    const normal = hit.face.normal.clone();
    if (normal.dot(dir) > 0) normal.negate();
    return hit.point.addScaledVector(normal, lift).toArray();
  };
}
/** Points every `step` metres along a polyline of 2-D corners, each mapped by `at`. A straight
 * tube between two corners would cut through the convex creases between loft facets. */
function sampledPath(corners, at, step, closed = true) {
  const points = [];
  for (let i = 0; i < (closed ? corners.length : corners.length - 1); i++) {
    const [ua, va] = corners[i],
      [ub, vb] = corners[(i + 1) % corners.length],
      steps = Math.max(1, Math.ceil(Math.hypot(ub - ua, vb - va) / step));
    for (let k = 0; k < steps; k++)
      points.push(at(ua + ((ub - ua) * k) / steps, va + ((vb - va) * k) / steps));
  }
  if (!closed) points.push(at(...corners.at(-1)));
  return points;
}
export function buildTyphoon(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('Typhoon-gray', '#959fa4', { side: T.DoubleSide }),
    // Service radomes are painted close to the airframe grey, not a dark cone.
    radome = mat('Typhoon-radome', '#87939a'),
    seal = mat('Typhoon-seal', '#343b3e'),
    metal = mat('Typhoon-alloy', '#a4a9a9', { metalness: 0.7 }),
    // Bare-metal EJ200 petals read light against the dark throats (nozzle photograph).
    exhaust = mat('Typhoon-exhaust', '#8d8a83', { metalness: 0.6, side: T.DoubleSide }),
    duct = mat('Typhoon-duct', '#161e22', { side: T.DoubleSide }),
    glass = mat('Typhoon-glass', '#96bbc2', {
      transparent: true,
      opacity: 0.19,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.12,
    });
  const d = detailKit(root, 'Typhoon-airframe'),
    bindings = [];
  const hinge = (g, axis, direction) => {
    const mount = group(g.parent, `${g.name}-mount`, g.position.toArray());
    mount.quaternion.setFromUnitVectors(
      new T.Vector3(...axis),
      new T.Vector3(...direction).normalize(),
    );
    const inv = mount.quaternion.clone().invert();
    g.traverse((n) => {
      if (n.isMesh) n.geometry.applyQuaternion(inv);
    });
    mount.add(g);
    g.position.set(0, 0, 0);
  };
  const fore = [
    [9, 0.006, 1.78, 1.79],
    [8.5, 0.2, 1.65, 2.04],
    [7.6, 0.39, 1.53, 2.36],
    [6.84, 0.5, 1.53, 2.49],
    [6.2, 0.53, 1.54, 2.61],
    [5.5, 0.56, 1.55, 2.68],
    [4.6, 0.58, 1.55, 2.77],
    [3.5, 0.64, 1.53, 2.89],
    [2.8, 0.75, 1.43, 2.98],
  ].map(([z, w, b, t]) => ({
    z,
    points: Array.from({ length: 24 }, (_, i) => {
      const a = (i * Math.PI) / 12;
      return [Math.sin(a) * w, (t + b) / 2 + (Math.cos(a) * (t - b)) / 2];
    }),
  }));
  loft(d, fore.slice(0, 4), radome);
  // Omit upper body facets under the bubble; the cockpit is an actual cavity.
  loft(d, fore.slice(3), paint, { caps: false, skip: (_, j) => j < 4 || j >= 20 });
  outline(
    d,
    fore[3].points.map((p) => [...p, 6.84]),
    0.008,
    seal,
  );
  const canopy = [
    [6.84, 0.02, 2.49, 2.51],
    [6.2, 0.34, 2.61, 2.94],
    [5.5, 0.48, 2.68, 3.23],
    [4.7, 0.51, 2.77, 3.34],
    [3.8, 0.46, 2.87, 3.25],
    [2.8, 0.04, 2.98, 3.01],
  ];
  const cr = canopy.map(([z, w, b, t]) => ({
    z,
    points: Array.from({ length: 21 }, (_, j) => [
      Math.cos((j * Math.PI) / 20) * w,
      b + Math.sin((j * Math.PI) / 20) * (t - b),
    ]),
  }));
  loft(d, cr, glass, { caps: false, skip: (_, j) => j === 20 });
  for (const j of [0, 20])
    outline(
      d,
      cr.map((r) => [...r.points[j], r.z]),
      0.024,
      paint,
      false,
    );
  for (const i of [0, 2, 5])
    outline(
      d,
      cr[i].points.map((p) => [...p, cr[i].z]),
      i === 2 ? 0.018 : 0.016,
      paint,
      false,
    );
  // The frames' inboard faces are the dark canopy seal: from the seat the windscreen bow and the
  // sill rails read dark, as in the cockpit photographs, not as the gray they wear outside.
  outline(
    d,
    cr[2].points.map(([x, y]) => [x * 0.975, y - 0.006, cr[2].z - 0.012]),
    0.018,
    seal,
    false,
  );
  for (const j of [0, 20])
    outline(
      d,
      cr
        .slice(1, -1)
        .map((r) => [
          r.points[j][0] - Math.sign(r.points[j][0]) * 0.013,
          r.points[j][1] + 0.006,
          r.z,
        ]),
      0.018,
      seal,
      false,
    );
  for (const side of [-1, 1]) {
    for (let i = 0; i < canopy.length - 1; i++) {
      const a = fore[i + 3],
        b = fore[i + 4],
        ca = canopy[i],
        cb = canopy[i + 1],
        j = side === 1 ? 4 : 20;
      quad(
        d,
        [...a.points[j], a.z],
        [...b.points[j], b.z],
        [side * cb[1], cb[2], cb[0]],
        [side * ca[1], ca[2], ca[0]],
        paint,
        [side, 1, 0],
      );
      for (let n = 0; n < 7; n++) {
        const t = n / 7;
        d.add(new T.SphereGeometry(0.0035, 5, 3), metal, [
          side * (ca[1] + (cb[1] - ca[1]) * t),
          ca[2] + (cb[2] - ca[2]) * t + 0.022,
          ca[0] + (cb[0] - ca[0]) * t,
        ]);
      }
    }
  }
  // Twin-engine body and high, narrow dorsal spine. The chin duct joins below the forebody.
  const aft = [
    [2.8, 0.99, 0.91, 2.98],
    [1.5, 1.13, 0.92, 2.83],
    [0, 1.2, 0.96, 2.76],
    [-2, 1.23, 1.03, 2.61],
    [-4.2, 1.24, 1.1, 2.46],
    [-5.25, 1.12, 1.23, 2.39],
  ].map(([z, w, b, t]) => ({
    z,
    points: [
      [0, t],
      [0.31, t - 0.04],
      [0.48, t - 0.22],
      [w * 0.76, Math.max(2.11, t - 0.53)],
      [w, 2.04],
      [w * 0.96, b + 0.16],
      [w * 0.58, b],
      [0, b + 0.03],
      [-w * 0.58, b],
      [-w * 0.96, b + 0.16],
      [-w, 2.04],
      [-w * 0.76, Math.max(2.11, t - 0.53)],
      [-0.48, t - 0.22],
      [-0.31, t - 0.04],
    ],
  }));
  // The tail closes round over the two close-set nozzles (four-view plan: about +/-1.0 m),
  // instead of ending as a broad flat hexagon.
  const nozzleX = 0.52,
    tailHalf = [
      [0, 2.36],
      [0.31, 2.36],
      [0.6, 2.32],
      [0.86, 2.2],
      [1.02, 1.92],
      [0.96, 1.56],
      [0.6, 1.3],
      [0, 1.33],
    ];
  aft.at(-1).points = [
    ...tailHalf,
    ...tailHalf
      .slice(1, -1)
      .reverse()
      .map(([x, y]) => [-x, y]),
  ];
  loft(d, aft, paint, { caps: false });
  // Markings are laid on the loft's actual triangles (hit from outboard, lifted along the face
  // normal). Corners interpolated between rings sat under the warped quads' diagonals, so each
  // panel rectangle showed only broken fragments.
  const onSkin = surfaceCaster((kit) => loft(kit, aft, null, { caps: false, smooth: false }));
  const sideSkin = (side, y, z) => onSkin([side * 3, y, z], [-side, 0, 0]);
  // Fill the forebody/engine-shoulder join; the section change must not leave open slivers.
  // A fan from the forebody ring to the shoulder ring rounds the step instead of one flat facet.
  const shoulderFore = [fore[7].points[6], fore[7].points[5], fore[7].points[4], [0.43, 2.82]],
    shoulderAft = [aft[0].points[4], aft[0].points[3], aft[0].points[2], aft[0].points[1]];
  for (const side of [-1, 1])
    for (let i = 0; i < 3; i++)
      quad(
        d,
        [side * shoulderFore[i][0], shoulderFore[i][1], 3.5],
        [side * shoulderAft[i][0], shoulderAft[i][1], 2.8],
        [side * shoulderAft[i + 1][0], shoulderAft[i + 1][1], 2.8],
        [side * shoulderFore[i + 1][0], shoulderFore[i + 1][1], 3.5],
        paint,
        [side, 1, 0],
      );
  // Painted tail face with apertures for the nozzle ducts.
  sheet(
    d,
    aft.at(-1).points.map((p) => [...p, -5.25]),
    paint,
    [0, 0, -1],
    [-1, 1].map((side) =>
      Array.from({ length: 20 }, (_, i) => [
        side * nozzleX + Math.sin((i * Math.PI) / 10) * 0.455,
        1.82 + Math.cos((i * Math.PI) / 10) * 0.455,
        -5.25,
      ]),
    ),
  );
  // Chin intake "smile": a raked rim, a broad central splitter, and a painted lower-lip ramp
  // in front of each dark throat. The throats are lowest beside the splitter and rise toward
  // the rounded outer corners (head-on photographs and the four-view front elevation).
  const rimZ = (y) => 3.95 + (y - 0.85) * 0.5;
  for (const side of [-1, 1]) {
    // Head-on photograph: box about +/-0.91 m wide and 0.76 m deep, a thin central splitter,
    // dark openings filling most of it.
    const rimXY = [
        [0.03, 1.6],
        [0.45, 1.6],
        [0.8, 1.57],
        [0.9, 1.5],
        [0.93, 1.16],
        [0.9, 0.93],
        [0.72, 0.85],
        [0.4, 0.81],
        [0.03, 0.79],
      ],
      mouth = rimXY.map(([x, y]) => [side * x, y, rimZ(y)]),
      throat = [
        [0.045, 1.55],
        [0.45, 1.55],
        [0.81, 1.53],
        [0.88, 1.46],
        [0.89, 1.18],
        [0.85, 0.99],
        [0.66, 0.92],
        [0.35, 0.89],
        [0.045, 0.88],
      ].map(([x, y]) => [side * x, y, rimZ(y) - 0.06 - ((1.6 - y) / 0.75) * 0.24]),
      rear = throat.map(([x, y, z]) => [
        side * 0.46 + (x - side * 0.46) * 0.85,
        1.28 + (y - 1.28) * 0.85,
        z - 0.7,
      ]),
      // Trunk sections at the wing-root station, on the engine-body ring.
      back = [
        [0.045, 1.6],
        [0.5, 1.78],
        [0.9, 1.97],
        [0.99, 2.04],
        [0.97, 1.55],
        [0.95, 1.07],
        [0.75, 0.985],
        [0.4, 0.92],
        [0, 0.94],
      ].map(([x, y]) => [side * x, y, 2.8]);
    const face = (a, b, c, e, material) => {
      const normal = new T.Vector3(...b)
        .sub(new T.Vector3(...a))
        .cross(new T.Vector3(...e).sub(new T.Vector3(...a)));
      quad(d, a, b, c, e, material, normal.toArray());
    };
    for (let i = 0; i < mouth.length; i++) {
      const j = (i + 1) % mouth.length;
      face(mouth[i], mouth[j], throat[j], throat[i], paint);
      face(throat[i], throat[j], rear[j], rear[i], duct);
      if (j) face(mouth[i], back[i], back[j], mouth[j], paint);
    }
    sheet(d, rear, duct, [0, 0, 1]);
    outline(d, mouth, 0.026, paint);
    // The splitter's leading edge and the keel between the two trunks.
    if (side === 1) {
      quad(
        d,
        [-0.03, 1.6, rimZ(1.6)],
        [0.03, 1.6, rimZ(1.6)],
        [0.03, 0.79, rimZ(0.79)],
        [-0.03, 0.79, rimZ(0.79)],
        paint,
        [0, 0, 1],
      );
      sheet(
        d,
        [
          [-0.03, 0.79, rimZ(0.79)],
          [0.03, 0.79, rimZ(0.79)],
          [0, 0.94, 2.8],
        ],
        paint,
        [0, -1, 0],
      );
    }
    // Diverter surface and perforated bleed strip remain distinct from the dark aperture.
    quad(
      d,
      [side * 0.06, 1.67, 4.5],
      [side * 0.8, 1.76, 4.54],
      [side * 0.9, 1.72, 3.4],
      [side * 0.06, 1.68, 3.4],
      paint,
      [0, 1, 0],
    );
    // Bleed slots ride on the flared trunk side.
    for (let n = 0; n < 17; n++) {
      const z = 3.25 + n * 0.03,
        x = 0.932 + (3.73 - z) * 0.065;
      d.rod([side * x, 1.62, z], [side * x, 1.72, z], 0.003, seal);
    }
    // Close-coupled all-moving canard. Positive pitch lowers the trailing edge.
    const cg = group(root, `Typhoon-canard-${side}`, [side * 0.61, 1.95, 5.57]),
      cd = detailKit(cg, cg.name);
    wing(
      cd,
      [
        // A visible root thickness keeps the canard readable edge-on in level 3/4 views.
        [0.54, 1.95, 6.55, 4.97, 0.062],
        // About 15 degrees of anhedral (head-on photograph and four-view front elevation).
        [1.94, 1.6, 5.08, 4.68, 0.018],
      ].map(([x, y, a, b, h]) => [
        side * x - cg.position.x,
        y - cg.position.y,
        a - cg.position.z,
        b - cg.position.z,
        h,
      ]),
      paint,
    );
    cd.finish();
    bindings.push({
      node: cg.name,
      source: 'pitchInput',
      property: 'rotation',
      axis: 'x',
      scale: -0.26,
    });
    // Delta has independently hinged leading slats and two elevons, no horizontal tail.
    const stations = [
      [1.1, 1.48, 2.8, -4.02, 0.095],
      [5.36, 1.48, -2.6, -3.85, 0.018],
    ];
    const interp = (x) => {
      const t = (x - 1.1) / 4.26;
      return stations[0].map((v, i) => (i === 0 ? x : v + (stations[1][i] - v) * t));
    };
    const refl = (q) => q.map(([x, ...rest]) => [side * x, ...rest]);
    const fixedWing = refl(
      stations.map(([x, y, a, b, h]) => [x, y, a - (a - b) * 0.1, b + (a - b) * 0.19, h]),
    );
    wing(d, fixedWing, paint);
    const onWing = surfaceCaster((kit) => wing(kit, fixedWing, null), 0.004);
    for (const [name, x0, x1, leading, src] of [
      ['slat', 1.1, 5.36, true, 'flapPosition'],
      ['inboard-elevon', 1.1, 3.2, false, side === 1 ? 'elevonLeft' : 'elevonRight'],
      ['outboard-elevon', 3.2, 5.36, false, side === 1 ? 'elevonLeft' : 'elevonRight'],
    ]) {
      const a = interp(x0),
        b = interp(x1),
        hz = (q) => (leading ? q[2] - (q[2] - q[3]) * 0.1 : q[3] + (q[2] - q[3]) * 0.19),
        p = [side * x0, a[1], hz(a)],
        g = group(root, `Typhoon-${name}-${side}`, p),
        gd = detailKit(g, g.name);
      wing(
        gd,
        [a, b].map((q) => [
          side * q[0] - p[0],
          q[1] - p[1],
          (leading ? q[2] : hz(q)) - p[2],
          (leading ? hz(q) : q[3]) - p[2],
          q[4] * 0.3,
        ]),
        paint,
      );
      gd.finish();
      hinge(g, [1, 0, 0], [x1 - x0, 0, side * (hz(b) - hz(a))]);
      bindings.push({
        node: g.name,
        source: src,
        property: 'rotation',
        axis: 'x',
        scale: leading ? 0.12 : 1,
      });
    }
    // Wingtip defensive-aids fairings are part of the airframe, not missile shapes.
    const pod = group(root, `Typhoon-DASS-${side}`, [side * 5.36, 1.48, -3.15]),
      pd = detailKit(pod, pod.name);
    loft(
      pd,
      [
        [1.18, 0.015],
        [0.85, 0.1],
        [0.4, 0.115],
        [-1.15, 0.115],
        [-1.25, 0.07],
      ].map(([z, r]) => ({
        z,
        points: Array.from({ length: 12 }, (_, i) => [
          Math.sin((i * Math.PI) / 6) * r,
          Math.cos((i * Math.PI) / 6) * r,
        ]),
      })),
      paint,
    );
    pd.finish();
    // Selected inspection panels and control hinges, following the measured wing sweep. Points
    // lie on the fixed wing's upper surface, not on a flat plane that floated over the slat and
    // sank into the aft wing.
    const wingPath = (corners, closed) =>
      sampledPath(corners, (x, z) => onWing([side * x, 3, z], [0, -1, 0]), 0.2, closed);
    // Slat hinge: just behind the fixed wing's leading edge.
    const hingeZ = (x) => {
      const [, , le, te] = interp(x);
      return le - (le - te) * 0.115;
    };
    outline(
      d,
      wingPath(
        [
          [1.2, hingeZ(1.2)],
          [5.25, hingeZ(5.25)],
        ],
        false,
      ),
      0.004,
      seal,
      false,
    );
    // Access panels behind the slat (they used to run 4 m aft across the elevon hinge).
    for (const x of [2.1, 3.2, 4.3])
      outline(
        d,
        wingPath(
          [
            [x, hingeZ(x) - 0.15],
            [x + 0.28, hingeZ(x + 0.28) - 0.15],
            [x + 0.28, hingeZ(x + 0.28) - 0.75],
            [x, hingeZ(x) - 0.75],
          ],
          true,
        ),
        0.003,
        seal,
      );
    // EJ200 round petal exhausts, separate nozzles and dark, recessed throat.
    // Four-view plan: nozzle pair spans about +/-0.85 m at the exit, which lies near z -5.75.
    const eg = group(root, `Typhoon-exhaust-${side}`, [side * nozzleX, 1.82, -5.14]),
      ed = detailKit(eg, eg.name);
    const rings = [
      [0, 0.5],
      [-0.38, 0.47],
      [-0.62, 0.36],
    ].map(([z, r]) => ({
      z,
      points: Array.from({ length: 28 }, (_, i) => [
        Math.sin((i * Math.PI) / 14) * r,
        Math.cos((i * Math.PI) / 14) * r,
      ]),
    }));
    // Smooth shroud, then 14 flat double-sided petals that narrow toward the exit, leaving the
    // dark liner showing in the gaps, with a scalloped trailing edge (nozzle photograph).
    loft(ed, rings.slice(0, 2), exhaust, { caps: false });
    loft(
      ed,
      rings.map((r) => ({ z: r.z, points: r.points.map(([x, y]) => [x * 0.94, y * 0.94]) })),
      duct,
      { caps: false },
    );
    sheet(
      ed,
      rings[0].points.map((p) => [...p, 0.015]),
      duct,
      [0, 0, -1],
    );
    const at = (a, r, z) => [Math.sin(a) * r, Math.cos(a) * r, z];
    for (let k = 0; k < 14; k++) {
      const a0 = (k * Math.PI) / 7,
        a1 = ((k + 1) * Math.PI) / 7,
        am = (a0 + a1) / 2,
        gap = Math.PI / 70,
        seamZ = -0.57,
        root = at(am, 0.47 * Math.cos(Math.PI / 14), -0.38),
        exit = at(am, 0.36 * Math.cos(Math.PI / 14 - gap), seamZ),
        u = (-0.62 + 0.38) / (seamZ + 0.38),
        tip = root.map((v, i) => v + (exit[i] - v) * u);
      const petal = [
        at(a0, 0.47, -0.38),
        at(a1, 0.47, -0.38),
        at(a1 - gap, 0.36, seamZ),
        tip,
        at(a0 + gap, 0.36, seamZ),
      ];
      sheet(ed, petal, exhaust, [Math.sin(am), Math.cos(am), 0]);
      // Sooted inner face, just inside the bare-metal outer face.
      sheet(
        ed,
        petal.map(([x, y, z]) => [x * 0.98, y * 0.98, z]),
        duct,
        [-Math.sin(am), -Math.cos(am), 0],
      );
    }
    ed.finish();
  }
  // Brake-chute housing: a round can between the nozzle tops under the rudder (rear photograph).
  loft(
    d,
    [
      [-5.2, 0.2],
      [-5.55, 0.2],
      [-5.64, 0.16],
      [-5.7, 0.08],
      [-5.72, 0.01],
    ].map(([z, r]) => ({
      z,
      points: Array.from({ length: 16 }, (_, i) => [
        Math.sin((i * Math.PI) / 8) * r,
        2.2 + Math.cos((i * Math.PI) / 8) * r,
      ]),
    })),
    paint,
  );
  // Single swept fin with real swept hinge. Height is the independently published RAF dimension.
  const fin = [
    [0, 2.57, -2.67],
    [0, 5.29, -6.06],
    [0, 5.29, -6.96],
    [0, 2.43, -5.6],
  ];
  const hingeBottom = [0, 2.38, -4.8],
    hingeTop = [0, 4.98, -6.3];
  const thickFin = (kit, points) => {
    const sections = [-1, 1].map((side) =>
      points.map(([x, y, z]) => [x + side * (y > 4.9 ? 0.025 : 0.055), y, z]),
    );
    for (let i = 0; i < 2; i++) sheet(kit, sections[i], paint, [i ? 1 : -1, 0, 0]);
    for (let i = 0; i < points.length; i++)
      quad(
        kit,
        sections[0][i],
        sections[1][i],
        sections[1][(i + 1) % points.length],
        sections[0][(i + 1) % points.length],
        paint,
        [0, 1, 1],
      );
  };
  thickFin(d, [fin[0], fin[1], [0, 5.29, -6.65], hingeTop, hingeBottom]);
  const rg = group(root, 'Typhoon-rudder', hingeBottom),
    rd = detailKit(rg, rg.name);
  thickFin(
    rd,
    [hingeBottom, hingeTop, [0, 5.29, -6.65], fin[2], fin[3]].map((p) =>
      p.map((v, i) => v - hingeBottom[i]),
    ),
  );
  rd.finish();
  hinge(rg, [0, 1, 0], [0, 2.6, -1.5]);
  bindings.push({
    node: rg.name,
    source: 'yawInput',
    property: 'rotation',
    axis: 'y',
    scale: 0.32,
  });
  // Fin root electronics fairing and dorsal airbrake, stowed in this configuration.
  beveledBox(d, [0.27, 0.38, 1.37], [0, 2.67, -3.05], paint, 0.04);
  outline(
    d,
    [
      [-0.23, 2.93, 2.58],
      [0.23, 2.93, 2.58],
      [0.35, 2.83, 1.2],
      [-0.35, 2.83, 1.2],
    ],
    0.004,
    seal,
  );
  for (const side of [-1, 1]) {
    // Exterior operator identifiers are supplied by the selected livery.
    d.text('RESCUE', [side * 0.55, 2.32, 5.82], 0.06, (side * Math.PI) / 2, seal);
    for (const z of [1.5, 0.6, -0.3, -1.2, -2.1])
      outline(
        d,
        sampledPath(
          [
            [2.43, z],
            [2.43, z - 0.34],
            [2.12, z - 0.34],
            [2.12, z],
          ],
          (y, z) => sideSkin(side, y, z),
          0.07,
        ),
        0.003,
        seal,
      );
    for (const z of [1.5, 0.6, -0.3, -1.2, -2.1])
      for (const y of [2.14, 2.27, 2.41])
        d.add(new T.SphereGeometry(0.0025, 5, 3), metal, sideSkin(side, y, z - 0.025));
  }
  // National markings are livery decals (liveries/aircraft/typhoon.mjs): operators differ.
  // PIRATE optical fairing to port of the forward canopy. Static sensor, not simulated tracking.
  loft(
    d,
    [
      [6.98, 0.04, 2.51],
      [6.8, 0.13, 2.57],
      [6.2, 0.12, 2.65],
    ].map(([z, r, y]) => ({
      z,
      points: Array.from({ length: 12 }, (_, i) => [
        0.34 + Math.sin((i * Math.PI) / 6) * r,
        y + Math.cos((i * Math.PI) / 6) * r,
      ]),
    })),
    paint,
  );
  d.add(new T.CircleGeometry(0.078, 12), glass, [0.34, 2.57, 6.985]);
  for (const [name, x, z, r, w, top] of [
    // Wide track: the main legs hang from the wing roots outboard of the intake
    // (four-view front elevation, museum and taxi photographs: about 3.6 m track).
    ['left', 1.8, -0.57, 0.335, 0.22, 1.42],
    ['right', -1.8, -0.57, 0.335, 0.22, 1.42],
    ['nose', 0, 3.58, 0.22, 0.15, 1.24],
  ]) {
    const g = group(root, `Typhoon-gear-${name}`, [x, top, z]),
      gd = detailKit(g, g.name);
    gd.rod([0, 0, 0], [0, r - top, 0], 0.043, metal);
    gd.rod([0, -0.1, -0.48], [0, r - top + 0.1, 0], 0.026, metal);
    if (name !== 'nose') {
      // Torque-link scissor ahead of the oleo, clear of the tyre.
      const knee = [0, (r - top) * 0.55, 0.11];
      gd.rod([0, (r - top) * 0.42, 0], knee, 0.013, metal);
      gd.rod(knee, [0, (r - top) * 0.66, 0], 0.013, metal);
    }
    gd.add(new T.CylinderGeometry(r, r, w, 24).rotateZ(Math.PI / 2), seal, [0, r - top, 0]);
    gd.add(new T.CylinderGeometry(r * 0.55, r * 0.55, w + 0.015, 20).rotateZ(Math.PI / 2), metal, [
      0,
      r - top,
      0,
    ]);
    // The nose door hangs below the intake trunk instead of standing up inside the duct.
    if (name === 'nose') gd.box([0.025, 0.3, 0.55], [0.17, -0.5, -0.12], paint);
    else gd.box([0.025, 0.47, 0.55], [name === 'right' ? -0.17 : 0.17, -0.15, -0.12], paint);
    gd.finish();
    bindings.push(
      {
        node: g.name,
        source: 'gear',
        property: 'rotation',
        axis: 'x',
        scale: Math.PI / 2,
        offset: -Math.PI / 2,
      },
      { node: g.name, source: 'gearExposed', property: 'visible', scale: 1 },
    );
  }
  d.finish();
  const { stations: controlStations, ...interior } = typhoonCockpit(root, { metal, glass });
  Object.assign(interior.derived, {
    pitchDeflection: { op: 'multiply', args: ['pitchInput', 0.28] },
    rollDeflection: { op: 'multiply', args: ['rollInput', 0.24] },
    elevonLeft: { op: 'subtract', args: ['pitchDeflection', 'rollDeflection'] },
    elevonRight: { op: 'add', args: ['pitchDeflection', 'rollDeflection'] },
  });
  cleanGeometry(root);
  return {
    root,
    frame: { ...typhoonFrame(), controlStations },
    enginePoints: [
      { id: 'engine-1', position: [0.52, 1.82, -5.14] },
      { id: 'engine-2', position: [-0.52, 1.82, -5.14] },
    ],
    visual: {
      rotors: [],
      gearNodes: [],
      flaps: [],
      ailerons: [],
      animation: { bindings },
      interior,
    },
    modelSignals: {
      sources: interior.sources,
      derived: interior.derived,
      bindings: [...interior.bindings, ...bindings],
    },
  };
}

function typhoonCockpit(root, m) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'Typhoon-cabin'),
    ins = instrumentGeometry(cabin, 'Typhoon'),
    { bindings, derived, ink, black, amber } = ins;
  const panel = mat('Typhoon-panel', '#737e81', { side: T.DoubleSide }),
    button = mat('Typhoon-key', '#3d474a'),
    green = mat('Typhoon-display', '#89d79c', { emissive: '#27563b', emissiveIntensity: 0.6 }),
    seat = mat('Typhoon-seat', '#555b37'),
    belt = mat('Typhoon-harness', '#8e9890');
  const sources = Object.fromEntries(
    [
      'airspeed',
      'pitch',
      'roll',
      'yaw',
      'verticalSpeed',
      'gearPosition',
      'flapPosition',
      'loadFactor',
    ].map((k) => [
      { airspeed: 'trueAirspeed', gearPosition: 'gear' }[k] ?? k,
      { component: 'aircraftState', path: [k] },
    ]),
  );
  sources.altitude = { component: 'transform', path: ['pos', 1] };
  for (const [k, v] of [
    ['pitchInput', 'pitch'],
    ['rollInput', 'roll'],
    ['yawInput', 'yaw'],
    ['power', 'power'],
  ])
    sources[k] = { component: 'aircraftInput', path: [v] };
  Object.assign(derived, {
    knots: { op: 'multiply', args: ['trueAirspeed', 1.9438444924406] },
    feet: { op: 'multiply', args: ['altitude', 3.2808398950131] },
    verticalFpm: { op: 'multiply', args: ['verticalSpeed', 196.85039370079] },
    headingRaw: { op: 'subtract', args: [Math.PI, 'yaw'] },
    trueHeading: { op: 'modulo', args: ['headingRaw', Math.PI * 2] },
    gearDown: { op: 'greater', args: ['gear', 0.999] },
    gearExposed: { op: 'greater', args: ['gear', 0.02] },
  });
  const z = 5.55,
    rect = (x, y, w, h, dz = 0) =>
      [
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
      ].map(([u, v]) => [x + u * w, y + v * h, z + dz]),
    txt = (t, x, y, h = 0.008, color = ink, dz = -0.03, role = 'panel') =>
      d.text(t, [x, y, z + dz], h, Math.PI, color, role);
  const edge = [
    [-0.44, 2.38],
    [-0.44, 2.55],
    [-0.35, 2.82],
    [-0.24, 2.86],
    [0.24, 2.86],
    [0.35, 2.82],
    [0.44, 2.55],
    [0.44, 2.38],
    [0.13, 2.38],
    [0.13, 2.11],
    [-0.13, 2.11],
    [-0.13, 2.38],
  ];
  // The main panel face is the same medium gray as the consoles around black display glass and
  // a black head-up control panel (Commons "Eurofighter Cockpit.jpg", tribp, and "Eurofighter
  // Typhoon cockpit.jpg", ReaL-FrienD); only the coaming above it is dark.
  sheet(
    d,
    edge.map((p) => [...p, z]),
    panel,
    [0, 0, -1],
    [rect(0.218, 2.59, 0.103, 0.078), rect(-0.255, 2.775, 0.052, 0.042)],
  );
  // A thin panel-gray rim, not a black frame: the photographed gray panel runs straight into
  // the coaming with no dark border.
  outline(
    d,
    edge.map((p) => [...p, z - 0.003]),
    0.005,
    panel,
  );
  for (let i = 0; i < 7; i++) {
    const a = edge[i],
      b = edge[i + 1];
    quad(
      d,
      [...a, z],
      [...b, z],
      [b[0] * 0.85, b[1] - 0.02, z + 0.26],
      [a[0] * 0.85, a[1] - 0.02, z + 0.26],
      button,
      [0, 1, 0],
    );
  }
  // Three equal 6x6in active areas, center lower. Manufacturer cockpit and BAE dimensions.
  // The bezels are a shade darker than the panel and nearly touch (4 mm gaps), filling the
  // panel width as in both photographs.
  const bezel = mat('Typhoon-bezel', '#5f6a6d');
  function display(x, y, live = false) {
    sheet(
      d,
      rect(x, y, 0.214, 0.222, -0.009),
      bezel,
      [0, 0, -1],
      live ? [rect(x, y + 0.016, 0.103, 0.078, -0.009)] : [],
    );
    sheet(
      d,
      rect(x, y, 0.1524, 0.1524, -0.015),
      black,
      [0, 0, -1],
      live ? [rect(x, y + 0.016, 0.103, 0.078, -0.015)] : [],
    );
    for (const side of [-1, 1])
      for (let i = 0; i < 6; i++)
        d.box([0.012, 0.017, 0.005], [x + side * 0.092, y - 0.064 + i * 0.026, z - 0.02], black);
    for (let i = 0; i < 6; i++)
      d.box([0.017, 0.012, 0.005], [x - 0.065 + i * 0.026, y - 0.094, z - 0.02], black);
    for (const side of [-1, 1])
      d.add(new T.CylinderGeometry(0.009, 0.01, 0.011, 12).rotateX(Math.PI / 2), button, [
        x + side * 0.092,
        y - 0.094,
        z - 0.026,
      ]);
  }
  display(0.218, 2.574, true);
  display(0, 2.485);
  display(-0.218, 2.574);
  ins.horizon('attitude', [0.218, 2.59, z + 0.01], 0.101, 0.076, { blankBackdrop: true });
  txt('FLIGHT / SIM', 0.218, 2.638, 0.006, green, undefined, 'display');
  txt('TAS', 0.256, 2.538, 0.006, green, undefined, 'display');
  ins.readout('speed', [0.256, 2.523, z - 0.028], 'knots', 3, 0.009, green);
  txt('GEO FT', 0.18, 2.538, 0.006, green, undefined, 'display');
  ins.readout('altitude', [0.18, 2.523, z - 0.028], 'feet', 5, 0.008, green, true, true);
  txt('TRUE', 0, 2.552, 0.007, green, undefined, 'display');
  txt('FPM', 0, 2.425, 0.006, green, undefined, 'display');
  ins.readout('vertical-speed', [0, 2.409, z - 0.028], 'verticalFpm', 5, 0.009, green, true, true);
  const hg = group(cabin, 'Typhoon-heading', [0, 2.487, z - 0.028]),
    hd = detailKit(hg, hg.name);
  for (let i = 0; i < 72; i++) {
    const a = (i * Math.PI) / 36,
      p = (r) => [-Math.sin(a) * r, Math.cos(a) * r, 0];
    hd.rod(p(i % 6 ? 0.046 : 0.042), p(0.05), 0.0006, green);
    if (i % 6 === 0) hd.text(String(i / 2), p(0.033), 0.006, Math.PI, green);
  }
  hd.finish();
  bindings.push({
    node: hg.name,
    source: 'trueHeading',
    property: 'rotation',
    axis: 'z',
    scale: -1,
    period: Math.PI * 2,
  });
  ins.available('heading', 'trueHeading', hg.name);
  d.rod([0, 2.54, z - 0.029], [0, 2.532, z - 0.029], 0.001, ink);
  txt('SYSTEMS', -0.218, 2.62, 0.009, green);
  txt('ENGINE --', -0.218, 2.587, 0.009, amber, undefined, 'display');
  txt('FUEL --', -0.218, 2.559, 0.009, amber, undefined, 'display');
  txt('SENSORS INOP', -0.218, 2.524, 0.007, amber, undefined, 'display');
  sheet(
    d,
    rect(-0.255, 2.775, 0.079, 0.067, -0.01),
    black,
    [0, 0, -1],
    [rect(-0.255, 2.775, 0.052, 0.042, -0.01)],
  );
  ins.horizon('standby-attitude', [-0.255, 2.775, z + 0.01], 0.05, 0.04, { blankBackdrop: true });
  // Projecting head-up control panel beneath wide, nearly round HUD combiner.
  const cg = group(cabin, 'Typhoon-HUCP', [0, 2.75, z - 0.075]),
    cd = detailKit(cg, cg.name);
  beveledBox(cd, [0.246, 0.156, 0.08], [0, 0, 0], button, 0.009);
  for (let i = 0; i < 5; i++) {
    cd.box([0.027, 0.021, 0.006], [0.082 - i * 0.041, 0.05, -0.043], panel);
    cd.text(String(i + 1), [0.082 - i * 0.041, 0.05, -0.047], 0.008, Math.PI, ink);
  }
  cd.box([0.155, 0.049, 0.004], [0, -0.014, -0.043], black);
  cd.text('----  ----', [0, -0.014, -0.047], 0.008, Math.PI, green);
  for (const side of [-1, 1])
    for (let i = 0; i < 3; i++)
      cd.box([0.013, 0.012, 0.006], [side * 0.102, 0.012 - i * 0.022, -0.043], black);
  cd.finish();
  // HUD optics only. A true collimated flight HUD requires a separate optical/rendering model.
  const hud = group(cabin, 'Typhoon-HUD', [0, 2.9, 5.72]),
    ud = detailKit(hud, hud.name);
  hud.rotation.x = -0.15;
  const hc = Array.from({ length: 32 }, (_, i) => {
    const a = (i * Math.PI) / 16;
    return [Math.sin(a) * 0.165, 0.115 + Math.cos(a) * 0.125, 0];
  });
  sheet(ud, hc, m.glass, [0, 0, -1]);
  outline(ud, hc, 0.0028, black);
  for (const side of [-1, 1])
    ud.rod([side * 0.13, -0.1, -0.08], [side * 0.164, 0.1, 0], 0.007, button);
  beveledBox(ud, [0.25, 0.065, 0.21], [0, -0.1, 0.04], black, 0.008);
  ud.finish();
  const keypad = group(cabin, 'Typhoon-left-keypad', [0.364, 2.68, z - 0.012]),
    kd = detailKit(keypad, keypad.name);
  keypad.rotation.z = -0.13;
  beveledBox(kd, [0.071, 0.167, 0.014], [0, 0, 0], panel, 0.004);
  kd.box([0.054, 0.025, 0.004], [0, 0.061, -0.01], black);
  for (let row = 0; row < 5; row++)
    for (let col = 0; col < 3; col++)
      kd.box([0.012, 0.013, 0.004], [-0.02 + col * 0.02, 0.027 - row * 0.021, -0.01], black);
  kd.finish();
  // Upper-left function keys and caution housings visible around the projecting HUCP.
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 4; col++) {
      const x = 0.17 + col * 0.025,
        y = 2.793 - row * 0.026;
      d.box([0.02, 0.016, 0.004], [x, y, z - 0.014], black);
      txt(['NAV', 'COM', 'SYS', 'DATA'][col], x, y, 0.0045, ink, -0.017);
    }
  for (const side of [-1, 1]) {
    d.box([0.045, 0.022, 0.016], [side * 0.15, 2.828, z - 0.035], black);
    txt(side === 1 ? 'WARN' : 'CAUT', side * 0.15, 2.828, 0.005, amber, -0.045);
  }
  // Lower center electrical/control panel, kept visually distinct from the flight displays.
  sheet(d, rect(0, 2.255, 0.23, 0.23, -0.008), panel, [0, 0, -1]);
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 3; col++) {
      const x = 0.07 - col * 0.045,
        y = 2.326 - row * 0.044;
      d.box([0.03, 0.026, 0.006], [x, y, z - 0.018], black);
      txt(['BATT', 'GEN', 'EPU', 'TEST'][row], x, y, 0.005, ink, -0.022);
    }
  d.add(new T.CylinderGeometry(0.021, 0.023, 0.012, 16).rotateX(Math.PI / 2), button, [
    -0.076,
    2.31,
    z - 0.023,
  ]);
  txt('EMER', -0.076, 2.344, 0.006);
  // Sloping front console panels, with round ventilation outlets and guarded selectors.
  for (const side of [-1, 1]) {
    const g = group(cabin, `Typhoon-front-console-${side}`, [side * 0.32, 2.28, 5.38]);
    g.rotation.x = 0.38;
    const gd = detailKit(g, g.name);
    beveledBox(gd, [0.19, 0.24, 0.025], [0, 0, 0], panel, 0.006);
    gd.add(
      new T.CylinderGeometry(0.044, 0.048, 0.013, 24).rotateX(Math.PI / 2),
      black,
      [0, 0.064, -0.021],
    );
    for (let j = 0; j < 5; j++)
      gd.add(
        bar([-0.032, 0.042 + j * 0.011, -0.03], [0.032, 0.042 + j * 0.011, -0.03], 0.002, 8),
        button,
      );
    gd.box([0.048, 0.043, 0.004], [0.039, -0.028, -0.018], amber);
    gd.add(
      new T.CylinderGeometry(0.012, 0.014, 0.016, 10).rotateX(Math.PI / 2),
      black,
      [0.039, -0.028, -0.028],
    );
    // The landing-gear lever (left) and the parking brake and flap selectors (right) are
    // stations on the outboard half of these panels (end of this function).
    gd.text(side === 1 ? 'GEAR' : 'BRAKE', [0, -0.088, -0.018], 0.009, Math.PI, ink);
    gd.finish();
  }
  for (let i = 0; i < 2; i++)
    d.box([0.017, 0.108, 0.01], [-0.365 + i * 0.028, 2.57, z - 0.014], black);
  // Tub, individual console plates, ribbed pedals, Mk16A-style seat and harness.
  // The tub stays inside the forebody and below the sill bridges (no panel edges outside).
  d.box([0.6, 0.05, 1.9], [0, 1.695, 4.68], panel);
  sheet(
    d,
    [
      [-0.32, 1.73],
      [0.32, 1.73],
      [0.42, 1.9],
      [0.435, 2.32],
      [-0.435, 2.32],
      [-0.42, 1.9],
    ].map(([x, y]) => [x, y, 5.82]),
    panel,
    [0, 0, -1],
  );
  // Fit: dark liners follow the skin from the floor up to the canopy sill, the console tops and the
  // floor run out to them and a bulkhead closes the nose ahead of the pedals, so no painted skin
  // shows beside the consoles, around the panel or along the sill (it did all round the old
  // sloped side walls).
  sillLiner(d, root, {
    zFrom: 3.85,
    zTo: 5.83,
    yFrom: 1.69,
    yTo: 2.8,
    material: panel,
    zSteps: 20,
    inset: 0.02,
  });
  consoleShelf(d, root, { zFrom: 3.9, zTo: 5.4, y: 2.265, x: 0.45, material: panel, inset: 0.025 });
  consoleShelf(d, root, {
    zFrom: 3.85,
    zTo: 5.83,
    y: 1.718,
    x: 0.29,
    material: panel,
    steps: 10,
    inset: 0.025,
  });
  cockpitBulkhead(d, root, { z: 5.835, yFrom: 1.69, yTo: 2.5, material: panel });
  for (const side of [-1, 1]) {
    d.box([0.18, 0.25, 1.5], [side * 0.36, 2.14, 4.65], panel);
    const g = group(cabin, `Typhoon-console-${side}`, [side * 0.36, 2.27, 4.55]);
    g.rotation.x = Math.PI / 2;
    const gd = detailKit(g, g.name);
    for (const [i, label] of (side === 1
      ? ['FUEL', 'POWER', 'START', 'COMM']
      : ['LIGHT', 'CANOPY', 'OXY', 'ECS']
    ).entries()) {
      const v = 0.49 - i * 0.3;
      gd.box([0.16, 0.27, 0.008], [0, v, 0], panel);
      outline(
        gd,
        [
          [-0.078, v - 0.13, -0.006],
          [0.078, v - 0.13, -0.006],
          [0.078, v + 0.13, -0.006],
          [-0.078, v + 0.13, -0.006],
        ],
        0.0015,
        black,
      );
      gd.text(label, [0, v + 0.09, -0.009], 0.009, Math.PI, ink);
      // START (left) and CANOPY (right) carry stations (end of this function).
      const station = (side === 1 && i === 2) || (side === -1 && i === 1);
      for (const x of [-0.045, 0.04]) {
        if (!station) {
          gd.add(new T.CylinderGeometry(0.0085, 0.0095, 0.01, 16).rotateX(Math.PI / 2), button, [
            x,
            v - 0.05,
            -0.009,
          ]);
          gd.add(bar([x, v + 0.015, -0.004], [x, v + 0.022, -0.02], 0.0016, 10, 0.0024), m.metal);
        }
        for (const y of [-0.115, 0.115])
          gd.add(new T.CircleGeometry(0.003, 6).rotateY(Math.PI), black, [x * 1.5, v + y, -0.007]);
      }
      if (i === 2 && side === -1) {
        gd.box([0.038, 0.043, 0.003], [0.02, v - 0.05, -0.009], amber);
        for (let n = 0; n < 3; n++)
          gd.rod(
            [0.001 + n * 0.011, v - 0.071, -0.012],
            [0.011 + n * 0.011, v - 0.03, -0.012],
            0.002,
            black,
          );
      }
    }
    gd.finish();
  }
  const sg = group(cabin, 'Typhoon-Mk16A', [0, 2.2, 4.55]);
  sg.rotation.x = -0.2;
  const sd = detailKit(sg, sg.name);
  beveledBox(sd, [0.47, 0.13, 0.5], [0, 0, 0.18], seat);
  beveledBox(sd, [0.43, 0.68, 0.14], [0, 0.38, -0.08], seat);
  beveledBox(sd, [0.28, 0.25, 0.18], [0, 0.88, -0.08], black);
  for (const side of [-1, 1]) {
    sd.rod([side * 0.25, -0.12, -0.17], [side * 0.25, 1.02, -0.17], 0.022, m.metal);
    sheet(
      sd,
      [
        [side * 0.08, 0.72, 0.005],
        [side * 0.14, 0.72, 0.005],
        [side * 0.1, 0.11, 0.12],
        [side * 0.04, 0.11, 0.12],
      ],
      belt,
      [0, 0, 1],
    );
    sheet(
      sd,
      [
        [side * 0.23, 0.07, 0.3],
        [side * 0.23, 0.12, 0.35],
        [0, 0.13, 0.18],
        [0, 0.08, 0.13],
      ],
      belt,
      [0, 1, 1],
    );
    sd.box([0.05, 0.08, 0.14], [side * 0.255, 0.1, 0.17], black);
  }
  sd.add(
    new T.CylinderGeometry(0.035, 0.035, 0.016, 16).rotateX(Math.PI / 2),
    black,
    [0, 0.12, 0.19],
  );
  sd.ring(0.05, 0.008, [0, 0.12, 0.43], amber);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    sd.add(new T.SphereGeometry(0.0085, 6, 4), black, [
      Math.sin(a) * 0.05,
      0.12 + Math.cos(a) * 0.05,
      0.43,
    ]);
  }
  sd.finish();
  const stick = group(cabin, 'Typhoon-stick', [0, 1.87, 5.17]),
    st = detailKit(stick, stick.name);
  // Tall centre stick in a rubber boot, the Eurofighter grip with its crowded thumb shelf.
  stickGeometry(st, { style: 'euro', height: 0.5, rake: -0.05, shaft: 0.014, scale: 1.05 });
  st.finish();
  bindings.push(
    { node: stick.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.2 },
    { node: stick.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.17 },
  );
  for (let i = 0; i < 2; i++) {
    const g = group(cabin, `Typhoon-throttle-${i}`, [0.3 + i * 0.06, 2.27, 4.95]),
      gd = detailKit(g, g.name);
    // Twin throttles: the outboard (left engine) grip carries the switches, the inboard one is a
    // plain hand rest; a single slot each in the console's quadrant block.
    leverGeometry(gd, { style: i === 1 ? 'hotas-euro' : 'hotas-right', height: 0.075, side: 1 });
    gd.finish();
    d.box([0.01, 0.003, 0.2], [0.3 + i * 0.06, 2.2745, 4.95], black);
    bindings.push({
      node: g.name,
      source: 'power',
      property: 'rotation',
      axis: 'x',
      scale: 0.6,
      offset: -0.3,
    });
  }
  for (const side of [-1, 1]) {
    const g = group(cabin, `Typhoon-pedal-${side}`, [side * 0.15, 1.89, 5.42]),
      gd = detailKit(g, g.name);
    pedalGeometry(gd, { style: 'fighter', side, drop: 0.09, scale: 1.04, lean: 0.32 });
    gd.finish();
    bindings.push({
      node: g.name,
      source: 'yawInput',
      property: 'position',
      axis: 'z',
      scale: -side * 0.06,
    });
  }
  const lamp = group(cabin, 'Typhoon-gear-lamp', [0.35, 2.405, z - 0.03]),
    ld = detailKit(lamp, lamp.name);
  ld.box([0.012, 0.012, 0.003], [0, 0, 0], green);
  ld.finish();
  bindings.push({
    node: lamp.name,
    source: 'gearDown',
    property: 'visible',
    scale: 1,
    missing: 'hide',
  });
  txt('GEAR', 0.35, 2.387, 0.006);
  d.finish();
  // Where the controls are (cockpit sources in reference-review.json):
  // the landing-gear lever on the left front console, the parking brake and flap selectors on the
  // right one, the airbrake on the outboard throttle grip, the engine and APU switches on the
  // left console behind the throttles, the canopy handle on the right console.
  const frontAt = (side, u, v) => {
      const a = 0.38;
      return [
        side * 0.32 + u,
        2.28 + v * Math.cos(a) + 0.0135 * Math.sin(a),
        5.38 + v * Math.sin(a) - 0.0135 * Math.cos(a),
      ];
    },
    tilt = [0.38, 0, 0],
    top = [Math.PI / 2, 0, 0],
    plate = (side, i, dx = 0) => [side * 0.36 + dx, 2.2745, 4.55 + 0.49 - i * 0.3 + 0.02];
  const stations = [
    { action: 'gear', style: 'jet', scale: 0.78, at: frontAt(1, -0.045, -0.025), rotation: tilt },
    {
      action: 'brake',
      style: 'tee',
      scale: 0.75,
      at: frontAt(-1, -0.045, -0.02),
      rotation: tilt,
      label: 'PARK',
      labelAt: [0, 0.022, -0.002],
      labelHeight: 0.006,
    },
    {
      action: 'flaps',
      style: 'toggle',
      scale: 1.15,
      at: frontAt(-1, -0.074, 0.07),
      rotation: tilt,
      label: 'FLAP',
      labelAt: [0, -0.026, -0.002],
      labelHeight: 0.006,
    },
    {
      action: 'speedBrake',
      style: 'slider',
      parent: 'Typhoon-throttle-1',
      at: [0.366, 2.405, 4.9],
      rotation: [0, 0, 0],
    },
    {
      action: 'engine',
      engine: 0,
      style: 'guarded',
      at: plate(1, 2, 0.045),
      rotation: top,
      label: 'ENG L',
      labelAt: [0, 0.03, -0.002],
    },
    {
      action: 'engine',
      engine: 1,
      style: 'guarded',
      at: plate(1, 2),
      rotation: top,
      label: 'ENG R',
      labelAt: [0, 0.03, -0.002],
    },
    {
      action: 'engine',
      style: 'guarded',
      at: plate(1, 2, -0.045),
      rotation: top,
      label: 'APU',
      labelAt: [0, 0.03, -0.002],
    },
    {
      action: 'canopy',
      style: 'canopy',
      at: plate(-1, 1),
      rotation: top,
      label: 'CANOPY',
      labelAt: [0, -0.045, -0.002],
    },
  ];
  return { nodes: ['cockpit'], sources, derived, bindings, stations };
}

/** Sidewall liners from `yFrom` up to the canopy sill, `inset` inside the skin. Each station's
 * column climbs the wall in 1 cm steps and stops below `yTo` where that side's skin ends or jumps
 * to another surface (a shoulder or chine outboard), so the liner meets the sill instead of
 * leaving a painted strip above its last row, and never reaches out through the skin. */
function sillLiner(
  d,
  root,
  { zFrom, zTo, yFrom, yTo, material, zSteps = 14, ySteps = 8, inset = 0.008 },
) {
  for (const side of [1, -1]) {
    const columns = [];
    for (let i = 0; i <= zSteps; i++) {
      const z = zFrom + ((zTo - zFrom) * i) / zSteps,
        segments = skinSection(root, z);
      let lo = yFrom,
        last = wallAt(segments, yFrom, side);
      if (last === undefined) {
        columns.push(undefined);
        continue;
      }
      for (let y = yFrom + 0.01; y <= yTo + 1e-9; y += 0.01) {
        const x = wallAt(segments, y, side);
        if (x === undefined || Math.abs(x - last) > 0.03) break;
        lo = y;
        last = x;
      }
      columns.push(
        Array.from({ length: ySteps + 1 }, (_, j) => {
          const y = yFrom + ((lo - yFrom) * j) / ySteps,
            x = wallAt(segments, y, side);
          return x === undefined ? undefined : [x - side * inset, y, z];
        }),
      );
    }
    for (let i = 0; i < zSteps; i++)
      for (let j = 0; j < ySteps; j++) {
        const corners = [
          columns[i]?.[j],
          columns[i + 1]?.[j],
          columns[i + 1]?.[j + 1],
          columns[i]?.[j + 1],
        ];
        if (corners.every(Boolean)) quad(d, ...corners, material, [-side, 0, 0]);
      }
  }
}
/** A console top at height `y` from its outboard edge `x` out to the skin, both sides. */
function consoleShelf(d, root, { zFrom, zTo, y, x, material, steps = 8, inset = 0.008 }) {
  for (const side of [1, -1]) {
    const row = [];
    for (let i = 0; i <= steps; i++) {
      const z = zFrom + ((zTo - zFrom) * i) / steps,
        wall = wallAt(skinSection(root, z), y, side);
      if (wall !== undefined) row.push([z, wall - side * inset]);
    }
    for (let i = 0; i + 1 < row.length; i++) {
      const [z0, w0] = row[i],
        [z1, w1] = row[i + 1];
      quad(d, [side * x, y, z0], [side * x, y, z1], [w1, y, z1], [w0, y, z0], material, [0, 1, 0]);
    }
  }
}
