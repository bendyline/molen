/** Baba Farid's marble tomb chamber, Pakpattan. X faces east and Z faces south. */
import {
  areaSign,
  block,
  closed,
  edge,
  pairs,
  palette,
  panel,
  pavilion,
  rect,
  ring,
  shell,
  surface,
  trimBlock,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  marble: surface('wall', 'stone_marble'),
  trim: surface('trim', 'stone_limestone_raw'),
  base: surface('foundation', 'stone_ashlar'),
  wood: surface('door', 'wood_plain'),
  metal: surface('door', 'metal_painted', 0.68, 0.22),
};
const colors = palette({
  marble: 'ded9cc',
  pale: 'eee7d8',
  joints: 'bfb7a5',
  foundation: 'a69a86',
  stone: 'd0c7b5',
  wood: '554438',
  darkMetal: '6e6760',
  silver: 'aaa197',
  gold: 'a69054',
  ink: '39352f',
});

function doorway(out, wall, plinth, eave, south, lod) {
  const middle = wall.length / 2;
  const halfWidth = south ? 0.53 : 0.61;
  const left = middle - halfWidth;
  const right = middle + halfWidth;
  const top = plinth + (south ? 2.12 : 2.26);
  panel(out, 'marble', wall, 0, left, plinth, eave, 0, colors.marble);
  panel(out, 'marble', wall, right, wall.length, plinth, eave, 0, colors.marble);
  panel(out, 'marble', wall, left, right, top, eave, 0, colors.marble);

  const slot = south ? 'metal' : 'wood';
  const leaf = south ? colors.darkMetal : colors.wood;
  const depth = -0.15;
  panel(out, slot, wall, left, right, plinth, top, depth, leaf);
  for (const [from, to] of [
    [left - 0.13, left],
    [right, right + 0.13],
  ]) {
    trimBlock(out, 'trim', wall, from, to, plinth, top + 0.12, depth, 0.055, colors.pale);
  }
  trimBlock(out, 'trim', wall, left, right, top, top + 0.12, depth, 0.055, colors.pale);
  if (!south) {
    // The survey locates raised dark lettering above this gate. The panel leaves the text abstract.
    panel(out, 'trim', wall, left - 0.13, right + 0.13, top + 0.3, top + 0.58, 0.036, colors.stone);
    panel(
      out,
      'metal',
      wall,
      left + 0.01,
      right - 0.01,
      top + 0.405,
      top + 0.475,
      0.039,
      colors.ink,
    );
  }
  if (lod < 2) return;
  panel(out, slot, wall, middle - 0.017, middle + 0.017, plinth, top, depth + 0.008, colors.ink);
  for (const center of [middle - halfWidth / 2, middle + halfWidth / 2]) {
    const trim = south ? colors.silver : colors.stone;
    for (const rise of [0.2, 1.02, 1.86]) {
      panel(
        out,
        slot,
        wall,
        center - 0.19,
        center + 0.19,
        plinth + rise,
        plinth + rise + 0.038,
        depth + 0.012,
        trim,
      );
    }
    if (lod === 3) {
      for (const side of [-1, 1]) {
        const x = center + side * 0.19;
        panel(
          out,
          slot,
          wall,
          x - 0.016,
          x + 0.016,
          plinth + 0.2,
          plinth + 1.9,
          depth + 0.014,
          trim,
        );
      }
    }
  }
}

function dome(out, lod, base, tip, pinnacle) {
  const sides = [10, 16, 24, 36][lod];
  const rise = tip - base;
  ring(
    out,
    'trim',
    [0, 0],
    [
      [base - 0.14, 2.17],
      [base - 0.04, 2.19],
      [base + 0.09, 2.04],
    ],
    sides,
    colors.stone,
  );
  const silhouette = [
    [0.035, 2.01],
    [0.14, 2.035],
    [0.29, 1.943],
    [0.47, 1.73],
    [0.635, 1.42],
    [0.765, 1.045],
    [0.87, 0.68],
    [0.95, 0.34],
    [1, 0.065],
  ];
  ring(
    out,
    'marble',
    [0, 0],
    silhouette.map(([t, radius]) => [base + rise * t, radius]),
    sides,
    colors.marble,
  );
  ring(
    out,
    'metal',
    [0, 0],
    [
      [tip - 0.04, 0.13],
      [tip + 0.08, 0.115],
      [tip + 0.17, 0.11],
      [tip + 0.29, 0.16],
      [tip + 0.41, 0.1],
      [tip + 0.61, 0.065],
      [pinnacle - 0.2, 0.06],
      [pinnacle - 0.1, 0.1],
      [pinnacle, 0.009],
    ],
    Math.max(8, sides / 2),
    colors.gold,
  );
}

function draw(out, lod, plan, grade) {
  const { footprint, plinth, eave, domeBase, domeTip, pinnacleTop } = plan;
  const base = rect(-2.68, -2.68, 2.68, 2.68);
  shell(out, base, (p) => grade(p) - 0.3, plinth, {
    wall: 'base',
    roof: 'trim',
    color: colors.foundation,
    roofColor: colors.stone,
  });
  const walls = pairs(closed(footprint));
  const sign = areaSign(footprint);
  walls.forEach(([a, b], index) => {
    const wall = edge(a, b, sign);
    if (index === 1 || index === 2) {
      doorway(out, wall, plinth, eave, index === 2, lod);
    } else {
      panel(out, 'marble', wall, 0, wall.length, plinth, eave, 0, colors.marble);
      if (lod > 1) {
        for (const rise of [0.38, 1.74, 3.1]) {
          panel(
            out,
            'trim',
            wall,
            0.035,
            wall.length - 0.035,
            plinth + rise,
            plinth + rise + 0.018,
            0.006,
            colors.stone,
          );
        }
      }
    }
    panel(out, 'trim', wall, 0, wall.length, eave - 0.24, eave - 0.07, 0.031, colors.stone);
  });
  block(out, 'trim', -2.68, eave - 0.07, -2.68, 5.36, 0.22, 5.36, colors.pale);
  dome(out, lod, domeBase, domeTip, pinnacleTop);
}

const shrine = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [13.6, 8.1, 13.2],
    lookAt: [0, 4.4, 0],
    sun: [190, 450, 270],
    yaw: -0.64,
    brief:
      'A small square white marble tomb chamber, with the east Nuri Darwaza, the closed south Bahishti Darwaza and a pointed dome under a slim pinnacle.',
    views: [
      { name: 'nuri-darwaza-east', position: [10.1, 3.6, 1.9], lookAt: [2.5, 3.38, 0] },
      { name: 'bahishti-darwaza-south', position: [1.7, 3.8, 10.9], lookAt: [0, 3.3, 2.5] },
      { name: 'dome-pinnacle', position: [-9, 10.5, -9.5], lookAt: [0, 7.6, 0] },
    ],
  },
  draw,
);

export const { skyline, district, street, closeup } = shrine;
export const model = {
  ...shrine.model,
  category: 'religious',
  sourceLicense:
    'Original geometry derived from the written architectural survey, official monument location and open terrain. Model authorship used no reference images.',
};
