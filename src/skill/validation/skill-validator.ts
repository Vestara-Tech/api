import type {
  SkillDefinition,
  SkillValidationIssue,
  SkillValidationResult,
} from '../domain/contracts.js';

/**
 * SKILL-005 — Skill validation. A skill must have an id, name, description,
 * instructions and required capabilities; roles must be from the known set.
 */
export function validateSkill(skill: SkillDefinition): SkillValidationResult {
  const issues: SkillValidationIssue[] = [];
  if (!skill.id.trim()) issues.push({ path: 'id', message: 'id is required', severity: 'error' });
  if (!/^[a-z0-9][a-z0-9-]*$/.test(skill.id)) {
    issues.push({ path: 'id', message: 'id must be lowercase hyphenated', severity: 'error' });
  }
  if (!/^\d+\.\d+\.\d+$/.test(skill.version)) {
    issues.push({ path: 'version', message: 'version must be semver (x.y.z)', severity: 'error' });
  }
  if (!skill.name.trim()) issues.push({ path: 'name', message: 'name is required', severity: 'error' });
  if (!skill.description.trim()) issues.push({ path: 'description', message: 'description is required', severity: 'error' });
  if (!skill.instructions.trim()) issues.push({ path: 'instructions', message: 'instructions are required', severity: 'error' });
  if (skill.requiredCapabilities.length === 0) {
    issues.push({ path: 'requiredCapabilities', message: 'at least one required capability', severity: 'error' });
  }
  for (const cap of skill.requiredCapabilities) {
    if (!cap.trim()) issues.push({ path: 'requiredCapabilities', message: 'empty capability', severity: 'error' });
  }
  for (const role of skill.compatibleRoles ?? []) {
    if (!ROLES.has(role)) {
      issues.push({ path: 'compatibleRoles', message: `unknown role "${role}"`, severity: 'warning' });
    }
  }
  return { ok: issues.every((i) => i.severity === 'warning'), issues };
}

const ROLES = new Set(['planner', 'developer', 'reviewer', 'verifier', 'observer', 'assistant', 'specialist', 'custom']);
