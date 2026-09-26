// Generate the CLI and MCP reference from OPS_CATALOG — the same machine-readable contract that
// `molen describe` and the MCP `describe_op` tool serve at runtime. CONVENTIONS.md already
// requires every new op to land in that catalog, so a new command documents itself here.
//
// Output: docs-site/reference/cli.md, docs-site/reference/mcp.md.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { OPS_CATALOG } from '@bendyline/molen-tooling';
import { mdText, siteDir } from './packages.mjs';

const refDir = join(siteDir, 'reference');

/** Ops grouped the way an author meets them, not the order they were added. */
const GROUPS = [
  {
    title: 'Validate and discover',
    blurb:
      'Cheap, fast checks you run constantly. `validate` gives pinpointed, fixable errors; the ' +
      'rest let an agent learn the surface without reading source.',
    ops: [
      'validate_asset',
      'list_schemas',
      'get_schema',
      'list_components',
      'get_component',
      'describe_op',
      'search_docs',
    ],
  },
  {
    title: 'Simulate and verify',
    blurb:
      'The headless inner loop. Every run is deterministic, so a state hash is a meaningful ' +
      'regression signal and a replay mismatch localizes the diverging tick.',
    ops: ['run_simulation', 'sim_watch', 'run_replay', 'diff_snapshots', 'test_types'],
  },
  {
    title: 'Render and play',
    blurb:
      'Turn a scene into pixels without a browser — or drive a real built app with scripted ' +
      'input and collect screenshots and diagnostics.',
    ops: [
      'screenshot_scene',
      'export_frames',
      'drive_scene',
      'play_experience',
      'screenshot_asset',
    ],
  },
  {
    title: 'Projects and types',
    blurb:
      'Scaffold an experience (the starter, or a copy of a shipped sample) and manage the ' +
      'namespaced entity type registry.',
    ops: [
      'new_experience',
      'list_templates',
      'get_project',
      'list_types',
      'check_types',
      'reserve_type',
      'generate_types',
    ],
  },
  {
    title: 'Assets',
    blurb: 'Import glTF/GLB, inspect what was imported, and stage runtime bundles for the browser.',
    ops: ['import_asset', 'inspect_asset', 'list_assets', 'pack_asset', 'stage_assets'],
  },
  {
    title: 'Materials and textures',
    blurb: 'Bake procedural material graphs and round-trip hand-painted UV templates.',
    ops: ['rasterize_material', 'apply_uv_paint'],
  },
  {
    title: 'Worldgen',
    blurb: 'Outlines and labeled polygons into styled buildings and deterministic props.',
    ops: ['worldgen_preview', 'worldgen_bake', 'worldgen_stats'],
  },
  {
    title: 'Figures',
    blurb: 'Stylized humans, bipeds and quadrupeds: presets, descriptors, rigs and gaits.',
    ops: ['figure_preview', 'list_figure_presets'],
  },
  {
    title: 'Server',
    blurb: 'Expose every operation above to an agent over MCP.',
    ops: ['mcp_server'],
  },
];

const byName = new Map(OPS_CATALOG.map((op) => [op.name, op]));

