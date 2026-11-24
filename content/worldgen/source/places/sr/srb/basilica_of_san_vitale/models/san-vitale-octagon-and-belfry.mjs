import { openArcade } from '../../../../../../../../packages/worldgen/scripts/courtyard-landmark-geometry.mjs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  extrude,
  facade,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import plan from '../basilica-plan.json' with { type: 'json' };

export const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.91 },
  darkerBrick: { slot: 'trim', graph: 'clay_fired', roughness: 0.92 },
  marble: { slot: 'trim', graph: 'stone_limestone', roughness: 0.86 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.89 },
  metal: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.72, metallic: 0.16 },
  window: {
    slot: 'window',
    localRef: 'palette:#ffffff',
    name: 'ravenna-window-shadow',
    roughness: 0.87,
  },
};
const brick = rgb('b8a18a'),
  sunBrick = rgb('c3aa90'),
  darker = rgb('ab8d74'),
  cut = rgb('c0a386');
const terracotta = rgb('ac7b63'),
  marble = rgb('d4c7b2'),
  lead = rgb('a0a49b');
const window = rgb('676758'),
  door = rgb('57645d');
const center = (r) => r.reduce(([x, z], p) => [x + p[0] / r.length, z + p[1] / r.length], [0, 0]);
const contract = (ring, c, k) => ring.map((p) => p.map((x, i) => c[i] + (x - c[i]) * k));
const point = (r, y) => [r[0], y, r[1]];
const walls = (ring) => {
  const r = outwardRing(ring);
  return r.map((p, i) => wallFace(p, r[(i + 1) % r.length]));
};
const rotation = Math.atan2(plan.clerestoryDirection[1], plan.clerestoryDirection[0]);
function roofs(out, outer, c, low, high, scale, slot = 'roof', tone = terracotta) {
  const r = outwardRing(contract(outer, c, 1.021)),
    crest = contract(r, c, scale);
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length;
    quad4(
      out,
      slot,
      point(r[i], low),
      point(r[j], low),
      point(crest[j], high),
      point(crest[i], high),
      tone,
    );
  }
  return crest;
}
function façadeCourses(out, ring, level, base, y, eave) {
  for (const [i, face] of walls(ring).entries()) {
    const bays = face.length > 13 ? 3 : 2;
    if (level)
      for (let n = 0; n < bays; n++) {
        const u = (face.length * (n + 0.5)) / bays;
        const w = Math.min(1.58, face.length / (bays * 2.8));
        for (const [at, h] of [
          [base, 3.42],
          [y, 3.48],
        ]) {
          opening(out, face, u, at, w, h, {
            head: 'round',
            glassSlot: 'window',
            glass: window,
            frameSlot: 'darkerBrick',
            frame: cut,
            frameWidth: level > 1 ? 0.18 : 0,
            sill: level > 1,
            mullions: level > 1 ? 1 : 0,
            transoms: level > 2 ? 3 : 0,
            frameDepth: 0.118,
            d: 0.028,
          });
        }
        if (level > 1 && n < bays - 1) {
          const p = (face.length * (n + 1)) / bays;
          fbox(
            out,
            'brick',
            face,
            p - 0.257,
            p + 0.293,
            0.06,
            eave - 0.14,
            -0.07,
            0.318,
            (i + n) % 2 ? brick : sunBrick,
          );
        }
      }
    if (level)
      for (const h of [6.91, 7.11, eave - 0.22]) {
        fbox(out, 'darkerBrick', face, 0, face.length, h, h + 0.16, -0.06, 0.153, darker);
      }
    if (level > 2)
      for (let u = 0.17; u < face.length - 0.15; u += 0.39)
        fbox(out, 'marble', face, u, u + 0.147, eave - 0.355, eave - 0.234, -0.04, 0.236, cut);
  }
}
function body(out, level) {
  const ring = plan.octagon,
    c = plan.centroid,
    eave = 13.95;
  extrude(out, 'brick', ring, -1.25, eave, brick);
  const drum = contract(ring, c, 0.646);
  roofs(out, ring, c, eave + 0.06, 16.33, 0.654);
  extrude(out, 'brick', drum, 15.76, 21.86, sunBrick);
  roofs(out, drum, c, 21.86, 24.67, 0.075);
  const cap = contract(drum, c, 0.14);
  extrude(out, 'roof', cap, 24.58, 24.76, terracotta);
  if (level) {
    façadeCourses(out, ring, level, 2.3, 8.64, eave);
    for (const f of walls(drum)) {
      opening(out, f, f.length * 0.5, 17.18, 2.53, 3.87, {
        head: 'round',
        glassSlot: 'window',
        glass: window,
        frameSlot: 'darkerBrick',
        frame: cut,
        frameWidth: level > 1 ? 0.3 : 0,
        sill: level > 1,
        mullions: level > 1 ? 2 : 0,
        frameDepth: 0.142,
        d: 0.038,
        transoms: level > 2 ? 3 : 0,
      });
      fbox(out, 'darkerBrick', f, 0, f.length, 21.68, 21.82, -0.07, 0.17, darker);
    }
  }
}
function lowerWing(out, ring, level, grade, eave, ridge, color = brick) {
  extrude(out, 'brick', ring, grade - 1.34, eave, color);
  const c = center(ring);
  const cap = roofs(out, ring, c, eave, eave + ridge, 0.57);
  extrude(out, 'roof', cap, eave + ridge - 0.08, eave + ridge + 0.005, terracotta);
  if (level)
    for (const f of walls(ring)) {
      if (f.length < 3.1) continue;
      const count = Math.max(1, Math.floor(f.length / 6.5));
      for (let i = 0; i < count; i++) {
        opening(
          out,
          f,
          (f.length * (i + 0.5)) / count,
          grade + 2.81,
          Math.min(f.length * 0.27, 1.16),
          2.23,
          {
            head: 'round',
            glassSlot: 'window',
            glass: window,
            frameSlot: 'darkerBrick',
            frame: cut,
            frameWidth: level > 1 ? 0.136 : 0,
            sill: false,
            d: 0.043,
            mullions: level > 1 ? 1 : 0,
          },
        );
      }
    }
}
function classicalEntry(out, edge, grade, level) {
  const [a, c, b] = edge;
  let v = wallFace(a, b).along;
  const ray = [-v[1], v[0]],
    toward = c.map((p, i) => p - plan.centroid[i]);
  if (ray[0] * toward[0] + ray[1] * toward[1] < 0) v = v.map((x) => -x);
  const f = facade(c, v),
    w = 1.45;
  fbox(out, 'marble', f, -1.77, 1.77, grade - 0.18, grade + 0.19, -0.38, 0.64, marble);
  fbox(out, 'window', f, -w, w, grade + 0.17, grade + 3.28, -0.032, 0.094, door);
  for (const u of [-w, w]) {
    fbox(out, 'marble', f, u - 0.17, u + 0.17, grade + 0.15, grade + 3.47, -0.022, 0.37, marble);
    if (level > 1)
      fbox(
        out,
        'darkerBrick',
        f,
        u - 0.088,
        u + 0.088,
        grade + 0.27,
        grade + 3.15,
        0.29,
        0.39,
        cut,
      );
  }
  fbox(out, 'marble', f, -w - 0.28, w + 0.28, grade + 3.27, grade + 3.66, -0.033, 0.423, marble);
  opening(out, f, 0, grade + 3.67, 2.82, 1.63, {
    head: 'round',
    glassSlot: 'window',
    glass: window,
    frameSlot: 'marble',
    frame: marble,
    frameWidth: level > 1 ? 0.161 : 0.08,
    sill: false,
    frameDepth: 0.31,
    d: 0.064,
    mullions: level > 1 ? 3 : 0,
    transoms: level > 2 ? 2 : 0,
  });
  if (level > 2)
    for (const u of [-0.64, 0.64])
      for (const h of [0.9, 1.5, 2.1, 2.7])
        fbox(
          out,
          'darkerBrick',
          f,
          u - 0.43,
          u + 0.43,
          grade + h - 0.22,
          grade + h + 0.16,
          0.092,
          0.115,
          door,
        );
}

