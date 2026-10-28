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
// A tug towing three baggage carts, a service van and ramp crew. Aircraft live in the host flight world.
function vehicle(id: string, cart: boolean): void {
  molen.spawn({ transform: { pos: [0, 0.2, 0], rot: [0, 0, 0, 1] } }, id);
  shape(
    `${id}-body`,
    [0, 0.65, 0],
    [2, 0.65, cart ? 3 : 3.6],
    cart ? '#b6bdb8' : '#e6bd58',
    'box',
    id,
  );
  if (cart) {
    for (let n = 0; n < 4; n++)
      shape(
        `${id}-bag-${n}`,
        [((n % 2) - 0.5) * 0.9, 1.25, (Math.floor(n / 2) - 0.5) * 1.2],
        [0.75, 0.65, 1],
        ['#426f8d', '#a55a44', '#677653', '#b5966b'][n],
        'box',
        id,
      );
    shape(`${id}-hitch`, [0, 0.4, 2], [0.15, 0.15, 1.4], '#7e898c', 'box', id);
  } else {
    shape(`${id}-cab`, [0, 1.55, -0.5], [1.75, 1.3, 1.5], '#d7d8c7', 'box', id);
    shape(`${id}-glass`, [0, 1.7, 0.27], [1.5, 0.7, 0.04], '#4d6178', 'box', id);
    shape(`${id}-beacon`, [0, 2.3, -0.5], [0.24, 0.24, 0.24], '#efb858', 'sphere', id);
  }
  for (const x of [-1, 1])
    for (const z of [-1, 1]) {
      const wheel = `${id}-wheel-${x}-${z}`;
      shape(wheel, [x, 0.38, z], [0.7, 0.28, 0.7], '#42494b', 'cylinder', id);
      molen.patch(wheel, 'localTransform', {
        rot: [0, 0, molen.math.sin(molen.math.PI / 4), molen.math.cos(molen.math.PI / 4)],
      });
    }
}
if (!molen.state.built) {
  shape('foundation', [0, -5.05, 0], [90, 10, 70], '#a9a59c');
  shape('apron', [0, 0.02, 0], [89.8, 0.12, 69.8], '#929997');
  for (let n = 0; n < 16; n++)
    shape(`lane-${n}`, [-38 + n * 5, 0.1, 24], [2.5, 0.025, 0.15], '#efe3c4');
  for (const x of [-16, 16]) shape(`stand-line-${x}`, [x, 0.1, -8], [0.18, 0.025, 34], '#e6bf58');
  shape('stop-mark', [0, 0.1, -22], [13, 0.025, 0.22], '#e6bf58');
  shape('belt-support', [4, 0.85, -14], [2.2, 1.5, 5.4], '#d4b965');
  shape('baggage-belt', [3.3, 2, -14], [1.1, 0.2, 6], '#4b565a');
  molen.patch('baggage-belt', 'transform', {
    rot: [molen.math.sin(-0.18), 0, 0, molen.math.cos(-0.18)],
  });
  for (let n = 0; n < 3; n++) shape(`belt-bag-${n}`, [3.3, 1.6, -12], [0.7, 0.55, 0.9], '#7b8f9b');
  vehicle('tug', false);
  for (let n = 0; n < 3; n++) vehicle(`cart-${n}`, true);
  vehicle('service-van', false);
  shape('service-van-box', [0, 1.7, -0.7], [2.1, 1.7, 2.2], '#d9dacf', 'box', 'service-van');
  for (let n = 0; n < 6; n++) person(`crew-${n}`, [19 + n * 2, 0.14, -18], '#ddad48');
  for (let n = 0; n < 8; n++)
    shape(`cone-${n}`, [-18 + n * 5, 0.5, 9], [0.45, 0.8, 0.45], '#c77b4b');
  molen.setState({ built: true });
}
molen.on('tick', () => {
  const time = molen.tick * molen.dt;
  // Carts follow the tug's same track at fixed time offsets, rather than sliding sideways.
  for (let n = -1; n < 3; n++) {
    const angle = (time / 42 - (n + 1) * 0.026) * tau;
    pose(
      n === -1 ? 'tug' : `cart-${n}`,
      [32 * molen.math.cos(angle), 0.15, 24 * molen.math.sin(angle)],
      molen.math.atan2(-32 * molen.math.sin(angle), 24 * molen.math.cos(angle)),
    );
  }
  const vanAngle = (-time * tau) / 65;
  pose(
    'service-van',
    [39 * molen.math.cos(vanAngle), 0.15, 30 * molen.math.sin(vanAngle)],
    molen.math.atan2(39 * molen.math.sin(vanAngle), -30 * molen.math.cos(vanAngle)),
  );
  for (let n = 0; n < 3; n++) {
    const progress = (time / 5 + n / 3) % 1;
    pose(`belt-bag-${n}`, [3.3, 1.3 + progress * 1.8, -11.4 - progress * 5.2]);
  }
  for (let n = 0; n < 6; n++) {
    const phase = (time / 18 + n / 6) % 1;
    const x = 19 + (phase < 0.5 ? phase * 2 : (1 - phase) * 2) * 10;
    pose(`crew-${n}`, [x, 0.14, -16 + n * 2], phase < 0.5 ? molen.math.PI / 2 : -molen.math.PI / 2);
    molen.set(`crew-${n}`, 'figureIntent', { mode: 'walk' });
  }
});
