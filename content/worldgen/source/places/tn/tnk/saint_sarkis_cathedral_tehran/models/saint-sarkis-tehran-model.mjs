/** The standing Armenian Apostolic cathedral in Tehran, based on its mapped and written record. */
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls'),
  map = read('map-frame');
const d = plan.dimensions,
  outline = map.geometry.outline;
const up = [0, 1, 0],
  ref = 'palette:#ffffff';
const surfaces = {
  marble: { slot: 'wall', graph: 'stone_marble', roughness: 0.86, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.85, metallic: 0 },
  dark: { slot: 'window', localRef: 'palette:#3c4949', roughness: 0.66, metallic: 0 },
  frame: { slot: 'trim', localRef: 'palette:#a8aaa2', roughness: 0.76, metallic: 0.18 },
  door: { slot: 'door', graph: 'wood_plain', roughness: 0.86, metallic: 0 },
};
const color = {
  wall: rgb('e4e0d5'),
  marbleShadow: rgb('c6c2b6'),
  ivory: rgb('edebde'),
  sill: rgb('bbb8ab'),
  slate: rgb('778081'),
  dome: rgb('718687'),
  frame: rgb('ccc9bc'),
  shadow: rgb('494d46'),
  glass: rgb('5d7070'),
  wood: rgb('675342'),
};
const mix = (a, b, t) => a + (b - a) * t;
const xyz = ([x, z], y) => [x, y, z];

function face(out, slot, p, n, tint) {
  let normal = normalFor(...p);
  if (normal.some((v) => !Number.isFinite(v)))
    throw new Error('Invalid Saint Sarkis surface normal');
  if (normal.reduce((sum, v, i) => sum + v * n[i], 0) < 0) {
    p = [...p].reverse();
    normal = normalFor(...p);
  }
  if (p.length === 4) quad(out, slot, p, normal, tint);
  else
    out.addTriangle(
      slot,
      ref,
      p,
      normal,
      p.map(([x, y, z]) => [x + z, y]),
      tint,
    );
}
function axis(a, b, center = [0, -15]) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / length,
    dz = (b[1] - a[1]) / length;
  const innerPoint = -dz * (center[0] - a[0]) + dx * (center[1] - a[1]);
  const sign = innerPoint < 0 ? 1 : -1;
  const n = [-sign * dz, 0, sign * dx];
  return {
    length,
    n,
    dx,
    dz,
    at: (u, y, z = 0) => [a[0] + dx * u + n[0] * z, y, a[1] + dz * u + n[2] * z],
  };
}
function panel(out, f, slot, u0, u1, y0, y1, offset, tint) {
  if (u1 - u0 < 0.0001 || y1 - y0 < 0.0001) return;
  face(
    out,
    slot,
    [f.at(u0, y0, offset), f.at(u1, y0, offset), f.at(u1, y1, offset), f.at(u0, y1, offset)],
    f.n,
    tint,
  );
}
function cap(out, slot, poly, y, tint) {
  const scratch = new MeshBufferBuilder();
  if (
    !scratch.addCap(
      slot,
      ref,
      poly,
      [],
      () => y,
      up,
      (p) => p,
      tint,
    )
  )
    throw new Error('Cannot triangulate the cathedral outline');
  const mesh = scratch.finalize();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const points = [0, 1, 2].map((j) => {
      const k = mesh.indices[i + j] * 3;
      return Array.from(mesh.positions.slice(k, k + 3));
    });
    face(out, slot, points, up, tint);
  }
}

function rectangularEnclosure(out, f, windows, y0, y1, level) {
  let last = 0;
  for (const { u, w, low, high, door } of windows) {
    const left = u - w / 2,
      right = u + w / 2,
      depth = level > 0 ? -0.23 : -0.035;
    panel(out, f, 'marble', last, left, y0, y1, 0, color.wall);
    panel(out, f, 'marble', left, right, y0, low, 0, color.wall);
    panel(out, f, 'marble', left, right, high, y1, 0, color.wall);
    panel(
      out,
      f,
      door ? 'door' : 'dark',
      left,
      right,
      low,
      high,
      depth,
      door ? color.wood : color.glass,
    );
    if (level > 0) {
      for (const sign of [-1, 1]) {
        const x = u + (sign * w) / 2;
        face(
          out,
          'trim',
          [f.at(x, low), f.at(x, low, depth), f.at(x, high, depth), f.at(x, high)],
          [-sign * f.dx, 0, -sign * f.dz],
          color.marbleShadow,
        );
      }
      panel(out, f, 'trim', left - 0.12, right + 0.12, high, high + 0.15, 0.06, color.ivory);
      panel(out, f, 'trim', left - 0.09, right + 0.09, low - 0.13, low, 0.065, color.sill);
      if (level > 1) {
        panel(
          out,
          f,
          'frame',
          u - 0.025,
          u + 0.025,
          low + 0.04,
          high - 0.04,
          depth + 0.03,
          color.frame,
        );
        for (const t of door ? [0.45, 0.78] : [0.49, 0.72]) {
          const y = mix(low, high, t);
          panel(
            out,
            f,
            'frame',
            left + 0.05,
            right - 0.05,
            y,
            y + 0.034,
            depth + 0.036,
            color.frame,
          );
        }
      }
    }
    last = right;
  }
  panel(out, f, 'marble', last, f.length, y0, y1, 0, color.wall);
}

