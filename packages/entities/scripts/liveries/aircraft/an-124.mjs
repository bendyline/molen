/**
 * An-124 Ruslan liveries: the Russian Air Force scheme with its real markings (red stars, ВВС
 * РОССИИ, serial), and civil cargo schemes in their real colors and layouts with no operator
 * names or logos and fictional registrations in the right national format.
 *
 * Cheatlines and color areas are paint zones cut along planes in the model frame; the
 * fuselage's tail upsweep starts at z -18, where the lines rise with it. Colors approximate.
 */
import * as A from '../art-transports.mjs';

const EXT = 'body-AN124-exterior-AN124-airframe',
  RUDDER = 'body-AN124-rudder-AN124-airframe';

export function slots(existing) {
  const out = {};
  // The builder no longer carries a baked cheatline (AN124-stripe), and the old whole-model
  // `tailPaint` binding overlapped the per-part slots: drop both.
  for (const [name, binding] of Object.entries(existing))
    if (name.startsWith('body-')) out[name] = binding;
  // Markings only (never painted): every airframe surface, fin and rudder together.
  out.all = { materials: ['AN124-airframe'] };
  return out;
}

const WHITE = '#eef0ee',
  BELLY = '#c8cdd0',
  RU_BLUE = '#203f8e',
  VD_BLUE = '#1c3d96',
  PL_BLUE = '#1e3f8f',
  AF_BLUE = '#2349a0',
  ADB_CYAN = '#2ea3dc',
  RED = '#c8202a',
  INK = '#1d2124';

// Fin: chord centre and skin half-thickness at height y (probed on the runtime model).
const finZ = (y) => -24.75 - 0.615 * (y - 11),
  finX = (y) => 0.396 - 0.025 * (y - 11);
// The tail upsweep: cheatlines rise 2.2 m between z -18 and -30.
const RISE = 2.2 / 12;

/** The Soviet state flag, simplified: red field, gold star, hammer and sickle (original drawing). */
function sovietFlag(k, w, h) {
  const c = new k.Canvas(w, h),
    gold = '#f2c21b',
    u = h / 10;
  c.rect('#c8102e', 0, 0, w, h);
  c.star(gold, 2.6 * u, 8.6 * u, 0.75 * u, 0.3 * u);
  c.add(gold, [
    [2.95 * u, 8.35 * u],
    [2.25 * u, 8.35 * u],
    [2.6 * u, 7.85 * u],
  ]);
  // Sickle: a thick arc opening to the upper right, with a short handle.
  const arc = [],
    inner = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI * 0.15 + (i / 12) * Math.PI * 1.25;
    arc.push([2.7 * u + Math.cos(a) * 1.6 * u, 5.9 * u + Math.sin(a) * 1.6 * u]);
    inner.push([2.95 * u + Math.cos(a) * 1.25 * u, 6.05 * u + Math.sin(a) * 1.25 * u]);
  }
  c.add(gold, [...arc, ...inner.reverse()]);
  c.box(gold, 1.75 * u, 4.35 * u, 1.1 * u, 0.32 * u, Math.PI / 4);
  // Hammer: a handle crossing the sickle and a head.
  c.box(gold, 2.75 * u, 5.7 * u, 3.4 * u, 0.32 * u, -Math.PI / 4);
  c.box(gold, 3.75 * u, 6.75 * u, 1.5 * u, 0.6 * u, Math.PI / 4);
  return A.finish(c, 'Soviet state flag');
}

