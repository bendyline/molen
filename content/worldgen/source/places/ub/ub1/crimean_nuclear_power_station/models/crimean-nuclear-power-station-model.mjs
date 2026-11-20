import { readFileSync } from 'node:fs';
import {
  at,
  block,
  cap,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  pairs,
  palette,
  panel,
  rect,
  ring,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const terrain = floorSampler(read('terrain-grid.json'));
const base = d.levels[0];
const roof = base + d.centralRoofHeight;
const tone = palette({
  earth: 'a49d7e',
  disturbed: '9a8e71',
  concrete: '9e9f96',
  lighter: 'b7b7a7',
  dark: '888d88',
  trim: 'a8a89e',
  openings: '4e5653',
  roof: '8d9088',
  stone: '959282',
  redBrown: '7c7061',
});
const surfaces = {
  earth: surface('foundation', 'earth_rammed', 0.98),
  concrete: surface('wall', 'concrete_boardformed', 0.94),
  foundation: surface('foundation', 'concrete_plain', 0.95),
  roof: surface('roof', 'concrete_plain', 0.96),
  opening: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.92, metallic: 0 },
  trim: surface('trim', 'metal_painted', 0.88),
};
const box = (out, slot, x0, x1, z0, z1, low, high, tint) =>
  block(out, slot, x0, low, z0, x1 - x0, high - low, z1 - z0, tint);
const point = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t)];

function historicalGround(out, lod) {
  const count = lod < 2 ? 3 : 6;
  const outer = pairs(closed(d.outline)).flatMap(([a, b]) =>
    Array.from({ length: count }, (_, i) => point(a, b, i / count)),
  );
  const inset = outer.map(([x, z]) => [x * 0.81 - 0.7, z * 0.8 - 0.2]);
  const perimeterGrade = (p) => Math.min(terrain(p) + 0.018, 5.0);
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length;
    const p = outer[i],
      q = outer[j],
      u = inset[i],
      v = inset[j];
    const a = at(p, perimeterGrade(p)),
      b = at(q, perimeterGrade(q)),
      c = at(v, -0.08),
      e = at(u, -0.08);
    face(out, 'earth', [a, b, c], up, tone.earth);
    face(out, 'earth', [a, c, e], up, tone.disturbed);
  }
  cap(out, 'earth', inset, -0.08, tone.earth);
}

function shadowBays(out, p, q, y0, y1, rows, columns, lod, full = false) {
  const w = edge(p, q, -1);
  const advance = w.length / columns,
    h = (y1 - y0) / rows;
  for (let level = 0; level < rows; level++) {
    const floor = y0 + level * h;
    for (let i = 0; i < columns; i++) {
      const offset = (i + 0.5) * advance;
      if (!full && level === 0 && (i + 1) % 4 === 0) continue;
      const width = advance * (full ? 0.36 : 0.28);
      panel(
        out,
        'opening',
        w,
        offset - width,
        offset + width,
        floor + h * 0.15,
        floor + h * 0.75,
        0.076,
        tone.openings,
      );
      if (lod < 2) continue;
      panel(
        out,
        'concrete',
        w,
        offset - width - 0.13,
        offset + width + 0.13,
        floor + h * 0.74,
        floor + h * 0.8,
        0.103,
        tone.lighter,
      );
      if (lod === 3 && i % 2 === 0)
        panel(
          out,
          'trim',
          w,
          offset - 0.046,
          offset + 0.046,
          floor + h * 0.15,
          floor + h * 0.75,
          0.11,
          tone.dark,
        );
    }
  }
}

function centralShell(out, lod) {
  const p = d.polygons[0];
  shell(out, p, () => -0.11, base + 1.02, { wall: 'foundation', color: tone.stone });
  shell(out, p, () => base, base + 22.4, { wall: 'concrete', color: tone.concrete });
  box(out, 'concrete', -30.84, 23.42, -31.91, 21.06, base + 21.9, roof - 4.65, tone.dark);
  box(out, 'concrete', -21.88, 22.15, -28.14, 12.46, roof - 4.91, roof, tone.concrete);
  box(out, 'roof', -22.22, 22.43, -28.48, 12.8, roof - 0.42, roof + 0.35, tone.roof);
  box(out, 'foundation', -7.88, 17.31, -19.33, 3.14, roof + 0.13, roof + 3.76, tone.dark);
  const crown = d.upperCrownHeight;
  const tower = [3.5, -7.14];
  ring(
    out,
    'concrete',
    tower,
    [
      [roof + 2.6, 11.3],
      [roof + 3.74, 11.3],
      [roof + crown - 0.6, 10.59],
      [roof + crown, 10.91],
    ],
    [12, 16, 24, 32][lod],
    tone.lighter,
  );
  const steps = [12, 16, 24, 32][lod];
  const disk = Array.from({ length: steps }, (_, i) => {
    const a = (i * 2 * Math.PI) / steps;
    return [tower[0] + Math.cos(a) * 10.89, tower[1] + Math.sin(a) * 10.89];
  });
  cap(out, 'roof', disk, roof + crown, tone.roof);
  if (lod === 0) return;
  shadowBays(
    out,
    [-35.997, 34.092],
    [35.996, 34.092],
    base + 1.46,
    base + 19.0,
    3,
    lod === 1 ? 6 : 9,
    lod,
  );
  shadowBays(
    out,
    [-35.997, -34.065],
    [-35.997, 34.065],
    base + 0.87,
    base + 19.8,
    3,
    lod === 1 ? 5 : 8,
    lod,
  );
  shadowBays(
    out,
    [35.997, 34.065],
    [35.997, -34.065],
    base + 1.57,
    base + 15.1,
    2,
    lod === 1 ? 5 : 8,
    lod,
  );
  const w = edge([-21.82, 12.5], [21.98, 12.5], -1);
  for (const [i, floor] of [roof - 12.35, roof - 7.24, roof - 1.64].entries()) {
    panel(
      out,
      'concrete',
      w,
      0.3,
      w.length - 0.31,
      floor,
      floor + 0.33,
      0.063,
      i === 0 ? tone.dark : tone.lighter,
    );
  }
  for (let i = 0; i < (lod === 1 ? 3 : 7); i++) {
    const u = ((i + 0.5) * w.length) / (lod === 1 ? 3 : 7);
    panel(out, 'opening', w, u - 0.72, u + 0.72, roof - 7.02, roof - 5.23, 0.084, tone.openings);
  }
  if (lod < 2) return;
  for (const i of [-14, -9, -4, 1, 7, 13]) {
    box(out, 'concrete', i, i + 1.18, -28.55, -26.41, roof - 0.04, roof + 0.67, tone.lighter);
  }
  for (const [x, z] of [
    [-25, 18],
    [-16.6, 17.6],
    [-6.8, 18.2],
    [8.9, 18.1],
    [15, 19.6],
  ]) {
    box(
      out,
      'concrete',
      x - 0.58,
      x + 0.58,
      z - 0.52,
      z + 0.52,
      roof - 4.66,
      roof - 3.45,
      tone.dark,
    );
  }
}

