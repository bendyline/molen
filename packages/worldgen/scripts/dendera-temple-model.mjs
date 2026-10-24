/** Dendera primary Hathor temple. The full complex remains under construction. */
export const denderaCandidateId = 'dendera_temple_complex';

function box(face, role, x, y, z, w, h, depth) {
  const a = [
    [-w / 2, -depth / 2],
    [w / 2, -depth / 2],
    [w / 2, depth / 2],
    [-w / 2, depth / 2],
  ].map(([u, v]) => [x + u, y, z + v]);
  const b = a.map(([u, v, t]) => [u, v + h, t]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(role, [a[i], a[j], b[j], b[i]], [a[j][2] - a[i][2], 0, a[i][0] - a[j][0]]);
  }
  face(role, a, [0, -1, 0]);
  face(role, b, [0, 1, 0]);
}
function lathe(face, role, x, z, levels, sides) {
  const rings = levels.map(([y, r]) =>
    Array.from({ length: sides }, (_, i) => {
      const a = (i * Math.PI * 2) / sides;
      return [x + r * Math.cos(a), y, z + r * Math.sin(a)];
    }),
  );
  for (let k = 1; k < rings.length; k++)
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides,
        a = ((i + 0.5) * Math.PI * 2) / sides;
      face(
        role,
        [rings[k - 1][i], rings[k - 1][j], rings[k][j], rings[k][i]],
        [
          (levels[k][0] - levels[k - 1][0]) * Math.cos(a),
          levels[k - 1][1] - levels[k][1],
          (levels[k][0] - levels[k - 1][0]) * Math.sin(a),
        ],
      );
    }
  face(role, rings[0], [0, -1, 0]);
  face(role, rings.at(-1), [0, 1, 0]);
}
function mask(face, x, y, z, side, detail) {
  const angle = (side * Math.PI) / 2,
    co = Math.cos(angle),
    si = Math.sin(angle);
  const point = ([u, v, w]) => [x + u * co + w * si, y + v, z - u * si + w * co];
  const emit = (role, ps, n) =>
    face(role, ps.map(point), [n[0] * co + n[2] * si, n[1], -n[0] * si + n[2] * co]);
  const outline = [
    [-0.86, 0.68],
    [-0.86, -0.18],
    [-0.63, -0.72],
    [-0.28, -0.91],
    [0.28, -0.91],
    [0.63, -0.72],
    [0.86, -0.18],
    [0.86, 0.68],
    [0.65, 0.95],
    [-0.65, 0.95],
  ];
  const front = outline.map(([u, v]) => [u, v, 1.2]),
    back = outline.map(([u, v]) => [u, v, 1.13]);
  emit('stone', front, [0, 0, 1]);
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    emit(
      'stone',
      [back[i], back[j], front[j], front[i]],
      [outline[j][1] - outline[i][1], outline[i][0] - outline[j][0], 0],
    );
  }
  for (const hand of [-1, 1])
    emit(
      'stone',
      [
        [hand * 0.82, 0.47, 1.2],
        [hand * 1.17, 0.5, 1.13],
        [hand * 1.29, 0.3, 1.05],
        [hand * 1.1, 0.12, 1.15],
        [hand * 0.83, 0.17, 1.22],
      ],
      [0, 0, 1],
    );
  if (detail >= 2) {
    // The surviving capitals are defaced. Keep coarse chiseled planes rather
    // than invent intact eyes, a nose or a smile.
    emit(
      'stone',
      [
        [-0.68, 0.52, 1.205],
        [0.12, 0.62, 1.24],
        [0.65, 0.32, 1.21],
        [0.36, -0.42, 1.245],
        [-0.21, -0.72, 1.22],
        [-0.63, -0.29, 1.205],
      ],
      [0, 0, 1],
    );
    emit(
      'stone',
      [
        [0.12, 0.62, 1.24],
        [0.65, 0.32, 1.21],
        [0.36, -0.42, 1.245],
      ],
      [0, 0, 1],
    );
    for (const hand of [-1, 1])
      emit(
        'carved',
        [
          [hand * 0.94, 0.76, 1.16],
          [hand * 1.08, 0.76, 1.16],
          [hand * 1.08, -0.6, 1.16],
          [hand * 0.94, -0.68, 1.16],
        ],
        [0, 0, 1],
      );
  }
}

