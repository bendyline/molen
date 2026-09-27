/** Original 1966 Severn suspension bridge. Dimensions and estimates are kept separate. */
import { beam, chamferedRectangle, loft } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

export const severnStudy = {
  id: 'N0005',
  key: 'severn_bridge',
  size: [1637.5, 136, 40],
  brief:
    'The original M48 Severn suspension bridge: two white steel portal towers, paired inclined hangers, continuous main cables, shallow aerofoil box deck, cantilever footways, cutwater piers and concrete cable anchorages. Includes close-view cable sockets, parapets, tower saddles, access doors and four traffic lanes.',
  refs: [
    'https://historicengland.org.uk/listing/the-list/list-entry/1119760',
    'https://severnbridges.org/2012/05/17/design-of-the-severn-bridge/',
    'https://severnbridges.org/2012/05/17/building-the-severn-bridge/',
    'https://severnbridges.org/2016/02/29/more-design-issues/',
    'https://severnbridges.org/2016/02/23/more-severn-bridge-towers/',
    'https://severnbridges.org/2016/02/23/more-suspending-the-severn-bridge-deck/',
    'https://severnbridges.org/2016/02/23/more-severn-bridge-foundations-and-anchorages/',
    'https://www.stannahlifts.co.uk/news/severn-bridge-project-stannah-150-story',
    'https://www.stannahlifts.co.uk/case-studies/renovating-136m-high-severn-bridge-maintenance-lift',
    'https://nationalhighways.co.uk/roads-and-travel/live-travel-updates/the-severn-bridges/',
  ],
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X toward Aust (east/southeast), -X toward Beachley',
    transverse: '+Z',
    origin:
      'Main-span midpoint horizontally; Y=0 is an unresolved local water reference, not a surveyed terrain or sea-level datum',
  },
  sourceFacts: {
    identity:
      'Original 1966 M48 suspension crossing, Wikidata Q1850537; not the 1996 second crossing',
    mainSpanMeters: 987.5,
    sideSpanMeters: 305,
    suspendedDeckLengthMeters: 1597.5,
    towerLegCenterSpacingMeters: 23.5,
    towerPortalLevels: 3,
    pierPlanMeters: [11.5, 40],
    deckBoxDepthMeters: 3.048,
    deckBoxCornerWidthMeters: 22.86,
    mainCableNominalDiameterMeters: 0.5,
    hangerOriginalNominalDiameterMeters: 0.05,
    hangerClampHorizontalPitchMeters: 18.288,
    standardHangerLongitudinalOffsetMeters: 9.144,
    hangerCountDetailedTrustAccount: 344,
    hangerCountGeneralTrustAccount: 340,
    towerTopStannahMetersAboveMeanHighWater: 136,
    deckCenterTrustMetersAboveMeanSeaLevel: 37,
    towerAccessDoorMeters: [0.6, 1.8],
  },
  reconstruction: {
    towerTopLocalY: 136,
    steelTowerBaseLocalY: 12,
    deckCenterLocalY: 37,
    deckTowerLocalY: 35.0894,
    deckEndLocalY: 32,
    roadwayWidthMeters: 19.4,
    overallDeckWidthMeters: 32,
    towerBoxBaseMeters: [4.7, 3.8],
    towerBoxTopMeters: [3.25, 2.9],
    cableMidpointLocalY: 43.5,
    modeledHangers: 344,
    shortHangerHalfAngleDegrees: 35,
    note: 'These are reconstruction choices, not surveyed values. The Trust gives 105 ft as approximately 35 m for deck width; 105 ft converts to 32.004 m. Short hanger angle is not published: 35 degrees is a visual reconstruction, not the explanatory 60-degree example in the source.',
  },
  limitations: [
    'This asset covers the suspension bridge and simplified anchorage exteriors. Aust Viaduct, Beachley Viaduct and Wye Bridge are separate structures and are not included.',
    'Primary accounts use incompatible or incompletely specified vertical datums: 136 m above mean high water for the tower, 37 m above mean sea level for the road, and a rounded 125 m steel tower height. These numbers are not a verified common vertical frame. Local elevations require engineering drawing/site survey reconciliation before geographic activation.',
    'The detailed Trust account describes 172 hangers per cable (344 total); its general account says 340. This reconstruction uses 344 at the documented nominal pitch, with reconstructed end offsets, short-hanger transition and socket clearance at tower legs. It does not claim an as-built hanger schedule.',
    'Tower section sizes/taper, portal depths, cable sag, pier elevations, vertical road curve, anchorage extents, footway brackets and roadside fittings are reconstructed. Source photos inform visual forms, not photogrammetry or exact material colors.',
    'Current white steel paint is represented with original vertex-color PBR materials. Weathering textures, maintenance interiors, submerged foundations, traffic, animated cables and collision refinement are not included. Near/far visual acceptance and geographic fit remain separate gates.',
  ],
};

