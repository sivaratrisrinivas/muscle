import { join } from "node:path";
import type { Allowlist } from "./types.ts";

export async function loadAllowlist(): Promise<Allowlist> {
  const allowlist = (await Bun.file(join(import.meta.dir, "../config/allowlist.json")).json()) as Allowlist;
  if (process.env.HANDS_ORIGIN) {
    return { ...allowlist, origins: [new URL(process.env.HANDS_ORIGIN).origin] };
  }
  return allowlist;
}

export function resolveActUrl(url: string, baseOrigin: string, currentUrl: string): URL {
  const base = currentUrl === "about:blank" ? `${baseOrigin}/` : currentUrl;
  return new URL(url, base);
}

export function originAllowed(allowlist: Allowlist, url: URL): boolean {
  return allowlist.origins.includes(url.origin);
}

export function actionAllowed(allowlist: Allowlist, action: string): boolean {
  return (allowlist.actions as string[]).includes(action);
}