/** The invocable prefix of a usage string: `molen sim run <scene> --ticks N` -> `molen sim run`. */
function commandName(cli) {
  return cli.split(/[<[]/)[0].trim();
}

/** Every op reachable from GROUPS, plus anything new that has not been grouped yet. */
function grouped() {
  const seen = new Set(GROUPS.flatMap((g) => g.ops));
  const ungrouped = OPS_CATALOG.filter((op) => !seen.has(op.name)).map((op) => op.name);
  const groups = GROUPS.map((g) => ({ ...g, ops: g.ops.filter((n) => byName.has(n)) }));
  if (ungrouped.length > 0) {
    groups.push({
      title: 'Other operations',
      blurb: 'Added since this page was last curated.',
      ops: ungrouped,
    });
  }
  return groups;
}

function paramTable(op, { mcp }) {
  if (op.params.length === 0) return '_No parameters._\n';
  const rows = op.params.map(
    (p) =>
      `| \`${p.name}\` | \`${p.type}\` | ${p.required ? 'yes' : 'no'} | ${mdText(p.description).replace(/\|/g, '\\|')} |`,
  );
  return `| ${mcp ? 'Field' : 'Parameter'} | Type | Required | Description |
|---|---|---|---|
${rows.join('\n')}
`;
}

function cliPage() {
  const sections = grouped().map((g) => {
    const ops = g.ops.map((name) => byName.get(name)).filter((op) => op?.cli);
    if (ops.length === 0) return '';
    const bodies = ops.map(
      (op) => `### \`${commandName(op.cli)}\` {#${op.name}}

${mdText(op.summary)}

\`\`\`sh
${op.cli}
\`\`\`

${paramTable(op, { mcp: false })}${op.mcpTool ? `Also available over MCP as [\`${op.mcpTool}\`](/reference/mcp#${op.mcpTool}).\n` : 'CLI only — not exposed over MCP.\n'}`,
    );
    return `## ${g.title}\n\n${g.blurb}\n\n${bodies.join('\n')}`;
  });

  return `---
title: CLI reference
outline: [2, 3]
---

# CLI reference

\`molen\` is the one entry point to every engine operation. This page is generated from the same
\`OPS_CATALOG\` contract that \`molen describe\` prints and the MCP server serves, so it can never
drift from the shipped commands.

::: tip Running the CLI
Inside a project that installs \`@bendyline/molen-tooling\` (every \`molen new\` project does), run
\`npx molen <cmd>\`; the usage lines below drop the \`npx\`. To create that project, name the
scoped package — the unscoped \`molen\` on npm is unrelated.
:::

\`\`\`sh
npx @bendyline/molen-tooling new my-experience   # scaffold a runnable project
npx molen validate scene.json                    # cheap — do it constantly
npx molen sim run scene.json --ticks 30 --assert checks.json --hash
npx molen shot scene.json --ticks 30 --camera 0,6,16 --look 0,0,0 --out shot.png
\`\`\`

${OPS_CATALOG.filter((o) => o.cli).length} commands, in the order you tend to meet them. Each entry
shows the usage line (where the CLI flag spellings live) and a table of the operation's input
fields — the same fields the [MCP tool](/reference/mcp) and the
[\`@bendyline/molen-tooling\`](/api/tooling/index) function take.

${sections.filter(Boolean).join('\n')}`;
}

function mcpPage() {
  const sections = grouped().map((g) => {
    const ops = g.ops.map((name) => byName.get(name)).filter((op) => op?.mcpTool);
    if (ops.length === 0) return '';
    const bodies = ops.map(
      (op) => `### \`${op.mcpTool}\` {#${op.mcpTool}}

${mdText(op.summary)}

${paramTable(op, { mcp: true })}${op.cli ? `CLI equivalent: [\`${op.cli.split(' ').slice(0, 2).join(' ')}\`](/reference/cli#${op.name}).\n` : ''}`,
    );
    return `## ${g.title}\n\n${g.blurb}\n\n${bodies.join('\n')}`;
  });

  const imageTools = [
    'drive_scene',
    'play_experience',
    'screenshot_asset',
    'worldgen_preview',
    'figure_preview',
  ];
  return `---
title: MCP reference
outline: [2, 3]
---

# MCP server reference

\`molen mcp\` starts a [Model Context Protocol](https://modelcontextprotocol.io) server over stdio
that mirrors the [CLI](/reference/cli) 1:1 — ${OPS_CATALOG.filter((o) => o.mcpTool).length} tools
over the same ops library, so an agent gets the identical behaviour with no shell parsing.

\`\`\`json
{
  "mcpServers": {
    "molen": { "command": "molen", "args": ["mcp"] }
  }
}
\`\`\`

::: tip Discovery first
Call \`describe_op\` before guessing an I/O contract — it returns the entry below for any op at
runtime, so an agent never has to read engine source.
:::

Tools that return rendered PNGs as MCP **image** content (an agent can look at its own output):
${imageTools.map((t) => `\`${t}\``).join(', ')}.

${sections.filter(Boolean).join('\n')}`;
}

export async function generateCli() {
  await mkdir(refDir, { recursive: true });
  await writeFile(join(refDir, 'cli.md'), cliPage());
  await writeFile(join(refDir, 'mcp.md'), mcpPage());
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await generateCli();
  console.log('cli + mcp reference generated');
}
