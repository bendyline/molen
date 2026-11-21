import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  block,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  pairs,
  palette,
  panel,
  plane,
  shell,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const { dimensions: d } = plan;
const terrain = floorSampler(read('terrain-grid.json'));
const colors = palette({
  render: 'd3c7ad',
  pale: 'd8d1bb',
  light: 'e5d9bd',
  trim: 'aa9476',
  frame: '795745',
  darkTimber: '675243',
  red: 'a1493d',
  glass: '5b6157',
  glassLight: '768179',
  stucco: 'b5ada0',
  foundation: 'a59b87',
  slate: '576268',
  slateLight: '647075',
  ridge: '4d565a',
  copper: '667768',
  deepCopper: '536750',
  greenTrim: '596653',
  lake: '606964',
  brick: '925c4e',
  roofMembrane: '717571',
  modern: 'b5afa3',
});
const surfaces = {
  walls: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.91 },
  base: surface('foundation', 'stone_ashlar', 0.94),
  roof: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 0.87 },
  wood: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.86 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.46, metallic: 0.05 },
  metal: surface('trim', 'metal_painted', 0.81, 0.16),
  brick: surface('wall', 'brick_flemish', 0.92),
};

function rotated(center, angle) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return (u, y, v) => [center[0] + c * u - s * v, y, center[1] + s * u + c * v];
}

function hipRoof(
  out,
  { center, width, depth, angle = 0, eaves, top, tint = colors.slate, hip = 0.37 },
  level,
) {
  const point = rotated(center, angle);
  const perimeter =
    level === 0
      ? [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ]
      : [
          [-1, -1],
          [0, -1],
          [1, -1],
          [1, 0],
          [1, 1],
          [0, 1],
          [-1, 1],
          [-1, 0],
        ];
  const profile = level === 0 ? [0, 1] : level === 1 ? [0, 0.46, 1] : [0, 0.22, 0.53, 0.78, 1];
  const rings = profile.map((t) => {
    const w = (width / 2) * (1 - hip * t);
    const length = mix(depth / 2, 0.1, t);
    return perimeter.map(([x, z], i) =>
      point(
        x * w,
        eaves +
          (top - eaves) * (0.69 * t + 0.31 * t * t) +
          (level > 0 && i % 2 === 0 ? 0.27 * (1 - t) : 0),
        z * length,
      ),
    );
  });
  for (const [ring, high] of pairs(rings)) {
    for (let i = 0; i < ring.length; i++) {
      const j = (i + 1) % ring.length;
      const a = ring[i],
        b = ring[j],
        c = high[j],
        d = high[i];
      face(out, 'roof', [a, b, c], [0, 1, 0], tint);
      face(out, 'roof', [a, c, d], [0, 1, 0], tint);
    }
  }
  if (level >= 1) {
    const a = point((-width * (1 - hip)) / 2, top + 0.02, 0),
      b = point((width * (1 - hip)) / 2, top + 0.02, 0);
    beam(
      out,
      'roof',
      a,
      b,
      0.31,
      0.29,
      tint === colors.copper || tint === colors.deepCopper ? colors.deepCopper : colors.ridge,
    );
  }
  if (level >= 2) {
    const eave = rings[0];
    for (const [p, q] of pairs(closed(eave))) {
      const low = ([x, y, z]) => [x, y - 0.13, z];
      beam(out, 'wood', low(p), low(q), 0.15, 0.14, colors.darkTimber);
    }
    const rank = level === 2 ? 8 : 14;
    for (const side of [-1, 1]) {
      for (let j = 1; j < rank; j++) {
        const u = -0.5 + j / rank;
        const p = point(width * u, eaves + 0.07, side * (depth / 2 - 0.13));
        const q = point(width * u * 0.9, eaves + (top - eaves) * 0.29 + 0.085, side * depth * 0.3);
        beam(
          out,
          'roof',
          p,
          q,
          0.043,
          0.038,
          tint === colors.copper ? colors.deepCopper : colors.slateLight,
        );
      }
    }
  }
}

