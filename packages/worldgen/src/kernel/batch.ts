/**
 * Batch generation: many building requests and an optional scatter request under budgets, with
 * a deterministic priority order, tier degradation, box fallbacks, records, stats, and a content
 * hash. The stepwise generator lets a host yield between chunks and abort.
 */

import { hashBytes } from '@bendyline/molen-kernel/determinism';
import { normalizeBudgets } from './budgets';
import { type BoxPlacement, type BuildingResult, generateBuilding } from './building';
import { analyzeFootprint, DEFAULT_FOOTPRINT_OPTIONS, type FootprintAnalysis } from './footprint';
import { MeshBufferBuilder } from './mesh-buffers';
import type { PropPlacement } from './props';
import { buildingMetrics } from './recipe';
import { type StyleRule, selectStyle } from './rules';
import { samplePlacementsSteps } from './scatter';
import { hashString } from './seed';
import { packIdentity, type ResolvedStylePack } from './stylepack';
import {
  type BuildingRecord,
  type BuildingRequest,
  countKey,
  emptyWorldgenStats,
  FLAT_GROUND,
  type HeightSampler,
  type MeshBuffers,
  type ModelPlacementRequest,
  PLACEMENT_STRIDE,
  type PlacementSet,
  type ScatterRequest,
  type WorldgenBudgets,
  type WorldgenProgress,
  type WorldgenStats,
} from './types';

export interface WorldgenBatchInput {
  buildings: BuildingRequest[];
  scatter?: ScatterRequest;
  /** Authored point placements, admitted before procedural scatter. */
  props?: ModelPlacementRequest[];
  ground?: HeightSampler;
  pack: ResolvedStylePack;
  /** Rules evaluated before the pack defaults (e.g. from a world binding). */
  rules?: StyleRule[];
  fallbackStyle?: string;
  scatterId?: string;
  budgets?: Partial<WorldgenBudgets>;
  /** Detail tier for the batch (0 = full). */
  tier?: number;
  /** Real ground-floor openings and lazy interior descriptors; needs the pack's `interiors`. */
  interiors?: boolean;
}

export interface WorldgenBatchOutput {
  buildings?: MeshBuffers;
  placements: PlacementSet[];
  records: BuildingRecord[];
  stats: WorldgenStats;
  /** sha256 over every output array; equal hashes mean byte-identical output. */
  hash: string;
}

export interface QueuedBuilding {
  request: BuildingRequest;
  analysis: FootprintAnalysis;
  styleId: string;
  order: number;
}

export const BOX_PLACEMENT_SET_ID: string = 'buildings:box';

