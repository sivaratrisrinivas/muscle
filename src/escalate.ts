import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "playwright";
import type { ReplayOptions } from "./types.ts";

export const RISKY_CONTROL = "Open sub-account";

export type Intervention = {
  goal: string;
  step: string;
  reason: string;
  screenshot: string;
};

export type HumanAction = {
  type: "click" | "fill" | "resume";
  role?: string;
  name?: string;
  atMs: number;
};

type HumanWatch = {
  actions: HumanAction[];
  live: boolean;
  started: number;
};

const watches = new WeakMap<Page, HumanWatch>();

const LISTEN = `(() => {
  const w = window;
  if (w.__handsHumanBound || !w.__handsRecordHuman) {
    return;
  }
  w.__handsHumanBound = true;
  const describe = (el) => {
    const tag = el.tagName.toLowerCase();
    const type = el.type || "";
    const role =
      el.getAttribute("role") ||
      (tag === "button" || type === "submit" || type === "button" ? "button" : tag === "input" ? "textbox" : tag);
    const name = (el.getAttribute("aria-label") || el.value || el.textContent || "").replace(/\\s+/g, " ").trim();
    return { role, name };
  };
  document.addEventListener("click", (event) => {
    const el = event.target && event.target.closest ? event.target.closest("button, input, a, [role='button']") : null;
    if (!el) {
      return;
    }
    w.__handsRecordHuman({ type: "click", ...describe(el) });
  }, true);
  document.addEventListener("change", (event) => {
    const el = event.target;
    if (!el) {
      return;
    }
    const { role, name } = describe(el);
    w.__handsRecordHuman({ type: "fill", role, name });
  }, true);
})()`;

export async function unexpectedDialogPresent(page: Page): Promise<boolean> {
  const dialog = page.getByRole("dialog");
  return (await dialog.count()) > 0 && (await dialog.first().isVisible());
}

export function stepAimsAtRisky(step: { action: string; locators?: Array<{ name?: string; text?: string }> }): boolean {
  if (step.action !== "click" || !step.locators) {
    return false;
  }
  return step.locators.some((loc) => loc.name === RISKY_CONTROL || loc.text === RISKY_CONTROL);
}

export async function escalate(
  page: Page,
  evidenceDir: string,
  intervention: Intervention,
  owners: string[],
  waitForResume: ReplayOptions["waitForResume"],
): Promise<void> {
  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({ path: join(evidenceDir, intervention.screenshot), fullPage: true });
  await Bun.write(join(evidenceDir, "intervention.json"), JSON.stringify(intervention, null, 2));
  await setOwner(owners, evidenceDir, "human");
  const finishWatch = await watchHuman(page);
  await (waitForResume ?? waitForEnter)(page);
  await Bun.write(join(evidenceDir, "human_actions.json"), `${JSON.stringify(finishWatch(), null, 2)}\n`);
  await setOwner(owners, evidenceDir, "automation");
}

export async function setOwner(owners: string[], evidenceDir: string, owner: "automation" | "human") {
  owners.push(owner);
  if (owner === "human" || owners.includes("human")) {
    console.log(`owner ${owner}`);
  }
  await Bun.write(join(evidenceDir, "owners.json"), JSON.stringify(owners, null, 2));
}

async function watchHuman(page: Page): Promise<() => HumanAction[]> {
  let watch = watches.get(page);
  if (!watch) {
    watch = { actions: [], live: false, started: Date.now() };
    watches.set(page, watch);
    await page.exposeFunction("__handsRecordHuman", (action: Omit<HumanAction, "atMs">) => {
      const state = watches.get(page);
      if (!state?.live) {
        return;
      }
      state.actions.push({ ...action, atMs: Date.now() - state.started });
    });
    await page.addInitScript({ content: LISTEN });
  }
  await page.evaluate(LISTEN);
  watch.live = true;
  watch.started = Date.now();

  return () => {
    watch.live = false;
    watch.actions.push({ type: "resume", atMs: Date.now() - watch.started });
    return watch.actions;
  };
}

async function waitForEnter(_page: Page) {
  process.stdout.write("Escalated. Press Enter to resume.\n");
  const reader = Bun.stdin.stream().getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      return;
    }
    if (decoder.decode(value).includes("\n")) {
      return;
    }
  }
}
