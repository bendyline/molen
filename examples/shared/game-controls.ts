import { describeGame, type GameKind, type GameReader } from './game-descriptions';
import { createPlayback, type PlaybackClient, type PlaybackInput } from './playback';
import './accessibility.css';

type Payload = { dir: number[] } | { held: boolean } | { yaw: number };
type Command = [type: string, payload?: Payload];
interface GameClient extends PlaybackClient, GameReader {
  command(type: string, payload?: Payload): void;
  onEvent(type: string, callback: (event: { type: string }) => void): () => void;
}
interface Action {
  label: string;
  commands: Command[];
  ticks: number;
}
const cmd = (type: string, payload?: Payload): Command => [type, payload];
export function gameActions(kind: GameKind): Action[] {
  if (kind === 'skybound')
    return [
      { label: 'Step east', commands: [cmd('move', { dir: [1, 0] })], ticks: 6 },
      { label: 'Step west', commands: [cmd('move', { dir: [-1, 0] })], ticks: 6 },
      {
        label: 'Jump east',
        commands: [cmd('move', { dir: [1, 0] }), cmd('jump', { held: true })],
        ticks: 24,
      },
      {
        label: 'Jump west',
        commands: [cmd('move', { dir: [-1, 0] }), cmd('jump', { held: true })],
        ticks: 24,
      },
      { label: 'Jump straight up', commands: [cmd('jump', { held: true })], ticks: 24 },
      { label: 'Wait briefly', commands: [], ticks: 6 },
    ];
  if (kind === 'courier')
    return [
      { label: 'Accelerate', commands: [cmd('drive', { dir: [0, -1] })], ticks: 15 },
      { label: 'Accelerate and steer left', commands: [cmd('drive', { dir: [-1, -1] })], ticks: 6 },
      { label: 'Accelerate and steer right', commands: [cmd('drive', { dir: [1, -1] })], ticks: 6 },
      { label: 'Steer left while coasting', commands: [cmd('drive', { dir: [-1, 0] })], ticks: 6 },
      { label: 'Steer right while coasting', commands: [cmd('drive', { dir: [1, 0] })], ticks: 6 },
      { label: 'Reverse', commands: [cmd('drive', { dir: [0, 1] })], ticks: 6 },
      { label: 'Brake', commands: [cmd('brake', { held: true })], ticks: 15 },
      { label: 'Coast briefly', commands: [], ticks: 6 },
    ];
  return [
    { label: 'Walk forward', commands: [cmd('move', { dir: [0, -1] })], ticks: 6 },
    { label: 'Walk backward', commands: [cmd('move', { dir: [0, 1] })], ticks: 6 },
    { label: 'Step left', commands: [cmd('move', { dir: [-1, 0] })], ticks: 6 },
    { label: 'Step right', commands: [cmd('move', { dir: [1, 0] })], ticks: 6 },
    { label: 'Turn left 45 degrees', commands: [cmd('look', { yaw: -Math.PI / 4 })], ticks: 1 },
    { label: 'Turn right 45 degrees', commands: [cmd('look', { yaw: Math.PI / 4 })], ticks: 1 },
    { label: 'Strike', commands: [cmd('attack')], ticks: 13 },
    { label: 'Interact', commands: [cmd('interact')], ticks: 1 },
    { label: 'Drink potion', commands: [cmd('heal')], ticks: 1 },
    { label: 'Wait briefly', commands: [], ticks: 6 },
  ];
}
function neutral(kind: GameKind): Command[] {
  return kind === 'courier'
    ? [cmd('drive', { dir: [0, 0] }), cmd('brake', { held: false })]
    : kind === 'skybound'
      ? [cmd('move', { dir: [0, 0] }), cmd('jump', { held: false })]
      : [cmd('move', { dir: [0, 0] }), cmd('turn', { dir: [0, 0] })];
}

