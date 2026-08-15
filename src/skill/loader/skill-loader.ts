import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { SkillDefinition, SkillPackage } from '../domain/contracts.js';

export interface SkillLoaderOptions {
  readonly manifestFile?: string;
  readonly instructionsFile?: string;
}

/**
 * SKILL-003 — SKILL.md loader. Reads a portable skill package
 * (skill.json + SKILL.md) from a directory on disk.
 */
export class SkillLoader {
  private readonly manifestFile: string;
  private readonly instructionsFile: string;

  constructor(options: SkillLoaderOptions = {}) {
    this.manifestFile = options.manifestFile ?? 'skill.json';
    this.instructionsFile = options.instructionsFile ?? 'SKILL.md';
  }

  async loadFromDirectory(dir: string): Promise<SkillPackage> {
    const manifest = JSON.parse(await readFile(resolve(dir, this.manifestFile), 'utf8')) as SkillDefinition;
    const instructionsMarkdown = await readFile(resolve(dir, this.instructionsFile), 'utf8');
    return {
      manifest,
      instructionsMarkdown,
      resources: manifest.resources ?? [],
    };
  }

  /** Parse a skill.json manifest string (used by tests and embedded packages). */
  parseManifest(json: string): SkillDefinition {
    return JSON.parse(json) as SkillDefinition;
  }
}

export function skillPackageToDefinition(pkg: SkillPackage): SkillDefinition {
  return {
    ...pkg.manifest,
    instructions: pkg.instructionsMarkdown,
  };
}
