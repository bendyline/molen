import type { MatGraphDoc, MatNode } from './matgraph-types';
import { fbm, gradientNoise, valueNoise, worley } from './noise';
import { type BakedMaterial, createImage, type MaterialSlot, type RGBAImage } from './types';

type Node = MatNode;

type Vec4 = [number, number, number, number];
type NodeValue = { t: 's'; v: number } | { t: 'c'; v: Vec4 } | { t: 'uv'; v: [number, number] };
const MAX_GRAPH_NODES = 256;
const MAX_GRAPH_DEPTH = 64;

function parseColor(hex: string): Vec4 {
  const h = hex.slice(1);
  const r = Number.parseInt(h.slice(0, 2), 16) / 255;
  const g = Number.parseInt(h.slice(2, 4), 16) / 255;
  const b = Number.parseInt(h.slice(4, 6), 16) / 255;
  const a = h.length >= 8 ? Number.parseInt(h.slice(6, 8), 16) / 255 : 1;
  return [r, g, b, a];
}

function asScalar(nv: NodeValue): number {
  if (nv.t === 's') return nv.v;
  if (nv.t === 'c') return (nv.v[0] + nv.v[1] + nv.v[2]) / 3;
  return nv.v[0];
}
function asColor(nv: NodeValue): Vec4 {
  if (nv.t === 'c') return nv.v;
  if (nv.t === 's') return [nv.v, nv.v, nv.v, 1];
  return [nv.v[0], nv.v[1], 0, 1];
}
function asUV(nv: NodeValue): [number, number] {
  if (nv.t === 'uv') return nv.v;
  if (nv.t === 's') return [nv.v, nv.v];
  return [nv.v[0], nv.v[1]];
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

// Every parameter each node type reads. `bakeMatGraph` takes a *validated* document — one whose
// schema defaults have been applied — and this table is how it refuses anything else: an
// unvalidated doc has `undefined` where a default belongs, fbm then multiplies by undefined and
// every sample is NaN, which Math.round(NaN * 255) quietly stores as 0. A plausible-looking flat
// texture is the worst possible failure mode, so bake loudly refuses instead.
const REQUIRED_PARAMS = new Map<string, readonly string[]>([
  ['const', ['value']],
  ['uv', []],
  ['uv-transform', ['scale', 'offset', 'rotateDeg']],
  ['noise', ['kind', 'octaves', 'lacunarity', 'gain', 'scale', 'seedOffset']],
  ['worley', ['scale', 'jitter', 'output']],
  ['gradient', ['kind', 'angleDeg']],
  ['checker', ['scale']],
  ['bricks', ['rows', 'cols', 'mortarWidth', 'offset']],
  ['ramp', ['stops']],
  ['blend', ['mode', 'factor']],
  ['threshold', ['edge', 'smoothness']],
  ['invert', []],
  ['levels', ['inMin', 'inMax', 'gamma', 'outMin', 'outMax']],
  ['height-to-normal', ['strength']],
]);

const VALIDATE_HINT =
  "bake a validated document — validateByKind('matgraph', doc) applies the schema defaults";

/** Every number reachable from a parameter value must be finite (NaN/Infinity poison a texture). */
function allFinite(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(allFinite);
  if (typeof value === 'object' && value !== null) return Object.values(value).every(allFinite);
  return value !== undefined;
}

function assertNodeParams(node: Node): void {
  const required = REQUIRED_PARAMS.get(node.type);
  if (required === undefined) {
    throw new Error(
      `material graph node "${node.id}" has unknown type "${node.type}" — known types: ${[...REQUIRED_PARAMS.keys()].join(', ')}`,
    );
  }
  const params = (node as { params?: Record<string, unknown> }).params;
  if (required.length > 0 && (params === null || typeof params !== 'object')) {
    throw new Error(
      `material graph node "${node.id}" (${node.type}) has no params — ${VALIDATE_HINT}`,
    );
  }
  for (const key of required) {
    const value = (params as Record<string, unknown>)[key];
    if (value === undefined) {
      throw new Error(
        `material graph node "${node.id}" (${node.type}) is missing params.${key} — ${VALIDATE_HINT}`,
      );
    }
    if (!allFinite(value)) {
      throw new Error(
        `material graph node "${node.id}" (${node.type}) has a non-finite params.${key} — ${VALIDATE_HINT}`,
      );
    }
  }
}

// splitmix32 to derive a per-node sub-seed from the graph seed + node id.
function subSeed(graphSeed: number, id: string): number {
  let a = graphSeed >>> 0;
  for (let i = 0; i < id.length; i++) a = (Math.imul(a ^ id.charCodeAt(i), 0x9e3779b1) + 1) >>> 0;
  return a >>> 0;
}

class GraphEvaluator {
  private readonly byId = new Map<string, Node>();
  private readonly seeds = new Map<string, number>();
  private readonly memo = new Map<string, NodeValue>();

  constructor(private readonly doc: MatGraphDoc) {
    if (!Array.isArray(doc.nodes) || doc.nodes.length < 1 || doc.nodes.length > MAX_GRAPH_NODES) {
      throw new Error(`material graph must contain 1..${MAX_GRAPH_NODES} nodes`);
    }
    if (!Number.isFinite(doc.seed)) {
      throw new Error(
        `material graph has a non-finite seed (${String(doc.seed)}) — ${VALIDATE_HINT}`,
      );
    }
    if (doc.outputs === null || typeof doc.outputs !== 'object') {
      throw new Error(`material graph has no outputs map — ${VALIDATE_HINT}`);
    }
    for (const n of doc.nodes) {
      assertNodeParams(n);
      this.byId.set(n.id, n);
      this.seeds.set(n.id, subSeed(doc.seed, n.id));
    }
    this.detectCycles();
  }

  private detectCycles(): void {
    const state = new Map<string, number>(); // 0=unseen,1=onstack,2=done
    const path: string[] = [];
    const visit = (id: string): void => {
      const s = state.get(id) ?? 0;
      if (s === 2) return;
      if (s === 1) {
        const cycle = [...path.slice(path.indexOf(id)), id].join(' → ');
        throw new Error(`material graph has a cycle: ${cycle}`);
      }
      state.set(id, 1);
      path.push(id);
      if (path.length > MAX_GRAPH_DEPTH) {
        throw new Error(`material graph depth exceeds the limit of ${MAX_GRAPH_DEPTH}`);
      }
      const node = this.byId.get(id);
      if (node !== undefined) {
        for (const dep of this.depsOf(node)) {
          if (this.byId.has(dep)) visit(dep);
        }
      }
      path.pop();
      state.set(id, 2);
    };
    for (const n of this.doc.nodes) visit(n.id);
  }

  private depsOf(node: Node): string[] {
    const deps: string[] = [];
    if (node.input !== undefined) deps.push(node.input);
    if (node.inputs !== undefined) deps.push(...Object.values(node.inputs));
    return deps;
  }

  /** The primary upstream value: `input`, or `inputs.a` for multi-input nodes such as blend. */
  private input(node: Node, u: number, v: number): NodeValue | undefined {
    const id = node.input ?? node.inputs?.a;
    if (id === undefined) return undefined;
    return this.eval(id, u, v);
  }

  /** Clear the per-output-pixel memo while retaining graph structure and seeds. */
  beginSample(): void {
    this.memo.clear();
  }

  /** Evaluate a node's value at uv (u,v), sharing dependency work within one output pixel. */
  eval(id: string, u: number, v: number): NodeValue {
    const key = `${id}\u0000${u}\u0000${v}`;
    const cached = this.memo.get(key);
    if (cached !== undefined) return cached;
    const value = this.evalUncached(id, u, v);
    this.memo.set(key, value);
    return value;
  }

  private evalUncached(id: string, u: number, v: number): NodeValue {
    const node = this.byId.get(id);
    if (node === undefined) return { t: 's', v: 0 };
    const seed = this.seeds.get(id) ?? 0;

    switch (node.type) {
      case 'const': {
        const val = node.params.value;
        return typeof val === 'number' ? { t: 's', v: val } : { t: 'c', v: val };
      }
      case 'uv':
        return { t: 'uv', v: [u, v] };
      case 'uv-transform': {
        const base = this.input(node, u, v);
        const [iu, iv] = base !== undefined ? asUV(base) : [u, v];
        const { scale, offset, rotateDeg } = node.params;
        const rad = (rotateDeg * Math.PI) / 180;
        const cx = iu - 0.5;
        const cy = iv - 0.5;
        const rx = cx * Math.cos(rad) - cy * Math.sin(rad);
        const ry = cx * Math.sin(rad) + cy * Math.cos(rad);
        return { t: 'uv', v: [(rx + 0.5) * scale + offset[0], (ry + 0.5) * scale + offset[1]] };
      }
      case 'noise': {
        const coord = this.input(node, u, v);
        const [cu, cv] = coord !== undefined ? asUV(coord) : [u, v];
        const base = node.params.kind === 'value' ? valueNoise : gradientNoise;
        const n = fbm(
          base,
          cu * node.params.scale,
          cv * node.params.scale,
          seed + node.params.seedOffset,
          node.params.octaves,
          node.params.lacunarity,
          node.params.gain,
        );
        return { t: 's', v: clamp01(n) };
      }
      case 'worley': {
        const coord = this.input(node, u, v);
        const [cu, cv] = coord !== undefined ? asUV(coord) : [u, v];
        return {
          t: 's',
          v: worley(
            cu * node.params.scale,
            cv * node.params.scale,
            seed,
            node.params.jitter,
            node.params.output,
          ),
        };
      }
      case 'gradient': {
        const rad = (node.params.angleDeg * Math.PI) / 180;
        if (node.params.kind === 'radial') {
          const dx = u - 0.5;
          const dy = v - 0.5;
          return { t: 's', v: clamp01(Math.sqrt(dx * dx + dy * dy) * 2) };
        }
        return { t: 's', v: clamp01(u * Math.cos(rad) + v * Math.sin(rad)) };
      }
      case 'checker': {
        const s = node.params.scale;
        const cx = Math.floor(u * s);
        const cy = Math.floor(v * s);
        return { t: 's', v: (cx + cy) % 2 === 0 ? 0 : 1 };
      }
      case 'bricks': {
        const { rows, cols, mortarWidth, offset } = node.params;
        const ry = v * rows;
        const row = Math.floor(ry);
        const shift = row % 2 === 0 ? 0 : offset;
        const rx = (u * cols + shift) % 1;
        const fy = ry - row;
        const inMortar =
          rx < mortarWidth || rx > 1 - mortarWidth || fy < mortarWidth || fy > 1 - mortarWidth;
        return { t: 's', v: inMortar ? 0 : 1 };
      }
      case 'ramp': {
        const t = clamp01(asScalar(this.input(node, u, v) ?? { t: 's', v: 0 }));
        return { t: 'c', v: sampleRamp(node.params.stops, t) };
      }
      case 'blend': {
        const a = asColor(this.input(node, u, v) ?? { t: 's', v: 0 });
        const bId = node.inputs?.b;
        const b = bId !== undefined ? asColor(this.eval(bId, u, v)) : ([0, 0, 0, 1] as Vec4);
        return { t: 'c', v: blend(a, b, node.params.mode, node.params.factor) };
      }
      case 'threshold': {
        const x = asScalar(this.input(node, u, v) ?? { t: 's', v: 0 });
        const { edge, smoothness } = node.params;
        const lo = edge - smoothness;
        const hi = edge + smoothness;
        const t = hi > lo ? clamp01((x - lo) / (hi - lo)) : x >= edge ? 1 : 0;
        return { t: 's', v: t * t * (3 - 2 * t) };
      }
      case 'invert': {
        const nv = this.input(node, u, v) ?? { t: 's', v: 0 };
        if (nv.t === 'c') return { t: 'c', v: [1 - nv.v[0], 1 - nv.v[1], 1 - nv.v[2], nv.v[3]] };
        return { t: 's', v: 1 - asScalar(nv) };
      }
      case 'levels': {
        const x = asScalar(this.input(node, u, v) ?? { t: 's', v: 0 });
        const { inMin, inMax, gamma, outMin, outMax } = node.params;
        const t = inMax > inMin ? clamp01((x - inMin) / (inMax - inMin)) : 0;
        const g = gamma > 0 ? t ** (1 / gamma) : t;
        return { t: 's', v: outMin + g * (outMax - outMin) };
      }
      case 'height-to-normal': {
        const du = 1 / this.doc.size[0];
        const dv = 1 / this.doc.size[1];
        const h = (uu: number, vv: number): number =>
          asScalar(this.input(node, uu, vv) ?? { t: 's', v: 0 });
        const hx = ((h(u + du, v) - h(u - du, v)) / (2 * du)) * node.params.strength;
        const hy = ((h(u, v + dv) - h(u, v - dv)) / (2 * dv)) * node.params.strength;
        const nx = -hx;
        const ny = -hy;
        const nz = 1;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        return {
          t: 'c',
          v: [(nx / len) * 0.5 + 0.5, (ny / len) * 0.5 + 0.5, (nz / len) * 0.5 + 0.5, 1],
        };
      }
      default:
        return { t: 's', v: 0 };
    }
  }
}

function sampleRamp(stops: { t: number; color: string }[], t: number): Vec4 {
  const sorted = [...stops].sort((a, b) => a.t - b.t);
  if (t <= (sorted[0] as { t: number; color: string }).t)
    return parseColor((sorted[0] as { color: string }).color);
  const last = sorted[sorted.length - 1] as { t: number; color: string };
  if (t >= last.t) return parseColor(last.color);
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i] as { t: number; color: string };
    const b = sorted[i + 1] as { t: number; color: string };
    if (t >= a.t && t <= b.t) {
      const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
      const ca = parseColor(a.color);
      const cb = parseColor(b.color);
      return [
        ca[0] + (cb[0] - ca[0]) * f,
        ca[1] + (cb[1] - ca[1]) * f,
        ca[2] + (cb[2] - ca[2]) * f,
        ca[3] + (cb[3] - ca[3]) * f,
      ];
    }
  }
  return parseColor(last.color);
}

