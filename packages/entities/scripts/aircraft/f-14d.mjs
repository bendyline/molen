/** F-14D, clean airframe. Main-axle datum, +Z forward, +X pilot left.
 * Navy SAC exterior drawing and separate D-model front/RIO panel references.
 */
import { aircraftPanelTools as panelTools } from '../vehicle-interiors.mjs';
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
export const f14Frame = () => ({
  heli: false,
  fighter: true,
  large: false,
  radius: 0.72,
  cy: 2.1,
  ry: 0.72,
  cabinZ: 7.6,
  cabinWidth: 0.88,
  eye: [0, 3.3, 7.6],
  rearEye: [0, 3.42, 5.9],
  panelZ: 8.28,
  floor: 1.88,
});
export function buildF14D(s) {
  const root = new T.Group();
  root.name = s.slug;
  const paint = mat('F14-gray', '#929b9f', { side: T.DoubleSide }),
    upper = mat('F14-upper', '#7b858e', { side: T.DoubleSide }),
    nose = mat('F14-radome', '#a0a4a2'),
    dark = mat('F14-seals', '#24292c'),
    metal = mat('F14-alloy', '#b4bcc0', { metalness: 0.7 }),
    exhaust = mat('F14-exhaust', '#666866', { metalness: 0.72, side: T.DoubleSide }),
    liner = mat('F14-nozzle-liner', '#2c2b28', {
      metalness: 0.3,
      roughness: 0.8,
      side: T.DoubleSide,
    }),
    glass = mat('F14-glass', '#6f878c', {
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: T.DoubleSide,
      roughness: 0.18,
    });
  const d = detailKit(root, 'F14-airframe'),
    bindings = [];
  const stations = [
    // The AWG-9 radome is a full ogive, not a needle: already 0.6 m across 0.6 m aft of the tip.
    [12.07, 0.02, 2.02, 2.08],
    [11.5, 0.3, 1.8, 2.42],
    [10.6, 0.55, 1.66, 2.72],
    [10, 0.62, 1.65, 2.8],
    // Forward fuselage: round top, fuller flat-sided lower half with a soft chine (lower
    // superellipse exponent), as seen below the cockpit in front 3/4 photos.
    [9.25, 0.66, 1.67, 2.86, 2, 2.6],
    [8.5, 0.68, 1.69, 2.92, 2, 3],
    [7.6, 0.69, 1.72, 2.94, 2, 3.2],
    [6.6, 0.7, 1.73, 2.94, 2, 3.2],
    [5.55, 0.73, 1.75, 2.94, 2, 3],
    [4.7, 0.8, 1.76, 2.88, 2, 2.6],
    [3.3, 1.0, 1.8, 2.7],
    [1.2, 1.1, 1.7, 2.5],
    // Flat-bottomed centre body ("pancake") over the tunnel between the nacelles.
    [-1, 1.08, 1.62, 2.4, 2.5],
    [-3.5, 1.03, 1.76, 2.42, 3.5],
    // Beaver tail: a thin flat paddle at nozzle height that spans the gap between the
    // nacelles (superellipse sections), not a rounded saucer.
    [-5.6, 1.1, 1.93, 2.22, 4],
    [-6.55, 1.02, 1.97, 2.09, 4],
  ];
  const rings = stations.map(([z, w, b, t, n = 2, lower = n]) => ({
    z,
    points: Array.from({ length: 24 }, (_, j) => {
      const a = (j * Math.PI) / 12,
        sx = Math.sin(a),
        sy = Math.cos(a),
        e = sy < 0 ? lower : n;
      return [
        Math.sign(sx) * Math.pow(Math.abs(sx), 2 / e) * w,
        (b + t) / 2 + (Math.sign(sy) * Math.pow(Math.abs(sy), 2 / e) * (t - b)) / 2,
      ];
    }),
  }));
  loft(d, rings.slice(0, 4), nose);
  loft(d, rings, paint, { skip: (i, j) => i < 3 || (i >= 4 && i <= 8 && (j < 5 || j >= 19)) });
  d.rod([0, 2.06, 12.07], [0, 2.06, 12.3235], 0.009, metal);
  for (const i of [3, 4, 9, 10, 12, 14])
    outline(
      d,
      rings[i].points.map(([x, y]) => [x * 1.003, y, rings[i].z]),
      0.004,
      dark,
    );
  // Tandem canopy has two arched windscreen supports and a separate rear arch.
  const canopy = [
    [9.25, 0.45, 2.83, 2.87],
    [8.64, 0.53, 2.85, 3.39],
    [8.12, 0.55, 2.86, 3.56],
    [7.45, 0.56, 2.87, 3.62],
    [6.45, 0.56, 2.88, 3.58],
    [5.45, 0.56, 2.86, 3.44],
    [4.7, 0.48, 2.81, 3.12],
    [4.45, 0.35, 2.8, 2.85],
  ].map(([z, w, b, t]) => ({
    z,
    points: Array.from({ length: 13 }, (_, j) => {
      const a = (j * Math.PI) / 12;
      return [Math.cos(a) * w, b + Math.sin(a) * (t - b)];
    }),
  }));
  loft(d, canopy, glass, { caps: false });
  // The windscreen bow and the mid-canopy arch are painted like the airframe.
  for (const i of [0, 1, 4, 7])
    outline(
      d,
      canopy[i].points.map(([x, y]) => [x, y, canopy[i].z]),
      i === 1 ? 0.027 : 0.019,
      i === 1 || i === 4 ? paint : dark,
      false,
    );
  for (const side of [-1, 1]) {
    outline(
      d,
      canopy.map((r) => [side * r.points[0][0], r.points[0][1], r.z]),
      0.025,
      paint,
      false,
    );
    // Windshield side posts stop at the bow, leaving the main canopy unobstructed.
    d.rod([side * 0.16, 2.88, 9.2], [side * 0.27, 3.31, 8.64], 0.018, paint);
    const shell = [4, 5, 6, 7, 8, 9].map((i) => [
      side * rings[i].points[5][0],
      rings[i].points[5][1],
      rings[i].z,
    ]);
    for (let i = 0; i < shell.length - 1; i++)
      quad(
        d,
        shell[i],
        shell[i + 1],
        [side * 0.56, 2.85, shell[i + 1][2]],
        [side * 0.56, 2.85, shell[i][2]],
        paint,
        [side, 1, 0],
      );
  }
  // Wide, separate intake/engine nacelles leave the characteristic central tunnel.
  for (const side of [-1, 1]) {
    const x = side * 1.68,
      ng = group(root, `F14-nacelle-${side}`, [x, 0, 0]),
      nd = detailKit(ng, ng.name);
    const rect = (w, b, t, cant = 0) => [
      [-w + 0.06 + cant, t],
      [w - 0.06 + cant, t],
      [w + cant, t - 0.08],
      [w, b + 0.13],
      [w - 0.13, b],
      [-w + 0.13, b],
      [-w, b + 0.13],
      [-w + cant, t - 0.08],
    ];
    const nr = [
      // Mouth a little taller than wide, as in the head-on photos and the 3-view.
      { z: 5.75, points: rect(0.47, 1.5, 2.55, -side * 0.14) },
      { z: 2.9, points: rect(0.64, 1.32, 2.52, -side * 0.1) },
      { z: 1.1, points: rect(0.7, 0.98, 2.45) },
    ];
    loft(nd, nr, paint, { caps: false, skip: (i) => i === 0 });
    // Aft of the glove each nacelle rounds out into the cylindrical engine bay, so the nozzles
    // end a round tube instead of a chamfered box. Every aft section shares the nozzle's polar
    // stations (0 at the top, toward +X), sampled on the rectangular duct at z 1.1.
    const polar = Array.from({ length: 24 }, (_, j) => (j * Math.PI) / 12);
    const onPolygon = (polygon, cy, a) => {
      const dx = Math.sin(a),
        dy = Math.cos(a);
      let best = Infinity;
      for (let k = 0; k < polygon.length; k++) {
        const [x0, y0] = polygon[k],
          [x1, y1] = polygon[(k + 1) % polygon.length];
        const ex = x1 - x0,
          ey = y1 - y0,
          det = ex * dy - ey * dx;
        if (Math.abs(det) < 1e-12) continue;
        const t = (ex * (y0 - cy) - ey * x0) / det,
          u = (dx * (y0 - cy) - dy * x0) / det;
        if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9) best = Math.min(best, t);
      }
      return [dx * best, cy + dy * best];
    };
    const superellipse = (z, cy, a, b, n) => ({
      z,
      points: polar.map((t) => {
        const dx = Math.sin(t),
          dy = Math.cos(t),
          r = 1 / Math.pow(Math.pow(Math.abs(dx / a), n) + Math.pow(Math.abs(dy / b), n), 1 / n);
        return [dx * r, cy + dy * r];
      }),
    });
    const aft = [
      { z: 1.1, points: polar.map((t) => onPolygon(nr[2].points, 1.715, t)) },
      superellipse(-0.4, 1.73, 0.7, 0.72, 4.5),
      superellipse(-1.9, 1.78, 0.68, 0.66, 3.2),
      superellipse(-3.4, 1.82, 0.645, 0.63, 2.4),
      superellipse(-4.6, 1.83, 0.62, 0.615, 2),
      superellipse(-5.85, 1.83, 0.598, 0.598, 2),
    ];
    loft(nd, aft, paint, { caps: false });
    // The intake lip is raked in side view: the lower lip is 2.53m aft of its upper edge.
    const mouth = nr[0].points.map(([xx, y]) => [xx, y, 3.22 + ((y - 1.5) / 1.05) * 2.53]);
    outline(nd, mouth, 0.026, paint);
    const inner = mouth.map(([xx, y, z]) => [xx * 0.95, (y - 2.03) * 0.95 + 2.03, z - 0.025]),
      back = rect(0.48, 1.38, 2.2).map(([xx, y]) => [xx, y, 2.6]);
    for (let j = 0; j < 8; j++) {
      const next = (j + 1) % 8,
        a = nr[1].points[j],
        b = nr[1].points[next];
      quad(nd, mouth[j], [...a, nr[1].z], [...b, nr[1].z], mouth[next], paint, [
        mouth[j][0],
        mouth[j][1] - 2,
        0,
      ]);
      quad(nd, mouth[j], mouth[next], inner[next], inner[j], metal, [0, 0, 1]);
      quad(nd, inner[j], inner[next], back[next], back[j], dark, [
        -mouth[j][0],
        2 - mouth[j][1],
        0,
      ]);
    }
    sheet(nd, back, dark, [0, 0, 1]);
    // Ramps are visible above the duct opening; no flat black painted-on inlet.
    quad(
      nd,
      [-0.42, 2.37, 5.64],
      [0.42, 2.37, 5.64],
      [0.42, 2.14, 3.5],
      [-0.42, 2.14, 3.5],
      upper,
      [0, -1, 0],
    );
    for (const ring of [nr[1], nr[2], aft[2], aft[4]])
      outline(
        nd,
        ring.points.map(([xx, y]) => [xx * 1.003, (y - 1.85) * 1.003 + 1.85, ring.z]),
        0.004,
        dark,
      );
    const circle = (r, z) => ({
      z,
      points: Array.from({ length: 24 }, (_, j) => [
        Math.sin((j * Math.PI) / 12) * r,
        1.83 + Math.cos((j * Math.PI) / 12) * r,
      ]),
    });
    // F110 nozzle: the outer flaps ("turkey feathers") continue the tube and converge gently.
    // Seen from behind (closer than ~8 m, or obliquely) the converging flaps and the liner show
    // their inner faces, so both are double-sided and a lip closes the gap at the exit; with
    // single-sided shells the nozzle vanished and left the nacelle ending in a flat ring.
    loft(nd, [circle(0.598, -5.85), circle(0.588, -6.2), circle(0.555, -6.84)], exhaust, {
      caps: false,
    });
    loft(nd, [circle(0.52, -6.84), circle(0.47, -6.0)], liner, { caps: false });
    nd.add(new T.RingGeometry(0.52, 0.555, 24, 1).rotateY(Math.PI), exhaust, [0, 1.83, -6.84]);
    nd.add(new T.CircleGeometry(0.47, 24).rotateY(Math.PI), dark, [0, 1.83, -5.99]);
    for (let j = 0; j < 24; j++) {
      const a = (j * Math.PI) / 12;
      nd.rod(
        [Math.sin(a) * 0.59, 1.83 + Math.cos(a) * 0.59, -6.2],
        [Math.sin(a) * 0.557, 1.83 + Math.cos(a) * 0.557, -6.84],
        0.006,
        metal,
      );
    }
    nd.finish();
    // Fixed glove and pivot fairing. D-model glove vanes are omitted.
    wing(
      d,
      [
        [side * 0.67, 2.7, 5.92, -2.65, 0.15],
        [side * 2.2, 2.68, 4.75, -2.65, 0.12],
        [side * 3.32, 2.65, 1.3, 1.1, 0.07],
      ],
      upper,
    );
    const pivot = [side * 2.8, 2.65, 1.1],
      wg = group(root, `F14-wing-${side}`, pivot),
      wd = detailKit(wg, wg.name);
    const toLocal = (x, y, z) => [side * x - pivot[0], y - pivot[1], z - pivot[2]];
    const ws = [
      [2.65, 2.65, 1.44, -1.75, 0.12],
      [3.45, 2.64, 1.15, -1.86, 0.1],
      [7.7, 2.54, -0.396, -2.32, 0.055],
      [9.58, 2.5, -1.08, -2.5, 0.03],
      [9.77315, 2.5, -1.28, -2.33, 0.015],
    ];
    // Main wing ends at the hinge line; separately animated trailing-edge flaps.
    wing(
      wd,
      ws.map(([x, y, le, te, h]) => {
        const p = toLocal(x, y, le);
        return [p[0], p[1], p[2], te + (le - te) * 0.26 - pivot[2], h];
      }),
      paint,
    );
    for (let j = 0; j < 3; j++) {
      const lo = [3.45, 5.6, 7.7][j],
        hi = [5.6, 7.7, 9.4][j];
      const edge = (x) => {
        const t = (x - 3.45) / (9.58 - 3.45),
          le = 1.15 + (-1.08 - 1.15) * t,
          te = -1.86 + (-2.5 + 1.86) * t,
          y = 2.64 + (2.5 - 2.64) * t;
        return { le, te, y, h: te + (le - te) * 0.26 };
      };
      const a = edge(lo),
        b = edge(hi),
        fg = group(
          wg,
          `F14-flap-${side}-${j}`,
          toLocal((lo + hi) / 2, (a.y + b.y) / 2, (a.h + b.h) / 2),
        ),
        fd = detailKit(fg, fg.name);
      wing(
        fd,
        [
          [
            side * (lo - (lo + hi) / 2),
            a.y - (a.y + b.y) / 2,
            a.h - (a.h + b.h) / 2,
            a.te - (a.h + b.h) / 2,
            0.018,
          ],
          [
            side * (hi - (lo + hi) / 2),
            b.y - (a.y + b.y) / 2,
            b.h - (a.h + b.h) / 2,
            b.te - (a.h + b.h) / 2,
            0.012,
          ],
        ],
        paint,
      );
      fd.finish();
      bindings.push({
        node: fg.name,
        source: 'flapPosition',
        property: 'rotation',
        axis: 'x',
        scale: -0.45,
      });
      const sp = group(
          wg,
          `F14-spoiler-${side}-${j}`,
          toLocal((lo + hi) / 2, (a.y + b.y) / 2 + 0.08, (a.h + b.h) / 2 + 0.35),
        ),
        sd = detailKit(sp, sp.name);
      sd.box([hi - lo - 0.04, 0.016, 0.32], [0, 0, -0.16], upper);
      sd.finish();
      bindings.push({
        node: sp.name,
        source: side === 1 ? 'leftSpoiler' : 'rightSpoiler',
        property: 'rotation',
        axis: 'x',
        scale: 0.55,
      });
    }
    for (const [x, y, le, te] of ws.slice(1, -1)) {
      const a = toLocal(x, y + 0.07, le - 0.15),
        b = toLocal(x, y + 0.07, te + 0.18);
      wd.rod(a, b, 0.004, dark);
    }
    outline(
      wd,
      ws.map(([x, y, le]) => toLocal(x, y + 0.025, le)),
      0.005,
      dark,
      false,
    );
    for (let j = 0; j < 50; j++) {
      const x = 3.5 + j * 0.12,
        t = (x - 3.45) / (9.58 - 3.45);
      wd.add(
        new T.SphereGeometry(0.006, 4, 3),
        metal,
        toLocal(x, 2.64 - 0.14 * t + 0.07, 1.15 - 2.23 * t - 0.2),
      );
    }
    wd.finish();
    bindings.push({
      node: wg.name,
      source: 'sweepAngle',
      property: 'rotation',
      axis: 'y',
      scale: side,
      responseSeconds: 1,
    });
    // All-moving stabilators, twin canted fins, inset separate rudders.
    const tg = group(root, `F14-stabilator-${side}`, [side * 1.85, 2.12, -4.83]),
      td = detailKit(tg, tg.name);
    // The root starts at the nacelle skin: further in, its trailing edge crossed the nozzle
    // and showed as a plank inside the exhaust from behind.
    wing(
      td,
      [
        [side * 0.33, -0.003, 0.818, -1.814, 0.062],
        [side * 3.08, -0.03, -1.12, -1.93, 0.035],
        [side * 3.28, -0.03, -1.52, -1.88, 0.012],
      ],
      upper,
    );
    td.finish();
    bindings.push({
      node: tg.name,
      source: side === 1 ? 'tailLeft' : 'tailRight',
      property: 'rotation',
      axis: 'x',
      scale: 1,
    });
    const fin = group(root, `F14-fin-${side}`, [side * 1.61, 2.38, -4.4]);
    fin.rotation.z = -side * 0.0873;
    const f = detailKit(fin, fin.name);
    const contour = [
      [0, 0, 2],
      [0, 0.45, 1.2],
      [0, 2.48, -1.1],
      [0, 2.49, -2.22],
      [0, 2.3, -2.16],
      [0, 2.3, -1.92],
      [0, 0.1, -1.1],
    ];
    for (const x of [-0.045, 0.045])
      sheet(
        f,
        contour.map(([a, b, c]) => [a + x, b, c]),
        upper,
        [Math.sign(x), 0, 0],
      );
    for (let j = 0; j < contour.length; j++)
      quad(
        f,
        contour[j].map((v, i) => v + (i === 0 ? -0.045 : 0)),
        contour[(j + 1) % contour.length].map((v, i) => v + (i === 0 ? -0.045 : 0)),
        contour[(j + 1) % contour.length].map((v, i) => v + (i === 0 ? 0.045 : 0)),
        contour[j].map((v, i) => v + (i === 0 ? 0.045 : 0)),
        upper,
        [0, 1, 0],
      );
    const rg = group(fin, `F14-rudder-${side}`, [0, 0, -1.1]),
      rd = detailKit(rg, rg.name);
    sheet(
      rd,
      [
        [0, 0.1, 0],
        [0, 2.3, -0.82],
        [0, 2.3, -1.06],
        [0, 0.1, -0.46],
      ],
      paint,
      [side, 0, 0],
    );
    rd.finish();
    bindings.push({
      node: rg.name,
      source: 'yawInput',
      property: 'rotation',
      axis: 'y',
      scale: 0.4,
    });
    // Exterior operator identifiers are supplied by the selected livery.
    f.finish();
    sheet(
      d,
      [
        [side * 1.83, 1.25, -2],
        [side * 1.83, 0.48, -2.75],
        [side * 1.83, 0.8, -5.3],
        [side * 1.83, 1.3, -5.6],
      ],
      upper,
      [side, 0, 0],
    );
    // D-model dual chin optics beneath the forward fuselage.
    const cg = group(root, `F14-chin-${side}`, [side * 0.14, 1.62, 9.9]),
      cd = detailKit(cg, cg.name);
    cd.add(new T.CylinderGeometry(0.13, 0.12, 0.72, 12).rotateX(Math.PI / 2), upper, [0, 0, 0]);
    cd.add(new T.CircleGeometry(0.108, 20), dark, [0, 0, 0.365]);
    cd.finish();
  }
  // Sturdy naval undercarriage: twin nose wheels, single large main wheels and braces.
  for (const [name, x, z, r, w] of [
    ['nose', 0, 7.01929, 0.23, 0.13],
    ['left', 2.5019, 0, 0.48, 0.27],
    ['right', -2.5019, 0, 0.48, 0.27],
  ]) {
    const noseGear = name === 'nose',
      gy = noseGear ? 1.76 : 2.3,
      g = group(root, `F14-gear-${name}`, [x, gy, z]),
      gd = detailKit(g, g.name);
    const wheel = (xx) => {
      gd.add(new T.CylinderGeometry(r, r, w, 24).rotateZ(Math.PI / 2), dark, [xx, r - gy, 0]);
      for (const side of [-1, 1]) {
        gd.add(new T.CylinderGeometry(r * 0.56, r * 0.56, 0.018, 20).rotateZ(Math.PI / 2), metal, [
          xx + side * (w / 2 + 0.008),
          r - gy,
          0,
        ]);
        for (let j = 0; j < 8; j++) {
          const a = (j * Math.PI) / 4;
          gd.add(new T.SphereGeometry(0.02, 6, 4), dark, [
            xx + side * (w / 2 + 0.02),
            r - gy + Math.sin(a) * r * 0.38,
            Math.cos(a) * r * 0.38,
          ]);
        }
      }
    };
    if (noseGear) {
      wheel(-0.155);
      wheel(0.155);
    } else wheel(0);
    gd.rod([0, 0, 0], [0, r - gy + 0.08, 0], noseGear ? 0.055 : 0.075, metal);
    gd.rod([noseGear ? 0 : -Math.sign(x) * 0.7, 0, -0.6], [0, r - gy + 0.2, 0], 0.045, paint);
    gd.rod([0, -0.45, -0.15], [0, -0.85, -0.35], 0.033, metal);
    gd.rod([0, -0.85, -0.35], [0, -1.08, -0.08], 0.033, metal);
    // Main legs carry a forward drag brace from the lower strut up into the glove.
    if (!noseGear) gd.rod([0, r - gy + 0.75, 0.02], [0, -0.12, 0.95], 0.05, metal);
    gd.box(
      [noseGear ? 0.38 : 0.4, 0.035, noseGear ? 1.1 : 1.3],
      [noseGear ? 0.3 : Math.sign(x) * 0.25, -0.05, 0],
      paint,
    );
    if (noseGear) {
      const bar = group(g, 'F14-launch-bar', [0, r - gy + 0.2, 0]);
      const bd = detailKit(bar, bar.name);
      bd.rod([0, 0, 0], [0, -0.08, 0.85], 0.045, metal);
      bd.finish();
      bindings.push({
        node: bar.name,
        source: 'gear',
        property: 'rotation',
        axis: 'x',
        scale: Math.PI / 2,
        offset: -Math.PI / 2,
      });
    }
    gd.finish();
    bindings.push({
      node: g.name,
      source: 'gear',
      property: 'rotation',
      axis: noseGear ? 'x' : 'z',
      scale: noseGear ? Math.PI / 2 : Math.sign(x) * 1.35,
      offset: noseGear ? -Math.PI / 2 : Math.sign(x) * -1.35,
    });
  }
  const hook = group(root, 'arresting-hook', [0, 1.9, -4.8]);
  const hd = detailKit(hook, 'hook-skin');
  hd.rod([0, 0, 0], [0, -0.25, -1.7], 0.04, metal);
  hd.rod([0, -0.25, -1.7], [0, -0.15, -1.82], 0.055, metal);
  hd.finish();
  // Fuel-dump fairing on the beaver tail's trailing edge.
  beveledBox(d, [0.36, 0.15, 0.55], [0, 2.03, -6.56], paint, 0.04);
  d.add(new T.CircleGeometry(0.055, 12).rotateY(Math.PI), dark, [0, 2.03, -6.842]);
  for (const side of [-1, 1]) {
    // Access seams and selected fastener rows are geometry, never photographic textures.
    for (const [z, y, w, h] of [
      [9.2, 2.3, 0.42, 0.25],
      [6.2, 2.17, 0.72, 0.28],
      [3.5, 2.15, 0.65, 0.24],
    ]) {
      const x = side * (z > 5 ? 0.69 : 1.03);
      outline(
        d,
        [
          [x, y - h / 2, z - w / 2],
          [x, y + h / 2, z - w / 2],
          [x, y + h / 2, z + w / 2],
          [x, y - h / 2, z + w / 2],
        ],
        0.004,
        dark,
      );
    }
    for (let j = 0; j < 45; j++)
      d.add(new T.SphereGeometry(0.006, 4, 3), metal, [side * 0.69, 2.72, 4.9 + j * 0.1]);
    const decal = group(root, `F14-stencil-${side}`, [side * 0.71, 2.44, 7.75]);
    decal.rotation.y = (side * Math.PI) / 2;
    const dd = detailKit(decal, decal.name);
    dd.text('RESCUE', [0, 0, 0], 0.045, 0, d.yellow);
    dd.text('DANGER', [0, -0.13, 0], 0.04, 0, d.red);
    dd.finish();
  }
  d.finish();
  const interior = f14Cockpits(root, { paint, dark, metal, glass });
  Object.assign(interior.derived, {
    sweepSpeed: { op: 'subtract', args: ['trueAirspeed', 140] },
    sweepFractionRaw: { op: 'divide', args: ['sweepSpeed', 160] },
    sweepFraction: { op: 'clamp', args: ['sweepFractionRaw', 0, 1] },
    sweepAngle: { op: 'multiply', args: ['sweepFraction', (48 * Math.PI) / 180] },
    sweepDeltaDegrees: { op: 'multiply', args: ['sweepFraction', 48] },
    sweepDegrees: { op: 'add', args: [20, 'sweepDeltaDegrees'] },
    negativeRoll: { op: 'multiply', args: ['rollInput', -1] },
    leftSpoiler: { op: 'max', args: ['negativeRoll', 0] },
    rightSpoiler: { op: 'max', args: ['rollInput', 0] },
    pitchDeflection: { op: 'multiply', args: ['pitchInput', 0.3] },
    rollDeflection: { op: 'multiply', args: ['rollInput', 0.12] },
    tailLeft: { op: 'subtract', args: ['pitchDeflection', 'rollDeflection'] },
    tailRight: { op: 'add', args: ['pitchDeflection', 'rollDeflection'] },
  });
  cleanGeometry(root);
  return {
    root,
    frame: f14Frame(),
    enginePoints: [
      { id: 'engine-1', position: [1.68, 1.83, -5.5] },
      { id: 'engine-2', position: [-1.68, 1.83, -5.5] },
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

function f14Cockpits(root, m) {
  const cabin = group(root, 'cockpit'),
    d = detailKit(cabin, 'F14-cabin'),
    pt = panelTools(d),
    ins = instrumentGeometry(cabin, 'F14');
  const { bindings, derived, ink, black, amber } = ins,
    panel = mat('F14-panel', '#525b5d', { side: T.DoubleSide }),
    seat = mat('F14-cushion', '#4c5348'),
    belt = mat('F14-harness', '#a4a28d');
  const sources = Object.fromEntries(
    [
      'airspeed',
      'pitch',
      'roll',
      'yaw',
      'verticalSpeed',
      'angleOfAttack',
      'gearPosition',
      'flapPosition',
    ].map((k) => [
      { airspeed: 'trueAirspeed', gearPosition: 'gear' }[k] ?? k,
      { component: 'aircraftState', path: [k] },
    ]),
  );
  sources.altitude = { component: 'transform', path: ['pos', 1] };
  for (const [key, property] of [
    ['pitchInput', 'pitch'],
    ['rollInput', 'roll'],
    ['yawInput', 'yaw'],
    ['power', 'power'],
  ])
    sources[key] = { component: 'aircraftInput', path: [property] };
  Object.assign(derived, {
    knots: { op: 'multiply', args: ['trueAirspeed', 1.9438444924406] },
    feet: { op: 'multiply', args: ['altitude', 3.2808398950131] },
    altitudeHundreds: { op: 'modulo', args: ['feet', 1000] },
    verticalFpm: { op: 'multiply', args: ['verticalSpeed', 196.85039370079] },
    headingRaw: { op: 'subtract', args: [Math.PI, 'yaw'] },
    trueHeading: { op: 'modulo', args: ['headingRaw', Math.PI * 2] },
    headingDegrees: { op: 'multiply', args: ['trueHeading', 180 / Math.PI] },
    aoaDegrees: { op: 'multiply', args: ['angleOfAttack', 180 / Math.PI] },
    gearDown: { op: 'greater', args: ['gear', 0.999] },
  });
  // Coordinates are measured from the two different normalized foldouts (FO-3 / FO-4).
  for (const rear of [false, true]) {
    const prefix = rear ? 'RIO' : 'pilot',
      k = rear ? 0.002 : 0.0018,
      cx = rear ? 862 : 754,
      cy = rear ? 420 : 400,
      y0 = rear ? 2.78 : 2.94,
      z = rear ? 6.5 : 8.28;
    const at = (u, v, dz = 0) => [(cx - u) * k, y0 - (v - cy) * k, z + dz];
    const edge = rear
      ? [
          [635, 430],
          [650, 325],
          [737, 325],
          [737, 232],
          [986, 232],
          [986, 325],
          [1031, 322],
          [1078, 360],
          [1088, 428],
          [946, 440],
          [946, 485],
          [921, 499],
          [800, 499],
          [776, 480],
          [776, 431],
        ]
      : [
          [535, 450],
          [540, 369],
          [579, 326],
          [634, 304],
          [686, 330],
          [806, 330],
          [863, 304],
          [908, 326],
          [962, 389],
          [977, 448],
          [904, 459],
          [699, 459],
          [688, 451],
        ];
    const holes = [];
    const box = (u, v, w, h, material = black, depth = 0.015) =>
      d.box([w * k, h * k, depth], at(u, v, -0.03 + depth / 2), material);
    const text = (label, u, v, h = 7, material = ink, role = 'panel') =>
      d.text(label, at(u, v, -0.034), h * k, Math.PI, material, role);
    const circleHole = (u, v, r) =>
      Array.from({ length: 40 }, (_, i) =>
        at(u + Math.cos((i * Math.PI) / 20) * r, v + Math.sin((i * Math.PI) / 20) * r),
      );
    const rect = (u, v, w, h, dz = 0) =>
      [
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
      ].map(([a, b]) => at(u + a * w, v + b * h, dz));
    const display = (label, u, v, w, h, live = false) => {
      const outer = [
        [-0.5, -0.38],
        [-0.38, -0.5],
        [0.38, -0.5],
        [0.5, -0.38],
        [0.5, 0.38],
        [0.38, 0.5],
        [-0.38, 0.5],
        [-0.5, 0.38],
      ].map(([a, b]) => at(u + a * w, v + b * h, -0.015));
      const window = rect(u, v, w * 0.76, h * 0.73, -0.015);
      sheet(d, outer, black, [0, 0, -1], live ? [window] : []);
      for (let j = 0; j < outer.length; j++) {
        const a = outer[j],
          b = outer[(j + 1) % outer.length];
        quad(d, a, b, [b[0], b[1], z + 0.06], [a[0], a[1], z + 0.06], black, [
          a[0] - at(u, v)[0],
          a[1] - at(u, v)[1],
          0,
        ]);
      }
      for (const side of [-1, 1])
        for (let j = 0; j < 6; j++) {
          box(u + side * (w / 2 - 5), v - h * 0.36 + j * h * 0.144, 5, 7, m.paint);
          box(u - w * 0.35 + j * w * 0.14, v + side * (h / 2 - 5), 6, 5, m.paint);
        }
      text(label, u, v + h * 0.37, 5);
      if (live) {
        const hpos = at(u, v - 11, 0.015);
        ins.horizon(`${prefix}-${label}`, hpos, w * k * 0.65, h * k * 0.48, {
          blankBackdrop: true,
        });
        ins.readout(
          `${prefix}-${label}-speed`,
          at(u - 30, v + 19, -0.047),
          'knots',
          3,
          0.012,
          ink,
          false,
          true,
        );
        ins.readout(
          `${prefix}-${label}-altitude`,
          at(u + 22, v + 19, -0.047),
          'feet',
          5,
          0.011,
          ink,
          true,
          true,
        );
        text('TAS', u - 30, v + 29, 4, ink, 'display');
        text('GEO FT', u + 22, v + 29, 4, ink, 'display');
      } else text('INOP', u, v, 8, amber, 'display');
    };
    const standby = rear ? [708, 356, 21] : [668, 356, 25];
    holes.push(circleHole(...standby));
    holes.push(
      rear ? rect(1017, 393, 106 * 0.76, 93 * 0.73) : rect(754, 393, 108 * 0.76, 115 * 0.73),
    );
    sheet(
      d,
      edge.map((p) => at(...p)),
      panel,
      [0, 0, -1],
      holes,
    );
    outline(
      d,
      edge.map((p) => at(...p, -0.015)),
      0.009,
      black,
    );
    for (let j = 0; j < edge.length; j += 2) {
      const p = at(...edge[j], -0.021);
      d.add(new T.SphereGeometry(0.0035, 6, 4), m.metal, p);
    }
    ins.horizon(
      `${prefix}-standby`,
      at(standby[0], standby[1], 0.01),
      standby[2] * k * 1.76,
      standby[2] * k * 1.76,
      { round: true, blankBackdrop: true },
    );
    const speed = rear ? [667, 405, 18] : [581, 379, 18],
      alt = rear ? [710, 405, 19] : [581, 418, 18],
      vsi = rear ? [667, 365, 17] : [621, 379, 18];
    ins.dial(
      `${prefix}-airspeed`,
      at(speed[0], speed[1], -0.008),
      speed[2] * k,
      'knots',
      [
        [0, 0],
        [100, 0.65],
        [200, 1.7],
        [400, 3.4],
        [600, 4.6],
        [800, 5.5],
      ],
      [0, 100, 200, 400, 600, 800],
      'TAS',
      { tickLabels: { 0: 0, 100: 1, 200: 2, 400: 4, 600: 6, 800: 8 }, minorStep: 20 },
    );
    ins.dial(
      `${prefix}-altimeter`,
      at(alt[0], alt[1], -0.008),
      alt[2] * k,
      'altitudeHundreds',
      [
        [0, 0],
        [1000, Math.PI * 2],
      ],
      [0, 100, 200, 300, 400, 500, 600, 700, 800, 900],
      'GEO FT',
      {
        period: Math.PI * 2,
        tickLabels: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i * 100, i])),
      },
    );
    ins.dial(
      `${prefix}-vertical-speed`,
      at(vsi[0], vsi[1], -0.008),
      vsi[2] * k,
      'verticalFpm',
      [
        [-6000, -Math.PI / 2],
        [0, Math.PI / 2],
        [6000, 1.5 * Math.PI],
      ],
      [-6000, -4000, -2000, 0, 2000, 4000, 6000],
      'FPM',
      { tickLabels: { '-6000': -6, '-4000': -4, '-2000': -2, 0: 0, 2000: 2, 4000: 4, 6000: 6 } },
    );
    if (!rear) {
      display('FLIGHT', 754, 393, 108, 115, true);
      display('NAV', 866, 390, 111, 111, false);
      // HUD is physical glass only until a collimated flight-symbol renderer is available.
      const hp = [
        [707, 268],
        [707, 185],
        [726, 175],
        [785, 175],
        [803, 185],
        [803, 268],
      ].map((p) => at(...p, -0.12));
      sheet(d, hp, m.glass, [0, 0, -1]);
      outline(d, hp, 0.012, black);
      box(754, 295, 103, 63, black, 0.12);
      text('HUD', 754, 310, 7);
      box(656, 295, 22, 58, black);
      text('AOA DEG', 656, 322, 4);
      const ag = group(cabin, 'F14-AOA', at(656, 312, -0.035)),
        ad = detailKit(ag, ag.name);
      ad.box([0.023, 0.003, 0.002], [0, 0, 0], ink);
      ad.finish();
      bindings.push({
        node: ag.name,
        source: 'aoaDegrees',
        property: 'position',
        axis: 'y',
        keys: [
          [-10, 0],
          [40, 0.075],
        ],
      });
      box(834, 297, 20, 54, black);
      text('SWEEP', 834, 326, 4);
      const sg = group(cabin, 'F14-sweep-pointer', at(834, 315, -0.035)),
        sd = detailKit(sg, sg.name);
      sd.box([0.025, 0.003, 0.002], [0, 0, 0], ink);
      sd.finish();
      bindings.push({
        node: sg.name,
        source: 'sweepDegrees',
        property: 'position',
        axis: 'y',
        keys: [
          [20, 0],
          [68, 0.075],
        ],
      });
      ins.available('AOA', 'aoaDegrees', ag.name);
      ins.available('sweep', 'sweepDegrees', sg.name);
      for (let j = 0; j < 6; j++) {
        box(656, 312 - j * 8, 10, 1, ink);
        box(834, 315 - j * 8, 10, 1, ink);
      }
      for (const [u, v, r, label] of [
        [621, 418, 18, 'RAD ALT'],
        [848, 247, 20, 'COMPASS'],
      ]) {
        pt.gauge(...at(u, v).slice(0, 2), z - 0.01, r * k, black, false);
        text(label, u, v, 4);
        text('--', u, v + 7, 5, amber, 'display');
      }
      for (const [u, v, w, h, label] of [
        [641, 513, 80, 107, 'ENGINE'],
        [870, 519, 72, 100, 'FUEL'],
        [786, 510, 29, 29, 'CLOCK'],
        [932, 502, 30, 30, 'OXY'],
      ]) {
        box(u, v, w, h);
        text(label, u, v - h * 0.28, 5);
        text('--', u, v, 8, amber, 'display');
      }
      for (const [u, label] of [
        [616, 'RPM'],
        [641, 'EGT'],
        [666, 'FF'],
      ]) {
        text(label, u, 491, 4);
        for (const offset of [-5, 5]) {
          d.rod(at(u + offset, 502, -0.035), at(u + offset, 548, -0.035), 0.0007, ink);
          for (let j = 0; j < 7; j++)
            d.rod(
              at(u + offset, 502 + j * 7, -0.035),
              at(u + offset + 2, 502 + j * 7, -0.035),
              0.0005,
              ink,
            );
        }
        text('--', u, 555, 5, amber, 'display');
      }
      for (const [u, v, label] of [
        [562, 493, 'HYD'],
        [584, 493, 'OIL'],
        [562, 521, 'CABIN'],
        [584, 521, 'BRAKE'],
      ]) {
        pt.gauge(...at(u, v).slice(0, 2), z - 0.02, 10 * k, black, false);
        text(label, u, v + 14, 3);
        text('--', u, v, 4, amber, 'display');
      }
      for (const side of [-1, 1]) {
        text(side === 1 ? 'R' : 'L', 870 + side * 20, 493, 5);
        d.rod(at(870 + side * 20, 502, -0.035), at(870 + side * 20, 545, -0.035), 0.0007, ink);
        for (let j = 0; j < 6; j++)
          d.rod(
            at(870 + side * 20, 502 + j * 8, -0.035),
            at(870 + side * 20 + 3, 502 + j * 8, -0.035),
            0.0005,
            ink,
          );
      }
      // Sloped knee panels continue below the main display edge.
      for (const [u, v, w, h] of [
        [610, 513, 158, 110],
        [755, 513, 122, 110],
        [895, 513, 138, 110],
      ]) {
        sheet(
          d,
          [
            [u - w / 2, v - h / 2],
            [u + w / 2, v - h / 2],
            [u + w / 2, v + h / 2],
            [u - w / 2, v + h / 2],
          ].map((p) => at(...p, 0.025)),
          panel,
          [0, 0, -1],
        );
      }
    } else {
      display('DD', 862, 283, 244, 100);
      display('PTID', 862, 420, 163, 157);
      display('FLIGHT', 1017, 393, 106, 93, true);
      // Separate keypad rows and knobs around the digital display, matching the D layout.
      for (const side of [-1, 1])
        for (let row = 0; row < 3; row++)
          for (let col = 0; col < 4; col++)
            box(862 + side * (73 + col * 9), 299 + row * 11, 6, 7, m.paint);
      for (const side of [-1, 1])
        for (let j = 0; j < 4; j++) {
          const p = at(862 + side * (73 + j * 14), 259, -0.035);
          d.add(new T.CylinderGeometry(0.005, 0.006, 0.009, 10).rotateX(Math.PI / 2), m.metal, p);
        }
      box(862, 184, 68, 37);
      text('STATUS', 862, 184, 5);
      d.rod(at(803, 210, -0.08), at(918, 210, -0.08), 0.012, black);
      for (const [u, v, w, h, label] of [
        [738, 484, 77, 90, 'DATA'],
        [981, 483, 66, 93, 'CAUTION'],
        [1064, 542, 82, 80, 'ENTRY'],
      ]) {
        box(u, v, w, h);
        text(label, u, v, 5);
      }
      // RIO control is a display hand-controller, not a second pilot's flight stick.
      box(862, 580, 81, 80);
      const hc = at(862, 579, -0.1);
      d.rod(hc, [hc[0] + 0.025, hc[1] + 0.08, hc[2] - 0.06], 0.017, black);
    }
    const hdg = rear ? [673, 460, 22] : [668, 410, 24];
    pt.gauge(...at(hdg[0], hdg[1]).slice(0, 2), z - 0.012, hdg[2] * k, black, false);
    const hg = group(cabin, `F14-${prefix}-heading`, at(hdg[0], hdg[1], -0.03)),
      hd = detailKit(hg, hg.name),
      r = hdg[2] * k * 0.85;
    for (let deg = 0; deg < 360; deg += 10) {
      const a = (deg * Math.PI) / 180,
        p = (rr) => [-Math.sin(a) * rr, Math.cos(a) * rr, 0];
      hd.rod(p(r * 0.87), p(r), 0.0007, ink);
      if (deg % 30 === 0)
        hd.text(
          deg % 90 ? String(deg / 10) : ['N', 'E', 'S', 'W'][deg / 90],
          p(r * 0.67),
          0.006,
          Math.PI,
          ink,
        );
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
    ins.available(`${prefix}-heading`, 'trueHeading', hg.name);
    d.rod(
      at(hdg[0], hdg[1] - hdg[2], -0.035),
      at(hdg[0], hdg[1] - hdg[2] + 5, -0.035),
      0.001,
      amber,
    );
    const sz = rear ? 5.9 : 7.6,
      base = rear ? 2.01 : 1.94;
    d.box([0.96, 0.035, 1.55], [0, base, sz + 0.15], black);
    for (const side of [-1, 1]) {
      d.box([0.17, 0.24, 1.35], [side * 0.39, base + 0.29, sz + 0.1], panel);
      const labels = rear
        ? side === 1
          ? ['DATA', 'COOLING', 'ICS', 'SENSOR', 'TACAN', 'V/UHF']
          : ['POWER', 'LIGHTS', 'IFF', 'DATA', 'COMM', 'REMOTE']
        : side === 1
          ? ['VENT', 'ICS', 'COMM', 'TACAN', 'V/UHF', 'TRIM']
          : ['TEST', 'LIGHTS', 'AIR COND', 'GEN', 'OXYGEN', 'CAUTION'];
      for (let j = 0; j < 6; j++) {
        const pg = group(cabin, `F14-${prefix}-console-${side}-${j}`, [
          side * 0.39,
          base + 0.43,
          sz - 0.44 + j * 0.22,
        ]);
        pg.rotation.x = Math.PI / 2;
        const pd = detailKit(pg, pg.name);
        pd.box([0.15, 0.19, 0.014], [0, 0, 0.007], black);
        pd.text(labels[j], [0, 0.065, -0.003], 0.009, Math.PI, ink);
        for (const a of [-1, 1])
          for (const b of [-1, 1])
            pd.add(new T.SphereGeometry(0.0022, 6, 4), m.metal, [a * 0.066, b * 0.082, -0.002]);
        if (labels[j] === 'CAUTION') {
          for (let row = 0; row < 5; row++)
            for (let col = 0; col < 3; col++) {
              pd.box(
                [0.035, 0.018, 0.003],
                [(col - 1) * 0.043, 0.032 - row * 0.024, -0.002],
                m.paint,
              );
              pd.box(
                [0.028, 0.012, 0.004],
                [(col - 1) * 0.043, 0.032 - row * 0.024, -0.004],
                black,
              );
            }
        } else {
          for (let q = 0; q < 2 + (j % 2); q++) {
            const xx = (q - (1 + (j % 2)) / 2) * 0.04;
            pd.add(new T.CylinderGeometry(0.011, 0.013, 0.014, 10).rotateX(Math.PI / 2), m.paint, [
              xx,
              0.025,
              -0.009,
            ]);
            pd.rod([xx - 0.006, 0.025, -0.017], [xx + 0.006, 0.025, -0.017], 0.001, ink);
          }
          for (let q = 0; q < 2 + (j % 3); q++) {
            const xx = (q - (1 + (j % 3)) / 2) * 0.032;
            pd.add(new T.CylinderGeometry(0.006, 0.006, 0.004, 10).rotateX(Math.PI / 2), m.metal, [
              xx,
              -0.032,
              -0.002,
            ]);
            pd.rod([xx, -0.032, -0.004], [xx, -0.04, -0.022], 0.0025, m.metal);
          }
          pd.text(j % 2 ? 'OFF   ON' : 'MODE', [0, -0.067, -0.003], 0.006, Math.PI, ink);
        }
        pd.finish();
      }
    }
    const sg = group(cabin, `F14-${prefix}-seat`, [0, base + 0.45, sz + 0.12]);
    sg.rotation.x = -0.29;
    const sd = detailKit(sg, sg.name);
    beveledBox(sd, [0.46, 0.11, 0.46], [0, 0, 0.13], seat);
    beveledBox(sd, [0.49, 0.74, 0.11], [0, 0.42, -0.14], seat);
    beveledBox(sd, [0.29, 0.24, 0.15], [0, 0.9, -0.14], black);
    for (const side of [-1, 1]) {
      sd.rod([side * 0.25, -0.1, -0.18], [side * 0.25, 1, -0.18], 0.021, m.metal);
      sd.rod([side * 0.17, 0.7, -0.07], [side * 0.04, 0.1, 0.025], 0.025, belt);
    }
    sd.finish();
    if (!rear) {
      const st = group(cabin, 'F14-control-stick', [0, base + 0.12, sz + 0.65]),
        dd = detailKit(st, st.name);
      dd.rod([0, 0, 0], [0, 0.43, -0.06], 0.025, black);
      dd.box([0.065, 0.1, 0.07], [0, 0.46, -0.06], black);
      dd.add(new T.SphereGeometry(0.009, 8, 6), d.red, [0.025, 0.49, -0.1]);
      dd.finish();
      bindings.push(
        { node: st.name, source: 'pitchInput', property: 'rotation', axis: 'x', scale: -0.18 },
        { node: st.name, source: 'rollInput', property: 'rotation', axis: 'z', scale: 0.25 },
      );
      for (const side of [-1, 1]) {
        const p = group(cabin, `F14-pedal-${side}`, [side * 0.15, base + 0.1, sz + 1.01]),
          pd = detailKit(p, p.name);
        pd.box([0.14, 0.16, 0.05], [0, 0, 0], m.metal);
        for (let j = 0; j < 5; j++)
          pd.box([0.12, 0.006, 0.004], [0, -0.06 + j * 0.03, -0.028], black);
        pd.finish();
        bindings.push({
          node: p.name,
          source: 'yawInput',
          property: 'position',
          axis: 'z',
          scale: -side * 0.07,
        });
      }
      for (let j = 0; j < 2; j++) {
        const t = group(cabin, `F14-throttle-${j}`, [0.36 + j * 0.065, base + 0.4, sz + 0.45]),
          td = detailKit(t, t.name);
        td.rod([0, 0, 0], [0, 0.13, 0], 0.012, black);
        td.box([0.055, 0.04, 0.075], [0, 0.15, 0], black);
        td.finish();
        bindings.push({
          node: t.name,
          source: 'power',
          property: 'rotation',
          axis: 'x',
          scale: 0.65,
          offset: -0.3,
        });
      }
      for (let j = 0; j < 3; j++) {
        const l = group(cabin, `F14-gear-lamp-${j}`, at(575 + j * 10, 340, -0.035)),
          ld = detailKit(l, l.name);
        ld.box([0.011, 0.009, 0.002], [0, 0, 0], d.green);
        ld.finish();
        bindings.push({ node: l.name, source: 'gearDown', property: 'visible', scale: 1 });
      }
    }
  }
  for (const side of [-1, 1])
    sheet(
      d,
      [
        [side * 0.55, 1.85, 4.7],
        [side * 0.55, 1.85, 9.1],
        [side * 0.55, 2.86, 9.1],
        [side * 0.55, 2.86, 4.7],
      ],
      panel,
      [-side, 0, 0],
    );
  d.finish();
  return { nodes: ['cockpit'], sources, derived, bindings };
}
