import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  block,
  closed,
  edge,
  floorSampler,
  mix,
  pairs,
  palette,
  panel,
  rect,
  shell,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const { dimensions: d } = plan;
const grade = floorSampler(read('terrain-grid.json'));
const colors = palette({
  concrete: 'c1bbaa',
  olderPanels: 'bbb5a4',
  foundation: '969082',
  stack: 'b6ae9e',
  cap: '6e6257',
  membrane: '81786b',
  paleRoof: 'b2ac9d',
  roofGravel: '978b7b',
  glazing: '515656',
  louvers: '777269',
  galvanized: '8a8580',
  silver: 'aeaaa1',
  door: '6c6c61',
  water: '43646a',
  fence: '77706a',
});
const surfaces = {
  wall: surface('wall', 'concrete_panel', 0.92),
  concrete: surface('foundation', 'concrete_plain', 0.9),
  roof: surface('roof', 'concrete_boardformed', 0.95),
  steel: surface('trim', 'metal_painted', 0.62, 0.26),
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.48, metallic: 0.05 },
  solid: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.88 },
};
const base = d.boilerFloor;
const sunk = (p) => Math.min(-0.38, grade(p) - 0.32);

function mass(out, outline, bottom, top, wall, roof = colors.membrane) {
  shell(out, outline, typeof bottom === 'number' ? () => bottom : bottom, top, {
    wall: 'wall',
    roof: 'roof',
    color: wall,
    roofColor: roof,
  });
}

function windowBank(out, w, left, right, bottom, top, level) {
  panel(
    out,
    'solid',
    w,
    left - 0.13,
    right + 0.13,
    bottom - 0.15,
    top + 0.13,
    0.075,
    colors.louvers,
  );
  panel(out, 'glazing', w, left, right, bottom, top, 0.1, colors.glazing);
  const n = level === 2 ? 3 : 5;
  if (level >= 2) {
    for (let i = 1; i < n; i++) {
      const u = mix(left, right, i / n);
      panel(out, 'steel', w, u - 0.075, u + 0.075, bottom, top, 0.129, colors.silver);
    }
    const middle = (bottom + top) / 2;
    panel(out, 'steel', w, left, right, middle - 0.058, middle + 0.058, 0.132, colors.silver);
  }
}

function powerBlock(out, level, outline, height, boiler) {
  const concrete = boiler ? colors.concrete : colors.olderPanels;
  mass(out, outline, sunk, height, concrete);
  const walls = pairs(closed(outline)).map(([a, b]) => edge(a, b, areaSign(outline)));
  for (const [side, w] of walls.entries()) {
    const length = w.length;
    const long = length > 160;
    const bayCount = long ? (boiler ? 5 : 4) : 2;
    panel(out, 'concrete', w, 0, length, height - 1.02, height + 0.06, 0.1, concrete);
    if (long && level === 0) {
      panel(
        out,
        'glazing',
        w,
        length * 0.06,
        length * 0.88,
        height - 11,
        height - 9,
        0.08,
        colors.glazing,
      );
      continue;
    }
    if (level === 0) continue;
    for (let bay = 0; bay < bayCount; bay++) {
      const start = (length * bay) / bayCount;
      const end = (length * (bay + 1)) / bayCount;
      const bayWidth = end - start;
      const groups = long && level >= 2 ? 2 : 1;
      const tiers =
        boiler && side === 1 ? [height - 10.6, height - 15.3, height - 22] : [height - 9.7];
      const useful = bayWidth * (side === 1 && bay === 3 ? 0.4 : 0.61);
      for (const y of tiers)
        for (let group = 0; group < groups; group++) {
          const a = start + bayWidth * 0.16 + (group * useful) / groups;
          windowBank(out, w, a, a + useful / groups - 1.05, y - 0.69, y + 1.67, level);
        }
      const door = start + bayWidth * 0.46;
      panel(out, 'solid', w, door - 2.4, door + 2.4, base + 0.05, base + 4.65, 0.09, colors.door);
      if (level >= 2) {
        const seams = level === 2 ? 3 : 6;
        for (let i = 0; i < seams; i++) {
          const u = start + (i * bayWidth) / seams + 0.15;
          panel(
            out,
            'concrete',
            w,
            u - 0.051,
            u + 0.051,
            base + 4.9,
            height - 1.13,
            0.033,
            colors.foundation,
          );
        }
      }
      if (level === 3) {
        panel(
          out,
          'steel',
          w,
          door - 2.64,
          door + 2.64,
          base + 4.65,
          base + 4.87,
          0.21,
          colors.silver,
        );
        for (let i = 1; i < 7; i++) {
          const y = base + i * 0.57;
          panel(out, 'steel', w, door - 2.2, door + 2.2, y, y + 0.04, 0.107, colors.louvers);
        }
      }
    }
  }
}

