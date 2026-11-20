/** Photographic draft of the exposed Capitoline Jupiter tufa foundation wall.
 * Course dimensions and broken profiles are interpreted; this is not a surveyed
 * plan of the complete buried temple. Geographic activation stays disabled.
 */
export const jupiterCandidateId = 'temple_of_jupiter_optimus_maximus';

function stone(face, role, x, y, z, width, height, depth, seed, chipped, shade = 1) {
  const cut = chipped ? Math.min(width * 0.22, depth * 0.22, 0.06 + (seed % 5) * 0.019) : 0;
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
    y + height - (chipped ? ((seed + i * 7) % 5) * 0.017 : 0),
    z + v,
  ]);
  const bottom = ring.map(([u, v]) => [x + u, y, z + v]);
  const tone = shade * (chipped ? 0.88 + ((seed * 7) % 13) * 0.017 : 1);
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    face(
      role,
      [bottom[i], bottom[j], top[j], top[i]],
      [ring[j][1] - ring[i][1], 0, ring[i][0] - ring[j][0]],
      tone,
    );
  }
  face(role, bottom, [0, -1, 0], tone);
  face(role, top, [0, 1, 0], tone);
}

function course(face, { start, end, y, z, depth, height, row }, detail) {
  if (detail < 2) {
    stone(face, 'tuff', (start + end) / 2, y, z, end - start, height, depth, row, false);
    return;
  }
  // The exposed ashlar fronts are bonded into a rough stone core behind the joints.
  const base = Math.max(0, y - 0.06);
  stone(
    face,
    'tuff',
    (start + end) / 2,
    base,
    z,
    end - start - 0.09,
    y + height - 0.045 - base,
    depth - 0.1,
    row,
    false,
    0.68,
  );
  const nominal = row % 2 ? 1.08 : 1.34;
  for (let x = start, block = 0; x < end - 0.04; block++) {
    const width = Math.min(end - x, nominal + (((row * 13 + block * 7) % 7) - 3) * 0.05);
    const seed = row * 103 + block * 17;
    const joint = Math.min(0.021, width * 0.08);
    stone(
      face,
      'tuff',
      x + width / 2,
      y,
      z,
      width - joint,
      height - 0.014,
      depth,
      seed,
      detail >= 3,
    );
    x += width;
  }
}

/** Lower levels keep the same stepped silhouette, replacing stone joints by mass. */
export function buildJupiterFoundations(face, detail, reconstruction) {
  const rows = reconstruction.rows;
  for (const [ri, row] of rows.entries()) {
    const y = ri * reconstruction.courseHeight;
    for (const [start, end] of row.spans ?? [[row.start, row.end]])
      course(face, { ...row, start, end, y, height: reconstruction.courseHeight, row: ri }, detail);
  }
  // Low parallel remnant and a short perpendicular return are observed in the
  // photographs. Their relative dimensions remain explicitly draft estimates.
  for (const [index, remnant] of reconstruction.remnants.entries()) {
    const levels = detail < 2 ? 1 : Math.round(remnant.courses);
    for (let level = 0; level < levels; level++) {
      const h = (remnant.courses * reconstruction.courseHeight) / levels;
      const start = remnant.x - remnant.width / 2;
      const end = remnant.x + remnant.width / 2;
      course(
        face,
        { ...remnant, start, end, y: level * h, height: h, row: index * 19 + level },
        detail,
      );
    }
  }
}
