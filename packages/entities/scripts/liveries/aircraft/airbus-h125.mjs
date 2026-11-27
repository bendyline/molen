/**
 * Airbus H125 (AS350 B3e) liveries: Swiss mountain rescue and utility red with the white star
 * swoosh, French Gendarmerie navy, South African Police Service, Brazilian Army camouflage and
 * others, each studied from a photograph. Military titles, roundels and serials are shown; civil
 * operators keep their colors and layout with fictional registrations and no names or logos.
 * Lettering is real type and every emblem and star field is an original vector drawing.
 */
import {
  both,
  lettering,
  P,
  pair,
  random,
  scheme,
  sideAnchors,
  sideArt,
  sideOf,
} from '../art-helicopters-a.mjs';

export function slots() {
  return {
    // Cabin, fin, horizontal stabilizer, skids and cross tubes.
    shell: { materials: ['H125-white'], node: 'H125-airframe-H125-white' },
    // Lower-side band, engine cowling and tail boom.
    accent: { materials: ['H125-blue'], node: 'H125-airframe-H125-blue' },
  };
}

// Boom loft stations (z, half width, centre height, half height) from the H125 builder.
const BOOM = [
  [-1.8, 0.42, 1.58, 0.45],
  [-3.7, 0.31, 1.7, 0.34],
  [-5.3, 0.21, 1.79, 0.23],
  [-7.28, 0.05, 1.86, 0.06],
];
function boomAt(z) {
  for (let i = 0; i < BOOM.length - 1; i++) {
    const a = BOOM[i],
      b = BOOM[i + 1];
    if (z <= a[0] && z >= b[0]) {
      const u = (a[0] - z) / (a[0] - b[0]);
      return [1, 2, 3].map((k) => a[k] + (b[k] - a[k]) * u);
    }
  }
  throw new Error(`H125 boom station ${z} out of range`);
}

const WHITE = '#f3f3f0';

