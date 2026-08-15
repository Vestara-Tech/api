import type { BrowserAction, BrowserActionKind } from '../contracts.js';

export type BrowserPermission = 'browser:navigate' | 'browser:read' | 'browser:interact' | 'browser:download' | 'browser:upload' | 'browser:authenticate' | 'browser:execute-script' | 'browser:external' | 'browser:credential-use';

export type BrowserRisk = 'low' | 'medium' | 'high';

const ACTION_RISK: Readonly<Record<BrowserActionKind, BrowserRisk>> = {
  navigate: 'low',
  back: 'low',
  forward: 'low',
  reload: 'low',
  click: 'medium',
  type: 'medium',
  select: 'medium',
  scroll: 'low',
  inspect: 'low',
  extract: 'low',
  screenshot: 'low',
  wait: 'low',
  'execute-script': 'high',
  download: 'medium',
};

const ACTION_PERMISSION: Readonly<Record<BrowserActionKind, BrowserPermission>> = {
  navigate: 'browser:navigate',
  back: 'browser:navigate',
  forward: 'browser:navigate',
  reload: 'browser:navigate',
  click: 'browser:interact',
  type: 'browser:interact',
  select: 'browser:interact',
  scroll: 'browser:read',
  inspect: 'browser:read',
  extract: 'browser:read',
  screenshot: 'browser:read',
  wait: 'browser:read',
  'execute-script': 'browser:execute-script',
  download: 'browser:download',
};

export interface BrowserPolicyDecision {
  readonly allowed: boolean;
  readonly approvalRequired: boolean;
  readonly permission: BrowserPermission;
  readonly risk: BrowserRisk;
  readonly reason: string;
}

/**
 * BRW-002/010 — Browser policy gateway. Reuses Vestara governed-execution
 * concepts; the browser is governed like filesystem/process execution. Agent
 * requests never bypass this gate.
 */
export class BrowserPolicyGateway {
  evaluate(action: BrowserAction, hasPermission: boolean): BrowserPolicyDecision {
    const permission = ACTION_PERMISSION[action.kind] ?? 'browser:read';
    const risk = ACTION_RISK[action.kind] ?? 'low';
    if (!hasPermission) {
      return { allowed: false, approvalRequired: false, permission, risk, reason: `Agent lacks ${permission}` };
    }
    if (risk === 'high') {
      return { allowed: false, approvalRequired: true, permission, risk, reason: `${action.kind} requires approval` };
    }
    return { allowed: true, approvalRequired: false, permission, risk, reason: `${action.kind} allowed (${risk} risk)` };
  }
}
