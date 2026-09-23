// A small complete top-down arena game built only on the engine's data layers. The world,
// the `move` command, the input rules, and the game logic (control / spawner / chaser / combat)
// all live in scene.json + scripts/*.ts; this module only holds the tunables the tests read.

/** Tunables the tests reference; the live values are the scripts' `config` in scene.json. */
export const ARENA = { size: 20, spawnInterval: 12, enemySpeed: 5, playerSpeed: 9 };

export { arenaProject, arenaScene } from './scene';
