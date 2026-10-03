/** Original exterior study from the Amsterdam BMA measured section and photographed fabric.
 * Reference imagery remains external. Heights are measured from the section's scale bar;
 * the conflicting historical 48 m statement is retained as an unresolved source discrepancy.
 */
import {
  beam,
  cross,
  loft,
  normalize,
  radialRing,
  smoothMeshNormals,
  sphere,
} from './authored-structure-mesh.mjs';
import {
  archBay,
  column,
  facade,
  frame,
  transform,
  triangle,
} from './heritage-tower-detail-mesh.mjs';
import { shell } from './lighthouse-expansion-models.mjs';
import { lathe } from './lighthouse-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const tau = Math.PI * 2;
const brick = [0.49, 0.4, 0.31],
  pale = [0.88, 0.85, 0.76];
const stone = [0.67, 0.64, 0.54],
  dark = [0.035, 0.048, 0.045],
  gold = [0.83, 0.64, 0.25];
const octagon = (y, r) => radialRing(y, r, r, 8, [0, 0], Math.PI / 8);

function molding(out, y, r, height = 0.28) {
  loft(
    out,
    'metal',
    [
      octagon(y, r - 0.08),
      octagon(y + height * 0.3, r),
      octagon(y + height * 0.7, r + 0.09),
      octagon(y + height, r + 0.09),
    ],
    pale,
  );
}

function curvedStrip(out, points, width, color = pale) {
  let normal;
  const rings = points.map((point, i) => {
    const before = points[Math.max(0, i - 1)],
      after = points[Math.min(points.length - 1, i + 1)];
    const tangent = normalize(after.map((v, axis) => v - before[axis]));
    if (!normal)
      normal = normalize(cross(tangent, Math.abs(tangent[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0]));
    else {
      const along = normal.reduce((sum, v, axis) => sum + v * tangent[axis], 0);
      normal = normalize(normal.map((v, axis) => v - along * tangent[axis]));
    }
    const binormal = cross(tangent, normal);
    return Array.from({ length: 12 }, (_, j) =>
      point.map(
        (v, axis) =>
          v +
          width *
            (normal[axis] * Math.cos((j * tau) / 12) + binormal[axis] * Math.sin((j * tau) / 12)),
      ),
    );
  });
  loft(out, 'metal', rings, color);
}

function scroll(out, x, y, z, width, height) {
  // Profile of the lead-clad Renaissance counter-curves, reconstructed from the elevation.
  const points = [
    [0, 0],
    [0.34, 0.06],
    [0.46, 0.27],
    [0.44, 0.61],
    [0.26, 0.88],
    [0.05, 1],
    [-0.2, 0.94],
    [-0.23, 0.72],
    [-0.1, 0.66],
  ];
  const curve = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)],
      p1 = points[i];
    const p2 = points[i + 1],
      p3 = points[Math.min(points.length - 1, i + 2)];
    for (let j = 0; j <= 12; j++) {
      if (i > 0 && j === 0) continue;
      const t = j / 12;
      const p = p1.map(
        (v, k) =>
          0.5 *
          (2 * v +
            (-p0[k] + p2[k]) * t +
            (2 * p0[k] - 5 * v + 4 * p2[k] - p3[k]) * t * t +
            (-p0[k] + 3 * v - 3 * p2[k] + p3[k]) * t * t * t),
      );
      curve.push([x + p[0] * width, y + p[1] * height, z]);
    }
  }
  curvedStrip(out, curve, 0.065);
  sphere(out, 'metal', [x - width * 0.1, y + height * 0.66, z], [0.1, 0.1, 0.085], pale, 12, 8);
}

