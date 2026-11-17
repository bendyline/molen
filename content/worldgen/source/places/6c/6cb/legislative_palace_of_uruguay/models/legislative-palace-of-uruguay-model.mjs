/** Montevideo's Legislative Palace, with the four published interior court rings open to the sky. */
import { readFileSync } from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const frame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
const { outline, holes } = frame.geometry;
const { foundation, porticoFloor, entablature, mainRoof, lanternTop, stairFlightEnds } =
  plan.section;
const palette = Object.fromEntries(
  Object.entries({
    alabaster: 'ded8c9',
    light: 'e9e1d1',
    shade: 'c7bdae',
    court: 'baaf9f',
    plinth: 'aca391',
    joint: '938b7d',
    roof: 'a0a6a2',
    roofMetal: '879894',
    dark: '575951',
    glass: '535b5a',
    iron: '645d50',
  }).map(([key, hex]) => [key, rgb(hex)]),
);
const surfaces = {
  marble: { slot: 'wall', graph: 'stone_marble', roughness: 0.83, metallic: 0 },
  limestone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.92, metallic: 0 },
  granite: { slot: 'foundation', graph: 'stone_granite', roughness: 0.95, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.88, metallic: 0.15 },
  window: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.49, metallic: 0 },
};
const stone = palette.alabaster;
const surface = (slot, tint) => ({ slot, tint });
const trim = surface('limestone', palette.light);
const base = surface('granite', palette.plinth);
const masonry = surface('marble', stone);
const sheet = surface('roof', palette.roof);

function rectangle(out, slot, x0, x1, y0, y1, z, tint) {
  if (x1 - x0 < 0.01 || y1 - y0 < 0.01) return;
  face(
    out,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    tint,
  );
}

function outwardRing(ring, interior = false) {
  const ccw = ShapeUtils.area(ring.map((p) => new Vector2(...p))) > 0;
  return ccw !== interior ? [...ring].reverse() : ring;
}

function shellEdges(out, ring, y0, y1, material, interior = false) {
  const points = outwardRing(ring, interior);
  for (let i = 0; i < points.length; i++) {
    const [px, pz] = points[i],
      [qx, qz] = points[(i + 1) % points.length];
    face(
      out,
      material.slot,
      [
        [px, y0, pz],
        [qx, y0, qz],
        [qx, y1, qz],
        [px, y1, pz],
      ],
      material.tint,
    );
  }
}

function roofPlate(out, outer, courts, y, material, up = true) {
  const contour = outer.map((p) => new Vector2(...p));
  const voids = courts.map((r) => r.map((p) => new Vector2(...p)));
  const vertices = [...outer, ...courts.flat()];
  for (const indices of ShapeUtils.triangulateShape(contour, voids)) {
    const p = indices.map((i) => [vertices[i][0], y, vertices[i][1]]);
    const n = (p[1][2] - p[0][2]) * (p[2][0] - p[0][0]) - (p[1][0] - p[0][0]) * (p[2][2] - p[0][2]);
    if (Math.abs(n) < 0.0001) continue;
    triangle(out, material.slot, n > 0 === up ? p : p.reverse(), material.tint);
  }
}

// Recess the wall behind each freestanding porch while leaving the native podium and roof extent.
const wallRing = outline.map(([x, z], i) => {
  if (i === 1 || i === 2) return [x, -35.04];
  if (i === 17 || i === 18) return [x, 34.19];
  if (i === 8 || i === 9) return [46.48, z];
  if (i === 26 || i === 27) return [-46.49, z];
  return [x, z];
});

