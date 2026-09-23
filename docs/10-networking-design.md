# 10 — Networking Design (design-only)

Networking is the last phase and ships as a **design**, not code (brief §2 non-goals; doc 08
P7). The thesis the engine was built around: **networking is a transport + reconciliation layer,
not an engine change.** This document validates that thesis against what is now actually built
(Phases 0–7) and specifies where the transport slots in, the authority model, and the
reconciliation strategy — so the future work is additive.

## 1. What the engine already provides

Every multiplayer affordance from the brief (§3.4) is built and tested:

- **Command-stream input** ([04 §3](04-kernel-design.md)). The client never mutates simulation
  state; it emits `{kind, seq, source, tick, type, payload}` commands the kernel validates and
  adjudicates. `source` is the future peer identity; adjudication order is `(tick, source, seq)`
  — already arrival-order-independent. Late commands have a per-world `rewrite | reject` policy.
- **Snapshot + delta serialization** ([04 §4](04-kernel-design.md)). Keyframes are complete
  save-files (entities + RNG + entity counter + plugin blobs); per-tick deltas are dirty-tracked.
  `applyDelta` and `applyKeyframeTo` are shared by tests, the client mirror, and the scrubber.
- **Deterministic ticks + seeded RNG** ([04 §5](04-kernel-design.md)), measured: replay hashes
  are bit-stable run-to-run, the `ReplayPlayer` seeks by keyframe + re-step, and even Rapier
  resumes bit-exact ([09 R3](09-questions-and-risks.md)).
- **Client-side interpolation buffer** ([05 §2.3](05-client-design.md)) rendering ~1.5 ticks
  behind, with a documented no-extrapolation rule (the FPS phase is where prediction lands).
- **The `MessageLink` seam** ([02 §3](02-packages-and-apis.md), `schema/protocol.ts`). Kernel
  and client already communicate **only** through structured-clone messages over a
  `MessageLink` — today a Web Worker `postMessage`, tomorrow a network transport. This is the
  single insertion point.

The claim "transport, not engine change" is therefore concrete: a transport is a `MessageLink`
implementation, and reconciliation reuses `ReplayPlayer`/`applyKeyframeTo`. No kernel or schema
change is required.

## 2. Authority model

**Server-authoritative.** The kernel is the single source of truth; clients are untrusted
**command emitters + snapshot consumers**. This is already how single-player works — one trusted
peer (`source: "local"`) with zero latency — so multiplayer is the same contract with more peers
and non-zero latency.

Topologies (all reuse the same headless kernel):

- **Dedicated server** — the kernel runs in Node (it already does, for the headless loop); each
  client connects a transport. The canonical, cheat-resistant setup.
- **Listen server** — one client process hosts the authoritative kernel and also renders; remote
  clients connect. Same code; the host's client is just a `source` with zero transport latency.
- **Single-player** — the current state: one in-process kernel, one trusted peer.

Anti-cheat falls out of the architecture: clients can only submit commands, and command handlers
are the *semantic adjudication* layer ([04 §3.2](04-kernel-design.md)) — "does this unit exist,
is this move legal" runs server-side, exactly as it does single-player.

## 3. The transport slot

A transport is a package (`@bendyline/molen-net-*`) implementing two `MessageLink` directions:

```
        CLIENT (untrusted)                         SERVER (authoritative kernel)
  input → InputMap → command  ──► transport.send ──►  command intake → validate → adjudicate
  (predictive kernel, §4)                              kernel.step() @ fixed tick
  interpolation/reconcile ◄── transport.recv ◄──────  keyframe (every N) + delta (per tick)
```

- **Upstream (client→server):** the same `command` envelopes, now carrying a real `source` and
  authenticated. The transport is responsible only for delivery + ordering hints; the kernel's
  `(tick, source, seq)` adjudication makes it robust to reordering and the `seq` field to dedup.
- **Downstream (server→client):** the existing `keyframe`/`delta`/`events`/`diag` messages.
  Keyframes are the periodic full resync; deltas are the per-tick stream. A joining client gets a
  keyframe then the delta stream — identical to how the client already boots from a Worker.

Nothing new in the protocol is *required*; the transport may add an outer envelope (ack numbers,
channel ids, compression) around these messages.

## 4. Client-side prediction & reconciliation (the FPS-phase work)

Latency hiding for the FPS use case, expressed entirely in existing primitives:

1. **Predict.** The client runs a *second, local* kernel instance (the "predictive world") seeded
   identically. Local commands apply to it immediately at the client's current tick, so input
   feels instant. This is just another `World` with the same setup — no special mode.
