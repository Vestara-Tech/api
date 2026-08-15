import type { ImpactAnalysis } from '../contracts.js';

/**
 * TEST-022 — Impact analysis. From changed artifacts + a dependency graph,
 * derives affected capabilities and the recommended (minimal) test set.
 * The deterministic graph is authoritative; AI can augment later.
 */
export class ImpactAnalyzer {
  analyze(input: { changedArtifacts: readonly string[]; capabilityOf: (artifact: string) => readonly string[]; testsOf: (capability: string) => readonly string[] }): ImpactAnalysis {
    const capabilities = new Set<string>();
    for (const artifact of input.changedArtifacts) {
      for (const cap of input.capabilityOf(artifact)) capabilities.add(cap);
    }
    const tests = new Set<string>();
    for (const cap of capabilities) {
      for (const test of input.testsOf(cap)) tests.add(test);
    }
    return {
      changedArtifacts: input.changedArtifacts,
      affectedCapabilities: [...capabilities].sort(),
      affectedTests: [...tests].sort(),
      recommendedTestCount: tests.size,
    };
  }
}