function window(out, x, z, width, low, high, lod, basement = false) {
  const tint = basement ? palette.dark : palette.glass;
  const w = width / 2;
  rectangle(out, 'window', x - w, x + w, low, high, z + 0.028, tint);
  if (lod < 2) return;
  if (lod === 2) {
    rectangle(
      out,
      'limestone',
      x - w - 0.19,
      x + w + 0.19,
      low - 0.18,
      low,
      z + 0.045,
      palette.light,
    );
    rectangle(
      out,
      'limestone',
      x - w - 0.19,
      x + w + 0.19,
      high,
      high + 0.23,
      z + 0.045,
      palette.light,
    );
    return;
  }
  for (const side of [-1, 1]) {
    const q = x + side * (w + 0.087);
    box(
      out,
      'limestone',
      [q - 0.081, low - 0.1, z - 0.012],
      [q + 0.081, high + 0.11, z + 0.186],
      palette.shade,
    );
  }
  box(
    out,
    'limestone',
    [x - w - 0.2, low - 0.18, z - 0.01],
    [x + w + 0.2, low + 0.01, z + 0.22],
    palette.light,
  );
  box(
    out,
    'limestone',
    [x - w - 0.2, high, z - 0.01],
    [x + w + 0.2, high + 0.24, z + 0.18],
    palette.light,
  );
  if (lod === 3) {
    rectangle(out, 'limestone', x - 0.043, x + 0.043, low, high, z + 0.045, palette.iron);
    rectangle(out, 'limestone', x - w, x + w, high - 0.66, high - 0.57, z + 0.045, palette.iron);
    if (basement) {
      for (const f of [-0.53, 0.53]) {
        rectangle(
          out,
          'limestone',
          x + w * f - 0.034,
          x + w * f + 0.034,
          low,
          high,
          z + 0.046,
          palette.iron,
        );
      }
    }
  }
}

function belt(out, x0, x1, z, y, depth = 0.34, height = 0.19, tint = palette.light) {
  box(out, 'limestone', [x0, y, z - 0.047], [x1, y + height, z + depth], tint);
}

function upperParapet(out, x0, x1, z, y, lod) {
  if (lod < 2) {
    belt(out, x0, x1, z, y, 0.18, 0.79, palette.shade);
    return;
  }
  belt(out, x0, x1, z + 0.04, y, 0.24, 0.22, palette.shade);
  belt(out, x0, x1, z + 0.04, y + 1, 0.29, 0.23, palette.light);
  const spans = Math.max(1, Math.floor((x1 - x0) / 1.65));
  for (let i = 0; i < spans; i++) {
    const x = x0 + ((x1 - x0) * (i + 0.5)) / spans,
      w = i % 4 === 0 ? 0.37 : 0.16;
    box(
      out,
      'limestone',
      [x - w, y + 0.15, z - 0.15],
      [x + w, y + 1.09, z + 0.24],
      palette.alabaster,
    );
  }
}

function surround(out, x0, x1, z, lod, count = 0) {
  for (const [y, height, depth, tint] of [
    [porticoFloor - 0.32, 0.28, 0.16, palette.shade],
    [porticoFloor, 0.22, 0.29, palette.light],
    [entablature - 0.57, 0.25, 0.22, palette.shade],
    [entablature - 0.06, 0.31, 0.42, palette.light],
    [mainRoof - 0.3, 0.24, 0.2, palette.shade],
  ]) {
    belt(out, x0, x1, z, y, depth, height, tint);
  }
  if (count) {
    const step = (x1 - x0) / count;
    for (let i = 0; i < count; i++) {
      const x = x0 + (i + 0.5) * step;
      const width = Math.min(2.48, step * 0.58);
      window(out, x, z, width, 8.04, 13.03, lod);
      window(out, x, z, width * 0.91, 15.67, 19.32, lod);
      if (lod > 1) {
        window(out, x, z, width * 0.63, 1.58, 4.82, lod, true);
        const pier = x0 + step * i + 0.22;
        box(
          out,
          'limestone',
          [pier - 0.23, porticoFloor + 0.12, z - 0.02],
          [pier + 0.23, entablature - 0.4, z + 0.25],
          palette.shade,
        );
        belt(out, x - width * 0.63, x + width * 0.63, z, 13.24, 0.3, 0.18, palette.shade);
      }
      if (lod === 3) {
        for (const q of [-0.34, 0, 0.34]) {
          box(
            out,
            'limestone',
            [x + q * width - 0.045, 14.79, z - 0.011],
            [x + q * width + 0.045, 15.28, z + 0.17],
            palette.light,
          );
        }
      }
    }
  }
  if (lod > 1 && x1 - x0 > 4.6) {
    const count = Math.round((x1 - x0) / 1.04);
    for (let i = 0; i < count; i++) {
      const px = x0 + ((x1 - x0) * (i + 0.5)) / count;
      rectangle(
        out,
        'limestone',
        px - 0.14,
        px + 0.14,
        entablature - 0.38,
        entablature - 0.12,
        z + 0.31,
        palette.shade,
      );
    }
  }
}

