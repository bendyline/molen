/**
 * Robinson R44 Raven II liveries: Philippine Army and Peruvian Army trainers, a South African
 * Police Service patrol R44 and civil tour and private schemes, each studied from a photograph.
 * Military serials, national flags and service titles are shown; civil operators keep their
 * colors and layout with fictional registrations and no names or emblems. All lettering is set in
 * real type and every emblem is an original vector drawing.
 */
import { both, flag, lettering, P, pair, scheme } from '../art-helicopters-a.mjs';

export function slots() {
  return {
    // Cabin, mast pylon, fin, stabilizer and skid cross tubes.
    shell: { materials: ['R44-ivory'], node: 'R44-shell-R44-ivory' },
    // The belt-line pinstripe and the tail boom.
    accent: { materials: ['R44-deep-blue'], node: 'R44-shell-R44-deep-blue' },
    // Window gaskets, bubble frame and skid tubes.
    trim: { materials: ['R44-trim'], node: 'R44-shell-R44-trim' },
  };
}

// Boom loft stations (z, half width, centre height, half height) from the R44 builder.
const BOOM = [
  [-0.625, 0.2648, 1.6215, 0.193],
  [-1.8, 0.2, 1.64, 0.23],
  [-4.0, 0.1, 1.9, 0.14],
  [-5.85, 0.062, 2.03, 0.072],
];
function boomAt(z) {
  for (let i = 0; i < BOOM.length - 1; i++) {
    const a = BOOM[i],
      b = BOOM[i + 1];
    if (z <= a[0] && z >= b[0]) {
      const u = (a[0] - z) / (a[0] - b[0]);
      return [1, 2, 3].map((k) => a[k] + (b[k] - a[k]) * u);
    }
  }
  throw new Error(`R44 boom station ${z} out of range`);
}

const BLACK = '#17191b',
  WHITE = '#f2f1ec';

