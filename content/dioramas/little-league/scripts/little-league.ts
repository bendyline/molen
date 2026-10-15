// Self-contained scene script: geometry and choreography are authored in local metres.
// Persistent state lives in molen.state; all motion is derived from the fixed simulation tick.
type Point = [number, number, number];
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
// A pitch, a hit, a lap around the bases and a reset. No baseball rules simulation.
const bases: Point[] = [
  [0, 0.2, 18],
  [18, 0.2, 0],
  [0, 0.2, -18],
  [-18, 0.2, 0],
];
if (!molen.state.built) {
  shape('foundation', [0, -5.05, 0], [80, 10, 80], '#8b9975');
  shape('outfield', [0, 0.02, 0], [79.8, 0.12, 79.8], '#7fa258');
  shape('infield', [0, 0.1, 0], [28, 0.07, 28], '#c9a479');
  molen.patch('infield', 'transform', {
    rot: [0, molen.math.sin(molen.math.PI / 8), 0, molen.math.cos(molen.math.PI / 8)],
  });
  shape('infield-grass', [0, 0.15, 0], [19, 0.03, 19], '#7fa258');
  molen.patch('infield-grass', 'transform', {
    rot: [0, molen.math.sin(molen.math.PI / 8), 0, molen.math.cos(molen.math.PI / 8)],
  });
  for (let n = 0; n < 4; n++) shape(`base-${n}`, bases[n], [0.65, 0.12, 0.65], '#efe3c4');
  shape('mound', [0, 0.2, 1], [4, 0.3, 4], '#c9a479', 'cylinder');
  for (const side of [-1, 1]) {
    shape(`foul-${side}`, [side * 18, 0.18, 0], [0.1, 0.02, 51], '#efe3c4');
    molen.patch(`foul-${side}`, 'transform', {
      rot: [0, molen.math.sin((-side * molen.math.PI) / 8), 0, molen.math.cos(molen.math.PI / 8)],
    });
    for (let row = 0; row < 3; row++)
      shape(
        `bench-${side}-${row}`,
        [side * 28, 0.65 + row * 0.5, 16 + row * 2],
        [13, 0.25, 1.1],
        '#d2cec5',
      );
    shape(`dugout-${side}`, [side * 29, 3, 4], [10, 0.22, 4], side < 0 ? '#a8634b' : '#456f8e');
    for (const dx of [-4.5, 4.5])
      shape(`dugout-post-${side}-${dx}`, [side * 29 + dx, 1.5, 4], [0.15, 3, 0.15], '#b8bfc4');
    for (let n = 0; n < 12; n++) {
      person(
        `fan-${side}-${n}`,
        [side * 28 - 5 + (n % 4) * 3.2, 0.55 + Math.floor(n / 4) * 0.5, 16 + Math.floor(n / 4) * 2],
        ['#b98c67', '#8199b2', '#a3b78f'][n % 3],
        molen.math.PI,
      );
      molen.set(`fan-${side}-${n}`, 'figureIntent', { mode: 'sit' });
    }
  }
  for (let n = 0; n < 9; n++) {
    const angle = molen.math.PI * (0.12 + n * 0.095);
    const x = 37 * molen.math.cos(angle),
      z = -37 * molen.math.sin(angle);
    shape(`fence-${n}`, [x, 1.4, z], [0.16, 2.8, 0.16], '#b8bfc4');
    shape(`rail-${n}`, [x, 2.5, z], [11, 0.12, 0.12], '#b8bfc4');
    molen.patch(`rail-${n}`, 'transform', {
      rot: [
        0,
        molen.math.sin((angle - molen.math.PI / 2) / 2),
        0,
        molen.math.cos((angle - molen.math.PI / 2) / 2),
      ],
    });
  }
  for (let n = 0; n < 7; n++)
    shape(`backstop-${n}`, [-6 + n * 2, 2.8, 23], [0.08, 5.6, 0.08], '#b8bfc4');
  for (let n = 0; n < 6; n++)
    shape(`backstop-wire-${n}`, [0, 0.5 + n, 23], [12, 0.05, 0.05], '#b8bfc4');
  person('runner', bases[0], '#b75d4e', 0, 1.4);
  person('pitcher', [0, 0.35, 1], '#456f8e', 0, 1.45);
  for (let n = 0; n < 7; n++)
    person(
      `fielder-${n}`,
      [-26 + (n % 4) * 17, 0.18, n < 4 ? -26 : -3],
      '#456f8e',
      0,
      1.35 + (n % 3) * 0.05,
    );
  shape('ball', [0, 1.5, 1], [0.28, 0.28, 0.28], '#efe3c4', 'sphere');
  shape('bat', [-1, 1.2, 18], [0.12, 1.5, 0.12], '#d5b183');
  molen.setState({ built: true, cycle: -1 });
}
molen.on('tick', () => {
  const time = molen.tick * molen.dt,
    t = time % 24;
  if (t < 4) pose('runner', bases[0], molen.math.PI);
  else route('runner', bases, t - 4, 4, 0);
  molen.set('runner', 'figureIntent', { mode: t >= 4 && t < 20 ? 'run' : 'idle' });
  if (t >= 20) pose('runner', bases[0], molen.math.PI);
  const pitch = Math.min(1, t / 4);
  const hit = Math.min(1, (t - 4) / 4);
  pose(
    'ball',
    t < 4
      ? [0, 1.1 + molen.math.sin(pitch * molen.math.PI), 1 + pitch * 17]
      : t < 8
        ? [hit * 24, 1 + molen.math.sin(hit * molen.math.PI) * 12, 18 - hit * 45]
        : [24, 0.3, -27],
  );
  molen.patch('bat', 'transform', {
    rot: [
      0,
      0,
      molen.math.sin((t > 3 && t < 5 ? (t - 3) * 2 : 0.4) / 2),
      molen.math.cos((t > 3 && t < 5 ? (t - 3) * 2 : 0.4) / 2),
    ],
  });
  for (let n = 0; n < 7; n++) {
    const chase = t > 4 && t < 12 ? molen.math.sin(((t - 4) * molen.math.PI) / 8) : 0;
    pose(
      `fielder-${n}`,
      [-26 + (n % 4) * 17 + chase * 3, 0.18, (n < 4 ? -26 : -3) - chase * 3],
      -molen.math.PI / 4,
    );
    molen.set(`fielder-${n}`, 'figureIntent', { mode: chase > 0 ? 'run' : 'idle' });
  }
  if (t >= 4 && molen.state.cycle !== Math.floor(time / 24)) {
    molen.emit('diorama.cue', { cue: 'base-hit', cycle: Math.floor(time / 24) });
    molen.patchState({ cycle: Math.floor(time / 24) });
  }
});
