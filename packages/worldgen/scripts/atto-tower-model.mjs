/** ATTO main research tower: published frame dimensions with explicit site/detail uncertainty. */
import { beam, cross, loft, normalize, radialRing, sphere } from './authored-structure-mesh.mjs';
import { compactAuthoredMesh } from './compact-authored-mesh.mjs';
import { transform, triangle } from './heritage-tower-detail-mesh.mjs';
import { box, tube } from './structure-mesh.mjs';

const red = [0.79, 0.235, 0.085],
  white = [0.86, 0.865, 0.82],
  silver = [0.66, 0.7, 0.7],
  dark = [0.08, 0.105, 0.11],
  yellow = [0.89, 0.72, 0.055];
const tau = 2 * Math.PI;
const guyLevels = [54, 108, 162, 216, 270, 321];
// These radii are a provisional geometric study, not measured site anchors.
const anchorRadii = [75, 75, 150, 150, 225, 225];
const shaftPaint = (y) => (Math.floor(y / 30) % 2 ? white : red);

/** Closed unequal-plane angle, with actual flange thickness and concave section. */
function angle(out, a, b, width, thickness, color, normal = [0, 0, 1]) {
  const axis = normalize(b.map((v, i) => v - a[i])),
    u = normalize(cross(normal, axis)),
    v = cross(axis, u);
  const profile = [
    [0, 0],
    [width, 0],
    [width, thickness],
    [thickness, thickness],
    [thickness, width],
    [0, width],
  ];
  const section = (p) => profile.map(([s, t]) => p.map((n, i) => n + u[i] * s + v[i] * t));
  const aa = section(a),
    bb = section(b);
  loft(out, 'metal', [aa, bb], color, { cap: false });
  for (const indices of [
    [0, 1, 2],
    [0, 2, 3],
    [0, 3, 5],
    [3, 4, 5],
  ]) {
    triangle(
      out,
      'metal',
      indices.map((i) => bb[i]),
      color,
    );
    triangle(
      out,
      'metal',
      [...indices].reverse().map((i) => aa[i]),
      color,
    );
  }
}

function hexBolt(out, x, y, z, color = red) {
  tube(out, 'metal', [x, y, z], [x, y, z + 0.012], 0.029, color, 12);
  tube(out, 'metal', [x, y, z + 0.012], [x, y, z + 0.035], 0.022, color, 6);
}

function latticeBay(out, color, height = 3) {
  for (let side = 0; side < 4; side++) {
    const o = transform(out, (side * Math.PI) / 2);
    // Each corner owns both flanges; adjacent faces do not duplicate the chord.
    box(o, 'metal', [-1.5, 0, 1.488], [-1.32, height, 1.5], color);
    box(o, 'metal', [-1.5, 0, 1.32], [-1.488, height, 1.488], color);
    angle(o, [-1.47, 0.04, 1.475], [1.47, 0.04, 1.475], 0.1, 0.009, color);
    angle(o, [-1.44, 0.09, 1.49], [1.44, height - 0.09, 1.49], 0.1, 0.009, color);
    angle(o, [1.44, 0.09, 1.465], [-1.44, height - 0.09, 1.465], 0.1, 0.009, color);
    for (const x of [-1.42, 1.42]) {
      box(o, 'metal', [x - 0.055, 0, 1.504], [x + 0.055, 0.36, 1.516], color);
      for (const y of [0.08, 0.19, 0.3, height - 0.12]) hexBolt(o, x, y, 1.516, color);
    }
    box(o, 'metal', [-0.075, height / 2 - 0.09, 1.504], [0.075, height / 2 + 0.09, 1.514], color);
    hexBolt(o, 0, height / 2, 1.515, color);
  }
}

/** Open bar grating: daylight remains visible between physical bars. */
function grating(out, x0, z0, x1, z1, y, spacing = 0.07) {
  const n = Math.ceil((x1 - x0) / spacing);
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    box(out, 'stainless', [x - 0.003, y - 0.032, z0], [x + 0.003, y, z1], silver);
  }
  const nz = Math.ceil((z1 - z0) / 0.23);
  for (let i = 0; i <= nz; i++) {
    const z = z0 + ((z1 - z0) * i) / nz;
    box(out, 'stainless', [x0, y - 0.011, z - 0.003], [x1, y - 0.005, z + 0.003], silver);
  }
}

