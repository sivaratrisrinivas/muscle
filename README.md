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
bun run replay --capability capabilities/get_savings_balance.v1.json --param memberId=12345 --inject <name>
```

Happy path prints success and `$2,450.00`. Off-origin acts are refused.

`--inject` names are `member_not_found` (business outcome), `session_timeout` (recoverable condition, dismissed inside the step), and `unexpected_dialog` (stuck). Stuck writes `intervention.json` and waits for Enter on the same page. A step aimed at Open sub-account is risky and pauses the same way. Human clicks do not become capability steps. Use `HEADED=1` if you want to see the window.

## Status

I have replay and discover. I do not have REPORT.md or evidence.

```bash
bun run discover --goal "Look up a member by ID and read the savings balance." --param memberId=12345
```

Discover talks to an OpenAI-compatible host (`LLM_BASE_URL`, `LLM_API_KEY`, `MODEL`). Default host is Cerebras. It writes `capabilities/get_savings_balance.v1.json` and a sibling transcript. The capability keeps param names, not the live member ID.

Spec: https://github.com/sivaratrisrinivas/muscle/issues/1
