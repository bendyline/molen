/**
 * Pilatus PC-6 Porter liveries: the Swiss Air Force and the Austrian Bundesheer in their olive
 * greens, a Southeast Asia camouflaged AU-23A Peacemaker with its sharkmouth, and two skydiving
 * operators' colors (a pink Belgian club Porter and a white and navy German Turbo Porter)
 * without names or logos. Military insignia, serials and nose art are redrawn as original
 * vector art; civil registrations are fictional, in the right national format.
 *
 * The airframe is built in its flight datum and posed tail-down (about 10.8 degrees), so
 * anchors and zone lines are authored in that datum and converted through `helpers`.
 */
import { austriaMark, bezier, helpers, lettering, pose, swissMarkBordered } from '../art-ga-b.mjs';

const PITCH = Math.atan2(98, 512);

export function slots() {
  const red = (node) => ({ materials: ['Porter-red'], node });
  return {
    shell: { materials: ['Porter-ivory'], node: 'Porter-shell-Porter-ivory' },
    spinner: { materials: ['Porter-ivory'], node: 'Porter-nose' },
    // Raised band strips along the lower fuselage sides.
    band: red('Porter-shell-Porter-red'),
    'flap-inner-1': red('Porter-flap-inner-1-Porter-red'),
    'flap-inner--1': red('Porter-flap-inner--1-Porter-red'),
    'flap-outer-1': red('Porter-flap-outer-1-Porter-red'),
    'flap-outer--1': red('Porter-flap-outer--1-Porter-red'),
    'aileron-1': red('Porter-aileron-1-Porter-red'),
    'aileron--1': red('Porter-aileron--1-Porter-red'),
    'elevator-1': red('Porter-elevator-1-Porter-red'),
    'elevator--1': red('Porter-elevator--1-Porter-red'),
    rudder: red('Porter-rudder-Porter-red'),
  };
}

const SURFACES = [
  'flap-inner-1',
  'flap-inner--1',
  'flap-outer-1',
  'flap-outer--1',
  'aileron-1',
  'aileron--1',
  'elevator-1',
  'elevator--1',
];

const INK = '#15181b',
  WHITE = '#f2f2ee',
  SWISS_DARK = '#46503d',
  SWISS_LIGHT = '#5d6a4b',
  AUSTRIA_OLIVE = '#4c5137',
  SEA_TAN = '#b39466',
  SEA_GREEN = '#66744a',
  SEA_DARK = '#3a4531',
  PINK = '#e2709f',
  NAVY = '#1b2a5c',
  AMBER = '#e98b1c',
  SHARK_RED = '#c3242b';

// Datum geometry (builder): wing at y 2.08 from z 2.12 to 0.64; fin over z -3.41 .. -4.08,
// rudder to -4.51, both up to y 3.78; fuselage bottom 0.59 under the cabin rising to 1.4.
const WING_Y = 2.08,
  WING_MID = 1.38;
// The skydiving band's upper and lower edges: along the cowl, level under the cabin, rising
// with the tail cone.
const BAND_TOP = [
  [5.4, 1.15],
  [3.0, 0.98],
  [-0.4, 0.95],
  [-4.9, 1.69],
];
const BAND_LOW = BAND_TOP.map(([z, y], i) => [z, y - [0.22, 0.24, 0.24, 0.18][i]]);
const raise = (line, dy) => line.map(([z, y]) => [z, y + dy]);

