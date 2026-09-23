// Spawn a chaser on a random arena edge every `config.interval` ticks. The component map
// matches the arena.enemy registry type (types/arena.types.json).
molen.on('tick', () => {
  if ((molen.tick + 1) % config.interval !== 0) return;
  const half = config.size / 2 - 1;
  const onX = molen.rng() < 0.5;
  const a = (molen.rng() - 0.5) * 2 * half;
  const b = molen.rng() < 0.5 ? -half : half;
  const pos: [number, number, number] = onX ? [a, 0, b] : [b, 0, a];
  molen.spawnType('arena.enemy', { transform: { pos } });
});