function stairFlight(out) {
  // 107 reconstructed 14-tread flights reach321 m; two ground entry treads make1500.
  for (let i = 1; i <= 14; i++) {
    const x = -1.15 + (2.3 * i) / 14,
      y = (3 * i) / 14;
    grating(out, x - 0.09, 0.23, x + 0.09, 1.05, y, 0.045);
    box(out, 'stainless', [x - 0.09, y - 0.043, 0.23], [x - 0.082, y + 0.002, 1.05], silver);
  }
  for (const z of [0.2, 1.08]) {
    beam(out, 'stainless', [-1.2, 0.05, z], [1.2, 3.05, z], 0.055, 0.1, silver);
    tube(out, 'metal', [-1.2, 1.0, z], [1.2, 4.0, z], 0.025, white, 10);
    for (const i of [0, 4, 8, 12, 14]) {
      const x = -1.15 + (2.3 * i) / 14,
        y = (3 * i) / 14;
      tube(out, 'metal', [x, y, z], [x, y + 1.02, z], 0.022, white, 8);
    }
  }
  grating(out, 1.08, -1.08, 1.4, 1.08, 3);
  // The safety rail follows the stair, distinct from the exterior vertical lift rail.
  beam(out, 'stainless', [-1.17, 0.9, 0.14], [1.17, 3.9, 0.14], 0.028, 0.05, silver);
}

function liftRail(out) {
  const o = transform(out, -Math.PI / 4, [-1.5, 0, 1.5]);
  for (let y = 0; y < 320; y += 6) {
    const top = Math.min(y + 6, 320);
    box(o, 'stainless', [-0.045, y, 0.2], [0.045, top, 0.25], silver);
    for (let s = y + 0.08; s < top; s += 0.1)
      box(o, 'stainless', [-0.047, s, 0.248], [0.047, s + 0.035, 0.267], silver);
    box(o, 'stainless', [-0.064, y + 0.02, 0.185], [0.064, y + 0.27, 0.2], silver);
  }
  for (let y = 0; y < 320; y += 4)
    for (const x of [-0.128, 0.128]) {
      box(o, 'metal', [x - 0.022, y, 0.215], [x + 0.022, Math.min(y + 3.985, 320), 0.26], yellow);
    }
  for (let y = 0.03; y < 320; y += 3) {
    beam(o, 'stainless', [-0.14, y, 0.0], [-0.14, y, 0.28], 0.035, 0.035, silver);
    beam(o, 'stainless', [0.14, y, 0.0], [0.14, y, 0.28], 0.035, 0.035, silver);
  }
}

function weatherHead(out, x, y, z) {
  tube(out, 'stainless', [x, y - 0.3, z], [x, y + 0.47, z], 0.035, silver, 12);
  for (let i = 0; i < 7; i++) {
    const yy = y + i * 0.045,
      r = i < 5 ? 0.125 : 0.105;
    loft(
      out,
      'metal',
      [radialRing(yy, r, r, 24), radialRing(yy + 0.024, r * 0.84, r * 0.84, 24)].map((ring) =>
        ring.map(([a, b, c]) => [a + x, b, c + z]),
      ),
      white,
    );
  }
  for (const a of [0, tau / 3, (2 * tau) / 3]) {
    tube(
      out,
      'metal',
      [x, y + 0.37, z],
      [x + 0.12 * Math.cos(a), y + 0.47, z + 0.12 * Math.sin(a)],
      0.012,
      white,
      8,
    );
    sphere(
      out,
      'metal',
      [x + 0.12 * Math.cos(a), y + 0.47, z + 0.12 * Math.sin(a)],
      [0.035, 0.025, 0.025],
      white,
      10,
      6,
    );
  }
}

