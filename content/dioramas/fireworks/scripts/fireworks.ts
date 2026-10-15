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
// Three staggered launches. Recycle a fixed pool of sparks; no accumulating entities.
const colors = ['#e7b455', '#b9766a', '#7ca8bc'];
const sparks = 32;
if (!molen.state.built) {
  shape('foundation', [0, -5.05, 0], [90, 10, 80], '#8b9975');
  shape('lawn', [0, 0.02, 0], [89.8, 0.12, 79.8], '#7fa258');
  shape('launch-pad', [0, 0.12, -21], [32, 0.15, 10], '#a9a59c');
  for (let n = 0; n < 9; n++) {
    shape(`barrier-${n}`, [-32 + n * 8, 0.8, -2], [7, 0.12, 0.12], '#b8bfc4');
    shape(`barrier-post-${n}`, [-32 + n * 8, 0.7, -2], [0.15, 1.4, 0.15], '#b8bfc4');
  }
  for (let n = 0; n < 40; n++) {
    const x = -27 + (n % 10) * 6,
      z = 11 + Math.floor(n / 10) * 6;
    person(
      `spectator-${n}`,
      [x, 0.12, z],
      ['#8199b2', '#a3b78f', '#b98c67', '#c4ad86'][n % 4],
      molen.math.PI,
      1.5 + (n % 3) * 0.1,
    );
    if (n % 4 === 0) shape(`blanket-${n}`, [x, 0.11, z], [3.5, 0.04, 2.4], '#a77968');
  }
  for (let launch = 0; launch < 3; launch++) {
    shape(`launcher-${launch}`, [-12 + launch * 12, 0.5, -21], [1.2, 0.8, 1.2], '#48505a');
    shape(`rocket-${launch}`, [0, 0, -21], [0.5, 0.5, 0.5], colors[launch], 'sphere');
    for (let n = 0; n < sparks; n++)
      shape(`spark-${launch}-${n}`, [0, 0, -21], [0.55, 0.55, 0.55], colors[launch], 'sphere');
    molen.spawn(
      {
        transform: { pos: [-12 + launch * 12, 34, -21], rot: [0, 0, 0, 1] },
        light: { type: 'point', color: colors[launch], intensity: 0, range: 60 },
      },
      `flash-${launch}`,
    );
  }
  // Warm floodlights let the crowd and launch area read at dusk without changing the host sky.
  for (const x of [-28, 28]) {
    shape(`mast-${x}`, [x, 4, 24], [0.16, 8, 0.16], '#b8bfc4');
    molen.spawn(
      {
        transform: { pos: [x, 8, 24], rot: [0, 0, 0, 1] },
        light: { type: 'point', color: '#ffe3b0', intensity: 180, range: 40 },
      },
      `crowd-light-${x}`,
    );
  }
  molen.setState({ built: true, bursts: [-1, -1, -1] });
}
molen.on('tick', () => {
  const time = molen.tick * molen.dt;
  const bursts = [...(molen.state.bursts as number[])];
  for (let launch = 0; launch < 3; launch++) {
    const elapsed = time + launch * 2.6,
      t = elapsed % 8;
    const x = -12 + launch * 12;
    pose(`rocket-${launch}`, [x, 0.8 + Math.min(t / 2, 1) * 34, -21]);
    molen.patch(`rocket-${launch}`, 'renderable', { visible: t < 2 });
    const age = t - 2,
      visible = age >= 0 && age < 3.7;
    const burst = Math.min(3.7, Math.max(0, age));
    for (let n = 0; n < sparks; n++) {
      // A golden-angle sphere spreads the sparks evenly in three dimensions.
      const angle = n * 2.3999632297 + launch;
      const rise = 1 - (2 * (n + 0.5)) / sparks;
      const radial = molen.math.sqrt(1 - rise * rise);
      const radius = burst * 6;
      pose(`spark-${launch}-${n}`, [
        x + molen.math.cos(angle) * radius * radial,
        35 + rise * radius - burst * burst * 0.8,
        -21 + molen.math.sin(angle) * radius * radial,
      ]);
      molen.patch(`spark-${launch}-${n}`, 'transform', {
        scale: [1, 1 + Math.max(0, burst) * 2, 1],
      });
      molen.patch(`spark-${launch}-${n}`, 'renderable', { visible });
    }
    molen.patch(`flash-${launch}`, 'light', { intensity: visible ? 2800 * (1 - burst / 3.7) : 0 });
    const cycle = Math.floor(elapsed / 8);
    if (visible && bursts[launch] !== cycle) {
      bursts[launch] = cycle;
      molen.emit('diorama.cue', { cue: 'firework-burst', launch, cycle });
    }
  }
  molen.patchState({ bursts });
  for (let n = 0; n < 40; n++) {
    const bounce = n % 5 === 0 ? Math.max(0, molen.math.sin(time * 2 + n)) * 0.08 : 0;
    pose(
      `spectator-${n}`,
      [-27 + (n % 10) * 6, 0.12 + bounce, 11 + Math.floor(n / 10) * 6],
      molen.math.PI,
    );
  }
});
