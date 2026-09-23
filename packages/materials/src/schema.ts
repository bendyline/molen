import { nearest, registerSchema, type ValidationIssue } from '@bendyline/molen-schema';
import { z } from 'zod';

// --- post-parse validators (cross-field checks Zod can't express; see SchemaMeta.validate) ---

const COLOR_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const MAX_GRAPH_NODES = 256;
const MAX_GRAPH_DEPTH = 64;

/**
 * Pixel-grid: palette color formats, row count vs height, row length vs width, palette membership,
 * and at least one enabled texture slot (a grid with every slot off bakes to nothing).
 */
function validatePixelGrid(data: unknown): ValidationIssue[] {
  const doc = data as {
    size?: [number, number];
    palette?: Record<string, string>;
    rows?: string[];
    slots?: { baseColor?: boolean; emissive?: boolean };
  };
  const issues: ValidationIssue[] = [];
  // `slots` is defaulted by the Zod schema, so this only fires on an explicit all-false block.
  if (doc.slots !== undefined && doc.slots.baseColor !== true && doc.slots.emissive !== true) {
    issues.push({
      path: '/slots',
      code: 'no_slot_enabled',
      message: 'every texture slot is disabled, so the grid would rasterize to nothing',
      expected: 'baseColor and/or emissive set to true',
      received: JSON.stringify(doc.slots),
    });
  }
  const palette = doc.palette ?? {};
  for (const [key, value] of Object.entries(palette)) {
    if (value !== 'transparent' && !COLOR_RE.test(value)) {
      issues.push({
        path: `/palette/${key}`,
        code: 'invalid_color',
        message: `palette entry "${key}" has invalid color "${value}"`,
        expected: 'transparent or #rrggbb[aa]',
      });
    }
  }
  if (!Array.isArray(doc.size)) return issues;
  const [w, h] = doc.size;
  const rows = doc.rows ?? [];
  if (rows.length !== h) {
    issues.push({
      path: '/rows',
      code: 'row_count',
      message: `${rows.length} rows, expected ${h} (size height)`,
      expected: `${h} rows`,
      received: `${rows.length} rows`,
    });
  }
  rows.forEach((row, y) => {
    const chars = [...row];
    if (chars.length !== w) {
      issues.push({
        path: `/rows/${y}`,
        code: 'row_length',
        message: `row ${y} has ${chars.length} chars, expected ${w} (size width)`,
        received: JSON.stringify(row),
      });
    }
    for (let x = 0; x < chars.length; x++) {
      const ch = chars[x] as string;
      if (!Object.hasOwn(palette, ch)) {
        issues.push({
          path: `/rows/${y}`,
          code: 'unknown_palette_char',
          message: `char "${ch}" at row ${y} col ${x} is not in the palette`,
          expected: `one of: ${Object.keys(palette).join(' ')}`,
        });
        break; // one per row is enough to point at the problem
      }
    }
  });
  return issues;
}

interface GraphNode {
  id: string;
  input?: string;
  inputs?: Record<string, string>;
}

function depsOf(node: GraphNode): string[] {
  const deps: string[] = [];
  if (node.input !== undefined) deps.push(node.input);
  if (node.inputs !== undefined) deps.push(...Object.values(node.inputs));
  return deps;
}

