import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  at,
  cap,
  face,
  floorSampler,
  mix,
  palette,
  rect,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const grade = floorSampler(read('terrain-grid.json'));
const d = plan.dimensions;
const grassY = d.fieldY;
const colors = palette({
  roof: 'e1e2dc',
  roofAlt: 'd4d7d5',
  edge: 'c4c9c8',
  metal: '666d72',
  concrete: 'b2b1a3',
  apron: '858981',
  recess: '454c4c',
  dark: '313a3c',
  track: 'a76052',
  clay: 'ae6c5e',
  border: 'cfcdc2',
  turf: '708a51',
  freshTurf: '7e965e',
  red: 'ac4746',
  lightRed: 'b96960',
  seatWhite: 'ddd9cf',
  seatGray: 'c6c6bb',
  marking: 'f0eadb',
  solar: '415667',
});
const surfaces = {
  concrete: surface('foundation', 'concrete_plain', 0.94),
  recess: surface('wall', 'concrete_plain', 0.91),
  roof: surface('roof', 'metal_standing_seam', 0.65, 0.22),
  trim: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.8 },
  ground: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.95 },
};
const fullTurn = 2 * Math.PI;
const vector = (angle) => [Math.cos(angle), Math.sin(angle)];
const blend = ([x, z], [u, v], t) => [mix(x, u, t), mix(z, v, t)];
const scale = ([x, z], factor) => [x * factor, z * factor];
const radial = ([x, z], sign = 1) => [sign * x, 0, sign * z];
const cross = ([x, z], [u, v]) => x * v - z * u;

function radius(outline, direction) {
  let distance = Infinity;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    const edge = [b[0] - a[0], b[1] - a[1]];
    const denominator = cross(direction, edge);
    if (Math.abs(denominator) < 1e-8) continue;
    const length = cross(a, edge) / denominator;
    const weight = cross(a, direction) / denominator;
    if (length > 0 && weight >= 0 && weight <= 1) distance = Math.min(distance, length);
  }
  return scale(direction, distance);
}

function wedge(out, slot, a, b, c, e, heightA, heightB, target, color) {
  face(out, slot, [at(a, heightA), at(b, heightA), at(c, heightB), at(e, heightB)], target, color);
}

function band(out, slot, starts, ends, low, high, color, target, selected = () => true) {
  for (let i = 0; i < starts.length; i++) {
    if (!selected(i)) continue;
    const j = (i + 1) % starts.length;
    wedge(
      out,
      slot,
      starts[i],
      starts[j],
      ends[j],
      ends[i],
      low,
      high,
      target(starts[i]),
      color(i),
    );
  }
}

function concentric(out, slot, a, b, rise, top, color, direction = 1) {
  band(
    out,
    slot,
    a,
    b,
    rise,
    top,
    () => color,
    () => (direction === 1 ? up : [0, -1, 0]),
  );
}

function vertical(out, slot, a, b, low, high, color, direction = 1) {
  band(
    out,
    slot,
    a,
    b,
    low,
    high,
    () => color,
    (p) => radial(p, direction),
  );
}

function mappedRing(outline, directions) {
  return directions.map((v) => radius(outline, v));
}

