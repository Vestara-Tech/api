import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright-core';

describe('Agent Builder UI (live API)', () => {
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

  const uiUrl = 'http://localhost:5177';

  it('lists agents', async () => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(String(err)));

    await page.goto(`${uiUrl}/agent-builder`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('text=Agents', { timeout: 15000 });
    const body = await page.textContent('body');
    expect(body).toContain('Developer');
    expect(errors.filter((e) => !e.includes('favicon') && !e.includes('Failed to load resource'))).toEqual([]);
  }, 60000);

  it('opens the developer agent builder and navigates to Test Agent', async () => {
    await page.goto(`${uiUrl}/agent-builder/vestara-developer`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('text=Runtime', { timeout: 15000 });
    const body = await page.textContent('body');
    expect(body).toContain('vestara-developer');

    await page.goto(`${uiUrl}/agent-builder/vestara-developer/test`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('text=Test Agent', { timeout: 15000 });
  }, 60000);
});
