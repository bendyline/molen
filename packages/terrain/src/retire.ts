import type * as THREE from 'three';
import { forgetTerrainGroundCutout } from './ground-cutout';
import { forgetTaggedTerrainObject } from './tagged-objects';
import { forgetTerrainTunnel } from './tunnels';

/**
 * Take everything under `root` out of the lists the terrain keeps of its own objects (ground
 * cuts and the ground they cut, tagged objects, bores), for content that is being disposed.
 *
 * Those lists hold their objects weakly, so that one nobody disposed still goes. But they are
 * walked while the view runs, some of them every frame, and a walk dereferences every entry.
 * What a job has dereferenced the browser keeps until that job ends, and a frame that renders
 * for most of its job has its collections finish inside it: an object dereferenced every frame
 * is then never collected, however dead. One object is enough to keep a whole tile, through its
 * parent. A flight across Osaka kept every tile it evicted, 4.4 GiB of buffers after 150 s
 * with 2 GiB resident, until a collection ran outside a frame. So whoever disposes terrain
 * content says so here; the lists are for what is still in use. The terrain stream does for
 * every tile it evicts and every layer object it drops, and `disposeTerrainSemanticObject` for
 * what it disposes; a host that tags objects or gives them ground openings outside a stream's
 * tiles calls this when it disposes them.
 */
export function retireTerrainObjects(root: THREE.Object3D): void {
  root.traverse((object) => {
    forgetTerrainGroundCutout(object);
    forgetTaggedTerrainObject(object);
    forgetTerrainTunnel(object);
  });
}
