/**
 * DHC-2 Beaver liveries: a Seattle floatplane operator's white and gold, the US Army's L-20A,
 * the British Army Air Corps' camouflaged AL.1 and the RNZAF's orange Antarctic Beaver.
 * Military insignia, titles and serials are redrawn as original vector art; the civil scheme
 * keeps the operator's colors and stripe layout with no name or logo and a fictional N-number.
 *
 * The airframe is built in its flight datum and posed tail-down on the ground (about 9.4
 * degrees), so every anchor and zone line here is authored in that datum (+Z nose, +X left,
 * +Y up along the fin) and converted through `helpers`.
 */
import { helpers, lettered, lettering, pose, typeDRoundel } from '../art-ga-b.mjs';

// The builder's pose: datum pitched nose-up by atan2(54, 325), then lowered onto the gear.
const PITCH = Math.atan2(54, 325);
const LIFT = -Math.sin(PITCH) * (4.6228 - (543 - 461) / (444 / 9.2456));

export function slots() {
  const burgundy = (node) => ({ materials: ['Beaver-burgundy'], node });
  return {
    shell: { materials: ['Beaver-ivory'], node: 'Beaver-shell-Beaver-ivory' },
    cowl: { materials: ['Beaver-ivory'], node: 'Beaver-engine-Beaver-ivory' },
    // The raised side strips and the lift struts share one burgundy mesh on the shell.
    trim: burgundy('Beaver-shell-Beaver-burgundy'),
    cooler: burgundy('Beaver-engine-Beaver-burgundy'),
    'flap-1': burgundy('Beaver-flap-1-Beaver-burgundy'),
    'flap--1': burgundy('Beaver-flap--1-Beaver-burgundy'),
    'aileron-1': burgundy('Beaver-aileron-1-Beaver-burgundy'),
    'aileron--1': burgundy('Beaver-aileron--1-Beaver-burgundy'),
    'elevator-1': burgundy('Beaver-elevator-1-Beaver-burgundy'),
    'elevator--1': burgundy('Beaver-elevator--1-Beaver-burgundy'),
    rudder: burgundy('Beaver-rudder-moving-Beaver-burgundy'),
    'gear-1': burgundy('Beaver-main-gear-Beaver-burgundy_1'),
    'gear--1': burgundy('Beaver-main-gear-Beaver-burgundy'),
  };
}

const WHITE = '#f1f1ec',
  GOLD = '#e4a51c',
  INK = '#15181b',
  NAVY = '#1d2a4c',
  OD = '#565538', // FS 34087 olive drab
  ARMY_GREEN = '#646a49',
  ARMY_BLACK = '#30352e',
  ORANGE = '#e0531f',
  STENCIL_WHITE = '#eeeeea';

/** Wing chord plane height at span station x (datum: 2 degrees dihedral outboard of 0.73 m). */
const wingY = (x) => 2.74 + Math.tan((2 * Math.PI) / 180) * Math.max(0, Math.abs(x) - 0.73);
const WING_MID = (2.7 + 1.47) / 2;

