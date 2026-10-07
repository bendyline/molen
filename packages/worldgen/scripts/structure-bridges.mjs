import { arch, box, colors, framedDeck, profile, quad, tube } from './structure-mesh.mjs';

const C = colors;

/**
 * Documented paint of each suspension bridge, linear RGB for COLOR_0. A generic recipe must not
 * repaint a known structure (medium-fi style guide): only the Golden Gate is International
 * Orange, and that bridge has its own builder.
 */
const PAINT = {
  6: [0.114, 0.212, 0.125], // Tacoma Narrows: Narrows green
  // biome-ignore lint/suspicious/noApproximativeNumericConstant: a paint channel, not log10(e)
  7: [0.386, 0.418, 0.434], // Bay Bridge west span: silver grey
  8: [0.791, 0.799, 0.768], // Bay Bridge east span: white self-anchored tower
  10: [0.205, 0.323, 0.462], // Manhattan Bridge: light blue
  11: [0.392, 0.063, 0.045], // Williamsburg Bridge: red
  15: [0.275, 0.376, 0.328], // Akashi Kaikyō: grey green
};

function suspension(
  out,
  length,
  width,
  { twin = false, stone = false, truss = false, height = 155, paint = C.steel } = {},
) {
  const deck = 34,
    tx = length * 0.29;
  const metal = stone ? C.steel : paint;
  framedDeck(out, length, width, deck);
  for (const x of [-tx, tx]) {
    for (const z of [-width * 0.42, width * 0.42]) {
      box(
        out,
        stone ? 'foundation' : 'wall',
        [x - 5, 0, z - 3],
        [x + 5, height, z + 3],
        stone ? C.stone : metal,
      );
      box(
        out,
        'trim',
        [x - 6, height * 0.56, z - 4],
        [x + 6, height * 0.59, z + 4],
        stone ? C.paleStone : metal,
      );
    }
    box(
      out,
      'trim',
      [x - 5, height * 0.82, -width * 0.43],
      [x + 5, height * 0.85, width * 0.43],
      metal,
    );
  }
  const cableY = (x) => {
    const a = Math.abs(x);
    return a < tx
      ? 56 + (height - 56) * (a / tx) ** 2
      : height - ((height - 45) * (a - tx)) / (length / 2 - tx);
  };
  for (const z of [-width * 0.4, width * 0.4]) {
    for (let x = -length / 2; x < length / 2; x += 20) {
      const next = Math.min(length / 2, x + 20);
      tube(out, 'wall', [x, cableY(x), z], [next, cableY(next), z], 0.7, metal, 5);
    }
    for (let x = -length / 2 + 32; x < length / 2; x += 32)
      tube(out, 'trim', [x, deck + 1, z], [x, cableY(x), z], 0.12, metal, 4);
  }
  if (truss)
    for (let x = -length / 2; x < length / 2 - 25; x += 25)
      for (const z of [-width * 0.48, width * 0.48])
        tube(out, 'trim', [x, deck - 9, z], [x + 25, deck - 2, z], 0.3, metal, 4);
  if (twin) {
    // Parallel crossing behind the primary deck, visible from a three-quarter view.
    for (const z of [-width * 1.7, -width * 0.7])
      box(
        out,
        'roof',
        [-length / 2, deck - 1, z],
        [length / 2, deck + 0.5, z + width * 0.25],
        C.road,
      );
  }
}

function floating(out, length, width, draw = false) {
  const deck = 9;
  framedDeck(out, length, width, deck);
  const count = Math.max(10, Math.round(length / 105));
  const step = length / count;
  for (let i = 0; i < count; i++) {
    const x0 = -length / 2 + i * step + 0.5;
    box(out, 'foundation', [x0, 0, -width * 0.3], [x0 + step - 1, 4, width * 0.3], C.concrete);
  }
  for (const z of [-width * 0.58, width * 0.58])
    for (let x = -length / 2 + 25; x < length / 2; x += 85)
      box(out, 'foundation', [x - 16, 0, z - 5], [x + 16, 2.8, z + 5], C.paleStone);
  if (draw) {
    box(out, 'trim', [-23, deck + 1.3, -width / 2], [-20, deck + 13, width / 2], C.steel);
    box(out, 'trim', [20, deck + 1.3, -width / 2], [23, deck + 13, width / 2], C.steel);
    tube(out, 'trim', [-20, deck + 13, -width / 2], [0, deck + 21, -width / 2], 0.5, C.steel);
    tube(out, 'trim', [20, deck + 13, width / 2], [0, deck + 21, width / 2], 0.5, C.steel);
  }
}

function cantilever(out, length, width) {
  framedDeck(out, length, width, 45);
  for (const z of [-width * 0.46, width * 0.46]) {
    for (let x = -length / 2; x < length / 2 - 50; x += 50) {
      const tall = 30 + 43 * (1 - Math.abs(x) / (length / 2));
      tube(out, 'wall', [x, 44, z], [x + 25, tall + 44, z], 1.5, C.orange);
      tube(out, 'wall', [x + 25, tall + 44, z], [x + 50, 44, z], 1.5, C.orange);
      tube(out, 'trim', [x, 44, z], [x + 50, 44, z], 0.8, C.orange);
      tube(out, 'trim', [x + 25, tall + 44, z], [x + 25, 36, z], 0.45, C.orange);
    }
  }
  for (const x of [-length * 0.32, 0, length * 0.32])
    box(out, 'foundation', [x - 8, 0, -width * 0.55], [x + 8, 43, width * 0.55], C.stone);
}

