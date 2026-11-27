/**
 * CH-47F Chinook liveries: US Army, RAF Chinook HC6, Australian Army, Royal Netherlands Air
 * Force, RCAF CH-147F and JGSDF CH-47JA. National insignia, titles, serials and unit letters are
 * original vector redrawings placed from the referenced photographs.
 *
 * Model frame: +Z nose, +X the aircraft's left, +Y up. Cabin sides x ±1.27 (y 0.68–3.25,
 * z -4.5–3.8) with portholes at y 2.13; the fuel sponsons bulge to x ±1.85 at y 1.07
 * (z -4.6–3.1); the aft pylon's flat sides stand at x ±0.72 (y 3.2–4.9, z -4.7–-6.7) above the
 * T55 engine pods.
 */
import {
  both,
  canadaFlag,
  commons,
  forward,
  label,
  PAINT,
  rcafRoundel,
  sidePair,
} from '../art-helicopters-b.mjs';

const SHELL = 'shell',
  sponson = (s) => `sponson-${s}`;

export function slots() {
  return {
    [SHELL]: { materials: ['CH47-olive'], node: 'CH47-shell-CH47-olive' },
    'sponson-1': { materials: ['CH47-olive'], node: 'sponson-CH47-olive_1' },
    'sponson--1': { materials: ['CH47-olive'], node: 'sponson-CH47-olive' },
    'engine-1': { materials: ['CH47-olive'], node: 'T55-CH47-olive_1' },
    'engine--1': { materials: ['CH47-olive'], node: 'T55-CH47-olive' },
  };
}

const BLACK = PAINT.stencilBlack,
  WHITE = PAINT.white;

