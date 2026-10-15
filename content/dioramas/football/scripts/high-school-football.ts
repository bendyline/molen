// A 24-second theatrical loop: line up, run a play, celebrate, return to the marks.
// There is no ball/rules/score simulation. Every animated position stays inside the field.
// Durable state is in molen.state; all other values are constants or derived from tick.
function box(
  id: string,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  color: string,
): void {
  molen.spawn(
    {
      transform: { pos: [x, y, z], rot: [0, 0, 0, 1] },
      renderable: {
        kind: 'primitive',
        ref: 'box',
        materialRef: `palette:${color}`,
        primitive: { size: [sx, sy, sz] },
        shadows: { cast: true, receive: true },
      },
    },
    id,
  );
}

const colors = ['#d7bc85', '#7b9a9e', '#c57758', '#8b91b0', '#94a87d', '#d1c8b4'];
const skins = ['#d7a880', '#9b6548', '#e3bd9e', '#704a38'];
const crowd = Math.min(48, Math.max(0, Math.floor(config.spectatorsPerSide)));
const segments = [
  [-0.65, 0.7, 0.16, 1.1],
  [0.65, 0.7, 0.16, 1.1],
  [-0.65, -0.7, 0.16, 1.1],
  [0.65, -0.7, 0.16, 1.1],
  [0, 1.4, 1.3, 0.16],
  [0, 0, 1.3, 0.16],
  [0, -1.4, 1.3, 0.16],
];
const digitMasks = [
  '1111101',
  '0101000',
  '0110111',
  '0101111',
  '1101010',
  '1001111',
  '1011111',
  '0101100',
  '1111111',
  '1101111',
];

if (!molen.state.built) {
  // Buried support closes the edge when the host anchors above uneven terrain.
  box('foundation', 0, -5.05, 0, 142, 10, 102, '#aaa59a');
  box('track', 0, 0.03, 0, 128, 0.18, 72, '#a9725c');
  box('field', 0, 0.16, 0, 110, 0.12, 49, '#6c9a55');
  for (let lane = 0; lane < 3; lane++) {
    for (const side of [-1, 1])
      box(
        `track-lane-${lane}-${side}`,
        0,
        0.13,
        side * (28 + lane * 2),
        121,
        0.025,
        0.12,
        '#e5cbb5',
      );
  }
  for (let stripe = 0; stripe < 10; stripe++) {
    if (stripe % 2 === 0)
      box(`mow-${stripe}`, -45 + stripe * 10, 0.23, 0, 10, 0.018, 48, '#789f61');
    box(`yard-${stripe}`, -45 + stripe * 10, 0.26, 0, 0.13, 0.025, 48, '#eee9d4');
    for (const side of [-1, 1])
      box(`hash-${stripe}-${side}`, -40 + stripe * 10, 0.26, side * 8, 0.16, 0.025, 1.1, '#eee9d4');
  }
  for (const side of [-1, 1]) {
    box(`sideline-${side}`, 0, 0.26, side * 24, 110, 0.025, 0.16, '#eee9d4');
    box(
      `endzone-${side}`,
      side * 50,
      0.25,
      0,
      9.7,
      0.02,
      47.7,
      side === -1 ? config.homeColor : config.awayColor,
    );
    box(`goal-post-${side}`, side * 58, 2.8, 0, 0.2, 5.6, 0.2, '#e6bf58');
    box(`goal-cross-${side}`, side * 58, 5.6, 0, 0.2, 0.2, 6.6, '#e6bf58');
    for (const upright of [-1, 1])
      box(`goal-${side}-${upright}`, side * 58, 7.5, upright * 3.3, 0.2, 4, 0.2, '#e6bf58');
    for (let row = 0; row < 4; row++) {
      const z = side * (35 + row * 2);
      box(`stand-${side}-${row}`, 0, 0.45 + row * 0.65, z, 82, 0.35 + row * 1.3, 2, '#c3c5bd');
      box(`bench-${side}-${row}`, 0, 1.2 + row * 1.3, z, 80, 0.18, 0.55, '#d5d3c8');
    }
    box(`back-rail-${side}`, 0, 6.3, side * 42, 83, 0.12, 0.12, '#b4bab9');
    for (let n = 0; n < crowd; n++) {
      const row = n % 3;
      const x = -35 + Math.floor(n / 3) * 7.4 + (molen.rng() - 0.5) * 1.3;
      molen.spawn(
        {
          transform: {
            pos: [x, 1 + row * 1.3, side * (35 + row * 2)],
            rot: [0, side === 1 ? 1 : 0, 0, side === 1 ? 0 : 1],
          },
          renderable: { kind: 'figure', ref: 'procedural', lod: 1 },
          figure: {
            preset: 'human.adult',
            height: 1.65 + molen.rng() * 0.16,
            facing: 'manual',
            seed: `fan-${n % 5}`,
            palette: {
              top: colors[n % colors.length],
              bottom: '#545e6b',
              skin: skins[n % skins.length],
            },
          },
          figureIntent: { mode: 'sit' },
        },
        `fan-${side}-${n}`,
      );
    }
    for (const x of [-48, 48]) {
      box(`mast-${side}-${x}`, x, 10, side * 30, 0.35, 20, 0.35, '#a5afb4');
      box(`lamp-bar-${side}-${x}`, x, 20, side * 30, 4.2, 0.8, 0.8, '#f0d9a0');
    }
  }
  for (let team = 0; team < 2; team++) {
    for (let n = 0; n < 7; n++) {
      const id = `player-${team}-${n}`;
      const color = team === 0 ? config.homeColor : config.awayColor;
      molen.spawn(
        {
          transform: {
            pos: [-20 + team * 6 - (n % 2) * 2, 0.28, (n - 3) * 4.7],
            rot: [0, 0, 0, 1],
          },
          renderable: { kind: 'figure', ref: 'procedural', lod: 0, shadows: { cast: true } },
          figure: {
            preset: 'human.adult',
            height: 1.84,
            build: 0.65,
            speedSource: 'transform',
            palette: {
              top: color,
              bottom: '#e0ddd0',
              skin: skins[n % skins.length],
              shoes: '#41484d',
            },
            features: { hair: 'none' },
          },
          figureIntent: { mode: 'idle' },
        },
        id,
      );
      molen.spawn(
        {
          transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
          parent: { id },
          figureAttachment: { socket: 'head.top', offset: { pos: [0, -0.13, 0] } },
          renderable: {
            kind: 'primitive',
            ref: 'sphere',
            primitive: { size: [0.42, 0.42, 0.42] },
            materialRef: `palette:${color}`,
          },
        },
        `${id}-helmet`,
      );
    }
  }
  box('scoreboard', 0, 9, -46, 19, 7, 0.6, '#3b4651');
  box('home-header', -5.8, 11.7, -45.65, 5.2, 0.45, 0.12, config.homeColor);
  box('away-header', 5.8, 11.7, -45.65, 5.2, 0.45, 0.12, config.awayColor);
  box('score-support-l', -7, 3.3, -46, 0.4, 6.6, 0.4, '#89949a');
  box('score-support-r', 7, 3.3, -46, 0.4, 6.6, 0.4, '#89949a');
  for (let digit = 0; digit < 6; digit++) {
    const x = [-7, -4.8, -1.1, 1.1, 4.8, 7][digit];
    for (let s = 0; s < segments.length; s++) {
      const [dx, dy, sx, sy] = segments[s];
      box(`digit-${digit}-${s}`, x + dx, 9 + dy, -45.62, sx, sy, 0.1, '#f2ca58');
    }
  }
  molen.spawn(
    {
      transform: { pos: [0, 9, -44], rot: [0, 0, 0, 1] },
      light: { type: 'point', color: '#ffd16c', intensity: 30, range: 18 },
    },
    'score-glow',
  );
  molen.setState({ built: true, second: -1, phase: 'lineup', home: 14, away: 7 });
}