export default function design({ kit: k, space, bounds }) {
  const h = helpers(space, pose(PITCH, LIFT));
  const SIDES = [1, -1];
  // Artwork canvases (metres); each anchor matches its artwork's size exactly.
  const STAR_R = 0.27,
    STAR = [4.25 * STAR_R, 2.3 * STAR_R],
    WING_STAR_R = 0.45,
    WING_STAR = [4.25 * WING_STAR_R, 2.3 * WING_STAR_R];
  const anchors = {};
  for (const s of SIDES) {
    // Aft fuselage side, which narrows about 0.13 m per metre toward the tail.
    const aft = (z, y, w, hh, reach = 1) => h.side('shell', s, z, y, w, hh, { reach, toe: 0.13 });
    anchors[`reg-${s}`] = aft(-1.55, 2.12, 1.75, 0.3);
    anchors[`star-${s}`] = aft(-1.95, 1.84, ...STAR);
    anchors[`roundel-${s}`] = aft(-1.95, 1.84, 0.6, 0.6);
    // AAC: roundel just aft of the cabin, serial and ARMY behind it (same stations both sides).
    anchors[`aac-roundel-${s}`] = aft(-0.05, 1.8, 0.3, 0.3);
    anchors[`aac-title-${s}`] = aft(-1.05, 1.8, 1.45, 0.24);
    anchors[`tail-serial-${s}`] = aft(-2.85, 1.86, 0.66, 0.14, 0.8);
    // Fin and rudder (the same box on both parts so artwork runs across the hinge).
    anchors[`fin-${s}`] = h.side('shell', s, -3.62, 3.0, 1.0, 0.62, { reach: 0.1 });
    anchors[`rudder-${s}`] = h.side('rudder', s, -3.62, 3.0, 1.0, 0.62, { reach: 0.1 });
    // Wings: upper and lower faces at mid-span, artwork top toward the leading edge.
    const x = s * 4.7;
    const tilt = { dihedral: (2 * Math.PI) / 180 };
    anchors[`wing-star-top-${s}`] = h.face('shell', x, WING_MID, wingY(x), ...WING_STAR, tilt);
    anchors[`wing-star-bottom-${s}`] = h.face('shell', x, WING_MID, wingY(x), ...WING_STAR, {
      down: true,
      ...tilt,
    });
    anchors[`wing-roundel-top-${s}`] = h.face('shell', x, WING_MID, wingY(x), 1.1, 1.1, tilt);
    anchors[`wing-roundel-bottom-${s}`] = h.face('shell', x, WING_MID, wingY(x), 1.1, 1.1, {
      down: true,
      ...tilt,
    });
    // Outboard of the lift-strut fitting (x 3.0), which would hide the inner letters.
    const xl = s * 5.05;
    anchors[`wing-title-${s}`] = h.face('shell', xl, WING_MID, wingY(xl), 4.0, 1.0, {
      down: true,
      ...tilt,
    });
  }

  /* ---------------------------------------------------------------- artwork ---- */
  const graphics = {};
  for (const [id, r] of [
    ['us-star-fuselage', STAR_R],
    ['us-star-wing', WING_STAR_R],
  ]) {
    const c = new k.Canvas(4.25 * r, 2.3 * r);
    graphics[id] = k.usInsignia(c, (4.25 * r) / 2, 1.15 * r, r).graphic('US national insignia');
  }
  graphics['us-army-fin'] = lettered(k, 1.0, 0.62, STENCIL_WHITE, [
    { text: 'U.S. ARMY', y: 0.45, height: 0.13 },
    { text: '116856', y: 0.2, height: 0.17 },
  ]);
  graphics['us-army-wing'] = lettering(k, 'U.S. ARMY', 4.0, 1.0, STENCIL_WHITE, { fill: 0.64 });
  {
    // AL.1: serial and ARMY in one row (XP820 photograph); the roundel is its own marking.
    const c = new k.Canvas(1.45, 0.24);
    c.text(INK, 'XP820', { x: 0.02, y: 0.1, height: 0.1, align: 'left' });
    c.text(INK, 'ARMY', { x: 1.43, y: 0.12, height: 0.17, align: 'right' });
    graphics['aac-title'] = c.graphic('XP820 ARMY');
    const r = new k.Canvas(0.3, 0.3);
    typeDRoundel(k, r, 0.15, 0.15, 0.14);
    graphics['roundel-small'] = r.graphic('Type D roundel');
    const w = new k.Canvas(1.1, 1.1);
    typeDRoundel(k, w, 0.55, 0.55, 0.5);
    graphics['roundel-wing'] = w.graphic('Type D roundel');
    const f = new k.Canvas(0.6, 0.6);
    typeDRoundel(k, f, 0.3, 0.3, 0.27);
    graphics['roundel-fuselage'] = f.graphic('Type D roundel');
  }
  graphics.nz6001 = lettering(k, 'NZ6001', 0.66, 0.14, INK, { fill: 0.82 });
  graphics['reg-n417kb'] = lettering(k, 'N417KB', 1.75, 0.3, NAVY, { fill: 0.8, tracking: 0.04 });

  /* ---------------------------------------------------------------- zones ---- */
  // A band between two datum lines, in two segments (level along the cabin, rising aft) that
  // meet at station 0.5 so the edges stay continuous.
  const BREAK = 0.5;
  const band = (
    slot,
    color,
    [lowFront, lowTail],
    [highFront, highTail],
    tail = -3.7,
    extra = [],
  ) => [
    {
      color,
      planes: [
        h.ahead(slot, BREAK),
        h.line(slot, [BREAK, lowFront], [4.5, lowFront], 1),
        h.line(slot, [BREAK, highFront], [4.5, highFront], -1),
        ...extra,
      ],
    },
    {
      color,
      planes: [
        h.behind(slot, BREAK),
        h.line(slot, [BREAK, lowFront], [tail, lowTail], 1),
        h.line(slot, [BREAK, highFront], [tail, highTail], -1),
        ...extra,
      ],
    },
  ];
  const fuselageOnly = (slot) => h.within(slot, 0.9);

  // Seattle floatplane scheme: gold band under the windows with a black pinstripe on top,
  // sweeping aft into a gold fin behind a black diagonal; gold cowl ring.
  const goldZones = (slot) => {
    const keep = fuselageOnly(slot);
    // Fin: everything behind a diagonal parallel to the fin leading edge, above the band.
    const diagonal = [
      [-2.78, 2.3],
      [-3.42, 3.75],
    ];
    const shifted = diagonal.map(([z, y]) => [z + 0.09, y]);
    return [
      // The band stops ahead of the tailplane root (z -3.65 inboard).
      ...band(slot, GOLD, [1.38, 1.86], [1.78, 2.06], -3.7, [...keep, h.ahead(slot, -3.5)]),
      ...band(slot, INK, [1.78, 2.06], [1.83, 2.11], -3.7, [...keep, h.ahead(slot, -3.5)]),
      {
        color: GOLD,
        planes: [
          h.line(slot, ...diagonal, -1),
          h.line(slot, [BREAK, 1.78], [-3.7, 2.06], 1),
          ...keep,
        ],
      },
      {
        color: INK,
        planes: [
          h.line(slot, ...diagonal, 1),
          h.line(slot, ...shifted, -1),
          h.line(slot, [BREAK, 1.83], [-3.7, 2.11], 1),
          ...keep,
        ],
      },
    ];
  };

  // RNZAF Antarctic: black cheatline at the window sills from the cowl back past the door.
  const orangeZones = (slot) => [
    {
      color: INK,
      planes: [
        h.line(slot, [3.4, 1.88], [-1.2, 1.9], 1),
        h.line(slot, [3.4, 2.03], [-1.2, 1.98], -1),
        h.behind(slot, 3.45),
        h.ahead(slot, -1.2),
        ...fuselageOnly(slot),
      ],
    },
  ];

  // AAC disruptive scheme on the fuselage and fin, laid out from the XP820 photograph: dark
  // over the cabin and in a band across the rear fuselage and fin, green elsewhere and behind
  // the lettering. Regions keep the zones off the wings and tailplane, which carry a generated
  // pattern in the same two colors.
  const armyRegions = (slot) => [
    [...h.within(slot, 0.9), h.below(slot, 2.66), h.ahead(slot, -3.3)],
    [...h.within(slot, 0.16), h.behind(slot, -3.3)],
    [...h.within(slot, 0.12), h.above(slot, 2.3), h.behind(slot, -0.8)],
  ];
  const armyPatches = (slot) => [
    // Cabin: ahead of a raked line behind the door, leaving a green lower-front corner.
    [h.line(slot, [0.35, 0.9], [-0.55, 2.9], 1), h.line(slot, [1.0, 0.9], [3.4, 2.1], 1)],
    // A band across the rear fuselage and the fin.
    [h.line(slot, [-2.25, 1.2], [-2.95, 3.7], -1), h.line(slot, [-2.95, 1.2], [-3.7, 3.7], 1)],
    // The lower tail cone under the tailplane.
    [h.line(slot, [-1.6, 1.2], [-4.6, 1.95], -1)],
  ];
  const armyZones = (slot) => {
    const regions = armyRegions(slot);
    return [
      ...regions.map((planes) => ({ color: ARMY_GREEN, planes })),
      ...armyPatches(slot).flatMap((patch) =>
        regions.map((region) => ({ color: ARMY_BLACK, planes: [...region, ...patch] })),
      ),
    ];
  };

  /* ---------------------------------------------------------------- paints ---- */
  const solid = (color, extra = {}) => ({ color, ...extra });
  const surfaces = (color) => ({
    'flap-1': solid(color),
    'flap--1': solid(color),
    'aileron-1': solid(color),
    'aileron--1': solid(color),
    'elevator-1': solid(color),
    'elevator--1': solid(color),
  });
  const longest = (slot) => {
    const b = bounds[slot];
    return Math.max(...b.max.map((v, i) => v - b.min[i]));
  };
  // Camouflage patches of a constant size (metres) whatever a slot's extent.
  const camo = (slot, colors, seed, patch = 2.2) => ({
    color: colors[0],
    roughness: 0.82,
    camouflage: { colors, scale: Math.max(0.2, longest(slot) / patch / 4), seed, style: 'blotch' },
  });
  const both = (anchor, graphic, flipRight = false) =>
    SIDES.map((s) => ({
      anchor: `${anchor}-${s}`,
      graphic,
      ...(flipRight && s < 0 ? { flip: true } : {}),
    }));

  const references = {
    kenmore: {
      title:
        'DHC-2 Beaver floatplane N900KA on Lake Union, Seattle (Wikimedia Commons, CC BY-SA 3.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Kenmore_Air_DHC-2_Beaver_floatplane_N900KA_on_Lake_Union_-_03.jpg',
    },
    l20a: {
      title: 'US Army L-20A 51-16856 (Wikimedia Commons, CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:DeHavillandCanada_L-20A_51-16856_(6791095726).jpg',
    },
    u6a: {
      title: 'US Army U-6A Beaver in museum livery (Wikimedia Commons, CC BY 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:DeHavilland_U-6A,_Beaver_in_US_Army_livery.jpg',
    },
    al1: {
      title:
        "Beaver AL.1 'XP820' of the Army Historic Aircraft Flight (Wikimedia Commons, CC BY-SA 2.0)",
      url: 'https://commons.wikimedia.org/wiki/File:De_Havilland_Canada_Beaver_AL.1_%E2%80%98XP820%E2%80%99_(G-CICP)_(51754015170).jpg',
    },
    rnzaf: {
      title: 'RNZAF Trans-Antarctic Expedition Beaver NZ6001 (Wikimedia Commons, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:RNZAFTransantarcticDHCBeaver.jpg',
    },
  };

  return {
    selected: 'seattle-floatplane-gold',
    anchors,
    graphics,
    variants: [
      {
        id: 'seattle-floatplane-gold',
        label: 'Seattle floatplane operator, white and gold',
        provenance: {
          kind: 'inspired',
          note: "Colors and stripe layout of a Seattle floatplane operator's Beavers from the referenced photograph: white airframe, gold band under the windows with a black pinstripe, sweeping aft into a gold fin and rudder behind a black diagonal, gold cowl ring, navy registration on the aft fuselage. The operator's name and logo are omitted and the registration N417KB is fictional. Shown on the wheeled model; band edges are straight-line approximations of the painted curves.",
          references: [references.kenmore],
        },
        paints: {
          shell: { color: WHITE, zones: goldZones('shell') },
          cowl: {
            color: WHITE,
            zones: [...goldZones('cowl'), { color: GOLD, planes: [h.ahead('cowl', 3.9)] }],
          },
          trim: { color: WHITE, zones: goldZones('trim') },
          cooler: solid(WHITE),
          ...surfaces(WHITE),
          rudder: solid(GOLD),
          'gear-1': solid(WHITE),
          'gear--1': solid(WHITE),
        },
        markings: [...both('reg', 'reg-n417kb')],
      },
      {
        id: 'us-army-l20a-1950s',
        label: 'US Army L-20A, 1950s',
        provenance: {
          kind: 'inspired',
          note: 'US Army L-20A 51-16856 from the referenced photograph: olive drab overall (FS 34087), U.S. ARMY over the serial 116856 across the fin and rudder, the national insignia on the aft fuselage and upper left / lower right wing, U.S. ARMY under the left wing, all redrawn as original vector art. The photograph is black and white: the light lettering is shown white and the olive drab follows the referenced U-6A museum aircraft; marking sizes are estimates.',
          references: [references.l20a, references.u6a],
        },
        paints: {
          shell: solid(OD, { roughness: 0.78 }),
          cowl: solid(OD, { roughness: 0.78 }),
          trim: solid(OD, { roughness: 0.78 }),
          cooler: solid(OD),
          ...surfaces(OD),
          rudder: solid(OD, { roughness: 0.78 }),
          'gear-1': solid(OD),
          'gear--1': solid(OD),
        },
        markings: [
          ...both('star', 'us-star-fuselage'),
          ...both('fin', 'us-army-fin'),
          ...both('rudder', 'us-army-fin'),
          { anchor: 'wing-star-top-1', graphic: 'us-star-wing' },
          { anchor: 'wing-star-bottom--1', graphic: 'us-star-wing' },
          { anchor: 'wing-title-1', graphic: 'us-army-wing' },
        ],
      },
      {
        id: 'army-air-corps-al1-xp820',
        label: 'Army Air Corps Beaver AL.1 XP820',
        provenance: {
          kind: 'inspired',
          note: 'British Army Air Corps Beaver AL.1 XP820 as flown by the Army Historic Aircraft Flight, from the referenced photograph: disruptive dark green and black camouflage laid out on the fuselage and fin after the photograph (dark cabin, a dark band across the rear fuselage and fin), with a generated pattern in the same colors on the wings and tail surfaces, black cowling and gear legs, the serial XP820, ARMY and the type D roundel on the aft fuselage, roundels above and below the wings, all redrawn as original vector art. Approximate colors and sizes.',
          references: [references.al1],
        },
        paints: {
          shell: {
            ...camo('shell', [ARMY_GREEN, ARMY_BLACK], 0x5a1820),
            zones: armyZones('shell'),
          },
          cowl: solid('#1d201f', { roughness: 0.7 }),
          trim: { color: ARMY_BLACK, roughness: 0.82, zones: armyZones('trim') },
          cooler: solid('#1d201f'),
          'flap-1': camo('flap-1', [ARMY_GREEN, ARMY_BLACK], 0x5a1822),
          'flap--1': camo('flap--1', [ARMY_GREEN, ARMY_BLACK], 0x5a1823),
          'aileron-1': camo('aileron-1', [ARMY_GREEN, ARMY_BLACK], 0x5a1824),
          'aileron--1': camo('aileron--1', [ARMY_GREEN, ARMY_BLACK], 0x5a1825),
          'elevator-1': camo('elevator-1', [ARMY_GREEN, ARMY_BLACK], 0x5a1826),
          'elevator--1': camo('elevator--1', [ARMY_GREEN, ARMY_BLACK], 0x5a1827),
          rudder: camo('rudder', [ARMY_GREEN, ARMY_BLACK], 0x5a1828),
          'gear-1': solid('#1d201f'),
          'gear--1': solid('#1d201f'),
        },
        markings: [
          ...both('aac-roundel', 'roundel-small'),
          ...both('aac-title', 'aac-title'),
          ...SIDES.flatMap((s) => [
            { anchor: `wing-roundel-top-${s}`, graphic: 'roundel-wing' },
            { anchor: `wing-roundel-bottom-${s}`, graphic: 'roundel-wing' },
          ]),
        ],
      },
      {
        id: 'rnzaf-antarctic-nz6001',
        label: 'RNZAF Antarctic Flight NZ6001, 1957',
        provenance: {
          kind: 'inspired',
          note: "RNZAF Beaver NZ6001 of the Commonwealth Trans-Antarctic Expedition from the referenced museum photograph: high-visibility orange overall, black cowling and a black cheatline at the window sills, RNZAF type D roundels on the aft fuselage and wings and the serial NZ6001, redrawn as original vector art. The expedition title on the cowling and the small aircraft name are omitted; the cheatline's aft end and marking sizes are estimates.",
          references: [references.rnzaf],
        },
        paints: {
          shell: { color: ORANGE, roughness: 0.55, zones: orangeZones('shell') },
          cowl: solid(INK, { roughness: 0.5 }),
          trim: { color: ORANGE, roughness: 0.55, zones: orangeZones('trim') },
          cooler: solid(ORANGE),
          ...surfaces(ORANGE),
          rudder: solid(ORANGE, { roughness: 0.55 }),
          'gear-1': solid(ORANGE),
          'gear--1': solid(ORANGE),
        },
        markings: [
          ...both('roundel', 'roundel-fuselage'),
          ...both('tail-serial', 'nz6001'),
          ...SIDES.flatMap((s) => [
            { anchor: `wing-roundel-top-${s}`, graphic: 'roundel-wing' },
            { anchor: `wing-roundel-bottom-${s}`, graphic: 'roundel-wing' },
          ]),
        ],
      },
    ],
  };
}
