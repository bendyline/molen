/**
 * C-5 Galaxy liveries on the C-5M model: Air Mobility Command and Air Force Reserve wings
 * (Dover, Westover, Lackland) with their tail bands, flags, command codes and tail numbers, plus
 * the 1980s European One camouflage. Markings are redrawn as original vector art; the C-5A and
 * C-5B schemes are applied to the C-5M airframe. Colors are approximate.
 */
import * as A from '../art-transports.mjs';

const EXT = 'body-C5-exterior-C5-airframe',
  RUDDER = 'body-C5-rudder-C5-airframe';

export function slots(existing) {
  const out = {};
  // Body regions only: the existing whole-model `body` binding overlapped the per-part slots.
  for (const [name, binding] of Object.entries(existing))
    if (name.startsWith('body-')) out[name] = binding;
  // Markings only (never painted): every airframe surface, fin and rudder together.
  out.all = { materials: ['C5-airframe'] };
  return out;
}

const GRAY = '#8c9498',
  INK = '#202427',
  WHITE = '#f4f4f0';

// Fin chord centre and skin half-thickness at height y (probed on the runtime model). The
// rudder is a thinner slab (skin at |x| 0.12) set into the fin's trailing part.
const finZ = (y) => -27.0 - 0.625 * (y - 11),
  finX = (y) => 0.418 - 0.032 * (y - 11);

/** A stylised bald eagle's head facing the reader's left (original drawing). */
function eagleHead(c, x, y, s) {
  c.add(WHITE, [
    [x - 0.5 * s, y + 0.1 * s],
    [x - 0.2 * s, y + 0.42 * s],
    [x + 0.3 * s, y + 0.45 * s],
    [x + 0.55 * s, y + 0.1 * s],
    [x + 0.45 * s, y - 0.4 * s],
    [x + 0.05 * s, y - 0.45 * s],
    [x - 0.25 * s, y - 0.2 * s],
  ]);
  c.add('#f2b705', [
    [x - 0.5 * s, y + 0.1 * s],
    [x - 0.78 * s, y + 0.02 * s],
    [x - 0.62 * s, y - 0.18 * s],
    [x - 0.3 * s, y - 0.12 * s],
  ]);
  c.circle('#141618', x - 0.12 * s, y + 0.16 * s, 0.06 * s, 10);
  return c;
}

