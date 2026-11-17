/** Tara Masjid after its northward five-dome expansion. */
import fs from 'node:fs';
import {
  beamPath,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import {
  profile,
  quad,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const { outline, fountainOutline } = read('map-frame').geometry;
const d = plan.dimensions;
const tau = Math.PI * 2;
const c = Object.fromEntries(
  Object.entries({
    ivory: 'e0ded3',
    pale: 'f0ebe0',
    trim: 'cac6b7',
    darkGreen: '4b8172',
    jade: '96b2a3',
    indigo: '3b5783',
    blue: '527fa6',
    bronze: '89775a',
    dark: '4a4e49',
    ground: 'b2ab9e',
    water: '658b8b',
    yellow: 'bb9851',
  }).map(([key, hex]) => [key, rgb(hex)]),
);
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  tiles: { slot: 'trim', graph: 'tile_glazed', roughness: 0.79 },
  stone: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.96 },
  details: { slot: 'trim', localRef: 'palette:#fffffe', roughness: 0.84 },
  openings: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.9 },
  water: { slot: 'trim', localRef: 'palette:#fffffd', roughness: 0.37 },
};
const x0 = Math.min(...outline.map(([x]) => x));
const x1 = Math.max(...outline.map(([x]) => x));
const z0 = Math.min(...outline.map(([, z]) => z));
const z1 = Math.max(...outline.map(([, z]) => z));
const floor = d.floorY;

function face(out, slot, points, direction, tint) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, n, i) => sum + n * direction[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, tint);
  else
    out.addTriangle(
      slot,
      'palette:#ffffff',
      points,
      normal,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      tint,
    );
}

function star(out, center, across, up, radius, points, normal, tint, innerRadius = 0.42) {
  const tip = (i) => {
    const angle = (tau * i) / (points * 2) + Math.PI * 0.5;
    const length = radius * (i % 2 ? innerRadius : 1);
    return center.map(
      (p, axis) =>
        p + across[axis] * Math.cos(angle) * length + up[axis] * Math.sin(angle) * length,
    );
  };
  for (let i = 0; i < points * 2; i++)
    face(out, 'details', [center, tip(i), tip(i + 1)], normal, tint);
}

function dome(out, x, z, base, radius, detail, decorated = true) {
  if (!decorated && detail === 0) {
    profile(
      out,
      [
        [base, radius * 0.76, radius * 0.76],
        [base + radius * 0.48, radius, radius, 'wall', c.pale],
        [base + radius * 1.8, 0.025, 0.025, 'wall', c.pale],
      ],
      4,
      [x, z],
    );
    return;
  }
  const sides = [6, 12, 24, 32][detail];
  const height = radius * 1.23;
  const offsets = [
    [0, 0.76],
    [0.11, 0.89],
    [0.27, 0.99],
    [0.46, 1],
    [0.65, 0.89],
    [0.83, 0.65],
    [0.95, 0.34],
    [1, 0.13],
  ];
  const layers = offsets.map(([t, r], i) => [
    base + t * height,
    r * radius,
    r * radius,
    i === 1 ? 'tiles' : 'wall',
    i === 1 ? c.trim : c.pale,
  ]);
  if (detail === 0) {
    profile(
      out,
      layers.filter((_, i) => [0, 3, 5, 7].includes(i)),
      sides,
      [x, z],
    );
  } else profile(out, layers, sides, [x, z]);
  const peak = base + height;
  profile(
    out,
    [
      [peak - 0.06, radius * 0.17, radius * 0.17],
      [peak + radius * 0.12, radius * 0.14, radius * 0.14, 'details', c.bronze],
      [peak + radius * 0.28, radius * 0.08, radius * 0.08, 'details', c.bronze],
      [peak + radius * 0.33, radius * 0.12, radius * 0.12, 'details', c.bronze],
      [peak + radius * 0.45, radius * 0.055, radius * 0.055, 'details', c.bronze],
      [peak + radius * 0.61, 0.016, 0.016, 'details', c.bronze],
    ].filter((_, i) => detail > 0 || [0, 2, 5].includes(i)),
    detail > 1 ? 8 : 4,
    [x, z],
  );
  if (!decorated || detail === 0) return;
  const bands = detail === 1 ? [3] : [2, 3, 4, 5];
  const start = Math.PI * 0.07;
  for (const band of bands) {
    const [h, r] = offsets[band];
    const count = detail === 3 ? 16 : detail === 2 ? 12 : 7;
    const angleOffset = start + (band % 2 ? tau / (count * 2) : 0);
    for (let i = 0; i < count; i++) {
      const a = angleOffset + (i * tau) / count;
      const normal = [Math.cos(a), 0, Math.sin(a)];
      const across = [-normal[2], 0, normal[0]];
      const center = [
        x + normal[0] * (r * radius + 0.055),
        base + height * h,
        z + normal[2] * (r * radius + 0.055),
      ];
      star(
        out,
        center,
        across,
        [0, 1, 0],
        radius * 0.102,
        5,
        normal,
        i % 3 === 0 ? c.blue : c.indigo,
      );
    }
  }
}

