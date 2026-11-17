/** Mapped reserve hangar with a continuous barrel roof and two sliding aircraft doors. */
import { face } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const tone = {
  roof: rgb('d0d3d1'),
  rib: rgb('b6bfbe'),
  cladding: rgb('adb9bc'),
  door: rgb('939fa3'),
  concrete: rgb('a6a6a0'),
  glass: rgb('496167'),
  divider: rgb('c2cacc'),
};

const mix = (a, b, t) => a + (b - a) * t;
const between = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
const xyz = ([x, z], y) => [x, y, z];

export function buildReserveHangar(out, { ring, floor, ground, controls }, lod) {
  const [rightNear, rightFar, leftFar, leftNear] = ring;
  const spring = floor + controls.springHeightMeters;
  const crown = floor + controls.crownHeightMeters;
  const facade = (a, b, t) => between(a, b, t);
  const rake =
    controls.curtainWallHeightMeters *
    Math.sin((controls.curtainWallInclinationDegrees * Math.PI) / 180);
  const lowerNear = (u) => facade(leftNear, rightNear, u);
  const lowerFar = (u) => facade(leftFar, rightFar, u);
  const upperNear = (u) => {
    const [x, z] = lowerNear(u);
    return [x, z + rake];
  };
  const upperFar = (u) => {
    const [x, z] = lowerFar(u);
    return [x, z - 2.3];
  };
  const edge = (u, v) => {
    const [x, z] = between(upperNear(u), upperFar(u), v);
    const pinchedX = x + (u < 0.5 ? 1.65 : -1.65) * Math.sin(Math.PI * v);
    const y = spring + (crown - spring) * Math.sin(Math.PI * v);
    return [pinchedX, y, z];
  };
  const segments = [5, 9, 17, 25][lod];
  for (let i = 0; i < segments; i++) {
    const a = i / segments,
      b = (i + 1) / segments;
    face(
      out,
      'roof',
      [edge(0, a), edge(0, b), edge(1, b), edge(1, a)],
      lod > 1 && i % 4 === 0 ? tone.rib : tone.roof,
    );
    const endBottom = (u, v) => between(lowerNear(u), lowerFar(u), v);
    face(
      out,
      'metal',
      [xyz(endBottom(0, a), floor), xyz(endBottom(0, b), floor), edge(0, b), edge(0, a)],
      tone.cladding,
    );
    face(
      out,
      'metal',
      [xyz(endBottom(1, b), floor), xyz(endBottom(1, a), floor), edge(1, a), edge(1, b)],
      tone.cladding,
    );
  }
  const foundation = [leftNear, rightNear, rightFar, leftFar];
  for (let i = 0; i < foundation.length; i++) {
    const a = foundation[i],
      b = foundation[(i + 1) % foundation.length];
    const bottom = (p) => Math.min(floor - 0.4, ground(p) - 0.8);
    face(
      out,
      'concrete',
      [xyz(b, bottom(b)), xyz(a, bottom(a)), xyz(a, floor), xyz(b, floor)],
      tone.concrete,
    );
  }
  const near = (u, v, bias = 0) => {
    const [x, z] = between(lowerNear(u), upperNear(u), v);
    return [x, mix(floor, spring, v), z - bias];
  };
  const far = (u, v, bias = 0) => {
    const [x, z] = between(lowerFar(u), upperFar(u), v);
    return [x, mix(floor, spring, v), z + bias];
  };
  const panel = (slot, point, u, v, lo, hi, color, bias, flip = false) => {
    const p = [point(v, lo, bias), point(u, lo, bias), point(u, hi, bias), point(v, hi, bias)];
    face(out, slot, flip ? p.reverse() : p, color);
  };
  panel('concrete', near, 0, 1, 0, 0.09, tone.concrete, 0);
  panel('glass', near, 0, 1, 0.09, 0.97, tone.glass, 0);
  panel('paint', near, 0, 1, 0.97, 1, tone.divider, 0);
  panel('metal', far, 0, 1, 0, 1, tone.cladding, 0, true);
  const opening = controls.slidingDoorWidthMeters / controls.clearSpanMeters[0];
  for (const mid of [0.264, 0.736]) {
    const a = mid - opening / 2,
      b = mid + opening / 2;
    panel('paint', far, a, b, 0.023, 0.76, tone.door, 0.044, true);
    if (lod > 0) {
      panel('paint', far, a - 0.007, b + 0.007, 0.755, 0.781, tone.divider, 0.073, true);
      panel('glass', far, a + 0.012, b - 0.012, 0.56, 0.622, tone.glass, 0.069, true);
      for (let i = 1; i < 7; i++) {
        const s = mix(a, b, i / 7);
        panel('paint', far, s - 0.0012, s + 0.0012, 0.04, 0.754, tone.divider, 0.085, true);
      }
    }
  }
  if (lod === 0) return;
  const bays = [0, 18, 28, 36][lod];
  for (let i = 1; i < bays; i++) {
    const x = i / bays;
    panel('paint', near, x - 0.00065, x + 0.00065, 0.08, 0.98, tone.divider, 0.043);
  }
  for (const y of [0.29, 0.51, 0.73]) {
    panel('paint', near, 0.001, 0.999, y - 0.005, y + 0.005, tone.divider, 0.055);
  }
}
