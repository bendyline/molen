/** Complete offshore silhouette; shared graph mean colors avoid far texture reads. */
import { beam } from './authored-structure-mesh.mjs';
import { ring as originalRing, shell } from './lighthouse-expansion-models.mjs';
import { lathe as originalLathe, panel, transformed } from './lighthouse-models.mjs';
import { box, tube as originalTube } from './structure-mesh.mjs';

export {
  buildRoterSandCloseup,
  buildRoterSandDistrict,
  buildRoterSandStreet,
} from './roter-sand-detail-model.mjs';

const red = [0.65, 0.085, 0.045],
  white = [0.86, 0.85, 0.79],
  black = [0.035, 0.043, 0.043],
  glass = [0.075, 0.11, 0.13];
const tau = Math.PI * 2,
  point = (r, y, a) => [Math.sin(a) * r, y, Math.cos(a) * r];
export function buildRoterSandSkyline(destination) {
  const means = { metal: 0.908889, wood: 0.825128 };
  const out = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (s, r, p, n, u, c) =>
        destination[k](
          s,
          r,
          p,
          n.map((v) => v / Math.hypot(...n)),
          u,
          c.map((v) => v * (means[s] ?? 1)),
        ),
    ]),
  );
  const levels = [
      [0, 0],
      [1.8, 2.28],
      [8, 8.44],
      [12.3, 12.65],
      [16.6, 16.95],
      [20.7, 21.11],
      [24.1, 24.81],
      [30.7, 30.95],
    ],
    height = (y) => {
      let i = 1;
      while (i < levels.length - 1 && y > levels[i][0]) i++;
      const [a, b] = levels[i - 1],
        [c, d] = levels[i];
      return b + ((y - a) * (d - b)) / (c - a);
    };
  const topOnly = (o) => ({
    ...o,
    addQuad(s, r, p, n, u, c) {
      if (n[1] > 0.9) o.addQuad(s, r, p, n, u, c);
    },
  });
  const ring = (o, s, y, a, b, h, c, count) => originalRing(topOnly(o), s, y, a, b, h, c, count);
  const lathe = (o, s, p, c, count, center) =>
    originalLathe(
      {
        ...o,
        addConvexPolygon(s, r, p, n, u, c) {
          if (n[1] > 0 && Math.max(...p.map((q) => Math.hypot(q[0], q[2]))) < 0.3)
            o.addConvexPolygon(s, r, p, n, u, c);
        },
      },
      s,
      p,
      c,
      count,
      center,
    );
  const tube = (o, s, a, b, r, c, count) =>
    originalTube({ ...o, addConvexPolygon() {} }, s, a, b, r, c, count);
  const model = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (s, r, p, n, u, c) =>
        out[k](
          s,
          r,
          p.map(([x, y, z]) => [x, height(y), z]),
          n,
          u,
          c,
        ),
    ]),
  );
  const base = transformed(model, -Math.PI / 8),
    lens = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * tau) / 8,
      z = Math.sqrt(7.3 * 7.3 - 1.8 * 1.8) * Math.cos(a);
    lens.push([Math.sign(Math.sin(a)) * (Math.sqrt(Math.max(0, 7.3 * 7.3 - z * z)) - 1.8), z]);
  }
  for (let i = 0; i < 8; i++) {
    const a = lens[i],
      b = lens[(i + 1) % 8];
    base.addQuad(
      'metal',
      'palette:#ffffff',
      [
        [a[0], 0, a[1]],
        [b[0], 0, b[1]],
        [b[0], 1.8, b[1]],
        [a[0], 1.8, a[1]],
      ],
      [a[0] + b[0], 0, a[1] + b[1]],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      black,
    );
    base.addTriangle(
      'metal',
      'palette:#ffffff',
      [
        [0, 1.8, 0],
        [a[0], 1.8, a[1]],
        [b[0], 1.8, b[1]],
      ],
      [0, 1, 0],
      [
        [0, 0],
        [0, 1],
        [1, 1],
      ],
      black,
    );
  }
  lathe(
    model,
    'metal',
    [
      [1.8, 5.05],
      [2.1, 5.03],
      [7.9, 3.2],
      [8, 3.2],
    ],
    black,
    6,
  );
  shell(model, {
    profile: [
      [8, 3.2],
      [12.3, 2.98],
      [16.6, 2.76],
      [20.7, 2.55],
    ],
    segments: 8,
    slot: 'metal',
    color: (y) => (y < 12.3 ? white : y < 16.6 ? red : white),
    holes: [(5 * Math.PI) / 8, (-3 * Math.PI) / 8].map((angle) => ({
      angle,
      y: 8.05,
      h: 1.92,
      w: 0.73,
      depth: 0.13,
      trimSlot: 'metal',
      trimColor: white,
    })),
  });
  for (const y of [9.55, 13.8, 18.05])
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
      panel(
        transformed(model, a),
        'glass',
        -0.17,
        0.17,
        y - 0.17,
        y + 0.17,
        3.2 - ((y - 8) * 0.65) / 12.7 + 0.015,
        glass,
      );
  lathe(
    model,
    'metal',
    [
      [20.7, 2.55],
      [24.1, 2.55],
    ],
    red,
    8,
  );
  const bays = [0, (-5 * Math.PI) / 8, (3 * Math.PI) / 4],
    distance = 0.95 / Math.sqrt(2) + Math.sqrt(2.55 * 2.55 - (0.95 * 0.95) / 2);
  const dome = (o, r, y, h) =>
    lathe(
      o,
      'metal',
      [
        [y, r],
        [y + h * 0.5, r * 0.866],
        [y + h * 0.866, r * 0.5],
        [y + h, 0.025],
      ],
      black,
      6,
    );
  for (const a of bays) {
    const c = point(distance, 0, a),
      o = transformed(model, 0, c),
      stair = a === bays[2];
    lathe(
      o,
      'metal',
      [
        [18.65, 0.05],
        [19.05, 0.27],
        [20.45, 0.85],
        [20.7, 0.98],
        [24.1, 0.95],
      ],
      red,
      6,
    );
    if (stair) {
      lathe(
        o,
        'metal',
        [
          [24.1, 0.95],
          [27.5, 0.95],
        ],
        white,
        8,
      );
      dome(o, 1.06, 27.6, 0.75);
      lathe(
        o,
        'metal',
        [
          [28.35, 0.12],
          [28.65, 0.04],
        ],
        black,
        6,
      );
    } else {
      ring(o, 'metal', 24.1, 0.05, 1.05, 0.15, white, 8);
      for (let i = 0; i < 3; i++) {
        const u = a - (3 * Math.PI) / 4 + (i * Math.PI) / 2,
          v = u + Math.PI / 2;
        const p = (t) => [c[0] + 1.07 * Math.sin(t), 25.31, c[2] + 1.07 * Math.cos(t)];
        tube(model, 'metal', p(u), p(v), 0.023, white, 3);
        if (i === 0) tube(model, 'metal', [p(u)[0], 24.25, p(u)[2]], p(u), 0.023, white, 3);
      }
    }
    panel(transformed(model, a, c), 'glass', -0.31, 0.31, 21.6, 23.02, 0.966, glass);
    if (stair) panel(transformed(model, a, c), 'glass', -0.325, 0.325, 25.3, 26.45, 0.966, glass);
  }
  ring(model, 'metal', 24.1, 1.95, 2.68, 0.15, white, 8);
  for (let i = 0; i < 8; i++) {
    const a = (i * tau) / 8,
      b = ((i + 1) * tau) / 8,
      m = (a + b) / 2;
    if (bays.some((t) => Math.abs(Math.atan2(Math.sin(m - t), Math.cos(m - t))) < 0.37)) continue;
    tube(model, 'metal', point(2.68, 25.31, a), point(2.68, 25.31, b), 0.025, white, 3);
    if (i % 2 === 0)
      tube(model, 'metal', point(2.68, 24.25, a), point(2.68, 25.33, a), 0.026, white, 3);
  }
  lathe(
    model,
    'metal',
    [
      [24.25, 1.99],
      [25.85, 1.99],
    ],
    white,
    8,
  );
  lathe(
    model,
    'glass',
    [
      [25.85, 1.95],
      [27.38, 1.95],
    ],
    glass,
    8,
  );
  dome(model, 2.13, 27.55, 1.75);
  lathe(
    model,
    'metal',
    [
      [29.29, 0.15],
      [29.48, 0.23],
      [29.72, 0.23],
      [29.86, 0.09],
      [30.2, 0.055],
      [30.7, 0.016],
    ],
    black,
    4,
  );
  box(transformed(model, bays[2]), 'metal', [-0.56, 24.25, 1.55], [0.56, 27.2, 3.13], white);
  box(model, 'metal', [1.75, 24.25, -0.6], [2.73, 26.05, 0.65], white);
  box(model, 'metal', [1.7, 26.05, -0.65], [2.8, 26.14, 0.7], black);
  for (const a of [(5 * Math.PI) / 8, (-3 * Math.PI) / 8]) {
    const o = transformed(model, a);
    for (const x of [-0.26, 0.26])
      beam(o, 'metal', [x, 1.85, 5.04], [x, 8.2, 3.26], 0.055, 0.06, black);
    for (let i = 0; i < 3; i++) {
      const t = i / 2;
      tube(
        o,
        'metal',
        [-0.26, 2.05 + 5.95 * t, 5.04 - 1.78 * t],
        [0.26, 2.05 + 5.95 * t, 5.04 - 1.78 * t],
        0.027,
        black,
        3,
      );
    }
    const p = point(6.35, 0, a);
    tube(model, 'wood', p, [p[0], 7.7, p[2]], 0.2, [0.22, 0.18, 0.14], 6);
  }
  const davit = transformed(model, (-3 * Math.PI) / 8);
  beam(davit, 'metal', [0, 18.1, 2.91], [0, 20.3, 2.91], 0.08, 0.1, black);
  beam(davit, 'metal', [0, 20.3, 2.91], [0, 20.85, 4.5], 0.08, 0.1, black);
  tube(davit, 'metal', [0, 20.85, 4.5], [0, 17.9, 4.5], 0.014, black, 3);
}
