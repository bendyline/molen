/**
 * Cirrus SR22T liveries: Cirrus factory G6/G7 paint layouts as delivered to private owners
 * (upper color over a silver or white lower fuselage, black pinstripes and swooshes), the
 * Carbon edition and the US Air Force Academy's T-53A Kadet II. Civil schemes carry their
 * colors and stripe layouts only, with fictional registrations in the right national format;
 * the T-53A carries its real US Air Force markings redrawn as original vector art.
 */
import { helpers, lettering, swoosh } from '../art-ga-b.mjs';

export function slots() {
  const pearl = (node) => ({ materials: ['Cirrus-pearl'], node });
  return {
    shell: pearl('Cirrus-shell-Cirrus-pearl'),
    'flap-1': pearl('Cirrus-flap-1-Cirrus-pearl'),
    'flap--1': pearl('Cirrus-flap--1-Cirrus-pearl'),
    'aileron-1': pearl('Cirrus-aileron-1-Cirrus-pearl'),
    'aileron--1': pearl('Cirrus-aileron--1-Cirrus-pearl'),
    'elevator-1': pearl('Cirrus-elevator-1-Cirrus-pearl'),
    'elevator--1': pearl('Cirrus-elevator--1-Cirrus-pearl'),
    // The low graphite side strips (and two small step plates) on the shell.
    strip: { materials: ['Cirrus-graphite'], node: 'Cirrus-shell-Cirrus-graphite' },
    rudder: { materials: ['Cirrus-graphite'], node: 'Cirrus-rudder-Cirrus-graphite' },
  };
}

const INK = '#141619',
  WHITE = '#f3f3f0',
  SILVER = '#c8cbcf',
  CRIMSON = '#a3161f',
  BLUE = '#1f62c4',
  NAVY = '#14213f',
  GUNMETAL = '#8e9297',
  CHARCOAL = '#2c2f34',
  ORANGE = '#e8670f',
  USAF_BLUE = '#1b3a8c',
  USAF_RED = '#b3202b';

// T-53A band: from the cowl's mid height under the cabin to the tail.
const t53Low = [
  [3.05, 1.16],
  [1.2, 1.17],
  [-1.0, 1.2],
  [-4.6, 1.22],
];
// G7 blue paint line, rising from the spinner to the belt and on to the fin root.
const g7Line = [
  [3.3, 1.2],
  [0.5, 1.38],
  [-4.6, 1.42],
];

