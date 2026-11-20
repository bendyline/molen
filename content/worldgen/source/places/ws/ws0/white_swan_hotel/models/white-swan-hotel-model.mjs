import controls from '../plan-controls.json' with { type: 'json' };
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  block,
  closed,
  edge,
  face,
  mix,
  pairs,
  palette,
  panel,
  pavilion,
  planarMid,
  rect,
  ring,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  facing: surface('wall', 'concrete_plain', 0.91),
  mullion: surface('trim', 'metal_painted', 0.78, 0.15),
  stone: surface('foundation', 'stone_granite', 0.93),
  roof: surface('roof', 'concrete_plain', 0.94),
  glass: surface('window', 'window_grid', 0.43, 0.17),
  door: surface('door', 'window_punched', 0.5),
};
const C = palette({
  white: 'd0cfc1',
  pearl: 'd8d6c9',
  cool: 'bec3ba',
  shadow: '9b9b90',
  terrace: 'b6b3a4',
  roof: 'bdbbad',
  stone: '8c8d84',
  glass: '667475',
  blue: '637679',
  brightGlass: '849090',
  trim: 'adad9f',
  cap: 'aeb5ae',
});
const baseRoof = 11.84;
const overhang = 0.21;

function volume(out, slot, shape, low, high, tint, topSlot = 'roof') {
  shell(out, shape, () => low, high, {
    wall: slot,
    roof: topSlot,
    color: tint,
    roofColor: tint,
  });
}

function podium(out, lod, d, grade) {
  const outline = d.outline;
  const dir = areaSign(outline);
  shell(out, outline, (p) => Math.min(-0.23, grade(p) - 0.48), 0.72, {
    wall: 'stone',
    roof: 'roof',
    color: C.stone,
    roofColor: C.terrace,
  });
  volume(out, 'facing', outline, 0.68, baseRoof, C.pearl);
  for (const [a, b] of pairs(closed(outline))) {
    const w = edge(a, b, dir);
    if (w.length < 1.9) continue;
    const onRiver = (a[1] + b[1]) / 2 > 17;
    const side = onRiver ? C.cool : C.pearl;
    panel(out, 'facing', w, 0, w.length, baseRoof - 0.75, baseRoof + 0.56, overhang, side);
    if (w.length < 4.7) continue;
    const levels = [
      [1.47, 3.74],
      [4.57, 6.96],
      [8.03, 10.46],
    ];
    if (lod < 2) {
      for (const [low, high] of levels) {
        const pad = Math.min(w.length * 0.14, 0.55);
        panel(out, 'glass', w, pad, w.length - pad, low, high, overhang + 0.02, C.glass);
      }
      if (lod === 1)
        for (const [low, high] of [
          [3.67, 4.06],
          [6.93, 7.27],
        ])
          panel(out, 'facing', w, 0, w.length, low, high, overhang + 0.11, C.white);
      continue;
    }
    const count = Math.max(1, Math.round(w.length / (onRiver ? 4.1 : 4.7)));
    const bay = w.length / count;
    for (let i = 0; i < count; i++) {
      const l = i * bay;
      const r = l + bay;
      const pier = onRiver ? 0.27 : 0.41;
      const slot = i % 7 === 3 ? 'door' : 'glass';
      for (const [low, high] of levels) {
        panel(
          out,
          slot,
          w,
          l + pier,
          r - pier,
          low,
          high,
          0.062,
          i % 7 === 3 ? C.brightGlass : C.glass,
        );
        if (lod === 3) {
          const m = (l + r) / 2;
          panel(out, 'mullion', w, m - 0.038, m + 0.038, low, high, 0.093, C.trim);
          panel(out, 'mullion', w, l + pier, r - pier, high - 0.055, high, 0.094, C.trim);
        }
      }
      if (onRiver && lod === 3)
        trimBlock(out, 'facing', w, l + 0.09, l + pier, 0.78, baseRoof - 0.7, 0.0, 0.34, C.white);
    }
    for (const [low, high] of [
      [3.83, 4.13],
      [7.07, 7.46],
    ])
      trimBlock(out, 'facing', w, 0, w.length, low, high, 0, onRiver ? 0.62 : 0.31, side);
  }
}

