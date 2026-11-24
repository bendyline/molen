import fs from 'node:fs';
import {
  loft,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { parts } = JSON.parse(
  fs.readFileSync(new URL('../native-map/odesa-opera-building-parts.json', import.meta.url)),
);
const terrain = JSON.parse(fs.readFileSync(new URL('../terrain-grid.json', import.meta.url)));
const mapped = new Map(parts.map(({ way, local }) => [way.id, outwardRing(local)]));
const body = mapped.get('1249731453');
const { foundation, lowerBelt, galleryBelt, stageHeight, stageCrown } = plan.dimensions;
const plinth = rgb('aea08a');
const sand = rgb('c1a47f');
const ashlar = rgb('c7ab83');
const cream = rgb('dec8a4');
const light = rgb('d8bf98');
const shade = rgb('b69770');
const roof = rgb('6b7370');
const roofTrim = rgb('838681');
const glazing = rgb('535b55');
const door = rgb('6c533c');
const surfaces = {
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.97 },
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.94 },
  molding: { slot: 'trim', graph: 'stone_limestone', roughness: 0.89 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.89 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.48 },
  door: { slot: 'door', graph: 'wood_plain', roughness: 0.87 },
};

function heightAt(x, z) {
  const { origin, stepMeters, heightsMeters, modelDatumElevationMeters } = terrain;
  const i = Math.round((x - origin[0]) / stepMeters);
  const j = Math.round((z - origin[1]) / stepMeters);
  return heightsMeters[j][i] - modelDatumElevationMeters;
}

function cap(out, slot, ring, y, color) {
  const indices = earcut(ring.flat(), [], 2);
  const point = (i) => [ring[i][0], typeof y === 'function' ? y(...ring[i]) : y, ring[i][1]];
  for (let i = 0; i < indices.length; i += 3)
    tri(out, slot, point(indices[i]), point(indices[i + 2]), point(indices[i + 1]), color);
}

function volume(out, slot, ring, y0, y1, color, cover = true) {
  extrude(out, slot, ring, y0, y1, color, { top: false });
  if (cover) cap(out, slot, ring, y1, color);
}

function inset(ring, x, z, scale) {
  return ring.map(([px, pz]) => [x + (px - x) * scale, z + (pz - z) * scale]);
}

function band(out, ring, y, thickness, offset, color, cover = true) {
  const expanded = inset(ring, -5.9, 4, 1 + offset / 35);
  volume(out, 'molding', expanded, y, y + thickness, color, cover);
}

function window(out, face, u, y, w, h, lod, options = {}) {
  opening(out, face, u, y, w, h, {
    glassSlot: options.door ? 'door' : 'glass',
    frameSlot: 'molding',
    glass: options.door ? door : glazing,
    frame: light,
    frameWidth: lod > 1 ? 0.095 : 0,
    frameDepth: 0.1,
    sill: !options.door && lod > 1,
    d: 0.038,
    head: options.arch ? 'round' : 'flat',
    mullions: options.mullions ?? (lod > 1 ? 1 : 0),
    transoms: lod > 1 && h > 2.1 ? 1 : 0,
  });
}

function rounds(out, slot, x, z, profile, sides, color) {
  const rings = profile.map(([y, r]) =>
    Array.from({ length: sides }, (_, i) => {
      const a = (-2 * Math.PI * i) / sides;
      return [x + r * Math.cos(a), y, z + r * Math.sin(a)];
    }),
  );
  loft(out, slot, rings, color, { cap: false });
}

function column(out, face, u, base, top, depth, radius, lod) {
  const [x, , z] = face.P(u, 0, depth);
  const feet = Math.min(0.57, radius * 1.48);
  fbox(
    out,
    'molding',
    face,
    u - radius * 1.5,
    u + radius * 1.5,
    base,
    base + feet,
    depth - radius * 1.5,
    depth + radius * 1.5,
    cream,
  );
  const side = lod < 2 ? 6 : lod === 2 ? 9 : 12;
  const capital = feet * 1.35;
  const profile = [
    [base + feet, radius * 1.19],
    [base + feet * 1.34, radius],
    [top - capital, radius * 0.89],
    [top - capital * 0.57, radius * 1.14],
    [top - capital * 0.39, radius * 1.31],
  ];
  rounds(out, 'molding', x, z, profile, side, light);
  fbox(
    out,
    'molding',
    face,
    u - radius * 1.42,
    u + radius * 1.42,
    top - capital * 0.42,
    top,
    depth - radius * 1.37,
    depth + radius * 1.37,
    cream,
  );
}