function shell(out, lod) {
  shellEdges(out, outline, foundation, porticoFloor, base);
  shellEdges(out, wallRing, porticoFloor, mainRoof, masonry);
  roofPlate(out, outline, holes, mainRoof, sheet);
  for (const ring of holes) {
    shellEdges(out, ring, porticoFloor - 0.1, mainRoof, surface('marble', palette.court), true);
    roofPlate(out, ring, [], porticoFloor - 0.1, base);
  }
  if (lod > 0) {
    const ring = outwardRing(wallRing);
    for (let i = 0; i < ring.length; i++) {
      const [x, z] = ring[i],
        [q, w] = ring[(i + 1) % ring.length];
      const len = Math.hypot(q - x, w - z);
      if (len < 3.7) continue;
      const outwards = transform(out, Math.atan2(z - w, q - x), [(x + q) / 2, 0, (z + w) / 2]);
      surround(
        outwards,
        -len / 2,
        len / 2,
        0,
        lod,
        len > 6 ? Math.max(1, Math.round(len / 4.35)) : 0,
      );
    }
  }
  const corners = [
    [0, -44.2, -29.0, 35.43],
    [0, 28.3, 43.9, 36.32],
    [Math.PI, -43.6, -28.0, 35.82],
    [Math.PI, 27.8, 42.9, 34.8],
  ];
  if (lod > 0)
    for (const [angle, x0, x1, z] of corners) {
      const facade = transform(out, angle);
      upperParapet(facade, x0, x1, z, mainRoof, lod);
    }
  if (lod > 0)
    for (const angle of [0, Math.PI, Math.PI / 2, -Math.PI / 2]) {
      const facade = transform(out, angle);
      const z = angle === 0 ? 34.55 : angle === Math.PI ? 35.25 : 44.24;
      for (const sign of [-1, 1]) {
        const limits = sign < 0 ? [-28.1, -11.35] : [10.9, 28];
        upperParapet(facade, ...limits, z, mainRoof, lod);
      }
    }
}

function column(out, x, z, y0, y1, r, lod) {
  const n = [5, 6, 8, 14][lod];
  const layers =
    lod < 2
      ? [
          [y0, r * 1.26],
          [y1 - 0.27, r * 0.87],
          [y1, r * 1.25],
        ]
      : [
          [y0, r * 1.32],
          [y0 + 0.24, r * 1.32],
          [y0 + 0.37, r * 1.15],
          [y0 + 0.57, r],
          [y1 - 0.66, r * 0.82],
          [y1 - 0.45, r * 0.95],
          [y1 - 0.16, r * 1.3],
          [y1, r * 1.31],
        ];
  // Caps on the entablature and plinth hide the interior of the shaft.
  loft(
    out,
    'limestone',
    layers.map(([y, w]) => radialRing(y, w, w, n, [x, z])),
    palette.alabaster,
    { cap: false },
  );
  if (lod === 3) {
    for (let i = 0; i < 7; i++) {
      const angle = (i * 2 * Math.PI) / 7;
      const dx = Math.cos(angle) * r,
        dz = Math.sin(angle) * r;
      beam(
        out,
        'limestone',
        [x + dx * 0.9, y1 - 0.72, z + dz * 0.9],
        [x + dx * 1.26, y1 - 0.21, z + dz * 1.26],
        0.108,
        0.107,
        palette.light,
      );
    }
  }
}