function drawTrack(out, level, track, pitch) {
  const trackY = grassY + 0.04;
  const interpolate = (a, b, t) => a.map((p, i) => blend(p, b[i], t));
  const outerBorder = track.map((p) => scale(p, 1.012));
  concentric(out, 'ground', outerBorder, track, trackY, trackY, colors.border);
  concentric(out, 'ground', track, pitch, trackY, trackY, colors.track);
  cap(out, 'ground', d.pitch, grassY + 0.065, colors.turf);
  if (level > 0) {
    const [midX, midZ] = d.pitchCenter;
    const x = midX - d.fieldWidth / 2;
    const z = midZ - d.fieldLength / 2;
    const stripeWidth = d.fieldLength / 12;
    for (let stripe = 1; stripe < 12; stripe += 2) {
      const start = z + stripe * stripeWidth;
      cap(
        out,
        'ground',
        rect(x, start + stripeWidth, x + d.fieldWidth, start),
        grassY + 0.085,
        colors.freshTurf,
      );
    }
    const line = (a, b) => {
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const width = 0.074;
      const offset = [((b[1] - a[1]) * width) / length, ((a[0] - b[0]) * width) / length];
      face(
        out,
        'ground',
        [a, b].flatMap(([px, pz], i) => {
          const sign = i === 0 ? 1 : -1;
          return [
            at([px + sign * offset[0], pz + sign * offset[1]], grassY + 0.105),
            at([px - sign * offset[0], pz - sign * offset[1]], grassY + 0.105),
          ];
        }),
        up,
        colors.marking,
      );
    };
    const field = rect(x, z + d.fieldLength, x + d.fieldWidth, z);
    field.forEach((p, i) => line(p, field[(i + 1) % 4]));
    line([x, midZ], [x + d.fieldWidth, midZ]);
    for (const side of [-1, 1]) {
      const end = midZ + side * d.fieldLength * 0.5;
      for (const [halfWidth, length] of [
        [20.16, 16.5],
        [9.16, 5.5],
      ]) {
        const left = midX - halfWidth,
          right = midX + halfWidth;
        const base = end - side * length;
        line([left, end], [left, base]);
        line([left, base], [right, base]);
        line([right, base], [right, end]);
      }
      if (level > 1) {
        const first = [midX - 3.66, grassY + 0.1, end];
        const second = [midX + 3.66, grassY + 0.1, end];
        const p = [first[0], first[1] + 2.44, end],
          q = [second[0], second[1] + 2.44, end];
        for (const [u, v] of [
          [first, p],
          [second, q],
          [p, q],
        ])
          beam(out, 'trim', u, v, 0.115, 0.115, colors.seatWhite);
      }
    }
    const circle = Array.from({ length: 24 }, (_, i) =>
      vector((i * fullTurn) / 24).map((p, axis) => p * 9.15 + d.pitchCenter[axis]),
    );
    circle.forEach((p, i) => line(p, circle[(i + 1) % circle.length]));
  }
  if (level > 1) {
    const innerLane = track.map((p) => scale(p, 0.851));
    for (let lane = 0; lane < 8; lane++) {
      const factor = (lane + 0.13) / 8;
      const a = interpolate(track, innerLane, factor);
      const b = interpolate(track, innerLane, factor + 0.004);
      concentric(out, 'ground', a, b, trackY + 0.017, trackY + 0.017, colors.border);
    }
  }
}

function drawBowl(out, level, envelope, track) {
  const first = track.map((p) => scale(p, 1.038));
  const bowl = (factor) => first.map((p, i) => blend(p, envelope[i], factor));
  const rings = [0, 0.4, 0.46, 0.49, 0.79].map(bowl);
  const heights = [grassY + 1.35, grassY + 11.15, grassY + 11.15, grassY + 13, grassY + 25.7];
  concentric(out, 'concrete', track, first, grassY + 0.05, grassY + 0.05, colors.apron);
  vertical(out, 'concrete', first, first, grassY + 0.08, heights[0], colors.concrete, -1);
  for (const [tier, start, end] of [
    [0, 0, 1],
    [1, 3, 4],
  ]) {
    const bands = level === 0 ? 1 : level === 1 ? 3 : level === 2 ? 6 : 15;
    for (let row = 0; row < bands; row++) {
      const front = row / bands,
        rear = (row + 1) / bands;
      const a = rings[start].map((p, i) => blend(p, rings[end][i], front));
      const b = rings[start].map((p, i) => blend(p, rings[end][i], rear));
      const low = mix(heights[start], heights[end], front);
      const high = mix(heights[start], heights[end], rear);
      const stepped = level > 1;
      band(
        out,
        'trim',
        a,
        b,
        stepped ? high : low,
        high,
        (i) => {
          const sector = Math.floor((i * d.sectors) / a.length);
          if (level > 1 && (i * d.sectors) % a.length < d.sectors) return colors.concrete;
          if (tier === 0) return row % 3 === 1 ? colors.lightRed : colors.red;
          return (sector + Math.floor(row / 3)) % 8 === 3
            ? colors.lightRed
            : row % 3 === 1
              ? colors.seatGray
              : colors.seatWhite;
        },
        () => up,
      );
      if (stepped)
        vertical(out, 'trim', a, a, low, high, tier === 0 ? colors.red : colors.seatGray, -1);
    }
  }
  concentric(out, 'concrete', rings[1], rings[2], heights[1], heights[2], colors.border);
  vertical(out, 'recess', rings[3], rings[3], heights[2], heights[3], colors.dark, -1);
}

