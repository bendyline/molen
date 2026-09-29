# Archive set (`molen/archive-set@1`)

One tile pyramid split across PMTiles archives: a coarse base plus detail archives partitioned by the tile at a fixed level.

## Example

```json
{
  "format": "molen/archive-set@1",
  "name": "world-features",
  "tileType": "mvt",
  "partitionLevel": 7,
  "base": {
    "url": "base.pmtiles",
    "minLevel": 0,
    "maxLevel": 7
  },
  "archives": [
    {
      "id": "pacific-northwest-01",
      "url": "2026-09/pacific-northwest-01.pmtiles",
      "minLevel": 8,
      "maxLevel": 13,
      "partitions": "2600-2603,2728-2731"
    }
  ]
}
```

## JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "format": {
      "type": "string",
      "const": "molen/archive-set@1",
      "description": "Format envelope; always 'molen/archive-set@1'."
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "description": "Archive set name."
    },
    "tileType": {
      "type": "string",
      "enum": [
        "png",
        "mvt"
      ],
      "description": "Payload type shared by every archive: 'png' (e.g. PNG16 elevation) or 'mvt'."
    },
    "partitionLevel": {
      "type": "integer",
      "minimum": 0,
      "maximum": 10,
      "description": "Level whose tiles partition the detail archives; a detail tile belongs to the archive listing its ancestor at this level."
    },
    "base": {
      "type": "object",
      "properties": {
        "url": {
          "type": "string",
          "minLength": 1,
          "description": "Archive URL, relative to this document or absolute (http/https)."
        },
        "minLevel": {
          "type": "integer",
          "minimum": 0,
          "maximum": 30,
          "description": "Coarsest level the base archive serves."
        },
        "maxLevel": {
          "type": "integer",
          "minimum": 0,
          "maximum": 30,
          "description": "Finest level the base archive serves."
        },
        "bytes": {
          "type": "integer",
          "minimum": 0,
          "maximum": 9007199254740991,
          "description": "Archive size in bytes."
        },
        "sha256": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$",
          "description": "Hex sha256 of the archive."
        }
      },
      "required": [
        "url",
        "minLevel",
        "maxLevel"
      ],
      "additionalProperties": false,
      "description": "Optional coarse archive serving every level up to its maxLevel."
    },
    "archives": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "minLength": 1,
            "description": "Unique archive id, e.g. \"pacific-northwest-02\"."
          },
          "url": {
            "type": "string",
            "minLength": 1,
            "description": "Archive URL, relative to this document or absolute (http/https)."
          },
          "minLevel": {
            "type": "integer",
            "minimum": 0,
            "maximum": 30,
            "description": "Coarsest level the archive serves (at least partitionLevel)."
          },
          "maxLevel": {
            "type": "integer",
            "minimum": 0,
            "maximum": 30,
            "description": "Finest level the archive serves."
          },
          "partitions": {
            "type": "string",
            "pattern": "^(\\d+(-\\d+)?(,\\d+(-\\d+)?)*)?$",
            "description": "Run-length list of partition cells it owns, as indices y * 2^partitionLevel + x (e.g. \"40-44,60\")."
          },
          "bounds": {
            "minItems": 4,
            "maxItems": 4,
            "type": "array",
            "items": {
              "type": "number"
            },
            "description": "Informational [west, south, east, north] in degrees."
          },
          "bytes": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991,
            "description": "Archive size in bytes."
          },
          "sha256": {
            "type": "string",
            "pattern": "^[0-9a-f]{64}$",
            "description": "Hex sha256 of the archive."
          }
        },
        "required": [
          "id",
          "url",
          "minLevel",
          "maxLevel",
          "partitions"
        ],
        "additionalProperties": false
      },
      "description": "Detail archives, each owning a disjoint set of partition cells."
    }
  },
  "required": [
    "format",
    "name",
    "tileType",
    "partitionLevel",
    "archives"
  ],
  "additionalProperties": false
}
```
