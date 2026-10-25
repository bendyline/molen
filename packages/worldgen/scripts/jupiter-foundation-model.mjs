/** Photographic draft of the exposed Capitoline Jupiter tufa foundation wall.
 * Course dimensions and broken profiles are interpreted; this is not a surveyed
 * plan of the complete buried temple. Geographic activation stays disabled.
 */
export const jupiterCandidateId = 'temple_of_jupiter_optimus_maximus';

function stone(face, role, x, y, z, width, height, depth, seed, chipped) {
  const cut = chipped ? 0.08 + (seed % 5) * 0.016 : 0;
  const ring = cut
    ? [
        [-width / 2 + cut, -depth / 2],
        [width / 2 - cut, -depth / 2],
        [width / 2, -depth / 2 + cut],
        [width / 2, depth / 2 - cut],
        [width / 2 - cut, depth / 2],
        [-width / 2 + cut, depth / 2],
        [-width / 2, depth / 2 - cut],
        [-width / 2, -depth / 2 + cut],
      ]
    : [
        [-width / 2, -depth / 2],
        [width / 2, -depth / 2],
        [width / 2, depth / 2],
        [-width / 2, depth / 2],
      ];
  const top = ring.map(([u, v], i) => [
    x + u,
    y + height - (chipped ? ((seed + i * 7) % 5) * 0.012 : 0),
    z + v,
  ]);
  const bottom = ring.map(([u, v]) => [x + u, y, z + v]);
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    face(
      role,
      [bottom[i], bottom[j], top[j], top[i]],
      [ring[j][1] - ring[i][1], 0, ring[i][0] - ring[j][0]],
    );
  }
  face(role, bottom, [0, -1, 0]);
  face(role, top, [0, 1, 0]);
}

/** Lower levels keep the same stepped silhouette, replacing stone joints by mass. */
export function buildJupiterFoundations(face, detail, reconstruction) {
  const rows = reconstruction.rows;
  for (const [ri, row] of rows.entries()) {
    const y = ri * reconstruction.courseHeight;
    for (const [start, end] of row.spans ?? [[row.start, row.end]]) {
      if (detail < 2) {
        stone(
          face,
          'tuff',
          (start + end) / 2,
          y,
          row.z,
          end - start,
          reconstruction.courseHeight,
          row.depth,
          ri,
          false,
        );
        continue;
      }
      const nominal = ri % 2 ? 1.08 : 1.34;
      let x = start;
      let bi = 0;
      while (x < end - 0.04) {
        const width = Math.min(end - x, nominal + (((ri * 13 + bi * 7) % 7) - 3) * 0.05);
        const seed = ri * 103 + bi * 17;
        const joint = 0.018;
        stone(
          face,
          'tuff',
          x + width / 2,
          y,
          row.z,
          width - joint,
          reconstruction.courseHeight - joint,
          row.depth,
          seed,
          detail >= 3,
        );
        x += width;
        bi++;
      }
    }
  }
  // Low parallel remnant and a short perpendicular return are observed in the
  // photographs. Their relative dimensions remain explicitly draft estimates.
  for (const [index, remnant] of reconstruction.remnants.entries()) {
    const levels = detail < 2 ? 1 : remnant.courses;
    for (let course = 0; course < levels; course++) {
      const h = (remnant.courses * reconstruction.courseHeight) / levels;
      stone(
        face,
        'tuff',
        remnant.x,
        course * h,
        remnant.z,
        remnant.width,
        h - (detail >= 2 ? 0.018 : 0),
        remnant.depth,
        index * 19 + course,
        detail >= 3,
      );
    }
  }
}
