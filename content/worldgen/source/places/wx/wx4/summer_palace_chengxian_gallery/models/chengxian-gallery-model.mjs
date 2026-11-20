import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box, tube } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { face, up } from '../../summer_palace/models/summer-palace-model.mjs';

export const surfaces = {
  stone: { slot: 'foundation', graph: 'stone_ashlar' },
  tile: { slot: 'roof', graph: 'tile_ceramic' },
  timber: { slot: 'trim', graph: 'wood_plain' },
};

const { sections, spans } = JSON.parse(
  readFileSync(new URL('../layout.json', import.meta.url), 'utf8'),
);
const grayStone = [0.54, 0.526, 0.48];
const paving = [0.647, 0.63, 0.567];
const charcoal = [0.28, 0.281, 0.265];
const finial = [0.35, 0.34, 0.312];
const vermilion = [0.48, 0.19, 0.139];
const madder = [0.306, 0.119, 0.09];
const paintedGreen = [0.18, 0.348, 0.292];
const darkBlue = [0.132, 0.262, 0.351];
const yellowOchre = [0.61, 0.481, 0.23];

function interpolate(start, end, fraction) {
  return {
    point: start.point.map((value, i) => value + (end.point[i] - value) * fraction),
    normal: start.normal.map((value, i) => value + (end.normal[i] - value) * fraction),
    floor: start.floor + (end.floor - start.floor) * fraction,
  };
}

function pointAt({ point, normal, floor }, across, y) {
  return [point[0] + normal[0] * across, floor + y, point[1] + normal[1] * across];
}

function roofAt(section, side, t, offset = 0) {
  return pointAt(section, side * 1.48 * (1 - t), 2.63 + 0.85 * t * (0.49 + 0.51 * t) + offset);
}

function longitudinalSurfaces(out, start, end, detail) {
  const deck = (section, side, y) => pointAt(section, side * 1.21, y);
  face(
    out,
    'stone',
    [deck(start, -1, 0), deck(end, -1, 0), deck(end, 1, 0), deck(start, 1, 0)],
    paving,
    up,
  );
  face(
    out,
    'stone',
    [deck(start, -1, -1.24), deck(end, -1, -1.24), deck(end, 1, -1.24), deck(start, 1, -1.24)],
    grayStone,
    [0, -1, 0],
  );
  for (const side of [-1, 1]) {
    const outside = [side * start.normal[0], 0, side * start.normal[1]];
    face(
      out,
      'stone',
      [
        deck(start, side, -1.24),
        deck(end, side, -1.24),
        deck(end, side, -0.115),
        deck(start, side, -0.115),
      ],
      grayStone,
      outside,
    );
    face(
      out,
      'stone',
      [
        deck(start, side, -0.115),
        deck(end, side, -0.115),
        deck(end, side, 0),
        deck(start, side, 0),
      ],
      paving,
      outside,
    );
    const courses = detail ? [0, 0.34, 0.67, 1] : [0, 1];
    for (let i = 1; i < courses.length; i++) {
      const lower = courses[i - 1];
      const upper = courses[i];
      face(
        out,
        'tile',
        [
          roofAt(start, side, lower),
          roofAt(end, side, lower),
          roofAt(end, side, upper),
          roofAt(start, side, upper),
        ],
        charcoal,
        up,
      );
      face(
        out,
        'timber',
        [
          roofAt(start, side, lower, -0.076),
          roofAt(end, side, lower, -0.076),
          roofAt(end, side, upper, -0.076),
          roofAt(start, side, upper, -0.076),
        ],
        madder,
        [0, -1, 0],
      );
    }
    // Reuse the shared materials for fascia and the painted pilaster line.
    beam(
      out,
      'timber',
      pointAt(start, side * 1.39, 2.56),
      pointAt(end, side * 1.39, 2.56),
      0.11,
      0.12,
      madder,
    );
    beam(
      out,
      'timber',
      pointAt(start, side * 1.02, 2.44),
      pointAt(end, side * 1.02, 2.44),
      0.12,
      0.19,
      paintedGreen,
    );
  }
  beam(out, 'tile', roofAt(start, 1, 1), roofAt(end, 1, 1), 0.156, 0.172, finial);
}

