import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import october6 from '../../2_world_trade_center_construction_2026/layout.json' with {
  type: 'json',
};
import {
  buildConstruction,
  surfaces,
} from '../../2_world_trade_center_construction_2026/models/construction-model.mjs';

export { surfaces };

const white = [0.74, 0.74, 0.7];
const zinc = [0.43, 0.47, 0.47];
const dark = [0.25, 0.27, 0.26];
const vermilion = [0.67, 0.24, 0.13];
const paleTimber = [0.66, 0.53, 0.36];

const layout = {
  ...october6,
  openEntrance: true,
  sparseScaffold: true,
  northOffice: [-35.5, -22.3, -28.1, -19.1],
  constructionAccess: {
    west: -41.42,
    east: -30.3,
    north: -18.72,
    south: -15.23,
    northGrade: -1.63,
    southGrade: -1.48,
  },
  decks: october6.decks.map((deck, index) => (index === 0 ? { ...deck, y: 8.12 } : deck)),
  deckStock: october6.deckStock.map((stock, index) => (index < 2 ? { ...stock, y: 8.12 } : stock)),
};

function meshPanel(out, a, b, bottom, top, detail) {
  const at = (t, y) => [a[0] + (b[0] - a[0]) * t, y, a[1] + (b[1] - a[1]) * t];
  for (const y of [bottom, top]) beam(out, 'steel', at(0, y), at(1, y), 0.073, 0.073, zinc);
  for (const t of [0, 1]) beam(out, 'steel', at(t, bottom), at(t, top), 0.073, 0.073, zinc);
  if (detail < 2) {
    beam(out, 'steel', at(0, bottom), at(1, top), 0.04, 0.04, zinc);
    return;
  }
  const cells = detail === 3 ? 12 : 4;
  for (let i = 1; i < cells; i++) {
    const t = i / cells;
    beam(out, 'steel', at(t, bottom), at(t, top), 0.027, 0.027, zinc);
  }
  for (let i = 1; i < cells / 2; i++) {
    const y = bottom + ((top - bottom) * i * 2) / cells;
    beam(out, 'steel', at(0, y), at(1, y), 0.023, 0.023, zinc);
  }
}

function greenwichEntrance(out, detail) {
  const towers = [
    { x: -41.1, z: -21.88, y: -2 },
    { x: -41.78, z: -12.03, y: -1.53 },
  ];
  for (const { x, z, y } of towers) {
    if (detail === 0) {
      box(out, 'concrete', [x - 0.28, y - 0.3, z - 0.36], [x + 0.33, 3.39, z + 0.36], white);
      continue;
    }
    box(out, 'concrete', [x - 0.36, y - 0.3, z - 0.47], [x + 0.51, y + 1.97, z + 0.47], white);
    for (const d of [-0.27, 0.27]) {
      beam(out, 'steel', [x + d, y + 1.93, z - 0.29], [x + d, 3.39, z - 0.29], 0.106, 0.101, zinc);
      beam(out, 'steel', [x + d, y + 1.93, z + 0.29], [x + d, 3.39, z + 0.29], 0.106, 0.101, zinc);
      if (detail > 1)
        beam(
          out,
          'steel',
          [x + d, y + 2.25, z - 0.29],
          [x + d, 3.39, z + 0.29],
          0.055,
          0.056,
          zinc,
        );
    }
  }
  const [a, b] = towers;
  beam(out, 'steel', [a.x, 3.49, a.z], [b.x, 3.49, b.z], 0.52, 0.45, white);
  if (detail > 0) {
    beam(out, 'steel', [a.x + 0.23, 3.13, a.z], [b.x + 0.23, 3.13, b.z], 0.11, 0.096, dark);
    meshPanel(out, [a.x, a.z + 0.5], [-37.9, -18.86], -1.7, 1.82, detail);
    meshPanel(out, [b.x, b.z - 0.5], [-38.65, -14.95], -1.4, 1.82, detail);
  }
}

function streetScaffold(out, detail) {
  if (detail === 0) return;
  box(out, 'wood', [-38.4, 2.87, -10.4], [-35.7, 3.14, 3.8], paleTimber);
  beam(out, 'steel', [-38.42, 3.18, -10.4], [-38.42, 3.18, 3.8], 0.26, 0.19, white);
  if (detail === 1) {
    beam(out, 'steel', [-38.4, 4.05, -10.4], [-38.4, 4.05, 3.8], 0.074, 0.074, white);
    for (const z of [-10.4, -3.3, 3.8])
      beam(out, 'steel', [-38.4, 0.09, z], [-38.4, 4.05, z], 0.104, 0.104, zinc);
  }
  const runs = detail === 1 ? 0 : 8;
  for (let i = 0; i < runs; i++) {
    const z = -10.4 + (14.2 * i) / runs;
    meshPanel(out, [-38.4, z], [-38.4, z + 14.2 / runs], 3.17, 4.09, detail);
    beam(out, 'steel', [-37.99, 0.07, z], [-37.99, 3.1, z], 0.104, 0.104, zinc);
  }
  for (const x of [-35.15, -33.05]) {
    for (const z of [1.57, 4.1]) beam(out, 'steel', [x, 0.12, z], [x, 9.24, z], 0.108, 0.108, zinc);
    if (detail < 2) continue;
    for (let y = 0.26; y + 1.47 < 9.3; y += 1.48) {
      beam(out, 'steel', [x, y, 1.57], [x, y + 1.48, 4.1], 0.051, 0.051, dark);
      beam(out, 'steel', [x, y, 4.1], [x, y + 1.48, 1.57], 0.051, 0.051, zinc);
    }
  }
  for (const z of [1.57, 4.1]) {
    beam(out, 'steel', [-35.15, 9.24, z], [-33.05, 9.24, z], 0.132, 0.132, dark);
  }
  if (detail < 2) return;
  const y = layout.decks[0].y;
  const panelWidth = detail === 2 ? 3.23 : 1.65;
  for (let z = -11.6; z < 17.15; z += panelWidth) {
    const end = Math.min(17.3, z + panelWidth - 0.12);
    meshPanel(out, [-37.14, z], [-37.14, end], y + 0.15, y + 0.93, 1);
    beam(out, 'steel', [-37.18, y + 0.89, z], [-37.18, y + 0.89, end], 0.105, 0.075, vermilion);
  }
}

function build(out, detail) {
  buildConstruction(out, detail, layout);
  greenwichEntrance(out, detail);
  streetScaffold(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
