/** Compact whole-ensemble skyline; shared surface mean colors avoid far texture reads. */
import { hipRoof, ring, shell } from './lighthouse-expansion-models.mjs';
import { lathe, panel, transformed } from './lighthouse-models.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

export { buildLindesnesDistrict, buildLindesnesStreet } from './lindesnes-detail-model.mjs';

const means = {
  lap: [0.906578, 0.906578, 0.906578],
  slate: [0.59493, 0.632794, 0.653753],
  metal: [0.908889, 0.908889, 0.908889],
  wood: [0.825128, 0.825128, 0.825128],
  concrete: [0.710816, 0.710816, 0.681928],
  granite: [0.701109, 0.701109, 0.701109],
};
export function buildLindesnesSkyline(destination) {
  const out = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (s, r, p, n, u, c) =>
        destination[k](
          s,
          r,
          p,
          n.map(v=>v/Math.hypot(...n)),
          u,
          c.map((v, i) => v * (means[s]?.[i] ?? 1)),
        ),
    ]),
  );
  const red = [0.72, 0.09, 0.065],
    white = [0.9, 0.89, 0.83],
    dark = [0.085, 0.105, 0.11];
  lathe(
    out,
    'concrete',
    [
      [0, 3.14],
      [0.92, 3.14],
      [1.24, 2.7],
    ],
    [0.87, 0.86, 0.8],
    8,
  );
  shell(out, {
    profile: [
      [1.24, 2.7],
      [8.53, 2.1],
    ],
    slot: 'metal',
    color: white,
    segments: 12,
    holes: [
      { angle: 0, y: 1.45, w: 0.96, h: 2.02, depth: 0.16, trimSlot: 'metal', trimColor: white },
    ],
  });
  panel(out, 'wood', -0.43, 0.43, 1.45, 3.47, 2.48, [0.31, 0.16, 0.07]);
  for (let i = 0; i < 4; i++)
    box(
      out,
      'concrete',
      [-0.875, 0, 2.83 + i * 0.8],
      [0.875, 1.45 * (1 - i / 4), 3.63 + i * 0.8],
      [0.87, 0.86, 0.8],
    );
  ring(out, 'metal', 8.53, 2.02, 3.22, 0.16, red, 8);
  // Eight lower pickets and an open upper cleaning cage retain the two distinct galleries.
  const rail = (y, r, count, h) => {
    for (let i = 0; i < count; i++) {
      const a = (i * Math.PI * 2) / count,
        b = ((i + 1) * Math.PI * 2) / count,
        p = (t) => [Math.sin(t) * r, y + h, Math.cos(t) * r];
      tube(out, 'metal', p(a), p(b), 0.035, red, 3);
      if (h > 0.05) tube(out, 'metal', [Math.sin(a) * r, y, Math.cos(a) * r], p(a), 0.035, red, 3);
    }
  };
  rail(8.7, 3.08, 8, 0.94);
  lathe(
    out,
    'metal',
    [
      [8.69, 2.04],
      [10.48, 2.04],
      [10.71, 2.34],
    ],
    red,
    8,
  );
  lathe(
    out,
    'glass',
    [
      [10.72, 2.18],
      [14.15, 2.18],
    ],
    [0.23, 0.32, 0.34],
    8,
  );
  for (const y of [10.8, 13, 15]) rail(y, 2.45, 4, 0.015);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2,
      p = (y, r) => [Math.sin(a) * r, y, Math.cos(a) * r];
    tube(out, 'metal', p(10.77, 2.45), p(15.12, 2.45), 0.03, red, 3);
    box(transformed(out, a), 'metal', [-0.085, 14.18, 2.49], [0.085, 15.72, 2.65], red);
  }
  lathe(
    out,
    'metal',
    [
      [14.15, 2.34],
      [14.26, 2.36],
      [15.27, 0.37],
      [15.59, 0.25],
      [15.8, 0.04],
      [16.1, 0.025],
    ],
    red,
    8,
  );
  const house = transformed(out, 0.157, [-1.22, 0, -7.66]);
  box(house, 'lap', [-5.2, 0, -3], [5.2, 3.36, 3], [0.87, 0.86, 0.8]);
  const gable = (o, rx, rz, y, rise) => {
    for (const s of [-1, 1]) {
      const p = [
        [-rx, y, s * rz],
        [rx, y, s * rz],
        [rx, y + rise, 0],
        [-rx, y + rise, 0],
      ];
      quad(o, 'slate', p, [0, 1, (s * rise) / rz], [0.13, 0.17, 0.2]);
      const q = [
        [s * rx, y, -rz],
        [s * rx, y, rz],
        [s * rx, y + rise, 0],
      ];
      o.addTriangle(
        'lap',
        'palette:#fff',
        q,
        [s, 0, 0],
        [
          [0, 0],
          [1, 0],
          [0.5, 1],
        ],
        [0.87, 0.86, 0.8],
      );
    }
  };
  gable(house, 5.37, 3.15, 3.36, 1.65);
  const porch = transformed(house, 0, [-4.25, 0, 3.5]);
  box(porch, 'lap', [-0.98, 0, -0.6], [0.98, 2.65, 0.6], [0.87, 0.86, 0.8]);
  gable(porch, 1.08, 0.68, 2.65, 0.32);
  panel(porch, 'wood', -0.49, 0.49, 0.1, 2.28, 0.602, [0.81, 0.8, 0.74]);
  for (const z of [-3.01, 3.01])
    for (const x of [-2.3, 2.3]) {
      const p = [
        [x - 0.6, 1.1, z],
        [x + 0.6, 1.1, z],
        [x + 0.6, 2.3, z],
        [x - 0.6, 2.3, z],
      ];
      quad(house, 'glass', p, [0, 0, Math.sign(z)], [0.23, 0.32, 0.34]);
    }
  const horn = transformed(house, 0, [3.9, 0, 0]);
  box(horn, 'lap', [-1.3, 4.12, -1.28], [1.3, 6, 1.28], [0.87, 0.86, 0.8]);
  hipRoof(horn, 0, 0, 1.43, 1.4, 6, 0.38, dark, 'metal');
  // Horn retains an open mouth; no silhouette can bridge it with a solid cap.
  const front = transformed(horn, Math.PI);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2,
      b = ((i + 1) * Math.PI) / 2,
      p = (z, r, t) => [Math.cos(t) * r, 5.12 + Math.sin(t) * r, z];
    const ps = [p(1.28, 0.2, a), p(1.28, 0.2, b), p(1.72, 0.48, b), p(1.72, 0.48, a)];
    quad(front, 'metal', ps, [Math.cos((a + b) / 2), Math.sin((a + b) / 2), -0.28 / 0.44], dark);
    quad(
      front,
      'metal',
      ps.map(([x, y, z]) => [x * 0.9, 5.12 + (y - 5.12) * 0.9, z]),
      [-Math.cos((a + b) / 2), -Math.sin((a + b) / 2), 0.28 / 0.44],
      dark,
    );
  }
  for (const x of [-2.7, 2.7]) {
    // Low-sided cylinders with chamfered ends stand in for near-level rounded vessels.
    const t = transformed(house, Math.PI / 2, [x, 1.6, -4.6]);
    const rings = [
      [-1.97, 0.05],
      [-1.6, 0.87],
      [1.6, 0.87],
      [1.97, 0.05],
    ];
    // Use the cylinder's localY as its vessel axis through a stable native transform.
    const adapter = Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
        k,
        (s, r, p, n, u, c) =>
          t[k](
            s,
            r,
            p.map(([a, b, c]) => [a, c, b]),
            [n[0], n[2], n[1]],
            u,
            c,
          ),
      ]),
    );
    lathe(adapter, 'metal', rings, white, 6);
    for (const xx of [x - 1.1, x + 1.1])
      box(house, 'concrete', [xx - 0.19, 0, -5.15], [xx + 0.19, 0.95, -4.05], [0.87, 0.86, 0.8]);
  }
}