function gableRoof(out, { center, width, depth, angle, eaves, top, tint, wallTint }, level) {
  const p = rotated(center, angle),
    u = width / 2,
    v = depth / 2;
  const a = p(-u, eaves, -v),
    b = p(u, eaves, -v),
    c = p(u, eaves, v),
    d = p(-u, eaves, v);
  const r0 = p(-u, top, 0),
    r1 = p(u, top, 0);
  face(out, 'roof', [a, b, r1, r0], [0, 1, 0], tint);
  face(out, 'roof', [d, r0, r1, c], [0, 1, 0], tint);
  for (const [start, end, ridge, sign] of [
    [a, d, r0, -1],
    [b, c, r1, 1],
  ]) {
    face(
      out,
      'walls',
      [start, end, ridge],
      [Math.cos(angle) * sign, 0, Math.sin(angle) * sign],
      wallTint,
    );
    if (level >= 1) {
      beam(out, 'wood', start, ridge, 0.15, 0.15, colors.frame);
      beam(out, 'wood', ridge, end, 0.15, 0.15, colors.frame);
    }
  }
  if (level >= 1) beam(out, 'roof', r0, r1, 0.17, 0.21, tint);
}

function roofSection(center, width, depth, angle, eaves, top, tint, wallTint) {
  return { center, width, depth, angle, eaves, top, tint, wallTint };
}

function straightBand(out, shape, low, high, slot, tint, offset) {
  const order = areaSign(shape);
  for (const [a, b] of pairs(closed(shape))) {
    const w = edge(a, b, order);
    panel(out, slot, w, 0, w.length, low, high, offset, tint);
  }
}

function hotelWalls(out, b, level, scheme) {
  const { outline, datum, eaves } = b;
  const top = datum + eaves;
  const dryFloor = datum + 0.27;
  const bottom = (p) => Math.min(terrain(p) - 0.45, datum - 0.12);
  shell(out, outline, bottom, dryFloor, {
    wall: 'base',
    color: colors.foundation,
    roof: 'base',
    roofColor: colors.foundation,
  });
  shell(out, outline, () => dryFloor, top, {
    wall: 'walls',
    color: scheme.wall,
    roof: 'roof',
    roofColor: scheme.deck,
  });
  if (level === 0) return;
  straightBand(out, outline, top - 0.29, top - 0.07, 'wood', scheme.border, 0.07);
  if (scheme.historical) {
    const belt = datum + 3.64;
    straightBand(out, outline, belt - 0.19, belt + 0.1, 'wood', scheme.border, 0.1);
  }
  const order = areaSign(outline);
  for (const [[a, b], i] of pairs(closed(outline)).map((p, i) => [p, i])) {
    const w = edge(a, b, order);
    if (w.length < (level === 1 ? 4.6 : 2.15)) continue;
    const count = Math.max(1, Math.round(w.length / (level === 1 ? 5.0 : scheme.step)));
    for (let j = 0; j < count; j++) {
      const u = (w.length * (j + 0.5)) / count,
        half = Math.min(scheme.window / 2, (w.length / count) * 0.35);
      for (let row = 0; row < scheme.storeys; row++) {
        const height = scheme.aperture;
        const floor = datum + scheme.sill + row * scheme.spacing;
        if (floor < Math.max(terrain(a), terrain(b)) - 0.8 && row === 0) continue;
        panel(
          out,
          'glass',
          w,
          u - half,
          u + half,
          floor,
          floor + height,
          0.035,
          level >= 2 && (j + 2 * row + i) % 3 === 1 ? colors.glassLight : colors.glass,
        );
        if (level === 1) continue;
        panel(out, 'wood', w, u - 0.041, u + 0.044, floor, floor + height, 0.055, scheme.border);
        panel(
          out,
          'wood',
          w,
          u - half - 0.12,
          u + half + 0.12,
          floor - 0.08,
          floor,
          0.083,
          colors.trim,
        );
        if (level === 3 && scheme.historical) {
          panel(
            out,
            'wood',
            w,
            u - half,
            u + half,
            floor + height * 0.66,
            floor + height * 0.66 + 0.067,
            0.063,
            scheme.border,
          );
          for (const x of [u - half - 0.07, u + half]) {
            panel(out, 'wood', w, x, x + 0.075, floor, floor + height, 0.072, scheme.border);
          }
        }
      }
    }
  }
}