const halfSpan = 493.75,
  deckEnd = halfSpan + 305,
  legZ = 11.75;
const white = [0.8, 0.82, 0.79],
  edgeWhite = [0.7, 0.74, 0.73],
  cableColor = [0.58, 0.63, 0.64],
  steel = [0.41, 0.48, 0.5],
  concrete = [0.53, 0.54, 0.5],
  darkConcrete = [0.4, 0.44, 0.4],
  asphalt = [0.16, 0.175, 0.18],
  path = [0.39, 0.41, 0.4],
  marking = [0.82, 0.83, 0.76];

// The vertical profile is explicitly a reconstruction; geographic placement must not assume MSL.
const deckY = (x) => 37 - 5 * (Math.abs(x) / deckEnd) ** 2;
const cableY = (x) => {
  const a = Math.abs(x);
  if (a <= halfSpan) return 43.5 + (135.15 - 43.5) * (a / halfSpan) ** 2;
  const t = (a - halfSpan) / 305;
  return 135.15 + (34 - 135.15) * t - 14 * 4 * t * (1 - t);
};

function strip(out, a, b, z0, z1, offset, color, slot = 'road') {
  // Counter-clockwise when seen from above, including the slight longitudinal road slope.
  quad(
    out,
    slot,
    [
      [a, deckY(a) + offset, z1],
      [b, deckY(b) + offset, z1],
      [b, deckY(b) + offset, z0],
      [a, deckY(a) + offset, z0],
    ],
    [0, 1, 0],
    color,
  );
}

function deckRing(x) {
  const y = deckY(x);
  return [
    [x, y, -9.7],
    [x, y, 9.7],
    [x, y - 1.016, 11.43],
    [x, y - 3.048, 7.8],
    [x, y - 3.048, -7.8],
    [x, y - 1.016, -11.43],
  ];
}

function deck(out) {
  const segments = Math.ceil((deckEnd * 2) / 6),
    points = Array.from(
      { length: segments + 1 },
      (_, i) => -deckEnd + (i * deckEnd * 2) / segments,
    );
  loft(out, 'wall', points.map(deckRing), white);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    strip(out, a, b, -9.7, 9.7, 0.04, asphalt);
    // Both paths cantilever beyond the aerofoil point; their underside follows a shallow box.
    for (const sign of [-1, 1]) {
      const ring = (x) => {
        const y = deckY(x);
        const z0 = sign < 0 ? -16 : 10.1,
          z1 = sign < 0 ? -10.1 : 16;
        return [
          [x, y + 0.12, z0],
          [x, y + 0.12, z1],
          [x, y - 0.2, z1],
          [x, y - 1.04, (z0 + z1) / 2],
          [x, y - 0.2, z0],
        ];
      };
      loft(out, 'wall', [ring(a), ring(b)], white);
      strip(out, a, b, sign < 0 ? -15.85 : 10.2, sign < 0 ? -10.2 : 15.85, 0.14, path);
      beam(
        out,
        'metal',
        [a, deckY(a) + 0.85, sign * 9.6],
        [b, deckY(b) + 0.85, sign * 9.6],
        0.12,
        0.32,
        edgeWhite,
      );
      for (const y of [0.64, 1.28])
        beam(
          out,
          'metal',
          [a, deckY(a) + y, sign * 15.9],
          [b, deckY(b) + y, sign * 15.9],
          0.065,
          0.08,
          edgeWhite,
        );
    }
    // Narrow central reservation, paired steel safety barriers and solid carriageway edges.
    strip(out, a, b, -0.5, 0.5, 0.065, path);
    for (const z of [-0.43, 0.43])
      beam(out, 'metal', [a, deckY(a) + 0.76, z], [b, deckY(b) + 0.76, z], 0.09, 0.27, edgeWhite);
    for (const z of [-8.95, -0.86, 0.86, 8.95])
      strip(out, a, b, z - 0.07, z + 0.07, 0.065, marking);
  }
  for (let x = -deckEnd + 2; x < deckEnd - 2; x += 12)
    for (const z of [-4.6, 4.6]) strip(out, x, x + 4, z - 0.075, z + 0.075, 0.07, marking);
  // Finely spaced parapet pickets and sparse larger post shoes remain actual geometry.
  for (let x = -deckEnd + 0.3, i = 0; x < deckEnd; x += 0.75, i++) {
    const y = deckY(x);
    for (const sign of [-1, 1]) {
      const z = sign * 15.9;
      box(
        out,
        'metal',
        [x - 0.022, y + 0.2, z - 0.024],
        [x + 0.022, y + 1.28, z + 0.024],
        edgeWhite,
      );
      if (i % 4 === 0) {
        box(
          out,
          'metal',
          [x - 0.055, y + 0.13, z - 0.055],
          [x + 0.055, y + 1.33, z + 0.055],
          edgeWhite,
        );
        box(out, 'metal', [x - 0.13, y + 0.13, z - 0.13], [x + 0.13, y + 0.19, z + 0.13], steel);
        for (const barrierZ of [sign * 9.6, sign * 0.43])
          box(
            out,
            'metal',
            [x - 0.045, y + 0.04, barrierZ - 0.055],
            [x + 0.045, y + 0.9, barrierZ + 0.055],
            steel,
          );
      }
    }
  }
  for (let x = -deckEnd + 6; x < deckEnd; x += 6)
    for (const sign of [-1, 1])
      beam(
        out,
        'wall',
        [x, deckY(x) - 2.6, sign * 8.2],
        [x, deckY(x) - 0.3, sign * 15.7],
        0.13,
        0.22,
        edgeWhite,
      );
  for (const x of [-halfSpan - 3, -halfSpan + 3, halfSpan - 3, halfSpan + 3]) {
    strip(out, x - 0.14, x + 0.14, -9.7, 9.7, 0.08, steel, 'metal');
    for (let z = -9.5; z < 9.5; z += 0.22)
      strip(out, x - 0.28, x + 0.28, z, z + 0.08, 0.09, edgeWhite, 'metal');
  }
}