function pediment(out, x0, x1, z, y, rise, lod, sculpted = false) {
  const mid = (x0 + x1) / 2;
  const [a, b, c] = [
    [x0, y, z],
    [x1, y, z],
    [mid, y + rise, z],
  ];
  triangle(out, 'marble', [a, b, c], palette.shade);
  for (const [p, q] of [
    [a, c],
    [c, b],
  ]) {
    beam(out, 'limestone', p, q, 0.42, 0.38, palette.light);
    if (lod > 1) {
      const count = Math.round((x1 - x0) / 2.22);
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count,
          x = p[0] + (q[0] - p[0]) * t,
          py = p[1] + (q[1] - p[1]) * t;
        box(
          out,
          'limestone',
          [x - 0.1, py - 0.42, z - 0.035],
          [x + 0.1, py - 0.19, z + 0.23],
          palette.light,
        );
      }
    }
  }
  belt(out, x0, x1, z, y - 0.16, 0.34, 0.27);
  if (!sculpted || lod < 2) return;
  const figures = [
    [-0.79, 0.23],
    [-0.57, 0.4],
    [-0.33, 0.62],
    [0, 0.86],
    [0.26, 0.64],
    [0.45, 0.48],
    [0.67, 0.34],
    [0.83, 0.22],
  ];
  for (const [ratio, height] of figures) {
    const x = mid + ((x1 - x0) / 2) * ratio,
      h = rise * height;
    loft(
      out,
      'limestone',
      [
        radialRing(y + 0.1, 0.5, 0.11, 6, [x, z + 0.15]),
        radialRing(y + h * 0.53, 0.37, 0.18, 6, [x + 0.055, z + 0.18]),
        radialRing(y + h * 0.83, 0.31, 0.15, 6, [x - 0.025, z + 0.22]),
        radialRing(y + h, 0.18, 0.13, 6, [x, z + 0.19]),
      ],
      palette.alabaster,
      { cap: false },
    );
  }
}

function portico(out, angle, front, width, lod, south = false) {
  const o = transform(out, angle);
  const left = -width / 2,
    right = width / 2,
    eave = entablature;
  const back = front - 4.8;
  const z = front - 0.63;
  const r = south ? 0.63 : 0.5;
  for (const x of [left + 0.76, right - 0.76]) {
    box(o, 'marble', [x - 0.62, porticoFloor, back], [x + 0.62, eave, z + 0.5], palette.shade);
    belt(o, x - 0.74, x + 0.74, z + 0.51, eave - 0.36, 0.2, 0.23);
  }
  for (let i = 1; i <= 4; i++) {
    const x = left + (width * i) / 5;
    column(o, x, z, porticoFloor, eave - 0.27, r, lod);
    if (lod > 0) {
      const terminus = back - (south ? 0.78 : 0.35);
      window(o, x, terminus, 2.15, porticoFloor + 0.57, 13.75, lod);
      window(o, x, terminus, 2.0, 15.88, 19.43, lod);
    }
  }
  box(
    o,
    'marble',
    [left - 0.38, eave - 0.19, back],
    [right + 0.38, eave + 1.31, z + 0.76],
    palette.alabaster,
  );
  belt(o, left - 0.67, right + 0.67, z + 0.77, eave - 0.13, 0.33, 0.39, palette.light);
  belt(o, left - 0.5, right + 0.5, z + 0.77, eave + 1.06, 0.4, 0.27, palette.light);
  const rise = south ? 4.1 : 3.1;
  pediment(o, left - 0.91, right + 0.91, z + 0.88, eave + 1.35, rise, lod, south);
  // Hidden roof behind the crowning face spans between portico and main roof.
  const backY = mainRoof;
  const ridge = [0, eave + 1.35 + rise, z + 0.71];
  face(
    o,
    'roof',
    [
      [left - 0.63, eave + 1.35, z + 0.71],
      ridge,
      [0, backY + 0.17, back],
      [left - 0.63, backY, back],
    ],
    palette.roof,
  );
  face(
    o,
    'roof',
    [
      ridge,
      [right + 0.63, eave + 1.35, z + 0.71],
      [right + 0.63, backY, back],
      [0, backY + 0.17, back],
    ],
    palette.roof,
  );
}

