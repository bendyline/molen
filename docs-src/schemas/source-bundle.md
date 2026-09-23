# Logical source bundle (`molen/source-bundle@1`)

Portable authoring-time manifest for one logical thing: definitions, editable models or recipes, generators, behavior scripts, textures, sounds, and documentation under one directory.

## Example

```json
{
  "format": "molen/source-bundle@1",
  "id": "example.vehicle.roadster",
  "kind": "vehicle",
  "title": "Roadster",
  "order": 10,
  "files": {
    "definitions": [
      "entity.types.json"
    ],
    "models": [
      {
        "path": "models/source.glb",
        "assetId": "example.vehicle.roadster",
        "output": "assets/example/vehicle/roadster/asset.json",
        "pipeline": "import",
        "sha256": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
      }
    ],
    "generators": [
      {
        "id": "model",
        "path": "models/generate.mjs"
      }
    ],
    "scripts": [
      {
        "id": "interactions",
        "path": "scripts/interactions.ts"
      }
    ],
    "textures": [],
    "sounds": [],
    "documents": [
      "README.md"
    ]
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
      "const": "molen/source-bundle@1",
      "description": "Format envelope; always 'molen/source-bundle@1'."
    },
    "id": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9_.-]*$",
      "description": "Stable logical content id, normally the runtime entity or asset id."
    },
    "kind": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]*$",
      "description": "Open content class such as 'entity', 'vehicle', or 'worldgen-structure'."
    },
    "title": {
      "type": "string",
      "minLength": 1,
      "description": "Human-readable content name."
    },
    "order": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991,
      "description": "Optional stable presentation or build order within an owning collection."
    },
    "files": {
      "type": "object",
      "properties": {
        "definitions": {
          "default": [],
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1,
            "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.(?:\\/|$)).+$"
          },
          "description": "Bundle-relative JSON definitions, manifests, recipes, or configuration files."
        },
        "models": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "path": {
                "type": "string",
                "minLength": 1,
                "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.(?:\\/|$)).+$",
                "description": "Bundle-relative editable model or model recipe path."
              },
              "assetId": {
                "type": "string",
                "pattern": "^[a-z][a-z0-9_.-]*$",
                "description": "Runtime asset id produced from this source model, when applicable."
              },
              "output": {
                "type": "string",
                "minLength": 1,
                "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.(?:\\/|$)).+$",
                "description": "Owning-project-relative output path of the generated molen/asset@1 sidecar, when applicable."
              },
              "pipeline": {
                "type": "string",
                "enum": [
                  "copy",
                  "import"
                ],
                "description": "'copy' when the editable GLB is already canonical; 'import' when molen asset import derives the runtime model."
              },
              "sha256": {
                "type": "string",
                "pattern": "^sha256:[0-9a-f]{64}$",
                "description": "Optional pinned authoring-source hash for binary model masters."
              }
            },
            "required": [
              "path"
            ],
            "additionalProperties": false
          },
          "description": "Editable model masters and procedural model recipes."
        },
        "generators": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "pattern": "^[a-z][a-z0-9_.-]*$",
                "description": "Stable role/name for this file inside the logical source bundle."
              },
              "path": {
                "type": "string",
                "minLength": 1,
                "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.(?:\\/|$)).+$",
                "description": "Bundle-relative source path; it may not escape the bundle."
              }
            },
            "required": [
              "id",
              "path"
            ],
            "additionalProperties": false
          },
          "description": "Authoring programs used to create, verify, or transform owned source files."
        },
        "scripts": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "pattern": "^[a-z][a-z0-9_.-]*$",
                "description": "Stable role/name for this file inside the logical source bundle."
              },
              "path": {
                "type": "string",
                "minLength": 1,
                "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.(?:\\/|$)).+$",
                "description": "Bundle-relative source path; it may not escape the bundle."
              }
            },
            "required": [
              "id",
              "path"
            ],
            "additionalProperties": false
          },
          "description": "Deterministic behavior scripts owned by this logical thing."
        },
        "textures": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "pattern": "^[a-z][a-z0-9_.-]*$",
                "description": "Stable role/name for this file inside the logical source bundle."
              },
              "path": {
                "type": "string",
                "minLength": 1,
                "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.(?:\\/|$)).+$",
                "description": "Bundle-relative source path; it may not escape the bundle."
              }
            },
            "required": [
              "id",
              "path"
            ],
            "additionalProperties": false
          },
          "description": "Authoring texture sources owned by this logical thing."
        },
        "sounds": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "pattern": "^[a-z][a-z0-9_.-]*$",
                "description": "Stable role/name for this file inside the logical source bundle."
              },
              "path": {
                "type": "string",
                "minLength": 1,
                "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.(?:\\/|$)).+$",
                "description": "Bundle-relative source path; it may not escape the bundle."
              }
            },
            "required": [
              "id",
              "path"
            ],
            "additionalProperties": false
          },
          "description": "Authoring audio sources owned by this logical thing."
        },
        "documents": {
          "default": [],
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1,
            "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.(?:\\/|$)).+$"
          },
          "description": "Bundle-relative provenance, briefs, verification reports, and previews."
        }
      },
      "additionalProperties": false,
      "description": "Every source file owned by the logical thing. Shared engine code and generated runtime outputs are intentionally excluded."
    }
  },
  "required": [
    "format",
    "id",
    "kind",
    "title",
    "files"
  ],
  "additionalProperties": false
}
```
