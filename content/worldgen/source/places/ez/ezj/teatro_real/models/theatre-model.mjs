/** Teatro Real, modeled from the PMTiles footprint and the two photographed plaza fronts. */
import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const theatreSurfaces = {
  wall: { slot: 'wall', graph: 'stucco' },
  stone: { slot: 'trim', graph: 'stone_limestone_raw' },
  base: { slot: 'foundation', graph: 'stone_granite' },
  zinc: { slot: 'roof', graph: 'metal_standing_seam' },
  glazing: { slot: 'window', graph: 'window_punched' },
  metal: { slot: 'trim', graph: 'metal_painted' },
};

const levelIndex = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const swatches = {
  wall: 'dfd9d2',
  side: 'd9d1ca',
  pale: 'ede7db',
  band: 'e4dfd5',
  ashlar: 'cbc3b9',
  base: 'ada59e',
  darkStone: 'aca8a2',
  zinc: '768493',
  zincLight: '8996a1',
  zincDark: '667485',
  terrace: 'b7b3a9',
  glass: '69757c',
  metal: '41484c',
  sash: '697379',
  black: '393d3f',
  blueGlass: '4a5a70',
};
const colors = Object.fromEntries(
  Object.entries(swatches).map(([name, hex]) => [
    name,
    hex.match(/../g).map((pair) => {
      const v = Number.parseInt(pair, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const ref = 'palette:#ffffff';
const mix = (a, b, t) => a + (b - a) * t;
const mid = (a, b) => a.map((v, i) => (v + b[i]) / 2);
const around = (points) => points.map((a, i) => [a, points[(i + 1) % points.length]]);

function face(out, slot, tone, points, outward) {
  const n = normalFor(...points);
  if (n.reduce((sum, v, i) => sum + v * outward[i], 0) < 0) points = points.toReversed();
  const tris =
    points.length === 3 ? [points] : [points.slice(0, 3), [points[0], points[2], points[3]]];
  for (const t of tris) out.addTriangle(slot, ref, t, normalFor(...t), undefined, colors[tone]);
}

function lineFrame(a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    dx = (b[0] - a[0]) / length,
    dz = (b[1] - a[1]) / length;
  return {
    start: 0,
    end: length,
    front: [dz, 0, -dx],
    right: [dx, 0, dz],
    cuts: [],
    p: (u, y, w = 0) => [a[0] + dx * u + dz * w, y, a[1] + dz * u - dx * w],
  };
}

function plazaFrame({ line, direction }) {
  const floor = line[0][1],
    ceiling = line.at(-1)[1];
  const cuts = line
    .slice(1, -1)
    .map((p) => p[1])
    .sort((a, b) => a - b);
  return {
    start: floor,
    end: ceiling,
    front: [direction, 0, 0],
    right: [0, 0, 1],
    cuts,
    p: (z, y, w = 0) => {
      let i = line.findIndex((p) => p[1] >= z);
      if (i === -1) i = line.length - 1;
      if (i === 0) i = 1;
      const a = line[i - 1],
        b = line[i];
      return [mix(a[0], b[0], (z - a[1]) / (b[1] - a[1])) + direction * w, y, z];
    },
  };
}

function panel(out, f, slot, tone, u0, u1, y0, y1, w = 0) {
  const cuts = [u0, ...f.cuts.filter((z) => z > u0 + 0.0001 && z < u1 - 0.0001), u1];
  for (let i = 1; i < cuts.length; i++) {
    const a = cuts[i - 1],
      b = cuts[i];
    let points = [f.p(a, y0, w), f.p(b, y0, w), f.p(b, y1, w), f.p(a, y1, w)];
    if (slot === 'glazing') {
      const n = normalFor(...points);
      if (n.reduce((sum, v, j) => sum + v * f.front[j], 0) < 0) points = points.toReversed();
      out.addQuad(
        slot,
        'metric:uv',
        points,
        normalFor(...points),
        [
          [0.22, 0.22],
          [0.78, 0.22],
          [0.78, 0.78],
          [0.22, 0.78],
        ],
        colors[tone],
      );
    } else face(out, slot, tone, points, f.front);
  }
}

function block(out, f, slot, tone, u0, u1, y0, y1, w0, w1) {
  const bottom = [
    [u0, w0],
    [u1, w0],
    [u1, w1],
    [u0, w1],
  ].map(([u, w]) => f.p(u, y0, w));
  const top = bottom.map(([x, , z]) => [x, y1, z]);
  const center = mid(bottom[0], bottom[2]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      q = mid(bottom[i], bottom[j]);
    face(
      out,
      slot,
      tone,
      [bottom[i], bottom[j], top[j], top[i]],
      [q[0] - center[0], 0, q[2] - center[2]],
    );
  }
  face(out, slot, tone, top, [0, 1, 0]);
  face(out, slot, tone, bottom, [0, -1, 0]);
}

const arch = (u, y, rise, r, n) =>
  Array.from({ length: n + 1 }, (_, i) => [
    u - r * Math.cos((Math.PI * i) / n),
    y + rise * Math.sin((Math.PI * i) / n),
  ]);
function portalRow(out, f, entrance, tier) {
  const { portals, radius, springY, rise, bandTop } = entrance;
  const count = [4, 6, 10, 14, 18][tier],
    back = -1.65;
  let previous = f.start;
  for (const { z, threshold } of portals) {
    const l = z - radius,
      r = z + radius;
    panel(out, f, 'wall', 'ashlar', previous, l, -2.8, bandTop);
    panel(out, f, 'base', 'base', l, r, -2.8, threshold);
    const inner = arch(z, springY, rise, radius, count),
      outer = arch(z, springY, rise + 0.28, radius + 0.28, count);
    for (let i = 1; i < inner.length; i++) {
      const [a, b] = [inner[i - 1], inner[i]];
      face(
        out,
        'wall',
        'ashlar',
        [f.p(...a), f.p(...b), f.p(b[0], bandTop), f.p(a[0], bandTop)],
        f.front,
      );
      face(
        out,
        'stone',
        'darkStone',
        [f.p(...a), f.p(...b), f.p(...b, back), f.p(...a, back)],
        [0, -1, 0],
      );
      face(
        out,
        'stone',
        i === Math.floor(count / 2) + 1 ? 'band' : 'pale',
        [a, b, outer[i], outer[i - 1]].map((p) => f.p(...p, 0.106)),
        f.front,
      );
      const center = f.p(z, springY, back);
      face(out, 'metal', 'glass', [center, f.p(...a, back), f.p(...b, back)], f.front);
    }
    for (const side of [-1, 1]) {
      const u = z + side * radius;
      face(
        out,
        'stone',
        'ashlar',
        [f.p(u, threshold), f.p(u, springY), f.p(u, springY, back), f.p(u, threshold, back)],
        f.right.map((v) => -v * side),
      );
      if (tier)
        block(
          out,
          f,
          'stone',
          'pale',
          u + (side < 0 ? -0.3 : 0),
          u + (side < 0 ? 0 : 0.3),
          threshold,
          springY,
          -0.03,
          0.12,
        );
    }
    panel(out, f, 'glazing', 'glass', l, r, threshold, springY, back);
    face(
      out,
      'base',
      'base',
      [
        f.p(l, threshold, back),
        f.p(r, threshold, back),
        f.p(r, threshold, 0.33),
        f.p(l, threshold, 0.33),
      ],
      [0, 1, 0],
    );
    if (tier >= 2) {
      block(out, f, 'base', 'base', l - 0.1, r + 0.1, threshold - 0.18, threshold, -0.11, 0.34);
      for (const u of [z, z - radius * 0.49, z + radius * 0.49])
        block(
          out,
          f,
          'metal',
          'metal',
          u - 0.035,
          u + 0.035,
          threshold + 0.035,
          springY - 0.12,
          back + 0.016,
          back + 0.084,
        );
      block(
        out,
        f,
        'metal',
        'sash',
        l + 0.05,
        r - 0.05,
        springY - 0.1,
        springY + 0.035,
        back + 0.023,
        back + 0.084,
      );
      if (tier >= 3) {
        block(
          out,
          f,
          'metal',
          'metal',
          l + 0.1,
          r - 0.1,
          threshold + 1.26,
          threshold + 1.33,
          back + 0.023,
          back + 0.084,
        );
        for (const u of [z - 0.13, z + 0.13])
          block(
            out,
            f,
            'metal',
            'sash',
            u - 0.016,
            u + 0.016,
            threshold + 0.85,
            threshold + 1.12,
            back + 0.075,
            back + 0.151,
          );
        block(
          out,
          f,
          'stone',
          'pale',
          z - 0.16,
          z + 0.16,
          springY + rise + 0.09,
          springY + rise + 0.42,
          0.093,
          0.24,
        );
      }
    }
    previous = r;
  }
  panel(out, f, 'wall', 'ashlar', previous, f.end, -2.8, bandTop);
}

function windowBand(out, f, { bottom, top, centers, width, sill, head, tone = 'wall' }, tier) {
  let previous = f.start;
  for (const u of centers) {
    const l = u - width / 2,
      r = u + width / 2;
    panel(out, f, 'wall', tone, previous, l, bottom, top);
    panel(out, f, 'wall', tone, l, r, bottom, sill);
    panel(out, f, 'wall', tone, l, r, head, top);
    const depth = tier >= 2 ? 0.42 : 0.2;
    panel(out, f, 'glazing', 'glass', l, r, sill, head, -depth);
    for (const sign of [-1, 1]) {
      const v = u + (sign * width) / 2;
      face(
        out,
        'stone',
        'ashlar',
        [f.p(v, sill), f.p(v, head), f.p(v, head, -depth), f.p(v, sill, -depth)],
        f.right.map((n) => -sign * n),
      );
    }
    face(
      out,
      'stone',
      'pale',
      [f.p(l, sill), f.p(r, sill), f.p(r, sill, -depth), f.p(l, sill, -depth)],
      [0, 1, 0],
    );
    face(
      out,
      'stone',
      'ashlar',
      [f.p(l, head), f.p(r, head), f.p(r, head, -depth), f.p(l, head, -depth)],
      [0, -1, 0],
    );
    if (tier >= 2) {
      block(out, f, 'stone', 'pale', l - 0.14, r + 0.14, sill - 0.17, sill - 0.035, -0.07, 0.14);
      block(out, f, 'stone', 'band', l - 0.11, r + 0.11, head + 0.035, head + 0.19, -0.07, 0.11);
      if (tier >= 3) {
        block(
          out,
          f,
          'metal',
          'metal',
          u - 0.036,
          u + 0.036,
          sill,
          head,
          -depth + 0.025,
          -depth + 0.08,
        );
        const bar = sill + (head - sill) * 0.56;
        block(
          out,
          f,
          'metal',
          'sash',
          l,
          r,
          bar - 0.027,
          bar + 0.027,
          -depth + 0.025,
          -depth + 0.08,
        );
      }
    }
    previous = r;
  }
  panel(out, f, 'wall', tone, previous, f.end, bottom, top);
}

const spacing = (a, b, n) => Array.from({ length: n }, (_, i) => mix(a, b, (i + 0.5) / n));
function surrounds(out, f, positions, bottom, top, tier) {
  if (!tier) return;
  for (const u of positions) {
    block(out, f, 'stone', 'pale', u - 0.37, u + 0.37, bottom, top, -0.05, 0.37);
    block(out, f, 'stone', 'band', u - 0.55, u + 0.55, bottom, bottom + 0.35, 0.02, 0.54);
    block(out, f, 'stone', 'pale', u - 0.51, u + 0.51, top - 0.4, top, 0.025, 0.57);
    if (tier >= 3) {
      for (const offset of [-0.21, 0, 0.21]) {
        block(
          out,
          f,
          'stone',
          'band',
          u + offset - 0.035,
          u + offset + 0.035,
          bottom + 0.47,
          top - 0.55,
          0.365,
          0.405,
        );
      }
      block(out, f, 'stone', 'band', u - 0.62, u + 0.62, top - 0.16, top + 0.06, 0.08, 0.61);
    }
  }
}

function stringcourse(out, f, y, width, depth, tier) {
  if (!tier) {
    panel(out, f, 'stone', 'pale', f.start, f.end, y - width / 2, y + width / 2, depth * 0.5);
    return;
  }
  const cuts = [f.start, ...f.cuts, f.end];
  for (let i = 1; i < cuts.length; i++)
    block(
      out,
      f,
      'stone',
      'pale',
      cuts[i - 1],
      cuts[i],
      y - width / 2,
      y + width / 2,
      -0.02,
      depth,
    );
}

function plaza(out, entrance, tier) {
  const f = plazaFrame(entrance),
    west = entrance.direction < 0,
    cap = layout.roof.corniceY;
  portalRow(out, f, entrance, tier);
  if (!tier) {
    panel(out, f, 'wall', 'wall', f.start, f.end, entrance.bandTop, cap);
    for (const { z } of entrance.portals) {
      panel(out, f, 'glazing', 'glass', z - 1.16, z + 1.16, west ? 21.05 : 24.0, 27.8, 0.027);
      panel(
        out,
        f,
        'glazing',
        'glass',
        z - 0.95,
        z + 0.95,
        west ? 12.3 : 19.0,
        west ? 16.55 : 22.45,
        0.027,
      );
    }
    return;
  }
  const centers = entrance.portals.map((p) => p.z);
  const piers = spacing(
    entrance.center - entrance.pitch * 3,
    entrance.center + entrance.pitch * 3,
    6,
  ).filter((u) => u > f.start + 0.5 && u < f.end - 0.5);
  if (west) {
    windowBand(
      out,
      f,
      { bottom: entrance.bandTop, top: 19.5, centers, width: 1.82, sill: 11.9, head: 17.0 },
      tier,
    );
    windowBand(
      out,
      f,
      { bottom: 19.5, top: cap, centers, width: 2.65, sill: 21.6, head: 27.3 },
      tier,
    );
    surrounds(out, f, piers, 19.5, 29.32, tier);
    if (tier >= 2) surrounds(out, f, piers, 9.45, 19.12, tier);
    if (tier >= 3)
      for (const { z } of entrance.portals) {
        block(out, f, 'stone', 'band', z - 1.55, z + 1.55, 11.5, 11.77, 0.04, 0.7);
        for (const u of spacing(z - 1.47, z + 1.47, 8))
          block(out, f, 'stone', 'pale', u - 0.075, u + 0.075, 11.77, 12.45, 0.52, 0.62);
        block(out, f, 'stone', 'pale', z - 1.52, z + 1.52, 12.42, 12.57, 0.46, 0.68);
      }
    for (const y of [9.16, 19.49, 28.98]) stringcourse(out, f, y, 0.33, 0.28, tier);
  } else {
    windowBand(
      out,
      f,
      { bottom: entrance.bandTop, top: 23.57, centers, width: 2.04, sill: 18.68, head: 22.62 },
      tier,
    );
    windowBand(
      out,
      f,
      {
        bottom: 23.57,
        top: cap,
        centers: spacing(entrance.center - 14.05, entrance.center + 14.05, tier === 1 ? 14 : 19),
        width: tier === 1 ? 1.25 : 0.98,
        sill: 25.15,
        head: 28.79,
      },
      tier,
    );
    surrounds(out, f, piers, 17.45, 23.28, tier);
    for (const y of [17.25, 23.57, 29.37]) stringcourse(out, f, y, 0.34, 0.25, tier);
  }
}

function side(out, wall, tier) {
  const f = lineFrame(...wall.points),
    cap = layout.roof.corniceY;
  const count = Math.round(f.end / 5.35),
    centers = spacing(1.05, f.end - 1.05, count);
  panel(out, f, 'base', 'base', f.start, f.end, -2.8, 10.45);
  if (!tier) {
    panel(out, f, 'wall', 'side', f.start, f.end, 10.45, cap);
    for (const u of centers.filter((_, i) => i % 2 === 0))
      panel(out, f, 'glazing', 'glass', u - 0.9, u + 0.9, 23.5, 27.7, 0.026);
    return;
  }
  const rows = [
    { bottom: 10.45, top: 16.6, sill: 11.3, head: 15.0, width: 1.66, tone: 'side' },
    { bottom: 16.6, top: 22.93, sill: 17.7, head: 21.86, width: 1.91, tone: 'side' },
    { bottom: 22.93, top: cap, sill: 24.22, head: 28.36, width: 1.84, tone: 'side' },
  ];
  for (const [i, band] of rows.entries()) {
    if (tier !== 1 || i === 2) windowBand(out, f, { ...band, centers }, tier);
    else {
      panel(out, f, 'wall', 'side', f.start, f.end, band.bottom, band.top);
      for (const u of centers)
        panel(
          out,
          f,
          'glazing',
          'glass',
          u - band.width / 2,
          u + band.width / 2,
          band.sill,
          band.head,
          0.027,
        );
    }
  }
  for (const y of [10.45, 16.61, 22.95, 29.27]) stringcourse(out, f, y, 0.27, 0.25, tier);
  if (tier >= 2) surrounds(out, f, [0.45, f.end - 0.45], 16.78, 29.0, tier);
  if (tier >= 3)
    for (const [i, { x, z, grade }] of wall.samples.entries()) {
      const u = [0.18, 0.42, 0.71, 0.86][i] * f.end;
      if (grade < 7.65) {
        const depth = 0.13;
        panel(out, f, 'metal', 'metal', u - 0.68, u + 0.68, grade + 0.2, grade + 1.97, depth);
        block(
          out,
          f,
          'stone',
          'ashlar',
          u - 0.8,
          u + 0.8,
          grade + 1.97,
          grade + 2.23,
          -0.02,
          depth + 0.09,
        );
      }
      if (tier === 4 && i % 2 === 0)
        beam(out, 'metal', [x, grade + 2.4, z], [x, grade + 2.8, z], 0.16, 0.17, colors.sash);
    }
  if (tier >= 2)
    for (const sample of wall.samples) {
      if (sample.grade > 6.6) continue;
      const u = (sample.x - f.p(0, 0)[0]) * f.right[0] + (sample.z - f.p(0, 0)[2]) * f.right[2];
      const y = sample.grade + 2.35;
      panel(out, f, 'glazing', 'glass', u - 0.51, u + 0.51, y, y + 1.29, 0.034);
      block(out, f, 'stone', 'band', u - 0.65, u + 0.65, y - 0.16, y - 0.014, 0.016, 0.16);
    }
}

function plane(out, slot, tone, ring, y) {
  const center = ring.reduce((a, p) => a.map((n, i) => n + p[i] / ring.length), [0, 0]);
  for (const [a, b] of around(ring))
    face(
      out,
      slot,
      tone,
      [
        [center[0], y, center[1]],
        [a[0], y, a[1]],
        [b[0], y, b[1]],
      ],
      [0, 1, 0],
    );
}

function roofShell(out, tier) {
  const { roof } = layout;
  const east = layout.entrances[1].line;
  const [a, b] = [east[0], east.at(-1)];
  // The two short facade steps stop below the continuous zinc cornice.
  const outline = layout.outline.filter(
    ([x, z]) => !east.slice(1, -1).some(([u, v]) => x === u && z === v),
  );
  const levels =
    tier === 0
      ? [
          [1, roof.corniceY],
          [0.82, roof.terraceY],
        ]
      : [
          [1, roof.corniceY],
          [1.002, roof.corniceY + 0.38],
          [0.993, roof.shoulderY],
          [0.952, roof.shoulderY + 1.77],
          [0.892, roof.terraceY - 0.32],
          [0.82, roof.terraceY],
        ];
  const rim = (s) =>
    outline.map(([x, z]) => {
      const smoothEast = x > 50 && s < 0.999 ? mix(a[0], b[0], (z - a[1]) / (b[1] - a[1])) : x;
      return [smoothEast * s, z * (s === 1 ? 1 : 1 - (1 - s) * 1.21)];
    });
  for (let j = 1; j < levels.length; j++) {
    const [a, y0] = levels[j - 1],
      [b, y1] = levels[j],
      low = rim(a),
      high = rim(b);
    for (let i = 0; i < outline.length; i++) {
      const k = (i + 1) % outline.length,
        f = lineFrame(low[i], low[k]),
        slot = j === 1 && tier ? 'stone' : 'zinc';
      face(
        out,
        slot,
        j === 1 && tier ? 'pale' : j % 2 ? 'zinc' : 'zincLight',
        [
          [low[i][0], y0, low[i][1]],
          [low[k][0], y0, low[k][1]],
          [high[k][0], y1, high[k][1]],
          [high[i][0], y1, high[i][1]],
        ],
        [f.front[0], 0.45, f.front[2]],
      );
    }
  }
  plane(out, 'base', 'terrace', rim(0.82), roof.terraceY);
  if (tier >= 2)
    beamPath(
      out,
      'stone',
      rim(0.82).map(([x, z]) => [x, roof.terraceY + 0.25, z]),
      0.33,
      0.45,
      colors.band,
      true,
    );
  if (tier >= 2) {
    const panels = tier === 2 ? 2 : 7;
    for (let i = 0; i < panels; i++) {
      const w = 25.2 / panels,
        z = -13.6 + i * w,
        y = roof.terraceY + 0.06;
      box(out, 'metal', [-38.3, y, z], [-24.9, y + 0.08, z + w - 0.1], colors.blueGlass);
      if (tier === 4)
        for (const x of [-35.1, -31.6, -28.2])
          beam(
            out,
            'metal',
            [x, y + 0.087, z + 0.05],
            [x, y + 0.087, z + w - 0.14],
            0.042,
            0.029,
            colors.sash,
          );
    }
  }
}

function gableHouse(out, ring, base, eave, peak, tier, upper) {
  const positions = ring.toSorted((a, b) => a[0] - b[0]);
  const west = positions.slice(0, 2).sort((a, b) => a[1] - b[1]),
    east = positions.slice(2, 4).sort((a, b) => a[1] - b[1]);
  const corners = [west[0], east[0], east[1], west[1]],
    ridge = [mid(...west), mid(...east)];
  for (const [i, [a, b]] of around(corners).entries()) {
    const f = lineFrame(a, b),
      end = i % 2 !== 0;
    if (upper && end && tier) {
      const width = tier === 1 ? 2.2 : 1.84;
      windowBand(
        out,
        f,
        {
          bottom: base,
          top: eave,
          centers: [f.end / 2],
          width,
          sill: base + 0.7,
          head: eave - 0.22,
        },
        tier,
      );
      if (tier >= 2)
        surrounds(
          out,
          f,
          [1.05, f.end * 0.24, f.end * 0.76, f.end - 1.05],
          base + 0.45,
          eave - 0.42,
          tier,
        );
    } else panel(out, f, 'wall', 'wall', f.start, f.end, base, eave);
    if (end) {
      const m = mid(a, b);
      face(
        out,
        'wall',
        'pale',
        [
          [a[0], eave, a[1]],
          [b[0], eave, b[1]],
          [m[0], peak, m[1]],
        ],
        f.front,
      );
      if (upper) {
        const u = f.end / 2;
        panel(out, f, 'metal', 'metal', u - 0.82, u + 0.82, eave - 1.12, eave + 0.29, 0.016);
        const archTop = arch(u, eave + 0.29, 0.79, 0.82, tier ? 8 : 4);
        for (let j = 1; j < archTop.length; j++)
          face(
            out,
            'metal',
            'metal',
            [f.p(u, eave + 0.29, 0.016), f.p(...archTop[j - 1], 0.016), f.p(...archTop[j], 0.016)],
            f.front,
          );
        if (tier) {
          beam(out, 'stone', [a[0], eave, a[1]], [m[0], peak, m[1]], 0.39, 0.38, colors.pale);
          beam(out, 'stone', [m[0], peak, m[1]], [b[0], eave, b[1]], 0.39, 0.38, colors.pale);
        }
      }
    }
  }
  for (const side of [0, 1]) {
    const a = west[side],
      b = east[side],
      r = ridge[0],
      s = ridge[1];
    face(
      out,
      'zinc',
      'zincDark',
      [
        [a[0], eave, a[1]],
        [b[0], eave, b[1]],
        [s[0], peak, s[1]],
        [r[0], peak, r[1]],
      ],
      [0, 1, 0],
    );
  }
}

export function buildTheatreLevel(out, level = 'master') {
  const tier = levelIndex[level];
  if (tier === undefined) throw new Error(`Unknown Teatro Real level ${level}`);
  for (const entrance of layout.entrances) plaza(out, entrance, tier);
  for (const wall of layout.foundation) side(out, wall, tier);
  roofShell(out, tier);
  const roof = layout.roof;
  gableHouse(
    out,
    roof.gallery,
    roof.terraceY - 0.03,
    roof.galleryY - 1.95,
    roof.galleryY,
    tier,
    false,
  );
  gableHouse(out, roof.stage, roof.terraceY - 0.08, roof.stageEaveY, roof.ridgeY, tier, true);
  if (tier >= 3) {
    const ridge = roof.ridge,
      center = mid(ridge[0], ridge[2]);
    for (const x of [center[0] - 4.3, center[0] + 3.5]) {
      loft(
        out,
        'metal',
        [
          radialRing(roof.ridgeY - 0.9, 0.11, 0.11, 6, [x, center[1]]),
          radialRing(roof.ridgeY + 0.69, 0.075, 0.075, 6, [x, center[1]]),
        ],
        colors.metal,
      );
    }
  }
}

export const buildTheatreSkyline = (out) => buildTheatreLevel(out, 'skyline');
export const buildTheatreDistrict = (out) => buildTheatreLevel(out, 'district');
export const buildTheatreStreet = (out) => buildTheatreLevel(out, 'street');
export const buildTheatreCloseup = (out) => buildTheatreLevel(out, 'closeup');