function front(out, f, level) {
  const mid = f.length / 2;
  const openings = d.westDoors.map((x, i) => ({
    u: mid + x,
    w: i === 1 ? 2.67 : 1.53,
    low: d.threshold,
    high: i === 1 ? 4.53 : 3.49,
    door: true,
  }));
  rectangularEnclosure(out, f, openings, d.threshold, 5.47, level);
  const lights = [-1.5, 0, 1.5].map((x) => ({ u: mid + x, w: 0.49, low: 6.25, high: 9.16 }));
  rectangularEnclosure(out, f, lights, 5.47, d.naveEave, level);
  const gable = d.naveRidge;
  face(
    out,
    'marble',
    [f.at(0, d.naveEave), f.at(f.length, d.naveEave), f.at(mid, gable)],
    f.n,
    color.wall,
  );
  for (const [a, b] of [
    [f.at(0, d.naveEave, 0.05), f.at(mid, gable, 0.05)],
    [f.at(mid, gable, 0.05), f.at(f.length, d.naveEave, 0.05)],
  ])
    beam(out, 'trim', a, b, 0.16, 0.19, color.ivory);
  if (level > 0) {
    const y = 10.4;
    beam(
      out,
      'trim',
      f.at(mid, y - 0.55, 0.074),
      f.at(mid, y + 0.56, 0.074),
      0.13,
      0.12,
      color.sill,
    );
    beam(
      out,
      'trim',
      f.at(mid - 0.42, y + 0.11, 0.074),
      f.at(mid + 0.42, y + 0.11, 0.074),
      0.13,
      0.12,
      color.sill,
    );
  }
  if (level > 1) {
    // The west façade is post-renovation masonry with framed glass lights, above three entrances.
    for (const x of [-2.35, 2.35]) {
      const station = mid + x;
      beam(
        out,
        'trim',
        f.at(station, 0.61, 0.096),
        f.at(station, 5.13, 0.096),
        0.115,
        0.122,
        color.ivory,
      );
    }
    for (const x of [-0.65, 0.65]) {
      const x0 = mid + x,
        y = 5.19;
      panel(out, f, 'trim', x0 - 0.4, x0 + 0.4, y, y + 0.21, 0.055, color.sill);
    }
  }
  for (let i = 0; i < 4; i++)
    box(
      out,
      'trim',
      [-4.75, d.wallBase, 0.18 + i * 0.35],
      [4.75, d.threshold - i * 0.14, 0.53 + i * 0.35],
      color.sill,
    );
}

function tallNiche(out, f, mid, level) {
  if (level === 0) return;
  const side = 0.58,
    low = 3.15,
    yTop = 8.26,
    apex = 7.85;
  const a = f.at(mid - side, low, 0.017),
    b = f.at(mid + side, low, 0.017),
    p = f.at(mid, apex, 0.027),
    tip = f.at(mid, yTop, 0.026);
  face(out, 'trim', [a, p, tip], f.n, color.marbleShadow);
  face(out, 'trim', [p, b, tip], f.n, color.sill);
  if (level > 1) {
    beam(out, 'trim', a, tip, 0.095, 0.1, color.ivory);
    beam(out, 'trim', tip, b, 0.095, 0.1, color.ivory);
  }
}

function nave(out, level) {
  for (let i = 0; i < outline.length; i++) {
    const f = axis(outline[i], outline[(i + 1) % outline.length]);
    panel(out, f, 'trim', 0, f.length, d.wallBase, d.threshold, 0, color.sill);
    if (i === 0) {
      front(out, f, level);
      continue;
    }
    const windows = [];
    if (f.length > 5.4) {
      const count = Math.max(1, Math.floor(f.length / 3.7));
      for (let j = 0; j < count; j++) {
        const u = ((j + 0.5) * f.length) / count;
        windows.push({ u, w: 0.55, low: 4.6, high: 8.03 });
      }
    }
    if ((i === 3 || i === 22) && f.length > 2.6)
      windows.push({ u: f.length / 2, w: 1.26, low: d.threshold, high: 3.42, door: true });
    rectangularEnclosure(out, f, windows, d.threshold, d.naveEave, level);
    if (level > 0 && f.length > 2.4)
      beam(
        out,
        'trim',
        f.at(0, d.naveEave - 0.07),
        f.at(f.length, d.naveEave - 0.07),
        0.16,
        0.19,
        color.ivory,
      );
    if ([7, 19].includes(i)) tallNiche(out, f, f.length * 0.37, level);
    if ([12, 14].includes(i)) tallNiche(out, f, f.length * 0.47, level);
  }
  cap(out, 'roof', outline, d.naveEave - 0.006, color.slate);
}

