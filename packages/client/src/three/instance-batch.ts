import * as THREE from 'three';

/** The geometry attributes a batch's instance matrices are read through, one matrix column each. */
export const INSTANCE_BATCH_MATRIX_COLUMNS: readonly string[] = [
  'instanceMatrix0',
  'instanceMatrix1',
  'instanceMatrix2',
  'instanceMatrix3',
];
/** The geometry attribute a batch's instance colors are read through, when it has colors. */
export const INSTANCE_BATCH_COLOR = 'instanceColor';

/**
 * A batch's instance matrices: one interleaved buffer that WebGL reads as a `mat4` attribute and
 * WebGPU as four `vec4` columns, so either backend uploads it once. It keeps the `version` and
 * `usage` an `InstancedBufferAttribute` reports, which its buffer holds.
 */
export class InstanceMatrixAttribute extends THREE.InterleavedBufferAttribute {
  readonly isInstanceMatrixAttribute = true;
  constructor(buffer: THREE.InstancedInterleavedBuffer) {
    super(buffer, 16, 0);
  }
  get version(): number {
    return this.data.version;
  }
  get usage(): THREE.Usage {
    return this.data.usage;
  }
  setUsage(usage: THREE.Usage): this {
    this.data.setUsage(usage);
    return this;
  }
  get updateRanges(): { start: number; count: number }[] {
    return this.data.updateRanges;
  }
  addUpdateRange(start: number, count: number): void {
    this.data.addUpdateRange(start, count);
  }
  clearUpdateRanges(): void {
    this.data.clearUpdateRanges();
  }
}

const INSTANCED = new Set([...INSTANCE_BATCH_MATRIX_COLUMNS, INSTANCE_BATCH_COLOR]);

const STATE: unique symbol = Symbol('molen.instanceBatch');
/** Marks a batch's own geometry with the model geometry it draws. */
const SOURCE: unique symbol = Symbol('molen.instanceBatch.source');

type BatchGeometry = THREE.InstancedBufferGeometry & { [SOURCE]?: THREE.BufferGeometry };

interface BatchState {
  /** One geometry of the batch's own per model geometry it has drawn; see `geometry`. */
  readonly geometries: Map<THREE.BufferGeometry, BatchGeometry>;
  current: BatchGeometry | undefined;
  matrices: InstanceMatrixAttribute | undefined;
  colors: THREE.InstancedBufferAttribute | null;
  count: number;
  constructed: boolean;
}

type Stateful = { [STATE]?: BatchState };

function stateOf(batch: object): BatchState {
  const owner = batch as Stateful;
  let state = owner[STATE];
  if (state === undefined) {
    state = {
      geometries: new Map(),
      current: undefined,
      matrices: undefined,
      colors: null,
      count: 0,
      constructed: false,
    };
    // Not enumerable: three copies a material's or object's enumerable keys in places.
    Object.defineProperty(owner, STATE, { value: state });
  }
  return state;
}

/**
 * An `InstancedMesh` whose instances live in a geometry of its own, so WebGPU builds its shaders
 * once for every batch of the same material and model layout instead of once per batch.
 *
 * Three's WebGPU renderer keys an instanced mesh's node build by the mesh, since its instance
 * matrices are a node bound to that mesh's buffer: every batch streamed in paid a build of its own,
 * about 10 ms of main thread each, which was most of a flight's streaming work. A batch instead
 * carries its matrices and colors as instanced vertex attributes of an `InstancedBufferGeometry`
 * that shares the model geometry's buffers, and the WebGPU driver reads them by name, the way it
 * reads `position`: one build serves every batch, and each draw binds its own batch's vertex
 * buffers, which a recorded render bundle replays as recorded. WebGL draws it as the
 * `InstancedMesh` it is, with no setup, through three's own instancing.
 *
 * It keeps `InstancedMesh`'s API: `count`, `setMatrixAt`, `setColorAt`, bounds, raycasting and
 * `dispose`. Assigning `geometry` selects the model it draws (a level of detail can swap it each
 * frame without a new build, as long as the models share an attribute layout); `geometry` then reads
 * back as the batch's own geometry and `sourceGeometry` as the model. Set colors before the first
 * draw: a batch drawn without colors keeps its build. Models with morph targets are not supported.
 */
