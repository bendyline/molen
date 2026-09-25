// Generate the samples gallery and one page per shipped example.
//
// Facts come from disk (package name, npm scripts, preview image, the parsed scene manifest, and
// whether the tooling build ships the sample as a `molen new --template`), so a sample that gains
// a script, a test, more entities or a template updates itself. Only the editorial framing below —
// what a sample is FOR and which concepts it teaches — is hand-written.
//
// Every page is written for someone using the published npm packages: play the sample at
// molen.dev/play, copy it with `--template`, read the source on GitHub. Nothing here assumes a
// clone of this repository.
//
// Output: docs-site/samples/*.md and docs-site/public/samples/*.png.
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repoRoot, siteDir, yamlString } from './packages.mjs';

const samplesDir = join(siteDir, 'samples');
const publicDir = join(siteDir, 'public', 'samples');

// Where sample source is browsable. Set to null to render source paths as plain code.
const SOURCE_BASE = 'https://github.com/bendyline/molen/tree/main';

// The hosted builds the site staging step publishes beside the docs (see docs-site/README.md).
// Absolute, so VitePress renders them as external links instead of routing them as doc pages.
const PLAY_BASE = 'https://molen.dev/play';

// The templates `molen new --template` offers, as the tooling build wrote them.
const TEMPLATE_INDEX = join(repoRoot, 'packages', 'tooling', 'dist', 'templates', 'index.json');

/**
 * Editorial framing per example. `kind` drives gallery grouping; `concepts` are the things you
 * come to this sample to learn; `guides` link to the prose that explains them in depth.
 */
