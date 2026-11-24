# Great Sphinx of Giza

The model depicts the surviving limestone figure in its enclosure, with long forepaws, a
weathered lion body and tail, the pharaoh's head and nemes, and the small granite Dream Stela.
The face preserves the damaged nose. Stepped cuts across the body follow the bedrock layers,
with shared coursed limestone on the lower repairs and forepaws.

The south elevation and mapped outline establish the major proportions. The reported 75 m
map envelope includes the repaired paw tips. Survey and image controls guide the head, while
individual joints, face relief, and the rim profile are estimates. The model floor uses an
approximate 20 m elevation. The visible site scope keeps the adjacent temples and walks as
separate mapped features. [Site controls](site-controls.json) · [Reference observations](reference-observations.json)

The generator is listed in `asset-build.json`. It writes the editable model as a GLB and the
four runtime levels use the section geometry in `models/sphinx-model.mjs`.

```powershell
node content/worldgen/source/places/st/stq/great_sphinx_of_giza/models/generate-sphinx.mjs
node packages/worldgen/scripts/import-structure-models.mjs --ids=great_sphinx_of_giza
node packages/tooling/scripts/generate-landmark-lods.mjs --ids=great_sphinx_of_giza
```
