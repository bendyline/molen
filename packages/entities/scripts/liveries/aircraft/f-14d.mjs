/**
 * F-14D Tomcat liveries: US Navy squadron schemes with their national insignia, tail codes,
 * modex numbers and squadron art redrawn as original vector artwork (no reference pixels).
 *
 * The model is an F-14D; the Jolly Rogers flew the F-14A (VF-84) and F-14B (VF-103), so
 * those schemes are applied to the D airframe. Colors follow FED-STD-595 shades named in the
 * notes; markings are placed and sized from the referenced photographs.
 *
 * Model frame: +Z nose, +X the aircraft's left, +Y up. Each fin is a 9 cm slab canted out about
 * 5 degrees (outer face x = 1.404 + 0.0873 (y - 2.246) on the left fin); its leading edge runs
 * from (z -3.23, y 2.76) to (z -5.72, y 4.86) and the cap above the rudder tops out at y 4.89.
 * The rudder is one plane between the fin faces, from the hinge (z -4.76, y 2.45)-(z -6.30,
 * y 4.59) back to its trailing edge (z -6.06, y 2.42)-(z -6.73, y 4.59). Fin paint is
 * double-sided, so fin projectors stay shallower than the slab.
 */

// Paint slots: the existing airframe, nacelle, wing, flap, rudder and gear regions, plus the
// fins and stabilators (their own material, F14-upper). The intake ramps are no longer F14-upper
// (they take the duct's white interior paint under every scheme), so the nacelles' old
// F14-upper slots are dropped. The cockpit side consoles were airframe gray once; they are
// cockpit parts in their own finish now, and a livery never paints them.
export function slots(existing) {
  existing = Object.fromEntries(
    Object.entries(existing).filter(
      ([name]) => !/^upper-F14-nacelle-|^body-F14-(pilot|RIO)-console-/.test(name),
    ),
  );
  const extra = {};
  for (const side of ['1', '-1']) {
    extra[`fin-${side}`] = { materials: ['F14-upper'], node: `F14-fin-${side}-F14-upper` };
    extra[`stabilator-${side}`] = {
      materials: ['F14-upper'],
      node: `F14-stabilator-${side}-F14-upper`,
    };
  }
  return { ...existing, ...extra };
}

const GHOST_LIGHT = '#a9b0b6', // FS 36375 light ghost gray
  GHOST_DARK = '#8b939a', // FS 36320 dark ghost gray
  INSIGNIA_GRAY = '#6c747b',
  BLACK = '#16181b',
  WHITE = '#f2f1ec',
  YELLOW = '#f2c21b', // VF-103 fin cap and sash edges
  ORANGE = '#e8711e', // VF-2 fin cap
  NAVY_BLUE = '#1d2f6f',
  RED = '#b3242c',
  BONE = '#efe6cf';

/** The Jolly Rogers' skull and crossbones, an original drawing: bones behind, skull in front. */
function skullAndCrossbones(k, w, h, bone, shade) {
  const c = new k.Canvas(w, h);
  const cx = w / 2,
    s = Math.min(w, h);
  // Crossbones: two shafts with knuckle ends, crossing under the jaw.
  for (const angle of [0.62, -0.62]) {
    const len = s * 0.92,
      dx = Math.cos(angle) * len * 0.5,
      dy = Math.sin(angle) * len * 0.5,
      cy = h * 0.34;
    c.box(bone, cx, cy, len, s * 0.09, angle);
    for (const end of [-1, 1]) {
      const ex = cx + end * dx,
        ey = cy + end * dy;
      const nx = -Math.sin(angle) * s * 0.05,
        ny = Math.cos(angle) * s * 0.05;
      c.circle(bone, ex + nx, ey + ny, s * 0.06, 24);
      c.circle(bone, ex - nx, ey - ny, s * 0.06, 24);
    }
  }
  // Skull: cranium, cheekbones and jaw, then sockets, nose and teeth cut in the shade color.
  const top = h * 0.62;
  c.circle(bone, cx, top, s * 0.27, 48);
  c.add(bone, [
    [cx - s * 0.22, top - s * 0.06],
    [cx + s * 0.22, top - s * 0.06],
    [cx + s * 0.17, top - s * 0.28],
    [cx + s * 0.13, top - s * 0.37],
    [cx - s * 0.13, top - s * 0.37],
    [cx - s * 0.17, top - s * 0.28],
  ]);
  for (const side of [-1, 1]) {
    c.add(shade, [
      [cx + side * s * 0.03, top - s * 0.02],
      [cx + side * s * 0.19, top + s * 0.01],
      [cx + side * s * 0.2, top - s * 0.09],
      [cx + side * s * 0.13, top - s * 0.15],
      [cx + side * s * 0.05, top - s * 0.12],
    ]);
  }
  c.add(shade, [
    [cx, top - s * 0.14],
    [cx + s * 0.045, top - s * 0.22],
    [cx - s * 0.045, top - s * 0.22],
  ]);
  for (let i = -2; i <= 2; i++)
    c.rect(shade, cx + i * s * 0.045 - s * 0.006, top - s * 0.37, s * 0.012, s * 0.09);
  return c;
}

