# Landmark catalog (`molen/landmark-catalog@1`)

An index of reusable external landmark model manifests.

## Example

```json
{
  "format": "molen/landmark-catalog@1",
  "version": 3,
  "models": {
    "sign.grocery": "grocery.landmark.json",
    "bench": "bench.landmark.json",
    "street_lamp": "street_lamp.landmark.json"
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
      "const": "molen/landmark-catalog@1"
    },
    "version": {
      "type": "integer",
      "exclusiveMinimum": 0,
      "maximum": 9007199254740991
    },
    "models": {
      "type": "object",
      "propertyNames": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_.]*$",
        "description": "Stable builtin model name, such as sign.burger_restaurant."
      },
      "additionalProperties": {
        "type": "string",
        "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.(?:\\/|$)).+$"
      },
      "description": "Builtin model name to contained catalog-relative JSON manifest path."
    }
  },
  "required": [
    "format",
    "version",
    "models"
  ],
  "additionalProperties": false
}
```
