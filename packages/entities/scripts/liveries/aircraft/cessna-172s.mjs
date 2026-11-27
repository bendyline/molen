/**
 * Cessna 172S Skyhawk SP liveries: the 1998 factory swoosh, a 2020s flight-school scheme, the
 * USAF Academy T-41D, a Republic of Korea Air Force T-41B and the Iraqi Air Force 172S.
 *
 * Military schemes carry their real insignia, titles and serials redrawn as original vector art;
 * civil schemes take the photographed colors and stripe layout with fictional registrations and
 * no names or logos. Paint regions are authored in model metres and applied to every paint slot
 * (fuselage shell, the baked belt strip, flaps, ailerons, elevators and rudder) so control
 * surfaces carry the same colors as the structure around them.
 */
import {
  above,
  aft,
  ahead,
  behind,
  below,
  half,
  inboard,
  leftOf,
  lettering,
  over,
  paintSlots,
  rightOf,
  SideArt,
  spline,
  taper,
  under,
} from '../art-ga-a.mjs';

const SHELL = 'body-Skyhawk-shell-Skyhawk-white',
  ACCENT = 'accent-Skyhawk-shell-Skyhawk-navy',
  RUDDER = 'body-rudder-Skyhawk-white',
  SPINNER = 'body-propeller-Skyhawk-white';

const WHITE = '#f2f2ee',
  NAVY = '#1b2753',
  ROYAL = '#1f5fc4',
  GOLD = '#eea62b',
  RED = '#c4212f',
  ACADEMY = '#1d3c8f',
  BLACK = '#17191c',
  METAL = '#c3c8cc',
  IRAQ_GRAY = '#aab3ba';

/** Wing upper surfaces: above the chord plane, which rises with the dihedral. */
const wingTops = (color) => [
  { color, planes: [leftOf(0.62), half([-0.025, 1, 0], [1, 1.784, 0])] },
  { color, planes: [rightOf(-0.62), half([0.025, 1, 0], [-1, 1.784, 0])] },
];

/** The USAF Academy's slab-serif "AF", an original block drawing (cap height h). */
function academyAF(c, x, y, h, color) {
  const s = h / 10;
  // A: two legs, a crossbar, slab feet and a flat apex.
  c.add(
    color,
    [
      [x, y],
      [x + 2.6 * s, y],
      [x + 2.6 * s, y + 0.9 * s],
      [x + 2.0 * s, y + 0.9 * s],
      [x + 2.5 * s, y + 2.6 * s],
      [x + 5.1 * s, y + 2.6 * s],
      [x + 5.6 * s, y + 0.9 * s],
      [x + 5.0 * s, y + 0.9 * s],
      [x + 5.0 * s, y],
      [x + 8.0 * s, y],
      [x + 8.0 * s, y + 0.9 * s],
      [x + 7.4 * s, y + 0.9 * s],
      [x + 4.9 * s, y + 10 * s],
      [x + 2.9 * s, y + 10 * s],
      [x + 0.6 * s, y + 0.9 * s],
      [x, y + 0.9 * s],
    ],
    [
      [
        [x + 3.0 * s, y + 4.2 * s],
        [x + 3.8 * s, y + 7.4 * s],
        [x + 4.6 * s, y + 4.2 * s],
      ],
    ],
  );
  // F: stem with slab foot, top arm with a drop serif, middle arm (overlapping the A's leg).
  const fx = x + 6.2 * s;
  c.add(color, [
    [fx, y],
    [fx + 3.4 * s, y],
    [fx + 3.4 * s, y + 0.9 * s],
    [fx + 2.6 * s, y + 0.9 * s],
    [fx + 2.6 * s, y + 4.4 * s],
    [fx + 4.4 * s, y + 4.4 * s],
    [fx + 4.4 * s, y + 3.6 * s],
    [fx + 5.2 * s, y + 3.6 * s],
    [fx + 5.2 * s, y + 6.4 * s],
    [fx + 4.4 * s, y + 6.4 * s],
    [fx + 4.4 * s, y + 5.6 * s],
    [fx + 2.6 * s, y + 5.6 * s],
    [fx + 2.6 * s, y + 8.8 * s],
    [fx + 5.4 * s, y + 8.8 * s],
    [fx + 5.4 * s, y + 7.4 * s],
    [fx + 6.2 * s, y + 7.4 * s],
    [fx + 6.2 * s, y + 10 * s],
    [fx, y + 10 * s],
    [fx, y + 9.1 * s],
    [fx + 0.7 * s, y + 9.1 * s],
    [fx + 0.7 * s, y + 0.9 * s],
    [fx, y + 0.9 * s],
  ]);
  return c;
}

