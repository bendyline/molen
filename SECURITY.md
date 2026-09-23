# Security Policy

## Reporting a Vulnerability

Please report suspected security vulnerabilities privately by emailing
[support@bendyline.com](mailto:support@bendyline.com) with the subject
`[Molen Security]`.

Include as much of the following as possible:

- The affected package and version.
- A description of the vulnerability and its potential impact.
- Steps to reproduce or a minimal proof of concept.
- Any known mitigations or workarounds.
- A safe way to contact you with follow-up questions.

Please do not disclose exploitable details in a public GitHub issue. General,
non-sensitive security questions and hardening suggestions may be submitted as
a [GitHub issue](https://github.com/bendyline/molen/issues/new).

We will review reports and respond as circumstances allow. Please allow time
for investigation and remediation before public disclosure.

## What Is and Is Not a Vulnerability

Molen runs scene manifests, and a manifest can carry scripts. **Those scripts
run with the authority of the process evaluating them, by design.** The SES
Compartment around a script and its tamed `Math` exist to make simulation
deterministic, not to contain hostile code: intrinsics are shared, and reaching
the host global is one expression away. Treat a scene manifest the way you would
treat a source file — only run manifests you would run as a program. This applies
in particular to the `molen` CLI and the MCP server, which evaluate a manifest's
scripts in the process that invoked them.

So a report that a script can reach the host from an ordinary, un-hardened host
is describing documented behavior rather than a vulnerability. See
[the scripting guide](docs-src/guide/scripting.md).

These, by contrast, are in scope and we want to hear about them:

- An escape from a host that called `hardenScripts()` (SES `lockdown`), where
  isolation is the stated intent.
- A path that reaches the filesystem, the network, or another process without
  going through a script the operator chose to run — for example through a
  crafted asset, keyframe, replay fixture, or terrain package.
- Path traversal or arbitrary write in the CLI, the MCP server, or the local
  capture and playback servers they start.
- A crafted document that makes the validator, a loader, or a decoder hang,
  exhaust memory, or crash a host that was only validating it.
- Anything in a published package that executes at install or import time
  beyond what its documentation describes.

## Supported Versions

Security fixes are generally made against the latest released version. Users
should upgrade to the latest available release before reporting an issue and
when adopting a security fix.
