import { readFileSync } from 'node:fs';
import {
  areaSign,
  block,
  closed,
  edge,
  face,
  mix,
  opening,
  pairs,
  palette,
  panel,
  pavilion,
  plane,
  rect,
  shell,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const color = palette({
  masonry: 'ddd8c5',
  foundation: 'b6ae9f',
  trim: 'c1baad',
  warm: 'b4a597',
  roof: '8d8d83',
  roofDark: '797a73',
  glass: '43515a',
  frame: '636660',
  entry: 'bab9aa',
});
const surfaces = {
  wall: surface('wall', 'brick_flemish', 0.92),
  base: surface('foundation', 'concrete_plain', 0.92),
  roof: surface('roof', 'concrete_plain', 0.91),
  trim: surface('trim', 'metal_painted', 0.79, 0.16),
  glass: surface('window', 'storefront', 0.54, 0.04),
};
const up = [0, 1, 0];
const down = [0, -1, 0];

function fascia(out, outline, roof, lod, hue) {
  const orientation = areaSign(outline);
  for (const [a, b] of pairs(closed(outline))) {
    const wall = edge(a, b, orientation);
    const length = wall.length;
    panel(out, 'trim', wall, 0, length, roof - 0.16, roof + 0.19, 0.095, hue);
    if (lod) {
      face(
        out,
        'trim',
        [
          wall.p(0, roof + 0.19),
          wall.p(length, roof + 0.19),
          wall.p(length, roof + 0.19, 0.095),
          wall.p(0, roof + 0.19, 0.095),
        ],
        up,
        hue,
      );
      panel(out, 'trim', wall, 0, length, roof - 0.23, roof - 0.161, 0.064, color.frame);
    }
  }
}

function foundations(out, outline, floor, grade, lod) {
  const orientation = areaSign(outline);
  for (const [a, b] of pairs(closed(outline))) {
    const wall = edge(a, b, orientation);
    const divisions = Math.max(1, Math.ceil(wall.length / (lod > 1 ? 4.8 : 9)));
    const point = (u) => {
      const [x, , z] = wall.p(u, floor);
      return wall.p(u, Math.min(grade([x, z]) - 0.14, floor - 0.23), 0.018);
    };
    for (let i = 0; i < divisions; i++) {
      const l = (i * wall.length) / divisions;
      const r = ((i + 1) * wall.length) / divisions;
      face(
        out,
        'base',
        [point(l), point(r), wall.p(r, floor + 0.22, 0.018), wall.p(l, floor + 0.22, 0.018)],
        wall.normal,
        color.foundation,
      );
    }
  }
}

function leveledRoof(out, outline, floor, roof, grade, lod, tint = color.masonry) {
  shell(out, outline, (p) => Math.min(floor - 0.22, grade(p) - 0.31), roof, {
    wall: 'wall',
    color: tint,
    roof: 'roof',
    roofColor: color.roof,
  });
  fascia(out, outline, roof, lod, color.trim);
}

function galleryMassing(out, d, grade, lod) {
  const floor = d.floorY;
  const galleryOutline = [...d.outline.slice(0, 9), ...d.outline.slice(13)];
  const mainRoof = floor + d.frontWallHeight;
  leveledRoof(out, galleryOutline, floor, mainRoof, grade, lod);
  const rearOutline = rect(-20.85, -7.48, 16.38, -21.13);
  shell(out, rearOutline, () => mainRoof - 0.01, floor + d.rearWallHeight, {
    wall: 'wall',
    color: color.masonry,
    roof: 'roof',
    roofColor: color.roofDark,
  });
  fascia(out, rearOutline, floor + d.rearWallHeight, lod, color.trim);
  const sign = areaSign(d.outline);
  for (const i of [0, 2, 3, 4, 14, 15, 16]) {
    const wall = edge(d.outline[i], d.outline[(i + 1) % d.outline.length], sign);
    if (wall.length < 8.7) continue;
    panel(
      out,
      'trim',
      wall,
      0.23,
      wall.length - 0.23,
      floor + 3.34,
      floor + 3.44,
      0.053,
      color.trim,
    );
    if (lod > 0)
      for (let u = 5.5; u < wall.length - 3.0; u += 5.2) {
        panel(
          out,
          'wall',
          wall,
          u - 0.025,
          u + 0.025,
          floor + 0.22,
          mainRoof - 0.22,
          0.022,
          color.warm,
        );
      }
    if (lod > 1 && i !== 4)
      for (let u = 6; u < wall.length - 3.0; u += 7.25)
        panel(
          out,
          'trim',
          wall,
          u - 0.056,
          u + 0.056,
          floor + 0.28,
          mainRoof - 0.13,
          0.12,
          color.frame,
        );
  }
}

function publicEntry(out, d, grade, lod) {
  const floor = d.floorY;
  const roof = floor + d.entryWallHeight;
  const openingWall = edge(d.outline[10], d.outline[11], areaSign(d.outline));
  const half = openingWall.length * 0.5;
  leveledRoof(out, d.approach, floor, roof, grade, lod, color.entry);
  const front = (d.outline[10][1] + d.outline[11][1]) * 0.5;
  const center = (d.outline[10][0] + d.outline[11][0]) * 0.5;
  opening(
    out,
    openingWall,
    half - 1.68,
    half + 1.68,
    floor + 0.07,
    floor + 2.65,
    'trim',
    color.glass,
    'glass',
    color.frame,
    lod,
    0.031,
  );
  if (lod > 0) {
    for (const x of [-1.1, 0, 1.1])
      panel(
        out,
        'trim',
        openingWall,
        half + x - 0.028,
        half + x + 0.028,
        floor + 0.07,
        floor + 2.65,
        0.061,
        color.frame,
      );
    panel(
      out,
      'trim',
      openingWall,
      half - 1.68,
      half + 1.68,
      floor + 2.12,
      floor + 2.18,
      0.061,
      color.frame,
    );
  }
  const y = roof - 0.18;
  const z = front + 1.58;
  block(out, 'trim', center - 2.72, y, front - 0.17, 5.44, 0.19, 1.83, color.trim);
  if (lod) {
    const under = y - 0.01;
    face(
      out,
      'base',
      [
        [center - 2.7, under, front],
        [center + 2.7, under, front],
        [center + 2.7, under, z],
        [center - 2.7, under, z],
      ],
      down,
      color.entry,
    );
    for (const x of [center - 2.26, center + 2.09]) {
      const base = Math.min(floor, grade([x, z - 0.25]));
      block(out, 'trim', x, base, z - 0.35, 0.16, under - base, 0.18, color.frame);
    }
  }
  const pad = plane(front + 1.65, 1);
  const stepBase = Math.min(grade([center, front + 1.65]), floor - 0.17);
  panel(out, 'base', pad, center - 2.8, center + 2.8, stepBase, floor + 0.035, 0, color.foundation);
  face(
    out,
    'base',
    [
      [center - 2.8, floor + 0.035, front],
      [center + 2.8, floor + 0.035, front],
      [center + 2.8, floor + 0.035, front + 1.65],
      [center - 2.8, floor + 0.035, front + 1.65],
    ],
    up,
    color.foundation,
  );
  if (lod > 1)
    for (const x of [-0.12, 0.12])
      panel(
        out,
        'trim',
        openingWall,
        half + x - 0.018,
        half + x + 0.018,
        floor + 0.89,
        floor + 1.25,
        0.105,
        color.trim,
      );
}

function build(out, lod, d, grade) {
  galleryMassing(out, d, grade, lod);
  publicEntry(out, d, grade, lod);
  foundations(out, d.outline, d.floorY, grade, lod);
  if (lod > 2) {
    const roof = d.floorY + d.frontWallHeight;
    for (const x of [-16, -12.5, -9, -5.5]) {
      const ends = [mix(-6.8, -6.5, (x + 17) / 12), 6.7];
      block(out, 'roof', x, roof + 0.006, ends[0], 0.03, 0.023, ends[1] - ends[0], color.roofDark);
    }
  }
}

const asset = pavilion(
  import.meta.url,
  {
    surfaces,
    brief:
      'The public museum at Fort Bragg, with its low, stepped gallery wings, projecting entrance and independently surveyed irregular footprint.',
    camera: [39, 23, 56],
    lookAt: [0, 2.6, -2.5],
    yaw: 0.62,
    sun: [-310, 480, 590],
    views: [
      { name: 'public-museum-entrance', position: [3.3, 5.2, 44], lookAt: [4, 2.8, 17] },
      { name: 'rooflines-and-gallery-wings', position: [39, 37, 38], lookAt: [1, 2.4, -2] },
      { name: 'measured-rear-outline', position: [-38, 24, -48], lookAt: [1, 2.5, -10] },
      { name: 'entry-pavilion-and-flank', position: [-32, 13, 31], lookAt: [0, 2.3, 7] },
    ],
  },
  build,
);
const frame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
export const { skyline, district, street, closeup } = asset;
export const model = {
  ...asset.model,
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.91,
    basis:
      'Named public museum outline cross-checked against North Carolina surveyed roofline 2787736.',
  },
};
