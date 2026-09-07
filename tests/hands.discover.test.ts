import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Hands } from "../src/hands.ts";
import { startMock } from "../src/mock/server.ts";
import type { Capability, LocatorChain, LlmAdapter, ToolCall } from "../src/types.ts";

const memberId: LocatorChain = [
  { by: "role_name", role: "textbox", name: "Member ID" },
  { by: "visible_text", text: "Member ID" },
];

const search: LocatorChain = [
  { by: "role_name", role: "button", name: "Search" },
  { by: "visible_text", text: "Search" },
];

const savings: LocatorChain = [
  { by: "role_name", role: "cell", name: "Savings" },
  { by: "visible_text", text: "Savings" },
];

function scripted(calls: ToolCall[]): LlmAdapter {
  let i = 0;
  return {
    async nextTool() {
      return calls[i++] ?? { name: "escalate", reason: "scripted LLM exhausted" };
    },
  };
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

test("discover with a scripted LLM writes a capability that replay can run to success", async () => {
  await withMock(async (origin) => {
    const capabilityDir = await mkdtemp(join(tmpdir(), "hands-cap-"));
    const result = await Hands.discover(
      "Look up a member by ID and read the savings balance.",
      { memberId: "12345" },
      `${origin}/`,
      {
        llm: scripted([
          { name: "act", action: "fill", fromParam: "memberId", locators: memberId },
          { name: "act", action: "click", locators: search },
          { name: "act", action: "read", into: "balance", locators: savings },
          { name: "finish" },
        ]),
        capabilityDir,
      },
    );

    expect(result.kind).toBe("capability");
    if (result.kind !== "capability") {
      return;
    }

    const raw = await Bun.file(result.path).text();
    expect(raw).not.toContain("12345");
    expect(raw.includes("transcript") || raw.includes("messages")).toBe(false);

    const written = (await Bun.file(result.path).json()) as Capability;
    expect(written.params).toEqual([{ name: "memberId" }]);
    expect(written.outputs).toEqual([{ name: "balance" }]);
    expect(await Bun.file(result.transcriptPath).exists()).toBe(true);
    expect(dirname(result.transcriptPath)).toBe(dirname(result.path));

    const replayed = await Hands.replay(written, { memberId: "12345" });
    expect(replayed.kind).toBe("success");
    if (replayed.kind === "success") {
      expect(replayed.outputs.balance).toBe("$2,450.00");
    }
  });
}, { timeout: 60_000 });

test("discover keeps going when finish is called before the checkpoint holds", async () => {
  await withMock(async (origin) => {
    const capabilityDir = await mkdtemp(join(tmpdir(), "hands-cap-"));
    const result = await Hands.discover(
      "Look up a member by ID and read the savings balance.",
      { memberId: "12345" },
      `${origin}/`,
      {
        llm: scripted([
          { name: "finish" },
          { name: "act", action: "fill", fromParam: "memberId", locators: memberId },
          { name: "act", action: "click", locators: search },
          { name: "act", action: "read", into: "balance", locators: savings },
          { name: "finish" },
        ]),
        capabilityDir,
      },
    );
    expect(result.kind).toBe("capability");
    if (result.kind !== "capability") {
      return;
    }
    const replayed = await Hands.replay(result.capability, { memberId: "12345" });
    expect(replayed.kind).toBe("success");
  });
}, { timeout: 60_000 });

test("discover stops on escalate and does not write a capability", async () => {
  await withMock(async (origin) => {
    const capabilityDir = await mkdtemp(join(tmpdir(), "hands-cap-"));
    const evidenceDir = await mkdtemp(join(tmpdir(), "hands-disc-esc-"));
    let sawIntervention = false;
    const result = await Hands.discover(
      "Look up a member by ID and read the savings balance.",
      { memberId: "12345" },
      `${origin}/`,
      {
        llm: scripted([{ name: "escalate", reason: "stuck on purpose" }]),
        capabilityDir,
        evidenceDir,
        waitForResume: async () => {
          const intervention = (await Bun.file(join(evidenceDir, "intervention.json")).json()) as {
            reason: string;
          };
          expect(intervention.reason).toContain("stuck");
          sawIntervention = true;
        },
      },
    );
    expect(result.kind).toBe("stopped");
    if (result.kind === "stopped") {
      expect(result.reason).toBe("escalate");
    }
    expect(sawIntervention).toBe(true);
    expect(await Bun.file(join(capabilityDir, "get_savings_balance.v1.json")).exists()).toBe(false);
  });
}, { timeout: 30_000 });

test("discover stops after three identical snapshots", async () => {
  await withMock(async (origin) => {
    const capabilityDir = await mkdtemp(join(tmpdir(), "hands-cap-"));
    const result = await Hands.discover(
      "Look up a member by ID and read the savings balance.",
      { memberId: "12345" },
      `${origin}/`,
      {
        llm: scripted([
          { name: "act", action: "navigate", url: "/" },
          { name: "act", action: "navigate", url: "/" },
          { name: "finish" },
        ]),
        capabilityDir,
      },
    );
    expect(result.kind).toBe("stopped");
    if (result.kind === "stopped") {
      expect(result.reason).toBe("identical_snapshots");
    }
    expect(await Bun.file(join(capabilityDir, "get_savings_balance.v1.json")).exists()).toBe(false);
  });
}, { timeout: 30_000 });