const SAMPLES = [
  {
    dir: 'cubes',
    title: 'Cubes',
    kind: 'starter',
    tagline:
      'The smallest complete experience: ~50 drifting cubes, one command, one determinism test.',
    body:
      'Start here. It is the whole architecture at minimum size — a scene manifest, a Worker ' +
      'running the kernel, the three.js client mounted on the page, and one `spawn_cube` command ' +
      'wired from a button. The headless test asserts that two runs from the same seed produce ' +
      'the same state hash, which is the guarantee everything else is built on.',
    concepts: ['Scene manifest', 'Worker + client mount', 'Commands', 'Determinism test'],
    guides: [
      ['Quickstart', '/guide/quickstart'],
      ['Browser mount', '/guide/browser-mount'],
    ],
  },
  {
    dir: 'data-viz',
    title: 'Data visualization',
    kind: 'starter',
    tagline: 'One entity per data row, plus a scripted camera track and a golden image.',
    body:
      'Shows the engine used for something other than a game: a JSON dataset becomes entities, ' +
      'and a `molen/cameratrack@1` document flies the camera along a keyframed path. The golden ' +
      'test renders a frame headlessly and compares it to a committed PNG.',
    concepts: ['Data-driven entities', 'Camera tracks', 'Golden image tests'],
    guides: [['Examples gallery', '/guide/examples']],
  },
  {
    dir: 'top-down-arena',
    title: 'Top-down arena',
    kind: 'starter',
    tagline: 'A complete small game as pure data — no setup module at all.',
    body:
      'The reference for how far scene data alone can take you. `scene.json` declares kinematics, ' +
      'the `move` command, WASD input binding, and four sandboxed scripts (control, spawner, ' +
      'chaser, combat). There is no `setup.mjs`: an agent can produce this entire game by writing ' +
      "JSON, which is the engine's central design bet.",
    concepts: ['Scene-data scripts', 'Input bindings', 'Kinematics', 'Typed project registry'],
    guides: [
      ['Scripting', '/guide/scripting'],
      ['Projects & types', '/guide/project'],
    ],
  },
  {
    dir: 'terrain-flyover',
    title: 'Terrain flyover',
    kind: 'capability',
    tagline: 'Chunked LOD terrain from a descriptor and a deterministic 16-bit heightmap.',
    body:
      'The terrain capability in isolation: a `molen/terrain@1` descriptor plus a heightmap ' +
      'produces a chunked, level-of-detail mesh on the client and queryable height sampling in ' +
      'the kernel — the same heights on both sides, which is what keeps collision honest.',
    concepts: ['Terrain descriptors', 'Chunked LOD meshing', 'Heightfield queries'],
    guides: [['Terrain', '/guide/terrain']],
  },
  {
    dir: 'figures-gallery',
    title: 'Figures gallery',
    kind: 'capability',
    tagline: 'Every figure preset, a body-type sweep, a socketed hat and a rider on a horse.',
    body:
      'A lineup of the shipped figure presets rendered side by side, with a body-type sweep and ' +
      'two attachment cases. Append `?walk=1` (or send the `set_gait` command) to animate the ' +
      'deterministic gaits in place.',
    concepts: [
      'Figure descriptors',
      'Canonical rigs',
      'Sockets & attachments',
      'Deterministic gaits',
    ],
    guides: [['Figures', '/guide/figures']],
  },
  {
    dir: 'earth-view',
    title: 'Earth view',
    kind: 'capability',
    tagline: 'The whole real-world view in one mountEarthView call.',
    body:
      'The `@bendyline/molen-earth` facade on a page: streamed Sammamish terrain in a metric ' +
      'frame, styled buildings and street surfaces from the content packs, orbit, walk and drive ' +
      'navigation with parked cars, a photo-pin marker placed by latitude/longitude, and the ' +
      'required data credits. Workers are one-line imports of the package entries.',
    concepts: ['Earth view facade', 'Orbit / walk / drive', 'World markers', 'Worker entries'],
    guides: [
      ['Earth view', '/guide/earth-view'],
      ['Camera navigation', '/guide/navigation'],
      ['World markers', '/guide/markers'],
    ],
  },
  {
    dir: 'world-explorer',
    title: 'World explorer',
    kind: 'capability',
    tagline: 'Streamed Web Mercator terrain, real Earth data, and procedurally styled buildings.',
    body:
      'The largest sample and the stress test for streaming: adaptive package LOD over projected ' +
      'Earth coordinates, bare / land-classification / human-feature modes, and styled buildings ' +
      'generated from the default worldgen pack. Query params switch style packs (`?style=`) and ' +
      'synthetic lineups (`?synthetic=1&lineup=1`).',
    concepts: [
      'Tile streaming',
      'Earth projection',
      'Worldgen style packs',
      'Adaptive performance',
    ],
    guides: [
      ['Terrain', '/guide/terrain'],
      ['Worldgen', '/guide/worldgen'],
      ['Adaptive performance', '/guide/adaptive-performance'],
    ],
  },
  {
    dir: 'city-courier',
    title: 'City Courier',
    kind: 'game',
    tagline: 'Arcade driving: traffic, five deliveries, damage, a time limit and restart.',
    body:
      'A complete game with a real win/loss loop. Demonstrates mountable vehicles, a chase ' +
      'camera, deterministic traffic, and a full restart path — plus a command-only victory ' +
      'regression that proves the game is winnable without a browser.',
    concepts: [
      'Vehicles & driving',
      'Follow cameras',
      'Win/loss/restart loop',
      'Victory regression',
    ],
    guides: [
      ['Game samples', '/guide/game-samples'],
      ['Vehicles', '/guide/vehicles'],
    ],
  },
  {
    dir: 'lantern-dungeon',
    title: 'The Lantern Vault',
    kind: 'game',
    tagline: 'First-person exploration: melee, inventory, a locked gate and a victory condition.',
    body:
      'First-person movement with melee rolls, an inventory, and a key-and-gate progression. It ' +
      'also carries the fullest asset pipeline of any sample — prompt-authored glTF sources under ' +
      '`asset-src/`, imported and packed into runtime GLBs with verification scripts.',
    concepts: [
      'First-person control',
      'Inventory & gating',
      'glTF asset pipeline',
      'Asset verification',
    ],
    guides: [
      ['Game samples', '/guide/game-samples'],
      ['3D model assets', '/guide/3d-model-assets'],
    ],
  },
  {
    dir: 'skybound',
    title: 'Skybound',
    kind: 'game',
    tagline: 'Side-scrolling platformer: one-way ledges, stomps, hazards and checkpoints.',
    body:
      'Built on the platformer capability: swept XY box movement against static solids, with jump ' +
      'buffering, coyote grace and short hops already tuned. Seeds, stomps, hazards and ' +
      'checkpoints make it a complete progression loop.',
    concepts: ['Platformer physics', 'Jump feel (coyote/buffer)', 'Checkpoints', 'Hazards'],
    guides: [['Game samples', '/guide/game-samples']],
  },
];

const KINDS = [
  {
    id: 'starter',
    title: 'Start here',
    blurb: 'Small, complete, and meant to be copied. Each one is under a few hundred lines.',
  },
  {
    id: 'capability',
    title: 'Capability demos',
    blurb: 'One capability package at a time, isolated so you can see exactly what it contributes.',
  },
  {
    id: 'game',
    title: 'Complete games',
    blurb:
      'Full win/loss/restart loops with headless victory regressions and real-browser gameplay ' +
      'tests. The closest thing to a production experience.',
  },
];

