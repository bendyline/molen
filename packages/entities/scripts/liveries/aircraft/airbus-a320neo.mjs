/**
 * Airbus A320neo liveries: real operators' paint layouts studied from the referenced photographs,
 * drawn as paint zones on the builder's station tables, with registrations, flags and national
 * markings as original vector art. Civil operators carry no names, logos or wordmarks and their
 * registrations are fictional in the national format; the German Air Force transport carries its
 * real national title, cross and serial.
 */
import { a320neo } from '../../aircraft/airbus-a320neo.mjs';
import {
  foreOf,
  GERMANY,
  region,
  solid,
  stripesFlag,
  studio,
  TRANSPORT,
  transportSlots,
  usFlag,
} from '../art-airliners.mjs';

export function slots(existing) {
  return transportSlots('A20N', existing, { fairing: 'belly-fairing' });
}

const commons = (file, credit) => ({
  title: `${file} (${credit})`,
  url: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, '_'))}`,
});
const REFS = {
  easyjet: commons('EasyJet A320neo at MAN.jpg', 'CC BY-SA 4.0'),
  spirit: commons('Spirit Airbus A320neo N974NK BWI MD2.jpg', 'Acroterion, CC BY-SA 4.0'),
  wizz: commons('9H-WBY A320neo, Wizz Air, Luton 05-27-26.jpg', 'CC BY 4.0'),
  lufthansa: commons('D-AINP Lufthansa A320neo FRA (48736398922).jpg', 'CC BY 2.0'),
  condor: commons('D-ANCX A320neo, Condor, Palma de Mallorca 09-04-26.jpg', 'CC BY 4.0'),
  luftwaffe: commons(
    'Airbus A321-231 (cn 1214, 15+04) 2024-02-16 Andre Gerwing Collection ID 017797.jpg',
    'André Gerwing, CC BY-SA 4.0',
  ),
};

/** A straight line through two points, extended far both ways (for zone half-planes). */
const extend = ([u0, h0], [u1, h1], far = 40) => {
  const du = u1 - u0,
    dh = h1 - h0,
    l = Math.hypot(du, dh);
  return [
    [u0 - (du / l) * far, h0 - (dh / l) * far],
    [u1 + (du / l) * far, h1 + (dh / l) * far],
  ];
};

export default function design(ctx) {
  const S = studio(ctx, a320neo);
  const { k, T, P, space, F } = S;
  const wh = T.win + T.winH / 2,
    wl = T.win - T.winH / 2;

  /* easyJet (2015): white, the orange swoosh from the cockpit down to the belly behind the wing,
     orange rear fuselage, fin, engines and sharklets. */
  const easyjet = (() => {
    const ORANGE = '#ff6408',
      WHITE = '#f6f6f4';
    const lower = [
      [1.2, 2.5],
      [5.6, 2.55],
      [19.5, -0.2],
      [23.6, -1.0],
    ];
    const upper = [
      [1.2, 6],
      [4.6, 6],
      [5.2, 4.3],
      [23.6, -0.2],
    ];
    const rear = [
      [26.0, -0.5],
      [27.4, 1.6],
      [28.4, 2.9],
      [30.2, 4.3],
      [31.0, 5.2],
      [60, 5.2],
    ];
    return {
      paints: {
        ...P.paint(TRANSPORT.skin, WHITE, [
          { color: ORANGE, region: region.band(lower, upper) },
          { color: ORANGE, region: region.below(rear) },
        ]),
        ...solid(TRANSPORT.fin, ORANGE),
        ...solid(TRANSPORT.nacelles, ORANGE),
        ...solid(TRANSPORT.winglets, ORANGE),
        ...solid(TRANSPORT.pylons, '#dfe1e2'),
        ...solid(TRANSPORT.stabilizers, '#dadcdd'),
      },
      markings: [...S.reg('G-UZRW', { u: 31.5, h: 2.3, cap: 0.3, color: WHITE })],
    };
  })();

  /* Spirit Airlines: all-over yellow fuselage, fin, engines and sharklets. */
  const spirit = (() => {
    const YELLOW = '#ffe100',
      INK = '#1b1b1b';
    return {
      paints: {
        ...solid(
          [
            ...TRANSPORT.skin,
            ...TRANSPORT.fin,
            ...TRANSPORT.nacelles,
            ...TRANSPORT.pylons,
            ...TRANSPORT.winglets,
          ],
          YELLOW,
        ),
        ...solid(TRANSPORT.stabilizers, '#b9bdbf'),
      },
      markings: [
        ...S.reg('N938SQ', { u: 31.2, h: 3.3, cap: 0.26, color: INK }),
        ...S.flag('us', usFlag, { u: 30.85, h: 2.95, height: 0.2, aspect: 1.9 }),
        ...S.reg('4938', { u: 30.85, h: 2.7, cap: 0.11, color: INK }),
      ],
    };
  })();

  /* Wizz Air (2015): white front; magenta from a slanted line over the wing, deep purple-blue
     over the lower rear fuselage and the tail cone; purple fin with a magenta upper leading edge;
     magenta engines and sharklets. */
  const wizz = (() => {
    const MAGENTA = '#c6007e',
      PURPLE = '#2d2a85',
      WHITE = '#f6f6f6';
    const split = extend([31.7, 6.3], [36.5, 9.27]);
    return {
      paints: {
        ...P.paint(TRANSPORT.skin, WHITE, [
          { color: MAGENTA, region: region.below(extend([13.6, -0.3], [17.6, 4.3])) },
          { color: PURPLE, region: region.below(extend([17.8, -0.3], [37.6, 3.86])) },
        ]),
        ...P.paint(TRANSPORT.fin, PURPLE, [{ color: MAGENTA, region: region.above(split) }]),
        ...solid(TRANSPORT.nacelles, MAGENTA),
        ...solid(TRANSPORT.winglets, MAGENTA),
        ...solid(TRANSPORT.pylons, '#dcdfe0'),
        ...solid(TRANSPORT.stabilizers, '#c3c6c9'),
      },
      markings: [
        ...S.reg('HA-LQX', { u: 32.4, h: 2.35, cap: 0.26, color: WHITE }),
        ...S.flag('hu', (k2, w, h) => stripesFlag(k2, w, h, ['#ce2939', '#ffffff', '#477050']), {
          u: 33.05,
          h: 2.82,
          height: 0.2,
        }),
      ],
    };
  })();

  /* Lufthansa (2018): white fuselage and engines; deep blue fin with a white leading-edge line,
     the blue carried down over the tail cone. */
  const lufthansa = (() => {
    const BLUE = '#0a1d4e',
      WHITE = '#f5f6f6';
    const le = [5.0, 6.21, 8.21, 9.97].map((h) => [T.finLE(h) + 0.32, h]);
    const strip = foreOfPath([[T.finLE(4.3) + 0.4, 4.0], ...le, [T.finLE(9.97) + 0.5, 11]]);
    return {
      paints: {
        ...P.paint(TRANSPORT.skin, WHITE, [
          { color: BLUE, region: region.below(extend([33.3, 0.5], [34.7, 4.3])) },
        ]),
        ...P.paint(TRANSPORT.fin, BLUE, [{ color: WHITE, region: strip }]),
        ...solid(TRANSPORT.nacelles, '#eeeff0'),
        ...solid(TRANSPORT.pylons, '#e9eaeb'),
        ...solid(TRANSPORT.winglets, WHITE),
        ...solid(TRANSPORT.stabilizers, '#d5d8da'),
      },
      markings: [
        ...S.reg('D-AXQV', { u: 26.6, h: wl - 0.32, cap: 0.26, color: '#17191b' }),
        ...S.flag('de', (k2, w, h) => stripesFlag(k2, w, h, GERMANY), {
          u: 27.75,
          h: wl - 0.32,
          height: 0.24,
          aspect: 5 / 3,
        }),
      ],
    };
  })();

  /* Condor (2022, "Passion" red): red and white bands round the fuselage, red nose and tail
     cone; white fin with red bands parallel to the leading edge and a German flag. */
  const condor = (() => {
    const RED = '#e3001b',
      WHITE = '#f7f7f5';
    const bands = Array.from({ length: 11 }, (_, i) => {
      const u0 = 1.45 + 3.2 * i;
      return [
        [u0, -20],
        [u0 + 1.68, -20],
        [u0 + 1.68, 40],
        [u0, 40],
      ];
    });
    const a = [30.78, 5.21],
      b = [34.77, 9.81];
    const shifted = (d) => extend([a[0] + d, a[1]], [b[0] + d, b[1]]);
    const between = (d0, d1) => {
      const [p0, p1] = shifted(d0),
        [q0, q1] = shifted(d1);
      return [p0, p1, q1, q0];
    };
    return {
      paints: {
        ...P.paint(TRANSPORT.skin, RED, [{ color: WHITE, region: bands }]),
        ...P.paint(TRANSPORT.fin, WHITE, [
          { color: RED, region: [between(1.0, 2.3)] },
          { color: RED, region: region.below(shifted(3.6)) },
        ]),
        ...solid(TRANSPORT.nacelles, '#f1f2f2'),
        ...solid(TRANSPORT.pylons, '#e6e8e9'),
        ...solid(TRANSPORT.winglets, WHITE),
        ...solid(TRANSPORT.stabilizers, '#e4e6e7'),
      },
      markings: [
        ...S.reg('D-ANQR', { u: 27.95, h: wl - 0.3, cap: 0.26, color: '#17191b' }),
        ...S.finArt('de-flag-fin', stripesFlag(k, 0.36, 0.22, GERMANY), {
          u: T.finLE(8.7) + 0.5,
          h: 8.7,
          flipRight: false,
        }),
      ],
    };
  })();

  /* German Air Force special air mission transport (Flugbereitschaft): white, a black-red-gold
     cheatline from the nose to the tail cone, BUNDESREPUBLIK DEUTSCHLAND titles, serial 15+04
     with the national cross, the national flag and LUFTWAFFE on the fin, crosses on the wings. */
  const luftwaffe = (() => {
    const WHITE = '#f1f2f1',
      INK = '#2c3034';
    const hb = wl - 0.42;
    const path = [
      [-0.6, 1.45],
      [2.4, 2.02],
      [5.5, hb],
      [33, hb],
      [37.9, hb + 0.98],
    ];
    const up = (d) => path.map(([u, h]) => [u, h + d]);
    const s = 0.075;
    const serial = (() => {
      const c = new k.Canvas(1.35, 0.42);
      c.text(INK, '15', { x: 0.43, y: 0.21, height: 0.28, align: 'right' });
      k.balkenkreuz(c, 0.675, 0.21, 0.34);
      c.text(INK, '04', { x: 0.92, y: 0.21, height: 0.28, align: 'left' });
      return c;
    })();
    const cross = () => k.balkenkreuz(new k.Canvas(1.3, 1.3), 0.65, 0.65, 1.24);
    // Wing crosses on both upper surfaces, outboard; projectors sit just over the skin.
    for (const side of [1, -1]) {
      const x = side * 11.6,
        u = 19.0,
        h = 2.18 + 0.12;
      const [, y, z] = F.model(x, h, u);
      S.anchors[`wing-cross-${side > 0 ? 'L' : 'R'}`] = space.anchor(
        side > 0 ? 'wing-left' : 'wing-right',
        {
          center: [x, y + 0.1, z],
          facing: [0, 1, 0],
          up: [0, 0, 1],
          width: 1.3,
          height: 1.3,
          depth: 0.34,
        },
      );
    }
    S.graphics['wing-cross'] = cross().graphic('German national cross');
    return {
      paints: {
        ...P.paint(TRANSPORT.skin, WHITE, [
          { color: '#e8b600', region: region.band(path, up(s)) },
          { color: '#d40000', region: region.band(up(s), up(2 * s)) },
          { color: '#141414', region: region.band(up(2 * s), up(3 * s)) },
        ]),
        ...solid(TRANSPORT.fin, WHITE),
        ...solid(TRANSPORT.nacelles, '#e4e6e7'),
        ...solid(TRANSPORT.pylons, '#e4e6e7'),
        ...solid(TRANSPORT.winglets, WHITE),
        ...solid(TRANSPORT.stabilizers, '#dfe1e2'),
      },
      markings: [
        ...S.reg('BUNDESREPUBLIK', {
          u: 9.4,
          h: wh + 0.3,
          cap: 0.3,
          color: INK,
          face: 'regular',
          tracking: 0.14,
        }),
        ...S.reg('DEUTSCHLAND', {
          u: 19.3,
          h: wh + 0.3,
          cap: 0.3,
          color: INK,
          face: 'regular',
          tracking: 0.14,
        }),
        ...S.fuselageArt('serial-15-04', serial, { u: 6.6, h: hb - 0.27, flipRight: false }),
        ...S.finArt('de-flag-tail', stripesFlag(k, 1.0, 0.6, GERMANY, '#2a2a2a'), {
          u: T.finLE(8.4) + 0.95,
          h: 8.4,
          flipRight: false,
        }),
        ...S.finText('LUFTWAFFE', {
          u: T.finLE(4.75) + 2.1,
          h: 4.75,
          cap: 0.22,
          color: INK,
          face: 'regular',
          tracking: 0.12,
        }),
        ...S.finText('04', {
          u: T.finTE(9.6) - 0.3,
          h: 9.6,
          cap: 0.16,
          color: INK,
          slot: 'tail-rudder',
        }),
        { anchor: 'wing-cross-L', graphic: 'wing-cross' },
        { anchor: 'wing-cross-R', graphic: 'wing-cross' },
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
    selected: 'white-orange-tail',
    anchors: S.anchors,
    graphics: S.graphics,
    variants: [
      variant(
        'white-orange-tail',
        'White with orange swoosh and tail',
        easyjet,
        'easyJet scheme (2015) from the referenced photograph: white fuselage with the orange swoosh from the cockpit down to the belly behind the wing, orange rear fuselage and fin, orange engines and sharklets, white registration aft of the rear door. That aircraft also wears a promotional "NEO" decal, which is not reproduced; titles are omitted.' +
          civil,
        [REFS.easyjet],
      ),
      variant(
        'all-over-yellow',
        'All-over yellow',
        spirit,
        'Spirit Airlines scheme from the referenced photograph: all-over bright yellow fuselage, fin, engines, pylons and sharklets, grey tailplanes; registration, small US flag and fleet number aft of the rear door. The black titles are omitted.' +
          civil,
        [REFS.spirit],
      ),
      variant(
        'white-magenta-purple',
        'White, magenta and purple',
        wizz,
        'Wizz Air scheme (2015) from the referenced photograph: white forward fuselage, magenta from a slanted line over the wing, deep purple-blue over the lower rear fuselage and tail cone, purple fin with a magenta upper leading edge, magenta engines and sharklets; white registration with the national flag on the tail cone (Hungarian here; the photographed aircraft is Maltese-registered). Titles and the type lettering are omitted.' +
          civil,
        [REFS.wizz],
      ),
      variant(
        'white-deep-blue-tail',
        'White with deep blue tail',
        lufthansa,
        'Lufthansa scheme (2018) from the referenced photograph: white fuselage and engines, deep blue fin with a white leading-edge line and the blue carried over the tail cone, registration and German flag below the aft windows. The crane emblem, titles and aircraft name are omitted, leaving the fin plain blue; sharklet colour is assumed white.' +
          civil,
        [REFS.lufthansa],
      ),
      variant(
        'red-white-band-stripes',
        'Red with white band stripes',
        condor,
        'Condor "Passion" scheme (2022) from the referenced photograph: red and white bands round the fuselage with a red nose and tail cone, white fin with red bands parallel to the leading edge and a small German flag, white engines and sharklets, registration on a white band. The band count follows the photograph; titles, the bird emblem and "est. 1956" are omitted.' +
          civil,
        [REFS.condor],
      ),
      variant(
        'luftwaffe-flugbereitschaft',
        'German Air Force VIP transport',
        luftwaffe,
        "German Air Force special air mission (Flugbereitschaft) scheme from the referenced photograph of A321 15+04, applied to the A320neo model: white overall with the black-red-gold cheatline from the nose to the tail cone, BUNDESREPUBLIK DEUTSCHLAND titles, serial 15+04 with the national cross, German flag and LUFTWAFFE on the fin, national crosses on the upper wing surfaces (the right wing's is not visible in the photograph). The titles' serif face is approximated with a sans and the federal coat of arms by the nose is omitted.",
        [REFS.luftwaffe],
      ),
    ],
  };
}

/** Polygons forward of a steep path (u increasing with h), one per segment. */
function foreOfPath(path) {
  return path.slice(0, -1).map((a, i) => foreOf(a, path[i + 1]));
}
