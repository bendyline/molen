/**
 * What streamed content is built from, without the rest of the client: instanced meshes that
 * share one WebGPU shader build per material (`InstanceBatch`), and the bounds a render group
 * states so the renderer can leave it out of scene walks it cannot be seen in (`RENDER_BOUNDS`).
 */
export {
  INSTANCE_BATCH_COLOR,
  INSTANCE_BATCH_MATRIX_COLUMNS,
  InstanceBatch,
  InstanceMatrixAttribute,
  isInstanceBatch,
  isInstanceBatchGeometry,
} from './three/instance-batch';
export {
  boxOutsideView,
  expandRenderBounds,
  markRenderBoundsChanged,
  RENDER_BOUNDS,
  RENDER_BOUNDS_STALE,
  RENDER_MATRICES_STALE,
  viewProjection,
} from './three/render-bounds';
