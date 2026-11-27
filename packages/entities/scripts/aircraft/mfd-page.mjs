/**
 * Formats for military displays the flight model does not drive, drawn in the green of their
 * monochrome screens instead of an "INOP" legend: a radar B-scope, a round threat or tactical
 * scope, a stores page and a navigation rose. Original diagrammatic symbology, not any real
 * system's format.
 *
 * Format only, like a gauge face without its needle: no contact, threat, range, course or heading
 * is drawn, because none is simulated (the fleet's rule: unsupported quantities stay blank or
 * INOP, never invented).
 *
 * `c` is the centre of the screen's face (facing -Z, toward the crew), `w` and `h` its size in
 * metres. Page coordinates run -0.5..0.5 across and up the screen, as the crew sees it.
 */
import { mat } from './mesh-kit.mjs';

export function mfdPage(d, c, w, h, kind) {
  const bright = mat('mfd-phosphor', '#6fd38a', { roughness: 0.5 }),
    dim = mat('mfd-phosphor-dim', '#2f6b47', { roughness: 0.6 });
  const [x, y, z] = c,
    P = (u, v) => [x - u * w, y + v * h, z - 0.0012],
    line = (a, b, material = dim, r = 0.0007) => d.rod(P(...a), P(...b), r, material),
    mark = (u, v, s = 0.035, material = bright) => d.box([s * w, s * w, 0.0012], P(u, v), material);
  const s = Math.min(w, h);
  if (kind === 'radar') {
    // B-scope frame: azimuth across, range up, scale ticks on the left, own ship at the foot.
    const frame = [
      [-0.42, -0.36],
      [0.42, -0.36],
      [0.42, 0.36],
      [-0.42, 0.36],
    ];
    for (let i = 0; i < 4; i++) line(frame[i], frame[(i + 1) % 4], bright);
    for (const u of [-0.21, 0, 0.21]) line([u, -0.36], [u, 0.36]);
    for (const v of [-0.12, 0.12]) line([-0.42, v], [0.42, v]);
    for (let i = 0; i < 4; i++) line([-0.42, -0.36 + i * 0.24], [-0.37, -0.36 + i * 0.24], bright);
    line([-0.04, -0.42], [0, -0.38], bright);
    line([0.04, -0.42], [0, -0.38], bright);
  } else if (kind === 'tews' || kind === 'tactical') {
    // Round scope: range rings and a cross round the own-ship mark.
    for (const r of [0.2, 0.4]) d.ring(r * s, 0.0006, P(0, 0), r === 0.4 ? bright : dim);
    line([-0.42, 0], [0.42, 0]);
    line([0, -0.42], [0, 0.42]);
    mark(0, 0, 0.04);
  } else if (kind === 'stores') {
    // Planform with an empty box under each station.
    line([0, 0.3], [0, -0.3], bright);
    line([-0.38, -0.04], [0, 0.12], bright);
    line([0.38, -0.04], [0, 0.12], bright);
    line([-0.15, -0.3], [0, -0.22], bright);
    line([0.15, -0.3], [0, -0.22], bright);
    for (const u of [-0.3, -0.15, 0.15, 0.3]) {
      mark(u, -0.12, 0.05, dim);
      line([u, -0.06], [u, -0.09]);
    }
  } else {
    // Navigation rose: ring and ticks, no heading or course.
    d.ring(0.38 * s, 0.0007, P(0, 0), bright);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6,
        o = (0.38 * s) / w,
        p = (0.38 * s) / h;
      line(
        [Math.sin(a) * o * 0.85, Math.cos(a) * p * 0.85],
        [Math.sin(a) * o, Math.cos(a) * p],
        bright,
      );
    }
  }
}
