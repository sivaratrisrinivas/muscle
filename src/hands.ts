import { chromium } from "playwright";
import { actionAllowed, loadAllowlist, originAllowed, resolveActUrl } from "./allowlist.ts";
import { extractMoney, locate, readMoneyNextTo } from "./surface.ts";
import type { Allowlist, Capability, ReplayParams, ReplayResult, Step } from "./types.ts";

export const Hands = {
  async replay(capability: Capability, params: ReplayParams): Promise<ReplayResult> {
    const allowlist = await loadAllowlist();
    const browser = await chromium.launch({
      headless: process.env.HEADED !== "1",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    try {
      const page = await browser.newPage();
      const outputs: Record<string, string> = {};
      const baseOrigin = allowlist.origins[0];
      if (!baseOrigin) {
        return {
          kind: "failure",
          step: capability.steps[0]?.id ?? "start",
          expected: "an allowlisted origin",
          observed: "none",
        };
      }

      for (const step of capability.steps) {
        const failed = await runStep(page, step, params, outputs, allowlist, baseOrigin);
        if (failed) {
          return failed;
        }
      }

      const money = await readMoneyNextTo(page, capability.checkpoint.label);
      if (!money) {
        return {
          kind: "failure",
          step: "checkpoint",
          expected: `a money-shaped amount next to ${capability.checkpoint.label}`,
          observed: await pageText(page),
        };
      }
      const read = outputs.balance;
      if (read && read !== money) {
        return {
          kind: "failure",
          step: "checkpoint",
          expected: money,
          observed: read,
        };
      }
      outputs.balance = money;
      return { kind: "success", outputs };
    } finally {
      await browser.close();
    }
  },
};

async function runStep(
  page: import("playwright").Page,
  step: Step,
  params: ReplayParams,
  outputs: Record<string, string>,
  allowlist: Allowlist,
  baseOrigin: string,
): Promise<ReplayResult | undefined> {
  if (!actionAllowed(allowlist, step.action)) {
    return {
      kind: "failure",
      step: step.id,
      expected: `an allowlisted action (${allowlist.actions.join(", ")})`,
      observed: step.action,
    };
  }

  if (step.action === "navigate") {
    const target = resolveActUrl(step.url, baseOrigin, page.url());
    if (!originAllowed(allowlist, target)) {
      return {
        kind: "failure",
        step: step.id,
        expected: `origin ${allowlist.origins.join(" or ")}`,
        observed: target.origin,
      };
    }
    await page.goto(target.toString(), { waitUntil: "domcontentloaded" });
    return undefined;
  }

  const found = await locate(page, step.locators, step.action);
  if ("missed" in found) {
    return {
      kind: "failure",
      step: step.id,
      expected: found.missed,
      observed: await pageText(page),
    };
  }

  if (step.action === "fill") {
    const value = params[step.fromParam];
    if (value === undefined) {
      return {
        kind: "failure",
        step: step.id,
        expected: `param ${step.fromParam}`,
        observed: "missing",
      };
    }
    await found.locator.fill(value);
    return undefined;
  }

  if (step.action === "click") {
    await found.locator.click();
    await page.waitForLoadState("domcontentloaded");
    return undefined;
  }

  const text = await found.locator.innerText();
  const money = extractMoney(text);
  if (!money) {
    return {
      kind: "failure",
      step: step.id,
      expected: "a money-shaped amount",
      observed: text.trim(),
    };
  }
  outputs[step.into] = money;
  return undefined;
}

async function pageText(page: import("playwright").Page): Promise<string> {
  return page.evaluate("document.body.innerText");
}
