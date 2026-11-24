import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  extrude,
  facade,
  fbox,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  brick: { slot: 'wall', graph: 'brick_longformat', roughness: 0.96 },
  sand: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 1 },
  rail: { slot: 'trim', graph: 'metal_painted', roughness: 0.87 },
};

const F = facade(site.frame.origin, site.frame.along);
const P = F.P;
const xz = ([x, , z]) => [x, z];
const tan = rgb('b48d6b'),
  lintel = rgb('b78f6b'),
  dark = rgb('68513f');
const baked = rgb('a98262'),
  rubble = rgb('ad8f6d'),
  sand = rgb('a69779');
const clay = [tan, rgb('b08a68'), rgb('ae8869'), rgb('ba9270')];

const rect = (u, U, d, D) =>
  [
    [u, d],
    [U, d],
    [U, D],
    [u, D],
  ].map(([x, z]) => xz(P(x, 0, z)));
const lowRing = outwardRing(site.outline);
const lerp = (a, b, t) => a + (b - a) * t;
const uv = ([x, z]) => [x * F.along[0] + z * F.along[1], x * F.normal[0] + z * F.normal[1]];
const topPoint = ([x, z]) => [lerp(2.15, x, 0.879), lerp(-4.6, z, 0.819)];
const center = (ring) =>
  ring.reduce(([x, z], [a, b]) => [x + a / ring.length, z + b / ring.length], [0, 0]);

function batteredWall(out, detail) {
  const top = lowRing.map(topPoint);
  for (let i = 0; i < lowRing.length; i++) {
    const j = (i + 1) % lowRing.length;
    const [a, b] = [lowRing[i], lowRing[j]];
    const [c, d] = [top[j], top[i]];
    const y = 13.89 + 0.075 * Math.sin(i / 4.8);
    const Y = 13.89 + 0.075 * Math.sin(j / 4.8);
    quad4(
      out,
      'brick',
      [a[0], -1.82, a[1]],
      [b[0], -1.82, b[1]],
      [c[0], Y, c[1]],
      [d[0], y, d[1]],
      clay[Math.floor(i / 6) % clay.length],
    );
    if (detail < 2 || i % 3 !== 0 || Math.hypot(a[0] - b[0], a[1] - b[1]) < 2.35) continue;
    const f = wallFace(a, b);
    const M = (y, t) => {
      const [u, v] = f.P(f.length * 0.52, 0, 0.051).filter((_, idx) => idx !== 1);
      const roof = topPoint([u, v]);
      return [lerp(u, roof[0], t), y, lerp(v, roof[1], t)];
    };
    for (const h of [5.49, 8.43, 10.69]) {
      const a = M(h, (h + 1.82) / 15.71),
        b = M(h + 0.167, (h + 1.987) / 15.71);
      beam(
        out,
        'rail',
        [a[0] + f.normal[0] * 0.045, a[1], a[2] + f.normal[1] * 0.045],
        b,
        0.18,
        0.17,
        dark,
      );
    }
  }
  if (
    !out.addCap(
      'brick',
      'palette:#ffffff',
      top,
      [],
      () => 13.86,
      [0, 1, 0],
      (p) => p,
      baked,
    )
  )
    throw new Error('Ur: platform cap failed');
}

function upperRuins(out, detail) {
  const under = outwardRing(site.core.outline);
  const [x, z] = center(under);
  const top = under.map(([a, b], i) => [
    lerp(x, a, 0.79 + 0.08 * Math.sin(i * 1.61)),
    lerp(z, b, 0.77 + 0.07 * Math.cos(i * 2.13)),
  ]);
  const levels = top.map((_, i) => 16.15 + 0.345 * Math.cos(i * 0.61));
  for (let i = 0; i < under.length; i++) {
    const j = (i + 1) % under.length;
    const [a, b] = [under[i], under[j]],
      [d, c] = [top[i], top[j]];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.025) continue;
    quad4(
      out,
      'sand',
      [a[0], 13.82, a[1]],
      [b[0], 13.82, b[1]],
      [c[0], levels[j], c[1]],
      [d[0], levels[i], d[1]],
      i % 2 === 0 ? rubble : baked,
    );
  }
  const height = new Map(top.map(([x, z], i) => [x + ',' + z, levels[i]]));
  if (
    !out.addCap(
      'sand',
      'palette:#ffffff',
      top,
      [],
      ([x, z]) => height.get(x + ',' + z) ?? 16.16,
      [0, 1, 0],
      (p) => p,
      rubble,
    )
  ) {
    throw new Error('Ur: upper remains cap failed');
  }
  if (detail > 1) {
    for (let j = 0; j < 12; j++) {
      const d = -14 + j * 1.71,
        u = 6.6 + 1.23 * Math.cos(j * 0.68);
      const h = 16.06 + 0.26 * Math.sin(j * 0.63);
      fbox(out, 'sand', F, u - 0.2, u + 0.33, h - 0.12, h + 0.24, d, d + 0.65, rubble);
    }
  }
}