function endPediments(out, lod) {
  for (const [center, z] of [
    [-35.98, 35.34],
    [35.89, 36.19],
  ]) {
    const width = 15.5,
      x0 = center - width / 2,
      x1 = center + width / 2;
    for (let i = 0; i < 4; i++) {
      const x = x0 + 0.8 + ((width - 1.6) * i) / 3;
      column(out, x, z + 0.25, porticoFloor, entablature - 0.16, 0.36, lod);
    }
    belt(out, x0 - 0.29, x1 + 0.29, z, entablature - 0.13, 0.62, 0.39);
    belt(out, x0 - 0.55, x1 + 0.55, z, entablature + 1.18, 0.66, 0.31);
    pediment(out, x0 - 0.52, x1 + 0.52, z + 0.51, entablature + 1.52, 3.31, lod);
  }
}

function lantern(out, lod) {
  const b = 10.9,
    a = 8.45;
  box(out, 'marble', [-b, mainRoof, -b], [b, 29.17, b], palette.shade);
  box(out, 'marble', [-a, 28.9, -a], [a, 35.46, a], palette.alabaster);
  for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const o = transform(out, angle);
    const z = a + 0.012;
    if (lod)
      for (const x of [-5.4, -2.7, 0, 2.7, 5.4]) {
        window(o, x, z, 1.9, 31.1, 33.26, lod);
      }
    belt(o, -a - 0.2, a + 0.2, z, 34.18, 0.51, 0.27);
    belt(o, -a - 0.22, a + 0.22, z, 34.84, 0.63, 0.42);
    if (lod > 0) upperParapet(o, -a, a, z, 35.28, lod);
    if (lod > 1) {
      const samples = 10;
      const arch = Array.from({ length: samples + 1 }, (_, i) => {
        const theta = (i * Math.PI) / samples;
        return [5.15 * Math.cos(theta), 25.08 + 2.6 * Math.sin(theta), b + 0.025];
      });
      for (let i = 1; i < arch.length; i++) {
        triangle(o, 'window', [[0, 25.08, b + 0.025], arch[i], arch[i - 1]], palette.glass);
        beam(o, 'limestone', arch[i - 1], arch[i], 0.16, 0.27, palette.light);
      }
      for (const x of [-2.4, 0, 2.4])
        rectangle(o, 'limestone', x - 0.044, x + 0.044, 25.09, 27.4, b + 0.058, palette.iron);
    }
  }
  for (const x of [-a + 0.29, a - 0.29]) {
    for (const z of [-a + 0.29, a - 0.29]) {
      box(
        out,
        'marble',
        [x - 1.17, 27.6, z - 1.17],
        [x + 1.17, 37.08, z + 1.17],
        palette.alabaster,
      );
      box(
        out,
        'limestone',
        [x - 1.39, 36.87, z - 1.39],
        [x + 1.39, 37.31, z + 1.39],
        palette.light,
      );
      loft(
        out,
        'limestone',
        [
          [37.3, 1.38],
          [37.68, 1.44],
          [38.21, 1.03],
          [39.59, 0.83],
          [lanternTop, 0.49],
        ]
          .filter((_, i) => lod !== 0 || i % 2 === 0)
          .map(([y, r]) => radialRing(y, r, r, [5, 6, 8, 10][lod], [x, z])),
        palette.light,
        { cap: true },
      );
    }
  }
  box(out, 'roof', [-7.42, 35.42, -7.42], [7.42, 35.75, 7.42], palette.roofMetal);
}

