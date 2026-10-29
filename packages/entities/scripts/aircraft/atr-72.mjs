/** ATR 72-600/PW127M. Stations measured from ATR CM Marketing June 2015,
 * checked against the 2020 fact sheet and Pierre Barthe's in-flight photograph.
 * Metres, +Z forward. References are local review inputs, never runtime textures.
 */

import { smoothSurface } from '../surface-normals.mjs';
import { buildATR72Cockpit } from './atr-72-cockpit.mjs';
import { atr72Nose, atr72Stations } from './atr-72-shape.mjs';
import {
  cleanGeometry,
  detailKit,
  ellipsoid,
  group,
  loft,
  mat,
  outline,
  quad,
  sheet,
  T,
  wing,
} from './mesh-kit.mjs';
import { transportCell, transportSection, transportWindowFrames } from './transport-profiles.mjs';
export const atr72Frame = () => ({
  heli: false,
  fighter: false,
  large: true,
  radius: 1.43,
  cy: 2.31,
  ry: 1.31,
  cabinZ: 10.45,
  cabinWidth: 2.57,
  eye: [0.52, 3.14, 10.45],
  panelZ: 11.02,
  floor: 1.53,
});
export function buildATR72(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('ATR72-ivory', '#e9e9e4', { side: T.DoubleSide }),
    accent = mat('ATR72-teal', '#286b80', { side: T.DoubleSide }),
    dark = mat('ATR72-trim', '#263136', { side: T.DoubleSide }),
    metal = mat('ATR72-alloy', '#a8b0b3', { metalness: 0.7 }),
    rubber = mat('ATR72-tyres', '#192025'),
    glass = mat('ATR72-glazing', '#a8c8d0', {
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.12,
    });
  const d = detailKit(root, 'ATR72-shell'),
    bindings = [],
    rotors = [],
    enginePoints = [],
    gearNodes = [];
  const ppm = 1033 / 27.166,
    z = (u) => 13.583 - (u - 35) / ppm,
    y = (v) => (330 - v) / ppm;
  const stations = atr72Stations;
  const rings = stations.map(([zz, w, b, t]) => ({
    z: zz,
    points: Array.from({ length: 64 }, (_, j) => {
      const a = (j * Math.PI) / 32;
      return [Math.sin(a) * w, (b + t) / 2 + (Math.cos(a) * (t - b)) / 2];
    }),
  }));
  const p = (i, j) => [...rings[i].points[((j + 16) % 16) * 4], rings[i].z];
  // The nose and each pane share a clipped boundary. Never turn whole roof
  // facets into glazing: those old cuts exposed the avionics through the skin.
  const noseEnd = 7;
  loft(d, rings, paint, {
    skip: (i, j) =>
      i < noseEnd || (i >= 7 && i <= 12 && ((j >= 8 && j < 16) || (j >= 48 && j < 56))),
  });
  const lining = mat('ATR72-cockpit-lining', '#a5aaa5', { side: T.DoubleSide });
  const inset = (q) => {
    const [, , b, t] = transportSection(s, atr72Nose, q[2]);
    const center = (b + t) / 2;
    return [q[0] * 0.985, center + (q[1] - center) * 0.985, q[2]];
  };
  const noseRoot = group(root, 'ATR72-nose'),
    nd = detailKit(noseRoot, 'ATR72-nose-skin');
  const cuts = [
    ...new Set([
      ...stations.slice(0, noseEnd + 1).map((a) => a[0]),
      ...atr72Nose.windows.flat().map((a) => s.length / 2 - a[1]),
      ...Array.from(
        { length: 61 },
        (_, i) => stations[0][0] + ((stations[noseEnd][0] - stations[0][0]) * i) / 60,
      ),
    ]),
  ].sort((a, b) => a - b);
  for (let i = 0; i < cuts.length - 1; i++)
    for (let j = 0; j < 64; j++) {
      const a = (j * Math.PI) / 32,
        b = ((j + 1) * Math.PI) / 32;
      transportCell(
        s,
        atr72Nose,
        [
          [cuts[i], a],
          [cuts[i + 1], a],
          [cuts[i + 1], b],
          [cuts[i], b],
        ],
        (kind, points) => {
          sheet(nd, points, kind === 'glass' ? glass : paint, [
            Math.sin((a + b) / 2),
            Math.cos((a + b) / 2),
            0,
          ]);
          if (kind === 'skin')
            sheet(nd, points.map(inset), lining, [
              -Math.sin((a + b) / 2),
              -Math.cos((a + b) / 2),
              0,
            ]);
        },
      );
    }
  nd.finish();
  noseRoot.traverse((node) => {
    if (node.isMesh) node.geometry = smoothSurface(node.geometry, 40);
  });
  transportWindowFrames(d, s, atr72Nose, dark);
  const sample = (zz, k) => {
    for (let i = 0; i < stations.length - 1; i++)
      if (zz <= stations[i][0] && zz >= stations[i + 1][0]) {
        const t = (stations[i][0] - zz) / (stations[i][0] - stations[i + 1][0]);
        return stations[i][k] * (1 - t) + stations[i + 1][k] * t;
      }
    return stations.at(-1)[k];
  };
  // Rebuild each side belt separately by station. Real holes, no dark decals covering a solid wall.
  for (const side of [-1, 1]) {
    const sideX = (zz, yy) => {
      const b = sample(zz, 2),
        t = sample(zz, 3),
        v = (yy - (b + t) / 2) / ((t - b) / 2);
      return side * sample(zz, 1) * Math.sqrt(Math.max(0, 1 - v * v));
    };
    const pt = (zz, yy, off = 0) => [sideX(zz, yy) + side * off, yy, zz];
    const holes = [];
    for (let j = 0; j < 25; j++) {
      const zz = z(257 + j * 20.65),
        yy = y(233),
        w = 0.27,
        h = 0.36,
        r = 0.052;
      holes.push(
        [
          [-w / 2 + r, -h / 2],
          [w / 2 - r, -h / 2],
          [w / 2, -h / 2 + r],
          [w / 2, h / 2 - r],
          [w / 2 - r, h / 2],
          [-w / 2 + r, h / 2],
          [-w / 2, h / 2 - r],
          [-w / 2, -h / 2 + r],
        ].map(([dz, dy]) => pt(zz + dz, yy + dy)),
      );
    }
    for (let i = 7; i <= 12; i++) {
      const upper = side > 0 ? 2 : 14,
        lower = side > 0 ? 4 : 12,
        a = stations[i][0],
        b = stations[i + 1][0];
      // Insert an extra boundary when a window crosses a station so no aperture gets clipped.
      const relevant = holes.filter(
        (h) => Math.max(...h.map((q) => q[2])) < a && Math.min(...h.map((q) => q[2])) > b,
      );
      sheet(
        d,
        [p(i, upper), p(i + 1, upper), p(i + 1, lower), p(i, lower)],
        paint,
        [side, 0, 0],
        relevant,
      );
      if (i <= 7)
        sheet(
          d,
          [p(i, upper), p(i + 1, upper), p(i + 1, lower), p(i, lower)].map(inset),
          lining,
          [-side, 0, 0],
          relevant.map((h) => h.map(inset)),
        );
    }
    for (const h of holes) {
      sheet(d, h, glass, [side, 0, 0]);
      outline(d, h, 0.006, dark);
    }
    // Port forward cargo door and rear entry; starboard servicing doors. No airline logos.
    const doors =
      side > 0
        ? [
            [179, 215, 227, 276],
            [248, 218, 270, 250],
            [778, 206, 804, 277],
          ]
        : [
            [185, 211, 216, 278],
            [248, 218, 270, 250],
            [778, 206, 804, 277],
          ];
    for (const [a, b, c, e] of doors) {
      const h = [
        [a, b],
        [c, b],
        [c, e],
        [a, e],
      ].map(([u, v]) => pt(z(u), y(v), 0.006));
      outline(d, h, 0.003, dark);
      d.rod(pt(z(c - 6), y(e - 18), 0.02), pt(z(c - 6), y(e - 28), 0.02), 0.011, metal);
    }
    for (const u of [155, 234, 310, 410, 510, 610, 705, 770, 850, 930]) {
      const zz = z(u),
        b = sample(zz, 2),
        t = sample(zz, 3);
      const arc = Array.from({ length: 12 }, (_, j) =>
        pt(zz, b + 0.18 + ((t - b - 0.36) * j) / 11, 0.004),
      );
      outline(d, arc, 0.0014, metal, false);
      for (const q of arc)
        d.add(new T.SphereGeometry(0.003, 4, 2), metal, [q[0] + side * 0.002, q[1], q[2] + 0.025]);
    }
    for (let i = 5; i < stations.length - 2; i++) {
      const a = stations[i],
        b = stations[i + 1];
      quad(
        d,
        pt(a[0], a[2] + 0.27, 0.004),
        pt(b[0], b[2] + 0.27, 0.004),
        pt(b[0], b[2] + 0.4, 0.004),
        pt(a[0], a[2] + 0.4, 0.004),
        accent,
        [side, 0, 0],
      );
    }
    const label = group(root, `ATR72-label-${side}`, [side * 1.434, 1.88, -3.5]);
    label.rotation.y = (side * Math.PI) / 2;
    const ld = detailKit(label, label.name);
    ld.text('ATR 72 600', [0, 0, 0], 0.14, 0, accent);
    ld.finish();
    // Windscreen wipers, pitot and static ports visible from the pilot position.
    d.rod([side * 0.2, 2.85, 11.91], [side * 0.6, 2.91, 11.72], 0.008, dark);
    d.rod([side * 0.85, 2.48, 12.08], [side * 0.91, 2.46, 12.47], 0.011, metal);
  }
  // High wing, straight inner panel and tapered outer panel. Printed 61 m² takes priority over artwork.
  const wy = (x) => 3.58 + Math.max(0, x - 4.05) * 0.013,
    le = (x) => 2.72 - Math.max(0, x - 4.05) * 0.073,
    te = (x) => -0.14 + Math.max(0, x - 4.05) * 0.06;
  for (const side of [-1, 1]) {
    wing(
      d,
      [
        [side * 0.9, wy(0.9), le(0.9), 0.4, 0.17],
        [side * 4.05, wy(4.05), le(4.05), 0.4, 0.17],
        [side * 13.28, wy(13.28), le(13.28), te(13.28) + 0.35, 0.1],
        [side * 13.525, wy(13.525), le(13.525) - 0.13, te(13.525) + 0.12, 0.045],
      ],
      paint,
    );
    wing(
      d,
      [
        [side * 1.42, wy(1.42) + 0.002, 2.727, 2.52, 0.027],
        [side * 4.05, wy(4.05) + 0.002, 2.727, 2.52, 0.027],
        [side * 13.25, wy(13.25) + 0.002, le(13.25) + 0.006, le(13.25) - 0.17, 0.023],
      ],
      dark,
    );
    // Thin boots follow the actual airfoil skin; a second small airfoil would be buried in it.
    const boot = [1.42, 4.05, 13.25].map((x) => {
      const h = 0.17 - (Math.max(0, x - 4.05) * 0.07) / 9.23;
      const back = x <= 4.05 ? 0.4 : te(x) + 0.35;
      const rise = (h * 0.22) / ((le(x) - back) * 0.25);
      return [
        [side * x, wy(x) + 0.005, le(x) + 0.005],
        [side * x, wy(x) + rise + 0.005, le(x) - 0.22],
        [side * x, wy(x) - rise * 0.65 - 0.005, le(x) - 0.22],
      ];
    });
    for (let j = 0; j < boot.length - 1; j++) {
      quad(d, boot[j][0], boot[j + 1][0], boot[j + 1][1], boot[j][1], dark, [0, 1, 0]);
      quad(d, boot[j][0], boot[j + 1][0], boot[j + 1][2], boot[j][2], dark, [0, -1, 0]);
    }
    for (const [kind, a, b] of [
      ['flap', 1.45, 9.5],
      ['aileron', 9.56, 13.25],
    ]) {
      const hinge = (x) => (kind === 'flap' ? 0.4 : te(x) + 0.35),
        g = group(root, `ATR72-${kind}-${side}`, [side * a, wy(a), hinge(a)]),
        dd = detailKit(g, g.name);
      wing(
        dd,
        [
          [0, 0, 0, te(a) - hinge(a), 0.028],
          [side * (b - a), wy(b) - wy(a), hinge(b) - hinge(a), te(b) - hinge(a), 0.025],
        ],
        paint,
      );
      if (kind === 'flap')
        for (let x = a + 0.35; x < b; x += 1.15) {
          dd.rod([side * (x - a), -0.04, -0.03], [side * (x - a), -0.19, -0.27], 0.019, metal);
          dd.rod([side * (x - a), -0.19, -0.27], [side * (x - a), -0.13, -0.43], 0.025, dark);
        }
      dd.finish();
      bindings.push({
        node: g.name,
        source: kind === 'flap' ? 'flapPosition' : 'rollInput',
        property: 'rotation',
        axis: 'x',
        scale: kind === 'flap' ? -Math.PI / 6 : -side * 0.35,
      });
    }
    for (let x = 1.6; x < 13; x += 0.6) {
      d.rod([side * x, wy(x) + 0.171, le(x) - 0.6], [side * x, wy(x) + 0.07, 0.44], 0.0017, metal);
      for (let u = 0.2; u < 0.8; u += 0.17)
        d.add(new T.SphereGeometry(0.003, 4, 2), metal, [
          side * x,
          wy(x) + 0.16 - (u - 0.25) * 0.17,
          le(x) - u * (le(x) - 0.4),
        ]);
    }
    ellipsoid(
      d,
      [side * 13.49, wy(13.49), 1.35],
      [0.04, 0.035, 0.1],
      side > 0 ? d.red : d.green,
      8,
    );
    for (let x = 10.2; x < 13.3; x += 0.7)
      d.rod([side * x, wy(x), te(x)], [side * x, wy(x), te(x) - 0.22], 0.004, dark);
    // Narrow, gently tapered horizontal stabilizer atop the fin.
    wing(
      d,
      [
        [side * 0.08, 6.98, -10.76, -11.96, 0.095],
        [side * 3.32, 6.98, -11.3, -11.96, 0.065],
        [side * 3.65, 6.98, -11.52, -12.04, 0.04],
      ],
      paint,
    );
    const e = group(root, `ATR72-elevator-${side}`, [side * 0.12, 6.98, -11.96]),
      ed = detailKit(e, e.name);
    wing(
      ed,
      [
        [0, 0, 0, -0.55, 0.027],
        [side * 3.2, 0, 0, -0.4, 0.023],
        [side * 3.53, 0, -0.08, -0.4, 0.018],
      ],
      accent,
    );
    ed.finish();
    bindings.push({
      node: e.name,
      source: 'pitchInput',
      property: 'rotation',
      axis: 'x',
      scale: 0.4,
    });
  }
  const finPart = (dd, pts, m) => {
    for (const side of [-1, 1])
      sheet(
        dd,
        pts.map(([zz, yy]) => [side * 0.075, yy, zz]),
        m,
        [side, 0, 0],
      );
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i],
        b = pts[(i + 1) % pts.length];
      quad(
        dd,
        [-0.075, a[1], a[0]],
        [-0.075, b[1], b[0]],
        [0.075, b[1], b[0]],
        [0.075, a[1], a[0]],
        m,
        [0, 1, 0],
      );
    }
  };
  finPart(
    d,
    [
      [z(675), y(193)],
      [z(840), y(174)],
      [z(944), y(111)],
      [z(987), y(43)],
      [z(1047), 7.65],
      [z(998), y(207)],
    ],
    paint,
  );
  const pivot = group(root, 'ATR72-rudder-hinge', [0, y(207), z(998)]);
  pivot.rotation.x = -Math.atan2((1047 - 998) / ppm, 7.65 - y(207));
  const rud = group(pivot, 'ATR72-rudder'),
    rd = detailKit(rud, rud.name);
  finPart(
    rd,
    [
      [0, 0],
      [0, 4.64],
      [-0.55, 4.64],
      [-0.61, 0],
    ],
    accent,
  );
  rd.finish();
  bindings.push({
    node: rud.name,
    source: 'yawInput',
    property: 'rotation',
    axis: 'y',
    scale: 0.45,
  });
  // PW127M cowls and Hamilton Standard 568F six-blade propellers; individual engine drivers.
  for (const [i, side] of [1, -1].entries()) {
    const x = side * 4.05,
      ey = 3.3,
      ez = 4.48,
      eg = group(root, `engine-${i + 1}`, [x, ey, ez]),
      nd = detailKit(eg, `ATR72-nacelle-${i}`);
    const ns = [
      [0.02, 0.34, -0.48, 0.35],
      [-0.3, 0.48, -0.69, 0.49],
      [-1.05, 0.54, -0.7, 0.55],
      [-1.9, 0.49, -0.57, 0.42],
      [-2.7, 0.36, -0.35, 0.24],
      [-3.78, 0.055, -0.05, 0.055],
    ].map(([zz, w, b, t]) => ({
      z: zz,
      points: Array.from({ length: 16 }, (_, j) => {
        const a = (j * Math.PI) / 8;
        return [Math.sin(a) * w, (b + t) / 2 + (Math.cos(a) * (t - b)) / 2];
      }),
    }));
    loft(nd, ns, paint);
    ellipsoid(nd, [0, -0.42, 0.025], [0.245, 0.12, 0.025], dark, 18);
    for (const r of ns.slice(1, -1))
      outline(
        nd,
        r.points.map((q) => [...q, r.z]),
        0.002,
        metal,
      );
    const exhaust = group(eg, `ATR72-exhaust-${i}`, [side * 0.31, -0.39, -2.56]);
    exhaust.rotation.y = side * 0.37;
    const xd = detailKit(exhaust, exhaust.name);
    xd.add(new T.CylinderGeometry(0.18, 0.21, 0.57, 20, 1, true).rotateX(Math.PI / 2), metal);
    xd.add(new T.CircleGeometry(0.17, 20).rotateY(Math.PI), dark, [0, 0, -0.29]);
    xd.finish();
    nd.finish();
    const prop = group(eg, `ATR72-propeller-${i}`, [0, 0, 0.035]),
      pd = detailKit(prop, prop.name);
    pd.add(new T.ConeGeometry(0.29, 0.72, 24).rotateX(Math.PI / 2), dark, [0, 0, 0.34]);
    for (let j = 0; j < 6; j++) {
      const blade = group(prop, `ATR72-blade-${i}-${j}`);
      blade.rotation.z = (j * Math.PI) / 3;
      const bd = detailKit(blade, blade.name),
        pts = [
          [0.2, -0.07, 0],
          [0.6, -0.16, 0.02],
          [1.45, -0.15, 0.025],
          [1.9, -0.1, 0.01],
          [1.965, -0.04, 0],
          [1.95, 0.08, 0],
          [1.55, 0.14, -0.02],
          [0.65, 0.13, -0.03],
          [0.2, 0.07, 0],
        ];
      sheet(bd, pts, dark, [0, 0, 1]);
      sheet(
        bd,
        pts.map((q) => [q[0], q[1], q[2] - 0.022]),
        dark,
        [0, 0, -1],
      );
      bd.box([0.07, 0.18, 0.024], [1.89, -0.005, -0.003], paint);
      bd.finish();
    }
    pd.finish();
    rotors.push({ node: prop.name, axis: 'z', multiplier: 1, engine: eg.name });
    enginePoints.push({ id: eg.name, position: [x, ey, ez] });
  }
  // Belly sponsons and short dual-wheel main legs, unlike nacelle-mounted Dash 8 gear.
  for (const side of [-1, 1]) {
    const sg = group(root, `ATR72-sponson-${side}`, [side * 1.33, 1.21, 0.4]),
      sd = detailKit(sg, sg.name);
    loft(
      sd,
      [
        [3.3, 0.05, 0.05],
        [2.1, 0.48, 0.34],
        [0.5, 0.64, 0.44],
        [-1.6, 0.51, 0.25],
        [-2.7, 0.02, 0.035],
      ].map(([zz, w, h]) => ({
        z: zz,
        points: Array.from({ length: 12 }, (_, j) => [
          Math.sin((j * Math.PI) / 6) * w,
          Math.cos((j * Math.PI) / 6) * h,
        ]),
      })),
      paint,
    );
    sd.finish();
  }
  for (const [i, x, zz, r, top] of [
    [0, 0, 11.77, 0.28, 1.3],
    [1, 2.05, 1, 0.43, 1.36],
    [2, -2.05, 1, 0.43, 1.36],
  ]) {
    const g = group(root, `ATR72-gear-${i}`, [i ? Math.sign(x) * 1.6 : 0, top, zz]),
      gd = detailKit(g, g.name),
      dx = i ? Math.sign(x) * 0.45 : 0;
    gd.rod([0, 0, 0], [dx, r - top, 0], i ? 0.075 : 0.048, metal);
    gd.rod([0, -0.03, -0.42], [dx, r - top + 0.16, 0], 0.036, dark);
    gd.rod([dx, r - top + 0.24, 0.07], [dx, r - top + 0.07, 0.15], 0.018, metal);
    for (const off of [-0.16, 0.16]) {
      gd.add(new T.CylinderGeometry(r, r, 0.22, 28).rotateZ(Math.PI / 2), rubber, [
        dx + off,
        r - top,
        0,
      ]);
      for (const sign of [-1, 1]) {
        gd.add(new T.CircleGeometry(r * 0.52, 20).rotateY((sign * Math.PI) / 2), metal, [
          dx + off + sign * 0.112,
          r - top,
          0,
        ]);
        for (let j = 0; j < 8; j++)
          gd.add(new T.SphereGeometry(0.014, 4, 2), dark, [
            dx + off + sign * 0.114,
            r - top + Math.cos((j * Math.PI) / 4) * r * 0.34,
            Math.sin((j * Math.PI) / 4) * r * 0.34,
          ]);
      }
    }
    gd.box([i ? 0.48 : 0.45, 0.035, i ? 1.05 : 0.85], [0, 0.03, -0.12], paint);
    gd.finish();
    gearNodes.push(g.name);
    bindings.push(
      {
        node: g.name,
        source: 'gearPosition',
        property: 'position',
        axis: 'y',
        scale: i ? -1 : -0.85,
        offset: i ? 1 : 0.85,
      },
      { node: g.name, source: 'gearExposed', property: 'visible', scale: 1, missing: 'hide' },
    );
  }
  for (const [u, h] of [
    [166, 0.19],
    [458, 0.21],
    [690, 0.16],
  ])
    d.rod([0, 3.61, z(u)], [0, 3.61 + h, z(u) - 0.1], 0.015, dark);
  d.finish();
  const interior = buildATR72Cockpit(root, { paint, accent, dark, metal }, rings);
  cleanGeometry(root);
  return {
    root,
    frame: atr72Frame(),
    enginePoints,
    visual: { rotors, gearNodes: [], flaps: [], ailerons: [], animation: { bindings }, interior },
    modelSignals: {
      sources: interior.sources,
      derived: interior.derived,
      bindings: [...interior.bindings, ...bindings],
    },
  };
}
