/**
 * ATR 72-600 liveries. Military users carry their real national markings (the Italian Air
 * Force P-72A and the Turkish Navy TMPA maritime patrol aircraft); airline schemes reproduce
 * colours, cheatlines and tail patterns only, with no titles, logos or emblems. Civil
 * registrations are fictional in the right national format.
 *
 * The model's shell is one mesh per material: fuselage, wings, fin and tailplane share the ivory
 * slot, so paint zones bound the fin with |x| planes and the fuselage with heights. The body
 * axis is level at y 2.29 (half height 1.31); windows run y 2.36 to 2.75.
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

const P = 'ATR72';
export function slots() {
  const s = (materials, node) => ({ materials: materials.map((m) => `${P}-${m}`), node });
  return {
    shell: s(['ivory'], 'ATR72-shell'),
    nose: s(['ivory'], 'ATR72-nose'),
    'nacelle-l': s(['ivory'], 'ATR72-nacelle-0'),
    'nacelle-r': s(['ivory'], 'ATR72-nacelle-1'),
    'sponson-l': s(['ivory'], 'ATR72-sponson-1'),
    'sponson-r': s(['ivory'], 'ATR72-sponson--1'),
    'flap-l': s(['ivory'], 'ATR72-flap-1'),
    'flap-r': s(['ivory'], 'ATR72-flap--1'),
    'aileron-l': s(['ivory'], 'ATR72-aileron-1'),
    'aileron-r': s(['ivory'], 'ATR72-aileron--1'),
    'gear-door-0': s(['ivory'], 'ATR72-gear-0'),
    'gear-door-1': s(['ivory'], 'ATR72-gear-1'),
    'gear-door-2': s(['ivory'], 'ATR72-gear-2'),
    'tips-l': s(['ivory'], 'ATR72-propeller-0'),
    'tips-r': s(['ivory'], 'ATR72-propeller-1'),
    // The model's own accent parts: a stripe low on the fuselage, the rudder and the
    // elevators. Liveries repaint them to suit.
    stripe: s(['teal'], 'ATR72-shell'),
    rudder: s(['teal'], 'ATR72-rudder'),
    'elevator-l': s(['teal'], 'ATR72-elevator-1'),
    'elevator-r': s(['teal'], 'ATR72-elevator--1'),
  };
}

const HALF = 1.43;
// Every painted part of the airframe.
const BODY = ['shell', 'nose', 'stripe'];
const PARTS = [
  'nacelle-l',
  'nacelle-r',
  'sponson-l',
  'sponson-r',
  'flap-l',
  'flap-r',
  'aileron-l',
  'aileron-r',
  'gear-door-0',
  'gear-door-1',
  'gear-door-2',
];
const TAIL = ['rudder', 'elevator-l', 'elevator-r'];

export default function design({ kit: k, space }) {
  const anchors = {},
    graphics = {};
  /** Projectors for lettering on the fuselage sides: centre z, y; reads forward on each side. */
  const sideText = (name, slot, z, y, width, height, depth = 0.8, x = HALF) => {
    for (const s of [1, -1])
      anchors[`${name}-${s > 0 ? 'l' : 'r'}`] = space.anchor(slot, {
        center: [s * (x + 0.1 - depth / 2), y, z],
        facing: [s, 0, 0],
        width,
        height,
        depth,
      });
  };
  /** Wing projectors (left wing +X): upper or lower surface at span x, chord station z. */
  const wingMark = (name, x, z, y, size, facing) =>
    (anchors[name] = space.anchor('shell', {
      center: [x, y, z],
      facing: [0, facing, 0],
      up: [0, 0, 1],
      width: size,
      height: size,
      depth: 0.16,
    }));
  const tips = (color) => ({ 'tips-l': { color }, 'tips-r': { color } });
  const all = (color, extra = {}) => ({
    ...Object.fromEntries([...BODY, ...PARTS, ...TAIL].map((s) => [s, { color, ...extra }])),
  });

  /* ------------------------------------------------ Turkish Navy ATR 72-600 TMPA ---- */
  const TR_GRAY = '#97a4aa',
    TR_BLACK = '#17191b';
  // The naval aviation emblem: a black anchor on a pale disc ringed in dark grey (original
  // drawing: shank, stock, ring, flukes and a hanging chain).
  {
    const c = new k.Canvas(0.6, 0.6);
    const cx = 0.3,
      cy = 0.3;
    c.circle('#4d565b', cx, cy, 0.3);
    c.circle('#d9dcdb', cx, cy, 0.285);
    const ink = TR_BLACK;
    c.rect(ink, cx - 0.014, cy - 0.17, 0.028, 0.33); // shank
    c.rect(ink, cx - 0.085, cy + 0.11, 0.17, 0.026); // stock
    c.ring(ink, cx, cy + 0.19, 0.014, 0.03, 24); // ring
    // Arms: an arc below the shank ending in flukes.
    const arm = [];
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI + (i * Math.PI) / 16;
      arm.push([cx + Math.cos(a) * 0.15, cy - 0.06 + Math.sin(a) * 0.12]);
    }
    const inner = arm.map(([x, y]) => [cx + (x - cx) * 0.83, cy - 0.06 + (y - cy + 0.06) * 0.78]);
    c.add(ink, [...arm, ...inner.reverse()]);
    for (const side of [-1, 1])
      c.add(ink, [
        [cx + side * 0.15, cy - 0.06],
        [cx + side * 0.2, cy - 0.01],
        [cx + side * 0.13, cy - 0.04],
      ]);
    // The chain: links down the shank's right side to the stock.
    for (let i = 0; i < 6; i++)
      c.ring(ink, cx + 0.035 + Math.sin(i * 0.9) * 0.012, cy + 0.08 - i * 0.04, 0.006, 0.014, 12);
    graphics['tr-anchor'] = c.graphic('Turkish naval aviation anchor');
  }
  sideText('tr-emblem', 'nose', 11.05, 1.95, 0.6, 0.6, 0.8, 1.32);
  graphics['tr-number'] = lettering(k, '752', 0.72, 0.3, TR_BLACK, {
    face: 'technical',
    scale: 0.92,
  });
  sideText('tr-number', 'nose', 11.72, 1.93, 0.72, 0.3, 0.7, 1.2);
  // A tall canvas leaves room for the Ü and İ marks above the 0.19 m capitals.
  graphics['tr-titles'] = lettering(k, 'TÜRK DENİZ KUVVETLERİ', 3.0, 0.34, TR_BLACK, {
    face: 'technical',
    scale: 0.56,
    y: 0.15,
  });
  sideText('tr-titles', 'shell', 0.9, 1.94, 3.0, 0.34, 0.8, 1.38);
  graphics['tr-roundel'] = k
    .roundel(new k.Canvas(1.1, 1.1), 0.55, 0.55, 0.54, k.ROUNDELS.turkey, [0.18, 0.46, 0.36])
    .graphic('Turkish roundel');
  wingMark('wing-lower-l', 8.8, 1.3, 3.56, 1.1, -1);
  wingMark('wing-lower-r', -8.8, 1.3, 3.56, 1.1, -1);
  wingMark('wing-upper-l', 8.8, 1.3, 3.77, 1.1, 1);
  wingMark('wing-upper-r', -8.8, 1.3, 3.77, 1.1, 1);
  // Propeller danger line: a red bar on the fuselage in the plane of the blades.
  graphics['prop-line'] = (() => {
    const c = new k.Canvas(0.5, 1.5);
    c.rect('#c8281e', 0.2, 0, 0.1, 1.5);
    c.text('#c8281e', 'DANGER', {
      x: 0.08,
      y: 0.95,
      height: 0.06,
      face: 'technical',
      align: 'center',
    });
    return c.graphic('Propeller danger line');
  })();
  sideText('prop-line', 'shell', 4.5, 2.3, 0.5, 1.5, 0.9);

  /* ------------------------------------------------ Italian Air Force P-72A ---- */
  const IT_GRAY = '#495056',
    IT_LIGHT = '#a7adb1',
    IT_DARK = '#40464b';
  graphics['it-code'] = lettering(k, '41-02', 1.0, 0.3, IT_LIGHT, {
    face: 'technical',
    scale: 0.92,
  });
  sideText('it-code', 'nose', 10.75, 2.02, 1.0, 0.3, 0.8, 1.38);
  graphics['it-titles'] = lettering(k, 'AERONAUTICA MILITARE', 3.4, 0.24, IT_DARK, {
    face: 'technical',
    scale: 0.8,
  });
  sideText('it-titles', 'shell', -2.4, 1.9, 3.4, 0.24, 0.8, 1.38);

  /* ------------------------------------------------ airline schemes: shared helpers ---- */
  /**
   * Side-view art over several slots: the shell (fuselage, dorsal and fin), the rudder, the
   * nose, and the model's own low accent stripe, which stands just off the skin.
   */
  const shellSide = (name, box, slots = ['shell', 'rudder', 'stripe']) => {
    for (const slot of slots)
      Object.assign(
        anchors,
        sideAnchors(space, slot, `${name}-${slot}`, box, {
          outer: slot === 'rudder' ? 0.3 : HALF + 0.12,
        }),
      );
  };
  const shellArt = (name, graphic, slots = ['shell', 'rudder', 'stripe']) =>
    slots.flatMap((slot) => bothSides(`${name}-${slot}`, graphic));
  const WHITE = '#eceeec';
  const whiteAll = (extra = {}) => ({ ...all(WHITE, extra), ...tips('#e6b61c') });

  /* ------------------------------------------------ FedEx Feeder ---- */
  // White, with the fin, rudder, tailplane and the rear body behind a curve from the belly to
  // the fin's leading edge in purple.
  const FX_PURPLE = '#4d148c';
  const fxEdge = [
    [-6.0, 1.0],
    [-6.35, 2.3],
    [-7.2, 3.6],
    [-8.2, 4.6],
  ];
  const fxZones = [
    {
      color: FX_PURPLE,
      steps: fxEdge.slice(0, -1).map((p, i) => ['line', p, fxEdge[i + 1], -1]),
    },
    {
      color: FX_PURPLE,
      steps: [
        ['above', 6.8],
        ['behind', -10.0],
      ],
    },
  ];
  graphics['reg-ei-hqk'] = lettering(k, 'EI-HQK', 1.5, 0.3, '#f4f4f4', {
    face: 'technical',
    scale: 0.82,
  });
  sideText('reg-cone', 'shell', -10.0, 2.95, 1.5, 0.3, 1.0, 1.05);

  /* ------------------------------------------------ Binter Canarias ---- */
  // White; aft of the wing a dark green band under the windows, a blue pinline and a lime lower
  // body sweep up the tail cone and across the fin, with a lime stripe at the fin top; forward
  // they dip under the wing to a dark green keel line; a lime crescent wraps the nose.
  const BN_LIME = '#8cc63f',
    BN_GREEN = '#2e9645',
    BN_BLUE = '#3d8fd8';
  {
    const box = { aft: -13.65, fore: 1.0, low: 0.9, high: 7.7 };
    const v = sideCanvas(k, box);
    // The stripes' common climb: level under the cabin, rising up and back across the fin.
    const rise = (z) => (z >= -4.5 ? 0 : 0.165 * (-4.5 - z) ** 1.62);
    // Forward of z -1 the bands dip toward the keel under the wing.
    const dip = (z) => (z <= -1 ? 0 : 0.9 * ((z + 1) / 2) ** 1.5);
    const at = (h) => (z) => h + rise(z) - dip(z);
    v.band(BN_LIME, at(1.72), () => 0.9, -13.65, 0.2, 60);
    v.band(BN_BLUE, at(1.9), at(1.84), -13.65, 1.0, 60);
    v.band(BN_GREEN, at(2.3), at(1.99), -13.65, 1.0, 60);
    // The fin-top lime stripe, above the green with a white gap.
    v.band(BN_LIME, at(2.95), at(2.55), -13.65, -9.2, 30);
    graphics['bn-aft'] = v.graphic('Binter tail sweep');
    shellSide('bn-aft', box);
  }
  {
    // Forward: the dark green keel line from under the wing to the nose, and the nose crescent.
    const box = { aft: 0.8, fore: 13.65, low: 0.9, high: 2.9 };
    const v = sideCanvas(k, box);
    const keel = spline([
      [0.8, 1.2],
      [3.0, 1.12],
      [9.0, 1.12],
      [11.5, 1.22],
      [12.6, 1.4],
      [13.4, 1.68],
    ]);
    v.band(
      BN_GREEN,
      (z) => keel(z) + 0.08,
      () => 0.9,
      0.8,
      13.4,
      48,
    );
    const top = spline([
      [10.6, 2.12],
      [11.6, 2.55],
      [12.4, 2.5],
      [13.0, 2.25],
      [13.6, 1.95],
    ]);
    const bottom = spline([
      [10.6, 2.08],
      [11.6, 2.3],
      [12.4, 2.14],
      [13.0, 1.95],
      [13.6, 1.86],
    ]);
    v.band(BN_LIME, top, bottom, 10.6, 13.6, 30);
    graphics['bn-fore'] = v.graphic('Binter keel line and nose crescent');
    shellSide('bn-fore', box, ['shell', 'nose', 'stripe']);
  }
  graphics['reg-ec-nzq'] = lettering(k, 'EC-NZQ', 1.4, 0.3, '#1b1d1f', {
    face: 'technical',
    scale: 0.82,
  });
  sideText('reg-high', 'shell', -5.9, 3.3, 1.4, 0.3, 1.0, 1.3);

  /* ------------------------------------------------ Azul ---- */
  // White over a navy lower body behind a bright blue pinline, sweeping down under the nose;
  // navy fin, tailplane, nacelles and sponsons.
  const AZ_NAVY = '#16285c',
    AZ_BLUE = '#2f6fd1';
  const azBreak = 2.1;
  const azZones = [
    {
      color: AZ_NAVY,
      steps: [
        ['below', azBreak - 0.03],
        ['behind', 10.2],
      ],
    },
    {
      color: AZ_BLUE,
      steps: [
        ['below', azBreak + 0.03],
        ['above', azBreak - 0.03],
        ['behind', 10.2],
      ],
    },
    // The fin, dorsal fillet and tailplane.
    {
      color: AZ_NAVY,
      steps: [
        ['above', 3.72],
        ['behind', -5.4],
        ['left', -0.4],
        ['right', -0.4],
      ],
    },
    {
      color: AZ_NAVY,
      steps: [
        ['above', 6.8],
        ['behind', -10.0],
      ],
    },
  ];
  {
    // Under the nose the break sweeps down to the chin.
    const box = { aft: 9.6, fore: 13.65, low: 0.9, high: 2.4 };
    const v = sideCanvas(k, box);
    const edge = spline([
      [9.6, azBreak],
      [10.6, azBreak - 0.04],
      [11.6, 1.85],
      [12.6, 1.45],
      [13.3, 1.5],
    ]);
    v.band(
      AZ_NAVY,
      (z) => edge(z) - 0.03,
      () => 0.9,
      9.6,
      13.3,
      40,
    );
    v.band(
      AZ_BLUE,
      (z) => edge(z) + 0.03,
      (z) => edge(z) - 0.03,
      9.6,
      13.35,
      40,
    );
    graphics['az-nose'] = v.graphic('Azul chin sweep');
    shellSide('az-fore', box, ['shell', 'nose']);
  }
  graphics['reg-pr-atq'] = lettering(k, 'PR-ATQ', 1.5, 0.3, '#f2f3f4', {
    face: 'technical',
    scale: 0.82,
  });
  sideText('reg-low', 'shell', -3.2, 1.62, 1.5, 0.3, 0.9, 1.42);

  const references = {
    tmpa1: {
      title: 'ATR C-72-600TMPA Turkish Navy, Teknofest 2021 (1), nose (CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:ATR_C-72-600TMPA_TurkishNavy_Teknofest2021_(1).jpg',
    },
    tmpa2: {
      title: 'ATR C-72-600TMPA Turkish Navy, Teknofest 2021 (2), left side (CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:ATR_C-72-600TMPA_TurkishNavy_Teknofest2021_(2).jpg',
    },
    p72a: {
      title: 'ATR 72 MPA (P-72A) 41-02, Aeronautica Militare, Farnborough (CC BY 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:EGLF_-_ATR_72_MPA_-_Aeronautica_Militare_-_41-02_(44058760001).jpg',
    },
    fedex: {
      title: 'ASL Airlines Ireland FedEx Feeder ATR 72-600F EI-HAF, Hannover (CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Hannover_Airport_ASL_Airlines_Ireland_FedEx_Feeder_ATR_72-600F_EI-HAF_(DSC08928).jpg',
    },
    binter: {
      title: 'Binter Canarias ATR 72-600 EC-MXQ at Tenerife South, January 2019 (CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Binter_Canarias_ATR_72-600_(EC-MXQ)_@_TFS,_Jan_2019.jpg',
    },
    azul: {
      title: 'Azul ATR 72-600 at Maringá, November 2016 (CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Azul_ATR_72%E2%80%93600_MGF_11_2016_3561.jpg',
    },
  };

  return {
    selected: 'turkish-navy-tmpa',
    anchors,
    graphics,
    variants: [
      {
        id: 'turkish-navy-tmpa',
        label: 'Turkish Navy ATR 72-600 TMPA',
        provenance: {
          kind: 'inspired',
          note: 'Turkish Naval Forces maritime patrol ATR 72-600 (TMPA) as photographed at Teknofest 2021: blue-grey overall, black TÜRK DENİZ KUVVETLERİ titles over the main gear, the naval anchor emblem and side number 752 on the nose, red-white-red roundels under the wings, yellow propeller tips and the red propeller danger line (original vector drawings). Upper wing roundels are assumed; the mission radome, sensor turret, observation bubbles and the red nose panel outline are not modelled. Colours are approximate.',
          references: [references.tmpa1, references.tmpa2],
        },
        paints: { ...all(TR_GRAY, { roughness: 0.62 }), ...tips('#e8b81a') },
        markings: [
          ...bothSidesText('tr-emblem', 'tr-anchor'),
          ...bothSidesText('tr-number', 'tr-number'),
          ...bothSidesText('tr-titles', 'tr-titles'),
          ...bothSidesText('prop-line', 'prop-line'),
          { anchor: 'wing-lower-l', graphic: 'tr-roundel' },
          { anchor: 'wing-lower-r', graphic: 'tr-roundel' },
          { anchor: 'wing-upper-l', graphic: 'tr-roundel' },
          { anchor: 'wing-upper-r', graphic: 'tr-roundel' },
        ],
      },
      {
        id: 'italian-air-force-p72a',
        label: 'Italian Air Force P-72A, 41° Stormo',
        provenance: {
          kind: 'inspired',
          note: 'Aeronautica Militare P-72A maritime patrol aircraft 41-02 of the 41st Wing as photographed at Farnborough: dark grey overall with the 41-02 code in light grey on the nose, low-visibility AERONAUTICA MILITARE titles aft of the wing and yellow propeller tips (original vector lettering). National insignia are not visible in the reference and are left off; the wing badge, mission sensors and stencils are omitted. Colours are approximate.',
          references: [references.p72a],
        },
        paints: { ...all(IT_GRAY, { roughness: 0.7 }), ...tips('#e3b51c') },
        markings: [
          ...bothSidesText('it-code', 'it-code'),
          ...bothSidesText('it-titles', 'it-titles'),
          ...bothSidesText('prop-line', 'prop-line'),
        ],
      },
      {
        id: 'white-purple-tail-freighter',
        label: 'White freighter, purple tail',
        provenance: {
          kind: 'inspired',
          note: 'FedEx Feeder scheme as photographed on ATR 72-600F EI-HAF: white fuselage, wings and nacelles; purple fin, rudder, tailplane and rear body behind a curve from the belly aft of the wing up to the fin leading edge, white registration on the purple. The FedEx and Feeder titles, the Irish flag and the freighter cargo door outline are left off; registration EI-HQK is fictional. The curve is approximated by straight cuts.',
          references: [references.fedex],
        },
        paints: {
          ...whiteAll(),
          ...paintAll(space, BODY, WHITE, fxZones),
          ...Object.fromEntries(TAIL.map((s) => [s, { color: FX_PURPLE }])),
        },
        markings: [...bothSidesText('reg-cone', 'reg-ei-hqk')],
      },
      {
        id: 'white-green-lime-sweep',
        label: 'White with green and lime sweep',
        provenance: {
          kind: 'inspired',
          note: 'Binter Canarias scheme as photographed on EC-MXQ: white with a dark green band under the windows, a blue pinline and a lime lower body sweeping up the tail cone and across the fin, a lime stripe at the fin top, a dark green keel line forward, dark green sponsons and a lime crescent on the nose. Titles, the web address, the aircraft name and the flags are left off; registration EC-NZQ is fictional. Curves are redrawn and approximate.',
          references: [references.binter],
        },
        paints: {
          ...whiteAll(),
          // The keel under the side art: dark green forward of the wing, lime aft of it.
          ...paintAll(space, ['shell', 'nose', 'stripe'], WHITE, [
            {
              color: BN_GREEN,
              steps: [
                ['below', 1.08],
                ['ahead', 0.0],
                ['behind', 12.6],
              ],
            },
            {
              color: BN_LIME,
              steps: [
                ['line', [-4.0, 1.2], [-13.6, 3.0], -1],
                ['behind', 0.0],
              ],
            },
          ]),
          'sponson-l': { color: BN_GREEN },
          'sponson-r': { color: BN_GREEN },
        },
        markings: [
          ...shellArt('bn-aft', 'bn-aft'),
          ...shellArt('bn-fore', 'bn-fore', ['shell', 'nose', 'stripe']),
          ...bothSidesText('reg-high', 'reg-ec-nzq'),
        ],
      },
      {
        id: 'white-over-navy-pinline',
        label: 'White over navy, blue pinline',
        provenance: {
          kind: 'inspired',
          note: 'Azul scheme as photographed at Maringá: white over a navy lower body behind a bright blue pinline that sweeps down under the nose, navy fin, dorsal, tailplane, nacelles and sponsons, white registration on the navy aft. The Azul titles, the dotted tail emblem, nacelle titles and aircraft name are left off; registration PR-ATQ is fictional. The break height is estimated from an oblique photograph.',
          references: [references.azul],
        },
        paints: {
          ...whiteAll(),
          ...paintAll(space, ['shell', 'stripe'], WHITE, azZones),
          ...paintAll(space, ['nose'], WHITE, [
            {
              color: AZ_NAVY,
              steps: [
                ['below', 1.3],
                ['behind', 12.3],
              ],
            },
          ]),
          ...Object.fromEntries(
            [
              ...TAIL,
              'nacelle-l',
              'nacelle-r',
              'sponson-l',
              'sponson-r',
              'gear-door-0',
              'gear-door-1',
              'gear-door-2',
            ].map((s) => [s, { color: AZ_NAVY }]),
          ),
        },
        markings: [
          ...shellArt('az-fore', 'az-nose', ['shell', 'nose']),
          ...bothSidesText('reg-low', 'reg-pr-atq'),
        ],
      },
    ],
  };
}
