/**
 * Batch generation: many building requests and an optional scatter request under budgets, with
 * a deterministic priority order, tier degradation, box fallbacks, records, stats, and a content
 * hash. The stepwise generator lets a host yield between chunks and abort.
 */

import { hashBytes } from '@bendyline/molen-kernel/determinism';
import type { GlyphAtlasSet } from '@bendyline/molen-materials/text';
import { normalizeBudgets } from './budgets';
import { type BoxPlacement, type BuildingResult, generateBuilding } from './building';
import { analyzeFootprint, DEFAULT_FOOTPRINT_OPTIONS, type FootprintAnalysis } from './footprint';
import { distancePointToRing, pointInRing } from './geometry2d';
import { MeshBufferBuilder } from './mesh-buffers';
import type { PropPlacement } from './props';
import { buildingMetrics } from './recipe';
import { type StyleRule, selectStyle } from './rules';
import { type ScatterSampleInput, sampleScatterSteps } from './scatter';
import { hashString } from './seed';
import {
  buildSignMesh,
  type SignMeshBuffers,
  type SignPlacement,
  signMeshTransferables,
} from './sign-mesh';
import { packIdentity, type ResolvedStylePack } from './stylepack';
import { turfCoverArea } from './turf';
import {
  type BuildingRecord,
  type BuildingRequest,
  countKey,
  emptyWorldgenStats,
  FLAT_GROUND,
  type HeightSampler,
  type MeshBuffers,
  type ModelPlacementRequest,
  type NearPlacements,
  PLACEMENT_STRIDE,
  type PlacementSet,
  type ScatterRequest,
  type TurfCover,
  type WorldgenBudgets,
  type WorldgenProgress,
  type WorldgenStats,
} from './types';

export interface WorldgenBatchInput {
  buildings: BuildingRequest[];
  /**
   * Buildings the caller has already reduced to stand-ins (see `standInPlacement`): drawn as
   * given with the batch's own, and counted in `buildingsIn` and `buildingsBoxed`. They have no
   * style, analysis or record, and no budget applies to them.
   */
  standIns?: readonly BoxPlacement[];
  /**
   * Hash the output (`WorldgenBatchOutput.hash`, default true). Streaming skips it, leaving the
   * hash empty: SHA-256 over every array was a fifth of a batch's generation, and nothing reads it
   * there. Compare outputs with `hashWorldgenOutput` instead.
   */
  hashOutput?: boolean;
  scatter?: ScatterRequest;
  /** Authored point placements, admitted before procedural scatter. */
  props?: ModelPlacementRequest[];
  ground?: HeightSampler;
  pack: ResolvedStylePack;
  /** Rules evaluated before the pack defaults (e.g. from a world binding). */
  rules?: StyleRule[];
  fallbackStyle?: string;
  scatterId?: string;
  /** A composed scatter channel with its own identity and optional spatial rule gate. */
  scatterEnvironment?: Pick<
    ScatterSampleInput,
    'doc' | 'pack' | 'acceptsRule' | 'modelAt' | 'treeline' | 'crowns'
  >;
  budgets?: Partial<WorldgenBudgets>;
  /** Detail tier for the batch (0 = full). */
  tier?: number;
  /** Real ground-floor openings and lazy interior descriptors; needs the pack's `interiors`. */
  interiors?: boolean;
  /**
   * Glyph atlas metrics for storefront names (`StorefrontRequest.sign`): with it, named
   * storefronts build `WorldgenBatchOutput.signs`; without it they show their sign models.
   */
  glyphs?: GlyphAtlasSet;
  /**
   * Where a viewer stands, in the buildings' own frame. Buildings within `radius` of it are
   * queued nearest first, ahead of every other, so the batch's detail budget (and with it real
   * entrances and interiors) goes to what the viewer can walk up to instead of to the largest
   * footprints. Omitted, the queue is by priority and area alone.
   */
  focus?: { x: number; z: number; radius: number };
}