function roli(out) {
  const o = transform(out, -Math.PI / 4, [-1.5, 8.3, 1.5]);
  for (const x of [-0.24, 0.24])
    for (const z of [0.29, 0.78])
      box(o, 'stainless', [x - 0.02, 0, z - 0.02], [x + 0.02, 1.9, z + 0.02], silver);
  for (const y of [0, 0.75, 1.9]) {
    for (const z of [0.29, 0.78])
      box(o, 'stainless', [-0.26, y, z - 0.02], [0.26, y + 0.04, z + 0.02], silver);
    for (const x of [-0.24, 0.24])
      box(o, 'stainless', [x - 0.02, y, 0.29], [x + 0.02, y + 0.04, 0.78], silver);
  }
  box(o, 'stainless', [-0.42, 0.28, 0.6], [0.42, 0.92, 1.17], silver);
  box(o, 'metal', [-0.48, 0.96, 0.53], [0.48, 0.982, 1.25], white);
  for (const y of [0.41, 0.59, 0.77])
    box(o, 'stainless', [-0.43, y, 0.59], [0.43, y + 0.028, 1.18], silver);
  for (const x of [-0.2, 0.2]) {
    box(o, 'metal', [x - 0.08, 0.35, 1.18], [x + 0.08, 0.55, 1.2], white);
    for (let i = 0; i < 6; i++)
      box(
        o,
        'shadow',
        [x - 0.065, 0.36 + i * 0.03, 1.201],
        [x + 0.065, 0.367 + i * 0.03, 1.204],
        dark,
      );
  }
  for (const y of [0.18, 1.25]) {
    tube(o, 'metal', [0, y, 0.28], [0, y, 0.63], 0.085, [0.19, 0.21, 0.22], 16);
    for (const x of [-0.17, 0.17])
      box(o, 'metal', [x - 0.05, y - 0.04, 0.28], [x + 0.05, y + 0.1, 0.41], [0.12, 0.46, 0.19]);
  }
  box(o, 'metal', [0.27, 0.96, 0.28], [0.41, 1.7, 0.6], [0.51, 0.55, 0.54]);
  tube(o, 'stainless', [-0.38, 0.46, 1.15], [-0.38, 1.9, 1.15], 0.022, silver, 12);
  loft(
    transform(o, 0, [-0.38, 0, 1.15]),
    'stainless',
    [radialRing(1.9, 0.1, 0.1, 24), radialRing(1.93, 0.075, 0.075, 24)],
    silver,
  );
  weatherHead(o, 0.1, 1.95, 0.65);
  box(o, 'metal', [-0.52, 0.57, 0.99], [-0.42, 0.71, 1.13], white);
  tube(o, 'shadow', [-0.525, 0.64, 1.06], [-0.54, 0.64, 1.06], 0.039, dark, 16);
}

