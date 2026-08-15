/** OS-005/006/007 — desired/current state model, diff engine, change planner. */

import type { OsProfile } from './os-profile.js';

export type OsLifecycleState =
  | 'uninitialized'
  | 'provisioning'
  | 'configured'
  | 'running'
  | 'updating'
  | 'restarting'
  | 'degraded'
  | 'recovery'
  | 'rollback';

export interface OsLifecycleStateRecord {
  readonly state: OsLifecycleState;
  readonly since: string;
  readonly message?: string;
  readonly previous?: OsLifecycleState;
}

export interface OsCurrentState {
  readonly profile: OsProfile;
  readonly lifecycle: OsLifecycleStateRecord;
  readonly capturedAt: string;
}

export interface OsDesiredState {
  readonly profile: OsProfile;
  readonly revision: number;
  readonly updatedAt: string;
}

/** The combination of current + desired that drives reconciliation. */
export interface OsStateModel {
  readonly current: OsCurrentState;
  readonly desired: OsDesiredState;
  readonly driftCount: number;
}

export type OsDiffCategory = 'packages' | 'kernel' | 'services' | 'users' | 'startup' | 'login' | 'desktop' | 'network' | 'locale' | 'security' | 'updates' | 'recovery' | 'repositories' | 'identity';

export type OsChangeKind = 'install' | 'remove' | 'upgrade' | 'hold' | 'enable' | 'disable' | 'create' | 'update' | 'delete' | 'configure' | 'set' | 'rebuild-initramfs';

export type OsChangeRisk = 'low' | 'medium' | 'high' | 'critical';

export interface OsDiffEntry {
  readonly category: OsDiffCategory;
  readonly key: string;
  readonly from: unknown;
  readonly to: unknown;
}

export interface OsDiff {
  readonly entries: readonly OsDiffEntry[];
  readonly driftCount: number;
  readonly generatedAt: string;
}

export interface OsChange {
  readonly id: string;
  readonly kind: OsChangeKind;
  readonly category: OsDiffCategory;
  readonly target: string;
  readonly from?: unknown;
  readonly to?: unknown;
  readonly risk: OsChangeRisk;
  readonly requiresReboot: boolean;
  readonly requiresApproval: boolean;
  readonly requiresSystemCapability?: string;
}

export interface OsChangePlan {
  readonly planId: string;
  readonly changes: readonly OsChange[];
  readonly order: readonly string[];
  readonly totalRisk: 'low' | 'medium' | 'high' | 'critical';
  readonly requiresApproval: boolean;
  readonly requiresReboot: boolean;
  readonly planHash: string;
  readonly generatedAt: string;
}

export interface OsChangePlannerPort {
  plan(diff: OsDiff): OsChangePlan;
}

const CATEGORY_RISK: Record<OsDiffCategory, OsChangeRisk> = {
  packages: 'medium',
  repositories: 'high',
  kernel: 'high',
  services: 'medium',
  users: 'high',
  startup: 'medium',
  login: 'medium',
  desktop: 'low',
  network: 'medium',
  locale: 'low',
  security: 'high',
  updates: 'high',
  recovery: 'medium',
  identity: 'low',
};

/**
 * OS-005 — State model. Current (captured) + desired (declared) with drift
 * count. The module never mutates /etc directly; it reconciles the diff.
 */
export function createOsStateModel(current: OsCurrentState, desired: OsDesiredState): OsStateModel {
  const diff = diffOsProfiles(current.profile, desired.profile);
  return { current, desired, driftCount: diff.entries.length };
}

/**
 * OS-006 — Diff engine. Compares current vs desired OsProfile field by field
 * into a set of categorized diff entries. Debian assumptions never leak in:
 * the diff works on the canonical profile contract.
 */
