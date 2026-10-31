/** Rafale C, clean configuration. Reference scope and uncertainty: reference-review.json.
 * Metres, +Z forward, +X pilot left. Geometry authored from separate C photos and B arrangement.
 */
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
  const skin = (side, y, z) => {
    let i = aft.findIndex((a, i) => i < aft.length - 1 && z <= a.z && z >= aft[i + 1].z);
    i = Math.max(0, i);
    const a = aft[i],
      b = aft[i + 1],
      u = (a.z - z) / (a.z - b.z),
      ps = a.points.slice(0, 8).map((p, j) => p.map((v, k) => v + (b.points[j][k] - v) * u));
    let j = ps.findIndex((p, j) => j < ps.length - 1 && y <= p[1] && y >= ps[j + 1][1]);
    if (j < 0) j = ps.length - 2;
    const p = ps[j],
      q = ps[j + 1];
    return [side * (p[0] + ((q[0] - p[0]) * (y - p[1])) / (q[1] - p[1]) + 0.004), y, z];
  };
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
    wing(
      d,
      stations.map((p) => [
        side * p[0],
        p[1],
        p[2] + (p[3] - p[2]) * 0.1,
        p[2] + (p[3] - p[2]) * 0.8,
        p[4],
      ]),
      paint,
    );
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
    // Selected panel boundaries and flush screw lines follow the wing surface.
    for (const f of [0.11, 0.79])
      outline(
        d,
        stations.map((p) => [side * p[0], p[1] + p[4] + 0.003, p[2] + (p[3] - p[2]) * f]),
        0.004,
        seal,
        false,
      );
    for (const x of [2.5, 3.55, 4.4]) {
      const p = mix(a, b, (x - a[0]) / (b[0] - a[0]));
      outline(
        d,
        [
          [side * x, p[1] + p[4] + 0.004, p[2] + (p[3] - p[2]) * 0.2],
          [side * x, p[1] + p[4] + 0.004, p[2] + (p[3] - p[2]) * 0.7],
        ],
        0.003,
        seal,
        false,
      );
    }
    for (const [za, zb, ya, yb] of [
      [0.3, -0.8, 2.17, 1.95],
      [-1, -2.4, 2.35, 2.08],
      [-2.65, -4.4, 2.2, 1.93],
    ]) {
      outline(
        d,
        [
          [ya, za],
          [ya, zb],
          [yb, zb],
          [yb, za],
        ].map(([y, z]) => skin(side, y, z)),
        0.004,
        seal,
      );
      for (let i = 0; i < 10; i++)
        d.add(new T.SphereGeometry(0.003, 5, 3), metal, skin(side, ya, za + ((zb - za) * i) / 10));
    }
  }
  // One swept fin, a separate rudder and the characteristic top sensor fairing.
  const fin = [
    [0, 2.64, -1.65],
    [0, 4.95, -5.6],
    [0, 4.91, -6.25],
    [0, 2.66, -5.04],
  ];
  for (const side of [-1, 1])
    sheet(
      d,
      fin.map((p, i) => [side * (i === 1 || i === 2 ? 0.025 : 0.075), p[1], p[2]]),
      paint,
      [side, 0, 0],
    );
  for (let i = 0; i < 4; i++)
    quad(
      d,
      [0.06, fin[i][1], fin[i][2]],
      [-0.06, fin[i][1], fin[i][2]],
      [-0.06, fin[(i + 1) % 4][1], fin[(i + 1) % 4][2]],
      [0.06, fin[(i + 1) % 4][1], fin[(i + 1) % 4][2]],
      paint,
      [0, 1, 0],
    );
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
    d.rod([side * 0.9, 2.62, -5.1], [side * 0.9, 2.62, -5.62], 0.07, paint);
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
  // French geometric roundels, no copied photographic decals.
  const red = mat('Rafale-roundel-red', '#a34a47'),
    blue = mat('Rafale-roundel-blue', '#3c535f'),
    white = mat('Rafale-roundel-white', '#d1d0c4');
  for (const side of [-1, 1])
    for (const [r, m] of [
      [0.18, red],
      [0.12, white],
      [0.065, blue],
    ])
      d.add(new T.CircleGeometry(r, 32).rotateX(-Math.PI / 2), m, [
        side * 3.25,
        1.88 + (r < 0.18 ? 0.003 : 0) + (r < 0.12 ? 0.003 : 0),
        -2.48,
      ]);
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
  const interior = rafaleCockpit(root, { metal, glass });
  Object.assign(interior.derived, {
    pitchDeflection: { op: 'multiply', args: ['pitchInput', 0.28] },
    rollDeflection: { op: 'multiply', args: ['rollInput', 0.24] },
    elevonLeft: { op: 'subtract', args: ['pitchDeflection', 'rollDeflection'] },
    elevonRight: { op: 'add', args: ['pitchDeflection', 'rollDeflection'] },
  });
  cleanGeometry(root);
  return {
    root,
    frame: rafaleFrame(),
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
  const panel = mat('Rafale-panel', '#4e575b', { side: T.DoubleSide }),
    button = mat('Rafale-key', '#313a3e'),
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
  const edge = [
    [-0.46, 2.27],
    [-0.48, 2.52],
    [-0.32, 2.69],
    [-0.17, 2.72],
    [0.17, 2.72],
    [0.32, 2.69],
    [0.48, 2.52],
    [0.46, 2.27],
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
    [rect(0.236, 2.57, 0.093, 0.068), rect(0, 2.51, 0.31, 0.32), rect(-0.4, 2.36, 0.052, 0.042)],
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
      [b[0] * 0.83, b[1] - 0.02, z + 0.32],
      [a[0] * 0.83, a[1] - 0.02, z + 0.32],
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
    rect(-0.4, 2.36, 0.077, 0.068, -0.01),
    black,
    [0, 0, -1],
    [rect(-0.4, 2.36, 0.052, 0.042, -0.01)],
  );
  ins.horizon('standby-attitude', [-0.4, 2.36, z + 0.01], 0.05, 0.04, { blankBackdrop: true });
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const x = side * (0.365 + (i % 2) * 0.035),
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
  const lower = group(cabin, 'Rafale-lower-control-panel', [0, 2.23, z - 0.16]),
    ld = detailKit(lower, lower.name);
  lower.rotation.x = 0.16;
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
  outline(ud, hc, 0.003, black);
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
  for (const side of [-1, 1]) {
    quad(
      d,
      [side * 0.42, 1.5, 3.18],
      [side * 0.3, 1.5, 5.18],
      [side * 0.42, 2.15, 5.18],
      [side * 0.52, 2.22, 3.18],
      panel,
      [-side, 0, 0],
    );
    d.box([0.2, 0.15, 1.35], [side * 0.37, 1.93, 4.05], panel);
    const g = group(cabin, `Rafale-console-${side}`, [side * 0.37, 2.01, 4.03]);
    g.rotation.x = Math.PI / 2;
    const gd = detailKit(g, g.name);
    for (const [i, label] of (side === 1
      ? ['FUEL', 'START', 'COMM', 'POWER']
      : ['LIGHT', 'ECS', 'OXY', 'CANOPY']
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
      for (const x of [-0.05, 0.05]) {
        gd.add(new T.CylinderGeometry(0.011, 0.011, 0.014, 12).rotateX(Math.PI / 2), black, [
          x,
          v - 0.04,
          -0.014,
        ]);
        gd.rod([x, v + 0.015, -0.01], [x, v + 0.025, -0.028], 0.003, m.metal);
        for (const y of [-0.112, 0.112])
          gd.add(new T.CircleGeometry(0.003, 6).rotateY(Math.PI), black, [x * 1.5, v + y, -0.007]);
      }
    }
    gd.finish();
    const front = group(cabin, `Rafale-front-console-${side}`, [side * 0.36, 2.18, 4.7]);
    front.rotation.x = 0.4;
    const fd = detailKit(front, front.name);
    beveledBox(fd, [0.21, 0.24, 0.025], [0, 0, 0], button, 0.006);
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 3; col++)
        fd.box([0.03, 0.024, 0.005], [-0.055 + col * 0.055, 0.06 - row * 0.052, -0.019], panel);
    fd.finish();
  }
  // F16F seat: large black headbox, angular side shells, separated cushions and harness straps.
  const sg = group(cabin, 'Rafale-F16F', [0, 1.88, 3.64]);
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
  const stick = group(cabin, 'Rafale-stick', [-0.31, 2.02, 4.13]),
    st = detailKit(stick, stick.name);
  st.add(new T.CylinderGeometry(0.045, 0.055, 0.08, 16), black, [0, 0.04, 0]);
  st.rod([0, 0.07, 0], [0, 0.18, -0.02], 0.019, black);
  beveledBox(st, [0.08, 0.13, 0.07], [0, 0.23, -0.02], button, 0.012);
  for (const [x, y] of [
    [-0.025, 0.27],
    [0.025, 0.25],
    [0, 0.2],
  ])
    st.add(new T.CylinderGeometry(0.011, 0.011, 0.008, 10).rotateX(Math.PI / 2), black, [
      x,
      y,
      -0.06,
    ]);
  st.finish();
  bindings.push(
    { node: stick.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.12 },
    { node: stick.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.1 },
  );
  for (let i = 0; i < 2; i++) {
    const g = group(cabin, `Rafale-throttle-${i}`, [0.29 + i * 0.06, 2.02, 4.12]),
      gd = detailKit(g, g.name);
    gd.rod([0, 0, 0], [0, 0.09, 0], 0.012, black);
    beveledBox(gd, [0.055, 0.065, 0.11], [0, 0.12, 0], black, 0.009);
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
    d.box([0.13, 0.055, 0.27], [side * 0.32, 2.02, 3.75], black);
    const g = group(cabin, `Rafale-pedal-${side}`, [side * 0.15, 1.66, 4.96]),
      gd = detailKit(g, g.name);
    gd.box([0.13, 0.15, 0.025], [0, 0, 0], m.metal);
    for (let i = 0; i < 5; i++) gd.box([0.11, 0.006, 0.006], [0, -0.06 + i * 0.03, -0.016], black);
    gd.finish();
    bindings.push({
      node: g.name,
      source: 'yawInput',
      property: 'position',
      axis: 'z',
      scale: -side * 0.06,
    });
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
  return { nodes: ['cockpit'], sources, derived, bindings };
}
