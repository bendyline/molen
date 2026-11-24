import { beam } from './authored-structure-mesh.mjs';
import { withFootprintCaps } from './place-footprint-caps.mjs';
import {
  extrude,
  facade,
  fan,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from './place-recipe-kit.mjs';

export const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93 },
  timber: { slot: 'trim', graph: 'wood_vertical', roughness: 0.95 },
  roof: { slot: 'roof', graph: 'shingle_cedar', roughness: 0.96 },
  lead: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.8, metallic: 0.12 },
  glass: { slot: 'trim', graph: 'metal_painted', roughness: 0.62 },
  masonry: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.95 },
  clay: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.94 },
};

const plaster = rgb('d4cec0'),
  pale = rgb('c8bfa9'),
  wood = rgb('624835'),
  darkWood = rgb('513e34');
const shale = rgb('77716a'),
  ridge = rgb('766f61'),
  lead = rgb('77838a'),
  shade = rgb('494540');
const window = rgb('536065'),
  stone = rgb('a39e87'),
  clay = rgb('9e6d53');
const faces = (ring) => outwardRing(ring).map((a, i, r) => wallFace(a, r[(i + 1) % r.length]));
const xz = ([x, , z]) => [x, z];
const entryWood = rgb('6a463a');

function panel(out, slot, f, u, U, y, Y, d, color) {
  const P = f.P;
  quad4(out, slot, P(u, y, d), P(U, y, d), P(U, Y, d), P(u, Y, d), color);
}
function brace(out, f, a, b, w, c, detail, d = 0.047) {
  const [x, y] = a,
    [X, Y] = b,
    l = Math.hypot(X - x, Y - y);
  if (l < 0.04) return;
  if (detail === 3) {
    beam(out, 'timber', f.P(x, y, d + 0.025), f.P(X, Y, d + 0.025), w, 0.066, c);
    return;
  }
  const i = ((Y - y) * w) / (2 * l),
    j = (-(X - x) * w) / (2 * l);
  quad4(
    out,
    'timber',
    f.P(x + i, y + j, d),
    f.P(X + i, Y + j, d),
    f.P(X - i, Y - j, d),
    f.P(x - i, y - j, d),
    c,
  );
}

function glazing(out, f, u, y, w, h, detail, rim = wood, { arched = false, door = false } = {}) {
  if (detail > 1) {
    opening(out, f, u, y, w, h, {
      head: arched ? 'round' : 'flat',
      glassSlot: door ? 'timber' : 'glass',
      frameSlot: 'timber',
      glass: door ? entryWood : window,
      frame: rim,
      frameWidth: door ? 0.13 : 0.11,
      frameDepth: 0.087,
      sill: !door,
      mullions: detail === 3 ? (door ? 1 : 2) : 0,
      transoms: detail === 3 && !door ? 2 : 0,
      d: 0.037,
    });
  } else {
    panel(
      out,
      door ? 'timber' : 'glass',
      f,
      u - w / 2,
      u + w / 2,
      y,
      y + h,
      0.038,
      door ? entryWood : window,
    );
  }
}