async function exists(path) {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

/** Template ids the built tooling ships; empty (with a warning) when it has not been built. */
async function templateIds() {
  try {
    const index = JSON.parse(await readFile(TEMPLATE_INDEX, 'utf8'));
    const entries = Array.isArray(index) ? index : (index.templates ?? []);
    return new Set(entries.map((entry) => (typeof entry === 'string' ? entry : entry.id)));
  } catch {
    console.warn(`samples: no ${TEMPLATE_INDEX}; build @bendyline/molen-tooling first`);
    return new Set();
  }
}

/** Facts read off disk so a sample page cannot drift from the sample. */
async function inspect(sample, templates) {
  const dir = join(repoRoot, 'examples', sample.dir);
  const manifest = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
  const files = await readdir(dir);
  const facts = {
    pkg: manifest.name,
    scripts: manifest.scripts ?? {},
    files,
    template: templates.has(sample.dir),
  };

  if (files.includes('scene.json')) {
    try {
      const scene = JSON.parse(await readFile(join(dir, 'scene.json'), 'utf8'));
      facts.scene = {
        format: scene.format,
        tickRate: scene.tickRate,
        entities: Array.isArray(scene.entities) ? scene.entities.length : 0,
        prefabs: Object.keys(scene.prefabs ?? {}).length,
        scripts: (scene.scripts ?? []).map((s) => s.id ?? s.name).filter(Boolean),
        commands: Object.keys(scene.commands ?? {}),
        hasCamera: scene.camera !== undefined,
        hasInput: scene.input !== undefined,
        hasPhysics: scene.physics !== undefined,
      };
    } catch {
      /* a sample may generate its scene at runtime */
    }
  }
  facts.preview = files.includes('preview.png');
  facts.readme = files.includes('README.md');
  return { dir, ...facts };
}

function sourceRef(path) {
  return SOURCE_BASE === null ? `\`${path}\`` : `[\`${path}\`](${SOURCE_BASE}/${path})`;
}

/** The commands that make and start a copy of a template, as a user types them. */
function copyCommands(dir) {
  return [
    `npx @bendyline/molen-tooling new my-${dir} --template ${dir}`,
    `cd my-${dir}`,
    'npm install',
    'npm run dev',
  ].join('\n');
}

function samplePage(sample, facts) {
  const s = facts.scene;
  const play = `${PLAY_BASE}/${sample.dir}/`;

  const makeItYours = facts.template
    ? `## Make it yours

The sample ships inside \`@bendyline/molen-tooling\` as a template, locked to the engine version
you install. Copy it into a standalone npm project (no clone of the engine repository needed):

\`\`\`sh
${copyCommands(sample.dir)}
\`\`\`

The copy keeps the sample's scene, scripts, commands, checks and headless tests${
        facts.files.some((f) => f.endsWith('.replay.json')) ? ', plus its replay fixture' : ''
      }${facts.scripts['test:unit'] ? '; `npm test` runs them' : ''}.

`
    : `## Make it yours

This sample is not an npm template: it carries content (models, terrain or packs) that Molen's
npm packages never include. Read its source on GitHub, then build the same thing in a project of
your own; its README walks through how it is put together.

`;

  const sceneTable =
    s === undefined
      ? ''
      : `## The scene at a glance

Read straight out of the sample's \`scene.json\`:

| | |
|---|---|
| Format | \`${s.format}\` |
| Tick rate | ${s.tickRate ?? '—'} Hz |
| Entities | ${s.entities} |
| Prefabs | ${s.prefabs} |
| Scene scripts | ${s.scripts.length > 0 ? s.scripts.map((x) => `\`${x}\``).join(', ') : '—'} |
| Commands | ${s.commands.length > 0 ? s.commands.map((x) => `\`${x}\``).join(', ') : '—'} |
| Declares | ${[s.hasCamera && 'camera', s.hasInput && 'input', s.hasPhysics && 'physics'].filter(Boolean).join(', ') || '—'} |

`;

  const headless =
    s === undefined || !facts.template
      ? ''
      : `## Run it headlessly

Every sample is also a headless fixture, so no browser is needed. From your copy:

\`\`\`sh
npx molen validate scene.json
npx molen sim run scene.json --ticks 60 --hash
npx molen shot scene.json --ticks 60 --out ${sample.dir}.png
\`\`\`

`;

  return `---
title: ${yamlString(sample.title)}
---

# ${sample.title}

<p class="sample-tagline">${sample.tagline}</p>

${facts.preview ? `[![${sample.title}](/samples/${sample.dir}.png)](${play})\n` : ''}
${sample.body}

## Play it

**[Play ${sample.title} in your browser](${play})**. Nothing to install.

${makeItYours}## What it teaches

${sample.concepts.map((c) => `- ${c}`).join('\n')}

${sceneTable}${headless}## Source

${sourceRef(`examples/${sample.dir}`)}${
  facts.readme ? '. A walkthrough README ships alongside it' : ''
}${facts.template && facts.readme ? ' and in every copy' : ''}.

## Read next

${sample.guides.map(([label, link]) => `- [${label}](${link})`).join('\n')}
`;
}

function galleryPage(entries) {
  const sections = KINDS.map((kind) => {
    const rows = entries.filter(([sample]) => sample.kind === kind.id);
    if (rows.length === 0) return '';
    const cards = rows.map(
      ([sample, facts]) => `### [${sample.title}](/samples/${sample.dir})

${sample.tagline}

${facts.preview ? `[![${sample.title}](/samples/${sample.dir}.png)](/samples/${sample.dir})\n\n` : ''}[Play it](${PLAY_BASE}/${sample.dir}/)${
        facts.template
          ? ` · copy it with \`--template ${sample.dir}\``
          : ' · play and read only (carries content)'
      }

${sample.concepts.map((c) => `\`${c}\``).join(' · ')}
`,
    );
    return `## ${kind.title}\n\n${kind.blurb}\n\n${cards.join('\n')}`;
  });

  return `---
title: "Samples"
---

# Samples

Every sample below is simultaneously a browser demo **and** a headless regression test. They are
the intended copy-and-modify starting points: pick the one closest to what you are building and
change it. None of this needs a clone of the engine repository.

- **Play** every sample in the browser at [molen.dev/play](${PLAY_BASE}/), with nothing to install.
- **Copy** one into your own npm project. The smaller samples ship inside
  \`@bendyline/molen-tooling\` as templates, locked to the engine version you install:

\`\`\`sh
npx @bendyline/molen-tooling templates                    # list them
npx @bendyline/molen-tooling new my-game --template skybound
cd my-game && npm install && npm run dev
\`\`\`

- **Read** the source of any of them [on GitHub](${SOURCE_BASE}/examples).

${sections.filter(Boolean).join('\n')}
## Start from nothing instead

\`molen new <name>\` without \`--template\` scaffolds a runnable experience — project manifest,
scene with camera/input/commands, scripts, a setup module, assertions and a Vite app — already
wired into the [agent loop](/guide/agent-loop).

\`\`\`sh
npx @bendyline/molen-tooling new my-experience
\`\`\`
`;
}

export async function generateSamples() {
  await rm(samplesDir, { recursive: true, force: true });
  await mkdir(samplesDir, { recursive: true });
  await mkdir(publicDir, { recursive: true });

  const templates = await templateIds();
  const entries = [];
  for (const sample of SAMPLES) {
    const dir = join(repoRoot, 'examples', sample.dir);
    if (!(await exists(join(dir, 'package.json')))) {
      console.warn(`samples: skipping ${sample.dir} (not on disk)`);
      continue;
    }
    const facts = await inspect(sample, templates);
    await writeFile(join(samplesDir, `${sample.dir}.md`), samplePage(sample, facts));
    if (facts.preview) {
      await copyFile(join(dir, 'preview.png'), join(publicDir, `${sample.dir}.png`));
    }
    entries.push([sample, facts]);
  }
  await writeFile(join(samplesDir, 'index.md'), galleryPage(entries));

  // Any example that exists but has no editorial entry is a gap worth surfacing loudly.
  const covered = new Set(SAMPLES.map((s) => s.dir));
  const onDisk = await readdir(join(repoRoot, 'examples'), { withFileTypes: true });
  const missing = onDisk
    .filter((d) => d.isDirectory() && !covered.has(d.name) && d.name !== 'home')
    .map((d) => d.name);
  if (missing.length > 0) {
    console.warn(`samples: no page for ${missing.join(', ')} — add an entry to SAMPLES`);
  }
  return entries;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await generateSamples();
  console.log('samples generated');
}