function topPlatform(out) {
  const o = transform(out, 0, [0, 321, 0]);
  grating(o, -3, -3, 3, -1.5, 0);
  grating(o, -3, 1.5, 3, 3, 0);
  grating(o, -3, -1.5, -1.5, 1.5, 0);
  grating(o, 1.5, -1.5, 3, 1.5, 0);
  grating(o, -1.4, -1.4, 1.0, 0.15, 0);
  for (let side = 0; side < 4; side++) {
    const s = transform(o, (side * Math.PI) / 2);
    box(s, 'metal', [-3, -0.18, 2.93], [3, 0.15, 3], red);
    for (const x of [-3, -2, -1, 0, 1, 2, 3])
      tube(s, 'metal', [x, 0, 2.97], [x, 1.13, 2.97], 0.027, red, 10);
    for (const y of [0.56, 1.13]) tube(s, 'metal', [-3, y, 2.97], [3, y, 2.97], 0.028, red, 10);
    beam(s, 'metal', [-1.5, -3, 1.5], [-3, 0, 3], 0.11, 0.11, red);
    beam(s, 'metal', [1.5, -3, 1.5], [3, 0, 3], 0.11, 0.11, red);
    beam(s, 'metal', [-1.5, 0, 1.5], [-3, 0, 3], 0.12, 0.15, red);
    beam(s, 'metal', [1.5, 0, 1.5], [3, 0, 3], 0.12, 0.15, red);
  }
  latticeBay(o, red, 3);
  latticeBay(transform(o, 0, [0, 3, 0]), red, 1);
  for (const x of [-1.5, 1.5])
    for (const z of [-1.5, 1.5]) tube(out, 'metal', [x, 325, z], [0, 326.5, 0], 0.05, red, 12);
  tube(out, 'stainless', [0, 325, 0], [0, 330.96, 0], 0.025, silver, 16);
  loft(
    out,
    'stainless',
    [radialRing(330.9, 0.025, 0.025, 16), radialRing(331, 0.002, 0.002, 16)],
    silver,
  );
  // Published324 m inlet assembly, with separate rain caps and tubing.
  beam(out, 'stainless', [-1.65, 322.5, 1.52], [-1.65, 324.4, 1.52], 0.05, 0.08, silver);
  for (let i = 0; i < 5; i++) {
    const y = 322.6 + i * 0.34;
    const g = transform(out, 0, [-1.65, 0, 1.68]);
    loft(
      g,
      'stainless',
      [
        radialRing(y, 0.115, 0.115, 24),
        radialRing(y + 0.06, 0.13, 0.13, 24),
        radialRing(y + 0.08, 0.115, 0.115, 24),
      ],
      silver,
    );
    tube(out, 'metal', [-1.65, y, 1.68], [-1.62, 321.05, 1.74], 0.011, dark, 8);
  }
  weatherHead(out, 2.65, 322.2, -2.65);
  tube(out, 'stainless', [2.6, 321, 2.6], [2.6, 323, 2.6], 0.028, silver, 12);
  loft(
    transform(out, 0, [2.6, 0, 2.6]),
    'metal',
    [radialRing(323, 0.22, 0.22, 32), radialRing(323.05, 0.17, 0.17, 32)],
    white,
  );
}

function guys(out) {
  for (const [index, y] of guyLevels.entries()) {
    const radius = anchorRadii[index],
      extent = y === 321 ? 3.8 : 2.25,
      col = shaftPaint(y - 0.01);
    for (let side = 0; side < 4; side++) {
      const o = transform(out, (side * Math.PI) / 2);
      for (const x of [-1.5, 1.5]) angle(o, [x, y, 1.5], [0, y, extent], 0.14, 0.012, col);
      beam(o, 'metal', [0, y - 1.1, 1.5], [0, y, extent], 0.1, 0.1, col);
      for (const sign of [-1, 1]) {
        const end = [(sign * radius) / Math.sqrt(2), 0.9, radius / Math.sqrt(2)],
          start = [sign * 0.07, y, extent];
        const sag = radius * 0.012;
        let last = start;
        for (let k = 1; k <= 64; k++) {
          const t = k / 64;
          const p = start.map(
            (v, i) => v + (end[i] - v) * t - (i === 1 ? 4 * sag * t * (1 - t) : 0),
          );
          tube(o, 'stainless', last, p, 0.014, silver, 8);
          last = p;
        }
        const near = end.map((v, i) => v + (start[i] - v) * 0.004);
        tube(o, 'stainless', end, near, 0.042, silver, 10);
      }
    }
  }
  for (const r of [...new Set(anchorRadii)])
    for (let j = 0; j < 4; j++) {
      const a = Math.PI / 4 + (j * Math.PI) / 2,
        x = r * Math.cos(a),
        z = r * Math.sin(a);
      box(out, 'concrete', [x - 0.7, 0, z - 0.7], [x + 0.7, 0.55, z + 0.7], [0.58, 0.57, 0.52]);
      beam(out, 'stainless', [x, 0.4, z], [x, 1.02, z], 0.12, 0.12, silver);
    }
}

