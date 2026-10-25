/** Hangar 37, dated museum exterior: twin shallow gables and the checker entrance canopy. */
import './install-deterministic-math.mjs';
import { beam } from './authored-structure-mesh.mjs';
import { B, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const cream = rgb('d5cfb5'),
  edge = rgb('bfbba7'),
  roof = rgb('a6aaa5'),
  white = rgb('e9e8df'),
  red = rgb('a8453b'),
  dark = rgb('26353e'),
  glass = rgb('34464a');
const ref = 'palette:#ffffff',
  W = 68.7,
  D = 47.65,
  H = 8.4,
  rise = 1.75;
function face(o, s, x, y, z, w, h, color, n = 1) {
  quad(
    o,
    s,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, n],
    color,
  );
}
const glyphs = {
  P: ['1110', '1001', '1110', '1000', '1000'],
  A: ['0110', '1001', '1111', '1001', '1001'],
  C: ['0111', '1000', '1000', '1000', '0111'],
  I: ['111', '010', '010', '010', '111'],
  F: ['1111', '1000', '1110', '1000', '1000'],
  V: ['1001', '1001', '1001', '1001', '0110'],
  T: ['11111', '00100', '00100', '00100', '00100'],
  O: ['0110', '1001', '1001', '1001', '0110'],
  N: ['1001', '1101', '1011', '1001', '1001'],
  M: ['10001', '11011', '10101', '10001', '10001'],
  U: ['1001', '1001', '1001', '1001', '0110'],
  S: ['0111', '1000', '0110', '0001', '1110'],
  E: ['1111', '1000', '1110', '1000', '1111'],
  3: ['1110', '0001', '0110', '0001', '1110'],
  7: ['1111', '0001', '0010', '0100', '0100'],
};
function label(o, text, x, y, z, height, color) {
  const unit = height / 5;
  let width = 0;
  for (const ch of text) width += (glyphs[ch]?.[0].length ?? 2) + 1;
  let cursor = x - (width * unit) / 2;
  for (const ch of text) {
    const rows = glyphs[ch];
    if (rows) {
      for (let r = 0; r < 5; r++) {
        let c = 0;
        while (c < rows[r].length) {
          if (rows[r][c] !== '1') {
            c++;
            continue;
          }
          let end = c + 1;
          while (rows[r][end] === '1') end++;
          face(
            o,
            'trim',
            cursor + ((c + end) * unit) / 2,
            y + (4 - r) * unit,
            z,
            (end - c) * unit,
            unit,
            color,
          );
          c = end;
        }
      }
    }
    cursor += ((rows?.[0].length ?? 2) + 1) * unit;
  }
}
function canopy(o, d) {
  const x = -17.15,
    z = D / 2 + 0.15,
    w = 9.2,
    depth = 5.1,
    backY = 7.5,
    frontY = 3.3;
  const point = (u, v, offset = 0) => [x + u, backY + (frontY - backY) * v + offset, z + depth * v];
  const p = [point(-w / 2, 0), point(w / 2, 0), point(w / 2, 1), point(-w / 2, 1)];
  quad(o, 'trim', p, [0, depth, backY - frontY], white);
  quad(
    o,
    'trim',
    p.map((p) => [p[0], p[1] - 0.12, p[2]]),
    [0, -depth, frontY - backY],
    edge,
  );
  // Two checker rows on the lower fabric/metal fascia; colored geometry, no photo texture.
  const n = d === 0 ? 10 : 16;
  for (let row = 0; row < 2; row++)
    for (let i = 0; i < n; i++)
      if ((i + row) % 2 === 0) {
        const a = -w / 2 + (i * w) / n,
          b = a + w / n,
          v = 0.79 + row * 0.09,
          q = [
            point(a, v, 0.018),
            point(b, v, 0.018),
            point(b, v + 0.09, 0.018),
            point(a, v + 0.09, 0.018),
          ];
        quad(o, 'trim', q, [0, depth, backY - frontY], red);
      }
  face(o, 'glass', x, 0.2, z + 0.25, w - 0.45, 3.55, glass);
  if (d) {
    for (const u of [-w / 2, -w / 6, w / 6, w / 2]) {
      beam(o, 'trim', point(u, 1), [x + u, 0.15, z + depth + 1.1], 0.09, 0.09, white);
      beam(o, 'trim', point(u, 0), point(u, 1), 0.065, 0.065, white);
      if (d > 1) beam(o, 'trim', point(u, 1), [x + u, 0.15, z + 0.6], 0.07, 0.07, white);
    }
    for (const u of [-w / 2, -w / 4, 0, w / 4, w / 2])
      face(o, 'trim', x + u, 0.2, z + 0.27, 0.09, 3.5, white);
    face(o, 'trim', x, 2.5, z + 0.28, w, 0.08, white);
    B(o, 'foundation', x, -0.15, z + 2.5, w + 1, 0.3, 6.9, edge);
  }
}
function hangar(o, _frame, d = 3) {
  B(o, 'foundation', 0, -0.75, 0, W + 0.35, 1, D + 0.35, edge);
  B(o, 'wall', 0, 0.25, 0, W, H - 0.25, D, cream);
  for (const x of [-W / 4, W / 4]) {
    const ww = W / 2;
    // Solid roof underside and two shallow gable planes.
    B(o, 'trim', x, H - 0.08, 0, ww + 0.15, 0.13, D + 0.6, edge);
    for (const sign of [-1, 1]) {
      const p = [
        [x + (sign * ww) / 2, H, -D / 2 - 0.3],
        [x + (sign * ww) / 2, H, D / 2 + 0.3],
        [x, H + rise, D / 2 + 0.3],
        [x, H + rise, -D / 2 - 0.3],
      ];
      quad(o, 'roof', p, [sign * rise, ww / 2, 0], roof);
    }
    for (const sign of [-1, 1]) {
      const z = sign * (D / 2 + 0.32),
        pts = [
          [x - ww / 2, H - 0.05, z],
          [x + ww / 2, H - 0.05, z],
          [x, H + rise + 0.08, z],
        ];
      o.addTriangle(
        'wall',
        ref,
        pts,
        [0, 0, sign],
        pts.map((p) => [p[0], p[1]]),
        cream,
      );
      face(o, 'wall', x, 7.4, z, ww, 1.02, cream, sign);
      B(o, 'trim', x, 7.75, z + sign * 0.08, ww, 0.16, 0.35, edge);
      for (const side of [-1, 1])
        beam(
          o,
          'trim',
          [x + (side * ww) / 2, H + 0.08, z + sign * 0.04],
          [x, H + rise + 0.16, z + sign * 0.04],
          0.2,
          0.2,
          white,
        );
      if (d) {
        const count = d > 1 ? 8 : 4;
        for (let i = 0; i < count; i++) {
          const xx = x - ww / 2 + ((i + 0.5) * ww) / count;
          face(
            o,
            'wall',
            xx,
            0.26,
            z - 0.12 * sign,
            ww / count - 0.12,
            7.1,
            i % 2 ? cream : rgb('d0cbb4'),
            sign,
          );
          face(o, 'trim', xx - ww / count / 2, 0.26, z + 0.025 * sign, 0.065, 7.1, edge, sign);
        }
        if (d > 1) {
          for (const xx of [x - ww * 0.36, x + ww * 0.36]) {
            B(o, 'trim', xx, 7.94, z + sign * 0.32, 0.5, 0.18, 0.35, dark);
            face(o, 'trim', xx, 7.89, z + sign * 0.52, 0.32, 0.05, white, sign);
          }
        }
      }
    }
    if (d) {
      for (const z of [-15, 0, 15]) {
        B(o, 'trim', x, H + rise - 0.08, z, 2.5, 0.65, 2.2, dark);
        B(o, 'roof', x, H + rise + 0.55, z, 3, 0.16, 2.7, roof);
        if (d > 1)
          for (const zz of [-1.12, 1.12])
            for (let y = H + rise + 0.06; y < H + rise + 0.5; y += 0.14)
              face(o, 'trim', x, y, z + zz, 2.45, 0.065, edge, Math.sign(zz));
      }
    }
  }
  // The main door track and broad side walls are retained even at skyline distance.
  for (const sign of [-1, 1]) B(o, 'trim', (sign * W) / 2, 0.2, 0, 0.15, H - 0.1, D, cream);
  if (d > 1) {
    for (const sign of [-1, 1])
      for (let z = -21; z <= 21; z += 5.25)
        B(o, 'trim', sign * (W / 2 + 0.08), 0.35, z, 0.13, 7.9, 0.13, edge);
    // Fine vertical seams are deliberately confined to closeup; broad side openings are not invented.
    if (d > 2)
      for (const sign of [-1, 1])
        for (let x = -W / 2 + 0.2; x < W / 2; x += 0.32)
          face(o, 'trim', x, 0.35, sign * (D / 2 + 0.355), 0.015, 7.05, edge, sign);
  }
  canopy(o, d);
  if (d > 1) {
    label(o, 'PACIFIC AVIATION MUSEUM', -17.15, 8.55, D / 2 + 0.38, 0.52, rgb('263c5e'));
    face(o, 'trim', -4.2, 8.15, D / 2 + 0.39, 1.1, 0.63, dark);
    label(o, '37', -4.2, 8.23, D / 2 + 0.41, 0.46, white);
  }
  // Rear utility doorway is an explicit conservative closure, outside the museum visitor frontage.
  if (d) {
    face(o, 'glass', 0, 0.3, -D / 2 - 0.37, 1.6, 2.3, dark, -1);
    face(o, 'trim', 0, 2.62, -D / 2 - 0.39, 1.85, 0.12, edge, -1);
  }
}
export const hangar37Skyline = (o, f) => hangar(o, f, 0);
export const hangar37District = (o, f) => hangar(o, f, 1);
export const hangar37Street = (o, f) => hangar(o, f, 2);
const surfaces = {
  wall: { slot: 'wall', graph: 'metal_corrugated', roughness: 0.82, metallic: 0.15 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.8, metallic: 0.2 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.7, metallic: 0.2 },
  foundation: { ...landmarkSurfaces.concrete, slot: 'foundation' },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
};
export const hangar37Model = {
  id: 'hangar_37',
  recipe: 'structure-hangar-37.mjs',
  key: 'hangar_37',
  cell: '87/87z',
  title: 'Pearl Harbor Aviation Museum — Hangar 37',
  brief:
    'Historic twin shallow-gable hangar with cream corrugated sliding doors, ridge vents and the white entrance canopy with red checker rows, following dated museum references.',
  camera: [85, 58, 90],
  lookAt: [0, 4, 0],
  qaCameras: [
    { name: 'front', position: [0, 17, 105], lookAt: [0, 4, 5] },
    { name: 'back', position: [-68, 36, -83], lookAt: [0, 4, 0] },
  ],
  build: hangar,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  mediumFiContext: { scale: 1.8 },
  groundContactBasis:
    'Independent apron terrain at [0,29]; foundation extends to -0.75 m without flattening ground. Heights are approximate photographic interpretations.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-hangar-37.mjs',
    level: 'skyline',
    export: 'hangar37Skyline',
    errorMeters: 0.65,
    surfaces,
    authoredLevels: {
      district: { export: 'hangar37District', errorMeters: 0.25, surfaces },
      street: { export: 'hangar37Street', errorMeters: 0.1, surfaces },
    },
  },
  limitations: [
    'Owner accepted this medium-fi exterior on 2026-10-19. Active imagery is the public-domain Navy80-G-32480historic reference; current entrance details remain approximate. Earlier private imagery is excluded.',
    'Mapped approximately 68.7 by 47.7 m footprint and northeast entrance are retained. Architect project floor area is not assumed to equal the mapped footprint.',
    'Twin shallow gables, cream metal cladding, door tracks, checker canopy and ridge vents follow dated references. Exact heights, rear service door, roof equipment placement and concealed side details are interpretations.',
    'Dated 2008–2017 exterior and Pacific Aviation Museum lettering are represented; later name/signage or renovation changes are not fully documented.',
    'Aircraft, exhibits, interiors, landscape, antennas outside the footprint, Hangars 79/54 and the separate control tower are excluded. Reference pixels are not redistributed.',
    'Independent terrain is preserved; contact with other host DEMs remains uncertain.',
  ],
};
