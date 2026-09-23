import { mountExperience } from '@bendyline/molen-client';
import { scene } from './scene';
import '../../game-shell.css';

// Presentation only: all rules and durable state live in scene.json + scripts/game.js.
document.body.dataset.game = 'skybound';
element('interface').innerHTML =
  `<header class="topbar"><div><div class="eyebrow">MOLEN / 03 / PLATFORM ADVENTURE</div><h1>Skybound</h1><div class="subtitle">A LITTLE LEAP GOES A LONG WAY</div></div><div class="stats"><div class="stat"><label>SEEDS</label><strong id="stat0">0 / 15</strong></div><div class="stat"><label>LIVES</label><strong id="stat1">3</strong></div><div class="stat"><label>CHECKPOINT</label><strong id="stat2">START</strong></div></div></header><div class="bottom"><div class="brief"><div class="label">Five islands. One lighthouse.</div><p id="message">Loading the experience...</p><div class="controls"><kbd>A D / &larr; &rarr;</kbd> run &nbsp; <kbd>Space</kbd> jump (hold for height)<br/>Stomp the purple creatures. Avoid pink thorns. &nbsp; <kbd>R</kbd> restart</div></div><div class="brief"><div class="label">TO THE LIGHTHOUSE</div><div class="progress"><span id="progress"></span></div><div class="controls">Eastbound &middot; 75 meters</div></div></div><div id="outcome" hidden><h2 id="outcome-title"></h2><p id="outcome-detail"></p><button id="restart" type="button">Play again &rarr;</button></div><div id="diagnostic" role="alert"></div>`;
const canvas = document.getElementById('view') as HTMLCanvasElement;
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
const mounted = await mountExperience({ link: worker, scene: scene(), canvas, antialias: true });
const { client } = mounted;
function element(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`Missing UI element: ${id}`);
  return node;
}
const diagnostic = (message: string): void => {
  element('diagnostic').textContent = message;
};
worker.addEventListener('error', (event) => diagnostic(event.message));
client.onDiag((d) => {
  if (d.code !== 'tick-overrun') diagnostic(`${d.code}: ${JSON.stringify(d.detail)}`);
});
client.onEvent('script-error', (e) => diagnostic(JSON.stringify(e.payload)));
element('restart').addEventListener('click', () => {
  client.command('restart');
  canvas.focus();
});
const timer = setInterval(() => {
  const g = client.get('game', 'skyGame');
  if (!g) return;
  const p = client.get('player', 'transform');
  const pos = p?.pos as number[] | undefined;
  element('message').textContent = String(g.message);
  const outcome = element('outcome');
  outcome.hidden = g.status === 'playing';
  element('outcome-title').textContent = g.status === 'won' ? 'You made it!' : 'Try again';
  element('outcome-detail').textContent =
    g.status === 'won'
      ? 'A complete adventure, powered by Molen.'
      : 'A fresh start is one key away.';
  // Read-only browser telemetry: useful to both automation and human inspectors.
  canvas.dataset.tick = String(client.tick);
  canvas.dataset.status = String(g.status);
  canvas.dataset.x = String(pos?.[0] ?? 0);
  canvas.dataset.y = String(pos?.[1] ?? 0);
  canvas.dataset.z = String(pos?.[2] ?? 0);
  element('stat0').textContent = `${g.coins} / ${g.total}`;
  element('stat1').textContent = String(g.lives);
  element('stat2').textContent = g.checkpoint ? 'SAVED' : 'START';
  element('progress').style.width = `${Math.max(0, Math.min(100, ((pos?.[0] ?? 0) / 75) * 100))}%`;
}, 80);
function dispose(): void {
  clearInterval(timer);
  mounted.dispose();
  worker.terminate();
}
window.addEventListener('pagehide', dispose, { once: true });
if (import.meta.hot) import.meta.hot.dispose(dispose);
