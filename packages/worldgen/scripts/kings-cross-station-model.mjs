/** Original King's Cross station study. Arup Journal 2/2012 supplies the principal sections.
 * All geometry is editable; repeated shed ribs and facade bays are stored once in the GLB.
 */
import { beam, loft } from './authored-structure-mesh.mjs';
import { compactAuthoredMesh } from './compact-authored-mesh.mjs';
import { archBay, face, frame, transform, triangle } from './heritage-tower-detail-mesh.mjs';
import { box, tube } from './structure-mesh.mjs';

const brick = [0.55, 0.46, 0.31],
  stone = [0.66, 0.61, 0.49],
  steel = [0.82, 0.84, 0.82];
const iron = [0.12, 0.15, 0.16],
  glass = [0.34, 0.43, 0.48],
  slate = [0.22, 0.24, 0.25];
const tau = Math.PI * 2,
  radius = 15.24,
  spring = 6.8,
  length = 244;
// Origin is the approximate combined station/concourse plan centre, not the clock tower.
const shift = 34;
const P = (x, y, z) => [x + shift, y, z];

/** Close the rear of the facade spandrels; ordinary archBay supplies front and reveals. */
function backedArch(out, ...args) {
  const z = args[7],
    depth = args[8];
  archBay(
    {
      ...out,
      addQuad(slot, ref, points, normal, uv, color) {
        out.addQuad(slot, ref, points, normal, uv, color);
        if (normal[2] > 0.99 && points.every((p) => Math.abs(p[2] - z) < 1e-8))
          face(out, slot, points.map((p) => [p[0], p[1], p[2] - depth]).reverse(), color);
      },
    },
    ...args,
  );
}

function roofRib(out) {
  const point = (a, r = radius) => [Math.cos(a) * r, spring + Math.sin(a) * r, 0];
  for (let i = 0; i < 64; i++) {
    const a = (i * Math.PI) / 64,
      b = ((i + 1) * Math.PI) / 64;
    beam(out, 'metal', point(a), point(b), 0.18, 0.3, steel);
    beam(out, 'metal', point(a, radius - 0.75), point(b, radius - 0.75), 0.12, 0.13, steel);
    if (i % 2 === 0) beam(out, 'metal', point(a), point(b, radius - 0.75), 0.075, 0.08, steel);
  }
}

function trainShed(out) {
  // Two separate barrels, with longitudinal panel strips and the restored crown PV strips.
  for (const cx of [-16.4, 16.4]) {
    for (let j = 0; j < 48; j++) {
      const a = (j * Math.PI) / 48,
        b = ((j + 1) * Math.PI) / 48;
      const p = (angle, z, r = radius + 0.23) =>
        P(cx + Math.cos(angle) * r, spring + Math.sin(angle) * r, z);
      const color =
        j > 19 && j < 28
          ? [0.18, 0.23, 0.28]
          : j % 4 === 0
            ? [0.55, 0.6, 0.61]
            : [0.39, 0.46, 0.49];
      face(out, 'glass', [p(b, -122), p(b, 122), p(a, 122), p(a, -122)], color);
      face(
        out,
        'glass',
        [
          p(a, -122, radius + 0.19),
          p(a, 122, radius + 0.19),
          p(b, 122, radius + 0.19),
          p(b, -122, radius + 0.19),
        ],
        color,
      );
      beam(out, 'metal', p(a, -122), p(a, 122), 0.065, 0.09, steel);
    }
    for (let z = -122; z <= 122; z += 3.05) {
      for (const angle of [0.25, 0.8, 1.27, 1.87, 2.34, 2.89]) {
        const a = P(
          cx + Math.cos(angle) * (radius + 0.26),
          spring + Math.sin(angle) * (radius + 0.26),
          z,
        );
        box(
          out,
          'metal',
          [a[0] - 0.05, a[1] - 0.05, a[2] - 0.045],
          [a[0] + 0.05, a[1] + 0.05, a[2] + 0.045],
          steel,
        );
      }
    }
  }
  // Platforms remain independently readable below the shed. Rolling stock is not baked in.
  box(out, 'concrete', P(-34, 0, -122), P(34, 0.15, 122), [0.36, 0.36, 0.34]);
  for (const x of [-27, -13.5, 0, 13.5, 27]) {
    box(out, 'concrete', P(x - 2.55, 0.15, -122), P(x + 2.55, 0.85, 108), [0.51, 0.5, 0.47]);
    for (const side of [-1, 1])
      box(
        out,
        'limestone_raw',
        P(x + side * 2.5 - 0.08, 0.85, -122),
        P(x + side * 2.5 + 0.08, 0.9, 108),
        [0.8, 0.78, 0.67],
      );
  }
  for (const x of [-31, -22, -18, -9, -4.5, 4.5, 9, 18, 22, 31]) {
    for (const s of [-1, 1])
      box(
        out,
        'metal',
        P(x + s * 0.72 - 0.035, 0.2, -122),
        P(x + s * 0.72 + 0.035, 0.35, 101),
        iron,
      );
    for (let z = -120; z < 101; z += 0.7)
      box(out, 'wood', P(x - 1.1, 0.15, z - 0.09), P(x + 1.1, 0.21, z + 0.09), [0.22, 0.2, 0.16]);
  }
  // Separate 65 m footbridge and its glazed parapets, clear of the barrel intrados.
  box(out, 'metal', P(-32.5, 5.3, -45), P(32.5, 6, -41), steel);
  for (const z of [-45, -41]) {
    box(out, 'glass', P(-32.5, 6, z - 0.045), P(32.5, 7.35, z + 0.045), glass);
    box(out, 'metal', P(-32.5, 7.35, z - 0.055), P(32.5, 7.44, z + 0.055), steel);
    for (let x = -32; x < 33; x += 1.5)
      box(out, 'metal', P(x - 0.025, 6, z - 0.055), P(x + 0.025, 7.4, z + 0.055), steel);
  }
}