function eastPanel(out, slot, zLeft, zRight, bottom, top, x, tint) {
  face(
    out,
    slot,
    [
      [x, bottom, zLeft],
      [x, top, zLeft],
      [x, top, zRight],
      [x, bottom, zRight],
    ],
    [-1, 0, 0],
    tint,
  );
}

function verandah(out, detail) {
  const front = x0 - 0.035;
  const pierPositions = [-9.73, -5.86, -1.95, 1.95, 5.86, 9.73];
  const impost = 2.88;
  const roof = d.mainEaveY;
  const halfOpening = 1.62;
  const archRise = 1.54;
  for (const z of pierPositions) {
    box(out, 'wall', front + 0.29, floor, z, 0.58, roof - floor, 0.58, c.ivory);
    if (detail > 0) {
      box(out, 'tiles', front + 0.29, floor, z, 0.69, 0.21, 0.71, c.jade);
      box(out, 'tiles', front + 0.26, impost - 0.22, z, 0.71, 0.23, 0.77, c.ivory);
      box(out, 'details', front + 0.24, impost - 0.3, z, 0.67, 0.07, 0.76, c.indigo);
      if (detail >= 2) {
        for (const y of [0.83, 1.2, 1.57, 1.94, 2.31])
          star(out, [front - 0.005, y, z], [0, 0, 1], [0, 1, 0], 0.068, 8, [-1, 0, 0], c.indigo);
      }
    }
  }
  for (let bay = 0; bay < pierPositions.length - 1; bay++) {
    const center = (pierPositions[bay] + pierPositions[bay + 1]) / 2;
    const steps = [6, 8, 18, 24][detail];
    const arch = [];
    for (let i = 0; i <= steps; i++) {
      const t = Math.PI * (1 - i / steps);
      const wave = detail > 1 ? 1 + 0.065 * Math.cos(t * 12) : 1;
      arch.push([
        front,
        impost + archRise * Math.sin(t) * wave,
        center + halfOpening * Math.cos(t) * wave,
      ]);
    }
    for (let i = 1; i < arch.length; i++) {
      const a = arch[i - 1];
      const b = arch[i];
      face(out, 'tiles', [a, [front, roof, a[2]], [front, roof, b[2]], b], [-1, 0, 0], c.pale);
      face(
        out,
        'tiles',
        [a, b, [front + 0.4, b[1], b[2]], [front + 0.4, a[1], a[2]]],
        [0, -1, 0],
        c.trim,
      );
    }
    if (detail > 0)
      beamPath(
        out,
        'details',
        arch.map(([, y, z]) => [front - 0.045, y, z]),
        0.095,
        0.1,
        c.indigo,
      );
    if (detail >= 2) {
      const step = detail === 2 ? 0.37 : 0.23;
      for (let u = -1.29; u <= 1.3; u += step) {
        const top = impost + archRise * Math.sqrt(1 - (u / halfOpening) * (u / halfOpening)) - 0.1;
        box(out, 'details', front + 0.15, impost, center + u, 0.08, top - impost, 0.047, c.trim);
      }
      for (const y of [impost, 3.31, 3.7, 4.04]) {
        const span = 2 * halfOpening * Math.sqrt(1 - Math.pow((y - impost) / archRise, 2)) - 0.08;
        box(out, 'details', front + 0.13, y, center, 0.08, 0.04, span, c.trim);
      }
      for (const y of [4.66, 5.06]) {
        for (const u of [-1.29, -0.85, -0.42, 0, 0.42, 0.85, 1.29]) {
          star(
            out,
            [front - 0.017, y, center + u],
            [0, 0, 1],
            [0, 1, 0],
            0.07,
            8,
            [-1, 0, 0],
            u === 0 ? c.yellow : c.indigo,
          );
        }
      }
    }
    eastPanel(
      out,
      'openings',
      center - 1.03,
      center + 1.03,
      floor + 0.19,
      3.12,
      d.enclosureX - 0.018,
      c.dark,
    );
    if (detail >= 2) {
      box(out, 'tiles', d.enclosureX - 0.16, floor + 0.05, center, 0.25, 0.23, 2.18, c.jade);
    }
  }
  box(
    out,
    'wall',
    (x0 + d.enclosureX) / 2,
    roof - 0.21,
    0,
    d.enclosureX - x0,
    0.22,
    z1 - z0,
    c.ivory,
  );
  for (const [dy, tint, width] of [
    [0, c.pale, 0.35],
    [0.19, c.darkGreen, 0.08],
    [0.28, c.trim, 0.22],
  ]) {
    box(out, 'tiles', front + 0.17, roof + dy, 0, 0.57, width, z1 - z0 + 0.22, tint);
  }
  const merlons = [0, 26, 36, 43][detail];
  for (let i = 0; i < merlons; i++) {
    const z = (z1 - z0 - 1.16) * ((i + 0.5) / merlons - 0.5);
    const w = 0.25;
    const y = roof + 0.5;
    const x = front + 0.09;
    face(
      out,
      'tiles',
      [
        [x, y, z - w / 2],
        [x, y + 0.16, z - w / 2],
        [x, y + 0.39, z],
        [x, y + 0.16, z + w / 2],
      ],
      [-1, 0, 0],
      c.pale,
    );
    face(
      out,
      'tiles',
      [
        [x, y, z - w / 2],
        [x, y + 0.16, z + w / 2],
        [x, y, z + w / 2],
      ],
      [-1, 0, 0],
      c.pale,
    );
  }
}

