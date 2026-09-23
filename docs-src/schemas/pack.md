# Content pack manifest (`molen/pack@1`)

Manifest inside a content pack: a zip file carrying models, documents and catalogs outside the code packages. It lists every logical file with its size and hash, the asset ids it provides, and the roles (types, stylepack, stars, ...) its files fill.

## Example

```json
{
  "format": "molen/pack@1",
  "id": "example.vehicles",
  "version": "1.0.0",
  "license": "CC0-1.0",
  "notice": "NOTICE.md",
  "contentHash": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
  "provides": {
    "types": [
      "types/vehicles.types.json"
    ]
  },
  "ids": {
    "example.vehicle.roadster": "models/roadster/model.glb"
  },
  "blocks": {
    "types": {
      "entry": "molen-pack/blocks/types.blk",
      "size": 2400
    }
  },
  "entries": {
    "NOTICE.md": {
      "size": 180,
      "sha256": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      "mediaType": "text/markdown"
    },
    "models/roadster/model.glb": {
      "size": 88120,
      "sha256": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      "mediaType": "model/gltf-binary"
    },
    "types/vehicles.types.json": {
      "size": 2400,
      "sha256": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      "mediaType": "application/json",
      "block": "types",
      "offset": 0
    }
  }
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
      "const": "molen/pack@1",
      "description": "Format envelope; always 'molen/pack@1'."
    },
    "id": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)*$",
      "description": "Stable pack id, e.g. molen.entities."
    },
    "version": {
      "type": "string",
      "minLength": 1,
      "description": "Pack version."
    },
    "title": {
      "type": "string",
      "minLength": 1,
      "description": "Human-readable pack name."
    },
    "license": {
      "type": "string",
      "minLength": 1,
      "description": "SPDX expression for the pack's content."
    },
    "notice": {
      "type": "string",
      "minLength": 1,
      "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.?(?:\\/|$)).+$",
      "description": "Entry that carries the attribution notice."
    },
    "contentHash": {
      "type": "string",
      "pattern": "^sha256:[0-9a-f]{64}$",
      "description": "sha256 over every logical file (path and content), independent of the zip layout."
    },
    "provides": {
      "default": {},
      "type": "object",
      "propertyNames": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9-]*$"
      },
      "additionalProperties": {
        "type": "array",
        "items": {
          "type": "string",
          "minLength": 1,
          "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.?(?:\\/|$)).+$"
        }
      },
      "description": "Role (e.g. types, stylepack, stars) to the entry paths that provide it."
    },
    "ids": {
      "default": {},
      "type": "object",
      "propertyNames": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)*$"
      },
      "additionalProperties": {
        "type": "string",
        "minLength": 1,
        "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.?(?:\\/|$)).+$"
      },
      "description": "Asset id to the entry path of its runtime file."
    },
    "blocks": {
      "default": {},
      "type": "object",
      "propertyNames": {
        "type": "string",
        "minLength": 1
      },
      "additionalProperties": {
        "type": "object",
        "properties": {
          "entry": {
            "type": "string",
            "minLength": 1,
            "description": "Zip member holding the block."
          },
          "size": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991,
            "description": "Uncompressed block size in bytes."
          }
        },
        "required": [
          "entry",
          "size"
        ],
        "additionalProperties": false
      },
      "description": "Solid blocks: many small files compressed together as one zip member."
    },
    "entries": {
      "type": "object",
      "propertyNames": {
        "type": "string",
        "minLength": 1,
        "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.?(?:\\/|$)).+$"
      },
      "additionalProperties": {
        "type": "object",
        "properties": {
          "size": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991,
            "description": "Uncompressed size in bytes."
          },
          "sha256": {
            "type": "string",
            "pattern": "^sha256:[0-9a-f]{64}$",
            "description": "sha256 of the uncompressed content."
          },
          "mediaType": {
            "type": "string",
            "minLength": 1,
            "description": "Media type, e.g. model/gltf-binary."
          },
          "block": {
            "type": "string",
            "minLength": 1,
            "description": "Solid block holding this file; absent when it is its own zip member."
          },
          "offset": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991,
            "description": "Byte offset inside the block."
          },
          "variants": {
            "type": "object",
            "propertyNames": {
              "type": "string",
              "pattern": "^[a-z0-9][a-z0-9-]*$"
            },
            "additionalProperties": {
              "type": "string",
              "minLength": 1,
              "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.?(?:\\/|$)).+$"
            },
            "description": "Alternative encodings of the same content, variant name to entry path."
          }
        },
        "required": [
          "size",
          "sha256",
          "mediaType"
        ],
        "additionalProperties": false
      },
      "description": "Every logical file in the pack, by path."
    }
  },
  "required": [
    "format",
    "id",
    "version",
    "contentHash",
    "entries"
  ],
  "additionalProperties": false
}
```
