# Aljaž Tower

![Lit Molen preview](preview.png)

The restored Triglav summit shelter: riveted pale-gray cylindrical shell, eight small viewing windows, closed raised door with hinges and latch, dark conical cap, readable Slovenian plaque, stencil-cut 1895 flag, Y anchors and guy ropes.

## Identity and geometry

Catalog N0602, [Q650987](https://www.wikidata.org/wiki/Q650987). The heritage authority publishes the 1.25 m cylinder diameter, 2 m body and 2.90 m total including the flag support. Its 2025 conservation photographs establish the restored palette, raised door, eight windows, rivet seams, label, stencil flag and anchors. The 2018 intervention preserved all three original Y anchors, original site elevation and rotation. Small fittings and the visible shell/roof proportions are photographic reconstructions.

Cylinder axis at the rock-anchor contact plane. +Z doorway and plaque, approximately south at heading0; exact compass phase is not claimed.; +Y is up. The geographic proposal identifies its anchor and orientation evidence separately from remaining terrain and azimuth uncertainty.

Source facts and measured references are recorded in spec.json. References: [1](https://www.zvkds.si/wp-content/uploads/2024/04/sto_let_net.pdf), [2](https://www.zvkds.si/wp-content/uploads/2024/03/vs_porocila_54_web-1.pdf), [3](https://www.zvkds.si/montaza-triglavske-panorame/), [4](https://planinskivestnik.pzs.si/arhiv/pdf/pv_1895_08.pdf), [5](https://www.openstreetmap.org/way/388344086). Reference pages and images are not redistributed.

## Original source and shared materials

Geometry is authored in `packages/worldgen/scripts/aljaz-tower-model.mjs`. Shared material graphs with metric repeat UV0 and original vertex tints; GLB PBR fallback remains self-contained. No per-model texture duplication. No third-party mesh or photograph is embedded.

23,236 triangles; 48,260 vertices; 2 material groups; 2,018,068 source bytes. Source hash: `sha256:2b9cf37d0cbfe226d43fd2f80e9e0560ed36e6209147c3bbd4dc807766502c39`. Geometry validation checks finite Float32 coordinates, indices, triangle area and winding before export.

Regenerate with `node packages/worldgen/scripts/generate-heritage-towers.mjs N0602`; add `--check` for reproducibility. The generator refuses to overwrite a master whose hash differs from source.json. Import uses `--no-optimize` to preserve facade recesses.

## Remaining detail and review

- Approximate facing and summit fit from the inspected picture and standard viewer PMTiles; no bespoke bearing or exact rock survey. The circular mapped outline fixes location and diameter but cannot establish entrance bearing.
- Original detailed master/hash/recipe preserved; small fittings and closed-door presentation are photographic reconstruction.
- Shared painted-metal graph plus local pane/shadow colors; no embedded image. Natural rock and surrounding mountain are host terrain.
- Four budgeted browser levels retained; interiors/collision and physical-device timings excluded. Footprint replacement remains off.

Named near/far cameras are included for lit visual review. A valid export is not maximum-fidelity certification.
