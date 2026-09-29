/** Cape Hatteras: dimensioned NPS exterior, at its post-1999 position, before the2024 restoration. */
import earcut from 'earcut';
import { loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { lighthouseStudy, ring, shell } from './lighthouse-expansion-models.mjs';
import { lathe, panel, piercedFacade, transformed } from './lighthouse-models.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const pale = [0.78, 0.76, 0.65],
  white = [0.88, 0.88, 0.81],
  black = [0.027, 0.034, 0.035],
  brick = [0.51, 0.17, 0.12],
  bronze = [0.13, 0.16, 0.135];
const TAU = Math.PI * 2,
  BOTTOM = 6.6421,
  TOP = 47.6,
  R0 = 4.94665,
  R1 = 2.6162;
const P = (r, y, a) => [r * Math.sin(a), y, r * Math.cos(a)];
const radius = (y) => R0 + ((R1 - R0) * (y - BOTTOM)) / (TOP - BOTTOM);
const windows = [
  ...Array.from({ length: 3 }, (_, i) => ({ a: 0, y: 14.5745 + i * 12.2047 })),
  ...Array.from({ length: 4 }, (_, i) => ({ a: Math.PI, y: 8.47215 + i * 12.2047 })),
].map((h) => ({ ...h, w: 0.7239, h: 1.9558 }));
function octagon(y, apothem) {
  return radialRing(y, apothem / Math.cos(Math.PI / 8), apothem / Math.cos(Math.PI / 8), 8).map(
    ([x, yy, z]) => [
      x * Math.cos(Math.PI / 8) + z * Math.sin(Math.PI / 8),
      yy,
      -x * Math.sin(Math.PI / 8) + z * Math.cos(Math.PI / 8),
    ],
  );
}
function base(out) {
  loft(
    out,
    'granite',
    [
      [0, 5.7023],
      [0.34, 5.7023],
      [0.51, 5.55],
      [1.35, 5.42],
      [1.63, 5.21],
      [1.83, 5.14],
    ].map(([y, r]) => octagon(y, r)),
    pale,
  );
  const apothem = 4.953,
    half = apothem * Math.tan(Math.PI / 8),
    doorY = 1.8288,
    doorW = 2.6416,
    doorH = 3.1877;
  for (let i = 0; i < 8; i++) {
    const o = transformed(out, (i * Math.PI) / 4);
    piercedFacade(o, {
      half,
      y0: 1.83,
      y1: 6.01,
      z: apothem,
      holes: i === 0 ? [{ x: 0, y: doorY, w: doorW, h: doorH, depth: 0.46, trim: 0 }] : [],
      slot: 'brick',
      color: brick,
    });
    // Alternating quoin lengths at both ends of each octagonal face.
    for (let row = 0; row < 9; row++)
      for (const s of [-1, 1]) {
        const w = row % 2 ? 0.42 : 0.73,
          y = 1.9 + row * 0.443;
        box(
          o,
          'granite',
          [s < 0 ? -half : -w + half, y, apothem - 0.09],
          [s < 0 ? -half + w : half, y + 0.397, apothem + 0.11],
          pale.map((v) => v * (row % 3 === 0 ? 0.94 : 1)),
        );
      }
    if (i === 0) {
      for (const x of [-doorW / 2 - 0.2032, doorW / 2 + 0.2032])
        box(
          o,
          'granite',
          [x - 0.2032, doorY, apothem - 0.13],
          [x + 0.2032, doorY + doorH + 0.36, apothem + 0.2],
          pale,
        );
      box(
        o,
        'granite',
        [-doorW / 2 - 0.4064, doorY + doorH, apothem - 0.15],
        [doorW / 2 + 0.4064, doorY + doorH + 0.405, apothem + 0.29],
        pale,
      );
      box(o, 'granite', [-1.83, 5.38, apothem - 0.14], [1.83, 5.61, apothem + 0.39], pale);
      for (const s of [-1, 1]) {
        const x = (s * doorW) / 4;
        panel(
          o,
          'metal',
          x - doorW / 4 + 0.013,
          x + doorW / 4 - 0.013,
          doorY,
          doorY + doorH,
          apothem - 0.451,
          bronze,
        );
        for (const [y, h] of [
          [2.06, 2.29],
          [4.51, 0.28],
        ]) {
          box(
            o,
            'metal',
            [x - 0.43, y, apothem - 0.438],
            [x + 0.43, y + h, apothem - 0.413],
            bronze.map((v) => v * 0.73),
          );
          for (const xx of [x - 0.45, x + 0.45])
            box(
              o,
              'metal',
              [xx - 0.026, y - 0.03, apothem - 0.409],
              [xx + 0.026, y + h + 0.03, apothem - 0.377],
              bronze,
            );
          for (const yy of [y, y + h])
            box(
              o,
              'metal',
              [x - 0.46, yy - 0.026, apothem - 0.409],
              [x + 0.46, yy + 0.026, apothem - 0.377],
              bronze,
            );
        }
        box(
          o,
          'metal',
          [s * 0.095 - 0.027, 3.12, apothem - 0.38],
          [s * 0.095 + 0.027, 3.48, apothem - 0.3],
          [0.35, 0.34, 0.25],
        );
      }
    }
  }
  loft(
    out,
    'granite',
    [
      [5.99, 4.953],
      [6.1, 5.15],
      [6.26, 5.24],
      [6.4, 5.23],
      [6.49, 5.34],
      [6.6421, 5.34],
    ].map(([y, r]) => octagon(y, r)),
    pale,
  );
  // Nine dimensioned steps, including the two deep top landings.
  const depths = [...Array(7).fill(0.2794), 0.8382, 0.9144],
    total = depths.reduce((s, v) => s + v, 0);
  let z = 4.968 + total;
  for (let i = 0; i < depths.length; i++) {
    const d = depths[i],
      y = (i + 1) * 0.2032;
    box(
      out,
      'granite',
      [-1.91, 0, z - d],
      [1.91, y, z],
      pale.map((v) => v * 0.87),
    );
    for (const s of [-1, 1])
      box(out, 'granite', [s * 2.07 - 0.15, 0, z - d], [s * 2.07 + 0.15, y + 0.19, z], pale);
    z -= d;
  }
  for (const x of [-1.75, 1.75]) {
    tube(out, 'metal', [x, 0.99, 8.66], [x, 2.58, 5.7], 0.025, black, 8);
    for (const [y, z] of [
      [0.21, 8.61],
      [1.02, 7.23],
      [1.83, 5.81],
    ])
      tube(out, 'metal', [x, y, z], [x, y + 0.78, z], 0.027, black, 8);
  }
}
/** Convex clipping in (angle,height), retaining analytic spiral boundaries between material colors. */
function clip(poly, f) {
  const result = [];
  if (!poly.length) return result;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      fa = f(a),
      fb = f(b),
      ina = fa >= -1e-10,
      inb = fb >= -1e-10;
    if (ina) result.push(a);
    if (ina !== inb) {
      const t = fa / (fa - fb);
      result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return result.filter(
    (p, i) => i === 0 || Math.hypot(p[0] - result[i - 1][0], p[1] - result[i - 1][1]) > 1e-9,
  );
}
function subtract(poly, h) {
  let remaining = poly;
  const result = [];
  for (const f of [
    (p) => p[0] - h.a0,
    (p) => h.a1 - p[0],
    (p) => p[1] - h.y0,
    (p) => h.y1 - p[1],
  ]) {
    const outside = clip(remaining, (p) => -f(p));
    if (outside.length >= 3) result.push(outside);
    remaining = clip(remaining, f);
    if (remaining.length < 3) break;
  }
  return result;
}
function spiral(out) {
  const holes = windows.flatMap((h) => {
    const a = Math.asin(h.w / (2 * radius(h.y + h.h / 2)));
    return [-TAU, 0, TAU].map((offset) => ({
      a0: h.a - a + offset,
      a1: h.a + a + offset,
      y0: h.y,
      y1: h.y + h.h,
    }));
  });
  const phase = (y) => -0.14 + (3 * Math.PI * (y - BOTTOM)) / (TOP - BOTTOM);
  for (let j = 0; j < 128; j++)
    for (let i = 0; i < 160; i++) {
      const a = (i * TAU) / 160,
        b = ((i + 1) * TAU) / 160,
        y0 = BOTTOM + ((TOP - BOTTOM) * j) / 128,
        y1 = BOTTOM + ((TOP - BOTTOM) * (j + 1)) / 128;
      const original = [
          [a, y0],
          [b, y0],
          [b, y1],
          [a, y1],
        ],
        low = Math.floor((a - phase(y1)) / (Math.PI / 2)),
        high = Math.floor((b - phase(y0)) / (Math.PI / 2));
      for (let k = low; k <= high; k++) {
        let poly = clip(original, (p) => p[0] - phase(p[1]) - (k * Math.PI) / 2);
        poly = clip(poly, (p) => ((k + 1) * Math.PI) / 2 - p[0] + phase(p[1]));
        if (poly.length < 3) continue;
        let pieces = [poly];
        for (const h of holes) {
          if (h.a1 < a || h.a0 > b || h.y1 < y0 || h.y0 > y1) continue;
          pieces = pieces.flatMap((p) => subtract(p, h));
        }
        const color = ((k % 2) + 2) % 2 === 0 ? black : white;
        for (const p of pieces)
          for (let v = 1; v < p.length - 1; v++) {
            const points = [p[0], p[v], p[v + 1]].map(([a, y]) => P(radius(y), y, a));
            const n = normalFor(...points),
              crossArea = Math.hypot(...points[1].map((x, t) => x - points[0][t]));
            if (!Number.isFinite(n[0]) || crossArea < 1e-6) continue;
            // Reject numerical slivers before Float32 export, preserving both clean color boundaries.
            const ab = points[1].map((v, j) => v - points[0][j]),
              ac = points[2].map((v, j) => v - points[0][j]);
            if (
              Math.hypot(
                ab[1] * ac[2] - ab[2] * ac[1],
                ab[2] * ac[0] - ab[0] * ac[2],
                ab[0] * ac[1] - ab[1] * ac[0],
              ) < 1e-7
            )
              continue;
            out.addTriangle(
              'plaster',
              'metric:uv',
              points,
              n,
              [p[0], p[v], p[v + 1]].map(([a, y]) => [a * radius(y), y]),
              color,
            );
          }
      }
    }
  for (const h of windows) {
    const o = transformed(out, h.a),
      z = radius(h.y + h.h / 2),
      w = h.w / 2;
    panel(o, 'glass', -w, w, h.y, h.y + h.h, z - 0.29, [0.12, 0.17, 0.165]);
    for (const s of [-1, 1])
      box(
        o,
        'plaster',
        [s * w - 0.055, h.y - 0.07, z - 0.3],
        [s * w + 0.055, h.y + h.h + 0.07, z + 0.01],
        pale,
      );
    for (const y of [h.y, h.y + h.h])
      box(o, 'plaster', [-w - 0.052, y - 0.05, z - 0.3], [w + 0.052, y + 0.05, z + 0.04], pale);
    // Pre-restoration rectangular iron replacement sash: no proposed historic pediments.
    for (const x of [-w + 0.027, 0, w - 0.027])
      box(
        o,
        'metal',
        [x - 0.019, h.y + 0.025, z - 0.273],
        [x + 0.019, h.y + h.h - 0.025, z - 0.24],
        black,
      );
    for (let j = 0; j <= 5; j++) {
      const y = h.y + (j * h.h) / 5;
      box(o, 'metal', [-w, y - 0.018, z - 0.273], [w, y + 0.018, z - 0.24], black);
    }
    box(
      o,
      'granite',
      [-w - 0.07, h.y - 0.105, z - 0.08],
      [w + 0.07, h.y - 0.045, z + 0.1],
      pale.map((v) => v * 0.85),
    );
  }
}
function bracket(out, angle) {
  const o = transformed(out, angle),
    outer = [
      [2.6, 47.25],
      [2.75, 47.25],
      [3.14, 48.48],
      [3.43, 49.08],
      [3.7, 49.2],
      [3.93, 49.11],
      [4.18, 49.26],
      [4.34, 49.63],
      [4.35, 50.2],
      [2.6, 50.2],
    ],
    hole = Array.from({ length: 36 }, (_, i) => [
      3.16 + 0.395 * Math.cos((i * TAU) / 36),
      49.32 + 0.395 * Math.sin((i * TAU) / 36),
    ]),
    points = [...outer, ...hole],
    indices = earcut(points.flat(), [outer.length], 2);
  for (const s of [-1, 1])
    for (let i = 0; i < indices.length; i += 3) {
      const ps = indices.slice(i, i + 3).map((k) => [s * 0.065, points[k][1], points[k][0]]);
      if (normalFor(...ps)[0] * s < 0) ps.reverse();
      o.addTriangle(
        'metal',
        'metric:uv',
        ps,
        [s, 0, 0],
        ps.map((p) => [p[2], p[1]]),
        black,
      );
    }
  for (const [p, inside] of [
    [outer, false],
    [hole, true],
  ])
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length];
      const ps = [
        [-0.065, a[1], a[0]],
        [0.065, a[1], a[0]],
        [0.065, b[1], b[0]],
        [-0.065, b[1], b[0]],
      ];
      if (inside) ps.reverse();
      quad(o, 'metal', ps, normalFor(...ps.slice(0, 3)), black);
      for (const s of [-1, 1])
        tube(o, 'metal', [s * 0.073, a[1], a[0]], [s * 0.073, b[1], b[0]], 0.019, black, 6);
    }
  // Turned pendant under each radial gallery beam, visually separate from its curled bracket.
  const pendant = transformed(o, 0, [0, 0, 4.19]);
  lathe(
    pendant,
    'metal',
    [
      [48.89, 0.032],
      [48.98, 0.087],
      [49.07, 0.101],
      [49.11, 0.064],
      [49.2, 0.125],
      [49.3, 0.125],
      [49.34, 0.085],
      [49.43, 0.105],
      [49.89, 0.075],
      [50.05, 0.13],
      [50.27, 0.13],
    ],
    black,
    32,
  );
  const post = transformed(o, 0, [0, 0, 4.46]);
  lathe(
    post,
    'metal',
    [
      [50.3, 0.06],
      [50.45, 0.066],
      [50.49, 0.11],
      [50.57, 0.11],
      [50.65, 0.068],
      [51.02, 0.047],
      [51.15, 0.076],
      [51.22, 0.067],
      [51.25, 0.094],
      [51.31, 0.066],
      [51.47, 0.04],
    ],
    black,
    28,
  );
  sphere(post, 'metal', [0, 51.49, 0], [0.055, 0.065, 0.055], black, 20, 10);
}
function galleries(out) {
  // Three small service windows between brackets, at the north/east/south-east quadrants.
  shell(out, {
    profile: [
      [47.6, 2.6162],
      [50.22, 2.69],
    ],
    holes: [0, -Math.PI / 4, -Math.PI / 2].map((angle) => ({
      angle,
      y: 48.2,
      w: 0.51,
      h: 1.08,
      depth: 0.14,
      trimSlot: 'metal',
      trimColor: black,
    })),
    slot: 'metal',
    color: black,
    segments: 160,
  });
  for (let i = 0; i < 16; i++) bracket(out, (i * TAU) / 16);
  ring(out, 'metal', 50.19, 2.62, 4.5466, 0.1147, black, 192);
  for (const y of [51.17, 51.48]) ring(out, 'metal', y, 4.443, 4.473, 0.032, black, 192);
  for (let i = 0; i < 96; i++)
    tube(
      out,
      'metal',
      P(4.453, 50.3, (i * TAU) / 96),
      P(4.453, 51.49, (i * TAU) / 96),
      0.0125,
      black,
      6,
    );
  // Watch room and upper gallery, with panel joints, storm door and upper plain guard rail.
  shell(out, {
    profile: [
      [50.3, 2.69],
      [53.16, 2.69],
    ],
    holes: [
      { angle: 0, y: 50.32, w: 0.91, h: 2.1, depth: 0.1, trimSlot: 'metal', trimColor: black },
    ],
    slot: 'metal',
    color: black,
    segments: 160,
  });
  panel(
    out,
    'metal',
    -0.455,
    0.455,
    50.32,
    52.42,
    2.582,
    black.map((v) => v * 0.7),
  );
  box(out, 'metal', [0.29, 51.2, 2.59], [0.34, 51.36, 2.65], [0.25, 0.23, 0.18]);
  for (let i = 0; i < 40; i++) {
    const a = (i * TAU) / 40;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.2) continue;
    tube(
      out,
      'metal',
      P(2.696, 50.33, a),
      P(2.696, 53.13, a),
      0.013,
      black.map((v) => v * 1.65),
      6,
    );
  }
  for (const y of [50.45, 52.96, 53.1]) ring(out, 'metal', y, 2.67, 2.745, 0.055, black, 160);
  ring(out, 'metal', 53.14, 2.35, 3.12, 0.15, black, 160);
  for (const y of [53.76, 54.34]) ring(out, 'metal', y, 3.039, 3.075, 0.035, black, 160);
  for (let i = 0; i < 32; i++)
    tube(
      out,
      'metal',
      P(3.058, 53.29, (i * TAU) / 32),
      P(3.058, 54.38, (i * TAU) / 32),
      0.02,
      black,
      8,
    );
  lathe(
    out,
    'metal',
    [
      [53.29, 2.44],
      [53.45, 2.44],
    ],
    black,
    160,
  );
  for (let i = 0; i < 16; i++) {
    const a = (i * TAU) / 16,
      b = ((i + 1) * TAU) / 16;
    const p = [P(2.43, 53.45, a), P(2.43, 53.45, b), P(2.43, 56.87, b), P(2.43, 56.87, a)];
    quad(out, 'glass', p, normalFor(...p.slice(0, 3)), [0.2, 0.29, 0.3]);
    tube(out, 'metal', P(2.45, 53.44, a), P(2.45, 56.96, a), 0.032, black, 10);
    const o = transformed(out, a);
    for (const y of [54.16, 55.51, 56.34]) {
      box(o, 'metal', [-0.047, y - 0.055, 2.46], [0.047, y + 0.055, 2.495], black);
      tube(o, 'metal', [-0.052, y - 0.054, 2.51], [-0.052, y + 0.054, 2.51], 0.026, black, 10);
    }
  }
  for (const y of [53.44, 54.58, 55.72, 56.87])
    ring(out, 'metal', y, 2.39, 2.465, 0.055, black, 160);
  lathe(
    out,
    'metal',
    [
      [56.86, 2.54],
      [56.99, 2.67],
      [57.12, 2.65],
      [58.17, 0.48],
      [58.26, 0.25],
      [58.51, 0.25],
      [58.6, 0.16],
    ],
    black,
    160,
  );
  for (let i = 0; i < 16; i++)
    tube(
      out,
      'metal',
      P(2.65, 57.12, (i * TAU) / 16),
      P(0.48, 58.17, (i * TAU) / 16),
      0.014,
      black.map((v) => v * 1.7),
      6,
    );
  sphere(out, 'metal', [0, 58.72, 0], [0.14, 0.16736, 0.14], black, 32, 16);
  tube(out, 'metal', [0, 58.72, 0], [0, 60.49975, 0], 0.018, [0.27, 0.24, 0.16], 10);
}
export function buildCapeHatteras(out) {
  base(out);
  spiral(out);
  galleries(out);
}
export const hatterasStudies = [
  lighthouseStudy({
    id: 'N0669',
    key: 'cape_hatteras_lighthouse',
    title: 'Cape Hatteras Lighthouse',
    wikidataId: 'Q2508238',
    build: buildCapeHatteras,
    metricTriangleUv: true,
    normalAt(p, slot, _ref, n) {
      if (slot !== 'wall' || p[1] <= BOTTOM || p[1] >= TOP || n[1] > 0.8) return;
      const r = Math.hypot(p[0], p[2]);
      if (Math.abs(r - radius(p[1])) > 1e-4) return;
      const slope = (R0 - R1) / (TOP - BOTTOM),
        length = Math.hypot(1, slope);
      return [p[0] / r / length, slope / length, p[2] / r / length];
    },
    size: [13, 60.5, 16],
    smoothNormalSlots: ['wall', 'trim'],
    previewCamera: { position: [35, 31, 59], lookAt: [0, 29, 0], fov: 48 },
    visualBrief:
      'Dimensioned octagonal brick-and-granite pedestal, nine entrance steps and paired bronze doors, continuously tapered masonry shaft with two smooth helical black stripes and seven staggered recessed windows, sixteen pierced ornamental gallery brackets and turned pendants, ornate lower guard rail, black watch room, upper gallery, sixteen-panel lantern, copper roof and lightning conductor.',
    sourceFacts: {
      heightToRoofPeakMeters: 58.88736,
      heightToLightningRodMeters: 60.499752,
      lowerGalleryHeightMeters: 50.3047,
      lowerGalleryDiameterMeters: 9.0932,
      baseHeightMeters: 6.6421,
      baseBottomAcrossFlatsMeters: 11.4046,
      baseTopAcrossFlatsMeters: 9.906,
      shaftBottomDiameterMeters: 9.8933,
      shaftDiameterAtBracketsMeters: 5.2324,
      windowCount: 7,
      windowSizeMeters: [0.7239, 1.9558],
      sameSideWindowPitchMeters: 12.2047,
      appearanceEra: 'Documented post-1999 operating exterior before2024–2026 restoration',
      basis:
        'NPS construction/maintenance FAQ gives primary dimensions, seven windows with staggered3/4 allocation, nine step dimensions and two stripes making1.5turns. The National Register nomination identifies the north doorway. NPS facade and gallery photographs govern granite quoins, window sash, ornamental bracket/circular void profile, pendants, watch-room paneling and lantern hardware. Overall roof/gallery control heights govern the model; NPS column height spans a different structural interval and is not blindly added to the pedestal and gallery heights.',
    },
    referencePages: [
      'https://home.nps.gov/caha/learn/historyculture/constructionandmaintenancefaqs.htm',
      'https://www.nps.gov/caha/planyourvisit/chls.htm',
      'https://www.nps.gov/npgallery/GetAsset/a3141bf7-c60f-4989-9c8d-15bffe8c9613',
      'https://www.nps.gov/caha/planyourvisit/images/21307_CAHA_lighthouse01_KM.JPG',
      'https://www.nps.gov/caha/planyourvisit/images/IMG_4519.jpg',
      'https://www.nps.gov/caha/learn/news/cape-hatteras-lighthouse-restoration-project.htm',
      'https://www.openstreetmap.org/way/295324032',
      'https://www.openstreetmap.org/way/232996350',
    ],
    geographicProposal: {
      anchor: [-75.528815503, 35.250536462],
      heading: -3.0773,
      elevationMode: 'terrain-contact',
      groundModelY: 0,
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/way/295324032',
      notes:
        'Current post-1999 circular tower way fixes the center; its broader paved outline is not used to stretch the dimensioned11.4m stone base. Native+Z doorway faces north, matching the National Register and the mapped north approach path; the path junction gives a small west-of-north bearing. Structural dimensions remain unscaled and the stone footing contacts local ground.',
    },
    limitations: [
      'This is the recognizable operating exterior before the2024–2026 restoration, not a claim that ongoing work has finished. The July2026 NPS update reports stripped masonry and planned future painting, historic pediments and a replica lens. Temporary construction equipment and those uncompleted changes are excluded. Octagonal base diameters are interpreted across opposite faces so the published shaft diameter fits the upper plinth. Ornament curves and lantern small fittings are reconstructed from NPS close photographs; detached oil house and keeper houses remain separate structures.',
    ],
    qaCameras: [
      { name: 'near-entry', position: [10.7, 6.6, 16.5], lookAt: [0, 3.4, 4] },
      { name: 'near-stripes', position: [14, 27, 21], lookAt: [0, 28, 0] },
      { name: 'near-brackets', position: [9, 47.9, 11], lookAt: [0, 49.4, 0] },
      { name: 'near-lantern', position: [8, 56.3, 10], lookAt: [0, 54.9, 0] },
      { name: 'far-silhouette', position: [47, 31, 72], lookAt: [0, 30, 0] },
    ],
  }),
];