/** Material graph: duplicate ids, dangling node/output references, and cycles. */
function validateMatGraph(data: unknown): ValidationIssue[] {
  const doc = data as { nodes?: GraphNode[]; outputs?: Record<string, string | undefined> };
  const nodes = doc.nodes ?? [];
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  nodes.forEach((n, i) => {
    if (ids.has(n.id)) {
      issues.push({
        path: `/nodes/${i}/id`,
        code: 'duplicate_node_id',
        message: `duplicate node id "${n.id}"`,
      });
    }
    ids.add(n.id);
  });
  nodes.forEach((n, i) => {
    for (const dep of depsOf(n)) {
      if (!ids.has(dep)) {
        const near = nearest(dep, [...ids]);
        issues.push({
          path: `/nodes/${i}`,
          code: 'unknown_node_ref',
          message: `node "${n.id}" references unknown node "${dep}"`,
          ...(near !== undefined ? { hint: `did you mean "${near}"?` } : {}),
        });
      }
    }
  });
  for (const [slot, ref] of Object.entries(doc.outputs ?? {})) {
    if (ref !== undefined && !ids.has(ref)) {
      const near = nearest(ref, [...ids]);
      issues.push({
        path: `/outputs/${slot}`,
        code: 'unknown_node_ref',
        message: `output "${slot}" references unknown node "${ref}"`,
        ...(near !== undefined ? { hint: `did you mean "${near}"?` } : {}),
      });
    }
  }
  const cycle = findCycle(nodes, ids);
  if (cycle !== undefined) {
    issues.push({
      path: '/nodes',
      code: 'graph_cycle',
      message: `material graph has a cycle: ${cycle.join(' → ')}`,
    });
  } else {
    const depth = graphDepth(nodes);
    if (depth > MAX_GRAPH_DEPTH) {
      issues.push({
        path: '/nodes',
        code: 'graph_depth',
        message: `material graph depth ${depth} exceeds the limit of ${MAX_GRAPH_DEPTH}`,
        hint: 'split or flatten long dependency chains',
      });
    }
  }
  nodes.forEach((n, i) => {
    const typed = n as GraphNode & {
      type?: string;
      params?: { inMin?: number; inMax?: number };
    };
    if (
      typed.type === 'levels' &&
      typed.params?.inMin !== undefined &&
      typed.params.inMax !== undefined &&
      typed.params.inMin >= typed.params.inMax
    ) {
      issues.push({
        path: `/nodes/${i}/params`,
        code: 'levels_range',
        message: 'levels.inMin must be less than levels.inMax',
      });
    }
  });
  return issues;
}

function graphDepth(nodes: GraphNode[]): number {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const memo = new Map<string, number>();
  const depth = (id: string): number => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    const node = byId.get(id);
    const value =
      node === undefined
        ? 0
        : 1 +
          Math.max(
            0,
            ...depsOf(node)
              .filter((dep) => byId.has(dep))
              .map(depth),
          );
    memo.set(id, value);
    return value;
  };
  return Math.max(0, ...nodes.map((n) => depth(n.id)));
}

function findCycle(nodes: GraphNode[], ids: Set<string>): string[] | undefined {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const state = new Map<string, number>(); // 0 unseen, 1 on-stack, 2 done
  const path: string[] = [];
  let found: string[] | undefined;
  const visit = (id: string): void => {
    if (found !== undefined) return;
    const s = state.get(id) ?? 0;
    if (s === 2) return;
    if (s === 1) {
      found = [...path.slice(path.indexOf(id)), id];
      return;
    }
    state.set(id, 1);
    path.push(id);
    const node = byId.get(id);
    if (node !== undefined) for (const dep of depsOf(node)) if (ids.has(dep)) visit(dep);
    path.pop();
    state.set(id, 2);
  };
  for (const n of nodes) visit(n.id);
  return found;
}

// Procedural material graph (rung 4), docs/06-materials-and-assets.md §4. CPU-rasterized to
// textures; nodes are pure per-UV functions. Closed 14-node vocabulary.

// Every field carries a `.describe()` so the emitted JSON Schema documents units: UV space is
// 0..1 on both axes, scalars are 0..1 unless stated, colors are "#rrggbb" or "#rrggbbaa".

const color = z
  .string()
  .regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'expected #rrggbb or #rrggbbaa');

const rampStop = z.strictObject({
  t: z.number().min(0).max(1).describe('Position of the stop along the input 0..1.'),
  color: color.describe("Stop color '#rrggbb' or '#rrggbbaa'."),
});

// Each node: id + type + optional single input ref or named inputs + params.
const nodeBase = {
  id: z.string().min(1).describe('Node id, unique within the graph.'),
  input: z
    .string()
    .min(1)
    .describe('Id of the single upstream node this node reads (single-input nodes).')
    .optional(),
  inputs: z
    .record(z.string(), z.string())
    .describe("Named upstream node ids for multi-input nodes, e.g. { a: 'n1', b: 'n2' } for blend.")
    .optional(),
};
const uvScale = (dflt: number) =>
  z
    .number()
    .positive()
    .max(1_000_000)
    .describe(`Pattern repeats across the 0..1 UV range (default ${dflt}).`)
    .default(dflt);

