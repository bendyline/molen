import { readFileSync } from 'node:fs';
import {
  abox,
  facade,
  fbox,
  lathe,
  opening,
  quad4,
  rgb,
  roundArch,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const layout = read('native-map/church-of-san-francisco-acatepec-shape-controls');
const [axisX] = layout.naveCentre;
const [domeX, domeZ] = layout.domeCentre;
const front = layout.westFacade;
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96 },
  rubble: { slot: 'wall', graph: 'stone_limestone', roughness: 0.95 },
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.89 },
  terra: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.9 },
  glaze: { slot: 'trim', graph: 'tile_ceramic', roughness: 0.72 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.91 },
  bronze: { slot: 'trim', graph: 'metal_painted', roughness: 0.81 },
  shade: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.87 },
};

const plaster = rgb('e6d9c4');
const lime = rgb('ded7c0');
const rubble = rgb('82776a');
const brick = rgb('b06e4e');
const terra = rgb('bb755b');
const terraLight = rgb('c48669');
const baseStone = rgb('968f78');
const dark = rgb('433f35');
const ochre = rgb('b4a163');
const lightTile = rgb('d5c69a');
const blue = rgb('637897');
const green = rgb('788e70');
const gold = rgb('c6a657');
const colors = [lightTile, blue, gold, green, lime];

function box(out, slot, x0, x1, z0, z1, y0, y1, color) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
}

function vault(out, x, radius, z0, z1, y, rise, level) {
  const count = [4, 8, 12, 16][level];
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * i) / count;
    const b = (Math.PI * (i + 1)) / count;
    const xa = x + radius * Math.cos(a),
      xb = x + radius * Math.cos(b);
    const ya = y + rise * Math.sin(a),
      yb = y + rise * Math.sin(b);
    quad4(out, 'terra', [xa, ya, z0], [xb, yb, z0], [xb, yb, z1], [xa, ya, z1], terraLight);
    quad4(
      out,
      'plaster',
      [xa, ya, z1],
      [xb, yb, z1],
      [xb, y - 0.03, z1],
      [xa, y - 0.03, z1],
      plaster,
    );
    quad4(
      out,
      'plaster',
      [xb, yb, z0],
      [xa, ya, z0],
      [xa, y - 0.03, z0],
      [xb, y - 0.03, z0],
      plaster,
    );
  }
}

function pin(out, x, z, y, r, height, level, color = lime) {
  const sections = [
    [y, r, r],
    [y + height * 0.23, r * 0.85, r * 0.85],
    [y + height * 0.62, r * 0.55, r * 0.55],
    [y + height, 0.02, 0.02],
  ];
  lathe(out, 'stone', [x, z], sections, level >= 2 ? 8 : 4, color);
}

function cross(out, x, z, y, height) {
  box(out, 'bronze', x - 0.06, x + 0.06, z - 0.053, z + 0.053, y, y + height, dark);
  box(
    out,
    'bronze',
    x - height * 0.31,
    x + height * 0.31,
    z - 0.06,
    z + 0.06,
    y + height * 0.6,
    y + height * 0.7,
    dark,
  );
}

function rectangleWindow(out, F, u, y, w, h, level, head = 'flat') {
  opening(out, F, u, y, w, h, {
    head,
    glassSlot: 'shade',
    frameSlot: 'stone',
    glass: dark,
    frame: lime,
    frameWidth: level >= 2 ? 0.13 : 0.075,
    frameDepth: 0.12,
    sill: level > 0,
    d: 0.041,
    mullions: level === 3 && head === 'flat' ? 1 : 0,
  });
}