function annex(out, lod) {
  const p = d.polygons[1],
    y = d.levels[1],
    eave = y + d.westRoofHeight;
  shell(out, p, () => -0.17, y + 0.25, { wall: 'foundation', color: tone.stone });
  shell(out, p, () => y + 0.21, eave, { wall: 'concrete', color: tone.trim });
  shell(
    out,
    p.map(([x, z]) => [x * 1.001, z * 1.013]),
    () => eave - 0.21,
    eave + 0.27,
    { wall: 'roof', color: tone.roof },
  );
  const [, b, c, e] = p;
  if (lod > 0) {
    shadowBays(out, b, c, y + 0.73, eave - 0.84, 2, lod === 1 ? 5 : 8, lod, true);
    shadowBays(out, c, e, y + 0.73, eave - 0.71, 2, lod === 1 ? 7 : 11, lod, true);
  }
}

function attachedHall(out, lod) {
  const rear = -55.23,
    front = -33.85,
    l = -57.8,
    r = 40.85,
    y = base - 0.27,
    h = y + 12.2;
  box(out, 'foundation', l - 0.23, r + 0.17, rear - 0.13, front, -0.15, y + 0.42, tone.stone);
  box(out, 'concrete', l, r, rear, front, y, h, tone.trim);
  box(out, 'roof', l - 0.23, r + 0.17, rear - 0.27, front + 0.05, h - 0.44, h + 0.13, tone.roof);
  if (lod === 0) return;
  shadowBays(
    out,
    [r, rear - 0.015],
    [l, rear - 0.015],
    y + 1.07,
    h - 1.17,
    2,
    lod === 1 ? 9 : 14,
    lod,
    true,
  );
  shadowBays(
    out,
    [l, front + 0.02],
    [r, front + 0.02],
    y + 1.13,
    h - 1.22,
    2,
    lod === 1 ? 9 : 14,
    lod,
    true,
  );
  const low = base + 8.25;
  box(out, 'concrete', 22.32, 52.07, 25.8, 42.2, base - 0.11, low, tone.trim);
  box(out, 'roof', 22.11, 52.23, 25.53, 42.36, low - 0.3, low + 0.1, tone.roof);
  if (lod > 1)
    shadowBays(out, [22.35, 42.24], [52.1, 42.24], base + 1.21, low - 0.77, 1, 5, lod, true);
}

function build(out, lod) {
  historicalGround(out, lod);
  centralShell(out, lod);
  annex(out, lod);
  attachedHall(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'crimean-nuclear-power-station-model.mjs';
const camera = [177, 94, 165];
const lookAt = [-23, 15, -5];
export const crimeanExterior = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'industrial',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'exact-native-frame',
  groundContactBasis:
    'Original terrain southeast of the footprint anchors the historical grade. The mapped shell coincides with a localized high return in the raw field.',
  appearance: {
    kind: 'historical',
    currentWorldEligible: false,
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
  },
  groundCutout: {
    outline: d.outline,
    basis:
      'The localized terrain return overlaps the main shell and west range. Only the 1999 historical view uses an estimated site grade within the recorded outline.',
  },
  buildingCutout: {
    outline: d.outline,
    outlines: d.polygons,
    minimumCoverage: 0.92,
    basis:
      'The two exterior footprints retained in native version history support the main shell and detached west range.',
  },
  brief:
    'The unfinished 1999 exterior of the former Crimean Nuclear Power Station, with its tall central concrete mass and long adjacent ranges.',
  camera,
  lookAt,
  sunDirection: [-48, 74, 82],
  mediumFiContext: {
    scale: 1,
    groundY: -0.15,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [...new Set(Object.values(surfaces).flatMap((s) => s.graph ?? []))],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'historic-steppe-silhouette', position: [105, 41, 132], lookAt: [-8, 19, 1] },
    { name: 'stepped-concrete-shell-and-crown', position: [71, 42, 93], lookAt: [0, 23, -9] },
    { name: 'unfinished-west-range', position: [-153, 36, 43], lookAt: [-62, 7, -22] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'crimean-station-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.25,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.59, surfaces },
      street: { export: 'street', errorMeters: 0.21, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.075, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under the repository license. Lite released the 1999 Qualla photograph into the public domain. Native map data © OpenStreetMap contributors, ODbL 1.0.',
};