const node = z.discriminatedUnion('type', [
  z.strictObject({
    ...nodeBase,
    type: z.literal('const').describe('Constant scalar or RGBA value.'),
    params: z
      .strictObject({
        value: z
          .union([z.number(), z.array(z.number()).length(4)])
          .describe('Scalar 0..1 or [r, g, b, a] 0..1.'),
      })
      .describe('Node parameters.'),
  }),
  z.strictObject({
    ...nodeBase,
    type: z.literal('uv').describe('Raw UV coordinates as a value.'),
    params: z.strictObject({}).describe('No parameters.').default({}),
  }),
  z.strictObject({
    ...nodeBase,
    type: z
      .literal('uv-transform')
      .describe('Scale/offset/rotate the UV space of the upstream node.'),
    params: z
      .strictObject({
        scale: uvScale(1),
        offset: z
          .array(z.number())
          .length(2)
          .describe('UV offset [u, v] in 0..1 units (default [0, 0]).')
          .default([0, 0]),
        rotateDeg: z
          .number()
          .describe('Rotation in degrees about the UV origin (default 0).')
          .default(0),
      })
      .describe('Node parameters.'),
  }),
  z.strictObject({
    ...nodeBase,
    type: z.literal('noise').describe('Fractal noise field (0..1).'),
    params: z
      .strictObject({
        kind: z
          .enum(['simplex', 'value'])
          .describe('Base noise: simplex (default) or value noise.')
          .default('simplex'),
        octaves: z
          .int()
          .min(1)
          .max(8)
          .describe('Number of fBm octaves, 1..8 (default 4).')
          .default(4),
        lacunarity: z
          .number()
          .positive()
          .max(16)
          .describe('Frequency multiplier per octave (default 2).')
          .default(2),
        gain: z
          .number()
          .min(0)
          .max(1)
          .describe('Amplitude multiplier per octave, 0..1 (default 0.5).')
          .default(0.5),
        scale: uvScale(4),
        seedOffset: z
          .int()
          .describe('Added to the document seed so sibling noise nodes differ (default 0).')
          .default(0),
      })
      .describe('Node parameters.'),
  }),
  z.strictObject({
    ...nodeBase,
    type: z.literal('worley').describe('Worley (cellular) noise (0..1).'),
    params: z
      .strictObject({
        scale: uvScale(4),
        jitter: z
          .number()
          .min(0)
          .max(1)
          .describe('Cell point randomness, 0 (regular grid) .. 1 (default).')
          .default(1),
        output: z
          .enum(['f1', 'f2', 'f2-f1'])
          .describe(
            'Distance output: nearest (f1, default), second-nearest (f2), or their difference (f2-f1).',
          )
          .default('f1'),
      })
      .describe('Node parameters.'),
  }),
  z.strictObject({
    ...nodeBase,
    type: z.literal('gradient').describe('Linear or radial gradient (0..1).'),
    params: z
      .strictObject({
        kind: z
          .enum(['linear', 'radial'])
          .describe('linear across UV (default) or radial from the center.')
          .default('linear'),
        angleDeg: z
          .number()
          .describe('Direction of a linear gradient in degrees (0 = along +u; default 0).')
          .default(0),
      })
      .describe('Node parameters.'),
  }),
  z.strictObject({
    ...nodeBase,
    type: z.literal('checker').describe('Checkerboard (0/1).'),
    params: z.strictObject({ scale: uvScale(8) }).describe('Node parameters.'),
  }),
  z.strictObject({
    ...nodeBase,
    type: z.literal('bricks').describe('Brick/mortar mask (1 = brick, 0 = mortar).'),
    params: z
      .strictObject({
        rows: z.int().positive().max(4096).describe('Brick rows across V (default 8).').default(8),
        cols: z
          .int()
          .positive()
          .max(4096)
          .describe('Brick columns across U (default 4).')
          .default(4),
        mortarWidth: z
          .number()
          .min(0)
          .max(0.5)
          .describe('Mortar width as a fraction of one brick cell, 0..0.5 (default 0.05).')
          .default(0.05),
        offset: z
          .number()
          .min(0)
          .max(1)
          .describe(
            'Horizontal shift of alternate rows as a fraction of a brick, 0..1 (default 0.5).',
          )
          .default(0.5),
      })
      .describe('Node parameters.'),
  }),
  z.strictObject({
    ...nodeBase,
    type: z.literal('ramp').describe('Map the scalar input 0..1 through a color ramp.'),
    params: z
      .strictObject({
        stops: z.array(rampStop).min(2).describe('Color stops ordered by t (at least two).'),
      })
      .describe('Node parameters.'),
  }),
  z.strictObject({
    ...nodeBase,
    type: z.literal('blend').describe('Combine inputs.a and inputs.b.'),
    params: z
      .strictObject({
        mode: z
          .enum(['mix', 'multiply', 'add', 'screen', 'overlay'])
          .describe('Blend mode (default mix).')
          .default('mix'),
        factor: z
          .number()
          .min(0)
          .max(1)
          .describe('Weight of input b, 0..1 (default 0.5).')
          .default(0.5),
      })
      .describe('Node parameters.'),
  }),
  z.strictObject({
    ...nodeBase,
    type: z.literal('threshold').describe('Soft step of the scalar input around an edge.'),
    params: z
      .strictObject({
        edge: z
          .number()
          .describe('Input value at which the output crosses 0.5 (default 0.5).')
          .default(0.5),
        smoothness: z
          .number()
          .nonnegative()
          .max(1)
          .describe('Half-width of the smooth transition around edge, 0..1 (default 0.05).')
          .default(0.05),
      })
      .describe('Node parameters.'),
  }),
  z.strictObject({
    ...nodeBase,
    type: z.literal('invert').describe('1 - input.'),
    params: z.strictObject({}).describe('No parameters.').default({}),
  }),
  z.strictObject({
    ...nodeBase,
    type: z.literal('levels').describe('Remap input range to output range with gamma.'),
    params: z
      .strictObject({
        inMin: z.number().describe('Input value mapped to outMin (default 0).').default(0),
        inMax: z
          .number()
          .describe('Input value mapped to outMax (default 1; must exceed inMin).')
          .default(1),
        gamma: z.number().positive().max(100).describe('Gamma exponent (default 1).').default(1),
        outMin: z.number().describe('Output low value (default 0).').default(0),
        outMax: z.number().describe('Output high value (default 1).').default(1),
      })
      .describe('Node parameters.'),
  }),
  z.strictObject({
    ...nodeBase,
    type: z
      .literal('height-to-normal')
      .describe('Derive a tangent-space normal map from a height input.'),
    params: z
      .strictObject({
        strength: z
          .number()
          .nonnegative()
          .max(100)
          .describe('Height gradient multiplier (default 1).')
          .default(1),
      })
      .describe('Node parameters.'),
  }),
]);

