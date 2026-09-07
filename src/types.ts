export type RoleNameLocator = {
  by: "role_name";
  role: "textbox" | "button" | "link" | "cell" | "row";
  name: string;
};

export type VisibleTextLocator = {
  by: "visible_text";
  text: string;
};

export type Locator = RoleNameLocator | VisibleTextLocator;

export type LocatorChain = [RoleNameLocator, VisibleTextLocator];

export type NavigateStep = {
  id: string;
  action: "navigate";
  url: string;
};

export type FillStep = {
  id: string;
  action: "fill";
  fromParam: string;
  locators: LocatorChain;
};

export type ClickStep = {
  id: string;
  action: "click";
  locators: LocatorChain;
};

export type ReadStep = {
  id: string;
  action: "read";
  into: string;
  locators: LocatorChain;
};

export type Step = NavigateStep | FillStep | ClickStep | ReadStep;

export type Capability = {
  name: string;
  version: number;
  vendorApp: string;
  vendorVersion: string;
  description: string;
  params: { name: string }[];
  outputs: { name: string }[];
  steps: Step[];
  checkpoint: { kind: "money_next_to"; label: string };
  businessOutcomes: string[];
};

export type ReplayParams = Record<string, string>;

export type ReplayOptions = {
  inject?: string;
  evidenceDir?: string;
  waitForResume?: (page: import("playwright").Page) => Promise<void>;
};

export type ActCall = {
  name: "act";
  action: "click" | "fill" | "read" | "navigate";
  locators?: LocatorChain;
  fromParam?: string;
  into?: string;
  url?: string;
};

export type FinishCall = {
  name: "finish";
};

export type EscalateCall = {
  name: "escalate";
  reason?: string;
};

export type ToolCall = ActCall | FinishCall | EscalateCall;

export type LlmAdapter = {
  nextTool(input: {
    goal: string;
    params: ReplayParams;
    snapshot: string;
    signal?: AbortSignal;
  }): Promise<ToolCall>;
};

export type DiscoverOptions = ReplayOptions & {
  llm?: LlmAdapter;
  capabilityDir?: string;
};

export type DiscoverCapability = {
  kind: "capability";
  capability: Capability;
  path: string;
  transcriptPath: string;
};

export type DiscoverStopped = {
  kind: "stopped";
  reason: "escalate" | "step_cap" | "time_cap" | "identical_snapshots";
};

export type DiscoverResult = DiscoverCapability | DiscoverStopped | ReplayFailure;

export type ReplaySuccess = {
  kind: "success";
  outputs: Record<string, string>;
};

export type ReplayBusinessOutcome = {
  kind: "business_outcome";
  code: string;
};

export type ReplayFailure = {
  kind: "failure";
  step: string;
  expected: string;
  observed: string;
};

export type ReplayResult = ReplaySuccess | ReplayBusinessOutcome | ReplayFailure;

export type Allowlist = {
  origins: string[];
  actions: Array<"click" | "fill" | "read" | "navigate">;
};
