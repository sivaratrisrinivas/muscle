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
  await (waitForResume ?? waitForEnter)();
  await setOwner(owners, evidenceDir, "automation");
}

export async function setOwner(owners: string[], evidenceDir: string, owner: "automation" | "human") {
  owners.push(owner);
  await Bun.write(join(evidenceDir, "owners.json"), JSON.stringify(owners, null, 2));
}

async function waitForEnter() {
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
