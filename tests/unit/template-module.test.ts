import { describe, expect, it } from 'vitest';
import {
  TemplateService,
  TemplateRegistry,
  validateTemplate,
  validateParameterValues,
  instantiateTemplate,
  resolveTemplateString,
  bumpTemplateVersion,
  builtinTemplates,
  type TemplateDefinition,
} from '../../src/template/index.js';

function template(overrides: Partial<TemplateDefinition> = {}): TemplateDefinition {
  return {
    id: 't1',
    name: 'Template',
    version: '1.0.0',
    kind: 'dashboard',
    tags: [],
    parameters: [{ name: 'projectName', type: 'string', required: true }],
    definition: { name: '{{parameters.projectName}}' },
    requiredCapabilities: [],
    metadata: { version: '1.0.0', tags: [] },
    ...overrides,
  };
}

describe('TPL-004 constrained variable resolution', () => {
  it('resolves parameter and context placeholders', () => {
    expect(resolveTemplateString('{{parameters.projectName}} dashboard', { parameters: { projectName: 'Ops' } })).toBe('Ops dashboard');
    expect(resolveTemplateString('user: {{context.userName}}', { parameters: {}, userName: 'Eddie' })).toBe('user: Eddie');
  });

  it('leaves unknown placeholders intact (no arbitrary execution)', () => {
    expect(resolveTemplateString('{{process.exit(0)}}', { parameters: {} })).toBe('{{process.exit(0)}}');
    expect(resolveTemplateString('{{parameters.missing}}', { parameters: {} })).toBe('{{parameters.missing}}');
  });

  it('deep-resolves nested definitions', () => {
    const resolved = instantiateTemplate({ ...template(), definition: { name: '{{parameters.projectName}}', widgets: [{ title: '{{parameters.projectName}} widget' }] } }, { projectName: 'X' });
    expect(resolved).toEqual({ name: 'X', widgets: [{ title: 'X widget' }] });
  });
});

describe('TPL-007 validation', () => {
  it('rejects templates without identity/version', () => {
    expect(validateTemplate(template({ id: '' })).ok).toBe(false);
    expect(validateTemplate(template({ metadata: { version: '', tags: [] } })).ok).toBe(false);
  });

  it('validates parameter values against the schema', () => {
    const t = template({ parameters: [{ name: 'projectName', type: 'string', required: true }, { name: 'mode', type: 'enum', enumValues: ['a', 'b'] }] });
    expect(validateParameterValues(t, {}).some((e) => e.includes('projectName'))).toBe(true);
    expect(validateParameterValues(t, { projectName: 'X', mode: 'c' }).some((e) => e.includes('mode'))).toBe(true);
    expect(validateParameterValues(t, { projectName: 'X', mode: 'a' })).toHaveLength(0);
  });
});

describe('TPL-005/008 registry + revisions', () => {
  it('registers, lists, and lists by kind', () => {
    const registry = new TemplateRegistry();
    registry.register(template());
    registry.register({ ...template({ id: 't2', kind: 'page' }) });
    expect(registry.list()).toHaveLength(2);
    expect(registry.listByKind('page')).toHaveLength(1);
    expect(registry.listKinds()).toContain('dashboard');
  });

  it('bumps versions', () => {
    const bumped = bumpTemplateVersion(template(), '2.0.0');
    expect(bumped.version).toBe('2.0.0');
    expect(bumped.metadata.version).toBe('2.0.0');
  });
});

describe('TPL service', () => {
  it('registers validated templates and instantiates them', () => {
    const service = new TemplateService();
    const t = template();
    service.register(t);
    const result = service.instantiate<{ name: string }>('t1', { projectName: 'My Project' });
    expect(result.definition.name).toBe('My Project');
  });

  it('rejects invalid parameters on instantiation', () => {
    const service = new TemplateService();
    service.register(template());
    expect(() => service.instantiate('t1', {})).toThrow(/projectName/);
  });

  it('rejects invalid templates on registration', () => {
    const service = new TemplateService();
    expect(() => service.register(template({ id: '' }))).toThrow(/Invalid template/);
  });
});

describe('TPL-013..018 built-in templates', () => {
  it('ships templates across kinds', () => {
    const templates = builtinTemplates();
    const kinds = new Set(templates.map((t) => t.kind));
    expect(kinds.has('dashboard')).toBe(true);
    expect(kinds.has('page')).toBe(true);
    expect(kinds.has('application')).toBe(true);
    expect(kinds.has('agent')).toBe(true);
    expect(kinds.has('os-image')).toBe(true);
  });

  it('instantiates the engineering dashboard template with a recommended theme', () => {
    const service = new TemplateService();
    for (const t of builtinTemplates()) service.register(t);
    const engineering = service.get('template.dashboard.engineering');
    expect(engineering.recommendedThemeId).toBe('vestara.dark');
    const result = service.instantiate<{ name: string; refreshInterval: string }>('template.dashboard.engineering', { projectName: 'Core' });
    expect(result.definition.name).toBe('Core Dashboard');
    expect(result.definition.refreshInterval).toBe('30');
  });

  it('recommends themes independently replaceable', () => {
    const service = new TemplateService();
    for (const t of builtinTemplates()) service.register(t);
    const appTemplate = service.get('template.application.admin');
    expect(appTemplate.recommendedThemeId).toBe('vestara.dark');
    // The theme is a recommendation, not part of the definition.
    expect('recommendedThemeId' in appTemplate.definition).toBe(false);
  });
});
