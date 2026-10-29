/** Complete distant silhouette. Detailed source and near levels retain the original recipe. */
import {
  beam as fullBeam,
  sphere as fullSphere,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {
  box,
  tube as fullTube,
  quad,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const stone = [0.47, 0.465, 0.415],
  trim = [0.6, 0.585, 0.52],
  copper = [0.26, 0.44, 0.31],
  oxide = [0.44, 0.1, 0.065],
  glass = [0.16, 0.2, 0.21],
  pale = [0.82, 0.79, 0.69];
const rect = (y, cx, cz, rx, rz) => [
  [cx - rx, y, cz - rz],
  [cx - rx, y, cz + rz],
  [cx + rx, y, cz + rz],
  [cx + rx, y, cz - rz],
];
const polar = (r, y, angle) => [Math.sin(angle) * r, y, Math.cos(angle) * r];
// Fine divided-window bars flatten at street distance; structural frames retain their volume.
function beam(out, slot, a, b, width, depth, color) {
  if (slot === 'wood' && width <= 0.075 && depth <= 0.09 && Math.abs(b[2] - a[2]) < 1e-8) {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      len = Math.hypot(dx, dy),
      x = (-dy * width) / (2 * len),
      y = (dx * width) / (2 * len);
    face(
      out,
      slot,
      [
        [a[0] - x, a[1] - y, a[2] + depth / 2],
        [b[0] - x, b[1] - y, b[2] + depth / 2],
        [b[0] + x, b[1] + y, b[2] + depth / 2],
        [a[0] + x, a[1] + y, a[2] + depth / 2],
      ],
      color,
    );
  } else fullBeam(out, slot, a, b, width, depth, color);
}
function disc(out, x, y, z, r, color, n = 8) {
  for (let i = 0; i < n; i++) {
    const at = (a) => [x + Math.sin(a) * r, y + Math.cos(a) * r, z];
    triangle(
      out,
      'glass',
      [[x, y, z], at(((i + 1) * Math.PI * 2) / n), at((i * Math.PI * 2) / n)],
      color,
    );
  }
}
function radialProfile(out, slot, points, color, sides = 8) {
  loft(
    out,
    slot,
    points.map(([y, r]) => radialRing(y, r, r, sides)),
    color,
  );
}
export function bengtskarSkyline(out, district = false) {
  if (!district) {
    const target = out;
    // Match the viewer's shared-texture mean in this one-draw flat representation.
    out = Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((method) => [
        method,
        (slot, ref, points, normal, uv, color) =>
          target[method](
            slot,
            ref,
            points,
            normal,
            uv,
            slot === 'glass' ? color : color.map((value) => value * 0.65),
          ),
      ]),
    );
  }
  const profile = (o, slot, points, color) =>
    radialProfile(o, slot, points, color, district ? 16 : 8);
  const west = { cx: -12.109, cz: 1.4514, rx: 10.933, rz: 6.782 },
    east = { cx: 2.4507, cz: 0.1199, rx: 3.627, rz: 5.4505 };
  for (const [b, top] of [
    [west, 14.4],
    [east, 15.2],
  ]) {
    box(
      out,
      'granite',
      [b.cx - b.rx, 0, b.cz - b.rz],
      [b.cx + b.rx, 0.9, b.cz + b.rz],
      [0.37, 0.37, 0.33],
    );
    box(out, 'ashlar', [b.cx - b.rx, 0.9, b.cz - b.rz], [b.cx + b.rx, top, b.cz + b.rz], stone);
    // Keep three storeys on every exposed elevation with opaque inset-color window cards.
    for (let side = 0; side < 4; side++) {
      const f = transform(out, (side * Math.PI) / 2, [b.cx, 0, b.cz]),
        z = (side % 2 ? b.rx : b.rz) + 0.005;
      const xs = b === west ? (side % 2 ? [-3.4, 0, 3.4] : [-7.7, -3.85, 0, 3.85, 7.7]) : [0];
      for (const x of xs)
        for (const y of [1.6, 5.85, 10.05])
          face(
            f,
            'glass',
            [
              [x - 0.51, y, z],
              [x + 0.51, y, z],
              [x + 0.51, y + 1.9, z],
              [x - 0.51, y + 1.9, z],
            ],
            glass,
          );
    }
    for (const y of [0.94, 4.75, 14.3])
      box(
        out,
        'granite',
        [b.cx - b.rx - 0.1, y, b.cz - b.rz - 0.1],
        [b.cx + b.rx + 0.1, y + 0.14, b.cz + b.rz + 0.14],
        trim,
      );
  }
  loft(
    out,
    'metal',
    [
      rect(14.4, west.cx, west.cz, west.rx + 0.21, west.rz + 0.22),
      rect(17.95, west.cx, west.cz, west.rx + 0.21, 0.015),
    ],
    copper,
  );
  for (const sign of [-1, 1]) {
    const f = transform(out, sign === 1 ? Math.PI / 2 : -Math.PI / 2, [
      west.cx + sign * (west.rx + 0.211),
      0,
      west.cz,
    ]);
    triangle(
      f,
      'granite',
      [
        [-west.rz, 14.4, 0],
        [west.rz, 14.4, 0],
        [0, 17.95, 0],
      ],
      stone,
    );
  }
  box(
    out,
    'metal',
    [east.cx - east.rx - 0.16, 15.2, east.cz - east.rz - 0.16],
    [east.cx + east.rx + 0.16, 15.35, east.cz + east.rz + 0.16],
    copper,
  );
  // Curved pediment and oculus stay in the silhouette rather than becoming a missing roof section.
  const ped = transform(out, 0, [-11.5, 0, west.cz + west.rz + 0.03]),
    r = 2.8;
  box(ped, 'granite', [-r, 13.7, -0.45], [r, 15.15, 0], stone);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 8,
      b = ((i + 1) * Math.PI) / 8,
      p = [r * Math.cos(a), 15.15 + r * Math.sin(a), 0],
      q = [r * Math.cos(b), 15.15 + r * Math.sin(b), 0];
    triangle(ped, 'granite', [[0, 15.15, 0], p, q], stone);
    triangle(
      ped,
      'granite',
      [
        [0, 15.15, -0.45],
        [q[0], q[1], -0.45],
        [p[0], p[1], -0.45],
      ],
      stone,
    );
    face(ped, 'granite', [q, p, [p[0], p[1], -0.45], [q[0], q[1], -0.45]], trim);
  }
  disc(ped, 0, 15.95, 0.04, 1.34, trim);
  disc(ped, 0, 15.95, 0.05, 1.12, glass);
  face(
    ped,
    'wood',
    [
      [-0.045, 14.84, 0.06],
      [0.045, 14.84, 0.06],
      [0.045, 17.06, 0.06],
      [-0.045, 17.06, 0.06],
    ],
    oxide,
  );
  face(
    ped,
    'wood',
    [
      [-1.1, 15.91, 0.06],
      [1.1, 15.91, 0.06],
      [1.1, 16, 0.06],
      [-1.1, 16, 0.06],
    ],
    oxide,
  );
  for (const x of [-3.25, 3.25]) disc(ped, x, 15.05, 0.04, 0.62, trim);
  // Preserve the original five shaft profile stations; small windows become distant cards.
  const taper = [
    [15.3, 3.57],
    [20, 3.32],
    [27, 3.03],
    [34, 2.72],
    [39.7, 2.52],
  ];
  profile(out, 'ashlar', taper, stone);
  const radius = (y) => {
    let i = 1;
    while (i < taper.length - 1 && taper[i][0] < y) i++;
    const [a, r] = taper[i - 1],
      [b, s] = taper[i];
    return r + ((s - r) * (y - a)) / (b - a);
  };
  for (const a of [0, Math.PI])
    for (const y of [17, 22.4, 27.8, 33.2, 37.2]) {
      const f = transform(out, a),
        z = radius(y + 0.525) + 0.005;
      face(
        f,
        'glass',
        [
          [-0.26, y, z],
          [0.26, y, z],
          [0.26, y + 1.05, z],
          [-0.26, y + 1.05, z],
        ],
        glass,
      );
    }
  profile(
    out,
    'granite',
    [
      [39.6, 2.52],
      [39.9, 2.68],
      [40.1, 2.91],
      [40.3, 2.91],
    ],
    stone,
  );
  profile(
    out,
    'metal',
    [
      [40.3, 3],
      [40.45, 3],
    ],
    oxide,
  );
  // An open gallery outline is kept instead of an opaque red drum around the lantern.
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4,
      b = ((i + 1) * Math.PI) / 4,
      at = (r, y, t) => [Math.sin(t) * r, y, Math.cos(t) * r];
    face(
      out,
      'metal',
      [at(2.94, 41.55, a), at(2.94, 41.55, b), at(2.94, 41.6, b), at(2.94, 41.6, a)],
      oxide,
    );
    const x = Math.sin(a) * 2.93,
      z = Math.cos(a) * 2.93;
    box(out, 'metal', [x - 0.025, 40.45, z - 0.025], [x + 0.025, 41.6, z + 0.025], oxide);
  }
  profile(
    out,
    'metal',
    [
      [40.45, 2.18],
      [41.38, 2.18],
    ],
    oxide,
  );
  profile(
    out,
    'glass',
    [
      [41.38, 2.17],
      [44.05, 2.17],
    ],
    [0.25, 0.34, 0.36],
  );
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4,
      x = Math.sin(a) * 2.18,
      z = Math.cos(a) * 2.18;
    box(out, 'metal', [x - 0.04, 41.38, z - 0.04], [x + 0.04, 44.05, z + 0.04], pale);
  }
  profile(
    out,
    'metal',
    [
      [44.03, 2.36],
      [44.18, 2.36],
      [44.55, 1.94],
      [44.94, 1.34],
      [45.22, 0.61],
      [45.34, 0.07],
    ],
    copper,
  );
  box(out, 'metal', [-0.03, 45.34, -0.03], [0.03, 46, 0.03], [0.1, 0.12, 0.12]);
  for (const [x, h, z] of [
    [3, 5.25, 0],
    [-2.6, 4.45, 0.5],
  ])
    box(
      out,
      'metal',
      [x - 0.03, 40.4, z - 0.03],
      [x + 0.03, 40.4 + h, z + 0.03],
      [0.1, 0.12, 0.12],
    );
  box(out, 'granite', [-17.9, 16.1, 0.4], [-16.8, 19.25, 1.5], stone);
  box(out, 'metal', [-18.1, 19.25, 0.2], [-16.6, 19.4, 1.7], copper);
}