function tower(out, lod, d) {
  const shape = d.parts.tower;
  const dir = areaSign(shape);
  const bottom = baseRoof - 0.15;
  const height = d.towerWallHeight;
  volume(out, 'facing', shape, bottom, height, C.white);
  const rows = 26;
  const pitch = (height - bottom - 1.19) / rows;
  for (const [[a, b], faceIndex] of pairs(closed(shape)).map((pair, i) => [pair, i])) {
    const w = edge(a, b, dir);
    const narrow = w.length < 13;
    const count = Math.max(2, Math.round(w.length / (narrow ? 4.45 : 3.89)));
    const spacing = w.length / count;
    for (let i = 0; i < rows; i++) {
      const y = bottom + 0.62 + i * pitch;
      if (lod === 0) {
        if (!narrow)
          panel(
            out,
            'glass',
            w,
            0.35,
            w.length - 0.35,
            y + 0.86,
            y + 2.44,
            0.024,
            narrow ? C.cool : C.glass,
          );
        continue;
      }
      for (let j = 0; j < count; j++) {
        const l = j * spacing + 0.3;
        const r = (j + 1) * spacing - 0.21;
        const low = y + 0.67;
        const high = Math.min(y + 2.41, y + pitch - 0.31);
        const side = faceIndex % 2 === 0 ? -1 : 1;
        if (lod === 1 || narrow) {
          const tint = (j + i * 2 + faceIndex) % 11 < 2 ? C.brightGlass : C.glass;
          panel(out, 'glass', w, l, r, low, high, 0.047, tint);
          continue;
        }
        const outerLeft = side > 0 ? 0.14 : 0.67;
        const outerRight = side > 0 ? 0.67 : 0.14;
        const nl = l + 0.18;
        const nr = r - 0.07;
        const yl = low - 0.035;
        const p = (u, v, z) => w.p(u, v, z);
        face(
          out,
          'glass',
          [
            p(nl, low, outerLeft),
            p(nr, low, outerRight),
            p(nr, high, outerRight),
            p(nl, high, outerLeft),
          ],
          w.normal,
          (i + j + faceIndex) % 13 < 2 ? C.brightGlass : C.blue,
        );
        face(
          out,
          'facing',
          [p(l, yl, 0), p(r, yl, 0), p(r, yl, outerRight + 0.14), p(l, yl, outerLeft + 0.14)],
          up,
          C.pearl,
        );
        if (lod === 3) {
          const across = [-w.normal[2], 0, w.normal[0]];
          for (const [u, depth, n] of [
            [l, outerLeft, across],
            [r, outerRight, across.map((x) => -x)],
          ])
            face(
              out,
              'facing',
              [
                p(u, yl, 0),
                p(u, yl, depth + 0.13),
                p(u, high + 0.01, depth + 0.13),
                p(u, high + 0.01, 0),
              ],
              n,
              C.white,
            );
          face(
            out,
            'mullion',
            [
              p(l, yl - 0.2, outerLeft + 0.14),
              p(r, yl - 0.2, outerRight + 0.14),
              p(r, yl + 0.11, outerRight + 0.14),
              p(l, yl + 0.11, outerLeft + 0.14),
            ],
            w.normal,
            C.cool,
          );
        }
      }
    }
    panel(out, 'facing', w, 0, w.length, height - 0.57, height + 0.84, 0.12, C.pearl);
  }
}

function roof(out, lod, d) {
  const { tower, crown, cupola, mast } = d.parts;
  volume(out, 'facing', crown, d.towerWallHeight - 0.08, d.crownHeight, C.pearl);
  volume(out, 'facing', cupola, d.crownHeight - 0.06, d.fittingHeight, C.cap);
  const [cx, cz] = planarMid(mast);
  ring(
    out,
    'mullion',
    [cx, cz],
    [
      [d.fittingHeight - 0.05, 0.14],
      [d.fittingHeight + 1.5, 0.125],
      [d.mastHeight, 0.06],
    ],
    lod === 0 ? 4 : 6,
    C.cap,
  );
  if (lod > 0) {
    const dir = areaSign(crown);
    for (const [a, b] of pairs(closed(crown))) {
      const w = edge(a, b, dir);
      panel(
        out,
        'facing',
        w,
        0,
        w.length,
        d.crownHeight - 0.44,
        d.crownHeight + 0.31,
        0.095,
        C.white,
      );
      if (w.length > 12) {
        for (const h of [92.42, 93.06, 93.7, 94.34])
          panel(out, 'mullion', w, 3.6, w.length - 3.6, h, h + 0.24, 0.052, C.shadow);
      }
    }
  }
  if (lod > 1) {
    const center = planarMid(tower);
    block(
      out,
      'roof',
      center[0] + 21.4,
      d.towerWallHeight,
      center[1] - 4.88,
      5.33,
      1.7,
      5.4,
      C.roof,
    );
    block(
      out,
      'roof',
      center[0] - 26.8,
      d.towerWallHeight,
      center[1] - 3.03,
      5.33,
      1.4,
      4.8,
      C.roof,
    );
  }
}

