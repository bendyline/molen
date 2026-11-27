/**
 * Bell 407 liveries: Iraqi Army Aviation desert camouflage, a US state police black and gold
 * scheme, Polish police silver and blue, an air-medical yellow and black and a corporate red and
 * silver, each studied from a photograph. Military insignia, titles and serials are shown; civil
 * operators keep their colors and layout with fictional registrations, plain functional words
 * only and no names or logos. Lettering is real type and every emblem is an original drawing.
 */
import { both, flag, lettering, P, pair, scheme, starOfLife } from '../art-helicopters-a.mjs';

export function slots() {
  return {
    // Cabin sides, engine doghouse, boom, fin, stabilizer and endplates.
    upper: { materials: ['407-wine-red'], node: '407-airframe-407-wine-red' },
    // The cabin loft: belly, lower band, roof edge and the tapering rear cabin.
    lower: { materials: ['407-ivory'], node: '407-airframe-407-ivory' },
    // The nose: upper skin round the windscreen and the lower skin round the chin windows.
    'nose-upper': { materials: ['407-wine-red'], node: 'forward-fuselage' },
    'nose-lower': { materials: ['407-ivory'], node: 'forward-fuselage' },
    // The beltline pinstripe.
    beltline: { materials: ['407-stripe'], node: '407-airframe-407-stripe' },
    // Skids, cross tubes and fittings.
    metal: { materials: ['407-machined'], node: '407-airframe-407-machined' },
    hub: { materials: ['407-wine-red'], node: '407-head-407-wine-red' },
  };
}

// Boom loft stations (z, half width, centre height, half height) from the Bell 407 builder.
const BOOM = [
  [-2.9, 0.22, 1.615, 0.245],
  [-4.6, 0.15, 1.745, 0.205],
  [-6.26, 0.095, 1.85, 0.13],
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
  throw new Error(`Bell 407 boom station ${z} out of range`);
}

const WHITE = '#f1f1ed',
  INK = '#16181b';