function bracedWall(out, f, y0, y1, detail, color, style) {
  if (f.length < (detail ? 1.23 : 7.9)) return;
  const low = Math.max(y0, 0.46),
    rise = y1 - low;
  if (rise < 1.04) return;
  const compact = style === 'porch' || style === 'annex' || style === 'clerestory';
  const bayCount = Math.max(1, Math.round(f.length / (detail === 0 ? 6.5 : compact ? 2.92 : 3.8)));
  const columns =
    detail === 0 ? [0.12, 0.66] : compact ? [0.12, 0.59, 0.94] : [0.055, 0.33, 0.66, 0.96];
  const rows = columns.map((v) => low + rise * v);
  const pilaster = (u) =>
    panel(
      out,
      'timber',
      f,
      Math.max(0, u - 0.098),
      Math.min(f.length, u + 0.098),
      low,
      y1 + 0.02,
      0.027,
      color,
    );
  for (let j = 0; j <= bayCount; j++) pilaster((j * f.length) / bayCount);
  for (const h of rows) panel(out, 'timber', f, 0, f.length, h - 0.077, h + 0.077, 0.026, color);
  if (!detail) return;
  const d = f.length / bayCount;
  for (let j = 0; j < bayCount; j++) {
    const u = j * d,
      mid = u + d * 0.5;
    const windowBay = style !== 'porch' && (style !== 'clerestory' || j % 2 === 0);
    for (let i = 0; i < rows.length - 1; i++) {
      const y = rows[i] + 0.15,
        Y = rows[i + 1] - 0.21;
      if (windowBay && (compact ? i === 0 : i === 1)) {
        glazing(out, f, mid, y, Math.min(1.19, d * 0.43), Y - y, detail, color, {
          arched: !compact,
        });
        continue;
      }
      if (detail === 1 && (i + j) % 2) continue;
      const dx = d * 0.11;
      brace(out, f, [u + dx, y], [u + d - dx, Y], 0.131, color, detail);
      if (detail > 1 && (i !== 1 || j % 2 === 0))
        brace(out, f, [u + d - dx, y], [u + dx, Y], 0.131, color, detail, 0.063);
    }
  }
}

function shell(out, wings, detail, color) {
  for (const wing of wings)
    for (const [outline, ...holes] of wing.shape) {
      const ring =
        detail === 0 ? outline.filter((_, i) => outline.length < 14 || i % 2 === 0) : outline;
      extrude(out, 'plaster', ring, wing.base, wing.eave, plaster, {
        holes,
        topSlot: 'roof',
        topColor: shale,
      });
      for (const f of faces(ring))
        bracedWall(out, f, wing.base, wing.eave, detail, color, wing.wallStyle);
    }
}

function hipped(
  out,
  f,
  control,
  slot,
  tone,
  detail,
  { closedGables = false, color = darkWood } = {},
) {
  const {
      u: [a, b],
      d: [c, d],
      eave: y,
      peak: Y,
      hips: [i, j],
    } = control,
    mid = (c + d) / 2;
  const A = f.P(a, y, d),
    B = f.P(b, y, d),
    C = f.P(b, y, c),
    D = f.P(a, y, c);
  const top = [f.P(a + (b - a) * i, Y, mid), f.P(b - (b - a) * j, Y, mid)];
  quad4(out, slot, A, B, top[1], top[0], tone);
  quad4(out, slot, C, D, top[0], top[1], tone);
  tri(out, closedGables ? 'plaster' : slot, B, C, top[1], closedGables ? plaster : tone);
  tri(out, closedGables ? 'plaster' : slot, D, A, top[0], closedGables ? plaster : tone);
  if (detail > 0) {
    beam(out, slot, top[0], top[1], 0.2, 0.15, ridge);
    for (const [a, b] of [
      [A, B],
      [B, C],
      [C, D],
      [D, A],
    ])
      beam(out, 'timber', a, b, 0.19, 0.165, color);
  }
}

