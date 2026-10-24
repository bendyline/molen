# Rodsher Lighthouse — current medium-fi exterior review

The isolated source reproduces the original 38,480-triangle component master exactly.
The RGO/Fertoing/People of the Sea survey supplies dimensional reference, with fresh geometry
and shared procedural materials rather than copied survey triangles or photographic atlases.

## Identity, position and bearing

The [official project](https://rgo.ru/activity/project-list/mayak-rodsher/) supplies
longitude26.679760, latitude59.968681. This is the tower coordinate, replacing the older island
catalog anchor. Its20m figure is light elevation above the sea, not tower-base height.
The survey-controlled vane reaches20.45m above the authored footing; host terrain supplies
the ground datum.

The former assertion that the panel wall faces south was unsupported and has been removed
from the model brief. The official main photograph is taken from a long keeper-house roof
west of the lighthouse. The northwest hipped house appears to the left, corroborating the
viewpoint against [western](https://www.openstreetmap.org/way/328852190) and
[northwestern](https://www.openstreetmap.org/way/328852189) mapped buildings. This signs the
panel wall approximately west and the opposite door approximately east. The viewer yaw is
−π/2; estimated bearing uncertainty is±22.5°. **This is photo/context inference**, not surveyed
north or a GPS/EXIF compass measurement. The official embedded map and OSM differ in detached
building coverage; they are not used as precise survey control.

The local map frame explicitly labels the octagonal footing as a dimensional survey
reconstruction and detached keeper-house outlines as context only. The houses are not modeled
or claimed to fit the tower. Automatic footprint replacement remains disabled. Flat terrain
contact and the signed reconstructed frame were inspected; the island's natural shore and
actual tide/elevation require host terrain/water data.

## Browser levels and materials

| Level | Triangles | Draws | Scope |
| --- | ---: | ---: | --- |
| Skyline |944|1|Full tower, door recess, four panels, open gallery gaps and vane; opaque far lantern|
| District |3948|6|True arched openings, clear lantern/optic, reduced mesh wires and hardware|
| Street |15584|6|Denser rails, wire, panel grid, ribs and circular subdivisions|
| Close-up |38480|6|Original detailed exterior|

Skyline plus district downloads total384,712bytes, below the3MB phone and6MB laptop targets.
Near levels bind shared256px lime plaster, painted metal, plain wood and plain concrete graphs.
Opaque recesses/panels and transparent lantern glazing remain local PBR materials. No images
are embedded in any GLB. The skyline uses shared mean colors in a single draw. Vertex streams
are separately packed, with12-byte position records. Physical phone/laptop timings remain
unmeasured.

## Inspected evidence and checks

All11 portable,11 shared/placement and25 medium-fi frames were visually inspected. The two
galleries, full vane, four panel bodies, deep doorway/windows, interior optic and transparent
lantern remain complete. The district panel-cell grid is omitted; the street dome is visibly
faceted in a close inspection, consistent with that level's limited detail. Transitions retain
the whole tower. Procedural neighboring cottages are a synthetic scale/light fixture.

Six Khronos validations report zero errors and warnings. Three focused tests verify recessed
openings, open decks, panels and tip at all four levels; exact master bytes and explicit map
uncertainty; deterministic derivative hashes, all geometry/draw/download caps, graph bindings
and separate GPU streams.

## Accepted reconstruction limits

Relative dimensions follow the published survey, with its small tilt and arbitrary raw
offset removed. Precise compass azimuth, exact present paint/weathering, photovoltaic operation,
maintenance hardware and interiors are not certified. Detached ruined houses, rocks, birds and
tide are outside this tower model. CC BY3.0 reference attribution is retained; source meshes
and photographs are research references only.
