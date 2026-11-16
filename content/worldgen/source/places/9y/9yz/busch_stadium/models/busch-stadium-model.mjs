import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const { elements } = read('native-map/footprint.json');
const nodes = new Map(
  elements.filter((item) => item.type === 'node').map((item) => [item.id, item]),
);
const meter = (6378137 * Math.PI) / 180;
const eastMeter = meter * Math.cos((frame.anchor[1] * Math.PI) / 180);
const into = ({ lon, lat }) => [
  (lon - frame.anchor[0]) * eastMeter,
  (frame.anchor[1] - lat) * meter,
];
function mappedRing(id) {
  const way = elements.find((element) => element.type === 'way' && element.id === id);
  return way.nodes.slice(0, -1).map((node) => into(nodes.get(node)));
}

const field = plan.dimensions;
const warningTrack = mappedRing(field.warningTrackWay);
const outfieldGrass = mappedRing(field.grassWay);
const infieldDirt = mappedRing(field.infieldDirtWay);
const infieldGrass = mappedRing(field.infieldGrassWay);
const mound = mappedRing(field.moundWay);
const turfColor = rgb('739350');
const stripeColor = rgb('7f9b56');
const dirtColor = rgb('a86342');
const warningColor = rgb('ae7954');
const chalkColor = rgb('ebe5cb');
const palette = 'palette:#ffffff';
const unit = ([x, z]) => {
  const length = Math.hypot(x, z);
  return [x / length, z / length];
};
const along = ([x, z], [dx, dz], distance) => [x + dx * distance, z + dz * distance];
const xyz = ([x, z], y) => [x, y, z];
const cross2 = ([x, z], [u, v]) => x * v - z * u;
const delta = ([x, z], [u, v]) => [x - u, z - v];

function fieldTriangulation(outer, inner) {
  const vertices = inner ? [...outer, ...inner] : outer;
  const indices = earcut(vertices.flat(), inner ? [outer.length] : []);
  const triangles = [];
  for (let i = 0; i < indices.length; i += 3) {
    const corners = indices.slice(i, i + 3).map((index) => vertices[index]);
    if (cross2(delta(corners[1], corners[0]), delta(corners[2], corners[0])) > 0) corners.reverse();
    triangles.push(corners);
  }
  return triangles;
}

const fieldRegions = [
  { triangles: fieldTriangulation(warningTrack, outfieldGrass), color: warningColor },
  { triangles: fieldTriangulation(outfieldGrass, infieldDirt), color: turfColor },
  { triangles: fieldTriangulation(infieldDirt, infieldGrass), color: dirtColor },
  { triangles: fieldTriangulation(infieldGrass, mound), color: turfColor },
];
const moundCenter = mound.reduce(
  ([x, z], [a, b]) => [x + a / mound.length, z + b / mound.length],
  [0, 0],
);
const firstDirection = unit(delta(infieldGrass[1], infieldGrass[0]));
const thirdDirection = unit(delta(infieldGrass[20], infieldGrass[21]));
const centerDirection = unit([
  firstDirection[0] + thirdDirection[0],
  firstDirection[1] + thirdDirection[1],
]);
const home = along(moundCenter, centerDirection, -18.4404);

function chalkLine(out, a, b, width, y) {
  const [dx, dz] = unit(delta(b, a));
  const normal = [-dz, dx];
  const corners = [
    along(a, normal, -width / 2),
    along(a, normal, width / 2),
    along(b, normal, width / 2),
    along(b, normal, -width / 2),
  ].map((p) => xyz(p, y));
  quad(out, 'ground', corners, [0, 1, 0], chalkColor);
}

function rayLimit(origin, direction, ring) {
  let nearest = Infinity;
  for (let i = 0; i < ring.length; ++i) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const edge = delta(b, a),
      from = delta(a, origin);
    const divisor = cross2(direction, edge);
    if (Math.abs(divisor) < 1e-10) continue;
    const length = cross2(from, edge) / divisor,
      fraction = cross2(from, direction) / divisor;
    if (length > 0 && fraction >= 0 && fraction <= 1) nearest = Math.min(nearest, length);
  }
  return nearest;
}

const mowingAxis = ([x, z]) => x + 0.6 * z;
const stripeWidth = 12;