/** VF-2's skull (no crossbones), outlined in black: an original drawing filling the canvas. */
function outlinedSkull(k, w, h) {
  const c = new k.Canvas(w, h);
  const shape = (grow) => {
    const cx = w / 2,
      rx = w * 0.46 + grow,
      top = h * 0.66;
    const cranium = Array.from({ length: 33 }, (_, i) => {
      const a = (i * Math.PI) / 32;
      return [cx + Math.cos(a) * rx, top + Math.sin(a) * (h * 0.32 + grow)];
    });
    return [
      ...cranium.reverse(),
      [cx - rx, top],
      [cx - rx * 0.86, top - h * 0.22],
      [cx - rx * 0.62, top - h * 0.3],
      [cx - rx * 0.6, top - h * 0.52 - grow],
      [cx + rx * 0.6, top - h * 0.52 - grow],
      [cx + rx * 0.62, top - h * 0.3],
      [cx + rx * 0.86, top - h * 0.22],
      [cx + rx, top],
    ];
  };
  c.add(BLACK, shape(w * 0.045));
  c.add(BONE, shape(0));
  const cx = w / 2,
    top = h * 0.66;
  for (const side of [-1, 1])
    c.add(BLACK, [
      [cx + side * w * 0.05, top + h * 0.02],
      [cx + side * w * 0.36, top + h * 0.04],
      [cx + side * w * 0.34, top - h * 0.1],
      [cx + side * w * 0.12, top - h * 0.12],
    ]);
  c.add(BLACK, [
    [cx, top - h * 0.12],
    [cx + w * 0.07, top - h * 0.22],
    [cx - w * 0.07, top - h * 0.22],
  ]);
  c.rect(BLACK, cx - w * 0.3, top - h * 0.34, w * 0.6, h * 0.025);
  for (let i = -3; i <= 3; i++)
    c.rect(BLACK, cx + i * w * 0.085 - w * 0.012, top - h * 0.45, w * 0.024, h * 0.12);
  return c;
}

/**
 * A diagonal sash across the forward fuselage: stripes (outside in) running from the canvas's
 * top-left to bottom-right, with the national insignia at its lower end. On the left side the
 * canvas's left is forward, so the sash leans back as it falls; the right side flips it.
 */
function sash(k, w, h, stripes, insignia) {
  const c = new k.Canvas(w, h);
  const total = stripes.reduce((s, [, width]) => s + width, 0);
  // The sash centreline runs from (0.3w, h) to (0.7w, 0); stripes are offset along x.
  let offset = -total / 2;
  for (const [color, width] of stripes) {
    const a = offset,
      b = offset + width;
    c.add(color, [
      [w * 0.3 + a, h],
      [w * 0.3 + b, h],
      [w * 0.7 + b, 0],
      [w * 0.7 + a, 0],
    ]);
    offset = b;
  }
  if (insignia) k.usInsignia(c, w * 0.62, h * 0.22, h * 0.13, insignia);
  return c;
}