function baseAndServices(out) {
  box(out, 'concrete', [-1.9, 0, -1.9], [1.9, 0.18, 1.9], [0.61, 0.6, 0.55]);
  for (const x of [-1.5, 1.5])
    for (const z of [-1.5, 1.5]) {
      box(out, 'metal', [x - 0.18, 0.18, z - 0.18], [x + 0.18, 0.225, z + 0.18], red);
      for (const dx of [-0.12, 0.12])
        for (const dz of [-0.12, 0.12])
          tube(out, 'stainless', [x + dx, 0.225, z + dz], [x + dx, 0.29, z + dz], 0.022, silver, 6);
    }
  for (let i = 0; i < 2; i++)
    grating(out, -0.42, 1.9 + i * 0.2, 0.42, 2.1 + i * 0.2, 0.14 - i * 0.07);
  for (const y of [0, 6, 54, 108, 162, 216, 270, 321]) {
    box(out, 'metal', [1.505, y + 0.35, -0.3], [1.518, y + 0.52, 0.3], white);
    // Physical plaque, intentionally no invented label text or serial numbers.
  }
  for (let y = 0; y < 321; y += 3) {
    const o = transform(out, 0, [0, y, 0]);
    for (const x of [0.82, 1.1]) angle(o, [x, 0, -1.34], [x, 3, -1.34], 0.045, 0.004, silver);
    for (let k = 0; k < 6; k++)
      box(o, 'stainless', [0.82, k * 0.5, -1.34], [1.1, k * 0.5 + 0.022, -1.31], silver);
    for (const x of [0.86, 0.91, 0.96, 1.01, 1.06])
      tube(o, 'metal', [x, 0, -1.35], [x, 3, -1.35], 0.014, dark, 8);
  }
  box(out, 'metal', [0.5, 0.35, -2.05], [1.25, 1.25, -1.65], [0.65, 0.68, 0.64]);
  box(out, 'stainless', [0.48, 1.27, -2.1], [1.28, 1.3, -1.6], silver);
}

function permanent(out) {
  baseAndServices(out);
  topPlatform(out);
  liftRail(out);
  roli(out);
  guys(out);
}

