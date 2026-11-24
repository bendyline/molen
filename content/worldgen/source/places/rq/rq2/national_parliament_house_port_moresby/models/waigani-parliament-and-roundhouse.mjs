import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  facade,
  fbox,
  lathe,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.95 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.91 },
  stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.95 },
  warm: { slot: 'trim', graph: 'metal_painted', roughness: 0.85 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.63 },
};

const wall = rgb('d1caad'),
  rim = rgb('bdc3aa'),
  soffit = rgb('bebbae'),
  steel = rgb('aab4a4');
const dark = rgb('595944'),
  tinted = rgb('637977'),
  gold = rgb('a77c55'),
  stone = rgb('a9a796'),
  water = rgb('52767a');
const roof = ([x]) => site.roofPlane.height - (x - site.roofPlane.origin) * site.roofPlane.slope;
const pos = ([x, z], y) => [x, y, z];
const edges = (ring) => ring.map((p, i) => wallFace(p, ring[(i + 1) % ring.length]));
const portal = facade(site.atrium.origin, site.atrium.along);
const poolFloor = -2.6;

function band(out, slot, f, u, v, y, Y, d, color) {
  quad4(out, slot, f.P(u, y, d), f.P(v, y, d), f.P(v, Y, d), f.P(u, Y, d), color);
}
function slopingCap(out, outline, holes, offset, normal, color) {
  const temp = new MeshBufferBuilder();
  if (
    !temp.addCap(
      'roof',
      'palette:#ffffff',
      outline,
      holes,
      (p) => roof(p) + offset,
      normal,
      (p) => p,
      color,
    )
  )
    throw new Error('Could not triangulate the Parliament roof');
  const { positions, indices } = temp.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const points = Array.from(indices.slice(i, i + 3), (j) => positions.slice(j * 3, j * 3 + 3));
    out.addTriangle(
      'roof',
      'palette:#ffffff',
      points,
      normal,
      points.map((p) => [p[0], p[2]]),
      color,
    );
  }
}
function roofCanopy(out) {
  const ring = outwardRing(site.outline);
  const holes = site.courts.map((r) => outwardRing(r).reverse());
  const slope = site.roofPlane.slope,
    length = Math.hypot(slope, 1);
  const normal = [slope / length, 1 / length, 0];
  slopingCap(out, ring, holes, 0, normal, steel);
  slopingCap(
    out,
    ring,
    holes,
    -0.89,
    normal.map((n) => -n),
    soffit,
  );
  for (const loop of [ring, ...holes]) {
    for (const [i, a] of loop.entries()) {
      const b = loop[(i + 1) % loop.length],
        y = roof(a),
        Y = roof(b);
      quad4(out, 'roof', pos(a, y - 0.89), pos(b, Y - 0.89), pos(b, Y), pos(a, y), rim);
    }
  }
}
function podium(out, detail) {
  const ring = outwardRing(site.podium);
  for (const face of edges(ring)) {
    const { P, length } = face;
    if (length > 6 && Math.abs(face.origin[0] + 32.27) < 0.022 && Math.abs(face.along[0]) < 0.001)
      continue;
    const a = roof([P(0, 0)[0]]) - 0.88,
      b = roof([P(length, 0)[0]]) - 0.88;
    band(out, 'stone', face, 0, length, -3.52, 1.4, 0, stone);
    quad4(out, 'concrete', P(0, 10.6), P(length, 10.6), P(length, b), P(0, a), wall);
    const panels = Math.max(1, Math.ceil(length / (detail === 0 ? 22 : detail === 1 ? 8.5 : 5.5)));
    for (let i = 0; i < panels; i++) {
      const u = (i * length) / panels,
        v = ((i + 1) * length) / panels,
        reveal = Math.min(0.58, (v - u) * 0.14);
      band(out, 'concrete', face, u, u + reveal, 1.4, 10.6, 0, wall);
      band(out, 'concrete', face, v - reveal, v, 1.4, 10.6, 0, wall);
      band(out, 'glass', face, u + reveal, v - reveal, 1.4, 4.8, -0.39, tinted);
      band(out, 'warm', face, u + reveal, v - reveal, 4.8, 10.6, -0.39, gold);
      if (detail > 1) {
        const w = (u + v) * 0.5;
        fbox(out, 'concrete', face, w - 0.095, w + 0.095, 1.4, 10.55, -0.4, 0.06, wall);
        fbox(out, 'concrete', face, u + reveal, v - reveal, 4.7, 4.86, -0.41, 0.105, wall);
      }
    }
  }
  for (const court of site.courts) {
    const ring = outwardRing(court).reverse();
    for (const [i, a] of ring.entries()) {
      const b = ring[(i + 1) % ring.length];
      quad4(
        out,
        'concrete',
        pos(a, -0.32),
        pos(b, -0.32),
        pos(b, roof(b) - 0.89),
        pos(a, roof(a) - 0.89),
        wall,
      );
    }
    cap(out, 'stone', court, -0.14, stone);
  }
}
function ceremonialEntry(out, detail) {
  const F = portal,
    p = F.P,
    ceiling = roof([site.atrium.origin[0]]) - 0.9;
  for (const [a, b] of [
    [-6.8, -3.7],
    [4.7, 9.0],
  ]) {
    fbox(out, 'concrete', F, a, b, -2.9, ceiling, -0.22, 0.11, wall);
  }
  const color = ['9b5e45', 'ba9476', '78544c', 'c0a27d', '835440'].map(rgb);
  const strips = [5, 8, 15, 20][detail];
  for (let i = 0; i < strips; i++) {
    const t = i / strips,
      T = (i + 1) / strips,
      y = 5.3 + t * (ceiling - 5.3),
      Y = 5.3 + T * (ceiling - 5.3);
    const a = -3.7 + t * 2.82,
      b = 4.7 + t * 3.57;
    const A = -3.7 + T * 2.82,
      B = 4.7 + T * 3.57;
    quad4(
      out,
      'warm',
      p(a, y, 0.028),
      p(b, y, 0.028),
      p(B, Y, 0.028),
      p(A, Y, 0.028),
      color[i % color.length],
    );
    if (detail > 1) {
      const u = (a + b) / 2,
        U = (A + B) / 2;
      tri(
        out,
        'warm',
        p(u - 1.04, y, 0.039),
        p(u + 1.04, y, 0.039),
        p(U, Y, 0.039),
        color[(i + 2) % color.length],
      );
    }
  }
  band(out, 'glass', F, -3.69, 4.69, 1.34, 5.3, -0.61, dark);
  for (const u of [-2.8, -0.95, 0.9, 2.8])
    fbox(out, 'warm', F, u - 0.08, u + 0.08, 1.34, 5.3, -0.62, -0.47, gold);
  const steps = [4, 7, 10, 14][detail];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    fbox(out, 'stone', F, -7, 9, -2.65, -0.2 + 1.54 * t, 0, 12.7 - t * 8.4, stone);
  }
}
function roundhouse(out, detail) {
  const ring = outwardRing(site.round);
  const center = ring.reduce(
    ([x, z], [a, b]) => [x + a / ring.length, z + b / ring.length],
    [0, 0],
  );
  for (const face of edges(ring)) {
    const w = face.length;
    band(out, 'stone', face, 0, w, -2, 1.38, 0, stone);
    band(out, 'glass', face, 0, w, 1.38, 6.68, -0.21, tinted);
    const u = Math.min(0.3, w * 0.14);
    band(out, 'concrete', face, 0, u, 1.38, 6.68, 0.02, wall);
    const nv = detail === 0 ? 0 : detail === 1 ? 1 : 2;
    for (let i = 1; i <= nv; i++) {
      const x = (w * i) / (nv + 1);
      band(out, 'concrete', face, x - 0.083, x + 0.083, 1.38, 6.68, -0.022, wall);
    }
  }
  const n = [10, 16, 24, 32][detail];
  lathe(
    out,
    'roof',
    center,
    [
      [6.61, 22.51, 22.51],
      [7.34, 22.51, 22.51],
      [10.63, 2.1, 2.1],
      [11, 0.89, 0.89],
    ],
    n,
    steel,
    { capTop: true },
  );
}
function reflectingPool(out, detail) {
  const ring = outwardRing(site.pond);
  cap(out, 'glass', ring, site.waterLevel, water);
  for (const face of edges(ring)) {
    band(out, 'stone', face, 0, face.length, poolFloor, site.waterLevel + 0.42, 0, stone);
    if (detail > 0)
      fbox(
        out,
        'stone',
        face,
        0,
        face.length,
        site.waterLevel + 0.28,
        site.waterLevel + 0.46,
        -0.13,
        0.16,
        stone,
      );
  }
}

function build(out, detail) {
  roofCanopy(out);
  podium(out, detail);
  ceremonialEntry(out, detail);
  roundhouse(out, detail);
  reflectingPool(out, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
