/** The Shilin main house with the green, open-column entrance on its mapped driveway. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const grid = read('terrain-grid.json');
const {
  across: [ux, uz],
  planSections,
  canopy,
  driveWidth,
} = plan.dimensions;
const geo = ([u, y, v]) => [ux * u - uz * v, y, uz * u + ux * v];
const local = ([x, z]) => [ux * x + uz * z, -uz * x + ux * z];
const palette = 'palette:#ffffff';
const up = [0, 1, 0];
const c = Object.fromEntries(
  Object.entries({
    main: '627c71',
    wing: '718278',
    trim: '4c635e',
    green: '55746c',
    frame: '7d9690',
    slate: '747776',
    darkSlate: '626866',
    coping: 'b0ada0',
    plinth: '777a70',
    glass: '687b78',
    doorway: '52645c',
    paving: '97988c',
  }).map(([key, value]) => [key, rgb(value)]),
);
const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.9, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_flat', roughness: 0.92, metallic: 0 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.84, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.93, metallic: 0 },
  pavement: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  glaze: { slot: 'window', graph: 'window_sliding', roughness: 0.55, metallic: 0.025 },
  door: { slot: 'door', graph: 'wood_painted_lap', roughness: 0.82, metallic: 0 },
};

function grade(u, v) {
  const [x, , z] = geo([u, 0, v]);
  const tx = (x - grid.origin[0]) / grid.stepMeters,
    tz = (z - grid.origin[1]) / grid.stepMeters;
  const i = Math.floor(tx),
    j = Math.floor(tz),
    xPart = tx - i,
    zPart = tz - j;
  const a = grid.heightsMeters[j],
    b = grid.heightsMeters[j + 1];
  return (
    (a[i] * (1 - xPart) + a[i + 1] * xPart) * (1 - zPart) +
    (b[i] * (1 - xPart) + b[i + 1] * xPart) * zPart -
    grid.modelDatumElevationMeters
  );
}

function face(out, slot, pos, toward, color) {
  const basis = normalFor(...pos);
  const sign = basis.reduce((total, value, i) => total + value * toward[i], 0) < 0 ? -1 : 1;
  const normal = geo(basis.map((a) => a * sign));
  out.addConvexPolygon(
    slot,
    palette,
    pos.map(geo),
    normal,
    ([x, y, z]) => {
      const [u, v] = local([x, z]);
      return Math.abs(basis[1]) > 0.55 ? [u, v] : [u - 0.34 * v, y];
    },
    color,
  );
}

function trimBeam(out, a, b, width, depth, color, slot = 'trim') {
  beam(out, slot, geo(a), geo(b), width, depth, color);
}

function signedArea(ring) {
  return ring.reduce((n, [u, v], i) => {
    const [x, z] = ring[(i + 1) % ring.length];
    return n + u * z - x * v;
  }, 0);
}

function edge([x, z], [u, v], winding) {
  const length = Math.hypot(u - x, v - z);
  const tx = (u - x) / length,
    tz = (v - z) / length;
  const normal = [tz * winding, 0, -tx * winding];
  return {
    length,
    normal,
    p: (t, y, d = 0) => [x + tx * t + normal[0] * d, y, z + tz * t + normal[2] * d],
  };
}

function panel(out, slot, { p, normal }, a, b, lo, hi, depth, color) {
  if (hi - lo < 0.025) return;
  face(
    out,
    slot,
    [p(a, lo, depth), p(b, lo, depth), p(b, hi, depth), p(a, hi, depth)],
    normal,
    color,
  );
}

function clip(ring, distance) {
  const result = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      da = distance(a),
      db = distance(b);
    if (da >= 0) result.push(a);
    if (da * db < 0) {
      const t = da / (da - db);
      result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return result;
}

function roofControl({ outline, eave, ridge, ridgeV, halfDepth, hipIn }) {
  const minU = Math.min(...outline.map(([u]) => u)),
    maxU = Math.max(...outline.map(([u]) => u));
  const rise = ridge - eave;
  const slopes = [
    ([, v]) => ridge + (rise * (v - ridgeV)) / halfDepth,
    ([, v]) => ridge - (rise * (v - ridgeV)) / halfDepth,
    ([u]) => eave + (rise * (u - minU)) / hipIn,
    ([u]) => eave + (rise * (maxU - u)) / hipIn,
  ];
  const height = (p) => Math.max(eave - 0.06, Math.min(...slopes.map((s) => s(p))));
  return { height, slopes };
}

function tiling(out, outline, control, color) {
  const all = earcut(outline.flat());
  for (let i = 0; i < all.length; i += 3) {
    const source = all.slice(i, i + 3).map((index) => outline[index]);
    for (const slope of control.slopes) {
      let clipped = source;
      for (const other of control.slopes) {
        if (other !== slope && clipped.length)
          clipped = clip(clipped, (point) => other(point) - slope(point));
      }
      if (clipped.length < 3 || Math.abs(signedArea(clipped)) < 1e-5) continue;
      const [first, ...points] = clipped;
      for (let j = 1; j < points.length; j++) {
        const piece = [first, points[j - 1], points[j]];
        if (Math.abs(signedArea(piece)) < 1e-5) continue;
        face(
          out,
          'tile',
          piece.map(([u, v]) => [u, control.height([u, v]), v]),
          up,
          color,
        );
      }
    }
  }
}

function window(out, wall, x, y, width, height, level) {
  const a = x - width * 0.5,
    b = x + width * 0.5;
  panel(out, 'trim', wall, a - 0.1, b + 0.1, y - 0.1, y + height + 0.1, 0.032, c.frame);
  panel(out, 'glaze', wall, a, b, y, y + height, 0.046, c.glass);
  if (level > 1) {
    panel(out, 'trim', wall, x - 0.028, x + 0.028, y, y + height, 0.055, c.frame);
    panel(out, 'trim', wall, a - 0.13, b + 0.13, y - 0.105, y - 0.047, 0.076, c.trim);
    if (level === 3)
      panel(out, 'trim', wall, a, b, y + 0.66 * height, y + 0.66 * height + 0.05, 0.064, c.frame);
  }
}

function wall(out, current, a, b, winding, control, level, finish) {
  const wallFrame = edge(a, b, winding);
  const { floor, eave } = current,
    { length, normal, p } = wallFrame;
  const breaks = [0, 1];
  for (const [i, slope] of control.slopes.entries())
    for (const other of control.slopes.slice(i + 1)) {
      const x = slope(a) - other(a),
        z = slope(b) - other(b);
      if (x * z < 0) breaks.push(x / (x - z));
    }
  breaks.sort((x, z) => x - z);
  const profile = (t) => {
    const [u, , v] = p(t, 0);
    return [u, control.height([u, v]), v];
  };
  for (let i = 1; i < breaks.length; i++) {
    const x = breaks[i - 1] * length,
      z = breaks[i] * length;
    if (z - x < 0.0003) continue;
    const base = (t) => {
      const [u, , v] = p(t, 0);
      return p(t, Math.min(grade(u, v) - 0.3, floor - 0.2));
    };
    face(
      out,
      'stone',
      [base(x), base(z), p(z, floor + 0.08), p(x, floor + 0.08)],
      normal,
      c.plinth,
    );
    face(
      out,
      'wall',
      [p(x, floor + 0.08), p(z, floor + 0.08), profile(z), profile(x)],
      normal,
      finish,
    );
  }
  if (level === 0 || length < 3.25) return;
  const facade = ![-15.42, 14.7].some(
    (v) => Math.abs(a[1] - v) < 0.001 && Math.abs(b[1] - v) < 0.001,
  );
  if (!facade) return;
  trimBeam(out, p(0, eave - 0.15, 0.05), p(length, eave - 0.15, 0.05), 0.12, 0.16, c.trim);
  trimBeam(
    out,
    p(0, floor + 0.14, 0.03),
    p(length, floor + 0.14, 0.03),
    0.05,
    0.11,
    c.plinth,
    'stone',
  );
  const count = Math.max(1, Math.floor((length - 1) / 3.45));
  for (let i = 0; i < count; i++) {
    const x = ((i + 0.5) * length) / count;
    const [u, , v] = p(x, 0);
    if (Math.abs(v - canopy.wall) < 0.1 && x > 0 && u > canopy.from - 0.5 && u < canopy.to + 0.5)
      continue;
    const ground = grade(u, v);
    const y = floor + 0.93;
    if (y > ground + 0.18) window(out, wallFrame, x, y, 1.23, 1.39, level);
    if (eave - floor > 4.8) window(out, wallFrame, x, eave - 1.86, 1.15, 1.22, level);
  }
}

function buildSection(out, section, level, i) {
  const { outline } = section;
  const control = roofControl(section),
    winding = Math.sign(signedArea(outline));
  tiling(out, outline, control, i === 0 ? c.slate : c.darkSlate);
  for (const [j, a] of outline.entries()) {
    const b = outline[(j + 1) % outline.length];
    wall(out, section, a, b, winding, control, level, i === 0 ? c.main : c.wing);
  }
  if (level > 1) {
    const { eave, ridge, ridgeV, hipIn } = section;
    const [min, max] = [Math.min(...outline.map(([u]) => u)), Math.max(...outline.map(([u]) => u))];
    const end = [min + hipIn + 0.2, max - hipIn - 0.2];
    // Exposed ridge cap is only used on the uninterrupted front section.
    if (i === 0)
      trimBeam(
        out,
        [end[0], ridge + 0.042, ridgeV],
        [end[1], ridge + 0.042, ridgeV],
        0.23,
        0.13,
        c.darkSlate,
        'tile',
      );
    if (level === 3 && i === 0)
      for (const x of [-4, 2, 8, 14])
        trimBeam(out, [x, eave - 0.14, -28.54], [x, eave - 0.3, -28.75], 0.105, 0.135, c.trim);
  }
}

function column(out, x, z, y, height, lod) {
  const n = [7, 11, 18, 24][lod];
  const ring = (h, radius) => radialRing(h, radius, radius, n, [x, z]).map(geo);
  loft(out, 'stone', [ring(y - 0.08, 0.31), ring(y + 0.14, 0.31), ring(y + 0.19, 0.257)], c.coping);
  loft(out, 'trim', [ring(y + 0.16, 0.192), ring(height - 0.035, 0.208)], c.green);
}

function coveredEntry(out, level) {
  const { from, to, front, wall, eave, ridge, doorCenter } = canopy;
  const frontOverhang = front - 0.15;
  const wallBack = wall + 0.13;
  const ridgeV = (frontOverhang + wallBack) / 2;
  for (const z of [frontOverhang, wallBack]) {
    face(
      out,
      'tile',
      [
        [from, eave + 0.05, z],
        [to, eave + 0.05, z],
        [to, ridge, ridgeV],
        [from, ridge, ridgeV],
      ],
      up,
      c.slate,
    );
  }
  for (const [x, normal] of [
    [from, [-1, 0, 0]],
    [to, [1, 0, 0]],
  ]) {
    face(
      out,
      'wall',
      [
        [x, eave, frontOverhang],
        [x, eave, wallBack],
        [x, ridge, ridgeV],
      ],
      normal,
      c.main,
    );
    for (const v of [frontOverhang, wallBack])
      trimBeam(out, [x, eave + 0.02, v], [x, ridge - 0.02, ridgeV], 0.15, 0.14, c.trim);
    trimBeam(out, [x, eave - 0.17, wallBack], [x, eave - 0.17, front], 0.26, 0.22, c.green);
  }
  trimBeam(out, [from, eave - 0.18, front], [to, eave - 0.18, front], 0.32, 0.32, c.green);
  for (const x of [from + 0.55, to - 0.55])
    column(out, x, front + 0.13, grade(x, front + 0.13), eave - 0.18, level);
  const mainWall = edge([from, wall - 0.13], [to, wall - 0.13], 1);
  const door = doorCenter - from;
  panel(out, 'trim', mainWall, door - 0.97, door + 0.97, 0.44, 3.1, 0.087, c.trim);
  panel(out, 'door', mainWall, door - 0.82, door + 0.82, 0.5, 2.88, 0.11, c.doorway);
  if (level > 0) {
    for (const x of [door - 0.85, door + 0.85])
      panel(out, 'glaze', mainWall, x - 0.11, x + 0.1, 0.62, 2.78, 0.145, c.glass);
    window(out, mainWall, door + 2.05, 1.26, 1.07, 1.43, level);
    window(out, mainWall, door - 2.42, 1.26, 1.09, 1.43, level);
  }
  const step = (half, y, z) => {
    const a = doorCenter - half,
      b = doorCenter + half,
      back = wall;
    face(
      out,
      'stone',
      [
        [a, y, back],
        [b, y, back],
        [b, y, z],
        [a, y, z],
      ],
      up,
      c.coping,
    );
    face(
      out,
      'stone',
      [
        [a, Math.min(0.17, grade(a, z) - 0.12), z],
        [b, Math.min(0.17, grade(b, z) - 0.12), z],
        [b, y, z],
        [a, y, z],
      ],
      [0, 0, -1],
      c.plinth,
    );
  };
  step(1.18, 0.32, wall - 0.83);
  step(1.03, 0.53, wall - 0.45);
}

const drive = frame.features.find(({ id }) => id === 'osm/way/777894245').points.map(local);
function roadStrip(out, nodes, closed) {
  const half = driveWidth / 2;
  const normal = ([a, b], [c, d]) => {
    const length = Math.hypot(c - a, d - b);
    return [(b - d) / length, (c - a) / length];
  };
  const count = nodes.length;
  const offsets = nodes.map((node, i) => {
    if (!closed && i === 0) return normal(node, nodes[1]).map((n) => n * half);
    if (!closed && i === count - 1) return normal(nodes[i - 1], node).map((n) => n * half);
    const a = normal(nodes[(i + count - 1) % count], node);
    const b = normal(node, nodes[(i + 1) % count]);
    const span = Math.max(0.5, 1 + a[0] * b[0] + a[1] * b[1]);
    return [((a[0] + b[0]) * half) / span, ((a[1] + b[1]) * half) / span];
  });
  for (let i = 0; i < count - (closed ? 0 : 1); i++) {
    const next = (i + 1) % count;
    const [a, b] = nodes[i],
      [c1, d] = nodes[next];
    const [nx, nz] = offsets[i],
      [mx, mz] = offsets[next];
    const segments = Math.ceil(Math.hypot(c1 - a, d - b) / 3.1);
    const point = (t, side) => {
      const x = a + (c1 - a) * t + side * (nx + (mx - nx) * t);
      const z = b + (d - b) * t + side * (nz + (mz - nz) * t);
      return [x, grade(x, z) + 0.065, z];
    };
    for (let j = 0; j < segments; j++) {
      const t = j / segments,
        s = (j + 1) / segments;
      const startLeft = point(t, -1),
        startRight = point(t, 1);
      const endLeft = point(s, -1),
        endRight = point(s, 1);
      face(out, 'pavement', [startLeft, startRight, endRight], up, c.paving);
      face(out, 'pavement', [startLeft, endRight, endLeft], up, c.paving);
    }
  }
}

function driveway(out) {
  roadStrip(out, drive.slice(0, 2), false);
  roadStrip(out, drive.slice(1, -1), true);
}

function draw(out, level) {
  planSections.forEach((section, i) => {
    buildSection(out, section, level, i);
  });
  driveway(out);
  coveredEntry(out, level);
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);
const id = plan.model,
  slug = id.replaceAll('_', '-');
const view = geo([72, 58, -91]),
  look = geo([0, 4, -5]);
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
export const model = {
  id,
  key: id,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  category: 'residence',
  recipe: `${slug}-model.mjs`,
  recipeDependencies: ['generate-motat-building.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Shilin Official Residence in Taipei, its green walls, grey tile roofs, connected wings and open-column covered entry.',
  camera: view,
  lookAt: look,
  sunDirection: geo([-34, 69, -49]),
  embeddedCanonicalGraphs: [...new Set(Object.values(surfaces).map(({ graph }) => graph))],
  mediumFiContext: {
    scale: 1,
    cameraYaw: 0.62,
    focus: { center: look },
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    {
      name: 'covered-green-entrance',
      position: geo([-17, 2.52, -43.5]),
      lookAt: geo([-2, 2.65, -31]),
    },
    { name: 'front-house-and-hillside', position: geo([31, 19, -51]), lookAt: geo([3, 4.7, -17]) },
    { name: 'connected-roof-ranges', position: geo([52, 57, 52]), lookAt: geo([-3, 6.6, -4]) },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `${slug}-${reviewLod}`,
    position: view,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 2.38,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.77, surfaces },
      street: { export: 'street', errorMeters: 0.25, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.1, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Reconstructed from a public-domain Qualla photograph, named OpenStreetMap geometry, Taipei records and original Terrarium elevation samples.',
};