function cutwaterRing(x, y, inset = 0) {
  const w = 5.75 - inset,
    end = 20 - inset;
  return [
    [x, y, -end],
    [x - w, y, -13.2],
    [x - w, y, 13.2],
    [x, y, end],
    [x + w, y, 13.2],
    [x + w, y, -13.2],
  ];
}

function tower(out, x) {
  loft(
    out,
    'foundation',
    [cutwaterRing(x, 2.4), cutwaterRing(x, 9.8), cutwaterRing(x, 11.4, 0.45)],
    concrete,
  );
  loft(out, 'foundation', [cutwaterRing(x, 0), cutwaterRing(x, 2.4)], darkConcrete);
  for (const sign of [-1, 1]) {
    const z = sign * legZ;
    box(out, 'foundation', [x - 3.2, 11.25, z - 2.85], [x + 3.2, 12, z + 2.85], concrete);
    loft(
      out,
      'wall',
      [12, 29, 61, 97, 132.8].map((y) => {
        const t = (y - 12) / 120.8;
        return chamferedRectangle(x, y, z, 4.7 - 1.45 * t, 3.8 - 0.9 * t, 0.045);
      }),
      white,
    );
    // Saddle pedestal and shaped cover. Cable follows through its crown.
    box(out, 'metal', [x - 2, 132.7, z - 1.6], [x + 2, 133.5, z + 1.6], edgeWhite);
    loft(
      out,
      'wall',
      [133.5, 134.2, 135.1].map((y, i) =>
        chamferedRectangle(x, y, z, 3.8 - i * 0.9, 2.8 - i * 0.5, 0.2),
      ),
      white,
    );
    for (const side of [-1, 1]) {
      const faceX = x + side * 2.22,
        y = deckY(x) + 0.15;
      box(out, 'metal', [faceX - 0.05, y, z - 0.34], [faceX + 0.05, y + 1.86, z + 0.34], steel);
      box(
        out,
        'wall',
        [faceX - 0.065, y + 0.03, z - 0.3],
        [faceX + 0.065, y + 1.83, z + 0.3],
        edgeWhite,
      );
      tube(
        out,
        'metal',
        [faceX + side * 0.085, y + 0.85, z + 0.2],
        [faceX + side * 0.085, y + 1.02, z + 0.2],
        0.018,
        steel,
        8,
      );
    }
  }
  const beamLevels = [
    [deckY(x) - 6.15, 3.1],
    [83.5, 4.1],
    [128.8, 4.0],
  ];
  for (const [y, height] of beamLevels) {
    box(out, 'wall', [x - 1.8, y, -legZ], [x + 1.8, y + height, legZ], white);
    // Plate seams are subtle construction divisions, not exposed internal bracing.
    for (const side of [-1, 1])
      for (const z of [-7.5, -2.5, 2.5, 7.5])
        box(
          out,
          'wall',
          [x + side * 1.81 - 0.013, y + 0.1, z - 0.012],
          [x + side * 1.81 + 0.013, y + height - 0.1, z + 0.012],
          edgeWhite,
        );
  }
  // Top-level inspection railing, with no invented interior floors visible outside.
  for (const side of [-1, 1]) {
    const xx = x + side * 1.64;
    for (const y of [133.38, 133.85])
      tube(out, 'metal', [xx, y, -10.1], [xx, y, 10.1], 0.025, steel, 8);
    for (let z = -10; z <= 10; z += 2)
      tube(out, 'metal', [xx, 132.8, z], [xx, 133.88, z], 0.025, steel, 8);
  }
}

