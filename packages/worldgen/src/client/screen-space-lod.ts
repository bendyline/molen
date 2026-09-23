import * as THREE from 'three';

/** Shared mutable rendering policy. Mutations affect resident LODs without regenerating geometry. */
export interface ScreenSpaceLodPolicy {
  /** Actual drawing-buffer height, not CSS height. */
  viewportHeight: number;
  /** Maximum projected geometric/detail error, in rendered pixels. */
  maxPixelError: number;
}

/** Screen-space error with conservative bounds and 15% hysteresis. No GPU readbacks. */
export class ScreenSpaceLod extends THREE.LOD {
  private readonly errors: number[] = [];
  private selectedLevel = 0;
  constructor(
    readonly policy: ScreenSpaceLodPolicy,
    readonly radius: number,
  ) {
    super();
  }

  addDetail(object: THREE.Object3D, errorMeters: number): this {
    if (
      !Number.isFinite(errorMeters) ||
      errorMeters < 0 ||
      (this.errors.length > 0 && errorMeters <= (this.errors[this.errors.length - 1] as number))
    )
      throw new Error('LOD errors must be finite, nonnegative and strictly increasing');
    this.errors.push(errorMeters);
    this.addLevel(object, this.errors.length === 1 ? 0 : errorMeters, 0.15);
    object.visible = this.errors.length === 1;
    return this;
  }

  override getCurrentLevel(): number {
    return this.selectedLevel;
  }

  override update(camera: THREE.Camera): void {
    const scale = this.matrixWorld.getMaxScaleOnAxis();
    const height = Math.max(1, this.policy.viewportHeight);
    const error = Math.max(0.1, this.policy.maxPixelError);
    const perspective = camera as THREE.PerspectiveCamera;
    if (perspective.isPerspectiveCamera) {
      const focal = height / (2 * Math.tan((perspective.fov * Math.PI) / 360));
      for (let i = 1; i < this.levels.length; i++) {
        const level = this.levels[i];
        if (level)
          level.distance =
            scale * (this.radius / perspective.zoom + ((this.errors[i] as number) * focal) / error);
      }
      // THREE.LOD divides camera distance by zoom. Compensating the bounds term preserves
      // the near region while geometric error naturally follows magnification.
      super.update(camera);
      this.selectedLevel = super.getCurrentLevel();
      return;
    }
    const ortho = camera as THREE.OrthographicCamera;
    if (!ortho.isOrthographicCamera) {
      super.update(camera);
      return;
    }
    const pixelsPerMeter = (height * ortho.zoom) / Math.max(0.001, ortho.top - ortho.bottom);
    let selected = 0;
    for (let i = 1; i < this.levels.length; i++) {
      const level = this.levels[i];
      const threshold = level?.object.visible ? error * 1.15 : error;
      if ((this.errors[i] as number) * scale * pixelsPerMeter <= threshold) selected = i;
    }
    this.selectedLevel = selected;
    this.levels.forEach((level, i) => {
      level.object.visible = i === selected;
    });
  }
}
