import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildApp } from '../../src/app.js';
import { createApplication } from '../../src/bootstrap/application.js';
import { loadConfig } from '../../src/config/schema.js';

export type DocsTarget = 'summary' | 'readme';

export interface SyncOptions {
  readonly write: boolean;
  readonly dryRun: boolean;
  readonly targets: readonly DocsTarget[];
}

export interface CapabilitySummary {
  readonly namespace: string;
  readonly version: string;
  readonly enabled: boolean;
  readonly permissions: readonly string[];
  readonly operations: readonly string[];
}

export interface SourceAreaSummary {
  readonly name: string;
  readonly category: 'module' | 'support';
  readonly fileCount: number;
}

export interface AdrSummary {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly path: string;
}

export interface PlatformSummaryData {
  readonly routeCount: number;
  readonly capabilityCount: number;
  readonly enabledCapabilityCount: number;
  readonly capabilities: readonly CapabilitySummary[];
  readonly sourceAreas: readonly SourceAreaSummary[];
  readonly adrs: readonly AdrSummary[];
  readonly packageScripts: readonly { readonly name: string; readonly command: string }[];
}

const README_PATH = resolve('README.md');
const GENERATED_OUTPUT = resolve('docs', 'automation', 'generated', 'platform-summary.md');
const README_BEGIN = '<!-- docs-sync:begin platform-summary -->';
const README_END = '<!-- docs-sync:end platform-summary -->';

const SUPPORT_DIRECTORIES = new Set(['bootstrap', 'core', 'config', 'routes', 'types', 'plugins']);
const SCRIPT_NAMES = [
  'verify',
  'verify:affected',
  'verify:static',
  'openapi:generate',
  'openapi:check',
  'contracts:frontend',
  'contracts:frontend:check',
  'docs:sync',
  'docs:check',
  'docs:commit',
  'docs:push',
  'docs:ship',
];

function formatList(values: readonly string[]): string {
  return values.length > 0 ? values.join(', ') : '—';
}

async function countFiles(root: string): Promise<number> {
  const entries = await readdir(root, { withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = resolve(root, entry.name);
    if (entry.isDirectory()) {
      count += await countFiles(full);
    } else if (entry.isFile()) {
      count += 1;
    }
  }
  return count;
}

async function collectSourceAreas(): Promise<readonly SourceAreaSummary[]> {
  const entries = await readdir(resolve('src'), { withFileTypes: true });
  const areas: SourceAreaSummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const category = SUPPORT_DIRECTORIES.has(entry.name) ? 'support' : 'module';
    const fileCount = await countFiles(resolve('src', entry.name));
    areas.push({ name: entry.name, category, fileCount });
  }
  return areas.sort((a, b) => a.name.localeCompare(b.name));
}

async function collectAdrs(): Promise<readonly AdrSummary[]> {
  const dir = resolve('docs', 'adr');
  const entries = await readdir(dir, { withFileTypes: true });
  const adrs: AdrSummary[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.startsWith('ADR-') || !entry.name.endsWith('.md')) continue;
    const filePath = resolve(dir, entry.name);
    const text = await readFile(filePath, 'utf8');
    const lines = text.split('\n');
    const titleLine = lines.find((line) => line.startsWith('# ')) ?? `# ${entry.name.replace(/\.md$/, '')}`;
    const statusLine = lines.find((line) => line.startsWith('- Status:')) ?? '- Status: unknown';
    const title = titleLine.replace(/^#\s+/, '').trim();
    const status = statusLine.replace('- Status:', '').trim();
    adrs.push({
      id: entry.name.replace(/\.md$/, ''),
      title,
      status,
      path: `docs/adr/${entry.name}`,
    });
  }
  return adrs.sort((a, b) => a.id.localeCompare(b.id));
}

async function collectPackageScripts(): Promise<readonly { readonly name: string; readonly command: string }[]> {
  const pkg = JSON.parse(await readFile(resolve('package.json'), 'utf8')) as { scripts?: Record<string, string> };
  return SCRIPT_NAMES
    .filter((name) => pkg.scripts?.[name] !== undefined)
    .map((name) => ({ name, command: pkg.scripts?.[name] ?? '' }));
}

export async function collectPlatformSummary(): Promise<PlatformSummaryData> {
  const config = loadConfig({});
  const application = createApplication(config);
  const app = await buildApp({ config, application, exposeDocs: false });
  await app.ready();

  try {
    const capabilities = application.capabilities.list().map<CapabilitySummary>((capability) => ({
      namespace: capability.namespace,
      version: capability.version,
      enabled: capability.enabled,
      permissions: capability.permissions,
      operations: capability.operations,
    }));

    const sourceAreas = await collectSourceAreas();
    const adrs = await collectAdrs();
    const packageScripts = await collectPackageScripts();
    const routeCount = Object.keys(app.swagger().paths ?? {}).length;

    return {
      routeCount,
      capabilityCount: capabilities.length,
      enabledCapabilityCount: capabilities.filter((capability) => capability.enabled).length,
      capabilities,
      sourceAreas,
      adrs,
      packageScripts,
    };
  } finally {
    await app.close();
  }
}

function renderOverviewTable(data: PlatformSummaryData): string {
  return [
    '| Metric | Value |',
    '|---|---|',
    `| Routes in OpenAPI | ${data.routeCount} |`,
    `| Registered capabilities | ${data.capabilityCount} |`,
    `| Enabled capabilities | ${data.enabledCapabilityCount} |`,
    `| Source areas | ${data.sourceAreas.length} |`,
    `| ADRs | ${data.adrs.length} |`,
  ].join('\n');
}

