# Matt Pocock / AI Hero skills

This repo has [Matt Pocock’s agent skills](https://www.aihero.dev/skills) installed for Cursor.

They live in [`.cursor/skills/`](.cursor/skills/) — Cursor’s project skill folder. In a **local Agent chat** (Editor, not a Cloud Agent follow-up), type `/` to run them. You can also just ask (for example: “grill me about this idea”).

Cloud Agent follow-up chats often omit project skills from the `/` menu. That is a Cursor UI limitation, not a missing install. Start a new local Agent chat on this repo, or say the skill name in plain language.

## First thing to run

Once, before the engineering skills write tickets or docs:

```
/setup-matt-pocock-skills
```

That asks where issues live (GitHub, GitLab, or local markdown), which triage labels to use, and where domain docs go.

## Main flow (idea → ship)

1. `/grill-with-docs` — interview that also builds `CONTEXT.md` and ADRs
2. `/to-spec` then `/to-tickets` for work that won’t fit in one session
3. `/implement` — builds via `/tdd`, then `/code-review`

Not sure which skill? `/ask-matt`.

## Featured skills

| Skill | What it does |
| --- | --- |
| `/grill-me` | Relentless interview. Stateless; no repo docs. |
| `/grill-with-docs` | Same interview, plus glossary and ADRs. |
| `/domain-modeling` | Sharpen project language in `CONTEXT.md`. |
| `/tdd` | Red-green-refactor, one slice at a time. |
| `/triage` | Move incoming issues through triage roles. |
| `/wayfinder` | Map a multi-session effort as decision tickets. |
| `/handoff` | Compact this chat for another agent. |
| `/wait-what` | Re-pitch the last message in plain English. |
| `/diagnosing-bugs` | Tight feedback loop before theorizing. |
| `/improve-codebase-architecture` | Find deepening opportunities. |

All 37 installed skills are listed by `npx skills list`.

## Update

```bash
npx skills update
```

Source: [github.com/mattpocock/skills](https://github.com/mattpocock/skills).
