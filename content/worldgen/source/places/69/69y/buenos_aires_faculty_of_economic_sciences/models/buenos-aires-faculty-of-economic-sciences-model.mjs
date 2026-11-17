/** Historic Córdoba and Uriburu elevations of the UBA Faculty of Economic Sciences. */
import fs from 'node:fs';
import {
  beamPath,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import {
  profile,
  quad,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const { outline, courtyards, modernParts } = read('map-frame').geometry;
const d = plan.dimensions;
const colors = Object.fromEntries(
  Object.entries({
    plaster: 'bebcb1',
    court: 'bfb8a8',
    trim: 'd2ccbb',
    sill: '9b9588',
    recess: '726c62',
    base: 'a29b88',
    glass: '4f5b54',
    lightGlass: '64746d',
    iron: '525954',
    doors: '5f5445',
    roof: '797a72',
    ridge: '959081',
    modern: 'adaea4',
    band: 'c1c3b9',
  }).map(([name, tint]) => [name, rgb(tint)]),
);
const c = colors;
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.94 },
  plinth: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.9, metallic: 0.07 },
  annex: { slot: 'wall', graph: 'concrete_plain', roughness: 0.95 },
  glass: { slot: 'window', localRef: 'palette:#fffffe', roughness: 0.87 },
  detail: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.92 },
};
const up = [0, 1, 0];
const north = [-1, 0, 0];
const floor = -2.4;
const cornice = d.heightHistoricCornice;
const westPortalEdge = 40;
const westPortalCenter = d.westMuseumContact[0] - outline[westPortalEdge][0];
const westPortalHalfWidth = 2.48;

