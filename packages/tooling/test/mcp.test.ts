import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createMcpServer, guardMcpStdout } from '../src/mcp';

let client: Client;

beforeAll(async () => {
  const server = createMcpServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
});

afterAll(async () => {
  await client.close();
});

function textOf(result: { content: { type: string; text?: string }[] }): string {
  return result.content.map((c) => c.text ?? '').join('\n');
}

describe('MCP server v0', () => {
  it('lists tools (the agent interface)', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        'apply_uv_paint',
        'build_pack',
        'check_scripts',
        'check_types',
        'describe_op',
        'diff_snapshots',
        'drive_scene',
        'export_frames',
        'extract_pack',
        'fetch_pack',
        'figure_preview',
        'generate_types',
        'get_component',
        'get_project',
        'get_schema',
        'import_asset',
        'inspect_asset',
        'inspect_pack',
        'list_assets',
        'list_components',
        'list_figure_presets',
        'list_schemas',
        'list_types',
        'new_experience',
        'pack_asset',
        'play_experience',
        'rasterize_material',
        'reserve_type',
        'run_replay',
        'run_simulation',
        'screenshot_asset',
        'screenshot_scene',
        'search_docs',
        'stage_assets',
        'test_types',
        'validate_asset',
        'verify_pack',
        'worldgen_bake',
        'worldgen_preview',
        'worldgen_stats',
      ].sort(),
    );
  });

  it('list_schemas includes core + capability kinds', async () => {
    const r = await client.callTool({ name: 'list_schemas', arguments: {} });
    const t = textOf(r as never);
    expect(t).toContain('scene');
    expect(t).toContain('matgraph');
    expect(t).toContain('terrain');
  });

  it('get_schema returns JSON Schema + examples', async () => {
    const r = await client.callTool({ name: 'get_schema', arguments: { kind: 'matgraph' } });
    const t = textOf(r as never);
    expect(t).toContain('molen/matgraph@1');
    expect(t).toContain('jsonSchema');
  });

  it('validate_asset accepts a valid inline scene and rejects a bad one', async () => {
    const good = await client.callTool({
      name: 'validate_asset',
      arguments: { inline: { format: 'molen/scene@3', name: 'ok' }, kind: 'scene' },
    });
    expect(textOf(good as never)).toContain('valid scene');

    const bad = await client.callTool({
      name: 'validate_asset',
      arguments: {
        inline: { format: 'molen/scene@3', name: 'x', tickRate: 'fast' },
        kind: 'scene',
      },
    });
    expect((bad as { isError?: boolean }).isError).toBe(true);
    expect(textOf(bad as never)).toContain('/tickRate');
  });

  it('rasterize_material bakes a graph to a PNG', async () => {
    const { mkdtemp } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = await mkdtemp(join(tmpdir(), 'molen-mcp-'));
    const out = join(dir, 'mat.png');
    const r = await client.callTool({
      name: 'rasterize_material',
      arguments: {
        outPath: out,
        inline: {
          format: 'molen/matgraph@1',
          size: [16, 16],
          nodes: [{ id: 'n', type: 'noise', params: {} }],
          outputs: { baseColor: 'n' },
        },
      },
    });
    expect(textOf(r as never)).toContain('16x16');
    const { stat } = await import('node:fs/promises');
    expect((await stat(out)).size).toBeGreaterThan(0);
  });
  // stdout is the stdio transport: any dependency's console.log would corrupt a JSON-RPC frame.
  it('guardMcpStdout routes stdout-bound console methods to stderr', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const restore = guardMcpStdout();
    try {
      console.log('noise from a dependency');
      console.info('info noise');
      console.debug('debug noise');
      expect(err).toHaveBeenCalledTimes(3);
      expect(err.mock.calls[0]?.[0]).toBe('noise from a dependency');
    } finally {
      restore();
      err.mockRestore();
    }
    // restore() must put the originals back, or later CLI output would go to the wrong stream.
    expect(console.log).not.toBe(console.error);
  });
});
