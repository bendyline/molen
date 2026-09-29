import { arch, box, colors, facade, framedDeck, gable, profile, tube } from './structure-mesh.mjs';

const C = colors;

function roofPlant(out, w, d, y, count = 4) {
  for (let i = 0; i < count; i++) {
    const x = -w * 0.35 + (i % 3) * w * 0.3;
    const z = -d * 0.2 + Math.floor(i / 3) * d * 0.35;
    box(out, 'trim', [x - 3, y, z - 2], [x + 3, y + 3, z + 2], C.steel);
  }
}

function canopy(out, x0, x1, y, z0, z1, color = C.roof) {
  box(out, 'roof', [x0, y, z0], [x1, y + 1.2, z1], color);
  for (const x of [x0 + 2, x1 - 2])
    for (const z of [z0 + 2, z1 - 2]) tube(out, 'trim', [x, 0, z], [x, y, z], 0.35, C.steel);
}

function parking(out, w, d, h) {
  const floors = 5;
  for (let f = 0; f <= floors; f++) {
    const y = (f * h) / floors;
    box(out, 'foundation', [-w / 2, y, -d / 2], [w / 2, y + 0.7, d / 2], C.concrete);
    if (f < floors)
      for (const x of [-w * 0.45, 0, w * 0.45])
        for (const z of [-d * 0.42, d * 0.42])
          box(out, 'wall', [x - 0.8, y, z - 0.8], [x + 0.8, y + h / floors, z + 0.8], C.concrete);
  }
  for (let f = 0; f < floors; f++)
    tube(
      out,
      'trim',
      [w * 0.26, (f * h) / floors + 0.5, d * 0.28],
      [w * 0.46, ((f + 1) * h) / floors, d * 0.28],
      0.45,
      C.steel,
    );
}

function colonnade(out, width, depth, h, cols = 8) {
  box(out, 'wall', [-width / 2, 0, -depth / 2], [width / 2, h * 0.78, depth / 2], C.stone);
  for (let i = 0; i < cols; i++) {
    const x = -width / 2 + ((i + 0.5) * width) / cols;
    tube(out, 'trim', [x, 0, depth / 2 + 5], [x, h * 0.68, depth / 2 + 5], 0.8, C.paleStone, 8);
  }
  box(
    out,
    'roof',
    [-width / 2 - 3, h * 0.68, -depth / 2 - 2],
    [width / 2 + 3, h * 0.83, depth / 2 + 9],
    C.paleStone,
  );
}

