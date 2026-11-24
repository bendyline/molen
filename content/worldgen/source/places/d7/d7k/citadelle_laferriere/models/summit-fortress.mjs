import { loft } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  fbox,
  gableRoof,
  opening,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  masonry: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.97 },
  footing: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
  trim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.96 },
  tiles: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.93 },
  opening: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.97 },
};
const stone = rgb('9c9691'),
  dark = rgb('817e76'),
  pale = rgb('b5afa4');
const ash = rgb('8d877c'),
  shadow = rgb('555049'),
  tile = rgb('896052'),
  patina = rgb('9c8b77');
const court = site.courtLevel;
const mean = (r) => r.reduce(([x, z], [a, b]) => [x + a / r.length, z + b / r.length], [0, 0]);

function pane(out, slot, F, a, b, y0, y1, d, color) {
  const p = F.P;
  quad4(out, slot, p(a, y0, d), p(b, y0, d), p(b, y1, d), p(a, y1, d), color);
}

function parapet(out, detail, r, y) {
  for (const [i, a] of r.entries()) {
    const f = wallFace(a, r[(i + 1) % r.length]);
    if (f.length < 0.06) continue;
    fbox(out, 'trim', f, 0, f.length, y - 0.12, y + 0.95, -0.8, 0.04, ash);
    if (detail > 1 && f.length > 7.4) {
      const n = Math.floor(f.length / (detail === 2 ? 6.8 : 4.9));
      for (let k = 0; k < n; k++) {
        const u = ((k + 0.52) * f.length) / n;
        fbox(out, 'masonry', f, u - 0.54, u + 0.54, y + 0.89, y + 1.29, -0.65, 0.025, stone);
      }
    }
  }
}

function frontWall(out, detail, a, b, c, d, y, z, color) {
  const f = wallFace(a, b);
  if (f.length < 0.03) return;
  const g = wallFace(c, d);
  const p = (u, h, n = 0) => {
    const rate = (h - y) / (z - y),
      l = f.P(u, h, n),
      r = g.P((u * g.length) / f.length, h, n);
    return [l[0] + (r[0] - l[0]) * rate, h, l[2] + (r[2] - l[2]) * rate];
  };
  const panel = (slot, a, b, lo, hi, depth, fill) =>
    quad4(out, slot, p(a, lo, depth), p(b, lo, depth), p(b, hi, depth), p(a, hi, depth), fill);
  panel('footing', 0, f.length, y, -1.08, 0, dark);
  if (detail < 2 || f.length < 8 || z < 14.1) {
    panel('masonry', 0, f.length, -1.08, z, 0, color);
    if (detail === 1 && f.length > 8)
      for (let i = 1; i < 3; i++) {
        const u = (f.length * i) / 3;
        panel('opening', u - 0.48, u + 0.48, z - 5.12, z - 3.91, 0.017, shadow);
      }
    return;
  }
  const rows = z > 21 ? [5.25, z - 7.14] : [z - 5.32];
  const bayCount = Math.max(2, Math.floor(f.length / [1, 1, 8.94, 6.14][detail]));
  const gap = f.length / bayCount;
  let prev = -1.08;
  for (const [i, h] of rows.entries()) {
    const tall = i === 0 ? 1.55 : 1.31;
    const radius = i === 0 ? 0.37 : 0.47;
    panel('masonry', 0, f.length, prev, h, 0, color);
    for (let j = 0; j < bayCount; j++) {
      const a = gap * j,
        b = gap * (j + 1),
        u = (a + b) * 0.5;
      panel('masonry', a, u - radius, h, h + tall, 0, color);
      panel('masonry', u + radius, b, h, h + tall, 0, color);
      panel('opening', u - radius, u + radius, h, h + tall, -0.58, shadow);
      quad4(
        out,
        'trim',
        p(u - radius, h, 0),
        p(u + radius, h, 0),
        p(u + radius, h, -0.58),
        p(u - radius, h, -0.58),
        ash,
      );
      quad4(
        out,
        'trim',
        p(u - radius, h, -0.58),
        p(u - radius, h, 0),
        p(u - radius, h + tall, 0),
        p(u - radius, h + tall, -0.58),
        dark,
      );
      quad4(
        out,
        'trim',
        p(u + radius, h, 0),
        p(u + radius, h, -0.58),
        p(u + radius, h + tall, -0.58),
        p(u + radius, h + tall, 0),
        dark,
      );
      if (detail > 2)
        panel(
          'trim',
          u - radius - 0.08,
          u + radius + 0.08,
          h + tall,
          h + tall + 0.17,
          0.062,
          patina,
        );
    }
    prev = h + tall;
  }
  panel('masonry', 0, f.length, prev, z, 0, color);
}

function summitBlock(out, detail, { name, outline, height }) {
  const foot = outwardRing(outline);
  const [cx, cz] = mean(foot);
  const prow = name === 'prow';
  const crown = foot.map(([x, z]) => {
    if (prow) {
      const advance = Math.max(0, x - 111.1);
      return [x - advance * 0.226, z + advance * 0.115];
    }
    return [x * 0.97 + cx * 0.03, z * 0.97 + cz * 0.03];
  });
  for (const [i, a] of foot.entries()) {
    const j = (i + 1) % foot.length;
    frontWall(
      out,
      detail,
      a,
      foot[j],
      crown[i],
      crown[j],
      site.foundationBottom,
      height,
      i % 5 === 2 ? patina : stone,
    );
  }
  cap(out, 'footing', crown, height, pale);
  if (detail > 0) parapet(out, detail, crown, height);
}

