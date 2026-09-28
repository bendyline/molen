# Bridge terrain fit evidence

These captures use the production `Heightfield`, `buildChunkGeometry`, structure index,
`StructureModelLibrary`, and geographic placement renderer. The terrain is the original
Mapzen Terrarium elevation, with no valley carving, flattening, bridge removal or model fitting.
The display origin is translated for numerical precision; reported elevations remain absolute.
Every report binds its model source, imported GLB, spec, placement, fixture, terrain field and
four PNG frames by SHA-256. Unloading each model releases all of its tracked geometries.

## Preserved Mapzen findings

All 12 frames were inspected. **None of these three placements passes terrain-fit review** with
this terrain source. These are observed exterior placement failures, not approvals of the
models' geographic readiness.

| Candidate | Negative-X approach gap | Positive-X approach gap | Observation |
| --- | ---: | ---: | --- |
| N0011 Mes | 12.72 m | 1.32 m | Western approach floats; the sampled western bank has a large depression absent from independent GLO-30. |
| N0012 Kazarma | 4.41 m | 2.29 m | Deck does not meet either bank; the narrow stream and bridge ground contact are unresolved by this source. |
| N0014 Haghtanak | 22.29 m | 22.96 m | Both approaches float and the source smooths the gorge. Translating to a bank alone would bury the lower arches. |

Gaps are downward ray intersections between the imported model's top centerline surface and
the triangulated terrain, 0.5 m inside the authored ends. Mes follows its bent mapped centerline.
They are precise fixture observations, not centimetre-accurate real-world elevations.

`review.json` binds the inspected reports and images. Plan-view striping was visible in
Kazarma and Haghtanak. A bounded renderer diagnosis found that it persists with isolated model
geometry, untextured lit materials, upward geometric/vertex normals, tighter clip ranges and
logarithmic depth. It disappears with unlit uniform materials. These controls do not establish
coplanar source geometry as the cause. Later source revisions render cleanly in the independent
Copernicus captures below; the original diagnostic images remain preserved. The current
fixture uses logarithmic depth and a near plane proportional to camera distance.
The capture rig deliberately does not conceal the terrain with a flat review plane.

## Independent elevation check

`copernicus-comparison.json` contains unmodified bilinear samples from the original public
Copernicus DSM COGs. The GeoTIFFs declare RasterPixelIsPoint; the first sample lies at the
tiepoint, without a half-pixel offset. The recorded source file hashes permit exact reproduction.

| Site / native station | Mapzen Terrarium | Copernicus |
| --- | ---: | ---: |
| Mes anchor | 47.98 m | 46.00 m, GLO-30 |
| Mes x=-62, z=0 | 42.58 m | 53.40 m, GLO-30 |
| Mes x=+62, z=0 | 53.51 m | 53.53 m, GLO-30 |
| Kazarma anchor | 215.50 m | 209.54 m, GLO-30 |
| Haghtanak anchor | 952.40 m | 953.31 m, GLO-90 |

The Mes bank profile is materially different in the two datasets. GLO-30 supports roughly
equal-height banks, consistent with the authored bridge profile, but does not by itself certify
each approach. The public GLO-30 Yerevan tile returns 404; GLO-90 was used only for comparison
and cannot resolve its steep bank geometry. OSM river samples upstream and downstream remain
recorded, including the two sources' differences. No inferred absolute bridge elevation has
been activated from these comparisons.

Copernicus is a **surface model**, potentially including infrastructure and vegetation, with
EGM2008 heights. Mapzen combines several source datasets; SRTM source heights use EGM96.
No datum conversion was applied to this diagnostic comparison. Dataset spacing does not establish
local vertical accuracy. The comparisons are evidence of source limitations, not interchangeable
survey measurements.

## Independent Copernicus rendering

`copernicus/` preserves a separate unmodified terrain field, current runtime captures and
hash-bound image review for all three sites. All 12 frames were inspected. None passes complete
terrain fit: Mes has much better bank agreement, while its minor openings still intersect the
smoothed ground. No model has been translated or deformed to hide a source-data failure.

| Candidate | Negative-X approach gap | Positive-X approach gap | Remaining mismatch |
| --- | ---: | ---: | --- |
| N0011 Mes, GLO-30 | 0.54 m | -0.53 m | Subsidiary arches and supports partly buried by smoothed valley geometry. |
| N0012 Kazarma, GLO-30 | 2.82 m | 2.47 m | Narrow gully absent; the two road ends remain raised above terrain. |
| N0014 Haghtanak, GLO-90 | 25.05 m | 21.05 m | Coarse gorge and bank profile cannot support the authored crossing. |

The side camera is raised when needed to stay two metres above terrain at its own position.
Reports preserve both its requested and actual pose. That camera adjustment does not change
model geometry, terrain samples or the measured gaps. The latest Kazarma and Haghtanak source
revisions render cleanly in these plan views; the older striping diagnosis below is historical.

