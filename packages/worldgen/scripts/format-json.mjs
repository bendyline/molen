/**
 * JSON serialization that matches the repo's biome formatting (2-space indent, 100 columns,
 * objects and arrays inline when they fit, numeric arrays filled line by line otherwise), so
 * generated documents are byte-stable under `biome check`.
 */

const WIDTH = 100;

export function formatJson(value, indent = 0, prefix = 0) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  const indentation = ' '.repeat(indent);
  const childIndentation = ' '.repeat(indent + 2);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map((item) => formatJson(item, indent + 2));
    if (items.every((item) => !item.includes('\n'))) {
      const inline = `[${items.join(', ')}]`;
      if (indent + prefix + inline.length <= WIDTH) return inline;
    }
    // Biome fills numeric data arrays, but expands long string lists one item per line.
    if (value.every((item) => typeof item === 'number')) {
      const lines = [];
      let line = childIndentation;
      for (const item of value) {
        const serialized = JSON.stringify(item);
        const separator = line === childIndentation ? '' : ', ';
        if (line.length + separator.length + serialized.length > WIDTH - 1) {
          lines.push(`${line},`);
          line = `${childIndentation}${serialized}`;
        } else {
          line += `${separator}${serialized}`;
        }
      }
      lines.push(line);
      return `[\n${lines.join('\n')}\n${indentation}]`;
    }
    return `[\n${value
      .map((item) => `${childIndentation}${formatJson(item, indent + 2)}`)
      .join(',\n')}\n${indentation}]`;
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return '{}';
  const inlineEntries = entries.map(
    ([key, entry]) => `${JSON.stringify(key)}: ${formatJson(entry, indent + 2)}`,
  );
  if (inlineEntries.every((entry) => !entry.includes('\n'))) {
    const inline = `{ ${inlineEntries.join(', ')} }`;
    if (indent + prefix + inline.length <= WIDTH) return inline;
  }
  return `{\n${entries
    .map(([key, entry]) => {
      const name = JSON.stringify(key);
      return `${childIndentation}${name}: ${formatJson(entry, indent + 2, name.length + 2)}`;
    })
    .join(',\n')}\n${indentation}}`;
}