function nave(out, level) {
  box(out, 'plaster', -11.76, 3.93, -21.18, 14.88, -1.4, 9.43, plaster);
  box(out, 'plaster', -15.46, 8.18, -16.67, -7.24, -1.44, 9.51, plaster);
  box(out, 'rubble', -15.84, -11.64, 7.35, 15.05, -0.7, 5.67, rubble);
  box(out, 'terra', -15.84, -11.63, 7.34, 15.07, 5.64, 5.84, terra);
  box(out, 'plaster', 3.87, 11.71, -17.83, -7.03, -1.36, 6.53, plaster);
  box(out, 'rubble', 7.06, 11.87, -17.91, -6.78, -1.35, 5.61, rubble);
  box(out, 'terra', 6.97, 12.1, -18.06, -6.6, 5.63, 5.96, terraLight);
  box(out, 'terra', -15.49, 8.27, -16.81, -7.15, 9.46, 9.66, terra);
  vault(out, axisX, 7.64, -20.98, 14.55, 9.39, 2.16, level);
  box(out, 'plaster', -10.99, 3.7, -19.92, -19.12, 10.0, 10.65, plaster);
  if (level === 0) return;
  for (const side of [-1, 1]) {
    const wallX = side < 0 ? -11.77 : 3.95;
    const F = facade([wallX, 0], [0, -side]);
    for (const z of [8.0, 1.68, -4.2, -18.46]) {
      const u = -side * z;
      fbox(out, 'plaster', F, u - 0.24, u + 0.24, -0.1, 9.64, -0.12, 0.42, plaster);
      if (level >= 2) {
        rectangleWindow(out, F, u - 1.72, 6.1, 0.84, 1.14, level);
        pin(out, wallX, z, 9.67, 0.25, 1.0, level);
      }
    }
  }
  const F = facade([11.88, -12.16], [0, -1]);
  for (const u of [-2.66, 2.53]) rectangleWindow(out, F, u, 2.03, 1.12, 1.88, level, 'tudor');
}

function lantern(out, x, z, y, r, level) {
  const stages = [
    [y, r, r],
    ...(level > 0 ? [[y + 0.18, r, r]] : []),
    [y + 1.18, r * 0.73, r * 0.73],
    ...(level > 0 ? [[y + 1.32, r * 0.95, r * 0.95]] : []),
    ...(level > 0 ? [[y + 1.62, r * 0.59, r * 0.59]] : []),
    [y + 1.85, 0.12, 0.12],
  ];
  lathe(out, 'glaze', [x, z], stages, 8, lime, { rotation: Math.PI / 8 });
  if (level >= 2) {
    for (let side = 0; side < 8; side++) {
      const a = (side * Math.PI) / 4;
      const d = r * 0.77;
      const F = facade([x + d * Math.cos(a), z + d * Math.sin(a)], [Math.sin(a), -Math.cos(a)]);
      rectangleWindow(out, F, 0, y + 0.29, r * 0.3, 0.78, level, 'round');
    }
  }
  cross(out, x, z, y + 1.85, 0.98);
}

function dome(out, x, z, y, r, rise, level) {
  const n = [6, 12, 24, 32][level],
    m = [3, 5, 8, 12][level];
  const tilt = 1.425;
  const glyph = (a, f, bias = 0) => {
    const phi = tilt * f;
    const radius = r * Math.cos(phi) + bias;
    return [x + radius * Math.cos(a), y + rise * Math.sin(phi), z + radius * Math.sin(a)];
  };
  for (let row = 0; row < m; row++) {
    for (let k = 0; k < n; k++) {
      const a = (2 * Math.PI * k) / n,
        b = (2 * Math.PI * (k + 1)) / n;
      const c = level === 3 && (row + k * 3) % 7 === 0 ? green : lightTile;
      quad4(
        out,
        'glaze',
        glyph(a, row / m),
        glyph(a, (row + 1) / m),
        glyph(b, (row + 1) / m),
        glyph(b, row / m),
        c,
      );
      if (level >= 2 && (k * 8) % n === 0) {
        quad4(
          out,
          'glaze',
          glyph(a - 0.026, row / m, 0.035),
          glyph(a - 0.026, (row + 1) / m, 0.035),
          glyph(a + 0.026, (row + 1) / m, 0.035),
          glyph(a + 0.026, row / m, 0.035),
          gold,
        );
      }
    }
  }
  const tip = r * Math.cos(tilt) * 0.97;
  lathe(
    out,
    'stone',
    [x, z],
    [
      [y + rise * Math.sin(tilt) - 0.045, tip, tip],
      [y + rise, tip, tip],
    ],
    8,
    lime,
  );
  lantern(out, x, z, y + rise - 0.05, Math.max(0.43, tip), level);
}

