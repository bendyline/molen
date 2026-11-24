import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  fan,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  archOver,
  cap,
  clock,
} from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  sandstone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.94 },
  trim: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.93 },
  base: { slot: 'foundation', graph: 'stone_basalt', roughness: 0.97 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.94 },
  crown: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.88 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.84 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.58 },
};

const sand = rgb('bcab8c'),
  cream = rgb('d1c2a4'),
  ochre = rgb('ac9c82'),
  rock = rgb('686763');
const slate = rgb('858981'),
  dome = rgb('989386'),
  deep = rgb('595b58'),
  glass = rgb('525957');
const { body, entrance, tower, eave } = site;
const portico = wallFace(entrance.from, entrance.to);
const edges = (ring) => outwardRing(ring).map((a, i, r) => wallFace(a, r[(i + 1) % r.length]));

function panel(out, slot, f, a, b, y0, y1, d, color) {
  const p = f.P;
  quad4(out, slot, p(a, y0, d), p(b, y0, d), p(b, y1, d), p(a, y1, d), color);
}

function strip(out, slot, f, y0, y1, d, color) {
  panel(out, slot, f, 0, f.length, y0, y1, d, color);
}

function hall(out, detail) {
  for (const f of edges(body)) {
    const street = f.normal[0] < -0.3 || f.normal[1] > 0.73;
    strip(out, 'base', f, site.foundation, 4.84, 0, rock);
    strip(out, 'sandstone', f, 4.84, eave, 0, sand);
    strip(out, 'trim', f, 4.76, 5.15, 0.15, ochre);
    strip(out, 'trim', f, 10.22, 10.49, 0.12, cream);
    strip(out, 'trim', f, 16.72, 17.03, 0.18, cream);
    strip(out, 'trim', f, eave - 0.48, eave, 0.25, cream);
    if (!detail) continue;
    const count = Math.max(2, Math.round(f.length / (detail > 1 ? 4.12 : 6.67)));
    for (let i = 0; i < count; i++) {
      const u = (f.length * (i + 0.5)) / count,
        width = Math.min(1.78, (f.length / count) * 0.54);
      const trim = detail > 1 ? 0.13 : 0;
      opening(out, f, u, byGrade(f, u) + 0.42, width, 3.11, {
        head: street && detail > 1 ? 'round' : 'flat',
        glassSlot: 'glazing',
        frameSlot: 'trim',
        glass,
        frame: rock,
        frameWidth: trim,
        d: 0.033,
      });
      opening(out, f, u, 6.24, width, 3.07, {
        glassSlot: 'glazing',
        frameSlot: 'trim',
        glass,
        frame: cream,
        frameWidth: trim,
        mullions: detail === 3 ? 1 : 0,
        d: 0.037,
      });
      opening(out, f, u, 11.66, width * (street ? 1.23 : 1), 3.55, {
        head: street && detail > 1 ? 'round' : 'flat',
        glassSlot: 'glazing',
        frameSlot: 'trim',
        glass,
        frame: cream,
        frameWidth: trim,
        transoms: detail === 3 ? 1 : 0,
        d: 0.043,
      });
      if (detail === 3 && i) {
        const x = (f.length * i) / count;
        fbox(out, 'trim', f, x - 0.105, x + 0.105, 10.49, 16.65, 0, 0.16, ochre);
      }
    }
  }
  cap(out, 'roof', body, eave - 0.025, slate);
  const mid = (a, b) => a.map((v, i) => (v + b[i]) / 2),
    left = mid(body[0], body[1]),
    right = mid(body[3], body[2]);
  const peak = (t) => [
    left[0] + (right[0] - left[0]) * t,
    site.hallRidge,
    left[1] + (right[1] - left[1]) * t,
  ];
  const [a, b, c, d] = body.map(([x, z]) => [x, eave, z]);
  const p = peak(0.15),
    q = peak(0.84);
  tri(out, 'roof', b, a, p, slate);
  quad4(out, 'roof', a, d, q, p, slate);
  tri(out, 'roof', d, c, q, slate);
  quad4(out, 'roof', c, b, p, q, slate);
  if (detail > 1) beam(out, 'roof', p, q, 0.19, 0.16, dome);
}

function byGrade(face, u) {
  const [x, , z] = face.P(u, 0);
  return Math.max(0, Math.min(3.14, 0.044 * (x + 20) + 0.028 * (z + 9)));
}

