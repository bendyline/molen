import { withFootprintCaps } from '../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  fbox,
  lathe,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const limestone = rgb('b1a995');
const rubble = rgb('a09f8c');
const weathered = rgb('938f7a');
const moss = rgb('858b66');
const stoneTints = [limestone, rubble, weathered, rgb('bdb4a0'), rgb('a4967c')];
const point = ([x, z], y) => [x, y, z];
const plan = ([x, , z]) => [x, z];
const between = (a, b, t) => a.map((value, i) => value + (b[i] - value) * t);

function wallRing(ring, grade, part, height, detail) {
  const step = [12, 6, 3, 2.2][detail];
  return ring.flatMap((a, index) => {
    const b = ring[(index + 1) % ring.length];
    const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const divisions = Math.max(1, Math.ceil(span / step));
    return Array.from({ length: divisions }, (_, i) => {
      const p = between(a, b, i / divisions);
      const y = grade(p);
      const breakage = part.fragmented ? 0.22 : 0.085;
      const phase = p[0] * 0.19 + p[1] * 0.32;
      return { p, base: y - part.embed, top: y + height * (1 + breakage * Math.sin(phase)) };
    });
  });
}

function faceStones(out, a, b, slot, detail, part) {
  const face = wallFace(a.p, b.p);
  const width = face.length;
  if (width < 0.24) return;
  const blockWidth = detail === 3 ? 0.67 : 1.42;
  const columns = Math.max(
    1,
    Math.round(width / (part.fragmented ? blockWidth * 1.16 : blockWidth)),
  );
  const rows = Math.max(1, Math.round(part.height / (detail === 3 ? 0.35 : 0.67)));
  const depth = detail === 3 ? 0.056 : 0.037;
  for (let row = 0; row < rows; row++) {
    const offset = row % 2 ? 0.47 : 0;
    for (let column = 0; column < columns + Math.ceil(offset); column++) {
      const left = Math.max(0, ((column - offset) * width) / columns) + 0.024;
      const right = Math.min(width, ((column + 1 - offset) * width) / columns) - 0.024;
      if (right - left < 0.12) continue;
      const t = (left + right) / (2 * width);
      const top = between([a.top], [b.top], t)[0];
      const tread = part.height / rows;
      const y = top - (rows - row) * tread + 0.03;
      const phase = Math.abs(Math.floor(a.p[0] * 5 + a.p[1] * 7 + row * 7 + column * 3));
      const color =
        part.fragmented && phase % 7 === 0 ? moss : stoneTints[phase % stoneTints.length];
      fbox(out, slot, face, left, right, y, y + tread * 0.87, -0.08, depth, color);
    }
  }
}

function walls(out, part, grade, detail) {
  const rings = [
    outwardRing(part.rings[0]),
    ...part.rings.slice(1).map((r) => outwardRing(r).reverse()),
  ];
  const color = part.fragmented ? rubble : limestone;
  const slot = part.fragmented ? 'rubble' : 'masonry';
  const crest = rings.map((ring) => wallRing(ring, grade, part, part.height, detail));
  const faces = crest.map((ring) => ring.map(({ p }) => p));
  const heights = new Map(crest.flat().map(({ p, top }) => [p.join(','), top]));
  const surface = withFootprintCaps(out);
  if (
    !surface.addCap(
      'rubble',
      '',
      faces[0],
      faces.slice(1),
      (p) => heights.get(p.join(',')),
      [0, 1, 0],
      (p) => p,
      weathered,
    )
  ) {
    throw new Error(`Could not triangulate ruin wall ${part.name}`);
  }
  for (const ring of crest) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      if (Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1]) < 0.002) continue;
      quad4(
        out,
        slot,
        point(a.p, a.base),
        point(b.p, b.base),
        point(b.p, b.top),
        point(a.p, a.top),
        color,
      );
      if (detail > 1 && part.height >= 0.24) faceStones(out, a, b, slot, detail, part);
    }
  }
}

function stonePath(out, path, grade, detail) {
  const frame = wallFace(path.start, path.end);
  const passes = [1, Math.ceil(path.treads / 3), path.treads, path.treads][detail];
  const count = detail < 2 ? 1 : path.rows;
  for (let i = 0; i < passes; i++) {
    const from = (i * frame.length) / passes;
    const to = ((i + 1) * frame.length) / passes;
    for (let row = 0; row < count; row++) {
      const d0 = path.width * (row / count - 0.5);
      const d1 = d0 + path.width / count;
      const grounds = [from, to].map((u) =>
        Math.max(grade(plan(frame.P(u, 0, d0))), grade(plan(frame.P(u, 0, d1)))),
      );
      const rise = detail > 0 ? 0.055 : 0;
      const gap = detail > 1 ? 0.017 : 0;
      const y0 = grounds[0] + path.reveal + rise;
      const y1 = grounds[1] + path.reveal + rise;
      const padY = Math.min(...grounds) - 0.24;
      const tint = path.fragmented && (i + row * 3) % 7 < 2 ? moss : stoneTints[(i + row * 3) % 5];
      const a = frame.P(from + gap, detail < 2 ? y0 : Math.max(y0, y1), d0 + gap);
      const b = frame.P(to - gap, detail < 2 ? y1 : a[1], d0 + gap);
      const c = frame.P(to - gap, b[1], d1 - gap);
      const d = frame.P(from + gap, a[1], d1 - gap);
      const slot = path.fragmented ? 'rubble' : 'masonry';
      quad4(out, slot, a, d, c, b, tint);
      for (const [p, q] of [
        [a, b],
        [b, c],
        [c, d],
        [d, a],
      ]) {
        quad4(out, slot, point(plan(q), padY), point(plan(p), padY), p, q, tint);
      }
    }
  }
}

function markers(out, site, grade, detail) {
  for (const { p, radius, height, grass } of site.stones) {
    const y = grade(p);
    lathe(
      out,
      'rubble',
      p,
      [
        [y - 0.14, radius, radius * 0.82],
        [y + height * 0.68, radius * 0.93, radius * 0.79],
        [y + height, radius * 0.72, radius * 0.65],
      ],
      [5, 6, 8, 10][detail],
      grass ? moss : rubble,
      { capBottom: false },
    );
  }
}

export function dacianFortressGeometry(site) {
  const { origin, spacing, columns, heights } = site.gradeGrid;
  const grade = ([x, z]) => {
    const u = (x - origin[0]) / spacing;
    const v = (z - origin[1]) / spacing;
    const col = Math.floor(u);
    const row = Math.floor(v);
    const at = row * columns + col;
    const a = u - col;
    const b = v - row;
    return between(
      [heights[at] * (1 - a) + heights[at + 1] * a],
      [heights[at + columns] * (1 - a) + heights[at + columns + 1] * a],
      b,
    )[0];
  };
  const build = (out, detail) => {
    for (const part of site.walls) walls(out, part, grade, detail);
    for (const path of site.stonePaths) stonePath(out, path, grade, detail);
    markers(out, site, grade, detail);
  };
  const buildSkyline = (out) => build(out, 0);
  const buildDistrict = (out) => build(out, 1);
  const buildStreet = (out) => build(out, 2);
  const buildCloseup = (out) => build(out, 3);
  const surfaces = {
    masonry: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.97 },
    rubble: { slot: 'trim', graph: 'stone_drywall', roughness: 0.98 },
  };
  return {
    surfaces,
    buildSkyline,
    buildDistrict,
    buildStreet,
    buildCloseup,
    buildMaster: buildCloseup,
  };
}
