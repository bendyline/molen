/**
 * Audit every authored structure against the medium-fi style guide (docs-src/guide/medium-fi.md):
 * runtime level triangle targets, materials and draw calls, and the large-surface palette of the
 * vertex-colored skyline level. Reads sidecars and GLBs only; writes a JSON report.
 *
 *   node packages/tooling/scripts/check-medium-fi.mjs [--ids=a,b] [--strict]
 *
 * --strict exits non-zero when any level exceeds its target by more than 15% while its error is
 * still under the reducer's cap, which is a model the LOD generator should have met.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LANDMARK_LOD_LEVELS } from './landmark-lods.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const pack = JSON.parse(await readFile(resolve(root, 'content/worldgen/stylepack.json'), 'utf8'));
const ids = process.argv
  .find((arg) => arg.startsWith('--ids='))
  ?.slice(6)
  .toLowerCase()
  .split(',');
const strict = process.argv.includes('--strict');
const target = Object.fromEntries(
  LANDMARK_LOD_LEVELS.map((level) => [level.name, level.triangles]),
);

/** Linear RGB to HSL lightness, in the display (sRGB) encoding the guide's bands use. */
function lightness([r, g, b]) {
  const encode = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055);
  const c = [r, g, b].map(encode);
  return (Math.max(...c) + Math.min(...c)) / 2;
}

/** Area-weighted lightness of a vertex-colored GLB (the skyline level). */
function palette(bytes) {
  const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  const binStart = 20 + bytes.readUInt32LE(12) + 8;
  const read = (index) => {
    const accessor = json.accessors[index];
    const view = json.bufferViews[accessor.bufferView];
    const offset = binStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type];
    const stride = view.byteStride;
    const out = new Float64Array(accessor.count * size);
    const width = { 5126: 4, 5121: 1, 5123: 2, 5125: 4 }[accessor.componentType];
    for (let i = 0; i < accessor.count; i++)
      for (let c = 0; c < size; c++) {
        const at = offset + i * (stride ?? size * width) + c * width;
        const value =
          accessor.componentType === 5126
            ? bytes.readFloatLE(at)
            : accessor.componentType === 5121
              ? bytes.readUInt8(at) / (accessor.normalized ? 255 : 1)
              : accessor.componentType === 5123
                ? bytes.readUInt16LE(at) / (accessor.normalized ? 65535 : 1)
                : bytes.readUInt32LE(at);
        out[i * size + c] = value;
      }
    return out;
  };
  let area = 0,
    dark = 0,
    bright = 0,
    sum = 0;
  for (const mesh of json.meshes)
    for (const primitive of mesh.primitives) {
      if (primitive.attributes.COLOR_0 === undefined) continue;
      const position = read(primitive.attributes.POSITION);
      const color = read(primitive.attributes.COLOR_0);
      const size = json.accessors[primitive.attributes.COLOR_0].type === 'VEC4' ? 4 : 3;
      const index =
        primitive.indices !== undefined
          ? read(primitive.indices)
          : Float64Array.from({ length: position.length / 3 }, (_, i) => i);
      for (let i = 0; i < index.length; i += 3) {
        const [a, b, c] = [index[i], index[i + 1], index[i + 2]];
        const p = (k) => [position[k * 3], position[k * 3 + 1], position[k * 3 + 2]];
        const [pa, pb, pc] = [p(a), p(b), p(c)];
        const u = pb.map((v, d) => v - pa[d]);
        const v = pc.map((w, d) => w - pa[d]);
        const triangle =
          Math.hypot(
            u[1] * v[2] - u[2] * v[1],
            u[2] * v[0] - u[0] * v[2],
            u[0] * v[1] - u[1] * v[0],
          ) / 2;
        const rgb = [0, 1, 2].map(
          (d) => (color[a * size + d] + color[b * size + d] + color[c * size + d]) / 3,
        );
        const l = lightness(rgb);
        area += triangle;
        sum += l * triangle;
        if (l < 0.12) dark += triangle;
        if (l > 0.96) bright += triangle;
      }
    }
  return area > 0
    ? { meanLightness: sum / area, nearBlack: dark / area, pureWhite: bright / area }
    : undefined;
}

const models = [];
for (const [id, path] of Object.entries(pack.assets)) {
  if (!id.startsWith('molen.worldgen.structure.')) continue;
  if (ids && !ids.some((part) => id.includes(part))) continue;
  const sidecar = JSON.parse(await readFile(resolve(root, 'content/worldgen', path), 'utf8'));
  const directory = resolve(root, 'content/worldgen', dirname(path));
  const extent = Math.max(
    ...sidecar.bounds.aabb.max.map((value, axis) => value - sidecar.bounds.aabb.min[axis]),
  );
  const findings = [];
  const levels = {};
  for (const level of sidecar.runtimeLods?.levels ?? []) {
    levels[level.name] = { triangles: level.triangles, errorMeters: level.errorMeters };
    const over = level.triangles > target[level.name] * 1.15;
    // The reducer stops at an error cap per level (see landmark-lods.mjs); past it the master
    // itself is too dense for the level and needs re-authoring or an authored derivative.
    const cap = { district: 0.02, street: 0.006, closeup: 0.0015 }[level.name] ?? 0.02;
    const capped = level.errorMeters >= extent * cap * 0.95;
    if (over && level.name !== 'skyline')
      findings.push({
        rule: 'level-budget',
        level: level.name,
        triangles: level.triangles,
        target: target[level.name],
        capped,
      });
  }
  if (sidecar.stats.materials > 8)
    findings.push({ rule: 'materials', materials: sidecar.stats.materials });
  const closeup = sidecar.runtimeLods?.levels.find((level) => level.name === 'closeup');
  if (closeup !== undefined && closeup.drawCalls > 12)
    findings.push({ rule: 'draw-calls', drawCalls: closeup.drawCalls });
  const skyline = sidecar.runtimeLods?.levels.find((level) => level.name === 'skyline');
  const colors =
    skyline !== undefined ? palette(await readFile(resolve(directory, skyline.file))) : undefined;
  if (colors !== undefined && colors.nearBlack > 0.25)
    findings.push({ rule: 'near-black-surfaces', share: colors.nearBlack });
  if (colors !== undefined && colors.pureWhite > 0.25)
    findings.push({ rule: 'pure-white-surfaces', share: colors.pureWhite });
  models.push({
    id,
    master: sidecar.stats.triangles,
    materials: sidecar.stats.materials,
    extent,
    levels,
    ...(colors !== undefined ? { colors } : {}),
    findings,
  });
}
const counts = {};
for (const model of models)
  for (const finding of model.findings) {
    const key = finding.rule === 'level-budget' ? `${finding.rule}:${finding.level}` : finding.rule;
    counts[key] = (counts[key] ?? 0) + 1;
  }
const uncapped = models.filter((model) =>
  model.findings.some((finding) => finding.rule === 'level-budget' && !finding.capped),
);
await mkdir(resolve(root, '.artifacts/medium-fi'), { recursive: true });
await writeFile(
  resolve(root, '.artifacts/medium-fi/report.json'),
  `${JSON.stringify({ count: models.length, counts, models }, null, 2)}\n`,
);
console.log(`${models.length} structures audited; findings: ${JSON.stringify(counts)}`);
console.log(`levels over target with error budget left: ${uncapped.length}`);
if (strict && uncapped.length > 0) process.exitCode = 1;