// Component-level street derivative; original detailed builder remains the editing master.
import {
  facadeBlock,
  ring as fullRing,
  shell as fullShell,
} from '../../../../../../../../packages/worldgen/scripts/lighthouse-expansion-models.mjs';
import {
  lathe as fullLathe,
  panel,
  transformed,
} from '../../../../../../../../packages/worldgen/scripts/lighthouse-models.mjs';

const dark = [0.1, 0.12, 0.12];
const tube = (out, slot, a, b, r, color, sides) =>
  fullTube(out, slot, a, b, r, color, Math.min(sides ?? 8, 4));
const sphere = (out, slot, c, r, color, sides, rows) =>
  fullSphere(out, slot, c, r, color, Math.min(sides, 16), Math.min(rows, 8));
const ring = (out, slot, y, inner, outer, h, color, sides) =>
  fullRing(out, slot, y, inner, outer, h, color, Math.min(sides ?? 80, 24));
const lathe = (out, slot, profile, color, sides, center) =>
  fullLathe(out, slot, profile, color, Math.min(sides ?? 64, 32), center);
const shell = (out, options) =>
  fullShell(out, { ...options, segments: Math.min(options.segments, 32) });
function railRing(out, y, r, h, color) {
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8,
      b = ((i + 1) * Math.PI) / 8,
      at = (t, yy) => [Math.sin(t) * r, yy, Math.cos(t) * r];
    for (const yy of [y + h * 0.48, y + h]) {
      // Four-sided rails retain volume; fewer posts are appropriate at street distance.
      beam(out, 'metal', at(a, yy), at(b, yy), 0.05, 0.05, color);
    }
    const p = at(a, y);
    box(out, 'metal', [p[0] - 0.029, y, p[2] - 0.029], [p[0] + 0.029, y + h, p[2] + 0.029], color);
  }
}
function triangularLantern(out, y0, y1, r, frame, glass = [0.22, 0.3, 0.31], n = 12) {
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n;
    const p = [polar(r, y0, a), polar(r, y0, b), polar(r, y1, b), polar(r, y1, a)];
    quad(out, 'glass', p, normalFor(...p.slice(0, 3)), glass);
    tube(out, 'metal', p[0], p[3], 0.038, frame, 8);
    tube(out, 'metal', p[0], p[2], 0.027, frame, 8);
  }
  for (const y of [y0, (y0 + y1) / 2, y1])
    ring(out, 'metal', y, r - 0.04, r + 0.04, 0.055, frame, 96);
}
function gableRoof(out, cx, cz, rx, rz, y, rise, color) {
  const top = [
    [cx - rx, y, cz - rz],
    [cx - rx, y, cz + rz],
    [cx + rx, y, cz + rz],
    [cx + rx, y, cz - rz],
  ];
  for (const s of [-1, 1]) {
    const p =
      s === 1
        ? [top[1], top[2], [cx + rx, y + rise, cz], [cx - rx, y + rise, cz]]
        : [top[3], top[0], [cx - rx, y + rise, cz], [cx + rx, y + rise, cz]];
    quad(out, 'metal', p, normalFor(...p.slice(0, 3)), color);
  }
  for (const s of [-1, 1]) {
    const x = cx + s * rx;
    const p =
      s === 1
        ? [
            [x, y, cz + rz],
            [x, y, cz - rz],
            [x, y + rise, cz],
          ]
        : [
            [x, y, cz - rz],
            [x, y, cz + rz],
            [x, y + rise, cz],
          ];
    out.addTriangle(
      'granite',
      'palette:#ffffff',
      p,
      normalFor(...p),
      p.map((v) => [v[2], v[1]]),
      [0.5, 0.49, 0.43],
    );
  }
  for (let x = cx - rx + 0.35; x < cx + rx; x += 0.52)
    for (const s of [-1, 1])
      beam(
        out,
        'metal',
        [x, y + rise + 0.025, cz],
        [x, y + 0.025, cz + s * rz],
        0.027,
        0.032,
        [0.22, 0.37, 0.27],
      );
}
function framedFacadeBlock(out, data) {
  facadeBlock(out, {
    ...data,
    slot: 'ashlar',
    windows: data.windows.map((w) => ({ ...w, trim: 0 })),
  });
  for (const w of data.windows) {
    const face = w.face ?? 0,
      o = transformed(out, (face * Math.PI) / 2, [data.cx ?? 0, 0, data.cz ?? 0]);
    const z = face % 2 ? data.rx : data.rz;
    const rw = w.w / 2;
    for (const x of [w.x - rw, w.x + rw])
      beam(o, 'wood', [x, w.y, z - 0.12], [x, w.y + w.h, z - 0.12], 0.11, 0.14, [0.4, 0.16, 0.12]);
    for (const y of [w.y, w.y + w.h])
      beam(
        o,
        'wood',
        [w.x - rw, y, z - 0.12],
        [w.x + rw, y, z - 0.12],
        0.11,
        0.14,
        [0.4, 0.16, 0.12],
      );
    for (const y of [w.y + w.h / 3, w.y + (w.h * 2) / 3])
      beam(
        o,
        'wood',
        [w.x - rw, y, z - 0.24],
        [w.x + rw, y, z - 0.24],
        0.04,
        0.055,
        [0.55, 0.25, 0.18],
      );
    beam(
      o,
      'wood',
      [w.x, w.y, z - 0.235],
      [w.x, w.y + w.h, z - 0.235],
      0.05,
      0.055,
      [0.55, 0.25, 0.18],
    );
    box(
      o,
      'granite',
      [w.x - rw - 0.22, w.y - 0.17, z - 0.05],
      [w.x + rw + 0.22, w.y - 0.03, z + 0.13],
      [0.62, 0.59, 0.5],
    );
  }
}
export function bengtskarStreet(out) {
  const granite = [0.47, 0.465, 0.415],
    copper = [0.26, 0.44, 0.31],
    oxide = [0.44, 0.1, 0.065];
  // Main building's stepped OSM plan, with origin at the separately mapped circular tower.
  const west = { cx: -12.109, cz: 1.4514, rx: 10.933, rz: 6.782 };
  const east = { cx: 2.4507, cz: 0.1199, rx: 3.627, rz: 5.4505 };
  for (const b of [west, east])
    box(
      out,
      'granite',
      [b.cx - b.rx, 0, b.cz - b.rz],
      [b.cx + b.rx, 0.9, b.cz + b.rz],
      [0.37, 0.37, 0.33],
    );
  const windows = [];
  for (const face of [0, 2])
    for (const x of [-7.7, -3.85, 0, 3.85, 7.7])
      for (const y of [1.6, 5.85, 10.05]) windows.push({ face, x, y, w: 1.02, h: 1.9 });
  for (const face of [1, 3])
    for (const x of [-3.4, 0, 3.4])
      for (const y of [1.6, 5.85, 10.05]) windows.push({ face, x, y, w: 0.96, h: 1.9 });
  framedFacadeBlock(out, { ...west, y0: 0.9, y1: 14.4, color: granite, windows });
  framedFacadeBlock(out, {
    ...east,
    y0: 0.9,
    y1: 15.2,
    color: granite,
    windows: [
      ...Array.from({ length: 2 }, (_, i) => ({
        face: 0,
        x: 0,
        y: 5.8 + i * 4.2,
        w: 1.07,
        h: 1.9,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        face: 1,
        x: 0,
        y: 1.6 + i * 4.2,
        w: 0.9,
        h: 1.75,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        face: 2,
        x: 0,
        y: 1.6 + i * 4.2,
        w: 1.02,
        h: 1.9,
      })),
      { face: 0, x: 0, y: 0.9, w: 1.2, h: 2.5 },
    ],
  });
  for (const b of [west, east]) {
    const o = transformed(out, 0, [b.cx, 0, b.cz]);
    for (const y of [0.94, 4.75, 14.3])
      for (let f = 0; f < 4; f++) {
        const q = transformed(o, (f * Math.PI) / 2),
          rx = f % 2 ? b.rz : b.rx,
          rz = f % 2 ? b.rx : b.rz;
        box(
          q,
          'granite',
          [-rx - 0.1, y, rz - 0.05],
          [rx + 0.1, y + 0.14, rz + 0.14],
          [0.6, 0.585, 0.52],
        );
      }
    // Alternating corner quoins preserve the National Romantic heavy stonework silhouette.
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        for (let y = 1.0, k = 0; y < 14.15; y += 0.58, k++)
          box(
            o,
            'granite',
            [sx * b.rx - (k % 2 ? 0.32 : 0.49), y, sz * b.rz - (k % 2 ? 0.49 : 0.32)],
            [sx * b.rx + (k % 2 ? 0.32 : 0.49), y + 0.48, sz * b.rz + (k % 2 ? 0.49 : 0.32)],
            [0.51, 0.5, 0.445],
          );
  }
  gableRoof(out, west.cx, west.cz, west.rx + 0.21, west.rz + 0.22, 14.4, 3.55, copper);
  box(
    out,
    'metal',
    [east.cx - east.rx - 0.16, 15.2, east.cz - east.rz - 0.16],
    [east.cx + east.rx + 0.16, 15.35, east.cz + east.rz + 0.16],
    copper,
  );
  // Large curved south pediment with its round divided window; stone voussoirs are separate.
  const ped = transformed(out, 0, [-11.5, 0, west.cz + west.rz + 0.03]),
    radius = 2.8;
  panel(ped, 'granite', -radius, radius, 13.7, 15.15, 0.0, granite);
  for (let i = 0; i < 32; i++) {
    const a = (i * Math.PI) / 32,
      b = ((i + 1) * Math.PI) / 32;
    const p = [
      [radius * Math.cos(a), 15.15 + radius * Math.sin(a), 0],
      [radius * Math.cos(b), 15.15 + radius * Math.sin(b), 0],
      [0, 15.15, 0],
    ];
    stoneTriangle(ped, p, granite);
    stoneTriangle(
      ped,
      [...p].reverse().map(([x, y]) => [x, y, -0.45]),
      granite,
    );
    const edge = [p[0], p[1], [p[1][0], p[1][1], -0.45], [p[0][0], p[0][1], -0.45]];
    edge.reverse();
    quad(ped, 'granite', edge, normalFor(...edge.slice(0, 3)), granite);
  }
  // Closed circular recess and radial frame viewed from the south.
  sphere(ped, 'glass', [0, 15.95, 0.035], [1.18, 1.18, 0.065], [0.16, 0.2, 0.21], 40, 20);
  for (let i = 0; i < 40; i++) {
    const a = (i * Math.PI) / 20,
      b = ((i + 1) * Math.PI) / 20;
    beam(
      ped,
      'granite',
      [Math.cos(a) * 1.34, 15.95 + Math.sin(a) * 1.34, 0.1],
      [Math.cos(b) * 1.34, 15.95 + Math.sin(b) * 1.34, 0.1],
      0.23,
      0.23,
      [0.62, 0.58, 0.49],
    );
  }
  for (const x of [-0.54, 0, 0.54]) {
    const hh = Math.sqrt(1.18 ** 2 - x * x);
    beam(ped, 'wood', [x, 15.95 - hh, 0.13], [x, 15.95 + hh, 0.13], 0.075, 0.09, oxide);
  }
  for (const y of [-0.5, 0.3]) {
    const w = Math.sqrt(1.18 ** 2 - y * y);
    beam(ped, 'wood', [-w, 15.95 + y, 0.13], [w, 15.95 + y, 0.13], 0.075, 0.09, oxide);
  }
  for (let i = 0; i < 20; i++) {
    const a = (i * Math.PI) / 20,
      b = ((i + 1) * Math.PI) / 20;
    beam(
      ped,
      'granite',
      [Math.cos(a) * 2.8, 15.15 + Math.sin(a) * 2.8, 0.03],
      [Math.cos(b) * 2.8, 15.15 + Math.sin(b) * 2.8, 0.03],
      0.22,
      0.36,
      [0.62, 0.59, 0.52],
    );
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 48; i++) {
      const a = (i * Math.PI * 2) / 48,
        b = ((i + 1) * Math.PI * 2) / 48;
      const r = 0.62 - (0.46 * i) / 48,
        s = 0.62 - (0.46 * (i + 1)) / 48;
      tube(
        ped,
        'granite',
        [side * (3.25 + Math.cos(a) * r), 15.05 + Math.sin(a) * r, 0.08],
        [side * (3.25 + Math.cos(b) * s), 15.05 + Math.sin(b) * s, 0.08],
        0.13,
        [0.62, 0.59, 0.52],
        8,
      );
    }
  }
  // The tall taper emerges from the east end of the keeper block.
  const holes = [];
  for (const a of [0, Math.PI])
    for (const y of [17, 22.4, 27.8, 33.2, 37.2])
      holes.push({ angle: a, y, w: 0.52, h: 1.05, trimColor: [0.56, 0.54, 0.46], grid: true });
  shell(out, {
    profile: [
      [15.3, 3.57],
      [20, 3.32],
      [27, 3.03],
      [34, 2.72],
      [39.7, 2.52],
    ],
    holes,
    slot: 'ashlar',
    color: granite,
    segments: 144,
  });
  lathe(
    out,
    'granite',
    [
      [39.6, 2.52],
      [39.9, 2.68],
      [40.1, 2.91],
      [40.3, 2.91],
    ],
    granite,
    128,
  );
  ring(out, 'metal', 40.3, 1.94, 3.0, 0.15, oxide, 128);
  railRing(out, 40.45, 2.93, 1.15, oxide, 40);
  lathe(
    out,
    'metal',
    [
      [40.45, 2.18],
      [41.38, 2.18],
    ],
    oxide,
    96,
  );
  triangularLantern(out, 41.38, 44.05, 2.17, [0.82, 0.79, 0.69], [0.25, 0.34, 0.36], 16);
  lathe(
    out,
    'metal',
    [
      [44.03, 2.36],
      [44.18, 2.36],
      [44.55, 1.94],
      [44.94, 1.34],
      [45.22, 0.61],
      [45.34, 0.07],
    ],
    copper,
    96,
  );
  sphere(out, 'metal', [0, 45.49, 0], [0.18, 0.19, 0.18], copper, 24, 12);
  tube(out, 'metal', [0, 45.49, 0], [0, 46, 0], 0.034, dark, 8);
  // Operator photograph shows a tall east gallery radio mast and a shorter western whip.
  for (const [x, y, z] of [
    [3.0, 40.4, 0],
    [-2.6, 40.4, 0.5],
  ]) {
    const h = x > 0 ? 5.25 : 4.45;
    tube(out, 'metal', [x, y, z], [x, y + h, z], 0.036, dark, 8);
    if (x > 0)
      for (const yy of [43.5, 44.5, 45.1]) {
        tube(out, 'metal', [x - 0.48, yy, z], [x + 0.48, yy, z], 0.025, dark, 8);
        for (const xx of [-0.38, 0, 0.38])
          tube(out, 'metal', [x + xx, yy, z - 0.22], [x + xx, yy, z + 0.22], 0.018, dark, 6);
      }
  }
  box(out, 'granite', [-17.9, 16.1, 0.4], [-16.8, 19.25, 1.5], granite);
  box(out, 'metal', [-18.1, 19.25, 0.2], [-16.6, 19.4, 1.7], copper);
}
function stoneTriangle(out, p, color) {
  out.addTriangle(
    'granite',
    'palette:#ffffff',
    p,
    normalFor(...p),
    p.map((v) => [v[0], v[1]]),
    color,
  );
}