function archGlazing(out, cx, z) {
  // A semicircular window with real mullion geometry; no rectangular backing across the arch.
  const y0 = 7.2,
    r = 14.65;
  for (let i = 0; i < 72; i++) {
    const a = (i * Math.PI) / 72,
      b = ((i + 1) * Math.PI) / 72;
    const points = [
      [cx, y0, z],
      [cx + Math.cos(a) * r, y0 + Math.sin(a) * r, z],
      [cx + Math.cos(b) * r, y0 + Math.sin(b) * r, z],
    ];
    triangle(out, 'glass', points, glass);
    triangle(out, 'glass', points.map((p) => [p[0], p[1], p[2] - 0.02]).reverse(), glass);
  }
  for (let x = -14; x <= 14; x += 1.75) {
    const top = y0 + Math.sqrt(r * r - x * x);
    box(out, 'metal', [cx + x - 0.045, y0, z + 0.01], [cx + x + 0.045, top, z + 0.15], iron);
  }
  for (let y = y0 + 1.75; y < y0 + r; y += 1.75) {
    const w = Math.sqrt(r * r - (y - y0) ** 2);
    box(out, 'metal', [cx - w, y - 0.035, z + 0.01], [cx + w, y + 0.035, z + 0.15], iron);
  }
  for (let i = 0; i < 96; i++) {
    const a = (i * Math.PI) / 96,
      b = ((i + 1) * Math.PI) / 96;
    beam(
      out,
      'metal',
      [cx + Math.cos(a) * r, y0 + Math.sin(a) * r, z + 0.08],
      [cx + Math.cos(b) * r, y0 + Math.sin(b) * r, z + 0.08],
      0.1,
      0.12,
      iron,
    );
  }
}

function clock(out) {
  for (const angle of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    const t = transform(out, angle, [shift, 0, 121]);
    const y = 29.5,
      z = 3.02,
      r = 1.68;
    for (let i = 0; i < 96; i++) {
      const a = (i * tau) / 96,
        b = ((i + 1) * tau) / 96;
      triangle(
        t,
        'limestone_raw',
        [
          [0, y, z],
          [Math.cos(a) * r, y + Math.sin(a) * r, z],
          [Math.cos(b) * r, y + Math.sin(b) * r, z],
        ],
        stone,
      );
      beam(
        t,
        'metal',
        [Math.cos(a) * r, y + Math.sin(a) * r, z + 0.06],
        [Math.cos(b) * r, y + Math.sin(b) * r, z + 0.06],
        0.105,
        0.12,
        iron,
      );
    }
    for (let i = 0; i < 60; i++) {
      const a = (i * tau) / 60,
        ri = i % 5 ? 1.48 : 1.19;
      beam(
        t,
        'metal',
        [Math.sin(a) * ri, y + Math.cos(a) * ri, z + 0.09],
        [Math.sin(a) * 1.57, y + Math.cos(a) * 1.57, z + 0.09],
        i % 5 ? 0.035 : 0.075,
        0.035,
        iron,
      );
    }
    beam(t, 'metal', [0, y, z + 0.16], [-0.65, y + 0.76, z + 0.16], 0.1, 0.04, iron);
    beam(t, 'metal', [0, y, z + 0.2], [0.85, y + 1.04, z + 0.2], 0.065, 0.04, iron);
  }
}

