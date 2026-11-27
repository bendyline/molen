/**
 * F-15C Eagle liveries: USAF wing and squadron schemes, a 65th Aggressor Squadron jet and an
 * Israeli Air Force Baz, each studied from the referenced photographs. National insignia, tail
 * codes, serials, squadron art and heritage markings are redrawn as original vector artwork (no
 * reference pixels). Colors follow the FED-STD-595 shades named in the notes.
 *
 * Model frame: +Z nose, +X the aircraft's left, +Y up. The fins are vertical slabs with their
 * outer faces at x = ±1.79; fin-face art is drawn in a "fin canvas" whose x runs aft from
 * z = FIN_FRONT, flipped on the right fin so it lands on the same fin geometry on both sides.
 */

// Paint slots, one per airframe part, plus the fin tip caps, which the shipped slots left out.
// The airframe slot also reaches the canopy sill and spine speed brake (cut from its skin).
export function slots() {
  const gray = (node) => ({ materials: ['F15-gray'], node });
  const out = {
    airframe: gray('F15-airframe-F15-gray'),
    radome: { materials: ['F15-radome'], node: 'F15-airframe-F15-radome' },
    wing: { materials: ['F15-upper'], node: 'F15-airframe-F15-upper' },
    'gear-nose': gray('F15-gear-nose-F15-gray'),
  };
  for (const side of ['1', '-1']) {
    out[`boom-${side}`] = gray(`F15-engine-${side}-F15-gray`);
    out[`flap-in-${side}`] = gray(`F15-flap-${side}-0-F15-gray`);
    out[`flap-out-${side}`] = gray(`F15-flap-${side}-1-F15-gray`);
    out[`aileron-${side}`] = gray(`F15-aileron-${side}-2-F15-gray`);
    out[`stabilator-${side}`] = gray(`F15-stabilator-${side}-F15-gray`);
    out[`rudder-${side}`] = gray(`F15-rudder-${side}-F15-gray`);
    out[`fin-${side}`] = { materials: ['F15-upper'], node: `F15-fin-${side}-F15-upper` };
    out[`fincap-${side}`] = { materials: ['F15-seals'], node: `F15-fin-${side}-F15-seals` };
  }
  out['gear-left'] = gray('F15-gear-left-F15-gray');
  out['gear-right'] = gray('F15-gear-right-F15-gray');
  return out;
}

const SIDES = ['1', '-1'];
const FIN_X = 1.8, // outer fin face
  FIN_FRONT = -3.35; // fin canvas x = FIN_FRONT - z (metres aft)
const FIN_W = 3.6,
  FIN_BASE = 2.35,
  FIN_H = 3.3;

/* Colors (approximate FED-STD-595 shades as they read in daylight photographs). */
const MOD_LIGHT = '#9ea7ad', // FS 36251 aggressor gray
  MOD_DARK = '#76828b', // FS 36176 dark gray
  CODE_GRAY = '#4b5359', // FS 36118 gunship gray
  RADOME = '#7f878c',
  BLACK = '#17191b',
  WHITE = '#f2f2ee',
  RED = '#c3242b',
  YELLOW = '#f0c21b',
  HERITAGE_BLUE = '#2f8fd8',
  LIBERTY_GREEN = '#3fa37a',
  AGR_DARK = '#2c4575',
  AGR_MID = '#5d79a3',
  AGR_LIGHT = '#aeb8c2',
  IAF_GRAY = '#aab1b6',
  IAF_BLUE = '#1f4fa0';

/** Lettering with a hard outline: the label stamped at four offsets, then the fill on top. */
function outlinedText(c, fill, outline, label, opts, stroke) {
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    c.text(outline, label, {
      ...opts,
      x: opts.x + Math.cos(a) * stroke,
      y: opts.y + Math.sin(a) * stroke,
    });
  }
  return c.text(fill, label, opts);
}

