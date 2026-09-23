// Collect, stomp, checkpoint, finish. The platformer service owns movement and all solid collision.
const game = () => molen.get('game', 'skyGame');
const update = (value: Partial<MolenSkyGameData>) => molen.patch('game', 'skyGame', value);
function placePlayer(pos: [number, number, number]) {
  molen.patch('player', 'transform', { pos, teleport: true });
  molen.patch('player', 'platformBody', { vel: [0, 0], grounded: false, grace: 0, buffered: 0 });
  molen.patch('player', 'platformIntent', { move: 0, jump: false, jumpHeld: false });
}
molen.onCommand('move', (p) => {
  if (game()?.status === 'playing') molen.patch('player', 'platformIntent', { move: p.dir[0] });
});
molen.onCommand('jump', (p) => {
  if (game()?.status === 'playing')
    molen.patch('player', 'platformIntent', {
      ...(p.held ? { jump: true } : {}),
      jumpHeld: p.held,
    });
});
molen.onCommand('restart', () => {
  placePlayer(config.spawn);
  update({
    status: 'playing',
    lives: 3,
    coins: 0,
    checkpoint: 0,
    message: 'Follow the floating seeds to the lighthouse.',
  });
  molen.patchState({ invincibleUntil: molen.tick + 30 });
  for (const [id] of molen.query('seedPickup')) {
    molen.patch(id, 'seedPickup', { collected: false });
    molen.patch(id, 'renderable', { visible: true });
  }
  for (const [id, patrol] of molen.query('patrol')) {
    molen.patch(id, 'patrol', { alive: true, direction: 1 });
    molen.patch(id, 'renderable', { visible: true });
    molen.patch(id, 'transform', { pos: [patrol.left, 1, 0], teleport: true });
  }
});
function hurt() {
  const g = game();
  if (g === undefined || molen.tick < (molen.state.invincibleUntil ?? 0)) return;
  const lives = g.lives - 1;
  update({
    lives,
    status: lives === 0 ? 'lost' : 'playing',
    message:
      lives === 0
        ? 'Out of lives. Press R for a fresh adventure.'
        : 'Back on your feet. Try a longer jump.',
  });
  placePlayer(g.checkpoint ? config.checkpoint : config.spawn);
  molen.patchState({ invincibleUntil: molen.tick + 30 });
  molen.emit('respawn', { lives });
}
molen.on('tick', () => {
  const g = game();
  const playerT = molen.get('player', 'transform');
  if (g === undefined || playerT === undefined) return;
  const p = playerT.pos;
  molen.patch('camera-target', 'transform', { pos: [molen.math.clamp(p[0] + 4, 4, 73), 0, 0] });
  if (g.status !== 'playing') {
    molen.patch('player', 'platformIntent', { move: 0, jump: false });
    return;
  }
  molen.patch('player', 'transform', { teleport: false });
  if (p[1] < -6) {
    hurt();
    return;
  }
  for (const [id, t, seed] of molen.query('transform', 'seedPickup')) {
    if (!seed.collected && molen.math.hypot(p[0] - t.pos[0], p[1] - t.pos[1]) < 0.95) {
      molen.patch(id, 'seedPickup', { collected: true });
      molen.patch(id, 'renderable', { visible: false });
      update({ coins: g.coins + 1 });
      molen.emit('seed-collected', { entity: id });
    }
  }
  if (!g.checkpoint && p[0] >= 37 && p[1] > 0.6) {
    update({ checkpoint: 1, message: 'Checkpoint reached. The lighthouse is just ahead.' });
    molen.emit('checkpoint', {});
  }
  for (const [, t, tag] of molen.query('transform', 'tag')) {
    if (
      tag.name === 'hazard' &&
      molen.math.abs(p[0] - t.pos[0]) < 0.85 &&
      molen.math.abs(p[1] - t.pos[1]) < 0.8
    ) {
      hurt();
      return;
    }
  }
  for (const [id, t, patrol] of molen.query('transform', 'patrol')) {
    if (!patrol.alive) continue;
    const direction =
      t.pos[0] >= patrol.right ? -1 : t.pos[0] <= patrol.left ? 1 : patrol.direction;
    molen.patch(id, 'patrol', { direction });
    molen.patch(id, 'transform', {
      pos: [t.pos[0] + direction * 1.7 * molen.dt, t.pos[1], 0],
      teleport: false,
    });
    if (molen.math.abs(p[0] - t.pos[0]) < 0.72 && molen.math.abs(p[1] - t.pos[1]) < 1.1) {
      const body = molen.get('player', 'platformBody');
      if (body === undefined) return;
      if ((body.vel?.[1] ?? 0) < 0 && p[1] - 0.65 > t.pos[1] + 0.05) {
        molen.patch(id, 'patrol', { alive: false });
        molen.patch(id, 'renderable', { visible: false });
        molen.patch('player', 'platformBody', { vel: [body.vel?.[0] ?? 0, 10], grounded: false });
        molen.emit('stomp', { entity: id });
      } else {
        hurt();
        return;
      }
    }
  }
  if (p[0] >= config.finish && p[1] > 0.6) {
    update({ status: 'won', message: 'The lighthouse is lit! Press R to collect every seed.' });
    molen.emit('victory', {});
  }
});
