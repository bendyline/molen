// Self-contained scene script: geometry and choreography are authored in local metres.
// Persistent state lives in molen.state; all motion is derived from the fixed simulation tick.
type Point = [number, number, number];
const tau = molen.math.PI * 2;
function shape(
  id: string,
  pos: Point,
  size: Point,
  color: string,
  ref: 'box' | 'sphere' | 'cylinder' = 'box',
  parent?: string,
): void {
  molen.spawn(
    {
      transform: { pos, rot: [0, 0, 0, 1] },
      ...(parent ? { parent: { id: parent }, localTransform: { pos, rot: [0, 0, 0, 1] } } : {}),
      renderable: {
        kind: 'primitive',
        ref,
        primitive: { size },
        materialRef: `palette:${color}`,
        shadows: { cast: true, receive: true },
      },
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
function person(id: string, pos: Point, color: string, yaw = 0, height = 1.7): void {
  molen.spawn(
    {
      transform: { pos, rot: [0, molen.math.sin(yaw / 2), 0, molen.math.cos(yaw / 2)] },
      renderable: { kind: 'figure', ref: 'procedural', lod: 1, shadows: { cast: true } },
      figure: {
        preset: 'human.adult',
        facing: 'manual',
        height,
        speedSource: 'transform',
        palette: {
          top: color,
          bottom: '#53677b',
          skin: ['#d7a880', '#9b6548', '#e3bd9e', '#704a38'][id.length % 4],
          shoes: '#42494b',
        },
      },
      figureIntent: { mode: 'idle' },
    },
    id,
  );
}
// Equal-duration legs; a hold at each waypoint gives people time to browse or wait.
function route(id: string, points: Point[], time: number, legSeconds: number, hold = 0): void {
  const step = (((time / legSeconds) % points.length) + points.length) % points.length;
  const index = Math.floor(step);
  const a = points[index];
  const b = points[(index + 1) % points.length];
  const u = Math.max(0, (step - index - hold) / (1 - hold));
  pose(
    id,
    [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u],
    molen.math.atan2(b[0] - a[0], b[2] - a[2]),
  );
  const mode = u === 0 ? 'idle' : 'walk';
  if (molen.get(id, 'figureIntent')?.mode !== mode) molen.set(id, 'figureIntent', { mode });
}
function booth(id: string, x: number, z: number, color: string): void {
  shape(`${id}-counter`, [x, 0.9, z], [4.8, 1.6, 2.3], '#be9569');
  for (const dx of [-2.4, 2.4])
    for (const dz of [-1.4, 1.4])
      shape(`${id}-post-${dx}-${dz}`, [x + dx, 1.9, z + dz], [0.12, 3.8, 0.12], '#ddd7c7');
  for (let stripe = 0; stripe < 6; stripe++) {
    const panel = `${id}-roof-${stripe}`;
    shape(panel, [x - 2.5 + stripe, 3.7, z], [1.02, 0.18, 3.8], stripe % 2 ? '#efe3c4' : color);
    shape(
      `${id}-valance-${stripe}`,
      [x - 2.5 + stripe, 3.45, z + 1.9],
      [1.02, 0.5, 0.12],
      stripe % 2 ? '#efe3c4' : color,
    );
  }
}
// Stalls, vendors, produce, browsing pauses and a handcart travelling the central aisle.
const colors = ['#a8634b', '#8199b2', '#92a577', '#d3ae59'];
if (!molen.state.built) {
  shape('foundation', [0, -5.05, 0], [56, 10, 44], '#b8b5a8');
  shape('plaza', [0, 0.02, 0], [55.8, 0.12, 43.8], '#d2cec5');
  for (let n = 0; n < 9; n++)
    shape(`paver-${n}`, [-24 + n * 6, 0.1, 0], [0.07, 0.02, 43], '#b8b5a8');
  for (let n = 0; n < 8; n++) {
    const x = -18 + (n % 4) * 12,
      z = n < 4 ? -11 : 11;
    booth(`stall-${n}`, x, z, colors[n % 4]);
    person(
      `vendor-${n}`,
      [x, 0.12, z + (n < 4 ? -1.9 : 1.9)],
      '#b98c67',
      n < 4 ? 0 : molen.math.PI,
    );
    for (let crate = 0; crate < 3; crate++) {
      shape(`crate-${n}-${crate}`, [x - 1.5 + crate * 1.5, 1.85, z], [1.2, 0.4, 1.5], '#a77a54');
      for (let item = 0; item < 3; item++)
        shape(
          `produce-${n}-${crate}-${item}`,
          [x - 1.8 + crate * 1.5 + (item % 2) * 0.6, 2.2, z - 0.3 + Math.floor(item / 2) * 0.6],
          [0.45, 0.45, 0.45],
          ['#b75843', '#87a55d', '#d8b35d'][(n + crate) % 3],
          'sphere',
        );
    }
  }
  for (let n = 0; n < 20; n++)
    person(`shopper-${n}`, [0, 0.12, 0], colors[n % 4], 0, 1.4 + (n % 4) * 0.1);
  molen.spawn({ transform: { pos: [0, 0.12, 0], rot: [0, 0, 0, 1] } }, 'handcart');
  shape('cart-box', [0, 0.6, 0], [1.1, 0.8, 1.5], '#a77a54', 'box', 'handcart');
  for (const x of [-0.65, 0.65]) {
    shape(`cart-wheel-${x}`, [x, 0.3, 0], [0.5, 0.5, 0.5], '#48505a', 'sphere', 'handcart');
    shape(`cart-handle-${x}`, [x, 0.85, -1], [0.1, 0.1, 1.1], '#b8bfc4', 'box', 'handcart');
  }
  person('porter', [0, 0.12, -1.8], '#b98c67');
  for (const x of [-25, 25]) {
    shape(`planter-${x}`, [x, 0.7, 0], [2.3, 1.3, 2.3], '#a77a54');
    shape(`shrub-${x}`, [x, 1.8, 0], [2.5, 2.5, 2.5], '#92a577', 'sphere');
  }
  molen.setState({ built: true });
}
molen.on('tick', () => {
  const time = molen.tick * molen.dt;
  for (let n = 0; n < 20; n++) {
    const x = -18 + (n % 4) * 12;
    route(
      `shopper-${n}`,
      [
        [x - 3, 0.12, -6],
        [x + 3, 0.12, -6],
        [x + 3, 0.12, 6],
        [x - 3, 0.12, 6],
      ],
      time + n * 2.2,
      9,
      0.35,
    );
  }
  const angle = (time * tau) / 48;
  const x = molen.math.cos(angle) * 20,
    z = molen.math.sin(angle) * 2.5;
  const yaw = molen.math.atan2(-20 * molen.math.sin(angle), 2.5 * molen.math.cos(angle));
  pose('handcart', [x, 0.12, z], yaw);
  pose('porter', [x - molen.math.sin(yaw) * 1.8, 0.12, z - molen.math.cos(yaw) * 1.8], yaw);
  molen.set('porter', 'figureIntent', { mode: 'walk' });
});
