# Monnow Bridge: independent terrain and approach review

The current bridge uses the original Welsh Government **1 m DTM and DSM**, survey tile
SO5012 dated **2021-02-27**. The `20220112` date in the TIFF filenames is a delivery label.
Source URLs and hashes, the OSTN15 grid hash, transform description and original sample
heights are recorded in the JSON evidence. The DTM is rendered without terrain edits.

The DSM constrains the broad road crown and the two approach slopes. Occluded gatehouse
stations are excluded from the road fit. A separate roof-slope fit estimates the unsampled
ridge near source height 29.94 m. Fit residuals and serialized decimal places do not establish
survey accuracy. Filtered river elevations are not bathymetry. The TIFF declares British
National Grid horizontally but no explicit vertical CRS; placement transfers the native
origin through a dry-bank terrain reference instead of assuming an absolute vertical datum.

The approach retaining walls follow OpenStreetMap ways 172233193, 172233195 and 855452310.
Their geometry and sampled road heights are preserved in the source bundle's
`site-approaches.json`. Editable recipes build the bridge and bounded approach sections from
these committed inputs. The GLB build needs neither Python nor remote elevation services.
Surrounding buildings, remote riverbank paths and the western retaining wall continuation
remain host map content. Unmapped pavement edges, wall thickness and individual masonry
are reconstructed.

All **12 current terrain frames** were inspected, six with mapped roads and six without.
The source QA also binds 13 portable and 12 shared-material frames. Both approach joins are
continuous and the former extra procedural span is gone. Native end probes at X=-23.8/+22.8
show about **0.05/0.16 m** between the authored surface and triangulated DTM. Intermediate
probes measure bridge clearance rather than a road-join gap. These are fixture observations,
not measured real-world centimetre accuracy. Loading and geometry disposal pass.

The optional `replaceRoads.includeConnectedApproaches` clips only outward ground roads
sharing a covered bridge endpoint. Unrelated paths, transverse crossings and tunnels remain.
Hosts must preserve those endpoints and supply a consistent cross-tile terrain sampler for
the bank reference. A coarse elevation archive cannot reproduce this 1 m terrain review.

## Reproduction

Cache the official TIFFs and OSTN15 grid at the paths recorded in `N0015.json`, plus the
recorded OSM map response and survey catalogue. The research builder requires Pillow,
NumPy and pyproj 3.7.2 and refuses a fallback coordinate transform without OSTN15:

```sh
python examples/world-explorer/scripts/build-welsh-bridge-evidence.py
node packages/worldgen/scripts/generate-researched-bridges.mjs --ids=N0015 --check
node examples/world-explorer/test/visual/capture-bridge-terrain.mjs --terrain-set=wales --ids=N0015
node examples/world-explorer/test/visual/capture-bridge-terrain.mjs --terrain-set=wales --ids=N0015 --with-roads
```

Capture reports bind the source, runtime, spec, fixture, terrain, placement and each image.
Capturing alone leaves a report awaiting review; the source bundle's current-hash `qa.json`
records the inspected frames and approval scope.

Sources: [Welsh Government LiDAR downloads](https://datamap.gov.wales/maps/lidar-data-download/),
[survey tile catalogue](https://datamap.gov.wales/layers/geonode%3Awelsh_government_lidar_tile_catalogue_2020_2023),
[Ordnance Survey OSTN15 documentation](https://docs.os.uk/more-than-maps/a-guide-to-coordinate-systems-in-great-britain/from-one-coordinate-system-to-another-geodetic-transformations/national-grid-transformation-ostn15-etrs89-osgb36).
LiDAR attribution: Welsh Government, Open Government Licence. Map attribution:
© OpenStreetMap contributors, ODbL-1.0. Reference photographs are not redistributed here.
