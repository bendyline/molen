/**
 * Bell 412EP liveries: RCAF CH-146 Griffon (CF green camouflage, and the yellow and red
 * search-and-rescue scheme of 417 Combat Support Squadron), the Royal Norwegian Air Force's
 * 412SP, a Japanese prefectural police scheme and an Australian rescue operator's red and white.
 * Military insignia, serials and titles are original vector redrawings; the civil schemes show
 * colors and layout only (no names, crests or logos; registrations are fictional).
 *
 * Model frame: +Z nose, +X the aircraft's left, +Y up. Cabin sides x ±1.2 (y 0.73–2.11) from the
 * crew door (z 1.04–1.65) back to z -1.5; the nose reaches z 4.03; the engine cowling sides stand
 * at x ±0.71 (y 2.3–2.6); the boom runs z -2.65 to -8.88 and the broad fin (x ±0.07) z -7.45 to
 * -9.04 above y 1.6.
 */
import {
  both,
  canadaFlag,
  commons,
  forward,
  japanFlag,
  label,
  PAINT,
  rcafRoundel,
  sidePair,
} from '../art-helicopters-b.mjs';

const BODY = 'body';

export function slots() {
  return {
    [BODY]: { materials: ['412-ivory'], node: '412-exterior-412-ivory' },
    'tail-rotor-tips': { materials: ['412-ivory'], node: '412-tail-rotor-412-ivory' },
  };
}

const WHITE = PAINT.white,
  BLACK = PAINT.stencilBlack;

/** Boom stations from the builder: z, half-width at the centre line, centre height. */
const BOOM = [
  [-2.65, 0.58, 1.5375],
  [-4.5, 0.36, 1.671],
  [-6.9, 0.2, 1.86],
  [-8.6, 0.12, 1.985],
];
function boomAt(z) {
  const i = Math.max(
    0,
    BOOM.findIndex((s, k) => k < BOOM.length - 1 && z <= s[0] && z >= BOOM[k + 1][0]),
  );
  const a = BOOM[i],
    b = BOOM[i + 1],
    u = (a[0] - z) / (a[0] - b[0]);
  return { x: a[1] + (b[1] - a[1]) * u, y: a[2] + (b[2] - a[2]) * u };
}