function stack(out, level) {
  const top = d.stackTop;
  const [x, z] = d.stackCenter;
  const [r0, r1] = d.stackRadius;
  const n = [14, 20, 28, 48][level];
  loft(
    out,
    'concrete',
    [radialRing(sunk([x, z]), r0, r0, n, [x, z]), radialRing(top - 2.4, r1, r1, n, [x, z])],
    colors.stack,
    { cap: false },
  );
  loft(
    out,
    'solid',
    [
      radialRing(top - 2.41, r1 + 0.37, r1 + 0.37, n, [x, z]),
      radialRing(top, r1 + 0.25, r1 + 0.25, n, [x, z]),
    ],
    colors.cap,
  );
  if (level >= 1) {
    const connection = 38.3;
    beam(out, 'steel', [23, connection, -3], [4.9, connection + 5.2, -3], 4.2, 4.3, colors.louvers);
    beam(out, 'steel', [-6.4, 41, -2.2], [-21, 38.5, -2.2], 3.1, 3.6, colors.galvanized);
  }
  if (level >= 2) {
    const ladderX = x + r0 + 0.06;
    for (const side of [-0.28, 0.28]) {
      beam(
        out,
        'steel',
        [ladderX, 7, z + side],
        [x + r1 + 0.18, top - 2.5, z + side],
        0.079,
        0.077,
        colors.louvers,
      );
    }
    const step = level === 3 ? 1.3 : 3.7;
    for (let y = 10; y < top - 3; y += step) {
      const side = mix(ladderX, x + r1 + 0.18, (y - 7) / (top - 9.5));
      beam(out, 'steel', [side, y, z - 0.27], [side, y, z + 0.27], 0.063, 0.055, colors.louvers);
    }
    for (const [angle, y] of [
      [0.1, 53],
      [-0.92, 71.5],
      [0.32, 80],
      [-0.32, 64],
    ]) {
      const r = mix(r0, r1, y / top);
      const p = [x + Math.cos(angle) * r, y, z + Math.sin(angle) * r];
      const q = [p[0] + Math.cos(angle) * 0.6, y, p[2] + Math.sin(angle) * 0.6];
      beam(out, 'steel', p, q, 0.32, 0.31, colors.silver);
      beam(out, 'solid', q, [q[0] + 0.1, y + 0.06, q[2]], 1.33, 1.28, colors.paleRoof);
    }
  }
}

function boilerEquipment(out, level) {
  for (const [i, z] of [-94, -56, -22, 29, 72].entries()) {
    const roof = i === 2 ? d.mechanicalRoof : 43.1 - i * 0.36;
    const x = i === 2 ? -13 : -10;
    block(
      out,
      'wall',
      x,
      d.boilerRoof - 0.07,
      z,
      11 + (i % 2) * 2,
      roof - d.boilerRoof + 0.12,
      12,
      colors.concrete,
    );
    if (level === 0) continue;
    block(
      out,
      'roof',
      x - 0.25,
      roof + 0.05,
      z - 0.27,
      12 + (i % 2) * 2,
      0.31,
      12.7,
      colors.paleRoof,
    );
    if (level >= 2) {
      beam(out, 'steel', [17, 25, z + 6], [46, 24 - (i % 2) * 3, z + 6], 2.0, 2.6, colors.silver);
      block(out, 'wall', 36, sunk([42, z]), z + 1, 10, 22 + (i % 2) * 3, 9.8, colors.louvers);
      beam(out, 'steel', [41.5, 4.3, z + 9], [41.5, 24.4, z + 9], 1.18, 1.12, colors.galvanized);
    }
    if (level === 3) {
      for (const a of [0, 1, 2, 3, 4]) {
        const y = 9.6 + a * 2.65;
        beam(out, 'steel', [28, y, z + 5], [35.7, y + 1.1, z + 5], 0.43, 0.45, colors.galvanized);
      }
    }
  }
  if (level >= 1) {
    for (const [i, z] of [-104, -68, -18, 29, 81].entries()) {
      const x = -48 + (i % 2) * 2.1;
      block(
        out,
        'roof',
        x,
        d.turbineRoof,
        z,
        18,
        0.24,
        20,
        i % 2 ? colors.roofGravel : colors.paleRoof,
      );
      if (level >= 2) {
        for (const dx of [0, 4, 8, 12])
          block(
            out,
            'steel',
            x + dx,
            d.turbineRoof + 0.25,
            z + 4.8,
            1.42,
            0.85,
            2.3,
            colors.silver,
          );
      }
    }
  }
}

function ancillary(out, level, outline, height, roof) {
  const floor = outline.reduce((sum, p) => sum + grade(p) / outline.length, 0);
  mass(out, outline, sunk, floor + height, colors.olderPanels, roof);
  if (level < 1) return;
  for (const [a, b] of pairs(closed(outline))) {
    const w = edge(a, b, areaSign(outline));
    const count = level === 1 ? 1 : Math.ceil(w.length / 7.5);
    for (let i = 0; i < count; i++) {
      const at = ((i + 0.5) * w.length) / count;
      windowBank(out, w, at - 1.25, at + 1.25, floor + 1.15, floor + 2.52, level);
    }
  }
}

