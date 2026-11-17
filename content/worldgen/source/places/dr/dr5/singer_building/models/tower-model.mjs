/** Original exterior reconstruction of Ernest Flagg's 1908 Singer and Bourne complex. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.84 },
  limestone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.82 },
  bluestone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.92 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.86 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.67, metallic: 0.26 },
  glass: {
    slot: 'window',
    localRef: 'palette:#263532',
    name: 'Recessed period glazing',
    roughness: 0.42,
  },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.68, metallic: 0.39 },
};
const shade = {
  brick: [0.63, 0.285, 0.215],
  wing: [0.48, 0.26, 0.209],
  brickLight: [0.69, 0.35, 0.273],
  limestone: [0.83, 0.755, 0.617],
  pale: [0.898, 0.825, 0.702],
  shadow: [0.56, 0.492, 0.38],
  bluestone: [0.37, 0.417, 0.406],
  sill: [0.51, 0.526, 0.49],
  slate: [0.262, 0.318, 0.351],
  copper: [0.42, 0.52, 0.47],
  ridge: [0.57, 0.62, 0.499],
  glass: [0.138, 0.19, 0.218],
  pane: [0.245, 0.295, 0.304],
  bronze: [0.284, 0.207, 0.139],
  clock: [0.84, 0.755, 0.56],
};

const profile = (x, y, z, w, d) => [
  [x - w, y, z - d],
  [x - w, y, z + d],
  [x + w, y, z + d],
  [x + w, y, z - d],
];
const depth = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const tau = 2 * Math.PI;
const color = (key, variation = 1) => shade[key].map((v) => v * variation);

function plate(out, slot, points, tint) {
  const forward = points.toReversed();
  out.addQuad(slot, '', forward, normalFor(...forward), undefined, tint);
}

function wall(out, a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [-u[1], u[0]];
  function point(x, y, z = 0) {
    return [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[1] * z];
  }
  function rect(slot, x, y, w, h, z, tint) {
    plate(
      out,
      slot,
      [
        point(x - w / 2, y + h, z),
        point(x + w / 2, y + h, z),
        point(x + w / 2, y, z),
        point(x - w / 2, y, z),
      ],
      color(tint),
    );
  }
  function molding(slot, x, y, w, h, z, tint, back = -0.04) {
    const lo = y,
      hi = y + h,
      l = x - w / 2,
      r = x + w / 2;
    rect(slot, x, y, w, h, z, tint);
    plate(
      out,
      slot,
      [point(l, hi, back), point(r, hi, back), point(r, hi, z), point(l, hi, z)],
      color(tint),
    );
    plate(
      out,
      slot,
      [point(l, lo, z), point(r, lo, z), point(r, lo, back), point(l, lo, back)],
      color(tint),
    );
    plate(
      out,
      slot,
      [point(l, lo, z), point(l, lo, back), point(l, hi, back), point(l, hi, z)],
      color(tint),
    );
    plate(
      out,
      slot,
      [point(r, lo, back), point(r, lo, z), point(r, hi, z), point(r, hi, back)],
      color(tint),
    );
  }
  return { len, point, rect, molding };
}

function ringTrim(out, rows, tint = 'limestone', slot = 'limestone', x = 0, z = 0) {
  loft(
    out,
    slot,
    rows.map(([y, w, d = w]) => profile(x, y, z, w, d)),
    color(tint),
  );
}

function windows(w, cx, y, width, height, paneCount, d, projection = 0.021, tint = 'glass') {
  w.rect('glass', cx, y, width, height, projection, tint);
  if (d < 3) return;
  const jamb = 0.09;
  for (const sign of [-1, 1])
    w.rect(
      'bronze',
      cx + (sign * (width - jamb)) / 2,
      y,
      jamb,
      height,
      projection + 0.024,
      'bronze',
    );
  for (let i = 1; i < paneCount; i++)
    w.rect(
      'bronze',
      cx - width / 2 + (i * width) / paneCount,
      y,
      i === 3 || i === 8 ? 0.105 : 0.048,
      height,
      projection + 0.026,
      'bronze',
    );
  const rows = d >= 3 ? 3 : 2;
  for (let i = 1; i < rows; i++)
    w.rect('bronze', cx, y + (height * i) / rows, width, 0.051, projection + 0.041, 'bronze');
}

function arch(
  out,
  w,
  {
    cx,
    y,
    width,
    spring,
    rise,
    projection = 0.023,
    slot = 'limestone',
    tint = 'limestone',
    frame = 0.38,
    steps = 12,
    d = 1,
    infill = 'glass',
    fillTint = 'glass',
  },
) {
  const r = width / 2,
    edges = [-1, 1];
  w.rect(infill, cx, y, width, spring - y, projection, fillTint);
  const at = (i, extra, z) =>
    w.point(
      cx + (r + extra) * Math.cos((Math.PI * i) / steps),
      spring + (rise + extra) * Math.sin((Math.PI * i) / steps),
      z,
    );
  for (let i = 1; i <= steps; i++) {
    const mid = w.point(cx, spring, projection),
      a = at(i - 1, 0, projection),
      b = at(i, 0, projection);
    const tri = [mid, a, b];
    out.addTriangle(infill, '', tri, normalFor(...tri), undefined, color(fillTint));
    const points = [a, b, at(i, frame, projection + 0.15), at(i - 1, frame, projection + 0.15)];
    plate(out, slot, points, color(tint, d >= 3 ? 0.94 + (i % 4) * 0.024 : 1));
  }
  for (const side of edges)
    (d === 1 ? w.rect : w.molding)(
      slot,
      cx + side * (r + frame / 2),
      y,
      frame,
      spring - y,
      projection + 0.153,
      tint,
    );
}

function rotatedDisc(out, w, slot, x, y, r, z, tint, n) {
  for (let i = 0; i < n; i++) {
    const a = (tau * i) / n,
      b = (tau * (i + 1)) / n;
    const p = [
      w.point(x, y, z),
      w.point(x + r * Math.cos(a), y + r * Math.sin(a), z),
      w.point(x + r * Math.cos(b), y + r * Math.sin(b), z),
    ];
    out.addTriangle(slot, '', p, normalFor(...p), undefined, color(tint));
  }
}

function pediment(out, w, x, y, half, rise, z) {
  const a = w.point(x - half, y, z),
    b = w.point(x + half, y, z),
    c = w.point(x, y + rise, z);
  for (const [p, q] of [
    [a, c],
    [c, b],
  ])
    beam(out, 'limestone', p, q, 0.16, 0.24, color('pale'));
  w.rect('limestone', x, y - 0.04, half * 2, 0.14, z + 0.01, 'limestone');
}

function wings(out, d) {
  const roofHeights = [46.3, 44.4, 43.1],
    foundation = 13.05;
  for (const [j, footprint] of layout.footprints.entries()) {
    const top = roofHeights[j],
      bounds = [
        Math.min(...footprint.map((p) => p[0])),
        Math.max(...footprint.map((p) => p[0])),
        footprint[0][1],
        Math.max(...footprint.map((p) => p[1])),
      ];
    const [min, max, back, front] = bounds,
      center = (min + max) / 2,
      mid = (back + front) / 2,
      hw = (max - min) / 2;
    // The slightly skewed Liberty Street wall is the historical ground-plan edge.
    const south = footprint[1][0],
      roofBack = j === 0 ? -12.1 : back;
    const roofDepth = (front - roofBack) / 2,
      roofCenter = (front + roofBack) / 2;
    const baseRoofHalf = Math.min(hw, (max - south) / 2);
    const outline = (y) => footprint.map(([x, z]) => [x, y, z]);
    const roofSlab = (x1, x2, z1, z2, y) =>
      plate(
        out,
        'copper',
        [
          [x1, y, z1],
          [x2, y, z1],
          [x2, y, z2],
          [x1, y, z2],
        ],
        color('copper'),
      );
    if (j === 0) {
      roofSlab(south, max, roofBack, front, top);
      roofSlab(south, 8.65, back, roofBack, top);
    } else if (j === 1) {
      roofSlab(south, 2, back, front, top);
      roofSlab(2, max, -21.9, front, top);
    } else roofSlab(south, max, back, front, top);
    loft(out, 'bluestone', [outline(-1.38), outline(foundation)], color('bluestone'), {
      cap: false,
    });
    loft(out, 'brick', [outline(foundation), outline(top)], color(j ? 'wing' : 'brick'), {
      cap: false,
    });
    const rise = j === 0 ? 10.8 : j === 1 ? 6.9 : 4.8;
    const rings = [
      [top, baseRoofHalf + 0.15, roofDepth + 0.12],
      [top + rise * 0.2, baseRoofHalf - 0.57, roofDepth - 0.68],
      [top + rise * 0.79, baseRoofHalf - 3.2, roofDepth - 3.2],
      [top + rise, baseRoofHalf - 4.75, roofDepth - 4.45],
    ];
    ringTrim(out, rings, 'copper', 'copper', (max + south) / 2, roofCenter);
    if (j === 0)
      ringTrim(
        out,
        [
          [55.2, 10.12, 10.48],
          [57.8, 10.05, 10.36],
        ],
        'brick',
        'brick',
      );
    for (let k = 0; k < footprint.length; k++) {
      const a = footprint[k],
        b = footprint[(k + 1) % footprint.length],
        w = wall(out, a, b),
        l = w.len;
      const broad = j === 0 && k === 1,
        facingLiberty = k === 0;
      const count = broad ? 5 : Math.max(1, Math.round(l / (facingLiberty ? 5.2 : 5.8)));
      if (d === 0) {
        for (const level of [18, 28, 38])
          w.rect('glass', l / 2, level, l - 0.46, 1.32, 0.026, 'pane');
        w.rect('limestone', l / 2, top - 1.3, l, 0.91, 0.032, 'limestone');
        continue;
      }
      const tiers =
        d === 1
          ? [1.15, 14.2, 24.5, 34.8, 41.2]
          : [1.0, 5.45, 9.15, 14.0, 17.22, 20.42, 23.61, 26.81, 30.0, 33.2, 36.38, 39.44, 42.02];
      for (const h of d === 1
        ? [12.91, top - 0.8]
        : d === 2
          ? [8.78, 12.91, top - 0.8]
          : [4.99, 8.78, 12.91, top - 4.65, top - 0.8])
        (d === 1 ? w.rect : w.molding)(
          h < 13 ? 'bluestone' : 'limestone',
          l / 2,
          h,
          l,
          h === top - 0.8 ? 0.8 : 0.34,
          h === top - 0.8 ? 0.69 : 0.21,
          h < 13 ? 'sill' : 'limestone',
        );
      const step = l / count;
      for (let i = 0; i < count; i++) {
        const x = step * (i + 0.5),
          width = Math.min(step * 0.65, broad ? 4.52 : 3.2),
          entry = broad && i === 2;
        for (const [floor, y] of tiers.entries()) {
          if (y > top - 1.15 || (entry && y < 12.9)) continue;
          const h = y < 13 ? Math.min(3.42, 12.58 - y) : Math.min(2.15, top - y - 0.6);
          const narrow = y > top - 5 ? 0.86 : 1;
          const frameSlot = y < 13 ? 'bluestone' : 'limestone',
            frameTint = y < 13 ? 'sill' : 'limestone';
          if (d >= 3 || (d === 2 && (broad || facingLiberty)))
            w.rect(frameSlot, x, y - 0.11, width * narrow + 0.25, h + 0.28, 0.057, frameTint);
          windows(
            w,
            x,
            y,
            width * narrow,
            h,
            y < 13 ? 3 : 2,
            d,
            0.079,
            floor % 4 === 0 ? 'pane' : 'glass',
          );
          if (d >= 2) {
            if (d >= 3 || broad)
              (d === 2 ? w.rect : w.molding)(
                frameSlot,
                x,
                y - 0.13,
                width * narrow + 0.48,
                0.16,
                0.19,
                frameTint,
              );
            if ((d >= 3 || broad) && y > 13 && y < top - 4.9)
              w.rect('limestone', x, y + h + 0.074, width + 0.36, 0.14, 0.085, 'pale');
          }
        }
        if (entry) {
          arch(out, w, {
            cx: x,
            y: 0.05,
            width: 4.92,
            spring: 8.25,
            rise: 2.46,
            frame: 0.63,
            steps: d < 2 ? 8 : 18,
            d,
          });
          (d === 1 ? w.rect : w.molding)('limestone', x, 10.93, 1.37, 0.84, 0.23, 'pale');
          if (d >= 2) {
            for (let i = -4; i <= 4; i++)
              w.rect('bronze', x + i * 0.47, 0.1, 0.085, 8.15, 0.082, 'bronze');
            w.rect('bronze', x, 2.57, 4.75, 0.13, 0.092, 'bronze');
            w.rect('bronze', x, 5.8, 4.75, 0.13, 0.092, 'bronze');
            rotatedDisc(out, w, 'bronze', x, 7.0, 0.71, 0.118, 'bronze', 16);
            rotatedDisc(out, w, 'limestone', x, 7.0, 0.56, 0.131, 'clock', 16);
            w.rect('bronze', x, 6.98, 0.047, 0.39, 0.143, 'bronze');
            w.rect('bronze', x - 0.121, 6.99, 0.26, 0.047, 0.147, 'bronze');
          }
        }
        if ((broad || facingLiberty) && l > 8 && (d >= 2 || (broad && i % 2 === 0))) {
          const roofPosition = w.point(x, top, 0);
          const dormer = wall(
            out,
            [
              roofPosition[0] - ((b[0] - a[0]) * 1.38) / l,
              roofPosition[2] - ((b[1] - a[1]) * 1.38) / l,
            ],
            [
              roofPosition[0] + ((b[0] - a[0]) * 1.38) / l,
              roofPosition[2] + ((b[1] - a[1]) * 1.38) / l,
            ],
          );
          const dormerDepth = j === 0 ? 0.89 : 0.6;
          dormer.molding(
            'limestone',
            1.38,
            top - 0.1,
            2.76,
            j === 0 ? 3.4 : 2.58,
            -0.26,
            'limestone',
            -dormerDepth - 2.25,
          );
          windows(dormer, 1.38, top + 0.26, 2.18, j === 0 ? 2.49 : 1.82, 3, d, -0.245);
          if (d >= 2) pediment(out, dormer, 1.38, top + (j === 0 ? 3.3 : 2.48), 1.42, 0.95, -0.252);
        }
        if (d >= 3 && broad && !entry) pediment(out, w, x, 24.29, width * 0.54, 0.62, 0.127);
        if (d === 4 && broad && i % 2 === 0)
          rotatedDisc(out, w, 'limestone', x, 25.1, 0.34, 0.158, 'pale', 18);
      }
      if (d >= 2 && (broad || d >= 3)) {
        for (let i = 1; i < count; i++) {
          const x = i * step;
          w.molding('brick', x, 13.3, 0.54, top - 15.34, 0.26, 'brickLight');
          w.molding('limestone', x, top - 2.44, 0.39, 1.63, 0.53, 'shadow');
        }
        if (broad || facingLiberty)
          for (let x = 0.41; x < l - 0.32; x += d === 2 ? 1.62 : 0.81)
            w.molding('limestone', x, top - 1.28, 0.28, 0.42, 0.58, 'shadow');
      }
    }
    if (d >= 3 && j > 0) {
      box(
        out,
        'bluestone',
        [center - 1.36, top + rise - 0.15, mid - 1.42],
        [center + 1.36, top + rise + 2.2, mid + 1.42],
        color('bluestone'),
      );
      box(
        out,
        'copper',
        [center - 1.57, top + rise + 2.17, mid - 1.59],
        [center + 1.57, top + rise + 2.44, mid + 1.59],
        color('ridge'),
      );
    }
  }
}

function balcony(out, w, x, y, width, projection, d) {
  const angles = d === 0 ? 2 : d <= 2 ? 5 : 9;
  const face = (i, h, extra = 0) => {
    const f = i / angles,
      arch = Math.sin(Math.PI * f);
    return w.point(x - width / 2 + width * f, y + h, 0.36 + projection * arch + extra);
  };
  for (let i = 0; i < angles; i++) {
    const p = face(i, 0),
      q = face(i + 1, 0);
    plate(out, 'limestone', [face(i, 0.76), face(i + 1, 0.76), q, p], color('pale'));
    plate(
      out,
      'limestone',
      [face(i, 0.76, -0.19), face(i + 1, 0.76, -0.19), face(i + 1, 0.76), face(i, 0.76)],
      color('limestone'),
    );
    if (d >= 2) {
      plate(
        out,
        'limestone',
        [
          p,
          q,
          w.point(x - width / 2 + (width * (i + 1)) / angles, y - 0.33, 0.045),
          w.point(x - width / 2 + (width * i) / angles, y - 0.33, 0.045),
        ],
        color('shadow'),
      );
      beam(out, 'bronze', face(i, 1.76), face(i + 1, 1.76), 0.078, 0.086, color('bronze'));
      beam(out, 'bronze', face(i, 0.74), face(i, 1.76), 0.06, 0.06, color('bronze'));
      if (d >= 3 && i > 0)
        beam(
          out,
          'limestone',
          face(i, -0.17, -0.25),
          w.point(x - width / 2 + (width * i) / angles, y - 1.24, 0.06),
          0.24,
          0.25,
          color('shadow'),
        );
    }
  }
}

function shaft(out, d) {
  const t = layout.tower,
    r = t.half,
    base = t.base,
    upper = t.crown;
  const corners = [
    [-r, -r],
    [-r, r],
    [r, r],
    [r, -r],
  ];
  ringTrim(
    out,
    [
      [base - 0.48, r + 0.2],
      [upper + 2.05, r + 0.2],
    ],
    'brick',
    'brick',
  );
  ringTrim(
    out,
    [
      [upper, r + 0.02],
      [156.8, r + 0.45],
      [t.eave, r + 0.53],
    ],
    'brick',
    'brick',
  );
  for (const band of d === 0
    ? [70.4, 91.4, 112.5, 137.1, 159.62]
    : [base + 0.22, 67.6, 70.4, 88.6, 91.4, 109.7, 112.5, 135.5, 137.1, 158.5, 159.62]) {
    const broad = band > 134 ? 0.63 : 0.22;
    ringTrim(
      out,
      [
        [band, r + 0.075],
        [band + 0.27, r + 0.13 + broad],
        [band + 0.53, r + 0.13 + broad],
      ],
      'limestone',
    );
  }
  for (let i = 0; i < 4; i++) {
    const w = wall(out, corners[i], corners[(i + 1) % 4]),
      mid = w.len / 2;
    if (d === 0) {
      for (let y = 61; y < 134; y += 5.6) w.rect('glass', mid, y, 9.9, 1.8, 0.252, 'pane');
    } else {
      for (const x of [mid - 5.21, mid + 5.21])
        w.molding('limestone', x, base + 1.4, 0.39, upper - base - 1.7, 0.36, 'limestone');
      for (let j = 0; j < 21; j += d === 1 ? 2 : 1) {
        const y = 59.36 + 3.572 * j;
        for (const [k, [offset, width, panes]] of [
          [-3.63, 2.45, 3],
          [0, 4.23, 5],
          [3.63, 2.45, 3],
        ].entries()) {
          const tint = (i + j + k) % 5 === 0 ? 'pane' : 'glass';
          if (d >= 2)
            w.rect('limestone', mid + offset, y - 0.16, width + 0.19, 2.37, 0.259, 'shadow');
          windows(w, mid + offset, y, width, 2.08, panes, d, 0.28, tint);
        }
        for (const side of [-1, 1]) {
          const x = mid + side * 7.74;
          windows(w, x, y + 0.33, 1.31, 1.46, 2, d, 0.28);
          if (d >= 2) w.rect('limestone', x, y + 0.18, 1.56, 0.15, 0.29, 'limestone');
        }
      }
    }
    for (const y of [70.91, 91.91, 112.98])
      balcony(out, w, mid, y, 10.95, d === 0 ? 0.85 : 1.14, d);
    balcony(out, w, mid, 138.0, 12.6, 1.81, d);
    const detail = d >= 2,
      skin = detail ? 0.55 : 0.51;
    if (d === 0) {
      w.rect('glass', mid, 140.01, 9.8, 12.32, skin, 'glass');
      continue;
    }
    const cx = mid,
      crownBottom = 139.02,
      archSpring = 152,
      archR = 5.8;
    arch(out, w, {
      cx,
      y: crownBottom,
      width: 11.4,
      spring: archSpring,
      rise: archR,
      projection: skin,
      frame: 0.62,
      steps: d >= 3 ? 19 : d === 2 ? 12 : 8,
      d,
      infill: 'limestone',
      fillTint: 'shadow',
    });
    if (d >= 1) {
      for (const side of [-1, 1]) {
        const x = mid + side * 7.92;
        w.molding('limestone', x, 140.2, 2.49, 13.8, 0.53, 'limestone', 0.31);
        windows(w, x, 141.04, 1.55, 11.6, 2, d, 0.553);
        rotatedDisc(out, w, 'limestone', x, 156.07, 0.95, 0.564, 'pale', detail ? 16 : 8);
        rotatedDisc(out, w, 'glass', x, 156.07, 0.68, 0.576, 'glass', detail ? 16 : 8);
      }
      w.molding('limestone', mid, 140.25, 7.63, 0.48, skin + 0.22, 'limestone', skin);
      w.molding('limestone', mid, 148.88, 7.9, 0.42, skin + 0.25, 'pale', skin);
      pediment(out, w, mid, 149.38, 3.93, 1.62, skin + 0.22);
      for (const side of [-1, 1]) {
        w.molding('limestone', mid + side * 3.65, 140.8, 0.38, 8.1, skin + 0.23, 'limestone', skin);
        w.rect('limestone', mid + side * 1.24, 140.8, 0.22, 8.1, skin + 0.088, 'limestone');
      }
      w.rect('limestone', mid, 144.7, 7.4, 0.19, skin + 0.174, 'limestone');
      for (const x of [-2.46, 0, 2.46])
        windows(w, mid + x, 140.85, 2.17, 7.95, 2, d, skin + 0.126, 'glass');
      w.rect('glass', mid, 152.07, 4.65, 1.63, skin + 0.13, 'pane');
    }
    if (detail) {
      for (let x = 0.43; x < w.len - 0.27; x += 0.58)
        w.molding('limestone', x, 158.78, 0.19, 0.48, 0.75, 'shadow', 0.41);
      for (let j = 1; j < 17; j += d === 2 ? 2 : 1) {
        const a = (j / 17) * Math.PI,
          x = mid + 6.08 * Math.cos(a),
          y = archSpring + 5.62 * Math.sin(a);
        w.molding('limestone', x, y, 0.135, 0.165, skin + 0.255, 'pale', skin + 0.092);
        if (d === 4) rotatedDisc(out, w, 'limestone', x, y, 0.113, skin + 0.267, 'shadow', 9);
      }
      for (const x of [mid - 7.73, mid + 7.73])
        w.molding('limestone', x, 137.25, 0.34, 0.81, 0.78, 'shadow', 0.45);
    }
  }
}

function crown(out, d) {
  const t = layout.tower;
  // The mansard is a genuinely curved, square bell with four flattened front faces.
  const rows = [
    [t.eave - 0.04, 10.49],
    [162.44, 10.22],
    [165.52, 9.31],
    [168.36, 8.01],
    [170.53, 6.61],
    [172.55, 4.97],
    [t.bell, 3.77],
  ];
  ringTrim(out, d ? rows : rows.filter((_, i) => i % 2 === 0), 'slate', 'slate');
  ringTrim(
    out,
    [
      [t.bell - 0.17, 3.85],
      [t.bell + 0.37, 3.85],
    ],
    'ridge',
    'copper',
  );
  ringTrim(
    out,
    [
      [173.7, 3.04],
      [175.3, 3.06],
      [175.62, 2.62],
      [182.0, 2.62],
      [182.33, 2.94],
    ],
    'copper',
    'copper',
  );
  ringTrim(
    out,
    [
      [182.1, 2.94],
      [183.0, 2.32],
      [184.13, 1.6],
      [185.43, 0.98],
      [t.lantern, 0.4],
    ],
    'ridge',
    'copper',
  );
  loft(
    out,
    'bronze',
    [
      radialRing(t.lantern - 0.13, 0.127, 0.127, d >= 2 ? 8 : 5),
      radialRing(t.flagpole, 0.066, 0.066, d >= 2 ? 8 : 5),
    ],
    color('bronze'),
  );
  for (const [x, z] of [
    [-10.62, 10.62],
    [10.62, 10.62],
    [10.62, -10.62],
    [-10.62, -10.62],
  ]) {
    const p = [
      [159.76, 0.6],
      [160.22, 0.61],
      [160.38, 0.35],
      [161.23, 0.25],
      [161.5, 0.53],
      [162.28, 0.7],
      [162.9, 0.46],
      [163.37, 0.21],
      [163.56, 0.11],
    ];
    loft(
      out,
      'limestone',
      (d ? p : p.filter((_, i) => i === 0 || i === 5 || i === 8)).map(([h, r]) =>
        radialRing(h, r, r, d >= 2 ? 12 : d === 1 ? 6 : 4, [x, z]),
      ),
      color('pale'),
    );
  }
  if (d === 0) return;
  for (let i = 0; i < 4; i++) {
    const a = profile(0, 0, 0, 1, 1)[i],
      b = profile(0, 0, 0, 1, 1)[(i + 1) % 4];
    const face = (r) => wall(out, [a[0] * r, a[2] * r], [b[0] * r, b[2] * r]);
    const lantern = face(2.63);
    arch(out, lantern, {
      cx: lantern.len / 2,
      y: 176.03,
      width: 2.41,
      spring: 179.85,
      rise: 1.1,
      frame: 0.19,
      steps: d >= 2 ? 12 : 7,
      d,
      tint: 'ridge',
      slot: 'copper',
    });
    if (d >= 2)
      for (const sign of [-1, 1])
        lantern.rect('copper', lantern.len / 2 + sign * 0.41, 176.03, 0.058, 4.64, 0.059, 'ridge');
    const dormers = face(10.28);
    for (const x of [-4.51, 0, 4.51]) {
      dormers.molding('slate', dormers.len / 2 + x, 162.06, 2.25, 1.67, 0.15, 'slate', -1.6);
      arch(out, dormers, {
        cx: dormers.len / 2 + x,
        y: 162.12,
        width: 1.66,
        spring: 163.55,
        rise: 0.73,
        frame: 0.21,
        steps: d >= 2 ? 12 : 6,
        d,
      });
    }
    const upper = face(1),
      x = upper.len / 2;
    const skylight = [
      [167.49, 8.57, 2.07],
      [168.36, 8.17, 1.92],
      [170.53, 6.77, 1.61],
      [171.0, 6.53, 1.5],
    ];
    const pane = (i, f) => {
      const [y, z, w] = skylight[i];
      return upper.point(x + f * w, y, z - 1);
    };
    for (let j = 1; j < skylight.length; j++) {
      plate(
        out,
        'glass',
        [pane(j, -1), pane(j, 1), pane(j - 1, 1), pane(j - 1, -1)],
        color('glass'),
      );
      if (d >= 2)
        for (const f of [-1, 0, 1])
          beam(out, 'copper', pane(j - 1, f), pane(j, f), 0.12, 0.15, color('ridge'));
    }
    if (d >= 2) {
      for (const side of [-1, 1]) {
        const window = face(9.58);
        rotatedDisc(
          out,
          window,
          'limestone',
          window.len / 2 + side * 7.02,
          165.27,
          0.91,
          0.05,
          'limestone',
          14,
        );
        rotatedDisc(
          out,
          window,
          'glass',
          window.len / 2 + side * 7.02,
          165.27,
          0.64,
          0.067,
          'glass',
          14,
        );
      }
    }
    const crest = face(3.84);
    if (d >= 2) {
      for (let x = 0.31; x < crest.len - 0.18; x += 0.51)
        beam(
          out,
          'copper',
          crest.point(x, t.bell + 0.22),
          crest.point(x, t.bell + 0.79),
          0.068,
          0.075,
          color('ridge'),
        );
      beam(
        out,
        'copper',
        crest.point(0.02, t.bell + 0.72),
        crest.point(crest.len - 0.02, t.bell + 0.72),
        0.085,
        0.095,
        color('ridge'),
      );
    }
  }
}

export function buildTowerLevel(out, level) {
  const d = depth[level];
  wings(out, d);
  shaft(out, d);
  crown(out, d);
}
export const buildSkyline = (out) => buildTowerLevel(out, 'skyline');
export const buildDistrict = (out) => buildTowerLevel(out, 'district');
export const buildStreet = (out) => buildTowerLevel(out, 'street');
export const buildCloseup = (out) => buildTowerLevel(out, 'closeup');
export const buildMaster = (out) => buildTowerLevel(out, 'master');
