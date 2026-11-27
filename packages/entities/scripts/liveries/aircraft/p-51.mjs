/**
 * P-51D Mustang liveries: USAAF fighter groups of 1944-45 (332nd, 357th, 4th), the RAF, the RAAF
 * in Korea and the Swedish Air Force, with national markings, codes and serials redrawn as
 * original vector art. Nose art is limited to plain painted names.
 *
 * The model stands in its three-point attitude, pitched 13 degrees nose-up about X and lifted
 * onto the ground (generate.mjs POSE). Anchors and zones are authored in the flight datum (z
 * stations along the thrust line) and posed here, so lettering and stripes follow the fuselage.
 */
import * as art from '../art-twins.mjs';

const G = (13 * Math.PI) / 180,
  cG = Math.cos(G),
  sG = Math.sin(G),
  GROUND = 0.10316660743580061;
/** Flight-datum point to the posed model frame. */
const pose = ([x, y, z]) => [x, y * cG + z * sG + GROUND, -y * sG + z * cG];
const UP = [0, cG, -sG],
  FWD = [0, sG, cG];

export function slots(existing) {
  return {
    ...existing,
    antiglare: { materials: ['olive-drab'], node: 'anti-glare-panel' },
    // Marking-only regions spanning several meshes: fin + rudder, wing + aileron + flap.
    'tail-skin': { materials: ['signal-red-paint'] },
    'wing-skin': { materials: ['aluminium-lacquer', 'natural-metal-panel'] },
  };
}