export function buildUrban(out, code, spec) {
  const id = Number(code.slice(1));
  const [w, h, d] = spec.size;
  switch (id) {
    case 1:
      facade(out, w, d, h, C.steel, { floors: 14, cols: 13, glass: C.blueGlass });
      roofPlant(out, w, d, h);
      break;
    case 2: {
      let y = 0;
      for (const scale of [1, 0.82, 0.64, 0.46]) {
        const height = h / 4;
        box(
          out,
          'window',
          [(-w * scale) / 2, y, (-d * scale) / 2],
          [(w * scale) / 2, y + height, (d * scale) / 2],
          C.blueGlass,
        );
        box(
          out,
          'trim',
          [(-w * scale) / 2 - 0.6, y + height - 0.5, (-d * scale) / 2 - 0.6],
          [(w * scale) / 2 + 0.6, y + height, (d * scale) / 2 + 0.6],
          C.steel,
        );
        y += height;
      }
      break;
    }
    case 3:
      box(out, 'foundation', [-w / 2, 0, -d / 2], [w / 2, h, d / 2], C.concrete);
      for (let x = -w / 2 + 4; x < w / 2; x += 9)
        box(out, 'wall', [x - 1, 0, d / 2], [x + 1, h, d / 2 + 2], C.concrete);
      for (let y = 8; y < h; y += 10)
        box(out, 'window', [-w / 2 + 3, y, d / 2 + 0.1], [w / 2 - 3, y + 3, d / 2 + 0.2], C.glass);
      break;
    case 4:
      facade(out, w, d, h, C.brick, { floors: 5, cols: 9 });
      box(out, 'roof', [-w / 2 - 1, h, -d / 2 - 1], [w / 2 + 1, h + 2, d / 2 + 1], C.roof);
      for (let i = 0; i < 4; i++)
        box(
          out,
          'window',
          [-w / 2 + 5 + i * 12, h + 2, -d / 2 + 5],
          [-w / 2 + 10 + i * 12, h + 6, -d / 2 + 10],
          C.glass,
        );
      break;
    case 5:
      box(out, 'wall', [-w / 2, 0, -d / 2], [w / 2, h * 0.22, d / 2], C.stone);
      facade(out, w * 0.53, d * 0.6, h, C.blueGlass, { floors: 16, cols: 7 });
      break;
    case 6:
      facade(out, w, d, h, C.stone, { floors: 7, cols: 9 });
      for (let f = 1; f < 7; f++)
        for (const x of [-w * 0.35, 0, w * 0.35])
          box(
            out,
            'trim',
            [x - 4, (f * h) / 7 - 0.5, d / 2],
            [x + 4, (f * h) / 7, d / 2 + 2],
            C.steel,
          );
      break;
    case 7:
      facade(out, w, d, h, C.paleStone, { floors: 10, cols: 10 });
      canopy(out, -w * 0.22, w * 0.22, 5, d / 2, d / 2 + 10);
      break;
    case 8:
      parking(out, w, d, h);
      break;
    case 9:
      facade(out, w, d, h, C.white, { floors: 6, cols: 13 });
      for (let i = 0; i < 3; i++)
        box(
          out,
          'trim',
          [-w / 2 + 7 + i * 16, h, -d / 2 + 4],
          [-w / 2 + 13 + i * 16, h + 4, -d / 2 + 11],
          C.steel,
        );
      break;
    case 10:
      facade(out, w, d, h, C.concrete, { floors: 6, cols: 12, glass: C.blueGlass });
      roofPlant(out, w, d, h, 8);
      break;
    case 11:
      box(out, 'wall', [-w / 2, 0, -d / 2], [w / 2, h * 0.67, d / 2], C.brick);
      gable(out, -w / 2, w / 2, -d / 2, d / 2, h * 0.67, h * 0.2, C.roof);
      box(out, 'roof', [w * 0.15, 0, -d * 0.6], [w * 0.5, h * 0.6, -d * 0.1], C.stone);
      for (let x = -w / 2 + 6; x < w * 0.1; x += 9)
        box(out, 'window', [x - 2, h * 0.27, d / 2], [x + 2, h * 0.53, d / 2 + 0.08], C.glass);
      break;
    case 12:
      colonnade(out, w, d, h);
      break;
    case 13:
      for (const [x, scale, c] of [
        [-w * 0.24, 0.43, C.steel],
        [0, 0.6, C.paleStone],
        [w * 0.26, 0.38, C.blueGlass],
      ])
        box(
          out,
          'wall',
          [x - (w * scale) / 2, 0, (-d * scale) / 2],
          [x + (w * scale) / 2, h * (0.6 + scale * 0.3), (d * scale) / 2],
          c,
        );
      canopy(out, -w * 0.2, w * 0.2, 8, d * 0.28, d * 0.7, C.white);
      break;
    case 14:
      box(out, 'wall', [-w / 2, 0, -d / 2], [w / 2, h * 0.8, d / 2], C.stone);
      for (let i = 0; i < 5; i++)
        box(
          out,
          'roof',
          [-w / 2 + (i * w) / 5, h * 0.8, -d / 2],
          [-w / 2 + ((i + 1) * w) / 5, h * (0.9 + (i % 2) * 0.04), d / 2],
          C.roof,
        );
      canopy(out, -w * 0.2, w * 0.2, 6, d / 2, d / 2 + 12);
      break;
    case 15:
      box(out, 'wall', [-w / 2, 0, -d / 2], [w / 2, h * 0.35, d / 2], C.stone);
      for (let i = 0; i < 6; i++) {
        const x = -w / 2 + 12 + i * 18;
        arch(out, x, h * 0.35, 9, h * 0.5, -d / 2 + 5, d - 10, 0.5, C.steel);
      }
      for (let z = -d / 2 + 8; z < d / 2; z += 11)
        box(out, 'trim', [-w / 2 + 5, 0, z - 0.2], [w / 2 - 5, 0.2, z + 0.2], C.steel);
      break;
    case 16:
      box(out, 'wall', [-w / 2, 0, -d / 2], [w / 2, h * 0.7, d / 2], C.concrete);
      for (let i = 0; i < 7; i++)
        canopy(
          out,
          -w / 2 + (i * w) / 7,
          -w / 2 + ((i + 1) * w) / 7 - 1,
          h * 0.8,
          d / 2,
          d / 2 + 10,
          C.roof,
        );
      break;
    case 17:
      canopy(out, -w / 2, w / 2, h * 0.8, -d / 2, d / 2, C.roof);
      box(out, 'wall', [w * 0.2, 0, -d / 2], [w / 2, h * 0.65, d / 2], C.stone);
      for (const x of [-w * 0.32, -w * 0.1])
        for (const z of [-d * 0.2, d * 0.2])
          box(out, 'trim', [x - 1, 0, z - 1], [x + 1, 3, z + 1], C.steel);
      break;
    case 18:
      facade(out, w, d, h, C.paleStone, { floors: 7, cols: 16, glass: C.dark });
      canopy(out, -w * 0.2, w * 0.2, 5, d / 2, d / 2 + 9);
      break;
    case 19:
      box(out, 'wall', [-w / 2, 0, -d / 2], [w / 2, h * 0.55, d / 2], C.blueGlass);
      for (let i = 0; i < 8; i++) {
        const x = -w / 2 + 8 + i * 16;
        canopy(out, x, x + 12, h * 0.7, d / 2, d / 2 + 16, C.roof);
      }
      break;
    case 20:
      box(out, 'wall', [-w / 2, 0, -d / 2], [w / 2, h, d / 2], C.stone);
      roofPlant(out, w, d, h, 12);
      for (let x = -w / 2 + 7; x < w / 2; x += 13)
        box(out, 'window', [x - 2, h * 0.66, d / 2], [x + 2, h * 0.72, d / 2 + 0.1], C.dark);
      break;
    default:
      throw new Error(`Missing urban recipe ${code}`);
  }
}

