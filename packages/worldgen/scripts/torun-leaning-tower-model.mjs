/** Original exterior reconstruction from Toruń's 2019 measured restoration record. */
import { beam, loft } from './authored-structure-mesh.mjs';
import { deform, facade, face, frame, transform, triangle } from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';

const brick = [0.56, 0.29, 0.19],
  wood = [0.18, 0.125, 0.09],
  white = [0.82, 0.8, 0.7],
  iron = [0.29, 0.32, 0.31],
  dark = [0.04, 0.05, 0.045];
const heading = -0.178170601621,
  street = 4;
const lean = [(1.46 * Math.sin(heading)) / 15, (-1.46 * Math.cos(heading)) / 15];
const point = ([x, y, z]) => [
  x + lean[0] * (y - street) + 0.022 * z,
  y,
  z + lean[1] * (y - street),
];
const ring = (x0, x1, z0, z1, y) => [
  [x0, y, z0],
  [x0, y, z1],
  [x1, y, z1],
  [x1, y, z0],
];

function disk(out, slot, x, y, z, r, color, n = 12) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2,
      b = ((i + 1) / n) * Math.PI * 2;
    triangle(
      out,
      slot,
      [
        [x, y, z],
        [x + r * Math.cos(a), y + r * Math.sin(a), z],
        [x + r * Math.cos(b), y + r * Math.sin(b), z],
      ],
      color,
    );
  }
}
function paintedBand(out, width, y, z) {
  box(
    out,
    'brick',
    [-width / 2, y - 0.03, z - 0.02],
    [width / 2, y + 0.38, z + 0.025],
    [0.63, 0.35, 0.24],
  );
  for (let x = -width / 2 + 0.25; x < width / 2 - 0.15; x += 0.36) {
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
      disk(
        out,
        'plaster',
        x + 0.067 * Math.cos(a),
        y + 0.17 + 0.067 * Math.sin(a),
        z + 0.03,
        0.073,
        white,
      );
    disk(out, 'brick', x, y + 0.17, z + 0.035, 0.047, [0.63, 0.35, 0.24], 10);
  }
  for (const yy of [y - 0.04, y + 0.38])
    box(out, 'brick', [-width / 2, yy, z], [width / 2, yy + 0.052, z + 0.09], [0.62, 0.35, 0.24]);
}
function reliefBand(out, width, y, z) {
  box(out, 'shadow', [-width / 2, y, z - 0.035], [width / 2, y + 0.55, z], dark);
  for (let x = -width / 2 + 0.23; x < width / 2 - 0.16; x += 0.47) {
    // Four curled lobes form the visible openwork Gothic frieze.
    const paths = [];
    for (let i = 0; i <= 32; i++) {
      const a = (i / 32) * Math.PI * 2,
        r = 0.215 + 0.061 * Math.cos(a * 4);
      paths.push([x + r * Math.cos(a), y + 0.27 + r * Math.sin(a), z + 0.045]);
    }
    for (let i = 1; i < paths.length; i++)
      beam(out, 'brick', paths[i - 1], paths[i], 0.066, 0.065, [0.64, 0.35, 0.235]);
  }
  for (const yy of [y - 0.1, y + 0.54])
    box(
      out,
      'brick',
      [-width / 2, yy, z - 0.03],
      [width / 2, yy + 0.1, z + 0.11],
      [0.64, 0.34, 0.23],
    );
}
function wall(out, width, z, slits, side = false) {
  const holes = [];
  for (const y of [5.1, 8.2, 11.35, 14.45])
    for (const x of side ? [-2.0, 1.85] : [-3.0, 0, 3.0])
      holes.push({ x, y, w: 0.12, spring: y + 0.54, rise: 0, top: y + 0.54, depth: 0.26, trim: 0 });
  for (const x of side ? [-2.3, 0, 2.3] : [-3.3, -1.1, 1.1, 3.3])
    holes.push({
      x,
      y: 17.65,
      w: 0.43,
      spring: 18.32,
      rise: 0.17,
      top: 18.5,
      depth: 0.36,
      trim: 0,
    });
  holes.push(...slits);
  facade(out, 'brick', width, 0, 19, z, holes, brick);
  // Both faces of the parapet are visible above the sloping shed roof.
  // The dark aperture backing belongs inside a masonry thickness, not in air.
  facade(
    transform(out, Math.PI),
    'brick',
    width,
    0,
    19,
    -z + 0.42,
    holes.map((w) => ({ ...w, x: -w.x, back: false, depth: 0.08 })),
    [0.53, 0.3, 0.21],
  );
  box(out, 'brick', [-width / 2, 18.93, z - 0.42], [width / 2, 19, z], brick);
  for (const w of holes) {
    // Each narrow slit has an actual dark reveal; upper apertures retain their arch.
    if (w.w < 0.2)
      box(
        out,
        'brick',
        [w.x - w.w / 2 - 0.035, w.y - 0.04, z - 0.01],
        [w.x + w.w / 2 + 0.035, w.y, z + 0.035],
        [0.42, 0.23, 0.17],
      );
  }
  for (const y of [9.1, 12.35]) paintedBand(out, width, y, z + 0.015);
  box(out, 'plaster', [-width / 2, 6.45, z], [width / 2, 6.7, z + 0.055], [0.77, 0.76, 0.66]);
  reliefBand(out, width - 0.35, 16.72, z + 0.045);
  box(
    out,
    'metal',
    [-width / 2 - 0.06, 18.96, z - 0.16],
    [width / 2 + 0.06, 19.015, z + 0.055],
    iron,
  );
  // Broad restoration patches and occasional dark fired-brick headers are
  // encoded in vertex tints; metric masonry remains supplied by the shared graph.
  for (let row = 0; row < 53; row++)
    for (let col = 0; col < Math.floor(width / 0.58); col++) {
      if ((row * 17 + col * 31) % 17 > 3) continue;
      const x = -width / 2 + 0.23 + col * 0.58 + (row % 2) * 0.14,
        y = 0.2 + row * 0.35;
      if (
        y > 16.5 ||
        holes.some((w) => Math.abs(x - w.x) < w.w / 2 + 0.22 && y > w.y - 0.2 && y < w.top + 0.2) ||
        [6.5, 9.2, 12.5].some((a) => Math.abs(y - a) < 0.4)
      )
        continue;
      face(
        out,
        'brick',
        [
          [x - 0.13, y, z + 0.002],
          [x + 0.13, y, z + 0.002],
          [x + 0.13, y + 0.105, z + 0.002],
          [x - 0.13, y + 0.105, z + 0.002],
        ],
        [0.43, 0.27, 0.215],
      );
    }
}
function glazed(out, x, y, w, h, z) {
  box(out, 'glass', [x - w / 2, y, z - 0.075], [x + w / 2, y + h, z - 0.048], [0.19, 0.28, 0.29]);
  frame(out, 'wood', x, y, w, h, z, 0.08, wood);
  for (const u of [x - w / 6, x + w / 6])
    box(out, 'wood', [u - 0.015, y, z], [u + 0.015, y + h, z + 0.035], wood);
  for (const v of [y + h / 3, y + (2 * h) / 3])
    box(out, 'wood', [x - w / 2, v - 0.017, z], [x + w / 2, v + 0.017, z + 0.035], wood);
}
function timberNorth(out) {
  const f = transform(out, Math.PI),
    width = 7.1;
  // This basement is below the raised northern street in situ. Retain its
  // closure when inspected in isolation or against low-resolution terrain.
  box(f, 'brick', [-5, 0, 3.7], [5, 4, 4.08], brick);
  for (const [y0, y1, z, upper] of [
    [4, 9.58, 4.08, false],
    [9.58, 12.69, 4.33, true],
    [12.69, 15.62, 4.56, true],
  ]) {
    box(f, 'plaster', [-width / 2, y0, -0.1 + z], [width / 2, y1, z], white);
    const posts = upper
      ? [-3.5, -2.5, -1.45, 0, 1.45, 2.5, 3.5]
      : [-3.5, -2.35, -1.18, 0, 1.18, 2.35, 3.5];
    for (const x of posts) box(f, 'wood', [x - 0.105, y0, z], [x + 0.105, y1, z + 0.15], wood);
    for (const y of upper ? [y0 + 0.13, y0 + 0.86, y1 - 0.76, y1 - 0.1] : [4.1, 6.55, 7.13, 9.47])
      box(f, 'wood', [-width / 2, y - 0.095, z], [width / 2, y + 0.095, z + 0.15], wood);
    box(
      f,
      'wood',
      [-width / 2 - 0.12, y0 - 0.1, z - 0.06],
      [width / 2 + 0.12, y0 + 0.11, z + 0.4],
      wood,
    );
    for (let x = -3.2; x < 3.3; x += 0.64)
      box(f, 'wood', [x - 0.11, y0 - 0.25, z - 0.05], [x + 0.11, y0 - 0.1, z + 0.45], wood);
    if (upper) {
      for (const x of [-1.55, 1.55]) glazed(f, x, y0 + 0.94, 0.86, 1.12, z + 0.17);
    } else {
      for (const x of [-2.93, -1.77, -0.59, 0.59, 1.77, 2.93])
        glazed(f, x, 7.18, 0.64, 1.36, z + 0.17);
      // Double timber entry and the lower flanking windows visible from the street.
      box(f, 'wood', [-1.08, 4, z + 0.16], [1.08, 6.45, z + 0.24], [0.23, 0.15, 0.095]);
      for (const x of [-0.72, -0.25, 0.25, 0.72]) {
        box(f, 'wood', [x - 0.17, 4.3, z + 0.24], [x + 0.17, 5.2, z + 0.275], [0.29, 0.2, 0.13]);
        box(f, 'wood', [x - 0.17, 5.48, z + 0.24], [x + 0.17, 6.16, z + 0.275], [0.29, 0.2, 0.13]);
      }
      for (const x of [-2.83, 2.83]) glazed(f, x, 5.13, 0.53, 0.97, z + 0.17);
      box(f, 'metal', [-0.028, 4.3, z + 0.28], [0.028, 6.4, z + 0.31], iron);
    }
  }
  // Narrow brick returns close the side walls around the open-backed historic tower.
  for (const x of [-4.05, 4.05])
    box(f, 'brick', [x - 0.78, 4, 3.93], [x + 0.78, 15.78, 4.1], brick);
  box(f, 'metal', [-3.83, 15.6, 4.3], [3.83, 15.77, 4.94], iron);
  beam(f, 'metal', [3.78, 15.62, 4.85], [3.78, 15.05, 4.84], 0.105, 0.105, iron);
  beam(f, 'metal', [3.78, 15.05, 4.84], [3.9, 14.8, 4.7], 0.105, 0.105, iron);
  beam(f, 'metal', [3.9, 14.8, 4.7], [3.9, 4.1, 4.7], 0.105, 0.105, iron);
}
function buildTorun(out) {
  const t = deform(out, point);
  wall(t, 10, 4.09, []);
  wall(
    transform(t, Math.PI / 2),
    8.18,
    5,
    [{ x: 2.45, y: 6.8, w: 0.87, spring: 8.75, rise: 0.2, top: 8.95, depth: 0.4, trim: 0.055 }],
    true,
  );
  wall(
    transform(t, -Math.PI / 2),
    8.18,
    5,
    [{ x: -2.6, y: 6.8, w: 0.8, spring: 8.58, rise: 0.2, top: 8.78, depth: 0.4, trim: 0.045 }],
    true,
  );
  timberNorth(t);
  // Lead/zinc shed roof drains toward the timber north facade, behind three parapets.
  const roofY = (z) => 15.72 + ((z + 4.3) / 8.12) * 2.95;
  face(
    t,
    'metal',
    [
      [-4.8, roofY(-4.3), -4.3],
      [-4.8, roofY(3.82), 3.82],
      [4.8, roofY(3.82), 3.82],
      [4.8, roofY(-4.3), -4.3],
    ],
    [0.56, 0.6, 0.59],
  );
  for (let x = -4.67; x < 4.8; x += 0.58)
    beam(
      t,
      'metal',
      [x, roofY(-4.3) + 0.024, -4.3],
      [x, roofY(3.82) + 0.024, 3.82],
      0.023,
      0.03,
      [0.39, 0.43, 0.42],
    );
  box(t, 'brick', [-4.7, 18.25, 2.9], [-3.95, 19.55, 3.6], brick);
  box(t, 'metal', [-4.76, 19.53, 2.84], [-3.89, 19.6, 3.66], iron);
  // Two deep masonry buttresses support the south face at the slope.
  for (const x of [-3.62, 3.62])
    loft(
      t,
      'brick',
      [
        ring(x - 0.72, x + 0.72, 4.02, 6.94, 0),
        ring(x - 0.61, x + 0.61, 4.03, 6.55, 1.0),
        ring(x - 0.46, x + 0.46, 4.04, 4.3, 5.35),
      ],
      brick,
    );
  // West quarter-round garderobe, documented in the heritage register and photos.
  const latrine = transform(t, -Math.PI / 2, [-5, 0, -1.9]);
  const lr = [];
  for (let i = 0; i <= 24; i++) {
    const a = ((i / 24) * Math.PI) / 2;
    lr.push([Math.sin(a) * 1.22, 6.3, Math.cos(a) * 1.22]);
  }
  lr.push([0, 6.3, 0]);
  if (
    lr.reduce(
      (s, p, i) => s + p[0] * lr[(i + 1) % lr.length][2] - lr[(i + 1) % lr.length][0] * p[2],
      0,
    ) > 0
  )
    lr.reverse();
  loft(latrine, 'brick', [lr, lr.map(([x, _y, z]) => [x, 8.73, z])], brick);
  for (let i = 0; i < 24; i++) {
    const a = ((i / 24) * Math.PI) / 2,
      b = (((i + 1) / 24) * Math.PI) / 2;
    face(
      latrine,
      'brick',
      [
        [Math.sin(a) * 1.26, 8.74, Math.cos(a) * 1.26],
        [Math.sin(b) * 1.26, 8.74, Math.cos(b) * 1.26],
        [Math.sin(b) * 0.25, 9.45, Math.cos(b) * 0.25],
        [Math.sin(a) * 0.25, 9.45, Math.cos(a) * 0.25],
      ],
      [0.6, 0.32, 0.22],
    );
  }
  // East access: 83 cm wide wooden treads and a tile-roofed first-floor landing.
  const landing = [5.78, 6.8, -2.6],
    lx = point(landing)[0],
    lz = point(landing)[2];
  box(out, 'wood', [lx - 0.63, 6.67, lz - 0.73], [lx + 0.63, 6.8, lz + 0.73], wood);
  const stairStart = [lx + 4.03, 4.05, lz],
    stairEnd = [lx + 0.48, 6.8, lz];
  for (const z of [lz - 0.52, lz + 0.52]) {
    beam(out, 'wood', [stairStart[0], 4.02, z], [stairEnd[0], 6.73, z], 0.13, 0.24, wood);
    beam(out, 'wood', [stairStart[0], 5.02, z], [stairEnd[0], 7.82, z], 0.11, 0.11, wood);
    for (let i = 0; i <= 4; i++) {
      const f = i / 4,
        x = stairStart[0] + (stairEnd[0] - stairStart[0]) * f,
        y = 4.05 + 2.75 * f;
      beam(out, 'wood', [x, y, z], [x, y + 1.02, z], 0.09, 0.09, wood);
    }
  }
  for (let i = 0; i < 16; i++) {
    const f = i / 16,
      x = stairStart[0] + (stairEnd[0] - stairStart[0]) * f,
      y = 4.05 + 2.75 * f;
    box(
      out,
      'wood',
      [x - 0.2, y - 0.045, lz - 0.415],
      [x + 0.035, y, lz + 0.415],
      [0.28, 0.235, 0.175],
    );
  }
  for (const z of [lz - 0.6, lz + 0.6]) {
    beam(out, 'wood', [lx + 0.58, 6.8, z], [lx + 0.58, 8.95, z], 0.14, 0.14, wood);
    beam(out, 'wood', [lx - 0.6, 6.8, z], [lx - 0.6, 8.95, z], 0.14, 0.14, wood);
    beam(out, 'wood', [lx - 0.58, 7.85, z], [lx + 0.56, 7.85, z], 0.11, 0.11, wood);
  }
  for (const s of [-1, 1]) {
    const panel = [
      [lx - 0.88, 9.39, lz],
      [lx + 0.86, 9.39, lz],
      [lx + 0.86, 8.9, lz + s * 0.99],
      [lx - 0.88, 8.9, lz + s * 0.99],
    ];
    face(out, 'brickroof', s > 0 ? panel.reverse() : panel, [0.39, 0.28, 0.2]);
    for (let i = 0; i < 8; i++) {
      const x = lx - 0.83 + i * 0.23;
      beam(
        out,
        'brickroof',
        [x, 9.415, lz],
        [x, 8.925, lz + s * 0.99],
        0.025,
        0.025,
        [0.48, 0.32, 0.22],
      );
    }
  }
  for (const [i, x] of [lx - 0.86, lx + 0.84].entries()) {
    const p = [
      [x, 8.9, lz - 0.95],
      [x, 9.39, lz],
      [x, 8.9, lz + 0.95],
    ];
    triangle(out, 'wood', i === 0 ? p.reverse() : p, wood);
  }
  // Short attached gallery includes its measured bend. The extended city wall
  // remains a separate mapped feature beyond the terminal return.
  const path = [
    [-5.3, 6.8, -2.95],
    [-9.4, 6.8, -3.02],
    [-15.1, 6.8, -10.65],
  ];
  for (let j = 1; j < path.length; j++) {
    const a = path[j - 1],
      b = path[j],
      dx = b[0] - a[0],
      dz = b[2] - a[2],
      length = Math.hypot(dx, dz),
      nx = -dz / length,
      nz = dx / length;
    const edges = (p, s, y) => [p[0] + s * nx, y, p[2] + s * nz];
    // Timber walkway has independent floor boards, supports, two rail courses.
    const count = Math.ceil(length / 0.18);
    for (let i = 0; i < count; i++) {
      const f = (i + 0.5) / count,
        p = [a[0] + dx * f, 6.8, a[2] + dz * f];
      beam(
        out,
        'wood',
        edges(p, -0.9, 6.75),
        edges(p, 0.9, 6.75),
        (length / count) * 0.96,
        0.1,
        [0.29, 0.2, 0.13],
      );
    }
    for (const side of [-0.89, 0.89])
      for (const y of [7.3, 7.83])
        beam(out, 'wood', edges(a, side, y), edges(b, side, y), 0.13, 0.15, wood);
    const supports = Math.ceil(length / 1.3);
    for (let i = 0; i <= supports; i++) {
      const f = i / supports,
        p = [a[0] + dx * f, 0, a[2] + dz * f];
      for (const s of [-0.89, 0.89])
        beam(out, 'wood', edges(p, s, 6.55), edges(p, s, 7.95), 0.14, 0.16, wood);
      beam(out, 'wood', edges(p, -1.02, 6.6), edges(p, 1.02, 6.6), 0.18, 0.18, wood);
      beam(out, 'wood', edges(p, 0.95, 6.55), edges(p, -0.93, 5.0), 0.16, 0.16, wood);
    }
    // Masonry bearing wall lies behind the gallery, with a flat coping.
    const f = transform(out, Math.atan2(dx, dz), [(a[0] + b[0]) / 2, 0, (a[2] + b[2]) / 2]);
    box(f, 'brick', [0.98, 0, -length / 2], [1.35, 7.55, length / 2], brick);
    box(f, 'brick', [0.94, 7.55, -length / 2], [1.39, 7.68, length / 2], [0.48, 0.27, 0.2]);
  }
}

