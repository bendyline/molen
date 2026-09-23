# Per-tick delta (`molen/delta@1`)

Dirty-tracked changes since the previous tick, whole-component granularity.

## Example

```json
{
  "kind": "delta",
  "v": 1,
  "tick": 121,
  "baseTick": 120,
  "spawned": {},
  "destroyed": [],
  "changed": {
    "player": {
      "transform": {
        "pos": [
          0.1,
          1,
          0
        ],
        "rot": [
          0,
          0,
          0,
          1
        ]
      }
    }
  },
  "removedComponents": {},
  "events": []
}
```

## JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "kind": {
      "type": "string",
      "const": "delta",
      "description": "Envelope discriminator; always 'delta'."
    },
    "v": {
      "type": "number",
      "const": 1,
      "description": "Delta format version; always 1."
    },
    "tick": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991,
      "description": "Tick this delta describes (state after this tick)."
    },
    "baseTick": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991,
      "description": "Tick the delta is relative to (normally tick - 1)."
    },
    "spawned": {
      "default": {},
      "type": "object",
      "propertyNames": {
        "type": "string",
        "minLength": 1
      },
      "additionalProperties": {
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
        }
      },
      "description": "Entities created this tick with their full component maps."
    },
    "destroyed": {
      "default": [],
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1
      },
      "description": "Ids of entities destroyed this tick."
    },
    "changed": {
      "default": {},
      "type": "object",
      "propertyNames": {
        "type": "string",
        "minLength": 1
      },
      "additionalProperties": {
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
        }
      },
      "description": "Entities whose components changed, each carrying the full new value of every changed component (whole-component granularity)."
    },
    "removedComponents": {
      "default": {},
      "type": "object",
      "propertyNames": {
        "type": "string",
        "minLength": 1
      },
      "additionalProperties": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "description": "Entity id to names of components removed this tick."
    },
    "events": {
      "default": [],
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type": {
            "type": "string",
            "minLength": 1,
            "description": "Event type name."
          },
          "payload": {
            "description": "Event payload (any JSON).",
            "$ref": "#/$defs/__schema0"
          }
        },
        "required": [
          "type",
          "payload"
        ],
        "additionalProperties": false
      },
      "description": "World events emitted this tick, in emission order."
    }
  },
  "required": [
    "kind",
    "v",
    "tick",
    "baseTick"
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
