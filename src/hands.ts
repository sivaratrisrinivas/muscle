import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { actionAllowed, loadAllowlist, originAllowed, resolveActUrl } from "./allowlist.ts";
import { escalate, setOwner, stepAimsAtRisky, unexpectedDialogPresent } from "./escalate.ts";
import { actTargetUrl, dismissTimeoutIfPresent, locate, moneyBeside, readMoneyNextTo } from "./surface.ts";
import type { Allowlist, Capability, ReplayOptions, ReplayParams, ReplayResult, Step } from "./types.ts";

export const Hands = {
  async replay(capability: Capability, params: ReplayParams, options: ReplayOptions = {}): Promise<ReplayResult> {
    const allowlist = await loadAllowlist();
    const evidenceDir = options.evidenceDir ?? process.env.EVIDENCE_DIR ?? join(tmpdir(), "hands-evidence", String(Date.now()));
    const owners: string[] = [];
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
        const finished = await runStep(page, step, params, outputs, allowlist, baseOrigin, capability, evidenceDir, options.waitForResume, owners);
        if (finished) {
          if (finished.kind === "failure") {
            await snapshot(page, evidenceDir, "failure.png");
          } else {
            await snapshot(page, evidenceDir, "final.png");
          }
          return finished;
        }
      }

      const outcome = await businessOutcome(page, capability);
      if (outcome) {
        await snapshot(page, evidenceDir, "final.png");
        return outcome;
      }

      const money = await readMoneyNextTo(page, capability.checkpoint.label);
      if (!money) {
        await snapshot(page, evidenceDir, "failure.png");
        return fail(
          "checkpoint",
          `a money-shaped amount next to ${capability.checkpoint.label}`,
          await pageText(page),
        );
      }
      const read = outputs.balance;
      if (read && read !== money) {
        await snapshot(page, evidenceDir, "failure.png");
        return fail("checkpoint", money, read);
      }
      outputs.balance = money;
      await snapshot(page, evidenceDir, "final.png");
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
  capability: Capability,
  evidenceDir: string,
  waitForResume: ReplayOptions["waitForResume"],
  owners: string[],
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
    const stuckAfterGo = await handleStuck(page, step, capability, evidenceDir, waitForResume, owners);
    if (stuckAfterGo) {
      return stuckAfterGo;
    }
    return await businessOutcome(page, capability);
  }

  await dismissTimeoutIfPresent(page);
  const stuck = await handleStuck(page, step, capability, evidenceDir, waitForResume, owners);
  if (stuck) {
    return stuck;
  }

  const here = page.url() === "about:blank" ? undefined : new URL(page.url());
  if (here && !originAllowed(allowlist, here)) {
    return fail(step.id, `origin ${allowlist.origins.join(" or ")}`, here.origin);
  }

  const found = await locate(page, step.locators, step.action);
  if ("missed" in found) {
    return (await businessOutcome(page, capability)) ?? fail(step.id, found.missed, await pageText(page));
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
    if (stepAimsAtRisky(step)) {
      await escalate(page, evidenceDir, {
        goal: capability.description,
        step: step.id,
        reason: "risky: Open sub-account",
        screenshot: "intervention.png",
      }, owners, waitForResume);
      return undefined;
    }
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
    const stuckAfterClick = await handleStuck(page, step, capability, evidenceDir, waitForResume, owners);
    if (stuckAfterClick) {
      return stuckAfterClick;
    }
    const after = new URL(page.url());
    if (!originAllowed(allowlist, after)) {
      return fail(step.id, `origin ${allowlist.origins.join(" or ")}`, after.origin);
    }
    return await businessOutcome(page, capability);
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
  capability: Capability,
  evidenceDir: string,
  waitForResume: ReplayOptions["waitForResume"],
  owners: string[],
): Promise<ReplayResult | undefined> {
  if (!(await unexpectedDialogPresent(page))) {
    return undefined;
  }
  await escalate(page, evidenceDir, {
    goal: capability.description,
    step: step.id,
    reason: "stuck: unexpected dialog",
    screenshot: "intervention.png",
  }, owners, waitForResume);
  if (await unexpectedDialogPresent(page)) {
    return fail(step.id, "the unexpected dialog cleared after resume", await pageText(page));
  }
  return undefined;
}

async function businessOutcome(page: Page, capability: Capability): Promise<ReplayResult | undefined> {
  if (!capability.businessOutcomes.includes("member_not_found")) {
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

async function snapshot(page: Page, dir: string, name: string) {
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: join(dir, name), fullPage: true });
}