function clipStripe(polygon, edge, direction) {
  const points = [];
  for (let i = 0; i < polygon.length; ++i) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const from = (mowingAxis(a) - edge) * direction;
    const to = (mowingAxis(b) - edge) * direction;
    if (from >= 0) points.push(a);
    if (from >= 0 !== to >= 0) {
      const t = from / (from - to);
      points.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return points;
}

export function drawField(out, detail) {
  const y = field.fieldY;
  const groundTri = (points, color) => {
    const normal = normalFor(...points);
    if (normal[1] < 0) points.reverse();
    out.addTriangle(
      'ground',
      palette,
      points,
      normalFor(...points),
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      color,
    );
  };
  for (const region of fieldRegions)
    for (const triangle of region.triangles) {
      if (detail < 2 || region.color !== turfColor) {
        groundTri(
          triangle.map((p) => xyz(p, y)),
          region.color,
        );
        continue;
      }
      const offsets = triangle.map(mowingAxis);
      const first = Math.floor(Math.min(...offsets) / stripeWidth);
      const last = Math.floor(Math.max(...offsets) / stripeWidth);
      for (let stripe = first; stripe <= last; ++stripe) {
        const lower = clipStripe(triangle, stripe * stripeWidth, 1);
        const band = clipStripe(lower, (stripe + 1) * stripeWidth, -1);
        const color = stripe % 2 === 0 ? stripeColor : turfColor;
        for (let i = 1; i < band.length - 1; ++i) {
          const corners = [band[0], band[i], band[i + 1]];
          if (
            Math.abs(cross2(delta(corners[1], corners[0]), delta(corners[2], corners[0]))) > 0.00001
          )
            groundTri(
              corners.map((p) => xyz(p, y)),
              color,
            );
        }
      }
    }
  for (let i = 0; i < mound.length; ++i)
    groundTri(
      [xyz(mound[i], y), xyz(mound[(i + 1) % mound.length], y), xyz(moundCenter, y + 0.24)],
      dirtColor,
    );
  for (const [direction, feet] of [
    [firstDirection, field.fieldDistancesMeters.right],
    [thirdDirection, field.fieldDistancesMeters.left],
  ]) {
    const length = Math.min(feet, rayLimit(home, direction, warningTrack));
    chalkLine(
      out,
      home,
      along(home, direction, length - 0.1),
      detail === 0 ? 0.18 : 0.095,
      y + 0.026,
    );
  }
  const first = along(home, firstDirection, 27.432);
  const third = along(home, thirdDirection, 27.432);
  const second = along(first, thirdDirection, 27.432);
  for (const square of [home, first, second, third]) {
    const half = 0.21;
    chalkLine(
      out,
      along(square, firstDirection, -half),
      along(square, firstDirection, half),
      0.42,
      y + 0.039,
    );
  }
  chalkLine(
    out,
    along(moundCenter, firstDirection, -0.28),
    along(moundCenter, firstDirection, 0.28),
    0.16,
    y + 0.261,
  );
}

const outerRing = frame.geometry.outline;
const innerRing = frame.geometry.holes[0];
const terrain = read('terrain-grid.json');
const center = field.bowlCenter;
const tau = Math.PI * 2;
const radians = (angle) => (angle * Math.PI) / 180;
const lerp = (a, b, t) => a + (b - a) * t;
const blend = (a, b, t) => a.map((value, index) => lerp(value, b[index], t));
const tan = rgb('b4aaa0');
const aisle = rgb('bcb3a5');
const brick = rgb('a76047');
const brickTop = rgb('b67b62');
const shadow = rgb('353f3f');
const structure = rgb('3a5152');
const roofColor = rgb('53696d');
const fascia = rgb('7e4037');
const glass = rgb('506060');
const seating = ['944339', '9f4d43', 'a85146', 'a04b42'].map(rgb);
const clubSeating = rgb('486454');
const wallGreen = rgb('425f50');
const lampColor = rgb('e2e2cb');
const foulPole = rgb('e0bc63');
const video = rgb('273c47');

const surfaces = {
  ground: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.96 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.94 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.93 },
  seats: { slot: 'trim', localRef: 'palette:#fff5ed', roughness: 0.73, metallic: 0.02 },
  steel: { slot: 'trim', localRef: 'palette:#eaf9ff', roughness: 0.67, metallic: 0.25 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.66, metallic: 0.26 },
};

