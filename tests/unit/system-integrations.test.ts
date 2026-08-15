import { describe, expect, it } from 'vitest';
import {
  ApprovalWorkflow,
  RollbackFramework,
  VestaraSystemDaemon,
  devSystemDaemon,
  SystemReconciler,
  SystemIntegrations,
  SystemV2Service,
  type SystemOperationKind,
} from '../../src/system/index.js';

describe('SYS-055 approval workflow V2', () => {
  it('approves high-risk operations with a single approval', () => {
    const workflow = new ApprovalWorkflow();
    const request = workflow.create({ id: 'op1', kind: 'system.service.restart', risk: 'high' });
    expect(request.required).toBe(1);
    workflow.approve(request.id, 'approver1');
    expect(workflow.isApproved(request.id)).toBe(true);
    expect(workflow.get(request.id)!.status).toBe('approved');
  });

  it('requires dual approval for critical operations', () => {
    const workflow = new ApprovalWorkflow();
    const request = workflow.create({ id: 'op2', kind: 'system.power.reboot', risk: 'critical' });
    expect(request.required).toBe(2);
    workflow.approve(request.id, 'approver1');
    expect(workflow.isApproved(request.id)).toBe(false);
    workflow.approve(request.id, 'approver2');
    expect(workflow.isApproved(request.id)).toBe(true);
  });

  it('rejects and expires requests', () => {
    const workflow = new ApprovalWorkflow();
    const request = workflow.create({ id: 'op3', kind: 'system.mount.create', risk: 'medium' });
    workflow.reject(request.id);
    expect(workflow.get(request.id)!.status).toBe('rejected');
    expect(workflow.isApproved(request.id)).toBe(false);
  });
});

describe('SYS-057 rollback framework', () => {
  it('captures and rolls back pre-images', () => {
    const rollback = new RollbackFramework();
    const point = rollback.capture({ operationId: 'op1', target: '/etc/default/grub', kind: 'grub', preImage: { timeout: 3 } });
    expect(rollback.pointsFor('op1')).toHaveLength(1);
    expect(point.preImage).toEqual({ timeout: 3 });
    const rolled = rollback.rollbackAll('op1');
    expect(rolled).toHaveLength(1);
    expect(rollback.pointsFor('op1')).toHaveLength(0);
  });

  it('commits successfully applied operations', () => {
    const rollback = new RollbackFramework();
    rollback.capture({ operationId: 'op2', target: 'x', kind: 'mount', preImage: {} });
    rollback.commit('op2');
    expect(rollback.pointsFor('op2')).toHaveLength(0);
  });
});

describe('SYS-052 vestara-systemd daemon', () => {
  it('executes only registered typed handlers', async () => {
    const daemon = devSystemDaemon();
    expect(daemon.has('system.service.restart')).toBe(true);
    expect(daemon.refuses('system.shell.root')).toBe(true);
    const result = await daemon.execute('system.service.restart', 'vestara-api.service');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('vestara-systemd');
  });
});

describe('SYS-061/062 system reconciler', () => {
  it('detects drift between desired and current state', () => {
    const reconciler = new SystemReconciler((key) => (key === 'system.hostname' ? 'old-host' : undefined));
    const inSync = reconciler.reconcile({ 'system.hostname': 'old-host' });
    expect(inSync.status).toBe('in-sync');
    const drift = reconciler.reconcile({ 'system.hostname': 'new-host', 'system.locale': 'en_US.UTF-8' });
    expect(drift.status).toBe('drift-detected');
    expect(drift.diff).toHaveLength(2);
  });
});

describe('SYS-058..064 system integrations', () => {
  it('measures health through the integrations facade', async () => {
    const system = new SystemV2Service();
    const health = await system.health();
    expect(health.api).toBe('running');
    expect(health.agentRuntime).toBe('running');
    expect(health.measuredAt).toBeTruthy();
  });

  it('reports which integrations are configured', () => {
    const integrations = new SystemIntegrations();
    const configured = integrations.configured();
    expect(configured).toEqual({ log: false, diagnostics: false, generator: false, image: false });

    const logged = new SystemIntegrations({
      log: { info: () => undefined, warn: () => undefined, error: () => undefined },
      diagnostics: { runCheck: async () => [] },
      generator: { generate: async () => [] },
      image: { planV2: async () => ({}), preflight: async () => ({}) },
    });
    expect(logged.configured().log).toBe(true);
    expect(logged.configured().diagnostics).toBe(true);
    expect(logged.configured().generator).toBe(true);
    expect(logged.configured().image).toBe(true);
  });
});

describe('SYS-052..064 end-to-end daemon flow', () => {
  it('requests -> approval -> executes through the daemon (fails honestly in dev)', async () => {
    const system = new SystemV2Service();
    const kind: SystemOperationKind = 'system.service.restart';
    const { journal, approval } = await system.daemonExecute(kind, 'vestara-api.service', 'user1');
    expect(journal.status).toBe('requested');
    expect(approval.status).toBe('pending');
    expect(approval.required).toBe(1);

    const result = await system.daemonApproveAndRun(approval.id, 'approver1');
    expect(result.executed).toBe(true);
    expect(result.result?.ok).toBe(false);
    expect(system.approvalsList().length).toBe(1);
  });
});
