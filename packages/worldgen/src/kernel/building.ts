/**
 * One building from one request: analysis, recipe, ground fit, walls, roof, foundation. Emits
 * into a shared `MeshBufferBuilder`; degraded tiers emit a box placement instead of geometry.
 */

import { dmath } from '@bendyline/molen-kernel/determinism';
import type { ArchStyleDoc } from './archstyle-types';
import { buildFacade, buildOpeningFrames, type FacadeStats } from './facade';
import {
  analyzeFootprint,
  DEFAULT_FOOTPRINT_OPTIONS,
  directionToWorld,
  type FootprintAnalysis,
  type FootprintOptions,
  toWorld,
} from './footprint';
import { distancePointToSegment, ringBounds } from './geometry2d';
import { createInteriorSite } from './interior-site';
import type { MeshBufferBuilder } from './mesh-buffers';
import { type PropPlacement, placeProps, type RidgeLine, yawForDirection } from './props';
import { type BuildingRecipe, resolveBuildingRecipe, visibleProps } from './recipe';
import type { Wing } from './rectangles';
import { buildRoofDormers } from './roof-details';
import {
  buildFlatRoof,
  buildSkillionRoof,
  buildWingRoof,
  type RoofSurfaces,
  type WingRoofKind,
} from './roofs';
import { aspectSeed, type PackIdentity } from './seed';
import { buildStorefronts } from './storefronts';
import type {
  BuildingRecord,
  BuildingRequest,
  HeightSampler,
  MaterialSlot,
  RGB,
  Vec2,
} from './types';
import { buildFoundationSkirt, buildWalls, groundFit, type WallUv } from './walls';

export interface BoxPlacement {
  x: number;
  y: number;
  z: number;
  /** three.js rotation about +y. */
  yaw: number;
  sx: number;
  sy: number;
  sz: number;
  color: RGB;
}

export interface BuildingGenerateInput {
  request: BuildingRequest;
  style: ArchStyleDoc;
  pack: PackIdentity;
  ground: HeightSampler;
  /** 0 = full detail; higher tiers drop detail; beyond the style tiers a box is emitted. */
  tier: number;
  /** Precomputed analysis (the batch generator analyzes once for sorting). */
  analysis?: FootprintAnalysis;
  footprintOptions?: FootprintOptions;
  /** Render textured materials as vertex colors only (fewer mesh groups). */
  collapseMaterials?: boolean;
  /** Budget fallback: retain roof shape and bounded facades; collapseMaterials defaults true. */
  simplified?: boolean;
  /** Generate real openings and storey metadata for lazy interiors. */
  enterable?: boolean;
}

export interface BuildingResult {
  analysis: FootprintAnalysis;
  recipe?: BuildingRecipe;
  record?: BuildingRecord;
  box?: BoxPlacement;
  skipped?: 'degenerate' | 'roof';
  /** Prop instances attached to the building (roof props); empty for boxes. */
  props?: PropPlacement[];
  facade?: FacadeStats;
}

const SKIRT_SPACING = 8;

/** Map seam edges of the request outline onto the cleaned (possibly snapped) build outline. */
function seamEdgesFor(
  request: BuildingRequest,
  outline: readonly Vec2[],
): ReadonlySet<number> | undefined {
  if (request.seamEdges === undefined || request.seamEdges.length === 0) return undefined;
  const seams = new Set<number>();
  for (let index = 0; index < outline.length; index++) {
    const a = outline[index] as Vec2;
    const b = outline[(index + 1) % outline.length] as Vec2;
    for (const edge of request.seamEdges) {
      const sa = request.outline[edge];
      const sb = request.outline[(edge + 1) % request.outline.length];
      if (sa === undefined || sb === undefined) continue;
      if (distancePointToSegment(a, sa, sb) < 0.05 && distancePointToSegment(b, sa, sb) < 0.05) {
        seams.add(index);
        break;
      }
    }
  }
  return seams.size > 0 ? seams : undefined;
}

function wingRoofKind(recipe: BuildingRecipe): WingRoofKind | undefined {
  switch (recipe.roof.type) {
    case 'gable':
    case 'hip':
    case 'pyramid':
    case 'shed':
    case 'mansard':
    case 'gambrel':
      return recipe.roof.type;
    default:
      return undefined;
  }
}