export const torunLeaningTower = {
  id: 'n0595_leaning_tower_of_torun',
  planId: 'N0595',
  title: 'Leaning Tower of Toruń',
  wikidata: 'Q2234463',
  authoringFile: 'torun-leaning-tower-model.mjs',
  build: buildTorun,
  brief:
    'Leaning medieval brick tower with the asymmetric jettied timber north wall, measured floor tiers, slit windows and Gothic friezes, zinc shed roof, south buttresses, west garderobe and gallery, and the roofed east timber stair.',
  size: [29, 19.6, 19],
  front:
    '+Z faces the Vistula-side south brick elevation; the half-timbered entrance is on -Z toward the town',
  origin:
    'Mapped tower footprint center at north street level in plan; Y=0 is the exposed south-slope foundation, with north street at Y=4 m',
  refs: [
    'https://bip.tak.torun.pl/bip_att.php?id=749',
    'https://zabytek.pl/pl/obiekty/torun-baszta-miejska-tzw-krzywa-wieza',
    'https://visittorun.com/en/node/53',
    'https://www.openstreetmap.org/way/81882855',
  ],
  facts: {
    mappedShaftEnvelopeMeters: [10.382, 8.181],
    reportedNorthwardLeanMeters: 1.46,
    northStreetDatumMeters: 4,
    measuredFloorLevelsAboveStreetMeters: [0, 2.8, 5.58, 8.69, 11.62],
    southSlopeEnvelopeMeters: 19,
    upperParapetAboveStreetMeters: 15,
    eastStairClearWidthMeters: 0.83,
    standingSeamPitchMeters: 0.58,
  },
  scaleBasis:
    'The municipal 2019 restoration record supplies plans, section, north elevation and photographs of every exterior. The exact-identity OSM outline establishes its horizontal frame; the section supplies the floor levels and roof slope. Published street/slope height descriptions refer to different ground levels: the visible southern base is preserved below the north street. The 1.46 m northward lean is applied above that street reference, with continuation through the exposed basement.',
  geographicProposal: {
    anchor: [18.6020742, 53.0083824],
    heading,
    source: 'https://www.openstreetmap.org/way/81882855',
    evidence:
      'Exact-QID footprint axis is signed using the measured plan compass and National Heritage Institute identification of the half-timbered north face, east stairs and western gallery. Native +Z points south-southeast, +X east-southeast; the 1.46 m lean is applied toward geographic north.',
    orientationConfidence: 'published-cardinal-facades-and-exact-map-outline',
    limitations:
      'Y=0 uses the lower exposed southern base, while the northern entry is 4 m higher. Terrain must preserve this slope rather than flatten the whole footprint. The gallery extends beyond the shaft map outline; do not scale the full ensemble to that outline.',
  },
  limits: [
    'Facade massing, visible exterior openings, floor tiers, lean direction and attached timber circulation are reconstructed from the municipal measured record. Fine brick weathering, hand-painted frieze strokes and individual timber repairs use original polygonal and shared-material approximations.',
    'The north-street versus south-slope datum is explicit. Terrain contact must retain the raised northern street; the source does not contain a fake flat ground platform. The broader city-wall network and neighboring buildings remain separate features.',
    'No visitor interior or surrounding vegetation is included. The documented restored zinc roof is represented rather than copying corrosion from the pre-restoration photographs.',
  ],
  cameras: [
    { name: 'timber-north-and-gallery', position: [-22, 14, -32], lookAt: [-3, 11, -3] },
    { name: 'southern-friezes-and-lean', position: [19, 12, 31], lookAt: [0, 11, 2] },
    { name: 'east-covered-stair', position: [22, 11, -17], lookAt: [5, 8, -2] },
    { name: 'roof-and-latrine', position: [-22, 29, 15], lookAt: [-2, 13, 0] },
    { name: 'far-silhouette', position: [44, 29, 53], lookAt: [-3, 9, -2] },
  ],
};
