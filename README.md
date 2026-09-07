# Muscle

Hands for a hostile credit-union UI: discover a get-savings-balance capability once, then replay it without the model.

This is a hiring work sample, not a bank product. Implementation is not in the tree yet. The spec and tickets live as GitHub issues.

## Issues

| Issue | What |
| --- | --- |
| [#1](https://github.com/sivaratrisrinivas/muscle/issues/1) | Spec: Hands / get savings balance |
| [#2](https://github.com/sivaratrisrinivas/muscle/issues/2) | Replay the happy path (start here) |
| [#3](https://github.com/sivaratrisrinivas/muscle/issues/3) | Replay not-found and timeout |
| [#4](https://github.com/sivaratrisrinivas/muscle/issues/4) | Escalate on the live session |
| [#5](https://github.com/sivaratrisrinivas/muscle/issues/5) | Discover the capability |
| [#6](https://github.com/sivaratrisrinivas/muscle/issues/6) | Ship the demo pack |

Frontier: **#2**. Then #3, #4, and #5 in parallel. Then #6.

Language is in [`CONTEXT.md`](CONTEXT.md). Locked calls are in [`docs/adr/`](docs/adr/).

## What will ship

One Bun process. One Hands seam: `discover` and `replay`. A local mock is the surface. Replay uses a locator chain (role and name, then visible text). Discovery talks to an OpenAI-compatible host (Cerebras by default). Stuck or a risky action pauses on the same headed page until Enter.

Reviewer deliverables land in #6: this README with demo commands, `REPORT.md` (seven required headings), and `evidence/`.

## Agent skills

Matt Pocock / AI Hero skills are in [`.cursor/skills/`](.cursor/skills/). In a local Agent chat, type `/` or name the skill. Cloud Agent follow-ups often hide that menu; say the skill name.

Issue tracking is GitHub on this repo. See `AGENTS.md`.