function wing(out, detail, { id, height, roofRise, outline }) {
  const r = outwardRing(outline);
  let longest;
  for (const [i, a] of r.entries()) {
    const f = wallFace(a, r[(i + 1) % r.length]);
    if (f.length < 0.03) continue;
    if (!longest || longest.length < f.length) longest = f;
    pane(out, 'masonry', f, 0, f.length, court - 0.3, height, 0, stone);
    if (detail === 0 || f.length < 4.0) continue;
    const n = Math.floor(f.length / [1, 6.5, 5.0, 4.2][detail]);
    for (let j = 0; j < n; j++) {
      const u = ((j + 0.5) * f.length) / n;
      pane(out, 'opening', f, u - 0.62, u + 0.62, height - 4.9, height - 3.09, 0.02, shadow);
      if (detail > 1)
        opening(out, f, u, court + 0.05, 1.29, 2.41, {
          head: 'round',
          glassSlot: 'opening',
          frameSlot: 'trim',
          glass: shadow,
          frame: ash,
          d: 0.044,
          frameWidth: 0.098,
          frameDepth: 0.085,
          sill: false,
        });
    }
    fbox(out, 'trim', f, 0, f.length, height - 0.32, height, -0.17, 0.097, patina);
  }
  cap(out, 'masonry', r, height, ash);
  if (id === 220820145) {
    if (detail > 0) parapet(out, detail, r, height);
  } else {
    const f = longest;
    const [x, z] = mean(r);
    const c = (x - f.origin[0]) * f.normal[0] + (z - f.origin[1]) * f.normal[1];
    const at = (u, d) => {
      const p = f.P(u, 0, d);
      return [p[0], p[2]];
    };
    gableRoof(
      out,
      'tiles',
      at(0.12, c),
      at(f.length - 0.12, c),
      Math.abs(c) * 2,
      height,
      height + roofRise,
      tile,
      { overhang: 0.1, endSlot: 'masonry', endColor: stone },
    );
  }
}

function ruins(out, detail) {
  for (const { grade, height, outline } of site.outworks) {
    const r = outwardRing(outline);
    cap(out, 'footing', r, grade + 0.13, ash);
    for (const [i, a] of r.entries()) {
      const f = wallFace(a, r[(i + 1) % r.length]);
      const h = grade + height - (i % 4) * 0.27;
      if (detail < 2) {
        fbox(out, 'masonry', f, 0, f.length, grade - 2.95, h, -0.9, 0.04, stone);
        continue;
      }
      const n = Math.max(1, Math.round(f.length / 3.1));
      for (let j = 0; j < n; j++) {
        const a = (j * f.length) / n,
          b = ((j + 1) * f.length) / n;
        if (i === 0 && j === n - 1)
          fbox(out, 'masonry', f, a, b, grade - 2.95, grade + 0.4, -0.9, 0.04, stone);
        else
          fbox(
            out,
            'masonry',
            f,
            a,
            b,
            grade - 2.95,
            h - (j % 3) * 0.46,
            -0.9,
            0.04,
            j % 2 ? patina : stone,
          );
      }
    }
  }
  for (const [i, { points }] of site.walls.entries())
    for (let j = 1; j < points.length; j++) {
      const [a, b] = [points[j - 1], points[j]],
        f = wallFace(a, b);
      const lift = (p) => (i === 0 ? 3.9 - (p[0] - 95) * 0.17 : -4.8 - (p[1] - 78) * 0.095);
      const l = lift(a),
        r = lift(b),
        P = f.P;
      quad4(
        out,
        'masonry',
        P(0, l - 9.91, 0.6),
        P(f.length, r - 9.91, 0.6),
        P(f.length, r, 0.6),
        P(0, l, 0.6),
        patina,
      );
      quad4(
        out,
        'masonry',
        P(f.length, r - 9.91, -0.63),
        P(0, l - 9.91, -0.63),
        P(0, l, -0.63),
        P(f.length, r, -0.63),
        stone,
      );
      quad4(
        out,
        'trim',
        P(0, l, 0.6),
        P(f.length, r, 0.6),
        P(f.length, r, -0.63),
        P(0, l, -0.63),
        ash,
      );
    }
}

function terrace(out, detail) {
  cap(out, 'footing', site.court, court, pale);
  const paths = [
    [site.gate, [44.82, 73.82], -3.96],
    [site.eastGate, [128.6, -22.38], -5.66],
  ];
  for (const [start, end, bottom] of paths) {
    const f = wallFace(start, end),
      n = [3, 5, 9, 13][detail];
    for (let i = 0; i < n; i++) {
      const a = (i * f.length) / n,
        b = ((i + 1) * f.length) / n;
      const h = court - ((court - bottom) * (i + 1)) / n;
      fbox(out, 'footing', f, a, b, bottom - 2.9, h, -1.18, 1.18, i % 3 === 0 ? ash : pale);
    }
  }
}

function build(out, detail) {
  for (const s of site.sections) summitBlock(out, detail, s);
  for (const w of site.ranges) wing(out, detail, w);
  terrace(out, detail);
  ruins(out, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