export default function design({ kit: k, space, bounds }) {
  const sides = ['1', '-1'];
  const anchors = {};
  const at = (name, slot, o) => (anchors[name] = space.anchor(slot, o));
  const FUS = 'body-fuselage';
  for (const side of sides) {
    const x = Number(side);
    // Fuselage star-and-bar or roundel, centred on the 1943 insignia station (datum z -2.3).
    at(`fus-insignia-${side}`, FUS, {
      center: [x * 0.34, 1.145, -2.6],
      facing: [x, 0, 0],
      up: UP,
      width: 1.3,
      height: 0.66,
      depth: 0.5,
    });
    // Code letters ahead of and behind the insignia (the order swaps on the right side).
    at(`fus-fwd-${side}`, FUS, {
      center: [x * 0.41, 1.3, -1.5],
      facing: [x, 0, 0],
      up: UP,
      width: 0.8,
      height: 0.52,
      depth: 0.5,
    });
    at(`fus-aft-${side}`, FUS, {
      center: [x * 0.27, 0.96, -3.42],
      facing: [x, 0, 0],
      up: UP,
      width: 0.8,
      height: 0.52,
      depth: 0.5,
    });
    // Serial across fin and rudder above the tailplane.
    at(`fin-serial-${side}`, 'tail-skin', {
      center: [x * 0.06, 1.5, -5.4],
      facing: [x, 0, 0],
      up: UP,
      width: 1.0,
      height: 0.26,
      depth: 0.3,
    });
    at(`fin-mid-${side}`, 'tail-skin', {
      center: [x * 0.07, 1.3, -5.2],
      facing: [x, 0, 0],
      up: UP,
      width: 1.2,
      height: 0.7,
      depth: 0.3,
    });
    // Cowling side: plain names, nose arrowheads.
    at(`nose-name-${side}`, FUS, {
      center: [x * 0.43, 1.78, 1.25],
      facing: [x, 0, 0],
      up: UP,
      width: 1.1,
      height: 0.22,
      depth: 0.5,
    });
    at(`nose-flash-${side}`, FUS, {
      center: [x * 0.44, 2.13, 1.95],
      facing: [x, -0.1, 0],
      up: UP,
      width: 1.1,
      height: 0.5,
      depth: 0.5,
    });
  }
  // Nose band checks: four projectors round the cowling ring (left, right, top, bottom).
  const COWL = 'accent-red-engine-cowl';
  const noseC = pose([0, 1.58, 3.13]);
  const quarter = (name, dir, up) =>
    at(name, COWL, {
      center: noseC.map((v, i) => v + dir[i] * 0.42),
      facing: dir,
      up,
      width: 0.62,
      height: 0.6,
      depth: 0.5,
    });
  quarter('cowl-left', [1, 0, 0], UP);
  quarter('cowl-right', [-1, 0, 0], UP);
  quarter('cowl-top', UP, FWD);
  quarter(
    'cowl-bottom',
    UP.map((v) => -v),
    FWD,
  );
  // Wing insignia, star point forward: upper left and lower right (USAAF); roundels on all four.
  const wingAt = (x, top) =>
    space.anchor('wing-skin', {
      center: [x, top ? 1.56 : 1.45, -0.55],
      facing: top ? UP : UP.map((v) => -v),
      up: FWD,
      width: 1.8,
      height: 1.0,
      depth: 0.45,
    });
  anchors['wing-upper-left'] = wingAt(4.3, true);
  anchors['wing-lower-right'] = wingAt(-4.3, false);
  anchors['wing-upper-right'] = wingAt(-4.3, true);
  anchors['wing-lower-left'] = wingAt(4.3, false);

  // ---------------------------------------------------------------- paint helpers ----
  const NMF = { color: '#c4cacf', metalness: 0.72, roughness: 0.3 },
    LACQUER = { color: '#c2c7cb', metalness: 0.5, roughness: 0.42 },
    PANEL = { color: '#a9b0b6', metalness: 0.66, roughness: 0.4 };
  const paint = (color, extra = {}) => ({ color, metalness: 0.06, roughness: 0.6, ...extra });
  const RED = '#b81d18',
    YELLOW = '#e7b52a',
    BLACK = '#17191b',
    WHITE = '#ecebe3',
    OD = '#535236';
  const fuselageSlots = [
    FUS,
    'body-fuselage_1',
    'body-carburettor-intake',
    'body-ventral-radiator',
  ];
  const wingSlots = ['body-wing-1', 'body-wing--1'];
  const panelSlots = [
    'body-flap-surface',
    'body-flap-surface_1',
    'body-aileron-surface',
    'body-aileron-surface_1',
  ];
  const bandSlots = [
    'wing-finish-wing-1-band',
    'wing-finish-wing--1-band',
    'wing-finish-flap-band',
    'wing-finish-flap-band_1',
  ];
  const tailSlots = [
    'accent-vertical-fin',
    'accent-rudder-surface',
    'accent-tailplane-1',
    'accent-tailplane--1',
    'accent-elevator-surface',
    'accent-elevator-surface_1',
  ];
  const all = (names, p) => art.paintAll(names, p);
  // Plain natural metal airframe, lacquered wings; tail, nose and bands passed in.
  const metal = ({
    tail = NMF,
    cowl = NMF,
    spinner = paint(RED),
    bands = LACQUER,
    glare = OD,
  } = {}) => ({
    ...all(fuselageSlots, NMF),
    ...all(wingSlots, LACQUER),
    ...all(panelSlots, PANEL),
    ...all(bandSlots, bands),
    ...all(tailSlots, tail),
    [COWL]: cowl,
    'accent-spinner': spinner,
    antiglare: paint(glare, { roughness: 0.8 }),
  });
  // Datum stations as posed planes: everything ahead of (or behind) datum z.
  const station = (slot, z, ahead) =>
    space.plane(slot, ahead ? FWD : FWD.map((v) => -v), pose([0, 1.58, z]));
  // Invasion stripes: five 18-inch bands, white-black-white-black-white.
  const STRIPE = 0.457;
  const stripeColors = [WHITE, BLACK, WHITE, BLACK, WHITE];
  const fuselageStripes = (slot, from, extra = []) =>
    stripeColors.map((color, i) => ({
      color,
      roughness: 0.7,
      metalness: 0.02,
      planes: [
        station(slot, from - i * STRIPE, false),
        station(slot, from - (i + 1) * STRIPE, true),
        ...extra,
      ],
    }));
  const wingStripes = (slot, inner, extra = []) => {
    const b = bounds[slot],
      x0 = b.min[0] + b.max[0] > 0 ? 1 : -1;
    return stripeColors.map((color, i) => ({
      color,
      roughness: 0.7,
      metalness: 0.02,
      planes: [
        space.plane(slot, [x0, 0, 0], [x0 * (inner + i * STRIPE), 0, 0]),
        space.plane(slot, [-x0, 0, 0], [x0 * (inner + (i + 1) * STRIPE), 0, 0]),
        ...extra,
      ],
    }));
  };
  // The lower half of the fuselage: below the datum line through the thrust axis.
  const lowerHalf = (slot) =>
    space.plane(
      slot,
      UP.map((v) => -v),
      pose([0, 1.5, -2.3]),
    );
  // The wing's mid-thickness plane (5 degree dihedral, fitted to the posed skin): below it.
  const belowWing = (slot) => {
    const b = bounds[slot],
      x0 = b.min[0] + b.max[0] > 0 ? 1 : -1;
    return space.plane(slot, [x0 * 0.0882, -1, 0.212], [0, 1.257, 0]);
  };

  // ------------------------------------------------------------------ graphics ----
  const g = {};
  const starBar = (w, h, r) => {
    const c = new k.Canvas(w, h);
    art.starAndBar(c, w / 2, h / 2, r);
    return c.graphic('US star-and-bar (1943)');
  };
  g['us-fuselage'] = starBar(1.3, 0.66, 0.28);
  g['us-wing'] = starBar(1.8, 1.0, 0.4);
  const code = (label, color, h = 0.46) => art.lettering(k, label, 0.8, 0.52, color, { height: h });
  const serial = (label, color) => art.lettering(k, label, 1.0, 0.26, color, { height: 0.17 });

  const ref = {
    qpf: {
      title: "P-51D 'QP-F - 422051' Sweet Revenge in 334th FS markings (CC BY 2.0)",
      url: 'https://commons.wikimedia.org/wiki/File:North_American_P-51D-20-NA_Mustang_%E2%80%98QP-F_-_422051%E2%80%99_%E2%80%9CSweet_Revenge%E2%80%9D_(NL68JR)_(31947465468).jpg',
    },
    raaf: {
      title: 'No. 77 Squadron RAAF Mustang A68-809 (AWM, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:No._77_Squadron_Mustang_A68-809.jpg',
    },
    j26: {
      title: 'J 26 26020 16-A at the Swedish Air Force Museum, 2013 (CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:North_American_Aviation_J_26_(c-n_122-31718,_s-n_26020,_16-A)_2013-08-31_Andre_Gerwing_Collection_ID_012811.jpg',
    },
    tuskegee: {
      title: 'P-51D of the 332nd Fighter Group, 1945 (USAF, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:Tuskegee_P-51.jpg',
    },
    bunnie: {
      title: "Full-size P-51D replica '7 - 569' Bunnie, 332nd FG markings (CC BY-SA 2.0)",
      url: 'https://commons.wikimedia.org/wiki/File:Full-size_Mock-up_P-51D_Mustang_%E2%80%987_-_569%E2%80%99%E2%80%9CBunnie%E2%80%9D_(50901572238).jpg',
    },
    hhh: {
      title: "P-51D 44-14868 'Hurry Home Honey' C5-T, 357th Fighter Group (USAF, public domain)",
      url: 'https://commons.wikimedia.org/wiki/File:Hurry_Home_Honey_P-51_inflight.jpg',
    },
    two357: {
      title: 'Two P-51Ds of the 357th Fighter Group, 1944 (USAF, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:Two_P-51_Mustangs_of_the_357th_Fighter_Group.jpg',
    },
  };

  // ------------------------------------------------ 332nd FG, 100th FS: Bunnie -----
  g['332-7'] = code('7', BLACK);
  g['332-569'] = art.lettering(k, '569', 0.8, 0.52, BLACK, { height: 0.12 });
  g['332-name'] = art.lettering(k, 'BUNNIE', 1.1, 0.22, RED, { height: 0.15 });
  // The red nose ring runs back along the cowling to a point under the exhaust stacks.
  g['332-arrow'] = new k.Canvas(1.1, 0.5)
    .add(RED, [
      [1.1, 0.04],
      [1.1, 0.46],
      [0.62, 0.38],
      [0.08, 0.25],
      [0.62, 0.12],
    ])
    .graphic('Nose arrowhead');

  // --------------------------------------------- 357th FG, 362nd FS: C5-T --------
  g['357-c5'] = code('C5', BLACK);
  g['357-t'] = code('T', BLACK);
  g['357-serial'] = serial('414868', BLACK);
  g['357-name'] = art.lettering(k, 'HURRY HOME HONEY', 1.1, 0.22, '#b31b22', {
    height: 0.1,
    face: 'regular',
  });
  g['357-checks'] = k
    .checks(new k.Canvas(0.62, 0.6), 0, 0, 0.62, 0.6, [RED, YELLOW], 5, 5)
    .graphic('Red and yellow nose checks');

  // ---------------------------------------------- 4th FG, 334th FS: QP-F --------
  const outlined = (label, w, h, cap) => {
    const c = new k.Canvas(w, h);
    for (const [dx, dy] of [
      [-0.012, 0],
      [0.012, 0],
      [0, -0.012],
      [0, 0.012],
    ])
      art.text(c, RED, label, { x: w / 2 + dx, y: h / 2 + dy, height: cap, maxWidth: w * 0.96 });
    art.text(c, BLACK, label, { x: w / 2, y: h / 2, height: cap, maxWidth: w * 0.96 });
    return c.graphic(label);
  };
  g['4fg-qp'] = outlined('QP', 0.8, 0.52, 0.44);
  g['4fg-f'] = outlined('F', 0.8, 0.52, 0.44);
  g['4fg-serial'] = serial('422051', BLACK);
  g['4fg-name'] = art.lettering(k, 'SWEET REVENGE', 1.1, 0.22, RED, {
    height: 0.1,
    face: 'regular',
  });
  g['4fg-checks'] = k
    .checks(new k.Canvas(0.62, 0.6), 0, 0, 0.62, 0.6, [RED, '#f1f0ea'], 5, 5)
    .graphic('Red and white nose checks');

  // ------------------------------------------------ RAAF 77 Squadron ------------
  const typeD = ['#1f3f8a', '#f1f0ea', '#c8102e'];
  g['raaf-roundel'] = k
    .roundel(new k.Canvas(1.3, 0.66), 0.65, 0.33, 0.3, typeD)
    .graphic('RAAF roundel');
  g['raaf-roundel-wing'] = k
    .roundel(new k.Canvas(1.8, 1.0), 0.9, 0.5, 0.42, typeD)
    .graphic('RAAF roundel');
  g['raaf-serial'] = art.lettering(k, 'A68-809', 0.8, 0.52, BLACK, { height: 0.15 });
  g['raaf-flash'] = (() => {
    const c = new k.Canvas(1.2, 0.7);
    art.finFlash(c, 0.25, 0.22, 0.42, 0.42, ['#c8102e', '#f1f0ea', '#1f3f8a']);
    return c.graphic('Fin flash');
  })();

  // -------------------------------------------------- Swedish J 26 ---------------
  g['se-roundel'] = k
    .swedenRoundel(new k.Canvas(1.3, 0.66), 0.65, 0.33, 0.3)
    .graphic('Swedish roundel');
  g['se-roundel-wing'] = k
    .swedenRoundel(new k.Canvas(1.8, 1.0), 0.9, 0.5, 0.45)
    .graphic('Swedish roundel');
  g['se-16'] = art.lettering(k, '16', 0.8, 0.52, '#e9b92a', { height: 0.3 });
  g['se-a'] = art.lettering(k, 'A', 1.2, 0.7, '#1f3f8a', { height: 0.62 });

  return {
    selected: '332nd-fg-bunnie',
    anchors,
    graphics: g,
    variants: [
      {
        id: '332nd-fg-bunnie',
        label: '332nd FG Red Tails, 100th FS 7 Bunnie, 1945',
        provenance: {
          kind: 'inspired',
          note: "P-51D 44-15569 of the 100th Fighter Squadron, 332nd Fighter Group (Tuskegee Airmen), Italy 1945: natural metal with the group's red tail surfaces and spinner, the red nose ring drawn back to a point along the cowling, yellow wing bands, black 7 and 569, the plain name BUNNIE, 1943 star-and-bar insignia on the fuselage, upper left and lower right wing. Colors and the arrowhead outline are approximations.",
          references: [ref.tuskegee, ref.bunnie],
        },
        paints: metal({
          tail: paint(RED, { roughness: 0.38, metalness: 0.12 }),
          cowl: paint(RED, { roughness: 0.38, metalness: 0.12 }),
          bands: paint(YELLOW, { roughness: 0.42 }),
        }),
        markings: [
          { anchor: 'fus-insignia-1', graphic: 'us-fuselage' },
          { anchor: 'fus-insignia--1', graphic: 'us-fuselage' },
          { anchor: 'fus-fwd-1', graphic: '332-7' },
          { anchor: 'fus-aft--1', graphic: '332-7' },
          { anchor: 'fus-aft-1', graphic: '332-569' },
          { anchor: 'fus-fwd--1', graphic: '332-569' },
          { anchor: 'nose-name-1', graphic: '332-name' },
          { anchor: 'nose-name--1', graphic: '332-name' },
          { anchor: 'nose-flash-1', graphic: '332-arrow', flip: true },
          { anchor: 'nose-flash--1', graphic: '332-arrow' },
          { anchor: 'wing-upper-left', graphic: 'us-wing' },
          { anchor: 'wing-lower-right', graphic: 'us-wing' },
        ],
      },
      {
        id: '357th-fg-hurry-home-honey',
        label: '357th FG C5-T Hurry Home Honey, 1944',
        provenance: {
          kind: 'inspired',
          note: "P-51D 44-14868 'Hurry Home Honey', C5-T of the 362nd Fighter Squadron, 357th Fighter Group, late 1944: natural metal, the group's red and yellow nose checks and spinner, invasion stripes kept on the lower fuselage and under the wings, C5 and T codes, 414868 on the fin, the plain name on the cowling and 1943 insignia. Check rows and stripe stations follow the group's standard; colors approximate.",
          references: [ref.hhh, ref.two357],
        },
        paints: (() => {
          const p = metal({
            cowl: paint(YELLOW),
            spinner: paint(RED, { roughness: 0.38 }),
          });
          for (const s of fuselageSlots)
            p[s] = { ...NMF, zones: fuselageStripes(s, -1.156, [lowerHalf(s)]) };
          for (const s of [...wingSlots, ...panelSlots, ...bandSlots])
            p[s] = { ...p[s], zones: wingStripes(s, 1.05, [belowWing(s)]) };
          return p;
        })(),
        markings: [
          { anchor: 'fus-insignia-1', graphic: 'us-fuselage' },
          { anchor: 'fus-insignia--1', graphic: 'us-fuselage' },
          { anchor: 'fus-fwd-1', graphic: '357-c5' },
          { anchor: 'fus-aft-1', graphic: '357-t' },
          { anchor: 'fus-fwd--1', graphic: '357-t' },
          { anchor: 'fus-aft--1', graphic: '357-c5' },
          { anchor: 'fin-serial-1', graphic: '357-serial' },
          { anchor: 'fin-serial--1', graphic: '357-serial' },
          { anchor: 'nose-name-1', graphic: '357-name' },
          { anchor: 'cowl-left', graphic: '357-checks' },
          { anchor: 'cowl-right', graphic: '357-checks' },
          { anchor: 'cowl-top', graphic: '357-checks' },
          { anchor: 'cowl-bottom', graphic: '357-checks' },
          { anchor: 'wing-upper-left', graphic: 'us-wing' },
          { anchor: 'wing-lower-right', graphic: 'us-wing' },
        ],
      },
      {
        id: '4th-fg-334th-fs-qp-f',
        label: '4th FG 334th FS QP-F Sweet Revenge',
        provenance: {
          kind: 'inspired',
          note: "P-51D 44-22051 'Sweet Revenge', QP-F of the 334th Fighter Squadron, 4th Fighter Group, as restored: polished natural metal, red spinner and red and white nose checks, the 334th's red rudder, QP and F codes in black outlined red, 422051 on the fin, invasion stripes kept under the fuselage and wings, the plain name on the cowling and 1943 insignia. Kill marks and the pin-up figure are omitted; colors approximate.",
          references: [ref.qpf],
        },
        paints: (() => {
          const p = metal({
            cowl: paint(RED, { roughness: 0.38 }),
            spinner: paint(RED, { roughness: 0.38 }),
          });
          p['accent-rudder-surface'] = paint(RED, { roughness: 0.38 });
          for (const s of fuselageSlots)
            p[s] = { ...NMF, zones: fuselageStripes(s, -1.156, [lowerHalf(s)]) };
          for (const s of [...wingSlots, ...panelSlots, ...bandSlots])
            p[s] = { ...p[s], zones: wingStripes(s, 1.05, [belowWing(s)]) };
          return p;
        })(),
        markings: [
          { anchor: 'fus-insignia-1', graphic: 'us-fuselage' },
          { anchor: 'fus-insignia--1', graphic: 'us-fuselage' },
          { anchor: 'fus-fwd-1', graphic: '4fg-qp' },
          { anchor: 'fus-aft-1', graphic: '4fg-f' },
          { anchor: 'fus-fwd--1', graphic: '4fg-f' },
          { anchor: 'fus-aft--1', graphic: '4fg-qp' },
          { anchor: 'fin-serial-1', graphic: '4fg-serial' },
          { anchor: 'fin-serial--1', graphic: '4fg-serial' },
          { anchor: 'nose-name-1', graphic: '4fg-name' },
          { anchor: 'cowl-left', graphic: '4fg-checks' },
          { anchor: 'cowl-right', graphic: '4fg-checks' },
          { anchor: 'cowl-top', graphic: '4fg-checks' },
          { anchor: 'cowl-bottom', graphic: '4fg-checks' },
          { anchor: 'wing-upper-left', graphic: 'us-wing' },
          { anchor: 'wing-lower-right', graphic: 'us-wing' },
        ],
      },
      {
        id: 'raaf-77-squadron-a68-809',
        label: 'RAAF 77 Squadron A68-809, 1950',
        provenance: {
          kind: 'inspired',
          note: 'P-51D A68-809 of No. 77 Squadron RAAF, Japan 1950: natural metal with the red, white and blue roundel on the fuselage and wings, the fin flash and the serial A68-809 on the rear fuselage, olive anti-glare panel and dark spinner. Colors approximate.',
          references: [ref.raaf],
        },
        paints: metal({ spinner: paint('#2a2c2e', { roughness: 0.5 }) }),
        markings: [
          { anchor: 'fus-insignia-1', graphic: 'raaf-roundel' },
          { anchor: 'fus-insignia--1', graphic: 'raaf-roundel' },
          { anchor: 'fus-aft-1', graphic: 'raaf-serial' },
          { anchor: 'fus-aft--1', graphic: 'raaf-serial' },
          { anchor: 'fin-mid-1', graphic: 'raaf-flash' },
          { anchor: 'fin-mid--1', graphic: 'raaf-flash', flip: true },
          ...['wing-upper-left', 'wing-upper-right', 'wing-lower-left', 'wing-lower-right'].map(
            (a) => ({ anchor: a, graphic: 'raaf-roundel-wing' }),
          ),
        ],
      },
      {
        id: 'swedish-air-force-j26',
        label: 'Swedish Air Force J 26, F 16 A',
        provenance: {
          kind: 'inspired',
          note: 'J 26 (P-51D) 26020 of Upplands flygflottilj F 16 as preserved at the Swedish Air Force Museum: natural metal with the three-crown roundels on the fuselage and wings, the yellow wing number 16 on the fuselage and the large blue individual letter A on the fin, yellow spinner. Colors approximate.',
          references: [ref.j26],
        },
        paints: metal({ spinner: paint('#e9b92a', { roughness: 0.4 }) }),
        markings: [
          { anchor: 'fus-insignia-1', graphic: 'se-roundel' },
          { anchor: 'fus-insignia--1', graphic: 'se-roundel' },
          { anchor: 'fus-aft-1', graphic: 'se-16' },
          { anchor: 'fus-aft--1', graphic: 'se-16' },
          { anchor: 'fin-mid-1', graphic: 'se-a' },
          { anchor: 'fin-mid--1', graphic: 'se-a' },
          ...['wing-upper-left', 'wing-upper-right', 'wing-lower-left', 'wing-lower-right'].map(
            (a) => ({ anchor: a, graphic: 'se-roundel-wing' }),
          ),
        ],
      },
    ],
  };
}
