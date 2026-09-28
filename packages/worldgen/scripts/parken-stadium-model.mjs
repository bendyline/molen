/** Parken's four independent stands, corner offices and parked thirteen-girder roof. */
import { beam } from './authored-structure-mesh.mjs';
import { transformed } from './lighthouse-models.mjs';
import { parkenPlan as plan } from './parken-plan.mjs';
import { chair, curve, face, soccerPitch } from './stadium-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const cream = [0.73, 0.72, 0.65],
  white = [0.84, 0.85, 0.81],
  concrete = [0.56, 0.57, 0.54],
  steel = [0.49, 0.53, 0.54],
  glass = [0.055, 0.105, 0.12],
  red = [0.64, 0.028, 0.027],
  dark = [0.025, 0.035, 0.04];
function rail(out, a, b, h = 1.03) {
  for (const y of [0.5, h])
    tube(out, 'metal', [a[0], a[1] + y, a[2]], [b[0], b[1] + y, b[2]], 0.023, steel, 6);
  const len = Math.hypot(...a.map((v, i) => b[i] - v));
  for (let i = 0; i <= Math.ceil(len / 1.5); i++) {
    const t = i / Math.ceil(len / 1.5),
      p = a.map((v, k) => v + (b[k] - v) * t);
    tube(out, 'metal', p, [p[0], p[1] + h, p[2]], 0.024, steel, 6);
  }
}
function tier(out, angle, span, start, rows, rise, tread, y0, aisles) {
  const o = transformed(out, angle, [0, 0, 0]),
    u0 = -span / 2;
  for (let r = 0; r < rows; r++) {
    const z = start + r * tread,
      y = y0 + r * rise;
    box(o, 'concrete', [u0, y - 0.25, z], [span / 2, y, z + tread], concrete);
    if (r > 0)
      face(
        o,
        'concrete',
        [
          [u0, y - rise, z],
          [span / 2, y - rise, z],
          [span / 2, y, z],
          [u0, y, z],
        ],
        concrete,
        [0, 0, -1],
      );
    const n = Math.floor(span / 0.51);
    for (let i = 0; i < n; i++) {
      const u = u0 + 0.3 + i * 0.51;
      const worldX = u * Math.cos(angle) + (z + 0.26) * Math.sin(angle);
      const worldZ = -u * Math.sin(angle) + (z + 0.26) * Math.cos(angle);
      if (Math.hypot(Math.abs(worldX) - 49, Math.abs(worldZ) - 65.5) < 5.6) continue;
      if (aisles.some((a) => Math.abs(u - a) < 0.83)) continue;
      if (
        r >= Math.floor(rows * 0.48) &&
        r < Math.floor(rows * 0.48) + 4 &&
        aisles.some((a) => Math.abs(u - a) < 1.6)
      )
        continue;
      chair(o, 0, [u, y, z + 0.26], red);
    }
    for (const a of aisles) {
      box(
        o,
        'concrete',
        [a - 0.75, y - rise / 2, z],
        [a + 0.75, y + 0.03, z + tread / 2],
        concrete,
      );
      if (r % 2 === 0) tube(o, 'metal', [a, y, z + 0.2], [a, y + 1.1, z + 0.2], 0.022, steel, 6);
      if (r + 1 < rows)
        tube(
          o,
          'metal',
          [a, y + 1.1, z + 0.2],
          [a, y + rise + 1.1, z + tread + 0.2],
          0.022,
          steel,
          6,
        );
    }
  }
  const end = start + rows * tread,
    top = y0 + (rows - 1) * rise;
  face(
    o,
    'concrete',
    [
      [u0, y0 - 0.26, start],
      [span / 2, y0 - 0.26, start],
      [span / 2, top - 0.26, end],
      [u0, top - 0.26, end],
    ],
    concrete,
    [0, -1, 0],
  );
  for (const u of [u0, span / 2])
    face(
      o,
      'concrete',
      [
        [u, y0 - 0.26, start],
        [u, top - 0.26, end],
        [u, top + 0.12, end],
        [u, y0 + 0.12, start],
      ],
      concrete,
      [Math.sign(u), 0, 0],
    );
  rail(o, [u0, top, end], [span / 2, top, end]);
  for (const a of aisles) {
    const r = Math.floor(rows * 0.48),
      y = y0 + r * rise,
      z = start + r * tread;
    box(o, 'concrete', [a - 1.65, y, z - 0.2], [a + 1.65, y + 2.3, z + 1.7], cream);
    face(
      o,
      'glass',
      [
        [a - 1.4, y, z - 0.215],
        [a + 1.4, y, z - 0.215],
        [a + 1.4, y + 2.03, z - 0.215],
        [a - 1.4, y + 2.03, z - 0.215],
      ],
      dark,
      [0, 0, -1],
    );
  }
  for (let u = u0 + 3; u < span / 2; u += 8) {
    beam(o, 'concrete', [u, 0, start + 4], [u, top - 0.7, end - 1], 0.65, 1, concrete);
    beam(o, 'concrete', [u, 0, end - 1], [u, top - 0.8, end - 1], 0.65, 0.8, concrete);
  }
}
function longStands(out) {
  for (const s of [-1, 1]) {
    const a = (s * Math.PI) / 2,
      o = transformed(out, a, [0, 0, 0]);
    tier(out, a, 130, 38.5, 27, 0.405, 0.57, 1.8, [-57, -38, -19, 0, 19, 38, 57]);
    tier(out, a, 128, 56.6, 28, 0.61, 0.7, 15.4, [-55, -33, -11, 11, 33, 55]);
    // The hospitality band is set behind the lower spectators with a closed soffit.
    box(o, 'concrete', [-65, 12.7, 54], [65, 13.1, 60], cream);
    box(o, 'concrete', [-65, 15, 54], [65, 15.35, 60], cream);
    face(
      o,
      'glass',
      [
        [-65, 13.1, 54],
        [65, 13.1, 54],
        [65, 15, 54],
        [-65, 15, 54],
      ],
      glass,
      [0, 0, -1],
    );
    for (let u = -64; u <= 64; u += 2.8)
      beam(o, 'metal', [u, 13.1, 53.96], [u, 15, 53.96], 0.07, 0.09, white);
    // Street elevations retain the concrete posts, tall entry bays and recessed glazing.
    box(o, 'concrete', [-66, 0, 77], [66, 28.6, 79], cream);
    for (let u = -62; u <= 62; u += 8) {
      box(o, 'concrete', [u - 0.55, 0, 79], [u + 0.55, 33, 80.1], cream);
      for (const y of [2, 8.3, 18, 23]) {
        const h = y < 10 ? 4.3 : 3.0;
        face(
          o,
          'glass',
          [
            [u + 0.8, y, 79.04],
            [u + 6.7, y, 79.04],
            [u + 6.7, y + h, 79.04],
            [u + 0.8, y + h, 79.04],
          ],
          glass,
          [0, 0, 1],
        );
        for (let k = 1; k < 4; k++)
          beam(
            o,
            'metal',
            [u + 0.8 + k * 1.475, y, 79.09],
            [u + 0.8 + k * 1.475, y + h, 79.09],
            0.075,
            0.08,
            white,
          );
      }
      beam(o, 'concrete', [u, 34.3, 78], [u, 33.5, 61], 0.75, 1.1, cream);
    }
    for (const y of [7, 15, 21.5, 27.2])
      box(o, 'concrete', [-66, y, 79], [66, y + 0.55, 80], cream);
  }
}
function endStands(out) {
  tier(out, Math.PI, 91, 58.6, 27, 0.41, 0.59, 1.8, [-37, -18, 0, 18, 37]);
  tier(out, Math.PI, 89, 75.6, 27, 0.6, 0.68, 16.4, [-34, -11, 11, 34]);
  const b = transformed(out, Math.PI, [0, 0, 0]);
  box(b, 'concrete', [-47, 0, 95], [47, 29.5, 97], cream);
  for (let x = -43; x < 44; x += 8) {
    box(b, 'concrete', [x - 0.5, 0, 97], [x + 0.5, 34, 98.2], cream);
    for (const y of [2, 9, 20, 25])
      face(
        b,
        'glass',
        [
          [x + 0.8, y, 97.06],
          [x + 6.7, y, 97.06],
          [x + 6.7, y + 3.7, 97.06],
          [x + 0.8, y + 3.7, 97.06],
        ],
        glass,
        [0, 0, 1],
      );
  }
  box(b, 'concrete', [-45, 13, 74], [45, 15.3, 77], cream);
  face(
    b,
    'glass',
    [
      [-45, 13.1, 73.98],
      [45, 13.1, 73.98],
      [45, 15.1, 73.98],
      [-45, 15.1, 73.98],
    ],
    glass,
    [0, 0, -1],
  );
  // The 2009 D stand is lower and telescopic, with offices behind rather than an upper bowl.
  tier(out, 0, 91, 58.6, 19, 0.43, 0.71, 1.25, [-31, 0, 31]);
  tier(out, 0, 92, 72.4, 5, 0.46, 0.76, 10.2, [-31, 0, 31]);
  box(out, 'concrete', [-47, 0, 80], [47, 32.6, 99], cream);
  for (const z of [79.96, 99.04]) {
    for (let level = 0; level < 8; level++) {
      const y = 1.1 + level * 3.9;
      face(
        out,
        'glass',
        [
          [-46, y, z],
          [46, y, z],
          [46, y + 2.25, z],
          [-46, y + 2.25, z],
        ],
        glass,
        [0, 0, z > 90 ? 1 : -1],
      );
      for (let x = -45; x <= 45; x += 2.5)
        beam(
          out,
          'metal',
          [x, y, z + (z > 90 ? 0.025 : -0.025)],
          [x, y + 2.25, z + (z > 90 ? 0.025 : -0.025)],
          0.075,
          0.11,
          white,
        );
    }
  }
  // Three projecting entrance canopies on Per Henrik Lings Alle.
  for (const x of [-31, 0, 31]) {
    box(out, 'concrete', [x - 4.5, 0, 99], [x + 4.5, 3.4, 101], cream);
    face(
      out,
      'glass',
      [
        [x - 3.8, 0.15, 101.04],
        [x + 3.8, 0.15, 101.04],
        [x + 3.8, 2.8, 101.04],
        [x - 3.8, 2.8, 101.04],
      ],
      glass,
      [0, 0, 1],
    );
    box(out, 'metal', [x - 5, 3.45, 98.8], [x + 5, 3.67, 103], white);
  }
}
function offices(out) {
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const cx = sx * 61.4,
        cz = sz * 81.3,
        x0 = cx - 12.6,
        x1 = cx + 12.6,
        z0 = cz - 16.1,
        z1 = cz + 16.1;
      box(out, 'concrete', [x0, 0, z0], [x1, 32.6, z1], cream);
      for (let k = 0; k < 8; k++) {
        const y = 1.25 + k * 3.85;
        for (const x of [x0 - 0.035, x1 + 0.035]) {
          face(
            out,
            'glass',
            [
              [x, y, z0 + 1],
              [x, y, z1 - 1],
              [x, y + 2.0, z1 - 1],
              [x, y + 2.0, z0 + 1],
            ],
            glass,
            [x < cx ? -1 : 1, 0, 0],
          );
          for (let z = z0 + 2; z < z1; z += 2.5)
            beam(
              out,
              'metal',
              [x + (x < cx ? -0.025 : 0.025), y, z],
              [x + (x < cx ? -0.025 : 0.025), y + 2, z],
              0.065,
              0.08,
              white,
            );
        }
        for (const z of [z0 - 0.035, z1 + 0.035]) {
          face(
            out,
            'glass',
            [
              [x0 + 1, y, z],
              [x1 - 1, y, z],
              [x1 - 1, y + 2, z],
              [x0 + 1, y + 2, z],
            ],
            glass,
            [0, 0, z < cz ? -1 : 1],
          );
          for (let x = x0 + 2; x < x1; x += 2.5)
            beam(
              out,
              'metal',
              [x, y, z + (z < cz ? -0.025 : 0.025)],
              [x, y + 2, z + (z < cz ? -0.025 : 0.025)],
              0.065,
              0.08,
              white,
            );
        }
      }
      box(out, 'concrete', [x0 - 0.25, 32.6, z0 - 0.25], [x1 + 0.25, 33, z1 + 0.25], cream);
      box(out, 'metal', [cx - 6, 33, cz - 7], [cx + 6, 35, cz + 7], steel);
      for (let z = cz - 5; z <= cz + 5; z += 2)
        box(out, 'metal', [cx - 5, 35, z - 0.2], [cx + 5, 35.4, z + 0.2], dark);
      // The field-facing glass stair atrium is curved and shows its landings.
      const cc = [sx * 49, 0, sz * 65.5],
        a0 = Math.atan2(-sx, -sz) - Math.PI / 2,
        r = 5.2;
      const F = (a, y) => [cc[0] + r * Math.sin(a), y, cc[2] + r * Math.cos(a)];
      for (let i = 0; i < 40; i++) {
        const a = a0 + (i * Math.PI) / 40,
          b = a0 + ((i + 1) * Math.PI) / 40,
          p = F(a, 0.3),
          q = F(b, 0.3),
          P = F(a, 30.7),
          Q = F(b, 30.7);
        face(out, 'glass', [p, q, Q, P], glass, [Math.sin(a), 0, Math.cos(a)]);
        if (i % 2 === 0) tube(out, 'metal', p, P, 0.038, white, 8);
        const cap = [F(a, 30.75), F(b, 30.75), [cc[0], 30.75, cc[2]]];
        out.addTriangle(
          'metal',
          'metric:uv',
          cap,
          [0, 1, 0],
          cap.map((p) => [p[0], p[2]]),
          white,
        );
      }
      for (let k = 0; k < 8; k++) {
        const y = 1 + k * 3.85;
        curve(
          out,
          Array.from({ length: 41 }, (_, j) => F(a0 + (j * Math.PI) / 40, y)),
          0.09,
          white,
          'metal',
          8,
        );
        box(
          out,
          'concrete',
          [cc[0] - 2.3, y - 0.25, cc[2] - 1.5],
          [cc[0] + 2.3, y, cc[2] + 1.5],
          concrete,
        );
      }
    }
}
function fixedRoof(out) {
  const sideBottom = (z) => 31 + (3.25 * (z - 46)) / 34;
  for (const s of [-1, 1]) {
    const o = transformed(out, (s * Math.PI) / 2, [0, 0, 0]);
    box(o, 'metal', [-68, 34.5, 45.8], [68, 35.2, 82], white);
    // Dark glazed rooflights are separate inset strips in the original fixed canopy.
    for (let x = -61; x <= 61; x += 10)
      box(o, 'glass', [x - 0.55, 35.23, 53], [x + 0.55, 35.31, 78], glass);
    for (let x = -65; x <= 65; x += 10) {
      for (const z of [46, 51.5, 57, 62.5, 68, 73.5]) {
        tube(o, 'metal', [x, 34.4, z], [x, sideBottom(z + 5.5), z + 5.5], 0.13, steel, 10);
        tube(o, 'metal', [x, sideBottom(z), z], [x, 34.4, z + 5.5], 0.13, steel, 10);
      }
      beam(o, 'metal', [x, sideBottom(46), 46], [x, sideBottom(80), 80], 0.25, 0.3, steel);
    }
    for (const z of [46, 80]) {
      beam(o, 'metal', [-68, 34.4, z], [68, 34.4, z], 0.27, 0.32, steel);
      beam(o, 'metal', [-68, sideBottom(z), z], [68, sideBottom(z), z], 0.26, 0.28, steel);
      for (let x = -68; x < 68; x += 5.5)
        tube(o, 'metal', [x, sideBottom(z), z], [Math.min(x + 5.5, 68), 34.4, z], 0.105, steel, 8);
    }
    // Moving-roof running rail, wheel track and inspection walk.
    box(o, 'metal', [-98, 35.3, 46.5], [98, 35.57, 48], steel);
    for (let x = -93; x < 94; x += 5) {
      box(o, 'metal', [x - 0.7, 35.6, 46.2], [x + 0.7, 35.9, 48.2], steel);
      box(o, 'metal', [x - 0.2, 35.9, 46.55], [x + 0.2, 36.1, 47.85], dark);
    }
    rail(o, [-67, 35.3, 81], [67, 35.3, 81]);
  }
  for (const s of [-1, 1]) {
    const o = transformed(out, s > 0 ? 0 : Math.PI, [0, 0, 0]);
    box(o, 'metal', [-47, 34.1, 67.5], [47, 34.6, 99.5], white);
    const endBottom = (z) => 31 + (2.8 * (z - 68)) / 31;
    for (let x = -43; x <= 43; x += 9) {
      for (const z of [68, 74, 80, 86, 92])
        tube(o, 'metal', [x, endBottom(z), z], [x, 34, z + 6], 0.11, steel, 8);
      beam(o, 'metal', [x, endBottom(68), 68], [x, endBottom(99), 99], 0.22, 0.24, steel);
    }
    // Inner edge truss carries the permanent end canopy and lighting catwalk.
    for (const y of [31, 34]) beam(o, 'metal', [-47, y, 67], [47, y, 67], 0.25, 0.26, steel);
    for (let x = -47; x < 47; x += 4.7)
      tube(o, 'metal', [x, 31, 67], [x + 4.7, 34, 67], 0.095, steel, 8);
  }
  for (const x of [-45, 45])
    for (let z = -64; z <= 64; z += 3.1) {
      const o = transformed(out, x > 0 ? Math.PI / 2 : -Math.PI / 2, [x, 31, z]);
      box(o, 'metal', [-0.6, -0.25, -0.22], [0.6, 0.4, 0.3], dark);
      face(
        o,
        'glass',
        [
          [-0.5, -0.15, -0.23],
          [0.5, -0.15, -0.23],
          [0.5, 0.3, -0.23],
          [-0.5, 0.3, -0.23],
        ],
        [0.81, 0.87, 0.8],
        [0, 0, -1],
      );
    }
}
function retractableRoof(out) {
  // Thirteen 94m-wide arched box girders park together above the north end.
  const top = (x) => 35.7 + 4.7 * Math.max(0, 1 - (x / 47) ** 2) ** 0.68,
    bottom = (x) => top(x) - 3.1;
  for (let g = 0; g < 13; g++) {
    const z = 72.5 + g * 1.96;
    for (const dz of [-0.48, 0.48]) {
      for (const Y of [top, bottom])
        curve(
          out,
          Array.from({ length: 81 }, (_, j) => {
            const x = -47 + (j * 94) / 80;
            return [x, Y(x), z + dz];
          }),
          0.15,
          white,
          'metal',
          12,
        );
      for (let j = 0; j < 32; j++) {
        const x = -47 + (j * 94) / 32,
          X = x + 94 / 32;
        tube(out, 'metal', [x, bottom(x), z + dz], [X, top(X), z + dz], 0.075, white, 8);
        tube(out, 'metal', [x, top(x), z + dz], [x, bottom(x), z + dz], 0.075, white, 8);
      }
    }
    for (let j = 0; j <= 32; j++) {
      const x = -47 + (j * 94) / 32;
      tube(out, 'metal', [x, top(x), z - 0.48], [x, top(x), z + 0.48], 0.07, white, 8);
      tube(out, 'metal', [x, bottom(x), z - 0.48], [x, bottom(x), z + 0.48], 0.065, white, 8);
    }
    for (const x of [-47, 47])
      box(out, 'metal', [x - 0.7, 35.6, z - 0.8], [x + 0.7, 36.4, z + 0.8], steel);
    if (g === 12) continue;
    for (let j = 0; j < 80; j++)
      for (let k = 0; k < 6; k++) {
        const x = -47 + (j * 94) / 80,
          X = x + 94 / 80,
          t = k / 6,
          T = (k + 1) / 6;
        const P = (x, t) => [x, top(x) + 0.05 - 1.25 * Math.sin(t * Math.PI), z + 1.96 * t];
        const ps = [P(x, t), P(X, t), P(X, T), P(x, T)];
        face(out, 'membrane', ps, white, [0, 1, 0]);
        face(
          out,
          'membrane',
          ps.map((p) => [p[0], p[1] - 0.035, p[2]]),
          white,
          [0, -1, 0],
        );
      }
  }
}
function details(out) {
  soccerPitch(out);
  for (const z of [-56.8, 56.8])
    box(out, 'plastic', [-43, 0.05, z - 0.15], [43, 0.85, z + 0.15], dark);
  for (const x of [-36.8, 36.8])
    box(out, 'plastic', [x - 0.15, 0.05, -52], [x + 0.15, 0.85, 52], dark);
  for (const x of [-46, 46])
    for (const z of [-64, 64]) {
      const a = Math.atan2(x, z),
        o = transformed(out, a, [x, 26, z]);
      box(o, 'metal', [-5, 0, -0.4], [5, 5, 0.3], steel);
      face(
        o,
        'glass',
        [
          [-4.8, 0.2, -0.42],
          [4.8, 0.2, -0.42],
          [4.8, 4.8, -0.42],
          [-4.8, 4.8, -0.42],
        ],
        dark,
        [0, 0, -1],
      );
    }
  // Home and away shelters on the A sideline, kept clear of the touchline.
  for (const z of [-14, 14]) {
    const o = transformed(out, -Math.PI / 2, [-38, 0, z]);
    box(o, 'concrete', [-5, 0.04, -1.1], [5, 0.2, 1.1], concrete);
    for (let i = 0; i < 16; i++) chair(o, 0, [-4.5 + i * 0.57, 0.22, 0.3], red);
    for (const x of [-5, 5])
      curve(
        o,
        [
          [x, 0.2, -1],
          [x, 2, -1],
          [x, 2.5, 0.5],
          [x, 2.5, 1],
        ],
        0.05,
        steel,
        'metal',
        8,
      );
    face(
      o,
      'acrylic',
      [
        [-5, 2, -1],
        [5, 2, -1],
        [5, 2.5, 0.5],
        [-5, 2.5, 0.5],
      ],
      [0.75, 0.84, 0.85],
      [0, 1, 0],
    );
  }
}
export function buildParken(out) {
  longStands(out);
  endStands(out);
  offices(out);
  fixedRoof(out);
  retractableRoof(out);
  details(out);
}
export const parkenStudy = {
  id: 'N0707',
  key: 'parken_stadium',
  wikidataId: 'Q33003',
  title: 'Parken Stadium',
  build: buildParken,
  metricTriangleUv: true,
  smoothNormalSlots: ['trim'],
  size: [167, 42, 207],
  nativeAxes: {
    up: '+Y',
    front: '+Z',
    origin:
      'Mapped playing enclosure centre at Y0; +Z points northwest to the D family stand, +X southwest toward Oster Alle and the C stand.',
  },
  visualBrief:
    'A rectilinear Danish national stadium with three steep double-tier red stands, the lower 2009 telescopic D stand beneath glazed offices, four cream corner office blocks with field-facing curved stair glazing, original flat canopies and thirteen parked arched roof girders. Open central pitch and visible folded fabric preserve its normal match-day silhouette.',
  sourceFacts: {
    published:
      'Operator:105x68m field; A/B/C have two levels and D one; four corner office towers. The 2026 roof renewal describes13000m2 fabric at35m height on13 girders. Roof engineer gives140x94m opening system. C.F.Moller describes8-storey office corners. The club documents the2009 fixed-plus-telescopic D replacement.',
    reconstructed:
      'Street widths and pitch axis follow exact OSM identities; mapped turf polygon includes broad side runoff and is not treated as an84m playing field. Concrete bays, tier rows, roof-truss sections, curved stair radii and glazed office proportions are reconstructed from primary photos. The2009 D stand replaces the historic open end visible in1992 architect photography.',
  },
  referencePages: [
    'https://www.parkenstadion.dk/om-parken-stadion/om-parken',
    'https://www.parkenstadion.dk/om-parken-stadion/stadions-historie',
    'https://www.parkenstadion.dk/dit-besog-i-parken/tribune-indgangsoversigt',
    'https://www.parkenstadion.dk/nyhed/ny-tagdug-pa-parken',
    'https://knas.dk/projekter/parken/',
    'https://www.cfmoller.com/p/Parken-Denmarks-National-Stadium-i34.html',
    'https://www.fck.dk/nyhed/superbest-tribune-staar-klar-medio-2009',
    'https://www.fck.dk/nyhed/vaeggen-vaek',
    'https://www.openstreetmap.org/way/26263036',
    'https://www.openstreetmap.org/way/171015425',
  ],
  referenceRights:
    'Original geometry from public primary dimensions and reference photographs, which are not embedded. Coordinate derivatives ©OpenStreetMap contributors, ODbL1.0.',
  geographicProposal: {
    status: 'preview-proposal',
    anchor: plan.anchor,
    heading: plan.heading,
    elevationMode: 'terrain-contact',
    groundModelY: 0,
    groundContactReviewed: true,
    groundContactBasis:
      'Y0 is the field and street plane. Diagonal concrete seating rakers have a0.358m beveled footing end below that contact plane; this is buried foundation thickness, not a building offset.',
    source: 'https://www.openstreetmap.org/way/171015425',
    featureIds: ['way/26263036', 'way/171015425'],
    notes:
      'Exact mapped pitch axis determines the northwest/southeast direction; operator street/stand plan places the D end northwest and C along Oster Alle southwest, resolving axis sign. Y0 is the field and street contact datum. Roof and office reconstruction fits the mapped whole stadium envelope.',
  },
  limitations: [
    'Static detailed exterior with roof parked open; retractable roof and telescopic stand animation, individual private rooms, sponsor graphics and exact chair inventory are excluded. Unpublished local sections and facade modules are photo-reconstructed rather than as-built measurements.',
  ],
  previewCamera: { position: [202, 148, -233], lookAt: [0, 15, 0] },
  qaCameras: [
    { name: 'near-roof-storage', position: [57, 53, 110], lookAt: [0, 37, 86] },
    { name: 'near-roof-girders', position: [-29, 43, 78], lookAt: [-6, 36, 86] },
    { name: 'near-fixed-canopy', position: [28, 26, -32], lookAt: [63, 32, -12] },
    { name: 'near-corner-office', position: [98, 27, -118], lookAt: [62, 18, -81] },
    { name: 'near-stair-atrium', position: [30, 22, -42], lookAt: [49, 17, -66] },
    { name: 'near-d-family', position: [0, 11, 21], lookAt: [0, 17, 82] },
    { name: 'near-d-street', position: [49, 18, 134], lookAt: [14, 15, 96] },
    { name: 'near-c-street', position: [112, 18, -11], lookAt: [77, 14, 0] },
    { name: 'near-b-goal-stand', position: [0, 12, 21], lookAt: [0, 17, -83] },
    { name: 'near-bowl', position: [17, 30, 68], lookAt: [0, 13, -12] },
    { name: 'near-hospitality', position: [29, 16, 19], lookAt: [55, 14, 3] },
    { name: 'far-open-roof', position: [-181, 154, -221], lookAt: [0, 17, 0] },
  ],
};
