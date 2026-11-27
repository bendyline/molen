/**
 * Airbus A220-300 liveries: real operators' paint layouts studied from the referenced photographs,
 * drawn as paint zones on the builder's station tables, with registrations, flags and abstract
 * tail patterns as original vector art. No operator names, logos or wordmarks; registrations are
 * fictional in the national format.
 */
import { a220 } from '../../aircraft/airbus-a220-300.mjs';
import {
  canadaFlag,
  deltaScheme,
  euFlag,
  latviaFlag,
  region,
  sectionPath,
  solid,
  studio,
  TRANSPORT,
  transportSlots,
  usFlag,
} from '../art-airliners.mjs';

export function slots(existing) {
  return transportSlots('BCS3', existing);
}

const commons = (file, credit) => ({
  title: `${file} (${credit})`,
  url: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, '_'))}`,
});
const REFS = {
  airbaltic: commons(
    'Frankfurt Airport airBaltic Airbus A220-300 YL-ABL (DSC09548).jpg',
    'CC BY-SA 4.0',
  ),
  delta: commons(
    'Delta Air Lines Airbus A220-300 N307DU departing Boston November 2025 1.jpg',
    'CC BY 4.0',
  ),
  jetblue: commons('JetBlue Airbus A220-300 N3112J MD1.jpg', 'Acroterion, CC BY-SA 4.0'),
  aircanada: commons('Air Canada A220-300 C-GUAC @YYZ.jpg', 'CC BY-SA 4.0'),
  korean: commons(
    'Korean Air A220-300 (HL8312) at Narita International Airport.jpg',
    'CC BY-SA 3.0',
  ),
  korean2: commons('Korean Air Airbus A220-300 HL8314 (48946393983).jpg', 'CC BY-SA 2.0'),
};

/** A line through two side-view points, moved down by d and extended far both ways. */
const line = ([u0, h0], [u1, h1], d = 0, far = 40) => {
  const du = u1 - u0,
    dh = h1 - h0,
    l = Math.hypot(du, dh);
  return [
    [u0 - (du / l) * far, h0 - d - (dh / l) * far],
    [u1 + (du / l) * far, h1 - d + (dh / l) * far],
  ];
};

/** A thin belly band of a fraction `f` of the local section, from the radome to the tail cone. */
const bellyBand = (T, f) =>
  sectionPath(T, [
    [-1, f + 0.12],
    [T.nose * 0.25, f + 0.02],
    [T.nose, f],
    [T.tail, f],
    [T.tail + (T.L - T.tail) * 0.55, f],
    [T.L + 1, f + 0.12],
  ]);

/**
 * JetBlue's diagonal "streamer" bands, an original abstraction: navy, mid and light blue bands
 * rising aft across the fin, offset half a period in a strip behind the leading edge so the band
 * ends step like the photographed tail. Canvas x runs aft from u0, y up from h0 (metres).
 */
function streamerTail(k, T, { u0, h0, w, h }) {
  const NAVY = '#14306f',
    MID = '#1f74cc',
    LIGHT = '#5cb6ec';
  const c = new k.Canvas(w, h);
  c.rect(MID, 0, 0, w, h);
  const slope = 0.42,
    period = 1.7,
    bands = [
      [NAVY, 0, 0.42],
      [LIGHT, 0.85, 1.2],
    ];
  // Leading-edge strip: a band 0.9 m wide parallel to the fin's leading edge.
  const le = (hh) => T.finLE(h0 + hh) - u0;
  const stripEdge = (hh) => le(hh) + 0.9;
  const band = (lo, hi, shift, clip) => {
    for (let n = -8; n < 12; n++) {
      const b0 = n * period + lo + shift,
        b1 = n * period + hi + shift;
      // A parallelogram across the canvas: y = b + slope x, with a gentle bow (+0.03 x^2).
      const ys = (x, b) => b + slope * x - 0.015 * x * x;
      const xs = Array.from({ length: 9 }, (_, i) => (i * w) / 8);
      const lower = xs.map((x) => [x, ys(x, b0)]);
      const upper = xs.map((x) => [x, ys(x, b1)]).reverse();
      const poly = [...lower, ...upper].map(([x, y]) => [x, y]);
      if (clip) {
        // Only inside the leading-edge strip: keep points forward of the strip's aft edge.
        const kept = poly.map(([x, y]) => [Math.min(x, stripEdge(Math.max(0, Math.min(h, y)))), y]);
        c.add(clip, kept);
      } else c.add(band.color, poly);
    }
  };
  for (const [color, lo, hi] of bands) {
    band.color = color;
    band(lo, hi, 0, null);
  }
  // The stepped strip: repaint it mid blue, then the same bands shifted half a period.
  const strip = [];
  for (let i = 0; i <= 12; i++) {
    const hh = (i * h) / 12;
    strip.push([Math.max(0, le(hh) - 2), hh]);
  }
  for (let i = 12; i >= 0; i--) {
    const hh = (i * h) / 12;
    strip.push([stripEdge(hh), hh]);
  }
  c.add(MID, strip);
  for (const [color, lo, hi] of bands) band(lo, hi, period / 2, color);
  return c;
}

export default function design(ctx) {
  const S = studio(ctx, a220);
  const { k, T, P } = S;
  const wh = T.win + T.winH / 2,
    wl = T.win - T.winH / 2;

  /* airBaltic: white, the lime sweep over the lower rear fuselage up to the fin, lime fin,
     engines and winglets, white tail cone. */
  const airbaltic = (() => {
    const LIME = '#bfd22b',
      WHITE = '#f5f6f5';
    const sweep = [
      [25.0, -0.3],
      [27.5, 1.2],
      [29.4, 2.8],
      [30.6, 3.85],
      [60, 3.9],
    ];
    return {
      paints: {
        ...P.paint(TRANSPORT.skin, WHITE, [
          { color: LIME, region: region.below(sweep) },
          { color: WHITE, region: region.above(line([35.7, 3.4], [36.5, 1.9])) },
        ]),
        ...solid(TRANSPORT.fin, LIME),
        ...solid(TRANSPORT.nacelles, LIME),
        ...solid(TRANSPORT.winglets, LIME),
        ...solid(TRANSPORT.pylons, '#e2e4e5'),
        ...solid(TRANSPORT.stabilizers, '#dcdedf'),
      },
      markings: [
        ...S.reg('YL-ACX', { u: 27.0, h: wl - 0.3, cap: 0.26, color: '#1c2a5a' }),
        ...S.flag('lv', latviaFlag, {
          u: 26.0,
          h: wl - 0.3,
          height: 0.22,
          aspect: 2,
          forward: false,
        }),
        ...S.flag('eu', euFlag, { u: 25.45, h: wl - 0.3, height: 0.22 }),
      ],
    };
  })();

  /* JetBlue: white over a navy belly band, navy engines and winglets, the fin in diagonal blue
     streamer bands. */
  const jetblue = (() => {
    const NAVY = '#0f2c6b',
      WHITE = '#f4f5f4';
    const box = { u0: 29.0, h0: T.D - 0.3, w: 9.2, h: T.finTip - T.D + 0.6 };
    const canvas = streamerTail(k, T, box);
    const at = { u: box.u0 + box.w / 2, h: box.h0 + box.h / 2 };
    return {
      paints: {
        ...P.paint(TRANSPORT.skin, WHITE, [
          { color: NAVY, region: region.below(bellyBand(T, 0.2)) },
        ]),
        ...solid(TRANSPORT.fin, '#1f74cc'),
        ...solid(TRANSPORT.nacelles, '#173a86'),
        ...solid(TRANSPORT.winglets, NAVY),
        ...solid(TRANSPORT.pylons, '#d9dcdd'),
        ...solid(TRANSPORT.stabilizers, '#d0d3d5'),
      },
      markings: [
        ...S.finArt('streamer-tail', canvas, { ...at, depth: 0.8 }),
        ...S.finArt('streamer-tail', canvas, { ...at, depth: 0.8, slot: 'tail-rudder' }),
        ...S.reg('N3271Q', { u: T.lastWindow - 0.9, h: wh + 0.28, cap: 0.26, color: NAVY }),
        ...S.flag('us', usFlag, {
          u: T.lastWindow - 2.25,
          h: wh + 0.28,
          height: 0.24,
          aspect: 1.9,
        }),
      ],
    };
  })();

  /* Air Canada (2017): white over a black belly band, black fin, engines and winglets. */
  const aircanada = (() => {
    const BLACK = '#18191b',
      WHITE = '#f5f6f6';
    return {
      paints: {
        ...P.paint(TRANSPORT.skin, WHITE, [
          { color: BLACK, region: region.below(bellyBand(T, 0.17)) },
        ]),
        ...solid(TRANSPORT.fin, BLACK),
        ...solid(TRANSPORT.nacelles, BLACK),
        ...solid(TRANSPORT.winglets, BLACK),
        ...solid(TRANSPORT.pylons, '#dcdfe0'),
        ...solid(TRANSPORT.stabilizers, '#d6d9db'),
      },
      markings: [
        ...S.reg('C-GQYZ', { u: T.lastWindow - 0.9, h: wh + 0.28, cap: 0.26, color: BLACK }),
        ...S.flag('ca', canadaFlag, {
          u: T.lastWindow - 2.25,
          h: wh + 0.28,
          height: 0.24,
          aspect: 2,
        }),
        ...S.finText('157', {
          u: T.finLE(T.finTip - 0.3) + 0.6,
          h: T.finTip - 0.3,
          cap: 0.17,
          color: WHITE,
        }),
      ],
    };
  })();

  /* Korean Air: sky blue upper fuselage and fin over a silver belly behind a fine white line,
     white engines; registration on the fin and a small national flag at its tip. */
  const korean = (() => {
    const SKY = '#6cbfe3',
      SILVER = '#c5c9cc',
      WHITE = '#f2f4f5',
      NAVY = '#1f3b77';
    const f = 0.35;
    const path = sectionPath(T, [
      [-1, 0.25],
      [T.nose * 0.3, 0.28],
      [T.nose, f],
      [T.L + 1, f],
    ]).map(([u, h], i, all) => (i === all.length - 1 ? [u, all[i - 1][1]] : [u, h]));
    return {
      paints: {
        ...P.paint(TRANSPORT.skin, SKY, [
          { color: SILVER, region: region.below(path.map(([u, h]) => [u, h - 0.04])) },
          { color: WHITE, region: region.stripe(path, 0.08) },
        ]),
        ...solid(TRANSPORT.fin, SKY),
        ...solid(TRANSPORT.nacelles, '#eef0f1'),
        ...solid(TRANSPORT.pylons, '#dde0e2'),
        ...solid(TRANSPORT.winglets, SKY),
        ...solid(TRANSPORT.stabilizers, '#9ccde3'),
      },
      markings: [
        ...S.finText('HL8396', {
          u: T.finLE(T.D + 0.95) + 1.7,
          h: T.D + 0.95,
          cap: 0.3,
          color: NAVY,
        }),
        ...S.finArt('kr-flag', koreaFlag(k, 0.42, 0.28), {
          u: T.finLE(T.finTip - 0.35) + 0.55,
          h: T.finTip - 0.35,
        }),
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
    selected: 'white-lime-sweep',
    anchors: S.anchors,
    graphics: S.graphics,
    variants: [
      variant(
        'white-lime-sweep',
        'White with lime sweep and tail',
        airbaltic,
        'airBaltic scheme from the referenced photograph: white fuselage with the lime sweep over the lower rear fuselage up into the fin, white tail cone, lime fin, engines and winglets; registration with the Latvian and EU flags below the aft windows. Titles are omitted.' +
          civil,
        [REFS.airbaltic],
      ),
      variant(
        'white-navy-belly-navy-tail',
        'White over navy belly, navy tail',
        deltaScheme(S, { reg: 'N352DZ', ship: '3052' }),
        "Delta Air Lines 2007 scheme from the referenced photograph: white over the navy belly from the radome to the rear door, navy fin carried forward over the tail cone, navy engines and winglets, US flag and registration above the aft windows, ship number on the fin tip. The red tail widget is Delta's logo and is omitted, leaving the fin navy; titles are omitted." +
          civil,
        [REFS.delta],
      ),
      variant(
        'navy-belly-streamer-tail',
        'White with navy belly and streamer tail',
        jetblue,
        'JetBlue scheme from the referenced photograph: white over a narrow navy belly band, navy engines and winglets, the fin in diagonal navy, blue and light-blue streamer bands (redrawn as straight-sided, gently bowed bands with the stepped leading-edge column), registration and US flag above the aft windows. The fin wordmark and titles are omitted.' +
          civil,
        [REFS.jetblue],
      ),
      variant(
        'white-black-belly-black-tail',
        'White with black belly band and tail',
        aircanada,
        "Air Canada scheme (2017) from the referenced photograph: white over a black belly band, black fin, engines and winglets, Canadian flag and registration above the aft windows, fleet number on the fin tip. The maple-leaf roundel is the operator's logo and is omitted, leaving the fin plain black; titles are omitted." +
          civil,
        [REFS.aircanada],
      ),
      variant(
        'sky-blue-over-silver',
        'Sky blue over silver',
        korean,
        "Korean Air scheme from the referenced photographs: sky blue upper fuselage, fin and tailplanes over a silver belly behind a fine white line, white engines, registration on the fin and a small national flag at its tip. The taegeuk emblem on the fin and engines is the operator's logo and is omitted; titles are omitted." +
          civil,
        [REFS.korean, REFS.korean2],
      ),
    ],
  };
}

/** South Korean flag, simplified: white field, red and blue taegeuk, four trigrams. */
function koreaFlag(k, w, h) {
  const c = new k.Canvas(w, h);
  c.rect('#ffffff', 0, 0, w, h);
  const cx = w / 2,
    cy = h / 2,
    r = h * 0.25;
  c.circle('#cd2e3a', cx, cy, r, 32);
  const half = Array.from({ length: 17 }, (_, i) => {
    const a = Math.PI + 0.5 + (i * Math.PI) / 16;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
  c.add('#0047a0', half);
  const bar = h * 0.035,
    len = h * 0.16;
  for (const [sx, sy, a] of [
    [-1, 1, -0.98],
    [1, -1, -0.98],
    [1, 1, 0.98],
    [-1, -1, 0.98],
  ]) {
    const bx = cx + sx * w * 0.3,
      by = cy + sy * h * 0.3;
    for (let i = -1; i <= 1; i++)
      c.box(
        '#111111',
        bx + Math.cos(a + Math.PI / 2) * i * bar * 1.8,
        by + Math.sin(a + Math.PI / 2) * i * bar * 1.8,
        len,
        bar,
        a,
      );
  }
  return c;
}