function blend(a: Vec4, b: Vec4, mode: string, factor: number): Vec4 {
  const out: Vec4 = [0, 0, 0, 1];
  for (let i = 0; i < 3; i++) {
    const x = a[i] as number;
    const y = b[i] as number;
    let m: number;
    switch (mode) {
      case 'multiply':
        m = x * y;
        break;
      case 'add':
        m = x + y;
        break;
      case 'screen':
        m = 1 - (1 - x) * (1 - y);
        break;
      case 'overlay':
        m = x < 0.5 ? 2 * x * y : 1 - 2 * (1 - x) * (1 - y);
        break;
      default:
        m = y; // 'mix'
        break;
    }
    out[i] = x + (m - x) * factor;
  }
  out[3] = a[3];
  return out;
}

/** Bake every output in one raster pass so shared graph dependencies are evaluated once/pixel. */
function bakeSlots(
  evaluator: GraphEvaluator,
  outputs: Partial<Record<MaterialSlot, string>>,
  width: number,
  height: number,
): Partial<Record<MaterialSlot, RGBAImage>> {
  const entries = Object.entries(outputs).filter(
    (entry): entry is [MaterialSlot, string] => typeof entry[1] === 'string',
  );
  const slots: Partial<Record<MaterialSlot, RGBAImage>> = {};
  for (const [slot] of entries) slots[slot] = createImage(width, height);
  for (let y = 0; y < height; y++) {
    const v = (y + 0.5) / height;
    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width;
      evaluator.beginSample();
      const p = (y * width + x) * 4;
      for (const [slot, nodeId] of entries) {
        const c = asColor(evaluator.eval(nodeId, u, v));
        const data = (slots[slot] as RGBAImage).data;
        data[p] = Math.round(clamp01(c[0]) * 255);
        data[p + 1] = Math.round(clamp01(c[1]) * 255);
        data[p + 2] = Math.round(clamp01(c[2]) * 255);
        data[p + 3] = Math.round(clamp01(c[3]) * 255);
      }
    }
  }
  return slots;
}

/**
 * Bake a validated material graph into per-slot RGBA textures.
 *
 * The document must have been through the schema (`validateByKind('matgraph', doc)`) so every
 * parameter default is applied — an unvalidated document is rejected rather than baked into a
 * silently wrong (usually flat) texture.
 */
export function bakeMatGraph(doc: MatGraphDoc): BakedMaterial {
  if (!Array.isArray(doc.size) || doc.size.length !== 2) {
    throw new Error(`material graph has no size [width, height] — ${VALIDATE_HINT}`);
  }
  const [width, height] = doc.size;
  const evaluator = new GraphEvaluator(doc);
  const slots = bakeSlots(evaluator, doc.outputs, width, height);
  return { slots, meta: { filter: 'linear' } };
}
