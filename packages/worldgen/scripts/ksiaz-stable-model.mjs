/** Original medium-fi exterior of the five-range Książ stable quadrangle and riding hall. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';

export const ksiazStableModels = [
  {
    id: 'KSI_E01',
    key: 'ksiaz_stable_ensemble',
    title: 'Książ stable ensemble',
    way: 238999226,
    component: 'stable-ensemble',
    brief:
      'Open stable quadrangle with five distinct ranges, arched gate tower, carriage-house bays, red mansard residence tower, cream administration gable, timber framing and the separate covered riding hall with connecting annexes.',
    primaryDescription:
      'Own named stable ensemble, NID A/4631/655/WŁ. Exterior identities follow the numbered 2005 primary monograph plan and photographs, plus the operator aerial. One connected source asset represents the ranges; these are not five separately surveyed footprints.',
    references: [
      'https://pcbj.pl/wp-content/uploads/Stado-ogierow-Ksiaz-2005-Izabela-Rajca-Pisz.pdf',
      'https://www.stadoksiaz.pl/zwiedzanie',
      'https://www.openstreetmap.org/way/276970733',
    ],
    cameras: [
      { name: 'quadrangle-and-gate-towers', position: [-175, 116, -165], lookAt: [12, 5, 0] },
      { name: 'stable-wings-and-riding-hall', position: [190, 110, 165], lookAt: [12, 5, 0] },
      { name: 'own-outlines-and-open-courtyard', position: [22, 345, 4], lookAt: [18, 2, 0] },
      { name: 'gate-passage-and-carriage-bays', position: [-8, 15, -26], lookAt: [-57.2, 6, -26] },
    ],
  },
];
export const ksiazStableSurfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.88, metallic: 0 },
  rubble: { slot: 'foundation', graph: 'stone_drywall', roughness: 0.92, metallic: 0 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.85, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.87, metallic: 0 },
  glass: { slot: 'window', roughness: 0.35, metallic: 0.1 },
};
export const ksiazStablePalette = {
  wall: '#efe7cf',
  trim: '#ece4ce',
  stone: '#cbbf9f',
  roof: '#c27e59',
  slate: '#7d8180',
  timber: '#6d5c4b',
  door: '#857c58',
  glass: '#536c7c',
};
const colors = Object.fromEntries(
  Object.entries(ksiazStablePalette).map(([k, h]) => [
    k,
    h
      .slice(1)
      .match(/../g)
      .map((v) => {
        const s = parseInt(v, 16) / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      }),
  ]),
);
const dir = new URL(
  '../../../content/worldgen/source/places/u3/u35/ksiaz_stable_ensemble/',
  import.meta.url,
);
const frame = JSON.parse(readFileSync(new URL('map-frame.json', dir)));
const means = JSON.parse(readFileSync(new URL('surface-means.json', dir)));

function face(o, p, col = 'wall', slot = 'plaster', target) {
  p = p.map((v) => v.map(Math.fround));
  for (let i = 1; i < p.length - 1; i++) {
    let t = [p[0], p[i], p[i + 1]],
      n = normalFor(...t);
    const a = t[1].map((v, j) => v - t[0][j]),
      b = t[2].map((v, j) => v - t[0][j]);
    if (
      Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]) <
      1e-8
    )
      continue;
    if (target && n.reduce((s, v, j) => s + v * target[j], 0) < 0) {
      t = [t[0], t[2], t[1]];
      n = normalFor(...t);
    }
    o.addTriangle(
      slot,
      'palette:#ffffff',
      t,
      n,
      t.map((v) => [v[0], v[1]]),
      colors[col],
    );
  }
}
function local(o, x, z, angle = 0) {
  const r = ([u, y, v]) => [
    u * Math.cos(angle) + v * Math.sin(angle),
    y,
    -u * Math.sin(angle) + v * Math.cos(angle),
  ];
  return {
    addTriangle: (s, ref, p, n, uv, col) =>
      o.addTriangle(
        s,
        ref,
        p.map((v) => {
          const q = r(v);
          return [q[0] + x, q[1], q[2] + z];
        }),
        r(n),
        uv,
        col,
      ),
  };
}
function panel(o, x, y, z, w, h, col = 'timber', slot = 'timber') {
  face(
    o,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    col,
    slot,
    [0, 0, 1],
  );
}
/** Place facade details on the actual mapped side instead of a nearby nominal axis plane. */
function conformFacade(o, axis, nominal, samples) {
  const other = axis === 0 ? 2 : 0,
    sorted = [...samples].sort((a, b) => a[0] - b[0]);
  const coordinate = (v) => {
    let a = sorted[0],
      b = sorted[1];
    for (let i = 1; i < sorted.length; i++) {
      a = sorted[i - 1];
      b = sorted[i];
      if (v <= b[0]) break;
    }
    const t = Math.max(0, Math.min(1, (v - a[0]) / (b[0] - a[0])));
    return a[1] + (b[1] - a[1]) * t;
  };
  return {
    addTriangle: (s, r, p, _n, uv, col) => {
      const q = p.map((v) =>
        v.map((x, i) => (i === axis ? x + coordinate(v[other]) - nominal : x)),
      );
      o.addTriangle(s, r, q, normalFor(...q), uv, col);
    },
  };
}
function beam(o, a, b, w = 0.18, z = 0.045, col = 'timber', slot = 'timber') {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    l = Math.hypot(dx, dy),
    nx = ((-dy / l) * w) / 2,
    ny = ((dx / l) * w) / 2;
  face(
    o,
    [
      [a[0] - nx, a[1] - ny, z],
      [b[0] - nx, b[1] - ny, z],
      [b[0] + nx, b[1] + ny, z],
      [a[0] + nx, a[1] + ny, z],
    ],
    col,
    slot,
    [0, 0, 1],
  );
}
function box(o, x, y, z, w, h, depth, col = 'trim', slot = 'plaster') {
  const a = x - w / 2,
    b = x + w / 2,
    u = z - depth / 2,
    v = z + depth / 2,
    t = y + h;
  for (const [p, n] of [
    [
      [
        [a, y, v],
        [b, y, v],
        [b, t, v],
        [a, t, v],
      ],
      [0, 0, 1],
    ],
    [
      [
        [b, y, u],
        [a, y, u],
        [a, t, u],
        [b, t, u],
      ],
      [0, 0, -1],
    ],
    [
      [
        [a, y, u],
        [a, y, v],
        [a, t, v],
        [a, t, u],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [b, y, v],
        [b, y, u],
        [b, t, u],
        [b, t, v],
      ],
      [1, 0, 0],
    ],
    [
      [
        [a, t, u],
        [b, t, u],
        [b, t, v],
        [a, t, v],
      ],
      [0, 1, 0],
    ],
  ])
    face(o, p, col, slot, n);
}
function cap(o, p, y, col = 'wall', slot = 'plaster', target = [0, 1, 0]) {
  const ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3)
    face(
      o,
      ix.slice(i, i + 3).map((k) => [p[k][0], typeof y === 'function' ? y(p[k]) : y, p[k][1]]),
      col,
      slot,
      target,
    );
}
function ring(o, p, low, high, col = 'wall', slot = 'plaster') {
  const area = p.reduce((s, a, i) => {
      const b = p[(i + 1) % p.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0),
    sign = Math.sign(area);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      n = [sign * (b[1] - a[1]), 0, -sign * (b[0] - a[0])];
    face(
      o,
      [
        [a[0], low, a[1]],
        [b[0], low, b[1]],
        [b[0], high, b[1]],
        [a[0], high, a[1]],
      ],
      col,
      slot,
      n,
    );
  }
}
function hip(o, x, z, w, len, eave, peak, slot = 'tile', col = 'roof') {
  const a = x - w / 2,
    b = x + w / 2,
    u = z - len / 2,
    v = z + len / 2,
    run = Math.min(w / 2, len * 0.36),
    ru = u + run,
    rv = v - run;
  for (const p of [
    [
      [a, eave, u],
      [b, eave, u],
      [x, peak, ru],
    ],
    [
      [b, eave, u],
      [b, eave, v],
      [x, peak, rv],
      [x, peak, ru],
    ],
    [
      [b, eave, v],
      [a, eave, v],
      [x, peak, rv],
    ],
    [
      [a, eave, v],
      [a, eave, u],
      [x, peak, ru],
      [x, peak, rv],
    ],
  ])
    face(o, p, col, slot, [0, 1, 0]);
}
/** Trim the stable-I roof to the mapped outer corner step before joining stable II. */
function cornerRoof(o) {
  const clip = (p, axis, value, greater) => {
    const out = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        ai = greater ? a[axis] >= value : a[axis] <= value,
        bi = greater ? b[axis] >= value : b[axis] <= value;
      if (ai) out.push(a);
      if (ai !== bi) {
        const t = (value - a[axis]) / (b[axis] - a[axis]);
        out.push(a.map((v, j) => v + (b[j] - v) * t));
      }
    }
    return out;
  };
  return {
    addTriangle: (s, r, p, n, _uv, col) => {
      for (const q of [clip(p, 0, 39, false), clip(clip(p, 0, 39, true), 2, 56.7, false)])
        for (let i = 1; i < q.length - 1; i++) {
          const t = [q[0], q[i], q[i + 1]];
          if (Math.hypot(...normalFor(...t)) === 0) continue;
          o.addTriangle(
            s,
            r,
            t,
            n,
            t.map((v) => [v[0], v[1]]),
            col,
          );
        }
    },
  };
}
function gabledRoof(o, x, z, w, len, eave, peak, d, slot = 'tile', col = 'roof') {
  const a = x - w / 2,
    b = x + w / 2,
    u = z - len / 2,
    v = z + len / 2;
  for (const p of [
    [
      [a, eave, u],
      [x, peak, u],
      [x, peak, v],
      [a, eave, v],
    ],
    [
      [x, peak, u],
      [b, eave, u],
      [b, eave, v],
      [x, peak, v],
    ],
  ])
    face(o, p, col, slot, [0, 1, 0]);
  for (const [end, angle] of [
    [v, 0],
    [u, Math.PI],
  ]) {
    const q = local(o, x, end, angle);
    face(
      q,
      [
        [-w / 2, eave, 0],
        [w / 2, eave, 0],
        [0, peak, 0],
      ],
      'wall',
      'plaster',
      [0, 0, 1],
    );
    if (d >= 1) {
      beam(q, [-w / 2, eave], [0, peak]);
      beam(q, [w / 2, eave], [0, peak]);
      beam(q, [0, eave], [0, peak]);
    }
  }
}
function archLoop(x, y, w, h, steps = 8) {
  const spring = y + h - w * 0.24;
  return [
    [x - w / 2, y],
    [x + w / 2, y],
    [x + w / 2, spring],
    ...Array.from({ length: steps }, (_, i) => {
      const t = ((i + 1) / steps) * Math.PI;
      return [x + (Math.cos(t) * w) / 2, spring + Math.sin(t) * w * 0.24];
    }),
  ];
}
function opening(o, x, y, w, h, d, door = false) {
  const p = archLoop(x, y, w, h, d >= 2 ? 10 : 6),
    ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3)
    face(
      o,
      ix.slice(i, i + 3).map((k) => [...p[k], 0.025]),
      door ? 'door' : 'glass',
      door ? 'timber' : 'glass',
      [0, 0, 1],
    );
  if (d >= 2)
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length];
      beam(o, a, b, 0.16, 0.045, 'stone', 'stone');
    }
  if (d >= 3) {
    beam(o, [x, y], [x, y + h - 0.16], 0.075, 0.075, 'trim', 'plaster');
    if (!door)
      beam(
        o,
        [x - w / 2, y + h * 0.52],
        [x + w / 2, y + h * 0.52],
        0.065,
        0.075,
        'trim',
        'plaster',
      );
  }
}
function window(o, x, y, w, h, d) {
  panel(o, x, y, 0.025, w, h, 'glass', 'glass');
  if (d >= 2) {
    for (const u of [-w / 2, w / 2])
      beam(o, [x + u, y], [x + u, y + h], 0.13, 0.06, 'trim', 'plaster');
    for (const v of [y, y + h])
      beam(o, [x - w / 2, v], [x + w / 2, v], 0.13, 0.06, 'trim', 'plaster');
  }
  if (d >= 3) {
    beam(o, [x, y], [x, y + h], 0.07, 0.075, 'trim', 'plaster');
    beam(o, [x - w / 2, y + h * 0.55], [x + w / 2, y + h * 0.55], 0.07, 0.075, 'trim', 'plaster');
  }
}
function framing(o, length, y, h, d) {
  if (d === 0) return;
  for (const v of [y, y + h]) panel(o, 0, v, 0.045, length, 0.18);
  const n = Math.max(1, Math.round(length / 3.7)),
    step = length / n;
  for (let i = 0; i <= n; i++) {
    const x = -length / 2 + i * step;
    panel(o, x, y, 0.05, 0.18, h);
    if (i < n && (i % 2 === 0 || d >= 2)) {
      beam(o, [x, y], [x + step, y + h], 0.14, 0.052);
      if (i % 3 === 0) beam(o, [x + step, y], [x, y + h], 0.14, 0.052);
    }
  }
}
function dormantGable(o, x, z, angle, w, base, top, depth, d) {
  const q = local(o, x, z, angle),
    half = w / 2;
  panel(q, 0, base - 1.6, 0, w, 1.6, 'wall', 'plaster');
  face(
    q,
    [
      [-half, base, 0],
      [half, base, 0],
      [0, top, 0],
    ],
    'wall',
    'plaster',
    [0, 0, 1],
  );
  for (const sign of [-1, 1])
    face(
      q,
      [
        [sign * (half + 0.15), base, 0.2],
        [0, top + 0.1, 0.2],
        [0, top + 0.1, -depth],
        [sign * (half + 0.15), base, -depth],
      ],
      'roof',
      'tile',
      [0, 1, 0],
    );
  if (d >= 1) {
    beam(q, [-half, base], [0, top], 0.21);
    beam(q, [half, base], [0, top], 0.21);
    beam(q, [0, base - 1.6], [0, top], 0.17);
    panel(q, 0, base - 1.6, 0.045, w, 0.19);
    for (const dx of [-w * 0.23, w * 0.23]) window(q, dx, base - 1.35, w * 0.25, 1.15, d);
  }
}
function gateHeight(z) {
  const g = frame.controls,
    t = (z - g.gateCenter[1]) / (g.gateWidth / 2);
  return Math.abs(t) <= 1.000001
    ? g.gateSpring + (g.gateCrown - g.gateSpring) * Math.sqrt(Math.max(0, 1 - t * t))
    : 0;
}
function bodyHeight(x, z) {
  if (x < -48 && z < -49) return 13.3;
  if (x < -48 && Math.abs(z - frame.controls.gateCenter[1]) < 6.0) return 12.2;
  if (z > 43 && z < 46.4 && x < 39) return 4.75;
  if (z > 43 && x < 39) return 10.4;
  if (x > 48 && z > frame.controls.stableIIBeginZ) return 10.4;
  if (x > 48 && z > frame.controls.stableIIIEndZ && z < frame.controls.stableIIBeginZ) return 8.5;
  return 6.65;
}
function stableWalls(o, loop) {
  const sign = Math.sign(
    loop.reduce((s, a, i) => {
      const b = loop[(i + 1) % loop.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0),
  );
  for (let i = 0; i < loop.length; i++) {
    const aa = loop[i],
      bb = loop[(i + 1) % loop.length],
      ts = [0, 1],
      g = frame.controls;
    for (const [axis, levels] of [
      [0, [-48, 39, 48]],
      [
        1,
        [
          -49,
          g.gateCenter[1] - 6,
          g.gateCenter[1] + 6,
          g.gateCenter[1] - g.gateWidth / 2,
          g.gateCenter[1] + g.gateWidth / 2,
          g.stableIIIEndZ,
          g.stableIIBeginZ,
          43,
        ],
      ],
    ]) {
      if (Math.abs(bb[axis] - aa[axis]) > 1e-5)
        for (const v of levels) {
          const t = (v - aa[axis]) / (bb[axis] - aa[axis]);
          if (t > 1e-6 && t < 1 - 1e-6) ts.push(t);
        }
    }
    ts.sort((a, b) => a - b);
    for (let j = 1; j < ts.length; j++) {
      const a = aa.map((v, k) => v + (bb[k] - v) * ts[j - 1]),
        b = aa.map((v, k) => v + (bb[k] - v) * ts[j]),
        mid = a.map((v, k) => (v + b[k]) / 2),
        h = bodyHeight(...mid),
        n = [sign * (b[1] - a[1]), 0, -sign * (b[0] - a[0])],
        gate = mid[0] < -48 && Math.abs(mid[1] - g.gateCenter[1]) < g.gateWidth / 2;
      if (gate) {
        const count = 8,
          p = Array.from({ length: count + 1 }, (_, k) => {
            const t = k / count,
              x = a[0] + (b[0] - a[0]) * t,
              z = a[1] + (b[1] - a[1]) * t;
            return [x, gateHeight(z), z];
          });
        p.push([b[0], h, b[1]], [a[0], h, a[1]]);
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
          ix = earcut(
            p.flatMap((v) => [
              ((v[0] - a[0]) * (b[0] - a[0])) / len + ((v[2] - a[1]) * (b[1] - a[1])) / len,
              v[1],
            ]),
          );
        for (let k = 0; k < ix.length; k += 3)
          face(
            o,
            ix.slice(k, k + 3).map((j) => p[j]),
            'wall',
            'plaster',
            n,
          );
      } else
        for (const [low, hi, col, slot] of [
          [0, 0.4, 'stone', 'rubble'],
          [0.4, h, 'wall', 'plaster'],
        ])
          face(
            o,
            [
              [a[0], low, a[1]],
              [b[0], low, b[1]],
              [b[0], hi, b[1]],
              [a[0], hi, a[1]],
            ],
            col,
            slot,
            n,
          );
    }
  }
  // The arch is a real passage: only its soffit spans the footprint thickness.
  const g = frame.controls,
    steps = 12;
  for (let i = 0; i < steps; i++) {
    const z0 = g.gateCenter[1] + (Math.cos((i / steps) * Math.PI) * g.gateWidth) / 2,
      z1 = g.gateCenter[1] + (Math.cos(((i + 1) / steps) * Math.PI) * g.gateWidth) / 2,
      y0 = gateHeight(z0),
      y1 = gateHeight(z1);
    face(
      o,
      [
        [-64.646, y0, z0],
        [-50.3, y0, z0],
        [-50.3, y1, z1],
        [-64.646, y1, z1],
      ],
      'stone',
      'stone',
      [0, -1, 0],
    );
  }
  for (const z of [g.gateCenter[1] - g.gateWidth / 2, g.gateCenter[1] + g.gateWidth / 2])
    face(
      o,
      [
        [-64.646, 0, z],
        [-50.3, 0, z],
        [-50.3, g.gateSpring, z],
        [-64.646, g.gateSpring, z],
      ],
      'stone',
      'stone',
      [0, 0, z < g.gateCenter[1] ? 1 : -1],
    );
}
function mansard(o, x, z, w, len, d) {
  const low = 13.3,
    br = 17.8,
    top = 19.6,
    shrink = 1.9;
  const outer = [
      [x - w / 2, z - len / 2],
      [x + w / 2, z - len / 2],
      [x + w / 2, z + len / 2],
      [x - w / 2, z + len / 2],
    ],
    inner = [
      [x - w / 2 + shrink, z - len / 2 + shrink],
      [x + w / 2 - shrink, z - len / 2 + shrink],
      [x + w / 2 - shrink, z + len / 2 - shrink],
      [x - w / 2 + shrink, z + len / 2 - shrink],
    ];
  for (let i = 0; i < 4; i++) {
    const k = (i + 1) % 4;
    face(
      o,
      [
        [outer[i][0], low, outer[i][1]],
        [outer[k][0], low, outer[k][1]],
        [inner[k][0], br, inner[k][1]],
        [inner[i][0], br, inner[i][1]],
      ],
      'roof',
      'tile',
      [0, 1, 0],
    );
  }
  hip(o, x, z, w - shrink * 2, len - shrink * 2, br, top);
  if (d >= 1)
    for (const [xx, zz, ang] of [
      [x + w / 2 - 1, z, Math.PI / 2],
      [x - w / 2 + 1, z, -Math.PI / 2],
      [x, z + len / 2 - 1, 0],
      [x, z - len / 2 + 1, Math.PI],
    ])
      dormantGable(o, xx, zz, ang, 2, 16.4, 17.4, 1.5, d);
  box(o, x - 2.4, 18, z + 1.8, 0.85, 2.3, 0.8, 'stone', 'stone');
}
function mainFacades(o, d) {
  if (d === 0) return;
  // Stable I, own long southern range with two timber-framed upper floors.
  for (const [z, angle] of [
    [46.9, Math.PI],
    [59.7, 0],
  ]) {
    const inner = frame.geometry.outline;
    const projected =
      z < 50
        ? conformFacade(
            o,
            2,
            z,
            [21, 22, 25, 26, 29, 30].map((i) => [inner[i][0], inner[i][1]]),
          )
        : o;
    const q = local(projected, -6.5, z, angle);
    framing(q, 81.5, 4.1, 2.45, d);
    framing(q, 81.5, 6.65, 3.55, d);
    for (let i = 0; i < 16; i++) {
      const x = -37.5 + i * 5;
      opening(q, x, 0.9, 1.15, 1.95, d);
      window(q, x, 7.25, 1.22, 1.65, d);
    }
  }
  // Stable II and III courtyard faces; plaster administration interrupts the framing.
  for (const [z, len, upper] of [
    [20.6, 43.8, true],
    [-40.6, 38.0, false],
  ]) {
    const inner = frame.geometry.outline;
    const q = local(
      conformFacade(
        o,
        0,
        49.15,
        [37, 38].map((i) => [inner[i][1], inner[i][0]]),
      ),
      49.15,
      z,
      -Math.PI / 2,
    );
    framing(q, len, upper ? 4.1 : 4.5, upper ? 2.45 : 1.8, d);
    if (upper) framing(q, len, 6.65, 3.55, d);
    const n = Math.round(len / 4.4);
    for (let i = 0; i < n; i++) {
      const x = -len / 2 + ((i + 0.5) * len) / n;
      opening(q, x, 0.75, 1.35, 2.15, d);
      if (upper) window(q, x, 7.25, 1.2, 1.65, d);
    }
  }
  const admin = local(o, 48.96, frame.controls.adminCenter[1], -Math.PI / 2);
  for (const y of [0.95, 4.8])
    for (const x of [-6.5, -3.25, 0, 3.25, 6.5])
      opening(admin, x, y, 1.3, y < 2 ? 2.15 : 1.85, d, x === 0 && y < 2);
  for (const y of [0.48, 4.2, 8.3]) panel(admin, 0, y, 0.06, 17.8, 0.18, 'stone', 'stone');
  const gable = local(o, 48.85, frame.controls.adminCenter[1], -Math.PI / 2);
  for (const x of [-3.6, 0, 3.6]) opening(gable, x, 8.85, 0.9, 1.6, d);
  // Stable IV is the low long range, rebuilt after its 1998 fire.
  for (const [z, angle] of [
    [-49.6, 0],
    [-63.65, Math.PI],
  ]) {
    const q = local(o, 6, z, angle);
    framing(q, 98, 4.5, 1.8, d);
    for (let i = 0; i < 19; i++) opening(q, -44 + i * 4.9, 0.8, 1.3, 2.05, d);
  }
  for (const x of [-25, 0, 25, 44]) dormantGable(o, x, -49.4, 0, 3.2, 7.0, 9.05, 4, d);
  // The new carriage house is distinct from the older carriage-house/stable-IV range.
  const inner = frame.geometry.outline;
  const carriage = local(
    conformFacade(
      o,
      0,
      -50.35,
      [39, 40].map((i) => [inner[i][1], inner[i][0]]),
    ),
    -50.35,
    -32,
    Math.PI / 2,
  );
  framing(carriage, 33, 4.8, 1.55, d);
  for (const x of [-12, -6, 0, 6, 12]) opening(carriage, x, 0.15, 4.35, 4.5, d, true);
  const fifth = local(o, -51.6, 14.7, Math.PI / 2);
  framing(fifth, 39, 4.8, 1.55, d);
  for (const x of [-15, -7.5, 0, 7.5, 15]) opening(fifth, x, 0.9, 1.2, 2, d);
  for (const [x, z, w, len, y, h] of [
    [-57.0, -56.1, 17.3, 16, 8.4, 4.7],
    [-57.2, -10.4, 14.0, 11.8, 9.9, 2.1],
  ]) {
    for (const [xx, zz, ang, l] of [
      [x + w / 2, z, Math.PI / 2, len],
      [x - w / 2, z, -Math.PI / 2, len],
      [x, z + len / 2, 0, w],
      [x, z - len / 2, Math.PI, w],
    ]) {
      const q = local(o, xx, zz, ang);
      framing(q, l, y, h, d);
      for (const dx of [-l * 0.26, l * 0.26]) window(q, dx, y + 0.5, 1.15, 1.55, d);
    }
  }
  for (const [xx, angle] of [
    [-50.25, Math.PI / 2],
    [-64.68, -Math.PI / 2],
  ]) {
    const q = local(o, xx, frame.controls.gateCenter[1], angle);
    // Align the opening's elliptic crown with the actual gate soffit, not a painted door.
    const g = frame.controls;
    for (let i = 0; i < 12; i++) {
      const t0 = (i / 12) * Math.PI,
        t1 = ((i + 1) / 12) * Math.PI;
      beam(
        q,
        [
          (Math.cos(t0) * g.gateWidth) / 2,
          g.gateSpring + Math.sin(t0) * (g.gateCrown - g.gateSpring),
        ],
        [
          (Math.cos(t1) * g.gateWidth) / 2,
          g.gateSpring + Math.sin(t1) * (g.gateCrown - g.gateSpring),
        ],
        0.36,
        0.045,
        'stone',
        'stone',
      );
    }
    for (const u of [-g.gateWidth / 2, g.gateWidth / 2])
      panel(q, u, 0, 0.05, 0.36, g.gateSpring, 'stone', 'stone');
    window(q, 0, 7.7, 2.0, 0.95, d);
  }
  // Rounded former canteen closes the inner corner beside stable I/II.
  const bar = local(o, 43.1, 42.7, Math.PI);
  framing(bar, 6, 3.0, 2.4, d);
  for (const x of [-1.6, 1.6]) window(bar, x, 3.35, 2.6, 1.8, d);
}
function residence(o, d) {
  // Octagonal turret from the mapped bulge at the free end of stable I.
  const p = frame.geometry.outline.slice(14, 22);
  ring(o, p, 0, 10.4);
  cap(o, p, 10.4);
  const x = p.reduce((s, v) => s + v[0], 0) / p.length,
    z = p.reduce((s, v) => s + v[1], 0) / p.length;
  for (let i = 0; i < 8; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    face(
      o,
      [
        [a[0], 10.4, a[1]],
        [b[0], 10.4, b[1]],
        [x, 15.2, z],
      ],
      'slate',
      'slate',
      [0, 1, 0],
    );
  }
  if (d >= 1)
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        q = local(o, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(b[1] - a[1], -(b[0] - a[0])));
      framing(q, len, 4.8, 2.4, d);
      framing(q, len, 7.2, 3.1, d);
      if (len > 1.0) window(q, 0, 5.3, 0.65, 1.2, d);
    }
}
function ridingHall(o, d) {
  const p = frame.geometry.components[0].outline.slice(0, -1),
    sign = Math.sign(
      p.reduce((s, a, i) => {
        const b = p[(i + 1) % p.length];
        return s + a[0] * b[1] - b[0] * a[1];
      }, 0),
    );
  cap(o, p, 0, 'stone', 'rubble', [0, -1, 0]);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      h = (a[0] + b[0]) / 2 >= 79 ? 5.8 : 5.15,
      n = [sign * (b[1] - a[1]), 0, -sign * (b[0] - a[0])];
    face(
      o,
      [
        [a[0], 0, a[1]],
        [b[0], 0, b[1]],
        [b[0], h, b[1]],
        [a[0], h, a[1]],
      ],
      'wall',
      'plaster',
      n,
    );
  }
  gabledRoof(o, 90.68, -17.3, 23.7, 47.2, 5.8, 12.15, d);
  // Attached side range and corridor retain their own jogged outline; open exterior only.
  const annex = p.filter((q) => q[0] <= 85.7);
  cap(o, annex, 5.15, 'slate', 'slate');
  box(o, 65.99, 0, -30.22, 4.5, 5.15, 6.9, 'wall', 'plaster');
  box(o, 65.99, 5.15, -30.22, 4.7, 0.15, 7.1, 'slate', 'slate');
  if (d >= 1) {
    for (const [x, angle] of [
      [102.19, Math.PI / 2],
      [79.14, -Math.PI / 2],
    ]) {
      const q = local(o, x, -17.3, angle);
      framing(q, 45, 2.9, 2.7, d);
      for (let i = 0; i < 9; i++) window(q, -19 + i * 4.75, 3.25, 2.25, 1.6, d);
    }
    for (const [z, angle] of [
      [6.32, 0],
      [-40.86, Math.PI],
    ]) {
      const q = local(o, 90.68, z, angle);
      framing(q, 23, 2.9, 2.7, d);
      opening(q, 0, 0.12, 3.2, 4.6, d, true);
      for (const x of [-6, -3, 0, 3, 6]) opening(q, x, 6.05, 1.7, 1.45, d);
    }
    for (const z of [-23, -9, 5]) box(o, 74.2, 5.2, z, 3.0, 0.42, 4.5, 'glass', 'glass');
  }
  // Small rounded turret at the annex end is mapped separately within the same ring.
  const turret = p.slice(9, 19);
  ring(o, turret, 5.15, 7.6);
  cap(o, turret, 7.6, 'slate', 'slate');
}
export function buildKsiazStable(o, key = 'ksiaz_stable_ensemble', level = 'closeup') {
  if (key !== 'ksiaz_stable_ensemble') throw Error(`Unknown stable ensemble ${key}`);
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level];
  if (d === undefined) throw Error(`Unknown runtime level ${level}`);
  const loop = frame.geometry.outline.slice(0, -1);
  cap(o, loop, 0, 'stone', 'rubble', [0, -1, 0]);
  stableWalls(o, loop);
  // Four original roof ranges. Roofs are not a solid rectangle over the courtyard.
  const stableIV = local(o, 6.5, -56.65, Math.PI / 2);
  hip(stableIV, 0, 0, 14.8, 105.7, 6.65, 11.35);
  hip(o, -57.2, 13.8, 15.3, 44, 6.65, 11.4);
  hip(o, -57.2, -33.8, 15.3, 33.5, 6.65, 11.4);
  const stableI = local(cornerRoof(o), 3, 53.35, Math.PI / 2);
  hip(stableI, 0, 0, 14.3, 107, 10.4, 15.8);
  hip(o, 56.6, 28.6, 16.2, 67.2, 10.4, 15.8);
  hip(o, 56.6, -42.2, 16.2, 45.6, 6.65, 11.35);
  hip(o, 56.6, frame.controls.adminCenter[1], 16.2, 18.0, 8.5, 12.6);
  dormantGable(o, 48.92, frame.controls.adminCenter[1], -Math.PI / 2, 17.8, 8.5, 12.5, 14.5, 0);
  hip(o, -57.2, -10.4, 15.3, 12.5, 12.2, 17, 'slate', 'slate');
  // The tower's rectangular upper storeys bridge the joined lower ranges.
  // Ground traces alone cannot supply these facade planes; omitting them leaves floating framing.
  box(o, -57.0, 6.65, -56.1, 17.3, 6.65, 16, 'wall', 'plaster');
  mansard(o, -57.0, -56.1, 18.1, 16.8, d);
  // Primary-photo gables and porch projections survive even the silhouette level.
  for (const [x, z, angle, w, base, top, depth] of [
    [-23.8, 43.7, Math.PI, 4.5, 4.75, 6.4, 3.4],
    [5.9, 43.7, Math.PI, 4.5, 4.75, 6.4, 3.4],
    [-51.6, 23, Math.PI / 2, 5.3, 6.9, 10.4, 8.7],
    [-50.2, -23, Math.PI / 2, 4.2, 7.5, 10.1, 5.9],
    [-50.2, -41, Math.PI / 2, 4.2, 7.5, 10.1, 5.9],
  ])
    dormantGable(o, x, z, angle, w, base, top, depth, d);
  for (const x of [-16.74, -2.05, 11.2]) dormantGable(o, x, 63.78, 0, 5.2, 11.2, 14.15, 4.5, d);
  for (const x of [-23.8, 5.9])
    panel(local(o, x, 46.9, Math.PI), 0, 4.75, 0, 4.5, 5.65, 'wall', 'plaster');
  residence(o, d);
  const barRing = frame.geometry.outline.slice(32, 38);
  ring(o, barRing, 0, 6.7);
  cap(o, barRing, 6.75, 'slate', 'slate');
  mainFacades(o, d);
  ridingHall(o, d);
  for (const [x, z, h] of [
    [-56.9, -51.3, 18],
    [-8, 53.35, 15.6],
    [19, 53.35, 15.6],
    [56.6, 20, 15.4],
    [56.6, -45, 11.0],
  ])
    box(o, x, h, z, 0.78, 1.6, 0.7, 'stone', 'stone');
}
export function buildKsiazStableSkyline(o, key) {
  buildKsiazStable(
    {
      addTriangle: (s, r, p, n, uv, col) =>
        o.addTriangle(
          'silhouette',
          r,
          p,
          n,
          uv,
          col.map((v, i) => v * (means[s]?.[i] ?? 1)),
        ),
    },
    key,
    'skyline',
  );
}
