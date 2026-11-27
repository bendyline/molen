/**
 * OH-6A Cayuse liveries: US Army olive drab (1966, and a Vietnam air cavalry scout with the
 * crossed sabres), JGSDF two-tone camouflage, the Royal Danish Army's Hughes 500M, and two civil
 * Hughes 369 / MD 500 schemes. Military insignia, titles and serials are original vector
 * redrawings; civil schemes show colors and layout only, with fictional registrations.
 *
 * Model frame: +Z nose, +X the aircraft's left, +Y up; the airframe sits nose-up on its skids.
 * The egg-shaped cabin is about ±0.69 wide (z -1.99–1.68); the transmission fairing above it has
 * near-flat sides at x ±0.235 (y 1.6–2.3, z -1.6–0); the round tail boom (about 0.3 m across)
 * drops 0.13 m per metre from z -1.6 to the fin at z -5.
 */
import {
  both,
  commons,
  denmarkFlag,
  forward,
  label,
  PAINT,
  sidePair,
} from '../art-helicopters-b.mjs';

const OLIVE = 'olive-drab-enamel';
const SLOT_NODES = {
  cabin: 'cabin-panels',
  pylon: 'transmission-fairing',
  boom: 'tail-boom',
  fin: 'tail-fin',
  stabilizer: 'tail-stabilizer--1',
  ventral: 'tail-stabilizer-1',
  'stabilizer-strut': 'tail-brace--1',
  exhaust: 'exhaust-fairing',
  antenna: 'roof-antenna',
};
const SKIDS = ['skid', 'skid-bow', 'skid-end'].flatMap((n) => [`${n}-1`, `${n}--1`]);
const STRUTS = ['skid-strut-forward', 'skid-strut-aft'].flatMap((n) => [`${n}-1`, `${n}--1`]);

export function slots() {
  const out = {};
  for (const [name, node] of Object.entries(SLOT_NODES)) out[name] = { materials: [OLIVE], node };
  for (const node of [...SKIDS, ...STRUTS]) out[node] = { materials: [OLIVE], node };
  return out;
}

/** Paints: `body` for the airframe, optional overrides per region, skids, skid toes and struts. */
function paints(body, { skids = body, struts = body, toes = skids, ...regions } = {}) {
  const out = {};
  for (const name of Object.keys(SLOT_NODES)) out[name] = regions[name] ?? body;
  for (const node of SKIDS) out[node] = node.startsWith('skid-bow') ? toes : skids;
  for (const node of STRUTS) out[node] = struts;
  return out;
}

const OD = { color: '#575b3e' },
  BLACK = PAINT.stencilBlack,
  WHITE = PAINT.white;

