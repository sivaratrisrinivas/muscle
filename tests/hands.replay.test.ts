import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
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

test("a hard miss names the step, what was expected, and what was observed", async () => {
  await withMock(async () => {
    const capability = await loadCapability();
    const result = await Hands.replay(
      {
        ...capability,
        steps: [
          { id: "open_lookup", action: "navigate", url: "/" },
          {
            id: "ghost",
            action: "click",
            locators: [
              { by: "role_name", role: "button", name: "No such control" },
              { by: "visible_text", text: "No such control" },
            ],
          },
        ],
      },
      { memberId: "12345" },
    );
    expect(result.kind).toBe("failure");
    if (result.kind === "failure") {
      expect(result.step).toBe("ghost");
      expect(result.expected).toContain("No such control");
      expect(result.observed).toContain("Member lookup");
    }
  });
}, { timeout: 30_000 });

test("replay with session-timeout injected dismisses the interstitial and returns success", async () => {
  await withMock(async () => {
    const result = await Hands.replay(await loadCapability(), { memberId: "12345" }, { inject: "session_timeout" });
    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      expect(result.outputs.balance).toBe("$2,450.00");
    }
  });
}, { timeout: 30_000 });

test("replay with member-not-found injected returns business_outcome member_not_found", async () => {
  await withMock(async () => {
    const result = await Hands.replay(await loadCapability(), { memberId: "12345" }, { inject: "member_not_found" });
    expect(result.kind).toBe("business_outcome");
    if (result.kind === "business_outcome") {
      expect(result.code).toBe("member_not_found");
    }
  });
}, { timeout: 30_000 });

test("an unexpected dialog records the human OK click and continues to success", async () => {
  await withMock(async () => {
    const evidenceDir = await mkdtemp(join(tmpdir(), "hands-esc-"));
    const capability = await loadCapability();
    let sawIntervention = false;
    const result = await Hands.replay(capability, { memberId: "12345" }, {
      inject: "unexpected_dialog",
      evidenceDir,
      waitForResume: async (page) => {
        const intervention = (await Bun.file(join(evidenceDir, "intervention.json")).json()) as {
          goal: string;
          step: string;
          reason: string;
          screenshot: string;
        };
        expect(intervention.goal).toBe(capability.description);
        expect(intervention.step).toBe("search");
        expect(intervention.reason).toContain("stuck");
        expect(await Bun.file(join(evidenceDir, intervention.screenshot)).exists()).toBe(true);
        sawIntervention = true;
        await page.getByRole("button", { name: "OK" }).click();
      },
    });
    expect(sawIntervention).toBe(true);
    const owners = (await Bun.file(join(evidenceDir, "owners.json")).json()) as string[];
    expect(owners).toEqual(["automation", "human", "automation"]);
    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      expect(result.outputs.balance).toBe("$2,450.00");
    }
    const actions = (await Bun.file(join(evidenceDir, "human_actions.json")).json()) as Array<{
      type: string;
      name?: string;
    }>;
    expect(actions.some((action) => action.type === "click" && action.name === "OK")).toBe(true);
    expect(actions.some((action) => action.type === "resume")).toBe(true);
  });
}, { timeout: 30_000 });

test("an unexpected dialog still present after Enter fails the blocked step", async () => {
  await withMock(async () => {
    const evidenceDir = await mkdtemp(join(tmpdir(), "hands-esc-still-"));
    const capability = await loadCapability();
    const result = await Hands.replay(capability, { memberId: "12345" }, {
      inject: "unexpected_dialog",
      evidenceDir,
      waitForResume: async () => {
        expect(await Bun.file(join(evidenceDir, "intervention.json")).exists()).toBe(true);
      },
    });
    expect(result.kind).toBe("failure");
    if (result.kind === "failure") {
      expect(result.step).toBe("search");
      expect(result.expected).toContain("dismissed");
      expect(result.observed).toContain("dialog still present");
    }
    const actions = (await Bun.file(join(evidenceDir, "human_actions.json")).json()) as Array<{ type: string }>;
    expect(actions.some((action) => action.type === "resume")).toBe(true);
  });
}, { timeout: 30_000 });

test("a step aimed at Open sub-account is a risky action and pauses", async () => {
  await withMock(async () => {
    const evidenceDir = await mkdtemp(join(tmpdir(), "hands-risk-"));
    const capability = await loadCapability();
    let sawRisky = false;
    await Hands.replay(
      {
        ...capability,
        steps: [
          ...capability.steps.slice(0, 3),
          {
            id: "open_sub",
            action: "click",
            locators: [
              { by: "role_name", role: "button", name: "Open sub-account" },
              { by: "visible_text", text: "Open sub-account" },
            ],
          },
        ],
      },
      { memberId: "12345" },
      {
        evidenceDir,
        waitForResume: async () => {
          const intervention = (await Bun.file(join(evidenceDir, "intervention.json")).json()) as {
            step: string;
            reason: string;
          };
          expect(intervention.step).toBe("open_sub");
          expect(intervention.reason).toContain("risky");
          sawRisky = true;
        },
      },
    );
    expect(sawRisky).toBe(true);
    const owners = (await Bun.file(join(evidenceDir, "owners.json")).json()) as string[];
    expect(owners).toEqual(["automation", "human", "automation"]);
  });
}, { timeout: 30_000 });