export default function design({ kit: k, space, slots: all }) {
  const SIDES = ['1', '-1'];
  const finX = (y) => 1.404 + (y - 2.246) * 0.0873;
  const rudderX = (y) => 1.373 + (y - 2.42) * 0.088;
  /** A projector on a fin's outer face, or on the rudder plane with the same box. */
  const finAnchor = (side, y, z, width, height, onRudder = false) => {
    const s = Number(side);
    return space.anchor(onRudder ? `body-F14-rudder-${side}-F14-gray` : `fin-${side}`, {
      center: [s * (onRudder ? rudderX(y) : finX(y)), y, z],
      facing: [s, -0.0873, 0],
      width,
      height,
      depth: 0.06,
    });
  };
  const anchors = {};
  for (const side of SIDES) {
    const s = Number(side);
    // Squadron art centred in the fin-and-rudder outline; the rudder twin carries its aft part.
    anchors[`fin-art-${side}`] = finAnchor(side, 3.5, -5.25, 1.3, 1.15);
    anchors[`rudder-art-${side}`] = finAnchor(side, 3.5, -5.25, 1.3, 1.15, true);
    anchors[`fin-code-${side}`] = finAnchor(side, 4.25, -5.65, 0.9, 0.34);
    // Modex just under the fin cap, clear of it (the cap starts at y 4.55).
    anchors[`fin-modex-${side}`] = finAnchor(side, 4.38, -5.93, 0.32, 0.16);
    // VF-2 band art, placed from the photograph (see the band lines below).
    anchors[`fin-ne-${side}`] = finAnchor(side, 3.29, -5.19, 1.04, 0.5);
    anchors[`rudder-ne-${side}`] = finAnchor(side, 3.29, -5.19, 1.04, 0.5, true);
    anchors[`fin-skull-${side}`] = finAnchor(side, 3.0, -4.43, 0.5, 0.74);
    anchors[`rudder-star-blue-${side}`] = finAnchor(side, 3.99, -6.28, 0.26, 0.26, true);
    anchors[`rudder-star-red-${side}`] = finAnchor(side, 2.82, -5.92, 0.24, 0.24, true);
    // National insignia on the intake trunk side, ahead of the glove.
    anchors[`insignia-${side}`] = space.anchor(`body-F14-nacelle-${side}-F14-gray`, {
      center: [s * 2.2, 1.85, 2.6],
      facing: [s, 0, 0],
      width: 1.6,
      height: 0.42,
      depth: 0.8,
    });
    anchors[`navy-${side}`] = space.anchor(`body-F14-nacelle-${side}-F14-gray`, {
      center: [s * 2.15, 1.45, -3.0],
      facing: [s, 0, 0],
      width: 1.3,
      height: 0.34,
      depth: 0.8,
    });
    anchors[`nose-modex-${side}`] = space.anchor('body-F14-airframe-F14-gray', {
      center: [s * 0.6, 2.3, 9.2],
      facing: [s, 0, 0],
      width: 0.9,
      height: 0.36,
      depth: 0.6,
    });
    // Squadron sash under the front cockpit.
    anchors[`nose-sash-${side}`] = space.anchor('body-F14-airframe-F14-gray', {
      center: [s * 0.66, 2.3, 8.6],
      facing: [s, 0, 0],
      width: 1.0,
      height: 0.95,
      depth: 0.4,
    });
  }
  // Wing insignia: upper left, lower right (Navy practice). At x 6.6-7.8 the upper skin is at
  // y 2.33-2.39 and the lower at 2.28-2.31; each box reaches one skin only.
  anchors['wing-upper'] = space.anchor('body-F14-wing-1-F14-gray', {
    center: [7.2, 2.365, -0.3],
    facing: [0, 1, 0],
    up: [0, 0, 1],
    width: 1.7,
    height: 0.6,
    depth: 0.07,
  });
  anchors['wing-lower'] = space.anchor('body-F14-wing--1-F14-gray', {
    center: [-7.2, 2.285, -0.3],
    facing: [0, -1, 0],
    up: [0, 0, 1],
    width: 1.7,
    height: 0.6,
    depth: 0.07,
  });

  const text = (label, w, h, color, opts = {}) =>
    new k.Canvas(w, h)
      .text(color, label, { x: w / 2, y: h / 2, height: h * 0.8, maxWidth: w * 0.96, ...opts })
      .graphic(label);
  const insignia = (style) =>
    k.usInsignia(new k.Canvas(1.6, 0.42), 0.8, 0.21, 0.19, style).graphic('US national insignia');
  const graphics = {
    'insignia-full': insignia({ style: 'full' }),
    'insignia-lowvis': insignia({ style: 'lowvis', color: INSIGNIA_GRAY }),
    'jolly-roger-white': skullAndCrossbones(k, 1.3, 1.15, WHITE, BLACK).graphic('Jolly Roger'),
    'jolly-roger-dark': skullAndCrossbones(k, 1.3, 1.15, '#3c4248', GHOST_LIGHT).graphic(
      'Jolly Roger (low visibility)',
    ),
    'navy-black': text('NAVY', 1.3, 0.34, BLACK),
    'navy-gray': text('NAVY', 1.3, 0.34, INSIGNIA_GRAY),
    'code-aj-gray': text('AJ', 0.9, 0.34, '#4f575e', { face: 'technical' }),
    'code-aj-black': text('AJ', 0.9, 0.34, '#2b2f33'),
    'modex-fin-03-white': text('03', 0.32, 0.16, WHITE),
    'modex-fin-00': new k.Canvas(0.32, 0.16)
      .text(BLACK, '00', { x: 0.165, y: 0.075, height: 0.13 })
      .text('#7c1f1f', '00', { x: 0.16, y: 0.08, height: 0.125 })
      .graphic('00'),
    'vf2-ne': new k.Canvas(1.04, 0.5)
      .text(BLACK, 'NE', { x: 0.52, y: 0.25, height: 0.42, slant: 0.28, maxWidth: 0.98 })
      .graphic('NE'),
    'vf2-skull': outlinedSkull(k, 0.5, 0.74).graphic('VF-2 skull'),
    'star-white': new k.Canvas(0.26, 0.26).star(WHITE, 0.13, 0.13, 0.125).graphic('White star'),
    'vf103-sash': sash(
      k,
      1.0,
      0.95,
      [
        [YELLOW, 0.035],
        [BLACK, 0.24],
        [YELLOW, 0.035],
      ],
      { style: 'full' },
    ).graphic('VF-103 nose sash'),
    'vf2-sash': sash(
      k,
      1.0,
      0.95,
      [
        [NAVY_BLUE, 0.1],
        [WHITE, 0.065],
        [RED, 0.1],
      ],
      { style: 'full' },
    ).graphic('VF-2 nose sash'),
  };
  for (const [n, color] of [
    ['103', BLACK],
    ['205', INSIGNIA_GRAY],
    ['100', BLACK],
    ['111', INSIGNIA_GRAY],
  ])
    graphics[`modex-${n}`] = text(n, 0.9, 0.36, color);

  // Every existing body region (fuselage, nacelles, wings, flaps, gear doors) takes the base.
  const wholeBody = (color) =>
    Object.fromEntries(
      Object.keys(all)
        .filter((name) => name.startsWith('body-'))
        .map((name) => [name, { color }]),
    );
  const rudder = (side) => `body-F14-rudder-${side}-F14-gray`;
  /** Fin and rudder paint on both sides; `zones(slot)` builds a slot's zones. */
  const tail = (color, zones) =>
    Object.fromEntries(
      SIDES.flatMap((side) =>
        [`fin-${side}`, rudder(side)].map((slot) => [
          slot,
          { color, ...(zones ? { zones: zones(slot) } : {}) },
        ]),
      ),
    );
  const cap = (color) => (slot) => [{ color, planes: [space.above(slot, 4.55)] }];
  // VF-2's band, measured on the photographed fin: stripe edges as side-view lines (z, y) that
  // fan out from the leading edge just above the root to the trailing edge, blue on top.
  const BAND = {
    blueTop: [
      [-5.9, 4.06],
      [-3.2, 2.74],
    ],
    blueWhite: [
      [-6.47, 3.8],
      [-3.2, 2.8],
    ],
    whiteRed: [
      [-6.27, 3.19],
      [-3.2, 2.76],
    ],
    bottom: [
      [-6.12, 2.62],
      [-3.2, 2.72],
    ],
  };
  const below = (slot, [a, b]) => space.sideLine(slot, a, b, -1);
  const bountyBand = (slot) => [
    { color: NAVY_BLUE, planes: [below(slot, BAND.blueTop)] },
    { color: WHITE, planes: [below(slot, BAND.blueWhite)] },
    { color: RED, planes: [below(slot, BAND.whiteRed)] },
    { color: GHOST_LIGHT, planes: [below(slot, BAND.bottom)] },
    { color: ORANGE, planes: [space.above(slot, 4.58)] },
  ];
  const both = (anchor, graphic, flipRight = false) => [
    { anchor: `${anchor}-1`, graphic },
    { anchor: `${anchor}--1`, graphic, ...(flipRight ? { flip: true } : {}) },
  ];
  const stabilators = (color) => ({
    'stabilator-1': { color },
    'stabilator--1': { color },
  });
  const references = {
    vf103: {
      title: 'F-14B of VF-103 Jolly Rogers over Pula, 2002 (US Navy, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:US_Navy_021029-N-1955P-116_A_U.S._Navy_F-14B_Tomcat_assigned_to_the_%22Jolly_Rogers%22_of_Fighter_Squadron_One_Zero_Three_(VF-103)_flies_over_the_Croat_coastline_near_Pula.jpg',
    },
    vf84: {
      title: 'F-14A of VF-84 Jolly Rogers in flight, 1986 (US Navy, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:F-14A_Tomcat_of_VF-84_in_flight_in_1986.jpg',
    },
    vf2: {
      title: 'F-14D of VF-2 Bounty Hunters in flight, 2002 (US Navy, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:F-14D_VF-2_Bounty_Hunters_in_flight_2002.JPG',
    },
    vf213: {
      title: 'F-14D of VF-213 Black Lions, 2003 (US Navy, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:US_Navy_030226-N-4965F-507_An_F-14D_%22Tomcat%22_assigned_to_the_%22Black_Lions%22_of_Fighter_Squadron_Two_One_Three_(VF-213).jpg',
    },
  };

  return {
    selected: 'vf-103-jolly-rogers',
    anchors,
    graphics,
    variants: [
      {
        id: 'vf-103-jolly-rogers',
        label: 'VF-103 Jolly Rogers, 2002',
        provenance: {
          kind: 'inspired',
          note: 'VF-103 F-14B scheme from the referenced US Navy photograph, applied to the F-14D model: FS 36375 light ghost gray airframe, gloss black fins and rudders with a yellow cap, the white skull and crossbones redrawn as original vector art and centred on fin and rudder, white 03 under the cap, the black sash with yellow edges across the forward fuselage carrying the full-color national insignia, NAVY titles and modex 103. The ship name on the fin, the VF-103 ventral titles and the striped tanks are omitted. Colors and marking sizes are approximations.',
          references: [references.vf103],
        },
        paints: {
          ...wholeBody(GHOST_LIGHT),
          ...tail(BLACK, cap(YELLOW)),
          ...stabilators(GHOST_LIGHT),
        },
        markings: [
          ...both('fin-art', 'jolly-roger-white'),
          ...both('rudder-art', 'jolly-roger-white'),
          ...both('fin-modex', 'modex-fin-03-white'),
          ...both('nose-sash', 'vf103-sash', true),
          ...both('navy', 'navy-black'),
          ...both('nose-modex', 'modex-103'),
          { anchor: 'wing-upper', graphic: 'insignia-lowvis' },
          { anchor: 'wing-lower', graphic: 'insignia-lowvis' },
        ],
      },
      {
        id: 'vf-84-jolly-rogers',
        label: 'VF-84 Jolly Rogers, 1986',
        provenance: {
          kind: 'inspired',
          note: 'VF-84 F-14A tactical paint scheme from the referenced 1986 US Navy photograph, applied to the F-14D model: FS 36320/36375 ghost grays, the skull and crossbones in dark low-visibility gray (original vector art) with the AJ tail code above it, modex 205, low-visibility national insignia and NAVY titles. The VF-84 lettering and the ship name are omitted. Approximate colors and sizes.',
          references: [references.vf84],
        },
        paints: {
          ...wholeBody(GHOST_DARK),
          ...tail(GHOST_LIGHT),
          ...stabilators(GHOST_DARK),
        },
        markings: [
          ...both('fin-art', 'jolly-roger-dark'),
          ...both('rudder-art', 'jolly-roger-dark'),
          ...both('fin-code', 'code-aj-gray'),
          ...both('insignia', 'insignia-lowvis'),
          ...both('navy', 'navy-gray'),
          ...both('nose-modex', 'modex-205'),
          { anchor: 'wing-upper', graphic: 'insignia-lowvis' },
          { anchor: 'wing-lower', graphic: 'insignia-lowvis' },
        ],
      },
      {
        id: 'vf-2-bounty-hunters',
        label: 'VF-2 Bounty Hunters CAG, 2002',
        provenance: {
          kind: 'inspired',
          note: "VF-2 F-14D commander's aircraft from the referenced 2002 US Navy photograph: ghost gray airframe, orange fin cap, and the band of blue, white and red that fans across fins and rudders from the leading-edge root to the trailing edge, with white stars in the blue and red, the black italic NE tail code and the squadron skull (original vector art) at its forward end; maroon 00 under the cap, the blue-white-red sash with the full-color national insignia under the front cockpit, modex 100 and NAVY titles. The orange ventral fins and the striped tanks are omitted. Approximate colors; band edges measured from the photograph.",
          references: [references.vf2],
        },
        paints: {
          ...wholeBody(GHOST_LIGHT),
          ...tail(GHOST_LIGHT, bountyBand),
          ...stabilators(GHOST_LIGHT),
        },
        markings: [
          ...both('fin-ne', 'vf2-ne'),
          ...both('rudder-ne', 'vf2-ne'),
          ...both('fin-skull', 'vf2-skull'),
          ...both('rudder-star-blue', 'star-white'),
          ...both('rudder-star-red', 'star-white'),
          ...both('fin-modex', 'modex-fin-00'),
          ...both('nose-sash', 'vf2-sash', true),
          ...both('navy', 'navy-black'),
          ...both('nose-modex', 'modex-100'),
          { anchor: 'wing-upper', graphic: 'insignia-full' },
          { anchor: 'wing-lower', graphic: 'insignia-full' },
        ],
      },
      {
        id: 'vf-213-black-lions',
        label: 'VF-213 Black Lions, 2003',
        provenance: {
          kind: 'inspired',
          note: "VF-213 F-14D tactical scheme from the referenced 2003 US Navy photograph: FS 36375 light ghost gray overall, AJ tail code in a darker gray, modex 111, low-visibility national insignia and NAVY titles. The squadron's lion emblem is omitted. Approximate colors.",
          references: [references.vf213],
        },
        paints: {
          ...wholeBody(GHOST_LIGHT),
          ...tail(GHOST_LIGHT),
          ...stabilators(GHOST_LIGHT),
        },
        markings: [
          ...both('fin-code', 'code-aj-black'),
          ...both('insignia', 'insignia-lowvis'),
          ...both('navy', 'navy-gray'),
          ...both('nose-modex', 'modex-111'),
          { anchor: 'wing-upper', graphic: 'insignia-lowvis' },
          { anchor: 'wing-lower', graphic: 'insignia-lowvis' },
        ],
      },
    ],
  };
}
