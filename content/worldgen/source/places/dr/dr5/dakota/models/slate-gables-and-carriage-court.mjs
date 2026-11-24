import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  extrude,
  facade,
  fbox,
  lathe,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.96 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.95 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.94 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.95 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.88 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.86 },
  window: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.5 },
};

const F = facade(site.frame.origin, site.frame.along);
const P = F.P;
const xz = ([x, , z]) => [x, z];
const frame = {
  south: F,
  east: facade(
    xz(P(61.31, 0, 0)),
    F.normal.map((n) => -n),
  ),
  north: facade(
    xz(P(61.31, 0, -63.23)),
    F.along.map((n) => -n),
  ),
  west: facade(xz(P(-0.07, 0, -63.23)), F.normal),
};
const stone = rgb('a59880');
const pale = rgb('c4b699');
const cream = rgb('d0c19c');
const gray = rgb('6c7176');
const shadow = rgb('484845');
const panes = ['555452', '69655c', '525464', '4b4a48'].map(rgb);
const patina = rgb('748e81');
const iron = rgb('353838');
const terracotta = rgb('8f7962');
const eave = 35.5;

function panel(out, slot, f, u, U, y, Y, d, tint) {
  quad4(out, slot, f.P(u, y, d), f.P(U, y, d), f.P(U, Y, d), f.P(u, Y, d), tint);
}

function pane(out, f, u, y, w, h, d, detail, tint, arched = false) {
  const a = u - w / 2,
    b = u + w / 2;
  const arch = arched ? w * 0.51 : 0;
  panel(out, 'window', f, a, b, y, y + h - arch, d + 0.035, tint);
  if (arched) {
    const n = detail > 2 ? 10 : 5;
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * i) / n,
        t = (Math.PI * (i + 1)) / n;
      tri(
        out,
        'window',
        f.P(u, y + h - arch, d + 0.033),
        f.P(u + w * 0.5 * Math.cos(angle), y + h - arch + arch * Math.sin(angle), d + 0.035),
        f.P(u + w * 0.5 * Math.cos(t), y + h - arch + arch * Math.sin(t), d + 0.035),
        tint,
      );
    }
  }
  if (detail < 2) return;
  fbox(out, 'stone', f, a - 0.14, b + 0.14, y - 0.143, y - 0.018, d + 0.021, d + 0.245, pale);
  if (!arched)
    panel(out, 'stone', f, a - 0.081, b + 0.083, y + h + 0.001, y + h + 0.11, d + 0.098, pale);
  panel(out, 'stone', f, u - 0.034, u + 0.038, y + 0.016, y + h - arch, d + 0.052, stone);
  if (detail === 3) {
    for (const edge of [a, b])
      fbox(
        out,
        'stone',
        f,
        edge - 0.08,
        edge + 0.08,
        y + 0.004,
        y + h - arch,
        d + 0.008,
        d + 0.137,
        pale,
      );
    panel(out, 'stone', f, a, b, y + h * 0.58 - 0.041, y + h * 0.58 + 0.031, d + 0.077, stone);
  }
}