function clock(out, angle, y, z, radius = 1.06) {
  const wall = transform(out, angle);
  box(wall, 'metal', [-1.19, y - 1.19, z - 0.05], [1.19, y + 1.19, z + 0.03], dark);
  frame(wall, 'metal', 0, y - 1.19, 2.38, 2.38, z + 0.04, 0.065, pale);
  const p = (r, t, depth = 0.085) => [Math.sin(t) * r, y + Math.cos(t) * r, z + depth];
  for (let i = 0; i < 120; i++) {
    const a = (i * tau) / 120,
      b = ((i + 1) * tau) / 120;
    triangle(wall, 'metal', [[0, y, z + 0.07], p(radius, b, 0.07), p(radius, a, 0.07)], dark);
    tube(wall, 'metal', p(radius, a), p(radius, b), 0.025, gold, 8);
    if (i % 2 === 0)
      beam(wall, 'metal', p(radius * 0.96, a), p(radius * 0.89, a), 0.014, 0.025, gold);
  }
  const numerals = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  const strokes = {
    I: [[0, 0, 0, 1]],
    V: [
      [-0.5, 1, 0, 0],
      [0, 0, 0.5, 1],
    ],
    X: [
      [-0.5, 0, 0.5, 1],
      [-0.5, 1, 0.5, 0],
    ],
  };
  for (let i = 0; i < 12; i++) {
    const a = (i * tau) / 12,
      label = numerals[i];
    const at = (x, v) => [
      Math.sin(a) * (0.7 + v * 0.18) + Math.cos(a) * x,
      y + Math.cos(a) * (0.7 + v * 0.18) - Math.sin(a) * x,
      z + 0.11,
    ];
    for (let j = 0; j < label.length; j++)
      for (const [x, v, xx, vv] of strokes[label[j]]) {
        const offset = (j - (label.length - 1) / 2) * 0.068;
        beam(
          wall,
          'metal',
          at(offset + x * 0.057, v),
          at(offset + xx * 0.057, vv),
          0.022,
          0.022,
          gold,
        );
      }
  }
  for (const [a, length, width] of [
    [-Math.PI / 3, 0.62, 0.06],
    [Math.PI / 3, 0.86, 0.045],
  ]) {
    beam(wall, 'metal', [0, y, z + 0.15], p(length, a, 0.15), width, 0.045, gold);
    sphere(wall, 'metal', p(length * 0.67, a, 0.15), [0.07, 0.07, 0.03], gold, 12, 6);
  }
  sphere(wall, 'metal', [0, y, z + 0.17], [0.08, 0.08, 0.035], gold, 16, 8);
}

function bell(out, x, y, z, radius) {
  lathe(
    out,
    'metal',
    [
      [y, radius],
      [y + 0.1, radius * 0.95],
      [y + 0.25, radius * 0.7],
      [y + 0.68, radius * 0.48],
      [y + 0.86, radius * 0.3],
    ],
    [0.28, 0.24, 0.15],
    64,
    [x, z],
  );
  tube(out, 'metal', [x, y - 0.05, z], [x, y + 0.67, z], 0.045, dark, 12);
  sphere(out, 'metal', [x, y + 0.06, z], [0.085, 0.11, 0.085], dark, 16, 8);
  box(
    out,
    'wood',
    [x - 0.5, y + 0.83, z - 0.13],
    [x + 0.5, y + 1.03, z + 0.13],
    [0.24, 0.19, 0.12],
  );
}

function openStage(out, y0, spring, rise, top, r, width, corniceRadius = r) {
  const z = r * Math.cos(Math.PI / 8),
    halfFace = r * Math.sin(Math.PI / 8);
  for (let i = 0; i < 8; i++) {
    const angle = (i * tau) / 8,
      wall = transform(out, angle);
    for (const side of [-1, 1]) {
      const lo = side < 0 ? -halfFace : width / 2,
        hi = side < 0 ? -width / 2 : halfFace;
      box(wall, 'metal', [lo, y0, z - 0.22], [hi, top, z], pale);
    }
    archBay(wall, 'metal', 0, width, y0, spring, rise, top, z, 0.22, pale, {
      back: false,
      trim: 0,
    });
    curvedStrip(
      wall,
      Array.from({ length: 65 }, (_, j) => {
        const a = -Math.PI / 2 + (j * Math.PI) / 64;
        return [(Math.sin(a) * width) / 2, spring + Math.cos(a) * rise, z + 0.028];
      }),
      0.027,
    );
    // Reverse inner face keeps the genuine openings solid when seen through the opposite arch.
    const inside = transform(out, angle + Math.PI);
    archBay(inside, 'metal', 0, width, y0, spring, rise, top, -z + 0.22, 0.22, pale, {
      back: false,
      trim: 0,
    });
    for (const side of [-1, 1])
      column(wall, 'metal', side * (halfFace - 0.08), z + 0.07, y0 + 0.08, spring, 0.11, pale, 20);
    box(wall, 'metal', [-halfFace, y0, z - 0.2], [halfFace, y0 + 0.12, z + 0.1], pale);
    for (const x of [-width / 3, 0, width / 3])
      column(wall, 'metal', x, z + 0.02, y0 + 0.15, y0 + 0.8, 0.028, pale, 10);
    beam(
      wall,
      'metal',
      [-width / 2, y0 + 0.78, z + 0.04],
      [width / 2, y0 + 0.78, z + 0.04],
      0.09,
      0.09,
      pale,
    );
  }
  molding(out, top, corniceRadius, 0.24);
}

