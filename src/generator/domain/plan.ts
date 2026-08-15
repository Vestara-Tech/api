import { hashOf } from './hash.js';

export type GenerationStepKind =
  | 'resolve-template'
  | 'transform'
  | 'render'
  | 'assemble'
  | 'post-process'
  | 'custom';

export interface GenerationStep {
  readonly id: string;
  readonly kind: GenerationStepKind;
  readonly description: string;
  readonly dependencies?: readonly string[];
  readonly required?: boolean;
}

export interface GenerationRequirement {
  readonly id: string;
  readonly label: string;
  readonly satisfied: boolean;
  readonly detail?: string;
}

export interface GenerationWarning {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
}

export interface GenerationPlan {
  readonly id: string;
  readonly generatorId: string;
  readonly inputHash: string;
  readonly steps: readonly GenerationStep[];
  readonly requirements: readonly GenerationRequirement[];
  readonly warnings: readonly GenerationWarning[];
  readonly planHash: string;
}

export function createGenerationPlan(input: {
  readonly id: string;
  readonly generatorId: string;
  readonly inputHash: string;
  readonly steps: readonly GenerationStep[];
  readonly requirements: readonly GenerationRequirement[];
  readonly warnings?: readonly GenerationWarning[];
}): GenerationPlan {
  const warnings = input.warnings ?? [];
  return {
    id: input.id,
    generatorId: input.generatorId,
    inputHash: input.inputHash,
    steps: input.steps,
    requirements: input.requirements,
    warnings,
    planHash: hashOf({
      id: input.id,
      generatorId: input.generatorId,
      inputHash: input.inputHash,
      steps: input.steps,
      requirements: input.requirements,
      warnings,
    }),
  };
}

export function isPlanSatisfied(plan: GenerationPlan): boolean {
  return plan.requirements.every((r) => r.satisfied);
}
