/**
 * Bendy Small Airliner liveries: the Bendy house scheme (original, with its BENDY title) and
 * real operators' paint layouts of the cheatline and modern eras, studied from the referenced
 * photographs and adapted to this invented twinjet as paint zones and original vector markings.
 * No operator names, logos or wordmarks; registrations are fictional in the national format.
 *
 * The generator (content/entities/source/aircraft/airliner/models/generate.mjs) exports its
 * table but writes the model when imported, so the stations used here are copied from it.
 */
import { region, solid, studio, usFlag } from '../art-airliners.mjs';

const R = 1.95,
  KEEL = 1.85;
const wingH = (x) => 0.95 + 0.0875 * (x - R);
/** The generator's station tables (body, windows, doors, fin, wing root, engine). */
const AIRLINER = {
  prefix: 'airliner',
  length: 39,
  width: 2 * R,
  bodyHeight: 2 * R,
  stance: [0, 8, KEEL],
  midFraction: 0.5,
  bellyAngle: 2,
  body: [
    [0, 0.02, 1.41, 1.45],
    [0.01, 0.09, 1.35, 1.51],
    [0.04, 0.18, 1.28, 1.58],
    [0.1, 0.28, 1.18, 1.66],
    [0.2, 0.39, 1.07, 1.75],
    [0.35, 0.51, 0.96, 1.83],
    [0.55, 0.64, 0.84, 1.92],
    [0.8, 0.78, 0.7, 2.02],
    [1.05, 0.9, 0.57, 2.11],
    [1.3, 1.02, 0.46, 2.2],
    [1.6, 1.14, 0.35, 2.3],
    [1.85, 1.25, 0.27, 2.56],
    [2.1, 1.35, 0.2, 2.8],
    [2.35, 1.44, 0.15, 3],
    [2.6, 1.52, 0.11, 3.16],
    [2.9, 1.6, 0.08, 3.31],
    [3.4, 1.71, 0.04, 3.5],
    [4, 1.81, 0.01, 3.66],
    [5, 1.91, 0, 3.82],
    [6, 1.945, 0, 3.89],
    [7, R, 0, 2 * R],
    [26, R, 0, 2 * R],
    [27.5, 1.94, 0.06, 2 * R],
    [29, 1.9, 0.22, 2 * R],
    [30.5, 1.82, 0.44, 2 * R],
    [32, 1.7, 0.72, 2 * R],
    [33.5, 1.54, 1.06, 3.89],
    [35, 1.32, 1.46, 3.86],
    [36.5, 1.02, 1.92, 3.8],
    [37.5, 0.74, 2.3, 3.7],
    [38.3, 0.46, 2.66, 3.56],
    [38.8, 0.22, 2.92, 3.42],
    [39, 0.12, 3.02, 3.32],
  ],
  windows: { y: 2.68, w: 0.27, h: 0.42, pitch: 0.85, runs: [{ from: 6.7, count: 29 }] },
  doors: [
    { u0: 5, u1: 5.9, y0: 1.5, y1: 3.35, corner: 0.16 },
    { u0: 31.8, u1: 32.65, y0: 1.5, y1: 3.35, corner: 0.16 },
  ],
  wing: { rows: [[0.3, wingH(0.3), 12.77, 19.65, 0.4]] },
  fin: {
    rows: [
      [3.2, 28.2, 36.4, 0.4],
      [3.9, 28.9, 36.5, 0.36],
      [4.35, 30.6, 36.6, 0.24],
      [4.9, 31.9, 36.75, 0.19],
      [6.5, 33.2, 37.1, 0.16],
      [8.5, 34.8, 37.5, 0.115],
      [10.2, 36.2, 37.85, 0.07],
      [10.35, 36.5, 37.9, 0.03],
    ],
    rudder: { from: 4.5, to: 10.1, chord: 0.3 },
  },
  engine: { kind: 'turbofan', x: 5.8, u: 13.3, h: 0.4 },
};

export function slots(existing) {
  return {
    ...existing,
    'gear-door-left': { materials: ['airliner-belly'], node: 'gear-0-door-left' },
    'gear-door-right': { materials: ['airliner-belly'], node: 'gear-0-door-right' },
  };
}

const G = {
  // The cheatline strips ride 6 mm over the skin: schemes without one paint them as the skin.
  skin: ['body-cabin', 'body-belly', 'body-belly-fairing', 'gear-door-left', 'gear-door-right'],
  cheat: ['accent-cheatline', 'accent-cheatline-right'],
  fin: ['accent-fin-surface'],
  stabilizers: ['body-stabilizer-left', 'body-stabilizer-right'],
  nacelles: ['body-nacelle', 'body-nacelle_1'],
  pylons: ['body-pylon', 'body-pylon_1'],
  wings: ['body-wing-left', 'body-wing-right'],
  controls: ['body-flap-left', 'body-flap-right'],
};

