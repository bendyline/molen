/**
 * MiG-29A Fulcrum liveries: Soviet, Polish, German and Ukrainian air force schemes, with their
 * national insignia, bort numbers and serials redrawn as original vector artwork from the
 * referenced photographs (no reference pixels).
 *
 * Upper surfaces carry the scheme's camouflage; the light undersides are paint zones cut along
 * the mid-surface of each thin part (wing, slats, flaps, ailerons, stabilators) and, inboard of
 * the nacelle sides, along a plane under the leading-edge extensions that rises toward the nose.
 * The planes were fitted to the imported model by sampling both skins with rays. The model's paint
 * material is double sided, so markings on the fins and wings are projected with a depth less
 * than twice the skin thickness and do not reach the opposite face.
 */

// Paint slots: the existing airframe, control-surface, fin, gear-door and louver regions, plus
// the radome. The canopy frame and airbrake petals were cut from the airframe skin and are
// painted with it.
export function slots(existing) {
  return {
    ...existing,
    radome: { materials: ['MiG29-radome'], node: 'MiG29-airframe-MiG29-radome' },
  };
}

const AIRFRAME = 'body-MiG29-airframe-MiG29-gray-green';
// Mid-surface planes y = a + b|x| + c z, fitted to the imported model's skins. `body` divides
// the fuselage inboard of |x| = 1.68 m: under the LERX, over the nacelle sides, up the nose.
const MID = {
  wing: [2.1002, -0.0386, 0.0016],
  slat: [2.0954, -0.04, -0.0015],
  flap: [2.1026, -0.0398, 0.0018],
  aileron: [2.0967, -0.0378, 0.0019],
  stabilator: [2.0297, -0.0189, 0.001],
  body: [1.9517, 0.1694, 0.057],
};
const BODY_HALF_WIDTH = 1.68;
const SIDES = [
  ['left', 1],
  ['right', -1],
];

/** Soviet star: red, white border, thin red rim (pre-1991 Soviet Air Force pattern). */
function sovietStar(c, cx, cy, r) {
  c.star('#b8222c', cx, cy, r, r * 0.4);
  c.star('#f4f2ec', cx, cy, r * 0.88, r * 0.352);
  c.star('#c8232e', cx, cy, r * 0.74, r * 0.296);
  return c;
}

/**
 * Polish Air Force checkerboard (1993 pattern) as photographed on both sides: white top-left and
 * bottom-right, red top-right and bottom-left, each square edged in the opposite color along
 * the outside of the mark.
 */
function polishChecker(c, cx, cy, s) {
  const red = '#d4213d',
    white = '#f4f2ee',
    q = s / 2,
    e = s * 0.07,
    x0 = cx - q,
    y0 = cy - q;
  for (const [i, j, fill] of [
    [0, 1, white],
    [1, 1, red],
    [0, 0, red],
    [1, 0, white],
  ]) {
    const x = x0 + i * q,
      y = y0 + j * q;
    c.rect(fill === white ? red : white, x, y, q, q);
    // Inset away from the mark's outer edges only.
    const left = i === 0 ? e : 0,
      right = i === 1 ? e : 0,
      bottom = j === 0 ? e : 0,
      top = j === 1 ? e : 0;
    c.rect(fill, x + left, y + bottom, q - left - right, q - bottom - top);
  }
  return c;
}

/** Ukrainian fin emblem, an original drawing: gold-edged blue shield with a gold trident. */
function ukraineShield(k, w, h) {
  const c = new k.Canvas(w, h);
  const gold = '#f2c230',
    blue = '#1f57a8';
  // Flat top, straight sides, rounded base.
  const shield = (inset) => {
    const cx = w / 2,
      shoulder = h * 0.45,
      rx = w / 2 - inset,
      pts = [
        [inset, h - inset],
        [w - inset, h - inset],
        [w - inset, shoulder],
      ];
    for (let i = 1; i <= 12; i++) {
      const a = (i / 12) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * rx, shoulder - Math.sin(a) * (shoulder - inset)]);
    }
    for (let i = 11; i >= 0; i--) {
      const a = (i / 12) * (Math.PI / 2);
      pts.push([cx - Math.cos(a) * rx, shoulder - Math.sin(a) * (shoulder - inset)]);
    }
    return pts;
  };
  c.add(gold, shield(0));
  c.add(blue, shield(w * 0.07));
  // Trident: centre prong, two outer prongs curling in, a base bar joining them.
  const s = w * 0.5,
    cx = w / 2,
    base = h * 0.2,
    t = s * 0.09;
  c.add(gold, [
    [cx - t, base],
    [cx + t, base],
    [cx + t, base + s * 1.05],
    [cx, base + s * 1.32],
    [cx - t, base + s * 1.05],
  ]);
  for (const side of [-1, 1]) {
    const ox = cx + side * s * 0.62;
    c.add(gold, [
      [ox - t * 0.8, base + s * 0.12],
      [ox + t * 0.8, base + s * 0.12],
      [ox + t * 0.8, base + s * 1.18],
      [ox - side * t * 0.2, base + s * 1.3],
      [ox - t * 0.8, base + s * 1.08],
    ]);
    // Inner curl from the outer prong down to the centre stem.
    c.add(gold, [
      [ox, base + s * 0.52],
      [cx + side * t, base + s * 0.2],
      [cx + side * t, base + s * 0.36],
      [ox - side * t * 0.9, base + s * 0.68],
    ]);
  }
  c.rect(gold, cx - s * 0.7, base - t, s * 1.4, t * 2);
  return c;
}

