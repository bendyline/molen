/** Shaharah's stepped masonry crossing and the narrow rock slot beneath it. */
import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const bridgeSurfaces = {
  wall: { slot: 'wall', graph: 'stone_drywall', roughness: 0.93 },
  cut: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.9 },
  paving: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.95 },
  rock: { slot: 'foundation', graph: 'stone_basalt_raw', roughness: 0.96 },
};
const tint = {
  wall: 'ad9576',
  lit: 'b9a081',
  buff: 'c2a987',
  warm: 'a48a70',
  dark: '8b745f',
  mottled: 'a58f76',
  cut: 'b49a78',
  paving: 'b39d81',
  riser: '9d8468',
  soffit: '8a7461',
  rock: '766f65',
  rockLight: '80796d',
  rockWarm: '817668',
  rockShade: '706b64',
  rockDark: '6b675f',
};
const palette = Object.fromEntries(
  Object.entries(tint).map(([k, hex]) => [
    k,
    hex.match(/../g).map((b) => {
      const s = parseInt(b, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const up = [0, 1, 0],
  down = [0, -1, 0],
  ref = 'palette:#ffffff';
const warm = ['wall', 'lit', 'buff', 'warm', 'dark', 'mottled'];
const rock = ['rock', 'rockLight', 'rockWarm', 'rockShade', 'rockDark'];
const mix = (a, b, t) => a + (b - a) * t;
const noise = (a, b) =>
  (((Math.imul(a + 3917, 2369) ^ Math.imul(b + 5099, 10501)) >>> 0) % 1019) / 1019;
const choose = (set, a, b) => set[Math.floor(noise(a, b) * set.length)];
const lateral = (s) => [0, 0, s];
function face(out, surface, tone, points, direction) {
  let n = normalFor(...points);
  if (Math.hypot(...n) < 0.5) return;
  if (n.reduce((sum, a, i) => sum + a * direction[i], 0) < 0) {
    points = points.toReversed();
    n = normalFor(...points);
  }
  out.addTriangle(surface, ref, points, n, undefined, palette[tone]);
}
function panel(out, surface, tone, a, b, c, d, direction) {
  face(out, surface, tone, [a, b, c], direction);
  face(out, surface, tone, [a, c, d], direction);
}
function sample(profile, x) {
  for (let i = 1; i < profile.length; i++)
    if (x <= profile[i][0]) {
      const [a, y] = profile[i - 1],
        [b, Y] = profile[i];
      return mix(y, Y, Math.max(0, (x - a) / (b - a)));
    }
  return profile.at(-1)[1];
}
export const deckY = (x) => sample(layout.deck, x);
const spring = layout.arch.spring;
const foot = -11.6;
const archY = (x) => {
  const q = Math.min(1, Math.abs((x - layout.arch.center) / layout.arch.halfSpan));
  return spring + layout.arch.rise * Math.sqrt(1 - q * q);
};
function gorge(out, tier) {
  const s = layout.sections,
    cols =
      tier === 0
        ? [0, 2, 4, 6, 8, 9, 10, 12, 14, 16, 18]
        : tier === 1
          ? [0, 1, 2, 4, 6, 8, 9, 10, 12, 14, 16, 17, 18]
          : s[0].points.map((_, i) => i);
  for (let i = 1; i < s.length; i++) {
    const a = s[i - 1],
      b = s[i];
    panel(out, 'rock', 'rock', a.apron[0], b.apron[0], b.points[0], a.points[0], up);
    panel(out, 'rock', 'rock', a.points.at(-1), b.points.at(-1), b.apron[1], a.apron[1], up);
    for (let j = 1; j < cols.length; j++) {
      const u = cols[j - 1],
        v = cols[j],
        shade =
          rock[
            Math.min(
              rock.length - 1,
              Math.max(
                0,
                Math.round(
                  1.85 + 1.2 * Math.sin(i * 0.7 + j * 0.62) + 0.8 * Math.sin(j * 1.8 - i * 0.4),
                ),
              ),
            )
          ];
      const p = a.points[u],
        q = a.points[v],
        r = b.points[v],
        t = b.points[u];
      if (tier >= 2 && i % 2 === j % 2) {
        face(out, 'rock', shade, [p, q, t], up);
        face(out, 'rock', shade, [q, r, t], up);
      } else panel(out, 'rock', shade, p, q, r, t, up);
    }
  }
  for (const [i, end] of [s[0], s.at(-1)].entries()) {
    const outer = layout.endAprons[i];
    for (let j = 1; j < cols.length; j++) {
      const a = cols[j - 1],
        b = cols[j];
      panel(out, 'rock', 'rockLight', end.points[a], end.points[b], outer[b], outer[a], up);
    }
    for (const [j, column] of [0, s[0].points.length - 1].entries()) {
      const a = end.apron[j],
        b = end.points[column],
        c = outer[column],
        d = [a[0], mix(a[1], c[1], 0.45), c[2]];
      panel(out, 'rock', 'rockLight', a, b, c, d, up);
    }
  }
}
function bridgeBody(out, tier) {
  const { center, halfSpan } = layout.arch,
    [start, end] = layout.bridge;
  const n = [8, 12, 20, 28, 34][tier],
    arc = Array.from({ length: n + 1 }, (_, i) => center - halfSpan * Math.cos((i * Math.PI) / n));
  const xs = [start, end, ...arc, ...layout.deck.slice(1, -1).map(([x]) => x)]
    .sort((a, b) => a - b)
    .filter((x, i, l) => i === 0 || x - l[i - 1] > 0.013);
  const w = layout.halfWidth;
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i],
      open = a >= arc[0] - 0.001 && b <= arc.at(-1) + 0.001;
    const low = open ? archY(a) : foot,
      L = open ? archY(b) : foot,
      y = deckY(a),
      Y = deckY(b);
    panel(out, 'paving', 'paving', [a, y, -w], [a, y, w], [b, Y, w], [b, Y, -w], up);
    if (open) panel(out, 'wall', 'soffit', [a, low, -w], [a, low, w], [b, L, w], [b, L, -w], down);
    for (const side of [-1, 1]) {
      const z = side * w,
        n = lateral(side),
        btm = [a, low, z],
        btM = [b, L, z];
      panel(out, 'wall', 'wall', btm, btM, [b, Y, z], [a, y, z], n);
      if (open && tier)
        panel(
          out,
          'cut',
          tier > 1 ? choose(warm, i, 3) : 'cut',
          [a, low, z + side * 0.027],
          [b, L, z + side * 0.027],
          [b, Math.min(L + 0.26, Y - 0.055), z + side * 0.027],
          [a, Math.min(low + 0.26, y - 0.055), z + side * 0.027],
          n,
        );
      if (tier >= 2) masonry(out, tier, i, side, a, b, low, L, open);
    }
  }
  for (const [i, x] of [arc[0], arc.at(-1)].entries())
    panel(
      out,
      'wall',
      'soffit',
      [x, foot, -w],
      [x, foot, w],
      [x, spring, w],
      [x, spring, -w],
      [i === 0 ? 1 : -1, 0, 0],
    );
  for (const [i, x] of [start, end].entries()) {
    const y = deckY(x);
    panel(
      out,
      'wall',
      'wall',
      [x, foot, -w],
      [x, foot, w],
      [x, y, w],
      [x, y, -w],
      [i === 0 ? -1 : 1, 0, 0],
    );
  }
  const path = layout.deck.map(([x, y]) => [x, 0, y]);
  walkWalls(out, tier, path, w, 0.62, false);
}
function masonry(out, tier, part, side, a, b, base, baseB, arch) {
  const z = side * layout.halfWidth,
    n = lateral(side),
    h = tier === 2 ? 0.33 : 0.205,
    width = tier === 2 ? 0.66 : 0.42;
  for (let row = 0; row < 60; row++) {
    const y = foot + row * h,
      top = y + h - 0.012;
    if (y > Math.max(deckY(a), deckY(b)) - 0.04 || top < Math.min(base, baseB) + 0.06) continue;
    const shift = (row % 2) * width * 0.45;
    for (let col = Math.floor((a - shift) / width) - 1; col * width + shift < b + 0.14; col++) {
      const edge = (k) => k * width + shift + (noise(k, row) - 0.5) * width * 0.43;
      const u = Math.max(a, edge(col) + 0.011),
        v = Math.min(b, edge(col + 1) - 0.011);
      if (v - u < 0.026) continue;
      const bounds = (x) => {
        const high = deckY(x) - 0.023;
        const l = Math.min(
          high,
          Math.max(y, mix(base, baseB, (x - a) / (b - a)) + (arch ? 0.282 : 0.035)),
        );
        return [l, Math.max(l, Math.min(high, top))];
      };
      const [l, h] = bounds(u),
        [L, H] = bounds(v);
      if (h - l + H - L < 0.025) continue;
      const dz = side * (0.009 + 0.021 * noise(part + col, row));
      panel(
        out,
        'wall',
        choose(warm, col, row + side * 83),
        [u, l, z + dz],
        [v, L, z + dz],
        [v, H, z + dz],
        [u, h, z + dz],
        n,
      );
    }
  }
}
function walkwayFrames(path, width, landing = false) {
  return path.map(([x, z, y], i) => {
    const p = path[Math.max(0, i - 1)],
      q = path[Math.min(path.length - 1, i + 1)],
      dx = q[0] - p[0],
      dz = q[1] - p[1],
      length = Math.hypot(dx, dz);
    return {
      x,
      z,
      y,
      dx: landing && i === 0 ? 0 : (dz / length) * width,
      dz: landing && i === 0 ? -Math.sign(dx) * width : (-dx / length) * width,
    };
  });
}
const at = (f, u, y) => [f.x + f.dx * u, y, f.z + f.dz * u];
function frameMix(a, b, t) {
  return Object.fromEntries(Object.keys(a).map((k) => [k, mix(a[k], b[k], t)]));
}
function walkWalls(out, tier, path, width, height, taper) {
  const p = walkwayFrames(path, width, taper);
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1],
      b = p[i],
      count =
        tier < 2 ? 1 : Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (tier === 2 ? 0.63 : 0.36));
    const scale = (i, t) => (taper && i === p.length - 1 ? mix(1, 0.08, t) : 1);
    for (let j = 0; j < count; j++) {
      const lo = j / count,
        hi = (j + 1) / count,
        u = frameMix(a, b, lo),
        v = frameMix(a, b, hi);
      for (const side of [-1, 1]) {
        const dir = [side * u.dx, 0, side * u.dz],
          inner = side * (1 - 0.27 / width),
          h = height * scale(i, lo) * (tier < 2 ? 1 : 0.84 + 0.31 * noise(i * 27 + j, side)),
          H = height * scale(i, hi) * (tier < 2 ? 1 : 0.86 + 0.25 * noise(i * 27 + j, side + 8)),
          color = tier < 2 ? 'lit' : choose(warm, j + i * 19, side);
        panel(
          out,
          'wall',
          color,
          at(u, side, u.y - 0.035),
          at(v, side, v.y - 0.035),
          at(v, side, v.y + H),
          at(u, side, u.y + h),
          dir,
        );
        panel(
          out,
          'wall',
          color,
          at(u, inner, u.y),
          at(v, inner, v.y),
          at(v, inner, v.y + H * 0.96),
          at(u, inner, u.y + h * 0.96),
          dir.map((c) => -c),
        );
        panel(
          out,
          'wall',
          color,
          at(u, side, u.y + h),
          at(v, side, v.y + H),
          at(v, inner, v.y + H * 0.96),
          at(u, inner, u.y + h * 0.96),
          up,
        );
        if (tier >= 2)
          panel(
            out,
            'wall',
            color,
            at(u, side, u.y),
            at(u, inner, u.y),
            at(u, inner, u.y + h * 0.96),
            at(u, side, u.y + h),
            [u.x - v.x, 0, u.z - v.z],
          );
      }
    }
  }
}
function westRelief(out, tier, a, b) {
  const length = Math.hypot(b.x - a.x, b.z - a.z),
    w = 0.42 / length,
    openings = [0.43, 0.75].map((center, i) => ({
      center,
      w: w * (i === 0 ? 1 : 0.72),
      rise: i === 0 ? 0.39 : 0.27,
    })),
    samples = [
      0,
      1,
      ...openings.flatMap((o) =>
        Array.from({ length: 7 }, (_, i) => o.center - o.w * Math.cos((i * Math.PI) / 6)),
      ),
    ].sort((x, y) => x - y);
  for (let i = 1; i < samples.length; i++) {
    const s = samples[i - 1],
      t = samples[i],
      p = frameMix(a, b, s),
      q = frameMix(a, b, t),
      m = (s + t) * 0.5;
    const opening = openings.find((o) => Math.abs(m - o.center) < o.w);
    const base = (x, f) =>
      f.y -
      0.88 +
      (opening?.rise ?? 0) *
        Math.sqrt(Math.max(0, 1 - Math.pow(opening ? (x - opening.center) / opening.w : 0, 2)));
    const low = base(s, p),
      high = base(t, q);
    for (const side of [-1, 1]) {
      const n = [p.dx * side, 0, p.dz * side],
        r = at(p, side, low),
        R = at(q, side, high);
      panel(
        out,
        'wall',
        tier > 1 ? choose(warm, i, side) : 'wall',
        r,
        R,
        at(q, side, q.y),
        at(p, side, p.y),
        n,
      );
      if (opening && tier > 1)
        panel(
          out,
          'cut',
          'cut',
          at(p, side * 1.01, low),
          at(q, side * 1.01, high),
          at(q, side * 1.01, high + 0.1),
          at(p, side * 1.01, low + 0.1),
          n,
        );
    }
    if (opening)
      panel(
        out,
        'wall',
        'soffit',
        at(p, -1, low),
        at(p, 1, low),
        at(q, 1, high),
        at(q, -1, high),
        down,
      );
  }
}
function approaches(out, tier, path) {
  const width = layout.halfWidth,
    p = walkwayFrames(path, width, true);
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1],
      b = p[i],
      dy = b.y - a.y,
      count = tier === 0 ? 1 : Math.max(1, Math.ceil(Math.abs(dy) / (tier === 1 ? 0.39 : 0.195)));
    for (let j = 0; j < count; j++) {
      const u = frameMix(a, b, j / count),
        v = frameMix(a, b, (j + 1) / count);
      const y = count === 1 ? u.y : dy > 0 ? u.y : v.y,
        Y = count === 1 ? v.y : y;
      panel(out, 'paving', 'paving', at(u, -1, y), at(u, 1, y), at(v, 1, Y), at(v, -1, Y), up);
      if (count > 1) {
        const k = dy > 0 ? v : u,
          high = dy > 0 ? v.y : u.y,
          direction = dy > 0 ? [u.x - v.x, 0, u.z - v.z] : [v.x - u.x, 0, v.z - u.z];
        panel(
          out,
          'paving',
          'riser',
          at(k, -1, y),
          at(k, 1, y),
          at(k, 1, high),
          at(k, -1, high),
          direction,
        );
      }
      if (tier > 0 && path === layout.west && i === 2) continue;
      for (const side of [-1, 1]) {
        const direction = [side * u.dx, 0, side * u.dz],
          floor = -0.95 * (i === 1 ? 1 : 0.73);
        panel(
          out,
          'wall',
          tier < 2 ? 'wall' : choose(warm, j + i, side),
          at(u, side, u.y + floor),
          at(v, side, v.y + floor),
          at(v, side, Math.max(Y, v.y)),
          at(u, side, Math.max(y, u.y)),
          direction,
        );
      }
    }
  }
  if (tier > 0 && path === layout.west) westRelief(out, tier, p[1], p[2]);
  walkWalls(out, tier, path, width, 0.57, true);
}
function gate(out, tier) {
  const [a, b, c] = layout.west,
    dx = c[0] - a[0],
    dz = c[1] - a[1],
    len = Math.hypot(dx, dz),
    u = [dx / len, 0, dz / len],
    n = [u[2], 0, -u[0]],
    P = (x, y, z) => [b[0] + n[0] * x + u[0] * z, b[2] + y, b[1] + n[2] * x + u[2] * z];
  const half = 0.73,
    outside = 1.46,
    divisions = [6, 8, 12, 16, 18][tier],
    stations = [
      -outside,
      ...Array.from({ length: divisions + 1 }, (_, i) => -half + (2 * half * i) / divisions),
      outside,
    ];
  const top = (q) =>
    2.51 +
    (0.21 * (q + outside)) / (2 * outside) +
    (tier >= 2 ? 0.14 * noise(Math.floor(q * 23), 10) : 0);
  for (let i = 1; i < stations.length; i++) {
    const x = stations[i - 1],
      X = stations[i],
      open = i > 1 && i < stations.length - 1;
    const y = (q) => (open ? 1.55 + 0.65 * Math.sqrt(Math.max(0, 1 - Math.pow(q / half, 2))) : 0);
    for (const side of [-1, 1]) {
      const z = side * 0.255,
        direction = u.map((v) => v * side);
      panel(
        out,
        'wall',
        'wall',
        P(x, y(x), z),
        P(X, y(X), z),
        P(X, top(X), z),
        P(x, top(x), z),
        direction,
      );
      if (open && tier)
        panel(
          out,
          'cut',
          'cut',
          P(x, y(x), z + side * 0.014),
          P(X, y(X), z + side * 0.014),
          P(X, y(X) + 0.145, z + side * 0.014),
          P(x, y(x) + 0.145, z + side * 0.014),
          direction,
        );
    }
    panel(
      out,
      'wall',
      'lit',
      P(x, top(x), -0.255),
      P(x, top(x), 0.255),
      P(X, top(X), 0.255),
      P(X, top(X), -0.255),
      up,
    );
    if (open)
      panel(
        out,
        'wall',
        'soffit',
        P(x, y(x), -0.255),
        P(x, y(x), 0.255),
        P(X, y(X), 0.255),
        P(X, y(X), -0.255),
        down,
      );
  }
  for (const side of [-1, 1])
    for (const [x, y, dir] of [
      [side * outside, top(side * outside), side],
      [side * half, 1.55, -side],
    ]) {
      panel(
        out,
        'wall',
        'wall',
        P(x, 0, -0.255),
        P(x, 0, 0.255),
        P(x, y, 0.255),
        P(x, y, -0.255),
        n.map((v) => v * dir),
      );
    }
}
export function buildBridgeLevel(out, level) {
  const tier = levels[level];
  if (tier === undefined) throw Error(`Unknown Shaharah Bridge level ${level}`);
  gorge(out, tier);
  bridgeBody(out, tier);
  approaches(out, tier, layout.west);
  approaches(out, tier, layout.east);
  gate(out, tier);
}
export const buildBridgeSkyline = (out) => buildBridgeLevel(out, 'skyline');
export const buildBridgeDistrict = (out) => buildBridgeLevel(out, 'district');
export const buildBridgeStreet = (out) => buildBridgeLevel(out, 'street');
export const buildBridgeCloseup = (out) => buildBridgeLevel(out, 'closeup');
