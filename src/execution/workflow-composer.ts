import { createPlanId } from './domain/contracts.js';
import type { ResolvedCapability, ResolvedIntent, ExecutionMilestone, ExecutionPlan, ExecutionRole, ExecutionStep } from './domain/contracts.js';

export interface ComposeExecutionPlanInput {
  readonly request: {
    readonly id: string;
    readonly goal: string;
    readonly agentId: string;
    readonly agentName?: string;
    readonly roomId: string;
    readonly principalId?: string;
    readonly requestedAt: string;
  };
  readonly intent: ResolvedIntent;
  readonly capabilities: readonly ResolvedCapability[];
  readonly missingCapabilities: readonly string[];
}

export class WorkflowComposer {
  compose(input: ComposeExecutionPlanInput): ExecutionPlan {
    const now = new Date().toISOString();
    const milestones = this.buildMilestones(input);
    const evidence = this.buildEvidence(milestones);
    const warnings = [
      ...(input.missingCapabilities.length > 0 ? [`Missing capabilities: ${input.missingCapabilities.join(', ')}`] : []),
      ...(input.intent.ambiguities.length > 0 ? input.intent.ambiguities.map((ambiguity) => ambiguity.message) : []),
    ];
    const summary = this.buildSummary(input, milestones);

    return {
      id: createPlanId({ executionId: input.request.id, goal: input.request.goal, agentId: input.request.agentId, kind: input.intent.kind }),
      executionId: input.request.id,
      status: 'planning',
      request: input.request,
      intent: input.intent,
      capabilities: input.capabilities,
      milestones,
      evidence,
      warnings,
      summary,
      generatedAt: now,
    };
  }

  private buildMilestones(input: ComposeExecutionPlanInput): readonly ExecutionMilestone[] {
    const capabilities = new Map(input.capabilities.map((capability) => [capability.namespace, capability]));
    const buildNamespaces = ['components', 'themes', 'templates', 'page-builder', 'application-builder', 'generator'];
    const verificationNamespaces = ['tests', 'verification', 'browser'];
    const planningNamespaces = ['workflows', 'tasks'];

    if (input.intent.kind === 'generate') {
      return [
        this.milestone('plan', 'Plan', [
          this.step('resolve-intent', 'Resolve target and scope', 'planner', 'workflows', 'workflow.create', false, ['workflow blueprint']),
          this.step('compose-request', 'Compose governed request', 'planner', 'tasks', 'task.create', false, ['task breakdown']),
        ]),
        this.milestone('generate', 'Generate', this.stepsFromNamespaces(buildNamespaces, capabilities, 'developer')),
        this.milestone('verify', 'Verify', this.stepsFromNamespaces([...verificationNamespaces], capabilities, 'verifier')),
      ];
    }

    if (input.intent.kind === 'verify' || input.intent.kind === 'test') {
      return [
        this.milestone('inspect', 'Inspect', this.stepsFromNamespaces(['tests', 'verification'], capabilities, 'verifier')),
        this.milestone('evidence', 'Evidence', [
          this.step('collect-evidence', 'Collect verification evidence', 'verifier', 'verification', 'verification.run', false, ['verification report', 'evidence hash']),
        ]),
      ];
    }

    return [
      this.milestone('plan', 'Plan', this.stepsFromNamespaces(planningNamespaces, capabilities, 'planner')),
      this.milestone('build', 'Build', this.stepsFromNamespaces([...buildNamespaces, 'files'], capabilities, 'developer')),
      this.milestone('verify', 'Verify', this.stepsFromNamespaces([...verificationNamespaces, 'files'], capabilities, 'verifier')),
    ];
  }

  private stepsFromNamespaces(namespaces: readonly string[], capabilities: Map<string, ResolvedCapability>, role: ExecutionRole): readonly ExecutionStep[] {
    const unique = new Set<string>();
    const steps: ExecutionStep[] = [];
    for (const namespace of namespaces) {
      if (unique.has(namespace)) continue;
      unique.add(namespace);
      const capability = capabilities.get(namespace);
      if (!capability) continue;
      if (namespace === 'generator') {
        let pushed = false;
        if (capability.operations.includes('generator.preview')) {
          steps.push(this.step(
            'generator-preview',
            this.titleFor('generator', 'generator.preview'),
            roleForNamespace(namespace, role),
            namespace,
            'generator.preview',
            false,
            this.evidenceFor('generator', 'generator.preview'),
          ));
          pushed = true;
        }
        if (capability.operations.includes('generator.apply')) {
          steps.push(this.step(
            'generator-apply',
            this.titleFor('generator', 'generator.apply'),
            roleForNamespace(namespace, role),
            namespace,
            'generator.apply',
            true,
            this.evidenceFor('generator', 'generator.apply'),
          ));
          pushed = true;
        }
        if (pushed) continue;
      }
      const operation = this.preferredOperation(namespace, capability.operations);
      steps.push(this.step(
        `${namespace}-${operation}`,
        this.titleFor(namespace, operation),
        roleForNamespace(namespace, role),
        namespace,
        operation,
        this.requiresApproval(namespace, operation),
        this.evidenceFor(namespace, operation),
      ));
    }
    return steps;
  }