function drawExterior(out, level, envelope) {
  const base = envelope.map((p) => scale(p, 0.788));
  const lower = envelope.map((p) => scale(p, 0.873));
  const upper = envelope.map((p) => scale(p, 0.925));
  const approach = envelope.map((p) => scale(p, 0.955));
  const concourse = grassY + 2.2,
    terrace = grassY + 12.1,
    overhang = grassY + 25.55;
  band(
    out,
    'concrete',
    approach,
    base,
    concourse - 0.45,
    concourse,
    () => colors.apron,
    () => up,
  );
  vertical(out, 'recess', base, base, grassY - 4.0, terrace, colors.recess);
  vertical(out, 'recess', base, lower, terrace, overhang, colors.dark);
  vertical(out, 'concrete', lower, lower, terrace - 0.95, terrace + 0.2, colors.concrete);
  vertical(out, 'concrete', upper, upper, overhang - 1.22, overhang + 0.48, colors.concrete);
  if (level > 0) {
    concentric(out, 'concrete', lower, base, terrace + 0.2, terrace + 0.2, colors.apron);
    concentric(out, 'concrete', upper, lower, overhang + 0.48, overhang + 0.48, colors.apron);
  }
  const columns = level === 0 ? 8 : level === 1 ? 36 : 96;
  for (let i = 0; i < columns; i++) {
    const p = radius(d.outline, vector((fullTurn * i) / columns));
    const footing = scale(p, 0.844);
    const foot = Math.min(concourse - 0.15, grade(footing) - 0.42);
    const joints =
      level < 2
        ? [at(footing, foot), at(scale(p, 0.917), overhang)]
        : [at(footing, foot), at(scale(p, 0.881), terrace + 0.1), at(scale(p, 0.917), overhang)];
    for (let j = 0; j < joints.length - 1; j++)
      beam(
        out,
        'concrete',
        joints[j],
        joints[j + 1],
        level === 0 ? 2.35 : 1.32,
        1.67,
        colors.concrete,
      );
  }
  if (level < 2) return;
  for (let gate = 0; gate < d.gates; gate++) {
    const angle = (fullTurn * (gate + 0.5)) / d.gates;
    const rays = [-0.028, 0.028].map((offset) => radius(d.outline, vector(angle + offset)));
    for (const [a, b] of [
      [0.874, 0.91],
      [0.91, 0.956],
      [0.956, 0.985],
    ]) {
      const lowerY = concourse - (1.7 * (a - 0.874)) / 0.111;
      const upperY = concourse - (1.7 * (b - 0.874)) / 0.111;
      wedge(
        out,
        'concrete',
        scale(rays[0], a),
        scale(rays[1], a),
        scale(rays[1], b),
        scale(rays[0], b),
        lowerY,
        upperY,
        up,
        colors.border,
      );
      for (const p of rays)
        beam(
          out,
          'trim',
          at(scale(p, a), lowerY + 1.05),
          at(scale(p, b), upperY + 1.05),
          0.105,
          0.13,
          colors.metal,
        );
    }
  }
}

