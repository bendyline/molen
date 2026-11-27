/**
 * Dash 8-400 liveries. Government users carry their real markings (France's Sécurité Civile
 * Q400MR tankers); airline schemes reproduce colours, cheatlines and tail patterns only, with
 * no titles, logos or emblems. Registrations are fictional in the right national format.
 *
 * Model frame: +Z nose, +X the aircraft's left, +Y up. The body sits 0.5 degrees nose down, so
 * lines along the fuselage are written against its axis: `ax(z, h)` is the point h metres above
 * the axis at station z (windows run h 0.05 to 0.39, the belly break near h -0.62).
 */
import {
  bothSides,
  bothSidesText,
  civilDefenceDisc,
  lettering,
  paintAll,
  sideAnchors,
  sideCanvas,
} from '../art-regional.mjs';

const P = 'DH8D';
export function slots() {
  const s = (materials, node) => ({ materials: materials.map((m) => `${P}-${m}`), node });
  return {
    skin: s(['paint'], 'fuselage-skin'),
    belly: s(['belly'], 'fuselage-belly'),
    'nose-door-l': s(['belly'], 'gear-0-door-left'),
    'nose-door-r': s(['belly'], 'gear-0-door-right'),
    root: s(['paint'], 'wing-root-fairing'),
    fin: s(['paint'], 'fin'),
    'fin-top': s(['paint'], 'fin-top-fairing'),
    rudder: s(['paint'], 'rudder'),
    'tailplane-l': s(['paint'], 'tailplane-1'),
    'tailplane-r': s(['paint'], 'tailplane--1'),
    'elevator-l': s(['paint'], 'elevator-1'),
    'elevator-r': s(['paint'], 'elevator--1'),
    'nacelle-l': s(['paint'], 'engine-1'),
    'nacelle-r': s(['paint'], 'engine-2'),
    wing: s(['wing']),
    controls: s(['controls']),
    // Projection only (never painted): the whole painted airframe, for side-view artwork that
    // runs across the skin, belly and fin.
    hull: s(['paint', 'belly'], 'airframe'),
  };
}

// The fuselage axis and the points h metres above it.
const yc = (z) => 2.483 - 0.0087 * z;
const ax = (z, h) => [z, yc(z) + h];
/** Piecewise-linear lookup in a [[z, value], ...] table sorted by z. */
const lookup = (table) => (z) => {
  if (z <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++)
    if (z <= table[i][0]) {
      const [z0, v0] = table[i - 1],
        [z1, v1] = table[i];
      return v0 + ((v1 - v0) * (z - z0)) / (z1 - z0);
    }
  return table.at(-1)[1];
};
// How far the tail cone's mid-line (its widest point) climbs above the cabin axis.
const tailRise = lookup([
  [-14.4, 0.93],
  [-14, 0.9],
  [-13, 0.83],
  [-12, 0.73],
  [-11, 0.6],
  [-10, 0.5],
  [-9, 0.36],
  [-8, 0.24],
  [-7, 0.15],
  [-6, 0.04],
  [-5.5, 0],
]);
const HALF = 1.345;

const WHITE = '#eceeeb',
  WING_GRAY = '#c9cdcf',
  LIGHT_GRAY = '#b9bec1';

