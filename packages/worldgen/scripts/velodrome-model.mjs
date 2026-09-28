/** SCAU's completed Stade Velodrome: four-lobed white shell and independent spatial steel frame. */
import { beam, cross, loft, normalize } from './authored-structure-mesh.mjs';
import { transformed } from './lighthouse-models.mjs';
import { chair, face, soccerPitch } from './stadium-models.mjs';
import { box, tube } from './structure-mesh.mjs';
import { velodromePlan } from './velodrome-plan.mjs';

const TAU = Math.PI * 2,
  white = [0.96, 0.965, 0.945],
  pale = [0.75, 0.75, 0.7],
  concrete = [0.55, 0.56, 0.53],
  steel = [0.37, 0.42, 0.42],
  dark = [0.025, 0.035, 0.045],
  blue = [0.035, 0.19, 0.38];
const radial = (a, r, y) => [r * Math.sin(a), y, r * Math.cos(a)],
  mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function ray(poly, a) {
  const d = [Math.sin(a), Math.cos(a)],
    hits = [];
  for (let i = 1; i < poly.length; i++) {
    const p = poly[i - 1],
      q = poly[i],
      e = [q[0] - p[0], q[1] - p[1]],
      den = d[0] * e[1] - d[1] * e[0];
    if (Math.abs(den) < 1e-10) continue;
    const t = (p[0] * e[1] - p[1] * e[0]) / den,
      u = (p[0] * d[1] - p[1] * d[0]) / den;
    if (t > 0 && u >= 0 && u <= 1) hits.push(t);
  }
  if (!hits.length) throw Error('Velodrome ray misses envelope');
  return Math.max(...hits);
}
const outer = (a) => ray(velodromePlan.outer, a),
  inner = (a) => ray(velodromePlan.inner, a);