function belfry(out, level) {
  const { center: c, radius: r } = plan.tower,
    sides = level > 1 ? 20 : 12;
  const start = 0.49,
    y = 23.23,
    ringTop = 29.55;
  lathe(
    out,
    'brick',
    c,
    [
      [start - 1.63, r, r],
      [start + 0.06, r, r],
      [y - 0.61, r * 0.949, r * 0.949],
      [y, r * 0.977, r * 0.977],
    ],
    sides,
    brick,
    { rotation },
  );
  const shell = Array.from({ length: 12 }, (_, i) => {
    const a = rotation + (i * Math.PI) / 6;
    return [c[0] + r * 0.988 * Math.cos(a), c[1] + r * 0.988 * Math.sin(a)];
  });
  const shellWalls = walls(shell);
  if (!level) extrude(out, 'brick', shell, y, ringTop, sunBrick);
  else
    for (const [i, f] of shellWalls.entries()) {
      if (i % 2 === 0)
        openArcade(out, f, {
          count: 1,
          bottom: y,
          top: ringTop - 0.19,
          spring: 27.56,
          depth: 0.42,
          slot: 'brick',
          color: sunBrick,
          steps: level > 1 ? 7 : 3,
          openRatio: 0.32,
        });
      else {
        fbox(out, 'brick', f, 0, f.length, y, ringTop - 0.19, -0.41, 0, brick);
        if (level > 1)
          opening(out, f, f.length * 0.52, y + 0.72, f.length * 0.62, 4.74, {
            head: 'round',
            glassSlot: 'darkerBrick',
            glass: darker,
            frameSlot: 'marble',
            frame: cut,
            frameWidth: 0.085,
            sill: false,
            frameDepth: 0.147,
            d: 0.022,
          });
      }
    }
  lathe(
    out,
    'marble',
    c,
    [
      [ringTop - 0.21, r * 1.014, r * 1.014],
      [ringTop, r * 1.043, r * 1.043],
      [ringTop + 0.312, r * 1.051, r * 1.051],
      [ringTop + 0.47, r * 0.986, r * 0.986],
    ],
    sides,
    cut,
    { rotation },
  );
  lathe(
    out,
    'metal',
    c,
    [
      [ringTop + 0.46, r * 0.999, r * 0.999],
      [31.77, r * 0.845, r * 0.845],
      [33.34, r * 0.49, r * 0.49],
      [34.54, r * 0.14, r * 0.14],
      [34.93, r * 0.051, r * 0.051],
    ],
    sides,
    lead,
    { rotation },
  );
  if (level) {
    const f = facade(c, plan.clerestoryDirection);
    fbox(out, 'metal', f, -0.034, 0.034, 34.9, 36.34, -0.038, 0.036, lead);
    fbox(out, 'metal', f, -0.413, 0.413, 35.76, 35.83, -0.037, 0.035, lead);
  }
}
function flyingPier(out, { head, foot, width, outer, inner }, level) {
  const f = wallFace(foot, head),
    d = width * 0.5,
    p = f.P;
  const steps = level > 1 ? 9 : 4;
  const shape = (t) => [
    outer + (inner - outer) * Math.sin(t * Math.PI * 0.5),
    outer -
      0.68 +
      (inner - outer) * (1 - (1 - t) * (1 - t) * (1 - t)) -
      (inner - outer) * t * (1 - t) * 0.78 -
      1.22 * t,
  ];
  const support = (t) => {
    const [crest, under] = shape(t);
    return [crest, Math.min(under, crest - 0.59)];
  };
  fbox(out, 'brick', f, -0.38, 0.71, -1.53, outer, -d - 0.22, d + 0.22, darker);
  for (let i = 0; i < steps; i++) {
    const a = (i * f.length) / steps,
      b = ((i + 1) * f.length) / steps,
      [Y, y] = support(i / steps),
      [Z, z] = support((i + 1) / steps);
    quad4(out, 'brick', p(a, y, d), p(b, z, d), p(b, Z, d), p(a, Y, d), darker);
    quad4(out, 'brick', p(b, z, -d), p(a, y, -d), p(a, Y, -d), p(b, Z, -d), brick);
    quad4(out, 'darkerBrick', p(a, y, -d), p(b, z, -d), p(b, z, d), p(a, y, d), cut);
    quad4(out, 'brick', p(a, Y, d), p(b, Z, d), p(b, Z, -d), p(a, Y, -d), brick);
  }
  if (level > 1)
    fbox(
      out,
      'brick',
      f,
      f.length - 0.3,
      f.length + 0.21,
      inner - 1.28,
      inner + 0.43,
      -d - 0.13,
      d + 0.11,
      brick,
    );
}
function build(target, level) {
  const out = withFootprintCaps(target);
  body(out, level);
  lowerWing(out, plan.narthex, level, 0.21, 10.42, 2.1, brick);
  lowerWing(out, plan.northRoom, level, -0.18, 11.03, 1.72, sunBrick);
  lowerWing(out, plan.southLobby, level, 0.1, 7.75, 1.74, sunBrick);
  lowerWing(out, plan.eastApse, level, 0.1, 9.89, 2.17, brick);
  belfry(out, level);
  if (level) {
    classicalEntry(out, plan.front.main, -0.2, level);
    classicalEntry(out, plan.front.secondary, 0.21, level);
  }
  for (const bridge of plan.buttresses) flyingPier(out, bridge, level);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