export const attoTower = {
  id: 'n0621_amazon_tall_tower_observatory',
  planId: 'N0621',
  title: 'Amazon Tall Tower Observatory',
  wikidata: 'Q18109585',
  authoringFile: 'atto-tower-model.mjs',
  build(out) {
    permanent(out);
    for (let i = 0; i < 107; i++) {
      latticeBay(transform(out, 0, [0, i * 3, 0]), shaftPaint(i * 3 + 1));
      stairFlight(transform(out, i % 2 ? Math.PI : 0, [0, i * 3, 0]));
    }
  },
  encodeAssembly(encode, join) {
    const parts = [
      {
        name: 'atto-foundations-guys-platform-instruments',
        glb: encode(permanent, 'ATTO equipment and guys'),
        instances: [{}],
      },
    ];
    for (const [name, col, parity] of [
      ['red', red, 0],
      ['white', white, 1],
    ]) {
      parts.push({
        name: `atto-${name}-lattice-bay`,
        glb: encode((out) => latticeBay(out, col), 'ATTO lattice bay'),
        gpuInstances: true,
        instances: Array.from({ length: 107 }, (_, i) => i)
          .filter((i) => Math.floor((i * 3 + 1) / 30) % 2 === parity)
          .map((i) => ({ translation: [0, i * 3, 0] })),
      });
    }
    parts.push({
      name: 'atto-grated-stair-and-landing',
      glb: encode(stairFlight, 'ATTO stair flight'),
      gpuInstances: true,
      instances: Array.from({ length: 107 }, (_, i) => ({
        translation: [0, i * 3, 0],
        angle: i % 2 ? Math.PI : 0,
      })),
    });
    return join(parts, 'Molen original ATTO component assembly');
  },
  decorateMesh: compactAuthoredMesh,
  front:
    'Native (-X,+Z) shaft corner carries the lift. At heading 23 degrees, that corner faces published azimuth 202 degrees; +Y is up.',
  origin:
    'Main 325 m tower center; Y=0 is provisional base slab underside, not a surveyed site datum.',
  brief:
    'Square 3 m research lattice with closed angle-section chords and X braces, visible bolt heads, red/white bands, 1500 grated treads and landings, safety rails, cable trays, 321 m top platform, 331 m lightning rod, six guy levels, external HighStep rails and a detailed stationary RoLi instrument carriage. Shared painted steel, stainless steel and concrete; repeated sections are GPU instances.',
  facts: {
    shaftWidthMeters: 3,
    structuralHeightMeters: 325,
    totalHeightMeters: 331,
    topPlatformMeters: 321,
    documentedSteps: 1500,
    guyAttachmentMeters: guyLevels,
    liftCornerAzimuthDegrees: 202,
    railSectionMeters: 6,
    bracketSpacingMeters: 3,
    powerRailSectionMeters: 4,
    powerRailOffsetMeters: 0.128,
    roliHomeMeters: 8.3,
  },
  refs: [
    'https://www.mpg.de/9365148/ATTO-Factsheet-Aug2015en.pdf',
    'https://www.bgc-jena.mpg.de/~csierra/blog/2025/02/08/Sampling-Heights/',
    'https://www.bgc-jena.mpg.de/5149255/atto',
    'https://amt.copernicus.org/articles/19/101/2026/amt-19-101-2026.html',
    'https://www.attoproject.org/media/gallery/',
    'https://www.attoproject.org/wp-content/uploads/2019/03/ATTO-Newsletter_2_Mar19.pdf',
    'https://www.openstreetmap.org/node/3215117056',
  ],
  scaleBasis:
    'MPI publishes a 3×3 m cross section, 325 m frame, 331 m tip and 1500 steps. The 2025 field report/drawing fixes the 321 m platform; the 2026 RoLi paper fixes the 202-degree lift corner, rail spacing and six guy heights. Bolted angles, stairs, top platform and instruments follow inspected operator photographs. Flange dimensions, paint-band boundaries, individual tread distribution and guy anchor radii are proportional reconstruction requiring further confirmation.',
  geographicProposal: {
    anchor: [-59.0056354, -2.1458835],
    heading: (23 * Math.PI) / 180,
    source: 'https://www.openstreetmap.org/node/3215117056',
    orientationConfidence: 'documented-lift-corner',
    evidence:
      'Exact-QID OSM tower node identifies the main structure, approximately 6 m from the published 2015 coordinate. Native (-X,+Z) corner has bearing 225 degrees before placement; heading 23 degrees produces the independently published lift-corner bearing 202 degrees.',
    limitations:
      'The foundation position, guy-anchor distances and ground heights require site validation. Study anchor radii 75/150/225 m are provisional; do not treat their blocks as surveyed. This asset currently covers the main tall tower. The two separate 80/81 m companion towers and laboratory compound remain required site work.',
  },
  limits: [
    'Guy anchors, sag, paired cable topology, full foundation arrangement and terrain contacts need independent measured site evidence. Present anchor radii 75/150/225 m are provisional geometric reconstruction, not certified placement.',
    'Main lattice/stair flange sizes, intermediate landings, paint-band limits and detailed bolt pattern are proportioned from photographs. Published 1500 treads are distributed as 107 flights of 14 plus two entrance treads; the exact real landing/tread schedule remains unresolved.',
    'The RoLi carriage uses published equipment vocabulary with proportional housing dimensions. It is static at the documented home height. The complete present instrument inventory, inlet routing and rescue equipment still need confirmation.',
    'The smaller 80 m walk-up and 81 m triangular towers, laboratory containers and ancillary facility structures are not yet authored. Completion of the observatory candidate remains pending these scope and site checks.',
  ],
  previewCamera: { position: [285, 205, 480], lookAt: [0, 158, 0], fov: 40 },
  cameras: [
    { name: 'full-main-tower', position: [225, 190, 640], lookAt: [0, 165, 0] },
    { name: 'lattice-and-stairs', position: [7, 41, 10], lookAt: [0, 38, 0] },
    { name: 'angle-joints', position: [3.3, 54.6, 4.7], lookAt: [0.8, 54.8, 1.5] },
    { name: 'roli-instrument-carriage', position: [-4.5, 10.3, 5.8], lookAt: [-1.8, 9.5, 1.8] },
    { name: 'top-platform', position: [13, 330, 18], lookAt: [0, 324, 0] },
    { name: 'inlets-and-lightning', position: [-10, 327.8, 13], lookAt: [0, 326.6, 0] },
    { name: 'base-and-safety-rail', position: [-7, 4, 9], lookAt: [0, 2, 0] },
    { name: 'guy-attachment', position: [6, 111, 10], lookAt: [0, 108, 0] },
    { name: 'whole-guy-envelope', position: [390, 290, 530], lookAt: [0, 145, 0] },
  ],
};