const outputRef = (slot: string) =>
  z.string().describe(`Id of the node rasterized into the ${slot} texture.`);
const optionalOutputs = {
  baseColor: outputRef('baseColor').optional(),
  roughness: outputRef('roughness').optional(),
  metalness: outputRef('metalness').optional(),
  normal: outputRef('normal').optional(),
  emissive: outputRef('emissive').optional(),
  ao: outputRef('ambient-occlusion').optional(),
};
// A union keeps the "at least one" invariant in emitted JSON Schema as well as Zod.
const outputs = z
  .union([
    z.strictObject({ ...optionalOutputs, baseColor: outputRef('baseColor') }),
    z.strictObject({ ...optionalOutputs, roughness: outputRef('roughness') }),
    z.strictObject({ ...optionalOutputs, metalness: outputRef('metalness') }),
    z.strictObject({ ...optionalOutputs, normal: outputRef('normal') }),
    z.strictObject({ ...optionalOutputs, emissive: outputRef('emissive') }),
    z.strictObject({ ...optionalOutputs, ao: outputRef('ambient-occlusion') }),
  ])
  .describe('Texture slot to node id (at least one slot).');

// Internal validation engine; the public contract is the hand-written MatGraphDoc
// (matgraph-types.ts) plus registerMaterialSchemas().
const matGraphSchema = z.strictObject({
  format: z.literal('molen/matgraph@1').describe("Format envelope; always 'molen/matgraph@1'."),
  size: z
    .array(z.int().min(1).max(2048))
    .length(2)
    .describe('Output texture size [width, height] in pixels, 1..2048 (default [512, 512]).')
    .default([512, 512]),
  seed: z.int().describe('Deterministic seed for noise nodes (default 0).').default(0),
  nodes: z
    .array(node)
    .min(1)
    .max(MAX_GRAPH_NODES)
    .describe(`Graph nodes (1..${MAX_GRAPH_NODES}); each is a pure per-UV function of its inputs.`),
  outputs,
});

const pixelGridSchema = z.strictObject({
  format: z.literal('molen/pixelgrid@1').describe("Format envelope; always 'molen/pixelgrid@1'."),
  size: z
    .array(z.int().min(1).max(256))
    .length(2)
    .describe('Grid size [width, height] in pixels, 1..256.'),
  // Palette keys are single code points; values are "transparent" or hex colors.
  palette: z
    .record(z.string(), z.string())
    .describe("Single-character key to 'transparent' or '#rrggbb[aa]' color."),
  rows: z
    .array(z.string())
    .min(1)
    .describe('One string per row (top to bottom), each `width` palette characters long.'),
  slots: z
    .strictObject({
      baseColor: z.boolean().describe('Emit the baseColor texture (default true).').default(true),
      emissive: z
        .boolean()
        .describe('Also emit the grid as an emissive texture (default false).')
        .default(false),
    })
    .describe('Which material texture slots the grid is rasterized into.')
    .default({ baseColor: true, emissive: false }),
  filter: z
    .enum(['nearest', 'linear'])
    .describe('Texture sampling filter: nearest (crisp pixels, default) or linear.')
    .default('nearest'),
});

