/** Original reusable ossuary relief vocabulary; first consumer 'N0546'. */
import earcut from 'earcut';

/** Small original cranial relief with actual eye/nose cavities, not an image decal. */
export function ossuarySkull(f, detail) {
  const outer = [
      [-0.085, -0.14],
      [0.085, -0.14],
      [0.13, -0.03],
      [0.12, 0.09],
      [0.075, 0.15],
      [-0.075, 0.15],
      [-0.12, 0.09],
      [-0.13, -0.03],
    ],
    holes = [-0.055, 0.055].map((x) =>
      Array.from({ length: 6 }, (_, i) => [
        x + Math.cos((-i * Math.PI) / 3) * 0.036,
        0.015 + Math.sin((-i * Math.PI) / 3) * 0.043,
      ]),
    );
  if (detail >= 3)
    holes.push([
      [-0.018, -0.07],
      [0.018, -0.07],
      [0, -0.025],
    ]);
  const flat = [...outer, ...holes.flat()],
    starts = holes.map(
      (_, i) => outer.length + holes.slice(0, i).reduce((n, h) => n + h.length, 0),
    ),
    ix = earcut(flat.flat(), starts);
  for (let i = 0; i < ix.length; i += 3)
    f(
      'bone',
      ix.slice(i, i + 3).map((k) => [flat[k][0], flat[k][1], 0]),
      [0, 0, 1],
    );
  for (const h of holes) {
    for (let i = 0; i < h.length; i++) {
      const j = (i + 1) % h.length,
        A = h[i],
        B = h[j];
      f(
        'bone',
        [
          [...A, 0],
          [...B, 0],
          [...B, -0.065],
          [...A, -0.065],
        ],
        [-(B[1] - A[1]), B[0] - A[0], 0],
      );
    }
    const cap = earcut(h.flat());
    for (let i = 0; i < cap.length; i += 3)
      f(
        'inset',
        cap.slice(i, i + 3).map((k) => [h[k][0], h[k][1], -0.067]),
        [0, 0, 1],
      );
  }
  const back = outer.map(([x, y]) => [x * 0.72, y * 0.82, -0.13]);
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length,
      A = outer[i],
      B = outer[j];
    f('bone', [[...A, 0], [...B, 0], back[j], back[i]], [B[1] - A[1], A[0] - B[0], 0.1]);
  }
  const cap = earcut(back.flatMap((p) => p.slice(0, 2)));
  for (let i = 0; i < cap.length; i += 3)
    f(
      'bone',
      cap.slice(i, i + 3).map((k) => back[k]),
      [0, 0, -1],
    );
  // The jaw is deliberately simple at medium-fi scale.
  f(
    'bone',
    [
      [-0.075, -0.14, 0.005],
      [0.075, -0.14, 0.005],
      [0.06, -0.175, -0.01],
      [-0.06, -0.175, -0.01],
    ],
    [0, 0, 1],
  );
}

/** Shallow long-bone motif, embedded back in the wall or pier surface. */
export function ossuaryLongBone(f, length = 0.46) {
  f(
    'bone',
    [
      [-length / 2, -0.029, 0.015],
      [length / 2, -0.029, 0.015],
      [length / 2, 0.029, 0.015],
      [-length / 2, 0.029, 0.015],
    ],
    [0, 0, 1],
  );
  for (const sign of [-1, 1]) {
    const x = (sign * length) / 2,
      ring = Array.from({ length: 6 }, (_, i) => [
        x + Math.cos((i * Math.PI) / 3) * 0.07,
        Math.sin((i * Math.PI) / 3) * 0.055,
        0.025,
      ]);
    for (let i = 1; i < 5; i++) f('bone', [ring[0], ring[i], ring[i + 1]], [0, 0, 1]);
  }
  for (const sign of [-1, 1])
    f(
      'bone',
      [
        [-length / 2, sign * 0.029, 0.015],
        [length / 2, sign * 0.029, 0.015],
        [length / 2, sign * 0.029, -0.04],
        [-length / 2, sign * 0.029, -0.04],
      ],
      [0, sign, 0],
    );
}
