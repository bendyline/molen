/**
 * C-17A Globemaster III liveries: US Air Force (McChord), Royal Air Force, Royal Australian Air
 * Force and Royal Canadian Air Force aircraft with national insignia, titles, tail bands, fin
 * flags and serials redrawn as original vector art. All are FS 36173 gray; colors approximate.
 */
import * as A from '../art-transports.mjs';

const EXT = 'body-C17-exterior-C17-airframe',
  RUDDER = 'body-C17-rudder-C17-airframe';

export function slots(existing) {
  const out = {};
  // Body regions only: the seat-cushion accents are cockpit trim, and the existing whole-model
  // `body` binding overlapped the per-part slots.
  for (const [name, binding] of Object.entries(existing))
    if (name.startsWith('body-')) out[name] = binding;
  // Markings only (never painted): every airframe surface, fin and rudder together.
  out.all = { materials: ['C17-airframe'] };
  return out;
}

const GRAY = '#8a9297',
  INK = '#202427',
  WHITE = '#f4f4f0';

// Fin chord centre and skin half-thickness at height y (probed on the runtime model).
const finZ = (y) => -15.4 - 0.843 * (y - 8),
  finX = (y) => 0.46 - 0.034 * (y - 8);

/** Mount Rainier's silhouette rising from the right end of a band (original drawing). */
function rainier(k, w, h, color) {
  const c = new k.Canvas(w, h);
  const pts = [
    [0.6, 0],
    [0.67, 0.16],
    [0.72, 0.3],
    [0.77, 0.52],
    [0.81, 0.78],
    [0.835, 0.86],
    [0.86, 0.8],
    [0.9, 0.6],
    [0.94, 0.38],
    [0.99, 0.16],
    [0.99, 0],
  ].map(([x, y]) => [x * w, y * h]);
  c.add(color, pts);
  return A.finish(c, 'Mount Rainier silhouette');
}

/** A standing bison seen side-on, facing the reader's left (original silhouette). */
function bison(k, w, h, color) {
  const c = new k.Canvas(w, h);
  const pts = [
    [0.04, 0.42],
    [0.1, 0.62],
    [0.2, 0.86],
    [0.34, 0.97],
    [0.5, 0.92],
    [0.66, 0.8],
    [0.86, 0.74],
    [0.95, 0.62],
    [0.97, 0.36],
    [0.92, 0.08],
    [0.86, 0.08],
    [0.86, 0.3],
    [0.74, 0.32],
    [0.7, 0.06],
    [0.64, 0.06],
    [0.62, 0.32],
    [0.4, 0.34],
    [0.36, 0.06],
    [0.3, 0.06],
    [0.3, 0.3],
    [0.2, 0.26],
    [0.14, 0.16],
    [0.06, 0.18],
    [0.02, 0.3],
  ].map(([x, y]) => [x * w, y * h]);
  c.add(color, pts);
  // Horn.
  c.add(color, [
    [0.12 * w, 0.62 * h],
    [0.08 * w, 0.8 * h],
    [0.15 * w, 0.68 * h],
  ]);
  return A.finish(c, 'Bison');
}

