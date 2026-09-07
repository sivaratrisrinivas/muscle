# Architecture

One Bun process. Folders, not packages. Hands is the only module a caller sees: discover and replay.

Discover takes a goal, params, and a URL. A Cerebras model decides. Playwright acts. Each turn the model gets a fresh accessibility snapshot. Tools are act, finish, and escalate.

Replay takes the capability and params. No model. The mock at http://127.0.0.1:47821 is the surface, not a Hands adapter.

# Artifact schema

`get_savings_balance.v1.json` holds name, integer version, vendorApp, vendorVersion, description, params, outputs, steps, checkpoint, and businessOutcomes.

A step is navigate, fill, click, or read. Fill names a param. Read names an output. Click and fill walk a locator chain: role and name, then visible text.

The checkpoint is a money-shaped amount next to Savings. The chat is a sibling file. It is not inside the capability.

# Determinism & error handling

Replay never calls the model. Same capability and params should hit the same locators.

A run ends as success with outputs, business_outcome with a code, or failure with the step, what was expected, and what was observed. A known timeout interstitial is dismissed inside the step. That is not a fourth result kind.

If both locators miss, the step fails. We do not guess by cell index.

# Heterogeneity & multi-tenant

The capability binds to Core Connect 4.2, not to Harbor Credit Union. Hundreds of institutions run that vendor app. A tenant overlay would swap origin, a few labels, and optional locator overrides. Checkpoint failure is drift. We would escalate, not rewrite the file.

Overlays are a story in this report. They are not in the code.

# Escalation & handoff

Stuck and risky share one pause. The Playwright window stays up. We write intervention.json with the goal, step, reason, and a screenshot, then wait for Enter.

Clicks, fills, and the Enter resume during the pause go to human_actions.json. Owner flips go to owners.json and the log. Human clicks do not become steps.

After Enter, if the dialog is gone we continue the blocked step. If it is still there, that step fails.

Stuck on this mock is the unexpected dialog. Risky is a step aimed at Open sub-account. We never click that button. Discover keeps going after a stuck pause so the model can finish the goal. A model escalate tool still stops.

# Safety

The allowlist is the mock origin plus click, fill, read, and navigate. Off-origin work is refused before the page changes.

Secrets stay in LLM_BASE_URL, LLM_API_KEY, and MODEL. They are not in the repo.

This slice has no real institution and no real PII. The known member is a fixture.

# Cuts

No second capability. Open sub-account has no form.

No operator console, no resume command, no desktop surface, no queues, no multi-tenant runtime.

No framesets, no observe tool, no screenshot-to-model, no draft/approved gate, no assisted replay when a locator misses.

Vendor-app overlays stay on paper.
