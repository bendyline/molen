/**
 * F/A-18C Hornet liveries: a US Navy CAG jet, the Blue Angels, a US Marine Corps squadron and
 * the Finnish and Swiss air forces, each studied from the referenced photographs. Insignia,
 * codes, modex numbers and squadron art are redrawn as original vector artwork (no reference
 * pixels); squadron crests and team badges are left off.
 *
 * Model frame: +Z nose, +X the aircraft's left, +Y up. The fins are canted out about 20
 * degrees; their outer faces run from x 0.92 at the root (y 2.25) to x 1.78 at the tip (y 4.64).
 * Fin-face art is drawn in a "fin canvas" (x metres aft of z = FIN_FRONT, y metres up the fin
 * from its root), flipped on the right fin so it lands on the same fin geometry on both sides.
 */

// Paint slots, one per airframe part, plus the fins' hinge-line strips. The airframe slot also
// reaches the canopy sill and the spine speed brake (cut from its skin).
export function slots() {
  const gray = (node) => ({ materials: ['FA18-gray'], node });
  const upper = (node) => ({ materials: ['FA18-upper'], node });
  const out = {
    airframe: gray('FA18-airframe-FA18-gray'),
    // Wings (both skins), the LEX tops and the upper fuselage between the fins.
    upper: upper('FA18-airframe-FA18-upper'),
    radome: { materials: ['FA18-radome'], node: 'FA18-airframe-FA18-radome' },
    'nose-door': gray('FA18-nose-door-FA18-gray'),
  };
  for (const side of ['1', '-1']) {
    out[`engine-${side}`] = gray(`FA18-engine-${side}-FA18-gray`);
    out[`fin-${side}`] = gray(`FA18-fin-${side}-FA18-gray`);
    out[`fin-strip-${side}`] = { materials: ['FA18-seals'], node: `FA18-fin-${side}-FA18-seals` };
    out[`gear-${side}`] = gray(`FA18-gear-${side}-FA18-gray`);
    out[`main-door-${side}`] = gray(`FA18-main-door-${side}-FA18-gray`);
    out[`lef-in-${side}`] = upper(`FA18-leading-${side}-FA18-upper`);
    out[`lef-out-${side}`] = upper(`FA18-leading-${side}-FA18-upper_1`);
    out[`flap-${side}`] = upper(`FA18-flap-${side}-FA18-upper`);
    out[`aileron-${side}`] = upper(`FA18-aileron-${side}-FA18-upper`);
    out[`stabilator-${side}`] = upper(`FA18-stabilator-${side}-FA18-upper`);
    out[`rudder-${side}`] = upper(`FA18-rudder-${side}-FA18-upper`);
  }
  return out;
}

const SIDES = ['1', '-1'];
const CANT = (20 * Math.PI) / 180;
const FIN_FRONT = -0.5,
  FIN_ROOT = 2.2,
  FIN_W = 3.8,
  FIN_H = 2.6; // along the fin span
/** Outer fin face x at height y (metres), on the left fin. */
const finX = (y) => 0.93 + (y - 2.25) * Math.tan(CANT);

/* Colors (approximate FED-STD-595 shades as they read in daylight photographs). */
const GULL_DARK = '#8b939a', // FS 36320 dark ghost gray
  GULL_LIGHT = '#a9b0b6', // FS 36375 light ghost gray
  INSIGNIA_GRAY = '#5d666d',
  BLACK = '#17191b',
  WHITE = '#f2f2ee',
  NAVY_BLUE = '#1c2752', // squadron dark blue
  DRAGON_GOLD = '#efb51e',
  DRAGON_RED = '#c4262c',
  ANGEL_BLUE = '#1d2b5c', // FS 15050
  ANGEL_GOLD = '#f2b91c', // FS 13538
  MARINE_RED = '#b3232a',
  SWISS_GRAY = '#a3abb1';