function mainApproach(out, lod) {
  const count = [1, 4, 11, 15][lod];
  for (let f = 0; f < stairFlightEnds.length - 1; f++) {
    const [front, lower] = stairFlightEnds[f],
      [back, upper] = stairFlightEnds[f + 1];
    const x0 = f === 0 ? -19.25 : f === 1 ? -17.85 : -14.6;
    const x1 = -x0;
    if (lod === 0) {
      face(
        out,
        'granite',
        [
          [x0, upper, back],
          [x0, lower, front],
          [x1, lower, front],
          [x1, upper, back],
        ],
        palette.plinth,
      );
    } else {
      for (let s = 0; s < count; s++) {
        const z0 = back + ((front - back) * (count - 1 - s)) / count,
          z1 = back + ((front - back) * (count - s)) / count;
        const y = upper - ((upper - lower) * s) / count;
        face(
          out,
          'granite',
          [
            [x0, y, z0],
            [x0, y, z1],
            [x1, y, z1],
            [x1, y, z0],
          ],
          palette.plinth,
        );
        face(
          out,
          'granite',
          [
            [x0, y - (upper - lower) / count, z1],
            [x1, y - (upper - lower) / count, z1],
            [x1, y, z1],
            [x0, y, z1],
          ],
          palette.shade,
        );
        if (lod > 1) {
          rectangle(out, 'granite', x0, x1, y - 0.041, y, z1 + 0.008, palette.joint);
        }
      }
    }
    for (const sign of [-1, 1]) {
      const x = (x1 + 0.24) * sign,
        wa = 0.82;
      const outside = [
        [x, foundation * 0.48, back],
        [x, upper + 0.52, back],
        [x, lower + 0.52, front],
        [x, foundation * 0.48, front],
      ];
      face(out, 'limestone', sign < 0 ? outside : outside.slice().reverse(), palette.shade);
      if (lod) {
        const inner = x1 * sign;
        const plinth = [
          [inner, foundation * 0.64, back],
          [inner, upper, back],
          [inner, lower, front],
          [inner, foundation * 0.64, front],
        ];
        face(out, 'granite', sign < 0 ? plinth : plinth.reverse(), palette.plinth);
        beam(
          out,
          'limestone',
          [x, lower + 0.56, front],
          [x, upper + 0.56, back],
          wa,
          0.29,
          palette.light,
        );
        if (lod > 1)
          for (const t of [0, 0.48, 0.97]) {
            const zz = front + (back - front) * t,
              yy = lower + (upper - lower) * t + 0.53;
            box(
              out,
              'limestone',
              [x - 0.59, yy - 0.67, zz - 0.47],
              [x + 0.59, yy + 0.37, zz + 0.47],
              palette.shade,
            );
          }
      }
    }
  }
  const ramps = [
    [
      [-45, -6.1, 53],
      [-20, 4.9, 50],
      [-15.85, 7.15, 39.72],
      [-25, 7.15, 36.1],
      [-48, -6.35, 43.4],
    ],
    [
      [45, -2.55, 57],
      [22, 3.65, 52],
      [16.2, 7.15, 39.72],
      [22, 7.15, 36.75],
      [48, -1.99, 45.4],
    ],
  ];
  for (const [i, outline] of ramps.entries()) {
    for (let j = 1; j < outline.length - 1; j++) {
      const pts = [outline[0], outline[j], outline[j + 1]];
      const [a, b, c] = pts;
      const upward = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
      triangle(out, 'granite', upward > 0 ? pts : pts.reverse(), palette.plinth);
    }
    if (lod) {
      for (let j = 0; j < outline.length; j++) {
        const a = outline[j],
          b = outline[(j + 1) % outline.length];
        const wall = [[a[0], foundation, a[2]], [b[0], foundation, b[2]], b, a];
        face(out, 'granite', i === 0 ? wall : wall.reverse(), palette.plinth);
      }
      for (const [a, b] of [
        [0, 1],
        [1, 2],
        [3, 4],
      ]) {
        const lift = ([x, y, z]) => [x, y + 0.41, z];
        beam(out, 'limestone', lift(outline[a]), lift(outline[b]), 0.44, 0.65, palette.shade);
      }
    }
  }
}

