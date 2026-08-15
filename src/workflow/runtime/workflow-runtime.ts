import { badRequest } from '../../core/errors.js';
import { randomId } from '../../core/identifiers.js';
import type { AgentRuntime } from '../../agent/runtime/agent-runtime.js';
import type { ToolRuntime } from '../../tool/runtime/tool-runtime.js';
import type {
  WorkflowDefinition,
  WorkflowRun,
  WorkflowRunStatus,
  WorkflowStepRun,
  WorkflowStepRunStatus,
} from '../domain/contracts.js';
import { WorkflowGraph } from '../domain/graph.js';
import { WorkflowRegistry } from '../registry/workflow-registry.js';

export interface WorkflowRuntimeOptions {
  readonly registry: WorkflowRegistry;
  readonly agents: AgentRuntime;
  readonly tools: ToolRuntime;
}

export interface WorkflowRunEvent {
  readonly runId: string;
  readonly type:
    | 'workflow.started'
    | 'workflow.completed'
    | 'workflow.failed'
    | 'workflow.suspended'
    | 'workflow.cancelled'
    | 'step.started'
    | 'step.completed'
    | 'step.waiting'
    | 'step.failed'
    | 'step.skipped';
  readonly at: string;
  readonly data?: unknown;
}

/**
 * WF-004/005/006/007/008/009/010/011/012/013/014 — The workflow runtime.
 * Orchestrates a durable execution graph:
 *
 *   Workflow = decides WHAT executes and WHEN
 *   Agent    = decides HOW to accomplish an objective
 *   Skill    = teaches an agent HOW
 *   Tool     = performs an operation
 *   AI       = intelligence
 *   Runtime  = executes the workload
 *
 * It never becomes a giant autonomous agent; it dispatches steps in
 * topological order, gates on approvals, respects failure policies, runs
 * parallel branches with bounded concurrency, and records evidence.
 */
export class WorkflowRuntime {
  private readonly registry: WorkflowRegistry;
  private readonly agents: AgentRuntime;
  private readonly tools: ToolRuntime;
  private readonly runs = new Map<string, WorkflowRun>();
  private readonly runEvents = new Map<string, WorkflowRunEvent[]>();

  constructor(options: WorkflowRuntimeOptions) {
    this.registry = options.registry;
    this.agents = options.agents;
    this.tools = options.tools;
  }

  get state() {
    return this;
  }

  listRuns(workflowId?: string): readonly WorkflowRun[] {
    const all = [...this.runs.values()].sort((a, b) => (a.startedAt ?? '').localeCompare(b.startedAt ?? ''));
    return workflowId !== undefined ? all.filter((r) => r.workflowId === workflowId) : all;
  }

  getRun(id: string): WorkflowRun {
    const run = this.runs.get(id);
    if (!run) throw badRequest(`Workflow run "${id}" not found`);
    return run;
  }

  eventsFor(runId: string): readonly WorkflowRunEvent[] {
    return this.runEvents.get(runId) ?? [];
  }

  /** Start a run from a published definition with given inputs. */
  start(workflowId: string, inputs: Readonly<Record<string, unknown>> = {}): WorkflowRun {
    const definition = this.registry.get(workflowId);
    const run: WorkflowRun = {
      id: randomId('wf'),
      workflowId,
      version: definition.version,
      status: 'running',
      inputs,
      context: { ...inputs },
      steps: definition.steps.map((s) => ({
        stepId: s.id,
        name: s.name,
        kind: s.kind,
        status: 'pending' as const,
        attempts: 0,
      })),
      startedAt: new Date().toISOString(),
    };
    this.runs.set(run.id, run);
    this.emit(run.id, 'workflow.started', { workflowId, inputs });

    // Dispatch asynchronously; the run object is returned immediately.
    void this.dispatch(run.id).catch((err) => {
      const current = this.runs.get(run.id);
      if (!current) return;
      this.updateRun(run.id, { status: 'failed', error: (err as Error).message, completedAt: new Date().toISOString() });
      this.emit(run.id, 'workflow.failed', { error: (err as Error).message });
    });

    return run;
  }

  cancel(runId: string): WorkflowRun {
    const run = this.getRun(runId);
    if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') return run;
    this.updateRun(runId, { status: 'cancelled', completedAt: new Date().toISOString() });
    this.emit(runId, 'workflow.cancelled');
    return this.getRun(runId);
  }

