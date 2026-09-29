/** Marina 101: developer plans, fabricator crown, and completed exterior photographs. */
import { beam } from './authored-structure-mesh.mjs';
import {
  commonLimit,
  face,
  grid,
  mappedCap,
  mappedSolid,
  partPlan,
  partsEvidence,
} from './signature-tower-expansion-models.mjs';
import { box } from './structure-mesh.mjs';

const silver = [0.67, 0.69, 0.68],
  warm = [0.55, 0.535, 0.49],
  blue = [0.13, 0.25, 0.29],
  crownBlue = [0.22, 0.4, 0.49];
const hx = 20.64,
  hz = 19.067;
const fronts = [
  { n: [0, 0, -1], r: [-1, 0, 0], d: hz, w: hx * 2, sea: true },
  { n: [1, 0, 0], r: [0, 0, -1], d: hx, w: hz * 2 },
  { n: [0, 0, 1], r: [1, 0, 0], d: hz, w: hx * 2 },
  { n: [-1, 0, 0], r: [0, 0, 1], d: hx, w: hz * 2 },
];
function p(f, u, y, depth = 0) {
  return [f.n[0] * (f.d + depth) + f.r[0] * u, y, f.n[2] * (f.d + depth) + f.r[2] * u];
}
function panel(out, f, u0, u1, y0, y1, color, depth = 0, slot = 'metal') {
  if (u1 - u0 < 0.01 || y1 - y0 < 0.01) return;
  face(
    out,
    slot,
    [p(f, u0, y0, depth), p(f, u1, y0, depth), p(f, u1, y1, depth), p(f, u0, y1, depth)],
    color,
  );
}
function sill(out, f, u0, u1, y, depth = 0.16) {
  beam(out, 'metal', p(f, u0, y, depth), p(f, u1, y, depth), 0.11, 0.22, silver);
}
function slot(out, f, u0, u1, y0, y1, color = warm) {
  const g0 = u0 + 0.48,
    g1 = u1 - 0.48,
    lo = y0 + 0.55,
    hi = y1 - 0.35;
  panel(out, f, u0, g0, y0, y1, color);
  panel(out, f, g1, u1, y0, y1, color);
  panel(out, f, g0, g1, y0, lo, color);
  panel(out, f, g0, g1, hi, y1, color);
  const q = [p(f, g0, lo, -0.22), p(f, g1, lo, -0.22), p(f, g1, hi, -0.22), p(f, g0, hi, -0.22)];
  const rim = [p(f, g0, lo), p(f, g1, lo), p(f, g1, hi), p(f, g0, hi)];
  for (let i = 0; i < 4; i++)
    face(out, 'metal', [rim[i], rim[(i + 1) % 4], q[(i + 1) % 4], q[i]], silver);
  grid(out, q, blue, (g1 - g0) / 2, hi - lo, 0.045, silver, 'metal');
  sill(out, f, g0, g1, lo);
}
function flare(out, f, y) {
  // Individual flaring piers leave the narrow glazing exposed between the light dishes.
  const count = 14,
    bay = f.w / count;
  for (let i = 0; i <= count; i++) {
    const u = -f.w / 2 + i * bay,
      w = i === 0 || i === count ? 0.48 : 0.8;
    const profile = [
      [y - 6, 0],
      [y - 4, 0.12],
      [y - 2, 0.58],
      [y, 1.7],
    ];
    for (let j = 1; j < profile.length; j++) {
      const [a, b] = [profile[j - 1], profile[j]];
      face(
        out,
        'metal',
        [
          p(f, u - w / 2, a[0], a[1]),
          p(f, u + w / 2, a[0], a[1]),
          p(f, u + w / 2, b[0], b[1]),
          p(f, u - w / 2, b[0], b[1]),
        ],
        silver,
      );
      for (const side of [-1, 1])
        face(
          out,
          'metal',
          [
            p(f, u + (side * w) / 2, a[0], 0),
            p(f, u + (side * w) / 2, a[0], a[1] + 0.001),
            p(f, u + (side * w) / 2, b[0], b[1] + 0.001),
            p(f, u + (side * w) / 2, b[0], 0),
          ],
          warm,
        );
    }
  }
  const rim = [
    p(f, -f.w / 2, y, 1.7),
    p(f, f.w / 2, y, 1.7),
    p(f, f.w / 2, y, 0),
    p(f, -f.w / 2, y, 0),
  ];
  face(out, 'metal', rim, silver);
  beam(
    out,
    'metal',
    p(f, -f.w / 2, y - 0.14, 1.7),
    p(f, f.w / 2, y - 0.14, 1.7),
    0.28,
    0.15,
    silver,
  );
}
function shaft(out) {
  const plan = [
    [-hx, -hz],
    [-hx, hz],
    [hx, hz],
    [hx, -hz],
  ];
  mappedCap(out, 'metal', plan, 380, silver);
  for (const f of fronts) {
    const count = 14,
      bay = f.w / count,
      rows = 94,
      pitch = (370.9 - 13) / rows;
    for (let row = 0; row < rows; row++) {
      const low = 13 + row * pitch,
        high = low + pitch;
      for (let i = 0; i < count; i++) {
        const u0 = -f.w / 2 + i * bay,
          u1 = u0 + bay;
        if (low >= 316 && Math.abs((u0 + u1) / 2) > 9.3) {
          panel(out, f, u0, u1, low, high, silver);
          sill(out, f, u0, u1, low, 0.035);
          beam(
            out,
            'metal',
            p(f, u0, low, 0.02),
            p(f, u0, high, 0.02),
            0.02,
            0.018,
            [0.48, 0.51, 0.52],
          );
        } else slot(out, f, u0, u1, low, high, i % 3 === 1 ? silver : warm);
      }
    }
    panel(out, f, -f.w / 2, f.w / 2, 370.9, 372, silver);
    grid(
      out,
      [
        p(f, -f.w / 2, 372, -0.1),
        p(f, f.w / 2, 372, -0.1),
        p(f, f.w / 2, 377.5, -0.1),
        p(f, -f.w / 2, 377.5, -0.1),
      ],
      blue,
      1.45,
      2.75,
      0.05,
      silver,
      'metal',
    );
    panel(out, f, -f.w / 2, f.w / 2, 377.5, 380, silver);
    for (const y of [61, 232, 316]) flare(out, f, y);
    // Upper wing panel ribs give the actual horizontal divisions their raised edges.
    for (let y = 318; y < 379; y += 2.1)
      for (const sign of [-1, 1])
        beam(
          out,
          'metal',
          p(f, sign * 9.35, y, 0.09),
          p(f, (sign * f.w) / 2, y, 0.09),
          0.105,
          0.18,
          silver,
        );
    for (let i = 0; i <= 14; i++) {
      const u = -f.w / 2 + i * bay;
      beam(out, 'metal', p(f, u, 13, 0.04), p(f, u, 371, 0.04), 0.065, 0.06, silver);
    }
  }
}
function panoramicLift(out) {
  const x = 2.7,
    z = -hz - 3.05,
    width = 6.6;
  // The developer's SEA-side plan shows the pair projecting from the northeast half.
  box(
    out,
    'metal',
    [x - width / 2 - 0.12, 12.5, z - 0.1],
    [x - width / 2 + 0.12, 378, z + 0.15],
    silver,
  );
  box(
    out,
    'metal',
    [x + width / 2 - 0.12, 12.5, z - 0.1],
    [x + width / 2 + 0.12, 378, z + 0.15],
    silver,
  );
  box(out, 'metal', [x - 0.1, 12.5, z - 0.1], [x + 0.1, 378, z + 0.15], silver);
  grid(
    out,
    [
      [x + width / 2, 12.5, z],
      [x - width / 2, 12.5, z],
      [x - width / 2, 378, z],
      [x + width / 2, 378, z],
    ],
    blue,
    width / 2,
    3.6,
    0.06,
    silver,
    'metal',
  );
  for (const side of [-1, 1])
    grid(
      out,
      [
        [x + (side * width) / 2, 12.5, z],
        [x + (side * width) / 2, 12.5, -hz],
        [x + (side * width) / 2, 378, -hz],
        [x + (side * width) / 2, 378, z],
      ],
      blue,
      1.5,
      3.6,
      0.07,
      silver,
      'metal',
    );
  for (let y = 13; y < 375; y += 7.2) {
    const top = Math.min(377.5, y + 7.2);
    beam(
      out,
      'metal',
      [x - width / 2, y, z - 0.13],
      [x + width / 2, top, z - 0.13],
      0.13,
      0.15,
      silver,
    );
    beam(
      out,
      'metal',
      [x + width / 2, y, z - 0.13],
      [x - width / 2, top, z - 0.13],
      0.13,
      0.15,
      silver,
    );
    beam(
      out,
      'metal',
      [x - width / 2, y, z - 0.13],
      [x + width / 2, y, z - 0.13],
      0.15,
      0.15,
      silver,
    );
  }
  box(
    out,
    'metal',
    [x - width / 2 - 0.4, 378, z - 0.35],
    [x + width / 2 + 0.4, 381, -hz + 0.15],
    silver,
  );
}
function crown(out) {
  // The built crown is a group of folded triangular fins, not occupied setback boxes.
  // Three interleaved L folds in each quadrant form four highest tips and lower shoulders.
  function blade(a, b, peak) {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz),
      normal = [-dz / length, 0, dx / length];
    const base = [
      [a[0], 380, a[1]],
      [b[0], 380, b[1]],
      [b[0], 384, b[1]],
      [a[0], peak, a[1]],
    ];
    const front = base.map((p) => p.map((v, i) => v + normal[i] * 0.18)),
      back = base.map((p) => p.map((v, i) => v - normal[i] * 0.18));
    face(out, 'metal', front, crownBlue);
    face(out, 'metal', [...back].reverse(), crownBlue);
    for (let i = 0; i < 4; i++)
      face(out, 'metal', [front[i], back[i], back[(i + 1) % 4], front[(i + 1) % 4]], crownBlue);
    beam(out, 'metal', base[3], base[2], 0.1, 0.1, [0.46, 0.61, 0.66]);
    for (let y = 381.5; y < peak - 0.3; y += 1.5) {
      const t = Math.min(1, (peak - y) / (peak - 384));
      for (const side of [-1, 1])
        beam(
          out,
          'metal',
          [a[0] + normal[0] * side * 0.195, y, a[1] + normal[2] * side * 0.195],
          [a[0] + dx * t + normal[0] * side * 0.195, y, a[1] + dz * t + normal[2] * side * 0.195],
          0.04,
          0.04,
          [0.4, 0.56, 0.62],
        );
    }
    // Fine vertical ACP divisions follow the full-height sloping edge, with no copied maps.
    for (let k = 1; k < Math.ceil(length / 1.65); k++) {
      const t = k / Math.ceil(length / 1.65),
        height = peak + (384 - peak) * t;
      for (const side of [-1, 1])
        beam(
          out,
          'metal',
          [a[0] + dx * t + normal[0] * side * 0.195, 380, a[1] + dz * t + normal[2] * side * 0.195],
          [
            a[0] + dx * t + normal[0] * side * 0.195,
            height,
            a[1] + dz * t + normal[2] * side * 0.195,
          ],
          0.02,
          0.018,
          [0.31, 0.48, 0.55],
        );
    }
  }
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      for (const [r, peak] of [
        [2.7, 425],
        [8.3, 413],
        [13.7, 400],
      ]) {
        blade([sx * r, sz * r], [sx * 19.1, sz * r], peak);
        blade([sx * r, sz * r], [sx * r, sz * 17.8], peak);
      }
      // Ties sit behind the folded cladding; the four pinnacle positions remain distinct.
      for (let y = 382; y < 411; y += 5) {
        beam(out, 'metal', [sx * 2.7, y, sz * 2.7], [sx * 8.3, y + 3, sz * 8.3], 0.1, 0.1, silver);
      }
      beam(
        out,
        'metal',
        [sx * 2.7, 380, sz * 2.7],
        [sx * 2.7, 424.7, sz * 2.7],
        0.22,
        0.22,
        silver,
      );
    }
}
function podium(out, m) {
  const plan = partPlan(
    m,
    partsEvidence('n0200_marina_101').find((p) => p.id === 1074877791),
  );
  mappedSolid(out, 'stone', plan, 0, 12.5, [0.43, 0.415, 0.39]);
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i],
      b = plan[(i + 1) % plan.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
    const at = (t, y, d = 0.04) => [
      a[0] + (b[0] - a[0]) * t + n[0] * d,
      y,
      a[1] + (b[1] - a[1]) * t + n[1] * d,
    ];
    for (let k = 0; k < Math.floor(len / 4.5); k++) {
      const count = Math.floor(len / 4.5),
        t0 = (k + 0.16) / count,
        t1 = (k + 0.84) / count;
      grid(
        out,
        [at(t0, 0.15), at(t1, 0.15), at(t1, 4.8), at(t0, 4.8)],
        blue,
        1.5,
        2.4,
        0.07,
        silver,
        'metal',
      );
      grid(
        out,
        [at(t0, 6), at(t1, 6), at(t1, 10.8), at(t0, 10.8)],
        blue,
        1.5,
        2.4,
        0.065,
        silver,
        'metal',
      );
    }
    for (let y = 1; y < 12.4; y += 0.8)
      beam(out, 'metal', at(0, y, 0.045), at(1, y, 0.045), 0.012, 0.014, [0.33, 0.32, 0.3]);
    beam(out, 'metal', at(0, 12.3, 0.15), at(1, 12.3, 0.15), 0.3, 0.4, silver);
  }
  // Sea-side street portal, with a grounded canopy and separated glazing frames.
  box(out, 'metal', [-8, 4.6, -32], [10, 5.15, -27], silver);
  for (const x of [-7, 9])
    box(out, 'stone', [x - 0.25, 0, -31.3], [x + 0.25, 4.6, -30.8], [0.39, 0.38, 0.36]);
  // Enclose the transparent door leaves in a shallow street vestibule.
  // Its rear overlaps the mapped wall; side glazing, a header and a sill connect it.
  box(out, 'stone', [-4.6, 0, -30.7], [6.6, 0.12, -27.8], [0.38, 0.38, 0.36]);
  box(out, 'metal', [-4.6, 3.8, -30.6], [6.6, 4.05, -27.8], silver);
  face(
    out,
    'glass',
    [
      [-4.6, 3.8, -30.15],
      [6.6, 3.8, -30.15],
      [6.6, 0.12, -30.15],
      [-4.6, 0.12, -30.15],
    ],
    [0.09, 0.15, 0.17],
  );
  for (const x of [-4.6, 6.6]) {
    face(
      out,
      'clear_glass',
      [
        [x, 0.12, -30.48],
        [x, 0.12, -27.8],
        [x, 3.8, -27.8],
        [x, 3.8, -30.48],
      ],
      [0.62, 0.77, 0.79],
    );
    beam(out, 'metal', [x, 0.12, -30.48], [x, 3.8, -30.48], 0.09, 0.09, silver);
  }
  for (const x of [-3, 1, 5]) {
    face(
      out,
      'clear_glass',
      [
        [x - 1.4, 0.12, -30.48],
        [x + 1.4, 0.12, -30.48],
        [x + 1.4, 3.8, -30.48],
        [x - 1.4, 3.8, -30.48],
      ],
      [0.62, 0.77, 0.79],
    );
    beam(out, 'metal', [x, 0.12, -30.56], [x, 3.8, -30.56], 0.055, 0.07, silver);
    for (const side of [-1, 1])
      beam(
        out,
        'metal',
        [x + side * 0.18, 1.1, -30.66],
        [x + side * 0.18, 2.05, -30.66],
        0.028,
        0.045,
        silver,
      );
  }
}
export function buildMarina101(out, m) {
  podium(out, m);
  shaft(out);
  panoramicLift(out);
  crown(out);
}
export const marina101Study = {
  id: 'N0200',
  key: 'marina_101',
  title: 'Marina 101',
  wikidataId: 'Q1165269',
  height: 425,
  build: buildMarina101,
  brief:
    'Detailed425m Marina101 with two-tone aluminum piers and recessed glazing, three flared light-dish bands, sea-side paired panoramic lift, pale upper wings, four separate stepped blue pinnacles and granite street podium.',
  sourceFacts: {
    architect: 'National Engineering Bureau',
    mainContractor: 'TAV Construction',
    crownFabricator: 'Skyart',
    heightMeters: 425,
    highestOccupiedMeters: 370.9,
    crownHeightMeters: 45,
    aboveGroundFloors: 101,
    crownSteelTonnes: 650,
  },
  reconstruction: {
    frame:
      'Exact-QID41.284×38.135m shaft and independent surrounding podium; published425m supersedes mapped432m.',
    facade:
      'Developer2014 plan and rendered elevations cross-checked against contractor facade photograph and NorlandoPobre2020 built crown image.94 reconstructed typical window courses between podium and occupied top; mechanical-band heights and individual pier widths are photo-derived.',
    crown:
      'Four groups of thin closed folded triangular fins, with two lower shoulders and inset service bracing, reconstruct the fabricator isometric and built2020 silhouette. Specific panel gauge, internal bracing positions and intermediate top contours are not surveyed.',
  },
  refs: [
    'https://www.neb.ae/project/marina-101/',
    'https://sheffieldholdings.com/web/images/pages_uploaded_image/51481_Marina-101-Brochure.pdf',
    'https://cdnc.heyzine.com/files/uploaded/v2/d6e20aacb4cba4734ed48ff6ac644422f417d324.pdf',
    'https://www.tavconstruction.com/eng/TAV-Construction-Brochure-October2025.pdf',
    'https://www.skyscrapercenter.com/dubai/marina-101/207',
    'https://www.flickr.com/photos/npobre/49981386642/',
    'https://www.openstreetmap.org/way/195527261',
    'https://www.openstreetmap.org/way/1074877791',
  ],
  nativeAxes: {
    up: '+Y',
    longAxis: '+X northeast toward Dubai',
    shortAxis: '+Z southeast toward Sheikh Zayed Road; -Z sea',
  },
  geographic: (m) => ({
    heading: m.heading,
    notes:
      'Exact named shaft and separate podium retain their signed mapped frame. Developer plans explicitly label Dubai, AbuDhabi, SEA and SZR, placing the paired panoramic lift on native-Z/northwest sea facade. Published425m controls architectural height; sourceY0 is the ground podium. Entry portal is a photograph-based seaward reconstruction, not an independently mapped doorway.',
  }),
  limitations: [
    commonLimit,
    'Crown shoulder contours, facade-course elevations, light-dish profiles, typical window modules, entry portal and service bracing are reconstructed from primary drawings and completed exterior photos. Architectural completion is represented without asserting hotel opening or occupancy. Temporary maintenance defects, leasing banners, buried basement structure, neighboring towers and interiors are excluded.',
  ],
  camera: { position: [-450, 265, -490], lookAt: [0, 204, 0], fov: 42 },
  qaCameras: [
    { name: 'sea-panorama-lifts', position: [-52, 207, -113], lookAt: [2, 200, -20] },
    { name: 'paired-lift-bracing', position: [11, 193, -48], lookAt: [2.7, 188, -22] },
    { name: 'recessed-window-piers', position: [66, 166, 32], lookAt: [20, 164, 2] },
    { name: 'flared-light-dishes', position: [49, 239, -43], lookAt: [16, 228, -14] },
    { name: 'upper-aluminum-wings', position: [68, 345, 62], lookAt: [15, 340, 14] },
    { name: 'four-point-blue-crown', position: [82, 427, -87], lookAt: [0, 401, 0] },
    { name: 'crown-panel-shoulders', position: [35, 411, 38], lookAt: [12, 402, 12] },
    { name: 'crown-cruciform-slot', position: [0, 434, 17], lookAt: [0, 399, 0] },
    { name: 'granite-podium', position: [-78, 23, -72], lookAt: [-5, 7, -13] },
    { name: 'street-entry', position: [1, 5, -49], lookAt: [1, 2.8, -29] },
    { name: 'far-marina-silhouette', position: [-595, 273, -640], lookAt: [0, 206, 0] },
  ],
};
