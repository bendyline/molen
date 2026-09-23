// Contact damage: an enemy touching the player costs 1 hp and destroys the enemy. The
// `collision` event comes from the kinematics layer (physics.engine = "kinematics").
molen.on('collision', (e) => {
  const involvesPlayer = e.a === 'player' || e.b === 'player';
  if (!involvesPlayer) return;
  const enemy = e.a === 'player' ? e.b : e.a;
  const tag = molen.get(enemy, 'tag');
  if (tag?.name !== 'enemy') return;
  const hp = molen.get('player', 'health');
  if (hp) molen.set('player', 'health', { hp: hp.hp - 1 });
  molen.destroy(enemy);
});
