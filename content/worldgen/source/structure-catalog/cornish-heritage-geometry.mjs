import { withFootprintCaps } from '../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  extrude,
  facade,
  fbox,
  gableRoof,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const stone = rgb('a8a495');
const cut = rgb('bab3a0');
const lime = rgb('e0dacc');
const slate = rgb('677278');
const glass = rgb('525e60');
const timber = rgb('786655');
const turf = rgb('8a965e');
const restingStone = rgb('8d8b76');
const P = ([x, z], y) => [x, y, z];
const xz = ([x, , z]) => [x, z];

function fieldWindows(out, wall, p, detail, front) {
  if (detail === 0 || wall.length < 2.6) return;
  const color = p.material === 'lime' ? cut : stone;
  const count = Math.max(1, Math.floor(wall.length / (p.windowSpacing ?? 3.55)));
  const floors = p.height > 6.0 && detail > 0 ? [0.19, 0.62] : [0.24];
  for (let bay = 0; bay < count; bay++) {
    const x = (wall.length * (bay + 0.5)) / count;
    for (const [i, floor] of floors.entries()) {
      const door = front && bay === Math.floor(count / 2) && i === 0 && p.height < 9;
      const y = p.grade + (door ? 0.07 : p.height * floor);
      opening(
        out,
        wall,
        x,
        y,
        door ? 1.2 : Math.min(1.3, (wall.length / count) * 0.4),
        door ? 2.27 : 1.63,
        {
          glassSlot: door ? 'wood' : 'opening',
          glass: door ? timber : glass,
          frame: color,
          frameSlot: 'stone',
          frameWidth: detail > 1 && (front || p.accent) ? 0.12 : 0,
          frameDepth: 0.075,
          sill: !door,
          mullions: detail > 2 && !door ? 2 : 0,
          transoms: detail > 2 && !door ? 1 : 0,
        },
      );
    }
  }
}

function range(out, caps, part, detail) {
  const { outline, center, along, width, length, grade, base, height, material } = part;
  const eave = grade + height;
  extrude(caps, material, outline, base, eave, material === 'lime' ? lime : stone);
  const end = (s) => center.map((x, i) => x + along[i] * s);
  gableRoof(out, 'slate', end(-length / 2), end(length / 2), width, eave, eave + part.rise, slate, {
    endSlot: material,
    endColor: material === 'lime' ? lime : stone,
    overhang: 0.1,
  });
  const ring = outwardRing(outline);
  for (let i = 0; i < ring.length; i++) {
    const wall = wallFace(ring[i], ring[(i + 1) % ring.length]);
    const front = wall.normal[0] * part.front[0] + wall.normal[1] * part.front[1] > 0.68;
    if (front || part.accent) fieldWindows(out, wall, part, detail, front);
  }
}

function loggia(out, caps, front, detail) {
  const { grade, base, center, axis, width, depth, height, clearHeight } = front;
  const f = facade(center, axis);
  const w = width * 0.5;
  const open = width * 0.33;
  const deck = grade + clearHeight;
  const eave = grade + height;
  // The back wall and two end bays enclose a continuous covered walk.
  fbox(out, 'stone', f, -w, w, base, grade + 0.12, -depth, 0, cut);
  fbox(out, 'stone', f, -w, w, grade, deck, -depth, -depth * 0.69, stone);
  fbox(out, 'stone', f, -w, -open, grade, deck, -depth * 0.7, 0, stone);
  fbox(out, 'stone', f, open, w, grade, deck, -depth * 0.7, 0, stone);
  fbox(out, 'stone', f, -w, w, deck, eave, -depth, 0, stone, { bottom: true });
  const posts = 8;
  for (let i = 0; i < posts; i++) {
    const u = -open + (2 * open * i) / (posts - 1);
    const radius = 0.33;
    const at = xz(f.P(u, 0, -0.4));
    lathe(
      out,
      'stone',
      at,
      [
        [grade + 0.11, radius + 0.096, radius + 0.096],
        [grade + 0.37, radius, radius],
        [deck - 0.27, radius * 0.81, radius * 0.81],
        [deck, radius + 0.083, radius + 0.083],
      ],
      detail < 2 ? 6 : 10,
      cut,
      { capTop: false },
    );
  }
  for (const edge of [0, -depth]) {
    fbox(out, 'stone', f, -w, w, eave, eave + 0.27, edge - 0.15, edge + 0.15, cut);
    const count = Math.max(12, Math.floor(width / (detail > 0 ? 0.94 : 2.36)));
    for (let i = 0; i < count; i++) {
      const u = -w + (width * (i + 0.5)) / count;
      const span = (width / count) * 0.33;
      fbox(
        out,
        'stone',
        f,
        u - span,
        u + span,
        eave + 0.27,
        eave + 0.53,
        edge - 0.128,
        edge + 0.128,
        cut,
      );
    }
  }
  if (detail === 0) return;
  const count = 9;
  for (let i = 0; i < count; i++) {
    const u = -w + (width * (i + 0.5)) / count;
    opening(out, f, u, deck + 0.53, 1.26, 1.95, {
      glassSlot: 'opening',
      frameSlot: 'stone',
      glass,
      frame: cut,
      frameWidth: detail > 1 ? 0.133 : 0,
      frameDepth: 0.115,
      mullions: detail > 1 ? 2 : 0,
      transoms: detail > 1 ? 1 : 0,
    });
  }
  for (const side of [-1, 1]) {
    opening(out, f, side * (w + open) * 0.5, grade + 1.04, 1.2, 1.6, {
      glassSlot: 'opening',
      frameSlot: 'stone',
      glass,
      frame: cut,
      frameWidth: detail > 1 ? 0.12 : 0,
      frameDepth: 0.08,
      mullions: detail > 1 ? 1 : 0,
    });
  }
  const landing = [
    xz(f.P(-open, 0, 1.13)),
    xz(f.P(open, 0, 1.13)),
    xz(f.P(open, 0, 0)),
    xz(f.P(-open, 0, 0)),
  ];
  extrude(caps, 'stone', landing, grade - 0.18, grade + 0.09, cut);
}

