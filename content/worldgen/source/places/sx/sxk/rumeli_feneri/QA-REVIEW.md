# Rumeli Feneri — current medium-fi exterior review

The original21,710-triangle master is preserved exactly in `buildRumeliMaster`.
The reviewed master fixes inward-facing octagonal plinth, tier/cornice and gallery surfaces.
Its top deck now faces outward at25.045m; the historical master showed the underside at24.95m
from above. The wall envelope, actual deep openings and source dimensions remain unchanged.

## References and geography

The [Coastal Safety Directorate](https://kiyiemniyeti.gov.tr/yer-detay/114/TURKELI-(RUMELI)-FENERI)
describes a30m three-stage masonry tower and58m light elevation. Its coastal, aerial and night
photographs were inspected, including the alternating narrow stair windows, clear lantern,
gallery, four-legged open antenna cage, ladder and red radar array. The modeled radar mast
extends to33.8m as a photograph-derived proportion;58m is not applied to the tower base.

[Mapped tower way1035459712](https://www.openstreetmap.org/way/1035459712) supplies the actual
eight-sided ground polygon. The exact-Q3269761 lighthouse node4472474312 is within one metre
of its bounding-box center, longitude29.11214925/latitude41.23422865. Native+X is east and+Z
south, so heading0 already preserves the real mapped direction. The western landward tomb
doorway is on face7, approximately250° true. Operator aerial/coastal context independently
signs the southern staircase windows against the sea and detached control-tower arrangement.
The map frame retains the actual polygon without stretching the building. Ordinary plinth
and cornice overhangs extend outside the wall footprint. Automatic footprint replacement stays
disabled. Terrain contact and flat footprint fit were inspected; real cliff terrain belongs
to the host terrain provider.

## Browser models and shared textures

| Level | Triangles | Draws | Exterior scope |
| --- | ---: | ---: | --- |
| Skyline |714|1|All three stages, recessed door, gallery, opaque far lantern, open cage/ladder and mast|
| District |3998|7|True narrow openings, clear lantern/optic, sparse ladder cage/rungs and gallery|
| Street |10998|7|Denser circular hardware, optic ribs, ladder and rails|
| Close-up |21710|7|Repaired detailed master exterior|

Skyline plus district totals366,856bytes, below the3MB phone and6MB laptop download budgets.
Five shared256px graphs cover lime plaster, limestone, painted metal, granite and wood.
Recesses and clear lantern/optic glazing use local PBR materials. No GLB embeds images.
The far level uses graph mean colors in one draw. Position and normal uploads use separate
streams; position records are12bytes. Physical laptop/phone timings remain unmeasured.

## Review and verification

All11 portable,11 shared/placement and25 medium-fi light/context/detail/transition images
were visually inspected. Tier ledges and gallery deck are now visible from above, and no solid
box closes the antenna cage or gallery gaps. District preserves its true entrance/window
recesses and clear lantern; ladder/radar details become sparse at far levels. The synthetic
cottage context is a scale/light fixture, not a reconstruction of the village.

Six Khronos validations report zero errors and warnings. Three focused tests verify outward
deck/ledge surfaces, full mast, open cage and recessed doorway at every level; exact original
bytes plus the historical underside-height regression and mapped frame; deterministic four
levels, all triangle/draw/download limits, graph bindings, clear glazing and separate streams.

## Accepted limits

Tier proportions, window allocation, trims, antenna dimensions, optical hardware and radar
extension are photograph-based. Operator-published equipment is represented; completed
restoration replacement equipment is not independently documented. Detached keeper buildings,
front/tomb annexes, mosque, modern control tower and cliff are host/map features outside this
tower model. Exact inscriptions, optic operation and interior tomb are excluded. Reference
photos remain research material and are not embedded or redistributed.