function entrance(out, lod, d, grade) {
  const p = d.parts.skylight;
  const rim = 10.96;
  volume(out, 'facing', p, rim - 0.32, rim + 0.02, C.trim);
  const [x, z] = planarMid(p);
  const peak = rim + 1.36;
  const center = [x, peak, z];
  for (const [a, b] of pairs(closed(p))) {
    const w = edge(a, b, areaSign(p));
    face(
      out,
      'glass',
      [[a[0], rim + 0.035, a[1]], [b[0], rim + 0.035, b[1]], center],
      up,
      C.brightGlass,
    );
    if (lod > 0) {
      beamPath(
        out,
        'mullion',
        [
          [a[0], rim + 0.06, a[1]],
          [b[0], rim + 0.06, b[1]],
        ],
        0.095,
        0.12,
        C.trim,
      );
      for (const k of lod === 3 ? [0, 0.25, 0.5, 0.75] : [0, 0.5])
        beamPath(
          out,
          'mullion',
          [w.p(w.length * k, rim + 0.055), [x, peak + 0.025, z]],
          0.077,
          0.095,
          C.trim,
        );
    }
  }
  const forecourt = rect(-8.22, -43.04, 12.19, -24.82);
  volume(out, 'stone', forecourt, 3.88, 4.84, C.stone);
  volume(out, 'facing', rect(-7.45, -38.12, 11.23, -24.59), 8.04, 8.71, C.pearl);
  const cols = lod === 0 ? [-6.06, 9.83] : [-6.06, 0.2, 4.47, 9.83];
  for (const a of cols) {
    const b = -36.83;
    const ground = Math.min(4.76, grade([a, b]) - 0.22);
    block(out, 'stone', a - 0.7, ground, b - 0.57, 1.4, 8.06 - ground, 1.14, C.cool);
  }
  if (lod > 0) {
    const w = edge([12.15, -43.05], [-8.18, -43.05]);
    for (const [a, b] of [
      [0.19, 5.2],
      [15.28, 20.08],
    ]) {
      panel(out, 'glass', w, a, b, 4.9, 5.76, 0.062, C.brightGlass);
      panel(out, 'mullion', w, a, b, 5.73, 5.8, 0.094, C.trim);
    }
  }
}

function build(out, lod, d, grade) {
  podium(out, lod, d, grade);
  tower(out, lod, d);
  roof(out, lod, d);
  entrance(out, lod, d, grade);
}

const hotel = pavilion(
  import.meta.url,
  {
    surfaces,
    brief:
      'The White Swan Hotel on Shamian Island, with the riverfront podium, angular pale tower, repeating oblique guestroom bays, stepped roof equipment and antenna.',
    camera: [182, 106, 240],
    lookAt: [0, 37, 3],
    yaw: 0.55,
    sun: [325, 620, 470],
    views: [
      {
        name: 'pearl-river-podium-and-angular-tower',
        position: [130, 52, 212],
        lookAt: [0, 39, 10],
      },
      { name: 'raised-entrance-and-glass-skylight', position: [-12, 20, -71], lookAt: [0, 8, -29] },
      { name: 'oblique-bays-and-stepped-crown', position: [-108, 119, 109], lookAt: [0, 76, -3] },
    ],
  },
  build,
);
export const { model, skyline, district, street, closeup } = hotel;
model.category = 'hotel';
model.buildingCutout = {
  outline: controls.dimensions.outline,
  minimumCoverage: 0.9,
  basis: 'Replace the named White Swan podium and overlapping hotel tower footprints only.',
};
