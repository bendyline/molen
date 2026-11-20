import {
  areaSign,
  block,
  cap,
  closed,
  edge,
  face,
  palette,
  pairs,
  panel,
  pavilion,
  rect,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  concrete: surface('wall', 'concrete_plain'),
  crown: surface('roof', 'concrete_plain', 0.74),
  panel: surface('wall', 'metal_corrugated', 0.82, 0.05),
  roof: surface('roof', 'metal_standing_seam', 0.75, 0.09),
  footing: surface('foundation', 'concrete_plain'),
  flashing: surface('trim', 'metal_painted', 0.69, 0.11),
  window: surface('window', 'window_punched', 0.62),
};

const colors = palette({
  dome: 'd6d4ca',
  drum: 'cbc9bf',
  drumBase: 'b0afa6',
  hall: '98766a',
  hallRib: 'a08477',
  link: 'aaa89d',
  east: 'b3a99c',
  base: '8c8b81',
  roof: '989c99',
  edge: 'c0beb1',
  glass: '697676',
});

function dome(out, lod, { domeCenter: [cx, cz], domeRadius: radius, domeHeight }, grade) {
  const segments = [18, 30, 48, 72][lod];
  const courses = [5, 8, 12, 18][lod];
  const spring = 32;
  const point = (angle, y, r) => [cx + r * Math.cos(angle), y, cz + r * Math.sin(angle)];
  const arch = (angle, i) => {
    const latitude = (i * Math.PI) / (2 * courses);
    return point(
      angle,
      spring + (domeHeight - spring) * Math.sin(latitude),
      radius * Math.cos(latitude),
    );
  };
  const shoulder = radius * 1.007;
  for (let i = 0; i < segments; i++) {
    const a = (i * 2 * Math.PI) / segments;
    const b = ((i + 1) * 2 * Math.PI) / segments;
    const mid = (a + b) / 2;
    const outward = [Math.cos(mid), 0, Math.sin(mid)];
    const foot = (angle) => {
      const [x, , z] = point(angle, 0, radius);
      return [x, grade([x, z]) - 0.32, z];
    };
    face(
      out,
      'footing',
      [foot(a), foot(b), point(b, 3, radius), point(a, 3, radius)],
      outward,
      colors.drumBase,
    );
    face(
      out,
      'concrete',
      [
        point(a, 3, radius),
        point(b, 3, radius),
        point(b, spring - 0.58, radius),
        point(a, spring - 0.58, radius),
      ],
      outward,
      colors.drum,
    );
    face(
      out,
      'concrete',
      [
        point(a, spring - 0.58, radius),
        point(b, spring - 0.58, radius),
        point(b, spring, shoulder),
        point(a, spring, shoulder),
      ],
      outward,
      colors.dome,
    );
    for (let j = 0; j < courses - 1; j++) {
      const lowerA = j === 0 ? point(a, spring, shoulder) : arch(a, j);
      const lowerB = j === 0 ? point(b, spring, shoulder) : arch(b, j);
      face(
        out,
        'crown',
        [lowerA, lowerB, arch(b, j + 1), arch(a, j + 1)],
        [outward[0], 1, outward[2]],
        colors.dome,
      );
    }
    face(
      out,
      'crown',
      [arch(a, courses - 1), arch(b, courses - 1), [cx, domeHeight, cz]],
      up,
      colors.dome,
    );
  }
}

function range(out, grade, lod, { outline, roof, color, glazing = false, ribbed = false }) {
  const ground = ([x, z]) => grade([x, z]) - 0.29;
  const corners = pairs(closed(outline));
  const sign = areaSign(outline);
  shell(out, outline, ground, roof, {
    wall: ribbed ? 'panel' : 'concrete',
    color,
    roof: 'roof',
    roofColor: colors.roof,
  });
  for (const [a, b] of corners) {
    const side = edge(a, b, sign);
    const length = side.length;
    face(
      out,
      'footing',
      [
        side.p(0, ground(a), 0.07),
        side.p(length, ground(b), 0.07),
        side.p(length, 1, 0.07),
        side.p(0, 1, 0.07),
      ],
      side.normal,
      colors.base,
    );
    panel(out, 'flashing', side, 0, length, roof - 0.51, roof + 0.22, 0.12, colors.edge);
    if (glazing && length >= 12) {
      panel(out, 'window', side, 2.5, length - 2.5, roof - 5.5, roof - 4.28, 0.13, colors.glass);
      if (lod >= 2) {
        for (let x = 4; x < length - 3; x += lod === 2 ? 5.8 : 2.9)
          panel(
            out,
            'flashing',
            side,
            x - 0.09,
            x + 0.09,
            roof - 5.53,
            roof - 4.23,
            0.15,
            colors.edge,
          );
      }
    }
    if (ribbed && lod >= 2) {
      const end = glazing ? roof - 5.66 : roof - 0.65;
      for (let x = 1.5; x < length - 0.7; x += lod === 2 ? 6 : 2)
        panel(out, 'panel', side, x - 0.17, x + 0.17, 1.25, end, 0.14, colors.hallRib);
    }
  }
  if (lod >= 2) cap(out, 'flashing', outline, roof + 0.04, colors.roof);
}

function draw(out, lod, controls, grade) {
  const ranges = [
    {
      outline: rect(34.9, -16.45, 116.05, 33.16),
      roof: 24.5,
      color: colors.hall,
      glazing: true,
      ribbed: true,
    },
    { outline: rect(7.4, -29.9, 52, 27.85), roof: 13.85, color: colors.link, glazing: true },
    { outline: rect(9.8, -69.02, 74, -49.92), roof: 12.3, color: colors.east, glazing: true },
    { outline: rect(-13.93, -90.7, 1.73, -37.6), roof: 8.3, color: colors.east },
    { outline: rect(2.1, -48.5, 33, -26), roof: 10.1, color: colors.link },
    { outline: rect(36, 26.9, 52.05, 37.55), roof: 10, color: colors.east },
  ];
  dome(out, lod, controls, grade);
  for (const form of ranges) range(out, grade, lod, form);
  block(out, 'flashing', 47, 24.5, 6.4, 53, 0.74, 2.5, colors.edge);
  if (lod > 0) block(out, 'flashing', 46.6, 25.24, 6.29, 53.8, 0.22, 2.72, colors.roof);
}

const exterior = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [-146, 83, 117],
    lookAt: [35, 18, -13],
    yaw: -0.94,
    sun: [-430, 640, 330],
    brief:
      'Borssele’s pale concrete dome with low utility ranges and a rust-brown industrial hall in Zeeland.',
    views: [
      { name: 'estuary-side-dome-and-hall', position: [-117, 35, 105], lookAt: [27, 17, -2] },
      { name: 'dome-and-low-link', position: [-61, 47, -80], lookAt: [8, 24, -1] },
      { name: 'long-hall-facade-and-estuary', position: [127, 43, 112], lookAt: [53, 16, 6] },
      { name: 'dome-and-roofline-overview', position: [-83, 175, 20], lookAt: [30, 13, -20] },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = exterior;
export const model = {
  ...exterior.model,
  category: 'industrial',
  sourceLicense:
    'Independent medium-fi exterior based on the named Dutch building outline, original terrain and written exterior facts.',
};
