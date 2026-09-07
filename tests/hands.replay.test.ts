import { expect, test } from "bun:test";
import { join } from "node:path";
import { Hands } from "../src/hands.ts";
import { startMock } from "../src/mock/server.ts";
import type { Capability } from "../src/types.ts";

const capabilityPath = join(import.meta.dir, "../capabilities/get_savings_balance.v1.json");

async function loadCapability(): Promise<Capability> {
  return (await Bun.file(capabilityPath).json()) as Capability;
}

async function withMock<T>(fn: (origin: string) => Promise<T>): Promise<T> {
  const server = startMock(0);
  const origin = new URL(server.url).origin;
  const previous = process.env.HANDS_ORIGIN;
  process.env.HANDS_ORIGIN = origin;
  try {
    return await fn(origin);
  } finally {
    if (previous === undefined) {
      delete process.env.HANDS_ORIGIN;
    } else {
      process.env.HANDS_ORIGIN = previous;
    }
    await server.stop();
  }
}

test("replay of get savings balance with a known member returns success and a balance string", async () => {
  await withMock(async () => {
    const result = await Hands.replay(await loadCapability(), { memberId: "12345" });
    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      expect(result.outputs.balance).toBe("$2,450.00");
    }
  });
}, { timeout: 30_000 });

test("an act off the mock origin is refused", async () => {
  await withMock(async (origin) => {
    const capability = await loadCapability();
    const result = await Hands.replay(
      {
        ...capability,
        steps: [{ id: "leave", action: "navigate", url: "https://example.com/" }],
      },
      { memberId: "12345" },
    );
    expect(result.kind).toBe("failure");
    if (result.kind === "failure") {
      expect(result.step).toBe("leave");
      expect(result.expected).toContain(origin);
      expect(result.observed).toBe("https://example.com (did not navigate)");
    }
  });
}, { timeout: 30_000 });