/** Hash every typed array of an output (positions, normals, uvs, colors, indices, placements). */
export function hashWorldgenOutput(
  buildings: MeshBuffers | undefined,
  placements: readonly PlacementSet[],
): string {
  const parts: Uint8Array[] = [];
  if (buildings !== undefined) {
    for (const array of [
      buildings.positions,
      buildings.normals,
      buildings.uvs,
      buildings.colors,
      buildings.indices,
    ]) {
      parts.push(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
    }
  }
  for (const set of placements) {
    parts.push(new TextEncoder().encode(`${set.setId}|${set.modelRef}|${set.count}`));
    parts.push(new Uint8Array(set.data.buffer, set.data.byteOffset, set.data.byteLength));
  }
  let total = 0;
  for (const part of parts) total += part.byteLength;
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return hashBytes(bytes);
}

/** One placement set per prop model, models in name order, instances in emission order. */
export function placementSetsFromProps(
  props: ReadonlyMap<string, PropPlacement[]>,
): PlacementSet[] {
  const sets: PlacementSet[] = [];
  for (const model of [...props.keys()].sort()) {
    const list = props.get(model) as PropPlacement[];
    if (list.length === 0) continue;
    const data = new Float32Array(list.length * PLACEMENT_STRIDE);
    list.forEach((prop, index) => {
      const offset = index * PLACEMENT_STRIDE;
      data[offset] = prop.x;
      data[offset + 1] = prop.y;
      data[offset + 2] = prop.z;
      data[offset + 3] = prop.yaw;
      data[offset + 4] = prop.scale;
      data[offset + 5] = prop.scale;
      data[offset + 6] = prop.scale;
      data[offset + 7] = prop.color[0];
      data[offset + 8] = prop.color[1];
      data[offset + 9] = prop.color[2];
    });
    sets.push({ setId: `props:${model}`, modelRef: model, count: list.length, data });
  }
  return sets;
}

function placementSetFromBoxes(boxes: readonly BoxPlacement[]): PlacementSet | undefined {
  if (boxes.length === 0) return undefined;
  const data = new Float32Array(boxes.length * PLACEMENT_STRIDE);
  boxes.forEach((box, index) => {
    const offset = index * PLACEMENT_STRIDE;
    data[offset] = box.x;
    data[offset + 1] = box.y;
    data[offset + 2] = box.z;
    data[offset + 3] = box.yaw;
    data[offset + 4] = box.sx;
    data[offset + 5] = box.sy;
    data[offset + 6] = box.sz;
    data[offset + 7] = box.color[0];
    data[offset + 8] = box.color[1];
    data[offset + 9] = box.color[2];
  });
  return { setId: BOX_PLACEMENT_SET_ID, modelRef: 'builtin:box', count: boxes.length, data };
}

/** The buildings, sorted by priority (area descending, then identity hash), with styles chosen. */
export function queueBuildings(input: WorldgenBatchInput, stats: WorldgenStats): QueuedBuilding[] {
  const pack = input.pack;
  const rules = [...(input.rules ?? []), ...pack.root.defaults.rules];
  const fallback = input.fallbackStyle ?? pack.root.defaults.style;
  const queue: QueuedBuilding[] = [];
  input.buildings.forEach((request, index) => {
    const analysis = analyzeFootprint(
      request.outline,
      request.holes ?? [],
      DEFAULT_FOOTPRINT_OPTIONS,
    );
    if (analysis.kind === 'degenerate') {
      stats.buildingsSkipped++;
      return;
    }
    let styleId =
      request.style ??
      selectStyle(rules, buildingMetrics(request, analysis), fallback, request.identity).style;
    if (pack.archstyles[styleId] === undefined) {
      stats.capFailures++;
      styleId =
        pack.archstyles[fallback] !== undefined
          ? fallback
          : (Object.keys(pack.archstyles)[0] ?? fallback);
    }
    queue.push({ request, analysis, styleId, order: index });
  });
  queue.sort(
    (a, b) =>
      b.analysis.area - a.analysis.area ||
      hashString(a.request.identity) - hashString(b.request.identity) ||
      a.order - b.order,
  );
  return queue;
}

export function* generateWorldgenBatchSteps(
  input: WorldgenBatchInput,
  step = 64,
): Generator<WorldgenProgress, WorldgenBatchOutput, void> {
  const budgets = normalizeBudgets(input.budgets);
  const baseTier = input.tier ?? 0;
  const ground = input.ground ?? FLAT_GROUND;
  const pack = input.pack;
  const identity = packIdentity(pack);
  if (input.interiors === true && pack.interiors === undefined) {
    throw new Error(
      `interiors need an interior catalog, and style pack "${pack.id}" has none ("interiors" in stylepack.json)`,
    );
  }
  const catalog = input.interiors === true ? pack.interiors : undefined;
  const interiors = catalog !== undefined ? { interiors: catalog } : {};
  const stats = emptyWorldgenStats();
  stats.buildingsIn = input.buildings.length;
  const queue = queueBuildings(input, stats);
  const out = new MeshBufferBuilder();
  const boxes: BoxPlacement[] = [];
  const records: BuildingRecord[] = [];
  const props = new Map<string, PropPlacement[]>();
  // Reserve inexpensive architecture for the whole admitted batch before allowing large
  // footprints to spend the remaining budget on textures, facade bands, and roof furniture.
  const baselines: Array<{ mesh: MeshBufferBuilder; result: BuildingResult } | undefined> = [];
  const remainingMaterials = new Map<string, number>();
  let reservedVertices = 0;
  const total = queue.length * 2;
  for (let index = 0; index < queue.length; index++) {
    const item = queue[index] as QueuedBuilding;
    const style = pack.archstyles[item.styleId];
    if (style === undefined || index >= budgets.maxBuildings) {
      stats.buildingsDropped++;
    } else {
      let mesh = new MeshBufferBuilder();
      let result = generateBuilding(
        {
          request: item.request,
          style,
          pack: identity,
          ground,
          tier: baseTier,
          analysis: item.analysis,
          simplified: true,
          ...interiors,
        },
        mesh,
      );
      const keys = mesh.materialKeys();
      if (result.skipped !== undefined) {
        mesh = new MeshBufferBuilder();
      } else if (
        reservedVertices + mesh.vertexCount() > budgets.maxBuildingVertices ||
        new Set([...remainingMaterials.keys(), ...keys]).size > budgets.maxMaterialGroups
      ) {
        mesh = new MeshBufferBuilder();
        result = generateBuilding(
          {
            request: item.request,
            style,
            pack: identity,
            ground,
            tier: 99,
            analysis: item.analysis,
          },
          mesh,
        );
      }
      reservedVertices += mesh.vertexCount();
      for (const key of mesh.materialKeys()) {
        remainingMaterials.set(key, (remainingMaterials.get(key) ?? 0) + 1);
      }
      baselines[index] = { mesh, result };
    }
    if ((index + 1) % step === 0) yield { done: index + 1, total };
  }
  for (let index = 0; index < queue.length; index++) {
    const item = queue[index] as QueuedBuilding;
    const baseline = baselines[index];
    const style = pack.archstyles[item.styleId];
    if (baseline === undefined || style === undefined) continue;
    reservedVertices -= baseline.mesh.vertexCount();
    for (const key of baseline.mesh.materialKeys()) {
      const count = (remainingMaterials.get(key) ?? 1) - 1;
      if (count === 0) remainingMaterials.delete(key);
      else remainingMaterials.set(key, count);
    }
    let { mesh, result } = baseline;
    let collapsed = result.box === undefined && result.skipped === undefined;
    const availableVertices = budgets.maxBuildingVertices - out.vertexCount() - reservedVertices;
    // Avoid repeatedly generating and discarding elaborate facades once only crumbs remain.
    const detailHeadroom = availableVertices - mesh.vertexCount();
    if (
      index < budgets.detailedCount &&
      detailHeadroom >= 64 &&
      result.box === undefined &&
      result.skipped === undefined
    ) {
      const reservedKeys = [...out.materialKeys(), ...remainingMaterials.keys()];
      // Tier 1 still has windows in the default styles. Do not spend spare vertices on a
      // tier that removes the facade when the simplified version already preserves it.
      const lastDetailTier = baseTier === 0 ? 1 : baseTier;
      for (let tier = baseTier; tier <= lastDetailTier; tier++) {
        let candidate = new MeshBufferBuilder();
        let detail = generateBuilding(
          {
            request: item.request,
            style,
            pack: identity,
            ground,
            tier,
            analysis: item.analysis,
            ...interiors,
          },
          candidate,
        );
        if (detail.skipped !== undefined || detail.box !== undefined) continue;
        if (candidate.vertexCount() > availableVertices) continue;
        let collapse = false;
        if (
          new Set([...reservedKeys, ...candidate.materialKeys()]).size > budgets.maxMaterialGroups
        ) {
          candidate = new MeshBufferBuilder();
          detail = generateBuilding(
            {
              request: item.request,
              style,
              pack: identity,
              ground,
              tier,
              analysis: item.analysis,
              collapseMaterials: true,
              ...interiors,
            },
            candidate,
          );
          collapse = true;
        }
        if (
          detail.skipped !== undefined ||
          detail.box !== undefined ||
          candidate.vertexCount() > availableVertices ||
          new Set([...reservedKeys, ...candidate.materialKeys()]).size > budgets.maxMaterialGroups
        )
          continue;
        mesh = candidate;
        result = detail;
        collapsed = collapse;
        break;
      }
    }
    // Textures do not need additional vertices. Even after geometric detail runs out, a
    // simplified building can still use the shared material library if its groups fit.
    if (
      collapsed &&
      mesh === baseline.mesh &&
      index < budgets.detailedCount &&
      !result.box &&
      !result.skipped
    ) {
      const textured = new MeshBufferBuilder();
      const texturedResult = generateBuilding(
        {
          request: item.request,
          style,
          pack: identity,
          ground,
          tier: baseTier,
          analysis: item.analysis,
          simplified: true,
          collapseMaterials: false,
          ...interiors,
        },
        textured,
      );
      if (
        textured.vertexCount() <= availableVertices &&
        new Set([...out.materialKeys(), ...remainingMaterials.keys(), ...textured.materialKeys()])
          .size <= budgets.maxMaterialGroups
      ) {
        mesh = textured;
        result = texturedResult;
        collapsed = false;
      }
    }
    out.append(mesh);
    // Release baseline geometry as each building is consumed; only the final merged mesh survives.
    baselines[index] = undefined;
    if (collapsed) stats.materialsCollapsed++;
    if (result.skipped !== undefined) {
      stats.buildingsSkipped++;
      continue;
    }
    if (result.record !== undefined) {
      records.push(result.record);
      countKey(stats.styles, result.record.styleId);
      countKey(stats.footprintKinds, result.record.footprintKind);
      countKey(stats.roofs, result.record.roof);
    }
    if (result.box !== undefined) {
      boxes.push(result.box);
      stats.buildingsBoxed++;
    } else {
      stats.buildingsRendered++;
    }
    for (const prop of result.props ?? []) {
      let list = props.get(prop.model);
      if (list === undefined) {
        list = [];
        props.set(prop.model, list);
      }
      list.push(prop);
    }
    if ((index + 1) % step === 0) yield { done: queue.length + index + 1, total };
  }
  const buildings = out.isEmpty() ? undefined : out.finalize();
  const placements: PlacementSet[] = [];
  const boxSet = placementSetFromBoxes(boxes);
  if (boxSet !== undefined) placements.push(boxSet);
  let usedInstances = 0;
  const buildingProps = placementSetsFromProps(props);
  const admit = (set: PlacementSet): void => {
    const count = Math.min(set.count, Math.floor(budgets.maxInstances - usedInstances));
    if (count <= 0) return;
    placements.push(
      count === set.count
        ? set
        : { ...set, count, data: set.data.slice(0, count * PLACEMENT_STRIDE) },
    );
    usedInstances += count;
  };
  // Identity signs have priority over roof decoration when the instance budget is tight.
  const signModels = new Set(
    input.buildings.flatMap((b) => (b.storefronts ?? []).map((s) => s.signModel)),
  );
  for (const set of buildingProps) if (signModels.has(set.modelRef)) admit(set);
  // Point placements are deterministic, ground-fitted, deduplicated and share the instance budget.
  const fixed = new Map<string, number[]>();
  const seen = new Set<string>();
  for (const prop of [...(input.props ?? [])].sort((a, b) =>
    a.identity < b.identity ? -1 : a.identity > b.identity ? 1 : 0,
  )) {
    if (usedInstances >= Math.floor(budgets.maxInstances) || seen.has(prop.identity)) continue;
    seen.add(prop.identity);
    const list = fixed.get(prop.model) ?? [];
    list.push(
      prop.at[0],
      ground.sampleHeight(...prop.at),
      prop.at[1],
      prop.yaw ?? 0,
      ...(prop.scale ?? [1, 1, 1]),
      1,
      1,
      1,
    );
    fixed.set(prop.model, list);
    usedInstances++;
  }
  for (const [modelRef, values] of [...fixed.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)))
    placements.push({
      setId: `mapped:${modelRef}`,
      modelRef,
      count: values.length / PLACEMENT_STRIDE,
      data: new Float32Array(values),
    });
  for (const set of buildingProps) if (!signModels.has(set.modelRef)) admit(set);
  const scatterId = input.scatterId ?? pack.root.defaults.scatter;
  const scatterDoc = scatterId !== undefined ? pack.scatters[scatterId] : undefined;
  if (input.scatter !== undefined && scatterDoc !== undefined) {
    const scattered = yield* samplePlacementsSteps({
      request: input.scatter,
      doc: scatterDoc,
      pack: identity,
      ground,
      budget: {
        maxInstancesPerRule: budgets.maxInstancesPerRule,
        maxInstances: Math.max(0, budgets.maxInstances - usedInstances),
        maxPropModels: budgets.maxPropModels,
      },
      tier: baseTier,
    });
    placements.push(...scattered);
  }
  if (buildings !== undefined) {
    stats.vertices = buildings.vertexCount;
    stats.triangles = buildings.triangleCount;
    stats.meshBytes = buildings.bytes;
  }
  for (const set of placements) {
    stats.instanceBytes += set.data.byteLength;
    stats.placementsByModel[set.modelRef] =
      (stats.placementsByModel[set.modelRef] ?? 0) + set.count;
  }
  return {
    ...(buildings !== undefined ? { buildings } : {}),
    placements,
    records,
    stats,
    hash: hashWorldgenOutput(buildings, placements),
  };
}

/** Run the stepwise generator to completion. */
export function generateWorldgenBatch(input: WorldgenBatchInput): WorldgenBatchOutput {
  const generator = generateWorldgenBatchSteps(input, Number.MAX_SAFE_INTEGER);
  for (;;) {
    const next = generator.next();
    if (next.done === true) return next.value;
  }
}

/** ArrayBuffers to transfer when posting an output across a worker boundary. */
export function worldgenTransferables(output: WorldgenBatchOutput): ArrayBuffer[] {
  const buffers: ArrayBuffer[] = [];
  if (output.buildings !== undefined) {
    for (const array of [
      output.buildings.positions,
      output.buildings.normals,
      output.buildings.uvs,
      output.buildings.colors,
      output.buildings.indices,
    ]) {
      if (array.buffer instanceof ArrayBuffer) buffers.push(array.buffer);
    }
  }
  for (const set of output.placements) {
    if (set.data.buffer instanceof ArrayBuffer) buffers.push(set.data.buffer);
  }
  return buffers;
}
