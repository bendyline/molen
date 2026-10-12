/** Current exterior derivative; preserve the original Turku recipe and its provisional datum. */
import { readFileSync } from 'node:fs';
import { normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, prepareOpening } from './authored-wall-openings.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';
import { buildTurkuPart, turkuParts, turkuSurfaces } from './turku-castle-model.mjs';

const read = (p) => JSON.parse(readFileSync(structureSourcePath('n0305_turku_castle', p)));
const frame = read('map-frame.json'),
  relief = read('terrain-grid.json'),
  k = frame.controls;
export const turkuCurrentRuntimeAssetId = 'molen.worldgen.structure.n0305_turku_castle';
export const turkuCurrentSurfaces = {
  ...turkuSurfaces,
  masonry: { ...turkuSurfaces.masonry, graph: 'stone_drywall' },
  glass: { ...turkuSurfaces.glass, localRef: 'palette:#ffffff' },
};
const inner = relief.courtLevels[0].heightMeters - relief.modelDatumElevationMeters;
const means = read('surface-means.json');
const raw = (id) => frame.geometry.rawFeatures.find((f) => f.id === id).points;
export function turkuGround(x, z) {
  const u = (x - relief.origin[0]) / relief.stepMeters,
    v = (z - relief.origin[1]) / relief.stepMeters;
  const c = Math.max(0, Math.min(relief.size[0] - 2, Math.floor(u))),
    r = Math.max(0, Math.min(relief.size[1] - 2, Math.floor(v)));
  const dx = Math.max(0, Math.min(1, u - c)),
    dz = Math.max(0, Math.min(1, v - r)),
    h = relief.heightsMeters;
  return (
    (1 - dx) * (1 - dz) * h[r][c] +
    dx * (1 - dz) * h[r][c + 1] +
    (1 - dx) * dz * h[r + 1][c] +
    dx * dz * h[r + 1][c + 1] -
    relief.modelDatumElevationMeters
  );
}
function shifted(out, base, detail, lowerWalls = true) {
  return {
    addTriangle(slot, ref, p, _n, uv, color) {
      const q = p.map(([x, y, z]) =>
        [
          x,
          lowerWalls && Math.abs(y) < 0.025 ? Math.min(base, turkuGround(x, z) - 0.35) : y + base,
          z,
        ].map(Math.fround),
      );
      const n = normalFor(...q);
      if (Math.hypot(...n) < 0.5) return;
      // The flat level uses the current irregular-stone graph's measured mean.
      if (detail === 0 && slot === 'masonry')
        color = color.map((v, i) => (v / means.masonry[i]) * relief.currentStoneMean[i]);
      out.addTriangle(slot, ref, q, n, uv, color);
    },
  };
}
function holes(id) {
  return k.passages
    .filter((p) => p.parts.includes(id))
    .map((p) => {
      const line = raw(p.way),
        a = line[0],
        b = line.at(-1),
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return prepareOpening(
        {
          ...p,
          center: a.map((v, i) => (v + b[i]) / 2),
          axis: [-(b[1] - a[1]) / len, (b[0] - a[0]) / len],
          depth: len + 10,
          bottom: -0.02,
          shape: 'round',
        },
        0,
        0,
      );
    });
}
function coarsePlaster(out, id) {
  const c = k.buildingParts[id],
    split = Math.min(c.height - c.roofRise - 1.5, (c.height - c.roofRise) * 0.64),
    triangles = [];
  buildTurkuPart(
    {
      addTriangle(slot, ref, p, n, uv, color) {
        if (
          slot === 'plaster' &&
          p.every((q) => q[1] > 1 && q[1] < split + 0.001) &&
          Math.abs(n[1]) < 0.001
        )
          triangles.push({ p, n, color, ref });
      },
    },
    id,
    3,
  );
  // Original six-sided plaster islands each emit four triangles. Their coarse rectangles
  // retain the same dominant coverage, with original gate apertures cut out explicitly.
  if (triangles.length % 4)
    throw new Error('Turku plaster sequence changed; re-review coarse islands');
  const apertures = holes(id),
    clipped = openingBuilder(out, apertures);
  const cut = {
    addTriangle(slot, ref, p, n, uv, color) {
      const overlap = apertures.some(
        (h) =>
          !h.planes.some((plane) =>
            p.every((v) => v.reduce((s, x, k) => s + x * plane[k], plane[3]) < -1e-7),
          ),
      );
      (overlap ? clipped : out).addTriangle(slot, ref, p, n, uv, color);
    },
  };
  for (let i = 0; i < triangles.length; i += 4) {
    const group = triangles.slice(i, i + 4),
      n = group[0].n,
      tangent = [-n[2], 0, n[0]],
      pts = group.flatMap((t) => t.p);
    const project = (p) => p.reduce((s, v, k) => s + v * tangent[k], 0),
      us = pts.map(project),
      ys = pts.map((p) => p[1]);
    const lo = Math.min(...us),
      hi = Math.max(...us),
      bottom = Math.min(...ys),
      top = Math.max(...ys),
      a = pts[0],
      u = project(a);
    const corner = (v, y) => a.map((x, k) => (k === 1 ? y : x + tangent[k] * (v - u)));
    const polygon = [corner(lo, bottom), corner(hi, bottom), corner(hi, top), corner(lo, top)];
    if (normalFor(...polygon.slice(0, 3)).reduce((s, v, k) => s + v * n[k], 0) < 0)
      polygon.reverse();
    const color = group[0].color.map((v, k) => v * means.plaster[k]);
    for (let j = 1; j < 3; j++)
      cut.addTriangle(
        'plaster',
        group[0].ref,
        [polygon[0], polygon[j], polygon[j + 1]],
        n,
        [
          [0, 0],
          [0, 0],
          [0, 0],
        ],
        color,
      );
  }
}
function stairs(out, detail) {
  // Reconstructed eastern court connection: dimensions follow the mapped gate's exit.
  const a = [3.72, -1.5],
    b = [14, -2.9],
    len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tangent = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    side = [-tangent[1], tangent[0]];
  const count = detail === 0 ? 3 : detail === 1 ? 9 : 27;
  const color = [0.67, 0.64, 0.58];
  const point = (t, s, y) => [
    a[0] + t * (b[0] - a[0]) + s * side[0],
    y,
    a[1] + t * (b[1] - a[1]) + s * side[1],
  ];
  const face = (p) => {
    for (let j = 1; j < p.length - 1; j++) {
      const q = [p[0], p[j], p[j + 1]];
      out.addTriangle(
        'paving',
        'palette:#ffffff',
        q,
        normalFor(...q),
        q.map((p) => [p[0], p[2]]),
        color,
      );
    }
  };
  for (let i = 0; i < count; i++) {
    const top = inner * (1 - i / count),
      next = inner * (1 - (i + 1) / count),
      t = i / count,
      u = (i + 1) / count;
    face(
      [point(t, -1.5, top), point(u, -1.5, top), point(u, 1.5, top), point(t, 1.5, top)].reverse(),
    );
    face([point(u, -1.5, next), point(u, 1.5, next), point(u, 1.5, top), point(u, -1.5, top)]);
  }
}
export function buildTurkuCurrentRuntime(out, level = 'closeup') {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3;
  for (const id of [...k.mainWays, ...k.baileyWays, ...k.annexWays]) {
    const base = k.mainWays.includes(id) || k.buildingParts[id].material === 'main' ? inner : 0;
    const target = shifted(out, base, d);
    buildTurkuPart(target, id, d);
    if (!d && k.mainWays.includes(id)) coarsePlaster(target, id);
  }
  turkuParts.gallery(shifted(out, inner, d, false), d);
  for (const part of relief.courtLevels) {
    const points = raw(part.way);
    const base = part.heightMeters - relief.modelDatumElevationMeters;
    // Preserve original polygon triangulation without altering the historical authoring recipe.
    turkuParts.courtyards(
      {
        addTriangle(slot, ref, p, n, uv, c) {
          if (p.every((q) => points.some((v) => Math.hypot(v[0] - q[0], v[1] - q[2]) < 0.002)))
            out.addTriangle(
              slot,
              ref,
              p.map((q) => [q[0], q[1] + base, q[2]]),
              n,
              uv,
              c,
            );
        },
      },
      d,
    );
  }
  stairs(out, d);
  const west = raw(621623490),
    a = west[0],
    b = west.at(-1),
    length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const side = [-(b[1] - a[1]) / length, (b[0] - a[0]) / length];
  const board = [
    [a, -1],
    [b, -1],
    [b, 1],
    [a, 1],
  ].map(([p, s]) => [p[0] + side[0] * s * 1.4, inner + 0.025, p[1] + side[1] * s * 1.4]);
  if (normalFor(...board.slice(0, 3))[1] < 0) board.reverse();
  const wood = [0.376, 0.215, 0.09].map((v, i) => (d ? v : v * means.wood[i]));
  for (let i = 1; i < 3; i++) {
    const p = [board[0], board[i], board[i + 1]];
    out.addTriangle(
      'wood',
      'palette:#ffffff',
      p,
      normalFor(...p),
      p.map((p) => [p[0], p[2]]),
      wood,
    );
  }
}
export const buildTurkuCurrent = (out) => buildTurkuCurrentRuntime(out);
export const buildTurkuCurrentSkyline = (out) => buildTurkuCurrentRuntime(out, 'skyline');
export const buildTurkuCurrentDistrict = (out) => buildTurkuCurrentRuntime(out, 'district');
export const buildTurkuCurrentStreet = (out) => buildTurkuCurrentRuntime(out, 'street');