export function createGameControls(options: {
  kind: GameKind;
  client: GameClient;
  input?: PlaybackInput | undefined;
  canvas: HTMLCanvasElement;
}): { restart(): void; dispose(): void } {
  const { kind, client, input, canvas } = options;
  const main = canvas.parentElement as HTMLElement;
  const toolbar = document.createElement('nav');
  toolbar.className = 'access-toolbar';
  toolbar.setAttribute('aria-label', 'Game options');
  main.append(toolbar);
  const header = document.querySelector('.topbar');
  const headerObserver = new ResizeObserver(() => {
    main.style.setProperty(
      '--game-header-height',
      `${header?.getBoundingClientRect().height ?? 0}px`,
    );
  });
  if (header) headerObserver.observe(header);
  const playback = createPlayback({ client, input, canvas, container: toolbar });
  const button = (name: string, parent: HTMLElement, action: () => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = name;
    b.addEventListener('click', action);
    parent.append(b);
    return b;
  };
  let textMode = false;
  let busy = false;
  let disposed = false;
  const panel = document.createElement('section');
  panel.id = 'text-play';
  panel.className = 'text-play-panel';
  panel.hidden = true;
  panel.setAttribute('aria-labelledby', 'text-play-title');
  panel.innerHTML =
    '<h1 id="text-play-title" tabindex="-1">Text play</h1><p>The world waits while you read. Each action advances a short, fixed amount of game time, then pauses again. The same collisions, hazards, objectives and score apply. Coordinates use east and south as positive directions.</p><p id="text-summary" role="status" aria-atomic="true"></p><label class="fine-actions"><input id="fine-actions" type="checkbox" /> Precise actions: 2 ticks per action</label><div class="text-actions" role="group" aria-label="Game actions"></div><h2>Surroundings and objectives</h2><ul id="text-surroundings"></ul>';
  (panel.querySelector('h1') as HTMLElement).textContent =
    `${kind === 'courier' ? 'City Courier' : kind === 'skybound' ? 'Skybound' : 'The Lantern Vault'} — Text play`;
  main.append(panel);
  const live = document.createElement('p');
  live.className = 'access-sr-only';
  live.setAttribute('role', 'status');
  live.setAttribute('aria-atomic', 'true');
  main.append(live);
  const summary = panel.querySelector('#text-summary') as HTMLElement;
  const surroundings = panel.querySelector('ul') as HTMLElement;
  function describe(): void {
    canvas.dataset.tick = String(client.tick);
    const description = describeGame(kind, client, true);
    summary.textContent = description.summary;
    surroundings.replaceChildren(
      ...description.surroundings.map((text) => {
        const li = document.createElement('li');
        li.textContent = text;
        return li;
      }),
    );
  }
  const textToggle = button('Text play', toolbar, () => {
    if (busy) return;
    textMode = !textMode;
    playback.setPaused(true);
    playback.setVisible(!textMode);
    playback.button.hidden = textMode;
    touchToggle.hidden = textMode;
    panel.hidden = !textMode;
    document.body.classList.toggle('text-play', textMode);
    canvas.setAttribute('aria-hidden', String(textMode));
    canvas.tabIndex = textMode ? -1 : 0;
    textToggle.textContent = textMode ? 'Return to visual play' : 'Text play';
    textToggle.setAttribute('aria-expanded', String(textMode));
    if (textMode) {
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      describe();
      (panel.querySelector('h1') as HTMLElement).focus();
    } else {
      textToggle.focus();
      live.textContent = 'Visual play is paused. Choose Resume animation to continue.';
    }
  });
  textToggle.setAttribute('aria-controls', panel.id);
  textToggle.setAttribute('aria-expanded', 'false');
  const touch = document.createElement('fieldset');
  touch.className = 'touch-controls';
  touch.id = 'touch-controls';
  touch.innerHTML = '<legend>Hold to move; combine buttons to move and act</legend>';
  main.append(touch);
  let showTouch = matchMedia('(any-pointer: coarse)').matches;
  touch.hidden = !showTouch;
  const touchToggle = button('Touch controls', toolbar, () => {
    showTouch = !showTouch;
    touch.hidden = !showTouch;
    touchToggle.setAttribute('aria-expanded', String(showTouch));
    clearTouch();
  });
  touchToggle.setAttribute('aria-controls', touch.id);
  touchToggle.setAttribute('aria-expanded', String(showTouch));
  const cleanups: Array<() => void> = [];
  const resets: Array<() => void> = [];
  function clearTouch(): void {
    for (const reset of resets) reset();
  }
  const keys: [string, string][] =
    kind === 'skybound'
      ? [
          ['West', 'left'],
          ['East', 'right'],
          ['Jump', 'jump'],
        ]
      : kind === 'courier'
        ? [
            ['Left', 'left'],
            ['Forward', 'up'],
            ['Right', 'right'],
            ['Reverse', 'down'],
            ['Brake', 'brake'],
          ]
        : [
            ['Left', 'left'],
            ['Forward', 'up'],
            ['Right', 'right'],
            ['Back', 'down'],
            ['Turn left', 'turnLeft'],
            ['Turn right', 'turnRight'],
            ['Strike', 'attack'],
            ['Interact', 'interact'],
            ['Potion', 'heal'],
          ];
  for (const [label, action] of keys) {
    const b = button(label, touch, () => {});
    b.dataset.action = action;
    const source = `touch-${action}`;
    let pointer: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reset = (): void => {
      clearTimeout(timer);
      timer = undefined;
      const captured = pointer;
      pointer = undefined;
      if (captured !== undefined && b.hasPointerCapture(captured))
        b.releasePointerCapture(captured);
      input?.clearVirtual(source);
      b.removeAttribute('data-held');
    };
    resets.push(reset);
    b.addEventListener('pointerdown', (event) => {
      if (playback.paused || pointer !== undefined || event.button !== 0) return;
      event.preventDefault();
      canvas.focus({ preventScroll: true });
      pointer = event.pointerId;
      b.setPointerCapture(pointer);
      input?.setVirtual(source, action, 1);
      b.dataset.held = 'true';
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
      b.addEventListener(type, (event) => {
        if ((event as PointerEvent).pointerId === pointer) reset();
      });
    // Keyboard and assistive activation have no pointer sequence. A click is a short press.
    b.addEventListener('click', (event) => {
      if (event.detail !== 0 || playback.paused) return;
      reset();
      input?.setVirtual(source, action, 1);
      timer = setTimeout(reset, 180);
    });
  }
  window.addEventListener('blur', clearTouch);
  const hidden = (): void => {
    if (document.hidden) clearTouch();
  };
  document.addEventListener('visibilitychange', hidden);
  cleanups.push(
    playback.onChange(() => {
      clearTouch();
      touch.disabled = playback.paused;
    }),
  );
  touch.disabled = playback.paused;
  function send(commands: Command[]): void {
    for (const [type, payload] of commands) client.command(type, payload);
  }
  async function advance(ticks: number): Promise<void> {
    const start = client.tick;
    if (start === undefined) throw new Error('The world is still loading. Try again shortly.');
    client.control({ action: 'step', ticks });
    const deadline = performance.now() + 10000;
    while (!disposed && (client.tick ?? 0) < start + ticks) {
      if (performance.now() > deadline)
        throw new Error('The game did not respond. Reload to reconnect.');
      await new Promise((resolve) => setTimeout(resolve, 16));
    }
  }
  const fine = panel.querySelector('#fine-actions') as HTMLInputElement;
  const actions = panel.querySelector('.text-actions') as HTMLElement;
  async function take(action: Action): Promise<void> {
    if (busy || !textMode || disposed) return;
    busy = true;
    actions.setAttribute('aria-busy', 'true');
    for (const b of actions.querySelectorAll('button')) b.setAttribute('aria-disabled', 'true');
    try {
      send(neutral(kind));
      send(action.commands);
      await advance(fine.checked ? 1 : action.ticks);
      if (disposed) return;
      send(neutral(kind));
      await advance(1);
      if (!disposed) describe();
    } catch (error) {
      summary.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      busy = false;
      actions.removeAttribute('aria-busy');
      for (const b of actions.querySelectorAll('button')) b.removeAttribute('aria-disabled');
    }
  }
  for (const action of gameActions(kind)) button(action.label, actions, () => void take(action));
  button('Describe surroundings', actions, () => {
    if (!busy) describe();
  });
  button(
    'Restart game',
    actions,
    () => void take({ label: 'Restart', commands: [cmd('restart')], ticks: 1 }),
  );
  if (kind === 'dungeon') {
    const faceHeading = (desired: number): void => {
      const rot = client.get('player', 'transform')?.rot as number[] | undefined;
      if (!rot) return;
      const yaw = 2 * Math.atan2(rot[1] ?? 0, rot[3] ?? 1);
      const delta = -Math.atan2(Math.sin(desired - yaw), Math.cos(desired - yaw));
      const count = Math.max(1, Math.ceil(Math.abs(delta)));
      void take({
        label: 'Face target',
        ticks: 1,
        commands: Array.from({ length: count }, () => cmd('look', { yaw: delta / count })),
      });
    };
    const face = (id: string): void => {
      const target = client.get(id, 'transform')?.pos as number[] | undefined;
      const position = client.get('player', 'transform')?.pos as number[] | undefined;
      if (!target || !position) return;
      faceHeading(
        Math.atan2(-(target[0] ?? 0) + (position[0] ?? 0), -(target[2] ?? 0) + (position[2] ?? 0)),
      );
    };
    const directionLabel = document.createElement('label');
    directionLabel.className = 'face-direction';
    directionLabel.textContent = 'Compass direction ';
    const direction = document.createElement('select');
    for (const [name, value] of [
      ['North', 0],
      ['East', -Math.PI / 2],
      ['South', Math.PI],
      ['West', Math.PI / 2],
    ] as const) {
      const option = document.createElement('option');
      option.value = String(value);
      option.textContent = name;
      direction.append(option);
    }
    directionLabel.append(direction);
    actions.append(directionLabel);
    button('Face compass direction', actions, () => faceHeading(Number(direction.value)));
    button('Face the key', actions, () => face('key'));
    button('Face the north gate', actions, () => face('gate'));
    button('Face nearest sentinel', actions, () => {
      const p = client.get('player', 'transform')?.pos as number[] | undefined;
      if (!p) return;
      const enemies = client
        .entities()
        .filter((id) => client.get(id, 'sentinel')?.alive)
        .map((id) => {
          const q = client.get(id, 'transform')?.pos as number[] | undefined;
          return {
            id,
            distance: q
              ? Math.hypot((q[0] ?? 0) - (p[0] ?? 0), (q[2] ?? 0) - (p[2] ?? 0))
              : Infinity,
          };
        })
        .sort((a, b) => a.distance - b.distance);
      if (enemies[0]) face(enemies[0].id);
      else summary.textContent = 'No sentinels remain.';
    });
  }
  // Significant events only: reading position every frame would drown out screen-reader controls.
  let announce: ReturnType<typeof setTimeout> | undefined;
  const off = client.onEvent('*', (event) => {
    if (
      ![
        'seed-collected',
        'checkpoint',
        'respawn',
        'victory',
        'delivery',
        'crash',
        'hurt',
        'heal',
        'strike',
        'key-found',
        'gate-opened',
      ].includes(event.type)
    )
      return;
    clearTimeout(announce);
    announce = setTimeout(() => {
      if (!disposed && !textMode) live.textContent = describeGame(kind, client).summary;
    }, 100);
  });
  const startText = new URLSearchParams(location.search).get('text') === '1';
  if (startText) textToggle.click();
  return {
    restart(): void {
      client.command('restart');
      if (playback.paused) {
        client.control({ action: 'step', ticks: 1 });
        setTimeout(playback.draw, 50);
      }
    },
    dispose(): void {
      disposed = true;
      clearTimeout(announce);
      off();
      clearTouch();
      for (const cleanup of cleanups) cleanup();
      window.removeEventListener('blur', clearTouch);
      document.removeEventListener('visibilitychange', hidden);
      headerObserver.disconnect();
      playback.dispose();
      toolbar.remove();
      panel.remove();
      touch.remove();
      live.remove();
      document.body.classList.remove('text-play');
    },
  };
}