function anchorage(out, sign) {
  const x = sign * deckEnd,
    lo = sign > 0 ? x - 5 : x - 20,
    hi = sign > 0 ? x + 20 : x + 5;
  // Only above-reference exteriors: submerged foundations have no measured geometry here.
  box(out, 'foundation', [lo, 0, -17.5], [hi, 30.8, 17.5], concrete);
  for (const side of [-1, 1]) {
    const z = side * legZ;
    box(out, 'foundation', [lo, 30.8, z - 3.1], [hi, 33.3, z + 3.1], concrete);
    box(out, 'metal', [x - 1.2, 33.3, z - 0.7], [x + 1.2, 33.55, z + 0.7], steel);
    tube(out, 'cable', [x, 34, z], [x + sign * 12, 29.5, z], 0.25, cableColor, 16);
  }
}

function hanger(out, start, end) {
  tube(out, 'cable', start, end, 0.025, cableColor, 8);
  const length = Math.hypot(...end.map((n, i) => n - start[i])),
    unit = end.map((n, i) => (n - start[i]) / length);
  for (const [point, sign] of [
    [start, 1],
    [end, -1],
  ]) {
    const other = point.map((n, i) => n + sign * unit[i] * 0.48);
    tube(out, 'metal', point, other, 0.06, edgeWhite, 10);
    tube(
      out,
      'metal',
      [point[0], point[1], point[2] - 0.11],
      [point[0], point[1], point[2] + 0.11],
      0.065,
      steel,
      10,
    );
  }
  // The lower termination is pinned to a twin clevis plate at the deck eye.
  for (const offset of [-0.075, 0.075])
    box(
      out,
      'metal',
      [end[0] - 0.12, end[1] - 0.28, end[2] + offset - 0.018],
      [end[0] + 0.12, end[1] + 0.08, end[2] + offset + 0.018],
      edgeWhite,
    );
}

function suspension(out) {
  for (const sign of [-1, 1]) {
    const z = sign * legZ;
    for (const [a, b] of [
      [-deckEnd, -halfSpan],
      [-halfSpan, halfSpan],
      [halfSpan, deckEnd],
    ]) {
      const steps = Math.ceil((b - a) / 3);
      for (let i = 0; i < steps; i++) {
        const x0 = a + ((b - a) * i) / steps,
          x1 = a + ((b - a) * (i + 1)) / steps;
        tube(out, 'cable', [x0, cableY(x0), z], [x1, cableY(x1), z], 0.25, cableColor, 16);
      }
    }
    // Nominal 60-ft spacing is retained in each span. End margins reconcile rounded spans.
    for (const [a, b, count] of [
      [-deckEnd, -halfSpan, 16],
      [-halfSpan, halfSpan, 54],
      [halfSpan, deckEnd, 16],
    ]) {
      const margin = (b - a - (count - 1) * 18.288) / 2;
      for (let i = 0; i < count; i++) {
        const x = a + margin + i * 18.288,
          y = cableY(x),
          offset = Math.min(9.144, (y - 0.43 - (deckY(x) + 0.43)) * Math.tan((35 * Math.PI) / 180));
        tube(
          out,
          'metal',
          [x - 0.3, cableY(x - 0.3), z],
          [x + 0.3, cableY(x + 0.3), z],
          0.32,
          edgeWhite,
          16,
        );
        box(out, 'metal', [x - 0.22, y - 0.45, z - 0.17], [x + 0.22, y - 0.15, z + 0.17], steel);
        for (const direction of [-1, 1]) {
          let endX = x + direction * offset;
          // Rounded span dimensions otherwise put the nearest main-span socket inside
          // the solid tower leg. Preserve a visible structural attachment beside it.
          if (Math.abs(Math.abs(endX) - halfSpan) < 3.2)
            endX = Math.sign(endX) * (halfSpan + (Math.abs(x) < halfSpan ? -3.2 : 3.2));
          hanger(out, [x + direction * 0.11, y - 0.43, z], [endX, deckY(endX) + 0.43, z]);
        }
        // Clamp halves and transverse fasteners, reconstructed without overstating their dimensions.
        for (const dx of [-0.18, 0.18])
          tube(
            out,
            'metal',
            [x + dx, y + 0.07, z - 0.39],
            [x + dx, y + 0.07, z + 0.39],
            0.028,
            steel,
            8,
          );
      }
    }
  }
}

export function buildSevern(out) {
  deck(out);
  for (const sign of [-1, 1]) {
    tower(out, sign * halfSpan);
    anchorage(out, sign);
  }
  suspension(out);
}
