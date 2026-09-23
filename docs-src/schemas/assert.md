# Assertion document (`molen/assert@1`)

Declarative world-state and event assertions evaluated after a headless run.

## Example

```json
{
  "format": "molen/assert@1",
  "assertions": [
    {
      "select": "has:transform",
      "op": "count",
      "value": 2
    },
    {
      "select": "#player .health.hp",
      "op": "gte",
      "value": 1
    },
    {
      "event": "player_died",
      "op": "never"
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
      "const": "molen/assert@1",
      "description": "Format envelope; always 'molen/assert@1'."
    },
    "assertions": {
      "minItems": 1,
      "type": "array",
      "items": {
        "anyOf": [
          {
            "type": "object",
            "properties": {
              "select": {
                "type": "string",
                "minLength": 1,
                "description": "Entity selector plus optional value path: '#id', 'tag:name', 'has:component', e.g. '#player .health.hp'."
              },
              "op": {
                "type": "string",
                "enum": [
                  "eq",
                  "approx",
                  "gt",
                  "gte",
                  "lt",
                  "lte",
                  "count",
                  "exists",
                  "all_eq",
                  "all_approx",
                  "all_gt",
                  "all_gte",
                  "all_lt",
                  "all_lte",
                  "any_eq",
                  "any_approx",
                  "any_gt",
                  "any_gte",
                  "any_lt",
                  "any_lte"
                ],
                "description": "Comparison: eq/approx/gt/gte/lt/lte on the single match, count/exists on the match set, all_*/any_* over every match."
              },
              "value": {
                "description": "Expected value (for count: the expected number of matches).",
                "$ref": "#/$defs/__schema0"
              },
              "tol": {
                "type": "number",
                "exclusiveMinimum": 0,
                "description": "Absolute tolerance for approx ops (default 1e-6)."
              }
            },
            "required": [
              "select",
              "op"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "event": {
                "type": "string",
                "minLength": 1,
                "description": "World event type to check."
              },
              "op": {
                "type": "string",
                "enum": [
                  "occurred",
                  "never",
                  "count",
                  "at_tick"
                ],
                "description": "occurred (at least once), never, count (value = expected count), or at_tick (value = tick it must have occurred at)."
              },
              "value": {
                "type": "number",
                "description": "Expected count for count, or tick for at_tick."
              }
            },
            "required": [
              "event",
              "op"
            ],
            "additionalProperties": false
          }
        ]
      },
      "description": "Assertions evaluated after the run (at least one)."
    }
  },
  "required": [
    "format",
    "assertions"
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