export default function design({ kit: k, space }) {
  const exterior = ['shell', 'accent'];
  const anchors = {};
  const add = (...more) => Object.assign(anchors, ...more);
  // Boom lettering, level (the H125 boom top is level).
  const boomAnchor = (name, z, y, width, height) => {
    const [w] = boomAt(z);
    add(
      pair(space, name, (side) => ({
        slot: 'accent',
        center: [side * w, y, z],
        width,
        height,
        depth: Math.min(0.6, w * 1.6),
      })),
    );
  };
  boomAnchor('boom-reg', -3.7, 1.72, 1.3, 0.26);
  boomAnchor('boom-title', -3.3, 1.7, 1.5, 0.3);
  // Cabin doors, below the window line; the rear cabin behind the rear door.
  add(
    pair(space, 'door-title', (side) => ({
      slot: 'shell',
      center: [side * 0.93, 1.17, 1.06],
      width: 0.86,
      height: 0.16,
      depth: 0.6,
    })),
    pair(space, 'rear-cabin', (side) => ({
      slot: 'shell',
      center: [side * 0.9, 1.62, 0.06],
      width: 0.4,
      height: 0.4,
      depth: 0.6,
    })),
    // Engine cowling flank (it leans in slightly toward the crown).
    pair(space, 'cowl', (side) => ({
      slot: 'accent',
      center: [side * 0.45, 2.33, 0.2],
      facing: [side, 0.12, 0],
      width: 0.6,
      height: 0.2,
      depth: 0.3,
    })),
    pair(space, 'cowl-flag', (side) => ({
      slot: 'accent',
      center: [side * 0.44, 2.42, 0.95],
      facing: [side, 0.12, 0],
      width: 0.24,
      height: 0.16,
      depth: 0.3,
    })),
    // Upper fin, near the tip: chord about 0.4 m at 2.85 m.
    pair(space, 'fin-tip', (side) => ({
      slot: 'shell',
      center: [side * 0.035, 2.82, -7.22],
      width: 0.2,
      height: 0.2,
      depth: 0.05,
    })),
  );

  const graphics = {
    'swiss-cross': k.swissMark(new k.Canvas(0.2, 0.2), 0.1, 0.1, 0.2).graphic('Swiss cross'),
  };

  /* ------------------------------------------------ Swiss red with the star swoosh ---- */
  const ZRED = '#b9131f';
  // The white swoosh: a band about 0.85 m wide (along the fuselage) running down and forward at
  // about 45 degrees from the rear of the cowling crown to the foot of the rear door.
  const front = [
      [-0.6, 2.85],
      [1.45, 0.6],
    ],
    rear = [
      [-1.4, 2.85],
      [0.55, 0.6],
    ],
    inside = [-0.05, 1.8];
  const inSwoosh = (z, y) =>
    y > 0.72 &&
    sideOf(...front, [z, y]) === sideOf(...front, inside) &&
    sideOf(...rear, [z, y]) === sideOf(...rear, inside);
  const swoosh = {
    color: WHITE,
    planes: [P.keep(...front, inside), P.keep(...rear, inside), P.above(0.72)],
  };
  // Stars: red ones inside the swoosh, largest at its top; white ones scattered on the red
  // behind and below it, trailing back toward the boom.
  const stars = (() => {
    const rnd = random(1854),
      out = [];
    const top = [-1.0, 2.85],
      foot = [1.0, 0.6];
    for (let i = 0; i < 15; i++) {
      const t = (i + 0.2 + rnd() * 0.6) / 15,
        across = (rnd() - 0.5) * 0.55,
        z = top[0] + (foot[0] - top[0]) * t + across,
        y = top[1] + (foot[1] - top[1]) * t,
        r = 0.145 - 0.075 * t + rnd() * 0.02;
      if (inSwoosh(z, y)) out.push([z, y, r, rnd()]);
    }
    for (let i = 0; i < 34; i++) {
      const t = rnd(),
        back = 0.15 + rnd() * 1.1,
        z = -1.4 + 1.95 * t - back,
        y = 2.85 - 2.25 * t + (rnd() - 0.5) * 0.3,
        r = 0.035 + rnd() * 0.055;
      if (y > 0.85 && y < 2.3 && !inSwoosh(z, y)) out.push([z, y, r, rnd()]);
    }
    return out;
  })();
  const starBox = (z, y, width, height) => ({ z, y, width, height });
  // One star field for the cabin skin and the cowling/boom root, projected from the side.
  const starsBox = starBox(-0.2, 1.8, 3.6, 2.2),
    boomRootBox = starBox(-2.6, 1.75, 1.8, 0.9);
  graphics['zr-stars'] = sideArt(k, starsBox, 'star swoosh', (c, at) => {
    for (const [z, y, r, a] of stars) {
      const [x, v] = at(z, y);
      c.star(inSwoosh(z, y) ? ZRED : WHITE, x, v, r, r * 0.4, 5, (a - 0.5) * 0.5);
    }
  });
  graphics['zr-stars-boom'] = sideArt(k, boomRootBox, 'stars along the boom', (c, at) => {
    const rnd = random(1957);
    for (let i = 0; i < 9; i++) {
      const z = -1.9 - i * 0.18 - rnd() * 0.06,
        [, y, h] = boomAt(z),
        v = y + (rnd() - 0.3) * h * 0.9,
        [x, yy] = at(z, v);
      c.star(WHITE, x, yy, 0.045 - i * 0.003, (0.045 - i * 0.003) * 0.4, 5, rnd() * 0.3);
    }
  });
  add(sideAnchors(space, 'zr-cabin', 'shell', starsBox, 0.93, 0.7));
  add(sideAnchors(space, 'zr-cowl', 'accent', starsBox, 0.6, 1.0));
  add(sideAnchors(space, 'zr-boom', 'accent', boomRootBox, 0.4, 0.5));
  graphics['zr-reg'] = lettering(k, 'HB-ZKV', 1.3, 0.26, WHITE, { capHeight: 0.2 });
  const finLower = { color: WHITE, planes: [P.behind(-6.2), P.below(1.72)], only: ['shell'] };
  const skids = (color) => ({ color, planes: [P.below(0.56)], only: ['shell'] });

  /* ------------------------------------------------------------ Gendarmerie navy ---- */
  const NAVY = '#1b2b5e';
  const stripeW = 0.075;
  const rise = [
      [0.42, 1.3],
      [-0.32, 2.5],
    ],
    riseOut = rise.map(([z, y]) => [z - stripeW * 1.2, y]);
  const gendarmerieZones = [
    // Under the upper windows from the nose back past the rear door.
    { color: WHITE, planes: [P.above(1.32), P.below(1.32 + stripeW), P.ahead(0.42)] },
    // Rising behind the rear door to the cowling.
    {
      color: WHITE,
      planes: [
        P.keep(...rise, [0, 1.5]),
        P.keep(...riseOut, [1, 1.5]),
        P.above(1.32),
        P.below(2.53),
      ],
    },
    // Along the cowling flank, forward to its nose.
    {
      color: WHITE,
      planes: [P.above(2.45), P.below(2.45 + stripeW), P.ahead(-0.4), P.behind(1.45)],
      only: ['accent'],
    },
    // Along the boom.
    {
      color: WHITE,
      planes: [P.above(1.86), P.below(1.86 + 0.05), P.behind(-1.95)],
      only: ['accent'],
    },
    // Fin: white with a navy stripe parallel to its leading edge.
    { color: WHITE, planes: [P.behind(-6.2)], only: ['shell'] },
    {
      color: NAVY,
      planes: [
        P.keep([-6.42, 1.85], [-7.44, 3.24], [-8, 2]),
        P.keep([-6.56, 1.85], [-7.58, 3.24], [-6, 2]),
        P.above(1.85),
      ],
      only: ['shell'],
    },
    skids('#1d2024'),
  ];
  graphics['gn-title'] = lettering(k, 'GENDARMERIE', 0.86, 0.16, WHITE, {
    capHeight: 0.095,
    tracking: 0.06,
  });
  graphics['gn-code'] = lettering(k, 'JBQ', 0.6, 0.2, WHITE, { capHeight: 0.15, slant: 0.12 });
  graphics['roundel-fr'] = k
    .roundel(new k.Canvas(0.4, 0.4), 0.2, 0.2, 0.17, k.ROUNDELS.france)
    .graphic('French roundel');

  /* ------------------------------------------------ South African Police Service ---- */
  const SAPS_BLUE = '#1f4b9c';
  const sapsZones = [
    // Blue belly under the cabin, swept up into the boom behind the rear doors.
    { color: SAPS_BLUE, planes: [P.below(0.98)], only: ['shell'] },
    {
      color: SAPS_BLUE,
      planes: [P.keep([0.35, 0.95], [-1.95, 2.15], [-2, 0.5])],
      only: ['shell'],
    },
    { color: SAPS_BLUE, planes: [P.behind(-4.5)], only: ['shell'] },
    skids('#1b2a4a'),
  ];
  graphics['za-reg'] = lettering(k, 'ZS-RQM', 1.3, 0.26, WHITE, { capHeight: 0.17 });
  graphics['flag-za'] = (() => {
    const w = 0.24,
      h = 0.16,
      c = new k.Canvas(w, h);
    c.rect('#e03c31', 0, h / 2, w, h / 2);
    c.rect('#001489', 0, 0, w, h / 2);
    const band = h * 0.2,
      edge = h * 0.067;
    const pall = (half) => [
      [0, h + half * 1.2],
      [w * 0.38, h / 2 + half],
      [w, h / 2 + half],
      [w, h / 2 - half],
      [w * 0.38, h / 2 - half],
      [0, -half * 1.2],
    ];
    c.add(WHITE, pall(band / 2 + edge));
    c.add('#007749', pall(band / 2));
    c.add('#ffb81c', [
      [0, h * 0.83],
      [w * 0.34, h / 2],
      [0, h * 0.17],
    ]);
    c.add('#000000', [
      [0, h * 0.75],
      [w * 0.28, h / 2],
      [0, h * 0.25],
    ]);
    return c.graphic('South African flag');
  })();

  /* ------------------------------------------- Alaska glacier tours red and silver ---- */
  const TOUR_RED = '#c62a2a',
    SILVER = '#c8ccce';
  const tourZones = [
    // Silver nose cap and white upper cabin above the lower door windows, back to the rear door.
    { color: WHITE, planes: [P.above(1.31), P.ahead(0.5)], only: ['shell'] },
    {
      color: SILVER,
      metalness: 0.55,
      roughness: 0.3,
      planes: [P.above(0.97), P.ahead(2.62)],
      only: ['shell'],
    },
    // White cowling front with the red running up behind it.
    { color: WHITE, planes: [P.above(2.15), P.ahead(-0.9)], only: ['accent'] },
    // The lower-side band stays red with the belly.
    skids(TOUR_RED),
  ];
  graphics['tour-reg'] = lettering(k, 'N6127T', 1.3, 0.26, WHITE, { capHeight: 0.21 });

  /* ------------------------------------------ Swiss charter anthracite with red flash ---- */
  const ANTHRACITE = '#43464b',
    FLASH = '#c3202b';
  // The flash runs low under the door windows, then turns up the rear cabin to the cowling.
  const knee = [0.48, 1.36];
  const low = (dy) => [
      [2.45, 0.92 + dy],
      [knee[0], knee[1] + dy],
    ],
    steep = (dz) => [
      [knee[0] + dz, knee[1]],
      [-0.7 + dz, 2.58],
    ];
  const anthraciteZones = [
    {
      color: FLASH,
      planes: [
        P.keep(...low(0), [1.5, 3]),
        P.keep(...low(0.1), [1.5, -1]),
        P.ahead(knee[0] - 0.07),
      ],
    },
    {
      color: FLASH,
      planes: [
        P.keep(...steep(-0.07), [2, 1.8]),
        P.keep(...steep(0.07), [-2, 1.8]),
        P.above(knee[1]),
        P.below(2.6),
      ],
    },
    // A thinner second flash behind the first, on the cowling flank.
    {
      color: FLASH,
      planes: [
        P.keep(...steep(-0.36), [2, 1.8]),
        P.keep(...steep(-0.3), [-2, 1.8]),
        P.above(1.8),
        P.below(2.6),
      ],
    },
    // Thin red line along the upper boom.
    { color: FLASH, planes: [P.above(1.93), P.below(1.97), P.behind(-1.9)], only: ['accent'] },
    skids('#2a2c30'),
  ];
  graphics['anthracite-reg'] = lettering(k, 'HB-ZRN', 1.3, 0.26, WHITE, {
    capHeight: 0.19,
    slant: 0.15,
  });

  const references = {
    sancy: {
      title: 'Gendarmerie Écureuil taking off at the Sancy (Fabien1309, CC BY-SA 2.0 fr)',
      url: 'https://commons.wikimedia.org/wiki/File:Helicopter_rescue_sancy_takeoff.jpg',
    },
    temsco: {
      title: 'AS350 tour helicopter on the Mendenhall Glacier, Alaska (CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Helicopter,_Mendenhall_Glacier,_Alaska.jpg',
    },
    valdisere: {
      title: "Évacuation médicale - Airbus Helicopters H125 - Val d'Isère (CC BY 2.0)",
      url: 'https://commons.wikimedia.org/wiki/File:%C3%89vacuation_m%C3%A9dicale_-_Airbus_Helicopters_H125_-_Val_d%27Is%C3%A8re.jpg',
    },
    zermatt: {
      title: 'H125 HB-ZPB of Air Zermatt, Raron (Olivier Balmain, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:H125_Astar_Air_Zermatt_HB-ZPB_(41350562515).jpg',
    },
    gendarmerie: {
      title: 'AS350 B Écureuil F-MJCV of the Gendarmerie nationale (CC BY-SA 2.0 fr)',
      url: 'https://commons.wikimedia.org/wiki/File:AS350b_Ecureuil_F-MJCV-IMG_5138.jpg',
    },
    saps: {
      title: 'South African Police Service AS350 B3 ZS-RPL (CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:South_African_Police_AS350_B3_ZS-RPL_(6918351305).jpg',
    },
  };

  return {
    selected: 'swiss-red-star-swoosh',
    anchors,
    graphics,
    variants: [
      {
        id: 'swiss-red-star-swoosh',
        label: 'Swiss mountain rescue red',
        provenance: {
          kind: 'inspired',
          note: "Swiss mountain rescue and utility H125 from the referenced photograph of HB-ZPB: deep red overall with a broad white swoosh leaning forward across the rear cabin and cowling, red stars inside it and white stars trailing onto the boom (an original scatter, not the operator's star placement), a white lower fin, the registration in white on the boom and the Swiss cross on the fin. The registration is fictional (HB-ZKV); the operator's name and all sponsor logos are omitted. Colors are approximate.",
          references: [references.zermatt],
        },
        paints: scheme(space, exterior, ZRED, [swoosh, finLower, skids('#cfd2d2')], {
          roughness: 0.3,
        }),
        markings: [
          ...both('zr-cabin', 'zr-stars', true),
          ...both('zr-cowl', 'zr-stars', true),
          ...both('zr-boom', 'zr-stars-boom', true),
          ...both('boom-reg', 'zr-reg'),
          ...both('fin-tip', 'swiss-cross'),
        ],
      },
      {
        id: 'gendarmerie-nationale',
        label: 'Gendarmerie nationale',
        provenance: {
          kind: 'inspired',
          note: 'French Gendarmerie nationale Écureuil from the referenced photograph: dark navy blue overall with a white cheatline under the upper windows that rises behind the rear door and runs forward along the cowling, a thin white line along the boom, a white fin with a navy stripe, the GENDARMERIE title on the rear door, the French roundel behind it and the last three letters of the registration on the cowling. The code is fictional (JBQ; the photographed aircraft is F-MJCV); the unit badge and stencils are omitted. Colors and line widths are approximate.',
          references: [references.gendarmerie, references.sancy],
        },
        paints: scheme(space, exterior, NAVY, gendarmerieZones, { roughness: 0.32 }),
        markings: [
          ...both('door-title', 'gn-title'),
          ...both('rear-cabin', 'roundel-fr'),
          ...both('cowl', 'gn-code'),
        ],
      },
      {
        id: 'south-african-police',
        label: 'South African Police Service',
        provenance: {
          kind: 'inspired',
          note: 'South African Police Service AS350 B3 from the referenced photograph: white cabin, blue cowling, boom, fin and belly with the blue sweeping up from the belly into the boom behind the rear doors, the South African flag on the cowling and the registration in white on the boom. The registration is fictional (ZS-RQM; the photographed aircraft is ZS-RPL) and the service star badge on the doors is omitted. Colors are approximate.',
          references: [references.saps],
        },
        paints: {
          ...scheme(space, ['shell'], WHITE, sapsZones, { roughness: 0.32 }),
          ...scheme(space, ['accent'], SAPS_BLUE, [], { roughness: 0.32 }),
        },
        markings: [...both('boom-reg', 'za-reg'), ...both('cowl-flag', 'flag-za', true)],
      },
      {
        id: 'alaska-glacier-tours',
        label: 'Alaska glacier tours red and silver',
        provenance: {
          kind: 'inspired',
          note: 'Juneau glacier-tour AS350 from the referenced photograph on the Mendenhall Glacier: red lower cabin, boom, fin and skids, white upper cabin and cowling front, and a metallic silver nose cap, with the registration in white on the boom. The registration is fictional (N6127T; the photographed aircraft is N6094E) and the operator title on the cowling is omitted. Colors and the split lines are approximate.',
          references: [references.temsco],
        },
        paints: scheme(space, exterior, TOUR_RED, tourZones, { roughness: 0.3 }),
        markings: [...both('boom-reg', 'tour-reg')],
      },
      {
        id: 'swiss-charter-anthracite',
        label: 'Alpine charter anthracite',
        provenance: {
          kind: 'inspired',
          note: "Swiss alpine charter and medevac H125 from the referenced Val d'Isère photograph of HB-ZSL: anthracite grey overall with a red flash rising from the front door to the cowling (and a thinner one behind it), a thin red line along the boom, the registration in white italic capitals on the boom and the Swiss cross on the fin. The registration is fictional (HB-ZRN); the operator's fin emblem and the cowling target logo are omitted. Colors are approximate.",
          references: [references.valdisere],
        },
        paints: scheme(space, exterior, ANTHRACITE, anthraciteZones, {
          roughness: 0.32,
          metalness: 0.25,
        }),
        markings: [...both('boom-reg', 'anthracite-reg'), ...both('fin-tip', 'swiss-cross')],
      },
    ],
  };
}
