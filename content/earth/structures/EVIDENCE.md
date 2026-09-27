# Structure evidence and production readiness

The next-1,000 candidate inventory is an authoring queue. It must not be interpreted as 1,000
finished or geographically verified assets. This directory records the evidence needed to
turn each identity into an authored model and a reviewed world-viewer placement.

## Offline inputs

- `evidence/wikidata-details.json` pins English identity labels/descriptions and original
  Wikidata statements for instance class, architectural style, architect, dimensions,
  coordinates, construction/demolition dates, state and parent structures. Statement ranks,
  qualifiers and references remain available. It includes the spare candidate pool.
- `evidence/osm-features.json` pins OSM geometry selected by exact `wikidata` identity.
  Features retain tags, coordinates and source feature IDs. Queries are cached and resumable.
- `identity-review.json` records explicit concerns about current-world use, along with
  suggested physical replacements. **It does not change any candidate's identity.** Historical
  reconstruction, subterranean sites, regional categories and landscapes need their own
  representation. A historical demolition statement alone is insufficient to reject a
  rebuilt church or other surviving replacement.

Wikidata structured facts are [CC0](https://www.wikidata.org/wiki/Wikidata:Licensing).
OpenStreetMap geometry is © OpenStreetMap contributors under
[ODbL 1.0](https://www.openstreetmap.org/copyright). Geometry-derived records retain their
license and attribution. The evidence snapshots are authoring data; the Earth runtime pack
does not include these files and never contacts the public APIs during camera movement.

## Geographic registration

`georeferencing.json` joins candidate identities, facts and exact OSM feature matches. A
minimum-area rectangle measures each available footprint or centerline in local meters.
The longest plan axis is authored +X; headings use Molen's rotation about +Y. Local +Z and
WGS84 north have opposite signs when heading is zero.

This supplies an **undirected map axis**. It does not establish which facade faces which
street, the correct model origin, a vertical height datum, or a completed visual fit.
Point-only data keeps `heading` absent. Distant, very large, obsolete, missing or ambiguous
geometry remains in the review queue. A generic rectangle fit never promotes an entry into
the runtime placement catalog.

`alignments/n0002_pont_de_normandie.json` is a more specific registration study. It uses the
mean endpoints of the two mapped main-span carriageways, so the authored origin lies midway
between pylons, with +X toward the south bank. The asymmetric approach extents are recorded
separately. The operator drawing uses CMH (Cote Marine du Havre).
[Seine-Aval](https://www.seine-aval.fr/glossaire/cote-marine-du-havre/) and the
[DREAL report](https://www.normandie.developpement-durable.gouv.fr/IMG/pdf/TRI_Le_Havre_Rapport_V5_cle0b1356.pdf)
support `IGN69 height = CMH height - 4.378 m`.
[SHOM's historical datum study](https://refmar.shom.fr/dataArchaeology/realisations/port-du-havre)
reports a modern chart-zero value of -4.371 m IGN69, a 7 mm datum-version difference.
The viewer terrain source has no declared IGN69 transform, so conversion to its runtime
height datum and the final in-terrain fit remain unresolved. The geographic catalog records
the measured axis as a draft; it neither renders the model nor replaces mapped roads yet.

## Enforceable readiness ledger

`readiness.json` covers every candidate and reads the actual source GLB, source manifest,
runtime GLB, imported sidecar, project registry, capture files and geographic records. It
verifies current SHA-256 values; stale imports remain visible as blockers.

Images existing on disk are evidence to inspect, not automatic visual approval. A source
folder may add `qa.json` after review:

```json
{
  "sourceHash": "sha256:<current-source-hash>",
  "runtimeHash": "sha256:<current-runtime-hash>",
  "captureReportHash": "sha256:<current-capture-report-hash>",
  "visualReview": { "status": "passed", "inspectedFrames": ["preview.png", "shots/near-detail.png"] },
  "geographicReview": { "status": "passed", "placementHash": "sha256:<current-placement-record-hash>" },
  "fidelityReview": { "target": "maximum", "status": "passed", "notes": "Specific structural details and source comparisons reviewed." }
}
```

The review must describe the inspected views and remaining limitations in the model's README.
The capture report must bind the same source and runtime hashes. Every inspected frame must
exist and match its report hash; edited screenshots or a replacement capture report invalidate
the visual review until inspected again.
`ready` requires all three hash-bound reviews, valid source/import hashes, registry presence,
resolved orientation evidence, no current-world identity exclusion and an active placement.
Maximum-fidelity review is separate from rendering correctly: the reviewer must compare the
modeled structural details against cited references and record remaining omissions. The ledger
preserves `spec.quality`; a provisional visual study does not become maximum fidelity simply
because it has a valid GLB and a screenshot.
The ledger publishes each current placement's hash. Geographic review must bind that hash as
well, so changing the anchor, orientation, datum or replacement behavior invalidates the old
placement review even when the GLB is unchanged.
The original five model studies have images, but lack hash-bound geographic review and remain
incomplete in this ledger. This does not erase their existing source or runtime assets.

## Reproduce

The network refresh is an explicit authoring action, with small sequential cached batches.
The remaining commands are offline and deterministic for the current source files:

```sh
node packages/worldgen-earth/scripts/fetch-structure-evidence.mjs --spares
node packages/worldgen-earth/scripts/fetch-structure-evidence.mjs --osm
node packages/worldgen-earth/scripts/fetch-structure-evidence.mjs --osm-relations
node packages/worldgen-earth/scripts/review-structure-identities.mjs
node packages/worldgen-earth/scripts/derive-structure-georeferencing.mjs
node packages/worldgen-earth/scripts/fit-pont-normandie.mjs
node packages/worldgen-earth/scripts/build-structure-readiness.mjs
node packages/worldgen-earth/scripts/build-structure-readiness.mjs --check
```

`fit-pont-normandie.mjs --register-draft` also updates that bridge's draft catalog record while
preserving every other placement. It refuses to downgrade an active reviewed placement.

Run the readiness generator again after model authoring, import, capture, review or placement
changes. `--check` fails when the checked-in ledger no longer describes the files on disk.
