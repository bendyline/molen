import { ambientVehicleKind } from '@bendyline/molen-ambient/client';
import type { CameraPose, TopDownOrtho } from '@bendyline/molen-client';
import { createSnapshotViewer } from '@bendyline/molen-client';
import { figureKind } from '@bendyline/molen-figures/client';
import type { Keyframe, SceneCamera } from '@bendyline/molen-schema';
import { createTerrainObject } from '@bendyline/molen-terrain/client';
import { heightfieldFromPng, type TerrainDescriptor } from '@bendyline/molen-terrain/kernel';
import { Box3, Sphere, Vector3 } from 'three';

// Browser-side capture harness. Bundled (with three.js) by scripts/build-capture.mjs into
// dist/capture/harness.js and loaded by capture.html. Playwright calls window.__molenCapture
// with a serialized keyframe (+ optional terrain); we boot a snapshot viewer (no live kernel),
// render exactly one deterministic frame, and return the render stats block.

interface TerrainPayload {
  descriptor: TerrainDescriptor;
  /** base64-encoded 16-bit grayscale heightmap PNG. */
  heightmapB64: string;
  cameraPos?: [number, number, number];
}

interface CaptureRequest {
  keyframe: Keyframe;
  sceneCamera?: SceneCamera;
  /** Perspective pose; null/undefined = keep the default (or use `ortho`). */
  camera?: CameraPose | null;
  /** Top-down orthographic framing (the scene's `top-down-ortho` camera mode). */
  ortho?: TopDownOrtho | null;
  size: [number, number];
  terrain?: TerrainPayload;
  clearColor?: string;
  reflections?: boolean;
  antialias?: boolean;
  fitShadows?: boolean;
  /** Base URL gltf asset refs resolve against (the capture server's /files/ mount). */
  assetsBaseUrl?: string;
  /** Asset id -> URL (relative to assetsBaseUrl), from the project manifest. */
  assetsIndex?: Record<string, string>;
}

interface CaptureStats {
  entitiesRendered: number;
  drawCalls: number;
  triangles: number;
}

declare global {
  interface Window {
    __molenCapture(req: CaptureRequest): Promise<CaptureStats>;
  }
}

// Reused across frames in a sequence (export_frames) so we don't leak a WebGL context per frame.
let prevViewer: { dispose(): void } | undefined;

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

window.__molenCapture = async (req: CaptureRequest): Promise<CaptureStats> => {
  if (prevViewer !== undefined) {
    prevViewer.dispose();
    prevViewer = undefined;
  }
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  canvas.style.width = `${req.size[0]}px`;
  canvas.style.height = `${req.size[1]}px`;
  const viewer = await createSnapshotViewer(req.keyframe, {
    // Pinned, never probed: a golden frame has to be reproducible, and which backend a runner
    // happens to offer is exactly the kind of thing that must not change the pixels.
    backend: 'webgl',
    canvas,
    sceneCamera: req.camera == null && req.ortho == null ? req.sceneCamera : undefined,
    width: req.size[0],
    height: req.size[1],
    pixelRatio: 1,
    antialias: req.antialias ?? false,
    reflections: req.reflections ?? false,
    clearColor: req.clearColor ?? '#11131a',
    kinds: [figureKind(), ambientVehicleKind()],
    ...(req.assetsBaseUrl != null
      ? {
          assets: {
            baseUrl: new URL(req.assetsBaseUrl, location.href).href,
            ...(req.assetsIndex != null ? { index: req.assetsIndex } : {}),
          },
          // The Basis transcoder is served next to the harness (scripts/build-capture.mjs copies
          // it from three), so packed KTX2 variants render in every capture op. It only loads
          // when a KTX2 texture is actually encountered.
          decoders: { ktx2TranscoderPath: new URL('./basis/', location.href).href },
        }
      : {}),
  });
  if (req.camera != null) viewer.setCamera(req.camera);
  else if (req.ortho != null) viewer.renderer.setTopDownOrtho(req.ortho);

  if (req.terrain != null) {
    const hf = heightfieldFromPng(req.terrain.descriptor, base64ToBytes(req.terrain.heightmapB64));
    const group = createTerrainObject(hf, req.terrain.descriptor, {
      ...(req.terrain.cameraPos !== undefined ? { cameraPos: req.terrain.cameraPos } : {}),
    });
    viewer.renderer.worldRoot.add(group);
  }

  // Async barrier: gltf instances swap in before the single deterministic frame; clip poses
  // derive from the keyframe tick inside renderFrame.
  await viewer.ready();
  // A long bridge's auto-framed camera can sit beyond the normal 5 km clip plane.
  // Fit clipping only after asynchronous models have supplied their actual bounds.
  const worldBounds = new Box3().setFromObject(viewer.renderer.worldRoot);
  if (!worldBounds.isEmpty()) {
    const sphere = worldBounds.getBoundingSphere(new Sphere());
    if (req.fitShadows && Number.isFinite(sphere.radius) && sphere.radius > 0)
      viewer.renderer.setShadowFocus({
        center: sphere.center.toArray(),
        radius: sphere.radius,
      });
    const camera = viewer.renderer.camera;
    const far = camera.position.distanceTo(sphere.center) + sphere.radius + 1;
    const forward = camera.getWorldDirection(new Vector3());
    let nearestDepth = Infinity;
    for (const x of [worldBounds.min.x, worldBounds.max.x])
      for (const y of [worldBounds.min.y, worldBounds.max.y])
        for (const z of [worldBounds.min.z, worldBounds.max.z])
          nearestDepth = Math.min(
            nearestDepth,
            new Vector3(x, y, z).sub(camera.position).dot(forward),
          );
    // A 0.1m near plane loses centimetre masonry/ironwork separation hundreds of
    // metres away. Move it only when the entire scene lies well ahead; retain a
    // fifty-fold safety margin and preserve close/interior captures unchanged.
    const near = nearestDepth > 100 ? Math.max(camera.near, nearestDepth / 50) : camera.near;
    if (Number.isFinite(far) && Number.isFinite(near))
      viewer.renderer.setCameraClip(near, Math.max(camera.far, far));
  }
  viewer.renderFrame();
  const stats = viewer.renderer.stats();
  prevViewer = viewer;
  return {
    entitiesRendered: viewer.objectCount(),
    drawCalls: stats.drawCalls,
    triangles: stats.triangles,
  };
};
