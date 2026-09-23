# Project manifest (`molen/project@1`)

Binds an experience project together: scenes by name, type-registry documents, imported assets, namespace reservations, and the default setup module.

## Example

```json
{
  "format": "molen/project@1",
  "name": "rail-yard",
  "scenes": {
    "main": "scenes/main.scene.json"
  },
  "defaultScene": "main",
  "types": [
    "types/train.types.json"
  ],
  "assets": {
    "train.boxcar_mesh": "assets/boxcar/asset.json"
  },
  "reservations": [
    {
      "namespace": "train",
      "owner": "agent:layout"
    }
  ],
  "setup": "setup.mjs",
  "codegen": {
    "out": "gen/molen-types.ts"
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
      "const": "molen/project@1",
      "description": "Format envelope; always 'molen/project@1'."
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "description": "Project name."
    },
    "engine": {
      "type": "string",
      "minLength": 1,
      "description": "Engine version the project targets."
    },
    "scenes": {
      "default": {},
      "type": "object",
      "propertyNames": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_-]*$"
      },
      "additionalProperties": {
        "type": "string",
        "minLength": 1,
        "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.(?:\\/|$)).+$"
      },
      "description": "Scene name (lower-kebab) to project-relative scene file path."
    },
    "defaultScene": {
      "type": "string",
      "description": "Key of `scenes` opened when none is named."
    },
    "types": {
      "default": [],
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.(?:\\/|$)).+$"
      },
      "description": "Project-relative paths of molen/types@1 documents to load."
    },
    "assets": {
      "default": {},
      "type": "object",
      "propertyNames": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)*$"
      },
      "additionalProperties": {
        "type": "string",
        "minLength": 1,
        "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.(?:\\/|$)).+$"
      },
      "description": "Asset id to project-relative path of its molen/asset@1 sidecar (asset.json)."
    },
    "reservations": {
      "default": [],
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "namespace": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)*$",
            "description": "Reserved namespace (covers all of its sub-namespaces)."
          },
          "owner": {
            "type": "string",
            "minLength": 1,
            "description": "Owner label holding the reservation, e.g. an agent id."
          },
          "note": {
            "type": "string",
            "description": "Free-form note about the reservation."
          }
        },
        "required": [
          "namespace",
          "owner"
        ],
        "additionalProperties": false
      },
      "description": "Namespace reservations partitioning the type-id space between owners."
    },
    "setup": {
      "type": "string",
      "minLength": 1,
      "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.(?:\\/|$)).+$",
      "description": "Project-relative path of the setup module (setup.mjs) exporting setup(world, manifest)."
    },
    "components": {
      "default": {},
      "type": "object",
      "propertyNames": {
        "type": "string",
        "pattern": "^[a-zA-Z]\\w*$"
      },
      "additionalProperties": {
        "type": "object",
        "properties": {
          "description": {
            "type": "string",
            "minLength": 1,
            "description": "One-line human/agent description of the component."
          },
          "examples": {
            "minItems": 1,
            "type": "array",
            "items": {
              "$ref": "#/$defs/__schema0"
            },
            "description": "At least one valid example of the component data (feeds hints and docs)."
          },
          "schema": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {
              "$ref": "#/$defs/__schema0"
            },
            "description": "JSON Schema (object/array/number/integer/string/boolean subset) for the component data; omitted = any object."
          }
        },
        "required": [
          "description",
          "examples"
        ],
        "additionalProperties": false
      },
      "description": "Custom component vocabulary shared by every scene in the project."
    },
    "codegen": {
      "default": {
        "out": "gen/molen-types.ts"
      },
      "type": "object",
      "properties": {
        "out": {
          "default": "gen/molen-types.ts",
          "type": "string",
          "minLength": 1,
          "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.(?:\\/|$)).+$",
          "description": "Project-relative output path for generated TypeScript types."
        }
      },
      "additionalProperties": false,
      "description": "Code generation settings (molen codegen)."
    }
  },
  "required": [
    "format",
    "name"
  ],
  "additionalProperties": false,
  "$defs": {
    "__schema0": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "number"
        },
        {
          "type": "boolean"
        },
        {
          "type": "null"
        },
        {
          "type": "array",
          "items": {
            "$ref": "#/$defs/__schema0"
          }
        },
        {
          "type": "object",
          "propertyNames": {
            "type": "string"
          },
          "additionalProperties": {
            "$ref": "#/$defs/__schema0"
          }
        }
      ]
    }
  }
}
```