/** USAF fin serial: "AF" over the fiscal year, small, then the last digits large. */
function usafSerial(k, year, number, color) {
  const w = 1.1,
    h = 0.34,
    c = new k.Canvas(w, h);
  // Lettering is placed by its vertical centre.
  c.text(color, 'AF', { x: 0.14, y: h * 0.75, height: h * 0.36, face: 'technical' });
  c.text(color, year, { x: 0.14, y: h * 0.25, height: h * 0.36, face: 'technical' });
  c.text(color, number, {
    x: 0.3,
    y: h * 0.5,
    height: h * 0.88,
    align: 'left',
    maxWidth: w - 0.32,
    face: 'technical',
  });
  return c.graphic(`AF ${year} ${number}`);
}

/** The Mod Eagle fin patch behind the code, as on the referenced Kadena jet (fin canvas). */
function modEagleFinPatch(k) {
  const c = new k.Canvas(FIN_W, FIN_H);
  // Fin canvas: x metres aft of z = -3.35, y metres above y = 2.35.
  const at = (z, y) => [FIN_FRONT - z, y - FIN_BASE];
  c.add(MOD_DARK, [
    at(-5.2, 5.33),
    at(-5.62, 5.33),
    at(-5.82, 5.0),
    at(-5.98, 4.55),
    at(-6.25, 4.2),
    at(-6.0, 3.55),
    at(-5.62, 3.1),
    at(-5.25, 2.6),
    at(-4.5, 2.6),
    at(-4.55, 3.05),
    at(-4.9, 3.6),
    at(-4.82, 4.15),
    at(-5.0, 4.6),
    at(-4.96, 5.0),
  ]);
  return c.graphic('Mod Eagle fin patch');
}

/** The 48th Fighter Wing's Statue of Liberty: an original simplified silhouette (fin canvas). */
function libertyFigure(k, color) {
  const w = 0.62,
    h = 1.2,
    c = new k.Canvas(w, h);
  const cx = 0.3;
  // Robe and pedestal.
  c.add(color, [
    [cx - 0.16, 0.0],
    [cx + 0.16, 0.0],
    [cx + 0.13, 0.12],
    [cx + 0.1, 0.55],
    [cx + 0.12, 0.72],
    [cx + 0.06, 0.8],
    [cx - 0.08, 0.8],
    [cx - 0.12, 0.66],
    [cx - 0.11, 0.42],
    [cx - 0.13, 0.12],
  ]);
  // Tablet held at the left side.
  c.box(color, cx - 0.15, 0.56, 0.08, 0.16, -0.25);
  // Head and the seven-rayed crown.
  c.circle(color, cx - 0.01, 0.86, 0.055, 20);
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.12 + (0.76 * i) / 6);
    c.box(color, cx - 0.01 + Math.cos(a) * 0.08, 0.88 + Math.sin(a) * 0.08, 0.06, 0.014, a);
  }
  // Raised arm and torch.
  c.add(color, [
    [cx + 0.03, 0.74],
    [cx + 0.1, 0.74],
    [cx + 0.15, 1.04],
    [cx + 0.1, 1.05],
  ]);
  c.rect(color, cx + 0.09, 1.04, 0.07, 0.04);
  c.add(color, [
    [cx + 0.085, 1.08],
    [cx + 0.165, 1.08],
    [cx + 0.15, 1.15],
    [cx + 0.125, 1.2],
    [cx + 0.1, 1.15],
  ]);
  return c.graphic('Statue of Liberty');
}

/**
 * A diving eagle, wings swept up and back, head and talons reaching forward (+x): an original
 * silhouette for the Israeli squadron fin badge.
 */
