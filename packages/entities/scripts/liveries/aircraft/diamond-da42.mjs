/**
 * Diamond DA42 Twin Star liveries: the Swiss Air Force's R-711, an airline flight school's
 * white and navy trainers, the Diamond DA42-VI factory stripes on a Swedish private owner's
 * aircraft, a US university trainer's blue swooshes and the orange-red MPP sensor
 * demonstrator. Military markings are redrawn as original vector art; civil operators carry
 * their colors and stripe layouts only, with fictional registrations in national formats.
 */
import { bezier, helpers, lettering, ribbon, swissMarkBordered, swoosh } from '../art-ga-b.mjs';

export function slots() {
  const white = (node) => ({ materials: ['DA42-white'], node });
  return {
    shell: white('DA42-shell-DA42-white'),
    'nacelle-1': white('DA42-nacelle-1-DA42-white'),
    'nacelle-2': white('DA42-nacelle-2-DA42-white'),
    'spinner-1': white('DA42-propeller-1-DA42-white'),
    'spinner-2': white('DA42-propeller-2-DA42-white'),
    'flap-inner-1': white('DA42-flap-inner-1-DA42-white'),
    'flap-inner--1': white('DA42-flap-inner--1-DA42-white'),
    'flap-outer-1': white('DA42-flap-outer-1-DA42-white'),
    'flap-outer--1': white('DA42-flap-outer--1-DA42-white'),
    'aileron-1': white('DA42-aileron-1-DA42-white'),
    'aileron--1': white('DA42-aileron--1-DA42-white'),
    'elevator-1': white('DA42-elevator-1-DA42-white'),
    'elevator--1': white('DA42-elevator--1-DA42-white'),
    'gear-0': white('DA42-gear-0-DA42-white'),
    'gear-1': white('DA42-gear-1-DA42-white'),
    'gear-2': white('DA42-gear-2-DA42-white'),
    // The thin blue side strips on the shell, and the rudder.
    strip: { materials: ['DA42-blue'], node: 'DA42-shell-DA42-blue' },
    rudder: { materials: ['DA42-blue'], node: 'DA42-rudder-DA42-blue' },
  };
}

const WHITE = '#f3f3f0',
  INK = '#15181b',
  SWISS_RED = '#d52b1e',
  SCHOOL_NAVY = '#0c1f42',
  FACTORY_NAVY = '#1b2f6d',
  FACTORY_BLUE = '#2f6fc2',
  FACTORY_TEAL = '#38a8cb',
  UNI_NAVY = '#1c2d5e',
  UNI_BLUE = '#4b97dc',
  MPP_RED = '#e5452b',
  GREY_REG = '#5b6166';

// Model geometry (builder): nacelles centred at x 1.68 (outboard skin 2.09), y 1.06; tail boom
// from z -1.65 aft; fin over z -3.83 .. -4.98 up to y 2.43 under the T-tail (y 2.44).
const NACELLE_X = 1.68;

