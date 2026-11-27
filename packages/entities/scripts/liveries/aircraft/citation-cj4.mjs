/**
 * Cessna Citation CJ4 liveries: corporate and charter schemes studied from photographs, with
 * their colours, stripes and tail patterns but no names, logos or emblems. Registrations are
 * fictional in the right national format.
 *
 * Model frame: +Z nose, +X the aircraft's left, +Y up. The cabin is level: axis y 1.55, half
 * width 0.81, top 2.40, belly 0.65, the belly paint break near y 1.12. Cabin windows centre at
 * y 1.83 from z 3.2 aft to 1.1; the fin root runs z -5.1 to -2.6 at y 2.4, its tip y 4.4; the
 * nacelles centre on x 1.5, y 1.95, from z -1.0 to -3.5.
 */
import {
  bothSides,
  bothSidesText,
  lettering,
  paintAll,
  sideAnchors,
  sideCanvas,
  spline,
} from '../art-regional.mjs';

const P = 'C25C';
export function slots() {
  const s = (materials, node) => ({ materials: materials.map((m) => `${P}-${m}`), node });
  return {
    skin: s(['paint'], 'fuselage-skin'),
    belly: s(['belly'], 'fuselage-belly'),
    fairing: s(['belly'], 'wing-body-fairing'),
    'nose-door-l': s(['belly'], 'gear-0-door-left'),
    'nose-door-r': s(['belly'], 'gear-0-door-right'),
    fin: s(['paint'], 'fin'),
    'fin-top': s(['paint'], 'fin-top-fairing'),
    rudder: s(['paint'], 'rudder'),
    'tailplane-l': s(['paint'], 'tailplane-1'),
    'tailplane-r': s(['paint'], 'tailplane--1'),
    'elevator-l': s(['paint'], 'elevator-1'),
    'elevator-r': s(['paint'], 'elevator--1'),
    'nacelle-l': s(['paint'], 'engine-1'),
    'nacelle-r': s(['paint'], 'engine-2'),
    'pylon-l': s(['paint'], 'pylon-1'),
    'pylon-r': s(['paint'], 'pylon-2'),
    // The wing slots carry their cut-out speed brakes too.
    'wing-l': s(['wing'], 'wing-1'),
    'wing-r': s(['wing'], 'wing--1'),
    controls: s(['controls']),
    // Projection only (never painted): the painted airframe for side-view artwork.
    hull: s(['paint', 'belly'], 'airframe'),
  };
}

const HALF = 0.81;
const BODY = ['skin', 'belly', 'fairing', 'nose-door-l', 'nose-door-r'];
const TAIL = ['fin', 'fin-top', 'rudder'];
const STAB = ['tailplane-l', 'tailplane-r', 'elevator-l', 'elevator-r'];
const ENGINES = ['nacelle-l', 'nacelle-r', 'pylon-l', 'pylon-r'];
const WINGS = ['wing-l', 'wing-r'];

