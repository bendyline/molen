/**
 * Determinism primitives without the rest of the kernel (and without `ses`): the dmath
 * indirection, the pure vector/quaternion math, the seedable RNG, and canonical hashing. Capability packages that must be
 * byte-reproducible in Node, a Worker, and the browser import this subpath so their bundles
 * never pull the SES script host.
 */
export type { DMath } from './dmath';
export { dmath } from './dmath';
export { canonicalBytes, hashBytes, hashJson } from './hash';
export type { Quat, TransformLike, Vec3 } from './math3d';
export {
  approach,
  composeTransforms,
  identityQuat,
  inverseTransformPoint,
  lookRotation,
  quatConjugate,
  quatDot,
  quatFromAxisAngle,
  quatFromEuler,
  quatFromTo,
  quatFromYaw,
  quatMul,
  quatNormalize,
  quatRotateVec3,
  quatSlerp,
  transformPoint,
  yawOf,
} from './math3d';
export type { Rng } from './rng';
export { createRng, rngFromState, seedToInt } from './rng';
