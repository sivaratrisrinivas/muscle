import type { Page } from "playwright";
import type { Locator, LocatorChain, Step } from "./types.ts";

const MONEY = /\$[\d,]+\.\d{2}/;

export function extractMoney(text: string): string | undefined {
  return text.replace(/\s+/g, " ").trim().match(MONEY)?.[0];
}

export async function locate(
  page: Page,
  chain: LocatorChain,
  action: Exclude<Step["action"], "navigate">,
): Promise<{ locator: ReturnType<Page["getByRole"]>; used: Locator } | { missed: string }> {
  const attempts: string[] = [];
  for (const step of chain) {
    const found = await tryLocate(page, step, action);
    if (found) {
      return { locator: found, used: step };
    }
    attempts.push(describeLocator(step));
  }
  return { missed: attempts.join(", then ") };
}

async function tryLocate(
  page: Page,
  loc: Locator,
  action: Exclude<Step["action"], "navigate">,
) {
  if (loc.by === "role_name") {
    const byRole = page.getByRole(loc.role, { name: loc.name, exact: true });
    if ((await byRole.count()) === 0 || !(await byRole.first().isVisible())) {
      return null;
    }
    const hit = byRole.first();
    if (action === "read" && !extractMoney(await hit.innerText())) {
      return null;
    }
    return hit;
  }

  const label = page.getByText(loc.text, { exact: true });
  if ((await label.count()) === 0 || !(await label.first().isVisible())) {
    return null;
  }

  if (action === "click") {
    const button = page.getByRole("button", { name: loc.text, exact: true });
    if ((await button.count()) > 0) {
      return button.first();
    }
    return label.first();
  }

  if (action === "fill") {
    const field = page.getByRole("row", { name: loc.text }).getByRole("textbox");
    if ((await field.count()) > 0) {
      return field.first();
    }
    return null;
  }

  const row = await savingsRow(page, loc.text);
  return row;
}

async function savingsRow(page: Page, label: string) {
  const rows = page.getByRole("row", { name: label });
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const compact = (await row.innerText()).replace(/\s+/g, " ").trim();
    if (new RegExp(`^${escapeRegExp(label)}\\s+\\$[\\d,]+\\.\\d{2}$`).test(compact)) {
      return row;
    }
  }
  return null;
}

export async function readMoneyNextTo(page: Page, label: string): Promise<string | undefined> {
  const row = await savingsRow(page, label);
  if (!row) {
    return undefined;
  }
  return extractMoney(await row.innerText());
}

function describeLocator(loc: Locator): string {
  if (loc.by === "role_name") {
    return `role ${loc.role} named ${loc.name}`;
  }
  return `visible text ${loc.text}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