export default function design({ kit: k, space }) {
  const anchors = {},
    graphics = {};
  const body = ['skin', 'belly', 'root', 'nose-door-l', 'nose-door-r'];
  const tail = ['fin', 'fin-top', 'rudder'];
  const stab = ['tailplane-l', 'tailplane-r', 'elevator-l', 'elevator-r'];
  const nacelles = ['nacelle-l', 'nacelle-r'];
  const side = (name, box, outer = HALF + 0.15) =>
    Object.assign(anchors, sideAnchors(space, 'hull', name, box, { outer }));
  // A projector for lettering on the fuselage side at station z (centre), height y (centre).
  const textAnchor = (name, z, y, width, height, depth = 0.7) => {
    for (const s of [1, -1])
      anchors[`${name}-${s > 0 ? 'l' : 'r'}`] = space.anchor('hull', {
        center: [s * (HALF - depth / 2 + 0.12), y, z],
        facing: [s, 0, 0],
        width,
        height,
        depth,
      });
  };
  // Fin artwork on the fin and rudder only (not the fuselage or the tip fairing).
  const finSide = (name, box) => {
    for (const slot of ['fin', 'rudder'])
      Object.assign(anchors, sideAnchors(space, slot, `${name}-${slot}`, box, { outer: 0.45 }));
  };
  const finArt = (name, graphic) => [
    ...bothSides(`${name}-fin`, graphic),
    ...bothSides(`${name}-rudder`, graphic),
  ];
  const finAnchor = (name, z, y, width, height) => {
    for (const s of [1, -1])
      anchors[`${name}-${s > 0 ? 'l' : 'r'}`] = space.anchor('hull', {
        center: [s * 0.2, y, z],
        facing: [s, 0, 0],
        width,
        height,
        depth: 0.36,
      });
  };

  /* ------------------------------------------------ Sécurité Civile, 2013 scheme ---- */
  // Three cheatlines under the windows: red pinline, black, red; the lower red opens into the
  // red chin ahead of the wing and the red tail cone; the fin carries a red cap over a black
  // stripe and the tanker number.
  const SC_RED = '#d52a1f',
    SC_BLACK = '#1d1d1f';
  const scLines = {
    pin: [0.06, 0.13],
    black: [-0.17, 0.0],
    red: [-0.42, -0.24],
  };
  {
    // Forward sweep: the lines rise over the forward door to the cockpit sill and fall along
    // the radome to its tip; the chin red fills under them back to the forward door.
    const box = { aft: 6.5, fore: 16.45, low: 0.95, high: 3.4 };
    const v = sideCanvas(k, box);
    const smooth = (t) => t * t * (3 - 2 * t);
    const lift = (z) => {
      if (z <= 11) return 0;
      if (z <= 13.5) return 0.25 * smooth((z - 11) / 2.5);
      const t = (z - 13.5) / 2.85;
      return 0.25 - 1.0 * t * t;
    };
    const at = (h) => (z) => yc(z) + h + lift(z);
    // The chin: under the lower line, down to the keel, ending aft in a curve that lifts into
    // the lower red cheatline under the wing.
    const chinBottom = (z) => {
      if (z >= 11.4) return box.low;
      const t = Math.min(1, (11.4 - z) / 3.2);
      return box.low + (yc(z) + scLines.red[0] - box.low) * smooth(t);
    };
    v.band(SC_RED, at(scLines.red[1]), chinBottom, 6.5, 16.3, 48);
    v.band(SC_RED, at(scLines.pin[1]), at(scLines.pin[0]), 6.5, 16.35, 48);
    v.band(SC_BLACK, at(scLines.black[1]), at(scLines.black[0]), 6.5, 16.4, 48);
    graphics['sc-fore'] = v.graphic('Securite Civile forward cheatlines');
    side('sc-fore', box);
  }
  {
    // Aft sweep: the lines climb the tail cone to its tip; behind the rear door the lower red
    // fills the tail cone underneath.
    const box = { aft: -14.45, fore: -5.5, low: 1.1, high: 4.2 };
    const v = sideCanvas(k, box);
    const rise = (z) => tailRise(z);
    const at = (h) => (z) => yc(z) + h + rise(z);
    v.band(SC_RED, at(scLines.pin[1]), at(scLines.pin[0]), -14.4, -5.5, 36);
    v.band(SC_BLACK, at(scLines.black[1]), at(scLines.black[0]), -14.4, -5.5, 36);
    const redBottom = (z) => {
      const base = at(scLines.red[0])(z);
      if (z >= -9.4) return base;
      const t = Math.min(1, (-9.4 - z) / 1.6);
      return base - 2 * t * t * (3 - 2 * t);
    };
    v.band(SC_RED, at(scLines.red[1]), redBottom, -14.4, -5.5, 36);
    graphics['sc-aft'] = v.graphic('Securite Civile aft cheatlines');
    side('sc-aft', box);
  }
  // The middle run is straight: three bands as paint zones on the skin and belly.
  const band = (color, [lo, hi], z0, z1) => ({
    color,
    steps: [
      ['line', ax(z0, lo), ax(z1, lo), 1],
      ['line', ax(z0, hi), ax(z1, hi), -1],
      ['behind', z1],
      ['ahead', z0],
    ],
  });
  const scZones = [
    band(SC_RED, scLines.pin, -6, 7),
    band(SC_BLACK, scLines.black, -6, 7),
    band(SC_RED, scLines.red, -6, 7),
    // The chin and the tail cone are red underneath too.
    {
      color: SC_RED,
      steps: [
        ['ahead', 11.3],
        ['behind', 15.6],
        ['below', 1.5],
      ],
    },
    {
      color: SC_RED,
      steps: [
        ['behind', -9.9],
        ['line', [-9.9, 2.05], [-14.4, 3.3], -1],
      ],
    },
  ];
  {
    // Fin: red cap above a black stripe, deeper at the leading edge.
    const box = { aft: -16.3, fore: -11.0, low: 6.0, high: 8.08 };
    const v = sideCanvas(k, box);
    const cap = (z) => 7.38 - (z + 12.6) * 0.19;
    v.band(SC_RED, () => 8.08, cap, -16.3, -11.0, 4);
    v.band(
      SC_BLACK,
      (z) => cap(z) - 0.09,
      (z) => cap(z) - 0.3,
      -16.3,
      -11.0,
      4,
    );
    graphics['sc-fin'] = v.graphic('Securite Civile fin cap');
    side('sc-fin', box, 0.4);
  }
  graphics['sc-fleet-79'] = lettering(k, '79', 1.7, 1.35, SC_BLACK, {
    face: 'regular',
    scale: 0.98,
  });
  finAnchor('fin-number', -13.3, 6.55, 1.7, 1.35);
  graphics['sc-titles'] = lettering(k, 'SECURITE CIVILE', 5.6, 0.36, SC_BLACK, {
    face: 'technical',
    scale: 0.82,
  });
  textAnchor('titles', 7.6, yc(7.6) + 0.72, 5.6, 0.36);
  graphics['sc-type'] = lettering(k, 'Q400-MR', 1.9, 0.3, SC_BLACK, {
    face: 'technical',
    scale: 0.85,
  });
  textAnchor('type', 9.2, yc(9.2) - 0.82, 1.9, 0.3);
  graphics['reg-f-zbqv'] = lettering(k, 'F-ZBQV', 2.2, 0.36, SC_BLACK, {
    face: 'technical',
    scale: 0.85,
  });
  textAnchor('reg-aft', -10.3, 3.53, 2.2, 0.36, 1.1);
  graphics['roundel-france'] = k
    .roundel(new k.Canvas(0.5, 0.5), 0.25, 0.25, 0.24, k.ROUNDELS.france)
    .graphic('French roundel');
  textAnchor('roundel-aft', -8.2, yc(-8.2) - 0.19, 0.5, 0.5);
  graphics['civil-defence'] = civilDefenceDisc(new k.Canvas(0.5, 0.5), 0.25, 0.25, 0.24).graphic(
    'Civil defence sign',
  );
  textAnchor('emblem', 12.25, yc(12.25) + 0.62, 0.5, 0.5);

  /* ------------------------------------------------ Flybe, 2018 purple scheme ---- */
  // Purple overall; an orange and a red band slant back across the tail cone ahead of the
  // white tail cone and fin.
  const FB_PURPLE = '#6431b4',
    FB_ORANGE = '#f29b1f',
    FB_RED = '#e0322a';
  // Measured along the photographed fuselage from the tail: the orange band's forward edge
  // leaves the keel 9 m ahead of the tail cone tip and meets the fin root 6.2 m ahead of it;
  // the bands narrow a little as they climb.
  const edgeA = [
      [-5.3, 1.3],
      [-8.2, 3.9],
    ],
    edgeB = [
      [-7.15, 1.3],
      [-9.35, 3.9],
    ],
    edgeC = [
      [-8.3, 1.3],
      [-10.2, 3.9],
    ];
  const fbZones = [
    {
      color: FB_PURPLE,
      steps: [
        ['line', ...edgeA, 1],
        ['below', 4.0],
      ],
    },
    {
      color: FB_ORANGE,
      steps: [
        ['line', ...edgeA, -1],
        ['line', ...edgeB, 1],
        ['below', 4.0],
      ],
    },
    {
      color: FB_RED,
      steps: [
        ['line', ...edgeB, -1],
        ['line', ...edgeC, 1],
        ['below', 4.0],
      ],
    },
  ];
  graphics['reg-g-jeqz'] = lettering(k, 'G-JEQZ', 1.6, 0.3, '#1a1a1c', {
    face: 'technical',
    scale: 0.85,
  });
  textAnchor('reg-tail', -13.05, 3.42, 1.6, 0.3, 1.0);

  /* ------------------------------------------------ WestJet Encore ---- */
  // White overall; the fin is teal above a white band, and below it a white diagonal divides
  // a blue forward panel from a teal aft one.
  const WJ_TEAL = '#0f8c8c',
    WJ_BLUE = '#1b3d8f',
    WJ_NAVY = '#1c2d5a';
  {
    const box = { aft: -16.3, fore: -7.4, low: 3.3, high: 8.08 };
    const v = sideCanvas(k, box);
    v.poly(WJ_TEAL, [
      [-7.4, 6.08],
      [-16.3, 6.08],
      [-16.3, 8.08],
      [-7.4, 8.08],
    ]);
    // Below the band: blue ahead of the diagonal, teal behind it.
    const diag = (y) => -11.55 - ((y - 3.8) / (5.86 - 3.8)) * 3.35;
    const w = 0.42;
    v.poly(WJ_BLUE, [
      [-7.4, 3.3],
      [diag(3.3) + w / 2, 3.3],
      [diag(5.86) + w / 2, 5.86],
      [-7.4, 5.86],
    ]);
    v.poly(WJ_TEAL, [
      [diag(3.3) - w / 2, 3.3],
      [-16.3, 3.3],
      [-16.3, 5.86],
      [diag(5.86) - w / 2, 5.86],
    ]);
    graphics['wj-fin'] = v.graphic('WestJet tail pattern');
    finSide('wj-fin', box);
  }
  graphics['wj-fleet'] = lettering(k, '447', 0.6, 0.22, '#ffffff', {
    face: 'technical',
    scale: 0.85,
  });
  finAnchor('fin-fleet', -13.1, 7.78, 0.6, 0.22);
  graphics['reg-c-gwqz'] = lettering(k, 'C-GWQZ', 1.9, 0.32, WJ_NAVY, {
    face: 'technical',
    scale: 0.82,
    slant: 0.18,
  });
  textAnchor('reg-aft-high', -10.3, 3.55, 1.9, 0.32, 1.1);

  /* ------------------------------------------------ Porter Airlines, 2023 scheme ---- */
  // White overall with an all-navy tail (the wordmark pattern on the fin is left off).
  const PO_NAVY = '#1f2c4b';
  graphics['reg-c-gkqz'] = lettering(k, 'C-GKQZ', 1.8, 0.3, PO_NAVY, {
    face: 'technical',
    scale: 0.85,
  });
  graphics['po-fleet'] = lettering(k, '829', 0.55, 0.2, PO_NAVY, {
    face: 'technical',
    scale: 0.85,
  });
  textAnchor('fleet-cone', -12.1, 3.22, 0.55, 0.2, 1.0);

  const references = {
    sc74: {
      title: 'F-ZBMD (74) Dash 8Q-402MR Securite Civile, Toulouse 2013 (CC BY-SA 3.0)',
      url: 'https://commons.wikimedia.org/wiki/File:F-ZBMD(74)_Dash_8Q-402MR_Securite_Civile_TLS_25SEP13_(9946654405).jpg',
    },
    flybe: {
      title: 'G-JECM Bombardier Dash 8 Q400, Flybe (CC BY 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:G-JECM_-_Bombardier_Dash_8_Q400_-_Flybe_(28328880961).jpg',
    },
    westjet: {
      title: 'C-FWEP WestJet Encore Dash 8-Q400 (CC BY 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:C-FWEP_Westjet_Encore_Dash_8-Q400.jpg',
    },
    porter: {
      title: 'Porter Airlines Bombardier Q400 C-GKQB departing Boston, June 2025 (CC BY 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Porter_Airlines_Bombardier_Q400_C-GKQB_departing_Boston_June_2025.jpg',
    },
  };

  const plain = (color) => ({ color });
  const same = (list, color) => Object.fromEntries(list.map((s) => [s, plain(color)]));
  const greyWings = { wing: plain(WING_GRAY), controls: plain(LIGHT_GRAY) };

  return {
    selected: 'securite-civile-2013',
    anchors,
    graphics,
    variants: [
      {
        id: 'securite-civile-2013',
        label: 'Sécurité Civile Q400MR tanker, 2013',
        provenance: {
          kind: 'inspired',
          note: 'French Sécurité Civile Q400MR water/retardant bomber as photographed in 2013: white overall with red, black and red cheatlines under the windows that open into a red chin and a red tail cone, red fin cap over a black stripe, tanker number on the fin, SECURITE CIVILE titles, the French roundel aft and the civil defence sign behind the flight deck (original vector drawings). Registration F-ZBQV and tanker number 79 are fictional; the belly tank, the FIREGUARD and danger stencils are omitted. Line heights and colours are approximate.',
          references: [references.sc74],
        },
        paints: {
          ...paintAll(space, body, WHITE, scZones),
          ...same(tail, WHITE),
          ...same(stab, WHITE),
          ...paintAll(space, nacelles, WHITE, [
            {
              color: SC_BLACK,
              steps: [
                ['above', 3.0],
                ['below', 3.12],
                ['behind', 4.2],
              ],
            },
            {
              color: SC_RED,
              steps: [
                ['above', 2.86],
                ['below', 2.95],
                ['behind', 4.2],
              ],
            },
          ]),
          ...greyWings,
        },
        markings: [
          ...bothSides('sc-fore', 'sc-fore'),
          ...bothSides('sc-aft', 'sc-aft'),
          ...bothSides('sc-fin', 'sc-fin'),
          ...bothSidesText('fin-number', 'sc-fleet-79'),
          ...bothSidesText('titles', 'sc-titles'),
          ...bothSidesText('type', 'sc-type'),
          ...bothSidesText('reg-aft', 'reg-f-zbqv'),
          ...bothSidesText('roundel-aft', 'roundel-france'),
          ...bothSidesText('emblem', 'civil-defence'),
        ],
      },
      {
        id: 'purple-orange-red-bands',
        label: 'Purple with orange and red bands',
        provenance: {
          kind: 'inspired',
          note: "Flybe's 2018 scheme as photographed on G-JECM: purple fuselage, wing root fairing and nacelles, an orange and a red band slanting back across the tail cone, white tail cone, fin and tailplane. The flybe wordmark and dots on the fin, the fuselage titles and the slogan are left off. Registration G-JEQZ is fictional. Band positions and colours are approximate.",
          references: [references.flybe],
        },
        paints: {
          ...paintAll(space, [...body, 'fin'], WHITE, fbZones),
          ...same(['fin-top', 'rudder'], WHITE),
          ...same(stab, WHITE),
          ...same(nacelles, FB_PURPLE),
          wing: plain('#c4c6cc'),
          controls: plain('#b4b7bd'),
        },
        markings: [...bothSidesText('reg-tail', 'reg-g-jeqz')],
      },
      {
        id: 'white-teal-blue-tail',
        label: 'White with teal and blue tail',
        provenance: {
          kind: 'inspired',
          note: 'WestJet Encore scheme as photographed on C-FWEP: white overall; the fin teal above a white band, below it a white diagonal dividing a blue forward panel from a teal aft panel, white fleet number near the tip. The fuselage and nacelle titles and the flag are left off; registration C-GWQZ and fleet number 447 are fictional. Fin proportions are approximate.',
          references: [references.westjet],
        },
        paints: {
          ...same(body, WHITE),
          ...same(tail, WHITE),
          ...same(stab, WHITE),
          ...same(nacelles, WHITE),
          ...greyWings,
        },
        markings: [
          ...finArt('wj-fin', 'wj-fin'),
          ...bothSidesText('fin-fleet', 'wj-fleet'),
          ...bothSidesText('reg-aft-high', 'reg-c-gwqz'),
        ],
      },
      {
        id: 'white-navy-tail',
        label: 'White with navy tail',
        provenance: {
          kind: 'inspired',
          note: "Porter Airlines' current scheme as photographed on C-GKQB: white fuselage, nacelles and wing root, navy fin, rudder, fin tip and tailplane, navy registration and fleet number on the tail cone. The repeated wordmark pattern on the fin and the fuselage titles are left off; registration C-GKQZ and fleet number 829 are fictional.",
          references: [references.porter],
        },
        paints: {
          ...same(body, WHITE),
          ...same(tail, PO_NAVY),
          ...same(stab, PO_NAVY),
          ...same(nacelles, WHITE),
          ...greyWings,
        },
        markings: [
          ...bothSidesText('reg-aft', 'reg-c-gkqz'),
          ...bothSidesText('fleet-cone', 'po-fleet'),
        ],
      },
    ],
  };
}
