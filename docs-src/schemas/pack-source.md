# Content pack source (`molen/pack-source@1`)

Build settings for a content pack, kept as molen-pack.source.json in the directory `molen pack build` turns into a pack.

## Example

```json
{
  "format": "molen/pack-source@1",
  "id": "example.vehicles",
  "version": "1.0.0",
  "license": "CC0-1.0",
  "notice": "NOTICE.md",
  "include": [
    "**"
  ],
  "exclude": [
    "**/*.psd"
  ],
  "ids": {},
  "provides": {
    "types": "types/vehicles.types.json"
  },
  "solid": true
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
      "const": "molen/pack-source@1",
      "description": "Format envelope; always 'molen/pack-source@1'."
    },
    "id": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)*$",
      "description": "Stable pack id, e.g. molen.entities."
    },
    "version": {
      "type": "string",
      "minLength": 1,
      "description": "Pack version."
    },
    "title": {
      "type": "string",
      "minLength": 1,
      "description": "Human-readable pack name."
    },
    "license": {
      "type": "string",
      "minLength": 1,
      "description": "SPDX expression for the pack's content."
    },
    "notice": {
      "type": "string",
      "minLength": 1,
      "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.?(?:\\/|$)).+$",
      "description": "File that carries the attribution notice."
    },
    "include": {
      "default": [
        "**"
      ],
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1
      },
      "description": "Globs (*, **, ?) of files to include, relative to the source directory."
    },
    "exclude": {
      "default": [],
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1
      },
      "description": "Globs of files to leave out."
    },
    "ids": {
      "default": {},
      "type": "object",
      "propertyNames": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)*$"
      },
      "additionalProperties": {
        "type": "string",
        "minLength": 1,
        "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.?(?:\\/|$)).+$"
      },
      "description": "Extra asset id to file mappings. Ids declared by molen/asset@1 sidecars are added automatically."
    },
    "provides": {
      "default": {},
      "type": "object",
      "propertyNames": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9-]*$"
      },
      "additionalProperties": {
        "anyOf": [
          {
            "type": "string",
            "minLength": 1,
            "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.?(?:\\/|$)).+$"
          },
          {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1,
              "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.?(?:\\/|$)).+$"
            }
          }
        ]
      },
      "description": "Role (e.g. types, stylepack, stars) to the file or files that provide it."
    },
    "solid": {
      "default": true,
      "type": "boolean",
      "description": "Group small text files into compressed solid blocks (default true)."
    }
  },
  "required": [
    "format",
    "id",
    "version"
  ],
  "additionalProperties": false
}
```
