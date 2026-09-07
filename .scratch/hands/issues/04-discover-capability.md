# 04: Discover the capability

**What to build:** A caller can pass a goal and params and get a versioned get-savings-balance capability from a live discovery run. The model only decides. Each turn it is given a fresh accessibility snapshot. Tools are act, finish, and escalate. The capability holds param names, not live values, and no transcript.

**Blocked by:** 01 Replay the happy path

**Status:** ready-for-agent

- [ ] Discover with a scripted LLM writes a capability that Hands.replay can run to success
- [ ] The capability has no transcript, messages, or discovery-time member ID
- [ ] A transcript exists beside the capability, not inside it
- [ ] Real discover talks to an OpenAI-compatible host via env (Cerebras by default)
- [ ] Discovery stops on finish-plus-checkpoint, escalate, 25 steps, 3 minutes, or three identical snapshots
