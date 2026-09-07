Status: ready-for-agent

# Hands: get savings balance

## Problem Statement

I need a hiring work sample that shows how an agent gets work done on a back-office UI with no API. Reviewers will run a discovery run against a live surface, then invoke the resulting capability by replay, including a business outcome, a recoverable condition, and an escalation on the same live session. They will not accept a description of discovery. They will not reward a second product flow or scaling infra.

## Solution

I get one Hands system. A local hostile credit-union surface stands in for a core. I run discovery with a Cerebras model that only decides; Playwright acts. A successful run writes a versioned capability for get savings balance. Replay runs that capability with parameters and no LLM. Results are success, business outcome, or failure. Stuck or a risky action pauses on the same headed page until I press Enter. Evidence and a short REPORT travel with the repo.

## User Stories

1. As a reviewer, I want to start a local mock with one command, so that I can exercise Hands without a real institution.
2. As a reviewer, I want the mock to look like a hostile core (nested tables, no test IDs, non-semantic markup), so that locators are not a clean-DOM cheat.
3. As a reviewer, I want to look up a member by ID on that surface, so that the happy path is a real multi-step UI flow.
4. As a reviewer, I want to read a savings balance after lookup, so that the capability has a typed output.
5. As a staff operator, I want member-not-found to show on the surface, so that replay can return a business outcome instead of crashing.
6. As a staff operator, I want a session-timeout interstitial I can dismiss, so that a recoverable condition is real.
7. As a staff operator, I want an unexpected dialog I cannot treat as known, so that the run can become stuck.
8. As a safety reviewer, I want an Open sub-account button on the member page that does not open a second flow, so that a risky action has a real target.
9. As a calling agent, I want to pass a natural-language goal and a target, so that discovery has something to accomplish.
10. As a calling agent, I want discovery to receive a fresh accessibility snapshot every turn, so that the model cannot forget to look.
11. As a calling agent, I want the model limited to act, finish, and escalate, so that the decide loop stays small.
12. As a calling agent, I want act limited to click, fill, read, and navigate, so that the surface contract is obvious.
13. As a safety reviewer, I want every act checked against an allowlist of origin and action types, so that off-origin work is refused.
14. As a safety reviewer, I want a step aimed at Open sub-account to escalate, so that a risky action is never taken automatically.
15. As a calling agent, I want discovery to stop when finish succeeds and the checkpoint holds, so that we do not wander.
16. As a calling agent, I want discovery to stop at 25 steps, 3 minutes, or three identical snapshots, so that a dead-end ends.
17. As a calling agent, I want a successful discovery run to write a capability, so that production can invoke the flow later.
18. As a reviewer, I want that capability to be readable JSON, so that I can see params, outputs, steps, locators, and the checkpoint without a transcript.
19. As a calling agent, I want params referenced by name only, so that a member ID used during discovery is not baked into the capability.
20. As a calling agent, I want replay to take the capability and params and never call the model, so that production is deterministic.
21. As a calling agent, I want each replay step to walk a locator chain (role and name, then visible text), so that replay does not aim by pixels or table index.
22. As a calling agent, I want a known timeout interstitial dismissed and the step retried, so that a recoverable condition is not a terminal result.
23. As a calling agent, I want a missing member to return business_outcome member_not_found, so that I can tell a legitimate app result from a crash.
24. As a calling agent, I want success to include the balance string when the checkpoint holds, so that I get the output I asked for.
25. As a calling agent, I want failure to name the step, what was expected, and what was observed, so that I can debug.
26. As a reviewer, I want the checkpoint to be a money-shaped amount next to Savings, so that we do not treat a click as success.
27. As an operator, I want stuck (unknown dialog, dead chain, failed checkpoint, cap) to pause on the same headed session, so that I can finish the page myself.
28. As an operator, I want intervention.json written with goal, step, reason, and a screenshot path, so that I know why it stopped.
29. As an operator, I want to click in the headed window and press Enter to resume, so that handoff is real without a console.
30. As a reviewer, I want owner flips logged, so that evidence shows who had control.
31. As a calling agent, I want human clicks left out of the capability, so that a rescue does not silently rewrite the contract.
32. As a reviewer, I want evidence for a happy discovery and replay, so that I can see a genuine LLM run happened.
33. As a reviewer, I want evidence for a member_not_found replay, so that the business outcome is visible.
34. As a reviewer, I want evidence for a session_timeout replay that still succeeds, so that recoverable is visible.
35. As a reviewer, I want evidence for an escalation (unexpected dialog), so that the live-session handoff is visible.
36. As a reviewer, I want the discovery transcript kept out of the capability file, so that I review a contract, not a chat.
37. As a reviewer, I want failure screenshots, so that a broken step is inspectable.
38. As a submitter, I want README commands that match the demo spine, so that a reviewer can run discover then replay without guessing.
39. As a submitter, I want REPORT.md with the seven required headings, so that the write-up is judged side by side with others.
40. As a submitter, I want secrets only in env (LLM_BASE_URL, LLM_API_KEY, MODEL), so that the repo stays clean.
41. As a caller with TensorMux credits, I want the same client pointed at another base URL, so that I am not stuck on one host.
42. As a future designer, I want the REPORT to say a capability binds to a vendor app and version, so that tenant reuse is a story without a second mock.

