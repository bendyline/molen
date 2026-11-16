import {
  areaSign,
  edge,
  face,
  mix,
  pairs,
  palette,
  pavilion,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  earth: surface('foundation', 'stone_sandstone_raw', 0.99),
  adobe: surface('wall', 'earth_adobe', 0.98),
  weathered: surface('roof', 'clay_fired', 0.98),
  recess: surface('trim', 'stone_sandstone', 0.98),
};
const colors = palette({
  talus: '9d7e70',
  chineh: 'a78a76',
  adobe: 'a18171',
  bright: 'a98876',
  crest: 'a58775',
  cut: '896a58',
  shadow: '725746',
});

function heightAt(controls, fraction) {
  const right = controls.findIndex(([t]) => t >= fraction);
  if (right === 0) return controls[0][1];
  if (right < 0) return controls.at(-1)[1];
  const [[from, low], [to, high]] = controls.slice(right - 1, right + 1);
  return mix(low, high, (fraction - from) / (to - from));
}

function intervals(length, gaps) {
  const breaks = gaps.flatMap(([fraction, width]) => [
    fraction * length - width / 2,
    fraction * length + width / 2,
  ]);
  const bounds = [0, ...breaks, length];
  return Array.from({ length: bounds.length / 2 }, (_, i) => bounds.slice(2 * i, 2 * i + 2));
}

function position(wall, along, outward, grade) {
  const [x, , z] = wall.p(along, 0, outward);
  return grade([x, z]);
}

function wallProfile(wall, distance, extent, variation, grade, lod) {
  const { width, upperWidth, tall } = extent;
  const lobe = variation * (lod > 1 ? 1 : 0.54);
  const outer = -1.4 + lobe * 1.09;
  const inner = outer - width * (1 + lobe * 0.014);
  const oldGround =
    0.57 * position(wall, distance, outer + 23, grade) +
    0.43 * position(wall, distance, inner - 20, grade);
  const base = Math.min(
    oldGround - 1.75,
    position(wall, distance, outer, grade) - 1.05,
    position(wall, distance, inner, grade) - 0.85,
  );
  const shoulder = oldGround + Math.min(5.9, tall * (0.51 + 0.055 * lobe));
  const crest = oldGround + tall;
  const upperHalf = Math.min(width * 0.42, upperWidth * (0.38 + 0.023 * lobe));
  const center = (outer + inner) / 2 + lobe * 0.58;

  return [
    wall.p(distance, base, outer),
    wall.p(distance, shoulder, center + upperHalf),
    wall.p(
      distance,
      crest - Math.min(0.63 + 0.32 * Math.abs(lobe), tall * 0.21),
      center + upperHalf * 0.62,
    ),
    wall.p(distance, crest, center + lobe * 0.18),
    wall.p(distance, crest - Math.min(0.52, tall * 0.22), center - upperHalf * 0.63),
    wall.p(distance, shoulder - Math.min(0.57, tall * 0.14), center - upperHalf),
    wall.p(distance, base, inner),
  ];
}

function closeSection(out, section, tangent) {
  // The cross-section is convex on each half. Keep the central crest as the fan anchor.
  for (const [i, j] of [
    [0, 1],
    [1, 2],
    [4, 5],
    [5, 6],
    [6, 0],
  ]) {
    face(out, 'earth', [section[3], section[i], section[j]], tangent, colors.cut);
  }
}

function curtain(out, lod, wall, control, index, dims, grade) {
  const { crests, gaps } = control;
  const opaque = [1, 1, 1, 1, -1, -1];
  const components = ['earth', 'adobe', 'weathered', 'weathered', 'adobe', 'earth'];
  const spacing = [91, 32, 14, 6.6][lod];
  const circuit = intervals(wall.length, gaps);
  for (const [start, end] of circuit) {
    const count = Math.ceil((end - start) / spacing);
    const sections = Array.from({ length: count + 1 }, (_, j) => {
      const along = mix(start, end, j / count);
      const center = heightAt(crests, along / wall.length);
      const undulation =
        Math.sin(along * 0.064 + index) * 0.94 + Math.sin(along * 0.113 + index * 2.1) * 0.61;
      const grain = Math.sin(along * 0.27 + 1.3) * (lod > 1 ? 0.47 : 0.12);
      const toGap = Math.min(
        start === 0 ? wall.length : along - start,
        end === wall.length ? wall.length : end - along,
      );
      const cut = Math.min(1, 0.32 + toGap * (index === 1 ? 0.08 : 0.043));
      const tall = Math.max(
        1.1,
        Math.min(dims.maximumSurvivingHeight, (center + undulation + grain) * cut),
      );
      return wallProfile(
        wall,
        along,
        {
          width: dims.wallBaseWidth * (0.68 + 0.3 * Math.min(1, tall / 8)),
          upperWidth: dims.upperWallWidth,
          tall,
        },
        undulation + grain,
        grade,
        lod,
      );
    });
    for (const [i, [a, b]] of pairs(sections).entries()) {
      for (const [k, component] of components.entries()) {
        const orient = k === 2 || k === 3 ? up : wall.normal.map((v) => v * opaque[k]);
        const color =
          k === 0 || k === 5
            ? colors.chineh
            : k === 2 || k === 3
              ? colors.crest
              : (i + k) % 5 === 0
                ? colors.bright
                : colors.adobe;
        face(out, component, [a[k], b[k], b[k + 1], a[k + 1]], orient, color);
      }
    }
    const tangent = [-wall.normal[2], 0, wall.normal[0]];
    closeSection(out, sections[0], tangent);
    closeSection(
      out,
      sections.at(-1),
      tangent.map((v) => -v),
    );
  }
}

