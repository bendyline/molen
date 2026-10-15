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
// Upright gondolas around a rotating wheel, a carousel and visitors circulating past booths.
const paint = ['#a95e50', '#5c8a9a', '#d3ae59', '#92a577'];
if (!molen.state.built) {
  shape('foundation', [0, -5.05, 0], [80, 10, 64], '#a9a59c');
  shape('grounds', [0, 0.02, 0], [79.8, 0.12, 63.8], '#c9b98f');
  for (const x of [-20, -10])
    for (const z of [-11, -5]) {
      shape(`wheel-leg-${x}-${z}`, [x, 6.5, z], [0.45, 13, 0.45], '#b8bfc4');
      molen.patch(`wheel-leg-${x}-${z}`, 'transform', {
        rot: [0, 0, molen.math.sin((x < -15 ? -0.35 : 0.35) / 2), molen.math.cos(0.35 / 2)],
      });
    }
  shape('wheel-axle', [-15, 13, -8], [1, 1, 6], '#b8bfc4');
  for (let n = 0; n < 12; n++) {
    shape(`spoke-${n}`, [-15, 13, -8], [0.2, 10.5, 0.2], '#d3ae59');
    shape(`rim-${n}`, [-15, 13, -8], [5.5, 0.25, 0.25], '#a95e50');
    shape(`gondola-${n}`, [-15, 3, -8], [2.5, 1.2, 2.4], paint[n % 4]);
    shape(`canopy-${n}`, [0, 2.1, 0], [2.8, 0.18, 2.7], '#efe3c4', 'box', `gondola-${n}`);
    for (const side of [-1, 1])
      shape(
        `gondola-post-${n}-${side}`,
        [side * 1.1, 1.1, 0],
        [0.09, 2.1, 0.09],
        '#b8bfc4',
        'box',
        `gondola-${n}`,
      );
    person(`rider-${n}`, [-15, 3.5, -8], paint[(n + 1) % 4], 0, 1.5);
    molen.set(`rider-${n}`, 'figureIntent', { mode: 'sit' });
  }
  shape('carousel-deck', [16, 0.4, -9], [14, 0.5, 14], '#b98c67', 'cylinder');
  shape('carousel-roof', [16, 4.5, -9], [15, 0.4, 15], '#a95e50', 'cylinder');
  shape('carousel-mast', [16, 2.4, -9], [0.5, 4.8, 0.5], '#d3ae59', 'cylinder');
  for (let n = 0; n < 6; n++) {
    shape(`carousel-pole-${n}`, [16, 2.5, -9], [0.08, 4, 0.08], '#d3ae59');
    shape(`carousel-seat-${n}`, [16, 1.3, -9], [1.1, 0.6, 1.7], paint[n % 4]);
    person(`carousel-rider-${n}`, [16, 1.7, -9], paint[(n + 1) % 4], 0, 1.25);
    molen.set(`carousel-rider-${n}`, 'figureIntent', { mode: 'sit' });
  }
  for (let n = 0; n < 3; n++) {
    booth(`booth-${n}`, -20 + n * 20, 23, paint[n]);
    person(`vendor-${n}`, [-20 + n * 20, 0.12, 21], '#efe3c4');
  }
  for (let n = 0; n < 22; n++)
    person(`visitor-${n}`, [0, 0.12, 0], paint[n % 4], 0, 1.3 + (n % 4) * 0.15);
  molen.setState({ built: true });
}
molen.on('tick', () => {
  const time = molen.tick * molen.dt;
  for (let n = 0; n < 12; n++) {
    const angle = (time * tau) / 48 + (n * tau) / 12;
    const x = -15 + molen.math.cos(angle) * 10.5,
      y = 13 + molen.math.sin(angle) * 10.5;
    pose(`gondola-${n}`, [x, y - 0.7, -8]);
    pose(`rider-${n}`, [x, y - 0.1, -8]);
    molen.patch(`spoke-${n}`, 'transform', {
      pos: [-15 + molen.math.cos(angle) * 5.25, 13 + molen.math.sin(angle) * 5.25, -8],
      rot: [
        0,
        0,
        molen.math.sin((angle - molen.math.PI / 2) / 2),
        molen.math.cos((angle - molen.math.PI / 2) / 2),
      ],
    });
    const mid = angle + tau / 24;
    molen.patch(`rim-${n}`, 'transform', {
      pos: [-15 + molen.math.cos(mid) * 10.14, 13 + molen.math.sin(mid) * 10.14, -8],
      rot: [
        0,
        0,
        molen.math.sin((mid + molen.math.PI / 2) / 2),
        molen.math.cos((mid + molen.math.PI / 2) / 2),
      ],
    });
  }
  for (let n = 0; n < 6; n++) {
    const angle = (time * tau) / 18 + (n * tau) / 6;
    const x = 16 + molen.math.cos(angle) * 5,
      z = -9 + molen.math.sin(angle) * 5;
    const bob = molen.math.sin(time * 2 + n) * 0.3;
    pose(`carousel-pole-${n}`, [x, 2.5, z]);
    pose(`carousel-seat-${n}`, [x, 1.3 + bob, z], -angle);
    pose(`carousel-rider-${n}`, [x, 1.65 + bob, z], -angle);
  }
  for (let n = 0; n < 22; n++)
    route(
      `visitor-${n}`,
      [
        [-30, 0.12, 7],
        [-30, 0.12, 17],
        [30, 0.12, 17],
        [30, 0.12, 7],
      ],
      time + n * 2.7,
      14,
      0.1,
    );
});