function finishEnd(out, section, direction) {
  const across = section.normal;
  const outward = [across[1] * direction, 0, -across[0] * direction];
  face(
    out,
    'stone',
    [
      pointAt(section, -1.21, -1.24),
      pointAt(section, 1.21, -1.24),
      pointAt(section, 1.21, 0),
      pointAt(section, -1.21, 0),
    ],
    grayStone,
    outward,
  );
  for (const side of [-1, 1]) {
    const eave = roofAt(section, side, 0);
    const middle = roofAt(section, side, 0.48);
    const ridge = roofAt(section, side, 1);
    beam(out, 'tile', eave, middle, 0.107, 0.118, finial);
    beam(out, 'tile', middle, ridge, 0.107, 0.118, finial);
  }
}

function crossSection(out, section, detail) {
  for (const side of [-1, 1]) {
    const low = pointAt(section, side * 1.01, 0);
    if (detail >= 2) {
      tube(out, 'stone', low, pointAt(section, side * 1.01, 0.13), 0.164, grayStone, 8);
      tube(
        out,
        'timber',
        pointAt(section, side * 1.01, 0.124),
        pointAt(section, side * 1.01, 2.5),
        0.112,
        vermilion,
        detail === 3 ? 10 : 8,
      );
    } else {
      box(
        out,
        'timber',
        [low[0] - 0.103, low[1], low[2] - 0.103],
        [low[0] + 0.103, low[1] + 2.5, low[2] + 0.103],
        vermilion,
      );
    }
  }
  if (!detail) return;
  beam(
    out,
    'timber',
    pointAt(section, -1.04, 2.355),
    pointAt(section, 1.04, 2.355),
    0.138,
    0.235,
    paintedGreen,
  );
  if (detail < 2) return;
  beam(
    out,
    'timber',
    pointAt(section, -0.96, 2.362),
    pointAt(section, 0.96, 2.362),
    0.143,
    0.122,
    darkBlue,
  );
  beam(
    out,
    'timber',
    pointAt(section, -0.28, 2.368),
    pointAt(section, 0.28, 2.368),
    0.148,
    0.072,
    yellowOchre,
  );
}

function bayDetails(out, start, end, detail) {
  const edge = 1.06;
  if (!detail) return;
  // The pavilion-facing length remains traversable between its posts.
  beam(out, 'timber', pointAt(start, edge, 0.63), pointAt(end, edge, 0.63), 0.165, 0.078, madder);
  if (detail < 2) return;
  beam(out, 'timber', pointAt(start, edge, 0.225), pointAt(end, edge, 0.225), 0.069, 0.062, madder);
  beam(
    out,
    'timber',
    pointAt(start, -edge, 2.154),
    pointAt(end, -edge, 2.154),
    0.063,
    0.045,
    madder,
  );
  for (let i = 1; i < 8; i++) {
    const section = interpolate(start, end, i / 8);
    beam(
      out,
      'timber',
      pointAt(section, edge, 0.247),
      pointAt(section, edge, 0.611),
      0.036,
      0.043,
      vermilion,
    );
    if (detail === 3) {
      beam(
        out,
        'timber',
        pointAt(section, -edge, 2.165),
        pointAt(section, -edge, 2.354),
        0.036,
        0.039,
        paintedGreen,
      );
    }
  }
}

function tileRibs(out, start, end, detail) {
  if (detail < 2) return;
  const distance = Math.hypot(end.point[0] - start.point[0], end.point[1] - start.point[1]);
  const count = Math.ceil(distance / (detail === 3 ? 0.255 : 0.445));
  const rows = detail === 3 ? [0, 0.34, 0.67, 1] : [0, 0.22];
  for (let rib = 0; rib < count; rib++) {
    const section = interpolate(start, end, (rib + 0.5) / count);
    for (const side of [-1, 1]) {
      for (let i = 1; i < rows.length; i++) {
        beam(
          out,
          'tile',
          roofAt(section, side, rows[i - 1]),
          roofAt(section, side, rows[i]),
          0.066,
          0.06,
          charcoal,
        );
      }
      if (detail === 3) {
        tube(
          out,
          'tile',
          roofAt(section, side, 0.028),
          roofAt(section, side, -0.024),
          0.038,
          finial,
          6,
        );
      }
    }
  }
}

function build(out, detail) {
  for (const [i, count] of spans.entries()) {
    const start = sections[i];
    const end = sections[i + 1];
    longitudinalSurfaces(out, start, end, detail);
    tileRibs(out, start, end, detail);
    for (let j = 0; j < count; j++) {
      const section = interpolate(start, end, j / count);
      crossSection(out, section, detail);
      bayDetails(out, section, interpolate(start, end, (j + 1) / count), detail);
    }
  }
  crossSection(out, sections.at(-1), detail);
  finishEnd(out, sections[0], -1);
  finishEnd(out, sections.at(-1), 1);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