export interface WorldgenBatchOutput {
  buildings?: MeshBuffers;
  placements: PlacementSet[];
  /**
   * The plants `crowns` rules stand on the ground's painted crowns, every one of them, for a host
   * to draw around its camera (`createNearPlacements`); absent when none were placed.
   */
  near?: NearPlacements;
  /**
   * Where the batch's ground grows grass, for a host to stand tufts on around its camera
   * (`createTurf`); absent without `ScatterRequest.turf` and a `maxTurfCells` budget, or where
   * none grows.
   */
  turf?: TurfCover;
  /** Named storefront signs as one mesh; drawn with the glyph atlas's texture. */
  signs?: SignMeshBuffers;
  records: BuildingRecord[];
  stats: WorldgenStats;
  /** sha256 over every output array; equal hashes mean byte-identical output. Empty when the
   * input set `hashOutput: false`. */
  hash: string;
}

export interface QueuedBuilding {
  request: BuildingRequest;
  analysis: FootprintAnalysis;
  styleId: string;
  order: number;
  /** Distance from the batch's focus to the footprint, when within the focus radius. */
  near?: number;
}

/** Named signs per batch when the budgets do not say: more than a dense downtown block holds. */
const MAX_SIGNS = 1000;

/**
 * Share of `maxBuildingVertices` that a batch with a `focus` keeps from the buildings outside it
 * while every building's walls, roof and simplified facade are reserved, so the focused ones
 * still have room for their detail. Without it a batch of thousands of buildings (one 3 km
 * square of a Spanish town held 11,558) spent the whole budget on everyone's coarsest tier, and
 * the houses beside a walker were as bare as those a kilometre off. Buildings outside the focus
 * that no longer fit their coarsest tier become stand-ins; what the focused buildings leave of
 * the share goes to the rest's detail as before.
 */
const FOCUS_DETAIL_SHARE = 0.5;

/**
 * Buildings in a row whose walls and roof did not fit what is left of the vertex budget, after
 * which the rest of the batch go straight to stand-ins. The queue runs largest first, so once
 * this many have failed the budget is spent, and trying each remaining building first built a
 * mesh only to drop it: on a 2.4 km square of central Bogotá (35,000 footprints, a 200,000-vertex
 * budget) that was 30,000 discarded meshes, most of the batch's five seconds and hundreds of
 * megabytes of garbage in a worker. A building small enough to slip into the last crumbs after
 * such a run now becomes a stand-in too.
 */
const BUDGET_SPENT_AFTER = 48;

/** Every stand-in's box: the whole of a flat one, the walls of a pitched one. */
export const BOX_PLACEMENT_SET_ID: string = 'buildings:box';
/** The roofs of pitched stand-ins: the `builtin:roof.gable` model, one on each one's walls. */
export const GABLE_ROOF_PLACEMENT_SET_ID: string = 'buildings:roof.gable';

/**
 * Hash every typed array of an output (positions, normals, uvs, colors, indices, placements,
 * and named signs, near placements and turf cover when there are any).
 */