export function diffOsProfiles(current: OsProfile, desired: OsProfile): OsDiff {
  const entries: OsDiffEntry[] = [];
  const add = (category: OsDiffCategory, key: string, from: unknown, to: unknown): void => {
    if (JSON.stringify(from) !== JSON.stringify(to)) entries.push({ category, key: `${category}.${key}`, from, to });
  };

  add('identity', 'hostname', current.identity.hostname, desired.identity.hostname);
  add('locale', 'language', current.locale.language, desired.locale.language);
  add('locale', 'timezone', current.locale.timezone, desired.locale.timezone);
  add('locale', 'locale', current.locale.locale, desired.locale.locale);
  add('locale', 'keymap', current.locale.keymap, desired.locale.keymap);
  add('network', 'hostname', current.network.hostname, desired.network.hostname);

  add('desktop', 'environment', current.desktop.environment, desired.desktop.environment);
  add('desktop', 'theme', current.desktop.theme, desired.desktop.theme);
  add('desktop', 'wallpaper', current.desktop.wallpaper, desired.desktop.wallpaper);
  add('desktop', 'startupApplications', current.desktop.startupApplications, desired.desktop.startupApplications);

  add('startup', 'target', current.startup.target, desired.startup.target);
  add('startup', 'timeout', current.startup.timeoutSeconds, desired.startup.timeoutSeconds);
  add('startup', 'failurePolicy', current.startup.failurePolicy, desired.startup.failurePolicy);

  add('login', 'provider', current.login.provider, desired.login.provider);
  add('login', 'allowAutoLogin', current.login.allowAutoLogin, desired.login.allowAutoLogin);

  add('updates', 'channel', current.updates.channel, desired.updates.channel);
  add('updates', 'automatic', current.updates.automatic, desired.updates.automatic);
  add('updates', 'rebootPolicy', current.updates.rebootPolicy, desired.updates.rebootPolicy);

  add('security', 'lockdown', current.security.lockdown, desired.security.lockdown);
  add('security', 'firewalld', current.security.firewalld, desired.security.firewalld);

  add('kernel', 'release', current.kernel.release, desired.kernel.release);
  add('kernel', 'parameters', current.kernel.parameters, desired.kernel.parameters);
  add('kernel', 'updatePolicy', current.kernel.updatePolicy, desired.kernel.updatePolicy);

  // Packages: compare by name/version/state.
  const currentPackages = new Map(current.packages.packages.map((p) => [p.name, p]));
  for (const pkg of desired.packages.packages) {
    const currentPkg = currentPackages.get(pkg.name);
    if (!currentPkg || currentPkg.version !== pkg.version || currentPkg.state !== pkg.state) {
      add('packages', pkg.name, currentPkg, pkg);
    }
  }
  for (const pkg of current.packages.packages) {
    if (!desired.packages.packages.some((p) => p.name === pkg.name)) {
      add('packages', pkg.name, pkg, { ...pkg, state: 'absent' });
    }
  }

  // Services.
  const currentServices = new Map(current.services.services.map((s) => [s.name, s]));
  for (const service of desired.services.services) {
    const currentService = currentServices.get(service.name);
    if (!currentService || currentService.state !== service.state) {
      add('services', service.name, currentService, service);
    }
  }

  // Users: compare by username.
  const currentUsers = new Map(current.users.map((u) => [u.username, u]));
  for (const user of desired.users) {
    const currentUser = currentUsers.get(user.username);
    if (!currentUser || currentUser.autoLogin !== user.autoLogin) {
      add('users', user.username, currentUser, user);
    }
  }
  for (const user of current.users) {
    if (!desired.users.some((u) => u.username === user.username)) {
      add('users', user.username, user, undefined);
    }
  }

  // Repositories.
  const currentRepos = new Map(current.packages.repositories.map((r) => [r.name, r]));
  for (const repo of desired.packages.repositories) {
    const currentRepo = currentRepos.get(repo.name);
    if (!currentRepo || currentRepo.url !== repo.url || currentRepo.enabled !== repo.enabled) {
      add('repositories', repo.name, currentRepo, repo);
    }
  }

  return { entries, driftCount: entries.length, generatedAt: new Date().toISOString() };
}

/**
 * OS-007 — Change planner. Compiles a diff into an ordered change plan with
 * risk, reboot and approval requirements. Plans, not mutations: the plan is
 * approved before any OS mutation.
 */
export function planOsChanges(diff: OsDiff): OsChangePlan {
  const changes: OsChange[] = [];
  const order: string[] = [];

  for (const entry of diff.entries) {
    const risk = CATEGORY_RISK[entry.category];
    const requiresReboot = entry.category === 'kernel' || entry.category === 'updates';
    const requiresApproval = risk === 'high' || risk === 'critical' || requiresReboot;
    const kind = changeKindFor(entry);
    const capability = requiresSystemCapabilityFor(kind, entry.category);
    const change: OsChange = {
      id: `chg_${order.length + 1}`,
      kind,
      category: entry.category,
      target: entry.key,
      ...(entry.from !== undefined ? { from: entry.from } : {}),
      ...(entry.to !== undefined ? { to: entry.to } : {}),
      risk,
      requiresReboot,
      requiresApproval,
      ...(capability !== undefined ? { requiresSystemCapability: capability } : {}),
    };
    changes.push(change);
    order.push(change.id);
  }

  const highestRisk: 'low' | 'medium' | 'high' | 'critical' = changes.reduce<'low' | 'medium' | 'high' | 'critical'>(
    (acc, c) => (c.risk === 'critical' ? 'critical' : c.risk === 'high' ? (acc === 'critical' ? acc : 'high') : acc),
    'low',
  );

  return {
    planId: `plan_${hashString(JSON.stringify(changes)).slice(0, 10)}`,
    changes,
    order,
    totalRisk: highestRisk,
    requiresApproval: changes.some((c) => c.requiresApproval),
    requiresReboot: changes.some((c) => c.requiresReboot),
    planHash: hashString(JSON.stringify(changes)),
    generatedAt: new Date().toISOString(),
  };
}

function changeKindFor(entry: OsDiffEntry): OsChangeKind {
  switch (entry.category) {
    case 'packages': {
      const to = entry.to as { state?: string } | undefined;
      if (to?.state === 'absent') return 'remove';
      if (to?.state === 'held') return 'hold';
      return entry.from === undefined ? 'install' : 'upgrade';
    }
    case 'services': {
      const to = entry.to as { state?: string } | undefined;
      return to?.state === 'disabled' ? 'disable' : 'enable';
    }
    case 'users': {
      return entry.to === undefined ? 'delete' : entry.from === undefined ? 'create' : 'update';
    }
    case 'kernel':
      return entry.key === 'kernel.parameters' ? 'set' : 'rebuild-initramfs';
    default:
      return 'configure';
  }
}

function requiresSystemCapabilityFor(kind: OsChangeKind, category: OsDiffCategory): string | undefined {
  if (category === 'kernel') return 'system.kernel.param.set';
  if (category === 'users' && kind === 'create') return 'system.user.create';
  if (category === 'repositories') return 'system.package.repositories.write';
  return undefined;
}

function hashString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}
