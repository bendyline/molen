/** Isolated Tower of Hercules master and district derivative; legacy shared lighthouse recipes remain unchanged. */
import { beam, loft, sphere as originalSphere, radialRing } from './authored-structure-mesh.mjs';
import {
  lathe as originalLathe,
  panel,
  piercedFacade,
  squareCornice,
  transformed,
} from './lighthouse-models.mjs';
import { box, tube as originalTube } from './structure-mesh.mjs';

const stone = [0.56, 0.51, 0.42],
  stoneLight = [0.64, 0.6, 0.51],
  dark = [0.09, 0.115, 0.12];
export function buildHerculesDetail(out, district = false) {
  const archSegments = district ? 6 : 14;
  const lathe = (o, s, p, c, n, center) =>
    originalLathe(o, s, p, c, district ? Math.min(8, n) : n, center);
  const tube = (o, s, a, b, r, c, n) =>
    originalTube(o, s, a, b, r, c, district ? Math.min(4, n) : n);
  const sphere = (o, s, p, r, c, n, m) =>
    originalSphere(o, s, p, r, c, district ? 8 : n, district ? 4 : m);
  function railRing(out, y, r, height, color = dark, segments = 32) {
    segments = district ? Math.min(12, segments) : segments;
    for (const yy of [y + height * 0.48, y + height])
      for (let i = 0; i < segments; i++) {
        const a = (i * Math.PI * 2) / segments,
          b = ((i + 1) * Math.PI * 2) / segments;
        tube(
          out,
          'metal',
          [Math.cos(a) * r, yy, Math.sin(a) * r],
          [Math.cos(b) * r, yy, Math.sin(b) * r],
          0.025,
          color,
          8,
        );
      }
    for (let i = 0; i < segments; i++) {
      const a = (i * Math.PI * 2) / segments;
      tube(
        out,
        'metal',
        [Math.cos(a) * r, y, Math.sin(a) * r],
        [Math.cos(a) * r, y + height, Math.sin(a) * r],
        0.029,
        color,
        8,
      );
    }
  }

  function lantern(
    out,
    { bottom, radius, height, color = dark, glass = true, segments = 12, roofHeight = 0.9 },
  ) {
    lathe(
      out,
      'metal',
      [
        [bottom, radius * 1.09],
        [bottom + 0.16, radius * 1.09],
        [bottom + 0.23, radius],
      ],
      color,
      48,
    );
    if (glass)
      loft(
        out,
        'glass',
        [
          radialRing(bottom + 0.23, radius * 0.98, radius * 0.98, segments),
          radialRing(bottom + height, radius * 0.98, radius * 0.98, segments),
        ],
        [0.27, 0.39, 0.42],
      );
    for (let i = 0; i < segments; i++) {
      const a = (i * Math.PI * 2) / segments;
      tube(
        out,
        'metal',
        [Math.cos(a) * radius, bottom + 0.17, Math.sin(a) * radius],
        [Math.cos(a) * radius, bottom + height, Math.sin(a) * radius],
        0.045,
        color,
        8,
      );
    }
    for (const y of [bottom + height * 0.51, bottom + height])
      lathe(
        out,
        'metal',
        [
          [y, radius * 1.02],
          [y + 0.055, radius * 1.02],
        ],
        color,
        48,
      );
    lathe(
      out,
      'metal',
      [
        [bottom + height, radius * 1.16],
        [bottom + height + 0.14, radius * 1.16],
        [bottom + height + 0.35, radius * 0.96],
        [bottom + height + roofHeight * 0.8, radius * 0.38],
        [bottom + height + roofHeight, 0.065],
      ],
      color,
      64,
    );
    sphere(
      out,
      'metal',
      [0, bottom + height + roofHeight + 0.16, 0],
      [0.13, 0.16, 0.13],
      color,
      20,
      12,
    );
  }

  function build(out) {
    // Polygonal platform and parapet; origin is the terrain-contact base.
    loft(out, 'ashlar', [radialRing(0, 16.2, 16.2, 12), radialRing(1.4, 16.2, 16.2, 12)], stone);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6,
        b = ((i + 1) * Math.PI) / 6;
      const start = [Math.cos(a) * 15.7, Math.sin(a) * 15.7];
      const end = [Math.cos(b) * 15.7, Math.sin(b) * 15.7];
      // Open the parapet at the landing; retain the sides of both adjacent polygon edges.
      if (i === 2 || i === 3) {
        const clipped = i === 2 ? end : start;
        const fixed = i === 2 ? start : end;
        const x = i === 2 ? 2.8 : -2.8;
        clipped[1] += ((x - clipped[0]) / (fixed[0] - clipped[0])) * (fixed[1] - clipped[1]);
        clipped[0] = x;
      }
      beam(out, 'ashlar', [start[0], 1.95, start[1]], [end[0], 1.95, end[1]], 0.52, 1.1, stone);
      beam(
        out,
        'granite',
        [start[0], 2.54, start[1]],
        [end[0], 2.54, end[1]],
        0.63,
        0.12,
        stoneLight,
      );
    }
    box(out, 'granite', [-2.5, 0, 14.7], [2.5, 1.4, 16.0], stoneLight);
    for (let i = 0; i < 8; i++)
      box(
        out,
        'granite',
        [-2.5, 0, 16.0 + i * 0.35],
        [2.5, 1.4 - i * 0.17, 16.35 + i * 0.35],
        stoneLight,
      );
    const half = 5.875,
      base = 1.4,
      top = 35.78;
    // Ten niches/openings per elevation and their architraves are geometry, not a facade bitmap.
    for (let face = 0; face < 4; face++) {
      const o = transformed(out, (face * Math.PI) / 2);
      const holes = [];
      for (let row = 0; row < 5; row++)
        for (const column of [-1, 1])
          holes.push({
            x: column * 2.25,
            // Each facade follows the helical band; identical rows on all faces would cut openings.
            y: base + 1.6 + face * 1.575 + row * 6.3,
            w: 1.1,
            h: 2.35,
            blind: column < 0 || row === 4,
            depth: 0.3,
          });
      piercedFacade(o, {
        half,
        y0: base,
        y1: top,
        z: half,
        holes: holes.map((h) => ({ ...h, trim: district ? 0 : h.trim })),
      });
      for (let turn = 0; turn < 6; turn++) {
        const low = base - 0.2 + turn * 6.3 + face * 1.575,
          high = low + 1.575;
        if (low < base || high > top - 0.9) continue;
        beam(
          o,
          'granite',
          [-half, low, half + 0.035],
          [half, high, half + 0.035],
          0.1,
          0.23,
          stoneLight,
        );
      }
      for (const x of [-half + 0.23, half - 0.23])
        box(o, 'granite', [x - 0.23, base, half - 0.02], [x + 0.23, top - 0.2, half + 0.04], stone);
    }
    squareCornice(out, 35.55, 6.4);
    // The concave shoulder is approximated by multiple measured-profile loft stations.
    loft(
      out,
      'ashlar',
      [
        [36.05, 5.0],
        [36.5, 4.8],
        [37.15, 4.55],
        [38.0, 4.42],
        [42.55, 4.42],
      ].map(([y, r]) =>
        radialRing(y, r / Math.cos(Math.PI / 8), r / Math.cos(Math.PI / 8), 8, [0, 0], Math.PI / 8),
      ),
      stone,
    );
    for (let face = 0; face < 4; face++) {
      const o = transformed(out, (face * Math.PI) / 2);
      panel(o, 'glass', -0.52, 0.52, 38.75, 40.55, 4.435, dark);
      for (const x of [-0.63, 0.63])
        box(o, 'granite', [x - 0.09, 38.6, 4.4], [x + 0.09, 40.7, 4.58], stoneLight);
      for (const y of [38.58, 40.67])
        box(o, 'granite', [-0.77, y, 4.4], [0.77, y + 0.13, 4.64], stoneLight);
    }
    for (const [y, r] of [
      [42.5, 4.85],
      [42.82, 4.96],
      [43.15, 4.72],
    ])
      lathe(
        out,
        'granite',
        [
          [y, r],
          [y + 0.17, r],
        ],
        stoneLight,
        8,
      );
    loft(
      out,
      'ashlar',
      [43.32, 47.6].map((y) => radialRing(y, 2.5, 2.5, 8, [0, 0], Math.PI / 8)),
      stone,
    );
    // Upper arcaded stage: paired pilasters, shallow arched niche bands, and eight crowning finials.
    for (let face = 0; face < 8; face++) {
      const a = (face * Math.PI) / 4,
        o = transformed(out, a),
        z = 2.32;
      panel(o, 'glass', -0.38, 0.38, 44.25, 45.75, z, dark);
      for (const x of [-0.6, 0.6])
        beam(o, 'granite', [x, 43.65, z + 0.015], [x, 46.75, z + 0.015], 0.18, 0.16, stoneLight);
      for (let i = 0; i < archSegments; i++) {
        const t0 = (i * Math.PI) / archSegments,
          t1 = ((i + 1) * Math.PI) / archSegments;
        beam(
          o,
          'granite',
          [Math.cos(t0) * 0.59, 45.78 + Math.sin(t0) * 0.64, z + 0.055],
          [Math.cos(t1) * 0.59, 45.78 + Math.sin(t1) * 0.64, z + 0.055],
          0.1,
          0.1,
          stoneLight,
        );
      }
    }
    lathe(
      out,
      'granite',
      [
        [47.55, 2.65],
        [47.82, 2.78],
        [48.02, 2.65],
      ],
      stoneLight,
      8,
    );
    railRing(out, 48.03, 2.58, 0.85, dark, 24);
    lantern(out, { bottom: 48.05, radius: 1.78, height: 2.13, roofHeight: 0.95, segments: 12 });
    // The conspicuous offset stone service/lightning spine reaches above the lantern.
    const spine = transformed(out, 0, [2.5, 0, -2.15]);
    lathe(
      spine,
      'ashlar',
      [
        [43.2, 0.65],
        [50, 0.5],
        [54.0, 0.28],
        [54.35, 0.08],
      ],
      stone,
      32,
    );
    for (let y = 43.6; y < 54; y += district ? 1.88 : 0.47)
      lathe(
        spine,
        'granite',
        [
          [y, 0.66 - (y - 43.6) * 0.035],
          [y + 0.045, 0.66 - (y - 43.6) * 0.035],
        ],
        stoneLight,
        32,
      );
    tube(spine, 'metal', [0, 54.3, 0], [0, 55, 0], 0.013, dark, 8);
    for (const sign of [-1, 1])
      tube(out, 'metal', [2.5, 53.5, -2.15], [sign * 5.65, 35.7, -5.65], 0.012, dark, 6);
  }

  build(out);
}
export function buildHerculesMaster(out) {
  buildHerculesDetail(out);
}
export function buildHerculesDistrict(out) {
  buildHerculesDetail(out, true);
}