const mainScheme = {
  historical: true,
  wall: colors.render,
  deck: colors.slate,
  border: colors.darkTimber,
  storeys: 2,
  sill: 1.03,
  spacing: 3.78,
  aperture: 2.15,
  step: 2.65,
  window: 1.75,
};
const lodgeScheme = {
  ...mainScheme,
  wall: colors.pale,
  deck: colors.lake,
  border: colors.greenTrim,
  step: 2.95,
  aperture: 1.92,
  window: 1.3,
  spacing: 3.43,
};
const diningScheme = {
  ...mainScheme,
  wall: colors.pale,
  deck: colors.copper,
  border: colors.red,
  step: 3.05,
  spacing: 4.04,
  aperture: 2.02,
};
const flowerScheme = {
  ...mainScheme,
  wall: colors.render,
  deck: colors.copper,
  border: colors.red,
  storeys: 3,
  spacing: 3.38,
  step: 3.05,
  aperture: 1.99,
};
const modernScheme = {
  historical: false,
  wall: colors.modern,
  deck: colors.roofMembrane,
  border: colors.stucco,
  storeys: 3,
  sill: 0.96,
  spacing: 3.28,
  aperture: 1.9,
  step: 3.35,
  window: 2.34,
};

function timberBays(out, b, level) {
  const { outline, datum, eaves } = b;
  const order = areaSign(outline);
  const selected = [10, 11, 12, 13, 14, 15, 16, 17, 18];
  for (const i of selected) {
    const w = edge(outline[i], outline[i + 1], order);
    const f = w.length,
      lo = datum + 1.19;
    const rows = [
      [lo, lo + 2.12],
      [lo + 3.71, lo + 6.07],
    ];
    for (const [low, high] of rows) {
      panel(out, 'wood', w, 0.1, f - 0.1, low - 0.13, high + 0.13, 0.1, colors.light);
      panel(out, 'glass', w, 0.22, f - 0.22, low, high, 0.115, colors.glass);
      if (level >= 1) {
        const pieces = level === 1 ? 2 : Math.max(2, Math.floor(f / 0.6));
        for (let j = 1; j < pieces; j++) {
          const u = (f * j) / pieces;
          panel(out, 'wood', w, u - 0.055, u + 0.055, low, high, 0.13, colors.light);
        }
        for (const frac of [0.32, 0.68]) {
          const y = mix(low, high, frac);
          panel(out, 'wood', w, 0.21, f - 0.21, y - 0.046, y + 0.044, 0.132, colors.light);
        }
      }
    }
    if (level >= 2) {
      const y = datum + eaves - 0.6;
      for (let u = 0.66; u + 0.16 < f; u += 0.78) {
        beam(out, 'wood', w.p(u, y - 0.2, 0.035), w.p(u, y, 0.44), 0.16, 0.19, colors.darkTimber);
      }
    }
  }
}

function curvedCanopy(out, x, z, y, span, depth, level) {
  const steps = [4, 8, 12, 18][level];
  const profile = Array.from({ length: steps + 1 }, (_, i) => {
    const t = (i / steps) * 2 - 1;
    const a = t * t;
    return [
      x + (t * span) / 2,
      y + 1.45 * Math.pow(1 - a, 2) - 0.18 * Math.sin(Math.PI * Math.abs(t)) + 0.29 * a,
    ];
  });
  for (const [a, b] of pairs(profile)) {
    face(
      out,
      'roof',
      [
        [a[0], a[1], z],
        [b[0], b[1], z],
        [b[0], y + 1.65, z - depth],
        [a[0], y + 1.65, z - depth],
      ],
      [0, 1, 0],
      colors.slate,
    );
    if (level >= 1) {
      beam(
        out,
        'wood',
        [a[0], a[1] - 0.13, z + 0.06],
        [b[0], b[1] - 0.13, z + 0.06],
        0.11,
        0.19,
        colors.light,
      );
    }
  }
}