let registered = false;
/** Register the material schemas into the shared registry (idempotent). */
export function registerMaterialSchemas(): void {
  if (registered) return;
  registered = true;
  registerSchema('pixelgrid', pixelGridSchema, {
    id: 'molen/pixelgrid@1',
    title: 'Pixel-grid texture',
    description: 'Indexed palette + rows of characters rasterized to a pixel-art texture.',
    examples: [
      {
        format: 'molen/pixelgrid@1',
        size: [4, 4],
        palette: { '.': 'transparent', X: '#222222', o: '#e6b84a' },
        rows: ['.XX.', 'XooX', 'XooX', '.XX.'],
      },
    ],
    docsRef: 'schemas/pixelgrid.md',
    validate: validatePixelGrid,
  });
  const uvPaintSchema = z.strictObject({
    format: z.literal('molen/uvpaint@1').describe("Format envelope; always 'molen/uvpaint@1'."),
    model: z
      .string()
      .min(1)
      .describe('Sidecar-relative path of the model the template was unwrapped from.'),
    atlasSize: z
      .array(z.int().positive())
      .length(2)
      .describe('Template/atlas size [width, height] in pixels (default [1024, 1024]).')
      .default([1024, 1024]),
    texelDensity: z
      .number()
      .positive()
      .describe('Texels per meter of model surface the atlas was laid out at (default 128).')
      .default(128),
    islands: z
      .array(
        z.strictObject({
          id: z.int().nonnegative().describe('Island number as printed on the template.'),
          label: z.string().describe("Human label for the island, e.g. 'head'.").default(''),
          color: z
            .string()
            .regex(/^#[0-9a-fA-F]{6}$/)
            .describe("'#rrggbb' key color of the island in the island map."),
          uvBBox: z
            .array(z.number())
            .length(4)
            .describe('Island bounds [minU, minV, maxU, maxV] in 0..1 UV space.'),
          notes: z.string().describe('Free-form painting notes.').default(''),
        }),
      )
      .describe('UV islands annotated on the template.')
      .default([]),
    paintedImage: z
      .string()
      .describe('Sidecar-relative path of the painted template image to re-import.')
      .optional(),
    importRules: z
      .strictObject({
        maskToIslands: z
          .boolean()
          .describe('Clip paint to the island shapes on import (default true).')
          .default(true),
        dilationPx: z
          .int()
          .nonnegative()
          .describe('Gutter dilation in pixels applied after masking (default 8).')
          .default(8),
      })
      .describe('How the painted image is turned back into a texture.')
      .default({ maskToIslands: true, dilationPx: 8 }),
  });
  registerSchema('uvpaint', uvPaintSchema, {
    id: 'molen/uvpaint@1',
    title: 'UV paint sidecar',
    description:
      'Island annotations pairing a paint-by-numbers template with a model for re-import.',
    examples: [
      {
        format: 'molen/uvpaint@1',
        model: 'models/scout.glb',
        atlasSize: [1024, 1024],
        islands: [{ id: 1, label: 'head', color: '#e6194b', uvBBox: [0.02, 0.05, 0.31, 0.4] }],
      },
    ],
    docsRef: 'schemas/uvpaint.md',
  });
  registerSchema('matgraph', matGraphSchema, {
    id: 'molen/matgraph@1',
    title: 'Procedural material graph',
    description: 'A small node graph (noise, gradients, ramps, blends) CPU-rasterized to textures.',
    examples: [
      {
        format: 'molen/matgraph@1',
        size: [256, 256],
        seed: 1337,
        nodes: [
          { id: 'n1', type: 'noise', params: { kind: 'simplex', octaves: 5, scale: 4 } },
          {
            id: 'n2',
            type: 'ramp',
            input: 'n1',
            params: {
              stops: [
                { t: 0, color: '#4a4a52' },
                { t: 0.6, color: '#6e6a63' },
                { t: 1, color: '#9a948a' },
              ],
            },
          },
        ],
        outputs: { baseColor: 'n2' },
      },
    ],
    docsRef: 'schemas/matgraph.md',
    validate: validateMatGraph,
  });
}
