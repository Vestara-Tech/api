import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright-core';

const API_BASE = process.env.VESTARA_API_URL ?? 'http://127.0.0.1:4310';

describe('API Builder UI (live API)', () => {
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

  const uiUrl = 'http://localhost:5174';

  it('boots and shows the definitions dashboard', async () => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(String(err)));

    await page.goto(`${uiUrl}/definitions`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('text=API Definitions', { timeout: 15000 });

    const body = await page.textContent('body');
    expect(body).toContain('API Definitions');
    expect(errors.filter((e) => !e.includes('favicon') && !e.includes('Failed to load resource'))).toEqual([]);
  }, 60000);

  it('creates a definition and renders the builder canvas', async () => {
    await page.click('text=New Definition');
    await page.fill('input[placeholder="Commerce API"]', 'Catalog API');
    await page.click('button:has-text("Create")');
    await page.waitForURL(/\/definitions\/[^/]+$/, { timeout: 15000 });
    await page.waitForSelector('text=Add Resource', { timeout: 15000 });

    const body = await page.textContent('body');
    expect(body).toContain('Catalog API');
  }, 60000);
});
