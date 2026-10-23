/** Reusable eight-point rosette screen, reconstructed analytically without photo pixels. */
import './install-deterministic-math.mjs';

export const rosettePatternDescription =
  'Reusable open eight-point star and circular rosette screen on a2m square repeat. Analytic original pattern with100mm working strips and filtered alpha coverage; a visual approximation rather than a fabrication drawing. Sheet edges, supporting frames and stand-off brackets remain geometry.';

export function rosettePatternGraph() {
  const nodes = [
      { id: 'u', type: 'gradient', params: { kind: 'linear', angleDeg: 0 } },
      { id: 'v', type: 'gradient', params: { kind: 'linear', angleDeg: 90 } },
      { id: 'inv-u', type: 'invert', input: 'u', params: {} },
      { id: 'inv-v', type: 'invert', input: 'v', params: {} },
      { id: 'radius', type: 'gradient', params: { kind: 'radial', angleDeg: 0 } },
      {
        id: 'circle',
        type: 'ramp',
        input: 'radius',
        params: {
          stops: [
            { t: 0, color: '#000000' },
            { t: 0.894, color: '#000000' },
            { t: 0.9, color: '#ffffff' },
            { t: 0.994, color: '#ffffff' },
            { t: 0.999, color: '#000000' },
            { t: 1, color: '#000000' },
          ],
        },
      },
    ],
    masks = ['circle'];
  const add = (node) => {
    nodes.push(node);
    return node.id;
  };
  const merge = (id, a, b, mode) =>
    add({ id, type: 'blend', inputs: { a, b }, params: { mode, factor: 1 } });
  function projection(id, a, b) {
    const low = Math.min(0, a) + Math.min(0, b),
      range = Math.abs(a) + Math.abs(b),
      axis = (n, c) => (c < 0 ? `inv-${n}` : n),
      input =
        Math.abs(a) < 1e-8
          ? axis('v', b)
          : Math.abs(b) < 1e-8
            ? axis('u', a)
            : add({
                id,
                type: 'blend',
                inputs: { a: axis('u', a), b: axis('v', b) },
                params: { mode: 'mix', factor: Math.abs(b) / range },
              });
    return { input, low, range };
  }
  function band(id, projection, lo, hi) {
    const at = (t) => (t >= lo && t <= hi ? '#ffffff' : '#000000'),
      stops = [
        { t: 0, color: at(projection.low) },
        ...[
          [lo - 0.002, '#000000'],
          [lo, '#ffffff'],
          [hi, '#ffffff'],
          [hi + 0.002, '#000000'],
        ]
          .map(([v, color]) => ({ t: (v - projection.low) / projection.range, color }))
          .filter((p) => p.t > 0 && p.t < 1),
        { t: 1, color: at(projection.low + projection.range) },
      ];
    return add({ id, type: 'ramp', input: projection.input, params: { stops } });
  }
  const points = Array.from({ length: 16 }, (_, i) => {
    const a = (i * Math.PI) / 8,
      r = i % 2 ? 0.27 : 0.49;
    return [0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a)];
  });
  for (let i = 0; i < points.length; i++) {
    const p = points[i],
      q = points[(i + 1) % points.length],
      length = Math.hypot(q[0] - p[0], q[1] - p[1]),
      U = q.map((v, k) => (v - p[k]) / length),
      N = [-U[1], U[0]],
      cross = p[0] * N[0] + p[1] * N[1],
      along = p[0] * U[0] + p[1] * U[1],
      line = band(`edge-${i}`, projection(`normal-${i}`, ...N), cross - 0.025, cross + 0.025),
      end = band(
        `length-${i}`,
        projection(`tangent-${i}`, ...U),
        along - 0.0125,
        along + length + 0.0125,
      );
    masks.push(merge(`segment-${i}`, line, end, 'multiply'));
  }
  let mask = masks[0];
  for (let i = 1; i < masks.length; i++) mask = merge(`union-${i}`, mask, masks[i], 'add');
  nodes.push(
    {
      id: 'color',
      type: 'ramp',
      input: mask,
      params: {
        stops: [
          { t: 0, color: '#eeeeee00' },
          { t: 1, color: '#eeeeeeff' },
        ],
      },
    },
    { id: 'rough', type: 'const', params: { value: 0.65 } },
    { id: 'metal', type: 'const', params: { value: 0.05 } },
  );
  return {
    format: 'molen/matgraph@1',
    size: [256, 256],
    seed: 228,
    alphaCoverage: true,
    nodes,
    outputs: { baseColor: 'color', roughness: 'rough', metalness: 'metal' },
  };
}