function archTrim(out, face, center, spring, radius, rise, depth, thickness, lod, key = false) {
  const segments = [4, 5, 8, 11][lod];
  const edge = (i, offset) => {
    const a = (Math.PI * i) / segments;
    return [center - (radius + offset) * Math.cos(a), spring + (rise + offset) * Math.sin(a)];
  };
  for (let i = 0; i < segments; i++) {
    const a = edge(i, 0),
      b = edge(i + 1, 0);
    const c = edge(i + 1, thickness),
      d = edge(i, thickness);
    quad4(
      out,
      'molding',
      face.P(...a, depth),
      face.P(...b, depth),
      face.P(...c, depth),
      face.P(...d, depth),
      cream,
    );
  }
  if (key && lod > 1) {
    fbox(
      out,
      'molding',
      face,
      center - thickness * 0.54,
      center + thickness * 0.53,
      spring + rise - 0.03,
      spring + rise + thickness * 1.47,
      depth - 0.032,
      depth + 0.126,
      cream,
    );
  }
}

function curvedGallery(out, lod) {
  if (lod > 0) volume(out, 'base', body, foundation, 0.47, plinth, false);
  volume(out, 'stone', body, lod === 0 ? foundation : 0.44, lowerBelt, sand, false);
  volume(out, 'stone', body, lowerBelt, galleryBelt, ashlar, false);
  cap(out, 'roof', body, galleryBelt, roof);
  if (lod > 0) band(out, body, 8.32, 0.42, 0.31, cream);
  band(out, body, 17.08, 0.45, 0.39, cream, lod > 0);
  if (lod === 0) return;
  band(out, body, 8.96, 0.26, 0.38, shade);
  band(out, body, 17.51, 0.23, 0.23, light);
  band(out, body, 18.05, 0.3, 0.22, cream);
  for (let i = 0; i < body.length; i++) {
    const face = wallFace(body[i], body[(i + 1) % body.length]);
    if (face.length < 2.1) continue;
    const [x, , z] = face.P(face.length / 2, 0);
    const front = z > 10 && face.normal[1] > 0.02;
    const count = Math.max(1, Math.round(face.length / 4.38));
    const bay = face.length / count;
    const understated = !front && lod === 1;
    const bayDetail = !front && lod === 2 ? 1 : lod;
    if (front && lod > 1) {
      for (const y of [2.8, 6.65, 7.93]) {
        fbox(out, 'molding', face, 0.015, face.length - 0.015, y, y + 0.065, 0.004, 0.135, light);
      }
    }
    for (let j = 0; j < count; j++) {
      const u = (j + 0.5) * bay;
      if (z > 36.65 && x > -13.6 && x < -1.1) continue;
      const w = Math.min(2.05, bay * 0.47);
      const y0 = front ? 3.16 : Math.min(3.5, Math.max(0.54, heightAt(x, z) + 2.09));
      if (!understated) {
        window(out, face, u, y0, w, 3.03, bayDetail);
        if (front || lod > 1) {
          window(out, face, u, Math.min(y0 - 0.24, 0.61), w * 0.78, 1.88, bayDetail, {
            door: (i + j) % 4 === 0,
          });
        }
      }
      const upperY = front ? 10.06 : 10.55;
      const upperHeight = front ? 4.58 : 3.54;
      window(out, face, u, upperY, w * 1.07, upperHeight, bayDetail, { arch: front });
      if (front && lod > 1) {
        const r = w * 0.535;
        const spring = upperY + upperHeight - r;
        archTrim(out, face, u, spring, r + 0.035, r + 0.035, 0.205, 0.17, lod, true);
        for (const sign of [-1, 1]) {
          const k = u + sign * (r + 0.15);
          fbox(out, 'molding', face, k - 0.09, k + 0.09, upperY, spring, 0.043, 0.214, light);
        }
        fbox(
          out,
          'molding',
          face,
          u - r * 1.18,
          u + r * 1.18,
          upperY - 0.17,
          upperY - 0.027,
          0.02,
          0.23,
          cream,
        );
      }
      if (front) {
        const a = j * bay + 0.31;
        if (lod > 1) column(out, face, a, 9.21, 16.95, 0.35, 0.26, lod);
        else fbox(out, 'molding', face, a - 0.17, a + 0.17, 9.28, 16.92, 0.04, 0.41, light);
        if (lod > 1) {
          fbox(out, 'molding', face, u - 0.81, u + 0.81, 17.86, 18.21, 0.009, 0.55, cream);
          if ((i + j) % 3 === 0)
            fbox(out, 'molding', face, u - 0.24, u + 0.24, 18.11, 18.55, 0.06, 0.53, light);
        }
      }
    }
  }
}