function face(out, slot, points, direction, tint) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, v, i) => sum + v * direction[i], 0) < 0) {
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

function area(ring) {
  return ring.reduce((sum, [x, z], i) => {
    const [nx, nz] = ring[(i + 1) % ring.length];
    return sum + x * nz - nx * z;
  }, 0);
}

function edge([x, z], [nx, nz], winding) {
  const length = Math.hypot(nx - x, nz - z);
  const dx = (nx - x) / length;
  const dz = (nz - z) / length;
  const normal = [winding * dz, 0, -winding * dx];
  return {
    length,
    normal,
    at: (u, y, facing = 0) => [x + u * dx + facing * normal[0], y, z + u * dz + facing * normal[2]],
  };
}

function panel(out, slot, e, start, end, bottom, top, offset, tint) {
  face(
    out,
    slot,
    [
      e.at(start, bottom, offset),
      e.at(end, bottom, offset),
      e.at(end, top, offset),
      e.at(start, top, offset),
    ],
    e.normal,
    tint,
  );
}

function moulding(out, e, start, end, bottom, height, depth, tint = c.trim) {
  const outer = depth;
  const inner = -0.035;
  const top = bottom + height;
  panel(out, 'trim', e, start, end, bottom, top, outer, tint);
  face(
    out,
    'trim',
    [
      e.at(start, top, inner),
      e.at(start, top, outer),
      e.at(end, top, outer),
      e.at(end, top, inner),
    ],
    up,
    tint,
  );
  face(
    out,
    'trim',
    [
      e.at(start, bottom, inner),
      e.at(start, bottom, outer),
      e.at(end, bottom, outer),
      e.at(end, bottom, inner),
    ],
    [0, -1, 0],
    tint,
  );
}

function cap(out, slot, ring, holes, height, tint) {
  const points = ring.concat(...holes);
  let count = ring.length;
  const indices = holes.map((hole) => {
    const start = count;
    count += hole.length;
    return start;
  });
  const triangles = earcut(points.flat(), indices);
  for (let i = 0; i < triangles.length; i += 3)
    face(
      out,
      slot,
      triangles.slice(i, i + 3).map((j) => [points[j][0], height, points[j][1]]),
      up,
      tint,
    );
}

function roundHead(u, half, spring, rise, divisions) {
  return Array.from({ length: divisions + 1 }, (_, i) => {
    const angle = Math.PI * (1 - i / divisions);
    return [u + half * Math.cos(angle), spring + rise * Math.sin(angle)];
  });
}

function archedPane(out, slot, e, u, half, sill, spring, rise, depth, tint, segments) {
  const arch = roundHead(u, half, spring, rise, segments);
  const polar = (p) => e.at(p[0], p[1], depth);
  panel(out, slot, e, u - half, u + half, sill, spring, depth - 0.002, tint);
  for (let i = 1; i < arch.length; i++)
    face(
      out,
      slot,
      [e.at(u, spring - 0.003, depth), polar(arch[i - 1]), polar(arch[i])],
      e.normal,
      tint,
    );
  return arch;
}

function trimArch(out, e, arch, sill, depth, width, tint) {
  const head = arch.map(([u, y]) => e.at(u, y, depth));
  beamPath(
    out,
    'trim',
    [e.at(arch[0][0], sill, depth), ...head, e.at(arch.at(-1)[0], sill, depth)],
    width,
    width * 1.3,
    tint,
  );
}

function sash(out, e, u, sill, width, body, rise, detail) {
  const half = width / 2;
  const spring = sill + body;
  const pane = archedPane(
    out,
    'glass',
    e,
    u,
    half,
    sill,
    spring,
    rise,
    0.035,
    c.glass,
    [4, 5, 8, 12][detail],
  );
  if (detail >= 1) {
    moulding(out, e, u - half - 0.15, u + half + 0.15, sill - 0.12, 0.145, 0.21, c.sill);
    if (detail >= 2) trimArch(out, e, pane, sill, 0.093, 0.11, c.trim);
  }
  if (detail >= 2) {
    panel(out, 'detail', e, u - 0.06, u + 0.06, sill + 0.025, spring + rise - 0.13, 0.105, c.trim);
    panel(
      out,
      'detail',
      e,
      u - half + 0.035,
      u + half - 0.035,
      spring - 0.06,
      spring + 0.042,
      0.11,
      c.trim,
    );
    if (sill < 3.0) {
      for (let i = -2; i <= 2; i++)
        panel(
          out,
          'detail',
          e,
          u + (i * width) / 7 - 0.035,
          u + (i * width) / 7 + 0.035,
          sill,
          spring,
          0.138,
          c.iron,
        );
    }
  }
}

function museumPortal(out, e, detail) {
  const center = westPortalCenter;
  const half = westPortalHalfWidth;
  const sill = 0.81;
  const spring = 7.94;
  const rise = d.westEntranceArch - spring;
  const segments = [6, 8, 12, 18][detail];
  const arch = roundHead(center, half, spring, rise, segments);
  panel(out, 'plinth', e, 0, e.length, floor, sill, 0, c.base);
  panel(out, 'wall', e, 0, center - half, sill, cornice, 0, c.plaster);
  panel(out, 'wall', e, center + half, e.length, sill, cornice, 0, c.plaster);
  for (let i = 1; i < arch.length; i++) {
    const [a, b] = [arch[i - 1], arch[i]];
    face(
      out,
      'wall',
      [e.at(...a), e.at(...b), e.at(b[0], cornice), e.at(a[0], cornice)],
      e.normal,
      c.plaster,
    );
    face(
      out,
      'trim',
      [e.at(...a), e.at(...b), e.at(...b, -1.15), e.at(...a, -1.15)],
      [0, -1, 0],
      c.recess,
    );
  }
  for (const sign of [-1, 1]) {
    const u = center + sign * half;
    face(
      out,
      'trim',
      [e.at(u, sill), e.at(u, spring), e.at(u, spring, -1.15), e.at(u, sill, -1.15)],
      [e.at(center, 0)[0] - e.at(u, 0)[0], 0, e.at(center, 0)[2] - e.at(u, 0)[2]],
      c.recess,
    );
  }
  archedPane(out, 'glass', e, center, half + 0.015, sill, spring, rise, -1.17, c.recess, segments);
  archedPane(
    out,
    'detail',
    e,
    center,
    half * 0.83,
    sill,
    spring - 0.41,
    rise * 0.8,
    -1.125,
    c.doors,
    segments,
  );
  trimArch(out, e, arch, sill, 0.18, detail > 0 ? 0.27 : 0.2, c.trim);
  moulding(out, e, center - 2.85, center + 2.85, sill - 0.18, 0.19, 0.42);
  if (detail > 0) {
    const upper = roundHead(center, half + 0.38, spring, rise + 0.4, segments);
    trimArch(out, e, upper, sill, 0.25, 0.13, c.sill);
    const voussoirs = detail > 1 ? 11 : 7;
    for (let i = 1; i < voussoirs; i++) {
      const angle = (Math.PI * i) / voussoirs;
      const u = center + (half + 0.43) * Math.cos(angle);
      const y = spring + (rise + 0.48) * Math.sin(angle);
      moulding(out, e, u - 0.13, u + 0.13, y - 0.07, 0.13, 0.36, c.trim);
    }
    moulding(out, e, center - 0.29, center + 0.29, 10.32, 0.64, 0.38);
    for (const sign of [-1, 1]) {
      const u = center + sign * (half + 0.49);
      for (let y = 1.52; y < 7.8; y += 0.93) moulding(out, e, u - 0.22, u + 0.22, y, 0.66, 0.225);
    }
    panel(out, 'detail', e, center - 0.095, center + 0.095, sill, spring, -1.08, c.sill);
    const badge = center + 3.35;
    panel(out, 'detail', e, badge - 0.39, badge + 0.39, 1.91, 2.39, 0.1, c.doors);
  }
}

function exterior(out, detail) {
  const winding = Math.sign(area(outline));
  const bands = [
    [3.42, 0.26, 0.22],
    [10.96, 0.31, 0.26],
    [16.11, 0.38, 0.35],
    [16.74, 0.42, 0.57],
  ];
  for (let i = 0; i < outline.length; i++) {
    const e = edge(outline[i], outline[(i + 1) % outline.length], winding);
    const avenue = i >= 17 && i <= 32;
    const uriburu = i >= 34 && i <= 42;
    const historic = avenue || uriburu;
    if (i === westPortalEdge) museumPortal(out, e, detail);
    else {
      panel(out, 'plinth', e, 0, e.length, floor, 2.78, 0, c.base);
      panel(
        out,
        historic ? 'wall' : 'annex',
        e,
        0,
        e.length,
        2.78,
        cornice,
        0,
        historic ? c.plaster : c.modern,
      );
    }
    if (e.length < 2 || detail === 0) continue;
    if (historic) {
      for (const [bottom, height, depth] of detail === 1 ? bands.slice(1, 3) : bands) {
        if (i === westPortalEdge && bottom < d.westEntranceArch) {
          const clearance = westPortalHalfWidth + 0.5;
          moulding(out, e, 0, westPortalCenter - clearance, bottom, height, depth);
          moulding(out, e, westPortalCenter + clearance, e.length, bottom, height, depth);
        } else moulding(out, e, 0, e.length, bottom, height, depth);
      }
    }
    if (e.length < 5) continue;
    if (detail >= 2 && historic && i !== westPortalEdge) {
      const horizontal = detail === 3 ? 0.56 : 1.12;
      for (let y = 4.06; y < 10.86; y += horizontal)
        panel(out, 'detail', e, 0.15, e.length - 0.15, y, y + 0.035, 0.013, c.sill);
    }
    const bays = Math.max(1, Math.round(e.length / (historic ? 4.25 : 5.0)));
    for (let bay = 0; bay < bays; bay++) {
      const u = (e.length * (bay + 0.5)) / bays;
      const width = Math.min(2, (e.length / bays) * 0.48);
      if (i === westPortalEdge && Math.abs(u - westPortalCenter) < 3.5) continue;
      if (avenue) {
        const z = e.at(u, 0)[2];
        if (Math.abs(z - 21.75) < 8.2) continue;
      }
      if (historic) {
        sash(out, e, u, 4.09, width, 4.36, 1.18, detail);
        sash(out, e, u, 11.77, width * 0.85, 2.97, 0.43, detail === 2 ? 1 : detail);
        if (detail >= 2) sash(out, e, u, 1.21, width * 0.8, 1.18, 0.43, detail === 2 ? 1 : detail);
      } else {
        for (let y = 3.62; y < 15; y += 3.5)
          panel(
            out,
            'glass',
            e,
            u - width * 0.65,
            u + width * 0.65,
            y,
            y + 1.62,
            0.028,
            c.lightGlass,
          );
      }
    }
  }
  for (const [courtIndex, ring] of courtyards.entries()) {
    const sign = -Math.sign(area(ring));
    for (let i = 0; i < ring.length; i++) {
      const e = edge(ring[i], ring[(i + 1) % ring.length], sign);
      panel(
        out,
        courtIndex < 2 ? 'wall' : 'annex',
        e,
        0,
        e.length,
        floor,
        cornice,
        0,
        courtIndex < 2 ? c.court : c.modern,
      );
      if (detail < 2 || e.length < 6) continue;
      const bays = Math.round(e.length / 4.95);
      for (let bay = 0; bay < bays; bay++) {
        const u = (e.length * (bay + 0.5)) / bays;
        for (const y of [4.3, 8.8, 13.2])
          panel(out, 'glass', e, u - 0.73, u + 0.73, y, y + 1.94, 0.031, c.lightGlass);
      }
    }
  }
  cap(out, 'roof', outline, courtyards, cornice, c.roof);
}

function annex(out, feature, detail) {
  const top = Number(feature.heightMeters ?? 13.2);
  const ring = feature.outline;
  const sign = Math.sign(area(ring));
  for (let i = 0; i < ring.length; i++) {
    const e = edge(ring[i], ring[(i + 1) % ring.length], sign);
    panel(out, 'annex', e, 0, e.length, floor, top, 0, c.modern);
    if (detail === 0 || e.length < 3) continue;
    for (let y = 3.2; y + 1.48 < top - 0.5; y += 3.02) {
      panel(out, 'glass', e, 0.57, e.length - 0.57, y, y + 1.48, 0.04, c.lightGlass);
      if (detail >= 2) {
        moulding(out, e, 0, e.length, y - 0.11, 0.16, 0.16, c.band);
        for (let u = 1.52; u < e.length - 0.63; u += 2.6)
          panel(out, 'detail', e, u, u + 0.075, y, y + 1.48, 0.061, c.band);
      }
    }
  }
  cap(out, 'roof', ring, [], top, c.roof);
}

function avenuePortico(out, detail) {
  const x = -48.01;
  const z = 21.75;
  const clearHalf = 7.08;
  const base = 2.22;
  const plate = 15.73;
  const apex = d.heightHistoricallyRepresentativeRoof;
  box(out, 'plinth', x - 1.13, -1.8, z, 3.71, 3.92, 2 * clearHalf + 1.27, c.base);
  const steps = detail === 0 ? 1 : 6;
  for (let i = 0; i < steps; i++) {
    const run = 2.4 - i * (1.75 / steps);
    const y = 1.07 + i * ((base - 1.07) / steps);
    box(out, 'trim', x - 2.58 - run / 2, y - 0.65, z, run, 0.68, 2.0 * clearHalf + 1.03, c.sill);
  }
  for (const offset of [-5.45, -1.82, 1.82, 5.45]) {
    const s = z + offset;
    const layers = [
      [base, 0.74, 0.74],
      [base + 0.39, 0.72, 0.72, 'trim', c.trim],
      [base + 0.68, 0.57, 0.57, 'trim', c.trim],
      [plate - 0.63, 0.45, 0.45, 'trim', c.trim],
      [plate - 0.44, 0.58, 0.58, 'trim', c.trim],
      [plate - 0.05, 0.69, 0.69, 'trim', c.trim],
    ];
    profile(
      out,
      detail === 0 ? [layers[0], layers[3], layers[5]] : layers,
      [6, 8, 12, 16][detail],
      [x - 2.12, s],
    );
    if (detail >= 2) {
      for (const r of [-0.28, 0.28]) {
        box(out, 'trim', x - 2.18, plate - 0.47, s + r, 1.37, 0.31, 0.18, c.trim);
      }
    }
  }
  box(out, 'trim', x - 1.41, plate - 0.055, z, 3.78, 0.29, 2 * clearHalf + 1.11, c.trim);
  box(out, 'wall', x - 1.1, plate + 0.24, z, 3.22, 0.84, 2 * clearHalf + 0.73, c.plaster);
  box(out, 'trim', x - 1.2, plate + 1.07, z, 3.64, 0.29, 2 * clearHalf + 1.16, c.trim);
  const gable = [
    [x - 3.09, plate + 1.35, z - clearHalf - 0.61],
    [x - 3.09, apex, z],
    [x - 3.09, plate + 1.35, z + clearHalf + 0.61],
  ];
  const behind = gable.map(([, y, z]) => [x + 2.2, y, z]);
  face(out, 'wall', gable, north, c.plaster);
  face(out, 'wall', behind, [1, 0, 0], c.plaster);
  for (const i of [0, 1])
    face(out, 'roof', [gable[i], gable[i + 1], behind[i + 1], behind[i]], up, c.roof);
  beamPath(out, 'trim', gable, 0.32, 0.46, c.trim, true);
  const lobby = edge([x - 0.81, z - 7.18], [x - 0.81, z + 7.18], -1);
  for (const u of [3.68, 7.18, 10.68]) {
    archedPane(
      out,
      'glass',
      lobby,
      u,
      1.21,
      base,
      5.91,
      0.91,
      0.21,
      c.doors,
      [4, 5, 8, 12][detail],
    );
  }
  if (detail >= 1) {
    for (let u = 0.56; u < 14.05; u += 0.74) moulding(out, lobby, u, u + 0.18, 16.46, 0.21, 2.3);
    const motif = edge([x - 3.12, z - 4.6], [x - 3.12, z + 4.6], -1);
    for (const [u, height] of [
      [1.7, 0.59],
      [2.62, 0.97],
      [3.6, 1.13],
      [4.59, 1.26],
      [5.6, 1.13],
      [6.6, 0.95],
      [7.5, 0.56],
    ]) {
      archedPane(out, 'detail', motif, u, 0.2, 17.86, 17.86 + height, 0.18, 0.02, c.sill, 5);
    }
  }
}

function rooftop(out, detail) {
  const meshes = [
    [-43.3, 20.8, 4.6, 14.4, c.ridge],
    [-0.8, 53.75, 11.42, 5.3, c.ridge],
    [26.7, 43, 7.5, 7.0, c.roof],
    [63.8, -27.8, 9.1, 17.55, c.roof],
  ];
  for (const [x, z, width, depth, color] of meshes) {
    box(out, 'annex', x, cornice, z, width, 1.11, depth, c.modern);
    box(out, 'roof', x, cornice + 1.11, z, width + 0.16, 0.2, depth + 0.16, color);
  }
  if (detail < 2) return;
  for (const z of [62.4, 45.6, 22.4, 8.9]) {
    box(out, 'roof', -42.31, cornice + 0.01, z, 0.75, 0.7, 0.65, c.roof);
  }
}

function draw(out, detail) {
  exterior(out, detail);
  for (const feature of modernParts) annex(out, feature, detail);
  avenuePortico(out, detail);
  rooftop(out, detail);
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [-145, 84, 155];
const lookAt = [0, 11.4, 12.1];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;

export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe: `${slug}-model.mjs`,
  surfaces,
  build: closeup,
  wikidataId: 'Q5854627',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The UBA Faculty of Economic Sciences has a stone-trimmed Córdoba entrance and an arched Uriburu portal for the cultural center, with courts and connected annexes.',
  camera,
  lookAt,
  sunDirection: [-72, 110, 74],
  recipeDependencies: ['generate-motat-building.mjs', 'polygon-triangulation.mjs'],
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_limestone_raw',
    'stone_ashlar',
    'metal_standing_seam',
    'concrete_plain',
  ],
  appearance: { materialBudget: 7 },
  mediumFiContext: {
    scale: 1,
    cameraYaw: -2.2,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'uriburu-museum-portal', position: [19, 8.3, 105], lookAt: [-2.15, 8.5, 68.8] },
    { name: 'cordoba-portico', position: [-108, 22, 12], lookAt: [-46, 11.4, 21.7] },
    { name: 'courtyards-and-annexes', position: [122, 112, -64], lookAt: [0, 9.1, 11] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `${slug}-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.41,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.59, surfaces },
      street: { export: 'street', errorMeters: 0.24, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.084, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original geometry based on the exact public-domain Qualla photograph of the Uriburu elevation, written university sources, native mapping and original terrain.',
};
