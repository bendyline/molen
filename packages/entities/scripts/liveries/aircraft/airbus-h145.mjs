/**
 * Airbus H145 D3 liveries: German state police blue and silver, German and Norwegian air
 * rescue, French civil protection, the Luftwaffe's H145M and the US Army's UH-72 Lakota, each
 * studied from a photograph. Military insignia, titles and serials are shown; civil operators
 * keep their colors and layout with fictional registrations, plain functional words only
 * (POLIZEI, NOTARZT) and no operator names or logos. Lettering is real type and every emblem is
 * an original vector drawing.
 */
import {
  both,
  flag,
  lettering,
  P,
  pair,
  scheme,
  sideAnchors,
  sideArt,
} from '../art-helicopters-a.mjs';

export function slots() {
  return {
    // Cabin skin and the horizontal stabilizer.
    shell: { materials: ['H145-white'], node: 'H145-airframe-H145-white' },
    // Lower-side band, engine cowlings, boom, Fenestron shroud and stabilizer endplates.
    accent: { materials: ['H145-blue'], node: 'H145-airframe-H145-blue' },
    // The main rotor's hub cap.
    hub: { materials: ['H145-blue'], node: 'H145-five-blade-head' },
  };
}

// Boom loft stations (z, half width, centre height, half height) from the H145 builder.
const BOOM = [
  [-2.4, 0.31, 2.1, 0.28],
  [-4.3, 0.19, 2.1, 0.22],
  [-5.8, 0.16, 2.09, 0.19],
  [-6.4, 0.14, 2.1, 0.15],
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
  throw new Error(`H145 boom station ${z} out of range`);
}
/** Half thickness of the Fenestron shroud at height y (builder: 0.2 m, thinning above 2.75 m). */
const shroudHalf = (y) => (y <= 2.75 ? 0.2 : 0.2 - (0.08 * (y - 2.75)) / 1.25);

const WHITE = '#f3f3ef';

