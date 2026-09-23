import { mountExperience } from '@bendyline/molen-client';
import { scene } from './scene';
import '../../game-shell.css';

// Presentation only: all rules and durable state live in scene.json + scripts/game.js.
document.body.dataset.game = 'lantern-dungeon';
element('interface').innerHTML =
  `<header class="topbar"><div><div class="eyebrow">MOLEN / 02 / FANTASY EXPLORATION</div><h1>The Lantern Vault</h1><div class="subtitle">A FIRST-PERSON DUNGEON ADVENTURE</div></div><div class="stats"><div class="stat"><label>VITALITY</label><strong id="stat0">100</strong></div><div class="stat"><label>BRASS KEY</label><strong id="stat1">MISSING</strong></div><div class="stat"><label>POTION</label><strong id="stat2">1</strong></div></div></header><div class="bottom"><div class="brief"><div class="label">Enter the vault. Follow the torchlight.</div><p id="message">Loading the experience...</p><div class="controls"><kbd>WASD</kbd> walk &nbsp; <kbd>&larr; &rarr;</kbd> turn &nbsp; click view for mouse look<br/><kbd>Space</kbd> strike &nbsp; <kbd>E</kbd> interact &nbsp; <kbd>H</kbd> potion &nbsp; <kbd>Esc</kbd> release mouse</div></div><div><div class="map-caption">THE VAULT / NORTH</div><div class="map"><svg viewBox="-17 -17 34 34" aria-label="Dungeon map"><rect x="-16" y="-16" width="32" height="32" fill="#283646"/><path d="M-16 -3H-1.5 M1.5 -3H16" stroke="#82919a" stroke-width="2"/><circle cx="-9" cy="6" r=".7" fill="#ffc46b"/><circle cx="0" cy="-12" r=".7" fill="#7cffd9"/><path id="map-player" d="M0 -1.2L.8 1L0 .5L-.8 1Z" fill="#e8cf99"/></svg></div></div></div><div id="outcome" hidden><h2 id="outcome-title"></h2><p id="outcome-detail"></p><button id="restart" type="button">Play again &rarr;</button></div><div id="diagnostic" role="alert"></div><div class="crosshair"></div>`;
const wallMap = scene()
  .entities.filter((e) => e.id?.startsWith('wall-') && !e.id.endsWith('-mortar'))
  .map((e) => {
    const pos = e.components?.transform?.pos as [number, number, number];
    return `<rect x="${pos[0] - 1.5}" y="${pos[2] - 1.5}" width="3" height="3" fill="#768894"/>`;
  })
  .join('');
const map = document.querySelector('.map svg') as SVGSVGElement;
map.insertAdjacentHTML('beforeend', wallMap);
map.appendChild(element('map-player'));
const canvas = document.getElementById('view') as HTMLCanvasElement;
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
const mounted = await mountExperience({
  link: worker,
  scene: scene(),
  canvas,
  antialias: true,
  pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
  sceneOptimization: { maxLocalLights: 6 },
  assets: { baseUrl: new URL('./', location.href).href },
});
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
let assetsLoading = false;
const timer = setInterval(() => {
  const g = client.get('game', 'dungeonGame');
  if (!g) return;
  if (!assetsLoading) {
    assetsLoading = true;
    void client
      .ready()
      .then(() => {
        canvas.dataset.assetsReady = 'true';
      })
      .catch((error: unknown) => diagnostic(String(error)))
      .finally(() => {
        // The worker booted paused (src/worker.ts) so the vault does not run during the load.
        // Resume either way: a model that failed to arrive should degrade the scene, not freeze
        // the game — the diagnostic above already says what went wrong.
        client.control({ action: 'resume' });
      });
  }
  const p = client.get('player', 'transform');
  const pos = p?.pos as number[] | undefined;
  element('message').textContent = String(g.message);
  const outcome = element('outcome');
  outcome.hidden = g.status === 'playing';
  element('outcome-title').textContent = g.status === 'won' ? 'The lantern is yours.' : 'Try again';
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
  canvas.dataset.attackTick = String(g.attackTick);
  element('stat0').textContent = String(g.health);
  element('stat1').textContent = g.key ? 'FOUND' : 'MISSING';
  element('stat2').textContent = String(g.potions);
  if (pos) {
    const rot = p?.rot as [number, number, number, number];
    const yaw = 2 * Math.atan2(rot[1] ?? 0, rot[3] ?? 1);
    canvas.dataset.yaw = String(yaw);
    document
      .getElementById('map-player')
      ?.setAttribute(
        'transform',
        `translate(${pos[0]} ${pos[2]}) rotate(${(-yaw * 180) / Math.PI})`,
      );
  }
}, 80);
// Optional mouse look; keyboard turning remains available without pointer lock.
const lock = (): void => {
  void canvas.requestPointerLock()?.catch(() => {});
};
const look = (event: MouseEvent): void => {
  if (document.pointerLockElement === canvas)
    client.command('look', { yaw: Math.max(-1, Math.min(1, event.movementX * 0.003)) });
};
canvas.addEventListener('click', lock);
document.addEventListener('mousemove', look);
function dispose(): void {
  clearInterval(timer);
  mounted.dispose();
  worker.terminate();
  canvas.removeEventListener('click', lock);
  document.removeEventListener('mousemove', look);
}
window.addEventListener('pagehide', dispose, { once: true });
if (import.meta.hot) import.meta.hot.dispose(dispose);