function mainBuilding(out, b, level) {
  const y = b.datum;
  hotelWalls(out, b, level, mainScheme);
  hipRoof(
    out,
    { center: [0.3, 0.0], width: 33.1, depth: 27.0, eaves: y + 8.51, top: y + 14.7 },
    level,
  );
  hipRoof(
    out,
    {
      center: [2.2, -20.6],
      width: 27.3,
      depth: 17.7,
      angle: -0.205,
      eaves: y + 8.49,
      top: y + 11.76,
    },
    level,
  );
  hipRoof(
    out,
    {
      center: [-19.6, 4.32],
      width: 24.1,
      depth: 13.4,
      angle: -1.1,
      eaves: y + 8.56,
      top: y + 12.63,
    },
    level,
  );
  for (const [x, z] of [
    [-8.35, 11.52],
    [8.26, 10.95],
  ]) {
    hipRoof(
      out,
      { center: [x, z], width: 8.8, depth: 8.3, eaves: y + 8.28, top: y + 11.28, hip: 0.83 },
      level,
    );
  }
  if (level >= 1) timberBays(out, b, level);
  const center = 0.77,
    z = 16.9;
  for (const x of [center - 3.25, center + 3.25]) {
    block(out, 'wood', x - 0.17, y + 0.35, z - 0.28, 0.34, 4.11, 0.36, colors.light);
    if (level >= 1) block(out, 'wood', x - 0.27, y + 3.97, z - 0.37, 0.54, 0.43, 0.53, colors.red);
  }
  curvedCanopy(out, center, z + 0.2, y + 4.45, 8.36, 4.52, level);
  block(out, 'wood', center - 3.53, y + 4.3, z - 0.58, 7.06, 0.25, 0.46, colors.darkTimber);
  const head = plane(13.1, 1);
  panel(out, 'glass', head, center - 1.57, center + 1.57, y + 0.36, y + 2.98, 0.022, colors.glass);
  for (let i = 0; i < (level === 0 ? 2 : 5); i++) {
    const rise = 0.15 * i,
      front = z + 2.6 - i * 0.43;
    const site = terrain([center, front]);
    block(
      out,
      'base',
      center - 3.12,
      site - 0.08,
      front,
      6.24,
      Math.max(0.13, y + rise - site + 0.12),
      0.62,
      colors.foundation,
    );
  }
  if (level >= 1) {
    for (const [x, z] of [
      [-8.1, -1.5],
      [7.1, -2.3],
      [-18.8, -1.0],
      [12.6, -10.2],
    ]) {
      block(out, 'brick', x - 0.4, y + 10.6, z - 0.38, 0.8, 3.9, 0.76, colors.brick);
      block(out, 'brick', x - 0.49, y + 14.34, z - 0.46, 0.98, 0.26, 0.92, colors.brick);
    }
    for (const [a, b] of [
      [center - 3.3, center - 1.7],
      [center + 1.7, center + 3.3],
    ]) {
      beam(out, 'wood', [a, y + 1.3, z + 0.42], [b, y + 1.3, z + 0.42], 0.18, 0.17, colors.red);
      if (level >= 2) {
        for (let x = a + 0.2; x < b; x += 0.35) {
          beam(
            out,
            'wood',
            [x, y + 0.5, z + 0.42],
            [x, y + 1.3, z + 0.42],
            0.085,
            0.08,
            colors.red,
          );
        }
      }
    }
  }
}

