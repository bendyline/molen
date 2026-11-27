/**
 * Leonardo AW139 liveries: the US Air Force's MH-139A Grey Wolf, the Italian Coast Guard and
 * Guardia di Finanza, an Ontario air ambulance and a US state police scheme, each studied from a
 * photograph. Military insignia, service titles and serials are shown; civil operators keep their
 * colors and layout with fictional registrations, plain functional words and no names or logos.
 * Lettering is real type and every emblem is an original vector drawing.
 */
import { both, lettering, P, pair, scheme } from '../art-helicopters-a.mjs';

export function slots() {
  return {
    // Cabin, boom (the skin runs on into it), cowlings and stabilizer endplates.
    shell: { materials: ['AW139-white'], node: 'AW139-shell-AW139-white' },
    // The cheatline band, fin and horizontal stabilizer.
    accent: { materials: ['AW139-teal'], node: 'AW139-shell-AW139-teal' },
    'sponson-r': { materials: ['AW139-white'], node: 'sponson-AW139-white' },
    'sponson-l': { materials: ['AW139-white'], node: 'sponson-AW139-white_1' },
    hub: { materials: ['AW139-white'], node: 'hub-AW139-white' },
    // Tail rotor blade bands and main rotor blade tips.
    'tail-bands': { materials: ['AW139-teal'], node: 'tail-rotor' },
    'blade-tips': { materials: ['AW139-teal'], node: 'main-rotor' },
  };
}

// Fuselage stations from the AW139 builder: z, half width, keel, crown, widest at, exponents.
const SHELL = [
  [4.42, 0.36, 0.58, 0.98, 0.76, 3, 2.8],
  [4.2, 0.6, 0.47, 1.14, 0.78, 3.4, 3],
  [3.65, 0.84, 0.365, 1.31, 0.84, 3.8, 3.4],
  [3.2, 0.99, 0.355, 1.45, 0.92, 4.2, 3.8],
  [2.22, 1.09, 0.355, 2.16, 1.15, 4.4, 4.2],
  [1.5, 1.13, 0.345, 2.25, 1.28, 4.6, 4.5],
  [0.1, 1.13, 0.345, 2.25, 1.3, 4.6, 4.5],
  [-1.8, 1.13, 0.405, 2.25, 1.32, 4.6, 4.5],
  [-2.85, 0.93, 0.705, 2.18, 1.42, 4, 3.6],
  [-3.55, 0.63, 1.045, 2.12, 1.6, 3.4, 3],
  [-6.95, 0.23, 1.645, 2.01, 1.86, 2.8, 2.4],
  [-8.3, 0.16, 1.905, 2.17, 2.06, 2.6, 2.4],
];
/** Half width of the skin at station z and height y (linear between stations). */
function shellX(z, y) {
  let i = SHELL.findIndex((s) => s[0] <= z);
  if (i <= 0) i = 1;
  const a = SHELL[i - 1],
    b = SHELL[i],
    u = (a[0] - z) / (a[0] - b[0]);
  const [, w, keel, crown, widest, up, down] = a.map((v, k) => v + (b[k] - v) * u);
  const t = y >= widest ? (y - widest) / (crown - widest) : (widest - y) / (widest - keel);
  const e = y >= widest ? up : down;
  return w * Math.max(0, 1 - Math.min(1, t) ** e) ** (1 / e);
}
// The builder's cheatline: its lower edge along these (z, y) points, 8.5 cm tall.
const STRIPE = [
  [-8.3, 2.04],
  [-6.95, 1.77],
  [-3.55, 1.17],
  [-1.85, 0.53],
  [1.5, 0.48],
  [3.6, 0.64],
  [4.32, 0.76],
];

const WHITE = '#f3f3ef';

