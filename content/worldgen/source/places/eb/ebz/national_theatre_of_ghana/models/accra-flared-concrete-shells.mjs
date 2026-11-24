import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  fbox,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  shell: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94 },
  podium: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94 },
  panel: { slot: 'wall', graph: 'concrete_panel', roughness: 0.96 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.83 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.59 },
};

const shell = rgb('ded9c9'),
  lip = rgb('d2cebc'),
  recess = rgb('b1ad9d'),
  rooftop = rgb('beb8a5');
const cladding = rgb('bcaa90'),
  ledge = rgb('d1bda0'),
  deck = rgb('a89b86'),
  shade = rgb('8d8372');
const glass = rgb('52656a'),
  metal = rgb('696d67'),
  brick = rgb('bcb5a5');
const edges = (ring) => ring.map((p, i) => wallFace(p, ring[(i + 1) % ring.length]));
const front = wallFace(...site.front);
const lift = ([x, z], y) => [x, y, z];

function panel(out, slot, f, a, b, y, Y, d, color) {
  quad4(out, slot, f.P(a, y, d), f.P(b, y, d), f.P(b, Y, d), f.P(a, Y, d), color);
}
function stairs(out, detail) {
  const n = [4, 6, 9, 12][detail];
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / n,
      h = site.forecourt.base + (site.forecourt.top - site.forecourt.base) * t;
    fbox(
      out,
      'podium',
      front,
      4,
      front.length - 4,
      -2.2,
      h,
      -0.14,
      4.5 - 4.1 * t,
      i % 3 === 2 ? cladding : ledge,
    );
  }
}
function foyer(out, detail) {
  const y = site.forecourt.top,
    upper = 3.63,
    depth = 1.28,
    w = front.length,
    a = 4.7,
    b = w - 4.7;
  for (const [u, v] of [
    [0, a],
    [b, w],
  ])
    panel(out, 'podium', front, u, v, -2.3, site.podiumHeight, 0, cladding);
  panel(out, 'podium', front, a, b, -2.3, y, 0, shade);
  panel(out, 'podium', front, a, b, upper, site.podiumHeight, 0, cladding);
  fbox(out, 'podium', front, a - 0.21, a, y, upper, -depth, 0.26, shade);
  fbox(out, 'podium', front, b, b + 0.21, y, upper, -depth, 0.26, shade);
  panel(out, 'glass', front, a, b, y, upper, -depth, glass);
  const n = [5, 9, 13, 17][detail];
  for (let i = 1; i < n; i++) {
    const x = a + ((b - a) * i) / n;
    fbox(out, 'metal', front, x - 0.043, x + 0.043, y, upper, -depth, -depth + 0.082, metal);
  }
  stairs(out, detail);
}
function foundation(out, detail) {
  const roof = site.podiumHeight;
  for (const f of edges(outwardRing(site.outline))) {
    if (
      Math.hypot(f.origin[0] - front.origin[0], f.origin[1] - front.origin[1]) < 0.02 &&
      Math.abs(f.length - front.length) < 0.02
    )
      foyer(out, detail);
    else panel(out, 'podium', f, 0, f.length, -2.35, roof, 0, cladding);
    if (detail > 0)
      panel(out, 'podium', f, 0.018, f.length - 0.018, roof - 0.32, roof - 0.18, 0.026, ledge);
  }
  cap(out, 'podium', site.outline, roof, deck);
}
function plasterDeck(out, outline, lo, hi, detail) {
  const faces = edges(outwardRing(outline));
  for (const f of faces) {
    const y = lo + 0.45,
      Y = hi - 0.54;
    panel(out, 'panel', f, 0, f.length, lo, y, 0, brick);
    panel(out, 'glass', f, 0, f.length, y, Y, 0, glass);
    panel(out, 'shell', f, 0, f.length, Y, hi, 0, lip);
    if (detail > 0) {
      const n = Math.max(1, Math.ceil(f.length / (detail < 2 ? 4.6 : 2.55)));
      for (let i = 0; i < n; i++) {
        const u = (f.length * (i + 0.5)) / n;
        fbox(out, 'panel', f, u - 0.115, u + 0.115, y, Y, -0.085, 0.075, brick);
      }
    }
  }
  cap(out, 'shell', outline, hi, rooftop);
}
function tower(out, detail) {
  plasterDeck(out, site.lower, site.podiumHeight, 11.73, detail);
  const roof = site.towerHeight,
    base = 11.73;
  const r = outwardRing(site.upper);
  for (const f of edges(r)) {
    const w = f.length;
    panel(out, 'panel', f, 0, w, base, roof - 1.16, 0, lip);
    fbox(out, 'shell', f, 0, w, roof - 1.16, roof, -0.065, 0.18, shell);
    if (detail > 1 && w > 4) {
      const n = Math.ceil(w / 4.6);
      for (let i = 1; i < n; i++) {
        const u = (w * i) / n;
        panel(out, 'panel', f, u, u + 0.041, roof - 6.55, roof - 1.16, 0.009, brick);
      }
    }
  }
  cap(out, 'shell', r, roof, rooftop);
}
function clippedCap(out, ring, y, gradient) {
  const raw = new MeshBufferBuilder(),
    [gx, gz] = gradient,
    norm = Math.hypot(gx, 1, gz);
  const normal = [-gx / norm, 1 / norm, -gz / norm],
    ref = 'palette:#ffffff';
  if (!raw.addCap('shell', ref, ring, [], y, normal, (p) => p, rooftop))
    throw Error('Could not triangulate theatre shell');
  const { positions, indices } = raw.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const points = Array.from(indices.slice(i, i + 3), (j) => positions.slice(j * 3, j * 3 + 3));
    out.addTriangle(
      'shell',
      ref,
      points,
      normal,
      points.map((p) => [p[0], p[2]]),
      rooftop,
    );
  }
}
function flaredShell(out, wing, detail) {
  const [cx, cz] = wing.center,
    [gx, gz] = wing.gradient;
  const outline = outwardRing(wing.outline);
  const top = ([x, z]) => wing.rim + gx * (x - cx) + gz * (z - cz);
  const profiles =
    detail === 0
      ? [
          [0.61, 0],
          [0.905, 0.31],
          [1, 1],
        ]
      : [
          [0.61, 0],
          [0.738, 0.076],
          [0.86, 0.204],
          [0.944, 0.373],
          [0.987, 0.58],
          [1, 1],
        ];
  const rings = profiles.map(([f]) =>
    outline.map(([x, z]) => [cx + f * (x - cx), cz + f * (z - cz)]),
  );
  const skin = rings.map((ring, j) =>
    ring.map((p) => lift(p, wing.base + (top(p) - wing.base) * profiles[j][1])),
  );
  for (let j = 0; j < skin.length - 1; j++) {
    const lower = skin[j],
      upper = skin[j + 1];
    for (let i = 0; i < lower.length; i++) {
      const n = (i + 1) % lower.length,
        color = j === 0 ? lip : shell;
      tri(out, 'shell', lower[i], lower[n], upper[n], color);
      tri(out, 'shell', lower[i], upper[n], upper[i], color);
    }
  }
  clippedCap(out, outline, top, wing.gradient);
  plasterDeck(out, rings[0], site.podiumHeight, wing.base, detail);
}
function build(out, detail) {
  foundation(out, detail);
  tower(out, detail);
  for (const wing of site.hulls) flaredShell(out, wing, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