function worldGround([x, z]) {
  const [u, v] = [x, z].map((n, i) => (n - terrain.origin[i]) / terrain.stepMeters);
  const a = Math.floor(u);
  const b = Math.floor(v);
  const heights = terrain.heightsMeters;
  const north = lerp(heights[b][a], heights[b][a + 1], u - a);
  const south = lerp(heights[b + 1][a], heights[b + 1][a + 1], u - a);
  return lerp(north, south, v - b) - terrain.modelDatumElevationMeters;
}

function panel(out, slot, points, normal, color) {
  if (normalFor(...points).reduce((sum, value, i) => sum + value * normal[i], 0) < 0)
    points.reverse();
  quad(out, slot, points, normalFor(...points), color);
}

function ledge(out, slot, a, b, c, d, y0, y1, color) {
  panel(out, slot, [xyz(a, y0), xyz(b, y0), xyz(c, y1), xyz(d, y1)], [0, 1, 0], color);
}

function wallPanel(out, slot, a, b, bottom, top, color, facing) {
  const low = Array.isArray(bottom) ? bottom : [bottom, bottom];
  const high = Array.isArray(top) ? top : [top, top];
  panel(
    out,
    slot,
    [xyz(a, low[0]), xyz(b, low[1]), xyz(b, high[1]), xyz(a, high[0])],
    facing,
    color,
  );
}

const radial = ([x, z]) => [x - center[0], 0, z - center[1]];
const angleUnit = (angle) => [Math.cos(angle), Math.sin(angle)];

function levelOfUpperDeck(angle) {
  let degrees = (angle * 180) / Math.PI;
  if (degrees > 180) degrees -= 360;
  if (degrees < -180) degrees += 360;
  // Either side of the open northeast sector, the upper decks rise over the corner seats.
  const outside = Math.max(degrees - 32, -105 - degrees);
  return Math.min(1, Math.max(0, (outside + 4) / 21));
}

function sectionAt(angle) {
  const direction = angleUnit(angle);
  const outer = rayLimit(center, direction, outerRing);
  const track = rayLimit(center, direction, warningTrack);
  const inner = Math.min(rayLimit(center, direction, innerRing), track + 5);
  if (![outer, inner, track].every(Number.isFinite) || outer <= inner + 2)
    throw Error('Inconsistent mapped bowl radii at ' + angle);
  return { angle, direction, outer, inner, track, upper: levelOfUpperDeck(angle) };
}
const at = (section, t) => along(center, section.direction, lerp(section.inner, section.outer, t));
const pointAt = (section, radius) => along(center, section.direction, radius);

function wholeBowlSections(detail) {
  const count = [18, 38, 68, 96][detail];
  const angles = Array.from({ length: count }, (_, i) => -Math.PI + (i * tau) / count);
  return angles.map(sectionAt);
}

function seatStrip(out, a, b, start, end, nearY, farY, color, detail, steps) {
  const aNear = at(a, start),
    bNear = at(b, start);
  const aFar = at(a, end),
    bFar = at(b, end);
  const riser = (farY - nearY) / steps;
  if (steps === 1) {
    ledge(out, 'seats', aNear, bNear, bFar, aFar, nearY, farY, color);
    return;
  }
  const gap = detail >= 2 ? 0.065 : 0.039;
  for (let row = 0; row < steps; ++row) {
    const u = row / steps,
      v = (row + 1) / steps;
    const a0 = blend(aNear, aFar, u),
      a1 = blend(aNear, aFar, v);
    const b0 = blend(bNear, bFar, u),
      b1 = blend(bNear, bFar, v);
    const y = nearY + riser * row;
    const left = blend(a0, b0, gap),
      nextLeft = blend(a1, b1, gap);
    ledge(out, 'concrete', a0, left, nextLeft, a1, y, y, aisle);
    ledge(out, 'seats', left, b0, b1, nextLeft, y, y, color);
    wallPanel(
      out,
      'concrete',
      a1,
      b1,
      y,
      y + riser,
      detail >= 2 ? tan : shadow,
      radial(a1).map((n) => -n),
    );
  }
}

function aisleBand(out, a, b, near, far, y, color = tan) {
  ledge(out, 'concrete', at(a, near), at(b, near), at(b, far), at(a, far), y, y, color);
}

function tierFront(out, a, b, fraction, y0, y1, color) {
  const start = at(a, fraction),
    end = at(b, fraction);
  wallPanel(
    out,
    'steel',
    start,
    end,
    y0,
    y1,
    color,
    radial(start).map((n) => -n),
  );
}

