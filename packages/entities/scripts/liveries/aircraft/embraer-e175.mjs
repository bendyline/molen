/**
 * Embraer E175 liveries: the regional schemes flown for mainline carriers, studied from the
 * referenced photographs and drawn as paint zones on the builder's station tables, with
 * registrations and flags as original vector art. No operator names, logos or wordmarks;
 * registrations are fictional in the national format.
 */
import { e175 } from '../../aircraft/embraer-e175.mjs';
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
  return transportSlots('E175', existing);
}

const commons = (file, credit) => ({
  title: `${file} (${credit})`,
  url: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, '_'))}`,
});
const REFS = {
  united: commons('United Boeing 737-800 N37267 BWI MD1.jpg', 'Acroterion, CC BY-SA 4.0'),
  unitedExpress: commons('08-JUL-2022 - UA5546 LGA-ORD (E175 - N89349) (01).jpg', 'CC BY 4.0'),
  delta: commons('DeltaConnection(Compass)E175N605CZ YYJDecember2018.jpg', 'CC BY-SA 4.0'),
  american: commons(
    'American Eagle (Compass Airlines) Embraer E175 N215NN at SFO April 2017.jpg',
    'Richard Silagi, CC BY-SA 4.0',
  ),
  klm: commons('PH-EXH KLM Cityhopper E175 FRA (37996624366).jpg', 'CC BY 2.0'),
  alaska: commons('N638QX @ LAX, 2023-11-05.jpg', 'CC BY-SA 2.0'),
  alaskaWingtip: commons(
    'Alaska Airlines E175 departing Fairbanks (Quintin Soloviev).jpg',
    'Quintin Soloviev, CC BY-SA 4.0',
  ),
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

export default function design(ctx) {
  const S = studio(ctx, e175);
  const { T, P } = S;
  const wh = T.win + T.winH / 2;
  const scale = T.D / 4;

  /* United (2019, as now applied to United Express jets): white over a light grey belly behind a
     fine navy line that sweeps down to the radome; blue fin, engines and winglets. */
  const united = (() => {
    const BLUE = '#1c3d9b',
      NAVY = '#0f1d4a',
      GREY = '#c6c9cb',
      WHITE = '#f3f4f2';
    const f = 0.28;
    const path = sectionPath(T, [
      [-1, 0.08],
      [T.nose * 0.3, 0.14],
      [T.nose * 0.8, f - 0.04],
      [T.nose + 2, f],
      [T.L + 1, f],
    ]).map(([u, h], i, all) => (i === all.length - 1 ? [u, all[i - 1][1]] : [u, h]));
    const t = 0.03;
    return {
      paints: {
        ...P.paint(TRANSPORT.skin, WHITE, [
          { color: GREY, region: region.below(path.map(([u, h]) => [u, h - t])) },
          { color: NAVY, region: region.stripe(path, 2 * t) },
        ]),
        ...solid(TRANSPORT.fin, BLUE),
        ...solid(TRANSPORT.nacelles, '#2853c0'),
        ...solid(TRANSPORT.pylons, '#d4d7d9'),
        ...solid(TRANSPORT.winglets, BLUE),
        ...solid(TRANSPORT.stabilizers, '#c7cacc'),
      },
      markings: [
        ...S.reg('N87326', {
          u: T.lastWindow - 0.9,
          h: wh + 0.26,
          cap: 0.26 * scale,
          color: '#1a1c1e',
        }),
        ...S.flag('us', usFlag, {
          u: T.lastWindow + 0.45,
          h: wh + 0.26,
          height: 0.26 * scale,
          aspect: 1.9,
        }),
      ],
    };
  })();

  /* Alaska Airlines (2016) on Horizon's E175s: white, the aurora lines (green, light blue, teal)
     sweeping up the rear fuselage into the fin, navy lower rear fuselage and fin, aurora bands on
     the fin tip and winglets. */
  const alaska = (() => {
    const NAVY = '#0d3b6e',
      GREEN = '#a6cf46',
      LIGHT = '#67c4ea',
      TEAL = '#1f9fca',
      WHITE = '#f5f6f5';
    const a = [23.0, 2.27],
      b = [25.6, 3.3];
    const base = T.D,
      tip = T.finTip;
    const leRoot = T.finLE(base);
    const finLine = (d) => [
      [leRoot + 1.55 + d, base - 0.6],
      [T.finLE(base + 1.7) + 0.25 + d, base + 1.7],
    ];
    const strip = (p, q, w) => [p, q, [q[0] + w, q[1]], [p[0] + w, p[1]]];
    const top = (h0, h1) => [
      [T.finLE(h0) - 1, h0],
      [T.finLE(h0) + 1.9, h0 - 0.18],
      [T.finLE(h1) + 1.9, h1 - 0.18],
      [T.finLE(h1) - 1, h1],
    ];
    const [f0, f1] = finLine(0);
    return {
      paints: {
        ...P.paint(TRANSPORT.skin, WHITE, [
          { color: GREEN, region: region.below(line(a, b)) },
          { color: LIGHT, region: region.below(line(a, b, 0.13)) },
          { color: TEAL, region: region.below(line(a, b, 0.42)) },
          { color: NAVY, region: region.below(line(a, b, 0.55)) },
        ]),
        ...P.paint(TRANSPORT.fin, NAVY, [
          { color: GREEN, region: [strip(f0, f1, 0.16)] },
          { color: LIGHT, region: [strip([f0[0] + 0.16, f0[1]], [f1[0] + 0.16, f1[1]], 0.14)] },
          { color: LIGHT, region: [top(tip - 0.95, tip - 0.78)] },
          { color: GREEN, region: [top(tip - 0.78, tip - 0.62)] },
        ]),
        ...P.paint(TRANSPORT.winglets, WHITE, [
          {
            color: GREEN,
            region: region.above([
              [-50, 2.86],
              [200, 2.86],
            ]),
          },
          {
            color: LIGHT,
            region: region.above([
              [-50, 3.0],
              [200, 3.0],
            ]),
          },
          {
            color: NAVY,
            region: region.above([
              [-50, 3.16],
              [200, 3.16],
            ]),
          },
        ]),
        ...solid(TRANSPORT.nacelles, '#eceeef'),
        ...solid(TRANSPORT.pylons, '#e4e6e7'),
        ...solid(TRANSPORT.stabilizers, '#d0d3d5'),
      },
      markings: [
        ...S.reg('N659QZ', { u: T.lastWindow - 0.6, h: wh + 0.26, cap: 0.26 * scale, color: NAVY }),
        ...S.flag('us', usFlag, {
          u: T.lastWindow - 1.95,
          h: wh + 0.26,
          height: 0.26 * scale,
          aspect: 1.9,
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
    selected: 'white-grey-belly-blue-tail',
    anchors: S.anchors,
    graphics: S.graphics,
    variants: [
      variant(
        'white-grey-belly-blue-tail',
        'White, grey belly, blue tail',
        united,
        "United's 2019 scheme as now applied to United Express jets, from the referenced United photograph (the scheme) and United Express E175 (the type's marking positions; that aircraft still wears the 2010 scheme): white over a light grey belly behind a fine navy line that sweeps down to the radome, blue fin, engines and winglets, registration and US flag above the aft windows. The globe emblem is United's logo and is omitted, leaving the fin plain blue; titles are omitted." +
          civil,
        [REFS.united, REFS.unitedExpress],
      ),
      variant(
        'white-navy-belly-navy-tail',
        'White over navy belly, navy tail',
        deltaScheme(S, { reg: 'N293SZ', ship: '293' }),
        "Delta Connection scheme from the referenced photograph: white over the navy belly from the radome to the rear door, navy fin carried forward over the tail cone, navy engines and winglets, US flag and registration above the aft windows. The red tail widget is Delta's logo and is omitted, leaving the fin navy; titles are omitted." +
          civil,
        [REFS.delta],
      ),
      variant(
        'silver-flag-stripe-tail',
        'Silver with flag-stripe tail',
        americanScheme(S, { reg: 'N437YQ', fleet: '437' }),
        'American Eagle scheme (American Airlines 2013) from the referenced photograph: silver fuselage, engines and winglets, the stylised flag on the fin (blue and white forward, red and white aft, red root band) with a red band over the tail cone, registration and US flag below the aft windows. The Flight Symbol and titles are omitted.' +
          civil,
        [REFS.american],
      ),
      variant(
        'sky-blue-upper-white-fin',
        'Sky blue upper body, white fin',
        klmScheme(S, { reg: 'PH-EWQ' }),
        'KLM Cityhopper scheme from the referenced photograph: KLM blue over the top of the fuselage and nose, the fine dark blue line sweeping down to the radome, light grey belly, white fin, grey engines, blue winglets, EU and Dutch flags with a white registration above the aft windows. The crown logo and titles are omitted.' +
          civil,
        [REFS.klm],
      ),
      variant(
        'navy-tail-aurora-lines',
        'Navy tail with aurora lines',
        alaska,
        "Alaska Airlines scheme (2016) on Horizon's E175s, from the referenced photographs: white fuselage, the green, light-blue and teal aurora lines sweeping up the rear fuselage into the fin, navy lower rear fuselage and fin, aurora bands on the fin tip and winglets, registration and US flag above the aft windows. The face on the fin is the operator's emblem and is omitted; titles are omitted. The fin's curved aurora lines are straightened." +
          civil,
        [REFS.alaska, REFS.alaskaWingtip],
      ),
    ],
  };
}
