/**
 * Bell 206B JetRanger liveries: the US Navy's TH-57C Sea Ranger trainer, a US city police
 * navy-and-silver scheme, the Swedish police's historic POLIS scheme and Polish police aviation's
 * red and black, each studied from a photograph. Military insignia, titles and serials are shown;
 * civil operators keep their colors and layout with fictional registrations and plain functional
 * words only. Lettering is real type and every emblem is an original vector drawing.
 */
import { both, lettering, P, pair, scheme } from '../art-helicopters-a.mjs';

export function slots() {
  return {
    // Cabin, doors, engine deck, boom, fin and stabilizers.
    shell: { materials: ['206-ivory'], node: '206-shell-206-ivory' },
    // The one-piece nose under the windscreen (upper and lower skins).
    nose: { materials: ['206-ivory'], node: 'forward-fuselage' },
    // The builder's lower-side stripe.
    accent: { materials: ['206-blue'], node: '206-shell-206-blue' },
    // Skids, cross tubes and small fittings.
    alloy: { materials: ['206-alloy'], node: '206-shell-206-alloy' },
  };
}

// Boom loft stations (z, half width, centre height, half height) from the Bell 206 builder.
const BOOM = [
  [-2.35, 0.22, 1.32, 0.26],
  [-4.8, 0.12, 1.43, 0.15],
  [-5.85, 0.08, 1.48, 0.11],
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
  throw new Error(`Bell 206 boom station ${z} out of range`);
}
// Top edge of the builder's lower-side stripe (z, y).
const STRIPE_TOP = [
  [1.74, 0.715],
  [-0.85, 0.605],
  [-1.65, 0.905],
];

const WHITE = '#f2f2ee';

