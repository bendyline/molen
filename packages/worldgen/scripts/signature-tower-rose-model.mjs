/** Rose Rayhaan's individually reconstructed exterior, meters, +Y up. */
import { beam, loft, radialRing, sphere, torus } from './authored-structure-mesh.mjs';
import { face, grid, localOutline, mappedSolid } from './signature-tower-expansion-models.mjs';
import { box as boundsBox, tube } from './structure-mesh.mjs';

function box(out, slot, center, size, color) {
  boundsBox(
    out,
    slot,
    center.map((v, i) => v - size[i] / 2),
    center.map((v, i) => v + size[i] / 2),
    color,
  );
}

export function buildRose(out, m) {
  const blue = [0.12, 0.27, 0.3],
    silver = [0.65, 0.72, 0.73],
    gold = [0.67, 0.5, 0.24],
    white = [0.82, 0.85, 0.83];
  const base = localOutline(m),
    n = 160;
  // Four intersecting convex lobes create two cylindrical bays on each face.
  // Their overall bounds fit the26.56x23.99m mapped hotel envelope.
  const radius = (a) => {
    const dx = Math.cos(a),
      dz = Math.sin(a),
      hits = [];
    for (const x of [-5.78, 5.78])
      for (const z of [-4.49, 4.49]) {
        const dot = x * dx + z * dz,
          disc = 7.5 ** 2 - x * x - z * z + dot * dot;
        if (disc >= 0) hits.push(dot + Math.sqrt(disc));
      }
    return Math.max(...hits);
  };
  const point = (a, y, offset = 0) => {
    const r = radius(a) + offset;
    return [r * Math.cos(a), y, r * Math.sin(a)];
  };
  const ring = (y) => Array.from({ length: n }, (_, i) => point((-i / n) * Math.PI * 2, y));
  mappedSolid(out, 'foundation', base, 0, 0.2, [0.55, 0.52, 0.48]);
  const rows = Array.from({ length: 70 }, (_, i) => 0.2 + i * (244.8 / 69));
  for (let j = 1; j < rows.length; j++)
    for (let i = 0; i < n; i++) {
      const a = (-i / n) * Math.PI * 2,
        b = (-(i + 1) / n) * Math.PI * 2,
        mid = (a + b) / 2;
      const seam = Math.abs(Math.sin(mid * 2)) < 0.17;
      const lower = rows[j] < 23;
      face(
        out,
        'glass',
        [point(a, rows[j - 1]), point(b, rows[j - 1]), point(b, rows[j]), point(a, rows[j])],
        seam ? [0.28, 0.37, 0.36] : blue.map((v) => v + (i % 5 === 0 ? 0.016 : 0)),
      );
      beam(
        out,
        'metal',
        point(a, rows[j]),
        point(b, rows[j]),
        lower ? 0.17 : 0.035,
        lower ? 0.2 : 0.06,
        lower ? silver : [0.43, 0.49, 0.49],
      );
      beam(
        out,
        'metal',
        point(a, rows[j - 1]),
        point(a, rows[j]),
        0.025,
        0.035,
        [0.41, 0.48, 0.48],
      );
    }
  // Narrow gold eyes and split silver recesses repeat on each elevation.
  for (let side = 0; side < 4; side++) {
    const a = (side * Math.PI) / 2,
      r = radius(a);
    const p = (u, y, off = 0) => point(a + Math.atan2(u, r), y, off);
    for (let j = 7; j < 69; j++) {
      const y = rows[j];
      for (let k = 0; k < 32; k++) {
        const t0 = (k / 32) * Math.PI * 2,
          t1 = ((k + 1) / 32) * Math.PI * 2;
        tube(
          out,
          'metal',
          p(Math.cos(t0) * 1.25, y + Math.sin(t0) * 0.33, 0.12),
          p(Math.cos(t1) * 1.25, y + Math.sin(t1) * 0.33, 0.12),
          0.055,
          gold,
          6,
        );
      }
    }
    for (const u of [-1.62, 1.62])
      beam(out, 'metal', p(u, 25, 0.025), p(u, 242, 0.025), 0.16, 0.16, silver);
    // Broad gold cornice with circular medallion, represented without branding.
    for (let k = 0; k < 48; k++) {
      const t0 = (k / 48) * Math.PI * 2,
        t1 = ((k + 1) / 48) * Math.PI * 2;
      tube(
        out,
        'metal',
        p(Math.cos(t0) * 1.12, 243 + Math.sin(t0) * 1.3, 0.2),
        p(Math.cos(t1) * 1.12, 243 + Math.sin(t1) * 1.3, 0.2),
        0.13,
        gold,
        8,
      );
    }
  }
  for (const y of [240.6, 242.1, 243.6, 245.1]) {
    const edge = ring(y);
    for (let i = 0; i < n; i++) beam(out, 'metal', edge[i], edge[(i + 1) % n], 0.16, 0.2, gold);
  }
  // Petals grow from a narrow bottom tip, expand across the taper, then meet
  // below the sculptural sphere. The silver leaf fields are distinct from the
  // alternating black/white horizontal bands of their neighboring faces.
  const crown = (a, y, off = 0) => {
    const t = (y - 246) / 64,
      scale = Math.sqrt(Math.max(0.006, 1 - 0.994 * t * t));
    const r = (radius(a) * (1 - t) + 12.1 * t) * scale + off;
    return [r * Math.cos(a), y, r * Math.sin(a)];
  };
  for (let j = 0; j < 64; j++)
    for (let i = 0; i < n; i++) {
      const a = (-i / n) * Math.PI * 2,
        b = (-(i + 1) / n) * Math.PI * 2,
        mid = (a + b) / 2,
        t = (j + 0.5) / 64;
      const phase = Math.abs(Math.atan2(Math.sin(mid * 4), Math.cos(mid * 4))) / 4;
      const leaf = phase < 0.018 + 0.68 * Math.sin(t * Math.PI * 0.93);
      const color = leaf ? silver : j % 4 < 2 ? [0.69, 0.74, 0.73] : [0.13, 0.19, 0.21];
      const y0 = 246 + j,
        y1 = y0 + 1;
      face(
        out,
        leaf ? 'metal' : 'glass',
        [crown(a, y0), crown(b, y0), crown(b, y1), crown(a, y1)],
        color,
      );
      if (j % 4 === 0 || leaf)
        beam(
          out,
          'metal',
          crown(a, y1, 0.013),
          crown(b, y1, 0.013),
          0.018,
          0.023,
          [0.49, 0.56, 0.57],
        );
      if (i % 3 === 0)
        beam(
          out,
          'metal',
          crown(a, y0, 0.012),
          crown(a, y1, 0.012),
          0.018,
          0.024,
          [0.48, 0.53, 0.53],
        );
    }
  for (let side = 0; side < 4; side++)
    for (const sign of [-1, 1])
      for (let j = 0; j < 64; j++) {
        const a = (t) =>
          (side * Math.PI) / 2 + sign * (0.018 + 0.68 * Math.sin(t * Math.PI * 0.93));
        beam(
          out,
          'metal',
          crown(a(j / 64), 246 + j, 0.14),
          crown(a((j + 1) / 64), 247 + j, 0.14),
          0.37,
          0.4,
          white,
        );
      }
  // The petal tips cross around, but do not turn the crown into a pointed cone.
  sphere(out, 'metal', [0, 313.65, 0], [3.45, 3.65, 3.45], [0.72, 0.76, 0.74], 64, 32);
  for (const rot of [0, Math.PI / 2])
    for (let k = 0; k < 64; k++) {
      const p = (t) => {
        const a = t * Math.PI * 2,
          xx = 5.2 * Math.cos(a),
          zz = 3.4 * Math.sin(a),
          y = 310.7 + 3.1 * Math.sin(a);
        return [
          xx * Math.cos(rot) - zz * Math.sin(rot),
          y,
          xx * Math.sin(rot) + zz * Math.cos(rot),
        ];
      };
      beam(out, 'metal', p(k / 64), p((k + 1) / 64), 0.3, 0.26, white);
    }
  // The primary operator's aerial looking southeast puts the slender mast
  // behind the northeast petal; +X is the mapped northeast side.
  const mast = [5.7, 0];
  loft(
    out,
    'metal',
    [
      [299, 1.0],
      [311, 0.8],
      [319, 0.32],
      [332.8, 0.075],
      [333, 0.028],
    ].map(([y, r]) => radialRing(y, r, r, 24, mast)),
    [0.73, 0.74, 0.65],
  );
  for (let y = 303; y < 315; y += 1.35) {
    torus(out, 'metal', [mast[0], y, mast[1]], 1.04, 0.09, [0.6, 0.57, 0.46], 24, 8);
    box(out, 'metal', [mast[0] + 0.85, y, mast[1]], [1.4, 0.16, 0.9], [0.63, 0.6, 0.52]);
  }
  // Street-level glazing, paired piers and modest projecting entrance canopy
  // follow the southwest Sheikh Zayed Road frontage, not a generic tall plinth.
  const lobbyY = 5.2,
    x = -12.55;
  for (let k = 0; k < 8; k++) {
    const z = -10.5 + k * 3;
    grid(
      out,
      [
        [x, 0.2, z],
        [x, 0.2, z + 3],
        [x, lobbyY, z + 3],
        [x, lobbyY, z],
      ],
      [0.2, 0.29, 0.29],
      1.5,
      2.5,
      0.05,
      silver,
    );
  }
  for (const z of [-6.2, 6.2])
    box(out, 'stone', [-13.2, 2.7, z], [0.64, 5.4, 0.8], [0.64, 0.59, 0.49]);
  box(out, 'metal', [-14.7, 5.25, 0], [4.3, 0.26, 10.7], [0.54, 0.56, 0.51]);
  for (const z of [-4.9, 4.9])
    beam(out, 'stainless', [-16.7, 0.15, z], [-16.7, 5.2, z], 0.14, 0.18, silver);
}
