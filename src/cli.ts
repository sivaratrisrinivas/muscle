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
    console.error("Usage: bun run replay --capability <file> --param name=value");
    process.exit(1);
  }
  const params = paramsFrom(rest);
  const capability = (await Bun.file(capabilityPath).json()) as Capability;
  const result = await Hands.replay(capability, params);
  console.log(JSON.stringify(result, null, 2));
  if (result.kind === "failure") {
    process.exit(1);
  }
} else {
  console.error("Usage: bun run mock | bun run replay --capability <file> --param name=value");
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
