/** Shared analytic bridge patterns. N0021 uses original hemp-leaf geometry, never photography. */
import './install-deterministic-math.mjs';

const r = 0.16,
  width = 3 * r,
  height = Math.sqrt(3) * r;
export const bridgePatternRepeats = {
  metal_asanoha: [width, height],
  stone_checker_fine: [0.2, 0.2],
};
export const bridgePatternDescriptions = {
  metal_asanoha:
    'Reusable hemp-leaf railing lattice, analytic6mm strips on a480×277mm tile. Photograph-reconstructed working pitch; alpha coverage retains open area at distance. Posts and rail frames remain geometry.',
  stone_checker_fine:
    'Reusable fine100mm cool-grey checker paving. Continuous flat stone with no baked lighting, photographic texture or per-slab geometry.',
};
function asanohaGraph() {
  const nodes = [
    { id: 'u', type: 'gradient', params: { kind: 'linear', angleDeg: 0 } },
    { id: 'v', type: 'gradient', params: { kind: 'linear', angleDeg: 90 } },
    { id: 'inv-u', type: 'invert', input: 'u', params: {} },
    { id: 'inv-v', type: 'invert', input: 'v', params: {} },
  ];
  const add = (node) => (nodes.push(node), node.id),
    masks = [];
  // A whole parallel family shares one projection and multi-band ramp. There are
  // three continuous triangular grid families and three interrupted medians.
  function projection(id, a, b) {
    const low = Math.min(0, a) + Math.min(0, b),
      range = Math.abs(a) + Math.abs(b);
    const axis = (name, c) => (c < 0 ? 'inv-' + name : name);
    const input =
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
  function bands(id, p, intervals) {
    const ramp = [];
    const transition = 0.0006;
    for (const [a, b] of intervals)
      for (const [x, value] of [
        [a - transition, 0],
        [a, 1],
        [b, 1],
        [b + transition, 0],
      ]) {
        const t = (x - p.low) / p.range;
        if (t >= 0 && t <= 1) ramp.push({ t, color: value ? '#ffffff' : '#000000' });
      }
    const at = (x) => (intervals.some(([a, b]) => x >= a && x <= b) ? '#ffffff' : '#000000');
    ramp.push({ t: 0, color: at(p.low) }, { t: 1, color: at(p.low + p.range) });
    ramp.sort((a, b) => a.t - b.t);
    return add({ id, type: 'ramp', input: p.input, params: { stops: ramp } });
  }
  function stripes(p, period, offset, half) {
    const result = [];
    for (
      let i = Math.floor((p.low - offset) / period) - 1;
      i <= Math.ceil((p.low + p.range - offset) / period) + 1;
      i++
    )
      result.push([offset + i * period - half, offset + i * period + half]);
    return result;
  }
  const merge = (id, a, b, mode) =>
    add({ id, type: 'blend', inputs: { a, b }, params: { mode, factor: 1 } });
  for (const [i, angle] of [0, Math.PI / 3, -Math.PI / 3].entries()) {
    const p = projection(
      'grid-projection-' + i,
      -Math.sin(angle) * width,
      Math.cos(angle) * height,
    );
    masks.push(bands('grid-' + i, p, stripes(p, height / 2, 0, 0.003)));
  }
  for (const [i, angle] of [Math.PI / 2, Math.PI / 6, -Math.PI / 6].entries()) {
    const n = projection('median-normal-' + i, -Math.sin(angle) * width, Math.cos(angle) * height),
      t = projection('median-tangent-' + i, Math.cos(angle) * width, Math.sin(angle) * height);
    for (const parity of [0, 1]) {
      const line = bands(
        'median-lines-' + i + '-' + parity,
        n,
        stripes(n, r, (parity * r) / 2, 0.003),
      );
      const intervals = [];
      for (let k = -5; k <= 5; k++) {
        if (parity === 0)
          intervals.push([k * height - height / 3 - 0.003, k * height + height / 3 + 0.003]);
        else
          intervals.push([k * height + height / 6 - 0.003, k * height + (5 * height) / 6 + 0.003]);
      }
      const extent = bands('median-extent-' + i + '-' + parity, t, intervals);
      masks.push(merge('median-' + i + '-' + parity, line, extent, 'multiply'));
    }
  }
  let layer = masks,
    joins = 0;
  while (layer.length > 1)
    layer = Array.from({ length: Math.ceil(layer.length / 2) }, (_, i) =>
      layer[i * 2 + 1]
        ? merge('union-' + joins++, layer[i * 2], layer[i * 2 + 1], 'add')
        : layer[i * 2],
    );
  nodes.push(
    {
      id: 'color',
      type: 'ramp',
      input: layer[0],
      params: {
        stops: [
          { t: 0, color: '#eeeeee00' },
          { t: 1, color: '#eeeeeeff' },
        ],
      },
    },
    { id: 'rough', type: 'const', params: { value: 0.5 } },
    { id: 'metal', type: 'const', params: { value: 0.1 } },
  );
  return {
    format: 'molen/matgraph@1',
    size: [256, 256],
    seed: 226,
    alphaCoverage: true,
    nodes,
    outputs: { baseColor: 'color', roughness: 'rough', metalness: 'metal' },
  };
}
export const bridgePatternGraphs = {
  metal_asanoha: asanohaGraph(),
  stone_checker_fine: {
    format: 'molen/matgraph@1',
    size: [256, 256],
    seed: 227,
    nodes: [
      { id: 'checks', type: 'checker', params: { scale: 2 } },
      {
        id: 'color',
        type: 'ramp',
        input: 'checks',
        params: {
          stops: [
            { t: 0, color: '#bcc1bf' },
            { t: 1, color: '#d2d4ce' },
          ],
        },
      },
      { id: 'rough', type: 'const', params: { value: 0.88 } },
    ],
    outputs: { baseColor: 'color', roughness: 'rough' },
  },
};