function eagle(k, color, eye) {
  const c = new k.Canvas(1, 1);
  // Near wing: leading edge up to the tip, then the primary feathers back down to the body.
  c.add(color, [
    [0.56, 0.5],
    [0.42, 0.7],
    [0.27, 0.88],
    [0.14, 0.99],
    [0.1, 0.92],
    [0.19, 0.84],
    [0.08, 0.84],
    [0.18, 0.76],
    [0.08, 0.74],
    [0.2, 0.67],
    [0.12, 0.63],
    [0.25, 0.58],
    [0.2, 0.52],
    [0.36, 0.46],
  ]);
  // Far wing, raised ahead of the near one.
  c.add(color, [
    [0.6, 0.5],
    [0.6, 0.7],
    [0.63, 0.86],
    [0.68, 0.95],
    [0.69, 0.86],
    [0.73, 0.88],
    [0.71, 0.79],
    [0.76, 0.79],
    [0.71, 0.7],
    [0.75, 0.67],
    [0.69, 0.6],
    [0.68, 0.5],
  ]);
  // Body from the fanned tail to the hooked beak.
  c.add(color, [
    [0.02, 0.2],
    [0.06, 0.3],
    [0.2, 0.36],
    [0.38, 0.45],
    [0.56, 0.5],
    [0.7, 0.49],
    [0.78, 0.47],
    [0.84, 0.44],
    [0.93, 0.38],
    [0.9, 0.33],
    [0.88, 0.36],
    [0.8, 0.36],
    [0.7, 0.36],
    [0.58, 0.32],
    [0.4, 0.27],
    [0.22, 0.2],
    [0.08, 0.1],
  ]);
  // Legs reaching forward with spread talons.
  for (const [x, y] of [
    [0.5, 0.29],
    [0.58, 0.32],
  ]) {
    c.add(color, [
      [x, y],
      [x + 0.05, y + 0.01],
      [x + 0.2, y - 0.13],
      [x + 0.16, y - 0.15],
    ]);
    for (const a of [-0.2, -0.9, -1.6])
      c.box(color, x + 0.18 + Math.cos(a) * 0.035, y - 0.14 + Math.sin(a) * 0.035, 0.07, 0.016, a);
  }
  c.circle(eye, 0.82, 0.42, 0.013, 10);
  return c.graphic('Eagle squadron badge');
}