function vergeGable(out, f, u, U, y, Y, d, detail, clock, color) {
  const center = (u + U) / 2,
    max = U - u;
  const a = f.P(u, y, d),
    b = f.P(U, y, d),
    c = f.P(center, Y, d);
  tri(out, 'plaster', a, b, c, plaster);
  if (detail === 0) return;
  for (const [a, b] of [
    [
      [u, y],
      [center, Y],
    ],
    [
      [center, Y],
      [U, y],
    ],
    [
      [center, y],
      [center, Y - 0.08],
    ],
  ])
    brace(out, f, a, b, 0.192, color, detail, d + 0.039);
  for (const t of [0.21, 0.42, 0.63, 0.81]) {
    const dy = y + (Y - y) * t,
      w = max * 0.5 * (1 - t);
    panel(out, 'timber', f, center - w, center + w, dy - 0.087, dy + 0.087, d + 0.033, color);
  }
  for (const s of [-1, 1]) {
    const u = center + s * max * 0.244;
    brace(out, f, [u, y + 0.01], [u, y + (Y - y) * 0.51], 0.173, color, detail, d + 0.053);
    if (detail > 1)
      brace(
        out,
        f,
        [u, y + (Y - y) * 0.22],
        [center, y + (Y - y) * 0.61],
        0.132,
        color,
        detail,
        d + 0.067,
      );
  }
  if (!clock) return;
  const cy = y + (Y - y) * 0.76,
    n = detail === 3 ? 26 : 16,
    r = 1.04;
  const disk = (r, d) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return f.P(center + Math.cos(a) * r, cy + Math.sin(a) * r, d);
    });
  fan(out, 'masonry', disk(r + 0.09, d + 0.105), pale);
  fan(out, 'glass', disk(r, d + 0.137), shade);
  for (const [t, len] of [
    [0.49, 0.72],
    [1.04, 0.53],
  ]) {
    const x = center + Math.cos(t * Math.PI) * len,
      z = cy + Math.sin(t * Math.PI) * len;
    beam(out, 'masonry', f.P(center, cy, d + 0.18), f.P(x, z, d + 0.18), 0.072, 0.065, pale);
  }
}

function profile(out, slot, center, steps, n, tone) {
  lathe(
    out,
    slot,
    center,
    steps.map(([y, r, w = r]) => [y, r, w]),
    n,
    tone,
  );
}
function octagon(center, r) {
  return Array.from({ length: 8 }, (_, i) => {
    const a = ((i + 0.5) * Math.PI) / 4;
    return [center[0] + Math.cos(a) * r, center[1] + Math.sin(a) * r];
  });
}

function lantern(out, center, y, r, top, detail) {
  const h = top - y,
    ring = octagon(center, r * 0.73);
  profile(
    out,
    'lead',
    center,
    [
      [y, r * 1.18],
      [y + h * 0.15, r * 1.05],
      [y + h * 0.28, r * 0.73],
    ],
    8,
    lead,
  );
  for (const f of faces(ring)) {
    fbox(out, 'timber', f, 0, f.length * 0.19, y + h * 0.27, y + h * 0.58, -0.19, 0.068, darkWood);
    if (detail > 0) fbox(out, 'lead', f, 0, f.length, y + h * 0.51, y + h * 0.59, -0.12, 0.1, lead);
  }
  profile(
    out,
    'lead',
    center,
    [
      [y + h * 0.565, r * 0.89],
      [y + h * 0.64, r * 0.69],
      [y + h * 0.73, r * 0.53],
      [y + h * 0.8, r * 0.39],
      [y + h * 0.875, r * 0.12],
      [y + h * 0.94, r * 0.095],
      [top, r * 0.035],
    ],
    8,
    lead,
  );
  if (detail > 1)
    profile(
      out,
      'masonry',
      center,
      [
        [y + h * 0.87, r * 0.08],
        [y + h * 0.9, r * 0.15],
        [y + h * 0.93, r * 0.07],
      ],
      8,
      pale,
    );
}

function stair(out, f, u, U, d, y, detail) {
  const n = [2, 3, 4, 6][detail];
  for (let i = 0; i < n; i++) {
    fbox(
      out,
      'masonry',
      f,
      u,
      U,
      -0.82,
      (y * (i + 1)) / n,
      d - 0.74,
      d + 1.36 - (1.89 * i) / n,
      stone,
    );
  }
}