function roofGable(out, c, width, z0, z1, y, top, level, crosswise = false, nearWidth = width) {
  const [cx, cz] = c;
  const p = (u, v, y) => (crosswise ? [cx + v, y, cz + u] : [cx + u, y, cz + v]);
  const w = width / 2,
    front = nearWidth / 2;
  for (const sign of [-1, 1]) {
    const low0 = p(w * sign, z0, y),
      low1 = p(front * sign, z1, y),
      high1 = p(0, z1, top),
      high0 = p(0, z0, top);
    face(out, 'roof', [low0, low1, high1, high0], up, color.slate);
    if (level > 1)
      for (let i = 1; i < 7; i++) {
        const v = mix(z0, z1, i / 7);
        beam(
          out,
          'frame',
          p(mix(w, front, i / 7) * sign, v, y + 0.018),
          p(0, v, top + 0.018),
          0.034,
          0.04,
          color.frame,
        );
      }
  }
  for (const [v, sign, half] of [
    [z0, -1, w],
    [z1, 1, front],
  ]) {
    face(
      out,
      'marble',
      [p(-half, v, y), p(half, v, y), p(0, v, top)],
      crosswise ? [sign, 0, 0] : [0, 0, sign],
      color.wall,
    );
  }
}
function roof(out, level) {
  roofGable(out, [0, 0], 12.6, -31.2, -0.018, d.naveEave, d.naveRidge, level, false, 9.08);
  roofGable(out, [0, -16.08], 9.71, -8.75, 8.13, d.naveEave, d.naveRidge - 0.29, level, true);
  const apse = outline.slice(12, 16);
  for (let i = 0; i < apse.length - 1; i++)
    face(
      out,
      'roof',
      [xyz(apse[i], d.naveEave), xyz(apse[i + 1], d.naveEave), [-0.62, 11.45, -31.8]],
      up,
      color.slate,
    );
}