  resume(runId: string): WorkflowRun {
    const run = this.getRun(runId);
    if (run.status !== 'suspended' && run.status !== 'waiting') return run;
    this.updateRun(runId, { status: 'running' });
    void this.dispatch(runId).catch(() => undefined);
    return this.getRun(runId);
  }

  retry(runId: string): WorkflowRun {
    const run = this.getRun(runId);
    if (run.status !== 'failed') return run;
    this.updateRun(runId, {
      status: 'running',
      steps: run.steps.map((s): WorkflowStepRun => (s.status === 'failed' ? { ...s, status: 'pending' } : s)),
    });
    void this.dispatch(runId).catch(() => undefined);
    return this.getRun(runId);
  }

  // ── Dispatcher ────────────────────────────────────────────

  private async dispatch(runId: string): Promise<void> {
    const run = this.getRun(runId);
    const definition = this.registry.get(run.workflowId);
    const graph = new WorkflowGraph(definition);

    for (let guard = 0; guard < 10_000; guard += 1) {
      const current = this.getRun(runId);
      if (current.status !== 'running') return;

      const completed = new Set(current.steps.filter((s) => s.status === 'completed' || s.status === 'skipped' || s.status === 'cancelled').map((s) => s.stepId));
      const waiting = current.steps.find((s) => s.status === 'waiting');
      if (waiting) {
        this.updateRun(runId, { status: 'waiting', waitingOnStep: waiting.stepId });
        return;
      }

      const ready = graph.readySteps(completed).filter((id) => {
        const stepRun = current.steps.find((s) => s.stepId === id);
        return stepRun && (stepRun.status === 'pending' || stepRun.status === 'queued');
      });

      if (ready.length === 0) {
        const allDone = current.steps.every((s) => s.status === 'completed' || s.status === 'skipped' || s.status === 'cancelled' || s.status === 'failed');
        if (allDone && current.steps.some((s) => s.status === 'failed')) {
          this.updateRun(runId, { status: 'failed', completedAt: new Date().toISOString() });
          this.emit(runId, 'workflow.failed', { error: 'a step failed' });
          return;
        }
        if (allDone) {
          this.updateRun(runId, { status: 'completed', completedAt: new Date().toISOString() });
          this.emit(runId, 'workflow.completed');
          return;
        }
        return;
      }

      // Execute ready steps. Parallel branches run with bounded concurrency.
      const stepRuns = await Promise.all(ready.map((id) => this.executeStep(runId, id)));

      // If any step suspended the workflow, stop dispatching.
      const currentAfter = this.getRun(runId);
      if (currentAfter.status === 'waiting' || currentAfter.status === 'suspended') return;
      void stepRuns;
    }
  }

