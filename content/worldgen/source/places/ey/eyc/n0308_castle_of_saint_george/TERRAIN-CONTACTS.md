# São Jorge terrain contact diagnostic

This diagnostic compares the unchanged original exterior with the separate, coarse research hill.
It explains apparent missing sections in the terrain preview; it does not establish surveyed
ground heights or approve placement. Positive clearance is a floating base; negative clearance
is terrain above a modeled floor/base. Aperture-covered means ground reaches the opening crown
at that centreline sample, not that the entire opening area has been measured.

Input: `sha256:51b6e1ec221511954c86c91a9fc02c84ac22e47bff366d994101b6e83071f4c3`  
Runtime: `sha256:c34df7f651b658cc59525c6c1968ba1dc645487711c57eb9e87cc10ab581a2d0`  
Terrain: [qa-terrain.json](qa-terrain.json), [relief-grid.json](relief-grid.json).

## Sample results

113 probes: 1 near contact, 54 embedded,
56 floating and 2 at or above an aperture crown.
Values are interpolated from the 25 m research grid, rounded to millimetres for repeatability;
that rounding is not measurement accuracy. No terrain grading or model offsets were applied.

| Part | Sample | Model Y (m) | Hill Y (m) | Clearance (m) | Result |
| --- | --- | ---: | ---: | ---: | --- |
| gateway-main | mouth-a | 25 | 27.857 | -2.857 | embedded |
| gateway-main | centre | 25 | 29.241 | -4.241 | embedded |
| gateway-main | mouth-b | 25 | 29.731 | -4.731 | embedded |
| gateway-barbican-south | mouth-a | 25 | 29.698 | -4.698 | embedded |
| gateway-barbican-south | centre | 25 | 29.874 | -4.874 | aperture-covered |
| gateway-barbican-south | mouth-b | 25 | 30.043 | -5.043 | aperture-covered |
| gateway-east | mouth-a | 25 | 27.088 | -2.088 | embedded |
| gateway-east | centre | 25 | 27.35 | -2.35 | embedded |
| gateway-east | mouth-b | 25 | 27.134 | -2.134 | embedded |
| gateway-barbican-east | mouth-a | 25 | 27.203 | -2.203 | embedded |
| gateway-barbican-east | centre | 25 | 27.093 | -2.093 | embedded |
| gateway-barbican-east | mouth-b | 25 | 26.982 | -1.982 | embedded |
| gateway-divider-south | mouth-a | 25 | 26.625 | -1.625 | embedded |
| gateway-divider-south | centre | 25 | 26.998 | -1.998 | embedded |
| gateway-divider-south | mouth-b | 25 | 27.37 | -2.37 | embedded |
| gateway-divider-north | mouth-a | 25 | 19.836 | 5.164 | floating |
| gateway-divider-north | centre | 25 | 20.244 | 4.756 | floating |
| gateway-divider-north | mouth-b | 25 | 20.653 | 4.347 | floating |
| gateway-betrayal | mouth-a | 25 | 13.791 | 11.209 | floating |
| gateway-betrayal | centre | 25 | 14.855 | 10.145 | floating |
| gateway-betrayal | mouth-b | 25 | 15.919 | 9.081 | floating |
| museum | corner-1 | 25 | 23.791 | 1.209 | floating |
| museum | corner-2 | 25 | 25.771 | -0.771 | embedded |
| museum | corner-3 | 25 | 25.162 | -0.162 | embedded |
| museum | corner-4 | 25 | 24.606 | 0.394 | floating |
| museum | corner-5 | 25 | 24.2 | 0.8 | floating |
| museum | corner-6 | 25 | 25.647 | -0.647 | embedded |
| museum | corner-7 | 25 | 16.684 | 8.316 | floating |
| museum | corner-8 | 25 | 14.871 | 10.129 | floating |
| museum | corner-9 | 25 | 10.91 | 14.09 | floating |
| museum | corner-10 | 25 | 8.903 | 16.097 | floating |
| museum | corner-11 | 25 | 13.505 | 11.495 | floating |
| museum | corner-12 | 25 | 21.05 | 3.95 | floating |
| museum | corner-13 | 25 | 21.283 | 3.717 | floating |
| museum | corner-14 | 25 | 21.688 | 3.312 | floating |
| museum | corner-15 | 25 | 22.182 | 2.818 | floating |
| museum | corner-16 | 25 | 22.463 | 2.537 | floating |

## Required corrections before activation

- Obtain ground controls for the castle courts, entrance bridge/moat and museum terrace.
- Reconcile those controls with a common vertical datum. The historical observatory altitude
  and public viewer's rounded position result are not accepted as bare-earth controls.
- Author the actual terrace/foundation sections where justified by those controls; inspect the
  entrance, both courts, northern towers and museum again with terrain visible.
- Keep placement draft and footprint replacement disabled until these contacts are resolved.

The gates and museum roof remain present in isolated shared-surface captures. This is a terrain
contact failure in the current preview, not evidence that those meshes were deleted.
Full probe coordinates and hash bindings are stored in `qa.json.terrainContactReview`.