export default function design({ kit: k, space, bounds }) {
  // ---------------------------------------------------------------- anchors (metres) ----
  const anchors = {};
  for (const [name, s] of SIDES) {
    // Bort numbers and serials on the intake trunk side, aft of the raked intake lip.
    anchors[`bort-${name}`] = space.anchor(AIRFRAME, {
      center: [s * 1.37, 1.72, 0.72],
      facing: [s, 0.07, 0.06],
      width: 1.05,
      height: 0.44,
      depth: 0.3,
    });
    anchors[`serial-${name}`] = space.anchor(AIRFRAME, {
      center: [s * 1.37, 1.7, 0.55],
      facing: [s, 0.07, 0.06],
      width: 1.5,
      height: 0.34,
      depth: 0.3,
    });
    // Outer fin faces (canted out 6 degrees, 0.11 m thick here).
    const fin = `body-MiG29-fin-${name}-MiG29-gray-green`;
    anchors[`fin-mid-${name}`] = space.anchor(fin, {
      center: [s * 1.866, 3.25, -5.42],
      facing: [s, -0.104, 0],
      width: 0.6,
      height: 0.6,
      depth: 0.1,
    });
    anchors[`fin-top-${name}`] = space.anchor(fin, {
      center: [s * 1.97, 4.25, -6.3],
      facing: [s, -0.104, 0],
      width: 0.5,
      height: 0.24,
      depth: 0.1,
    });
    // Wing insignia, upper and lower, on the fixed wing between slat and aileron.
    // The skins are 28-59 mm apart here: the projector follows each skin's local slope and
    // stays within 25 mm of it, short of the opposite skin.
    anchors[`wing-upper-${name}`] = space.anchor(AIRFRAME, {
      center: [s * 3.55, 1.984, -2.75],
      facing: [s * 0.044, 1, -0.027],
      up: [0, 0, 1],
      width: 0.72,
      height: 0.72,
      depth: 0.05,
    });
    anchors[`wing-lower-${name}`] = space.anchor(AIRFRAME, {
      center: [s * 3.55, 1.935, -2.75],
      facing: [-s * 0.035, -1, -0.017],
      up: [0, 0, 1],
      width: 0.72,
      height: 0.72,
      depth: 0.05,
    });
  }

  // ---------------------------------------------------------------- paint ----
  const extent = (slot) => {
    const b = bounds[slot];
    return Math.max(...b.max.map((v, i) => v - b.min[i]));
  };
  /** Upper-surface treatment: a plain color, or camouflage with patches `tile` metres apart. */
  const upperPaint = (slot, scheme) =>
    scheme.camouflage
      ? {
          color: scheme.camouflage[0],
          camouflage: {
            colors: scheme.camouflage,
            scale: Math.round((extent(slot) / scheme.tile) * 1000) / 1000,
            seed: scheme.seed,
            ...(scheme.style ? { style: scheme.style } : {}),
          },
        }
      : { color: scheme.upper };
  /** Below a mid-surface plane on one side (+1 left, -1 right), with optional extra planes. */
  const below = (slot, [a, b, c], s, extra = []) => [
    ...extra,
    space.plane(slot, [s * b, -1, c], [0, a, 0]),
  ];
  const lowerZones = (slot, color, mid, side) => [{ color, planes: below(slot, mid, side) }];
  /** The airframe: wing outboard of the nacelle sides, the body plane inboard. */
  const airframeZones = (slot, color) =>
    [1, -1].flatMap((s) => [
      {
        color,
        planes: below(slot, MID.wing, s, [
          space.plane(slot, [s, 0, 0], [s * BODY_HALF_WIDTH, 0, 0]),
        ]),
      },
      {
        color,
        planes: below(slot, MID.body, s, [
          space.plane(slot, [s, 0, 0], [0, 0, 0]),
          space.plane(slot, [-s, 0, 0], [s * BODY_HALF_WIDTH, 0, 0]),
        ]),
      },
    ]);
  function paints(scheme) {
    const out = {};
    const withZones = (slot, zones) => {
      const p = upperPaint(slot, scheme);
      return zones.length ? { ...p, zones } : p;
    };
    out[AIRFRAME] = withZones(AIRFRAME, [
      ...airframeZones(AIRFRAME, scheme.lower),
      ...(scheme.noseZones?.(AIRFRAME) ?? []),
      // Anti-glare panel on the nose top between the windscreen and the radome.
      ...(scheme.antiGlare
        ? [
            {
              color: scheme.antiGlare,
              planes: [
                space.ahead(AIRFRAME, 5.42),
                space.plane(AIRFRAME, [0, 1, 0.19], [0, 2.47, 5.2]),
              ],
            },
          ]
        : []),
    ]);
    for (const [name, s] of SIDES) {
      for (const part of ['slat', 'flap', 'aileron', 'stabilator']) {
        const slot = `body-MiG29-${part}-${name}-MiG29-gray-green`;
        out[slot] = withZones(slot, lowerZones(slot, scheme.lower, MID[part], s));
      }
      for (const part of ['fin', 'rudder']) {
        const slot = `body-MiG29-${part}-${name}-MiG29-gray-green`;
        out[slot] = upperPaint(slot, scheme);
      }
      out[`body-MiG29-intake-door-${name}-MiG29-gray-green`] = { color: scheme.lower };
      for (let i = 0; i < 5; i++)
        out[`body-MiG29-louver-${name}-${i}-MiG29-gray-green`] = {
          color: scheme.upper ?? scheme.camouflage[0],
        };
      out[`body-MiG29-gear-${name}-MiG29-gray-green`] = { color: scheme.lower };
    }
    out['body-MiG29-gear-nose-MiG29-gray-green'] = { color: scheme.lower };
    out.radome = { color: scheme.radome, roughness: 0.55 };
    return out;
  }

  // ---------------------------------------------------------------- artwork ----
  /** Lettering with an outline: the label in `outline`, offset round a ring, then the fill. */
  const outlined = (c, fill, outline, label, opts, w) => {
    if (outline)
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        c.text(outline, label, {
          ...opts,
          x: opts.x + Math.cos(a) * w,
          y: opts.y + Math.sin(a) * w,
        });
      }
    return c.text(fill, label, opts);
  };
  const number = (label, w, h, fill, outline, height = h * 0.8) =>
    outlined(
      new k.Canvas(w, h),
      fill,
      outline,
      label,
      { x: w / 2, y: h / 2, height, face: 'technical', maxWidth: w * 0.92 },
      height * 0.06,
    ).graphic(label);
  const checker = (s) =>
    polishChecker(new k.Canvas(s, s), s / 2, s / 2, s * 0.98).graphic('Polish checkerboard');
  const graphics = {
    'checker-fin': checker(0.6),
    'checker-wing': checker(0.72),
    'star-fin': sovietStar(new k.Canvas(0.6, 0.6), 0.3, 0.29, 0.3).graphic('Soviet red star'),
    'star-wing': sovietStar(new k.Canvas(0.72, 0.72), 0.36, 0.35, 0.36).graphic('Soviet red star'),
    'cross-wing': k.balkenkreuz(new k.Canvas(0.72, 0.72), 0.36, 0.36, 0.7).graphic('Balkenkreuz'),
    'ua-shield': ukraineShield(k, 0.6, 0.6).graphic('Ukrainian state emblem (simplified)'),
  };
  // Bort numbers sized on their intake projector (1.05 x 0.44 m).
  graphics['bort-105'] = number('105', 1.05, 0.44, '#c62530', null, 0.36);
  graphics['bort-89'] = number('89', 1.05, 0.44, '#c62530', null, 0.36);
  graphics['bort-05'] = number('05', 1.05, 0.44, '#f1f1ec', '#3a3f43', 0.38);
  graphics['fin-10'] = number('10', 0.5, 0.24, '#1d3f8c', null, 0.17);
  graphics['fin-05'] = number('05', 0.5, 0.24, '#f1f1ec', '#3a3f43', 0.19);
  // Luftwaffe serial 29+08: the "+" is a Balkenkreuz between the digit pairs.
  graphics['serial-29-08'] = (() => {
    const w = 1.5,
      h = 0.34,
      c = new k.Canvas(w, h),
      th = 0.24;
    c.text('#1b1d20', '29', { x: w / 2 - th * 0.82, y: h / 2, height: th, align: 'right' });
    k.balkenkreuz(c, w / 2, h / 2, th * 1.3);
    c.text('#1b1d20', '08', { x: w / 2 + th * 0.82, y: h / 2, height: th, align: 'left' });
    return c.graphic('29+08');
  })();
  graphics['flag-de'] = (() => {
    const c = new k.Canvas(0.5, 0.24),
      fw = 0.3,
      fh = 0.18,
      x = 0.1,
      y = 0.03;
    c.rect('#141414', x, y + (fh * 2) / 3, fw, fh / 3);
    c.rect('#d00f1c', x, y + fh / 3, fw, fh / 3);
    c.rect('#f5c400', x, y, fw, fh / 3);
    return c.graphic('German flag');
  })();

  const both = (anchor, graphic) =>
    SIDES.map(([name]) => ({ anchor: `${anchor}-${name}`, graphic }));
  const wings = (graphic) => [...both('wing-upper', graphic), ...both('wing-lower', graphic)];

  const references = {
    pl105: {
      title: 'MiG-29A 105 of the Polish Air Force at ILA Berlin 2016 (CC BY 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:105_Polish_Air_Force_MiG-29A_Fulcrum_ILA_Berlin_2016_01.jpg',
    },
    pl89: {
      title: 'MiG-29A 89 of 1.ELT, Polish Air Force, Mińsk Mazowiecki 2011 (CC0)',
      url: 'https://commons.wikimedia.org/wiki/File:89_Mig-29A_Fulcrum_1.elt_Poland,_Minsk-Mazowiecki_2011_IMG_7358_(50435607716).jpg',
    },
    lwPair: {
      title: 'Luftwaffe MiG-29G 29+06 and 29+08 with a USAF F-15C, 2003 (USAF, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:Two_German_Fuftwaffe_Mikoyan-Gurevitch_MiG-29G_in_flight_over_the_Gulf_of_Mexico_with_a_USAF_McDonnell_Douglas_F-15C_Eagle,_10_June_2003_(6645969).jpeg',
    },
    lw2914: {
      title: 'Luftwaffe MiG-29G 29+14, 1994 (CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Mikoyan-Gurevich_MiG-29G_(c-n_29605_25800,_29%2B14)_1994-05-31_Andre_Gerwing_Collection_ID_030799.jpg',
    },
    su10a: {
      title: 'MiG-29 "blue 10" at Farnborough, September 1988 (CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Mikoyan-Gurevich_MiG-29_%22blue_10%22_Russian_Air_Force,_Farnborough_UK,_September_1988._(5589824688).jpg',
    },
    su10b: {
      title: 'MiG-29 "blue 10" at Farnborough, September 1988, front quarter (CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Mikoyan-Gurevich_MiG-29_%22blue_10%22_Russian_Air_Force,_Farnborough_UK,_September_1988._(5589226135).jpg',
    },
    suTop: {
      title: 'Soviet MiG-29 upper surfaces with wing stars (US DoD, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:MiG-29_fuselage.jpg',
    },
    ua05: {
      title: 'Ukrainian Air Force MiG-29 05 at Clear Sky 2018 (public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:181009-Z-VM449-513_(cropped).jpg',
    },
    ua90: {
      title: 'Ukrainian Air Force MiG-29 landing at Clear Sky 2018 (public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:CLEAR_SKY_2018_(4805844).jpg',
    },
  };

  const schemes = {
    pl105: {
      upper: '#515b67',
      lower: '#bcc1c5',
      radome: '#c3c6c4',
      antiGlare: '#24282c',
      // The light sides climb to the canopy sill on the nose.
      noseZones: (slot) => [
        {
          color: '#bcc1c5',
          planes: [
            space.ahead(slot, 2.7),
            space.below(slot, 2.5),
            space.plane(slot, [-1, 0, 0], [0.62, 0, 0]),
            space.plane(slot, [1, 0, 0], [-0.62, 0, 0]),
          ],
        },
      ],
    },
    pl89: {
      camouflage: ['#a3abae', '#78848a', '#56625e'],
      tile: 7,
      seed: 89,
      lower: '#b6bdbf',
      radome: '#6d7573',
      antiGlare: '#2d3235',
    },
    lw: {
      camouflage: ['#b4b9bc', '#8e969a'],
      tile: 8,
      seed: 2908,
      lower: '#a2a9ad',
      radome: '#4a5054',
    },
    su: {
      camouflage: ['#b7bfc3', '#7c8993'],
      tile: 7,
      seed: 1988,
      lower: '#c2cacd',
      radome: '#3b4146',
      antiGlare: '#3b4146',
    },
    ua: {
      camouflage: ['#d2d5d3', '#9a9fa1', '#5c6165'],
      tile: 4.5,
      seed: 2018,
      style: 'digital',
      lower: '#8d9396',
      radome: '#7b8184',
      antiGlare: '#3e4347',
    },
  };

  return {
    selected: 'polish-105-1-elt',
    anchors,
    graphics,
    variants: [
      {
        id: 'polish-105-1-elt',
        label: 'Polish Air Force 105, 1.ELT, 2016',
        provenance: {
          kind: 'inspired',
          note: 'Polish Air Force MiG-29A 105 from the referenced ILA 2016 photograph: dark blue-gray upper surfaces and fins, light gray undersides climbing to the canopy sill on the nose, light gray radome, red bort number 105 on the intakes and the red-and-white checkerboard on the outer fins and both wing surfaces (original vector art). The portrait on the inner fin and all stencils are omitted; colors and the color boundary are approximations.',
          references: [references.pl105],
        },
        paints: paints(schemes.pl105),
        markings: [
          ...both('bort', 'bort-105'),
          ...both('fin-mid', 'checker-fin'),
          ...wings('checker-wing'),
        ],
      },
      {
        id: 'polish-89-camouflage',
        label: 'Polish Air Force 89, 1.ELT, 2011',
        provenance: {
          kind: 'inspired',
          note: 'Polish Air Force MiG-29A 89 of 1.ELT from the referenced 2011 photograph: three-gray disruptive camouflage on the upper surfaces and fins (procedural patches standing in for the painted pattern), light gray undersides, gray radome, red 89 on the intakes and checkerboards on the outer fins and wings (original vector art). Stencils omitted; colors approximate.',
          references: [references.pl89],
        },
        paints: paints(schemes.pl89),
        markings: [
          ...both('bort', 'bort-89'),
          ...both('fin-mid', 'checker-fin'),
          ...wings('checker-wing'),
        ],
      },
      {
        id: 'luftwaffe-jg73-29-08',
        label: 'Luftwaffe JG 73 29+08, 2003',
        provenance: {
          kind: 'inspired',
          note: 'Luftwaffe MiG-29G 29+08 of Jagdgeschwader 73 from the referenced 2003 photograph: two-tone light gray upper camouflage (procedural patches), medium gray undersides and intakes, dark radome, the serial 29+08 with its Balkenkreuz on the intakes, small German flags high on the outer fins and crosses on both wing surfaces (original vector art). The JG 73 badge on the fins and the stencils are omitted; colors approximate.',
          references: [references.lwPair, references.lw2914],
        },
        paints: paints(schemes.lw),
        markings: [
          ...both('serial', 'serial-29-08'),
          ...both('fin-top', 'flag-de'),
          ...wings('cross-wing'),
        ],
      },
      {
        id: 'soviet-blue-10-1988',
        label: 'Soviet Air Force blue 10, Farnborough 1988',
        provenance: {
          kind: 'inspired',
          note: 'The Soviet MiG-29 "blue 10" shown at Farnborough in 1988, from the referenced photographs: light gray and blue-gray upper camouflage (procedural patches), light undersides, dark radome, red stars with white and red borders on the outer fins and both wing surfaces, and the small blue 10 high on the fins (original vector art). Stencils omitted; colors and patch layout approximate.',
          references: [references.su10a, references.su10b, references.suTop],
        },
        paints: paints(schemes.su),
        markings: [
          ...both('fin-mid', 'star-fin'),
          ...both('fin-top', 'fin-10'),
          ...wings('star-wing'),
        ],
      },
      {
        id: 'ukraine-05-digital',
        label: 'Ukrainian Air Force 05, digital camouflage, 2018',
        provenance: {
          kind: 'inspired',
          note: 'Ukrainian Air Force MiG-29 05 from the referenced Clear Sky 2018 photographs, applied to the MiG-29A model: three-tone gray digital (pixel) camouflage on the upper surfaces and fins, medium gray undersides, white outlined 05 on the intakes and fin tops, and the blue shield with the gold trident on the outer fins (original vector drawing, simplified). Wing markings are not shown in the photographs and are omitted, as are stencils; the pixel pattern is procedural and colors are approximate.',
          references: [references.ua05, references.ua90],
        },
        paints: paints(schemes.ua),
        markings: [
          ...both('bort', 'bort-05'),
          ...both('fin-top', 'fin-05'),
          ...both('fin-mid', 'ua-shield'),
        ],
      },
    ],
  };
}
