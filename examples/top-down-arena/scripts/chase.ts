// Every enemy steers straight at the player at `config.speed`.
molen.on('tick', () => {
  const player = molen.get('player', 'transform');
  if (!player) return;
  for (const row of molen.query('tag', 'transform')) {
    const id = row[0];
    const tag = row[1];
    const t = row[2];
    if (tag.name !== 'enemy') continue;
    const dx = player.pos[0] - t.pos[0];
    const dz = player.pos[2] - t.pos[2];
    const len = molen.math.hypot(dx, 0, dz) || 1;
    molen.patch(id, 'kinematicBody', {
      vel: [(dx / len) * config.speed, 0, (dz / len) * config.speed],
    });
  }
});
