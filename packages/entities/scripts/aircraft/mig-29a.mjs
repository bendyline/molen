/** MiG-29A 9.12, unarmed. Dimensions and fin cant from GAF T.O. 1F-MIG29-1;
 * sections from the cited three-view, analog cabin from IrasD's period photos.
 * +Y up, +Z forward, +X pilot left. Ground-contact datum.
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

export const mig29Frame = () => ({
  heli: false,
  fighter: true,
  large: false,
  radius: 0.58,
  cy: 2.13,
  ry: 0.52,
  cabinZ: 3.4,
  cabinWidth: 0.88,
  eye: [0, 3.05, 3.4],
  panelZ: 4.2,
  floor: 1.57,
});

export function buildMiG29A(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('MiG29-gray-green', '#a0aaa3', { side: T.DoubleSide }),
    radome = mat('MiG29-radome', '#87938f'),
    upper = mat('MiG29-upper', '#697f73', { side: T.DoubleSide }),
    seam = mat('MiG29-seal', '#384441'),
    dark = mat('MiG29-duct', '#161e1d', { side: T.DoubleSide }),
    metal = mat('MiG29-alloy', '#b2b9b5', { metalness: 0.7 }),
    hot = mat('MiG29-nozzle', '#74766c', { side: T.DoubleSide, metalness: 0.7 }),
    glass = mat('MiG29-glass', '#a2b9b6', {
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.15,
    });
  const d = detailKit(root, 'MiG29-airframe'),
    bindings = [];
  const hinge = (g, axis, dir) => {
    const mount = group(g.parent, `${g.name}-mount`, g.position.toArray());
    mount.quaternion.setFromUnitVectors(new T.Vector3(...axis), new T.Vector3(...dir).normalize());
    const inv = mount.quaternion.clone().invert();
    g.traverse((n) => {
      if (n.isMesh) n.geometry.applyQuaternion(inv);
    });
    mount.add(g);
    g.position.set(0, 0, 0);
  };
  // SVG body: nose x=83, exhaust=973, stabilator trailing edge=1065; 60.32 px/m.
  const noseZ = 8.14,
    px = 60.32,
    z = (u) => noseZ - (u - 83) / px,
    y = (v) => 4.73 - (v - 12) / px;
  const sections = [
    [83, 0.005, 190, 191],
    [110, 0.16, 177, 197],
    [150, 0.31, 161, 204],
    [193, 0.43, 152, 202],
    [262, 0.49, 139, 200],
    [310, 0.51, 133, 198],
    [408, 0.5, 124, 197],
    [445, 0.48, 127, 195],
    [550, 0.47, 141, 197],
    [650, 0.4, 152, 199],
    [743, 0.3, 158, 201],
    [840, 0.2, 169, 204],
    [930, 0.04, 179, 208],
  ];
  const rings = sections.map(([u, w, top, bottom]) => ({
    z: z(u),
    points: Array.from({ length: 24 }, (_, j) => {
      const a = (j * Math.PI) / 12;
      return [Math.sin(a) * w, (y(top) + y(bottom)) / 2 + (Math.cos(a) * (y(top) - y(bottom))) / 2];
    }),
  }));
  loft(d, rings.slice(0, 4), radome);
  loft(d, rings.slice(3), paint, {
    caps: false,
    skip: (i, j) => i >= 1 && i < 4 && (j < 4 || j >= 20),
  });
  for (const i of [3, 4, 8, 9])
    outline(
      d,
      rings[i].points.map((q) => [q[0] * 1.004, q[1], rings[i].z]),
      0.003,
      seam,
    );
  d.rod([0, y(191), 8.14], [0, y(197), 9.18], 0.014, metal);
  for (const side of [-1, 1]) {
    d.rod([side * 0.012, y(193), 8.72], [side * 0.065, y(193), 8.65], 0.006, metal);
  }
  const canopy = [
    [262, 0.025, 139, 138],
    [310, 0.35, 132, 103],
    [325, 0.4, 130, 100],
    [365, 0.43, 126, 98],
    [408, 0.39, 124, 104],
    [435, 0.2, 126, 109],
    [445, 0.025, 127, 126],
  ];
  const cr = canopy.map(([u, w, b, t]) => ({
    z: z(u),
    points: Array.from({ length: 17 }, (_, j) => [
      Math.cos((j * Math.PI) / 16) * w,
      y(b) + Math.sin((j * Math.PI) / 16) * (y(t) - y(b)),
    ]),
  }));
  loft(d, cr, glass, { caps: false, skip: (_, j) => j === 16 });
  for (const i of [0, 1, 6])
    outline(
      d,
      cr[i].points.map((q) => [...q, cr[i].z]),
      i === 1 ? 0.024 : 0.018,
      paint,
      false,
    );
  for (const j of [0, 16])
    outline(
      d,
      cr.map((r) => [...r.points[j], r.z]),
      0.024,
      paint,
      false,
    );
  // Continuous inner sills close the gap between the sloping canopy rails and tub.
  for (const side of [-1, 1])
    for (let i = 1; i < cr.length - 1; i++) {
      const a = cr[i],
        b = cr[i + 1],
        j = side === 1 ? 0 : 16;
      quad(
        d,
        [...a.points[j], a.z],
        [...b.points[j], b.z],
        [side * 0.44, 2.42, b.z],
        [side * 0.44, 2.42, a.z],
        paint,
        [-side, 0, 0],
      );
    }
  // Side shoulders join the hollow forebody to the canopy rails.
  for (const side of [-1, 1])
    for (let i = 0; i < 3; i++) {
      const a = rings[4 + i],
        b = rings[5 + i],
        j = side === 1 ? 4 : 20;
      const rail = [
        [0.025, y(139), z(262)],
        [0.35, y(132), z(310)],
        [0.39, y(124), z(408)],
        [0.025, y(127), z(445)],
      ];
      quad(
        d,
        [...a.points[j], a.z],
        [...b.points[j], b.z],
        [side * rail[i + 1][0], rail[i + 1][1], rail[i + 1][2]],
        [side * rail[i][0], rail[i][1], rail[i][2]],
        paint,
        [side, 1, 0],
      );
    }
  for (let j = 0; j < 17; j++)
    d.add(new T.SphereGeometry(0.0038, 5, 3), metal, [
      cr[1].points[j][0],
      cr[1].points[j][1] + 0.014,
      cr[1].z,
    ]);
  // Offset IRST ball ahead of the windscreen, port-side built-in cannon fairing only.
  d.add(new T.SphereGeometry(0.12, 16, 10).scale(1, 0.8, 1), dark, [-0.2, 2.64, z(250)]);
  d.add(new T.SphereGeometry(0.085, 12, 8), glass, [-0.2, 2.65, z(245)]);
  beveledBox(d, [0.25, 0.11, 0.3], [-0.2, 2.55, z(253)], paint, 0.025);
  d.rod([0.67, 2.18, 3.5], [0.67, 2.18, 3.85], 0.038, dark);
  // Broad center lifting body and LERX, with narrow 9.12 spine above it.
  const broad = [
    [270, 0.44, 2.3, 1.65],
    [360, 1.02, 2.38, 1.69],
    [445, 1.44, 2.36, 1.66],
    [550, 1.67, 2.29, 1.66],
    [720, 1.67, 2.13, 1.67],
    [840, 1.5, 2.02, 1.69],
    [920, 1.22, 1.91, 1.73],
    [940, 0.05, 1.88, 1.78],
  ];
  const br = broad.map(([u, w, t, b]) => ({
    z: z(u),
    points: [
      [0, t + 0.07],
      [w * 0.6, t + 0.02],
      [w, t - 0.03],
      [w, t - 0.065],
      [w * 0.6, b],
      [0, b - 0.02],
      [-w * 0.6, b],
      [-w, t - 0.065],
      [-w, t - 0.03],
      [-w * 0.6, t + 0.02],
    ],
  }));
  // Do not lay a center roof across the cockpit aperture: front sections are separate shoulders.
  loft(d, br, paint, { caps: false, skip: (i, j) => i < 3 && (j === 0 || j === 9) });
  for (const side of [-1, 1]) {
    const x = side * 1.15;
    // Rectangular intake lips, aft-sloping lower leading edge, real empty ducts.
    const mouth = [
      [0.64, 2.12, 2.44],
      [1.47, 2.12, 2.44],
      [1.57, 1.13, 1.18],
      [0.72, 1.07, 1.18],
    ].map(([xx, yy, zz]) => [xx * side, yy, zz]);
    const back = [
      [0.64, 2.16, -0.15],
      [1.55, 2.16, -0.15],
      [1.66, 1.03, -0.15],
      [0.66, 0.97, -0.15],
    ].map(([xx, yy, zz]) => [xx * side, yy, zz]);
    for (let j = 0; j < 4; j++) {
      const k = (j + 1) % 4,
        n = new T.Vector3(...mouth[k])
          .sub(new T.Vector3(...mouth[j]))
          .cross(new T.Vector3(...back[j]).sub(new T.Vector3(...mouth[j])))
          .toArray();
      quad(d, mouth[j], mouth[k], back[k], back[j], paint, n);
      quad(
        d,
        mouth[j].map((v, i) => (i === 0 ? v - side * 0.015 : i === 1 ? v + 0.015 : v - 0.015)),
        mouth[k].map((v, i) => (i === 0 ? v - side * 0.015 : i === 1 ? v + 0.015 : v - 0.015)),
        back[k],
        back[j],
        dark,
        n,
      );
    }
    outline(d, mouth, 0.015, paint);
    // Recessed compressor, inaccessible until the open duct is viewed from ahead.
    d.add(new T.CircleGeometry(0.37, 28), dark, [x, 1.74, -0.25]);
    for (let j = 0; j < 20; j++) {
      const a = (j * Math.PI) / 10;
      d.rod(
        [x + Math.sin(a) * 0.12, 1.74 + Math.cos(a) * 0.12, -0.235],
        [x + Math.sin(a + 0.14) * 0.34, 1.74 + Math.cos(a + 0.14) * 0.34, -0.235],
        0.014,
        hot,
      );
    }
    d.add(new T.ConeGeometry(0.09, 0.18, 16).rotateX(Math.PI / 2), metal, [x, 1.74, -0.15]);
    const pods = [
      [0, 0.56, 1.57, 0.61],
      [-1.6, 0.58, 1.57, 0.63],
      [-3.1, 0.57, 1.59, 0.61],
      [-4.55, 0.55, 1.62, 0.55],
      [-5.1, 0.52, 1.63, 0.45],
      [-5.35, 0.48, 1.61, 0.38],
      [-6.61, 0.43, 1.59, 0.31],
    ];
    const pr = pods.map(([zz, r, cy, ry]) => ({
      z: zz,
      points: Array.from({ length: 28 }, (_, j) => [
        x + Math.sin((j * Math.PI) / 14) * r,
        cy + Math.cos((j * Math.PI) / 14) * ry,
      ]),
    }));
    loft(d, pr.slice(0, 5), paint, { caps: false });
    loft(d, pr.slice(4), hot, { caps: false });
    const inner = pr.slice(4).map((r) => ({
      ...r,
      points: r.points.map(([xx, yy]) => [x + (xx - x) * 0.91, 1.61 + (yy - 1.61) * 0.91]),
    }));
    loft(d, inner, dark, { caps: false });
    for (let j = 0; j < 14; j++) {
      const a = (j * Math.PI) / 7;
      d.rod(
        [x + Math.sin(a) * 0.522, 1.63 + Math.cos(a) * 0.452, -5.1],
        [x + Math.sin(a) * 0.433, 1.59 + Math.cos(a) * 0.313, -6.61],
        0.004,
        seam,
      );
    }
    outline(
      d,
      pr.at(-1).points.map((q) => [...q, -6.61]),
      0.012,
      metal,
    );
    d.add(new T.CircleGeometry(0.4, 28).rotateY(Math.PI), dark, [x, 1.59, -5.7]);
    // Upper auxiliary intake louvers: closed flight configuration, no invented intake telemetry.
    for (let j = 0; j < 5; j++) {
      const zz = z(446 + j * 13);
      d.box([0.49, 0.018, 0.18], [side * 0.78, 2.398, zz], dark);
      d.box([0.45, 0.019, 0.135], [side * 0.78, 2.412, zz + 0.014], paint);
    }
    for (const u of [445, 512, 550, 650, 720, 840]) {
      const yy = 2.35 - (u - 445) * 0.001;
      d.rod([side * 0.52, yy, z(u)], [side * 1.42, yy - 0.03, z(u)], 0.003, seam);
    }
  }
  // Swept wings with separately hinged leading slats, inboard flaps and outboard ailerons.
  for (const side of [-1, 1]) {
    const label = side === 1 ? 'left' : 'right',
      stations = [
        [1.6, 2.03, z(552), z(809), 0.1],
        [5.5, 1.88, z(778), z(845), 0.026],
        [5.68, 1.87, z(804), z(848), 0.015],
      ];
    const cut = (q, a, b) => [
      side * q[0],
      q[1],
      q[2] + (q[3] - q[2]) * a,
      q[2] + (q[3] - q[2]) * b,
      q[4] * (b - a),
    ];
    wing(
      d,
      stations.map((q) => cut(q, 0.13, 0.76)),
      paint,
    );
    const surface = (name, ss, a, b, source, scale) => {
      const rr = ss.map((q) => cut(q, a, b)),
        pivot = [rr[0][0], rr[0][1], rr[0][2]],
        g = group(root, `MiG29-${name}-${label}`, pivot),
        gd = detailKit(g, g.name);
      wing(
        gd,
        rr.map((q) => [q[0] - pivot[0], q[1] - pivot[1], q[2] - pivot[2], q[3] - pivot[2], q[4]]),
        paint,
      );
      gd.finish();
      hinge(
        g,
        [1, 0, 0],
        [rr.at(-1)[0] - pivot[0], rr.at(-1)[1] - pivot[1], rr.at(-1)[2] - pivot[2]],
      );
      bindings.push({ node: g.name, source, property: 'rotation', axis: 'x', scale: scale * side });
    };
    // Slat hinge is the aft edge; construct it with reversed chord so the pivot is on that edge.
    const slat = stations.map((q) => [q[0], q[1], q[2] + (q[3] - q[2]) * 0.13, q[2], q[4] * 0.13]);
    surface('slat', slat, 0, 1, 'flapPosition', 0.24);
    const split = [3.38, 1.96, z(655), z(827), 0.06];
    surface('flap', [stations[0], split], 0.76, 1, 'flapPosition', -0.4);
    surface('aileron', [split, stations[1], stations[2]], 0.76, 1, 'rollInput', side * 0.28);
    for (const f of [0.13, 0.76])
      outline(
        d,
        stations.map((q) => [side * q[0], q[1] + 0.015, q[2] + (q[3] - q[2]) * f]),
        0.004,
        seam,
        false,
      );
    // Skin-panel seams and fasteners follow the actual faceted upper wing surface.
    const upperPoint = (span, fraction) => {
      const a = stations.findLast((q) => q[0] <= span) ?? stations[0];
      const b = stations.find((q) => q[0] > span) ?? stations.at(-1);
      const f = a === b ? 0 : (span - a[0]) / (b[0] - a[0]);
      const q = a.map((v, i) => v + (b[i] - v) * f);
      const chordFraction = (fraction - 0.13) / 0.63;
      const lift =
        chordFraction < 0.25
          ? chordFraction / 0.25
          : chordFraction < 0.75
            ? 1 - (0.48 * (chordFraction - 0.25)) / 0.5
            : (0.52 * (1 - chordFraction)) / 0.25;
      return [side * span, q[1] + q[4] * 0.63 * lift + 0.004, q[2] + (q[3] - q[2]) * fraction];
    };
    for (const span of [2.65, 3.8, 5.12]) {
      outline(
        d,
        Array.from({ length: 17 }, (_, i) => upperPoint(span, 0.16 + i * 0.035)),
        0.0025,
        seam,
        false,
      );
      for (let i = 0; i < 16; i++)
        d.add(new T.SphereGeometry(0.003, 5, 3), metal, upperPoint(span + 0.025, 0.17 + i * 0.035));
    }
    for (const f of [0.18, 0.72]) {
      outline(
        d,
        Array.from({ length: 50 }, (_, i) => upperPoint(1.68 + i * 0.079, f)),
        0.0023,
        seam,
        false,
      );
      for (let i = 0; i < 60; i++)
        d.add(new T.SphereGeometry(0.003, 5, 3), metal, upperPoint(1.68 + i * 0.065, f + 0.008));
    }
    // All-moving horizontal tail; published 7.78m total tail span.
    const g = group(root, `MiG29-stabilator-${label}`, [side * 1.48, 1.99, -5.75]),
      gd = detailKit(g, g.name);
    wing(
      gd,
      [
        [0, 0, 0.95, -0.85, 0.065],
        [side * 2.2, -0.04, -1.32, -2.39, 0.025],
        [side * 2.41, -0.04, -1.5, -2.25, 0.015],
      ],
      paint,
    );
    gd.finish();
    bindings.push({
      node: g.name,
      source: side === 1 ? 'tailLeft' : 'tailRight',
      property: 'rotation',
      axis: 'x',
      scale: 1,
    });
    // 6-degree outward-canted twin fins. The rudder rotates around its swept hinge.
    const fg = group(root, `MiG29-fin-${label}`, [side * 1.69, 2.105, -3.91]);
    fg.rotation.z = (-side * Math.PI) / 30;
    loft(
      d,
      [
        [-2.7, 0.02, 2.1, 2.0],
        [-3.5, 0.14, 2.15, 1.82],
        [-5.2, 0.13, 2.14, 1.75],
        [-6.66, 0.055, 2.11, 1.92],
      ].map(([zz, w, t, b]) => ({
        z: zz,
        points: [
          [side * 1.69, t],
          [side * 1.69 + w, (t + b) / 2],
          [side * 1.69, b],
          [side * 1.69 - w, (t + b) / 2],
        ],
      })),
      paint,
    );
    const fd = detailKit(fg, fg.name),
      profile = [
        [0, 0, 1.25],
        [0, 0.55, 0],
        [0, 2.64, -2.24],
        [0, 2.4, -2.77],
        [0, 1.71, -2.77],
        [0, 1.71, -2.27],
        [0, 0.43, -2.02],
        [0, 0.43, -2.74],
        [0, 0, -2.75],
      ];
    for (const sx of [-1, 1])
      sheet(
        fd,
        profile.map(([xx, yy, zz]) => [xx + sx * 0.055, yy, zz]),
        paint,
        [sx, 0, 0],
      );
    for (let j = 0; j < profile.length; j++) {
      const a = profile[j],
        b = profile[(j + 1) % profile.length];
      quad(
        fd,
        [0.055, a[1], a[2]],
        [0.055, b[1], b[2]],
        [-0.055, b[1], b[2]],
        [-0.055, a[1], a[2]],
        paint,
        [0, b[2] - a[2], a[1] - b[1]],
      );
    }
    const rud = group(fg, `MiG29-rudder-${label}`, [0, 0.43, -2.02]),
      rd = detailKit(rud, rud.name),
      rp = [
        [0, 0, 0],
        [0, 1.28, -0.25],
        [0, 1.28, -0.75],
        [0, 0, -0.72],
      ];
    for (const sx of [-1, 1])
      sheet(
        rd,
        rp.map(([xx, yy, zz]) => [xx + sx * 0.04, yy, zz]),
        paint,
        [sx, 0, 0],
      );
    rd.finish();
    hinge(rud, [0, 1, 0], [0, 1.28, -0.25]);
    bindings.push({
      node: rud.name,
      source: 'yawInput',
      property: 'rotation',
      axis: 'y',
      scale: 0.3,
    });
    fd.rod([0, 2.0, -2.1], [0, 2.0, -2.99], 0.025, paint);
    // Thin fairing on the fin's top leading edge; no missile rails or stores.
    outline(
      fd,
      [
        [side * 0.057, 0.2, 0.7],
        [side * 0.057, 0.52, 0.3],
        [side * 0.057, 2.2, -1.65],
      ],
      0.003,
      seam,
      false,
    );
    fd.finish();
    // Main gear track 3.10m and axle spacing 3.645m.
  }
  for (const [name, x, zz, r, w, top] of [
    ['left', 1.55, -1.635, 0.4, 0.22, 1.88],
    ['right', -1.55, -1.635, 0.4, 0.22, 1.88],
    ['nose', 0, 2.01, 0.28, 0.13, 1.8],
  ]) {
    const g = group(root, `MiG29-gear-${name}`, [x, top, zz]),
      gd = detailKit(g, g.name);
    gd.rod([0, 0, -0.18], [0, r - top, 0], 0.045, metal);
    gd.rod([0, -0.1, -0.55], [0, r - top + 0.24, 0], 0.028, metal);
    for (const off of name === 'nose' ? [-0.13, 0.13] : [0]) {
      gd.add(new T.CylinderGeometry(r, r, w, 28).rotateZ(Math.PI / 2), seam, [off, r - top, 0]);
      gd.add(
        new T.CylinderGeometry(r * 0.58, r * 0.58, w + 0.014, 20).rotateZ(Math.PI / 2),
        upper,
        [off, r - top, 0],
      );
      for (let j = 0; j < 8; j++) {
        const a = (j * Math.PI) / 4;
        gd.add(
          new T.CylinderGeometry(r * 0.06, r * 0.06, w + 0.017, 7).rotateZ(Math.PI / 2),
          metal,
          [off, r - top + Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4],
        );
      }
    }
    if (name === 'nose') {
      gd.box([0.45, 0.03, 0.52], [0, r - top + 0.22, 0.13], paint);
      gd.box([0.34, 0.75, 0.035], [0, -0.35, 0.15], paint);
    } else gd.box([0.035, 0.65, 0.72], [Math.sign(x) * 0.16, -0.29, -0.05], paint);
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
  // Geometric low-contrast panels, fasteners and service stencils.
  for (const side of [-1, 1]) {
    for (const u of [195, 263])
      for (let j = 3; j < 21; j++) {
        const r = rings[u === 195 ? 3 : 4],
          q = r.points[j];
        d.add(new T.SphereGeometry(0.0036, 5, 3), metal, [q[0] * 1.008, q[1], r.z + 0.035]);
      }
    d.text('29', [side * 0.505, 2.23, 4.4], 0.15, (side * Math.PI) / 2, seam);
    d.text('RESCUE', [side * 0.51, 2.6, 4.2], 0.025, (side * Math.PI) / 2, seam);
    d.rod([side * 1.7, 2.12, -4.1], [side * 1.7, 2.12, -4.5], 0.007, metal);
  }
  d.finish();
  const interior = mig29Cockpit(root, { metal, glass });
  Object.assign(interior.derived, {
    tailPitch: { op: 'multiply', args: ['pitchInput', 0.29] },
    tailRoll: { op: 'multiply', args: ['rollInput', 0.13] },
    tailLeft: { op: 'subtract', args: ['tailPitch', 'tailRoll'] },
    tailRight: { op: 'add', args: ['tailPitch', 'tailRoll'] },
  });
  cleanGeometry(root);
  return {
    root,
    frame: mig29Frame(),
    enginePoints: [
      { id: 'engine-1', position: [1.15, 1.61, -5.5] },
      { id: 'engine-2', position: [-1.15, 1.61, -5.5] },
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

function mig29Cockpit(root, m) {
  const cabin = group(root, 'cockpit', [0, 0, -0.72]),
    ins = instrumentGeometry(cabin, 'MiG29'),
    { bindings, derived, ink, black, amber } = ins;
  const panel = mat('MiG29-panel', '#8d969b', { side: T.DoubleSide }),
    trim = mat('MiG29-panel-trim', '#384346'),
    cushion = mat('MiG29-seat-cushion', '#61534a'),
    belt = mat('MiG29-harness', '#aba99c'),
    red = mat('MiG29-handles', '#bf493b');
  let d = detailKit(cabin, 'MiG29-panel');
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
      'angleOfAttack',
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
    kph: { op: 'multiply', args: ['trueAirspeed', 3.6] },
    altitudeKm: { op: 'divide', args: ['altitude', 1000] },
    altitudeRemainder: { op: 'modulo', args: ['altitude', 1000] },
    aoaDegrees: { op: 'multiply', args: ['angleOfAttack', 180 / Math.PI] },
    headingRaw: { op: 'subtract', args: [Math.PI, 'yaw'] },
    trueHeading: { op: 'modulo', args: ['headingRaw', 2 * Math.PI] },
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
    circle = (x, y, r, dz = 0) =>
      Array.from({ length: 40 }, (_, i) => [
        x + Math.cos((i * Math.PI) / 20) * r,
        y + Math.sin((i * Math.PI) / 20) * r,
        z + dz,
      ]),
    text = (t, x, y, h = 0.008, color = ink, dz = -0.03) =>
      d.text(t, [x, y, z + dz], h, Math.PI, color);
  const edge = [
    [-0.4, 2.12],
    [-0.43, 2.57],
    [-0.28, 2.73],
    [0, 2.79],
    [0.28, 2.73],
    [0.43, 2.57],
    [0.4, 2.12],
  ];
  sheet(
    d,
    edge.map((p) => [...p, z]),
    panel,
    [0, 0, -1],
    [circle(0.185, 2.51, 0.064)],
  );
  outline(
    d,
    edge.map((p) => [...p, z - 0.005]),
    0.008,
    trim,
  );
  // Coaming wraps above the gray panel without covering the analogue apertures.
  for (let i = 1; i < 5; i++) {
    const a = edge[i],
      b = edge[i + 1];
    quad(
      d,
      [...a, z],
      [...b, z],
      [b[0] * 0.72, b[1] - 0.12, z + 0.28],
      [a[0] * 0.72, a[1] - 0.12, z + 0.28],
      trim,
      [0, 1, 0],
    );
  }
  // HUD controls and upper flight-warning modules fill the stepped upper panel seen in the photo.
  sheet(d, rect(0.035, 2.68, 0.205, 0.16, -0.017), trim, [0, 0, -1]);
  text('HUD', 0.035, 2.736, 0.008);
  for (const [xx, yy] of [
    [-0.035, 2.67],
    [0.03, 2.67],
    [0.1, 2.67],
  ]) {
    d.add(new T.CylinderGeometry(0.012, 0.014, 0.023, 12).rotateX(Math.PI / 2), black, [
      xx,
      yy,
      z - 0.036,
    ]);
    d.rod([xx, yy, z - 0.05], [xx, yy + 0.008, z - 0.05], 0.001, ink);
  }
  for (const [xx, label] of [
    [0.23, 'ATT'],
    [0.16, 'WARN'],
  ]) {
    sheet(d, rect(xx, 2.675, 0.058, 0.095, -0.018), black, [0, 0, -1]);
    text(label, xx, 2.7, 0.005);
    text('--', xx, 2.66, 0.009, amber);
  }
  for (const [xx, yy] of [
    [-0.38, 2.18],
    [0.38, 2.18],
    [-0.4, 2.56],
    [0.4, 2.56],
    [-0.26, 2.7],
    [0.26, 2.7],
    [-0.04, 2.2],
    [0.08, 2.2],
  ]) {
    d.add(new T.CylinderGeometry(0.0035, 0.0035, 0.002, 8).rotateX(Math.PI / 2), m.metal, [
      xx,
      yy,
      z - 0.006,
    ]);
    d.rod([xx - 0.002, yy, z - 0.008], [xx + 0.002, yy, z - 0.008], 0.00045, black);
  }
  ins.horizon('ADI', [0.185, 2.51, z + 0.008], 0.125, 0.125, { round: true, blankBackdrop: true });
  ins.dial(
    'airspeed',
    [0.335, 2.51, z - 0.009],
    0.055,
    'kph',
    [
      [0, -0.35],
      [200, 0.55],
      [400, 1.5],
      [600, 2.45],
      [800, 3.45],
      [1000, 4.45],
      [1200, 5.4],
    ],
    [0, 200, 400, 600, 800, 1000, 1200],
    'TAS KMH',
    { minorStep: 50, tickLabels: { 0: 0, 200: 2, 400: 4, 600: 6, 800: 8, 1000: 10, 1200: 12 } },
  );
  ins.dial(
    'altitude',
    [0.335, 2.37, z - 0.009],
    0.052,
    'altitudeRemainder',
    [
      [0, 0],
      [1000, 2 * Math.PI],
    ],
    [0, 100, 200, 300, 400, 500, 600, 700, 800, 900],
    'GEO M',
    {
      period: 2 * Math.PI,
      tickLabels: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i * 100, i])),
    },
  );
  ins.readout('altitude-number', [0.335, 2.347, z - 0.026], 'altitude', 5, 0.0065, ink, true, true);
  ins.dial(
    'vertical-speed',
    [0.025, 2.51, z - 0.009],
    0.052,
    'verticalSpeed',
    [
      [-100, -Math.PI / 2],
      [-50, 0],
      [0, Math.PI / 2],
      [50, Math.PI],
      [100, 1.5 * Math.PI],
    ],
    [-100, -50, 0, 50, 100],
    'M/S',
  );
  // Rotating HSI compass card; no fabricated course or navigation deviations.
  const rose = group(cabin, 'MiG29-heading', [0.185, 2.355, z - 0.025]),
    rd = detailKit(rose, rose.name);
  d.add(new T.CylinderGeometry(0.07, 0.07, 0.014, 40).rotateX(Math.PI / 2), black, [
    0.185,
    2.355,
    z - 0.012,
  ]);
  for (let i = 0; i < 72; i++) {
    const a = (i * Math.PI) / 36,
      p = (r) => [-Math.sin(a) * r, Math.cos(a) * r, 0];
    rd.rod(p(i % 6 ? 0.059 : 0.054), p(0.064), 0.0008, ink);
    if (i % 6 === 0) rd.text(String(i / 2), p(0.045), 0.008, Math.PI, ink);
  }
  rd.finish();
  bindings.push({
    node: rose.name,
    source: 'trueHeading',
    property: 'rotation',
    axis: 'z',
    scale: -1,
    period: Math.PI * 2,
  });
  ins.available('heading', 'trueHeading', rose.name);
  d.rod([0.185, 2.425, z - 0.03], [0.185, 2.409, z - 0.03], 0.0018, amber);
  text('TRUE', 0.185, 2.347, 0.007, amber);
  text('SIM', 0.185, 2.325, 0.006, amber);
  const blankDial = (name, x, y, r) => {
    d.add(new T.CylinderGeometry(r, r, 0.012, 32).rotateX(Math.PI / 2), black, [x, y, z - 0.009]);
    d.ring(r * 0.97, r * 0.04, [x, y, z - 0.017], m.metal);
    for (let j = 0; j < 36; j++) {
      const a = (j * Math.PI) / 18;
      d.rod(
        [x - Math.sin(a) * r * 0.8, y + Math.cos(a) * r * 0.8, z - 0.019],
        [x - Math.sin(a) * r * 0.91, y + Math.cos(a) * r * 0.91, z - 0.019],
        0.0005,
        ink,
      );
    }
    text(name, x, y + r * 0.25, r * 0.12);
    text('--', x, y - r * 0.15, r * 0.25, amber);
  };
  for (const [yy, l] of [
    [2.51, 'RPM'],
    [2.38, 'EGT'],
  ])
    for (const xx of [-0.105, -0.235]) blankDial(l, xx, yy, 0.047);
  blankDial('CLOCK', 0.025, 2.25, 0.048);
  ins.dial(
    'G',
    [0.335, 2.65, z - 0.009],
    0.031,
    'loadFactor',
    [
      [-3, -1.6],
      [0, -0.5],
      [3, 0.6],
      [6, 1.7],
      [9, 2.8],
    ],
    [-3, 0, 3, 6, 9],
    'G',
  );
  // Tall fuel scale and four-channel system gauges retain their characteristic shapes.
  for (const [xx, yy, w, h, label] of [
    [-0.35, 2.43, 0.065, 0.26, 'FUEL'],
    [-0.105, 2.255, 0.105, 0.075, 'HYD'],
    [-0.235, 2.255, 0.105, 0.075, 'OXY'],
    [-0.35, 2.245, 0.065, 0.075, 'RAMP'],
  ]) {
    sheet(d, rect(xx, yy, w, h, -0.016), black, [0, 0, -1]);
    outline(d, rect(xx, yy, w, h, -0.019), 0.003, m.metal);
    text(label, xx, yy + h * 0.34, 0.005);
    text('--', xx, yy, 0.009, amber);
    for (let j = 0; j < 10; j++)
      d.rod(
        [xx - w * 0.4, yy - h * 0.36 + j * h * 0.072, z - 0.022],
        [xx - w * 0.26, yy - h * 0.36 + j * h * 0.072, z - 0.022],
        0.0006,
        ink,
      );
  }
  // Original right-hand CRT with a deep hood, not a modern multi-function display.
  sheet(d, rect(-0.235, 2.655, 0.19, 0.17, -0.035), trim, [0, 0, -1]);
  sheet(d, rect(-0.235, 2.655, 0.145, 0.125, -0.041), black, [0, 0, -1]);
  text('RADAR', -0.235, 2.69, 0.009);
  text('INOP', -0.235, 2.64, 0.011, amber);
  for (const side of [-1, 1])
    quad(
      d,
      [-0.235 + side * 0.105, 2.57, z - 0.03],
      [-0.235 + side * 0.105, 2.77, z - 0.03],
      [-0.235 + side * 0.105, 2.77, z - 0.15],
      [-0.235 + side * 0.105, 2.57, z - 0.15],
      trim,
      [side, 0, 0],
    );
  d.box([0.21, 0.02, 0.13], [-0.235, 2.765, z - 0.09], trim);
  // HUD projector, large curved-top combiner and the offset control box.
  const hud = group(cabin, 'MiG29-HUD', [0, 2.73, 5.04]),
    hd = detailKit(hud, hud.name);
  hud.rotation.x = -0.14;
  const hp = [
    [-0.13, 0, 0],
    [-0.15, 0.22, 0],
    [-0.12, 0.29, 0],
    [0, 0.31, 0],
    [0.12, 0.29, 0],
    [0.15, 0.22, 0],
    [0.13, 0, 0],
  ];
  sheet(hd, hp, m.glass, [0, 0, -1]);
  outline(hd, hp, 0.007, trim);
  hd.box([0.27, 0.09, 0.28], [0, -0.04, 0.13], trim);
  for (const side of [-1, 1])
    hd.rod([side * 0.14, -0.035, 0.04], [side * 0.15, 0.23, 0], 0.011, trim);
  hd.finish();
  sheet(d, rect(-0.24, 2.9, 0.13, 0.18, 0.1), trim, [0, 0, -1]);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      d.add(new T.CylinderGeometry(0.009, 0.011, 0.014, 10).rotateX(Math.PI / 2), black, [
        -0.28 + i * 0.04,
        2.96 - j * 0.05,
        z + 0.085,
      ]);
  // Lower switch strips and gray consoles are angled toward the pilot.
  for (const side of [-1, 1]) {
    const g = group(cabin, `MiG29-console-${side}`, [side * 0.37, 2.12, 3.94]);
    g.rotation.x = Math.PI / 2;
    const gd = detailKit(g, g.name);
    for (let i = 0; i < 4; i++) {
      const yy = 0.54 - i * 0.31;
      beveledBox(gd, [0.19, 0.285, 0.024], [0, yy, 0], panel, 0.008);
      gd.text(
        (side === 1 ? ['ENGINE', 'GEAR', 'RADIO', 'POWER'] : ['OXYGEN', 'LIGHTS', 'ECS', 'CANOPY'])[
          i
        ],
        [0, yy + 0.105, -0.019],
        0.006,
        Math.PI,
        ink,
      );
      for (let j = 0; j < 3; j++) {
        const xx = -0.06 + j * 0.06;
        gd.add(new T.CylinderGeometry(0.009, 0.011, 0.015, 10).rotateX(Math.PI / 2), black, [
          xx,
          yy + 0.04,
          -0.024,
        ]);
        gd.rod([xx, yy - 0.04, -0.018], [xx, yy - 0.025, -0.05], 0.003, m.metal);
        gd.box([0.01, 0.014, 0.008], [xx, yy - 0.025, -0.052], i === 3 ? red : ink);
      }
      for (const xx of [-0.083, 0.083])
        for (const vv of [-0.12, 0.12])
          gd.add(new T.SphereGeometry(0.0035, 6, 4), m.metal, [xx, yy + vv, -0.017]);
    }
    gd.finish();
    // Vertical shoulder warning strips alongside the instrument panel.
    for (let j = 0; j < 8; j++) {
      d.box([0.047, 0.018, 0.005], [side * 0.394, 2.62 - j * 0.027, z - 0.024], trim);
      d.box(
        [0.036, 0.011, 0.005],
        [side * 0.394, 2.62 - j * 0.027, z - 0.029],
        j === 7 ? black : panel,
      );
    }
  }
  const lamp = group(cabin, 'MiG29-gear-lamp', [0.335, 2.245, z - 0.03]),
    ld = detailKit(lamp, lamp.name);
  ld.box([0.018, 0.012, 0.004], [0, 0, 0], d.green);
  ld.finish();
  bindings.push({
    node: lamp.name,
    source: 'gearDown',
    property: 'visible',
    scale: 1,
    missing: 'hide',
  });
  text('GEAR', 0.335, 2.22, 0.006);
  d.finish();
  d = detailKit(cabin, 'MiG29-tub');
  d.box([0.87, 0.035, 1.9], [0, 1.57, 3.98], panel);
  d.box([0.86, 0.42, 0.025], [0, 1.79, 5.2], panel);
  for (const side of [-1, 1]) {
    quad(
      d,
      [side * 0.44, 1.57, 3.02],
      [side * 0.44, 1.57, 5.1],
      [side * 0.44, 2.5, 5.1],
      [side * 0.44, 2.5, 3.02],
      panel,
      [-side, 0, 0],
    );
    d.box([0.18, 0.16, 1.5], [side * 0.37, 2.02, 3.94], panel);
  }
  // K-36 style seat, prominent side head supports and two red lower ejection handles.
  const seat = group(cabin, 'MiG29-K36-seat', [0, 1.78, 3.7]),
    sd = detailKit(seat, seat.name);
  seat.rotation.x = -0.26;
  beveledBox(sd, [0.48, 0.14, 0.56], [0, 0.06, 0.04], trim, 0.03);
  beveledBox(sd, [0.42, 0.09, 0.51], [0, 0.16, 0.07], cushion, 0.03);
  beveledBox(sd, [0.46, 0.69, 0.15], [0, 0.51, -0.18], trim, 0.025);
  beveledBox(sd, [0.37, 0.59, 0.1], [0, 0.5, -0.08], cushion, 0.025);
  beveledBox(sd, [0.3, 0.29, 0.24], [0, 0.99, -0.18], trim, 0.04);
  for (const side of [-1, 1]) {
    beveledBox(sd, [0.1, 0.26, 0.28], [side * 0.21, 0.94, -0.12], trim, 0.02);
    sd.box([0.035, 0.7, 0.16], [side * 0.24, 0.51, -0.18], panel);
    sd.box([0.05, 0.55, 0.016], [side * 0.1, 0.51, -0.018], belt);
    sd.box([0.17, 0.025, 0.045], [side * 0.09, 0.22, 0.27], belt);
    sd.ring(0.052, 0.008, [side * 0.065, 0.24, 0.37], red);
  }
  sd.box([0.065, 0.045, 0.025], [0, 0.24, 0.22], m.metal);
  sd.finish();
  const stick = group(cabin, 'MiG29-stick', [0, 1.72, 4.35]),
    st = detailKit(stick, stick.name);
  st.add(new T.CylinderGeometry(0.065, 0.085, 0.1, 16), black, [0, 0.05, 0]);
  st.rod([0, 0.07, 0], [0, 0.43, -0.075], 0.024, black);
  beveledBox(st, [0.075, 0.19, 0.08], [0, 0.5, -0.085], trim, 0.014);
  beveledBox(st, [0.16, 0.11, 0.07], [0, 0.61, -0.09], trim, 0.016);
  for (const [xx, yy, rr, color] of [
    [-0.052, 0.62, 0.018, red],
    [0, 0.635, 0.022, black],
    [0.052, 0.62, 0.018, ins.sky],
    [-0.03, 0.57, 0.02, black],
    [0.025, 0.56, 0.014, ink],
  ]) {
    st.add(new T.CylinderGeometry(rr, rr, 0.012, 12).rotateX(Math.PI / 2), color, [xx, yy, -0.135]);
    st.ring(rr + 0.003, 0.002, [xx, yy, -0.142], m.metal);
  }
  st.finish();
  bindings.push(
    { node: stick.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.15 },
    { node: stick.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.14 },
  );
  for (const side of [-1, 1]) {
    const th = group(cabin, `MiG29-throttle-${side}`, [0.36 + side * 0.032, 2.13, 3.8]),
      td = detailKit(th, th.name);
    td.rod([0, 0, 0], [0, 0.11, 0], 0.011, black);
    beveledBox(td, [0.055, 0.07, 0.14], [0, 0.145, 0], trim, 0.012);
    td.finish();
    bindings.push({
      node: th.name,
      source: 'power',
      property: 'rotation',
      axis: 'x',
      scale: 0.6,
      offset: -0.3,
    });
    const pg = group(cabin, `MiG29-pedal-${side}`, [side * 0.15, 1.78, 4.95]),
      pd = detailKit(pg, pg.name);
    pd.box([0.13, 0.19, 0.025], [0, 0, 0], m.metal);
    for (let j = 0; j < 5; j++)
      pd.box([0.11, 0.006, 0.006], [0, -0.075 + j * 0.0375, -0.016], trim);
    pd.finish();
    bindings.push({
      node: pg.name,
      source: 'yawInput',
      property: 'position',
      axis: 'z',
      scale: -side * 0.06,
    });
  }
  d.finish();
  return { nodes: ['cockpit'], sources, derived, bindings };
}
