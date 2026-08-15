import { describe, expect, it } from 'vitest';
import { applicationsSizeMb, APP_CATALOG, catalogEntry, PRESETS } from '../src/types/domain';

describe('application catalog', () => {
  it('includes core apps marked required', () => {
    const core = APP_CATALOG.filter((a) => a.category === 'core');
    expect(core.length).toBeGreaterThanOrEqual(4);
    expect(core.every((a) => a.required)).toBe(true);
  });

  it('resolves catalog entries by id', () => {
    expect(catalogEntry('@vestara/app-workspace')?.name).toBe('Workspace');
    expect(catalogEntry('@vestara/app-workspace')?.sizeMb).toBe(148);
    expect(catalogEntry('nope')).toBeUndefined();
  });
});

describe('applicationsSizeMb', () => {
  it('sums catalog sizes', () => {
    expect(applicationsSizeMb(['@vestara/app-workspace', '@vestara/app-marketplace'])).toBe(180);
    expect(applicationsSizeMb([])).toBe(0);
    expect(applicationsSizeMb(['@vestara/app-workspace', 'unknown-app'])).toBe(148);
  });
});

describe('presets', () => {
  it('covers the five presets: desktop, developer, server, recovery, custom', () => {
    const ids = PRESETS.map((p) => p.id);
    expect(ids).toEqual([
      'vestara-desktop',
      'vestara-developer',
      'vestara-server',
      'vestara-recovery',
      'custom',
    ]);
  });

  it('every preset carries a complete profile base', () => {
    for (const preset of PRESETS) {
      expect(preset.base.id).toBe(preset.id);
      expect(preset.base.version).toBeTruthy();
      expect(preset.base.architecture).toBeTruthy();
      expect(preset.base.base).toBeTruthy();
      expect(preset.base.boot).toBeTruthy();
      expect(preset.base.system).toBeTruthy();
      expect(preset.base.applications).toBeTruthy();
      expect(preset.base.login).toBeTruthy();
      expect(preset.base.security).toBeTruthy();
      expect(preset.base.recovery).toBeTruthy();
    }
  });
});
