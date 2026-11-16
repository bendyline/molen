/** Plaster and tiled walls with the mapped outer gate interruptions. */
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const tint = {
  plaster: rgb('daceb0'),
  course: rgb('eee1c7'),
  roof: rgb('586369'),
  roofEnd: rgb('4b5458'),
  stone: rgb('a99d87'),
  timber: rgb('736754'),
};
const mix = (a, b, t) => a + (b - a) * t;
const at = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t)];

function wallPiece(out, a, b, ground, high, lod) {
  const length = Math.hypot(a[0] - b[0], a[1] - b[1]);
  const edge = transform(out, -Math.atan2(b[1] - a[1], b[0] - a[0]), [a[0], 0, a[1]]);
  const aY = ground(a),
    bY = ground(b);
  const endpoints = [0, length];
  for (const side of [-1, 1]) {
    const low = [
      [0, aY - 0.64, side * 0.42],
      [length, bY - 0.64, side * 0.42],
    ];
    const top = [
      [0, aY + high, side * 0.34],
      [length, bY + high, side * 0.34],
    ];
    const front = (slot, pts, color) => face(edge, slot, side < 0 ? pts.toReversed() : pts, color);
    front('plaster', [...low, top[1], top[0]], tint.plaster);
    const curb = [
      [0, aY + 0.34, side * 0.425],
      [length, bY + 0.34, side * 0.425],
    ];
    if (lod > 0) front('stone', [...low, curb[1], curb[0]], tint.stone);
    if (lod > 1)
      for (const h of lod === 3 ? [0.82, 1.28, 1.74, 2.2, 2.66] : [1.74])
        front(
          'plaster',
          [
            [0, aY + h, side * 0.393],
            [length, bY + h, side * 0.393],
            [length, bY + h + 0.039, side * 0.393],
            [0, aY + h + 0.039, side * 0.393],
          ],
          tint.course,
        );
    const tile = [
      [0, aY + high - 0.04, side * 0.78],
      [length, bY + high - 0.04, side * 0.78],
      [length, bY + high + 0.42, 0],
      [0, aY + high + 0.42, 0],
    ];
    front('tile', tile, tint.roof);
  }
  if (lod > 0)
    for (const [i, x] of endpoints.entries()) {
      const y = i === 0 ? aY : bY;
      const p = [
        [x, y + high - 0.045, -0.78],
        [x, y + high - 0.045, 0.78],
        [x, y + high + 0.42, 0],
      ];
      triangle(edge, 'tile', i === 1 ? p.toReversed() : p, tint.roofEnd);
    }
  if (lod > 2)
    for (let i = 0; i < length; i += 6.4) {
      const y = mix(aY, bY, i / length);
      box(
        edge,
        'timber',
        [i - 0.052, y + 0.07, -0.413],
        [i + 0.052, y + high - 0.13, 0.413],
        tint.timber,
      );
    }
}

export function buildPalacePerimeter(out, { bounds, gates, ground }, lod) {
  const { west, east, north, south, cornerClip, height } = bounds;
  const courses = [
    { edge: 'north', a: [west, north], b: [east - cornerClip, north], axis: 0 },
    { edge: 'south', a: [east, south], b: [west, south], axis: 0 },
    { edge: 'east', a: [east, north + cornerClip], b: [east, south], axis: 1 },
    { edge: 'west', a: [west, south], b: [west, north], axis: 1 },
    { edge: 'corner', a: [east - cornerClip, north], b: [east, north + cornerClip], axis: 0 },
  ];
  for (const { edge, a, b, axis } of courses) {
    const total = b[axis] - a[axis];
    const gaps = gates
      .filter((g) => g.edge === edge)
      .map(({ center, width }) => {
        const t = (center[axis] - a[axis]) / total,
          half = (width * 0.435) / Math.abs(total);
        return [Math.max(0, t - half), Math.min(1, t + half)];
      })
      .sort(([u], [v]) => u - v);
    let cursor = 0;
    const spans = [];
    for (const [start, end] of gaps) {
      if (start > cursor) spans.push([cursor, start]);
      cursor = Math.max(cursor, end);
    }
    if (cursor < 1) spans.push([cursor, 1]);
    for (const [start, end] of spans) {
      const length = Math.hypot(a[0] - b[0], a[1] - b[1]) * (end - start);
      const n =
        lod === 0 ? 1 : Math.max(1, Math.ceil(length / (lod === 1 ? 52 : lod === 2 ? 22 : 14)));
      for (let i = 0; i < n; i++)
        wallPiece(
          out,
          at(a, b, mix(start, end, i / n)),
          at(a, b, mix(start, end, (i + 1) / n)),
          ground,
          height,
          lod,
        );
    }
  }
}