function ringWalls(out, detail) {
  for (const { outline, holes } of site.podium)
    extrude(out, 'base', outline, -1.81, 2.05, stone, { holes, top: false });
  for (const { outline, holes } of site.podium)
    extrude(out, 'brick', outline, 2.04, site.portal.spring, cream, { holes, top: false });
  const { outline, court, portal } = site;
  extrude(out, 'brick', outline, portal.spring + portal.half, eave, cream, {
    holes: [court],
    top: false,
  });
  const deck = new MeshBufferBuilder();
  if (
    !deck.addCap(
      'roof',
      'palette:#ffffff',
      outline,
      [court],
      () => eave,
      [0, 1, 0],
      (p) => p,
      gray,
    )
  )
    throw new Error('The Dakota roof must leave its native courtyard open');
  const { positions, indices } = deck.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = Array.from(indices.subarray(i, i + 3), (j) =>
      positions.subarray(j * 3, j * 3 + 3),
    );
    tri(out, 'slate', a, b, c, gray);
  }
  // The gallery between spring and crown keeps the same opening deeper into the carriage way.
  for (const { outline, holes } of site.podium)
    extrude(out, 'brick', outline, portal.spring, portal.spring + portal.half, cream, {
      holes,
      top: false,
    });
  for (const [inner, r] of [outwardRing(outline), outwardRing(court).reverse()].entries()) {
    const fList = r.map((a, i) => wallFace(a, r[(i + 1) % r.length]));
    for (const f of fList) {
      if (f.length < 3.3) continue;
      if (detail === 0) continue;
      const width = inner ? 3.58 : 4.93;
      const count = Math.max(1, Math.round(f.length / width)),
        stride = f.length / count;
      const at = (u) => {
        const [x, , z] = f.P(u, 0);
        const relative = [x - F.origin[0], z - F.origin[1]];
        return [
          relative[0] * F.along[0] + relative[1] * F.along[1],
          relative[0] * F.normal[0] + relative[1] * F.normal[1],
        ];
      };
      for (let i = 0; i < count; i++) {
        const u = (i + 0.5) * stride,
          [x, d] = at(u);
        for (const [j, [y, h]] of [
          [2.65, 2.44],
          [7.05, 3.44],
          [12.14, 3.54],
          [17.21, 3.37],
          [22.28, 3.19],
          [27.39, 3.07],
          [32.46, 2.32],
        ].entries()) {
          if (!inner && d > -0.15 && Math.abs(x - portal.x) < 3.1 && y < 7.2) continue;
          if (inner && d > -16.45 && Math.abs(x - portal.x) < 3.1 && y < 7.2) continue;
          if (detail === 1 && (j === 0 || (inner && j % 2 === 1))) continue;
          pane(
            out,
            f,
            u,
            y,
            inner ? 1.16 : 1.69,
            h,
            0,
            inner ? Math.min(1, detail) : detail,
            panes[(i + j) % panes.length],
            !inner && j === 1 && detail > 1,
          );
        }
        if (detail > 1 && !inner && i > 0) {
          fbox(
            out,
            'stone',
            f,
            i * stride - 0.106,
            i * stride + 0.118,
            2.32,
            30.51,
            0.021,
            0.133,
            pale,
          );
        }
      }
      const courses = inner
        ? [
            [5.97, 0.29],
            [30.96, 0.38],
          ]
        : [
            [1.88, 0.22],
            [5.94, 0.34],
            [10.93, 0.26],
            [30.44, 0.41],
            [31.02, 0.52],
            [35.41, 0.29],
          ];
      for (const [y, h] of courses) {
        if (y < portal.spring + portal.half) {
          const [x, d] = at(f.length / 2);
          if (!inner && d > -0.15 && Math.abs(x - portal.x) < 16.4) continue;
          if (inner && d > -16.72 && Math.abs(x - portal.x) < 6.4) continue;
        }
        if (detail < 3) panel(out, 'stone', f, 0, f.length, y, y + h, 0.145, stone);
        else fbox(out, 'stone', f, 0, f.length, y, y + h, 0.006, 0.235, stone);
      }
      if (!inner && detail > 1) {
        const y = 31.96;
        fbox(out, 'iron', f, 0, f.length, y, y + 0.072, 0.378, 0.443, iron);
        fbox(out, 'iron', f, 0, f.length, y + 0.7, y + 0.783, 0.378, 0.443, iron);
        if (detail === 3)
          for (let i = 0, n = Math.ceil(f.length / 0.83); i <= n; i++) {
            const x = (i * f.length) / n;
            fbox(out, 'iron', f, x - 0.029, x + 0.029, y + 0.062, y + 0.732, 0.382, 0.444, iron);
          }
      }
    }
  }
  fbox(
    out,
    'base',
    F,
    portal.x - portal.half,
    portal.x + portal.half,
    -0.41,
    0.037,
    -17.65,
    0.24,
    stone,
  );
}