  private milestone(id: string, title: string, steps: readonly ExecutionStep[]): ExecutionMilestone {
    return { id, title, steps };
  }

  private step(
    id: string,
    title: string,
    role: ExecutionRole,
    capability: string,
    operation: string,
    requiresApproval: boolean,
    evidence: readonly string[],
  ): ExecutionStep {
    return { id, title, role, capability, operation, requiresApproval, evidence };
  }

  private preferredOperation(namespace: string, operations: readonly string[]): string {
    const preferred = PREFERRED_OPERATIONS[namespace] ?? [];
    for (const operation of preferred) {
      if (operations.includes(operation)) return operation;
    }
    return operations[0] ?? `${namespace}.inspect`;
  }

  private titleFor(namespace: string, operation: string): string {
    const labels: Readonly<Record<string, string>> = {
      'workflow.create': 'Compose workflow',
      'workflow.validate': 'Validate workflow',
      'workflow.run.start': 'Start workflow run',
      'task.create': 'Create task breakdown',
      'task.assign': 'Assign tasks',
      'component.register': 'Register component contract',
      'component.tree.validate': 'Validate component tree',
      'theme.resolve': 'Resolve theme bindings',
      'theme.mui': 'Build MUI theme',
      'template.instantiate': 'Instantiate template',
      'page.validate': 'Validate page composition',
      'application.model': 'Resolve application model',
      'generator.plan': 'Plan generation',
      'generator.preview': 'Preview generated artifacts',
      'generator.apply': 'Apply approved artifacts',
      'verification.run': 'Run verification',
      'tests.run': 'Run tests',
      'browser.screenshot': 'Capture browser evidence',
      'file.transaction.preview': 'Preview file transaction',
      'file.transaction.apply': 'Apply file transaction',
    };
    return labels[operation] ?? `${namespace}.${operation.split('.').at(-1) ?? 'step'}`;
  }

  private evidenceFor(namespace: string, operation: string): readonly string[] {
    const map: Readonly<Record<string, readonly string[]>> = {
      'workflow.create': ['workflow definition'],
      'workflow.validate': ['workflow validation'],
      'workflow.run.start': ['workflow run'],
      'task.create': ['task breakdown'],
      'task.assign': ['task assignment'],
      'component.register': ['component diff'],
      'component.tree.validate': ['tree validation report'],
      'theme.resolve': ['theme resolution'],
      'theme.mui': ['mui theme snapshot'],
      'template.instantiate': ['template instantiation'],
      'page.validate': ['page validation report'],
      'application.model': ['application model'],
      'generator.plan': ['generation plan'],
      'generator.preview': ['preview diff'],
      'generator.apply': ['apply record'],
      'verification.run': ['verification report', 'evidence hash'],
      'tests.run': ['test report'],
      'browser.screenshot': ['screenshot evidence'],
      'file.transaction.preview': ['file diff'],
      'file.transaction.apply': ['file transaction record'],
    };
    return map[operation] ?? [`${namespace} evidence`];
  }

  private requiresApproval(namespace: string, operation: string): boolean {
    return operation === 'generator.apply' || operation === 'file.transaction.apply' || namespace === 'system';
  }

  private buildEvidence(milestones: readonly ExecutionMilestone[]): readonly string[] {
    const evidence = new Set<string>();
    for (const milestone of milestones) {
      for (const step of milestone.steps) {
        for (const item of step.evidence) evidence.add(item);
      }
    }
    return [...evidence];
  }

  private buildSummary(input: ComposeExecutionPlanInput, milestones: readonly ExecutionMilestone[]): string {
    const namespaces = input.capabilities.map((capability) => capability.namespace).join(', ');
    return `${input.intent.kind.toUpperCase()} ${input.intent.target} through ${namespaces || 'no available capabilities'} across ${milestones.length} milestone(s).`;
  }
}

const PREFERRED_OPERATIONS: Readonly<Record<string, readonly string[]>> = {
  workflows: ['workflow.create', 'workflow.validate', 'workflow.run.start'],
  tasks: ['task.create', 'task.assign'],
  components: ['component.register', 'component.tree.validate'],
  themes: ['theme.resolve', 'theme.mui'],
  templates: ['template.instantiate'],
  'page-builder': ['page.validate', 'page.create'],
  'application-builder': ['application.model', 'application.create'],
  generator: ['generator.apply', 'generator.preview', 'generator.plan'],
  verification: ['verification.run'],
  tests: ['tests.run'],
  browser: ['browser.screenshot'],
  files: ['file.transaction.preview', 'file.transaction.apply'],
};

function roleForNamespace(namespace: string, fallback: ExecutionRole): ExecutionRole {
  if (['workflows', 'tasks'].includes(namespace)) return 'planner';
  if (['verification', 'tests', 'browser'].includes(namespace)) return 'verifier';
  if (['components', 'themes', 'templates', 'page-builder', 'application-builder', 'generator', 'files'].includes(namespace)) return 'developer';
  return fallback;
}