function boxPlacement(
  analysis: FootprintAnalysis,
  base: number,
  height: number,
  color: RGB,
  ground: HeightSampler,
  foundationDepth: number | undefined,
): BoxPlacement {
  const localBounds = ringBounds(analysis.localOutline);
  const centre = toWorld(analysis.frame, [
    (localBounds[0] + localBounds[2]) / 2,
    (localBounds[1] + localBounds[3]) / 2,
  ]);
  let bottom = base;
  if (foundationDepth !== undefined) {
    // A box can cover ground outside a concave footprint. Fit its actual perimeter too.
    const [u0, v0, u1, v1] = localBounds;
    const corners: Vec2[] = [
      [u0, v0],
      [u1, v0],
      [u1, v1],
      [u0, v1],
    ];
    const fit = groundFit(
      corners.map((p) => toWorld(analysis.frame, p)),
      ground,
    );
    if (fit.minGround < base) bottom = fit.minGround - foundationDepth;
  }
  return {
    x: centre[0],
    y: bottom,
    z: centre[1],
    yaw: -dmath.atan2(analysis.frame.s, analysis.frame.c),
    sx: Math.max(0.5, localBounds[2] - localBounds[0]),
    sy: Math.max(0.5, height + base - bottom),
    sz: Math.max(0.5, localBounds[3] - localBounds[1]),
    color,
  };
}

