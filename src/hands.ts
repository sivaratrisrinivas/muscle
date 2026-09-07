import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { actionAllowed, loadAllowlist, originAllowed, resolveActUrl } from "./allowlist.ts";
import { escalate, setOwner, stepAimsAtRisky, unexpectedDialogPresent } from "./escalate.ts";
import { envLlm } from "./llm.ts";
import { actTargetUrl, dismissTimeoutIfPresent, locate, moneyBeside, readMoneyNextTo } from "./surface.ts";
import type {
  ActCall,
  Allowlist,
  Capability,
  DiscoverOptions,
  DiscoverResult,
  LocatorChain,
  ReplayOptions,
  ReplayParams,
  ReplayResult,
  Step,
} from "./types.ts";

const STEP_CAP = 25;
const TIME_CAP_MS = 3 * 60 * 1000;

type Handoff = { stuck: boolean; escalated: boolean };

type TranscriptTurn = {
  snapshot: string;
  tool: string;
  args?: unknown;
  result: string;
};

export const Hands = {
  async discover(
    goal: string,
    params: ReplayParams,
    target: string,
    options: DiscoverOptions = {},
  ): Promise<DiscoverResult> {
    const allowlist = await loadAllowlist();
    const evidenceDir = options.evidenceDir ?? process.env.EVIDENCE_DIR ?? join(tmpdir(), "hands-evidence", String(Date.now()));
    const capabilityDir = options.capabilityDir ?? join(process.cwd(), "capabilities");
    const owners: string[] = [];
    const handoff: Handoff = { stuck: false, escalated: false };
    const llm = options.llm ?? envLlm();
    await mkdir(evidenceDir, { recursive: true });
    await mkdir(capabilityDir, { recursive: true });
    await setOwner(owners, evidenceDir, "automation");
    const browser = await chromium.launch({
      headless: process.env.HEADED !== "1",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const started = Date.now();
    const turns: TranscriptTurn[] = [];
    const steps: Step[] = [];
    try {
      const page = await browser.newPage();
      const baseOrigin = allowlist.origins[0];
      if (!baseOrigin) {
        return { kind: "stopped", reason: "failed_checkpoint" };
      }
      const targetUrl = new URL(target, `${baseOrigin}/`);
      if (!originAllowed(allowlist, targetUrl)) {
        throw new Error(`target origin ${targetUrl.origin} is not allowlisted`);
      }
      if (options.inject) {
        await page.context().addCookies([
          { name: "inject", value: options.inject, url: `${baseOrigin}/` },
        ]);
      }

      const open: Step = { id: "open_lookup", action: "navigate", url: targetUrl.pathname || "/" };
      const outcomes = ["member_not_found"];
      const opened = await runStep(page, open, params, {}, allowlist, baseOrigin, goal, outcomes, evidenceDir, options.waitForResume, owners, handoff);
      if (handoff.escalated) {
        return { kind: "stopped", reason: "escalate" };
      }
      if (opened?.kind === "failure") {
        return { kind: "stopped", reason: "failed_checkpoint" };
      }
      steps.push(open);

      const snapshots: string[] = [];
      const outputs: Record<string, string> = {};
      for (let turn = 0; turn < STEP_CAP; turn++) {
        if (Date.now() - started > TIME_CAP_MS) {
          return { kind: "stopped", reason: "time_cap" };
        }
        const snapshot = await a11ySnapshot(page);
        snapshots.push(snapshot);
        if (identicalTail(snapshots, 3)) {
          return { kind: "stopped", reason: "identical_snapshots" };
        }

        const tool = await llm.nextTool({ goal, params, snapshot });
        if (tool.name === "escalate") {
          turns.push({ snapshot, tool: "escalate", args: { reason: tool.reason }, result: "escalated" });
          await escalate(page, evidenceDir, {
            goal,
            step: steps.at(-1)?.id ?? "discover",
            reason: tool.reason ?? "escalate",
            screenshot: "intervention.png",
          }, owners, options.waitForResume);
          return { kind: "stopped", reason: "escalate" };
        }
        if (tool.name === "finish") {
          const money = await readMoneyNextTo(page, "Savings");
          if (!money) {
            turns.push({ snapshot, tool: "finish", result: "checkpoint failed" });
            await snapshotPage(page, evidenceDir, "failure.png");
            return { kind: "stopped", reason: "failed_checkpoint" };
          }
          const capability = compileCapability(goal, params, steps);
          const path = join(capabilityDir, `${capability.name}.v${capability.version}.json`);
          const transcriptPath = join(capabilityDir, `${capability.name}.v${capability.version}.transcript.json`);
          turns.push({ snapshot, tool: "finish", result: money });
          await Bun.write(path, `${JSON.stringify(capability, null, 2)}\n`);
          await Bun.write(transcriptPath, `${JSON.stringify({ goal, turns }, null, 2)}\n`);
          await snapshotPage(page, evidenceDir, "final.png");
          return { kind: "capability", capability, path, transcriptPath };
        }

        const compiled = compileAct(tool, params, steps.length);
        if ("error" in compiled) {
          turns.push({ snapshot, tool: "act", args: tool, result: compiled.error });
          continue;
        }
        const finished = await runStep(page, compiled, params, outputs, allowlist, baseOrigin, goal, outcomes, evidenceDir, options.waitForResume, owners, handoff);
        if (handoff.escalated) {
          turns.push({ snapshot, tool: "act", args: tool, result: "escalated" });
          return { kind: "stopped", reason: "escalate" };
        }
        if (finished?.kind === "failure") {
          turns.push({ snapshot, tool: "act", args: tool, result: `${finished.expected} / ${finished.observed}` });
          continue;
        }
        if (finished?.kind === "business_outcome") {
          turns.push({ snapshot, tool: "act", args: tool, result: finished.code });
          continue;
        }
        if (!duplicateNavigate(steps, compiled)) {
          steps.push(compiled);
        }
        turns.push({ snapshot, tool: "act", args: tool, result: "ok" });
      }
      return { kind: "stopped", reason: "step_cap" };
    } finally {
      await browser.close();
    }
  },

  async replay(capability: Capability, params: ReplayParams, options: ReplayOptions = {}): Promise<ReplayResult> {
    const allowlist = await loadAllowlist();
    const evidenceDir = options.evidenceDir ?? process.env.EVIDENCE_DIR ?? join(tmpdir(), "hands-evidence", String(Date.now()));
    const owners: string[] = [];
    const handoff: Handoff = { stuck: false, escalated: false };
    await mkdir(evidenceDir, { recursive: true });
    await setOwner(owners, evidenceDir, "automation");
    const browser = await chromium.launch({
      headless: process.env.HEADED !== "1",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    let page: Page | undefined;
    try {
      page = await browser.newPage();
      const outputs: Record<string, string> = {};
      const baseOrigin = allowlist.origins[0];
      if (!baseOrigin) {
        return fail("start", "an allowlisted origin", "none");
      }
      if (options.inject) {
        await page.context().addCookies([
          { name: "inject", value: options.inject, url: `${baseOrigin}/` },
        ]);
      }

      for (const step of capability.steps) {
        const finished = await runStep(page, step, params, outputs, allowlist, baseOrigin, capability.description, capability.businessOutcomes, evidenceDir, options.waitForResume, owners, handoff);
        if (finished) {
          if (finished.kind === "failure") {
            await snapshotPage(page, evidenceDir, "failure.png");
          } else {
            await snapshotPage(page, evidenceDir, "final.png");
          }
          return finished;
        }
      }

      const outcome = await businessOutcome(page, capability.businessOutcomes);
      if (outcome) {
        await snapshotPage(page, evidenceDir, "final.png");
        return outcome;
      }

      const money = await readMoneyNextTo(page, capability.checkpoint.label);
      if (!money) {
        await snapshotPage(page, evidenceDir, "failure.png");
        return fail(
          "checkpoint",
          `a money-shaped amount next to ${capability.checkpoint.label}`,
          await pageText(page),
        );
      }
      const read = outputs.balance;
      if (read && read !== money) {
        await snapshotPage(page, evidenceDir, "failure.png");
        return fail("checkpoint", money, read);
      }
      outputs.balance = money;
      await snapshotPage(page, evidenceDir, "final.png");
      return { kind: "success", outputs };
    } finally {
      await browser.close();
    }
  },
};

async function runStep(
  page: Page,
  step: Step,
  params: ReplayParams,
  outputs: Record<string, string>,
  allowlist: Allowlist,
  baseOrigin: string,
  goal: string,
  businessOutcomes: string[],
  evidenceDir: string,
  waitForResume: ReplayOptions["waitForResume"],
  owners: string[],
  handoff: Handoff,
): Promise<ReplayResult | undefined> {
  if (!actionAllowed(allowlist, step.action)) {
    return fail(step.id, `an allowlisted action (${allowlist.actions.join(", ")})`, step.action);
  }

  if (step.action === "navigate") {
    const target = resolveActUrl(step.url, baseOrigin, page.url());
    if (!originAllowed(allowlist, target)) {
      return fail(
        step.id,
        `origin ${allowlist.origins.join(" or ")}`,
        `${target.origin} (did not navigate)`,
      );
    }
    await page.goto(target.toString(), { waitUntil: "domcontentloaded" });
    await dismissTimeoutIfPresent(page);
    const stuckAfterGo = await handleStuck(page, step, goal, evidenceDir, waitForResume, owners, handoff);
    if (stuckAfterGo) {
      return stuckAfterGo;
    }
    return await businessOutcome(page, businessOutcomes);
  }

  await dismissTimeoutIfPresent(page);
  const stuck = await handleStuck(page, step, goal, evidenceDir, waitForResume, owners, handoff);
  if (stuck) {
    return stuck;
  }

  const here = page.url() === "about:blank" ? undefined : new URL(page.url());
  if (here && !originAllowed(allowlist, here)) {
    return fail(step.id, `origin ${allowlist.origins.join(" or ")}`, here.origin);
  }

  if (stepAimsAtRisky(step)) {
    handoff.escalated = true;
    await escalate(page, evidenceDir, {
      goal,
      step: step.id,
      reason: "risky: Open sub-account",
      screenshot: "intervention.png",
    }, owners, waitForResume);
    return undefined;
  }

  const found = await locate(page, step.locators, step.action);
  if ("missed" in found) {
    return (await businessOutcome(page, businessOutcomes)) ?? fail(step.id, found.missed, await pageText(page));
  }

  if (step.action === "fill") {
    const value = params[step.fromParam];
    if (value === undefined) {
      return fail(step.id, `param ${step.fromParam}`, "missing");
    }
    await found.locator.fill(value);
    return undefined;
  }

  if (step.action === "click") {
    const leaving = await actTargetUrl(found.locator, page.url());
    if (leaving && !originAllowed(allowlist, leaving)) {
      return fail(
        step.id,
        `origin ${allowlist.origins.join(" or ")}`,
        `${leaving.origin} (did not navigate)`,
      );
    }
    await found.locator.click();
    await page.waitForLoadState("domcontentloaded");
    await dismissTimeoutIfPresent(page);
    const stuckAfterClick = await handleStuck(page, step, goal, evidenceDir, waitForResume, owners, handoff);
    if (stuckAfterClick) {
      return stuckAfterClick;
    }
    const after = new URL(page.url());
    if (!originAllowed(allowlist, after)) {
      return fail(step.id, `origin ${allowlist.origins.join(" or ")}`, after.origin);
    }
    return await businessOutcome(page, businessOutcomes);
  }

  const money = await moneyBeside(found.locator);
  if (!money) {
    return fail(step.id, "a money-shaped amount next to the located control", (await found.locator.innerText()).trim());
  }
  outputs[step.into] = money;
  return undefined;
}

async function handleStuck(
  page: Page,
  step: Step,
  goal: string,
  evidenceDir: string,
  waitForResume: ReplayOptions["waitForResume"],
  owners: string[],
  handoff: Handoff,
): Promise<ReplayResult | undefined> {
  if (!(await unexpectedDialogPresent(page)) || handoff.stuck) {
    return undefined;
  }
  handoff.stuck = true;
  handoff.escalated = true;
  await escalate(page, evidenceDir, {
    goal,
    step: step.id,
    reason: "stuck: unexpected dialog",
    screenshot: "intervention.png",
  }, owners, waitForResume);
  return undefined;
}

async function businessOutcome(page: Page, businessOutcomes: string[]): Promise<ReplayResult | undefined> {
  if (!businessOutcomes.includes("member_not_found")) {
    return undefined;
  }
  const notice = page.getByText("Member not found", { exact: true });
  if ((await notice.count()) > 0 && (await notice.first().isVisible())) {
    return { kind: "business_outcome", code: "member_not_found" };
  }
  return undefined;
}

function fail(step: string, expected: string, observed: string): ReplayResult {
  return { kind: "failure", step, expected, observed };
}

async function pageText(page: Page): Promise<string> {
  return page.evaluate("document.body.innerText");
}

async function snapshotPage(page: Page, dir: string, name: string) {
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: join(dir, name), fullPage: true });
}

async function a11ySnapshot(page: Page): Promise<string> {
  return page.locator("body").ariaSnapshot();
}

function identicalTail(snapshots: string[], count: number): boolean {
  if (snapshots.length < count) {
    return false;
  }
  const tail = snapshots.slice(-count);
  return tail.every((item) => item === tail[0]);
}

function compileCapability(goal: string, params: ReplayParams, steps: Step[]): Capability {
  return {
    name: "get_savings_balance",
    version: 1,
    vendorApp: "Core Connect",
    vendorVersion: "4.2",
    description: goal,
    params: Object.keys(params).map((name) => ({ name })),
    outputs: [{ name: "balance" }],
    steps,
    checkpoint: { kind: "money_next_to", label: "Savings" },
    businessOutcomes: ["member_not_found"],
  };
}

function compileAct(call: ActCall, params: ReplayParams, index: number): Step | { error: string } {
  if (call.action === "navigate") {
    return { id: "open_lookup", action: "navigate", url: call.url ?? "/" };
  }
  const locators = resolveChain(call);
  if (!locators) {
    return { error: "act needs a locator chain of role and name, then visible text" };
  }
  if (call.action === "fill") {
    const fromParam = call.fromParam ?? soleParam(params);
    if (!fromParam || params[fromParam] === undefined) {
      return { error: "fill needs fromParam" };
    }
    return { id: `fill_${fromParam}`, action: "fill", fromParam, locators };
  }
  if (call.action === "click") {
    return { id: clickId(locators, index), action: "click", locators };
  }
  const into = call.into ?? "balance";
  return { id: `read_${into}`, action: "read", into, locators };
}

function resolveChain(call: ActCall): LocatorChain | undefined {
  const first = call.locators?.[0];
  const second = call.locators?.[1];
  if (first && second) {
    return [first, second];
  }
  if (first?.by === "role_name") {
    return [first, { by: "visible_text", text: first.name }];
  }
  return undefined;
}

function soleParam(params: ReplayParams): string | undefined {
  const names = Object.keys(params);
  return names.length === 1 ? names[0] : undefined;
}

function clickId(locators: LocatorChain, index: number): string {
  const slug = locators[0].name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return slug || `click_${index}`;
}

function duplicateNavigate(steps: Step[], step: Step): boolean {
  return step.action === "navigate" && steps.some((existing) => existing.action === "navigate" && existing.url === step.url);
}
