import type { ExecutionComplexity, ExecutionIntentKind, IntentAmbiguity, ResolvedIntent } from './domain/contracts.js';

export interface IntentResolverOptions {
  readonly defaultKind?: ExecutionIntentKind;
}

const EMPTY_AMBIGUITY: IntentAmbiguity = {
  code: 'EMPTY_GOAL',
  message: 'No objective was provided.',
};

function complexityFor(kind: ExecutionIntentKind, target: string): ExecutionComplexity {
  if (kind === 'verify' || kind === 'test' || kind === 'inspect') return 'simple';
  if (kind === 'generate' && !target.toLowerCase().includes('builder')) return 'simple';
  if (kind === 'configure' || kind === 'fix' || kind === 'modify') return 'standard';
  return 'complex';
}

export class IntentResolver {
  private readonly defaultKind: ExecutionIntentKind;

  constructor(options: IntentResolverOptions = {}) {
    this.defaultKind = options.defaultKind ?? 'build';
  }

  resolve(goal: string): ResolvedIntent {
    const normalized = goal.trim().toLowerCase();
    if (!normalized) {
      return {
        kind: this.defaultKind,
        target: 'Vestara task',
        confidence: 0.1,
        complexity: 'simple',
        ambiguities: [EMPTY_AMBIGUITY],
        requiredCapabilities: [],
      };
    }

    if (normalized.includes('theme builder')) {
      return {
        kind: 'build',
        target: 'Theme Builder',
        confidence: 0.98,
        complexity: 'complex',
        ambiguities: [],
        requiredCapabilities: ['components', 'themes', 'templates', 'workflows', 'tasks', 'generator', 'verification'],
      };
    }

    if (normalized.includes('script') || normalized.includes('generate')) {
      return {
        kind: 'generate',
        target: normalized.includes('script') ? 'Script' : 'Artifact',
        confidence: 0.86,
        complexity: 'simple',
        ambiguities: [],
        requiredCapabilities: ['generator', 'verification'],
      };
    }

    if (normalized.includes('verify') || normalized.includes('test')) {
      return {
        kind: normalized.includes('test') ? 'test' : 'verify',
        target: 'Verification target',
        confidence: 0.84,
        complexity: 'simple',
        ambiguities: [],
        requiredCapabilities: ['tests', 'verification'],
      };
    }

    if (normalized.includes('configure') || normalized.includes('configuration')) {
      return {
        kind: 'configure',
        target: 'Configuration',
        confidence: 0.78,
        complexity: 'standard',
        ambiguities: [],
        requiredCapabilities: ['workflows', 'tasks', 'generator', 'verification'],
      };
    }

    if (normalized.includes('fix') || normalized.includes('repair') || normalized.includes('update') || normalized.includes('change')) {
      return {
        kind: normalized.includes('fix') || normalized.includes('repair') ? 'fix' : 'modify',
        target: 'Vestara task',
        confidence: 0.72,
        complexity: 'standard',
        ambiguities: [],
        requiredCapabilities: ['workflows', 'tasks', 'generator', 'verification'],
      };
    }

    return {
      kind: this.defaultKind,
      target: 'Vestara task',
      confidence: 0.55,
      complexity: complexityFor(this.defaultKind, 'Vestara task'),
      ambiguities: [
        {
          code: 'IMPLICIT_TARGET',
          message: 'The target is not explicit; planning will use the default Vestara task target.',
        },
      ],
      requiredCapabilities: ['workflows', 'tasks', 'generator', 'verification'],
    };
  }
}
