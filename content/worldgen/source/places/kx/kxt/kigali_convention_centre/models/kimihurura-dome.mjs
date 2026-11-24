import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  fbox,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  wall: { slot: 'wall', graph: 'stone_travertine', roughness: 0.93 },
  paving: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94 },
  frame: { slot: 'trim', graph: 'metal_painted', roughness: 0.84 },
  rims: { slot: 'trim', graph: 'metal_stainless_beadblasted', roughness: 0.82 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.92 },
  windows: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.69 },
  skin: {
    slot: 'window',
    localRef: 'palette:#edf4fa',
    roughness: 0.69,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.93],
  },
  canopy: {
    slot: 'window',
    localRef: 'palette:#f8fbfd',
    roughness: 0.55,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.61],
    doubleSided: true,
  },
};

const podium = outwardRing(site.outline),
  outline = outwardRing(site.dome.outline);
const [cx, cz] = site.dome.center;
const roofTone = rgb('bab4a7'),
  paving = rgb('b7ab96'),
  concrete = rgb('999180'),
  clad = rgb('c6b9a1');
const dark = rgb('5a5c5c'),
  grey = rgb('838b8e'),
  silver = rgb('a6aaab'),
  underside = rgb('6e7475');
const glazing = rgb('515d60'),
  inner = rgb('536064'),
  pale = rgb('b8c1c6');
const skins = ['bec7cb', 'b0bdc4', 'b9c3c8', 'b9c2c8', 'b3bfc6'].map(rgb);

function cap(out, slot, ring, y, tint, holes = []) {
  const mesh = new MeshBufferBuilder();
  if (
    !mesh.addCap(
      'roof',
      'palette:#ffffff',
      ring,
      holes,
      () => y,
      [0, 1, 0],
      (p) => p,
      tint,
    )
  )
    throw Error('Could not triangulate the convention roof.');
  const { indices, positions } = mesh.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const points = Array.from(indices.slice(i, i + 3), (j) => positions.slice(j * 3, j * 3 + 3));
    tri(out, slot, ...points, tint);
  }
}

function wall(out, slot, f, y0, y1, d, tint) {
  const p = f.P;
  quad4(out, slot, p(0, y0, d), p(f.length, y0, d), p(f.length, y1, d), p(0, y1, d), tint);
}

function glazedPavilion(out, detail, plan, bottom, top) {
  const ring = outwardRing(plan);
  for (const [i, a] of ring.entries()) {
    const f = wallFace(a, ring[(i + 1) % ring.length]);
    const sill = bottom + 0.64,
      head = top - 0.67;
    wall(out, 'wall', f, bottom, sill, 0, clad);
    wall(out, 'windows', f, sill, head, -0.09, glazing);
    wall(out, 'wall', f, head, top, 0, clad);
    const spans = Math.ceil(f.length / [17.5, 8.3, 3.75, 2.22][detail]);
    if (detail) {
      const p = f.P;
      for (let j = 1; j < spans; j++) {
        const u = (f.length * j) / spans,
          w = detail === 1 ? 0.047 : 0.055;
        if (detail === 3) fbox(out, 'frame', f, u - w, u + w, sill, head, -0.12, 0.025, dark);
        else
          quad4(out, 'frame', p(u - w, sill), p(u + w, sill), p(u + w, head), p(u - w, head), dark);
      }
      const mid = sill + (head - sill) * 0.54;
      wall(out, 'frame', f, mid - 0.048, mid + 0.048, 0.012, dark);
      if (detail > 1) {
        const upper = sill + (head - sill) * 0.82;
        wall(out, 'frame', f, upper - 0.039, upper + 0.039, 0.017, grey);
      }
    }
  }
}

function buildPavilion(out, detail) {
  const { roof, annexRoof, base } = site.podium;
  const { floor } = site.entry;
  for (const [i, a] of podium.entries()) {
    const f = wallFace(a, podium[(i + 1) % podium.length]);
    wall(out, 'wall', f, base, floor, 0, concrete);
    if (detail) wall(out, 'paving', f, floor - 0.64, floor - 0.05, 0.014, paving);
  }
  glazedPavilion(out, detail, podium, floor, roof);
  cap(out, 'paving', podium, roof, paving, [outline]);

  const entry = wallFace(site.entry.from, site.entry.to),
    p = entry.P;
  const upper = [
    [95, -67.5],
    [185.6, -68.3],
    [185.7, -8.95],
    [95.3, -8.95],
  ].map(([u, d]) => {
    const [x, , z] = p(u, roof, d);
    return [x, z];
  });
  glazedPavilion(out, detail, upper, roof, annexRoof - 0.6);
  const order = outwardRing(upper);
  for (const [i, point] of order.entries()) {
    const f = wallFace(point, order[(i + 1) % order.length]);
    wall(out, 'roof', f, annexRoof - 0.6, annexRoof, 0.021, roofTone);
  }
  cap(out, 'roof', upper, annexRoof, roofTone);

  if (!detail) return;
  const [start, end] = site.entry.span,
    setback = site.entry.setback,
    canopy = 5.71;
  fbox(out, 'paving', entry, start, end, floor - 0.34, floor, 0.018, 3.83, paving);
  const steps = detail > 1 ? 16 : 8;
  for (let i = 0; i < steps; i++) {
    const y = floor - (3.38 * (i + 1)) / steps;
    const d = 3.82 + (5.49 * i) / steps;
    fbox(out, 'paving', entry, 62.4, 74.5, y - 0.3, y, d, d + 5.49 / steps, paving);
  }
  quad4(
    out,
    'canopy',
    p(end, canopy, 0.01),
    p(start, canopy, 0.01),
    p(start, canopy, setback),
    p(end, canopy, setback),
    pale,
  );
  fbox(
    out,
    'frame',
    entry,
    start,
    end,
    canopy - 0.16,
    canopy + 0.05,
    setback - 0.13,
    setback + 0.03,
    dark,
  );
  const bays = detail > 1 ? 12 : 6;
  for (let i = 0; i <= bays; i++) {
    const u = start + ((end - start) * i) / bays;
    fbox(
      out,
      'frame',
      entry,
      u - 0.077,
      u + 0.077,
      canopy - 0.14,
      canopy + 0.04,
      0.03,
      setback,
      dark,
    );
    if (i % 2 === 0)
      fbox(
        out,
        'frame',
        entry,
        u - 0.094,
        u + 0.094,
        floor,
        canopy - 0.02,
        setback - 0.18,
        setback,
        dark,
      );
  }
}

