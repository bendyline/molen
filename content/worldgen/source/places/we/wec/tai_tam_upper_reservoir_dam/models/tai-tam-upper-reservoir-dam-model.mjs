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
  stone: surface('wall', 'stone_ashlar', 0.96),
  backing: surface('foundation', 'stone_basalt_raw', 0.97),
  coping: surface('roof', 'stone_granite', 0.9),
  road: surface('roof', 'concrete_plain', 0.94),
  rails: surface('trim', 'metal_painted', 0.73, 0.12),
};
const colors = palette({
  stone: '8d8878',
  extension: 'a09987',
  dressed: 'a8a18e',
  bed: '8b8a7d',
  seal: '78796e',
  rail: '737d76',
});

function boundsAt(outline, x) {
  const crossings = pairs(closed(outline))
    .filter(([a, b]) => x >= Math.min(a[0], b[0]) && x < Math.max(a[0], b[0]))
    .map(([a, b]) => mix(a[1], b[1], (x - a[0]) / (b[0] - a[0])));
  return [Math.min(...crossings), Math.max(...crossings)];
}

function crossSection(x, dims, grade) {
  const { outline, crestY, faceHeightMeters } = dims;
  const [head, tail] = boundsAt(outline, x);
  const span = tail - head;
  const crestZ = Math.min(tail - span * 0.48, Math.max(head + span * 0.22, -3.45));
  const toeZ = Math.min(tail - span * 0.03, Math.max(crestZ + span * 0.38, 14.5));
  const toeY = Math.max(
    crestY - faceHeightMeters,
    Math.min(crestY - 1.94, grade([x, toeZ]) + 0.57),
  );
  const apronY = Math.min(toeY - 0.04, grade([x, tail]) + 0.14);
  const footing = Math.min(toeY - 3, apronY - 1.6, grade([x, head]) - 0.68);
  const slope = [
    [0.069, 0.135],
    [0.24, 0.23],
    [0.43, 0.4],
    [0.67, 0.6],
    [0.82, 0.81],
  ].map(([distance, drop]) => {
    const z = mix(crestZ, toeZ, distance);
    // The elevation survey includes the dam. Keep a shallow masonry skin over its measured face.
    const faceY = Math.min(crestY - 0.1, grade([x, z]) + 0.7);
    return [z, Math.max(mix(crestY, toeY, drop), faceY)];
  });
  const section = [
    [head, footing],
    [head, crestY - 0.24],
    [head + span * 0.017, crestY],
    [crestZ, crestY],
    ...slope,
    [toeZ, toeY],
    [tail, apronY],
    [tail, footing],
  ];
  return section.map(([z, y]) => [x, y, z]);
}

function gravityWall(out, lod, dims, grade) {
  const edgeXs = dims.outline.map(([x]) => x).sort((a, b) => a - b);
  const first = edgeXs[0] + 0.025,
    last = edgeXs.at(-1) - 0.025;
  const stations = [first, ...edgeXs.slice(1, -1), last];
  const gap = [30, 14, 7, 3.5][lod];
  const xs = [first];
  for (const [a, b] of pairs(stations)) {
    const steps = Math.ceil((b - a) / gap);
    for (let i = 1; i <= steps; i++) xs.push(mix(a, b, i / steps));
  }
  const sections = xs.map((x) => crossSection(x, dims, grade));
  const surfaceNames = [
    'backing',
    'coping',
    'road',
    'coping',
    'stone',
    'stone',
    'stone',
    'stone',
    'stone',
    'road',
    'backing',
  ];
  const surfaceColors = [
    colors.seal,
    colors.dressed,
    colors.bed,
    colors.extension,
    colors.stone,
    colors.stone,
    colors.stone,
    colors.stone,
    colors.stone,
    colors.bed,
    colors.seal,
  ];
  for (const [a, b] of pairs(sections)) {
    for (let i = 0; i < surfaceNames.length; i++) {
      const normal = i < 2 ? [0, 0, -1] : i === 10 ? [0, 0, 1] : up;
      face(out, surfaceNames[i], [a[i], b[i], b[i + 1], a[i + 1]], normal, surfaceColors[i]);
    }
    face(out, 'backing', [a.at(-1), b.at(-1), b[0], a[0]], [0, -1, 0], colors.seal);
  }
  for (const [profile, normal] of [
    [sections[0], [-1, 0, 0]],
    [sections.at(-1), [1, 0, 0]],
  ]) {
    for (const [a, b] of pairs(profile.slice(1))) {
      face(out, 'backing', [profile[0], a, b], normal, colors.seal);
    }
  }
}

function crestWalk(out, lod, { crestY, crestWalkZ, mainCrestLengthMeters }) {
  const left = -63.8,
    right = left + mainCrestLengthMeters;
  const width = right - left;
  for (const z of crestWalkZ) {
    block(out, 'coping', left, crestY - 0.08, z - 0.11, width, 0.25, 0.22, colors.dressed);
    block(out, 'rails', left, crestY + 1.02, z - 0.028, width, 0.047, 0.056, colors.rail);
    if (lod > 0)
      block(out, 'rails', left, crestY + 0.62, z - 0.023, width, 0.038, 0.046, colors.rail);
    const count = [8, 18, 34, 49][lod];
    for (let i = 0; i < count; i++) {
      const x = mix(left + 0.11, right - 0.11, i / (count - 1));
      block(out, 'rails', x - 0.022, crestY + 0.14, z - 0.024, 0.044, 0.91, 0.048, colors.rail);
      if (lod > 1)
        block(out, 'rails', x - 0.105, crestY + 0.143, z - 0.052, 0.21, 0.047, 0.104, colors.rail);
    }
  }
}

function draw(out, lod, dims, grade) {
  gravityWall(out, lod, dims, grade);
  crestWalk(out, lod, dims);
}

const dam = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [37, 63, 136],
    lookAt: [0, -7.3, 4],
    yaw: -0.53,
    brief:
      'Tai Tam Upper Reservoir Dam, a tall granite-faced gravity wall with dressed crest and inspection rails. The downstream slope leads into the mapped valley.',
    views: [
      { name: 'upper-dam-downstream-face', position: [9, 14, 68], lookAt: [0, -11, 3] },
      { name: 'crest-rails-and-shoulder', position: [-33, 22, 38], lookAt: [-10, -1, -3] },
      { name: 'upper-reservoir-dam-from-above', position: [9, 73, -55], lookAt: [0, -4, 2] },
    ],
  },
  draw,
);
export const { model, skyline, district, street, closeup } = dam;
model.category = 'industrial';
model.mediumFiContext.scale = 1.17;
model.sourceLicense =
  'Independent reconstruction from OpenStreetMap, Hong Kong Lands Department source terrain and written heritage records.';