function diningRoom(out, b, level) {
  const y = b.datum;
  hotelWalls(out, b, level, diningScheme);
  const center = [25.15, -28.9],
    angle = 1.18;
  gableRoof(
    out,
    roofSection(center, 37.9, 19.15, angle, y + 9.18, y + 17.13, colors.copper, colors.pale),
    level,
  );
  gableRoof(
    out,
    roofSection(
      [20.24, -40.2],
      17.0,
      16.7,
      angle + Math.PI / 2,
      y + 9.25,
      y + 15.1,
      colors.deepCopper,
      colors.pale,
    ),
    level,
  );
  const tower = [29.75, -23.0];
  for (const [i, width] of [7.45, 6.4, 5.45, 4.66, 3.82].entries()) {
    const y0 = y + 11.88 + i * 2.28;
    const p = rotated(tower, angle);
    const ring = (base, w) => [
      p(-w / 2, base, -w / 2),
      p(w / 2, base, -w / 2),
      p(w / 2, base, w / 2),
      p(-w / 2, base, w / 2),
    ];
    loft(out, 'walls', [ring(y0, width - 0.92), ring(y0 + 1.32, width - 0.92)], colors.pale);
    hipRoof(
      out,
      {
        center: tower,
        width,
        depth: width,
        angle,
        eaves: y0 + 1.32,
        top: y0 + 2.49,
        hip: 0.76,
        tint: colors.copper,
      },
      Math.min(level, 2),
    );
    if (level >= 1) {
      const pane = ring(y0, width - 0.92).map(([x, , z]) => [x, z]);
      for (const [a, b] of pairs(closed(pane))) {
        const w = edge(a, b, areaSign(pane)),
          cx = w.length / 2;
        panel(out, 'glass', w, cx - 0.56, cx + 0.56, y0 + 0.28, y0 + 1.14, 0.04, colors.glass);
      }
    }
  }
  beam(
    out,
    'metal',
    [tower[0], y + 23.3, tower[1]],
    [tower[0], y + 24.36, tower[1]],
    0.14,
    0.14,
    colors.deepCopper,
  );
}

function cottages(out, b, level) {
  const y = b.datum;
  hotelWalls(out, b, level, lodgeScheme);
  const sections = [
    [[-10.2, 26.4], 19.45, 10.55, -0.401],
    [[-8.2, 38.24], 22.4, 17.55, 0.99],
    [[0.36, 50.4], 29.05, 14.4, 1.05],
  ];
  for (const [center, width, depth, angle] of sections) {
    gableRoof(
      out,
      roofSection(center, width, depth, angle, y + 7.58, y + 11.7, colors.lake, colors.pale),
      level,
    );
    if (level >= 1) {
      const p = rotated(center, angle);
      const top = p(-1.7, y + 12.4, 0),
        base = p(-1.7, y + 11.2, 0);
      beam(out, 'brick', top, base, 0.43, 0.43, colors.brick);
    }
  }
}

function flowerPalace(out, b, level) {
  const y = b.datum;
  hotelWalls(out, b, level, flowerScheme);
  const angle = 0.603;
  hipRoof(
    out,
    {
      center: [42.5, 56.2],
      width: 51.4,
      depth: 30.1,
      angle,
      eaves: y + 13.56,
      top: y + 21.55,
      tint: colors.copper,
    },
    level,
  );
  hipRoof(
    out,
    {
      center: [37.0, 46.9],
      width: 32,
      depth: 25.9,
      angle: angle + Math.PI / 2,
      eaves: y + 13.12,
      top: y + 18.55,
      tint: colors.copper,
    },
    level,
  );
  for (const [center, width, depth, phase] of [
    [[35.1, 65.0], 15.8, 17.1, 0.09],
    [[56.4, 61.9], 14.7, 16.55, 0],
    [[32.8, 43.5], 12.0, 13.2, 0.06],
  ]) {
    gableRoof(
      out,
      roofSection(
        center,
        width,
        depth,
        angle + Math.PI / 2,
        y + 12.94 + phase,
        y + 17.4 + phase,
        colors.deepCopper,
        colors.pale,
      ),
      level,
    );
  }
  if (level >= 1) {
    const outline = b.outline;
    const order = areaSign(outline);
    for (const i of [5, 7, 9, 10, 11, 13]) {
      const w = edge(outline[i], outline[(i + 1) % outline.length], order);
      const h = y + 9.17;
      panel(out, 'wood', w, 0.3, w.length - 0.3, h - 0.13, h + 0.03, 0.66, colors.red);
      panel(out, 'wood', w, 0.3, w.length - 0.3, h - 0.93, h - 0.8, 0.64, colors.red);
      if (level >= 2) {
        for (let u = 0.64; u < w.length - 0.5; u += 0.63) {
          panel(out, 'wood', w, u - 0.056, u + 0.055, h - 0.9, h - 0.02, 0.65, colors.red);
        }
        for (let row = 0; row < 3; row++) {
          const yy = y + 2.26 + row * 3.26;
          for (let k = 0; k < (level === 3 ? 4 : 2); k++) {
            panel(
              out,
              'wood',
              w,
              0.38,
              w.length - 0.38,
              yy + k * 0.21,
              yy + k * 0.21 + 0.049,
              0.045,
              colors.trim,
            );
          }
        }
      }
    }
  }
}