/** District retains the window rhythm the automatic derivative had erased. */
export function bengtskarDistrict(out) {
  bengtskarSkyline(out, true);
  for (const [b] of [
    [{ cx: -12.109, cz: 1.4514, rx: 10.933, rz: 6.782 }, 14.4],
    [{ cx: 2.4507, cz: 0.1199, rx: 3.627, rz: 5.4505 }, 15.2],
  ]) {
    const o = transformed(out, 0, [b.cx, 0, b.cz]);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        for (let y = 1, k = 0; y < 14.15; y += 1.16, k++)
          box(
            o,
            'granite',
            [sx * b.rx - (k % 2 ? 0.32 : 0.49), y, sz * b.rz - (k % 2 ? 0.49 : 0.32)],
            [sx * b.rx + (k % 2 ? 0.32 : 0.49), y + 0.48, sz * b.rz + (k % 2 ? 0.49 : 0.32)],
            [0.51, 0.5, 0.445],
          );
    for (let side = 0; side < 4; side++) {
      const f = transformed(o, (side * Math.PI) / 2),
        z = (side % 2 ? b.rx : b.rz) + 0.018;
      const xs = b.rx > 4 ? (side % 2 ? [-3.4, 0, 3.4] : [-7.7, -3.85, 0, 3.85, 7.7]) : [0];
      for (const x of xs)
        for (const y of [1.6, 5.85, 10.05]) {
          for (const xx of [x - 0.51, x + 0.51])
            face(
              f,
              'wood',
              [
                [xx - 0.055, y, z],
                [xx + 0.055, y, z],
                [xx + 0.055, y + 1.9, z],
                [xx - 0.055, y + 1.9, z],
              ],
              [0.4, 0.16, 0.12],
            );
          for (const yy of [y, y + 1.9])
            face(
              f,
              'wood',
              [
                [x - 0.51, yy - 0.055, z],
                [x + 0.51, yy - 0.055, z],
                [x + 0.51, yy + 0.055, z],
                [x - 0.51, yy + 0.055, z],
              ],
              [0.4, 0.16, 0.12],
            );
          face(
            f,
            'wood',
            [
              [x - 0.025, y, z + 0.005],
              [x + 0.025, y, z + 0.005],
              [x + 0.025, y + 1.9, z + 0.005],
              [x - 0.025, y + 1.9, z + 0.005],
            ],
            [0.55, 0.25, 0.18],
          );
          for (const yy of [y + 1.9 / 3, y + 3.8 / 3])
            face(
              f,
              'wood',
              [
                [x - 0.51, yy - 0.02, z + 0.005],
                [x + 0.51, yy - 0.02, z + 0.005],
                [x + 0.51, yy + 0.02, z + 0.005],
                [x - 0.51, yy + 0.02, z + 0.005],
              ],
              [0.55, 0.25, 0.18],
            );
        }
    }
  }
  const ped = transformed(out, 0, [-11.5, 0, 8.2634]);
  for (const x of [-0.54, 0.54]) {
    const h = Math.sqrt(1.12 ** 2 - x * x);
    face(
      ped,
      'wood',
      [
        [x - 0.0375, 15.95 - h, 0.061],
        [x + 0.0375, 15.95 - h, 0.061],
        [x + 0.0375, 15.95 + h, 0.061],
        [x - 0.0375, 15.95 + h, 0.061],
      ],
      oxide,
    );
  }
  // Copper standing seams and diagonal lantern bars recover identity detail without tiny fittings.
  for (let x = -22.7; x < -1.3; x += 1.6)
    for (const sign of [-1, 1])
      fullBeam(
        out,
        'metal',
        [x, 17.975, 1.4514],
        [x, 14.425, 1.4514 + sign * 7.002],
        0.027,
        0.032,
        [0.22, 0.37, 0.27],
      );
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4,
      b = ((i + 1) * Math.PI) / 4;
    fullBeam(out, 'metal', polar(2.175, 41.38, a), polar(2.175, 44.05, b), 0.054, 0.054, pale);
  }
}