export default function design({ kit: k, space }) {
  const onSponson = (name, z, y, width, height) =>
    sidePair(space, name, {
      slot: sponson,
      at: (s) => [s * 1.85, y, z],
      facing: [1, 0.06, 0],
      width,
      height,
      depth: 0.3,
    });
  const onCabin = (name, z, y, width, height) =>
    sidePair(space, name, {
      slot: SHELL,
      at: (s) => [s * 1.27, y, z],
      width,
      height,
      depth: 0.3,
    });
  const onPylon = (name, z, y, width, height) =>
    sidePair(space, name, {
      slot: SHELL,
      at: (s) => [s * 0.72, y, z],
      facing: [1, 0, -0.03],
      width,
      height,
      depth: 0.25,
    });
  const anchors = {
    ...onSponson('sponson-title', 0.25, 1.12, 2.1, 0.22),
    ...onSponson('sponson-roundel', 2.35, 1.1, 0.5, 0.5),
    ...onSponson('sponson-hinomaru', -2.0, 1.1, 0.62, 0.62),
    ...onCabin('cabin-roundel', 2.85, 2.6, 0.48, 0.48),
    ...onCabin('cabin-kangaroo', -3.3, 2.75, 0.44, 0.44),
    ...onCabin('nose-number', 4.0, 1.4, 0.5, 0.2),
    ...onCabin('unit-code', 4.0, 2.63, 0.62, 0.22),
    ...onPylon('pylon-serial', -5.55, 4.42, 1.3, 0.22),
    ...onPylon('pylon-letter', -5.45, 4.84, 0.4, 0.4),
    ...onPylon('pylon-flag', -5.45, 4.8, 0.7, 0.35),
    ...onPylon('pylon-flash', -5.15, 4.95, 0.16, 0.2),
  };

  const graphics = {
    'us-army': label(k, 'UNITED STATES ARMY', 2.1, 0.22, BLACK, { fill: 0.72, tracking: 0.04 }),
    'us-serial': label(k, '06-08021', 1.3, 0.22, BLACK, { fill: 0.75 }),
    'raf-roundel': k
      .roundel(new k.Canvas(0.48, 0.48), 0.24, 0.24, 0.23, k.ROUNDELS.rafLowVis, [0.5, 0.5])
      .graphic('RAF low-visibility roundel'),
    'raf-serial': label(k, 'ZK558', 1.3, 0.22, BLACK, { fill: 0.75 }),
    'raf-flash': (() => {
      const c = new k.Canvas(0.16, 0.2);
      c.rect('#c97a83', 0, 0, 0.08, 0.2);
      c.rect('#5b7aa6', 0.08, 0, 0.08, 0.2);
      return c.graphic('RAF low-visibility fin flash');
    })(),
    'aus-army': label(k, 'ARMY', 1.0, 0.22, BLACK, { fill: 0.72, tracking: 0.06 }),
    'aus-serial': label(k, 'A15-302', 1.3, 0.22, BLACK, { fill: 0.75 }),
    'aus-v': new k.Canvas(0.4, 0.4)
      .text(BLACK, 'V', { x: 0.2, y: 0.2, height: 0.36 })
      .text(WHITE, 'V', { x: 0.2, y: 0.2, height: 0.3 })
      .graphic('Squadron letter V'),
    'aus-kangaroo': k
      .australiaRoundel(new k.Canvas(0.44, 0.44), 0.22, 0.22, 0.21, { lowvis: true })
      .graphic('Australian Army low-visibility roundel'),
    'nl-roundel': k
      .roundel(new k.Canvas(0.5, 0.5), 0.25, 0.25, 0.23, ['#5d6469', '#9aa1a5', '#5d6469'])
      .graphic('RNLAF low-visibility roundel'),
    'nl-serial': label(k, 'D-890', 1.3, 0.22, '#3b4044', { fill: 0.72 }),
    'ca-flag': canadaFlag(new k.Canvas(0.7, 0.35), 0, 0, 0.7, 0.35).graphic('Canadian flag'),
    'ca-serial': label(k, '147304', 1.3, 0.22, BLACK, { fill: 0.72 }),
    'ca-roundel': rcafRoundel(new k.Canvas(0.5, 0.5), 0.25, 0.25, 0.24, { lowvis: true }).graphic(
      'RCAF low-visibility roundel',
    ),
    'ca-304': label(k, '304', 0.5, 0.2, BLACK, { fill: 0.85 }),
    hinomaru: k.hinomaru(new k.Canvas(0.62, 0.62), 0.31, 0.31, 0.3).graphic('Hinomaru'),
    'jg-serial': label(k, '52950', 0.5, 0.2, BLACK, { fill: 0.7 }),
    'jg-unit': new k.Canvas(0.62, 0.22)
      .text('#1b1e20', 'HGP III', { x: 0.31, y: 0.11, height: 0.17, maxWidth: 0.6 })
      .graphic('HGP III'),
  };

  const all = (color, camouflage) => {
    const paint = (extra) => ({
      color,
      ...(camouflage ? { camouflage: { ...camouflage, ...extra } } : {}),
    });
    return {
      [SHELL]: paint({ scale: 4 }),
      'sponson-1': paint({ scale: 3.2, seed: (camouflage?.seed ?? 0) + 1 }),
      'sponson--1': paint({ scale: 3.2, seed: (camouflage?.seed ?? 0) + 2 }),
      'engine-1': paint({ scale: 0.8, seed: (camouflage?.seed ?? 0) + 3 }),
      'engine--1': paint({ scale: 0.8, seed: (camouflage?.seed ?? 0) + 4 }),
    };
  };

  const ref = {
    us: commons(
      'US Army CH-47F 06-08021 at Phoenix Goodyear, 2014 (Alan Wilson, CC BY-SA 2.0)',
      "Boeing-Vertol CH-47F Chinook '06-08021' (13201175683).jpg",
    ),
    raf: commons(
      'RAF Chinook HC.6 ZK558 in the Mach Loop, 2018 (Julian Herzog, CC BY 4.0)',
      'ZK558 Boeing Chinook HC.6 RAF Corris Corner 2018 01.jpg',
    ),
    rafVortex: commons(
      'RAF 18(B) Squadron Chinooks, Exercise Vortex Warrior 2014 (MOD, OGL)',
      'RAF Chinook Helicopters MOD 45157572.jpg',
    ),
    aus: commons(
      'Australian Army CH-47F A15-302, Talisman Sabre 2021 (Commons, public domain)',
      'A15-302 during Talisman Sabre 2021.jpg',
    ),
    ausDover: commons(
      'Australian Army CH-47F at Dover AFB, 2015 (USAF, public domain)',
      'Australian Army CH-47F Chinook being loaded on a USAF C-5 Galaxy at Dover Air Force Base.jpg',
    ),
    nl: commons(
      'RNLAF CH-47F D-890 of 298 Squadron at RIAT 2016 (Alan Wilson, CC BY-SA)',
      'Boeing-Vertol CH-47F Chinook ‘D-890’ (35756133671).jpg',
    ),
    ca: commons(
      'RCAF CH-147F Chinook 147304 at Fairford, 2017 (Commons, CC0)',
      '2017, 147304, Canada, CH-147F Chinook, Fairford - 4210 (53949049947).jpg',
    ),
    jg: commons('JGSDF CH-47JA at Narashino, 2012 (Commons, CC0)', 'JGSDF CH-47JA 20120108-02.JPG'),
    jgYokota: commons(
      'JGSDF CH-47JA at Yokota, 2009 (Commons, public domain)',
      'CH-47JA 20090822 Yokota AFB-01.JPG',
    ),
  };

  return {
    selected: 'us-army',
    anchors,
    graphics,
    variants: [
      {
        id: 'us-army',
        label: 'US Army',
        provenance: {
          kind: 'inspired',
          note: 'US Army CH-47F 06-08021: FS 34031 aircraft green overall, black UNITED STATES ARMY on both sponsons and the serial on the aft pylon, as photographed; no national insignia, per current Army practice. Approximate colors and letter sizes.',
          references: [ref.us],
        },
        paints: all('#4b5143'),
        markings: [...both('sponson-title', 'us-army'), ...both('pylon-serial', 'us-serial')],
      },
      {
        id: 'raf-hc6',
        label: 'RAF Chinook HC6',
        provenance: {
          kind: 'inspired',
          note: 'RAF Chinook HC6 ZK558 (2018): dark green-grey overall, low-visibility pale blue and pink roundels on the forward cabin, the matching fin flash on the aft pylon and the serial ZK558, redrawn. The HC6 is the RAF CH-47F; approximate colors and marking sizes.',
          references: [ref.raf, ref.rafVortex],
        },
        paints: all('#464c43'),
        markings: [
          ...forward('cabin-roundel', 'raf-roundel'),
          ...forward('pylon-flash', 'raf-flash'),
          ...both('pylon-serial', 'raf-serial'),
        ],
      },
      {
        id: 'australian-army',
        label: 'Australian Army, 5th Aviation Regiment',
        provenance: {
          kind: 'inspired',
          note: 'Australian Army CH-47F A15-302 (Talisman Sabre 2021): aircraft green, black ARMY on the sponsons, A15-302 and the white squadron letter V on the aft pylon and the low-visibility kangaroo roundel on the aft cabin, all redrawn. Approximate colors and sizes.',
          references: [ref.aus, ref.ausDover],
        },
        paints: all('#505545'),
        markings: [
          ...both('sponson-title', 'aus-army'),
          ...both('pylon-serial', 'aus-serial'),
          ...both('pylon-letter', 'aus-v'),
          ...forward('cabin-kangaroo', 'aus-kangaroo'),
        ],
      },
      {
        id: 'rnlaf-298-squadron',
        label: 'Royal Netherlands Air Force, 298 Squadron',
        provenance: {
          kind: 'inspired',
          note: 'RNLAF CH-47F D-890 of 298 Squadron (RIAT 2016): medium grey overall, low-visibility grey roundels on the sponsons and the serial on the aft pylon. The squadron badge is omitted. Approximate colors.',
          references: [ref.nl],
        },
        paints: all('#7a8186'),
        markings: [...both('sponson-roundel', 'nl-roundel'), ...both('pylon-serial', 'nl-serial')],
      },
      {
        id: 'rcaf-ch147f',
        label: 'RCAF CH-147F, 450 Squadron',
        provenance: {
          kind: 'inspired',
          note: 'RCAF CH-147F 147304 (Fairford 2017): three-tone CF green camouflage (a generated pattern in those colors, not the exact pattern), the Canadian flag and serial on the aft pylon, low-visibility roundels on the sponsons and 304 on the nose. The Government of Canada wordmark is omitted. Approximate colors.',
          references: [ref.ca],
        },
        paints: all('#4f5f3f', {
          colors: ['#62744a', '#3c4a32', '#252b24'],
          seed: 147304,
          style: 'blotch',
        }),
        markings: [
          ...forward('pylon-flag', 'ca-flag'),
          ...both('pylon-serial', 'ca-serial'),
          ...forward('sponson-roundel', 'ca-roundel'),
          ...both('nose-number', 'ca-304'),
        ],
      },
      {
        id: 'jgsdf-ch47ja',
        label: 'JGSDF CH-47JA, 1st Helicopter Brigade',
        provenance: {
          kind: 'inspired',
          note: 'JGSDF CH-47JA (Narashino 2012): brown, green and dark green camouflage (a generated pattern in those colors, not the exact pattern), large hinomaru on the sponsons, 52950 on the nose and the HGP III unit code beside the cockpit, redrawn. The kanji service title is omitted; the CH-47F model stands in for the CH-47JA. Approximate colors.',
          references: [ref.jg, ref.jgYokota],
        },
        paints: all('#5a6339', {
          colors: ['#7c6b47', '#566339', '#2f382b'],
          seed: 52950,
          style: 'blotch',
        }),
        markings: [
          ...both('sponson-hinomaru', 'hinomaru'),
          ...both('nose-number', 'jg-serial'),
          ...both('unit-code', 'jg-unit'),
        ],
      },
    ],
  };
}
