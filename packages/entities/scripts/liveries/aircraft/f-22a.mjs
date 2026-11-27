/**
 * F-22A Raptor liveries: USAF wings and squadrons, each studied from photographs. The Raptor's
 * Have Glass scheme is shared fleet-wide: a light metallic gray with darker gray patches (the
 * wing box, stabilator centres, the fin's outer face and irregular patches on the fuselage);
 * the units differ on the fin: tail code, the AF/year + serial block, the wing badge and, for
 * some squadrons, a fin-tip band. National insignia sit only on the upper left and lower right
 * wing (the Raptor carries none on the fuselage).
 *
 * Model frame: +Z nose, +X the aircraft's left, +Y up. The fins cant out 27 degrees from a
 * root at x 1.55, y 2.4; fixed-fin leading edge z -1.25 at the root to -2.60 at the 3.0 m tip,
 * rudder hinge z -5.09 to -3.38.
 */
import { cantedFin, leanLivery, textGraphic } from '../art-fighters-b.mjs';

// Paint slots: the existing ones without the duplicate fin-code slots (same meshes as the
// fins). The canopy frame is a cut of the airframe skin and follows its slot.
export function slots(existing) {
  return Object.fromEntries(
    Object.entries(existing).filter(([name]) => !name.startsWith('fin-code')),
  );
}

const LIGHT = '#a6adb0', // Have Glass V light gray (about FS 36251, metallic sheen)
  DARK = '#737d83', // the darker FS 36170 patches
  CODE = '#c4c9ca', // low-visibility light gray lettering on the dark fin
  MID = '#8a9398';

const FIN = { root: [1.55, 2.4, -1.25], cant: (27 * Math.PI) / 180, span: 3.0 };
const leadingZ = (s) => -1.25 - 0.45 * s;
const hingeZ = (s) => -5.09 + 0.57 * s;
const AIRFRAME = 'body-F22-airframe-F22-light-gray',
  WINGBOX = 'upper-F22-airframe-F22-gray';

/**
 * A simplified wing badge as carried on Raptor fins: a shield outline with a single charge.
 * `motif` picks the charge: 'star' (15th Wing), 'peak' (3rd Wing), 'bolt' (325th FW),
 * 'chevron' (1st FW), 'bars' (53rd Wing). Original simplified drawings, not the heraldry.
 */
function wingShield(k, color, motif) {
  const w = 0.32,
    h = 0.36,
    c = new k.Canvas(w, h);
  const shield = (inset) => [
    [0.02 + inset, 0.34 - inset],
    [0.3 - inset, 0.34 - inset],
    [0.3 - inset, 0.15],
    [0.16, 0.01 + inset * 1.3],
    [0.02 + inset, 0.15],
  ];
  c.add(color, shield(0), [[...shield(0.022)].reverse()]);
  const cx = 0.16,
    cy = 0.19;
  if (motif === 'star') c.star(color, cx, cy, 0.085);
  else if (motif === 'peak')
    c.add(color, [
      [0.06, 0.1],
      [0.13, 0.25],
      [0.17, 0.18],
      [0.2, 0.22],
      [0.26, 0.1],
    ]);
  else if (motif === 'bolt')
    c.add(color, [
      [0.2, 0.3],
      [0.1, 0.18],
      [0.16, 0.18],
      [0.11, 0.06],
      [0.23, 0.2],
      [0.17, 0.2],
    ]);
  else if (motif === 'chevron')
    c.add(color, [
      [0.06, 0.12],
      [0.16, 0.26],
      [0.26, 0.12],
      [0.22, 0.12],
      [0.16, 0.2],
      [0.1, 0.12],
    ]);
  else for (const y of [0.1, 0.17, 0.24]) c.rect(color, 0.07, y, 0.18, 0.035);
  return c;
}