export default function design({ kit: k, space }) {
  const anchors = {};
  const add = (...more) => Object.assign(anchors, ...more);
  const boomAnchor = (name, z, y, width, height) => {
    const [w] = boomAt(z);
    add(
      pair(space, name, (side) => ({
        slot: 'shell',
        center: [side * w, y, z],
        width,
        height,
        depth: Math.min(0.4, w * 1.6),
      })),
    );
  };
  const cabin = (name, z, y, width, height, x = 0.66, slot = 'shell') =>
    add(
      pair(space, name, (side) => ({
        slot,
        center: [side * x, y, z],
        width,
        height,
        depth: 0.5,
      })),
    );
  const fin = (name, z, y, width, height) =>
    add(
      pair(space, name, (side) => ({
        slot: 'shell',
        center: [side * 0.04, y, z],
        width,
        height,
        depth: 0.05,
      })),
    );
  boomAnchor('boom-title', -3.1, 1.3, 1.2, 0.24);
  boomAnchor('boom-reg', -3.2, 1.32, 1.5, 0.26);
  boomAnchor('boom-reg-low', -3.2, 1.25, 1.5, 0.2);
  cabin('rear-cabin', -1.08, 1.05, 0.56, 0.28, 0.59);
  cabin('rear-cabin-roundel', -0.75, 1.3, 0.28, 0.28, 0.63);
  cabin('rear-cabin-code', -1.2, 0.98, 0.56, 0.28, 0.57);
  // Lettering across the doors runs over the lower stripe too: one projector per material.
  cabin('doors-low', 0.55, 0.74, 1.4, 0.26);
  cabin('doors-low-stripe', 0.55, 0.74, 1.4, 0.26, 0.67, 'accent');
  fin('fin-upper', -6.12, 2.15, 0.3, 0.2);
  fin('fin-flag', -6.22, 2.36, 0.2, 0.11);

  const graphics = {};
  const exterior = ['shell', 'nose', 'accent'];
  /** Zones above (side 1) or below (-1) the stripe's top edge, offset by dy, in two runs. */
  const overStripe = (color, dy0, dy1, more = []) =>
    STRIPE_TOP.slice(1).map((b, i) => {
      const a = STRIPE_TOP[i],
        lift = (q, dy) => [q[0], q[1] + dy];
      return {
        color,
        planes: [
          P.line(lift(a, dy0), lift(b, dy0), 1),
          ...(dy1 === undefined ? [] : [P.line(lift(a, dy1), lift(b, dy1), -1)]),
          i ? P.behind(a[0]) : P.ahead(b[0]),
          ...(i ? [P.ahead(b[0] - 0.75)] : []),
          ...more,
        ],
      };
    });
  const skids = (color) => ({
    alloy: {
      color: '#8b979b',
      metalness: 0.65,
      zones: [{ color, planes: [space.plane('alloy', [0, -1, 0], [0, 0.45, 0])] }],
    },
  });

  /* --------------------------------------------------------- US Navy TH-57C trainer ---- */
  const NAVY_ORANGE = '#de5420',
    INK = '#151719';
  const th57Zones = [
    // International orange cabin sides from the stripe to the roof edge, a black line under it.
    ...overStripe(NAVY_ORANGE, 0.02, undefined, [P.below(1.6), P.behind(2.0)]),
    ...overStripe(INK, 0.0, 0.02, [P.behind(2.0)]),
    // Orange upper half of the boom and the fin's upper leading edge.
    {
      color: NAVY_ORANGE,
      planes: [
        P.line([-2.35, 1.38], [-5.9, 1.5], 1),
        P.behind(-2.2),
        P.ahead(-5.62),
        // The boom only, not the stabilizers that cross it.
        P.plane([1, 0, 0], [-0.25, 0, 0]),
        P.plane([-1, 0, 0], [0.25, 0, 0]),
      ],
      only: ['shell'],
    },
    {
      color: NAVY_ORANGE,
      planes: [P.above(1.95), P.keep([-5.78, 1.95], [-6.12, 2.52], [-5.0, 2.2])],
      only: ['shell'],
    },
    // Black chin and nose cone below the belt line.
    { color: INK, planes: [P.below(0.86), P.ahead(1.72)], only: ['nose'] },
  ];
  graphics['us-insignia'] = k
    .usInsignia(new k.Canvas(0.56, 0.28), 0.28, 0.14, 0.13, { style: 'full' })
    .graphic('US national insignia');
  graphics['navy-title'] = lettering(k, 'NAVY', 1.2, 0.24, INK, { capHeight: 0.15 });
  graphics['th57-serial'] = (() => {
    const w = 0.3,
      h = 0.2,
      c = new k.Canvas(w, h);
    c.text(INK, 'TH-57C', { x: w / 2, y: h * 0.72, height: 0.04 });
    c.text(INK, '162016', { x: w / 2, y: h * 0.32, height: 0.075 });
    return c.graphic('TH-57C 162016');
  })();

  /* -------------------------------------------------- US city police navy and silver ---- */
  const POLICE_SILVER = '#c9cdd1',
    POLICE_NAVY = '#1f3566';
  const front = [
      [2.95, 0.88],
      [0.0, 0.95],
    ],
    rise = [
      [0.0, 0.95],
      [-2.4, 1.62],
    ];
  const lowerNavy = (dy0, dy1, color) => [
    {
      color,
      planes: [
        P.line(...front.map(([z, y]) => [z, y + dy0]), -1),
        ...(dy1 === undefined ? [] : [P.line(...front.map(([z, y]) => [z, y + dy1]), 1)]),
        P.ahead(0),
      ],
    },
    {
      color,
      planes: [
        P.keep(...rise.map(([z, y]) => [z, y + dy0]), [0, -1]),
        ...(dy1 === undefined ? [] : [P.keep(...rise.map(([z, y]) => [z, y + dy1]), [0, 3])]),
        P.behind(0),
      ],
    },
  ];
  const policeZones = [
    ...lowerNavy(0, undefined, POLICE_NAVY),
    { color: POLICE_NAVY, planes: [P.behind(-2.35)] },
    // Two white pinstripes inside the top of the navy.
    ...lowerNavy(-0.05, -0.068, WHITE).map((z) => ({ ...z, planes: [...z.planes, P.below(1.56)] })),
    ...lowerNavy(-0.1, -0.114, WHITE).map((z) => ({ ...z, planes: [...z.planes, P.below(1.56)] })),
    // White stripes across the fin.
    {
      color: WHITE,
      planes: [
        P.behind(-5.6),
        P.line([-5.6, 1.95], [-6.5, 2.1], 1),
        P.line([-5.6, 2.03], [-6.5, 2.18], -1),
      ],
      only: ['shell'],
    },
    {
      color: WHITE,
      planes: [
        P.behind(-5.6),
        P.line([-5.6, 1.06], [-6.5, 1.0], 1),
        P.line([-5.6, 1.14], [-6.5, 1.08], -1),
      ],
      only: ['shell'],
    },
  ];
  graphics['police-reg'] = lettering(k, 'N417CK', 1.5, 0.26, WHITE, { capHeight: 0.18 });
  graphics['flag-us'] = (() => {
    const w = 0.2,
      h = 0.11,
      c = new k.Canvas(w, h);
    for (let i = 0; i < 13; i++)
      c.rect(i % 2 ? WHITE : '#b22234', 0, h - ((i + 1) * h) / 13, w, h / 13);
    c.rect('#3c3b6e', 0, h - (7 * h) / 13, w * 0.4, (7 * h) / 13);
    return c.graphic('US flag');
  })();

  /* ------------------------------------------------ Swedish police historic POLIS ---- */
  const MAROON = '#7b1f2d';
  const polisZones = [
    // Black door panel from the windscreen post to a raked edge behind the rear door.
    {
      color: INK,
      planes: [
        P.below(1.64),
        P.above(0.52),
        P.behind(1.8),
        P.keep([-0.75, 1.64], [-1.25, 0.5], [0, 1]),
      ],
      except: ['nose'],
    },
    // Maroon engine deck and roof, edged by a thin white line.
    { color: MAROON, planes: [P.above(1.69), P.ahead(-2.35)], only: ['shell'] },
  ];
  graphics['polis-title'] = lettering(k, 'POLIS', 1.4, 0.26, WHITE, {
    capHeight: 0.2,
    tracking: 0.08,
  });
  graphics['polis-reg'] = lettering(k, 'SE-HPK', 1.5, 0.26, INK, { capHeight: 0.15 });

  /* -------------------------------------------------- Polish police red and black ---- */
  const PL_RED = '#cc1f22',
    GOLD = '#d2a84a';
  const low = [
      [2.9, 0.66],
      [-0.85, 0.48],
      [-2.35, 1.05],
    ],
    high = [
      [2.9, 0.9],
      [-0.85, 0.86],
      [-2.35, 1.33],
      [-6.4, 1.47],
    ];
  const between = (color, lo, hi, a, b, more = []) => ({
    color,
    planes: [P.line(...lo, 1), P.line(...hi, -1), P.behind(a), P.ahead(b), ...more],
  });
  const lift = (seg, dy) => seg.map(([z, y]) => [z, y + dy]);
  const polishZones = [
    // A black sweep from the nose, low along the cabin, rising into the lower half of the boom.
    between(INK, [low[0], low[1]], [high[0], high[1]], 3.0, -0.85),
    between(INK, [low[1], low[2]], [high[1], high[2]], -0.85, -2.35),
    { color: INK, planes: [P.line(high[2], high[3], -1), P.behind(-2.35)] },
    // Gold pinstripes on both edges.
    between(GOLD, lift([high[0], high[1]], 0.012), lift([high[0], high[1]], 0.03), 3.0, -0.85),
    between(GOLD, lift([high[1], high[2]], 0.012), lift([high[1], high[2]], 0.03), -0.85, -2.35),
    {
      color: GOLD,
      planes: [
        P.line(...lift([high[2], high[3]], 0.012), 1),
        P.line(...lift([high[2], high[3]], 0.03), -1),
        P.behind(-2.35),
      ],
    },
    between(GOLD, lift([low[0], low[1]], -0.03), lift([low[0], low[1]], -0.012), 3.0, -0.85),
    between(GOLD, lift([low[1], low[2]], -0.03), lift([low[1], low[2]], -0.012), -0.85, -2.35),
  ];
  graphics['pl-reg'] = lettering(k, 'SN-31XP', 1.5, 0.2, WHITE, { capHeight: 0.12 });

  /* --------------------------------------------- Canadian Forces CH-139 trainer ---- */
  const TRAINER_YELLOW = '#eea41f',
    DARK = '#2a2c2e';
  const ch139Zones = [
    // Dark belly under the stripe, nose cone and engine deck.
    ...overStripe(DARK, -0.4, 0.0),
    { color: DARK, planes: [P.below(0.86), P.ahead(1.72)], only: ['nose'] },
    { color: DARK, planes: [P.above(1.7), P.behind(1.3), P.ahead(-2.4)], only: ['shell'] },
    // Boom: dark, a yellow band at mid-length, dark again; fin dark below the boom.
    { color: DARK, planes: [P.behind(-2.3), P.ahead(-3.85)], only: ['shell'] },
    { color: DARK, planes: [P.behind(-4.55), P.below(1.6)], only: ['shell'] },
  ];
  graphics['roundel-ca'] = k
    .canadaRoundel(new k.Canvas(0.28, 0.28), 0.14, 0.14, 0.13)
    .graphic('Canadian roundel');
  graphics['ch139-code'] = (() => {
    const w = 0.56,
      h = 0.28,
      c = new k.Canvas(w, h);
    c.text(INK, 'CANADIAN FORCES', { x: w / 2, y: h * 0.82, height: 0.026 });
    c.text(INK, 'FORCES CANADIENNES', { x: w / 2, y: h * 0.66, height: 0.026 });
    c.text(INK, '303', { x: w / 2, y: h * 0.27, height: 0.1, tracking: 0.08 });
    return c.graphic('CH-139 titles and code');
  })();
  graphics['flag-ca'] = (() => {
    const w = 0.2,
      h = 0.11,
      c = new k.Canvas(w, h);
    c.rect('#d52b1e', 0, 0, w * 0.25, h);
    c.rect(WHITE, w * 0.25, 0, w * 0.5, h);
    c.rect('#d52b1e', w * 0.75, 0, w * 0.25, h);
    // A small maple leaf in the white centre square, reusing the roundel's leaf.
    const leaf = new k.Canvas(w, h);
    k.canadaRoundel(leaf, w / 2, h / 2, h * 0.62);
    c.add('#d52b1e', leaf.shapes.at(-1).points);
    return c.graphic('Canadian flag');
  })();

  const references = {
    ch139: {
      title: 'Bell CH-139 Jet Ranger 139303 of 3 CFFTS, Portage la Prairie, 1982 (CC0)',
      url: 'https://commons.wikimedia.org/wiki/File:Bell_CH-139_Jet_Ranger_139303_3CFFTS_Portage_1982.png',
    },
    th57: {
      title: 'TH-57C Sea Ranger 162016 at NAS Patuxent River (US Navy, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:Naeapaxr_TH-57C.jpg',
    },
    th57b: {
      title: 'TH-57C landing on the helicopter landing trainer (US Navy, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:TH57C_boat_ops.jpg',
    },
    lapd: {
      title: 'LAPD Bell 206 Jetranger — Matthew Field (CC BY 2.5)',
      url: 'https://commons.wikimedia.org/wiki/File:LAPD_Bell_206_Jetranger.jpg',
    },
    sweden: {
      title: 'Bell 206B, Stockholm (P1090624) — Matti Blume (CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Bell_206B,_Stockholm_(P1090624).jpg',
    },
    poland: {
      title: "Bell 206B-3 Jet Ranger 'SN-17XP' Policja (CC BY-SA 2.0)",
      url: 'https://commons.wikimedia.org/wiki/File:Bell_206B-3_Jet_Ranger_%27SN-17XP%27_Policja.jpg',
    },
  };

  return {
    selected: 'us-navy-th-57c',
    anchors,
    graphics,
    variants: [
      {
        id: 'us-navy-th-57c',
        label: 'US Navy TH-57C Sea Ranger',
        provenance: {
          kind: 'photo',
          note: "US Navy TH-57C Sea Ranger 162016 from the referenced photographs (the TH-57 is the Navy's 206B-3 trainer): white with international orange cabin sides edged in black, an orange upper boom and fin leading edge, a black nose cone, the national insignia behind the rear door, NAVY on the boom and the type and Bureau Number on the fin. The squadron badge and stencils are omitted; colors are approximate.",
          references: [references.th57, references.th57b],
        },
        paints: scheme(space, exterior, WHITE, th57Zones, { roughness: 0.32 }),
        markings: [
          ...both('rear-cabin', 'us-insignia'),
          ...both('boom-title', 'navy-title'),
          ...both('fin-upper', 'th57-serial'),
        ],
      },
      {
        id: 'city-police-navy-silver',
        label: 'US city police navy and silver',
        provenance: {
          kind: 'inspired',
          note: 'US city police JetRanger from the referenced Los Angeles photograph: metallic silver upper fuselage over a navy lower body that sweeps up behind the cabin into an all-navy boom and fin, two white pinstripes along the top of the navy, white stripes across the fin, the registration in white on the boom and the US flag on the fin. The registration is fictional (N417CK; the photographed aircraft is N211LA); the department initials and badge are omitted. Colors are approximate.',
          references: [references.lapd],
        },
        paints: {
          ...scheme(space, exterior, POLICE_SILVER, policeZones, {
            roughness: 0.3,
            metalness: 0.3,
          }),
          ...skids('#26292d'),
        },
        markings: [...both('boom-reg', 'police-reg'), ...both('fin-flag', 'flag-us', true)],
      },
      {
        id: 'swedish-police-polis',
        label: 'Swedish police POLIS',
        provenance: {
          kind: 'inspired',
          note: 'Swedish police JetRanger from the referenced photograph of the preserved SE-HPB: white with a black door panel ending in a raked edge behind the rear door, POLIS in large white capitals across the doors, a maroon engine deck and roof, and the registration in black on the boom. The registration is fictional (SE-HPK); the police coat of arms and museum markings are omitted. Colors are approximate.',
          references: [references.sweden],
        },
        paints: {
          ...scheme(space, exterior, WHITE, polisZones, { roughness: 0.3 }),
          accent: { color: INK },
        },
        markings: [
          ...both('doors-low', 'polis-title'),
          ...both('doors-low-stripe', 'polis-title'),
          ...both('boom-reg', 'polis-reg'),
        ],
      },
      {
        id: 'polish-police-red-black',
        label: 'Polish police aviation red and black',
        provenance: {
          kind: 'inspired',
          note: 'Polish police aviation JetRanger from the referenced photograph of SN-17XP: bright red with a black sweep from the nose, low along the cabin and up into the lower half of the boom and the ventral fin, gold pinstripes on both edges, red skids and the registration in white on the boom. The registration is fictional (SN-31XP); small model titles and stencils are omitted. Colors are approximate.',
          references: [references.poland],
        },
        paints: {
          ...scheme(space, exterior, PL_RED, polishZones, { roughness: 0.28 }),
          accent: { color: INK },
          ...skids(PL_RED),
        },
        markings: [...both('boom-reg-low', 'pl-reg')],
      },
      {
        id: 'canadian-forces-ch-139',
        label: 'Canadian Forces CH-139 trainer',
        provenance: {
          kind: 'photo',
          note: 'Canadian Forces CH-139 JetRanger 139303 of 3 Canadian Forces Flying Training School from the referenced 1982 photograph: trainer yellow with a dark belly, nose cone and engine deck, a dark tail boom broken by a yellow band, the roundel with the bilingual CANADIAN FORCES titles and the code 303 on the rear cabin, and the Canadian flag on the fin. Colors are approximate.',
          references: [references.ch139],
        },
        paints: {
          ...scheme(space, exterior, TRAINER_YELLOW, ch139Zones, { roughness: 0.35 }),
          accent: { color: DARK },
        },
        markings: [
          ...both('rear-cabin-roundel', 'roundel-ca'),
          ...both('rear-cabin-code', 'ch139-code'),
          ...both('fin-flag', 'flag-ca', true),
        ],
      },
    ],
  };
}
