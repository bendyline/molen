# Keyframe snapshot (`molen/keyframe@1`)

Complete world state at a tick: the save-file format, replay seek index, and snapshot-viewer input.

## Example

```json
{
  "kind": "keyframe",
  "v": 1,
  "engine": "0.0.1",
  "tick": 120,
  "tickRate": 30,
  "seed": "demo",
  "nextEntitySeq": 2,
  "rng": {
    "algo": "sfc32",
    "state": [
      738291,
      102,
      99182,
      4
    ]
  },
  "entities": {
    "player": {
      "transform": {
        "pos": [
          0,
          1,
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
        "hp": 80
      }
    },
    "e1": {
      "transform": {
        "pos": [
          9,
          0,
          3
        ],
        "rot": [
          0,
          0,
          0,
          1
        ]
      },
      "lifetime": {
        "ticksLeft": 12
      }
    }
  },
  "plugins": {}
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
      "const": "keyframe",
      "description": "Envelope discriminator; always 'keyframe'."
    },
    "v": {
      "type": "number",
      "const": 1,
      "description": "Keyframe format version; always 1."
    },
    "engine": {
      "type": "string",
      "minLength": 1,
      "description": "Engine version that produced the snapshot."
    },
    "tick": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991,
      "description": "Tick the snapshot was taken at (state after this tick)."
    },
    "tickRate": {
      "type": "integer",
      "minimum": 1,
      "maximum": 240,
      "description": "Simulation ticks per second of the world; dt = 1/tickRate seconds."
    },
    "seed": {
      "description": "World RNG seed (string or number).",
      "type": [
        "string",
        "number"
      ]
    },
    "nextEntitySeq": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991,
      "description": "Next runtime entity sequence number (runtime ids are 'e<seq>')."
    },
    "entityOrder": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1
      },
      "description": "Entity creation order; older snapshots fall back to object key order."
    },
    "commands": {
      "type": "object",
      "properties": {
        "pending": {
          "type": "array",
          "items": {
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
            "additionalProperties": false
          }
        },
        "highestSeq": {
          "type": "object",
          "propertyNames": {
            "type": "string"
          },
          "additionalProperties": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          }
        },
        "latePolicy": {
          "type": "string",
          "enum": [
            "rewrite",
            "reject"
          ]
        }
      },
      "required": [
        "pending",
        "highestSeq",
        "latePolicy"
      ],
      "additionalProperties": false,
      "description": "Accepted future commands and deduplication cursors."
    },
    "rng": {
      "type": "object",
      "properties": {
        "algo": {
          "type": "string",
          "const": "sfc32",
          "description": "RNG algorithm; always 'sfc32'."
        },
        "state": {
          "minItems": 4,
          "maxItems": 4,
          "type": "array",
          "items": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          },
          "description": "The four 32-bit unsigned words of sfc32 state."
        }
      },
      "required": [
        "algo",
        "state"
      ],
      "additionalProperties": false,
      "description": "Exact RNG state so the run resumes deterministically."
    },
    "entities": {
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
      "description": "Entity id to component map: the complete world state."
    },
    "plugins": {
      "default": {},
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "$ref": "#/$defs/__schema0"
      },
      "description": "Opaque per-plugin snapshot blobs keyed by plugin name."
    }
  },
  "required": [
    "kind",
    "v",
    "engine",
    "tick",
    "tickRate",
    "seed",
    "nextEntitySeq",
    "rng",
    "entities"
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
