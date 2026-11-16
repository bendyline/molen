import {
  block,
  closed,
  face,
  mix,
  pairs,
  palette,
  pavilion,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  stone: surface('wall', 'stone_ashlar', 0.94),
  footing: surface('foundation', 'stone_basalt_raw', 0.95),
  coping: surface('roof', 'stone_granite', 0.92),
  concrete: surface('wall', 'concrete_plain', 0.94),
  steel: surface('trim', 'metal_painted', 0.72, 0.12),
};
const colors = palette({
  masonry: '8e897d',
  foundation: '77766a',
  coping: 'ada694',
  concrete: 'a29e91',
  damp: '777a6f',
  steel: '67716d',
});

function outlineDepth(outline, x) {
  const hits = pairs(closed(outline))
    .filter(([a, b]) => x >= Math.min(a[0], b[0]) && x < Math.max(a[0], b[0]))
    .map(([a, b]) => mix(a[1], b[1], (x - a[0]) / (b[0] - a[0])));
  return [Math.min(...hits), Math.max(...hits)];
}

function crossSection(x, crest, outline, grade) {
  const [upstream, downstream] = outlineDepth(outline, x);
  const depth = downstream - upstream;
  const coping = Math.min(upstream + depth * 0.39, -5.4);
  const toe = upstream + depth * 0.91;
  const foot = Math.min(crest - 1.1, grade([x, toe]) + 0.4);
  const bottom = Math.min(foot - 1.25, grade([x, upstream]) - 0.75);
  const slope = [
    [0.13, 0.18],
    [0.29, 0.34],
    [0.52, 0.61],
    [0.76, 0.83],
  ].map(([distance, drop]) => {
    const z = mix(coping, toe, distance);
    const surveySkin = Math.min(crest - 0.12, grade([x, z]) + 0.8);
    return [Math.max(mix(crest, foot, drop), surveySkin), z];
  });
  return [
    [bottom, upstream],
    [crest - 0.22, upstream],
    [crest, upstream + depth * 0.025],
    [crest, coping],
    ...slope,
    [foot, toe],
    [Math.min(foot, grade([x, downstream]) + 0.18), downstream],
    [bottom, downstream],
  ].map(([y, z]) => [x, y, z]);
}

function spillwayWall(out, lod, dims, grade) {
  const {
    outline,
    loweredCrestY,
    raisedCrestY,
    northSpillwayX: [start, end],
  } = dims;
  const corners = outline.map(([x]) => x).sort((a, b) => a - b);
  const left = corners[0] + 0.035;
  const right = corners.at(-1) - 0.035;
  const transitions = [start - 0.4, start, end, end + 0.4];
  const stations = [
    left,
    ...[...corners.slice(1, -1), ...transitions].sort((a, b) => a - b),
    right,
  ];
  const gap = [20, 11, 6, 3][lod];
  const xs = [left];
  for (const [a, b] of pairs(stations)) {
    const steps = Math.ceil((b - a) / gap);
    for (let i = 1; i <= steps; i++) xs.push(mix(a, b, i / steps));
  }
  const rise = (x) => Math.min(1, Math.max(0, (start - x) / 0.4, (x - end) / 0.4));
  const sections = xs.map((x) =>
    crossSection(x, mix(loweredCrestY, raisedCrestY, rise(x)), outline, grade),
  );
  for (const [a, b] of pairs(sections)) {
    for (let i = 0; i < a.length; i++) {
      const j = (i + 1) % a.length;
      const [slot, tint] =
        i === 1 || i === 2
          ? ['coping', colors.coping]
          : i === 0 || i >= 9
            ? ['footing', colors.foundation]
            : ['stone', colors.masonry];
      const normal = i < 2 ? [0, 0, -1] : i === 9 ? [0, 0, 1] : i === 10 ? [0, -1, 0] : up;
      face(out, slot, [a[i], b[i], b[j], a[j]], normal, tint);
    }
  }
  for (const [profile, normal] of [
    [sections[0], [-1, 0, 0]],
    [sections.at(-1), [1, 0, 0]],
  ]) {
    for (const [a, b] of pairs(profile.slice(1))) {
      face(out, 'footing', [profile[0], a, b], normal, colors.foundation);
    }
  }
}

function basin(out, lod, { estimatedPool }, grade) {
  const { southX, northX, zStart, zEnd } = estimatedPool;
  const width = northX - southX;
  const length = zEnd - zStart;
  const basinFloor = grade([0, 13]) + 0.05;
  const wallTop = basinFloor + 2.05;
  block(out, 'concrete', southX, basinFloor - 0.75, zStart, width, 0.79, length, colors.damp);
  for (const x of [southX, northX - 0.45]) {
    block(out, 'concrete', x, basinFloor - 0.65, zStart, 0.45, 2.7, length, colors.concrete);
    block(out, 'coping', x - 0.065, wallTop - 0.09, zStart, 0.58, 0.15, length, colors.coping);
    if (lod === 0) continue;
    const bar = x + 0.2;
    block(out, 'steel', bar, wallTop + 0.89, zStart + 0.2, 0.05, 0.05, length - 0.4, colors.steel);
    if (lod > 1)
      block(
        out,
        'steel',
        bar,
        wallTop + 0.51,
        zStart + 0.2,
        0.038,
        0.038,
        length - 0.4,
        colors.steel,
      );
    const postCount = [0, 3, 5, 8][lod];
    for (let i = 0; i < postCount; i++) {
      const z = mix(zStart + 0.25, zEnd - 0.25, i / (postCount - 1));
      block(out, 'steel', bar, wallTop, z, 0.048, 0.91, 0.048, colors.steel);
    }
  }
  block(
    out,
    'concrete',
    southX,
    basinFloor - 0.65,
    zEnd - 0.45,
    width,
    1.24,
    0.55,
    colors.concrete,
  );
}

function draw(out, lod, dimensions, grade) {
  spillwayWall(out, lod, dimensions, grade);
  basin(out, lod, dimensions, grade);
}

const dam = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [32, 45, 105],
    lookAt: [0, -5, 6],
    yaw: -0.45,
    brief:
      'Tai Tam Intermediate Reservoir Dam with a lowered north spillway and downstream concrete stilling basin.',
    views: [
      { name: 'north-spillway-and-crest', position: [14, 23, 44], lookAt: [4, 1, -4] },
      { name: 'downstream-pond-and-rails', position: [-13, 1, 39], lookAt: [0, -13, 13] },
      { name: 'reservoir-shoulders-and-shoreline', position: [17, 57, -43], lookAt: [0, -2, 1] },
    ],
  },
  draw,
);
export const { model, skyline, district, street, closeup } = dam;
model.category = 'industrial';
model.mediumFiContext.scale = 1.14;
model.sourceLicense =
  'Independent reconstruction from OpenStreetMap, Hong Kong survey terrain and official written heritage facts.';