## Implementation Decisions

- One process on Bun and TypeScript. Folders, not packages. No queues.
- One module is Hands. Its interface is discover (goal, params, target) and replay (capability, params, optional inject). That is the seam.
- Behind the seam: a Playwright adapter on the surface, an OpenAI-compatible LLM adapter, an allowlist, and an escalation pause that waits on stdin Enter.
- Tests may swap the LLM adapter for a scripted one. They do not invent a second Hands interface.
- The mock is the surface, not a Hands adapter. It is a small local web app we own.
- Capability shape: name, integer version, description, params, outputs, steps (id, action, locator chain, fromParam or into), checkpoint, businessOutcomes. File name follows name plus version.
- Actions: click, fill, read, navigate. Locator chain length two.
- Allowlist: mock origin plus those action types. No path prefixes.
- Replay result: success with outputs, business_outcome with a code, or failure with step/expected/observed. Recoverable stays inside a step.
- Discovery tools: act, finish, escalate. Each turn includes a fresh accessibility snapshot. Screenshots are evidence, not model input.
- Default LLM: Cerebras Chat Completions, model gpt-oss-120b. Env supplies base URL, key, and model.
- Escalation owner: automation or human. Same headed page. intervention.json plus log lines. No resume command. No keystroke tape.
- Injectors on the mock: member_not_found, session_timeout, unexpected_dialog. No validation, permission, slow-load, or frameset.
- Open sub-account is a button only. No form. Targeting it is a risky action.
- ADRs 0001–0008 stand. Do not relitigate them in code.

## Testing Decisions

A good test exercises Hands through discover or replay and checks a result, a file a reviewer would read, or an owner flip. It does not assert on Playwright internals, prompt strings, or CSS.

Seam (one): Hands.discover and Hands.replay against the live mock.

- Replay with a fixture capability and a known member → success and a balance string.
- Replay with inject member_not_found → business_outcome member_not_found.
- Replay with inject session_timeout → success after the interstitial is gone.
- Replay or discover with inject unexpected_dialog → intervention.json present, owner human, process waiting (test adapter presses Enter after asserting the file).
- Discover with a scripted LLM that performs the happy acts → capability written, no transcript fields inside it, transcript file exists beside it.
- Act off-origin → refused, no navigation.
- Act on Open sub-account → escalation, not a click through.

There is no prior test suite. These are the first tests. Prefer few tests at this seam over a pile of locator unit tests.

## Out of Scope

- A second capability or open-sub-account form
- Operator web console, `bun run resume`, compiling human clicks
- Desktop surface, multi-tenant runtime, queues, real bank, real PII
- Framesets, structural locators, screenshot-to-model, observe tool
- Draft/approved capability states, assisted LLM replay fallback
- Implementing vendor-app overlays (REPORT only)
- Stretch goals

## Further Notes

Assignment deliverables stay at README.md, REPORT.md (seven headings only), and evidence/. Demo commands are the ones in the shared understanding. Next skill is /to-tickets, then /implement per ticket.