export default function design({ kit: k, space }) {
  const h = helpers(space);
  const SIDES = [1, -1];
  // The tail cone narrows to 0.15 m half width at z -3.0; from the tailplane's root leading
  // edge (z -3.23) fuselage zones keep inside 0.115 m so the stabilizer stays the wing color.
  const TAIL = -3.22,
    CONE = 0.115;
  /**
   * A fuselage zone in up to two pieces: forward of the tail (x within 0.8) and the tail cone
   * (x within CONE). `span` [aft z, fore z] drops a piece that cannot be reached (the schema
   * allows 12 zones a paint).
   */
  const fuselage = (slot, color, planes, [aft, fore] = [-Infinity, Infinity]) => [
    ...(fore > TAIL
      ? [{ color, planes: [...planes, ...h.within(slot, 0.8), h.ahead(slot, TAIL)] }]
      : []),
    ...(aft < TAIL
      ? [{ color, planes: [...planes, ...h.within(slot, CONE), h.behind(slot, TAIL)] }]
      : []),
  ];
  /** Above (side 1) or below (-1) a polyline [[z, y], ...]: one convex zone per segment. */
  const polyZones = (slot, color, line, side, extra = []) =>
    line.slice(0, -1).flatMap((a, i) => {
      const b = line[i + 1];
      const span = [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
      return fuselage(
        slot,
        color,
        [h.ahead(slot, span[0]), h.behind(slot, span[1]), h.line(slot, a, b, side), ...extra],
        span,
      );
    });
  /** Between two polylines with the same stations (a band or a pinstripe). */
  const between = (slot, color, low, high, extra = []) =>
    low.slice(0, -1).flatMap((a, i) => {
      const b = low[i + 1],
        c = high[i],
        d = high[i + 1];
      const span = [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
      return fuselage(
        slot,
        color,
        [
          h.ahead(slot, span[0]),
          h.behind(slot, span[1]),
          h.line(slot, a, b, 1),
          h.line(slot, c, d, -1),
          ...extra,
        ],
        span,
      );
    });
  const raise = (line, dy) => line.map(([z, y]) => [z, y + dy]);
  const spats = (slot, color) => ({ color, planes: [h.below(slot, 0.45)] });

  /* ---------------------------------------------------------------- anchors ---- */
  const anchors = {};
  for (const s of SIDES) {
    // Aft fuselage below the paint line: the oval tail cone narrows ~0.22 m per metre.
    anchors[`reg-${s}`] = h.side('shell', s, -1.75, 1.06, 2.2, 0.32, { reach: 1, toe: 0.22 });
    anchors[`reg-low-${s}`] = h.side('shell', s, -2.1, 1.175, 1.75, 0.24, { reach: 1, toe: 0.24 });
    anchors[`reg-g7-${s}`] = h.side('shell', s, -1.85, 1.29, 1.4, 0.17, { reach: 1, toe: 0.24 });
    anchors[`reg-carbon-${s}`] = h.side('shell', s, -2.05, 1.3, 1.25, 0.2, { reach: 1, toe: 0.24 });
    anchors[`star-${s}`] = h.side('shell', s, -2.55, 1.3, 0.72, 0.39, { reach: 0.8, toe: 0.22 });
    anchors[`af-title-${s}`] = h.side('shell', s, 1.05, 1.24, 1.15, 0.12, { reach: 1 });
    // Fin (and the rudder behind it): thin, so the box reaches only 0.08 m out of the centre.
    anchors[`fin-${s}`] = h.side('shell', s, -4.02, 2.05, 0.9, 1.0, { reach: 0.08 });
    anchors[`rudder-${s}`] = h.side('rudder', s, -4.02, 2.05, 0.9, 1.0, { reach: 0.08 });
    anchors[`flag-${s}`] = h.side('shell', s, -4.08, 2.42, 0.3, 0.2, { reach: 0.08 });
    // Long side swooshes over the whole fuselage side (forward part, then the tail cone).
    anchors[`swoosh-${s}`] = h.side('shell', s, -0.6, 1.25, 7.2, 1.2, { reach: 1 });
  }

  /* ---------------------------------------------------------------- artwork ---- */
  const graphics = {
    'reg-n728cr': lettering(k, 'N728CR', 2.2, 0.32, INK, { fill: 0.88, tracking: 0.02 }),
    'reg-n4417g': lettering(k, 'N4417G', 1.4, 0.17, NAVY, { fill: 0.9 }),
    'reg-n93kc': lettering(k, 'N93KC', 1.25, 0.2, INK, { fill: 0.86 }),
    'reg-ec-mzr': lettering(k, 'EC-MZR', 1.75, 0.24, INK, { fill: 0.84 }),
    'af-title': lettering(k, 'U.S. AIR FORCE', 1.15, 0.12, WHITE, { fill: 0.78 }),
  };
  {
    const r = 0.17,
      c = new k.Canvas(0.72, 0.39);
    graphics['usaf-star'] = k.usInsignia(c, 0.36, 0.195, r).graphic('US national insignia');
  }
  // T-53A fin: AF over the unit and the tail number, with the blue-checked fin cap.
  {
    const c = new k.Canvas(0.9, 1.0);
    c.text(USAF_BLUE, 'AF', { x: 0.42, y: 0.5, height: 0.2 });
    c.text(USAF_BLUE, '306 FTG', { x: 0.42, y: 0.28, height: 0.075 });
    c.text(USAF_BLUE, '10-0101', { x: 0.42, y: 0.16, height: 0.06 });
    k.checks(c, 0.18, 0.78, 0.72, 0.12, [USAF_BLUE, WHITE], 8, 2);
    graphics['t53-fin'] = c.graphic('AF 306 FTG 10-0101 and fin checks');
  }
  {
    // Spanish flag (red-yellow-red, 1:2:1), no arms.
    const c = new k.Canvas(0.3, 0.2);
    c.rect('#c60b1e', 0, 0, 0.3, 0.2).rect('#ffc400', 0, 0.05, 0.3, 0.1);
    graphics['flag-spain'] = c.graphic('Flag of Spain');
  }
  // Carbon edition: two charcoal swooshes, one from the cowl chin rising under the cabin, one
  // thin line over the aft fuselage (canvas covers z 2.8 .. -4.4, y 0.65 .. 1.85).
  {
    const W = 7.2,
      H = 1.2,
      z = (zz) => 2.8 - zz,
      y = (yy) => yy - 0.65;
    const c = new k.Canvas(W, H);
    swoosh(
      c,
      CHARCOAL,
      [
        [z(2.75), y(1.05)],
        [z(1.4), y(1.02)],
        [z(0.2), y(1.22)],
        [z(-1.5), y(1.3)],
      ],
      [
        [z(2.75), y(1.05)],
        [z(1.2), y(0.92)],
        [z(-0.2), y(1.1)],
        [z(-1.5), y(1.3)],
      ],
    );
    swoosh(
      c,
      CHARCOAL,
      [
        [z(0.7), y(1.48)],
        [z(-0.8), y(1.53)],
        [z(-2.2), y(1.57)],
        [z(-3.9), y(1.62)],
      ],
      [
        [z(0.7), y(1.48)],
        [z(-0.8), y(1.48)],
        [z(-2.2), y(1.52)],
        [z(-3.9), y(1.62)],
      ],
    );
    graphics['carbon-swoosh'] = c.graphic('Carbon edition swooshes');
    // G7 blue: a black swoosh from the spinner under the cowl into the paint line, and a
    // black-edged blue arrow on the lower aft fuselage pointing forward.
    const g = new k.Canvas(W, H);
    swoosh(
      g,
      INK,
      [
        [z(2.75), y(1.12)],
        [z(1.6), y(1.12)],
        [z(0.4), y(1.36)],
        [z(-1.0), y(1.4)],
      ],
      [
        [z(2.75), y(1.12)],
        [z(1.5), y(1.04)],
        [z(0.2), y(1.28)],
        [z(-1.0), y(1.4)],
      ],
    );
    g.add(INK, [
      [z(-0.75), y(0.98)],
      [z(-2.4), y(1.18)],
      [z(-4.3), y(1.26)],
      [z(-4.3), y(1.04)],
      [z(-2.4), y(0.92)],
    ]);
    g.add(BLUE, [
      [z(-0.95), y(0.985)],
      [z(-2.42), y(1.145)],
      [z(-4.3), y(1.22)],
      [z(-4.3), y(1.07)],
      [z(-2.42), y(0.955)],
    ]);
    graphics['g7-swoosh'] = g.graphic('Swoosh and arrow');
  }

  /* ---------------------------------------------------------------- paints ---- */
  const solid = (color, extra = {}) => ({ color, ...extra });
  const surfaces = (color, extra = {}) =>
    Object.fromEntries(
      ['flap-1', 'flap--1', 'aileron-1', 'aileron--1', 'elevator-1', 'elevator--1'].map((n) => [
        n,
        solid(color, extra),
      ]),
    );
  const both = (anchor, graphic) => SIDES.map((s) => ({ anchor: `${anchor}-${s}`, graphic }));
  // Directional art (swooshes run nose to tail): mirrored on the right side.
  const swept = (anchor, graphic) =>
    SIDES.map((s) => ({ anchor: `${anchor}-${s}`, graphic, ...(s < 0 ? { flip: true } : {}) }));
  const METAL = { roughness: 0.32, metalness: 0.35 };

  // Factory paint line: from the spinner at the cowl's mid height, rising to the belt under
  // the windows, level to the tail (N671MV, N618LB photographs).
  const factoryLine = [
    [3.3, 1.18],
    [0.5, 1.3],
    [-4.6, 1.3],
  ];

  const references = {
    n671mv: {
      title: 'Cirrus SR22T N671MV (Wikimedia Commons, Acroterion, CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Cirrus_SR22T_N671MV_FDK_MD1.jpg',
    },
    n410as: {
      title: 'Cirrus SR22T G7 GTS N410AS (Wikimedia Commons, CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Cirrus_SR22T_G7_GTS_(N410AS,_cn_9822)_(4-9-2024).jpg',
    },
    carbon: {
      title: 'Cirrus SR22T G6 GTS Carbon N993MS (Wikimedia Commons, CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Cirrus_SR22T_G6_GTS_Carbon_(N993MS,_cn_9207)_(4-13-2024).jpg',
    },
    t53: {
      title:
        'Cirrus T-53A Kadet II 10-0101, 306th Flying Training Group (Wikimedia Commons, CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Cirrus_T-53A_Kadet_ll_10-0101_AF_306th_Flying_Training_Group_(52489922079).jpg',
    },
    econs: {
      title: 'Cirrus SR22T EC-ONS (Wikimedia Commons, CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:EC-ONS_Cirrus_SR22T_SCQ_01.jpg',
    },
  };

  // EC-ONS: orange over the nose and cabin down to a low line, the orange running on aft as a
  // band under a silver upper rear fuselage and fin, black stripes on both edges.
  const orangeBelly = [
    [3.3, 1.02],
    [0.5, 0.86],
    [-4.6, 1.14],
  ];
  const swoopTop = [-0.45, 2.1],
    swoopFoot = [-2.25, 1.36],
    tailLine = [
      [-2.25, 1.36],
      [-4.6, 1.31],
    ];
  const orangeZones = (slot) => [
    ...polyZones(slot, ORANGE, orangeBelly, 1),
    // Silver upper rear: behind the swoop and above the tail line.
    ...fuselage(slot, SILVER, [h.line(slot, swoopTop, swoopFoot, 1), h.line(slot, ...tailLine, 1)]),
    // Black edges: along the swoop and the tail line, and along the belly line.
    ...fuselage(
      slot,
      INK,
      [
        h.line(slot, swoopTop, swoopFoot, 1),
        h.line(slot, [swoopTop[0] - 0.07, swoopTop[1]], [swoopFoot[0] - 0.07, swoopFoot[1]], -1),
        h.line(slot, ...tailLine.map(([z, y]) => [z, y - 0.05]), 1),
      ],
      [-2.4, 0],
    ),
    ...between(slot, INK, raise(tailLine, -0.05), tailLine),
    ...between(slot, INK, raise(orangeBelly, -0.02), raise(orangeBelly, 0.02)),
    spats(slot, ORANGE),
  ];

  return {
    selected: 'factory-crimson-silver',
    anchors,
    graphics,
    variants: [
      {
        id: 'factory-crimson-silver',
        label: 'Private owner, crimson over silver',
        provenance: {
          kind: 'inspired',
          note: "Cirrus G6 factory layout in crimson from the referenced photograph of N671MV: crimson over the nose, cabin top, dorsal and the whole fin and rudder, silver lower fuselage and wings, a black pinstripe on the paint line, crimson wheel fairings and a large black registration on the aft fuselage. The registration N728CR is fictional; the owner's fin emblem and the manufacturer titles are omitted. The paint line is straight segments.",
          references: [references.n671mv],
        },
        paints: {
          shell: {
            color: SILVER,
            ...METAL,
            zones: [
              ...polyZones('shell', CRIMSON, factoryLine, 1),
              ...between('shell', INK, raise(factoryLine, -0.03), factoryLine),
              spats('shell', CRIMSON),
            ],
          },
          ...surfaces(SILVER, METAL),
          strip: solid(SILVER, METAL),
          rudder: solid(CRIMSON),
        },
        markings: [...both('reg', 'reg-n728cr')],
      },
      {
        id: 'factory-g7-blue-white',
        label: 'Private owner, G7 blue and white',
        provenance: {
          kind: 'inspired',
          note: "Cirrus G7 factory layout in blue from the referenced photograph of N410AS: blue over the nose, cabin top and dorsal down to the belt, white lower fuselage, wings and fin, a black swoosh from the spinner into the paint line and a black-edged blue arrow on the lower rear fuselage, blue wheel fairings and a navy registration. The registration N4417G is fictional; the fin's dark stripes are simplified and the swoosh curves are redrawn freehand from the photograph.",
          references: [references.n410as],
        },
        paints: {
          shell: {
            color: WHITE,
            zones: [
              // Blue over the top to the tail cone; the fin stays white over a black root line.
              ...polyZones('shell', BLUE, g7Line, 1),
              {
                color: INK,
                planes: [
                  h.above('shell', 1.635),
                  h.behind('shell', -2.9),
                  ...h.within('shell', CONE),
                ],
              },
              {
                color: WHITE,
                planes: [
                  h.above('shell', 1.67),
                  h.behind('shell', -2.9),
                  ...h.within('shell', CONE),
                ],
              },
              spats('shell', BLUE),
            ],
          },
          ...surfaces(WHITE),
          strip: solid(WHITE),
          rudder: solid(WHITE),
        },
        markings: [...swept('swoosh', 'g7-swoosh'), ...both('reg-g7', 'reg-n4417g')],
      },
      {
        id: 'carbon-edition',
        label: 'Carbon edition, gunmetal',
        provenance: {
          kind: 'inspired',
          note: 'Cirrus G6 Carbon edition from the referenced photograph of N993MS: gunmetal metallic overall with charcoal swooshes from the cowl along the fuselage side and a black registration on the rear fuselage. The registration N93KC is fictional; the edition title on the fin and the carbon-weave texture are omitted.',
          references: [references.carbon],
        },
        paints: {
          shell: { color: GUNMETAL, roughness: 0.3, metalness: 0.55, zones: [] },
          ...surfaces(GUNMETAL, { roughness: 0.3, metalness: 0.55 }),
          strip: solid(GUNMETAL, { roughness: 0.3, metalness: 0.55 }),
          rudder: solid(GUNMETAL, { roughness: 0.3, metalness: 0.55 }),
        },
        markings: [...swept('swoosh', 'carbon-swoosh'), ...both('reg-carbon', 'reg-n93kc')],
      },
      {
        id: 'usaf-academy-t53a',
        label: 'US Air Force Academy T-53A Kadet II',
        provenance: {
          kind: 'inspired',
          note: 'T-53A Kadet II 10-0101 of the 306th Flying Training Group (US Air Force Academy) from the referenced photograph, applied to the SR22T model (the T-53A is an SR20): white overall, a dark blue band along the fuselage with a red pinstripe above it and U.S. AIR FORCE in white on the band, the national insignia on the rear fuselage, AF, 306 FTG and the tail number on the fin under a blue-checked fin cap, all redrawn as original vector art. The pilot names under the windows are omitted; sizes are estimates.',
          references: [references.t53],
        },
        paints: {
          shell: {
            color: WHITE,
            zones: [
              ...between('shell', USAF_BLUE, t53Low, raise(t53Low, 0.13)),
              ...between('shell', USAF_RED, raise(t53Low, 0.17), raise(t53Low, 0.2)),
            ],
          },
          ...surfaces(WHITE),
          strip: solid(WHITE),
          rudder: solid(WHITE),
        },
        markings: [
          ...both('af-title', 'af-title'),
          ...both('star', 'usaf-star'),
          ...both('fin', 't53-fin'),
          ...both('rudder', 't53-fin'),
        ],
      },
      {
        id: 'spain-orange-silver',
        label: 'Spanish owner, orange and silver',
        provenance: {
          kind: 'inspired',
          note: 'Paint layout of the referenced photograph of EC-ONS: orange over the nose and cabin, running aft as a band along the lower rear fuselage under a silver upper rear fuselage and fin, black stripes on its edges, orange wheel fairings, the Spanish flag on the fin and a black registration on the orange band. The registration EC-MZR is fictional; curves are straight-line approximations.',
          references: [references.econs],
        },
        paints: {
          shell: { color: SILVER, ...METAL, zones: orangeZones('shell') },
          ...surfaces(SILVER, METAL),
          strip: solid(ORANGE),
          rudder: solid(SILVER, METAL),
        },
        markings: [...both('reg-low', 'reg-ec-mzr'), ...both('flag', 'flag-spain')],
      },
    ],
  };
}