export default function design({ kit: k, space, bounds }) {
  const h = helpers(space, pose(PITCH));
  const SIDES = [1, -1];
  const anchors = {};
  for (const s of SIDES) {
    // Aft fuselage: the box section narrows ~0.12 m per metre toward the tail. Each lettering
    // box is also projected on the raised band strips, which sit 5 mm proud of the skin.
    const aft = (name, z, y, w, hh) => {
      for (const slot of ['shell', 'band'])
        anchors[`${name}${slot === 'band' ? '-band' : ''}-${s}`] = h.side(slot, s, z, y, w, hh, {
          reach: 1,
          toe: 0.12,
        });
    };
    aft('serial', -2.55, 1.5, 0.95, 0.26);
    aft('code', -2.45, 1.5, 1.6, 0.42);
    aft('reg', -2.35, 1.55, 1.6, 0.28);
    // Sharkmouth on the lower cowl, opening toward the spinner.
    anchors[`mouth-${s}`] = h.side('shell', s, 4.45, 0.92, 1.0, 0.46, { reach: 1, toe: -0.2 });
    anchors[`fin-${s}`] = h.side('shell', s, -3.92, 3.2, 0.9, 0.3, { reach: 0.1 });
    anchors[`rudder-${s}`] = h.side('rudder', s, -3.92, 3.2, 0.9, 0.3, { reach: 0.1 });
    anchors[`flag-${s}`] = h.side('rudder', s, -4.3, 3.55, 0.3, 0.18, { reach: 0.1 });
    // Wings: upper and lower faces near the tips, artwork top toward the leading edge.
    const x = s * 6.1;
    anchors[`wing-top-${s}`] = h.face('shell', x, WING_MID, WING_Y, 0.95, 0.95);
    anchors[`wing-bottom-${s}`] = h.face('shell', x, WING_MID, WING_Y, 0.95, 0.95, { down: true });
  }

  /* ---------------------------------------------------------------- artwork ---- */
  const graphics = {
    'v-618': lettering(k, 'V-618', 0.95, 0.26, '#d9dad4', { fill: 0.86 }),
    'tail-42082': lettering(k, '42082', 0.9, 0.3, '#ecece6', { fill: 0.7 }),
    'reg-oo-pjx': lettering(k, 'OO-PJX', 1.6, 0.28, WHITE, { fill: 0.86 }),
    'reg-d-fjmp': lettering(k, 'D-FJMP', 1.6, 0.28, NAVY, { fill: 0.86 }),
  };
  {
    const c = new k.Canvas(0.95, 0.95);
    graphics['swiss-mark'] = swissMarkBordered(k, c, 0.475, 0.475, 0.85, 0.055).graphic(
      'Swiss military marking',
    );
    const a = new k.Canvas(0.95, 0.95);
    graphics['austria-wing'] = austriaMark(a, 0.475, 0.475, 0.46).graphic('Austrian marking');
    const code = new k.Canvas(1.6, 0.42);
    code.text(INK, '3G', { x: 0.52, y: 0.21, height: 0.27, align: 'right' });
    austriaMark(code, 0.8, 0.21, 0.2);
    code.text(INK, 'EH', { x: 1.08, y: 0.21, height: 0.27, align: 'left' });
    graphics['austria-code'] = code.graphic('3G (marking) EH');
    const flag = new k.Canvas(0.3, 0.18);
    flag.rect('#111111', 0, 0.12, 0.3, 0.06).rect('#dd0000', 0, 0.06, 0.3, 0.06);
    flag.rect('#ffce00', 0, 0, 0.3, 0.06);
    graphics['flag-germany'] = flag.graphic('Flag of Germany');
  }
  {
    // Sharkmouth, an original drawing: black-lipped open jaw, red mouth, two rows of white
    // teeth, the corner of the jaw aft. Canvas x runs from the nose (0) aft (1.0 m).
    const c = new k.Canvas(1.0, 0.46);
    const upper = bezier([0.03, 0.34], [0.35, 0.3], [0.7, 0.28], [0.96, 0.24], 12);
    const lower = bezier([0.06, 0.13], [0.3, 0.0], [0.7, 0.04], [0.96, 0.22], 12);
    const lip = 0.025;
    c.add(INK, [
      ...upper.map(([x, y]) => [x, y + lip]),
      ...lower.map(([x, y]) => [x, y - lip]).reverse(),
    ]);
    c.add(SHARK_RED, [...upper, ...[...lower].reverse()]);
    const teeth = (curve, down) => {
      for (let i = 0; i < curve.length - 2; i++) {
        const [x0, y0] = curve[i],
          [x1, y1] = curve[i + 1];
        const len = Math.hypot(x1 - x0, y1 - y0),
          depth = len * 1.25 * (1 - i / curve.length / 1.6);
        c.add(WHITE, [
          [x0, y0],
          [x1, y1],
          [(x0 + x1) / 2, (y0 + y1) / 2 + (down ? -depth : depth)],
        ]);
      }
    };
    teeth(upper, true);
    teeth(lower, false);
    c.circle(INK, 0.3, 0.41, 0.03, 16);
    graphics.sharkmouth = c.graphic('Sharkmouth');
  }

  /* ---------------------------------------------------------------- paints ---- */
  const solid = (color, extra = {}) => ({ color, ...extra });
  const longest = (slot) => {
    const b = bounds[slot];
    return Math.max(...b.max.map((v, i) => v - b.min[i]));
  };
  const camo = (slot, colors, seed, patch = 2.0, extra = {}) => ({
    color: colors[0],
    roughness: 0.8,
    camouflage: { colors, scale: Math.max(0.2, longest(slot) / patch / 4), seed, style: 'blotch' },
    ...extra,
  });
  const all = (fn) =>
    Object.fromEntries(
      ['shell', 'band', 'rudder', ...SURFACES].map((slot, i) => [slot, fn(slot, i)]),
    );
  const both = (anchor, graphic) => SIDES.map((s) => ({ anchor: `${anchor}-${s}`, graphic }));
  // Lettering on the skin and on the raised band strips crossing it.
  const lettered = (anchor, graphic) => [
    ...both(anchor, graphic),
    ...both(`${anchor}-band`, graphic),
  ];
  // Art that faces forward (nose art) is mirrored on the right side.
  const forward = (anchor, graphic) =>
    SIDES.map((s) => ({ anchor: `${anchor}-${s}`, graphic, ...(s < 0 ? { flip: true } : {}) }));
  const wings = (prefix, graphic) =>
    SIDES.flatMap((s) =>
      ['top', 'bottom'].map((w) => ({ anchor: `${prefix}-${w}-${s}`, graphic })),
    );

  /** A band between two datum polylines (same stations), one zone per segment. */
  const between = (slot, color, low, high, extra = []) =>
    low.slice(0, -1).map((a, i) => ({
      color,
      planes: [
        h.ahead(slot, low[i + 1][0]),
        h.behind(slot, a[0]),
        h.line(slot, a, low[i + 1], 1),
        h.line(slot, high[i], high[i + 1], -1),
        ...h.within(slot, 0.72),
        ...extra,
      ],
    }));
  // German skydiving Turbo Porter: navy band with an amber pinstripe above, a navy diagonal
  // across the fin and rudder with an amber edge.
  const finLine = [
    [-3.35, 2.45],
    [-4.55, 3.86],
  ];
  const finBand = (slot) => [
    {
      color: NAVY,
      planes: [
        h.line(slot, ...finLine, -1),
        h.line(slot, ...raise(finLine, -0.34), 1),
        h.above(slot, 1.98),
        ...h.within(slot, 0.12),
      ],
    },
    {
      color: AMBER,
      planes: [
        h.line(slot, ...finLine, 1),
        h.line(slot, ...raise(finLine, 0.05), -1),
        h.above(slot, 1.98),
        ...h.within(slot, 0.12),
      ],
    },
  ];
  const germanZones = (slot) => [
    ...between(slot, NAVY, BAND_LOW, BAND_TOP),
    ...between(slot, AMBER, raise(BAND_TOP, 0.035), raise(BAND_TOP, 0.07)),
    ...finBand(slot),
  ];
  const pinkZones = (slot) => between(slot, WHITE, raise(BAND_TOP, -0.12), raise(BAND_TOP, -0.085));

  const references = {
    swiss: {
      title: "Swiss Air Force PC-6 V-618 at IBT'11 (Wikimedia Commons, CC BY-SA 3.0)",
      url: "https://commons.wikimedia.org/wiki/File:Swiss_Air_Force_Pilatus_PC-6_V-618_parked_at_IBT'11.jpg",
    },
    austria: {
      title: 'Austrian Air Force PC-6 Turbo-Porter 3G-EH (Wikimedia Commons, CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Pilatus_PC-6_Turbo-Porter_3G-EH_aircraft_02.jpg',
    },
    au23: {
      title: 'Fairchild AU-23A Peacemaker in flight (Wikimedia Commons, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:Fairchild_AU-23A_Peacemaker_in_flight.jpg',
    },
    au23test: {
      title: 'Fairchild AU-23A Peacemaker during US Air Force evaluation (public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:Fairchild_AU-23A_Peacemaker.jpg',
    },
    pink: {
      title: 'Pilatus PC-6 OO-PCV of a Belgian parachute club (Wikimedia Commons, CC0)',
      url: 'https://commons.wikimedia.org/wiki/File:Pilatus_PC-6,_OO-PCV.JPG',
    },
    german: {
      title:
        'Pilatus PC-6 Turbo Porter D-FSC. at a German drop zone (Wikimedia Commons, CC BY-SA 3.0 de)',
      url: 'https://commons.wikimedia.org/wiki/File:Pilatus_PC-6_Turbo_Porter.jpg',
    },
  };
  const SEA = [SEA_TAN, SEA_GREEN, SEA_DARK];

  return {
    selected: 'swiss-air-force-v-618',
    anchors,
    graphics,
    variants: [
      {
        id: 'swiss-air-force-v-618',
        label: 'Swiss Air Force V-618',
        provenance: {
          kind: 'inspired',
          note: 'Swiss Air Force PC-6/B2-H2M-1 V-618 from the referenced photograph: two-tone olive green camouflage overall (a generated pattern in the two greens), the serial V-618 in light grey on the rear fuselage and the Swiss marking in a white border above and below the wings, redrawn as original vector art. The unit badges on the nose are omitted; colors and sizes are approximations.',
          references: [references.swiss],
        },
        paints: {
          ...all((slot, i) => camo(slot, [SWISS_DARK, SWISS_LIGHT], 0x5c6 + i, 2.4)),
          spinner: solid(SWISS_DARK),
        },
        markings: [...lettered('serial', 'v-618'), ...wings('wing', 'swiss-mark')],
      },
      {
        id: 'austrian-air-force-3g-eh',
        label: 'Austrian Air Force 3G-EH',
        provenance: {
          kind: 'inspired',
          note: 'Austrian Bundesheer PC-6/B2-H4 3G-EH from the referenced photograph: olive drab overall, the code 3G (national marking) EH in black on the rear fuselage and the national marking (white triangle on a red disc) above and below the wings, redrawn as original vector art. The EUFOR mission titles carried on that deployment are omitted; approximate colors and sizes.',
          references: [references.austria],
        },
        paints: {
          ...all(() => solid(AUSTRIA_OLIVE, { roughness: 0.78 })),
          spinner: solid(AUSTRIA_OLIVE),
        },
        markings: [...lettered('code', 'austria-code'), ...wings('wing', 'austria-wing')],
      },
      {
        id: 'au-23a-peacemaker-sea',
        label: 'AU-23A Peacemaker, Southeast Asia camouflage',
        provenance: {
          kind: 'inspired',
          note: 'Fairchild-built AU-23A Peacemaker in Royal Thai Air Force service from the referenced color photograph: Southeast Asia camouflage of tan, light green and dark green overall (a generated three-color pattern), tan spinner, the sharkmouth on the lower cowling and the tail number 42082 in white on the fin, redrawn as original vector art. The small national roundel and the Thai lettering by the cockpit are too small in the photograph to redraw reliably and are omitted; the US evaluation photograph is a second reference for the camouflage.',
          references: [references.au23, references.au23test],
        },
        paints: {
          ...all((slot, i) => camo(slot, SEA, 0xa023 + i, 2.2)),
          spinner: solid(SEA_TAN),
        },
        markings: [
          ...forward('mouth', 'sharkmouth'),
          ...both('fin', 'tail-42082'),
          ...both('rudder', 'tail-42082'),
        ],
      },
      {
        id: 'skydiving-pink',
        label: 'Belgian skydiving club, pink',
        provenance: {
          kind: 'inspired',
          note: 'Colors of the referenced photograph of a Belgian parachute club Porter (OO-PCV): pink overall with a thin white line along the lower fuselage and a white registration on the rear fuselage. The registration OO-PJX is fictional; the aircraft name, the club artwork on the fin and the manufacturer titles are omitted.',
          references: [references.pink],
        },
        paints: {
          shell: { color: PINK, roughness: 0.5, zones: pinkZones('shell') },
          band: { color: PINK, roughness: 0.5, zones: pinkZones('band') },
          rudder: solid(PINK, { roughness: 0.5 }),
          ...Object.fromEntries(SURFACES.map((slot) => [slot, solid(PINK, { roughness: 0.5 })])),
          spinner: solid(PINK),
        },
        markings: [...lettered('reg', 'reg-oo-pjx')],
      },
      {
        id: 'skydiving-white-navy',
        label: 'German skydiving operator, white and navy',
        provenance: {
          kind: 'inspired',
          note: 'Colors and stripe layout of the referenced photograph of a German drop-zone Turbo Porter (D-FSC.): white overall, a navy band with an amber pinstripe along the cowling and lower fuselage, a navy diagonal across the fin and rudder edged in amber, the German flag at the top of the rudder, navy spinner and a navy registration. The registration D-FJMP is fictional; manufacturer titles are omitted and the band edges are straight-line approximations.',
          references: [references.german],
        },
        paints: {
          shell: { color: WHITE, zones: germanZones('shell') },
          band: { color: WHITE, zones: germanZones('band') },
          rudder: { color: WHITE, zones: finBand('rudder') },
          ...Object.fromEntries(SURFACES.map((slot) => [slot, solid(WHITE)])),
          spinner: solid(NAVY),
        },
        markings: [...lettered('reg', 'reg-d-fjmp'), ...both('flag', 'flag-germany')],
      },
    ],
  };
}