function drawRoof(out, level, envelope) {
  const yOuter = grassY + d.roofEdge;
  const yInner = grassY + d.roofInner;
  const roof = (s) => envelope.map((p) => scale(p, s));
  const back = roof(0.936),
    knee = roof(0.755),
    inside = roof(0.598);
  const center = (p) => radial(p, -1);
  concentric(out, 'roof', envelope, back, yOuter, yOuter + 0.76, colors.edge);
  concentric(out, 'roof', back, knee, yOuter + 0.76, mix(yOuter, yInner, 0.56), colors.roof);
  band(
    out,
    'roof',
    knee,
    inside,
    mix(yOuter, yInner, 0.56),
    yInner,
    (i) => (i % 7 === 3 ? colors.roofAlt : colors.roof),
    () => up,
  );
  vertical(out, 'roof', envelope, envelope, yOuter - 1.12, yOuter, colors.edge);
  vertical(out, 'recess', inside, inside, yInner - 3.15, yInner, colors.metal, -1);
  if (level > 0) {
    concentric(out, 'recess', envelope, inside, yOuter - 1.12, yInner - 3.15, colors.recess, -1);
    for (let i = 0; i < envelope.length; i++) {
      if (i % (level === 1 ? 2 : 1)) continue;
      const a = inside[i],
        b = inside[(i + 1) % inside.length],
        tip = scale(blend(a, b, 0.5), 0.9975);
      face(
        out,
        'trim',
        [at(a, yInner - 2), at(b, yInner - 2), at(tip, yInner + 1.14)],
        center(a),
        colors.metal,
      );
      if (level > 1) {
        const e = envelope[i];
        beam(
          out,
          'trim',
          at(scale(e, 0.924), yOuter - 1.07),
          at(a, yInner - 2.2),
          0.29,
          0.34,
          colors.metal,
        );
        beam(
          out,
          'trim',
          at(knee[i], mix(yOuter, yInner, 0.56) - 0.93),
          at(tip, yInner - 0.21),
          0.17,
          0.19,
          colors.metal,
        );
      }
    }
  }
  if (level === 3) {
    for (let bank = 0; bank < 24; bank++) {
      const angle = ((bank + 0.5) * fullTurn) / 24;
      const rays = [-0.031, 0.031].map((offset) => radius(d.outline, vector(angle + offset)));
      for (const [a, b] of [
        [0.802, 0.826],
        [0.83, 0.854],
      ]) {
        const height = (s) =>
          mix(mix(yOuter, yInner, 0.56), yOuter + 0.76, (s - 0.755) / (0.936 - 0.755)) + 0.18;
        wedge(
          out,
          'trim',
          scale(rays[0], a),
          scale(rays[1], a),
          scale(rays[1], b),
          scale(rays[0], b),
          height(a),
          height(b),
          up,
          colors.solar,
        );
      }
    }
  }
}

function build(out, level) {
  const samples = [22, 60, 96, 120][level];
  const directions = Array.from({ length: samples }, (_, i) => vector((i * fullTurn) / samples));
  const envelope = mappedRing(d.outline, directions);
  const track = mappedRing(d.trackOutline, directions);
  const pitch = mappedRing(d.pitch, directions);
  drawTrack(out, level, track, pitch);
  drawBowl(out, level, envelope, track);
  drawExterior(out, level, envelope);
  drawRoof(out, level, envelope);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'gelora-bung-karno-stadium-model.mjs';
const camera = [365, 238, 361],
  lookAt = [0, grassY + 11, 0];
const lods = { district: 1.37, street: 0.52, closeup: 0.16 };
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'An independent terrain reading outside the stadium fixes the ground reference. The model includes a level sports surface registered to the mapped bowl.',
  brief:
    'Jakarta’s main stadium, with a pale continuous temu gelang canopy, tiered red and white seating and an open concrete colonnade around the football pitch and running track.',
  surfaces,
  build: closeup,
  limitations: plan.limitations,
  camera,
  lookAt,
  sunDirection: [-105, 155, 102],
  mediumFiContext: {
    scale: 1,
    groundY: grassY + 2,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.86,
    basis: 'The named main stadium perimeter bounds building replacement at the stadium only.',
  },
  groundCutout: {
    outline: d.outline.map((p) => scale(p, 0.844)),
    minHeight: grassY - 0.95,
    basis:
      'The mapped inner bowl clearance preserves the built field and seating while retaining the source terrain and the surrounding approaches.',
  },
  embeddedCanonicalGraphs: ['concrete_plain', 'metal_standing_seam'],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'ring-and-open-bowl', position: [245, 228, 188], lookAt },
    {
      name: 'concrete-concourse-and-overhang',
      position: [180, grassY + 14.5, 103],
      lookAt: [80, grassY + 16.8, 38],
    },
    {
      name: 'two-tiers-and-track',
      position: [-30, grassY + 22, -52],
      lookAt: [15, grassY + 12, 68],
    },
    {
      name: 'roof-structure',
      position: [-195, grassY + 110, -105],
      lookAt: [-36, grassY + 26, -20],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'gelora-bung-karno-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 2.95,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(lods).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
};