function build(out, lod) {
  shell(out, lod);
  portico(out, 0, 40.147, 22.4, lod, true);
  if (lod) {
    portico(out, Math.PI, 40.14, 21.46, lod);
    portico(out, Math.PI / 2, 50.59, 18.65, lod);
    portico(out, -Math.PI / 2, 51.03, 20.28, lod);
    endPediments(out, lod);
  } else {
    const rear = transform(out, Math.PI);
    box(rear, 'marble', [-10.73, porticoFloor, 35.06], [10.73, 23.3, 40.14], stone);
    for (const [center, z] of [
      [-35.98, 35.34],
      [35.89, 36.19],
    ]) {
      triangle(
        out,
        'marble',
        [
          [center - 7.75, 23.25, z],
          [center + 7.75, 23.25, z],
          [center, 26.5, z],
        ],
        stone,
      );
    }
    for (const [left, right, z] of [
      [-42, -12, 35.35],
      [12, 42, 36.17],
    ]) {
      const step = (right - left) / 7;
      for (let i = 0; i < 7; i++) {
        const x = left + (i + 0.5) * step;
        rectangle(out, 'window', x - 0.75, x + 0.75, 8.1, 13.05, z + 0.021, palette.glass);
        rectangle(out, 'window', x - 0.75, x + 0.75, 15.67, 19.43, z + 0.021, palette.glass);
      }
    }
  }
  lantern(out, lod);
  mainApproach(out, lod);
}

export const legislativeSkyline = (out) => build(out, 0);
export const legislativeDistrict = (out) => build(out, 1);
export const legislativeStreet = (out) => build(out, 2);
export const legislativeCloseup = (out) => build(out, 3);
const recipe = 'legislative-palace-of-uruguay-model.mjs';
const camera = [99, 62, 137],
  lookAt = [0, 15, 5];
export const legislativeModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  surfaces,
  category: 'landmark',
  build: legislativeCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The standing Legislative Palace at Montevideo, with pale neoclassical porticoes, the sculpted square lantern, four mapped courts and the monumental southern stairs.',
  camera,
  lookAt,
  sunDirection: [-45, 58, 74],
  embeddedCanonicalGraphs: [
    'stone_marble',
    'stone_limestone_raw',
    'stone_granite',
    'metal_standing_seam',
  ],
  groundCutout: {
    outline: [
      [-14.57, 39.98],
      [14.57, 39.98],
      [14.57, 47.1],
      [17.81, 47.1],
      [17.81, 55.7],
      [19.2, 55.7],
      [19.2, 63.86],
      [-19.2, 63.86],
      [-19.2, 55.7],
      [-17.81, 55.7],
      [-17.81, 47.1],
      [-14.57, 47.1],
    ],
    basis:
      'Only the three modeled south stair flights. The original terrain remains intact beneath the review overlay and across the surrounding parcel.',
  },
  buildingCutout: {
    outline,
    basis:
      'Exact named civic building perimeter from the OpenStreetMap multipolygon. Match replacement to the palace footprint.',
  },
  mediumFiContext: {
    scale: 1,
    groundY: -0.1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'south-stairs-and-portico', position: [-0.7, 3.5, 111], lookAt: [0, 14, 29] },
    { name: 'lantern-sculpture-and-courts', position: [66, 61, 65], lookAt: [0, 21, 2] },
    { name: 'northern-and-western-porticoes', position: [-90, 34, -84], lookAt: [0, 15, 2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'palace-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'legislativeSkyline',
    errorMeters: 0.96,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'legislativeDistrict', 0.4],
        ['street', 'legislativeStreet', 0.16],
        ['closeup', 'legislativeCloseup', 0.055],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Federico Corral released the exact Qualla photograph to the public domain. Native OpenStreetMap footprint ODbL 1.0.',
};