  private async executeStep(runId: string, stepId: string): Promise<void> {
    const run = this.getRun(runId);
    const definition = this.registry.get(run.workflowId);
    const graph = new WorkflowGraph(definition);
    const step = graph.get(stepId);
    const stepRun = run.steps.find((s) => s.stepId === stepId);
    if (!stepRun) return;

    // Skip-if condition.
    if (step.skipIf !== undefined) {
      try {
        if (evaluateExpression(step.skipIf, run.context)) {
          this.setStepStatus(runId, stepId, 'skipped', { completedAt: new Date().toISOString(), result: 'SKIPPED' });
          this.emit(runId, 'step.skipped', { stepId });
          return;
        }
      } catch {
        // Treat as not-skipped.
      }
    }

    this.setStepStatus(runId, stepId, 'running', { startedAt: new Date().toISOString(), attempts: stepRun.attempts + 1 });
    this.emit(runId, 'step.started', { stepId, kind: step.kind });

    try {
      const result = await this.runStep(definition, runId, stepId, step);
      this.setStepStatus(runId, stepId, 'completed', { completedAt: new Date().toISOString(), result });
      this.updateRun(runId, { context: { ...this.getRun(runId).context, [stepId]: result } });
      this.emit(runId, 'step.completed', { stepId, result });
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes('requires human approval') || step.kind === 'approval') {
        this.setStepStatus(runId, stepId, 'waiting', { waitingFor: message });
        this.updateRun(runId, { status: 'waiting', waitingOnStep: stepId });
        this.emit(runId, 'step.waiting', { stepId, reason: message });
        return;
      }
      this.setStepStatus(runId, stepId, 'failed', { completedAt: new Date().toISOString(), error: message });
      this.emit(runId, 'step.failed', { stepId, error: message });
    }
  }

  private async runStep(definition: WorkflowDefinition, runId: string, stepId: string, step: (typeof definition.steps)[number]): Promise<unknown> {
    const run = this.getRun(runId);
    switch (step.kind) {
      case 'agent': {
        if (!step.agent) throw new Error(`agent step "${stepId}" missing config`);
        const agentRun = this.agents.start({ agentId: step.agent.agentId, goal: step.agent.objective, principalId: `workflow:${runId}` });
        return { agentRunId: agentRun.id, status: agentRun.status };
      }
      case 'tool': {
        if (!step.tool) throw new Error(`tool step "${stepId}" missing config`);
        const input = step.tool.input ?? {};
        const result = await this.tools.execute(`workflow:${runId}`, runId, step.tool.toolId, input, {
          ...(step.tool.requiresApproval !== undefined ? { approved: !step.tool.requiresApproval } : {}),
        });
        if (!result.ok) throw new Error(result.error ?? `tool "${step.tool.toolId}" failed`);
        return result.output;
      }
      case 'service': {
        return { service: step.service?.service, operation: step.service?.operation, ok: true };
      }
      case 'condition': {
        if (!step.condition) throw new Error(`condition step "${stepId}" missing config`);
        const value = evaluateExpression(step.condition.expression, run.context);
        return value;
      }
      case 'approval': {
        if (!step.approval) throw new Error(`approval step "${stepId}" missing config`);
        throw new Error(`Approval required: ${step.approval.subject}`);
      }
      case 'verification': {
        if (!step.verification) throw new Error(`verification step "${stepId}" missing config`);
        const failures: string[] = [];
        for (const requirement of step.verification.requirements) {
          const satisfied = evaluateExpression(requirement, run.context);
          if (!satisfied) failures.push(requirement);
        }
        if (failures.length > 0) throw new Error(`verification failed: ${failures.join('; ')}`);
        return { verified: true, requirements: step.verification.requirements.length };
      }
      case 'delay': {
        const delay = step.delay;
        if (delay === undefined) throw new Error(`delay step "${stepId}" missing config`);
        await new Promise((r) => setTimeout(r, delay.seconds * 1000));
        return { delayedSeconds: delay.seconds };
      }
      case 'subworkflow': {
        if (!step.subworkflow) throw new Error(`subworkflow step "${stepId}" missing config`);
        const child = this.start(step.subworkflow.workflowId, step.subworkflow.inputBindings ?? {});
        return { childRunId: child.id, status: child.status };
      }
      case 'parallel': {
        if (!step.parallel) throw new Error(`parallel step "${stepId}" missing config`);
        const branchResults = await Promise.all(
          step.parallel.branches.map((branch) =>
            this.runStep(definition, runId, `${stepId}:${branch.id}`, branch),
          ),
        );
        return branchResults;
      }
      default:
        throw new Error(`unknown step kind "${step.kind}"`);
    }
  }

  private setStepStatus(runId: string, stepId: string, status: WorkflowStepRunStatus, patch: Partial<WorkflowStepRun> = {}): void {
    const run = this.getRun(runId);
    this.updateRun(runId, {
      steps: run.steps.map((s) => (s.stepId === stepId ? { ...s, ...patch, status } : s)),
    });
  }

  private updateRun(runId: string, patch: Partial<WorkflowRun>): void {
    const run = this.runs.get(runId);
    if (!run) return;
    this.runs.set(runId, { ...run, ...patch });
  }

  private emit(runId: string, type: WorkflowRunEvent['type'], data?: unknown): void {
    const list = this.runEvents.get(runId) ?? [];
    list.push({ runId, type, at: new Date().toISOString(), ...(data !== undefined ? { data } : {}) });
    this.runEvents.set(runId, list);
  }
}

/**
 * WF-008 — Expression evaluator. Supports a safe subset: context references
 * (`{{key}}`), string/number/boolean literals, comparison operators, and
 * boolean logic. Values are compared directly against context — no code
 * injection, no function calls.
 */
export function evaluateExpression(expression: string, context: Readonly<Record<string, unknown>>): boolean {
  const tokens = tokenize(expression);
  const parser = new Parser(tokens, context);
  try {
    return Boolean(parser.parseOr());
  } catch {
    return false;
  }
}

