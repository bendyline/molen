/** Paddington's four train sheds, ironwork, concourse and curved platform approaches. */
import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.91 },
  stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.88 },
  deck: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.22 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.88, doubleSided: true },
  glass: {
    slot: 'window',
    graph: 'window_grid',
    roughness: 0.37,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.64],
    doubleSided: true,
  },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.89 },
};
const colors = {
  brick: [0.53, 0.38, 0.275],
  sandstone: [0.68, 0.61, 0.49],
  platform: [0.5, 0.48, 0.42],
  paving: [0.61, 0.59, 0.53],
  ballast: [0.19, 0.16, 0.13],
  iron: [0.2, 0.31, 0.28],
  ironLight: [0.43, 0.57, 0.52],
  zinc: [0.5, 0.52, 0.48],
  edge: [0.79, 0.75, 0.6],
  rail: [0.36, 0.36, 0.34],
  timber: [0.26, 0.2, 0.145],
  slate: [0.37, 0.4, 0.385],
  roofMetal: [0.54, 0.56, 0.53],
  glass: [0.46, 0.49, 0.415],
  door: [0.144, 0.221, 0.217],
  buffer: [0.55, 0.19, 0.1],
};
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const ref = 'palette:#ffffff',
  up = [0, 1, 0],
  mix = (a, b, t) => a + (b - a) * t;
