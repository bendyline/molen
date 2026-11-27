/**
 * Piper PA-28-180 Cherokee liveries: four Piper factory schemes of the 1960s and early 1970s as
 * flown by surviving British and American aircraft, with fictional registrations in each
 * country's format (UK registrations large on the rear fuselage, US marks small).
 *
 * Paint regions are authored in model metres and applied to every paint slot (shell, the baked
 * belt band and its gold pinstripe rod, flaps, ailerons, stabilator and the rudder skins) so
 * the control surfaces match the structure around them. Piper and Cherokee logos are omitted.
 */
import {
  above,
  ahead,
  behind,
  below,
  front,
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

const SHELL = 'body-Cherokee-shell-Cherokee-ivory',
  BAND = 'accent-Cherokee-shell-Cherokee-blue',
  SPINNER = 'body-propeller-Cherokee-ivory';

// Paint slots: the existing regions without the old cabin-top overlay (it overlapped the
// shell), plus the gold pinstripe rod that runs along each side of the fuselage.
export function slots(existing) {
  const { 'upper-cabin': _, ...rest } = existing;
  return {
    ...rest,
    'pin-Cherokee-shell-Cherokee-gold': {
      materials: ['Cherokee-gold'],
      node: 'Cherokee-shell-Cherokee-gold',
    },
  };
}

const WHITE = '#f3f2ec',
  CREAM = '#efe9d6',
  PIPER_BLUE = '#1f3b7e',
  NAVY = '#1b2546',
  RED = '#c3272f',
  MAROON = '#6e1d28',
  BLACK = '#17181b',
  SWEEP_BLUE = '#1f4fc0',
  SILVER = '#8d949a';

export default function design({ kit: k, space, slots: all }) {
  const painted = Object.keys(all).filter((n) => n !== SPINNER && space.bounds[n]);
  const paint = (base, regions, finish) => paintSlots(space, painted, base, regions, finish);
  const anchors = {},
    graphics = {};
  const sideArt = (name, art, { reach = 0.62, layers = [SHELL, BAND], mirror = true } = {}) => {
    layers.forEach((slot, i) => {
      Object.assign(anchors, art.anchors(space, slot, `${name}.${i}`, { reach }));
    });
    graphics[name] = art.graphic(name);
    return layers.flatMap((_, i) => [
      { anchor: `${name}.${i}-l`, graphic: name },
      { anchor: `${name}.${i}-r`, graphic: name, ...(mirror ? { flip: true } : {}) },
    ]);
  };
  const text = (
    name,
    label,
    { z, y, width, height, color, layers = [SHELL, BAND], reach = 0.62, ...opts },
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
  const lift = (line, dy) => line.map(([z, y]) => [z, y + dy]);
  // Fuselage color below a line: full width ahead of the stabilator, the tail cone only behind
  // its leading edge so the stabilator roots stay clear.
  const body = (color, planes) => [
    { color, planes: [...planes, above(0.42), ahead(-3.55), ...inboard(0.57)] },
    { color, planes: [...planes, behind(-3.55), ...inboard(0.16)] },
  ];
  const stripe = (color, line, y0, y1, extra = []) => ({
    color,
    planes: [
      over(...lift(line, y0)),
      under(...lift(line, y1)),
      above(0.42),
      ...inboard(0.57),
      ...extra,
    ],
  });

  /* ---------------------------------------------------- 1964 Cherokee B: blue ---- */
  // Blue lower fuselage and cowling below a straight split, two blue pinstripes above it, the
  // top of the fin blue over two pinstripes.
  const splitB = [
    [2.45, 1.1],
    [-4.5, 0.98],
  ];
  const cherokeeB = [
    ...body(PIPER_BLUE, [under(...splitB)]),
    stripe(PIPER_BLUE, splitB, 0.045, 0.058),
    stripe(PIPER_BLUE, splitB, 0.078, 0.091),
    { color: PIPER_BLUE, planes: [above(1.84), behind(-3.15), ...inboard(0.2)] },
    { color: PIPER_BLUE, planes: [above(1.7), below(1.725), behind(-3.15), ...inboard(0.2)] },
    { color: PIPER_BLUE, planes: [above(1.64), below(1.665), behind(-3.15), ...inboard(0.2)] },
  ];
  const regB = text('reg-g-atrb', 'G-ATRB', {
    z: -2.35,
    y: 0.92,
    width: 1.5,
    height: 0.3,
    cap: 0.25,
    color: WHITE,
    slant: 0.2,
  });

  /* ---------------------------------------------------- 1968 Cherokee D: navy and red ---- */
  const lineD = [
    [2.45, 1.21],
    [-4.4, 1.04],
  ];
  const cherokeeD = [stripe(NAVY, lineD, 0, 0.045), stripe(NAVY, lineD, -0.062, -0.05)];
  const redArt = new SideArt(k, { zFront: 2.35, zRear: -4.35, yBottom: 0.82, yTop: 1.16 });
  redArt.between(
    RED,
    ...taper(
      spline(
        [
          [2.3, 1.07],
          [0.5, 1.03],
          [-1.8, 0.97],
          [-4.3, 0.91],
        ],
        6,
      ),
      0.085,
      { lead: 0.42, trail: 0.22 },
    ),
  );
  const redStripe = sideArt('d-red', redArt);
  const finD = new SideArt(k, { zFront: -3.15, zRear: -4.55, yBottom: 1.25, yTop: 2.1 });
  finD.poly(RED, [
    [-3.15, 1.43],
    [-4.55, 1.98],
    [-4.55, 1.86],
    [-3.15, 1.33],
  ]);
  finD.poly(NAVY, [
    [-3.15, 1.3],
    [-4.55, 1.82],
    [-4.55, 1.77],
    [-3.15, 1.255],
  ]);
  const finFlashD = sideArt('d-fin', finD, {
    reach: 0.25,
    layers: [SHELL, 'accent-rudder-Cherokee-blue'],
  });
  const regD = text('reg-g-avkh', 'G-AVKH', {
    z: -2.4,
    y: 1.08,
    width: 1.45,
    height: 0.28,
    cap: 0.24,
    color: SILVER,
  });

  /* ---------------------------------------------------- 1971 Cherokee F: maroon ---- */
  const splitF = [
    [2.45, 1.08],
    [-4.5, 0.93],
  ];
  const cherokeeF = [
    ...body(MAROON, [under(...splitF)]),
    stripe(MAROON, splitF, 0.035, 0.085),
    stripe(BLACK, splitF, 0.1, 0.11),
    { color: MAROON, planes: [above(1.9), below(2.02), behind(-3.15), ...inboard(0.2)] },
    { color: BLACK, planes: [above(1.855), below(1.875), behind(-3.15), ...inboard(0.2)] },
    { color: MAROON, planes: [leftOf(1.22), below(1.0), behind(-3.3)] },
    { color: MAROON, planes: [rightOf(-1.22), below(1.0), behind(-3.3)] },
    { color: MAROON, planes: [below(0.27)] },
  ];
  const regF = text('reg-g-azkr', 'G-AZKR', {
    z: -2.55,
    y: 1.15,
    width: 1.3,
    height: 0.24,
    cap: 0.2,
    color: BLACK,
    layers: [SHELL],
  });

  /* ---------------------------------------------------- 1968 US scheme: blue tail sweep ---- */
  const sweep = [
    [-0.45, 0.5],
    [-3.3, 1.28],
  ];
  const lineUS = [
    [2.45, 1.15],
    [-2.6, 1.05],
  ];
  const cherokeeUS = [
    stripe(BLACK, lineUS, 0, 0.014),
    stripe(SWEEP_BLUE, lineUS, -0.05, -0.012),
    stripe(BLACK, lineUS, -0.066, -0.054),
    ...body(BLACK, [under(...lift(sweep, 0.022))]),
    ...body(SWEEP_BLUE, [under(...sweep)]),
    {
      color: SWEEP_BLUE,
      planes: [front([-3.38, 1.26], [-4.1, 2.2]), above(1.26), behind(-3.15), ...inboard(0.2)],
    },
    { color: SWEEP_BLUE, planes: [above(2.13), behind(-3.15), ...inboard(0.2)] },
  ];
  const regUS = text('reg-n7246j', 'N7246J', {
    z: -3.05,
    y: 0.83,
    width: 0.75,
    height: 0.14,
    cap: 0.11,
    color: WHITE,
    layers: [SHELL],
  });

  const references = {
    b: {
      title: 'G-ASHX Piper PA-28-180 Cherokee B (Wikimedia Commons, CC BY-SA 3.0)',
      url: 'https://commons.wikimedia.org/wiki/File:G-ASHX_Piper_PA-28-180_Cherokee_B_(9693386490).jpg',
    },
    d: {
      title: 'G-HOCK Piper PA-28-180 Cherokee D (Wikimedia Commons, CC BY-SA 3.0)',
      url: 'https://commons.wikimedia.org/wiki/File:G-HOCK_Piper_PA-28-180_Cherokee_D_(9693445922).jpg',
    },
    f: {
      title: 'G-AZDX Piper PA-28-180 Cherokee F (Wikimedia Commons, CC BY-SA 3.0)',
      url: 'https://commons.wikimedia.org/wiki/File:G-AZDX_Piper_PA-28-180_Cherokee_F_(9683616211).jpg',
    },
    us: {
      title: 'N6350J 1968 Piper PA-28-180 Cherokee (Wikimedia Commons, CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:N6350J_1968_PIPER_PA-28-180_Cherokee_(30272810356).jpg',
    },
  };

  return {
    selected: 'cherokee-b-1964-blue',
    anchors,
    graphics,
    variants: [
      {
        id: 'cherokee-b-1964-blue',
        label: 'Cherokee B factory blue, 1964 (UK)',
        provenance: {
          kind: 'inspired',
          note: 'Piper’s 1964 Cherokee B paint from the referenced British aircraft: white over a blue lower fuselage and cowling, two blue pinstripes along the split, the top of the fin blue over two fin pinstripes, and a large white UK registration on the blue (G-ATRB, fictional). Approximate colors.',
          references: [references.b],
        },
        paints: { ...paint(WHITE, cherokeeB), [SPINNER]: { color: WHITE } },
        markings: [...regB],
      },
      {
        id: 'cherokee-d-1968-navy-red',
        label: 'Cherokee D factory navy and red, 1968 (UK)',
        provenance: {
          kind: 'inspired',
          note: 'Piper’s 1968 Cherokee D paint from the referenced British aircraft: white with a navy cheatline and pinstripe under the windows, a long red stripe tapering in from the cowling, a red and navy flash rising across the fin and a silver-gray UK registration (G-AVKH, fictional). Wheel-fairing stripes and the owner’s badge are omitted; approximate colors.',
          references: [references.d],
        },
        paints: { ...paint(WHITE, cherokeeD), [SPINNER]: { color: WHITE } },
        markings: [...redStripe, ...finFlashD, ...regD],
      },
      {
        id: 'cherokee-f-1971-maroon',
        label: 'Cherokee F factory maroon, 1971 (UK)',
        provenance: {
          kind: 'inspired',
          note: 'Piper’s early-1970s Cherokee F paint from the referenced British aircraft: maroon lower fuselage, cowling and spinner, a maroon cheatline and black pinstripe above the split, maroon and black bands near the top of the fin, maroon stabilator tips and wheel-fairing bottoms, and a black UK registration (G-AZKR, fictional). Approximate colors.',
          references: [references.f],
        },
        paints: { ...paint(WHITE, cherokeeF), [SPINNER]: { color: MAROON } },
        markings: [...regF],
      },
      {
        id: 'cherokee-1968-blue-sweep',
        label: 'Cherokee 180 blue tail sweep, 1968 (US)',
        provenance: {
          kind: 'inspired',
          note: 'A 1968 Cherokee 180 scheme from the referenced US photograph: cream with blue and black cheatlines from the spinner, a black-edged blue sweep over the rear fuselage, blue fin leading edge and cap, and a small white US registration on the blue (N7246J, fictional). Wheel-fairing stripes are omitted; approximate colors.',
          references: [references.us],
        },
        paints: { ...paint(CREAM, cherokeeUS), [SPINNER]: { color: CREAM } },
        markings: [...regUS],
      },
    ],
  };
}