export function buildMontelbaanstoren(out) {
  // Section ground-to-tip: (1629 - 69) / (371 px / 10 m) = 42.05 m.
  // The broad 1610 buttressing foot is an original geometric interpretation, not the buried foundation.
  loft(
    out,
    'brick',
    [octagon(0, 5.55), octagon(0.68, 5.55), octagon(1.08, 4.8), octagon(1.24, 4.75)],
    brick,
  );
  const holes = [
    {
      angle: Math.PI,
      y: 1.13,
      h: 2.25,
      w: 1.04,
      depth: 0.36,
      trimSlot: 'limestone',
      trimColor: stone,
    },
    ...[0, Math.PI / 2, -Math.PI / 2].map((angle) => ({
      angle,
      y: 4.0,
      h: 1.86,
      w: 1.07,
      depth: 0.34,
      trimSlot: 'limestone',
      trimColor: stone,
      grid: true,
    })),
    ...[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((angle) => ({
      angle,
      y: 11.83,
      h: 1.36,
      w: 0.72,
      depth: 0.28,
      trimSlot: 'limestone',
      trimColor: stone,
      grid: true,
    })),
  ];
  shell(out, {
    profile: [
      [1.2, 4.36],
      [14.1, 4.29],
    ],
    holes,
    slot: 'round_brick',
    color: brick,
    segments: 192,
  });
  // Upper masonry is eight-sided, with round-headed shallow recesses and stone dressings.
  const r = 4.45,
    z = r * Math.cos(Math.PI / 8),
    w = 2 * r * Math.sin(Math.PI / 8);
  for (let i = 0; i < 8; i++) {
    const wall = transform(out, (i * tau) / 8);
    facade(
      wall,
      'brick',
      w,
      14.1,
      19,
      z,
      [{ x: 0, w: 0.72, y: 16.7, spring: 17.35, rise: 0.36, top: 17.78, depth: 0.28, trim: 0 }],
      brick,
    );
    archBay(wall, 'limestone', 0, 0.72, 16.7, 17.35, 0.36, 17.78, z + 0.02, 0.09, stone, {
      back: true,
      trim: 0.075,
    });
    for (const x of [-0.48, 0.48])
      box(wall, 'brick', [x - 0.085, 15, z + 0.015], [x + 0.085, 18.45, z + 0.07], brick);
    for (const y of [14.2, 17.85, 18.5])
      box(wall, 'limestone', [-w / 2, y, z], [w / 2, y + 0.09, z + 0.06], stone);
    // Small masonry anchor plates and their fasteners are geometry shared with no private maps.
    for (const y of [14.4, 18.02]) {
      beam(
        wall,
        'metal',
        [-0.18, y - 0.18, z + 0.09],
        [0.18, y + 0.18, z + 0.09],
        0.04,
        0.025,
        dark,
      );
      beam(
        wall,
        'metal',
        [0.18, y - 0.18, z + 0.09],
        [-0.18, y + 0.18, z + 0.09],
        0.04,
        0.025,
        dark,
      );
    }
  }
  molding(out, 18.75, 4.5, 0.25);
  const clockProfile = [
    [19, 4.58],
    [19.25, 4.5],
    [19.6, 3.85],
    [20.25, 2.81],
    [23.35, 2.81],
  ];
  loft(
    out,
    'metal',
    clockProfile.map(([y, r]) => octagon(y, r)),
    pale,
  );
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i * tau) / 8;
    curvedStrip(
      out,
      clockProfile.map(([y, r]) => [Math.cos(a) * (r + 0.015), y, Math.sin(a) * (r + 0.015)]),
      0.023,
    );
  }
  for (let i = 0; i < 4; i++)
    clock(out, (i * Math.PI) / 2, 21.92, 2.81 * Math.cos(Math.PI / 8) + 0.035);
  molding(out, 23.32, 3.08, 0.25);
  openStage(out, 23.57, 27.15, 0.67, 28.32, 2.55, 1.22, 2.85);
  // Curving lower lantern roof, intermediate ornaments and the narrower upper open stage.
  const transition = [
    [28.56, 2.8],
    [28.8, 2.76],
    [29.1, 2.45],
    [29.55, 1.96],
    [30.4, 1.64],
    [30.8, 1.59],
  ];
  loft(
    out,
    'metal',
    transition.map(([y, r]) => octagon(y, r)),
    pale,
  );
  for (let i = 0; i < 8; i++) {
    const a = (i * tau) / 8,
      wall = transform(out, a);
    scroll(wall, 0, 28.9, 2.12, 1.15, 1.48);
    const corner = transform(out, a + Math.PI / 8);
    for (const [y, r] of [
      [23.57, 3],
      [28.56, 2.85],
      [30.98, 1.72],
    ]) {
      column(corner, 'metal', 0, r, y, y + 0.58, 0.06, pale, 24);
      sphere(corner, 'metal', [0, y + 0.64, r], [0.09, 0.13, 0.09], pale, 24, 12);
    }
  }
  molding(out, 30.78, 1.81, 0.2);
  openStage(out, 30.98, 34.12, 0.41, 35.06, 1.52, 0.63);
  loft(
    out,
    'metal',
    [
      [35.3, 1.67],
      [35.52, 1.58],
      [35.9, 1.12],
      [36.32, 0.69],
      [36.72, 0.46],
      [37.13, 0.45],
      [37.73, 0.55],
      [38.2, 0.37],
      [38.6, 0.095],
    ].map(([y, r]) => octagon(y, r)),
    pale,
  );
  for (let i = 0; i < 8; i++) {
    const a = (i * tau) / 8,
      points = [];
    for (let j = 0; j <= 24; j++) {
      const t = j / 24,
        r = 0.12 + 0.48 * Math.sin(Math.PI * t);
      points.push([Math.cos(a) * r, 36.75 + t * 1.5, Math.sin(a) * r]);
    }
    curvedStrip(out, points, 0.025);
  }
  tube(out, 'metal', [0, 38.48, 0], [0, 42.05, 0], 0.032, dark, 16);
  sphere(out, 'metal', [0, 40.17, 0], [0.37, 0.37, 0.37], gold, 48, 24);
  tube(out, 'metal', [-0.89, 41.12, 0], [0.89, 41.12, 0], 0.026, dark, 12);
  tube(out, 'metal', [0, 41.12, -0.55], [0, 41.12, 0.55], 0.023, dark, 12);
  // Two exposed striking bells, with independent yokes and clappers.
  bell(out, -0.52, 25.9, 0, 0.48);
  bell(out, 0.43, 32.3, 0, 0.3);
  beam(out, 'wood', [-1.8, 26.93, 0], [1.8, 26.93, 0], 0.17, 0.2, [0.27, 0.22, 0.15]);
}

