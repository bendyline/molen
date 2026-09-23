# Bundled license texts

License texts for code the capture pages bundle whose npm packages do not ship one.
`scripts/build-capture.mjs` uses a file here when a bundled package has no LICENSE file of its
own, and fails the build when neither exists.

| File | Covers | Source |
| --- | --- | --- |
| `pmtiles.txt` | `pmtiles` (Protomaps LLC, BSD-3-Clause) | [protomaps/PMTiles LICENSE](https://github.com/protomaps/PMTiles/blob/5897a82a16b233abac7b8f339c019b931c2bbf54/LICENSE), unchanged since 2025-01-14, before the 4.3.2 release |
| `basis-universal.txt` | The Basis Universal transcoder three.js ships (Binomial LLC) | The Apache License 2.0 text |