export function generateBuilding(
  input: BuildingGenerateInput,
  out: MeshBufferBuilder,
): BuildingResult {
  const analysis =
    input.analysis ??
    analyzeFootprint(
      input.request.outline,
      input.request.holes ?? [],
      input.footprintOptions ?? DEFAULT_FOOTPRINT_OPTIONS,
    );
  if (analysis.kind === 'degenerate') return { analysis, skipped: 'degenerate' };
  const recipe = resolveBuildingRecipe(
    input.style,
    input.pack,
    input.request,
    analysis,
    input.tier,
    {
      collapseMaterials: input.collapseMaterials ?? input.simplified === true,
    },
  );
  const outline = analysis.rectilinear
    ? analysis.localOutline.map((point) => toWorld(analysis.frame, point))
    : analysis.outline;
  const holes = analysis.rectilinear
    ? analysis.localHoles.map((hole) => hole.map((point) => toWorld(analysis.frame, point)))
    : analysis.holes;
  const fit = groundFit(input.request.groundOutline ?? outline, input.ground);
  const base =
    recipe.groundFit === 'platform-max' || input.enterable === true
      ? fit.maxGround
      : recipe.groundFit === 'platform-min'
        ? fit.minGround
        : fit.base;
  const wallBase = base + recipe.minHeight;
  let eave = wallBase + recipe.totalHeight;
  const foundationDepth = Math.max(0.05, recipe.foundationHeight);
  const bounds = ringBounds(outline);
  const record: BuildingRecord = {
    identity: input.request.identity,
    styleId: recipe.styleId,
    footprintKind: analysis.kind,
    roof: recipe.roof.type,
    base,
    height: recipe.minHeight + recipe.totalHeight,
    area: analysis.area,
    centroid: analysis.centroid,
    bounds,
    tier: input.tier,
  };
  if (recipe.box) {
    record.roof = 'box';
    return {
      analysis,
      recipe,
      record,
      box: boxPlacement(
        analysis,
        wallBase,
        recipe.totalHeight,
        recipe.parts.wall.color,
        input.ground,
        recipe.minHeight === 0 ? foundationDepth : undefined,
      ),
    };
  }

  const geometryTier = input.simplified === true ? Math.max(2, input.tier) : input.tier;
  const foundationSkirt = recipe.exposeFoundation && geometryTier <= 1 && recipe.minHeight === 0;
  let wallBottom = wallBase;
  if (recipe.minHeight === 0 && !foundationSkirt) {
    // Ground contact is structural: cheap tiers extend the existing walls without spending
    // extra vertices or material groups. Keep the platform, roof, and facade heights fixed.
    let minGround = fit.minGround;
    for (const hole of holes)
      minGround = Math.min(minGround, groundFit(hole, input.ground).minGround);
    if (minGround < base) wallBottom = minGround - foundationDepth;
  }
  const partSlots: ReadonlyArray<[MaterialSlot, keyof BuildingRecipe['parts']]> = [
    ['wall', 'wall'],
    ['roof', 'roof'],
    ['trim', 'trim'],
    ['foundation', 'foundation'],
    ['window', 'window'],
  ];
  for (const [slot, name] of partSlots) {
    const part = recipe.parts[name];
    out.setUvScale(slot, part.ref, part.uv === 'meters' ? part.uvScale : undefined);
  }
  const wallPart = recipe.parts.wall;
  const wallUv: WallUv = {
    mode: wallPart.uv,
    bayWidth: recipe.bayWidth,
    floorHeight: recipe.floorHeight,
    offsetU: wallPart.offsetU,
    offsetV: wallPart.offsetV,
    mirror: wallPart.mirror,
  };
  const wallSurface = { slot: 'wall' as const, ref: wallPart.ref, color: wallPart.color };
  const surfaces: RoofSurfaces = {
    roof: { slot: 'roof', ref: recipe.parts.roof.ref, color: recipe.parts.roof.color },
    trim: { slot: 'trim', ref: recipe.parts.trim.ref, color: recipe.parts.trim.color },
    wall: wallSurface,
  };
  const seams = seamEdgesFor(input.request, outline);
  const kind = wingRoofKind(recipe);
  const keepRoofShape = recipe.lodKeep.includes('roof-shape');
  const wings = analysis.wings.filter(
    (wing) => (wing.u1 - wing.u0) * (wing.v1 - wing.v0) >= recipe.minWingArea,
  );
  const usableWings = wings.length > 0 ? wings : analysis.wings.slice(0, 1);
  const pitched =
    kind !== undefined &&
    keepRoofShape &&
    input.request.clipped !== true &&
    analysis.rectilinear &&
    usableWings.length > 0 &&
    (recipe.roof.perWing || analysis.kind === 'box' || recipe.roof.complexFootprint === 'wings');
  const skillion =
    !pitched &&
    kind !== undefined &&
    keepRoofShape &&
    input.request.clipped !== true &&
    !analysis.rectilinear &&
    analysis.area < 400;

  const roofMark = out.mark();
  const ridges: RidgeLine[] = [];
  let dormerBudget = 16;
  let topAt: number | ((p: Vec2) => number) = eave;
  if (skillion) {
    const plane = buildSkillionRoof(
      outline,
      holes,
      analysis.frame,
      { eave, rise: Math.min(recipe.roof.rise, 0.35), direction: recipe.roof.shedDirection },
      surfaces,
      out,
    );
    if (plane === undefined) return { analysis, recipe, record, skipped: 'roof' };
    record.roof = 'skillion';
    topAt = plane;
  } else if (pitched && kind !== undefined) {
    for (const wing of usableWings) {
      const oriented: Wing =
        recipe.roof.ridge === 'short-axis'
          ? { ...wing, longAxis: wing.longAxis === 'u' ? 'v' : 'u' }
          : wing;
      let shedDirection = recipe.roof.shedDirection;
      if (kind === 'shed' && recipe.roof.shedDownhill) {
        const along = oriented.longAxis === 'u';
        const nearMid: Vec2 = along
          ? [(oriented.u0 + oriented.u1) / 2, oriented.v0]
          : [oriented.u0, (oriented.v0 + oriented.v1) / 2];
        const farMid: Vec2 = along
          ? [(oriented.u0 + oriented.u1) / 2, oriented.v1]
          : [oriented.u1, (oriented.v0 + oriented.v1) / 2];
        const near = toWorld(analysis.frame, nearMid);
        const far = toWorld(analysis.frame, farMid);
        shedDirection =
          input.ground.sampleHeight(far[0], far[1]) >= input.ground.sampleHeight(near[0], near[1])
            ? 1
            : -1;
      }
      buildWingRoof(
        kind,
        {
          wing: oriented,
          frame: analysis.frame,
          eave,
          rise: recipe.roof.rise,
          lowerRise: recipe.roof.lowerRise,
          overhang: recipe.roof.overhang,
          tier: geometryTier,
          surfaces,
          shedDirection,
        },
        out,
      );
      if (
        recipe.roof.dormers &&
        input.simplified !== true &&
        recipe.lodKeep.includes('roof-features')
      ) {
        dormerBudget -= buildRoofDormers(
          kind,
          {
            wing: oriented,
            frame: analysis.frame,
            eave,
            rise: recipe.roof.rise,
            lowerRise: recipe.roof.lowerRise,
            overhang: recipe.roof.overhang,
            tier: geometryTier,
            surfaces,
            shedDirection,
          },
          recipe.roof.dormers,
          { slot: 'window', ref: recipe.parts.window.ref, color: recipe.parts.window.color },
          out,
          dormerBudget,
        );
      }
      if (kind === 'gable' || kind === 'hip') {
        const along = oriented.longAxis === 'u';
        const a0 = along ? oriented.u0 : oriented.v0;
        const a1 = along ? oriented.u1 : oriented.v1;
        const b0 = along ? oriented.v0 : oriented.u0;
        const b1 = along ? oriented.v1 : oriented.u1;
        const hd = (b1 - b0) / 2;
        const bc = (b0 + b1) / 2;
        const hip = kind === 'hip';
        if (!(hip && a1 - a0 <= 2 * hd * 1.15)) {
          const r0 = hip ? a0 + hd : a0;
          const r1 = hip ? a1 - hd : a1;
          const yR = eave + hd * recipe.roof.rise;
          const pa = toWorld(analysis.frame, along ? [r0, bc] : [bc, r0]);
          const pb = toWorld(analysis.frame, along ? [r1, bc] : [bc, r1]);
          const dir = directionToWorld(analysis.frame, along ? [1, 0] : [0, 1]);
          ridges.push({
            a: [pa[0], yR, pa[1]],
            b: [pb[0], yR, pb[1]],
            yaw: yawForDirection(dir[0], dir[1]),
            priority: oriented.priority,
          });
        }
      }
    }
  } else {
    const parapet = recipe.roof.type === 'flat' ? recipe.roof.parapet : undefined;
    const ok = buildFlatRoof(outline, holes, eave, parapet, surfaces, geometryTier, out);
    if (!ok) return { analysis, recipe, record, skipped: 'roof' };
    record.roof = 'flat';
  }

  if (input.request.height !== undefined) {
    // Known height is ground-to-top, including the roof and any raised minimum height.
    // Reserve roof space within that envelope, limiting it so shallow parts retain walls.
    const oldEave = eave;
    const roofRise = Math.max(0, out.maxYSince(roofMark) - oldEave);
    const reserve = Math.min(roofRise, recipe.totalHeight * 0.4);
    // Even when a budget tier omits the parapet, windows keep the full-detail floor grid.
    const facadeHeight =
      recipe.totalHeight -
      (record.roof === 'flat'
        ? Math.min(recipe.roof.parapet?.height ?? 0, recipe.totalHeight * 0.4)
        : reserve);
    const scale = roofRise > 0 ? reserve / roofRise : 1;
    eave -= reserve;
    out.transformYSince(roofMark, oldEave, eave, scale);
    const oldTop = topAt;
    topAt = typeof oldTop === 'number' ? eave : (p) => eave + (oldTop(p) - oldEave) * scale;
    for (const ridge of ridges) {
      ridge.a[1] = eave + (ridge.a[1] - oldEave) * scale;
      ridge.b[1] = eave + (ridge.b[1] - oldEave) * scale;
    }
    recipe.totalHeight = eave - wallBase;
    if (recipe.roof.parapet !== undefined) recipe.roof.parapet.height *= scale;
    // Fit storeys into the actual wall envelope after reserving roof space. Explicit levels
    // describe the facade even when a tall single storey would fit several nominal floors.
    if (input.request.levels === undefined)
      recipe.floors = Math.max(
        1,
        1 + Math.round((facadeHeight - recipe.groundFloorHeight) / recipe.floorHeight),
      );
    const nominalHeight = recipe.groundFloorHeight + (recipe.floors - 1) * recipe.floorHeight;
    const floorScale = facadeHeight / nominalHeight;
    recipe.floorHeight *= floorScale;
    recipe.groundFloorHeight *= floorScale;
    wallUv.floorHeight = recipe.floorHeight;
  }

  const interiorStoreys = [];
  for (let i = 0; i < Math.min(2, recipe.floors); i++) {
    const floor = wallBase + (i === 0 ? 0 : recipe.groundFloorHeight) + 0.04;
    const ceiling =
      wallBase +
      Math.min(
        i === 0 ? recipe.groundFloorHeight : recipe.groundFloorHeight + recipe.floorHeight,
        eave - wallBase,
      ) -
      0.12;
    if (ceiling - floor < 2.35) break;
    interiorStoreys.push({ floor, ceiling });
  }
  // Roof estimates can leave insufficient headroom for the mapped floor count. Keep a
  // human-scale ground floor when possible instead of inventing cramped, inaccessible levels.
  if (!interiorStoreys.length)
    interiorStoreys.push({
      floor: wallBase + 0.04,
      ceiling: wallBase + Math.min(3, eave - wallBase) - 0.12,
    });
  const site =
    input.enterable === true
      ? createInteriorSite(
          {
            ...input.request,
            interiorLabels: [
              ...(input.request.interiorLabels ?? []),
              ...input.request.labels,
              ...(input.request.context ? [input.request.context] : []),
              ...input.style.applicability.classes,
            ],
          },
          outline,
          holes,
          wallBase,
          interiorStoreys[0]?.ceiling ?? wallBase,
          input.ground,
          seams,
          interiorStoreys,
        )
      : undefined;
  if (site) record.interior = site;
  buildWalls(
    [outline, ...holes],
    wallBase,
    topAt,
    wallUv,
    wallSurface,
    seams,
    out,
    wallBottom,
    site?.openings,
  );
  // Reserve inexpensive open frames so distant interiors cannot exhaust the whole batch's
  // architecture budget before nearby buildings receive their materials and ornamentation.
  buildOpeningFrames(
    outline,
    site?.openings ?? [],
    { slot: 'trim', ref: 'palette:#ffffff', color: [0.4, 0.37, 0.31] },
    input.simplified !== true && recipe.lodKeep.includes('facade-bands'),
    out,
  );
  const topFn: (p: Vec2) => number = typeof topAt === 'number' ? () => eave : topAt;
  const keepWindows = recipe.lodKeep.includes('facade-texture');
  const keepBands = input.simplified !== true && recipe.lodKeep.includes('facade-bands');
  let facade: FacadeStats | undefined;
  if (keepWindows || keepBands) {
    facade = buildFacade(
      {
        rings: [outline, ...holes],
        base: wallBase,
        topAt: topFn,
        floorHeight: recipe.floorHeight,
        groundFloorHeight: recipe.groundFloorHeight,
        floorCount: recipe.floors,
        bayWidth: recipe.bayWidth,
        cornerMargin: recipe.cornerMargin,
        salt: aspectSeed(recipe.seed, 'facade'),
        relief: keepBands,
        ...(site
          ? {
              openGroundEdges: new Set(site.openings.map((o) => o.edge)),
              structuralOpenings: site.openings,
            }
          : {}),
        ...(input.simplified === true ? { maxWindowColumns: 3, maxWindowRows: 2 } : {}),
        ...(keepWindows && recipe.facade.windows !== undefined
          ? { windows: recipe.facade.windows }
          : {}),
        ...(keepBands && recipe.facade.bands !== undefined ? { bands: recipe.facade.bands } : {}),
        window: {
          slot: 'window',
          ref: recipe.parts.window.ref,
          color: recipe.parts.window.color,
        },
        trim: surfaces.trim,
        ...(keepBands && recipe.facade.details
          ? { details: recipe.facade.details, roof: surfaces.roof, raised: recipe.minHeight > 0 }
          : {}),
        ...(seams !== undefined ? { seamEdges: seams } : {}),
      },
      out,
    );
  }
  const props: PropPlacement[] =
    input.tier <= 1 && input.request.storefronts !== undefined
      ? buildStorefronts(
          input.request.storefronts,
          outline,
          wallBase,
          topFn,
          seams,
          input.simplified === true,
          out,
          site !== undefined,
        )
      : [];
  const visible = input.simplified === true ? [] : visibleProps(recipe, input.tier);
  if (visible.length > 0) {
    placeProps(
      visible,
      {
        outline,
        holes,
        eave,
        parapetHeight:
          record.roof === 'flat' && recipe.roof.parapet !== undefined && input.tier < 2
            ? recipe.roof.parapet.height
            : 0,
        ridges,
        frameYaw: -dmath.atan2(analysis.frame.s, analysis.frame.c),
        salt: aspectSeed(recipe.seed, 'props'),
      },
      props,
    );
  }
  if (recipe.minHeight > 0) {
    out.addCap(
      'wall',
      wallPart.ref,
      outline,
      holes,
      () => wallBase,
      [0, -1, 0],
      (p) => [p[0], p[1]],
      wallPart.color,
    );
  }
  if (foundationSkirt) {
    for (const ring of [outline, ...holes]) {
      buildFoundationSkirt(
        ring,
        input.ground,
        base,
        foundationDepth,
        SKIRT_SPACING,
        {
          slot: 'foundation',
          ref: recipe.parts.foundation.ref,
          color: recipe.parts.foundation.color,
        },
        out,
      );
    }
  }
  return { analysis, recipe, record, props, ...(facade !== undefined ? { facade } : {}) };
}
