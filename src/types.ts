export type Severity = "low" | "medium" | "high";
export type TaskType =
  | "bugfix"
  | "data-issue"
  | "api-issue"
  | "ui-issue"
  | "performance"
  | "unknown";

export type PolicyStatus = "allowed" | "needs_review" | "denied";
export type ExecutionStatus =
  | "created"
  | "planned"
  | "awaiting_agent"
  | "agent_result_received"
  | "validated"
  | "pr_created"
  | "blocked"
  | "failed";

export interface TriageResult {
  taskType: TaskType;
  severity: Severity;
  confidence: number;
  repoHint?: string;
  rationale: string[];
}

export interface PolicyDecision {
  status: PolicyStatus;
  reasons: string[];
  protectedPaths: string[];
  allowedToFinalize: boolean;
}

export interface AgentPlan {
  title: string;
  summary: string;
  hypotheses: string[];
  relevantAreas: string[];
  investigationSteps: string[];
  implementationSteps: string[];
  validationSteps: string[];
  constraints: string[];
  handoffPrompt: string;
}

export interface ExecutionRecord {
  id: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  status: ExecutionStatus;
  triage: TriageResult;
  policy: PolicyDecision;
  plan: AgentPlan;
  agentResult?: AgentResult;
  validation?: ValidationResult;
  gitOutcome?: GitOutcome;
}

export interface AgentResult {
  summary: string;
  changedFiles: string[];
  notes?: string[];
}

export interface ValidationCheck {
  command: string;
  success: boolean;
  output: string;
}

export interface ValidationResult {
  success: boolean;
  checks: ValidationCheck[];
}

export interface GitOutcome {
  branchName: string;
  commitSha?: string;
  prUrl?: string;
  skipped: boolean;
  reasons: string[];
}