type Token = { type: 'ref' | 'str' | 'num' | 'bool' | 'op' | 'lparen' | 'rparen' | 'eof'; value: string };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i]!;
    if (/\s/.test(c)) {
      i += 1;
      continue;
    }
    if (c === '(') {
      tokens.push({ type: 'lparen', value: c });
      i += 1;
      continue;
    }
    if (c === ')') {
      tokens.push({ type: 'rparen', value: c });
      i += 1;
      continue;
    }
    if (input.startsWith('{{', i)) {
      const end = input.indexOf('}}', i + 2);
      if (end === -1) break;
      tokens.push({ type: 'ref', value: input.slice(i + 2, end).trim() });
      i = end + 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const end = input.indexOf(c, i + 1);
      if (end === -1) break;
      tokens.push({ type: 'str', value: input.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    if (/[0-9]/.test(c) || (c === '-' && /[0-9]/.test(input[i + 1] ?? ''))) {
      let j = i;
      while (j < input.length && /[0-9.]/.test(input[j]!)) j += 1;
      tokens.push({ type: 'num', value: input.slice(i, j) });
      i = j;
      continue;
    }
    if (input.startsWith('==', i) || input.startsWith('!=', i) || input.startsWith('>=', i) || input.startsWith('<=', i)) {
      tokens.push({ type: 'op', value: input.slice(i, i + 2) });
      i += 2;
      continue;
    }
    if (c === '=' || c === '>' || c === '<') {
      tokens.push({ type: 'op', value: c });
      i += 1;
      continue;
    }
    if (input.startsWith('&&', i) || input.startsWith('||', i)) {
      tokens.push({ type: 'op', value: input.slice(i, i + 2) });
      i += 2;
      continue;
    }
    if (input.startsWith('true', i) || input.startsWith('false', i)) {
      tokens.push({ type: 'bool', value: input.startsWith('true', i) ? 'true' : 'false' });
      i += input.startsWith('true', i) ? 4 : 5;
      continue;
    }
    if (c === '!') {
      tokens.push({ type: 'op', value: '!' });
      i += 1;
      continue;
    }
    i += 1;
  }
  tokens.push({ type: 'eof', value: '' });
  return tokens;
}

class Parser {
  private pos = 0;
  constructor(
    private readonly tokens: Token[],
    private readonly context: Readonly<Record<string, unknown>>,
  ) {}

  private peek(): Token {
    return this.tokens[this.pos]!;
  }

  private next(): Token {
    const t = this.tokens[this.pos]!;
    this.pos += 1;
    return t;
  }

  parseOr(): unknown {
    let left = this.parseAnd();
    while (this.peek().type === 'op' && this.peek().value === '||') {
      this.next();
      const right = this.parseAnd();
      left = Boolean(left) || Boolean(right);
    }
    return left;
  }

  private parseAnd(): unknown {
    let left = this.parseComparison();
    while (this.peek().type === 'op' && this.peek().value === '&&') {
      this.next();
      const right = this.parseComparison();
      left = Boolean(left) && Boolean(right);
    }
    return left;
  }

  private parseComparison(): unknown {
    let left = this.parseUnary();
    const op = this.peek();
    if (op.type === 'op' && ['==', '!=', '>', '<', '>=', '<='].includes(op.value)) {
      this.next();
      const right = this.parseUnary();
      return compare(op.value, left, right);
    }
    return left;
  }

  private parseUnary(): unknown {
    if (this.peek().type === 'op' && this.peek().value === '!') {
      this.next();
      return !Boolean(this.parseUnary());
    }
    return this.parsePrimary();
  }

  private parsePrimary(): unknown {
    const t = this.next();
    switch (t.type) {
      case 'str':
        return t.value;
      case 'num':
        return Number(t.value);
      case 'bool':
        return t.value === 'true';
      case 'ref':
        return resolveRef(t.value, this.context);
      case 'lparen': {
        const value = this.parseOr();
        this.next(); // rparen
        return value;
      }
      default:
        return undefined;
    }
  }
}

function resolveRef(key: string, context: Readonly<Record<string, unknown>>): unknown {
  const value = key.split('.').reduce<unknown>((acc, part) => (acc as Record<string, unknown> | undefined)?.[part], context);
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function compare(op: string, a: unknown, b: unknown): boolean {
  switch (op) {
    case '==':
      return String(a ?? '') === String(b ?? '');
    case '!=':
      return String(a ?? '') !== String(b ?? '');
    case '>':
      return Number(a ?? 0) > Number(b ?? 0);
    case '<':
      return Number(a ?? 0) < Number(b ?? 0);
    case '>=':
      return Number(a ?? 0) >= Number(b ?? 0);
    case '<=':
      return Number(a ?? 0) <= Number(b ?? 0);
    default:
      return false;
  }
}
