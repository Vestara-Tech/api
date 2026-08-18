import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright-core';

describe('AI Experience UI (live API)', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    page = await browser.newPage();
  }, 30000);

  afterAll(async () => {
    await browser?.close();
  });

  const uiUrl = 'http://localhost:5176';

  it('boots Activity Room with a seeded goal and chat handoff', async () => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(String(err)));

    const goal = 'Build the Theme Builder';

    await page.goto(`${uiUrl}/ai/activity?goal=${encodeURIComponent(goal)}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('text=Activity Room', { timeout: 15000 });
    expect(await page.getByLabel('Objective').inputValue()).toBe(goal);
    await page.waitForSelector('text=workflow.create', { timeout: 15000 });
    const body = await page.textContent('body');
    expect(body).toContain('Activity Room');
    expect(body).toContain('Execution plan preview');
    expect(body).toContain('Theme Builder');
    expect(body).toContain('Execution inspector');
    expect(body).toContain('Draft executions');
    expect(body).toContain('Execution timeline');
    expect(body).toContain('Execution evidence');
    expect(body).toContain('Activity stream');
    expect(body).toContain('AI Experience');
    expect(body).toContain('Discuss in AI Chat');
    expect(errors.filter((e) => !e.includes('favicon') && !e.includes('Failed to load resource'))).toEqual([]);
  }, 60000);

  it('navigates to AI Chat and Agent Workspace', async () => {
    const goal = 'Build the Theme Builder';

    await page.goto(`${uiUrl}/ai/chat?goal=${encodeURIComponent(goal)}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('text=AI Chat', { timeout: 15000 });
    expect(await page.getByPlaceholder('Message the Vestara AI…').inputValue()).toBe(goal);
    await page.waitForSelector('text=Live execution context for chat and governed runs.', { timeout: 15000 });
    expect(await page.textContent('body')).toContain('Open Activity Room');

    await page.goto(`${uiUrl}/ai/agents`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('text=Agent Workspace', { timeout: 15000 });
    const body = await page.textContent('body');
    expect(body).toContain('Agent Workspace');
  }, 60000);
});
