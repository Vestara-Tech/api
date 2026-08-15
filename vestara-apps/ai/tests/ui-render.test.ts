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

  it('boots the AI Experience with the three surfaces', async () => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(String(err)));

    await page.goto(`${uiUrl}/ai/activity`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('text=Activity Room', { timeout: 15000 });
    const body = await page.textContent('body');
    expect(body).toContain('Activity Room');
    expect(body).toContain('AI Experience');
    expect(errors.filter((e) => !e.includes('favicon') && !e.includes('Failed to load resource'))).toEqual([]);
  }, 60000);

  it('navigates to AI Chat and Agent Workspace', async () => {
    await page.goto(`${uiUrl}/ai/chat`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('text=AI Chat', { timeout: 15000 });

    await page.goto(`${uiUrl}/ai/agents`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('text=Agent Workspace', { timeout: 15000 });
    const body = await page.textContent('body');
    expect(body).toContain('Agent Workspace');
  }, 60000);
});
