import controls from '../plan-controls.json' with { type: 'json' };
import {
  areaSign,
  block,
  closed,
  edge,
  face,
  mix,
  palette,
  pairs,
  panel,
  pavilion,
  rect,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  concrete: surface('wall', 'concrete_plain'),
  footing: surface('foundation', 'concrete_plain'),
  glass: surface('window', 'window_punched', 0.47, 0.06),
  aluminum: surface('trim', 'metal_painted', 0.69, 0.14),
  roof: surface('roof', 'concrete_plain', 0.86),
};
const C = palette({
  panel: 'b5ad9d',
  trim: 'c3bdaa',
  shadow: '7e8479',
  glint: 'a8ae9e',
  glass: '597072',
  base: '8d8c80',
  roof: '9c9e93',
  corner: 'ddd2b6',
  flat: 'a39c8b',
  mullion: '8e978b',
});

const levelHeights = [
  0.28, 5.2, 9.28, 13.3, 17.05, 20.85, 24.45, 27.97, 31.75, 35.35, 38.95, 42.55, 46.15, 49.75,
  53.35, 57.05, 61.15, 65.25,
];

function verticals(out, wall, left, right, low, high, count, offset, width, color) {
  for (let i = 1; i < count; i++) {
    const x = mix(left, right, i / count);
    panel(out, 'aluminum', wall, x - width / 2, x + width / 2, low, high, offset, color);
  }
}

function podium(out, outline, grade, lod) {
  const eave = levelHeights[8];
  const frontage = pairs(closed(outline));
  const sign = areaSign(outline);
  shell(out, outline, (p) => grade(p) - 0.27, eave, {
    wall: 'concrete',
    color: C.panel,
    roof: 'roof',
    roofColor: C.roof,
  });
  for (const [[a, b], index] of frontage.map((p, i) => [p, i])) {
    const wall = edge(a, b, sign);
    const l = wall.length;
    const left = l < 12 ? 0.42 : 1.25;
    const right = l - left;
    panel(out, 'aluminum', wall, 0, l, eave - 0.6, eave + 0.45, 0.11, C.trim);
    panel(out, 'aluminum', wall, 0, l, 12.93, 13.47, 0.08, C.trim);
    panel(out, 'aluminum', wall, 0, l, 24.15, 24.61, 0.08, C.trim);
    for (const f of [0, 1, 2, 6, 7]) {
      const base = levelHeights[f];
      const top = levelHeights[f + 1];
      const highwaySide = index === 0 || index === 1;
      const from = f === 0 ? base + 0.29 : base + 0.62;
      const to = top - (f >= 6 ? 0.59 : 0.46);
      const openBand = f < 3 && highwaySide ? 'glass' : 'aluminum';
      panel(out, openBand, wall, left, right, from, to, 0.09, f >= 6 ? C.shadow : C.glass);
      if (lod >= 2) {
        const divisions = Math.max(2, Math.round((right - left) / (lod === 2 ? 4.2 : 2.2)));
        verticals(out, wall, left, right, from, to, divisions, 0.13, 0.12, C.glint);
      }
      if (lod === 3 && f >= 6)
        for (let j = 1; j <= 4; j++) {
          const y = mix(from, to, j / 5);
          panel(out, 'aluminum', wall, left, right, y, y + 0.065, 0.16, C.mullion);
        }
    }
    if (lod >= 1 && index < 2) {
      const bays = Math.max(3, Math.round(l / 5.9));
      verticals(out, wall, 0, l, 0.3, 13.07, bays, 0.2, 0.46, C.corner);
      for (const f of [1, 2]) {
        panel(
          out,
          'aluminum',
          wall,
          0.18,
          l - 0.18,
          levelHeights[f] - 0.18,
          levelHeights[f] + 0.16,
          0.19,
          C.trim,
        );
      }
    }
    if (lod >= 2 && l >= 20) {
      const field = index === 0 ? [l * 0.17, l * 0.45] : [l * 0.58, l * 0.82];
      panel(out, 'aluminum', wall, field[0], field[1], 14.2, 23.95, 0.13, C.flat);
      verticals(out, wall, field[0], field[1], 14.23, 23.89, lod === 2 ? 4 : 8, 0.17, 0.12, C.trim);
    }
  }
  if (lod > 0) {
    const [a, b] = frontage[0];
    const street = edge(a, b, sign);
    const u = street.length * 0.57;
    const lower = 4.12;
    const upper = 4.49;
    face(
      out,
      'aluminum',
      [
        street.p(u - 5.4, upper),
        street.p(u + 5.4, upper),
        street.p(u + 5.4, upper, 2.7),
        street.p(u - 5.4, upper, 2.7),
      ],
      up,
      C.trim,
    );
    panel(out, 'aluminum', street, u - 5.4, u + 5.4, lower, upper, 2.7, C.corner);
    for (const offset of [-4.9, 4.9]) {
      const [x, , z] = street.p(u + offset, 0, 2.36);
      const bottom = grade([x, z]) - 0.12;
      block(out, 'footing', x - 0.22, bottom, z - 0.22, 0.44, lower - bottom, 0.44, C.trim);
    }
  }
}