function column(face, x, z, detail, frontRow) {
  if (detail === 0) {
    lathe(
      face,
      'stone',
      x,
      z,
      [
        [0.3, 1.12],
        [10.5, 1.0],
      ],
      6,
    );
    box(face, 'stone', x, 10.5, z, 2.8, 2.5, 2.8);
    box(face, 'stone', x, 13, z, 2.18, 2.5, 2.18);
    return;
  }
  const n = detail === 0 ? 6 : detail === 1 ? 8 : detail === 2 ? 12 : 24;
  lathe(
    face,
    'stone',
    x,
    z,
    detail === 0
      ? [
          [0.3, 1.12],
          [10.5, 1.0],
        ]
      : detail === 1
        ? [
            [0.1, 1.43],
            [0.65, 1.17],
            [10.5, 1.05],
          ]
        : [
            [0.1, 1.43],
            [0.4, 1.43],
            [0.65, 1.17],
            [2.2, 1.17],
            [9.6, 1.02],
            [10.5, 1.05],
          ],
    n,
  );
  box(face, 'stone', x, 10.5, z, 2.3, 0.5, 2.3);
  if (detail === 0 || (detail === 1 && !frontRow)) box(face, 'stone', x, 11, z, 2.8, 2.1, 2.8);
  else {
    box(face, 'stone', x, 11, z, 2.3, 2.0, 2.3);
    for (const side of detail === 1 ? [0, 2] : [0, 1, 2, 3]) mask(face, x, 12.0, z, side, detail);
  }
  box(face, 'stone', x, 13, z, 2.18, 2.05, 2.18);
  if (detail >= 1) {
    box(face, 'carved', x, 13.2, z, 1.55, 1.5, 2.205);
    box(face, 'stone', x, 13.32, z, 1.26, 1.24, 2.225);
  }
  box(face, 'stone', x, 15.05, z, 2.85, 0.45, 2.85);
}
function cavetto(face, x, y, z, w, depth, detail) {
  const levels =
    detail === 0
      ? [
          [0, 0],
          [0.95, 0.6],
        ]
      : detail === 1
        ? [
            [0, 0],
            [0.35, 0.12],
            [1.1, 0.6],
          ]
        : [
            [0, 0],
            [0.15, 0],
            [0.35, 0.12],
            [0.65, 0.32],
            [0.85, 0.55],
            [1, 0.6],
            [1.1, 0.6],
          ];
  for (let i = 1; i < levels.length; i++) {
    const [a, ra] = levels[i - 1],
      [b, rb] = levels[i];
    const aa = [
      [-w / 2 - ra, -depth / 2 - ra],
      [w / 2 + ra, -depth / 2 - ra],
      [w / 2 + ra, depth / 2 + ra],
      [-w / 2 - ra, depth / 2 + ra],
    ];
    const bb = [
      [-w / 2 - rb, -depth / 2 - rb],
      [w / 2 + rb, -depth / 2 - rb],
      [w / 2 + rb, depth / 2 + rb],
      [-w / 2 - rb, depth / 2 + rb],
    ];
    for (let k = 0; k < 4; k++) {
      const j = (k + 1) % 4;
      face(
        'stone',
        [
          [x + aa[k][0], y + a, z + aa[k][1]],
          [x + aa[j][0], y + a, z + aa[j][1]],
          [x + bb[j][0], y + b, z + bb[j][1]],
          [x + bb[k][0], y + b, z + bb[k][1]],
        ],
        [
          aa[j][1] - aa[k][1],
          -Math.hypot(aa[k][0] - bb[k][0], aa[k][1] - bb[k][1]),
          aa[k][0] - aa[j][0],
        ],
      );
    }
  }
  const top = levels.at(-1);
  box(face, 'stone', x, y + top[0], z, w + 2 * top[1], 0.1, depth + 2 * top[1]);
}

