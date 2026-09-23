# Content pack index (`molen/pack-index@1`)

Lists the current built file of each pack in a directory, so a host can publish several packs and clients can find them by id.

## Example

```json
{
  "format": "molen/pack-index@1",
  "packs": {
    "example.vehicles": {
      "version": "1.0.0",
      "file": "example.vehicles-0123456789ab.zip",
      "contentHash": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      "size": 91234
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
      "const": "molen/pack-index@1",
      "description": "Format envelope; always 'molen/pack-index@1'."
    },
    "packs": {
      "type": "object",
      "propertyNames": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)*$"
      },
      "additionalProperties": {
        "type": "object",
        "properties": {
          "version": {
            "type": "string",
            "minLength": 1,
            "description": "Pack version."
          },
          "file": {
            "type": "string",
            "minLength": 1,
            "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.?(?:\\/|$)).+$",
            "description": "Pack file, relative to the index."
          },
          "contentHash": {
            "type": "string",
            "pattern": "^sha256:[0-9a-f]{64}$",
            "description": "The pack manifest's contentHash."
          },
          "size": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991,
            "description": "File size in bytes."
          }
        },
        "required": [
          "version",
          "file",
          "contentHash",
          "size"
        ],
        "additionalProperties": false
      },
      "description": "Pack id to its current built file."
    }
  },
  "required": [
    "format",
    "packs"
  ],
  "additionalProperties": false
}
```