function bowl(out, details, detail) {
  for (let i = 0; i < details.length; ++i) {
    const a = details[i],
      b = details[(i + 1) % details.length];
    const mid = radial(at(a, 0.2));
    const upper = Math.min(a.upper, b.upper);
    const tall = upper >= 0.27;
    const color = seating[i % seating.length];
    const lowTop = tall ? 8.1 : 4.4;
    const fieldEdgeA = pointAt(a, a.track),
      fieldEdgeB = pointAt(b, b.track);
    const curbY = field.fieldY + (tall ? 1.05 : field.outfieldWallHeight);
    wallPanel(
      out,
      'steel',
      fieldEdgeA,
      fieldEdgeB,
      field.fieldY - 0.1,
      curbY,
      wallGreen,
      mid.map((n) => -n),
    );
    ledge(out, 'concrete', fieldEdgeA, fieldEdgeB, at(b, 0.034), at(a, 0.034), curbY, curbY, tan);
    const behindHome = mid[0] < -32 && mid[2] > 14;
    seatStrip(
      out,
      a,
      b,
      0.034,
      tall ? 0.49 : 0.72,
      curbY,
      lowTop,
      behindHome ? clubSeating : color,
      detail,
      [1, 2, 7, 15][detail],
    );
    aisleBand(out, a, b, tall ? 0.49 : 0.72, tall ? 0.53 : 0.93, lowTop);
    if (!tall) {
      const p = at(a, 0.93),
        q = at(b, 0.93);
      wallPanel(out, 'steel', p, q, lowTop, lowTop + 1.07, structure, mid);
      continue;
    }
    const midBack = 9.6 + 7.9 * upper;
    const topStart = 13.5 + 5.7 * upper;
    const topBack = 15.5 + 14.8 * upper;
    tierFront(out, a, b, 0.46, 8.08, 10.06, shadow);
    tierFront(out, a, b, 0.48, 10.06, 10.48, fascia);
    seatStrip(out, a, b, 0.48, 0.73, 10.48, midBack, color, detail, [1, 2, 6, 12][detail]);
    aisleBand(out, a, b, 0.73, 0.76, midBack);
    tierFront(out, a, b, 0.68, midBack - 0.21, topStart, shadow);
    tierFront(out, a, b, 0.695, topStart, topStart + 0.43, fascia);
    seatStrip(
      out,
      a,
      b,
      0.695,
      0.925,
      topStart + 0.43,
      topBack,
      color,
      detail,
      [1, 1, 6, 13][detail],
    );
    aisleBand(out, a, b, 0.925, 0.975, topBack);
    const backA = at(a, 0.975),
      backB = at(b, 0.975);
    wallPanel(out, 'steel', backA, backB, topBack - 0.26, topBack + 1.13, shadow, mid);
    if (upper >= 0.74) {
      const y = field.upperRoofEavesY - (1 - upper) * 11;
      ledge(
        out,
        'roof',
        at(a, 0.852),
        at(b, 0.852),
        at(b, 0.986),
        at(a, 0.986),
        y - 0.55,
        y + 0.48,
        roofColor,
      );
      tierFront(out, a, b, 0.854, y - 0.92, y - 0.55, shadow);
      if (detail >= 1) {
        const post = at(a, 0.966);
        beam(out, 'steel', xyz(post, topBack - 0.18), xyz(post, y + 0.21), 0.44, 0.5, structure);
        if (detail >= 2)
          beam(
            out,
            'steel',
            xyz(post, y - 0.58),
            xyz(at(a, 0.855), y - 0.6),
            0.29,
            0.39,
            structure,
          );
      }
    }
  }
}

const outerHeading = (point) => Math.atan2(point[1] - center[1], point[0] - center[0]);

