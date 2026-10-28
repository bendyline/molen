// Ground operations only. Nearby aircraft belong to the host's boardable flight world.
type Point = [number, number, number];
const cargo = config.cargo;
function box(id: string, pos: Point, size: Point, color: string, parent?: string): void {
  molen.spawn(
    {
      transform: { pos, rot: [0, 0, 0, 1] },
      ...(parent ? { parent: { id: parent }, localTransform: { pos, rot: [0, 0, 0, 1] } } : {}),
      renderable: {
        kind: 'primitive',
        ref: 'box',
        primitive: { size },
        materialRef: `palette:${color}`,
        shadows: { cast: true, receive: true },
      },
    },
    id,
  );
}
function person(id: string, pos: Point, color: string): void {
  molen.spawn(
    {
      transform: { pos, rot: [0, 0, 0, 1] },
      renderable: { kind: 'figure', ref: 'procedural', lod: 1, shadows: { cast: true } },
      figure: {
        preset: 'human.adult',
        facing: 'manual',
        height: 1.7,
        speedSource: 'transform',
        palette: { top: color, bottom: '#53677b', shoes: '#42494b', skin: '#b98765' },
      },
      figureIntent: { mode: 'idle' },
    },
    id,
  );
}
function pose(id: string, pos: Point, yaw = 0): void {
  molen.patch(id, 'transform', {
    pos,
    rot: [0, molen.math.sin(yaw / 2), 0, molen.math.cos(yaw / 2)],
  });
}
if (!molen.state.built) {
  box('foundation', [0, -1.1, 0], [36, 2, 20], '#a9a59c');
  box('pavement', [0, -0.04, 0], [36, 0.12, 20], '#929997');
  for (const x of [-17, 17])
    for (let n = 0; n < 9; n++)
      box(`edge-${x}-${n}`, [x, 0.03, -8 + n * 2], [0.12, 0.02, 1], '#e6bf58');
  // A compact service shelter; a legible canopy and open sides.
  for (const x of [-8, 8])
    for (const z of [-8, -3]) box(`post-${x}-${z}`, [x, 1.5, z], [0.14, 3, 0.14], '#8199a4');
  box('canopy', [0, 3.1, -5.5], [17, 0.22, 6], '#c1c7c2');
  if (cargo) {
    for (let n = 0; n < 8; n++) {
      const x = -12 + n * 3.3;
      box(`pallet-${n}`, [x, 0.17, -6], [2.4, 0.3, 2.1], '#b5966b');
      box(`load-${n}`, [x, 1.2, -6], [2.1, 1.8, 1.8], n % 2 ? '#b5aa8c' : '#a8b6bd');
      box(`strap-${n}`, [x, 1.21, -5.08], [0.1, 1.8, 0.04], '#52616c');
    }
  } else {
    box('briefing-board', [-5, 1.65, -5], [3, 1.6, 0.16], '#e1ded0');
    for (let n = 0; n < 5; n++)
      box(`chart-${n}`, [-6 + n * 0.45, 1.5 + (n % 2) * 0.25, -4.9], [0.3, 0.06, 0.03], '#426f8d');
    for (let n = 0; n < 3; n++) {
      box(`bench-${n}`, [-4 + n * 4, 0.55, -1], [3, 0.18, 0.65], '#b5966b');
      for (const x of [-1, 1])
        box(`bench-leg-${n}-${x}`, [-4 + n * 4 + x, 0.27, -1], [0.15, 0.54, 0.5], '#61747d');
    }
    box('tool-chest', [10, 0.8, -5], [2.5, 1.5, 1], '#9b5e48');
    for (let n = 0; n < 4; n++)
      box(`drawer-${n}`, [10, 0.35 + n * 0.32, -4.48], [2.2, 0.08, 0.06], '#c7cec8');
  }
  molen.spawn({ transform: { pos: [0, 0, 5], rot: [0, 0, 0, 1] } }, 'service-cart');
  box('cart-body', [0, 0.7, 0], [1.6, 0.7, 2.6], '#d4b965', 'service-cart');
  box('cart-seat', [0, 1.25, -0.5], [1.1, 0.55, 0.6], '#53616a', 'service-cart');
  for (const x of [-0.8, 0.8])
    for (const z of [-0.8, 0.8])
      box(`wheel-${x}-${z}`, [x, 0.35, z], [0.22, 0.6, 0.6], '#42494b', 'service-cart');
  if (cargo) {
    for (const x of [-0.6, 0.6]) {
      box(`mast-${x}`, [x, 1.6, 1.2], [0.13, 3.2, 0.13], '#61747d', 'service-cart');
      box(`fork-${x}`, [x, 0.3, 1.7], [0.15, 0.12, 1.3], '#61747d', 'service-cart');
    }
    box('lifted-pallet', [0, 0.5, 1.6], [1.4, 0.2, 1.3], '#b5966b', 'service-cart');
    box('lifted-load', [0, 1.15, 1.6], [1.2, 1.1, 1.1], '#b5aa8c', 'service-cart');
  }
  for (let n = 0; n < 6; n++)
    person(`crew-${n}`, [-9 + n * 3, 0.04, cargo ? -2 : -3], n < 2 ? '#ddad48' : '#8199b2');
  molen.setState({ built: true });
}
molen.on('tick', () => {
  const time = molen.tick * molen.dt;
  const angle = (time * molen.math.PI * 2) / 48;
  pose(
    'service-cart',
    [11 * molen.math.cos(angle), 0.04, 4 + 3 * molen.math.sin(angle)],
    molen.math.atan2(-11 * molen.math.sin(angle), 3 * molen.math.cos(angle)),
  );
  for (let n = 0; n < 2; n++) {
    const phase = (time / 20 + n / 2) % 1;
    pose(
      `crew-${n}`,
      [-10 + (phase < 0.5 ? phase : 1 - phase) * 18, 0.04, cargo ? -2 : -3],
      phase < 0.5 ? molen.math.PI / 2 : -molen.math.PI / 2,
    );
    molen.set(`crew-${n}`, 'figureIntent', { mode: 'walk' });
  }
});