export default function design({ kit: k, space }) {
  // Boom centre line and radius (measured on the runtime model).
  const boomY = (z) => 1.51 + (z + 3.25) * 0.13,
    boomX = (z) => 0.135 + (z + 3.25) * 0.047;
  const onBoom = (name, z, width, height, dy = 0) =>
    sidePair(space, name, {
      slot: 'boom',
      at: (s) => [s * boomX(z), boomY(z) + dy, z],
      facing: [1, 0, -0.04],
      up: [0, 1, -0.13],
      width,
      height,
      depth: 0.2,
    });
  const onPylon = (name, z, y, width, height) =>
    sidePair(space, name, {
      slot: 'pylon',
      at: (s) => [s * 0.234, y, z],
      facing: [1, 0.05, -0.02],
      width,
      height,
      depth: 0.18,
    });
  const anchors = {
    ...onBoom('boom-title', -3.02, 2.1, 0.2),
    ...onBoom('boom-roundel', -2.35, 0.27, 0.27),
    ...onBoom('boom-code', -2.75, 0.7, 0.15),
    ...onBoom('boom-flag', -4.05, 0.2, 0.14),
    ...onBoom('boom-reg', -3.55, 0.75, 0.11),
    ...onPylon('pylon-serial', -0.92, 2.02, 0.64, 0.2),
    ...onPylon('pylon-disc', -0.42, 2.07, 0.17, 0.17),
    ...onPylon('pylon-reg', -0.86, 2.0, 0.95, 0.19),
    ...sidePair(space, 'cabin-aft', {
      slot: 'cabin',
      at: (s) => [s * 0.52, 1.08, -1.0],
      facing: [1, 0, -0.27],
      width: 0.42,
      height: 0.42,
      depth: 0.25,
    }),
  };

  const graphics = {
    'army-title': label(k, 'UNITED STATES ARMY', 2.1, 0.2, BLACK, { fill: 0.78, tracking: 0.04 }),
    'serial-12931': label(k, '12931', 0.64, 0.2, BLACK, { fill: 0.85 }),
    'cav-011': label(k, '011', 0.64, 0.2, '#e9bf2b', { fill: 0.85, align: 'left', x: 0.02 }),
    'cav-disc': new k.Canvas(0.17, 0.17)
      .circle('#e9bf2b', 0.085, 0.085, 0.08)
      .graphic('Troop disc'),
    hinomaru: k.hinomaru(new k.Canvas(0.27, 0.27), 0.135, 0.135, 0.13).graphic('Hinomaru'),
    'jg-serial': label(k, '31312', 0.64, 0.2, '#1e2421', { fill: 0.8 }),
    'dk-roundel': k
      .roundel(new k.Canvas(0.42, 0.42), 0.21, 0.21, 0.2, k.ROUNDELS.denmark)
      .graphic('Danish roundel'),
    'dk-flag': denmarkFlag(new k.Canvas(0.2, 0.14), 0, 0, 0.2, 0.14).graphic('Danish flag'),
    'dk-code': label(k, 'H-203', 0.7, 0.15, '#4a5049', { fill: 0.8 }),
    'civil-reg-blue': label(k, 'N4367C', 0.75, 0.11, '#1f4f9c', { fill: 0.8 }),
    'civil-reg-lime': label(k, 'N5172F', 0.95, 0.19, '#14215a', { fill: 0.74, slant: 0.18 }),
  };

  // Air cavalry scout: orange tail surfaces with black bands, a red-white-blue boom band.
  const cavalryOrange = '#e06a2a';
  const ring = (z0, z1, color) => ({
    color,
    planes: [space.behind('boom', z0), space.ahead('boom', z1)],
  });
  const cavalryBoom = {
    color: '#4d5337',
    zones: [ring(-4.3, -4.37, '#b5262b'), ring(-4.37, -4.44, WHITE), ring(-4.44, -4.51, '#203a74')],
  };
  const finBand = (y0) => ({
    color: BLACK,
    planes: [
      space.sideLine('fin', [-4.6, y0], [-5.5, y0 + 0.35], 1),
      space.sideLine('fin', [-4.6, y0 + 0.09], [-5.5, y0 + 0.44], -1),
    ],
  });
  const cavalryFin = {
    color: '#4d5337',
    zones: [
      { color: cavalryOrange, planes: [space.above('fin', 1.75)] },
      finBand(1.95),
      finBand(2.22),
    ],
  };

  // Danish 500M: a yellow warning band round the boom ahead of the tail.
  const danishBoom = {
    color: '#2b302a',
    zones: [{ color: '#e8c12c', planes: [space.ahead('boom', -4.62), space.behind('boom', -4.4)] }],
  };

  // Blue and white civil OH-6A: white over a blue belly that sweeps up round the windshield
  // frame at the nose, a blue fairing and boom spine, blue fin.
  const civilBlue = '#1f4f9c';
  const blueWhiteCabin = {
    color: WHITE,
    zones: [
      { color: civilBlue, planes: [space.below('cabin', 1.0)] },
      { color: civilBlue, planes: [space.ahead('cabin', 1.12), space.below('cabin', 1.6)] },
      { color: civilBlue, planes: [space.ahead('cabin', 1.45)] },
    ],
  };
  const blueWhiteBoom = {
    color: WHITE,
    zones: [{ color: civilBlue, planes: [space.sideLine('boom', [-1.6, 1.68], [-5.0, 1.24], 1)] }],
  };

  // Lime green civil 500 with a navy swoosh rising from the nose's lower edge across the aft
  // cabin to the boom's upper edge.
  const lime = '#62d63c',
    navy = '#14215a';
  const swoosh = (slot, a, b, width, bounds = []) => ({
    color: navy,
    planes: [
      space.sideLine(slot, a, b, 1),
      space.sideLine(slot, [a[0], a[1] + width], [b[0], b[1] + width], -1),
      ...bounds,
    ],
  });
  const limeCabin = {
    color: lime,
    zones: [
      swoosh('cabin', [1.0, 0.72], [-0.3, 0.86], 0.12, [space.ahead('cabin', -0.3)]),
      swoosh('cabin', [-0.3, 0.86], [-2.0, 1.62], 0.13, [space.behind('cabin', -0.3)]),
    ],
  };
  const limeBoom = { color: lime, zones: [swoosh('boom', [-1.6, 1.6], [-5.0, 1.22], 0.09)] };

  const ref = {
    army1966: commons(
      'US Army OH-6A 12931 in flight, c. 1966 (US Army, public domain)',
      'US Army OH-6A Cayuse.jpg',
    ),
    museum: commons(
      'OH-6A 67-16506 in US Army markings (Commons, CC BY-SA 2.0)',
      '67-16506 Hughes OH-6A Cayuse (369A) (cn 0891) US Army. (10880999226).jpg',
    ),
    cavalry: commons(
      'OH-6A 69-16011 (G-OHGA) in Vietnam-era Army markings, RIAT 2019 (Commons, CC BY 2.0)',
      '2019 Royal International Air Tattoo EGVA - Hughes OH-6A Cayuse - G-OHGA 69-16011 (48372649516).jpg',
    ),
    jgsdf: commons(
      'JGSDF Kawasaki OH-6D 31312 (Commons, CC BY-SA 2.0)',
      'JGSDF Kawasaki Hughes OH-6D (JG-1312 31312) (5412266743).jpg',
    ),
    danish: commons(
      'Royal Danish Army Hughes 500M H-203 (Commons, public domain)',
      'Danish OH-6.JPEG',
    ),
    blueWhite: commons(
      'OH-6A 67-16066 in blue and white at Topeka, 2012 (Aeroprints.com, CC BY-SA 3.0)',
      '67-16066 Hughes 369 OH-6A Cayuse U.S. Army (7516183628).jpg',
    ),
    lime: commons(
      'Hughes 500 N369FC at Frederick, Maryland (Commons, CC BY-SA 4.0)',
      'Hughes 500 N369FC FDK MD1.jpg',
    ),
  };

  return {
    selected: 'us-army-1966',
    anchors,
    graphics,
    variants: [
      {
        id: 'us-army-1966',
        label: 'US Army, 1966',
        provenance: {
          kind: 'inspired',
          note: 'US Army OH-6A 12931 as photographed in flight around 1966: FS 34087 olive drab, black UNITED STATES ARMY along the boom and the serial on the transmission fairing, redrawn. Approximate colors and letter sizes.',
          references: [ref.army1966, ref.museum],
        },
        paints: paints(OD),
        markings: [...both('boom-title', 'army-title'), ...both('pylon-serial', 'serial-12931')],
      },
      {
        id: 'us-army-air-cavalry',
        label: 'US Army air cavalry scout, Vietnam era',
        provenance: {
          kind: 'inspired',
          note: 'Vietnam-era air cavalry scout ("Loach") as restored on OH-6A 69-16011: olive drab, an orange fin top with black bands and orange stabilizer and strut, a red-white-blue band round the boom, the yellow troop disc and 011 on the transmission fairing, yellow skid toes and black UNITED STATES ARMY on the boom, all redrawn. The nose badge and the minigun are omitted; approximate colors and band positions.',
          references: [ref.cavalry, ref.army1966],
        },
        paints: paints(
          { color: '#4d5337' },
          {
            boom: cavalryBoom,
            fin: cavalryFin,
            stabilizer: { color: cavalryOrange },
            'stabilizer-strut': { color: cavalryOrange },
            skids: { color: '#4d5337' },
            toes: { color: '#e9bf2b' },
          },
        ),
        markings: [
          ...both('boom-title', 'army-title'),
          ...forward('pylon-disc', 'cav-disc'),
          ...both('pylon-serial', 'cav-011'),
        ],
      },
      {
        id: 'jgsdf-camouflage',
        label: 'JGSDF two-tone camouflage',
        provenance: {
          kind: 'inspired',
          note: 'Japan Ground Self-Defense Force OH-6 after OH-6D 31312: dark green and olive brown camouflage (a generated pattern in those colors, not the exact pattern), hinomaru on the boom and the serial on the transmission fairing. The kanji service title and unit badge are omitted; the OH-6D’s T-tail is not modelled (the OH-6A airframe stands in, as for the JGSDF OH-6J). Approximate colors.',
          references: [ref.jgsdf],
        },
        paints: paints(
          {
            color: '#4b5537',
            camouflage: {
              colors: ['#6e6544', '#3b4632'],
              scale: 2.2,
              seed: 31312,
              style: 'blotch',
            },
          },
          {
            boom: {
              color: '#4b5537',
              camouflage: {
                colors: ['#6e6544', '#3b4632'],
                scale: 1.6,
                seed: 1312,
                style: 'blotch',
              },
            },
            skids: { color: '#2b2f2c' },
            struts: { color: '#3b4632' },
          },
        ),
        markings: [...both('boom-roundel', 'hinomaru'), ...both('pylon-serial', 'jg-serial')],
      },
      {
        id: 'danish-army-500m',
        label: 'Royal Danish Army Hughes 500M',
        provenance: {
          kind: 'inspired',
          note: 'Royal Danish Army Hughes 500M H-203: very dark green overall, the Danish roundel on the aft cabin, the low-visibility code H-203 on the boom, a small Danish flag and the yellow warning band near the tail. The OH-6A airframe stands in for the closely related 500M; approximate colors.',
          references: [ref.danish],
        },
        paints: paints({ color: '#2b302a' }, { boom: danishBoom }),
        markings: [
          ...both('cabin-aft', 'dk-roundel'),
          ...both('boom-code', 'dk-code'),
          ...forward('boom-flag', 'dk-flag'),
        ],
      },
      {
        id: 'civil-blue-white',
        label: 'Civil OH-6A, blue and white',
        provenance: {
          kind: 'inspired',
          note: 'Civil-operated OH-6A colors and layout from the referenced 2012 photograph: white over a blue belly that sweeps up round the windshield frame, blue transmission fairing and boom spine, blue fin and white lower struts. The door emblem and the aircraft’s Army serial are omitted; registration N4367C is fictional.',
          references: [ref.blueWhite],
        },
        paints: paints(
          { color: WHITE },
          {
            cabin: blueWhiteCabin,
            pylon: { color: civilBlue },
            boom: blueWhiteBoom,
            fin: { color: civilBlue },
            ventral: { color: civilBlue },
            skids: { color: '#22262a' },
            struts: { color: WHITE },
          },
        ),
        markings: [...both('boom-reg', 'civil-reg-blue')],
      },
      {
        id: 'civil-lime-500',
        label: 'Civil Hughes 500, lime green',
        provenance: {
          kind: 'inspired',
          note: 'Civil Hughes 500 colors and layout from the referenced photograph: lime green with a navy swoosh from the nose’s lower edge up across the aft cabin and along the boom, navy fin and the registration in large navy italics on the transmission fairing. Operator logos are omitted and N5172F is fictional; the OH-6A airframe stands in for the civil 369.',
          references: [ref.lime],
        },
        paints: paints(
          { color: lime },
          {
            cabin: limeCabin,
            boom: limeBoom,
            fin: { color: navy },
            ventral: { color: navy },
            skids: { color: '#1b1d1f' },
          },
        ),
        markings: [...both('pylon-reg', 'civil-reg-lime')],
      },
    ],
  };
}
