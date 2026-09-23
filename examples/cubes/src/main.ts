import { mountExperience } from '@bendyline/molen-client';
import { validate } from '@bendyline/molen-schema';
import sceneDoc from '../scene.json';

// Browser entry: the kernel runs in a Worker (see worker.ts); this side mounts the client on
// it. The scene's own `camera` and `input` blocks drive framing and the Space -> spawn_cube
// command, so nothing here re-implements what scene.json already declares.
const scene = validate('scene', sceneDoc);
if (!scene.ok) throw new Error(scene.formatted);

const canvas = document.getElementById('view') as HTMLCanvasElement;
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

await mountExperience({ link: worker, scene: scene.value, canvas, clearColor: '#11131a' });

// Tiny on-screen hint.
const hint = document.createElement('div');
hint.textContent = 'press SPACE to spawn a cube';
hint.style.cssText =
  'position:fixed;left:12px;bottom:10px;font:13px system-ui;color:#9aa;pointer-events:none';
document.body.appendChild(hint);