function domePoints(detail) {
  if (detail === 0) return outline.filter((_, i) => i % 2 === 0);
  const split = detail > 1 ? 3 : 2;
  return outline.flatMap(([x, z], i) => {
    const [a, b] = outline[(i + 1) % outline.length];
    return Array.from({ length: split }, (_, j) => [
      x + ((a - x) * j) / split,
      z + ((b - z) * j) / split,
    ]);
  });
}

function ringAt(points, r, y) {
  return points.map(([x, z]) => [cx + (x - cx) * r, y, cz + (z - cz) * r]);
}

function buildDome(out, detail) {
  const { profile, height } = site.dome,
    points = domePoints(detail);
  const [first, galleryRoof, ...tiers] = profile;
  const lower = outwardRing(outline);
  for (const [i, a] of lower.entries()) {
    const f = wallFace(a, lower[(i + 1) % lower.length]);
    wall(out, 'wall', f, site.podium.base, 3.34, -0.03, concrete);
    wall(out, 'windows', f, 3.34, first[0] + 0.02, -0.16, glazing);
  }
  const drain = ringAt(points, 0.91, first[0]),
    lowerRail = ringAt(points, 0.989, galleryRoof[0]);
  loft(
    out,
    'windows',
    [ringAt(points, 0.84, first[0]), ringAt(points, 0.84, galleryRoof[0] + 0.04)],
    inner,
    { cap: false },
  );
  if (detail) {
    const stride = detail > 1 ? 2 : 3;
    for (let i = 0; i < drain.length; i += stride) {
      const j = (i + stride) % drain.length,
        k = (i + Math.floor(stride / 2)) % drain.length;
      beam(out, 'frame', drain[i], lowerRail[k], 0.15, 0.22, silver);
      beam(out, 'frame', lowerRail[k], drain[j], 0.15, 0.22, grey);
    }
  }

  const walls = [galleryRoof, ...tiers];
  for (const [[y0, r0], [y1, r1]] of walls.slice(0, -1).map((p, i) => [p, walls[i + 1]])) {
    const low = ringAt(points, r0 * 0.965, y0),
      high = ringAt(points, r1 * 0.985, y1);
    for (const [i, a] of low.entries()) {
      const j = (i + 1) % low.length;
      quad4(out, 'skin', a, low[j], high[j], high[i], skins[i % skins.length]);
      if (detail > 1 && i % (detail === 2 ? 4 : 2) === 0)
        beam(out, 'frame', a, high[j], 0.042, 0.032, underside);
    }
  }
  for (const [i, [y, r]] of walls.entries()) {
    const flange = ringAt(points, r, y + 0.075),
      rim = ringAt(points, r + 0.006, y - 0.152);
    loft(out, 'rims', [rim, flange], i % 2 === 0 ? silver : underside, { cap: false });
    if (detail) {
      loft(out, 'frame', [ringAt(points, r * 0.955, y - 0.16), rim], underside, { cap: false });
      if (detail === 3)
        loft(out, 'rims', [flange, ringAt(points, r * 0.974, y + 0.178)], grey, { cap: false });
    }
  }
  const [roof, radius] = walls.at(-1),
    top = ringAt(points, radius * 0.93, roof + 0.22);
  cap(
    out,
    'roof',
    top.map(([x, , z]) => [x, z]),
    roof + 0.22,
    roofTone,
  );
  beam(out, 'frame', [cx, roof + 0.11, cz], [cx, height, cz], 0.089, 0.091, grey);
  if (detail > 1) {
    for (let i = 0; i < top.length; i += Math.floor(top.length / 5))
      beam(out, 'frame', top[i], [cx, roof + 1.28, cz], 0.065, 0.061, grey);
  }
}

function build(out, detail) {
  buildPavilion(out, detail);
  buildDome(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
