# 03: Escalate on the live session

**What to build:** When the run is stuck or aimed at a risky action, automation pauses on the same headed page. A human can click there and press Enter to resume. Evidence shows why it stopped and who had control. Human clicks do not become capability steps.

**Blocked by:** 01 Replay the happy path

**Status:** ready-for-agent

- [ ] An unexpected dialog makes the run stuck and writes an intervention with goal, step, reason, and a screenshot path
- [ ] A step aimed at Open sub-account is treated as a risky action and pauses the same way
- [ ] Owner flips from automation to human and back after Enter
- [ ] A test at the Hands seam asserts the intervention, then resumes without a real person
