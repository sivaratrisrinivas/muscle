# Muscle

Hands for a Core Connect staff screen that has no API. A model will discover get-savings-balance once. After that, replay runs the capability with no model.

Not a bank product. interface.ai take-home.

## Run

Bun and Playwright Chromium.

```bash
bun install
bunx playwright install chromium
bun test
```

`bun run mock` serves http://127.0.0.1:47821. Nested tables, no test IDs. Member `12345` is real. Open sub-account is a button. It does not open a form.

```bash
bun run replay --capability capabilities/get_savings_balance.v1.json --param memberId=12345
```

That prints success and `$2,450.00`. Off-origin acts are refused.

## Status

Replay of a handwritten capability is in. Still missing: member-not-found and session-timeout, escalation on the same headed page, discover, then REPORT.md and evidence.

Spec: https://github.com/sivaratrisrinivas/muscle/issues/1
