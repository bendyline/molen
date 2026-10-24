# Saint Sophia Cathedral

![Molen preview](preview.png)

Current Selimiye Mosque, Nicosia (former Saint Sophia Cathedral): twin minarets/single balconies, asymmetric northern square bay and southern round base, three recessed Gothic porch arches, pale pointed fretwork screen, low vaulted nave/aisles, small gable crests/flying buttresses and mapped polygonal east/annex envelope.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Nicosia_01-2017_img20_View_from_Shacolas_Tower.jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Selimiye_Mosque_(St._Sophie_Cathedral)_(36).JPG)
- [Reference](https://commons.wikimedia.org/wiki/File:Lefkoşa_Selimiye-Moschee_(Sophienkathedrale)_Fassade_3.jpg)
- [Reference](https://cyprus-mail.com/2025/06/08/central-nicosia-mosque-returns-to-service)

Five existing shared256-square sandstone/raw-stone/standing-seam/wood/plaster graphs, metric UVs and linear tints; flat blue-gray glass. No embedded images or copied photograph textures.

## Model and axes

6,195 triangles; 18,585 vertices; 8 material groups; 748,140 bytes. Native bounds: -42.600, -0.566, -21.095 to 39.692, 64.700, 20.873. Source hash: `sha256:298018780d92e5413170d1e46bb21020e682fd60169da0b7440c0d006faa74ec`.

{"x":"east along nave from Gothic west porch","y":"up","z":"south across nave"}

Current Selimiye Mosque exterior from useful pictures and standard viewer PMTiles/DEM. NativeY0 follows148.685587m standardDEM; estimated floor0.7m clears coarse perimeter-0.22..0.31m. Main/minaret heights, porch/annex roles, foundation/plaza/step joins remain approximate; no surveyed thresholds or certified walking surfaces.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=saint_sophia_cathedral` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- No retained published height facts or PMTiles tower/roof parts. Current parent height11m is a generic building/three-level value and conflicts with the pictured cathedral/minarets; it is not treated as an architectural measurement. Main23m eave/25m low vault,13m aisle,18.5m porch,26m square west tower,10.5/11.5m annexes,64m minaret tips and all balcony/radius splits are picture-led estimates, not surveyed heights. Whole mapped79x41m envelope controls horizontal scale; component positions are approximate reconstructions within it.
- Current Selimiye Mosque exterior from useful pictures and standard viewer PMTiles/DEM. NativeY0 follows148.685587m standardDEM; estimated floor0.7m clears coarse perimeter-0.22..0.31m. Main/minaret heights, porch/annex roles, foundation/plaza/step joins remain approximate; no surveyed thresholds or certified walking surfaces.
- Current Selimiye mosque exterior is represented under its stable former-cathedral candidate ID. Screen rosettes,lancets,portal hoods and balcony profiles are selected approximations; no exact fretwork,sculpture,flags,loudspeakers,finials/crescents,full interiors,market stalls or neighboring buildings. Roof subdivision and annex functions remain unverified. Closed recessed doors and open porch cuts do not certify walking surfaces. Physical laptop/phone timing pending.
- Skyline uses closed porch masses,mean-tinted materials and coarser minaret/vault facets. District restores actual porch arches,shared textures and balcony outlines; street restores flying arches,small gables and selected screen pattern; closeup refines shafts,vault/arch facets,balcony bars and rosette spokes. Detail/profile changes remain visible.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.
