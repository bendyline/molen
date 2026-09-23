/** Parse JSON, tolerating a leading UTF-8 BOM (common from Windows editors/agents). */
export function parseJson(text: string): unknown {
  return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
}
