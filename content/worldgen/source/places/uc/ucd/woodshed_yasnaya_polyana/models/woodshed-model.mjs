import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url), 'utf8'));
const frame = read('map-frame.json');
const references = read('reference-observations.json');
const board = [0.71, 0.71, 0.66];
const trim = [0.61, 0.62, 0.57];
const green = [0.12, 0.31, 0.2];
const plinth = [0.53, 0.51, 0.46];
const recess = [0.25, 0.24, 0.21];

const x0 = -2.3;
const x1 = 2.3;
const z0 = -1.85;
const z1 = 1.85;
const wallBase = 0.14;
const boardJoint = 1.43;
const roofY = (x) => 1.86 + ((x - x0) * 1.09) / (x1 - x0);
const vent = { left: 0.49, right: 1.58, sill: 0.41, head: 1.48 };

function wall(out, points, color = board) {
  quad(out, 'boards', points, normalFor(...points.slice(0, 3)), color);
}

function longWall(out, z, detail) {
  const emit = (a, b, lo, hiA, hiB, color) => {
    const points = [
      [a, lo, z],
      [b, lo, z],
      [b, hiB, z],
      [a, hiA, z],
    ];
    wall(out, z > 0 ? points : points.toReversed(), color);
  };
  if (detail < 2) {
    emit(x0, x1, wallBase, roofY(x0), roofY(x1), board);
  } else {
    const count = 30;
    const step = (x1 - x0) / count;
    for (let i = 0; i < count; i++) {
      const a = x0 + step * i;
      const b = a + step;
      const tint = board.map((v) => v * (0.95 + ((i * 7) % 11) * 0.009));
      emit(a, b, wallBase, boardJoint, boardJoint, tint);
      emit(a, b, boardJoint, roofY(a), roofY(b), tint);
      if (detail >= 3 && i > 0) {
        const [c, d] = z > 0 ? [z, z + 0.01] : [z - 0.01, z];
        box(out, 'boards', [a - 0.007, wallBase, c], [a + 0.007, roofY(a) - 0.03, d], trim);
      }
    }
  }
  if (detail > 0) {
    const [c, d] = z > 0 ? [z, z + 0.023] : [z - 0.023, z];
    box(out, 'boards', [x0, boardJoint - 0.014, c], [x1, boardJoint + 0.014, d], trim);
  }
}

function highEnd(out, detail) {
  const { left, right, sill, head } = vent;
  const panel = (a, b, y0, y1) =>
    wall(out, [
      [x1, y0, b],
      [x1, y0, a],
      [x1, y1, a],
      [x1, y1, b],
    ]);
  panel(z0, left, wallBase, roofY(x1));
  panel(right, z1, wallBase, roofY(x1));
  panel(left, right, wallBase, sill);
  panel(left, right, head, roofY(x1));
  box(out, 'boards', [x1 - 0.14, sill, left], [x1 - 0.1, head, right], recess);
  for (const z of [left, right])
    box(
      out,
      'boards',
      [x1 - 0.12, sill - 0.04, z - 0.04],
      [x1 + 0.04, head + 0.04, z + 0.04],
      trim,
    );
  for (const y of [sill, head])
    box(out, 'boards', [x1 - 0.12, y - 0.03, left], [x1 + 0.04, y + 0.03, right], trim);
  const slats = [3, 6, 9, 12][detail];
  const spacing = (head - sill) / slats;
  for (let i = 0; i < slats; i++) {
    const y = sill + i * spacing + spacing / 2;
    const top = [x1 - 0.085, y + spacing * 0.29];
    const bottom = [x1 + 0.006, y - spacing * 0.29];
    wall(
      out,
      [
        [bottom[0], bottom[1], right],
        [bottom[0], bottom[1], left],
        [top[0], top[1], left],
        [top[0], top[1], right],
      ],
      trim,
    );
  }
}

function roof(out, detail) {
  const a = x0 - 0.25;
  const b = x1 + 0.29;
  const c = z0 - 0.21;
  const d = z1 + 0.21;
  const ring = (rise) => [
    [a, roofY(a) + rise, c],
    [a, roofY(a) + rise, d],
    [b, roofY(b) + rise, d],
    [b, roofY(b) + rise, c],
  ];
  const top = ring(0.13);
  const bottom = ring(0).toReversed();
  quad(out, 'roof', top, normalFor(...top.slice(0, 3)), green);
  quad(out, 'boards', bottom, normalFor(...bottom.slice(0, 3)), trim);
  const fascia = ring(0);
  for (const [i, p] of fascia.entries()) {
    const j = (i + 1) % fascia.length;
    const points = [p, fascia[j], top[j], top[i]];
    quad(out, 'roof', points, normalFor(...points.slice(0, 3)), green);
  }
  if (detail < 2) return;
  const seams = detail === 2 ? 5 : 8;
  for (let i = 1; i < seams; i++) {
    const z = c + ((d - c) * i) / seams;
    beam(
      out,
      'roof',
      [a + 0.04, roofY(a + 0.04) + 0.138, z],
      [b - 0.04, roofY(b - 0.04) + 0.138, z],
      0.026,
      0.029,
      green,
    );
  }
}

function build(out, detail) {
  box(out, 'base', [x0 - 0.06, -0.53, z0 - 0.035], [x1 + 0.06, wallBase, z1 + 0.045], plinth);
  longWall(out, z0, detail);
  longWall(out, z1, detail);
  wall(out, [
    [x0, wallBase, z0],
    [x0, wallBase, z1],
    [x0, roofY(x0), z1],
    [x0, roofY(x0), z0],
  ]);
  highEnd(out, detail);
  roof(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);

export const woodshedStudy = {
  id: frame.candidateId,
  title: frame.title,
  category: 'museum',
  wikidataId: frame.wikidataId,
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: buildCloseup,
  brief: references.appearance,
  sourceNotice:
    'Original mesh with shared standing-seam metal, painted timber and weathered stone surfaces. Reference photographs provide geometry and color guidance.',
  sourceFacts: {
    horizontalBasis: frame.identityStatus,
    architecturalHeights: references.dimensions,
  },
  geometrySource: references.appearance,
  limitations: references.limitations,
  nativeAxes: frame.nativeAxes,
  scaleBasis: references.dimensions,
  refs: references.pages,
  sourceScripts: ['models/generate-woodshed.mjs', 'models/woodshed-model.mjs'],
  generationCommand:
    'node content/worldgen/source/places/uc/ucd/woodshed_yasnaya_polyana/models/generate-woodshed.mjs',
  qaCameras: [],
};