export function buildDenderaTemple(face, detail, r) {
  const width = r.frontWidth,
    depth = r.frontDepth,
    backWidth = r.backWidth,
    backDepth = r.backDepth;
  // Retaining foundations seat both stepped masses in the coarse map terrain.
  box(face, 'stone', 0, -3.5, -depth / 2, width, 3.5, depth);
  box(face, 'stone', 0, -3.5, -depth - backDepth / 2, backWidth, 3.5, backDepth);
  if (detail === 0) {
    // Preserve the stepped silhouette, six capitals and open central approach.
    box(face, 'stone', 0, 0, -depth - backDepth / 2, backWidth, 13.75, backDepth);
    for (const side of [-1, 1]) {
      box(face, 'stone', side * (width / 2 - 1.05), 0, -depth / 2, 2.1, 18.35, depth);
      box(face, 'stone', side * (width / 4 + 2.2), 0, -0.3, width / 2 - 4.4, 5.9, 1.3);
      box(face, 'stone', side * 3.3, 0, -0.3, 1.4, 8.6, 1.8);
    }
    box(face, 'stone', 0, 15.5, -depth / 2, width + 1.2, 2.85, depth + 1.2);
    box(face, 'stone', 0, 0, -depth / 2, width, 0.35, depth);
    box(face, 'stone', 0, 0, -depth + 0.5, backWidth, 15.6, 2);
    for (const x of r.columnXs) column(face, x, -1.6, 0, true);
    return;
  }
  box(face, 'stone', 0, 0, -depth / 2, width, 0.35, depth);
  box(face, 'stone', 0, 0, -depth - backDepth / 2, backWidth, 0.35, backDepth);
  // Complete outer body, with a short recessed opening visible through the portico.
  box(face, 'stone', 0, 0.35, -depth - backDepth / 2, backWidth, 12.2, backDepth);
  for (const side of [-1, 1])
    box(face, 'stone', side * (width / 2 - 1.05), 0.35, -depth / 2, 2.1, 16.7, depth);
  box(face, 'stone', 0, 15.5, -depth / 2, width, 1.65, depth);
  box(face, 'ceiling', 0, 15.35, -depth / 2, width - 4.2, 0.15, depth - 2.0);
  box(face, 'stone', 0, 12.55, -depth + 0.5, width, 3.1, 2.0);
  // Two flanks and a lintel leave the axial back portal recessed, not painted black.
  for (const side of [-1, 1])
    box(
      face,
      'stone',
      side * (backWidth / 4 + 1.5),
      0.35,
      -depth + 0.5,
      backWidth / 2 - 3,
      12.8,
      2.0,
    );
  box(face, 'stone', 0, 6.4, -depth + 0.5, 6, 6.75, 2.0);
  box(face, 'stone', 0, 0.35, -depth - 3, 6, 6.05, 0.8);
  cavetto(face, 0, 17.15, -depth / 2, width, depth, detail);
  cavetto(face, 0, 12.55, -depth - backDepth / 2, backWidth, backDepth, detail);
  const rows = detail <= 1 ? [1.6] : [1.6, 8.2, 14.8, 21.4];
  for (const z of rows)
    for (const x of r.columnXs)
      column(face, x, -z, detail === 2 && z !== 1.6 ? 1 : detail, z === 1.6);
  // Original front screen walls and raised jambs frame the open axial entrance.
  const ends = [-width / 2, -14.5, -9.1, -4.4, 4.4, 9.1, 14.5, width / 2];
  for (let i = 0; i < ends.length - 1; i++) {
    const a = ends[i],
      b = ends[i + 1];
    if (a < 0 && b > 0) continue;
    const w = b - a,
      x = (a + b) / 2;
    box(face, 'stone', x, 0.35, -0.3, w, 5.1, 1.3);
    if (detail >= 1) {
      box(face, 'carved', x, 1.0, 0.365, w - 0.4, 3.9, 0.04);
      box(face, 'stone', x, 1.2, 0.39, w - 0.7, 3.5, 0.035);
    }
    cavetto(face, x, 5.45, -0.3, w, 1.3, detail);
  }
  for (const side of [-1, 1]) {
    box(face, 'stone', side * 3.3, 0.35, -0.3, 1.4, 7.4, 1.8);
    cavetto(face, side * 3.3, 7.75, -0.3, 1.4, 1.8, detail);
  }
  // Relief registers indicate the surviving decorated rear wall at medium-fi scale.
  // No invented hieroglyphs or portrait figures are used.
  if (detail >= 2) {
    for (const y of [2.2, 6.0, 10.4]) {
      box(face, 'carved', 0, y, -depth - backDepth - 0.025, backWidth - 2.8, 0.18, 0.05);
      for (const x of [-12.3, -6.2, 0, 6.2, 12.3])
        box(face, 'carved', x, y + 0.35, -depth - backDepth - 0.03, 0.16, 2.7, 0.06);
    }
  }
}

export { box as denderaBox, cavetto as denderaCavetto, column as denderaColumn };