function portalArch(out, face, section, lod) {
  const { half, base, spring, rise, top, back } = section;
  const segments = [4, 6, 9, 13][lod];
  const inner = (i) => {
    const a = (Math.PI * i) / segments;
    return [-half * Math.cos(a), spring + rise * Math.sin(a)];
  };
  fbox(out, 'stone', face, -6.14, -half, base, top, back, 0, ashlar);
  fbox(out, 'stone', face, half, 6.14, base, top, back, 0, ashlar);
  for (let i = 0; i < segments; i++) {
    const a = inner(i),
      b = inner(i + 1);
    quad4(out, 'stone', face.P(...a), face.P(...b), face.P(b[0], top), face.P(a[0], top), ashlar);
    quad4(out, 'stone', face.P(...a), face.P(...a, back), face.P(...b, back), face.P(...b), shade);
  }
  archTrim(out, face, 0, spring, half + 0.025, rise + 0.025, 0.14, 0.35, lod, true);
  fbox(out, 'molding', face, -half - 0.33, -half - 0.02, base, spring, -0.04, 0.21, light);
  fbox(out, 'molding', face, half + 0.02, half + 0.33, base, spring, -0.04, 0.21, light);
}

function sculpturalAccent(out, face, u, y, lod, scale = 1) {
  const [x, , z] = face.P(u, y, 0.32);
  const sides = lod === 2 ? 6 : 8;
  const profile = [
    [y, 0.4],
    [y + 0.34 * scale, 0.42],
    [y + 0.73 * scale, 0.25],
    [y + 1.04 * scale, 0.27],
    [y + 1.17 * scale, 0.16],
  ];
  rounds(out, 'molding', x, z, profile, sides, cream);
  sphere(
    out,
    'molding',
    [x - 0.042, y + 1.29 * scale, z + 0.038],
    [0.17, 0.19, 0.16],
    light,
    sides,
    4,
  );
}

