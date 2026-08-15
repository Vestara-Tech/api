/** SKILL-001 — Skill platform contracts. */

export interface SkillResource {
  readonly path: string;
  readonly kind: 'markdown' | 'template' | 'example' | 'reference';
  readonly content?: string;
}

export interface SkillDefinition {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly description: string;
  readonly instructions: string;
  readonly requiredCapabilities: readonly string[];
  readonly optionalCapabilities?: readonly string[];
  readonly compatibleRoles?: readonly string[];
  readonly resources?: readonly SkillResource[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface SkillValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

export interface SkillValidationResult {
  readonly ok: boolean;
  readonly issues: readonly SkillValidationIssue[];
}

/** A portable skill package: manifest + SKILL.md + resources. */
export interface SkillPackage {
  readonly manifest: SkillDefinition;
  readonly instructionsMarkdown: string;
  readonly resources: readonly SkillResource[];
}
