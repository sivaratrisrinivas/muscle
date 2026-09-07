# Muscle

Hands for a Core Connect staff screen with no API. A model discovers get-savings-balance once. Replay runs that capability with no model.

This is an interface.ai take-home. It is not a bank product.

## Setup

Bun and Playwright Chromium.

```bash
bun install
bunx playwright install chromium
bun test
```

Discovery needs `LLM_API_KEY`. Put it in `.env` at the repo root. Git ignores that file. `LLM_BASE_URL` and `MODEL` default to Cerebras at `https://api.cerebras.ai/v1` and `gpt-oss-120b`.

## Mock

`bun run mock` serves http://127.0.0.1:47821. Nested tables, no test IDs. Known member is `12345`. Savings is `$2,450.00`. Open sub-account is a button with no form.

## Discover

```bash
bun run mock
bun run discover --goal "Look up a member by ID and read the savings balance." --param memberId=12345
```

The model only decides. Playwright acts. A successful run writes `capabilities/get_savings_balance.v1.json`. The chat sits in `capabilities/get_savings_balance.v1.transcript.json`. The capability keeps param names, not the live member ID.

## Replay

```bash
bun run replay --capability capabilities/get_savings_balance.v1.json --param memberId=12345
```

That prints success and `$2,450.00`. Off-origin acts are refused.

```bash
bun run replay --capability capabilities/get_savings_balance.v1.json --param memberId=12345 --inject member_not_found
bun run replay --capability capabilities/get_savings_balance.v1.json --param memberId=12345 --inject session_timeout
bun run replay --capability capabilities/get_savings_balance.v1.json --param memberId=12345 --inject unexpected_dialog
```

`member_not_found` returns business outcome `member_not_found`. `session_timeout` is a recoverable condition, dismissed inside the step. `unexpected_dialog` is stuck. Stuck writes `intervention.json` and waits for Enter on the same page. A step aimed at Open sub-account is risky and pauses the same way. Human clicks do not become capability steps.

`HEADED=1` shows the window.

Committed runs live in `evidence/`. The write-up is `REPORT.md`. Spec is https://github.com/sivaratrisrinivas/muscle/issues/1