function frontPortico(out, lod) {
  const face = facade([-7.41, 44.02], [1, 0]);
  const rear = facade([-7.41, 39.03], [1, 0]);
  fbox(out, 'base', face, -6.18, 6.18, foundation, 0.22, -7.19, 0.52, plinth);
  fbox(out, 'stone', rear, -5.8, 5.8, 0.06, 23.22, -2.27, 0, shade);
  portalArch(
    out,
    face,
    { half: 2.93, base: 0.2, spring: 4.52, rise: 2.74, top: 8.52, back: -4.96 },
    lod,
  );
  portalArch(
    out,
    face,
    { half: 3.32, base: 8.65, spring: 15.76, rise: 3.61, top: 21.83, back: -4.78 },
    lod,
  );
  for (const [base, top, depth] of [
    [8.35, 8.89, 0.51],
    [9.14, 9.37, 0.5],
    [21.28, 22.01, 0.6],
    [22.73, 23.24, 0.7],
    [23.56, 23.89, 0.62],
  ]) {
    fbox(out, 'molding', face, -6.42, 6.42, base, top, -7.15, depth, cream);
  }
  fbox(out, 'stone', face, -5.94, 5.94, 21.92, 23.64, -7.19, 0.18, ashlar);
  fbox(out, 'molding', face, -4.12, 4.12, 23.83, 24.73, -6.67, 0.21, light);
  fbox(out, 'molding', face, -2.72, 2.72, 24.73, 25.07, -5.04, 0.06, cream);
  if (lod === 0) {
    for (const u of [-4.65, 4.65])
      fbox(out, 'molding', face, u - 0.65, u + 0.65, 9.39, 21.5, 0.14, 1.08, light);
    return;
  }
  window(out, rear, 0, 0.27, 4.47, 5.84, lod, { arch: true, door: true, mullions: 2 });
  window(out, rear, 0, 9.71, 4.87, 7.13, lod, { arch: true, mullions: 3 });
  for (const side of [-1, 1]) {
    for (const x of [3.9, 5.29]) {
      const u = side * x;
      column(out, face, u, 9.51, 21.42, 0.79, 0.4, lod);
      fbox(out, 'base', face, u - 0.65, u + 0.65, 0.23, 1.13, -0.09, 1.15, plinth);
    }
    for (const section of [
      [0.38, 1.01, 0.82],
      [1.02, 2.21, 1.23],
      [2.21, 2.52, 1.36],
    ]) {
      const [y0, y1, depth] = section;
      const u = side * 4.64;
      fbox(out, 'molding', face, u - 0.89, u + 0.89, y0, y1, 0.41, depth, light);
    }
    if (lod < 2) continue;
    for (let j = 0; j < 10; j++) {
      const y = 1.16 + j * 0.68;
      const a = side * 4.58;
      fbox(out, 'molding', face, a - 1.44, a + 1.44, y, y + 0.105, -0.02, 0.15, light);
    }
    const statue = facade([-7.41, 45.15], [1, 0]);
    sculpturalAccent(out, statue, side * 4.67, 2.49, lod, 1.32);
    sculpturalAccent(out, face, side * 4.89, 23.87, lod, 0.88);
  }
  fbox(out, 'molding', face, -3.52, 3.52, 8.97, 9.09, -1.02, 0.33, cream);
  fbox(out, 'molding', face, -3.22, 3.22, 9.86, 10.02, 0.01, 0.44, cream);
  if (lod > 1) {
    const posts = lod === 3 ? 18 : 10;
    for (let i = 0; i <= posts; i++) {
      const u = -3.12 + (6.24 * i) / posts;
      fbox(out, 'molding', face, u - 0.056, u + 0.056, 9.09, 9.91, 0.08, 0.38, light);
    }
    sculpturalAccent(out, face, 0, 25.02, lod, 0.99);
  }
}

function roofHousing(out, lod) {
  const room = mapped.get('423035493');
  volume(out, 'stone', room, 17.0, 20, shade, false);
  const ring = inset(room, -5.25, 4.8, 1.02);
  const auditorium = [
    [20.0, 1],
    [21.9, 0.82],
    [23.9, 0.58],
    [25, 0.32],
  ];
  loft(
    out,
    'roof',
    auditorium.map(([y, s]) => inset(ring, -5.25, 4.8, s).map(([x, z]) => [x, y, z])),
    roof,
    { cap: false },
  );
  cap(out, 'roof', inset(ring, -5.25, 4.8, 0.32), 25, roof);
  const drum = mapped.get('423035494');
  const drumRing = lod === 0 ? drum.filter((_, i) => i % 2 === 0) : drum;
  volume(out, 'stone', drumRing, 24.26, 28.0, sand, false);
  loft(
    out,
    'roof',
    [
      [28, 1],
      [29.35, 0.88],
      [30.48, 0.58],
      [31, 0.18],
    ].map(([y, s]) => inset(drumRing, -5.18, 8.77, s).map(([x, z]) => [x, y, z])),
    roofTrim,
    { cap: false },
  );
  cap(out, 'roof', inset(drumRing, -5.18, 8.77, 0.18), 31, roofTrim);
  const stage = mapped.get('423035491');
  volume(out, 'stone', stage, 17.0, 32.03, sand, false);
  const [left, right, center, rear, front] = [-22.07, 11.31, -5.38, -30.72, -8.18];
  quad4(
    out,
    'roof',
    [left, 32, rear],
    [left, 32, front],
    [center, stageHeight, front],
    [center, stageHeight, rear],
    roof,
  );
  quad4(
    out,
    'roof',
    [center, stageHeight, rear],
    [center, stageHeight, front],
    [right, 32, front],
    [right, 32, rear],
    roof,
  );
  tri(out, 'stone', [right, 32, rear], [left, 32, rear], [center, stageHeight, rear], ashlar);
  tri(out, 'stone', [left, 32, front], [right, 32, front], [center, stageHeight, front], ashlar);
  const crown = mapped.get('423035492');
  volume(out, 'stone', crown, 35.0, stageCrown - 0.6, shade, false);
  for (let i = 0; i < crown.length; i++) {
    const a = crown[i],
      b = crown[(i + 1) % crown.length];
    tri(
      out,
      'roof',
      [a[0], stageCrown - 0.6, a[1]],
      [b[0], stageCrown - 0.6, b[1]],
      [-5.39, stageCrown, -19.44],
      roofTrim,
    );
  }
  if (lod < 2) return;
  for (const ring of [stage, drumRing]) {
    const upper = ring === stage ? 32.02 : 28;
    for (let i = 0; i < ring.length; i++) {
      const face = wallFace(ring[i], ring[(i + 1) % ring.length]);
      if (face.length < 0.65) continue;
      const count = Math.max(1, Math.round(face.length / 4.15));
      const w = face.length / count;
      fbox(
        out,
        'molding',
        face,
        0.035,
        face.length - 0.035,
        upper - 0.34,
        upper - 0.1,
        0.018,
        0.12,
        light,
      );
      for (let j = 0; j < count; j++)
        window(
          out,
          face,
          (j + 0.5) * w,
          upper - (ring === stage ? 5.25 : 2.28),
          w * 0.53,
          ring === stage ? 2.77 : 1.65,
          lod,
          { arch: ring === drumRing },
        );
    }
  }
}

