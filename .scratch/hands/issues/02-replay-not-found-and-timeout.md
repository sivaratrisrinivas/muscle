# 02: Replay not-found and timeout

**What to build:** Replay distinguishes a missing member from a recoverable timeout. Member not found is a business outcome. A known session-timeout interstitial is dismissed and the step retried; if the rest holds, the result is still success. A hard miss still names the step, what was expected, and what was observed.

**Blocked by:** 01 Replay the happy path

**Status:** ready-for-agent

- [ ] Replay with member-not-found injected returns business_outcome member_not_found
- [ ] Replay with session-timeout injected dismisses the interstitial and can still return success
- [ ] A failure result includes step, expected, and observed
- [ ] Hands.replay tests at the public seam cover both injectors
