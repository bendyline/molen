/** Original glass footbridge exterior; signed map outline, source floor openings and shared surfaces. */
import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  box,
  tubePath,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { volodymyrDeckTriangles } from '../../../../../../../../packages/worldgen/scripts/volodymyr-deck-triangulation.mjs';

const data = JSON.parse(readFileSync(new URL('../alignment.json', import.meta.url)));
const linear = (hex) =>
  hex.match(/\w\w/g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const colors = {
  concrete: linear('d0cfc4'),
  steel: linear('9fa59e'),
  fascia: linear('c1c6c3'),
  mirror: linear('d3dbd9'),
  paving: linear('bdb39f'),
  glass: linear('b7d1d2'),
  cable: linear('c4ccca'),
  gasket: linear('555f5c'),
  paint: linear('e9e4d4'),
};
export const volodymyrSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.65, metallic: 0.35 },
  polished: { slot: 'trim', graph: 'metal_stainless_polished', roughness: 0.14, metallic: 1 },
  paving: { slot: 'foundation', graph: 'gravel', roughness: 0.98, metallic: 0 },
  glass: {
    slot: 'window',
    localRef: 'palette:#ffffff',
    roughness: 0.12,
    metallic: 0.05,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.24],
    doubleSided: true,
  },
  paint: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.9, metallic: 0 },
};
export const volodymyrControls = {
  originElevation: data.originElevation,
  columns: data.columns,
  outline: data.outline,
  spine: data.spine,
  glassGroups: data.glassGroups,
  deckProfile: data.deckProfile,
};
const cfgs = {
  skyline: {
    far: true,
    postStep: 0,
    railSides: 0,
    ribStep: 0,
    wires: 0,
    clamps: false,
    panelGrid: false,
  },
  district: { postStep: 16, railSides: 4, ribStep: 0, wires: 0, clamps: false, panelGrid: false },
  street: { postStep: 4, railSides: 6, ribStep: 8, wires: 0, clamps: false, panelGrid: false },
  closeup: { postStep: 1.8, railSides: 8, ribStep: 3, wires: 2, clamps: true, panelGrid: true },
  master: { postStep: 1.2, railSides: 16, ribStep: 1.8, wires: 5, clamps: true, panelGrid: true },
};
function interpolate(points, x) {
  const i = points.findIndex((p) => p[0] >= x);
  if (i <= 0) return points[i === 0 ? 0 : points.length - 1][1];
  const a = points[i - 1],
    b = points[i];
  return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
}
export const volodymyrDeckY = (x) => interpolate(data.deckProfile, x);
const spineZ = (x) => interpolate(data.spine, x);
const area = (ring) =>
  ring.reduce((s, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return s + p[0] * q[1] - q[0] * p[1];
  }, 0);