export default function design({ kit: k, space }) {
  const anchors = {},
    graphics = {};
  /** Side-view art on both sides of a slot (left as drawn, right mirrored). */
  const side = (name, box, { outer = HALF + 0.12, slot = 'hull' } = {}) =>
    Object.assign(anchors, sideAnchors(space, slot, name, box, { outer }));
  /** Fin artwork on the fin and rudder only (not the fuselage or the tip fairing). */
  const finSide = (name, box) => {
    for (const slot of ['fin', 'rudder'])
      Object.assign(anchors, sideAnchors(space, slot, `${name}-${slot}`, box, { outer: 0.3 }));
  };
  const finArt = (name, graphic) => [
    ...bothSides(`${name}-fin`, graphic),
    ...bothSides(`${name}-rudder`, graphic),
  ];
  /** Lettering on the fin and rudder, both sides, reading forward on each. */
  const finText = (name, z, y, width, height) => {
    for (const slot of ['fin', 'rudder'])
      for (const s of [1, -1])
        anchors[`${name}-${slot}-${s > 0 ? 'l' : 'r'}`] = space.anchor(slot, {
          center: [s * 0.15, y, z],
          facing: [s, 0, 0],
          width,
          height,
          depth: 0.26,
        });
  };
  const finTextMarks = (name, graphic) => [
    ...bothSidesText(`${name}-fin`, graphic),
    ...bothSidesText(`${name}-rudder`, graphic),
  ];
  /** Lettering on the outboard face of each nacelle. */
  const nacelleText = (name, z, y, width, height) => {
    anchors[`${name}-l`] = space.anchor('nacelle-l', {
      center: [1.85, y, z],
      facing: [1, 0, 0],
      width,
      height,
      depth: 0.45,
    });
    anchors[`${name}-r`] = space.anchor('nacelle-r', {
      center: [-1.85, y, z],
      facing: [-1, 0, 0],
      width,
      height,
      depth: 0.45,
    });
  };
  const plain = (list, color, extra = {}) =>
    Object.fromEntries(list.map((s) => [s, { color, ...extra }]));
  const reg = (label, color) =>
    lettering(k, label, 1.5, 0.36, color, { face: 'technical', scale: 0.8 });

  /* ------------------------------------------------ factory white with champagne and black ---- */
  // N812NE: white over a champagne lower body behind a black pinline; the rear body, fin and
  // tailplane gloss black; white registration on the fin.
  const CH_GOLD = '#a8977f',
    CH_BLACK = '#17191c';
  const chRise = [
    [-1.55, 1.38],
    [-2.0, 1.6],
    [-2.35, 1.95],
    [-2.68, 2.42],
  ];
  const below = (a, b) => ['line', a, b, -1];
  const chZones = [
    { color: CH_GOLD, steps: [['below', 1.38]] },
    // Behind the wing the lower body turns black, and climbs to the fin's leading edge.
    {
      color: CH_BLACK,
      steps: [
        ['below', 1.38],
        ['line', [-1.35, 0.6], [-1.6, 1.4], -1],
      ],
    },
    ...chRise.slice(0, -1).map((p, i) => ({
      color: CH_BLACK,
      steps: [below(p, chRise[i + 1]), ['behind', p[0] + 0.02]],
    })),
    {
      color: CH_BLACK,
      steps: [
        ['behind', -2.68],
        ['above', 2.0],
      ],
    },
    // The pinline along the break.
    {
      color: CH_BLACK,
      steps: [
        ['below', 1.42],
        ['above', 1.38],
        ['ahead', -1.55],
      ],
    },
  ];
  graphics['reg-n418tx'] = reg('N418TX', '#f4f4f2');
  finText('fin-reg', -4.55, 3.42, 1.5, 0.36);

  /* ------------------------------------------------ white with red and navy pinstripes ---- */
  // N194ME: a red and a navy pinstripe from the nose to the tail cone, the red climbing the
  // rudder's root; the fin carries a red band under a navy cap.
  const PS_RED = '#b8222b',
    PS_NAVY = '#1d2a52';
  const psZones = [
    {
      color: PS_RED,
      steps: [
        ['above', 1.4],
        ['below', 1.45],
        ['ahead', -2.6],
      ],
    },
    {
      color: PS_NAVY,
      steps: [
        ['above', 1.29],
        ['below', 1.36],
        ['ahead', -2.6],
      ],
    },
  ];
  {
    // The aft sweep: both lines climb the tail cone; the red widens up the rudder's root.
    const box = { aft: -6.6, fore: -2.4, low: 1.1, high: 3.2 };
    const v = sideCanvas(k, box);
    const red = spline([
      [-2.4, 1.425],
      [-3.4, 1.5],
      [-4.4, 1.78],
      [-5.2, 2.1],
      [-6.0, 2.55],
      [-6.5, 2.95],
    ]);
    const navy = spline([
      [-2.4, 1.325],
      [-3.4, 1.38],
      [-4.4, 1.6],
      [-5.2, 1.95],
    ]);
    v.band(
      PS_NAVY,
      (z) => navy(z) + 0.035,
      (z) => navy(z) - 0.035,
      -5.25,
      -2.4,
      30,
    );
    v.band(
      PS_RED,
      (z) => red(z) + 0.025 + Math.max(0, -3.8 - z) * 0.1,
      (z) => red(z) - 0.025,
      -6.5,
      -2.4,
      40,
    );
    graphics['ps-aft'] = v.graphic('Pinstripe tail sweep');
    side('ps-aft', box);
  }
  {
    // The fin: a red band rising toward the trailing edge under a navy cap.
    const box = { aft: -6.6, fore: -3.9, low: 3.6, high: 4.44 };
    const v = sideCanvas(k, box);
    const edge = (z) => 3.93 + (-4.3 - z) * 0.2;
    v.band(PS_RED, (z) => edge(z) + 0.15, edge, -6.6, -3.9, 4);
    v.band(
      PS_NAVY,
      () => 4.44,
      (z) => edge(z) + 0.27,
      -6.6,
      -3.9,
      4,
    );
    graphics['ps-fin'] = v.graphic('Pinstripe fin cap');
    finSide('ps-fin', box);
  }
  graphics['reg-n412mk'] = reg('N412MK', PS_NAVY);

  /* ------------------------------------------------ factory swooshes ---- */
  // N22UB and M-FLYI wear the same factory design in different colours: a long thin line
  // from under the cockpit to the engine, a tapered dark spear under the cockpit, a second
  // under the cabin sweeping up to the engine, a grey line above, and fin lines.
  const swoosh = (key, { line, dark, grey, fin }) => {
    const box = { aft: -3.6, fore: 8.05, low: 0.9, high: 2.3 };
    const v = sideCanvas(k, box);
    // A tapered stroke along a centre curve: full width w in the middle, points at the ends.
    const stroke = (color, knots, w, z0, z1, steps = 40) => {
      const c = spline(knots);
      const half = (z) => {
        const t = (z - z0) / (z1 - z0);
        return (w / 2) * Math.min(1, 4 * t, 4 * (1 - t)) ** 0.7;
      };
      v.band(
        color,
        (z) => c(z) + half(z),
        (z) => c(z) - half(z),
        z0,
        z1,
        steps,
      );
    };
    stroke(
      grey,
      [
        [-2.2, 1.98],
        [-0.8, 1.66],
        [1.5, 1.56],
        [3.6, 1.52],
      ],
      0.04,
      -2.2,
      3.6,
    );
    stroke(
      line,
      [
        [-2.6, 1.92],
        [-1.0, 1.6],
        [1.5, 1.5],
        [4.5, 1.44],
        [6.6, 1.36],
        [7.4, 1.33],
      ],
      0.06,
      -2.6,
      7.4,
      60,
    );
    stroke(
      dark,
      [
        [3.3, 1.27],
        [5.0, 1.29],
        [6.9, 1.27],
      ],
      0.11,
      3.3,
      6.9,
    );
    stroke(
      dark,
      [
        [-3.4, 1.98],
        [-1.5, 1.64],
        [0.5, 1.45],
        [2.8, 1.32],
      ],
      0.12,
      -3.5,
      2.8,
    );
    graphics[`${key}-body`] = v.graphic('Factory swoosh lines');
    side(`${key}-body`, box);
    // Fin: two thin dark lines up from the root's leading edge, and an accent wedge over the
    // rudder's root and the tail cone.
    const fbox = { aft: -6.5, fore: -2.4, low: 1.6, high: 4.4 };
    const f = sideCanvas(k, fbox);
    for (const [dz, w] of [
      [0, 0.05],
      [0.45, 0.03],
    ])
      f.band(
        dark,
        (z) => 2.35 + (-2.75 - dz - z) * 1.05 + w / 2,
        (z) => 2.35 + (-2.75 - dz - z) * 1.05 - w / 2,
        -4.6 - dz,
        -2.75 - dz,
        4,
      );
    f.poly(fin, [
      [-3.7, 1.8],
      [-5.0, 1.95],
      [-6.35, 2.65],
      [-6.45, 3.4],
      [-5.6, 2.7],
      [-4.4, 2.15],
    ]);
    graphics[`${key}-fin`] = f.graphic('Factory swoosh fin lines');
    side(`${key}-cone`, fbox);
  };
  swoosh('rb', { line: '#b5202a', dark: '#1b1c1f', grey: '#8e9398', fin: '#b5202a' });
  swoosh('gn', { line: '#2f7a3a', dark: '#163a22', grey: '#8e9398', fin: '#2f7a3a' });
  graphics['reg-n27qw'] = lettering(k, 'N27QW', 1.25, 0.34, '#1b1c1f', {
    face: 'technical',
    scale: 0.82,
  });
  nacelleText('nacelle-reg', -2.15, 1.96, 1.25, 0.34);
  graphics['reg-m-arqz'] = lettering(k, 'M-ARQZ', 1.3, 0.34, '#1b1c1f', {
    face: 'technical',
    scale: 0.82,
  });

  const references = {
    n812ne: {
      title: 'N812NE Citation CJ4, Scottsdale (DUNCAN KIRK, CC BY 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:N812NE_Citation_CJ4,_Scottsdale_05-05-26_(55252338595).jpg',
    },
    n194me: {
      title: 'Cessna Citation CJ4 525C N194ME at Frederick (CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Cessna_Citation_CJ4_525C_N194ME_FDK_MD1.jpg',
    },
    n22ub: {
      title: 'N22UB Cessna Citation CJ4 (CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:N22UB_Cessna_Citation_CJ4_(24468199463).jpg',
    },
    mflyi: {
      title: 'M-FLYI Cessna Citation CJ4 (CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:M-FLYI_Cessna_Citation_CJ4_(23595286172).jpg',
    },
  };
  const WHITE = '#eff0ee',
    WING = '#d7dadb';
  const whiteJet = {
    ...plain([...BODY, ...TAIL, ...STAB, ...ENGINES], WHITE),
    ...plain(WINGS, WING),
    controls: { color: '#c9cdd0' },
  };

  return {
    selected: 'champagne-black-tail',
    anchors,
    graphics,
    variants: [
      {
        id: 'champagne-black-tail',
        label: 'White, champagne and black',
        provenance: {
          kind: 'inspired',
          note: "Factory scheme as photographed on N812NE: white upper body over a metallic champagne lower body behind a black pinline; the rear body, fin, tip fairing and tailplane gloss black, with the registration in white on the fin. The manufacturer's titles on the engines are left off; registration N418TX is fictional. Line positions and colours are approximate.",
          references: [references.n812ne],
        },
        paints: {
          ...whiteJet,
          ...paintAll(space, BODY, WHITE, chZones, { roughness: 0.3 }),
          ...plain([...TAIL, ...STAB], CH_BLACK, { roughness: 0.25 }),
          // The black sweeps over the lower rear of the nacelles and the pylons.
          ...paintAll(space, ['nacelle-l', 'nacelle-r'], WHITE, [
            { color: CH_BLACK, steps: [['line', [-1.9, 1.35], [-3.1, 2.55], -1]] },
          ]),
          ...plain(['pylon-l', 'pylon-r'], CH_BLACK, { roughness: 0.25 }),
        },
        markings: [...finTextMarks('fin-reg', 'reg-n418tx')],
      },
      {
        id: 'red-navy-pinstripes',
        label: 'White with red and navy pinstripes',
        provenance: {
          kind: 'inspired',
          note: 'Private scheme as photographed on N194ME: white overall with a red and a navy pinstripe from the nose to the tail cone, the red climbing the rudder root; a red band under a navy cap and navy tip fairing on the fin; navy registration on the fin. Registration N412MK is fictional. Stripe heights are approximate.',
          references: [references.n194me],
        },
        paints: {
          ...whiteJet,
          ...paintAll(space, BODY, WHITE, psZones),
          'fin-top': { color: PS_NAVY, metalness: 0.3, roughness: 0.3 },
        },
        markings: [
          ...bothSides('ps-aft', 'ps-aft'),
          ...finArt('ps-fin', 'ps-fin'),
          ...finTextMarks('fin-reg', 'reg-n412mk'),
        ],
      },
      {
        id: 'factory-red-black',
        label: 'Factory swooshes, red and black',
        provenance: {
          kind: 'inspired',
          note: 'Factory swoosh scheme as photographed on N22UB: white with a long red line from under the cockpit to the engine, tapered black spears under the cockpit and the cabin, a grey line above, black lines up the fin root and a red wedge over the rudder root; registration on the engine nacelles. Registration N27QW is fictional. Line shapes are redrawn and approximate.',
          references: [references.n22ub],
        },
        paints: whiteJet,
        markings: [
          ...bothSides('rb-body', 'rb-body'),
          ...bothSides('rb-cone', 'rb-fin'),
          ...bothSidesText('nacelle-reg', 'reg-n27qw'),
        ],
      },
      {
        id: 'factory-green',
        label: 'Factory swooshes, green',
        provenance: {
          kind: 'inspired',
          note: "The same factory swoosh design in greens, as photographed on Isle of Man registered M-FLYI: white with green and dark green lines along the body and up the fin root, registration on the engine nacelles. The operator's tail logo and titles are left off; registration M-ARQZ is fictional. Line shapes are approximate.",
          references: [references.mflyi],
        },
        paints: whiteJet,
        markings: [
          ...bothSides('gn-body', 'gn-body'),
          ...bothSides('gn-cone', 'gn-fin'),
          ...bothSidesText('nacelle-reg', 'reg-m-arqz'),
        ],
      },
    ],
  };
}