function renderPackageScriptsTable(data: PlatformSummaryData): string {
  return [
    '| Script | Command |',
    '|---|---|',
    ...data.packageScripts.map((script) => `| \`${script.name}\` | \`${script.command.replace(/`/g, '\\`')}\` |`),
  ].join('\n');
}

function renderSourceAreasTable(data: PlatformSummaryData): string {
  return [
    '| Source area | Category | Files |',
    '|---|---|---|',
    ...data.sourceAreas.map((area) => `| \`src/${area.name}/\` | ${area.category} | ${area.fileCount} |`),
  ].join('\n');
}

function renderCapabilitiesTable(data: PlatformSummaryData): string {
  return [
    '| Namespace | Version | Enabled | Permissions | Operations |',
    '|---|---|---:|---|---|',
    ...data.capabilities.map((capability) =>
      `| \`${capability.namespace}\` | ${capability.version} | ${capability.enabled ? 'yes' : 'no'} | ${formatList(capability.permissions)} | ${formatList(capability.operations)} |`,
    ),
  ].join('\n');
}

function renderAdrsTable(data: PlatformSummaryData): string {
  return [
    '| ADR | Status | Title |',
    '|---|---|---|',
    ...data.adrs.map((adr) => `| \`${adr.id}\` | ${adr.status} | ${adr.title.replace(/\|/g, '\\|')} |`),
  ].join('\n');
}

export function renderPlatformSummaryMarkdown(data: PlatformSummaryData): string {
  return [
    '# Generated Platform Summary',
    '',
    'Generated from the current repository state.',
    '',
    '## Overview',
    '',
    renderOverviewTable(data),
    '',
    '## Package scripts',
    '',
    renderPackageScriptsTable(data),
    '',
    '## Source areas',
    '',
    renderSourceAreasTable(data),
    '',
    '## Capabilities',
    '',
    renderCapabilitiesTable(data),
    '',
    '## ADR index',
    '',
    renderAdrsTable(data),
    '',
  ].join('\n');
}

export function renderReadmeSummaryBlock(data: PlatformSummaryData): string {
  const lines = [
    README_BEGIN,
    'Generated from the current repository state.',
    '',
    `- OpenAPI routes: ${data.routeCount}`,
    `- Registered capabilities: ${data.capabilityCount} (${data.enabledCapabilityCount} enabled)`,
    `- Source areas: ${data.sourceAreas.length}`,
    `- ADRs tracked: ${data.adrs.length}`,
    '',
    `- Full summary: [docs/automation/generated/platform-summary.md](./docs/automation/generated/platform-summary.md)`,
    '',
    'Key commands:',
  ];
  for (const script of data.packageScripts) {
    lines.push(`- \`${script.name}\` → \`${script.command}\``);
  }
  lines.push(README_END);
  return lines.join('\n');
}

export function replaceBlock(source: string, beginMarker: string, endMarker: string, replacement: string): string {
  const beginIndex = source.indexOf(beginMarker);
  const endIndex = source.indexOf(endMarker);
  if (beginIndex === -1 || endIndex === -1 || endIndex < beginIndex) {
    throw new Error(`Unable to locate doc sync markers ${beginMarker} / ${endMarker}`);
  }
  const before = source.slice(0, beginIndex);
  const after = source.slice(endIndex + endMarker.length);
  return `${before}${replacement}${after}`;
}

export async function syncPlatformDocs(options: SyncOptions): Promise<{ readonly summary: PlatformSummaryData; readonly readme: string; readonly summaryPath: string; readonly readmePath: string }> {
  const summary = await collectPlatformSummary();
  const summaryPath = GENERATED_OUTPUT;
  const readmePath = README_PATH;
  const summaryMarkdown = renderPlatformSummaryMarkdown(summary);
  const readmeBlock = renderReadmeSummaryBlock(summary);

  if (options.dryRun) {
    // eslint-disable-next-line no-console
    console.log(`Docs sync dry run → ${options.targets.join(', ')}`);
    return { summary, readme: readmeBlock, summaryPath, readmePath };
  }

  if (options.targets.includes('summary')) {
    await mkdir(resolve(summaryPath, '..'), { recursive: true });
    await writeFile(summaryPath, summaryMarkdown, 'utf8');
  }

  if (options.targets.includes('readme')) {
    const currentReadme = await readFile(readmePath, 'utf8');
    const updatedReadme = replaceBlock(currentReadme, README_BEGIN, README_END, readmeBlock);
    await writeFile(readmePath, updatedReadme, 'utf8');
  }

  return { summary, readme: readmeBlock, summaryPath, readmePath };
}

export async function checkPlatformDocs(targets: readonly DocsTarget[]): Promise<{ readonly ok: boolean; readonly drift: readonly string[] }> {
  const summary = await collectPlatformSummary();
  const summaryMarkdown = renderPlatformSummaryMarkdown(summary);
  const readmeBlock = renderReadmeSummaryBlock(summary);
  const drift: string[] = [];

  if (targets.includes('summary')) {
    const currentSummary = await readFile(GENERATED_OUTPUT, 'utf8').catch(() => '');
    if (currentSummary !== summaryMarkdown) drift.push(GENERATED_OUTPUT);
  }

  if (targets.includes('readme')) {
    const currentReadme = await readFile(README_PATH, 'utf8');
    const expectedReadme = replaceBlock(currentReadme, README_BEGIN, README_END, readmeBlock);
    if (currentReadme !== expectedReadme) drift.push(README_PATH);
  }

  return { ok: drift.length === 0, drift };
}
