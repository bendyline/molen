/** Instanced meshes that share one WebGPU shader build per material: see `InstanceBatch`. */
export {
  INSTANCE_BATCH_COLOR,
  INSTANCE_BATCH_MATRIX_COLUMNS,
  InstanceBatch,
  InstanceMatrixAttribute,
  isInstanceBatch,
  isInstanceBatchGeometry,
} from './three/instance-batch';