export default function design({ kit: k, space, slots: all, bounds }) {
  const fin = cantedFin(FIN.root, FIN.cant);
  const finSlot = (side) => `body-F22-fin-${side}-F22-light-gray`;
  const rudderSlot = (side) => `upper-F22-rudder-${side}-F22-gray`;
  const anchors = {};
  /** An anchor on the fin's outer face: span `s` up the fin, station z, size w x h metres. */
  const finAnchor = (name, side, s, z, w, h, slot = finSlot(side)) => {
    anchors[`${name}-${side}`] = space.anchor(slot, {
      center: fin.point(side, s, z),
      facing: fin.facing(side),
      up: fin.up(side),
      width: w,
      height: h,
      depth: 0.5,
    });
  };
  for (const side of [1, -1]) {
    // A vertical line through about 45 % of the fixed fin's chord carries the tail block
    // (the photographed TY, HH and AK fins).
    const at = (s) => leadingZ(s) + (hingeZ(s) - leadingZ(s)) * 0.45;
    finAnchor('fin-badge', side, 1.55, at(1.55), 0.32, 0.36);
    finAnchor('fin-code', side, 0.92, at(0.92), 1.2, 0.56);
    finAnchor('fin-serial', side, 0.36, at(0.36), 1.0, 0.3);
  }
  // Wing insignia: upper left (+X) and lower right, outboard on the wing box, bars spanwise.
  for (const [name, x, y, facing] of [
    ['wing-upper', 5.0, 1.98, 1],
    ['wing-lower', -5.0, 1.93, -1],
  ])
    anchors[name] = space.anchor(WINGBOX, {
      center: [x, y, -1.2],
      facing: [0, facing, 0],
      up: [0, 0, 1],
      width: 1.1,
      height: 0.6,
      depth: 0.4,
    });

  const text = (label, w, h, color, opts) => textGraphic(k, label, w, h, color, opts);
  /** The USAF serial block: "AF" over the fiscal year, then the last three digits. */
  const serial = (year, number, color) => {
    const c = new k.Canvas(1.0, 0.3);
    c.text(color, 'AF', { x: 0.27, y: 0.215, height: 0.085, align: 'right' });
    c.text(color, year, { x: 0.27, y: 0.085, height: 0.085, align: 'right' });
    c.text(color, number, { x: 0.31, y: 0.15, height: 0.24, align: 'left' });
    return c.graphic(`AF ${year} ${number}`);
  };
  const graphics = {
    'insignia-lowvis': k
      .usInsignia(new k.Canvas(1.1, 0.6), 0.55, 0.3, 0.26, {
        style: 'lowvis',
        color: '#bcc2c4',
        stroke: 0.022,
      })
      .graphic('US national insignia (low visibility)'),
  };
  for (const motif of ['star', 'peak', 'bolt', 'chevron', 'bars'])
    graphics[`badge-${motif}`] = wingShield(k, CODE, motif).graphic(`Wing badge (${motif})`);

  // Base paint. The Have Glass patches: the wing box and stabilator centres are their own
  // materials; the fuselage takes a blotch pattern two parts light to one part dark.
  const wholeBody = (color) =>
    Object.fromEntries(
      Object.keys(all)
        .filter((name) => name.startsWith('body-'))
        .map((name) => [name, { color }]),
    );
  /** The fin's dark patch: aft of a line 0.32 m behind the leading edge, below the tip. */
  const finZones = (side, color) => {
    const slot = finSlot(side);
    const up = fin.up(side);
    // In the fin plane, the direction across the leading edge pointing aft: -Z with its
    // component along the leading edge (up the span, 0.45 m aft per metre) removed.
    const le = [up[0], up[1], -0.45],
      len = Math.hypot(...le),
      d = le.map((v) => v / len),
      dot = -d[2],
      v = [-dot * d[0], -dot * d[1], -1 - dot * d[2]],
      m = Math.hypot(...v),
      across = v.map((x) => x / m);
    const lePoint = fin.point(side, 1.5, leadingZ(1.5));
    return [
      {
        color,
        planes: [
          space.plane(
            slot,
            across,
            lePoint.map((p, i) => p + across[i] * 0.32),
          ),
          space.plane(
            slot,
            up.map((u) => -u),
            fin.point(side, 2.55, 0),
          ),
        ],
      },
    ];
  };
  const patches = {
    colors: [LIGHT, LIGHT, DARK],
    scale: 1.1,
    seed: 2201,
    style: 'blotch',
  };
  const base = ({ finColor = DARK, rudder = LIGHT } = {}) => ({
    ...wholeBody(LIGHT),
    [AIRFRAME]: { color: LIGHT, camouflage: patches },
    [WINGBOX]: {
      color: DARK,
      camouflage: { colors: [DARK, DARK, MID], scale: 1.4, seed: 2207, style: 'blotch' },
    },
    'upper-F22-stabilator-1-F22-gray': { color: DARK },
    'upper-F22-stabilator--1-F22-gray': { color: DARK },
    [rudderSlot(1)]: { color: rudder },
    [rudderSlot(-1)]: { color: rudder },
    [finSlot(1)]: { color: LIGHT, zones: finZones(1, finColor) },
    [finSlot(-1)]: { color: LIGHT, zones: finZones(-1, finColor) },
  });
  const both = (anchor, graphic, flipRight = false) => [
    { anchor: `${anchor}-1`, graphic },
    { anchor: `${anchor}--1`, graphic, ...(flipRight ? { flip: true } : {}) },
  ];
  const wings = [
    { anchor: 'wing-upper', graphic: 'insignia-lowvis' },
    { anchor: 'wing-lower', graphic: 'insignia-lowvis' },
  ];
  /** Code, serial block (or a squadron line) and badge on both fins. */
  const tail = (code, year, number, motif, color = CODE) => {
    graphics[`code-${code}`] ??= text(code, 1.2, 0.56, color, { fill: 0.86 });
    const serialId = year ? `serial-${year}-${number}` : `line-${number}`;
    graphics[serialId] ??= year
      ? serial(year, number, color)
      : text(number, 1.0, 0.3, color, { fill: 0.8 });
    return [
      ...both('fin-code', `code-${code}`),
      ...both('fin-serial', serialId),
      ...both('fin-badge', `badge-${motif}`),
    ];
  };

  const references = {
    hickam: {
      title:
        'F-22A 03-4045 of the 19th Fighter Squadron, Joint Base Pearl Harbor-Hickam (USAF, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:19th_Fighter_Squadron_-_Lockheed_Martin_F-22A_LRIP_Lot_3_Block_20_Raptor_03-4045.jpg',
    },
    elmendorf: {
      title: 'F-22A 06-4108 AK of the 3rd Wing at Avalon (GFDL)',
      url: 'https://commons.wikimedia.org/wiki/File:06-4108-AK_Lockheed_Martin_F-22A-30-LM_Raptor_USAF_(6943757704).jpg',
    },
    tyndall: {
      title: "F-22A 05-4095 'TY 95FS' of the 95th Fighter Squadron (CC BY-SA 2.0)",
      url: 'https://commons.wikimedia.org/wiki/File:Lockheed_Martin_F-22A_Raptor_%E2%80%9895FS_TY%E2%80%99_-05-4095-_(30873278036).jpg',
    },
    overhead: {
      title: 'F-22A 08-152 FF from above: wing insignia and patch pattern (CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Lockheed_Martin_F-22A_Raptor_%E2%80%9908-152_-_FF%E2%80%99_(29102586122).jpg',
    },
    edit1: {
      title: 'F-22 Raptor in flight, upper surfaces (USAF, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:F-22_Raptor_edit1.jpg',
    },
    langley: {
      title: "F-22A 08-4152 'FF' of the 1st Fighter Wing, fin markings (CC BY-SA 2.0)",
      url: 'https://commons.wikimedia.org/wiki/File:Lockheed_Martin_F-22A_Raptor_%E2%80%9908-152_-_FF%E2%80%99_(28587915994).jpg',
    },
    nellis: {
      title: "F-22A 04-4066 'OT' of the 422nd Test and Evaluation Squadron (CC BY-SA 2.0)",
      url: 'https://commons.wikimedia.org/wiki/File:Lockheed_Martin_F-22_Raptor_%E2%80%9904-066_-_OT%E2%80%99_(27498673043).jpg',
    },
  };
  const common =
    'Have Glass light gray with the darker wing box, stabilator centres and fin patch, irregular darker patches on the fuselage (a blotch pattern, not the exact patch outlines), low-visibility national insignia upper left and lower right wing';

  const built = {
    selected: 'ty-95fs-tyndall',
    anchors,
    graphics,
    variants: [
      {
        id: 'ty-95fs-tyndall',
        label: '95th FS flagship, Tyndall (TY)',
        provenance: {
          kind: 'inspired',
          note: `F-22A 05-4095, the 95th Fighter Squadron's flagship at Tyndall, from the referenced photograph: ${common}. The fin carries TY over 95 FS in low-visibility light gray with the 325th Fighter Wing badge above (simplified to a shield with a lightning bolt, not the heraldry).`,
          references: [references.tyndall, references.overhead],
        },
        paints: base(),
        markings: [...tail('TY', null, '95 FS', 'bolt'), ...wings],
      },
      {
        id: 'hh-19fs-hickam',
        label: '19th FS, Hickam (HH)',
        provenance: {
          kind: 'inspired',
          note: `F-22A 03-4045 of the 19th Fighter Squadron (15th Wing, flown with the Hawaii ANG 199th Fighter Squadron) from the referenced photograph: ${common}. The fin carries HH and AF 03 045 in low-visibility light gray with the wing badge above (simplified to a shield with a star).`,
          references: [references.hickam, references.edit1],
        },
        paints: base(),
        markings: [...tail('HH', '03', '045', 'star'), ...wings],
      },
      {
        id: 'ak-3rd-wing-elmendorf',
        label: '3rd Wing, Elmendorf (AK)',
        provenance: {
          kind: 'inspired',
          note: `F-22A 06-4108 of the 3rd Wing, Joint Base Elmendorf-Richardson, from the referenced photograph: ${common}. The fin carries AK and AF 06 108 in low-visibility light gray with the wing badge above (simplified to a shield with a mountain peak).`,
          references: [references.elmendorf, references.edit1],
        },
        paints: base(),
        markings: [...tail('AK', '06', '108', 'peak'), ...wings],
      },
      {
        id: 'ff-1st-fighter-wing',
        label: '1st Fighter Wing, Langley (FF)',
        provenance: {
          kind: 'inspired',
          note: `F-22A 08-4152 of the 1st Fighter Wing, Joint Base Langley-Eustis, from the referenced photographs: ${common}. The fin carries FF and AF 08 152 in low-visibility light gray with the wing badge above (simplified to a shield with a chevron).`,
          references: [references.langley, references.overhead],
        },
        paints: base(),
        markings: [...tail('FF', '08', '152', 'chevron'), ...wings],
      },
      {
        id: 'ot-422-tes-nellis',
        label: '422nd TES, 53rd Wing, Nellis (OT)',
        provenance: {
          kind: 'inspired',
          note: `F-22A 04-4066 of the 422nd Test and Evaluation Squadron, 53rd Wing, Nellis, from the referenced photograph: ${common}. The fin carries OT and AF 04 066 in low-visibility light gray with the 53rd Wing badge above (simplified to a shield with bars).`,
          references: [references.nellis, references.edit1],
        },
        paints: base(),
        markings: [...tail('OT', '04', '066', 'bars'), ...wings],
      },
    ],
  };
  return leanLivery(built, bounds);
}