const commons = (file, credit) => ({
  title: `${file} (${credit})`,
  url: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, '_'))}`,
});
const REFS = {
  eastern: commons('McDonnell Douglas DC-9-31, Eastern Air Lines JP5952972.jpg', 'GFDL 1.2'),
  braniff: commons(
    'Braniff International Airways BAC 111-203AE One-Eleven N1552.jpg',
    'Steve Williams, CC BY-SA 4.0',
  ),
  airfrance: commons('F-GFKM Air France (4236790891).jpg', 'CC BY-SA 2.0'),
  panam: commons('Boeing 727-235, Pan Am JP6008059.jpg', 'CC BY-SA 3.0'),
};

export default function design(ctx) {
  const S = studio(ctx, AIRLINER, {
    skin: 'body-cabin',
    belly: 'body-belly',
    fin: 'accent-fin-surface',
  });
  const { k, T, P } = S;
  const wh = T.win + T.winH / 2,
    wl = T.win - T.winH / 2;

  /* Bendy house colours: white, the blue cheatline sweeping down round the nose, blue fin,
     grey belly, the BENDY title on the forward fuselage. */
  const bendy = (() => {
    const BLUE = '#1f4f8c';
    return {
      paints: {
        ...solid(['body-cabin'], '#f3f4f2'),
        ...solid(
          ['body-belly', 'body-belly-fairing', 'gear-door-left', 'gear-door-right'],
          '#b9bfc4',
        ),
        ...solid(G.cheat, BLUE),
        ...solid(G.fin, BLUE),
        ...solid([...G.stabilizers, ...G.nacelles, ...G.pylons], '#f3f4f2'),
        ...solid(G.wings, '#c9cdd0'),
        ...solid(G.controls, '#b9bfc4'),
      },
      markings: [
        ...S.reg('BENDY', { u: 9.6, h: 1.72, cap: 0.5, color: BLUE, tracking: 0 }),
        ...S.reg('N390BD', { u: 30.2, h: wh + 0.3, cap: 0.28, color: '#22262a' }),
      ],
    };
  })();

  /* Eastern Air Lines "hockey stick" (1970s): polished metal, a light blue window band over a
     navy band, a navy nose cap, the two bands turning up the fin's leading edge. */
  const eastern = (() => {
    const METAL = '#bcc2c6',
      LIGHT = '#5aa0d8',
      NAVY = '#1b2f6b';
    const metal = { metalness: 0.65, roughness: 0.3 };
    const hb = wl - 0.1;
    // Band centrelines: along the fuselage, bending up over the tail cone into the fin.
    const turn = (h0) => [
      [-1, h0],
      [25.6, h0],
      [29.4, T.D + 0.25],
    ];
    const lightTop = wh + 0.1;
    const fuselage = [
      { color: LIGHT, region: region.band(turn(hb), turn(lightTop)) },
      { color: NAVY, region: region.band(turn(hb - 0.36), turn(hb)) },
      { color: NAVY, region: region.fore(1.3) },
    ];
    // Up the fin: parallel to the main leading edge, as two strips behind it.
    const le = (h) => T.finLE(h);
    const finStrip = (d0, d1) => [
      [le(3.9) + d0 - 0.4, 3.5],
      [le(3.9) + d1 - 0.4, 3.5],
      [le(10.35) + d1, 10.6],
      [le(10.35) + d0, 10.6],
    ];
    return {
      paints: {
        ...P.paint([...G.skin, ...G.cheat], METAL, fuselage, metal),
        ...P.paint(
          G.fin,
          METAL,
          [
            { color: LIGHT, region: [finStrip(0.35, 0.9)] },
            { color: NAVY, region: [finStrip(0.9, 1.4)] },
          ],
          metal,
        ),
        ...solid([...G.stabilizers, ...G.nacelles, ...G.pylons], METAL, metal),
      },
      markings: [
        ...S.reg('N8937Q', { u: 23.5, h: hb - 0.62, cap: 0.3, color: '#1d2024' }),
        ...S.reg('937', { u: 0.95, h: 1.55, cap: 0.2, color: '#f4f5f6' }),
        ...S.flag('us', usFlag, { u: 8.2, h: wh + 0.42, height: 0.32, aspect: 1.9 }),
      ],
    };
  })();

  /* Braniff International "Flying Colors" (1965): the fuselage in one bold solid colour (orange
     here), white fin, tailplanes and engines, a US flag high on the fin. */
  const braniff = (() => {
    const ORANGE = '#e0662a',
      WHITE = '#f2f2ef';
    return {
      paints: {
        ...solid([...G.skin, ...G.cheat], ORANGE),
        ...solid([...G.fin, ...G.stabilizers, ...G.nacelles, ...G.pylons], WHITE),
        ...solid(G.wings, '#cfd3d6'),
      },
      markings: [
        ...S.reg('N1564', { u: 30.4, h: 1.82, cap: 0.3, color: '#1d1d1d' }),
        ...S.finArt('us-flag-fin', usFlag(k, 0.95, 0.5), { u: T.finLE(9.2) + 0.75, h: 9.2 }),
      ],
    };
  })();

  /* Air France (2009): white, light grey belly, white fin with navy, navy and red stripes
     across its aft part, parallel to the leading edge. */
  const airfrance = (() => {
    const NAVY = '#0b1f5c',
      RED = '#e2231a',
      WHITE = '#f3f4f4';
    const at = (f, h) => T.finLE(h) + f * (T.finTE(h) - T.finLE(h));
    const stripe = (f0, f1) =>
      [
        [at(f0, 4.0), 4.0],
        [at(f1, 4.0), 4.0],
        [at(f1, 10.3), 10.3],
        [at(f0, 10.3), 10.3],
      ].map(([u, h], i) => (i < 2 ? [u - 0.6 * (f1 - f0 + 1), h - 0.7] : [u, h + 0.2]));
    return {
      paints: {
        ...P.paint([...G.skin, ...G.cheat], WHITE, [
          {
            color: '#dfe2e4',
            region: region.below([
              [-1, 0.9],
              [26, 0.9],
              [40, 2.6],
            ]),
          },
        ]),
        ...P.paint(G.fin, WHITE, [
          { color: NAVY, region: [stripe(0.4, 0.58)] },
          { color: NAVY, region: [stripe(0.64, 0.7)] },
          { color: RED, region: [stripe(0.77, 0.97)] },
        ]),
        ...solid([...G.stabilizers, ...G.pylons], '#e2e4e5'),
        ...solid(G.nacelles, '#e9ebec'),
      },
      markings: [...S.reg('F-HBQZ', { u: 30.2, h: wh + 0.3, cap: 0.28, color: '#1b1d20' })],
    };
  })();

  const variant = (id, label, kind, scheme, note, refs) => ({
    id,
    label,
    provenance: { kind, note, references: refs },
    paints: scheme.paints,
    markings: scheme.markings,
  });
  const civil =
    ' Adapted to this invented twinjet. No operator titles, logos or emblems; the registration is fictional, in the national format.';
  return {
    selected: 'bendy-house',
    anchors: S.anchors,
    graphics: S.graphics,
    variants: [
      variant(
        'bendy-house',
        'Bendy house colours',
        'inspired',
        bendy,
        "Bendy's own house scheme for its invented airliner (not an operator's), in a classic white-and-blue cheatline style: white, the blue cheatline sweeping down round the nose, blue fin, grey belly and the BENDY title on the forward fuselage (moved from the model's geometry into the livery so other schemes carry no title). The referenced photograph shows the white-and-blue cheatline style it follows; nothing of that operator's markings is used. The registration is fictional.",
        [REFS.panam],
      ),
      variant(
        'metal-blue-hockey-stick',
        'Polished metal, blue hockey-stick stripe',
        'inspired',
        eastern,
        'Eastern Air Lines "hockey stick" scheme (1970s) from the referenced photograph: polished-metal fuselage, light blue window band over a navy band, navy nose cap with the fleet number, the two bands turning up the fin\'s leading edge, US flag above the forward windows. The bands\' bend over the tail cone is simplified; the falcon emblem and titles are omitted.' +
          civil,
        [REFS.eastern],
      ),
      variant(
        'all-over-orange-1965',
        'All-over orange, 1965',
        'inspired',
        braniff,
        'Braniff International "Flying Colors" scheme (1965, Alexander Girard) from the referenced photograph: the fuselage in one bold solid colour (orange), white fin, tailplanes and engines, US flag high on the fin. The BI emblem and titles are omitted.' +
          civil,
        [REFS.braniff],
      ),
      variant(
        'white-blue-red-tail-stripes',
        'White with blue and red tail stripes',
        'inspired',
        airfrance,
        "Air France scheme (2009) from the referenced photograph: white fuselage over a light grey belly, white engines, the fin's navy, navy and red stripes across its aft part. Titles and the logo dash are omitted." +
          civil,
        [REFS.airfrance],
      ),
    ],
  };
}