function tower(out, outline, top, lod) {
  const ground = levelHeights[8];
  shell(out, outline, () => ground - 0.14, levelHeights.at(-1), {
    wall: 'concrete',
    color: C.panel,
    roof: 'roof',
    roofColor: C.roof,
  });
  for (const [index, [a, b]] of pairs(closed(outline)).entries()) {
    const wall = edge(a, b);
    const l = wall.length;
    const end = index === 0 || index === 2 ? 1.58 : 1.16;
    const y = levelHeights.at(-1);
    panel(out, 'aluminum', wall, 0, l, y - 0.81, y + 0.3, 0.15, C.corner);
    for (let i = 8; i < levelHeights.length - 1; i++) {
      const floor = levelHeights[i];
      const ceiling = levelHeights[i + 1];
      panel(out, 'glass', wall, end, l - end, floor + 0.64, ceiling - 0.39, 0.075, C.glass);
      if (lod >= 2) {
        const count = Math.max(3, Math.round((l - end * 2) / (lod === 2 ? 3.3 : 1.66)));
        verticals(
          out,
          wall,
          end,
          l - end,
          floor + 0.57,
          ceiling - 0.32,
          count,
          0.13,
          0.105,
          C.mullion,
        );
      }
      if (lod >= 1)
        panel(
          out,
          'aluminum',
          wall,
          end - 0.17,
          l - end + 0.17,
          ceiling - 0.39,
          ceiling - 0.25,
          0.115,
          C.trim,
        );
    }
    const divisions = index % 2 === 0 ? 5 : 4;
    if (lod > 0) verticals(out, wall, 0, l, ground, y - 0.81, divisions, 0.19, 0.44, C.corner);
  }
  block(out, 'concrete', -10.7, 65.21, -8.1, 21.4, top - 65.21, 17, C.trim);
  if (lod > 0) block(out, 'roof', -11.2, top - 0.6, -8.5, 22.4, 0.61, 17.8, C.roof);
}

function draw(out, lod, { outline, approximateTopMeters }, grade) {
  podium(out, outline, grade, lod);
  const left = Math.min(...outline.map((p) => p[0])) + 5.5;
  const right = Math.max(...outline.map((p) => p[0])) - 5.4;
  const front = Math.min(...outline.map((p) => p[1])) + 3.9;
  const back = Math.max(...outline.map((p) => p[1])) - 5.6;
  tower(out, rect(left, front, right, back), approximateTopMeters, lod);
}

const headquarters = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [77, 51, 96],
    lookAt: [0, 27, 0],
    yaw: 0.68,
    sun: [325, 570, 490],
    brief:
      'The 17-level PGGMB Building on Jalan Kianggeh, with street podium and an upper office tower.',
    views: [
      { name: 'kianggeh-approach', position: [53, 22, 75], lookAt: [0, 28, 0] },
      { name: 'retail-entry-and-commercial-podium', position: [5, 10, 66], lookAt: [0, 10, 15] },
      { name: 'upper-office-floors-and-roofline', position: [72, 68, -62], lookAt: [1, 48, 0] },
      { name: 'mapped-footprint-and-tower', position: [-27, 145, 35], lookAt: [0, 21, -1] },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = headquarters;
export const model = {
  ...headquarters.model,
  category: 'office',
  buildingCutout: {
    outline: controls.dimensions.outline,
    minimumCoverage: 0.85,
    basis: 'Replace the generic mapped PGGMB footprint beneath the placed tower.',
  },
  sourceLicense:
    'Independent exterior geometry from the named map, existing terrain and written primary building records.',
};