export default function design({ kit: k, space, bounds }) {
  const anchors = {};
  const sign = (side) => Number(side);
  for (const side of SIDES) {
    const s = sign(side);
    const fin = `fin-${side}`;
    const onFin = (y, z, width, height) =>
      space.anchor(fin, {
        center: [s * FIN_X, y, z],
        facing: [s, 0, 0],
        width,
        height,
        depth: 0.3,
      });
    // The whole outer fin face, for fin-geometry art (fin canvas, flipped on the right).
    anchors[`fin-face-${side}`] = onFin(FIN_BASE + FIN_H / 2, FIN_FRONT - FIN_W / 2, FIN_W, FIN_H);
    anchors[`fin-code-${side}`] = onFin(4.32, -5.55, 1.3, 0.6);
    anchors[`fin-serial-${side}`] = onFin(3.72, -5.0, 1.1, 0.34);
    anchors[`fin-tip-${side}`] = onFin(5.47, -6.03, 1.34, 0.2);
    anchors[`fin-art-${side}`] = onFin(4.25, -5.55, 0.95, 0.95);
    anchors[`fin-number-${side}`] = onFin(3.65, -5.15, 0.9, 0.36);
    anchors[`fin-star-${side}`] = onFin(5.05, -5.55, 0.24, 0.24);
    // Intake trunk side, ahead of the wing glove.
    anchors[`insignia-${side}`] = space.anchor('airframe', {
      center: [s * 1.95, 2.25, 2.75],
      facing: [s, 0, 0],
      width: 1.25,
      height: 0.682,
      depth: 0.5,
    });
    anchors[`roundel-${side}`] = space.anchor('airframe', {
      center: [s * 1.62, 2.22, 3.95],
      facing: [s, 0, 0],
      width: 0.72,
      height: 0.72,
      depth: 0.5,
    });
    anchors[`intake-number-${side}`] = space.anchor('airframe', {
      center: [s * 2.02, 2.22, 0.75],
      facing: [s, 0, 0],
      width: 0.95,
      height: 0.5,
      depth: 0.4,
    });
    anchors[`nose-number-${side}`] = space.anchor('airframe', {
      center: [s * 0.64, 2.3, 7.95],
      facing: [s, 0, 0],
      width: 0.5,
      height: 0.18,
      depth: 0.4,
    });
    anchors[`nose-checks-${side}`] = space.anchor('airframe', {
      center: [s * 0.62, 2.22, 9.0],
      facing: [s, 0, 0],
      width: 0.8,
      height: 0.88,
      depth: 0.5,
    });
  }
  anchors['nose-checks-top'] = space.anchor('airframe', {
    center: [0, 2.85, 9.0],
    facing: [0, 1, 0],
    up: [0, 0, 1],
    width: 0.84,
    height: 0.8,
    depth: 0.4,
  });
  anchors['nose-checks-bottom'] = space.anchor('airframe', {
    center: [0, 1.6, 9.0],
    facing: [0, -1, 0],
    up: [0, 0, 1],
    width: 0.84,
    height: 0.8,
    depth: 0.4,
  });
  // Wing insignia, on the upper skin of one wing and the lower skin of the other.
  const wingMark = (x, up, width, height) =>
    space.anchor('wing', {
      center: [x, up ? 2.68 : 2.5, -0.9],
      facing: [0, up ? 1 : -1, 0],
      up: [0, 0, 1],
      width,
      height,
      depth: 0.16,
    });
  anchors['wing-upper-left'] = wingMark(4.1, true, 1.3, 0.709);
  anchors['wing-lower-right'] = wingMark(-4.1, false, 1.3, 0.709);
  anchors['wing-roundel-upper-right'] = wingMark(-4.1, true, 0.95, 0.95);
  anchors['wing-roundel-lower-left'] = wingMark(4.1, false, 0.95, 0.95);
  anchors['wing-roundel-upper-left'] = wingMark(4.1, true, 0.95, 0.95);
  anchors['wing-roundel-lower-right'] = wingMark(-4.1, false, 0.95, 0.95);
  for (const side of SIDES) {
    const s = sign(side);
    // JASDF: the large nose number under the windscreen and the long fin serial.
    anchors[`nose-big-${side}`] = space.anchor('airframe', {
      center: [s * 0.66, 2.42, 7.05],
      facing: [s, 0, 0],
      width: 0.95,
      height: 0.36,
      depth: 0.4,
    });
    anchors[`fin-serial-wide-${side}`] = space.anchor(`fin-${side}`, {
      center: [s * FIN_X, 3.62, -4.98],
      facing: [s, 0, 0],
      width: 1.45,
      height: 0.3,
      depth: 0.3,
    });
  }

  /* Graphics. */
  const text = (label, w, h, color, opts = {}) =>
    new k.Canvas(w, h)
      .text(color, label, { x: w / 2, y: h / 2, height: h * 0.8, maxWidth: w * 0.96, ...opts })
      .graphic(label);
  const outlined = (label, w, h, fill, outline, opts = {}) =>
    outlinedText(
      new k.Canvas(w, h),
      fill,
      outline,
      label,
      { x: w / 2, y: h / 2, height: h * 0.74, maxWidth: w * 0.9, ...opts },
      h * 0.045,
    ).graphic(label);
  const insignia = (w, opts) => {
    const r = w / 4.4;
    return k
      .usInsignia(new k.Canvas(w, r * 2.4), w / 2, r * 1.2, r, opts)
      .graphic('US national insignia');
  };
  const graphics = {
    'insignia-lowvis': insignia(1.25, { style: 'lowvis', color: CODE_GRAY }),
    'insignia-lowvis-wing': insignia(1.3, { style: 'lowvis', color: CODE_GRAY }),
    'code-zz': text('ZZ', 1.3, 0.6, '#c6ccd0', { face: 'technical' }),
    'serial-85-115': usafSerial(k, '85', '115', '#c6ccd0'),
    'mod-eagle-patch': modEagleFinPatch(k),
    'code-ln': text('LN', 1.3, 0.6, BLACK, { face: 'technical' }),
    'serial-86-156': usafSerial(k, '86', '156', BLACK),
    liberty: libertyFigure(k, LIBERTY_GREEN),
    'code-wa': outlined('WA', 1.3, 0.6, WHITE, '#111c33', { face: 'technical' }),
    'aggressor-checks': k
      .checks(new k.Canvas(1.34, 0.2), 0, 0, 1.34, 0.2, [YELLOW, BLACK], 14, 2)
      .graphic('Yellow and black checks'),
    'agr-number-94': outlined('94', 0.95, 0.5, WHITE, '#1a2a4c', { face: 'technical' }),
    'nose-494': text('494', 0.5, 0.18, CODE_GRAY),
    'iaf-roundel': k
      .israelMark(new k.Canvas(0.7, 0.7), 0.35, 0.35, 0.34)
      .graphic('Israeli roundel'),
    'iaf-roundel-wing': k
      .israelMark(new k.Canvas(0.7, 0.7), 0.35, 0.35, 0.34)
      .graphic('Israeli roundel (wing)'),
    'iaf-eagle': eagle(k, BLACK, IAF_GRAY),
    'iaf-818-fin': text('818', 0.9, 0.36, BLACK, { face: 'technical' }),
    'iaf-818-nose': text('818', 0.5, 0.18, IAF_BLUE, { face: 'technical' }),
    'red-star': new k.Canvas(0.24, 0.24)
      .star(BLACK, 0.125, 0.115, 0.115)
      .star(RED, 0.115, 0.125, 0.1)
      .graphic('Red star'),
  };
  // Nose checkerboard (48th FW heritage): red squares on the white band, one set per side.
  const checks = (w, h, n, label) => {
    const c = new k.Canvas(w, h),
      size = w / n;
    for (let j = 0; j * size < h; j++)
      for (let i = 0; i < n; i++)
        if ((i + j) % 2 === 0) c.rect(RED, i * size, j * size, size, size);
    return c.graphic(label);
  };
  graphics['nose-checks-side'] = checks(0.8, 0.88, 6, 'Red and white nose checks');
  graphics['nose-checks-top'] = checks(0.84, 0.8, 6, 'Red and white nose checks (top)');
  // Fin art placed on the fin face canvas (aft-running x, flipped on the right fin).
  graphics['liberty-fin'] = (() => {
    const c = new k.Canvas(FIN_W, FIN_H);
    const fig = graphics.liberty;
    // Re-draw the statue in fin canvas metres above the code, toward the leading edge:
    // base at y 4.66, 0.78 m tall, centred on z -5.6.
    const sy = 0.78,
      sx = sy * (0.62 / 1.2),
      x0 = FIN_FRONT - -5.6 - sx / 2,
      y0 = 4.66 - FIN_BASE;
    for (const shape of fig.shapes)
      c.add(
        shape.color,
        shape.points.map(([u, v]) => [x0 + (1 - u) * sx, y0 + v * sy]),
      );
    return c.graphic('Statue of Liberty (fin)');
  })();

  /* Paint helpers. */
  const camo = (slot, colors, tile, seed, style) => {
    const b = bounds[slot];
    const longest = Math.max(...b.max.map((v, i) => v - b.min[i]));
    return {
      colors,
      scale: Math.round((longest / tile) * 1000) / 1000 || 0.05,
      seed,
      ...(style ? { style } : {}),
    };
  };
  const bodySlots = [
    'airframe',
    'wing',
    'gear-nose',
    'gear-left',
    'gear-right',
    ...SIDES.flatMap((s) => [
      `boom-${s}`,
      `flap-in-${s}`,
      `flap-out-${s}`,
      `aileron-${s}`,
      `stabilator-${s}`,
      `rudder-${s}`,
      `fin-${s}`,
      `fincap-${s}`,
    ]),
  ];
  const plainSlots = new Set(['gear-nose', 'gear-left', 'gear-right', 'fincap-1', 'fincap--1']);
  /** Every airframe slot in `color`, optionally camouflaged (gear legs, fin caps plain). */
  const overall = (color, pattern) =>
    Object.fromEntries(
      bodySlots.map((slot) => [
        slot,
        {
          color,
          ...(pattern && !plainSlots.has(slot) ? { camouflage: pattern(slot) } : {}),
        },
      ]),
    );
  const both = (anchor, graphic, extra = {}) =>
    SIDES.map((side) => ({ anchor: `${anchor}-${side}`, graphic, ...extra }));
  /** Fin-canvas art: mirrored on the right fin so it sits on the same fin geometry. */
  const finArt = (graphic) => [
    { anchor: 'fin-face-1', graphic },
    { anchor: 'fin-face--1', graphic, flip: true },
  ];
  const finZones = (side, zones) => zones(`fin-${side}`);

  const references = {
    kadena: {
      title: 'F-15C 85-0115 of the 67th Fighter Squadron, Kadena, 2008 (USAF, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:F-15C_67th_Fighter_Squadron_2008.jpg',
    },
    kadena2: {
      title: 'F-15C 83-0039 ZZ of the 18th Wing on display (GFDL)',
      url: 'https://commons.wikimedia.org/wiki/File:83-0039-ZZ_McDonnell_Douglas_F-15C_Eagle_USAF_(9536493920).jpg',
    },
    heritage1: {
      title:
        '493rd Fighter Squadron heritage F-15C Eagle, Lakenheath, April 2019 (USAF, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:493rd_Fighter_Squadron_Heritage_F-15C_Eagle_(5253577).jpg',
    },
    heritage2: {
      title: '493rd Grim Reapers heritage F-15C from above (USAF, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:493rd_Grim_Reapers_Heritage_F-15C_(5260166).jpg',
    },
    agrs: {
      title: 'F-15C of the 65th Aggressor Squadron, Nellis (Tomás Del Coro, CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:F-15C_65th_Aggressor_Squadron_(8189062831).jpg',
    },
    jasdf: {
      title: 'Mitsubishi F-15J Eagle 72-8880 of the JASDF (CC BY-SA 3.0)',
      url: 'https://commons.wikimedia.org/wiki/File:McDonnell_Douglas_(Mitsubishi)_F-15J_Eagle,_Japan_-_Air_Force_AN2322615.jpg',
    },
    iaf: {
      title:
        'Israeli Air Force F-15C Baz 818 of 106 Squadron at RAF Waddington, 2019 (CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:McDonnell_Douglas_F-15C-28-MC_Eagle_(Baz)_%E2%80%98818%E2%80%99_(48644505872).jpg',
    },
  };

  const modEagle = (slot) => camo(slot, [MOD_LIGHT, MOD_LIGHT, MOD_DARK], 7, 41);
  const usafWings = [
    { anchor: 'wing-upper-left', graphic: 'insignia-lowvis-wing' },
    { anchor: 'wing-lower-right', graphic: 'insignia-lowvis-wing' },
  ];

  /* 1. 18th Wing, 67th Fighter Squadron, Kadena. */
  const kadena = {
    id: 'zz-67fs-kadena',
    label: '67th FS Fighting Cocks, Kadena, 2008',
    provenance: {
      kind: 'inspired',
      note: 'F-15C 85-0115 of the 18th Wing’s 67th Fighter Squadron from the referenced 2008 USAF photograph: Mod Eagle camouflage of FS 36251 with FS 36176 patches (procedural on the airframe, the photographed patch drawn on the fins), the light ZZ code and AF 85 115 serial on the fin patch, the squadron’s red fin-tip band, and low-visibility national insignia on the intakes and wings. The wing badge, crew names and small stencils are omitted; camouflage boundaries and colors are approximations.',
      references: [references.kadena, references.kadena2],
    },
    paints: {
      ...overall(MOD_LIGHT, modEagle),
      ...Object.fromEntries(
        SIDES.map((side) => [
          `fin-${side}`,
          {
            color: MOD_LIGHT,
            zones: finZones(side, (fin) => [{ color: RED, planes: [space.above(fin, 5.34)] }]),
          },
        ]),
      ),
      radome: { color: RADOME },
    },
    markings: [
      ...finArt('mod-eagle-patch'),
      ...both('fin-code', 'code-zz'),
      ...both('fin-serial', 'serial-85-115'),
      ...both('insignia', 'insignia-lowvis'),
      ...usafWings,
    ],
  };

  /* 2. 48th Fighter Wing heritage jet, 493rd Fighter Squadron, Lakenheath. */
  // D-Day invasion stripes: five equal bands, white-black-white-black-white.
  const stripeBands = (from, width) =>
    [WHITE, BLACK, WHITE, BLACK, WHITE].map((color, i) => [
      color,
      from + i * width,
      from + (i + 1) * width,
    ]);
  const wingStripes = (slot, sideSign) =>
    stripeBands(3.25, 0.32).map(([color, a, b]) => ({
      color,
      planes: [
        space.plane(slot, [sideSign, 0, 0], [sideSign * a, 0, 0]),
        space.plane(slot, [-sideSign, 0, 0], [sideSign * b, 0, 0]),
      ],
    }));
  const bellyStripes = stripeBands(-1.1, 0.36).map(([color, a, b]) => ({
    color,
    planes: [
      space.ahead('airframe', a),
      space.behind('airframe', b),
      space.below('airframe', 1.72),
    ],
  }));
  const heritagePaints = {
    ...overall(MOD_DARK),
    airframe: {
      color: MOD_DARK,
      zones: [
        // The white band behind the radome that carries the red checks.
        {
          color: WHITE,
          planes: [space.ahead('airframe', 8.6), space.behind('airframe', 9.4)],
        },
        ...bellyStripes,
      ],
    },
    wing: {
      color: MOD_DARK,
      zones: [...wingStripes('wing', 1), ...wingStripes('wing', -1)],
    },
    radome: { color: '#5f676d' },
  };
  for (const side of SIDES) {
    const s = sign(side);
    heritagePaints[`flap-out-${side}`] = {
      color: MOD_DARK,
      zones: wingStripes(`flap-out-${side}`, s),
    };
    heritagePaints[`aileron-${side}`] = {
      color: MOD_DARK,
      zones: wingStripes(`aileron-${side}`, s),
    };
    heritagePaints[`fin-${side}`] = {
      color: MOD_DARK,
      zones: [
        {
          color: HERITAGE_BLUE,
          planes: [space.sideLine(`fin-${side}`, [-3.86, 2.75], [-5.65, 5.58], 1)],
        },
      ],
    };
    heritagePaints[`rudder-${side}`] = { color: HERITAGE_BLUE };
    heritagePaints[`fincap-${side}`] = { color: HERITAGE_BLUE };
  }
  const heritage = {
    id: 'ln-493fs-heritage',
    label: '493rd FS heritage, Lakenheath, 2019',
    provenance: {
      kind: 'inspired',
      note: '48th Fighter Wing heritage F-15C of the 493rd Fighter Squadron from the referenced USAF photographs: dark gray overall, the red-and-white checkerboard nose band behind the radome, black-and-white D-Day invasion stripes across both wings and the belly, blue fin leading edges, caps and rudders, the black LN code and AF 86 156 serial, and the wing’s green Statue of Liberty redrawn as an original silhouette. The serial is representative, the wing and squadron badges are omitted, and the check size and stripe widths are approximations.',
      references: [references.heritage1, references.heritage2],
    },
    paints: heritagePaints,
    markings: [
      ...both('nose-checks', 'nose-checks-side'),
      { anchor: 'nose-checks-top', graphic: 'nose-checks-top' },
      { anchor: 'nose-checks-bottom', graphic: 'nose-checks-top' },
      ...finArt('liberty-fin'),
      ...both('fin-code', 'code-ln'),
      ...both('fin-serial', 'serial-86-156'),
      ...both('insignia', 'insignia-lowvis'),
      ...usafWings,
    ],
  };

  /* 3. 65th Aggressor Squadron, Nellis: blue splinter camouflage with a light gray nose. */
  const splinter = (slot) => camo(slot, [AGR_DARK, AGR_MID, AGR_LIGHT], 6.5, 23, 'splinter');
  const agrPaints = {
    ...overall(AGR_MID, splinter),
    airframe: {
      color: AGR_MID,
      camouflage: splinter('airframe'),
      // The light gray forward fuselage ends in a raked line behind the insignia.
      zones: [
        { color: '#b9c1c7', planes: [space.sideLine('airframe', [0.9, 1.2], [2.7, 3.6], -1)] },
      ],
    },
    radome: { color: '#8e979d' },
  };
  for (const side of SIDES)
    agrPaints[`fin-${side}`] = {
      color: AGR_DARK,
      camouflage: splinter(`fin-${side}`),
    };
  const aggressor = {
    id: 'wa-65agrs-aggressor',
    label: '65th Aggressor Squadron, Nellis, 2012',
    provenance: {
      kind: 'inspired',
      note: '65th Aggressor Squadron F-15C from the referenced Nellis photograph: light gray forward fuselage and a blue-gray splinter camouflage aft (procedural, approximating the photographed shard pattern), yellow-and-black checked fin tips, the white WA tail code outlined in dark blue, aggressor number 94 on the intakes, 494 on the nose and low-visibility national insignia. The squadron and command badges and crew names are omitted.',
      references: [references.agrs],
    },
    paints: agrPaints,
    markings: [
      ...both('fin-tip', 'aggressor-checks'),
      ...both('fin-code', 'code-wa'),
      ...both('intake-number', 'agr-number-94'),
      ...both('nose-number', 'nose-494'),
      ...both('insignia', 'insignia-lowvis'),
      ...usafWings,
    ],
  };

  /* 4. Israeli Air Force Baz. */
  const iafPaints = { ...overall(IAF_GRAY), radome: { color: '#6f777c' } };
  const iaf = {
    id: 'iaf-baz-818',
    label: 'Israeli Air Force 106 Sqn Baz 818, 2019',
    provenance: {
      kind: 'inspired',
      note: 'Israeli Air Force F-15C Baz 818 of 106 (Spearhead) Squadron, Tel Nof, from the referenced 2019 photograph (Cobra Warrior, RAF Waddington): light gray overall with a darker radome, the blue Star of David roundel on the intake sides and wings, 818 in blue on the nose and large in black on the fins, the squadron’s eagle badge redrawn as an original diving-eagle silhouette and the red star on the fin. The red inner-fin flash, kill markings and stencils are omitted; wing roundel positions and colors are approximations.',
      references: [references.iaf],
    },
    paints: iafPaints,
    markings: [
      ...both('roundel', 'iaf-roundel'),
      ...both('nose-number', 'iaf-818-nose'),
      // The eagle dives toward the nose on both fins.
      { anchor: 'fin-art-1', graphic: 'iaf-eagle', flip: true },
      { anchor: 'fin-art--1', graphic: 'iaf-eagle' },
      ...both('fin-number', 'iaf-818-fin'),
      ...both('fin-star', 'red-star'),
      { anchor: 'wing-roundel-upper-right', graphic: 'iaf-roundel-wing' },
      { anchor: 'wing-roundel-lower-left', graphic: 'iaf-roundel-wing' },
    ],
  };

  /* 5. Japan Air Self-Defense Force F-15J (the licence-built F-15C). */
  Object.assign(graphics, {
    hinomaru: k.hinomaru(new k.Canvas(0.72, 0.72), 0.36, 0.36, 0.35).graphic('Hinomaru'),
    'hinomaru-wing': k
      .hinomaru(new k.Canvas(0.95, 0.95), 0.475, 0.475, 0.46)
      .graphic('Hinomaru (wing)'),
    'jasdf-880': text('880', 0.95, 0.36, BLACK, { face: 'technical' }),
    'jasdf-72-8880': text('72-8880', 1.45, 0.3, BLACK, { face: 'technical' }),
  });
  const jasdf = {
    id: 'jasdf-f15j-880',
    label: 'JASDF F-15J 72-8880',
    provenance: {
      kind: 'inspired',
      note: 'Japan Air Self-Defense Force F-15J 72-8880 (the licence-built F-15C) from the referenced photograph: light gray overall with a gray radome, the hinomaru on the intake sides and above and below both wings, the black 880 nose number (its thin white edge omitted) and the 72-8880 fin serial. This jet wore a special squadron fin and tank design that is omitted (standard markings only), as are the small stencils and the yellow rescue arrows. Colors are approximations.',
      references: [references.jasdf],
    },
    paints: { ...overall('#a9b0b5'), radome: { color: '#8a9297' } },
    markings: [
      ...both('roundel', 'hinomaru'),
      ...both('nose-big', 'jasdf-880'),
      ...both('fin-serial-wide', 'jasdf-72-8880'),
      { anchor: 'wing-roundel-upper-left', graphic: 'hinomaru-wing' },
      { anchor: 'wing-roundel-upper-right', graphic: 'hinomaru-wing' },
      { anchor: 'wing-roundel-lower-left', graphic: 'hinomaru-wing' },
      { anchor: 'wing-roundel-lower-right', graphic: 'hinomaru-wing' },
    ],
  };

  return {
    selected: kadena.id,
    anchors,
    graphics,
    variants: [kadena, heritage, aggressor, iaf, jasdf],
  };
}
