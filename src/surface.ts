import type { Locator as PlaywrightLocator, Page } from "playwright";
import type { Locator, LocatorChain, Step } from "./types.ts";

const MONEY = /\$[\d,]+\.\d{2}/;

export function extractMoney(text: string): string | undefined {
  return text.replace(/\s+/g, " ").trim().match(MONEY)?.[0];
}

export async function locate(
  page: Page,
  chain: LocatorChain,
  action: Exclude<Step["action"], "navigate">,
): Promise<{ locator: PlaywrightLocator } | { missed: string }> {
  const attempts: string[] = [];
  for (const step of chain) {
    const found = await tryLocate(page, step, action);
    if (found) {
      return { locator: found };
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
    if ((await visibleCount(byRole)) === 0) {
      return null;
    }
    return byRole.first();
  }

  const label = page.getByText(loc.text, { exact: true });
  if ((await visibleCount(label)) === 0) {
    return null;
  }

  if (action === "click") {
    const button = page.getByRole("button", { name: loc.text, exact: true });
    if ((await visibleCount(button)) > 0) {
      return button.first();
    }
    return label.first();
  }

  if (action === "fill") {
    const field = page.getByRole("row", { name: loc.text }).getByRole("textbox");
    if ((await visibleCount(field)) > 0) {
      return field.first();
    }
    return null;
  }

  const cell = page.getByRole("cell", { name: loc.text, exact: true });
  if ((await visibleCount(cell)) > 0) {
    return cell.first();
  }
  return label.first();
}

export async function moneyBeside(locator: PlaywrightLocator): Promise<string | undefined> {
  const own = extractMoney(await locator.innerText());
  if (own) {
    return own;
  }
  const next = await locator.evaluate((el) => el.nextElementSibling?.textContent ?? "");
  return extractMoney(next);
}

export async function readMoneyNextTo(page: Page, label: string): Promise<string | undefined> {
  const cells = page.getByRole("cell", { name: label, exact: true });
  const found = await cells.evaluateAll((els) => {
    for (const el of els) {
      const next = (el.nextElementSibling?.textContent ?? "").replace(/\s+/g, " ").trim();
      const match = next.match(/\$[\d,]+\.\d{2}/);
      if (match?.[0]) {
        return match[0];
      }
    }
    return null;
  });
  return found ?? undefined;
}

export async function actTargetUrl(
  locator: PlaywrightLocator,
  currentUrl: string,
): Promise<URL | undefined> {
  const raw = await locator.evaluate((el) => {
    if (el.tagName === "A") {
      return el.getAttribute("href") ?? "";
    }
    const form = el.closest("form");
    return form?.getAttribute("action") ?? "";
  });
  if (!raw) {
    return undefined;
  }
  return new URL(raw, currentUrl);
}

async function visibleCount(locator: PlaywrightLocator): Promise<number> {
  if ((await locator.count()) === 0) {
    return 0;
  }
  return (await locator.first().isVisible()) ? await locator.count() : 0;
}

function describeLocator(loc: Locator): string {
  if (loc.by === "role_name") {
    return `role ${loc.role} named ${loc.name}`;
  }
  return `visible text ${loc.text}`;
}
