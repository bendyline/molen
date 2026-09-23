# Prefab (`molen/prefab@1`)

Declarative entity template: component name to pure-JSON component data.

## Example

```json
{
  "format": "molen/prefab@1",
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
    "health": {
      "hp": 10
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
      "const": "molen/prefab@1",
      "description": "Format envelope 'molen/prefab@1' (optional when the prefab is inlined in a scene)."
    },
    "extends": {
      "type": "string",
      "minLength": 1,
      "description": "Name of a prefab in the same manifest to inherit components from (deep-merged)."
    },
    "type": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$",
      "description": "Project-registry type id this prefab specializes, e.g. 'train.locomotive'."
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
      "description": "Component name to pure-JSON component data (deep-merged over the extends/type base)."
    }
  },
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
