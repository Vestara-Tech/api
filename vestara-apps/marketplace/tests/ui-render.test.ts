import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright-core';

describe('Marketplace UI (live API)', () => {
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

  const uiUrl = 'http://localhost:5178';

  it('lists packages on the Discover page', async () => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(String(err)));

    await page.goto(`${uiUrl}/marketplace`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('text=Build more with Vestara', { timeout: 15000 });
    const body = await page.textContent('body');
    expect(body).toContain('GitHub Integration');
    expect(body).toContain('Full-Stack Engineering Pack');
    expect(errors.filter((e) => !e.includes('favicon') && !e.includes('Failed to load resource'))).toEqual([]);
  }, 60000);

  it('opens a package detail with permissions and dependencies', async () => {
    await page.goto(`${uiUrl}/marketplace/packages/com.vestara.github`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('text=GitHub Integration', { timeout: 15000 });
    const body = await page.textContent('body');
    expect(body).toContain('Permissions');
    expect(body).toContain('workflow.execute');
    expect(body).toContain('Approval required');
  }, 60000);

  it('shows the Installed page', async () => {
    await page.goto(`${uiUrl}/marketplace/installed`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('text=Installed', { timeout: 15000 });
    const body = await page.textContent('body');
    expect(body).toContain('Installed');
  }, 60000);
});
