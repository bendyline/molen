/**
 * Beechcraft King Air 350i liveries: civil schemes in their real colors and layouts (fictional
 * registrations, no names or logos) and military users of the King Air 350 family with their
 * national markings and serials.
 *
 * Model frame: +Z nose, +X left, +Y up. One ivory shell carries fuselage, wings, fin and
 * tailplane; the rudder, elevators, flaps, ailerons and nacelles are separate ivory skins, and
 * navy strips (cheatline, nacelle tops) are their own meshes. Cabin windows sit at y 2.0-2.2,
 * the belly at y 1.0-1.1; the T-tail fin runs z -6.6 to -8.7 between y 2.4 and 4.3.
 */
import * as art from '../art-twins.mjs';

const SHELL = 'body-KingAir-shell-KingAir-ivory',
  RUDDER = 'body-KingAir-rudder-KingAir-ivory',
  CHEAT = 'accent-KingAir-shell-KingAir-navy',
  NACELLES = ['body-KingAir-nacelle-1-KingAir-ivory', 'body-KingAir-nacelle-2-KingAir-ivory'],
  NACELLE_TOPS = ['accent-KingAir-nacelle-1-KingAir-navy', 'accent-KingAir-nacelle-2-KingAir-navy'];

export function slots(existing) {
  return { ...existing, skin: { materials: ['KingAir-ivory', 'KingAir-navy'] } };
}