function lagoonIntake(out, level) {
  ancillary(out, level, d.outlines.intake, 5.9, colors.paleRoof);
  const walls = pairs(closed(d.outlines.intake)).map(([a, b]) =>
    edge(a, b, areaSign(d.outlines.intake)),
  );
  const w = walls[0];
  const platform = grade(d.outlines.intake[0]) + 1.08;
  const count = [3, 5, 9, 13][level];
  panel(
    out,
    'concrete',
    w,
    -1.6,
    w.length + 1.3,
    platform - 2.3,
    platform + 0.17,
    1.7,
    colors.foundation,
  );
  for (let i = 0; i <= count; i++) {
    const u = (w.length * i) / count;
    beam(
      out,
      'steel',
      w.p(u, platform + 0.12, 1.65),
      w.p(u, platform + 1.26, 1.65),
      0.09,
      0.09,
      colors.fence,
    );
  }
  beam(
    out,
    'steel',
    w.p(0, platform + 1.25, 1.65),
    w.p(w.length, platform + 1.25, 1.65),
    0.09,
    0.09,
    colors.fence,
  );
}

function switchyard(out, level) {
  const [[x0, z0], [x1, z1], [x2, z2], [x3, z3]] = d.outlines.switchyard;
  const rows = [2, 3, 5, 6][level];
  const columns = [2, 3, 4, 5][level];
  for (let row = 0; row < rows; row++) {
    const v = (row + 0.5) / rows;
    for (let col = 0; col < columns; col++) {
      const u = (col + 0.5) / columns;
      const x = mix(mix(x0, x1, u), mix(x3, x2, u), v);
      const z = mix(mix(z0, z1, u), mix(z3, z2, u), v);
      const y = grade([x, z]);
      const h = 4.4 + ((row + col) % 3) * 1.1;
      block(out, 'concrete', x - 4.4, y - 0.52, z - 2.85, 9.25, 0.64, 5.8, colors.foundation);
      block(out, 'steel', x - 1.1, y, z - 1.35, 3.75, 2.17, 2.75, colors.louvers);
      for (const p of [-3.22, 3.22])
        beam(out, 'steel', [x + p, y, z], [x + p, y + h, z], 0.26, 0.26, colors.fence);
      beam(out, 'steel', [x - 3.42, y + h, z], [x + 3.42, y + h, z], 0.25, 0.25, colors.galvanized);
      if (level >= 2) {
        beam(
          out,
          'steel',
          [x - 3.2, y + 2.5, z],
          [x + 3.2, y + h - 0.33, z],
          0.11,
          0.11,
          colors.fence,
        );
        beam(
          out,
          'steel',
          [x + 3.2, y + 2.5, z],
          [x - 3.2, y + h - 0.33, z],
          0.11,
          0.11,
          colors.fence,
        );
      }
      if (level === 3)
        for (const offset of [-1.7, 0, 1.7])
          block(
            out,
            'solid',
            x + offset - 0.13,
            y + h - 1.17,
            z - 0.13,
            0.26,
            1.09,
            0.26,
            colors.paleRoof,
          );
    }
  }
}

function build(out, level) {
  const { turbine, boiler, shop, office } = d.outlines;
  powerBlock(out, level, turbine, d.turbineRoof, false);
  powerBlock(out, level, boiler, d.boilerRoof, true);
  stack(out, level);
  boilerEquipment(out, level);
  ancillary(out, level, shop, 11.2, colors.paleRoof);
  ancillary(out, level, office, 7.1, colors.roofGravel);
  lagoonIntake(out, level);
  switchyard(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'encina-power-station-model.mjs';
const camera = [450, 204, 295];
const lookAt = [-1, 34, -80];
const lods = { district: 1.14, street: 0.38, closeup: 0.12 };
export const encinaPowerStationAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  title: plan.title,
  category: 'landmark',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis:
    'The 2018 aerial traces the roof lines within the named site. The original present-day terrain at the west apron supplies the vertical datum for the historical reconstruction.',
  appearance: {
    kind: 'historical',
    currentWorldEligible: false,
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
  },
  brief:
    'Retired Encina Power Station in March 2019, with connected turbine and boiler halls, a single tapered concrete stack, east switchyard and intake at Agua Hedionda Lagoon.',
  camera,
  lookAt,
  sunDirection: [145, 190, 110],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'concrete_panel',
    'concrete_plain',
    'concrete_boardformed',
    'metal_painted',
  ],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'steam-units-and-stack-from-east', position: [375, 87, 60], lookAt: [0, 42, 0] },
    { name: 'turbine-roof-and-coastal-edge', position: [-314, 165, 188], lookAt: [-11, 33, -35] },
    {
      name: 'lagoon-intake-and-north-approach',
      position: [-145, 64, -445],
      lookAt: [-42, 20, -257],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'encina-power-station-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 2.45,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(lods).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under the repository license. USDA FSA NAIP public-domain aerial and OpenStreetMap ODbL 1.0 parcel context.',
};