2. **Send + buffer.** The same commands go upstream and are retained locally, keyed by `seq`,
   until acknowledged.
3. **Reconcile on authority.** When an authoritative keyframe/delta arrives stamped tick `T`
   (carrying the highest `seq` it has executed per source), the client:
   a. restores the predictive world to the authoritative state at `T` — this is exactly
      `applyKeyframeTo(world, keyframe)`, the `ReplayPlayer.seek` mechanism;
   b. re-applies its still-unacknowledged commands (those with `seq` &gt; the acked `seq`) and
      `stepN`s back up to the client's current tick.
   Because the kernel is deterministic and `applyDelta`/`applyKeyframeTo`/command replay are the
   same code the `ReplayPlayer` already uses and tests, the predicted state converges to the
   authoritative one with no special reconciliation engine — **the scrubber *is* the reconciler.**
4. **Smooth.** Visual error after reconciliation is blended out over a few frames in the client
   (the interpolation layer already owns visual smoothing); the `teleport` transform flag
   ([05 §2.3](05-client-design.md)) suppresses interpolation when a correction is large.

Server-side **lag compensation** (rewind-for-hit-detection) uses the keyframe history the engine
already records: the server seeks a recent keyframe (`ReplayPlayer`-style) to the shooter's
reported tick, tests the hit there, then resumes. No new mechanism.

## 5. What changes, and what does not

**Does not change:** the kernel, the schema/wire formats, the command/snapshot/delta machinery,
the ECS, determinism, the client interpolation buffer. These were designed for this and are
tested.

**New code (additive):**

- A transport package implementing `MessageLink` over WebRTC data channels (P2P/listen-server)
  or WebSocket (dedicated server), plus an outer envelope for acks/channels.
- A thin **prediction/reconciliation client** wrapping the existing client + a predictive
  `World` (§4) — small, because it composes `applyKeyframeTo` + command replay.
- Session/connection management (join → send keyframe → stream deltas), authentication, and
  interest management. The advisory throttled `view.report` command ([05 §3.1](05-client-design.md))
  already exists as the interest-management input.

**One existing knob flips:** `lateCommands` moves from `rewrite` (single-player friendliness) to
`reject` for strict lockstep modes ([04 §3.3](04-kernel-design.md)) — already a per-world option.

## 6. Determinism requirements, by mode

- **Client prediction + server reconciliation (the common case):** needs only *single-platform*
  determinism — each client predicts and reconciles on its **own** machine against the server's
  snapshots; the server is the authority. This is exactly the strictness the engine guarantees
  and measures today.
- **Peer-to-peer lockstep (no central authority):** needs *cross-platform bit-determinism*. The
  engine is designed to keep that door open — `dmath` indirection + the lint ban on
  transcendental `Math.*` in kernel code ([04 §5.3](04-kernel-design.md)), string entity IDs,
  JSON snapshots, sfc32 RNG. It is **not** delivered: Rapier worlds are single-platform only
  ([09 R3](09-questions-and-risks.md)), and the transcendental approximations behind `dmath` are
  unwritten. Lockstep would additionally pin JS-engine math behavior. Flagged, contained, not
  foreclosed.

## 7. Open questions for the transport phase

1. **Delta compression / bandwidth.** Whole-component JSON deltas ([09 R10](09-questions-and-risks.md))
   are fine for single-player and small games but are the likely first bottleneck at RTS/FPS
   scale; binary packing behind the `Delta` interface is the planned escape hatch, and the
   network layer is where profiling will force it.
2. **Snapshot cadence vs. join latency.** Keyframe interval trades bandwidth against
   join/resync latency; per-world today, may want per-connection tuning.
3. **Interest management.** `view.report` exists as the input; the policy (what each client is
   sent) is transport-phase work — likely grid/cell-based culling reusing the
   `@bendyline/molen-pathfinding` grid utilities.
4. **Transport choice.** WebRTC (NAT traversal, P2P, listen-server) vs. WebSocket-to-dedicated;
   probably both, behind the one `MessageLink` interface.
5. **Tick rate vs. latency.** 30 Hz is the authoritative default; the FPS slice raises it to 60
   ([04 §2](04-kernel-design.md)) and is where prediction earns its keep. Per-world `tickRate`
   already supports this.

## 8. Validation summary

The premise holds against the built system: every multiplayer affordance is present and tested,
the reconciler is the already-tested scrubber, the transport is a `MessageLink`, and the only
existing knob that moves is `lateCommands`. The networking phase is therefore a transport package
plus a small prediction wrapper — additive, with no kernel or schema changes — exactly as the
architecture intended.
