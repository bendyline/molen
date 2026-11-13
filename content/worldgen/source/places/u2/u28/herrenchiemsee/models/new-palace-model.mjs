/** Standing New Palace at Herrenchiemsee, its garden front and open east court. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  wall: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.91 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.89 },
  floor: { slot: 'foundation', graph: 'stone_granite', roughness: 0.96 },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.94 },
  metal: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.75, metallic: 0.24 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.46 },
  gravel: { slot: 'foundation', graph: 'gravel', roughness: 0.96 },
};
const palette = {
  // biome-ignore lint/suspicious/noApproximativeNumericConstant: Authored linear RGB channel.
  wall: [0.749, 0.693, 0.573],
  court: [0.78, 0.721, 0.607],
  foundation: [0.519, 0.48, 0.401],
  pale: [0.848, 0.79, 0.68],
  trim: [0.768, 0.703, 0.587],
  carving: [0.671, 0.601, 0.487],
  rustic: [0.669, 0.61, 0.516],
  gravel: [0.471, 0.471, 0.437],
  metal: [0.268, 0.272, 0.236],
  pane: [0.165, 0.185, 0.186],
  warm: [0.235, 0.212, 0.148],
  gold: [0.683, 0.47, 0.173],
  clock: [0.167, 0.228, 0.282],
  paving: [0.644, 0.6, 0.515],
  pavingDark: [0.529, 0.495, 0.433],
  courtGravel: [0.72, 0.678, 0.594],
};
const ref = 'palette:#ffffff',
  up = [0, 1, 0],
  mix = (a, b, t) => a + (b - a) * t;
const ranks = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const rect = (x, z, w, d) => [
  [x - w / 2, z - d / 2],
  [x + w / 2, z - d / 2],
  [x + w / 2, z + d / 2],
  [x - w / 2, z + d / 2],
];
function face(out, slot, tone, points, n) {
  points = points.map((p) => p.map(Math.fround));
  let normal = normalFor(...points);
  if (Math.hypot(...normal) < 0.1) return;
  if (n && normal.reduce((v, x, i) => v + x * n[i], 0) < 0) {
    points = points.toReversed();
    normal = normalFor(...points);
  }
  if (points.length === 3) out.addTriangle(slot, ref, points, normal, undefined, palette[tone]);
  else out.addQuad(slot, ref, points, normal, undefined, palette[tone]);
}
function slab(out, slot, tone, ring, y) {
  const indices = earcut(ring.flat());
  for (let i = 0; i < indices.length; i += 3)
    face(
      out,
      slot,
      tone,
      indices.slice(i, i + 3).map((j) => [ring[j][0], y, ring[j][1]]),
      up,
    );
}
function box(out, slot, tone, x, z, w, d, lo, hi) {
  loft(
    out,
    slot,
    [lo, hi].map((y) =>
      rect(x, z, w, d)
        .toReversed()
        .map(([a, b]) => [a, y, b]),
    ),
    palette[tone],
  );
}
function frame(a, b, n) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = Math.hypot(dx, dz),
    normal = n ?? [dz / l, -dx / l];
  return {
    l,
    n: [normal[0], 0, normal[1]],
    at: (u, y, d = 0) => [
      a[0] + (dx * u) / l + normal[0] * d,
      y,
      a[1] + (dz * u) / l + normal[1] * d,
    ],
  };
}
function panel(out, slot, tone, { at, n }, a, b, y, h, d = 0) {
  face(out, slot, tone, [at(a, y, d), at(b, y, d), at(b, y + h, d), at(a, y + h, d)], n);
}
function cornice(out, f, a, b, y, h, d, tier, tone = 'trim') {
  const { at } = f;
  panel(out, 'trim', tone, f, a, b, y, h, d);
  if (tier >= 2)
    face(
      out,
      'trim',
      'pale',
      [at(a, y + h, d), at(b, y + h, d), at(b, y + h, -0.03), at(a, y + h, -0.03)],
      up,
    );
  if (tier >= 3)
    face(
      out,
      'trim',
      'carving',
      [at(b, y, d), at(a, y, d), at(a, y, -0.03), at(b, y, -0.03)],
      [0, -1, 0],
    );
}
function urn(out, x, y, z, scale, tier) {
  const radii = [
    [0, 0.29],
    [0.24, 0.31],
    [0.3, 0.17],
    [0.46, 0.33],
    [0.68, 0.4],
    [0.93, 0.33],
    [1.0, 0.24],
    [1.14, 0.24],
    [1.23, 0.06],
  ];
  if (tier < 2) {
    box(out, 'trim', 'trim', x, z, 0.4 * scale, 0.39 * scale, y, y + scale * 1.23);
    return;
  }
  const rows = tier >= 3 ? radii : radii.filter((_, i) => i % 2 === 0);
  loft(
    out,
    'trim',
    rows.map(([h, r]) =>
      radialRing(y + h * scale, r * scale, r * scale, tier === 2 ? 6 : 8, [x, z]),
    ),
    palette.trim,
  );
}
function railing(out, f, a, b, y, d, tier) {
  cornice(out, f, a, b, y, 0.17, d + 0.055, tier, 'carving');
  cornice(out, f, a, b, y + 1.02, 0.18, d + 0.075, tier);
  if (!tier) {
    panel(out, 'trim', 'trim', f, a, b, y + 0.14, 0.9, d - 0.01);
    return;
  }
  const n = Math.max(1, Math.round((b - a) / (tier === 1 ? 1.27 : 0.63)));
  for (let i = 0; i <= n; i++) {
    const u = mix(a, b, i / n),
      end = i === 0 || i === n,
      pier = end || i % 6 === 0,
      w = pier ? 0.29 : 0.085;
    if (!pier && tier >= 3) {
      const { at } = f;
      const points = [
        at(u - w * 1.3, y + 0.17, d),
        at(u + w * 1.3, y + 0.17, d),
        at(u + w * 0.77, y + 0.63, d),
        at(u - w * 0.77, y + 0.63, d),
      ];
      face(out, 'trim', 'trim', points, f.n);
      face(
        out,
        'trim',
        'trim',
        [points[3], points[2], at(u + w * 1.13, y + 1.04, d), at(u - w * 1.13, y + 1.04, d)],
        f.n,
      );
    } else panel(out, 'trim', pier ? 'trim' : 'pale', f, u - w, u + w, y + 0.16, 0.88, d);
  }
}
function window(out, f, u, y, w, h, style, tier, d = 0) {
  const { at, n } = f,
    a = u - w / 2,
    b = u + w / 2,
    arch = style !== 'attic',
    spring = y + h * (arch ? 0.76 : 1),
    rise = y + h - spring;
  const slot = tier >= 2 ? 'glass' : 'metal',
    color = style === 'door' ? 'warm' : 'pane',
    edge = d + 0.14;
  if (tier >= 2)
    panel(out, 'trim', 'carving', f, a - 0.17, b + 0.17, y - 0.21, spring - y + 0.1, edge - 0.058);
  panel(out, slot, color, f, a, b, y, spring - y, edge);
  if (arch) {
    const steps = tier === 1 ? 2 : tier === 2 ? 4 : 8;
    const rim = (i, swell = 0, depth = edge) => {
      const t = (Math.PI * i) / steps;
      return at(u - Math.cos(t) * (w / 2 + swell), spring + Math.sin(t) * (rise + swell), depth);
    };
    for (let i = 0; i < steps; i++) {
      face(out, slot, color, [at(u, spring, edge), rim(i), rim(i + 1)], n);
      if (tier >= 2)
        face(
          out,
          'trim',
          'pale',
          [rim(i), rim(i + 1), rim(i + 1, 0.21, edge - 0.04), rim(i, 0.21, edge - 0.04)],
          n,
        );
      if (tier >= 3)
        face(
          out,
          'trim',
          'carving',
          [
            rim(i, 0.21, edge - 0.04),
            rim(i + 1, 0.21, edge - 0.04),
            rim(i + 1, 0.35, edge + 0.075),
            rim(i, 0.35, edge + 0.075),
          ],
          n,
        );
    }
    if (tier >= 3) {
      const top = spring + rise;
      panel(out, 'trim', 'pale', f, u - 0.19, u + 0.19, top + 0.19, 0.42, edge + 0.19);
      if (style === 'main')
        for (const sign of [-1, 1]) {
          const a = u + sign * 0.36,
            b = u + sign * 0.99;
          face(
            out,
            'trim',
            'carving',
            [
              at(a, top + 0.28, edge + 0.16),
              at(b, top + 0.18, edge + 0.13),
              at(b, top + 0.49, edge + 0.03),
              at(a, top + 0.63, edge + 0.12),
            ],
            n,
          );
        }
    }
  } else if (tier >= 2) cornice(out, f, a - 0.25, b + 0.25, y + h + 0.1, 0.23, edge + 0.12, 1);
  if (tier >= 2) {
    cornice(out, f, a - 0.22, b + 0.22, y - 0.15, 0.16, edge + 0.16, tier === 2 ? 0 : 1, 'pale');
    if (tier >= 3)
      panel(out, 'metal', 'metal', f, u - 0.036, u + 0.036, y, spring - y, edge + 0.019);
    if (tier >= 3 && style === 'main') {
      for (const t of [0.37, 0.62, 0.8])
        panel(out, 'metal', 'metal', f, a, b, y + h * t, 0.075, edge + 0.019);
      for (let i = 0; i < 5; i++) {
        const at = a + ((b - a) * (i + 0.5)) / 5;
        panel(out, 'trim', 'trim', f, at - 0.057, at + 0.057, y - 0.71, 0.53, edge + 0.18);
      }
    }
  }
}
function rustication(out, f, lo, hi, edge, d, tier) {
  if (tier < 3) return;
  for (let y = lo + 0.78; y < hi - 0.17; y += 0.69) {
    if (y > hi - 1.1 && edge) continue;
    panel(out, 'trim', 'rustic', f, 0, f.l, y, 0.052, d);
  }
}
function shell(out, tier) {
  const { eave, faces, outline } = layout;
  for (const s of faces) {
    const f = frame(s.a, s.b, s.n),
      { n, l } = f;
    const samples = tier
      ? s.samples
      : [s.samples[0], [...s.samples.at(-1).slice(0, 2), Math.min(...s.samples.map((p) => p[2]))]];
    for (let i = 1; i < samples.length; i++) {
      const [a, b] = [samples[i - 1], samples[i]],
        floor = tier ? a[2] : Math.min(...s.samples.map((p) => p[2]));
      face(
        out,
        'wall',
        s.court ? 'court' : 'wall',
        [
          [a[0], floor, a[1]],
          [b[0], b[2], b[1]],
          [b[0], eave, b[1]],
          [a[0], eave, a[1]],
        ],
        n,
      );
    }
    cornice(out, f, 0, l, eave - 0.52, 0.55, 0.34, tier, 'pale');
    railing(out, f, 0.015, l - 0.015, eave + 0.06, 0.25, tier);
    if (!tier || !s.bays) continue;
    cornice(out, f, 0, l, 6.83, 0.56, 0.41, tier, 'pale');
    cornice(out, f, 0, l, 14.22, 0.48, 0.39, tier, 'pale');
    for (let j = 0; j < s.bays; j++) {
      const t = (j + 0.5) / s.bays,
        u = l * t,
        cell = l / s.bays,
        index = t * (s.samples.length - 1),
        left = Math.floor(index);
      const ground = mix(s.samples[left][2], s.samples[left + 1][2], index - left) + 1.18;
      const main = s.centerCourt && j >= 3 && j <= 5;
      const gardenCenter = s.garden && j >= 10 && j <= 14,
        projected = gardenCenter ? 0.55 : 0;
      const low = Math.max(s.court ? 3.83 : s.garden ? 1.58 : 0.64, ground + 0.2),
        width = Math.min(cell * 0.57, 2.58);
      if (!main && low < 5.9) window(out, f, u, low, width, 6.56 - low, 'door', tier, projected);
      window(out, f, u, 7.62, width * 1.08, 5.81, 'main', tier, projected);
      if (tier >= 2 || j % 2 === 0)
        window(out, f, u, 15.11, width * 0.75, 2.94, 'attic', tier, projected);
      if (tier >= 2 && j > 0) {
        const p = (l * j) / s.bays;
        cornice(out, f, p - 0.22, p + 0.22, 7.32, 6.97, s.garden ? 0.24 : 0.16, 1);
        if (tier >= 3 && s.garden)
          cornice(out, f, p - 0.39, p + 0.39, 13.79, 0.46, 0.36, 2, 'pale');
      }
    }
    rustication(
      out,
      f,
      Math.max(0.2, ...s.samples.map((p) => p[2] + 1.18)),
      6.65,
      s.garden,
      0.049,
      tier,
    );
    if (tier >= 2)
      for (const u of [Math.min(0.32, l / 4), Math.max(l - 0.32, l * 0.75)]) {
        cornice(out, f, u - 0.24, u + 0.24, 7.45, 10.85, 0.24, tier, 'trim');
      }
  }
  slab(out, 'roof', 'gravel', outline, eave);
}
function terraces(out, tier) {
  for (const [name, t] of [
    ['court', layout.court],
    ['garden', layout.garden],
  ]) {
    const n = name === 'court' ? [2, 3, 5, 6, 7][tier] : [2, 3, 5, 7, 8][tier],
      step = (t.head - t.toe) / n;
    const lo = Math.min(...t.samples.map((p) => p[1])) - 2.5;
    box(out, 'floor', 'paving', t.x, (t.z0 + t.head) / 2, t.w, Math.abs(t.z0 - t.head), lo, t.y);
    for (let k = 0; k < n; k++) {
      const z = t.toe + k * step,
        next = z + step;
      for (let j = 1; j < t.samples.length; j++) {
        const a = t.samples[j - 1],
          b = t.samples[j],
          p = (r, i, z) => [r[0], i < 0 ? lo : mix(r[1], t.y, i / (n - 1)), z];
        face(out, 'floor', 'paving', [p(a, k, z), p(b, k, z), p(b, k, next), p(a, k, next)], up);
        face(
          out,
          'floor',
          'pavingDark',
          [p(a, k - 1, z), p(b, k - 1, z), p(b, k, z), p(a, k, z)],
          [0, 0, Math.sign(-step)],
        );
        if (j === 1)
          face(
            out,
            'floor',
            'pavingDark',
            [p(a, -1, z), p(a, -1, next), p(a, k, next), p(a, k, z)],
            [-1, 0, 0],
          );
        if (j === t.samples.length - 1)
          face(
            out,
            'floor',
            'pavingDark',
            [p(b, -1, z), p(b, -1, next), p(b, k, next), p(b, k, z)],
            [1, 0, 0],
          );
      }
    }
    if (tier >= 2 && name === 'court')
      for (let j = 0; j < 16; j++) {
        const x = t.x - t.w / 2 + ((j + 0.5) * t.w) / 16;
        slab(
          out,
          'floor',
          'pavingDark',
          rect(x, (t.z0 + t.head) / 2, t.w / 37, Math.abs(t.z0 - t.head) - 0.12),
          t.y + 0.008,
        );
      }
  }
  for (const patch of layout.gravel) {
    const indices = earcut(patch.flatMap(([x, , z]) => [x, z]));
    for (let i = 0; i < indices.length; i += 3)
      face(
        out,
        'gravel',
        'courtGravel',
        indices.slice(i, i + 3).map((j) => patch[j]),
        up,
      );
  }
}
function column(out, x, z, lo, hi, r, tier) {
  if (tier <= 1) {
    box(out, 'trim', 'trim', x, z, r * 1.4, r * 1.4, lo, hi);
    return;
  }
  const n = tier === 2 ? 6 : 10;
  const rows = [
    [lo, r * 1.5],
    [lo + 0.22, r * 1.45],
    [lo + 0.31, r],
    [hi - 0.38, r * 0.83],
    [hi - 0.22, r * 1.38],
    [hi, r * 1.42],
  ];
  loft(
    out,
    'trim',
    rows.map(([y, a]) => radialRing(y, a, a, n, [x, z])),
    palette.pale,
  );
}
function gardenOrder(out, tier) {
  const z = -45.53,
    x = 0;
  box(out, 'wall', 'wall', x, z + 0.1, 20.53, 1.29, 1.33, 18.78);
  const f = frame([-12.35, z], [12.35, z]);
  for (const y of [6.79, 14.14, 18.2]) cornice(out, f, 0, f.l, y, 0.56, 0.97, tier, 'pale');
  if (tier)
    for (let i = 0; i < 6; i++) {
      const a = -10.95 + i * 4.38;
      column(out, a, z - 0.86, 7.13, 14.17, 0.42, tier);
    }
  if (tier >= 1)
    for (const a of [-44.1, -26.6, -8.66, 8.66, 26.6, 44.1]) {
      box(out, 'trim', 'trim', x + a, z - 0.27, 1.34, 0.93, 18.57, 20.05);
      urn(out, x + a, 20.04, z - 0.38, 1.24, tier);
    }
}
function clockCrest(out, tier) {
  const x = 0.1,
    z = -16.93,
    y = 20.39;
  const f = frame([x + 8.42, z], [x - 8.42, z]);
  box(out, 'trim', 'carving', x, z - 0.28, 16.6, 1.33, 18.64, 19.98);
  const disk = (radius, slot, tone, offset) => {
    const count = tier < 2 ? 8 : 22;
    const points = Array.from({ length: count }, (_, i) => {
      const a = (2 * Math.PI * i) / count;
      return [x + Math.sin(a) * radius, y + Math.cos(a) * radius, z + offset];
    });
    for (let i = 0; i < count; i++)
      face(out, slot, tone, [[x, y, z + offset], points[i], points[(i + 1) % count]], [0, 0, 1]);
  };
  disk(1.15, 'trim', 'pale', 0.25);
  disk(0.89, 'metal', 'clock', 0.29);
  if (tier >= 2) {
    for (let i = 0; i < 12; i++) {
      const a = (2 * Math.PI * i) / 12,
        s = Math.sin(a),
        c = Math.cos(a);
      beam(
        out,
        'metal',
        [x + s * 0.64, y + c * 0.64, z + 0.36],
        [x + s * 0.77, y + c * 0.77, z + 0.36],
        0.044,
        0.051,
        palette.gold,
      );
    }
    for (const [a, b] of [
      [0.34, 0.15],
      [-0.13, 0.54],
    ])
      beam(out, 'metal', [x, y, z + 0.38], [x + a, y + b, z + 0.38], 0.062, 0.045, palette.gold);
  }
  for (const sign of [-1, 1]) {
    const a = x + sign * 0.87;
    face(
      out,
      'trim',
      'pale',
      [
        [x, y + 0.77, z + 0.21],
        [a, y + 1.83, z + 0.23],
        [x + sign * 1.93, y + 2.38, z + 0.07],
        [a, y + 0.94, z + 0.36],
      ],
      [0, 0, 1],
    );
    if (tier >= 2) {
      for (const off of [2.0, 3.22, 6.48]) {
        const q = x + sign * off,
          t = off === 6.48 ? 1 : 0.68;
        sphere(
          out,
          'trim',
          [q, y + 0.48 * t, z + 0.14],
          [0.32 * t, 0.66 * t, 0.38 * t],
          palette.trim,
          6,
          5,
        );
        sphere(
          out,
          'trim',
          [q - sign * 0.08, y + 1.16 * t, z + 0.19],
          [0.19 * t, 0.24 * t, 0.19 * t],
          palette.pale,
          6,
          4,
        );
      }
      for (let j = 0; j < 6; j++) {
        const t = j / 6,
          u = f.l / 2 + sign * (1.09 + t * 3.16);
        cornice(
          out,
          f,
          u - 0.25,
          u + 0.31,
          y - 0.48 + t * 0.05,
          0.32 - t * 0.07,
          0.31,
          1,
          'carving',
        );
      }
    }
  }
  urn(out, x, 21.37, z + 0.13, 0.65, tier);
}
function courtFront(out, tier) {
  const x = 0.1,
    z = -17.43,
    deck = layout.court.y;
  const f = frame([x + 6.92, z + 0.08], [x - 6.92, z + 0.08]);
  for (const u of [f.l / 6, f.l / 2, (f.l * 5) / 6])
    if (tier) window(out, f, u, deck, 2.49, 2.78, 'door', tier);
  box(out, 'trim', 'trim', x, z + 0.85, 13.64, 1.98, 6.61, 7.26);
  if (tier) {
    for (const a of [-6.27, -5.52, -2.61, -1.86, 1.86, 2.61, 5.52, 6.27])
      column(out, x + a, z + 1.52, deck, 6.68, 0.228, tier);
    const rail = frame([x + 6.75, z + 1.88], [x - 6.75, z + 1.88]);
    railing(out, rail, 0, rail.l, 7.24, 0.035, tier);
    if (tier >= 2)
      for (let i = 0; i < 10; i++) {
        const u = (rail.l * (i + 0.5)) / 10;
        panel(out, 'metal', 'gold', rail, u - 0.1, u + 0.1, 7.43, 0.48, 0.16);
      }
  }
  clockCrest(out, tier);
}
function roofs(out, tier) {
  for (const [x, z, w, d] of layout.roof) {
    box(out, 'roof', 'gravel', x, z, w, d, 18.7, 18.92);
    if (tier >= 2)
      for (const sign of [-1, 1]) {
        box(
          out,
          'roof',
          'gravel',
          x + sign * w * 0.18,
          z,
          Math.min(7, w * 0.22),
          Math.min(10, d * 0.36),
          18.89,
          19.28,
        );
        if (tier >= 3)
          box(out, 'trim', 'carving', x + sign * w * 0.36, z + d * 0.22, 0.69, 0.84, 18.91, 19.65);
      }
  }
}
export function buildHerrenchiemseeLevel(out, level) {
  const tier = ranks[level];
  if (tier === undefined) throw Error(`Unknown Herrenchiemsee LOD ${level}`);
  shell(out, tier);
  roofs(out, tier);
  terraces(out, tier);
  gardenOrder(out, tier);
  courtFront(out, tier);
}
export const buildHerrenchiemseeSkyline = (out) => buildHerrenchiemseeLevel(out, 'skyline');
export const buildHerrenchiemseeDistrict = (out) => buildHerrenchiemseeLevel(out, 'district');
export const buildHerrenchiemseeStreet = (out) => buildHerrenchiemseeLevel(out, 'street');
export const buildHerrenchiemseeCloseup = (out) => buildHerrenchiemseeLevel(out, 'closeup');
