/** Rafale C, clean configuration. Reference scope and uncertainty: reference-review.json.
 * Metres, +Z forward, +X pilot left. Geometry authored from separate C photos and B arrangement.
 */
import { cockpitBulkhead, skinSection, wallAt } from './cockpit-fit.mjs';
import {
  bar,
  contour,
  lathe,
  loftUp,
  partPalette,
  pedalGeometry,
  place,
  roundedBox,
  tube,
} from './cockpit-parts.mjs';
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

export const rafaleFrame = () => ({
  heli: false,
  fighter: true,
  large: false,
  radius: 0.65,
  cy: 1.95,
  ry: 0.65,
  cabinZ: 4.07,
  cabinWidth: 0.98,
  eye: [0, 3, 4.07],
  panelZ: 4.92,
  floor: 1.5,
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
    if (!hit) throw Error(`Rafale marking misses the skin at ${origin}`);
    const normal = hit.face.normal.clone();
    if (normal.dot(dir) > 0) normal.negate();
    return hit.point.addScaledVector(normal, lift).toArray();
  };
}
/** Points every `step` metres along a polyline of 2-D corners, each mapped by `at`. A straight
 * tube between two corners would cut through the creases between loft facets or float over
 * the wing's camber. */
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
export function buildRafaleC(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('Rafale-gray', '#939a9d', { side: T.DoubleSide }),
    radome = mat('Rafale-radome', '#777f83'),
    seal = mat('Rafale-seal', '#343b3e'),
    metal = mat('Rafale-alloy', '#a4aaad', { metalness: 0.7 }),
    exhaust = mat('Rafale-exhaust', '#77746c', { metalness: 0.7, side: T.DoubleSide }),
    duct = mat('Rafale-duct', '#111a1e', { side: T.DoubleSide }),
    glass = mat('Rafale-glass', '#b7bda3', {
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.12,
    });
  const d = detailKit(root, 'Rafale-airframe'),
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
  const foreData = [
    [8.3, 0.004, 1.62, 1.63],
    [7.65, 0.17, 1.54, 1.91],
    [6.8, 0.34, 1.44, 2.22],
    [5.95, 0.46, 1.39, 2.42],
    [5.3, 0.51, 1.36, 2.46],
    [4.7, 0.55, 1.34, 2.51],
    [4.05, 0.58, 1.32, 2.53],
    [3.25, 0.64, 1.3, 2.57],
    [2.5, 0.7, 1.27, 2.66],
    [1.4, 0.81, 1.2, 2.7],
  ];
  // Forebody chines: from the radome joint the sill line flares outboard toward the canard
  // roots (head-on and low front photographs), instead of a plain round tube.
  const chine = (z) => 0.26 * Math.pow(Math.min(Math.max((5.95 - z) / 4.55, 0), 1), 0.8);
  const flare = [0, 0, 0, 0.25, 0.8, 1, 0.35];
  const fore = foreData.map(([z, w, b, t]) => ({
    z,
    points: Array.from({ length: 24 }, (_, i) => {
      const a = (i * Math.PI) / 12,
        k = i <= 12 ? i : 24 - i;
      return [
        Math.sin(a) * w + Math.sign(Math.sin(a)) * chine(z) * (flare[k] ?? 0),
        (b + t) / 2 + (Math.cos(a) * (t - b)) / 2,
      ];
    }),
  }));
  loft(d, fore.slice(0, 4), radome);
  loft(d, fore.slice(3, 9), paint, { caps: false, skip: (_, j) => j < 4 || j >= 20 });
  loft(d, fore.slice(8), paint, { caps: false });
  outline(
    d,
    fore[3].points.map((p) => [...p, 5.95]),
    0.006,
    seal,
  );
  const canopy = [
    [5.95, 0.02, 2.42, 2.44],
    [5.3, 0.32, 2.46, 2.86],
    [4.7, 0.47, 2.51, 3.19],
    [4.05, 0.5, 2.53, 3.24],
    [3.25, 0.41, 2.57, 3.04],
    [2.5, 0.03, 2.66, 2.68],
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
      i === 2 ? 0.018 : 0.015,
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
  for (const side of [-1, 1])
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
        const u = n / 7;
        d.add(new T.SphereGeometry(0.0035, 5, 3), metal, [
          side * (ca[1] + (cb[1] - ca[1]) * u),
          ca[2] + (cb[2] - ca[2]) * u + 0.022,
          ca[0] + (cb[0] - ca[0]) * u,
        ]);
      }
    }
  // Rounded twin-engine shoulders, narrow dorsal spine and a shallow centre belly channel.
  const aft = [
    [1.4, 1.65, 1.16, 2.7],
    [0.45, 1.86, 1.16, 2.66],
    [-1.5, 1.88, 1.16, 2.64],
    [-3.4, 1.73, 1.22, 2.64],
    [-5.4, 1.16, 1.35, 2.55],
  ].map(([z, w, b, t]) => ({
    z,
    points: [
      [0, t],
      [0.35, t - 0.025],
      [0.62, t - 0.19],
      [w * 0.72, t - 0.48],
      [w, 1.86],
      [w * 0.7, b + 0.16],
      [w * 0.6, b],
      [w * 0.34, b + 0.04],
      [0, b + 0.12],
      [-w * 0.34, b + 0.04],
      [-w * 0.6, b],
      [-w * 0.7, b + 0.16],
      [-w, 1.86],
      [-w * 0.72, t - 0.48],
      [-0.62, t - 0.19],
      [-0.35, t - 0.025],
    ],
  }));
  loft(d, aft, paint, { caps: false });
  for (const side of [-1, 1])
    quad(
      d,
      [side * 0.5, 2.57, 2.5],
      [side * 0.65, 2.51, 1.4],
      [side * 1.1, 2.25, 1.4],
      [side * 0.64, 2.2, 2.5],
      paint,
      [side, 1, 0],
    );
  sheet(
    d,
    aft.at(-1).points.map((p) => [...p, -5.4]),
    paint,
    [0, 0, -1],
  );
  // Panel markings lie on the loft's actual triangles: corners interpolated between rings sank
  // under the warped quads' diagonals and showed only fragments of each rectangle.
  const onSkin = surfaceCaster((kit) => loft(kit, aft, null, { caps: false, smooth: false }));
  const skin = (side, y, z) => onSkin([side * 3, y, z], [-side, 0, 0]);
  // Two separate semi-ventral mouths, with visible duct depth and boundary-layer gaps.
  for (const side of [-1, 1]) {
    // Head-on photograph (Rafale M, Volkel 2007) and three-view front elevation: the lips
    // sit close under the chines, about 0.7 m high, outer lip near +/-1.2 m (inboard of
    // the main wheels), not a large round scoop outboard of them.
    // Kidney-shaped mouth: flat top under the chine, full outer side, and an inner edge that
    // leans outboard toward the narrower bottom (front elevation and head-on photograph).
    const mouth = [
      [0.5, 1.98],
      [0.7, 2.02],
      [0.92, 2.03],
      [1.08, 1.98],
      [1.16, 1.86],
      [1.18, 1.7],
      [1.15, 1.53],
      [1.07, 1.4],
      [0.95, 1.31],
      [0.83, 1.29],
      [0.74, 1.33],
      [0.66, 1.43],
      [0.58, 1.58],
      [0.53, 1.74],
      [0.5, 1.88],
    ].map(([x, y]) => [side * x, y, 3.13 + (y - 1.66) * 0.32]);
    const n = mouth.length,
      throat = mouth.map(([x, y, z]) => [x * 0.98, y + 0.03, z - 0.85]),
      // Painted lip band just inside the mouth, so the opening keeps its shape head-on.
      lip = mouth.map((p, i) => p.map((v, k) => v + (throat[i][k] - v) * 0.06));
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      quad(d, mouth[i], lip[i], lip[j], mouth[j], paint, [0, 0, 1]);
      quad(d, lip[i], throat[i], throat[j], lip[j], duct, [0, 0, 1]);
    }
    sheet(d, throat, duct, [0, 0, 1]);
    outline(d, mouth, 0.025, paint);
    const outer = mouth.map(([x, y, z]) => {
        const dx = Math.abs(x) - 0.84,
          dy = y - 1.66,
          k = 0.025 / Math.hypot(dx, dy);
        return [side * (Math.abs(x) + dx * k), y + dy * k, z - 0.018];
      }),
      rear = outer.map(([x, y]) => [
        side * (0.84 + (Math.abs(x) - 0.84) * 2.2),
        1.65 + (y - 1.66) * 1.25,
        1.4,
      ]);
    for (let i = 0; i < n; i++)
      quad(d, outer[i], rear[i], rear[(i + 1) % n], outer[(i + 1) % n], paint, [side, 0, 0]);
    // SPECTRA housing aft of lip: compact teardrop, not a weapons pylon.
    loft(
      d,
      [
        [2.92, 0.015],
        [2.64, 0.085],
        [2.1, 0.045],
      ].map(([z, r]) => ({
        z,
        points: Array.from({ length: 12 }, (_, i) => [
          side * (1.3 + Math.sin((i * Math.PI) / 6) * r),
          1.36 + Math.cos((i * Math.PI) / 6) * r,
        ]),
      })),
      paint,
    );
  }
  const stations = [
      [1.82, 1.83, 0.5, -4.67, 0.09],
      [5.45, 1.71, -2.95, -4.47, 0.018],
    ],
    mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
    cut = (s, f) => [s[0], s[1], s[2] + (s[3] - s[2]) * f, s[3], s[4]];
  for (const side of [-1, 1]) {
    const names = side === 1 ? 'left' : 'right',
      a = stations[0],
      b = stations[1],
      mid = mix(a, b, (3.55 - a[0]) / (b[0] - a[0]));
    const fixedWing = stations.map((p) => [
      side * p[0],
      p[1],
      p[2] + (p[3] - p[2]) * 0.1,
      p[2] + (p[3] - p[2]) * 0.8,
      p[4],
    ]);
    wing(d, fixedWing, paint);
    const onWing = surfaceCaster((kit) => wing(kit, fixedWing, null), 0.004),
      wingAt = (x, f) => {
        const p = mix(a, b, (x - a[0]) / (b[0] - a[0]));
        return onWing([side * x, 4, p[2] + (p[3] - p[2]) * f], [0, -1, 0]);
      };
    for (const [j, ss] of [
      [0, [a, mid]],
      [1, [mid, b]],
    ]) {
      const e = ss.map((p) => cut(p, 0.8)),
        pivot = [side * e[0][0], e[0][1], e[0][2]],
        g = group(root, `Rafale-elevon-${names}-${j}`, pivot),
        gd = detailKit(g, g.name);
      wing(
        gd,
        e.map((p) => [
          side * p[0] - pivot[0],
          p[1] - pivot[1],
          p[2] - pivot[2],
          p[3] - pivot[2],
          p[4] * 0.6,
        ]),
        paint,
      );
      gd.finish();
      hinge(
        g,
        [1, 0, 0],
        [e[1][0] - e[0][0], side * (e[1][1] - e[0][1]), side * (e[1][2] - e[0][2])],
      );
      bindings.push({
        node: g.name,
        source: side === 1 ? 'elevonLeft' : 'elevonRight',
        property: 'rotation',
        axis: 'x',
        scale: 1,
      });
    }
    const pivot = [side * a[0], a[1], a[2] + (a[3] - a[2]) * 0.1],
      sl = group(root, `Rafale-slat-${names}`, pivot),
      sd = detailKit(sl, sl.name);
    wing(
      sd,
      stations.map((p) => [
        side * p[0] - pivot[0],
        p[1] - pivot[1],
        p[2] - pivot[2],
        p[2] + (p[3] - p[2]) * 0.1 - pivot[2],
        p[4] * 0.35,
      ]),
      paint,
    );
    sd.finish();
    hinge(
      sl,
      [1, 0, 0],
      [b[0] - a[0], side * (b[1] - a[1]), side * (b[2] + (b[3] - b[2]) * 0.1 - pivot[2])],
    );
    bindings.push({
      node: sl.name,
      source: 'flapPosition',
      property: 'rotation',
      axis: 'x',
      scale: 0.13,
    });
    const cg = group(root, `Rafale-canard-${names}`, [side * 0.72, 2.44, 2.4]),
      cd = detailKit(cg, cg.name);
    wing(
      cd,
      [
        // A visible root thickness keeps the canard readable edge-on in level 3/4 views.
        [0, 0, 1, -0.55, 0.062],
        // Tip at about +/-2.4 m: head-on photograph and front elevation (canard span to
        // main-gear track about 1.65).
        [side * 1.68, 0, -0.31, -1.01, 0.02],
      ],
      paint,
    );
    cd.finish();
    bindings.push({
      node: cg.name,
      source: 'pitchInput',
      property: 'rotation',
      axis: 'x',
      scale: -0.25,
    });
    // Selected panel boundaries and flush screw lines follow the wing surface. They were drawn at
    // the section's crest height everywhere, so the hinge lines floated up to 9 cm over the
    // leading and trailing edges.
    for (const f of [0.11, 0.79])
      outline(
        d,
        sampledPath(
          [
            [a[0] + 0.03, f],
            [b[0] - 0.03, f],
          ],
          wingAt,
          0.3,
          false,
        ),
        0.004,
        seal,
        false,
      );
    for (const x of [2.5, 3.55, 4.4])
      outline(
        d,
        sampledPath(
          // Corners on the section's 25 % and 75 % creases of the fixed chord (0.1 to 0.8).
          [
            [x, 0.2],
            [x, 0.275],
            [x, 0.625],
            [x, 0.7],
          ],
          wingAt,
          0.2,
          false,
        ),
        0.003,
        seal,
        false,
      );
    for (const [za, zb, ya, yb] of [
      [0.3, -0.8, 2.17, 1.95],
      [-1, -2.4, 2.35, 2.08],
      [-2.65, -4.4, 2.2, 1.93],
    ]) {
      outline(
        d,
        sampledPath(
          [
            [ya, za],
            [ya, zb],
            [yb, zb],
            [yb, za],
          ],
          (y, z) => skin(side, y, z),
          0.08,
        ),
        0.004,
        seal,
      );
      for (let i = 0; i < 10; i++)
        d.add(new T.SphereGeometry(0.003, 5, 3), metal, skin(side, ya, za + ((zb - za) * i) / 10));
    }
  }
  // One swept fin, a separate rudder and the characteristic top sensor fairing.
  // The leading edge rises out of the spine in a long concave fillet before its straight 55 deg
  // sweep (three-view and side photographs); a straight edge from the spine made the fin fuller.
  const fin = [
    [0, 2.64, -1.2],
    [0, 2.7, -2.0],
    [0, 2.9, -2.6],
    [0, 3.3, -3.2],
    [0, 4.95, -5.6],
    [0, 4.91, -6.25],
    [0, 2.66, -5.04],
  ];
  const finHalf = (y) => 0.075 - ((y - 2.64) / (4.95 - 2.64)) * 0.05;
  for (const side of [-1, 1])
    sheet(
      d,
      fin.map((p) => [side * finHalf(p[1]), p[1], p[2]]),
      paint,
      [side, 0, 0],
    );
  for (let i = 0; i < fin.length; i++) {
    const p = fin[i],
      q = fin[(i + 1) % fin.length];
    quad(
      d,
      [finHalf(p[1]), p[1], p[2]],
      [-finHalf(p[1]), p[1], p[2]],
      [-finHalf(q[1]), q[1], q[2]],
      [finHalf(q[1]), q[1], q[2]],
      paint,
      [0, 1, 0],
    );
  }
  const rb = [0, 2.66, -5.04],
    rt = [0, 4.91, -6.25],
    rg = group(root, 'Rafale-rudder', rb),
    rd = detailKit(rg, rg.name);
  for (const side of [-1, 1])
    sheet(
      rd,
      [
        [side * 0.075, 0, 0],
        [side * 0.025, rt[1] - rb[1], rt[2] - rb[2]],
        [side * 0.025, rt[1] - rb[1], -6.96 - rb[2]],
        [side * 0.075, 0, -5.77 - rb[2]],
      ],
      paint,
      [side, 0, 0],
    );
  rd.finish();
  hinge(rg, [0, 1, 0], [0, rt[1] - rb[1], rt[2] - rb[2]]);
  bindings.push({
    node: rg.name,
    source: 'yawInput',
    property: 'rotation',
    axis: 'y',
    scale: 0.32,
  });
  beveledBox(d, [0.17, 0.24, 1.8], [0, 4.84, -6.1], paint, 0.04);
  loft(
    d,
    [
      [-5.55, 0.01, 4.98],
      [-6.2, 0.05, 5.3],
      [-6.75, 0.025, 5.09],
    ].map(([z, w, t]) => ({
      z,
      points: [
        [-w, 4.97],
        [w, 4.97],
        [w * 0.6, t],
        [0, t],
        [-w * 0.6, t],
      ],
    })),
    paint,
  );
  for (const side of [-1, 1]) {
    // Close-set M88 nozzles with a narrow divider (rear photograph, Paris 2009).
    const cx = side * 0.61,
      cy = 1.92;
    const rings = [
      [-5.4, 0.5],
      [-5.75, 0.45],
      [-5.94, 0.42],
    ].map(([z, r]) => ({
      z,
      points: Array.from({ length: 28 }, (_, i) => [
        cx + Math.sin((i * Math.PI) / 14) * r,
        cy + Math.cos((i * Math.PI) / 14) * r,
      ]),
    }));
    // Shroud, then 14 flat double-sided petals with a scalloped trailing edge; inside the exit
    // a lighter divergent-flap ring leads to the dark throat (rear photograph). The end plate
    // stays at z -5.44.
    loft(d, rings.slice(0, 2), exhaust, { caps: false });
    const at = (a, r, z) => [cx + Math.sin(a) * r, cy + Math.cos(a) * r, z];
    for (let k = 0; k < 14; k++) {
      const a0 = (k * Math.PI) / 7,
        a1 = ((k + 1) * Math.PI) / 7,
        am = (a0 + a1) / 2,
        c = Math.cos(Math.PI / 14),
        seamZ = -5.9,
        root = at(am, 0.45 * c, -5.75),
        exit = at(am, 0.42 * c, seamZ),
        u = (-5.94 + 5.75) / (seamZ + 5.75),
        tip = root.map((v, i) => v + (exit[i] - v) * u);
      sheet(
        d,
        [at(a0, 0.45, -5.75), at(a1, 0.45, -5.75), at(a1, 0.42, seamZ), tip, at(a0, 0.42, seamZ)],
        exhaust,
        [Math.sin(am), Math.cos(am), 0],
      );
      quad(
        d,
        at(a0, 0.405, -5.89),
        at(a1, 0.405, -5.89),
        at(a1, 0.37, -5.7),
        at(a0, 0.37, -5.7),
        metal,
        [-Math.sin(am), -Math.cos(am), 0],
      );
    }
    const throat = (z, r) => ({
      z,
      points: Array.from({ length: 28 }, (_, i) => at((i * Math.PI) / 14, r, z).slice(0, 2)),
    });
    loft(d, [throat(-5.7, 0.37), throat(-5.45, 0.365)], duct, { caps: false });
    d.add(new T.CircleGeometry(0.37, 28).rotateY(Math.PI), duct, [cx, cy, -5.44]);
    for (let j = 0; j < 14; j++)
      outline(
        d,
        rings.slice(0, 2).map((r) => [...r.points[j * 2], r.z]),
        0.005,
        seal,
        false,
      );
    // SPECTRA rear fairings ride on the spine beside the fin root (rear and 3/4 photographs);
    // at x 0.9 they floated half a metre above the engine shoulders.
    d.rod([side * 0.21, 2.6, -4.75], [side * 0.21, 2.6, -5.72], 0.07, paint);
  }
  // Central tail fairing over the nozzle pair and the narrow divider between them (rear photo).
  loft(
    d,
    [
      [-5.4, 0.14, 2.05, 2.56],
      [-5.75, 0.12, 2.12, 2.5],
      [-6.0, 0.07, 2.22, 2.42],
      [-6.1, 0.01, 2.31, 2.33],
    ].map(([z, w, b, t]) => ({
      z,
      points: Array.from({ length: 12 }, (_, i) => [
        Math.sin((i * Math.PI) / 6) * w,
        (b + t) / 2 + (Math.cos((i * Math.PI) / 6) * (t - b)) / 2,
      ]),
    })),
    paint,
  );
  beveledBox(d, [0.05, 0.62, 0.46], [0, 1.8, -5.62], paint, 0.015);
  // Fixed starboard refuelling probe and paired passive optical housings ahead of windscreen.
  d.rod([-0.38, 2.45, 5.78], [-0.52, 2.91, 6.12], 0.045, paint);
  d.rod([-0.52, 2.91, 6.12], [-0.52, 2.96, 6.67], 0.035, paint);
  d.rod([-0.52, 2.96, 6.67], [-0.52, 2.96, 6.82], 0.034, metal);
  for (const x of [-0.17, 0.17]) {
    beveledBox(d, [0.16, 0.12, 0.22], [x, 2.47, 6.15], paint, 0.03);
    d.add(new T.CircleGeometry(0.055, 16), glass, [x, 2.49, 6.264]);
  }
  // National markings are livery decals (liveries/aircraft/rafale-c.mjs): operators differ.
  for (const [name, x, z, r, w, top] of [
    ['left', 1.42, -1.34, 0.38, 0.25, 1.23],
    ['right', -1.42, -1.34, 0.38, 0.25, 1.23],
    ['nose', 0, 3.43, 0.195, 0.13, 1.36],
  ]) {
    const g = group(root, `Rafale-gear-${name}`, [x, top, z]),
      gd = detailKit(g, g.name);
    // Main legs rake outboard from bays under the intake fairings (head-on photograph).
    const inboard = name === 'nose' ? 0 : -Math.sign(x) * 0.27;
    gd.rod([inboard, 0, -0.12], [0, r - top, 0], 0.04, metal);
    gd.rod([inboard * 0.9, -0.12, -0.42], [0, r - top + 0.14, 0], 0.024, metal);
    if (name !== 'nose') {
      // Torque-link scissor ahead of the oleo, clear of the tyre.
      const leg = (f) => [inboard * (1 - f), (r - top) * f, -0.12 * (1 - f)],
        knee = [inboard * 0.55, (r - top) * 0.44, 0.1];
      gd.rod(leg(0.32), knee, 0.013, metal);
      gd.rod(knee, leg(0.52), 0.013, metal);
    }
    const offsets = name === 'nose' ? [-0.1, 0.1] : [0];
    for (const off of offsets) {
      gd.add(new T.CylinderGeometry(r, r, w, 24).rotateZ(Math.PI / 2), seal, [off, r - top, 0]);
      gd.add(
        new T.CylinderGeometry(r * 0.53, r * 0.53, w + 0.012, 20).rotateZ(Math.PI / 2),
        metal,
        [off, r - top, 0],
      );
    }
    gd.box(
      [0.025, 0.5, 0.54],
      name === 'nose' ? [0.18, -0.15, -0.12] : [inboard * 0.6, -0.2, -0.12],
      paint,
    );
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
  const { stations: controlStations, ...interior } = rafaleCockpit(root, { metal, glass });
  Object.assign(interior.derived, {
    pitchDeflection: { op: 'multiply', args: ['pitchInput', 0.28] },
    rollDeflection: { op: 'multiply', args: ['rollInput', 0.24] },
    elevonLeft: { op: 'subtract', args: ['pitchDeflection', 'rollDeflection'] },
    elevonRight: { op: 'add', args: ['pitchDeflection', 'rollDeflection'] },
  });
  cleanGeometry(root);
  return {
    root,
    frame: { ...rafaleFrame(), controlStations },
    enginePoints: [
      { id: 'engine-1', position: [0.61, 1.92, -5.4] },
      { id: 'engine-2', position: [-0.61, 1.92, -5.4] },
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

function rafaleCockpit(root, m) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'Rafale-cabin'),
    ins = instrumentGeometry(cabin, 'Rafale'),
    { bindings, derived, ink, black, amber } = ins;
  // Panel, consoles and tub are near-black neutral gray in the Rafale C cockpit photographs
  // (Flickr 9248863866, EC 1/7 dusk photograph), not the blue slate they were.
  const panel = mat('Rafale-panel', '#3c4043', { side: T.DoubleSide }),
    button = mat('Rafale-key', '#2a2e30'),
    green = mat('Rafale-display', '#89d79c', { emissive: '#27563b', emissiveIntensity: 0.6 }),
    seat = mat('Rafale-cushion', '#343d38'),
    belt = mat('Rafale-harness', '#636c64');
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
  const z = 4.92,
    rect = (x, y, w, h, dz = 0) =>
      [
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
      ].map(([u, v]) => [x + u * w, y + v * h, z + dz]),
    txt = (t, x, y, h = 0.008, color = ink, dz = -0.03) =>
      d.text(t, [x, y, z + dz], h, Math.PI, color);
  // The shoulders stay 1.5 cm inside the canopy base (x 0.415 at the panel plane); at 0.43 the
  // corners and their black rim stood out through the sill beside the windscreen.
  const edge = [
    [-0.41, 2.27],
    [-0.4, 2.52],
    [-0.32, 2.69],
    [-0.17, 2.72],
    [0.17, 2.72],
    [0.32, 2.69],
    [0.4, 2.52],
    [0.41, 2.27],
    [0.14, 2.27],
    [0.1, 2.03],
    [-0.1, 2.03],
    [-0.14, 2.27],
  ];
  sheet(
    d,
    edge.map((p) => [...p, z]),
    panel,
    [0, 0, -1],
    [rect(0.236, 2.57, 0.093, 0.068), rect(0, 2.51, 0.31, 0.32), rect(-0.355, 2.36, 0.052, 0.042)],
  );
  outline(
    d,
    edge.map((p) => [...p, z - 0.004]),
    0.009,
    black,
  );
  for (let i = 0; i < 7; i++) {
    const a = edge[i],
      b = edge[i + 1];
    quad(
      d,
      [...a, z],
      [...b, z],
      [b[0] * 0.74, b[1] - 0.02, z + 0.32],
      [a[0] * 0.74, a[1] - 0.02, z + 0.32],
      button,
      [0, 1, 0],
    );
  }
  // Deep central optical housing; rendered flight page is explicitly a simulator substitute.
  const hld = group(cabin, 'Rafale-HLD', [0, 2.51, z - 0.11]),
    od = detailKit(hld, hld.name),
    oi = instrumentGeometry(hld, 'Rafale-HLD'),
    displayRect = (w, h, depth) =>
      [
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
      ].map(([x, y]) => [x * w, y * h, depth]);
  hld.rotation.x = 0.38;
  const front = displayRect(0.306, 0.32, 0),
    back = displayRect(0.254, 0.254, 0.13);
  const rim = front.map((p) =>
      new T.Vector3(...p).applyEuler(hld.rotation).add(hld.position).toArray(),
    ),
    aperture = rect(0, 2.51, 0.31, 0.32);
  for (let i = 0; i < 4; i++)
    quad(d, rim[i], aperture[i], aperture[(i + 1) % 4], rim[(i + 1) % 4], button, [0, 0, -1]);
  for (let i = 0; i < 4; i++)
    quad(od, front[i], back[i], back[(i + 1) % 4], front[(i + 1) % 4], black, [0, 0, -1]);
  outline(od, front, 0.009, panel);
  sheet(od, back, black, [0, 0, -1]);
  const hg = group(hld, 'Rafale-heading', [0, 0, 0.12]),
    hd = detailKit(hg, hg.name);
  for (let i = 0; i < 72; i++) {
    const a = (i * Math.PI) / 36,
      p = (r) => [-Math.sin(a) * r, Math.cos(a) * r, 0];
    hd.rod(p(i % 6 ? 0.086 : 0.079), p(0.092), 0.0008, green);
    if (i % 6 === 0) hd.text(String(i / 2), p(0.065), 0.01, Math.PI, green);
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
  od.text('NAV / SIM', [0, 0.107, 0.115], 0.008, Math.PI, green);
  od.text('TRUE', [0, -0.003, 0.115], 0.008, Math.PI, green, 'display');
  od.text('FPM', [0, -0.106, 0.115], 0.007, Math.PI, green);
  oi.readout('vertical-speed', [0, -0.123, 0.115], 'verticalFpm', 5, 0.01, green, true, true);
  od.rod([0, 0.1, 0.114], [0, 0.089, 0.114], 0.0015, ink);
  od.finish();
  bindings.push(...oi.bindings);
  Object.assign(derived, oi.derived);
  for (const side of [-1, 1]) {
    const x = side * 0.236;
    sheet(
      d,
      rect(x, 2.565, 0.175, 0.174, -0.009),
      button,
      [0, 0, -1],
      side === 1 ? [rect(x, 2.57, 0.093, 0.068, -0.009)] : [],
    );
    sheet(
      d,
      rect(x, 2.565, 0.127, 0.127, -0.015),
      black,
      [0, 0, -1],
      side === 1 ? [rect(x, 2.57, 0.093, 0.068, -0.015)] : [],
    );
    for (let j = 0; j < 5; j++)
      d.box([0.013, 0.011, 0.004], [x - 0.058 + j * 0.029, 2.489, z - 0.02], black);
    for (const u of [-1, 1])
      d.add(new T.CylinderGeometry(0.009, 0.009, 0.012, 12).rotateX(Math.PI / 2), panel, [
        x + u * 0.077,
        2.49,
        z - 0.024,
      ]);
  }
  ins.horizon('attitude', [0.236, 2.57, z + 0.01], 0.091, 0.066, { blankBackdrop: true });
  txt('FLIGHT / SIM', 0.236, 2.618, 0.006, green);
  txt('TAS', 0.265, 2.523, 0.005, green);
  ins.readout('speed', [0.265, 2.511, z - 0.028], 'knots', 3, 0.007, green);
  txt('GEO FT', 0.203, 2.523, 0.005, green);
  ins.readout('altitude', [0.203, 2.511, z - 0.028], 'feet', 5, 0.006, green, true, true);
  txt('SYSTEMS', -0.236, 2.601, 0.008, green);
  txt('ENG --', -0.236, 2.572, 0.009, amber);
  txt('FUEL --', -0.236, 2.548, 0.008, amber);
  txt('SENSORS INOP', -0.236, 2.522, 0.006, amber);
  // Standby and side strips shown in the manufacturer's early cockpit photograph.
  sheet(
    d,
    rect(-0.355, 2.36, 0.077, 0.068, -0.01),
    black,
    [0, 0, -1],
    [rect(-0.355, 2.36, 0.052, 0.042, -0.01)],
  );
  ins.horizon('standby-attitude', [-0.355, 2.36, z + 0.01], 0.05, 0.04, { blankBackdrop: true });
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const x = side * (0.335 + (i % 2) * 0.03),
        y = 2.62 - Math.floor(i / 2) * 0.045;
      d.box([0.023, 0.019, 0.006], [x, y, z - 0.018], black);
      txt(['COM', 'NAV', 'SYS', 'TEST', 'LTS'][i], x, y, 0.0045);
    }
    for (let i = 0; i < 3; i++) {
      d.add(new T.CylinderGeometry(0.016, 0.017, 0.014, 16).rotateX(Math.PI / 2), button, [
        side * 0.405,
        2.48 - i * 0.042,
        z - 0.022,
      ]);
    }
  }
  // The keypad sits on the lower left of the panel, under the left display and clear of the
  // gear lamp.
  const lower = group(cabin, 'Rafale-lower-control-panel', [0.265, 2.375, z - 0.022]),
    ld = detailKit(lower, lower.name);
  lower.scale.setScalar(0.85);
  beveledBox(ld, [0.2, 0.22, 0.04], [0, 0, 0], button, 0.008);
  for (let i = 0; i < 4; i++)
    ld.box([0.024, 0.012, 0.004], [-0.06 + i * 0.04, 0.08, -0.024], black);
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 3; col++) {
      ld.box([0.025, 0.021, 0.006], [-0.048 + col * 0.048, 0.025 - row * 0.037, -0.024], panel);
      ld.text(
        String(row * 3 + col + 1),
        [-0.048 + col * 0.048, 0.025 - row * 0.037, -0.029],
        0.008,
        Math.PI,
        ink,
      );
    }
  ld.finish();
  // Wide chamfered HUD glass with two supports. No falsely collimated painted flight marks.
  const hud = group(cabin, 'Rafale-HUD', [0, 2.72, 4.83]),
    ud = detailKit(hud, hud.name);
  hud.rotation.x = -0.12;
  const hc = [
    [-0.17, 0, 0],
    [-0.21, 0.25, 0],
    [-0.13, 0.37, 0],
    [0.13, 0.37, 0],
    [0.21, 0.25, 0],
    [0.17, 0, 0],
  ];
  sheet(ud, hc, m.glass, [0, 0, -1]);
  // A hairline edge: the combiner has no frame of its own, only the two posts.
  outline(ud, hc, 0.0012, button);
  for (const side of [-1, 1])
    ud.rod([side * 0.15, -0.12, -0.15], [side * 0.17, 0.02, 0], 0.012, button);
  // Put the projector forward of the panel, under the windscreen coaming.
  // A housing below the combiner's rear edge obscures the HLD from the pilot eye.
  beveledBox(ud, [0.27, 0.07, 0.26], [0, -0.025, 0.29], black, 0.01);
  ud.finish();
  // Floor, front bulkhead and side walls stay inside the forebody and below the sill bridges;
  // full-width boxes used to show through the belly and along the canopy rail.
  d.box([0.56, 0.04, 1.88], [0, 1.48, 4.07], panel);
  sheet(
    d,
    [
      [-0.3, 1.55],
      [0.3, 1.55],
      [0.42, 1.75],
      [0.45, 2.09],
      [-0.45, 2.09],
      [-0.42, 1.75],
    ].map(([x, y]) => [x, y, 5.16]),
    panel,
    [0, 0, -1],
  );
  // Fit: dark liners follow the skin from the floor up to the canopy sill, the console tops and the
  // floor run out to them and a bulkhead closes the nose ahead of the pedals, so no painted skin
  // shows beside the consoles, around the panel or along the sill (it did all round the old
  // sloped side walls).
  sillLiner(d, root, {
    zFrom: 3.4,
    zTo: 5.17,
    yFrom: 1.47,
    yTo: 2.55,
    material: panel,
    zSteps: 20,
    inset: 0.02,
  });
  consoleShelf(d, root, {
    zFrom: 3.38,
    zTo: 4.72,
    y: 2.005,
    x: 0.47,
    material: panel,
    inset: 0.025,
  });
  consoleShelf(d, root, {
    zFrom: 3.4,
    zTo: 5.17,
    y: 1.498,
    x: 0.27,
    material: panel,
    steps: 10,
    inset: 0.025,
  });
  cockpitBulkhead(d, root, { z: 5.17, yFrom: 1.47, yTo: 2.42, material: panel });
  // Below the head-level display (Rafale C, redskin83 on Flickr; Rafale B front seat, Gilles
  // Galvao for Master194): a wide faceted box right under the HLD, its black face with three small
  // knobs along the top and a recessed plate, then the housing narrowing between the knees to a
  // thin silver bar and a small grille, a near-black knee well either side.
  beveledBox(d, [0.235, 0.15, 0.155], [0, 2.272, 4.8425], button, 0.012);
  d.box([0.205, 0.122, 0.004], [0, 2.268, 4.7635], black);
  for (const x of [-0.055, 0, 0.055])
    d.add(new T.CylinderGeometry(0.0065, 0.0065, 0.01, 12).rotateX(Math.PI / 2), panel, [
      x,
      2.316,
      4.758,
    ]);
  d.box([0.12, 0.05, 0.003], [0, 2.24, 4.761], panel);
  beveledBox(d, [0.165, 0.22, 0.13], [0, 2.09, 4.85], button, 0.012);
  beveledBox(d, [0.13, 0.34, 0.1], [0, 1.81, 4.9], button, 0.01);
  d.add(bar([-0.085, 1.975, 4.779], [0.085, 1.975, 4.779], 0.0045, 12), m.metal);
  d.box([0.01, 0.022, 0.006], [0, 1.958, 4.782], m.metal);
  d.box([0.09, 0.05, 0.004], [0, 1.915, 4.848], black);
  for (let i = 0; i < 4; i++) d.box([0.08, 0.003, 0.004], [0, 1.897 + i * 0.012, 4.845], panel);
  for (const side of [-1, 1])
    sheet(
      d,
      [
        [side * 0.07, 1.6, 5.152],
        [side * 0.27, 1.6, 5.152],
        [side * 0.27, 2.27, 5.152],
        [side * 0.07, 2.27, 5.152],
      ],
      black,
      [0, 0, -1],
    );
  // The side-stick and the throttle stand high, on raised blocks at the front of the side
  // consoles, just under the canopy sill (FlightGlobal flight test; Rafale C cockpit photograph):
  // the stick's on the right, the throttle quadrant's on the left, both outboard of the seat.
  beveledBox(d, [0.11, 0.195, 0.27], [-0.335, 2.1025, 4.43], button, 0.01);
  beveledBox(d, [0.11, 0.185, 0.3], [0.335, 2.0975, 4.4], button, 0.01);
  d.box([0.07, 0.004, 0.11], [0.32, 2.191, 4.37], black);
  for (const side of [-1, 1]) {
    d.box([0.2, 0.15, 1.35], [side * 0.37, 1.93, 4.05], panel);
    const g = group(cabin, `Rafale-console-${side}`, [side * 0.37, 2.01, 4.03]);
    g.rotation.x = Math.PI / 2;
    const gd = detailKit(g, g.name);
    for (const [i, label] of (side === 1
      ? ['FUEL', 'START', 'COMM', 'POWER']
      : ['LIGHT', 'CANOPY', 'OXY', 'ECS']
    ).entries()) {
      const v = 0.47 - i * 0.29;
      gd.box([0.18, 0.26, 0.008], [0, v, 0], panel);
      outline(
        gd,
        [
          [-0.087, v - 0.125, -0.006],
          [0.087, v - 0.125, -0.006],
          [0.087, v + 0.125, -0.006],
          [-0.087, v + 0.125, -0.006],
        ],
        0.0015,
        black,
      );
      gd.text(label, [0, v + 0.085, -0.009], 0.008, Math.PI, ink);
      // The START and CANOPY plates carry stations (end of this function).
      const station = i === 1;
      for (const x of [-0.05, 0.05]) {
        if (!station) {
          gd.add(new T.CylinderGeometry(0.009, 0.01, 0.01, 16).rotateX(Math.PI / 2), black, [
            x,
            v - 0.04,
            -0.009,
          ]);
          gd.add(bar([x, v + 0.015, -0.004], [x, v + 0.022, -0.02], 0.0016, 10, 0.0024), m.metal);
        }
        for (const y of [-0.112, 0.112])
          gd.add(new T.CircleGeometry(0.003, 6).rotateY(Math.PI), black, [x * 1.5, v + y, -0.007]);
      }
    }
    gd.finish();
    // The lower panel strip beside each knee, from under the side screens down to the console
    // (Rafale C photograph, redskin83; Rafale B front seat, Master194): black faceplates with
    // white legends. Face-local y runs up the strip, x is the body's x.
    const front = group(cabin, `Rafale-front-console-${side}`, [side * 0.335, 2.135, 4.84]);
    front.rotation.x = 0.22;
    const fd = detailKit(front, front.name),
      FP = partPalette(),
      face = -0.0125,
      plateAt = (v, h) => fd.box([0.148, h, 0.003], [0, v, face - 0.0015], black),
      write = (label, u, v, size = 0.0055) =>
        fd.text(label, [u, v, face - 0.0035], size, Math.PI, ink),
      pushButton = (u, v, r, material) =>
        fd.add(new T.CylinderGeometry(r, r, 0.008, 16).rotateX(Math.PI / 2), material, [
          u,
          v,
          face - 0.004,
        ]),
      stripes = (u, v, w) => {
        for (const k of [-1, 0, 1])
          fd.add(
            place(
              new T.BoxGeometry(w * 0.16, w, 0.002),
              [u + k * w * 0.32, v, face - 0.0085],
              [0, 0, 0.7],
            ),
            FP.black,
          );
      };
    beveledBox(fd, [0.16, 0.28, 0.025], [0, 0, 0], button, 0.006);
    if (side === 1) {
      // STORES jettison: the big yellow striped push button and its selector.
      plateAt(0.105, 0.055);
      pushButton(-0.022, 0.102, 0.017, FP.yellow);
      stripes(-0.022, 0.102, 0.022);
      fd.add(new T.CylinderGeometry(0.007, 0.007, 0.012, 12).rotateX(Math.PI / 2), FP.black, [
        0.045,
        0.1,
        face - 0.006,
      ]);
      write('STORES', 0.04, 0.122, 0.0045);
      // Gear, hook and refuelling probe: the gear lever's slot inboard, a square indicator, the
      // HOOK switch under its striped cover outboard, the probe switch under them.
      plateAt(0.022, 0.1);
      fd.box([0.01, 0.06, 0.002], [-0.042, 0.03, face - 0.0035], FP.black);
      fd.box([0.016, 0.01, 0.01], [-0.042, 0.066, face - 0.005], FP.black);
      fd.box([0.022, 0.02, 0.004], [0, 0.04, face - 0.004], panel);
      fd.box([0.024, 0.024, 0.006], [0.045, 0.04, face - 0.005], FP.yellow);
      stripes(0.045, 0.04, 0.02);
      write('HOOK', 0.045, 0.06, 0.0045);
      fd.add(bar([0, -0.004, face - 0.002], [0, 0.004, face - 0.018], 0.0018, 10), m.metal);
      write('RFL', 0.02, -0.004, 0.0045);
      // Electrical and flight-control restart selector.
      plateAt(-0.052, 0.045);
      fd.add(new T.CylinderGeometry(0.01, 0.011, 0.012, 14).rotateX(Math.PI / 2), FP.black, [
        0,
        -0.055,
        face - 0.006,
      ]);
      for (const u of [-0.045, 0.045])
        fd.box([0.016, 0.016, 0.005], [u, -0.045, face - 0.004], panel);
      // Auxiliary engine control: two small red-capped levers, IDLE / STOP.
      plateAt(-0.11, 0.05);
      for (const u of [-0.012, 0.012]) {
        fd.add(bar([u, -0.12, face - 0.002], [u, -0.1, face - 0.014], 0.0022, 10), m.metal);
        fd.add(place(roundedBox([0.008, 0.012, 0.008], 0.002), [u, -0.098, face - 0.016]), FP.red);
      }
      write('IDLE STOP', 0.0, -0.133, 0.004);
    } else {
      // The guarded switch at the top (the flap switch station, below) and the framed
      // automatic-recovery button beside it.
      plateAt(0.105, 0.055);
      fd.box([0.026, 0.026, 0.003], [-0.03, 0.1, face - 0.003], FP.yellow);
      fd.box([0.018, 0.018, 0.005], [-0.03, 0.1, face - 0.0045], FP.black);
      // Two small square standby screens, one above the other.
      for (const v of [0.045, -0.015]) {
        fd.box([0.062, 0.054, 0.006], [0, v, face - 0.003], FP.black);
        fd.box([0.048, 0.04, 0.002], [0, v, face - 0.0065], button);
      }
      plateAt(-0.11, 0.05);
    }
    fd.finish();
  }
  // F16F seat: large black headbox, angular side shells, separated cushions and harness straps.
  const sg = group(cabin, 'Rafale-F16F', [0, 2.11, 4.25]);
  sg.rotation.x = -0.5;
  const sd = detailKit(sg, sg.name);
  beveledBox(sd, [0.46, 0.14, 0.52], [0, 0, 0.17], seat);
  beveledBox(sd, [0.42, 0.72, 0.14], [0, 0.4, -0.1], seat);
  beveledBox(sd, [0.35, 0.31, 0.21], [0, 0.95, -0.13], black, 0.015);
  for (const side of [-1, 1]) {
    sd.rod([side * 0.25, -0.1, -0.21], [side * 0.25, 1.11, -0.21], 0.021, m.metal);
    sd.box([0.05, 0.2, 0.48], [side * 0.25, 0.04, 0.16], black);
    sheet(
      sd,
      [
        [side * 0.1, 0.73, -0.015],
        [side * 0.15, 0.73, -0.015],
        [side * 0.1, 0.11, 0.13],
        [side * 0.05, 0.11, 0.13],
      ],
      belt,
      [0, 0, 1],
    );
    sheet(
      sd,
      [
        [side * 0.23, 0.07, 0.31],
        [side * 0.23, 0.12, 0.36],
        [0, 0.13, 0.19],
        [0, 0.08, 0.14],
      ],
      belt,
      [0, 1, 1],
    );
    beveledBox(sd, [0.065, 0.08, 0.045], [side * 0.12, 0.67, 0.02], m.metal, 0.007);
  }
  sd.add(
    new T.CylinderGeometry(0.034, 0.034, 0.014, 16).rotateX(Math.PI / 2),
    m.metal,
    [0, 0.12, 0.2],
  );
  sd.ring(0.049, 0.008, [0, 0.13, 0.39], amber);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    sd.add(new T.SphereGeometry(0.0085, 6, 4), black, [
      Math.sin(a) * 0.049,
      0.13 + Math.cos(a) * 0.049,
      0.39,
    ]);
  }
  sd.finish();
  const stick = group(cabin, 'Rafale-stick', [-0.31, 2.02, 4.38]),
    st = detailKit(stick, stick.name);
  // The grip stands on its raised block, 2.5 cm outboard of the pivot, clear of the seat shell.
  rafaleStickGeometry({ add: (g, material) => st.add(place(g, [-0.025, 0.18, 0]), material) });
  st.add(bar([-0.025, 0, 0], [-0.025, 0.183, 0], 0.017, 14), partPalette().black);
  st.finish();
  bindings.push(
    { node: stick.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.12 },
    { node: stick.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.1 },
  );
  for (let i = 0; i < 2; i++) {
    const g = group(cabin, `Rafale-throttle-${i}`, [0.29 + i * 0.06, 2.02, 4.37]),
      gd = detailKit(g, g.name);
    // The Rafale's single throttle grip, split between the two engine levers: each lever carries
    // the half of the grip toward the other, so together they read as one handle.
    rafaleThrottleGeometry(gd, i === 1 ? 1 : -1, 0.19);
    gd.finish();
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
    d.box([0.13, 0.055, 0.27], [side * 0.32, 2.02, 4.03], black);
    const g = group(cabin, `Rafale-pedal-${side}`, [side * 0.15, 1.66, 4.96]),
      gd = detailKit(g, g.name);
    pedalGeometry(gd, { style: 'fighter', side, drop: 0.08, scale: 1.02, lean: 0.28 });
    gd.finish();
    bindings.push({
      node: g.name,
      source: 'yawInput',
      property: 'position',
      axis: 'z',
      scale: -side * 0.06,
    });
  }
  {
    // Mounted on the left strip, so it pivots in the strip's own tilted frame.
    const strip = cabin.getObjectByName('Rafale-front-console-1'),
      gear = group(strip, 'Rafale-gear-handle', [-0.042, 0.036, -0.0125]);
    gear.userData.aircraftControl = {
      action: 'gear',
      motion: { property: 'rotation', axis: 'x', scale: -0.7, offset: 0.35 },
    };
    const gk = detailKit(gear, gear.name),
      GP = partPalette();
    gk.add(bar([0, 0, 0], [0, 0, -0.026], 0.0042, 12), GP.alloy);
    for (const x of [-0.0048, 0.0048])
      gk.add(
        place(
          new T.CylinderGeometry(0.0125, 0.0125, 0.0045, 20),
          [x, 0, -0.034],
          [0, 0, Math.PI / 2],
        ),
        GP.red,
      );
    gk.add(
      place(new T.CylinderGeometry(0.006, 0.006, 0.006, 12), [0, 0, -0.034], [0, 0, Math.PI / 2]),
      GP.alloy,
    );
    gk.finish();
  }
  {
    // Parking brake handle (AzurPoly Rafale manual, right-console figure, item 16 "Parking Brake
    // Handle"; Rafale B front cockpit photographs, Gilles Galvao/Master194): an unlabelled dark
    // grey grip with finger grooves, lying across a well at the inboard edge of the right console
    // directly inboard of the canopy switch, against the seat. It hangs on a tube that runs aft
    // under the console's inboard lip. No source shows how it moves; here it is hinged on that
    // tube and lifts its outboard end to set the brake.
    const KP = partPalette(),
      hinge = [-0.272, 2.012, 4.232];
    // The well's fore and aft cheeks, and the tube aft to its bracket under the lip.
    for (const dz of [-0.026, 0.026])
      d.box([0.112, 0.016, 0.006], [-0.33, 2.022, 4.232 + dz], black);
    d.add(bar([-0.265, 2.0, 4.215], [-0.265, 2.0, 3.99], 0.0055, 10), KP.grip);
    d.box([0.016, 0.022, 0.014], [-0.262, 1.996, 3.985], black);
    const park = group(cabin, 'Rafale-park-brake', hinge);
    park.userData.aircraftControl = {
      action: 'brake',
      motion: { property: 'rotation', axis: 'z', scale: -0.55 },
    };
    const pk = detailKit(park, park.name);
    pk.add(bar([0, 0, -0.019], [0, 0, 0.019], 0.009, 14), KP.grip);
    pk.add(place(roundedBox([0.094, 0.024, 0.034], 0.008), [-0.06, 0.016, 0]), KP.panel);
    // Four finger grooves across the grip's aft face and a worn end cap outboard.
    for (let i = 0; i < 4; i++)
      pk.add(
        place(new T.BoxGeometry(0.009, 0.016, 0.004), [-0.03 - i * 0.017, 0.016, -0.0165]),
        KP.tread,
      );
    pk.add(place(roundedBox([0.012, 0.026, 0.036], 0.005), [-0.106, 0.016, 0]), KP.steel);
    pk.finish();
  }
  const lamp = group(cabin, 'Rafale-gear-lamp', [0.395, 2.3, z - 0.03]),
    gp = detailKit(lamp, lamp.name);
  gp.box([0.014, 0.012, 0.003], [0, 0, 0], green);
  gp.finish();
  bindings.push({
    node: lamp.name,
    source: 'gearDown',
    property: 'visible',
    scale: 1,
    missing: 'hide',
  });
  txt('GEAR', 0.395, 2.28, 0.006);
  d.finish();
  // Where the controls are (cockpit sources in reference-review.json and the lower-panel
  // photographs above): the gear lever on the left lower strip (modelled above), a flap switch at
  // the foot of the right strip, the parking brake on the right console beside the seat, the
  // airbrake on the throttle grip, the engine master and start switches behind the throttle on
  // the left console, the canopy handle on the right.
  const frontAt = (side, u, v) => {
      const a = 0.22;
      return [
        side * 0.335 + u,
        2.135 + v * Math.cos(a) + 0.0155 * Math.sin(a),
        4.84 + v * Math.sin(a) - 0.0155 * Math.cos(a),
      ];
    },
    tilt = [0.22, 0, 0],
    top = [Math.PI / 2, 0, 0],
    plate = (side, dx) => [side * 0.37 + dx, 2.0145, 4.03 + 0.47 - 0.29 + 0.02];
  const stations = [
    {
      action: 'flaps',
      style: 'guarded',
      scale: 0.9,
      at: frontAt(-1, 0.038, 0.098),
      rotation: tilt,
      label: 'FLAPS',
      labelAt: [0, 0.024, -0.002],
      labelHeight: 0.0045,
    },
    {
      action: 'speedBrake',
      style: 'slider',
      parent: 'Rafale-throttle-1',
      at: [0.338, 2.3485, 4.356],
      rotation: [Math.PI / 2, 0, 0],
    },
    {
      action: 'engine',
      style: 'guarded',
      at: plate(1, -0.005),
      rotation: top,
      label: 'START',
      labelAt: [0, 0.03, -0.002],
    },
    {
      action: 'engine',
      engine: 0,
      style: 'guarded',
      at: plate(1, 0.075),
      rotation: top,
      label: 'ENG L',
      labelAt: [0, 0.03, -0.002],
    },
    {
      action: 'engine',
      engine: 1,
      style: 'guarded',
      at: plate(1, 0.035),
      rotation: top,
      label: 'ENG R',
      labelAt: [0, 0.03, -0.002],
    },
    {
      action: 'canopy',
      style: 'canopy',
      at: plate(-1, -0.045),
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
/** Rafale side-stick (right console): a short pistol grip on a wide fixed base, its head canted
 * forward over the trigger, the thumb switches on the inboard (+X) flank. */
function rafaleStickGeometry(d) {
  const P = partPalette();
  d.add(
    lathe(
      [
        [0, 0],
        [0.05, 0],
        [0.05, 0.012],
        [0.044, 0.02],
        [0.03, 0.026],
        [0, 0.026],
      ],
      20,
    ),
    P.steel,
  );
  d.add(
    lathe(
      [
        [0, 0.024],
        [0.026, 0.024],
        [0.022, 0.036],
        [0.016, 0.044],
        [0.014, 0.052],
        [0, 0.052],
      ],
      18,
      28,
    ),
    P.tread,
  );
  const mount = (g) => place(g, [0, 0.048, 0], [0.22, 0, -0.08]);
  const rows = [
    [0, 0.002, 0.016, 0.019, 2.3],
    [0.03, 0.005, 0.019, 0.024, 2.3],
    [0.065, 0.008, 0.02, 0.025, 2.4],
    [0.088, 0.014, 0.022, 0.03, 2.6],
    [0.103, 0.018, 0.021, 0.031, 2.7],
    [0.11, 0.018, 0.013, 0.02, 2.4],
  ];
  d.add(
    mount(loftUp(rows.map(([y, cz, rx, rz, p]) => ({ y, points: contour(0, cz, rx, rz, 18, p) })))),
    P.grip,
  );
  d.add(
    mount(
      tube(
        [
          [0, 0.075, 0.034],
          [0, 0.066, 0.045],
          [0, 0.054, 0.04],
        ],
        0.0055,
        10,
      ),
    ),
    P.black,
  );
  d.add(
    mount(place(new T.CylinderGeometry(0.0055, 0.0055, 0.007, 14), [0.004, 0.111, 0.012])),
    P.black,
  );
  d.add(
    mount(place(new T.SphereGeometry(0.004, 10, 6), [0.004, 0.115, 0.012], [0, 0, 0], [1, 0.6, 1])),
    P.black,
  );
  d.add(
    mount(
      place(new T.CylinderGeometry(0.0042, 0.0042, 0.005, 12), [-0.007, 0.109, 0.03], [0.4, 0, 0]),
    ),
    P.red,
  );
  d.add(mount(place(roundedBox([0.006, 0.011, 0.011], 0.002), [0.021, 0.092, 0.006])), P.black);
}
let throttleGray;
const rafaleThrottleGray = () =>
  (throttleGray ??= mat('Rafale-throttle-grip', '#8b9092', { roughness: 0.7 }));
/** One half of the Rafale throttle grip: the lever, and the grip half that leans toward the other
 * lever (`toward` +1 for the outboard half reaching -X, -1 for the inboard half reaching +X),
 * raised `lift` above the pivot so it stands out of the quadrant block. */
function rafaleThrottleGeometry(d0, toward, lift = 0) {
  const P = partPalette(),
    d = { add: (g, material) => d0.add(place(g, [0, lift, 0]), material) };
  d0.add(place(roundedBox([0.011, 0.08 + lift, 0.02], 0.003), [0, (0.08 + lift) / 2, 0]), P.steel);
  const cx = -toward * 0.012;
  const rows = [
    [0.075, cx * 0.5, 0, 0.017, 0.028],
    [0.09, cx, -0.004, 0.022, 0.04],
    [0.112, cx, -0.01, 0.023, 0.046],
    [0.13, cx, -0.014, 0.02, 0.04],
    [0.138, cx, -0.015, 0.012, 0.026],
  ];
  // The grip is a light gray molding with black switches (Rafale C cockpit photograph).
  d.add(
    loftUp(rows.map(([y, x, z, rx, rz]) => ({ y, points: contour(x, z, rx, rz, 16, 2.8) }))),
    rafaleThrottleGray(),
  );
  if (toward > 0) {
    d.add(place(roundedBox([0.009, 0.012, 0.01], 0.002), [0.012, 0.11, -0.05]), P.black);
    d.add(
      place(
        new T.CylinderGeometry(0.005, 0.005, 0.007, 14),
        [0.013, 0.095, -0.032],
        [0, 0, Math.PI / 2],
      ),
      P.black,
    );
    d.add(place(roundedBox([0.012, 0.01, 0.008], 0.002), [-0.004, 0.11, 0.028]), P.black);
  } else
    d.add(
      place(
        new T.CylinderGeometry(0.0045, 0.0045, 0.006, 12),
        [-0.013, 0.1, -0.02],
        [0, 0, Math.PI / 2],
      ),
      P.red,
    );
}