export default function design({ kit: k, space }) {
  const h = helpers(space);
  const SIDES = [1, -1];
  const anchors = {};
  // Side canvases: the whole fuselage side (z 3.3 .. -5.3, y 0.6 .. 2.5) and each nacelle's
  // outboard side (z 1.75 .. -1.1, y 0.62 .. 1.5).
  const BODY = { z0: 3.3, z1: -5.3, y0: 0.6, y1: 2.5 },
    NAC = { z0: 1.75, z1: -1.1, y0: 0.62, y1: 1.5 };
  for (const s of SIDES) {
    anchors[`body-${s}`] = h.side(
      'shell',
      s,
      (BODY.z0 + BODY.z1) / 2,
      (BODY.y0 + BODY.y1) / 2,
      BODY.z0 - BODY.z1,
      BODY.y1 - BODY.y0,
      { reach: 0.66 },
    );
    // Outboard nacelle (nacelle-1 is on the left, +X).
    const n = s > 0 ? 'nacelle-1' : 'nacelle-2';
    anchors[`nacelle-${s}`] = space.anchor(n, {
      center: [s * (NACELLE_X + 0.35), (NAC.y0 + NAC.y1) / 2, (NAC.z0 + NAC.z1) / 2],
      facing: [s, 0, 0],
      width: NAC.z0 - NAC.z1,
      height: NAC.y1 - NAC.y0,
      depth: 0.7,
    });
    // Tail boom (narrowing ~0.16 m per metre).
    anchors[`boom-${s}`] = h.side('shell', s, -2.75, 1.13, 1.35, 0.22, { reach: 0.6, toe: 0.16 });
    anchors[`boom-small-${s}`] = h.side('shell', s, -3.1, 1.13, 0.75, 0.13, {
      reach: 0.6,
      toe: 0.14,
    });
    // Fin (thin sheet at x 0.038) and rudder.
    anchors[`fin-mark-${s}`] = h.side('shell', s, -4.45, 1.95, 0.42, 0.42, { reach: 0.08 });
    anchors[`fin-flag-${s}`] = h.side('shell', s, -4.72, 2.27, 0.27, 0.16, { reach: 0.08 });
    anchors[`rudder-${s}`] = h.side('rudder', s, -4.99, 1.72, 0.6, 1.44, { reach: 0.08 });
    // Winglets (outer faces), and the wing underside.
    // The winglet leans out and back: its outer face points (0.97, 0.12, 0.18) on the left.
    anchors[`winglet-${s}`] = space.anchor('shell', {
      center: [s * 6.72, 1.86, -0.34],
      facing: [s * 0.97, 0.12, 0.18],
      width: 0.36,
      height: 0.36,
      depth: 0.3,
    });
  }
  // Swedish practice: the registration under the left wing, top toward the leading edge.
  const wy = (x) => 0.93 + Math.max(0, x - 0.55) * Math.tan((5 * Math.PI) / 180);
  anchors['wing-reg'] = h.face('shell', 3.75, 0.25, wy(3.75), 2.6, 0.72, {
    down: true,
    dihedral: (5 * Math.PI) / 180,
  });

  /* ---------------------------------------------------------------- artwork ---- */
  const graphics = {
    'reg-d-gltq': lettering(k, 'D-GLTQ', 1.35, 0.22, GREY_REG, { fill: 0.86 }),
    'reg-se-mkv': lettering(k, 'SE-MKV', 1.35, 0.22, FACTORY_NAVY, { fill: 0.86 }),
    'reg-se-mkv-wing': lettering(k, 'SE-MKV', 2.6, 0.72, INK, { fill: 0.72 }),
    'reg-n727dt': lettering(k, 'N727DT', 1.35, 0.22, UNI_NAVY, { fill: 0.86, slant: 0.18 }),
    'reg-oe-fxk': lettering(k, 'OE-FXK', 1.35, 0.22, MPP_RED, { fill: 0.86 }),
    'r-711': lettering(k, 'R-711', 0.75, 0.13, INK, { fill: 0.86 }),
  };
  {
    const c = new k.Canvas(0.42, 0.42);
    graphics['swiss-mark'] = swissMarkBordered(k, c, 0.21, 0.21, 0.36, 0.07).graphic(
      'Swiss military marking',
    );
    const w = new k.Canvas(0.36, 0.36);
    graphics['swiss-mark-small'] = swissMarkBordered(k, w, 0.18, 0.18, 0.3, 0.07).graphic(
      'Swiss military marking',
    );
    const de = new k.Canvas(0.27, 0.16);
    de.rect('#111111', 0, 0.1067, 0.27, 0.0533).rect('#dd0000', 0, 0.0533, 0.27, 0.0533);
    de.rect('#ffce00', 0, 0, 0.27, 0.0533);
    graphics['flag-germany'] = de.graphic('Flag of Germany');
    const se = new k.Canvas(0.27, 0.16);
    se.rect('#006aa7', 0, 0, 0.27, 0.16);
    se.rect('#fecc00', 0.075, 0, 0.032, 0.16).rect('#fecc00', 0, 0.064, 0.27, 0.032);
    graphics['flag-sweden'] = se.graphic('Flag of Sweden');
    // MPP rudder: red and white diagonal bars (the rudder canvas is 0.6 x 1.44).
    const r = new k.Canvas(0.6, 1.44);
    for (let i = -3; i < 8; i += 2)
      r.add(MPP_RED, [
        [0, i * 0.2],
        [0.6, i * 0.2 + 0.35],
        [0.6, i * 0.2 + 0.55],
        [0, i * 0.2 + 0.2],
      ]);
    graphics['mpp-rudder'] = r.graphic('Red and white rudder bars');
  }
  // Body and nacelle canvases map model (z, y) to canvas metres, nose at the left (x = 0).
  const bodyCanvas = () => new k.Canvas(BODY.z0 - BODY.z1, BODY.y1 - BODY.y0);
  const B = ([z, y]) => [BODY.z0 - z, y - BODY.y0];
  const nacCanvas = () => new k.Canvas(NAC.z0 - NAC.z1, NAC.y1 - NAC.y0);
  const N = ([z, y]) => [NAC.z0 - z, y - NAC.y0];
  const curve = (map, pts, n = 18) => bezier(...pts.map(map), n);
  {
    // Swiss R-711: a red flame under the cockpit (pointed forward, curling aft) and a red
    // swoosh along each nacelle.
    const c = bodyCanvas();
    swoosh(
      c,
      SWISS_RED,
      [B([2.6, 1.02]), B([1.8, 1.12]), B([1.0, 1.16]), B([-0.2, 1.08])],
      [B([2.6, 1.02]), B([1.9, 0.86]), B([0.8, 0.78]), B([-0.2, 1.08])],
    );
    graphics['swiss-body'] = c.graphic('Red flame');
    const n = nacCanvas();
    swoosh(
      n,
      SWISS_RED,
      [N([1.45, 1.05]), N([0.8, 1.16]), N([0.0, 1.14]), N([-0.95, 0.98])],
      [N([1.45, 1.05]), N([0.7, 0.9]), N([-0.1, 0.86]), N([-0.95, 0.98])],
    );
    graphics['swiss-nacelle'] = n.graphic('Red nacelle swoosh');
  }
  {
    // Diamond DA42-VI factory stripes: navy, blue and teal ribbons from the nose along the
    // cabin and boom, sweeping up the fin; the same three on the nacelles.
    const c = bodyCanvas();
    const path = [
      [3.1, 0.98],
      [1.2, 1.12],
      [-1.6, 1.2],
      [-3.7, 1.32],
    ];
    const up = [
      [-3.7, 1.32],
      [-4.15, 1.55],
      [-4.45, 1.95],
      [-4.62, 2.3],
    ];
    const run = [...curve(B, path, 20), ...curve(B, up, 8).slice(1)];
    const offset = (d) => run.map(([x, y]) => [x, y + d]);
    ribbon(c, FACTORY_TEAL, offset(0.09), 0.018);
    ribbon(c, FACTORY_BLUE, offset(0.045), 0.018);
    ribbon(c, FACTORY_NAVY, run, 0.022);
    graphics['factory-body'] = c.graphic('Factory stripes');
    const n = nacCanvas();
    const nrun = curve(N, [
      [1.5, 1.02],
      [0.6, 1.1],
      [-0.3, 1.12],
      [-1.0, 1.1],
    ]);
    ribbon(
      n,
      FACTORY_TEAL,
      nrun.map(([x, y]) => [x, y + 0.08]),
      0.016,
    );
    ribbon(
      n,
      FACTORY_BLUE,
      nrun.map(([x, y]) => [x, y + 0.04]),
      0.016,
    );
    ribbon(n, FACTORY_NAVY, nrun, 0.02);
    graphics['factory-nacelle'] = n.graphic('Factory nacelle stripes');
  }
  {
    // University trainer: a navy and light blue swoosh from under the cockpit along the
    // cabin, tapering on the boom; a light blue swoosh on each nacelle.
    const c = bodyCanvas();
    swoosh(
      c,
      UNI_BLUE,
      [B([2.4, 1.06]), B([1.0, 1.2]), B([-0.8, 1.26]), B([-2.2, 1.22])],
      [B([2.4, 1.06]), B([1.2, 1.08]), B([-0.6, 1.17]), B([-2.2, 1.22])],
    );
    swoosh(
      c,
      UNI_NAVY,
      [B([2.0, 1.02]), B([0.6, 1.11]), B([-1.4, 1.15]), B([-3.4, 1.2])],
      [B([2.0, 1.02]), B([0.7, 1.06]), B([-1.2, 1.11]), B([-3.4, 1.2])],
    );
    graphics['uni-body'] = c.graphic('Blue swooshes');
    const n = nacCanvas();
    swoosh(
      n,
      UNI_BLUE,
      [N([1.5, 1.0]), N([0.7, 1.12]), N([-0.2, 1.14]), N([-0.95, 1.06])],
      [N([1.5, 1.0]), N([0.6, 1.02]), N([-0.3, 1.05]), N([-0.95, 1.06])],
    );
    swoosh(
      n,
      UNI_NAVY,
      [N([1.3, 0.96]), N([0.5, 1.0]), N([-0.4, 1.01]), N([-0.95, 0.99])],
      [N([1.3, 0.96]), N([0.5, 0.95]), N([-0.4, 0.97]), N([-0.95, 0.99])],
    );
    graphics['uni-nacelle'] = n.graphic('Blue nacelle swooshes');
  }
  {
    // MPP demonstrator: raked red dashes along the nose and the nacelles, a red chevron under
    // the cabin window.
    const c = bodyCanvas();
    const dash = (z, y, len = 0.28, tall = 0.09, rake = 0.08) => {
      const [x0, y0] = B([z, y]);
      c.add(MPP_RED, [
        [x0, y0],
        [x0 + len, y0],
        [x0 + len + rake, y0 + tall],
        [x0 + rake, y0 + tall],
      ]);
    };
    for (const [z, y, len] of [
      [2.75, 0.96, 0.22],
      [2.35, 0.94, 0.3],
      [1.9, 0.92, 0.36],
      [1.38, 0.92, 0.42],
    ])
      dash(z, y, len);
    {
      const [x0, y0] = B([0.6, 1.08]);
      c.add(MPP_RED, [
        [x0, y0],
        [x0 + 0.9, y0 + 0.02],
        [x0 + 1.5, y0 + 0.32],
        [x0 + 0.55, y0 + 0.12],
      ]);
    }
    graphics['mpp-body'] = c.graphic('Red dashes and chevron');
    const n = nacCanvas();
    for (let i = 0; i < 5; i++) {
      const [x0, y0] = N([1.35 - i * 0.48, 1.0]);
      n.add(MPP_RED, [
        [x0, y0],
        [x0 + 0.3, y0],
        [x0 + 0.38, y0 + 0.09],
        [x0 + 0.08, y0 + 0.09],
      ]);
    }
    graphics['mpp-nacelle'] = n.graphic('Red nacelle dashes');
  }

  /* ---------------------------------------------------------------- zones ---- */
  // The fin above the boom (the thin sheet at x 0.038), stopping under the T-tail.
  const fin = (slot, color, extra = []) => ({
    color,
    planes: [
      h.above(slot, 1.38),
      h.behind(slot, -3.8),
      h.below(slot, 2.405),
      ...h.within(slot, 0.08),
      ...extra,
    ],
  });
  // Airline school: navy behind a line from the boom top to the fin tip's leading edge,
  // including the tail cone under the rudder.
  const schoolFin = (slot) => ({
    color: SCHOOL_NAVY,
    planes: [
      h.line(slot, [-3.75, 1.36], [-4.45, 2.43], -1),
      h.behind(slot, -3.7),
      h.below(slot, 2.405),
      ...h.within(slot, 0.14),
    ],
  });
  const winglets = (slot, color) =>
    SIDES.map((s) => ({ color, planes: [h.outboard(slot, s, 6.5), h.above(slot, 1.2)] }));

  /* ---------------------------------------------------------------- paints ---- */
  const solid = (color, extra = {}) => ({ color, ...extra });
  const ALL = [
    'shell',
    'nacelle-1',
    'nacelle-2',
    'spinner-1',
    'spinner-2',
    'flap-inner-1',
    'flap-inner--1',
    'flap-outer-1',
    'flap-outer--1',
    'aileron-1',
    'aileron--1',
    'elevator-1',
    'elevator--1',
    'gear-0',
    'gear-1',
    'gear-2',
    'strip',
    'rudder',
  ];
  const uniform = (color, extra = {}) =>
    Object.fromEntries(ALL.map((slot) => [slot, solid(color, extra)]));
  const both = (anchor, graphic) => SIDES.map((s) => ({ anchor: `${anchor}-${s}`, graphic }));
  // Directional art (swooshes run nose to tail): mirrored on the right side.
  const swept = (anchor, graphic) =>
    SIDES.map((s) => ({ anchor: `${anchor}-${s}`, graphic, ...(s < 0 ? { flip: true } : {}) }));

  const references = {
    swiss: {
      title: 'Swiss Air Force DA42 R-711 at Dübendorf (Wikimedia Commons, CC BY-SA 3.0)',
      url: 'https://commons.wikimedia.org/wiki/File:R-711_Swiss_Air_Force.jpg',
    },
    school: {
      title:
        'Diamond DA42 NG D-GFRA of an airline flight school (Wikimedia Commons, Andre Gerwing, CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Diamond_DA42_NG_(c-n_42N379,_D-GFRA)_2025-06-28_Andre_Gerwing_Collection_ID_024221.jpg',
    },
    factory: {
      title: 'Diamond DA42-VI SE-MLR in flight (Wikimedia Commons, CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:SE-MLR_Diamond_DA42_VBY_01.jpg',
    },
    university: {
      title: 'Diamond DA42-VI N309ER, university flight training (Wikimedia Commons, CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Diamond_DA42-VI_Twin_Star_(N309ER,_cn_42.N211)_(1-12-2023).jpg',
    },
    mpp: {
      title: "Diamond DA42 MPP 'OE-FMV' sensor demonstrator (Wikimedia Commons, CC BY-SA 2.0)",
      url: 'https://commons.wikimedia.org/wiki/File:Diamond_DA42MPP-NG_Twin_Star%E2%80%98OE-FMV%E2%80%99_(16913916756).jpg',
    },
  };

  return {
    selected: 'factory-stripes-sweden',
    anchors,
    graphics,
    variants: [
      {
        id: 'factory-stripes-sweden',
        label: 'Private owner, Diamond factory stripes (Sweden)',
        provenance: {
          kind: 'inspired',
          note: 'Diamond DA42-VI factory scheme from the referenced photograph of SE-MLR: white with navy, blue and teal stripes from the nose along the cabin and boom sweeping up the fin, the same three on the nacelles, the Swedish flag on the fin, the registration on the boom and large under the left wing (Swedish practice). The registration SE-MKV is fictional; type titles are omitted and the stripe curves are redrawn freehand.',
          references: [references.factory],
        },
        paints: uniform(WHITE),
        markings: [
          ...swept('body', 'factory-body'),
          ...swept('nacelle', 'factory-nacelle'),
          ...both('boom', 'reg-se-mkv'),
          ...both('fin-flag', 'flag-sweden'),
          { anchor: 'wing-reg', graphic: 'reg-se-mkv-wing' },
        ],
      },
      {
        id: 'swiss-air-force-r-711',
        label: 'Swiss Air Force R-711',
        provenance: {
          kind: 'inspired',
          note: 'Swiss Air Force DA42 R-711 from the referenced photograph: white with a red flame under the cockpit and red swooshes on the nacelles, red fin and rudder with the Swiss marking, red winglets carrying the Swiss marking, and the serial R-711 on the tail boom, redrawn as original vector art. The photograph is distant: the white swirl inside the red fin is simplified away, and the swoosh shapes and serial position are estimates.',
          references: [references.swiss],
        },
        paints: {
          ...uniform(WHITE),
          shell: {
            color: WHITE,
            zones: [fin('shell', SWISS_RED), ...winglets('shell', SWISS_RED)],
          },
          rudder: solid(SWISS_RED),
        },
        markings: [
          ...swept('body', 'swiss-body'),
          ...swept('nacelle', 'swiss-nacelle'),
          ...both('fin-mark', 'swiss-mark'),
          ...both('winglet', 'swiss-mark-small'),
          ...both('boom-small', 'r-711'),
        ],
      },
      {
        id: 'airline-school-navy',
        label: 'Airline flight school, white and navy',
        provenance: {
          kind: 'inspired',
          note: "Colors of an airline's flight school trainers from the referenced photograph of D-GFRA: white overall with a navy fin, rudder and tail cone behind a line from the boom to the fin tip, the German flag at the top of the fin and a grey registration on the boom. The airline's emblem and titles are omitted; the registration D-GLTQ is fictional.",
          references: [references.school],
        },
        paints: {
          ...uniform(WHITE),
          shell: { color: WHITE, zones: [schoolFin('shell')] },
          rudder: solid(SCHOOL_NAVY),
        },
        markings: [...both('boom', 'reg-d-gltq'), ...both('fin-flag', 'flag-germany')],
      },
      {
        id: 'university-trainer-blue',
        label: 'University flight school, blue swooshes',
        provenance: {
          kind: 'inspired',
          note: "Colors of a US university's DA42 trainers from the referenced photograph of N309ER: white with navy and light blue swooshes along the cabin and on the nacelles and a navy italic registration on the boom. The university's titles and the gold fin emblem are omitted; the registration N727DT is fictional and the swooshes are redrawn freehand.",
          references: [references.university],
        },
        paints: uniform(WHITE),
        markings: [
          ...swept('body', 'uni-body'),
          ...swept('nacelle', 'uni-nacelle'),
          ...both('boom', 'reg-n727dt'),
        ],
      },
      {
        id: 'mpp-sensor-demonstrator',
        label: 'MPP sensor demonstrator, white and red',
        provenance: {
          kind: 'inspired',
          note: 'Paint of the referenced photograph of the DA42 MPP demonstrator OE-FMV: white with raked red dashes along the nose and nacelles, a red chevron under the cabin, red and white rudder bars, red winglets and main gear doors and a red registration on the boom. The sensor company titles are omitted, the registration OE-FXK is fictional and the sensor turret is not modelled.',
          references: [references.mpp],
        },
        paints: {
          ...uniform(WHITE),
          shell: { color: WHITE, zones: winglets('shell', MPP_RED) },
          'gear-1': solid(MPP_RED),
          'gear-2': solid(MPP_RED),
        },
        markings: [
          ...swept('body', 'mpp-body'),
          ...swept('nacelle', 'mpp-nacelle'),
          ...both('rudder', 'mpp-rudder'),
          ...both('boom', 'reg-oe-fxk'),
        ],
      },
    ],
  };
}
