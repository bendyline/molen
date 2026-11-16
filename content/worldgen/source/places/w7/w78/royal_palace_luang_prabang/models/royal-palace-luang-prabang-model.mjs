/** Haw Kham, the former Royal Palace and present National Museum of Luang Prabang. */
import {
  areaSign,
  block,
  closed,
  edge,
  face,
  pairs,
  palette,
  panel,
  pavilion,
  rect,
  ring,
  shell,
  stairs,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  wall: surface('wall', 'plaster_lime'),
  roof: surface('roof', 'clay_fired'),
  base: surface('foundation', 'stone_ashlar'),
  wood: surface('door', 'wood_plain'),
  gold: surface('trim', 'metal_painted', 0.65, 0.26),
  glass: surface('window', 'window_grid', 0.6),
};
const colors = palette({
  ivory: 'e9e5d5',
  plaster: 'ded8c7',
  shadow: 'c4bcaa',
  terrace: 'c9c4b7',
  footing: 'aba89b',
  roof: '735043',
  red: '865248',
  fascia: '613d38',
  frame: '765748',
  glazing: '4e5c58',
  door: '594034',
  gold: 'bda055',
  brightGold: 'd0ae55',
  pediment: '874938',
});

function roof(out, [x0, z0, x1, z1], eave, ridge, axis, roofColor, lod) {
  const alongX = axis === 'x';
  const lower = alongX ? [z0, x0, z1, x1] : [x0, z0, x1, z1];
  const [left, near, right, far] = lower;
  const mid = (left + right) / 2;
  const run = right - left;
  const p = (u, y, v) => (alongX ? [v, y, u] : [u, y, v]);
  const slopes = [
    [left, left + run * 0.23, mid],
    [right, right - run * 0.23, mid],
  ];
  for (const [side, shoulder, crown] of slopes) {
    const fold = eave + (ridge - eave) * 0.36;
    for (const [a, y0, b, y1] of [
      [side, eave, shoulder, fold],
      [shoulder, fold, crown, ridge],
    ]) {
      face(
        out,
        'roof',
        [p(a, y0, near), p(a, y0, far), p(b, y1, far), p(b, y1, near)],
        [0, 1, 0],
        roofColor,
      );
    }
    if (lod > 0) {
      face(
        out,
        'roof',
        [
          p(side, eave - 0.14, near),
          p(side, eave - 0.14, far),
          p(side, eave, far),
          p(side, eave, near),
        ],
        alongX ? [0, 0, Math.sign(side - mid)] : [Math.sign(side - mid), 0, 0],
        colors.fascia,
      );
    }
  }
  for (const [v, normal] of [
    [near, alongX ? [-1, 0, 0] : [0, 0, -1]],
    [far, alongX ? [1, 0, 0] : [0, 0, 1]],
  ]) {
    face(
      out,
      'wall',
      [p(left, eave, v), p(right, eave, v), p(mid, ridge, v)],
      normal,
      colors.plaster,
    );
    if (lod > 1) {
      for (const u of [left, right]) {
        face(
          out,
          'roof',
          [p(u, eave, v), p(mid, ridge, v), p(mid, ridge - 0.13, v), p(u, eave - 0.15, v)],
          normal,
          colors.fascia,
        );
      }
    }
  }
}

function windows(out, wall, floor, front, lod) {
  const count = Math.max(1, Math.round(wall.length / (front ? 3.85 : 4.1)));
  for (let index = 0; index < count; index++) {
    const center = ((index + 0.5) * wall.length) / count;
    if (front && Math.abs(center - wall.length * 0.5) < 5.4) continue;
    const w = Math.min(front ? 2.47 : 1.76, (wall.length / count) * 0.66);
    const base = floor + 1.05,
      top = floor + (front ? 2.86 : 2.74);
    panel(
      out,
      'wood',
      wall,
      center - w / 2 - 0.105,
      center + w / 2 + 0.105,
      base - 0.11,
      top + 0.11,
      0.026,
      colors.frame,
    );
    panel(out, 'glass', wall, center - w / 2, center + w / 2, base, top, 0.04, colors.glazing);
    if (lod < 2) continue;
    panel(
      out,
      'wall',
      wall,
      center - w / 2 - 0.18,
      center + w / 2 + 0.18,
      base - 0.13,
      base - 0.02,
      0.091,
      colors.ivory,
    );
    for (const offset of [-w / 6, w / 6]) {
      const x = center + offset;
      panel(out, 'wood', wall, x - 0.03, x + 0.03, base, top, 0.059, colors.frame);
    }
  }
}

