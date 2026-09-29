/** Individually documented Baltic and offshore lighthouse exteriors. */
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { facadeBlock, lighthouseStudy, ring, shell } from './lighthouse-expansion-models.mjs';
import { lathe, panel, piercedFacade, railRing, transformed } from './lighthouse-models.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const white = [0.86, 0.86, 0.82],
  black = [0.065, 0.075, 0.074],
  red = [0.56, 0.095, 0.055];
const polar = (r, y, a) => [Math.sin(a) * r, y, Math.cos(a) * r];
function glazing(out, y0, y1, r, color = white, n = 16) {
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n,
      ps = [polar(r, y0, a), polar(r, y0, b), polar(r, y1, b), polar(r, y1, a)];
    quad(out, 'glass', ps, normalFor(...ps.slice(0, 3)), [0.23, 0.31, 0.32]);
    tube(out, 'metal', ps[0], ps[3], 0.027, color, 8);
  }
  for (const y of [y0, y0 + (y1 - y0) * 0.32, y0 + (y1 - y0) * 0.67, y1])
    ring(out, 'metal', y, r - 0.033, r + 0.033, 0.046, color, 96);
}
function dome(out, y, r, h, color) {
  const profile = Array.from({ length: 13 }, (_, i) => {
    const a = (i * Math.PI) / 2 / 13;
    return [y + h * Math.sin(a), r * Math.cos(a)];
  });
  profile.push([y + h, r * 0.03]);
  lathe(out, 'metal', profile, color, 128);
  for (let k = 0; k < 16; k++)
    for (let i = 1; i < profile.length; i++)
      tube(
        out,
        'metal',
        polar(profile[i - 1][1] + 0.015, profile[i - 1][0], (k * Math.PI) / 8),
        polar(profile[i][1] + 0.015, profile[i][0], (k * Math.PI) / 8),
        0.022,
        color,
        8,
      );
}
function pediment(out, x, y, w, h, z, color = white) {
  for (const [a, b] of [
    [
      [x - w * 0.66, y + h + 0.06, z],
      [x, y + h + 0.34, z],
    ],
    [
      [x, y + h + 0.34, z],
      [x + w * 0.66, y + h + 0.06, z],
    ],
  ])
    beam(out, 'metal', a, b, 0.07, 0.11, color);
  beam(
    out,
    'metal',
    [x - w * 0.64, y + h + 0.04, z],
    [x + w * 0.64, y + h + 0.04, z],
    0.06,
    0.09,
    color,
  );
}
export function buildTahkuna(out) {
  const r = (y) => 4.475 - ((y - 0.35) * 2.475) / 34.3;
  lathe(
    out,
    'concrete',
    [
      [0, 4.65],
      [0.23, 4.65],
      [0.35, 4.475],
    ],
    white,
    144,
  );
  const holes = [];
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
    for (let j = 0; j < 7; j++)
      holes.push({
        angle,
        y: 4.35 + j * 4.54,
        w: 0.51,
        h: 0.78,
        depth: 0.22,
        trimSlot: 'metal',
        trimColor: white,
      });
  holes.push({
    angle: 0,
    y: 0.35,
    w: 1.1,
    h: 2.28,
    depth: 0.25,
    trimSlot: 'metal',
    trimColor: white,
  });
  shell(out, {
    profile: [
      [0.35, 4.475],
      [34.65, 2],
    ],
    holes,
    slot: 'metal',
    color: white,
    segments: 160,
  });
  // Barbier & Fenestre cover battens: sixteen staggered courses with sixteen panels per course.
  for (let j = 0; j <= 16; j++) {
    const y = 0.35 + (j * 34.3) / 16,
      rr = r(y);
    ring(out, 'metal', y, rr - 0.013, rr + 0.04, 0.045, [0.74, 0.75, 0.71], 160);
    if (j === 16) continue;
    const hi = y + 34.3 / 16;
    for (let k = 0; k < 16; k++) {
      const a = ((k + (j % 2) * 0.5) * Math.PI) / 8;
      // Window seams do not run across the actual apertures.
      const breaks = [
        y,
        hi,
        ...holes
          .filter(
            (q) =>
              Math.abs(Math.atan2(Math.sin(a - q.angle), Math.cos(a - q.angle))) < 0.1 &&
              q.y < hi &&
              q.y + q.h > y,
          )
          .flatMap((q) => [Math.max(y, q.y - 0.1), Math.min(hi, q.y + q.h + 0.15)]),
      ].sort((a, b) => a - b);
      for (let b = 1; b < breaks.length; b++) {
        const lo = breaks[b - 1],
          top = breaks[b],
          mid = (lo + top) / 2;
        if (
          top - lo < 0.01 ||
          holes.some(
            (q) =>
              Math.abs(Math.atan2(Math.sin(a - q.angle), Math.cos(a - q.angle))) < 0.1 &&
              mid > q.y - 0.1 &&
              mid < q.y + q.h + 0.15,
          )
        )
          continue;
        beam(
          out,
          'metal',
          polar(r(lo) + 0.02, lo, a),
          polar(r(top) + 0.02, top, a),
          0.045,
          0.035,
          [0.76, 0.77, 0.73],
        );
      }
    }
  }
  for (const hole of holes) {
    const o = transformed(out, hole.angle),
      z = r(hole.y + hole.h * 0.5) + 0.07;
    pediment(o, 0, hole.y, hole.w, hole.h, z);
    if (hole.y > 0.4)
      beam(
        o,
        'metal',
        [-0.25, hole.y + hole.h * 0.6, z - 0.12],
        [0.25, hole.y + hole.h * 0.6, z - 0.12],
        0.035,
        0.04,
        white,
      );
  }
  panel(out, 'wood', -0.49, 0.49, 0.4, 2.54, 4.25, [0.25, 0.18, 0.115]);
  for (let i = 0; i < 2; i++)
    box(
      out,
      'concrete',
      [-0.8, 0, 4.42 + i * 0.32],
      [0.8, 0.32 - i * 0.15, 4.74 + i * 0.32],
      [0.59, 0.59, 0.56],
    );
  lathe(
    out,
    'metal',
    [
      [34.65, 2],
      [34.95, 2.18],
      [35.3, 2.63],
      [35.53, 2.83],
      [35.72, 2.83],
    ],
    white,
    128,
  );
  for (let i = 0; i < 24; i++) {
    const o = transformed(out, (i * Math.PI) / 12);
    beam(o, 'metal', [0, 34.52, 2.03], [0, 35.55, 2.72], 0.105, 0.105, white);
  }
  railRing(out, 35.73, 2.71, 0.98, white, 48);
  lathe(
    out,
    'metal',
    [
      [35.7, 1.95],
      [37.45, 1.95],
    ],
    white,
    128,
  );
  // Raised watchroom plate panels and a gallery access door.
  for (let i = 0; i < 16; i++)
    beam(
      out,
      'metal',
      polar(1.964, 35.72, (i * Math.PI) / 8),
      polar(1.964, 37.42, (i * Math.PI) / 8),
      0.028,
      0.035,
      [0.75, 0.76, 0.72],
    );
  panel(out, 'metal', -0.37, 0.37, 35.75, 37.17, 1.976, [0.72, 0.74, 0.7]);
  ring(out, 'metal', 37.43, 1.88, 2.22, 0.16, white, 128);
  glazing(out, 37.6, 40.42, 1.91, white, 16);
  // The cleaning gallery outside the lantern, with open cage and hoop rails.
  for (let i = 0; i < 16; i++)
    tube(
      out,
      'metal',
      polar(2.08, 37.59, (i * Math.PI) / 8),
      polar(2.08, 40.52, (i * Math.PI) / 8),
      0.021,
      white,
      8,
    );
  for (const y of [37.64, 38.5, 39.51, 40.49])
    ring(out, 'metal', y, 2.054, 2.084, 0.027, white, 128);
  ring(out, 'metal', 40.43, 1.84, 2.05, 0.12, white, 128);
  dome(out, 40.53, 2.05, 1.34, red);
  sphere(out, 'metal', [0, 42.05, 0], [0.26, 0.25, 0.26], red, 32, 16);
  tube(out, 'metal', [0, 42.22, 0], [0, 42.6, 0], 0.025, black, 8);
}
export const lighthouseFinalCoastalStudies = [
  lighthouseStudy({
    id: 'N0661',
    key: 'tahkuna_lighthouse',
    title: 'Tahkuna Lighthouse',
    wikidataId: 'Q3361471',
    build: buildTahkuna,
    size: [9.3, 42.6, 10],
    smoothNormalSlots: ['trim', 'foundation'],
    visualBrief:
      'White cast-iron taper with the distinctive staggered grid of raised joint-cover battens, four narrow window columns with little pediments, curved bracketed gallery, white plate watchroom, cylindrical glazed lantern with an external cleaning cage, and the current red ribbed dome.',
    sourceFacts: {
      heightMeters: 42.6,
      baseDiameterApproxMeters: 8.95,
      topShaftDiameterApproxMeters: 4,
      year: 1875,
      basis:
        'Municipal destination and Lighthouse Society identify42.6m tower height. Current museum aerial and Society close photograph govern the red dome, cast-iron grid, pedimented openings and gallery arrangement. Diameter is photo-scaled, consistent with the2015 Estonian Post anniversary description reproduced by the philatelic society. Museum sea-height wording and Society live light-height table differ; those values are not substituted for tower height.',
    },
    referencePages: [
      'https://hiiumaa.ee/objekt/tahkuna-tuletorn/',
      'https://hiiumaamuuseum.ee/en/tahkuna-lighthouse/',
      'https://hiiumaamuuseum.ee/wp-content/uploads/2024/04/DJI_0021-scaled.jpg',
      'https://www.etts.ee/en/lighthouses-list/tahkuna-lighthouse/',
      'https://www.etts.ee/wp-content/uploads/2023/09/tahkuna_vta.jpeg',
      'https://www.filateelia.ee/foorum/viewtopic.php?p=9354',
      'https://www.openstreetmap.org/node/3380792473',
    ],
    geographicProposal: {
      anchor: [22.5862233, 59.0914008],
      heading: -0.2,
      elevationMode: 'terrain-contact',
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/node/3380792473',
      notes:
        'Exact-QID mapped lighthouse node fixes tower center. Circular shaft and four approximately quadrantal window columns make silhouette invariant under heading. Main entry/window column is reconstructed toward the southern station approach; its precise small angle is not a mapped entrance measurement.',
    },
    limitations: [
      'Detached keeper houses, fences and displayed former optical apparatus are separate site features. Raised cast-iron joint pattern is geometric; tiny plate fasteners and evolving paint repairs use the shared metal surface. The current red roof follows exterior photographs, whereas green roof mentioned in history describes the original1875 finish.',
    ],
    qaCameras: [
      { name: 'near-lantern', position: [8, 42, 10], lookAt: [0, 39, 0] },
      { name: 'near-plates', position: [10, 19, 12], lookAt: [0, 18, 0] },
      { name: 'near-entry', position: [9, 5, 12], lookAt: [0, 2, 2] },
      { name: 'far-silhouette', position: [46, 28, 58], lookAt: [0, 20, 0] },
    ],
  }),
];
function archedWindow(out, h, z, wallColor) {
  const radius = h.w / 2,
    cy = h.y + h.h - radius;
  for (let k = 0; k < 24; k++) {
    const a = (k * Math.PI) / 24,
      b = ((k + 1) * Math.PI) / 24,
      p = [h.x + radius * Math.cos(a), cy + radius * Math.sin(a), z],
      q = [h.x + radius * Math.cos(b), cy + radius * Math.sin(b), z];
    quad(
      out,
      'plaster',
      [p, [p[0], h.y + h.h + 0.002, z], [q[0], h.y + h.h + 0.002, z], q],
      [0, 0, 1],
      wallColor,
    );
    tube(out, 'wood', p, q, 0.032, white, 8);
  }
  for (const x of [h.x - radius, h.x + radius])
    beam(out, 'wood', [x, h.y, z], [x, cy, z], 0.055, 0.06, white);
  beam(out, 'wood', [h.x, h.y, z - 0.08], [h.x, cy + radius - 0.04, z - 0.08], 0.048, 0.05, white);
  for (const y of [h.y, h.y + h.h * 0.47])
    beam(out, 'wood', [h.x - radius, y, z - 0.08], [h.x + radius, y, z - 0.08], 0.052, 0.06, white);
}
export function buildNosyAlanana(out) {
  const body = [0.67, 0.68, 0.64],
    upper = [0.16, 0.175, 0.165],
    base = [0.4, 0.405, 0.37];
  const apothem = (y) => 3.55 - ((y - 0.8) * 1.73) / 52.1;
  loft(
    out,
    'plaster',
    [
      radialRing(0, 5.1, 5.1, 8, [0, 0], Math.PI / 8),
      radialRing(0.8, 5.1, 5.1, 8, [0, 0], Math.PI / 8),
    ],
    base,
  );
  const windows = [];
  // Ascending stairs illuminate through staggered arched openings on adjacent octagonal faces.
  for (let j = 0; j < 8; j++) {
    windows.push({ face: j % 2, y: 5.2 + j * 5.65, w: 0.76, h: 1.55, x: 0, trim: 0, depth: 0.31 });
    windows.push({
      face: 4 + (j % 2),
      y: 7.9 + j * 5.65,
      w: 0.7,
      h: 1.48,
      x: 0,
      trim: 0,
      depth: 0.31,
    });
  }
  windows.push({ face: 0, x: 0, y: 0.8, w: 1.38, h: 2.22, trim: 0, depth: 0.32, door: true });
  for (let f = 0; f < 8; f++)
    for (const [lo, hi, color] of [
      [0.8, 44.4, body],
      [44.4, 52.9, upper],
    ]) {
      const o = transformed(out, (f * Math.PI) / 4),
        a = apothem(lo);
      const taper = Object.fromEntries(
        ['addQuad', 'addTriangle', 'addConvexPolygon'].map((method) => [
          method,
          (s, ref, p, _n, uv, c) => {
            const ps = p.map(([x, y, z]) => [(x * apothem(y)) / a, y, (z * apothem(y)) / a]);
            o[method](s, ref, ps, normalFor(...ps.slice(0, 3)), uv, c);
          },
        ]),
      );
      const hs = windows.filter((h) => h.face === f && h.y >= lo && h.y + h.h <= hi);
      piercedFacade(taper, {
        half: a * Math.tan(Math.PI / 8),
        z: a,
        y0: lo,
        y1: hi,
        holes: hs,
        slot: 'plaster',
        color,
      });
      for (const h of hs) if (!h.door) archedWindow(taper, h, a + 0.013, color);
    }
  panel(out, 'wood', -0.63, 0.63, 0.82, 2.95, 3.17, [0.26, 0.21, 0.145]);
  for (let x = -0.56; x < 0.63; x += 0.16)
    beam(out, 'wood', [x, 0.86, 3.195], [x, 2.9, 3.195], 0.02, 0.02, [0.32, 0.265, 0.185]);
  box(out, 'concrete', [-1.5, 3.02, 3.33], [1.5, 3.2, 4.57], base);
  // Three broad entrance steps and low side cheeks, visible in the operator's2020 visit photo.
  for (let i = 0; i < 4; i++)
    box(out, 'concrete', [-1.57, 0, 4.88 + i * 0.43], [1.57, 0.8 - i * 0.2, 5.31 + i * 0.43], base);
  for (const x of [-1.7, 1.7])
    box(out, 'concrete', [x - 0.11, 0, 4.88], [x + 0.11, 0.7, 6.6], base);
  // Eight strong gallery consoles and the octagonal concrete balustrade are unlike a steel-ring lighthouse.
  for (let f = 0; f < 8; f++) {
    const o = transformed(out, (f * Math.PI) / 4);
    beam(o, 'plaster', [0, 51.15, 1.92], [0, 53.05, 3.27], 0.3, 0.34, upper);
  }
  loft(
    out,
    'plaster',
    [
      radialRing(52.85, 3.37, 3.37, 8, [0, 0], Math.PI / 8),
      radialRing(53.15, 3.49, 3.49, 8, [0, 0], Math.PI / 8),
    ],
    body,
  );
  const rr = 3.23;
  for (let f = 0; f < 8; f++) {
    const a = (f * Math.PI) / 4 + Math.PI / 8,
      b = ((f + 1) * Math.PI) / 4 + Math.PI / 8,
      p = polar(rr, 53.16, a),
      q = polar(rr, 53.16, b);
    beam(out, 'plaster', [p[0], 54.12, p[2]], [q[0], 54.12, q[2]], 0.18, 0.18, body);
    beam(out, 'plaster', p, q, 0.17, 0.17, body);
    for (let k = 0; k < 5; k++) {
      const t = k / 5,
        x = p[0] + (q[0] - p[0]) * t,
        z = p[2] + (q[2] - p[2]) * t;
      box(out, 'plaster', [x - 0.062, 53.16, z - 0.062], [x + 0.062, 54.13, z + 0.062], body);
    }
  }
  lathe(
    out,
    'plaster',
    [
      [53.14, 1.64],
      [54.53, 1.64],
    ],
    body,
    96,
  );
  ring(out, 'metal', 54.51, 1.58, 1.78, 0.13, black, 96);
  glazing(out, 54.64, 57.48, 1.63, black, 12);
  ring(out, 'metal', 57.45, 1.55, 1.85, 0.15, black, 96);
  dome(out, 57.59, 1.85, 1.24, black);
  lathe(
    out,
    'metal',
    [
      [58.82, 0.22],
      [59.02, 0.22],
    ],
    black,
    48,
  );
  sphere(out, 'metal', [0, 59.08, 0], [0.19, 0.18, 0.19], black, 24, 12);
  tube(out, 'metal', [0, 59.2, 0], [0, 60, 0], 0.025, black, 8);
  for (const y of [59.44, 59.68])
    beam(out, 'metal', [-0.2, y, 0], [0.2, y, 0], 0.024, 0.024, black);
}
const strokes = {
  A: [
    [
      [0, 0],
      [0.5, 1],
      [1, 0],
    ],
    [
      [0.23, 0.45],
      [0.77, 0.45],
    ],
  ],
  R: [
    [
      [0, 0],
      [0, 1],
      [0.75, 1],
      [1, 0.8],
      [1, 0.62],
      [0.75, 0.5],
      [0, 0.5],
    ],
    [
      [0.5, 0.5],
      [1, 0],
    ],
  ],
  '-': [
    [
      [0.15, 0.5],
      [0.85, 0.5],
    ],
  ],
  M: [
    [
      [0, 0],
      [0, 1],
      [0.5, 0.52],
      [1, 1],
      [1, 0],
    ],
  ],
  E: [
    [
      [1, 0],
      [0, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [0, 0.5],
      [0.8, 0.5],
    ],
  ],
  N: [
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
  ],
};
function curvedName(out, y, r, start) {
  const w = 0.82,
    h = 1.38,
    gap = 0.13,
    text = 'AR-MEN';
  for (let i = 0; i < text.length; i++)
    for (const line of strokes[text[i]])
      for (let k = 1; k < line.length; k++) {
        const a = line[k - 1],
          b = line[k];
        for (let j = 0; j < 6; j++) {
          const q = j / 6,
            Q = (j + 1) / 6;
          const point = (t) =>
            polar(
              r,
              y + (a[1] + (b[1] - a[1]) * t) * h,
              start + (i * (w + gap) + (a[0] + (b[0] - a[0]) * t) * w) / r,
            );
          beam(out, 'metal', point(q), point(Q), 0.063, 0.02, black);
        }
      }
}
export function buildArMen(out) {
  const stone = [0.32, 0.315, 0.26],
    darkStone = [0.18, 0.175, 0.15],
    wash = [0.79, 0.79, 0.73];
  // Strengthening envelope is11.2m high; its bottom is partly below the marine datum.
  const shape = (y, rx, rz) =>
    Array.from({ length: 32 }, (_, i) => {
      const a = (i * Math.PI) / 16;
      return [
        Math.sin(a) * rx * (1 + 0.035 * Math.cos(a * 3)),
        y,
        Math.cos(a) * rz * (1 + 0.03 * Math.sin(a * 2)),
      ];
    });
  loft(
    out,
    'ashlar',
    [
      shape(0, 6.1, 5.7),
      shape(3.8, 6.1, 5.7),
      shape(6.2, 5.95, 5.6),
      shape(8.8, 5.1, 4.85),
      shape(10.9, 4.38, 4.19),
      shape(11.2, 4.32, 4.12),
    ],
    stone,
  );
  const radius = (y) => 3.58 - ((y - 10.9) * 0.97) / 20.5;
  const holes = [];
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
    for (let j = angle === Math.PI / 2 ? 1 : 0; j < 5; j++)
      holes.push({
        angle,
        y: 12.1 + j * 3.9,
        w: 0.54,
        h: 1.03,
        depth: 0.24,
        trimSlot: 'ashlar',
        trimColor: wash,
        grid: true,
      });
  holes.push({
    angle: Math.PI / 2,
    y: 11.2,
    w: 0.95,
    h: 1.97,
    depth: 0.32,
    trimSlot: 'ashlar',
    trimColor: stone,
  });
  const shaft = Object.create(out);
  shaft.addQuad = (slot, ref, ps, n, uv, c) => {
    const rr = (Math.hypot(ps[0][0], ps[0][2]) + Math.hypot(ps[2][0], ps[2][2])) / 2;
    out.addQuad(
      slot,
      ref,
      ps,
      n,
      ref === 'metric:uv' ? uv.map(([u, v]) => [(u * 3) / rr, v]) : uv,
      c,
    );
  };
  shell(shaft, {
    profile: [
      [10.9, 3.58],
      [19.7, radius(19.7)],
      [31.4, 2.61],
    ],
    holes,
    slot: 'ashlar',
    color: (y) => (y < 19.7 ? darkStone : wash),
    segments: 160,
  });
  // Identifying painted name band, represented as fine geometry with no embedded label texture.
  for (const y of [22.42, 24.23])
    ring(out, 'metal', y, radius(y) - 0.01, radius(y) + 0.017, 0.055, black, 160);
  for (const a of [-0.82, Math.PI - 0.82]) curvedName(out, 22.66, radius(23.3) + 0.035, a);
  lathe(
    out,
    'ashlar',
    [
      [31.3, 2.615],
      [31.5, 2.73],
      [31.72, 2.98],
      [31.93, 3.05],
    ],
    wash,
    128,
  );
  ring(out, 'metal', 31.9, 1.85, 3.11, 0.18, black, 128);
  railRing(out, 32.08, 2.98, 1.02, black, 48);
  lathe(
    out,
    'granite',
    [
      [32.06, 1.76],
      [33.18, 1.76],
    ],
    [0.45, 0.43, 0.36],
    96,
  );
  for (let k = 0; k < 16; k++) {
    const a = (k * Math.PI) / 8;
    beam(
      out,
      'metal',
      polar(1.8, 32.08, a),
      polar(1.8, 33.19, a),
      0.035,
      0.055,
      [0.69, 0.66, 0.53],
    );
  }
  for (const y of [32.4, 32.83]) ring(out, 'metal', y, 1.75, 1.81, 0.045, [0.68, 0.65, 0.54], 96);
  ring(out, 'metal', 33.16, 1.45, 1.79, 0.11, black, 96);
  glazing(out, 33.27, 35.17, 1.5, [0.62, 0.6, 0.49], 16);
  for (let k = 0; k < 16; k++) {
    const a = (k * Math.PI) / 8,
      b = ((k + 1) * Math.PI) / 8;
    tube(out, 'metal', polar(1.53, 33.29, a), polar(1.53, 35.15, b), 0.014, [0.52, 0.51, 0.43], 8);
  }
  ring(out, 'metal', 35.12, 1.43, 1.7, 0.15, black, 96);
  dome(out, 35.25, 1.69, 0.98, black);
  sphere(out, 'metal', [0, 36.38, 0], [0.21, 0.2, 0.21], black, 24, 12);
  tube(out, 'metal', [0, 36.56, 0], [0, 37, 0], 0.025, black, 8);
  // Current south-facing gallery photovoltaic array, shown in the2025 operator photograph.
  for (let k = -3; k <= 3; k++) {
    const a = k * 0.22;
    const o = transformed(out, a);
    panel(o, 'glass', -0.27, 0.27, 32.17, 32.98, 3.02, [0.07, 0.13, 0.18]);
    for (const x of [-0.285, 0.285])
      box(o, 'metal', [x - 0.015, 32.15, 3.018], [x + 0.015, 33.0, 3.05], [0.54, 0.56, 0.55]);
    beam(o, 'metal', [-0.28, 32.59, 3.057], [0.28, 32.59, 3.057], 0.019, 0.024, [0.45, 0.48, 0.47]);
  }
  // Both documented lower shelters: northeast and east of the shaft, above the strengthening belt.
  for (const [angle, cy, h, w] of [
    [(3 * Math.PI) / 4, 12.1, 4.7, 1.4],
    [Math.PI / 2, 11.2, 3.1, 1.4],
  ]) {
    const o = transformed(out, angle);
    facadeBlock(o, {
      cx: 0,
      cz: 3.44,
      rx: w / 2,
      rz: 1.05,
      y0: cy,
      y1: cy + h,
      slot: 'plaster',
      color: [0.49, 0.5, 0.46],
      windows: [{ face: 0, x: 0, y: cy + 0.12, w: 0.57, h: 1.74, trim: 0.08 }],
    });
    box(o, 'concrete', [-w / 2 - 0.1, cy + h, 2.3], [w / 2 + 0.1, cy + h + 0.18, 4.61], stone);
  }
  // Exposed ladders, handholds and landing steps on the eastern landing face.
  const east = transformed(out, Math.PI / 2);
  for (const x of [-0.38, 0.38])
    tube(east, 'metal', [x, 3.7, 5.9], [x, 11.35, 4.38], 0.033, black, 10);
  for (let y = 3.9; y < 11.35; y += 0.32) {
    const z = 5.9 - ((y - 3.7) * 1.52) / 7.65;
    tube(east, 'metal', [-0.4, y, z], [0.4, y, z], 0.027, black, 8);
  }
  for (let i = 0; i < 7; i++) {
    const y = 7.4 + i * 0.53,
      z = 5.56 - i * 0.2;
    box(east, 'ashlar', [-1.1, y, z - 0.17], [1.1, y + 0.23, z + 0.17], stone);
  }
}
lighthouseFinalCoastalStudies.push(
  lighthouseStudy({
    id: 'N0662',
    key: 'nosy_alanana_light',
    title: 'Nosy Alañaña Light',
    wikidataId: 'Q3378451',
    build: buildNosyAlanana,
    size: [10.2, 60, 11.9],
    smoothNormalSlots: ['trim'],
    visualBrief:
      'Slender eight-sided concrete taper with staggered arched window rows, worn pale lower shaft and dark upper daymark, strong eight gallery consoles, octagonal concrete balustrade, round lantern and domed cap. Broad stepped entrance podium and flat projecting door canopy.',
    sourceFacts: {
      heightMeters: 60,
      baseAcrossFlatsApproxMeters: 7.1,
      year: 1932,
      basis:
        'APMF operator2020 ministerial visit explicitly gives60m height and photographs the doorway, concrete landing steps and lantern. Original2023 Riaan Wessels and2006 Maxsnet exterior photographs establish octagonal taper, staggered arches, upper dark band, concrete gallery and domed cap. Widths and intermediate elevations are photograph proportions.',
    },
    referencePages: [
      'https://apmf.mg/index.php/mediatheque/images/fanilon-dranomasina-eny-aminny-nosy-alagnagna-phare-de-lile-aux-prunes',
      'https://apmf.mg/sites/default/files/images/3_11.jpg',
      'https://apmf.mg/sites/default/files/images/2_10.jpg',
      'https://apmf.mg/sites/default/files/images/4_11.jpg',
      'https://commons.wikimedia.org/wiki/File:Outside_of_lighthouse.jpg',
      'https://commons.wikimedia.org/wiki/File:Phare_de_l%27Ile_aux_Prunes.jpg',
      'https://www.openstreetmap.org/node/5316362054',
    ],
    geographicProposal: {
      anchor: [49.4600634, -18.0488027],
      heading: 0,
      elevationMode: 'terrain-contact',
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/node/5316362054',
      notes:
        'Exact-QID lighthouse node fixes island position, replacing the older point about7m north. Octagonal facade direction and entry toward the southern keeper compound are photograph/site-layout reconstructions; no surveyed entrance bearing is claimed. Terrain supplies island ground contact.',
    },
    limitations: [
      'Paint degradation varies strongly between the2006,2020 and2023 photographs. The model preserves pale shaft/dark upper daymark with reusable plaster and metal surfaces rather than copied stains. Detached keeper houses and island vegetation remain map/environment features; static glazing does not operate a navigational light.',
    ],
    qaCameras: [
      { name: 'near-gallery', position: [10, 56, 12], lookAt: [0, 54.2, 0] },
      { name: 'near-arches', position: [9, 23, 11], lookAt: [0, 22, 0] },
      { name: 'near-entry', position: [9, 5, 12], lookAt: [0, 2, 2] },
      { name: 'far-silhouette', position: [64, 37, 78], lookAt: [0, 28, 0] },
    ],
  }),
  lighthouseStudy({
    id: 'N0663',
    key: 'ar_men',
    title: 'Ar Men',
    wikidataId: 'Q623540',
    build: buildArMen,
    size: [13, 37, 12],
    smoothNormalSlots: ['trim', 'foundation', 'wall'],
    visualBrief:
      'Isolated sea tower rising from a massive irregular strengthening belt, dark lower shaft and white upper masonry, repeated recessed windows and painted AR-MEN name band. Two asymmetric eastern shelters, landing steps and ladder, black gallery with current photovoltaic array, stone watchroom, fine lantern bars and ribbed metal dome.',
    sourceFacts: {
      heightMeters: 37,
      lanternDiameterMeters: 3,
      strengtheningBeltHeightMeters: 11.2,
      basis:
        'Iroise marine-park technical factsheet specifies37m total,3m lantern and11.2m strengthening envelope, and locates attached shelters northeast/east. Its33.5m above-sea figure supports bottom at-3.5m for the37m structure. DIRM2025 operator photograph governs present gallery solar array, name band and masonry silhouette. Exact-QID mapped7.1m circle represents original tower core, not the wider irregular belt.',
    },
    referencePages: [
      'https://parc-marin-iroise.fr/editorial/le-phare-dar-men',
      'https://parc-marin-iroise.fr/media/504/download',
      'https://www.dirm.nord-atlantique-manche-ouest.developpement-durable.gouv.fr/IMG/pdf/livret_phares_2025_export_web_mini_cle527eb3.pdf',
      'https://pop.culture.gouv.fr/notice/merimee/PA29000086',
      'https://www.openstreetmap.org/way/628663159',
    ],
    geographicProposal: {
      anchor: [-4.997732568, 48.050120766],
      heading: 0,
      elevationMode: 'sea-level',
      elevationMeters: -3.5,
      groundModelY: 0,
      status: 'preview-proposal',
      source: 'https://parc-marin-iroise.fr/media/504/download',
      notes:
        'Exact-QID mapped core establishes center. Authored+X east and-Z north set the two shelters to the official northeast/east quadrants. Marine-park37m total versus33.5m above-sea envelope implies bottom-3.5m; this explicit absolute datum avoids sea terrain incorrectly raising the foundation. Tidal level varies, and the reef is supplied by the host.',
    },
    limitations: [
      'Irregular belt plan and individual component elevations are photo-proportioned; the mapped circle is the narrow core. Historic gantry arrangements differ from the2025 operator photo, whose solar array is represented. Name-band lettering is geometric. Reusable stone surfaces represent coursing without copying individual weathering marks.',
    ],
    qaCameras: [
      { name: 'near-lantern', position: [8, 37, 10], lookAt: [0, 33.6, 0] },
      { name: 'near-name', position: [8, 25, 10], lookAt: [0, 23.3, 0] },
      { name: 'near-landing', position: [18, 17, -16], lookAt: [2, 11, 0] },
      { name: 'far-silhouette', position: [43, 25, 52], lookAt: [0, 18, 0] },
    ],
  }),
);
