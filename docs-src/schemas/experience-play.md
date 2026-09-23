# Experience play scenario (`molen/experience-play@1`)

A scripted browser session over a built app: real keyboard and pointer input in, screenshots and probed page text out. Run it with `molen play`.

## Example

```json
{
  "format": "molen/experience-play@1",
  "name": "walk-to-the-gate",
  "path": "/?synthetic=1",
  "viewport": [
    960,
    540
  ],
  "probes": [
    {
      "name": "status",
      "selector": "#status"
    }
  ],
  "actions": [
    {
      "type": "wait-for",
      "selector": "#status",
      "text": "ready",
      "timeoutMs": 60000
    },
    {
      "type": "screenshot",
      "name": "01-start"
    },
    {
      "type": "keys",
      "keys": [
        "w"
      ],
      "durationMs": 1500
    },
    {
      "type": "screenshot",
      "name": "02-moved"
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
      "const": "molen/experience-play@1"
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "description": "Scenario name; used to label the run and its output folder."
    },
    "path": {
      "description": "Page to open inside the built app, including any query string (default '/').",
      "type": "string"
    },
    "viewport": {
      "description": "Browser viewport in CSS pixels: exactly two positive integers, [width, height].",
      "type": "array",
      "prefixItems": [
        {
          "type": "integer",
          "exclusiveMinimum": 0,
          "maximum": 9007199254740991
        },
        {
          "type": "integer",
          "exclusiveMinimum": 0,
          "maximum": 9007199254740991
        }
      ],
      "items": false,
      "minItems": 2,
      "maxItems": 2
    },
    "probes": {
      "description": "Page values to read alongside each frame — a HUD line, a status element.",
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "minLength": 1,
            "description": "Probe name; the key its text appears under per frame."
          },
          "selector": {
            "type": "string",
            "minLength": 1,
            "description": "CSS selector whose text is captured with every screenshot."
          }
        },
        "required": [
          "name",
          "selector"
        ]
      }
    },
    "actions": {
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "wait"
              },
              "durationMs": {
                "type": "integer",
                "minimum": 0,
                "maximum": 9007199254740991
              },
              "note": {
                "type": "string"
              }
            },
            "required": [
              "type",
              "durationMs"
            ]
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "wait-for"
              },
              "selector": {
                "type": "string",
                "minLength": 1
              },
              "text": {
                "type": "string"
              },
              "timeoutMs": {
                "type": "integer",
                "exclusiveMinimum": 0,
                "maximum": 9007199254740991
              },
              "note": {
                "type": "string"
              }
            },
            "required": [
              "type",
              "selector"
            ]
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "wait-for-stable"
              },
              "selector": {
                "type": "string",
                "minLength": 1
              },
              "text": {
                "type": "string"
              },
              "stableMs": {
                "type": "integer",
                "exclusiveMinimum": 0,
                "maximum": 9007199254740991
              },
              "timeoutMs": {
                "type": "integer",
                "exclusiveMinimum": 0,
                "maximum": 9007199254740991
              },
              "note": {
                "type": "string"
              }
            },
            "required": [
              "type",
              "selector"
            ]
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "keys"
              },
              "keys": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "durationMs": {
                "type": "integer",
                "exclusiveMinimum": 0,
                "maximum": 9007199254740991
              },
              "note": {
                "type": "string"
              }
            },
            "required": [
              "type",
              "keys",
              "durationMs"
            ]
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "key-down"
              },
              "keys": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "note": {
                "type": "string"
              }
            },
            "required": [
              "type",
              "keys"
            ]
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "key-up"
              },
              "keys": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "note": {
                "type": "string"
              }
            },
            "required": [
              "type",
              "keys"
            ]
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "drag"
              },
              "selector": {
                "type": "string",
                "minLength": 1
              },
              "from": {
                "type": "array",
                "prefixItems": [
                  {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                  },
                  {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                  }
                ],
                "items": false,
                "minItems": 2,
                "maxItems": 2,
                "description": "Fractional point inside the target element: exactly two numbers, [x, y], each 0-1."
              },
              "to": {
                "type": "array",
                "prefixItems": [
                  {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                  },
                  {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1
                  }
                ],
                "items": false,
                "minItems": 2,
                "maxItems": 2,
                "description": "Fractional point inside the target element: exactly two numbers, [x, y], each 0-1."
              },
              "durationMs": {
                "type": "integer",
                "exclusiveMinimum": 0,
                "maximum": 9007199254740991
              },
              "steps": {
                "type": "integer",
                "exclusiveMinimum": 0,
                "maximum": 9007199254740991
              },
              "note": {
                "type": "string"
              }
            },
            "required": [
              "type",
              "selector",
              "from",
              "to"
            ]
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "click"
              },
              "selector": {
                "type": "string",
                "minLength": 1
              },
              "note": {
                "type": "string"
              }
            },
            "required": [
              "type",
              "selector"
            ]
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "select"
              },
              "selector": {
                "type": "string",
                "minLength": 1
              },
              "value": {
                "type": "string"
              },
              "note": {
                "type": "string"
              }
            },
            "required": [
              "type",
              "selector",
              "value"
            ]
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "navigate"
              },
              "path": {
                "type": "string",
                "minLength": 1
              },
              "note": {
                "type": "string"
              }
            },
            "required": [
              "type",
              "path"
            ]
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "screenshot"
              },
              "name": {
                "type": "string",
                "pattern": "^[A-Za-z0-9][A-Za-z0-9_-]*$"
              },
              "settleMs": {
                "type": "integer",
                "minimum": 0,
                "maximum": 9007199254740991
              },
              "fullPage": {
                "type": "boolean"
              },
              "note": {
                "type": "string"
              }
            },
            "required": [
              "type",
              "name"
            ]
          }
        ]
      },
      "description": "What to do, in order: wait, wait-for, wait-for-stable, keys, key-down, key-up, drag, click, select, navigate, screenshot. Each screenshot yields one frame plus its probes."
    }
  },
  "required": [
    "format",
    "name",
    "actions"
  ]
}
```