const cleanRing = (r) => {
  const ring = r.map((p) => [...p]);
  if (Math.hypot(ring[0][0] - ring.at(-1)[0], ring[0][1] - ring.at(-1)[1]) < 0.001) ring.pop();
  return ring;
};
function quad(out, slot, p, color) {
  out.addQuad(
    slot,
    'palette:#ffffff',
    p,
    normalFor(p[0], p[1], p[2]),
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    color,
  );
}
function horizontalSlab(out, slot, outer, holes, depth, color) {
  for (const t of volodymyrDeckTriangles(outer, holes)) {
    const p = t.map(([x, z]) => [x, volodymyrDeckY(x), z]);
    if (normalFor(...p)[1] < 0) [p[1], p[2]] = [p[2], p[1]];
    out.addTriangle(
      slot,
      'palette:#ffffff',
      p,
      normalFor(...p),
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      color,
    );
    const q = p.map((p) => [p[0], p[1] - depth, p[2]]).toReversed();
    out.addTriangle(
      slot,
      'palette:#ffffff',
      q,
      normalFor(...q),
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      color,
    );
  }
  for (const [r, hole] of [[outer, false], ...holes.map((r) => [r, true])]) {
    const ring = area(r) > 0 !== hole ? r : r.toReversed();
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      quad(
        out,
        slot,
        [
          [a[0], volodymyrDeckY(a[0]), a[1]],
          [b[0], volodymyrDeckY(b[0]), b[1]],
          [b[0], volodymyrDeckY(b[0]) - depth, b[1]],
          [a[0], volodymyrDeckY(a[0]) - depth, a[1]],
        ],
        color,
      );
    }
  }
}
function pane(out, slot, ring, color) {
  const p = ring.map(([x, z]) => [x, volodymyrDeckY(x) + 0.004, z]);
  if (normalFor(p[0], p[1], p[2])[1] < 0) p.reverse();
  quad(out, slot, p, color);
}
function bilinear(r, u, v) {
  return [0, 1].map(
    (k) => (1 - v) * ((1 - u) * r[0][k] + u * r[1][k]) + v * ((1 - u) * r[3][k] + u * r[2][k]),
  );
}
function floorWindows(cfg) {
  return data.glassGroups.flatMap((r) => {
    if (!cfg.panelGrid) return [r];
    const result = [];
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 2; j++) {
        const u0 = i / 3 + 0.006,
          u1 = (i + 1) / 3 - 0.006,
          v0 = j / 2 + 0.012,
          v1 = (j + 1) / 2 - 0.012;
        result.push([
          bilinear(r, u0, v0),
          bilinear(r, u1, v0),
          bilinear(r, u1, v1),
          bilinear(r, u0, v1),
        ]);
      }
    return result;
  });
}
function spine(out, slot, cfg) {
  for (let i = 1; i < data.spine.length; i++) {
    const a = data.spine[i - 1],
      b = data.spine[i];
    const ring = (p) => {
      const y = volodymyrDeckY(p[0]);
      return [
        [p[0], y - 0.22, p[1] - 1.15],
        [p[0], y - 0.22, p[1] + 1.15],
        [p[0], y - 2.15, p[1] + 0.75],
        [p[0], y - 2.15, p[1] - 0.75],
      ];
    };
    loft(out, slot, [ring(a), ring(b)], colors.steel);
  }
  if (!cfg.ribStep) return;
  for (let x = -96; x < 98; x += cfg.ribStep) {
    const hits = [];
    for (let i = 0; i < data.outline.length - 1; i++) {
      const a = data.outline[i],
        b = data.outline[i + 1];
      if ((a[0] <= x && b[0] > x) || (b[0] <= x && a[0] > x))
        hits.push(a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]));
    }
    hits.sort((a, b) => a - b);
    if (hits.length < 2) continue;
    const y = volodymyrDeckY(x),
      z = spineZ(x);
    for (const end of [hits[0] + 0.12, hits.at(-1) - 0.12]) {
      // Tapered transverse cantilever rib from the box spine toward the edge.
      const za = end < z ? z - 1.05 : z + 1.05;
      const points = [
        [x - 0.08, y - 1.7, za],
        [x + 0.08, y - 1.7, za],
        [x + 0.08, y - 0.25, za],
        [x - 0.08, y - 0.25, za],
      ];
      const outer = [
        [x - 0.08, y - 0.48, end],
        [x + 0.08, y - 0.48, end],
        [x + 0.08, y - 0.25, end],
        [x - 0.08, y - 0.25, end],
      ];
      loft(
        out,
        slot,
        end < za ? [points.toReversed(), outer.toReversed()] : [points, outer],
        colors.steel,
      );
    }
  }
}
function supports(out, S, cfg) {
  for (const p of volodymyrControls.columns) {
    const y = volodymyrDeckY(p.x) - 2.15;
    box(
      out,
      S('concrete'),
      [p.x - 0.8, Math.max(0, p.ground - 0.6), p.z - 0.75],
      [p.x + 0.8, y, p.z + 0.75],
      colors.concrete,
    );
    if (!cfg.far) {
      // Shallow mirror cladding with pale corner strips, not a transparent column.
      for (const z of [-0.77, 0.77])
        box(
          out,
          'polished',
          [p.x - 0.52, p.ground + 1.5, p.z + z - 0.018],
          [p.x + 0.52, y - 0.05, p.z + z + 0.018],
          colors.mirror,
        );
      if (cfg.clamps)
        for (let h = p.ground + 3; h < y; h += 3) {
          for (const z of [-0.8, 0.8])
            box(
              out,
              'steel',
              [p.x - 0.54, h, p.z + z - 0.012],
              [p.x + 0.54, h + 0.025, p.z + z + 0.012],
              colors.gasket,
            );
        }
      for (const z of [-1, 1]) {
        const upper = [p.x, volodymyrDeckY(p.x) - 0.48, p.z + z * 4.8],
          lower = [p.x, p.ground + 3.4, p.z + z * 0.6];
        tubePath(out, 'polished', [lower, upper], 0.032, colors.cable, cfg.railSides);
      }
    }
  }
  for (const [x, z] of [
    [-98, 1.4],
    [96, 13.7],
  ]) {
    const y = volodymyrDeckY(x);
    box(
      out,
      S('concrete'),
      [x - 1.3, y - 0.8, z - 3.2],
      [x + 1.3, y - 0.18, z + 3.2],
      colors.concrete,
    );
  }
}
function rails(out, S, cfg, outline) {
  const loop = area(outline) > 0 ? outline : outline.toReversed();
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i],
      b = loop[(i + 1) % loop.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz);
    // The end-edge cross sections connect directly into the park paths and remain open.
    if ((a[0] < -98 && b[0] < -98) || (a[0] > 88 && b[0] > 88 && len < 18)) continue;
    const n = [dz / len, -dx / len],
      pt = (t, y = 0, outward = 0) => {
        const x = a[0] + dx * t,
          z = a[1] + dz * t;
        return [x + n[0] * outward, volodymyrDeckY(x) + y, z + n[1] * outward];
      };
    beam(out, S('steel'), pt(0, -0.2), pt(1, -0.2), 0.12, 0.42, colors.fascia);
    if (cfg.far) {
      beam(out, 'far', pt(0, 1.2), pt(1, 1.2), 0.1, 0.1, colors.mirror);
      continue;
    }
    const segments = Math.max(1, Math.ceil(len / cfg.postStep));
    tubePath(
      out,
      'polished',
      [pt(0, 1.16, 0.22), pt(1, 1.16, 0.22)],
      0.052,
      colors.mirror,
      cfg.railSides,
    );
    for (let j = 0; j < segments; j++) {
      const t = j / segments,
        u = (j + 1) / segments;
      const post = [pt(t, 0.03, -0.12), pt(t, 0.62, 0.16), pt(t, 1.16, 0.22)];
      beamPath(out, 'polished', post, 0.12, 0.065, colors.mirror);
      quad(
        out,
        'glass',
        [pt(t, 0.09, 0.12), pt(u, 0.09, 0.12), pt(u, 1.42, 0.28), pt(t, 1.42, 0.28)],
        colors.glass,
      );
      if (cfg.clamps)
        for (const h of [0.28, 0.94]) {
          const p = pt(t, h, 0.19);
          box(
            out,
            'polished',
            [p[0] - 0.045, p[1] - 0.035, p[2] - 0.045],
            [p[0] + 0.045, p[1] + 0.035, p[2] + 0.045],
            colors.mirror,
          );
        }
    }
    for (let j = 1; j <= cfg.wires; j++)
      tubePath(
        out,
        'polished',
        [pt(0, 0.12 + j * 0.16, -0.03), pt(1, 0.12 + j * 0.16, -0.03)],
        0.009,
        colors.cable,
        cfg === cfgs.master ? 6 : 4,
      );
  }
}
export function buildVolodymyrLevel(out, level = 'master') {
  const cfg = cfgs[level];
  if (!cfg) throw Error('Unknown Volodymyr tier ' + level);
  const S = (s) => (cfg.far ? 'far' : s),
    outline = cleanRing(data.outline),
    windows = floorWindows(cfg);
  horizontalSlab(out, S('paving'), outline, windows, 0.18, colors.paving);
  for (const r of windows) {
    pane(out, S('glass'), r, colors.glass);
    if (!cfg.far && cfg.panelGrid) {
      const closed = [...r, r[0]].map(([x, z]) => [x, volodymyrDeckY(x) - 0.09, z]);
      beamPath(out, 'steel', closed, 0.065, 0.14, colors.steel);
    }
  }
  spine(out, S('steel'), cfg);
  supports(out, S, cfg);
  rails(out, S, cfg, outline);
}
export const buildVolodymyrSkyline = (out) => buildVolodymyrLevel(out, 'skyline');
export const buildVolodymyrDistrict = (out) => buildVolodymyrLevel(out, 'district');
export const buildVolodymyrStreet = (out) => buildVolodymyrLevel(out, 'street');
export const buildVolodymyrCloseup = (out) => buildVolodymyrLevel(out, 'closeup');
