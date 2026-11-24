import { withFootprintCaps } from '../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  extrude,
  facade,
  fbox,
  outwardRing,
  quad4,
  rgb,
} from '../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

export const surfaces = {
  basalt: { slot: 'wall', graph: 'stone_basalt', roughness: 0.96 },
  rubble: { slot: 'foundation', graph: 'stone_basalt_raw', roughness: 0.98 },
  ashlar: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.92 },
};

const face = rgb('7d807b');
const walkway = rgb('8f8b7b');
const footing = rgb('6f6c62');
const cutStone = rgb('aaa28d');
const at = ([x, z], y) => [x, y, z];
const mix = (a, b, t) => a + (b - a) * t;
const between = (a, b, t) => a.map((v, i) => mix(v, b[i], t));

function curtain(out, run, level) {
  const points = run.levels[level];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const roofA = at(a.outside, a.top);
    const roofB = at(b.outside, b.top);
    const deckA = at(a.inside, a.top);
    const deckB = at(b.inside, b.top);
    const baseA = at(a.outside, a.base);
    const baseB = at(b.outside, b.base);
    if (level === 0) quad4(out, 'basalt', baseA, baseB, roofB, roofA, face);
    else {
      const seamA = at(a.outside, a.base + 3.3);
      const seamB = at(b.outside, b.base + 3.3);
      quad4(out, 'rubble', baseA, baseB, seamB, seamA, footing);
      quad4(out, 'basalt', seamA, seamB, roofB, roofA, face);
    }
    quad4(out, 'basalt', at(b.inside, b.base), at(a.inside, a.base), deckA, deckB, face);
    quad4(out, 'basalt', roofA, roofB, deckB, deckA, walkway);
    if (level >= 2 && run.parapet) {
      const length = Math.hypot(b.outside[0] - a.outside[0], b.outside[1] - a.outside[1]);
      const count = Math.floor(length / (level === 2 ? 5.4 : 3.6));
      const wall = facade(
        a.outside,
        b.outside.map((v, j) => v - a.outside[j]),
      );
      for (let crenel = 0; crenel < count; crenel++) {
        const t = (crenel + 0.5) / count;
        const x = length * t;
        const y = mix(a.top, b.top, t);
        fbox(out, 'basalt', wall, x - 0.66, x + 0.66, y - 0.2, y + 0.82, -0.65, 0, face);
      }
    }
  }
  const a = points[0];
  const b = points.at(-1);
  quad4(
    out,
    'basalt',
    at(a.inside, a.base),
    at(a.outside, a.base),
    at(a.outside, a.top),
    at(a.inside, a.top),
    face,
  );
  quad4(
    out,
    'basalt',
    at(b.outside, b.base),
    at(b.inside, b.base),
    at(b.inside, b.top),
    at(b.outside, b.top),
    face,
  );
}

function bastion(out, tower, level) {
  const ring = outwardRing(level <= 1 ? tower.district : tower.outline);
  const mode = tower.restored ? 1 : 0;
  if (level === 0) {
    extrude(out, 'basalt', ring, tower.base, tower.top, face, { topColor: walkway });
    return;
  }
  extrude(out, 'rubble', ring, tower.base, tower.base + 4.1, footing, { top: false });
  extrude(out, 'basalt', ring, tower.base + 4.1, tower.top, face, { topColor: walkway });
  const scale = (p, k) => between(tower.center, p, k);
  if (level >= 2 && tower.belt) {
    const band = tower.top - tower.belt;
    extrude(
      out,
      'basalt',
      ring.map((p) => scale(p, 1.017)),
      band,
      band + 0.22,
      footing,
    );
  }
  const inner = ring.map((p) => scale(p, 0.83));
  extrude(out, 'basalt', ring, tower.top - 0.05, tower.top + 0.52 + mode * 0.26, face, {
    holes: [inner],
    topColor: cutStone,
  });
  if (level < 2 || !tower.restored) return;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const wall = facade(
      a,
      b.map((v, j) => v - a[j]),
    );
    const count = Math.max(1, Math.floor(length / 3.65));
    for (let slot = 0; slot < count; slot++) {
      const u = (length * (slot + 0.5)) / count;
      const half = Math.min(0.63, length / 3);
      fbox(
        out,
        'basalt',
        wall,
        u - half,
        u + half,
        tower.top + 0.72,
        tower.top + 1.54,
        -0.78,
        -0.025,
        face,
      );
    }
  }
}