function front(out) {
  const t = transform(out, 0, [shift, 0, 0]);
  for (const cx of [-16.4, 16.4]) {
    backedArch(t, 'brick', cx, 29.3, 7.2, 7.2, 14.65, 24.4, 124, 1.65, brick, {
      back: false,
      trim: 0.35,
    });
    archGlazing(t, cx, 122.35);
    for (let i = 0; i < 5; i++) {
      const x = cx + (i - 2) * 5.55;
      backedArch(t, 'brick', x, 4.2, 0.2, 3.1, 2.1, 7.2, 124, 1.65, brick, {
        back: false,
        trim: 0.14,
      });
      box(t, 'brick', [x - 2.775, 0.2, 122.35], [x - 2.1, 7.2, 124], brick);
      box(t, 'brick', [x + 2.1, 0.2, 122.35], [x + 2.775, 7.2, 124], brick);
      box(t, 'glass', [x - 2.05, 0.25, 122.31], [x + 2.05, 3.1, 122.34], glass);
      for (const sx of [-1, 0, 1])
        box(
          t,
          'metal',
          [x + sx * 1.3 - 0.04, 0.25, 122.4],
          [x + sx * 1.3 + 0.04, 3.1, 122.5],
          iron,
        );
    }
    for (const y of [7.1, 23.8, 24.5])
      box(t, 'limestone_raw', [cx - 15.5, y, 123.8], [cx + 15.5, y + 0.23, 124.28], stone);
  }
  for (const x of [-33.3, 0, 33.3]) {
    const width = x === 0 ? 5.9 : 3.5;
    box(t, 'brick', [x - width / 2, 0, 119], [x + width / 2, 25, 124.4], brick);
    for (const y of [1, 23.8, 24.8])
      box(
        t,
        'limestone_raw',
        [x - width / 2 - 0.2, y, 118.8],
        [x + width / 2 + 0.2, y + 0.25, 124.6],
        stone,
      );
    for (const dx of [-0.62, 0.62])
      box(t, 'shadow', [x + dx - 0.075, 11.7, 124.42], [x + dx + 0.075, 14.1, 124.44], iron);
    if (x !== 0) tube(t, 'metal', [x, 25, 121.7], [x, 27.8, 121.7], 0.045, iron, 12);
  }
  for (const s of [-1, 1]) {
    const ends = [s * 31.0, s * 31.6].sort((a, b) => a - b);
    box(t, 'brick', [ends[0], 0.2, 122.35], [ends[1], 24.4, 124], brick);
  }
  box(t, 'brick', [-2.85, 25, 118.15], [2.85, 32.45, 123.85], brick);
  box(t, 'limestone_raw', [-3.25, 32.3, 117.75], [3.25, 32.65, 124.25], stone);
  loft(
    t,
    'slate',
    [
      [
        [-3.5, 32.65, 117.5],
        [-3.5, 32.65, 124.5],
        [3.5, 32.65, 124.5],
        [3.5, 32.65, 117.5],
      ],
      [
        [-0.06, 34.4, 120.94],
        [-0.06, 34.4, 121.06],
        [0.06, 34.4, 121.06],
        [0.06, 34.4, 120.94],
      ],
    ],
    slate,
  );
  tube(t, 'metal', [0, 34.4, 121], [0, 36, 121], 0.045, iron, 12);
  beam(t, 'metal', [-0.7, 35.5, 121], [0.7, 35.5, 121], 0.045, 0.035, iron);
  clock(out);
  // The later southern canopy is a shallow clear shelter, not the removed 1970s hall.
  for (let x = -32; x <= 32; x += 4) {
    tube(t, 'metal', [x, 0, 127.2], [x, 4.5, 127.2], 0.055, steel, 12);
    beam(t, 'metal', [x, 4.45, 122.8], [x, 4.55, 128], 0.08, 0.15, steel);
  }
  face(
    t,
    'glass',
    [
      [-34, 4.5, 122.8],
      [-34, 4.62, 128],
      [34, 4.62, 128],
      [34, 4.5, 122.8],
    ],
    [0.64, 0.7, 0.7],
  );
}