export default function design({ kit: k, space, slots: all }) {
  const anchors = {};
  const pair = (name, make) => {
    anchors[`${name}-l`] = make(1);
    anchors[`${name}-r`] = make(-1);
  };
  const on = (center, s, width, height, depth = 1.2, facing = [s, 0, 0]) =>
    space.anchor('all', { center, facing, width, height, depth });
  // The rudder is a thinner slab (skin at |x| 0.12) set into the fin's trailing part: the
  // projector spans both skins without reaching the far side.
  const fin =
    (y, width, height, dz = 0) =>
    (s) =>
      on([(s * (finX(y) + 0.12)) / 2, y, finZ(y) + dz], s, width, height, finX(y) - 0.12 + 0.22);
  pair('fin-star', fin(17.2, 1.9, 1.9, -0.3));
  pair('fin-root-title', fin(11.25, 5.6, 0.58, -0.2));
  pair('fin-top-flag', fin(19.7, 1.5, 1.0, 0.45));
  pair('fin-flag', fin(17.8, 2.2, 1.45, -0.6));
  pair('aft-reg', (s) => on([s * 3.62, 6.3, -15.6], s, 3.4, 0.46));
  pair('nose-type', (s) => on([s * 3.82, 4.15, 20.2], s, 3.6, 0.4));
  pair('nose-type-high', (s) => on([s * 3.86, 6.45, 21.2], s, 3.6, 0.4));
  pair('nose-flag', (s) => on([s * 3.2, 8.15, 23.2], s, 0.9, 0.6, 1.0, [s, 0.35, 0]));

  // ------------------------------------------------------------------ artwork
  const graphics = {
    'red-star': A.finish(
      k.russianStar(new k.Canvas(1.9, 1.9), 0.95, 0.95, 0.94),
      'Russian Air Force star',
    ),
    'vvs-rossii': A.label(k, 'ВВС РОССИИ', 5.6, 0.58, INK, { tracking: 0.06 }),
    'reg-rf82011': A.label(k, 'RF-82011', 3.4, 0.46, INK),
    'type-blue': A.label(k, 'АН-124-100', 3.6, 0.4, RU_BLUE),
    'russian-flag': A.flagH(k, 1.5, 1.0, ['#ffffff', '#0039a6', '#d52b1e'], 'Russian flag'),
    'russian-flag-small': A.flagH(k, 0.9, 0.6, ['#ffffff', '#0039a6', '#d52b1e'], 'Russian flag'),
    'ukraine-flag': A.flagH(k, 0.9, 0.6, ['#0057b7', '#ffd700'], 'Ukrainian flag'),
    'soviet-flag': sovietFlag(k, 2.2, 1.45),
    'reg-ra82099': A.label(k, 'RA-82099', 3.4, 0.46, INK),
    'reg-ra82098': A.label(k, 'RA-82098', 3.4, 0.46, INK),
    'reg-cccp': A.label(k, 'CCCP-82097', 3.4, 0.46, INK),
    'reg-ur': A.label(k, 'UR-82096', 3.4, 0.46, INK),
  };

  // ------------------------------------------------------------------ zones
  const bodySlots = Object.keys(all).filter((n) => n.startsWith('body-'));
  const paintAll = (color, extra = {}) => ({
    ...Object.fromEntries(bodySlots.map((n) => [n, { color }])),
    ...extra,
  });
  // A horizontal line band [y0, y1] on the fuselage that rises with the tail upsweep.
  const line = (color, y0, y1, slot = EXT) => [
    { color, planes: [space.above(slot, y0), space.below(slot, y1), space.ahead(slot, -18)] },
    {
      color,
      planes: [
        space.sideLine(slot, [-18, y0], [-30, y0 + 12 * RISE], 1),
        space.sideLine(slot, [-18, y1], [-30, y1 + 12 * RISE], -1),
        space.behind(slot, -18),
        space.below(slot, 9.6),
      ],
    },
  ];
  // Everything under the line y0 (belly color), rising with the upsweep; nacelles included.
  const under = (color, y0, slot = EXT) => [
    { color, planes: [space.below(slot, y0), space.ahead(slot, -18)] },
    {
      color,
      planes: [space.sideLine(slot, [-18, y0], [-30, y0 + 12 * RISE], -1), space.behind(slot, -18)],
    },
  ];
  const nacelles = (color) => [
    {
      color,
      planes: [
        space.plane(EXT, [1, 0, 0], [5, 0, 0]),
        space.below(EXT, 7.0),
        space.ahead(EXT, 2.5),
      ],
    },
    {
      color,
      planes: [
        space.plane(EXT, [-1, 0, 0], [-5, 0, 0]),
        space.below(EXT, 7.0),
        space.ahead(EXT, 2.5),
      ],
    },
  ];
  const tips = (color) => [
    { color, planes: [space.plane(EXT, [1, 0, 0], [35.4, 0, 0])] },
    { color, planes: [space.plane(EXT, [-1, 0, 0], [-35.4, 0, 0])] },
    { color, planes: [space.plane(EXT, [1, 0, 0], [14.0, 0, 0]), space.behind(EXT, -26)] },
    { color, planes: [space.plane(EXT, [-1, 0, 0], [-14.0, 0, 0]), space.behind(EXT, -26)] },
  ];
  const elevatorTip = (slot, s, color) => ({
    color: WHITE,
    zones: [{ color, planes: [space.plane(slot, [s, 0, 0], [s * 14.0, 0, 0])] }],
  });
  const aileronTip = (slot, s, color) => ({
    color: WHITE,
    zones: [{ color, planes: [space.plane(slot, [s, 0, 0], [s * 35.4, 0, 0])] }],
  });
  const tipSlots = (color) => ({
    'body-AN124-elevator-1-AN124-airframe': elevatorTip(
      'body-AN124-elevator-1-AN124-airframe',
      1,
      color,
    ),
    'body-AN124-elevator--1-AN124-airframe': elevatorTip(
      'body-AN124-elevator--1-AN124-airframe',
      -1,
      color,
    ),
    'body-AN124-aileron-1-AN124-airframe': aileronTip(
      'body-AN124-aileron-1-AN124-airframe',
      1,
      color,
    ),
    'body-AN124-aileron--1-AN124-airframe': aileronTip(
      'body-AN124-aileron--1-AN124-airframe',
      -1,
      color,
    ),
  });
  // A diagonal stripe from the rear fuselage up the fin: front edge from (z0, y 4.6) rising at
  // 52 degrees; `width` is measured horizontally.
  const diagonal = (color, z0, width, slot) => {
    const dz = -12.3,
      dy = 15.55;
    return {
      color,
      planes: [
        space.sideLine(slot, [z0, 4.6], [z0 + dz, 4.6 + dy], -1),
        space.sideLine(slot, [z0 - width, 4.6], [z0 - width + dz, 4.6 + dy], 1),
        space.above(slot, 4.6),
      ],
    };
  };

  const both = (anchor, graphic) => [
    { anchor: `${anchor}-l`, graphic },
    { anchor: `${anchor}-r`, graphic },
  ];
  const leading = (anchor, graphic) => [
    { anchor: `${anchor}-l`, graphic },
    { anchor: `${anchor}-r`, graphic, flip: true },
  ];
  const refs = {
    rf: {
      title: 'Russian Air Force An-124 RF-82011 (CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Russian_Air_Force,_RF-82011,_Antonov_An-124_(42713037752).jpg',
    },
    vd: {
      title: 'Volga-Dnepr An-124-100 RA-82077 (CC BY-SA)',
      url: 'https://commons.wikimedia.org/wiki/File:Volga-Dnepr_Airlines_Antonov_An-124-100_RA-82077.jpg',
    },
    polet: {
      title: 'Polet Airlines An-124 RA-82075 in flight, 2011 (CC BY-SA)',
      url: 'https://commons.wikimedia.org/wiki/File:Polet_Airlines_An-124_RA-82075_in_flight_28-Jul-2011.jpg',
    },
    aeroflot: {
      title: 'An-124-100 CCCP-82007 at Farnborough, 1988 (CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Antonov_An-124-100_Ruslan_CCCP-82007_Aeroflot,_Farnborough_UK,_September_1988._(5589235899).jpg',
    },
    adb: {
      title: 'An-124-100 of the Antonov Design Bureau, JP295359 (GFDL)',
      url: 'https://commons.wikimedia.org/wiki/File:Antonov_An-124-100_Ruslan,_Antonov_Airlines_JP295359.jpg',
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
    selected: 'russian-air-force-rf-82011',
    anchors,
    graphics,
    variants: [
      variant(
        'russian-air-force-rf-82011',
        'Russian Air Force RF-82011',
        'Russian Air Force An-124-100 RF-82011 from the referenced photograph: white upper fuselage, light gray belly, dark blue cheatline with a thin line under it rising with the tail, red star in its white and blue border on the fin, ВВС РОССИИ on the fin root, RF-82011 aft and АН-124-100 on the nose, red wing and stabilizer tips. The aircraft name in red script is omitted. Approximate colors.',
        [refs.rf],
        paintAll(WHITE, {
          [EXT]: {
            color: WHITE,
            zones: [
              ...under(BELLY, 4.55),
              ...line(RU_BLUE, 4.86, 5.3),
              ...line(RU_BLUE, 4.6, 4.7),
              ...tips(RED),
            ],
          },
          ...tipSlots(RED),
        }),
        [
          ...both('fin-star', 'red-star'),
          ...both('fin-root-title', 'vvs-rossii'),
          ...both('aft-reg', 'reg-rf82011'),
          ...both('nose-type', 'type-blue'),
        ],
      ),
      variant(
        'cargo-white-blue-swept-tail',
        'Heavy-lift cargo, blue band and swept tail stripe',
        "Civil heavy-lift cargo scheme in the real colors and layout of Volga-Dnepr's An-124s (referenced photograph), without operator names or logos: white, a wide dark blue cheatline between pinstripes, blue nacelle bands, and the wide and narrow stripes that sweep from the rear fuselage up the fin, Russian flag on the fin tip, АН-124-100 on the nose. Registration RA-82099 is fictional. Approximate colors.",
        [refs.vd],
        paintAll(WHITE, {
          [EXT]: {
            color: WHITE,
            zones: [
              ...line(VD_BLUE, 4.62, 5.72),
              ...line(VD_BLUE, 5.86, 5.96),
              ...line(VD_BLUE, 4.38, 4.47),
              diagonal(VD_BLUE, -14.6, 1.7, EXT),
              diagonal(VD_BLUE, -16.75, 0.4, EXT),
              ...tips(RED),
            ],
          },
          [RUDDER]: {
            color: WHITE,
            zones: [diagonal(VD_BLUE, -14.6, 1.7, RUDDER), diagonal(VD_BLUE, -16.75, 0.4, RUDDER)],
          },
          ...tipSlots(RED),
        }),
        [
          ...leading('fin-top-flag', 'russian-flag'),
          ...both('aft-reg', 'reg-ra82099'),
          ...both('nose-type', 'type-blue'),
        ],
      ),
      variant(
        'cargo-blue-belly',
        'Heavy-lift cargo, blue belly and tail',
        "Civil heavy-lift cargo scheme in the real colors and layout of Polet's An-124s (referenced photograph), without operator names or logos: white upper fuselage over a dark blue belly with three white slanted stripes ahead of the wing, blue nacelles, blue fin and rudder with two white stripes, Russian flag by the cockpit, АН-124-100 on the nose. Registration RA-82098 is fictional. Approximate colors and stripe geometry.",
        [refs.polet],
        (() => {
          const slash = (z0) => ({
            color: WHITE,
            planes: [
              space.sideLine(EXT, [z0, 1.4], [z0 + 2.4, 5.6], -1),
              space.sideLine(EXT, [z0 - 0.38, 1.4], [z0 + 2.02, 5.6], 1),
              space.below(EXT, 5.05),
              space.plane(EXT, [-1, 0, 0], [4.2, 0, 0]),
              space.plane(EXT, [1, 0, 0], [-4.2, 0, 0]),
            ],
          });
          const finStripe = (slot, z0) => ({
            color: WHITE,
            planes: [
              space.sideLine(slot, [z0, 10], [z0 - 9, 21.5], -1),
              space.sideLine(slot, [z0 - 0.45, 10], [z0 - 9.45, 21.5], 1),
              space.above(slot, 10.1),
            ],
          });
          const finBlue = {
            color: PL_BLUE,
            planes: [space.above(EXT, 10.05), space.behind(EXT, -16)],
          };
          return paintAll(WHITE, {
            [EXT]: {
              color: WHITE,
              zones: [
                ...under(PL_BLUE, 5.1),
                ...nacelles(PL_BLUE),
                slash(8.2),
                slash(7.45),
                slash(6.7),
                finBlue,
                finStripe(EXT, -19.6),
                finStripe(EXT, -20.6),
                ...tips(RED).slice(0, 2),
              ],
            },
            [RUDDER]: {
              color: PL_BLUE,
              zones: [finStripe(RUDDER, -19.6), finStripe(RUDDER, -20.6)],
            },
            ...tipSlots(RED),
          });
        })(),
        [
          ...leading('nose-flag', 'russian-flag-small'),
          ...both('aft-reg', 'reg-ra82098'),
          ...both('nose-type-high', 'type-blue'),
        ],
      ),
      variant(
        'soviet-era-1988',
        'Soviet era, white and gray with blue cheatline',
        'Soviet-era An-124 scheme of the late 1980s (referenced Farnborough 1988 photograph) without the airline title: white upper fuselage, gray belly and nacelles, a blue cheatline rising with the tail and the red state flag on the fin (original simplified drawing). Registration CCCP-82097 is fictional. Approximate colors.',
        [refs.aeroflot],
        paintAll(WHITE, {
          [EXT]: {
            color: WHITE,
            zones: [...under('#b9c0c4', 4.6), ...nacelles('#b9c0c4'), ...line(AF_BLUE, 4.78, 5.18)],
          },
        }),
        [
          ...leading('fin-flag', 'soviet-flag'),
          ...both('aft-reg', 'reg-cccp'),
          ...both('nose-type', 'type-blue'),
        ],
      ),
      variant(
        'design-bureau-cyan-tail',
        'Ukrainian design bureau, cyan tail',
        'Antonov Design Bureau An-124-100 scheme of the 2000s (referenced photograph) without its titles: white with a thin dark blue cheatline and light gray belly, cyan fin and rudder, Ukrainian flag by the cockpit, АН-124-100 on the nose. Registration UR-82096 is fictional. Approximate colors.',
        [refs.adb],
        paintAll(WHITE, {
          [EXT]: {
            color: WHITE,
            zones: [
              ...under('#d3d8db', 4.5),
              ...line('#26357e', 4.9, 5.06),
              { color: ADB_CYAN, planes: [space.above(EXT, 10.05), space.behind(EXT, -16)] },
              ...tips(RED),
            ],
          },
          [RUDDER]: { color: ADB_CYAN },
          ...tipSlots(RED),
        }),
        [
          ...leading('nose-flag', 'ukraine-flag'),
          ...both('aft-reg', 'reg-ur'),
          ...both('nose-type', 'type-blue'),
        ],
      ),
    ],
  };
}
