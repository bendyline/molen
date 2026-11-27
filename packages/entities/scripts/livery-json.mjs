/**
 * JSON text for catalogs that carry livery artwork, with each shape's outline on one line.
 *
 * A livery shape is `{ color, points, holes? }`; aircraft liveries hold hundreds of thousands of
 * outline points. Formatted one number per line, the aircraft type catalog outgrows Biome's file
 * limit and the editable catalog grows past 20 MB. Here every shape's `points` and `holes` stay
 * compact on one line (one diff line per shape), and everything else keeps the caller's layout:
 * `format` receives the text with each outline swapped for a placeholder string and returns it
 * formatted (Biome for the type catalogs, nothing for liveries.json). The output is deterministic.
 */
export function stringifyWithCompactOutlines(value, format = (text) => text) {
  const outlines = [];
  const swap = (node) => {
    if (Array.isArray(node)) return node.map(swap);
    if (!node || typeof node !== 'object') return node;
    const isShape = typeof node.color === 'string' && Array.isArray(node.points);
    const out = {};
    for (const [key, child] of Object.entries(node)) {
      if (isShape && (key === 'points' || key === 'holes')) {
        out[key] = `__livery_outline_${outlines.length}__`;
        outlines.push(JSON.stringify(child));
      } else out[key] = swap(child);
    }
    return out;
  };
  const text = format(`${JSON.stringify(swap(value), null, 2)}\n`);
  return text.replace(/"__livery_outline_(\d+)__"/g, (_, index) => outlines[Number(index)]);
}