export class InstanceBatch<
  TMaterial extends THREE.Material | THREE.Material[] = THREE.Material | THREE.Material[],
> extends THREE.InstancedMesh<THREE.BufferGeometry, TMaterial> {
  declare readonly isInstanceBatch: true;

  constructor(geometry: THREE.BufferGeometry, material: TMaterial, count: number) {
    super(geometry, material, count);
    stateOf(this).constructed = true;
  }

  /** The model geometry this batch draws (what `geometry` was last set to). */
  get sourceGeometry(): THREE.BufferGeometry {
    return stateOf(this).current?.[SOURCE] as THREE.BufferGeometry;
  }

  /**
   * Draw the instances in `matrices`, sixteen floats each as `Matrix4.elements` lays them out.
   * The batch takes the array over; set `count` to match.
   */
  setInstanceMatrices(matrices: Float32Array): this {
    const buffer = new THREE.InstancedInterleavedBuffer(matrices, 16, 1);
    adoptMatrices(stateOf(this), new InstanceMatrixAttribute(buffer));
    return this;
  }

  /** Every geometry of this batch's own, one per model it has drawn. */
  batchGeometries(): THREE.BufferGeometry[] {
    return [...stateOf(this).geometries.values()];
  }

  override copy(source: InstanceBatch<TMaterial>, recursive?: boolean): this {
    THREE.Mesh.prototype.copy.call(this, source, recursive);
    const state = stateOf(this);
    const from = stateOf(source);
    if (from.matrices !== undefined) {
      const buffer = from.matrices.data as THREE.InstancedInterleavedBuffer;
      const copied = new THREE.InstancedInterleavedBuffer(
        new Float32Array(buffer.array),
        16,
        buffer.meshPerAttribute,
      );
      copied.setUsage(buffer.usage);
      state.matrices = new InstanceMatrixAttribute(copied);
    }
    this.instanceColor =
      from.colors === null ? null : (from.colors.clone() as THREE.InstancedBufferAttribute);
    this.count = from.count;
    for (const geometry of state.geometries.values()) attachInstances(geometry, state);
    this.boundingBox = source.boundingBox?.clone() ?? null;
    this.boundingSphere = source.boundingSphere?.clone() ?? null;
    return this;
  }

  /**
   * Release the batch's buffers. Its own geometries are released with it, but not the model
   * geometry's buffers, which other batches share: a disposed batch is not drawn again.
   */
  override dispose(): this {
    super.dispose();
    for (const geometry of stateOf(this).geometries.values()) {
      const shared = Object.keys(geometry.attributes).filter((name) => !INSTANCED.has(name));
      const kept = { ...geometry.attributes };
      const index = geometry.index;
      // Both renderers free what a geometry holds when it is disposed. Hide the model's buffers
      // while it is, and put them back after, so the geometry stays whole.
      for (const name of shared) geometry.deleteAttribute(name);
      geometry.index = null;
      geometry.dispose();
      geometry.index = index;
      for (const name of shared) geometry.setAttribute(name, kept[name] as THREE.BufferAttribute);
    }
    return this;
  }
}

Object.defineProperty(InstanceBatch.prototype, 'isInstanceBatch', { value: true });

/** Whether `object` is an `InstanceBatch`. */
export function isInstanceBatch(object: unknown): object is InstanceBatch {
  return (object as { isInstanceBatch?: unknown } | null)?.isInstanceBatch === true;
}

/** Whether `geometry` is one of an `InstanceBatch`'s own geometries. */
export function isInstanceBatchGeometry(geometry: THREE.BufferGeometry): boolean {
  return (geometry as BatchGeometry)[SOURCE] !== undefined;
}