function continuous(out, ps, r, color = steel, sides = 8, slot = 'metal') {
  const rings = ps.map((p, i) => {
    const before = ps[Math.max(0, i - 1)],
      after = ps[Math.min(ps.length - 1, i + 1)],
      axis = normalize(after.map((v, k) => v - before[k])),
      u = normalize(cross(axis, [0, 1, 0])),
      v = cross(axis, u);
    return Array.from({ length: sides }, (_, j) =>
      p.map(
        (x, k) => x + r * (u[k] * Math.cos((j * TAU) / sides) + v[k] * Math.sin((j * TAU) / sides)),
      ),
    );
  });
  loft(out, slot, rings, color);
}
const roofHeight = (a) => 41 + 9 * Math.cos(4 * a) + 9 * Math.sin(a) ** 2;
function roofPoint(a, t) {
  return radial(
    a,
    inner(a) + (outer(a) - inner(a)) * t,
    roofHeight(a) + 6 * Math.sin(Math.PI * t) - t,
  );
}
function rounded(a, hx, hz, r, y = 0) {
  const dx = Math.abs(Math.sin(a)),
    dz = Math.abs(Math.cos(a));
  let t = Math.min(hx / (dx || 1e-9), hz / (dz || 1e-9));
  if (t * dx > hx - r && t * dz > hz - r) {
    const x = hx - r,
      z = hz - r,
      d = x * dx + z * dz;
    t = d + Math.sqrt(Math.max(0, d * d - x * x - z * z + r * r));
  }
  return radial(a, t, y);
}
function rail(out, ps) {
  for (const h of [0.5, 1.05])
    continuous(
      out,
      ps.map((p) => [p[0], p[1] + h, p[2]]),
      0.025,
      steel,
      6,
    );
  for (let i = 0; i < ps.length; i += 4)
    beam(out, 'metal', ps[i], [ps[i][0], ps[i][1] + 1.05, ps[i][2]], 0.04, 0.04, steel);
}
function shell(out) {
  const segments = 80,
    rows = 8,
    sub = 10;
  for (let i = 0; i < segments; i++)
    for (let j = 0; j < rows; j++) {
      const point = (u, v) => {
        const a = ((i + u) * TAU) / segments,
          t = (j + v) / rows,
          p = roofPoint(a, t);
        p[1] += 0.95 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
        return p;
      };
      for (let k = 0; k < sub; k++)
        for (let l = 0; l < sub; l++) {
          const ps = [
            point(k / sub, l / sub),
            point((k + 1) / sub, l / sub),
            point((k + 1) / sub, (l + 1) / sub),
            point(k / sub, (l + 1) / sub),
          ];
          face(out, 'membrane', ps, white, [0, 1, 0]);
          face(
            out,
            'membrane',
            ps.map((p) => [p[0], p[1] - 0.055, p[2]]),
            white,
            [0, -1, 0],
          );
        }
    }
  // Horizontal inner/outer chords and the diagonal tubes form the independent double-layer space frame.
  for (let layer = 0; layer < 2; layer++)
    for (let j = 0; j <= rows; j++) {
      const ps = Array.from({ length: segments + 1 }, (_, i) => {
        const p = roofPoint((i * TAU) / segments, j / rows);
        return [p[0], p[1] - 0.55 - layer * 3.2, p[2]];
      });
      continuous(out, ps, j === 0 || j === rows ? 0.25 : 0.13, steel, 10);
    }
  for (let i = 0; i < segments; i++) {
    const a = (i * TAU) / segments,
      b = ((i + 1) * TAU) / segments;
    for (let layer = 0; layer < 2; layer++)
      continuous(
        out,
        Array.from({ length: rows + 1 }, (_, j) => {
          const p = roofPoint(a, j / rows);
          return [p[0], p[1] - 0.55 - layer * 3.2, p[2]];
        }),
        0.135,
        steel,
        10,
      );
    for (let j = 0; j < rows; j++) {
      const top = roofPoint(a, j / rows).map((v, k) => v - (k === 1 ? 0.55 : 0)),
        next = roofPoint(b, (j + 1) / rows).map((v, k) => v - (k === 1 ? 3.75 : 0));
      tube(out, 'metal', top, next, 0.1, steel, 8);
      const other = roofPoint(a, (j + 1) / rows).map((v, k) => v - (k === 1 ? 3.75 : 0));
      tube(out, 'metal', top, other, 0.1, steel, 8);
      box(
        out,
        'metal',
        [top[0] - 0.19, top[1] - 0.19, top[2] - 0.19],
        [top[0] + 0.19, top[1] + 0.19, top[2] + 0.19],
        steel,
      );
    }
  }
  // The25m fabric skirt follows the four lobes down around the concrete stands.
  for (let i = 0; i < 768; i++) {
    const a = (i * TAU) / 768,
      b = ((i + 1) * TAU) / 768,
      topA = roofPoint(a, 1),
      topB = roofPoint(b, 1),
      bottomA = [topA[0], topA[1] - 25, topA[2]],
      bottomB = [topB[0], topB[1] - 25, topB[2]];
    face(out, 'membrane', [bottomA, bottomB, topB, topA], white, [Math.sin(a), 0, Math.cos(a)]);
    face(
      out,
      'membrane',
      [
        [bottomA[0] * 0.9995, bottomA[1], bottomA[2] * 0.9995],
        [bottomB[0] * 0.9995, bottomB[1], bottomB[2] * 0.9995],
        [topB[0] * 0.9995, topB[1], topB[2] * 0.9995],
        [topA[0] * 0.9995, topA[1], topA[2] * 0.9995],
      ],
      white,
      [-Math.sin(a), 0, -Math.cos(a)],
    );
    if (i % 2 === 0) tube(out, 'metal', bottomA, topA, 0.035, [0.72, 0.75, 0.73], 6);
    if (i % 8 === 0) {
      tube(
        out,
        'metal',
        [bottomA[0] * 0.995, bottomA[1], bottomA[2] * 0.995],
        [topA[0] * 0.995, topA[1], topA[2] * 0.995],
        0.16,
        steel,
        10,
      );
    }
  }
  for (const v of [0, 1])
    rail(
      out,
      Array.from({ length: 385 }, (_, i) => roofPoint((i * TAU) / 384, v)),
    );
  // Four large independent supports have flange cheeks and genuine bolted baseplates.
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2,
      R = outer(a) - 7,
      p = radial(a, R, 0),
      head = roofPoint(a, 0.91),
      o = transformed(out, a, p);
    box(o, 'concrete', [-2.4, -0.1, -2.4], [2.4, 0.95, 2.4], concrete);
    tube(out, 'metal', [p[0], 0.95, p[2]], [head[0], head[1] - 3.6, head[2]], 1.05, steel, 40);
    box(o, 'metal', [-1.7, 0.95, -1.7], [1.7, 1.12, 1.7], steel);
    for (const x of [-1.5, 1.5])
      for (const z of [-1.5, -0.75, 0, 0.75, 1.5])
        tube(o, 'metal', [x, 1.12, z], [x, 1.31, z], 0.095, [0.3, 0.33, 0.33], 8);
    for (const x of [-0.95, 0.95])
      beam(o, 'metal', [x, 1.1, -1.6], [x, 3.4, -0.5], 0.12, 0.5, steel);
  }
  // Two screens occupy the diagonal Jean Bouin/north and Ganay/south corners.
  for (const a of [Math.PI / 4, Math.PI * 1.25]) {
    const p = roofPoint(a, 0),
      o = transformed(out, a, [p[0], p[1] - 11, p[2]]);
    box(o, 'metal', [-6.3, 0, -0.4], [6.3, 7.3, 0.4], steel);
    box(o, 'glass', [-6, 0.3, -0.45], [6, 7, -0.42], dark);
    for (const x of [-4.5, 4.5]) tube(o, 'metal', [x, 7.3, 0], [x, 10.5, 0], 0.06, steel, 8);
  }
  for (let i = 0; i < 96; i++) {
    const a = (i * TAU) / 96,
      p = roofPoint(a, 0.015),
      o = transformed(out, a, [p[0], p[1] - 3.8, p[2]]);
    box(o, 'metal', [-1, -0.35, -0.6], [1, 0.35, 0.2], steel);
    for (const x of [-0.7, 0, 0.7])
      box(o, 'plastic', [x - 0.25, -0.22, -0.63], [x + 0.25, 0.22, -0.59], [0.9, 0.93, 0.88]);
  }
}
const letters = {
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  I: ['111', '010', '010', '010', '010', '010', '111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
};
const namePixels = Array.from({ length: 7 }, (_, row) =>
  [...'MARSEILLE'].map((c) => `${letters[c][row]}0`).join(''),
);
function seatColor(p, row) {
  if (p[0] < -70 && row >= 37 && row < 51) {
    const c = Math.floor((47 - p[2]) * 0.57),
      r = 6 - Math.floor((row - 37) / 2);
    if (namePixels[r]?.[c] === '1') return blue;
  }
  return white.map((v) => v * (0.87 + ((Math.floor(p[0]) + Math.floor(p[2])) % 5) * 0.012));
}
function bowlPoint(a, row) {
  const t = row / 78,
    p0 = rounded(a, 45, 66, 10, 1.1),
    r0 = Math.hypot(p0[0], p0[2]),
    r1 = outer(a) - 10;
  const top = 33 + 11 * Math.sin(a) ** 2,
    concourse = row >= 32 ? 3 : 0;
  return radial(a, r0 + (r1 - r0 - 3) * t + concourse, 1.1 + top * t + (row >= 32 ? 1.3 : 0));
}
function bowl(out) {
  const n = 576;
  for (let row = 0; row < 78; row++) {
    for (let i = 0; i < n; i++) {
      const a = (i * TAU) / n,
        b = ((i + 1) * TAU) / n,
        p = bowlPoint(a, row),
        q = bowlPoint(b, row),
        r = bowlPoint(b, row + 1),
        s = bowlPoint(a, row + 1);
      face(out, 'concrete', [p, q, [r[0], q[1], r[2]], [s[0], p[1], s[2]]], pale, [0, 1, 0]);
      face(out, 'concrete', [[s[0], p[1], s[2]], [r[0], q[1], r[2]], r, s], concrete, [
        -Math.sin(a),
        0,
        -Math.cos(a),
      ]);
    }
    const ps = Array.from({ length: n + 1 }, (_, i) => bowlPoint((i * TAU) / n, row + 0.38));
    let carry = 0;
    for (let i = 1; i < ps.length; i++) {
      const a = ps[i - 1],
        b = ps[i],
        L = Math.hypot(b[0] - a[0], b[2] - a[2]);
      for (let d = 0.52 - carry; d < L; d += 0.52) {
        const p = mix(a, b, d / L),
          angle = Math.atan2(p[0], p[2]),
          sector = ((((angle / TAU) * 40) % 1) + 1) % 1;
        if (sector < 0.05 || sector > 0.95) continue;
        if (Math.abs(Math.sin(angle)) > 0.87 && row >= 29 && row < 36) continue;
        chair(out, Math.atan2(-(b[2] - a[2]), b[0] - a[0]), p, seatColor(p, row));
      }
      carry = (carry + L) % 0.52;
    }
  }
  rail(
    out,
    Array.from({ length: 289 }, (_, i) => bowlPoint((i * TAU) / 288, 0)),
  );
  for (let k = 0; k < 40; k++) {
    const a = (k * TAU) / 40;
    rail(
      out,
      Array.from({ length: 79 }, (_, j) => bowlPoint(a, j)),
    );
    for (const row of [18, 45, 65]) {
      const p = bowlPoint(a, row),
        o = transformed(out, a, p);
      box(o, 'concrete', [-1.5, 0, -0.12], [1.5, 2.6, 2.5], pale);
      box(o, 'glass', [-1.2, 0.03, -0.18], [1.2, 2.35, -0.14], dark);
    }
  }
  // Hospitality and press bands occur on the two long sides, not around the retained end terraces.
  for (const side of [-1, 1])
    for (let i = 0; i < 96; i++) {
      const a = (side * Math.PI) / 2 - 0.46 + (i * 0.92) / 96,
        b = (side * Math.PI) / 2 - 0.46 + ((i + 1) * 0.92) / 96,
        p = bowlPoint(a, 29),
        q = bowlPoint(b, 29);
      face(
        out,
        'glass',
        [p, q, [q[0], q[1] + 3.1, q[2]], [p[0], p[1] + 3.1, p[2]]],
        [0.15, 0.23, 0.24],
        [-Math.sin(a), 0, -Math.cos(a)],
      );
      if (i % 2 === 0) beam(out, 'metal', p, [p[0], p[1] + 3.1, p[2]], 0.09, 0.09, steel);
    }
  for (let i = 0; i < 576; i++) {
    const a = (i * TAU) / 576,
      b = ((i + 1) * TAU) / 576,
      p = bowlPoint(a, 0),
      q = bowlPoint(b, 0),
      r = rounded(a, 41.9, 61, 8, 0),
      s = rounded(b, 41.9, 61, 8, 0);
    face(out, 'concrete', [[p[0], 0, p[2]], [q[0], 0, q[2]], s, r], pale, [0, 1, 0]);
  }
  soccerPitch(out);
}
function exterior(out) {
  for (let i = 0; i < 960; i++) {
    const a = (i * TAU) / 960,
      b = ((i + 1) * TAU) / 960,
      R = outer(a) - 9,
      S = outer(b) - 9,
      y = Math.min(roofPoint(a, 1)[1] - 25, 25),
      j = Math.min(roofPoint(b, 1)[1] - 25, 25);
    face(
      out,
      'glass',
      [radial(a, R, 0), radial(b, S, 0), radial(b, S, j), radial(a, R, y)],
      [0.11, 0.18, 0.2],
      [Math.sin(a), 0, Math.cos(a)],
    );
    for (let h = 0; h < Math.min(y, j); h += 3.8) {
      const top = Math.min(h + 0.25, y, j);
      face(
        out,
        'concrete',
        [radial(a, R - 5, h), radial(b, S - 5, h), radial(b, S + 0.5, h), radial(a, R + 0.5, h)],
        concrete,
        [0, 1, 0],
      );
      face(
        out,
        'concrete',
        [radial(a, R, h), radial(b, S, h), radial(b, S, top), radial(a, R, top)],
        pale,
        [Math.sin(a), 0, Math.cos(a)],
      );
      const p = radial(a, R + 0.15, h),
        o = transformed(out, a, p),
        fin = (i + Math.floor(h / 3.8)) % 2 === 0;
      const width = Math.hypot(
        S * Math.sin(b) - R * Math.sin(a),
        S * Math.cos(b) - R * Math.cos(a),
      );
      if (h > 0 && fin)
        box(
          o,
          'metal',
          [-width * 0.41, 0.15, 0.02],
          [width * 0.41, Math.min(3.5, y - h), 0.18],
          white,
        );
      if (h > 0) {
        beam(
          o,
          'metal',
          [-width * 0.47, 0.1, 0.23],
          [-width * 0.47, Math.min(3.65, y - h), 0.23],
          0.075,
          0.12,
          steel,
        );
        box(o, 'metal', [-width * 0.5, 0.05, 0.02], [width * 0.5, 0.25, 0.13], dark);
      }
    }
    if (i % 20 === 0)
      beam(
        out,
        'concrete',
        radial(a, R + 0.5, 0),
        radial(a, R + 0.5, Math.max(y, 8)),
        0.65,
        0.7,
        pale,
      );
    if (i % 10 === 0) {
      const o = transformed(out, a, radial(a, R + 0.08, 0));
      box(o, 'glass', [-1.3, 0, -0.1], [1.3, 2.7, 0.1], [0.17, 0.23, 0.24]);
      for (const x of [-1.3, 0, 1.3])
        beam(o, 'metal', [x, 0, 0.14], [x, 2.7, 0.14], 0.055, 0.065, steel);
    }
    face(
      out,
      'concrete',
      [
        radial(a, R - 0.6, 0),
        radial(b, S - 0.6, 0),
        radial(b, outer(b) + 4.5, 0),
        radial(a, outer(a) + 4.5, 0),
      ],
      pale,
      [0, 1, 0],
    );
  }
  // Monumental end approaches are shallow flights within the close stadium apron.
  for (const a of [0, Math.PI]) {
    const R = outer(a) - 9.6,
      o = transformed(out, a, radial(a, R, 0));
    for (let i = 0; i < 30; i++)
      box(
        o,
        'concrete',
        [-27, i * 0.18, 17 - i * 0.56],
        [27, (i + 1) * 0.18, 17 - (i - 1) * 0.56],
        pale,
      );
    // The upper stair landing meets a glazed entrance bank at its own elevation.
    const entry = transformed(out, a, radial(a, outer(a) - 8.9, 5.4));
    for (const x of [-18, -9, 0, 9, 18]) {
      box(entry, 'glass', [x - 3.1, 0, -0.1], [x + 3.1, 3.3, 0.1], [0.13, 0.21, 0.24]);
      for (const dx of [-3.1, -1.55, 0, 1.55, 3.1])
        beam(entry, 'metal', [x + dx, 0, 0.14], [x + dx, 3.3, 0.14], 0.07, 0.1, steel);
      box(entry, 'metal', [x - 3.2, 3.25, -0.15], [x + 3.2, 3.42, 0.28], white);
    }
    for (const x of [-25, -12, 0, 12, 25]) {
      continuous(
        o,
        [
          [x, 1.1, 17.6],
          [x, 6.5, 0.6],
        ],
        0.03,
        steel,
        8,
      );
      for (let i = 0; i < 15; i++)
        beam(
          o,
          'metal',
          [x, i * 0.36, 17 - i * 1.12],
          [x, i * 0.36 + 1.1, 17 - i * 1.12],
          0.04,
          0.04,
          steel,
        );
    }
  }
}
export function buildVelodrome(out) {
  bowl(out);
  shell(out);
  exterior(out);
}
export const velodromeStudy = {
  id: 'N0693',
  key: 'stade_velodrome',
  wikidataId: 'Q202150',
  title: 'Stade Vélodrome',
  build: buildVelodrome,
  metricTriangleUv: true,
  smoothNormalSlots: ['trim', 'roof'],
  size: [266, 67, 280],
  nativeAxes: {
    up: '+Y',
    front: '+Z',
    origin:
      'Mapped playing-field center; +Z north-northwest, +X west toward Jean Bouin. Y0 is the playing-field/close-apron reference plane.',
  },
  previewCamera: { position: [217, 149, 233], lookAt: [0, 26, 0] },
  visualBrief:
    'The completed Marseille stadium has a billowing white four-lobed canopy and25m hanging skirt. True curved membrane bays cover the independent double-layer steel lattice, four heavy supports and bolted bases. White seats and blue MARSEILLE lettering, side hospitality bands, diagonal screens, floodlights, alternating facade fins, glazing, end steps and doors distinguish the existing stadium from a generic arena.',
  sourceFacts: {
    published:
      'SCAU identifies the completed2014,67000-seat stadium. Bouygues describes an independent steel roof on four support points. FHECOR publishes its executed structural lattice and connection photographs. The operator specifies the25m facade skirt, and UEFA describes the white undulating canopy.',
    reconstructed:
      'Exact roof/aperture and pitch outlines derive from OSM, with all four named stand plans. Relative roof lobe heights, membrane camber, structural member diameters, chair inventory and concourse/entry levels are reconstructed from primary completed photographs and engineering illustrations. OSM’s43m grandstand height supplies a scale cross-check, not a roof survey.',
  },
  referencePages: [
    'https://www.scau.com/fr/project/stade-velodrome',
    'https://fhecor.com/proyecto.php?id=310',
    'https://www.bouygues-construction.com/en/activities/sports-tourism-and-leisure/sport-tourism-leisure/stade-orange-velodrome',
    'https://www.cepacvelodrome.com/stade.html',
    'https://www.uefa.com/uefaeuro/history/news/0253-0d7f9e2fe7d3-50109c1f2a87-1000--stade-velodrome-in-marseille-inaugurated/',
    'https://www.openstreetmap.org/relation/12756313',
    'https://www.openstreetmap.org/way/466491650',
  ],
  referenceRights:
    'Original authored geometry and shared procedural materials. Primary reference photographs and engineering drawings are evidence only; no source pixels or external mesh are embedded. Plan coordinates derive from OpenStreetMap contributors under ODbL1.0.',
  geographicProposal: {
    status: 'preview-proposal',
    anchor: velodromePlan.anchor,
    heading: velodromePlan.heading,
    elevationMode: 'terrain-contact',
    groundModelY: 0,
    groundContactReviewed: true,
    groundContactBasis:
      'Y0 is the close apron/playing-field reference plane. Support footings extend0.1m below it. The model contains no below-grade seating bowl; detailed external terrain gradients beyond the apron are left to host terrain.',
    source: 'https://www.openstreetmap.org/way/466491650',
    featureIds: [
      'relation/12756313',
      'way/258497433',
      'way/346501086',
      'way/346503284',
      'way/346504071',
    ],
    notes:
      'The mapped pitch directs +Z north-northwest and the actual roof trace fixes the asymmetric envelope. The west Jean Bouin facade occupies+X; Ganay and the MARSEILLE seating motif lie east at-X. The asset includes the close apron, with neighboring Delort stadium and the surrounding commercial district excluded.',
  },
  limitations: [
    'Detailed completed exterior and visible football bowl. Exact member topology, seat inventory, membrane pretension and varying street grades remain architectural reconstruction. Enclosed hospitality/service rooms and temporary event installations are outside the model. Sponsor graphics are omitted from the permanent architectural shell.',
  ],
  importOptions: { optimize: false },
  qaCameras: [
    { name: 'near-membrane-bays', position: [80, 75, 15], lookAt: [90, 61, 15] },
    { name: 'near-space-frame', position: [0, 11, 3], lookAt: [60, 50, 18] },
    { name: 'near-skirt', position: [139, 35, 38], lookAt: [117, 40, 25] },
    { name: 'near-four-supports', position: [91, 4, 105], lookAt: [82, 6, 90] },
    { name: 'near-seating-lettering', position: [25, 13, 0], lookAt: [-82, 24, 0] },
    { name: 'near-hospitality', position: [25, 8, -8], lookAt: [70, 20, 0] },
    { name: 'near-west-facade', position: [142, 13, 10], lookAt: [118, 12, 0] },
    { name: 'near-end-steps', position: [22, 8, 152], lookAt: [0, 5, 119] },
    { name: 'near-screen', position: [0, 22, 15], lookAt: [50, 35, 60] },
    { name: 'far-white-shell', position: [-218, 170, 213], lookAt: [0, 25, 0] },
  ],
};