function mainHall(out, detail) {
  const roof = d.mainEaveY;
  box(out, 'stone', 0, -1.48, 0, x1 - x0, floor + 1.48, z1 - z0, c.ground);
  box(
    out,
    'wall',
    (x1 + d.enclosureX) / 2,
    floor,
    0,
    x1 - d.enclosureX,
    roof - floor,
    z1 - z0,
    c.ivory,
  );
  box(
    out,
    'tiles',
    (x1 + d.enclosureX) / 2,
    roof - 0.07,
    0,
    x1 - d.enclosureX + 0.34,
    0.25,
    z1 - z0 + 0.31,
    c.pale,
  );
  for (const z of [z0 + 0.07, z1 - 0.07]) {
    box(out, 'tiles', 0.05, roof + 0.13, z, x1 - x0 + 0.13, 0.45, 0.3, c.ivory);
    for (const x of [x0 + 0.38, x1 - 0.43]) {
      box(out, 'wall', x, roof, z + (z < 0 ? 0.34 : -0.34), 0.8, 1.04, 0.8, c.ivory);
      dome(out, x, z + (z < 0 ? 0.34 : -0.34), roof + 1.02, 0.46, detail, false);
    }
  }
  const steps = detail === 0 ? 1 : 3;
  for (let i = 0; i < steps; i++) {
    const run = 1.1 - 0.28 * i;
    const y = floor - 0.12 * (steps - 1 - i);
    box(out, 'stone', x0 - run / 2, y - 0.61, 0, run, 0.61, z1 - z0 - 0.58, c.trim);
  }
  if (detail > 0) {
    for (const x of [-1.75, 0.7, 3.25]) {
      for (const sign of [-1, 1]) {
        const z = sign < 0 ? z0 - 0.055 : z1 + 0.055;
        box(out, 'tiles', x, 1.67, z, 1.1, 2.14, 0.12, c.trim);
        box(out, 'openings', x, 1.81, z + sign * 0.04, 0.83, 1.79, 0.055, c.dark);
        if (detail >= 2) {
          box(out, 'details', x, 2.52, z + sign * 0.083, 0.84, 0.08, 0.055, c.jade);
          box(out, 'details', x, 1.81, z + sign * 0.083, 0.07, 1.79, 0.055, c.jade);
        }
      }
    }
  }
}

