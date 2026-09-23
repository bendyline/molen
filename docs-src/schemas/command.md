# Command envelope (`molen/command@1`)

Client/agent intent submitted to the kernel for validation and adjudication at a tick.

## Example

```json
{
  "kind": "command",
  "seq": 1,
  "source": "local",
  "tick": 45,
  "type": "spawn_cube",
  "payload": {
    "pos": [
      0,
      2,
      0
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
    "kind": {
      "type": "string",
      "const": "command",
      "description": "Envelope discriminator; always 'command'."
    },
    "seq": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991,
      "description": "Monotonic sequence number assigned by the source; orders commands within a tick."
    },
    "source": {
      "type": "string",
      "minLength": 1,
      "description": "Origin of the command, e.g. 'local' or 'agent:<name>'."
    },
    "tick": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991,
      "description": "Tick the command was submitted for."
    },
    "tickExecuted": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991,
      "description": "Tick the kernel actually executed the command at (set when a late command was rewritten to a later tick)."
    },
    "type": {
      "type": "string",
      "minLength": 1,
      "description": "Command type; must match a registered handler and, for molen/scene@3, an entry under the scene `commands`."
    },
    "payload": {
      "description": "Command payload (any JSON); validated against the declared payload schema when the scene declares one.",
      "$ref": "#/$defs/__schema0"
    }
  },
  "required": [
    "kind",
    "seq",
    "source",
    "tick",
    "type",
    "payload"
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