function cross(out, x, y, z, height, size, level) {
  const crossbar = y + height * 0.67;
  beam(out, 'frame', [x, y, z], [x, y + height, z], size, size, color.ivory);
  beam(
    out,
    'frame',
    [x - height * 0.36, crossbar, z],
    [x + height * 0.36, crossbar, z],
    size,
    size,
    color.ivory,
  );
  if (level > 1)
    beam(
      out,
      'frame',
      [x, crossbar, z - height * 0.35],
      [x, crossbar, z + height * 0.35],
      size * 0.82,
      size * 0.82,
      color.ivory,
    );
}
function ringAt(y, r, n, x, z, phi) {
  return radialRing(y, r, r, n, [x, z], phi);
}
function centerLantern(out, level) {
  const [x, z] = d.domeCenter,
    n = 6,
    phi = Math.PI / 6,
    radius = d.domeDrumRadius;
  const r = (y, v) => ringAt(y, v, n, x, z, phi);
  const foot = 13.04,
    base = 14.35,
    top = d.domeDrumTop;
  loft(
    out,
    'marble',
    [r(foot, radius + 0.44), r(base, radius + 0.44), r(base + 0.23, radius)],
    color.wall,
  );
  const ring = r(base + 0.21, radius);
  for (let i = 0; i < n; i++) {
    const [a, b] = [ring[i], ring[(i + 1) % n]],
      f = axis([a[0], a[2]], [b[0], b[2]], [x, z]);
    const count = level === 0 ? 1 : 2;
    rectangularEnclosure(
      out,
      f,
      Array.from({ length: count }, (_, j) => ({
        u: ((j + 1) * f.length) / (count + 1),
        w: 0.55,
        low: base + 1.15,
        high: top - 0.59,
      })),
      base + 0.21,
      top,
      level,
    );
    if (level > 0)
      beam(out, 'trim', [a[0], base + 0.27, a[2]], [a[0], top, a[2]], 0.1, 0.12, color.ivory);
  }
  loft(out, 'trim', [r(top - 0.22, radius + 0.11), r(top + 0.07, radius + 0.16)], color.ivory);
  loft(out, 'roof', [r(top, radius + 0.14), r(d.domeApex, 0.11)], color.dome);
  if (level > 0) {
    const points = r(top, radius + 0.18);
    for (const p of points)
      beam(out, 'frame', p, [x, d.domeApex + 0.03, z], 0.11, 0.12, color.ivory);
  }
  cross(out, x, d.domeApex, z, 1.09, 0.092, level);
}
function bellTower(out, x, z, level) {
  const base = 8.63,
    floor = 12.55,
    cornice = 15.44,
    top = d.bellTowerTop,
    n = 8,
    phi = Math.PI / 8;
  const r = (height, radius) => ringAt(height, radius, n, x, z, phi);
  box(out, 'marble', [x - 1.04, d.threshold, z - 1.02], [x + 1.04, base, z + 1.02], color.wall);
  loft(out, 'marble', [r(base, 1.48), r(base + 0.82, 1.3), r(floor, 1.16)], color.wall);
  const feet = r(floor, 1.17),
    heads = r(cornice, 1.13),
    ends = r(top, 0.075);
  if (level === 0) loft(out, 'marble', [feet, heads], color.marbleShadow);
  else
    for (let i = 0; i < n; i++) {
      beam(out, 'trim', feet[i], heads[i], 0.18, 0.19, color.ivory);
      if (level > 1) beam(out, 'frame', feet[i], feet[(i + 1) % n], 0.055, 0.13, color.frame);
    }
  loft(out, 'trim', [r(cornice - 0.09, 1.29), r(cornice + 0.1, 1.22)], color.ivory);
  if (level === 0) loft(out, 'roof', [heads, ends], color.dome);
  else
    for (let i = 0; i < n; i++) {
      beam(out, 'frame', heads[i], ends[i], 0.135, 0.155, color.ivory);
      if (level > 1) {
        const p = heads[i],
          q = heads[(i + 1) % n],
          dy = 1.42,
          t = dy / (top - cornice);
        const a = [mix(p[0], x, t), cornice + dy, mix(p[2], z, t)],
          b = [mix(q[0], x, t), cornice + dy, mix(q[2], z, t)];
        beam(out, 'frame', a, b, 0.057, 0.085, color.frame);
        if (level > 2)
          beam(
            out,
            'frame',
            heads[i],
            [mix(b[0], a[0], 0.5), b[1], mix(a[2], b[2], 0.5)],
            0.044,
            0.067,
            color.frame,
          );
      }
    }
  cross(out, x, top - 0.08, z, 0.83, 0.071, level);
}
function build(out, level) {
  nave(out, level);
  roof(out, level);
  centerLantern(out, level);
  for (const [x, z] of d.bellTowers) bellTower(out, x, z, level);
}
export const saintSarkisSkyline = (out) => build(out, 0);
export const saintSarkisDistrict = (out) => build(out, 1);
export const saintSarkisStreet = (out) => build(out, 2);
export const saintSarkisCloseup = (out) => build(out, 3);
const recipe = 'saint-sarkis-tehran-model.mjs',
  position = [-30, 20, 40],
  lookAt = [0, 10.5, -14];
export const saintSarkisModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  wikidataId: plan.wikidataId,
  cell: plan.cell,
  recipe,
  surfaces,
  build: saintSarkisCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  buildingCutout: {
    outline,
    minimumCoverage: 0.995,
    basis: 'Named Armenian Apostolic cathedral footprint.',
  },
  brief:
    'Saint Sarkis in Tehran, with a marble-clad cross-shaped nave, two western bells and a large faceted lantern over the crossing.',
  camera: position,
  lookAt,
  sunDirection: [-68, 105, 113],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1.38,
    groundY: 0,
    cameraYaw: -0.47,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'western-doors-and-twin-bells', position: [0.5, 10.8, 40], lookAt: [0, 10.9, -6] },
    { name: 'marble-nave-niches-and-lantern', position: [-32, 17, -19], lookAt: [-3, 11, -16] },
    { name: 'polygonal-apse-and-crossing', position: [24, 17, -54], lookAt: [0, 9, -23] },
    { name: 'dome-and-open-bell-crowns', position: [21, 26, 11], lookAt: [0, 17.9, -12] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'saint-sarkis-' + reviewLod,
    position,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'saintSarkisSkyline',
    errorMeters: 0.93,
    surfaces,
    authoredLevels: {
      district: { export: 'saintSarkisDistrict', errorMeters: 0.47, surfaces },
      street: { export: 'saintSarkisStreet', errorMeters: 0.16, surfaces },
      closeup: { export: 'saintSarkisCloseup', errorMeters: 0.055, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry using publicly documented architectural facts, attributed OpenStreetMap and original Terrarium elevation.',
};