function buildHouse(out, site, detail) {
  const caps = withFootprintCaps(out);
  for (const part of site.ranges) range(out, caps, part, detail);
  if (site.loggia) loggia(out, caps, site.loggia, detail);
  for (const p of site.stacks) {
    const f = facade(p.center, p.along);
    fbox(out, 'stone', f, -0.43, 0.43, p.base, p.height, -0.39, 0.39, stone);
    fbox(out, 'stone', f, -0.51, 0.51, p.height - 0.15, p.height + 0.11, -0.45, 0.45, cut);
  }
}

function circleOf(pit, factor, detail) {
  const profile = detail === 0 ? pit.rim.filter((_, i) => i % 2 === 0) : pit.rim;
  return profile.map(([x, z]) => [
    pit.center[0] + (x - pit.center[0]) * factor,
    pit.center[1] + (z - pit.center[1]) * factor,
  ]);
}

function ringStep(out, inner, outer, previous, elevation) {
  for (let i = 0; i < inner.length; i++) {
    const j = (i + 1) % inner.length;
    quad4(
      out,
      'rubble',
      P(inner[j], previous),
      P(inner[i], previous),
      P(inner[i], elevation),
      P(inner[j], elevation),
      restingStone,
    );
    quad4(
      out,
      'grass',
      P(outer[i], elevation),
      P(outer[j], elevation),
      P(inner[j], elevation),
      P(inner[i], elevation),
      turf,
    );
  }
}

function buildPit(out, pit, detail) {
  const caps = withFootprintCaps(out);
  const { base, rimHeight, innerRate, terraceCount } = pit;
  const start = circleOf(pit, innerRate, detail);
  extrude(caps, 'grass', start, base - 0.12, base, turf);
  const step = (rimHeight - base) / terraceCount;
  const r = (i) => innerRate + (1 - innerRate) * (i / terraceCount);
  const y = (i) => base + step * i;
  let inner = start;
  for (let i = 0; i < terraceCount; i++) {
    const outer = circleOf(pit, r(i + 1), detail);
    ringStep(out, inner, outer, y(i), y(i + 1));
    inner = outer;
  }
  if (detail === 0) return;

  const stair = facade(pit.center, pit.stairAcross);
  for (let i = 0; i < terraceCount; i++) {
    const first = pit.stairLength * r(i);
    const last = pit.stairLength * r(i + 1);
    fbox(
      out,
      'rubble',
      stair,
      -0.61,
      0.61,
      y(i) - 0.025,
      y(i) + step * 0.55,
      first - 0.085,
      (first + last) * 0.5,
      cut,
    );
    fbox(
      out,
      'rubble',
      stair,
      -0.61,
      0.61,
      y(i) - 0.025,
      y(i + 1) + 0.015,
      (first + last) * 0.5,
      last,
      cut,
    );
  }
  const lectern = facade(pit.speakingPoint, [1, 0]);
  const platform = y(9);
  fbox(out, 'rubble', lectern, -0.7, 0.7, platform - 0.02, platform + 0.44, -0.29, 0.28, cut);
  for (const side of [-1, 1]) {
    fbox(
      out,
      'rubble',
      lectern,
      side * 0.88 - 0.12,
      side * 0.88 + 0.12,
      platform,
      platform + 0.89,
      -0.18,
      0.15,
      stone,
    );
  }
}

function author(surfaces, build) {
  const buildSkyline = (out) => build(out, 0);
  const buildDistrict = (out) => build(out, 1);
  const buildStreet = (out) => build(out, 2);
  const buildCloseup = (out) => build(out, 3);
  return {
    surfaces,
    buildSkyline,
    buildDistrict,
    buildStreet,
    buildCloseup,
    buildMaster: buildCloseup,
  };
}

export function cornishHeritageGeometry(site) {
  if (site.pit)
    return author(
      {
        grass: { slot: 'foundation', graph: 'gravel', roughness: 0.98 },
        rubble: { slot: 'wall', graph: 'stone_drywall', roughness: 0.98 },
      },
      (out, detail) => buildPit(out, site.pit, detail),
    );
  return author(
    {
      stone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.96 },
      lime: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
      slate: { slot: 'roof', graph: 'slate', roughness: 0.94 },
      wood: { slot: 'trim', graph: 'wood_vertical', roughness: 0.91 },
      opening: { slot: 'trim', graph: 'metal_painted', roughness: 0.86 },
    },
    (out, detail) => buildHouse(out, site, detail),
  );
}
