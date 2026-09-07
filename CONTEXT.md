# Hands

The layer that operates a back-office UI with no API. A model discovers a flow once. After that, production invokes a capability.

## Language

**Capability**:
A versioned, invocable artifact. It holds a contract, steps, locators, and a checkpoint.
_Avoid_: Recording, script, transcript, workflow, macro

**Discovery run**:
A live UI run with an LLM in the decide step. Its product is a capability, not a saved chat.
_Avoid_: Training, computer-use session (when you mean this)

**Replay**:
Running a capability with parameters. No LLM decisions.
_Avoid_: Playback, rerun (when you mean this path)

**Checkpoint**:
A condition you assert on the surface to prove you reached the expected state.
_Avoid_: Success flag, assumed click

**Business outcome**:
A legitimate caller-facing result from the app, such as member not found. Not a crash.
_Avoid_: Soft error, expected error, application error (when you mean this)

**Surface**:
The UI channel we perceive and act on. This slice implements one hostile web mock.
_Avoid_: App, site, target (when you mean the channel)

**Escalation**:
Automation pauses. A human uses the same live session, then hands control back.
_Avoid_: Takeover, HITL

**Allowlist**:
The explicit permitted targets and action types. Anything else is blocked.
_Avoid_: Guardrail (broader), denylist

**Locator**:
How a step names the control it will act on.
_Avoid_: Selector (when you mean the strategy), test ID

**Locator chain**:
Ordered attempts to find a control: role and name, then visible text, then structure. Replay walks the chain. It does not aim by pixels.
_Avoid_: CSS path, coordinates, single xpath

**Recoverable condition**:
A mid-run state we handle and then continue, such as a known timeout interstitial. Not a terminal result.
_Avoid_: Soft failure, business outcome (when you mean this)

**Stuck**:
The run cannot take the next step safely. An escalation reason.
_Avoid_: Error, failed (when you mean this)

**Risky action**:
An action that can proceed but needs a person first. On this mock, submitting open-sub-account.
_Avoid_: Dangerous, irreversible (unless it truly cannot be undone)

**Tenant**:
One customer institution.
_Avoid_: Customer, bank, client (when you mean this)
