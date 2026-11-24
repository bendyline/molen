import {
  fbox,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { tube } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  basalt: { slot: 'wall', graph: 'stone_basalt_raw', roughness: 0.98 },
  block: { slot: 'trim', graph: 'stone_basalt', roughness: 0.97 },
  core: { slot: 'foundation', graph: 'stone_drywall', roughness: 0.97 },
};
const dark = rgb('77776b'),
  core = rgb('918879'),
  fill = rgb('8e8975');
const logs = ['827b6a', '6d6c64', '857c69', '8b816e', '746f61', '937e68'].map(rgb);
const vecAvg = (ring) =>
  ring.reduce(([x, z], [a, b]) => [x + a / ring.length, z + b / ring.length], [0, 0]);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const scale = (r, f) => {
  const m = vecAvg(r);
  return r.map((p) => mix(m, p, f));
};

function tidalBase(out) {
  const ring = outwardRing(site.outline);
  for (const [i, a] of ring.entries()) {
    const f = wallFace(a, ring[(i + 1) % ring.length]),
      p = f.P;
    quad4(
      out,
      'core',
      p(0, site.seaLevel - 0.68),
      p(f.length, site.seaLevel - 0.68),
      p(f.length, site.deck),
      p(0, site.deck),
      dark,
    );
  }
  cap(out, 'core', ring, site.deck, fill);
}

function stoneProfiles(out, detail, point, u0, u1, y0, y1, code) {
  const mid = (u0 + u1) / 2;
  const width = u1 - u0,
    rise = y1 - y0;
  const step = detail === 3 ? 0.526 : 0.874,
    stride = detail === 3 ? 2.72 : 4.41;
  if (rise < 0.28) return;
  for (let row = 0; row * step < rise - 0.25; row++) {
    const y = y0 + 0.24 + row * step;
    const blocks = Math.max(1, Math.floor(width / stride));
    for (let i = 0; i < blocks; i++) {
      const t = (i + 0.5) / blocks;
      const u = mix([u0], [u1], t)[0] + 0.1 * Math.sin(code + row + i);
      const length = (width / blocks) * (0.78 + 0.14 * Math.sin(1.5 * i + row + code));
      const tip = Math.min(u1 - 0.015, u + length * 0.5),
        heel = Math.max(u0 + 0.015, u - length * 0.5);
      const shade = logs[(i + row + code) % logs.length];
      const radius = Math.min(step * (0.33 + 0.08 * Math.sin(i + 0.93 * row)), 0.404);
      if (tip - heel < 0.12 || y + radius > y1) continue;
      if (row % 3 === 2) {
        tube(out, 'block', point(u, y, -0.28), point(u, y + 0.018, 0.08), radius, shade, 5);
      } else {
        tube(
          out,
          'block',
          point(heel, y, -0.056),
          point(tip, y + 0.069 * Math.sin(row + i), -0.063),
          radius,
          shade,
          detail === 3 ? 6 : 5,
        );
      }
    }
  }
  if (detail === 3 && width > 1.4) {
    const y = y1 - 0.16;
    if (y > y0 + 0.34)
      tube(
        out,
        'block',
        point(mid - 0.33, y, -0.12),
        point(mid + 0.41, y + 0.035, -0.09),
        0.133,
        logs[code % logs.length],
        5,
      );
  }
}