export default function design({ kit: k, space }) {
  const anchors = {};
  const sign = (side) => Number(side);
  // Fin canvas helper: model (z, y) on the fin face to canvas metres.
  const fin = (z, y) => [FIN_FRONT - z, (y - FIN_ROOT) / Math.cos(CANT)];
  for (const side of SIDES) {
    const s = sign(side);
    const onFin = (y, z, width, height) =>
      space.anchor(`fin-${side}`, {
        center: [s * finX(y), y, z],
        facing: [s * Math.cos(CANT), -Math.sin(CANT), 0],
        width,
        height,
        depth: 0.3,
      });
    const midY = FIN_ROOT + (FIN_H / 2) * Math.cos(CANT);
    anchors[`fin-face-${side}`] = onFin(midY, FIN_FRONT - FIN_W / 2, FIN_W, FIN_H);
    anchors[`fin-code-${side}`] = onFin(3.42, -2.75, 1.2, 0.5);
    anchors[`fin-big-${side}`] = onFin(3.5, -2.9, 0.6, 1.0);
    anchors[`fin-tip-${side}`] = onFin(4.5, -3.45, 0.5, 0.2);
    anchors[`fin-serial-${side}`] = onFin(2.68, -2.25, 1.5, 0.34);
    anchors[`fin-mark-${side}`] = onFin(3.6, -2.95, 0.42, 0.42);
    // Forward fuselage under the LEX, below the rear canopy.
    anchors[`insignia-${side}`] = space.anchor('airframe', {
      center: [s * 0.56, 1.84, 3.65],
      facing: [s, -0.35, 0],
      width: 0.85,
      height: 0.46,
      depth: 0.5,
    });
    anchors[`roundel-${side}`] = space.anchor('airframe', {
      center: [s * 0.56, 1.84, 3.95],
      facing: [s, -0.35, 0],
      width: 0.36,
      height: 0.36,
      depth: 0.5,
    });
    anchors[`registration-${side}`] = space.anchor('airframe', {
      center: [s * 0.55, 1.82, 3.35],
      facing: [s, -0.35, 0],
      width: 0.5,
      height: 0.16,
      depth: 0.5,
    });
    anchors[`nose-modex-${side}`] = space.anchor('airframe', {
      center: [s * 0.47, 2.0, 7.55],
      facing: [s, 0, 0],
      width: 0.7,
      height: 0.26,
      depth: 0.4,
    });
    anchors[`nose-title-${side}`] = space.anchor('airframe', {
      center: [s * 0.55, 1.85, 5.55],
      facing: [s, -0.3, 0],
      width: 1.5,
      height: 0.3,
      depth: 0.5,
    });
    // Engine nacelle side under the wing, aft of the DANGER stencil.
    anchors[`nacelle-${side}`] = space.anchor(`engine-${side}`, {
      center: [s * 1.2, 1.8, -0.62],
      facing: [s, 0, 0],
      width: 2.2,
      height: 0.34,
      depth: 0.5,
    });
    anchors[`tail-serial-${side}`] = space.anchor(`engine-${side}`, {
      center: [s * 0.94, 2.02, -3.6],
      facing: [s, 0, 0],
      width: 0.5,
      height: 0.09,
      depth: 0.4,
    });
  }
  // Wing marks, on the wing box between the leading- and trailing-edge flaps (at x 3.6 the
  // upper skin lies at y 2.09-2.16, the lower at 2.02-2.08).
  const wingMark = (x, up, width, height) =>
    space.anchor('upper', {
      center: [x, up ? 2.14 : 2.05, -0.3],
      facing: [0, up ? 1 : -1, 0],
      up: [0, 0, 1],
      width,
      height,
      depth: 0.14,
    });
  for (const [name, x, up] of [
    ['upper-left', 3.6, true],
    ['upper-right', -3.6, true],
    ['lower-left', 3.6, false],
    ['lower-right', -3.6, false],
  ]) {
    anchors[`wing-${name}`] = wingMark(x, up, 1.02, 0.54);
    anchors[`wing-round-${name}`] = wingMark(x, up, 0.8, 0.8);
  }

  /* Graphics. */
  const text = (label, w, h, color, opts = {}) =>
    new k.Canvas(w, h)
      .text(color, label, { x: w / 2, y: h / 2, height: h * 0.8, maxWidth: w * 0.96, ...opts })
      .graphic(label);
  const insignia = (w, opts) => {
    const r = w / 4.4;
    return k
      .usInsignia(new k.Canvas(w, r * 2.35), w / 2, r * 1.175, r, opts)
      .graphic('US national insignia');
  };
  const graphics = {
    'insignia-lowvis': insignia(0.85, { style: 'lowvis', color: INSIGNIA_GRAY }),
    'insignia-lowvis-wing': insignia(1.02, { style: 'lowvis', color: INSIGNIA_GRAY }),
    'insignia-full': insignia(0.85, { style: 'full' }),
  };

  /* The Golden Dragons' fin: a gold dragon head at the tip and a gold sweep at the root,
     original drawings in the fin canvas. */
  graphics['dragon-fin'] = (() => {
    const c = new k.Canvas(FIN_W, FIN_H);
    const at = (pts) => pts.map(([z, y]) => fin(z, y));
    // Head and mane, mouth open toward the leading edge.
    c.add(
      DRAGON_GOLD,
      at([
        [-2.2, 4.26],
        [-2.6, 4.4],
        [-2.95, 4.5],
        [-3.15, 4.68],
        [-3.3, 4.56],
        [-3.48, 4.7],
        [-3.6, 4.55],
        [-3.8, 4.7],
        [-3.9, 4.5],
        [-4.15, 4.6],
        [-4.1, 4.35],
        [-4.3, 4.25],
        [-4.1, 4.08],
        [-4.25, 3.9],
        [-3.95, 3.86],
        [-3.9, 3.66],
        [-3.6, 3.74],
        [-3.15, 3.72],
        [-2.6, 3.86],
        [-2.3, 3.92],
        [-2.42, 3.98],
        [-2.95, 4.04],
        [-2.32, 4.14],
      ]),
    );
    // Mouth, teeth, eye and nostril.
    c.add(
      DRAGON_RED,
      at([
        [-2.36, 4.12],
        [-2.95, 4.05],
        [-2.45, 3.98],
      ]),
    );
    for (const z of [-2.5, -2.66, -2.82])
      c.add(
        WHITE,
        at([
          [z, 4.11],
          [z - 0.1, 4.08],
          [z - 0.05, 4.03],
        ]),
      );
    c.add(
      BLACK,
      at([
        [-2.92, 4.36],
        [-3.18, 4.42],
        [-3.2, 4.33],
        [-3.0, 4.3],
      ]),
    );
    c.circle(DRAGON_RED, ...fin(-3.1, 4.37), 0.03, 10);
    c.circle(BLACK, ...fin(-2.42, 4.24), 0.035, 10);
    // Scale ridges down the neck.
    for (const [z, y] of [
      [-3.5, 4.2],
      [-3.7, 4.05],
      [-3.55, 3.92],
    ])
      c.add(
        NAVY_BLUE,
        at([
          [z, y],
          [z - 0.22, y + 0.06],
          [z - 0.12, y - 0.06],
        ]),
      );
    // The gold sweep across the lower fin, ending in a point toward the leading edge.
    const sweep = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12,
        z = -3.6 + 1.55 * t,
        y = 2.55 + 0.75 * t * t;
      sweep.push([z, y]);
    }
    const inner = sweep.map(([z, y], i) => [z + 0.02 * i, y + 0.15 * (1 - i / 12)]).reverse();
    c.add(DRAGON_GOLD, at([...sweep, ...inner]));
    return c.graphic('Golden dragon fin art');
  })();
  graphics['code-nf'] = text('NF', 1.2, 0.5, WHITE, { face: 'technical' });
  graphics['modex-300'] = text('300', 0.7, 0.26, BLACK, { face: 'technical' });

  /* Blue Angels. */
  Object.assign(graphics, {
    'angels-1': text('1', 0.6, 1.0, ANGEL_GOLD, { face: 'geometric', height: 0.82 }),
    'angels-navy': text('U.S. NAVY', 2.2, 0.34, ANGEL_GOLD, { face: 'technical', tracking: 0.06 }),
    'angels-title': text('Blue Angels', 1.5, 0.3, ANGEL_GOLD, {
      face: 'regular',
      slant: 0.22,
    }),
    'angels-serial': text('163498', 0.5, 0.09, ANGEL_GOLD, { face: 'technical' }),
  });

  /* VMFA-232 Red Devils. */
  Object.assign(graphics, {
    'tip-23': text('23', 0.5, 0.2, WHITE, { face: 'technical' }),
    'code-wt': text('WT', 1.2, 0.5, INSIGNIA_GRAY, { face: 'technical' }),
    'modex-23': text('23', 0.7, 0.26, INSIGNIA_GRAY, { face: 'technical' }),
    marines: text('MARINES', 1.5, 0.22, INSIGNIA_GRAY, { face: 'technical', tracking: 0.08 }),
  });

  /* Finland and Switzerland. */
  Object.assign(graphics, {
    'finland-roundel': k
      .finlandRoundel(new k.Canvas(0.36, 0.36), 0.18, 0.18, 0.175)
      .graphic('Finnish roundel'),
    'finland-roundel-wing': k
      .finlandRoundel(new k.Canvas(0.8, 0.8), 0.4, 0.4, 0.39)
      .graphic('Finnish roundel (wing)'),
    'hn-442': text('HN-442', 0.5, 0.16, BLACK, { face: 'technical' }),
    'tip-42': text('42', 0.5, 0.2, BLACK, { face: 'technical' }),
    'swiss-fin': k.swissMark(new k.Canvas(0.42, 0.42), 0.21, 0.21, 0.4).graphic('Swiss marking'),
    'swiss-wing': k
      .swissMark(new k.Canvas(0.8, 0.8), 0.4, 0.4, 0.76)
      .graphic('Swiss marking (wing)'),
    'j-5004': text('J-5004', 1.5, 0.34, BLACK, { face: 'technical' }),
    'modex-004': text('004', 0.7, 0.26, '#3a4247', { face: 'technical' }),
  });

  /* Paint helpers. */
  const upperSlots = [
    'upper',
    ...SIDES.flatMap((s) => [
      `lef-in-${s}`,
      `lef-out-${s}`,
      `flap-${s}`,
      `aileron-${s}`,
      `stabilator-${s}`,
      `rudder-${s}`,
    ]),
  ];
  const lowerSlots = [
    'airframe',
    'nose-door',
    ...SIDES.flatMap((s) => [`engine-${s}`, `gear-${s}`, `main-door-${s}`]),
  ];
  const finSlots = SIDES.flatMap((s) => [`fin-${s}`, `fin-strip-${s}`]);
  /** Tactical two-tone: upper surfaces and fins `top`, fuselage sides and belly `bottom`. */
  const twoTone = (top, bottom, radome = '#7d858a') => ({
    ...Object.fromEntries(upperSlots.map((slot) => [slot, { color: top }])),
    ...Object.fromEntries(lowerSlots.map((slot) => [slot, { color: bottom }])),
    ...Object.fromEntries(finSlots.map((slot) => [slot, { color: top }])),
    radome: { color: radome },
  });
  const both = (anchor, graphic, extra = {}) =>
    SIDES.map((side) => ({ anchor: `${anchor}-${side}`, graphic, ...extra }));
  const finArt = (graphic) => [
    { anchor: 'fin-face-1', graphic },
    { anchor: 'fin-face--1', graphic, flip: true },
  ];
  // Fin zones: the leading-edge strip (ahead of a line parallel to the leading edge) and the
  // tip band.
  const leStrip = (slot, width) =>
    space.sideLine(slot, [-0.63 - width, 2.25], [-2.87 - width, 4.64], 1);
  const finZones = (color, { strip = 0, tip }) =>
    Object.fromEntries(
      SIDES.map((side) => {
        const slot = `fin-${side}`;
        const zones = [];
        if (strip) zones.push({ color, planes: [leStrip(slot, strip)] });
        if (tip) zones.push({ color, planes: [space.above(slot, tip)] });
        return [slot, zones];
      }),
    );

  const references = {
    dragons: {
      title: 'VFA-192 F/A-18C CAG 300 launching from a carrier (US Navy, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:An_F-A-18C_Hornet_launches_from_the_flight_deck_of_the_conventionally_powered_aircraft_carrier.jpg',
    },
    angels: {
      title: 'Blue Angels F/A-18C BuNo 163498, No. 1, 2014 (CC BY 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:McDonnell_Douglas_FA-18C_Hornet_BuNo_163498_Blue_Angels_1_LSide_Dawn_SNF_04April2014_(14584524464).jpg',
    },
    vmfa232: {
      title: 'VMFA-232 F/A-18C taxiing at Tinian, Cope North 24 (USMC, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:VMFA-232_FA-18C_taxis_at_Tinian_during_Cope_North_24.jpg',
    },
    finland: {
      title: 'Finnish Air Force F/A-18C HN-442, RIAT 2025 (CC BY 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Finnish_Air_Force_McDonnell_Douglas_FA-18C_Hornet_HN-442_Royal_International_Air_Tattoo_2025_03.jpg',
    },
    swiss: {
      title: 'Swiss Air Force F/A-18C J-5004 taxiing (CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:McDonnell_Douglas_F-A-18C_Hornet_%E2%80%98J-5004_-_004%E2%80%99_(31704782592).jpg',
    },
  };
  const navyWings = [
    { anchor: 'wing-upper-left', graphic: 'insignia-lowvis-wing' },
    { anchor: 'wing-lower-right', graphic: 'insignia-lowvis-wing' },
  ];

  /* 1. VFA-192 Golden Dragons CAG jet. */
  const dragons = {
    id: 'vfa-192-golden-dragons',
    label: 'VFA-192 Golden Dragons CAG',
    provenance: {
      kind: 'inspired',
      note: "VFA-192 commander's (CAG) F/A-18C 300 from the referenced US Navy photograph: tactical ghost grays, dark blue fins carrying the squadron's gold dragon head at the tip and a gold sweep at the root (original drawings, not the squadron's artwork), the white NF code of Carrier Air Wing 5, modex 300 and low-visibility national insignia. The yellow inner fin faces, crew names and stencils are omitted; the dragon is a simplified interpretation.",
      references: [references.dragons],
    },
    paints: {
      ...twoTone(GULL_DARK, GULL_LIGHT),
      ...Object.fromEntries(finSlots.map((slot) => [slot, { color: NAVY_BLUE }])),
      'rudder-1': { color: NAVY_BLUE },
      'rudder--1': { color: NAVY_BLUE },
    },
    markings: [
      ...finArt('dragon-fin'),
      ...both('fin-code', 'code-nf'),
      ...both('nose-modex', 'modex-300'),
      ...both('insignia', 'insignia-lowvis'),
      ...navyWings,
    ],
  };

  /* 2. Blue Angels No. 1. */
  const angelZones = finZones(ANGEL_GOLD, { strip: 0.16, tip: 4.45 });
  const lexRim = (side) => {
    const s = sign(side);
    // The yellow rim along the LEX edge: outboard of a line 0.13 m inside the edge, ahead of
    // the wing leading edge.
    return {
      color: ANGEL_GOLD,
      planes: [space.plane('upper', [s, 0, 0.1407], [s * 1.585, 0, 0]), space.ahead('upper', 2.4)],
    };
  };
  const angels = {
    id: 'blue-angels-1',
    label: 'Blue Angels No. 1, 2014',
    provenance: {
      kind: 'inspired',
      note: 'US Navy Flight Demonstration Squadron F/A-18C BuNo 163498, No. 1, from the referenced 2014 photograph: Blue Angels blue (FS 15050) overall with FS 13538 yellow on the fin leading edges and tips and along the LEX edges, the yellow 1 on the fins, U.S. NAVY on the nacelles, the Blue Angels title under the cockpit set in plain italic type, and the serial on the tail. The team crest, the script logotype and crew names are omitted; trim widths are approximations.',
      references: [references.angels],
    },
    paints: {
      ...Object.fromEntries(
        [...upperSlots, ...lowerSlots, ...finSlots].map((slot) => [slot, { color: ANGEL_BLUE }]),
      ),
      upper: { color: ANGEL_BLUE, zones: [lexRim('1'), lexRim('-1')] },
      'fin-1': { color: ANGEL_BLUE, zones: angelZones['fin-1'] },
      'fin--1': { color: ANGEL_BLUE, zones: angelZones['fin--1'] },
      radome: { color: ANGEL_BLUE },
    },
    markings: [
      ...both('fin-big', 'angels-1'),
      ...both('nacelle', 'angels-navy'),
      ...both('nose-title', 'angels-title'),
      ...both('tail-serial', 'angels-serial'),
    ],
  };

  /* 3. VMFA-232 Red Devils. */
  const devilZones = finZones(MARINE_RED, { strip: 0.12, tip: 4.36 });
  const vmfa232 = {
    id: 'vmfa-232-red-devils',
    label: 'VMFA-232 Red Devils, 2024',
    provenance: {
      kind: 'inspired',
      note: 'US Marine Corps VMFA-232 F/A-18C from the referenced 2024 photograph: tactical ghost grays, red fin tips and leading edges with the white modex 23 on the tips, the WT tail code and 23 on the nose in insignia gray, MARINES on the nacelles and low-visibility national insignia. The squadron’s devil emblem and stencils are omitted; the MARINES title placement follows standard Marine Hornet practice rather than this photograph.',
      references: [references.vmfa232],
    },
    paints: {
      ...twoTone(GULL_DARK, GULL_LIGHT),
      'fin-1': { color: GULL_DARK, zones: devilZones['fin-1'] },
      'fin--1': { color: GULL_DARK, zones: devilZones['fin--1'] },
    },
    markings: [
      ...both('fin-tip', 'tip-23'),
      ...both('fin-code', 'code-wt'),
      ...both('nose-modex', 'modex-23'),
      ...both('nacelle', 'marines'),
      ...both('insignia', 'insignia-lowvis'),
      ...navyWings,
    ],
  };

  /* 4. Finnish Air Force HN-442. */
  const finland = {
    id: 'finnish-hn-442',
    label: 'Finnish Air Force HN-442, 2025',
    provenance: {
      kind: 'inspired',
      note: 'Finnish Air Force F/A-18C HN-442 from the referenced 2025 photograph: two-tone gray, the small blue-and-white roundel and black HN-442 on the forward fuselage below the LEX, 42 at the fin tips, and roundels above and below both wings. The unit badge on the fin and stencils are omitted; wing roundel size is an approximation.',
      references: [references.finland],
    },
    paints: twoTone(GULL_DARK, GULL_LIGHT, '#8c9499'),
    markings: [
      ...both('roundel', 'finland-roundel'),
      ...both('registration', 'hn-442'),
      ...both('fin-tip', 'tip-42'),
      { anchor: 'wing-round-upper-left', graphic: 'finland-roundel-wing' },
      { anchor: 'wing-round-upper-right', graphic: 'finland-roundel-wing' },
      { anchor: 'wing-round-lower-left', graphic: 'finland-roundel-wing' },
      { anchor: 'wing-round-lower-right', graphic: 'finland-roundel-wing' },
    ],
  };

  /* 5. Swiss Air Force J-5004. */
  const swiss = {
    id: 'swiss-j-5004',
    label: 'Swiss Air Force J-5004',
    provenance: {
      kind: 'inspired',
      note: 'Swiss Air Force F/A-18C J-5004 from the referenced photograph: light gray overall, the red-and-white Swiss marking on the outer fins and above and below both wings, the black J-5004 serial low on the fins and 004 on the nose. Stencils are omitted; the wing marking size is an approximation.',
      references: [references.swiss],
    },
    paints: twoTone('#959da3', SWISS_GRAY, '#868e93'),
    markings: [
      ...both('fin-mark', 'swiss-fin'),
      ...both('fin-serial', 'j-5004'),
      ...both('nose-modex', 'modex-004'),
      { anchor: 'wing-round-upper-left', graphic: 'swiss-wing' },
      { anchor: 'wing-round-upper-right', graphic: 'swiss-wing' },
      { anchor: 'wing-round-lower-left', graphic: 'swiss-wing' },
      { anchor: 'wing-round-lower-right', graphic: 'swiss-wing' },
    ],
  };

  return {
    selected: dragons.id,
    anchors,
    graphics,
    variants: [dragons, angels, vmfa232, finland, swiss],
  };
}