function latticeTower(out, h, span = 14) {
  for (const x of [-span / 2, span / 2])
    for (const z of [-span / 2, span / 2]) {
      tube(out, 'wall', [x, 0, z], [x * 0.32, h, z * 0.32], 0.55, C.steel, 6);
      for (let y = 7; y < h - 10; y += 13) {
        const t = y / h,
          r = (span / 2) * (1 - t) + span * 0.16 * t;
        tube(
          out,
          'trim',
          [Math.sign(x) * r, y, Math.sign(z) * r],
          [-Math.sign(x) * r, y + 12, Math.sign(z) * r],
          0.18,
          C.steel,
          4,
        );
      }
    }
}

export function buildInfrastructure(out, code, spec) {
  const id = Number(code.slice(1));
  const [w, h, d] = spec.size;
  switch (id) {
    case 1:
      profile(
        out,
        [
          [0, 3, 3],
          [h * 0.65, 3, 3, 'wall', C.concrete],
          [h * 0.68, 10, 10, 'foundation', C.white],
          [h * 0.9, 10, 10, 'wall', C.white],
          [h, 7, 7, 'roof', C.roof],
        ],
        24,
      );
      break;
    case 2:
      latticeTower(out, h * 0.75, 19);
      profile(
        out,
        [
          [h * 0.7, 10, 10],
          [h * 0.94, 10, 10, 'wall', C.white],
          [h, 7, 7, 'roof', C.roof],
        ],
        24,
      );
      break;
    case 3:
      profile(
        out,
        [
          [0, w / 2, d / 2],
          [h * 0.7, w / 2, d / 2, 'foundation', C.concrete],
          [h, w * 0.47, d * 0.47, 'roof', C.roof],
        ],
        36,
      );
      break;
    case 4:
      box(out, 'foundation', [-w / 2, 0, -d / 2], [w / 2, h * 0.84, d / 2], C.concrete);
      for (let i = 0; i < 8; i++)
        box(
          out,
          'trim',
          [-w / 2 + 6 + (i * w) / 8, h * 0.84, -d / 2],
          [-w / 2 + 10 + (i * w) / 8, h, d / 2],
          C.stone,
        );
      break;
    case 5:
      box(out, 'wall', [-w / 2, 0, -d / 2], [w / 2, h * 0.75, d / 2], C.stone);
      for (let x = -w / 2 + 7; x < w / 2; x += 12)
        box(out, 'window', [x - 2, h * 0.3, d / 2], [x + 2, h * 0.63, d / 2 + 0.1], C.glass);
      roofPlant(out, w, d, h * 0.75, 8);
      break;
    case 6:
      box(out, 'foundation', [-w / 2, 0, -d / 2], [w / 2, 0.4, d / 2], C.concrete);
      for (let i = 0; i < 7; i++)
        for (let j = 0; j < 4; j++)
          box(
            out,
            'wall',
            [-w / 2 + 8 + i * 13, 0.4, -d / 2 + 8 + j * 13],
            [-w / 2 + 13 + i * 13, 4.8, -d / 2 + 12 + j * 13],
            C.steel,
          );
      for (const x of [-w / 2, w / 2])
        for (let z = -d / 2; z < d / 2; z += 10)
          tube(out, 'trim', [x, 0, z], [x, 5, z], 0.18, C.steel, 5);
      break;
    case 7:
      latticeTower(out, h, 17);
      for (const y of [h * 0.6, h * 0.83]) tube(out, 'trim', [-15, y, 0], [15, y, 0], 0.6, C.steel);
      break;
    case 8:
      tube(out, 'wall', [0, 0, 0], [0, h * 0.82, 0], 2.4, C.white, 12);
      box(out, 'trim', [-4, h * 0.8, -5], [4, h * 0.88, 5], C.steel);
      tube(out, 'trim', [0, h * 0.86, 5], [0, h * 0.86, 8], 1, C.steel, 8);
      for (let i = 0; i < 3; i++) {
        const t = (i * Math.PI * 2) / 3;
        tube(
          out,
          'roof',
          [0, h * 0.86, 8],
          [w * 0.48 * Math.cos(t), h * 0.86 + w * 0.48 * Math.sin(t), 8],
          1.2,
          C.white,
          6,
        );
      }
      break;
    case 9:
      box(out, 'foundation', [-w / 2, 0, -d / 2], [w / 2, 0.4, d / 2], C.concrete);
      for (let j = 0; j < 6; j++)
        for (let i = 0; i < 8; i++)
          box(
            out,
            'roof',
            [-w / 2 + 4 + i * 12, 1, -d / 2 + 4 + j * 10],
            [-w / 2 + 14 + i * 12, 2, -d / 2 + 10 + j * 10],
            C.blueGlass,
          );
      for (let i = 0; i < 4; i++)
        box(
          out,
          'wall',
          [-w / 2 + 12 + i * 22, 0, d / 2 - 10],
          [-w / 2 + 22 + i * 22, 5, d / 2 - 2],
          C.stone,
        );
      break;
    case 10:
      latticeTower(out, h * 0.8, 12);
      tube(out, 'trim', [0, h * 0.8, 0], [0, h, 0], 0.8, C.steel, 8);
      for (let y = h * 0.55; y < h * 0.9; y += h * 0.12)
        for (const z of [-4, 4]) box(out, 'trim', [-4, y, z - 0.4], [4, y + 2, z + 0.4], C.white);
      break;
    case 11:
      profile(
        out,
        [
          [0, 8, 8],
          [h * 0.8, 6, 6, 'wall', C.white],
          [h * 0.86, 8, 8, 'window', C.glass],
          [h, 2, 2, 'roof', C.orange],
        ],
        20,
      );
      for (let i = 0; i < 6; i++) {
        const t = (i * Math.PI) / 3;
        box(
          out,
          'window',
          [6 * Math.cos(t) - 0.6, h * 0.62, 6 * Math.sin(t) - 0.6],
          [6 * Math.cos(t) + 0.6, h * 0.72, 6 * Math.sin(t) + 0.6],
          C.glass,
        );
      }
      break;
    case 12:
      for (const x of [-w * 0.4, w * 0.4]) {
        tube(out, 'wall', [x, 0, -d * 0.35], [x, h, -d * 0.35], 1.4, C.orange, 8);
        tube(out, 'wall', [x, 0, d * 0.35], [x, h, d * 0.35], 1.4, C.orange, 8);
      }
      box(out, 'trim', [-w * 0.45, h * 0.8, -d * 0.4], [w * 0.45, h * 0.86, d * 0.4], C.orange);
      tube(out, 'trim', [0, h * 0.82, 0], [0, h * 0.3, d * 0.45], 0.8, C.orange);
      break;
    case 13:
      for (const x of [-w * 0.45, w * 0.45])
        for (const z of [-d * 0.42, d * 0.42])
          tube(out, 'wall', [x, 0, z], [x, h, z], 1.2, C.orange, 8);
      box(out, 'trim', [-w * 0.48, h * 0.84, -d * 0.45], [w * 0.48, h * 0.9, d * 0.45], C.orange);
      box(out, 'trim', [-w * 0.4, h * 0.66, -d * 0.45], [w * 0.4, h * 0.71, d * 0.45], C.orange);
      break;
    case 14:
      for (let x = -w / 2 + 11; x < w / 2; x += 23)
        profile(
          out,
          [
            [0, 10, 10],
            [h * 0.86, 10, 10, 'wall', C.concrete],
            [h, 8, 8, 'roof', C.roof],
          ],
          16,
          [x, 0],
        );
      break;
    case 15:
      framedDeck(out, w, d, h * 0.8, C.steel);
      for (let x = -w / 2 + 15; x < w / 2; x += 40)
        box(out, 'foundation', [x - 2, 0, -d * 0.4], [x + 2, h * 0.8, d * 0.4], C.concrete);
      break;
    case 16:
      for (const x of [-w * 0.43, w * 0.43]) tube(out, 'wall', [x, 0, 0], [x, h, 0], 0.8, C.steel);
      tube(out, 'trim', [-w * 0.45, h * 0.83, 0], [w * 0.45, h * 0.83, 0], 0.7, C.steel);
      for (let i = 0; i < 4; i++)
        box(
          out,
          'trim',
          [-w * 0.3 + i * w * 0.2, h * 0.72, 0],
          [-w * 0.3 + i * w * 0.2 + 2, h * 0.8, 1],
          C.dark,
        );
      break;
    case 17:
      framedDeck(out, w, d, h * 0.75, C.concrete);
      for (const x of [-w * 0.4, w * 0.4])
        tube(out, 'foundation', [x, 0, 0], [x, h * 0.75, 0], 1.2, C.steel);
      for (const z of [-d * 0.4, d * 0.4])
        tube(out, 'trim', [-w / 2, h * 0.75, z], [w / 2, h * 0.75, z], 0.5, C.steel);
      break;
    case 18:
      for (const z of [-d * 0.43, d * 0.05])
        box(out, 'foundation', [-w / 2, 0, z], [w / 2, h, z + d * 0.34], C.concrete);
      box(out, 'roof', [-w / 2, h, -d / 2], [w / 2, h + 1, d / 2], C.road);
      for (const z of [-d * 0.48, d * 0.45]) {
        arch(out, 0, h * 0.18, w * 0.38, h * 0.7, z, 0, 0.7, C.steel, 12);
        for (const x of [-w * 0.42, w * 0.42])
          tube(out, 'trim', [x, 0, z], [x, h, z], 0.6, C.steel);
      }
      break;
    case 19:
      box(out, 'foundation', [-w / 2, 0, -d / 2], [w / 2, 2, d / 2], C.concrete);
      for (const z of [-d / 2, d / 2 - 5])
        box(out, 'foundation', [-w / 2, 2, z], [w / 2, h * 0.75, z + 5], C.concrete);
      box(out, 'roof', [-w / 2 + 5, 2.1, -d / 2 + 5], [w / 2 - 5, 2.3, d / 2 - 5], C.blueGlass);
      for (const x of [-w * 0.3, w * 0.3]) {
        for (const z of [-d * 0.35, d * 0.35])
          box(out, 'wall', [x - 2, 2, z - 2], [x + 2, h, z + 2], C.steel);
        tube(out, 'trim', [x, 2, -d * 0.32], [x, h * 0.7, 0], 0.45, C.steel);
        tube(out, 'trim', [x, 2, d * 0.32], [x, h * 0.7, 0], 0.45, C.steel);
      }
      break;
    case 20:
      latticeTower(out, h * 0.8, 20);
      box(out, 'roof', [-11, h * 0.76, -11], [11, h * 0.81, 11], C.roof);
      box(out, 'wall', [-8, h * 0.81, -8], [8, h * 0.91, 8], C.stone);
      gable(out, -10, 10, -10, 10, h * 0.91, h * 0.09, C.roof);
      break;
    default:
      throw new Error(`Missing infrastructure recipe ${code}`);
  }
}