export const montelbaanstoren = {
  id: 'n0622_montelbaanstoren',
  planId: 'N0622',
  title: 'Montelbaanstoren',
  wikidata: 'Q1946061',
  authoringFile: 'montelbaanstoren-model.mjs',
  build: buildMontelbaanstoren,
  componentMap: { round_brick: 'montel_round_brick' },
  decorateMesh: (mesh) => smoothMeshNormals(mesh, ['trim'], 30),
  size: [10.5, 42.05, 10.5],
  front: '+Z is the provisional principal clock/window face; signed site orientation pending',
  origin: 'Tower axis at surrounding pavement; foundations below street level excluded',
  brief:
    'Amsterdam’s round brick defensive tower with broad 1610 foot, octagonal upper masonry, four black-and-gold Roman clock faces, two genuinely open lead-clad timber stages, bells, balustrades, curved Renaissance scrolls and slender crown/finial.',
  facts: {
    section:
      'Amsterdam BMA, Historisch hout in Amsterdamse monumenten (2012), printed pp. 156–158; section after an earlier measured drawing',
    sectionGroundToTipMeters: 42.05,
    sectionScaleBarMeters: 10,
    sectionPixelScale: 37.1,
    historicalReportedHeightMeters: 48,
    ahn4: {
      surfacePeakNapMeters: 43.5,
      nearbyGroundMedianNapMeters: 2.0209,
      groundSampleRadiusMeters: 15,
      cellMeters: 0.5,
      collectionYears: '2020–2022',
    },
    stageHeightsMeters: {
      masonry: 19,
      clockTop: 23.57,
      lowerLanternTop: 28.56,
      upperLanternBase: 30.98,
      upperLanternTop: 35.3,
      tip: 42.05,
    },
    clockFaces: 4,
    bells: 2,
  },
  refs: [
    'https://monumentenregister.cultureelerfgoed.nl/monumenten/4025',
    'https://www.amsterdam.nl/stadsarchief/stukken/grachten-torens/montelbaanstoren/',
    'https://pure.uva.nl/ws/files/2809631/178913_Historisch_hout_in_Amsterdamse_monumenten.pdf',
    'https://www.amsterdam-monumentenstad.nl/database/grachtenboek_objecten.php?id=5391',
    'https://service.pdok.nl/rws/actueel-hoogtebestand-nederland/wcs/v1_0?SERVICE=WCS&REQUEST=GetCapabilities',
    'https://www.openstreetmap.org/way/57864086',
  ],
  scaleBasis:
    'The municipal measured section’s 0–10 m bar gives approximately 42.05 m above its ground line. AHN4 surface peak 43.5 m NAP and nearby pavement around 2.02 m NAP independently support a roughly 42 m exterior, but raster sampling can miss the narrow finial. The catalog’s 48 m historical figure is retained as conflicting evidence, not silently used to stretch the drawing.',
  geographicProposal: {
    anchor: [4.905663475, 52.372039158],
    heading: 1.407879250402,
    source: 'https://www.openstreetmap.org/way/57864086',
    orientationConfidence: 'axis-only',
    evidence:
      'Exact-QID mapped footprint supplies anchor and an undirected plan axis. AHN surface peak lies within about one metre of that center.',
    limitations:
      'The asymmetrical plinth/entrance, signed clock-face facing and pavement elevation need local site-fit review before activation.',
  },
  limits: [
    'Initial measured-section reconstruction; not approved for maximum fidelity or geographic placement.',
    'Fine window distribution, masonry repairs, stone cross-frames, lead seams, corner scrolls and crown profiles require additional facade comparison. Details are original reconstructions within the section envelope.',
    'The 48 m historical height discrepancy remains documented; 42.05 m is an explicit section-derived working scale, not a new survey measurement.',
    'Clock hands are a static 10:10 illustration; working mechanisms, inaccessible internal framing, buried foundations and the surrounding quay are excluded.',
  ],
  cameras: [
    { name: 'clock-stage', position: [8, 23, 12], lookAt: [0, 22, 0] },
    { name: 'lower-lantern', position: [9, 27, 10], lookAt: [0, 26.5, 0] },
    { name: 'upper-lantern', position: [6, 36, 9], lookAt: [0, 34, 0] },
    { name: 'masonry-windows', position: [9, 8, 13], lookAt: [0, 7, 0] },
    { name: 'far-silhouette', position: [55, 28, 70], lookAt: [0, 22, 0] },
  ],
};
