# Entity type registry (`molen/types@1`)

Namespaced entity types with doc strings, default components, inheritance, and asset refs. Scenes instantiate them; reservations in project.json partition the id space between agents.

## Example

```json
{
  "format": "molen/types@1",
  "namespace": "train",
  "owner": "agent:layout",
  "types": {
    "train.car": {
      "doc": "A generic rail vehicle.",
      "components": {
        "transform": {
          "pos": [
            0,
            0,
            0
          ],
          "rot": [
            0,
            0,
            0,
            1
          ]
        },
        "renderable": {
          "kind": "primitive",
          "ref": "box",
          "materialRef": "palette:#8a5a2b"
        }
      }
    },
    "train.locomotive": {
      "doc": "Powered engine at the head of a consist.",
      "extends": "train.car",
      "components": {
        "renderable": {
          "materialRef": "palette:#2b2b2b"
        }
      }
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
      "const": "molen/types@1",
      "description": "Format envelope; always 'molen/types@1'."
    },
    "namespace": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)*$",
      "description": "Namespace every type id in this file lives under (dotted lower_snake, e.g. 'train')."
    },
    "owner": {
      "type": "string",
      "minLength": 1,
      "description": "Owning agent or package label, e.g. 'agent:layout'."
    },
    "doc": {
      "type": "string",
      "description": "Human/agent description of this type collection."
    },
    "types": {
      "default": {},
      "type": "object",
      "propertyNames": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$"
      },
      "additionalProperties": {
        "type": "object",
        "properties": {
          "doc": {
            "type": "string",
            "description": "Human/agent description of the type."
          },
          "extends": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$",
            "description": "Parent type id whose components this type inherits (deep-merged)."
          },
          "components": {
            "default": {},
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {
              "type": "object",
              "propertyNames": {
                "type": "string"
              },
              "additionalProperties": {
                "$ref": "#/$defs/__schema0"
              }
            },
            "description": "Default component map for entities of this type (a partial when extends is set)."
          },
          "assets": {
            "default": [],
            "type": "array",
            "items": {
              "type": "string",
              "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)*$"
            },
            "description": "Project asset ids this type references (e.g. its gltf model)."
          },
          "scripts": {
            "default": [],
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "checkpoint": {
                  "type": "string",
                  "const": "state",
                  "description": "Opt into checkpoint restore: keep all durable state in molen.state, components, or snapshot providers, never mutable closures. Without this declaration replay seeks from the beginning."
                },
                "id": {
                  "type": "string",
                  "minLength": 1,
                  "description": "Script id, unique within the scene."
                },
                "code": {
                  "type": "string",
                  "minLength": 1,
                  "description": "Inline JavaScript source (exactly one of code or path)."
                },
                "path": {
                  "type": "string",
                  "minLength": 1,
                  "allOf": [
                    {
                      "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.(?:\\/|$)).+$"
                    },
                    {
                      "pattern": "\\.(?:js|ts)$"
                    }
                  ],
                  "description": "Scene-relative path to a script file, .js or .ts (exactly one of code or path). A .ts file has its types erased when the scene is loaded."
                },
                "config": {
                  "default": {},
                  "type": "object",
                  "propertyNames": {
                    "type": "string"
                  },
                  "additionalProperties": {
                    "$ref": "#/$defs/__schema0"
                  },
                  "description": "Frozen JSON config exposed to the script as `config`."
                }
              },
              "required": [
                "id"
              ],
              "additionalProperties": false
            },
            "description": "Deterministic type behavior, installed once per world with config.type set to this type id."
          }
        },
        "additionalProperties": false
      },
      "description": "Type id to definition; every id must start with '<namespace>.'."
    }
  },
  "required": [
    "format",
    "namespace"
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