function fountain(out, detail) {
  const xs = fountainOutline.map(([x]) => x);
  const zs = fountainOutline.map(([, z]) => z);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const rx = (Math.max(...xs) - Math.min(...xs)) / 2;
  const rz = (Math.max(...zs) - Math.min(...zs)) / 2;
  const dots = (r, y, index) => {
    const angle = (Math.PI * index) / 8;
    const scale = index % 2 ? 0.68 : 1;
    return [cx + Math.cos(angle) * r * scale * rx, y, cz + Math.sin(angle) * r * scale * rz];
  };
  const ground = 0.78;
  const top = ground + d.fountainHeight;
  for (let i = 0; i < 16; i++) {
    const side = ((i + 0.5) * Math.PI) / 8;
    const normal = [Math.cos(side), 0, Math.sin(side)];
    face(
      out,
      'stone',
      [dots(1, 0.52, i), dots(1, 0.52, i + 1), dots(1, top, i + 1), dots(1, top, i)],
      normal,
      c.ground,
    );
    face(
      out,
      'tiles',
      [dots(1, top, i), dots(1, top, i + 1), dots(0.88, top, i + 1), dots(0.88, top, i)],
      [0, 1, 0],
      c.ivory,
    );
    face(
      out,
      'tiles',
      [
        dots(0.88, top, i),
        dots(0.88, top, i + 1),
        dots(0.88, top - 0.28, i + 1),
        dots(0.88, top - 0.28, i),
      ],
      normal.map((n) => -n),
      c.jade,
    );
    face(
      out,
      'water',
      [[cx, top - 0.23, cz], dots(0.88, top - 0.23, i), dots(0.88, top - 0.23, i + 1)],
      [0, 1, 0],
      c.water,
    );
  }
  if (detail > 0) {
    profile(
      out,
      [
        [top - 0.29, 0.52, 0.52],
        [top + 0.38, 0.49, 0.49, 'stone', c.pale],
        [top + 0.51, 0.58, 0.58, 'tiles', c.jade],
      ],
      detail === 1 ? 6 : 8,
      [cx, cz],
    );
  }
}

function draw(out, detail) {
  mainHall(out, detail);
  verandah(out, detail);
  for (const [i, z] of d.domeCentersZ.entries())
    dome(out, d.domeCenterX, z, d.mainEaveY + 0.18, d.domeRadii[i], detail);
  fountain(out, detail);
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [-37, 14, -28];
const lookAt = [-7, 4.4, 0];
const module =
  'content/worldgen/source/places/' + plan.cell + '/' + id + '/models/' + slug + '-model.mjs';

export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe: slug + '-model.mjs',
  surfaces,
  build: closeup,
  wikidataId: 'Q2993411',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Star Mosque in old Dhaka has a tiled five-bay verandah, five white domes with blue stars and a fountain in its east forecourt.',
  camera,
  lookAt,
  sunDirection: [-61, 100, -41],
  recipeDependencies: ['generate-motat-building.mjs'],
  embeddedCanonicalGraphs: ['plaster_lime', 'tile_glazed', 'stone_limestone'],
  mediumFiContext: {
    scale: 1,
    cameraYaw: -2.1,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'east-verandah-and-tile-ornament', position: [-23, 6.5, -13], lookAt: [-3.1, 4.8, 0] },
    { name: 'five-star-domes-and-finials', position: [-17, 16.4, 16], lookAt: [0.5, 7, 0] },
    { name: 'forecourt-fountain-and-site', position: [-49, 17, 14], lookAt: [-13, 4, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: slug + '-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.44,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.16, surfaces },
      street: { export: 'street', errorMeters: 0.064, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.022, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original architectural geometry based on the official public-domain photograph, conservation project account, Open Cities Dhaka footprint survey and original terrain.',
};