function exterior(out, detail) {
  const ring = detail >= 2 ? outerRing : wholeBowlSections(detail).map((s) => at(s, 1));
  const inward = (point, metres) =>
    along(point, unit([center[0] - point[0], center[1] - point[1]]), metres);
  for (let i = 0; i < ring.length; ++i) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const mid = blend(a, b, 0.5);
    const height = levelOfUpperDeck(outerHeading(mid));
    const low = height < 0.27;
    const grade = [worldGround(a), worldGround(b)];
    const top = low ? 6.3 + 0.35 * Math.max(...grade) : 18.5 + 10.5 * height;
    const innerTop = low ? 4.4 : 15.5 + 14.8 * height;
    const normal = radial(mid);
    wallPanel(
      out,
      'concrete',
      a,
      b,
      grade.map((n) => n - 2.05),
      grade.map((n) => n + 0.73),
      tan,
      normal,
    );
    wallPanel(
      out,
      'brick',
      a,
      b,
      grade.map((n) => n + 0.73),
      top,
      brick,
      normal,
    );
    const innerA = inward(a, 3.7),
      innerB = inward(b, 3.7);
    ledge(out, 'concrete', a, b, innerB, innerA, top, innerTop, brickTop);
    if (detail === 0) continue;
    const span = Math.hypot(...delta(b, a));
    const count = Math.max(1, Math.round(span / 6.8));
    for (let j = 0; j < count; ++j) {
      const u = (j + 0.16) / count,
        v = (j + 0.82) / count;
      const p = blend(a, b, u),
        q = blend(a, b, v);
      if (Math.hypot(...delta(q, p)) < 0.44) continue;
      const g = lerp(...grade, (u + v) / 2);
      const offset = unit([normal[0], normal[2]]);
      const left = along(p, offset, 0.045),
        right = along(q, offset, 0.045);
      const base = g + 1.68;
      const archHead = low ? Math.min(top - 0.57, g + 4.71) : Math.min(top - 1.14, g + 9.73);
      if (archHead <= base + 0.7) continue;
      const knee = archHead - (low ? 0.55 : 1.18);
      wallPanel(out, 'steel', left, right, base, knee, glass, normal);
      if (detail >= 2 || (detail === 1 && j === 0)) {
        const crown = xyz(blend(left, right, 0.5), archHead);
        const p0 = xyz(left, knee),
          q0 = xyz(right, knee);
        const points = [p0, q0, crown];
        if (normalFor(...points).reduce((sum, n, k) => sum + n * normal[k], 0) < 0)
          points.reverse();
        out.addTriangle(
          'steel',
          palette,
          points,
          normalFor(...points),
          [
            [0, 0],
            [1, 0],
            [0.5, 1],
          ],
          glass,
        );
      }
      if (!low) {
        wallPanel(out, 'steel', left, right, g + 11.2, g + 13.5, shadow, normal);
        if (detail >= 2) wallPanel(out, 'steel', left, right, g + 15.05, g + 17.44, glass, normal);
      }
    }
  }
}

function gateFrame(out, gate, detail) {
  const direction = unit(delta(gate.local, center));
  const tangent = [-direction[1], direction[0]];
  const height = levelOfUpperDeck(outerHeading(gate.local));
  const base = worldGround(gate.local) - 0.65;
  const westBridge = gate.name === 'Gate 3';
  const width = westBridge ? 26 : 18;
  const top = height > 0.35 ? 15.8 + 5 * height : 11.9;
  const edge = (u, v) => along(along(gate.local, tangent, u), direction, v);
  const outward = [direction[0], 0, direction[1]];
  for (const sign of [-1, 1]) {
    const x = sign * (width / 2 + 1.75);
    const a = edge(x - 2.22, -3.28),
      b = edge(x + 2.22, -3.28),
      c = edge(x + 2.22, 1.72),
      d = edge(x - 2.22, 1.72);
    ledge(out, 'concrete', a, b, c, d, top, top, tan);
    if (detail === 0) {
      wallPanel(out, 'brick', d, c, base, top, brick, outward);
      continue;
    }
    for (const [p, q] of [
      [a, b],
      [b, c],
      [c, d],
      [d, a],
    ]) {
      const mid = blend(p, q, 0.5);
      const from = delta(mid, edge(x, -0.78));
      wallPanel(out, 'brick', p, q, base, top, brick, [from[0], 0, from[1]]);
    }
    if (detail >= 1) {
      for (const y of [base + 2.1, base + 5.25, base + 8.65]) {
        wallPanel(
          out,
          'steel',
          edge(x - 0.83, 1.748),
          edge(x + 0.83, 1.748),
          y,
          y + 1.64,
          glass,
          outward,
        );
      }
      wallPanel(
        out,
        'concrete',
        edge(x - 2.29, 1.759),
        edge(x + 2.29, 1.759),
        top - 0.32,
        top + 0.08,
        tan,
        outward,
      );
    }
  }
  if (!westBridge) return;
  const deck = base + 5.7;
  ledge(
    out,
    'concrete',
    edge(-width / 2, -1.7),
    edge(width / 2, -1.7),
    edge(width / 2, 1.52),
    edge(-width / 2, 1.52),
    deck,
    deck,
    tan,
  );
  wallPanel(
    out,
    'steel',
    edge(-width / 2, 1.57),
    edge(width / 2, 1.57),
    deck - 0.48,
    deck + 0.24,
    structure,
    outward,
  );
  const count = [4, 8, 14, 20][detail];
  let previous;
  for (let i = 0; i <= count; ++i) {
    const u = (2 * i) / count - 1;
    const y = deck + 1.12 + 4.6 * (1 - u * u);
    const p = xyz(edge((u * width) / 2, 1.9), y);
    if (previous) {
      if (detail === 0)
        wallPanel(
          out,
          'steel',
          [previous[0], previous[2]],
          [p[0], p[2]],
          [previous[1] - 0.45, p[1] - 0.45],
          [previous[1], p[1]],
          structure,
          outward,
        );
      else beam(out, 'steel', previous, p, 0.39, 0.32, structure);
    }
    if (detail >= 1 && i > 0 && i < count)
      beam(out, 'steel', p, xyz(edge((u * width) / 2, 1.9), deck), 0.12, 0.14, structure);
    previous = p;
  }
}