function slopeTower(out, lod, wall, along, profile, grade) {
  const { height, radius, seed } = profile;
  const segments = [5, 7, 10, 14][lod];
  const d = -6.4;
  const footing = position(wall, along, d + radius + 13, grade);
  const tip = footing + height;
  const width = [radius, radius * 0.77, radius * 0.61, radius * 0.37];
  const levels = [footing - 1.9, footing + height * 0.36, tip - height * 0.19, tip];
  const arc = Array.from({ length: segments + 1 }, (_, i) => {
    const a = (Math.PI * i) / segments;
    const wobble = 1 + 0.085 * Math.sin(a * 5.8 + seed);
    return {
      normal: [Math.cos(a), Math.sin(a)],
      rings: levels.map((y, j) =>
        wall.p(
          along + width[j] * Math.cos(a) * wobble,
          y + (j ? Math.sin(a * 2.7 + seed) * 0.45 : 0),
          d + width[j] * Math.sin(a) * wobble,
        ),
      ),
    };
  });
  for (const [a, b] of pairs(arc)) {
    const rise = a.normal[1] + b.normal[1],
      alongDirection = a.normal[0] + b.normal[0];
    const n = [
      wall.normal[0] * rise - wall.normal[2] * alongDirection,
      0,
      wall.normal[2] * rise + wall.normal[0] * alongDirection,
    ];
    for (let j = 0; j < levels.length - 1; j++) {
      face(
        out,
        j ? 'adobe' : 'earth',
        [a.rings[j], b.rings[j], b.rings[j + 1], a.rings[j + 1]],
        n,
        j ? colors.adobe : colors.talus,
      );
    }
    face(out, 'weathered', [a.rings[3], b.rings[3], wall.p(along, tip - 0.2, d)], up, colors.crest);
  }
  if (lod > 1 && height > 8) {
    // Narrow breaks beneath the crowns of a few of the best-preserved lobes.
    const exterior = d + radius * 0.6;
    const lip = footing + height * 0.65;
    const slit = 0.7 + 0.19 * Math.sin(seed);
    const a = wall.p(along - slit * 0.53, lip - 0.21, exterior);
    const b = wall.p(along + slit * 0.53, lip - 0.23, exterior);
    const c = wall.p(along + slit * 0.43, lip + 0.46, exterior - 0.16);
    const e = wall.p(along - slit * 0.36, lip + 0.58, exterior - 0.16);
    face(out, 'recess', [a, b, c, e], wall.normal, colors.shadow);
  }
}

function draw(out, lod, dims, grade) {
  const { outline, sides, towerSpacing } = dims;
  const sign = areaSign(outline);
  for (const [i, control] of sides.entries()) {
    const wall = edge(outline[i], outline[(i + 1) % outline.length], sign);
    curtain(out, lod, wall, control, i, dims, grade);
    if (!lod) continue;
    const increments = lod === 1 ? 5 : lod === 2 ? 3 : 2;
    for (let j = 1; j * towerSpacing < wall.length - 12; j += increments) {
      const along = j * towerSpacing + Math.sin(j * 1.91 + i) * 2.1;
      const fraction = along / wall.length;
      if (
        control.gaps.some(([gate, width]) => Math.abs(gate * wall.length - along) < width / 2 + 11)
      )
        continue;
      const crown = heightAt(control.crests, fraction);
      if (crown < (i < 2 ? 7 : 5.6)) continue;
      const seed = j * 1.7 + i * 3.35;
      slopeTower(
        out,
        lod,
        wall,
        along,
        {
          seed,
          radius: 6.67 + 1.92 * Math.sin(seed),
          height: Math.min(dims.maximumSurvivingHeight, crown + Math.sin(seed * 1.44) * 1.45),
        },
        grade,
      );
    }
    if (i === 1) {
      const [fraction, width] = control.gaps[0];
      const center = fraction * wall.length;
      for (const shift of [-1, 1]) {
        slopeTower(
          out,
          lod,
          wall,
          center + shift * (width / 2 + 10.3),
          {
            seed: shift,
            radius: 8.85,
            height: shift < 0 ? 11.9 : 12.8,
          },
          grade,
        );
      }
    }
  }
}

const fort = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [1640, 1590, 1870],
    lookAt: [0, 4, 0],
    yaw: 0.81,
    brief:
      'The standing Sasanian ruin at Iraj Castle above the fields of Pishva. Eroded clay ramparts, projecting round tower remnants and the complete open enclosure.',
    views: [
      { name: 'southwestern-mudbrick-curtain', position: [-211, 9, 754], lookAt: [-122, 9, 717] },
      { name: 'southeast-gate-sector', position: [755, 29, 111], lookAt: [640, 7, 21] },
      { name: 'complete-earthen-enceinte', position: [1120, 1680, -1250], lookAt: [0, 4, 0] },
    ],
  },
  draw,
);
export const { model, skyline, district, street, closeup } = fort;
model.category = 'fortification';
model.mediumFiContext.focus = { center: [-167, 5, 720] };