export default function design({ kit: k, space }) {
  const onBoom = (name, z, dy, width, height) => {
    const { x, y } = boomAt(z);
    return sidePair(space, name, {
      slot: BODY,
      at: (s) => [s * x, y + dy, z],
      facing: [1, 0, -0.1],
      up: [0, 1, 0.06],
      width,
      height,
      depth: 0.4,
    });
  };
  const onSide = (name, x, z, y, width, height, depth = 0.3) =>
    sidePair(space, name, {
      slot: BODY,
      at: (s) => [s * x, y, z],
      width,
      height,
      depth,
    });
  const onFin = (name, z, y, width, height) =>
    sidePair(space, name, {
      slot: BODY,
      at: (s) => [s * 0.07, y, z],
      width,
      height,
      depth: 0.08,
    });
  const anchors = {
    ...onBoom('boom-roundel', -3.15, 0, 0.5, 0.5),
    ...onBoom('boom-reg', -4.25, 0.02, 1.3, 0.3),
    ...onSide('nose-number', 1.2, 2.42, 1.03, 0.42, 0.2),
    ...onSide('crew-door', 1.2, 1.33, 0.98, 0.42, 0.2),
    ...onSide('cabin-title', 1.2, 0.4, 0.92, 0.8, 0.28),
    ...onSide('cowl', 0.716, -0.75, 2.45, 0.5, 0.24, 0.2),
    ...onSide('window-1', 1.2, 0.6, 1.6, 0.82, 0.78),
    ...onSide('window-2', 1.2, -0.38, 1.57, 0.84, 0.78),
    ...onFin('fin-flag', -8.38, 2.78, 0.44, 0.22),
    ...onFin('fin-serial', -8.33, 2.5, 0.6, 0.13),
    ...onFin('fin-number', -8.3, 2.6, 0.48, 0.28),
  };

  const graphics = {
    'rcaf-roundel': rcafRoundel(new k.Canvas(0.5, 0.5), 0.25, 0.25, 0.24).graphic('RCAF roundel'),
    'rcaf-roundel-lowvis': rcafRoundel(new k.Canvas(0.5, 0.5), 0.25, 0.25, 0.24, {
      lowvis: true,
    }).graphic('RCAF roundel (low visibility)'),
    'canada-flag': canadaFlag(new k.Canvas(0.44, 0.22), 0, 0, 0.44, 0.22).graphic('Canadian flag'),
    'ch146-474': label(k, '474', 0.42, 0.2, BLACK, { fill: 0.85 }),
    'ch146-474-serial': label(k, '146474', 0.6, 0.13, BLACK, { fill: 0.75 }),
    'ch146-417': label(k, '417', 0.42, 0.2, BLACK, { fill: 0.85 }),
    'ch146-417-serial': label(k, '146417', 0.6, 0.13, BLACK, { fill: 0.75 }),
    'rescue-sauvetage': new k.Canvas(0.8, 0.28)
      .text(BLACK, 'RESCUE', { x: 0.4, y: 0.205, height: 0.09 })
      .text(BLACK, 'SAUVETAGE', { x: 0.4, y: 0.075, height: 0.09 })
      .graphic('RESCUE SAUVETAGE'),
    'norway-roundel': k
      .roundel(new k.Canvas(0.5, 0.5), 0.25, 0.25, 0.2, k.ROUNDELS.norway)
      .graphic('Norwegian roundel'),
    'norway-148': label(k, '148', 0.42, 0.2, '#b9bdb5', { fill: 0.85 }),
    'norway-148-fin': label(k, '148', 0.48, 0.28, '#a9ada6', { fill: 0.85 }),
    'japan-flag': japanFlag(new k.Canvas(0.36, 0.24), 0, 0, 0.36, 0.24).graphic('Japanese flag'),
    'police-reg': label(k, 'JA21RP', 0.6, 0.13, '#1c2f6e', { fill: 0.8 }),
    'rescue-number': label(k, '106', 0.5, 0.24, BLACK, { fill: 0.85 }),
    'rescue-reg': label(k, 'VH-ZRH', 1.3, 0.3, WHITE, { fill: 0.8 }),
  };
  // Red frames round the two cabin windows (window plus about 5 cm of frame).
  const frame = (w, h, ww, wh, r, t) => {
    const c = new k.Canvas(w, h);
    const rounded = (x0, y0, x1, y1, rad) => {
      const pts = [];
      for (const [cx, cy, a0] of [
        [x1 - rad, y1 - rad, 0],
        [x0 + rad, y1 - rad, Math.PI / 2],
        [x0 + rad, y0 + rad, Math.PI],
        [x1 - rad, y0 + rad, (3 * Math.PI) / 2],
      ])
        for (let i = 0; i <= 6; i++) {
          const a = a0 + (i * Math.PI) / 12;
          pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
        }
      return pts;
    };
    const x0 = (w - ww) / 2,
      y0 = (h - wh) / 2;
    c.add(PAINT.red, rounded(x0 - t, y0 - t, x0 + ww + t, y0 + wh + t, r + t), [
      rounded(x0, y0, x0 + ww, y0 + wh, r).reverse(),
    ]);
    return c.graphic('Window frame');
  };
  graphics['frame-1'] = frame(0.82, 0.78, 0.66, 0.605, 0.09, 0.055);
  graphics['frame-2'] = frame(0.84, 0.78, 0.68, 0.6, 0.09, 0.055);

  // RCAF SAR: red engine deck and roof aft of the cockpit, a red band sweeping down and aft
  // across the cabin door, a black anti-glare panel ahead of the windscreen.
  const sarYellow = '#f0b31c',
    sarRed = '#c8202a';
  const sarZones = [
    {
      color: sarRed,
      planes: [space.above(BODY, 2.17), space.behind(BODY, 1.2), space.ahead(BODY, -2.6)],
    },
    {
      color: sarRed,
      planes: [
        space.sideLine(BODY, [1.2, 2.3], [-0.1, 0.6], -1),
        space.sideLine(BODY, [1.58, 2.3], [0.28, 0.6], 1),
        space.ahead(BODY, -1.0),
      ],
    },
    {
      color: '#2a2d2f',
      planes: [space.ahead(BODY, 2.95), space.above(BODY, 1.36)],
    },
  ];

  // Japanese police: light metallic blue over silver, a navy cheatline with a white pinstripe
  // rising along the boom, an orange band behind the crew door and a yellow boom band.
  const policeBlue = '#3e8ccc',
    navy = '#1c2f6e',
    silver = '#b7bdc2';
  // Boom-width slab: keeps boom bands off the horizontal stabilizer.
  const boomOnly = [
    space.plane(BODY, [-1, 0, 0], [0.45, 0, 0]),
    space.plane(BODY, [1, 0, 0], [-0.45, 0, 0]),
  ];
  // Below a cheatline at `y` on the cabin that rises with the aft fuselage and boom: two convex
  // pieces split at the cabin's aft wall. Later zones paint over earlier ones.
  const belowLine = (y, color) => [
    { color, planes: [space.ahead(BODY, -1.5), space.below(BODY, y)] },
    {
      color,
      planes: [
        space.behind(BODY, -1.5),
        space.ahead(BODY, -3.0),
        space.sideLine(BODY, [-1.5, y], [-3.0, y + 0.5], -1),
      ],
    },
    {
      color,
      planes: [
        space.behind(BODY, -3.0),
        space.sideLine(BODY, [-3.0, y + 0.5], [-8.9, y + 0.9], -1),
        // Not across the horizontal stabilizer, which stays blue.
        ...boomOnly,
      ],
    },
  ];
  const policeZones = [
    ...belowLine(1.13, WHITE),
    ...belowLine(1.1, navy),
    ...belowLine(0.95, silver),
    {
      color: '#ef5a24',
      planes: [
        space.ahead(BODY, 0.98),
        space.behind(BODY, 1.2),
        space.above(BODY, 1.13),
        space.below(BODY, 2.2),
      ],
    },
    {
      color: '#f2c230',
      planes: [
        space.ahead(BODY, -7.3),
        space.behind(BODY, -6.95),
        space.sideLine(BODY, [-3.0, 1.63], [-8.9, 2.03], 1),
      ],
    },
    {
      color: WHITE,
      planes: [space.behind(BODY, -7.4), space.above(BODY, 2.42), space.below(BODY, 2.6)],
    },
  ];

  // Rescue: red cockpit section ahead of the cabin door, red boom, black pinstripes.
  const rescueZones = [
    { color: BLACK, planes: [space.ahead(BODY, 1.02), space.below(BODY, 2.22)] },
    { color: PAINT.red, planes: [space.ahead(BODY, 1.06), space.below(BODY, 2.18)] },
    {
      color: BLACK,
      planes: [
        space.sideLine(BODY, [-2.15, 2.4], [-2.55, 0.8], 1),
        space.sideLine(BODY, [-7.0, 2.42], [-8.95, 1.82], -1),
        ...boomOnly,
      ],
    },
    {
      color: PAINT.red,
      planes: [
        space.sideLine(BODY, [-2.2, 2.4], [-2.6, 0.8], 1),
        space.sideLine(BODY, [-7.0, 2.36], [-8.95, 1.76], -1),
        ...boomOnly,
      ],
    },
  ];

  const ref = {
    ch146: commons(
      'RCAF CH-146 Griffon of 430 Squadron over Wisconsin, 2006 (USAF, public domain)',
      'CH-146 Griffon Helicopter.jpg',
    ),
    ch146_403: commons(
      'RCAF CH-146 Griffon 146474 of 403 Squadron (Commons, CC BY-SA 4.0)',
      'Bell CH-146 Griffin, 403 Sqn.JPG',
    ),
    ch146_417: commons(
      'RCAF CH-146 Griffon 146417 of 417 Combat Support Squadron (Commons, CC BY-SA 2.0)',
      '417 Sqdn CH-146 Griffon (2982559499).jpg',
    ),
    norway: commons(
      "RNoAF Bell 412SP '148' (Commons, CC BY-SA 2.0)",
      'Bell 412SP ‘148’ (49518597807).jpg',
    ),
    norway162: commons(
      "RNoAF Bell 412SP '162', 2009 (Commons, CC BY 2.0)",
      'Bell 412SP ‘162’ - 2009.jpg',
    ),
    police: commons(
      'Fukuoka Prefectural Police Bell 412EP JA01FP, 2008 (Commons, CC0)',
      'Fukuoka Police-Bell 412EP-JA01FP-Fukuoka airport-20081212-152838.JPG',
    ),
    rescue: commons(
      'CHC Helicopter Australia Bell 412EP VH-EPH at Wagga Wagga (Commons, CC BY-SA 3.0 AU)',
      'CHC Helicopter Australia (VH-EPH) Bell 412EP at Wagga Wagga Airport.jpg',
    ),
  };

  return {
    selected: 'rcaf-ch146-sar',
    anchors,
    graphics,
    variants: [
      {
        id: 'rcaf-ch146-sar',
        label: 'RCAF CH-146 Griffon, 417 Combat Support Squadron',
        provenance: {
          kind: 'inspired',
          note: 'CH-146 Griffon 146417 in the RCAF search-and-rescue scheme of 417 Combat Support Squadron, Cold Lake: SAR yellow with a red engine deck and a red band sweeping down across the cabin door, black anti-glare panel, RCAF roundel on the boom, Canadian flag and serial on the fin, 417 on the nose and RESCUE / SAUVETAGE on the cabin door, all redrawn. The Government of Canada wordmark is omitted. Approximate colors and band geometry.',
          references: [ref.ch146_417],
        },
        paints: { [BODY]: { color: sarYellow, zones: sarZones } },
        markings: [
          ...forward('boom-roundel', 'rcaf-roundel'),
          ...forward('fin-flag', 'canada-flag'),
          ...both('fin-serial', 'ch146-417-serial'),
          ...both('nose-number', 'ch146-417'),
          ...both('cabin-title', 'rescue-sauvetage'),
        ],
      },
      {
        id: 'rcaf-ch146-camouflage',
        label: 'RCAF CH-146 Griffon, tactical camouflage',
        provenance: {
          kind: 'inspired',
          note: 'CH-146 Griffon 146474 (403 Squadron) in the two-tone CF green tactical camouflage, matched against the 430 Squadron photograph: a generated two-green pattern (not the exact pattern), low-visibility roundel on the boom, 474 on the crew door and the serial on the fin. The Government of Canada wordmark is omitted. Approximate colors.',
          references: [ref.ch146_403, ref.ch146],
        },
        paints: {
          [BODY]: {
            color: '#45533a',
            camouflage: {
              colors: ['#4a5a3d', '#262c24'],
              scale: 2.6,
              seed: 146474,
              style: 'blotch',
            },
          },
        },
        markings: [
          ...forward('boom-roundel', 'rcaf-roundel-lowvis'),
          ...both('crew-door', 'ch146-474'),
          ...both('fin-serial', 'ch146-474-serial'),
        ],
      },
      {
        id: 'rnoaf-412sp',
        label: 'Royal Norwegian Air Force 412SP',
        provenance: {
          kind: 'inspired',
          note: "Royal Norwegian Air Force Bell 412SP '148' (339 / 720 Squadron era): dark olive grey overall, the Norwegian roundel on the boom root and light grey 148 on the nose and fin, redrawn. The squadron badge is omitted; the 412EP model stands in for the 412SP. Approximate colors.",
          references: [ref.norway, ref.norway162],
        },
        paints: { [BODY]: { color: '#3f453c' } },
        markings: [
          ...both('boom-roundel', 'norway-roundel'),
          ...both('nose-number', 'norway-148'),
          ...both('fin-number', 'norway-148-fin'),
        ],
      },
      {
        id: 'japan-police',
        label: 'Japanese prefectural police',
        provenance: {
          kind: 'inspired',
          note: 'Japanese prefectural police colors and layout from the referenced Fukuoka photograph: light metallic blue over silver with a navy cheatline and white pinstripe rising along the boom, an orange band behind the crew door, a yellow boom band, the Japanese flag on the engine cowling and the registration on a white fin band. Police titles, nickname and badge are omitted; the registration JA21RP is fictional.',
          references: [ref.police],
        },
        paints: {
          [BODY]: { color: policeBlue, metalness: 0.25, roughness: 0.4, zones: policeZones },
        },
        markings: [...forward('cowl', 'japan-flag'), ...both('fin-serial', 'police-reg')],
      },
      {
        id: 'australia-rescue',
        label: 'Australian rescue operator, red and white',
        provenance: {
          kind: 'inspired',
          note: 'Australian rescue Bell 412EP colors and layout from the referenced VH-EPH photograph: white with a red cockpit section ahead of the cabin door, red-framed cabin windows, a red boom edged in black pinstripes to a white fin, fleet number on the cowling and the registration in white on the boom. Operator names and logos are omitted; fleet number 106 and registration VH-ZRH are fictional.',
          references: [ref.rescue],
        },
        paints: { [BODY]: { color: WHITE, zones: rescueZones } },
        markings: [
          ...both('window-1', 'frame-1'),
          ...both('window-2', 'frame-2'),
          ...both('cowl', 'rescue-number'),
          ...both('boom-reg', 'rescue-reg'),
        ],
      },
    ],
  };
}
