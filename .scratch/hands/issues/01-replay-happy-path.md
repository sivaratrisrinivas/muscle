# 01: Replay the happy path

**What to build:** A reviewer can start the hostile credit-union surface and replay a handwritten get-savings-balance capability against it. Fill member ID, search, read the savings amount, checkpoint holds, result is success with a balance. Acts stay on the mock origin.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The mock serves a lookup flow with nested tables, no test IDs, and an Open sub-account button that does not open a form
- [ ] Replay of the handwritten capability with a known member returns success and a balance string
- [ ] Each step uses a locator chain of role-and-name, then visible text
- [ ] An act off the mock origin is refused
- [ ] A Hands.replay test at the public seam covers the happy path