export default function design({ kit: k, space }) {
  const anchors = {};
  const add = (...more) => Object.assign(anchors, ...more);
  /** Side anchors on the skin at (z, y); `lean` turns them with the boom's taper. */
  const skin = (name, z, y, width, height, { lean = 0, depth = 0.5 } = {}) =>
    add(
      pair(space, name, (side) => ({
        slot: 'shell',
        center: [side * shellX(z, y), y, z],
        facing: [side, 0, -lean],
        width,
        height,
        depth,
      })),
    );
  skin('cabin-title', 0.25, 0.92, 1.7, 0.22);
  skin('door-code', 2.35, 0.85, 0.55, 0.2);
  skin('rear-emblem', -1.5, 1.45, 0.5, 0.5);
  skin('rear-cabin', -2.6, 1.55, 1.0, 0.85, { lean: 0.15, depth: 0.6 });
  skin('boom-title', -4.7, 1.72, 1.9, 0.26, { lean: 0.12, depth: 0.5 });
  skin('boom-aft', -5.6, 1.84, 1.3, 0.22, { lean: 0.12, depth: 0.4 });
  // Cowling flank, which leans in toward the crown.
  add(
    pair(space, 'cowl', (side) => ({
      slot: 'shell',
      center: [side * 0.8, 2.6, -0.6],
      facing: [side, 0.15, 0],
      width: 1.1,
      height: 0.26,
      depth: 0.3,
    })),
    pair(space, 'cowl-flag', (side) => ({
      slot: 'shell',
      center: [side * 0.62, 2.92, 0.15],
      facing: [side, 0.5, 0],
      width: 0.27,
      height: 0.15,
      depth: 0.3,
    })),
    // Fin: upper fin faces, 12 cm out either side of the centreline.
    pair(space, 'fin', (side) => ({
      slot: 'accent',
      center: [side * 0.12, 3.05, -8.35],
      width: 0.75,
      height: 0.3,
      depth: 0.1,
    })),
  );

  const graphics = {};
  const exterior = ['shell', 'accent', 'sponson-l', 'sponson-r'];
  // Zones that follow the cheatline: a band `lo`..`hi` metres above its lower edge.
  const alongStripe = (color, lo, hi, only) =>
    STRIPE.slice(1).map((b, i) => {
      const a = STRIPE[i],
        lift = (q, dy) => [q[0], q[1] + dy];
      return {
        color,
        planes: [
          P.line(lift(a, lo), lift(b, lo), 1),
          P.line(lift(a, hi), lift(b, hi), -1),
          // Stop short of the stabilizer and fin, which share the cheatline's material.
          P.ahead(i ? a[0] : -7.15),
          P.behind(b[0] + (i === STRIPE.length - 2 ? 0.5 : 0)),
        ],
        ...(only ? { only } : {}),
      };
    });

  /* ------------------------------------------------------ USAF MH-139A Grey Wolf ---- */
  const GUNSHIP = '#50555a',
    INSIGNIA = '#2b2f33';
  graphics['usaf-insignia'] = k
    .usInsignia(new k.Canvas(1.0, 0.85), 0.5, 0.425, 0.22, { style: 'lowvis', color: INSIGNIA })
    .graphic('US national insignia (low visibility)');
  graphics['usaf-serial'] = (() => {
    const w = 0.75,
      h = 0.3,
      c = new k.Canvas(w, h);
    c.text(INSIGNIA, 'AF 21-001', { x: w / 2, y: h * 0.62, height: 0.075 });
    c.text(INSIGNIA, 'U.S. AIR FORCE', { x: w / 2, y: h * 0.25, height: 0.06 });
    return c.graphic('USAF serial');
  })();

  /* ---------------------------------------------- Italian Coast Guard (Guardia Costiera) ---- */
  const GC_RED = '#c8202b';
  const coastZones = [
    { color: GC_RED, planes: [P.below(0.64)] },
    // The broad red band round the rear cabin, up over the cowling.
    { color: GC_RED, planes: [P.behind(-1.08), P.ahead(-2.15)], only: ['shell'] },
    // Upper fin red.
    { color: GC_RED, planes: [P.above(2.78), P.behind(-7.0)], only: ['accent'] },
    // Black anti-glare panel on the nose ahead of the windscreen.
    { color: '#1a1c1e', planes: [P.ahead(3.18), P.behind(4.28), P.above(1.0)], only: ['shell'] },
  ];
  graphics['gc-title'] = lettering(k, 'GUARDIA COSTIERA', 1.7, 0.22, GC_RED, { capHeight: 0.15 });
  graphics['gc-anchor'] = (() => {
    const s = 0.5,
      c = new k.Canvas(s, s),
      ink = '#141414';
    c.circle(WHITE, s / 2, s / 2, s * 0.47);
    // Anchor: ring, shank, stock and curved arms with flukes (original drawing).
    c.ring(ink, s / 2, s * 0.8, s * 0.035, s * 0.065, 24);
    c.rect(ink, s / 2 - s * 0.025, s * 0.2, s * 0.05, s * 0.55);
    c.rect(ink, s * 0.33, s * 0.66, s * 0.34, s * 0.04);
    const arc = [];
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI + (i * Math.PI) / 16;
      arc.push([s / 2 + Math.cos(a) * s * 0.22, s * 0.4 + Math.sin(a) * s * 0.2]);
    }
    for (let i = 0; i < arc.length - 1; i++) {
      const [x0, y0] = arc[i],
        [x1, y1] = arc[i + 1];
      c.box(
        ink,
        (x0 + x1) / 2,
        (y0 + y1) / 2,
        Math.hypot(x1 - x0, y1 - y0) + 0.004,
        s * 0.045,
        Math.atan2(y1 - y0, x1 - x0),
      );
    }
    for (const sx of [-1, 1])
      c.add(ink, [
        [s / 2 + sx * s * 0.22, s * 0.4],
        [s / 2 + sx * s * 0.29, s * 0.36],
        [s / 2 + sx * s * 0.21, s * 0.48],
      ]);
    return c.graphic('anchor badge');
  })();
  graphics['gc-code'] = (() => {
    const w = 1.3,
      h = 0.22,
      c = new k.Canvas(w, h);
    c.text(GC_RED, '11-01', { x: w * 0.42, y: h / 2, height: 0.16, align: 'right' });
    k.roundel(c, w * 0.42 + 0.17, h / 2, 0.1, k.ROUNDELS.italy);
    return c.graphic('11-01 with roundel');
  })();

  /* -------------------------------------------------------- Guardia di Finanza grey ---- */
  const GDF_GREY = '#c4c8c7',
    GDF_GREEN = '#1d6a3c',
    GDF_YELLOW = '#f0c000';
  // The fin's faces, not the stabilizer that crosses its root.
  const finOnly = [P.plane([1, 0, 0], [-0.2, 0, 0]), P.plane([-1, 0, 0], [0.2, 0, 0])];
  const gdfZones = [
    ...alongStripe(GDF_GREEN, -0.005, 0.09, ['accent']),
    ...alongStripe(GDF_YELLOW, -0.06, -0.01, ['shell']),
    // The cheatline turns up the fin's leading edge.
    // Fin leading edge (z, y): (-7.13, 1.88) to (-8.1, 3.66); bands set back from it.
    {
      color: GDF_GREEN,
      planes: [
        P.keep([-7.23, 1.88], [-8.2, 3.66], [-9, 2.7]),
        P.keep([-7.39, 1.88], [-8.36, 3.66], [-7, 2.7]),
        P.above(1.9),
        ...finOnly,
      ],
      only: ['accent'],
    },
    {
      color: GDF_YELLOW,
      planes: [
        P.keep([-7.39, 1.88], [-8.36, 3.66], [-9, 2.7]),
        P.keep([-7.53, 1.88], [-8.5, 3.66], [-7, 2.7]),
        P.above(1.9),
        ...finOnly,
      ],
      only: ['accent'],
    },
  ];
  graphics['gdf-title'] = lettering(k, 'GUARDIA DI FINANZA', 1.9, 0.26, '#1d2024', {
    capHeight: 0.15,
  });
  graphics['gdf-code'] = lettering(k, 'GF-402', 0.55, 0.2, '#1d2024', { capHeight: 0.12 });
  graphics['gdf-serial'] = lettering(k, 'M.M.81750', 0.75, 0.3, '#1d2024', { capHeight: 0.09 });

  /* ------------------------------------------------ Ontario air ambulance orange ---- */
  const ORANGE = '#ef5a24';
  graphics['on-reg'] = lettering(k, 'C-GXLB', 1.3, 0.22, WHITE, { capHeight: 0.17 });

  /* ------------------------------------------------- US state police black and gold ---- */
  const TROOPER_BLACK = '#141619',
    OLIVE_GOLD = '#5b5634',
    GOLD = '#f0b929';
  const trooperZones = [
    { color: OLIVE_GOLD, planes: [P.above(2.24), P.ahead(-3.3)], only: ['shell'] },
    ...alongStripe(GOLD, -0.005, 0.09, ['accent']),
  ];
  graphics['trooper-title'] = lettering(k, 'STATE TROOPER', 1.9, 0.26, GOLD, { capHeight: 0.17 });
  graphics['trooper-reg'] = lettering(k, 'N618TP', 1.1, 0.26, GOLD, { capHeight: 0.2 });
  graphics['flag-us'] = (() => {
    const w = 0.27,
      h = 0.15,
      c = new k.Canvas(w, h);
    for (let i = 0; i < 13; i++)
      c.rect(i % 2 ? WHITE : '#b22234', 0, h - ((i + 1) * h) / 13, w, h / 13);
    c.rect('#3c3b6e', 0, h - (7 * h) / 13, w * 0.4, (7 * h) / 13);
    return c.graphic('US flag');
  })();
  // The Maryland state flag (Calvert and Crossland quarters), drawn as a leaning banner.
  graphics['flag-md'] = (() => {
    const W = 1.0,
      H = 0.85,
      c = new k.Canvas(W, H);
    const fw = 0.62,
      fh = 0.62,
      x0 = 0.06,
      y0 = 0.11,
      skew = 0.45;
    const map = ([x, y]) => [x0 + x + y * skew, y0 + y];
    const poly = (color, pts) => c.add(color, pts.map(map));
    const box = (color, x, y, w, h) =>
      poly(color, [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
      ]);
    const qw = fw / 2,
      qh = fh / 2,
      gold = '#eaaa00',
      black = '#111111',
      red = '#c8102e';
    const calvert = (qx, qy) => {
      const pale = qw / 6,
        t = qh * 0.22;
      const bend = (x) => qy + qh - (x - qx) * (qh / qw);
      for (let i = 0; i < 6; i++) {
        const a = qx + i * pale,
          b = a + pale;
        box(i % 2 ? black : gold, a, qy, pale, qh);
        poly(i % 2 ? gold : black, [
          [a, Math.max(qy, bend(a) - t / 2)],
          [b, Math.max(qy, bend(b) - t / 2)],
          [b, Math.min(qy + qh, bend(b) + t / 2)],
          [a, Math.min(qy + qh, bend(a) + t / 2)],
        ]);
      }
    };
    const crossland = (qx, qy) => {
      const hw = qw / 2,
        hh = qh / 2,
        arm = qw * 0.09;
      box(WHITE, qx, qy + hh, hw, hh);
      box(red, qx + hw, qy + hh, hw, hh);
      box(red, qx, qy, hw, hh);
      box(WHITE, qx + hw, qy, hw, hh);
      const cx = qx + hw,
        cy = qy + hh,
        L = qw * 0.36;
      // Counterchanged cross: each half-arm takes the opposite of the quarter it lies in.
      box(red, cx - arm, cy, arm, L);
      box(WHITE, cx, cy, arm, L);
      box(WHITE, cx - arm, cy - L, arm, L);
      box(red, cx, cy - L, arm, L);
      box(red, cx - L, cy, L, arm);
      box(WHITE, cx - L, cy - arm, L, arm);
      box(WHITE, cx, cy, L, arm);
      box(red, cx, cy - arm, L, arm);
    };
    calvert(0, qh);
    crossland(qw, qh);
    crossland(0, 0);
    calvert(qw, 0);
    return c.graphic('Maryland flag');
  })();

  const references = {
    mh139: {
      title: 'MH-139 at Eglin Air Force Base, 2019 (US Air Force, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:MH-139,_Eglin_Air_Force_Base,_Florida,_2019_(cropped).jpg',
    },
    mh139b: {
      title: 'MH-139A Grey Wolf (US Air Force, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:MH-139A_Grey_Wolf.jpg',
    },
    gc: {
      title: 'Guardia Costiera AW139 (CC BY 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Guardia_Costiera_AW139.jpg',
    },
    gdf: {
      title: 'AW139 GF-402 of the Guardia di Finanza, 2017 (Andre Gerwing, CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:AgustaWestland_AW139_(c-n_31301,_s-n_MM81750,_GF-402)_2017-09-23_Andre_Gerwing_Collection_ID_000349.jpg',
    },
    ornge: {
      title: 'Ornge C-GYNP — The Cosmonaut (CC BY-SA 2.5 ca)',
      url: 'https://commons.wikimedia.org/wiki/File:Ornge_C-GYNP.jpg',
    },
    msp: {
      title: 'MSP Trooper 1 AW139 N384MD MD1.jpg — Acroterion (CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:MSP_Trooper_1_AW139_N384MD_MD1.jpg',
    },
  };

  return {
    selected: 'usaf-mh-139a',
    anchors,
    graphics,
    variants: [
      {
        id: 'usaf-mh-139a',
        label: 'USAF MH-139A Grey Wolf',
        provenance: {
          kind: 'inspired',
          note: 'US Air Force MH-139A Grey Wolf (the military AW139) from the referenced photographs: dark gunship grey overall in a matt finish with the low-visibility national insignia outlined in black on the rear fuselage and the serial and U.S. AIR FORCE in dark grey on the fin. The serial shown (AF 21-001) is illustrative; the MH-139A mission fit (sensor turret, hoist) is not modelled. Colors are approximate.',
          references: [references.mh139, references.mh139b],
        },
        paints: {
          ...scheme(space, exterior, GUNSHIP, [], { roughness: 0.65 }),
          hub: { color: GUNSHIP, roughness: 0.65 },
          'tail-bands': { color: '#1b1d1f' },
          'blade-tips': { color: '#d9d9d2' },
        },
        markings: [...both('rear-cabin', 'usaf-insignia'), ...both('fin', 'usaf-serial')],
      },
      {
        id: 'guardia-costiera',
        label: 'Italian Coast Guard',
        provenance: {
          kind: 'photo',
          note: 'Italian Coast Guard (Guardia Costiera) AW139 11-01 from the referenced photograph: white overall with a red belly and sponsons, a broad red band round the rear cabin and over the cowling, red upper fin, black anti-glare panel on the nose, GUARDIA COSTIERA in red under the cabin windows, the anchor badge on the red band (an original simplified drawing) and the code 11-01 with the Italian roundel on the boom. The Navy coat of arms on the cowling is omitted. Colors are approximate.',
          references: [references.gc],
        },
        paints: {
          ...scheme(space, exterior, WHITE, coastZones, { roughness: 0.3 }),
          'tail-bands': { color: GC_RED },
          'blade-tips': { color: '#d9d9d2' },
        },
        markings: [
          ...both('cabin-title', 'gc-title'),
          ...both('rear-emblem', 'gc-anchor'),
          ...both('boom-aft', 'gc-code'),
        ],
      },
      {
        id: 'guardia-di-finanza',
        label: 'Guardia di Finanza GF-402',
        provenance: {
          kind: 'photo',
          note: "Italian Guardia di Finanza AW139 GF-402 (MM81750) from the referenced photograph: light grey overall with a green and yellow double cheatline running from the nose under the doors, up the boom and the fin's leading edge, GUARDIA DI FINANZA in black on the boom, the code on the forward door and the serial on the fin. The corps' coat of arms on the fin is omitted. Colors are approximate.",
          references: [references.gdf],
        },
        paints: {
          ...scheme(space, exterior, GDF_GREY, gdfZones, { roughness: 0.35 }),
          'tail-bands': { color: '#c8202b' },
          'blade-tips': { color: '#d9d9d2' },
        },
        markings: [
          ...both('boom-title', 'gdf-title'),
          ...both('door-code', 'gdf-code'),
          ...both('fin', 'gdf-serial'),
        ],
      },
      {
        id: 'ontario-air-ambulance',
        label: 'Ontario air ambulance orange',
        provenance: {
          kind: 'inspired',
          note: "Ontario air ambulance AW139 from the referenced photograph of C-GYNP: bright orange overall with a white cheatline sweeping from the nose under the doors and up the tail boom, and the registration in white on the boom. The registration is fictional (C-GXLB); the operator's name, wings logo and base titles are omitted. Colors are approximate.",
          references: [references.ornge],
        },
        paints: {
          ...scheme(space, exterior, ORANGE, alongStripe(WHITE, -0.005, 0.09, ['accent']), {
            roughness: 0.3,
          }),
          hub: { color: ORANGE },
          'tail-bands': { color: '#c8202b' },
          'blade-tips': { color: '#d9d9d2' },
        },
        markings: [...both('boom-aft', 'on-reg')],
      },
      {
        id: 'state-police-black-gold',
        label: 'US state police black and gold',
        provenance: {
          kind: 'inspired',
          note: 'US state police AW139 from the referenced photograph of a Maryland State Police aircraft: gloss black with an olive-gold roof and cowling, a gold cheatline along the lower fuselage, STATE TROOPER in gold on the boom, the Maryland state flag as a leaning banner on the rear fuselage (an original drawing of the flag), the US flag on the cowling and the registration in gold on the cowling. The registration is fictional (N618TP; the photographed aircraft is N384MD); the agency name, badge and seal are omitted. Colors are approximate.',
          references: [references.msp],
        },
        paints: {
          ...scheme(space, exterior, TROOPER_BLACK, trooperZones, { roughness: 0.25 }),
          hub: { color: TROOPER_BLACK },
          'tail-bands': { color: '#c8202b' },
          'blade-tips': { color: '#d9d9d2' },
        },
        markings: [
          ...both('boom-title', 'trooper-title'),
          ...both('cowl', 'trooper-reg'),
          ...both('cowl-flag', 'flag-us', true),
          ...both('rear-cabin', 'flag-md'),
        ],
      },
    ],
  };
}
