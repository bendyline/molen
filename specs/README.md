# Proposal Specifications

This directory is for community proposals requesting fixes or new Molen
capabilities. It is not a path for contributing implementation code.

Create a clearly named Markdown file for each proposal, such as
`streaming-audio-capability.md`. A useful proposal usually includes:

- **Summary:** A concise description of the request.
- **Problem:** The user need or limitation being addressed.
- **Desired behavior:** What should change from a user's perspective.
- **Constraints:** Compatibility, performance, security, or format requirements.
- **Examples:** Inputs, outputs, workflows, or other concrete scenarios.
- **Acceptance criteria:** Observable conditions that would make the request
  complete.

Molen is an engine, so two constraints are worth addressing explicitly when they
apply to your request:

- **Determinism.** If the proposal touches simulation, say which level it needs —
  see [the determinism guide](../docs-src/guide/determinism.md). A capability
  whose output reaches the state hash has a much higher bar than a render-only
  one.
- **Data first.** Molen prefers a declared, validated document over an API call
  wherever a document can express the thing. If your proposal adds a format or a
  component, sketch the document, not just the function.

Prompts, pseudocode, diagrams, and reference material are welcome when they
clarify the request. Do not include source-code changes. Open a pull request
containing only the proposal and any directly related proposal assets, and
review the submission terms in [`CONTRIBUTING.md`](../CONTRIBUTING.md) before
submitting.