/** Republic of Korea Air Force insignia: taegeuk in a thin white ring, three bars each side. */
function rokafInsignia(c, cx, cy, r) {
  c.circle('#ffffff', cx, cy, r * 1.1, 48);
  const t = r;
  c.circle('#c8213a', cx, cy, t, 48);
  const half = Array.from({ length: 33 }, (_, i) => {
    const a = Math.PI + (i * Math.PI) / 32;
    return [cx + Math.cos(a) * t, cy + Math.sin(a) * t];
  });
  c.add('#123e8f', half);
  c.circle('#123e8f', cx + t / 2, cy, t / 2, 32);
  c.circle('#c8213a', cx - t / 2, cy, t / 2, 32);
  const bar = r * 0.16,
    gap = r * 0.14;
  for (const side of [-1, 1])
    for (let i = -1; i <= 1; i++) {
      const x0 = side > 0 ? cx + r * 1.35 : cx - r * 1.35 - r * 1.1;
      c.rect(BLACK, x0, cy + i * (bar + gap) - bar / 2, r * 1.1, bar);
    }
  return c;
}

/** Iraqi flag (2008 pattern): red, white and black bands; the green script is simplified. */
function iraqFlag(k, w, h) {
  const c = new k.Canvas(w, h);
  c.rect('#ce1126', 0, (2 * h) / 3, w, h / 3);
  c.rect('#ffffff', 0, h / 3, w, h / 3);
  c.rect('#141414', 0, 0, w, h / 3);
  // The takbir as three short green calligraphic strokes (a simplified original rendering).
  const g = '#007a3d',
    y = h / 2,
    sw = h * 0.05;
  c.rect(g, w * 0.2, y - sw * 1.6, w * 0.6, sw);
  for (const x of [0.28, 0.46, 0.62, 0.74]) c.rect(g, w * x, y - sw * 1.6, sw, h * 0.2);
  c.box(g, w * 0.36, y + h * 0.02, w * 0.12, sw, 0.6);
  return c.graphic('Iraqi flag');
}