function strip(out, u, U, d, D, y, Y, color) {
  const a = P(u, -1.43, d),
    b = P(U, -1.44, d),
    c = P(U, -1.43, D),
    e = P(u, -1.44, D);
  const q = P(u, y, d),
    r = P(U, y, d),
    s = P(U, Y, D),
    t = P(u, Y, D);
  quad4(out, 'brick', t, s, r, q, color);
  quad4(out, 'brick', b, a, q, r, color);
  quad4(out, 'brick', c, b, r, s, color);
  quad4(out, 'brick', e, c, s, t, color);
  quad4(out, 'brick', a, e, t, q, color);
}
function stairs(out, detail) {
  const selected = new Set(site.middleIds);
  const stepWidth = detail === 3 ? 1 : detail === 2 ? 2 : 5;
  const byHeight = (a, b) => a.height - b.height;
  const groups = [
    site.treads.filter((v) => selected.has(v.id)),
    site.treads.filter((v) => !selected.has(v.id) && uv(center(v.outline))[0] < 0),
    site.treads.filter((v) => !selected.has(v.id) && uv(center(v.outline))[0] >= 0),
  ];
  if (detail === 0) {
    strip(out, 0.29, 5.93, -55.93, -24.81, 0.28, 13.74, baked);
    fbox(out, 'brick', F, -27.5, -20.4, -1.45, 0.91, -29.9, -25.82, tan);
    fbox(out, 'brick', F, 25, 33.4, -1.45, 0.87, -29.9, -25.82, tan);
    for (const [u, U, top] of [
      [-27.49, 0.09, 13.4],
      [5.11, 33.5, 13.4],
    ]) {
      const increasing = u < 0;
      const h = (a) => (a ? top : 0.6);
      const a = P(u, h(!increasing), -29.95),
        b = P(U, h(increasing), -29.95),
        c = P(U, h(increasing), -25.75),
        d = P(u, h(!increasing), -25.75);
      quad4(out, 'brick', d, c, b, a, tan);
      quad4(out, 'brick', P(U, -1.43, -29.95), P(u, -1.43, -29.95), a, b, baked);
    }
  } else {
    for (const group of groups) {
      group.sort(byHeight);
      for (let i = 0; i < group.length; i++) {
        const { outline } = group[i];
        const j = Math.min(group.length - 1, i + stepWidth - 1 - (i % stepWidth));
        extrude(
          out,
          'brick',
          outline,
          -1.45,
          group[j].height,
          clay[Math.floor(i / 4) % clay.length],
          { topColor: i % 2 === 0 ? lintel : tan },
        );
      }
    }
  }
  strip(out, -0.47, 0.41, -55.94, -28.45, 0.65, 14.45, tan);
  strip(out, 4.63, 5.74, -55.94, -28.45, 0.65, 14.45, lintel);
  for (const p of site.flanks) extrude(out, 'brick', p.outline, -1.46, p.height, tan);
  if (detail > 1) {
    // Narrow gate railing above the lower approach. The visible treads stay in the exact positions.
    const d = -34.58,
      y = 9.99;
    for (const x of [0.38, 2.58, 4.8])
      fbox(out, 'rail', F, x - 0.044, x + 0.044, y, y + 0.75, d - 0.056, d + 0.052, dark);
    for (const dy of [0.27, 0.72])
      fbox(out, 'rail', F, 0.33, 4.85, y + dy, y + dy + 0.048, d - 0.058, d + 0.054, dark);
  }
}

function build(sink, detail) {
  const out = withFootprintCaps(sink);
  const apron = rect(-28.04, 34.03, -57.04, 16.03);
  extrude(out, 'sand', apron, -2.2, -0.07, sand);
  batteredWall(out, detail);
  stairs(out, detail);
  upperRuins(out, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
