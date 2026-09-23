// First-person dungeon rules. All aim/movement is authoritative, command-driven simulation.
const game = () => molen.get('game', 'dungeonGame');
const update = (value: Partial<MolenDungeonGameData>) => molen.patch('game', 'dungeonGame', value);
molen.patchState({
  dir: molen.state.dir ?? [0, 0],
  turn: molen.state.turn ?? 0,
  yaw: molen.state.yaw ?? 0,
});
function facing(): [number, number, number] {
  return [-molen.math.sin(molen.state.yaw), 0, -molen.math.cos(molen.state.yaw)];
}
function distance(a: readonly number[], b: readonly number[]) {
  return molen.math.hypot(a[0] - b[0], a[2] - b[2]);
}
function reset() {
  molen.setState({ dir: [0, 0], turn: 0, yaw: 0 });
  molen.patch('player', 'transform', { pos: config.spawn, rot: [0, 0, 0, 1], teleport: true });
  molen.patch('player', 'kinematicBody', { vel: [0, 0, 0] });
  update({
    status: 'playing',
    health: 100,
    key: false,
    doorOpen: false,
    potions: 1,
    kills: 0,
    roll: 0,
    attackTick: -100,
    message: 'Find the brass key. Open the north gate. Claim the lantern.',
  });
  molen.patch('key', 'renderable', { visible: true });
  molen.patch('held-sword', 'renderable', {
    animation: {
      clip: 'attack',
      loop: 'once',
      startTick: molen.tick,
      paused: true,
      pausedAtTick: molen.tick,
    },
  });
  molen.cancelTween('gate');
  molen.patch('gate', 'transform', { pos: [config.gate[0], 1.5, config.gate[2]] });
  molen.set('gate', 'collider', {
    shape: 'aabb',
    halfExtents: [1.5, 0.25],
    layer: 1,
    mask: 6,
    isStatic: true,
  });
  for (const [id, enemy] of molen.query('sentinel')) {
    molen.patch(id, 'sentinel', { hp: 14, alive: true, attackAt: 0 });
    molen.patch(id, 'transform', { pos: enemy.home, teleport: true });
    molen.patch(id, 'renderable', { visible: true });
    molen.set(id, 'collider', { shape: 'circle', radius: 0.48, layer: 2, mask: 5 });
  }
}
molen.onCommand('restart', reset);
molen.onCommand('move', (p) => molen.patchState({ dir: p.dir }));
molen.onCommand('turn', (p) => molen.patchState({ turn: p.dir[0] }));
molen.onCommand('look', (p) => {
  if (game()?.status === 'playing') molen.patchState({ yaw: molen.state.yaw - p.yaw });
});
molen.onCommand('heal', () => {
  const g = game();
  if (g === undefined || g.status !== 'playing' || g.potions === 0) return;
  update({
    potions: 0,
    health: molen.math.min(100, g.health + 45),
    message: 'Restored 45 vitality.',
  });
  molen.emit('heal', {});
});
molen.onCommand('attack', () => {
  const g = game();
  if (g === undefined || g.status !== 'playing' || molen.tick - g.attackTick < 12) return;
  update({ attackTick: molen.tick });
  molen.patch('held-sword', 'renderable', {
    animation: { clip: 'attack', loop: 'once', startTick: molen.tick },
  });
  const eye = molen.get('player', 'transform');
  if (eye === undefined) return;
  const hit = molen.raycast(eye.pos, facing(), 2.6, 3);
  if (!hit || !molen.has(hit.id, 'sentinel')) {
    update({ message: 'Your blade cuts the air. Move closer and aim at a sentinel.' });
    return;
  }
  const enemy = molen.get(hit.id, 'sentinel');
  if (enemy === undefined || !enemy.alive) return;
  const roll = 1 + molen.math.floor(molen.rng() * 6);
  const hp = molen.math.max(0, enemy.hp - roll - 3);
  molen.patch(hit.id, 'sentinel', { hp, alive: hp > 0 });
  update({
    roll,
    message: `Strike: d6 rolled ${roll} + 3 damage.`,
    kills: g.kills + (hp === 0 ? 1 : 0),
  });
  molen.emit('strike', { entity: hit.id, roll, damage: roll + 3 });
  if (hp === 0) {
    molen.remove(hit.id, 'collider');
    molen.patch(hit.id, 'kinematicBody', { vel: [0, 0, 0] });
    molen.patch(hit.id, 'renderable', { visible: false });
  }
});
molen.onCommand('interact', () => {
  const g = game();
  const playerT = molen.get('player', 'transform');
  if (g === undefined || playerT === undefined || g.status !== 'playing') return;
  const p = playerT.pos;
  const hit = molen.raycast(p, facing(), 3, 1);
  if (hit?.id === 'gate' && !g.doorOpen) {
    if (!g.key) {
      update({ message: 'The north gate needs the brass key.' });
      return;
    }
    molen.remove('gate', 'collider');
    molen.tween('gate', { component: 'transform', path: 'pos[1]', to: 4.6, ticks: 24 });
    update({ doorOpen: true, message: 'The gate opens. Claim the lantern beyond.' });
    molen.emit('gate-opened', {});
  } else if (g.doorOpen && distance(p, config.exit) < 2.5) {
    update({
      status: 'won',
      message: 'The lantern is yours. The vault is free. Press R to explore again.',
    });
    molen.emit('victory', {});
  } else update({ message: 'Look toward the north gate, or approach the lantern to claim it.' });
});
molen.on('tick', () => {
  const g = game();
  if (g === undefined) return;
  if (g.status !== 'playing') {
    molen.patch('player', 'kinematicBody', { vel: [0, 0, 0] });
    for (const [id] of molen.query('sentinel'))
      molen.patch(id, 'kinematicBody', { vel: [0, 0, 0] });
    return;
  }
  const yaw = molen.state.yaw - molen.state.turn * config.turnSpeed * molen.dt;
  molen.patchState({ yaw });
  const [x, z] = molen.state.dir;
  const factor = config.speed / molen.math.max(1, molen.math.hypot(x, z));
  const sin = molen.math.sin(yaw);
  const cos = molen.math.cos(yaw);
  molen.patch('player', 'kinematicBody', {
    vel: [(x * cos + z * sin) * factor, 0, (-x * sin + z * cos) * factor],
  });
  molen.patch('player', 'transform', {
    rot: [0, molen.math.sin(yaw / 2), 0, molen.math.cos(yaw / 2)],
    teleport: false,
  });
  const moved = molen.get('player', 'transform');
  if (moved === undefined) return;
  const p = moved.pos;
  if (!g.key && distance(p, config.key) < 1.2) {
    update({ key: true, message: 'Brass key found. Face the north gate and press E.' });
    molen.patch('key', 'renderable', { visible: false });
    molen.emit('key-found', {});
  }
  for (const [id, t, enemy] of molen.query('transform', 'sentinel')) {
    if (!enemy.alive) continue;
    const d = distance(p, t.pos);
    const dir: [number, number, number] = [
      (p[0] - t.pos[0]) / (d || 1),
      0,
      (p[2] - t.pos[2]) / (d || 1),
    ];
    const sight = molen.raycast(t.pos, dir, d, 1);
    const chase = d < 8 && !sight;
    molen.patch(id, 'kinematicBody', {
      vel: chase && d > 1 ? [dir[0] * 1.5, 0, dir[2] * 1.5] : [0, 0, 0],
    });
    const angle = molen.math.atan2(-dir[0], -dir[2]);
    molen.patch(id, 'transform', {
      rot: [0, molen.math.sin(angle / 2), 0, molen.math.cos(angle / 2)],
      teleport: false,
    });
    if (chase && d < 1.4 && molen.tick >= enemy.attackAt) {
      molen.patch(id, 'sentinel', { attackAt: molen.tick + 30 });
      const health = molen.math.max(0, g.health - 12);
      update({
        health,
        status: health === 0 ? 'lost' : 'playing',
        message:
          health === 0
            ? 'The vault claims another traveler. Press R to retry.'
            : 'A sentinel strikes! Space to attack. H drinks your potion.',
      });
      molen.emit('hurt', { health });
    }
  }
});
