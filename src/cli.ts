import { loadAllowlist } from "./allowlist.ts";
import { Hands } from "./hands.ts";
import { MOCK_ORIGIN, startMock } from "./mock/server.ts";
import type { Capability } from "./types.ts";

const [command, ...rest] = process.argv.slice(2);

if (command === "mock") {
  startMock();
  console.log(`Hostile credit-union surface at ${MOCK_ORIGIN}`);
} else if (command === "replay") {
  const capabilityPath = flag(rest, "--capability");
  if (!capabilityPath) {
    console.error("Usage: bun run replay --capability <file> --param name=value [--inject name]");
    process.exit(1);
  }
  const params = paramsFrom(rest);
  const inject = flag(rest, "--inject");
  const capability = (await Bun.file(capabilityPath).json()) as Capability;
  const result = await Hands.replay(capability, params, inject ? { inject } : {});
  console.log(JSON.stringify(result, null, 2));
  if (result.kind === "failure") {
    process.exit(1);
  }
} else if (command === "discover") {
  const goal = flag(rest, "--goal");
  if (!goal) {
    console.error("Usage: bun run discover --goal \"...\" --param name=value");
    process.exit(1);
  }
  const params = paramsFrom(rest);
  const allowlist = await loadAllowlist();
  const origin = allowlist.origins[0];
  if (!origin) {
    console.error("Allowlist has no origin");
    process.exit(1);
  }
  const result = await Hands.discover(goal, params, `${origin}/`);
  console.log(JSON.stringify(result, null, 2));
  if (result.kind !== "capability") {
    process.exit(1);
  }
} else {
  console.error("Usage: bun run mock | bun run discover --goal \"...\" --param name=value | bun run replay --capability <file> --param name=value [--inject name]");
  process.exit(1);
}

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}

function paramsFrom(args: string[]): Record<string, string> {
  const params: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--param") {
      const pair = args[i + 1];
      const eq = pair?.indexOf("=") ?? -1;
      if (pair && eq > 0) {
        params[pair.slice(0, eq)] = pair.slice(eq + 1);
      }
    }
  }
  return params;
}
