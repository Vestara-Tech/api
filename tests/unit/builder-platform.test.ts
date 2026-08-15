import { describe, expect, it } from 'vitest';
import {
  PageValidator,
  bumpPageRevision,
  diffPages,
  PageService,
  type PageDefinition,
} from '../../src/pagebuilder/index.js';
import {
  validateApplication,
  canTransition,
  ApplicationBuilderService,
  type ApplicationDefinition,
} from '../../src/appbuilder/index.js';

function page(overrides: Partial<PageDefinition> = {}): PageDefinition {
  return {
    id: 'users',
    name: 'Users',
    route: '/users',
    layout: { type: 'header-sidebar-content', content: { id: 'n1', component: { definitionId: 'data-grid' }, props: {}, bindings: [], events: [], actions: [], state: [], permissions: [], children: [] } },
    nodes: [],
    dataSources: [{ id: 'ds1', source: 'api', operation: 'users.list' }],
    actions: [{ id: 'act1', kind: 'workflow.start', target: 'create-user' }],
    permissions: [{ id: 'perm1', permission: 'users.read', mode: 'show' }],
    responsive: [{ breakpoint: 'mobile', layout: 'stack' }],
    metadata: { title: 'Users', authRequired: true },
    revision: 1,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('PAGE-010 page validation', () => {
  it('validates a well-formed page', () => {
    const validator = new PageValidator({ has: (id) => id === 'data-grid' });
    const result = validator.validate(page());
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('rejects unknown components and bad routes', () => {
    const validator = new PageValidator({ has: () => false });
    const result = validator.validate(page({ route: 'users' }));
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes('Unknown component'))).toBe(true);
    expect(result.issues.some((i) => i.message.includes('Route'))).toBe(true);
  });

  it('flags workflow actions without targets', () => {
    const validator = new PageValidator({ has: () => true });
    const result = validator.validate(page({ actions: [{ id: 'a1', kind: 'workflow.start' }] }));
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes('target workflow'))).toBe(true);
  });
});

describe('PAGE-011/013 revisions + diff', () => {
  it('bumps revisions on edit', () => {
    const next = bumpPageRevision(page());
    expect(next.revision).toBe(2);
    expect(next.updatedAt).toBeTruthy();
  });

  it('diffs added/removed/modified', () => {
    const a = page();
    const b = page({ metadata: { title: 'User Directory', authRequired: true } });
    b.nodes = [{ id: 'n2', component: { definitionId: 'button' }, props: {}, bindings: [], events: [], actions: [], state: [], permissions: [], children: [] }];
    const diff = diffPages(a, b);
    expect(diff.some((d) => d.path === 'metadata.title' && d.kind === 'modified')).toBe(true);
    expect(diff.some((d) => d.path === 'nodes.n2' && d.kind === 'added')).toBe(true);
  });
});

describe('PAGE service registry', () => {
  it('creates, updates, gets, lists and removes pages', () => {
    const service = new PageService({ componentResolver: { has: () => true } });
    const created = service.create(page());
    expect(created.revision).toBe(1);

    const updated = service.update('users', { metadata: { title: 'User Directory', authRequired: true } });
    expect(updated.revision).toBe(2);

    expect(service.get('users').metadata.title).toBe('User Directory');
    expect(service.list()).toHaveLength(1);
    expect(service.hasComponent('data-grid')).toBe(true);

    service.remove('users');
    expect(service.list()).toHaveLength(0);
  });
});

describe('APP-001 application definition', () => {
  it('validates routes reference known pages', () => {
    const app: ApplicationDefinition = {
      id: 'customer-portal', name: 'Customer Portal', version: '1.0.0', applicationType: 'web',
      pages: [{ pageId: 'users', path: '/users' }],
      routes: [{ path: '/users', pageId: 'users', authRequired: true }, { path: '/missing', pageId: 'nope', authRequired: false }],
      navigation: [], apis: [], databases: [], authentication: { enabled: true, provider: 'vestara' },
      permissions: [], workflows: [], agents: [], configuration: [], integrations: [], state: [],
      lifecycle: 'draft', revision: 1, updatedAt: new Date().toISOString(),
    };
    const errors = validateApplication(app);
    expect(errors.some((e) => e.includes('unknown page "nope"'))).toBe(true);
  });

  it('rejects ungoverned direct database writes', () => {
    const app: ApplicationDefinition = {
      id: 'a', name: 'A', version: '1', applicationType: 'dashboard',
      pages: [], routes: [], navigation: [],
      apis: [], databases: [{ id: 'd1', database: 'app', table: 'users', operations: ['write'], governed: false }],
      authentication: { enabled: true, provider: 'vestara' },
      permissions: [], workflows: [], agents: [], configuration: [], integrations: [], state: [],
      lifecycle: 'draft', revision: 1, updatedAt: new Date().toISOString(),
    };
    const errors = validateApplication(app);
    expect(errors.some((e) => e.includes('must be governed'))).toBe(true);
  });

  it('validates lifecycle transitions', () => {
    expect(canTransition('draft', 'planning')).toBe(true);
    expect(canTransition('draft', 'published')).toBe(false);
    expect(canTransition('building', 'ready')).toBe(true);
  });
});

describe('APP builder service', () => {
  it('creates, transitions and resolves pages', () => {
    const pages = new PageService({ componentResolver: { has: () => true } });
    pages.create(page());
    const service = new ApplicationBuilderService({
      pages: { get: (id) => pages.get(id), list: () => pages.list() },
    });

    const app = service.create({
      id: 'customer-portal', name: 'Customer Portal', version: '1.0.0', applicationType: 'web',
      pages: [{ pageId: 'users', path: '/users' }],
      routes: [{ path: '/users', pageId: 'users', authRequired: true }],
      navigation: [], apis: [], databases: [], authentication: { enabled: true, provider: 'vestara' },
      permissions: [], workflows: [], agents: [], configuration: [], integrations: [], state: [],
    });
    expect(app.lifecycle).toBe('draft');

    const planning = service.transition(app.id, 'planning');
    expect(planning.lifecycle).toBe('planning');

    const model = service.model(app.id);
    expect(model.pages).toHaveLength(1);
    expect(model.pages[0]!.id).toBe('users');
  });

  it('rejects invalid transitions', () => {
    const service = new ApplicationBuilderService();
    const app = service.create({
      id: 'a', name: 'A', version: '1', applicationType: 'web',
      pages: [], routes: [], navigation: [], apis: [], databases: [],
      authentication: { enabled: false, provider: 'vestara' },
      permissions: [], workflows: [], agents: [], configuration: [], integrations: [], state: [],
    });
    expect(() => service.transition(app.id, 'published')).toThrow(/Cannot transition/);
  });
});