function rangeBay(out) {
  // Complete shallow wall module with distinct lower, Venetian and upper sash windows.
  const windows = [
    { y: 1.1, h: 3.15, w: 2.1 },
    { y: 6.5, h: 3.5, w: 1.75 },
    { y: 12.3, h: 2.6, w: 1.65 },
  ];
  let previous = 0;
  for (const [i, w] of windows.entries()) {
    box(out, 'brick', [-2.25, previous, -0.5], [2.25, w.y, 0.25], brick);
    for (const s of [-1, 1]) {
      const a = s < 0 ? -2.25 : w.w / 2,
        b = s < 0 ? -w.w / 2 : 2.25;
      box(out, 'brick', [a, w.y, -0.5], [b, w.y + w.h + 0.3, 0.25], brick);
    }
    backedArch(out, 'brick', 0, w.w, w.y, w.y + w.h - 0.3, 0.3, w.y + w.h + 0.3, 0.25, 0.6, brick, {
      back: false,
      trim: 0.07,
    });
    box(out, 'glass', [-w.w / 2, w.y, -0.38], [w.w / 2, w.y + w.h, -0.35], glass);
    frame(out, 'metal', 0, w.y, w.w, w.h - 0.3, -0.3, 0.055, steel);
    for (const x of [-w.w / 6, w.w / 6])
      box(out, 'metal', [x - 0.022, w.y, -0.3], [x + 0.022, w.y + w.h - 0.3, -0.22], steel);
    for (let y = w.y + 0.62; y < w.y + w.h - 0.3; y += 0.62)
      box(out, 'metal', [-w.w / 2, y - 0.022, -0.3], [w.w / 2, y + 0.022, -0.22], steel);
    box(
      out,
      'limestone_raw',
      [-w.w / 2 - 0.12, w.y - 0.13, -0.05],
      [w.w / 2 + 0.12, w.y, 0.5],
      stone,
    );
    if (i === 1)
      box(
        out,
        'limestone_raw',
        [-1.08, w.y + w.h + 0.2, 0.1],
        [1.08, w.y + w.h + 0.38, 0.5],
        stone,
      );
    previous = w.y + w.h + 0.3;
  }
  box(out, 'brick', [-2.25, previous, -0.5], [2.25, 18.3, 0.25], brick);
  for (const y of [5.55, 11.6, 17.95])
    box(out, 'limestone_raw', [-2.25, y, 0.18], [2.25, y + 0.16, 0.5], stone);
}