function jawor(out, F, site, detail) {
  const P = F.P,
    { tower } = site.roof;
  hipped(out, F, site.roof.main, 'roof', shale, detail, { color: wood });
  const annex = {
    u: [12.55, 22.24],
    d: [-17.23, -11.84],
    eave: 5.45,
    peak: 8.21,
    hips: [0.23, 0.26],
  };
  hipped(out, F, annex, 'roof', shale, detail);
  const center = xz(P(tower.center[0], 0, tower.center[1]));
  const [u, d] = tower.center;
  const box = (slot, a, b, y, Y, p, q, c) => fbox(out, slot, F, a, b, y, Y, p, q, c);
  for (const [a, b, h] of [
    [0.36, 3.12, 3.31],
    [3.11, 9.79, 5.15],
    [9.78, 12.34, 3.36],
  ]) {
    const porch = {
      u: [a - 0.16, b + 0.17],
      d: [13.34, Math.abs(b - a) > 5 ? 19.16 : 20.62],
      eave: h,
      peak: h + 0.79,
      hips: [0.23, 0.22],
    };
    box('masonry', a, b, -0.67, h, 13.45, Math.abs(b - a) > 5 ? 18.94 : 20.56, pale);
    hipped(out, F, porch, 'clay', clay, detail);
    if (detail > 0) {
      const d = porch.d[1] - 0.055,
        f = facade(xz(P(0, 0, d)), F.along);
      glazing(
        out,
        f,
        (a + b) * 0.5,
        0.48,
        Math.abs(b - a) > 5 ? 1.97 : 1.1,
        h - 0.91,
        detail,
        wood,
        { door: true, arched: Math.abs(b - a) > 5 },
      );
    }
  }
  stair(out, F, 4.05, 9.49, 19.28, 0.55, detail);
  const square = [
    [u - 3.42, d - 3.05],
    [u - 3.4, d + 3.84],
    [u + 3.46, d + 3.87],
    [u + 3.45, d - 3.05],
  ].map(([a, b]) => xz(P(a, 0, b)));
  extrude(out, 'plaster', square, 4.91, 15.86, plaster, { top: false });
  for (const f of faces(square)) {
    bracedWall(out, f, 4.91, 15.86, detail, wood, 'hall');
    if (detail > 1)
      glazing(out, f, f.length * 0.52, 9.89, 2.11, 4.08, detail, wood, { arched: true });
  }
  hipped(
    out,
    F,
    {
      u: [u - 3.68, u + 3.73],
      d: [d - 3.21, d + 4.07],
      eave: 15.74,
      peak: 17.1,
      hips: [0.31, 0.29],
    },
    'roof',
    ridge,
    detail,
  );
  const oct = octagon(center, 3.1);
  extrude(out, 'plaster', oct, 16.77, tower.top, plaster, { top: false });
  for (const f of faces(oct)) {
    bracedWall(out, f, 16.78, tower.top, detail, wood, 'hall');
    const width = f.length * 0.325;
    for (const a of [0.3, 0.7]) {
      const z = f.length * a;
      glazing(out, f, z, 19.05, width, 5.95, Math.min(detail, 2), wood, { arched: true });
      if (detail > 1)
        for (let k = 0; k < 12; k++)
          panel(
            out,
            'timber',
            f,
            z - width * 0.51,
            z + width * 0.51,
            19.13 + k * 0.389,
            19.23 + k * 0.389,
            0.119,
            shade,
          );
    }
  }
  lantern(out, center, tower.top, 2.87, tower.summit, detail);
}

function awning(out, F, u, U, a, b, y, Y, tone) {
  const points = [F.P(u, y, a), F.P(U, y, a), F.P(U, Y, b), F.P(u, Y, b)];
  quad4(out, 'roof', ...(b > a ? points.toReversed() : points), tone);
}

