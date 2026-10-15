import { createPlayback, readyToPlay } from '../../shared/playback';
import '../../shared/accessibility.css';
import { mountExperience } from '@bendyline/molen-client';
import { startAudio } from './audio';
import { arenaScene } from './scene';

// Browser entry: kernel in a Worker, client mounted on it. The scene's `camera` (top-down
// ortho) and `input` (WASD -> move.dir) blocks are applied by mountExperience, so this file
// declares nothing the scene already does. The client never mutates simulation state.
const scene = arenaScene();
const canvas = document.getElementById('view') as HTMLCanvasElement;
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

const mounted = await mountExperience({
  link: worker,
  scene,
  canvas,
  frameLoop: 'manual',
  clearColor: '#1a1d24',
});
const { client, input } = mounted;
await readyToPlay(client);
const toolbar = document.createElement('div');
toolbar.className = 'demo-playback';
canvas.parentElement?.append(toolbar);
const playback = createPlayback({ client, input, canvas, container: toolbar });
function dispose(): void {
  clearInterval(hudTimer);
  void stopAudio.then((stop) => stop());
  playback.dispose();
  mounted.dispose();
  worker.terminate();
}
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) dispose();
});
if (import.meta.hot) import.meta.hot.dispose(dispose);

// Sound: the rules are the scene's audioEnvironment entity; this only loads and plays them.
const stopAudio = startAudio(client, scene.tickRate ?? 30);

// A tiny HUD from mirrored state + events: hit points and kills, no wire-protocol parsing.
const hud = document.createElement('div');
hud.style.cssText =
  'position:fixed;left:12px;top:10px;font:14px system-ui;color:#dfe6ee;pointer-events:none';
canvas.parentElement?.appendChild(hud);
let kills = 0;
client.onEvent('collision', () => {
  kills++;
});
const hudTimer = setInterval(() => {
  const hp = (client.get('player', 'health') as { hp?: number } | undefined)?.hp ?? '–';
  hud.textContent = `hp ${hp} · contacts ${kills}`;
}, 100);

const hint = document.createElement('div');
hint.textContent = 'WASD to move · survive the swarm';
hint.style.cssText =
  'position:fixed;left:12px;bottom:10px;font:13px system-ui;color:#9aa;pointer-events:none';
canvas.parentElement?.appendChild(hint);