molen.on('tick', () => {
  const time = molen.tick * molen.dt;
  const cycle = Math.floor(time / 24);
  const t = time % 24;
  const phase = t < 4 ? 'lineup' : t < 12 ? 'play' : t < 16 ? 'cheer' : 'reset';
  const progress = t < 4 ? 0 : t < 12 ? (t - 4) / 8 : t < 16 ? 1 : 1 - (t - 16) / 8;
  for (let team = 0; team < 2; team++) {
    for (let n = 0; n < 7; n++) {
      const id = `player-${team}-${n}`;
      // The pitch is a raised prop, not a terrain/collision surface. Declare the staged gait
      // explicitly so figures do not infer falling from their height above local y = 0.
      const mode = phase === 'play' || phase === 'reset' ? 'run' : 'idle';
      if (molen.get(id, 'figureIntent')?.mode !== mode) molen.set(id, 'figureIntent', { mode });
      const weave =
        phase === 'play'
          ? molen.math.sin((t - 4) * 0.8 + n) * molen.math.sin(progress * molen.math.PI) * 2.2
          : 0;
      molen.patch(`player-${team}-${n}`, 'transform', {
        pos: [
          -20 + team * 6 - (n % 2) * 2 + progress * (38 - (n % 3) * 2),
          0.28,
          (n - 3) * 4.7 + weave,
        ],
      });
    }
  }
  const second = Math.floor(time);
  if (molen.state.second !== second) {
    const home = 14 + (cycle % 5) * 7;
    const away = 7 + (Math.floor(cycle / 2) % 5) * 7;
    const remaining = 24 - Math.floor(t);
    const digits = [
      Math.floor(home / 10),
      home % 10,
      Math.floor(remaining / 10),
      remaining % 10,
      Math.floor(away / 10),
      away % 10,
    ];
    for (let d = 0; d < digits.length; d++) {
      for (let s = 0; s < 7; s++)
        molen.patch(`digit-${d}-${s}`, 'renderable', {
          materialRef: digitMasks[digits[d]][s] === '1' ? 'palette:#f2ca58' : 'palette:#575b51',
        });
    }
    molen.patch('score-glow', 'light', {
      intensity: phase === 'cheer' && second % 2 === 0 ? 90 : 30,
    });
    for (const side of [-1, 1])
      for (let n = 0; n < crowd; n++) {
        molen.set(`fan-${side}-${n}`, 'figureIntent', {
          mode: phase === 'cheer' && n % 3 !== 0 ? 'idle' : 'sit',
        });
      }
    molen.patchState({ second, phase, home, away });
    if (phase === 'cheer' && Math.floor(t) === 12)
      molen.emit('diorama.cue', { cue: 'crowd-cheer', cycle });
  }
});
