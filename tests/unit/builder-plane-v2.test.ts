import { describe, expect, it } from 'vitest';
import {
  BuilderSession,
  BuilderPlane,
  BuilderStore,
  BuilderRegistry,
  BuilderLifecycle,
  apiBuilderContribution,
  type BuilderDefinition,
} from '../../src/builder-plane/index.js';

describe('BLD-X v2 BuilderSession', () => {
  it('runs the unified lifecycle: create -> configure -> validate -> preview -> test -> publish', () => {
    const session = new BuilderSession<string, Record<string, unknown>>({ kind: 'api' });
    expect(session.getSession().status).toBe('editing');

    const draft = session.configure({ name: 'Inventory API', operations: ['list'] });
    expect(draft.spec.name).toBe('Inventory API');

    session.validate();
    expect(session.getSession().status).toBe('validated');
    session.preview();
    expect(session.getSession().status).toBe('previewing');
    session.test();
    expect(session.getSession().status).toBe('testing');

    const published = session.publish();
    expect(published.status).toBe('published');
    expect(published.revision).toBe(1);
    expect(session.getSession().status).toBe('published');
  });

  it('clones and exports drafts', () => {
    const session = new BuilderSession<string, Record<string, unknown>>({ kind: 'api' });
    session.configure({ name: 'API' });
    const clone = session.clone();
    expect(clone.id).not.toBe(session.getDraft().id);
    expect(clone.status).toBe('draft');
    expect(clone.revision).toBe(0);

    const exported = session.export();
    expect(exported.kind).toBe('api');
  });

  it('opens from an existing definition', () => {
    const base: BuilderDefinition<string, unknown> = {
      id: 'api_1', kind: 'api', name: 'Base', revision: 3, status: 'published', spec: {}, metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    };
    const session = new BuilderSession<string, unknown>({ kind: 'api', base });
    expect(session.getDraft().id).toBe('api_1');
    expect(session.getDraft().status).toBe('draft');
  });
});

describe('BLD-X v2 BuilderPlane', () => {
  function makePlane() {
    const registry = new BuilderRegistry();
    registry.register(apiBuilderContribution);
    const store = new BuilderStore();
    const lifecycle = new BuilderLifecycle(store, registry);
    return new BuilderPlane(store, registry, lifecycle);
  }

  it('opens sessions, validates drafts and publishes them', () => {
    const plane = makePlane();
    const session = plane.openSession('api');
    session.configure({
      id: 'products', name: 'Products API', namespace: 'inventory', version: '1.0.0', status: 'draft',
      resources: [{
        id: 'product', name: 'product', plural: 'products',
        fields: [{ id: 'f1', name: 'id', type: 'string' }, { id: 'f2', name: 'name', type: 'string' }],
      }],
      endpoints: [{ id: 'e1', method: 'GET', path: '/products', operationId: 'listProducts' }],
      policies: [], operations: [], events: [],
      revision: 0, metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    } as never);

    const validation = plane.validateDraft(session.getSession().sessionId);
    expect(validation.ok).toBe(true);

    const published = plane.publishSession(session.getSession().sessionId);
    expect(published.status).toBe('published');
    expect(plane.listDrafts().length).toBeGreaterThanOrEqual(1);
    expect(plane.activeSessions()).toHaveLength(1);

    plane.discard(session.getSession().sessionId);
    expect(plane.activeSessions()).toHaveLength(0);
  });
});