function ranges(out) {
  // Slabs and roofs leave the facade recesses unobstructed; the range is not a solid box.
  for (const [a, b] of [
    [-49, -33.8],
    [33.8, 46.8],
  ]) {
    for (const y of [0.15, 5.65, 11.7, 17.8])
      box(out, 'concrete', P(a + 0.55, y, -120), P(b - 0.55, y + 0.2, 122), [0.45, 0.44, 0.4]);
    box(out, 'brick', P(a, 0, -120.3), P(b, 18.4, -119.7), brick);
    const frontCenter = (a + b) / 2;
    for (const x of [-4.5, 0, 4.5]) rangeBay(transform(out, 0, P(frontCenter + x, 0, 122)));
    for (const [left, right] of [
      [a, frontCenter - 6.75],
      [frontCenter + 6.75, b],
    ])
      if (right > left) box(out, 'brick', P(left, 0, 121.5), P(right, 18.4, 122.25), brick);
    const cx = (a + b) / 2;
    for (const s of [-1, 1]) {
      const roof = [
        P(cx, 21, -120),
        P(cx, 21, 122),
        P(s < 0 ? a : b, 18.4, 122),
        P(s < 0 ? a : b, 18.4, -120),
      ];
      face(out, 'slate', s < 0 ? roof.reverse() : roof, slate);
    }
    for (let z = -111; z < 117; z += 22.5) {
      box(out, 'brick', P(cx - 1.1, 19.8, z - 0.7), P(cx + 1.1, 23.2, z + 0.7), brick);
      box(out, 'limestone_raw', P(cx - 1.2, 23.1, z - 0.8), P(cx + 1.2, 23.3, z + 0.8), stone);
      for (const x of [-0.72, 0, 0.72])
        tube(out, 'brick', P(cx + x, 23.3, z), P(cx + x, 24, z), 0.18, [0.4, 0.32, 0.24], 12);
    }
  }
  // The mapped western boundary tapers sharply toward the northern end.
  // Its independent roof heights remain a study, not an extrusion of the combined station.
  const left = (z) => -80 + ((-z - 11) * 28) / 115;
  loft(
    out,
    'concrete',
    [0, 0.25].map((y) => [
      P(left(-121), y, -121),
      P(left(-22), y, -22),
      P(-49, y, -22),
      P(-49, y, -121),
    ]),
    [0.42, 0.42, 0.4],
  );
  const at = (u, z) =>
    P(
      left(z) + (-49 - left(z)) * u,
      8 + (-49 - left(z)) * 0.14 * Math.min(u % 0.5, 0.5 - (u % 0.5)) * 4,
      z,
    );
  for (let band = 0; band < 4; band++) {
    const a = band / 4,
      b = (band + 1) / 4;
    face(out, 'glass', [at(a, -121), at(a, -22), at(b, -22), at(b, -121)], [0.38, 0.46, 0.48]);
    beam(out, 'metal', at(a, -121), at(a, -22), 0.1, 0.16, steel);
    for (let z = -121; z <= -22; z += 4.5) beam(out, 'metal', at(a, z), at(b, z), 0.12, 0.2, steel);
  }
  for (let z = -120; z < -22; z += 12)
    tube(out, 'metal', P(left(z), 0, z), P(left(z), 8, z), 0.09, steel, 12);
}

