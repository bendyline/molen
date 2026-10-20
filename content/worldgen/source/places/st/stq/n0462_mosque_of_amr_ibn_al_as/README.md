# Mosque of Amr ibn al-As

![Molen preview](preview.png)

Individual medium-fi Mosque of Amr ibn al-As: current named outer footprint and exact open court, four roofed pointed arcades with pale columns, low exterior arched-window ranges and sparse entrances, stepped merlons, central octagonal ablution pavilion with pale dome/brown canopy and two slender balcony minarets. No generic stand-in; arcade and roof geometry follows this mapped court. Heights, minaret/pavilion positions, bay counts and fine architectural divisions remain explicit estimates. Five existing shared 256² graphs serve six merged roles and four separate browser LODs. Fine inscriptions, historic carving, tap furniture, fence, garden/city and furnished interiors omitted.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Amr_Ibn_Al_As_Mosque_1.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:جامع_عمرو_بن_العاص_Mosque_of_Amr_ibn_al-Aas.jpg)

Five existing shared 256² stucco, continuous limestone, membrane, marble and plain wood graphs serve six merged roles including local opaque blue-grey window fields. Metric UVs, linear colors and zero embedded images. Coarse arcades/pavilion are original geometry; fine inscriptions, screen artwork and reference photographs do not ship.

## Model and axes

23,357 triangles; 70,071 vertices; 6 material groups; 2,806,600 bytes. Native bounds: -68.169, -1.931, -61.569 to 52.003, 31.328, 59.619. Source hash: `sha256:432527162b638420f55a05fcdf15b32797b025f2910c5339490e2771e9603499`.

{"x":"northeast courtyard edge","y":"up","z":"southeast"}

Normal viewer DEM datum 19.715430667931006 m; working floor 1.3278170515619998 m is the median of 160 outside-perimeter samples at 1 m offset plus 0.3 m. 1466 raw outer-footprint samples span -1.5068494137133328..4.113417315506709 m. Adaptive foundation follows the outer outline; paving covers the complete outer cutout including the open court. The roof retains the exact mapped courtyard hole. Preview terrain seats the outer outline and 1.5 m margin. Exact street thresholds, courtyard drains/levels, current paving and surrounding retaining/road joins remain unverified.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=N0462` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- The retained Q683511 reference point [31.233161111,30.010138888] is unchanged. Its older record was reference-only with no resolved facing or footprint. Current Protomaps building 52776559533054 has 12 raw outer vertices and one four-vertex open courtyard, with a same-ID POI named Amr Ibn Al-As / عمرو بن العاص and nearby matching POI 35184400916520. These current named map controls support the identity and approximate fit; no historical exact way ID is invented. Heading 0.8687951695772824 rad aligns the first mapped courtyard edge with positive X, approximately northeast; positive Z is southeast. Exterior facing sense remains a visualization approximation. The raw outer outline and courtyard are retained exactly. Pavilion center is the mean courtyard vertex position; eight columns, canopy/dome, arcade spacing and two estimated northwest-wall minaret centers [-62,-55] / [39,-56] are architectural reconstruction. Surrounding city buildings, gardens, fence, roads and cemetery remain host content.
- No retained or current numeric height or level count exists. Retained width/length statements include 120×120 m and 17×29 m with no common temporal qualifier; preserve them without combining them or forcing the current map to those dimensions. Current mapped outline supplies horizontal scale. Picture-led heights above working floor: paving 1 m; court columns/capitals to 5.2 m, pointed court arches to 8.8 m, spandrels/soffit 9.8–10.3 m, flat roof 10.8 m and selected merlons to 12 m. The octagonal courtyard canopy is about 7.4 m high, pale dome to 13.2 m and finial 14.4 m. Twin minarets are estimated at 30 m overall, with lower shaft to 18 m, projecting balcony around 18–19.3 m, smaller upper stage to 24 m and pale conical cap/finial to 30 m. Detailed dome profile, gallery, exterior openings, tiers, thresholds and all vertical dimensions remain estimates; no surveyed engineering or furnished interior claim.
- Normal viewer DEM datum 19.715430667931006 m; working floor 1.3278170515619998 m is the median of 160 outside-perimeter samples at 1 m offset plus 0.3 m. 1466 raw outer-footprint samples span -1.5068494137133328..4.113417315506709 m. Adaptive foundation follows the outer outline; paving covers the complete outer cutout including the open court. The roof retains the exact mapped courtyard hole. Preview terrain seats the outer outline and 1.5 m margin. Exact street thresholds, courtyard drains/levels, current paving and surrounding retaining/road joins remain unverified.
- Current named polygon/courtyard resolves the older reference-only record without asserting a historical exact way identity. Pavilion/tower positions, bay counts, roof divisions, facades and all heights are estimates. Open court and colonnades are exterior architecture; no furnished-interior or collision/free-walking guarantee. Fine medallions, inscriptions, capitals, gallery lattice, tap furniture, doors/services and current finish/grades omitted. Surrounding fence/gardens/city remain host content. Physical-device timings pending.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.