export default function design({ kit: k, space }) {
  const exterior = ['shell', 'accent'];
  const anchors = {};
  const add = (...more) => Object.assign(anchors, ...more);
  const boomAnchor = (name, z, y, width, height) => {
    const [w] = boomAt(z);
    add(
      pair(space, name, (side) => ({
        slot: 'accent',
        center: [side * w, y, z],
        width,
        height,
        depth: Math.min(0.5, w * 1.6),
      })),
    );
  };
  // Shroud faces lean in as it thins upward.
  const shroudAnchor = (name, z, y, width, height) =>
    add(
      pair(space, name, (side) => ({
        slot: 'accent',
        center: [side * shroudHalf(y), y, z],
        facing: [side, 0.064, 0],
        width,
        height,
        depth: 0.16,
      })),
    );
  const cabinAnchor = (name, z, y, width, height, slot = 'shell') =>
    add(
      pair(space, name, (side) => ({
        slot,
        center: [side * 0.86, y, z],
        width,
        height,
        depth: 0.6,
      })),
    );
  boomAnchor('boom-title', -3.55, 2.1, 1.5, 0.3);
  shroudAnchor('fin-top', -7.42, 3.73, 0.7, 0.2);
  shroudAnchor('fin-flag', -7.92, 3.73, 0.16, 0.096);
  shroudAnchor('fin-mid', -7.55, 3.2, 0.95, 0.4);
  cabinAnchor('door-low', 0.95, 1.1, 1.3, 0.3);
  cabinAnchor('door-high', 1.12, 1.3, 1.0, 0.36);
  // Cowling flank above the cabin roof (it leans in toward the crown).
  const cowlAnchor = (name, z, y, width, height) =>
    add(
      pair(space, name, (side) => ({
        slot: 'accent',
        center: [side * 0.62, y, z],
        facing: [side, 0.15, 0],
        width,
        height,
        depth: 0.3,
      })),
    );
  cowlAnchor('cowl-reg', 0.36, 2.64, 0.7, 0.2);
  cowlAnchor('cowl-flag', 0.93, 2.64, 0.24, 0.144);

  const graphics = {};

  /* --------------------------------------------- German state police blue and silver ---- */
  const POL_SILVER = '#c6cacd',
    POL_BLUE = '#1f4f9d';
  // Blue lower cabin: up to the window sills, swept down to the belly behind the aft door.
  const sill = 1.38,
    sweep = [
      [-1.15, sill],
      [-2.35, 0.55],
    ];
  const polizeiZones = [
    {
      color: POL_BLUE,
      planes: [P.below(sill), P.keep(...sweep, [0, 1])],
      except: ['hub'],
    },
    // Cowling crowns, a line along the boom top, the shroud and endplates.
    { color: POL_BLUE, planes: [P.above(2.9)], only: ['accent'] },
    {
      color: POL_BLUE,
      planes: [P.line([-2.4, 2.3], [-6.0, 2.22], 1), P.behind(-2.3)],
      only: ['accent'],
    },
    { color: POL_BLUE, planes: [P.behind(-5.9), P.above(1.55)], only: ['accent'] },
    { color: WHITE, planes: [P.behind(-6.5), P.above(3.57)], only: ['accent'] },
    { color: POL_BLUE, planes: [P.outboard(1, 1.3)], only: ['accent'] },
    { color: POL_BLUE, planes: [P.outboard(-1, 1.3)], only: ['accent'] },
    // Dark horizontal stabilizer.
    { color: '#22344f', planes: [P.behind(-5.0)], only: ['shell'] },
  ];
  // A row of small white and blue checks along the top of the blue.
  const checkBox = { z: 0.55, y: 1.2, width: 6.2, height: 1.6 };
  graphics['pol-checks'] = sideArt(k, checkBox, 'check line', (c, at) => {
    const s = 0.04;
    const run = (z0, y0, z1, y1) => {
      const n = Math.floor(Math.hypot(z1 - z0, y1 - y0) / s);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n,
          [x, y] = at(z0 + (z1 - z0) * t, y0 + (y1 - y0) * t);
        c.box(i % 2 ? POL_BLUE : WHITE, x, y - s / 2, s, s, -Math.atan2(y1 - y0, z0 - z1));
      }
    };
    run(3.45, sill, sweep[0][0], sill);
    run(sweep[0][0], sill, -2.2, 0.7);
  });
  add(sideAnchors(space, 'pol-checks', 'shell', checkBox, 0.86, 0.8));
  graphics['pol-title'] = lettering(k, 'POLIZEI', 1.3, 0.3, WHITE, { capHeight: 0.2 });
  graphics['pol-reg'] = lettering(k, 'D-HPMS', 0.7, 0.2, POL_BLUE, { capHeight: 0.14 });
  graphics['flag-de'] = flag(k, 0.16, 0.096, ['#111111', '#dd0000', '#ffce00']).graphic(
    'German flag',
  );

  /* ---------------------------------------------- German air rescue red and white ---- */
  const DRF_RED = '#d22b2b';
  const drfZones = [
    // White lower cabin behind a diagonal from the sliding door's foot to the window line, and
    // the whole rear cabin behind the windows.
    {
      color: WHITE,
      planes: [P.below(1.46), P.keep([1.78, 0.45], [0.62, 1.46], [-1, 1])],
    },
    { color: WHITE, planes: [P.behind(-1.05), P.below(2.32)], only: ['shell'] },
    // White shroud cap and ventral fin.
    { color: WHITE, planes: [P.behind(-6.55), P.above(3.57)], only: ['accent'] },
    { color: WHITE, planes: [P.behind(-6.2), P.below(1.3)], only: ['accent'] },
    // Red horizontal stabilizer.
    { color: DRF_RED, planes: [P.behind(-5.0)], only: ['shell'] },
  ];
  graphics['notarzt-white'] = lettering(k, 'NOTARZT', 1.5, 0.3, WHITE, { capHeight: 0.2 });
  graphics['drf-reg'] = lettering(k, 'D-HDTQ', 0.7, 0.2, WHITE, { capHeight: 0.15 });
  graphics['flag-de-cowl'] = flag(k, 0.24, 0.144, ['#111111', '#dd0000', '#ffce00']).graphic(
    'German flag',
  );

  /* ---------------------------------------------------- German air rescue yellow ---- */
  const RESCUE_YELLOW = '#f6c400',
    RESCUE_BLUE = '#1c3f94';
  const yellowZones = [
    // Blue shroud cap.
    { color: RESCUE_BLUE, planes: [P.behind(-6.55), P.above(3.5)], only: ['accent'] },
  ];
  graphics['notarzt-black'] = lettering(k, 'NOTARZT', 1.5, 0.3, '#151515', { capHeight: 0.19 });
  graphics['yellow-reg'] = lettering(k, 'D-HYMK', 0.7, 0.2, '#151515', { capHeight: 0.15 });

  /* -------------------------------------------- Luftwaffe H145M LUH SAR olive/dayglo ---- */
  const LW_OLIVE = '#434b3a',
    DAYGLO = '#e8542c';
  const sarZones = [
    // Dayglo roof, cowlings and the crew-door area; the Fenestron's lower lip.
    { color: DAYGLO, planes: [P.above(2.28), P.ahead(-2.45)] },
    { color: DAYGLO, planes: [P.above(1.12), P.behind(2.72), P.ahead(0.55)], only: ['shell'] },
    { color: DAYGLO, planes: [P.behind(-6.3), P.below(1.45)], only: ['accent'] },
  ];
  graphics['sar-title'] = lettering(k, 'SAR', 1.0, 0.36, '#3c55a0', {
    capHeight: 0.3,
    tracking: 0.05,
  });
  // Bundeswehr serial with the Balkenkreuz between its two pairs of digits.
  graphics['lw-serial'] = (() => {
    const w = 1.5,
      h = 0.3,
      c = new k.Canvas(w, h);
    c.text('#141414', '77', { x: w / 2 - 0.2, y: h / 2, height: 0.2, align: 'right' });
    k.balkenkreuz(c, w / 2, h / 2, 0.28);
    c.text('#141414', '04', { x: w / 2 + 0.2, y: h / 2, height: 0.2, align: 'left' });
    return c.graphic('77+04 with Balkenkreuz');
  })();

  /* ------------------------------------------------- US Army UH-72B Lakota olive ---- */
  const ARMY_OD = '#494d3d';
  graphics['army-serial'] = lettering(k, '72478', 0.7, 0.2, '#16181a', { capHeight: 0.15 });
  graphics['army-title'] = lettering(k, 'U.S. ARMY', 1.5, 0.3, '#16181a', { capHeight: 0.13 });

  const references = {
    drf: {
      title: 'H145 Christoph 27 als D-HXFI (Luca390, CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:H145_Christoph_27_als_D-HXFI.jpg',
    },
    adac: {
      title: 'H145 D-3 D-HYAS, 2023 (Andre Gerwing, CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Airbus_H145_BK_117_D-3_(cn_21042,_D-HYAS)_2023-07-01_Andre_Gerwing_Collection_ID_010834.jpg',
    },
    luftwaffe: {
      title: 'Airbus H145M LUH SAR 77+04, 2024 (Andre Gerwing, CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Airbus_H145M_LUH_(cn_20315,_77%2B04)_2024-06-09_Andre_Gerwing_Collection_ID_020103.jpg',
    },
    uh72b: {
      title:
        'Arrival of the first UH-72B Lakota for the South Carolina Army National Guard (US Army National Guard, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:Arrival_of_first_UH-72_Bravo_Lakota_Helicopter_to_South_Carolina_Army_National_Guard_(52677095500)_(cropped).jpg',
    },
    polizei: {
      title: 'H145 D-HNWW of the North Rhine-Westphalia police, 2018 (Andre Gerwing, CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Airbus_H145_BK_117_D-2_(cn_20144,_D-HNWW)_2018-09-03_Andre_Gerwing_Collection_ID_010823.jpg',
    },
  };

  return {
    selected: 'polizei-blue-silver',
    anchors,
    graphics,
    variants: [
      {
        id: 'polizei-blue-silver',
        label: 'German state police blue and silver',
        provenance: {
          kind: 'inspired',
          note: 'German state police H145 from the referenced photograph of D-HNWW: metallic silver upper body and boom, police blue lower cabin up to the window sills sweeping down behind the aft door, a line of small white and blue checks along the top of the blue, POLIZEI in white on the doors, blue cowling crowns, boom-top line, Fenestron shroud and endplates, and a white band at the top of the shroud with the registration and the German flag. The registration is fictional (D-HPMS) and the state emblem and manufacturer titles are omitted. Colors are approximate.',
          references: [references.polizei],
        },
        paints: {
          ...scheme(space, exterior, POL_SILVER, polizeiZones, {
            roughness: 0.3,
            metalness: 0.35,
          }),
          hub: { color: POL_BLUE },
        },
        markings: [
          ...both('pol-checks', 'pol-checks', true),
          ...both('door-low', 'pol-title'),
          ...both('fin-top', 'pol-reg'),
          ...both('fin-flag', 'flag-de', true),
        ],
      },
      {
        id: 'german-air-rescue-red',
        label: 'German air rescue red and white',
        provenance: {
          kind: 'inspired',
          note: "German air rescue H145 D3 from the referenced photograph of D-HXFI: red upper body, cowlings, boom and Fenestron, white lower cabin behind a diagonal from the sliding door's foot and white rear cabin, white shroud cap and ventral fin, NOTARZT (emergency doctor) in white on the boom and the registration with the German flag on the cowling. The registration is fictional (D-HDTQ); the operator's name and logos are omitted. Colors and the split line are approximate.",
          references: [references.drf],
        },
        paints: {
          ...scheme(space, exterior, DRF_RED, drfZones, { roughness: 0.3 }),
          hub: { color: DRF_RED },
        },
        markings: [
          ...both('boom-title', 'notarzt-white'),
          ...both('cowl-reg', 'drf-reg'),
          ...both('cowl-flag', 'flag-de-cowl', true),
        ],
      },
      {
        id: 'german-air-rescue-yellow',
        label: 'German air rescue yellow',
        provenance: {
          kind: 'inspired',
          note: "German automobile-club air rescue H145 D3 from the referenced photograph of D-HYAS: signal yellow overall with a blue Fenestron cap, NOTARZT (emergency doctor) in black on the boom and the registration in black with the German flag on the cowling. The registration is fictional (D-HYMK); the operator's large name on the rear cabin, its logos and the emergency-number emblem on the fin are omitted. Colors are approximate.",
          references: [references.adac],
        },
        paints: {
          ...scheme(space, exterior, RESCUE_YELLOW, yellowZones, { roughness: 0.3 }),
          hub: { color: RESCUE_YELLOW },
        },
        markings: [
          ...both('boom-title', 'notarzt-black'),
          ...both('cowl-reg', 'yellow-reg'),
          ...both('cowl-flag', 'flag-de-cowl', true),
        ],
      },
      {
        id: 'luftwaffe-h145m-sar',
        label: 'Luftwaffe H145M LUH SAR 77+04',
        provenance: {
          kind: 'photo',
          note: 'German Air Force H145M LUH SAR 77+04 from the referenced photograph: bronze-olive green with dayglo orange-red on the roof, cowlings and crew-door area and on the lip under the Fenestron, SAR in blue on the sliding door, the serial 77+04 with the Balkenkreuz on the boom and the German flag on the fin. The H145M is shown on the civil D3 airframe (no weapons or sensor fit); colors are approximate.',
          references: [references.luftwaffe],
        },
        paints: {
          ...scheme(space, exterior, LW_OLIVE, sarZones, { roughness: 0.55 }),
          hub: { color: LW_OLIVE },
        },
        markings: [
          ...both('door-high', 'sar-title'),
          ...both('boom-title', 'lw-serial'),
          ...both('fin-flag', 'flag-de', true),
        ],
      },
      {
        id: 'us-army-uh-72b',
        label: 'US Army UH-72B Lakota',
        provenance: {
          kind: 'photo',
          note: 'US Army National Guard UH-72B Lakota 72478 from the referenced photograph (the UH-72B is the military H145 D3): olive drab overall with matt finish, the serial in black on the Fenestron cap and U.S. ARMY in black on the boom. Unit patches and stencils are omitted; colors are approximate.',
          references: [references.uh72b],
        },
        paints: {
          ...scheme(space, exterior, ARMY_OD, [], { roughness: 0.7 }),
          hub: { color: ARMY_OD, roughness: 0.7 },
        },
        markings: [...both('fin-top', 'army-serial'), ...both('boom-title', 'army-title')],
      },
    ],
  };
}