export function hashWorldgenOutput(
  buildings: MeshBuffers | undefined,
  placements: readonly PlacementSet[],
  signs?: SignMeshBuffers,
  near?: NearPlacements,
  turf?: TurfCover,
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
  if (signs !== undefined) {
    parts.push(new TextEncoder().encode(`signs|${signs.count}|${signs.plateIndexCount}`));
    for (const array of [
      signs.positions,
      signs.normals,
      signs.uvs,
      signs.plate,
      signs.ink,
      signs.indices,
    ])
      parts.push(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
  }
  if (near !== undefined) {
    parts.push(
      new TextEncoder().encode(
        `near|${near.count}|${near.cell}|${near.originX}|${near.originZ}|${near.columns}|${near.rows}|${near.models.join(',')}`,
      ),
    );
    for (const array of [near.data, near.model, near.start, ...(near.reach ? [near.reach] : [])])
      parts.push(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
  }
  if (turf !== undefined) {
    parts.push(
      new TextEncoder().encode(
        `turf|${turf.cell}|${turf.originX}|${turf.originZ}|${turf.columns}|${turf.rows}|${turf.swards
          .map((sward) => `${sward.label}:${sward.height}:${sward.density}`)
          .join(',')}`,
      ),
    );
    for (const array of [turf.rowStart, turf.runSward, turf.runEnd])
      parts.push(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
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

/**
 * Stand-ins as two sets: every box, and a roof for each pitched one, standing on its walls with
 * the same turn and plan, as high as its `roofHeight` and in its roof's color. A roof is its own
 * instance because its height follows the style's slope and the plan's depth, not the walls'
 * height: one shape scaled to the building cannot hold both.
 */
function placementSetsFromBoxes(boxes: readonly BoxPlacement[]): PlacementSet[] {
  const roofs: BoxPlacement[] = [];
  for (const box of boxes) {
    if (box.roof !== 'gable' || !((box.roofHeight ?? 0) > 0)) continue;
    roofs.push({
      x: box.x,
      y: box.y + box.sy,
      z: box.z,
      yaw: box.yaw,
      sx: box.sx,
      sy: box.roofHeight as number,
      sz: box.sz,
      color: box.roofColor ?? box.color,
    });
  }
  return [
    placementSetFromBoxes(boxes, BOX_PLACEMENT_SET_ID, 'builtin:box'),
    placementSetFromBoxes(roofs, GABLE_ROOF_PLACEMENT_SET_ID, 'builtin:roof.gable'),
  ].filter((set): set is PlacementSet => set !== undefined);
}

function placementSetFromBoxes(
  boxes: readonly BoxPlacement[],
  setId: string,
  modelRef: string,
): PlacementSet | undefined {
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
  return { setId, modelRef, count: boxes.length, data };
}

/** Buildings sorted by explicit priority, area descending, then identity hash, with styles chosen. */
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
    const focus = input.focus;
    let near: number | undefined;
    if (focus !== undefined) {
      const at: [number, number] = [focus.x, focus.z];
      const distance = pointInRing(at, request.outline)
        ? 0
        : distancePointToRing(at, request.outline);
      if (distance <= focus.radius) near = distance;
    }
    queue.push({
      request,
      analysis,
      styleId,
      order: index,
      ...(near !== undefined ? { near } : {}),
    });
  });
  queue.sort(
    (a, b) =>
      // Focused buildings first, nearest first; the rest keep their order among themselves.
      (a.near === undefined ? 1 : 0) - (b.near === undefined ? 1 : 0) ||
      (a.near ?? 0) - (b.near ?? 0) ||
      (b.request.priority ?? 0) - (a.request.priority ?? 0) ||
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
  // With a glyph atlas, storefronts that carry a name come back as sign placements.
  const named = input.glyphs !== undefined ? { namedSigns: true } : {};
  const signPlacements: SignPlacement[] = [];
  const stats = emptyWorldgenStats();
  stats.buildingsIn = input.buildings.length + (input.standIns?.length ?? 0);
  const queue = queueBuildings(input, stats);
  const out = new MeshBufferBuilder();
  const boxes: BoxPlacement[] = [];
  const records: BuildingRecord[] = [];
  const props = new Map<string, PropPlacement[]>();
  // Reserve inexpensive architecture for the whole admitted batch before allowing large
  // footprints to spend the remaining budget on textures, facade bands, and roof furniture:
  // first walls and roof for every building (the style's coarsest tier, a box only when even
  // that does not fit), then a simplified facade for as many as fit, largest first. Interior
  // openings come with full detail: cut into every budget facade they would cost a crowded
  // neighbourhood its windows.
  const baselines: Array<{ mesh: MeshBufferBuilder; result: BuildingResult } | undefined> = [];
  const remainingMaterials = new Map<string, number>();
  let reservedVertices = 0;
  const total = queue.length * 3;
  const reserve = (mesh: MeshBufferBuilder, sign: 1 | -1): void => {
    reservedVertices += sign * mesh.vertexCount();
    for (const key of mesh.materialKeys()) {
      const count = (remainingMaterials.get(key) ?? 0) + sign;
      if (count <= 0) remainingMaterials.delete(key);
      else remainingMaterials.set(key, count);
    }
  };
  // Kept from the buildings outside a focus while baselines and simplified facades are reserved.
  const focusReserve = queue.some((item) => item.near !== undefined)
    ? Math.floor(budgets.maxBuildingVertices * FOCUS_DETAIL_SHARE)
    : 0;
  const vertexLimit = (item: QueuedBuilding): number =>
    budgets.maxBuildingVertices - (item.near === undefined ? focusReserve : 0);
  const fitsWith = (
    add: MeshBufferBuilder,
    remove?: MeshBufferBuilder,
    limit = budgets.maxBuildingVertices,
  ): boolean => {
    if (reservedVertices - (remove?.vertexCount() ?? 0) + add.vertexCount() > limit) return false;
    const keys = new Set(remainingMaterials.keys());
    if (remove !== undefined)
      for (const key of remove.materialKeys())
        if ((remainingMaterials.get(key) ?? 0) <= 1) keys.delete(key);
    for (const key of add.materialKeys()) keys.add(key);
    return keys.size <= budgets.maxMaterialGroups;
  };
  const simplifiedTiers: number[] = [];
  // Stand-ins carry no mesh: they share one empty builder instead of allocating one each.
  const noMesh = new MeshBufferBuilder();
  const maxStandIns = budgets.maxStandIns ?? 0;
  let standIns = 0;
  let misses = 0;
  for (let index = 0; index < queue.length; index++) {
    const item = queue[index] as QueuedBuilding;
    const style = pack.archstyles[item.styleId];
    const pastCount = index >= budgets.maxBuildings;
    if (style === undefined || (pastCount && standIns >= maxStandIns)) {
      stats.buildingsDropped++;
    } else if (pastCount || misses >= BUDGET_SPENT_AFTER) {
      // A stand-in outright: past the count budget, or the vertex budget is spent.
      if (pastCount) standIns++;
      simplifiedTiers[index] = 99;
      let mesh = new MeshBufferBuilder();
      const result = generateBuilding(
        {
          request: item.request,
          style,
          pack: identity,
          ...named,
          ground,
          tier: 99,
          analysis: item.analysis,
        },
        mesh,
      );
      if (mesh.isEmpty()) mesh = noMesh;
      reserve(mesh, 1);
      baselines[index] = { mesh, result };
    } else {
      const structuralTier = Math.max(baseTier, style.lod.tiers.at(-1)?.minTier ?? 0);
      simplifiedTiers[index] = structuralTier;
      let mesh = new MeshBufferBuilder();
      let result = generateBuilding(
        {
          request: item.request,
          style,
          pack: identity,
          ...named,
          ground,
          tier: structuralTier,
          analysis: item.analysis,
          simplified: true,
        },
        mesh,
      );
      if (result.skipped !== undefined) {
        mesh = new MeshBufferBuilder();
      } else if (result.box !== undefined || fitsWith(mesh, undefined, vertexLimit(item))) {
        misses = 0;
      } else {
        misses++;
        mesh = new MeshBufferBuilder();
        result = generateBuilding(
          {
            request: item.request,
            style,
            pack: identity,
            ...named,
            ground,
            tier: 99,
            analysis: item.analysis,
          },
          mesh,
        );
      }
      reserve(mesh, 1);
      baselines[index] = { mesh, result };
    }
    if ((index + 1) % step === 0) yield { done: index + 1, total };
  }
  for (let index = 0; index < queue.length; index++) {
    const item = queue[index] as QueuedBuilding;
    const baseline = baselines[index];
    const style = pack.archstyles[item.styleId];
    if (
      baseline !== undefined &&
      style !== undefined &&
      (simplifiedTiers[index] as number) > baseTier &&
      baseline.result.box === undefined &&
      baseline.result.skipped === undefined &&
      reservedVertices < vertexLimit(item)
    ) {
      const mesh = new MeshBufferBuilder();
      const result = generateBuilding(
        {
          request: item.request,
          style,
          pack: identity,
          ...named,
          ground,
          tier: baseTier,
          analysis: item.analysis,
          simplified: true,
        },
        mesh,
      );
      if (
        result.skipped === undefined &&
        result.box === undefined &&
        fitsWith(mesh, baseline.mesh, vertexLimit(item))
      ) {
        reserve(baseline.mesh, -1);
        reserve(mesh, 1);
        baselines[index] = { mesh, result };
      }
    }
    if ((index + 1) % step === 0) yield { done: queue.length + index + 1, total };
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
            ...named,
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
              ...named,
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
          ...named,
          ground,
          tier: baseTier,
          analysis: item.analysis,
          simplified: true,
          collapseMaterials: false,
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
    if (result.signs !== undefined) signPlacements.push(...result.signs);
    if ((index + 1) % step === 0) yield { done: 2 * queue.length + index + 1, total };
  }
  // Named signs in building priority order; a name the atlas cannot set shows its model instead.
  // They come first out of the instance budget, as sign models do, so naming them never admits
  // more of anything else.
  let signs: SignMeshBuffers | undefined;
  if (input.glyphs !== undefined && signPlacements.length > 0) {
    const built = buildSignMesh(
      signPlacements,
      input.glyphs,
      Math.min(budgets.maxSigns ?? MAX_SIGNS, Math.floor(budgets.maxInstances)),
    );
    signs = built.mesh;
    for (const prop of built.fallbacks) {
      const list = props.get(prop.model) ?? [];
      list.push(prop);
      props.set(prop.model, list);
    }
  }
  if (input.standIns !== undefined) {
    for (const box of input.standIns) boxes.push(box);
    stats.buildingsBoxed += input.standIns.length;
  }
  const buildings = out.isEmpty() ? undefined : out.finalize();
  const placements: PlacementSet[] = [];
  placements.push(...placementSetsFromBoxes(boxes));
  let usedInstances = signs?.count ?? 0;
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
      ...(prop.color ?? [1, 1, 1]),
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
  const scatterDoc =
    input.scatterEnvironment?.doc ??
    (scatterId !== undefined ? pack.scatters[scatterId] : undefined);
  let near: NearPlacements | undefined;
  let turf: TurfCover | undefined;
  if (input.scatter !== undefined && scatterDoc !== undefined) {
    const scattered = yield* sampleScatterSteps({
      request: input.scatter,
      doc: scatterDoc,
      pack: input.scatterEnvironment?.pack ?? identity,
      ...(input.scatterEnvironment?.acceptsRule !== undefined
        ? { acceptsRule: input.scatterEnvironment.acceptsRule }
        : {}),
      ...(input.scatterEnvironment?.modelAt !== undefined
        ? { modelAt: input.scatterEnvironment.modelAt }
        : {}),
      ...(input.scatterEnvironment?.treeline !== undefined
        ? { treeline: input.scatterEnvironment.treeline }
        : {}),
      ...(input.scatterEnvironment?.crowns !== undefined
        ? { crowns: input.scatterEnvironment.crowns }
        : {}),
      ground,
      budget: {
        maxInstancesPerRule: budgets.maxInstancesPerRule,
        maxInstances: Math.max(0, budgets.maxInstances - usedInstances),
        maxPropModels: budgets.maxPropModels,
        maxGroundCoverInstances: budgets.maxGroundCoverInstances,
        maxGroundCoverModels: budgets.maxGroundCoverModels,
        maxUnderstoryInstances: budgets.maxUnderstoryInstances ?? 0,
        maxUnderstoryModels: budgets.maxUnderstoryModels ?? 0,
        maxAgricultureInstances: budgets.maxAgricultureInstances ?? 0,
        maxAgricultureModels: budgets.maxAgricultureModels ?? 0,
        maxGardenInstances: budgets.maxGardenInstances ?? 0,
        maxGardenModels: budgets.maxGardenModels ?? 0,
        ...(budgets.maxNearInstances !== undefined
          ? { maxNearInstances: budgets.maxNearInstances }
          : {}),
        ...(budgets.maxTurfCells !== undefined ? { maxTurfCells: budgets.maxTurfCells } : {}),
      },
      tier: baseTier,
    });
    placements.push(...scattered.placements);
    near = scattered.near;
    turf = scattered.turf;
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
  if (near !== undefined) {
    stats.instanceBytes +=
      near.data.byteLength +
      near.model.byteLength +
      near.start.byteLength +
      (near.reach?.byteLength ?? 0);
    stats.nearPlacements = near.count;
  }
  if (turf !== undefined) {
    stats.instanceBytes +=
      turf.rowStart.byteLength + turf.runSward.byteLength + turf.runEnd.byteLength;
    stats.turfArea = turfCoverArea(turf);
  }
  return {
    ...(buildings !== undefined ? { buildings } : {}),
    placements,
    ...(near !== undefined ? { near } : {}),
    ...(turf !== undefined ? { turf } : {}),
    ...(signs !== undefined ? { signs } : {}),
    records,
    stats,
    hash:
      input.hashOutput === false
        ? ''
        : hashWorldgenOutput(buildings, placements, signs, near, turf),
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
  if (output.near !== undefined)
    for (const array of [
      output.near.data,
      output.near.model,
      output.near.start,
      ...(output.near.reach ? [output.near.reach] : []),
    ])
      if (array.buffer instanceof ArrayBuffer) buffers.push(array.buffer);
  if (output.turf !== undefined)
    for (const array of [output.turf.rowStart, output.turf.runSward, output.turf.runEnd])
      if (array.buffer instanceof ArrayBuffer) buffers.push(array.buffer);
  buffers.push(...signMeshTransferables(output.signs));
  return buffers;
}
