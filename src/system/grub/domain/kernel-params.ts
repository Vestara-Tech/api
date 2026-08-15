export type KernelParamSeverity = 'safe' | 'informational' | 'dangerous' | 'critical' | 'unknown';

export interface KernelParamRule {
  readonly name: string;
  readonly severity: KernelParamSeverity;
  readonly reason: string;
}

/**
 * Kernel-parameter governance.
 *
 * Vestara does not accept an unrestricted command-line string. Known
 * parameters are modeled individually; dangerous parameters are rejected or
 * escalated according to policy.
 */
const KNOWN: readonly KernelParamRule[] = [
  { name: 'quiet', severity: 'safe', reason: 'suppress kernel log output' },
  { name: 'splash', severity: 'safe', reason: 'show a splash screen during boot' },
  { name: 'nosplash', severity: 'safe', reason: 'disable splash screen' },
  { name: 'loglevel', severity: 'informational', reason: 'kernel log verbosity level' },
  { name: 'systemd.show_status', severity: 'safe', reason: 'show or hide systemd boot status' },
  { name: 'console', severity: 'informational', reason: 'console device' },
  { name: 'init', severity: 'dangerous', reason: 'override the init process' },
  { name: 'rdinit', severity: 'dangerous', reason: 'override the initramfs init' },
  { name: 'single', severity: 'dangerous', reason: 'boot into single-user mode' },
  { name: 'emergency', severity: 'dangerous', reason: 'boot into emergency mode' },
  { name: 'init=/bin/bash', severity: 'critical', reason: 'boot directly to a root shell' },
  { name: 'nokaslr', severity: 'dangerous', reason: 'disable kernel address-space randomization' },
  { name: 'mitigations=off', severity: 'dangerous', reason: 'disable CPU mitigations' },
  { name: 'memmap', severity: 'dangerous', reason: 'alter physical memory layout' },
];

export type KernelParamVerdict = 'allow' | 'reject';

export interface KernelParamEvaluation {
  readonly parameter: string;
  readonly verdict: KernelParamVerdict;
  readonly severity: KernelParamSeverity;
  readonly reason: string;
  readonly requiresEscalation: boolean;
}

/** Evaluate a single kernel parameter (may be `name=value`). */
export function evaluateKernelParam(raw: string): KernelParamEvaluation {
  const name = raw.split('=')[0]!;
  const rule = KNOWN.find((k) => k.name === name);
  if (!rule) {
    return { parameter: raw, verdict: 'allow', severity: 'unknown', reason: 'unrecognized parameter', requiresEscalation: true };
  }
  return {
    parameter: raw,
    verdict: rule.severity === 'dangerous' || rule.severity === 'critical' ? 'reject' : 'allow',
    severity: rule.severity,
    reason: rule.reason,
    requiresEscalation: rule.severity === 'unknown',
  };
}

export interface KernelParamsValidationResult {
  readonly ok: boolean;
  readonly evaluations: readonly KernelParamEvaluation[];
  readonly blocked: readonly KernelParamEvaluation[];
}

/** Validate a set of kernel parameters; reject dangerous ones outright. */
export function validateKernelParams(parameters: readonly string[]): KernelParamsValidationResult {
  const evaluations = parameters.map(evaluateKernelParam);
  const blocked = evaluations.filter((e) => e.verdict === 'reject');
  return { ok: blocked.length === 0, evaluations, blocked };
}
