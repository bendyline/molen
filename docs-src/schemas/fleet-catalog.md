# Regional vehicle fleet (`molen/fleet-catalog@1`)

Shared vehicle IDs with inherited regional spawn weights and a global fallback.

## Example

```json
{
  "format": "molen/fleet-catalog@1",
  "id": "example.fleet",
  "version": 1,
  "description": "Illustrative visual mixture",
  "fallback": "global",
  "regions": {},
  "profiles": [
    {
      "id": "global",
      "title": "Global",
      "weights": {
        "example.car": 1
      }
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
      "const": "molen/fleet-catalog@1"
    },
    "id": {
      "type": "string",
      "minLength": 1
    },
    "version": {
      "type": "integer",
      "exclusiveMinimum": 0,
      "maximum": 9007199254740991
    },
    "description": {
      "type": "string"
    },
    "fallback": {
      "type": "string",
      "minLength": 1
    },
    "regions": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string",
        "minLength": 1
      }
    },
    "profiles": {
      "minItems": 1,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "minLength": 1
          },
          "title": {
            "type": "string",
            "minLength": 1
          },
          "extends": {
            "type": "string"
          },
          "weights": {
            "type": "object",
            "propertyNames": {
              "type": "string",
              "minLength": 1
            },
            "additionalProperties": {
              "type": "number",
              "minimum": 0
            }
          }
        },
        "required": [
          "id",
          "title",
          "weights"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "format",
    "id",
    "version",
    "description",
    "fallback",
    "regions",
    "profiles"
  ],
  "additionalProperties": false
}
```