export default function design({ kit: k, space, slots: all }) {
  const anchors = {};
  const pair = (name, make) => {
    anchors[`${name}-l`] = make(1);
    anchors[`${name}-r`] = make(-1);
  };
  const on = (center, s, width, height, depth = 1.4, facing = [s, 0, 0]) =>
    space.anchor('all', { center, facing, width, height, depth });
  const fin =
    (y, width, height, dz = 0) =>
    (s) =>
      on([(s * (finX(y) + 0.12)) / 2, y, finZ(y) + dz], s, width, height, finX(y) - 0.12 + 0.22);

  pair('title', (s) => on([s * 3.35, 7.35, 22.8], s, 6.6, 0.75, 1.4, [s, 0.25, 0]));
  pair('insignia', (s) => on([s * 3.57, 5.9, -6.2], s, 2.6, 1.4));
  pair('fin-flag', fin(14.4, 1.6, 0.85));
  pair('fin-code', fin(13.55, 1.6, 0.42));
  pair('fin-band', fin(12.85, 8.8, 0.6));
  pair('fin-serial', fin(11.85, 2.8, 0.62));
  pair('fin-script', fin(11.1, 3.4, 0.5));

  // ------------------------------------------------------------------ artwork
  const graphics = {
    'us-air-force': A.label(k, 'U.S. AIR FORCE', 6.6, 0.75, INK, { tracking: 0.08 }),
    'us-air-force-black': A.label(k, 'U.S. AIR FORCE', 6.6, 0.75, '#121314', {
      fill: 0.6,
      tracking: 0.08,
    }),
    insignia: A.finish(
      k.usInsignia(new k.Canvas(2.6, 1.4), 1.3, 0.7, 0.6, { style: 'full' }),
      'US national insignia',
    ),
    'insignia-black': A.finish(
      k.usInsignia(new k.Canvas(2.6, 1.4), 1.3, 0.7, 0.45, { style: 'lowvis', color: '#141516' }),
      'US national insignia (black)',
    ),
    'us-flag': A.usFlag(k, 1.6, 0.85),
    amc: A.label(k, 'AMC', 1.6, 0.42, INK),
    afrc: A.label(k, 'AFRC', 1.6, 0.42, INK),
    // Dover: sky-blue band, the base name in a yellow lozenge, an eagle's head at the front.
    ...Object.fromEntries(
      [
        ['l', 1],
        ['r', -1],
      ].map(([side, dir]) => {
        const w = 8.8,
          h = 0.6,
          c = new k.Canvas(w, h);
        const cx = w / 2;
        c.add('#f2c12e', [
          [cx - 1.5, h / 2],
          [cx - 1.15, h * 0.92],
          [cx + 1.15, h * 0.92],
          [cx + 1.5, h / 2],
          [cx + 1.15, h * 0.08],
          [cx - 1.15, h * 0.08],
        ]);
        c.text('#141618', 'DOVER', { x: cx, y: h / 2, height: 0.34, tracking: 0.1 });
        // The eagle faces forward: the reader's left on the left side, right on the right.
        const ex = dir > 0 ? 0.7 : w - 0.7;
        if (dir > 0) eagleHead(c, ex, h / 2, 0.55);
        else {
          const m = new k.Canvas(w, h);
          eagleHead(m, 0.7, h / 2, 0.55);
          for (const shape of m.shapes)
            c.add(shape.color, shape.points.map(([x, y]) => [w - x, y]).reverse());
        }
        return [`band-dover-${side}`, A.finish(c, 'DOVER tail band')];
      }),
    ),
    'serial-60017': A.label(k, '60017', 2.8, 0.62, INK),
    'super-galaxy': A.label(k, 'Super Galaxy', 3.4, 0.5, INK, {
      face: 'regular',
      slant: 0.25,
      fill: 0.62,
    }),
    // Westover: red band with WESTOVER in white behind a forward-pointing arrow.
    ...Object.fromEntries(
      [
        ['l', 1],
        ['r', -1],
      ].map(([side, dir]) => {
        const w = 8.8,
          h = 0.6,
          c = new k.Canvas(w, h);
        const ax = dir > 0 ? 1.0 : w - 1.0;
        c.add(WHITE, [
          [ax - dir * 0.45, h / 2],
          [ax - dir * 0.1, h * 0.82],
          [ax - dir * 0.1, h * 0.62],
          [ax + dir * 0.55, h * 0.62],
          [ax + dir * 0.55, h * 0.38],
          [ax - dir * 0.1, h * 0.38],
          [ax - dir * 0.1, h * 0.18],
        ]);
        c.text(WHITE, 'WESTOVER', { x: w / 2 + dir * 0.4, y: h / 2, height: 0.34, tracking: 0.1 });
        return [`band-westover-${side}`, A.finish(c, 'WESTOVER tail band')];
      }),
    ),
    'serial-70031': A.label(k, '70031', 2.8, 0.62, INK),
    // Lackland: the Lone Star band (a blue field with a white star ahead of white and red bars).
    ...Object.fromEntries(
      [
        ['l', 1],
        ['r', -1],
      ].map(([side, dir]) => {
        const w = 8.8,
          h = 0.6,
          c = new k.Canvas(w, h),
          blueW = 2.6;
        const x0 = dir > 0 ? 0 : w - blueW;
        c.rect('#1c2f6e', x0, 0, blueW, h);
        c.star(WHITE, x0 + blueW / 2, h / 2, 0.24);
        const bx = dir > 0 ? blueW : 0;
        c.rect(WHITE, bx, h / 2, w - blueW, h / 2);
        c.rect('#bf1e2e', bx, 0, w - blueW, h / 2);
        return [`band-lackland-${side}`, A.finish(c, 'Lackland Lone Star tail band')];
      }),
    ),
    'serial-90016': A.label(k, '90016', 2.8, 0.62, INK),
  };

  // ------------------------------------------------------------------ paint
  const bodySlots = Object.keys(all).filter((n) => n.startsWith('body-'));
  const paintAll = (extra = {}) => ({
    ...Object.fromEntries(bodySlots.map((n) => [n, { color: GRAY }])),
    ...extra,
  });
  const finBand = (color) => ({
    [EXT]: {
      color: GRAY,
      zones: [{ color, planes: [space.above(EXT, 12.55), space.below(EXT, 13.15)] }],
    },
    [RUDDER]: {
      color: GRAY,
      zones: [{ color, planes: [space.above(RUDDER, 12.55), space.below(RUDDER, 13.15)] }],
    },
  });
  const longest = (slot) => {
    const b = all[slot] && space.bounds[slot];
    return Math.max(...b.max.map((v, i) => v - b.min[i]));
  };
  const euro = ['#5e6b45', '#3b4637', '#575e5f'];
  const camo = (slot, seed) => ({
    color: euro[0],
    roughness: 0.85,
    camouflage: {
      colors: euro,
      scale: Math.round(Math.max(0.2, longest(slot) / 7 / 4) * 1000) / 1000,
      seed,
      style: 'blotch',
    },
  });
  const both = (anchor, graphic) => [
    { anchor: `${anchor}-l`, graphic },
    { anchor: `${anchor}-r`, graphic },
  ];
  const sided = (anchor, prefix) => [
    { anchor: `${anchor}-l`, graphic: `${prefix}-l` },
    { anchor: `${anchor}-r`, graphic: `${prefix}-r` },
  ];
  const leading = (anchor, graphic) => [
    { anchor: `${anchor}-l`, graphic },
    { anchor: `${anchor}-r`, graphic, flip: true },
  ];
  const refs = {
    dover: {
      title: 'C-5M 86-0017 of Dover AFB taking off (US Air Force, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:C-5_Galaxy_taking_off_from_Travis_AFB.jpg',
    },
    westover: {
      title: 'C-5B 87-0031 of the 439th Airlift Wing, Westover (CC BY 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Lockheed_C-5_Galaxy_USAF_(87-0031)_Westover_AFB_(6784226411).jpg',
    },
    westover2: {
      title: 'C-5 at Westover Air Reserve Base (US Air Force, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:C-5_Galaxy_at_Westover_Air_Reserve_Base.jpg',
    },
    lackland: {
      title:
        'C-5A 69-0016 of the 433rd Airlift Wing at Kelly Field Annex (US Air Force, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:433d_AW_C-5_Kelly_Annex_TX.jpg',
    },
    euro: {
      title: 'C-5A Galaxy in European One camouflage in flight (US Air Force, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:C-5_Galaxy.jpg',
    },
    euro2: {
      title: 'C-5A in European One camouflage at Chièvres, 1987 (CC BY-SA)',
      url: 'https://commons.wikimedia.org/wiki/File:C-5M_Super_Galaxy_-_20-21_juin_1987_-_Chi%C3%A8vres_AB2.JPG',
    },
  };
  const variant = (id, label, note, references, paints, markings) => ({
    id,
    label,
    provenance: { kind: 'inspired', note, references },
    paints,
    markings,
  });

  return {
    selected: 'dover-436-aw-super-galaxy',
    anchors,
    graphics,
    variants: [
      variant(
        'dover-436-aw-super-galaxy',
        'USAF 436th AW Dover, C-5M 86-0017',
        'Air Mobility Command C-5M 86-0017 of the 436th Airlift Wing (Dover) from the referenced photograph: gray, U.S. AIR FORCE title, US flag, AMC, the sky-blue Dover tail band with the base name in a yellow lozenge and an eagle head at its front (original drawing), tail number 60017 and Super Galaxy script, full-color national insignia aft. Approximate colors and band art.',
        [refs.dover],
        paintAll(finBand('#58b6e0')),
        [
          ...both('title', 'us-air-force'),
          ...both('insignia', 'insignia'),
          ...leading('fin-flag', 'us-flag'),
          ...both('fin-code', 'amc'),
          ...sided('fin-band', 'band-dover'),
          ...both('fin-serial', 'serial-60017'),
          ...both('fin-script', 'super-galaxy'),
        ],
      ),
      variant(
        'westover-439-aw',
        'AFRC 439th AW Westover, 87-0031',
        'Air Force Reserve C-5B 87-0031 of the 439th Airlift Wing (Westover) from the referenced photographs, applied to the C-5M model: gray, U.S. AIR FORCE title, US flag, AFRC, the red WESTOVER tail band with its forward-pointing white arrow, tail number 70031 and national insignia aft. Approximate colors.',
        [refs.westover, refs.westover2],
        paintAll(finBand('#c8202e')),
        [
          ...both('title', 'us-air-force'),
          ...both('insignia', 'insignia'),
          ...leading('fin-flag', 'us-flag'),
          ...both('fin-code', 'afrc'),
          ...sided('fin-band', 'band-westover'),
          ...both('fin-serial', 'serial-70031'),
        ],
      ),
      variant(
        'lackland-433-aw',
        'AFRC 433rd AW Lackland, 69-0016',
        'Air Force Reserve C-5A 69-0016 of the 433rd Airlift Wing (Lackland, Kelly Field Annex) from the referenced photograph, applied to the C-5M model: gray, U.S. AIR FORCE title, US flag, AFRC, the Lone Star tail band (blue field with a white star ahead of white and red bars), tail number 90016 and national insignia aft. Approximate colors.',
        [refs.lackland],
        paintAll(),
        [
          ...both('title', 'us-air-force'),
          ...both('insignia', 'insignia'),
          ...leading('fin-flag', 'us-flag'),
          ...both('fin-code', 'afrc'),
          ...sided('fin-band', 'band-lackland'),
          ...both('fin-serial', 'serial-90016'),
        ],
      ),
      variant(
        'european-one-1980s',
        'European One camouflage, 1980s',
        'Military Airlift Command C-5A in the 1980s European One camouflage from the referenced photographs, applied to the C-5M model: dark green, medium green and gray patches overall (deterministic pattern, not the aircraft-specific layout), small black U.S. AIR FORCE title and black national insignia. Serials and command markings are not legible in the photographs and are omitted.',
        [refs.euro, refs.euro2],
        Object.fromEntries(bodySlots.map((n, i) => [n, camo(n, 4100 + i)])),
        [...both('title', 'us-air-force-black'), ...both('insignia', 'insignia-black')],
      ),
    ],
  };
}