function sectorPoint(angle, fraction) {
  return at(sectionAt(radians(angle)), fraction);
}

function freestandingBoard(out, angle, width, height, floor, detail) {
  const p = sectorPoint(angle, 0.79);
  const outward = unit(delta(p, center)),
    inward = outward.map((n) => -n);
  const tangent = [-outward[1], outward[0]];
  const edge = (u, v) => along(along(p, tangent, u), outward, v);
  const wide = width / 2;
  const near = [inward[0], 0, inward[1]],
    far = near.map((n) => -n);
  for (const sign of [-1, 1]) {
    const x = sign * (wide - 3.1);
    if (detail === 0) {
      wallPanel(
        out,
        'steel',
        edge(x - 0.41, 1.57),
        edge(x + 0.41, 1.57),
        worldGround(p) - 0.32,
        floor + height,
        structure,
        far,
      );
      continue;
    }
    beam(
      out,
      'steel',
      xyz(edge(x, 1.57), worldGround(p) - 0.32),
      xyz(edge(x, 1.57), floor + height + 0.08),
      0.88,
      0.92,
      structure,
    );
  }
  const a = edge(-wide, -0.41),
    b = edge(wide, -0.41);
  const c = edge(wide, 1.24),
    d = edge(-wide, 1.24);
  wallPanel(out, 'steel', a, b, floor - 0.46, floor + height + 0.56, shadow, near);
  wallPanel(out, 'steel', c, d, floor - 0.46, floor + height + 0.56, structure, far);
  ledge(out, 'steel', a, b, c, d, floor + height + 0.56, floor + height + 0.56, shadow);
  for (const [x, side] of [
    [-wide, 1],
    [wide, -1],
  ]) {
    wallPanel(
      out,
      'steel',
      edge(x, -0.41),
      edge(x, 1.24),
      floor - 0.46,
      floor + height + 0.56,
      shadow,
      [tangent[0] * -side, 0, tangent[1] * -side],
    );
  }
  wallPanel(
    out,
    'steel',
    edge(-wide + 0.47, -0.47),
    edge(wide - 0.47, -0.47),
    floor + 0.03,
    floor + height - 0.04,
    video,
    near,
  );
  if (detail >= 2)
    wallPanel(
      out,
      'steel',
      edge(-wide + 0.48, -0.48),
      edge(wide - 0.48, -0.48),
      floor + 0.12,
      floor + 0.42,
      glass,
      near,
    );
}

