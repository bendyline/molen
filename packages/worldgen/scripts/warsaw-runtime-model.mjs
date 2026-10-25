/** Independent reviewed Warsaw derivative; original master remains unchanged. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';

const frame = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u3/u3q/royal_castle_in_warsaw/reviewed-plan.json',
      import.meta.url,
    ),
  ),
);
const outer = frame.geometry.outline,
  court = frame.geometry.holes[0];
export const warsawPalette = {
  red: '#c97e65',
  court: '#d48c63',
  cream: '#e0dcc9',
  stone: '#cac4ac',
  roof: '#a96247',
  copper: '#5d927d',
  glass: '#415a60',
  brick: '#ae7159',
  clock: '#444c48',
  gold: '#d4b76b',
};
const colors = Object.fromEntries(
  Object.entries(warsawPalette).map(([k, h]) => [
    k,
    h
      .slice(1)
      .match(/../g)
      .map((v) => {
        const s = parseInt(v, 16) / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      }),
  ]),
);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rect = (o, s, x, y, z, w, h, d, c) =>
  box(o, s, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], colors[c]);
const area = (p) =>
  p.reduce((v, a, i) => {
    const b = p[(i + 1) % p.length];
    return v + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
function face(o, s, p, c, up = false) {
  if (up && normalFor(p[0], p[1], p[2])[1] < 0) p = [...p].reverse();
  for (let i = 1; i < p.length - 1; i++) {
    const t = [p[0], p[i], p[i + 1]];
    o.addTriangle(
      s,
      'palette:#ffffff',
      t,
      normalFor(...t),
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      colors[c],
    );
  }
}
function local(o, x, z, a = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    rot = ([u, y, v]) => [u * c + v * s, y, -u * s + v * c];
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (slot, r, p, n, uv, col) =>
        o[k](
          slot,
          r,
          p.map((v) => {
            const q = rot(v);
            return [q[0] + x, q[1], q[2] + z];
          }),
          rot(n),
          uv,
          col,
        ),
    ]),
  );
}
const edge = (o, a, b) => local(o, a[0], a[1], Math.atan2(a[1] - b[1], b[0] - a[0]));
function floor(o, rings, y, c = 'stone') {
  const points = rings.flat(),
    holes = [];
  let offset = rings[0].length;
  for (const r of rings.slice(1)) {
    holes.push(offset);
    offset += r.length;
  }
  const indices = earcut(points.flat(), holes, 2);
  for (let i = 0; i < indices.length; i += 3)
    face(
      o,
      'limestone',
      indices.slice(i, i + 3).map((j) => [points[j][0], y, points[j][1]]),
      c,
      true,
    );
}
function window(o, x, y, z, w, h, d) {
  // A pale outer quad and inset pane preserve frames at block distance with four triangles.
  if (d > 0)
    face(
      o,
      'limestone',
      [
        [x - w / 2 - 0.18, y - 0.18, z],
        [x + w / 2 + 0.18, y - 0.18, z],
        [x + w / 2 + 0.18, y + h + 0.18, z],
        [x - w / 2 - 0.18, y + h + 0.18, z],
      ],
      'cream',
    );
  face(
    o,
    'glass',
    [
      [x - w / 2, y, z + 0.025],
      [x + w / 2, y, z + 0.025],
      [x + w / 2, y + h, z + 0.025],
      [x - w / 2, y + h, z + 0.025],
    ],
    'glass',
  );
  if (d >= 2) rect(o, 'limestone', x, y - 0.25, z + 0.12, w + 0.6, 0.22, 0.4, 'stone');
  if (d === 3) {
    rect(o, 'limestone', x, y, z + 0.1, 0.15, h, 0.15, 'stone');
    rect(o, 'limestone', x, y + h * 0.54, z + 0.1, w, 0.16, 0.15, 'stone');
  }
}
function wall(
  o,
  a,
  b,
  y0,
  y1,
  color,
  d,
  { gate = false, grodzka = false, river = false, decorate = true } = {},
) {
  const g = edge(o, a, b),
    length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const panel = (left, right, bottom, top) =>
    face(
      g,
      'plaster',
      [
        [left, bottom, 0],
        [right, bottom, 0],
        [right, top, 0],
        [left, top, 0],
      ],
      color,
    );
  const center = gate
      ? (grodzka ? (8.68490825789657 - a[1]) / (b[1] - a[1]) : -a[0] / (b[0] - a[0])) * length
      : 0,
    r = grodzka ? 1.5 : 2.05,
    spring = grodzka ? 3 : 3.9;
  if (gate) {
    panel(0, center - r, y0, y1);
    panel(center + r, length, y0, y1);
    const n = d ? 8 : 4;
    for (let i = 0; i < n; i++) {
      const t = (i * Math.PI) / n,
        u = ((i + 1) * Math.PI) / n;
      face(
        g,
        'plaster',
        [
          [center + r * Math.cos(u), spring + r * Math.sin(u), 0],
          [center + r * Math.cos(t), spring + r * Math.sin(t), 0],
          [center + r * Math.cos(t), y1, 0],
          [center + r * Math.cos(u), y1, 0],
        ],
        color,
      );
    }
  } else panel(0, length, y0, y1);
  if (!decorate) return;
  for (const y of d === 1 ? [6.8, 18.9] : d ? [0.5, 6.8, 14.6, 18.9] : []) {
    if (gate && y < 6) {
      rect(g, 'limestone', (center - r) / 2, y, 0.08, center - r, 0.26, 0.25, 'cream');
      rect(
        g,
        'limestone',
        (length + center + r) / 2,
        y,
        0.08,
        length - center - r,
        0.26,
        0.25,
        'cream',
      );
    } else rect(g, 'limestone', length / 2, y, 0.08, length, 0.26, 0.25, 'cream');
  }
  if (!d || length < 3.8) return;
  const count = Math.max(1, Math.round(length / (d === 1 ? 5.8 : 4.4)));
  for (let i = 0; i < count; i++) {
    const x = ((i + 0.5) * length) / count;
    for (const [y, h] of [
      [2, 2.5],
      [8.1, 3.65],
      [15.6, 1.75],
    ]) {
      if (gate && Math.abs(x - center) < 3.5) continue;
      if (river && y === 2) archedReserve(g, x, 0.65, 0.08, 1.8, 4.8, d);
      else window(g, x, y, 0.06, 1.45, h, d);
    }
    if (river && d >= 2) {
      rect(g, 'limestone', x - (length / count) * 0.46, 6.9, 0.12, 0.45, 11.9, 0.32, 'cream');
      rect(g, 'limestone', x, 12.05, 0.2, 2, 0.32, 0.4, 'cream');
      if (d === 3)
        face(
          g,
          'limestone',
          [
            [x - 1.1, 12.45, 0.28],
            [x + 1.1, 12.45, 0.28],
            [x, 13.3, 0.28],
          ],
          'cream',
        );
    }
  }
}
function shell(o, d) {
  // Preserve the mapped rear bays, but collapse tiny collinear steps and the clock-tower lip.
  const ids = [
    7, 8, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 22, 23, 27, 28, 30, 37, 41, 42, 44, 45, 47, 49,
  ];
  const ring = ids.map((i) => outer[i]);
  if (area(ring) > 0) ring.reverse();
  const hole = [0, 4, 7, 8, 9, 10, 11, 12, 13, 15].map((i) => court[i]);
  if (area(hole) < 0) hole.reverse();
  for (const [points, inner] of [
    [ring, false],
    [hole, true],
  ])
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length],
        z = (a[1] + b[1]) / 2;
      const grodzka =
        Math.min(a[0], b[0]) > (inner ? 20 : 35) &&
        Math.min(a[1], b[1]) < 8.68490825789657 &&
        Math.max(a[1], b[1]) > 8.68490825789657;
      const gate =
        grodzka ||
        (Math.min(a[0], b[0]) < -3 && Math.max(a[0], b[0]) > 3 && (inner ? z > 32 : z > 49));
      const river = !inner && z < 18 && Math.max(a[0], b[0]) < 0;
      const gothic =
        inner && ((a === court[12] && b === court[13]) || (b === court[12] && a === court[13]));
      wall(o, a, b, 0, 19.2, inner ? 'court' : river ? 'cream' : 'red', d, {
        gate,
        grodzka,
        river,
        decorate: !gothic,
      });
    }
  floor(o, [ring, hole], 19.2, 'cream');
  floor(o, [hole], 0.04);
  // True barrel passage links Clock Gate and courtyard; no solid wall behind the arch.
  const n = d ? 8 : 4,
    r = 2.05;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n;
    face(
      o,
      'limestone',
      [
        [r * Math.cos(a), 3.9 + r * Math.sin(a), 50],
        [r * Math.cos(b), 3.9 + r * Math.sin(b), 50],
        [r * Math.cos(b), 3.9 + r * Math.sin(b), 33.9],
        [r * Math.cos(a), 3.9 + r * Math.sin(a), 33.9],
      ],
      'stone',
    );
  }
  for (const x of [-r, r]) {
    const p = [
      [x, 0, 33.9],
      [x, 0, 50],
      [x, 3.9, 50],
      [x, 3.9, 33.9],
    ];
    face(o, 'limestone', x > 0 ? p : [...p].reverse(), 'stone');
  }
}
function roof(o, p, eave, peak, slot = 'tile', color = 'roof') {
  // Four-sided roof patch between mapped outer and inner wing faces; ridge follows wing length.
  const a = mix(p[0], p[3], 0.5),
    b = mix(p[1], p[2], 0.5),
    r0 = mix(a, b, 0.1),
    r1 = mix(a, b, 0.9),
    ring = p.map(([x, z]) => [x, eave, z]),
    u = [r0[0], peak, r0[1]],
    v = [r1[0], peak, r1[1]];
  face(o, slot, [ring[0], ring[1], v, u], color, true);
  face(o, slot, [ring[1], ring[2], v], color, true);
  face(o, slot, [ring[2], ring[3], u, v], color, true);
  face(o, slot, [ring[3], ring[0], u], color, true);
}
function dome(o, x, z, y, r, height, d, spire = false) {
  const n = [6, 6, 12, 16][d],
    profile = spire
      ? [
          [0, 1],
          [0.08, 1.08],
          [0.16, 0.84],
          [0.22, 0.82],
          [0.45, 0.72],
          [0.52, 0.83],
          [0.72, 0.35],
          [0.88, 0.15],
          [1, 0.025],
        ]
      : d <= 1
        ? [
            [0, 1],
            [0.12, 1.2],
            [0.46, 0.86],
            [0.5, 0.65],
            [0.76, 0.65],
            [1, 0.03],
          ]
        : [
            [0, 1],
            [0.12, 1.2],
            [0.3, 1.22],
            [0.46, 0.86],
            [0.5, 0.65],
            [0.76, 0.65],
            [0.86, 0.88],
            [1, 0.03],
          ];
  loft(
    o,
    'copper',
    profile.map(([t, w]) => radialRing(y + t * height, r * w, r * w, n, [x, z])),
    colors.copper,
  );
  if (d >= 2) {
    if (!spire)
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4,
          g = local(o, x, z, a);
        window(g, 0, y + height * 0.55, r * 0.66, 0.52, height * 0.15, 1);
      }
    rect(o, 'limestone', x, y + height, z, 0.22, 1.2, 0.22, 'gold');
  }
}
function disc(o, x, y, z, r, c, n = 16) {
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n;
    face(
      o,
      'plaster',
      [
        [x, y, z],
        [x + Math.cos(a) * r, y + Math.sin(a) * r, z],
        [x + Math.cos(b) * r, y + Math.sin(b) * r, z],
      ],
      c,
    );
  }
}
function clock(o, d) {
  // Tower base shares the open gate; upper stages project a little beyond the city facade.
  rect(o, 'plaster', 0, 6.05, 46, 8.8, 28.95, 9.8, 'red');
  for (const y of [7, 14.6, 23.6, 26.8, 34.4])
    rect(o, 'limestone', 0, y, 46, 9.25, 0.45, 10.25, 'cream');
  dome(o, 0, 46, 35, 4.7, 9, d, true);
  if (!d) return;
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const g = local(o, 0, 46, a),
      z = a % Math.PI === 0 ? 4.94 : 4.44;
    for (const y of [8.2, 16.2]) window(g, 0, y, z + 0.05, 1.7, 3.2, d);
    disc(g, 0, 30.6, z + 0.1, 1.6, 'clock', d >= 2 ? 24 : 12);
    if (d >= 2) {
      for (let i = 0; i < 12; i++) {
        const t = (i * Math.PI) / 6;
        beam(
          g,
          'limestone',
          [Math.sin(t) * 1.18, 30.6 + Math.cos(t) * 1.18, z + 0.14],
          [Math.sin(t) * 1.43, 30.6 + Math.cos(t) * 1.43, z + 0.14],
          0.13,
          0.12,
          colors.gold,
        );
      }
      beam(g, 'limestone', [0, 30.6, z + 0.17], [0, 31.85, z + 0.17], 0.16, 0.13, colors.gold);
      beam(g, 'limestone', [0, 30.6, z + 0.19], [0.9, 30.9, z + 0.19], 0.2, 0.13, colors.gold);
      for (const x of [-3.65, 3.65])
        rect(g, 'limestone', x, 27.3, z + 0.02, 0.5, 6.8, 0.4, 'cream');
    }
  }
  // Broad rusticated entrance surround frames the passable opening.
  for (const x of [-3.1, 3.1]) rect(o, 'limestone', x, 0, 50.98, 1.05, 5.3, 0.55, 'stone');
  rect(o, 'limestone', 0, 6.2, 50.98, 7.3, 0.45, 0.55, 'stone');
}
function turret(o, x, z, d) {
  rect(o, 'plaster', x, 18.5, z, 4.4, 5.4, 4.4, 'red');
  rect(o, 'limestone', x, 23.6, z, 4.9, 0.4, 4.9, 'cream');
  dome(o, x, z, 24, 2.6, 6, d);
  if (d)
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
      window(local(o, x, z, a), 0, 20, 2.23, 0.7, 1.5, d);
}
function rear(o, d) {
  // Three pale projecting river pavilions: central copper crown and two tile pediments.
  const a = outer[8],
    b = outer[23],
    g = edge(o, a, b),
    length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  for (const t of [0.1, 0.51, 0.91]) {
    const x = length * t,
      central = t === 0.51,
      w = central ? 15 : 12;
    rect(g, 'plaster', x, 0, 1.6, w, 20.2, 5.1, 'cream');
    if (central) {
      roof(
        g,
        [
          [x - w / 2, 4.3],
          [x + w / 2, 4.3],
          [x + w / 2, -7],
          [x - w / 2, -7],
        ],
        20.2,
        26,
        'copper',
        'copper',
      );
      rect(g, 'limestone', x, 21.1, 4.22, 5.2, 1.35, 0.65, 'cream');
    } else {
      face(
        g,
        'limestone',
        [
          [x - w / 2, 20.2, 4.24],
          [x + w / 2, 20.2, 4.24],
          [x, 24.7, 4.24],
        ],
        'cream',
      );
      roof(
        g,
        [
          [x - w / 2, 4.2],
          [x + w / 2, 4.2],
          [x + w / 2, -8],
          [x - w / 2, -8],
        ],
        20.2,
        26,
      );
    }
    if (d)
      for (const xx of [-w * 0.3, 0, w * 0.3])
        for (const [y, h] of [
          [1.9, 2.8],
          [8.1, 3.8],
          [15, 2.7],
        ])
          if (y === 1.9) archedReserve(g, x + xx, 0.65, 4.25, 1.9, 4.8, d);
          else window(g, x + xx, y, 4.19, 1.6, h, d);
    if (d >= 2) {
      for (const xx of [-w * 0.45, -w * 0.16, w * 0.16, w * 0.45])
        rect(g, 'limestone', x + xx, 6.8, 4.32, 0.65, 13.5, 0.5, 'cream');
      for (const yy of [0.5, 6.7, 19.5])
        rect(g, 'limestone', x, yy, 4.25, w + 0.4, 0.45, 0.6, 'cream');
      // Sculptural crest is an abstract shield and two broad supports, not micro-statuary.
      rect(g, 'limestone', x, 23.5, 4.4, 1.3, 1.8, 0.55, 'cream');
      for (const s of [-1, 1])
        beam(
          g,
          'limestone',
          [x + s * 1.8, 23, 4.4],
          [x + s * 0.85, 25, 4.4],
          0.55,
          0.6,
          colors.cream,
        );
    }
  }
  // Low library wing extends from the southeast elbow along the upper garden.
  const p = [outer[4], outer[1], outer[49], outer[7]];
  for (let i = 0; i < 4; i++) {
    const q = p[i],
      r = p[(i + 1) % 4];
    const ring = area(p) < 0 ? [q, r] : [r, q];
    wall(o, ...ring, 0, 8.6, 'cream', 0, { decorate: false });
    if (d && Math.hypot(r[0] - q[0], r[1] - q[1]) > 20) {
      const f = edge(o, ...ring),
        length = Math.hypot(r[0] - q[0], r[1] - q[1]);
      for (let x = 4; x < length - 2; x += 5) window(f, x, 3, 0.05, 1.45, 3, d);
    }
  }
  roof(o, p, 8.6, 10.5, 'copper', 'copper');
}
function details(o, d) {
  if (!d) return;
  // The courtyard retains a distinct brick Gothic wall beside the Wladyslaw tower.
  const a = court[12],
    b = court[13],
    g = edge(o, a, b),
    l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  face(
    g,
    'brick',
    [
      [0, 0, 0.025],
      [l, 0, 0.025],
      [l, 13.8, 0.025],
      [0, 13.8, 0.025],
    ],
    'brick',
  );
  for (let x = 2.1; x < l - 1; x += 4.5) {
    const w = 1.6;
    face(
      g,
      'glass',
      [
        [x - w / 2, 8.4, 0.065],
        [x + w / 2, 8.4, 0.065],
        [x + w / 2, 12, 0.065],
        [x, 13.2, 0.065],
        [x - w / 2, 12, 0.065],
      ],
      'brick',
    );
  }
  for (let x = 3; x < l - 1; x += 4.5) {
    window(g, x, 2, 0.09, 1.4, 2.5, d);
    window(g, x, 8, 0.09, 1.4, 3.6, d);
    window(g, x, 15.6, 0.09, 1.4, 1.75, d);
  }
  // Selected dormers and chimneys replace roof-wide repeating detail.
  for (const x of [-35, -20, 19, 34]) {
    rect(o, 'plaster', x, 22.3, 46, 2.1, 1.8, 2.1, 'red');
    roof(
      o,
      [
        [x - 1.3, 47.3],
        [x + 1.3, 47.3],
        [x + 1.3, 44.7],
        [x - 1.3, 44.7],
      ],
      24.1,
      25.3,
    );
    if (d >= 2) window(o, x, 22.65, 47.08, 1, 0.95, 1);
  }
  if (d >= 2)
    for (const [x, z] of [
      [-39, 39],
      [-22, 39],
      [21, 39],
      [37, 39],
      [-41, 15],
      [36, 16],
      [-66, -9],
      [-40, -19],
      [-15, -31],
      [17, -28],
    ]) {
      rect(o, 'limestone', x, 23, z, 1.3, 4.8, 1.4, 'cream');
      rect(o, 'limestone', x, 27.6, z, 1.6, 0.3, 1.7, 'cream');
    }
}
function buildWarsawBody(o, level) {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3;
  shell(o, d);
  grodzkaBarrel(o, d);
  for (const p of [
    [outer[30], outer[37], court[15], court[0]],
    [outer[28], outer[30], court[0], court[4]],
    [outer[37], outer[41], court[13], court[15]],
    [outer[23], outer[8], court[7], outer[27]],
    [outer[8], outer[7], court[13], court[7]],
  ])
    roof(o, p, 19.2, 27);
  const elbow = [...[7, 47, 45, 44, 42, 41].map((i) => outer[i]), court[13]];
  for (let i = 0; i < elbow.length; i++) {
    const a = elbow[i],
      b = elbow[(i + 1) % elbow.length];
    face(
      o,
      'tile',
      [
        [a[0], 19.2, a[1]],
        [b[0], 19.2, b[1]],
        [44, 27, -30],
      ],
      'roof',
      true,
    );
  }
  rear(o, d);
  clock(o, d);
  turret(o, -46, 47.1, d);
  turret(o, 42.8, 47.1, d);
  // Mapped courtyard projection fixes the Wladyslaw tower; dome is reconstructed from photos.
  loft(
    o,
    'plaster',
    [radialRing(0, 4.1, 3.2, 8, [-2, -22]), radialRing(25.4, 4.1, 3.2, 8, [-2, -22])],
    colors.court,
  );
  dome(o, -2, -22, 25.4, 4.2, 10.6, d);
  if (d) for (const y of [1, 8, 15, 21]) window(o, -2, y, -18.72, 1.3, y === 1 ? 3.1 : 2.7, d);
  details(o, d);
}

const base = '../../../content/worldgen/source/places/u3/u3q/royal_castle_in_warsaw/';
const grade = JSON.parse(readFileSync(new URL(`${base}site-grade.json`, import.meta.url)));
export function warsawGround(x, z) {
  const g = grade.grid,
    u = Math.max(0, Math.min(g.width - 1.000001, (x - g.origin[0]) / g.stepMeters)),
    v = Math.max(0, Math.min(g.height - 1.000001, (z - g.origin[1]) / g.stepMeters)),
    i = Math.floor(u),
    j = Math.floor(v),
    fx = u - i,
    fz = v - j,
    at = (a, b) => g.heights[(j + b) * g.width + i + a] - grade.datumMeters;
  return (
    (at(0, 0) * (1 - fx) + at(1, 0) * fx) * (1 - fz) + (at(0, 1) * (1 - fx) + at(1, 1) * fx) * fz
  );
}
function archedReserve(o, x, bottom, z, w, h, d) {
  const r = w / 2,
    spring = bottom + h - r,
    n = d === 1 ? 4 : 8,
    p = [
      [x - r, bottom, z],
      [x + r, bottom, z],
      [x + r, spring, z],
    ];
  for (let i = 1; i <= n; i++) {
    const a = (i * Math.PI) / n;
    p.push([x + r * Math.cos(a), spring + r * Math.sin(a), z]);
  }
  face(o, 'glass', p, 'glass');
}
function grodzkaBarrel(o, d) {
  const r = 1.5,
    z = 8.68490825789657,
    n = d ? 8 : 4;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n;
    face(
      o,
      'limestone',
      [
        [29, 3 + r * Math.sin(a), z + r * Math.cos(a)],
        [44, 3 + r * Math.sin(a), z + r * Math.cos(a)],
        [44, 3 + r * Math.sin(b), z + r * Math.cos(b)],
        [29, 3 + r * Math.sin(b), z + r * Math.cos(b)],
      ].reverse(),
      'stone',
    );
  }
  for (const dz of [-r, r]) {
    const p = [
      [29, 0, z + dz],
      [44, 0, z + dz],
      [44, 3, z + dz],
      [29, 3, z + dz],
    ];
    face(o, 'limestone', dz < 0 ? p : [...p].reverse(), 'stone');
  }
}
function foundation(o) {
  let q = outer.slice(0, -1);
  if (area(q) > 0) q = [...q].reverse();
  floor(o, [q], 0, 'stone');
  for (let i = 0; i < q.length; i++) {
    const a = q[i],
      b = q[(i + 1) % q.length];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.0001) continue;
    face(
      o,
      'limestone',
      [
        [a[0], grade.foundationFloor - grade.architectureShift, a[1]],
        [b[0], grade.foundationFloor - grade.architectureShift, b[1]],
        [b[0], 0, b[1]],
        [a[0], 0, a[1]],
      ],
      'stone',
    );
  }
}
function apron(o, p, axis, len, width) {
  const [x, z] = p,
    [dx, dz] = axis,
    nx = (-dz * width) / 2,
    nz = (dx * width) / 2,
    top = 0.04,
    end = warsawGround(x + dx * len, z + dz * len) - grade.architectureShift + 0.05;
  const ps = [
    [x - nx, top, z - nz],
    [x + nx, top, z + nz],
    [x + dx * len + nx, end, z + dz * len + nz],
    [x + dx * len - nx, end, z + dz * len - nz],
  ];
  face(o, 'limestone', ps, 'stone', true);
}
const MEANS = {
  plaster: [0.8560149893924018, 0.8277277519506693, 0.7276425175607023],
  limestone: [0.753900431769648, 0.7102426360381505, 0.6162437456625109],
  tile: [0.5592671977481501, 0.5524651935698748, 0.5295030481008905],
  copper: [0.6357568684279634, 0.680368873795494, 0.6174688939562135],
  brick: [0.6203447773399442, 0.5498229265059562, 0.5049628982589958],
};
function reviewed(o, level) {
  const wrapped = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (s, r, p, _n, uv, c) => {
        const q = p.map((v) => [v[0], v[1] + grade.architectureShift, v[2]]);
        o[k](
          s,
          r,
          q,
          normalFor(...q),
          uv,
          level === 'skyline' ? c.map((v, i) => v * (MEANS[s]?.[i] ?? 1)) : c,
        );
      },
    ]),
  );
  buildWarsawBody(wrapped, level);
  foundation(wrapped);
  apron(wrapped, [0, 50.8], [0, 1], 10, 4.1);
  apron(wrapped, [43.65, 8.68490825789657], [1, 0], 16, 3);
}
export const buildWarsawReviewedMaster = (o) => reviewed(o, 'closeup');
export const buildWarsawReviewedSkyline = (o) => reviewed(o, 'skyline');
export const buildWarsawReviewedDistrict = (o) => reviewed(o, 'district');
export const buildWarsawReviewedStreet = (o) => reviewed(o, 'street');
export const buildWarsawReviewedCloseup = (o) => reviewed(o, 'closeup');