function entrance(out, detail) {
  const { x, half: w, spring: y, back: d } = site.portal;
  const n = [5, 9, 14, 24][detail];
  const point = (a, r, z) => P(x + r * Math.cos(a), y + r * Math.sin(a), z);
  const end = (a, z) => P(x + w * Math.cos(a), y + w + 0.022, z);
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n;
    const A = point(a, w, 0.013),
      B = point(b, w, 0.013);
    quad4(out, 'base', A, B, point(b, w, d), point(a, w, d), stone);
    tri(out, 'brick', B, A, end(a, 0.013), cream);
    tri(out, 'brick', B, end(a, 0.013), end(b, 0.013), cream);
    tri(out, 'brick', point(a, w, d), point(b, w, d), end(a, d), cream);
    tri(out, 'brick', point(b, w, d), end(b, d), end(a, d), cream);
    if (detail > 0) {
      quad4(
        out,
        'stone',
        point(b, w, 0.141),
        point(a, w, 0.141),
        point(a, w + 0.63, 0.148),
        point(b, w + 0.63, 0.148),
        pale,
      );
    }
  }
  for (const u of [x - w - 0.21, x + w + 0.21]) {
    fbox(out, 'stone', F, u - 0.246, u + 0.247, 0.022, y + 0.39, 0.009, 0.223, pale);
    if (detail > 0) {
      fbox(out, 'base', F, u - 0.389, u + 0.389, 0.02, 1.21, 0.004, 0.409, stone);
      fbox(out, 'stone', F, u - 0.323, u + 0.323, y - 0.26, y + 0.13, 0.099, 0.362, pale);
    }
  }
  if (detail > 1) {
    // Trim the open central route without closing it with the front gate leaves.
    for (const [a, b] of [
      [x - w, x - w + 0.51],
      [x + w - 0.51, x + w],
    ]) {
      fbox(out, 'iron', F, a, b, 2.65, 2.752, -0.15, 0.05, iron);
      for (let j = 0; j < 4; j++)
        fbox(out, 'iron', F, a + j * 0.16, a + j * 0.16 + 0.038, 0.08, 3.41, -0.074, -0.022, iron);
    }
    fbox(
      out,
      'stone',
      F,
      x - 0.42,
      x + 0.42,
      y + w + 0.03,
      y + w + 1.06,
      0.022,
      0.234,
      lightystone,
    );
  }
}

const lightystone = rgb('bfb096');
function hippedRange(out, [u, d, U, D], t) {
  const wall = [P(u, eave, d), P(U, eave, d), P(U, eave, D), P(u, eave, D)];
  const b = 3.12;
  const a = Math.min((U - u) / 4, 3.8),
    c = Math.min((d - D) / 4, 3.2);
  const deck = [
    P(u + a, eave + b, d - c),
    P(U - a, eave + b, d - c),
    P(U - a, eave + b, D + c),
    P(u + a, eave + b, D + c),
  ];
  const slope = [
    P(u + a + 0.48, t, d - c - 0.48),
    P(U - a - 0.48, t, d - c - 0.48),
    P(U - a - 0.48, t, D + c + 0.48),
    P(u + a + 0.48, t, D + c + 0.48),
  ];
  for (const [j, x] of wall.entries()) {
    const k = (j + 1) % 4;
    quad4(out, 'slate', x, wall[k], deck[k], deck[j], gray);
    quad4(out, 'slate', deck[j], deck[k], slope[k], slope[j], gray);
  }
  quad4(out, 'slate', ...slope, gray);
}

function gable(out, { side, u, half: w, top, deep }, detail) {
  const f = frame[side],
    p = f.P,
    d = 0.185,
    y = eave - 0.08;
  const a = p(u - w, y, d),
    b = p(u + w, y, d),
    c = p(u, top, d),
    A = p(u - w, y, -deep),
    B = p(u + w, y, -deep),
    C = p(u, top, -deep);
  tri(out, 'brick', a, b, c, cream);
  tri(out, 'brick', B, A, C, cream);
  quad4(out, 'slate', a, c, C, A, gray);
  quad4(out, 'slate', c, b, B, C, gray);
  if (detail > 0) {
    const trim = (a, b) => beam(out, 'stone', a, b, 0.28, 0.26, pale);
    trim(p(u - w, y - 0.035, d + 0.07), p(u, top + 0.067, d + 0.07));
    trim(p(u, top + 0.067, d + 0.07), p(u + w, y - 0.035, d + 0.07));
    pane(out, f, u, eave + 2.26, 1.69, 3.37, d, detail, panes[0]);
    if (detail > 1) {
      pane(out, f, u, eave + 7.16, 1.01, 2.18, d, detail, panes[2], true);
      for (const x of [u - w * 0.43, u + w * 0.43])
        pane(out, f, x, eave + 2.49, 1.13, 2.84, d, detail, panes[2]);
      panel(out, 'stone', f, u - w * 0.66, u + w * 0.66, eave + 5.82, eave + 6.04, d + 0.21, pale);
    }
  }
  const base = top - 0.06,
    peak = side === 'east' && u < 7 ? site.height : top + 0.32;
  lathe(
    out,
    'stone',
    xz(p(u, 0, d)),
    [
      [base, 0.143, 0.143],
      [base + 0.106, 0.17, 0.17],
      [peak, 0, 0],
    ],
    detail === 3 ? 7 : 4,
    pale,
  );
}