function entrance(out, plan, grade, lod) {
  const { floor, frontCenter: x, porchFront: z, porchEaves: eave, porchRidge: ridge } = plan;
  const half = 4.45;
  const porch = rect(x - half, 18.9, x + half, z);
  shell(out, porch, () => floor, eave, { wall: 'wall', color: colors.ivory });
  const faceWall = edge([x + half, z], [x - half, z]);
  const center = faceWall.length * 0.5;
  panel(
    out,
    'wood',
    faceWall,
    center - 1.42,
    center + 1.42,
    floor,
    floor + 3.48,
    0.045,
    colors.door,
  );
  panel(
    out,
    'glass',
    faceWall,
    center - 1.24,
    center + 1.24,
    floor + 2.86,
    floor + 3.31,
    0.06,
    colors.glazing,
  );
  const py = eave + 0.41;
  roof(
    out,
    [x - half - 0.24, 17.52, x + half + 0.24, z + 0.44],
    eave,
    ridge,
    'z',
    colors.roof,
    lod,
  );
  face(
    out,
    'wood',
    [
      [x - 3.59, py, z + 0.455],
      [x + 3.59, py, z + 0.455],
      [x, ridge - 0.41, z + 0.455],
    ],
    [0, 0, 1],
    colors.pediment,
  );
  const emblemY = py + 0.39;
  for (const offset of [-1.25, 0, 1.25]) {
    panel(
      out,
      'gold',
      faceWall,
      center + offset - 0.28,
      center + offset + 0.28,
      emblemY,
      emblemY + 0.38,
      0.472,
      colors.gold,
    );
    if (lod > 1) {
      panel(
        out,
        'gold',
        faceWall,
        center + offset - 0.1,
        center + offset + 0.1,
        emblemY - 0.15,
        emblemY + 0.41,
        0.49,
        colors.brightGold,
      );
    }
  }
  panel(
    out,
    'gold',
    faceWall,
    center - 1.99,
    center + 1.99,
    emblemY - 0.17,
    emblemY - 0.08,
    0.478,
    colors.gold,
  );
  for (const offset of [-0.25, 0.07, 0.33]) {
    const width = 0.93 - 0.74 * (offset + 0.25);
    panel(
      out,
      'gold',
      faceWall,
      center - width,
      center + width,
      emblemY + 0.52 + offset,
      emblemY + 0.63 + offset,
      0.478,
      colors.brightGold,
    );
  }
  block(
    out,
    'base',
    x - half - 0.29,
    floor - 0.31,
    z - 0.2,
    2 * half + 0.58,
    0.31,
    0.89,
    colors.terrace,
  );
  stairs(
    out,
    grade,
    'base',
    x - 4.75,
    x + 4.75,
    z + 4.3,
    z + 0.68,
    floor,
    lod === 0 ? 4 : 7,
    colors.terrace,
  );
}

function pinnacle(out, plan, lod) {
  const { frontCenter: x, pinnacleZ: z, pinnacleBase: y, pinnacleTip: top } = plan;
  const sides = [8, 8, 12, 16][lod];
  block(out, 'roof', x - 2.25, y - 2.8, z - 2.2, 4.5, 2.93, 4.4, colors.fascia);
  const profile = [
    [y, 2.32],
    [y + 0.16, 2.25],
    [y + 0.57, 1.71],
    [y + 0.65, 1.9],
    [y + 0.82, 1.82],
    [y + 1.14, 1.36],
    [y + 1.24, 1.53],
    [y + 1.44, 1.49],
    [y + 1.77, 1.09],
    [y + 1.89, 1.18],
    [y + 2.13, 1.08],
    [y + 2.41, 0.77],
    [y + 2.73, 0.59],
    [y + 3.38, 0.42],
    [y + 4.24, 0.31],
    [y + 5.03, 0.18],
    [top - 0.82, 0.13],
    [top - 0.66, 0.19],
    [top - 0.44, 0.13],
    [top - 0.29, 0.12],
    [top, 0.015],
  ];
  const skyline = [
    profile[0],
    profile[2],
    profile[5],
    profile[8],
    profile[11],
    profile[14],
    profile[16],
    profile.at(-1),
  ];
  ring(out, 'gold', [x, z], lod === 0 ? skyline : profile, sides, colors.brightGold);
}

function draw(out, lod, plan, grade) {
  const { footprint, floor, wallEaves } = plan;
  shell(out, footprint, (p) => Math.min(floor - 0.24, grade(p) - 0.27), floor, {
    wall: 'base',
    color: colors.footing,
    roofColor: colors.terrace,
  });
  shell(out, footprint, () => floor, wallEaves, {
    wall: 'wall',
    color: colors.ivory,
    roofColor: colors.plaster,
  });
  const sign = areaSign(footprint);
  for (const [[a, b], i] of pairs(closed(footprint)).map((segment, index) => [segment, index])) {
    const facade = edge(a, b, sign);
    if (facade.length > 6.4) windows(out, facade, floor, i === 10, lod);
    panel(
      out,
      'wall',
      facade,
      0,
      facade.length,
      wallEaves - 0.28,
      wallEaves - 0.08,
      0.045,
      colors.shadow,
    );
  }
  for (const [bounds, ridge, axis] of plan.roofs)
    roof(out, bounds, wallEaves, ridge, axis, colors.roof, lod);
  roof(
    out,
    [-28.32, 15.42, 25.61, 20.93],
    wallEaves - 0.38,
    wallEaves + 1.49,
    'x',
    colors.red,
    lod,
  );
  entrance(out, plan, grade, lod);
  pinnacle(out, plan, lod);
}

const palace = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [41, 25, 65],
    lookAt: [-1, 7, -4],
    yaw: -0.56,
    sun: [240, 460, 415],
    brief:
      'White Royal Palace with formally aligned windows, deep red tiled roofs, a central carved gable, broad marble stair and gold Lao throne-hall spire.',
    views: [
      { name: 'royal-entrance-and-gold-spire', position: [6, 7, 44], lookAt: [-1, 8.2, 11] },
      { name: 'rear-residential-cross-wings', position: [-39, 19, -57], lookAt: [0, 6, -15] },
      { name: 'palace-roof-and-throne-hall', position: [33, 28, 2], lookAt: [-2, 9, 1] },
    ],
  },
  draw,
);

export const { skyline, district, street, closeup } = palace;
export const model = { ...palace.model, category: 'palace-castle-fort' };