function crossing(out, level) {
  const r = 4.28;
  const y = 12.16;
  lathe(
    out,
    'glaze',
    [domeX, domeZ],
    [
      [9.7, r, r],
      [10.05, r * 1.04, r * 1.04],
      [y, r, r],
    ],
    8,
    ochre,
    { capTop: false, rotation: Math.PI / 8 },
  );
  lathe(
    out,
    'stone',
    [domeX, domeZ],
    [
      [y - 0.16, r * 1.015, r * 1.015],
      [y + 0.05, r * 1.015, r * 1.015],
    ],
    8,
    lime,
    { capTop: false, rotation: Math.PI / 8 },
  );
  if (level >= 1) {
    for (let side = 0; side < 8; side++) {
      const a = (side * Math.PI) / 4;
      const d = r * Math.cos(Math.PI / 8) + 0.07;
      const F = facade(
        [domeX + d * Math.cos(a), domeZ + d * Math.sin(a)],
        [Math.sin(a), -Math.cos(a)],
      );
      rectangleWindow(out, F, 0, 10.52, 0.86, 1.45, level, 'round');
    }
  }
  dome(out, domeX, domeZ, y, r, 3.5, level);
}

function smallArchStage(out, x, z, r, y, height, level, ornate) {
  const radius = r * 0.5;
  const spring = y + height * 0.64;
  const head = roundArch(radius, level >= 2 ? 8 : 4);
  const points = [
    [x - r, z + r],
    [x + r, z + r],
    [x + r, z - r],
    [x - r, z - r],
  ];
  const fill = ornate ? lime : brick;
  if (level === 0) {
    box(out, 'brick', x - r, x + r, z - r, z + r, y, y + height, ornate ? lightTile : brick);
    return;
  }
  for (let i = 0; i < 4; i++) {
    const [a, b] = [points[i], points[(i + 1) % 4]];
    const F = facade([(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5], [b[0] - a[0], b[1] - a[1]]);
    fbox(out, 'brick', F, -r, r, y, y + height * 0.15, -0.38, 0, brick);
    for (const sign of [-1, 1]) {
      const p = [sign * r, sign * radius].sort((j, k) => j - k);
      fbox(
        out,
        'brick',
        F,
        p[0],
        p[1],
        y + height * 0.15,
        y + height,
        -0.45,
        0,
        ornate ? lightTile : brick,
      );
      fbox(
        out,
        'stone',
        F,
        sign * (r - 0.17) - 0.09,
        sign * (r - 0.17) + 0.09,
        y + 0.08,
        y + height - 0.05,
        -0.02,
        0.17,
        fill,
      );
    }
    for (let j = 1; j < head.length; j++) {
      const [su, sv] = head[j - 1],
        [tu, tv] = head[j];
      quad4(
        out,
        'brick',
        F.P(su, spring + sv),
        F.P(tu, spring + tv),
        F.P(tu, y + height),
        F.P(su, y + height),
        ornate ? lightTile : brick,
      );
      if (level >= 2)
        quad4(
          out,
          'stone',
          F.P(su, spring + sv, 0.04),
          F.P(tu, spring + tv, 0.04),
          F.P(tu * 1.12, spring + tv * 1.12, 0.04),
          F.P(su * 1.12, spring + sv * 1.12, 0.04),
          lime,
        );
    }
  }
}

function band(out, F, x0, x1, y, height, depth, level) {
  fbox(out, 'stone', F, x0, x1, y, y + height, 0.036, depth, lime);
  if (level >= 2) {
    fbox(
      out,
      'glaze',
      F,
      x0 + 0.06,
      x1 - 0.06,
      y + height * 0.27,
      y + height * 0.72,
      depth,
      depth + 0.037,
      blue,
    );
    fbox(
      out,
      'glaze',
      F,
      x0 + 0.07,
      x1 - 0.07,
      y + height * 0.41,
      y + height * 0.54,
      depth + 0.036,
      depth + 0.043,
      gold,
    );
  }
}

function diamond(out, F, x, y, rx, ry, depth, color) {
  quad4(
    out,
    'glaze',
    F.P(x - rx, y, depth),
    F.P(x, y - ry, depth),
    F.P(x + rx, y, depth),
    F.P(x, y + ry, depth),
    color,
  );
}

function paintedField(out, F, x0, x1, y0, y1, depth, level) {
  quad4(
    out,
    'glaze',
    F.P(x0, y0, depth),
    F.P(x1, y0, depth),
    F.P(x1, y1, depth),
    F.P(x0, y1, depth),
    ochre,
  );
  if (level < 2) return;
  const dx = level === 3 ? 0.26 : 0.46;
  const dy = level === 3 ? 0.31 : 0.61;
  let row = 0;
  for (let y = y0 + dy * 0.57; y < y1 - dy * 0.26; y += dy) {
    let col = 0;
    for (let x = x0 + dx * (row % 2 ? 0.81 : 0.53); x < x1 - dx * 0.26; x += dx) {
      diamond(
        out,
        F,
        x,
        y,
        dx * 0.38,
        dy * 0.34,
        depth + 0.01,
        colors[(col + row * 3) % colors.length],
      );
      col++;
    }
    row++;
  }
}

function jamb(out, F, u, y0, y1, depth, level) {
  fbox(out, 'stone', F, u - 0.38, u + 0.38, y0, y0 + 0.31, 0, depth + 0.045, baseStone);
  fbox(out, 'stone', F, u - 0.36, u + 0.36, y1 - 0.36, y1, 0, depth + 0.075, lime);
  fbox(out, 'glaze', F, u - 0.27, u + 0.27, y0 + 0.28, y1 - 0.35, 0.045, depth, lightTile);
  if (level >= 2) {
    for (const factor of [-1, 1]) {
      const x = u + factor * 0.17;
      fbox(out, 'glaze', F, x - 0.048, x + 0.048, y0 + 0.3, y1 - 0.33, depth, depth + 0.037, blue);
    }
    if (level === 3) {
      for (let y = y0 + 0.56; y < y1 - 0.39; y += 0.31)
        diamond(out, F, u, y, 0.117, 0.12, depth + 0.043, y % 0.61 < 0.3 ? gold : green);
    }
  }
}

function facadePortal(out, level) {
  const x = axisX;
  const F = facade([x, front + 0.18], [1, 0]);
  const l = -4.35,
    r = 4.35;
  fbox(out, 'brick', F, l, r, -0.5, 12.27, -0.36, 0.19, brick);
  fbox(out, 'rubble', F, l, r, -0.28, 0.39, 0.05, 0.26, rubble);
  const FF = facade([x, front + 0.392], [1, 0]);
  for (const [lo, hi] of [
    [l + 0.06, -1.48],
    [1.48, r - 0.06],
  ]) {
    paintedField(out, FF, lo, hi, 0.48, 4.9, 0.034, level);
    paintedField(out, FF, lo, hi, 5.26, 8.65, 0.034, level);
    paintedField(out, FF, lo, hi, 9.02, 11.73, 0.034, level);
  }
  for (const [a, b, y] of [
    [l, r, 0.35],
    [l, r, 4.94],
    [l + 0.04, r - 0.04, 8.66],
    [l + 0.19, r - 0.19, 11.82],
  ]) {
    band(out, FF, a, b, y, 0.32, 0.21, level);
  }
  const entrance = facade([x, front + 0.48], [1, 0]);
  opening(out, entrance, 0, 0.27, 2.84, 4.18, {
    head: 'round',
    glassSlot: 'shade',
    frameSlot: 'stone',
    frame: lime,
    glass: dark,
    frameWidth: level >= 2 ? 0.34 : 0.22,
    frameDepth: 0.28,
    sill: false,
  });
  rectangleWindow(out, entrance, 0, 5.95, 1.13, 1.47, level);
  rectangleWindow(out, entrance, 0, 9.18, 1.22, 1.63, level, 'round');
  for (const sign of [-1, 1]) {
    for (const u of [sign * 2.02, sign * 3.83]) {
      jamb(out, FF, u, 0.58, 4.93, 0.24, level);
      if (level > 0) {
        jamb(out, FF, u * 0.98, 5.22, 8.68, 0.19, level);
        jamb(out, FF, u * 0.94, 8.96, 11.82, 0.17, level);
      }
    }
    if (level >= 2) {
      for (const tier of [1.93, 6.23, 9.49])
        rectangleWindow(out, entrance, sign * 2.95, tier, 0.55, 1.26, level, 'round');
    }
  }
  const top = [
    [-4.4, 11.92],
    [-3.5, 12.05],
    [-2.57, 12.25],
    [-1.97, 12.09],
    [-1.46, 12.62],
    [-1.08, 13.01],
    [-0.53, 13.43],
    [0, 13.66],
    [0.53, 13.43],
    [1.08, 13.01],
    [1.46, 12.62],
    [1.97, 12.09],
    [2.57, 12.25],
    [3.5, 12.05],
    [4.4, 11.92],
  ];
  const profile = level === 0 ? top.filter((_, index) => index % 2 === 0) : top;
  for (let i = 1; i < profile.length; i++) {
    const [a, ay] = profile[i - 1],
      [b, by] = profile[i];
    quad4(
      out,
      'brick',
      F.P(a, 11.8, 0.19),
      F.P(b, 11.8, 0.19),
      F.P(b, by, 0.19),
      F.P(a, ay, 0.19),
      brick,
    );
    quad4(
      out,
      'stone',
      F.P(a, ay - 0.2, 0.29),
      F.P(b, by - 0.2, 0.29),
      F.P(b, by + 0.045, 0.29),
      F.P(a, ay + 0.045, 0.29),
      lime,
    );
  }
  if (level >= 1) {
    for (const u of [-3.67, -2.47, 2.47, 3.67])
      pin(out, x + u, front + 0.36, 12.08, 0.19, 0.79, level);
  }
  cross(out, x, front + 0.28, 13.58, 0.98);
}

function towers(out, level) {
  const towers = [
    { p: layout.shortTowerCentre, base: 12.04, radius: 2.18, ornate: false },
    { p: layout.belfryCentre, base: 12.34, radius: 2.4, ornate: true },
  ];
  for (const {
    p: [x, z],
    base,
    radius: r,
    ornate,
  } of towers) {
    box(out, 'brick', x - r, x + r, z - r, z + r, -0.95, base, brick);
    const F = facade([x, z + r], [1, 0]);
    for (const side of [-1, 1])
      paintedField(
        out,
        F,
        side < 0 ? -r + 0.09 : 0.57,
        side < 0 ? -0.57 : r - 0.09,
        0.5,
        base - 0.25,
        0.036,
        level,
      );
    band(out, F, -r - 0.09, r + 0.09, base - 0.26, 0.32, 0.25, level);
    box(
      out,
      'stone',
      x - r - 0.13,
      x + r + 0.13,
      z - r - 0.13,
      z + r + 0.13,
      base + 0.03,
      base + 0.37,
      baseStone,
    );
    const size = r * 0.79,
      height = ornate ? 4.43 : 3.62;
    const y = base + 0.34;
    smallArchStage(out, x, z, size, y, height, level, ornate);
    box(
      out,
      'stone',
      x - size - 0.23,
      x + size + 0.23,
      z - size - 0.23,
      z + size + 0.23,
      y + height - 0.04,
      y + height + 0.29,
      lime,
    );
    if (ornate) {
      smallArchStage(out, x, z, size * 0.81, y + height + 0.26, 2.59, level, true);
      box(
        out,
        'stone',
        x - size * 0.85,
        x + size * 0.85,
        z - size * 0.85,
        z + size * 0.85,
        y + height + 2.75,
        y + height + 3.1,
        lime,
      );
      dome(out, x, z, y + height + 3.0, size * 0.73, 1.48, level);
      if (level >= 2) {
        const bell = [
          [y + 1.18, 0.56, 0.56],
          [y + 1.48, 0.44, 0.44],
          [y + 2.32, 0.28, 0.28],
          [y + 2.47, 0.18, 0.18],
        ];
        lathe(out, 'bronze', [x, z], bell, 8, rgb('6e5d3d'), { capBottom: true });
        box(
          out,
          'bronze',
          x - 0.05,
          x + 0.05,
          z - 0.05,
          z + 0.05,
          y + 2.41,
          y + height + 0.12,
          dark,
        );
      }
    }
    if (level >= 1) {
      for (const dx of [-1, 1])
        for (const dz of [-1, 1])
          pin(
            out,
            x + dx * (size - 0.03),
            z + dz * (size - 0.03),
            y + height + 0.25,
            0.22,
            ornate ? 0.85 : 0.62,
            level,
          );
    }
    if (!ornate) pin(out, x, z, y + height + 0.28, 0.21, 0.65, level);
  }
}

function courtyardRange(out, level) {
  const x0 = 3.57,
    x1 = 20.9,
    z0 = 6.8,
    z1 = 16.0;
  const F = facade([0, z1], [1, 0]);
  fbox(out, 'rubble', F, x0, x1, -1.13, 6.05, -0.54, 0, rubble);
  box(out, 'rubble', x1 - 0.57, x1, z0, z1, -1.08, 6.05, rubble);
  const span = (x1 - x0) / 5;
  if (level === 0) {
    box(out, 'plaster', x0, x1, z0, z1, 2.8, 6.0, plaster);
  } else {
    const inner = facade([0, z0], [-1, 0]);
    const arc = roundArch(span * 0.35, level === 1 ? 4 : 8);
    for (let i = 0; i < 5; i++) {
      const center = -(x0 + (i + 0.5) * span);
      fbox(
        out,
        'plaster',
        inner,
        center - span * 0.5,
        center - span * 0.35,
        -1.05,
        5.96,
        -0.66,
        0,
        plaster,
      );
      fbox(
        out,
        'plaster',
        inner,
        center + span * 0.35,
        center + span * 0.5,
        -1.05,
        5.96,
        -0.66,
        0,
        plaster,
      );
      for (let j = 1; j < arc.length; j++) {
        const [au, ay] = arc[j - 1],
          [bu, by] = arc[j];
        quad4(
          out,
          'plaster',
          inner.P(center + au, 2.96 + ay),
          inner.P(center + bu, 2.96 + by),
          inner.P(center + bu, 5.96),
          inner.P(center + au, 5.96),
          plaster,
        );
      }
    }
  }
  box(out, 'terra', x0 - 0.08, x1 + 0.07, z0 - 0.06, z1 + 0.1, 5.96, 6.24, terra);
  fbox(out, 'stone', F, x0, x1, 6.2, 6.45, 0.011, 0.19, lime);
  if (level > 0) {
    band(out, F, 10.58, 14.41, 3.32, 0.2, 0.38, level);
    rectangleWindow(out, F, 12.49, 3.68, 0.75, 1.19, level);
    for (let u = 4.4; u < x1 - 0.25; u += 1.68) pin(out, u, z1 + 0.09, 6.42, 0.13, 0.48, level);
    rectangleWindow(out, F, 17.75, 1.25, 0.61, 0.83, level);
  }
}

function build(out, level) {
  nave(out, level);
  courtyardRange(out, level);
  crossing(out, level);
  towers(out, level);
  facadePortal(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'church-of-san-francisco-acatepec-model.mjs';
const camera = [-25, 28, 51],
  lookAt = [1.5, 8.6, 0.6];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historic-church',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'San Francisco Acatepec with its tiled Baroque facade, asymmetrical towers, red vault and glazed dome.',
  camera,
  lookAt,
  sunDirection: [-35, 69, 58],
  mediumFiContext: {
    scale: 1.19,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.8,
    basis:
      'The photograph-derived church envelope uses the native mapped enclosure and approach as control points.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'acatepec-atrium', position: camera, lookAt },
    { name: 'talavera-west-front', position: [-5, 6.9, 38.5], lookAt: [-3.95, 8.1, 15.1] },
    { name: 'crossing-dome-and-courtyard', position: [35, 26.5, -12.1], lookAt: [-0.6, 8.4, -2.9] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'church-of-san-francisco-acatepec-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.62,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.26, surfaces },
      street: { export: 'street', errorMeters: 0.078, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.021, surfaces },
    },
  },
};
