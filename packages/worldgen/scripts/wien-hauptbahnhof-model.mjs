/** Wien Hauptbahnhof, from the folded roof footprints to the public street entrances. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { prism, rect } from './khmer-structure-geometry.mjs';
import { lettering } from './stadium-lettering.mjs';

export const layout = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u2/u2e/wien_hauptbahnhof/layout.json',
      import.meta.url,
    ),
  ),
);
const stone = { slot: 'foundation', graph: 'stone_granite', roughness: 0.94 };
const concrete = { slot: 'wall', graph: 'concrete_plain', roughness: 0.9 };
const panel = { slot: 'wall', graph: 'concrete_panel', roughness: 0.86 };
const steel = { slot: 'trim', graph: 'metal_painted', roughness: 0.75, metallic: 0.18 };
const glass = { slot: 'wall', graph: 'glass_frit_triangular', roughness: 0.38 };
export const surfaces = {
  slab: concrete,
  structure: concrete,
  under: concrete,
  panel,
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.78, metallic: 0.16 },
  steel,
  white: steel,
  dark: steel,
  rail: steel,
  red: steel,
  ground: stone,
  ballast: stone,
  pavers: stone,
  ties: stone,
  roofGlass: glass,
  glass,
  shadowGlass: glass,
  clear: {
    slot: 'window',
    localRef: 'palette:#dbf3fc',
    roughness: 0.27,
    metallic: 0.04,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.52],
    doubleSided: true,
  },
};
const swatches = {
  slab: [0.65, 0.66, 0.64],
  structure: [0.69, 0.71, 0.69],
  under: [0.39, 0.43, 0.44],
  panel: [0.62, 0.64, 0.64],
  roof: [0.81, 0.85, 0.86],
  steel: [0.52, 0.59, 0.62],
  white: [0.92, 0.94, 0.93],
  dark: [0.22, 0.27, 0.29],
  rail: [0.42, 0.46, 0.48],
  red: [0.67, 0.07, 0.16],
  ground: [0.65, 0.64, 0.6],
  ballast: [0.53, 0.5, 0.47],
  pavers: [0.77, 0.76, 0.69],
  ties: [0.42, 0.43, 0.41],
  roofGlass: [0.41, 0.55, 0.63],
  glass: [0.3, 0.44, 0.48],
  shadowGlass: [0.21, 0.29, 0.31],
  clear: [0.64, 0.76, 0.8],
};
const linear = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const colors = Object.fromEntries(Object.entries(swatches).map(([k, v]) => [k, v.map(linear)]));
const up = [0, 1, 0],
  down = [0, -1, 0],
  west = [-1, 0, 0],
  south = [0, 0, 1],
  ref = 'palette:#ffffff';
const mix = (a, b, t) => a + (b - a) * t;
const between = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const tone = (i, j = 0) =>
  0.91 + (((Math.imul(i + 15, 30323) ^ Math.imul(j + 73, 87211)) >>> 7) % 173) / 1040;
const at = ([x, z], y) => [x, y, z];

function writer(out) {
  return (role, points, dir, tint = 1) => {
    for (let i = 1; i < points.length - 1; i++) {
      const p = [points[0], points[i], points[i + 1]].map((v) => v.map(Math.fround));
      let n = normalFor(...p);
      if (Math.hypot(...n) < 0.5) continue;
      if (dot(n, dir) < 0) {
        p.reverse();
        n = n.map((v) => -v);
      }
      out.addTriangle(
        role,
        ref,
        p,
        n,
        undefined,
        colors[role].map((v) => Math.min(1, v * tint)),
      );
    }
  };
}
function cap(f, role, polygon, height, dir = up) {
  const rings = [polygon.outline, ...(polygon.holes ?? [])],
    holes = [];
  let offset = rings[0].length;
  for (const ring of rings.slice(1)) {
    holes.push(offset);
    offset += ring.length;
  }
  const points = rings.flat(),
    ix = earcut(points.flat(), holes);
  const y = typeof height === 'number' ? () => height : height;
  for (let i = 0; i < ix.length; i += 3)
    f(
      role,
      ix.slice(i, i + 3).map((j) => at(points[j], y(points[j]))),
      dir,
    );
}
function perimeter(P) {
  const ring = P.outline,
    orientation = Math.sign(
      ring.reduce((sum, [x, z], i) => {
        const b = ring[(i + 1) % ring.length];
        return sum + x * b[1] - z * b[0];
      }, 0),
    );
  return ring.map((a, i) => {
    const b = ring[(i + 1) % ring.length],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return {
      a,
      b,
      length,
      normal: [(orientation * (b[1] - a[1])) / length, 0, (orientation * (a[0] - b[0])) / length],
    };
  });
}
const box = (f, r, x, z, w, d, lo, hi) => prism(f, r, rect(x, z, w, d), lo, hi, false);
function stripe(f, role, a, b, width, tint = 1) {
  const dx = b[0] - a[0],
    dz = b[2] - a[2],
    d = Math.hypot(dx, dz);
  if (d < 0.001) return;
  const x = ((-dz / d) * width) / 2,
    z = ((dx / d) * width) / 2;
  f(
    role,
    [
      [a[0] + x, a[1], a[2] + z],
      [b[0] + x, b[1], b[2] + z],
      [b[0] - x, b[1], b[2] - z],
      [a[0] - x, a[1], a[2] - z],
    ],
    up,
    tint,
  );
}
function xSample(knots, x) {
  const i = knots.findIndex((p) => p[0] >= x),
    b = knots[i < 0 ? knots.length - 1 : i],
    a = knots[Math.max(0, i < 0 ? knots.length - 2 : i - 1)];
  return a[0] === b[0] ? b[1] : mix(a[1], b[1], (x - a[0]) / (b[0] - a[0]));
}
const deckY = (x) => xSample(layout.deckProfile, x);

function deck(f, tier) {
  const D = layout.deck;
  // Split at the elevation controls so rails and platform edges follow the same profile.
  for (const section of layout.deckSections) cap(f, 'ballast', section, (p) => deckY(p[0]) + 0.035);
  cap(f, 'under', D, -1.35, down);
  for (const [i, e] of perimeter(D).entries()) {
    const a = at(e.a, deckY(e.a[0]) + 0.035),
      b = at(e.b, deckY(e.b[0]) + 0.035);
    const lo = layout.foundation[i][1],
      hi = layout.foundation[(i + 1) % D.outline.length][1];
    f('slab', [at(e.a, -1.31), at(e.b, -1.31), b, a], e.normal, tone(i));
    // Main entry and the south concourse penetrate the podium at street level.
    const m = between(e.a, e.b, 0.5);
    const doorway = (m[0] < -154 && m[1] < -40) || (m[1] > 60 && m[0] > -113 && m[0] < -31);
    if (!doorway)
      f(
        'structure',
        [at(e.a, lo), at(e.b, hi), at(e.b, -1.3), at(e.a, -1.3)],
        e.normal,
        tone(i, 3),
      );
    if (e.length < 17 || Math.abs(e.a[1] - e.b[1]) > 16 || m[1] < -68) continue;
    const shifted = ([x, y, z]) => [x + e.normal[0] * 0.055, y + 0.16, z + e.normal[2] * 0.055];
    const p = shifted(a),
      q = shifted(b);
    f(
      tier === 0 ? 'panel' : 'glass',
      [p, q, [q[0], q[1] + 1.17, q[2]], [p[0], p[1] + 1.17, p[2]]],
      e.normal,
      0.91,
    );
    if (tier >= 1) {
      const h0 = [p[0], p[1] + 1.17, p[2]],
        h1 = [q[0], q[1] + 1.17, q[2]];
      f('steel', [h0, h1, [h1[0], h1[1] + 0.1, h1[2]], [h0[0], h0[1] + 0.1, h0[2]]], e.normal);
    }
    if (tier >= 2)
      for (let d = 3; d < e.length - 1; d += tier >= 3 ? 3.2 : 7.6) {
        const [x, y, z] = between(p, q, d / e.length);
        box(f, 'steel', x, z, 0.13, 0.17, y, y + 1.21);
      }
  }
  box(f, 'slab', 211.65, 5.1, 13.4, 120.4, -1.33, deckY(211) + 0.045);
  if (tier >= 2) {
    for (const x of [-165, -137, -111, -85, -59, -35])
      box(f, 'structure', x, 61.45, 1.16, 1.5, -8.0, -1.31);
    for (const x of [193, 208])
      for (const z of [-39, -8, 32, 61]) box(f, 'structure', x, z, 1.55, 1.39, -5.55, -1.31);
  }
}

function triangleSkylight(f, out, points, tier, index) {
  const center = points.reduce((p, a) => p.map((n, i) => n + a[i] / 3), [0, 0, 0]);
  const inset = points.map((p) => between(center, p, 0.69));
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    f('roof', [points[i], points[j], inset[j], inset[i]], up, tone(i, index));
  }
  f('roofGlass', inset, up, tone(index));
  if (tier >= 2) {
    const lifted = (p) => [p[0], p[1] + 0.045, p[2]];
    for (let i = 0; i < 3; i++)
      beam(out, 'white', lifted(inset[i]), lifted(inset[(i + 1) % 3]), 0.12, 0.12, colors.white);
    const n = tier >= 3 ? 6 : 3;
    for (let i = 1; i < n; i++) {
      const a = lifted(between(inset[0], inset[1], i / n)),
        b = lifted(between(inset[0], inset[2], i / n));
      stripe(f, 'steel', a, b, 0.072);
    }
  }
}
function diamond(f, out, R, tier, index) {
  const center = R.outline.reduce((p, a) => p.map((v, i) => v + a[i] / 6), [0, 0]);
  const ring = R.outline.map((p) => between(p, center, 0.0048));
  const low = R.eave - 0.77;
  const heights = [
    R.eave,
    R.eave + 0.45,
    R.eave - 0.03,
    R.eave + 0.12,
    R.ridge - 0.45,
    R.eave + 0.13,
  ];
  const shell = ring.map((p, i) => at(p, heights[i]));
  const crest = [center[0] - 1.8, R.ridge, center[1] - 1.4];
  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6,
      a = shell[i],
      b = shell[j],
      p = ring[i],
      q = ring[j];
    const dx = b[0] - a[0],
      dz = b[2] - a[2],
      d = Math.hypot(dx, dz);
    const n = [dz / d, 0, -dx / d];
    const fascia = [at(p, a[1] - 0.45), at(q, b[1] - 0.45), b, a];
    if ((i === 1 || i === 4) && tier) triangleSkylight(f, out, [a, b, crest], tier, index + i);
    else if (i === 4) f('roofGlass', [a, b, crest], up);
    else f('roof', [a, b, crest], up, tone(i, index));
    if (tier) {
      f('white', fascia, n, 0.94);
      f(
        i === 3 || i === 4 ? 'shadowGlass' : 'under',
        [at(p, low), at(q, low), fascia[1], fascia[0]],
        n,
        tone(i, index),
      );
    } else
      f(
        i === 3 || i === 4 ? 'shadowGlass' : 'white',
        [at(p, low), at(q, low), b, a],
        n,
        tone(i, index),
      );
    if (tier >= 2 && [3, 4].includes(i)) {
      const count = Math.round(d / (tier === 2 ? 3.25 : 1.46));
      for (let j = 1; j < count; j++) {
        const t = j / count,
          y = mix(a[1], b[1], t) - 0.47,
          [x, z] = between(p, q, t);
        if (y - low < 0.18) continue;
        beam(
          out,
          'steel',
          [x + n[0] * 0.042, low, z + n[2] * 0.042],
          [x + n[0] * 0.042, y, z + n[2] * 0.042],
          0.085,
          0.09,
          colors.steel,
        );
      }
      if (tier >= 3)
        for (let y = low + 0.43; y < Math.max(a[1], b[1]) - 0.53; y += 0.44) {
          const u = (y + 0.48 - a[1]) / (b[1] - a[1]);
          const t0 = b[1] > a[1] ? Math.max(0, u) : 0,
            t1 = b[1] > a[1] ? 1 : Math.min(1, u);
          if (t1 - t0 < 0.028) continue;
          const P = (t) => {
            const [x, z] = between(p, q, t);
            return [x + n[0] * 0.073, y, z + n[2] * 0.073];
          };
          beam(out, 'steel', P(t0), P(t1), 0.078, 0.14, colors.steel);
        }
    }
    if (tier >= 3 && i !== 1 && i !== 4) {
      const n = Math.floor(d / 1.25);
      for (let j = 1; j < n; j++) {
        const q = between(a, b, j / n);
        stripe(
          f,
          'white',
          [q[0], q[1] + 0.024, q[2]],
          [crest[0], crest[1] + 0.026, crest[2]],
          0.039,
          0.88,
        );
      }
    }
  }
  cap(f, 'under', { outline: ring }, low, down);
}

function eastShelter(f, out, S, tier, i) {
  for (const P of S.parts) {
    const mean = P.outline.reduce((p, v) => p.map((x, j) => x + v[j] / P.outline.length), [0, 0]);
    const ridge = [mean[0], S.top, mean[1]],
      low = S.eave - 0.42;
    for (const E of perimeter(P)) {
      const a = at(E.a, S.eave),
        b = at(E.b, S.eave);
      f('roof', [a, b, ridge], up, tone(i));
      f('white', [at(E.a, low), at(E.b, low), b, a], E.normal);
    }
    cap(f, 'under', P, low, down);
    if (tier >= 2 && S.top > 6.8) {
      const [x, z] = mean;
      for (const side of [-1, 1])
        beam(out, 'steel', [x - 8, S.eave, z + side * 3.1], ridge, 0.16, 0.17, colors.steel);
    }
  }
}

function platform(f, out, P, tier) {
  const [a, b] = P.lanes.map((i) => layout.tracks[i]);
  const x0 = P.start,
    x1 = P.end,
    ax = P.accessX;
  const controls =
    tier === 0
      ? [x0, -105, 0, x1]
      : [x0, -165, -130, -92, ax - 4.3, ax + 4.3, -25, 60, 144, 200, x1];
  const samples = controls
    .filter((x) => x >= x0 && x <= x1)
    .sort((a, b) => a - b)
    .filter((x, i, r) => !i || x - r[i - 1] > 0.035);
  const middle = (x) => (xSample(a, x) + xSample(b, x)) / 2;
  const edge = (x, s) =>
    middle(x) + s * Math.max(0.74, (xSample(b, x) - xSample(a, x)) * 0.5 - 1.74);
  const y = (x) => deckY(x) + 0.84;
  for (let j = 1; j < samples.length; j++) {
    const x = samples[j - 1],
      b = samples[j],
      m = (x + b) / 2;
    const corners = (s1, s2) => [
      [x, y(x), s1(x)],
      [b, y(b), s1(b)],
      [b, y(b), s2(b)],
      [x, y(x), s2(x)],
    ];
    if (tier >= 2 && Math.abs(m - ax) < 4.28) {
      f(
        'pavers',
        corners(
          (t) => edge(t, -1),
          (t) => middle(t) - 1.7,
        ),
        up,
      );
      f(
        'pavers',
        corners(
          (t) => middle(t) + 1.7,
          (t) => edge(t, 1),
        ),
        up,
      );
    } else
      f(
        'pavers',
        corners(
          (t) => edge(t, -1),
          (t) => edge(t, 1),
        ),
        up,
        tone(P.number, j),
      );
    for (const s of [-1, 1]) {
      const u = edge(x, s),
        v = edge(b, s);
      f(
        'panel',
        [
          [x, deckY(x) + 0.06, u],
          [b, deckY(b) + 0.06, v],
          [b, y(b), v],
          [x, y(x), u],
        ],
        [0, 0, s],
      );
      if (tier)
        stripe(
          f,
          'white',
          [x, y(x) + 0.012, u - s * 0.21],
          [b, y(b) + 0.012, v - s * 0.21],
          0.2,
          0.94,
        );
    }
  }
  const spacing = tier === 0 ? 187 : tier === 1 ? 48 : tier === 2 ? 26 : 16;
  for (let x = x0 + 16; x < x1 - 12; x += spacing) {
    if (Math.abs(x - ax) < 7) continue;
    const z = middle(x),
      base = y(x),
      roof = x < 25 ? 6.6 : 4.5;
    box(f, 'structure', x, z, 0.72, 0.78, base, roof);
    if (tier >= 2) {
      box(f, 'steel', x, z, 0.95, 0.98, roof - 0.22, roof + 0.055);
      if (tier >= 3) {
        box(f, 'dark', x + 1.38, z, 1.8, 0.59, base, base + 0.48);
        box(f, 'steel', x + 1.38, z + 0.21, 1.72, 0.12, base + 0.43, base + 0.84);
      }
    }
  }
  if (tier >= 2) {
    const z = middle(ax),
      top = y(ax);
    for (let i = 0; i < (tier === 2 ? 8 : 18); i++) {
      const n = tier === 2 ? 8 : 18,
        x = ax - 4.11 + (i * 8.16) / n,
        y = top - 4.05 + (i * 4.05) / (n - 1);
      box(f, 'ground', x, z, 8.16 / n + 0.05, 3.15, y - 0.28, y);
    }
    for (const s of [-1, 1]) {
      beam(
        out,
        'steel',
        [ax - 4.17, top - 3.15, z + s * 1.68],
        [ax + 4.13, top + 0.97, z + s * 1.68],
        0.125,
        0.13,
        colors.steel,
      );
      box(f, 'panel', ax, z + s * 1.73, 8.5, 0.09, top - 0.16, top + 0.52);
    }
    box(f, 'dark', ax + 5.4, z, 1.44, 1.54, top, top + 2.44);
    if (tier >= 3) box(f, 'glass', ax + 4.66, z, 0.045, 1.22, top + 0.27, top + 2.12);
  }
}
function rails(f, tier) {
  if (!tier) return;
  for (const [j, T] of layout.tracks.entries()) {
    const path = tier === 1 ? T.filter((_, i) => i % 2 === 0 || i === T.length - 1) : T;
    for (let i = 1; i < path.length; i++) {
      const [x, z] = path[i - 1],
        [u, v] = path[i],
        a = deckY(x),
        b = deckY(u);
      for (const s of [-1, 1]) {
        const k = z + s * 0.7175,
          m = v + s * 0.7175;
        stripe(f, 'rail', [x, a + 0.27, k], [u, b + 0.27, m], tier === 1 ? 0.15 : 0.085, 1.05);
        if (tier >= 2)
          f(
            'dark',
            [
              [x, a + 0.27, k - 0.043],
              [u, b + 0.27, m - 0.043],
              [u, b + 0.14, m - 0.043],
              [x, a + 0.14, k - 0.043],
            ],
            [0, 0, -1],
          );
      }
    }
    if (tier >= 2)
      for (
        let x = T[0][0] + 0.7;
        x < T.at(-1)[0];
        x += tier === 2 ? 13.0 : tier === 3 ? 2.65 : 2.1
      ) {
        const z = xSample(T, x),
          y = deckY(x) + 0.13;
        stripe(f, 'ties', [x, y, z - 1.23], [x, y, z + 1.23], 0.2, tone(j, Math.round(x)));
      }
  }
}

function ramp(f, ring, heights) {
  const p = ring.map((v, i) => at(v, heights[i]));
  f('pavers', p, up);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      n = [b[2] - a[2], 0, a[0] - b[0]];
    f('structure', [[a[0], a[1] - 1.15, a[2]], [b[0], b[1] - 1.15, b[2]], b, a], n);
  }
}
function westForecourt(f, tier) {
  const [westX, eastX] = layout.northApron.slice(0, 2).map((p) => p[0]),
    y = layout.north.grade;
  const profile = tier
    ? layout.westApronProfile
    : layout.westApronProfile.filter((_, i) => i % 4 === 0);
  for (let i = 1; i < profile.length; i++) {
    const [a, lo] = profile[i - 1],
      [b, hi] = profile[i];
    f(
      'pavers',
      [
        [westX, lo, a],
        [eastX, y, a],
        [eastX, y, b],
        [westX, hi, b],
      ],
      up,
    );
    f(
      'structure',
      [
        [westX, lo - 1.3, a],
        [westX, hi - 1.3, b],
        [westX, hi, b],
        [westX, lo, a],
      ],
      west,
    );
  }
  for (const [i, [z, h]] of [profile[0], profile.at(-1)].entries())
    f(
      'panel',
      [
        [westX, h - 1.3, z],
        [eastX, y - 1.3, z],
        [eastX, y, z],
        [westX, h, z],
      ],
      [0, 0, i ? 1 : -1],
    );
}
function sign(f, out, N, tier) {
  const x = N.frontX - 0.083,
    z = N.centerZ,
    y = N.grade + 8.63,
    r = tier === 0 ? 1.09 : 1.49;
  const clockPoint = (angle, radius) => [
    x,
    y + Math.cos(angle) * radius,
    z + Math.sin(angle) * radius,
  ];
  const ticks = tier === 0 ? 4 : 12;
  for (let i = 0; i < ticks; i++) {
    const a = (i * Math.PI * 2) / ticks;
    const points = [
      clockPoint(a - 0.027, r - 0.19),
      clockPoint(a + 0.027, r - 0.19),
      clockPoint(a + 0.027, r),
      clockPoint(a - 0.027, r),
    ];
    f('white', points, west);
  }
  for (const [a, h, w] of [
    [-1.36, 0.89, 0.06],
    [0.56, 1.12, 0.075],
  ]) {
    const p = clockPoint(a, h),
      q = [x, y, z];
    if (tier) beam(out, 'white', q, p, w, 0.055, colors.white);
    else f('white', [q, [p[0], p[1] - 0.09, p[2] + 0.05], [p[0], p[1] + 0.08, p[2] - 0.05]], west);
  }
  if (tier >= 2) {
    const text = 'WIEN HAUPTBAHNHOF',
      width = 18.6,
      height = 0.71,
      y0 = N.grade + 3.72,
      front = x - 0.09;
    const paint = (role, _ref, points, normal) => {
      if (normal[2] < -0.6)
        f(
          role,
          points.map(([u, y, v]) => [v, y, z + u]),
          [normal[2], normal[1], normal[0]],
        );
    };
    const letters = { addConvexPolygon: paint, addQuad: paint };
    lettering(letters, text, { width, height, y: y0, z: front, stroke: 0.085, slot: 'white' });
    const strokes = {
      W: [
        [0, 1],
        [0.21, 0],
        [0.5, 0.66],
        [0.79, 0],
        [1, 1],
      ],
      U: [
        [0, 1],
        [0, 0.24],
        [0.18, 0],
        [0.82, 0],
        [1, 0.24],
        [1, 1],
      ],
      O: [
        [0.18, 0],
        [0, 0.21],
        [0, 0.79],
        [0.18, 1],
        [0.82, 1],
        [1, 0.79],
        [1, 0.21],
        [0.82, 0],
        [0.18, 0],
      ],
    };
    const advance = width / text.length;
    for (let i = 0; i < text.length; i++) {
      const row = strokes[text[i]];
      if (!row) continue;
      const point = ([u, v]) => [
        (i - text.length * 0.5 + u * 0.75) * advance,
        y0 + v * height,
        front,
      ];
      for (let j = 1; j < row.length; j++)
        beam(letters, 'white', point(row[j - 1]), point(row[j]), 0.085, 0.085, colors.white);
    }
  }
}
function entrances(f, out, tier) {
  const { north: N, south: S } = layout;
  const P = layout.outlines[N.id][0],
    Q = layout.outlines[S.id][0];
  westForecourt(f, tier);
  ramp(f, layout.southApron, [
    S.grade,
    S.grade,
    layout.southApronGrades[1],
    layout.southApronGrades[0],
  ]);
  const [westEdge, eastEdge] = [layout.northApron[3], layout.northApron[2]];
  f(
    'panel',
    [
      at(westEdge, layout.westApronGrades[1] - 0.23),
      at(eastEdge, N.grade - 0.23),
      at(eastEdge, deckY(eastEdge[0]) + 0.035),
      at(westEdge, deckY(westEdge[0]) + 0.035),
    ],
    [0, 0, -1],
  );
  cap(f, 'ground', P, N.grade);
  cap(f, 'ground', Q, S.grade);
  cap(f, 'roof', P, N.top);
  cap(f, 'roof', Q, S.top);
  cap(f, 'under', P, N.top - 0.43, down);
  for (const E of perimeter(P)) {
    const front = E.a[0] < -169 && E.b[0] < -169;
    const A = at(E.a, front ? N.grade + 3.38 : N.grade),
      B = at(E.b, front ? N.grade + 3.38 : N.grade);
    f(front ? 'clear' : 'glass', [A, B, at(E.b, N.top - 0.39), at(E.a, N.top - 0.39)], E.normal);
    f(
      'dark',
      [at(E.a, N.top - 0.4), at(E.b, N.top - 0.4), at(E.b, N.top), at(E.a, N.top)],
      E.normal,
    );
    if (tier && E.length > 7) {
      const n = Math.ceil(E.length / (tier === 1 ? 9.5 : tier === 2 ? 3.45 : 2.47));
      for (let i = 1; i < n; i++) {
        const [x, z] = between(E.a, E.b, i / n);
        box(f, 'dark', x, z, 0.1, 0.14, front ? N.grade + 3.38 : N.grade, N.top - 0.38);
      }
      for (let y = N.grade + 4.1; y < N.top - 1; y += tier === 1 ? 4.1 : 2.13)
        f(
          'steel',
          [at(E.a, y), at(E.b, y), at(E.b, y + 0.07), at(E.a, y + 0.07)].map(([x, y, z]) => [
            x + E.normal[0] * 0.043,
            y,
            z + E.normal[2] * 0.043,
          ]),
          E.normal,
        );
    }
  }
  const [za, zb] = N.portal,
    deck = N.grade;
  for (const [a, b] of [
    [N.z0, za],
    [zb, N.z1],
  ])
    f(
      'clear',
      [
        [N.frontX, deck, a],
        [N.frontX, deck, b],
        [N.frontX, deck + 3.38, b],
        [N.frontX, deck + 3.38, a],
      ],
      west,
    );
  box(f, 'dark', N.frontX - 0.19, N.centerZ, 1.36, 26.8, deck + 3.31, deck + 3.64);
  box(f, 'panel', N.frontX + 1.7, N.centerZ, 9.1, 35.9, N.top - 0.41, N.top + 0.14);
  cap(f, 'dark', rect(N.frontX + 1.7, N.centerZ, 9.1, 35.9), N.top - 0.41, down);
  sign(f, out, N, tier);
  if (tier >= 2) {
    for (const z of [za + 0.04, zb - 0.04])
      box(f, 'steel', N.frontX - 0.27, z, 0.25, 0.25, deck, deck + 3.38);
    for (let i = 0; i < 16; i++)
      box(
        f,
        'white',
        N.frontX - 1.45,
        N.z0 + 1.6 + 2.05 * i,
        0.16,
        0.19,
        N.top - 0.45,
        N.top - 0.39,
      );
    for (const z of [N.centerZ - 8.15, N.centerZ + 8.15]) {
      for (let i = 0; i < (tier >= 3 ? 20 : 9); i++) {
        const n = tier >= 3 ? 20 : 9,
          x = -152 + (i * 18) / n,
          y = deck + (5.68 * i) / (n - 1);
        box(f, 'ground', x, z, 18 / n + 0.03, 2.32, y - 0.25, y);
      }
      for (const s of [-1, 1])
        beam(
          out,
          'dark',
          [-152, deck + 0.96, z + s * 1.21],
          [-134, 0.99, z + s * 1.21],
          0.095,
          0.11,
          colors.dark,
        );
    }
  }
  for (const E of perimeter(Q)) {
    const front = E.a[1] > 87.9 && E.b[1] > 87.9;
    f(
      'glass',
      [
        at(E.a, front ? S.grade + 3.34 : S.grade),
        at(E.b, front ? S.grade + 3.34 : S.grade),
        at(E.b, S.top - 0.28),
        at(E.a, S.top - 0.28),
      ],
      E.normal,
    );
    f(
      'steel',
      [at(E.a, S.top - 0.28), at(E.b, S.top - 0.28), at(E.b, S.top), at(E.a, S.top)],
      E.normal,
    );
  }
  for (const [a, b] of [
    [S.x0, S.portal[0]],
    [S.portal[1], S.x1],
  ])
    f(
      'clear',
      [
        [a, S.grade, S.frontZ],
        [b, S.grade, S.frontZ],
        [b, S.grade + 3.34, S.frontZ],
        [a, S.grade + 3.34, S.frontZ],
      ],
      south,
    );
  box(
    f,
    'dark',
    (S.x0 + S.x1) / 2,
    S.frontZ + 0.12,
    S.x1 - S.x0 + 0.42,
    2.92,
    S.top - 0.36,
    S.top + 0.04,
  );
  cap(
    f,
    'under',
    rect((S.x0 + S.x1) / 2, S.frontZ + 0.12, S.x1 - S.x0 + 0.42, 2.92),
    S.top - 0.36,
    down,
  );
  if (tier >= 1) {
    for (let x = S.x0 + 1.7; x < S.x1; x += tier === 1 ? 9.0 : 3.65)
      box(f, 'steel', x, S.frontZ, 0.14, 0.17, S.grade + 3.33, S.top - 0.31);
    box(f, 'red', S.x1 - 6.6, S.frontZ + 0.27, 3.4, 0.17, S.grade + 3.84, S.grade + 4.75);
  }
  for (const P of layout.outlines[layout.parapetId]) prism(f, 'panel', P, -2.62, -0.76, false);
}

const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
export function buildViennaLevel(out, level) {
  const tier = tiers[level],
    f = writer(out);
  deck(f, tier);
  entrances(f, out, tier);
  for (const [i, R] of layout.roof.entries()) diamond(f, out, R, tier, i);
  if (tier) for (const [i, S] of layout.east.entries()) eastShelter(f, out, S, tier, i);
  else
    for (const [x, z, w] of [
      [137, -43.3, 162],
      [118, -22.55, 198],
      [100, -1.52, 238],
      [118, 24.72, 198],
      [137, 46.03, 162],
    ])
      eastShelter(f, out, { parts: [rect(x, z, w, 12.7)], eave: 4.8, top: 6.15 }, tier, 0);
  for (const P of layout.platforms) platform(f, out, P, tier);
  rails(f, tier);
}
export const buildViennaSkyline = (out) => buildViennaLevel(out, 'skyline');
export const buildViennaDistrict = (out) => buildViennaLevel(out, 'district');
export const buildViennaStreet = (out) => buildViennaLevel(out, 'street');
export const buildViennaCloseup = (out) => buildViennaLevel(out, 'closeup');
