import { mountExperience } from '@bendyline/molen-client';
import { scene } from './scene';
import '../../game-shell.css';

// Presentation only: all rules and durable state live in scene.json + scripts/game.js.
document.body.dataset.game = 'city-courier';
element('interface').innerHTML =
  `<header class="topbar"><div><div class="eyebrow">MOLEN / 01 / ARCADE DRIVING</div><h1>City Courier</h1><div class="subtitle">A SMALL CITY. FIVE DELIVERIES.</div></div><div class="stats"><div class="stat"><label>DELIVERIES</label><strong id="stat0">0 / 5</strong></div><div class="stat"><label>TIME LEFT</label><strong id="stat1">120 s</strong></div><div class="stat"><label>CONDITION</label><strong id="stat2">100%</strong></div></div></header><div class="bottom"><div class="brief"><div class="label">WASD / arrows steer & accelerate.</div><p id="message">Loading the experience...</p><div class="controls"><kbd>W S</kbd> accelerate / reverse &nbsp; <kbd>A D</kbd> steer<br/><kbd>Space</kbd> handbrake &nbsp; <kbd>R</kbd> new route</div></div><div><div class="map-caption">DELIVERY GRID</div><div class="map"><svg viewBox="-38 -38 76 76" aria-label="City route map"><path d="M-24 -35V35 M0 -35V35 M24 -35V35 M-35 -24H35 M-35 0H35 M-35 24H35" stroke="#526775" stroke-width="5"/><circle id="destination" r="3" fill="#7cffd9"/><path id="map-player" d="M0 -2.7L1.7 2L0 1L-1.7 2Z" fill="#ffc46b"/></svg></div></div></div><div id="outcome" hidden><h2 id="outcome-title"></h2><p id="outcome-detail"></p><button id="restart" type="button">Play again &rarr;</button></div><div id="diagnostic" role="alert"></div>`;
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
  const g = client.get('game', 'courierGame');
  if (!g) return;
  const p = client.get('player', 'transform');
  const pos = p?.pos as number[] | undefined;
  element('message').textContent = String(g.message);
  const outcome = element('outcome');
  outcome.hidden = g.status === 'playing';
  element('outcome-title').textContent = g.status === 'won' ? 'Route complete!' : 'Try again';
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
  element('stat0').textContent = `${g.delivered} / ${g.total}`;
  element('stat1').textContent = `${g.seconds} s`;
  element('stat2').textContent = `${g.health}%`;
  const route = [
    [0, -20],
    [24, -20],
    [24, 20],
    [0, 20],
    [0, 0],
  ];
  const destination = route[Number(g.delivered)];
  document
    .getElementById('destination')
    ?.setAttribute('transform', `translate(${destination?.[0] ?? 0} ${destination?.[1] ?? 0})`);
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
function dispose(): void {
  clearInterval(timer);
  mounted.dispose();
  worker.terminate();
}
window.addEventListener('pagehide', dispose, { once: true });
if (import.meta.hot) import.meta.hot.dispose(dispose);