The national Albanian ASIG portal advertises a higher resolution LiDAR-derived terrain dataset,
but its documented map/service endpoints were unavailable during this review. No inaccessible
or inferred samples were substituted. A host may use a supported fine DTM in the terrain
archive and the documented `sampleStructureTerrain`/`terrainReference` hook to reference a
bridge to its actual bank. The hook does not reconstruct missing terrain. Existing polygon
cutouts remove ground inside authored openings, but do not create the missing riverbed/banks.

Primary documentation:

- [Mapzen encoding](https://github.com/tilezen/joerd/blob/master/docs/formats.md) and
  [source attribution](https://github.com/tilezen/joerd/blob/master/docs/attribution.md).
- [Copernicus open-data registry](https://registry.opendata.aws/copernicus-dem/) and
  [COG grid documentation](https://copernicus-dem-30m.s3.amazonaws.com/readme.html).
- [Copernicus dataset and vertical reference](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM).
- [Yerevan municipal bridge inventory](https://www.visityerevan.am/places/details/820/en/)
  publishes the 200 m length, 25 m width and 34 m height. This is not an absolute elevation datum.
- OSM approach and waterway traces are attributed to OpenStreetMap contributors (ODbL);
  exact way URLs and native stations are retained with the comparisons.

## Reproduce the runtime fit

From the repository root, after building packages and importing current models:

```sh
node examples/world-explorer/scripts/build-bridge-terrain-evidence.mjs
node examples/world-explorer/test/visual/capture-bridge-terrain.mjs
python examples/world-explorer/scripts/build-copernicus-bridge-evidence.py
node examples/world-explorer/test/visual/capture-bridge-terrain.mjs --terrain-set=copernicus
```

Use `--offline` on the first command to require existing PNGs in `.artifacts/bridge-terrain`.
Both commands accept `--ids=N0011,N0012,N0014`. The capture runner uses the tooling Playwright
browser; set `PLAYWRIGHT_BROWSERS_PATH` if that browser was installed in a repository cache.
Source fields, reports and captures remain excluded from the distributed Earth pack.

## French bridges: independent IGN terrain and road evidence

`ign/` preserves official RGE ALTI terrain samples, original BD TOPO 3D road traces,
production placement captures and a hash-bound image review. The terrain grid is unmodified.
Water values represent modeled water surfaces, not bathymetry. Heights use NGF-IGN69;
hosts using another vertical datum must convert their elevations explicitly.

- **N0026 Pont Aval:** the 26.34 m reference agrees with the independent terrain water
  surface. The motorway approaches remain elevated above the ground. An additional
  `N0026-roads-fit-report.json` renders the independently mapped carriageways through the
  production procedural road renderer. Its covered segments are clipped only after the
  landmark loads; the remaining approaches meet the two authored endpoint elevations.
  BD TOPO road elevations corroborate that context with 2.5 m stated vertical accuracy.
- **N0028 Tolbiac:** the 27.40 m model origin places the road ends at approximately
  35.45/35.56 m, matching independent upper-road samples around 35.4/35.6 m. The terrain
  rays retain 0.62/0.41 m residuals at the interpolated quay edges. The represented water
  reference is 0.45 m above the preserved terrain water surface; that difference is
  disclosed and was not removed by fitting the terrain.
- **N0019 Archevêché:** all eight current terrain/road frames were inspected. The 26.96 m
  origin puts the northern road end at approximately 34.60 m, matching the 34.58–34.60 m
  upper-bank samples. The southern connection retains a roughly 0.4 m local residual.
  The older northern ray hits the smoothed quay face below the road plateau; its 2.62 m
  clearance remains in the report. Exact polygon clipping joins the independent mapped
  approaches while preserving the lower quay road. Submerged footings are reconstructed.

```sh
node examples/world-explorer/scripts/build-ign-bridge-evidence.mjs --ids=N0019,N0026,N0028 --offline
node examples/world-explorer/test/visual/capture-bridge-terrain.mjs --terrain-set=ign --ids=N0026,N0028
node examples/world-explorer/test/visual/capture-bridge-terrain.mjs --terrain-set=ign --ids=N0026 --with-roads
```

Omit `--offline` to fetch missing official responses. Request/response hashes, datum,
attribution, source documentation and actual camera poses are stored with each field/report.
Road-context captures use mapped plan geometry and the normal inferred bridge renderer;
their source 3D ordinates remain independent comparison evidence.

## Japan: bank references and explicit missing river data

`gsi/` preserves current GSI DEM1A laser elevation PNG samples and the exact OSM
carriageway/sidewalk plans for **N0021 Sanjō Ōhashi**. The western road plateau is
41.714 m; aligning native endpoint Y=4.55 m gives an approximately 37.16 m model
origin. The independent eastern plateau is 41.733 m. Current production images
show both approach joins and the separate nine-span landmark.

The 193 × 193 grid retains 6,630 null river cells. The fixture omits triangles and
grid segments touching those cells; its host sampler returns `undefined` for
unknown samples. No coarse fallback or invented riverbed fills the gap. A separate
37 m render-coordinate origin is only a coordinate rebase, not a measured height.
Endpoint ray residuals on the steep bank faces remain in the report and must not
be substituted for upper road-plateau samples. Underwater footing depth remains
a reconstruction. GSI's deprecated TXT tiles are diagnostic cache only; the
current review decodes the PNG service with its documented pixel-center convention.

This extended terrain placement requires a host `sampleStructureTerrain` callback
that consistently resolves the bank coordinate across tiles. Without that callback,
the model remains deferred and procedural roads stay visible. The host must supply
terrain with enough local detail to represent the bank; the reference hook does not
repair a coarse global DEM.

```sh
node examples/world-explorer/scripts/build-gsi-bridge-evidence.mjs
node examples/world-explorer/test/visual/capture-bridge-terrain.mjs --terrain-set=gsi --ids=N0021
node examples/world-explorer/test/visual/capture-bridge-terrain.mjs --terrain-set=gsi --ids=N0021 --with-roads
```

The builder reads the four hashed GSI PNG tiles recorded in `N0021.json` from the
research cache. Their public source URLs and decoding references are preserved there.

## Poland: distinguish the road deck from ground underneath

`gugik/` preserves independent national ground (NMT) and surface (NMPT) evidence for
**N0029 Poniatowski Bridge**, requested explicitly in **PL-EVRF2007-NH**. The ground
field is rendered; the surface field is only a separate measurement reference, so
it cannot create a duplicate bridge inside the terrain. The current 2 m review
grid covers 1,020 m around the bridge. A second surface strip retains approximately
1 m spacing for pier and bank inspection.

The independent road-lane medians are about 95.55 m at the western end and 94.48 m
at the eastern end, with a broad crest near 96.86 m. The center tram corridor is
roughly 0.24 m higher. Ground directly beneath the ends is much lower; treating
those ground heights as the bridge road elevations would bury the structure.
River-facing lower ground beside the bank structures is about 86.1 m west and
86.5 m east, rising toward the approach embankments. All transverse and footprint
samples are retained rather than collapsed into a convenient single height.

The modeled water surface is near 77.17 m in the sampled open channel. This is
neither bathymetry nor a conversion of the historical Warsaw gauge zero. Even the
1 m surface strip cannot isolate narrow pier tips from nearby deck edges reliably,
and under-deck bearings are occluded. The responses do not expose survey epoch or
point-level accuracy. Those limits remain separate from source reconstruction and
must be considered when reviewing final placement.

The current model now uses the measured asymmetric road grade and independently
sampled bank bases. All twelve terrain frames have been inspected, including close
views of both approaches with and without the mapped road network. Geographic QA
remains **pending**: adjacent non-bridge carriageway features are draped on lower
ground instead of meeting the elevated bridge ends. The 8.16/8.03 m clearance over
bare ground is expected, but the visible discontinuous road joins are not. The
next fix must propagate elevation through connected approach topology while
preserving the lower crossing roads; lifting every nearby road would be incorrect.
The exact model polygon already removes covered bridge-tagged road fragments.

```sh
node examples/world-explorer/scripts/build-gugik-bridge-evidence.mjs
node examples/world-explorer/test/visual/capture-bridge-terrain.mjs --terrain-set=gugik --ids=N0029
node examples/world-explorer/test/visual/capture-bridge-terrain.mjs --terrain-set=gugik --ids=N0029 --with-roads
```

The builder reads three hashed ASCII responses from `.artifacts/bridge-terrain/poland`;
their full official WCS request URLs are recorded in the evidence. The parser accepts
both the five-line square-cell header and the rectangular `dx`/`dy` form returned by
GUGiK, honors pixel centers, and preserves no-data without clamping outside the grid.
See [GUGiK's terrain documentation](https://www.geoportal.gov.pl/pl/dane/numeryczny-model-terenu-nmt/)
and [official WCS list](https://www.geoportal.gov.pl/pl/usluga/uslugi-pobierania-wcs/).

### Additional Haghtanak render isolation

A temporary diagnostic transform (without changing the production fixture) compared
FrontSide-only uniform lighting, normal visualization, isolated road geometry and each
additional primitive. The road alone is clean. Only the basalt arch/spandrel primitive
introduces the colored normal stripes; paving, metal, paint and concrete do not.
At diagnostic pixel (679, 500), the camera ray meets the road at native Y=34.0 m,
the underlying basalt cap at Y=33.4000015 m, and the curved arch at about Y=30.4056 m.
Their projected depth values are distinct. The model position buffer stays within
100 m of its origin, its rebased world translation is approximately zero, its materials
are already FrontSide, and both renderer and sun shadows are disabled. Thus the
control does not support a coincident source face, map-coordinate cancellation,
DoubleSide normal inversion, or shadow acne explanation. Subsequent isolated controls
localized the old stripes to multisampling and internal structural slices. Later source
revisions render cleanly in the preserved current Copernicus captures. The uniform
unlit control concealed normal differences and did not itself prove correct depth ordering.