export default function design({ kit: k, space, slots: all }) {
  const painted = Object.keys(all).filter((n) => n !== SPINNER && space.bounds[n]);
  const paint = (base, regions, finish) => paintSlots(space, painted, base, regions, finish);
  const anchors = {},
    graphics = {};
  /** Side art projected on the shell and on the baked belt strip that sits over it. */
  const sideArt = (name, art, { reach = 0.7, layers = [SHELL, ACCENT] } = {}) => {
    layers.forEach((slot, i) => {
      Object.assign(anchors, art.anchors(space, slot, `${name}.${i}`, { reach }));
    });
    graphics[name] = art.graphic(name);
    return (mirror = true) =>
      layers.flatMap((_, i) => [
        { anchor: `${name}.${i}-l`, graphic: name },
        { anchor: `${name}.${i}-r`, graphic: name, ...(mirror ? { flip: true } : {}) },
      ]);
  };
  /** Lettering on both sides at (z, y) on the given slots. */
  const text = (
    name,
    label,
    { z, y, width, height, color, layers = [SHELL], reach = 0.7, ...opts },
  ) => {
    const art = new SideArt(k, {
      zFront: z + width / 2,
      zRear: z - width / 2,
      yBottom: y - height / 2,
      yTop: y + height / 2,
    });
    layers.forEach((slot, i) => {
      Object.assign(anchors, art.anchors(space, slot, `${name}.${i}`, { reach }));
    });
    graphics[name] = lettering(k, label, { width, height, color, ...opts });
    return layers.flatMap((_, i) => [
      { anchor: `${name}.${i}-l`, graphic: name },
      { anchor: `${name}.${i}-r`, graphic: name },
    ]);
  };

  /* ---------------------------------------------------- 1998 factory Skyhawk SP swoosh ---- */
  // A breaking wave: navy and royal blades with forward points high on the cowling dip under
  // the windshield, the navy cresting behind the strut; the royal runs aft as a stripe with a
  // gold stripe below it, both ending ahead of the registration.
  const swoosh = new SideArt(k, { zFront: 2.2, zRear: -2.55, yBottom: 0.74, yTop: 1.27 });
  swoosh.between(
    ROYAL,
    [
      ...spline([
        [2.05, 1.17],
        [1.55, 1.0],
        [1.05, 0.895],
        [0.6, 0.9],
        [0.2, 0.985],
        [-0.15, 1.025],
        [-0.6, 1.03],
      ]),
      [-2.55, 1.03],
    ],
    [
      ...spline([
        [2.05, 1.17],
        [1.55, 0.92],
        [1.05, 0.765],
        [0.6, 0.77],
        [0.2, 0.9],
        [-0.15, 0.97],
        [-0.6, 0.975],
      ]),
      [-2.55, 0.975],
    ],
  );
  swoosh.between(
    NAVY,
    spline([
      [2.14, 1.25],
      [1.65, 1.12],
      [1.15, 1.025],
      [0.75, 1.04],
      [0.4, 1.12],
      [0.1, 1.105],
      [-0.3, 1.055],
    ]),
    spline([
      [2.14, 1.25],
      [1.65, 1.05],
      [1.15, 0.93],
      [0.75, 0.925],
      [0.4, 0.98],
      [0.1, 1.03],
      [-0.3, 1.055],
    ]),
  );
  swoosh.between(
    GOLD,
    [
      ...spline([
        [0.3, 0.83],
        [0.0, 0.915],
        [-0.3, 0.952],
        [-0.6, 0.955],
      ]),
      [-2.55, 0.955],
    ],
    [
      ...spline([
        [0.3, 0.83],
        [0.0, 0.885],
        [-0.3, 0.912],
        [-0.6, 0.914],
      ]),
      [-2.55, 0.914],
    ],
  );
  const factorySwoosh = sideArt('sp-swoosh', swoosh);
  // Fin: a royal blade over a gold one, rising toward the rudder.
  const finSwoosh = new SideArt(k, { zFront: -3.9, zRear: -5.65, yBottom: 1.3, yTop: 1.9 });
  finSwoosh.between(
    ROYAL,
    spline([
      [-3.95, 1.42],
      [-4.4, 1.57],
      [-4.95, 1.64],
      [-5.65, 1.83],
    ]),
    spline([
      [-3.95, 1.42],
      [-4.4, 1.49],
      [-4.95, 1.54],
      [-5.65, 1.71],
    ]),
  );
  finSwoosh.between(
    GOLD,
    spline([
      [-4.1, 1.43],
      [-4.5, 1.47],
      [-5.0, 1.51],
      [-5.65, 1.68],
    ]),
    spline([
      [-4.1, 1.43],
      [-4.5, 1.43],
      [-5.0, 1.465],
      [-5.65, 1.63],
    ]),
  );
  const factoryFin = sideArt('sp-fin', finSwoosh, { reach: 0.3, layers: [SHELL, RUDDER] });

  /* ---------------------------------------------------- 2020s flight school scheme ---- */
  // Navy fin wrapping down the tail cone aft of a line slanting from the fin root forward to
  // the belly; red and navy lightning stripes run low along the fuselage.
  const schoolTail = [
    { color: NAVY, planes: [above(1.24), behind(-3.45), ...inboard(0.3)] },
    { color: NAVY, planes: [aft([-3.66, 1.3], [-3.32, 0.58]), ...inboard(0.25)] },
  ];
  const blades = new SideArt(k, { zFront: 2.2, zRear: -2.5, yBottom: 0.6, yTop: 1.12 });
  const bolt = (color, points, width, opts) =>
    blades.between(color, ...taper(spline(points, 4), width, opts));
  bolt(
    NAVY,
    [
      [2.12, 1.03],
      [1.45, 0.955],
      [1.38, 0.925],
      [0.4, 0.82],
      [-0.85, 0.7],
    ],
    0.045,
  );
  bolt(
    RED,
    [
      [2.0, 1.075],
      [0.62, 0.915],
      [0.55, 0.875],
      [-0.6, 0.79],
      [-2.4, 0.705],
    ],
    0.05,
    { lead: 0.08, trail: 0.15 },
  );
  bolt(
    NAVY,
    [
      [0.95, 0.985],
      [-0.2, 0.86],
      [-0.27, 0.83],
      [-1.25, 0.75],
    ],
    0.042,
  );
  bolt(
    RED,
    [
      [-0.55, 0.875],
      [-1.45, 0.8],
      [-2.4, 0.75],
    ],
    0.03,
    { lead: 0.15, trail: 0.3 },
  );
  const schoolBlades = sideArt('school-blades', blades);
  // Fin band: a white band following the leading-edge sweep with red pinstripe blocks at each
  // end (the school's red lettering in the middle is omitted).
  const band = new SideArt(k, { zFront: -4.2, zRear: -5.62, yBottom: 1.84, yTop: 2.08 });
  const sweep = (y) => -4.27 - (y - 1.84) * 1.19;
  const quad = (color, z0, z1, y0, y1) =>
    band.poly(color, [
      [sweep(y0) - z0, y0],
      [sweep(y0) - z1, y0],
      [sweep(y1) - z1, y1],
      [sweep(y1) - z0, y1],
    ]);
  quad(RED, 0, 1.6, 1.84, 1.855);
  quad(WHITE, 0, 1.6, 1.855, 2.065);
  quad(RED, 0, 1.6, 2.065, 2.08);
  for (const [z0, z1] of [
    [0, 0.32],
    [1.05, 1.6],
  ])
    for (let i = 0; i < 3; i++)
      quad(i === 1 ? NAVY : RED, z0, z1, 1.885 + i * 0.055, 1.91 + i * 0.055);
  const schoolBand = sideArt('school-band', band, { reach: 0.3, layers: [SHELL, RUDDER] });

  /* ---------------------------------------------------- USAF Academy T-41D ---- */
  const split = [
    [2.35, 1.1],
    [-5.3, 0.8],
  ];
  const lift = (dy) => split.map(([z, y]) => [z, y + dy]);
  const academy = [
    { color: ACADEMY, planes: [under(...split), above(0.45), ...inboard(0.62)] },
    { color: RED, planes: [over(...split), under(...lift(0.032)), above(0.45), ...inboard(0.62)] },
    { color: ACADEMY, planes: [above(1.236), behind(-3.45), ...inboard(0.3)] },
    { color: RED, planes: [above(1.204), below(1.236), behind(-1.62), ...inboard(0.62)] },
    ...wingTops(ACADEMY),
  ];
  const af = new SideArt(k, { zFront: -4.25, zRear: -5.35, yBottom: 1.42, yTop: 1.9 });
  academyAF(af.canvas, 0.17, 0.02, 0.44, WHITE);
  const academyLetters = sideArt('af', af, { reach: 0.3, layers: [SHELL, RUDDER] });
  const checks = new SideArt(k, { zFront: -4.75, zRear: -5.62, yBottom: 2.06, yTop: 2.16 });
  for (let i = 0; i < 18; i++)
    for (let j = 0; j < 2; j++)
      if ((i + j) % 2 === 0)
        checks.poly(WHITE, [
          [-4.75 - i * 0.05, 2.06 + j * 0.05],
          [-4.8 - i * 0.05, 2.06 + j * 0.05],
          [-4.8 - i * 0.05, 2.11 + j * 0.05],
          [-4.75 - i * 0.05, 2.11 + j * 0.05],
        ]);
  const academyChecks = sideArt('af-checks', checks, { reach: 0.3, layers: [SHELL, RUDDER] });
  const insigniaArt = (name, z, y, r) => {
    const art = new SideArt(k, {
      zFront: z + 2.1 * r,
      zRear: z - 2.1 * r,
      yBottom: y - 1.25 * r,
      yTop: y + 1.25 * r,
    });
    k.usInsignia(art.canvas, 2.1 * r, 1.25 * r, r, { style: 'full' });
    return sideArt(name, art)(false);
  };
  const academyInsignia = insigniaArt('usaf-insignia', -2.65, 0.93, 0.19);
  const academyTitle = text('usafa-title', 'U.S.A.F. ACADEMY', {
    z: 1.72,
    y: 0.99,
    width: 1.0,
    height: 0.1,
    color: WHITE,
    layers: [SHELL, ACCENT],
  });

  /* ---------------------------------------------------- ROKAF T-41B ---- */
  const rokaf = [
    { color: RED, planes: [above(1.95), behind(-3.9), ...inboard(0.3)] },
    { color: RED, planes: [leftOf(4.72)] },
    { color: RED, planes: [rightOf(-4.72)] },
    { color: RED, planes: [leftOf(1.3), below(1.3), behind(-3.8)] },
    { color: RED, planes: [rightOf(-1.3), below(1.3), behind(-3.8)] },
    {
      color: BLACK,
      roughness: 0.8,
      metalness: 0,
      planes: [above(1.39), ahead(1.22), behind(2.3), ...inboard(0.4)],
    },
  ];
  const rokafMark = (() => {
    const r = 0.2,
      art = new SideArt(k, {
        zFront: -2.95 + 2.5 * r * 1.15,
        zRear: -2.95 - 2.5 * r * 1.15,
        yBottom: 0.93 - 1.15 * r,
        yTop: 0.93 + 1.15 * r,
      });
    rokafInsignia(art.canvas, 2.5 * r * 1.15, 1.15 * r, r);
    return sideArt('rokaf-insignia', art)(false);
  })();
  const rokafCode = text('rokaf-code', 'T-054', {
    z: 0.05,
    y: 1.0,
    width: 0.75,
    height: 0.2,
    color: BLACK,
  });
  const rokafSerial = text('rokaf-serial', '15054', {
    z: -4.88,
    y: 1.72,
    width: 0.72,
    height: 0.2,
    color: BLACK,
    layers: [SHELL, RUDDER],
    reach: 0.3,
  });

  /* ---------------------------------------------------- Iraqi Air Force ---- */
  const iraqTitle = text('iraq-title', 'IRAQI AIR FORCE', {
    z: -2.85,
    y: 0.96,
    width: 1.5,
    height: 0.13,
    color: BLACK,
    layers: [SHELL, ACCENT],
  });
  const iraqSerial = text('iraq-serial', 'YI-137', {
    z: -3.35,
    y: 1.17,
    width: 0.5,
    height: 0.11,
    color: BLACK,
  });
  graphics['iraq-flag'] = iraqFlag(k, 0.3, 0.2);
  const flagAnchors = (name, slot) =>
    Object.assign(
      anchors,
      new SideArt(k, { zFront: -4.88, zRear: -5.18, yBottom: 2.02, yTop: 2.22 }).anchors(
        space,
        slot,
        name,
        { reach: 0.3 },
      ),
    );
  flagAnchors('iraq-flag.0', SHELL);
  const iraqFlagMarks = ['iraq-flag.0'].flatMap((a) => [
    { anchor: `${a}-l`, graphic: 'iraq-flag', flip: false },
    { anchor: `${a}-r`, graphic: 'iraq-flag', flip: true },
  ]);

  /* ---------------------------------------------------- registrations ---- */
  const reg = (name, label, color, opts = {}) =>
    text(name, label, {
      z: -3.5,
      y: 0.97,
      width: 1.6,
      height: 0.27,
      color,
      slant: 0.18,
      layers: [SHELL, ACCENT],
      ...opts,
    });
  const factoryReg = reg('reg-n417sp', 'N417SP', NAVY);
  const schoolReg = reg('reg-n2172a', 'N2172A', NAVY, {
    slant: 0,
    z: -2.42,
    y: 1.0,
    width: 1.42,
    cap: 0.24,
  });

  const references = {
    sp1998: {
      title: 'Cessna 172S Skyhawk SP N745SP, factory scheme (Wikimedia Commons, CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Cessna_172S_Skyhawk_SP_(N745SP,_cn_172S8677)_(4-13-2024).jpg',
    },
    school: {
      title:
        'Cessna 172S Skyhawk SP N24221 in flight-school colors (Wikimedia Commons, CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Cessna_172S_Skyhawk_SP_(N24221,_cn_172S13131)_(4-9-2024).jpg',
    },
    usafa: {
      title: 'USAF Academy Flying Team T-41D (US Air Force photo, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:USAFA_Flying_Team_T-41D.jpg',
    },
    usafa2: {
      title: 'Cessna T-41 Mescalero of the USAF Academy (US Air Force photo, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:Cessna_T-41_Mescalero.jpg',
    },
    rokaf: {
      title: 'ROKAF Cessna T-41B Mescalero 15054 (Wikimedia Commons, CC BY-SA 3.0)',
      url: 'https://commons.wikimedia.org/wiki/File:15054-T-054_Cessna_T-41B_Mescalero_(7597148054).jpg',
    },
    iraq: {
      title: 'Cessna 172S Skyhawk of the Iraqi Air Force (US Air Force photo, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:Cessna_172S_Skyhawk_of_the_Iraqi_Air_Force.jpg',
    },
  };

  return {
    selected: 'skyhawk-sp-1998',
    anchors,
    graphics,
    variants: [
      {
        id: 'skyhawk-sp-1998',
        label: 'Skyhawk SP factory scheme, 1998',
        provenance: {
          kind: 'inspired',
          note: 'Cessna’s late-1990s Skyhawk SP paint from the referenced photograph: white overall with a navy and royal blue double swoosh breaking over the forward fuselage, the royal stripe and a gold stripe running aft to the registration, and a royal and gold swoosh across the fin. The Skyhawk SP fin logo and wheel-fairing swooshes are omitted; registration N417SP is fictional. Swoosh curves and colors are approximations.',
          references: [references.sp1998],
        },
        paints: { ...paint(WHITE, []), [SPINNER]: { color: WHITE } },
        markings: [...factorySwoosh(), ...factoryFin(), ...factoryReg],
      },
      {
        id: 'flight-school-2020',
        label: 'Flight school white and navy, 2020s',
        provenance: {
          kind: 'inspired',
          note: 'A 2020s flight-academy scheme after the referenced photograph: white with a navy fin that wraps down into the lower tail cone, red and navy blades crossing along the forward fuselage, a red and white striped band across the fin and a large navy registration. The school’s name and logo are omitted; registration N2172A is fictional. Blade shapes are approximations.',
          references: [references.school],
        },
        paints: { ...paint(WHITE, schoolTail), [SPINNER]: { color: WHITE } },
        markings: [...schoolBlades(), ...schoolBand(), ...schoolReg],
      },
      {
        id: 'usaf-academy-t-41d',
        label: 'USAF Academy T-41D Mescalero, 2000s',
        provenance: {
          kind: 'inspired',
          note: 'US Air Force Academy T-41D scheme from the referenced USAF photographs, applied to the 172S model: academy blue lower fuselage, fin and wing upper surfaces over white, red pinstripes along the split and the fin root, the white slab-serif AF and a row of checks on the fin, the national insignia on the rear fuselage and U.S.A.F. ACADEMY on the cowling (all original vector art). The door crest and small serial are omitted; colors and sizes are approximations.',
          references: [references.usafa, references.usafa2],
        },
        paints: { ...paint(WHITE, academy), [SPINNER]: { color: WHITE } },
        markings: [
          ...academyLetters(false),
          ...academyChecks(false),
          ...academyInsignia,
          ...academyTitle,
        ],
      },
      {
        id: 'rokaf-t-41b',
        label: 'Republic of Korea Air Force T-41B, 1970s',
        provenance: {
          kind: 'inspired',
          note: 'ROKAF T-41B 15054 from the referenced museum photograph, applied to the 172S model: natural metal overall with red fin, wing and stabilizer tips, a black anti-glare panel, the taegeuk national insignia with its side bars, T-054 on the forward fuselage and 15054 on the fin (original vector art). The Hangul air force title is omitted; colors are approximations.',
          references: [references.rokaf],
        },
        paints: {
          ...paint(METAL, rokaf, { roughness: 0.32, metalness: 0.75 }),
          [SPINNER]: { color: METAL, roughness: 0.3, metalness: 0.8 },
        },
        markings: [...rokafMark, ...rokafCode, ...rokafSerial],
      },
      {
        id: 'iraqi-air-force',
        label: 'Iraqi Air Force 172S, 2000s',
        provenance: {
          kind: 'inspired',
          note: 'Iraqi Air Force Cessna 172S trainer from the referenced USAF photograph: light gray overall, IRAQI AIR FORCE on the rear fuselage, serial YI-137 ahead of the fin and the national flag at the top of the fin (original vector art; the flag’s green takbir is drawn as simplified strokes). Colors and sizes are approximations.',
          references: [references.iraq],
        },
        paints: { ...paint(IRAQ_GRAY, [], { roughness: 0.55 }), [SPINNER]: { color: IRAQ_GRAY } },
        markings: [...iraqTitle, ...iraqSerial, ...iraqFlagMarks],
      },
    ],
  };
}