const at = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
const rod = (out, slot, tone, a, b, w, d = w) => beam(out, slot, a, b, w, d, colors[tone]);
function face(out, slot, tone, p, n) {
  let normal = normalFor(...p);
  if (n && normal.reduce((v, c, i) => v + c * n[i], 0) < 0) {
    p = p.toReversed();
    normal = normalFor(...p);
  }
  if (Math.hypot(...normal) < 0.5) return;
  if (p.length === 4) out.addQuad(slot, ref, p, normal, undefined, colors[tone]);
  else out.addTriangle(slot, ref, p, normal, undefined, colors[tone]);
}
function flat(out, slot, tone, ring, levels) {
  const idx = earcut(ring.flat());
  for (let i = 0; i < idx.length; i += 3)
    face(
      out,
      slot,
      tone,
      idx.slice(i, i + 3).map((j) => [ring[j][0], levels[j], ring[j][1]]),
      up,
    );
}
function planarStrip(out, slot, tone, a, b, w, axis, normal) {
  const off = (p, n) => p.map((v, i) => v + w * 0.5 * n * axis[i]);
  face(out, slot, tone, [off(a, -1), off(b, -1), off(b, 1), off(a, 1)], normal);
}
function platform(out, { ring, levels }, tier) {
  flat(out, 'deck', 'platform', ring, levels);
  for (let i = 0; tier > 0 && i < ring.length; i++) {
    const j = (i + 1) % ring.length,
      [x, z] = ring[i],
      [u, v] = ring[j],
      a = [x, levels[i], z],
      b = [u, levels[j], v];
    if (Math.hypot(x - u, z - v) < 0.02) continue;
    const n = [v - z, 0, x - u];
    face(out, 'deck', 'sandstone', [a, [x, levels[i] - 0.98, z], [u, levels[j] - 0.98, v], b], n);
    if (tier >= 2) {
      const length = Math.hypot(x - u, z - v),
        ix = ((z - v) / length) * 0.2,
        iz = ((u - x) / length) * 0.2;
      face(
        out,
        'stone',
        'edge',
        [
          [x, a[1] + 0.015, z],
          [u, b[1] + 0.015, v],
          [u + ix, b[1] + 0.015, v + iz],
          [x + ix, a[1] + 0.015, z + iz],
        ],
        up,
      );
    }
  }
}
function tracks(out, points, tier) {
  if (!tier) return;
  const stride = [0, 9, 5, 3, 2][tier],
    chosen = points.filter((_, i) => i % stride === 0 || i === points.length - 1);
  const offset = (p, z, y = 0) => [p[0], p[1] + y, p[2] + z];
  for (let i = 1; i < chosen.length; i++) {
    const a = chosen[i - 1],
      b = chosen[i];
    face(
      out,
      'deck',
      'ballast',
      [
        offset(a, -1.15, -0.11),
        offset(b, -1.15, -0.11),
        offset(b, 1.15, -0.11),
        offset(a, 1.15, -0.11),
      ],
      up,
    );
    if (tier === 1) continue;
    for (const z of [-0.718, 0.718]) {
      const left = offset(a, z, 0.05),
        right = offset(b, z, 0.05);
      planarStrip(out, 'iron', 'rail', left, right, tier === 2 ? 0.14 : 0.086, [0, 0, 1], up);
      if (tier >= 3)
        face(
          out,
          'iron',
          'rail',
          [left, right, offset(b, z, -0.09), offset(a, z, -0.09)],
          [0, 0, 1],
        );
    }
    if (tier < 3) continue;
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / (tier === 4 ? 0.69 : 1.28));
    for (let j = 0; j < n; j++) {
      const q = at(a, b, (j + 0.5) / n),
        [x, y, z] = q;
      face(
        out,
        'wood',
        'timber',
        [
          [x - 0.12, y - 0.065, z - 1.12],
          [x + 0.12, y - 0.065, z - 1.12],
          [x + 0.12, y - 0.065, z + 1.12],
          [x - 0.12, y - 0.065, z + 1.12],
        ],
        up,
      );
    }
  }
  const [x, y, z] = points.at(-1);
  if (tier >= 2)
    rod(out, 'iron', 'buffer', [x, y + 0.9, z - 0.89], [x, y + 0.9, z + 0.89], 0.22, 0.28);
  if (tier >= 3)
    for (const side of [-1, 1])
      rod(out, 'iron', 'iron', [x - 1.3, y, z + side * 0.73], [x, y + 0.9, z + side * 0.73], 0.18);
}
function canopy(out, row, tier) {
  for (let i = 1; i < row.length; i++) {
    const a = row[i - 1],
      b = row[i],
      roof = (p, s) => [p.x, p.floor + 4.24 + (s === 0 ? 0.52 : 0), p.z + (s * p.width) / 2];
    for (const s of [-1, 1]) {
      const p = roof(a, s),
        q = roof(b, s);
      const skin = [p, q, roof(b, 0), roof(a, 0)];
      face(out, 'slate', 'roofMetal', skin, up);
      if (tier)
        face(
          out,
          'slate',
          'slate',
          skin.map(([x, y, z]) => [x, y - 0.095, z]),
          [0, -1, 0],
        );
      if (tier >= 2) {
        face(
          out,
          'iron',
          'ironLight',
          [p, q, [q[0], q[1] - 0.26, q[2]], [p[0], p[1] - 0.26, p[2]]],
          [0, 0, s],
        );
        if (tier >= 3)
          planarStrip(out, 'iron', 'zinc', roof(a, 0), roof(b, 0), 0.115, [0, 0, 1], up);
      }
    }
  }
  if (!tier) return;
  const stride = tier === 1 ? 3 : 1;
  for (const [i, p] of row.entries()) {
    if (i % stride && i !== row.length - 1) continue;
    rod(
      out,
      'iron',
      'ironLight',
      [p.x, p.floor - 0.29, p.z],
      [p.x, p.floor + 4.61, p.z],
      tier === 1 ? 0.35 : 0.24,
    );
    if (tier < 2) continue;
    for (const s of [-1, 1])
      rod(
        out,
        'iron',
        'ironLight',
        [p.x, p.floor + 3.26, p.z],
        [p.x, p.floor + 4.2, p.z + s * p.width * 0.42],
        0.15,
      );
  }
}
function vaultProfile(b, t) {
  const z = mix(b.z0, b.z1, (1 - Math.cos(Math.PI * t)) * 0.5);
  return [b.eave + b.rise * Math.sin(Math.PI * t), z];
}
function vaultPoint(b, x, t, raise = 0) {
  const [y, z] = vaultProfile(b, t);
  return [x, y + raise, z];
}
function rib(out, b, x, div, tier, y = 0) {
  const profile = Array.from({ length: div + 1 }, (_, i) => vaultPoint(b, x, i / div, y));
  for (let i = 1; i < profile.length; i++) {
    if (tier >= 3) rod(out, 'iron', 'ironLight', profile[i - 1], profile[i], 0.17, 0.13);
    else
      planarStrip(
        out,
        'iron',
        'ironLight',
        profile[i - 1],
        profile[i],
        tier === 1 ? 0.31 : 0.18,
        [1, 0, 0],
      );
  }
}
function endGlazing(out, b, x, div, tier, direction) {
  const lower = b.eave - 0.96,
    normal = [direction, 0, 0],
    n = tier <= 1 ? 4 : div;
  for (let i = 0; i < n; i++) {
    const a = vaultPoint(b, x, i / n, -0.06),
      p = vaultPoint(b, x, (i + 1) / n, -0.06);
    const panes = [[x, lower, a[2]], [x, lower, p[2]], p, a];
    face(out, tier === 0 ? 'slate' : 'glass', 'glass', panes, normal);
    if (tier >= 2)
      face(
        out,
        'glass',
        'glass',
        panes.map(([x, y, z]) => [x - 0.1 * direction, y, z]),
        [-direction, 0, 0],
      );
  }
  if (!tier) return;
  rib(out, b, x + direction * 0.065, div, tier, 0.02);
  for (const height of [lower, lower + 2.1, lower + 4.6]) {
    const w = (b.z1 - b.z0) / 2,
      t = Math.min(0.99, Math.max(0, (height - b.eave) / b.rise));
    const reach = w * Math.sqrt(1 - t * t),
      mid = (b.z0 + b.z1) * 0.5;
    rod(
      out,
      'iron',
      'iron',
      [x + direction * 0.1, height, mid - reach],
      [x + direction * 0.1, height, mid + reach],
      tier === 1 ? 0.24 : 0.15,
      0.2,
    );
  }
  if (tier < 2) return;
  const count = Math.ceil((b.z1 - b.z0) / (tier === 4 ? 0.71 : tier === 3 ? 1.37 : 2.3));
  for (let i = 1; i < count; i++) {
    const u = i / count,
      z = mix(b.z0, b.z1, u),
      xFace = x + direction * 0.085,
      top = b.eave + b.rise * Math.sqrt(1 - Math.pow(2 * u - 1, 2));
    const w = tier === 4 ? 0.09 : 0.11;
    face(
      out,
      'iron',
      'ironLight',
      [
        [xFace, lower, z - w],
        [xFace, lower, z + w],
        [xFace, top - 0.06, z + w],
        [xFace, top - 0.06, z - w],
      ],
      normal,
    );
  }
}
function vault(out, b, tier, index) {
  const div = [6, 10, 14, 22, 36][tier],
    n = [0, 5, 9, 15, 24][tier];
  for (let i = 0; i < div; i++) {
    const a = i / div,
      v = (i + 1) / div,
      s = (a + v) / 2;
    const glazed = s > 0.22 && s < 0.78 && i % Math.max(3, Math.floor(div / 5)) !== 0;
    const slot = glazed && tier ? 'glass' : 'slate',
      tone = glazed ? 'zinc' : 'slate';
    const skin = (raise) => [
      vaultPoint(b, b.x0, a, raise),
      vaultPoint(b, b.x1, a, raise),
      vaultPoint(b, b.x1, v, raise),
      vaultPoint(b, b.x0, v, raise),
    ];
    face(out, slot, tone, skin(0), up);
    face(out, slot, glazed ? 'glass' : 'slate', skin(-0.12), [0, -1, 0]);
    if (tier >= 2 && i % 2 === 0) {
      const p = vaultPoint(b, b.x0, a, 0.095),
        q = vaultPoint(b, b.x1, a, 0.095);
      planarStrip(out, 'iron', 'zinc', p, q, 0.15, [0, 0, 1], up);
    }
  }
  endGlazing(out, b, b.x0, div, tier, -1);
  if (tier >= 2) endGlazing(out, b, b.x1, div, tier, 1);
  if (!tier) return;
  for (let j = 1; j < n; j++) {
    const x = mix(b.x0, b.x1, j / n);
    rib(out, b, x, div, tier, -0.34);
    if (tier >= 3 && j % 2 === 1) {
      const [x0, y, z] = vaultPoint(b, x, 0.5, -0.42);
      const left = [x0, b.eave - 0.38, b.z0 + 0.27],
        right = [x0, b.eave - 0.38, b.z1 - 0.27],
        peak = [x0, y, z];
      rod(out, 'iron', 'iron', left, right, 0.125, 0.17);
      for (const u of [0.25, 0.5, 0.75]) {
        const a = at(left, right, u),
          p = vaultPoint(b, x, u, -0.44);
        rod(out, 'iron', 'iron', a, p, 0.085);
        if (tier === 4) rod(out, 'iron', 'iron', at(left, right, Math.min(1, u + 0.16)), p, 0.075);
      }
      if (tier === 4) rod(out, 'iron', 'iron', [x0, b.eave - 0.38, z], peak, 0.08);
    }
  }
  for (const x of index < 3 ? layout.transverseRoofs : []) {
    const w = 3.05;
    for (let i = 0; i < div; i++) {
      const a = i / div,
        v = (i + 1) / div;
      face(
        out,
        'slate',
        'roofMetal',
        [
          vaultPoint(b, x - w, a, 0.17),
          vaultPoint(b, x + w, a, 0.17),
          vaultPoint(b, x + w, v, 0.17),
          vaultPoint(b, x - w, v, 0.17),
        ],
        up,
      );
      if (tier >= 2)
        face(
          out,
          'glass',
          'glass',
          [
            vaultPoint(b, x - 2.03, a, 0.28),
            vaultPoint(b, x + 2.03, a, 0.28),
            vaultPoint(b, x + 2.03, v, 0.28),
            vaultPoint(b, x - 2.03, v, 0.28),
          ],
          up,
        );
    }
  }
  for (const z of [b.z0, b.z1])
    if (index === 0 || z === b.z1)
      rod(out, 'iron', 'zinc', [b.x0, b.eave - 0.25, z], [b.x1, b.eave - 0.25, z], 0.32, 0.36);
}
function support(out, { x, z, springZ, base }, tier) {
  const top = 7.53,
    paint = tier >= 3 ? 'ironLight' : 'iron',
    w = tier === 1 ? 0.49 : 0.34;
  rod(out, 'iron', paint, [x, base, z], [x, top, z], w);
  if (tier < 2) return;
  rod(out, 'stone', 'sandstone', [x, base, z], [x, base + 0.37, z], 0.6);
  rod(out, 'iron', 'iron', [x, top - 0.39, z], [x, top - 0.14, z], 0.62);
  if (Math.abs(z - springZ) > 0.15)
    rod(out, 'iron', 'iron', [x, top - 0.63, z], [x, top + 0.01, springZ], 0.39);
  if (tier >= 3)
    for (const side of [-1, 1])
      rod(out, 'iron', 'iron', [x, top - 1.21, z], [x + side * 1.28, top - 0.26, z], 0.19);
}
function sidewall(out, z, bases, tier) {
  const n = [0, 0, Math.sign(z)],
    top = 7.6,
    step = 13,
    count = bases.length - 1;
  const start = -70;
  for (let i = 0; i < count; i++) {
    const x = start + i * step,
      q = x + step;
    face(
      out,
      'brick',
      'brick',
      [
        [x, bases[i], z],
        [q, bases[i + 1], z],
        [q, top, z],
        [x, top, z],
      ],
      n,
    );
    if (tier === 0) continue;
    face(
      out,
      'stone',
      'sandstone',
      [
        [x, top - 0.68, z + 0.055 * n[2]],
        [q, top - 0.68, z + 0.055 * n[2]],
        [q, top - 0.34, z + 0.055 * n[2]],
        [x, top - 0.34, z + 0.055 * n[2]],
      ],
      n,
    );
    const windows = tier >= 2 ? 3 : 1;
    for (let j = 0; j < windows; j++) {
      const mid = x + (step * (j + 1)) / (windows + 1),
        w = tier === 1 ? 1.6 : 1.12,
        near = z + n[2] * 0.089;
      face(
        out,
        'iron',
        'door',
        [
          [mid - w, 3.26, near],
          [mid + w, 3.26, near],
          [mid + w, 5.95, near],
          [mid - w, 5.95, near],
        ],
        n,
      );
      if (tier < 3) continue;
      face(
        out,
        'glass',
        'glass',
        [
          [mid - w + 0.1, 3.38, near + n[2] * 0.02],
          [mid + w - 0.1, 3.38, near + n[2] * 0.02],
          [mid + w - 0.1, 5.83, near + n[2] * 0.02],
          [mid - w + 0.1, 5.83, near + n[2] * 0.02],
        ],
        n,
      );
      rod(
        out,
        'stone',
        'sandstone',
        [mid - w - 0.21, 3.18, near],
        [mid + w + 0.21, 3.18, near],
        0.24,
        0.21,
      );
    }
  }
}
function hall(out, { ring, base, top }, tier, kind) {
  flat(
    out,
    'slate',
    'slate',
    ring,
    ring.map(() => top),
  );
  if (kind === 'concourse')
    flat(
      out,
      'deck',
      'paving',
      ring,
      ring.map(() => 0.72),
    );
  const signed =
    ring.reduce((sum, p, i) => {
      const [x, z] = ring[(i + 1) % ring.length];
      return sum + p[0] * z - x * p[1];
    }, 0) > 0
      ? 1
      : -1;
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length,
      [x, z] = ring[i],
      [u, v] = ring[j],
      len = Math.hypot(x - u, z - v);
    if (len < 0.17) continue;
    const n = [(signed * (v - z)) / len, 0, (signed * (x - u)) / len];
    const p = (t, y, d = 0) => [mix(x, u, t) + n[0] * d, y, mix(z, v, t) + n[2] * d];
    if (kind === 'concourse' && x <= 123.51 && u <= 123.51) {
      face(out, 'iron', 'iron', [p(0, top - 0.8), p(1, top - 0.8), p(1, top), p(0, top)], n);
      if (tier)
        for (let k = 1; k < Math.ceil(len / 8); k++)
          rod(
            out,
            'iron',
            'ironLight',
            p(k / Math.ceil(len / 8), 0.54),
            p(k / Math.ceil(len / 8), top),
            0.33,
          );
      continue;
    }
    face(out, 'brick', 'brick', [p(0, base[i]), p(1, base[j]), p(1, top), p(0, top)], n);
    if (!tier) continue;
    face(
      out,
      'stone',
      'sandstone',
      [p(0, top - 0.7, 0.1), p(1, top - 0.7, 0.1), p(1, top - 0.31, 0.1), p(0, top - 0.31, 0.1)],
      n,
    );
    const nBays = Math.floor(len / (tier === 1 ? 6.1 : 4.3));
    for (let k = 0; k < nBays; k++) {
      const a = (k + 0.19) / nBays,
        b = (k + 0.8) / nBays,
        bottom = kind === 'concourse' ? 3.3 : 2.37,
        head = top - 1.09;
      face(
        out,
        'iron',
        'door',
        [p(a, bottom, 0.11), p(b, bottom, 0.11), p(b, head, 0.11), p(a, head, 0.11)],
        n,
      );
      if (tier < 2) continue;
      face(
        out,
        'glass',
        'glass',
        [
          p(a + 0.014, bottom + 0.1, 0.13),
          p(b - 0.014, bottom + 0.1, 0.13),
          p(b - 0.014, head - 0.08, 0.13),
          p(a + 0.014, head - 0.08, 0.13),
        ],
        n,
      );
      if (tier >= 3)
        rod(
          out,
          'stone',
          'sandstone',
          p(a, bottom - 0.08, 0.15),
          p(b, bottom - 0.08, 0.15),
          0.21,
          0.18,
        );
    }
  }
}
export function buildPaddingtonLevel(out, level) {
  const tier = tiers[level];
  if (tier === undefined) throw Error(`Unknown Paddington tier ${level}`);
  for (const p of layout.platforms) platform(out, p, tier);
  for (const row of layout.canopyRows) canopy(out, row, tier);
  for (const t of layout.tracks) tracks(out, t, tier);
  flat(
    out,
    'deck',
    'paving',
    layout.headPaving,
    layout.headPaving.map(() => 0.72),
  );
  for (const [i, bay] of layout.bays.entries()) vault(out, bay, tier, i);
  layout.supports.forEach((s, i) => {
    if (tier && (tier > 1 || i % 2 === 0)) support(out, s, tier);
  });
  for (const [z, base] of Object.entries(layout.sidewallFootings))
    sidewall(out, Number(z), base, tier);
  for (const kind of ['services', 'annex', 'concourse'])
    for (const h of layout[kind]) hall(out, h, tier, kind);
}
export const buildPaddingtonSkyline = (out) => buildPaddingtonLevel(out, 'skyline');
export const buildPaddingtonDistrict = (out) => buildPaddingtonLevel(out, 'district');
export const buildPaddingtonStreet = (out) => buildPaddingtonLevel(out, 'street');
export const buildPaddingtonCloseup = (out) => buildPaddingtonLevel(out, 'closeup');