export default function design({ kit: k, space, bounds }) {
  const anchors = {};
  const add = (...more) => Object.assign(anchors, ...more);
  const boomAnchor = (name, z, y, width, height) => {
    const [w] = boomAt(z);
    add(
      pair(space, name, (side) => ({
        slot: 'upper',
        center: [side * w, y, z],
        width,
        height,
        depth: Math.min(0.4, w * 1.6),
      })),
    );
  };
  const side = (name, slot, z, y, width, height, x, lean = 0) =>
    add(
      pair(space, name, (s) => ({
        slot,
        center: [s * x, y, z],
        facing: [s, 0, -lean],
        width,
        height,
        depth: 0.5,
      })),
    );
  boomAnchor('boom-title', -3.65, 1.67, 1.45, 0.24);
  boomAnchor('boom-reg', -3.7, 1.66, 1.5, 0.28);
  side('rear-cabin', 'upper', -1.32, 1.12, 0.72, 0.48, 0.67, 0.12);
  side('door-low', 'lower', 1.0, 0.66, 1.1, 0.2, 0.76);
  side('front-door-low', 'lower', 1.55, 0.7, 0.7, 0.14, 0.75);
  // Above the windows the skin changes material (side sheet, then the loft's roof edge).
  side('roof-title', 'upper', 0.85, 1.68, 1.3, 0.16, 0.7);
  side('roof-title-edge', 'lower', 0.85, 1.68, 1.3, 0.16, 0.7);
  side('rear-code', 'upper', -0.95, 1.08, 0.55, 0.2, 0.72, 0.12);
  // Doghouse flank, behind the intake.
  add(
    pair(space, 'doghouse', (s) => ({
      slot: 'upper',
      center: [s * 0.4, 2.05, -1.2],
      facing: [s, 0.1, 0],
      width: 0.24,
      height: 0.15,
      depth: 0.2,
    })),
    // Stabilizer endplates (outboard faces).
    pair(space, 'endplate', (s) => ({
      slot: 'upper',
      center: [s * 1.115, 1.98, -4.72],
      width: 0.18,
      height: 0.22,
      depth: 0.04,
    })),
    // Upper fin: chord about 0.3 m at 2.5 m.
    pair(space, 'fin-flag', (s) => ({
      slot: 'upper',
      center: [s * 0.042, 2.76, -6.9],
      width: 0.2,
      height: 0.1,
      depth: 0.05,
    })),
    pair(space, 'fin-badge', (s) => ({
      slot: 'upper',
      center: [s * 0.042, 2.42, -6.8],
      width: 0.18,
      height: 0.18,
      depth: 0.05,
    })),
    pair(space, 'fin-serial', (s) => ({
      slot: 'upper',
      center: [s * 0.042, 2.5, -6.82],
      width: 0.27,
      height: 0.08,
      depth: 0.05,
    })),
  );

  const graphics = {};
  const exterior = ['upper', 'lower', 'nose-upper', 'nose-lower'];
  const skids = (color) => ({
    metal: {
      color: '#8a9599',
      metalness: 0.7,
      zones: [{ color, planes: [space.plane('metal', [0, -1, 0], [0, 0.45, 0])] }],
    },
  });

  /* ----------------------------------------------- Iraqi Army Aviation desert camo ---- */
  const SAND = '#c9a978',
    SAND_LIGHT = '#d4b98b',
    EARTH = '#8d6a45';
  // The same blotch size on every slot: repetitions scale with each slot's own length.
  const camo = (slot, seed) => {
    const { min, max } = bounds[slot];
    const longest = Math.max(...max.map((v, i) => v - min[i]));
    return {
      color: SAND,
      roughness: 0.7,
      camouflage: {
        colors: [SAND, SAND_LIGHT, EARTH],
        scale: Math.max(1, Math.round(longest * 0.55 * 10) / 10),
        seed,
        style: 'blotch',
      },
    };
  };
  graphics['iraq-title'] = lettering(k, 'IRAQI ARMY AVIATION', 1.45, 0.24, INK, {
    capHeight: 0.11,
  });
  const iraqFlag = (w, h, label) => {
    const c = new k.Canvas(w, h);
    c.rect('#ce1126', 0, (2 * h) / 3, w, h / 3);
    c.rect(WHITE, 0, h / 3, w, h / 3);
    c.rect('#000000', 0, 0, w, h / 3);
    // The green inscription, drawn as a simplified blocky (Kufic-style) mark, not as text.
    const g = '#007a3d',
      y0 = h * 0.4,
      u = h / 30;
    c.rect(g, w * 0.3, y0, w * 0.4, u * 1.2);
    for (const [x, tall] of [
      [0.33, 5],
      [0.38, 3],
      [0.43, 7],
      [0.47, 7],
      [0.55, 3],
      [0.6, 7],
      [0.66, 4],
    ])
      c.rect(g, w * x, y0, u * 1.2, u * tall);
    c.rect(g, w * 0.51, y0 + u * 3.5, w * 0.06, u * 1.2);
    return c.graphic(label);
  };
  graphics['flag-iq'] = iraqFlag(0.72, 0.48, 'Iraqi flag');
  graphics['flag-iq-small'] = iraqFlag(0.2, 0.1, 'Iraqi flag (fin)');
  graphics['iraq-serial'] = lettering(k, 'YI-140', 0.27, 0.08, INK, { capHeight: 0.05 });

  /* ------------------------------------------------- US state police black and gold ---- */
  const TAN = '#b8965a';
  const stateZones = [
    // White lower body; a tan band over it with a black line, rising to the boom's underside.
    { color: WHITE, planes: [P.below(0.84)] },
    { color: TAN, planes: [P.above(0.84), P.below(0.97), P.ahead(-1.9)] },
    {
      color: TAN,
      planes: [
        P.keep([-1.9, 0.84], [-2.95, 1.37], [0, 0]),
        P.keep([-1.9, 0.97], [-2.95, 1.47], [0, 3]),
        P.behind(-1.9),
        P.ahead(-3.4),
      ],
    },
  ];
  graphics['state-title'] = lettering(k, 'STATE POLICE', 1.3, 0.16, TAN, { capHeight: 0.12 });
  graphics.troopers = lettering(k, 'TROOPERS', 1.1, 0.2, INK, { capHeight: 0.12 });
  graphics['state-reg'] = lettering(k, 'N452PS', 1.5, 0.28, TAN, { capHeight: 0.2, slant: 0.1 });
  graphics['state-number'] = lettering(k, '4', 0.18, 0.22, WHITE, { capHeight: 0.17 });

  /* -------------------------------------------------- Polish police silver and blue ---- */
  const PL_SILVER = '#d3d7da',
    PL_BLUE = '#274e9e';
  const policjaZones = [
    // A blue band at window-top level from the nose, dropping onto the boom's middle.
    { color: PL_BLUE, planes: [P.above(1.6), P.below(1.7), P.ahead(-1.6)] },
    {
      color: PL_BLUE,
      planes: [
        P.keep([-1.6, 1.6], [-2.95, 1.55], [0, 0]),
        P.keep([-1.6, 1.7], [-2.95, 1.68], [0, 3]),
        P.behind(-1.6),
        P.ahead(-2.95),
      ],
    },
    {
      color: PL_BLUE,
      planes: [
        P.line([-2.95, 1.55], [-6.4, 1.8], 1),
        P.line([-2.95, 1.68], [-6.4, 1.86], -1),
        P.behind(-2.95),
        P.plane([1, 0, 0], [-0.3, 0, 0]),
        P.plane([-1, 0, 0], [0.3, 0, 0]),
      ],
      only: ['upper'],
    },
  ];
  graphics['policja-title'] = lettering(k, 'POLICJA', 0.7, 0.14, PL_BLUE, { capHeight: 0.1 });
  graphics['policja-code'] = lettering(k, 'A-107', 0.55, 0.2, PL_BLUE, { capHeight: 0.14 });
  graphics['policja-reg'] = lettering(k, 'SN-86XP', 1.5, 0.28, WHITE, { capHeight: 0.1 });
  graphics['flag-pl'] = flag(k, 0.24, 0.15, [WHITE, '#dc143c']).graphic('Polish flag');

  /* -------------------------------------------- Air-medical yellow and black swoosh ---- */
  const MED_YELLOW = '#f6c800';
  const medicalZones = [
    // Black boom, fin and stabilizer.
    { color: INK, planes: [P.behind(-2.9)], only: ['upper'] },
    // A black swoosh from the lower front door sweeping up into the boom.
    {
      color: INK,
      planes: [
        P.keep([1.25, 0.72], [-2.95, 1.42], [0, 3]),
        P.keep([1.25, 0.86], [-2.95, 1.62], [0, 0]),
        P.ahead(-2.95),
        P.behind(1.25),
      ],
    },
    // A second, thinner one from the roof edge above the rear door down to the boom.
    {
      color: INK,
      planes: [
        P.keep([0.1, 1.72], [-2.95, 1.75], [0, 0]),
        P.keep([0.1, 1.8], [-2.95, 1.86], [0, 3]),
        P.ahead(-2.95),
        P.behind(0.1),
      ],
    },
  ];
  graphics['med-reg'] = lettering(k, 'N438P', 1.1, 0.2, INK, { capHeight: 0.17 });
  graphics['star-of-life'] = starOfLife(k, 0.18);

  /* ----------------------------------------------- Corporate red and silver ---- */
  const CORP_RED = '#c3202b',
    CORP_SILVER = '#cdd0d2';
  graphics['corp-reg'] = lettering(k, 'N24107', 1.5, 0.28, WHITE, { capHeight: 0.19 });

  const references = {
    iraq: {
      title: 'Iraqi Army Aviation Bell 407 YI-140 (US Air Force, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:Iraqi_Bell_407_YI-140.jpg',
    },
    iraq2: {
      title: 'Two Iraqi Bell 407s (US Air Force, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:Two_Iraqi_Bell_407s.jpg',
    },
    psp: {
      title: 'Bell 407 N876ST Pennsylvania State Police — Acroterion (CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Bell_407_N876ST_Pennsylvania_State_Police_FDK_MD1.jpg',
    },
    policja: {
      title: 'Bell 407 SN-80XP of the Polish police over Warsaw (CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Bell-407-warsaw-poland-police-sn-80xp-right.jpg',
    },
    n462p: {
      title: 'Bell 407 (N462P) — JasonReina (CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Bell_407_(N462P).jpg',
    },
    n23986: {
      title: 'Bell 407 -N23986 — stuart.mike (CC BY 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Bell_407_-N23986.jpg',
    },
  };

  return {
    selected: 'iraqi-army-aviation',
    anchors,
    graphics,
    variants: [
      {
        id: 'iraqi-army-aviation',
        label: 'Iraqi Army Aviation YI-140',
        provenance: {
          kind: 'photo',
          note: "Iraqi Army Aviation Bell 407 YI-140 from the referenced US Air Force photographs: two-tone desert camouflage (sand with earth-brown blotches; the pattern is generated, not the aircraft's own), IRAQI ARMY AVIATION in black on the boom, the Iraqi flag on the rear cabin and fin and the serial on the fin. The flag's green inscription is represented by a simplified blocky mark rather than lettering; unit badges and stencils are omitted. Colors are approximate.",
          references: [references.iraq, references.iraq2],
        },
        paints: {
          ...Object.fromEntries(exterior.map((s, i) => [s, camo(s, 4071 + i)])),
          beltline: { color: SAND },
          hub: { color: SAND },
          ...skids(SAND_LIGHT),
        },
        markings: [
          ...both('boom-title', 'iraq-title'),
          ...both('rear-cabin', 'flag-iq'),
          ...both('fin-flag', 'flag-iq-small'),
          ...both('fin-serial', 'iraq-serial'),
        ],
      },
      {
        id: 'state-police-black-gold',
        label: 'US state police black and gold',
        provenance: {
          kind: 'inspired',
          note: 'US state police Bell 407 from the referenced Pennsylvania photograph: gloss black upper body, boom and fin, a white lower body under a tan band with a black pinstripe that rises to the boom, STATE POLICE in tan above the doors, TROOPERS in black on the lower doors, the registration in tan on the boom and the fleet number in white on the stabilizer endplates. The registration is fictional (N452PS; the photographed aircraft is N876ST) and the state name, badge and seal are omitted. Colors are approximate.',
          references: [references.psp],
        },
        paints: {
          ...scheme(space, exterior, INK, stateZones, { roughness: 0.25 }),
          beltline: { color: INK },
          hub: { color: INK },
          ...skids('#202326'),
        },
        markings: [
          ...both('roof-title', 'state-title'),
          ...both('roof-title-edge', 'state-title'),
          ...both('door-low', 'troopers'),
          ...both('boom-reg', 'state-reg'),
          ...both('endplate', 'state-number'),
        ],
      },
      {
        id: 'polish-police-silver-blue',
        label: 'Polish police silver and blue',
        provenance: {
          kind: 'inspired',
          note: 'Polish police Bell 407GXi from the referenced photographs of SN-80XP: light silver overall with a blue band at window-top level that drops onto the middle of the boom, POLICJA in blue on the front door, the fleet code on the rear cabin, the registration in white on the blue boom band and the Polish flag on the doghouse. The registration and code are fictional (SN-86XP, A-107); the police star badge is omitted. Colors are approximate.',
          references: [references.policja],
        },
        paints: {
          ...scheme(space, exterior, PL_SILVER, policjaZones, { roughness: 0.3, metalness: 0.25 }),
          beltline: { color: PL_SILVER },
          hub: { color: PL_SILVER },
          ...skids('#c4c8cb'),
        },
        markings: [
          ...both('front-door-low', 'policja-title'),
          ...both('rear-code', 'policja-code'),
          ...both('boom-reg', 'policja-reg'),
          ...both('doghouse', 'flag-pl'),
        ],
      },
      {
        id: 'air-medical-yellow',
        label: 'Air medical yellow and black',
        provenance: {
          kind: 'inspired',
          note: "US air-medical Bell 407 from the referenced photograph of N462P: signal yellow cabin and doghouse with a broad black swoosh from the lower front door up into the boom and a thinner one from the roof edge, a black boom, fin and stabilizer, black skids, the registration in large black capitals on the lower door and the Star of Life (an original drawing of the generic emergency-medical symbol) on the fin. The registration is fictional (N438P); the operator's name and logo are omitted. Colors and the swoosh curves are approximate.",
          references: [references.n462p],
        },
        paints: {
          ...scheme(space, exterior, MED_YELLOW, medicalZones, { roughness: 0.28 }),
          beltline: { color: INK },
          hub: { color: INK },
          ...skids(INK),
        },
        markings: [...both('door-low', 'med-reg'), ...both('fin-badge', 'star-of-life')],
      },
      {
        id: 'corporate-red-silver',
        label: 'Corporate red and silver',
        provenance: {
          kind: 'inspired',
          note: 'Privately operated Bell 407 from the referenced photograph of N23986: bright red upper body, doghouse, boom and fin over a metallic silver lower body and nose, split by a gold beltline pinstripe, with the registration in white on the boom. The registration is fictional (N24107); colors are approximate.',
          references: [references.n23986],
        },
        paints: {
          ...scheme(
            space,
            exterior,
            CORP_RED,
            [{ color: CORP_SILVER, metalness: 0.35, roughness: 0.3, planes: [P.below(0.826)] }],
            { roughness: 0.25 },
          ),
          beltline: { color: '#c9a13e', metalness: 0.4 },
          hub: { color: CORP_RED },
        },
        markings: [...both('boom-reg', 'corp-reg')],
      },
    ],
  };
}
