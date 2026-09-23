// Player control: the `move` command (declared in scene.json with its payload schema, emitted
// by the scene's axis2d input rule) sets the player's planar velocity. Pure scene data — no
// setup module, no build step.
molen.onCommand('move', (p) => {
  molen.patch('player', 'kinematicBody', {
    vel: [p.dir[0] * config.playerSpeed, 0, p.dir[1] * config.playerSpeed],
  });
});