function porch(out, detail) {
  const f = portico,
    p = f.P,
    { depth, width, platform } = entrance;
  const floor = 5.82,
    capHeight = 16.3,
    top = 17.48,
    peak = 20.44;
  const arches = [3.03, 8.57, 14.07],
    radius = 2.05,
    spring = 2.91;
  const ends = [0, ...arches.flatMap((u) => [u - radius, u + radius]), width];
  for (let i = 0; i < ends.length; i += 2)
    fbox(out, 'base', f, ends[i], ends[i + 1], platform, 5.41, -1.18, 0.002, rock);
  for (const u of arches) {
    archOver(out, f, u, radius, spring, 5.41, 1.17, Math.max(1, detail));
    if (detail > 1) {
      const keystone = spring + radius - 0.12;
      fbox(out, 'trim', f, u - 0.13, u + 0.13, keystone, keystone + 0.48, 0.015, 0.16, cream);
    }
  }
  fbox(out, 'base', f, 0, width, platform - 0.3, platform, -depth, 0.015, rock);
  fbox(out, 'sandstone', f, 0, width, 5.41, floor, -depth, 0.12, sand, { bottom: true });
  fbox(out, 'trim', f, 0, width, 5.94, 6.2, -0.03, 0.24, cream);
  for (const u of [1.02, 6.12, 11.12, 16.11]) {
    const [x, , z] = p(u, 0, -0.45),
      pos = [x, z];
    fbox(out, 'trim', f, u - 0.65, u + 0.65, floor, 6.72, -1.06, 0.16, cream);
    lathe(
      out,
      'sandstone',
      pos,
      [
        [6.69, 0.49, 0.49],
        [7.32, 0.43, 0.43],
        [15.29, 0.38, 0.38],
        [15.65, 0.49, 0.49],
      ],
      [6, 8, 10, 12][detail],
      sand,
      { capTop: false },
    );
    fbox(out, 'trim', f, u - 0.61, u + 0.61, 15.63, capHeight, -1.04, 0.17, cream);
    if (detail > 1)
      for (const shift of [-0.35, 0.35])
        fbox(out, 'trim', f, u + shift - 0.08, u + shift + 0.08, 15.39, 16.08, -0.05, 0.204, ochre);
  }
  fbox(out, 'trim', f, -0.19, width + 0.19, capHeight, top, -depth, 0.27, cream, { bottom: true });
  const a = p(-0.24, top, 0.23),
    b = p(width + 0.24, top, 0.23),
    c = p(width * 0.5, peak, 0.23);
  const d = p(-0.24, top, -depth),
    e = p(width + 0.24, top, -depth),
    g = p(width * 0.5, peak, -depth);
  tri(out, 'sandstone', a, b, c, sand);
  quad4(out, 'roof', c, b, e, g, slate);
  quad4(out, 'roof', d, a, c, g, slate);
  for (const [from, to] of [
    [a, c],
    [c, b],
  ])
    beam(out, 'trim', from, to, 0.19, 0.23, cream);
  if (detail > 1)
    for (const [lo, hi] of [
      [1.62, 5.56],
      [6.74, 10.49],
      [11.74, 15.48],
    ]) {
      fbox(out, 'trim', f, lo, hi, 7.08, 7.24, -0.14, 0.18, cream);
      const n = Math.floor((hi - lo) / 0.5);
      for (let i = 0; i < n; i++) {
        const u = lo + ((hi - lo) * (i + 0.5)) / n;
        fbox(out, 'trim', f, u - 0.074, u + 0.074, 6.2, 7.12, -0.11, 0.06, ochre);
      }
    }
}

function ringAt(radius, y) {
  const [x, z] = tower.center,
    [u, w] = tower.along,
    [v, t] = tower.normal;
  return Array.from({ length: 8 }, (_, i) => {
    const angle = -Math.PI / 8 - (i * Math.PI) / 4,
      a = Math.cos(angle) * radius,
      b = Math.sin(angle) * radius;
    return [x + a * u + b * v, y, z + a * w + b * t];
  });
}

function clockTower(out, detail) {
  for (const f of edges(tower.base)) {
    const width = f.length,
      p = f.P;
    strip(out, 'sandstone', f, 15.82, 30.98, 0, sand);
    strip(out, 'trim', f, 20.94, 21.46, 0.25, cream);
    strip(out, 'trim', f, 24.08, 24.36, 0.18, cream);
    strip(out, 'trim', f, 29.54, 29.83, 0.18, cream);
    strip(out, 'trim', f, 30.13, 30.98, 0.24, cream);
    const y = tower.clock,
      r = 1.62;
    if (detail) clock(out, f, width * 0.5, y, r, detail, 0.29);
    else {
      const points = Array.from({ length: 12 }, (_, i) => {
        const a = (Math.PI * i) / 6;
        return p(width * 0.5 + r * Math.cos(a), y + r * Math.sin(a), 0.18);
      });
      fan(out, 'glazing', points, cream);
    }
    if (detail > 0) {
      for (const u of [0.77, width - 0.77])
        fbox(out, 'trim', f, u - 0.26, u + 0.26, 23.43, 29.74, 0.02, 0.32, ochre);
      opening(out, f, width * 0.5, 21.63, 1.51, 1.96, {
        glassSlot: 'glazing',
        frameSlot: 'trim',
        frame: cream,
        frameWidth: detail > 1 ? 0.11 : 0,
        glass: deep,
      });
    }
  }
  cap(out, 'trim', tower.base, 30.98, cream);
  const profile = [
    [30.97, 4.84],
    [31.66, 4.91],
    [32.06, 4.54],
    [33.0, 4.01],
    [34.5, 3.43],
    [35.85, 2.51],
    [36.62, 1.61],
  ];
  loft(
    out,
    'crown',
    profile.map(([y, r]) => ringAt(r, y)),
    dome,
    { cap: true },
  );
  const lantern = ringAt(1.18, 0).map(([x, , z]) => [x, z]);
  for (const f of edges(lantern)) {
    strip(out, 'sandstone', f, 36.55, 38.53, 0, cream);
    if (detail > 1 && f.length > 0.7)
      opening(out, f, f.length * 0.5, 36.97, 0.53, 1.11, {
        head: 'round',
        frameSlot: 'trim',
        glassSlot: 'glazing',
        frameWidth: 0.085,
        glass: deep,
        frame: ochre,
      });
  }
  loft(out, 'crown', [ringAt(1.32, 38.53), ringAt(0.71, 39.19), ringAt(0.16, 39.58)], dome);
  beam(
    out,
    'metal',
    [tower.center[0], 39.57, tower.center[1]],
    [tower.center[0], tower.height, tower.center[1]],
    0.087,
    0.087,
    deep,
  );
}

function build(out, detail) {
  hall(out, detail);
  porch(out, detail);
  clockTower(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
