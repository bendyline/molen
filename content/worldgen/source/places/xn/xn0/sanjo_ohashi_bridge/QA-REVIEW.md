# Sanjō Ōhashi Bridge — completed medium-fi exterior review

Reviewed 2026-10-09. Q3087620, Kyoto. This clears one of the fixed 213 authored
backlog candidates. Current hashes and inspected image lists are in `qa.json`.

## Source and browser representation

The original 716,504-triangle, 58,571,200-byte master is unchanged. Its editable
restoration study remains in `sanjo-ohashi-model.mjs`; the separate browser recipe
is `sanjo-ohashi-runtime.mjs`. Original geometry and owner research references are
preserved. GLBs remain reproducible build outputs, outside Git.

| Level | Triangles | Bytes | Material draws |
| --- | ---: | ---: | ---: |
| Skyline | 994 | 78,948 | 1 |
| District | 3,996 | 314,696 | 8 |
| Street | 15,704 | 1,170,352 | 8 |
| Closeup | 28,920 | 2,108,492 | 8 |

The initial two levels total **393,644 bytes**. No images are embedded. Seven
central shared graphs supply timber, bronze, steel, stone, concrete, fine paving
and open hemp-leaf railing. New patterns are analytically authored and reusable;
photographs supply evidence only. The 42-node lattice bakes in about 1.6 seconds
on this development machine, versus eight seconds for the discarded first graph.
Runtime textures require Molen's shared-surface resolver.

## Inspected and repaired

Inspected 14 portable master, 14 bounded shared-viewer, 26 medium-fi and eight
current district/closeup real-terrain images. Nine cambered spans, fourteen bronze
finials and eight seven-column frames remain recognizable. Corrected reversed
rail end faces and restored both pink raised curb strips. Repeated paving and
lattice use shared surfaces; far geometry deliberately omits small inner members.
Six Khronos validations have zero errors/warnings; five focused checks pass.

Exact map anchor and signed heading 0.123568417936 radians are preserved. The
bounded fixture compares independently transformed source vertices, not rotated
axis-aligned boxes. Actual bank renders use preserved independent GSI DEM1A 1 m
samples and OSM roads. Both approach connections remain continuous. Unknown
river height cells remain unknown and their triangles are omitted.

## Declared limits

The accepted scope is the stylized present exterior. Inscribed finial text, sword
scars, individual paving joints, concealed structure and fine fabrication counts
are excluded. Support sections, foundation depth and pattern pitch are original
photo reconstructions. The host must supply fine terrain and a consistent
`sampleStructureTerrain` bank reference. Global coarse DEM compatibility,
underwater survey, traversable collision and physical laptop/phone frame rates
are not certified. The maximum-fidelity master is preserved without asserting
that its former pending maximum-fidelity review passed.