function wall(out, detail, kind, shape) {
  const ring = outwardRing(shape);
  const inner = scale(ring, kind === 'outer' ? 0.885 : kind === 'inner' ? 0.887 : 0.719);
  const frontCrest = scale(ring, kind === 'outer' ? 0.975 : 0.984);
  const rearCrest = inner.map((p, i) => mix(p, ring[i], 0.15));
  const heights = site.walls[kind],
    deck = site.deck;
  for (const [i, a] of ring.entries()) {
    const next = (i + 1) % ring.length,
      f = wallFace(a, ring[next]);
    const lo = kind === 'outer' && i === site.collapse.edge ? site.collapse.lo * f.length : 0;
    const hi = kind === 'outer' && i === site.collapse.edge ? site.collapse.hi * f.length : 0;
    const door = (kind === 'outer' || kind === 'inner') && i === site.gate.edge;
    const doorU = site.gate.ratio * f.length,
      doorWidth = site.gate.width * (kind === 'inner' ? 1.05 : 1);
    const frame = door ? [doorU - doorWidth * 0.5, doorU + doorWidth * 0.5] : [];
    const step = kind === 'outer' && i === site.collapse.edge ? [lo - 0.8, lo, hi, hi + 0.72] : [];
    const cuts = [0, ...frame, ...step, f.length];
    const top = (u) => {
      const a = heights[i],
        b = heights[next],
        t = u / f.length;
      const notch = step.length && u >= lo && u <= hi ? site.collapse.drop : 0;
      return deck + a + (b - a) * t - notch;
    };
    function point(u, y, offset = 0, back = false) {
      const t = u / f.length,
        low = mix(back ? inner[i] : ring[i], back ? inner[next] : ring[next], t);
      const high = mix(
        back ? rearCrest[i] : frontCrest[i],
        back ? rearCrest[next] : frontCrest[next],
        t,
      );
      const [x, z] = mix(low, high, (y - deck) / (top(u) - deck));
      return [x + offset * f.normal[0], y, z + offset * f.normal[1]];
    }
    for (let j = 1; j < cuts.length; j++) {
      const a = cuts[j - 1],
        b = cuts[j],
        ya = top(a),
        yb = top(b);
      const passage = door && a === frame[0] && b === frame[1];
      const bottom = passage ? site.gate.passageTop : deck - 0.054;
      const p = point;
      const stone = logs[(i + j) % logs.length];
      quad4(out, 'basalt', p(a, bottom), p(b, bottom), p(b, yb), p(a, ya), stone);
      quad4(
        out,
        'basalt',
        p(b, bottom, 0, true),
        p(a, bottom, 0, true),
        p(a, ya, 0, true),
        p(b, yb, 0, true),
        stone,
      );
      quad4(out, 'core', p(a, ya), p(b, yb), p(b, yb, 0, true), p(a, ya, 0, true), core);
      if (passage) {
        quad4(
          out,
          'block',
          p(b, bottom),
          p(a, bottom),
          p(a, bottom, 0, true),
          p(b, bottom, 0, true),
          dark,
        );
        for (const u of [a, b]) {
          const verts = [
            p(u, deck - 0.053),
            p(u, deck - 0.053, 0, true),
            p(u, bottom, 0, true),
            p(u, bottom),
          ];
          quad4(out, 'block', ...(u === a ? verts : verts.slice().reverse()), dark);
        }
      }
      if (detail === 1 && b - a > 1.5)
        for (let k = 1; k < f.length * 0.1; k++) {
          const h = bottom + (0.32 + 0.15 * k) * (Math.min(ya, yb) - bottom);
          if (h + 0.05 < Math.min(ya, yb))
            quad4(
              out,
              'block',
              p(a, h, 0.023),
              p(b, h, 0.023),
              p(b, h + 0.041, 0.023),
              p(a, h + 0.041, 0.023),
              core,
            );
        }
      if (detail > 1) stoneProfiles(out, detail, point, a, b, bottom, Math.min(ya, yb), i * 5 + j);
    }
  }
}

function lowerPassage(out, detail) {
  const ring = outwardRing(site.outer),
    i = site.gate.edge;
  const f = wallFace(ring[i], ring[(i + 1) % ring.length]),
    u = f.length * site.gate.ratio;
  const n = detail > 0 ? 4 : 2;
  for (let j = 0; j < n; j++) {
    const y = site.deck * (1 - j / n);
    fbox(
      out,
      'core',
      f,
      u - site.gate.stepWidth * 0.5,
      u + site.gate.stepWidth * 0.5,
      y - 0.28,
      y,
      0,
      0.46 + j * 0.39,
      core,
    );
  }
  const inner = scale(site.tomb, 0.46);
  const slab = scale(inner, 1.17);
  cap(out, 'block', slab, site.deck + 0.89, logs[2]);
  if (detail) {
    for (const [x, z] of inner)
      tube(out, 'block', [x, site.deck - 0.06, z], [x, site.deck + 0.86, z], 0.43, logs[1], 5);
  }
}

function build(out, detail) {
  tidalBase(out);
  wall(out, detail, 'outer', site.outer);
  wall(out, detail, 'inner', site.inner);
  wall(out, detail, 'tomb', site.tomb);
  lowerPassage(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
