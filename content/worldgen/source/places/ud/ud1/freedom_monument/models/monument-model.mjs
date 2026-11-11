/** Riga Freedom Monument, modeled in its signed boulevard frame. */
import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  chamferedRectangle,
  cross,
  loft,
  normalFor,
  normalize,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const freedomSurfaces = {
  granite: { slot: 'foundation', graph: 'stone_granite', roughness: 0.65 },
  carving: { slot: 'wall', graph: 'stone_granite', roughness: 0.68 },
  shaft: { slot: 'wall', graph: 'stone_travertine', roughness: 0.66 },
  copper: { slot: 'trim', graph: 'metal_copper', roughness: 0.58, metallic: 0.62 },
  patinated: { slot: 'wall', graph: 'metal_bronze_cast', roughness: 0.58, metallic: 0.63 },
  gilding: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.35, metallic: 0.76 },
};
const hex = {
  paving: 'b5a49a',
  edge: 'ac958b',
  foot: '8a766f',
  rose: '9b7770',
  roseDark: '7f645f',
  roseLight: 'b18e84',
  pale: 'd4cbb9',
  paleLight: 'e2d7c7',
  paleShade: 'beb7ab',
  channel: '4e5553',
  door: '514b43',
  grey: 'b6b6b2',
  greyLight: 'c0bfb7',
  greyShade: '8a8c84',
  patina: '77a998',
  patinaDark: '4b756b',
  patinaLight: '8eb3a8',
  gold: 'dfb854',
  goldLight: 'f3d778',
  goldDark: 'a87830',
};
const color = Object.fromEntries(
  Object.entries(hex).map(([key, h]) => [
    key,
    h.match(/../g).map((c) => {
      const s = Number.parseInt(c, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const up = [0, 1, 0],
  ref = 'palette:#ffffff',
  tau = Math.PI * 2;
const [cx, cz] = layout.center;
const tierByLevel = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
function face(out, slot, tint, ps, toward) {
  let n = normalFor(...ps);
  if (toward && dot(n, toward) < 0) {
    ps = ps.toReversed();
    n = normalFor(...ps);
  }
  if (ps.length === 3) out.addTriangle(slot, ref, ps, n, undefined, color[tint]);
  else if (ps.length === 4) out.addQuad(slot, ref, ps, n, undefined, color[tint]);
  else out.addConvexPolygon(slot, ref, ps, n, undefined, color[tint]);
}
function quad(out, slot, tint, [a, b, c, d], toward) {
  face(out, slot, tint, [a, b, c], toward);
  face(out, slot, tint, [a, c, d], toward);
}
function rect(out, slot, tint, rows, chamfer, x = cx, z = cz) {
  loft(
    out,
    slot,
    rows.map(([y, w, d]) => chamferedRectangle(x, y, z, w, d, chamfer)),
    color[tint],
  );
}
const flat = ([x, z], y) => [x, y, z];

function apron(out, tier) {
  const steps = [...layout.outerSteps, ...layout.innerSteps];
  const near = tier > 0,
    indices = near ? layout.outline.map((_, i) => i) : layout.farIndices;
  const bands = near ? steps : [steps[0], steps[4], steps[8]];
  for (const [step, s] of bands.entries())
    for (const [j, i] of indices.entries()) {
      const k = indices[(j + 1) % indices.length],
        a = s.outer[i],
        b = s.outer[k],
        c = s.inner[k],
        d = s.inner[i];
      quad(out, 'granite', step < 2 ? 'edge' : 'paving', [a, b, c, d], up);
      const n = [(a[0] + b[0]) / 2 - 1.5, 0, (a[2] + b[2]) / 2 - 0.15];
      const prev = bands[step - 1];
      const f = prev ? prev.inner[i] : [a[0], layout.skirtBase[i], a[2]],
        g = prev ? prev.inner[k] : [b[0], layout.skirtBase[k], b[2]];
      quad(out, 'granite', step === 0 ? 'foot' : 'edge', [f, g, b, a], n);
    }
  const pts = indices.map((i) => layout.upper[i]);
  for (const triangle of near ? layout.triangles : layout.farTriangles)
    face(
      out,
      'granite',
      'paving',
      triangle.map((i) => pts[i]),
      up,
    );
}

function localFrame(yaw, origin = [cx, 0, cz], scale = 1, depthScale = 1) {
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  return {
    p: ([u, y, v]) => [
      origin[0] + scale * (s * u + c * v * depthScale),
      origin[1] + scale * y,
      origin[2] + scale * (-c * u + s * v * depthScale),
    ],
    normal: [c, 0, s],
    scale,
  };
}
const polygon = (out, f, slot, tint, points) => {
  const ps = points.map(f.p);
  if (ps.length === 4) quad(out, slot, tint, ps, f.normal);
  else face(out, slot, tint, ps, f.normal);
};
const segment = (out, f, slot, tint, a, b, w, d = w) =>
  beam(out, slot, f.p(a), f.p(b), w * f.scale, d * f.scale, color[tint]);
const line = (out, f, slot, tint, points, w, d = w, closed = false) =>
  beamPath(out, slot, points.map(f.p), w * f.scale, d * f.scale, color[tint], closed);
function roundBody(out, f, slot, tint, points, n) {
  const cs = points.map((p) => p.slice(0, 3)),
    major = normalize(cs.at(-1).map((v, i) => v - cs[0][i]));
  const guide = Math.abs(major[2]) < 0.83 ? [0, 0, 1] : [1, 0, 0];
  const rings = points.map(([x, y, z, w, d], i) => {
    const a = cs[Math.max(0, i - 1)],
      b = cs[Math.min(cs.length - 1, i + 1)],
      axis = normalize(b.map((v, k) => v - a[k]));
    const side = normalize(cross(axis, guide)),
      vertical = cross(axis, side);
    return Array.from({ length: n }, (_, j) => {
      const t = (tau * j) / n;
      return f.p(
        [x, y, z].map((v, k) => v + side[k] * w * Math.cos(t) + vertical[k] * d * Math.sin(t)),
      );
    });
  });
  for (let j = 1; j < rings.length; j++) {
    const a = rings[j - 1],
      b = rings[j],
      center = f.p(mix(cs[j - 1], cs[j], 0.5));
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      for (const ps of [
        [a[i], a[k], b[k]],
        [a[i], b[k], b[i]],
      ])
        face(
          out,
          slot,
          tint,
          ps,
          ps[0].map((_, p) => ps[0][p] + ps[1][p] + ps[2][p] - 3 * center[p]),
        );
    }
  }
  const a = f.p(cs[0]),
    b = f.p(cs.at(-1)),
    dir = b.map((v, i) => v - a[i]);
  face(
    out,
    slot,
    tint,
    rings[0],
    dir.map((v) => -v),
  );
  face(out, slot, tint, rings.at(-1), dir);
}
function blob(out, f, slot, tint, [x, y, z], [w, h, d], n = 8, m = 4) {
  const rings = Array.from({ length: m - 1 }, (_, j) => {
    const a = -Math.PI / 2 + (Math.PI * (j + 1)) / m;
    return Array.from({ length: n }, (_, i) => {
      const b = (-tau * i) / n;
      return f.p([
        x + w * Math.cos(a) * Math.cos(b),
        y + h * Math.sin(a),
        z + d * Math.cos(a) * Math.sin(b),
      ]);
    });
  });
  loft(out, slot, rings, color[tint], { cap: false });
  for (let i = 0; i < n; i++) {
    const k = (i + 1) % n;
    face(out, slot, tint, [rings[0][i], rings[0][k], f.p([x, y - h, z])], [0, -1, 0]);
    face(out, slot, tint, [rings.at(-1)[i], rings.at(-1)[k], f.p([x, y + h, z])], up);
  }
}
function robe(out, f, slot, tint, rows, n, pleats = 0.08) {
  const rings = rows.map(([y, x, z, w, d], j) =>
    Array.from({ length: n }, (_, i) => {
      const a = (-tau * i) / n,
        fold = 1 + pleats * Math.sin(5 * a + 0.38 * j) + pleats * 0.42 * Math.cos(9 * a - 0.22 * j);
      return f.p([x + w * Math.cos(a) * fold, y, z + d * Math.sin(a) * fold]);
    }),
  );
  loft(out, slot, rings, color[tint]);
}
function head(out, f, slot, tint, [x, y, z], tier, style = 'bare') {
  const n = [5, 6, 9, 14, 16][tier],
    rows = tier < 2 ? 4 : 6;
  if (style !== 'bare')
    blob(out, f, slot, tint, [x, y + 0.034, z - 0.037], [0.244, 0.286, 0.229], n, rows);
  blob(out, f, slot, tint, [x, y, z], [0.204, 0.246, 0.198], n, rows);
  if (tier < 2) return;
  const shadow = slot === 'patinated' ? 'patinaDark' : tint === 'rose' ? 'roseDark' : 'greyShade';
  blob(out, f, slot, tint, [x, y - 0.058, z + 0.121], [0.155, 0.142, 0.087], n, 4);
  for (const sign of [-1, 1]) {
    polygon(out, f, slot, shadow, [
      [x + sign * 0.034, y + 0.025, z + 0.197],
      [x + sign * 0.125, y + 0.037, z + 0.165],
      [x + sign * 0.13, y + 0.013, z + 0.171],
      [x + sign * 0.042, y + 0.003, z + 0.195],
    ]);
    if (tier >= 3)
      segment(
        out,
        f,
        slot,
        tint,
        [x + sign * 0.039, y + 0.047, z + 0.195],
        [x + sign * 0.128, y + 0.058, z + 0.161],
        0.023,
      );
  }
  polygon(out, f, slot, tint, [
    [x - 0.05, y - 0.076, z + 0.188],
    [x + 0.045, y - 0.076, z + 0.188],
    [x + 0.031, y + 0.014, z + 0.244],
    [x - 0.028, y + 0.028, z + 0.237],
  ]);
  if (tier >= 3) {
    const mouth = [
      [x - 0.055, y - 0.122, z + 0.188],
      [x + 0.061, y - 0.122, z + 0.188],
      [x + 0.044, y - 0.133, z + 0.181],
      [x - 0.046, y - 0.134, z + 0.181],
    ];
    polygon(out, f, slot, shadow, mouth);
    for (const sign of [-1, 1])
      blob(
        out,
        f,
        slot,
        tint,
        [x + sign * 0.186, y - 0.022, z - 0.007],
        [0.035, 0.055, 0.039],
        6,
        4,
      );
  }
}
function limb(out, f, slot, tint, a, b, c, tier, wide = 0.14) {
  const n = [4, 5, 6, 9, 10][tier],
    middle = mix(b, c, 0.45);
  const points = [
    [...a, wide, wide * 0.88],
    [...b, wide * 0.74, wide * 0.71],
    [...c, wide * 0.47, wide * 0.51],
  ];
  if (tier >= 2) points.splice(2, 0, [...middle, wide * 0.69, wide * 0.63]);
  roundBody(out, f, slot, tint, points, n);
  if (tier >= 2) blob(out, f, slot, tint, c, [wide * 0.64, wide * 0.73, wide * 0.59], n, 4);
}

// Figure space has +Z facing out from its panel. Poses use meters at unit scale.
function figure(
  out,
  f,
  tint,
  tier,
  { pose = 'standing', style = 'bare', arms, headTilt = 0, lean = 0 } = {},
) {
  const slot = 'carving',
    n = [4, 5, 7, 11, 13][tier],
    sit = pose === 'seated',
    kneel = pose === 'kneeling',
    height = sit ? 1.53 : kneel ? 1.73 : 2.09,
    hip = sit ? 0.55 : kneel ? 0.66 : 0.99;
  if (tier === 0) {
    robe(
      out,
      f,
      slot,
      tint,
      [
        [0.015, 0, 0.12, 0.27, sit ? 0.39 : 0.23],
        [height * 0.48, 0, 0.04, 0.36, 0.24],
        [height - 0.29, lean, 0.01, 0.29, 0.2],
      ],
      4,
      0,
    );
    blob(out, f, slot, tint, [lean + headTilt, height - 0.197, 0.025], [0.186, 0.221, 0.174], 4, 3);
    if (arms)
      for (const [i, sign] of [1, -1].entries()) {
        const [elbow, hand] = arms[i];
        polygon(out, f, slot, tint, [
          [lean + sign * 0.23, height - 0.49, 0.19],
          elbow,
          [hand[0] + sign * 0.072, hand[1], hand[2]],
          [hand[0] - sign * 0.072, hand[1] - 0.072, hand[2]],
        ]);
      }
    return;
  }
  const rows = [
    [hip - 0.21, 0, 0.015, 0.28, 0.21],
    [hip, 0, 0.028, 0.34, 0.22],
    [height - 0.52, lean, 0.02, 0.355, 0.223],
    [height - 0.34, lean, 0.005, 0.237, 0.159],
  ];
  robe(out, f, slot, tint, rows, n, tier < 2 ? 0.026 : 0.092);
  for (const sign of [-1, 1]) {
    const x = sign * 0.173,
      base = [x, 0.055, sit ? 0.49 : kneel ? 0.22 : 0.071],
      knee = [
        x + sign * (sit ? 0.1 : 0.026),
        sit ? 0.49 : kneel ? 0.29 : 0.53,
        sit ? 0.5 : kneel ? 0.41 : 0.1,
      ];
    limb(out, f, slot, tint, [x, hip - 0.032, 0.036], knee, base, tier, 0.174);
    if (tier >= 2)
      blob(out, f, slot, tint, [base[0], 0.062, base[2] + 0.13], [0.13, 0.068, 0.237], n, 4);
  }
  const defaults = [
    [
      [0.43, height - 0.91, 0.126],
      [0.29, hip - 0.12, 0.24],
    ],
    [
      [-0.43, height - 0.91, 0.126],
      [-0.25, hip + 0.04, 0.242],
    ],
  ];
  for (const [i, sign] of [1, -1].entries()) {
    const [elbow, hand] = (arms ?? defaults)[i];
    limb(out, f, slot, tint, [lean + sign * 0.29, height - 0.53, 0.045], elbow, hand, tier, 0.145);
  }
  head(out, f, slot, tint, [lean + headTilt, height - 0.205, 0.02], tier, style);
}

function stonePlinth(out, tier) {
  const y = layout.terraceY;
  if (tier === 0) {
    for (const [slot, tint, y0, y1, w, d] of [
      ['granite', 'rose', y - 0.25, y + 1.56, 11.1, 9.62],
      ['shaft', 'pale', y + 1.56, 6.53, 10.3, 9.08],
      ['carving', 'grey', 6.5, 7.59, 7.8, 6.2],
    ]) {
      const ring = (h) => [
        [cx - w / 2, h, cz - d / 2],
        [cx - w / 2, h, cz + d / 2],
        [cx + w / 2, h, cz + d / 2],
        [cx + w / 2, h, cz - d / 2],
      ];
      loft(out, slot, [ring(y0), ring(y1)], color[tint]);
    }
    return;
  }
  rect(
    out,
    'granite',
    'roseDark',
    [
      [y - 0.25, 11.1, 9.62],
      [y + 0.36, 11.1, 9.62],
      [y + 0.56, 10.91, 9.39],
    ],
    0.24,
  );
  rect(
    out,
    'granite',
    'rose',
    [
      [y + 0.56, 10.65, 9.25],
      [y + 1.45, 10.65, 9.25],
      [y + 1.6, 10.45, 9.11],
    ],
    0.34,
  );
  rect(
    out,
    'shaft',
    'pale',
    [
      [y + 1.56, 10.3, 9.08],
      [5.99, 10.3, 9.08],
      [6.34, 9.9, 8.78],
      [6.58, 8.86, 7.94],
    ],
    1.89,
  );
  rect(
    out,
    'shaft',
    'paleShade',
    [
      [6.58, 8.86, 7.94],
      [6.78, 8.1, 7.38],
    ],
    1.25,
  );
  rect(
    out,
    'carving',
    'grey',
    [
      [6.75, 7.86, 6.21],
      [7.18, 7.86, 6.21],
      [7.55, 6.55, 5.71],
    ],
    0.62,
  );
  for (const [yaw, front] of [
    [0, false],
    [Math.PI, true],
  ]) {
    const f = localFrame(yaw, [cx, 0, cz]);
    if (front) {
      const panel = [
        [-2.19, 3.65, 5.19],
        [2.19, 3.65, 5.19],
        [2.19, 5.47, 5.19],
        [-2.19, 5.47, 5.19],
      ];
      polygon(out, f, 'shaft', 'paleLight', panel);
      if (tier >= 2) dedication(out, f);
    } else
      polygon(out, f, 'gilding', 'door', [
        [-0.96, y + 0.09, 5.564],
        [0.96, y + 0.09, 5.564],
        [0.96, y + 1.51, 5.344],
        [-0.96, y + 1.51, 5.344],
      ]);
  }
}
const glyph = {
  T: ['02 22', '12 10'],
  Ē: ['20 00 02 22', '01 11', '03 23'],
  V: ['02 10 22'],
  Z: ['02 22 00 20'],
  E: ['20 00 02 22', '01 11'],
  M: ['00 02 11 22 20'],
  I: ['10 12'],
  U: ['02 00 20 22'],
  N: ['00 02 20 22'],
  B: ['00 02 12 22 21 01', '01 21 20 00'],
  R: ['00 02 22 21 01', '01 20'],
  Ī: ['10 12', '03 23'],
  A: ['00 12 20', '01 21'],
};
function dedication(out, f) {
  for (const [row, word] of ['TĒVZEMEI', 'UN BRĪVĪBAI'].entries())
    for (const [i, char] of [...word].entries()) {
      const x = (i - word.length * 0.5) * 0.305,
        y = 4.78 - row * 0.48;
      for (const path of glyph[char] ?? []) {
        const ps = path
          .split(' ')
          .map((s) => [x + Number(s[0]) * 0.11, y + Number(s[1]) * 0.133, 5.205]);
        for (let k = 1; k < ps.length; k++) {
          const a = ps[k - 1],
            b = ps[k],
            dx = b[0] - a[0],
            dy = b[1] - a[1],
            d = Math.hypot(dx, dy),
            u = (0.012 * dy) / d,
            v = (-0.012 * dx) / d;
          polygon(out, f, 'shaft', 'greyShade', [
            [a[0] + u, a[1] + v, a[2]],
            [a[0] - u, a[1] - v, a[2]],
            [b[0] - u, b[1] - v, b[2]],
            [b[0] + u, b[1] + v, b[2]],
          ]);
        }
      }
    }
}

function taperedShaft(out, tier) {
  const { start, top, lower, upper } = layout.shaft;
  if (tier > 0)
    rect(
      out,
      'shaft',
      'pale',
      [
        [start, lower[0] + 0.28, lower[1] + 0.28],
        [start + 0.36, ...lower],
      ],
      0.075,
    );
  for (const [yaw, dim] of [
    [0, 0],
    [Math.PI, 0],
    [Math.PI / 2, 1],
    [-Math.PI / 2, 1],
  ]) {
    const f = localFrame(yaw),
      half = dim === 0 ? 1 : 0,
      b = lower[half] / 2,
      t = upper[half] / 2,
      bd = lower[dim] / 2,
      td = upper[dim] / 2,
      lo = tier === 0 ? start : start + 0.36;
    const p = (u, h, v) => [u, h, v];
    const w = 0.052;
    for (const sign of [-1, 1])
      polygon(out, f, 'shaft', sign > 0 ? 'pale' : 'paleLight', [
        p(sign * b, lo, bd),
        p(sign * w, lo, bd),
        p(sign * w, top, td),
        p(sign * t, top, td),
      ]);
    polygon(out, f, 'shaft', 'channel', [
      p(-w, lo, bd - 0.019),
      p(w, lo, bd - 0.019),
      p(w, top, td - 0.019),
      p(-w, top, td - 0.019),
    ]);
    for (const sign of [-1, 1])
      face(
        out,
        'shaft',
        'paleShade',
        [
          p(sign * w, lo, bd),
          p(sign * w, top, td),
          p(sign * w, top, td - 0.019),
          p(sign * w, lo, bd - 0.019),
        ].map(f.p),
        [-sign * f.normal[2], 0, sign * f.normal[0]],
      );
    if (tier >= 2)
      for (let y = lo + 1.04; y < top - 0.6; y += 0.77) {
        const f0 = (y - lo) / (top - lo),
          depth = bd + (td - bd) * f0;
        polygon(out, f, 'shaft', 'paleShade', [
          p(-0.045, y, depth - 0.013),
          p(0.045, y, depth - 0.013),
          p(0.045, y + 0.028, depth - 0.015),
          p(-0.045, y + 0.028, depth - 0.015),
        ]);
      }
  }
  rect(
    out,
    'shaft',
    'paleShade',
    [
      [top - 0.14, 3.01, 2.85],
      [top + 0.12, 3.01, 2.85],
    ],
    0.09,
  );
  rect(
    out,
    'copper',
    'patinaDark',
    [
      [top + 0.12, 3.1, 2.96],
      [top + 0.37, 3.1, 2.96],
      [top + 0.47, 2.83, 2.68],
    ],
    0.12,
  );
}

function star(out, f, x, y, z, r, tier) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI * i) / 5,
      d = i % 2 ? r * 0.45 : r;
    return [x + Math.sin(a) * d, y + Math.cos(a) * d, z];
  });
  const depth = tier === 0 ? 0.044 : 0.082;
  for (let i = 0; i < 10; i++) {
    const j = (i + 1) % 10,
      tint = i % 2 ? 'gold' : 'goldLight';
    polygon(out, f, 'gilding', tint, [[x, y, z + depth * 1.8], pts[i], pts[j]]);
    face(
      out,
      'gilding',
      'goldDark',
      [[x, y, z - depth], pts[j], pts[i]].map(f.p),
      f.normal.map((v) => -v),
    );
    if (tier >= 2)
      face(
        out,
        'gilding',
        'gold',
        [pts[i], pts[j], [pts[j][0], pts[j][1], z - 0.03], [pts[i][0], pts[i][1], z - 0.03]].map(
          f.p,
        ),
      );
  }
}

function liberty(out, tier) {
  const f = localFrame(Math.PI),
    n = [5, 9, 14, 21, 25][tier],
    b = layout.shaft.top + 0.36;
  const rows = [
    [b, 0, -0.05, 1.12, 0.76],
    [b + 0.44, 0, -0.09, 0.99, 0.67],
    [b + 1.07, 0.05, -0.08, 0.78, 0.55],
    [b + 2.23, 0.1, -0.08, 0.68, 0.49],
    [b + 3.31, 0.09, -0.07, 0.62, 0.51],
    [b + 4.52, 0.07, -0.07, 0.68, 0.52],
    [b + 5.35, 0.04, -0.06, 0.76, 0.45],
    [b + 5.76, 0, -0.085, 0.55, 0.35],
  ];
  robe(
    out,
    f,
    'patinated',
    'patina',
    tier === 0 ? rows.filter((_, i) => [0, 2, 4, 6, 7].includes(i)) : rows,
    n,
    tier >= 2 ? 0.086 : 0.034,
  );
  const hf = localFrame(Math.PI, [cx, b + 6.12, cz], 1.96);
  head(out, hf, 'patinated', 'patina', [0, 0, 0.012], tier, tier === 0 ? 'bare' : 'hood');
  const upper = [
    [-0.61, b + 5.42, -0.04],
    [-0.78, b + 6.45, 0.03],
    [-0.83, b + 7.26, 0.105],
    [-0.91, b + 8.0, 0.18],
  ];
  for (const sign of [-1, 1]) {
    const points = upper.map(([x, y, z], i) => [
      sign * x,
      y,
      z,
      [0.267, 0.225, 0.178, 0.136][i],
      [0.24, 0.213, 0.16, 0.14][i],
    ]);
    roundBody(
      out,
      f,
      'patinated',
      'patina',
      tier === 0 ? [points[0], points[2], points[3]] : points,
      n,
    );
    blob(
      out,
      f,
      'patinated',
      'patina',
      [sign * 0.91, b + 8.01, 0.19],
      [0.18, 0.26, 0.16],
      n,
      tier === 0 ? 3 : 5,
    );
    if (tier >= 2)
      for (let i = 0; i < 4; i++) {
        const x = sign * (0.79 + i * 0.067);
        segment(
          out,
          f,
          'patinated',
          'patinaLight',
          [x, b + 8.04, 0.22],
          [x + sign * 0.021, b + 8.23, 0.22],
          0.052,
          0.063,
        );
      }
  }
  const stars = [
    [-0.91, 40.97, 0.195, 0.49],
    [0, 41.48, 0.225, 0.52],
    [0.91, 40.97, 0.195, 0.49],
  ];
  line(
    out,
    f,
    'gilding',
    'goldDark',
    [
      [-1.03, 40.9, 0.205],
      [0, 41.42, 0.206],
      [1.03, 40.9, 0.205],
    ],
    0.068,
    0.071,
  );
  for (const [x, y, z, r] of stars) star(out, f, x, y, z, r, tier);
  if (tier >= 1)
    for (let i = 0; i < 16; i++) {
      const a = (i * tau) / 16,
        x = 1.19 * Math.cos(a),
        z = 1.13 * Math.sin(a);
      polygon(out, f, 'copper', 'patinaLight', [
        [x - 0.105, b + 0.065, z],
        [x + 0.1, b + 0.065, z],
        [x * 1.11, b + 0.29, z * 1.11],
      ]);
    }
  if (tier >= 2)
    for (const sign of [-1, 1]) {
      line(
        out,
        f,
        'patinated',
        'patinaLight',
        [
          [sign * 0.43, b + 0.38, 0.5],
          [sign * 0.26, b + 2.0, 0.51],
          [sign * 0.29, b + 3.95, 0.485],
          [sign * 0.43, b + 5.31, 0.39],
        ],
        0.074,
        0.055,
      );
      line(
        out,
        f,
        'patinated',
        'patinaDark',
        [
          [sign * 0.6, b + 0.42, 0.47],
          [sign * 0.5, b + 1.8, 0.46],
          [sign * 0.46, b + 3.3, 0.44],
          [sign * 0.59, b + 4.81, 0.39],
        ],
        0.049,
        0.045,
      );
    }
}

function shield(out, f, tier) {
  const outline = [
    [-0.7, 0.49],
    [0.7, 0.49],
    [0.72, 1.38],
    [0.58, 1.52],
    [0, 1.61],
    [-0.58, 1.52],
    [-0.72, 1.38],
  ];
  const center = [0, 1.11, 0.94];
  for (const [i, [x, y]] of outline.entries()) {
    const [a, b] = outline[(i + 1) % outline.length];
    polygon(out, f, 'carving', 'greyLight', [[x, y, 0.82], [a, b, 0.82], center]);
    face(
      out,
      'carving',
      'greyShade',
      [
        [x, y, 0.82],
        [a, b, 0.82],
        [a, b, 0.68],
        [x, y, 0.68],
      ].map(f.p),
    );
  }
  if (tier >= 1) {
    segment(out, f, 'carving', 'greyShade', [0, 0.57, 1.01], [0, 1.73, 0.89], 0.145, 0.11);
    segment(out, f, 'carving', 'greyLight', [-0.35, 1.45, 0.92], [0.35, 1.45, 0.92], 0.09, 0.1);
    line(
      out,
      f,
      'carving',
      'grey',
      outline.map(([x, y]) => [x, y, 0.84]),
      0.049,
      0.056,
      true,
    );
  }
}

function coreFigures(out, tier) {
  const main = tier === 1 ? 0 : Math.min(tier, 3),
    support = tier === 1 ? 0 : tier === 2 ? 1 : 2;
  const front = localFrame(Math.PI, [cx - 2.0, 7.16, cz], 1.91);
  figure(out, front, 'grey', Math.min(tier, 3), {
    style: 'hood',
    arms: [
      [
        [0.32, 1.47, 0.44],
        [0.042, 1.83, 0.87],
      ],
      [
        [-0.46, 1.28, 0.32],
        [-0.21, 1.55, 0.71],
      ],
    ],
  });
  shield(out, front, tier);
  if (tier >= 1)
    for (const s of [-1, 1])
      figure(
        out,
        localFrame(Math.PI + s * 0.28, [cx - 1.88, 7.11, cz + s * 1.66], 1.38),
        'grey',
        support,
        { pose: 'kneeling', style: 'hood', lean: 0.04 * s },
      );

  const hero = localFrame(-Math.PI / 2, [cx, 7.13, cz - 1.98], 1.7);
  figure(out, hero, 'grey', main, {
    style: 'hood',
    lean: -0.095,
    arms: [
      [
        [0.48, 1.24, 0.22],
        [0.62, 1.53, 0.61],
      ],
      [
        [-0.42, 1.53, 0.31],
        [-0.6, 1.67, 0.5],
      ],
    ],
  });
  blob(
    out,
    hero,
    'carving',
    'greyShade',
    [0.57, 0.64, 0.3],
    [0.47, 0.65, 0.42],
    [5, 6, 10, 16, 18][tier],
    tier < 2 ? 4 : 8,
  );
  blob(
    out,
    hero,
    'carving',
    'grey',
    [0.65, 1.18, 0.52],
    [0.31, 0.35, 0.29],
    [5, 7, 10, 15, 18][tier],
    tier < 2 ? 4 : 7,
  );
  if (tier >= 2)
    for (const s of [-1, 1])
      blob(
        out,
        hero,
        'carving',
        'grey',
        [0.65 + s * 0.18, 1.37, 0.55],
        [0.085, 0.109, 0.092],
        8,
        5,
      );

  const priest = localFrame(Math.PI / 2, [cx + 0.05, 7.1, cz + 1.96], 1.72);
  figure(out, priest, 'grey', main, {
    style: 'hood',
    arms: [
      [
        [0.4, 1.31, 0.28],
        [0.21, 1.47, 0.72],
      ],
      [
        [-0.38, 1.27, 0.27],
        [-0.3, 1.63, 0.62],
      ],
    ],
  });
  robe(
    out,
    priest,
    'carving',
    'grey',
    [
      [0.15, 0, 0.035, 0.37, 0.27],
      [0.74, 0, 0.035, 0.34, 0.27],
      [1.32, 0, 0.03, 0.38, 0.242],
    ],
    tier < 2 ? 5 : 9,
  );
  if (tier >= 1) {
    segment(out, priest, 'carving', 'greyShade', [-0.31, 0.22, 0.64], [-0.31, 1.98, 0.64], 0.065);
    segment(out, priest, 'carving', 'greyLight', [-0.53, 1.89, 0.64], [-0.09, 1.89, 0.64], 0.073);
  }

  const breaker = localFrame(0, [cx + 2.02, 7.1, cz], 1.68);
  figure(out, breaker, 'grey', main, {
    lean: 0.1,
    arms: [
      [
        [0.47, 1.82, 0.32],
        [0.58, 2.23, 0.48],
      ],
      [
        [-0.43, 1.67, 0.3],
        [-0.57, 2.11, 0.49],
      ],
    ],
  });
  if (tier >= 1)
    figure(out, localFrame(0.32, [cx + 2.06, 7.05, cz + 1.25], 1.28), 'grey', support, {
      pose: 'kneeling',
      lean: -0.1,
      arms: [
        [
          [0.4, 1.02, 0.29],
          [0.14, 1.34, 0.6],
        ],
        [
          [-0.33, 1.18, 0.2],
          [-0.24, 1.32, 0.52],
        ],
      ],
    });
  if (tier >= 2)
    for (let i = 0; i < 6; i++) {
      const x = -0.54 + i * 0.21,
        y = 1.95 - 0.22 * Math.sin((i * Math.PI) / 5) + i * 0.02;
      const ps = Array.from({ length: 8 }, (_, j) => {
        const a = (j * tau) / 8;
        return [
          x + 0.132 * Math.cos(a),
          y + 0.063 * Math.sin(a),
          0.505 + (i % 2) * 0.054 * Math.sin(a),
        ];
      });
      line(out, breaker, 'carving', 'greyShade', ps, 0.03, 0.033, true);
    }
}

const cornerGroups = [
  {
    x: -3.82,
    z: 3.65,
    yaw: 2.37,
    style: 'hood',
    arms: [
      [
        [0.4, 1.09, 0.26],
        [0.31, 1.54, 0.6],
      ],
      [
        [-0.45, 1.2, 0.29],
        [-0.44, 1.7, 0.62],
      ],
    ],
    prop: 'guard',
  },
  {
    x: -3.82,
    z: -3.65,
    yaw: -2.37,
    style: 'hood',
    arms: [
      [
        [0.41, 1.26, 0.35],
        [0.035, 1.61, 0.67],
      ],
      [
        [-0.41, 1.31, 0.3],
        [-0.035, 1.58, 0.68],
      ],
    ],
    prop: 'work',
  },
  {
    x: 3.82,
    z: -3.65,
    yaw: -0.77,
    style: 'bare',
    arms: [
      [
        [0.42, 1.17, 0.26],
        [0.12, 1.09, 0.67],
      ],
      [
        [-0.38, 1.21, 0.29],
        [-0.12, 1.09, 0.67],
      ],
    ],
    prop: 'scholar',
  },
  {
    x: 3.82,
    z: 3.65,
    yaw: 0.77,
    style: 'hood',
    arms: [
      [
        [0.38, 1.14, 0.25],
        [0.22, 1.18, 0.63],
      ],
      [
        [-0.44, 1.09, 0.23],
        [-0.33, 0.85, 0.47],
      ],
    ],
    prop: 'family',
  },
];
function cornerFigures(out, tier) {
  for (const g of cornerGroups) {
    const f = localFrame(g.yaw, [cx + g.x * 1.075, 3.13, cz + g.z * 1.042], 1.34);
    const panel = [
      [-1.03, 0, -0.035],
      [1.03, 0, -0.035],
      [1.03, 1.96, -0.035],
      [0, 2.12, -0.035],
      [-1.03, 1.96, -0.035],
    ];
    polygon(out, f, 'carving', 'roseDark', panel);
    if (tier === 0) {
      robe(
        out,
        f,
        'carving',
        'rose',
        [
          [0, 0, 0.16, 0.5, 0.23],
          [1.87, 0, 0.1, 0.34, 0.23],
        ],
        4,
        0,
      );
      blob(out, f, 'carving', 'rose', [0, 1.92, 0.14], [0.22, 0.26, 0.21], 4, 2);
    } else figure(out, f, 'rose', tier === 1 ? 0 : Math.min(tier, 3), g);
    if (tier < 1) continue;
    for (const sign of [-1, 1]) {
      const p = f.p([sign * 0.71, 0.012, 0.23]);
      figure(out, localFrame(g.yaw + sign * 0.23, p, 1.02), 'rose', tier - 1, {
        pose: g.prop === 'family' ? 'standing' : 'seated',
        style: sign < 0 ? 'hood' : 'bare',
        lean: sign * 0.11,
        headTilt: -sign * 0.045,
      });
    }
    if (tier >= 2) {
      if (g.prop === 'work')
        segment(out, f, 'carving', 'roseLight', [0.018, 0.16, 0.69], [0.02, 1.8, 0.69], 0.084);
      if (g.prop === 'guard')
        segment(out, f, 'carving', 'roseLight', [-0.43, 0.14, 0.66], [-0.48, 1.9, 0.66], 0.086);
      if (g.prop === 'scholar')
        polygon(out, f, 'carving', 'roseLight', [
          [-0.23, 1.07, 0.71],
          [0.27, 1.07, 0.71],
          [0.22, 1.29, 0.77],
          [-0.22, 1.29, 0.77],
        ]);
      if (g.prop === 'family')
        blob(out, f, 'carving', 'roseLight', [0.26, 1.18, 0.6], [0.18, 0.27, 0.15], 9, 5);
    }
  }
}

function relief(out, f, tier, tint, count, width, variant) {
  if (tier === 0) return;
  const dark = tint === 'rose' ? 'roseDark' : 'paleShade';
  polygon(out, f, 'carving', dark, [
    [-width / 2, 0.01, 0],
    [width / 2, 0.01, 0],
    [width / 2, 1.29, 0],
    [-width / 2, 1.29, 0],
  ]);
  const actors = tier === 1 ? count - 1 : count,
    scale = 0.62;
  for (let i = 0; i < actors; i++) {
    const u = ((i + 0.5) / actors - 0.5) * width,
      offset = (i % 3) * 0.046;
    const g = {
      ...f,
      scale: scale * f.scale,
      p: ([x, y, z]) => f.p([u + x * scale, y * scale + offset, 0.032 + z * 0.118]),
    };
    const arm =
      variant === 'choir'
        ? [
            [
              [0.38, 1.3, 0.2],
              [0.28, 1.52, 0.55],
            ],
            [
              [-0.36, 1.3, 0.2],
              [-0.24, 1.54, 0.52],
            ],
          ]
        : [
            [
              [0.39, 1.39, 0.34],
              [0.32, 1.83 + (i % 2) * 0.16, 0.43],
            ],
            [
              [-0.42, 1.31, 0.32],
              [-0.32, 1.49, 0.49],
            ],
          ];
    figure(out, g, tint, tier <= 2 ? 0 : Math.min(tier - 1, 2), {
      pose: i % 4 === 3 ? 'kneeling' : 'standing',
      style: i % 2 ? 'hood' : 'bare',
      lean: ((i % 3) - 1) * 0.085,
      arms: arm,
    });
  }
  if (tier >= 2 && variant !== 'choir') {
    const sign = variant === 'bridge' ? -1 : 1;
    for (let j = 0; j < count - 1; j++) {
      const x = ((j + 1) / count - 0.5) * width;
      segment(
        out,
        f,
        'carving',
        tint,
        [x - 0.18 * sign, 0.23, 0.116],
        [x + 0.31 * sign, 1.24, 0.12],
        0.037,
        0.027,
      );
    }
  }
}

function arcSides(out, tier) {
  for (const arc of layout.sideArcs) {
    const { ring, base, top, sign } = arc,
      indices = tier === 0 ? arc.farIndices : ring.map((_, i) => i);
    const triangles = tier === 0 ? arc.farTriangles : arc.triangles;
    for (const t of triangles)
      face(
        out,
        'granite',
        'rose',
        t.map((i) => flat(ring[indices[i]], top)),
        up,
      );
    const area = ring.reduce((sum, a, i) => {
      const b = ring[(i + 1) % ring.length];
      return sum + a[0] * b[1] - b[0] * a[1];
    }, 0);
    for (const [j, i] of indices.entries()) {
      const k = indices[(j + 1) % indices.length],
        a = ring[i],
        b = ring[k],
        end = j === indices.length - 1;
      const normal = [(b[1] - a[1]) * Math.sign(area), 0, (a[0] - b[0]) * Math.sign(area)];
      quad(
        out,
        end ? 'shaft' : 'granite',
        end ? 'pale' : 'roseDark',
        [flat(a, base[i]), flat(b, base[k]), flat(b, top), flat(a, top)],
        normal,
      );
    }
    if (tier >= 1) {
      const a = ring[0],
        b = ring.at(-1),
        p = mix(a, b, 0.5),
        len = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const nx = Math.abs(a[1] - b[1]) / len,
        nz = (-sign * Math.abs(a[0] - b[0])) / len;
      const f = localFrame(
        Math.atan2(nz, nx),
        [p[0] + nx * 0.025, top - 0.925, p[1] + nz * 0.025],
        0.68,
      );
      relief(
        out,
        f,
        tier,
        'grey',
        5,
        Math.min(3.8, len / 0.68 - 0.2),
        sign === 1 ? 'choir' : 'riflemen',
      );
    }
  }
}

export function buildFreedomLevel(out, level) {
  const tier = tierByLevel[level];
  if (tier === undefined) throw Error(`Unknown Freedom Monument level ${level}`);
  apron(out, tier);
  arcSides(out, tier);
  stonePlinth(out, tier);
  taperedShaft(out, tier);
  liberty(out, tier);
  coreFigures(out, tier);
  cornerFigures(out, tier);
  for (const sign of [-1, 1]) {
    const f = localFrame((sign * Math.PI) / 2, [cx, 3.53, cz + sign * 4.564], 1.36);
    relief(out, f, tier, 'grey', 6, 3.63, sign === 1 ? 'bridge' : '1905');
  }
}
export const buildFreedomSkyline = (out) => buildFreedomLevel(out, 'skyline');
export const buildFreedomDistrict = (out) => buildFreedomLevel(out, 'district');
export const buildFreedomStreet = (out) => buildFreedomLevel(out, 'street');
export const buildFreedomCloseup = (out) => buildFreedomLevel(out, 'closeup');
