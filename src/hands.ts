import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { actionAllowed, loadAllowlist, originAllowed, resolveActUrl } from "./allowlist.ts";
import { actTargetUrl, locate, moneyBeside, readMoneyNextTo } from "./surface.ts";
import type { Allowlist, Capability, ReplayParams, ReplayResult, Step } from "./types.ts";

export const Hands = {
  async replay(capability: Capability, params: ReplayParams): Promise<ReplayResult> {
    const allowlist = await loadAllowlist();
    const evidenceDir = process.env.EVIDENCE_DIR ?? join(tmpdir(), "hands-evidence", String(Date.now()));
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

      for (const step of capability.steps) {
        const failed = await runStep(page, step, params, outputs, allowlist, baseOrigin);
        if (failed) {
          await snapshot(page, evidenceDir, "failure.png");
          return failed;
        }
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
    return undefined;
  }

  const here = page.url() === "about:blank" ? undefined : new URL(page.url());
  if (here && !originAllowed(allowlist, here)) {
    return fail(step.id, `origin ${allowlist.origins.join(" or ")}`, here.origin);
  }

  const found = await locate(page, step.locators, step.action);
  if ("missed" in found) {
    return fail(step.id, found.missed, await pageText(page));
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
    const after = new URL(page.url());
    if (!originAllowed(allowlist, after)) {
      return fail(step.id, `origin ${allowlist.origins.join(" or ")}`, after.origin);
    }
    return undefined;
  }

  const money = await moneyBeside(found.locator);
  if (!money) {
    return fail(step.id, "a money-shaped amount next to the located control", (await found.locator.innerText()).trim());
  }
  outputs[step.into] = money;
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
