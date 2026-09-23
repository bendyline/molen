import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CLI_COMMANDS, cliFlagSpecs } from '../src/cli-commands';
import { createMcpServer } from '../src/mcp';
import { describeOps, OPS_CATALOG } from '../src/ops/index';

// The tripwire for surface drift: the describe catalog, the MCP server, and the CLI dispatch
// table must agree. A new op that misses one of the three surfaces fails here.

interface ToolSchema {
  properties: Record<string, unknown>;
  required: Set<string>;
}

let mcpNames: string[];
let mcpSchemas: Map<string, ToolSchema>;

beforeAll(async () => {
  const server = createMcpServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'catalog-test', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  const tools = (await client.listTools()).tools;
  mcpNames = tools.map((t) => t.name).sort();
  mcpSchemas = new Map(
    tools.map((t) => {
      const schema = t.inputSchema as { properties?: Record<string, unknown>; required?: string[] };
      return [
        t.name,
        { properties: schema.properties ?? {}, required: new Set(schema.required ?? []) },
      ];
    }),
  );
  await client.close();
});

afterAll(() => {
  // transports closed with the client
});

describe('ops catalog ⇄ MCP ⇄ CLI parity', () => {
  it('every registered MCP tool has a catalog entry, and vice versa', () => {
    const catalogMcp = OPS_CATALOG.filter((o) => o.mcpTool !== undefined)
      .map((o) => o.mcpTool as string)
      .sort();
    expect(catalogMcp).toEqual(mcpNames);
  });

  it('every catalog cli form dispatches to a real CLI command', () => {
    for (const op of OPS_CATALOG) {
      if (op.cli === undefined) continue;
      const verb = op.cli.split(/\s+/)[1];
      expect(Object.keys(CLI_COMMANDS), `catalog entry "${op.name}" cli verb`).toContain(verb);
    }
  });

  it('every CLI command is documented in the catalog', () => {
    const catalogVerbs = new Set(
      OPS_CATALOG.filter((o) => o.cli !== undefined).map((o) => (o.cli as string).split(/\s+/)[1]),
    );
    for (const verb of Object.keys(CLI_COMMANDS)) {
      expect(catalogVerbs, `CLI verb "${verb}" missing from OPS_CATALOG`).toContain(verb);
    }
  });

  it('describe_op resolves every MCP tool name', () => {
    for (const name of mcpNames) {
      expect(describeOps(name).length, `describe_op("${name}")`).toBeGreaterThan(0);
    }
  });
  // Names alone were never enough: 23 of 35 tools once accepted inputs the catalog never listed
  // (projectPath, inline, size, setupModule…), so an agent reading `describe_op` could not see
  // them. Every MCP input must be a documented param, with the same required flag.
  it('every MCP tool input is a catalog param, with matching required flags', () => {
    const missing: string[] = [];
    const wrongRequired: string[] = [];
    for (const op of OPS_CATALOG) {
      if (op.mcpTool === undefined) continue;
      const schema = mcpSchemas.get(op.mcpTool);
      expect(schema, `MCP tool "${op.mcpTool}"`).toBeDefined();
      const byName = new Map(op.params.map((param) => [param.name, param]));
      for (const field of Object.keys((schema as ToolSchema).properties)) {
        const param = byName.get(field);
        if (param === undefined) {
          missing.push(`${op.mcpTool}.${field}`);
          continue;
        }
        if (param.required !== (schema as ToolSchema).required.has(field)) {
          wrongRequired.push(`${op.mcpTool}.${field}`);
        }
      }
    }
    expect(missing, 'MCP inputs missing from OPS_CATALOG params').toEqual([]);
    expect(wrongRequired, 'required flag differs between MCP schema and catalog').toEqual([]);
  });

  it('a catalog param the MCP tool does not accept is marked cliOnly', () => {
    const undeclared: string[] = [];
    for (const op of OPS_CATALOG) {
      if (op.mcpTool === undefined) continue;
      const schema = mcpSchemas.get(op.mcpTool) as ToolSchema;
      for (const param of op.params) {
        if (param.name in schema.properties) {
          expect(param.cliOnly, `${op.mcpTool}.${param.name} is accepted over MCP`).not.toBe(true);
          continue;
        }
        if (param.cliOnly !== true) undeclared.push(`${op.mcpTool}.${param.name}`);
      }
    }
    expect(undeclared, 'catalog params absent from the MCP schema (mark them cliOnly)').toEqual([]);
  });

  // The parser derives each command's flags from these usage strings, so a flag the code reads
  // but the usage never mentions is rejected at the command line as "unknown flag".
  it('every flag the CLI reads is declared by some usage form', async () => {
    const { readFile } = await import('node:fs/promises');
    const source = await readFile(new URL('../src/cli-commands.ts', import.meta.url), 'utf8');
    const used = new Set<string>();
    for (const match of source.matchAll(/args\.flags\.([A-Za-z][\w]*)/g)) {
      used.add(match[1] as string);
    }
    for (const match of source.matchAll(/args\.flags\['([^']+)'\]/g)) used.add(match[1] as string);
    const declared = new Set<string>();
    for (const spec of cliFlagSpecs().values()) {
      for (const name of spec.value) declared.add(name);
      for (const name of spec.boolean) declared.add(name);
    }
    const undeclared = [...used].filter((name) => !declared.has(name)).sort();
    expect(undeclared, 'flags read by cli-commands.ts but not in any usage form').toEqual([]);
  });

  it('every CLI verb has a flag spec and rejects an unknown flag', () => {
    for (const verb of Object.keys(CLI_COMMANDS)) {
      expect(cliFlagSpecs().has(verb), `flag spec for "${verb}"`).toBe(true);
    }
  });
});
