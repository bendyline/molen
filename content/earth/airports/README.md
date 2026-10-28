# Airports

`index.json` addresses small, lazily read level-4 geographic cells. The public-domain
OurAirports snapshot contains 10,746 airports and 14,142 open land runways with observed
endpoints and widths. It was imported from the Qualla cache; there is no runtime Qualla
dependency. `provenance.json` records the input digest. Missing endpoints, water runways,
closed runways and invalid dimensions are omitted, never reconstructed from airport centres.

`layouts/kbfi.json` adds Boeing Field's mapped airport boundary, 12 aprons, 73 taxiways/stand
lines and 141 buildings. This separate OpenStreetMap extract is ODbL-1.0, © OpenStreetMap
contributors: https://www.openstreetmap.org/copyright and
https://opendatacommons.org/licenses/odbl/1-0/ . Source IDs, tags and geometry are retained in
`../source/airports/`. The Overpass geometry snapshot is dated 2026-07-24; the aerodrome
boundary was retrieved from https://api.openstreetmap.org/api/0.6/relation/537472/full.json .
It is a visualization dataset, not a navigation database. Building heights and untagged
taxiway widths are interpreted; aircraft traffic is simulated, not live flight tracking.

In the engine repository:

```sh
node packages/earth/scripts/import-airports.mjs ../qualla-internal/_c/airports
node packages/earth/scripts/build-airport-layouts.mjs
```

The second command is offline and reproduces the layout from retained OSM inputs. Airport
data ships in `molen.earth`, outside npm packages. Both Earth hosts enrich the same semantic
tiles before surface workers, buildings, vegetation exclusions and ambient traffic consume them.

The catalog retains OurAirports' small/medium/large classification. Layouts can override the
operating profile (`general-aviation`, `regional`, `airline`, `mixed`); Boeing Field is mixed.
`planAirportApron` chooses flyable types from the entities pack, filters by runway length, and
fits conservative airframe clearance circles inside mapped apron polygons, away from buildings,
taxiways, runways, other aircraft and the layout's reserved `activityZones`. Parking positions
and fleet mix are illustrative, not a record of actual based aircraft or marked parking stands.

`EarthAirportPopulation` admits at most twelve unclaimed aircraft within 1.8 km of the observer.
It uses the host's normal aircraft world; boarding transfers ownership of the same entity and
keeps its original stand empty for that session. New automatic apron population currently has
detailed layout coverage at Boeing Field. Runway-only airport records never invent apron space.