// Three tangent circles give a continuously differentiable meridian, informed by Fig.3.
// The paper supplies the construction, not these radii; they remain a section-fit study.
function roofY(r) {
  if (r <= 24) return Math.sqrt(Math.max(0, 21 * 21 - (r - 24) ** 2));
  if (r <= 58) return -49 + Math.sqrt(70 * 70 - (r - 24) ** 2);
  const cy = -49 + 1.2 * Math.sqrt(70 * 70 - 34 * 34);
  return cy - Math.sqrt(14 * 14 - (r - 64.8) ** 2);
}
const roofPoint = (r, a) => P(-49 - r * Math.cos(a), roofY(r), 51 + r * Math.sin(a));
function concourse(out) {
  const rs = [3, 3.7, 5, 7, 10, 14, 18.5, 24, 29, 34, 39, 44, 49, 54, 58, 62, 66, 69],
    count = 64;
  for (let row = 0; row < rs.length - 1; row++) {
    const rowCount = row < 7 ? 16 : count;
    for (let j = 0; j < rowCount; j++) {
      const a = -Math.PI / 2 + (j * Math.PI) / rowCount,
        b = -Math.PI / 2 + ((j + 1) * Math.PI) / rowCount;
      const p = roofPoint(rs[row], a),
        q = roofPoint(rs[row + 1], a),
        s = roofPoint(rs[row], b),
        t = roofPoint(rs[row + 1], b);
      if (row >= 7) {
        beam(out, 'metal', p, q, 0.15, 0.3, steel);
        beam(out, 'metal', p, s, 0.1, 0.14, steel);
        beam(out, 'metal', row % 2 ? p : s, row % 2 ? t : q, 0.14, 0.14, steel);
      } else {
        // The open funnel is crossed diagonal steelwork, not an array of upright spokes.
        beam(out, 'metal', p, t, 0.15, 0.3, steel);
        beam(out, 'metal', s, q, 0.15, 0.3, steel);
      }
      if (j === rowCount - 1) beam(out, 'metal', s, t, 0.15, 0.3, steel);
      if (row >= 6) {
        const panel = (p) => [p[0], p[1] + 0.2, p[2]];
        const points = [p, q, t, s].map(panel);
        face(out, 'metal', points, [0.73, 0.74, 0.7]);
        face(
          out,
          'metal',
          points.map((p) => [p[0], p[1] - 0.04, p[2]]).reverse(),
          [0.68, 0.7, 0.69],
        );
      }
    }
  }
  for (let j = 0; j < count; j++) {
    const a = -Math.PI / 2 + (j * Math.PI) / count,
      b = -Math.PI / 2 + ((j + 1) * Math.PI) / count;
    beam(out, 'metal', roofPoint(69, a), roofPoint(69, b), 0.22, 0.3, steel);
    // Low glazed wall along the arc; two wide entrance bays are left open.
    if (j > 5 && j < 59 && !(j > 28 && j < 36)) {
      const p = roofPoint(65, a),
        q = roofPoint(65, b);
      face(
        out,
        'glass',
        [
          [p[0], 0.1, p[2]],
          [q[0], 0.1, q[2]],
          [q[0], 6.1, q[2]],
          [p[0], 6.1, p[2]],
        ],
        glass,
      );
      tube(out, 'metal', [p[0], 0.1, p[2]], [p[0], 6.2, p[2]], 0.065, steel, 10);
    }
    triangle(
      out,
      'limestone_raw',
      [
        P(-49, 0.07, 51),
        roofPoint(68, a).map((v, i) => (i === 1 ? 0.07 : v)),
        roofPoint(68, b).map((v, i) => (i === 1 ? 0.07 : v)),
      ],
      [0.56, 0.55, 0.51],
    );
  }
  // Edge tree supports and branching brackets under the roof; radial locations are provisional.
  for (let j = 0; j <= 14; j++) {
    const a = -Math.PI / 2 + (j * Math.PI) / 14,
      p = roofPoint(63, a),
      base = [p[0], 0.1, p[2]],
      fork = [p[0], 5.5, p[2]];
    beam(out, 'metal', base, fork, 0.6, 1.4, steel);
    for (const da of [-0.045, 0.045])
      beam(out, 'metal', fork, roofPoint(65, a + da), 0.22, 0.35, steel);
  }
  // Balcony along the curved edge, with railing posts and a continuous handrail.
  for (let j = 0; j < 64; j++) {
    const a = -Math.PI / 2 + (j * Math.PI) / 64,
      b = -Math.PI / 2 + ((j + 1) * Math.PI) / 64;
    const p = (r, a, y) => P(-49 - r * Math.cos(a), y, 51 + r * Math.sin(a));
    face(out, 'concrete', [p(52, a, 5), p(65, a, 5), p(65, b, 5), p(52, b, 5)], [0.53, 0.52, 0.48]);
    face(out, 'glass', [p(52, a, 5), p(52, b, 5), p(52, b, 6.2), p(52, a, 6.2)], glass);
    beam(out, 'metal', p(52, a, 6.2), p(52, b, 6.2), 0.055, 0.055, steel);
    tube(out, 'metal', p(52, a, 5), p(52, a, 6.2), 0.04, steel, 10);
  }
}

const parts = [
  { name: 'main-train-sheds-and-platforms', build: trainShed, instances: [{}] },
  { name: 'southern-front-and-clock', build: front, instances: [{}] },
  { name: 'east-west-ranges-and-suburban-shed', build: ranges, instances: [{}] },
  { name: 'western-concourse', build: concourse, instances: [{}] },
  {
    name: 'repeated-barrel-roof-rib',
    build: roofRib,
    instances: [-16.4, 16.4].flatMap((x) =>
      Array.from({ length: 41 }, (_, i) => ({ translation: P(x, 0, -122 + (i * length) / 40) })),
    ),
  },
  {
    name: 'range-window-bay',
    build: rangeBay,
    instances: [
      [-49, -Math.PI / 2],
      [46.8, Math.PI / 2],
    ].flatMap(([x, angle]) =>
      Array.from({ length: 53 }, (_, i) => ({ translation: P(x, 0, -117 + i * 4.5), angle })),
    ),
  },
];