function swidnica(out, F, site, detail) {
  const P = F.P,
    main = site.roof.main,
    cross = site.roof.cross;
  hipped(out, F, main, 'roof', shale, detail, { closedGables: true });
  const K = facade(F.origin, F.normal);
  hipped(
    out,
    K,
    {
      u: cross.d,
      d: [-cross.u[1], -cross.u[0]],
      eave: cross.eave,
      peak: cross.peak,
      hips: cross.hips,
    },
    'roof',
    shale,
    detail,
    { closedGables: true },
  );
  vergeGable(
    out,
    F,
    cross.u[0],
    cross.u[1],
    cross.eave,
    cross.peak,
    cross.d[1] + 0.016,
    detail,
    true,
    darkWood,
  );
  const rear = facade(
    xz(P(0, 0, cross.d[0] - 0.014)),
    F.along.map((v) => -v),
  );
  vergeGable(
    out,
    rear,
    -cross.u[1],
    -cross.u[0],
    cross.eave,
    cross.peak,
    0.013,
    detail,
    false,
    darkWood,
  );
  for (const [d, e] of [
    [-9.76, -7.4],
    [11.43, 7.58],
  ]) {
    awning(out, F, -20.12, -11.38, d, e, 8.85, 12.22, shale);
    awning(out, F, 9.05, 24.88, d, e, 8.85, 12.22, shale);
  }
  for (const p of site.entryCaps) {
    const y = p.eave,
      Y = y + p.rise,
      [r, s] = p.radius;
    const center = xz(P(p.u, 0, p.d));
    for (const [outline, ...holes] of p.shape) {
      extrude(out, 'plaster', outline, -0.96, y, plaster, { holes, top: false });
      for (const f of faces(outline)) bracedWall(out, f, 0.22, y, detail, darkWood, 'porch');
    }
    const capSlot = p.metal ? 'lead' : 'roof';
    profile(
      out,
      capSlot,
      center,
      [
        [y - 0.03, r, s],
        ...(detail ? [[y + p.rise * 0.3, r * 0.91, s * 0.91]] : []),
        ...(detail || p.lantern ? [[y + p.rise * 0.68, r * 0.64, s * 0.63]] : []),
        [Y, p.lantern ? r * 0.258 : 0.13, p.lantern ? s * 0.325 : 0.13],
      ],
      detail === 0 ? 5 : detail > 1 ? 16 : 12,
      p.metal ? lead : shale,
    );
    if (p.lantern) {
      const facing = facade(xz(P(0, 0, 20.69)), F.along);
      glazing(out, facing, p.u, 0.62, 2.64, 3.76, detail, darkWood, { arched: true, door: true });
      profile(
        out,
        'timber',
        center,
        [
          [Y - 0.03, 1.11],
          [Y + 0.92, 1.1],
        ],
        8,
        darkWood,
      );
      profile(
        out,
        'lead',
        center,
        [
          [Y + 0.85, 1.28],
          [Y + 1.12, 1.19],
          [Y + 1.48, 0.77],
          [Y + 2.18, 0.074],
        ],
        8,
        lead,
      );
      stair(out, F, p.u - 1.73, p.u + 1.73, 20.87, 0.6, detail);
    }
    if (detail > 1 && p.d > 11 && p.d < 20 && !p.lantern) {
      const facing = facade(xz(P(0, 0, p.d + s * 0.91)), F.along);
      glazing(out, facing, p.u, 0.26, 1.25, 2.93, detail, darkWood, { door: true });
    }
  }
  const { tower } = site.roof,
    u = tower.center[0],
    d = tower.center[1],
    center = xz(P(u, 0, d));
  profile(
    out,
    'lead',
    center,
    [
      [tower.base, 1.2],
      [24.64, 1.47],
      [25.31, 1.13],
    ],
    8,
    lead,
  );
  lantern(out, center, 25.25, 1.2, tower.summit, detail);
}

export function buildPeaceChurch(sink, site, detail) {
  const out = withFootprintCaps(sink),
    F = facade(site.frame.origin, site.frame.along);
  const isJawor = site.church === 'Jawor';
  shell(out, site.wings, detail, isJawor ? wood : darkWood);
  if (isJawor) jawor(out, F, site, detail);
  else swidnica(out, F, site, detail);
}