function gatehouse(out, gate, level) {
  const { P: position } = facade(gate.center, gate.along);
  const p = (u, h, d) => position(u + d * gate.skew, h, d);
  const halfDepth = gate.depth / 2;
  const panel = (a, b, h, k, cap = true) => {
    const y = gate.top;
    quad4(
      out,
      'basalt',
      p(a, h, halfDepth),
      p(b, k, halfDepth),
      p(b, y, halfDepth),
      p(a, y, halfDepth),
      face,
    );
    quad4(
      out,
      'basalt',
      p(b, k, -halfDepth),
      p(a, h, -halfDepth),
      p(a, y, -halfDepth),
      p(b, y, -halfDepth),
      face,
    );
    if (cap)
      quad4(
        out,
        'basalt',
        p(a, y, halfDepth),
        p(b, y, halfDepth),
        p(b, y, -halfDepth),
        p(a, y, -halfDepth),
        walkway,
      );
  };
  let previous = gate.u[0];
  for (const entry of gate.openings) {
    const half = entry.width / 2;
    const left = entry.offset - half;
    const right = entry.offset + half;
    const y0 = entry.floor - 1.8;
    const spring = entry.floor + entry.spring;
    if (left > previous + 0.02) panel(previous, left, gate.base, gate.base);
    const steps = entry.rise === 0 ? 1 : [4, 6, 8, 12][level];
    for (let segment = 1; segment <= steps; segment++) {
      const t = (segment - 1) / steps;
      const s = segment / steps;
      const u = entry.offset - half * Math.cos(Math.PI * t);
      const v = entry.offset - half * Math.cos(Math.PI * s);
      const h = spring + entry.rise * Math.sin(Math.PI * t);
      const k = spring + entry.rise * Math.sin(Math.PI * s);
      panel(u, v, h, k);
      quad4(
        out,
        'basalt',
        p(v, k, halfDepth),
        p(u, h, halfDepth),
        p(u, h, -halfDepth),
        p(v, k, -halfDepth),
        footing,
      );
      if (level < 1) continue;
      for (const sign of [-1, 1]) {
        const depth = sign * (halfDepth + 0.13);
        const aa = p(u, h, depth);
        const bb = p(v, k, depth);
        const cc = p(v + (v - entry.offset) * 0.085, k + 0.34, depth);
        const dd = p(u + (u - entry.offset) * 0.085, h + 0.34, depth);
        if (sign > 0) quad4(out, 'ashlar', aa, bb, cc, dd, cutStone);
        else quad4(out, 'ashlar', bb, aa, dd, cc, cutStone);
      }
    }
    quad4(
      out,
      'basalt',
      p(left, y0, halfDepth),
      p(left, y0, -halfDepth),
      p(left, spring, -halfDepth),
      p(left, spring, halfDepth),
      footing,
    );
    quad4(
      out,
      'basalt',
      p(right, y0, -halfDepth),
      p(right, y0, halfDepth),
      p(right, spring, halfDepth),
      p(right, spring, -halfDepth),
      footing,
    );
    if (level >= 2 && gate.dressed) {
      const rim = facade(gate.center, gate.along);
      const crown = spring + entry.rise;
      fbox(
        out,
        'ashlar',
        rim,
        entry.offset - half - 0.68,
        entry.offset + half + 0.68,
        crown + 0.69,
        crown + 1.18,
        halfDepth - 0.12,
        halfDepth + 0.49,
        cutStone,
      );
    }
    previous = right;
  }
  if (gate.u[1] > previous + 0.02) panel(previous, gate.u[1], gate.base, gate.base);
  const [a, b] = gate.u;
  quad4(
    out,
    'basalt',
    p(a, gate.base, -halfDepth),
    p(a, gate.base, halfDepth),
    p(a, gate.top, halfDepth),
    p(a, gate.top, -halfDepth),
    face,
  );
  quad4(
    out,
    'basalt',
    p(b, gate.base, halfDepth),
    p(b, gate.base, -halfDepth),
    p(b, gate.top, -halfDepth),
    p(b, gate.top, halfDepth),
    face,
  );
}

export function fortressBuilders(site) {
  const build = (out, level) => {
    const mesh = withFootprintCaps(out);
    for (const run of site.curtains) curtain(mesh, run, level);
    for (const tower of site.bastions) bastion(mesh, tower, level);
    for (const gate of site.gates) gatehouse(mesh, gate, level);
  };
  return {
    buildSkyline: (out) => build(out, 0),
    buildDistrict: (out) => build(out, 1),
    buildStreet: (out) => build(out, 2),
    buildCloseup: (out) => build(out, 3),
    buildMaster: (out) => build(out, 3),
  };
}