function archBridge(out, length, width, stone = false, multiple = false) {
  const deck = stone ? 23 : 73,
    color = stone ? C.stone : C.steel;
  framedDeck(out, length, width, deck, stone ? C.stone : C.road);
  const arches = multiple ? Math.max(3, Math.round(length / 105)) : 1;
  const span = length / arches;
  for (let a = 0; a < arches; a++) {
    const cx = -length / 2 + (a + 0.5) * span;
    for (const z of [-width * 0.4, width * 0.4]) {
      arch(out, cx, 4, span * 0.47, deck - 9, z, 0, stone ? 2.5 : 1.5, color, 16);
      for (let i = 0; i <= 8; i++) {
        const x = cx - span * 0.45 + i * span * 0.1125;
        const t = Math.abs(x - cx) / (span * 0.47);
        const y = 4 + (deck - 9) * Math.sqrt(Math.max(0, 1 - t * t));
        tube(out, 'trim', [x, y, z], [x, deck - 2, z], stone ? 0.7 : 0.35, color, 5);
      }
    }
  }
}

function cableStay(out, length, width, pylons = 2) {
  const deck = 42,
    height = 170;
  framedDeck(out, length, width, deck);
  for (let i = 0; i < pylons; i++) {
    const x = pylons === 1 ? 0 : -length * 0.3 + (i * length * 0.6) / (pylons - 1);
    for (const z of [-width * 0.4, width * 0.4]) {
      tube(out, 'wall', [x - 6, 0, z], [x, height, z], 2.3, C.white, 8);
      tube(out, 'wall', [x + 6, 0, z], [x, height, z], 2.3, C.white, 8);
      for (let j = 1; j <= 9; j++) {
        const reach = (j * length) / (pylons * 24);
        for (const side of [-1, 1])
          tube(
            out,
            'trim',
            [x, height - j * 8, z],
            [x + side * reach, deck + 1, z],
            0.2,
            C.steel,
            5,
          );
      }
    }
  }
}

function inhabited(out, length, width, shops = true) {
  archBridge(out, length, width, true, true);
  if (shops) {
    for (let x = -length / 2 + 12; x < length / 2 - 12; x += 18) {
      const c = x % 36 < 18 ? C.stone : C.paleStone;
      box(out, 'wall', [x, 23, -width * 0.53], [x + 14, 33, -width * 0.25], c);
      box(out, 'wall', [x, 23, width * 0.25], [x + 14, 33, width * 0.53], c);
      box(out, 'roof', [x - 1, 33, -width * 0.55], [x + 15, 35, -width * 0.23], C.roof);
      box(out, 'roof', [x - 1, 33, width * 0.23], [x + 15, 35, width * 0.55], C.roof);
    }
  }
}

export function buildBridge(out, code, spec) {
  const id = Number(code.slice(1));
  const length = spec.size[0],
    width = spec.size[2];
  if ([3, 4, 5].includes(id)) return floating(out, length, width, id === 5);
  if ([6, 7, 8, 9, 10, 11, 15].includes(id))
    return suspension(out, length, width, {
      twin: id === 6 || id === 7,
      stone: id === 9,
      truss: id === 11 || id === 8,
      height: id === 15 ? 250 : id === 9 ? 90 : 170,
      ...(PAINT[id] !== undefined ? { paint: PAINT[id] } : {}),
    });
  switch (id) {
    case 12:
      for (const [x0, x1] of [
        [-length / 2, -13],
        [13, length / 2],
      ]) {
        box(out, 'foundation', [x0, 20, -width / 2], [x1, 21, width / 2], C.stone);
        box(out, 'roof', [x0, 21, -width / 2], [x1, 22, width / 2], C.road);
      }
      for (const x of [-length * 0.31, length * 0.31]) {
        for (const z of [-width * 0.42, width * 0.42]) {
          box(out, 'wall', [x - 7, 0, z - 5], [x + 7, 53, z + 5], C.stone);
          profile(
            out,
            [
              [53, 8, 7],
              [68, 0.5, 0.5, 'roof', C.roof],
            ],
            8,
            [x, z],
          );
          for (const y of [25, 38])
            box(out, 'window', [x - 2, y, z + 5.01], [x + 2, y + 5, z + 5.12], C.glass);
        }
        box(out, 'trim', [x - 8, 47, -width / 2], [x + 8, 50, width / 2], C.paleStone);
      }
      for (const z of [-width * 0.42, width * 0.42])
        box(out, 'trim', [-length * 0.31, 51, z - 1], [length * 0.31, 53, z + 1], C.steel);
      for (const side of [-1, 1]) {
        const a = side < 0 ? -13 : 13,
          b = side < 0 ? 0 : 0;
        quad(
          out,
          'roof',
          [
            [a, 22, -width / 2],
            [a, 22, width / 2],
            [b, 34, width / 2],
            [b, 34, -width / 2],
          ],
          [0, 1, 0],
          C.road,
        );
        for (const z of [-width / 2, width / 2])
          tube(out, 'trim', [a, 22, z], [b, 34, z], 0.5, C.steel, 6);
      }
      break;
    case 13:
      cantilever(out, length, width);
      break;
    case 14:
      archBridge(out, length, width);
      break;
    case 16:
      cableStay(out, length, width, 5);
      break;
    case 17:
      inhabited(out, length, width, true);
      break;
    case 18:
      inhabited(out, length, width, true);
      break;
    case 19:
      inhabited(out, length, width, false);
      break;
    case 20:
      cableStay(out, length, width, 2);
      break;
    default:
      throw new Error(`Missing bridge ${code}`);
  }
}
