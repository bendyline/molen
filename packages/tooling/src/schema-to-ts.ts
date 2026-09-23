// Minimal JSON Schema -> TypeScript type printer covering the wire-schema subset the engine
// emits (objects/records/arrays/tuples/enums/literals/unions/primitives). Used by
// `molen types gen` to print component data interfaces from the component registry.

interface JsonSchemaNode {
  type?: string | string[];
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  additionalProperties?: boolean | JsonSchemaNode;
  items?: JsonSchemaNode;
  prefixItems?: JsonSchemaNode[];
  minItems?: number;
  maxItems?: number;
  enum?: unknown[];
  const?: unknown;
  anyOf?: JsonSchemaNode[];
  oneOf?: JsonSchemaNode[];
}

function literal(value: unknown): string {
  if (typeof value !== 'string') return String(value);
  // Single-quoted (biome style) so generated modules pass the repo formatter untouched.
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

/** Print a JSON Schema node as a TS type expression. Unknown constructs degrade to `unknown`. */
export function schemaToTsType(schema: unknown, indent = ''): string {
  const node = schema as JsonSchemaNode;
  if (node === null || typeof node !== 'object') return 'unknown';
  if (node.const !== undefined) return literal(node.const);
  if (node.enum !== undefined) return node.enum.map(literal).join(' | ');
  const union = node.anyOf ?? node.oneOf;
  if (union !== undefined) return union.map((u) => schemaToTsType(u, indent)).join(' | ');

  const type = Array.isArray(node.type) ? node.type : node.type !== undefined ? [node.type] : [];
  if (type.length > 1) {
    return type.map((t) => schemaToTsType({ ...node, type: t }, indent)).join(' | ');
  }
  switch (type[0]) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    case 'array': {
      if (node.prefixItems !== undefined) {
        return `[${node.prefixItems.map((p) => schemaToTsType(p, indent)).join(', ')}]`;
      }
      const item = node.items !== undefined ? schemaToTsType(node.items, indent) : 'unknown';
      // Fixed-arity arrays (minItems === maxItems) print as tuples for better ergonomics.
      if (
        node.minItems !== undefined &&
        node.minItems === node.maxItems &&
        node.minItems > 0 &&
        node.minItems <= 8
      ) {
        return `[${Array.from({ length: node.minItems }, () => item).join(', ')}]`;
      }
      return `${item}[]`;
    }
    case 'object': {
      const props = node.properties ?? {};
      const required = new Set(node.required ?? []);
      const inner = `${indent}  `;
      const lines = Object.entries(props).map(([key, prop]) => {
        const safeKey = /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
        return `${inner}${safeKey}${required.has(key) ? '' : '?'}: ${schemaToTsType(prop, inner)};`;
      });
      const ap = node.additionalProperties;
      if (ap !== undefined && ap !== false) {
        const valueType = ap === true ? 'unknown' : schemaToTsType(ap, inner);
        if (lines.length === 0) return `Record<string, ${valueType}>`;
        lines.push(`${inner}[key: string]: unknown;`);
      }
      if (lines.length === 0) return 'Record<string, never>';
      return `{\n${lines.join('\n')}\n${indent}}`;
    }
    default:
      return 'unknown';
  }
}