function dormer(out, side, u, y, d, detail) {
  const f = frame[side],
    p = f.P;
  const w = 0.94,
    Y = y + 2.43,
    top = Y + 1.22;
  fbox(out, 'brick', f, u - w, u + w, y, Y, d - 2.33, d, stone);
  tri(out, 'brick', p(u - w, Y, d), p(u + w, Y, d), p(u, top, d), pale);
  quad4(out, 'slate', p(u - w, Y, d), p(u, top, d), p(u, top, -3.17), p(u - w, Y, -3.17), gray);
  quad4(out, 'slate', p(u, top, d), p(u + w, Y, d), p(u + w, Y, -3.17), p(u, top, -3.17), gray);
  pane(out, f, u, y + 0.38, 1.18, 1.52, d, detail, panes[1]);
}

function oriel(out, side, u, detail) {
  const f = frame[side],
    p = f.P;
  const origin = xz(p(u, 0, 0.48));
  const n = [6, 9, 14, 19][detail];
  const fill = (slot, profile, tint) =>
    lathe(
      out,
      slot,
      origin,
      profile.map(([y, r]) => [y, r, r]),
      n,
      tint,
      { capTop: false },
    );
  fill(
    'stone',
    [
      [2.49, 0.16],
      [4.53, 1.33],
      [6.01, 1.44],
      [32.2, 1.46],
      [36.24, 1.41],
      [38.05, 1.55],
    ],
    pale,
  );
  fill(
    'copper',
    [
      [38.0, 1.66],
      [38.38, 1.59],
      [39.73, 1.31],
      [40.71, 0.72],
      [41.06, 0.25],
      [41.66, 0],
    ],
    patina,
  );
  if (detail > 0) {
    for (const [i, y] of [6.24, 10.93, 15.9, 20.87, 25.64, 30.46, 34.86].entries()) {
      fill(
        'stone',
        [
          [y, 1.49],
          [y + 0.29, 1.54],
          [y + 0.41, 1.45],
        ],
        stone,
      );
      const planes = [-0.64, 0.02, 0.66];
      if (detail > 1)
        for (const a of planes) {
          const c = Math.cos(a),
            s = Math.sin(a);
          const wall = facade(xz(p(u + 1.47 * s, 0, 0.48 + 1.47 * c)), [
            f.along[0] * c - f.normal[0] * s,
            f.along[1] * c - f.normal[1] * s,
          ]);
          pane(
            out,
            wall,
            0,
            y + 0.63,
            0.57,
            i === 6 ? 2.05 : 3.31,
            0,
            Math.min(2, detail),
            panes[i % panes.length],
          );
        }
    }
  }
}

function roofscape(out, detail) {
  for (const [body, top] of [
    [[0.22, -0.33, 61.04, -15.74], 43.91],
    [[43.46, -15.77, 60.08, -47.25], 44.54],
    [[0.22, -47.4, 61.03, -62.87], 43.71],
    [[2.53, -15.91, 17.38, -47.18], 44.02],
  ])
    hippedRange(out, body, top);
  for (const g of site.gables) gable(out, g, detail);
  for (const [side, u] of [
    ['south', 9.53],
    ['south', 47.93],
    ['east', 24.65],
    ['east', 53.01],
  ])
    oriel(out, side, u, detail);
  if (detail > 0) {
    for (const [side, positions] of Object.entries({
      south: [4, 15.2, 43.5, 58.9],
      east: [13.2, 18.6, 30.0, 47.1, 58.4],
      north: [9.1, 18.3, 43.8, 53.9],
      west: [8.9, 17.2, 39.0, 51.9],
    }))
      for (const u of positions) dormer(out, side, u, 37.08, -1.68, detail);
    for (const [u, d, y] of [
      [5.74, -9.3, 45.31],
      [43.92, -8.34, 47.68],
      [55.82, -41.68, 46.1],
      [26.07, -57.51, 47.85],
      [46.02, -54.97, 45.78],
      [8.58, -26.72, 46.44],
    ]) {
      fbox(out, 'brick', F, u - 0.79, u + 0.79, 41.12, y, d - 0.59, d + 0.59, terracotta);
      fbox(out, 'stone', F, u - 0.885, u + 0.885, y - 0.27, y + 0.015, d - 0.672, d + 0.674, stone);
    }
  }
}

function build(out, detail) {
  ringWalls(out, detail);
  entrance(out, detail);
  roofscape(out, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