export default function design({ kit: k, space, slots: all }) {
  const anchors = {};
  const pair = (name, make) => {
    anchors[`${name}-l`] = make(1);
    anchors[`${name}-r`] = make(-1);
  };
  const on = (center, s, width, height, depth = 1.2, facing = [s, 0, 0]) =>
    space.anchor('all', { center, facing, width, height, depth });
  // The rudder is a thinner slab (skin at |x| 0.12) set into the fin's trailing part: the
  // projector spans both skins without reaching the far side.
  const fin =
    (y, width, height, dz = 0) =>
    (s) =>
      on([(s * (finX(y) + 0.12)) / 2, y, finZ(y) + dz], s, width, height, finX(y) - 0.12 + 0.22);

  pair('title', (s) => on([s * 2.78, 6.0, 18.4], s, 5.0, 0.56, 1.2, [s, 0.5, 0]));
  pair('title-big', (s) => on([s * 2.75, 5.85, 18.4], s, 4.2, 0.85, 1.2, [s, 0.45, 0]));
  pair('nose-block', (s) => on([s * 2.3, 4.2, 22.3], s, 1.4, 1.0, 1.2, [s, 0, 0.45]));
  pair('nose-flag', (s) => on([s * 2.55, 4.6, 21.6], s, 0.7, 0.42, 1.2, [s, 0, 0.35]));
  pair('aft-mark', (s) => on([s * 3.3, 5.05, -6.4], s, 2.2, 1.2));
  pair('aft-roundel', (s) => on([s * 3.3, 5.0, -6.4], s, 1.3, 1.3));
  pair('aft-serial', (s) => on([s * 3.05, 5.2, -9.6], s, 2.6, 0.5));
  pair('aft-title', (s) => on([s * 3.2, 4.8, -7.8], s, 4.4, 0.9));
  pair('fin-flag', fin(12.15, 1.4, 0.76));
  pair('fin-code', fin(11.4, 1.3, 0.36));
  pair('fin-band', fin(10.25, 7.4, 0.6));
  pair('fin-band-art', fin(10.5, 7.4, 1.1));
  pair('fin-serial', fin(9.45, 2.4, 0.52));
  pair('fin-flash', fin(12.3, 0.7, 1.0, 1.2));
  pair('fin-roundel', fin(12.0, 1.3, 1.3));
  pair('fin-emblem', fin(11.55, 1.3, 0.85, 1.25));
  pair('fin-serial-fwd', fin(10.55, 2.4, 0.5, 1.5));

  // ------------------------------------------------------------------ artwork
  const graphics = {
    'us-air-force': A.label(k, 'U.S. AIR FORCE', 5.0, 0.56, INK, { slant: 0.12, tracking: 0.02 }),
    insignia: A.finish(
      k.usInsignia(new k.Canvas(2.2, 1.2), 1.1, 0.6, 0.52, { style: 'full' }),
      'US national insignia',
    ),
    'us-flag': A.usFlag(k, 1.4, 0.76),
    amc: A.label(k, 'AMC', 1.3, 0.36, INK),
    // The base name sits forward of the mountain: left of centre on the left side, right of
    // centre on the right side.
    ...Object.fromEntries(
      [
        ['l', 2.55],
        ['r', 4.85],
      ].map(([side, x]) => {
        const c = new k.Canvas(7.4, 0.6);
        c.text(WHITE, 'McCHORD', { x, y: 0.3, height: 0.36, tracking: 0.08 });
        return [`band-mcchord-${side}`, A.finish(c, 'McCHORD tail band')];
      }),
    ),
    rainier: rainier(k, 7.4, 1.1, '#173b24'),
    'serial-33291': A.label(k, '33291', 2.4, 0.52, INK),
    'nose-3291': A.lines(k, 1.4, 1.0, INK, [
      ['3291', 0.32, 0.8],
      ['62nd AW', 0.15, 0.45],
      ['446th AW', 0.15, 0.2],
    ]),
    // Royal Air Force
    'raf-title': A.label(k, 'ROYAL AIR FORCE', 5.0, 0.56, INK, { fill: 0.62, tracking: 0.08 }),
    'raf-roundel': A.finish(
      k.roundel(new k.Canvas(1.3, 1.3), 0.65, 0.65, 0.6, ['#2b4485', '#c02b36'], [0.6, 0.4]),
      'RAF roundel',
    ),
    'raf-flash': A.flash(k, 0.7, 1.0, ['#c02b36', '#2b4485'], 'RAF fin flash'),
    'raf-serial': A.label(k, 'ZZ175', 2.6, 0.5, INK),
    'uk-flag': A.unionFlag(k, 0.7, 0.42),
    // Royal Australian Air Force
    'raaf-title': A.label(k, 'ROYAL AUSTRALIAN AIR FORCE', 5.0, 0.56, INK, {
      fill: 0.5,
      tracking: 0.04,
    }),
    'raaf-roundel': A.finish(
      k.australiaRoundel(new k.Canvas(1.3, 1.3), 0.65, 0.65, 0.62),
      'RAAF roundel',
    ),
    'raaf-serial': A.label(k, 'A41-206', 2.4, 0.52, INK),
    // Royal Canadian Air Force
    'rcaf-canada': (() => {
      const c = new k.Canvas(4.2, 0.85);
      c.text(INK, 'Canada', { x: 2.1, y: 0.36, height: 0.6, face: 'regular' });
      // The small flag over the final letter.
      const fx = 3.12,
        fy = 0.7,
        fw = 0.3,
        fh = 0.15;
      c.rect('#d52b1e', fx, fy, fw / 4, fh);
      c.rect('#d52b1e', fx + (fw * 3) / 4, fy, fw / 4, fh);
      c.add(
        '#d52b1e',
        A.MAPLE.map(([x, y]) => [fx + fw / 2 + x * fh * 0.42, fy + fh * 0.48 + y * fh * 0.42]),
      );
      return A.finish(c, 'Canada wordmark');
    })(),
    'ca-flag': A.canadaFlag(k, 1.4, 0.76),
    bison: bison(k, 1.3, 0.85, '#16181a'),
    'rcaf-serial': A.label(k, '177703', 2.4, 0.5, INK),
    'rcaf-aft': (() => {
      const c = new k.Canvas(4.4, 0.9);
      c.text(INK, 'RCAF', { x: 1.6, y: 0.45, height: 0.42, align: 'right' });
      k.canadaRoundel(c, 2.2, 0.45, 0.42);
      c.text(INK, 'ARC', { x: 2.8, y: 0.45, height: 0.42, align: 'left' });
      return A.finish(c, 'RCAF roundel ARC');
    })(),
  };

  // ------------------------------------------------------------------ paint
  const bodySlots = Object.keys(all).filter((n) => n.startsWith('body-'));
  const paintAll = (extra = {}) => ({
    ...Object.fromEntries(bodySlots.map((n) => [n, { color: GRAY }])),
    ...extra,
  });
  const band = (slot, y0, y1, color) => ({
    color,
    planes: [space.above(slot, y0), space.below(slot, y1)],
  });
  const both = (anchor, graphic) => [
    { anchor: `${anchor}-l`, graphic },
    { anchor: `${anchor}-r`, graphic },
  ];
  const leading = (anchor, graphic) => [
    { anchor: `${anchor}-l`, graphic },
    { anchor: `${anchor}-r`, graphic, flip: true },
  ];
  const refs = {
    mcchord: {
      title:
        'C-17A 03-3291 of the 62nd and 446th Airlift Wings at McChord with Mount Rainier (US Air Force, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:C-17_Mt_Rainier.jpg',
    },
    raf: {
      title: 'Royal Air Force C-17 Globemaster III ZZ175 (CC BY 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Royal_Air_Force_C-17_Globemaster_III,_ZZ175_(16709935995).jpg',
    },
    raaf: {
      title: 'RAAF C-17A Globemaster III A41-206 (CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:A41-206_Boeing_C-17A_Globemaster_III_RAAF_(9637304265).jpg',
    },
    rcaf: {
      title: 'Royal Canadian Air Force CC-177 Globemaster III 177703 (CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Royal_Canadian_Air_Force,_177703,_Boeing_CC-177_Globemaster_III_(52958690048).jpg',
    },
  };
  const variant = (id, label, note, references, paints, markings) => ({
    id,
    label,
    provenance: { kind: 'inspired', note, references },
    paints,
    markings,
  });

  return {
    selected: 'mcchord-62-aw',
    anchors,
    graphics,
    variants: [
      variant(
        'mcchord-62-aw',
        'USAF 62nd AW McChord, 03-3291',
        "US Air Force C-17A 03-3291 of the 62nd Airlift Wing and the associate 446th (McChord) from the referenced photograph: FS 36173 gray, U.S. AIR FORCE title, 3291 with both wing designations on the nose, US flag, AMC, the green McCHORD tail band with Mount Rainier's silhouette rising from it, tail number 33291 and full-color national insignia aft. Approximate colors; the wing's small unit emblems by the nose are omitted.",
        [refs.mcchord],
        paintAll({
          [EXT]: { color: GRAY, zones: [band(EXT, 9.95, 10.55, '#1f7a43')] },
          [RUDDER]: { color: GRAY, zones: [band(RUDDER, 9.95, 10.55, '#1f7a43')] },
        }),
        [
          ...both('title', 'us-air-force'),
          ...both('nose-block', 'nose-3291'),
          ...both('aft-mark', 'insignia'),
          ...leading('fin-flag', 'us-flag'),
          ...both('fin-code', 'amc'),
          { anchor: 'fin-band-l', graphic: 'band-mcchord-l' },
          { anchor: 'fin-band-r', graphic: 'band-mcchord-r' },
          ...leading('fin-band-art', 'rainier'),
          ...both('fin-serial', 'serial-33291'),
        ],
      ),
      variant(
        'raf-99-sqn-zz175',
        'RAF 99 Squadron ZZ175',
        'Royal Air Force C-17A ZZ175 of No. 99 Squadron (Brize Norton) from the referenced photograph: gray, ROYAL AIR FORCE title, the Union flag on the nose, red and blue roundel and ZZ175 aft, red and blue fin flash. Union flag simplified (centred red saltire); roundel and flash placement approximate.',
        [refs.raf],
        paintAll(),
        [
          ...both('title', 'raf-title'),
          ...leading('nose-flag', 'uk-flag'),
          ...both('aft-roundel', 'raf-roundel'),
          ...both('aft-serial', 'raf-serial'),
          ...leading('fin-flash', 'raf-flash'),
        ],
      ),
      variant(
        'raaf-36-sqn-a41-206',
        'RAAF 36 Squadron A41-206',
        'Royal Australian Air Force C-17A A41-206 of No. 36 Squadron (Amberley) from the referenced photograph: gray, full-color kangaroo roundel on the rear fuselage behind the paratroop door, ROYAL AUSTRALIAN AIR FORCE title, A41-206 on the fin with a fin roundel. Fin layout follows RAAF transport practice; approximate.',
        [refs.raaf],
        paintAll(),
        [
          ...both('title', 'raaf-title'),
          ...both('aft-roundel', 'raaf-roundel'),
          ...both('fin-roundel', 'raaf-roundel'),
          ...both('fin-serial', 'raaf-serial'),
        ],
      ),
      variant(
        'rcaf-429-sqn-177703',
        'RCAF 429 Squadron CC-177 177703',
        'Royal Canadian Air Force CC-177 177703 of 429 Transport Squadron (Trenton) from the referenced photograph: gray, the Canada wordmark with its small flag, Canadian flag, the squadron bison and 177703 on the fin, RCAF roundel ARC on the rear fuselage. The wordmark is set in a sans face; the bison is an original silhouette. Approximate.',
        [refs.rcaf],
        paintAll(),
        [
          ...both('title-big', 'rcaf-canada'),
          ...leading('fin-flag', 'ca-flag'),
          ...leading('fin-emblem', 'bison'),
          ...both('fin-serial-fwd', 'rcaf-serial'),
          ...both('aft-title', 'rcaf-aft'),
        ],
      ),
    ],
  };
}
