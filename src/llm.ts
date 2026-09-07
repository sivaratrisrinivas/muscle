import type { LlmAdapter, LocatorChain, RoleNameLocator, ToolCall, VisibleTextLocator } from "./types.ts";

const DEFAULT_BASE = "https://api.cerebras.ai/v1";
const DEFAULT_MODEL = "gpt-oss-120b";

const SYSTEM = `You operate a hostile credit-union staff screen. You only decide. Playwright acts.

Each turn you get a fresh accessibility snapshot. Call exactly one tool: act, finish, or escalate.

act actions are click, fill, read, and navigate. Give a locator chain of length two: role and name, then visible text.
fill uses fromParam (the param name), never a live member ID.
read uses into "balance". For read, the visible-text locator is the label (Savings), never a dollar amount.
Do not click Open sub-account. Call escalate instead.
finish when a money-shaped amount is visible next to Savings.
escalate if you are stuck.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "act",
      description: "Take one allowlisted action on the surface.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["click", "fill", "read", "navigate"] },
          fromParam: { type: "string" },
          into: { type: "string" },
          url: { type: "string" },
          locators: {
            type: "array",
            minItems: 2,
            maxItems: 2,
            items: {
              type: "object",
              properties: {
                by: { type: "string", enum: ["role_name", "visible_text"] },
                role: { type: "string", enum: ["textbox", "button", "link", "cell", "row"] },
                name: { type: "string" },
                text: { type: "string" },
              },
            },
          },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "finish",
      description: "Stop. The checkpoint should hold: money next to Savings.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "escalate",
      description: "Pause for a human on this live session.",
      parameters: {
        type: "object",
        properties: { reason: { type: "string" } },
      },
    },
  },
];

export function envLlm(): LlmAdapter {
  const base = (process.env.LLM_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, "");
  const key = process.env.LLM_API_KEY;
  const model = process.env.MODEL ?? DEFAULT_MODEL;
  if (!key) {
    throw new Error("LLM_API_KEY is required for discover. Set LLM_BASE_URL, LLM_API_KEY, and MODEL.");
  }
  return {
    async nextTool(input) {
      const response = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${key}`,
        },
        signal: input.signal,
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: userPrompt(input) },
          ],
          tools: TOOLS,
          tool_choice: "required",
        }),
      });
      if (!response.ok) {
        throw new Error(`LLM ${response.status}: ${await response.text()}`);
      }
      return parseToolCall(await response.json());
    },
  };
}

function userPrompt(input: { goal: string; params: Record<string, string>; snapshot: string }): string {
  const params = Object.entries(input.params).map(([name, value]) => `${name}=${value}`).join(", ");
  return `Goal: ${input.goal}\nParams: ${params}\nSnapshot:\n${input.snapshot}`;
}

function parseToolCall(data: unknown): ToolCall {
  const payload = data as {
    choices?: Array<{ message?: { tool_calls?: Array<{ function?: { name?: string; arguments?: string } }> } }>;
  };
  const call = payload.choices?.[0]?.message?.tool_calls?.[0]?.function;
  if (!call?.name) {
    throw new Error("LLM did not call a tool");
  }
  let args: Record<string, unknown> = {};
  if (call.arguments) {
    try {
      args = JSON.parse(call.arguments) as Record<string, unknown>;
    } catch {
      throw new Error("LLM tool arguments were not JSON");
    }
  }
  if (call.name === "finish") {
    return { name: "finish" };
  }
  if (call.name === "escalate") {
    return { name: "escalate", reason: typeof args.reason === "string" ? args.reason : undefined };
  }
  if (call.name !== "act") {
    throw new Error(`LLM called unknown tool ${call.name}`);
  }
  const action = args.action;
  if (action !== "click" && action !== "fill" && action !== "read" && action !== "navigate") {
    throw new Error(`LLM called unknown act ${String(action)}`);
  }
  return {
    name: "act",
    action,
    locators: asLocators(args.locators),
    fromParam: typeof args.fromParam === "string" ? args.fromParam : undefined,
    into: typeof args.into === "string" ? args.into : undefined,
    url: typeof args.url === "string" ? args.url : undefined,
  };
}

function asLocators(raw: unknown): LocatorChain | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const parsed: Array<RoleNameLocator | VisibleTextLocator> = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const rec = item as Record<string, unknown>;
    if (rec.by === "visible_text" || (typeof rec.text === "string" && rec.by !== "role_name")) {
      parsed.push({ by: "visible_text", text: String(rec.text ?? rec.name ?? "") });
    } else if (rec.by === "role_name" || typeof rec.role === "string") {
      parsed.push({
        by: "role_name",
        role: rec.role as RoleNameLocator["role"],
        name: String(rec.name ?? rec.text ?? ""),
      });
    }
  }
  const first = parsed[0];
  const second = parsed[1];
  if (first && second) {
    return [first as RoleNameLocator, second as VisibleTextLocator];
  }
  return undefined;
}