export default function design({ kit: k, space }) {
  const anchors = {};
  // Lettering along the boom, its baseline following the boom's rise toward the tail.
  const boomAnchor = (name, z, width, height) =>
    Object.assign(
      anchors,
      pair(space, name, (side) => {
        const [w, y] = boomAt(z),
          [, y0] = boomAt(z + 0.5),
          [, y1] = boomAt(z - 0.5),
          slope = (y1 - y0) / 1;
        const up = [0, 1, slope];
        return {
          slot: 'accent',
          center: [side * w, y, z],
          up,
          width,
          height,
          depth: Math.min(0.5, w * 2.2),
        };
      }),
    );
  boomAnchor('boom-reg', -2.55, 1.7, 0.3);
  boomAnchor('boom-title', -2.9, 0.9, 0.18);
  boomAnchor('boom-wings', -2.05, 0.42, 0.2);
  // Cabin side panels: the engine-bay panel behind the rear door, under the belt line.
  Object.assign(
    anchors,
    pair(space, 'cabin-low', (side) => ({
      slot: 'shell',
      center: [side * 0.58, 0.78, -0.47],
      width: 0.9,
      height: 0.22,
      depth: 0.6,
    })),
    pair(space, 'cabin-reg', (side) => ({
      slot: 'shell',
      center: [side * 0.56, 1.22, -0.72],
      width: 0.95,
      height: 0.22,
      depth: 0.6,
    })),
    // Mast pylon sides lean in about 4 degrees.
    pair(space, 'pylon', (side) => ({
      slot: 'shell',
      center: [side * 0.12, 2.28, -0.08],
      facing: [side, 0.07, 0],
      width: 0.34,
      height: 0.18,
      depth: 0.16,
    })),
    // Upper fin: the flag near the tip, a serial below it.
    pair(space, 'fin-flag', (side) => ({
      slot: 'shell',
      center: [side * 0.03, 2.72, -6.05],
      width: 0.2,
      height: 0.133,
      depth: 0.05,
    })),
    // A 2:1 flag (the Philippines).
    pair(space, 'fin-flag-2', (side) => ({
      slot: 'shell',
      center: [side * 0.03, 2.72, -6.05],
      width: 0.2,
      height: 0.1,
      depth: 0.05,
    })),
    pair(space, 'fin-serial', (side) => ({
      slot: 'shell',
      center: [side * 0.03, 2.3, -5.93],
      width: 0.3,
      height: 0.09,
      depth: 0.05,
    })),
    pair(space, 'fin-badge', (side) => ({
      slot: 'shell',
      center: [side * 0.03, 2.53, -5.99],
      width: 0.14,
      height: 0.14,
      depth: 0.05,
    })),
  );

  // National flags and an Army Aviation wings emblem, drawn as plain vector shapes.
  const philippineFlag = (() => {
    const w = 0.2,
      h = 0.1,
      c = new k.Canvas(w, h);
    c.rect('#0038a8', 0, h / 2, w, h / 2);
    c.rect('#ce1126', 0, 0, w, h / 2);
    c.add(WHITE, [
      [0, 0],
      [h * 0.866, h / 2],
      [0, h],
    ]);
    const sun = [h * 0.29, h / 2];
    c.star('#fcd116', sun[0], sun[1], h * 0.13, h * 0.06, 8);
    for (const [x, y] of [
      [0.06, 0.88],
      [0.06, 0.12],
      [0.72, 0.5],
    ])
      c.star('#fcd116', x * h, y * h, h * 0.045, h * 0.018);
    return c.graphic('Philippine flag');
  })();
  const southAfricaFlag = (() => {
    const w = 0.2,
      h = 0.133,
      c = new k.Canvas(w, h);
    c.rect('#e03c31', 0, h / 2, w, h / 2);
    c.rect('#001489', 0, 0, w, h / 2);
    // White-edged green pall with the black triangle at the hoist, edged in gold.
    const band = h * 0.2,
      edge = h * 0.067;
    const pall = (half) => [
      [0, h / 2 + h / 2 + half * 1.2],
      [w * 0.38, h / 2 + half],
      [w, h / 2 + half],
      [w, h / 2 - half],
      [w * 0.38, h / 2 - half],
      [0, -half * 1.2],
    ];
    c.add(WHITE, pall(band / 2 + edge));
    c.add('#007749', pall(band / 2));
    c.add('#ffb81c', [
      [0, h * 0.83],
      [w * 0.34, h / 2],
      [0, h * 0.17],
    ]);
    c.add('#000000', [
      [0, h * 0.75],
      [w * 0.28, h / 2],
      [0, h * 0.25],
    ]);
    return c.graphic('South African flag');
  })();
  const peruFlag = flag(k, 0.2, 0.133, ['#d91023', WHITE, '#d91023'], { vertical: true }).graphic(
    'Peruvian flag',
  );
  const armyWings = (() => {
    const w = 0.42,
      h = 0.2,
      c = new k.Canvas(w, h);
    // Swept wings either side of a round badge.
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const y = h * (0.62 - i * 0.12),
          len = w * (0.36 - i * 0.06);
        c.add(BLACK, [
          [w / 2 + s * h * 0.28, y],
          [w / 2 + s * (h * 0.28 + len), y + h * 0.1],
          [w / 2 + s * (h * 0.28 + len * 0.92), y + h * 0.03],
          [w / 2 + s * h * 0.28, y - h * 0.06],
        ]);
      }
    }
    c.circle(BLACK, w / 2, h / 2, h * 0.3, 32);
    c.circle('#a9adb0', w / 2, h / 2, h * 0.22, 32);
    c.star(BLACK, w / 2, h / 2, h * 0.16, h * 0.07);
    return c.graphic('Army aviation wings');
  })();
  const graphics = {
    'flag-ph': philippineFlag,
    'flag-za': southAfricaFlag,
    'flag-pe': peruFlag,
    'army-wings': armyWings,
  };
  const exterior = ['shell', 'accent'];
  // The builder's pinstripe is the only accent paint below 1.3 m; the boom sits above it.
  const stripe = (color) => ({ color, planes: [P.below(1.3)], only: ['accent'] });
  const skids = (color) => ({ trim: { color: '#22282c', zones: skidZone(color) } });
  const skidZone = (color) => [
    {
      color,
      planes: [space.plane('trim', [0, -1, 0], [0, 0.25, 0])],
    },
  ];

  const references = {
    pa: {
      title: 'Philippine Army Robinson R44 trainer 202 at Clark, 2022 (public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:2022-06-17_PA_R44_001.jpg',
    },
    peru: {
      title: 'Peruvian Army R44 Raven I EP-913 (CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:R44_Raven_I,_Ej%C3%A9rcito_del_Per%C3%BA.jpg',
    },
    saps: {
      title: 'South African Police Service Robinson R44 II ZS-RIC (CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:South_African_Police_Robinson_R44_II_ZS-RIC_(31234626902).jpg',
    },
    black: {
      title: 'Black Robinson R44 — Łukasz Golowanow (Attribution)',
      url: 'https://commons.wikimedia.org/wiki/File:Black_Robinson_R44.jpg',
    },
    alaska: {
      title:
        'Helicóptero Robinson R44, Portage, Alaska, Estados Unidos, 2017-08-22, DD 43.jpg — Diego Delso (CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Helic%C3%B3ptero_Robinson_R44,_Portage,_Alaska,_Estados_Unidos,_2017-08-22,_DD_43.jpg',
    },
  };

  const PA_SILVER = '#a9adb0',
    PERU_GREEN = '#123430',
    SAPS_NAVY = '#1d2f6e',
    SAPS_BLUE = '#2d55a5',
    GLOSS_BLACK = '#121315',
    GOLD = '#c9a24a';

  graphics['pa-202'] = lettering(k, '202', 0.34, 0.18, BLACK);
  graphics['pa-army'] = lettering(k, 'ARMY', 0.9, 0.18, BLACK, { capHeight: 0.13 });
  graphics['pa-serial'] = lettering(k, '13982', 0.3, 0.09, BLACK, { capHeight: 0.065 });
  graphics['pe-serial'] = lettering(k, 'EP-913', 1.7, 0.3, WHITE, { capHeight: 0.25 });
  graphics['za-reg'] = lettering(k, 'ZS-RJP', 1.7, 0.3, SAPS_BLUE, {
    capHeight: 0.14,
    slant: 0.18,
  });
  graphics['za-police'] = lettering(k, 'POLICE', 0.9, 0.22, SAPS_NAVY, {
    capHeight: 0.14,
    tracking: 0.08,
  });
  graphics['black-reg'] = lettering(k, 'N447BK', 1.7, 0.3, '#d2462c', { capHeight: 0.16 });
  graphics['alaska-reg'] = lettering(k, 'N7428A', 1.7, 0.3, WHITE, {
    capHeight: 0.2,
    slant: 0.14,
  });
  // A second, white pinstripe 1.5 cm above the builder's belt-line stripe, following its rise
  // toward the nose in three straight runs.
  const beltLine = [
    [2.05, 0.79],
    [1.2, 0.89],
    [0.35, 0.93],
    [-1.8, 0.95],
  ];
  const upperPinstripe = (color) =>
    beltLine.slice(1).map((b, i) => {
      const a = beltLine[i],
        lift = (q, dy) => [q[0], q[1] + dy];
      return {
        color,
        planes: [
          P.line(lift(a, 0.06), lift(b, 0.06), 1),
          P.line(lift(a, 0.08), lift(b, 0.08), -1),
          P.behind(i ? a[0] : 2.1),
          P.ahead(b[0]),
        ],
        only: ['shell'],
      };
    });

  return {
    selected: 'philippine-army-202',
    anchors,
    graphics,
    variants: [
      {
        id: 'philippine-army-202',
        label: 'Philippine Army trainer 202',
        provenance: {
          kind: 'photo',
          note: 'Philippine Army R44 training helicopter 202 from the referenced 2022 photograph: metallic silver-grey overall with a grey belt-line stripe, large black 202 on the mast pylon, ARMY on the tail boom behind an aviation wings badge (an original simplified drawing of the unit badge), the Philippine flag and serial 13982 on the fin. The round unit seal on the fin and small stencils are omitted. Colors are approximate.',
          references: [references.pa],
        },
        paints: scheme(space, exterior, PA_SILVER, [stripe('#8f9497')], {
          roughness: 0.38,
          metalness: 0.3,
        }),
        markings: [
          ...both('pylon', 'pa-202'),
          ...both('boom-title', 'pa-army'),
          ...both('boom-wings', 'army-wings'),
          ...both('fin-flag-2', 'flag-ph', true),
          ...both('fin-serial', 'pa-serial'),
        ],
      },
      {
        id: 'peruvian-army-ep-913',
        label: 'Peruvian Army EP-913',
        provenance: {
          kind: 'photo',
          note: 'Peruvian Army (Ejército del Perú) R44 Raven I EP-913 from the referenced photograph, applied to the Raven II model: very dark green overall with a white belt-line pinstripe, the serial EP-913 in large white letters on the boom and the Peruvian flag on the fin. The R44 Raven I title, DANGER stencils and crew placards are omitted. Colors are approximate.',
          references: [references.peru],
        },
        paints: scheme(space, exterior, PERU_GREEN, [stripe(WHITE)], { roughness: 0.3 }),
        markings: [...both('boom-reg', 'pe-serial'), ...both('fin-flag', 'flag-pe')],
      },
      {
        id: 'south-african-police',
        label: 'South African Police Service',
        provenance: {
          kind: 'inspired',
          note: 'South African Police Service R44 II from the referenced photograph: white overall with a blue belt-line pinstripe, POLICE in navy on the rear cabin, the registration in blue italic capitals on the boom and the South African flag on the fin. The registration is fictional (ZS-RJP; the photographed aircraft is ZS-RIC) and the service star badge on the pylon is omitted. Colors are approximate.',
          references: [references.saps],
        },
        paints: {
          ...scheme(space, exterior, WHITE, [stripe(SAPS_BLUE)], { roughness: 0.35 }),
          ...skids('#1c2433'),
        },
        markings: [
          ...both('cabin-low', 'za-police'),
          ...both('boom-reg', 'za-reg'),
          ...both('fin-flag', 'flag-za', true),
        ],
      },
      {
        id: 'black-r44',
        label: 'Black and gold private R44',
        provenance: {
          kind: 'inspired',
          note: 'Privately owned R44 from the referenced photograph: gloss black overall with two thin gold pinstripes sweeping up the rear cabin toward the boom and the registration in orange-red on the boom. The registration is fictional (N447BK) and the stripe curve is simplified to two straight sloping lines. Colors are approximate.',
          references: [references.black],
        },
        paints: scheme(
          space,
          exterior,
          GLOSS_BLACK,
          [
            stripe(GLOSS_BLACK),
            {
              color: GOLD,
              planes: [
                P.line([1.2, 0.74], [-1.6, 1.36], 1),
                P.line([1.2, 0.775], [-1.6, 1.395], -1),
                P.behind(1.0),
                P.ahead(-1.9),
              ],
              only: ['shell'],
            },
            {
              color: GOLD,
              planes: [
                P.line([0.7, 0.7], [-1.6, 1.26], 1),
                P.line([0.7, 0.728], [-1.6, 1.288], -1),
                P.behind(0.55),
                P.ahead(-1.9),
              ],
              only: ['shell'],
            },
          ],
          { roughness: 0.22 },
        ),
        markings: [...both('boom-reg', 'black-reg')],
      },
      {
        id: 'alaska-red-and-cream',
        label: 'Alaska tour red',
        provenance: {
          kind: 'inspired',
          note: 'Alaska flightseeing R44 from the referenced Portage photograph: bright red overall with a cream belt-line pinstripe and a thin white one above it, black skids and the registration in large white italic capitals on the boom. The registration is fictional (N7428A; the photographed aircraft is N99605); the operator name on the pylon and the web address on the cabin are omitted. Colors are approximate.',
          references: [references.alaska],
        },
        paints: scheme(space, exterior, '#c41b20', [stripe('#efe3c0'), ...upperPinstripe(WHITE)], {
          roughness: 0.28,
        }),
        markings: [...both('boom-reg', 'alaska-reg')],
      },
    ],
  };
}