export const kingsCrossStation = {
  id: 'n0791_london_king_s_cross_railway_station',
  planId: 'N0791',
  category: 'railway_station',
  title: "London King's Cross railway station",
  wikidata: 'Q219867',
  authoringFile: 'kings-cross-station-model.mjs',
  build(out) {
    for (const part of parts)
      for (const instance of part.instances)
        part.build(transform(out, instance.angle ?? 0, instance.translation ?? [0, 0, 0]));
  },
  encodeAssembly(encode, join) {
    return join(
      parts.map((part) => ({ ...part, glb: encode(part.build, part.name) })),
      "Molen original King's Cross component assembly",
    );
  },
  decorateMesh: compactAuthoredMesh,
  size: [166, 36, 250],
  previewCamera: { position: [-190, 155, 285], lookAt: [-2, 10, 0], fov: 42 },
  front: '+Z is the southern clock facade; +X is east; +Y is up',
  origin:
    'Approximate combined station and concourse plan centre, at platform approach ground level',
  brief:
    'Individual twin barrel train sheds, stock-brick clock facade and glazed arches, separately articulated eastern/western ranges, suburban shed and three-circle western concourse shell with funnel and diagrid. Roof ribs and facade bays reuse mesh buffers across glTF nodes.',
  facts: {
    clockTowerHeightMeters: 36,
    concourseDiameterMeters: 138,
    concourseDescriptionMeters: [120, 20],
    platformBridgeMeters: 65,
    easternRangeLengthMeters: 240,
    roofRibBoxWidthMeters: 0.15,
    diagridTubeDiameterMeters: [0.139, 0.219],
    drawings:
      'Arup Journal 2/2012: photographs pp.8–9,11,15; station sections pp.10–11; three tangent-circle construction Fig.3 p.13; Western Range plan and historic section p.27; proposed square p.42.',
    dimensionsCaution:
      'The 30.48 m train span and detailed envelope proportions are a scaled section fit in this study, not an independent building survey. The 2012 square image is a proposal, not proof of current site conditions.',
  },
  refs: [
    'https://www.arup.com/globalassets/downloads/arup-journal/the-arup-journal-2012-issue-2.pdf',
    'https://historicengland.org.uk/listing/the-list/list-entry/1078328',
    'https://www.networkrail.co.uk/who-we-are/our-history/iconic-infrastructure/the-history-of-london-kings-cross-station/',
    'https://www.openstreetmap.org/way/260720558',
  ],
  scaleBasis:
    'The engineering report fixes the 36 m clock tower, 138 m concourse roof diameter and 65 m platform bridge. Train spans and range proportions follow the inspected scaled sections. Roof meridian radii fit the documented three-tangent-circle construction and remain provisional.',
  geographicProposal: {
    anchor: [-0.123780713, 51.532079651],
    heading: -0.039709233788,
    source: 'https://www.openstreetmap.org/way/260720558',
    orientationConfidence: 'axis-only',
    evidence:
      'Exact-QID combined footprint supplies the approximate anchor and long axis. Native +Z is the documented southern front.',
    limitations:
      'Separate building member footprints, concourse center, suburban shed boundary, signed heading and terrain datum require a map-overlay/site rendering. This study is not activated for automatic placement.',
  },
  limits: [
    'Detailed source study, not maximum-fidelity certification. The scene must be compared with current station photographs and surveyed member footprints.',
    'Western Range contains historically distinct ranges, the bomb gap, parcels atrium and booking hall. Current repeated facade modules require replacement with their precise individual elevations and openings.',
    'Clock tick marks stand in for Roman numerals; station name lettering, entrance fanlights, precise stone cornices, doors, drainage, roof lantern details, signage and shopfronts need individual authoring.',
    'The concourse uses a faithful construction method with estimated meridian radii and support positions. Exact diagrid topology, glazed roof zones, mezzanine boundaries and escalators are unfinished.',
    'Platforms and rails are schematic; no trains, underground station, adjacent hotel or square furnishings are embedded. Transparent glass and final lighting require further material review.',
  ],
  cameras: [
    { name: 'southern-front', position: [90, 29, 222], lookAt: [34, 16, 121] },
    { name: 'clock-face', position: [43, 31, 148], lookAt: [34, 30, 122] },
    { name: 'western-concourse', position: [-155, 65, 124], lookAt: [-49, 12, 47] },
    { name: 'concourse-funnel', position: [-49, 3.2, 54], lookAt: [-16, 15, 51] },
    { name: 'roof-assembly', position: [-115, 175, 218], lookAt: [-4, 9, 0] },
    { name: 'eastern-range', position: [171, 31, -12], lookAt: [80, 10, 3] },
    { name: 'shed-interior', position: [50, 4, 87], lookAt: [50, 14, -30] },
    { name: 'northern-sheds', position: [20, 46, -220], lookAt: [14, 10, -70] },
    { name: 'far-station', position: [-310, 230, 390], lookAt: [0, 12, 0] },
  ],
};