function lightStructure(out, angle, detail) {
  const p = sectorPoint(angle, 0.97);
  const outward = unit(delta(p, center));
  const tangent = [-outward[1], outward[0]];
  const edge = (u, v) => along(along(p, tangent, u), outward, v);
  const peak = field.peakLampY - (1 - levelOfUpperDeck(radians(angle))) * 5.5;
  const foot = worldGround(p) - 0.7;
  if (detail === 0) {
    const a = edge(-0.91, 0),
      b = edge(0.91, 0);
    wallPanel(out, 'steel', a, b, foot, peak - 1.25, structure, [outward[0], 0, outward[1]]);
    wallPanel(out, 'steel', edge(-2.9, -0.08), edge(2.9, -0.08), peak - 6.9, peak, glass, [
      outward[0],
      0,
      outward[1],
    ]);
    return;
  }
  for (const u of [-2.52, 2.52])
    beam(out, 'steel', xyz(edge(u, 0.37), foot), xyz(edge(u, 0.37), peak), 0.64, 0.69, structure);
  for (const y of [peak - 6.6, peak - 1.4, 31, 18])
    beam(out, 'steel', xyz(edge(-2.52, 0.37), y), xyz(edge(2.52, 0.37), y), 0.26, 0.35, structure);
  if (detail >= 2) {
    for (const u of [-2.01, 2.01])
      beam(
        out,
        'steel',
        xyz(edge(u, -0.08), 18),
        xyz(edge(u, -0.08), peak - 1.4),
        0.15,
        0.2,
        structure,
      );
  }
  const inward = [-outward[0], 0, -outward[1]];
  for (const u of [-1.55, 1.55]) {
    wallPanel(
      out,
      'steel',
      edge(u - 1.1, -0.26),
      edge(u + 1.1, -0.26),
      peak - 7,
      peak + 0.05,
      shadow,
      inward,
    );
    const rows = detail >= 2 ? 8 : 3;
    const columns = detail >= 2 ? 3 : 2;
    for (let i = 0; i < rows; ++i)
      for (let j = 0; j < columns; ++j) {
        const x = u - 1.04 + (j * 2.08) / columns;
        const y = peak - 6.73 + (i * 6.42) / rows;
        wallPanel(
          out,
          'steel',
          edge(x, -0.28),
          edge(x + 1.59 / columns, -0.28),
          y,
          y + 4.6 / rows,
          lampColor,
          inward,
        );
      }
  }
}

function draw(out, detail) {
  drawField(out, detail);
  bowl(out, wholeBowlSections(detail), detail);
  exterior(out, detail);
  for (const gate of frame.gates) gateFrame(out, gate, detail);
  freestandingBoard(out, -33, ...field.mainBoardSize, 10.1, detail);
  freestandingBoard(out, -6, ...field.outOfTownBoardSize, 9.85, detail);
  for (const angle of [31, 60, 91, 121, 151, -177, -146, -116]) lightStructure(out, angle, detail);
  if (detail >= 1) {
    for (const [direction, length] of [
      [firstDirection, field.fieldDistancesMeters.right],
      [thirdDirection, field.fieldDistancesMeters.left],
    ]) {
      const limit = Math.min(length, rayLimit(home, direction, warningTrack));
      const p = along(home, direction, limit + 0.95);
      beam(
        out,
        'steel',
        xyz(p, field.fieldY + 1),
        xyz(p, field.fieldY + 18.5),
        0.14,
        0.15,
        foulPole,
      );
    }
  }
}

export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [329, 197, -334];
const lookAt = [1, 10, 1];
export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe: slug + '-model.mjs',
  surfaces,
  build: closeup,
  wikidataId: 'Q253546',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.floorBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Busch Stadium in St. Louis is a red-brick ballpark with an open northeast outfield and three red seating decks beneath a narrow steel canopy.',
  camera,
  lookAt,
  sunDirection: [76, 105, -85],
  recipeDependencies: ['generate-motat-building.mjs', 'polygon-triangulation.mjs'],
  embeddedCanonicalGraphs: ['brick', 'concrete_plain', 'metal_standing_seam'],
  groundCutout: {
    outline: innerRing,
    minHeight: field.fieldY - 1.2,
    basis:
      'The mapped stadium opening covers the below-street warning track and playing field. The runtime clearance preserves the original terrain samples.',
  },
  mediumFiContext: {
    scale: 1,
    cameraYaw: -0.71,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'open-northeast-bowl', position: [180, 107, -184], lookAt: [-10, 8, 7] },
    { name: 'spruce-entry-and-steel-arch', position: [-154, 13, -90], lookAt: [-101, 10, -46] },
    { name: 'home-plate-decks', position: [57, 23, -45], lookAt: [-51, 12, 33] },
    { name: 'outfield-and-boards', position: [-31, 23, 32], lookAt: [74, 10, -52] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: slug + '-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.1,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.55, surfaces },
      street: { export: 'street', errorMeters: 0.22, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.1, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original architecture based on verified Qualla and Commons CC0 originals, geographic mapping and written project records.',
};