function newerWings(out, b, level) {
  const y = b.datum;
  const tall = b.key === 'forest';
  hotelWalls(out, b, level, tall ? { ...modernScheme, storeys: 6, aperture: 1.66 } : modernScheme);
  const offset = tall ? 0 : 2.75;
  const top = y + b.eaves;
  const order = areaSign(b.outline);
  for (const [start, end] of pairs(closed(b.outline))) {
    const w = edge(start, end, order);
    panel(out, 'walls', w, 0, w.length, top - 0.04, top + 0.35, 0.009, colors.modern);
    if (level >= 1 && w.length > 12) {
      for (let floor = 1; floor < (tall ? 6 : 4); floor++) {
        const height = y + floor * 3.22;
        panel(
          out,
          'wood',
          w,
          0.31,
          w.length - 0.33,
          height - 0.18,
          height + 0.12,
          0.11,
          colors.render,
        );
      }
    }
  }
  if (!tall) {
    block(out, 'roof', -43.2, top, -32, 18.8, 0.91 + offset * 0.07, 6.1, colors.roofMembrane);
  } else {
    block(out, 'roof', -17.85, top, 81.04, 14.18, 0.88, 6.26, colors.roofMembrane);
  }
}

function build(out, level) {
  const [main, dining, lodge, flower, cascade, forest] = d.blocks;
  mainBuilding(out, main, level);
  diningRoom(out, dining, level);
  cottages(out, lodge, level);
  flowerPalace(out, flower, level);
  for (const b of [cascade, forest]) newerWings(out, b, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'fujiya-hotel-model.mjs';
const camera = [112, 72, 131],
  lookAt = [-1, 12, 20];
const errors = { district: 0.49, street: 0.17, closeup: 0.07 };
export const fujiyaHotelAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  category: 'hotel-commercial',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'Original GSI elevation for each separately mapped building’s approach. Foundations follow the terrain locally.',
  brief:
    'Hakone’s Fujiya Hotel, including the 1891 double-bay Main, Dining Room tower, Western cottages, Flower Palace and the newer Forest and Cascade wings.',
  camera,
  lookAt,
  sunDirection: [84, 113, 163],
  mediumFiContext: {
    scale: 1,
    groundY: -0.2,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.campus,
    minimumCoverage: 0.92,
    basis: 'The named main Fujiya Hotel parcel around the building group.',
  },
  embeddedCanonicalGraphs: ['stone_ashlar', 'metal_painted', 'brick_flemish'],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    {
      name: 'main-twin-bays-and-karahafu-porch',
      position: [13.2, 7.0, 29.75],
      lookAt: [0.8, 7.1, 11.0],
    },
    { name: 'dining-room-and-pagoda-tower', position: [81, 25, -14], lookAt: [25, 11, -30] },
    {
      name: 'flower-palace-gables-and-vermilion-balcony',
      position: [98, 30, 82],
      lookAt: [40, 11, 58],
    },
    { name: 'hillside-cottages-and-newer-wings', position: [-94, 66, 82], lookAt: [-4, 12, 29] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'fujiya-hotel-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.99,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(errors).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors, ODbL 1.0. GSI Japan elevation data.',
};