export default function design({ kit: k, space, slots: all }) {
  const sides = ['1', '-1'];
  const anchors = {};
  const at = (name, slot, o) => (anchors[name] = space.anchor(slot, o));
  for (const side of sides) {
    const x = Number(side);
    at(`reg-${side}`, SHELL, {
      center: [x * 0.6, 1.45, -4.3],
      facing: [x, 0, 0],
      width: 1.9,
      height: 0.34,
      depth: 0.5,
    });
    at(`title-${side}`, SHELL, {
      center: [x * 0.7, 2.42, -1.0],
      facing: [x, 0.2, 0],
      width: 4.2,
      height: 0.26,
      depth: 0.5,
    });
    at(`roundel-${side}`, SHELL, {
      center: [x * 0.56, 1.75, -4.6],
      facing: [x, 0, 0],
      width: 0.7,
      height: 0.7,
      depth: 0.5,
    });
    at(`fin-${side}`, 'skin', {
      center: [x * 0.07, 3.3, -7.95],
      facing: [x, 0, 0],
      width: 1.8,
      height: 1.6,
      depth: 0.24,
    });
    at(`nose-${side}`, SHELL, {
      center: [x * 0.6, 1.62, 3.5],
      facing: [x, 0, 0.2],
      width: 0.9,
      height: 0.22,
      depth: 0.5,
    });
  }
  const wingAt = (x, top) =>
    space.anchor(SHELL, {
      center: [x, top ? 1.4 : 1.34, -0.25],
      facing: [0, top ? 1 : -1, 0],
      up: [0, 0, 1],
      width: 1.2,
      height: 1.0,
      depth: 0.3,
    });
  for (const [name, x, top] of [
    ['wing-upper-left', 5.2, true],
    ['wing-upper-right', -5.2, true],
    ['wing-lower-left', 5.2, false],
    ['wing-lower-right', -5.2, false],
  ])
    anchors[name] = wingAt(x, top);

  const WHITE = '#f2f2ee',
    SILVER = '#b8bdc1',
    RED = '#b01f29',
    BLACK = '#18191b',
    CHARCOAL = '#2b2e32',
    NAVY = '#1c2a4f';
  const bodySlots = Object.keys(all).filter((n) => n.startsWith('body-'));
  const base = (color, extra = {}) => art.paintAll(bodySlots, { color, roughness: 0.3, ...extra });
  const fuselageOnly = [
    space.plane(SHELL, [-1, 0, 0], [0.95, 0, 0]),
    space.plane(SHELL, [1, 0, 0], [-0.95, 0, 0]),
  ];
  // Below a line along the fuselage side (z, y at the nose and the tail), fuselage only.
  const lowerFuselage = (color, front, back) => ({
    color,
    planes: [...fuselageOnly, space.sideLine(SHELL, front, back, -1)],
  });
  const band = (color, [z0, a0, b0], [z1, a1, b1]) => ({
    color,
    planes: [
      ...fuselageOnly,
      space.sideLine(SHELL, [z0, a0], [z1, a1], 1),
      space.sideLine(SHELL, [z0, b0], [z1, b1], -1),
    ],
  });
  // The fin above a height (|x| < 0.2, behind the cabin), cut parallel to the tailplane.
  const finAbove = (color, y) => ({
    color,
    planes: [
      space.plane(SHELL, [-1, 0, 0], [0.2, 0, 0]),
      space.plane(SHELL, [1, 0, 0], [-0.2, 0, 0]),
      space.behind(SHELL, -6.0),
      space.above(SHELL, y),
    ],
  });
  const lowerNacelle = (slot, color, y) => ({ color, planes: [space.below(slot, y)] });

  const g = {};
  const reg = (label, color) => art.lettering(k, label, 1.9, 0.34, color, { height: 0.28 });
  g['reg-n835gk'] = reg('N835GK', BLACK);
  g['reg-n731kb'] = reg('N731KB', '#2b2e32');
  g['reg-n426ra'] = reg('N426RA', NAVY);
  // Factory 350i: a thin red pinstripe across fin and rudder (the large monogram is omitted).
  g['fin-pinstripe'] = new k.Canvas(1.8, 1.6)
    .add('#b3202a', [
      [0, 0.52],
      [1.8, 0.62],
      [1.8, 0.66],
      [0, 0.56],
    ])
    .graphic('Fin pinstripe');
  g['raaf-title'] = art.lettering(k, 'ROYAL AUSTRALIAN AIR FORCE', 4.2, 0.26, '#7d1f2a', {
    height: 0.13,
  });
  g['raaf-serial'] = art.lettering(k, 'A32-351', 1.9, 0.34, NAVY, { height: 0.16 });
  g['raaf-fin'] = (() => {
    const c = new k.Canvas(1.8, 1.6);
    k.australiaRoundel(c, 0.9, 1.05, 0.26);
    return c.graphic('RAAF roundel');
  })();
  g['raaf-wing'] = (() => {
    const c = new k.Canvas(1.2, 1.0);
    k.australiaRoundel(c, 0.6, 0.5, 0.42);
    return c.graphic('RAAF roundel');
  })();
  g['uc12f-rear'] = art.stacked(
    k,
    1.9,
    0.34,
    [
      ['UC-12F', 0.09, BLACK],
      ['163556', 0.09, BLACK],
    ],
    0.4,
  );

  const references = {
    n350fc: {
      title: 'King Air 350 N350FC (CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:N350FC_1998_Raytheon_Aircraft_Company_B300-350_C-N_FL-214_(6445379427).jpg',
    },
    n8141t: {
      title: 'King Air 350i N8141T factory demonstrator (GFDL)',
      url: 'https://commons.wikimedia.org/wiki/File:N8141T_Beechcraft_B300_King_Air_350i_(6485875281).jpg',
    },
    n1sc: {
      title: 'King Air 350 N1SC of the South Carolina Aeronautics Commission, 1990 (public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:N1SC_-_1990_King_Air_350.jpg',
    },
    raaf: {
      title: 'RAAF King Air 350 A32-351 at Wagga Wagga (CC BY-SA 3.0)',
      url: 'https://commons.wikimedia.org/wiki/File:RAAF_Beechcraft_B300_King_Air_350_(A32-351)_at_YSWG.jpg',
    },
    uc12f: {
      title: 'US Navy UC-12F 163556 on static display (CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:UC-12F_static_display._(7995813990).jpg',
    },
  };

  return {
    selected: 'silver-and-red',
    anchors,
    graphics: g,
    variants: [
      {
        id: 'silver-and-red',
        label: 'Silver and red (N835GK)',
        provenance: {
          kind: 'inspired',
          note: 'Corporate King Air 350 in the scheme of the referenced N350FC: metallic silver upper fuselage and wings over a red lower fuselage and nacelle bellies, split by a black pinstripe, with a red fin cap and tailplane leading edge. Fictional registration N835GK in black on the red; manufacturer script omitted. Colors approximate.',
          references: [references.n350fc],
        },
        paints: (() => {
          const p = base(SILVER, { metalness: 0.55, roughness: 0.3 });
          p[SHELL] = {
            color: SILVER,
            metalness: 0.55,
            roughness: 0.3,
            zones: [
              band(BLACK, [5.2, 1.6, 1.67], [-7.8, 1.8, 1.87]),
              lowerFuselage(RED, [5.2, 1.6], [-7.8, 1.8]),
              finAbove(RED, 4.05),
            ],
          };
          for (const n of NACELLES)
            p[n] = {
              color: SILVER,
              metalness: 0.55,
              roughness: 0.3,
              zones: [lowerNacelle(n, RED, 1.45)],
            };
          for (const n of NACELLE_TOPS) p[n] = { color: SILVER, metalness: 0.55, roughness: 0.3 };
          p[CHEAT] = { color: RED, roughness: 0.3 };
          p[RUDDER] = {
            color: SILVER,
            metalness: 0.55,
            roughness: 0.3,
            zones: [{ color: RED, planes: [space.above(RUDDER, 4.05)] }],
          };
          return p;
        })(),
        markings: [
          { anchor: 'reg-1', graphic: 'reg-n835gk' },
          { anchor: 'reg--1', graphic: 'reg-n835gk' },
        ],
      },
      {
        id: 'factory-350i-champagne',
        label: 'Factory 350i white and champagne (N731KB)',
        provenance: {
          kind: 'inspired',
          note: 'King Air 350i in the factory scheme of the referenced demonstrator N8141T: white fuselage with black and champagne cheatlines sweeping back under the windows, a champagne fin and rudder crossed by a thin red pinstripe, champagne nacelle tops. Fictional registration N731KB; the large monogram and the model wordmark on the fin are omitted. Colors approximate.',
          references: [references.n8141t],
        },
        paints: (() => {
          const CHAMPAGNE = '#cbb9a0';
          const p = base(WHITE);
          p[SHELL] = {
            color: WHITE,
            roughness: 0.3,
            zones: [
              band(CHARCOAL, [5.2, 1.52, 1.6], [-7.8, 1.86, 1.94]),
              band(CHAMPAGNE, [5.2, 1.4, 1.5], [-7.8, 1.74, 1.84]),
              finAbove(CHAMPAGNE, 2.45),
            ],
          };
          for (const n of NACELLE_TOPS) p[n] = { color: CHAMPAGNE, roughness: 0.3 };
          p[CHEAT] = { color: CHARCOAL, roughness: 0.3 };
          p[RUDDER] = { color: CHAMPAGNE, roughness: 0.3 };
          return p;
        })(),
        markings: [
          { anchor: 'reg-1', graphic: 'reg-n731kb' },
          { anchor: 'reg--1', graphic: 'reg-n731kb' },
          { anchor: 'fin-1', graphic: 'fin-pinstripe' },
          { anchor: 'fin--1', graphic: 'fin-pinstripe', flip: true },
        ],
      },
      {
        id: 'white-and-navy',
        label: 'White with navy cheatlines (N426RA)',
        provenance: {
          kind: 'inspired',
          note: 'King Air 350 in the 1990s white scheme of the referenced N1SC: white overall with twin navy cheatlines from the nose to the tail cone, navy nacelle tops and a navy fin stripe. Fictional registration N426RA; owner names omitted. Colors approximate.',
          references: [references.n1sc],
        },
        paints: (() => {
          const p = base(WHITE);
          p[SHELL] = { color: WHITE, roughness: 0.3, zones: [finAbove(NAVY, 3.95)] };
          for (const n of NACELLE_TOPS) p[n] = { color: NAVY, roughness: 0.3 };
          p[CHEAT] = { color: NAVY, roughness: 0.3 };
          p[RUDDER] = {
            color: WHITE,
            roughness: 0.3,
            zones: [{ color: NAVY, planes: [space.above(RUDDER, 3.95)] }],
          };
          return p;
        })(),
        markings: [
          { anchor: 'reg-1', graphic: 'reg-n426ra' },
          { anchor: 'reg--1', graphic: 'reg-n426ra' },
        ],
      },
      {
        id: 'raaf-32-squadron',
        label: 'RAAF 32 Squadron King Air 350 A32-351',
        provenance: {
          kind: 'inspired',
          note: 'King Air 350 A32-351 of the Royal Australian Air Force: white with navy pinstripes and a gold sweep along the fuselage and up the fin root, ROYAL AUSTRALIAN AIR FORCE above the cabin windows, the serial on the rear fuselage, the kangaroo roundel on the fin and wings. Colors approximate.',
          references: [references.raaf],
        },
        paints: (() => {
          const GOLD = '#b08a46';
          const p = base(WHITE);
          p[SHELL] = {
            color: WHITE,
            roughness: 0.3,
            zones: [
              band(NAVY, [5.2, 1.6, 1.64], [-7.8, 1.6, 1.64]),
              band(NAVY, [5.2, 1.52, 1.56], [-7.8, 1.52, 1.56]),
              band(GOLD, [5.2, 1.36, 1.44], [-7.8, 1.9, 2.05]),
              band(NAVY, [5.2, 1.3, 1.34], [-7.8, 1.84, 1.88]),
            ],
          };
          for (const n of NACELLE_TOPS) p[n] = { color: NAVY, roughness: 0.3 };
          p[CHEAT] = { color: NAVY, roughness: 0.3 };
          return p;
        })(),
        markings: [
          { anchor: 'title-1', graphic: 'raaf-title' },
          { anchor: 'title--1', graphic: 'raaf-title' },
          { anchor: 'reg-1', graphic: 'raaf-serial' },
          { anchor: 'reg--1', graphic: 'raaf-serial' },
          { anchor: 'fin-1', graphic: 'raaf-fin' },
          { anchor: 'fin--1', graphic: 'raaf-fin' },
          ...['wing-upper-left', 'wing-upper-right', 'wing-lower-left', 'wing-lower-right'].map(
            (a) => ({ anchor: a, graphic: 'raaf-wing' }),
          ),
        ],
      },
      {
        id: 'us-navy-uc-12f',
        label: 'US Navy UC-12F 163556',
        provenance: {
          kind: 'inspired',
          note: 'UC-12F 163556 of the US Navy, Japan: gloss white with a navy cheatline over a tan stripe from the nose to the tail cone, navy nacelle stripes, the type and bureau number small on the rear fuselage. National insignia were not visible on this example and are omitted; colors approximate.',
          references: [references.uc12f],
        },
        paints: (() => {
          const TAN = '#b39a6b';
          const p = base(WHITE);
          p[SHELL] = {
            color: WHITE,
            roughness: 0.28,
            zones: [
              band(NAVY, [5.2, 1.62, 1.7], [-7.8, 1.86, 1.94]),
              band(TAN, [5.2, 1.52, 1.61], [-7.8, 1.76, 1.85]),
            ],
          };
          for (const n of NACELLE_TOPS) p[n] = { color: NAVY, roughness: 0.3 };
          p[CHEAT] = { color: TAN, roughness: 0.3 };
          return p;
        })(),
        markings: [
          { anchor: 'reg-1', graphic: 'uc12f-rear' },
          { anchor: 'reg--1', graphic: 'uc12f-rear' },
        ],
      },
    ],
  };
}