function attachInstances(geometry: BatchGeometry, state: BatchState): void {
  const matrices = state.matrices;
  if (matrices !== undefined) {
    INSTANCE_BATCH_MATRIX_COLUMNS.forEach((name, column) => {
      const existing = geometry.getAttribute(name) as THREE.InterleavedBufferAttribute | undefined;
      if (existing?.data !== matrices.data)
        geometry.setAttribute(
          name,
          new THREE.InterleavedBufferAttribute(matrices.data, 4, column * 4),
        );
    });
  }
  if (state.colors === null) geometry.deleteAttribute(INSTANCE_BATCH_COLOR);
  else if (geometry.getAttribute(INSTANCE_BATCH_COLOR) !== state.colors)
    geometry.setAttribute(INSTANCE_BATCH_COLOR, state.colors);
  geometry.instanceCount = state.count;
}

function batchGeometry(state: BatchState, source: THREE.BufferGeometry): BatchGeometry {
  let geometry = state.geometries.get(source);
  if (geometry !== undefined) return geometry;
  if ((source as THREE.InstancedBufferGeometry).isInstancedBufferGeometry === true)
    throw new Error('An InstanceBatch draws a plain model geometry; its instances are its own');
  if (Object.keys(source.morphAttributes).length > 0)
    throw new Error('An InstanceBatch cannot draw a model with morph targets');
  geometry = new THREE.InstancedBufferGeometry() as BatchGeometry;
  geometry.name = source.name;
  geometry.index = source.index;
  for (const [name, attribute] of Object.entries(source.attributes))
    geometry.setAttribute(name, attribute);
  for (const group of source.groups)
    geometry.addGroup(group.start, group.count, group.materialIndex);
  // Shared, so a range or bounds set on the model reach every batch drawing it.
  geometry.drawRange = source.drawRange;
  geometry.boundingBox = source.boundingBox;
  geometry.boundingSphere = source.boundingSphere;
  geometry.userData = source.userData;
  geometry[SOURCE] = source;
  attachInstances(geometry, state);
  state.geometries.set(source, geometry);
  return geometry;
}

function adoptMatrices(
  state: BatchState,
  value: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
): void {
  if ((value as InstanceMatrixAttribute).isInstanceMatrixAttribute === true) {
    state.matrices = value as InstanceMatrixAttribute;
  } else if (!state.constructed && value.itemSize === 16) {
    // InstancedMesh's constructor allocates a plain attribute; the batch takes over its array.
    const buffer = new THREE.InstancedInterleavedBuffer(value.array as Float32Array, 16, 1);
    state.matrices = new InstanceMatrixAttribute(buffer);
  } else {
    throw new Error(
      "An InstanceBatch's instanceMatrix is its own or another batch's (to share instances)",
    );
  }
  for (const geometry of state.geometries.values()) attachInstances(geometry, state);
}

// Accessors over InstancedMesh's fields, which its constructor assigns (the state is created by
// the first of them). TypeScript forbids declaring an accessor over an inherited field.
Object.defineProperties(InstanceBatch.prototype, {
  geometry: {
    get(this: InstanceBatch): THREE.BufferGeometry | undefined {
      return stateOf(this).current;
    },
    set(this: InstanceBatch, value: THREE.BufferGeometry) {
      const state = stateOf(this);
      const own = value as BatchGeometry;
      const source = own[SOURCE] ?? value;
      state.current = batchGeometry(state, source);
    },
  },
  instanceMatrix: {
    get(this: InstanceBatch): InstanceMatrixAttribute | undefined {
      return stateOf(this).matrices;
    },
    set(this: InstanceBatch, value: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) {
      adoptMatrices(stateOf(this), value);
    },
  },
  instanceColor: {
    get(this: InstanceBatch): THREE.InstancedBufferAttribute | null {
      return stateOf(this).colors;
    },
    set(this: InstanceBatch, value: THREE.InstancedBufferAttribute | null) {
      const state = stateOf(this);
      state.colors = value;
      for (const geometry of state.geometries.values()) attachInstances(geometry, state);
    },
  },
  count: {
    get(this: InstanceBatch): number {
      return stateOf(this).count;
    },
    set(this: InstanceBatch, value: number) {
      const state = stateOf(this);
      state.count = value;
      for (const geometry of state.geometries.values()) geometry.instanceCount = value;
    },
  },
});
