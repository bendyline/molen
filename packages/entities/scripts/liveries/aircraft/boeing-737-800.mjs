/**
 * Boeing 737-800 liveries: real operators' paint layouts studied from the referenced photographs,
 * drawn as paint zones on the builder's own station tables (belly lines, sweeps, tail stripes)
 * with registrations, flags and military markings as original vector art. Civil operators carry
 * no names, logos or wordmarks; registrations are fictional in each country's format. The US
 * Navy P-8A carries its real national insignia, NAVY title and modex.
 */
import { b737 } from '../../aircraft/boeing-737-800.mjs';
import {
  americanScheme,
  deltaScheme,
  klmScheme,
  region,
  sectionPath,
  solid,
  studio,
  TRANSPORT,
  transportSlots,
  usFlag,
} from '../art-airliners.mjs';

export function slots(existing) {
  return transportSlots('B738', existing);
}

const commons = (file, credit) => ({
  title: `${file.replace(/_/g, ' ')} (${credit})`,
  url: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, '_'))}`,
});
const REFS = {
  southwest: commons('Southwest Boeing 737-800 N8523W BWI MD1.jpg', 'Acroterion, CC BY-SA 4.0'),
  ryanair: commons(
    'Ryanair - Boeing 737-800 - EI-EKV - Orio al Serio International Airport-7872.jpg',
    'CC BY-SA 4.0',
  ),
  klm: commons('KLM Boeing 737-800 PH-BXI at Schiphol 03-03-2022.jpg', 'CC BY-SA 4.0'),
  american: commons('American Boeing 737-800 N923NN DCA VA1.jpg', 'Acroterion, CC BY-SA 4.0'),
  delta: commons(
    'Delta Air Lines Boeing 737-800 N377DA departing Boston June 2025.jpg',
    'CC BY 4.0',
  ),
  p8: commons('P-8A Poseidon VX-20 Squadron.jpg', 'US Navy, public domain'),
};

export default function design(ctx) {
  const S = studio(ctx, b737);
  const { k, T, P } = S;
  const wh = T.win + T.winH / 2;

  /* Southwest "Heart" (2014): Bold Blue, with a sunrise-yellow and warm-red sweep over the rear
     fuselage and up the fin, fine white lines between the colours and a blue tail cone. */
  const southwest = (() => {
    const BLUE = '#2f4bb0',
      RED = '#d8282f',
      YELLOW = '#f9bd1d',
      WHITE = '#f4f4f2';
    const line = (u0, slope, du = 0) => [
      [u0 + du, -0.5],
      [u0 + du + 40, -0.5 + 40 * slope],
    ];
    const lower = [
      [29.4, -0.4],
      [32, 1.25],
      [39.5, 3.45],
      [45, 5.1],
    ];
    // The yellow band's aft edge up the fin (fin stations), extended past root and tip.
    const fin = [
      [34.05, 2.4],
      [34.25, 3.4],
      [35.05, 7.0],
      [37.85, 11.2],
      [38.3, 12.4],
    ];
    const fore = (path, du = 0) =>
      path.slice(0, -1).map((a, i) => {
        const b = path[i + 1];
        return [
          [a[0] + du - 80, a[1]],
          [a[0] + du, a[1]],
          [b[0] + du, b[1]],
          [b[0] + du - 80, b[1]],
        ];
      });
    const winglet = [
      {
        color: WHITE,
        region: region.above([
          [-50, 4.12],
          [200, 4.12],
        ]),
      },
      {
        color: RED,
        region: region.above([
          [-50, 4.2],
          [200, 4.2],
        ]),
      },
      {
        color: WHITE,
        region: region.above([
          [-50, 4.84],
          [200, 4.84],
        ]),
      },
      {
        color: YELLOW,
        region: region.above([
          [-50, 4.92],
          [200, 4.92],
        ]),
      },
    ];
    return {
      paints: {
        ...P.paint(TRANSPORT.skin, BLUE, [
          { color: WHITE, region: region.below(line(21.6, 0.643)) },
          { color: YELLOW, region: region.below(line(21.6, 0.643, 0.22)) },
          { color: WHITE, region: region.below(line(27.0, 0.643)) },
          { color: RED, region: region.below(line(27.0, 0.643, 0.22)) },
          { color: WHITE, region: region.below(lower) },
          { color: BLUE, region: region.below(lower.map(([u, h]) => [u, h - 0.14])) },
        ]),
        ...P.paint(TRANSPORT.fin, RED, [
          { color: WHITE, region: fore(fin, 0.2) },
          { color: YELLOW, region: fore(fin) },
        ]),
        ...P.paint(TRANSPORT.winglets, BLUE, winglet),
        ...solid(TRANSPORT.stabilizers, '#b9bdc0'),
        ...solid(TRANSPORT.nacelles, BLUE),
        ...solid(TRANSPORT.pylons, BLUE),
      },
      markings: [
        ...S.reg('N8574Q', { u: 29.9, h: wh + 0.3, cap: 0.3, color: '#22388a' }),
        ...S.flag('us', usFlag, { u: 30.9, h: 3.62, height: 0.34, aspect: 1.9 }),
      ],
    };
  })();

  /* Ryanair: white over a Ryanair-blue belly behind a gold cheatline that runs from the radome to
     the tail cone and round the engine cowls; blue fin and winglets. */
  const ryanair = (() => {
    const BLUE = '#0a2f8f',
      GOLD = '#f1c932',
      WHITE = '#f5f6f4';
    const line = sectionPath(T, [
      [-1, 0.46],
      [2.6, 0.33],
      [8, 0.31],
      [29, 0.31],
      [34, 0.31],
      [38.6, 0.34],
    ]);
    const t = 0.055;
    const cowl = T.engine.h + 0.05;
    return {
      paints: {
        ...P.paint(TRANSPORT.skin, WHITE, [
          { color: BLUE, region: region.below(line.map(([u, h]) => [u, h - t])) },
          { color: GOLD, region: region.stripe(line, 2 * t) },
        ]),
        ...P.paint(TRANSPORT.nacelles, WHITE, [
          {
            color: GOLD,
            region: [
              [
                [-50, cowl - 0.05],
                [200, cowl - 0.05],
                [200, cowl + 0.05],
                [-50, cowl + 0.05],
              ],
            ],
          },
          {
            color: BLUE,
            region: region.below([
              [-50, cowl - 0.05],
              [200, cowl - 0.05],
            ]),
          },
        ]),
        ...solid(TRANSPORT.fin, BLUE),
        ...solid(TRANSPORT.winglets, BLUE),
        ...solid(TRANSPORT.stabilizers, '#d8dbdc'),
        ...solid(TRANSPORT.pylons, '#d8dbdc'),
      },
      markings: [
        ...S.reg('EI-RVQ', { u: 29.7, h: wh + 0.3, cap: 0.3, color: BLUE }),
        ...S.flag('ie', irelandFlag, { u: 28.55, h: wh + 0.3, height: 0.3 }),
      ],
    };
  })();

  /* US Navy P-8A Poseidon: one light grey overall, the cabin windows mostly faired over, NAVY
     title and national insignia aft of the wing, modex on the fin and nose. */
  const poseidon = (() => {
    const GREY = '#a9afb3',
      INK = '#1d2023';
    const everything = [
      ...TRANSPORT.skin,
      ...TRANSPORT.fin,
      ...TRANSPORT.stabilizers,
      ...TRANSPORT.nacelles,
      ...TRANSPORT.pylons,
      ...TRANSPORT.winglets,
      ...TRANSPORT.wings,
      'wing-controls',
      'cabin-windows',
    ];
    return {
      paints: { ...solid(everything, GREY, { roughness: 0.55 }) },
      markings: [
        ...S.reg('NAVY', {
          u: 26.8,
          h: 1.9,
          cap: 0.9,
          color: INK,
          face: 'regular',
          tracking: 0.1,
        }),
        ...S.fuselageArt('us-insignia', insigniaCanvas(k, 0.42), {
          u: 23.4,
          h: 2.2,
          flipRight: false,
        }),
        ...S.finText('951', { u: T.finLE(9.9) + 0.75, h: 9.9, cap: 0.34, color: INK }),
        ...S.reg('951', { u: 3.2, h: 2.0, cap: 0.24, color: INK }),
      ],
    };
  })();

  const variant = (id, label, scheme, note, refs) => ({
    id,
    label,
    provenance: { kind: 'inspired', note, references: refs },
    paints: scheme.paints,
    markings: scheme.markings,
  });
  const civil =
    ' No operator titles, logos or emblems; the registration is fictional, in the national format.';
  return {
    selected: 'bold-blue-heart-sweep',
    anchors: S.anchors,
    graphics: S.graphics,
    variants: [
      variant(
        'bold-blue-heart-sweep',
        'Bold blue with red and yellow tail sweep',
        southwest,
        'Southwest Airlines "Heart" scheme (2014) from the referenced photograph: Bold Blue fuselage, engines and pylons; the sunrise-yellow and warm-red sweep over the rear fuselage and up the fin with fine white lines between the colours and a blue tail cone; blue, red and yellow winglets; US flag and registration on the yellow. The belly heart and titles are omitted.' +
          civil,
        [REFS.southwest],
      ),
      variant(
        'white-navy-belly-gold-line',
        'White over navy belly, gold cheatline',
        ryanair,
        'Ryanair scheme from the referenced photograph: white over the dark blue belly behind a gold cheatline that runs from the radome to the tail cone and carries round the engine cowls; dark blue fin and winglets; Irish flag and registration above the aft windows. The harp emblem, titles and winglet lettering are omitted.' +
          civil,
        [REFS.ryanair],
      ),
      variant(
        'sky-blue-upper-white-fin',
        'Sky blue upper body, white fin',
        klmScheme(S, { reg: 'PH-BKW' }),
        'KLM scheme from the referenced photograph: KLM blue over the top of the fuselage and nose, the fine dark blue line sweeping down to the radome, light grey belly, white fin, grey engines, blue winglets; EU and Dutch flags with a white registration above the aft windows. The crown logo, titles and the bird name are omitted.' +
          civil,
        [REFS.klm],
      ),
      variant(
        'silver-flag-stripe-tail',
        'Silver with flag-stripe tail',
        americanScheme(S, { reg: 'N978NQ', fleet: '3PL' }),
        "American Airlines 2013 scheme from the referenced photograph: silver mica fuselage, engines and winglets; the stylised flag on the fin, blue and white stripes forward and red and white aft over a red root band, with a red band over the tail cone; registration, fleet number and US flag below the aft windows. The Flight Symbol and titles are omitted; the stripes' metallic shading is flat." +
          civil,
        [REFS.american],
      ),
      variant(
        'white-navy-belly-navy-tail',
        'White over navy belly, navy tail',
        deltaScheme(S, { reg: 'N3829Z', ship: '3829' }),
        "Delta Air Lines 2007 scheme from the referenced photograph: white over the navy belly from the radome to the rear door, navy fin carried forward over the tail cone, navy engines and winglets; US flag and registration above the aft windows, ship number on the fin tip. The red tail widget is Delta's logo and is omitted, leaving the fin navy; titles are omitted." +
          civil,
        [REFS.delta],
      ),
      variant(
        'us-navy-p8a',
        'US Navy P-8A Poseidon grey',
        poseidon,
        "US Navy P-8A Poseidon (a 737-800 derivative) from the referenced US Navy photograph of VX-20's aircraft 951: light grey overall with most cabin windows faired over, NAVY title and full-colour national insignia aft of the wing, modex 951 on the fin and nose. Applied to the airliner model: the P-8A's raked wingtips, sensor fairings and antennas are not modelled, and the grey is an approximation.",
        [REFS.p8],
      ),
    ],
  };
}

/** Ireland: green, white, orange, vertical. */
function irelandFlag(k, w, h) {
  const c = new k.Canvas(w, h);
  for (const [i, color] of ['#169b62', '#ffffff', '#ff883e'].entries())
    c.rect(color, (i * w) / 3, 0, w / 3, h);
  return c;
}

function insigniaCanvas(k, r) {
  return k.usInsignia(new k.Canvas(4.34 * r, 2.2 * r), 2.17 * r, 1.1 * r, r);
}