function lowEntrances(out, lod) {
  for (const side of [-1, 1]) {
    const ring = mapped.get(side < 0 ? '1249731445' : '1249731454');
    volume(out, 'stone', ring, 5.63, 6.55, ashlar);
    const face = facade([side < 0 ? -43.98 : 31.79, 0.04], [0, -side]);
    const grade = Math.max(-4.85, heightAt(face.origin[0], 0));
    for (const u of [-8.04, -2.59, 2.68, 7.83]) {
      const width = lod === 0 ? 0.55 : 0.71;
      fbox(out, 'stone', face, u - width, u + width, grade - 1.4, 5.68, -1.02, -0.07, sand);
    }
    if (lod === 0) continue;
    fbox(out, 'molding', face, -8.87, 8.83, 6.42, 6.72, -5.22, 0.28, cream);
    fbox(out, 'base', face, -8.84, 8.82, grade - 1.42, grade + 0.21, -5.29, 0.35, plinth);
    if (lod < 2) continue;
    for (const u of [-7.96, -2.58, 2.68, 7.79]) {
      fbox(out, 'molding', face, u - 0.84, u + 0.84, grade + 0.2, grade + 0.83, -1.08, 0.16, light);
      fbox(out, 'molding', face, u - 0.82, u + 0.82, 5.19, 5.73, -1.07, 0.16, cream);
    }
  }
  const annexe = mapped.get('541735443');
  volume(out, 'stone', annexe, foundation, 5.0, ashlar);
  if (lod > 1) {
    const face = wallFace(annexe[1], annexe[2]);
    for (const u of [0.23, 0.53, 0.8])
      window(out, face, face.length * u, 0.65, 1.32, 2.67, lod, { arch: true });
  }
}

function build(out, lod) {
  curvedGallery(out, lod);
  roofHousing(out, lod);
  frontPortico(out, lod);
  lowEntrances(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'odesa-opera-and-ballet-theatre-model.mjs';
const camera = [60, 31, 91];
const lookAt = [-5, 13.2, 6.2];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'cultural',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The Odesa Opera and Ballet Theatre with its round sandstone frontage, double-height arched portico, gallery colonnade, and stepped auditorium and stage roofs.',
  camera,
  lookAt,
  sunDirection: [-33, 62, 66],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.92,
    basis: 'Full native theatre outline including the entrance portico and stair wings.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'curved-galleries-and-portico', position: camera, lookAt },
    {
      name: 'paired-columns-and-arched-entry',
      position: [-7.4, 8.6, 84],
      lookAt: [-7.4, 11.5, 39],
    },
    { name: 'rear-stage-and-auditorium-roofs', position: [-51, 44, -61], lookAt: [-5, 16, -3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'odesa-opera-and-ballet-theatre-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.98,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.46, surfaces },
      street: { export: 'street', errorMeters: 0.15, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.058, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
