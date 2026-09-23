// Arcade handling and mission rules. Collision, hierarchy and camera tracking are engine services.
const game = () => molen.get('game', 'courierGame');
const update = (data: Partial<MolenCourierGameData>) => molen.patch('game', 'courierGame', data);
molen.patchState({
  dir: molen.state.dir ?? [0, 0],
  brake: molen.state.brake ?? false,
  heading: molen.state.heading ?? 0,
  started: molen.state.started ?? molen.tick,
  hitAt: molen.state.hitAt ?? -60,
});
function reset() {
  molen.setState({ dir: [0, 0], brake: false, heading: 0, started: molen.tick, hitAt: -60 });
  molen.patch('player', 'transform', { pos: [0, 0.55, 12], rot: [0, 0, 0, 1], teleport: true });
  molen.patch('player', 'kinematicBody', { vel: [0, 0, 0] });
  update({
    status: 'playing',
    health: 100,
    delivered: 0,
    seconds: config.duration,
    speed: 0,
    message: 'Deliver the five beacons before time runs out.',
  });
  placeBeacon(0);
  for (const [id, car] of molen.query('trafficCar')) {
    molen.patch(id, 'transform', { pos: [car.lane, 0.55, car.start], teleport: true });
    molen.patch(id, 'kinematicBody', { vel: [0, 0, car.speed] });
  }
}
function placeBeacon(index: number) {
  const point = config.route[index];
  if (!point) {
    molen.patch('beacon', 'renderable', { visible: false });
    molen.patch('beacon-pillar', 'renderable', { visible: false });
    return;
  }
  for (const id of ['beacon', 'beacon-pillar']) {
    molen.patch(id, 'renderable', { visible: true });
    molen.patch(id, 'transform', { pos: [point[0], id === 'beacon' ? 0.12 : 2, point[1]] });
  }
}
molen.onCommand('drive', (p) => molen.patchState({ dir: p.dir }));
molen.onCommand('brake', (p) => molen.patchState({ brake: p.held }));
molen.onCommand('restart', reset);
molen.on('collision', (p) => {
  const g = game();
  if (
    !g ||
    (p.a !== 'player' && p.b !== 'player') ||
    g.status !== 'playing' ||
    molen.tick - molen.state.hitAt < 20
  )
    return;
  const speed = g.speed;
  if (speed < 3) return;
  molen.patchState({ hitAt: molen.tick });
  const health = molen.math.max(0, g.health - molen.math.ceil(speed * 1.5));
  update({
    health,
    status: health === 0 ? 'lost' : 'playing',
    message:
      health === 0
        ? 'Car totaled. Press R for another run.'
        : 'Collision! Ease off and use the handbrake.',
  });
  molen.emit('crash', { health });
});
molen.on('tick', () => {
  const g = game();
  const playerT = molen.get('player', 'transform');
  const body = molen.get('player', 'kinematicBody');
  if (!g || !playerT || !body) return;
  const p = playerT.pos;
  const seconds = molen.math.max(
    0,
    config.duration - molen.math.floor((molen.tick - molen.state.started) * molen.dt),
  );
  if (g.status !== 'playing' || seconds === 0) {
    molen.patch('player', 'kinematicBody', { vel: [0, 0, 0] });
    if (seconds === 0 && g.status === 'playing')
      update({ status: 'lost', seconds: 0, message: 'Time is up. Press R to retry the route.' });
    return;
  }
  const v = body.vel;
  let heading = molen.state.heading;
  let forward = -v[0] * molen.math.sin(heading) - v[2] * molen.math.cos(heading);
  const throttle = -molen.state.dir[1];
  forward += throttle * config.acceleration * molen.dt;
  const drag = molen.state.brake ? 8 : throttle === 0 ? 1.5 : 0.35;
  forward *= molen.math.max(0, 1 - drag * molen.dt);
  forward = molen.math.clamp(forward, -7, config.maxSpeed);
  heading -= molen.state.dir[0] * config.steering * molen.math.clamp(forward / 7, -1, 1) * molen.dt;
  const grip = molen.state.brake ? 0.35 : 0.55;
  const vx = -molen.math.sin(heading) * forward;
  const vz = -molen.math.cos(heading) * forward;
  molen.patchState({ heading });
  molen.patch('player', 'transform', {
    rot: [0, molen.math.sin(heading / 2), 0, molen.math.cos(heading / 2)],
    teleport: false,
  });
  molen.patch('player', 'kinematicBody', {
    vel: [v[0] + (vx - v[0]) * grip, 0, v[2] + (vz - v[2]) * grip],
  });
  update({ speed: molen.math.hypot(vx, vz), seconds });
  const point = config.route[g.delivered];
  if (point && molen.math.hypot(p[0] - point[0], p[2] - point[1]) < 3) {
    const delivered = g.delivered + 1;
    update({
      delivered,
      status: delivered === g.total ? 'won' : 'playing',
      message:
        delivered === g.total
          ? 'Route complete. Nice driving! Press R to go again.'
          : 'Delivery complete. Follow the next mint beacon.',
    });
    placeBeacon(delivered);
    molen.emit('delivery', { delivered });
  }
  for (const [id, t, car] of molen.query('transform', 'trafficCar')) {
    if (t.pos[2] > car.to || t.pos[2] < car.from)
      molen.patch(id, 'transform', {
        pos: [car.lane, 0.55, car.speed > 0 ? car.from : car.to],
        teleport: true,
      });
    else molen.patch(id, 'transform', { teleport: false });
    molen.patch(id, 'kinematicBody', { vel: [0, 0, car.speed] });
  }
});
