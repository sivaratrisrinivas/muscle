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

`bun run mock` serves http://127.0.0.1:47821. Nested tables, no test IDs. Known member is `12345`. Open sub-account is a button. It does not open a form.

```bash
bun run replay --capability capabilities/get_savings_balance.v1.json --param memberId=12345
```

That prints success and `$2,450.00`. Off-origin acts are refused.

A missing member is a business outcome, not a crash.

```bash
bun run replay --capability capabilities/get_savings_balance.v1.json --param memberId=12345 --inject member_not_found
```

A session-timeout interstitial is a recoverable condition. Dismiss it and the same replay can still succeed.

```bash
bun run replay --capability capabilities/get_savings_balance.v1.json --param memberId=12345 --inject session_timeout
```

An unexpected dialog is stuck. Replay writes `intervention.json`, flips owner to human, and waits for Enter on the same page. Open sub-account is a risky action and pauses the same way. Human clicks do not become capability steps.

```bash
HEADED=1 bun run replay --capability capabilities/get_savings_balance.v1.json --param memberId=12345 --inject unexpected_dialog
```

## Status

I have replay, including escalation. I do not have discover, REPORT.md, or evidence.

Spec: https://github.com/sivaratrisrinivas/muscle/issues/1
