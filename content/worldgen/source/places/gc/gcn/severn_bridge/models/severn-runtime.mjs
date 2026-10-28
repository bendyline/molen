/** Analytic near geometry; no reduction of kilometre-long cables or thin rail meshes. */
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  box,
  quad,
  tube,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import {
  buildSevernAnchorage,
  buildSevernTower,
  severnCableY as cableY,
  severnDeckRing as deckRing,
  severnDeckY as deckY,
} from './severn-bridge-model.mjs';

export {
  buildSevernDistrict,
  buildSevernSkyline,
} from '../../../../../../../../packages/worldgen/scripts/severn-browser-model.mjs';

const end = 798.75,
  tower = 493.75,
  white = [0.8, 0.82, 0.79],
  edge = [0.7, 0.74, 0.73],
  cable = [0.58, 0.63, 0.64],
  steel = [0.41, 0.48, 0.5],
  asphalt = [0.16, 0.175, 0.18],
  path = [0.39, 0.41, 0.4],
  mark = [0.82, 0.83, 0.76];
function strip(out, a, b, z0, z1, h, color) {
  quad(
    out,
    'road',
    [
      [a, deckY(a) + h, z1],
      [b, deckY(b) + h, z1],
      [b, deckY(b) + h, z0],
      [a, deckY(a) + h, z0],
    ],
    [0, 1, 0],
    color,
  );
}
function build(out, close) {
  const n = close ? 128 : 64,
    stations = Array.from({ length: n + 1 }, (_, i) => -end + (i * 2 * end) / n);
  loft(out, 'wall', stations.map(deckRing), white);
  for (const sign of [-1, 1]) {
    const z0 = sign < 0 ? -16 : 10.1,
      z1 = sign < 0 ? -10.1 : 16;
    loft(
      out,
      'wall',
      stations.map((x) => {
        const y = deckY(x);
        return [
          [x, y + 0.12, z0],
          [x, y + 0.12, z1],
          [x, y - 0.2, z1],
          [x, y - 1.04, (z0 + z1) / 2],
          [x, y - 0.2, z0],
        ];
      }),
      white,
    );
  }
  for (let i = 0; i < n; i++) {
    const a = stations[i],
      b = stations[i + 1];
    strip(out, a, b, -9.7, 9.7, 0.04, asphalt);
    strip(out, a, b, -0.5, 0.5, 0.065, path);
    for (const sign of [-1, 1])
      strip(out, a, b, sign < 0 ? -15.85 : 10.2, sign < 0 ? -10.2 : 15.85, 0.14, path);
    for (const z of [-8.95, -0.86, 0.86, 8.95]) strip(out, a, b, z - 0.07, z + 0.07, 0.065, mark);
  }
  for (let x = -end + 2; x < end - 2; x += 12)
    for (const z of [-4.6, 4.6]) strip(out, x, x + 4, z - 0.075, z + 0.075, 0.07, mark);
  const railSegments = close ? 32 : 16;
  for (let i = 0; i < railSegments; i++) {
    const a = -end + (i * 2 * end) / railSegments,
      b = -end + ((i + 1) * 2 * end) / railSegments;
    for (const sign of [-1, 1]) {
      for (const h of [0.64, 1.28])
        beam(
          out,
          'metal',
          [a, deckY(a) + h, sign * 15.9],
          [b, deckY(b) + h, sign * 15.9],
          0.065,
          0.08,
          edge,
        );
      beam(
        out,
        'metal',
        [a, deckY(a) + 0.85, sign * 9.6],
        [b, deckY(b) + 0.85, sign * 9.6],
        0.12,
        0.32,
        edge,
      );
      beam(
        out,
        'metal',
        [a, deckY(a) + 0.76, sign * 0.43],
        [b, deckY(b) + 0.76, sign * 0.43],
        0.09,
        0.27,
        edge,
      );
    }
  }
  // Sub-pixel far pickets drop out; near copies retain actual height and a bounded spacing.
  for (let x = -end + 0.3; x < end; x += close ? 2 : 16)
    for (const sign of [-1, 1]) {
      const y = deckY(x),
        z = sign * 15.9;
      box(out, 'metal', [x - 0.022, y + 0.2, z - 0.024], [x + 0.022, y + 1.28, z + 0.024], edge);
    }
  for (let x = -end + 6; x < end; x += close ? 12 : 48)
    for (const sign of [-1, 1])
      beam(
        out,
        'wall',
        [x, deckY(x) - 2.6, sign * 8.2],
        [x, deckY(x) - 0.3, sign * 15.7],
        0.13,
        0.22,
        edge,
      );
  for (const sign of [-1, 1]) {
    buildSevernTower(out, sign * tower, { details: close });
    buildSevernAnchorage(out, sign);
  }
  for (const z of [-11.75, 11.75]) {
    for (const [a, b] of [
      [-end, -tower],
      [-tower, tower],
      [tower, end],
    ]) {
      const count = Math.ceil((b - a) / (close ? 18 : 40));
      for (let i = 0; i < count; i++) {
        const x = a + ((b - a) * i) / count,
          X = a + ((b - a) * (i + 1)) / count;
        if (close) tube(out, 'cable', [x, cableY(x), z], [X, cableY(X), z], 0.25, cable, 8);
        else beam(out, 'cable', [x, cableY(x), z], [X, cableY(X), z], 0.5, 0.5, cable);
      }
    }
    for (const [a, b, count] of [
      [-end, -tower, 16],
      [-tower, tower, 54],
      [tower, end, 16],
    ]) {
      const margin = (b - a - (count - 1) * 18.288) / 2;
      for (let i = 0; i < count; i++) {
        const x = a + margin + i * 18.288,
          y = cableY(x),
          offset = Math.min(9.144, (y - 0.43 - deckY(x) - 0.43) * Math.tan((35 * Math.PI) / 180));
        if (close)
          box(out, 'metal', [x - 0.22, y - 0.45, z - 0.17], [x + 0.22, y - 0.15, z + 0.17], steel);
        for (const direction of [-1, 1]) {
          let X = x + direction * offset;
          if (Math.abs(Math.abs(X) - tower) < 3.2)
            X = Math.sign(X) * (tower + (Math.abs(x) < tower ? -3.2 : 3.2));
          const p = [x + direction * 0.11, y - 0.43, z],
            q = [X, deckY(X) + 0.43, z];
          if (close) {
            tube(out, 'cable', p, q, 0.025, cable, 6);
            box(
              out,
              'metal',
              [X - 0.12, q[1] - 0.28, z - 0.09],
              [X + 0.12, q[1] + 0.08, z + 0.09],
              edge,
            );
          } else beam(out, 'cable', p, q, 0.05, 0.05, cable);
        }
      }
    }
  }
}
export function buildSevernStreet(out) {
  build(out, false);
}
export function buildSevernCloseup(out) {
  build(out, true);
}
