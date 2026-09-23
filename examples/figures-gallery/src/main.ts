import { mountExperience } from '@bendyline/molen-client';
import { figureKind } from '@bendyline/molen-figures/client';
import { validate } from '@bendyline/molen-schema';
import sceneDoc from '../scene.json';

// Browser entry: the kernel runs in a Worker (worker.ts); this side mounts the client with the
// figure renderable kind. Keys 1/2/3 (or ?walk=1 / ?run=1) send the scene's `set_gait` command.
const scene = validate('scene', sceneDoc);
if (!scene.ok) throw new Error(scene.formatted);

const canvas = document.getElementById('view') as HTMLCanvasElement;
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

const { client } = await mountExperience({
  link: worker,
  scene: scene.value,
  canvas,
  clearColor: '#1b2130',
  kinds: [figureKind()],
});

// Status for headless checks: the kernel tick, the mirrored entity count, and asset readiness.
const status = setInterval(() => {
  if (client.tick === undefined) return;
  canvas.dataset.tick = String(client.tick);
  canvas.dataset.entities = String(client.entities().length);
}, 100);
void client.ready().then(() => {
  canvas.dataset.ready = 'true';
});
window.addEventListener('beforeunload', () => clearInterval(status));

const params = new URLSearchParams(location.search);
const initial = params.get('run') === '1' ? 'run' : params.get('walk') === '1' ? 'walk' : undefined;
if (initial !== undefined) {
  // The first keyframe lands asynchronously; the command is queued for the next tick.
  setTimeout(() => client.command('set_gait', { mode: initial }), 300);
}

const hint = document.createElement('div');
hint.textContent = 'press 1 (idle), 2 (walk) or 3 (run)';
hint.style.cssText =
  'position:fixed;left:12px;bottom:10px;font:13px system-ui;color:#9aa;pointer-events:none';
document.body.appendChild(hint);
